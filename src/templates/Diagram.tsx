import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { evolvePath, getLength, getPointAtLength } from "@remotion/paths";
import { fonts, video } from "../brand";
import type { DiagramBrief } from "../brief/schema";
import { DIAGRAM_INTRO } from "../brief/timing";
import { useTheme, type Theme } from "../theme";
import { DoodleIcon } from "../fx/DoodleIcon";
import { Sfx } from "../fx/effects";
import { KineticHeadline } from "./shared/Headline";
import { Shell, type QcProps } from "./shared/Shell";
import { headline, mono } from "./shared/text";

/** Content area below the title (inside the safe zone). */
const A = { x: video.safe.left + 30, y: 560, w: video.width - video.safe.left - video.safe.right - 40, h: 940 };
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const ease = Easing.bezier(0.22, 1, 0.36, 1);
type Item = DiagramBrief["items"][number];
type Ctx = { t: Theme; frame: number; at: (k: number) => number; pk: (k: number) => number; items: Item[]; brief: DiagramBrief };

const body = (size: number, color: string): React.CSSProperties => ({ fontFamily: fonts.mono, fontWeight: 500, fontSize: size, color, letterSpacing: "0.01em", lineHeight: 1.3 });

/** "Visual codes" diagram explainer: one layout per idea; items reveal in order, then the whole diagram holds. */
export const Diagram: React.FC<{ brief: DiagramBrief } & QcProps> = ({ brief, showSafeZones }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = useTheme();
  const intro = DIAGRAM_INTRO * fps;
  const spi = brief.seconds_per_item * fps;
  const at = (k: number) => intro + k * spi;
  const pk = (k: number) => ease(clamp01((frame - at(k)) / Math.min(spi * 0.8, 18)));
  const ctx: Ctx = { t, frame, at, pk, items: brief.items, brief };
  const L = {
    timeline: Timeline, roadmap: Roadmap, flowchart: Flowchart, cycle: Cycle, layers: Layers, iceberg: Iceberg, tree: Tree, matrix: Matrix, infographic: Infographic,
  }[brief.layout];
  return (
    <Shell brief={brief} endSeconds={4.5} showSafeZones={showSafeZones}>
      <div style={{ position: "absolute", left: video.safe.left + 30, top: 250 }}>
        <KineticHeadline lines={brief.hook.lines} accent={brief.hook.accent} width={840} max={84} />
        {brief.subheading ? <div style={{ ...body(24, t.muted), marginTop: 12, opacity: clamp01((frame - 20) / 12) }}>{brief.subheading}</div> : null}
      </div>
      <L {...ctx} />
      {brief.items.map((_, k) => (
        <Sfx key={k} name="tick" at={Math.round(at(k))} volume={0.22} />
      ))}
      {brief.footer ? <div style={{ position: "absolute", left: A.x, top: 1506, ...mono(17, t.muted), opacity: clamp01((frame - 30) / 15) }}>{brief.footer}</div> : null}
    </Shell>
  );
};

const Icon: React.FC<{ name?: string; x: number; y: number; size: number; p: number; t: Theme }> = ({ name, x, y, size, p, t }) =>
  name && p > 0 ? <DoodleIcon name={name} size={size} p={p} t={t} style={{ position: "absolute", left: x - size / 2, top: y - size / 2 }} /> : null;

const pop = (p: number): React.CSSProperties => ({ opacity: p, transform: `translateY(${(1 - p) * 24}px)` });

