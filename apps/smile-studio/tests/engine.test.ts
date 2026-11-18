// Round-3 engine: tooth mask, photo synthesis, prep guide, lower arch. Synthetic data only (never patient photos).
import { describe, expect, it } from "vitest";
import type { Mask, ToothPrep } from "../src/contracts";
import { centralLength, designHandles, plannedOutlines, PROPORTIONS_LOWER, toImage, toLocal, toothBoxes, toothLabel } from "../src/geometry";
import { DEFAULT_DESIGN, type Design, type Pt } from "../src/model";
import { analyse, lipGrid, makeFrame, planInGrid, pushPull, resampleLab, resampleMask, shadeTarget, synthesise } from "../src/photoTeeth";
import { computePrep, contours, ENAMEL_MM, fmtMm, HIDDEN_LEGEND, HIDDEN_NOTE, PREP_DISCLAIMER, prepWording, setPrepPhotoReader } from "../src/prep";
import { hexToLab, labToRgb, rgbToLab, shadeLab } from "../src/shades";
import { detectTeethRGBA, lipCoverage, maskVersion, newMask, paintMask, rasterPolygon } from "../src/teethMask";

// ---------- synthetic mouth ----------
const W = 400;
const H = 240;
const guides = { pupilR: { x: 100, y: 40 }, pupilL: { x: 300, y: 40 }, midline: { x: 200, y: 40 } };
const lips: Pt[] = [];
for (let i = 0; i < 24; i++) {
  const a = (i / 24) * Math.PI * 2;
  lips.push({ x: 200 + Math.cos(a) * 170, y: 120 + Math.sin(a) * 80 });
}
const upper: Design = { ...DEFAULT_DESIGN, center: { x: 200, y: 140 }, width: 240, count: 6, wl: 0.8, arc: 0, lateralStep: 0, tilt: 0 };

function mouth(teeth: Mask | null, toothRGB: [number, number, number] = [222, 205, 160]) {
  const px = new Uint8ClampedArray(W * H * 4);
  const inside = lipCoverage(lips, W, H, 1);
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) - 0.5;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      let c: number[];
      if (inside[i] < 0.5) c = [196, 96, 98]; // lips / skin: red
      else if (y < 75) c = [205, 110, 115]; // gum: pink
      else c = [40, 18, 20]; // mouth: dark red
      if (teeth && teeth.data[i]) {
        const shade = 1 - (y - 70) * 0.0015; // a little value gradient
        c = toothRGB.map((v) => v * shade);
      }
      const n = rnd() * 6;
      px[i * 4] = c[0] + n;
      px[i * 4 + 1] = c[1] + n;
      px[i * 4 + 2] = c[2] + n;
      px[i * 4 + 3] = 255;
    }
  }
  return px;
}

/** Existing-teeth mask = the planned outlines of design d (optionally shifted), clipped to the lips. */
function teethOf(d: Design, dy = 0): Mask {
  const acc = new Float32Array(W * H);
  for (const o of plannedOutlines(d, 0)) rasterPolygon(acc, W, H, o.pts.map((p) => ({ x: p.x, y: p.y + dy })));
  const inside = lipCoverage(lips, W, H, 1);
  const m = newMask(W, H);
  for (let i = 0; i < acc.length; i++) m.data[i] = acc[i] >= 0.5 && inside[i] >= 0.5 ? 255 : 0;
  return m;
}

function iou(a: Mask, b: Mask) {
  let i = 0;
  let u = 0;
  for (let k = 0; k < a.data.length; k++) {
    const x = a.data[k] > 0;
    const y = b.data[k] > 0;
    if (x && y) i++;
    if (x || y) u++;
  }
  return i / u;
}

describe("rasterPolygon", () => {
  it("anti-aliased coverage sums to the polygon area", () => {
    const acc = new Float32Array(50 * 50);
    rasterPolygon(acc, 50, 50, [
      { x: 10.25, y: 10 },
      { x: 30.75, y: 10 },
      { x: 30.75, y: 25.5 },
      { x: 10.25, y: 25.5 },
    ]);
    const sum = acc.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(20.5 * 15.5, 0);
  });
});

