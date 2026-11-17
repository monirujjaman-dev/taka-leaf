import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Pressable } from "react-native";

/** Motion values from DESIGN.md (the web uses the same). */
export const MOTION = {
  /** Buttons, keys, chips and the Add button press to this at once… */
  pressScale: 0.97,
  /** …and release over this. */
  releaseMs: 160,
  /** The segmented control's chosen pill slides this long. */
  slideMs: 200,
  /** Confident arrivals: decelerate, no bounce. */
  easeOut: Easing.bezier(0.22, 1, 0.36, 1),
} as const;

/** The phone's "Remove animations" setting. Ripples still show; nothing moves. */
export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduce);
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduce);
    return () => subscription.remove();
  }, []);
  return reduce;
}

/** A Pressable whose style can carry Animated values (the press scale). */
export const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Press feedback for solid controls: shrink to 0.97 the moment a finger lands, ease back on release.
 * Spread the handlers on the Pressable and put `scale` in its transform. With reduce motion it stays still.
 */
export function usePressScale() {
  const reduce = useReduceMotion();
  const scale = useRef(new Animated.Value(1)).current;
  return {
    scale,
    onPressIn: () => {
      if (!reduce) scale.setValue(MOTION.pressScale);
    },
    onPressOut: () => {
      Animated.timing(scale, { toValue: 1, duration: MOTION.releaseMs, easing: MOTION.easeOut, useNativeDriver: true }).start();
    },
  };
}
