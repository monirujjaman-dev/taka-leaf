import { LEAF_COLORS, LEAF_GRADIENTS, LEAF_PATHS, LEAF_TRANSFORM, LEAF_VIEWBOX, LOADER_MOTION } from "@takaleaf/shared";
import { useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, useColorScheme, View } from "react-native";
import Svg, { Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Stop } from "react-native-svg";
import { useColors } from "./theme";

const SHAPES = [LEAF_PATHS.left, LEAF_PATHS.stem, LEAF_PATHS.right, LEAF_PATHS.body];
const EASE = Easing.bezier(0.45, 0, 0.55, 1);
const HALF = LOADER_MOTION.cycleMs / 2;
const rad = (deg: number) => (deg * Math.PI) / 180;

function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduce);
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduce);
    return () => subscription.remove();
  }, []);
  return reduce;
}

/**
 * The TakaLeaf loader (design option E, "Extruded leaf"), as on the web. React Native has no CSS
 * 3D layering, so the 14 depth slices are shifted by the projection of the current tilt
 * (x = depth·sin(turn), y = depth·sin(tilt)) while the face turns with perspective.
 */
export function AppLoader({ label = "Loading…", size = 130 }: { label?: string; size?: number }) {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const leaf = LEAF_COLORS[scheme];
  const c = useColors();
  const reduce = useReduceMotion();
  const progress = useRef(new Animated.Value(0)).current;
  const step = Math.max(0.5, size / 130);
  const [tiltA, tiltB] = LOADER_MOTION.tiltX;
  const [turnA, turnB] = LOADER_MOTION.turnY;

  useEffect(() => {
    progress.setValue(0);
    const animation = reduce
      ? Animated.loop(
          Animated.sequence([
            Animated.timing(progress, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
            Animated.timing(progress, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          ]),
        )
      : Animated.loop(
          Animated.sequence([
            Animated.timing(progress, { toValue: 1, duration: HALF, easing: EASE, useNativeDriver: true }),
            Animated.timing(progress, { toValue: 0, duration: HALF, easing: EASE, useNativeDriver: true }),
          ]),
        );
    animation.start();
    return () => animation.stop();
  }, [progress, reduce]);

  // Reduced motion: a still pose at an angle that only fades gently.
  const turn = reduce ? -24 : null;
  const tilt = reduce ? 12 : null;
  const rotateY = turn === null ? progress.interpolate({ inputRange: [0, 1], outputRange: [`${turnA}deg`, `${turnB}deg`] }) : `${turn}deg`;
  const rotateX = tilt === null ? progress.interpolate({ inputRange: [0, 1], outputRange: [`${tiltA}deg`, `${tiltB}deg`] }) : `${tilt}deg`;
  const opacity = reduce ? progress.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }) : 1;

  const layers = useMemo(
    () =>
      Array.from({ length: LOADER_MOTION.layers }, (_, index) => {
        const depth = (LOADER_MOTION.layers - index) * step;
        const at = (turnDeg: number, tiltDeg: number) => ({ x: -depth * Math.sin(rad(turnDeg)), y: depth * Math.sin(rad(tiltDeg)) });
        if (turn !== null && tilt !== null) {
          const p = at(turn, tilt);
          return { key: index, translateX: p.x as number | Animated.AnimatedInterpolation<number>, translateY: p.y as number | Animated.AnimatedInterpolation<number> };
        }
        const a = at(turnA, tiltA);
        const b = at(turnB, tiltB);
        return {
          key: index,
          translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [a.x, b.x] }),
          translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [a.y, b.y] }),
        };
      }),
    [progress, step, turn, tilt, turnA, turnB, tiltA, tiltB],
  );
  const shadowShift = reduce ? 0 : progress.interpolate({ inputRange: [0, 1], outputRange: [size * 0.1, -size * 0.1] });

  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={label} style={styles.wrap}>
      <Animated.View style={{ width: size, height: size, opacity, transform: [{ perspective: 700 }, { rotateX }, { rotateY }] }}>
        {layers.map((layer) => (
          <Animated.View key={layer.key} style={[StyleSheet.absoluteFill, { transform: [{ translateX: layer.translateX }, { translateY: layer.translateY }] }]}>
            <Svg width={size} height={size} viewBox={LEAF_VIEWBOX}>
              <G transform={LEAF_TRANSFORM} fill={leaf.depth}>
                {SHAPES.map((d) => (
                  <Path key={d} d={d} />
                ))}
              </G>
            </Svg>
          </Animated.View>
        ))}
        <View style={StyleSheet.absoluteFill}>
          <Svg width={size} height={size} viewBox={LEAF_VIEWBOX}>
            <Defs>
              <LinearGradient id="b" gradientUnits="userSpaceOnUse" x1={LEAF_GRADIENTS.body[0]} y1={LEAF_GRADIENTS.body[1]} x2={LEAF_GRADIENTS.body[2]} y2={LEAF_GRADIENTS.body[3]}>
                <Stop offset="0" stopColor={leaf.body[0]} />
                <Stop offset="0.45" stopColor={leaf.body[1]} />
                <Stop offset="1" stopColor={leaf.body[2]} />
              </LinearGradient>
              <LinearGradient id="l" gradientUnits="userSpaceOnUse" x1={LEAF_GRADIENTS.left[0]} y1={LEAF_GRADIENTS.left[1]} x2={LEAF_GRADIENTS.left[2]} y2={LEAF_GRADIENTS.left[3]}>
                <Stop offset="0" stopColor={leaf.left[0]} />
                <Stop offset="1" stopColor={leaf.left[1]} />
              </LinearGradient>
            </Defs>
            <G transform={LEAF_TRANSFORM}>
              <Path d={LEAF_PATHS.left} fill="url(#l)" />
              <Path d={LEAF_PATHS.stem} fill={leaf.stem} />
              <Path d={LEAF_PATHS.right} fill={leaf.right} />
              <Path d={LEAF_PATHS.body} fill="url(#b)" />
            </G>
          </Svg>
        </View>
      </Animated.View>
      <Animated.View style={{ marginTop: size * 0.2, transform: [{ translateX: shadowShift }] }}>
        <Svg width={size * 0.9} height={Math.max(8, size * 0.14)}>
          <Defs>
            <RadialGradient id="s" cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="0" stopColor={scheme === "dark" ? "#000000" : "#0B3B24"} stopOpacity={scheme === "dark" ? 0.6 : 0.35} />
              <Stop offset="1" stopColor={scheme === "dark" ? "#000000" : "#0B3B24"} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Ellipse cx="50%" cy="50%" rx="50%" ry="50%" fill="url(#s)" />
        </Svg>
      </Animated.View>
      <Text style={[styles.label, { color: size >= 100 ? c.text : c.muted, fontSize: size >= 100 ? 15 : 13, marginTop: size >= 100 ? 32 : 8 }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center" },
  label: { fontWeight: "700", letterSpacing: -0.2 },
});
