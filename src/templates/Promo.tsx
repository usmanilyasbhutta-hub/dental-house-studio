import React from "react";
import { AbsoluteFill, Img, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { clinic, video } from "../brand";
import type { PromoBrief } from "../brief/schema";
import { scenes, sec } from "../brief/timing";
import { seasons, useTheme, type Season } from "../theme";
import { Sfx } from "../fx/effects";
import { renderAccent } from "./shared/Headline";
import { easeInOut, prog } from "./shared/motion";
import { Shell, type QcProps } from "./shared/Shell";
import { fitSize, headline, mono, serif } from "./shared/text";

const s = scenes.promo;
/** Text column inside the Instagram/TikTok safe area (x 60–940). */
const COL = { left: 100, right: video.width - 940 };

/**
 * Promo reel: hook readable on frame 1 → real before/after (same box, objectFit contain, never edited) → value points →
 * price card → light end card with the WhatsApp keyword. Hard cuts; motion inside each scene.
 */
export const Promo: React.FC<{ brief: PromoBrief } & QcProps> = ({ brief, showSafeZones }) => {
  const { fps } = useVideoConfig();
  const se = seasons[brief.season];
  const at = (k: keyof typeof s) => {
    const order = ["hook", "proof", "value", "price"] as const;
    let n = 0;
    for (const o of order) {
      if (o === k) break;
      n += s[o];
    }
    return sec(n, fps);
  };
  const darkFrames = at("price");
  return (
    <Shell brief={brief} endSeconds={s.end} chrome="none" end={<End brief={brief} se={se} />} showSafeZones={showSafeZones}>
      <Sequence durationInFrames={sec(s.hook, fps)}>
        <Hook brief={brief} se={se} />
      </Sequence>
      <Sequence from={at("proof")} durationInFrames={sec(s.proof, fps)}>
        <Proof brief={brief} se={se} />
      </Sequence>
      <Sequence from={at("value")} durationInFrames={sec(s.value, fps)}>
        <Value brief={brief} se={se} />
      </Sequence>
      <Sequence from={at("price")} durationInFrames={sec(s.price, fps)}>
        <Price brief={brief} se={se} />
      </Sequence>
      <Sequence durationInFrames={darkFrames}>
        <Bug se={se} total={darkFrames} />
      </Sequence>
    </Shell>
  );
};

/** Full-colour logo on a small light plate (brand rule: full-colour logo only on light), plus a progress hairline. */
const Bug: React.FC<{ se: Season; total: number }> = ({ se, total }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", top: 0, left: 0, height: 6, width: `${Math.min(1, frame / total) * 100}%`, background: se.trim }} />
      <div style={{ position: "absolute", top: 78, left: 56, padding: "14px 22px", background: se.light, borderRadius: 18, boxShadow: "0 10px 30px rgba(0,0,0,0.35)" }}>
        <Img src={staticFile("brand/logo.png")} style={{ width: 200, display: "block" }} />
      </div>
    </AbsoluteFill>
  );
};

