# TakaLeaf — Git workflow and automation

How code moves from an idea to production, and which agents move it. The rules here are enforced
by `.github/scripts/branch-kind.sh` (the branching model in code), the **PR policy**, **CI**,
**Claude review** checks and the **Auto merge** agent.

## 1. Branches

```
feature/*  fix/*  docs/*  chore/*  refactor/*  perf/*  test/*  ci/*  claude/*
     │  squash-merge (Auto merge, after CI + Branch policy + Claude review)
     ▼
  develop ───────── release PR (nightly Release train, merge commit) ─────────▶ main ──▶ Dokploy
     ▲                                                                            │  tag vYYYY.MM.DD
     └──────────────── sync PR main → develop (merge commit, automatic) ◀────────┤
                                                                                  ▲
                                   hotfix/*  squash-merge (CI + review) ──────────┘
```

| Branch | Lives | Starts from | Merges into | How | Who pushes |
| --- | --- | --- | --- | --- | --- |
| `main` | forever | — | — | — | nobody: PRs only. Always what is live; Dokploy deploys it |
| `develop` | forever, **default branch** | — | `main` | release PR, merge commit | nobody: PRs only. Always releasable |
| `feature/<topic>` | hours to days | `develop` | `develop` | squash | you or Claude |
| `fix/<topic>` | hours | `develop` | `develop` | squash | you or Claude |
| `docs/` `chore/` `refactor/` `perf/` `test/` `ci/` `<topic>` | hours | `develop` | `develop` | squash | you or Claude |
| `claude/<…>` | hours | `develop` | `develop` | squash | the Claude assistant (from an issue) |
| `hotfix/<topic>` | hours | `main` | `main` | squash | you or Claude, only for production bugs |

Naming: `<type>/<topic>`, lowercase kebab-case topic (`feature/bank-loans`, `fix/budget-rounding`,
`hotfix/login-crash`). Anything else fails **Branch policy**. The old milestone prefixes (`m<N>/`,
`a<N>/`) are retired; put the milestone in the PR title or body instead.

Merge methods are fixed: work branches and hotfixes are **squashed** (one commit per PR on the
target, subject `<PR title> (#<n>)`); release and sync PRs use a **merge commit** so `develop` and
`main` share history and never drift.

## 2. The agents

| Agent | Where | Does | Turn off |
| --- | --- | --- | --- |
| **PR policy** | `.github/workflows/pr-policy.yml` | Checks branch name and target; labels the PR `type:<kind>` | — |
| **CI** | `.github/workflows/ci.yml` (+ `android.yml` when the app changes) | Web and shared package, Backend, Docker image and browser tests, Dependency scan | — |
| **Claude review** | `.github/workflows/claude-review.yml` | Reviews with `.claude/agents/reviewer.md`; inline comments; one summary comment; pass/fail check; labels `claude:approved` / `claude:changes-requested` | — (required) |
| **Claude fixer** | `.github/workflows/claude-fix.yml` | When CI or review fails: fixes on the PR branch, runs tests, pushes. Max `MAX_FIX_ROUNDS` (2), then `needs-owner` | label `no-auto-fix`; variable `AUTO_FIX=false` |
| **Auto merge** | `.github/workflows/auto-merge.yml` → `.github/scripts/auto-merge.sh` | Merges ready PRs with the right method; after main merges: tag + GitHub release, CI and Android on main, sync PR | label `no-auto-merge`; variable `AUTO_MERGE=false` |
| **Release train** | `.github/workflows/release.yml` → `.github/scripts/release-pr.sh` | 03:00 Asia/Dhaka nightly and on demand: opens/refreshes release PR develop → main | variable `AUTO_RELEASE=false` |
| **Claude assistant** | `.github/workflows/claude.yml` | `@claude …` in an issue, PR comment or review (owner/collaborators), or label `claude` on an issue: implements on a `claude/*` branch and opens a PR into develop | remove the workflow |

Local Claude Code counterparts (in `.claude/`): agents `reviewer`, `pr-fixer`, `release-manager`,
`ui-checker`; skills `/start`, `/check`, `/ship`, `/release`, `/hotfix`, `/new-slice`, `/migration`.

### When a PR merges by itself

Auto merge merges a PR when **all** of these hold:

1. not a draft; no `no-auto-merge`, `needs-owner` label;
2. head → base is allowed (§1) and there are no conflicts;
3. every check on the head commit finished, none failed (skipped is fine), including Android and
   Dependency scan when they ran;
4. passed: **Web and shared package**, **Backend**, **Docker image and browser tests**, and for work
   and hotfix PRs also **Branch policy** and **Claude review**;
5. for release PRs: `AUTO_RELEASE` is not `false`, or the PR has `release:approved`.

