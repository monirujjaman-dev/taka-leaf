#!/usr/bin/env bash
# The merge agent. Merges every open pull request that is ready, then does what follows a merge.
#
#   auto-merge.sh [branch]   only the open PR whose head is <branch>; without it, every open PR
#
# Ready means: not a draft; no no-auto-merge / needs-owner label; the branch follows the model
# (branch-kind.sh); no conflicts; every check on the head commit finished without failing; and the
# required checks passed: the three CI jobs, plus "Branch policy" and "Claude review" for work and
# hotfix PRs (release and sync PRs only carry changes that were already reviewed).
#
# After a merge:
#   into develop        CI runs on develop's new head (it is the head of the release PR)
#   release or hotfix   tag vYYYY.MM.DD[.N] and a GitHub release (never marked "latest": that is the
#                       Android download), CI on main, the Android build if the app changed, and a
#                       sync PR main -> develop
#
# Env: GH_TOKEN, REPO, AUTO_RELEASE ("false" holds release PRs until labelled release:approved).
set -euo pipefail

dir="$(cd "$(dirname "$0")" && pwd)"
only="${1:-}"
ci_checks=("Web and shared package" "Backend" "Docker image and browser tests")

log() { echo "PR #$1: $2"; }

dispatch() { # workflow ref
  gh workflow run "$1" -R "$REPO" --ref "$2" && echo "Started $1 on $2." || echo "::warning::Could not start $1 on $2."
}

comment_once() { # pr marker body
  local existing
  existing=$(gh api "repos/$REPO/issues/$1/comments" --paginate --jq ".[] | select(.body | startswith(\"<!-- $2 -->\")) | .id" | head -1)
  [ -n "$existing" ] || gh pr comment "$1" -R "$REPO" --body "<!-- $2 -->
$3" >/dev/null
}

after_main_merge() { # pr kind title body
  local n=$1 kind=$2 title=$3 body=$4 sha version notes
  sha=$(gh pr view "$n" -R "$REPO" --json mergeCommit --jq .mergeCommit.oid)
  git fetch -q --depth=50 origin main develop
  version=$("$dir/next-version.sh")
  if [ "$kind" = hotfix ]; then
    notes="Hotfix: $title (#$n)"$'\n\n'"$body"
  else
    notes="$body"
  fi
  gh release create "$version" -R "$REPO" --target "$sha" --title "TakaLeaf $version" \
    --notes "$notes" --latest=false && echo "Released $version at ${sha:0:7}."
  dispatch ci.yml main
  if git diff --name-only "$sha^1" "$sha" | grep -qE '^(apps/mobile/|packages/shared/|pnpm-lock\.yaml)'; then
    dispatch android.yml main
  fi
  if [ "$(git rev-list --count origin/develop..origin/main)" -gt 0 ] &&
     [ -z "$(gh pr list -R "$REPO" --base develop --head main --state open --json number --jq '.[0].number // empty')" ]; then
    gh pr create -R "$REPO" --base develop --head main --title "Sync main into develop after $version" \
      --body "Brings $version (#$n) back into develop so the next work starts from what is live. Merged automatically when CI is green." \
      --label type:sync || echo "::warning::Could not open the sync PR."
  fi
}

