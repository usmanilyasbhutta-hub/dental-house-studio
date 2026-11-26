import React from "react";
import { AbsoluteFill, Img, OffthreadVideo, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { clinic } from "../brand";
import type { PromoBrief } from "../brief/schema";
import { promoPages, scenes, sec } from "../brief/timing";
import { carousel as P, seasons } from "../theme";
import { Sfx } from "../fx/effects";
import { ease, easeInOut, prog } from "./shared/motion";
import { Shell, type QcProps } from "./shared/Shell";

const s = scenes.promo;
const PUSH = s.push;
const L = 90; // left text edge (safe area starts at 60)
const W = 850; // text/photo column width (ends at 940, inside the right safe margin)

/**
 * Promo reel, carousel look: paper pages that push left like a thumb swipe; on each page things arrive in reading order.
 * Before/after photos are shown whole (objectFit contain) in identical boxes and are never animated, zoomed or filtered.
 */
export const Promo: React.FC<{ brief: PromoBrief } & QcProps> = ({ brief, showSafeZones }) => {
  const { fps } = useVideoConfig();
  const accent = seasons[brief.season].primary;
  // page order comes from the brief (owner, Nov 2026: slider → wedding offer → meet us here → CTA)
  const node = (page: string, len: number): React.ReactNode => {
    switch (page) {
      case "hook": return brief.hook_visual === "slider" ? <SliderHook brief={brief} /> : <Hook brief={brief} />;
      case "proof": return <Proof brief={brief} />;
      case "value": return <Value brief={brief} />;
      case "offer": return <OfferHero brief={brief} accent={accent} />;
      case "map": return <MapZoom brief={brief} accent={accent} len={len} />;
      case "arrival": return <Arrival brief={brief} accent={accent} />;
      case "visit": return <Visit brief={brief} />;
      case "price": return <Price brief={brief} accent={accent} />;
      default: return <End brief={brief} accent={accent} />;
    }
  };
  const pages = promoPages(brief).map((p) => ({ len: sec(p.seconds, fps), node: node(p.page, sec(p.seconds, fps)) }));

  let from = 0;
  return (
    <Shell brief={brief} endSeconds={0} end={<></>} chrome="none" backdrop={false} showSafeZones={showSafeZones}>
      <AbsoluteFill style={{ background: P.paper }} />
      {pages.map((p, i) => {
        const last = i === pages.length - 1;
        const el = (
          <Sequence key={i} from={from} durationInFrames={p.len + (last ? 0 : PUSH)}>
            <Page first={i === 0} len={p.len}>
              {i > 0 ? <Sfx name="swoosh-out" at={0} volume={0.28} /> : null}
              {p.node}
            </Page>
          </Sequence>
        );
        from += p.len;
        return el;
      })}
    </Shell>
  );
};

/** One carousel page: pushes in from the right (except the first), drifts left under the next page. */
const Page: React.FC<{ first: boolean; len: number; children: React.ReactNode }> = ({ first, len, children }) => {
  const frame = useCurrentFrame();
  const x = first ? 0 : interpolate(frame, [0, PUSH], [1080, 0], { extrapolateRight: "clamp", easing: easeInOut });
  const out = interpolate(frame, [len, len + PUSH], [0, -320], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: easeInOut });
  const dim = interpolate(frame, [len, len + PUSH], [0, 0.12], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: P.paper, transform: `translateX(${x + out}px)`, boxShadow: first ? undefined : "-30px 0 60px rgba(51,60,57,0.10)", overflow: "hidden" }}>
      {children}
      <AbsoluteFill style={{ background: "#333C39", opacity: dim, pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};

// ---- shared pieces ------------------------------------------------------------------------------------------------
const font = (size: number, weight = 900, color: string = P.ink): React.CSSProperties => ({
  fontFamily: P.headline, fontWeight: weight, fontSize: size, color, lineHeight: 1.0, letterSpacing: weight >= 900 ? "-0.025em" : "0",
});
const italic = (size: number, color: string = P.bronze): React.CSSProperties => ({
  fontFamily: "Instrument Serif", fontStyle: "italic", fontWeight: 400, fontSize: size, color, lineHeight: 1.1,
});
const at = (top: number, left = L): React.CSSProperties => ({ position: "absolute", top, left });

const Eyebrow: React.FC<{ text?: string; delay?: number }> = ({ text, delay = 0 }) => {
  const frame = useCurrentFrame();
  if (!text) return null;
  return (
    <div style={{ ...at(250), ...font(27, 500), letterSpacing: "0.2em", textTransform: "uppercase", opacity: delay ? prog(frame, delay, 10) : 1 }}>{text}</div>
  );
};

const Logo: React.FC = () => <Img src={staticFile("brand/logo.png")} style={{ ...at(222, 700), width: 240 }} />;

/** Text rising from behind a mask. */
const Rise: React.FC<{ top: number; left?: number; delay: number; dur?: number; width?: number; style: React.CSSProperties; children: React.ReactNode }> = ({
  top, left = L, delay, dur = 12, width = W, style, children,
}) => {
  const frame = useCurrentFrame();
  const p = prog(frame, delay, dur);
  return (
    <div style={{ ...at(top, left), width, overflow: "hidden", paddingBottom: 8 }}>
      <div style={{ ...style, transform: `translateY(${(1 - p) * 105}%)` }}>{children}</div>
    </div>
  );
};

const Hair: React.FC<{ top: number; width?: number; delay: number; dur?: number; color?: string; thick?: number }> = ({
  top, width = W, delay, dur = 12, color = P.line, thick = 3,
}) => {
  const frame = useCurrentFrame();
  return <div style={{ ...at(top), height: thick, width: width * prog(frame, delay, dur), background: color }} />;
};

const Fade: React.FC<{ top: number; left?: number; delay: number; dur?: number; style?: React.CSSProperties; children: React.ReactNode }> = ({
  top, left = L, delay, dur = 12, style, children,
}) => {
  const frame = useCurrentFrame();
  const p = prog(frame, delay, dur);
  return <div style={{ ...at(top, left), width: W, opacity: p, transform: `translateY(${(1 - p) * 16}px)`, ...style }}>{children}</div>;
};

// ---- 1. hook ---------------------------------------------------------------------------------------------------------
const Hook: React.FC<{ brief: PromoBrief }> = ({ brief }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const len = durationInFrames;
  const k = frame / len;
  const flash = interpolate(frame, [8, 10, 16], [0, 0.35, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const lines = brief.hook.lines;
  const accent = brief.hook.accent;
  const size = 112;
  const lh = 128;
  const top = 400;
  const afterFirst = brief.hook_visual === "after";
  return (
    <AbsoluteFill>
      {brief.hero ? (
        <>
          <div style={{ ...at(afterFirst ? 1300 : 1060, -40), width: 1160, height: 900, transform: `translateY(${-24 * k}px) scale(${1 + 0.06 * k})`, transformOrigin: "50% 100%" }}>
            <Img src={staticFile(brief.hero.src)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "22% 45%" }} />
            <div style={{ position: "absolute", left: 0, right: 0, top: -2, height: 280, background: `linear-gradient(180deg, ${P.paper} 0%, ${P.paper}cc 35%, ${P.paper}00 100%)` }} />
          </div>
          <Bokeh minY={afterFirst ? 1460 : 0} />
        </>
      ) : null}
      {afterFirst ? (
        // proof first: the real AFTER photo is on screen from frame 0; static (no zoom, flash or sparkle on clinical photos)
        <>
          <div style={{ ...at(924), ...font(24, 500, P.soft), letterSpacing: "0.14em", textTransform: "uppercase" }}>
            {brief.proof.labels.after} · real patient{brief.proof.interval ? ` · ${brief.proof.interval}` : ""}
          </div>
          <PhotoBox src={brief.proof.after} top={962} pending={brief.proof.pending} />
        </>
      ) : null}
      {brief.hook_sub ? (
        <Fade top={top + lines.length * lh + 40} delay={14} style={{ ...font(36, 400, P.soft), lineHeight: 1.25 }}>{brief.hook_sub}</Fade>
      ) : null}
      <Sfx name="click" at={8} volume={0.55} />
      <Eyebrow text={brief.kicker} />
      <Logo />
      {lines.map((l, i) => (
        <div key={i} style={{ ...at(top + i * lh), ...font(size) }}>
          <AccentLine line={l} accent={accent} size={size} />
        </div>
      ))}
      <Hair top={top + lines.length * lh + 14} width={330} delay={18} color={P.bronze} thick={4} />
      {afterFirst ? null : <AbsoluteFill style={{ background: "#fff", opacity: flash }} />}
    </AbsoluteFill>
  );
};

/** Hook line with the accent word in bronze serif italic and a hand-drawn underline written under it. */
const AccentLine: React.FC<{ line: string; accent?: string; size: number; underline?: boolean }> = ({ line, accent, size, underline = true }) => {
  const frame = useCurrentFrame();
  const i = accent ? line.toLowerCase().indexOf(accent.toLowerCase()) : -1;
  if (!accent || i < 0) return <>{line}</>;
  const p = prog(frame, 24, 16, easeInOut);
  return (
    <>
      {line.slice(0, i)}
      <span style={{ position: "relative", ...italic(size * 1.18), letterSpacing: 0 }}>
        {line.slice(i, i + accent.length)}
        {underline ? <svg viewBox="0 0 300 30" preserveAspectRatio="none" style={{ position: "absolute", left: "-2%", bottom: -14, width: "104%", height: 28, overflow: "visible" }}>
          <path d="M4 18 C 60 6, 140 26, 200 14 S 280 10, 296 16" fill="none" stroke={P.bronze} strokeWidth={5} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} opacity={p > 0.01 ? 1 : 0} />
        </svg> : null}
      </span>
      {line.slice(i + accent.length)}
    </>
  );
};

const BOKEH = [
  [140, 1300, 70], [330, 1520, 46], [520, 1260, 58], [700, 1600, 80], [880, 1380, 52], [980, 1700, 40], [260, 1760, 64],
] as const;
const Bokeh: React.FC<{ minY?: number }> = ({ minY = 0 }) => {
  const frame = useCurrentFrame();
  const a = prog(frame, 4, 26);
  return (
    <AbsoluteFill style={{ pointerEvents: "none", mixBlendMode: "screen" }}>
      {BOKEH.filter(([, y]) => y >= minY).map(([x, y, r], i) => (
        <div
          key={i}
          style={{
            position: "absolute", left: x - r, top: y - r - frame * (0.6 + (i % 3) * 0.25), width: r * 2, height: r * 2, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(255,236,205,0.55) 0%, rgba(255,236,205,0.18) 55%, rgba(255,236,205,0) 72%)",
            opacity: a * (0.5 + 0.5 * Math.sin(frame / 9 + i)), filter: "blur(2px)",
          }}
        />
      ))}
    </AbsoluteFill>
  );
};

