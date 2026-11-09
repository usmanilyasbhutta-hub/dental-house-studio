import React from "react";
import { AbsoluteFill, Img, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { video } from "../brand";
import type { PhotoLayoutBrief } from "../brief/schema";
import { useTheme } from "../theme";
import { DrawArrow, DrawCircle, Sfx } from "../fx/effects";
import { prog } from "./shared/motion";
import { Shell, type QcProps } from "./shared/Shell";
import { fitSize, headline, mono, serif } from "./shared/text";

export type PhotoSize = { w: number; h: number };
/** Content box (inside the safe area): photos never leave it. */
const BOX = { x: 60, y: 440, w: 880, h: 940 };
const HOOK = 1.6;
const STEP = 1.3;

/** Contain-fit (never crop or stretch a photo). */
function fit(size: PhotoSize, box: { x: number; y: number; w: number; h: number }) {
  const s = Math.min(box.w / size.w, box.h / size.h);
  const w = size.w * s,
    h = size.h * s;
  return { x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, w, h };
}

export const PhotoLayout: React.FC<{ brief: PhotoLayoutBrief; sizes?: PhotoSize[] } & QcProps> = ({ brief, sizes = [], showSafeZones }) => {
  const { fps } = useVideoConfig();
  const body = Math.round(
    (HOOK +
      Math.max(brief.annotations.length, brief.layout === "annotate" ? 0 : brief.photos.length) * STEP +
      (brief.loupe ? 1.6 : 0) +
      2.4) *
      fps,
  );
  return (
    <Shell brief={brief} endSeconds={4.5} showSafeZones={showSafeZones}>
      <Sequence durationInFrames={body}>
        <Title brief={brief} />
        {brief.layout === "annotate" ? (
          <Annotate brief={brief} size={sizes[0] ?? { w: 1, h: 1 }} />
        ) : (
          <Arrange brief={brief} sizes={sizes} />
        )}
        {brief.caption ? <Caption text={brief.caption} at={Math.round(HOOK * fps * 0.6)} /> : null}
      </Sequence>
    </Shell>
  );
};

const Title: React.FC<{ brief: PhotoLayoutBrief }> = ({ brief }) => {
  const t = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = prog(frame, 0, fps * 0.5);
  const text = brief.hook.lines.join(" ");
  const accent = brief.hook.accent;
  const i = accent ? text.toLowerCase().indexOf(accent.toLowerCase()) : -1;
  return (
    <div
      style={{ position: "absolute", left: 90, right: video.safe.right, top: 250, opacity: a, transform: `translateY(${(1 - a) * 20}px)` }}
    >
      <div style={{ ...headline(fitSize([text], 850, 92, 52)) }}>
        {i < 0 ? (
          text
        ) : (
          <>
            {text.slice(0, i)}
            <span style={{ ...serif(1, t.accent), fontSize: "1.1em", textTransform: "none" }}>{text.slice(i, i + accent!.length)}</span>
            {text.slice(i + accent!.length)}
          </>
        )}
      </div>
    </div>
  );
};

const Caption: React.FC<{ text: string; at: number }> = ({ text, at }) => {
  const t = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div
      style={{
        position: "absolute",
        left: 90,
        right: video.safe.right,
        top: BOX.y + BOX.h + 28,
        ...serif(46, t.accent),
        opacity: prog(frame, at, fps * 0.5),
      }}
    >
      {text}
    </div>
  );
};

const PhotoFrame: React.FC<{ src: string; r: { x: number; y: number; w: number; h: number }; opacity?: number }> = ({
  src,
  r,
  opacity = 1,
}) => (
  <div
    style={{
      position: "absolute",
      left: r.x,
      top: r.y,
      width: r.w,
      height: r.h,
      borderRadius: 18,
      overflow: "hidden",
      boxShadow: "0 24px 60px rgba(0,0,0,0.45)",
      opacity,
    }}
  >
    <Img src={staticFile(src)} style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
  </div>
);

