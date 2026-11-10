/**
 * Footage effects (creator-style looks, built in Remotion code; free).
 * Most take a `subject` (the cut-out doctor: transparent WebM from scripts/prep_footage) and/or `children`
 * (any full-frame layer: footage, photo, graphics). Frame-driven, deterministic.
 * Names follow the "17 video effects" reference; interpretations are refined against reference clips.
 */
import React from "react";
import { AbsoluteFill, Easing, Img, OffthreadVideo, interpolate, random, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { useTheme } from "../theme";
import { video } from "../brand";
import { headline, mono, serif } from "../templates/shared/text";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ease = Easing.bezier(0.22, 1, 0.36, 1);
const io = Easing.bezier(0.65, 0, 0.35, 1);
const p = (f: number, a: number, b: number, e = ease) => interpolate(f, [a, b], [0, 1], { ...clamp, easing: e });

/** Cut-out speaker clip (alpha WebM) sized to the frame width. */
export const Subject: React.FC<{ src: string; style?: React.CSSProperties; startFrom?: number; muted?: boolean }> = ({ src, style, startFrom = 0, muted }) => (
  <OffthreadVideo src={staticFile(src)} transparent startFrom={startFrom} muted={muted} style={{ width: "100%", display: "block", ...style }} />
);

/* 01 ORBIT: the clip as a 3D card that orbits / turns in space ------------------------------------ */
export const Orbit: React.FC<{ children: React.ReactNode; turns?: number; tilt?: number }> = ({ children, turns = 0.18, tilt = 10 }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const a = interpolate(frame, [0, durationInFrames], [-turns, turns]) * 360;
  const z = interpolate(frame, [0, durationInFrames * 0.5, durationInFrames], [-120, 40, -120]);
  return (
    <AbsoluteFill style={{ perspective: 1800, alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 760, height: 1350, transform: `translateZ(${z}px) rotateY(${a}deg) rotateX(${tilt}deg)`, borderRadius: 40, overflow: "hidden", boxShadow: "0 60px 120px rgba(0,0,0,0.55)", position: "relative" }}>
        {children}
      </div>
    </AbsoluteFill>
  );
};

/* 02 COUCH WALL (interpreted as "video wall"): the clip repeated on a wall of screens ---------------- */
export const VideoWall: React.FC<{ children: React.ReactNode; cols?: number; rows?: number }> = ({ children, cols = 3, rows = 4 }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const zoom = interpolate(frame, [0, durationInFrames], [1.0, 2.6], { ...clamp, easing: io });
  const w = video.width / cols, h = video.height / rows;
  return (
    <AbsoluteFill style={{ background: "#0b0e0d", transform: `scale(${zoom})`, transformOrigin: "50% 48%" }}>
      {Array.from({ length: cols * rows }, (_, i) => (
        <div key={i} style={{ position: "absolute", left: (i % cols) * w + 6, top: Math.floor(i / cols) * h + 6, width: w - 12, height: h - 12, overflow: "hidden", borderRadius: 10, opacity: 0.55 + 0.45 * random(`vw${i}`), filter: i === Math.floor((cols * rows) / 2) ? "none" : "saturate(0.6)" }}>
          <div style={{ width: video.width, height: video.height, transform: `scale(${w / video.width})`, transformOrigin: "0 0" }}>{children}</div>
        </div>
      ))}
    </AbsoluteFill>
  );
};

/* 03 UI WORLD: speaker inside floating app windows / cards at different depths ------------------- */
export const UIWorld: React.FC<{ subject: React.ReactNode; cards?: { title: string; body: string }[] }> = ({ subject, cards = [] }) => {
  const frame = useCurrentFrame();
  const t = useTheme();
  const items = cards.length ? cards : [{ title: "Appointment", body: "Tue 5:30 pm · Check-up" }, { title: "Reminder", body: "Brush twice a day" }, { title: "WhatsApp", body: "0323-7560160" }];
  const slots = [
    { x: 70, y: 380, z: 0.9 }, { x: 560, y: 640, z: 1.15 }, { x: 110, y: 1180, z: 1.05 },
  ];
  return (
    <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 40%, ${t.bgTop}, ${t.bgBottom})` }}>
      {items.slice(0, 3).map((c, i) => {
        const s = slots[i];
        const a = p(frame, 6 + i * 8, 26 + i * 8);
        const drift = Math.sin((frame + i * 40) / 40) * 12 * s.z;
        return (
          <div key={i} style={{ position: "absolute", left: s.x, top: s.y + drift, width: 380, transform: `scale(${s.z * (0.9 + 0.1 * a)})`, opacity: a, zIndex: s.z > 1 ? 3 : 1 }}>
            <div style={{ background: "rgba(247,248,246,0.92)", borderRadius: 22, padding: "18px 22px", boxShadow: "0 24px 60px rgba(0,0,0,0.35)" }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                {["#E06A5F", "#E8C35A", "#7FB38F"].map((c2) => <div key={c2} style={{ width: 12, height: 12, borderRadius: 9, background: c2 }} />)}
              </div>
              <div style={{ ...mono(20, t.bgTop) }}>{c.title}</div>
              <div style={{ ...headline(40, "#1C2220"), textTransform: "none", marginTop: 6 }}>{c.body}</div>
            </div>
          </div>
        );
      })}
      <AbsoluteFill style={{ zIndex: 2, top: 380 }}>{subject}</AbsoluteFill>
    </AbsoluteFill>
  );
};

/* 04 FRAME BREAK: footage inside a frame, the speaker's cut-out pops out over the border -------------- */
export const FrameBreak: React.FC<{ background: React.ReactNode; subject: React.ReactNode; frame?: { x: number; y: number; w: number; h: number } }> = ({
  background, subject, frame: box = { x: 110, y: 640, w: 860, h: 820 },
}) => {
  const frame = useCurrentFrame();
  const t = useTheme();
  const a = p(frame, 0, 18);
  return (
    <AbsoluteFill style={{ background: t.bgBottom }}>
      <div style={{ position: "absolute", left: box.x, top: box.y, width: box.w, height: box.h, overflow: "hidden", borderRadius: 28, border: `10px solid ${t.text}`, transform: `scale(${0.92 + 0.08 * a})`, opacity: a }}>
        <div style={{ position: "absolute", left: -box.x, top: -box.y, width: video.width, height: video.height }}>{background}</div>
      </div>
      {/* the subject is drawn again, unclipped, but only above the frame's top edge: head and shoulders "break out" */}
      <AbsoluteFill style={{ clipPath: `inset(0 0 ${video.height - box.y - 60}px 0)`, opacity: a }}>{subject}</AbsoluteFill>
      <AbsoluteFill style={{ clipPath: `inset(${box.y}px ${video.width - box.x - box.w}px ${video.height - box.y - box.h}px ${box.x}px round 20px)`, opacity: a }}>{subject}</AbsoluteFill>
    </AbsoluteFill>
  );
};

/* 05 DIGITAL ZOOM: punch-in with scanlines, pixel grid flash and focus brackets ------------------- */
export const DigitalZoom: React.FC<{ children: React.ReactNode; at?: number; zoom?: number; focus?: [number, number] }> = ({ children, at = 10, zoom = 1.8, focus = [50, 32] }) => {
  const frame = useCurrentFrame();
  const t = useTheme();
  const k = p(frame, at, at + 8, io);
  const flash = interpolate(frame, [at, at + 2, at + 10], [0, 1, 0], clamp);
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `scale(${1 + (zoom - 1) * k})`, transformOrigin: `${focus[0]}% ${focus[1]}%`, filter: flash > 0.05 ? `contrast(${1 + flash * 0.4}) saturate(${1 - flash * 0.3})` : undefined }}>{children}</AbsoluteFill>
      <AbsoluteFill style={{ opacity: flash * 0.6, backgroundImage: "repeating-linear-gradient(0deg, rgba(0,0,0,0.35) 0 2px, transparent 2px 5px)" }} />
      <AbsoluteFill style={{ opacity: flash * 0.35, backgroundImage: "linear-gradient(90deg, rgba(255,255,255,0.12) 1px, transparent 1px), linear-gradient(rgba(255,255,255,0.12) 1px, transparent 1px)", backgroundSize: "18px 18px" }} />
      {k > 0.5
        ? [[0, 0], [1, 0], [0, 1], [1, 1]].map(([x, y], i) => (
            <div key={i} style={{ position: "absolute", left: x ? 760 : 280, top: y ? 900 : 420, width: 50, height: 50, borderColor: t.accent, borderStyle: "solid", borderWidth: `${y ? 0 : 5}px ${x ? 5 : 0}px ${y ? 5 : 0}px ${x ? 0 : 5}px`, opacity: interpolate(frame, [at + 8, at + 14], [0, 1], clamp) }} />
          ))
        : null}
      {k > 0.5 ? <div style={{ position: "absolute", left: 300, top: 370, ...mono(22, t.accent), opacity: interpolate(frame, [at + 8, at + 14], [0, 1], clamp) }}>ZOOM ×{zoom.toFixed(1)} · REC</div> : null}
    </AbsoluteFill>
  );
};

/* 06 PHONE MOCKUP: any layer inside a phone, gently tilting --------------------------------------- */
export const PhoneMockup: React.FC<{ children: React.ReactNode; scale?: number; tilt?: boolean; x?: number; y?: number }> = ({ children, scale = 0.62, tilt = true, x = 0, y = 0 }) => {
  const frame = useCurrentFrame();
  const ry = tilt ? Math.sin(frame / 50) * 10 : 0;
  const W = video.width, H = video.height;
  return (
    <AbsoluteFill style={{ perspective: 2200, alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: W * scale + 36, height: H * scale + 36, borderRadius: 70 * scale + 18, background: "#111", padding: 18, boxShadow: "0 50px 120px rgba(0,0,0,0.6), inset 0 0 0 3px #3a3a3a", transform: `translate(${x}px, ${y}px) rotateY(${ry}deg) rotateX(${ry * 0.3}deg)`, position: "relative" }}>
        <div style={{ width: W * scale, height: H * scale, borderRadius: 70 * scale, overflow: "hidden", position: "relative" }}>
          <div style={{ width: W, height: H, transform: `scale(${scale})`, transformOrigin: "0 0" }}>{children}</div>
          <div style={{ position: "absolute", top: 14, left: "50%", width: 120, height: 34, marginLeft: -60, borderRadius: 20, background: "#000" }} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* 07 CHECKLIST: card with items that tick off one by one --------------------------------------- */
export const Checklist: React.FC<{ title?: string; items: string[]; every?: number; x?: number; y?: number }> = ({ title = "Treatment plan", items, every = 18, x = 90, y = 420 }) => {
  const frame = useCurrentFrame();
  const t = useTheme();
  const a = p(frame, 0, 12);
  return (
    <div style={{ position: "absolute", left: x, top: y, width: 620, opacity: a, transform: `translateY(${(1 - a) * 30}px)` }}>
      <div style={{ background: "rgba(247,248,246,0.95)", borderRadius: 26, padding: "26px 30px", boxShadow: "0 30px 80px rgba(0,0,0,0.4)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <div style={{ ...mono(20, t.bgTop) }}>● Working on</div>
          <div style={{ ...mono(18, "#fff"), background: t.rule, padding: "3px 10px", borderRadius: 8 }}>{title}</div>
        </div>
        {items.map((it, i) => {
          const done = frame > 12 + (i + 1) * every;
          const show = p(frame, 6 + i * every * 0.5, 14 + i * every * 0.5);
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 14, opacity: show }}>
              <div style={{ width: 34, height: 34, borderRadius: 99, border: `3px solid ${done ? "#4CAF6E" : "#B9BDB9"}`, background: done ? "#4CAF6E" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 22, fontWeight: 700 }}>{done ? "✓" : ""}</div>
              <div style={{ ...headline(38, done ? "#1C2220" : "#8A8F8B"), textTransform: "none", textDecoration: "none" }}>{it}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* 08 HEADLINE WALL: wall of headline cards scrolling behind the speaker ----------------------- */
export const HeadlineWall: React.FC<{ headlines: string[]; subject?: React.ReactNode }> = ({ headlines, subject }) => {
  const frame = useCurrentFrame();
  const t = useTheme();
  const rows = 9;
  return (
    <AbsoluteFill style={{ background: t.bgBottom, overflow: "hidden" }}>
      {Array.from({ length: rows }, (_, r) => {
        const dir = r % 2 ? 1 : -1;
        const x = dir * ((frame * (2 + (r % 3))) % 900) - 450;
        return (
          <div key={r} style={{ position: "absolute", top: r * 215 - 40, left: x, display: "flex", gap: 22, whiteSpace: "nowrap", opacity: 0.85 }}>
            {Array.from({ length: 6 }, (_, k) => {
              const h = headlines[(r * 3 + k) % headlines.length];
              return (
                <div key={k} style={{ background: k % 3 === 0 ? t.text : "rgba(247,248,246,0.1)", color: k % 3 === 0 ? t.bgBottom : t.text, padding: "22px 30px", borderRadius: 14, ...headline(52, k % 3 === 0 ? t.bgBottom : t.text) }}>
                  {h}
                </div>
              );
            })}
          </div>
        );
      })}
      <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 55%, transparent 30%, ${t.bgBottom} 80%)` }} />
      {subject ? <AbsoluteFill style={{ top: 420 }}>{subject}</AbsoluteFill> : null}
    </AbsoluteFill>
  );
};

