#!/usr/bin/env bash
# One-time repository setup for the Git workflow (docs/GIT-WORKFLOW.md §7). Run it once, as the
# repository owner, on your own computer with the GitHub CLI signed in (gh auth login). Safe to
# run again: every step sets the same end state.
#
#   bash .github/scripts/setup-repo.sh
#
# Does: default branch develop; squash + merge commits, no rebase; auto-delete head branches;
# GitHub Actions may open PRs (release and sync PRs); the ruleset protecting main and develop;
# the Claude token secret if you paste one; deletes branches whose PR was merged. The Claude GitHub App itself is installed in the
# browser: https://github.com/apps/claude (or /install-github-app in Claude Code, which does both).
set -euo pipefail

REPO="${REPO:-monirujjaman-dev/taka-leaf}"
R="repos/$REPO"

echo "1/5 Repository settings"
gh api -X PATCH "$R" -f default_branch=develop -F allow_squash_merge=true -F allow_merge_commit=true \
  -F allow_rebase_merge=false -F delete_branch_on_merge=true -F allow_update_branch=true \
  -f squash_merge_commit_title=PR_TITLE -f squash_merge_commit_message=PR_BODY \
  --jq '"   default=\(.default_branch) squash=\(.allow_squash_merge) merge=\(.allow_merge_commit) rebase=\(.allow_rebase_merge) delete-branch=\(.delete_branch_on_merge)"'

echo "2/5 Let GitHub Actions open pull requests (keeps the current default token permission)"
current=$(gh api "$R/actions/permissions/workflow" --jq .default_workflow_permissions)
gh api -X PUT "$R/actions/permissions/workflow" -f default_workflow_permissions="$current" \
  -F can_approve_pull_request_reviews=true
echo "   default token: $current, can open PRs: yes"

echo "3/5 Ruleset: protect main and develop"
ruleset=$(cat <<'JSON'
{
  "name": "Protect main and develop",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["refs/heads/main", "refs/heads/develop"], "exclude": [] } },
  "bypass_actors": [ { "actor_id": 5, "actor_type": "RepositoryRole", "bypass_mode": "always" } ],
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    { "type": "pull_request", "parameters": {
        "required_approving_review_count": 0, "dismiss_stale_reviews_on_push": false,
        "require_code_owner_review": false, "require_last_push_approval": false,
        "required_review_thread_resolution": false, "allowed_merge_methods": ["squash", "merge"] } },
    { "type": "required_status_checks", "parameters": {
        "strict_required_status_checks_policy": false,
        "required_status_checks": [
          { "context": "Web and shared package" },
          { "context": "Backend" },
          { "context": "Docker image and browser tests" } ] } }
  ]
}
JSON
)
id=$(gh api "$R/rulesets" --jq '.[] | select(.name == "Protect main and develop") | .id')
if [ -n "$id" ]; then
  gh api -X PUT "$R/rulesets/$id" --input - <<<"$ruleset" --jq '"   updated ruleset \(.id)"'
else
  gh api -X POST "$R/rulesets" --input - <<<"$ruleset" --jq '"   created ruleset \(.id)"'
fi

echo "4/5 Claude token"
if gh secret list -R "$REPO" | grep -q '^CLAUDE_CODE_OAUTH_TOKEN'; then
  echo "   CLAUDE_CODE_OAUTH_TOKEN is already set."
else
  echo "   Make one with: claude setup-token   (uses your Claude subscription)"
  read -r -s -p "   Paste the token (empty to skip): " token; echo
  if [ -n "$token" ]; then
    gh secret set CLAUDE_CODE_OAUTH_TOKEN -R "$REPO" --body "$token"
    echo "   Saved."
  else
    echo "   Skipped. Claude review will fail until the secret exists."
  fi
fi

echo "5/5 Clean up merged branches"
owner="${REPO%%/*}"
for b in $(gh api "$R/branches" --paginate --jq '.[].name'); do
  case "$b" in main|develop) continue ;; esac
  # Squash merges leave the branch "ahead", so look for a merged PR instead, or nothing new.
  # Only trust the merged PR if the branch tip is the commit it merged: a reused name may hold new work.
  merged_sha=$(gh api "$R/pulls?state=closed&head=$owner:$b&per_page=1" --jq '.[0] | select(.merged_at) | .head.sha // empty')
  tip=$(gh api "$R/git/ref/heads/$b" --jq .object.sha)
  if { [ -n "$merged_sha" ] && [ "$merged_sha" = "$tip" ]; } || [ "$(gh api "$R/compare/develop...$b" --jq .ahead_by)" = 0 ]; then
    gh api -X DELETE "$R/git/refs/heads/$b" && echo "   deleted $b"
  fi
done

echo
echo "Done. Still to do in the browser if not done yet: install https://github.com/apps/claude on $REPO."
