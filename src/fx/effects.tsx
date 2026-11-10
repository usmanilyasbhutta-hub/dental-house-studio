/**
 * Dental House effects library. Every effect is plain Remotion code (free, no licensed assets).
 * Use sparingly: one "wow" effect per scene at most. Calm tone: shine, sparkle, glow, highlighter,
 * count-up, draw-on annotations. Contemporary tone may add punch-zoom, shake and glitch.
 * See docs/effects.md for when to use what.
 */
import React from "react";
import { AbsoluteFill, Audio, Easing, Sequence, interpolate, random, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { noise2D } from "@remotion/noise";
import { evolvePath } from "@remotion/paths";
import { makeCircle } from "@remotion/shapes";
import { useTheme } from "../theme";
import { useFx } from "./context";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const easeOut = Easing.bezier(0.22, 1, 0.36, 1);

/* ----------------------------------------------------------------- text */

/** A light glint travelling across text (text only: the band is clipped to the glyphs). */
export const ShineText: React.FC<{ children: string; delay?: number; duration?: number; style?: React.CSSProperties }> = ({
  children,
  delay = 6,
  duration = 24,
  style,
}) => {
  const frame = useCurrentFrame();
  const t = useTheme();
  const x = interpolate(frame, [delay, delay + duration], [-60, 160], clamp);
  return (
    <span style={{ position: "relative", display: "inline-block", ...style }}>
      {children}
      <span
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          color: "transparent",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          backgroundImage: `linear-gradient(105deg, transparent ${x - 18}%, ${t.text} ${x}%, transparent ${x + 18}%)`,
        }}
      >
        {children}
      </span>
    </span>
  );
};

/** Marker-pen highlight drawn behind a word (left → right). */
export const Highlighter: React.FC<{
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  color?: string;
  style?: React.CSSProperties;
}> = ({ children, delay = 4, duration = 14, color, style }) => {
  const frame = useCurrentFrame();
  const t = useTheme();
  const p = interpolate(frame, [delay, delay + duration], [0, 1], { ...clamp, easing: easeOut });
  return (
    <span style={{ position: "relative", display: "inline-block", ...style }}>
      <span
        style={{
          position: "absolute",
          left: "-0.12em",
          right: "-0.12em",
          top: "52%",
          height: "42%",
          background: color ?? t.accent,
          opacity: 0.45,
          transformOrigin: "left",
          transform: `scaleX(${p}) skewX(-8deg)`,
          borderRadius: 4,
        }}
      />
      <span style={{ position: "relative" }}>{children}</span>
    </span>
  );
};

/** Typewriter reveal, with a blinking caret while typing. */
export const Typewriter: React.FC<{ text: string; delay?: number; cps?: number; style?: React.CSSProperties }> = ({
  text,
  delay = 0,
  cps = 22,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const n = Math.max(0, Math.floor(((frame - delay) / fps) * cps));
  const typing = n < text.length;
  return (
    <span style={style}>
      {text.slice(0, n)}
      <span style={{ opacity: typing || Math.floor(frame / 15) % 2 ? 1 : 0 }}>|</span>
    </span>
  );
};

/** Counts a number up (e.g. "1 in 10", "24/7", prices). Keeps width stable with tabular digits. */
export const CountUp: React.FC<{
  to: number;
  from?: number;
  delay?: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  style?: React.CSSProperties;
}> = ({ to, from = 0, delay = 0, duration = 30, decimals = 0, prefix = "", suffix = "", style }) => {
  const frame = useCurrentFrame();
  const v = interpolate(frame, [delay, delay + duration], [from, to], { ...clamp, easing: easeOut });
  return (
    <span style={{ fontVariantNumeric: "tabular-nums", ...style }}>
      {prefix}
      {v.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      {suffix}
    </span>
  );
};

/** Soft pulsing glow on text or an element. */
export const Glow: React.FC<{ children: React.ReactNode; color?: string; strength?: number }> = ({ children, color, strength = 1 }) => {
  const frame = useCurrentFrame();
  const t = useTheme();
  const c = color ?? t.accent;
  const k = (0.6 + 0.4 * Math.sin(frame / 7)) * strength;
  return <span style={{ filter: `drop-shadow(0 0 ${8 * k}px ${c}) drop-shadow(0 0 ${22 * k}px ${c}88)` }}>{children}</span>;
};

/* ------------------------------------------------------------- overlays */

/** Diagonal light sweep across a box (logo, pill, photo). */
export const LightSweep: React.FC<{ delay?: number; duration?: number; opacity?: number }> = ({
  delay = 0,
  duration = 26,
  opacity = 0.55,
}) => {
  const frame = useCurrentFrame();
  const x = interpolate(frame, [delay, delay + duration], [-40, 140], clamp);
  if (frame < delay || frame > delay + duration) return null;
  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        mixBlendMode: "screen",
        background: `linear-gradient(110deg, transparent ${x - 14}%, rgba(255,255,255,${opacity}) ${x}%, transparent ${x + 14}%)`,
      }}
    />
  );
};

