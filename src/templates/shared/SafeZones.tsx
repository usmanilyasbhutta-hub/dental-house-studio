import React from "react";
import { AbsoluteFill } from "remotion";
import { video } from "../../brand";

/** Preview overlay: light red bands = platform UI, red outline = safe area. Never rendered in final videos. */
export const SafeZones: React.FC = () => {
  const s = video.safe;
  const band = (st: React.CSSProperties): React.CSSProperties => ({ position: "absolute", left: 0, right: 0, background: "rgba(255,0,0,0.12)", ...st });
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={band({ top: 0, height: s.top })} />
      <div style={band({ bottom: 0, height: s.bottom })} />
      <div style={{ position: "absolute", top: s.top, bottom: s.bottom, left: s.left, right: s.right, border: "4px solid rgba(255,0,0,0.8)" }} />
    </AbsoluteFill>
  );
};
