import { describe, expect, it } from "vitest";
import type { CasePlan, ToothPlan } from "../src/model";
import {
  addClinicMaterial,
  blankTooth,
  contralateral,
  coverageOptions,
  defaultPlan,
  deltaE00,
  deltaE76,
  hexToLab,
  loadClinicMaterials,
  materialLibrary,
  materialOf,
  MATERIALS,
  nearestTab,
  neighbours,
  PHOTO_NOTE,
  planSummary,
  planWarnings,
  removeClinicMaterial,
  rgbToLab,
  sampleLab,
  saveClinicMaterials,
  setTooth,
  shadeGap,
  TAB_LAB,
  teethText,
  toothName,
  W,
  type Lab,
} from "../src/planner";
import { bannedIn } from "../src/sheetCopy";
import { SHADES } from "../src/shades";

// Sharma, Wu & Dalal (2005) CIEDE2000 test data: L1 a1 b1 L2 a2 b2 ΔE00
const SHARMA: number[][] = [
  [50, 2.6772, -79.7751, 50, 0, -82.7485, 2.0425],
  [50, 3.1571, -77.2803, 50, 0, -82.7485, 2.8615],
  [50, 2.8361, -74.02, 50, 0, -82.7485, 3.4412],
  [50, -1.3802, -84.2814, 50, 0, -82.7485, 1.0],
  [50, -1.1848, -84.8006, 50, 0, -82.7485, 1.0],
  [50, -0.9009, -85.5211, 50, 0, -82.7485, 1.0],
  [50, 0, 0, 50, -1, 2, 2.3669],
  [50, -1, 2, 50, 0, 0, 2.3669],
  [50, 2.49, -0.001, 50, -2.49, 0.0009, 7.1792],
  [50, 2.49, -0.001, 50, -2.49, 0.001, 7.1792],
  [50, 2.49, -0.001, 50, -2.49, 0.0011, 7.2195],
  [50, 2.49, -0.001, 50, -2.49, 0.0012, 7.2195],
  [50, -0.001, 2.49, 50, 0.0009, -2.49, 4.8045],
  [50, -0.001, 2.49, 50, 0.001, -2.49, 4.8045],
  [50, -0.001, 2.49, 50, 0.0011, -2.49, 4.7461],
  [50, 2.5, 0, 50, 0, -2.5, 4.3065],
  [50, 2.5, 0, 73, 25, -18, 27.1492],
  [50, 2.5, 0, 61, -5, 29, 22.8977],
  [50, 2.5, 0, 56, -27, -3, 31.903],
  [50, 2.5, 0, 58, 24, 15, 19.4535],
  [50, 2.5, 0, 50, 3.1736, 0.5854, 1.0],
  [50, 2.5, 0, 50, 3.2972, 0, 1.0],
  [50, 2.5, 0, 50, 1.8634, 0.5757, 1.0],
  [50, 2.5, 0, 50, 3.2592, 0.335, 1.0],
  [60.2574, -34.0099, 36.2677, 60.4626, -34.1751, 39.4387, 1.2644],
  [63.0109, -31.0961, -5.8663, 62.8187, -29.7946, -4.0864, 1.263],
  [61.2901, 3.7196, -5.3901, 61.4292, 2.248, -4.962, 1.8731],
  [35.0831, -44.1164, 3.7933, 35.0232, -40.0716, 1.5901, 1.8645],
  [22.7233, 20.0904, -46.694, 23.0331, 14.973, -42.5619, 2.0373],
  [36.4612, 47.858, 18.3852, 36.2715, 50.5065, 21.2231, 1.4146],
  [90.8027, -2.0831, 1.441, 91.1528, -1.6435, 0.0447, 1.4441],
  [90.9257, -0.5406, -0.9208, 88.6381, -0.8985, -0.7239, 1.5381],
  [6.7747, -0.2908, -2.4247, 5.8714, -0.0985, -2.2286, 0.6377],
  [2.0776, 0.0795, -1.135, 0.9033, -0.0636, -0.5514, 0.9082],
];