describe("detectTeeth (synthetic mouth)", () => {
  it("finds the teeth inside the lips and ignores gum, mouth, lips and small wet glints", () => {
    const truth = teethOf(upper);
    const px = mouth(truth);
    // a specular glint on the gum and one on the lip: bright, small
    for (const [gx, gy] of [
      [120, 62],
      [60, 190],
    ]) {
      for (let y = gy - 1; y <= gy + 1; y++)
        for (let x = gx - 1; x <= gx + 1; x++) {
          const i = (y * W + x) * 4;
          px[i] = px[i + 1] = px[i + 2] = 250;
        }
    }
    const m = detectTeethRGBA(px, W, H, lipCoverage(lips, W, H, 1));
    expect(iou(m, truth)).toBeGreaterThan(0.85);
    expect(m.data[62 * W + 120]).toBe(0);
    expect(m.data[190 * W + 60]).toBe(0);
    // nothing outside the lip contour
    const inside = lipCoverage(lips, W, H, 1);
    for (let i = 0; i < m.data.length; i++) if (inside[i] < 0.5) expect(m.data[i]).toBe(0);
  });

  it("works on yellow (stained) teeth too", () => {
    const truth = teethOf(upper);
    const m = detectTeethRGBA(mouth(truth, [215, 185, 110]), W, H, lipCoverage(lips, W, H, 1));
    expect(iou(m, truth)).toBeGreaterThan(0.8);
  });
});

describe("paintMask", () => {
  it("paints and erases discs given in image px on a smaller mask, and bumps the version", () => {
    const m = newMask(200, 120); // half of a 400 × 240 photo
    const v0 = maskVersion(m);
    paintMask(m, { x: 200, y: 120 }, 20, 255, 400, 240);
    let n = m.data.reduce((a, b) => a + (b ? 1 : 0), 0);
    expect(n).toBeGreaterThan(Math.PI * 10 * 10 * 0.85);
    expect(n).toBeLessThan(Math.PI * 10 * 10 * 1.2);
    expect(m.data[60 * 200 + 100]).toBe(255);
    expect(maskVersion(m)).toBe(v0 + 1);
    paintMask(m, { x: 200, y: 120 }, 8, 0, 400, 240);
    expect(m.data[60 * 200 + 100]).toBe(0);
    n = m.data.reduce((a, b) => a + (b ? 1 : 0), 0);
    expect(n).toBeGreaterThan(0);
    // painting off the edge is safe
    paintMask(m, { x: -50, y: 500 }, 30, 255, 400, 240);
  });
});

describe("pushPull inpainting", () => {
  it("fills a hole with values between its surroundings", () => {
    const w = 16;
    const h = 8;
    const v = new Float32Array(w * h * 3);
    const wt = new Float32Array(w * h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        v[i * 3] = x < 8 ? 10 : 90;
        wt[i] = x >= 6 && x <= 9 ? 0 : 1;
      }
    pushPull(v, wt, w, h);
    for (let y = 0; y < h; y++) {
      const a = v[(y * w + 6) * 3];
      const b = v[(y * w + 9) * 3];
      expect(a).toBeGreaterThan(9);
      expect(b).toBeLessThan(91);
      expect(a).toBeLessThan(b);
    }
  });
});

describe("photo synthesis (pure core)", () => {
  it("recolours existing teeth toward the shade, keeps texture, and never touches pixels outside the lips", () => {
    const exist = teethOf(upper);
    const px = mouth(exist, [215, 185, 110]);
    const scene = { lips, design: upper, guides, imgW: W, imgH: H };
    const f = makeFrame(scene, 1);
    const Lg = resampleLab(f, px, 0, 0, W, H);
    const lip = lipGrid(f, lips);
    const E = resampleMask(f, exist, W, H);
    const plan = planInGrid(f, upper);
    const an = analyse(f, plan, E, lip, Lg);
    const out = synthesise(f, Lg, E, lip, an, shadeTarget("B1", false, { a: 0, b: 0, L: 0 }), { grain: false });
    let bIn = 0;
    let bOut = 0;
    let n = 0;
    const lab = [0, 0, 0];
    for (let j = 0; j < f.gw * f.gh; j++) {
      if (out[j * 4 + 3] === 255 && E[j] > 0.99) {
        bIn += Lg[j * 3 + 2];
        rgbToLab(out[j * 4], out[j * 4 + 1], out[j * 4 + 2], lab);
        bOut += lab[2];
        n++;
      }
      if (lip[j] === 0) expect(out[j * 4 + 3]).toBe(0);
    }
    expect(n).toBeGreaterThan(500);
    // yellow teeth (b* ≈ 30) move clearly toward B1 (b* ≈ 10)
    expect(bOut / n).toBeLessThan(bIn / n - 8);
  });
});

