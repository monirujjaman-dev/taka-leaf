---
name: TakaLeaf
description: Your Money. Your Control. A calm, natural-green personal finance app for Bangladeshi taka.
colors:
  forest: "#0F7A44"
  forest-hover: "#0C6A3B"
  leaf: "#22A06B"
  sage: "#83CFA2"
  sage-hover: "#9ADAB4"
  sage-soft: "#B5E2C4"
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
  night-nav-active: "#83CFA2"
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
  display-sm:
    fontFamily: "Inter, Noto Sans Bengali, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: "-0.02em"
    fontFeature: "tnum"
  headline:
    fontFamily: "Inter, Noto Sans Bengali, system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  headline-phone:
    fontFamily: "Inter, Noto Sans Bengali, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  dialog:
    fontFamily: "Inter, Noto Sans Bengali, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 800
    lineHeight: 1.3
  wordmark:
    fontFamily: "Inter, Noto Sans Bengali, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 800
    lineHeight: 1.2
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
  control:
    fontFamily: "Inter, Noto Sans Bengali, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 700
    lineHeight: 1.4
  small:
    fontFamily: "Inter, Noto Sans Bengali, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 700
    lineHeight: 1.4
  caption:
    fontFamily: "Inter, Noto Sans Bengali, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.4
  micro:
    fontFamily: "Inter, Noto Sans Bengali, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    lineHeight: 1.3
  tab:
    fontFamily: "Inter, Noto Sans Bengali, system-ui, sans-serif"
    fontSize: "10px"
    fontWeight: 700
    lineHeight: 1.3
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
- **Restrained glass.** Cards, the sidebar, the tab bar, fields and picker rows are frosted glass
  (`backdrop-filter: blur(20px) saturate(140%)`) over the background glows. Dialog panels are solid
  so text stays crisp.
- **One primary colour, used sparingly.** Forest green marks the balance card, primary buttons,
  active navigation and links. Most of the screen is white or mint glass with ink text.
- **Two themes from one set of tokens.** Light is mint and white; dark is a deep night green with
  sage as the primary.
- **Layout.** Phones (< 1024 px) have no top bar: each screen starts with its own 56 px header
  (the dashboard shows the logo, a short month button and refresh; other screens a 44 px glass back
  button, a 20 px title and one 44 px icon action). A floating glass tab bar (68 px, radius 24,
  inset 16 px) holds Home, History, a centre 56 px forest **Add** button, Reports and More. Desktop
  is a flex row with 20 px padding and gap: a 240 px glass sidebar (radius 26) beside the content,
  whose header has a 26 px title, a month button and **Add transaction**. Content padding is 20 px
  on phones. Grids collapse to one column on phones. Nothing scrolls sideways at 390 px.
- **Android** keeps the phone layout everywhere. Touch targets are at least 48 dp. Phones stay in
  portrait. On tablets, foldables and wider windows (Android 16 ignores the portrait lock there),
  screens keep a 600 dp column, centred, and the tab bar stays 448 dp wide, centred. The keyboard
  pushes the content and the pinned Save row up, and the tab bar hides while the keyboard is open.
  Amounts shrink to fit rather than cut off digits; at text size 1.3× and above the dashboard tiles
  go one per row. Tab labels and number-pad digits grow with the text size only up to 1.3× and 1.4×,
  which is what their bar and keys can hold. Colours come only from `packages/shared` themes:
  the forest hero surfaces and the chosen segment use `hero` / `onHero` / `onHeroMuted` (forest in
  both themes), danger buttons `expense` / `onExpense`, error notes `expenseTint`, near budgets
  `budgetNear`.
- **Motion** is minimal: colour and brightness transitions on hover and press (≈150 ms), with no
  entrance animations. `prefers-reduced-motion` turns transitions off.

## Colors

The palette comes from the brand board: natural greens with one warm counterweight for spending.

