import React from "react";
import { AbsoluteFill, Easing, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import { evolvePath, getLength, getPointAtLength } from "@remotion/paths";
import { fonts, video } from "../brand";
import type { SketchBrief } from "../brief/schema";
import { SKETCH_INTRO } from "../brief/timing";
import { useTheme, type Theme } from "../theme";
import { DOODLE_SET, type Doodle, type DoodleName, type FillKey } from "../fx/doodles";
import { Sfx } from "../fx/effects";
import { MEDIUM, type Medium, type MediumName } from "../fx/media";
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
const fillColour = (t: Theme, k: FillKey, m?: Medium) => m?.palette?.[k] ?? (k === "white" ? "#FFFFFF" : k === "ink" ? t.end.text : t.map[HUES[t.name][k]]);

/** Hand-drawn explainer (reference: "Hand-Drawn Explainer" reel). Paper page, handwritten title, doodles drawn by a pencil. */
export const Sketch: React.FC<{ brief: SketchBrief } & QcProps> = ({ brief, showSafeZones }) => {
  const { fps } = useVideoConfig();
  const t = useTheme();
  const intro = Math.round(SKETCH_INTRO * fps);
  const S = Math.round(brief.seconds_per_scene * fps);
  const m = MEDIUM[brief.style as MediumName];
  const paper = m.paper(t);
  const light = paper.light !== false;
  return (
    <Shell brief={brief} endSeconds={4.5} showSafeZones={showSafeZones} chrome={light ? "minimal-light" : "minimal"}>
      <Paper m={m} />
      <Title brief={brief} m={m} />
      {brief.scenes.map((sc, i) => (
        <Sequence key={i} from={intro + i * S} durationInFrames={i === brief.scenes.length - 1 ? undefined : S}>
          <Scene scene={sc} S={S} last={i === brief.scenes.length - 1} m={m} />
          <Sfx name="tick" at={Math.round(S * 0.66)} volume={0.25} />
        </Sequence>
      ))}
      <Footer text={brief.footer} m={m} />
    </Shell>
  );
};

/** Page: colour, fibre/grain texture; chalkboard adds smudges and a frame. */
const Paper: React.FC<{ m: Medium }> = ({ m }) => {
  const t = useTheme();
  const p = m.paper(t);
  const [r, g, b] = p.tint;
  const board = p.light === false;
  return (
    <AbsoluteFill style={{ background: p.bg }}>
      {board ? (
        <AbsoluteFill
          style={{
            background:
              "radial-gradient(ellipse at 30% 35%, rgba(255,255,255,0.07), transparent 45%), radial-gradient(ellipse at 72% 70%, rgba(255,255,255,0.05), transparent 50%)",
            boxShadow: "inset 0 0 0 26px #6E5137, inset 0 0 0 30px #4E3925, inset 0 0 120px rgba(0,0,0,0.45)",
          }}
        />
      ) : null}
      <svg width={video.width} height={video.height} style={{ position: "absolute", inset: 0, mixBlendMode: board ? "screen" : "multiply" }}>
        <filter id="md-paper">
          <feTurbulence type="fractalNoise" baseFrequency={p.freq} numOctaves={p.octaves} seed="5" />
          <feColorMatrix values={`0 0 0 0 ${r}  0 0 0 0 ${g}  0 0 0 0 ${b}  0 0 0 ${p.strength} 0`} />
        </filter>
        <rect width="100%" height="100%" filter="url(#md-paper)" />
      </svg>
    </AbsoluteFill>
  );
};

/** Filters for one medium: line (wobble, chalk/crayon grain, ink bleed) and the colour layer. */
const MediumDefs: React.FC<{ m: Medium }> = ({ m }) => {
  const frame = useCurrentFrame();
  const seed = m.line.boil ? Math.floor(frame / 4) % 6 : 1;
  const thr = 0.75 - m.line.grain * 0.4;
  return (
    <>
      <filter id="md-line" x="-10%" y="-10%" width="120%" height="120%">
        <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="1" seed={seed} result="n" />
        <feDisplacementMap in="SourceGraphic" in2="n" scale={m.line.wobble} result="d" />
        {m.line.grain > 0 ? (
          <>
            <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="3" result="g" />
            <feColorMatrix in="g" type="matrix" values={`0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -6 0 0 0 ${thr * 6}`} result="ga" />
            <feComposite in="d" in2="ga" operator="in" result="d2" />
          </>
        ) : null}
        {m.line.bleed > 0 ? <feGaussianBlur stdDeviation={m.line.bleed} /> : null}
      </filter>
      {m.fill.mode === "wash" ? (
        <filter id="md-fill" x="-15%" y="-15%" width="130%" height="130%">
          <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="2" seed="2" result="n" />
          <feColorMatrix in="SourceGraphic" type="saturate" values="1.5" result="sat" />
          <feDisplacementMap in="sat" in2="n" scale="18" result="d" />
          <feGaussianBlur in="d" stdDeviation="1.4" result="w" />
          <feGaussianBlur in="w" stdDeviation="7" result="wb" />
          {/* pigment pools at the edge of a wash: edges stay strong, the middle lightens */}
          <feComposite in="w" in2="wb" operator="arithmetic" k2="1.55" k3="-0.62" result="rim" />
          <feTurbulence type="fractalNoise" baseFrequency="0.55" numOctaves="2" seed="8" result="g" />
          <feColorMatrix in="g" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -1 0 0 0 0.85" result="ga" />
          <feComposite in="rim" in2="ga" operator="arithmetic" k1="-0.6" k2="1" />
        </filter>
      ) : m.fill.mode === "grain" ? (
        <filter id="md-fill" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9 0.07" numOctaves="2" seed="4" result="g" />
          <feColorMatrix in="g" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -7 0 0 0 4.1" result="ga" />
          <feComposite in="SourceGraphic" in2="ga" operator="in" result="c" />
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="1" seed="2" result="n" />
          <feDisplacementMap in="c" in2="n" scale="3" />
        </filter>
      ) : m.fill.mode === "tone" ? (
        <filter id="md-fill" x="-10%" y="-10%" width="120%" height="120%">
          <feColorMatrix type="matrix" values="0.25 0.25 0.25 0 -0.05  0.25 0.25 0.25 0 -0.05  0.25 0.25 0.25 0 -0.05  0 0 0 1 0" result="grey" />
          <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="2" seed="6" result="n" />
          <feDisplacementMap in="grey" in2="n" scale="8" result="d" />
          <feGaussianBlur in="d" stdDeviation="1.2" />
        </filter>
      ) : m.fill.mode === "clay" || m.fill.mode === "gloss" ? (
        <filter id="md-fill" x="-15%" y="-15%" width="130%" height="130%">
          <feGaussianBlur in="SourceAlpha" stdDeviation={m.fill.mode === "clay" ? 9 : 4} result="b" />
          <feSpecularLighting in="b" surfaceScale={m.fill.mode === "clay" ? 7 : 4} specularConstant={m.fill.mode === "clay" ? 0.8 : 1.3} specularExponent={m.fill.mode === "clay" ? 14 : 38} lightingColor="#ffffff" result="s">
            <fePointLight x="80" y="-60" z="260" />
          </feSpecularLighting>
          <feComposite in="s" in2="SourceAlpha" operator="in" result="sp" />
          <feGaussianBlur in="SourceAlpha" stdDeviation="10" result="inner" />
          <feComposite in="SourceAlpha" in2="inner" operator="arithmetic" k2="1" k3="-1" result="rim" />
          <feFlood floodColor="#000" floodOpacity="0.18" />
          <feComposite in2="rim" operator="in" result="rimc" />
          <feComposite in="SourceGraphic" in2="sp" operator="arithmetic" k2="1" k3={m.fill.mode === "clay" ? 0.55 : 0.85} result="lit" />
          <feMerge result="m">
            <feMergeNode in="lit" />
            <feMergeNode in="rimc" />
          </feMerge>
          <feDropShadow dx="6" dy="12" stdDeviation={m.fill.mode === "clay" ? 9 : 5} floodColor="#3A2F55" floodOpacity="0.25" />
        </filter>
      ) : m.fill.mode === "woodblock" ? (
        <filter id="md-fill" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.006 0.22" numOctaves="2" seed="11" result="g" />
          <feColorMatrix in="g" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.9 0 0 0 -0.35" result="ga" />
          <feComposite in="SourceGraphic" in2="ga" operator="arithmetic" k2="1" k1="-0.35" result="grain" />
          <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="1" seed="2" result="n" />
          <feDisplacementMap in="grain" in2="n" scale="2" />
        </filter>
      ) : m.fill.mode === "halftone" || m.fill.mode === "flat" ? (
        <filter id="md-fill" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="1" seed="2" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale={m.line.wobble} />
        </filter>
      ) : m.fill.mode === "paper" ? (
        <filter id="md-fill" x="-15%" y="-15%" width="130%" height="130%">
          <feTurbulence type="fractalNoise" baseFrequency="0.07" numOctaves="2" seed="9" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="6" result="torn" />
          <feDropShadow in="torn" dx="5" dy="8" stdDeviation="4" floodColor="#000" floodOpacity="0.32" />
        </filter>
      ) : (
        <filter id="md-fill" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="1" seed={seed} result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale={m.line.wobble} result="d" />
          {m.fill.mode === "hatch" ? (
            <>
              <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="7" result="g" />
              <feColorMatrix in="g" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -6 0 0 0 3.6" result="ga" />
              <feComposite in="d" in2="ga" operator="in" />
            </>
          ) : null}
        </filter>
      )}
      <pattern id="md-dots" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(15)">
        <circle cx="5" cy="5" r="3.4" fill="#fff" />
      </pattern>
      <mask id="md-dot-mask" maskUnits="userSpaceOnUse" x="-200" y="-200" width="800" height="800">
        <rect x="-200" y="-200" width="800" height="800" fill="url(#md-dots)" />
      </mask>
      <linearGradient id="md-bokashi" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fff" stopOpacity="1" />
        <stop offset="1" stopColor="#fff" stopOpacity="0.55" />
      </linearGradient>
      <mask id="md-bokashi-mask" maskUnits="userSpaceOnUse" x="-200" y="-200" width="800" height="800">
        <rect x="0" y="0" width="400" height="400" fill="url(#md-bokashi)" />
      </mask>
      <pattern id="md-hatch" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(38)">
        <rect width="4.5" height="9" fill="#fff" />
      </pattern>
      <mask id="md-hatch-mask" maskUnits="userSpaceOnUse" x="-200" y="-200" width="800" height="800">
        <rect x="-200" y="-200" width="800" height="800" fill="url(#md-hatch)" />
      </mask>
    </>
  );
};

const Title: React.FC<{ brief: SketchBrief; m: Medium }> = ({ brief, m }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ink = m.ink(useTheme());
  const lines = brief.hook.lines;
  const longest = Math.max(...lines.map((l) => l.length));
  const size = longest <= 14 ? 112 : longest <= 18 ? 96 : 80;
  const write = clamp01(frame / (fps * 1.1));
  const under = ease(clamp01((frame - fps * 0.9) / (fps * 0.5)));
  const ul = "M 0 14 C 160 4, 420 20, 620 8";
  const { strokeDasharray, strokeDashoffset } = evolvePath(under, ul);
  const sub = clamp01((frame - fps * 1.2) / (fps * 0.4));
  return (
    <div style={{ position: "absolute", top: 236, left: video.safe.left, right: video.safe.right, textAlign: "center", color: ink.text }}>
      <div style={{ clipPath: `inset(0 ${(1 - write) * 100}% 0 0)` }}>
        {lines.map((l, i) => (
          <div key={i} style={{ fontFamily: HAND, fontWeight: 700, fontSize: size, lineHeight: 0.95 }}>
            {renderAccent(l, brief.hook.accent, ink.accent)}
          </div>
        ))}
      </div>
      <svg width="640" height="24" viewBox="0 0 620 24" style={{ display: "block", margin: "6px auto 0" }}>
        <path d={ul} fill="none" stroke={ink.accent} strokeWidth="6" strokeLinecap="round" strokeDasharray={strokeDasharray} strokeDashoffset={strokeDashoffset} />
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

const Scene: React.FC<{ scene: SketchBrief["scenes"][number]; S: number; last: boolean; m: Medium }> = ({ scene, S, last, m }) => {
  const frame = useCurrentFrame();
  const t = useTheme();
  const ink = m.ink(t);
  const placed: Placed[] = scene.draw.map((d) => ({
    doodle: DOODLE_SET[d.doodle as DoodleName] as Doodle,
    cx: AREA.x + (d.x / 100) * AREA.w,
    cy: AREA.y + (d.y / 100) * AREA.h,
    scale: d.size / 300, // size ≈ visible width of the drawing (doodles fill ~75 % of their 400 box)
    rotate: d.rotate,
  }));
  // stage windows (fractions of the scene): line-first = outline then colour; colour-first = colour then line on top
  const lineWin = m.order === "line-first" ? [0.04, 0.55] : [0.26, 0.6];
  const fillWin = m.order === "line-first" ? [0.5, 0.64] : [0.04, 0.32];
  // pen schedule: every stroke of every doodle in order, time ∝ length (+ a minimum)
  const strokes = placed.flatMap((p, pi) => p.doodle.strokes.map((s, si) => ({ pi, si, len: getLength(s.d) * p.scale + 60 })));
  const total = strokes.reduce((n, s) => n + s.len, 0);
  const w0 = lineWin[0] * S, w1 = lineWin[1] * S;
  let acc = 0;
  const timing = strokes.map((s) => {
    const a = w0 + (acc / total) * (w1 - w0);
    acc += s.len;
    return { ...s, a, b: w0 + (acc / total) * (w1 - w0) };
  });
  const fill = ease(clamp01((frame - fillWin[0] * S) / ((fillWin[1] - fillWin[0]) * S)));
  const out = last ? 1 : 1 - clamp01((frame - (S - 9)) / 8);
  // "paintings that move": once drawn, the picture floats gently (sway) or keeps boiling (line filter)
  const done = Math.max(lineWin[1], fillWin[1]) * S;
  const life = ease(clamp01((frame - done) / 20)) * m.motion.sway;
  // tool tip: the stroke being drawn right now (colour-first media show the brush while the colour goes on)
  const live = timing.find((s) => frame >= s.a && frame < s.b);
  let tip: { x: number; y: number } | null = null;
  if (live) {
    const p = placed[live.pi];
    const d = p.doodle.strokes[live.si].d;
    const q = getPointAtLength(d, ease((frame - live.a) / (live.b - live.a)) * getLength(d)) ?? { x: 200, y: 200 };
    tip = toFrame(p, q.x, q.y);
  } else if (fill > 0 && fill < 1 && (m.fill.mode === "wash" || m.fill.mode === "tone")) {
    const p = placed[Math.min(placed.length - 1, Math.floor(fill * placed.length))];
    const a = fill * Math.PI * 7;
    tip = toFrame(p, 200 + Math.cos(a) * 90 * fill, 200 + Math.sin(a) * 70 * fill);
  }
  const tag = scene.tag;
  const tagP = clamp01((frame - 0.62 * S) / (0.08 * S));
  return (
    <AbsoluteFill style={{ opacity: out }}>
      <svg width={video.width} height={video.height} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <MediumDefs m={m} />
        </defs>
        {placed.map((p, pi) => {
          const sway = `rotate(${life * 1.3 * Math.sin(frame / 22 + pi * 2.1)} ${p.cx} ${p.cy}) translate(0 ${life * 6 * Math.sin(frame / 27 + pi * 1.3)})`;
          return (
            <g key={pi} transform={sway}>
              <g transform={`translate(${p.cx} ${p.cy}) rotate(${p.rotate}) scale(${p.scale}) translate(-200 -200)`}>
                <ColourLayer p={p} pi={pi} fill={fill} m={m} t={t} />
                <g filter="url(#md-line)">
                  {p.doodle.strokes.map((s, si) => {
                    const tm = timing.find((x) => x.pi === pi && x.si === si)!;
                    const k = ease(clamp01((frame - tm.a) / (tm.b - tm.a)));
                    if (k <= 0) return null;
                    const { strokeDasharray, strokeDashoffset } = evolvePath(k, s.d);
                    return (
                      <path
                        key={si}
                        d={s.d}
                        fill="none"
                        stroke={s.accent ? ink.accent : ink.line}
                        strokeWidth={(s.w ?? 5) * m.line.width}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeDasharray={strokeDasharray}
                        strokeDashoffset={strokeDashoffset}
                      />
                    );
                  })}
                </g>
              </g>
            </g>
          );
        })}
        {tag && tagP > 0 ? (
          <g filter="url(#md-line)">
            <Tag text={tag.text} x={AREA.x + (tag.x / 100) * AREA.w} y={AREA.y + (tag.y / 100) * AREA.h} p={tagP} color={ink.accent} m={m} />
          </g>
        ) : null}
        {tip ? <Tool kind={m.tool} x={tip.x} y={tip.y} ink={m.paper(t).light === false ? "#1B1B1B" : ink.line} accent={ink.accent} /> : null}
      </svg>
      <Caption text={scene.caption} frame={frame} S={S} ink={ink.text} accent={ink.accent} />
    </AbsoluteFill>
  );
};

function toFrame(p: Placed, x: number, y: number) {
  const r = (p.rotate * Math.PI) / 180;
  const dx = (x - 200) * p.scale, dy = (y - 200) * p.scale;
  return { x: p.cx + dx * Math.cos(r) - dy * Math.sin(r), y: p.cy + dx * Math.sin(r) + dy * Math.cos(r) };
}

/** How colour goes on, per medium: marker fade, wet wash spreading from the middle, chalk hatch / crayon wiped on, paper pieces dropped in. */
const ColourLayer: React.FC<{ p: Placed; pi: number; fill: number; m: Medium; t: Theme }> = ({ p, pi, fill, m, t }) => {
  const fills = p.doodle.fills ?? [];
  if (!fills.length || fill <= 0) return null;
  const [ox, oy] = m.fill.offset;
  const mode = m.fill.mode;
  const id = `md-clip-${pi}`;
  const clip =
    mode === "wash"
      ? <circle cx="200" cy="200" r={340 * fill} />
      : ["hatch", "grain", "halftone", "flat", "woodblock"].includes(mode)
        ? <rect x="-20" y="-20" width={440 * fill} height="440" />
        : null;
  const pops = mode === "paper" || mode === "clay" || mode === "gloss";
  const mask = mode === "hatch" ? "url(#md-hatch-mask)" : mode === "halftone" ? "url(#md-dot-mask)" : mode === "woodblock" ? "url(#md-bokashi-mask)" : undefined;
  return (
    <g transform={`translate(${ox} ${oy})`} opacity={mode === "marker" || mode === "tone" ? fill * m.fill.opacity : m.fill.opacity}>
      {clip ? (
        <defs>
          <clipPath id={id}>{clip}</clipPath>
        </defs>
      ) : null}
      <g filter="url(#md-fill)" clipPath={clip ? `url(#${id})` : undefined} mask={mask} style={mode === "halftone" ? { mixBlendMode: "multiply" } : undefined}>
        {fills.map((f, fi) => {
          if (pops) {
            const k = ease(clamp01(fill * fills.length - fi));
            if (k <= 0) return null;
            return (
              <g key={fi} opacity={k} transform={`translate(${(1 - k) * 18} ${(1 - k) * -40}) rotate(${(1 - k) * -6} 200 200)`}>
                <path d={f.d} fill={fillColour(t, f.fill, m)} />
              </g>
            );
          }
          return <path key={fi} d={f.d} fill={fillColour(t, f.fill, m)} opacity={f.opacity ?? 0.9} />;
        })}
      </g>
    </g>
  );
};

const Tag: React.FC<{ text: string; x: number; y: number; p: number; color: string; m: Medium }> = ({ text, x, y, p, color, m }) => {
  const t = useTheme();
  const board = m.paper(t).light === false;
  const w = text.length * 26 + 44, h = 74;
  const box = `M ${x - w / 2} ${y - h / 2 + 3} L ${x + w / 2 + 4} ${y - h / 2} L ${x + w / 2} ${y + h / 2 + 2} L ${x - w / 2 - 3} ${y + h / 2} Z`;
  const { strokeDasharray, strokeDashoffset } = evolvePath(p, box);
  return (
    <g transform={`rotate(-4 ${x} ${y})`}>
      <path d={box} fill={board ? "none" : "#FFFFFF"} fillOpacity={0.85 * p} stroke={m.ink(t).line} strokeWidth="4" strokeDasharray={strokeDasharray} strokeDashoffset={strokeDashoffset} />
      <text x={x} y={y + 16} textAnchor="middle" style={{ fontFamily: HAND, fontWeight: 700, fontSize: 52, fill: color, opacity: p }}>{text.toUpperCase()}</text>
    </g>
  );
};

/** The drawing tool that follows the line: pencil, wax crayon, chalk stick or brush (none for collage). */
const Tool: React.FC<{ kind: Medium["tool"]; x: number; y: number; ink: string; accent: string }> = ({ kind, x, y, ink, accent }) => {
  if (kind === "scissors") return null;
  if (kind === "chalk")
    return (
      <g transform={`translate(${x} ${y}) rotate(-38)`}>
        <rect x="0" y="-8" width="70" height="16" rx="6" fill="#F4F1EA" stroke="#9C978C" strokeWidth="1.5" />
      </g>
    );
  if (kind === "brush")
    return (
      <g transform={`translate(${x} ${y}) rotate(-50)`}>
        <path d="M 0 0 C 8 -6, 22 -8, 30 -6 L 30 6 C 22 8, 8 6, 0 0 Z" fill={ink} />
        <rect x="30" y="-7" width="22" height="14" fill="#B8B8B8" stroke={ink} strokeWidth="1.5" />
        <rect x="52" y="-5" width="120" height="10" rx="5" fill="#8A5A3C" stroke={ink} strokeWidth="1.5" />
      </g>
    );
  const body = kind === "crayon" ? accent : "#F2C14E";
  return (
    <g transform={`translate(${x} ${y}) rotate(-38)`}>
      <path d="M 0 0 L 16 -9 L 16 9 Z" fill={kind === "crayon" ? accent : "#E9C9A0"} stroke={ink} strokeWidth="2" />
      {kind === "pencil" ? <path d="M 0 0 L 6 -3.4 L 6 3.4 Z" fill={ink} /> : null}
      <rect x="16" y="-9" width="110" height="18" fill={body} stroke={ink} strokeWidth="2" />
      {kind === "pencil" ? (
        <>
          <rect x="126" y="-9" width="16" height="18" fill="#C9C9C9" stroke={ink} strokeWidth="2" />
          <rect x="142" y="-9" width="14" height="18" rx="4" fill="#E58C8A" stroke={ink} strokeWidth="2" />
        </>
      ) : (
        <rect x="40" y="-9" width="56" height="18" fill="none" stroke={ink} strokeWidth="1.5" strokeDasharray="4 4" />
      )}
    </g>
  );
};

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

const Footer: React.FC<{ text?: string; m: Medium }> = ({ text, m }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ink = m.ink(useTheme());
  const p = ease(clamp01((frame - fps * 0.6) / (fps * 0.8)));
  const y = 1500;
  const style: React.CSSProperties = { position: "absolute", top: y + 14, fontFamily: fonts.mono, fontSize: 17, letterSpacing: "0.14em", textTransform: "uppercase", color: ink.muted, opacity: p };
  return (
    <>
      <div style={{ position: "absolute", top: y, left: 100, width: 840 * p, height: 2, background: ink.muted, opacity: 0.5 }} />
      <div style={{ position: "absolute", top: y, left: 100, width: 300 * p, height: 2, background: ink.accent }} />
      {text ? <div style={{ ...style, left: 100 }}>{text}</div> : null}
      <div style={{ ...style, right: video.safe.right }}>Dental House · sketch notes</div>
    </>
  );
};
