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

/* 01 ORBIT: small clip cards orbit AROUND the speaker in 3D (behind, then in front) ----------------- */
export const Orbit: React.FC<{ subject: React.ReactNode; background?: React.ReactNode; cards: React.ReactNode[]; radius?: number; speed?: number; y?: number }> = ({
  subject, background, cards, radius = 380, speed = 0.012, y = 980,
}) => {
  const frame = useCurrentFrame();
  const n = cards.length;
  const items = cards.map((c, i) => {
    const th = frame * speed * Math.PI * 2 + (i / n) * Math.PI * 2;
    const z = Math.sin(th); // -1 behind … +1 in front
    return { c, i, x: 540 + Math.cos(th) * radius, yy: y + Math.sin(th) * 70, z, s: 0.62 + 0.28 * (z + 1) / 2 };
  });
  const card = (it: (typeof items)[number]) => (
    <div key={it.i} style={{ position: "absolute", left: it.x - 120, top: it.yy - 210, width: 240, height: 420, transform: `scale(${it.s}) rotateY(${-Math.cos(frame * speed * Math.PI * 2 + (it.i / n) * Math.PI * 2) * 25}deg)`, borderRadius: 26, overflow: "hidden", border: "5px solid #F7F8F6", boxShadow: "0 20px 50px rgba(0,0,0,0.45)", filter: it.z < 0 ? "brightness(0.75) blur(1px)" : undefined }}>
      {it.c}
    </div>
  );
  return (
    <AbsoluteFill style={{ perspective: 1600 }}>
      {background}
      {items.filter((it) => it.z < 0).map(card)}
      <AbsoluteFill>{subject}</AbsoluteFill>
      {items.filter((it) => it.z >= 0).map(card)}
    </AbsoluteFill>
  );
};

/* 02 COUCH WALL: the wall behind the speaker fills with pinned photos / screenshots; speaker in front -- */
export const CouchWall: React.FC<{ subject: React.ReactNode; background?: React.ReactNode; tiles: React.ReactNode[]; top?: number; bottom?: number; every?: number }> = ({
  subject, background, tiles, top = 300, bottom = 1150, every = 4,
}) => {
  const frame = useCurrentFrame();
  const cols = 4, rows = Math.ceil(tiles.length / cols);
  const w = 230, h = (bottom - top) / rows - 18;
  return (
    <AbsoluteFill>
      {background}
      {tiles.map((tile, i) => {
        const a = p(frame, i * every, i * every + 8);
        const col = i % cols, row = Math.floor(i / cols);
        const rot = (random(`cw${i}`) - 0.5) * 8;
        return (
          <div key={i} style={{ position: "absolute", left: 40 + col * (w + 22) + (row % 2) * 30, top: top + row * (h + 18), width: w, height: h, transform: `rotate(${rot}deg) scale(${0.6 + 0.4 * a})`, opacity: a, borderRadius: 8, overflow: "hidden", border: "6px solid #fff", boxShadow: "0 12px 28px rgba(0,0,0,0.4)" }}>
            {tile}
          </div>
        );
      })}
      <AbsoluteFill>{subject}</AbsoluteFill>
    </AbsoluteFill>
  );
};
/** Kept for "wall of screens" looks. */
export const VideoWall: React.FC<{ children: React.ReactNode; cols?: number; rows?: number }> = ({ children, cols = 3, rows = 4 }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const zoom = interpolate(frame, [0, durationInFrames], [1.0, 2.6], { ...clamp, easing: io });
  const w = video.width / cols, h = video.height / rows;
  return (
    <AbsoluteFill style={{ background: "#0b0e0d", transform: `scale(${zoom})`, transformOrigin: "50% 48%" }}>
      {Array.from({ length: cols * rows }, (_, i) => (
        <div key={i} style={{ position: "absolute", left: (i % cols) * w + 6, top: Math.floor(i / cols) * h + 6, width: w - 12, height: h - 12, overflow: "hidden", borderRadius: 10 }}>
          <div style={{ width: video.width, height: video.height, transform: `scale(${w / video.width})`, transformOrigin: "0 0" }}>{children}</div>
        </div>
      ))}
    </AbsoluteFill>
  );
};

