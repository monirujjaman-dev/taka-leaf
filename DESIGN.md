---
name: TakaLeaf
description: Your Money. Your Control. A calm, natural-green personal finance app for Bangladeshi taka.
colors:
  forest: "#0F7A44"
  leaf: "#22A06B"
  sage: "#83CFA2"
  mint: "#E7F5EC"
  ink: "#0B3B24"
  slate: "#55637A"
  line: "#D1DFD8"
  surface: "#FFFFFF"
  glass: "#FFFFFFA8"
  night: "#0A1F15"
  night-surface: "#11301F"
  night-glass: "#FFFFFF14"
  night-line: "#FFFFFF24"
  night-text: "#E7F5EC"
  night-muted: "#A9BDB3"
  night-nav-active: "#A8E0BE"
  income: "#0F7A44"
  income-dark: "#83CFA2"
  expense: "#A8412A"
  expense-dark: "#F0997F"
  warning: "#9A6A10"
  warning-dark: "#E8B766"
  budget-near: "#C98A1B"
typography:
  display:
    fontFamily: "Inter, Noto Sans Bengali, system-ui, sans-serif"
    fontSize: "34px"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.025em"
    fontFeature: "tnum"
  headline:
    fontFamily: "Inter, Noto Sans Bengali, system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Inter, Noto Sans Bengali, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 800
    lineHeight: 1.4
  amount:
    fontFamily: "Inter, Noto Sans Bengali, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 800
    lineHeight: 1.4
    fontFeature: "tnum"
  body:
    fontFamily: "Inter, Noto Sans Bengali, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Inter, Noto Sans Bengali, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 700
    lineHeight: 1.4
  caption:
    fontFamily: "Inter, Noto Sans Bengali, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.4
rounded:
  sm: "10px"
  md: "14px"
  lg: "20px"
  xl: "22px"
  2xl: "26px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  2xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.forest}"
    textColor: "{colors.surface}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "44px"
  button-primary-dark:
    backgroundColor: "{colors.sage}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "44px"
  button-secondary:
    backgroundColor: "{colors.glass}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "44px"
  button-danger:
    backgroundColor: "{colors.expense}"
    textColor: "{colors.surface}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "44px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "48px"
  card-glass:
    backgroundColor: "{colors.glass}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: "20px"
  card-balance:
    backgroundColor: "{colors.forest}"
    textColor: "{colors.surface}"
    typography: "{typography.display}"
    rounded: "{rounded.2xl}"
    padding: "20px"
  chip:
    backgroundColor: "{colors.mint}"
    textColor: "{colors.forest}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0 14px"
    height: "44px"
  nav-item-active:
    backgroundColor: "{colors.mint}"
    textColor: "{colors.forest}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "44px"
  dialog:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.2xl}"
    padding: "20px"
  fab:
    backgroundColor: "{colors.forest}"
    textColor: "{colors.surface}"
    rounded: "{rounded.pill}"
    size: "56px"
---

# Design System: TakaLeaf

## Overview

**Creative North Star: "A tidy wallet in a green garden."** TakaLeaf should feel calm and exact:
light mint ground, two soft green glows behind frosted-glass cards, and one confident forest green
for the things that matter (the net balance and the main action). It is a product register: the
design serves daily, fast, accurate money entry and a clear monthly picture.

Key characteristics:

- **Numbers are the heroes.** The biggest, heaviest type on any screen is an amount, set in tabular
  figures with Bangladeshi grouping (`৳1,25,000.00`).
- **Restrained glass.** Cards, the sidebar, the top bar and the tab bar are frosted glass
  (`backdrop-filter: blur(20px) saturate(140%)`) over the background glows. Dialogs and inputs are
  solid so text stays crisp. Glass never stacks on glass.
- **One primary colour, used sparingly.** Forest green marks the balance card, primary buttons,
  active navigation and links. Most of the screen is white or mint glass with ink text.
- **Two themes from one set of tokens.** Light is mint and white; dark is a deep night green with
  sage as the primary.
