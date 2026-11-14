/**
 * Whole-video looks (our own code; style names from a "10 viral video styles" post): wrap any scene in <Look kind=…>.
 * crt · thermal · matrix · pixel · synthwave · mono. Frame-driven and deterministic.
 * Never on clinical photos or results (a look changes colours/detail: golden rule 3). Compliance blocks it there.
 */
import React from "react";
import { AbsoluteFill, random, useCurrentFrame } from "remotion";
import { video } from "../brand";

export const LOOKS = ["none", "crt", "thermal", "matrix", "pixel", "synthwave", "mono"] as const;
export type LookName = (typeof LOOKS)[number];
const W = video.width, H = video.height;

/** Luminance → palette (5 stops) as an SVG filter. */
const Palette: React.FC<{ id: string; r: number[]; g: number[]; b: number[]; contrast?: number }> = ({ id, r, g, b, contrast = 1 }) => (
  <filter id={id} colorInterpolationFilters="sRGB">
    <feColorMatrix type="matrix" values={`${0.299 * contrast} ${0.587 * contrast} ${0.114 * contrast} 0 ${(1 - contrast) / 2}  ${0.299 * contrast} ${0.587 * contrast} ${0.114 * contrast} 0 ${(1 - contrast) / 2}  ${0.299 * contrast} ${0.587 * contrast} ${0.114 * contrast} 0 ${(1 - contrast) / 2}  0 0 0 1 0`} />
    <feComponentTransfer>
      <feFuncR type="table" tableValues={r.join(" ")} />
      <feFuncG type="table" tableValues={g.join(" ")} />
      <feFuncB type="table" tableValues={b.join(" ")} />
    </feComponentTransfer>
  </filter>
);

const Defs: React.FC<{ frame: number }> = ({ frame }) => (
  <svg width={0} height={0} style={{ position: "absolute" }}>
    <defs>
      {/* heat camera: black → violet → red → orange → yellow → white */}
      <Palette id="lk-thermal" r={[0.02, 0.35, 0.9, 1, 1, 1]} g={[0.0, 0.02, 0.12, 0.5, 0.9, 1]} b={[0.12, 0.55, 0.35, 0.05, 0.2, 0.95]} contrast={1.2} />
      {/* digital rain: everything in phosphor green */}
      <Palette id="lk-matrix" r={[0, 0.02, 0.1, 0.55]} g={[0.02, 0.35, 0.8, 1]} b={[0.01, 0.08, 0.25, 0.6]} contrast={1.3} />
      {/* synthwave: deep purple → magenta → orange → warm yellow */}
      <Palette id="lk-synth" r={[0.08, 0.45, 0.95, 1, 1]} g={[0.02, 0.05, 0.25, 0.6, 0.92]} b={[0.22, 0.55, 0.6, 0.35, 0.55]} contrast={1.15} />
      {/* monochrome essay: high-contrast black and white */}
      <Palette id="lk-mono" r={[0, 0.05, 0.9, 1]} g={[0, 0.05, 0.9, 1]} b={[0, 0.05, 0.9, 1]} contrast={1.35} />
      {/* CRT: red and blue channels slightly apart (chromatic aberration) */}
      <filter id="lk-crt" colorInterpolationFilters="sRGB">
        <feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r" />
        <feOffset in="r" dx={3 + Math.sin(frame / 7) * 1.5} dy="0" result="r2" />
        <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="g" />
        <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="b" />
        <feOffset in="b" dx={-3} dy="0" result="b2" />
        <feBlend in="r2" in2="g" mode="screen" result="rg" />
        <feBlend in="rg" in2="b2" mode="screen" />
      </filter>
      {/* pixel art: sample one pixel per block, then grow it to fill the block (mosaic) */}
      <filter id="lk-pixel" x="0" y="0" width="100%" height="100%">
        <feFlood x="7" y="7" width="2" height="2" />
        <feComposite width="16" height="16" />
        <feTile result="grid" />
        <feComposite in="SourceGraphic" in2="grid" operator="in" />
        <feMorphology operator="dilate" radius="8" />
      </filter>
    </defs>
  </svg>
);

