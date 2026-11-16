# TakaLeaf — Requirements

> Your Money. Your Control.

A personal app for recording daily income and expenses in Bangladeshi taka, across every place
money is kept, including money lent to and borrowed from people.

**Priority**: Must (version is not done without it), Should (planned, can slip), Could (only if time
allows). **Status** reflects the code on `main`: ✅ done · 🟡 partly · ⬜ not started · 📱 version 2.

## 1. Background and goals

The owner wants one place for every taka: cash in hand, bank accounts, credit cards, mobile banking
(bKash, Nagad, Upay, Rocket), and money lent to or borrowed from people. The app has to be quick
enough to use every day, accurate to the poisha, and pleasant to look at: natural green,
minimal, with a touch of glassmorphism.

Goals:

1. Know the net balance and where it sits at any moment.
2. See where the money goes each month, by category.
3. Never lose track of who owes what.
4. Record a transaction in seconds, on the phone or at a computer.

## 2. Users and scope

- Built for the owner's own use. Anyone can register, but every account is completely separate from every other.
- Single currency: **BDT** only. Single language: **English**.
- **Version 1**: web app (desktop and phone browsers) + backend. Needs internet.
- **Version 2**: Android app (React Native) that works offline and syncs with the backend.
- Google Drive was dropped. The backend database is the shared copy.

## 3. Functional requirements

### 3.1 Account

| ID | Requirement | Priority | Status |
| --- | --- | --- | --- |
| FR-A1 | Register with email and password; the email must be verified before first sign-in | Must | ✅ |
| FR-A2 | Sign in and sign out; stay signed in across browser restarts | Must | ✅ |
| FR-A3 | Forgot password → emailed single-use link → set a new password | Must | ✅ |
| FR-A4 | Change password while signed in (other devices are signed out) | Must | ✅ |
| FR-A5 | Lock sign-in after repeated wrong passwords; rate-limit auth requests | Must | ✅ |
| FR-A6 | See and sign out signed-in devices | Should | ⬜ |
| FR-A7 | Switch off new registrations by a server setting once the owner's account exists | Should | ⬜ |

### 3.2 Wallets

| ID | Requirement | Priority | Status |
| --- | --- | --- | --- |
| FR-W1 | Wallet types: Cash, Bank account, Credit card, Mobile banking (MFS) | Must | ✅ |
| FR-W2 | Opening balance; balance always calculated from transactions | Must | ✅ |
| FR-W3 | Credit card: amount owed, credit limit, credit left | Must | ✅ |
| FR-W4 | Archive a wallet (kept in history); delete only if unused | Must | ✅ |
| FR-W5 | Leave a wallet out of the net balance | Should | ✅ |
| FR-W6 | Name shortcuts for bKash, Nagad, Upay, Rocket | Could | ✅ |
| FR-W7 | Reorder wallets | Could | 🟡 (API field only) |
| FR-W8 | Credit card billing day and due-date reminder | Could | ⬜ |

### 3.3 Transactions

| ID | Requirement | Priority | Status |
| --- | --- | --- | --- |
| FR-T1 | Record income, expense, and transfer between wallets | Must | ✅ |
| FR-T2 | Transfer fee (e.g. bKash cash-out charge) counted as an expense | Must | ✅ |
| FR-T3 | Category, date and time, note on each transaction | Must | ✅ |
| FR-T4 | Edit and delete; balances follow | Must | ✅ |
| FR-T5 | History newest first, grouped by day, with paging | Must | ✅ |
| FR-T6 | Filter by date range, wallet, category, type; search notes; totals of what matches | Must | ✅ |
| FR-T7 | Add a transaction from any screen | Must | ✅ |
| FR-T8 | Tags | Could | ⬜ |
| FR-T9 | Receipt photo | Could | ⬜ (after v2) |

### 3.4 Categories

| ID | Requirement | Priority | Status |
| --- | --- | --- | --- |
| FR-C1 | Income and expense categories, two levels (e.g. Housing → House rent) | Must | ✅ |
| FR-C2 | Starter set covering the owner's expense types: house rent, bus fare, groceries, self-development, learning tools (cloud server, AI subscriptions), parents, younger sister, wife's pocket money, fees and charges… | Must | ✅ |
| FR-C3 | Add, rename, archive | Must | ✅ |
| FR-C4 | Merge one category into another (transactions, recurring rules and budget move) | Should | ✅ |
| FR-C5 | Delete an unused category | Should | ✅ |

### 3.5 People, lending and borrowing

| ID | Requirement | Priority | Status |
| --- | --- | --- | --- |
| FR-L1 | Add people; record money lent to them and borrowed from them, per person | Must | ✅ |
| FR-L2 | Record repayments both ways; cannot repay more than is owed | Must | ✅ |
| FR-L3 | Per-person balance ("owes you" / "you owe" / settled) and history | Must | ✅ |
| FR-L4 | Totals on the dashboard: people owe you, you owe people | Must | ✅ |
| FR-L5 | Lending/borrowing moves money in the user's real wallets | Must | ✅ |
| FR-L6 | Loan due dates and reminders | Could | ⬜ |

