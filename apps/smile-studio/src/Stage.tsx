// The interactive canvas: draws the scene, handles drag / pan / pinch-zoom with pointer events.
// Performance: live drag state lives in refs and is drawn on requestAnimationFrame (at most once per frame);
// React state is updated throttled (~10 Hz) and on release. Teeth render in "fast" quality during gestures.
import { useCallback, useEffect, useRef, useState } from "react";
import { centralWidth, designAngle, designHandles, toLocal } from "./geometry";
import type { Design, Guides, Pt } from "./model";
import { C, drawOverlay, drawTeeth, hitHandle, type Scene, type Step } from "./render";
import { haptic } from "./ui";

// drawTeeth gains a 4th "quality" argument (graphics work in parallel); calling it this way works before and after.
const drawTeethQ = drawTeeth as unknown as (
  ctx: CanvasRenderingContext2D,
  s: Scene,
  mode: "mockup" | "outline",
  quality?: "fast" | "full",
) => void;

interface View {
  scale: number;
  ox: number;
  oy: number;
}

export type Calib = { a: Pt; b: Pt };

interface Live {
  guides?: Guides;
  lips?: Pt[];
  design?: Design;
  calib?: Calib;
}

interface Props {
  scene: Scene;
  step: Step;
  mode: "mockup" | "outline";
  showOriginal: boolean;
  calibrating: boolean;
  calib?: Calib;
  compareView: "mouth" | "face";
  onGuides: (g: Guides) => void;
  onLips: (l: Pt[]) => void;
  onDesign: (d: Design) => void;
  onCalib: (c: Calib) => void;
  /** true when a handle drag starts, false when it ends (history commits then). */
  onGesture: (active: boolean) => void;
}

const HIT = 40; // css px: nearest handle within this radius wins
const LOUPE_R = 62;
const LOUPE_ZOOM = 2.5;
const PUSH_MS = 100;

const NAMES: Record<string, string> = {
  pupilR: "patient's right pupil",
  pupilL: "patient's left pupil",
  midline: "facial midline",
  move: "teeth position",
  widthL: "teeth width, left",
  widthR: "teeth width, right",
  length: "central length",
  calA: "first edge of the existing central",
  calB: "second edge of the existing central",
};
export const handleName = (id: string) => (id.startsWith("lip") ? `lip point ${Number(id.slice(3)) + 1} of 12` : (NAMES[id] ?? id));

/** Handles that can be dragged in the current step, with their image positions. */
function handlesOf(s: Scene, step: Step, calibrating: boolean, calib?: Calib): [string, Pt][] {
  if (step === "design" && calibrating) return calib ? [["calA", calib.a], ["calB", calib.b]] : [];
  if (step === "guides") return [["pupilR", s.guides.pupilR], ["pupilL", s.guides.pupilL], ["midline", s.guides.midline]];
  if (step === "lips") return s.lips.map((q, i) => [`lip${i}`, q]);
  if (step === "design") {
    const h = designHandles(s.design, designAngle(s.design, s.guides));
    return [["move", h.move], ["widthL", h.widthL], ["widthR", h.widthR], ["length", h.length]];
  }
  return [];
}

/** The new state after moving handle id to image point p. */
function moveHandle(s: Scene, calib: Calib | undefined, id: string, p: Pt, grab: Pt): Live {
  if (id === "pupilR" || id === "pupilL" || id === "midline") return { guides: { ...s.guides, [id]: p } };
  if (id === "calA" || id === "calB") {
    const c = calib ?? { a: p, b: p };
    return { calib: id === "calA" ? { ...c, a: p } : { ...c, b: p } };
  }
  if (id.startsWith("lip")) {
    const i = Number(id.slice(3));
    return { lips: s.lips.map((q, j) => (j === i ? p : q)) };
  }
  const d = s.design;
  const a = designAngle(d, s.guides);
  if (id === "move") return { design: { ...d, center: { x: p.x - grab.x, y: p.y - grab.y } } };
  const l = toLocal(p, d, a);
  if (id === "widthL" || id === "widthR") return { design: { ...d, width: Math.max(s.imgW * 0.04, Math.abs(l.x) * 2) } };
  if (id === "length") {
    const L = Math.max(4, -l.y);
    const wl = Math.min(0.95, Math.max(0.6, centralWidth(d) / L));
    return { design: { ...d, wl: Math.round(wl * 100) / 100 } };
  }
  return {};
}

