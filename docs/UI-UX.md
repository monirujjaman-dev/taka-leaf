# TakaLeaf — UI/UX Design

How TakaLeaf looks, how it is organised, and how each screen behaves. Colours, type and component
tokens are in [DESIGN.md](../DESIGN.md); who it is for and the design principles are in
[PRODUCT.md](../PRODUCT.md). The original mock-ups (mobile and web, light and dark) are on the
TakaLeaf UI design canvas in claude.ai; the web app now follows them in code.

## 1. Direction

- **Natural green, calm and trustworthy.** Forest green for primary actions and the balance card,
  leaf and sage for progress and accents, light mint background.
- **Minimal with glassmorphism.** Cards, navigation and sheets are frosted glass over two soft green
  glows. Glass is the surface, never decoration on top of content. Dialogs use a solid surface for
  legibility.
- **Numbers first.** Amounts are the largest text on a card, in tabular figures, with Bangladeshi
  grouping (`৳1,25,000.00`). Income is green, expense is rust, transfers are neutral.
- **One hand on a phone.** Main actions sit within thumb reach: a bottom tab bar with the Add button in its centre, and a number pad in the add sheet.

## 2. Information architecture

| Area | Path | Purpose |
| --- | --- | --- |
| Dashboard | `/` | Net balance, the month at a glance, items due, budgets, recent activity |
| Transactions | `/transactions` | History with filters, search, totals |
| Wallets | `/wallets` | Where the money is: balances by wallet type |
| People | `/people`, `/people/:id` | Lending and borrowing, per person |
| Reports | `/reports` | Month or year: income against expense, savings, trend, by category with drill-down |
| Budgets | `/budgets` | Monthly limits and progress |
| Recurring | `/recurring` | Rent, salary, subscriptions; items waiting to be recorded |
| Categories | `/categories` | Income and expense categories, two levels |
| Settings | `/settings` | The **More** tab on phones: links to Wallets, People and loans, Budgets, Recurring, Categories; then theme, password, export, devices, sign out |
| Sign-in flow | `/sign-in`, `/register`, `/verify-email`, `/forgot-password`, `/reset-password` | Account access; email links land on the last two |

### Navigation

| Width | Pattern |
| --- | --- |
| ≥ 1024 px | 240 px glass sidebar: logo, nine sections (active one solid forest), theme switch, sign out, "Connected to your server". Dashboard and Transactions headers carry **Add transaction** |
| < 1024 px | No top bar; each screen has its own header (back button on screens under More) · floating tab bar: **Home, History, + (Add), Reports, More** |

The **Add transaction** form is one sheet for the whole app, opened from the tab bar, the page
headers, the dashboard and history. Rows in the history open in the place they can be changed: a
normal transaction in the form, a transfer fee on its transfer, and a loan on its person's page.

## 3. Screens