/* 09 ZOOM-THROUGH CUT: camera dives through a shape (circle / letter) into the next scene -------- */
export const ZoomThrough: React.FC<{ from: React.ReactNode; to: React.ReactNode; at?: number; frames?: number; cx?: number; cy?: number }> = ({ from, to, at = 20, frames = 18, cx = 540, cy = 760 }) => {
  const frame = useCurrentFrame();
  const k = p(frame, at, at + frames, Easing.in(Easing.cubic));
  const r = interpolate(k, [0, 1], [0, 2400]);
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ transform: `scale(${1 + k * 6})`, transformOrigin: `${cx}px ${cy}px` }}>{from}</AbsoluteFill>
      <AbsoluteFill style={{ clipPath: `circle(${r}px at ${cx}px ${cy}px)`, transform: `scale(${1.25 - 0.25 * k})`, transformOrigin: `${cx}px ${cy}px` }}>{to}</AbsoluteFill>
    </AbsoluteFill>
  );
};

/* 10 CHART GROW: bars grow with counting values -------------------------------------------- */
export const ChartGrow: React.FC<{ title: string; bars: { label: string; value: number }[]; unit?: string; y?: number }> = ({ title, bars, unit = "%", y = 520 }) => {
  const frame = useCurrentFrame();
  const t = useTheme();
  const max = Math.max(...bars.map((b) => b.value));
  return (
    <div style={{ position: "absolute", left: 90, right: video.safe.right, top: y }}>
      <div style={{ ...headline(56) }}>{title}</div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 36, height: 560, marginTop: 40, borderBottom: `3px solid ${t.muted}` }}>
        {bars.map((b, i) => {
          const g = p(frame, 8 + i * 8, 40 + i * 8);
          return (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
              <div style={{ ...headline(48, t.accent), marginBottom: 10, fontVariantNumeric: "tabular-nums" }}>{Math.round(b.value * g)}{unit}</div>
              <div style={{ width: "100%", height: `${(b.value / max) * 82 * g}%`, background: i === bars.length - 1 ? t.accent : t.map[i % 6], borderRadius: "14px 14px 0 0" }} />
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 36, marginTop: 14 }}>
        {bars.map((b, i) => <div key={i} style={{ flex: 1, textAlign: "center", ...mono(22) }}>{b.label}</div>)}
      </div>
    </div>
  );
};

