import { themes, type ThemeColors } from "@takaleaf/shared";
import { useColorScheme } from "react-native";

/** The phone's light or dark setting picks the palette, as on the web. */
export function useColors(): ThemeColors {
  return themes[useColorScheme() === "dark" ? "dark" : "light"];
}