/** Diagonal wedding band: deep panel with thin trim lines (dupatta-border feel). */
const Band: React.FC<{ se: Season; top: number; height: number; tilt?: number; children?: React.ReactNode }> = ({ se, top, height, tilt = -3, children }) => (
  <div style={{ position: "absolute", left: -80, width: video.width + 160, top, height, transform: `rotate(${tilt}deg)` }}>
    <div style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg, ${se.primary} 0%, ${se.primaryDeep} 100%)`, boxShadow: "0 40px 90px rgba(0,0,0,0.45)" }} />
    <div style={{ position: "absolute", left: 0, right: 0, top: 16, height: 3, background: se.trim, opacity: 0.85 }} />
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 16, height: 3, background: se.trim, opacity: 0.85 }} />
    <div style={{ position: "absolute", left: 0, right: 0, top: 26, height: 1.5, background: se.light, opacity: 0.35 }} />
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 26, height: 1.5, background: se.light, opacity: 0.35 }} />
    <div style={{ position: "absolute", inset: 0, transform: `rotate(${-tilt}deg)` }}>{children}</div>
  </div>
);

// ---- 1. hook: fully readable on frame 0; camera-flash + viewfinder snap ---------------------------------------------
const Hook: React.FC<{ brief: PromoBrief; se: Season }> = ({ brief, se }) => {
  const frame = useCurrentFrame();
  const lines = brief.hook.lines;
  const size = fitSize(lines, 800, 132);
  const settle = interpolate(frame, [0, 20], [1.05, 1], { extrapolateRight: "clamp", easing: easeInOut });
  const flash = interpolate(frame, [6, 8, 20], [0, 0.5, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const snap = interpolate(frame, [4, 14], [46, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: easeInOut });
  const blockH = lines.length * size * 1.06;
  const top = 900 - blockH / 2;
  const corner = (k: React.CSSProperties): React.CSSProperties => ({ position: "absolute", width: 70, height: 70, borderColor: se.light, opacity: 0.9, ...k });
  return (
    <AbsoluteFill>
      <Sfx name="click" at={6} volume={0.6} />
      <Band se={se} top={top - 120} height={blockH + 240} />
      {brief.kicker ? (
        <div style={{ position: "absolute", top: top - 230, left: COL.left, ...mono(28, se.trim) }}>{brief.kicker}</div>
      ) : null}
      <div style={{ position: "absolute", left: COL.left, top, transform: `scale(${settle})`, transformOrigin: "left center" }}>
        {lines.map((l, i) => (
          <div key={i} style={{ ...headline(size, se.light), lineHeight: 1.06 }}>
            {renderAccent(l, brief.hook.accent, size, se.trim)}
          </div>
        ))}
      </div>
      {/* viewfinder brackets around the headline: "the photo is being taken" */}
      <div style={{ position: "absolute", left: COL.left - 40 - snap, right: COL.right - 10 - snap, top: top - 60 - snap, height: blockH + 120 + snap * 2 }}>
        <div style={corner({ top: 0, left: 0, borderTop: "5px solid", borderLeft: "5px solid" })} />
        <div style={corner({ top: 0, right: 0, borderTop: "5px solid", borderRight: "5px solid" })} />
        <div style={corner({ bottom: 0, left: 0, borderBottom: "5px solid", borderLeft: "5px solid" })} />
        <div style={corner({ bottom: 0, right: 0, borderBottom: "5px solid", borderRight: "5px solid" })} />
      </div>
      <AbsoluteFill style={{ background: "#fff", opacity: flash }} />
    </AbsoluteFill>
  );
};

// ---- 2. proof: before on top, after wipes in below; same box, contain, unedited ------------------------------------
const BOX = { left: COL.left - 10, w: 850, h: 500, top1: 330, top2: 880 };

const Proof: React.FC<{ brief: PromoBrief; se: Season }> = ({ brief, se }) => {
  const t = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = brief.proof;
  const a = prog(frame, 0, 10);
  const w = interpolate(frame, [fps * 1.1, fps * 1.8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: easeInOut });
  const lbl2 = prog(frame, fps * 1.6, 10);
  const note = prog(frame, fps * 2.0, 12);
  return (
    <AbsoluteFill>
      <Sfx name="whoosh" at={0} volume={0.35} />
      <Sfx name="swoosh-out" at={Math.round(fps * 1.1)} volume={0.35} />
      <div style={{ position: "absolute", top: 248, left: COL.left, ...mono(26, se.trim), opacity: a }}>
        {p.pending ? "Photo pending · real patient only" : "Real patient · same smile · unedited"}
      </div>
      <PhotoBox src={p.before} top={BOX.top1} pending={p.pending} which="before" style={{ opacity: a, transform: `translateY(${(1 - a) * 30}px)` }}>
        <Chip text={p.labels.before} bg={t.bgBottom} fg={se.light} />
      </PhotoBox>
      <PhotoBox src={p.after} top={BOX.top2} pending={p.pending} which="after" style={{ clipPath: `inset(0 ${(1 - w) * 100}% 0 0)` }}>
        <div style={{ opacity: lbl2 }}>
          <Chip text={p.labels.after} bg={se.primary} fg={se.light} />
        </div>
      </PhotoBox>
      {w > 0 && w < 1 ? (
        <div style={{ position: "absolute", top: BOX.top2, height: BOX.h, left: BOX.left + BOX.w * w - 3, width: 6, background: se.trim }} />
      ) : null}
      <div
        style={{
          position: "absolute", top: BOX.top2 + BOX.h + 34, left: COL.left, width: 830, opacity: note,
          ...mono(24, t.muted), textTransform: "none", letterSpacing: "0.04em", lineHeight: 1.45,
        }}
      >
        {p.note}
      </div>
    </AbsoluteFill>
  );
};

const Chip: React.FC<{ text: string; bg: string; fg: string }> = ({ text, bg, fg }) => (
  <div style={{ position: "absolute", top: 18, left: 18, background: bg, color: fg, padding: "10px 20px", borderRadius: 999, ...mono(26, fg), letterSpacing: "0.12em" }}>
    {text}
  </div>
);

const PhotoBox: React.FC<{ src: string; top: number; pending: boolean; which: "before" | "after"; style?: React.CSSProperties; children?: React.ReactNode }> = ({
  src, top, pending, which, style, children,
}) => (
  <div style={{ position: "absolute", left: BOX.left, top, width: BOX.w, height: BOX.h, borderRadius: 24, overflow: "hidden", background: "#0e1211", boxShadow: "0 24px 70px rgba(0,0,0,0.5)", ...style }}>
    {pending ? (
      <AbsoluteFill style={{ border: "3px dashed rgba(245,237,224,0.45)", borderRadius: 24, justifyContent: "center", alignItems: "center", gap: 14 }}>
        <div style={mono(28, "#F5EDE0")}>Patient photo pending</div>
        <div style={{ ...mono(22, "#C4CACA"), textTransform: "none", letterSpacing: "0.05em" }}>
          {which === "before" ? "before · retractor view (yellower)" : "after · same view, same box"}
        </div>
      </AbsoluteFill>
    ) : (
      // honest comparison: identical box, objectFit contain, no crop/warp/retouch
      <Img src={staticFile(src)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }} />
    )}
    {children}
  </div>
);

// ---- 3. value points ----------------------------------------------------------------------------------------------
const Value: React.FC<{ brief: PromoBrief; se: Season }> = ({ brief, se }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pts = brief.value.points;
  const top = 560;
  return (
    <AbsoluteFill>
      {brief.value.title ? (
        <div style={{ position: "absolute", top: top - 120, left: COL.left, ...serif(84, se.trim), opacity: prog(frame, 0, 10) }}>{brief.value.title}</div>
      ) : null}
      {pts.map((p, i) => {
        const d = Math.round(fps * 0.3) * i + 4;
        const a = prog(frame, d, 12);
        return (
          <div key={i} style={{ position: "absolute", top: top + i * 200, left: COL.left, width: 830, display: "flex", alignItems: "center", gap: 34, opacity: a, transform: `translateX(${(1 - a) * -50}px)` }}>
            <Sfx name="tick" at={d} volume={0.35} />
            <div style={{ width: 12, alignSelf: "stretch", background: se.primary, borderRadius: 6, boxShadow: `0 0 0 2px ${se.trim}55` }} />
            <div style={{ ...headline(64, se.trim), minWidth: 90 }}>{String(i + 1).padStart(2, "0")}</div>
            <div style={{ ...headline(78, se.light), lineHeight: 1.04, maxWidth: 640 }}>{p}</div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// ---- 4. price card ------------------------------------------------------------------------------------------------
const Price: React.FC<{ brief: PromoBrief; se: Season }> = ({ brief, se }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = brief.price;
  const rise = spring({ frame, fps, config: { damping: 200, stiffness: 140 } });
  const strike = prog(frame, 16, 12);
  const now = spring({ frame: frame - 26, fps, config: { damping: 12, stiffness: 160, mass: 0.7 } });
  const save = spring({ frame: frame - 40, fps, config: { damping: 10, stiffness: 180 } });
  const valid = prog(frame, 48, 12);
  const until = new Date(`${p.valid_until}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  return (
    <AbsoluteFill>
      <Sfx name="whoosh" at={0} volume={0.3} />
      <Sfx name="thud" at={26} volume={0.4} />
      <Sfx name="shimmer" at={30} volume={0.35} />
      <Sfx name="pop" at={40} volume={0.4} />
      <Band se={se} top={1120} height={300} tilt={-4} />
      <div
        style={{
          position: "absolute", left: COL.left - 10, width: 850, top: 320, height: 960, borderRadius: 30,
          background: `linear-gradient(180deg, ${se.light} 0%, ${se.lightEdge} 100%)`, boxShadow: "0 40px 100px rgba(0,0,0,0.5)",
          transform: `translateY(${(1 - rise) * 120}px) scale(${0.94 + 0.06 * rise})`, opacity: rise,
          display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 70, color: se.ink,
        }}
      >
        <div style={{ position: "absolute", inset: 18, border: `3px solid ${se.trim}`, borderRadius: 20 }} />
        <div style={{ position: "absolute", inset: 28, border: `1.5px solid ${se.primary}55`, borderRadius: 16 }} />
        <Img src={staticFile("brand/logo.png")} style={{ width: 360 }} />
        <div style={{ ...mono(28, se.primary), marginTop: 34 }}>{p.label}</div>
        <div style={{ ...headline(fitSize([p.service], 700, 110), se.ink), marginTop: 14 }}>{p.service}</div>
        <div style={{ width: 240, height: 4, background: se.trim, margin: "36px 0 30px" }} />
        {p.was ? (
          <div style={{ display: "flex", alignItems: "baseline", gap: 22 }}>
            <div style={mono(26, `${se.ink}AA`)}>{p.was_label}</div>
            <div style={{ position: "relative", ...headline(62, `${se.ink}99`) }}>
              {p.was}
              <div style={{ position: "absolute", left: -6, top: "50%", height: 6, width: `calc(${strike * 100}% + 12px)`, background: se.primary, transform: "rotate(-4deg)" }} />
            </div>
          </div>
        ) : null}
        <div style={{ ...headline(fitSize([p.now], 700, 150), se.primary), marginTop: 22, transform: `scale(${0.6 + 0.4 * now})`, opacity: Math.min(1, now * 1.5) }}>
          {p.now}
        </div>
        {p.save ? (
          <div
            style={{
              marginTop: 30, background: se.primary, color: se.light, borderRadius: 999, padding: "16px 44px",
              ...headline(54, se.light), letterSpacing: "0.04em", border: `3px solid ${se.trim}`,
              transform: `rotate(-4deg) scale(${save})`,
            }}
          >
            {p.save}
          </div>
        ) : null}
        <div style={{ ...mono(28, se.ink), marginTop: 46, opacity: valid }}>
          {p.valid_label} <span style={{ color: se.primary }}>{until}</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---- 5. end card (light page, full-colour logo) -----------------------------------------------------------------
const End: React.FC<{ brief: PromoBrief; se: Season }> = ({ brief, se }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const wipe = prog(frame, 2, Math.round(fps * 0.7));
  const c = prog(frame, Math.round(fps * 0.4), Math.round(fps * 0.5));
  const k = spring({ frame: frame - Math.round(fps * 0.8), fps, config: { damping: 12, stiffness: 170 } });
  const d = prog(frame, Math.round(fps * 1.1), Math.round(fps * 0.5));
  const pulse = (frame % fps) / fps;
  const address = brief.address === "short" ? clinic.addressShort : clinic.address;
  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, ${se.light} 0%, ${se.lightEdge} 100%)`, alignItems: "center", color: se.ink }}>
      <Sfx name="click" at={Math.round(fps * 0.8)} volume={0.35} />
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 10, background: se.primary }} />
      <Img src={staticFile("brand/logo.png")} style={{ position: "absolute", top: 250, width: 560, clipPath: `inset(0 ${(1 - wipe) * 100}% 0 0)` }} />
      <div style={{ position: "absolute", top: 560, width: 820, textAlign: "center", ...headline(84, se.ink), lineHeight: 1.04, opacity: c, transform: `translateY(${(1 - c) * 24}px)` }}>
        {brief.cta}
      </div>
      {brief.whatsapp_keyword ? (
        <div style={{ position: "absolute", top: 780, transform: `scale(${k})` }}>
          <div style={{ position: "absolute", inset: 0, borderRadius: 999, border: `4px solid ${se.primary}`, transform: `scale(${1 + pulse * 0.12})`, opacity: interpolate(pulse, [0, 1], [0.7, 0]) }} />
          <div style={{ display: "flex", alignItems: "center", gap: 22, background: se.primary, borderRadius: 999, padding: "20px 48px", border: `3px solid ${se.trim}` }}>
            <div style={mono(30, se.light)}>WhatsApp</div>
            <div style={{ ...headline(66, se.light), letterSpacing: "0.06em" }}>“{brief.whatsapp_keyword}”</div>
          </div>
        </div>
      ) : null}
      <div style={{ position: "absolute", top: 960, textAlign: "center", opacity: d }}>
        <div style={mono(24, `${se.ink}BB`)}>{clinic.whatsapp ? "Call / WhatsApp" : "Call"}</div>
        <div style={{ ...headline(96, se.ink), marginTop: 8 }}>{clinic.phone}</div>
        <div style={{ width: 200, height: 4, background: se.trim, margin: "30px auto" }} />
        <div style={{ ...mono(27, se.ink), textTransform: "none", letterSpacing: "0.04em", lineHeight: 1.5, maxWidth: 780 }}>{address}</div>
        <div style={{ ...mono(25, se.primary), textTransform: "none", letterSpacing: "0.06em", marginTop: 16 }}>{clinic.instagram}</div>
      </div>
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0 }}>
        <div style={{ height: 5, background: se.trim }} />
        <div style={{ height: 16, background: se.primary }} />
      </div>
    </AbsoluteFill>
  );
};