/* 11 PULL-BACK REVEAL: full-screen clip pulls back to reveal it is playing on a phone in a scene ---- */
export const PullBackReveal: React.FC<{ children: React.ReactNode; at?: number; frames?: number; backdrop?: React.ReactNode }> = ({ children, at = 15, frames = 30, backdrop }) => {
  const frame = useCurrentFrame();
  const t = useTheme();
  const k = p(frame, at, at + frames, io);
  const scale = interpolate(k, [0, 1], [1.65, 0.62]); // starts with the phone screen filling the frame
  return (
    <AbsoluteFill style={{ background: backdrop ? undefined : `radial-gradient(circle at 50% 40%, ${t.bgTop}, ${t.bgBottom})` }}>
      {backdrop}
      <PhoneMockup scale={scale} tilt={k > 0.95}>{children}</PhoneMockup>
    </AbsoluteFill>
  );
};

/* 12 GREEN SCREEN: cut-out speaker over any background, with a soft light-wrap edge --------------- */
export const GreenScreen: React.FC<{ subject: React.ReactNode; background: React.ReactNode }> = ({ subject, background }) => (
  <AbsoluteFill>
    <AbsoluteFill style={{ filter: "blur(2px) brightness(0.9)" }}>{background}</AbsoluteFill>
    <AbsoluteFill style={{ filter: "drop-shadow(0 0 18px rgba(255,240,220,0.35))" }}>{subject}</AbsoluteFill>
  </AbsoluteFill>
);