describe("computePrep (synthetic masks)", () => {
  const scene = { img: null as unknown as CanvasImageSource, imgW: W, imgH: H, guides, lips, design: upper };

  it("existing teeth longer than the plan → incisal reduction", () => {
    const res = computePrep(scene, teethOf(upper, 8));
    const c = res.teeth.find((t) => t.label === "UR1")!;
    expect(c.lengthPx).toBeLessThan(-5);
    expect(["reduction", "mixed"]).toContain(c.category);
    expect(res.reduce.data.some((v) => v > 0)).toBe(true);
  });

  it("existing teeth shorter than the plan → additive", () => {
    // shorten the existing teeth: cut their incisal 10 px
    const ex = teethOf(upper);
    for (let y = 130; y < H; y++) for (let x = 0; x < W; x++) ex.data[y * W + x] = 0;
    const res = computePrep(scene, ex);
    const c = res.teeth.find((t) => t.label === "UL1")!;
    expect(c.lengthPx).toBeGreaterThan(6);
    expect(c.category).toBe("additive");
    expect(c.addPct).toBeGreaterThan(3);
    expect(res.add.data.some((v) => v > 0)).toBe(true);
  });

  it("identical outline → unchanged, ~100 % overlap; no tooth → unknown", () => {
    const ex = teethOf(upper);
    // remove the patient's left canine entirely
    const can = plannedOutlines(upper, 0).find((o) => o.box.kind === 2 && o.box.side === 1)!;
    const xs = can.pts.map((p) => p.x);
    for (let y = 0; y < H; y++) for (let x = Math.floor(Math.min(...xs)) - 1; x <= Math.ceil(Math.max(...xs)) + 1; x++) ex.data[y * W + x] = 0;
    const res = computePrep(scene, ex);
    const c = res.teeth.find((t) => t.label === "UR1")!;
    expect(c.category).toBe("unchanged");
    expect(c.overlapPct).toBeGreaterThan(95);
    expect(Math.abs(c.lengthPx)).toBeLessThan(2);
    expect(res.teeth.find((t) => t.label === "UL3")!.category).toBe("unknown");
    expect(res.teeth).toHaveLength(6);
  });

  it("narrower existing teeth → positive (additive) distal width on the outer teeth", () => {
    const res = computePrep(scene, teethOf({ ...upper, width: upper.width * 0.88 }));
    const c = res.teeth.find((t) => t.label === "UL1")!;
    expect(c.distalPx).toBeGreaterThan(2);
    expect(Math.abs(c.mesialPx)).toBeLessThan(2);
  });

  it("contours trace a closed outline around a mask blob", () => {
    const m = newMask(20, 20);
    for (let y = 5; y < 15; y++) for (let x = 4; x < 12; x++) m.data[y * 20 + x] = 255;
    const ls = contours(m);
    expect(ls.length).toBe(1);
    expect(ls[0].length / 2).toBeGreaterThan(30);
  });
});

