import React, { useMemo } from "react";
import { AbsoluteFill, Img, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import * as THREE from "three";
import { video } from "../brand";
import type { PackageExplainerBrief } from "../brief/schema";
import { PACKAGE_HOOK, packageTimes } from "../brief/timing";
import { useTheme } from "../theme";
import { Sfx } from "../fx/effects";
import { Instrument, OrthoRig, StudioEnvironment, modelBounds, modelPointToWorld, useModels, type InstrumentName } from "../three/instruments";
import { prog } from "./shared/motion";
import { KineticHeadline } from "./shared/Headline";
import { Shell, type QcProps } from "./shared/Shell";
import { fitSize, headline, mono, serif } from "./shared/text";

const W = video.width;
const LEFT = 90;
const RIGHT = video.safe.right;
const STAGE = { top: 470, height: 960 };
const CLIP_TOP = 520;
const FADE = 8;

type SpecBeat = Extract<PackageExplainerBrief["beats"][number], { kind: "spec" }>;
type ClipBeat = Extract<PackageExplainerBrief["beats"][number], { kind: "clip" }>;

/**
 * Technical package explainer. Spec beats: instruments as 3D models with textbook callouts.
 * Clip beats: the matching part of the clinical illustration. Then before/after (uncropped, same box) and the package card.
 */
export const PackageExplainer: React.FC<{ brief: PackageExplainerBrief } & QcProps> = ({ brief, showSafeZones }) => {
  const { fps } = useVideoConfig();
  const tl = packageTimes(brief);
  const f = (s: number) => Math.round(s * fps);
  const steps = Math.max(...brief.beats.map((b) => b.step));
  const hookModels = useMemo(() => {
    const seen: InstrumentName[] = [];
    for (const b of brief.beats) if (b.kind === "spec") for (const m of b.models) if (!seen.includes(m)) seen.push(m);
    return [seen[0], seen[Math.floor(seen.length / 2)], seen[seen.length - 1]].filter((v, i, a) => v && a.indexOf(v) === i) as InstrumentName[];
  }, [brief.beats]);
  return (
    <Shell brief={brief} endSeconds={4.5} showSafeZones={showSafeZones}>
      <Sequence durationInFrames={f(PACKAGE_HOOK)}>
        {brief.opening ? (
          // action-first opening (creative-direction §6): the treatment is already in progress
          <>
            <ClipWindow src={brief.clip} window={brief.clip_window} from={brief.opening.from} to={brief.opening.from + PACKAGE_HOOK * brief.opening.speed} speed={brief.opening.speed} dur={f(PACKAGE_HOOK)} />
            <div style={{ position: "absolute", left: LEFT, top: 255 }}>
              <KineticHeadline lines={brief.hook.lines} accent={brief.hook.accent} width={W - LEFT - RIGHT} max={84} />
            </div>
          </>
        ) : (
          <>
            <Stage models={hookModels} dur={f(PACKAGE_HOOK)} callouts={[]} top={760} height={760} />
            <div style={{ position: "absolute", left: LEFT, top: 255 }}>
              <KineticHeadline lines={brief.hook.lines} accent={brief.hook.accent} width={W - LEFT - RIGHT} max={118} />
            </div>
          </>
        )}
      </Sequence>
      {brief.beats.map((b, i) => (
        <Sequence key={i} from={f(tl.beats[i].start)} durationInFrames={f(tl.beats[i].len)}>
          <Cut transition={brief.fx.transition} dur={f(tl.beats[i].len)}>
            {b.kind === "spec" ? <Spec beat={b} dur={f(tl.beats[i].len)} /> : <Clip beat={b} src={brief.clip} window={brief.clip_window} dur={f(tl.beats[i].len)} />}
            <StepHeader n={b.step} total={steps} title={b.title} />
          </Cut>
        </Sequence>
      ))}
      {brief.results && tl.results ? (
        <Sequence from={f(tl.results.start)} durationInFrames={f(tl.results.len)}>
          <Cut transition={brief.fx.transition} dur={f(tl.results.len)}>
            <Results before={brief.results.before} after={brief.results.after} note={brief.results.note} />
          </Cut>
          {brief.fx.sfx !== "none" ? <Sfx name="thud" at={Math.round(fps * 1.2)} volume={0.35} /> : null}
        </Sequence>
      ) : null}
      {brief.included && tl.included ? (
        <Sequence from={f(tl.included.start)} durationInFrames={f(tl.included.len)}>
          <Cut transition={brief.fx.transition} dur={f(tl.included.len)}>
            <Included {...brief.included} />
          </Cut>
        </Sequence>
      ) : null}
    </Shell>
  );
};

/** Scene boundary: a hard cut when the brief says transition none (default for new work, T17), else a short fade. */
const Cut: React.FC<{ transition: string; dur: number; children: React.ReactNode }> = ({ transition, dur, children }) =>
  transition === "none" ? <AbsoluteFill>{children}</AbsoluteFill> : <Fade dur={dur}>{children}</Fade>;

const Fade: React.FC<{ dur: number; children: React.ReactNode }> = ({ dur, children }) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [0, FADE, dur - FADE, dur], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return <AbsoluteFill style={{ opacity: o }}>{children}</AbsoluteFill>;
};

