---
name: ship
description: Commit the current TakaLeaf work on a branch, open a pull request, wait for CI, fix failures, and squash-merge when green.
argument-hint: "[short title]"
disable-model-invocation: true
---

Ship the current work as **$ARGUMENTS**.

1. `git status` / `git diff`: make sure only intended files changed, with no secrets and no
   `Data/Migrations` edits by hand.
2. If on `main`, create a branch (`m<N>/<topic>` or `fix/<topic>`).
3. Commit with a short subject and a body listing what changed and why, in plain words.
4. Push and open a PR with a short "What" section (tables for endpoints or screens help) and how it
   was tested.
5. Watch CI (`gh run watch`). All three jobs must pass: Web and shared package, Backend, Docker image.
   On failure read the log (`gh run view <id> --log-failed`), fix, push again.
6. When green, squash-merge, switch to `main`, pull, and confirm CI on `main` passes.
7. Report: PR number, what shipped, anything left over.
