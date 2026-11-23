import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { archOf, withArch } from "./arch";
import { autoOpposing, computePrep, detectTeeth, maskFromToothMask, toothMaskFromMask, type Mask } from "./engineShim";
import { centralLength, centralWidth, defaultOpposing, deg, fitArcToLowerLip, measure, pupilAngle, PROPORTIONS, rad, SHAPE_LABELS, TOOTH_NAMES } from "./geometry";
import { useHistory } from "./history";
import { defaultLips, initialLayout, type Arch, type CaseData, type CasePlan, type Design, type Guides, type Proportion, type Pt, type RenderMode, type ShadeSample, type ToothCount, type ToothShape } from "./model";
import { LABS_FAIL, LABS_FAIL_TEETH, labsOn, withAssist } from "./labs";
import { MaterialsSheet, PlanPanel, type PickRole, type PlanTab } from "./PlanPanel";
import { fitToTeeth } from "./fit";
import { defaultPlan, loadClinicMaterials, materialLibrary, sampleLabQ, sampleRadius, saveClinicMaterials, type Lab, type Material } from "./planner";
import { PrepDisclaimer, PrepLegend, PrepPanel } from "./PrepPanel";
import { exportCanvas, type Step } from "./render";
import { SHADES } from "./shades";
import { caseCodeProblem, rootLabel } from "./sheetCopy";
import { canvasToFile, clinicianSheet, labSheet, patientSheet, type SheetScene, type SheetView } from "./sheets";
import { Stage, WL_RANGE, type Calib, type MaskTool } from "./Stage";
import { listCases, saveCase, thumbnail } from "./storage";
import { Chips, Group, Hint, Icon, Sheet, Slider, tick, Toggle, useToast } from "./ui";

const STEPS: { id: Step; label: string; n: string; goal: string; icon: string }[] = [
  { id: "guides", label: "Face", n: "01", icon: "face", goal: "Set the face level: both pupils and the facial midline." },
  { id: "lips", label: "Lips", n: "02", icon: "lips", goal: "Trace the inside of the lips so the new teeth sit behind them." },
  { id: "design", label: "Teeth", n: "03", icon: "tooth", goal: "Choose a shape and size that suits this face." },
  { id: "shade", label: "Shade", n: "04", icon: "drop", goal: "Pick a shade to discuss. The screen colour is a preview only." },
  { id: "compare", label: "Compare", n: "05", icon: "compare", goal: "Show the patient now and the simulation, then share if they agree." },
  { id: "plan", label: "Plan", n: "06", icon: "plan", goal: "Record your plan, check it, then hand it to the lab." },
];
const LAST = STEPS.length - 1;

/** three.js is only loaded when the 3D wax-up screen opens */
const WaxupView = lazy(() => import("./WaxupView"));

const COACH_KEY = "smile-studio.coach.v1";

type Snap = Pick<CaseData, "guides" | "lips" | "design" | "calib" | "centralMm" | "toothMask" | "plan">;
type SheetKind = "clinician" | "patient" | "lab";

/** Central width/length descriptor for the slider. */
export function wlLabel(v: number, arch: Arch = "upper") {
  const pct = `${Math.round(v * 100)}%`;
  if (arch === "lower") return v >= 0.58 && v <= 0.66 ? `${pct} · typical lower central` : pct;
  if (v < 0.72) return `${pct} · long / narrow`;
  if (v >= 0.75 && v <= 0.8) return `${pct} · ideal range`;
  if (v > 0.85) return `${pct} · short / square (worn look)`;
  return pct;
}

type Level = "ok" | "amber" | "red";