const StepHeader: React.FC<{ n: number; total: number; title: string }> = ({ n, total, title }) => {
  const t = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = prog(frame, 0, fps * 0.45);
  return (
    <div style={{ position: "absolute", left: LEFT, right: RIGHT, top: 255, opacity: a, transform: `translateY(${(1 - a) * 20}px)` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
        <div style={mono(28, t.accent)}>
          Step {String(n).padStart(2, "0")} / {String(total).padStart(2, "0")}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {Array.from({ length: total }, (_, i) => (
            <div key={i} style={{ width: i + 1 === n ? 40 : 12, height: 8, borderRadius: 4, background: i + 1 <= n ? t.accent : t.muted, opacity: i + 1 <= n ? 1 : 0.4 }} />
          ))}
        </div>
      </div>
      <div style={{ ...headline(fitSize([title], W - LEFT - RIGHT, 100)), marginTop: 10 }}>{title}</div>
    </div>
  );
};

// ---- spec: instruments in 3D -------------------------------------------------

const Spec: React.FC<{ beat: SpecBeat; dur: number }> = ({ beat, dur }) => {
  const t = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <>
      <Stage models={beat.models} callouts={beat.callouts} dur={dur} />
      {beat.subline ? (
        <div style={{ position: "absolute", left: LEFT, right: RIGHT, top: 1440, ...serif(50, t.accent), opacity: prog(frame, fps * 0.35, fps * 0.5) }}>{beat.subline}</div>
      ) : null}
      <div style={{ position: "absolute", right: RIGHT + 10, top: STAGE.top - 6, ...mono(20, t.muted) }}>Illustration · not to scale</div>
    </>
  );
};

/** Orthographic turntable of 1-3 instruments at a shared scale, with projected callouts. */
const Stage: React.FC<{ models: InstrumentName[]; callouts: SpecBeat["callouts"]; dur: number; top?: number; height?: number }> = ({
  models: names,
  callouts,
  dur,
  top = STAGE.top,
  height = STAGE.height,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const models = useModels(names);
  const gap = 18; // mm between instruments
  const tilt = -0.12;
  const layout = useMemo(() => {
    if (!models) return null;
    // place side by side at true relative scale, then fit the group into the stage
    // each instrument drawn to the same height so small ones stay readable ("not to scale" label)
    const raw = models.map((m, i) => modelBounds(m, names[i], 0, tilt));
    const tallest = Math.max(...raw.map((b) => b.max.y - b.min.y));
    const scales = raw.map((b) => tallest / (b.max.y - b.min.y));
    const boxes = models.map((m, i) => modelBounds(m, names[i], 0, tilt, scales[i]));
    const widths = boxes.map((b) => b.max.x - b.min.x);
    const total = widths.reduce((a, b) => a + b, 0) + gap * (models.length - 1);
    let x = -total / 2;
    const offsets = boxes.map((b, i) => {
      const o = x - b.min.x;
      x += widths[i] + gap;
      return o;
    });
    const all = new THREE.Box3();
    boxes.forEach((b, i) => all.union(b.clone().translate(new THREE.Vector3(offsets[i], 0, 0))));
    const size = all.getSize(new THREE.Vector3());
    const centre = all.getCenter(new THREE.Vector3());
    const zoom = Math.min((W * (callouts.length ? 0.5 : 0.78)) / size.x, (height * 0.86) / size.y);
    return { offsets, centre, zoom, scales };
  }, [models, names, callouts.length]);
  if (!models || !layout) return null;
  const turn = Math.sin((frame + 20) / 38) * 0.42; // slow turntable so the 3D reads
  const enter = prog(frame, 0, fps * 0.5);
  const toScreen = (p: THREE.Vector3) => ({ x: W / 2 + (p.x - layout.centre.x) * layout.zoom, y: height / 2 - (p.y - layout.centre.y) * layout.zoom });
  return (
    <div style={{ position: "absolute", left: 0, top, width: W, height, opacity: enter }}>
      <ThreeCanvas
        width={W}
        height={height}
        orthographic
        camera={{ position: [layout.centre.x, layout.centre.y, 600], zoom: layout.zoom, near: 1, far: 2000 }}
        gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping, outputColorSpace: THREE.SRGBColorSpace }}
      >
        <OrthoRig x={layout.centre.x} y={layout.centre.y} zoom={layout.zoom} />
        <StudioEnvironment />
        <ambientLight intensity={0.35} />
        <directionalLight position={[-200, 300, 400]} intensity={1.6} />
        <directionalLight position={[300, -100, 200]} intensity={0.6} />
        {models.map((m, i) => (
          <Instrument key={names[i] + i} model={m} name={names[i]} turn={turn} offsetX={layout.offsets[i]} tilt={tilt} scale={layout.scales[i]} />
        ))}
      </ThreeCanvas>
      <Callouts items={callouts.map((c) => {
        const idx = Math.min(c.model, models.length - 1);
        const p = toScreen(modelPointToWorld(names[idx], c.at, turn, layout.offsets[idx], tilt, layout.scales[idx]));
        // two instruments: left one labelled on the left, right one on the right; one instrument: by side of the point
        const right = models.length > 1 ? idx === models.length - 1 : p.x > W / 2 + (layout.offsets[0] - layout.centre.x) * layout.zoom;
        return { p, right, text: c.text };
      })} height={height} />
    </div>
  );
};

