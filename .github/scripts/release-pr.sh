#!/usr/bin/env bash
# Opens or refreshes the release PR develop -> main. Env: GH_TOKEN, REPO.
set -euo pipefail

git fetch -q origin main develop
if git diff --quiet origin/main origin/develop; then
  echo "develop has nothing that main does not. No release."
  exit 0
fi

changes=$(git log --first-parent --format='- %s' origin/main..origin/develop | grep -vE '^- (Sync main into develop|Merge )' || true)
[ -n "$changes" ] || changes="- (only merge commits)"
body="Release train: merges \`develop\` into \`main\`. Dokploy deploys \`main\` to production.

## Changes
$changes

<sub>Kept up to date by the Release train workflow. Auto merge merges it when CI is green on develop's head, tags the release and syncs main back into develop. Add \`no-auto-merge\` to hold it.</sub>"

pr=$(gh pr list -R "$REPO" --base main --head develop --state open --json number --jq '.[0].number // empty')
if [ -n "$pr" ]; then
  gh pr edit "$pr" -R "$REPO" --body "$body" >/dev/null
  echo "Refreshed release PR #$pr."
else
  gh pr create -R "$REPO" --base main --head develop --title "Release $(TZ=Asia/Dhaka date +%Y-%m-%d)" \
    --body "$body" --label type:release
  echo "Opened the release PR."
fi

sha=$(git rev-parse origin/develop)
runs=$(gh api "repos/$REPO/commits/$sha/check-runs" --jq '[.check_runs[] | select(.name == "Backend")] | length')
if [ "$runs" -eq 0 ]; then
  gh workflow run ci.yml -R "$REPO" --ref develop
  echo "Started CI on develop (${sha:0:7})."
fi
