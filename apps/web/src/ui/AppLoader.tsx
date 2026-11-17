import { LEAF_GRADIENTS, LEAF_PATHS, LEAF_TRANSFORM, LEAF_VIEWBOX, LOADER_MOTION } from "@takaleaf/shared";
import { useId, useState, type CSSProperties } from "react";
import { loaderElapsed } from "./loaderClock";

type Piece = keyof typeof LOADER_MOTION.pieces;
const ORDER: Piece[] = ["left", "stem", "right", "body"];

/** One piece of the mark in its own layer, coloured from the theme's --tl-leaf-* variables. */
function PieceSvg({ piece, size, id }: { piece: Piece; size: number; id: string }) {
  const gradient = piece === "body" ? LEAF_GRADIENTS.body : LEAF_GRADIENTS.left;
  const stops =
    piece === "body"
      ? [
          ["0", "--tl-leaf-b0"],
          ["0.45", "--tl-leaf-b1"],
          ["1", "--tl-leaf-b2"],
        ]
      : [
          ["0", "--tl-leaf-l0"],
          ["1", "--tl-leaf-l1"],
        ];
  const fill = piece === "stem" ? { style: { fill: "var(--tl-leaf-stem)" } } : piece === "right" ? { style: { fill: "var(--tl-leaf-right)" } } : { fill: `url(#${id})` };
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox={LEAF_VIEWBOX}>
      {piece === "left" || piece === "body" ? (
        <defs>
          <linearGradient id={id} gradientUnits="userSpaceOnUse" x1={gradient[0]} y1={gradient[1]} x2={gradient[2]} y2={gradient[3]}>
            {stops.map(([offset, variable]) => (
              <stop key={offset} offset={offset} style={{ stopColor: `var(${variable})` }} />
            ))}
          </linearGradient>
        </defs>
      ) : null}
      <g transform={LEAF_TRANSFORM}>
        <path d={LEAF_PATHS[piece]} {...fill} />
      </g>
    </svg>
  );
}

/** In-page loaders stay invisible this long, so a quick load shows nothing instead of a flash. */
export const LOADER_SHOW_AFTER_MS = 350;

/**
 * The TakaLeaf loader (design option A, "Leaf assembly"): the four pieces of the mark float
 * apart in an isometric view, then turn face-on and lock together, over a shadow that tightens
 * as they meet. Full size while the app starts; small inside pages. With reduced motion the mark
 * stays assembled and only fades gently.
 *
 * Full-size loaders share one clock (loaderClock.ts), so start-up reads as one continuous loader.
 * Small ones fade in after LOADER_SHOW_AFTER_MS and are first seen with the mark assembled, not
 * as scattered pieces.
 */
export function AppLoader({
  label = "Loading…",
  size = 150,
  bar = false,
  className = "",
}: {
  label?: string;
  size?: number;
  /** The sliding bar under the label, for the full-screen start-up loader. */
  bar?: boolean;
  className?: string;
}) {
  const id = useId().replace(/:/g, "");
  const scale = size / LOADER_MOTION.box;
  const large = size >= 100;
  // Where in the cycle this loader starts. Large: the shared clock. Small: the moment it becomes
  // visible lands on "together", so the first thing seen is the TakaLeaf mark.
  const [offset] = useState(() =>
    large ? loaderElapsed() : LOADER_MOTION.together * LOADER_MOTION.cycleMs - LOADER_SHOW_AFTER_MS,
  );
  const sync = { animationDelay: `${-offset}ms` };
  return (
    <div role="status" aria-live="polite" className={`tl-loader flex flex-col items-center ${large ? "" : "tl-loader-delayed"} ${className}`}>
      <div className="tl-loader-scene" style={{ width: size, height: size, ...sync }}>
        {ORDER.map((piece) => {
          const p = LOADER_MOTION.pieces[piece];
          const style = {
            "--x": `${p.x * scale}px`,
            "--y": `${p.y * scale}px`,
            "--z": `${p.z * scale}px`,
            animationDelay: `${p.delayMs - offset}ms`,
          } as CSSProperties;
          return (
            <div key={piece} className="tl-loader-piece" style={style}>
              <PieceSvg piece={piece} size={size} id={`${id}${piece}`} />
            </div>
          );
        })}
      </div>
      <div className="tl-loader-shadow" style={{ width: size * 0.8, height: Math.max(6, Math.floor(size * 0.15)), marginTop: size * 0.12, ...sync }} />
      {/* Large: the same box as the static copy in index.html (.tl-boot-label), so nothing moves at the hand-off. */}
      <p className={`m-0 font-bold ${large ? "mt-8 text-body text-[var(--tl-text)]" : "mt-2 text-sm tracking-tight text-[var(--tl-muted)]"}`}>{label}</p>
      {bar ? (
        <div aria-hidden="true" className="tl-boot-bar">
          <div className="tl-loader-bar" style={sync} />
        </div>
      ) : null}
    </div>
  );
}