// ---- 1b. results-first opening: full-width after smile, then a before/after slider sweep ------------------------------------
/**
 * Direction (owner: "results appear first"): frame 0 = the real AFTER smile as a full-width band under the hook, labelled.
 * At 0.9 s a slider line sweeps across and reveals the BEFORE (same aligned box, so only the colour changes), holds for a
 * beat, then sweeps back and lands on the AFTER. Photos are never zoomed, filtered or sparkled; the line only clips them.
 */
const BAND = { top: 724, w: 1080 };
const SliderHook: React.FC<{ brief: PromoBrief }> = ({ brief }) => {
  const frame = useCurrentFrame();
  const p = brief.proof;
  const dev = p.device;
  const h = Math.round(BAND.w * 472 / 880); // aligned pair ratio (scripts/align_pair.py)
  const dh = dev ? Math.round((DEVICE.w - 2 * DEVICE.inset) / dev.aspect) + 2 * DEVICE.inset : h;
  const belowTop = dev ? DEVICE.top + dh : BAND.top + h;
  // pos = share of the width showing BEFORE, from the left
  const pos = interpolate(frame, [27, 57, 69, 99], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: easeInOut });
  const handle = interpolate(frame, [20, 27, 99, 108], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const lines = brief.hook.lines;
  const size = 100;
  const lh = 112;
  const top = 330;
  const chip = (text: string, side: "left" | "right", o: number, dark: boolean): React.ReactNode => (
    <div style={{ position: "absolute", top: dev ? 26 : 22, [side]: dev ? 30 : side === "left" ? 82 : 158, opacity: o, background: dark ? P.ink : P.paper,
      color: dark ? P.paper : P.ink, padding: "10px 20px", borderRadius: 999, ...font(26, 700, dark ? P.paper : P.ink), letterSpacing: "0.12em", textTransform: "uppercase" }}>
      {text}
    </div>
  );
  return (
    <AbsoluteFill>
      <Eyebrow text={brief.kicker} />
      <Logo />
      {lines.map((ln, i) => (
        <div key={i} style={{ ...at(top + i * lh), ...font(size) }}>
          <AccentLine line={ln} accent={brief.hook.accent} size={size} />
        </div>
      ))}
      <Hair top={top + lines.length * lh + 12} width={300} delay={18} color={P.bronze} thick={4} />
      {dev ? (
        <Device top={DEVICE.top} w={DEVICE.w} h={dh}>
          <SliderView before={dev.before} after={dev.after} w={DEVICE.w - 2 * DEVICE.inset} h={dh - 2 * DEVICE.inset} pos={pos} handle={handle} chip={chip} labels={p.labels} />
        </Device>
      ) : (
        <div style={{ ...at(BAND.top, 0), width: BAND.w, height: h, overflow: "hidden", background: P.photoBg }}>
          <SliderView before={p.before} after={p.after} w={BAND.w} h={h} pos={pos} handle={handle} chip={chip} labels={p.labels} />
        </div>
      )}
      <div style={{ ...at(belowTop + 28), ...font(24, 500, P.soft), letterSpacing: "0.1em", textTransform: "uppercase" }}>
        Real patient · same smile{p.interval ? ` · ${p.interval}` : ""}
      </div>
      <div style={{ ...at(belowTop + 68), ...font(26, 400, P.soft), lineHeight: 1.3 }}>{p.note}</div>
    </AbsoluteFill>
  );
};

