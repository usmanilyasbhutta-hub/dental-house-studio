// The interactive canvas: draws the scene, handles drag / pan / pinch-zoom with pointer events.
// Performance: live drag state lives in refs and is drawn on requestAnimationFrame (at most once per frame);
// React state is updated throttled (~10 Hz) and on release. Teeth render in "fast" quality during gestures.
import { useCallback, useEffect, useRef, useState } from "react";
import { drawPrepMap, paintMask, type Mask, type PrepResult } from "./engineShim";
import { centralLength, centralWidth, designAngle, pupilAngle, smoothClosed, toImage, toLocal } from "./geometry";
import type { Design, Guides, Pt } from "./model";
import { C, drawOverlay, drawTeeth, type Scene, type Step } from "./render";
import { haptic, Icon } from "./ui";


interface View {
  scale: number;
  ox: number;
  oy: number;
}

export type Calib = { a: Pt; b: Pt };

/** Existing-teeth brush: radius in screen px so it feels the same at any zoom. */
export type MaskTool = { mode: "paint" | "erase"; size: number };

/** Upper/lower wl limits for the length handle (lower central W/L ≈ 0.62, 0.5–0.75: docs/round3-clinical.md A). */
export const WL_RANGE = { upper: { min: 0.6, max: 0.95 }, lower: { min: 0.5, max: 0.75 } };

/**
 * Design handles (image coords). Upper: length dot above the teeth (gum side), move cross below.
 * Lower arch is mirrored: crowns grow down from the incisal edge, so the length dot sits below and the move cross above.
 */
export function uiHandles(d: Design, angle: number) {
  const L = centralLength(d);
  // the lower arch is mirrored inside geometry's toImage/toLocal, so the same local positions work for both arches
  return {
    move: toImage({ x: 0, y: L * 0.6 }, d, angle),
    widthR: toImage({ x: d.width / 2, y: -L * 0.3 }, d, angle),
    widthL: toImage({ x: -d.width / 2, y: -L * 0.3 }, d, angle),
    length: toImage({ x: 0, y: -L }, d, angle),
  };
}

interface Live {
  guides?: Guides;
  lips?: Pt[];
  design?: Design;
  calib?: Calib;
  samples?: Pt[];
  fit?: Pt[];
}

/** Plan step: a shade sample pin (r: its sampled disk radius, image px; ok false: includes gum or shadow). */
export type SamplePin = { pt: Pt; role: "reference" | "match"; r?: number; ok?: boolean };

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
  /** true when a handle drag (or a brush stroke) starts, false when it ends (history commits then). */
  onGesture: (active: boolean) => void;
  /** Reduction map over the photo (Teeth and Compare steps). */
  showPrep?: boolean;
  prep?: PrepResult | null;
  /** Lips step, "Existing teeth" tool: brush state, the mask (painted in place) and its version. */
  maskTool?: MaskTool | null;
  mask?: Mask | null;
  maskVersion?: number;
  /** a brush stroke changed the mask (called at the end of each stroke) */
  onMaskEdited?: () => void;
  /** Plan step: shade sample pins, the role a tap drops (null: one finger pans), the sampled disk radius (image px). */
  samples?: SamplePin[];
  pickRole?: "reference" | "match" | null;
  sampleR?: number;
  /** a pin was dropped (pointer down in pick mode); it is then dragged like any handle */
  onAddSample?: (p: Pt) => void;
  /** pin positions after a drag (same order as samples) */
  onSamples?: (pts: Pt[]) => void;
  /** Teeth step, "Fit to teeth": the canine taps so far (0–2; patient's right first). null = not fitting. */
  fitTaps?: Pt[] | null;
  /** canine taps after a tap / drag (the editor fits the template from them) */
  onFitTaps?: (pts: Pt[]) => void;
  /** overlays on top of the photo (e.g. the "Fit to teeth" hint chip) */
  children?: React.ReactNode;
  /** Labs (Auto-detect beta, flag on only): proposed dots drawn as hollow "ghost" dots until the user confirms. */
  ghost?: { guides?: Guides; lips?: Pt[] } | null;
  /** Labs: Lips › Existing teeth "Tap a tooth" / "Erase tooth": a one-finger tap reports the image point (drag pans). */
  tapTool?: "add" | "erase" | null;
  onTapTool?: (p: Pt) => void;
  /** Labs: the proposed tooth region (same raster as `mask`), tinted until the user confirms. */
  proposal?: Mask | null;
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
  brush: "existing-teeth brush",
  calA: "first edge of the existing central",
  calB: "second edge of the existing central",
  fit0: "tip of the patient's right canine",
  fit1: "tip of the patient's left canine",
};
export const handleName = (id: string) =>
  id.startsWith("lip") ? `lip point ${Number(id.slice(3)) + 1} of 12` : id.startsWith("smp") ? `shade sample ${Number(id.slice(3)) + 1}` : (NAMES[id] ?? id);

