// The interactive canvas: draws the scene, handles drag / pan / pinch-zoom with pointer events.
import { useCallback, useEffect, useRef, useState } from "react";
import { centralWidth, designAngle, toLocal } from "./geometry";
import type { Design, Guides, Pt } from "./model";
import { drawOverlay, drawTeeth, hitHandle, type Scene, type Step } from "./render";

interface View {
  scale: number;
  ox: number;
  oy: number;
}

interface Props {
  scene: Scene;
  step: Step;
  mode: "mockup" | "outline";
  showOriginal: boolean;
  onGuides: (g: Guides) => void;
  onLips: (l: Pt[]) => void;
  onDesign: (d: Design) => void;
}

const HIT = 28; // css px

export function Stage({ scene, step, mode, showOriginal, onGuides, onLips, onDesign }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [view, setView] = useState<View | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [active, setActive] = useState<string | null>(null);
  const [divider, setDivider] = useState(0.5);
  const pointers = useRef(new Map<number, Pt>());
  const gesture = useRef<
    | { kind: "handle"; id: string; grab: Pt }
    | { kind: "pan"; start: Pt; view: View }
    | { kind: "pinch"; d0: number; m0: Pt; view: View }
    | { kind: "divider" }
    | null
  >(null);

  const fit = useCallback(() => {
    if (!size.w) return;
    const scale = Math.min(size.w / scene.imgW, size.h / scene.imgH);
    setView({ scale, ox: (size.w - scene.imgW * scale) / 2, oy: (size.h - scene.imgH * scale) / 2 });
  }, [size, scene.imgW, scene.imgH]);

  // keep canvas sized to its box
  useEffect(() => {
    const el = wrap.current!;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // Face / compare: whole photo. Lips / teeth / shade: zoom to the mouth. Re-applied when the box resizes.
  useEffect(() => {
    if (!size.w) return;
    if (step === "guides" || step === "compare") return fit();
    const d = scene.design;
    const scale = Math.min(size.w / (d.width * 1.6), size.h / (d.width * 0.95), 8);
    setView({ scale, ox: size.w / 2 - d.center.x * scale, oy: size.h * 0.5 - (d.center.y - d.width * 0.12) * scale });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, size.w, size.h]);

  // draw
  useEffect(() => {
    const cv = canvas.current;
    if (!cv || !view) return;
    const dpr = window.devicePixelRatio || 1;
    cv.width = Math.round(size.w * dpr);
    cv.height = Math.round(size.h * dpr);
    const ctx = cv.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#1C2220";
    ctx.fillRect(0, 0, size.w, size.h);
    ctx.save();
    ctx.translate(view.ox, view.oy);
    ctx.scale(view.scale, view.scale);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(scene.img, 0, 0, scene.imgW, scene.imgH);
    const teeth = !showOriginal && (step === "design" || step === "shade" || step === "compare" || step === "lips");
    if (teeth) {
      if (step === "compare") {
        ctx.save();
        const x = (divider * size.w - view.ox) / view.scale;
        ctx.beginPath();
        ctx.rect(x, 0, scene.imgW * 2, scene.imgH);
        ctx.clip();
        drawTeeth(ctx, scene, "mockup");
        ctx.restore();
      } else {
        drawTeeth(ctx, scene, step === "design" && mode === "outline" ? "outline" : "mockup");
      }
    }
    if (!showOriginal) drawOverlay(ctx, scene, { step, scale: view.scale, activeHandle: active });
    ctx.restore();
    if (step === "compare" && !showOriginal) {
      const x = divider * size.w;
      ctx.fillStyle = "#F7F8F6";
      ctx.fillRect(x - 1, 0, 2, size.h);
      ctx.beginPath();
      ctx.arc(x, size.h / 2, 18, 0, Math.PI * 2);
      ctx.fillStyle = "#816951";
      ctx.fill();
      ctx.strokeStyle = "#F7F8F6";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "#F7F8F6";
      ctx.font = "600 12px Oswald, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("‹ ›", x, size.h / 2 + 1);
    }
  }, [scene, view, size, step, mode, active, divider, showOriginal]);

  const toImg = (p: Pt): Pt => (view ? { x: (p.x - view.ox) / view.scale, y: (p.y - view.oy) / view.scale } : p);

  const local = (e: React.PointerEvent): Pt => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const dragHandle = (id: string, p: Pt, grab: Pt) => {
    if (id === "pupilR" || id === "pupilL" || id === "midline") return onGuides({ ...scene.guides, [id]: p });
    if (id.startsWith("lip")) {
      const i = Number(id.slice(3));
      return onLips(scene.lips.map((q, j) => (j === i ? p : q)));
    }
    const d = scene.design;
    const a = designAngle(d, scene.guides);
    if (id === "move") return onDesign({ ...d, center: { x: p.x - grab.x, y: p.y - grab.y } });
    const l = toLocal(p, d, a);
    if (id === "widthL" || id === "widthR") {
      const width = Math.max(scene.imgW * 0.04, Math.abs(l.x) * 2);
      return onDesign({ ...d, width });
    }
    if (id === "length") {
      const L = Math.max(4, -l.y);
      const wl = Math.min(0.95, Math.max(0.6, centralWidth(d) / L));
      return onDesign({ ...d, wl: Math.round(wl * 100) / 100 });
    }
  };

  const onDown = (e: React.PointerEvent) => {
    if (!view) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current = { kind: "pinch", d0: Math.hypot(a.x - b.x, a.y - b.y), m0: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, view };
      setActive(null);
      return;
    }
    const ip = toImg(p);
    const id = hitHandle(scene, step, ip, HIT / view.scale);
    if (id) {
      const grab = id === "move" ? { x: ip.x - scene.design.center.x, y: ip.y - scene.design.center.y } : { x: 0, y: 0 };
      gesture.current = { kind: "handle", id, grab };
      setActive(id);
    } else if (step === "compare") {
      gesture.current = { kind: "divider" };
      setDivider(Math.min(1, Math.max(0, p.x / size.w)));
    } else {
      gesture.current = { kind: "pan", start: p, view };
    }
  };

  const onMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId) || !view) return;
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
      setView({ scale, ox: m.x - ix * scale, oy: m.y - iy * scale });
    } else if (g.kind === "pan") {
      setView({ ...g.view, ox: g.view.ox + p.x - g.start.x, oy: g.view.oy + p.y - g.start.y });
    } else if (g.kind === "handle") {
      dragHandle(g.id, toImg(p), g.grab);
    } else if (g.kind === "divider") {
      setDivider(Math.min(1, Math.max(0, p.x / size.w)));
    }
  };

  const onUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) {
      gesture.current = null;
      setActive(null);
    } else if (gesture.current?.kind === "pinch" && view) {
      const [p] = [...pointers.current.values()];
      gesture.current = { kind: "pan", start: p, view };
    }
  };

  const onWheel = (e: React.WheelEvent) => {
    if (!view) return;
    const p = { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY };
    const k = Math.exp(-e.deltaY * 0.0015);
    const scale = Math.min(20, Math.max(0.05, view.scale * k));
    const ix = (p.x - view.ox) / view.scale;
    const iy = (p.y - view.oy) / view.scale;
    setView({ scale, ox: p.x - ix * scale, oy: p.y - iy * scale });
  };

  return (
    <div className="stage" ref={wrap}>
      <canvas
        ref={canvas}
        style={{ width: size.w, height: size.h }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onWheel={onWheel}
        onDoubleClick={fit}
        aria-label="Smile design canvas. Drag the round handles; pinch or scroll to zoom."
      />
      <button className="fab fit" onClick={fit} aria-label="Fit photo to screen">
        ⤢
      </button>
    </div>
  );
}
