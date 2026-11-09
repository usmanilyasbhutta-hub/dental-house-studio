import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { clinic, colors } from "../../brand";
import { prog } from "./motion";
import { headline, mono, serif } from "./text";

/** Light end card: logo mask-wipe, tagline, CTA pill with pulsing bronze ring, clinic facts. */
export const EndCard: React.FC<{ cta: string; tagline?: string }> = ({ cta, tagline = "Your smile has a home." }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const wipe = prog(frame, 4, Math.round(fps * 0.9));
  const t = prog(frame, Math.round(fps * 0.6), Math.round(fps * 0.6));
  const c = prog(frame, Math.round(fps * 1.0), Math.round(fps * 0.6));
  const pulse = (frame % fps) / fps;
  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, ${colors.white} 0%, ${colors.mist} 100%)`, alignItems: "center", paddingTop: 360 }}>
      <Img src={staticFile("brand/logo.png")} style={{ width: 760, clipPath: `inset(0 ${(1 - wipe) * 100}% 0 0)` }} />
      <div style={{ ...serif(78, colors.bronze), marginTop: 70, opacity: t, transform: `translateY(${(1 - t) * 20}px)` }}>{tagline}</div>
      <div style={{ position: "relative", marginTop: 80, opacity: c }}>
        <div
          style={{
            position: "absolute", inset: 0, borderRadius: 999, border: `4px solid ${colors.bronze}`,
            transform: `scale(${1 + pulse * 0.18})`, opacity: interpolate(pulse, [0, 1], [0.8, 0]),
          }}
        />
        <div style={{ ...headline(52, colors.white), background: colors.slate, borderRadius: 999, padding: "26px 60px", letterSpacing: "0.04em" }}>
          {cta} →
        </div>
      </div>
      <div style={{ ...headline(70, colors.slate), marginTop: 70, opacity: c }}>{clinic.phone}</div>
      <div style={{ marginTop: 36, textAlign: "center", opacity: c }}>
        {clinic.doctors.map((d) => (
          <div key={d} style={{ ...mono(24, colors.slate), letterSpacing: "0.06em", marginTop: 10 }}>{d}</div>
        ))}
        <div style={{ ...mono(21, colors.bronzeDark), letterSpacing: "0.04em", marginTop: 28, maxWidth: 820, lineHeight: 1.5, textTransform: "none" }}>
          {clinic.address}
        </div>
      </div>
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0 }}>
        <div style={{ height: 14, background: colors.bronze }} />
        <div style={{ height: 5, background: colors.slate }} />
      </div>
    </AbsoluteFill>
  );
};
