import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { evolvePath } from "@remotion/paths";
import { video } from "../brand";
import type { BlueprintBrief } from "../brief/schema";
import { ThemeContext, useTheme } from "../theme";
import { SUBJECTS, type Dim, type Stroke, type Subject } from "../fx/blueprint-subjects";
import { Sfx } from "../fx/effects";
import { KineticHeadline } from "./shared/Headline";
import { Shell, type QcProps } from "./shared/Shell";
import { fonts } from "../brand";

const INK = "#EAF1FF";
const PAPER = { centre: "#2D5BB5", edge: "#0F2558" };
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const ease = Easing.bezier(0.45, 0, 0.3, 1);
const monoText = (size: number, extra: React.SVGProps<SVGTextElement> = {}) => ({
  fontFamily: fonts.mono,
  fontSize: size,
  fill: INK,
  letterSpacing: "0.08em",
  ...extra,
});

/** Blueprint drawing (reference: blueprint-style reel), driven by the frame number. */
export const Blueprint: React.FC<{ brief: BlueprintBrief } & QcProps> = ({ brief, showSafeZones }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const theme = useTheme();
  const T = brief.seconds * fps;
  const u = frame / T; // drawing progress 0..1 (fractions in blueprint-subjects.ts)
  const sub: Subject = SUBJECTS[brief.subject];
  const seat = sub.move ? ease(clamp01((u - sub.move.seat[0]) / (sub.move.seat[1] - sub.move.seat[0]))) : 1;
  const lift = sub.move ? sub.move.lift * (1 - seat) : 0;
  const push = 1 + 0.05 * ease(clamp01(u / 1)); // slow push-in
  const paperIn = clamp01(frame / 12);
  return (
    <Shell brief={brief} endSeconds={4.5} showSafeZones={showSafeZones} chrome="minimal">
      <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 48%, ${PAPER.centre}, ${PAPER.edge} 78%)`, opacity: paperIn }}>
        <svg width={video.width} height={video.height} viewBox={`0 0 ${video.width} ${video.height}`}>
          <defs>
            <pattern id="bp-minor" width="24" height="24" patternUnits="userSpaceOnUse">
              <path d="M 24 0 L 0 0 0 24" fill="none" stroke={INK} strokeWidth="0.6" opacity="0.07" />
            </pattern>
            <pattern id="bp-major" width="120" height="120" patternUnits="userSpaceOnUse">
              <rect width="120" height="120" fill="url(#bp-minor)" />
              <path d="M 120 0 L 0 0 0 120" fill="none" stroke={INK} strokeWidth="1" opacity="0.13" />
            </pattern>
            <pattern id="bp-hatch" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="16" stroke={INK} strokeWidth="1.2" opacity="0.45" />
            </pattern>
            <filter id="bp-glow" x="-10%" y="-10%" width="120%" height="120%">
              <feGaussianBlur stdDeviation="2.2" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="bp-grain">
              <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="9" />
              <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.05 0" />
            </filter>
            <marker id="bp-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" orient="auto-start-reverse">
              <path d="M 0 1 L 9 5 L 0 9" fill="none" stroke={INK} strokeWidth="1.5" />
            </marker>
            {sub.hatch ? (
              <clipPath id="bp-hatch-clip">
                <path d={sub.hatch.clip} clipRule="evenodd" />
              </clipPath>
            ) : null}
          </defs>

          {/* paper: grid sweeps in from the top, grain, sheet border */}
          <rect x="0" y="0" width={video.width} height={video.height * clamp01(u / 0.08)} fill="url(#bp-major)" />
          <rect width={video.width} height={video.height} filter="url(#bp-grain)" />
          <rect x="34" y="34" width={video.width - 68} height={video.height - 68} fill="none" stroke={INK} strokeWidth="1.2" opacity={0.35 * paperIn} />

          <g transform={`translate(540 1000) scale(${push}) translate(-540 -980)`} filter="url(#bp-glow)">
            {sub.hatch ? <Hatch h={sub.hatch} u={u} /> : null}
            {sub.strokes.map((s, i) => (
              <StrokePath key={i} s={s} u={u} dy={s.group === "move" ? -lift : 0} />
            ))}
            {brief.dimensions && brief.subject === "implant"
              ? sub.dims.map((d, i) => <Dimension key={i} d={d} u={u} text={brief.dimensions![d.key]} />)
              : null}
            {brief.labels ? sub.labels.map((l, i) => <Leader key={i} text={l.text} at={l.at} y={l.y} p={clamp01((u - l.t) / 0.04)} dy={l.group === "move" ? -lift : 0} />) : null}
            {sub.scan ? <Scan u={u} range={sub.scan} /> : null}
          </g>

          <Note lines={brief.note} u={u} fps={fps} T={T} />
          <TitleBlock figure={brief.figure ?? sub.figure} p={clamp01((u - 0.04) / 0.08)} />
        </svg>
      </AbsoluteFill>

      <div style={{ position: "absolute", left: video.safe.left + 30, top: 250 }}>
        <ThemeContext.Provider value={{ ...theme, accent: "#BFD4FF", rule: INK }}>
          <KineticHeadline lines={brief.hook.lines} accent={brief.hook.accent} width={820} max={96} delay={8} />
        </ThemeContext.Provider>
      </div>

      {brief.labels ? sub.labels.map((l, i) => <Sfx key={i} name="tick" at={Math.round(l.t * T)} volume={0.25} />) : null}
      {sub.move ? <Sfx name="thud" at={Math.round(sub.move.seat[1] * T) - 2} volume={0.4} /> : null}
    </Shell>
  );
};

const StrokePath: React.FC<{ s: Stroke; u: number; dy: number }> = ({ s, u, dy }) => {
  const p = ease(clamp01((u - s.t[0]) / (s.t[1] - s.t[0])));
  if (p <= 0) return null;
  const common = { fill: "none", stroke: INK, strokeWidth: s.w ?? 2.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (s.dash) {
    // dashed (hidden/centre) lines: wipe down instead of tracing, so the dash pattern stays put
    const [y0, y1] = s.wipe ?? [0, video.height];
    const id = `w${s.d.length}-${y0}`;
    return (
      <g transform={`translate(0 ${dy})`}>
        <clipPath id={id}>
          <rect x="0" y={y0 - 4} width={video.width} height={(y1 - y0 + 8) * p} />
        </clipPath>
        <path d={s.d} {...common} strokeDasharray={s.w && s.w < 1.5 ? "22 6 4 6" : "10 8"} clipPath={`url(#${id})`} opacity={0.85} />
      </g>
    );
  }
  const { strokeDasharray, strokeDashoffset } = evolvePath(p, s.d);
  return <path d={s.d} {...common} strokeDasharray={strokeDasharray} strokeDashoffset={strokeDashoffset} transform={`translate(0 ${dy})`} />;
};

