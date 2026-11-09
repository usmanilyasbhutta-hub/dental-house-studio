import { createContext, useContext } from "react";
import { colors } from "./brand";

/**
 * Visual families (decided Nov 2026, see docs/style-profile.md §6):
 * - brand: slate/bronze, the master look (logo colours). Promos, offers, cases.
 * - editorial: cream + deep green. Doctor-led education.
 * Black/mint neon is retired.
 */
export type ThemeName = "brand" | "editorial";

export interface Theme {
  name: ThemeName;
  bgTop: string; // body backdrop gradient
  bgBottom: string;
  text: string; // main type on the body backdrop
  accent: string; // serif accent words, numerals, labels
  rule: string; // bars, rules, progress
  muted: string; // small print, crop marks
  stripe: string; // thin bar under the rule bar
  end: { top: string; bottom: string; text: string; accent: string; muted: string; pill: string; pillText: string };
}

export const themes: Record<ThemeName, Theme> = {
  brand: {
    name: "brand",
    bgTop: colors.slate,
    bgBottom: colors.slateDeep,
    text: colors.white,
    accent: colors.bronzeLight,
    rule: colors.bronze,
    muted: colors.mist,
    stripe: colors.slate,
    end: { top: colors.white, bottom: colors.mist, text: colors.slate, accent: colors.bronze, muted: colors.bronzeDark, pill: colors.slate, pillText: colors.white },
  },
  editorial: {
    name: "editorial",
    bgTop: "#2B3D35",
    bgBottom: "#1D2A24",
    text: "#F3F1E6",
    accent: "#D8A48F",
    rule: "#D8A48F",
    muted: "#C9C3B6",
    stripe: "#F3F1E6",
    end: { top: "#F3F1E6", bottom: "#E4DED0", text: "#24352E", accent: "#B4775F", muted: "#4A5A52", pill: "#24352E", pillText: "#F3F1E6" },
  },
};

export const ThemeContext = createContext<Theme>(themes.brand);
export const useTheme = () => useContext(ThemeContext);