| Screen | Contents | States |
| --- | --- | --- |
| Sign in | "Welcome back"; forest brand panel ("Your Money. Your Control.") beside the card on desktop, a short band above it on phones; email, password (show/hide), "Forgot password?" and "Create account" | Wrong password, locked (minutes left), email not verified with "Send the link again" |
| Create account | Your name (autocomplete "name", how TakaLeaf greets you), email, password with the rule as a hint | Field errors beside fields (name checked before sending); "Check your email" confirmation |
| Verify email | Verifies once on open | Verifying, success, expired/used link |
| Forgot / reset password | Email → same answer for any email; new password from the link | Link used or expired → "Get a new link" |
| Dashboard | Phone header: logo, "Nov 2026 ▾", refresh. Forest **Net balance** card (assets, liabilities); 2 × 2 tiles: Income, Expense, Owed to me, I owe; **Due to record** (Record/Skip); **Wallets** (sideways strip on phones, list on desktop); **Recent** (five rows, "History" link); **Budgets** (up to four bars); **Spending by category** | No wallets → "Start by adding your wallets"; empty month → zeros and "No spending this month" |
| Transactions | **Export CSV** (the current filters, every matching row); search with a filter button (From/To dates, and on phones wallet and category); phones: All · Expense · Income · Transfer switch, a "November 2026 · In · Out" card and day groups ("Today · 15 Nov" with the day total); desktop: month, wallet, category and type selects and a table; Newer/Older paging | "Nothing matches these filters" |
| Add / edit transaction | Full screen on phones. Expense · Income · Transfer switch; big centred amount and "Add a note"; quick category chips; picker rows for wallet(s), category (grouped, parent as "general") and time; fee on transfers; number pad on phones; "Save expense"; Delete with confirm | Checks before sending; server messages beside the field; "Add a wallet first" |
| Wallets | Assets / Liabilities tiles; list cards "Cash and bank", "MFS", "Credit card" (limit and credit left) with group totals; **Loans** (lent to others, borrowed, linking to People); show archived; "See its transactions" in the edit sheet | "No wallets yet" |
| Add / edit wallet | Type (new only), name with MFS shortcuts, starting balance or "amount owed now" for cards, credit limit, leave out of net balance, archive, delete | Delete refused if used → archive instead |
| People and loans | Owed to me / I owe tiles; All · Owed to me · I owe switch; rows with a forest initial, "Owes you · note", signed amount | "Nobody here yet" |
| Person | Standing (Owes you / You owe / All settled); Lend · Got paid back · Borrow · Pay back; history | Repay buttons disabled when nothing is owed; "All of it" fills the amount owed |
| Reports | Month · Year switch with month or year arrows (kept in the address); **Income and expense** bars with "Saved ৳X · Y% of income"; **Expense, last 6 months** (or by month for a year) with the chosen month highlighted; **Spending by category** and **Income by category**, each category opening to its sub-categories with links to the matching transactions; Budgets (month only) | "Nothing recorded in …" |
| Budgets | Month button; forest month card (spent of total, white bar, left and days to go); rows with spent / limit, bar and "৳x left · 82%" or "Over by ৳x · 104%" | "No budgets yet" |
| Recurring | "Waiting for you" list; rule cards: title, schedule ("Every month"), next date, From/Into, amount, Automatic / Ask me | Paused and ended rules dimmed |
| Add / edit recurring | Type switch, amount, wallets, category, note, repeat every N unit, first and last date, record automatically, pause/resume, delete | |
| Categories | Expense · Income switch; one row per parent with its sub-categories listed underneath, opening to sub-category chips, "+ Sub-category" and "Edit"; rename, archive; in the edit sheet, merge into another category or delete (confirm in place) | Archived shown dimmed / struck through; a parent with sub-categories asks to sort those first |
| Settings | Account card (leaf avatar, name or "Add your name", email, Edit to change the name); (phones) links to Wallets, People and loans, Budgets, Recurring, Categories; rows for Theme, Change password, Export to CSV, Signed-in devices, Get the Android app (when the server offers it), Sign out; **Signed-in devices** (device name, last used, "This device", Sign out, Sign out all other devices) | Success message after password change |

Still to design and build (see the [development plan](DEVELOPMENT-PLAN.md)): the Android screens (number-pad entry, sync status, app lock).

## 4. Key flows

1. **First run**: register → verify from email → sign in → dashboard says "Start by adding your
   wallets" → add Cash, bKash, bank with today's balances → add the first expense.
2. **Daily expense**: + → amount → wallet → category → Save. The sheet opens on Expense with the
   date and time set to now.
3. **MFS cash-out**: + → Transfer → amount → bKash → Cash → fee ৳18.50 → Save. Both wallets update,
   and the fee shows under Fees and charges.
4. **Lend and get paid back**: People → person → Lend → amount, wallet → later **Got paid back** →
   "All of it" → Save. The person shows "All settled".
5. **Monthly rent**: Recurring → Add → Expense, ৳18,000, bank, House rent, every month from the 5th,
   ask me. Each month it appears in **Due to record**; Record, adjust the amount if needed, Save.
6. **Month review**: Dashboard → previous month → spending by category and budgets → Transactions
   filtered to that category.

## 5. Interaction rules

- **Forms are sheets**: a bottom sheet on phones and a centred dialog on wider screens. Escape or the
  backdrop closes them, the first field gets focus, Tab stays inside, the page behind neither scrolls
  nor takes focus, and focus returns afterwards.
- **Validate first, then trust the server**: obvious mistakes are caught before sending. Server field
  errors appear beside the field they name, and other errors in one alert above the buttons.
- **Destructive actions confirm in place**: "Delete" turns into "Yes, delete" with "Keep" beside it.
  There are no browser dialogs.
- **Amounts are typed in taka** ("1,250.50") and sent as poisha. Credit card debt is typed as a
  positive "amount owed".
- **Times are local** (Asia/Dhaka) everywhere: "Today", "Yesterday", "9:10 am".
- **Lists** show newest first, grouped by day, with paging rather than infinite scroll.
- **Loading** shows a short "Loading…" line. **Errors** say what happened and what to do, in plain words.
  Data that failed to load offers "Try again". A call that hangs is given up after 30 seconds; a save
  that timed out says it may or may not have saved, so it is checked rather than sent twice.
- **Offline**: when the browser loses its connection, a note above the page says so in words until it
  comes back.
- **Filters live in the address**, so a filtered view survives a refresh and can be bookmarked.

## 6. Copy

- Short, plain English, in second person: "You owe", "People owe you", "Choose a wallet".
- Labels name the thing ("Paid from", "Received in"), and buttons name the action ("Record", "Skip",
  "Add a wallet").