describe("prepWording (docs/round3-clinical.md B/C)", () => {
  const ppm = 10; // 10 px per mm
  const base: ToothPrep = {
    kind: 0,
    side: -1,
    label: "UR1",
    lengthPx: 0,
    mesialPx: 0,
    distalPx: 0,
    overlapPct: 100,
    addPct: 0,
    reducePct: 0,
    category: "unchanged",
  };

  it("suppresses |Δ| < 0.3 mm as ≈ 0 and rounds to 0.1 mm with the photo tolerance", () => {
    expect(fmtMm(0.29)).toBe("≈ 0");
    expect(fmtMm(-0.29)).toBe("≈ 0");
    expect(fmtMm(0.3)).toBe("+0.3 mm");
    expect(fmtMm(1.24)).toBe("+1.2 mm");
    expect(fmtMm(-1.26)).toBe("−1.3 mm");
    const w = prepWording({ ...base, lengthPx: 12.4, category: "additive" }, ppm);
    expect(w.clinician[0]).toBe("Incisal length: +1.2 mm (add) ±0.5 mm (photo)");
    expect(w.clinician).toContain("Outline is additive in this view.");
    const z = prepWording({ ...base, lengthPx: 2.9 }, ppm);
    expect(z.clinician[0]).toContain("≈ 0");
  });

  it("warns above 2.0 mm incisal reduction and 0.5 mm proximal reduction, not at the threshold", () => {
    const big = "Large incisal change: check occlusion, length and pulp before planning.";
    const prox = "Proximal reduction: contact areas involved; consider alignment or IPR alternatives.";
    expect(prepWording({ ...base, lengthPx: -21, category: "reduction" }, ppm).clinician).toContain(big);
    expect(prepWording({ ...base, lengthPx: -20, category: "reduction" }, ppm).clinician).not.toContain(big);
    expect(prepWording({ ...base, mesialPx: -6, category: "reduction" }, ppm).clinician).toContain(prox);
    expect(prepWording({ ...base, distalPx: -5, category: "reduction" }, ppm).clinician).not.toContain(prox);
    // no mm thresholds without a calibration
    expect(prepWording({ ...base, lengthPx: -40, category: "reduction" }).clinician).not.toContain(big);
  });

  it("reduction names the sites; mixed and lower-incisor notes", () => {
    const r = prepWording({ ...base, lengthPx: -8, distalPx: -4, category: "reduction" }, ppm);
    expect(r.clinician).toContain("Outline reduction: tooth is outside the plan at the incisal and distal.");
    expect(prepWording({ ...base, category: "mixed" }, ppm).clinician).toContain("Mixed: additive and reduction areas.");
    const low = prepWording({ ...base, label: "LR1" }, ppm);
    expect(low.clinician).toContain("Thin enamel; additive or minimal approaches are usually explored first; clinician to decide.");
    expect(prepWording({ ...base, label: "LR3", kind: 2 }, ppm).clinician.join(" ")).not.toContain("Thin enamel");
  });

  it("patient line: plain words, rounded, no preparation vocabulary", () => {
    expect(prepWording({ ...base, lengthPx: 9.6, category: "additive" }, ppm).patient).toBe("Upper right central: design is longer by about 1 mm.");
    expect(prepWording({ ...base, kind: 2, side: 1, label: "UL3", lengthPx: -6 }, ppm).patient).toBe(
      "Upper left canine: design is shorter by about 0.5 mm.",
    );
    const banned = /prep|reduc|drill|remov|shav|grind|trim|cut|enamel|guarantee|painless|permanent|perfect|best|no-prep/i;
    for (const t of [
      { ...base, lengthPx: -25, mesialPx: -7, category: "reduction" as const },
      { ...base, lengthPx: 14, distalPx: 6, category: "additive" as const },
      { ...base, category: "unknown" as const },
      { ...base },
    ]) {
      expect(prepWording(t, ppm).patient).not.toMatch(banned);
      expect(prepWording(t).patient).not.toMatch(banned);
    }
  });

  it("exports the mandatory disclaimer verbatim and the enamel table", () => {
    expect(PREP_DISCLAIMER).toBe(
      "Planning aid only. Measured from a 2D photo: shows outline length and width differences (±0.5 mm), not facial depth or the amount of tooth to remove. Preparation depth must be planned on a mock-up, wax-up or silicone index and decided by the treating dentist. Enamel values are population averages, not this patient's.",
    );
    expect(ENAMEL_MM.lowerIncisor).toEqual([0.3, 0.5, 0.75]);
  });
});