/** One photo, annotations revealed in order, then an optional loupe. */
const Annotate: React.FC<{ brief: PhotoLayoutBrief; size: PhotoSize }> = ({ brief, size }) => {
  const t = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const r = fit(size, BOX);
  const enter = prog(frame, 0, fps * 0.5);
  const at = (i: number) => Math.round((HOOK + i * STEP) * fps);
  const pt = (x: number, y: number) => ({ px: r.x + (x / 100) * r.w, py: r.y + (y / 100) * r.h });
  return (
    <AbsoluteFill>
      <PhotoFrame src={brief.photos[0].src} r={r} opacity={enter} />
      {brief.annotations.map((a, i) => {
        const { px, py } = pt(a.x, a.y);
        const off = { right: [150, -10], left: [-150, -10], above: [0, -120], below: [0, 120] }[a.side];
        const half = a.label.length * 9.5 + 34; // approx. half-width of the label pill
        const lx = Math.min(Math.max(px + off[0], video.safe.left + half), video.width - video.safe.right - half),
          ly = py + off[1];
        return (
          <Sequence key={i} from={at(i)} layout="none">
            {a.kind === "circle" ? <DrawCircle x={px} y={py} r={80} duration={16} /> : null}
            {a.kind === "arrow" ? (
              <DrawArrow x1={lx} y1={ly + 30} x2={px} y2={py} duration={16} />
            ) : (
              <Leader x1={px} y1={py} x2={lx} y2={ly} />
            )}
            {a.kind === "pin" ? <Pin x={px} y={py} /> : null}
            <Label x={lx} y={ly} text={a.label} />
            <Sfx name="pop" at={8} volume={0.35} />
          </Sequence>
        );
      })}
      {brief.loupe ? (
        <Sequence from={at(brief.annotations.length)} layout="none">
          <Loupe src={brief.photos[0].src} r={r} {...brief.loupe} accent={t.accent} />
          <Sfx name="whoosh" at={0} volume={0.3} />
        </Sequence>
      ) : null}
    </AbsoluteFill>
  );
};

const Pin: React.FC<{ x: number; y: number }> = ({ x, y }) => {
  const t = useTheme();
  const frame = useCurrentFrame();
  const p = prog(frame, 0, 8);
  const pulse = (frame % 30) / 30;
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: x - 26,
          top: y - 26,
          width: 52,
          height: 52,
          borderRadius: 99,
          border: `3px solid ${t.accent}`,
          transform: `scale(${0.6 + pulse * 0.8})`,
          opacity: (1 - pulse) * p,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: x - 11,
          top: y - 11,
          width: 22,
          height: 22,
          borderRadius: 99,
          background: t.accent,
          border: `4px solid ${t.text}`,
          transform: `scale(${p})`,
        }}
      />
    </>
  );
};

const Leader: React.FC<{ x1: number; y1: number; x2: number; y2: number }> = ({ x1, y1, x2, y2 }) => {
  const t = useTheme();
  const frame = useCurrentFrame();
  const p = prog(frame, 4, 10);
  return (
    <svg style={{ position: "absolute", inset: 0, overflow: "visible" }} width="100%" height="100%">
      <line x1={x1} y1={y1} x2={x1 + (x2 - x1) * p} y2={y1 + (y2 - y1) * p} stroke={t.text} strokeWidth={3} />
    </svg>
  );
};

const Label: React.FC<{ x: number; y: number; text: string }> = ({ x, y, text }) => {
  const t = useTheme();
  const frame = useCurrentFrame();
  const p = prog(frame, 10, 10);
  return (
    <div style={{ position: "absolute", left: x, top: y, transform: `translate(-50%, -50%) scale(${0.9 + 0.1 * p})`, opacity: p }}>
      <div
        style={{
          ...mono(26, t.bgBottom),
          background: t.text,
          padding: "10px 18px",
          borderRadius: 10,
          whiteSpace: "nowrap",
          boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
        }}
      >
        {text}
      </div>
    </div>
  );
};