/** Handles that can be dragged in the current step, with their image positions. */
function handlesOf(s: Scene, step: Step, calibrating: boolean, calib?: Calib, samples?: Pt[], fit?: Pt[] | null): [string, Pt][] {
  if (step === "plan") return (samples ?? []).map((q, i) => [`smp${i}`, q]);
  if (step === "design" && fit) return fit.map((q, i) => [`fit${i}`, q]);
  if (step === "design" && calibrating) return calib ? [["calA", calib.a], ["calB", calib.b]] : [];
  if (step === "guides") return [["pupilR", s.guides.pupilR], ["pupilL", s.guides.pupilL], ["midline", s.guides.midline]];
  if (step === "lips") return s.lips.map((q, i) => [`lip${i}`, q]);
  if (step === "design") {
    const h = uiHandles(s.design, designAngle(s.design, s.guides));
    const opp = (s.design.opposing ?? []).map((q, i) => [`opp${i}`, q] as [string, Pt]);
    return [...opp, ["move", h.move], ["widthL", h.widthL], ["widthR", h.widthR], ["length", h.length]];
  }
  return [];
}

/** The new state after moving handle id to image point p. */
function moveHandle(s: Scene, calib: Calib | undefined, id: string, p: Pt, grab: Pt, samples?: Pt[], fit?: Pt[] | null): Live {
  if (id.startsWith("fit")) {
    const i = Number(id.slice(3));
    const cur = fit ?? [];
    return { fit: i >= cur.length ? [...cur, p] : cur.map((q, j) => (j === i ? p : q)) };
  }
  if (id.startsWith("smp")) {
    const i = Number(id.slice(3));
    const cur = samples ?? [];
    const at = { x: p.x - grab.x, y: p.y - grab.y };
    return { samples: i >= cur.length ? [...cur, at] : cur.map((q, j) => (j === i ? at : q)) };
  }
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
  if (id.startsWith("opp") && d.opposing) {
    const i = Number(id.slice(3));
    return { design: { ...d, opposing: d.opposing.map((q, j) => (j === i ? p : q)) } };
  }
  if (id === "move") return { design: { ...d, center: { x: p.x - grab.x, y: p.y - grab.y } } };
  const l = toLocal(p, d, a);
  if (id === "widthL" || id === "widthR") return { design: { ...d, width: Math.max(s.imgW * 0.04, Math.abs(l.x) * 2) } };
  if (id === "length") {
    const lower = d.arch === "lower";
    const L = Math.max(4, -l.y); // toLocal already mirrors the lower arch
    const r = WL_RANGE[lower ? "lower" : "upper"];
    const wl = Math.min(r.max, Math.max(r.min, centralWidth(d) / L));
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
    | { kind: "pan"; start: Pt; view: View; tap?: boolean }
    | { kind: "pinch"; d0: number; m0: Pt; view: View }
    | { kind: "divider" }
    | { kind: "paint"; last: Pt; started: boolean }
    | null
  >(null);
  const maskCv = useRef<HTMLCanvasElement | null>(null);
  const brush = useRef<Pt | null>(null);
  const painting = () => propsRef.current.step === "lips" && !!propsRef.current.maskTool && !propsRef.current.tapTool;
  const propCv = useRef<HTMLCanvasElement | null>(null);
  const rebuildMask = useCallback(() => {
    const m = propsRef.current.mask;
    if (!m) {
      maskCv.current = null;
      return;
    }
    const cv = maskCv.current && maskCv.current.width === m.w && maskCv.current.height === m.h ? maskCv.current : document.createElement("canvas");
    cv.width = m.w;
    cv.height = m.h;
    const ctx = cv.getContext("2d")!;
    const im = ctx.createImageData(m.w, m.h);
    for (let i = 0; i < m.data.length; i++)
      if (m.data[i]) {
        const o = i * 4;
        im.data[o] = 70;
        im.data[o + 1] = 170;
        im.data[o + 2] = 255;
        im.data[o + 3] = 120;
      }
    ctx.putImageData(im, 0, 0);
    maskCv.current = cv;
  }, []);

  const draw = useCallback(() => {
    raf.current = 0;
    const cv = canvas.current;
    const v = view.current;
    const { w, h } = sizeRef.current;
    if (!cv || !v || !w || !h) return;
    const p = propsRef.current;
    const s: Scene = live.current ? { ...p.scene, ...stripCalib(live.current) } : p.scene;
    const calib = live.current?.calib ?? p.calib;
    const pins = live.current?.samples ?? p.samples?.map((x) => x.pt) ?? [];
    const fitPts = live.current?.fit ?? p.fitTaps ?? null;
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
    const fitting = p.step === "design" && !!fitPts && !cal;
    const prepOn = !!p.showPrep && !!p.prep && !cal && (p.step === "design" || p.step === "compare");
    const paintOn = p.step === "lips" && !!p.maskTool;
    if (!p.showOriginal && paintOn) {
      // existing-teeth tool: translucent tint over the photo, lip line for orientation, no dots
      if (maskCv.current) {
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(maskCv.current, 0, 0, s.imgW, s.imgH);
        ctx.restore();
      }
      ctx.save();
      ctx.beginPath();
      smoothClosed(s.lips).forEach((q2, i) => (i ? ctx.lineTo(q2.x, q2.y) : ctx.moveTo(q2.x, q2.y)));
      ctx.closePath();
      ctx.setLineDash([6 / v.scale, 5 / v.scale]);
      ctx.lineWidth = 1.5 / v.scale;
      ctx.strokeStyle = "rgba(201,171,134,0.85)";
      ctx.stroke();
      ctx.restore();
    } else if (!p.showOriginal && fitting) {
      // fit to teeth: the patient's own canines must be visible, so the template is only a thin outline once both
      // taps are in (it follows the pins live)
      if (fitPts!.length >= 2) {
        ctx.save();
        ctx.globalAlpha = 0.85;
        drawTeeth(ctx, s, "outline", q);
        ctx.restore();
      }
      drawFitPins(ctx, fitPts!, v.scale, active.current ?? selRef.current);
    } else if (!p.showOriginal && prepOn) {
      drawPrepMap(ctx, s, p.prep!);
      ctx.save();
      ctx.globalAlpha = 0.75;
      drawTeeth(ctx, s, "outline", q);
      ctx.restore();
      if (p.step === "design") drawDesignOverlay(ctx, s, v.scale, active.current ?? selRef.current);
    } else if (!p.showOriginal && p.step === "plan") {
      // the patient's own teeth, untouched: pins sample the photo
      drawPins(ctx, pins, p.samples ?? [], p.sampleR ?? 6, v.scale, active.current ?? selRef.current, gesture.current?.kind === "handle");
    } else if (!p.showOriginal) {
      if (p.step === "lips") {
        ctx.save();
        ctx.globalAlpha = 0.5;
        drawTeeth(ctx, s, "outline", q);
        ctx.restore();
      } else if (p.step === "compare") {
        ctx.save();
        const x = (divider.current * w - v.ox) / v.scale;
        ctx.beginPath();
        ctx.rect(x, 0, s.imgW * 2, s.imgH);
        ctx.clip();
        drawTeeth(ctx, s, "mockup", q);
        ctx.restore();
      } else if ((p.step === "design" && !cal) || p.step === "shade") {
        drawTeeth(ctx, s, p.step === "design" && p.mode === "outline" ? "outline" : "mockup", q);
      }
      if (cal) drawCalib(ctx, calib, v.scale, active.current ?? selRef.current);
      else if (p.step === "design") drawDesignOverlay(ctx, s, v.scale, active.current ?? selRef.current);
      else drawOverlay(ctx, s, { step: p.step, scale: v.scale, activeHandle: active.current ?? selRef.current });
    }
    if (!p.showOriginal && paintOn && p.proposal && propCv.current) {
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(propCv.current, 0, 0, s.imgW, s.imgH);
      ctx.restore();
    }
    if (!p.showOriginal && p.ghost) drawGhost(ctx, p.ghost, v.scale);
    ctx.restore();

    // brush ring under the finger while painting the existing-teeth mask
    if (paintOn && brush.current && p.maskTool) {
      ctx.beginPath();
      ctx.arc(brush.current.x, brush.current.y, p.maskTool.size, 0, Math.PI * 2);
      ctx.lineWidth = 2;
      ctx.strokeStyle = p.maskTool.mode === "erase" ? C.white : "rgb(70,170,255)";
      ctx.setLineDash(p.maskTool.mode === "erase" ? [5, 4] : []);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (p.step === "compare" && !p.showOriginal && !prepOn) {
      const x = divider.current * w;
      // knob sits below the mouth so it never covers the teeth
      const mouthBottom = v.oy + (s.design.center.y + s.design.width * 0.32) * v.scale;
      const ky = Math.min(h - 30, Math.max(30, mouthBottom + 44));
      // iOS-like divider: hairline with a soft shadow, white knob with two chevrons
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.35)";
      ctx.shadowBlur = 6;
      ctx.fillStyle = C.white;
      ctx.fillRect(x - 1, 0, 2, h);
      ctx.beginPath();
      ctx.arc(x, ky, 20, 0, Math.PI * 2);
      ctx.shadowBlur = 12;
      ctx.shadowOffsetY = 2;
      ctx.fill();
      ctx.restore();
      ctx.save();
      ctx.strokeStyle = C.slateDeep;
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(x - 4, ky - 6);
      ctx.lineTo(x - 10, ky);
      ctx.lineTo(x - 4, ky + 6);
      ctx.moveTo(x + 4, ky - 6);
      ctx.lineTo(x + 10, ky);
      ctx.lineTo(x + 4, ky + 6);
      ctx.stroke();
      ctx.restore();
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
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.45)";
      ctx.shadowBlur = 14;
      ctx.strokeStyle = C.white;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(cx, cy, LOUPE_R, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
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
  useEffect(requestDraw, [
    requestDraw,
    props.scene,
    props.step,
    props.mode,
    props.showOriginal,
    props.calib,
    props.calibrating,
    props.showPrep,
    props.prep,
    props.maskTool,
    props.samples,
    props.sampleR,
    props.fitTaps,
    props.ghost,
    props.tapTool,
    selected,
    focused,
  ]);
  // Labs: tooth proposal tint (amber, so it reads apart from the blue existing-teeth tint and from the teeth)
  useEffect(() => {
    const m = props.proposal;
    if (!m) {
      propCv.current = null;
    } else {
      const cv = document.createElement("canvas");
      cv.width = m.w;
      cv.height = m.h;
      const ctx = cv.getContext("2d")!;
      const im = ctx.createImageData(m.w, m.h);
      for (let i = 0; i < m.data.length; i++)
        if (m.data[i]) {
          const o = i * 4;
          im.data[o] = 255;
          im.data[o + 1] = 150;
          im.data[o + 2] = 40;
          im.data[o + 3] = 165;
        }
      ctx.putImageData(im, 0, 0);
      propCv.current = cv;
    }
    requestDraw();
  }, [props.proposal, requestDraw]);
  useEffect(() => {
    rebuildMask();
    requestDraw();
  }, [props.mask, props.maskVersion, rebuildMask, requestDraw]);
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
    userView.current = false;
    requestDraw();
  }, [requestDraw]);

  const mouth = useCallback(() => {
    const { w, h } = sizeRef.current;
    const d = propsRef.current.scene.design;
    if (!w) return;
    const scale = Math.min(w / (d.width * 1.6), h / (d.width * 0.95), 8);
    view.current = { scale, ox: w / 2 - d.center.x * scale, oy: h * 0.5 - (d.center.y - d.width * 0.12) * scale };
    userView.current = false;
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
  // A small size change (a hint line appearing in the panel below) keeps the view as it is: the stage's top edge does not
  // move, so the photo stays still under a finger mid-drag. A new step, a rotation or the first layout re-frames.
  const framed = useRef({ step: "", view: "", arch: "", w: 0, h: 0 });
  const arch = props.scene.design.arch ?? "upper";
  const userView = useRef(false); // the clinician zoomed or panned by hand: keep their framing on small resizes
  useEffect(() => {
    if (!size.w) return;
    const f = framed.current;
    const small = f.w > 0 && Math.abs(size.w - f.w) < f.w * 0.25 && Math.abs(size.h - f.h) < f.h * 0.25;
    const keep = gesture.current || userView.current || !!propsRef.current.fitTaps;
    if (f.step === step && f.view === compareView && f.arch === arch && small && view.current && keep) {
      requestDraw();
    } else if (step === "guides" || (step === "compare" && compareView === "face")) fit();
    else mouth();
    framed.current = { step, view: compareView, arch, w: size.w, h: size.h };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, compareView, arch, size.w, size.h]);

  const toImg = (p: Pt): Pt => {
    const v = view.current!;
    return { x: (p.x - v.ox) / v.scale, y: (p.y - v.oy) / v.scale };
  };

  const local = (e: React.PointerEvent): Pt => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const current = (): { s: Scene; calib?: Calib; pins: Pt[]; fit: Pt[] | null } => {
    const p = propsRef.current;
    return {
      s: live.current ? { ...p.scene, ...stripCalib(live.current) } : p.scene,
      calib: live.current?.calib ?? p.calib,
      pins: live.current?.samples ?? p.samples?.map((x) => x.pt) ?? [],
      fit: p.step === "design" && !p.calibrating ? (live.current?.fit ?? p.fitTaps ?? null) : null,
    };
  };

  const push = () => {
    const l = live.current;
    if (!l) return;
    const p = propsRef.current;
    if (l.guides) p.onGuides(l.guides);
    if (l.lips) p.onLips(l.lips);
    if (l.design) p.onDesign(l.design);
    if (l.calib) p.onCalib(l.calib);
    if (l.samples) p.onSamples?.(l.samples);
    if (l.fit) p.onFitTaps?.(l.fit);
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
      if (gesture.current?.kind === "paint") endStroke();
      brush.current = null;
      const [a, b] = [...pointers.current.values()];
      gesture.current = { kind: "pinch", d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, m0: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, view: view.current };
      requestDraw();
      return;
    }
    if (pointers.current.size > 2) return;
    const ip = toImg(p);
    const { s, calib, pins, fit: fitPts } = current();
    const pr = propsRef.current;
    if (pr.tapTool && pr.step === "lips" && !pr.showOriginal) {
      // Labs tap tool: a tap reports the point on release; a drag pans like an empty area
      gesture.current = { kind: "pan", start: p, view: view.current, tap: true };
      requestDraw();
      return;
    }
    if (painting() && !pr.showOriginal) {
      // one finger paints (after a few px, so a second finger can still turn it into a pinch); two fingers zoom / pan
      gesture.current = { kind: "paint", last: p, started: false };
      brush.current = p;
      requestDraw();
      return;
    }
    const cal = pr.step === "design" && pr.calibrating;
    let id = cal
      ? nearest(handlesOf(s, pr.step, true, calib), ip, Infinity)
      : nearest(handlesOf(s, pr.step, false, calib, pins, fitPts), ip, HIT / view.current.scale);
    // fit to teeth: a tap away from the pins places the next canine tip right there (then it drags with the loupe)
    let newFit = false;
    if (fitPts && !pr.showOriginal && !id && fitPts.length < 2) {
      id = `fit${fitPts.length}`;
      newFit = true;
      live.current = { fit: [...fitPts, ip] };
    }
    if (!id && pr.step === "plan") {
      // the pin's head (drawn above the point) is the easiest thing to grab
      const k = view.current.scale;
      const heads: [string, Pt][] = pins.map((q, i) => [`smp${i}`, { x: q.x, y: q.y - Math.max(pr.sampleR ?? 6, 3 / k) - 30 / k }]);
      id = nearest(heads, ip, 26 / k);
    }
    if (pr.showOriginal) id = null;
    let newPin = false;
    // plan step, pick mode: a tap on the photo drops a new pin there, then it drags like any handle
    if (!id && pr.step === "plan" && pr.pickRole && !pr.showOriginal) {
      id = `smp${pins.length}`;
      newPin = true;
      pr.onAddSample?.(ip);
      live.current = { samples: [...pins, ip] };
    }
    if (id) {
      const pinAt = id.startsWith("smp") && !newPin ? pins[Number(id.slice(3))] : null;
      const grab =
        id === "move" ? { x: ip.x - s.design.center.x, y: ip.y - s.design.center.y } : pinAt ? { x: ip.x - pinAt.x, y: ip.y - pinAt.y } : { x: 0, y: 0 };
      gesture.current = { kind: "handle", id, grab };
      active.current = id;
      setSelected(id);
      haptic();
      pr.onGesture(true);
      if (id !== "move" && !id.startsWith("width") && id !== "length")
        loupe.current = { img: handlePos(s, calib, id, live.current?.samples ?? pins, live.current?.fit ?? fitPts) ?? ip, finger: p };
      if (newFit) push();
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
      userView.current = true;
    } else if (g.kind === "pan") {
      if (g.tap && Math.hypot(p.x - g.start.x, p.y - g.start.y) < 8) return;
      g.tap = false;
      view.current = { ...g.view, ox: g.view.ox + p.x - g.start.x, oy: g.view.oy + p.y - g.start.y };
      userView.current = true;
    } else if (g.kind === "handle") {
      const { s, calib, pins, fit: fitPts } = current();
      const ip = toImg(p);
      live.current = { ...live.current, ...moveHandle(s, calib, g.id, ip, g.grab, pins, fitPts) };
      const c2 = current();
      if (loupe.current) loupe.current = { img: handlePos(c2.s, c2.calib, g.id, c2.pins, c2.fit) ?? ip, finger: p };
      if (performance.now() - lastPush.current > PUSH_MS) push();
    } else if (g.kind === "divider") {
      divider.current = Math.min(1, Math.max(0, p.x / sizeRef.current.w));
    } else if (g.kind === "paint") {
      brush.current = p;
      if (!g.started && Math.hypot(p.x - g.last.x, p.y - g.last.y) < 4) return requestDraw();
      if (!g.started) {
        g.started = true;
        propsRef.current.onGesture(true);
        haptic();
      }
      paintSeg(g.last, p);
      g.last = p;
    }
    requestDraw();
  };

  /** Dabs along a screen-space segment, spaced at a third of the brush radius. */
  const paintSeg = (a: Pt, b: Pt) => {
    const pr = propsRef.current;
    const v = view.current;
    if (!pr.mask || !pr.maskTool || !v) return;
    const r = pr.maskTool.size;
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / (r / 3)));
    const val = pr.maskTool.mode === "erase" ? 0 : 255;
    for (let i = 1; i <= n; i++) {
      const q = { x: a.x + ((b.x - a.x) * i) / n, y: a.y + ((b.y - a.y) * i) / n };
      paintMask(pr.mask, toImg(q), r / v.scale, val, pr.scene.imgW, pr.scene.imgH);
    }
    rebuildMask();
  };

  const endStroke = () => {
    const g = gesture.current;
    if (g?.kind !== "paint") return;
    if (g.started) {
      propsRef.current.onMaskEdited?.();
      propsRef.current.onGesture(false);
    }
    gesture.current = null;
  };

  const onUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) {
      if (gesture.current?.kind === "handle") endHandle();
      const g = gesture.current;
      if (g?.kind === "pan" && g.tap && e.type === "pointerup") propsRef.current.onTapTool?.(toImg(g.start));
      if (g?.kind === "paint") {
        // a tap without a drag leaves one dab
        if (!g.started && e.type === "pointerup") {
          g.started = true;
          propsRef.current.onGesture(true);
          paintSeg(g.last, { x: g.last.x + 0.01, y: g.last.y });
        }
        endStroke();
        brush.current = null;
      }
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
    userView.current = true;
    startFast();
    endFast();
    requestDraw();
  };

  // keyboard: arrows nudge the selected handle (1 screen px, Shift = 10), [ and ] pick another handle
  const onKey = (e: React.KeyboardEvent) => {
    const v = view.current;
    if (!v) return;
    const pr = propsRef.current;
    const { s, calib, pins, fit: fitPts } = current();
    const ids = handlesOf(s, pr.step, pr.calibrating, calib, pins, fitPts).map(([id]) => id);
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
    const pos = handlePos(s, calib, sel, pins, fitPts);
    if (!pos) return;
    const k = (e.shiftKey ? 10 : 1) / v.scale;
    const np = { x: pos.x + dir[0] * k, y: pos.y + dir[1] * k };
    const grab = sel === "move" ? { x: pos.x - s.design.center.x, y: pos.y - s.design.center.y } : { x: 0, y: 0 };
    live.current = moveHandle(s, calib, sel, np, grab, pins, fitPts);
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
        aria-label={
          step === "plan"
            ? props.pickRole
              ? `Shade sampling. Tap a tooth to place the ${props.pickRole === "reference" ? "reference" : "match"} pin; drag a pin to adjust; two fingers zoom.`
              : "Shade sample pins on the photo. Drag a pin to adjust; pinch to zoom. Arrow keys move the selected pin."
            : props.fitTaps && step === "design"
            ? `Fit to teeth. ${props.fitTaps.length < 2 ? `Tap the tip of the patient's ${props.fitTaps.length === 0 ? "right canine, on the left of the photo" : "left canine, on the right of the photo"}.` : "Drag a pin to adjust."} Two fingers zoom.`
            : props.tapTool && step === "lips"
            ? `Existing teeth mask. Tap a tooth to ${props.tapTool === "erase" ? "remove its outline" : "outline it"} automatically; drag or two fingers move and zoom the photo.`
            : props.maskTool && step === "lips"
            ? `Existing teeth mask. One finger ${props.maskTool.mode === "erase" ? "erases" : "paints"} the patient's own teeth; two fingers zoom and move the photo.`
            : "Smile design photo. Drag the round dots with one finger; pinch to zoom. With a keyboard: arrow keys move the selected dot, [ and ] pick another."
        }
      />
      <span className="sr-only" aria-live="polite">
        {selName && `Selected: ${selName}`}
      </span>
      {showOriginal && <span className="stage-tag">Before · original photo</span>}
      {props.showPrep && props.prep && !showOriginal && (step === "compare" || (step === "design" && !calibrating)) && (
        <span className="stage-tag prep-tag">Prep map · 2D outline, not depth</span>
      )}
      {props.maskTool && step === "lips" && !showOriginal && (
        <span className="stage-tag">
          Existing teeth · {props.tapTool ? (props.tapTool === "erase" ? "tap a tooth to erase" : "tap a tooth") : props.maskTool.mode === "erase" ? "erase" : "paint"}
        </span>
      )}
      {step === "compare" && !showOriginal && !props.showPrep && (
        <>
          <span className="stage-tag">Now</span>
          <span className="stage-tag right">Simulation</span>
        </>
      )}
      {calibrating && step === "design" && <span className="stage-tag">Calibrating · teeth hidden</span>}
      {props.fitTaps && step === "design" && !calibrating && !showOriginal && (
        <>
          <span className="stage-tag fit-tag">
            {props.fitTaps.length === 0
              ? "Tap the tip of the patient's right canine"
              : props.fitTaps.length === 1
                ? "Now tap the tip of the left canine"
                : "Drag a pin to adjust the fit"}
          </span>
          <span className={props.fitTaps.length === 0 ? "side-tag left on" : "side-tag left"}>Patient's right</span>
          <span className={props.fitTaps.length === 1 ? "side-tag right on" : "side-tag right"}>Patient's left</span>
        </>
      )}
      {step === "plan" && !showOriginal && (
        <span className="stage-tag">{props.pickRole ? `Tap a tooth · ${props.pickRole === "reference" ? "reference" : "to match"}` : "Photo · teeth as they are"}</span>
      )}
      {props.children}
      <button className="fab fit" onClick={fit} aria-label="Fit whole photo to screen" title="Fit photo">
        <Icon name="fit" size={20} />
      </button>
    </div>
  );
}