/** Falling glyph columns for the matrix look (deterministic). */
const Rain: React.FC<{ frame: number }> = ({ frame }) => {
  const cols = 36;
  const glyphs = "01アイウエオカキクケコｱｲｳ0123456789";
  return (
    <AbsoluteFill style={{ fontFamily: "JetBrains Mono", fontSize: 26, lineHeight: "30px", mixBlendMode: "screen" }}>
      {Array.from({ length: cols }, (_, c) => {
        const speed = 10 + random(`ms${c}`) * 16;
        const len = 8 + Math.floor(random(`ml${c}`) * 14);
        const head = ((frame * speed) / 30 + random(`mo${c}`) * 70) % 80;
        return Array.from({ length: len }, (_, k) => {
          const row = Math.floor(head) - k;
          if (row < 0 || row * 30 > H) return null;
          const ch = glyphs[Math.floor(random(`mg${c}-${row}-${Math.floor(frame / 6)}`) * glyphs.length)];
          return (
            <div key={`${c}-${k}`} style={{ position: "absolute", left: c * 30 + 4, top: row * 30, color: k === 0 ? "#D9FFE4" : "#2BE36B", opacity: k === 0 ? 1 : (1 - k / len) * 0.75, textShadow: "0 0 8px #2BE36B" }}>
              {ch}
            </div>
          );
        });
      })}
    </AbsoluteFill>
  );
};

/** Wraps a scene in one look. `amount` 0–1 lets the look fade in or out. */
export const Look: React.FC<{ kind: LookName; children: React.ReactNode; amount?: number }> = ({ kind, children, amount = 1 }) => {
  const frame = useCurrentFrame();
  if (kind === "none" || amount <= 0) return <>{children}</>;
  const filter = { crt: "url(#lk-crt)", thermal: "url(#lk-thermal)", matrix: "url(#lk-matrix)", pixel: "url(#lk-pixel)", synthwave: "url(#lk-synth)", mono: "url(#lk-mono)" }[kind];
  const flicker = kind === "crt" ? 0.94 + 0.06 * random(`fl${frame}`) : 1;
  return (
    <AbsoluteFill>
      <Defs frame={frame} />
      <AbsoluteFill>{children}</AbsoluteFill>
      <AbsoluteFill style={{ filter: `${filter} brightness(${flicker})`, opacity: amount }}>{children}</AbsoluteFill>
      {kind === "crt" ? (
        <>
          <AbsoluteFill style={{ background: "repeating-linear-gradient(0deg, rgba(0,0,0,0.32) 0px, rgba(0,0,0,0.32) 2px, transparent 2px, transparent 5px)", opacity: amount }} />
          <AbsoluteFill style={{ background: `linear-gradient(0deg, transparent ${((frame * 9) % (H + 300)) - 300}px, rgba(255,255,255,0.06) ${((frame * 9) % (H + 300)) - 220}px, transparent ${((frame * 9) % (H + 300)) - 140}px)`, opacity: amount }} />
          <AbsoluteFill style={{ boxShadow: "inset 0 0 220px 60px rgba(0,0,0,0.85)", borderRadius: 60, opacity: amount }} />
        </>
      ) : null}
      {kind === "matrix" ? <AbsoluteFill style={{ opacity: 0.55 * amount }}><Rain frame={frame} /></AbsoluteFill> : null}
      {kind === "synthwave" ? (
        <>
          <AbsoluteFill style={{ background: "repeating-linear-gradient(0deg, rgba(20,0,40,0.25) 0px, rgba(20,0,40,0.25) 2px, transparent 2px, transparent 6px)", opacity: amount }} />
          <AbsoluteFill style={{ boxShadow: "inset 0 0 260px 40px rgba(60,0,90,0.6)", opacity: amount }} />
        </>
      ) : null}
      {kind === "thermal" ? <AbsoluteFill style={{ boxShadow: "inset 0 0 200px 30px rgba(0,0,0,0.5)", opacity: amount }} /> : null}
      {kind === "mono" ? (
        <svg width={W} height={H} style={{ position: "absolute", inset: 0, opacity: 0.35 * amount, mixBlendMode: "overlay" }}>
          <filter id="lk-grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={frame % 7} /></filter>
          <rect width="100%" height="100%" filter="url(#lk-grain)" />
        </svg>
      ) : null}
    </AbsoluteFill>
  );
};
