# TakaLeaf — Technical Architecture

> Your Money. Your Control.

TakaLeaf is a personal income and expense tracker in Bangladeshi taka (BDT). It keeps money in
wallets (cash, bank accounts, credit cards, mobile banking such as bKash, Nagad, Upay and Rocket),
tracks money lent to and borrowed from people, and adds monthly budgets and recurring transactions.

This document explains how it is built and why, as the code stands today. Related documents:
[requirements](REQUIREMENTS.md), [UI/UX](UI-UX.md), [development plan](DEVELOPMENT-PLAN.md),
[testing plan](TESTING-PLAN.md), the product brief [PRODUCT.md](../PRODUCT.md) and the visual system
[DESIGN.md](../DESIGN.md). [README.md](../README.md) covers running it and
[deploy/DOKPLOY.md](../deploy/DOKPLOY.md) covers production.

## 1. Scope

| Version | What ships |
| --- | --- |
| **1 (now)** | .NET 10 backend + React web app, online only, deployed with Dokploy. |
| **2 (next)** | Android app in React Native + TypeScript. It works offline on SQLite and syncs with the backend automatically when the network returns, or on demand. |

Fixed decisions:

- One currency (BDT) and one language (English).
- Each account is private to its owner. There is no sharing between users.
- Sign-in is by email and password. There are no social logins, and Google Drive is not used.
- The brand is a natural-green palette, minimal with glassmorphism, with light and dark themes. Logo: "T Leaf". See [brand/](../brand/) and [DESIGN.md](../DESIGN.md).

## 2. Architecture

```
Browser ──HTTPS──▶ Traefik (Dokploy) ──▶ TakaLeaf.App container :8080 ──▶ PostgreSQL 18
                                          ├─ /api/*   minimal API endpoints
                                          ├─ /*       built React app (wwwroot) with SPA fallback
                                          └─ RecurringWorker (background)
Android app (v2) ──HTTPS──▶ same /api (refresh token in body instead of a cookie)
```