/* ---- timeline: vertical line, dated stops --------------------------------------------------------- */
const Timeline: React.FC<Ctx> = ({ t, frame, pk, items, at }) => {
  const n = items.length, x = A.x + 40;
  const y = (k: number) => A.y + 20 + (k * (A.h - 160)) / (n - 1); // leaves room under the last stop for its text
  const grow = interpolate(frame, [at(0) - 10, at(n - 1)], [A.y, y(n - 1)], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: x - 3, top: A.y, width: 6, height: grow - A.y, background: t.rule, borderRadius: 3 }} />
      {items.map((it, k) => {
        const p = pk(k);
        return (
          <React.Fragment key={k}>
            <div style={{ position: "absolute", left: x - 16, top: y(k) - 16, width: 32, height: 32, borderRadius: 16, background: t.accent, border: `6px solid ${t.bgBottom}`, transform: `scale(${p})` }} />
            <div style={{ position: "absolute", left: x + 50, top: y(k) - 30, width: A.w - 230, ...pop(p) }}>
              {it.tag ? <span style={{ ...mono(20, t.bgBottom), background: t.accent, padding: "4px 12px", borderRadius: 20 }}>{it.tag}</span> : null}
              <div style={{ ...headline(42, t.text), marginTop: 8 }}>{it.label}</div>
              {it.text ? <div style={{ ...body(22, t.muted), marginTop: 4 }}>{it.text}</div> : null}
            </div>
            <Icon name={it.icon} x={A.x + A.w - 60} y={y(k) + 10} size={Math.min(130, (A.h / n) * 0.9)} p={p} t={t} />
          </React.Fragment>
        );
      })}
    </AbsoluteFill>
  );
};

/* ---- roadmap: a winding road with numbered milestones and a traveller ---------------------------- */
const Roadmap: React.FC<Ctx> = ({ t, frame, pk, items, at }) => {
  const n = items.length;
  const pts = items.map((_, k) => [k % 2 ? A.x + A.w - 170 : A.x + 170, A.y + 40 + (k * (A.h - 100)) / (n - 1)] as [number, number]);
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let k = 1; k < n; k++) {
    const [x0, y0] = pts[k - 1], [x1, y1] = pts[k];
    d += ` C ${x0} ${(y0 + y1) / 2 + 30}, ${x1} ${(y0 + y1) / 2 - 30}, ${x1} ${y1}`;
  }
  const len = getLength(d);
  const reach = interpolate(frame, [at(0) - 12, ...items.map((_, k) => at(k))], [0, ...items.map((_, k) => k / (n - 1))], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const road = evolvePath(Math.max(0.001, reach), d);
  const car = getPointAtLength(d, reach * len) ?? { x: pts[0][0], y: pts[0][1] };
  return (
    <AbsoluteFill>
      <svg width={video.width} height={video.height} style={{ position: "absolute", inset: 0 }}>
        <path d={d} fill="none" stroke={t.muted} strokeOpacity={0.15} strokeWidth={54} strokeLinecap="round" />
        <path d={d} fill="none" stroke={t.rule} strokeWidth={54} strokeLinecap="round" strokeDasharray={road.strokeDasharray} strokeDashoffset={road.strokeDashoffset} />
        <path d={d} fill="none" stroke={t.text} strokeWidth={4} strokeDasharray="18 18" opacity={0.6} clipPath="none" style={{ strokeDashoffset: -frame * 2 }} mask="url(#rm-mask)" />
        <defs>
          <mask id="rm-mask">
            <path d={d} fill="none" stroke="#fff" strokeWidth={10} strokeDasharray={road.strokeDasharray} strokeDashoffset={road.strokeDashoffset} />
          </mask>
        </defs>
        <circle cx={car.x} cy={car.y} r={18} fill={t.accent} stroke={t.text} strokeWidth={5} />
      </svg>
      {items.map((it, k) => {
        const p = pk(k);
        const [x, y] = pts[k];
        const left = k % 2 === 0;
        return (
          <React.Fragment key={k}>
            <div style={{ position: "absolute", left: x - 34, top: y - 34, width: 68, height: 68, borderRadius: 34, background: t.accent, display: "flex", alignItems: "center", justifyContent: "center", ...headline(36, t.bgBottom), transform: `scale(${p})` }}>{k + 1}</div>
            <div style={{ position: "absolute", top: y - 34, [left ? "left" : "right"]: left ? x + 60 : video.width - x + 60, width: 470, textAlign: left ? "left" : "right", ...pop(p) }}>
              {it.tag ? <div style={mono(20, t.accent)}>{it.tag}</div> : null}
              <div style={headline(40, t.text)}>{it.label}</div>
              {it.text ? <div style={body(21, t.muted)}>{it.text}</div> : null}
            </div>
          </React.Fragment>
        );
      })}
    </AbsoluteFill>
  );
};