/** Before/after comparison slider: after underneath, before clipped from the left up to the line. Photos are only clipped. */
const SliderView: React.FC<{
  before: string; after: string; w: number; h: number; pos: number; handle: number;
  chip: (t: string, side: "left" | "right", o: number, dark: boolean) => React.ReactNode; labels: { before: string; after: string };
}> = ({ before, after, w, h, pos, handle, chip, labels }) => (
  <>
    <Img src={staticFile(after)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }} />
    <Img src={staticFile(before)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", clipPath: `inset(0 ${(1 - pos) * 100}% 0 0)` }} />
    {chip(labels.before, "left", interpolate(pos, [0.05, 0.25], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }), true)}
    {chip(labels.after, "right", interpolate(pos, [0.75, 0.95], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }), false)}
    <div style={{ position: "absolute", top: 0, bottom: 0, left: pos * w - 2, width: 4, background: "#FFFFFF", opacity: handle, boxShadow: "0 0 12px rgba(0,0,0,0.25)" }} />
    <div style={{ position: "absolute", top: h / 2 - 34, left: pos * w - 34, width: 68, height: 68, borderRadius: "50%", background: "#FFFFFF",
      border: `3px solid ${P.bronze}`, opacity: handle, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, ...font(30, 700, P.bronze),
      boxShadow: "0 6px 18px rgba(0,0,0,0.25)" }}>
      <span>‹</span><span>›</span>
    </div>
  </>
);

/**
 * Apple-hardware-inspired frame (owner, Nov 2026): continuous-curvature ("squircle") corners, a thin titanium rim with a top
 * highlight and darker lower edge, a black bezel, and a soft two-layer shadow. One light glint crosses the RIM only (never the photo).
 */
const DEVICE = { top: 712, left: 56, w: 968, rim: 10, inset: 24, r: 86 };
function squircle(w: number, h: number, r: number, n = 4, steps = 16): string {
  // superellipse corners |x|^n + |y|^n = 1 (continuous curvature), as a CSS polygon in px
  const pts: string[] = [];
  const corner = (cx: number, cy: number, a0: number) => {
    for (let i = 0; i <= steps; i++) {
      const t = a0 + (Math.PI / 2) * (i / steps);
      const c = Math.cos(t), sn = Math.sin(t);
      const x = cx + r * Math.sign(c) * Math.abs(c) ** (2 / n);
      const y = cy + r * Math.sign(sn) * Math.abs(sn) ** (2 / n);
      pts.push(`${x.toFixed(1)}px ${y.toFixed(1)}px`);
    }
  };
  corner(w - r, h - r, 0);
  corner(r, h - r, Math.PI / 2);
  corner(r, r, Math.PI);
  corner(w - r, r, (3 * Math.PI) / 2);
  return `polygon(${pts.join(",")})`;
}
const Device: React.FC<{ top: number; w: number; h: number; children: React.ReactNode }> = ({ top, w, h, children }) => {
  const frame = useCurrentFrame();
  const glint = interpolate(frame, [6, 30], [-0.3, 1.3], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: easeInOut });
  const D = DEVICE;
  const sw = w - 2 * D.inset, sh = h - 2 * D.inset;
  return (
    <div style={{ ...at(top, D.left), width: w, height: h, filter: "drop-shadow(0 34px 40px rgba(28,34,32,0.26)) drop-shadow(0 6px 10px rgba(28,34,32,0.18))" }}>
      {/* titanium rim: dark outer edge line, brushed face with top highlight and darker lower edge, one glint */}
      <div style={{ position: "absolute", inset: 0, clipPath: squircle(w, h, D.r), background: "#5F5A53" }} />
      <div style={{ position: "absolute", left: 2, top: 2, width: w - 4, height: h - 4, clipPath: squircle(w - 4, h - 4, D.r - 2),
        background: "linear-gradient(180deg, #F4F1EC 0%, #D3CDC4 14%, #B4ADA2 50%, #9A938A 82%, #847E75 100%)" }}>
        <div style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(90deg, rgba(255,255,255,0.05) 0 2px, rgba(0,0,0,0.04) 2px 4px)" }} />
        <div style={{ position: "absolute", inset: 0, background: `linear-gradient(115deg, transparent ${glint * 100 - 8}%, rgba(255,255,255,0.95) ${glint * 100}%, transparent ${glint * 100 + 8}%)` }} />
      </div>
      {/* black bezel */}
      <div style={{ position: "absolute", left: D.rim, top: D.rim, width: w - 2 * D.rim, height: h - 2 * D.rim,
        clipPath: squircle(w - 2 * D.rim, h - 2 * D.rim, D.r - D.rim), background: "#0B0C0C" }} />
      {/* screen */}
      <div style={{ position: "absolute", left: D.inset, top: D.inset, width: sw, height: sh, overflow: "hidden",
        clipPath: squircle(sw, sh, D.r - D.inset), background: "#0B0C0C" }}>
        {children}
      </div>
    </div>
  );
};