const Hatch: React.FC<{ h: NonNullable<Subject["hatch"]>; u: number }> = ({ h, u }) => {
  const p = ease(clamp01((u - h.t[0]) / (h.t[1] - h.t[0])));
  if (p <= 0) return null;
  const [x, y, w, hh] = h.box;
  return (
    <g clipPath="url(#bp-hatch-clip)">
      <rect x={x} y={y} width={w * p} height={hh} fill="url(#bp-hatch)" />
    </g>
  );
};

/** Dimension line with extension lines, arrowheads and a value. side: −1 = left/up, +1 = right/down. */
const Dimension: React.FC<{ d: Dim; u: number; text: string }> = ({ d, u, text }) => {
  const p = ease(clamp01((u - d.t[0]) / (d.t[1] - d.t[0])));
  if (p <= 0) return null;
  const vertical = d.a[0] === d.b[0];
  const off = (vertical ? 56 : 40) * d.side;
  const A = vertical ? [d.a[0] + off, d.a[1]] : [d.a[0], d.a[1] + off];
  const B = vertical ? [d.b[0] + off, d.b[1]] : [d.b[0], d.b[1] + off];
  const mid = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
  const half = [(B[0] - A[0]) / 2, (B[1] - A[1]) / 2];
  const ext = (q: number[], o: number[]) => `M ${q[0]} ${q[1]} L ${o[0] + (vertical ? 10 * d.side : 0)} ${o[1] + (vertical ? 0 : 10 * d.side)}`;
  const tp = clamp01((p - 0.6) / 0.4);
  return (
    <g opacity={0.95}>
      <path d={`${ext(d.a, A)} ${ext(d.b, B)}`} stroke={INK} strokeWidth="1.2" opacity={Math.min(1, p * 2)} />
      <line
        x1={mid[0] - half[0] * p}
        y1={mid[1] - half[1] * p}
        x2={mid[0] + half[0] * p}
        y2={mid[1] + half[1] * p}
        stroke={INK}
        strokeWidth="1.6"
        markerStart={p > 0.95 ? "url(#bp-arrow)" : undefined}
        markerEnd={p > 0.95 ? "url(#bp-arrow)" : undefined}
      />
      <text
        x={vertical ? mid[0] - 14 * -d.side : mid[0]}
        y={vertical ? mid[1] : mid[1] + 28 * d.side}
        textAnchor="middle"
        dominantBaseline="middle"
        transform={vertical ? `rotate(-90 ${mid[0] - 14 * -d.side} ${mid[1]})` : undefined}
        opacity={tp}
        {...monoText(22)}
      >
        {text}
      </text>
    </g>
  );
};

