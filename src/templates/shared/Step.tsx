import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { colors, video } from "../../brand";
import { prog, sceneFade } from "./motion";
import { fitSize, headline, serif } from "./text";

/** Numbered beat: outlined numeral, bronze rule, headline + serif subline. */
export const Step: React.FC<{ n: number; title: string; subline?: string; dur: number }> = ({ n, title, subline, dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = prog(frame, 0, Math.round(fps * 0.5));
  const b = prog(frame, Math.round(fps * 0.25), Math.round(fps * 0.6));
  return (
    <AbsoluteFill style={{ opacity: sceneFade(frame, dur), padding: `0 ${video.safe.right}px 0 ${90}px`, justifyContent: "center" }}>
      <div
        style={{
          ...headline(300, "transparent"),
          WebkitTextStroke: `4px ${colors.bronzeLight}`,
          transform: `translateX(${(1 - a) * -60}px)`,
          opacity: a,
        }}
      >
        {String(n).padStart(2, "0")}
      </div>
      <div style={{ height: 6, width: 220 * b, background: colors.bronze, margin: "18px 0 34px" }} />
      <div style={{ ...headline(fitSize([title], 850, 104)), opacity: b, transform: `translateY(${(1 - b) * 30}px)` }}>{title}</div>
      {subline ? <div style={{ ...serif(58), marginTop: 22, opacity: b, maxWidth: 850 }}>{subline}</div> : null}
    </AbsoluteFill>
  );
};
