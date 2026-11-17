---
name: hotfix
description: Fix a production bug in TakaLeaf straight from main with a hotfix/* branch, then make sure the fix flows back into develop.
argument-hint: "<topic>  e.g. login-crash"
disable-model-invocation: true
---

Hotfix **$ARGUMENTS** following `docs/GIT-WORKFLOW.md` §Hotfix. Only for something broken in
production that can't wait for the next release; everything else is a `fix/*` branch into develop.

1. `git fetch origin main` and `git switch -c hotfix/$ARGUMENTS origin/main`.
2. Reproduce with a failing test first, then the smallest fix. No refactors, no extra features.
3. `/check`, then the `reviewer` agent (diff against `origin/main`).
4. Push and `gh pr create --base main --title "Hotfix: <what>"`.
5. PR policy, CI and Claude review run; Auto merge squash-merges into main when green, tags
   `vYYYY.MM.DD[.N]`, and opens the sync PR main → develop, merged automatically when green.
6. Confirm the sync PR merged (it can conflict if develop changed the same lines: then resolve on a
   `fix/sync-<topic>` branch from develop). Report the PR, tag and sync state.
