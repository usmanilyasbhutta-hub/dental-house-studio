import React from "react";
import { AbsoluteFill, Img, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { clinic } from "../brand";
import type { PromoBrief } from "../brief/schema";
import { scenes, sec } from "../brief/timing";
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
  const pages: { len: number; node: React.ReactNode }[] = [
    { len: sec(s.hook, fps), node: <Hook brief={brief} /> },
    { len: sec(s.proof, fps), node: <Proof brief={brief} /> },
    { len: sec(s.value, fps), node: <Value brief={brief} /> },
    { len: sec(s.price, fps), node: <Price brief={brief} accent={accent} /> },
    ...(brief.visit ? [{ len: sec(s.visit, fps), node: <Visit brief={brief} /> }] : []),
    { len: sec(s.end, fps), node: <End brief={brief} accent={accent} /> },
  ];
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
      <Sfx name="click" at={8} volume={0.55} />
      <Eyebrow text={brief.kicker} />
      <Logo />
      {lines.map((l, i) => (
        <div key={i} style={{ ...at(top + i * lh), ...font(size) }}>
          <AccentLine line={l} accent={accent} size={size} />
        </div>
      ))}
      <Hair top={top + lines.length * lh + 14} width={330} delay={18} color={P.bronze} thick={4} />
      <AbsoluteFill style={{ background: "#fff", opacity: flash }} />
    </AbsoluteFill>
  );
};

/** Hook line with the accent word in bronze serif italic and a hand-drawn underline written under it. */
const AccentLine: React.FC<{ line: string; accent?: string; size: number }> = ({ line, accent, size }) => {
  const frame = useCurrentFrame();
  const i = accent ? line.toLowerCase().indexOf(accent.toLowerCase()) : -1;
  if (!accent || i < 0) return <>{line}</>;
  const p = prog(frame, 24, 16, easeInOut);
  return (
    <>
      {line.slice(0, i)}
      <span style={{ position: "relative", ...italic(size * 1.18), letterSpacing: 0 }}>
        {line.slice(i, i + accent.length)}
        <svg viewBox="0 0 300 30" preserveAspectRatio="none" style={{ position: "absolute", left: "-2%", bottom: -14, width: "104%", height: 28, overflow: "visible" }}>
          <path d="M4 18 C 60 6, 140 26, 200 14 S 280 10, 296 16" fill="none" stroke={P.bronze} strokeWidth={5} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} opacity={p > 0.01 ? 1 : 0} />
        </svg>
      </span>
      {line.slice(i + accent.length)}
    </>
  );
};

const BOKEH = [
  [140, 1300, 70], [330, 1520, 46], [520, 1260, 58], [700, 1600, 80], [880, 1380, 52], [980, 1700, 40], [260, 1760, 64],
] as const;
const Bokeh: React.FC = () => {
  const frame = useCurrentFrame();
  const a = prog(frame, 4, 26);
  return (
    <AbsoluteFill style={{ pointerEvents: "none", mixBlendMode: "screen" }}>
      {BOKEH.map(([x, y, r], i) => (
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

// ---- 2. real case ------------------------------------------------------------------------------------------------------
const BOX = { w: 850, h: 456, top1: 510, top2: 1034 };
const label = (text: string, top: number, opacity: number) => (
  <div style={{ ...at(top), ...font(24, 500, P.soft), letterSpacing: "0.14em", textTransform: "uppercase", opacity }}>{text}</div>
);

const Proof: React.FC<{ brief: PromoBrief }> = ({ brief }) => {
  const frame = useCurrentFrame();
  const p = brief.proof;
  const before = prog(frame, 15, 14);
  const wipe = interpolate(frame, [51, 76], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: easeInOut });
  return (
    <AbsoluteFill>
      <Sfx name="whoosh" at={51} volume={0.25} />
      <Eyebrow text={p.eyebrow} delay={4} />
      <Rise top={310} delay={6} style={font(120)}>{p.title}</Rise>
      {label(p.labels.before, BOX.top1 - 38, before)}
      <PhotoBox src={p.before} top={BOX.top1} pending={p.pending} style={{ opacity: before }} />
      {label(p.labels.after, BOX.top2 - 38, prog(frame, 60, 10))}
      <PhotoBox src={p.after} top={BOX.top2} pending={p.pending} style={{ clipPath: `inset(0 ${(1 - wipe) * 100}% 0 0)` }} />
      {wipe > 0 && wipe < 1 ? <div style={{ ...at(BOX.top2, L + BOX.w * wipe - 2), width: 4, height: BOX.h, background: P.bronze }} /> : null}
      <div style={{ ...at(BOX.top2 + BOX.h + 16), ...font(24, 400, P.soft), lineHeight: 1.3, opacity: prog(frame, 76, 12) }}>{p.note}</div>
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

