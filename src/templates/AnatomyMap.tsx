import React from "react";
import { AbsoluteFill, Img, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { evolvePath } from "@remotion/paths";
import { video } from "../brand";
import type { AnatomyMapBrief } from "../brief/schema";
import { MAP_XFADE, mapSceneSeconds } from "../brief/timing";
import { useTheme } from "../theme";
import { Sfx } from "../fx/effects";
import { prog } from "./shared/motion";
import { Shell, type QcProps } from "./shared/Shell";
import { headline, serif } from "./shared/text";
import type { PhotoSize } from "./PhotoLayout";

type Region = AnatomyMapBrief["scenes"][number]["regions"][number];
type Rect = { x: number; y: number; w: number; h: number };
const INK = "#F7F8F6"; // white line work, as in the reference style
const TITLE_BEAT = 1.4;

/** Photo contain-fit to the full frame (never cropped); the frame around it is a blurred copy. */
const photoRect = (s: PhotoSize): Rect => {
  const k = Math.min(video.width / s.w, video.height / s.h);
  return { x: (video.width - s.w * k) / 2, y: (video.height - s.h * k) / 2, w: s.w * k, h: s.h * k };
};

/** Catmull-Rom spline → cubic Bézier path (organic outlines from a few points). */
export function smoothPath(pts: [number, number][], closed: boolean): string {
  if (pts.length < 2) return "";
  const P = (i: number) => (closed ? pts[(i + pts.length) % pts.length] : pts[Math.max(0, Math.min(pts.length - 1, i))]);
  const n = closed ? pts.length : pts.length - 1;
  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const [p0, p1, p2, p3] = [P(i - 1), P(i), P(i + 1), P(i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C ${c1[0].toFixed(1)} ${c1[1].toFixed(1)}, ${c2[0].toFixed(1)} ${c2[1].toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return closed ? d + " Z" : d;
}

/** Where each label sits (inside the safe area, clear of the title). */
const ANCHOR: Record<Region["anchor"], { x: number; y: number; align: "left" | "right" }> = {
  "top-left": { x: 90, y: 390, align: "left" },
  "top-right": { x: video.width - video.safe.right - 10, y: 390, align: "right" },
  "bottom-left": { x: 90, y: 1470, align: "left" },
  "bottom-right": { x: video.width - video.safe.right - 10, y: 1470, align: "right" },
};

export const AnatomyMap: React.FC<{ brief: AnatomyMapBrief; sizes?: PhotoSize[] } & QcProps> = ({ brief, sizes = [], showSafeZones }) => {
  const { fps } = useVideoConfig();
  const secs = mapSceneSeconds(brief);
  const xf = Math.round(MAP_XFADE * fps);
  let start = 0;
  return (
    <Shell brief={brief} endSeconds={4.5} showSafeZones={showSafeZones} chrome="minimal">
      {brief.scenes.map((sc, i) => {
        const dur = Math.round(secs[i] * fps);
        const from = start;
        start += dur - xf;
        return (
          <Sequence key={i} from={from} durationInFrames={dur}>
            <MapScene
              scene={sc}
              size={sizes[i] ?? { w: 4, h: 5 }}
              per={Math.round(brief.seconds_per_region * fps)}
              fadeIn={i === 0 ? 10 : xf}
              dur={dur}
              fadeOut={i === brief.scenes.length - 1 ? 0 : xf}
            />
          </Sequence>
        );
      })}
    </Shell>
  );
};

const MapScene: React.FC<{
  scene: AnatomyMapBrief["scenes"][number];
  size: PhotoSize;
  per: number;
  fadeIn: number;
  dur: number;
  fadeOut: number;
}> = ({ scene, size, per, fadeIn, dur, fadeOut }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const r = photoRect(size);
  const toPx = ([x, y]: [number, number]): [number, number] =>
    scene.units === "px" ? [r.x + (x / size.w) * r.w, r.y + (y / size.h) * r.h] : [r.x + (x / 100) * r.w, r.y + (y / 100) * r.h];
  const beat = Math.round(TITLE_BEAT * fps);
  const current = Math.floor((frame - beat) / per); // index of the newest region on screen
  // the outgoing chapter's line work and text leave while the next photo fades in (no doubled titles)
  const overlays = fadeOut
    ? interpolate(frame, [dur - fadeOut, dur - fadeOut / 2], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : 1;
  return (
    <AbsoluteFill style={{ opacity: interpolate(frame, [0, fadeIn], [0, 1], { extrapolateRight: "clamp" }) }}>
      {/* blurred full-frame fill, then the uncropped photo */}
      <Img
        src={staticFile(scene.photo)}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          filter: "blur(34px) brightness(0.9)",
          transform: "scale(1.15)",
        }}
      />
      <Img src={staticFile(scene.photo)} style={{ position: "absolute", left: r.x, top: r.y, width: r.w, height: r.h }} />
      <AbsoluteFill style={{ opacity: overlays }}>
        <svg width={video.width} height={video.height} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
          <defs>
            <pattern id="hatch" width="16" height="16" patternUnits="userSpaceOnUse">
              <path d="M 16 0 L 0 0 0 16" fill="none" stroke={INK} strokeWidth="1.3" opacity="0.6" />
            </pattern>
          </defs>
          {scene.regions.map((reg, i) => (
            <Sequence key={i} from={beat + i * per} layout="none">
              <RegionShape region={reg} points={reg.points.map(toPx)} newest={i === current} />
            </Sequence>
          ))}
        </svg>
        {scene.regions.map((reg, i) =>
          reg.label ? (
            <Sequence key={i} from={beat + i * per} layout="none">
              <RegionLabel region={reg} points={reg.points.map(toPx)} newest={i === current} />
              <Sfx name="tick" at={2} volume={0.3} />
              <Sfx name="pop" at={Math.round(per * 0.45)} volume={0.25} />
            </Sequence>
          ) : null,
        )}
        <Title text={scene.title.text} bold={scene.title.bold} delay={fadeIn > 10 ? fadeIn / 2 : 0} />
      </AbsoluteFill>
      <Sfx name="whoosh" at={0} volume={0.3} />
    </AbsoluteFill>
  );
};

/** Outline draws on; then hatch / colour / ridge ticks fade in. */
const RegionShape: React.FC<{ region: Region; points: [number, number][]; newest: boolean }> = ({ region, points, newest }) => {
  const t = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const d = smoothPath(points, region.closed);
  const draw = prog(frame, 0, fps * 0.9);
  const fill = prog(frame, fps * 0.55, fps * 0.6);
  const { strokeDasharray, strokeDashoffset } = evolvePath(draw, d);
  const dim = newest ? 1 : 0.75;
  const color = t.map[(region.color ?? 1) - 1];
  return (
    <g opacity={dim}>
      {region.style === "hatch" && region.closed ? <path d={d} fill="url(#hatch)" opacity={fill} /> : null}
      {region.style === "fill" && region.closed ? <path d={d} fill={color} opacity={0.62 * fill} /> : null}
      {region.style === "ridge" ? (
        <path d={d} fill="none" stroke={INK} strokeWidth={30} strokeDasharray="2 9" opacity={0.75 * fill} />
      ) : null}
      <path
        d={d}
        fill="none"
        stroke={INK}
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={strokeDasharray}
        strokeDashoffset={strokeDashoffset}
        opacity={0.95}
      />
    </g>
  );
};

/** Two-weight label at a frame edge + curved hairline leader to the nearest point of its outline. */
const RegionLabel: React.FC<{ region: Region; points: [number, number][]; newest: boolean }> = ({ region, points, newest }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = ANCHOR[region.anchor];
  const top = region.anchor.startsWith("top");
  const lx = a.x + (a.align === "left" ? 14 : -14);
  const ly = a.y + (top ? 46 : -16); // leader starts just below/above the text
  const [tx, ty] = points.reduce(
    (best, p) => (Math.hypot(p[0] - lx, p[1] - ly) < Math.hypot(best[0] - lx, best[1] - ly) ? p : best),
    points[0],
  );
  const d = `M ${lx} ${ly} C ${lx} ${(ly + ty) / 2}, ${tx + (lx - tx) * 0.35} ${ty}, ${tx} ${ty}`;
  const lead = prog(frame, fps * 0.25, fps * 0.8);
  const { strokeDasharray, strokeDashoffset } = evolvePath(lead, d);
  const txt = prog(frame, fps * 0.15, fps * 0.45);
  const o = newest ? 1 : 0.45; // earlier labels step back, like the reference
  return (
    <AbsoluteFill style={{ opacity: o }}>
      <svg width={video.width} height={video.height} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <path d={d} fill="none" stroke={INK} strokeWidth={2} strokeDasharray={strokeDasharray} strokeDashoffset={strokeDashoffset} />
        <circle cx={tx} cy={ty} r={5} fill={INK} opacity={lead > 0.95 ? 1 : 0} />
      </svg>
      <div
        style={{
          position: "absolute",
          top: a.y,
          ...(a.align === "left" ? { left: a.x } : { right: video.width - a.x }),
          opacity: txt,
          transform: `translateY(${(1 - txt) * 10}px)`,
          color: INK,
          textShadow: "0 2px 12px rgba(0,0,0,0.35)",
          whiteSpace: "nowrap",
        }}
      >
        <span style={{ ...headline(40, INK), letterSpacing: "0.02em" }}>{region.label!.bold}</span>
        {region.label!.text ? <span style={{ ...serif(40, INK), marginLeft: 10 }}>{region.label!.text}</span> : null}
      </div>
    </AbsoluteFill>
  );
};

/** Small centred title: serif italic words with one bold Oswald keyword ("A Class II restoration…"). */
const Title: React.FC<{ text: string; bold?: string; delay?: number }> = ({ text, bold, delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = prog(frame, delay + fps * 0.2, fps * 0.6);
  const i = bold ? text.indexOf(bold) : -1;
  const plain = (s: string) => (s ? <span style={serif(54, INK)}>{s}</span> : null);
  return (
    <div
      style={{
        position: "absolute",
        left: 90,
        right: video.safe.right,
        top: 255,
        textAlign: "center",
        opacity: a,
        transform: `translateY(${(1 - a) * 14}px)`,
        textShadow: "0 2px 14px rgba(0,0,0,0.35)",
      }}
    >
      {i < 0 ? (
        plain(text)
      ) : (
        <>
          {plain(text.slice(0, i))}
          <span style={{ ...headline(52, INK), margin: "0 0.22em" }}>{bold}</span>
          {plain(text.slice(i + bold!.length))}
        </>
      )}
    </div>
  );
};
