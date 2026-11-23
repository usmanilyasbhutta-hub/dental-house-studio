// Reduction estimate from the 3D wax-up: for the material the DENTIST picks per tooth,
//   estimated reduction = minimum material thickness on that surface − what the wax-up already adds there
// (where the wax-up lies inside the tooth, that depth is added on top). Pure; unit-tested in tests/reduction.test.ts.
// Never picks a material, never fills the plan's prep mm: it is read by the dentist next to the mock-up / silicone index.
import { ENAMEL_MM } from "./enamel";
import { SAME_MM, slotter, surfaceOf, vertexNormals, type Mesh, type Rigid, type Surface, type Thickness, type WaxArch } from "./waxup";

export interface MaterialMin {
  id: string;
  label: string;
  /** minimum thickness, mm; 0 = surface not covered by this restoration */
  facial: number;
  edge: number;
  lingual: number;
}

/**
 * Typical minimum thicknesses (reference bands: docs/round3-clinical.md B; minimal ≤0.3–0.5, conventional veneer
 * 0.5–0.7 facial / 1.0–1.5 incisal; crowns per common manufacturer guidance). Editable: each clinic sets its own
 * from its materials' instructions for use.
 */
export const DEFAULT_MATERIALS: MaterialMin[] = [
  { id: "additive", label: "Additive only (composite / no-prep)", facial: 0, edge: 0, lingual: 0 },
  { id: "veneer-min", label: "Minimal veneer", facial: 0.3, edge: 0.5, lingual: 0 },
  { id: "veneer-ld", label: "Veneer, lithium disilicate", facial: 0.5, edge: 1.0, lingual: 0 },
  { id: "crown-ld", label: "Crown, lithium disilicate", facial: 1.0, edge: 1.5, lingual: 1.0 },
  { id: "crown-zr", label: "Crown, monolithic zirconia", facial: 0.6, edge: 1.0, lingual: 0.6 },
];

export const THICKNESS_KEY = "smile-studio.reduction.thickness.v1";

/** Saved edits merged over the defaults (unknown ids and bad numbers are ignored). */
export function mergeMaterials(saved: unknown): MaterialMin[] {
  const list = Array.isArray(saved) ? saved : [];
  const ok = (v: unknown) => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 3;
  return DEFAULT_MATERIALS.map((m) => {
    const s = list.find((x) => x && typeof x === "object" && (x as MaterialMin).id === m.id) as Partial<MaterialMin> | undefined;
    return s ? { ...m, facial: ok(s.facial) ? s.facial! : m.facial, edge: ok(s.edge) ? s.edge! : m.edge, lingual: ok(s.lingual) ? s.lingual! : m.lingual } : m;
  });
}

export interface SurfaceReduction {
  surface: Surface;
  /** minimum thickness used, mm */
  min: number;
  /** deepest estimated reduction (90th percentile), mm */
  deep: number;
  /** typical (median) estimated reduction, mm */
  typical: number;
  /** share of this surface that needs any reduction (> SAME_MM), % */
  pct: number;
}

export interface ToothReduction {
  fdi: number;
  material: string;
  surfaces: SurfaceReduction[];
  /** shown when the facial estimate is deeper than typical enamel at this tooth */
  enamelNote?: string;
  /** shown when nothing could be estimated */
  note?: string;
}

export interface ReductionResult {
  /** estimated reduction per wax-up vertex, mm; NaN = not estimated (no material chosen, gum, base, side walls) */
  prep: Float32Array;
  teeth: ToothReduction[];
}

/** Mid-facial typical enamel for an FDI tooth, or undefined where there is no data (premolars, molars). */
export function enamelMid(fdi: number): number | undefined {
  const q = Math.floor(fdi / 10), t = fdi % 10;
  const upper = q === 1 || q === 2;
  if (t === 3) return ENAMEL_MM.canine[1];
  if (t === 1 || t === 2) return upper ? (t === 1 ? ENAMEL_MM.upperCentral[1] : ENAMEL_MM.upperLateral[1]) : ENAMEL_MM.lowerIncisor[1];
  return undefined;
}

const SURFACES: Surface[] = ["facial", "edge", "lingual"];
const round1 = (v: number) => Math.round(v * 10) / 10 || 0;
const pct = (v: number[], q: number) => {
  if (!v.length) return 0;
  const s = v.slice().sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.floor(q * (s.length - 1)))];
};

/**
 * @param choice FDI → material id, as picked by the dentist (teeth without a choice are not estimated)
 */
