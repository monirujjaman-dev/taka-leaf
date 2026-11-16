# TakaLeaf — Development Plan

Version 1 is the backend and the web app. Version 2 adds the Android app with offline use and
sync. This plan tracks milestones against the [requirements](REQUIREMENTS.md) and the
[testing plan](TESTING-PLAN.md) case ids. It was written on 2026-11-15; the status columns are kept
current.

**Status**: ✅ done · 🟡 in progress / partly · ⬜ not started

## 1. Roadmap

| Milestone | Scope | Estimate | Status | Pull requests |
| --- | --- | --- | --- | --- |
| M0 Foundations | Repo, backend skeleton, web skeleton, shared money formatter, CI, mail catcher | 4 days | ✅ | (direct to `main`) |
| M1 Backend core | Auth, wallets, categories, transactions, dashboard | 8 days | ✅ | #1–#5 |
| M2 Web core | Auth screens, app shell, dashboard, transactions, wallets, categories, settings | 8 days | ✅ | #6 |
| M3 Full features | People and loans, budgets, recurring, reports, category merge and delete | 8 days | ✅ | #7, #8, #12 |
| M4 Hardening | Deploy setup, security headers, CSV export, devices, closing registration ✅; performance, accessibility, end-to-end tests, dependency scan ⬜ | 5 days | 🟡 | #9, #13 |
| M5 Release v1 | Running on the VPS with Dokploy, backups proven, a week of real use | 4 days | ⬜ | |
| A1–A4 | Android setup, offline, sync, finish and ship (version 2) | 32 days | ⬜ | |

The estimates are rough and assume one full-time developer: about 37 working days for version 1
and 32 for version 2.

## 2. Version 1 milestones

### M0 — Foundations ✅

- [x] Monorepo: `backend/`, `apps/web/`, `packages/shared/`, `contract/`, `brand/`, `deploy/`
- [x] `TakaLeaf.App` with a health endpoint; PostgreSQL in Docker; first migration; test project
- [x] Web: Vite, React, TypeScript, Tailwind with the TakaLeaf tokens, light and dark
- [x] Shared money formatter with Bangladeshi grouping (fixture F-7)
- [x] CI for backend and web; Mailpit for development email
- [x] EF migration workflow (migrations generated in CI)

### M1 — Backend core ✅

- [x] Auth: register, verify email, resend, login, refresh, logout, me, forgot/reset/change password (A-1 to A-10)
- [x] Sync-ready entities: Guid v7, timestamps, soft delete, ServerSeq
- [x] Starter categories for every account
- [x] Wallets with calculated balances, credit limit, archive, delete if unused (W-1 to W-5)
- [x] Categories: create, rename, merge, archive, delete
- [x] Transactions: income, expense, transfer with fee; edit; delete; filters, search, totals (T-1 to T-7, F-2)
- [x] Dashboard summary (P-1, P-3, F-9)
- [x] Rate limits and lockout; Serilog request logs with user and IP (X-1, X-2, X-5, X-6)
- ~~OpenAPI client generation~~ replaced by hand-written TS types (see the decision log in ARCHITECTURE.md)

### M2 — Web core ✅

- [x] Sign in, register, verify, forgot and reset password screens
- [x] App shell: sidebar on desktop; top bar, bottom tabs and add button on phones; theme switch
- [x] Dashboard, transaction sheet, history with filters, wallets, categories, settings
- [x] Empty, loading and error states
- [x] Component tests with a fake API (sign-in flows, transaction form, API client refresh)
- [ ] End-to-end tests in a real browser (Playwright) → moved to M4

### M3 — Full features ✅

- [x] People and loans: lend, got back, borrow, paid back, per-person history, dashboard totals (L-1 to L-6)
- [x] Budgets: overall and per category, progress, near/over warnings (B-1 to B-4)
- [x] Recurring: rules, due list with record/skip, automatic recording worker (R-1 to R-7, F-8)
- [x] Credit card limit and credit left
- [x] Reports: month and year; income against expense and savings; by category with sub-categories; drill-down to transactions; six- or twelve-month trend (P-2 to P-4)
- [x] Categories screen: merge and delete; merge moves recurring rules and the budget too (C-1)
- [ ] Credit card billing and due dates (could)

### M4 — Hardening 🟡

- [x] Docker image (web + API) with a smoke test in CI
- [x] Security headers, HSTS, trusted proxy networks
- [x] Dark theme on every screen; phone-width pass (390 px)
- [x] CSV export (P-5)
- [x] Settings: signed-in devices, sign out one or all others (immediate); `Auth__RegistrationOpen` to close registration
- [ ] Seed account with 50,000 transactions; meet performance targets; add indexes where needed
- [ ] Accessibility pass: 200% zoom, screen reader names, contrast, touch targets ≥ 44 px
- [ ] Playwright end-to-end tests for register, sign in, add expense, transfer
- [ ] Remaining security tests X-7 to X-9, X-11; dependency scan clean; update GitHub Actions versions