export function Editor({ initial, onClose }: { initial: CaseData; onClose: () => void }) {
  const [c, setC] = useState(initial);
  const [img, setImg] = useState<ImageBitmap | null>(null);
  const [imgError, setImgError] = useState(false);
  const [step, setStep] = useState<Step>("guides");
  const [reached, setReached] = useState(initial.updatedAt - initial.createdAt > 2000 ? LAST : 0);
  const [mode, setMode] = useState<"mockup" | "outline">("mockup");
  const [showOriginal, setShowOriginal] = useState(false);
  const [calibrating, setCalibrating] = useState(false);
  const [compareView, setCompareView] = useState<"mouth" | "face">("mouth");
  const [present, setPresent] = useState(false);
  const [save, setSave] = useState<"saved" | "saving" | "error">("saved");
  const [coach, setCoach] = useState(() => !localStorage.getItem(COACH_KEY));
  const [shareAsk, setShareAsk] = useState<null | { what: string; run: () => void }>(null);
  const [busy, setBusy] = useState(false);
  // round 3: existing-teeth mask tool, prep map, sheets
  const [lipTool, setLipTool] = useState<"lips" | "teeth">("lips");
  const [brushMode, setBrushMode] = useState<MaskTool["mode"]>("paint");
  const [brushSize, setBrushSize] = useState(16);
  const [prepOn, setPrepOn] = useState(false);
  const [mask, setMask] = useState<Mask | null>(null);
  const encoded = useRef<string | undefined>(undefined);
  const [sheetDlg, setSheetDlg] = useState<SheetKind | null>(null);
  const [printCode, setPrintCode] = useState(false);
  const [showDiff, setShowDiff] = useState(true);
  const [siblings, setSiblings] = useState<CaseData[]>([]);
  const [extra, setExtra] = useState<string[]>([]);
  const [printPages, setPrintPages] = useState<string[] | null>(null);
  // round 4: case planner
  const [planTab, setPlanTab] = useState<PlanTab>("teeth");
  const [pickRole, setPickRole] = useState<PickRole>(null);
  const [clinicMats, setClinicMats] = useState<Material[]>(() => loadClinicMaterials());
  const [matsOpen, setMatsOpen] = useState(false);
  const [waxOpen, setWaxOpen] = useState(false);
  const pixels = useRef<{ img: ImageBitmap; data: Uint8ClampedArray } | null>(null);
  // round 6: fit to teeth (two canine taps, then the mask refines length and midline)
  const [fitTaps, setFitTaps] = useState<Pt[] | null>(null);
  const [fitNote, setFitNote] = useState("");
  const [fitHint, setFitHint] = useState(false);
  const toast = useToast();
  const showToast = toast.show;
  // ---------- Labs: Auto-detect (beta), only with the Settings flag on (read once when the editor opens) ----------
  const [labs] = useState(labsOn);
  const [aiBusy, setAiBusy] = useState(false);
  const [ghost, setGhost] = useState<null | { kind: "guides" | "lips"; guides?: Guides; lips?: Pt[]; note: string }>(null);
  const [tapMode, setTapMode] = useState<null | "add" | "erase">(null);
  const [toothProp, setToothProp] = useState<null | { merged: Mask; region: Mask; note: string; taps: Pt[] | "front"; mode: "add" | "erase" }>(null);
  const aiReq = useRef(0);
  const saveTimer = useRef(0);
  const latest = useRef(c);
  latest.current = c;
  const dirty = useRef(false);
  const flushNext = useRef(false);
  const panelRef = useRef<HTMLElement>(null);
  /** Phone portrait: the controls sheet's detent (null = the step's natural height). */
  const [detent, setDetent] = useState<null | "small" | "large">(null);
  const grab = useRef<{ y: number; moved: boolean } | null>(null);
  // each step / mode starts at the top of its panel (goal line first), at its natural height
  useEffect(() => {
    panelRef.current?.scrollTo?.({ top: 0 });
  }, [step, calibrating]);
  useEffect(() => setDetent(null), [step]);

  useEffect(() => {
    let alive = true;
    createImageBitmap(c.photo)
      .then((b) => {
        if (!alive) return;
        setImg(b);
        // thumbnail as soon as the photo is decoded, so Home has it even if the app is closed mid-design
        if (!latest.current.thumb) setC((x) => ({ ...x, thumb: thumbnail(b, x.imgW, x.imgH) }));
      })
      .catch(() => alive && setImgError(true));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c.id]);

  // autosave (debounced), on this device only
  const saveNow = useCallback(() => {
    window.clearTimeout(saveTimer.current);
    if (!dirty.current) return Promise.resolve();
    dirty.current = false;
    setSave("saving");
    return saveCase({ ...latest.current, updatedAt: Date.now() })
      .then(() => setSave("saved"))
      .catch(() => {
        dirty.current = true;
        setSave("error");
        showToast("Could not save on this phone. Storage may be full.", "error", 6000);
      });
  }, [showToast]);

  useEffect(() => {
    if (c === initial) return;
    dirty.current = true;
    setSave("saving");
    window.clearTimeout(saveTimer.current);
    // a finished drag saves straight away (the phone may be locked right after); control changes are debounced
    saveTimer.current = window.setTimeout(saveNow, flushNext.current ? 0 : 500);
    flushNext.current = false;
  }, [c, initial, saveNow]);

  // the page can be hidden or closed inside the debounce: save straight away
  useEffect(() => {
    const flush = () => void saveNow();
    const vis = () => document.visibilityState === "hidden" && flush();
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", vis);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", vis);
    };
  }, [saveNow]);

  const snap: Snap = useMemo(
    () => ({ guides: c.guides, lips: c.lips, design: c.design, calib: c.calib, centralMm: c.centralMm, toothMask: c.toothMask, plan: c.plan }),
    [c.guides, c.lips, c.design, c.calib, c.centralMm, c.toothMask, c.plan],
  );
  const history = useHistory<Snap>(snap, (s) => setC((x) => ({ ...x, ...s })));

  // keyboard shortcuts: Ctrl/Cmd+Z undo, Shift+Ctrl/Cmd+Z or Ctrl+Y redo
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || /^(INPUT|TEXTAREA)$/.test((e.target as HTMLElement).tagName)) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) history.undo();
      else if ((k === "z" && e.shiftKey) || k === "y") history.redo();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [history]);

  // existing-teeth mask: the saved (clinician-checked) one, else detected from the photo inside the lip line
  const needMask = (step === "lips" && lipTool === "teeth") || prepOn || c.design.render !== "drawn" || !!fitTaps || step === "plan";
  const autoKey = c.toothMask ? "" : JSON.stringify(c.lips);
  useEffect(() => {
    if (!img) return;
    const tm = c.toothMask;
    if (tm) {
      if (tm.png === encoded.current) return;
      let alive = true;
      maskFromToothMask(tm)
        .then((mm) => {
          if (!alive) return;
          encoded.current = tm.png;
          setMask(mm);
        })
        .catch(() => setMask(null));
      return () => {
        alive = false;
      };
    }
    encoded.current = undefined;
    if (!needMask) return;
    const t = window.setTimeout(() => setMask(detectTeeth(img, c.imgW, c.imgH, latest.current.lips)), mask ? 250 : 0);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [img, c.toothMask, autoKey, needMask]);

  const scene: SheetScene | null = useMemo(
    () => (img ? { img, imgW: c.imgW, imgH: c.imgH, guides: c.guides, lips: c.lips, design: c.design, existing: mask ?? undefined } : null),
    [img, c.imgW, c.imgH, c.guides, c.lips, c.design, mask],
  );
  const setDesign = (d: Partial<Design>) => setC((x) => ({ ...x, design: { ...x.design, ...d } }));
  const m = measure(c.design, c.guides, c.centralMm, c.calib);
  const ppm = m.pxPerMm;
  const arch = archOf(c.design);
  const lower = arch === "lower";
  const prep = useMemo(() => (prepOn && scene && mask ? computePrep(scene, mask, ppm) : null), [prepOn, scene, mask, ppm]);

  // ---------- plan ----------
  /** The recorded plan, or the suggestion (design arch's front six) until the dentist changes something. */
  const plan: CasePlan = useMemo(() => c.plan ?? defaultPlan(arch), [c.plan, arch]);
  const lib = useMemo(() => materialLibrary(clinicMats), [clinicMats]);
  const setPlan = (fn: (p: CasePlan) => CasePlan) => setC((x) => ({ ...x, plan: fn(x.plan ?? defaultPlan(archOf(x.design))) }));
  // shade pin disk: a share of the planned central width (narrow lower teeth get a smaller disk); small / medium
  const sampleSize = plan.shade.sampleSize ?? (lower ? "small" : "medium");
  const sampleR = sampleRadius(centralWidth(c.design), sampleSize, Math.min(c.imgW, c.imgH));
  /**
   * Median Lab under a pin, from the full-resolution photo (decoded once), with its quality (gum / shadow / shine
   * rejected; only tooth pixels of the existing-teeth mask when there is one). L* = 0 marks "only shine or shadow here".
   */
  const sampleAt = (pt: Pt, r = sampleR): Pick<ShadeSample, "lab" | "r" | "q"> => {
    if (!img) return { lab: [0, 0, 0] };
    if (pixels.current?.img !== img) {
      const cv = document.createElement("canvas");
      cv.width = c.imgW;
      cv.height = c.imgH;
      const ctx = cv.getContext("2d", { willReadFrequently: true })!;
      ctx.drawImage(img, 0, 0, c.imgW, c.imgH);
      pixels.current = { img, data: ctx.getImageData(0, 0, c.imgW, c.imgH).data };
      cv.width = 0;
    }
    const { lab, q } = sampleLabQ(pixels.current.data, c.imgW, c.imgH, pt.x, pt.y, r, mask);
    const r2 = (v: number) => Math.round(v * 100) / 100;
    return {
      lab: lab ? (lab.map(r2) as Lab) : [0, 0, 0],
      r: r2(r),
      q: { rej: r2(q.rejected), sdL: r2(q.sdL), sdB: r2(q.sdB), ok: q.reliable },
    };
  };
  const setSampleSize = (size: "small" | "medium") => {
    const r = sampleRadius(centralWidth(c.design), size, Math.min(c.imgW, c.imgH));
    setPlan((x) => ({ ...x, shade: { ...x.shade, sampleSize: size, samples: x.shade.samples.map((s) => ({ ...s, ...sampleAt(s.pt, r) })) } }));
  };

  // ---------- fit to teeth ----------
  const startFit = () => {
    setCalibrating(false);
    setFitHint(false);
    setFitNote("");
    setFitTaps([]);
  };
  const endFit = () => setFitTaps(null);
  const onFitTaps = (pts: Pt[]) => {
    setFitTaps(pts);
    if (pts.length < 2) return;
    const x = latest.current;
    const r = fitToTeeth(x.design, x.guides, pts[0], pts[1], mask, x.imgW, x.lips);
    setFitNote(r.note);
    if (r.design !== x.design) setC((y) => ({ ...y, design: r.design }));
  };
  const updateMats = (list: Material[]) => {
    setClinicMats(list);
    try {
      saveClinicMaterials(list);
    } catch {
      toast.show("Could not save the materials on this phone.", "error");
    }
  };

  // Labs: a pending tooth proposal was computed from the mask as it was; any other change to the mask drops it
  useEffect(() => {
    if (labs) setToothProp(null);
  }, [labs, c.toothMask]);
  const onMaskEdited = () => {
    if (!mask) return;
    const tm = toothMaskFromMask(mask);
    encoded.current = tm.png;
    setMask({ ...mask }); // same pixels, new identity: the renderer and the prep map see the edit
    setC((x) => ({ ...x, toothMask: tm }));
  };
  const autoDetect = () => {
    if (!img) return;
    const mm = detectTeeth(img, c.imgW, c.imgH, c.lips);
    const tm = toothMaskFromMask(mm);
    encoded.current = tm.png;
    setMask(mm);
    setC((x) => ({ ...x, toothMask: tm }));
    toast.show("Teeth found inside the lip line. Check the blue area and correct it with the brush.");
  };

  // ---------- Labs actions: every result is a proposal; nothing changes until "Use these points" / "Use this outline" ----------
  const aiFace = (kind: "guides" | "lips") => {
    if (!img || aiBusy) return;
    const id = ++aiReq.current;
    const x = latest.current;
    const close = x.framing === "closeup";
    setAiBusy(true);
    setGhost(null);
    toast.show(kind === "guides" ? "Finding the face points on this phone…" : "Finding the lip line on this phone…", "info", 0);
    withAssist((a) => a.proposeFace(img, x.imgW, x.imgH, x.framing ?? "face"))
      .then((r) => {
        if (id !== aiReq.current) return;
        if (!r || (kind === "guides" && !r.guides) || (kind === "lips" && !r.lips)) {
          toast.show(close ? "No face found in this close-up. Place the dots by hand." : "No face found in this photo. Place the dots by hand.", "note", 4000);
          return;
        }
        toast.hide();
        if (kind === "guides")
          setGhost({
            kind,
            guides: r.guides!.guides,
            note: `Suggested from the ${r.guides!.basis}${close ? " and the upper lip (midline estimate)" : ""}. Check every dot.`,
          });
        else
          setGhost({
            kind,
            lips: r.lips!,
            note: r.opening < Math.max(3, x.imgH * 0.004) ? "The lips look closed here, so this line may be wrong. Check every dot." : "Suggested inner lip line. Check every dot.",
          });
      })
      .catch(() => id === aiReq.current && toast.show(LABS_FAIL, "note", 4500))
      .finally(() => id === aiReq.current && setAiBusy(false));
  };
  const useGhost = () => {
    const g = ghost;
    if (!g) return;
    setGhost(null);
    flushNext.current = true;
    tick();
    setC((x) => (g.kind === "guides" && g.guides ? { ...x, guides: g.guides } : g.lips ? { ...x, lips: g.lips } : x));
    toast.show(g.kind === "guides" ? "Dots placed. Drag any dot to adjust." : "Lip line placed. Drag any dot to adjust.");
  };
  const aiTooth = (taps: Pt[] | "front", mode: "add" | "erase") => {
    if (!img || aiBusy) return;
    const id = ++aiReq.current;
    const x = latest.current;
    const base = mask;
    setAiBusy(true);
    toast.show(taps === "front" ? "Outlining the front teeth on this phone…" : "Outlining the tooth on this phone…", "info", 0);
    withAssist((a) =>
      taps === "front"
        ? a.proposeFrontTeeth(img, x.imgW, x.imgH, x.lips, base, x.design, x.guides)
        : a.proposeTooth(img, x.imgW, x.imgH, x.lips, base, taps, mode, centralWidth(x.design)),
    )
      .then((r) => {
        if (id !== aiReq.current) return;
        if (!r.changed) {
          setToothProp(null);
          toast.show(mode === "erase" ? "Nothing to erase there. Tap inside the blue area." : "No new tooth area found there. Tap the middle of a tooth, or use the brush.", "note", 3500);
          return;
        }
        toast.hide();
        setToothProp({
          merged: r.merged,
          region: r.region,
          taps,
          mode,
          note:
            (mode === "erase" ? "Orange area will be removed from the teeth outline." : "Orange area will be added to the teeth outline.") +
            (r.large ? " It looks larger than one tooth: check it, or try again." : " Check it before you use it."),
        });
      })
      .catch(() => {
        if (id !== aiReq.current) return;
        setToothProp(null);
        setTapMode(null);
        toast.show(LABS_FAIL_TEETH, "note", 4500);
      })
      .finally(() => id === aiReq.current && setAiBusy(false));
  };
  const useTooth = () => {
    const p = toothProp;
    if (!p) return;
    setToothProp(null);
    tick();
    const tm = toothMaskFromMask(p.merged);
    encoded.current = tm.png;
    setMask(p.merged);
    flushNext.current = true;
    setC((x) => ({ ...x, toothMask: tm }));
  };
  const cancelAi = () => {
    aiReq.current++;
    setAiBusy(false);
    setGhost(null);
    setToothProp(null);
    toast.hide();
  };
  const aiConfirm = (note: string, useLabel: string, onUse: () => void, onRetry: () => void, onCancel: () => void) => (
    <AiConfirm note={note} useLabel={useLabel} onUse={onUse} onRetry={onRetry} onCancel={onCancel} />
  );
  const aiButton = (label: string, onClick: () => void) => (
    <button className="btn secondary ai-btn" onClick={onClick} disabled={!img || aiBusy}>
      <Icon name="sparkle" size={18} /> {label} <span className="beta-tag">Beta</span>
    </button>
  );
  const fmt = (px: number) => (ppm ? `${(px / ppm).toFixed(1)} mm` : `${Math.round(px)} px`);
  const pupilTilt = deg(pupilAngle(c.guides));
  const closeup = c.framing === "closeup";
  const ref = closeup ? "mouth corners" : "pupils";
  const tiltWarn = closeup ? "Check the photo is level; mouth corners may be uneven." : "Check head tilt; pupils may be uneven.";
  const stepLabel = (s: (typeof STEPS)[number]) => (s.id === "guides" && closeup ? "Level" : s.label);
  const stepGoal = (s: (typeof STEPS)[number]) =>
    s.id === "guides" && closeup ? "Set the level: both mouth corners and the dental midline." : s.goal;
  /**
   * Switching photo type: before the lips/teeth steps have been opened, everything is re-laid out for that type;
   * afterwards only the reference dots move, so finished work is kept.
   */
  const setFraming = (framing: "face" | "closeup") =>
    setC((x) => {
      const fresh = initialLayout(x.imgW, x.imgH, framing);
      return reached === 0 ? { ...x, framing, ...fresh } : { ...x, framing, guides: fresh.guides };
    });

  const goTo = (s: Step) => {
    const i = STEPS.findIndex((x) => x.id === s);
    setReached((r) => Math.max(r, i));
    if (s !== "design") setCalibrating(false);
    if (s !== "plan") setPickRole(null);
    if (s !== "design") {
      setFitTaps(null);
      setFitHint(false);
    }
    if (labs) {
      aiReq.current++;
      setAiBusy(false);
      setGhost(null);
      setToothProp(null);
      setTapMode(null);
    }
    setStep(s);
  };
  const idx = STEPS.findIndex((s) => s.id === step);

  /** Share sheet on phones, downloads elsewhere. Returns false when the user cancelled. */
  const deliver = async (files: File[], title: string) => {
    let shared = false;
    if (navigator.canShare?.({ files })) {
      try {
        await navigator.share({ files, title });
        shared = true;
      } catch (e) {
        if ((e as Error).name === "AbortError") {
          toast.hide();
          return;
        }
      }
    }
    if (!shared) {
      for (const f of files) {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(f);
        a.download = f.name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      }
    }
    toast.show(shared ? "Shared" : files.length > 1 ? `${files.length} pages saved to downloads` : "Image saved to downloads");
  };

  const doExport = async (layout: "after" | "side-by-side") => {
    if (!scene) return;
    setBusy(true);
    toast.show("Preparing image…", "info", 0);
    try {
      await document.fonts.load('700 20px "Oswald"');
      await document.fonts.load('500 20px "JetBrains Mono"');
      const cv = exportCanvas(scene, layout);
      const date = new Date().toISOString().slice(0, 10);
      const file = await canvasToFile(cv, `smile-simulation-${layout}-${date}.png`);
      await deliver([file], "Smile simulation");
    } catch {
      toast.show("Could not make the image. Try again, or close other apps to free memory.", "error", 6000);
    } finally {
      setBusy(false);
    }
  };
  /** Anything that leaves the app asks once per case whether the patient agreed. */
  const withConsent = (what: string, run: () => void) => (c.consentShareAt ? run() : setShareAsk({ what, run }));
  const askExport = (layout: "after" | "side-by-side") => withConsent("this image", () => void doExport(layout));

  // ---------- sheets ----------
  const openSheet = (kind: SheetKind) => {
    setSheetDlg(kind);
    if (kind === "patient")
      listCases()
        .then((all) => setSiblings(all.filter((x) => x.id !== c.id && rootLabel(x.label) === rootLabel(c.label))))
        .catch(() => setSiblings([]));
  };

  const buildSheet = async (kind: SheetKind): Promise<HTMLCanvasElement[]> => {
    if (!scene || !img) throw new Error("no photo");
    const em = mask ?? detectTeeth(img, c.imgW, c.imgH, c.lips);
    const base: SheetScene = { ...scene, existing: em };
    const view: SheetView = { scene: base, prep: computePrep(base, em, ppm), pxPerMm: ppm };
    const code = printCode && !caseCodeProblem(c.label) ? c.label : undefined;
    if (kind === "clinician") return clinicianSheet({ view, caseCode: code, date: new Date(), centralMm: c.centralMm, plan: c.plan, lib });
    if (kind === "lab") return labSheet({ view, plan, lib, caseCode: code, date: new Date() });
    const views = [view];
    for (const x of siblings.filter((o) => extra.includes(o.id))) {
      const bmp = await createImageBitmap(x.photo);
      const xm = x.toothMask ? await maskFromToothMask(x.toothMask) : detectTeeth(bmp, x.imgW, x.imgH, x.lips);
      const sc: SheetScene = { img: bmp, imgW: x.imgW, imgH: x.imgH, guides: x.guides, lips: x.lips, design: x.design, existing: xm };
      const px = measure(x.design, x.guides, x.centralMm, x.calib).pxPerMm;
      views.push({ scene: sc, prep: computePrep(sc, xm, px), pxPerMm: px, title: archOf(x.design) === "lower" ? "Lower teeth" : "Another view" });
    }
    return patientSheet({ views, showDiff });
  };

  const sheetName = (kind: SheetKind) => (kind === "clinician" ? "prep-guide" : kind === "lab" ? "lab-prescription" : "smile-design-sheet");
  const sheetTitle = (kind: SheetKind) => (kind === "clinician" ? "Preparation guide" : kind === "lab" ? "Lab prescription" : "Smile design sheet");

  const shareSheet = async (kind: SheetKind) => {
    setBusy(true);
    toast.show("Preparing sheet…", "info", 0);
    try {
      const pages = await buildSheet(kind);
      const date = new Date().toISOString().slice(0, 10);
      const files = await Promise.all(
        pages.map((cv, i) => canvasToFile(cv, `${sheetName(kind)}-${date}${pages.length > 1 ? `-p${i + 1}` : ""}.png`)),
      );
      pages.forEach((cv) => (cv.width = 0));
      await deliver(files, sheetTitle(kind));
    } catch {
      toast.show("Could not make the sheet. Try again, or close other apps to free memory.", "error", 6000);
    } finally {
      setBusy(false);
    }
  };

  const printSheet = async (kind: SheetKind) => {
    setBusy(true);
    toast.show("Preparing sheet…", "info", 0);
    try {
      const pages = await buildSheet(kind);
      const urls = await Promise.all(pages.map((cv) => canvasToFile(cv, "page.png").then((f) => URL.createObjectURL(f))));
      pages.forEach((cv) => (cv.width = 0));
      toast.hide();
      setPrintPages(urls);
    } catch {
      toast.show("Could not make the sheet. Try again, or close other apps to free memory.", "error", 6000);
    } finally {
      setBusy(false);
    }
  };

  // print: the pages go into a print-only container, the app is hidden by the print style sheet
  useEffect(() => {
    if (!printPages) return;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      printPages.forEach((u) => URL.revokeObjectURL(u));
      setPrintPages(null);
    };
    window.addEventListener("afterprint", finish);
    const imgs = [...document.querySelectorAll<HTMLImageElement>(".print-root img")];
    Promise.all(imgs.map((i) => i.decode().catch(() => {}))).then(() => {
      window.print();
      // a fallback for browsers that never fire afterprint (the pages stay hidden on screen meanwhile)
      window.setTimeout(finish, 60000);
    });
    return () => window.removeEventListener("afterprint", finish);
  }, [printPages]);

  const close = async () => {
    window.clearTimeout(saveTimer.current);
    try {
      await saveCase({ ...latest.current, updatedAt: dirty.current || c !== initial ? Date.now() : latest.current.updatedAt });
    } catch {
      /* the toast already said it; do not trap the user in the editor */
    }
    onClose();
  };

  const centerOnMidline = () => {
    // slide the design along the pupil line so its center sits on the facial midline
    const pa = pupilAngle(c.guides);
    setDesign({ center: { x: c.design.center.x - m.midlineDev * Math.cos(pa), y: c.design.center.y - m.midlineDev * Math.sin(pa) } });
  };

  const startCalibrate = () => {
    setFitTaps(null);
    setStep("design");
    setReached((r) => Math.max(r, 2));
    if (!c.calib) {
      const d = c.design;
      const cw = centralWidth(d);
      const y = d.center.y - centralLength(d) * 0.5;
      setC((x) => ({ ...x, calib: { a: { x: d.center.x - cw, y }, b: { x: d.center.x, y } } }));
    }
    setCalibrating(true);
  };

  // readout levels (Kokich 1999/2006 perception thresholds), only meaningful once calibrated
  const devMm = ppm ? Math.abs(m.midlineDev) / ppm : undefined;
  const midOn = devMm !== undefined ? devMm < 0.5 : Math.abs(m.midlineDev) < 2;
  const midLevel: Level = devMm === undefined ? "ok" : devMm >= 4 ? "red" : devMm >= 2 ? "amber" : "ok";
  const cantMm = ppm ? (c.design.width / ppm) * Math.abs(Math.tan(rad(m.cant))) : undefined;
  const cantLevel: Level = cantMm === undefined ? "ok" : cantMm >= 3 ? "red" : cantMm >= 1 ? "amber" : "ok";

  if (imgError) {
    return (
      <div className="editor">
        <div className="empty-error" role="alert">
          <span className="state-icon"><Icon name="alert" size={30} /></span>
          <h2>Photo could not be opened</h2>
          <p>This photo could not be opened on this phone. Delete the design and take the photo again.</p>
          <button className="btn" onClick={onClose}>Back to designs</button>
        </div>
      </div>
    );
  }

  const readout = (step === "design" || step === "shade") && !calibrating && (
    <div className="readout" aria-live="polite">
      <span>W/L {m.wlPct}%</span>
      <span>
        Central {fmt(m.centralW)} × {fmt(m.centralL)}
      </span>
      <span className={cantLevel}>
        Cant {m.cant.toFixed(1)}°{cantMm !== undefined && ` · ${cantMm.toFixed(1)} mm`}
      </span>
      <span className={midLevel}>Midline {midOn ? "on" : fmt(Math.abs(m.midlineDev))}</span>
      {!ppm && (
        <button className="link" onClick={startCalibrate}>
          Calibrate for mm
        </button>
      )}
      {Math.abs(pupilTilt) > 3 && <span className="amber">{tiltWarn}</span>}
    </div>
  );

  return (
    <div className={present ? "editor present" : step === "plan" && planTab !== "shade" ? "editor plan-tall" : "editor"}>
      <header className="topbar">
        <button className="nav-back" onClick={close} aria-label="Back to cases">
          <Icon name="back" />
          <span>Cases</span>
        </button>
        <div className="hist">
          <button className="icon" onClick={history.undo} disabled={!history.canUndo} aria-label="Undo" title="Undo">
            <Icon name="undo" />
          </button>
          <button className="icon" onClick={history.redo} disabled={!history.canRedo} aria-label="Redo" title="Redo">
            <Icon name="redo" />
          </button>
        </div>
        <div className="title">
          <h1 className="h">{stepLabel(STEPS[idx])}</h1>
          <span className="sub">
            Step {idx + 1} of {STEPS.length} ·{" "}
            <span className={save === "error" ? "save err" : "save"}>
              {save === "saved" ? "Saved" : save === "saving" ? "Saving…" : "Not saved"}
            </span>
          </span>
        </div>
        <button className={showOriginal ? "pill pressed" : "pill"} aria-pressed={showOriginal} onClick={() => setShowOriginal((v) => !v)}>
          Before
        </button>
      </header>

      {scene ? (
        <Stage
          scene={scene}
          step={step}
          mode={mode}
          showOriginal={showOriginal}
          calibrating={calibrating}
          calib={c.calib}
          compareView={compareView}
          showPrep={prepOn}
          prep={prep}
          maskTool={step === "lips" && lipTool === "teeth" ? { mode: brushMode, size: brushSize } : null}
          mask={mask}
          onMaskEdited={onMaskEdited}
          samples={step === "plan" ? plan.shade.samples.map((x) => ({ pt: x.pt, role: x.role, r: x.r, ok: x.q ? x.q.ok : undefined })) : undefined}
          pickRole={step === "plan" && planTab === "shade" ? pickRole : null}
          sampleR={sampleR}
          onAddSample={(pt) => {
            const role = pickRole;
            if (!role) return;
            setPlan((x) => ({ ...x, shade: { ...x.shade, samples: [...x.shade.samples, { role, pt, ...sampleAt(pt) }] } }));
            setPickRole(null);
          }}
          onSamples={(pts) =>
            setPlan((x) => ({
              ...x,
              shade: {
                ...x.shade,
                samples: pts.map((pt, i) => ({ ...(x.shade.samples[i] ?? { role: "match" as const }), pt, ...sampleAt(pt, x.shade.samples[i]?.r ?? sampleR) })),
              },
            }))
          }
          onGuides={(guides) => setC((x) => ({ ...x, guides }))}
          onLips={(lips) => setC((x) => ({ ...x, lips }))}
          onDesign={(design) => setC((x) => ({ ...x, design }))}
          onCalib={(calib: Calib) => setC((x) => ({ ...x, calib }))}
          fitTaps={step === "design" && !calibrating ? fitTaps : null}
          onFitTaps={onFitTaps}
          ghost={labs && ghost && ghost.kind === (step === "guides" ? "guides" : step === "lips" && lipTool === "lips" ? "lips" : "") ? ghost : null}
          tapTool={labs && step === "lips" && lipTool === "teeth" ? tapMode : null}
          onTapTool={labs ? (pt) => tapMode && aiTooth([pt], tapMode) : undefined}
          proposal={labs && step === "lips" && lipTool === "teeth" ? (toothProp?.region ?? null) : null}
          onGesture={(active) => {
            history.gesture(active);
            if (!active) {
              flushNext.current = true;
              // the drag's last state is usually already in React state (debounced timer running): save it now
              window.setTimeout(() => void saveNow(), 0);
            }
          }}
        >
          {fitHint && step === "design" && !fitTaps && !calibrating && !showOriginal && (
            <div className="fit-chip-wrap">
              <button className="fit-chip" onClick={startFit}>
                <Icon name="target" size={16} /> Fit to teeth
              </button>
              <button className="fit-chip-x" onClick={() => setFitHint(false)} aria-label="Hide the fit to teeth hint">
                <Icon name="close" size={14} />
              </button>
            </div>
          )}
        </Stage>
      ) : (
        <div className="stage loading" role="status">
          <span className="spinner" aria-hidden="true" /> Opening photo…
        </div>
      )}

      {present && (
        <button className="pill exit-present" onClick={() => setPresent(false)}>
          <Icon name="close" size={18} /> Exit
        </button>
      )}

      <div className={detent ? `side d-${detent}` : "side"}>
        <button
          className="grabber"
          aria-label={detent === "large" ? "Show more photo" : "Show more controls"}
          onPointerDown={(e) => {
            grab.current = { y: e.clientY, moved: false };
            e.currentTarget.setPointerCapture?.(e.pointerId);
          }}
          onPointerMove={(e) => {
            const g = grab.current;
            if (!g || g.moved) return;
            const dy = e.clientY - g.y;
            if (Math.abs(dy) < 28) return;
            g.moved = true;
            tick();
            // up: more controls; down: more photo
            setDetent((d) => (dy < 0 ? (d === "small" ? null : "large") : d === "large" ? null : "small"));
          }}
          onPointerUp={() => {
            const g = grab.current;
            grab.current = null;
            if (g && !g.moved) setDetent((d) => (d === "large" ? null : "large"));
          }}
          onPointerCancel={() => (grab.current = null)}
        >
          <span className="grabber-bar" aria-hidden="true" />
        </button>
        {readout}
        <section
          className={step === "plan" && planTab !== "shade" ? "panel tall" : "panel"}
          ref={panelRef}
          aria-label={`${stepLabel(STEPS[idx])} controls`}
        >
          <p className="goal">
            {calibrating
              ? "Calibrate: measure one existing central so the read-out shows mm."
              : step === "design" && fitTaps
                ? "Fit to teeth: tap both canine tips on the photo."
              : step === "lips" && lipTool === "teeth"
                ? "Mark the patient's own teeth. Used for the prep map and the photo-real teeth."
                : stepGoal(STEPS[idx])}
          </p>

          {step === "guides" && (
            <>
              <Chips
                label="Photo type"
                value={closeup ? "closeup" : "face"}
                options={[
                  { value: "face", label: "Full face" },
                  { value: "closeup", label: "Smile close-up" },
                ]}
                onChange={setFraming}
              />
              {closeup ? (
                <Hint>
                  No eyes in the photo, so the <b>bronze dots</b> go on the two <b>mouth corners</b> and the <b>grey dot</b> on
                  the <b>dental midline</b> (between the upper centrals, or the philtrum if visible). Pupils are the better level
                  when you have a full-face photo. Pinch to zoom.
                </Hint>
              ) : (
                <Hint>
                  Drag the two <b>bronze dots</b> onto the pupils and the <b>grey dot</b> onto the middle of the face (philtrum /
                  nose tip). Pinch to zoom.
                </Hint>
              )}
              <p className={Math.abs(pupilTilt) > 3 ? "mono small amber" : "mono small"}>
                {closeup ? "Mouth-corner line" : "Pupil line"} {pupilTilt.toFixed(1)}° from level
                {Math.abs(pupilTilt) > 3 && ` · ${tiltWarn}`}
              </p>
              {labs &&
                (ghost?.kind === "guides"
                  ? aiConfirm(ghost.note, "Use these points", useGhost, () => aiFace("guides"), cancelAi)
                  : aiButton("Auto-detect points", () => aiFace("guides")))}
            </>
          )}

          {step === "lips" && (
            <>
              <Chips
                label="Tool"
                value={lipTool}
                options={[
                  { value: "lips", label: "Lip line" },
                  { value: "teeth", label: "Existing teeth" },
                ]}
                onChange={(v) => {
                  if (labs) {
                    cancelAi();
                    setTapMode(null);
                  }
                  setLipTool(v);
                }}
              />
              {lipTool === "lips" ? (
                <>
                  <Hint>
                    Drag the dots onto the <b>inside edge of the lips</b>. The teeth outline shows where the design sits.
                  </Hint>
                  <button className="btn secondary" onClick={() => setC((x) => ({ ...x, lips: defaultLips(x.design.center, x.design.width) }))}>
                    Reset lip line around the teeth
                  </button>
                  {labs &&
                    (ghost?.kind === "lips"
                      ? aiConfirm(ghost.note, "Use these points", useGhost, () => aiFace("lips"), cancelAi)
                      : aiButton("Auto-detect lip line", () => aiFace("lips")))}
                </>
              ) : (
                <>
                  <div className="row tight">
                    <button className="btn" onClick={autoDetect} disabled={!img}>
                      Auto-detect
                    </button>
                    <button
                      className="btn secondary"
                      onClick={() => {
                        setC((x) => ({ ...x, toothMask: undefined }));
                        toast.show("Back to the automatic outline");
                      }}
                      disabled={!c.toothMask}
                    >
                      Reset
                    </button>
                  </div>
                  {labs ? (
                    <Chips
                      label="Brush"
                      value={tapMode ? `tap-${tapMode}` : brushMode}
                      options={[
                        { value: "paint", label: "Paint" },
                        { value: "erase", label: "Erase" },
                        { value: "tap-add", label: "Tap a tooth" },
                        { value: "tap-erase", label: "Erase tooth" },
                      ]}
                      onChange={(v) => {
                        cancelAi();
                        if (v === "tap-add" || v === "tap-erase") setTapMode(v === "tap-add" ? "add" : "erase");
                        else {
                          setTapMode(null);
                          setBrushMode(v as MaskTool["mode"]);
                        }
                      }}
                    />
                  ) : (
                    <Chips
                      label="Brush"
                      value={brushMode}
                      options={[
                        { value: "paint", label: "Paint" },
                        { value: "erase", label: "Erase" },
                      ]}
                      onChange={setBrushMode}
                    />
                  )}
                  {labs &&
                    (toothProp
                      ? aiConfirm(
                          toothProp.note,
                          "Use this outline",
                          useTooth,
                          () => {
                            const p = toothProp;
                            setToothProp(null);
                            if (p.taps === "front") aiTooth("front", "add");
                            else toast.show("Tap the tooth again, a little nearer its middle.", "note", 2500);
                          },
                          cancelAi,
                        )
                      : tapMode
                        ? <p className="hint">{aiBusy ? "Outlining…" : tapMode === "erase" ? "Tap a tooth inside the blue area to remove its outline." : "Tap the middle of a tooth to outline it."}</p>
                        : aiButton("Outline all front teeth", () => aiTooth("front", "add")))}
                  <Slider label="Brush size" value={brushSize} min={6} max={40} step={2} format={(v) => (v < 12 ? "fine" : v < 24 ? "medium" : "large")} onChange={setBrushSize} />
                  <Hint>
                    The <b>blue tint</b> should cover the patient's own teeth only. One finger paints or erases; two fingers zoom
                    and move the photo.
                  </Hint>
                  <p className="mono small">{c.toothMask ? "Checked by you · saved with this design" : mask ? "Found automatically · not checked yet" : "Finding the teeth…"}</p>
                </>
              )}
            </>
          )}

          {step === "design" && calibrating && (
            <>
              <Hint>
                Drag the two pins onto the <b>left and right edges of one existing upper central</b> (the patient's own tooth).
                A tap moves the nearest pin there.
              </Hint>
              <label className="field">
                <span className="field-label">Existing central width, measured in the mouth (mm)</span>
                <MmInput value={c.centralMm} onChange={(centralMm) => setC((x) => ({ ...x, centralMm }))} />
              </label>
              <p className="mono small">{ppm ? `Calibrated · ${ppm.toFixed(1)} px per mm` : "Enter the width to switch the read-out to mm."}</p>
              <div className="row">
                <button className="btn" onClick={() => setCalibrating(false)}>
                  Done
                </button>
                <button
                  className="btn secondary"
                  onClick={() => {
                    setC((x) => ({ ...x, calib: undefined, centralMm: undefined }));
                    setCalibrating(false);
                  }}
                >
                  Clear
                </button>
              </div>
            </>
          )}

          {step === "design" && !calibrating && fitTaps && (
            <>
              <ol className="fit-steps">
                <li className={fitTaps.length >= 1 ? "done" : "on"}>
                  <span className="n" aria-hidden="true">{fitTaps.length >= 1 ? <Icon name="check" size={14} /> : "1"}</span>
                  <span>
                    Tap the tip of the patient's <b>right canine</b> <small>(on the left of the photo)</small>
                  </span>
                </li>
                <li className={fitTaps.length >= 2 ? "done" : fitTaps.length === 1 ? "on" : ""}>
                  <span className="n" aria-hidden="true">{fitTaps.length >= 2 ? <Icon name="check" size={14} /> : "2"}</span>
                  <span>
                    Then the <b>left canine</b> <small>(on the right of the photo)</small>
                  </span>
                </li>
              </ol>
              {fitTaps.length < 2 ? (
                <Hint>Zoom in with two fingers if needed. The loupe shows the point under your finger.</Hint>
              ) : (
                <p className="note" aria-live="polite">
                  {fitNote} Drag a pin to adjust; undo goes back.
                </p>
              )}
              <Group>
                <Toggle
                  label="Include premolars"
                  note={c.design.count > 6 ? `${c.design.count} teeth: canine to ${c.design.count === 8 ? "first" : "second"} premolar` : "6 teeth: canine to canine"}
                  checked={c.design.count > 6}
                  onChange={(v) => setDesign({ count: v ? (c.design.count === 8 ? 8 : 10) : 6 })}
                />
              </Group>
              <div className="row">
                <button className="btn" onClick={endFit}>
                  Done
                </button>
                <button className="btn secondary" onClick={startFit} disabled={!fitTaps.length}>
                  Tap again
                </button>
              </div>
            </>
          )}

          {step === "design" && !calibrating && !fitTaps && (
            <>
              <Chips
                label="Arch"
                value={arch}
                options={[
                  { value: "upper", label: "Upper" },
                  { value: "lower", label: "Lower" },
                ]}
                onChange={(a) => {
                  setC((x) => ({ ...x, design: withArch(x.design, x.guides, a) }));
                  setFitHint(a === "lower");
                }}
              />
              <button className="btn fit-btn" onClick={startFit}>
                <Icon name="target" size={20} /> Fit to teeth
              </button>
              <Chips
                label="Change"
                value={c.design.change ?? "shape"}
                options={[
                  { value: "shape", label: "Shape + shade" },
                  { value: "shade", label: "Shade only" },
                ]}
                onChange={(change: "shape" | "shade") => setDesign({ change })}
              />
              <Chips
                label="Teeth look"
                value={mode === "outline" ? "outline" : (c.design.render ?? "photo")}
                options={[
                  { value: "photo", label: "Photo-real" },
                  { value: "drawn", label: "Drawn" },
                  { value: "outline", label: "Outline" },
                ]}
                onChange={(look: RenderMode | "outline") => {
                  // one choice: Outline is a view of the template, Photo-real / Drawn are how the teeth are rendered
                  if (look === "outline") return setMode("outline");
                  setMode("mockup");
                  setDesign({ render: look });
                }}
              />
              {lower && (
                <Toggle
                  label="Upper teeth edge"
                  note="Drag the 5 blue dots onto the lower edge of the upper teeth; the lower design is never painted above it"
                  checked={!!c.design.opposing}
                  onChange={(on) => {
                    if (!on) return setDesign({ opposing: undefined });
                    // start on the edge the photo shows, when the engine can find one; else one overbite past the template
                    let pts: Pt[] | null = null;
                    try {
                      if (scene) pts = autoOpposing(scene);
                    } catch {
                      pts = null;
                    }
                    setDesign({ opposing: pts ?? defaultOpposing(c.design, c.guides) });
                  }}
                />
              )}
              <Toggle label="Prep map · what to change" note="Per tooth: amber = shade change (ΔE), green = add, red = reduce" checked={prepOn} onChange={setPrepOn} />
              {prepOn && (
                <PrepPanel
                  prep={prep}
                  pxPerMm={ppm}
                  onCalibrate={startCalibrate}
                  onMarkTeeth={() => {
                    setLipTool("teeth");
                    goTo("lips");
                  }}
                  manualMask={!!c.toothMask}
                />
              )}
              <Chips
                label="Shape"
                value={c.design.shape}
                options={(Object.keys(SHAPE_LABELS) as ToothShape[]).map((k) => ({ value: k, label: SHAPE_LABELS[k] }))}
                onChange={(shape) => setDesign({ shape })}
              />
              <Chips
                label="Proportion"
                value={c.design.proportion}
                options={(Object.keys(PROPORTIONS) as Proportion[]).map((k) => ({ value: k, label: PROPORTIONS[k].label }))}
                onChange={(proportion) => setDesign({ proportion })}
              />
              <Hint>{PROPORTIONS[c.design.proportion].note}</Hint>
              <Chips
                label="Teeth"
                value={c.design.count}
                options={([6, 8, 10] as ToothCount[]).map((k) => ({ value: k, label: String(k) }))}
                onChange={(count) => setDesign({ count })}
              />
              <div className="actions">
                <button className="btn secondary" onClick={centerOnMidline}>
                  Center on midline
                </button>
                <button className="btn secondary" onClick={() => setDesign({ tilt: 0 })}>
                  Level to {ref}
                </button>
                {!lower && (
                  <button
                    className="btn secondary"
                    onClick={() => {
                      setDesign({ arc: fitArcToLowerLip(c.lips, c.design, c.guides) });
                      toast.show("Smile arc now follows the lower lip");
                    }}
                  >
                    Follow lower lip
                  </button>
                )}
              </div>
              <details className="fine">
                <summary>Fine-tune</summary>
                <Slider
                  label={lower ? "Lower central width / length" : "Central width / length"}
                  value={c.design.wl}
                  min={lower ? WL_RANGE.lower.min : 0.65}
                  max={lower ? WL_RANGE.lower.max : 0.95}
                  step={0.01}
                  format={(v) => wlLabel(v, arch)}
                  onChange={(wl) => setDesign({ wl })}
                />
                <Slider label="Smile arc" value={c.design.arc} min={0} max={1} step={0.01} format={(v) => (v < 0.15 ? "flat" : v < 0.55 ? "gentle" : "curved")} onChange={(arc) => setDesign({ arc })} />
                {!lower && <Slider label="Lateral step" value={c.design.lateralStep} min={0} max={0.25} step={0.01} format={(v) => `${Math.round(v * 100)}%`} onChange={(lateralStep) => setDesign({ lateralStep })} />}
                <Slider label={closeup ? "Tilt vs mouth corners" : "Tilt vs pupil line"} value={c.design.tilt} min={-6} max={6} step={0.1} format={(v) => `${v.toFixed(1)}°`} onChange={(tilt) => setDesign({ tilt: Math.round(tilt * 10) / 10 })} />
                <table className="widths mono">
                  <caption className="sr-only">Tooth widths</caption>
                  <tbody>
                    {m.widths.map((w, i) => (
                      <tr key={i}>
                        <td>{TOOTH_NAMES[i]}</td>
                        <td>{fmt(w)}</td>
                        <td>{Math.round((w / m.centralW) * 100)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button className="link mono" onClick={startCalibrate}>
                  {ppm ? "Recalibrate" : "Calibrate for mm"}
                </button>
              </details>
              {lower ? (
                <Hint>
                  Line the design up with the <b>lower incisal edges</b>. Drag ✛ (above the teeth) to move, the side dots for width
                  and the bottom dot for length.
                </Hint>
              ) : (
                <Hint>Drag ✛ (below the teeth) to move, the side dots for width and the top dot for length.</Hint>
              )}
            </>
          )}

          {step === "shade" && (
            <>
              <button
                className={c.design.shade === "match" ? "btn match-btn on" : "btn secondary match-btn"}
                aria-pressed={c.design.shade === "match"}
                onClick={() => setDesign({ shade: "match" })}
              >
                {lower ? "Match the upper teeth" : "Match the lower teeth"}
              </button>
              <p className="note">Takes the colour of the opposing teeth in this photo (e.g. existing restorations).</p>
              <div className="field">
                <span className="field-label">Shade (screen preview only)</span>
                <div className="swatches" role="radiogroup" aria-label="Shade">
                  {SHADES.map((s) => (
                    <button
                      key={s.id}
                      role="radio"
                      aria-checked={c.design.shade === s.id}
                      className={c.design.shade === s.id ? "swatch on" : "swatch"}
                      style={{ background: `linear-gradient(${s.cervical}, ${s.body} 45%, #c9cfd3)` }}
                      onClick={() => setDesign({ shade: s.id })}
                      aria-label={`Shade ${s.label}`}
                    >
                      <span>{s.id}</span>
                    </button>
                  ))}
                </div>
              </div>
              {lower && (
                <p className="note">
                  Lower teeth start from the upper shade (linked). Take the lower shade separately (cervical/body/incisal), at the same
                  session and light as the upper.
                </p>
              )}
              {c.design.shade.startsWith("BL") && <p className="note">Bleach shades need whitening or new restorations; discuss before showing.</p>}
              <Slider label="Blend with photo" value={c.design.opacity} min={0.4} max={1} step={0.01} format={(v) => `${Math.round(v * 100)}%`} onChange={(opacity) => setDesign({ opacity })} />
              <Toggle
                label="Mouth backdrop"
                note="Covers the old teeth inside the lip line"
                checked={c.design.backdrop !== false}
                onChange={(backdrop) => setDesign({ backdrop })}
              />
              <Hint>Phone screens differ. The real shade is matched in the chair with a shade guide.</Hint>
            </>
          )}

          {step === "plan" && (
            <PlanPanel
              plan={plan}
              recorded={!!c.plan}
              arch={arch}
              lib={lib}
              setPlan={setPlan}
              tab={planTab}
              setTab={setPlanTab}
              pickRole={pickRole}
              setPickRole={setPickRole}
              sampleSize={sampleSize}
              setSampleSize={setSampleSize}
              onMaterials={() => setMatsOpen(true)}
              onLabSheet={() => openSheet("lab")}
              onPrepSheet={() => openSheet("clinician")}
              onWaxup={() => setWaxOpen(true)}
              busy={busy}
            />
          )}

          {step === "compare" && (
            <>
              <Chips
                label="View"
                value={compareView}
                options={[
                  { value: "mouth", label: "Mouth" },
                  { value: "face", label: "Whole face" },
                ]}
                onChange={setCompareView}
              />
              <Toggle label="Prep map · what to change" note="Instead of the slider. Per tooth: amber = shade change (ΔE), green = add, red = reduce" checked={prepOn} onChange={setPrepOn} />
              {prepOn ? (
                <>
                  <PrepDisclaimer />
                  <PrepLegend prep={prep} />
                </>
              ) : (
                <Hint>Slide across the photo to compare now and the simulation.</Hint>
              )}
              <button
                className="btn secondary wide"
                onClick={() => {
                  setPresent(true);
                  document.documentElement.requestFullscreen?.().catch(() => {});
                }}
              >
                Present full screen
              </button>
              <div className="row">
                <button className="btn" onClick={() => askExport("side-by-side")} disabled={busy}>
                  Share side by side
                </button>
                <button className="btn secondary" onClick={() => askExport("after")} disabled={busy}>
                  Share simulation
                </button>
              </div>
              <Hint>Every exported image carries a permanent “Smile simulation · for discussion only” label. It is not a promised result.</Hint>
              <div className="field sheets">
                <span className="field-label">Printable sheets · A4</span>
                <div className="row tight">
                  <button className="btn secondary" onClick={() => openSheet("clinician")} disabled={busy}>
                    Prep sheet
                  </button>
                  <button className="btn secondary" onClick={() => openSheet("patient")} disabled={busy}>
                    Patient sheet
                  </button>
                </div>
              </div>
            </>
          )}
        </section>

        <div className="stepper">
          <button className="btn plain" onClick={() => goTo(STEPS[idx - 1].id)} disabled={idx === 0}>
            <Icon name="back" size={20} /> Back
          </button>
          {idx < STEPS.length - 1 ? (
            <button className="btn" onClick={() => goTo(STEPS[idx + 1].id)}>
              Next: {STEPS[idx + 1].label} <Icon name="forward" size={20} />
            </button>
          ) : (
            <button className="btn" onClick={close}>
              Finish
            </button>
          )}
        </div>
      </div>

      <nav className="steps" aria-label="Design steps">
        {STEPS.map((s, i) => {
          const done = i <= reached && i !== idx && (i < reached || reached === LAST);
          return (
            <button key={s.id} className={s.id === step ? "step on" : "step"} onClick={() => goTo(s.id)} aria-current={s.id === step ? "step" : undefined}>
              <span className="step-ico">
                <Icon name={s.icon} size={24} />
                {done && (
                  <i className="done" aria-hidden="true">
                    <Icon name="check" size={10} />
                  </i>
                )}
              </span>
              <span className="step-label">{stepLabel(s)}</span>
              <span className="step-n" aria-hidden="true">{s.n}</span>
              {done && <span className="sr-only"> (done)</span>}
            </button>
          );
        })}
      </nav>

      {coach && (
        <Sheet
          className="coach-sheet"
          title={
            <>
              Six steps to a <em>smile</em> plan
            </>
          }
          onClose={() => {
            localStorage.setItem(COACH_KEY, "1");
            setCoach(false);
          }}
        >
          <ol className="coach">
            <li><b>Face</b> · dots on the pupils and the midline (or the mouth corners for a smile close-up)</li>
            <li><b>Lips</b> · dots on the inside edge of the lips, then check the existing teeth</li>
            <li><b>Teeth</b> · upper or lower, shape, proportion and size; prep map</li>
            <li><b>Shade</b> · a colour to discuss</li>
            <li><b>Compare</b> · now and simulation, then share or print a sheet</li>
            <li><b>Plan</b> · your treatment plan, shade gap, checks and the lab prescription</li>
          </ol>
          <p className="hint">One finger drags a dot or moves the photo. Two fingers zoom. ↶ undoes any change.</p>
          <button
            className="btn wide"
            onClick={() => {
              localStorage.setItem(COACH_KEY, "1");
              setCoach(false);
            }}
          >
            Got it
          </button>
        </Sheet>
      )}

      {sheetDlg && !shareAsk && (
        <Sheet
          title={sheetDlg === "clinician" ? <>Prep <em>sheet</em></> : sheetDlg === "lab" ? <>Lab <em>prescription</em></> : <>Patient <em>sheet</em></>}
          onClose={() => setSheetDlg(null)}
        >
          {sheetDlg === "clinician" || sheetDlg === "lab" ? (
            <>
              {sheetDlg === "lab" ? (
                <p className="hint">
                  For the lab: teeth, material, prep level with the mm you entered, coverage, margins, target shade with the photo-estimate
                  note, mock-up reference and blank return instructions. Clinic name and phone; no patient name or ID.
                </p>
              ) : (
                <p className="hint">
                  For the clinician and the lab: today, design and prep map, per-tooth outline changes
                  {ppm ? " in mm" : " (calibrate for mm)"}, enamel reference values and the planning disclaimer
                  {c.plan ? ", plus your plan, shade gap, warnings and checklist" : ""}.
                </p>
              )}
              <Toggle
                label="Print the case code"
                note={caseCodeProblem(c.label) ?? `“${c.label}” · the clinic's own code, never the patient's name`}
                checked={printCode && !caseCodeProblem(c.label)}
                onChange={(v) => setPrintCode(v && !caseCodeProblem(c.label))}
              />
            </>
          ) : (
            <>
              <p className="hint">For the patient: today and the design idea, with plain wording and the simulation footer. No name or ID.</p>
              <Toggle label="Show where the design adds / is smaller" note="A close-up of the mouth with shaded and outlined areas" checked={showDiff} onChange={setShowDiff} />
              {siblings.length > 0 && (
                <div className="field">
                  <span className="field-label">Add other designs of this patient</span>
                  {siblings.map((x) => (
                    <Toggle
                      key={x.id}
                      label={x.label}
                      note={`${archOf(x.design) === "lower" ? "Lower" : "Upper"} teeth · ${x.framing === "closeup" ? "smile close-up" : "full face"}`}
                      checked={extra.includes(x.id)}
                      onChange={(v) => setExtra((e) => (v ? [...e, x.id] : e.filter((i) => i !== x.id)))}
                    />
                  ))}
                </div>
              )}
            </>
          )}
          <div className="row">
            <button className="btn" disabled={busy} onClick={() => withConsent("this sheet", () => void shareSheet(sheetDlg))}>
              Share PNG
            </button>
            <button className="btn secondary" disabled={busy} onClick={() => withConsent("this sheet", () => void printSheet(sheetDlg))}>
              Print / PDF
            </button>
          </div>
          <p className="mono small">A4 portrait · every page carries the simulation label</p>
        </Sheet>
      )}

      {printPages &&
        createPortal(
          <div className="print-root" aria-hidden="true">
            {printPages.map((u) => (
              <img key={u} src={u} alt="" />
            ))}
          </div>,
          document.body,
        )}

      {shareAsk && (
        <Sheet className="alert" title={`Share ${shareAsk.what}?`} onClose={() => setShareAsk(null)}>
          <p>Patient agreed to share {shareAsk.what}? It will leave the app (WhatsApp, gallery, print, cloud backup).</p>
          <div className="row">
            <button
              className="btn"
              onClick={() => {
                const run = shareAsk.run;
                setShareAsk(null);
                setC((x) => ({ ...x, consentShareAt: Date.now() }));
                run();
              }}
            >
              Yes, patient agreed
            </button>
            <button className="btn secondary" onClick={() => setShareAsk(null)}>
              Not now
            </button>
          </div>
        </Sheet>
      )}
      {waxOpen && (
        <Suspense fallback={<div className="waxup" aria-busy="true" />}>
          <WaxupView caseId={c.id} arch={arch} onClose={() => setWaxOpen(false)} deliver={deliver} />
        </Suspense>
      )}
      {matsOpen && <MaterialsSheet clinic={clinicMats} onChange={updateMats} onClose={() => setMatsOpen(false)} />}
      {toast.node}
    </div>
  );
}

/** mm input that keeps what is typed ("8.") and only reports valid widths (4–13 mm). */
function MmInput({ value, onChange }: { value?: number; onChange: (v: number | undefined) => void }) {
  const [text, setText] = useState(value ? String(value) : "");
  const n = Number(text.replace(",", "."));
  const bad = text !== "" && !(n >= 4 && n <= 13);
  return (
    <>
      <input
        className="input"
        type="text"
        inputMode="decimal"
        placeholder="e.g. 8.5"
        value={text}
        aria-invalid={bad}
        onChange={(e) => {
          const t = e.target.value;
          setText(t);
          const v = Number(t.replace(",", "."));
          onChange(t && v >= 4 && v <= 13 ? v : undefined);
        }}
      />
      {bad && <span className="error small">Enter a width between 4 and 13 mm.</span>}
    </>
  );
}

/** Labs: the confirm card under a proposal (scrolled into view so the three choices are always reachable). */
function AiConfirm({ note, useLabel, onUse, onRetry, onCancel }: { note: string; useLabel: string; onUse: () => void; onRetry: () => void; onCancel: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  }, [note]);
  return (
    <div className="ai-confirm" role="group" aria-label="Auto-detect suggestion" ref={ref}>
      <p className="ai-note">
        <span className="beta-tag">Beta</span> {note}
      </p>
      <div className="row tight">
        <button className="btn" onClick={onUse}>
          {useLabel}
        </button>
        <button className="btn secondary" onClick={onRetry}>
          Try again
        </button>
        <button className="btn plain" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
