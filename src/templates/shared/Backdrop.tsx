import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { colors } from "../../brand";

/** Dark brand backdrop: gradient, oversized house-mark watermark, grain, vignette. */
export const Backdrop: React.FC<{ broll?: string; brollStart?: number }> = ({ broll }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const drift = interpolate(frame, [0, durationInFrames], [0, -60]);
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 80% at 50% 30%, ${colors.slate} 0%, ${colors.slateDeep} 70%)` }}>
      {broll ? <KenBurns src={broll} /> : null}
      <Img
        src={staticFile("brand/mark-white.png")}
        style={{ position: "absolute", width: 1500, left: -260, top: 520 + drift, opacity: 0.06 }}
      />
      <Grain />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.55) 100%)" }} />
    </AbsoluteFill>
  );
};

/** Clinic photo with slow push-in + bronze duotone so text stays legible. */
export const KenBurns: React.FC<{ src: string }> = ({ src }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const scale = interpolate(frame, [0, durationInFrames], [1.22, 1.08]);
  return (
    <AbsoluteFill>
      <Img src={staticFile(src)} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${scale})`, filter: "grayscale(1) contrast(1.05)" }} />
      <AbsoluteFill style={{ background: colors.bronzeDark, mixBlendMode: "multiply", opacity: 0.55 }} />
      <AbsoluteFill style={{ background: `linear-gradient(180deg, ${colors.slateDeep}cc 0%, ${colors.slateDeep}55 40%, ${colors.slateDeep}ee 100%)` }} />
    </AbsoluteFill>
  );
};

const Grain: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ opacity: 0.09, mixBlendMode: "overlay" }}>
      <svg width="100%" height="100%">
        <filter id="grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={frame % 12} stitchTiles="stitch" />
        </filter>
        <rect width="100%" height="100%" filter="url(#grain)" />
      </svg>
    </AbsoluteFill>
  );
};
