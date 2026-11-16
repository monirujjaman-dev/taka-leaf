# TakaLeaf — Testing Plan

Most testing effort goes where a mistake costs money or data: balance arithmetic, loans, and sync.
Screens are tested lightly; rules and sync heavily. Backend test names and comments carry the case
ids below (for example `// T-3, F-2`).

Version 1 covers the backend and the web app. Section 4 and cases T-8, X-3 and X-10 apply from
version 2 (Android).

## 1. Levels and tools

| Level | Proves | Backend (.NET 10) | Web (React) | Android (v2) |
| --- | --- | --- | --- | --- |
| Unit | One rule gives the right answer | xUnit | Vitest | Jest |
| Integration | A feature works against a real database | xUnit + `WebApplicationFactory` + real PostgreSQL: every endpoint | Testing Library with `fakeApi` | Jest with a real SQLite file |
| Contract | Both sides agree | Shared fixtures in `contract/fixtures/` | Same fixtures | Same fixtures |
| End to end | A person can finish a task | Through the clients | Playwright (planned, M4) | Maestro |
| Image | The production image runs | CI starts the Docker image with PostgreSQL and checks it | — | — |
| Manual | What automation judges badly | — | Look and feel, glass, dark theme | Offline on a real phone, background sync, app lock |

Rules for every test:

- Amounts are checked in poisha as whole numbers, never as decimals.
- Each backend test creates its own users, so tests cannot affect each other.
- A bug found by hand gets a failing automated test before it is fixed.
- Web tests assert the request body that was sent (for example amounts in poisha).

## 2. Shared fixtures

| ID | Case | Input | Expected |
| --- | --- | --- | --- |
| F-1 | Wallet balance | Opening ৳5,000; income ৳85,000; expense ৳1,250; transfer out ৳10,000 | ৳78,750.00 |
| F-2 | Transfer with fee | bKash ৳12,400; transfer ৳5,000 to Cash; fee ৳92.50 | bKash ৳7,307.50; Cash +৳5,000; fee under Fees and charges |
| F-3 | Credit card | Limit ৳1,00,000; expense ৳2,400 | Balance −৳2,400; ৳97,600 left; paying ৳2,400 returns it to ৳0 |
| F-4 | Lending | Lend ৳10,000 from bank; ৳4,000 repaid into bKash | Person owes ৳6,000; net balance unchanged by either step |
| F-5 | Borrowing | Borrow ৳10,000 into Cash | Cash +৳10,000; "You owe" ৳10,000; net balance unchanged |
| F-6 | Budget overrun | Limit ৳5,000; spent ৳5,200 | 104%; over by ৳200 |
| F-7 | Formatting | 125000, 12500000, 1000000000 poisha | ৳1,250.00; ৳1,25,000.00; ৳1,00,00,000.00 (`contract/fixtures/money-format.json`) |
| F-8 | Recurring on day 31 | Monthly on the 31st, February | Due on the last day of February |
| F-9 | Month boundary | 11:30 PM on 30 November, Dhaka | Counted in November |
| F-10 | Net balance | Any mix of the above | Sum of wallet balances, lent and borrowed included |

## 3. Feature cases

Automated at the backend integration level unless marked; ★ cases also run end to end on the clients.

### 3.1 Account

| ID | Case | Expected |
| --- | --- | --- |
| A-1★ | Register with a valid email and password | Verification email sent; sign-in refused until the link is opened |
| A-2 | Register an existing email | Same response; no second account; nothing reveals the account exists |
| A-3 | Password under 10 characters or a common one | Refused with a clear message |
| A-4★ | Sign in with the right password | Access and refresh tokens issued |
| A-5 | Five wrong passwords | Locked 15 minutes, even with the right password |
| A-6 | Refresh token used twice | Second use refused and the session ended |
| A-7★ | Forgot password, known and unknown email | Identical response; email only for the known one |
| A-8 | Reset link reused or after 30 minutes | Refused |
| A-9★ | Reset password | New password works, old one does not, every device signed out |
| A-10 | Change password with a wrong current one | Refused |