describe("lower arch geometry", () => {
  const lower: Design = { ...upper, arch: "lower", wl: 0.62 };

  it("uses the lower proportions and no lateral step", () => {
    const b = toothBoxes(lower).filter((x) => x.side === 1);
    expect((b[1].x1 - b[1].x0) / (b[0].x1 - b[0].x0)).toBeCloseTo(PROPORTIONS_LOWER[1], 6);
    expect((b[2].x1 - b[2].x0) / (b[0].x1 - b[0].x0)).toBeCloseTo(PROPORTIONS_LOWER[2], 6);
    const span = Math.max(...toothBoxes(lower).map((x) => x.x1)) - Math.min(...toothBoxes(lower).map((x) => x.x0));
    expect(span).toBeCloseTo(lower.width, 6);
    expect(toothBoxes({ ...lower, lateralStep: 0.3 })).toEqual(toothBoxes({ ...lower, lateralStep: 0 }));
  });

  it("crowns extend DOWN the photo from the lower incisal line (mirrored frame)", () => {
    for (const o of plannedOutlines(lower, 0)) for (const p of o.pts) expect(p.y).toBeGreaterThan(lower.center.y - centralLength(lower) * 0.15);
    for (const o of plannedOutlines(upper, 0)) for (const p of o.pts) expect(p.y).toBeLessThan(upper.center.y + centralLength(upper) * 0.1);
    const h = designHandles(lower, 0);
    expect(h.length.y).toBeGreaterThan(lower.center.y);
    // toLocal inverts toImage in the mirrored frame (also with tilt)
    const p = { x: 13, y: -40 };
    const q = toLocal(toImage(p, lower, 0.2), lower, 0.2);
    expect(q.x).toBeCloseTo(p.x, 9);
    expect(q.y).toBeCloseTo(p.y, 9);
  });

  it("upper behaviour is unchanged when arch is unset or 'upper'", () => {
    expect(toothBoxes({ ...upper, arch: "upper" })).toEqual(toothBoxes(upper));
    expect(toImage({ x: 5, y: -30 }, upper, 0).y).toBeCloseTo(110, 9);
  });

  it("labels: arch letter + quadrant side + tooth number", () => {
    expect(toothLabel(upper, 0, -1)).toBe("UR1");
    expect(toothLabel(lower, 2, 1)).toBe("LL3");
  });

  it("lower shade is offset L* −2, b* +1 from the tab", () => {
    const u = shadeLab("A2", "upper");
    const l = shadeLab("A2", "lower");
    expect(l.body[0] - u.body[0]).toBeCloseTo(-2, 6);
    expect(l.body[2] - u.body[2]).toBeCloseTo(1, 6);
    // Lab round trip
    const lab = hexToLab("#DDCBA8");
    const rgb = [0, 0, 0];
    labToRgb(lab[0], lab[1], lab[2], rgb);
    expect(rgb.map(Math.round)).toEqual([0xdd, 0xcb, 0xa8]);
  });
});