describe("colour", () => {
  it("sRGB → CIELAB (D65) matches reference values", () => {
    const w = rgbToLab(255, 255, 255);
    expect(w[0]).toBeCloseTo(100, 2);
    expect(Math.abs(w[1])).toBeLessThan(0.01);
    expect(Math.abs(w[2])).toBeLessThan(0.01);
    expect(rgbToLab(0, 0, 0)).toEqual([0, 0, 0]);
    const red = rgbToLab(255, 0, 0);
    expect(red[0]).toBeCloseTo(53.24, 1);
    expect(red[1]).toBeCloseTo(80.09, 1);
    expect(red[2]).toBeCloseTo(67.2, 1);
    const mid = rgbToLab(128, 128, 128);
    expect(mid[0]).toBeCloseTo(53.59, 1);
  });

  it("CIEDE2000 matches all 34 Sharma et al. reference pairs (4 decimals)", () => {
    for (const [L1, a1, b1, L2, a2, b2, want] of SHARMA) {
      expect(deltaE00([L1, a1, b1], [L2, a2, b2])).toBeCloseTo(want, 4);
      expect(deltaE00([L2, a2, b2], [L1, a1, b1])).toBeCloseTo(want, 4); // symmetric
    }
  });

  it("ΔE76 is the Euclidean distance", () => {
    expect(deltaE76([50, 0, 0], [53, 4, 0])).toBe(5);
  });

  it("sampleLab takes the median of a disk and rejects highlights and dark pixels", () => {
    const w = 20;
    const h = 20;
    const px = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) px.set([220, 205, 170, 255], i * 4); // tooth-like
    // a specular highlight and a dark gap inside the disk
    for (const [x, y] of [[10, 10], [11, 10], [10, 11]]) px.set([255, 255, 255, 255], (y * w + x) * 4);
    for (const [x, y] of [[8, 9], [9, 9]]) px.set([10, 5, 5, 255], (y * w + x) * 4);
    const lab = sampleLab(px, w, h, 10, 10, 3)!;
    const want = rgbToLab(220, 205, 170);
    lab.forEach((v, i) => expect(v).toBeCloseTo(want[i], 6));
    // all highlight: nothing usable
    const white = new Uint8ClampedArray(w * h * 4).fill(255);
    expect(sampleLab(white, w, h, 10, 10, 3)).toBeNull();
    // edge of the image is clipped, not an error
    expect(sampleLab(px, w, h, 0, 0, 3)).not.toBeNull();
  });
});

describe("shade gap", () => {
  const ref: Lab = [76, 1, 18];
  it("names chroma as dominant and suggests whitening when the match is more yellow", () => {
    const g = shadeGap(ref, [75.5, 1.5, 26]);
    expect(g.dominant).toBe("chroma");
    expect(g.dC).toBeGreaterThan(0);
    expect(g.band).toBe("beyond");
    expect(g.text).toMatch(/Mostly yellowness\/chroma: whitening usually reduces this; consider whitening first and re-taking the shade after 2 weeks\./);
    expect(g.text.endsWith(PHOTO_NOTE)).toBe(true);
  });
  it("value-dominant and hue-dominant gaps", () => {
    expect(shadeGap(ref, [70, 1, 18]).dominant).toBe("value");
    expect(shadeGap(ref, [70, 1, 18]).text).toMatch(/darker/);
    const hue = shadeGap([76, 0, 18], [76, 4.5, 17.4]);
    expect(hue.dominant).toBe("hue");
  });
  it("thresholds: perceptibility 0.8 and acceptability 1.8 (Paravina 2015)", () => {
    expect(shadeGap(ref, ref).band).toBe("below");
    expect(shadeGap(ref, ref).text).toMatch(/Below the perceptibility threshold/);
    expect(shadeGap(ref, [77.2, 1, 18]).band).toBe("perceptible");
    expect(shadeGap(ref, ref).text.endsWith(PHOTO_NOTE)).toBe(true);
  });
  it("less chroma than the reference: no whitening suggestion", () => {
    const g = shadeGap(ref, [76, 0.5, 11]);
    expect(g.dominant).toBe("chroma");
    expect(g.text).toMatch(/whitening would not close this gap/);
  });
  it("nearest tab is labelled approximate and finds its own tab", () => {
    for (const [k, v] of Object.entries(TAB_LAB)) expect(nearestTab(v).tab).toBe(k);
    expect(nearestTab([76.2, 1, 19.1]).label).toBe("A2 (approximate)");
    // every app shade tab has an approximate Lab
    for (const s of SHADES) expect(TAB_LAB[s.id]).toBeDefined();
    expect(hexToLab("#FFFFFF")[0]).toBeCloseTo(100, 2);
  });
});

