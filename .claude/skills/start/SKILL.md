---
name: start
description: Start new TakaLeaf work on a correctly named branch from the latest develop (or from main for a hotfix).
argument-hint: "<type>/<topic>  e.g. feature/tags, fix/budget-rounding, hotfix/login-crash"
disable-model-invocation: true
---

Start work on **$ARGUMENTS** following `docs/GIT-WORKFLOW.md`.

1. Check the name: `bash .github/scripts/branch-kind.sh "$ARGUMENTS" develop` (for `hotfix/*` use
   `main`). Types: `feature`, `fix`, `docs`, `chore`, `refactor`, `perf`, `test`, `ci` → develop;
   `hotfix` → main. Topic is kebab-case. If the name fails, suggest a correct one and stop.
2. `git status`: if there are uncommitted changes, ask whether to bring them along or stash them.
3. `git fetch origin develop main`, then
   `git switch -c $ARGUMENTS origin/develop` (or `origin/main` for a hotfix).
4. Say which base it started from and the next step: build, `/check`, then `/ship`.