### 3.2 Wallets

| ID | Case | Expected |
| --- | --- | --- |
| W-1★ | Wallet of each type with an opening balance | Shown in its group with that balance; totals update |
| W-2 | Archive a wallet with transactions | Hidden from pickers; history keeps it |
| W-3 | Delete a wallet with transactions | Refused; archive offered |
| W-4 | Credit card with a limit | Amount owed and limit left (F-3) |
| W-5 | Leave a wallet out of the total | Net balance excludes it; its balance unchanged |

### 3.3 Transactions

| ID | Case | Expected |
| --- | --- | --- |
| T-1★ | Add an expense | Wallet falls by the amount; first in history |
| T-2★ | Add an income | Wallet rises by the amount |
| T-3★ | Transfer with a fee | F-2; deleting the transfer deletes its fee |
| T-4 | Edit amount, wallet or date | Old and new wallet balances correct |
| T-5 | Delete | Balance returns |
| T-6 | Zero, negative, or more than two decimals | Refused |
| T-7 | Filter by date, wallet, category, type; search notes | Only matching rows; totals match them |
| T-8 | Add an expense on Android | Manual: four taps plus the amount at most |

### 3.4 People and loans

| ID | Case | Expected |
| --- | --- | --- |
| L-1★ | Lend, then a partial repayment | F-4; the person's history lists both |
| L-2 | Final repayment | Person shows settled; "people owe you" falls to match |
| L-3★ | Borrow, then repay | F-5; "you owe" returns to ৳0 |
| L-4 | Repay more than is owed | Refused |
| L-5 | Delete a person with loans | Refused |
| L-6 | Dashboard totals | Equal the sum of people's balances |

### 3.5 Categories, budgets, recurring

| ID | Case | Expected |
| --- | --- | --- |
| C-1 | Merge two categories | All transactions move; totals unchanged |
| C-2 | Archive a category in use | Old transactions keep it; not offered for new ones |
| B-1★ | Spend past a budget | F-6; warning in words, not colour alone |
| B-2 | Expense in a sub-category | Counts toward the parent's budget |
| R-1 | Monthly rule reaches its date | One transaction, once |
| R-2 | Rule due while nothing ran for three months | Three transactions, one per month |
| R-3 | Paused rule | Nothing created |

### 3.6 Dashboard and reports

| ID | Case | Expected |
| --- | --- | --- |
| P-1★ | Dashboard after a known set of transactions | Net balance, income, expense, loan totals match F-10 |
| P-2 | Monthly report | Category totals add up to total expense; transfers and loans are not income or expense |
| P-3 | Month with no transactions | Empty state, no error, no division by zero |
| P-4 | Drill down from a category total | Rows listed add up to that total |
| P-5 | CSV export | Row count and sum match the filtered list |

## 4. Offline and sync (version 2)

Every scenario ends with the same check: each wallet balance on the phone equals the server's.
S-1 to S-12 and S-15 are automated against a real backend with the network switched by the test;
S-13, S-14, S-16 and S-17 are manual on a real phone.

| ID | Scenario | Expected |
| --- | --- | --- |
| S-1 | Three transactions offline, then online | All reach the server; outbox empty; web shows them |
| S-2 | Push accepted but the answer lost; phone resends | Each change applied once |
| S-3 | Phone edits offline; web edits the same row later | Web's later edit stays; phone's shown as superseded |
| S-4 | Web edits; phone edits the same row later offline | Phone's later edit wins |
| S-5 | Web deletes; phone edited earlier offline | Stays deleted on both |
| S-6 | Delete on the phone | Gone on the web; balances updated on both |
| S-7 | Sign in on a fresh install | Full pull; everything matches |
| S-8 | Connection lost mid-pull | No half page; resumes from the saved cursor |
| S-9 | One invalid change in a batch | That change flagged; the rest applied |
| S-10 | 500 changes offline | Sent in batches, in order; all applied |
| S-11 | Phone clock two days ahead | Server receive time used; no unfair win |
| S-12 | App killed mid-sync | Resumes; no duplicates, nothing lost |
| S-13 | Changes offline, app closed, internet returns | Background sync delivers them; time recorded |
| S-14 | Offline so long the session expired | Asks for sign-in; outbox kept and sent after |
| S-15 | Recurring date due offline and on the server | One transaction after sync |
| S-16 | Old app meets a newer server | Told to update; outbox kept |
| S-17 | Sync button online and offline | Online: result and time. Offline: clear message, nothing lost |

