import { Easing, interpolate, spring } from "remotion";

export const ease = Easing.bezier(0.22, 1, 0.36, 1); // easeOutQuint-ish
export const easeInOut = Easing.bezier(0.65, 0, 0.35, 1);

/** 0→1 over `dur` frames starting at `start`, eased. */
export const prog = (frame: number, start: number, dur: number, e = ease) =>
  interpolate(frame, [start, start + dur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: e });

export const pop = (frame: number, fps: number, delay = 0) =>
  spring({ frame: frame - delay, fps, config: { damping: 200, stiffness: 120, mass: 0.8 } });

/** Fade a scene in and out at its edges (frames are scene-local). */
export const sceneFade = (frame: number, dur: number, edge = 8, enabled = true) =>
  !enabled
    ? 1
    : interpolate(frame, [0, edge, dur - edge, dur], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