function stripCalib(l: Live): Partial<Scene> {
  const { calib: _c, samples: _s, fit: _f, ...rest } = l;
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

function handlePos(s: Scene, calib: Calib | undefined, id: string, pins?: Pt[], fit?: Pt[] | null): Pt | null {
  if (id.startsWith("fit")) return fit?.[Number(id.slice(3))] ?? null;
  if (id.startsWith("smp")) return pins?.[Number(id.slice(3))] ?? null;
  if (id === "calA") return calib?.a ?? null;
  if (id === "calB") return calib?.b ?? null;
  if (id === "pupilR" || id === "pupilL" || id === "midline") return s.guides[id];
  if (id.startsWith("lip")) return s.lips[Number(id.slice(3))] ?? null;
  if (id.startsWith("opp")) return s.design.opposing?.[Number(id.slice(3))] ?? null;
  const h = uiHandles(s.design, designAngle(s.design, s.guides));
  return (h as Record<string, Pt>)[id] ?? null;
}

function dot(ctx: CanvasRenderingContext2D, p: Pt, r: number, active: boolean, color: string) {
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.4)";
  ctx.shadowBlur = r * 0.6;
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.fillStyle = active ? color : "rgba(28,34,32,0.45)";
  ctx.fill();
  ctx.restore();
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.lineWidth = r * 0.24;
  ctx.strokeStyle = color;
  ctx.stroke();
}