/** Twinkling four-point sparkles around a point (percent of the parent box). */
export const Sparkles: React.FC<{
  x?: number;
  y?: number;
  spread?: number;
  count?: number;
  seed?: string;
  color?: string;
  size?: number;
}> = ({ x = 50, y = 50, spread = 40, count = 9, seed = "sp", color, size = 34 }) => {
  const frame = useCurrentFrame();
  const t = useTheme();
  const c = color ?? t.text;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {Array.from({ length: count }, (_, i) => {
        const r = (k: string) => random(`${seed}-${i}-${k}`);
        const start = Math.floor(r("t") * 18);
        const life = 16 + Math.floor(r("l") * 14);
        const local = frame - start;
        const p = interpolate(local, [0, life * 0.4, life], [0, 1, 0], clamp);
        const s = size * (0.45 + r("s") * 0.8) * p;
        return (
          <svg
            key={i}
            viewBox="-10 -10 20 20"
            width={s}
            height={s}
            style={{
              position: "absolute",
              left: `${x + (r("x") - 0.5) * spread}%`,
              top: `${y + (r("y") - 0.5) * spread * 0.6}%`,
              transform: `translate(-50%,-50%) rotate(${local * 3}deg)`,
              opacity: p,
              filter: `drop-shadow(0 0 6px ${c})`,
            }}
          >
            <path d="M0,-10 L2,-2 L10,0 L2,2 L0,10 L-2,2 L-10,0 L-2,-2 Z" fill={c} />
          </svg>
        );
      })}
    </AbsoluteFill>
  );
};

/** Warm drifting light leak (bronze tones), blended softly over footage or backdrop. */
export const LightLeak: React.FC<{ opacity?: number; seed?: string }> = ({ opacity = 0.35, seed = "leak" }) => {
  const frame = useCurrentFrame();
  const t = useTheme();
  const blobs = [0, 1, 2].map((i) => ({
    x: 50 + 45 * noise2D(`${seed}x${i}`, frame / 140, i),
    y: 45 + 40 * noise2D(`${seed}y${i}`, i, frame / 160),
    r: 38 + 12 * noise2D(`${seed}r${i}`, frame / 90, i * 3),
  }));
  return (
    <AbsoluteFill style={{ pointerEvents: "none", mixBlendMode: "screen", opacity }}>
      {blobs.map((b, i) => (
        <AbsoluteFill
          key={i}
          style={{ background: `radial-gradient(circle at ${b.x}% ${b.y}%, ${i % 2 ? t.accent : t.rule}aa 0%, transparent ${b.r}%)` }}
        />
      ))}
    </AbsoluteFill>
  );
};

