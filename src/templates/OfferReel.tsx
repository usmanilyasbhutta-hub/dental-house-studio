// Hook-first offer reel (10–12 s, read with the sound off).
// Order comes from the R2 whitening ad data (Nov 2026): teeth + keyword on frame 1, value BEFORE price,
// a price that never shows any other number, then the WhatsApp CTA.
// Photos: same box, object-fit contain, never cropped, warped or retouched. Frame 0 is the cover, so the
// hook has no fade-in. Light page (ivory) so the full-colour logo can be used.
import React from "react";
import { AbsoluteFill, Audio, Img, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { clinic, colors, video } from "../brand";
import type { OfferReelBrief } from "../brief/schema";
import { scenes, sec } from "../brief/timing";
import { FxContext } from "../fx/context";
import { Sfx } from "../fx/effects";
import { ThemeContext, themes, useTheme } from "../theme";
import { DemoWatermark } from "./shared/Hud";
import { prog } from "./shared/motion";
import { SafeZones } from "./shared/SafeZones";
import type { QcProps } from "./shared/Shell";
import { fitSize, headline, mono, serif } from "./shared/text";

const s = scenes["offer-reel"];
const GAP = 14;
const LABEL = 34; // label row above each photo

/** Content box for the current format (9:16 reel: platform safe area; 4:5 feed: plain margins). */
function useBox() {
  const { height } = useVideoConfig();
  const reel = height === video.height;
  const safe = reel ? video.safe : video.feed.safe;
  const left = Math.max(safe.left, 70);
  const right = Math.max(safe.right, 70);
  return { reel, top: safe.top + 10, left, width: video.width - left - right, height: height - safe.top - 10 - safe.bottom };
}

export const OfferReel: React.FC<{ brief: OfferReelBrief } & QcProps> = ({ brief, showSafeZones }) => {
  const { fps, durationInFrames } = useVideoConfig();
  const theme = themes[brief.theme];
  const box = useBox();
  const f = { hook: sec(s.hook, fps), value: sec(s.value, fps), price: sec(s.price, fps) };
  const at = { value: f.hook, price: f.hook + f.value, cta: f.hook + f.value + f.price };
  return (
    <ThemeContext.Provider value={theme}>
      <FxContext.Provider value={{ transition: brief.fx.transition, transitionFrames: brief.fx.transition_frames, sfx: brief.fx.sfx }}>
        <AbsoluteFill style={{ background: `linear-gradient(180deg, ${colors.ivory}, ${theme.end.top} 140%)`, color: theme.end.text }}>
          <Sequence durationInFrames={at.cta}>
            <LogoBug />
          </Sequence>
          <Sequence durationInFrames={at.value}>
            <Hook brief={brief} dur={f.hook} />
          </Sequence>
          {/* the pair stays put across value + price, so teeth are on screen until the CTA */}
          <Sequence from={at.value} durationInFrames={f.value + f.price}>
            <Strip brief={brief} dur={f.value + f.price} />
          </Sequence>
          <Sequence from={at.value} durationInFrames={f.value}>
            <Value brief={brief} dur={f.value} />
          </Sequence>
          <Sequence from={at.price} durationInFrames={f.price}>
            <Sfx name="whoosh" volume={0.3} />
            <Price brief={brief} dur={f.price} />
          </Sequence>
          <Sequence from={at.cta}>
            <Sfx name="pop" volume={0.35} />
            <Cta brief={brief} />
          </Sequence>
          {brief.music ? (
            <Audio
              src={staticFile(brief.music)}
              volume={(fr) => interpolate(fr, [0, 6, durationInFrames - 24, durationInFrames], [0.5, 0.9, 0.9, 0], { extrapolateRight: "clamp" })}
            />
          ) : null}
          {brief.demo ? <DemoWatermark /> : null}
          {showSafeZones && box.reel ? <SafeZones /> : null}
        </AbsoluteFill>
      </FxContext.Provider>
    </ThemeContext.Provider>
  );
};

/** Scene-local fade/rise. `inFrames: 0` = fully there on the first frame (cover). */
function useEnter(dur: number, inFrames = 7, out = 5) {
  const frame = useCurrentFrame();
  const a = inFrames ? prog(frame, 0, inFrames) : 1;
  const o = out ? interpolate(frame, [dur - out, dur], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 1;
  return { frame, opacity: a * o, rise: (1 - a) * 26 };
}

const Col: React.FC<{ opacity?: number; rise?: number; top?: number; children: React.ReactNode }> = ({ opacity = 1, rise = 0, top = 0, children }) => {
  const box = useBox();
  return (
    <div style={{ position: "absolute", left: box.left, top: box.top + top, width: box.width, opacity, transform: `translateY(${rise}px)` }}>{children}</div>
  );
};

/** Full-colour logo (light page). Reel: in the top band, decorative. Feed: top-left above the content. */
const LogoBug: React.FC = () => {
  const box = useBox();
  return <Img src={staticFile("brand/logo.png")} style={{ position: "absolute", top: box.reel ? 96 : 40, left: box.reel ? 64 : box.left, width: box.reel ? 190 : 160 }} />;
};

/** One clinical photo in a box of the photo's own aspect: contain, never cropped. The label sits above, not on it. */
const Photo: React.FC<{ src: string; label: string; width: number; aspect: number; strong?: boolean }> = ({ src, label, width, aspect, strong }) => {
  const t = useTheme();
  return (
    <div style={{ width }}>
      <div style={{ height: LABEL, display: "flex", alignItems: "center", gap: 12, ...mono(22, strong ? colors.maroon : t.end.muted), fontWeight: 700 }}>
        <span style={{ width: 26, height: 3, background: strong ? colors.maroon : t.end.accent }} />
        {label}
      </div>
      <div style={{ width, height: Math.round(width / aspect), background: t.end.text, borderRadius: 6, overflow: "hidden" }}>
        <Img src={staticFile(src)} style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
      </div>
    </div>
  );
};

const Note: React.FC<{ children: React.ReactNode; size?: number }> = ({ children, size = 21 }) => {
  const t = useTheme();
  return <div style={{ ...mono(size, t.end.muted), textTransform: "none", letterSpacing: "0.02em", marginTop: 12, opacity: 0.85 }}>{children}</div>;
};

// ---- 1. hook: before + after + keyword headline, complete on frame 0 ----------------
const HEADER = 236; // kicker + two headline lines + gap, px

const Hook: React.FC<{ brief: OfferReelBrief; dur: number }> = ({ brief, dur }) => {
  const t = useTheme();
  const box = useBox();
  const { frame, opacity } = useEnter(dur, 0);
  const lines = brief.hook.lines;
  const last = lines[lines.length - 1];
  const big = fitSize([last + (brief.place ? "xxxxxx" : "")], box.width, 98);
  // biggest photo width that lets both photos, labels and the note fit the box
  const maxH = (box.height - HEADER - 2 * LABEL - GAP - 44) / 2;
  const w = Math.round(Math.min(box.width, maxH * brief.photo_aspect));
  const rule = prog(frame, 4, 16);
  return (
    <Col opacity={opacity}>
      <div style={{ height: HEADER }}>
        <div style={mono(23, t.end.accent)}>{brief.label}</div>
        {lines.slice(0, -1).map((l) => (
          <div key={l} style={{ ...headline(66, t.end.text), marginTop: 12, fontWeight: 600 }}>
            {l}
          </div>
        ))}
        <div style={{ ...headline(big, t.end.text), marginTop: 6, display: "flex", alignItems: "baseline", gap: 18, whiteSpace: "nowrap" }}>
          {last}
          {brief.place ? <span style={{ ...serif(big * 0.62, colors.maroon), textTransform: "none", letterSpacing: 0 }}>{brief.place}</span> : null}
        </div>
        <div style={{ height: 5, width: 150 * rule, background: t.end.accent, marginTop: 14 }} />
      </div>
      <Photo src={brief.before} label="Before" width={w} aspect={brief.photo_aspect} />
      <div style={{ height: GAP }} />
      <Photo src={brief.after} label="After" width={w} aspect={brief.photo_aspect} strong />
      <Note>{brief.photo_note}</Note>
    </Col>
  );
};

// ---- 2 + 3. the pair, small, across value and price ---------------------------------
function stripHeight(width: number, aspect: number) {
  return LABEL + Math.round((width - GAP) / 2 / aspect) + 12 + 30 + 34;
}

const Strip: React.FC<{ brief: OfferReelBrief; dur: number }> = ({ brief, dur }) => {
  const box = useBox();
  const { opacity } = useEnter(dur, 7, 5);
  const w = Math.floor((box.width - GAP) / 2);
  return (
    <Col opacity={opacity}>
      <div style={{ display: "flex", gap: GAP }}>
        <Photo src={brief.before} label="Before" width={w} aspect={brief.photo_aspect} />
        <Photo src={brief.after} label="After" width={w} aspect={brief.photo_aspect} strong />
      </div>
      <Note size={19}>{brief.photo_note}</Note>
    </Col>
  );
};

// ---- 2. value -----------------------------------------------------------------------
const Value: React.FC<{ brief: OfferReelBrief; dur: number }> = ({ brief, dur }) => {
  const t = useTheme();
  const box = useBox();
  const { frame, opacity } = useEnter(dur, 1, 5);
  const v = brief.value;
  const size = fitSize(v.points.map((p) => p.title), box.width - 120, 70);
  const tight = !box.reel;
  return (
    <Col top={stripHeight(box.width, brief.photo_aspect)} opacity={opacity}>
      <div style={{ ...mono(24, t.end.accent), opacity: prog(frame, 0, 7) }}>{v.heading}</div>
      {v.points.map((p, i) => {
        const a = prog(frame, 3 + i * 6, 9);
        return (
          <div key={p.title} style={{ display: "flex", alignItems: "flex-start", gap: 26, marginTop: tight ? 20 : 52, opacity: a, transform: `translateX(${(1 - a) * -30}px)` }}>
            <div style={{ ...headline(size * 0.82), color: "transparent", WebkitTextStroke: `2px ${t.end.accent}`, width: 94, flexShrink: 0, lineHeight: 1.1 }}>
              {String(i + 1).padStart(2, "0")}
            </div>
            <div>
              <div style={{ ...headline(size, t.end.text), lineHeight: 1.05 }}>{p.title}</div>
              {p.sub ? <div style={{ ...serif(tight ? 36 : 42, t.end.accent), marginTop: 4 }}>{p.sub}</div> : null}
            </div>
          </div>
        );
      })}
      {v.promise ? (
        <div style={{ marginTop: tight ? 24 : 64, opacity: prog(frame, 24, 9) }}>
          <div style={{ height: 4, width: 150, background: colors.maroon }} />
          <div style={{ ...serif(tight ? 46 : 64, colors.maroon), marginTop: 16 }}>{v.promise}</div>
        </div>
      ) : null}
    </Col>
  );
};

// ---- 3. price: static digits, fade only ---------------------------------------------
const Price: React.FC<{ brief: OfferReelBrief; dur: number }> = ({ brief, dur }) => {
  const t = useTheme();
  const box = useBox();
  const { frame, opacity, rise } = useEnter(dur, 7, 5);
  const o = brief.offer;
  const until = new Date(`${o.valid_until}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  const [cur, ...num] = o.price.split(" ");
  const tight = !box.reel;
  const late = prog(frame, 8, 9);
  return (
    <Col top={stripHeight(box.width, brief.photo_aspect)} opacity={opacity} rise={rise}>
      <div style={mono(24, t.end.accent)}>{o.kicker}</div>
      <div style={{ ...headline(tight ? 64 : 78, t.end.text), marginTop: 12 }}>{o.treatment}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 28, marginTop: tight ? 14 : 44 }}>
        <div>
          {o.regular ? (
            <div style={{ ...headline(38, t.end.muted), fontWeight: 600, textTransform: "none", opacity: 0.75 }}>
              Regular <span style={{ textDecoration: "line-through", textDecorationColor: colors.maroon }}>{o.regular}</span>
            </div>
          ) : null}
          <div style={{ display: "flex", alignItems: "baseline", gap: 18, marginTop: 6 }}>
            <span style={headline(tight ? 56 : 64, t.end.accent)}>{cur}</span>
            <span style={{ ...headline(tight ? 190 : 250, t.end.text), fontVariantNumeric: "tabular-nums" }}>{num.join(" ")}</span>
          </div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 24, marginTop: tight ? 14 : 26, opacity: late }}>
        {o.badge ? (
          <div style={{ ...headline(44, colors.ivory), background: colors.maroon, padding: "12px 22px 14px", borderRadius: 4, letterSpacing: "0.04em" }}>{o.badge}</div>
        ) : null}
        <div style={{ ...headline(44, t.end.text), fontWeight: 600, textTransform: "none" }}>Valid till {until}</div>
      </div>
      {o.included ? <div style={{ ...serif(tight ? 38 : 44, t.end.accent), marginTop: tight ? 12 : 22, opacity: late }}>{o.included}</div> : null}
    </Col>
  );
};

// ---- 4. CTA -------------------------------------------------------------------------
const Cta: React.FC<{ brief: OfferReelBrief }> = ({ brief }) => {
  const t = useTheme();
  const box = useBox();
  const frame = useCurrentFrame();
  const a = prog(frame, 0, 8);
  const b = prog(frame, 6, 10);
  const c = prog(frame, 12, 10);
  const words = brief.cta.split(" ");
  const cut = Math.ceil(words.length / 2);
  const lines = words.length > 3 ? [words.slice(0, cut).join(" "), words.slice(cut).join(" ")] : [brief.cta];
  const ctaSize = fitSize(lines, box.width, 104);
  const pulse = 1 + 0.03 * Math.sin((frame / 30) * Math.PI * 2);
  const tight = !box.reel;
  return (
    <Col top={tight ? -70 : 40}>
      <Img src={staticFile("brand/logo.png")} style={{ width: tight ? 300 : 380, opacity: a, display: "block" }} />
      <div style={{ marginTop: tight ? 40 : 90, opacity: a, transform: `translateY(${(1 - a) * 26}px)` }}>
        {lines.map((l) => (
          <div key={l} style={headline(ctaSize, t.end.text)}>
            {l}
          </div>
        ))}
      </div>
      <div style={{ marginTop: tight ? 34 : 60, opacity: b, transform: `scale(${(0.94 + 0.06 * b) * pulse})`, transformOrigin: "left center", display: "inline-block" }}>
        <div style={{ ...headline(fitSize([clinic.phone], box.width - 90, 118), colors.ivory), background: colors.maroon, padding: "18px 44px 24px", borderRadius: 10, letterSpacing: "0.03em" }}>
          {clinic.phone}
        </div>
      </div>
      <div style={{ ...mono(26, t.end.accent), marginTop: 22, opacity: b }}>WhatsApp · Call</div>
      <div style={{ marginTop: tight ? 36 : 70, opacity: c }}>
        <div style={{ height: 4, width: 150, background: t.end.accent }} />
        <div style={{ ...headline(58, t.end.text), marginTop: 22 }}>{clinic.name}</div>
        <div style={{ ...serif(40, t.end.muted), marginTop: 8 }}>{clinic.addressShort}</div>
        {brief.disclaimer ? <Note size={22}>{brief.disclaimer}</Note> : null}
      </div>
    </Col>
  );
};
