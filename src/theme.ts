import { createContext, useContext } from "react";
import { colors } from "./brand";

/**
 * Visual families (decided Nov 2026, see docs/style-profile.md §6):
 * - brand: slate/bronze, the master look (logo colours). Promos, offers, cases.
 * - editorial: cream + deep green. Doctor-led education.
 * - clinic: white/bone with slate type and bronze accents. Patient-information pieces (owner, 14 Nov 2026: "Background should be white or whitish").
 * Black/mint neon is retired.
 */
export type ThemeName = "brand" | "editorial" | "clinic";

export interface Theme {
  name: ThemeName;
  bgTop: string; // body backdrop gradient
  bgBottom: string;
  text: string; // main type on the body backdrop
  accent: string; // serif accent words, numerals, labels
  rule: string; // bars, rules, progress
  muted: string; // small print, crop marks
  stripe: string; // thin bar under the rule bar
  /** Translucent zone colours for anatomy maps (harmonised with the theme). */
  map: [string, string, string, string, string, string];
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
    map: ["#D9A866", "#E08E7B", "#7FB38F", "#6F8FC9", "#C487B3", "#E8C35A"],
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
    map: ["#D8A48F", "#9DB8A6", "#E3C27A", "#9AA9C2", "#C9A2B4", "#B9C98F"],
    end: { top: "#F3F1E6", bottom: "#E4DED0", text: "#24352E", accent: "#B4775F", muted: "#4A5A52", pill: "#24352E", pillText: "#F3F1E6" },
  },
  clinic: {
    name: "clinic",
    bgTop: "#FBFAF7",
    bgBottom: "#EEEBE4",
    text: colors.slate,
    accent: colors.bronze,
    rule: colors.bronze,
    muted: "#7D837F",
    stripe: colors.mist,
    map: ["#C08A4A", "#C9705E", "#5E9A72", "#5B7DB8", "#A86E99", "#C9A23E"],
    end: { top: colors.white, bottom: colors.mist, text: colors.slate, accent: colors.bronze, muted: colors.bronzeDark, pill: colors.slate, pillText: colors.white },
  },
};

/** Light themes need dark shading instead of the dark vignette. */
export const isLight = (t: Theme) => t.name === "clinic";

export const ThemeContext = createContext<Theme>(themes.brand);
export const useTheme = () => useContext(ThemeContext);