describe("prep: opposing teeth hide part of the plan (round 6)", () => {
  // lower plan; the upper teeth cover the lower incisal third (normal overbite). Synthetic only.
  const bl: Pt[] = [];
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2;
    bl.push({ x: 200 + Math.cos(a) * 185, y: 140 + Math.sin(a) * 98 });
  }
  const low: Design = { ...upper, arch: "lower", center: { x: 200, y: 150 }, width: 190, wl: 0.62, arc: 0 };
  const Ll = centralLength(low);
  const upEdge = Math.round(150 + Ll * 0.3); // visible upper incisal edge, image y
  const inside = lipCoverage(bl, W, H, 1);
  const lowerMask = (from: number) => {
    const acc = new Float32Array(W * H);
    for (const o of plannedOutlines(low, 0)) rasterPolygon(acc, W, H, o.pts);
    const m = newMask(W, H);
    for (let i = 0; i < acc.length; i++) m.data[i] = acc[i] >= 0.5 && inside[i] >= 0.5 && Math.floor(i / W) >= from ? 255 : 0;
    return m;
  };
  /** joined automatic mask: visible lower teeth + upper teeth down to `edge`, a 2 px shadow line between */
  const joined = (edge: number) => {
    const m = lowerMask(edge + 2);
    for (let y = 60; y < edge; y++) for (let x = 95; x < 305; x++) if (inside[y * W + x] >= 0.5) m.data[y * W + x] = 255;
    return m;
  };
  const scene = { img: null as unknown as CanvasImageSource, imgW: W, imgH: H, guides, lips: bl, design: low };

  it("planned lower length behind the upper teeth is hidden, not added; length not reported", () => {
    const res = computePrep(scene, joined(upEdge));
    expect(res.hidden).toBeDefined();
    for (const lab of ["LR1", "LL1", "LR2", "LL2"]) {
      const t = res.teeth.find((x) => x.label === lab)!;
      expect(t.hiddenPct!).toBeGreaterThan(20);
      expect(t.lengthPx).toBe(0);
      expect(t.addPct).toBeLessThan(3);
      const w = prepWording(t, 10);
      expect(w.clinician[0]).toBe(HIDDEN_NOTE);
      expect(w.clinician.join(" ")).not.toMatch(/Incisal length/);
      expect(w.patient).not.toMatch(/longer|shorter/);
    }
    // nothing added inside the band between the planned edge and the upper teeth
    let addBand = 0;
    for (let y = 151; y < upEdge; y++) for (let x = 150; x < 250; x++) addBand += res.add.data[y * W + x] ? 1 : 0;
    expect(addBand).toBe(0);
    expect(HIDDEN_LEGEND).toBe("Hidden behind the upper teeth — not measurable");
  });

  it("a mask painted on the lower teeth only uses the photo: light, non-red pixels beyond the edge are the upper teeth", () => {
    const px = new Uint8ClampedArray(W * H * 4);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        let c = inside[i] < 0.5 ? [196, 96, 98] : y > 212 ? [205, 110, 115] : [40, 18, 20];
        if (y >= 60 && y < upEdge && x >= 95 && x < 305) c = [240, 238, 230]; // bright upper ceramic
        else if (y >= upEdge && y < upEdge + 2) c = [70, 60, 50]; // shadow under the upper edge
        px.set([c[0], c[1], c[2], 255], i * 4);
      }
    const m = lowerMask(upEdge + 2);
    for (let i = 0; i < W * H; i++) if (m.data[i]) px.set([214, 194, 140, 255], i * 4); // yellower lower teeth
    setPrepPhotoReader(() => ({ data: px, rx: 0, ry: 0, rw: W, rh: H }));
    try {
      const res = computePrep(scene, m);
      const c = res.teeth.find((x) => x.label === "LL1")!;
      expect(c.hiddenPct!).toBeGreaterThan(20);
      expect(c.lengthPx).toBe(0);
      expect(c.addPct).toBeLessThan(3);
    } finally {
      setPrepPhotoReader(null);
    }
  });

  it("an open space before the upper teeth stays measurable (added)", () => {
    // upper teeth end well above the planned lower edge: the lower teeth are short and visible, nothing hides them
    const m = lowerMask(upEdge + 2);
    for (let y = 60; y < 120; y++) for (let x = 95; x < 305; x++) if (inside[y * W + x] >= 0.5) m.data[y * W + x] = 255;
    const res = computePrep(scene, m);
    const c = res.teeth.find((x) => x.label === "LR1")!;
    expect(c.hiddenPct ?? 0).toBeLessThan(5);
    expect(c.lengthPx).toBeGreaterThan(5);
    expect(c.category).toBe("additive");
  });

  it("upper plan: the lower teeth behind the upper edge never hide it (normal overbite)", () => {
    const up = { ...upper, center: { x: 200, y: 130 } };
    const m = teethOf(up);
    for (let y = 131; y < 170; y++) for (let x = 120; x < 280; x++) m.data[y * W + x] = 255; // lower teeth below
    const res = computePrep({ img: null as unknown as CanvasImageSource, imgW: W, imgH: H, guides, lips, design: up }, m);
    expect(res.teeth.every((t) => (t.hiddenPct ?? 0) === 0)).toBe(true);
    expect(res.hidden).toBeUndefined();
  });

  it("hiddenPct is optional: old ToothPrep objects word exactly as before", () => {
    const t: ToothPrep = { kind: 0, side: -1, label: "LR1", lengthPx: 12, mesialPx: 0, distalPx: 0, overlapPct: 100, addPct: 5, reducePct: 0, category: "additive" };
    expect(prepWording(t, 10).clinician[0]).toBe("Incisal length: +1.2 mm (add) ±0.5 mm (photo)");
    expect(prepWording({ ...t, hiddenPct: 15 }, 10).clinician[0]).toBe("Incisal length: +1.2 mm (add) ±0.5 mm (photo)");
    expect(prepWording({ ...t, hiddenPct: 25 }, 10).clinician[0]).toBe(HIDDEN_NOTE);
  });
});