/** Textbook callouts: dot on the part, thin leader, rule above a mono label. Labels stack per side. */
const Callouts: React.FC<{ items: { p: { x: number; y: number }; right: boolean; text: string }[]; height: number }> = ({ items, height }) => {
  const t = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const row = { left: 0, right: 0 };
  const placed = items.map((it, i) => {
    const side = it.right ? "right" : "left";
    const ly = 110 + row[side] * 180;
    row[side] += 1;
    return { ...it, ly, i };
  });
  const LW = 330;
  return (
    <>
      <svg width={W} height={height} style={{ position: "absolute", left: 0, top: 0 }}>
        {placed.map(({ p, right, ly, i }) => {
          const a = prog(frame, fps * (0.45 + i * 0.25), fps * 0.45);
          const x0 = right ? W - RIGHT - 20 - LW : LEFT;
          const x1 = x0 + LW;
          const elbow = right ? x0 : x1;
          return (
            <g key={i} opacity={Math.min(1, a * 1.5)}>
              <circle cx={p.x} cy={p.y} r={8} fill="none" stroke={t.accent} strokeWidth={2.5} />
              <circle cx={p.x} cy={p.y} r={3} fill={t.accent} />
              <polyline points={`${p.x},${p.y} ${elbow},${ly} ${right ? x1 : x0},${ly}`} fill="none" stroke={t.accent} strokeWidth={2} strokeDasharray={2400} strokeDashoffset={2400 * (1 - a)} />
            </g>
          );
        })}
      </svg>
      {placed.map(({ right, ly, text, i }) => (
        <div
          key={i}
          style={{
            position: "absolute",
            top: ly + 12,
            width: LW,
            ...(right ? { right: RIGHT + 20, textAlign: "right" as const } : { left: LEFT }),
            ...mono(23, t.text),
            lineHeight: 1.3,
            opacity: prog(frame, fps * (0.6 + i * 0.25), fps * 0.4),
          }}
        >
          {text}
        </div>
      ))}
    </>
  );
};

// ---- clip: the clinical illustration ------------------------------------------

