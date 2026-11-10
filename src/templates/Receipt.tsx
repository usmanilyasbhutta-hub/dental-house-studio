import React from "react";
import { AbsoluteFill, Easing, Img, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { evolvePath } from "@remotion/paths";
import { clinic, colors, fonts, video } from "../brand";
import type { ReceiptBrief } from "../brief/schema";
import { RECEIPT, receiptHeight, receiptTimes } from "../brief/timing";
import { useTheme } from "../theme";
import { HalftoneReveal } from "../fx/Halftone";
import { Sfx } from "../fx/effects";
import { KineticHeadline } from "./shared/Headline";
import { Shell, type QcProps } from "./shared/Shell";
import { headline } from "./shared/text";

const PRINTER = { top: 380, height: 136, width: 880 };
const SLOT = PRINTER.top + PRINTER.height - 18;
const PAPER_W = 720;
const INK = "#2B2622";
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const mono = (size: number, color = INK, weight = 500): React.CSSProperties => ({ fontFamily: fonts.mono, fontSize: size, color, fontWeight: weight, letterSpacing: "0.02em" });

/** Receipt (reference: "/receipt" reel). Prices only from the owner: compliance enforces prices_confirmed_on. */
export const Receipt: React.FC<{ brief: ReceiptBrief } & QcProps> = ({ brief, showSafeZones }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const theme = useTheme();
  const tm = receiptTimes(brief);
  const H = receiptHeight(brief);
  const accent = theme.end.accent; // accent for light paper

  // printer drops in after the hook
  const arrive = Easing.out(Easing.back(1.4))(clamp01((t - tm.hook) / 0.55));
  // paper feed: line-by-line stutter (a step every ~29 px)
  const lin = clamp01((t - tm.printStart) / tm.print) * H;
  const step = 29;
  const fed = Math.min(H, Math.floor(lin / step) * step + Easing.inOut(Easing.quad)((lin % step) / step) * step);
  const printing = t >= tm.printStart && t < tm.printStart + tm.print;
  // tear: small jolt, the strip drops and tilts; camera pushes in on the total
  const torn = clamp01((t - tm.tear) / 0.45);
  const drop = Easing.out(Easing.cubic)(torn) * 46;
  const tilt = Easing.out(Easing.cubic)(torn) * -2.4;
  const push = Easing.inOut(Easing.cubic)(clamp01((t - tm.tear - 0.15) / 1.1));
  const totalY = SLOT + drop + RECEIPT.pad + RECEIPT.total / 2;
  const underline = clamp01((t - tm.tear - 0.7) / 0.45);
  const hookOut = 1 - clamp01((t - tm.hook + 0.25) / 0.3);

  const bg =
    theme.name === "brand"
      ? `radial-gradient(ellipse at 50% 30%, ${colors.bronzeLight} 0%, ${colors.bronze} 20%, ${colors.bronzeDark} 48%, ${colors.slateDeep} 88%)`
      : `radial-gradient(ellipse at 50% 34%, ${theme.accent} 0%, ${theme.bgTop} 45%, ${theme.bgBottom} 85%)`;

  return (
    <Shell brief={brief} endSeconds={4.5} showSafeZones={showSafeZones} chrome="minimal">
      <AbsoluteFill style={{ background: bg }} />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 50%, transparent 55%, rgba(0,0,0,0.45))" }} />

      <AbsoluteFill
        style={{
          transformOrigin: `540px ${totalY}px`,
          transform: `translateY(${push * (720 - totalY)}px) scale(${1 + 0.14 * push})`, // keeps the strip inside the safe area
        }}
      >
        {/* paper (behind the printer front, so it comes out of the slot) */}
        {fed > 0 ? <div style={{ position: "absolute", left: 0, right: 0, top: SLOT, bottom: 0, overflow: torn > 0 ? "visible" : "hidden" }}>
          <div
            style={{
              position: "absolute",
              left: (video.width - PAPER_W) / 2,
              top: fed - H + drop,
              width: PAPER_W,
              height: H,
              transform: `rotate(${tilt}deg)`,
              transformOrigin: "50% 0%",
              filter: "drop-shadow(0 18px 30px rgba(0,0,0,0.35))",
            }}
          >
            <Paper brief={brief} H={H} accent={accent} underline={underline} />
          </div>
          {/* shadow of the slot on the fresh paper */}
          {torn < 1 && fed > 0 ? <div style={{ position: "absolute", left: (video.width - PAPER_W) / 2, width: PAPER_W, top: 0, height: Math.min(26, fed), background: "linear-gradient(rgba(0,0,0,0.35), transparent)", opacity: 1 - torn }} /> : null}
        </div> : null}
        <Printer y={(1 - arrive) * -520} led={printing && frame % 10 < 6} />
      </AbsoluteFill>

      {/* hook first, on the warm background */}
      {hookOut > 0 ? (
        <div style={{ position: "absolute", left: video.safe.left + 40, top: 760, opacity: hookOut }}>
          <KineticHeadline lines={brief.hook.lines} accent={brief.hook.accent} width={820} max={120} delay={6} />
        </div>
      ) : null}

      <HalftoneReveal duration={22} color={colors.slateDeep} origin={[0.5, 0.45]} />

      <Sfx name="whoosh" at={Math.round((tm.hook - 0.3) * fps)} volume={0.3} />
      {Array.from({ length: Math.ceil(tm.print / 0.9) }, (_, i) => (
        <Sequence key={i} from={Math.round((tm.printStart + i * 0.9) * fps)} durationInFrames={Math.round(Math.min(0.9, tm.print - i * 0.9) * fps) + 2} layout="none">
          <Sfx name="printer" volume={0.35} />
        </Sequence>
      ))}
      <Sfx name="tear" at={Math.round(tm.tear * fps)} volume={0.5} />
    </Shell>
  );
};