- **Layout.** Phones (< 1024 px) get a sticky glass top bar, a floating glass tab bar inset 12 px
  from the edges, and a 56 px round add button above it. Desktop gets a fixed 256 px glass sidebar
  inset 16 px, with content at most 1024 px wide. Content padding is 16 px on phones and 32 px on
  desktop. Grids collapse to one column on phones. Nothing scrolls sideways at 390 px.
- **Motion** is minimal: colour and brightness transitions on hover and press (≈150 ms), with no
  entrance animations. `prefers-reduced-motion` turns transitions off.

## Colors

The palette comes from the brand board: natural greens with one warm counterweight for spending.

| Token | Light | Dark | Role |
| --- | --- | --- | --- |
| background | `mint` #E7F5EC | `night` #0A1F15 | Page ground under the glows |
| surface | `surface` #FFFFFF | `night-surface` #11301F | Dialogs, inputs, selected segment |
| glass | #FFFFFF at 66% | #FFFFFF at 8% | Cards, bars, sidebar |
| glass border | `line` #D1DFD8 | #FFFFFF at 14% | 1 px border on glass and inputs |
| text | `ink` #0B3B24 | `night-text` #E7F5EC | Headings, amounts, body |
| muted | `slate` #55637A | `night-muted` #A9BDB3 | Secondary lines, captions, hints |
| primary | `forest` #0F7A44 | `sage` #83CFA2 | Primary buttons, links, active nav, balance card (forest in both) |
| chip | `mint` #E7F5EC | sage at 14% | Icon tiles, chips, hover, segmented control |
| income | #0F7A44 | #83CFA2 | Income amounts, "owes you" |
| expense | #A8412A | #F0997F | Expense amounts, "you owe", over budget, errors, delete |
| budget near | #C98A1B (bar) | same | Budget at 80% or more |
| active nav text | `forest` | `night-nav-active` #A8E0BE | Active sidebar item and tab (4.5:1 on the chip tint) |
| glow A / B | leaf 30% / sage 55% | leaf 28% / forest 55% | The two blurred background circles |

Rules:

- Income and expense are always shown with a sign (`+৳85,000.00`, `−৳1,250.00`) **and** a colour.
  Transfers stay neutral.
- `leaf` #22A06B is for progress fills only (category and budget bars), not for text.
- Error text uses `expense`, on a 10% `expense` tint for alert boxes. Success uses the primary
  colour on the chip tint.

## Typography

**Inter** for everything (Noto Sans Bengali as a fallback), with tabular figures on by default
(`font-variant-numeric: tabular-nums` on the body), so columns of amounts line up.

| Role | Size / weight | Used for |
| --- | --- | --- |
| display | 34px (30px on phones) / 800, −0.025em | Net balance on the balance card |
| headline | 26px / 800, −0.025em | Page titles ("Dashboard", "Wallets") |
| title | 16px / 800 | Card titles, wallet and person names |
| amount | 15–24px / 800, tabular | Amounts in rows, tiles and cards (24px on wallet cards) |
| body | 15px / 400, line-height 1.6 | Paragraphs, inputs, row titles (row titles 700) |
| label | 13px / 700 | Field labels, buttons, chips |
| caption | 12–13px / 400–600 | Secondary lines, hints, tab-bar labels (11px) |
| section | 12–13px / 800 uppercase, wide tracking | Day headings in history, wallet group headings |

Headings are tight (−0.025em) and heavy, and body text is relaxed. There is no italic, and amounts
are never shown in a light weight.

## Elevation

Depth comes from glass and soft green shadows, not from stacking layers.