/** Teeth-step overlay: pupil line, facial midline, incisal plane and the four design handles (upper or lower arch). */
function drawDesignOverlay(ctx: CanvasRenderingContext2D, s: Scene, scale: number, activeId: string | null) {
  const u = 1 / scale;
  const r = 11 * u;
  const len = Math.max(s.imgW, s.imgH) * 2;
  const g = s.guides;
  const pa = pupilAngle(g);
  const line = (p: Pt, a: number) => {
    ctx.beginPath();
    ctx.moveTo(p.x - Math.cos(a) * len, p.y - Math.sin(a) * len);
    ctx.lineTo(p.x + Math.cos(a) * len, p.y + Math.sin(a) * len);
    ctx.stroke();
  };
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineWidth = 1.5 * u;
  ctx.setLineDash([8 * u, 6 * u]);
  ctx.strokeStyle = "rgba(201,171,134,0.9)";
  line(g.pupilR, pa);
  ctx.strokeStyle = "rgba(196,202,202,0.9)";
  line(g.midline, pa + Math.PI / 2);
  ctx.strokeStyle = "rgba(201,171,134,0.55)";
  line(s.design.center, pa);
  ctx.setLineDash([]);
  const opp = s.design.opposing;
  if (opp && opp.length >= 2) {
    // the opposing teeth's edge: the design is never painted beyond this line
    const sorted = [...opp].sort((a, b) => a.x - b.x);
    ctx.beginPath();
    sorted.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
    ctx.setLineDash([5 * u, 4 * u]);
    ctx.lineWidth = 2 * u;
    ctx.strokeStyle = "rgba(120,190,255,0.95)";
    ctx.stroke();
    ctx.setLineDash([]);
    opp.forEach((q, i) => dot(ctx, q, r * 0.85, activeId === `opp${i}`, "rgb(120,190,255)"));
  }
  const h = uiHandles(s.design, designAngle(s.design, g));
  dot(ctx, h.widthL, r, activeId === "widthL", C.bronzeLight);
  dot(ctx, h.widthR, r, activeId === "widthR", C.bronzeLight);
  dot(ctx, h.length, r, activeId === "length", C.mist);
  dot(ctx, h.move, r * 1.15, activeId === "move", C.white);
  ctx.lineWidth = 2 * u;
  ctx.strokeStyle = C.white;
  ctx.beginPath();
  ctx.moveTo(h.move.x - r * 0.55, h.move.y);
  ctx.lineTo(h.move.x + r * 0.55, h.move.y);
  ctx.moveTo(h.move.x, h.move.y - r * 0.55);
  ctx.lineTo(h.move.x, h.move.y + r * 0.55);
  ctx.stroke();
  ctx.restore();
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

/** Plan step: shade sample pins. The ring is the sampled disk; the head sits above the point so the finger does not hide it. */
const AMBER = "#E8B04A";
function drawPins(ctx: CanvasRenderingContext2D, pts: Pt[], meta: SamplePin[], r0: number, scale: number, activeId: string | null, dragging = false) {
  const u = 1 / scale;
  ctx.save();
  let nR = 0;
  let nM = 0;
  pts.forEach((q, i) => {
    const role = meta[i]?.role ?? "match";
    const n = role === "reference" ? ++nR : ++nM;
    const on = activeId === `smp${i}`;
    // the quality verdict belongs to the last sampled position: hide it while this pin is being dragged
    const warn = meta[i]?.ok === false && !(dragging && on);
    const col = warn ? AMBER : role === "reference" ? C.bronzeLight : C.white;
    // the ring IS the sampled disk (real radius, image px), drawn on a dark under-stroke so it reads on enamel
    const r = Math.max(meta[i]?.r ?? r0, 1.5 * u);
    ctx.beginPath();
    ctx.arc(q.x, q.y, r, 0, Math.PI * 2);
    ctx.lineWidth = 2.5 * u;
    ctx.strokeStyle = C.slateDeep;
    ctx.stroke();
    ctx.lineWidth = 1.25 * u;
    ctx.strokeStyle = col;
    if (warn) ctx.setLineDash([3 * u, 2 * u]);
    ctx.stroke();
    ctx.setLineDash([]);
    const hy = q.y - r - 30 * u;
    ctx.beginPath();
    ctx.moveTo(q.x, q.y - r);
    ctx.lineTo(q.x, hy + 13 * u);
    ctx.lineWidth = 1.5 * u;
    ctx.strokeStyle = col;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(q.x, hy, 13 * u, 0, Math.PI * 2);
    ctx.fillStyle = on ? col : "rgba(28,34,32,0.85)";
    ctx.fill();
    ctx.lineWidth = 2.5 * u;
    ctx.strokeStyle = col;
    ctx.stroke();
    ctx.fillStyle = on ? C.slateDeep : col;
    ctx.font = `600 ${12 * u}px -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${role === "reference" ? "R" : "M"}${n}`, q.x, hy + 0.5 * u);
    if (warn) {
      // amber "!" badge on the pin head
      const bx = q.x + 11 * u;
      const by = hy - 10 * u;
      ctx.beginPath();
      ctx.arc(bx, by, 7 * u, 0, Math.PI * 2);
      ctx.fillStyle = AMBER;
      ctx.fill();
      ctx.lineWidth = 1.5 * u;
      ctx.strokeStyle = C.slateDeep;
      ctx.stroke();
      ctx.fillStyle = C.slateDeep;
      ctx.font = `700 ${10 * u}px -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif`;
      ctx.fillText("!", bx, by + 0.5 * u);
    }
  });
  ctx.restore();
}

