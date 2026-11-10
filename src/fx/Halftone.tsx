import React, { useLayoutEffect, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";

/**
 * Halftone reveal (reference: "map-route" / "headline" reels): a dark screen opens through a grid of dots that
 * grow out from a point until the scene underneath is fully visible. Put it ABOVE the scene it reveals.
 * Drawn on a 2D canvas each frame (deterministic). Not for clinical photos.
 */
export const HalftoneReveal: React.FC<{
  /** Frames from start of the Sequence to fully open. */
  duration?: number;
  delay?: number;
  color?: string;
  /** Dot pitch in px. */
  pitch?: number;
  /** Origin of the reveal, 0–1 of the frame. */
  origin?: [number, number];
  /** Reverse = close to dots (outro). */
  reverse?: boolean;
}> = ({ duration = 24, delay = 0, color = "#121614", pitch = 30, origin = [0.5, 0.55], reverse = false }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const ref = useRef<HTMLCanvasElement>(null);
  let t = Math.min(1, Math.max(0, (frame - delay) / duration));
  if (reverse) t = 1 - t;
  useLayoutEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, width, height);
    if (t >= 1) return;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, width, height);
    ctx.globalCompositeOperation = "destination-out";
    const ox = origin[0] * width, oy = origin[1] * height;
    const far = Math.hypot(Math.max(ox, width - ox), Math.max(oy, height - oy));
    const full = pitch * 0.75; // radius at which neighbouring dots merge
    for (let y = pitch / 2; y < height + pitch; y += pitch) {
      for (let x = pitch / 2; x < width + pitch; x += pitch) {
        const d = Math.hypot(x - ox, y - oy) / far; // 0 centre → 1 corner
        const k = (t * 1.7 - d * 0.7) / 0.45; // the wave front moves outwards
        const r = Math.max(0, Math.min(1, k)) ** 1.6 * full;
        if (r < 0.6) continue;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, [t, width, height, color, pitch, origin]);
  if (t >= 1) return null;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <canvas ref={ref} width={width} height={height} style={{ width, height }} />
    </AbsoluteFill>
  );
};