/** Serrated (torn) top and bottom edges. */
function zigzag(w: number, h: number, tooth = 18, depth = 9) {
  const pts: string[] = [];
  for (let x = 0; x <= w; x += tooth) pts.push(`${x}px ${(x / tooth) % 2 ? depth : 0}px`);
  for (let x = w; x >= 0; x -= tooth) pts.push(`${x}px ${h - ((x / tooth) % 2 ? depth : 0)}px`);
  return `polygon(${pts.join(",")})`;
}

const Paper: React.FC<{ brief: ReceiptBrief; H: number; accent: string; underline: number }> = ({ brief, H, accent, underline }) => {
  const R = RECEIPT;
  const rule = <div style={{ height: R.rule, display: "flex", alignItems: "center" }}><div style={{ width: "100%", borderTop: `3px dashed ${INK}33` }} /></div>;
  const ul = "M 4 10 C 60 4, 140 14, 230 6";
  const { strokeDasharray, strokeDashoffset } = evolvePath(underline, ul);
  return (
    <div
      style={{
        width: PAPER_W,
        height: H,
        clipPath: zigzag(PAPER_W, H),
        background: "linear-gradient(180deg, #F2EBDD, #F8F3EA 30%, #F4EEE2)",
        padding: `${R.pad}px 48px`,
        boxSizing: "border-box",
        position: "relative",
      }}
    >
      <svg width={PAPER_W} height={H} style={{ position: "absolute", inset: 0, opacity: 0.22, mixBlendMode: "multiply" }}>
        <filter id="rc-grain"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed="3" /><feColorMatrix values="0 0 0 0 0.45  0 0 0 0 0.38  0 0 0 0 0.3  0 0 0 0.5 0" /></filter>
        <rect width="100%" height="100%" filter="url(#rc-grain)" />
      </svg>
      <div style={{ height: R.total, display: "flex", justifyContent: "space-between", alignItems: "center", position: "relative" }}>
        <span style={mono(40, INK, 700)}>{brief.total.label}</span>
        <span style={{ position: "relative", ...mono(50, accent, 800) }}>
          {brief.total.value}
          <svg width="240" height="20" viewBox="0 0 240 20" preserveAspectRatio="none" style={{ position: "absolute", left: 0, right: 0, width: "100%", bottom: -16 }}>
            <path d={ul} fill="none" stroke={accent} strokeWidth="4" strokeLinecap="round" strokeDasharray={strokeDasharray} strokeDashoffset={strokeDashoffset} />
          </svg>
        </span>
      </div>
      {rule}
      {brief.items.map((it, i) => (
        <div key={i} style={{ height: R.item, display: "flex", justifyContent: "space-between", alignItems: "center", ...mono(30) }}>
          <span>{it.text}</span>
          <span>{it.value}</span>
        </div>
      ))}
      {rule}
      {brief.footer.map((f, i) => (
        <div key={i} style={{ height: R.foot, display: "flex", alignItems: "center", ...mono(22, "#8A8076") }}>{f}</div>
      ))}
      <div style={{ height: R.store, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: 8 }}>
        <div style={{ ...headline(44, INK), letterSpacing: "0.08em" }}>{clinic.name}</div>
        <div style={mono(20, "#6F665C")}>{clinic.city} · {clinic.phone}</div>
      </div>
    </div>
  );
};

const Printer: React.FC<{ y: number; led: boolean }> = ({ y, led }) => (
  <div style={{ position: "absolute", left: (video.width - PRINTER.width) / 2, top: PRINTER.top + y, width: PRINTER.width, height: PRINTER.height }}>
    <div
      style={{
        position: "absolute",
        inset: 0,
        borderRadius: 26,
        background: "linear-gradient(180deg, #4A413A 0%, #2A2420 45%, #171310 100%)",
        boxShadow: "0 26px 50px rgba(0,0,0,0.5), inset 0 2px 0 rgba(255,255,255,0.14), inset 0 -3px 0 rgba(0,0,0,0.5)",
      }}
    />
    {/* slot */}
    <div style={{ position: "absolute", left: (PRINTER.width - PAPER_W - 40) / 2, width: PAPER_W + 40, bottom: 12, height: 12, borderRadius: 6, background: "#070605", boxShadow: "inset 0 3px 4px rgba(0,0,0,0.9), 0 1px 0 rgba(255,255,255,0.12)" }} />
    <Img src={staticFile("brand/mark-white.png")} style={{ position: "absolute", left: 44, top: 30, height: 54, opacity: 0.55 }} />
    <div style={{ position: "absolute", right: 48, top: 48, width: 16, height: 16, borderRadius: 8, background: led ? "#7CF0A0" : "#2F4A38", boxShadow: led ? "0 0 14px #7CF0A0" : "none" }} />
  </div>
);
