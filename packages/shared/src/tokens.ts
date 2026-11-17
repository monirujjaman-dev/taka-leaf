/**
 * Brand colours for both apps, from DESIGN.md. The web app reads the same values as CSS variables
 * in apps/web/src/index.css; the Android app reads them from here.
 */
export const palette = {
  forest: "#0F7A44",
  leaf: "#22A06B",
  sage: "#83CFA2",
  mint: "#E7F5EC",
  ink: "#0B3B24",
  slate: "#55637A",
  line: "#D1DFD8",
  night: "#0A1F15",
  nightSurface: "#11301F",
  expense: "#A8412A",
  expenseDark: "#F0997F",
  amber: "#C98A1B",
} as const;

export interface ThemeColors {
  background: string;
  surface: string;
  glass: string;
  border: string;
  text: string;
  muted: string;
  primary: string;
  /** Text on a solid forest button or the balance card. */
  onPrimary: string;
  chip: string;
  income: string;
  expense: string;
  track: string;
  tabActive: string;
  /** Android press ripple on glass, rows and chips: the primary colour, lightly. */
  ripple: string;
  /** Android press ripple on a solid primary button. */
  rippleOnPrimary: string;
  /** The forest hero surface (balance card, budget card, sign-in band, chosen segment): forest in both themes. */
  hero: string;
  /** Figures and titles on the hero. */
  onHero: string;
  /** Labels on the hero ("Net balance", "Assets"): mint, 4.8:1 on forest. */
  onHeroMuted: string;
  /** Text on a solid expense (danger) button. */
  onExpense: string;
  /** The 10% expense tint behind an error note. */
  expenseTint: string;
  /** A budget at 80% or more (progress bars only). */
  budgetNear: string;
}

export const themes: Record<"light" | "dark", ThemeColors> = {
  light: {
    background: palette.mint,
    surface: "#FFFFFF",
    glass: "rgba(255,255,255,0.66)",
    border: palette.line,
    text: palette.ink,
    muted: palette.slate,
    primary: palette.forest,
    onPrimary: "#FFFFFF",
    chip: palette.mint,
    income: palette.forest,
    expense: palette.expense,
    track: "rgba(11,59,36,0.08)",
    tabActive: palette.forest,
    ripple: "rgba(15,122,68,0.14)",
    rippleOnPrimary: "rgba(255,255,255,0.24)",
    hero: palette.forest,
    onHero: "#FFFFFF",
    onHeroMuted: palette.mint,
    onExpense: "#FFFFFF",
    expenseTint: "rgba(168,65,42,0.1)",
    budgetNear: palette.amber,
  },
  dark: {
    background: palette.night,
    surface: palette.nightSurface,
    glass: "rgba(255,255,255,0.08)",
    border: "rgba(255,255,255,0.14)",
    text: "#E7F5EC",
    muted: "#A9BDB3",
    primary: palette.sage,
    onPrimary: palette.ink,
    chip: "rgba(131,207,162,0.14)",
    income: palette.sage,
    expense: palette.expenseDark,
    track: "rgba(255,255,255,0.1)",
    tabActive: palette.sage,
    ripple: "rgba(131,207,162,0.18)",
    rippleOnPrimary: "rgba(11,59,36,0.18)",
    hero: palette.forest,
    onHero: "#FFFFFF",
    onHeroMuted: palette.mint,
    onExpense: palette.night,
    expenseTint: "rgba(240,153,127,0.12)",
    budgetNear: palette.amber,
  },
};

/** Corner radii and sizes shared by both apps (px / dp). */
export const shape = { card: 20, hero: 26, tile: 18, control: 14, row: 56, touch: 44 } as const;
