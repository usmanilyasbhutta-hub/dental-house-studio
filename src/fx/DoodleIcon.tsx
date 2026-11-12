import React from "react";
import { evolvePath } from "@remotion/paths";
import type { Theme } from "../theme";
import { DOODLE_SET, type Doodle, type DoodleName, type FillKey } from "./doodles";

const HUES: Record<Theme["name"], Record<Exclude<FillKey, "white" | "ink">, number>> = {
  brand: { gold: 0, coral: 1, green: 2, blue: 3, pink: 4, yellow: 5 },
  editorial: { coral: 0, green: 1, gold: 2, yellow: 2, blue: 3, pink: 4 },
};
export const doodleFill = (t: Theme, k: FillKey) => (k === "white" ? "#FFFFFF" : k === "ink" ? t.end.text : t.map[HUES[t.name][k]]);

/**
 * A doodle as an icon on a light round badge (reads on dark and light themes). `p` 0→1 draws the lines, then colour lands.
 * Drawn as an <svg> positioned by the caller.
 */
export const DoodleIcon: React.FC<{ name: string; size: number; p: number; t: Theme; badge?: boolean; style?: React.CSSProperties }> = ({ name, size, p, t, badge = true, style }) => {
  const d = DOODLE_SET[name as DoodleName] as Doodle | undefined;
  if (!d) return null;
  const line = Math.min(1, p / 0.7);
  const fill = Math.max(0, (p - 0.6) / 0.4);
  return (
    <svg width={size} height={size} viewBox="0 0 400 400" style={style}>
      {badge ? <circle cx="200" cy="200" r="196" fill={t.end.top} opacity={Math.min(1, p * 3)} /> : null}
      <g transform="translate(200 200) scale(0.78) translate(-200 -200)">
        <g opacity={fill} transform="translate(5 6)">
          {(d.fills ?? []).map((f, i) => (
            <path key={i} d={f.d} fill={doodleFill(t, f.fill)} opacity={f.opacity ?? 0.9} />
          ))}
        </g>
        {d.strokes.map((s, i) => {
          if (line <= 0) return null;
          const { strokeDasharray, strokeDashoffset } = evolvePath(line, s.d);
          return (
            <path key={i} d={s.d} fill="none" stroke={s.accent ? t.end.accent : t.end.text} strokeWidth={(s.w ?? 5) * 1.6} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={strokeDasharray} strokeDashoffset={strokeDashoffset} />
          );
        })}
      </g>
    </svg>
  );
};