| Level | Treatment | Used for |
| --- | --- | --- |
| 0 Ground | Mint (night) background + two 80–90 px blurred glows | Page |
| 1 Glass | 66% white (8% in dark), 1 px border, blur 20 px saturate 140%, shadow `0 8px 24px rgb(11 59 36 / 0.07)` (dark: `rgb(0 0 0 / 0.25)`) | Cards, sidebar, top bar, tab bar, stat tiles |
| 2 Hero | Solid forest, shadow `0 12px 28px rgb(11 59 36 / 0.22)` | Net balance card |
| 3 Floating | Solid forest/sage, shadow `0 10px 24px rgb(11 59 36 / 0.3)` | Add button |
| 4 Overlay | Night at 45% + 2 px blur backdrop; solid surface panel, large shadow | Dialogs and sheets |

Focus is a 2 px primary outline offset by 2 px on every interactive element.

## Components

- **Buttons**: 44 px tall, radius 14 px, 13px/700 label. Primary is forest (sage in dark).
  Secondary is glass. Ghost uses the chip tint on hover. Danger is expense. A disabled button is at
  50% opacity with a not-allowed cursor.
- **Fields**: label above (13px/700), then a 48 px solid input with radius 14 px, a 1 px line border,
  and a primary border plus 25% ring on focus. Errors turn the border expense and show a message
  below, linked with `aria-describedby`. Amount fields use `inputmode="decimal"` and the placeholder
  `0.00`.
- **Segmented control** (Expense · Income · Transfer, Expense · Income tabs): a chip-tinted track
  with radius 16 px. The selected segment is a solid surface with primary text and a light shadow.
- **Glass card**: radius 20–22 px, padding 16–20 px, holding a title row with a primary text link on
  the right ("See all").
- **Balance card**: the solid forest hero with the display amount and a row of mint (#E7F5EC,
  4.8:1) sub-figures (assets, owed).
- **Stat tile**: a small glass card with a caption label and an 18–20px/800 amount.
- **Transaction row**: a 40 px chip-tinted icon tile (arrow up for expense, arrow down for income,
  swap for transfer), a bold title and a muted "time · note · wallet" line, and a right-aligned
  signed amount. The whole row is a button, with the chip tint on hover.
- **Progress bar**: an 8–10 px track in the chip tint, filled with leaf (budget near: amber; over:
  expense), with the amount spent and left or over written underneath.
- **Navigation**: a sidebar of 44 px items with the active item on the chip tint in primary text
  (`night-nav-active` in dark). The
  phone tab bar shows five icon-over-label items, with the active one on the chip tint.
- **Dialog / sheet**: a bottom sheet on phones (top corners 26 px) and a centred 512 px dialog on
  desktop. It has a solid surface, a title with a round 40 px close button, and actions on the right
  (Cancel secondary, Save primary), with any destructive action on the left.
- **Chip**: 44 px, pill, chip tint, primary 13px/700 text. Used for MFS name shortcuts, "All of
  it", sub-categories and "+ Sub-category".
- **Empty state**: centred bold title, one muted sentence, and at most one primary action.
- **Icons**: line icons on a 24 px grid with a 1.8 stroke and round caps, drawn in-house
  (`ui/Icon.tsx`).

## Do's and Don'ts

**Do**

- Lead each screen with the amount that answers its question.
- Show money with `formatBdt` (`৳1,25,000.00`, minus sign `−`), and type it as taka text parsed by `parseTaka`.
- Use glass only for surfaces that sit directly on the background: cards, bars and the sidebar.
- Keep one primary button per view, and put the destructive action on the opposite side.
- Pair every colour signal with words or a sign: "Over budget", `+`/`−`, "Owes you".
- Check every screen at 390 px and 1440 px, in light and dark.
- Use `min-w-0`, `truncate` and single-column grids so long names never push the layout sideways.

**Don't**

- Don't put glass on glass, blur inputs or dialogs, or set low-contrast text on a busy glow.
- Don't use gradients on text, neon accents, or glowing charts.
- Don't use red and green as the only difference between income and expense.
- Don't round amounts, drop the decimals, or use Western 1,250,000 grouping.
- Don't add confetti, streaks, mascots or scolding alarm states.
- Don't add a second accent colour; leaf and amber are for progress only.
- Don't use browser `alert`/`confirm`; confirm in place ("Yes, delete" / "Keep").
