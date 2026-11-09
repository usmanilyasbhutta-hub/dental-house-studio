import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from "remotion";
import { colors } from "../../brand";
import { mono } from "./text";

/** Persistent HUD until the end card: progress bar, logo bug, label, crop marks, business-card bars. */
export const Hud: React.FC<{ label: string; total: number }> = ({ label, total }) => {
  const frame = useCurrentFrame();
  const p = Math.min(1, frame / Math.max(1, total));
  const mark = (s: React.CSSProperties): React.CSSProperties => ({ position: "absolute", width: 34, height: 34, borderColor: colors.mist, opacity: 0.55, ...s });
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill style={{ height: 300, background: `linear-gradient(180deg, ${colors.slateDeep}cc, transparent)` }} />
      <div style={{ position: "absolute", top: 0, left: 0, height: 6, width: `${p * 100}%`, background: colors.bronzeLight }} />
      <Img src={staticFile("brand/logo-white.png")} style={{ position: "absolute", top: 96, left: 64, width: 230 }} />
      <div style={{ position: "absolute", top: 128, right: 150, ...mono(24) }}>
        <span style={{ color: colors.bronzeLight }}>●</span> {label}
      </div>
      <div style={mark({ top: 40, left: 40, borderTop: "3px solid", borderLeft: "3px solid" })} />
      <div style={mark({ top: 40, right: 40, borderTop: "3px solid", borderRight: "3px solid" })} />
      <div style={mark({ bottom: 40, left: 40, borderBottom: "3px solid", borderLeft: "3px solid" })} />
      <div style={mark({ bottom: 40, right: 40, borderBottom: "3px solid", borderRight: "3px solid" })} />
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0 }}>
        <div style={{ height: 14, background: colors.bronze }} />
        <div style={{ height: 5, background: colors.slate }} />
      </div>
    </AbsoluteFill>
  );
};

export const DemoWatermark: React.FC = () => (
  <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", pointerEvents: "none" }}>
    <div style={{ ...mono(46, "#ff5a4f"), transform: "rotate(-24deg)", border: "4px solid #ff5a4f", padding: "16px 34px", opacity: 0.4 }}>
      Demo · not for publishing
    </div>
  </AbsoluteFill>
);