| Token | Light | Dark | Role |
| --- | --- | --- | --- |
| background | `mint` #E7F5EC | `night` #0A1F15 | Page ground under the glows |
| surface | `surface` #FFFFFF | `night-surface` #11301F | Dialog panels |
| glass | #FFFFFF at 66% | #FFFFFF at 8% | Cards, bars, sidebar, fields, segmented track |
| glass border | `line` #D1DFD8 | #FFFFFF at 14% | 1 px border on glass and inputs |
| text | `ink` #0B3B24 | `night-text` #E7F5EC | Headings, amounts, body |
| muted | `slate` #55637A | `night-muted` #A9BDB3 | Secondary lines, captions, hints |
| primary | `forest` #0F7A44 | `sage` #83CFA2 | Primary buttons, links, active nav, balance card (forest in both) |
| chip | `mint` #E7F5EC | sage at 14% | Icon tiles, chips, hover |
| track | ink at 8% | white at 10% | Progress bar track |
| income | #0F7A44 | #83CFA2 | Income amounts, "owes you" |
| expense | #A8412A | #F0997F | Expense amounts, "you owe", over budget, errors, delete |
| budget near | `budget-near` #C98A1B (bar) | same | Budget at 80% or more |
| hover | `forest-hover` #0C6A3B | `sage-hover` #9ADAB4 | Primary buttons on hover |
| sage soft | `sage-soft` #B5E2C4 | same | "Leaf" in the wordmark on forest panels |
| selection | forest at 18% | sage at 30% | Selected text; the caret and native checkboxes use the primary colour |
| active tab text | `forest` | `night-nav-active` #83CFA2 | Active phone tab (no tint behind it). The active sidebar item is solid forest with white text in both themes |
| glow A / B | leaf 30% / sage 55% | leaf 28% / forest 55% | The two blurred background circles |

Rules:

- Income and expense are always shown with a sign (`+৳85,000.00`, `−৳1,250.00`) **and** a colour.
  Transfers stay neutral.
- `leaf` #22A06B is for progress fills only (category and budget bars), not for text.
- Each theme sets `color-scheme`, so native select menus, the date picker and scrollbars match it.
- Error text uses `expense`, on a 10% `expense` tint for alert boxes. Success uses the primary
  colour on the chip tint.

## Typography

**Inter** for everything (Noto Sans Bengali as a fallback), with tabular figures on by default
(`font-variant-numeric: tabular-nums` on the body), so columns of amounts line up.

Each role is a Tailwind token in `index.css` (`text-display`, `text-body`, …), set in rem so a
person's browser text size scales it. Use the role, never a pixel value: **14 px is for controls,
reading text is 15, supporting text 13.**

| Role (class) | Size / weight | Used for |
| --- | --- | --- |
| display (`text-display`) | 34px / 800, −0.025em | The amount that answers the screen: net balance. On the balance card it is at most 13% of the card's width, so larger text keeps it on one line |
| display-sm (`text-display-sm`) | 28px / 800, −0.02em | A secondary hero: the budget total, a person's standing, the sign-in title |
| amount being typed | 48px / 800, stepping down to 28px for long amounts | The add sheet |
| headline (`text-headline`; `text-xl` on phones) | 26px desktop, 20px phone / 800 | Page titles ("Dashboard", "Wallets") |
| dialog (`text-dialog`) | 18px / 800 | Dialog and add-sheet titles |
| title (`text-base`) | 16px / 800 | Card titles, wallet and person names |
| amount | 15–18px / 800, tabular | Amounts in rows, tiles and cards |
| body (`text-body`) | 15px / 400 | Reading text: empty-state sentences, messages, inputs; row titles at 700 |
| control (`text-sm`) | 14px / 700 | Buttons, navigation, segmented options, chips, pagination; in-page notes (error, success, offline) at 600. Nothing else |
| small (`text-small`) | 13px | Field labels (700), hints, notes and metadata (400, muted), section headings (800 muted: "Today · 15 Nov") |
| caption (`text-caption`) | 12px / 400–600 | The detail line under a row title, tile labels, badges ("Automatic", "This device") |
| micro / tab (`text-micro`, `text-tab`) | 11px / 10px, 700 | Chart value labels and tab-bar labels only; never reading text |
| wordmark (`text-wordmark`) | 22px / 800 | "TakaLeaf" beside the mark |

Headings are tight (−0.025em) and heavy, and body text is relaxed. There is no italic, and amounts
are never shown in a light weight.

## Elevation

Depth comes from glass and soft green shadows, not from stacking layers.

| Level | Treatment | Used for |
| --- | --- | --- |
| 0 Ground | Mint (night) background + two 80–90 px blurred glows | Page |
| 1 Glass | 66% white (8% in dark), 1 px border, blur 20 px saturate 140%, shadow `0 8px 24px rgb(11 59 36 / 0.07)` (dark: `rgb(0 0 0 / 0.25)`) | Cards, sidebar, tab bar, stat tiles, fields. Inside a dialog the same tint without the blur, since it sits on a solid surface |
| 2 Hero | Solid forest, shadow `0 12px 28px rgb(11 59 36 / 0.22)`, leaf watermark at 16% top right | Net balance card, month budget card, sign-in brand panel |
| 3 Floating | Solid forest, radius 20, shadow `0 8px 18px rgb(15 122 68 / 0.4)` | Centre Add button in the tab bar |
| 4 Overlay | Night at 45% + 2 px blur backdrop; solid surface panel, large shadow | Dialogs; the add sheet is full screen on phones |