export function Stage(props: Props) {
  const { step, showOriginal, calibrating, compareView } = props;
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [selected, setSelected] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const propsRef = useRef(props);
  propsRef.current = props;
  const sizeRef = useRef(size);
  const view = useRef<View | null>(null);
  const live = useRef<Live | null>(null);
  const active = useRef<string | null>(null);
  const selRef = useRef<string | null>(null);
  selRef.current = focused ? selected : null;
  const divider = useRef(0.5);
  const quality = useRef<"fast" | "full">("full");
  const fullTimer = useRef(0);
  const raf = useRef(0);
  const lastPush = useRef(0);
  const loupe = useRef<{ img: Pt; finger: Pt } | null>(null);
  const pointers = useRef(new Map<number, Pt>());
  const gesture = useRef<
    | { kind: "handle"; id: string; grab: Pt }
    | { kind: "pan"; start: Pt; view: View }
    | { kind: "pinch"; d0: number; m0: Pt; view: View }
    | { kind: "divider" }
    | null
  >(null);

  const draw = useCallback(() => {
    raf.current = 0;
    const cv = canvas.current;
    const v = view.current;
    const { w, h } = sizeRef.current;
    if (!cv || !v || !w || !h) return;
    const p = propsRef.current;
    const s: Scene = live.current ? { ...p.scene, ...stripCalib(live.current) } : p.scene;
    const calib = live.current?.calib ?? p.calib;
    const dragging = !!gesture.current;
    const dpr = Math.min(window.devicePixelRatio || 1, dragging ? 2 : 3);
    const bw = Math.round(w * dpr);
    const bh = Math.round(h * dpr);
    // resizing a canvas reallocates it: only when the box or the DPR changes
    if (cv.width !== bw || cv.height !== bh) {
      cv.width = bw;
      cv.height = bh;
    }
    const ctx = cv.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = C.slateDeep;
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.translate(v.ox, v.oy);
    ctx.scale(v.scale, v.scale);
    ctx.imageSmoothingQuality = dragging ? "low" : "high";
    ctx.drawImage(s.img, 0, 0, s.imgW, s.imgH);
    const q = quality.current;
    const cal = p.step === "design" && p.calibrating;
    if (!p.showOriginal) {
      if (p.step === "lips") {
        ctx.save();
        ctx.globalAlpha = 0.5;
        drawTeethQ(ctx, s, "outline", q);
        ctx.restore();
      } else if (p.step === "compare") {
        ctx.save();
        const x = (divider.current * w - v.ox) / v.scale;
        ctx.beginPath();
        ctx.rect(x, 0, s.imgW * 2, s.imgH);
        ctx.clip();
        drawTeethQ(ctx, s, "mockup", q);
        ctx.restore();
      } else if ((p.step === "design" && !cal) || p.step === "shade") {
        drawTeethQ(ctx, s, p.step === "design" && p.mode === "outline" ? "outline" : "mockup", q);
      }
      if (cal) drawCalib(ctx, calib, v.scale, active.current ?? selRef.current);
      else drawOverlay(ctx, s, { step: p.step, scale: v.scale, activeHandle: active.current ?? selRef.current });
    }
    ctx.restore();

    if (p.step === "compare" && !p.showOriginal) {
      const x = divider.current * w;
      // knob sits below the mouth so it never covers the teeth
      const mouthBottom = v.oy + (s.design.center.y + s.design.width * 0.32) * v.scale;
      const ky = Math.min(h - 30, Math.max(30, mouthBottom + 44));
      ctx.fillStyle = C.white;
      ctx.fillRect(x - 1, 0, 2, h);
      ctx.beginPath();
      ctx.arc(x, ky, 22, 0, Math.PI * 2);
      ctx.fillStyle = C.bronze;
      ctx.fill();
      ctx.strokeStyle = C.white;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = C.white;
      ctx.font = "600 14px Oswald, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("‹ ›", x, ky + 1);
    }

    // loupe: the finger hides the point being placed, so show it magnified in the opposite top corner
    const L = loupe.current;
    if (L) {
      const cx = L.finger.x > w / 2 ? 12 + LOUPE_R : w - 12 - LOUPE_R;
      const cy = 12 + LOUPE_R;
      const k = v.scale * LOUPE_ZOOM;
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, LOUPE_R, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = C.slateDeep;
      ctx.fillRect(cx - LOUPE_R, cy - LOUPE_R, LOUPE_R * 2, LOUPE_R * 2);
      ctx.translate(cx - L.img.x * k, cy - L.img.y * k);
      ctx.scale(k, k);
      ctx.drawImage(s.img, 0, 0, s.imgW, s.imgH);
      ctx.restore();
      ctx.strokeStyle = C.bronzeLight;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, LOUPE_R, 0, Math.PI * 2);
      ctx.stroke();
      // crosshair with a gap at the exact point
      ctx.strokeStyle = C.white;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        ctx.moveTo(cx + dx * 6, cy + dy * 6);
        ctx.lineTo(cx + dx * 22, cy + dy * 22);
      }
      ctx.stroke();
    }
  }, []);

  const requestDraw = useCallback(() => {
    if (!raf.current) raf.current = requestAnimationFrame(draw);
  }, [draw]);

  // redraw whenever anything visible changes
  useEffect(requestDraw, [requestDraw, props.scene, props.step, props.mode, props.showOriginal, props.calib, props.calibrating, selected, focused]);
  useEffect(
    () => () => {
      cancelAnimationFrame(raf.current);
      raf.current = 0; // StrictMode re-mounts: allow the next request to schedule again
      window.clearTimeout(fullTimer.current);
    },
    [],
  );

  const fit = useCallback(() => {
    const { w, h } = sizeRef.current;
    const s = propsRef.current.scene;
    if (!w) return;
    const scale = Math.min(w / s.imgW, h / s.imgH);
    view.current = { scale, ox: (w - s.imgW * scale) / 2, oy: (h - s.imgH * scale) / 2 };
    requestDraw();
  }, [requestDraw]);

  const mouth = useCallback(() => {
    const { w, h } = sizeRef.current;
    const d = propsRef.current.scene.design;
    if (!w) return;
    const scale = Math.min(w / (d.width * 1.6), h / (d.width * 0.95), 8);
    view.current = { scale, ox: w / 2 - d.center.x * scale, oy: h * 0.5 - (d.center.y - d.width * 0.12) * scale };
    requestDraw();
  }, [requestDraw]);

  // keep canvas sized to its box
  useEffect(() => {
    const el = wrap.current!;
    const ro = new ResizeObserver(() => {
      sizeRef.current = { w: el.clientWidth, h: el.clientHeight };
      setSize(sizeRef.current);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Face: whole photo. Lips / teeth / shade: zoom to the mouth. Compare: mouth by default, face on request.
  useEffect(() => {
    if (!size.w) return;
    if (step === "guides" || (step === "compare" && compareView === "face")) fit();
    else mouth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, compareView, size.w, size.h]);

  const toImg = (p: Pt): Pt => {
    const v = view.current!;
    return { x: (p.x - v.ox) / v.scale, y: (p.y - v.oy) / v.scale };
  };

  const local = (e: React.PointerEvent): Pt => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const current = (): { s: Scene; calib?: Calib } => {
    const p = propsRef.current;
    return { s: live.current ? { ...p.scene, ...stripCalib(live.current) } : p.scene, calib: live.current?.calib ?? p.calib };
  };

  const push = () => {
    const l = live.current;
    if (!l) return;
    const p = propsRef.current;
    if (l.guides) p.onGuides(l.guides);
    if (l.lips) p.onLips(l.lips);
    if (l.design) p.onDesign(l.design);
    if (l.calib) p.onCalib(l.calib);
    lastPush.current = performance.now();
  };

  const startFast = () => {
    window.clearTimeout(fullTimer.current);
    quality.current = "fast";
  };
  const endFast = () => {
    window.clearTimeout(fullTimer.current);
    fullTimer.current = window.setTimeout(() => {
      quality.current = "full";
      requestDraw();
    }, 150);
  };

  const endHandle = () => {
    push();
    live.current = null;
    active.current = null;
    loupe.current = null;
    propsRef.current.onGesture(false);
  };

  const onDown = (e: React.PointerEvent) => {
    if (!view.current) return;
    canvas.current!.setPointerCapture(e.pointerId);
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    startFast();
    if (pointers.current.size === 2) {
      if (gesture.current?.kind === "handle") endHandle();
      const [a, b] = [...pointers.current.values()];
      gesture.current = { kind: "pinch", d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, m0: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, view: view.current };
      requestDraw();
      return;
    }
    if (pointers.current.size > 2) return;
    const ip = toImg(p);
    const { s, calib } = current();
    const pr = propsRef.current;
    const cal = pr.step === "design" && pr.calibrating;
    let id = cal ? nearest(handlesOf(s, pr.step, true, calib), ip, Infinity) : hitHandle(s, pr.step, ip, HIT / view.current.scale);
    if (pr.showOriginal) id = null;
    if (id) {
      const grab = id === "move" ? { x: ip.x - s.design.center.x, y: ip.y - s.design.center.y } : { x: 0, y: 0 };
      gesture.current = { kind: "handle", id, grab };
      active.current = id;
      setSelected(id);
      haptic();
      pr.onGesture(true);
      if (id !== "move" && !id.startsWith("width") && id !== "length") loupe.current = { img: handlePos(s, calib, id) ?? ip, finger: p };
      // calibration: a tap places the nearest pin right there
      if (cal) {
        live.current = moveHandle(s, calib, id, ip, grab);
        loupe.current = { img: ip, finger: p };
      }
    } else if (pr.step === "compare") {
      gesture.current = { kind: "divider" };
      divider.current = Math.min(1, Math.max(0, p.x / sizeRef.current.w));
    } else {
      gesture.current = { kind: "pan", start: p, view: view.current };
    }
    requestDraw();
  };

  const onMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId) || !view.current) return;
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    const g = gesture.current;
    if (!g) return;
    if (g.kind === "pinch" && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const scale = Math.min(20, Math.max(0.05, g.view.scale * (d / g.d0)));
      // keep the image point under the first midpoint under the current midpoint
      const ix = (g.m0.x - g.view.ox) / g.view.scale;
      const iy = (g.m0.y - g.view.oy) / g.view.scale;
      view.current = { scale, ox: m.x - ix * scale, oy: m.y - iy * scale };
    } else if (g.kind === "pan") {
      view.current = { ...g.view, ox: g.view.ox + p.x - g.start.x, oy: g.view.oy + p.y - g.start.y };
    } else if (g.kind === "handle") {
      const { s, calib } = current();
      const ip = toImg(p);
      live.current = { ...live.current, ...moveHandle(s, calib, g.id, ip, g.grab) };
      if (loupe.current) loupe.current = { img: handlePos(current().s, current().calib, g.id) ?? ip, finger: p };
      if (performance.now() - lastPush.current > PUSH_MS) push();
    } else if (g.kind === "divider") {
      divider.current = Math.min(1, Math.max(0, p.x / sizeRef.current.w));
    }
    requestDraw();
  };

  const onUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) {
      if (gesture.current?.kind === "handle") endHandle();
      gesture.current = null;
      endFast();
      requestDraw();
    } else if (gesture.current?.kind === "pinch" && view.current) {
      const [p] = [...pointers.current.values()];
      gesture.current = { kind: "pan", start: p, view: view.current };
    }
  };

  const onWheel = (e: React.WheelEvent) => {
    const v = view.current;
    if (!v) return;
    const p = { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY };
    const scale = Math.min(20, Math.max(0.05, v.scale * Math.exp(-e.deltaY * 0.0015)));
    const ix = (p.x - v.ox) / v.scale;
    const iy = (p.y - v.oy) / v.scale;
    view.current = { scale, ox: p.x - ix * scale, oy: p.y - iy * scale };
    startFast();
    endFast();
    requestDraw();
  };

  // keyboard: arrows nudge the selected handle (1 screen px, Shift = 10), [ and ] pick another handle
  const onKey = (e: React.KeyboardEvent) => {
    const v = view.current;
    if (!v) return;
    const pr = propsRef.current;
    const { s, calib } = current();
    const ids = handlesOf(s, pr.step, pr.calibrating, calib).map(([id]) => id);
    if (!ids.length) return;
    const sel = selected && ids.includes(selected) ? selected : ids[0];
    if (e.key === "[" || e.key === "]") {
      const i = ids.indexOf(sel);
      setSelected(ids[(i + (e.key === "]" ? 1 : ids.length - 1)) % ids.length]);
      e.preventDefault();
      return;
    }
    const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!dir) return;
    e.preventDefault();
    if (sel !== selected) setSelected(sel);
    const pos = handlePos(s, calib, sel);
    if (!pos) return;
    const k = (e.shiftKey ? 10 : 1) / v.scale;
    const np = { x: pos.x + dir[0] * k, y: pos.y + dir[1] * k };
    const grab = sel === "move" ? { x: pos.x - s.design.center.x, y: pos.y - s.design.center.y } : { x: 0, y: 0 };
    live.current = moveHandle(s, calib, sel, np, grab);
    push();
    live.current = null;
  };

  const selName = focused && selected ? handleName(selected) : "";

  return (
    <div className="stage" ref={wrap}>
      <canvas
        ref={canvas}
        tabIndex={0}
        style={{ width: size.w, height: size.h }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onWheel={onWheel}
        onDoubleClick={fit}
        onKeyDown={onKey}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        role="application"
        aria-roledescription="photo editor"
        aria-label="Smile design photo. Drag the round dots with one finger; pinch to zoom. With a keyboard: arrow keys move the selected dot, [ and ] pick another."
      />
      <span className="sr-only" aria-live="polite">
        {selName && `Selected: ${selName}`}
      </span>
      {showOriginal && <span className="stage-tag mono">Before · original photo</span>}
      {step === "compare" && !showOriginal && (
        <>
          <span className="stage-tag mono">Now</span>
          <span className="stage-tag right mono">Simulation</span>
        </>
      )}
      {calibrating && step === "design" && <span className="stage-tag mono">Calibrating · teeth hidden</span>}
      <button className="fab fit" onClick={fit} aria-label="Fit whole photo to screen">
        ⤢
      </button>
    </div>
  );
}

