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
- **One hand on a phone.** Main actions sit within thumb reach: bottom tabs and a floating add button.

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
| Settings | `/settings` | Account, theme, password, sign out (on phones also links to Reports, Budgets, Recurring, Categories) |
| Sign-in flow | `/sign-in`, `/register`, `/verify-email`, `/forgot-password`, `/reset-password` | Account access; email links land on the last two |

### Navigation

| Width | Pattern |
| --- | --- |
| ≥ 1024 px | Fixed glass sidebar: logo, **Add transaction** button, nine sections, theme switch, email, sign out |
| < 1024 px | Glass top bar (logo, theme) · bottom tab bar with five tabs: **Home, History, Wallets, People, More** · floating round **+** above the tab bar |

The **Add transaction** form is one sheet for the whole app, opened from the sidebar, the floating
button, the dashboard and history. Rows in the history open in the place they can be changed: a
normal transaction in the form, a transfer fee on its transfer, and a loan on its person's page.

## 3. Screens

| Screen | Contents | States |
| --- | --- | --- |
| Sign in | Email, password (show/hide), "Forgot password?", link to register | Wrong password, locked (minutes left), email not verified with "Send the link again" |
| Create account | Email, password with the rule as a hint | Field errors beside fields; "Check your email" confirmation |
| Verify email | Verifies once on open | Verifying, success, expired/used link |
| Forgot / reset password | Email → same answer for any email; new password from the link | Link used or expired → "Get a new link" |
| Dashboard | Month switcher; forest **Net balance** card (assets, owed); income and spent this month; people owe you / you owe (when non-zero); **Due to record** (Record/Skip); **Budgets** (up to four bars); **Recent** (five rows); **Where the money went** (category bars) | No wallets → "Start by adding your wallets"; empty month → zeros and "No spending this month" |
| Transactions | Search, From/To dates, (More filters on phones) wallet, type, category; Income / Expense / Entries totals; rows grouped by day (Today, Yesterday, Sat 14 Nov 2026); Newer/Older paging | "Nothing matches these filters" |
| Add / edit transaction | Expense · Income · Transfer switch; amount; wallet(s); category (grouped, parent as "general"); fee on transfers; date and time; note; Delete with confirm | Checks before sending; server messages beside the field; "Add a wallet first" |
| Wallets | Net / Assets / Owed tiles; cards grouped Cash, Mobile banking, Bank, Credit card; balance, credit left; "See transactions"; show archived | "No wallets yet" |
| Add / edit wallet | Type (new only), name with MFS shortcuts, starting balance or "amount owed now" for cards, credit limit, leave out of net balance, archive, delete | Delete refused if used → archive instead |
| People | Owe-you / you-owe totals; person cards with initial, note and standing | "Nobody here yet" |
| Person | Standing (Owes you / You owe / All settled); Lend · Got paid back · Borrow · Pay back; history | Repay buttons disabled when nothing is owed; "All of it" fills the amount owed |
| Reports | Month · Year switch with month or year arrows (kept in the address); **Income and expense** bars with "Saved ৳X · Y% of income"; **Expense, last 6 months** (or by month for a year) with the chosen month highlighted; **Spending by category** and **Income by category**, each category opening to its sub-categories with links to the matching transactions; Budgets (month only) | "Nothing recorded in …" |
| Budgets | Month switcher; cards with percent, bar, spent of limit, left or over; "Close to the limit" / "Over budget" labels | "No budgets yet" |
| Recurring | "Waiting for you" list; rule cards: title, schedule ("Every month"), next date, From/Into, amount, Automatic / Ask me | Paused and ended rules dimmed |
| Add / edit recurring | Type switch, amount, wallets, category, note, repeat every N unit, first and last date, record automatically, pause/resume, delete | |
| Categories | Expense / Income tabs; parent cards with sub-category chips; add, add sub-category, rename, archive; in the edit sheet, merge into another category or delete (confirm in place) | Archived shown dimmed / struck through; a parent with sub-categories asks to sort those first |
| Settings | Account email, theme, sign out; change password; (phones) links to Budgets, Recurring, Categories | Success message after password change |

Still to design and build (see the [development plan](DEVELOPMENT-PLAN.md)): CSV export,
signed-in devices, and the Android screens (number-pad entry, sync status, app lock).

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
  backdrop closes them, the first field gets focus, and focus returns afterwards.
- **Validate first, then trust the server**: obvious mistakes are caught before sending. Server field
  errors appear beside the field they name, and other errors in one alert above the buttons.
- **Destructive actions confirm in place**: "Delete" turns into "Yes, delete" with "Keep" beside it.
  There are no browser dialogs.
- **Amounts are typed in taka** ("1,250.50") and sent as poisha. Credit card debt is typed as a
  positive "amount owed".
- **Times are local** (Asia/Dhaka) everywhere: "Today", "Yesterday", "9:10 am".
- **Lists** show newest first, grouped by day, with paging rather than infinite scroll.
- **Loading** shows a short "Loading…" line. **Errors** say what happened and what to do, in plain words.
- **Filters live in the address**, so a filtered view survives a refresh and can be bookmarked.

## 6. Copy

- Short, plain English, in second person: "You owe", "People owe you", "Choose a wallet".
- Labels name the thing ("Paid from", "Received in"), and buttons name the action ("Record", "Skip",
  "Add a wallet").
- Error messages are full sentences that tell the person how to fix the problem: "Enter an amount
  above zero, like 1250 or 1250.50."
- No jargon: "Mobile banking" rather than "MFS", and "Leave out of net balance" rather than "exclude".

## 7. Responsive and accessibility

- Checked at 390 × 844 and 1440 × 900 in both themes, with no sideways scrolling. Grids drop to one
  column, long names truncate, and amounts never wrap.
- Every input has a visible label. Errors are linked with `aria-describedby`, alerts use
  `role="alert"`, and status messages use `role="status"`.
- Dialogs use `role="dialog"` with `aria-modal` and a title, and switches use `role="radio"` /
  `tab` with selected states.
- Focus rings are visible on every control. Buttons and fields are 44–48 px tall; small chips
  (MFS names, "All of it") are 32–36 px and should grow to 44 px in the accessibility pass.
- The target for text contrast is at least 4.5:1 on glass in both themes, to be measured in the
  accessibility pass (M4).
- Budget and status warnings are written in words ("Over budget"), not shown by colour alone.

## 8. Android (version 2)

The same areas and flows, with Android in mind: bottom tabs, a number-pad amount entry that keeps
an expense to four taps plus the amount, a sync status line (last sync, changes waiting, rejected
changes), a Sync button, app lock with PIN or fingerprint, and a daily reminder. Glass blur is
used on few surfaces, with a plain translucent fallback on slower phones.
