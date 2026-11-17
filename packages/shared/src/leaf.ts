/**
 * The leaf mark's geometry, shared by the web and Android loaders (and anything else that needs
 * the mark as shapes rather than an image). Draw inside viewBox 0 0 120 120 with LEAF_TRANSFORM.
 */
export const LEAF_VIEWBOX = "0 0 120 120";
export const LEAF_TRANSFORM = "translate(-11.28 -10.58) scale(0.176)";

export const LEAF_PATHS = {
  left: "M95 305 C98 215 180 112 285 110 C335 109 375 118 405 128 C370 158 345 208 318 250 C290 290 235 303 95 305Z",
  stem: "M448 305 C385 345 366 410 362 480 C358 560 366 650 378 720 C420 650 446 560 448 470Z",
  right: "M715 82 C650 200 540 262 448 305 C520 310 600 305 650 270 C700 230 715 150 715 82Z",
  body: "M715 82 C640 95 560 100 500 115 C420 135 340 215 300 310 C265 400 268 520 300 610 C320 665 350 700 378 720 C366 650 358 560 362 480 C366 410 385 345 448 305 C540 262 650 200 715 82Z",
} as const;

/** Gradient line for the body (x1 y1 x2 y2) and the left leaf, in the transformed space. */
export const LEAF_GRADIENTS = { body: [700, 90, 330, 720], left: [95, 305, 430, 130] } as const;

export interface LeafColors {
  /** Body gradient: start, middle (45%), end. */
  body: [string, string, string];
  /** Left leaf gradient: start, end. */
  left: [string, string];
  stem: string;
  right: string;
  /** The extruded sides of the 3D loader. */
  depth: string;
}

export const LEAF_COLORS: Record<"light" | "dark", LeafColors> = {
  light: { body: ["#86D36B", "#2FA24F", "#0F7A44"], left: ["#0F7A44", "#45B25A"], stem: "#0B6A3A", right: "#0E8048", depth: "#0B5E35" },
  dark: { body: ["#FFFFFF", "#DDF3E4", "#B5E2C4"], left: ["#A9DDBB", "#E4F6EA"], stem: "#86CDA0", right: "#9AD7B0", depth: "#0F5C36" },
};

/** The loader's motion (design option E "Extruded leaf"): one sway cycle and its tilt range. */
export const LOADER_MOTION = { cycleMs: 2600, tiltX: [16, 8], turnY: [-38, 38], layers: 14 } as const;