try_merge() {
  local n=$1 j title draft head base sha labels kind method latest pending failed missing r body
  j=$(gh pr view "$n" -R "$REPO" --json number,title,body,isDraft,headRefName,baseRefName,headRefOid,labels,mergeable,statusCheckRollup)
  title=$(jq -r .title <<<"$j"); draft=$(jq -r .isDraft <<<"$j")
  head=$(jq -r .headRefName <<<"$j"); base=$(jq -r .baseRefName <<<"$j"); sha=$(jq -r .headRefOid <<<"$j")
  labels=",$(jq -r '[.labels[].name] | join(",")' <<<"$j"),"

  [ "$draft" = false ] || { log "$n" "draft, waiting."; return 0; }
  [[ ! "$labels" =~ ,(no-auto-merge|needs-owner), ]] || { log "$n" "held by label."; return 0; }
  kind=$("$dir/branch-kind.sh" "$head" "$base" 2>/dev/null) || { log "$n" "$head -> $base breaks the branch policy."; return 0; }
  if [ "$kind" = release ] && [ "${AUTO_RELEASE:-true}" = false ] && [[ ! "$labels" =~ ,release:approved, ]]; then
    log "$n" "release held (AUTO_RELEASE=false); add release:approved to ship it."; return 0
  fi

  case "$(jq -r .mergeable <<<"$j")" in
    CONFLICTING)
      gh pr edit "$n" -R "$REPO" --add-label merge-conflict >/dev/null 2>&1 || true
      comment_once "$n" "auto-merge-conflict" "This PR conflicts with \`$base\`. Update the branch (merge or rebase \`$base\` into it) and push; Auto merge picks it up again."
      log "$n" "conflicts with $base."; return 0 ;;
    UNKNOWN) log "$n" "mergeability not known yet."; return 0 ;;
  esac

  # The newest run of each check on the head commit.
  latest=$(jq -c '[.statusCheckRollup[] | {name: (.name // .context), status: (.status // "COMPLETED"),
      conclusion: ((.conclusion // .state // "") | ascii_upcase), at: (.startedAt // .createdAt // "")}]
      | group_by(.name) | map(sort_by(.at) | last)' <<<"$j")
  pending=$(jq -r '[.[] | select(.status != "COMPLETED") | .name] | join(", ")' <<<"$latest")
  [ -z "$pending" ] || { log "$n" "waiting for: $pending."; return 0; }
  failed=$(jq -r '[.[] | select(.conclusion | IN("SUCCESS","SKIPPED","NEUTRAL") | not) | .name] | join(", ")' <<<"$latest")
  [ -z "$failed" ] || { log "$n" "failing: $failed."; return 0; }

  local required=("${ci_checks[@]}")
  case "$kind" in release|sync) ;; *) required+=("Branch policy" "Claude review") ;; esac
  missing=""
  for r in "${required[@]}"; do
    jq -e --arg r "$r" 'any(.[]; .name == $r and .conclusion == "SUCCESS")' <<<"$latest" >/dev/null || missing+="${missing:+, }$r"
  done
  if [ -n "$missing" ]; then
    log "$n" "not passed yet: $missing."
    # Bot-opened PRs (release, sync) get no pull_request events, so start CI on their head.
    if [[ "$kind" =~ ^(release|sync)$ ]] && [[ "$missing" == *Backend* ]] &&
       ! jq -e 'any(.[]; .name == "Backend")' <<<"$latest" >/dev/null; then
      dispatch ci.yml "$head"
    fi
    return 0
  fi

  case "$kind" in
    release) method=(--merge --subject "Release $("$dir/next-version.sh") (#$n)") ;;
    sync) method=(--merge --subject "$title (#$n)") ;;
    *) method=(--squash --delete-branch) ;;
  esac
  log "$n" "ready ($kind). Merging into $base."
  if ! gh pr merge "$n" -R "$REPO" "${method[@]}" --match-head-commit "$sha"; then
    log "$n" "merge refused (the branch may have moved or a rule failed)."; return 0
  fi
  body=$(jq -r .body <<<"$j")
  case "$kind" in
    release|hotfix) after_main_merge "$n" "$kind" "$title" "$body" ;;
    *) dispatch ci.yml develop ;;
  esac
}

if [ -n "$only" ]; then
  prs=$(gh pr list -R "$REPO" --head "$only" --state open --json number --jq '.[].number')
else
  prs=$(gh pr list -R "$REPO" --state open --limit 100 --json number --jq '.[].number')
fi
[ -n "$prs" ] || { echo "No open PRs to look at."; exit 0; }
for n in $prs; do try_merge "$n" || echo "::warning::PR #$n: $?"; done
