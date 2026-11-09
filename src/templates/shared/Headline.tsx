import React from "react";
import { useTheme } from "../../theme";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { prog } from "./motion";
import { fitSize, headline, serif } from "./text";

/** Kinetic multi-line headline: masked slide-up per line, one serif accent word, bronze strike rule. */
export const KineticHeadline: React.FC<{ lines: string[]; accent?: string; width?: number; delay?: number; max?: number }> = ({
  lines,
  accent,
  width = 880,
  delay = 0,
  max = 150,
}) => {
  const t = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const size = fitSize(lines, width, max);
  const step = Math.round(fps * 0.16);
  return (
    <div style={{ width }}>
      {lines.map((l, i) => {
        const p = prog(frame, delay + i * step, Math.round(fps * 0.55));
        return (
          <div key={i} style={{ overflow: "hidden", paddingBottom: size * 0.06 }}>
            <div style={{ transform: `translateY(${(1 - p) * 110}%)`, ...headline(size) }}>{renderAccent(l, accent, size, t.accent)}</div>
          </div>
        );
      })}
      <div
        style={{
          marginTop: 22,
          height: 8,
          background: t.rule,
          width: `${prog(frame, delay + lines.length * step, Math.round(fps * 0.6)) * 46}%`,
        }}
      />
    </div>
  );
};

function renderAccent(line: string, accent: string | undefined, size: number, accentColor: string) {
  if (!accent) return line;
  const i = line.toLowerCase().indexOf(accent.toLowerCase());
  if (i < 0) return line;
  return (
    <>
      {line.slice(0, i)}
      <span style={{ ...serif(size * 1.12, accentColor), textTransform: "none" }}>{line.slice(i, i + accent.length)}</span>
      {line.slice(i + accent.length)}
    </>
  );
}