const Leader: React.FC<{ text: string; at: [number, number]; y: number; p: number; dy: number }> = ({ text, at, y, p, dy }) => {
  if (p <= 0) return null;
  const elbow = 770;
  const d = `M ${at[0]} ${at[1] + dy} L ${elbow - 30} ${y + dy} L ${elbow} ${y + dy}`;
  const { strokeDasharray, strokeDashoffset } = evolvePath(p, d);
  return (
    <g>
      <circle cx={at[0]} cy={at[1] + dy} r={4} fill={INK} opacity={p} />
      <path d={d} fill="none" stroke={INK} strokeWidth="1.4" strokeDasharray={strokeDasharray} strokeDashoffset={strokeDashoffset} />
      <text x={elbow + 10} y={y + dy} dominantBaseline="middle" opacity={clamp01((p - 0.5) * 2)} {...monoText(22, { fontWeight: 600 })}>
        {text.toUpperCase()}
      </text>
    </g>
  );
};

const Scan: React.FC<{ u: number; range: [number, number] }> = ({ u, range }) => {
  const p = clamp01((u - range[0]) / (range[1] - range[0]));
  if (p <= 0 || p >= 1) return null;
  const y = interpolate(p, [0, 1], [620, 1340]);
  return (
    <g>
      <rect x={290} y={y - 40} width={500} height={40} fill={INK} opacity={0.08} />
      <line x1={270} x2={810} y1={y} y2={y} stroke={INK} strokeWidth={2} opacity={0.8} />
    </g>
  );
};

/** NOTE box: lines type in one character at a time. */
const Note: React.FC<{ lines: string[]; u: number; fps: number; T: number }> = ({ lines, u, fps, T }) => {
  if (!lines.length) return null;
  const x = 90, y = 1432, w = 400; // bottom-left, beside the title block (never over the drawing)
  const box = clamp01((u - 0.6) / 0.03);
  if (box <= 0) return null;
  const start = 0.63 * T;
  let budget = Math.max(0, Math.floor(((u * T - start) / fps) * 28)); // 28 characters per second
  const shown = lines.map((l) => {
    const n = Math.min(l.length, budget);
    budget -= n;
    return l.slice(0, n);
  });
  const h = 46 + lines.length * 26;
  return (
    <g opacity={box}>
      <rect x={x} y={y} width={w} height={h} fill={PAPER.edge} fillOpacity={0.5} stroke={INK} strokeWidth="1.2" />
      <text x={x + 14} y={y + 28} {...monoText(17, { fontWeight: 600 })}>NOTE / 1</text>
      {shown.map((l, i) => (
        <text key={i} x={x + 14} y={y + 58 + i * 26} {...monoText(16, { letterSpacing: "0.02em" })}>
          {l}
        </text>
      ))}
    </g>
  );
};

const TitleBlock: React.FC<{ figure: string; p: number }> = ({ figure, p }) => {
  if (p <= 0) return null;
  const x = 560, y = 1432, w = 380, h = 104;
  return (
    <g opacity={p}>
      <rect x={x} y={y} width={w} height={h} fill="none" stroke={INK} strokeWidth="1.4" />
      <line x1={x} x2={x + w} y1={y + 50} y2={y + 50} stroke={INK} strokeWidth="1" />
      <line x1={x + 200} x2={x + 200} y1={y + 50} y2={y + h} stroke={INK} strokeWidth="1" />
      <text x={x + 16} y={y + 33} {...monoText(20, { fontWeight: 600 })}>{figure.slice(0, Math.ceil(figure.length * p))}</text>
      <text x={x + 16} y={y + 84} {...monoText(15)}>NOT TO SCALE</text>
      <text x={x + 216} y={y + 84} {...monoText(15)}>ILLUSTRATION</text>
    </g>
  );
};