/** Fit to teeth: the two canine-tip pins (head above the point, crosshair at the tip), labelled by the patient's side. */
function drawFitPins(ctx: CanvasRenderingContext2D, pts: Pt[], scale: number, activeId: string | null) {
  const u = 1 / scale;
  ctx.save();
  if (pts.length === 2) {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    ctx.lineTo(pts[1].x, pts[1].y);
    ctx.setLineDash([6 * u, 5 * u]);
    ctx.lineWidth = 1.25 * u;
    ctx.strokeStyle = "rgba(201,171,134,0.9)";
    ctx.stroke();
    ctx.setLineDash([]);
  }
  pts.forEach((q, i) => {
    const on = activeId === `fit${i}`;
    // crosshair with a gap at the exact tip
    ctx.lineCap = "round";
    for (const [w, c] of [
      [3 * u, "rgba(20,24,22,0.7)"],
      [1.5 * u, C.white],
    ] as const) {
      ctx.beginPath();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1]]) {
        ctx.moveTo(q.x + dx * 3 * u, q.y + dy * 3 * u);
        ctx.lineTo(q.x + dx * 10 * u, q.y + dy * 10 * u);
      }
      ctx.moveTo(q.x, q.y - 3 * u);
      ctx.lineTo(q.x, q.y - 23 * u);
      ctx.lineWidth = w;
      ctx.strokeStyle = c;
      ctx.stroke();
    }
    const hy = q.y - 36 * u;
    ctx.beginPath();
    ctx.arc(q.x, hy, 13 * u, 0, Math.PI * 2);
    ctx.fillStyle = on ? C.bronzeLight : "rgba(28,34,32,0.85)";
    ctx.fill();
    ctx.lineWidth = 2.5 * u;
    ctx.strokeStyle = C.bronzeLight;
    ctx.stroke();
    ctx.fillStyle = on ? C.slateDeep : C.bronzeLight;
    ctx.font = `600 ${11 * u}px -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    // patient's right canine is the one on the image left
    const right = pts.length < 2 ? i === 0 : q.x <= pts[1 - i].x;
    ctx.fillText(right ? "R3" : "L3", q.x, hy + 0.5 * u);
  });
  ctx.restore();
}

/** Labs: proposed dots as hollow dashed rings (and the proposed lip line), visibly different from the real handles. */
function drawGhost(ctx: CanvasRenderingContext2D, g: { guides?: Guides; lips?: Pt[] }, scale: number) {
  const u = 1 / scale;
  ctx.save();
  ctx.lineCap = "round";
  const ring = (p: Pt, r: number) => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(28,34,32,0.35)";
    ctx.fill();
    ctx.setLineDash([3 * u, 2.5 * u]);
    ctx.lineWidth = 2 * u;
    ctx.strokeStyle = "#F2D9A8";
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 1.8 * u, 0, Math.PI * 2);
    ctx.fillStyle = "#F2D9A8";
    ctx.fill();
  };
  if (g.lips && g.lips.length >= 3) {
    const curve = smoothClosed(g.lips);
    ctx.beginPath();
    curve.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
    ctx.closePath();
    ctx.setLineDash([6 * u, 4 * u]);
    ctx.lineWidth = 2 * u;
    ctx.strokeStyle = "rgba(242,217,168,0.95)";
    ctx.stroke();
    ctx.setLineDash([]);
    g.lips.forEach((p) => ring(p, 8 * u));
  }
  if (g.guides) {
    const { pupilR, pupilL, midline } = g.guides;
    ctx.setLineDash([4 * u, 4 * u]);
    ctx.lineWidth = 1.5 * u;
    ctx.strokeStyle = "rgba(242,217,168,0.8)";
    ctx.beginPath();
    ctx.moveTo(pupilR.x, pupilR.y);
    ctx.lineTo(pupilL.x, pupilL.y);
    ctx.stroke();
    ctx.setLineDash([]);
    [pupilR, pupilL, midline].forEach((p) => ring(p, 11 * u));
  }
  ctx.restore();
}
