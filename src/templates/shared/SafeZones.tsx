import React from "react";
import { AbsoluteFill } from "remotion";
import { video } from "../../brand";

/** QC overlay: red = areas covered by Instagram/TikTok UI. Never rendered in final videos. */
export const SafeZones: React.FC = () => {
  const s = video.safe;
  const z = (st: React.CSSProperties): React.CSSProperties => ({ position: "absolute", background: "rgba(255,0,0,0.22)", ...st });
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={z({ top: 0, left: 0, right: 0, height: s.top })} />
      <div style={z({ bottom: 0, left: 0, right: 0, height: s.bottom })} />
      <div style={z({ top: s.top, bottom: s.bottom, right: 0, width: s.right })} />
      <div style={z({ top: s.top, bottom: s.bottom, left: 0, width: s.left })} />
    </AbsoluteFill>
  );
};