/* 13 PAPER CUT: torn-paper edge around the layer, paper texture, stop-motion (12 fps) feel -------- */
export const PaperCut: React.FC<{ children: React.ReactNode; seed?: string }> = ({ children, seed = "paper" }) => {
  const frame = useCurrentFrame();
  const step = Math.floor(frame / 2.5); // ~12 fps hold for the stop-motion feel
  const jit = (k: string) => (random(`${seed}${k}${step}`) - 0.5) * 6;
  const pts = Array.from({ length: 48 }, (_, i) => {
    const u = i / 48;
    const side = Math.floor(u * 4), f = (u * 4) % 1;
    const tear = (random(`${seed}t${i}`) - 0.5) * 3;
    const [x, y] = side === 0 ? [8 + f * 84, 8 + tear] : side === 1 ? [92 + tear, 8 + f * 84] : side === 2 ? [92 - f * 84, 92 + tear] : [8 + tear, 92 - f * 84];
    return `${x.toFixed(1)}% ${y.toFixed(1)}%`;
  }).join(",");
  return (
    <AbsoluteFill style={{ background: "#EDE6D8" }}>
      <AbsoluteFill style={{ transform: `translate(${jit("x")}px, ${jit("y")}px) rotate(${jit("r") * 0.15}deg)`, filter: "drop-shadow(10px 14px 0 rgba(0,0,0,0.22))" }}>
        <AbsoluteFill style={{ clipPath: `polygon(${pts})`, background: "#fff" }}>
          <AbsoluteFill style={{ clipPath: "inset(1.5% 1.5% 1.5% 1.5%)" }}>{children}</AbsoluteFill>
        </AbsoluteFill>
      </AbsoluteFill>
      <AbsoluteFill style={{ opacity: 0.18, mixBlendMode: "multiply", backgroundImage: "repeating-linear-gradient(37deg, #b9ab90 0 1px, transparent 1px 4px)" }} />
    </AbsoluteFill>
  );
};

