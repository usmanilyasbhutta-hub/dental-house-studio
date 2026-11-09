import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { clinic } from "../../brand";
import { useTheme } from "../../theme";
import { Sfx } from "../../fx/effects";
import { prog } from "./motion";
import { headline, mono, serif } from "./text";

/** Light end card: logo mask-wipe, tagline, CTA pill with pulsing ring, phone/WhatsApp, handle, doctors, address. */
export const EndCard: React.FC<{ cta: string; tagline?: string; note?: string }> = ({ cta, tagline = "Your smile has a home.", note }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const e = useTheme().end;
  const wipe = prog(frame, 4, Math.round(fps * 0.9));
  const tg = prog(frame, Math.round(fps * 0.6), Math.round(fps * 0.6));
  const c = prog(frame, Math.round(fps * 1.0), Math.round(fps * 0.6));
  const pulse = (frame % fps) / fps;
  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, ${e.top} 0%, ${e.bottom} 100%)`, alignItems: "center", paddingTop: 330, color: e.text }}>
      <Img src={staticFile("brand/logo.png")} style={{ width: 720, clipPath: `inset(0 ${(1 - wipe) * 100}% 0 0)` }} />
      <div style={{ ...serif(76, e.accent), marginTop: 60, opacity: tg, transform: `translateY(${(1 - tg) * 20}px)` }}>{tagline}</div>
      <Sfx name="click" at={Math.round(fps * 1.25)} volume={0.35} />
      <div style={{ position: "relative", marginTop: 70, opacity: c }}>
        <div
          style={{
            position: "absolute", inset: 0, borderRadius: 999, border: `4px solid ${e.accent}`,
            transform: `scale(${1 + pulse * 0.1})`, opacity: interpolate(pulse, [0, 1], [0.8, 0]),
          }}
        />
        <div style={{ ...headline(52, e.pillText), background: e.pill, borderRadius: 999, padding: "26px 60px", letterSpacing: "0.04em" }}>
          {cta} →
        </div>
      </div>
      <div style={{ ...mono(22, e.muted), marginTop: 56, opacity: c }}>{clinic.whatsapp ? "Call / WhatsApp" : "Call"}</div>
      <div style={{ ...headline(70, e.text), marginTop: 8, opacity: c }}>{clinic.phone}</div>
      <div style={{ ...mono(26, e.text), marginTop: 18, opacity: c, textTransform: "none", letterSpacing: "0.06em" }}>{clinic.instagram}</div>
      <div style={{ marginTop: 30, textAlign: "center", opacity: c }}>
        {clinic.doctors.map((d) => (
          <div key={d} style={{ ...mono(23, e.text), letterSpacing: "0.06em", marginTop: 8 }}>{d}</div>
        ))}
        <div style={{ ...mono(24, e.muted), letterSpacing: "0.03em", marginTop: 22, maxWidth: 740, lineHeight: 1.5, textTransform: "none" }}>
          {clinic.address}
        </div>
        {note ? (
          <div style={{ ...mono(22, e.text), letterSpacing: "0.02em", marginTop: 26, maxWidth: 740, lineHeight: 1.45, textTransform: "none", opacity: 0.85 }}>{note}</div>
        ) : null}
      </div>
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0 }}>
        <div style={{ height: 14, background: e.accent }} />
        <div style={{ height: 5, background: e.text }} />
      </div>
    </AbsoluteFill>
  );
};