| Part | Technology |
| --- | --- |
| Backend | .NET 10, ASP.NET Core minimal APIs, EF Core 10 + Npgsql, Serilog, MailKit |
| Database | PostgreSQL 18, snake_case names |
| Web | React 19, TypeScript, Vite, Tailwind CSS 4, React Router, TanStack Query |
| Shared TS | `packages/shared`: money formatting and parsing, brand constants |
| Tests | xUnit + WebApplicationFactory against real PostgreSQL; Vitest + Testing Library |
| CI | GitHub Actions: web, backend, Docker image smoke test; EF migration generator |
| Hosting | Linux VPS, Dokploy (Traefik, Let's Encrypt, PostgreSQL service, S3 backups) |

### Repository layout

```
apps/web/                 React web app
packages/shared/          TypeScript shared with the Android app later
backend/TakaLeaf.App/     The one backend project
backend/TakaLeaf.App.Tests/
contract/fixtures/        Cases both C# and TS tests must agree on (money formatting)
brand/                    Logo files and design tokens
deploy/                   Dev docker-compose, Dokploy guide, production env template
Dockerfile                Production image (web + API)
```

### Backend: one project, vertical slices

The backend is deliberately simple: a single project, `TakaLeaf.App`, organised by feature, with no
repository or service layers.

```
Features/<Feature>/<Action>.cs    endpoint + request/response records + handler, in one file
Features/<Feature>/<Feature>Models.cs   DTOs and the feature's shared rules (static class)
Features/<Feature>/<Feature>Endpoints.cs  MapGroup("/<feature>").RequireAuthorization()
Common/                           cross-cutting helpers (money, calendar, validation, email, logging, web)
Data/                             AppDbContext, entities, configuration, migrations
```

Handlers take `AppDbContext` directly. Rules that several slices share live in an `internal static`
`<Feature>Rules` class next to them (for example `TransactionRules.CheckAsync`).

## 3. Core rules

These hold everywhere. Code that breaks one of them is a bug.

1. **Money is a whole number of poisha** (`long` in C#, a safe integer in TS); 1 taka = 100 poisha.
   It is never stored or added up as a decimal or double. Display is `৳1,25,000.00` with
   Bangladeshi digit grouping. The C# and TS formatters share fixtures in `contract/fixtures/`.
2. **Balances are calculated, never stored.** A wallet's balance is its opening balance, plus money
   that arrived, minus money that left (`Common/Balances.cs`). Totals: positive balances are assets
   and negative ones are liabilities, while wallets marked "excluded from total" are left out.
3. **Days and months are local time** (`App:TimeZone`, Asia/Dhaka). Filters, dashboard months,
   budgets and recurring dates all use `LocalCalendar`. Timestamps are stored in UTC.
4. **Rows are never hard-deleted.** Every user table derives from `SyncedEntity`: a Guid v7 `Id`
   that a client can create, `UserId`, `CreatedAt`, `UpdatedAt`, `DeletedAt` (soft delete, with a
   global query filter), and `ServerSeq`, taken from a PostgreSQL sequence on every save. This makes
   "what changed since N" answerable for the Android sync. `SaveChanges()` throws, so code must use
   `SaveChangesAsync`.
5. **Another user's data looks like it doesn't exist.** A row that belongs to someone else returns
   **404** (`NotFound.Problem`), never 403. Using another user's wallet or category in a request
   returns 400 "does not exist".
6. **Errors are RFC 7807 problem responses.** Field errors use `ValidationErrors.For(field, message)`.
   The web shows them next to that field. Messages are plain sentences meant for the person using the app.
7. **Enums travel as strings** (`"Expense"`, `"Monthly"`).

## 4. Data model

| Table | Key fields | Notes |
| --- | --- | --- |
| `users` | email (unique), password_hash, email_verified_at, failed_sign_in_count, locked_until | Not synced. |
| `sessions`, `refresh_tokens` | token hashes, used_at, revoked_at | One session per signed-in device. |
| `user_tokens` | purpose (VerifyEmail / ResetPassword), token_hash, expires_at, used_at | Single-use email links. |
| `wallets` | type (Cash, Bank, CreditCard, Mfs, Lent, Borrowed), name, opening_balance, credit_limit, person_id, archived, excluded_from_total | Lent/Borrowed belong to a person. |
| `people` | name (unique per user, ignoring case), note | Each has one Lent and one Borrowed wallet. |
| `categories` | kind (Income/Expense), name, parent_id, archived, sort_order | Two levels. Starter set created at registration. |
| `transactions` | type (Income/Expense/Transfer), amount > 0, from/to wallet, category, person_id, fee_of_id, recurring_rule_id, recurring_date, occurred_at, note | Unique (recurring_rule_id, recurring_date). |
| `budgets` | category_id (null = all spending), amount > 0 | One per category per user (nulls not distinct). |
| `recurring_rules` | transaction fields, frequency, interval, start/end date, occurrences, next_date, auto_record, paused | |

### How features map onto transactions

| Feature | Stored as |
| --- | --- |
| Income | `Income` into `to_wallet` |
| Expense | `Expense` out of `from_wallet` |
| Transfer | `Transfer` from → to |
| Transfer fee (e.g. bKash cash-out) | A separate `Expense` row with `fee_of_id` = the transfer, under "Fees and charges" by default. It is edited and deleted together with its transfer. |
| Lend / got paid back | `Transfer` wallet → person's Lent wallet / Lent → wallet, with `person_id` |
| Borrow / paid back | `Transfer` person's Borrowed wallet → wallet / wallet → Borrowed, with `person_id` |
| Recorded recurring date | Normal transaction with `recurring_rule_id` and `recurring_date` |

Fee rows and loan rows are refused by the general transaction endpoints. They are changed through
their owner (the transfer, or the person).

## 5. API

Everything is under `/api`. Every endpoint except health and the sign-in flows needs a bearer token.

| Area | Endpoints |
| --- | --- |
| Health | `GET /health`: API up, database up/down |
| Auth | `POST /auth/register`, `/verify-email`, `/resend-verification`, `/login`, `/refresh`, `/logout`, `/forgot-password`, `/reset-password`, `/change-password`; `GET /auth/me`; `GET /auth/sessions`, `DELETE /auth/sessions/{id}`, `POST /auth/sessions/sign-out-others` |
| Wallets | `GET/POST /wallets`, `GET/PUT/DELETE /wallets/{id}`, `POST /wallets/{id}/archive`, `/unarchive` |
| Categories | `GET/POST /categories`, `PUT/DELETE /categories/{id}`, `POST /{id}/archive`, `/unarchive`, `/merge` |
| Transactions | `GET /transactions` (from, to, walletId, categoryId, uncategorised, type, search, page, pageSize; totals over all matches), `GET /transactions/export.csv` (same filters; UTF-8 CSV, amounts in taka, formula-like text neutralised), `GET/PUT/DELETE /transactions/{id}`, `POST /transactions` |
| Dashboard | `GET /dashboard?month=yyyy-MM` |
| Reports | `GET /reports?period=Month&month=yyyy-MM` or `?period=Year&year=yyyy`: income, expense, saved, by category (with sub-categories), trend (6 or 12 months). Only income and expense count |
| People | `GET/POST /people`, `GET/PUT/DELETE /people/{id}`, `POST /people/{id}/loans`, `PUT/DELETE /people/{id}/loans/{loanId}` (Lend, GotBack, Borrow, PaidBack) |
| Budgets | `GET /budgets?month=`, `POST /budgets`, `PUT/DELETE /budgets/{id}` (status OnTrack / Near ≥ 80% / Over) |
| Recurring | `GET /recurring`, `GET /recurring/due`, `GET/PUT/DELETE /recurring/{id}`, `POST /recurring`, `POST /{id}/record`, `/skip`, `/pause`, `/resume` |

Unknown `/api/...` paths return a 404 problem. [backend/TakaLeaf.App/TakaLeaf.App.http](../backend/TakaLeaf.App/TakaLeaf.App.http)
has ready-made requests.

## 6. Security

- **Passwords:** ASP.NET Core `PasswordHasher` (PBKDF2), at least 10 characters. Five wrong passwords
  lock sign-in for 15 minutes. An unknown email costs the same time as a wrong password.
- **No account discovery:** register, resend and forgot-password give the same answer whether or
  not the email exists.
- **Tokens:** a JWT access token lives for 15 minutes and is kept only in memory on the web. Refresh
  tokens rotate on every use and are stored as SHA-256 hashes. Reusing an old one after 30 seconds
  ends the whole session. Every request also checks that the token's session is still active, so
  sign-out, a password change or signing out a device takes effect at once. The web gets the refresh token as an `HttpOnly; Secure; SameSite=Strict`
  cookie on `/api/auth`; Android (`client: "mobile"`) gets it in the response body.
- **Email links** are single-use and stored hashed. Verify links expire after 24 hours, reset links after 30 minutes. A password chosen at
  registration takes effect only if that particular link is opened, so nobody can take over an
  unverified account.
- **Registration** can be closed with `Auth:RegistrationOpen=false` (403 `registration_closed`).
- **Rate limit:** the auth endpoints are limited per IP (`RateLimits:AuthPerMinute`). The real IP is
  trusted only from `ReverseProxy:TrustedProxies` / `TrustedNetworks`.
- **Headers:** CSP (self plus Google Fonts), `X-Frame-Options: DENY`, `nosniff`, Referrer and
  Permissions policies, and HSTS outside development.

## 7. Web app

```
src/api/        client.ts (fetch + silent refresh), queries.ts (TanStack Query hooks), types.ts
src/auth/       AuthContext, sign-in / register / verify / forgot / reset pages
src/layout/     AppShell (sidebar on desktop; top bar, bottom tabs, add button on phones),
                TransactionSheet (one transaction form for the whole app)
src/pages/      dashboard, transactions, wallets, people, reports, budgets, recurring, categories, settings
src/ui/         Button, Field, Modal, Feedback, Icon, format.ts (dates in Asia/Dhaka, amounts)
src/test/       fakeApi (fetch stand-in), renderApp
```

- **Server data** lives only in TanStack Query. After a change, every money query (dashboard,
  wallets, transactions, people, budgets, recurring) is invalidated together.
- **Silent refresh:** a 401 triggers one shared refresh request and a single retry. If that fails,
  the app signs out.
- **Amounts** are typed as taka text ("1,250.50") and turned into poisha with `parseTaka`. Credit
  card debt is typed as a positive "amount owed".
- **Layout:** works from 390 px phones to desktop with no sideways scrolling. On phones the five tabs
  are Home, History, Wallets, People and More (Budgets, Recurring, Categories, Settings).
- **Accessibility:** every input has a label, errors are linked with `aria-describedby`, dialogs are
  `role="dialog"`, and focus is visible.

## 8. Background work

`RecurringWorker` runs every `Recurring:PollMinutes` (30 by default) and records automatic recurring
dates that are due, at 9 AM local time. A unique index means a date can never be recorded twice. If
a rule can't be recorded (for example its wallet was deleted), it stays in the user's due list.

## 9. Logging and operations

- **Logging:** Serilog writes to the console and to daily JSON files in `logs/`, kept for 14 days.
  Seq is added in development and is optional in production. Every request line has the user's
  email (or "anonymous"), client IP, user id, status and time taken.
- **Production:** a single Docker image (see `Dockerfile`). Migrations run on start. The health
  endpoint is `/api/health`. Backups are daily `pg_dump` to S3 through Dokploy.

## 10. Testing

| Layer | How |
| --- | --- |
| Backend | `dotnet test`. Every slice is exercised through HTTP with `WebApplicationFactory` against a real PostgreSQL. Each test creates its own users, so tests don't affect each other. Test names follow the testing plan's case ids (T-, F-, L-, B-, R-, P-, X-). |
| Web | `pnpm test` (Vitest + Testing Library). `fakeApi` stands in for the backend and records calls, so tests check what was sent (for example amounts in poisha). |
| Shared | Money formatting is checked against `contract/fixtures/money-format.json` on both sides. |
| Image | CI builds the Dockerfile, runs it next to PostgreSQL, and checks health, the web app, SPA fallback, API 404 and time zone data. |

## 11. Version 2: Android app and sync (planned)

Version 2 adds an Android app that works fully offline on SQLite and syncs with this backend. The
backend is already prepared for it: client-made Guid v7 ids, `UpdatedAt`, soft delete and `ServerSeq`
on every user table, and refresh tokens in the response body for `client: "mobile"`.

### Planned Android stack

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | React Native + TypeScript with Expo, Android only | Same language as the web app; shares `packages/shared` |
| Local database | SQLite through expo-sqlite, Drizzle for typed queries and migrations | Works fully offline |
| Connectivity | NetInfo | Starts sync as soon as the connection returns while the app is open |
| Background sync | expo-background-task | Runs when the app is closed; Android decides the exact time (15 min or more) |
| Navigation | Expo Router | File-based screens, bottom tabs |
| State | Zustand, with screens reading live from SQLite | The database is the source for the UI |
| Secure storage | expo-secure-store | Refresh token encrypted with Android Keystore |
| App lock | expo-local-authentication plus a PIN | Fingerprint or PIN |
| Reminders | expo-notifications | Daily reminder and due dates |
| Glass and charts | expo-blur; a React Native chart library | Blur on few surfaces, plain translucent fallback on slow phones |

Phone-only tables: `outbox` (mutation_id, table, row_id, payload, created_at, attempts) and
`sync_state` (cursor, last_synced_at).

### Sync design

The phone never waits for the network: every change is written to SQLite and to the outbox in one
local transaction.

1. **Push**: `POST /api/sync/push` sends the outbox oldest first, in batches. Each change carries a
   `mutation_id`, so a batch sent twice is applied once. The server validates each change, applies it
   in one database transaction with a new `ServerSeq`, and answers `accepted`, `rejected` (with a
   reason) or `superseded` for each.
2. The phone removes accepted and superseded changes and shows rejected ones for the user to fix.
3. **Pull**: `GET /api/sync/pull?cursor=…` returns every row changed after the cursor, deletions
   included, in pages. Each page is applied in one SQLite transaction, then the cursor is saved.

| Trigger | Behaviour |
| --- | --- |
| Internet returns | App open: sync at once. App closed: background task at Android's next opportunity |
| A change is saved while online | Sync a few seconds later, so quick edits go together |
| App opened or brought to the front | Sync if the last one is older than a few minutes |
| Sync button (dashboard, Settings) | Sync now and show the result |
| A sync fails | Retry with increasing delays; the outbox is kept until accepted |

- **Conflicts** arise only when the same row changed offline on the phone and on the web before the
  phone synced. The later `UpdatedAt` wins (the server uses its own receive time when the phone's clock
  is clearly off) and the other edit is reported as superseded. Balances are calculated, so a merge
  cannot leave a total inconsistent.
- **Deletes** travel as rows with `DeletedAt`; they are kept at least 90 days so a long-offline phone
  still receives them.
- **Recurring**: a date is recorded once per (rule, date); the unique index already enforces this on
  the server, so phone and server cannot both create it.
- **New phone**: sign in, then one full pull from an empty cursor.
- **Old app, new server**: the API is versioned; an outdated app is told to update and keeps its outbox.

## 12. Decision log

| Decision | Why |
| --- | --- |
| One backend project with vertical slices | Personal app, one developer: features are easy to find and change; no ceremony. |
| Money in poisha (`long`) | No rounding errors; the same type works in C#, TS and SQLite. |
| Balances calculated, not stored | They cannot drift out of date. Personal data volumes are small. |
| Loans as transfers through per-person wallets | Wallet balances, history and net balance stay correct with no special cases. |
| Transfer fees as separate expense rows | Fees appear in spending and budgets, while the transfer amount stays the amount moved. |
| Soft delete + ServerSeq from day one | Version 2 sync needs no schema rebuild. |
| Web and API in one container on one origin | No CORS; a strict same-site cookie; one thing to deploy. |
| Migrations generated in CI (`ef-migration.yml`) | Migrations always come from the real model, even without a local .NET SDK. |
| Hand-written TS types instead of a generated OpenAPI client | Small API, one developer; types sit next to the hooks. Revisit when Android starts. |
| Plain React state + `parseTaka` instead of React Hook Form/Zod | Forms are small; server field errors are the final word. |
| CSS bars instead of a chart library | Category spending needs only bars; Recharts can come with Reports. |
| Dokploy (Traefik) instead of hand-run Docker Compose + Caddy | HTTPS, deploys and database backups from one dashboard on the VPS. |
| Recurring worker every 30 minutes instead of a daily job | Due dates appear soon after midnight local time; recording stays idempotent. |

### Changes from the first architecture draft

The first draft (Flutter + Google Drive) was replaced by revision 2 (React Native + .NET + PostgreSQL)
before any code. Since then the build differs from revision 2 only in the rows above marked as
"instead of", and in delivery: version 1 is backend + web, version 2 adds Android and sync.