/* ---- flowchart: boxes and question diamonds; "no" branches step aside to an outcome -------------- */
const Flowchart: React.FC<Ctx> = ({ t, pk, items }) => {
  const n = items.length;
  const side = items.some((i) => i.question && i.no);
  const cx = side ? A.x + 250 : video.width / 2 - 20;
  const bw = side ? 460 : 620, bh = 104;
  const y = (k: number) => A.y + 40 + (k * (A.h - 120)) / Math.max(1, n - 1);
  return (
    <AbsoluteFill>
      <svg width={video.width} height={video.height} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <marker id="fc-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto">
            <path d="M 0 0 L 10 5 L 0 10 Z" fill={t.muted} />
          </marker>
        </defs>
        {items.map((it, k) => {
          const p = pk(k);
          const h = it.question ? bh * 1.35 : bh;
          const arrows: React.ReactNode[] = [];
          if (k < n - 1) {
            const y0 = y(k) + h / 2 + 6, y1 = y(k + 1) - (items[k + 1].question ? bh * 1.35 : bh) / 2 - 8;
            const q = pk(k + 1);
            arrows.push(<line key="d" x1={cx} y1={y0} x2={cx} y2={y0 + (y1 - y0) * q} stroke={t.muted} strokeWidth={4} markerEnd={q > 0.9 ? "url(#fc-arrow)" : undefined} />);
          }
          if (it.question && it.no) {
            const x0 = cx + bw / 2 + 4, x1 = A.x + A.w - 250;
            arrows.push(<line key="s" x1={x0} y1={y(k)} x2={x0 + (x1 - x0) * p} y2={y(k)} stroke={t.muted} strokeWidth={4} markerEnd={p > 0.9 ? "url(#fc-arrow)" : undefined} />);
          }
          return (
            <g key={k}>
              {it.question ? (
                <polygon points={`${cx},${y(k) - h / 2} ${cx + bw / 2},${y(k)} ${cx},${y(k) + h / 2} ${cx - bw / 2},${y(k)}`} fill={t.accent} opacity={p} />
              ) : (
                <rect x={cx - bw / 2} y={y(k) - h / 2} width={bw} height={h} rx={20} fill={t.end.top} opacity={p} />
              )}
              {arrows}
            </g>
          );
        })}
      </svg>
      {items.map((it, k) => {
        const p = pk(k);
        const h = it.question ? bh * 1.35 : bh;
        return (
          <React.Fragment key={k}>
            <div style={{ position: "absolute", left: cx - bw / 2 + (it.question ? 70 : 20), width: bw - (it.question ? 140 : 40), top: y(k) - h / 2, height: h, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", opacity: p }}>
              <div style={headline(it.question ? 30 : 34, it.question ? t.bgBottom : t.end.text)}>{it.label}</div>
              {it.text && !it.question ? <div style={body(18, t.end.muted)}>{it.text}</div> : null}
            </div>
            {it.question && it.no ? (
              <>
                <div style={{ position: "absolute", left: cx + bw / 2 + 14, top: y(k) - 40, ...mono(18, t.muted), opacity: p }}>No</div>
                <div style={{ position: "absolute", left: cx + 14, top: y(k) + h / 2 + 6, ...mono(18, t.muted), opacity: k < items.length - 1 ? pk(k + 1) : 0 }}>Yes</div>
                <div style={{ position: "absolute", left: A.x + A.w - 240, width: 240, top: y(k) - 52, minHeight: 104, padding: "12px 16px", boxSizing: "border-box", borderRadius: 18, border: `3px solid ${t.accent}`, ...headline(26, t.text), display: "flex", alignItems: "center", ...pop(clamp01(p * 1.2 - 0.2)) }}>{it.no}</div>
              </>
            ) : null}
          </React.Fragment>
        );
      })}
    </AbsoluteFill>
  );
};

/* ---- cycle: steps on a ring joined by arrows; the current step is explained in the middle --------- */
const Cycle: React.FC<Ctx> = ({ t, frame, pk, items, at }) => {
  const n = items.length, cx = video.width / 2 - 20, cy = A.y + A.h / 2, R = 320, r = 104;
  const pos = (k: number) => [cx + R * Math.cos(-Math.PI / 2 + (k / n) * Math.PI * 2), cy + R * Math.sin(-Math.PI / 2 + (k / n) * Math.PI * 2)];
  const cur = Math.max(0, Math.min(n - 1, Math.floor((frame - at(0)) / (at(1) - at(0)))));
  const done = frame > at(n - 1) + 20;
  const arc = (k: number) => {
    const a0 = -Math.PI / 2 + (k / n) * Math.PI * 2 + (r + 14) / R, a1 = -Math.PI / 2 + ((k + 1) / n) * Math.PI * 2 - (r + 20) / R;
    return `M ${cx + R * Math.cos(a0)} ${cy + R * Math.sin(a0)} A ${R} ${R} 0 0 1 ${cx + R * Math.cos(a1)} ${cy + R * Math.sin(a1)}`;
  };
  const show = items[done ? n - 1 : cur];
  return (
    <AbsoluteFill>
      <svg width={video.width} height={video.height} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <marker id="cy-arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M 0 0 L 10 5 L 0 10 Z" fill={t.accent} />
          </marker>
        </defs>
        {items.map((_, k) => {
          const q = pk((k + 1) % n === 0 ? n - 1 : k + 1) * (k === n - 1 ? clamp01((frame - at(n - 1) - 10) / 14) : 1);
          if (q <= 0) return null;
          const ev = evolvePath(q, arc(k));
          return <path key={k} d={arc(k)} fill="none" stroke={t.accent} strokeWidth={6} strokeDasharray={ev.strokeDasharray} strokeDashoffset={ev.strokeDashoffset} markerEnd={q > 0.95 ? "url(#cy-arrow)" : undefined} />;
        })}
      </svg>
      {items.map((it, k) => {
        const p = pk(k);
        const [x, y] = pos(k);
        const active = !done && k === cur;
        return (
          <div key={k} style={{ position: "absolute", left: x - r, top: y - r, width: r * 2, height: r * 2, borderRadius: r, background: active ? t.accent : t.end.top, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", transform: `scale(${p * (active ? 1.08 : 1)})`, boxShadow: "0 10px 30px rgba(0,0,0,0.25)" }}>
            <div style={mono(18, t.end.muted)}>{String(k + 1).padStart(2, "0")}</div>
            <div style={{ ...headline(it.label.length > 12 ? 24 : 30, t.end.text), padding: "0 14px" }}>{it.label}</div>
          </div>
        );
      })}
      <div key={show.label} style={{ position: "absolute", left: cx - 170, top: cy - 120, width: 340, height: 240, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", opacity: frame > at(0) ? 1 : 0 }}>
        {show.icon ? <DoodleIcon name={show.icon} size={110} p={1} t={t} /> : null}
        {show.text ? <div style={{ ...body(21, t.text), marginTop: 6 }}>{show.text}</div> : null}
      </div>
    </AbsoluteFill>
  );
};

/* ---- layers: stacked bands from top to bottom (tooth layers, gum layers, steps of depth) ---------- */
const Layers: React.FC<Ctx> = ({ t, pk, items }) => {
  const n = items.length, gap = 14, h = (A.h - gap * (n - 1)) / n;
  return (
    <AbsoluteFill>
      {items.map((it, k) => {
        const p = pk(k);
        const inset = k * 22; // each layer slightly narrower: depth
        return (
          <div key={k} style={{ position: "absolute", left: A.x + inset, width: A.w - inset * 2, top: A.y + k * (h + gap), height: h, borderRadius: 22, background: t.map[k % t.map.length], opacity: p, transform: `translateX(${(1 - p) * -80}px)`, display: "flex", alignItems: "center", padding: "0 30px", boxSizing: "border-box", gap: 22 }}>
            <div style={{ ...mono(20, "rgba(28,34,32,0.6)") }}>{String(k + 1).padStart(2, "0")}</div>
            <div style={{ flex: 1 }}>
              <div style={headline(Math.min(44, h * 0.38), "#1C2220")}>{it.label}</div>
              {it.text && h > 110 ? <div style={body(20, "rgba(28,34,32,0.8)")}>{it.text}</div> : null}
            </div>
            {it.icon && h > 100 ? <DoodleIcon name={it.icon} size={Math.min(110, h - 20)} p={p} t={t} /> : null}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

/* ---- iceberg: what you see above the waterline, and the much bigger part below ------------------- */
const Iceberg: React.FC<Ctx> = ({ t, frame, pk, items, brief }) => {
  const water = A.y + 240;
  const grow = ease(clamp01(frame / 30));
  const tip = `M 400 ${water} L 470 ${water - 170} L 520 ${water - 210} L 575 ${water - 150} L 640 ${water} Z`;
  const berg = `M 400 ${water} L 640 ${water} L 760 ${water + 160} L 840 ${water + 420} L 760 ${water + 700} L 540 ${water + 840} L 300 ${water + 720} L 220 ${water + 430} L 300 ${water + 180} Z`;
  const up = items.slice(0, brief.above), down = items.slice(brief.above);
  return (
    <AbsoluteFill>
      <svg width={video.width} height={video.height} style={{ position: "absolute", inset: 0, opacity: grow }}>
        <rect x={0} y={water} width={video.width} height={video.height - water} fill={t.map[3]} opacity={0.18} />
        <path d={berg} fill={t.end.top} opacity={0.22} />
        <path d={tip} fill={t.end.top} />
        <line x1={0} x2={video.width} y1={water} y2={water} stroke={t.map[3]} strokeWidth={4} strokeDasharray="20 12" />
      </svg>
      <div style={{ position: "absolute", left: A.x, top: water - 40, ...mono(18, t.map[3]), opacity: grow }}>Waterline</div>
      {up.map((it, k) => {
        const p = pk(k);
        return (
          <div key={k} style={{ position: "absolute", left: 660, top: water - 200 + k * 70, width: 280, ...pop(p) }}>
            <div style={headline(36, t.text)}>{it.label}</div>
            {it.text ? <div style={body(19, t.muted)}>{it.text}</div> : null}
          </div>
        );
      })}
      {down.map((it, j) => {
        const k = j + brief.above;
        const p = pk(k);
        const y = water + 90 + (j * 640) / Math.max(1, down.length);
        return (
          <div key={k} style={{ position: "absolute", left: 270, width: 520, top: y, textAlign: "center", ...pop(p) }}>
            <div style={headline(36, t.text)}>{it.label}</div>
            {it.text ? <div style={body(19, t.muted)}>{it.text}</div> : null}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

/* ---- tree: a root splits into branches (types, options, causes) ---------------------------------- */
const Tree: React.FC<Ctx> = ({ t, pk, items }) => {
  const depth = (k: number): number => (items[k].parent === undefined ? 0 : 1 + depth(items[k].parent!));
  const levels: number[][] = [];
  items.forEach((_, k) => (levels[depth(k)] ??= []).push(k));
  const lh = Math.min(260, (A.h - 120) / Math.max(1, levels.length - 1));
  const pos: Record<number, [number, number, number]> = {};
  levels.forEach((ks, l) => {
    const w = A.w / ks.length;
    ks.forEach((k, i) => (pos[k] = [A.x + w * (i + 0.5), A.y + 60 + l * lh, Math.min(300, w - 24)]));
  });
  const bh = 100;
  return (
    <AbsoluteFill>
      <svg width={video.width} height={video.height} style={{ position: "absolute", inset: 0 }}>
        {items.map((it, k) => {
          if (it.parent === undefined) return null;
          const [px, py] = pos[it.parent], [x, y] = pos[k];
          const mid = (py + bh / 2 + y - bh / 2) / 2;
          const d = `M ${px} ${py + bh / 2} L ${px} ${mid} L ${x} ${mid} L ${x} ${y - bh / 2}`;
          const p = pk(k);
          if (p <= 0) return null;
          const ev = evolvePath(p, d);
          return <path key={k} d={d} fill="none" stroke={t.muted} strokeWidth={4} strokeDasharray={ev.strokeDasharray} strokeDashoffset={ev.strokeDashoffset} />;
        })}
      </svg>
      {items.map((it, k) => {
        const p = pk(k);
        const [x, y, w] = pos[k];
        const root = it.parent === undefined;
        return (
          <div key={k} style={{ position: "absolute", left: x - w / 2, top: y - bh / 2, width: w, height: bh, borderRadius: 18, background: root ? t.accent : t.end.top, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "0 10px", boxSizing: "border-box", opacity: p, transform: `scale(${0.8 + 0.2 * p})` }}>
            <div style={headline(w < 200 ? 24 : 30, root ? t.bgBottom : t.end.text)}>{it.label}</div>
            {it.text && w >= 200 ? <div style={body(16, t.end.muted)}>{it.text}</div> : null}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

/* ---- matrix: compare options across a few criteria (✓ / ✗ / short words) ------------------------- */
const Matrix: React.FC<Ctx> = ({ t, frame, pk, items, brief }) => {
  const cols = brief.columns ?? [];
  const c0 = 270, cw = (A.w - c0) / cols.length;
  const rh = Math.min(130, (A.h - 100) / items.length);
  const head = ease(clamp01((frame - 10) / 14));
  const cell = (v: string) => {
    const s = v.trim();
    if (s === "✓") return <span style={headline(52, t.map[2])}>✓</span>;
    if (s === "✗") return <span style={headline(52, t.map[1])}>✗</span>;
    return <span style={headline(26, t.text)}>{s}</span>;
  };
  return (
    <AbsoluteFill>
      {cols.map((c, j) => (
        <div key={j} style={{ position: "absolute", left: A.x + c0 + j * cw, width: cw, top: A.y, height: 90, display: "flex", alignItems: "flex-end", justifyContent: "center", textAlign: "center", ...headline(28, t.accent), opacity: head }}>{c}</div>
      ))}
      <div style={{ position: "absolute", left: A.x, width: A.w * head, top: A.y + 100, height: 3, background: t.rule }} />
      {items.map((it, k) => {
        const p = pk(k);
        const y = A.y + 112 + k * rh;
        return (
          <div key={k} style={{ position: "absolute", left: A.x, top: y, width: A.w, height: rh, display: "flex", alignItems: "center", borderBottom: `1px solid ${t.muted}33`, ...pop(p) }}>
            <div style={{ width: c0, ...headline(32, t.text) }}>{it.label}</div>
            {(it.text ?? "").split("|").map((v, j) => (
              <div key={j} style={{ width: cw, textAlign: "center" }}>{cell(v)}</div>
            ))}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

/* ---- infographic: cards with a big number, an icon, a label and one line ------------------------- */
const Infographic: React.FC<Ctx> = ({ t, pk, items }) => {
  const n = items.length, cols = n <= 3 ? 1 : 2, rows = Math.ceil(n / cols), gap = 22;
  const w = (A.w - gap * (cols - 1)) / cols, h = (A.h - gap * (rows - 1)) / rows;
  return (
    <AbsoluteFill>
      {items.map((it, k) => {
        const p = pk(k);
        const x = A.x + (k % cols) * (w + gap), y = A.y + Math.floor(k / cols) * (h + gap);
        return (
          <div key={k} style={{ position: "absolute", left: x, top: y, width: w, height: h, borderRadius: 26, background: "rgba(255,255,255,0.07)", border: `2px solid ${t.muted}33`, padding: 24, boxSizing: "border-box", opacity: p, transform: `scale(${0.9 + 0.1 * p})` }}>
            {it.tag ? <div style={headline(Math.min(84, h * 0.32, (w - 170) / (it.tag.length * 0.56)), t.accent)}>{it.tag}</div> : null}
            <div style={{ ...headline(34, t.text), marginTop: 6 }}>{it.label}</div>
            {it.text ? <div style={{ ...body(19, t.muted), marginTop: 6 }}>{it.text}</div> : null}
            {it.icon ? <DoodleIcon name={it.icon} size={Math.min(120, h * 0.4)} p={p} t={t} style={{ position: "absolute", right: 18, top: 18 }} /> : null}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
