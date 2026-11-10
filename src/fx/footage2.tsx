/**
 * Footage effects, set 2 (19–30): built for clinic use, in Remotion code (free), frame-driven.
 * Same conventions as footage.tsx: `subject` = cut-out speaker layer, `children`/`background` = full-frame layers.
 */
import React from "react";
import { AbsoluteFill, Easing, Freeze, interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";
import { clinic, video } from "../brand";
import { useTheme } from "../theme";
import { headline, mono, serif } from "../templates/shared/text";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ease = Easing.bezier(0.22, 1, 0.36, 1);
const io = Easing.bezier(0.65, 0, 0.35, 1);
const p = (f: number, a: number, b: number, e = ease) => interpolate(f, [a, b], [0, 1], { ...clamp, easing: e });

/* 19 TEXT RING: a ring of words orbiting the speaker in 3D (back half behind, front half in front) ---- */
export const TextRing: React.FC<{ subject: React.ReactNode; background?: React.ReactNode; text: string; y?: number; radius?: number; speed?: number }> = ({
  subject, background, text, y = 960, radius = 420, speed = 0.006,
}) => {
  const frame = useCurrentFrame();
  const t = useTheme();
  const chars = `${text} · `.repeat(3).split("");
  const n = chars.length;
  const glyph = (front: boolean) =>
    chars.map((ch, i) => {
      const th = (i / n) * Math.PI * 2 + frame * speed * Math.PI * 2;
      const z = Math.sin(th);
      if (front !== z >= 0) return null;
      return (
        <div key={i} style={{ position: "absolute", left: 540 - Math.cos(th) * radius - 20, top: y + z * 60 - 40, width: 40, textAlign: "center", ...headline(70, front ? t.accent : t.muted), opacity: front ? 1 : 0.18, transform: `scale(${0.75 + 0.25 * (z + 1) / 2}) rotateY(${Math.cos(th) * 70}deg)` }}>
          {ch}
        </div>
      );
    });
  return (
    <AbsoluteFill style={{ perspective: 1400 }}>
      {background}
      {glyph(false)}
      <AbsoluteFill>{subject}</AbsoluteFill>
      {glyph(true)}
    </AbsoluteFill>
  );
};

/* 20 SPOTLIGHT: background dims and blurs, a soft spotlight falls on the speaker ---------------------- */
export const Spotlight: React.FC<{ subject: React.ReactNode; background: React.ReactNode; at?: number; x?: number; y?: number }> = ({ subject, background, at = 8, x = 50, y = 48 }) => {
  const frame = useCurrentFrame();
  const k = p(frame, at, at + 20, io);
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ filter: `blur(${k * 10}px) brightness(${1 - k * 0.55}) saturate(${1 - k * 0.5})` }}>{background}</AbsoluteFill>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 34% 30% at ${x}% ${y}%, rgba(255,240,215,${0.28 * k}), transparent 70%)`, mixBlendMode: "screen" }} />
      <AbsoluteFill>{subject}</AbsoluteFill>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 60% 45% at ${x}% ${y}%, transparent 45%, rgba(0,0,0,${0.55 * k}) 100%)` }} />
    </AbsoluteFill>
  );
};

/* 21 WHIP PAN: fast horizontal swipe with motion blur from scene A to scene B ----------------------- */
export const WhipPan: React.FC<{ from: React.ReactNode; to: React.ReactNode; at?: number; frames?: number }> = ({ from, to, at = 30, frames = 10 }) => {
  const frame = useCurrentFrame();
  const k = p(frame, at, at + frames, io);
  const blur = Math.sin(k * Math.PI) * 40;
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `translateX(${-k * 110}%)`, filter: `blur(${blur}px)` }}>{from}</AbsoluteFill>
      <AbsoluteFill style={{ transform: `translateX(${(1 - k) * 110}%)`, filter: `blur(${blur}px)` }}>{to}</AbsoluteFill>
    </AbsoluteFill>
  );
};

