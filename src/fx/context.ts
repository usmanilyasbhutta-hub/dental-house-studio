import { createContext, useContext } from "react";

/** Transitions that render reliably headless (plain CSS; no WebGL). */
export const TRANSITIONS = ["none", "fade", "blur-fade", "slide", "wipe", "iris", "clock-wipe", "flip", "push"] as const;
export type TransitionName = (typeof TRANSITIONS)[number];

export interface FxSettings {
  transition: TransitionName;
  /** Overlap between scenes, in frames. */
  transitionFrames: number;
  /** Sound effects: none, or subtle UI sounds on reveals. */
  sfx: "none" | "subtle";
}

export const defaultFx: FxSettings = { transition: "fade", transitionFrames: 10, sfx: "none" };
export const FxContext = createContext<FxSettings>(defaultFx);
export const useFx = () => useContext(FxContext);