Focus is a 2 px primary outline offset by 2 px on every interactive element.

## Components

- **Buttons**: 44 px tall, radius 14 px, 14px/700 label. Primary is forest (sage in dark).
  Secondary is glass. Ghost uses the chip tint on hover. Danger is expense. A disabled button is at
  50% opacity with a not-allowed cursor.
- **Fields**: label above (13px/700), then a 50 px glass input with radius 16 px, a 1 px line border,
  and a primary border plus 25% ring on focus. Errors turn the border expense and show a message
  below, linked with `aria-describedby`. Amount fields use `inputmode="decimal"` and the placeholder
  `0.00`.
  On touch screens field text is at least 16px, so iOS does not zoom in when a field is focused.
- **Segmented control** (Expense · Income · Transfer, All · Expense · Income · Transfer, Month ·
  Year, All · Owed to me · I owe): a 44 px glass track with 3 px padding; 36 px options with radius
  11 px; the chosen one is solid forest with white text. Options are radios.
  Each option keeps a 44 px touch area (the `tap-area` utility) around its 36 px look.
- **Glass card**: radius 20–22 px, padding 16–20 px, holding a title row with a primary text link on
  the right ("See all", "History").
- **List card**: a glass card (radius 20, padding 4/14) of 54–62 px rows: a 36–40 px icon tile or a
  40 px forest initial avatar, a bold title over a 12px muted line, a right-aligned amount and a
  chevron. Used for wallets, people, categories, budgets, settings and day groups in history.
- **Balance card**: the solid forest hero with "Net balance" 13px, the 34px amount, and Assets and
  Liabilities below (12px mint labels, 15/700 white figures), with the leaf watermark.
- **Stat tile**: two by two in a `StatGrid`, one per row when that space is under 20rem (320 px
  phones, larger text). Glass, radius 18, padding 12/14, a 36 px icon tile (radius 12; money-in green,
  money-out rust), a 12px/600 muted label and a 16px/800 value. Two by two on the dashboard.
- **Transaction row**: a 40 px icon tile (radius 14; money in, money out in rust, swap for
  transfer), a bold title and a muted "detail · time" line (or "· 5 Nov" outside history), and a
  right-aligned signed amount. The whole row is a button, with the chip tint on hover. On desktop
  the history is a table: Date, Description, Category, Wallet, Amount (52 px rows).
- **Progress bar**: 8 px, radius 4, on the track colour, filled with leaf (budget near: amber; over:
  expense), with "৳2,160 left · 82%" or "Over by ৳200 · 104%" underneath.
- **Navigation**: a 240 px sidebar of 44 px items (radius 14, 14px/700, 19 px icons); the active
  item is solid forest with white text. Its footer holds the theme switch, sign out and "Connected
  to your server". The phone tab bar has four icon-over-label items (22 px icons, 10px/700 labels,
  active in primary with no tint) around the centre Add button; More lights up on every screen
  reached from it.
  On tablets the tab bar keeps phone width (448 px max), centred, so both thumbs reach Add.
- **Add sheet**: full screen on phones, a 512 px dialog on desktop. A 44 px glass close button and
  a 17px title; the type switch; a centred 48px amount (rust for expense, green for income) over
  an "Add a note" pill; up to eight quick category chips (selected: forest border on mint); 52 px
  glass picker rows (radius 16) for wallets, category and time; a 3 × 4 number pad of 48 px glass
  keys on phones; and a 52 px "Save expense" button (radius 18).
  The Save row is pinned to the bottom of the sheet (content scrolls under a short fade), so a
  360 px phone, a phone on its side or 200% zoom can save without scrolling.
- **Dialog**: a bottom sheet on phones (top corners 26 px) and a centred 512 px dialog on desktop,
  with a solid surface, a title and a round 44 px close button, actions on the right (Cancel
  secondary, Save primary) and any destructive action on the left.
- **Chip**: 44 px, radius 14, chip tint, 13–14px/700 text. Used for MFS name shortcuts, "All of
  it", sub-categories and "+ Sub-category".