// ---- map page: Google Earth Studio zoom to the clinic, then a pin --------------------------------------------------------
const MapZoom: React.FC<{ brief: PromoBrief; accent: string; len: number }> = ({ brief, accent, len }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const durationInFrames = len; // the page's own length (the Sequence also holds the next page's swipe overlap)
  const m = brief.map_zoom!;
  const pad = (m.pattern.match(/#+/) ?? ["###"])[0].length;
  // the whole Earth Studio render plays inside the page (time-remapped), then holds on the last frame for the pin
  const playEnd = durationInFrames - (m.landmark ? 44 : 22);
  const f = interpolate(frame, [0, playEnd], [0, m.count - 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const idx = Math.min(m.count - 1, Math.round(f));
  const file = m.pattern.replace(/#+/, String(idx).padStart(pad, "0"));
  const pin = spring({ frame: frame - (playEnd - 4), fps, config: { damping: 9, stiffness: 200 } });
  const tag = prog(frame, playEnd + 4, 8);
  // diorama: ground plane tilts back and a tilt-shift blur frames the city, easing in and out around the miniature stop
  const mini = m.miniature;
  const amt = mini
    ? interpolate(f, [mini.from - 12, mini.from, mini.to, mini.to + 14], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: easeInOut })
    : 0;
  const tilt = (mini?.tilt ?? 0) * amt;
  const src = staticFile(`${m.frames}/${file}`);
  const plane: React.CSSProperties = { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" };
  const fade = "linear-gradient(180deg, black 0%, black 18%, transparent 40%, transparent 62%, black 84%, black 100%)";
  return (
    <AbsoluteFill style={{ background: "#0B1622", overflow: "hidden" }}>
      {m.pending ? (
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", gap: 20 }}>
          <div style={{ width: 620, height: 620, borderRadius: "50%", background: "radial-gradient(circle at 35% 30%, #7FA6C9 0%, #2F5D86 45%, #122B45 80%)",
            transform: `scale(${1 + 1.6 * (frame / durationInFrames)})`, opacity: 0.9 }} />
          <div style={{ position: "absolute", top: 1180, ...font(34, 700, "#F1E7D6") }}>Google Earth zoom · footage pending</div>
        </AbsoluteFill>
      ) : (
        <AbsoluteFill style={{ perspective: 1400, perspectiveOrigin: "50% 40%" }}>
          <AbsoluteFill style={{ transform: `rotateX(${tilt}deg) scale(${1 + 0.62 * amt})`, transformOrigin: "50% 68%",
            filter: amt > 0 ? `saturate(${1 + 0.35 * amt}) contrast(${1 + 0.06 * amt})` : undefined }}>
            <Img src={src} style={plane} />
            {amt > 0.02 ? (
              <Img src={src} style={{ ...plane, filter: `blur(${10 * amt}px)`, WebkitMaskImage: fade, maskImage: fade }} />
            ) : null}
          </AbsoluteFill>
        </AbsoluteFill>
      )}
      {/* soft shade behind the stop labels so they read on bright roofs */}
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 640, background: "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.35) 55%, rgba(0,0,0,0) 100%)",
        opacity: interpolate(f, [8, 14, 104, 112], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }} />
      {/* stop labels: Pakistan → Sialkot → Commissioner Road */}
      {m.stops.map((st, i) => {
        const o = interpolate(f, [st.from, st.from + 5, st.to - 5, st.to], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        if (o <= 0) return null;
        return (
          <div key={i} style={{ position: "absolute", left: L, top: 300, opacity: o, transform: `translateY(${(1 - o) * 18}px)` }}>
            <div style={{ ...font(26, 500, "#F1E7D6"), letterSpacing: "0.2em", textTransform: "uppercase", textShadow: "0 2px 10px rgba(0,0,0,0.6)" }}>{String(i + 1).padStart(2, "0")}</div>
            <div style={{ ...font(96, 900, "#FFFFFF"), textShadow: "0 6px 24px rgba(0,0,0,0.55)", marginTop: 6 }}>{st.label}</div>
          </div>
        );
      })}
      <div style={{ position: "absolute", left: `${m.pin.x}%`, top: `${m.pin.y}%`, transform: `translate(-50%, -100%) translateY(${(1 - pin) * -120}px)`, opacity: Math.min(1, pin * 3) }}>
        <svg viewBox="0 0 24 32" style={{ width: 96, height: 128, filter: "drop-shadow(0 8px 10px rgba(0,0,0,0.4))" }}>
          <path d="M12 31s10-11 10-19A10 10 0 0 0 2 12c0 8 10 19 10 19z" fill={accent} />
          <circle cx="12" cy="12" r="4" fill={P.paper} />
        </svg>
      </div>
      <div style={{ position: "absolute", left: `${m.pin.x}%`, top: `calc(${m.pin.y}% - 250px)`, transform: `translateX(-50%) scale(${0.9 + 0.1 * tag})`, opacity: tag,
        background: "#FFFFFF", borderRadius: 18, padding: "16px 28px", boxShadow: "0 10px 24px rgba(0,0,0,0.3)", whiteSpace: "nowrap" }}>
        <div style={font(44, 900)}>{clinic.name}</div>
        <div style={{ ...font(26, 400, P.soft), marginTop: 6 }}>Ahsan Medical Centre · Commissioner Road</div>
      </div>
      {m.landmark ? <Landmark m={m} frame={frame} at={playEnd + 14} accent={accent} /> : null}
      {/* attribution required by Google Earth Studio: readable inside the safe area for the whole shot */}
      <div style={{ position: "absolute", left: L, top: 1484, ...font(24, 500, "#FFFFFF"), textShadow: "0 2px 8px rgba(0,0,0,0.7)", opacity: 0.92 }}>{m.credit}</div>
    </AbsoluteFill>
  );
};

/** Landmark across the road: hospital marker, a dashed "opposite" link from the clinic pin, and a label card. */
const Landmark: React.FC<{ m: NonNullable<PromoBrief["map_zoom"]>; frame: number; at: number; accent: string }> = ({ m, frame, at, accent }) => {
  const { fps } = useVideoConfig();
  const lm = m.landmark!;
  const W0 = 1080, H0 = 1920;
  const ax = (m.pin.x / 100) * W0, ay = (m.pin.y / 100) * H0;
  const bx = (lm.x / 100) * W0, by = (lm.y / 100) * H0;
  const link = prog(frame, at, 12, easeInOut);
  const mark = spring({ frame: frame - at - 6, fps, config: { damping: 10, stiffness: 200 } });
  const card = prog(frame, at + 12, 10);
  const mx = (ax + bx) / 2, my = Math.min(ay, by) - 70;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <svg width={W0} height={H0} style={{ position: "absolute", inset: 0 }}>
        <path d={`M ${ax} ${ay - 20} Q ${mx} ${my} ${bx} ${by - 20}`} fill="none" stroke="#FFFFFF" strokeWidth={6} strokeDasharray="14 12"
          pathLength={1} style={{ strokeDasharray: `${link} 1` }} opacity={0.95} />
      </svg>
      {/* hospital marker */}
      <div style={{ position: "absolute", left: bx - 38, top: by - 38, width: 76, height: 76, borderRadius: "50%", background: "#FFFFFF",
        border: `5px solid ${accent}`, transform: `scale(${mark})`, display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 8px 18px rgba(0,0,0,0.35)" }}>
        <div style={{ position: "relative", width: 34, height: 34 }}>
          <div style={{ position: "absolute", left: 12, top: 0, width: 10, height: 34, background: accent }} />
          <div style={{ position: "absolute", left: 0, top: 12, width: 34, height: 10, background: accent }} />
        </div>
      </div>
      <div style={{ position: "absolute", left: mx - 90, top: my - 6, width: 180, textAlign: "center", opacity: link, ...font(26, 700, "#FFFFFF"),
        letterSpacing: "0.12em", textTransform: "uppercase", textShadow: "0 2px 8px rgba(0,0,0,0.7)" }}>{lm.relation}</div>
      {/* label card, inside the safe area */}
      <div style={{ position: "absolute", left: L, top: by + 120, width: 940 - L, opacity: card, transform: `translateY(${(1 - card) * 16}px)`,
        background: "rgba(255,255,255,0.96)", borderRadius: 18, padding: "18px 26px", boxShadow: "0 10px 24px rgba(0,0,0,0.3)" }}>
        <div style={font(44, 900)}>{lm.title}</div>
        {lm.sub ? <div style={{ ...font(28, 400, P.soft), marginTop: 6 }}>{lm.sub}</div> : null}
      </div>
    </AbsoluteFill>
  );
};

/** Street-level arrival: the owner's drive-by clip with the map's numbering continued ("04 · Look for this sign"). */
const Arrival: React.FC<{ brief: PromoBrief; accent: string }> = ({ brief, accent }) => {
  const frame = useCurrentFrame();
  const a = brief.arrival!;
  const t = prog(frame, 6, 10);
  const c = prog(frame, 16, 10);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <OffthreadVideo src={staticFile(a.video)} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 620, background: "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.3) 55%, rgba(0,0,0,0) 100%)" }} />
      <div style={{ position: "absolute", left: L, top: 300, opacity: t, transform: `translateY(${(1 - t) * 18}px)` }}>
        {a.step ? <div style={{ ...font(26, 500, "#F1E7D6"), letterSpacing: "0.2em", textTransform: "uppercase", textShadow: "0 2px 10px rgba(0,0,0,0.6)" }}>{a.step}</div> : null}
        <div style={{ ...font(96, 900, "#FFFFFF"), textShadow: "0 6px 24px rgba(0,0,0,0.55)", marginTop: 6 }}>{a.title}</div>
      </div>
      <div style={{ position: "absolute", left: L, top: 1300, width: 940 - L, opacity: c, transform: `translateY(${(1 - c) * 16}px)`,
        background: "rgba(255,255,255,0.96)", borderRadius: 18, padding: "18px 26px", boxShadow: "0 10px 24px rgba(0,0,0,0.3)", borderLeft: `10px solid ${accent}` }}>
        <div style={font(46, 900)}>{a.place}</div>
        {a.sub ? <div style={{ ...font(28, 400, P.soft), marginTop: 6 }}>{a.sub}</div> : null}
      </div>
    </AbsoluteFill>
  );
};

// ---- offer page: the original wedding scene (dupatta + sherwani) carrying the offer ------------------------------------
const OfferHero: React.FC<{ brief: PromoBrief; accent: string }> = ({ brief, accent }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const k = frame / durationInFrames;
  const o = brief.offer_hook!;
  const p = brief.price;
  const until = new Date(`${p.valid_until}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  const strike = prog(frame, 34, 10);
  const size = 112;
  const lh = 128;
  const top = 400;
  const below = top + o.lines.length * lh + 30;
  if (o.style === "stack") return <OfferStack brief={brief} accent={accent} />;
  return (
    <AbsoluteFill>
      {brief.hero ? (
        <>
          <div style={{ ...at(1060, -40), width: 1160, height: 900, transform: `translateY(${-24 * k}px) scale(${1 + 0.06 * k})`, transformOrigin: "50% 100%" }}>
            <Img src={staticFile(brief.hero.src)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "22% 45%" }} />
            <div style={{ position: "absolute", left: 0, right: 0, top: -2, height: 280, background: `linear-gradient(180deg, ${P.paper} 0%, ${P.paper}cc 35%, ${P.paper}00 100%)` }} />
          </div>
          <Bokeh />
        </>
      ) : null}
      <Eyebrow text={p.eyebrow} delay={4} />
      <Logo />
      {o.lines.map((ln, i) => (
        <Rise key={i} top={top + i * lh} delay={6 + i * 5} style={font(size)}>
          <AccentLine line={ln} accent={o.accent} size={size} underline={false} />
        </Rise>
      ))}
      <Fade top={below} delay={20} style={{ display: "flex", alignItems: "baseline", gap: 26, width: 880 }}>
        <span style={font(84, 900)}>{p.now}</span>
        {p.was ? (
          <span style={font(36, 400, P.soft)}>
            {p.was_label}{" "}
            <span style={{ position: "relative" }}>
              {p.was}
              <span style={{ position: "absolute", left: -4, top: "52%", height: 4, width: `calc(${strike * 100}% + 8px)`, background: accent }} />
            </span>
          </span>
        ) : null}
      </Fade>
      <Fade top={below + 108} delay={30} style={font(32, 400, P.soft)}>
        {[p.extra, `${p.valid_label} ${until}`].filter(Boolean).join(" · ")}
      </Fade>
    </AbsoluteFill>
  );
};

/** "Wedding season / OFFER" lockup: serif italic kicker, one giant word, a stamped tag, then price + validity over the wedding photo. */
const OfferStack: React.FC<{ brief: PromoBrief; accent: string }> = ({ brief, accent }) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const k = frame / durationInFrames;
  const o = brief.offer_hook!;
  const p = brief.price;
  const until = new Date(`${p.valid_until}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  const big = spring({ frame: frame - 14, fps, config: { damping: 14, stiffness: 170 } });
  const stamp = spring({ frame: frame - 26, fps, config: { damping: 12, stiffness: 200 } });
  const strike = prog(frame, 44, 10);
  return (
    <AbsoluteFill>
      {brief.hero ? (
        <>
          <div style={{ ...at(980, -40), width: 1160, height: 1000, transform: `translateY(${-24 * k}px) scale(${1 + 0.05 * k})`, transformOrigin: "50% 100%" }}>
            <Img src={staticFile(brief.hero.src)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "22% 45%" }} />
            <div style={{ position: "absolute", left: 0, right: 0, top: -2, height: 240, background: `linear-gradient(180deg, ${P.paper} 0%, ${P.paper}d9 35%, ${P.paper}00 100%)` }} />
          </div>
          <Bokeh minY={1300} />
        </>
      ) : null}
      <Logo />
      <Rise top={330} left={L - 6} delay={4} style={{ ...italic(132), lineHeight: 1.02 }}>{o.lines[0]}</Rise>
      <div style={{ ...at(470), ...font(250, 900), letterSpacing: "-0.045em", lineHeight: 0.92, transform: `scale(${1.12 - 0.12 * big})`,
        transformOrigin: "left center", opacity: Math.min(1, big * 2) }}>
        {o.lines[1] ?? ""}
      </div>
      <div style={{ ...at(728), display: "flex", alignItems: "center", gap: 26 }}>
        {o.tag ? (
          <div style={{ background: accent, ...font(60, 900, P.paper), letterSpacing: "0.02em", padding: "14px 30px", borderRadius: 8,
            transform: `scale(${1.3 - 0.3 * stamp})`, opacity: Math.min(1, stamp * 2), transformOrigin: "left center" }}>{o.tag}</div>
        ) : null}
        {o.sub ? <div style={{ ...font(54, 900), letterSpacing: "-0.01em", lineHeight: 1.02, opacity: prog(frame, 30, 10), maxWidth: 420 }}>{o.sub}</div> : null}
      </div>
      <Fade top={878} delay={36} style={{ display: "flex", alignItems: "baseline", gap: 24, width: 880 }}>
        <span style={font(76, 900)}>{p.now}</span>
        {p.was ? (
          <span style={font(36, 400, P.soft)}>
            {p.was_label}{" "}
            <span style={{ position: "relative" }}>
              {p.was}
              <span style={{ position: "absolute", left: -4, top: "52%", height: 4, width: `calc(${strike * 100}% + 8px)`, background: accent }} />
            </span>
          </span>
        ) : null}
      </Fade>
      <Fade top={970} delay={46} style={font(32, 500)}>{[p.extra, `${p.valid_label} ${until}`].filter(Boolean).join(" · ")}</Fade>
    </AbsoluteFill>
  );
};

// ---- 2. real case ------------------------------------------------------------------------------------------------------
const BOX = { w: 850, h: 456, top1: 510, top2: 1034 };
const label = (text: string, top: number, opacity: number) => (
  <div style={{ ...at(top), ...font(24, 500, P.soft), letterSpacing: "0.14em", textTransform: "uppercase", opacity }}>{text}</div>
);

const Proof: React.FC<{ brief: PromoBrief }> = ({ brief }) => {
  const frame = useCurrentFrame();
  const p = brief.proof;
  const quick = brief.hook_visual === "slider";
  const before = quick ? prog(frame, 8, 10) : prog(frame, 15, 14);
  const wipe = quick ? prog(frame, 14, 10) : interpolate(frame, [51, 76], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: easeInOut });
  return (
    <AbsoluteFill>
      {quick ? null : <Sfx name="whoosh" at={51} volume={0.25} />}
      <Eyebrow text={p.eyebrow} delay={4} />
      <Rise top={310} delay={6} style={font(120)}>{p.title}</Rise>
      {label(p.labels.before, BOX.top1 - 38, before)}
      <PhotoBox src={p.before} top={BOX.top1} pending={p.pending} style={{ opacity: before }} />
      {label(p.interval ? `${p.labels.after} · ${p.interval}` : p.labels.after, BOX.top2 - 38, quick ? prog(frame, 16, 10) : prog(frame, 60, 10))}
      <PhotoBox src={p.after} top={BOX.top2} pending={p.pending} style={{ clipPath: `inset(0 ${(1 - wipe) * 100}% 0 0)` }} />
      {wipe > 0 && wipe < 1 ? <div style={{ ...at(BOX.top2, L + BOX.w * wipe - 2), width: 4, height: BOX.h, background: P.bronze }} /> : null}
      <div style={{ ...at(BOX.top2 + BOX.h + 16), ...font(24, 400, P.soft), lineHeight: 1.3, opacity: quick ? prog(frame, 24, 10) : prog(frame, 76, 12) }}>{p.note}</div>
    </AbsoluteFill>
  );
};

const PhotoBox: React.FC<{ src: string; top: number; pending: boolean; style?: React.CSSProperties }> = ({ src, top, pending, style }) => (
  <div style={{ ...at(top), width: BOX.w, height: BOX.h, borderRadius: 6, overflow: "hidden", background: P.photoBg, ...style }}>
    {pending ? (
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", ...font(30, 400, P.soft) }}>Patient photo pending</AbsoluteFill>
    ) : (
      // honest comparison: identical box, whole photo (contain), no zoom, filter or retouch
      <Img src={staticFile(src)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }} />
    )}
  </div>
);

// ---- 3. what's included ------------------------------------------------------------------------------------------------
const ICONS: Record<string, string[]> = {
  dentist: ["M24 8a7 7 0 1 0 0.01 0", "M10 42c1-9 7-14 14-14s13 5 14 14", "M30 31v5a3 3 0 0 1-6 0"],
  shield: ["M24 6l14 5v11c0 9-6 16-14 20C16 38 10 31 10 22V11z", "M18 24c2 3 4 4 6 4s4-1 6-4"],
  polish: ["M8 40l18-18", "M26 22l6-6 6 6-6 6z", "M38 7v7M34.5 10.5h7", "M14 9v5M11.5 11.5h5"],
  tooth: ["M14 8c4-2 7 1 10 1s6-3 10-1c5 3 3 11 1 16-2 6-2 16-5 16-2 0-3-8-6-8s-4 8-6 8c-3 0-3-10-5-16-2-5-4-13 1-16z"],
  calendar: ["M8 12h32v28H8z", "M8 20h32", "M16 6v10M32 6v10"],
};
const Icon: React.FC<{ name: string; top: number; delay: number }> = ({ name, top, delay }) => {
  const frame = useCurrentFrame();
  const p = prog(frame, delay, 16, easeInOut);
  return (
    <svg viewBox="0 0 48 48" style={{ ...at(top), width: 96, height: 96 }} fill="none" stroke={P.bronze} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
      {(ICONS[name] ?? []).map((d, i) => (
        <path key={i} d={d} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} />
      ))}
    </svg>
  );
};