- Error messages are full sentences that tell the person how to fix the problem: "Enter an amount
  above zero, like 1250 or 1250.50."
- No jargon: "Mobile banking" rather than "MFS", and "Leave out of net balance" rather than "exclude".
- Same word for the same thing: "Due to record" for repeating items waiting for the person (dashboard
  and Recurring); "Delete" removes a record, "Pause" stops a repeat for a while, "Remove" takes off a
  budget limit. Every destructive button asks "Yes, delete" / "Yes, remove" in place and, where it
  helps, says the consequence underneath ("Your spending stays as it is. Only this monthly limit goes.").
- Amount errors give an example: "Enter an amount above zero, like 1250 or 1250.50."
- Errors without a server message say what happened and what to do; a status code only follows in
  brackets ("TakaLeaf had a problem on its side. Try again in a moment. (Error 502)").

## 7. Responsive and accessibility

- Checked at 390 × 844 and 1440 × 900 in both themes, with no sideways scrolling, and also at 320 and
  360 px, a phone on its side (844 × 390), a tablet both ways (768 × 1024, 1024 × 768) and 200% zoom.
- Every touch target is at least 44 px. Text links and 36 px segments get an invisible 44 px area
  (`tap-area`); a history table row is tappable across its whole width. Grids drop to one
  column and long names truncate. Amounts are never cut off: they stay on one line where they fit and
  wrap only when a very large figure cannot.
- A row that opens an editor keeps what it shows as its name (name, detail, amount) and adds a hidden
  ", edit"; an `aria-label` would replace the amount. Any label starts with the button's visible text.
- Every input has a visible label. Errors are linked with `aria-describedby`, alerts use
  `role="alert"`, and status messages use `role="status"`.
- Dialogs use `role="dialog"` with `aria-modal` and a title, and switches use `role="radio"` /
  `tab` with selected states.
- A "Skip to content" link is the first stop for the keyboard. Focus rings are visible on every control. Buttons, fields, chips, arrows and the dialog close
  button are at least 44 px tall.
- Text contrast is at least 4.5:1 in both themes: axe (WCAG 2.2 AA) runs on every main screen, light
  and dark, desktop and phone, in CI. Measured examples: ink on mint 11.2:1, muted on white 6.1:1,
  expense on white 6.1:1, mint on the forest balance card 4.8:1, dark muted on night surface 7.2:1.
- `prefers-reduced-motion` turns transitions off.
- Budget and status warnings are written in words ("Over budget"), not shown by colour alone.

## 8. Android (version 2)

The same areas and flows, with Android in mind: bottom tabs, a number-pad amount entry that keeps
an expense to four taps plus the amount, a sync status line (last sync, changes waiting, rejected
changes), a Sync button, app lock with PIN or fingerprint, and a daily reminder.

- **Expense in four taps**: + → amount on the pad → a quick category chip → Save. The wallet is the
  last one used; the time is now.
- **Forms are full screens** with the main button pinned at the bottom; Delete confirms in place.
- **Pickers open in place** (a row that expands into the choices), never a separate screen.
- **Sync line** on Home and More: "Synced 2 min ago · 3 changes waiting", or the problem in words.
- **More → Sync** lists changes the server did not accept, with its reason.
- **Lock screen**: the leaf, "Enter your PIN", 4–6 dots, a 64 dp keypad with fingerprint and delete. Glass blur is
used on few surfaces, with a plain translucent fallback on slower phones.

## 9. Loading

One loader everywhere (design option A, "Leaf assembly"): the four pieces of the leaf float apart in
3D and lock together while the app
starts ("Opening TakaLeaf…", full screen, shown by `index.html` before the script loads and by the
Android app while its database opens) and, small, while a page or a server check loads. It is a
`status` / `progressbar` with its label read aloud; with reduced motion it stays assembled and fades.

## 10. Emails

Every email has one job, one button and a plain-text twin. Wording is short and calm, and it
always says what to do if the email was not expected.

| Email | Subject | Button | Also says |
| --- | --- | --- | --- |
| Verify email | Verify your TakaLeaf email | Verify email | The link works once and expires in 24 hours; ignore it if you did not sign up |
| Already registered | You already have a TakaLeaf account | Sign in | "Forgot your password? Reset it here"; your account has not changed |
| Reset password | Reset your TakaLeaf password | Choose a new password | 30 minutes, once; every device is signed out after the change |
| Password changed | Your TakaLeaf password was changed | Reset my password | Account and local time of the change; a warning box for "Was this not you?" |

Greeting: "Hi {name}," or "Hello," for accounts without a name. Designs: the "Emails" row of the UI
design canvas (desktop, phone and dark mode).
