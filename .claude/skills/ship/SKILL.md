---
name: ship
description: Commit the current TakaLeaf work on its branch, open a pull request into develop (or main for a hotfix), and see it through CI, Claude review and auto merge.
argument-hint: "[short title]"
disable-model-invocation: true
---

Ship the current work as **$ARGUMENTS**, following `docs/GIT-WORKFLOW.md`.

1. `git status` / `git diff`: only intended files changed, no secrets, no hand edits in
   `Data/Migrations`.
2. If on `main` or `develop`, create a work branch first (`/start feature/<topic>`, or
   `fix/<topic>`; `hotfix/<topic>` from `origin/main` only for a production fix).
3. Run `/check`. Then run the `reviewer` agent on the diff and fix its blocking findings before
   pushing; the same checklist runs again on GitHub as "Claude review".
4. Commit with a short subject and a body listing what changed and why, in plain words.
5. Push (`git push -u origin HEAD`) and open the PR with the template:
   `gh pr create --base develop` (`--base main` for `hotfix/*`), with a short "What" section and
   how it was tested.
6. Do not merge by hand. The automation does it:
   - **PR policy** checks the branch name and target; **CI** runs web, backend, Docker image and
     browser tests; **Claude review** posts findings and passes or fails.
   - On failure, **Claude fixer** fixes and pushes (up to two rounds, then `needs-owner`). You can
     also fix locally with the `pr-fixer` agent and push.
   - **Auto merge** squash-merges into develop when everything is green and deletes the branch.
   Watch with `gh pr checks <n> --watch`. If the session can't wait, report the PR and stop.
7. If the work needs to be live now (not with the nightly release), run `/release`.
8. Report: PR number, its state (merged, or waiting for what), anything left over.