const ClipWindow: React.FC<{ src: string; window: [number, number]; from: number; to: number; speed: number; dur: number }> = ({ src, window, from, to, speed, dur }) => {
  const t = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const k = W / (window[1] - window[0]); // source px -> frame px
  const h = Math.round(1080 * k);
  const push = interpolate(frame, [0, dur], [1, 1.04]); // gentle push so the frame breathes
  return (
    <div style={{ position: "absolute", left: 0, top: CLIP_TOP, width: W, height: h, overflow: "hidden", borderTop: `2px solid ${t.rule}`, borderBottom: `2px solid ${t.rule}` }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: W, height: h, transform: `scale(${push})`, transformOrigin: "50% 45%" }}>
        <OffthreadVideo
          src={staticFile(src)}
          muted
          startFrom={Math.round(from * fps)}
          endAt={Math.round(to * fps)}
          playbackRate={speed}
          style={{ position: "absolute", left: -window[0] * k, top: 0, width: 1920 * k, height: h }}
        />
      </div>
      <div style={{ position: "absolute", right: 24, bottom: 18, ...mono(18, "#F7F8F6"), opacity: 0.85, textShadow: "0 1px 3px rgba(0,0,0,.6)" }}>
        Illustration on a real photo
      </div>
    </div>
  );
};

const Clip: React.FC<{ beat: ClipBeat; src: string; window: [number, number]; dur: number }> = ({ beat, src, window, dur }) => {
  const t = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const h = Math.round(1080 * (W / (window[1] - window[0])));
  return (
    <>
      <ClipWindow src={src} window={window} from={beat.from} to={beat.to} speed={beat.speed} dur={dur} />
      <div style={{ position: "absolute", left: LEFT, right: RIGHT, top: CLIP_TOP + h + 50, ...serif(50, t.accent), opacity: prog(frame, fps * 0.3, fps * 0.5) }}>
        {beat.caption}
      </div>
    </>
  );
};

// ---- results: uncropped before/after in the same box ----------------------------

const BOX = { w: W - LEFT - RIGHT + 50, h: 470 };
const Results: React.FC<{ before: string; after: string; note: string }> = ({ before, after, note }) => {
  const t = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const photo = (src: string, label: string, top: number, delay: number) => {
    const a = prog(frame, fps * delay, fps * 0.5);
    return (
      <div style={{ position: "absolute", left: LEFT - 25, top, width: BOX.w, height: BOX.h, opacity: a }}>
        {/* golden rule 3: unwarped, uncropped, same box for both photos */}
        <Img src={staticFile(src)} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        <div style={{ position: "absolute", left: 0, top: -40, ...mono(24, t.accent) }}>{label}</div>
      </div>
    );
  };
  return (
    <>
      <div style={{ position: "absolute", left: LEFT, top: 255, ...headline(92), opacity: prog(frame, 0, fps * 0.4) }}>The result</div>
      {photo(before, "Before", 420, 0.2)}
      {photo(after, "After", 950, 1.0)}
      <div style={{ position: "absolute", left: LEFT, right: RIGHT, top: 1450, ...mono(22, t.muted), lineHeight: 1.4, opacity: prog(frame, fps * 1.4, fps * 0.4) }}>{note}</div>
    </>
  );
};

// ---- what's included -----------------------------------------------------------

const Included: React.FC<NonNullable<PackageExplainerBrief["included"]>> = ({ title, items, price, price_note }) => {
  const t = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <>
      <div style={{ position: "absolute", left: LEFT, right: RIGHT, top: 255, ...headline(fitSize([title], W - LEFT - RIGHT, 96)), opacity: prog(frame, 0, fps * 0.4) }}>{title}</div>
      {items.map((it, i) => {
        const a = prog(frame, fps * (0.3 + i * 0.22), fps * 0.4);
        return (
          <div key={i} style={{ position: "absolute", left: LEFT, right: RIGHT, top: 470 + i * 118, display: "flex", alignItems: "center", gap: 28, opacity: a, transform: `translateX(${(1 - a) * -24}px)` }}>
            <div style={{ width: 52, height: 52, borderRadius: 10, border: `3px solid ${t.accent}`, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
              <svg width={30} height={30} viewBox="0 0 30 30">
                <path d="M5 16 L12 23 L25 8" fill="none" stroke={t.accent} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={40} strokeDashoffset={40 * (1 - a)} />
              </svg>
            </div>
            <div style={{ ...headline(54), textTransform: "none", fontWeight: 600 }}>{it}</div>
          </div>
        );
      })}
      {price ? (
        <div style={{ position: "absolute", left: LEFT, right: RIGHT, top: 470 + items.length * 118 + 40, opacity: prog(frame, fps * (0.4 + items.length * 0.22), fps * 0.4) }}>
          <div style={{ ...headline(96, t.accent) }}>{price}</div>
          {price_note ? <div style={{ ...mono(24, t.muted), marginTop: 10 }}>{price_note}</div> : null}
        </div>
      ) : null}
    </>
  );
};