/* 14 DOODLE BOIL: hand-drawn doodles whose lines "boil" (re-jitter every few frames) ------------- */
export const DoodleBoil: React.FC<{ doodles?: ("arrow" | "circle" | "star" | "underline" | "sparkle" | "heart")[]; color?: string }> = ({ doodles = ["circle", "arrow", "star", "underline"], color = "#F7F8F6" }) => {
  const frame = useCurrentFrame();
  const seed = Math.floor(frame / 4) % 3; // boil: 3 drawings cycled every 4 frames
  const SHAPES: Record<string, { d: string; x: number; y: number }> = {
    circle: { d: "M 0 -110 C 120 -110 170 -20 150 50 C 120 140 -90 150 -150 60 C -200 -30 -100 -115 10 -100", x: 540, y: 760 },
    arrow: { d: "M -160 60 C -80 20 0 -10 120 -60 M 120 -60 L 70 -70 M 120 -60 L 95 -15", x: 760, y: 1180 },
    star: { d: "M 0 -60 L 16 -18 L 60 -18 L 24 8 L 38 52 L 0 26 L -38 52 L -24 8 L -60 -18 L -16 -18 Z", x: 230, y: 520 },
    underline: { d: "M -260 0 C -120 18 80 -12 260 6", x: 540, y: 1380 },
    sparkle: { d: "M 0 -50 L 0 50 M -50 0 L 50 0 M -30 -30 L 30 30 M -30 30 L 30 -30", x: 860, y: 480 },
    heart: { d: "M 0 40 C -90 -20 -60 -80 0 -40 C 60 -80 90 -20 0 40 Z", x: 300, y: 1050 },
  };
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <svg width={video.width} height={video.height}>
        <filter id={`boil${seed}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed={seed + 3} />
          <feDisplacementMap in="SourceGraphic" scale="9" />
        </filter>
        {doodles.map((k, i) => {
          const s = SHAPES[k];
          const a = p(frame, i * 6, i * 6 + 14);
          return <path key={k} d={s.d} transform={`translate(${s.x} ${s.y})`} fill="none" stroke={color} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" filter={`url(#boil${seed})`} opacity={a} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - a} />;
        })}
      </svg>
    </AbsoluteFill>
  );
};

