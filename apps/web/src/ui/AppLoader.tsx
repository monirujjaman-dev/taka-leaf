import { LEAF_GRADIENTS, LEAF_PATHS, LEAF_TRANSFORM, LEAF_VIEWBOX, LOADER_MOTION } from "@takaleaf/shared";
import { useId } from "react";

const SHAPES = [LEAF_PATHS.left, LEAF_PATHS.stem, LEAF_PATHS.right, LEAF_PATHS.body];

/** The leaf mark in brand colours; the colours come from CSS variables, so it follows the theme. */
function LeafMark({ size }: { size: number }) {
  const id = useId().replace(/:/g, "");
  const [bx1, by1, bx2, by2] = LEAF_GRADIENTS.body;
  const [lx1, ly1, lx2, ly2] = LEAF_GRADIENTS.left;
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox={LEAF_VIEWBOX}>
      <defs>
        <linearGradient id={`${id}b`} gradientUnits="userSpaceOnUse" x1={bx1} y1={by1} x2={bx2} y2={by2}>
          <stop offset="0" style={{ stopColor: "var(--tl-leaf-b0)" }} />
          <stop offset="0.45" style={{ stopColor: "var(--tl-leaf-b1)" }} />
          <stop offset="1" style={{ stopColor: "var(--tl-leaf-b2)" }} />
        </linearGradient>
        <linearGradient id={`${id}l`} gradientUnits="userSpaceOnUse" x1={lx1} y1={ly1} x2={lx2} y2={ly2}>
          <stop offset="0" style={{ stopColor: "var(--tl-leaf-l0)" }} />
          <stop offset="1" style={{ stopColor: "var(--tl-leaf-l1)" }} />
        </linearGradient>
      </defs>
      <g transform={LEAF_TRANSFORM}>
        <path d={LEAF_PATHS.left} fill={`url(#${id}l)`} />
        <path d={LEAF_PATHS.stem} style={{ fill: "var(--tl-leaf-stem)" }} />
        <path d={LEAF_PATHS.right} style={{ fill: "var(--tl-leaf-right)" }} />
        <path d={LEAF_PATHS.body} fill={`url(#${id}b)`} />
      </g>
    </svg>
  );
}

/** One slice of the extrusion: the whole mark in the darker depth colour. */
function DepthLayer({ size }: { size: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox={LEAF_VIEWBOX}>
      <g transform={LEAF_TRANSFORM} style={{ fill: "var(--tl-leaf-depth)" }}>
        {SHAPES.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
    </svg>
  );
}

/**
 * The TakaLeaf loader (design option E, "Extruded leaf"): the mark as a solid badge that sways
 * and casts a shadow. Full size while the app starts; small inside pages. With reduced motion it
 * holds still at an angle and only fades gently.
 */
export function AppLoader({
  label = "Loading…",
  size = 130,
  bar = false,
  className = "",
}: {
  label?: string;
  size?: number;
  /** The sliding bar under the label, for the full-screen start-up loader. */
  bar?: boolean;
  className?: string;
}) {
  const step = Math.max(0.5, size / 130);
  return (
    <div role="status" aria-live="polite" className={`tl-loader flex flex-col items-center ${className}`}>
      <div className="tl-loader-solid" style={{ width: size, height: size }}>
        {Array.from({ length: LOADER_MOTION.layers }, (_, i) => (
          <div key={i} style={{ transform: `translateZ(${-(i + 1) * step}px)` }}>
            <DepthLayer size={size} />
          </div>
        ))}
        <div style={{ transform: "translateZ(1px)" }}>
          <LeafMark size={size} />
        </div>
      </div>
      <div className="tl-loader-shadow" style={{ width: size * 0.9, height: Math.max(8, size * 0.14), marginTop: size * 0.2 }} />
      <p className={`m-0 font-bold tracking-tight text-[var(--tl-text)] ${size >= 100 ? "mt-8 text-[15px]" : "mt-2 text-sm text-[var(--tl-muted)]"}`}>
        {label}
      </p>
      {bar ? (
        <div aria-hidden="true" className="mt-3 h-1 w-[120px] overflow-hidden rounded-[2px] bg-[var(--tl-track)]">
          <div className="tl-loader-bar h-1 w-2/5 rounded-[2px] bg-[var(--tl-primary)]" />
        </div>
      ) : null}
    </div>
  );
}