- **Empty state**: centred bold title, one muted sentence, and at most one primary action.
- **Error note**: expense text on a 10% expense tint, radius 14. When data failed to load it also holds
  a 44 px "Try again" button outlined in the same colour ("Trying…" while it reloads). The offline note
  is the same shape on the chip tint, in body text.
- **Icons**: line icons on a 24 px grid with a 1.8 stroke and round caps, drawn in-house
  (`ui/Icon.tsx`).
- **Loader** (design option A, "Leaf assembly"): the four pieces of the leaf mark float apart in an
  isometric view (scene rotateX 58°, rotateZ −38°, each piece lifted 40–150 px and shifted a
  little), then turn face-on and lock together, hold, and drift apart again: one 3.2 s cycle (ease
  0.65, 0, 0.35, 1; apart until 18%, together 50–84%). A soft shadow tightens and darkens as the
  pieces meet. 150 px with "Opening TakaLeaf…" and a sliding 120 × 4 px bar while the app starts
  (also drawn by `index.html` before the script loads); 44 px with a muted line inside pages. With
  reduced motion the mark stays assembled and only fades between 55% and 100%. Geometry, colours
  and timing: `LEAF_PATHS`, `LEAF_COLORS`, `LOADER_MOTION` in `packages/shared`. Android turns each
  lift into the in-plane shift that looks the same, since React Native has no 3D layering.
  Start-up is one loader: every full-size loader runs on one clock (`ui/loaderClock.ts`), so React
  continues the `index.html` copy's phase, and until the first page has painted, a page's loading
  continues it full screen (`ui/startup.tsx`). After start-up the 44 px loader stays invisible for
  350 ms, then fades in from the assembled mark, so a quick load shows nothing.
- **Motion**: only where it explains a change. Dialogs rise from the bottom edge on phones (260 ms,
  `cubic-bezier(0.32, 0.72, 0, 1)`) and grow from 0.96 with a fade on wider screens (200 ms,
  `cubic-bezier(0.22, 1, 0.36, 1)`); the backdrop fades with them; closing plays the reverse faster
  (200 / 150 ms), and a dialog that replaces another appears in place. The segmented control's
  forest pill slides to the chosen option (200 ms). Buttons, number-pad keys, tabs and chips press
  to 0.97 at once and release over 160 ms (`press`); rows tint on press. Reduced motion keeps the
  fades and drops all movement. Nothing animates on its own except the loader.
  On Android every pressable surface shows the system ripple in place of the web's hover and press
  tints: the primary colour at 14% (sage at 18% in dark), or white at 24% on solid forest buttons
  and chips (`ripple`, `rippleOnPrimary` in `packages/shared` themes). Ripples stay inside rounded
  corners; header buttons and tabs use a round, borderless one. Buttons, chips, number-pad and PIN
  keys and the Add button also press to 0.97 and release over 160 ms. The segmented pill slides
  (200 ms, `cubic-bezier(0.22, 1, 0.36, 1)`), and the add sheet rises from the bottom (260 ms) while
  other screens keep Android's own transition. With "Remove animations" on, the ripple still shows,
  nothing scales or slides, and the add sheet fades in place. Values in `apps/mobile/src/ui/motion.ts`.
- **Email**: a 600 px column on mint; the leaf mark (40 px PNG) and a live-text "TakaLeaf" wordmark
  above a white card (radius 20, 1 px line border, padding 40, 24 px on phones where the card goes
  edge to edge). Inside: a 24px/800 title, "Hi {name}," (or "Hello,"), 15px/24px body, one forest
  button (radius 14, 15 × 28 px padding, 16px/800 white; a table cell so Outlook draws it), a mint
  note (radius 14) for link lifetimes or a rust-tinted warning, "Button not working?" with the
  raw link, a rule, and a 13px muted line on what to do if it was not you. A 12px muted footer
  names the address and server. Inline styles, tables for layout, system fonts after Inter; a
  `prefers-color-scheme: dark` block for mail apps that support it. Every email has a plain-text
  part with the same words and links.

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

## Link preview (Open Graph)

Shared links show a 1200×630 card (`apps/web/public/og-image.png`, source `brand/social/og-image.svg`,
rendered with `rsvg-convert -w 1200 -h 630`): forest gradient, the leaf mark and wordmark, "Your Money."
in white and "Your Control." in mint (`#9AD7B0`), a two-line description, a "Get started" pill and the
address, and on the right a light balance card (total, income and expense pills, three transactions).
Keep text out of the outer 60 px. When the image changes, bump `?v=` in `index.html` so Facebook, X and
WhatsApp fetch it again. Under 300 KB, or WhatsApp shows no image.