function stripCalib(l: Live): Partial<Scene> {
  const { calib: _c, ...rest } = l;
  return rest;
}

function nearest(cands: [string, Pt][], p: Pt, radius: number) {
  let best: string | null = null;
  let bd = radius;
  for (const [id, q] of cands) {
    const d = Math.hypot(q.x - p.x, q.y - p.y);
    if (d < bd) {
      bd = d;
      best = id;
    }
  }
  return best;
}

function handlePos(s: Scene, calib: Calib | undefined, id: string): Pt | null {
  if (id === "calA") return calib?.a ?? null;
  if (id === "calB") return calib?.b ?? null;
  if (id === "pupilR" || id === "pupilL" || id === "midline") return s.guides[id];
  if (id.startsWith("lip")) return s.lips[Number(id.slice(3))] ?? null;
  const h = designHandles(s.design, designAngle(s.design, s.guides));
  return (h as Record<string, Pt>)[id] ?? null;
}

/** Calibration pins on the existing central: two points joined by a measuring line with end ticks. */
function drawCalib(ctx: CanvasRenderingContext2D, c: Calib | undefined, scale: number, activeId: string | null) {
  if (!c) return;
  const u = 1 / scale;
  const ang = Math.atan2(c.b.y - c.a.y, c.b.x - c.a.x) + Math.PI / 2;
  ctx.save();
  ctx.lineCap = "round";
  ctx.strokeStyle = C.white;
  ctx.lineWidth = 2 * u;
  ctx.beginPath();
  ctx.moveTo(c.a.x, c.a.y);
  ctx.lineTo(c.b.x, c.b.y);
  for (const q of [c.a, c.b]) {
    ctx.moveTo(q.x - Math.cos(ang) * 26 * u, q.y - Math.sin(ang) * 26 * u);
    ctx.lineTo(q.x + Math.cos(ang) * 26 * u, q.y + Math.sin(ang) * 26 * u);
  }
  ctx.stroke();
  for (const [id, q] of [["calA", c.a], ["calB", c.b]] as const) {
    const on = activeId === id;
    ctx.beginPath();
    ctx.arc(q.x, q.y - 34 * u, 11 * u, 0, Math.PI * 2);
    ctx.fillStyle = on ? C.bronzeLight : "rgba(28,34,32,0.7)";
    ctx.fill();
    ctx.lineWidth = 3 * u;
    ctx.strokeStyle = C.bronzeLight;
    ctx.stroke();
    // stem to the exact point (the pin head sits above it so the finger does not hide the edge)
    ctx.beginPath();
    ctx.moveTo(q.x, q.y - 23 * u);
    ctx.lineTo(q.x, q.y);
    ctx.lineWidth = 1.5 * u;
    ctx.stroke();
  }
  ctx.restore();
}
