import { LEAF_COLORS, LEAF_GRADIENTS, LEAF_PATHS, LEAF_TRANSFORM, LEAF_VIEWBOX, LOADER_MOTION } from "@takaleaf/shared";
import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, useColorScheme, View } from "react-native";
import Svg, { Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Stop } from "react-native-svg";
import { useReduceMotion } from "./motion";
import { useColors } from "./theme";

type Piece = keyof typeof LOADER_MOTION.pieces;
const ORDER: Piece[] = ["left", "stem", "right", "body"];
const EASE = Easing.bezier(0.65, 0, 0.35, 1);
const rad = (deg: number) => (deg * Math.PI) / 180;

/**
 * Where a piece sits in the scene's own plane when the mark is apart. React Native has no
 * translateZ inside a rotated view, so the lift z is turned into the in-plane shift that looks the
 * same once the scene is rotated by rotateX(tilt) rotateZ(turn): straight up the screen by z·sin(tilt).
 */
export function apartOffset(piece: Piece, scale: number): { x: number; y: number } {
  const { x, y, z } = LOADER_MOTION.pieces[piece];
  const tilt = rad(LOADER_MOTION.tiltX);
  const turn = rad(LOADER_MOTION.turnZ);
  // The plane shift b (along the plane's own y, before the turn) that shows as -z·sin(tilt) on screen.
  const b = -z * Math.tan(tilt);
  return { x: (x - b * Math.sin(-turn)) * scale, y: (y + b * Math.cos(-turn)) * scale };
}

/** The four moments of one cycle, as fractions of LOADER_MOTION.cycleMs. */
function cycle(progress: Animated.Value) {
  const { cycleMs, apart, together, holdUntil } = LOADER_MOTION;
  return Animated.loop(
    Animated.sequence([
      Animated.delay(apart * cycleMs),
      Animated.timing(progress, { toValue: 1, duration: (together - apart) * cycleMs, easing: EASE, useNativeDriver: true }),
      Animated.delay((holdUntil - together) * cycleMs),
      Animated.timing(progress, { toValue: 0, duration: (1 - holdUntil) * cycleMs, easing: EASE, useNativeDriver: true }),
    ]),
  );
}

function PieceSvg({ piece, size, scheme }: { piece: Piece; size: number; scheme: "light" | "dark" }) {
  const leaf = LEAF_COLORS[scheme];
  const gradient = piece === "body" ? LEAF_GRADIENTS.body : LEAF_GRADIENTS.left;
  const fill = piece === "stem" ? leaf.stem : piece === "right" ? leaf.right : `url(#${piece})`;
  return (
    <Svg width={size} height={size} viewBox={LEAF_VIEWBOX}>
      {piece === "left" || piece === "body" ? (
        <Defs>
          <LinearGradient id={piece} gradientUnits="userSpaceOnUse" x1={gradient[0]} y1={gradient[1]} x2={gradient[2]} y2={gradient[3]}>
            {(piece === "body"
              ? [
                  ["0", leaf.body[0]],
                  ["0.45", leaf.body[1]],
                  ["1", leaf.body[2]],
                ]
              : [
                  ["0", leaf.left[0]],
                  ["1", leaf.left[1]],
                ]
            ).map(([offset, color]) => (
              <Stop key={offset} offset={offset} stopColor={color} />
            ))}
          </LinearGradient>
        </Defs>
      ) : null}
      <G transform={LEAF_TRANSFORM}>
        <Path d={LEAF_PATHS[piece]} fill={fill} />
      </G>
    </Svg>
  );
}

/**
 * The TakaLeaf loader (design option A, "Leaf assembly"), as on the web: the four pieces of the
 * mark float apart in an isometric view, then turn face-on and lock together, over a shadow that
 * tightens as they meet. With the system's reduce-motion setting the mark stays assembled and fades.
 */
export function AppLoader({ label = "Loading…", size = 150 }: { label?: string; size?: number }) {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const c = useColors();
  const reduce = useReduceMotion();
  // 0 = apart and tilted, 1 = together and face-on.
  const progress = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;
  const scale = size / LOADER_MOTION.box;

  useEffect(() => {
    if (reduce) {
      progress.setValue(1);
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(fade, { toValue: 0.55, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(fade, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
      );
      pulse.start();
      return () => pulse.stop();
    }
    progress.setValue(0);
    fade.setValue(1);
    const animation = cycle(progress);
    animation.start();
    return () => animation.stop();
  }, [progress, fade, reduce]);

  const rotateX = progress.interpolate({ inputRange: [0, 1], outputRange: [`${LOADER_MOTION.tiltX}deg`, "0deg"] });
  const rotateZ = progress.interpolate({ inputRange: [0, 1], outputRange: [`${LOADER_MOTION.turnZ}deg`, "0deg"] });
  const shadowScale = progress.interpolate({ inputRange: [0, 1], outputRange: [1.25, 0.8] });
  const shadowOpacity = progress.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });
  const large = size >= 100;

  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={label} style={styles.wrap}>
      <Animated.View style={{ width: size, height: size, opacity: fade, transform: [{ perspective: 900 }, { rotateX }, { rotateZ }] }}>
        {ORDER.map((piece) => {
          const apart = apartOffset(piece, scale);
          return (
            <Animated.View
              key={piece}
              style={[
                StyleSheet.absoluteFill,
                {
                  transform: [
                    { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [apart.x, 0] }) },
                    { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [apart.y, 0] }) },
                  ],
                },
              ]}
            >
              <PieceSvg piece={piece} size={size} scheme={scheme} />
            </Animated.View>
          );
        })}
      </Animated.View>
      <Animated.View style={{ marginTop: size * 0.12, opacity: shadowOpacity, transform: [{ scale: shadowScale }] }}>
        <Svg width={size * 0.8} height={Math.max(6, size * 0.15)}>
          <Defs>
            <RadialGradient id="shadow" cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="0" stopColor={scheme === "dark" ? "#000000" : "#0B3B24"} stopOpacity={scheme === "dark" ? 0.6 : 0.35} />
              <Stop offset="1" stopColor={scheme === "dark" ? "#000000" : "#0B3B24"} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Ellipse cx="50%" cy="50%" rx="50%" ry="50%" fill="url(#shadow)" />
        </Svg>
      </Animated.View>
      <Text style={[styles.label, { color: large ? c.text : c.muted, fontSize: large ? 15 : 13, marginTop: large ? 28 : 8 }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center" },
  label: { fontWeight: "700", letterSpacing: -0.2 },
});