const ROWS = [560, 790, 1020];
const Value: React.FC<{ brief: PromoBrief }> = ({ brief }) => {
  const frame = useCurrentFrame();
  const v = brief.value;
  return (
    <AbsoluteFill>
      <Eyebrow text={v.eyebrow} delay={4} />
      <Rise top={310} delay={6} style={font(112)}>{v.title}</Rise>
      {v.points.map((pt, i) => {
        const d = 16 + i * 18;
        const a = prog(frame, d + 6, 12);
        const b = prog(frame, d + 12, 12);
        const left = pt.icon ? 220 : L;
        return (
          <React.Fragment key={i}>
            <Sfx name="tick" at={d + 6} volume={0.3} />
            {pt.icon ? <Icon name={pt.icon} top={ROWS[i]} delay={d} /> : null}
            <div style={{ ...at(ROWS[i] + 2, left), width: 940 - left, opacity: a, transform: `translateX(${(1 - a) * 24}px)`, ...font(76), letterSpacing: "-0.01em" }}>{pt.title}</div>
            {pt.sub ? (
              <div style={{ ...at(ROWS[i] + 2 + (pt.title.length > 18 ? 172 : 90), left + 2), opacity: b, ...italic(42) }}>{pt.sub}</div>
            ) : null}
            {i < v.points.length - 1 ? <Hair top={ROWS[i] + 180} delay={d + 8} /> : null}
          </React.Fragment>
        );
      })}
    </AbsoluteFill>
  );
};

