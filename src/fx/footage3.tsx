/**
 * Footage effects, set 4 (39–49): the effects from the "20 video effects for Claude" reel that we didn't have yet.
 * Our own code, frame-driven, same conventions as footage.tsx / footage2.tsx:
 * `subject` = cut-out speaker layer, `background`/`children`/`from`/`to` = full-frame layers.
 * Never on clinical photos (they must stay unwarped and uncropped).
 */
import React from "react";
import { AbsoluteFill, Easing, interpolate, random, useCurrentFrame } from "remotion";
import { video } from "../brand";
import { useTheme } from "../theme";
import { headline, mono } from "../templates/shared/text";

const W = video.width, H = video.height;
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ease = Easing.bezier(0.22, 1, 0.36, 1);
const io = Easing.bezier(0.65, 0, 0.35, 1);
const p = (f: number, a: number, b: number, e = ease) => interpolate(f, [a, b], [0, 1], { ...clamp, easing: e });

/** A full-frame layer drawn at a smaller size (tile, phone screen, tunnel ring...). */
const Mini: React.FC<{ children: React.ReactNode; w: number; h: number; style?: React.CSSProperties }> = ({ children, w, h, style }) => {
  const k = Math.max(w / W, h / H);
  return (
    <div style={{ position: "relative", width: w, height: h, overflow: "hidden", ...style }}>
      <div style={{ position: "absolute", left: (w - W * k) / 2, top: (h - H * k) / 2, width: W, height: H, transform: `scale(${k})`, transformOrigin: "0 0" }}>{children}</div>
    </div>
  );
};