/* 03 UI WORLD: a big app window lives in the scene above/behind the speaker; files drop in ----------- */
export const UIWorld: React.FC<{ subject: React.ReactNode; background?: React.ReactNode; app?: string; prompt?: string; thumbs?: React.ReactNode[]; tag?: string }> = ({
  subject, background, app = "Dental House Studio", prompt = "Make a reel from these clips", thumbs = [], tag = "RAW CLIPS",
}) => {
  const frame = useCurrentFrame();
  const t = useTheme();
  const win = p(frame, 0, 14);
  const typed = Math.max(0, Math.floor((frame - 30) * 1.4));
  return (
    <AbsoluteFill>
      {background}
      <div style={{ position: "absolute", left: 70, right: 70, top: 300, opacity: win, transform: `translateY(${(1 - win) * 40}px) scale(${0.96 + 0.04 * win})` }}>
        <div style={{ background: "#F5F2EC", borderRadius: 30, padding: "22px 26px 26px", boxShadow: "0 40px 90px rgba(0,0,0,0.45)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, ...mono(22, t.bgTop) }}>
            <span style={{ color: t.rule, fontSize: 28 }}>✳</span> {app}
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 20, alignItems: "center" }}>
            {thumbs.slice(0, 5).map((th, i) => {
              const a = p(frame, 8 + i * 5, 16 + i * 5);
              return <div key={i} style={{ width: 118, height: 160, borderRadius: 12, overflow: "hidden", transform: `translateY(${(1 - a) * -260}px) rotate(${(1 - a) * (i % 2 ? 12 : -12)}deg)`, opacity: a, border: "3px solid #fff", boxShadow: "0 10px 24px rgba(0,0,0,0.25)" }}>{th}</div>;
            })}
            <div style={{ marginLeft: 6, ...mono(18, "#1C2220"), background: "#E8C35A", padding: "6px 12px", borderRadius: 8, opacity: p(frame, 32, 40) }}>{tag}</div>
          </div>
          <div style={{ marginTop: 18, background: "#fff", borderRadius: 16, padding: "18px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ ...serif(34, "#3D3622") }}>{prompt.slice(0, typed)}<span style={{ opacity: Math.floor(frame / 12) % 2 }}>|</span></div>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: t.rule, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26 }}>↑</div>
          </div>
        </div>
      </div>
      <AbsoluteFill>{subject}</AbsoluteFill>
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

/** 06b PHONE BESIDE: a phone floats next to the speaker showing an app screen (the reel's version). */
export const PhoneBeside: React.FC<{ screen: React.ReactNode; side?: "left" | "right"; y?: number }> = ({ screen, side = "right", y = 700 }) => {
  const frame = useCurrentFrame();
  const a = p(frame, 0, 16);
  const float = Math.sin(frame / 22) * 10;
  return (
    <div style={{ position: "absolute", top: y + float, [side]: 70, width: 330, height: 680, borderRadius: 54, background: "#111", padding: 12, boxShadow: "0 40px 90px rgba(0,0,0,0.55), inset 0 0 0 3px #3a3a3a", transform: `translateX(${(1 - a) * (side === "right" ? 200 : -200)}px) rotate(${side === "right" ? 6 : -6}deg)`, opacity: a }}>
      <div style={{ width: "100%", height: "100%", borderRadius: 44, overflow: "hidden", position: "relative", background: "#151A18" }}>{screen}</div>
    </div>
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

/* 08 HEADLINE WALL: paper notes pop onto the wall behind the speaker, one by one ------------------ */
export const HeadlineWall: React.FC<{ headlines: string[]; subject?: React.ReactNode; background?: React.ReactNode; every?: number }> = ({ headlines, subject, background, every = 5 }) => {
  const frame = useCurrentFrame();
  const t = useTheme();
  // slots around the speaker's head/shoulders (left / right columns, a few on top)
  const slots = [[90, 330], [760, 360], [120, 620], [800, 640], [330, 280], [610, 300], [70, 900], [820, 930], [470, 250], [180, 1150], [790, 1180]];
  return (
    <AbsoluteFill>
      {background ?? <AbsoluteFill style={{ background: t.bgBottom }} />}
      {headlines.slice(0, slots.length).map((h, i) => {
        const [x, y] = slots[i];
        const a = p(frame, i * every, i * every + 7);
        const rot = (random(`hw${i}`) - 0.5) * 10;
        return (
          <div key={i} style={{ position: "absolute", left: x, top: y, width: 220, transform: `rotate(${rot}deg) scale(${0.5 + 0.5 * a})`, opacity: a }}>
            <div style={{ background: i % 3 === 1 ? "#1C2220" : "#F7F3E8", color: i % 3 === 1 ? "#F7F8F6" : "#1C2220", padding: "16px 16px 18px", boxShadow: "0 10px 24px rgba(0,0,0,0.35)", ...serif(30, i % 3 === 1 ? "#F7F8F6" : "#1C2220"), lineHeight: 1.12 }}>
              {h}
            </div>
            <div style={{ position: "absolute", top: -12, left: 80, width: 60, height: 22, background: "rgba(232,195,90,0.75)", transform: `rotate(${-rot}deg)` }} />
          </div>
        );
      })}
      {subject ? <AbsoluteFill>{subject}</AbsoluteFill> : null}
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

/** 10b TREND LINE: calendar grid + rising line with arrow and a "SCALE ↗" pill behind the speaker. */
export const TrendLine: React.FC<{ subject?: React.ReactNode; label?: string; days?: string[] }> = ({ subject, label = "GROW ↗", days = ["M", "T", "W", "T", "F", "S", "S"] }) => {
  const frame = useCurrentFrame();
  const t = useTheme();
  const g = p(frame, 6, 50);
  const pts = Array.from({ length: 30 }, (_, i) => {
    const u = i / 29;
    return [90 + u * 900, 1050 - u * 640 - Math.sin(u * 9) * 40 * (1 - u)] as const;
  });
  const n = Math.max(2, Math.round(pts.length * g));
  const d = pts.slice(0, n).map(([x, y], i) => `${i ? "L" : "M"} ${x.toFixed(0)} ${y.toFixed(0)}`).join(" ");
  const [ex, ey] = pts[n - 1];
  return (
    <AbsoluteFill style={{ background: t.bgBottom }}>
      <div style={{ position: "absolute", top: 300, left: 90, right: 90, display: "flex", justifyContent: "space-between", ...mono(30, t.muted) }}>{days.map((x, i) => <span key={i}>{x}</span>)}</div>
      {Array.from({ length: 7 }, (_, i) => <div key={i} style={{ position: "absolute", top: 360, bottom: 600, left: 100 + i * 147, width: 1, background: "rgba(255,255,255,0.08)" }} />)}
      <svg width={video.width} height={video.height} style={{ position: "absolute", inset: 0 }}>
        <path d={d} fill="none" stroke="#E8C35A" strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 0 14px rgba(232,195,90,0.7))" }} />
        <circle cx={ex} cy={ey} r={14} fill="#E8C35A" />
      </svg>
      <div style={{ position: "absolute", left: Math.min(ex - 60, 780), top: ey - 90, ...headline(36, "#1C2220"), background: "#E8C35A", padding: "8px 18px", borderRadius: 30, opacity: g > 0.6 ? 1 : 0 }}>{label}</div>
      {subject ? <AbsoluteFill>{subject}</AbsoluteFill> : null}
    </AbsoluteFill>
  );
};

/* 11 PULL-BACK REVEAL: full-screen clip pulls back into a phone, or into an editor app window --------- */
export const PullBackReveal: React.FC<{ children: React.ReactNode; at?: number; frames?: number; backdrop?: React.ReactNode; device?: "phone" | "editor"; steps?: string[] }> = ({
  children, at = 15, frames = 30, backdrop, device = "editor", steps = ["Transcribed clip", "Picked the take", "Cut 3 shots", "Captions added", "Rendered"],
}) => {
  const frame = useCurrentFrame();
  const t = useTheme();
  const k = p(frame, at, at + frames, io);
  if (device === "phone") {
    const scale = interpolate(k, [0, 1], [1.65, 0.62]);
    return (
      <AbsoluteFill style={{ background: backdrop ? undefined : `radial-gradient(circle at 50% 40%, ${t.bgTop}, ${t.bgBottom})` }}>
        {backdrop}
        <PhoneMockup scale={scale} tilt={k > 0.95}>{children}</PhoneMockup>
      </AbsoluteFill>
    );
  }
  // editor: the clip ends up as the preview of an editing app, with a checklist and a render bar
  const s = interpolate(k, [0, 1], [1, 0.5]);
  const ui = p(frame, at + frames * 0.6, at + frames + 6);
  const done = Math.floor(interpolate(frame, [at + frames, at + frames + 50], [0, steps.length], clamp));
  const prog = interpolate(frame, [at + frames, at + frames + 55], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ background: "#EEEAE2" }}>
      <div style={{ position: "absolute", left: 70, right: 70, top: 300, height: 1220, borderRadius: 34, background: "#F7F5F0", boxShadow: "0 30px 80px rgba(0,0,0,0.25)", opacity: ui }}>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "20px 26px", ...mono(20, "#6b6b6b") }}><span>● ● ●</span><span>clip-01.mp4</span><span>Assistant</span></div>
        <div style={{ position: "absolute", left: 22, top: 330, width: 330, background: "#fff", borderRadius: 18, padding: "16px 18px", boxShadow: "0 10px 30px rgba(0,0,0,0.12)" }}>
          <div style={{ ...mono(18, t.bgTop) }}>● Working on <span style={{ background: t.rule, color: "#fff", padding: "2px 8px", borderRadius: 6 }}>edit</span></div>
          {steps.map((st, i) => (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12, ...headline(24, i < done ? "#1C2220" : "#A5A8A5"), textTransform: "none" }}>
              <span style={{ width: 22, height: 22, borderRadius: 99, background: i < done ? "#4CAF6E" : "transparent", border: `2px solid ${i < done ? "#4CAF6E" : "#C9CCC9"}`, color: "#fff", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>{i < done ? "✓" : ""}</span>
              {st}
            </div>
          ))}
        </div>
        <div style={{ position: "absolute", left: 30, right: 30, bottom: 40, height: 60, borderRadius: 12, background: "#E3E6EE", overflow: "hidden" }}>
          <div style={{ width: `${prog * 100}%`, height: "100%", background: "#5B7FE0" }} />
          <div style={{ position: "absolute", left: 14, top: 18, ...mono(18, "#1C2220") }}>rendering {Math.round(prog * 150)} / 150</div>
        </div>
      </div>
      <div style={{ position: "absolute", left: 0, top: 0, width: video.width, height: video.height, transform: `translate(${k * 400}px, ${k * 330}px) scale(${s})`, transformOrigin: "0 0", borderRadius: 24 * k / s, overflow: "hidden", boxShadow: k > 0.1 ? "0 20px 50px rgba(0,0,0,0.3)" : undefined }}>
        {children}
      </div>
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

/* 13 PAPER CUT: scrapbook: paper background, pencil scribbles, sticker-cut speaker, ransom-note letters - */
export const PaperCut: React.FC<{ subject: React.ReactNode; letters?: string; paper?: string; seed?: string }> = ({ subject, letters = "100%", paper = "#F2E3A0", seed = "paper" }) => {
  const frame = useCurrentFrame();
  const step = Math.floor(frame / 2.5); // ~12 fps stop-motion holds
  const jit = (k: string) => (random(`${seed}${k}${step}`) - 0.5) * 6;
  const scribble = (cx: number, cy: number, w: number, hgt: number, col: string, k: string) => {
    let d = `M ${cx - w / 2} ${cy}`;
    for (let i = 0; i < 14; i++) d += ` L ${cx - w / 2 + (i + 1) * (w / 14) + (random(`${k}${i}${step}`) - 0.5) * 10} ${cy + (i % 2 ? -hgt / 2 : hgt / 2)}`;
    return <path d={d} fill="none" stroke={col} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" opacity={0.85} />;
  };
  const shown = Math.min(letters.length, Math.floor(frame / 6) + 1);
  return (
    <AbsoluteFill style={{ background: paper }}>
      <AbsoluteFill style={{ opacity: 0.25, mixBlendMode: "multiply", backgroundImage: "repeating-linear-gradient(17deg, #b9a560 0 1px, transparent 1px 5px)" }} />
      <svg width={video.width} height={video.height} style={{ position: "absolute", inset: 0 }}>
        {scribble(560, 520, 620, 180, "#8C7BD9", "s1")}
        {scribble(760, 1200, 360, 220, "#E07A9E", "s2")}
        <text x={160 + jit("x")} y={1240} fontSize={70} fill="#1C2220" fontFamily="Oswald">✕ ✕</text>
        <path d={`M 700 1420 c 30 -40 60 40 90 0 s 60 40 90 0 s 60 40 90 0`} fill="none" stroke="#1C2220" strokeWidth={6} />
      </svg>
      <div style={{ position: "absolute", left: 90, top: 300, display: "flex", gap: 10 }}>
        {letters.slice(0, shown).split("").map((ch, i) => (
          <div key={i} style={{ ...headline(110, i % 2 ? "#F7F8F6" : "#1C2220"), background: i % 2 ? "#1C2220" : ["#F7F8F6", "#9EC5E8", "#F3B6C8"][i % 3], padding: "4px 14px", transform: `rotate(${(random(`l${i}`) - 0.5) * 16}deg)`, boxShadow: "4px 6px 0 rgba(0,0,0,0.25)", fontFamily: i % 3 === 2 ? "Instrument Serif" : "Oswald" }}>{ch}</div>
        ))}
      </div>
      <AbsoluteFill style={{ transform: `translate(${jit("sx")}px, ${jit("sy")}px) rotate(${jit("sr") * 0.2}deg)`, filter: "drop-shadow(5px 0 0 #fff) drop-shadow(-5px 0 0 #fff) drop-shadow(0 5px 0 #fff) drop-shadow(0 -5px 0 #fff) drop-shadow(8px 12px 0 rgba(0,0,0,0.25))" }}>
        {subject}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* 14 DOODLE BOIL: a boiling white outline traced around the speaker + boiling hand-drawn doodles ------ */
export const DoodleBoil: React.FC<{ subject?: React.ReactNode; doodles?: ("arrow" | "circle" | "star" | "underline" | "sparkle" | "heart" | "clapper" | "box")[]; color?: string }> = ({
  subject, doodles = ["clapper", "heart", "box", "star"], color = "#F7F8F6",
}) => {
  const frame = useCurrentFrame();
  const seed = Math.floor(frame / 4) % 3; // boil: 3 drawings cycled every 4 frames
  const SHAPES: Record<string, { d: string; x: number; y: number }> = {
    circle: { d: "M 0 -110 C 120 -110 170 -20 150 50 C 120 140 -90 150 -150 60 C -200 -30 -100 -115 10 -100", x: 540, y: 760 },
    arrow: { d: "M -160 60 C -80 20 0 -10 120 -60 M 120 -60 L 70 -70 M 120 -60 L 95 -15", x: 760, y: 1180 },
    star: { d: "M 0 -60 L 16 -18 L 60 -18 L 24 8 L 38 52 L 0 26 L -38 52 L -24 8 L -60 -18 L -16 -18 Z", x: 860, y: 1250 },
    underline: { d: "M -260 0 C -120 18 80 -12 260 6", x: 540, y: 1460 },
    sparkle: { d: "M 0 -50 L 0 50 M -50 0 L 50 0 M -30 -30 L 30 30 M -30 30 L 30 -30", x: 860, y: 480 },
    heart: { d: "M 0 40 C -90 -20 -60 -80 0 -40 C 60 -80 90 -20 0 40 Z", x: 820, y: 620 },
    clapper: { d: "M -90 -10 L 90 -10 L 90 90 L -90 90 Z M -90 -10 L -80 -60 L 95 -45 L 90 -10 M -50 -55 L -60 -10 M 0 -50 L -10 -10 M 50 -47 L 40 -10", x: 230, y: 560 },
    box: { d: "M -60 -50 L 60 -55 L 65 55 L -55 60 Z", x: 240, y: 1100 },
  };
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <svg width={0} height={0} style={{ position: "absolute" }}>
        <filter id={`outline-boil${seed}`} x="-5%" y="-5%" width="110%" height="110%">
          <feMorphology in="SourceAlpha" operator="dilate" radius="7" result="fat" />
          <feMorphology in="SourceAlpha" operator="dilate" radius="2" result="thin" />
          <feComposite in="fat" in2="thin" operator="out" result="ring" />
          <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="2" seed={seed + 7} result="n" />
          <feDisplacementMap in="ring" in2="n" scale="10" result="wobble" />
          <feFlood floodColor={color} />
          <feComposite in2="wobble" operator="in" />
        </filter>
      </svg>
      {subject ? <AbsoluteFill style={{ filter: `url(#outline-boil${seed})` }}>{subject}</AbsoluteFill> : null}
      <svg width={video.width} height={video.height} style={{ position: "absolute", inset: 0 }}>
        <filter id={`boil${seed}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed={seed + 3} />
          <feDisplacementMap in="SourceGraphic" scale="9" />
        </filter>
        {doodles.map((k, i) => {
          const s2 = SHAPES[k];
          const a = p(frame, i * 6, i * 6 + 14);
          return <path key={k} d={s2.d} transform={`translate(${s2.x} ${s2.y})`} fill="none" stroke={k === "heart" ? "#F3A6BD" : color} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" filter={`url(#boil${seed})`} opacity={a} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - a} />;
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

/* 17 GLASS TYPE: huge glass letters standing in the room BEHIND the speaker ------------------------ */
export const GlassType: React.FC<{ text: string; background: React.ReactNode; subject?: React.ReactNode; y?: number; size?: number }> = ({ text, background, subject, y = 900, size = 300 }) => {
  const frame = useCurrentFrame();
  const a = p(frame, 0, 20);
  const id = `glass-${text.replace(/\W/g, "")}`;
  const T = text.toUpperCase();
  return (
    <AbsoluteFill>
      {background}
      <svg width={video.width} height={video.height} style={{ position: "absolute", inset: 0, opacity: a, transform: `translateY(${(1 - a) * 40}px)` }}>
        <defs>
          <mask id={id}><text x="50%" y={y} textAnchor="middle" fontFamily="Oswald" fontWeight={700} fontSize={size} fill="#fff">{T}</text></mask>
          <linearGradient id={`${id}-g`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0.55" /><stop offset="0.45" stopColor="#fff" stopOpacity="0.08" /><stop offset="0.6" stopColor="#fff" stopOpacity="0.35" /><stop offset="1" stopColor="#fff" stopOpacity="0.05" />
          </linearGradient>
          <filter id={`${id}-f`}><feGaussianBlur stdDeviation="10" /></filter>
        </defs>
        <g mask={`url(#${id})`}>
          <foreignObject x="0" y="0" width={video.width} height={video.height} filter={`url(#${id}-f)`} transform="translate(0 -24) scale(1.04)">
            <div style={{ width: video.width, height: video.height }}>{background}</div>
          </foreignObject>
          <rect width="100%" height="100%" fill={`url(#${id}-g)`} />
        </g>
        <text x="50%" y={y} textAnchor="middle" fontFamily="Oswald" fontWeight={700} fontSize={size} fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth={3} />
        <text x="50%" y={y} textAnchor="middle" fontFamily="Oswald" fontWeight={700} fontSize={size} fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth={2.5}>{T}</text>
      </svg>
      {subject ? <AbsoluteFill>{subject}</AbsoluteFill> : null}
    </AbsoluteFill>
  );
};

/* 18 PUNCH CAPTION: the reel's big white words, one keyword in brand yellow, popping in ------------- */
export const PunchCaption: React.FC<{ words: string; keyword?: string; y?: number; every?: number }> = ({ words, keyword, y = 1250, every = 4 }) => {
  const frame = useCurrentFrame();
  const list = words.split(" ");
  return (
    <div style={{ position: "absolute", left: video.safe.left + 20, right: video.safe.right + 20, top: y, textAlign: "center" }}>
      {list.map((w, i) => {
        const a = p(frame, i * every, i * every + 6);
        const key = keyword && w.toLowerCase().replace(/\W/g, "") === keyword.toLowerCase();
        return (
          <span key={i} style={{ display: "inline-block", margin: "0 0.18em", ...headline(key ? 110 : 76, key ? "#E8C35A" : "#F7F8F6"), textTransform: "none", opacity: a, transform: `translateY(${(1 - a) * 20}px) scale(${key ? 0.8 + 0.2 * a : 1})`, textShadow: "0 4px 20px rgba(0,0,0,0.55)" }}>{w}</span>
        );
      })}
    </div>
  );
};

/** Static clinic photo as a background layer. */
export const PhotoLayer: React.FC<{ src: string; dim?: number }> = ({ src, dim = 0 }) => (
  <AbsoluteFill>
    <Img src={staticFile(src)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
    {dim ? <AbsoluteFill style={{ background: `rgba(0,0,0,${dim})` }} /> : null}
  </AbsoluteFill>
);
