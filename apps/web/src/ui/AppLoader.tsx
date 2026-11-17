import { LEAF_GRADIENTS, LEAF_PATHS, LEAF_TRANSFORM, LEAF_VIEWBOX, LOADER_MOTION } from "@takaleaf/shared";
import { useId, type CSSProperties } from "react";

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

/**
 * The TakaLeaf loader (design option A, "Leaf assembly"): the four pieces of the mark float
 * apart in an isometric view, then turn face-on and lock together, over a shadow that tightens
 * as they meet. Full size while the app starts; small inside pages. With reduced motion the mark
 * stays assembled and only fades gently.
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
  return (
    <div role="status" aria-live="polite" className={`tl-loader flex flex-col items-center ${className}`}>
      <div className="tl-loader-scene" style={{ width: size, height: size }}>
        {ORDER.map((piece) => {
          const p = LOADER_MOTION.pieces[piece];
          const style = {
            "--x": `${p.x * scale}px`,
            "--y": `${p.y * scale}px`,
            "--z": `${p.z * scale}px`,
            animationDelay: `${p.delayMs}ms`,
          } as CSSProperties;
          return (
            <div key={piece} className="tl-loader-piece" style={style}>
              <PieceSvg piece={piece} size={size} id={`${id}${piece}`} />
            </div>
          );
        })}
      </div>
      <div className="tl-loader-shadow" style={{ width: size * 0.8, height: Math.max(6, size * 0.15), marginTop: size * 0.12 }} />
      <p className={`m-0 font-bold tracking-tight ${large ? "mt-7 text-body text-[var(--tl-text)]" : "mt-2 text-sm text-[var(--tl-muted)]"}`}>{label}</p>
      {bar ? (
        <div aria-hidden="true" className="mt-3 h-1 w-[120px] overflow-hidden rounded-[2px] bg-[var(--tl-track)]">
          <div className="tl-loader-bar h-1 w-2/5 rounded-[2px] bg-[var(--tl-primary)]" />
        </div>
      ) : null}
    </div>
  );
}