describe("materials", () => {
  it("default library covers the required options with neutral copy", () => {
    const ids = MATERIALS.map((m) => m.id);
    expect(ids).toEqual(["none", "bleaching", "direct-composite", "indirect-composite", "feldspathic-veneer", "ld-veneer", "ld-crown", "zirconia-crown", "other"]);
    for (const m of MATERIALS) expect(bannedIn(`${m.name} ${m.pros} ${m.cons}`)).toEqual([]);
  });
  it("clinic materials: add, dedupe, delete, persist", () => {
    const mem = new Map<string, string>();
    const kv = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
    let list = addClinicMaterial([], "  Lab X pressed veneer ", "ceramic-veneer");
    list = addClinicMaterial(list, "Lab X pressed veneer", "ceramic-veneer");
    list = addClinicMaterial(list, "direct composite", "composite"); // clashes with a default name
    list = addClinicMaterial(list, "", "composite");
    expect(list).toHaveLength(1);
    saveClinicMaterials(list, kv);
    const back = loadClinicMaterials(kv);
    expect(back[0]).toMatchObject({ id: "clinic:Lab X pressed veneer", name: "Lab X pressed veneer", category: "ceramic-veneer", clinic: true });
    expect(materialLibrary(back)).toHaveLength(MATERIALS.length + 1);
    expect(removeClinicMaterial(back, back[0].id)).toHaveLength(0);
    // a deleted clinic material still reads by name
    expect(materialOf("clinic:Lab X pressed veneer")!.name).toBe("Lab X pressed veneer");
    expect(loadClinicMaterials({ getItem: () => "{bad json", setItem: () => {} })).toEqual([]);
  });
});

describe("teeth", () => {
  it("FDI helpers", () => {
    expect(contralateral(13)).toBe(23);
    expect(contralateral(41)).toBe(31);
    expect(neighbours(11).sort()).toEqual([12, 21]);
    expect(neighbours(33).sort()).toEqual([32, 34]);
    expect(neighbours(48)).toEqual([47]);
    expect(toothName(41)).toBe("lower right central incisor");
    expect(toothName(24)).toBe("upper left first premolar");
    expect(coverageOptions(32)).toEqual(["facial", "incisal-butt", "incisal-overlap"]);
    expect(coverageOptions(44)).toEqual(["facial", "cusp-short", "cusp-full", "onlay"]);
  });
  it("setTooth creates/patches and keeps coverage valid for the tooth type", () => {
    let p = defaultPlan("lower");
    expect(p.teeth.map((t) => t.fdi)).toEqual([43, 42, 41, 31, 32, 33]);
    p = setTooth(p, 44, { include: true, coverage: "incisal-overlap" });
    expect(p.teeth.find((t) => t.fdi === 44)!.coverage).toBe("facial");
    p = setTooth(p, 41, { material: "ld-veneer" });
    expect(p.teeth.find((t) => t.fdi === 41)!.material).toBe("ld-veneer");
  });
  it("teeth text and summary", () => {
    expect(teethText([33, 32, 31, 41, 42, 43])).toBe("33–43, 6 teeth");
    expect(teethText([13, 12, 11, 21, 22, 23])).toBe("13–23, 6 teeth");
    expect(teethText([11])).toBe("11, 1 tooth");
    expect(teethText([14, 12, 11])).toBe("14, 11–12, 3 teeth");
    expect(teethText([])).toBe("no teeth");
    let p = defaultPlan("lower");
    for (const fdi of [43, 42, 41, 31, 32, 33]) p = setTooth(p, fdi, { material: "ld-veneer", prep: fdi === 33 || fdi === 43 ? "minimal" : "additive" });
    const s = planSummary(p);
    expect(s.teethText).toBe("33–43, 6 teeth");
    expect(s.byMaterial).toEqual([["Lithium disilicate veneer", 6]]);
    expect(s.byPrep).toEqual([["additive", 4], ["minimal", 2]]);
    expect(s.text).toMatch(/^33–43, 6 teeth · 6 × Lithium disilicate veneer · 4 × additive, 2 × minimal$/);
  });
});