export function reduction(
  th: Thickness & { T?: Rigid },
  waxup: Mesh,
  arch: WaxArch,
  choice: Record<number, string>,
  materials: MaterialMin[],
  opts: { shift?: number; flip?: boolean } = {},
): ReductionResult {
  const nv = waxup.pos.length / 3;
  const prep = new Float32Array(nv).fill(NaN);
  const { slot, fdiOf } = slotter(th, arch, opts);
  const byId = new Map(materials.map((m) => [m.id, m]));
  const wn = vertexNormals(waxup);
  const R = th.T?.R;

  // pass 1: slot of every compared vertex; margin per tooth = cervical end of the changed area (5th percentile height)
  const fdiAt = new Int16Array(nv);
  const hAt = new Float32Array(nv);
  const lwAt = new Float32Array(nv);
  const changedH = new Map<number, number[]>();
  for (let i = 0; i < nv; i++) {
    if (Number.isNaN(th.d[i])) continue;
    const s = slot(th.pos[i * 3], th.pos[i * 3 + 1], th.pos[i * 3 + 2]);
    if (!s) continue;
    const fdi = fdiOf(s);
    fdiAt[i] = fdi;
    hAt[i] = s.h;
    lwAt[i] = s.lw;
    if (Math.abs(th.d[i]) > SAME_MM) {
      let a = changedH.get(fdi);
      if (!a) changedH.set(fdi, (a = []));
      a.push(s.h);
    }
  }
  const margin = new Map<number, number>();
  for (const [fdi, hs] of changedH) if (hs.length >= 20) margin.set(fdi, pct(hs, 0.05));

  // pass 2: estimated reduction on the covered surfaces of teeth with a material
  const vals = new Map<number, Record<Surface, number[]>>();
  for (let i = 0; i < nv; i++) {
    const fdi = fdiAt[i];
    if (!fdi) continue;
    const m = byId.get(choice[fdi]);
    const mg = margin.get(fdi);
    if (!m || mg === undefined || hAt[i] < mg) continue;
    const surf = surfaceOf(th, wn, R, i, lwAt[i]);
    if (!surf) continue;
    const min = m[surf];
    const additive = m.facial === 0 && m.edge === 0 && m.lingual === 0;
    if (min <= 0 && !additive) continue; // surface not covered by this restoration
    const p = Math.max(0, min - th.d[i]);
    prep[i] = p;
    let v = vals.get(fdi);
    if (!v) vals.set(fdi, (v = { facial: [], edge: [], lingual: [] }));
    v[surf].push(p);
  }

  const teeth: ToothReduction[] = [];
  for (const [fdiStr, id] of Object.entries(choice)) {
    const fdi = Number(fdiStr);
    const m = byId.get(id);
    if (!m) continue;
    const v = vals.get(fdi);
    if (!margin.has(fdi) || !v) {
      teeth.push({ fdi, material: m.label, surfaces: [], note: "The wax-up does not change this tooth, so its margin is unknown: not estimated." });
      continue;
    }
    const surfaces: SurfaceReduction[] = [];
    for (const s of SURFACES) {
      const a = v[s];
      if (a.length < 15) continue;
      surfaces.push({ surface: s, min: m[s], deep: round1(pct(a, 0.9)), typical: round1(pct(a, 0.5)), pct: Math.round((a.filter((x) => x > SAME_MM).length / a.length) * 100) });
    }
    const t: ToothReduction = { fdi, material: m.label, surfaces };
    const fac = surfaces.find((s) => s.surface === "facial");
    const en = enamelMid(fdi);
    if (fac && en !== undefined && fac.deep > en)
      t.enamelNote = `Facial estimate deeper than typical enamel here (≈${en.toFixed(1)} mm, population average): check on the mock-up.`;
    teeth.push(t);
  }
  const order = (fdi: number) => {
    const q = Math.floor(fdi / 10), t = fdi % 10;
    return q === 1 || q === 4 ? -t : t;
  };
  return { prep, teeth: teeth.sort((a, b) => order(a.fdi) - order(b.fdi)) };
}

const SURFACE_WORD: Record<Surface, string> = { facial: "facial", edge: "edge", lingual: "lingual" };

/** One-line wording, e.g. "facial up to 0.2 (typ. 0.1) · edge none · lingual —" (mm). */
export function reductionLine(t: ToothReduction) {
  if (t.note) return t.note;
  if (!t.surfaces.length) return "no covered surface measured";
  return (
    t.surfaces
      .map((s) => `${SURFACE_WORD[s.surface]} ${s.deep <= SAME_MM ? "none" : `up to ${s.deep.toFixed(1)} (typ. ${s.typical.toFixed(1)})`}`)
      .join(" · ") + " mm"
  );
}

export const REDUCTION_DISCLAIMER =
  "Estimated reduction = the minimum thickness set for the chosen material − what the lab's wax-up already adds. Thicknesses are typical values; set your own from the material's instructions. Tooth numbers and margins are estimates. The silicone index on the mock-up decides the final preparation; these values never fill the plan's prep mm.";