### M5 — Release version 1 ⬜

- [ ] VPS with Dokploy: PostgreSQL service, app from GitHub, domain with HTTPS ([deploy/DOKPLOY.md](../deploy/DOKPLOY.md))
- [ ] Production secrets and SMTP provider set
- [ ] Daily backup to S3-compatible storage; one full restore performed (X-12)
- [ ] Uptime check on `/api/health`
- [ ] Register the owner's account; decide whether to close registration
- [ ] Manual release checklist (testing plan §8, web items)
- [ ] Seven days of real daily use with no balance mismatch

## 3. Version 2 milestones (Android)

Starts after version 1 has been in real use for a while, so that real use can shape the app. The
task lists will be detailed when the work begins.

| Milestone | Tasks | Estimate | Done when |
| --- | --- | --- | --- |
| A1 Android setup | Expo app in `apps/mobile/` using `packages/shared` and the tokens; prove SQLite persistence and migrations offline; prove a background task can call the API; choose the oldest Android version | 3 days | Both experiments work on the owner's phone |
| A2 Offline | SQLite schema + `outbox` + `sync_state`; auth screens; first full download; dashboard, number-pad entry, history, wallets, categories reading live from SQLite | 10 days | In airplane mode: add, edit and delete with correct balances; expense in four taps plus the amount |
| A3 Sync | `POST /api/sync/push` (idempotent by mutation id), `GET /api/sync/pull` (cursor, paging), later-edit-wins; triggers; sync status UI | 8 days | S-1 to S-12 automated, S-13 and S-17 by hand, X-3 |
| A4 Finish and ship | People, budgets, recurring, reports, settings on Android; app lock; reminder; performance and accessibility; signed APK | 11 days | Remaining acceptance criteria, S-14 to S-16, X-10 |

## 4. How the work is done

Each feature goes through the same steps:

1. Add or extend a fixture in `contract/fixtures/` if money rules change.
2. Write the backend slice and its tests against a real PostgreSQL (`/new-slice`).
3. Generate a migration through CI if entities change (`/migration`).
4. Add web types and hooks, then build the screen and its tests.
5. From version 2: the SQLite table, the outbox entry and the sync mapping.
6. Run the checks (`/check`), open a PR, wait for green CI, squash-merge (`/ship`).

| Topic | Rule |
| --- | --- |
| Branches | `main` is always releasable; one short-lived branch per feature (`m<N>/<topic>`, `fix/<topic>`, `docs/<topic>`) |
| CI | Web and shared package, Backend, Docker image: all green to merge |
| Database | One CI-generated EF migration per change; never hand-edited |
| Definition of done | Merged; its test-plan cases pass; works at 390 px and desktop, light and dark; empty and error states handled; docs updated |
| Review point | Use each milestone for a day before starting the next |

## 5. Before release: what the owner provides

| Needed | For | By |
| --- | --- | --- |
| Linux VPS (≥ 2 GB RAM) with Dokploy | Production | M5 |
| Domain or sub-domain with an A record | HTTPS address | M5 |
| SMTP provider account | Verification and reset emails | M5 |
| S3-compatible bucket (R2, B2, S3…) | Off-server backups | M5 |
| Android Studio, phone in developer mode, signing key | Android build and release | A1 / A4 |

## 6. Risks and what to cut first

| Risk | Effect | Response |
| --- | --- | --- |
| Email delivery problems | Registration blocked | Test the SMTP provider before real use; check the logs for SMTP errors |
| Reports take longer than planned | M3 grows | Ship the monthly report first; yearly and trend follow |
| Web awkward on a phone browser | Daily entry feels slow until version 2 | Phone-width pass done; "Add to home screen" |
| Server setup and backups | M5 grows | Follow `deploy/DOKPLOY.md`; restore drill before real data |
| Background sync unreliable on Android | A3 grows | Sync on app open, on save and on the Sync button |
| Sync edge cases | A3 grows | Scenarios fixed in the testing plan; no new features until S-1 to S-12 pass |

If version 1 runs out of time, cut in this order: credit card billing reminders, loan due dates,
yearly report (keep monthly), tags, wallet reordering, desktop-specific layouts for less-used
screens. **Never cut**: money fixtures, the cross-account data tests, backup and restore, and the
sync-ready columns.

## 7. After version 2 (ideas, not planned)

Receipt photo on a transaction · PDF export of reports · offline support in the web app · import
from bank or MFS statements.