describe("plan warnings", () => {
  const tooth = (fdi: number, o: Partial<ToothPlan> = {}): ToothPlan => ({ ...blankTooth(fdi), include: true, material: "ld-veneer", ...o });
  const plan = (teeth: ToothPlan[], o: Partial<CasePlan> = {}): CasePlan => ({
    teeth,
    shade: { samples: [] },
    flags: { perioStable: true },
    checklist: { mockup: true, nightGuard: false },
    ...o,
  });
  const has = (p: CasePlan, text: string, fdi?: number) =>
    planWarnings(p).some((w) => w.text === text && (fdi === undefined || (w.teeth ?? []).includes(fdi)));
  const level = (p: CasePlan, text: string) => planWarnings(p).find((w) => w.text === text)?.level;

  it("lower incisor conventional / crown / facial > 0.5 mm → thin enamel caution", () => {
    expect(has(plan([tooth(31, { prep: "conventional" })]), W.thinEnamel, 31)).toBe(true);
    expect(has(plan([tooth(42, { prep: "minimal", prepMm: { facial: 0.6 } })]), W.thinEnamel, 42)).toBe(true);
    expect(has(plan([tooth(42, { prep: "minimal", prepMm: { facial: 0.4 } })]), W.thinEnamel)).toBe(false);
    expect(has(plan([tooth(11, { prep: "conventional" })]), W.thinEnamel)).toBe(false);
    expect(level(plan([tooth(31, { prep: "conventional" })]), W.thinEnamel)).toBe("caution");
  });
  it("crown on a lower incisor → 63–72 % caution", () => {
    const p = plan([tooth(41, { prep: "crown", material: "zirconia-crown" })]);
    expect(has(p, W.crownLowerIncisor, 41)).toBe(true);
    expect(level(p, W.crownLowerIncisor)).toBe("caution");
    expect(has(p, W.thinEnamel, 41)).toBe(true);
    expect(has(plan([tooth(44, { prep: "crown" })]), W.crownLowerIncisor)).toBe(false);
  });
  it("margin on root → caution", () => {
    expect(has(plan([tooth(33, { margin: "on-root" })]), W.onRoot, 33)).toBe(true);
  });
  it("deep bite + incisal overlap (or lengthening in notes) on a lower incisor → caution", () => {
    const flags = { perioStable: true, deepBite: true };
    expect(has(plan([tooth(31, { coverage: "incisal-overlap" })], { flags }), W.deepBite, 31)).toBe(true);
    expect(has(plan([tooth(32, { notes: "lengthen 1 mm" })], { flags }), W.deepBite, 32)).toBe(true);
    expect(has(plan([tooth(31, { coverage: "incisal-overlap" })]), W.deepBite)).toBe(false);
  });
  it("lower premolar with facial coverage → info", () => {
    const p = plan([tooth(44, { coverage: "facial" })]);
    expect(has(p, W.premolarFacial, 44)).toBe(true);
    expect(level(p, W.premolarFacial)).toBe("info");
    expect(has(plan([tooth(44, { coverage: "cusp-full" })]), W.premolarFacial)).toBe(false);
  });
  it("asymmetric inclusion → caution on the visible twin", () => {
    const p = plan([tooth(13), { ...blankTooth(23), visible: "smile" }]);
    expect(has(p, W.asymmetric, 23)).toBe(true);
    expect(has(plan([tooth(13), { ...blankTooth(23), visible: "no" }]), W.asymmetric)).toBe(false);
  });
  it("visible neighbour not included → caution", () => {
    const p = plan([tooth(43), tooth(42), tooth(41), tooth(31), tooth(32), tooth(33), { ...blankTooth(34), visible: "speech" }, { ...blankTooth(44), visible: "smile" }]);
    expect(has(p, W.neighbour, 34)).toBe(true);
    expect(has(p, W.neighbour, 44)).toBe(true);
    expect(has(p, W.asymmetric)).toBe(false);
    // unrecorded neighbours: an info asking to record visibility
    expect(has(plan([tooth(41)]), W.visibilityUnknown, 42)).toBe(true);
  });
  it("composite next to ceramic → info", () => {
    const p = plan([tooth(11, { material: "direct-composite" }), tooth(21, { material: "ld-veneer" })]);
    expect(has(p, W.mixedMaterials, 11)).toBe(true);
    expect(level(p, W.mixedMaterials)).toBe("info");
    expect(has(plan([tooth(11), tooth(21)]), W.mixedMaterials)).toBe(false);
  });
  it("shade gap mostly chroma and whitening not done → info", () => {
    const samples = [
      { role: "reference" as const, pt: { x: 0, y: 0 }, lab: [76, 1, 18] as Lab },
      { role: "match" as const, pt: { x: 1, y: 1 }, lab: [75.5, 1.5, 26] as Lab },
    ];
    expect(has(plan([tooth(31)], { shade: { samples } }), W.whitening)).toBe(true);
    expect(has(plan([tooth(31)], { shade: { samples, whiteningDone: true } }), W.whitening)).toBe(false);
    expect(has(plan([], { shade: { samples } }), W.whitening)).toBe(false);
  });
  it("bruxism without a night guard → caution", () => {
    expect(level(plan([tooth(31)], { flags: { perioStable: true, bruxism: true } }), W.bruxism)).toBe("caution");
    expect(has(plan([tooth(31)], { flags: { perioStable: true, bruxism: true }, checklist: { mockup: true, nightGuard: true } }), W.bruxism)).toBe(false);
  });
  it("perio not recorded as stable while restorations are planned → stop (sorted first)", () => {
    const p = plan([tooth(31, { margin: "on-root" })], { flags: {} });
    expect(level(p, W.perio)).toBe("stop");
    expect(planWarnings(p)[0].level).toBe("stop");
    expect(has(plan([{ ...tooth(31), material: "bleaching" }], { flags: {} }), W.perio)).toBe(false);
  });
  it("prep beyond additive without an approved mock-up → caution", () => {
    const p = plan([tooth(11, { prep: "minimal" }), tooth(21, { prep: "additive" })], { checklist: {} });
    const w = planWarnings(p).find((x) => x.text === W.mockup)!;
    expect(w.level).toBe("caution");
    expect(w.teeth).toEqual([11]);
    expect(w.fdi).toBe(11);
    expect(has(plan([tooth(11, { prep: "minimal" })]), W.mockup)).toBe(false);
  });
  it("identical warnings are merged across teeth; a tidy plan is quiet", () => {
    const p = plan([tooth(31, { prep: "crown" }), tooth(41, { prep: "crown" })]);
    const w = planWarnings(p).filter((x) => x.text === W.crownLowerIncisor);
    expect(w).toHaveLength(1);
    expect(w[0].teeth).toEqual([41, 31]);
    expect(w[0].fdi).toBeUndefined();
    const quiet = plan(
      [43, 42, 41, 31, 32, 33].map((fdi) => tooth(fdi, { prep: "additive" })).concat([{ ...blankTooth(44), visible: "no" }, { ...blankTooth(34), visible: "no" }]),
    );
    expect(planWarnings(quiet)).toEqual([]);
  });
  it("warning copy carries no banned claims", () => {
    for (const t of Object.values(W)) expect(bannedIn(t)).toEqual([]);
  });
});