/* 15 VERTIGO: dolly zoom: background grows while the subject stays the same size ---------------- */
export const Vertigo: React.FC<{ background: React.ReactNode; subject: React.ReactNode; amount?: number }> = ({ background, subject, amount = 0.6 }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const k = interpolate(frame, [0, durationInFrames], [0, 1], { ...clamp, easing: io });
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `scale(${1 + amount * k})`, filter: `blur(${k * 2}px)` }}>{background}</AbsoluteFill>
      <AbsoluteFill style={{ transform: `scale(${1 - 0.04 * k})` }}>{subject}</AbsoluteFill>
    </AbsoluteFill>
  );
};

/* 16 COVER STORY: magazine cover: masthead behind the speaker's head, cover lines in front ------- */
export const CoverStory: React.FC<{ subject: React.ReactNode; masthead?: string; lines: string[]; issue?: string }> = ({ subject, masthead = "SMILE", lines, issue = "NOV 2026 · SIALKOT" }) => {
  const frame = useCurrentFrame();
  const t = useTheme();
  const a = p(frame, 0, 16);
  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, ${t.end.top}, ${t.end.bottom})` }}>
      <div style={{ position: "absolute", top: 230, width: "100%", textAlign: "center", ...headline(330, t.rule), letterSpacing: "-0.02em", opacity: a }}>{masthead}</div>
      <AbsoluteFill style={{ top: 330 }}>{subject}</AbsoluteFill>
      <div style={{ position: "absolute", top: 560, left: 80, ...mono(22, t.end.text), opacity: a }}>{issue}</div>
      {lines.slice(0, 4).map((l, i) => {
        const b = p(frame, 10 + i * 6, 24 + i * 6);
        const right = i % 2 === 1;
        return (
          <div key={i} style={{ position: "absolute", top: 760 + i * 170, [right ? "right" : "left"]: right ? video.safe.right : 80, maxWidth: 360, textAlign: right ? "right" : "left", opacity: b, transform: `translateX(${(1 - b) * (right ? 30 : -30)}px)` }}>
            <div style={{ ...headline(46, i === 0 ? t.rule : t.end.text), lineHeight: 1 }}>{l}</div>
          </div>
        );
      })}
      <div style={{ position: "absolute", bottom: 420, right: video.safe.right, ...serif(48, t.end.accent), opacity: a }}>Your smile has a home.</div>
    </AbsoluteFill>
  );
};

/* 17 GLASS TYPE: frosted-glass letters that refract the footage behind them ----------------------- */
export const GlassType: React.FC<{ text: string; children: React.ReactNode; y?: number; size?: number }> = ({ text, children, y = 760, size = 250 }) => {
  const frame = useCurrentFrame();
  const a = p(frame, 0, 18);
  const id = `glass-${text.replace(/\W/g, "")}`;
  return (
    <AbsoluteFill>
      {children}
      <svg width={video.width} height={video.height} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <mask id={id}>
            <text x="50%" y={y} textAnchor="middle" fontFamily="Oswald" fontWeight={700} fontSize={size} fill="#fff" style={{ textTransform: "uppercase" }}>{text.toUpperCase()}</text>
          </mask>
          <filter id={`${id}-f`}>
            <feGaussianBlur stdDeviation="14" />
            <feColorMatrix type="matrix" values="1.15 0 0 0 0.08  0 1.15 0 0 0.08  0 0 1.15 0 0.08  0 0 0 1 0" />
          </filter>
        </defs>
        <g mask={`url(#${id})`} opacity={a}>
          <foreignObject x="0" y="0" width={video.width} height={video.height} filter={`url(#${id}-f)`} transform={`translate(-14 -10) scale(1.03)`}>
            <div style={{ width: video.width, height: video.height }}>{children}</div>
          </foreignObject>
          <rect width="100%" height="100%" fill="rgba(255,255,255,0.12)" />
        </g>
        <text x="50%" y={y} textAnchor="middle" fontFamily="Oswald" fontWeight={700} fontSize={size} fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth={2.5} opacity={a}>{text.toUpperCase()}</text>
      </svg>
    </AbsoluteFill>
  );
};

/** Static clinic photo as a background layer. */
export const PhotoLayer: React.FC<{ src: string; dim?: number }> = ({ src, dim = 0 }) => (
  <AbsoluteFill>
    <Img src={staticFile(src)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
    {dim ? <AbsoluteFill style={{ background: `rgba(0,0,0,${dim})` }} /> : null}
  </AbsoluteFill>
);
