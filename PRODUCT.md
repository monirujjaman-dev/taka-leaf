# Product

## Register

product

## Users

The primary user is one person in Bangladesh keeping their own household money: salary arriving in
a bank account, daily spending in cash and through bKash or Nagad, a credit card for subscriptions,
money sent to parents and a younger sister, a wife's pocket money, and small loans to and from
friends and relatives. They record transactions several times a day, often on a phone with one hand
between other tasks. Once a month they sit at a computer to review where the money went.

They are comfortable with technology but have no patience for bookkeeping ceremony. The job to be
done is: *"Tell me exactly how much I have, where it went this month, and who owes whom, and let me
note a new expense in seconds."* Anyone may register, but every account is private and separate.

## Product Purpose

TakaLeaf is a personal income and expense tracker for Bangladeshi taka. It keeps every place money
lives (cash, bank accounts, credit cards, mobile banking wallets, and money lent or borrowed per
person) and shows the net balance, the month's income and spending by category, budgets, and
recurring bills.

It exists because general-purpose trackers ignore how money moves in Bangladesh: MFS cash-out fees,
informal lending between people, lakh/crore digit grouping, and the habit of keeping money in
several wallets at once. Success means the owner trusts its numbers to the poisha, opens it every
day without effort, and stops keeping a paper or spreadsheet *hishab* alongside it.

## Brand Personality

**Trustworthy, calm, growth-oriented.**

The voice is plain and kind: short sentences, second person ("You owe ৳2,000"), no jargon ("Mobile
banking", not "MFS"), no exclamation marks, and nothing that sounds like a bank's legal department.
Errors say what happened and how to fix it. The emotional goal is quiet confidence. Opening the app
should feel like a tidy wallet, not a spreadsheet and not a game. Money worries are real, so the
product never shames overspending. It states the facts clearly, and the person decides.

Tagline: *Your Money. Your Control.*

## Anti-references

- **Banking apps that bury the balance** under promotions, cards to upsell, and nested menus.
- **Spreadsheet-like finance tools** with dense grids, tiny type and accountant vocabulary (debit/credit, ledger, journal).
- **Gamified budgeting**: streaks, confetti, badges, cartoon mascots, or red alarm screens that scold.
- **Crypto/fintech dashboards**: neon on black, glowing charts, gradients on text, speculative energy.
- **Generic SaaS admin templates**: grey sidebars, identical stat tiles, stock illustration empty states.
- **Glassmorphism as a gimmick**: heavy blur on everything, glass over glass, low-contrast text on frosted panels. Glass is a deliberate, restrained surface here, not the default trick.

## Design Principles

1. **The number is the hero.** Every screen leads with the amount that answers its question (net
   balance, this month's spending, what someone owes). Everything else supports that number.
2. **Seconds, not steps.** Recording a transaction is the most frequent act, so it is always one tap
   away and asks only for what it needs. Smart defaults (now, Expense, the last wallet) do the rest.
3. **Exact and honest.** Amounts are never rounded or approximated, balances are never "about".
   Warnings use words as well as colour. The product never hides a fee or a debt.
4. **Calm by default.** Natural greens, generous space, one primary action per view, and motion only
   where it explains a change. Nothing blinks for attention.
5. **Built for Bangladesh.** Taka with lakh/crore grouping, local time for days and months, MFS
   wallets and their cash-out fees, and person-to-person lending as first-class ideas.

## Accessibility & Inclusion

- Target **WCAG 2.2 AA**: text contrast at least 4.5:1, also on glass surfaces in both themes, and
  3:1 for large numbers and UI boundaries.
- Fully usable by keyboard, with visible focus. Labels on every control, field errors announced and
  tied to their field, and dialogs that trap and return focus.
- Status (over budget, income versus expense, owes you versus you owe) is always in words or signs,
  never colour alone. This matters for colour-blind users, who often struggle to tell green from red.
- Works at 200% zoom and on 360 px wide phones, one-handed. Touch targets are at least 44 px.
- Respects `prefers-color-scheme` until the person chooses, and should respect
  `prefers-reduced-motion`.
- English only, in plain words suitable for people whose first language is Bengali. Numbers and
  dates follow Bangladeshi conventions (৳, lakh/crore grouping, Asia/Dhaka time).
