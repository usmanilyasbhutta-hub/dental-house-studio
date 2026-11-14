import React from "react";
import { isLight, useTheme } from "../../theme";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

/** Dark brand backdrop: gradient, grain, vignette. No logo watermark (owner, 14 Nov 2026: never a white logo). */
export const Backdrop: React.FC<{ broll?: string; brollStart?: number }> = ({ broll }) => {
  const t = useTheme();
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 80% at 50% 30%, ${t.bgTop} 0%, ${t.bgBottom} 70%)` }}>
      {broll ? <KenBurns src={broll} /> : null}
      <Grain />
      <AbsoluteFill style={{ background: isLight(t) ? "radial-gradient(ellipse at center, transparent 65%, rgba(51,60,57,0.06) 100%)" : "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.55) 100%)" }} />
    </AbsoluteFill>
  );
};

/** Clinic photo with slow push-in + bronze duotone so text stays legible. */
export const KenBurns: React.FC<{ src: string }> = ({ src }) => {
  const t = useTheme();
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const scale = interpolate(frame, [0, durationInFrames], [1.22, 1.08]);
  return (
    <AbsoluteFill>
      <Img src={staticFile(src)} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${scale})`, filter: "grayscale(1) contrast(1.05)" }} />
      <AbsoluteFill style={{ background: t.rule, mixBlendMode: "multiply", opacity: 0.45 }} />
      <AbsoluteFill style={{ background: `linear-gradient(180deg, ${t.bgBottom}cc 0%, ${t.bgBottom}55 40%, ${t.bgBottom}ee 100%)` }} />
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