## 5. Security

| ID | Test | Expected |
| --- | --- | --- |
| X-1 | Every endpoint called by user A with user B's ids | "Not found"; nothing of B's read, changed or revealed |
| X-2 | No token, expired token, tampered token | Refused |
| X-3 | Sync push with rows marked with another user's id | Refused; the signed-in user is always used |
| X-4 | Notes and names containing SQL or HTML | Stored and shown as plain text |
| X-5 | Rapid register, sign-in, forgot-password | Rate limit applies |
| X-6 | Database and logs after auth flows | No plain passwords or tokens; no amounts or notes in logs |
| X-7 | Plain HTTP; Android build | Redirected to HTTPS; the app refuses cleartext |
| X-8 | Web refresh cookie | HttpOnly, Secure, SameSite=Strict |
| X-9 | Request from another origin | Blocked |
| X-10 | Android app lock | Required after background; five wrong PINs force full sign-in |
| X-11 | Dependency scan | No known high-severity issue at release |
| X-12 | Restore last night's backup onto an empty server | Sign-in works; balances match |

## 6. Performance, accessibility, devices

| Area | Check | Target |
| --- | --- | --- |
| Backend | List, dashboard, report endpoints with 50,000 transactions | < 300 ms for 95% of requests on the VPS |
| Web | First load, then moving between screens | Usable within 3 s; screen changes feel instant |
| Android start / lists / save | Mid-range phone | < 2 s cold start; no stutter; save never waits for the network |
| First sync | Full pull of 50,000 transactions | Completes with progress shown; time recorded |
| Text size | Largest Android font; browser zoom 200% | Nothing cut off or overlapping |
| Screen reader | Sign in, add a transaction, read the dashboard | Every control announced meaningfully |
| Contrast | Text on glass, both themes | ≥ 4.5:1 |
| Touch targets | Every tappable control | ≥ 44 px |
| Browsers / widths | Chrome, Edge, Firefox, Safari | 360, 768, 1280, 1920 px; light and dark |

## 7. Environments and what runs when

| Environment | Made of | Used for |
| --- | --- | --- |
| Local | `deploy/docker-compose.dev.yml` (PostgreSQL, Mailpit, Seq), dev servers | Development and all automated tests |
| CI | GitHub Actions: Web and shared package, Backend (PostgreSQL service), Docker image | Every push to a PR and to `main` |
| Production | Dokploy on the VPS | Smoke check after deploy only; never test data |

| When | Runs | Gate |
| --- | --- | --- |
| Every PR push | Backend tests, web and shared tests, typecheck, build, image smoke test | Required to merge |
| Before each release | End-to-end tests, manual list (§8), dependency scan | Required to release |
| Monthly | Backup restore (X-12) | Recorded |

## 8. Release checklist and acceptance

Manual before each release: register → verify → sign in → sign out → reset password; add an
expense, an income, a transfer with a fee; lend, partial repayment, final repayment → settled; go
over a budget and see the warning; record and skip a recurring item; walk every screen in light and
dark at 390 px and 1440 px.

| Version 1 is accepted when | Measure |
| --- | --- |
| Every "Must" requirement works | Its cases in §3 and §5 pass |
| Money is exact | All fixtures pass in C# and TypeScript |
| Accounts are separate | X-1 and X-2 pass on every endpoint |
| Performance | §6 web and backend targets met with 50,000 transactions |
| Recovery | A backup restored successfully at least once |
| Real use | Seven days of daily use, no balance mismatch, no lost entry |

Bug priority: a wrong balance, lost data or data visible to another account blocks the release.
Anything with a workaround is fixed in the next release.
