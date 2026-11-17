---
name: release
description: Release TakaLeaf now — open or refresh the release PR develop → main, see it merge and tag, and confirm the sync back into develop.
disable-model-invocation: true
---

Release what is on `develop` to production, following `docs/GIT-WORKFLOW.md` §Release.

1. `git fetch origin main develop`; if `git diff --quiet origin/main origin/develop`, there is
   nothing to release: say so and stop. Otherwise list the changes:
   `git log --first-parent --format='- %s' origin/main..origin/develop`.
2. Start the release train: `gh workflow run release.yml --ref develop`. If that is not allowed
   here, open the PR directly: `gh pr create --base main --head develop --title "Release <YYYY-MM-DD>"`
   with the change list as the body, then `gh workflow run ci.yml --ref develop`.
3. If the repository variable `AUTO_RELEASE` is `false`, add the label `release:approved` to the PR.
4. Auto merge merges it (merge commit) when CI is green on develop's head, creates the tag and
   GitHub release `vYYYY.MM.DD`, starts CI (and the Android build if the app changed) on main, and
   opens the sync PR main → develop. Dokploy deploys main.
5. Use the `release-manager` agent to check each step; report the tag, the release PR, and the
   sync PR state.