/** Magnifier: zoomed copy of the photo around (x, y), shown in a ring away from the spot, with a connector. */
const Loupe: React.FC<{
  src: string;
  r: { x: number; y: number; w: number; h: number };
  x: number;
  y: number;
  zoom: number;
  accent: string;
}> = ({ src, r, x, y, zoom, accent }) => {
  const frame = useCurrentFrame();
  const p = prog(frame, 0, 14);
  const R = 170;
  const px = r.x + (x / 100) * r.w,
    py = r.y + (y / 100) * r.h;
  // put the loupe in the opposite half so it never covers the spot
  const cx =
    px < video.width / 2 ? Math.min(r.x + r.w - R + 20, video.width - video.safe.right - R) : Math.max(r.x + R - 20, video.safe.left + R);
  const cy = py < r.y + r.h / 2 ? Math.min(r.y + r.h - R + 40, 1380 - R) : Math.max(r.y + R - 40, BOX.y + R);
  const imgW = r.w * zoom,
    imgH = r.h * zoom;
  return (
    <>
      <svg style={{ position: "absolute", inset: 0, overflow: "visible" }} width="100%" height="100%">
        <line x1={px} y1={py} x2={px + (cx - px) * p} y2={py + (cy - py) * p} stroke={accent} strokeWidth={3} strokeDasharray="8 8" />
        <circle cx={px} cy={py} r={R / zoom} fill="none" stroke={accent} strokeWidth={3} opacity={p} />
      </svg>
      <div
        style={{
          position: "absolute",
          left: cx - R,
          top: cy - R,
          width: 2 * R,
          height: 2 * R,
          borderRadius: 999,
          overflow: "hidden",
          border: `6px solid ${accent}`,
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
          transform: `scale(${p})`,
        }}
      >
        <Img
          src={staticFile(src)}
          style={{
            position: "absolute",
            width: imgW,
            height: imgH,
            left: R - ((px - r.x) / r.w) * imgW,
            top: R - ((py - r.y) / r.h) * imgH,
            objectFit: "contain",
          }}
        />
      </div>
      <div
        style={{
          position: "absolute",
          left: cx - R * 0.95,
          top: cy + R * 0.7,
          ...mono(22),
          background: accent,
          color: "#1C2220",
          padding: "4px 10px",
          borderRadius: 8,
          opacity: p,
        }}
      >
        ×{zoom}
      </div>
    </>
  );
};

/** grid (2–4 photos) or split (2 stacked). Tiles revealed one by one; photos contain-fit, never cropped. */
const Arrange: React.FC<{ brief: PhotoLayoutBrief; sizes: PhotoSize[] }> = ({ brief, sizes }) => {
  const { fps } = useVideoConfig();
  const n = brief.photos.length;
  const g = 18;
  const half = (BOX.w - g) / 2,
    halfH = (BOX.h - g) / 2;
  const tiles =
    brief.layout === "split" || n === 2
      ? [
          { x: BOX.x, y: BOX.y, w: BOX.w, h: halfH },
          { x: BOX.x, y: BOX.y + halfH + g, w: BOX.w, h: halfH },
        ]
      : n === 3
        ? [
            { x: BOX.x, y: BOX.y, w: BOX.w, h: halfH },
            { x: BOX.x, y: BOX.y + halfH + g, w: half, h: halfH },
            { x: BOX.x + half + g, y: BOX.y + halfH + g, w: half, h: halfH },
          ]
        : [0, 1, 2, 3].map((i) => ({ x: BOX.x + (i % 2) * (half + g), y: BOX.y + Math.floor(i / 2) * (halfH + g), w: half, h: halfH }));
  return (
    <>
      {brief.photos.map((ph, i) => (
        <Sequence key={i} from={Math.round((0.3 + i * STEP * 0.6) * fps)} layout="none">
          <Tile src={ph.src} label={ph.label} box={tiles[i]} size={sizes[i] ?? { w: 1, h: 1 }} />
          <Sfx name="pop" at={2} volume={0.3} />
        </Sequence>
      ))}
    </>
  );
};

const Tile: React.FC<{ src: string; label?: string; box: { x: number; y: number; w: number; h: number }; size: PhotoSize }> = ({
  src,
  label,
  box,
  size,
}) => {
  const t = useTheme();
  const frame = useCurrentFrame();
  const p = prog(frame, 0, 12);
  const r = fit(size, box);
  return (
    <div style={{ opacity: p, transform: `translateY(${(1 - p) * 20}px)` }}>
      <div
        style={{ position: "absolute", left: box.x, top: box.y, width: box.w, height: box.h, borderRadius: 18, background: "#0e1211" }}
      />
      <PhotoFrame src={src} r={r} />
      {label ? (
        <div
          style={{
            position: "absolute",
            left: box.x + 16,
            top: box.y + 16,
            ...mono(24, t.bgBottom),
            background: t.text,
            padding: "6px 14px",
            borderRadius: 8,
          }}
        >
          {label}
        </div>
      ) : null}
    </div>
  );
};

/** For calculateMetadata: natural sizes of the brief's photos (browser). */
export async function photoSizes(srcs: string[]): Promise<PhotoSize[]> {
  return Promise.all(
    srcs.map(
      (src) =>
        new Promise<PhotoSize>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
          img.onerror = () => reject(new Error(`Cannot load ${src}`));
          img.src = staticFile(src);
        }),
    ),
  );
}
