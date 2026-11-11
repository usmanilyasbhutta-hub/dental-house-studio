import React from "react";
import { AbsoluteFill, Easing, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import { evolvePath, getLength, getPointAtLength } from "@remotion/paths";
import { fonts, video } from "../brand";
import type { SketchBrief } from "../brief/schema";
import { SKETCH_INTRO } from "../brief/timing";
import { useTheme, type Theme } from "../theme";
import { DOODLE_SET, type Doodle, type DoodleName, type FillKey } from "../fx/doodles";
import { Sfx } from "../fx/effects";
import { Shell, type QcProps } from "./shared/Shell";

const HAND = "Caveat";
const NOTE = "Patrick Hand";
const AREA = { x: 60, y: 560, w: 960, h: 660 };
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const ease = Easing.bezier(0.4, 0, 0.3, 1);

/** Doodle fill colours by hue name, taken from each theme's harmonised map palette (slot order differs per theme). */
const HUES: Record<Theme["name"], Record<Exclude<FillKey, "white" | "ink">, number>> = {
  brand: { gold: 0, coral: 1, green: 2, blue: 3, pink: 4, yellow: 5 },
  editorial: { coral: 0, green: 1, gold: 2, yellow: 2, blue: 3, pink: 4 },
};
const fillColour = (t: Theme, k: FillKey) => (k === "white" ? "#FFFFFF" : k === "ink" ? t.end.text : t.map[HUES[t.name][k]]);

/** Hand-drawn explainer (reference: "Hand-Drawn Explainer" reel). Paper page, handwritten title, doodles drawn by a pencil. */
export const Sketch: React.FC<{ brief: SketchBrief } & QcProps> = ({ brief, showSafeZones }) => {
  const { fps } = useVideoConfig();
  const t = useTheme();
  const intro = Math.round(SKETCH_INTRO * fps);
  const S = Math.round(brief.seconds_per_scene * fps);
  const paper = t.end.top;
  return (
    <Shell brief={brief} endSeconds={4.5} showSafeZones={showSafeZones} chrome="minimal-light">
      <AbsoluteFill style={{ background: paper }}>
        <svg width={video.width} height={video.height} style={{ position: "absolute", inset: 0, opacity: 0.35, mixBlendMode: "multiply" }}>
          <filter id="sk-paper"><feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="3" seed="5" /><feColorMatrix values="0 0 0 0 0.5  0 0 0 0 0.47  0 0 0 0 0.42  0 0 0 0.18 0" /></filter>
          <rect width="100%" height="100%" filter="url(#sk-paper)" />
        </svg>
      </AbsoluteFill>
      <Title brief={brief} />
      {brief.scenes.map((sc, i) => (
        <Sequence key={i} from={intro + i * S} durationInFrames={i === brief.scenes.length - 1 ? undefined : S}>
          <Scene scene={sc} S={S} last={i === brief.scenes.length - 1} />
          <Sfx name="tick" at={Math.round(S * 0.66)} volume={0.25} />
        </Sequence>
      ))}
      <Footer text={brief.footer} />
    </Shell>
  );
};

/** Wobbly "boiling" line filter: the drawing breathes like real pen on paper. */
const Wobble: React.FC<{ id: string }> = ({ id }) => {
  const frame = useCurrentFrame();
  return (
    <filter id={id} x="-5%" y="-5%" width="110%" height="110%">
      <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="1" seed={Math.floor(frame / 4) % 6} result="n" />
      <feDisplacementMap in="SourceGraphic" in2="n" scale="3.2" />
    </filter>
  );
};

const Title: React.FC<{ brief: SketchBrief }> = ({ brief }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = useTheme();
  const lines = brief.hook.lines;
  const longest = Math.max(...lines.map((l) => l.length));
  const size = longest <= 14 ? 112 : longest <= 18 ? 96 : 80;
  const write = clamp01(frame / (fps * 1.1));
  const under = ease(clamp01((frame - fps * 0.9) / (fps * 0.5)));
  const ul = "M 0 14 C 160 4, 420 20, 620 8";
  const { strokeDasharray, strokeDashoffset } = evolvePath(under, ul);
  const sub = clamp01((frame - fps * 1.2) / (fps * 0.4));
  return (
    <div style={{ position: "absolute", top: 236, left: video.safe.left, right: video.safe.right, textAlign: "center", color: t.end.text }}>
      <div style={{ clipPath: `inset(0 ${(1 - write) * 100}% 0 0)` }}>
        {lines.map((l, i) => (
          <div key={i} style={{ fontFamily: HAND, fontWeight: 700, fontSize: size, lineHeight: 0.95 }}>
            {renderAccent(l, brief.hook.accent, t.end.accent)}
          </div>
        ))}
      </div>
      <svg width="640" height="24" viewBox="0 0 620 24" style={{ display: "block", margin: "6px auto 0" }}>
        <path d={ul} fill="none" stroke={t.end.accent} strokeWidth="6" strokeLinecap="round" strokeDasharray={strokeDasharray} strokeDashoffset={strokeDashoffset} />
      </svg>
      {brief.subheading ? <div style={{ fontFamily: NOTE, fontSize: 40, marginTop: 14, opacity: sub, lineHeight: 1.2 }}>{brief.subheading}</div> : null}
    </div>
  );
};

function renderAccent(line: string, accent: string | undefined, color: string) {
  if (!accent || !line.includes(accent)) return line;
  const [a, b] = line.split(accent);
  return (
    <>
      {a}
      <span style={{ color }}>{accent}</span>
      {b}
    </>
  );
}

type Placed = { doodle: Doodle; cx: number; cy: number; scale: number; rotate: number };

const Scene: React.FC<{ scene: SketchBrief["scenes"][number]; S: number; last: boolean }> = ({ scene, S, last }) => {
  const frame = useCurrentFrame();
  const t = useTheme();
  const ink = t.end.text;
  const placed: Placed[] = scene.draw.map((d) => ({
    doodle: DOODLE_SET[d.doodle as DoodleName] as Doodle,
    cx: AREA.x + (d.x / 100) * AREA.w,
    cy: AREA.y + (d.y / 100) * AREA.h,
    scale: d.size / 300, // size ≈ visible width of the drawing (doodles fill ~75 % of their 400 box)
    rotate: d.rotate,
  }));
  // pen schedule: every stroke of every doodle in order, time ∝ length (+ a minimum), inside [4 %, 55 %] of the scene
  const strokes = placed.flatMap((p, pi) => p.doodle.strokes.map((s, si) => ({ pi, si, len: getLength(s.d) * p.scale + 60 })));
  const total = strokes.reduce((n, s) => n + s.len, 0);
  const w0 = 0.04 * S, w1 = 0.55 * S;
  let acc = 0;
  const timing = strokes.map((s) => {
    const a = w0 + (acc / total) * (w1 - w0);
    acc += s.len;
    return { ...s, a, b: w0 + (acc / total) * (w1 - w0) };
  });
  const fill = ease(clamp01((frame - 0.5 * S) / (0.12 * S)));
  const out = last ? 1 : 1 - clamp01((frame - (S - 9)) / 8);
  // pencil tip: the stroke being drawn right now
  const live = timing.find((s) => frame >= s.a && frame < s.b);
  let tip: { x: number; y: number } | null = null;
  if (live) {
    const p = placed[live.pi];
    const d = p.doodle.strokes[live.si].d;
    const q = getPointAtLength(d, ease((frame - live.a) / (live.b - live.a)) * getLength(d)) ?? { x: 200, y: 200 };
    const r = (p.rotate * Math.PI) / 180;
    const x = (q.x - 200) * p.scale, y = (q.y - 200) * p.scale;
    tip = { x: p.cx + x * Math.cos(r) - y * Math.sin(r), y: p.cy + x * Math.sin(r) + y * Math.cos(r) };
  }
  const tag = scene.tag;
  const tagP = clamp01((frame - 0.58 * S) / (0.08 * S));
  return (
    <AbsoluteFill style={{ opacity: out }}>
      <svg width={video.width} height={video.height} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <Wobble id="sk-wobble" />
        </defs>
        <g filter="url(#sk-wobble)">
          {placed.map((p, pi) => (
            <g key={pi} transform={`translate(${p.cx} ${p.cy}) rotate(${p.rotate}) scale(${p.scale}) translate(-200 -200)`}>
              {/* marker fills sit slightly off the line, like a real colouring */}
              <g transform="translate(5 6)" opacity={fill}>
                {(p.doodle.fills ?? []).map((f, fi) => (
                  <path key={fi} d={f.d} fill={fillColour(t, f.fill)} opacity={f.opacity ?? 0.9} />
                ))}
              </g>
              {p.doodle.strokes.map((s, si) => {
                const tm = timing.find((x) => x.pi === pi && x.si === si)!;
                const k = ease(clamp01((frame - tm.a) / (tm.b - tm.a)));
                if (k <= 0) return null;
                const { strokeDasharray, strokeDashoffset } = evolvePath(k, s.d);
                return (
                  <path key={si} d={s.d} fill="none" stroke={s.accent ? t.end.accent : ink} strokeWidth={s.w ?? 5} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={strokeDasharray} strokeDashoffset={strokeDashoffset} />
                );
              })}
            </g>
          ))}
          {tag && tagP > 0 ? <Tag text={tag.text} x={AREA.x + (tag.x / 100) * AREA.w} y={AREA.y + (tag.y / 100) * AREA.h} p={tagP} color={t.end.accent} /> : null}
        </g>
        {tip ? <Pencil x={tip.x} y={tip.y} ink={ink} /> : null}
      </svg>
      <Caption text={scene.caption} frame={frame} S={S} ink={ink} accent={t.end.accent} />
    </AbsoluteFill>
  );
};

const Tag: React.FC<{ text: string; x: number; y: number; p: number; color: string }> = ({ text, x, y, p, color }) => {
  const w = text.length * 26 + 44, h = 74;
  const box = `M ${x - w / 2} ${y - h / 2 + 3} L ${x + w / 2 + 4} ${y - h / 2} L ${x + w / 2} ${y + h / 2 + 2} L ${x - w / 2 - 3} ${y + h / 2} Z`;
  const { strokeDasharray, strokeDashoffset } = evolvePath(p, box);
  return (
    <g transform={`rotate(-4 ${x} ${y})`}>
      <path d={box} fill="#FFFFFF" fillOpacity={0.85 * p} stroke="#2A2A2A" strokeWidth="4" strokeDasharray={strokeDasharray} strokeDashoffset={strokeDashoffset} />
      <text x={x} y={y + 16} textAnchor="middle" style={{ fontFamily: HAND, fontWeight: 700, fontSize: 52, fill: color, opacity: p }}>{text.toUpperCase()}</text>
    </g>
  );
};

const Pencil: React.FC<{ x: number; y: number; ink: string }> = ({ x, y, ink }) => (
  <g transform={`translate(${x} ${y}) rotate(-38)`}>
    <path d="M 0 0 L 16 -9 L 16 9 Z" fill="#E9C9A0" stroke={ink} strokeWidth="2" />
    <path d="M 0 0 L 6 -3.4 L 6 3.4 Z" fill={ink} />
    <rect x="16" y="-9" width="110" height="18" fill="#F2C14E" stroke={ink} strokeWidth="2" />
    <rect x="126" y="-9" width="16" height="18" fill="#C9C9C9" stroke={ink} strokeWidth="2" />
    <rect x="142" y="-9" width="14" height="18" rx="4" fill="#E58C8A" stroke={ink} strokeWidth="2" />
  </g>
);

const Caption: React.FC<{ text: string; frame: number; S: number; ink: string; accent: string }> = ({ text, frame, S, ink, accent }) => {
  const p = ease(clamp01((frame - 0.45 * S) / (0.12 * S)));
  const hl = ease(clamp01((frame - 0.64 * S) / (0.1 * S)));
  const parts = text.split(/(\*[^*]+\*)/);
  const scribble = "M 2 10 C 40 4, 90 14, 140 6 C 160 4, 175 8, 190 7";
  const { strokeDasharray, strokeDashoffset } = evolvePath(hl, scribble);
  return (
    <div
      style={{
        position: "absolute",
        top: 1250,
        left: video.safe.left + 40,
        width: video.width - video.safe.left - video.safe.right - 80,
        textAlign: "center",
        fontFamily: NOTE,
        fontSize: 52,
        lineHeight: 1.22,
        color: ink,
        opacity: p,
        transform: `translateY(${(1 - p) * 18}px)`,
      }}
    >
      {parts.map((s, i) =>
        s.startsWith("*") ? (
          <span key={i} style={{ position: "relative", color: accent, whiteSpace: "nowrap" }}>
            {s.slice(1, -1)}
            <svg viewBox="0 0 192 16" preserveAspectRatio="none" style={{ position: "absolute", left: -4, right: -4, width: "calc(100% + 8px)", bottom: -10, height: 16 }}>
              <path d={scribble} fill="none" stroke={accent} strokeWidth="5" strokeLinecap="round" strokeDasharray={strokeDasharray} strokeDashoffset={strokeDashoffset} />
            </svg>
          </span>
        ) : (
          <span key={i}>{s}</span>
        ),
      )}
    </div>
  );
};

const Footer: React.FC<{ text?: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = useTheme();
  const p = ease(clamp01((frame - fps * 0.6) / (fps * 0.8)));
  const y = 1500;
  const style: React.CSSProperties = { position: "absolute", top: y + 14, fontFamily: fonts.mono, fontSize: 17, letterSpacing: "0.14em", textTransform: "uppercase", color: t.end.muted, opacity: p };
  return (
    <>
      <div style={{ position: "absolute", top: y, left: 100, width: 840 * p, height: 2, background: t.end.muted, opacity: 0.5 }} />
      <div style={{ position: "absolute", top: y, left: 100, width: 300 * p, height: 2, background: t.end.accent }} />
      {text ? <div style={{ ...style, left: 100 }}>{text}</div> : null}
      <div style={{ ...style, right: video.safe.right }}>Dental House · sketch notes</div>
    </>
  );
};