/* 22 SHAPE REVEAL: the next layer opens out of a tooth-shaped / rounded / circle mask, growing from the centre */
export const ShapeReveal: React.FC<{ from: React.ReactNode; to: React.ReactNode; at?: number; frames?: number; shape?: "tooth" | "rounded" | "circle" }> = ({ from, to, at = 20, frames = 24, shape = "tooth" }) => {
  const frame = useCurrentFrame();
  const k = p(frame, at, at + frames, Easing.in(Easing.cubic));
  const TOOTH = "M50 8 C66 2 86 6 90 24 C94 42 86 52 82 70 C79 86 74 96 68 96 C61 96 60 76 50 76 C40 76 39 96 32 96 C26 96 21 86 18 70 C14 52 6 42 10 24 C14 6 34 2 50 8 Z";
  const d = shape === "tooth" ? TOOTH : shape === "circle" ? "M50 0 A50 50 0 1 1 49.99 0 Z" : "M20 0 H80 A20 20 0 0 1 100 20 V80 A20 20 0 0 1 80 100 H20 A20 20 0 0 1 0 80 V20 A20 20 0 0 1 20 0 Z";
  const svg = `url("data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><path d='${d}' fill='black'/></svg>`)}")`;
  const size = `${20 + k * 900}%`; // grows far past the frame so the reveal completes
  return (
    <AbsoluteFill>
      {from}
      {k > 0 ? (
        <AbsoluteFill style={{ WebkitMaskImage: svg, maskImage: svg, WebkitMaskSize: `${size} auto`, maskSize: `${size} auto`, WebkitMaskPosition: "center", maskPosition: "center", WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat" }}>
          {to}
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};

/* 23 FREEZE INTRO: freeze frame with white outline + name card, then the clip plays on --------------- */
export const FreezeIntro: React.FC<{ subject: React.ReactNode; background: React.ReactNode; name: string; role: string; hold?: number }> = ({ subject, background, name, role, hold = 45 }) => {
  const frame = useCurrentFrame();
  const t = useTheme();
  const frozen = frame < hold;
  const card = p(frame, 4, 16) * (1 - p(frame, hold - 6, hold + 4));
  const layer = (
    <>
      {background}
      <AbsoluteFill style={{ filter: frozen ? "drop-shadow(6px 0 0 #fff) drop-shadow(-6px 0 0 #fff) drop-shadow(0 6px 0 #fff) drop-shadow(0 -6px 0 #fff)" : undefined }}>{subject}</AbsoluteFill>
    </>
  );
  return (
    <AbsoluteFill>
      {frozen ? <Freeze frame={0}>{layer}</Freeze> : layer}
      {frozen ? <AbsoluteFill style={{ background: "rgba(0,0,0,0.25)", mixBlendMode: "multiply" }} /> : null}
      <div style={{ position: "absolute", left: 90, top: 1180, opacity: card, transform: `translateX(${(1 - card) * -40}px) rotate(-2deg)` }}>
        <div style={{ ...headline(84, "#1C2220"), textTransform: "none", background: "#E8C35A", padding: "8px 22px", display: "inline-block" }}>{name}</div>
        <div style={{ ...mono(26, t.text), marginTop: 12, background: "#1C2220", padding: "8px 14px", display: "inline-block" }}>{role}</div>
      </div>
    </AbsoluteFill>
  );
};

/* 24 NOTIFICATION STACK: phone-style notifications slide in and stack ------------------------------ */
export const NotificationStack: React.FC<{ items: { app: string; title: string; body: string }[]; every?: number; top?: number }> = ({ items, every = 14, top = 300 }) => {
  const frame = useCurrentFrame();
  return (
    <>
      {items.map((n, i) => {
        const a = p(frame, i * every, i * every + 10);
        const later = items.length - 1 - i; // older ones are pushed down and shrink slightly
        const shown = Math.max(0, Math.min(later, Math.floor((frame - i * every) / every)));
        return (
          <div key={i} style={{ position: "absolute", left: 70, right: 70, top: top + shown * 18, opacity: a * (1 - shown * 0.15), transform: `translateY(${(1 - a) * -120}px) scale(${1 - shown * 0.04})`, zIndex: 10 + i }}>
            <div style={{ background: "rgba(245,245,245,0.92)", borderRadius: 30, padding: "20px 24px", boxShadow: "0 18px 40px rgba(0,0,0,0.3)", display: "flex", gap: 18, alignItems: "center" }}>
              <div style={{ width: 70, height: 70, borderRadius: 18, background: "#2B3D35", color: "#F3F1E6", display: "flex", alignItems: "center", justifyContent: "center", ...headline(28, "#F3F1E6") }}>DH</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", ...mono(18, "#6b6b6b") }}><span>{n.app}</span><span>now</span></div>
                <div style={{ ...headline(34, "#1C2220"), textTransform: "none", marginTop: 4 }}>{n.title}</div>
                <div style={{ ...serif(30, "#3D3622"), marginTop: 2 }}>{n.body}</div>
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
};

/* 25 LOCATION PIN: drawn map (no tiles, no network), pin drops on the clinic, address card ---------- */
export const LocationPin: React.FC<{ label?: string; address?: string }> = ({ label = "Dental House", address = clinic.address }) => {
  const frame = useCurrentFrame();
  const t = useTheme();
  const drop = p(frame, 10, 24, Easing.out(Easing.back(2)));
  const card = p(frame, 22, 36);
  const roads = Array.from({ length: 9 }, (_, i) => ({ y: 360 + i * 140 + (random(`ry${i}`) - 0.5) * 60, r: (random(`rr${i}`) - 0.5) * 18 }));
  return (
    <AbsoluteFill style={{ background: t.end.bottom }}>
      {roads.map((rd, i) => <div key={i} style={{ position: "absolute", left: -100, right: -100, top: rd.y, height: i % 3 === 0 ? 26 : 12, background: "#F7F8F6", transform: `rotate(${rd.r}deg)`, opacity: 0.9 }} />)}
      {Array.from({ length: 6 }, (_, i) => <div key={i} style={{ position: "absolute", top: -100, bottom: -100, left: 120 + i * 170, width: i % 2 ? 12 : 22, background: "#F7F8F6", transform: `rotate(${(random(`cv${i}`) - 0.5) * 14}deg)`, opacity: 0.9 }} />)}
      <div style={{ position: "absolute", left: 120, top: 1000, width: 240, height: 180, borderRadius: 30, background: "#BFD3B6", opacity: 0.8 }} />
      <div style={{ position: "absolute", left: 540 - 50, top: 760 - 130 + (1 - drop) * -400, width: 100, height: 130 }}>
        <svg viewBox="0 0 100 130" width={100} height={130}><path d="M50 128 C20 84 4 66 4 46 A46 46 0 0 1 96 46 C96 66 80 84 50 128 Z" fill={t.rule} /><circle cx="50" cy="46" r="18" fill="#F7F8F6" /></svg>
      </div>
      <div style={{ position: "absolute", left: 540 - 60, top: 755, width: 120, height: 26, borderRadius: 99, background: "rgba(0,0,0,0.25)", transform: `scale(${drop})` }} />
      <div style={{ position: "absolute", left: 90, right: video.safe.right, top: 880, opacity: card, transform: `translateY(${(1 - card) * 30}px)` }}>
        <div style={{ background: "#F7F8F6", borderRadius: 24, padding: "22px 26px", boxShadow: "0 20px 50px rgba(0,0,0,0.25)" }}>
          <div style={{ ...headline(52, "#1C2220") }}>{label}</div>
          <div style={{ ...mono(22, "#3D3622"), textTransform: "none", marginTop: 8, lineHeight: 1.45 }}>{address}</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* 26 COUNTDOWN: flip-style digits counting down (offer ends in …) ---------------------------------- */
export const Countdown: React.FC<{ from: number; to?: number; unit?: string; label?: string; y?: number }> = ({ from, to = 0, unit = "DAYS", label = "Offer ends in", y = 700 }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const t = useTheme();
  const v = Math.round(interpolate(frame, [8, durationInFrames - 20], [from, to], clamp));
  const flip = (frame % 12) / 12;
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: y, textAlign: "center" }}>
      <div style={{ ...mono(30, t.accent) }}>{label}</div>
      <div style={{ display: "flex", justifyContent: "center", gap: 18, marginTop: 20 }}>
        {String(v).padStart(2, "0").split("").map((d, i) => (
          <div key={i} style={{ width: 210, height: 290, borderRadius: 26, background: "#1C2220", border: `3px solid ${t.rule}`, display: "flex", alignItems: "center", justifyContent: "center", ...headline(230, t.text), position: "relative", overflow: "hidden" }}>
            {d}
            <div style={{ position: "absolute", left: 0, right: 0, top: "50%", height: 3, background: "rgba(0,0,0,0.6)" }} />
            <div style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg, rgba(255,255,255,${0.08 * (1 - flip)}), transparent 50%)` }} />
          </div>
        ))}
      </div>
      <div style={{ ...headline(56, t.accent), marginTop: 18 }}>{unit}</div>
    </div>
  );
};

/* 27 POST MOCKUP: Instagram-style post card with a heart pop (no invented like/comment counts) -------- */
export const PostMockup: React.FC<{ children: React.ReactNode; handle?: string; caption?: string }> = ({ children, handle = clinic.instagram, caption = "Your smile has a home." }) => {
  const frame = useCurrentFrame();
  const a = p(frame, 0, 14);
  const heart = interpolate(frame, [24, 30, 40, 48], [0, 1.25, 1, 0], clamp);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", background: "#EDEBE6" }}>
      <div style={{ width: 860, background: "#fff", borderRadius: 28, overflow: "hidden", boxShadow: "0 30px 80px rgba(0,0,0,0.25)", opacity: a, transform: `translateY(${(1 - a) * 40}px)` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "18px 22px", ...mono(24, "#1C2220"), textTransform: "none" }}>
          <div style={{ width: 54, height: 54, borderRadius: 99, background: "linear-gradient(45deg,#E8C35A,#C487B3)" }} />
          {handle}
        </div>
        <div style={{ width: 860, height: 1075, position: "relative", overflow: "hidden" }}>
          <div style={{ width: video.width, height: video.height, transform: `scale(${860 / video.width}) translateY(-180px)`, transformOrigin: "0 0" }}>{children}</div>
          <div style={{ position: "absolute", left: "50%", top: "50%", fontSize: 240, color: "#fff", transform: `translate(-50%,-50%) scale(${heart})`, textShadow: "0 10px 40px rgba(0,0,0,0.35)" }}>♥</div>
        </div>
        <div style={{ padding: "16px 22px 24px" }}>
          <div style={{ fontSize: 44, color: frame > 26 ? "#E0455A" : "#1C2220" }}>{frame > 26 ? "♥" : "♡"} ✎ ➤</div>
          <div style={{ ...serif(34, "#1C2220"), marginTop: 8 }}>{caption}</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* 28 MULTICAM GRID: 2×2 panels of the same footage, each cover-fitted with its own zoom, staggered in -- */
export const MulticamGrid: React.FC<{ panel: (i: number) => React.ReactNode; gap?: number }> = ({ panel, gap = 10 }) => {
  const frame = useCurrentFrame();
  const W = video.width, H = video.height;
  const w = (W - gap) / 2, h = (H - gap) / 2;
  // zoom × focus point (fraction of the full frame) per panel: wide, face, hands, tight face
  const shots = [
    { z: 1.0, fx: 0.5, fy: 0.55 }, { z: 1.9, fx: 0.5, fy: 0.42 }, { z: 1.6, fx: 0.5, fy: 0.7 }, { z: 2.6, fx: 0.52, fy: 0.42 },
  ];
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {shots.map((c, i) => {
        const a = p(frame, i * 4, i * 4 + 10);
        const k = Math.max(w / W, h / H) * c.z; // cover-fit, then zoom
        const left = w / 2 - c.fx * W * k, top = h / 2 - c.fy * H * k;
        return (
          <div key={i} style={{ position: "absolute", left: (i % 2) * (w + gap), top: Math.floor(i / 2) * (h + gap), width: w, height: h, overflow: "hidden", opacity: a }}>
            <div style={{ position: "absolute", left: Math.min(0, Math.max(w - W * k, left)), top: Math.min(0, Math.max(h - H * k, top)), width: W, height: H, transform: `scale(${k})`, transformOrigin: "0 0" }}>{panel(i)}</div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

/* 29 WORD STACK: kinetic typography, words stack up and scale to fill the frame ---------------------- */
export const WordStack: React.FC<{ words: string[]; accent?: number; every?: number; top?: number }> = ({ words, accent = -1, every = 6, top = 360 }) => {
  const frame = useCurrentFrame();
  const t = useTheme();
  return (
    <div style={{ position: "absolute", left: 80, right: video.safe.right - 20, top }}>
      {words.map((w, i) => {
        const a = p(frame, i * every, i * every + 8, Easing.out(Easing.back(1.6)));
        const size = Math.min(260, 900 / (w.length * 0.56));
        return (
          <div key={i} style={{ ...headline(size, i === accent ? t.accent : t.text), lineHeight: 0.92, transform: `scale(${a})`, transformOrigin: "left center", opacity: a > 0.01 ? 1 : 0 }}>
            {w}
          </div>
        );
      })}
    </div>
  );
};

/* 30 BRAND DUOTONE: footage mapped to two brand colours (shadows → deep, highlights → light) ---------- */
export const BrandDuotone: React.FC<{ children: React.ReactNode; dark?: string; light?: string; amount?: number }> = ({ children, dark, light, amount = 1 }) => {
  const t = useTheme();
  const d = dark ?? t.bgBottom, l = light ?? t.accent;
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ filter: "grayscale(1) contrast(1.1)" }}>{children}</AbsoluteFill>
      <AbsoluteFill style={{ background: l, mixBlendMode: "multiply", opacity: amount }} />
      <AbsoluteFill style={{ background: d, mixBlendMode: "screen", opacity: amount }} />
    </AbsoluteFill>
  );
};
