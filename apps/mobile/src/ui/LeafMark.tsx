import { LEAF_PATHS, LEAF_TRANSFORM, LEAF_VIEWBOX } from "@takaleaf/shared";
import Svg, { G, Path } from "react-native-svg";

/** The leaf mark, flat: brand colours on light, mint on the forest band. */
export function LeafMark({ size = 32, onDark = false }: { size?: number; onDark?: boolean }) {
  const fills = onDark ? { left: "#E4F6EA", stem: "#86CDA0", right: "#9AD7B0", body: "#FFFFFF" } : { left: "#83CFA2", stem: "#0B5A33", right: "#22A06B", body: "#0F7A44" };
  return (
    <Svg width={size} height={size} viewBox={LEAF_VIEWBOX}>
      <G transform={LEAF_TRANSFORM}>
        <Path d={LEAF_PATHS.left} fill={fills.left} />
        <Path d={LEAF_PATHS.stem} fill={fills.stem} />
        <Path d={LEAF_PATHS.right} fill={fills.right} />
        <Path d={LEAF_PATHS.body} fill={fills.body} />
      </G>
    </Svg>
  );
}