// ---- 4. price ----------------------------------------------------------------------------------------------------------
const digits = (x?: string) => (x ? Number(x.replace(/[^\d]/g, "")) : NaN);

const Price: React.FC<{ brief: PromoBrief; accent: string }> = ({ brief, accent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = brief.price;
  const now = digits(p.now);
  const was = digits(p.was);
  const roll = prog(frame, 16, 38, ease); // fast start, slow landing: the 3→2 carry takes ~2 frames
  const value = Number.isFinite(was) && Number.isFinite(now) ? was + (now - was) * roll : now;
  const settle = spring({ frame: frame - 50, fps, config: { damping: 9, stiffness: 220, mass: 0.6 } });
  const stamp = spring({ frame: frame - 56, fps, config: { damping: 12, stiffness: 200 } });
  const strike = prog(frame, 42, 10);
  const sweep = interpolate(frame, [75, 97], [-0.3, 1.3], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const until = new Date(`${p.valid_until}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  const currency = p.now.replace(/[\d,.\s]+$/, "").trim();
  return (
    <AbsoluteFill>
      {[16, 22, 28, 34, 40, 46].map((f) => <Sfx key={f} name="tick" at={f} volume={0.14} />)}
      <Sfx name="thud" at={58} volume={0.4} />
      <Eyebrow text={p.eyebrow} delay={4} />
      <Rise top={310} delay={6} style={font(112)}>{p.service}</Rise>
      {p.was ? (
        <Fade top={560} delay={10} style={{ ...font(44, 400, P.soft) }}>
          {p.was_label}{" "}
          <span style={{ position: "relative", display: "inline-block" }}>
            {p.was}
            <span style={{ position: "absolute", left: -4, top: "52%", height: 5, width: `calc(${strike * 100}% + 8px)`, background: accent }} />
          </span>
        </Fade>
      ) : null}
      {currency ? <div style={{ ...at(680), ...font(52, 900), letterSpacing: "0.06em", opacity: prog(frame, 12, 10) }}>{currency}</div> : null}
      <div style={{ ...at(735), transform: `translateY(${(1 - settle) * -10}px)`, opacity: prog(frame, 12, 8) }}>
        <Odometer value={value} target={p.now.replace(currency, "").trim()} size={268} />
        <div style={{ position: "absolute", inset: 0, mixBlendMode: "screen", pointerEvents: "none",
          background: `linear-gradient(100deg, transparent ${sweep * 100 - 12}%, rgba(255,255,255,0.55) ${sweep * 100}%, transparent ${sweep * 100 + 12}%)` }} />
      </div>
      {p.save ? (
        <div style={{ ...at(1060), background: accent, color: P.paper, ...font(50, 900, P.paper), letterSpacing: "0.04em", padding: "14px 30px", borderRadius: 6,
          transform: `scale(${1.3 - 0.3 * stamp})`, opacity: Math.min(1, stamp * 2), transformOrigin: "left center" }}>
          {p.save.toUpperCase()}
        </div>
      ) : null}
      {p.slots ? <Fade top={1076} left={L + 330} delay={62} style={{ ...font(34, 700, accent), width: 520 }}>{p.slots}</Fade> : null}
      <Hair top={1200} delay={70} />
      <Fade top={1236} delay={70} style={font(40, 700)}>{p.valid_label} {until}</Fade>
      {p.extra ? <Fade top={1306} delay={76} style={font(32, 400, P.soft)}>{p.extra}</Fade> : null}
    </AbsoluteFill>
  );
};

/**
 * Odometer: the thousands column rolls continuously and carries into the column above it, the lower digits stay as in
 * the target. `target` is the formatted final value (e.g. "21,000"); columns follow its digits and separators.
 */
const Odometer: React.FC<{ value: number; target: string; size: number }> = ({ value, target, size }) => {
  const chars = target.split("");
  const nDigits = chars.filter((c) => /\d/.test(c)).length;
  let k = nDigits; // power of ten of the next digit column, counted from the left
  const h = size * 1.02;
  return (
    <div style={{ display: "flex", ...font(size), letterSpacing: "-0.04em", fontVariantNumeric: "tabular-nums", height: h }}>
      {chars.map((c, i) => {
        if (!/\d/.test(c)) return <span key={i} style={{ lineHeight: `${h}px` }}>{c}</span>;
        k -= 1;
        const pow = 10 ** k;
        let pos: number;
        if (k < 3) pos = Number(c);
        else if (k === 3) pos = (value / 1000) % 10;
        else {
          const lower = value % pow;
          pos = Math.floor(value / pow) % 10 + Math.max(0, (lower - (pow - 1000)) / 1000);
        }
        return (
          <span key={i} style={{ display: "inline-block", height: h, overflow: "hidden", lineHeight: `${h}px` }}>
            <span style={{ display: "flex", flexDirection: "column", transform: `translateY(${-pos * h}px)` }}>
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((d, j) => <span key={j} style={{ height: h }}>{d}</span>)}
            </span>
          </span>
        );
      })}
    </div>
  );
};

// ---- 5. clinic -----------------------------------------------------------------------------------------------------------
const Visit: React.FC<{ brief: PromoBrief }> = ({ brief }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const v = brief.visit!;
  const open = prog(frame, 4, 10, easeInOut);
  const pin = spring({ frame: frame - 16, fps, config: { damping: 9, stiffness: 200 } });
  const address = brief.address === "short" ? clinic.addressShort : clinic.address;
  return (
    <AbsoluteFill>
      <Eyebrow text={v.eyebrow} delay={4} />
      <Rise top={310} delay={6} style={font(112)}>{v.title}</Rise>
      <div style={{ ...at(500), width: W, height: 637, borderRadius: 6, overflow: "hidden", clipPath: `inset(${(1 - open) * 50}% 0 ${(1 - open) * 50}% 0)` }}>
        <Img src={staticFile(v.photo)} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${1 + 0.05 * (frame / 55)})` }} />
      </div>
      <div style={{ ...at(1170), display: "flex", alignItems: "center", gap: 22 }}>
        <div style={{ overflow: "hidden", paddingBottom: 6 }}>
          <div style={{ ...font(96), transform: `translateY(${(1 - prog(frame, 12, 12)) * 105}%)` }}>{clinic.name}</div>
        </div>
        <svg viewBox="0 0 24 32" style={{ width: 46, height: 62, transform: `translateY(${(1 - pin) * -70}px)`, opacity: Math.min(1, pin * 3) }}>
          <path d="M12 31s10-11 10-19A10 10 0 0 0 2 12c0 8 10 19 10 19z" fill={P.bronze} />
          <circle cx="12" cy="12" r="4" fill={P.paper} />
        </svg>
      </div>
      <Fade top={1290} delay={22} style={font(32, 400, P.soft)}>{address}</Fade>
    </AbsoluteFill>
  );
};