It runs when any check workflow finishes and hourly as a sweep. On conflict it labels
`merge-conflict` and comments once: update the branch with its base and push.

## 3. Everyday flow

```bash
/start feature/tags           # or: git fetch && git switch -c feature/tags origin/develop
# … build with /new-slice, /migration, tests …
/check                        # same checks as CI
/ship "Tags on transactions"  # reviewer agent locally, push, PR into develop
```

Then hands off: CI + Claude review run; if they fail Claude fixer pushes a fix; when green Auto
merge squash-merges and deletes the branch. The nightly release train ships it to production.

From anywhere (phone included): open an issue, write `@claude <what you want>`; the assistant opens
a PR that goes through the same gates.

## 4. Release

- **Nightly**: Release train opens or refreshes the PR **develop → main** ("Release YYYY-MM-DD",
  body lists every change). CI runs on develop's head. Auto merge merges it with
  `Release vYYYY.MM.DD (#n)`; then:
  - tag and GitHub release `vYYYY.MM.DD` (`.2`, `.3` for more the same day), **never marked latest**
    — "latest" is the Android download (`android-v*` from `android.yml`);
  - CI on main, and the Android build + APK release if `apps/mobile`, `packages/shared` or the
    lockfile changed;
  - Dokploy deploys main (its own GitHub webhook);
  - sync PR **main → develop** (merge commit), merged automatically when green.
- **Now**: `/release`, or Actions → Release train → Run workflow.
- **Hold releases**: set `AUTO_RELEASE=false`; release PRs then wait for the `release:approved` label.
- **Roll back**: revert on a `fix/revert-<topic>` branch into develop and release, or for an urgent
  case a `hotfix/revert-<topic>`; Dokploy can also redeploy an earlier deployment from its UI.

## 5. Hotfix

Only for a production bug that can't wait: `/hotfix <topic>` → `hotfix/<topic>` from `origin/main`,
failing test first, smallest fix, PR into `main`. Same gates as work PRs. After the squash merge:
tag, release, CI/Android on main, and the sync PR back into develop. If the sync conflicts, resolve
it on a `fix/sync-<topic>` branch from develop.

## 6. Database migrations

Unchanged: commit `backend/.migration-request` on a work branch and push; the **EF migration**
workflow adds the migration to that branch (never on `develop` or `main`). One migration per PR.

## 7. One-time setup (owner)

Run once on your own computer, with the GitHub CLI signed in as the owner:

```bash
bash .github/scripts/setup-repo.sh
```

It sets: default branch `develop`; squash and merge commits allowed, rebase off; auto-delete head
branches; **Allow GitHub Actions to create and approve pull requests** (release and sync PRs); the
ruleset **Protect main and develop** (PR required, the three CI checks required, no force-push, no
deletion; repository admins can bypass in an emergency); the `CLAUDE_CODE_OAUTH_TOKEN` secret if
you paste one (`claude setup-token`); and deletes branches that develop already contains.

Then, in the browser:

| Step | Where | Why |
| --- | --- | --- |
| Install the Claude GitHub App on `taka-leaf` (or run `/install-github-app` in Claude Code, which also saves the token) | https://github.com/apps/claude | Claude review, fixer, assistant; its pushes start CI again |
| Optional: fine-grained token (this repo; Contents, Pull requests, Workflows: read and write) as secret `AUTOMATION_TOKEN` | Settings → Secrets and variables → Actions | Merges and bot PRs then start workflows by themselves (otherwise Auto merge starts them) |
| Optional variables: `AUTO_MERGE`, `AUTO_RELEASE`, `AUTO_FIX` (`false` to stop), `MAX_FIX_ROUNDS`, `CLAUDE_REVIEW_MODEL`, `CLAUDE_FIX_MODEL` (default `opus`) | Settings → Secrets and variables → Actions → Variables | Tuning |
| Dokploy app branch stays `main` | Dokploy | Production follows main only |

Claude Code cloud sessions can push branches and open PRs but cannot change repository settings,
rulesets or secrets; that is why this step is the owner's.

## 8. Rules of thumb

- Never push to `main` or `develop`; never force-push a shared branch; never delete tags.
- One topic per branch; keep PRs small (< ~400 changed lines where possible). Big features land
  behind small PRs into develop; develop must stay releasable every night.
- PR title = the squash commit subject: short, plain English, says what changed
  ("Tags on transactions", "Budget bar rounds to whole taka").
- A red PR is the agents' first, then yours: after two fixer rounds it is labelled `needs-owner`.
- Claude review is a gate, not a rubber stamp: dispute a wrong finding on its thread; don't
  bypass it with the owner bypass except in an incident.