### 3.6 Budgets and recurring

| ID | Requirement | Priority | Status |
| --- | --- | --- | --- |
| FR-B1 | Monthly budget overall or per expense category; a parent covers its sub-categories | Must | ✅ |
| FR-B2 | Progress, amount left or over; warning near (80%) and over the limit, in words not colour only | Must | ✅ |
| FR-R1 | Recurring income/expense/transfer: daily, weekly, monthly, yearly, every N, optional end date | Must | ✅ |
| FR-R2 | Record automatically, or remind and let the user record (with a changed amount) or skip | Must | ✅ |
| FR-R3 | Pause, resume, delete; a date is never recorded twice | Must | ✅ |

### 3.7 Dashboard and reports

| ID | Requirement | Priority | Status |
| --- | --- | --- | --- |
| FR-D1 | Net balance, assets, amounts owed | Must | ✅ |
| FR-D2 | This month's income and expense, spending by category, recent transactions | Must | ✅ |
| FR-D3 | Due recurring items and budgets at a glance | Should | ✅ |
| FR-P1 | Monthly report: category totals, income against expense, drill-down to transactions | Must | ✅ |
| FR-P2 | Yearly report and six-month trend | Should | ✅ |
| FR-P3 | CSV export of filtered transactions | Should | ⬜ |
| FR-P4 | PDF export | Could | ⬜ (after v2) |

### 3.8 Appearance and settings

| ID | Requirement | Priority | Status |
| --- | --- | --- | --- |
| FR-U1 | Light and dark themes; follows the system until chosen | Must | ✅ |
| FR-U2 | Responsive from 360 px phones to wide desktop | Must | ✅ |
| FR-U3 | Brand: natural green, minimal, glass surfaces, "T Leaf" logo | Must | ✅ |
| FR-U4 | Add to home screen (web manifest and icons) | Should | ✅ |

### 3.9 Android (version 2)

| ID | Requirement | Priority | Status |
| --- | --- | --- | --- |
| FR-M1 | Android app with the same features as the web | Must | 📱 |
| FR-M2 | Works fully offline on SQLite; never waits for the network to save | Must | 📱 |
| FR-M3 | Syncs automatically when the internet returns, and on a Sync button; nothing lost or doubled | Must | 📱 |
| FR-M4 | Add an expense in four taps plus the amount | Must | 📱 |
| FR-M5 | App lock with PIN and fingerprint | Should | 📱 |
| FR-M6 | Daily reminder notification | Should | 📱 |

## 4. Non-functional requirements

| ID | Requirement | Measure |
| --- | --- | --- |
| NFR-1 Accuracy | Money is exact | Whole poisha everywhere; shared fixtures pass in C# and TypeScript |
| NFR-2 Privacy | Accounts never see each other's data | Every endpoint tested with another account's ids (X-1) |
| NFR-3 Security | Industry-standard auth | Hashed passwords, rotating refresh tokens, HTTPS only, security headers, no secrets in Git |
| NFR-4 Durability | No data loss | Soft delete; daily off-server backups; one restore tested before real use |
| NFR-5 Performance | Feels instant | API list/dashboard under 300 ms for 95% of requests with 50,000 transactions; web usable within 3 s on first load |
| NFR-6 Accessibility | Usable by everyone | Labels on every control, contrast ≥ 4.5:1, 200% zoom, screen reader names, 44 px touch targets |
| NFR-7 Time | Local days | Days and months counted in Asia/Dhaka |
| NFR-8 Operability | Easy to run alone | One Docker image on a VPS with Dokploy; health endpoint; structured logs |
| NFR-9 Cost | Free tools where possible | Open-source stack; a small VPS is the only running cost |

## 5. Out of scope

Multiple currencies, multiple languages, shared/family accounts, bank or MFS API connections,
investments and stocks, iOS, and Google Drive backup.

## 6. Decisions log

| Date | Decision |
| --- | --- |
| 2026-11-15 | Name **TakaLeaf**; tagline "Your Money. Your Control." |
| 2026-11-15 | Android only for mobile; budgets and recurring in version 1; own use; MFS: bKash, Nagad, Upay, Rocket; dark theme from the start |
| 2026-11-15 | Brand: concept C "T Leaf", premium geometric, leaf-only symbol |
| 2026-11-15 | Architecture revised: React web, .NET 10 backend, PostgreSQL; Android offline on SQLite with sync; Google Drive removed |
| 2026-11-15 | Backend is one project, `TakaLeaf.App`, with vertical slices; mobile in React Native + TypeScript; sign-in by email and password |
| 2026-11-16 | Version 1 = backend + web; Android is version 2 |
| 2026-11-16 | Structured logging with Serilog (console, file, Seq), with user IP and email in request logs |
| 2026-11-16 | Production on a personal Linux VPS with Dokploy |