// ---- 6. end card ---------------------------------------------------------------------------------------------------------
const End: React.FC<{ brief: PromoBrief; accent: string }> = ({ brief, accent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const kw = brief.whatsapp_keyword;
  const typed = kw ? `“${kw}”` : "";
  const shown = Math.max(0, Math.min(typed.length, Math.floor((frame - 12) / 3) + 1));
  const typingDone = frame >= 12 + typed.length * 3;
  const cursor = !typingDone || Math.floor(frame / 8) % 2 === 0;
  const bubble = spring({ frame: frame - 36, fps, config: { damping: 11, stiffness: 190 } });
  const address = brief.address === "short" ? clinic.addressShort : clinic.address;
  return (
    <AbsoluteFill>
      {brief.hero ? (
        <Img src={staticFile(brief.hero.src)} style={{ ...at(1380, -40), width: 1160, height: 600, objectFit: "cover", objectPosition: "50% 30%", opacity: 0.18 }} />
      ) : null}
      {typed.split("").map((_, i) => <Sfx key={i} name="tick" at={12 + i * 3} volume={0.18} />)}
      <Sfx name="pop" at={36} volume={0.4} />
      <Eyebrow text={brief.end.eyebrow} delay={2} />
      <Logo />
      <Rise top={380} delay={2} style={{ ...font(46, 700), letterSpacing: "0.02em", textTransform: "uppercase" }}>{brief.cta}</Rise>
      {kw ? (
        <>
          <Rise top={480} delay={4} width={600} style={font(130)}>WhatsApp</Rise>
          <div style={{ ...at(620), ...font(200, 900, accent), whiteSpace: "pre" }}>
            {typed.slice(0, shown)}
            {cursor && frame >= 10 ? <span style={{ display: "inline-block", width: 10, height: 170, background: accent, marginLeft: 10, verticalAlign: "-6%" }} /> : null}
          </div>
          <Hair top={850} width={560} delay={32} color={accent} thick={8} />
          <div style={{ ...at(500, 720), transform: `scale(${bubble})`, transformOrigin: "0% 100%", background: "#FFFFFF", border: `2px solid ${P.line}`,
            borderRadius: "22px 22px 22px 6px", padding: "14px 22px", boxShadow: "0 10px 24px rgba(51,60,57,0.12)", display: "flex", gap: 12, alignItems: "baseline" }}>
            <span style={font(34, 700)}>{kw}</span>
            <span style={{ ...font(28, 700, P.bronze), letterSpacing: "-0.12em" }}>✓✓</span>
          </div>
        </>
      ) : null}
      <Fade top={950} delay={42} style={{ ...font(120), letterSpacing: "-0.01em" }}>{clinic.phone.replace("-", " ")}</Fade>
      <Hair top={1110} delay={46} />
      <Fade top={1140} delay={48} style={font(46, 900)}>{clinic.name}</Fade>
      <Fade top={1204} delay={50} style={font(30, 400, P.soft)}>{address}</Fade>
      {brief.end.disclaimer ? <Fade top={1310} delay={54} style={font(24, 400, P.soft)}>{brief.end.disclaimer}</Fade> : null}
    </AbsoluteFill>
  );
};