/* 39 GRID DIVE: a tilted grid of clips, the camera dives into one tile until it fills the frame ----- */
export const GridDive: React.FC<{ panel: (i: number) => React.ReactNode; target?: number; at?: number; frames?: number }> = ({ panel, target = 4, at = 30, frames = 28 }) => {
  const frame = useCurrentFrame();
  const cols = 3, rows = 3, gap = 18;
  const tw = (W - gap * (cols + 1)) / cols, th = (H - gap * (rows + 1)) / rows;
  const tx = gap + (target % cols) * (tw + gap) + tw / 2, ty = gap + Math.floor(target / cols) * (th + gap) + th / 2;
  const d = p(frame, at, at + frames, io);
  const scale = interpolate(d, [0, 1], [0.86, W / tw]);
  const tilt = interpolate(d, [0, 0.7, 1], [24, 8, 0]);
  return (
    <AbsoluteFill style={{ background: "#0B0E0D", perspective: 1600 }}>
      <AbsoluteFill style={{ transformOrigin: `${tx}px ${ty}px`, transform: `translate(${(W / 2 - tx) * d}px, ${(H / 2 - ty) * d}px) scale(${scale}) rotateX(${tilt}deg)` }}>
        {Array.from({ length: cols * rows }, (_, i) => {
          const a = p(frame, i * 2, i * 2 + 12);
          return (
            <div key={i} style={{ position: "absolute", left: gap + (i % cols) * (tw + gap), top: gap + Math.floor(i / cols) * (th + gap), opacity: a, transform: `translateY(${(1 - a) * 60}px)` }}>
              <Mini w={tw} h={th} style={{ borderRadius: 18 * (1 - d) + 2, boxShadow: i === target ? `0 0 0 ${4 * (1 - d)}px #fff` : undefined }}>{panel(i)}</Mini>
            </div>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* 40 MAGNIFYING LENS: a glass lens glides over the shot and magnifies what is under it --------------- */
export const MagnifyLens: React.FC<{ children: React.ReactNode; path?: [number, number][]; r?: number; zoom?: number }> = ({
  children, path = [[300, 1300], [560, 900], [700, 760]], r = 190, zoom = 2,
}) => {
  const frame = useCurrentFrame();
  const t = p(frame, 6, 70, io) * (path.length - 1);
  const k = Math.min(path.length - 2, Math.floor(t)), f = t - k;
  const x = path[k][0] + (path[k + 1][0] - path[k][0]) * f, y = path[k][1] + (path[k + 1][1] - path[k][1]) * f;
  const a = p(frame, 0, 10);
  return (
    <AbsoluteFill>
      {children}
      <div style={{ position: "absolute", left: x - r, top: y - r, width: r * 2, height: r * 2, borderRadius: "50%", overflow: "hidden", opacity: a, boxShadow: "0 20px 40px rgba(0,0,0,0.45)" }}>
        <div style={{ position: "absolute", left: r - x * zoom, top: r - y * zoom, width: W, height: H, transform: `scale(${zoom})`, transformOrigin: "0 0" }}>{children}</div>
        <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "radial-gradient(circle at 32% 28%, rgba(255,255,255,0.45), transparent 32%), radial-gradient(circle, transparent 62%, rgba(0,0,0,0.35))" }} />
      </div>
      <div style={{ position: "absolute", left: x - r - 10, top: y - r - 10, width: r * 2 + 20, height: r * 2 + 20, borderRadius: "50%", border: "12px solid #2A2A2A", boxShadow: "inset 0 0 0 3px #888", opacity: a }} />
      <div style={{ position: "absolute", left: x + r * 0.62, top: y + r * 0.62, width: 36, height: 220, borderRadius: 18, background: "linear-gradient(90deg,#3A2B20,#6B4E36,#3A2B20)", transform: "rotate(-45deg)", transformOrigin: "50% 0", opacity: a }} />
    </AbsoluteFill>
  );
};

/* 41 PORTAL: a glowing ring opens in scene A; scene B is on the other side, then the ring swallows the frame */
export const Portal: React.FC<{ from: React.ReactNode; to: React.ReactNode; at?: number; x?: number; y?: number; color?: string }> = ({ from, to, at = 10, x = 540, y = 820, color }) => {
  const frame = useCurrentFrame();
  const t = useTheme();
  const c = color ?? t.accent;
  const open = p(frame, at, at + 22, Easing.out(Easing.back(1.6)));
  const swallow = p(frame, at + 48, at + 66, io);
  const r = 230 * open + swallow * 1800;
  const spin = frame * 6;
  return (
    <AbsoluteFill>
      {from}
      <AbsoluteFill style={{ clipPath: `circle(${r}px at ${x}px ${y}px)` }}>{to}</AbsoluteFill>
      {swallow < 1 && open > 0 ? (
        <>
          <div style={{ position: "absolute", left: x - r - 26, top: y - r - 26, width: (r + 26) * 2, height: (r + 26) * 2, borderRadius: "50%", background: `conic-gradient(from ${spin}deg, ${c}, transparent 25%, #fff 40%, transparent 55%, ${c} 75%, transparent 90%, ${c})`, WebkitMask: `radial-gradient(circle, transparent ${r}px, #000 ${r + 6}px, #000 ${r + 22}px, transparent ${r + 26}px)`, mask: `radial-gradient(circle, transparent ${r}px, #000 ${r + 6}px, #000 ${r + 22}px, transparent ${r + 26}px)`, filter: "blur(1px)" }} />
          <div style={{ position: "absolute", left: x - r - 70, top: y - r - 70, width: (r + 70) * 2, height: (r + 70) * 2, borderRadius: "50%", boxShadow: `0 0 80px 20px ${c}`, opacity: 0.35 * (1 - swallow), mixBlendMode: "screen" }} />
        </>
      ) : null}
    </AbsoluteFill>
  );
};

/* 42 INFINITE ZOOM: the shot contains a framed copy of itself, endlessly (Droste), and we keep zooming in */
export const InfiniteZoom: React.FC<{ children: React.ReactNode; ratio?: number; period?: number; border?: number }> = ({ children, ratio = 0.42, period = 45, border = 14 }) => {
  const frame = useCurrentFrame();
  const z = (frame / period) % 1;
  const levels = [0, 1, 2, 3, 4, 5];
  return (
    <AbsoluteFill style={{ background: "#000", overflow: "hidden" }}>
      {levels.map((k) => {
        const scale = Math.pow(1 / ratio, z) * Math.pow(ratio, k); // level k is ratio^k of the frame; z zooms all levels in smoothly
        if (scale > 3.2 || scale < 0.02) return null;
        return (
          <div key={k} style={{ position: "absolute", left: W / 2 - (W * scale) / 2, top: H * 0.46 - (H * scale) / 2, width: W * scale, height: H * scale, zIndex: k }}>
            <div style={{ position: "absolute", inset: 0, transform: `scale(${scale})`, transformOrigin: "0 0", width: W, height: H, border: k ? `${border}px solid #F7F8F6` : undefined, borderRadius: k ? 30 : 0, overflow: "hidden", boxSizing: "border-box", boxShadow: k ? "0 30px 60px rgba(0,0,0,0.5)" : undefined }}>
              {children}
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

/* 43 CUBE SPIN: the frame is the face of a cube; it turns 90° to show the next scene on the side ----- */
export const CubeSpin: React.FC<{ front: React.ReactNode; side: React.ReactNode; at?: number; frames?: number }> = ({ front, side, at = 25, frames = 26 }) => {
  const frame = useCurrentFrame();
  const t = p(frame, at, at + frames, io);
  const pull = Math.sin(t * Math.PI); // shrink in the middle of the turn so the cube reads
  const D = W; // cube depth = frame width
  return (
    <AbsoluteFill style={{ background: "#0B0E0D", perspective: 2200 }}>
      <div style={{ position: "absolute", inset: 0, transformStyle: "preserve-3d", transform: `translateZ(${-D / 2 - pull * 900}px) rotateY(${-90 * t}deg) rotateX(${pull * 8}deg)` }}>
        <div style={{ position: "absolute", inset: 0, transform: `translateZ(${D / 2}px)`, backfaceVisibility: "hidden", overflow: "hidden" }}>{front}</div>
        <div style={{ position: "absolute", inset: 0, transform: `rotateY(90deg) translateZ(${D / 2}px)`, backfaceVisibility: "hidden", overflow: "hidden" }}>{side}</div>
      </div>
      <AbsoluteFill style={{ background: `rgba(0,0,0,${0.25 * pull})`, pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};

/* 44 LIQUID GLASS: a glass pill toolbar floats over the shot (blur + refraction + highlight), a droplet slides between items */
export const LiquidGlass: React.FC<{ children: React.ReactNode; items?: string[]; active?: number[]; y?: number; card?: { title: string; body: string } }> = ({
  children, items = ["Check-up", "Cleaning", "Whitening", "Book"], active = [0, 1, 3], y = 1360, card,
}) => {
  const frame = useCurrentFrame();
  const grow = p(frame, 4, 22, Easing.out(Easing.back(1.8)));
  const w = 820, h = 112;
  // droplet moves from item to item
  const step = Math.min(active.length - 1, Math.max(0, Math.floor((frame - 24) / 22)));
  const local = p(frame, 24 + step * 22, 24 + step * 22 + 12, io);
  const from = active[Math.max(0, step - 1)], to = active[step];
  const slot = w / items.length;
  const dx = (step === 0 ? to : from + (to - from) * local) * slot;
  const glass: React.CSSProperties = {
    background: "linear-gradient(180deg, rgba(255,255,255,0.32), rgba(255,255,255,0.08))",
    backdropFilter: "blur(18px) saturate(1.8)",
    WebkitBackdropFilter: "blur(18px) saturate(1.8)",
    boxShadow: "inset 0 1.5px 0 rgba(255,255,255,0.75), inset 0 -2px 6px rgba(255,255,255,0.2), inset 0 0 0 1px rgba(255,255,255,0.35), 0 18px 40px rgba(0,0,0,0.28)",
  };
  return (
    <AbsoluteFill>
      {children}
      {card ? (
        <div style={{ position: "absolute", left: 100, top: 300, width: 600, padding: "30px 34px", borderRadius: 40, ...glass, opacity: p(frame, 14, 30), transform: `translateY(${(1 - p(frame, 14, 30)) * 30}px)` }}>
          <div style={{ ...headline(46, "#fff") }}>{card.title}</div>
          <div style={{ ...mono(20, "rgba(255,255,255,0.85)"), textTransform: "none", letterSpacing: "0.02em", marginTop: 10 }}>{card.body}</div>
        </div>
      ) : null}
      <div style={{ position: "absolute", left: (W - w) / 2, top: y, width: w, height: h, borderRadius: h / 2, transform: `scaleX(${grow}) scaleY(${0.6 + 0.4 * grow})`, ...glass }}>
        <div style={{ position: "absolute", left: dx + 8, top: 8, width: slot - 16, height: h - 16, borderRadius: (h - 16) / 2, background: "rgba(255,255,255,0.38)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9)", opacity: frame > 24 ? 1 : 0, transform: `scaleX(${1 + 0.18 * Math.sin(local * Math.PI)})` }} />
        <div style={{ position: "absolute", inset: 0, display: "flex", opacity: p(frame, 14, 24) }}>
          {items.map((it) => (
            <div key={it} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", ...headline(30, "#fff"), textShadow: "0 1px 6px rgba(0,0,0,0.35)" }}>{it}</div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* 45 TILE TUNNEL: rings of tiles rush past the camera like a tunnel; the subject waits at the end ---- */
export const TileTunnel: React.FC<{ tiles: React.ReactNode[]; end: React.ReactNode; period?: number; settle?: number }> = ({ tiles, end, period = 22, settle = 60 }) => {
  const frame = useCurrentFrame();
  const slow = p(frame, settle - 20, settle + 10, io); // tunnel slows and fades as we arrive
  const travel = frame / period - slow * 0.5;
  const z = travel % 1;
  const rings = [0, 1, 2, 3, 4];
  const per = 10;
  return (
    <AbsoluteFill style={{ background: "#07090A" }}>
      <AbsoluteFill style={{ transform: `scale(${0.35 + 0.65 * slow})`, opacity: 0.4 + 0.6 * slow }}>{end}</AbsoluteFill>
      {rings.map((k) => {
        const scale = Math.pow(1.9, k - 3 + z);
        if (scale > 4) return null;
        const rw = W * scale, rh = H * scale;
        const tw = rw / 3.2, th = rh / 5;
        const pos: [number, number][] = [];
        for (let i = 0; i < per; i++) {
          const u = i / per;
          // walk the perimeter of the ring rectangle
          const P = 2 * (rw + rh), d = u * P;
          let x = 0, y = 0;
          if (d < rw) [x, y] = [d, 0];
          else if (d < rw + rh) [x, y] = [rw, d - rw];
          else if (d < 2 * rw + rh) [x, y] = [rw - (d - rw - rh), rh];
          else [x, y] = [0, rh - (d - 2 * rw - rh)];
          pos.push([W / 2 - rw / 2 + x - tw / 2, H / 2 - rh / 2 + y - th / 2]);
        }
        const fade = (1 - slow) * Math.min(1, scale * 1.6);
        return pos.map(([x, y], i) => (
          <div key={`${k}-${i}`} style={{ position: "absolute", left: x, top: y, opacity: fade, zIndex: Math.round(scale * 100) }}>
            <Mini w={tw} h={th} style={{ borderRadius: 10 * scale, boxShadow: "0 0 0 2px rgba(255,255,255,0.25)" }}>
              {tiles[(i + k * 3) % tiles.length]}
            </Mini>
          </div>
        ));
      })}
    </AbsoluteFill>
  );
};

/* 46 PHONE FAN: phones fan out like playing cards, each showing a clip; the centre one comes forward --- */
export const PhoneFan: React.FC<{ screen: (i: number) => React.ReactNode; count?: number; background?: React.ReactNode }> = ({ screen, count = 5, background }) => {
  const frame = useCurrentFrame();
  const t = useTheme();
  const open = p(frame, 6, 34, Easing.out(Easing.back(1.3)));
  const pw = 380, ph = 780, mid = (count - 1) / 2;
  return (
    <AbsoluteFill style={{ background: t.bgBottom }}>
      {background}
      {Array.from({ length: count }, (_, i) => {
        const o = i - mid;
        const rot = o * 13 * open;
        const lift = Math.abs(o) * 40 * open;
        return (
          <div key={i} style={{ position: "absolute", left: W / 2 - pw / 2 + o * 150 * open, top: 600 + lift, width: pw, height: ph, transform: `rotate(${rot}deg) scale(${o === 0 ? 1.06 : 0.94})`, transformOrigin: "50% 120%", zIndex: 10 - Math.abs(o) }}>
            <div style={{ position: "absolute", inset: 0, borderRadius: 56, background: "#111", boxShadow: "0 30px 60px rgba(0,0,0,0.45)", padding: 14 }}>
              <Mini w={pw - 28} h={ph - 28} style={{ borderRadius: 44 }}>{screen(i)}</Mini>
              <div style={{ position: "absolute", top: 26, left: pw / 2 - 50, width: 100, height: 26, borderRadius: 13, background: "#000" }} />
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

/* 47 SHATTER: cracks spread from a point, the frame breaks into shards that fall away to reveal the next shot */
export const Shatter: React.FC<{ from: React.ReactNode; to: React.ReactNode; at?: number; x?: number; y?: number; seed?: string }> = ({ from, to, at = 24, x = 540, y = 760, seed = "shatter" }) => {
  const frame = useCurrentFrame();
  const crack = p(frame, at - 10, at, Easing.out(Easing.quad));
  const fall = Math.max(0, frame - at);
  // shards: triangles fanning around the impact point, two rings
  const shards: { pts: [number, number][]; c: [number, number] }[] = [];
  const N = 12;
  const far = (a: number, r: number): [number, number] => [x + Math.cos(a) * r, y + Math.sin(a) * r];
  for (let i = 0; i < N; i++) {
    const a0 = (i / N) * Math.PI * 2 + random(`${seed}a${i}`) * 0.2, a1 = ((i + 1) / N) * Math.PI * 2 + random(`${seed}a${i + 1}`) * 0.2;
    const r1 = 260 + random(`${seed}r${i}`) * 160, r1b = 260 + random(`${seed}r${i + 1}`) * 160;
    shards.push({ pts: [[x, y], far(a0, r1), far(a1, r1b)], c: far((a0 + a1) / 2, r1 * 0.5) });
    shards.push({ pts: [far(a0, r1), far(a0, 2600), far(a1, 2600), far(a1, r1b)], c: far((a0 + a1) / 2, r1 + 420) });
  }
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      {to}
      {fall === 0 ? (
        <AbsoluteFill>
          {from}
          <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
            {shards.filter((_, i) => i % 2 === 0).map((s, i) => (
              <path key={i} d={`M ${s.pts[0][0]} ${s.pts[0][1]} L ${x + (s.pts[1][0] - x) * crack} ${y + (s.pts[1][1] - y) * crack}`} stroke="#fff" strokeWidth="3" opacity="0.85" />
            ))}
            <circle cx={x} cy={y} r={30 * crack} fill="none" stroke="#fff" strokeWidth="3" opacity={0.7 * crack} />
          </svg>
        </AbsoluteFill>
      ) : (
        shards.map((s, i) => {
          const vx = (s.c[0] - x) * 0.012 + (random(`${seed}vx${i}`) - 0.5) * 6;
          const vy = (s.c[1] - y) * 0.01 - 8 * random(`${seed}vy${i}`);
          const g = 1.4;
          const dx = vx * fall, dy = vy * fall + 0.5 * g * fall * fall;
          const rot = (random(`${seed}rot${i}`) - 0.5) * 14 * fall;
          const poly = s.pts.map(([px, py]) => `${px}px ${py}px`).join(",");
          return (
            <AbsoluteFill key={i} style={{ clipPath: `polygon(${poly})`, transformOrigin: `${s.c[0]}px ${s.c[1]}px`, transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg)`, opacity: interpolate(fall, [10, 26], [1, 0], clamp) }}>
              {from}
              <AbsoluteFill style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.25), transparent 40%)" }} />
            </AbsoluteFill>
          );
        })
      )}
    </AbsoluteFill>
  );
};

/* 48 RIBBON WRAP: a printed ribbon wraps around the speaker; back half behind, front half in front, text scrolling */
export const RibbonWrap: React.FC<{ subject: React.ReactNode; background?: React.ReactNode; text: string; y?: number; tilt?: number }> = ({ subject, background, text, y = 1040, tilt = -10 }) => {
  const frame = useCurrentFrame();
  const t = useTheme();
  const rx = 470, ry = 110;
  const back = `M ${540 - rx} ${y} A ${rx} ${ry} 0 0 1 ${540 + rx} ${y}`;
  const front = `M ${540 - rx} ${y} A ${rx} ${ry} 0 0 0 ${540 + rx} ${y}`;
  const words = `${text} ✦ `.repeat(6);
  const shift = -(frame * 6) % 600;
  const a = p(frame, 0, 16);
  const band = (d: string, id: string, dark: boolean) => (
    <svg width={W} height={H} style={{ position: "absolute", inset: 0, transform: `rotate(${tilt}deg)`, transformOrigin: `540px ${y}px`, opacity: a }}>
      <defs>
        <path id={id} d={d} />
      </defs>
      <use href={`#${id}`} stroke={dark ? t.rule : t.accent} strokeWidth="70" fill="none" opacity={dark ? 0.85 : 1} />
      <text dy="11" style={{ ...headline(32, dark ? t.muted : t.bgBottom), letterSpacing: "0.12em" }}>
        <textPath href={`#${id}`} startOffset={shift}>
          {words}
        </textPath>
      </text>
    </svg>
  );
  return (
    <AbsoluteFill>
      {background}
      {band(back, "rw-back", true)}
      <AbsoluteFill>{subject}</AbsoluteFill>
      {band(front, "rw-front", false)}
    </AbsoluteFill>
  );
};

/* 49 HEAD POP-OUT: the full shot shrinks into a card on a light page and the speaker's head pops out over its top edge */
export const HeadPopOut: React.FC<{ background: React.ReactNode; subject: React.ReactNode; at?: number; card?: { x: number; y: number; w: number; h: number } }> = ({
  background, subject, at = 12, card = { x: 150, y: 860, w: 780, h: 660 },
}) => {
  const frame = useCurrentFrame();
  const k = p(frame, at, at + 20, Easing.out(Easing.back(1.4)));
  const box = { x: card.x * k, y: card.y * k, w: W + (card.w - W) * k, h: H + (card.h - H) * k };
  const pop = p(frame, at + 14, at + 26, Easing.out(Easing.back(2)));
  return (
    <AbsoluteFill style={{ background: "#F4F2EC" }}>
      <div style={{ position: "absolute", left: box.x, top: box.y + box.h + 10, width: box.w, height: 30, borderRadius: "50%", background: "rgba(0,0,0,0.12)", filter: "blur(10px)", opacity: k }} />
      <div style={{ position: "absolute", left: box.x, top: box.y, width: box.w, height: box.h, overflow: "hidden", borderRadius: 34 * k, boxShadow: `0 ${30 * k}px 60px rgba(0,0,0,${0.25 * k})` }}>
        <div style={{ position: "absolute", left: -box.x, top: -box.y, width: W, height: H }}>{background}</div>
      </div>
      <AbsoluteFill style={{ clipPath: `inset(${box.y}px ${W - box.x - box.w}px ${H - box.y - box.h}px ${box.x}px round ${34 * k}px)` }}>{subject}</AbsoluteFill>
      {/* above the card: head and shoulders, popping up a little */}
      <AbsoluteFill style={{ clipPath: `inset(0 0 ${H - box.y - 2}px 0)`, transform: `translateY(${(1 - pop) * 40}px)`, opacity: k > 0.95 ? 1 : 0 }}>{subject}</AbsoluteFill>
    </AbsoluteFill>
  );
};