/** Brand-colour confetti (celebrations, milestones). Seeded, so every render is identical. */
export const Confetti: React.FC<{ count?: number; seed?: string }> = ({ count = 70, seed = "cf" }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const t = useTheme();
  const palette = [t.accent, t.rule, t.text, t.muted];
  return (
    <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden" }}>
      {Array.from({ length: count }, (_, i) => {
        const r = (k: string) => random(`${seed}-${i}-${k}`);
        const fall = (frame - r("d") * 20) * (6 + r("v") * 7);
        if (fall < -40) return null;
        const x = r("x") * width + Math.sin((frame + r("p") * 60) / 9) * 30;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: fall - 40,
              width: 12 + r("w") * 10,
              height: 6 + r("h") * 8,
              background: palette[i % palette.length],
              borderRadius: 2,
              transform: `rotate(${frame * (4 + r("rot") * 8)}deg)`,
              opacity: fall > height ? 0 : 0.9,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------- camera */

/** Quick punch-in zoom (emphasis on a key word). Wraps its children. */
export const PunchZoom: React.FC<{ children: React.ReactNode; amount?: number; at?: number; origin?: string }> = ({
  children,
  amount = 0.08,
  at = 0,
  origin = "50% 40%",
}) => {
  const frame = useCurrentFrame();
  const s = 1 + amount * interpolate(frame, [at, at + 4, at + 16], [0, 1, 0.65], { ...clamp, easing: easeOut });
  return <AbsoluteFill style={{ transform: `scale(${s})`, transformOrigin: origin }}>{children}</AbsoluteFill>;
};

/** Short camera shake (contemporary tone only). */
export const Shake: React.FC<{ children: React.ReactNode; at?: number; frames?: number; px?: number }> = ({
  children,
  at = 0,
  frames = 8,
  px = 10,
}) => {
  const frame = useCurrentFrame();
  const k = interpolate(frame, [at, at + frames], [1, 0], clamp) * (frame >= at ? 1 : 0);
  const dx = noise2D("shx", frame / 2, 0) * px * k;
  const dy = noise2D("shy", 0, frame / 2) * px * k;
  return <AbsoluteFill style={{ transform: `translate(${dx}px, ${dy}px)` }}>{children}</AbsoluteFill>;
};

/** RGB-split glitch for a few frames (contemporary offers only; never in education). */
export const Glitch: React.FC<{ children: React.ReactNode; at?: number; frames?: number }> = ({ children, at = 0, frames = 6 }) => {
  const frame = useCurrentFrame();
  const on = frame >= at && frame < at + frames;
  if (!on) return <>{children}</>;
  const o = 6 + random(`g${frame}`) * 10;
  const slice = random(`gs${frame}`) * 70 + 10;
  return (
    <AbsoluteFill>
      <AbsoluteFill
        style={{
          transform: `translateX(${-o}px)`,
          mixBlendMode: "screen",
          filter: "drop-shadow(0 0 0 #f00) saturate(3) hue-rotate(-30deg)",
          opacity: 0.8,
        }}
      >
        {children}
      </AbsoluteFill>
      <AbsoluteFill
        style={{ transform: `translateX(${o}px)`, mixBlendMode: "screen", filter: "hue-rotate(160deg) saturate(3)", opacity: 0.8 }}
      >
        {children}
      </AbsoluteFill>
      <AbsoluteFill style={{ clipPath: `inset(${slice}% 0 ${100 - slice - 6}% 0)`, transform: `translateX(${o * 2}px)` }}>
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* ---------------------------------------------------------- annotations */

/** Hand-drawn style circle that draws itself around something (x, y, r in px within the parent). */
export const DrawCircle: React.FC<{
  x: number;
  y: number;
  r: number;
  delay?: number;
  duration?: number;
  color?: string;
  width?: number;
}> = ({ x, y, r, delay = 0, duration = 18, color, width = 6 }) => {
  const frame = useCurrentFrame();
  const t = useTheme();
  const { path } = makeCircle({ radius: r });
  const p = interpolate(frame, [delay, delay + duration], [0, 1], { ...clamp, easing: easeOut });
  const { strokeDasharray, strokeDashoffset } = evolvePath(p, path);
  return (
    <svg
      style={{ position: "absolute", left: x - r - width, top: y - r - width, overflow: "visible", pointerEvents: "none" }}
      width={2 * (r + width)}
      height={2 * (r + width)}
    >
      <path
        d={path}
        transform={`translate(${width},${width}) rotate(-80 ${r} ${r})`}
        fill="none"
        stroke={color ?? t.accent}
        strokeWidth={width}
        strokeLinecap="round"
        strokeDasharray={strokeDasharray}
        strokeDashoffset={strokeDashoffset}
      />
    </svg>
  );
};

/** Arrow that draws itself from (x1,y1) to (x2,y2) with a slight curve; head appears at the end. */
export const DrawArrow: React.FC<{
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  bend?: number;
  delay?: number;
  duration?: number;
  color?: string;
  width?: number;
}> = ({ x1, y1, x2, y2, bend = 0.2, delay = 0, duration = 16, color, width = 6 }) => {
  const frame = useCurrentFrame();
  const t = useTheme();
  const c = color ?? t.accent;
  const mx = (x1 + x2) / 2 - (y2 - y1) * bend,
    my = (y1 + y2) / 2 + (x2 - x1) * bend;
  const path = `M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`;
  const p = interpolate(frame, [delay, delay + duration], [0, 1], { ...clamp, easing: easeOut });
  const { strokeDasharray, strokeDashoffset } = evolvePath(p, path);
  const ang = (Math.atan2(y2 - my, x2 - mx) * 180) / Math.PI;
  return (
    <svg style={{ position: "absolute", inset: 0, overflow: "visible", pointerEvents: "none" }} width="100%" height="100%">
      <path
        d={path}
        fill="none"
        stroke={c}
        strokeWidth={width}
        strokeLinecap="round"
        strokeDasharray={strokeDasharray}
        strokeDashoffset={strokeDashoffset}
      />
      <path
        d="M -22 -13 L 0 0 L -22 13"
        transform={`translate(${x2} ${y2}) rotate(${ang})`}
        fill="none"
        stroke={c}
        strokeWidth={width}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={p > 0.95 ? 1 : 0}
      />
    </svg>
  );
};

/** Underline that draws itself under a block (place inside a relative container). */
export const DrawUnderline: React.FC<{ width: number; delay?: number; duration?: number; color?: string; thickness?: number }> = ({
  width,
  delay = 0,
  duration = 14,
  color,
  thickness = 7,
}) => {
  const frame = useCurrentFrame();
  const t = useTheme();
  const path = `M 0 ${thickness} C ${width * 0.3} 0, ${width * 0.7} ${thickness * 2}, ${width} ${thickness * 0.6}`;
  const p = interpolate(frame, [delay, delay + duration], [0, 1], { ...clamp, easing: easeOut });
  const { strokeDasharray, strokeDashoffset } = evolvePath(p, path);
  return (
    <svg width={width} height={thickness * 3} style={{ overflow: "visible", display: "block" }}>
      <path
        d={path}
        fill="none"
        stroke={color ?? t.accent}
        strokeWidth={thickness}
        strokeLinecap="round"
        strokeDasharray={strokeDasharray}
        strokeDashoffset={strokeDashoffset}
      />
    </svg>
  );
};

/* ----------------------------------------------------------------- sound */

export const SFX = ["whoosh", "pop", "tick", "shimmer", "thud", "swoosh-out", "click", "printer", "tear"] as const;
export type SfxName = (typeof SFX)[number];

/** Plays a generated UI sound (public/sfx, made by scripts/make_sfx.py) when the brief enables sfx. */
export const Sfx: React.FC<{ name: SfxName; at?: number; volume?: number; force?: boolean }> = ({ name, at = 0, volume = 0.6, force }) => {
  const fx = useFx();
  if (fx.sfx === "none" && !force) return null;
  return (
    <Sequence from={at} durationInFrames={45} layout="none">
      <Audio src={staticFile(`sfx/${name}.wav`)} volume={volume} />
    </Sequence>
  );
};
