// Reduction-estimate tests on synthetic meshes only (never patient scans).
import { describe, expect, it } from "vitest";
import { analyseWaxup, apply, archLength, MEAN_WIDTH, weld, type Mesh, type Rigid } from "../src/waxup";
import { DEFAULT_MATERIALS, enamelMid, mergeMaterials, reduction, reductionLine } from "../src/reduction";

/** UV ellipsoid as a triangle soup (outward winding). */
function ellipsoid(cx: number, cy: number, cz: number, rx: number, ry: number, rz: number, seg = 16): number[] {
  const P = (i: number, j: number) => {
    const th = (i / seg) * Math.PI, ph = (j / seg) * 2 * Math.PI;
    return [cx + rx * Math.sin(th) * Math.cos(ph), cy + ry * Math.sin(th) * Math.sin(ph), cz + rz * Math.cos(th)];
  };
  const out: number[] = [];
  for (let i = 0; i < seg; i++)
    for (let j = 0; j < seg; j++) {
      const a = P(i, j), b = P(i + 1, j), c = P(i + 1, j + 1), d = P(i, j + 1);
      out.push(...a, ...b, ...c, ...a, ...c, ...d);
    }
  return out;
}

/** A lower arch of 14 egg-shaped teeth on a parabola; `grow` mm added to the six front teeth. */
function arch(grow = 0): Mesh {
  const w = MEAN_WIDTH.lower.slice(0, 7);
  const soup: number[] = [];
  const a = -0.02;
  for (const side of [-1, 1]) {
    let s = 0;
    for (let k = 0; k < 7; k++) {
      const centreS = s + w[k] / 2;
      s += w[k];
      // walk the parabola to arc length centreS
      let x = 0;
      while (archLength({ a, b: 0 }, x) < centreS) x += 0.02;
      x *= side;
      const y = a * x * x;
      const g = k < 3 ? grow : 0;
      soup.push(...ellipsoid(x, y, 0, w[k] / 2 - 0.3 + g, 3 + g, 4 + g));
    }
  }
  return weld(Float32Array.from(soup));
}

const ROT: Rigid = (() => {
  const c = Math.cos(0.25), s = Math.sin(0.25);
  return { R: [1, 0, 0, 0, c, -s, 0, s, c], t: [4, -3, 7] };
})();

function moved(m: Mesh, T: Rigid): Mesh {
  const pos = new Float32Array(m.pos.length);
  for (let i = 0; i < m.pos.length; i += 3) pos.set(apply(T, m.pos[i], m.pos[i + 1], m.pos[i + 2]), i);
  return { pos, idx: m.idx };
}


const original = arch();
const front = [31, 32, 33, 41, 42, 43];
const veneer = Object.fromEntries(front.map((f) => [f, "veneer-ld"]));
const run = (grow: number, choice: Record<number, string>) => {
  const wax = moved(arch(grow), ROT);
  const { th } = analyseWaxup(original, wax);
  return reduction(th, wax, "lower", choice, DEFAULT_MATERIALS);
};

describe("reduction estimate", () => {
  it("estimates nothing until the dentist picks a material", () => {
    const r = run(0.3, {});
    expect(r.teeth).toEqual([]);
    expect(Array.from(r.prep).every((x) => Number.isNaN(x))).toBe(true);
  });
  it("veneer 0.5 facial over a 0.3 mm wax-up layer needs about 0.2 mm facial reduction", () => {
    const r = run(0.3, veneer);
    expect(r.teeth.map((t) => t.fdi).sort()).toEqual(front.slice().sort());
    const fac = r.teeth.find((t) => t.fdi === 31)!.surfaces.find((s) => s.surface === "facial")!;
    expect(fac.min).toBe(0.5);
    expect(fac.typical).toBeGreaterThanOrEqual(0.1);
    expect(fac.typical).toBeLessThanOrEqual(0.3);
  });
  it("a wax-up thicker than the material minimum needs no facial reduction", () => {
    const r = run(0.8, veneer);
    const fac = r.teeth.find((t) => t.fdi === 41)!.surfaces.find((s) => s.surface === "facial")!;
    expect(fac.typical).toBe(0);
    expect(reductionLine(r.teeth.find((t) => t.fdi === 41)!)).toMatch(/facial none/);
  });
  it("veneers leave the lingual side out; crowns include it", () => {
    const v = run(0.3, veneer).teeth.find((t) => t.fdi === 32)!;
    expect(v.surfaces.some((s) => s.surface === "lingual")).toBe(false);
    const c = run(0.3, { 32: "crown-ld" }).teeth.find((t) => t.fdi === 32)!;
    const lin = c.surfaces.find((s) => s.surface === "lingual")!;
    expect(lin.typical).toBeGreaterThan(0.5);
  });
  it("additive only: no reduction where the wax-up only adds", () => {
    const r = run(0.3, { 31: "additive" });
    const t = r.teeth[0];
    expect(t.surfaces.every((s) => s.deep === 0)).toBe(true);
  });
  it("flags estimates deeper than typical enamel on lower incisors", () => {
    const t = run(0.1, { 41: "crown-ld" }).teeth.find((x) => x.fdi === 41)!;
    expect(t.enamelNote ?? t.note).toBeTruthy();
    expect(enamelMid(41)).toBe(0.5);
    expect(enamelMid(14)).toBeUndefined();
  });
  it("teeth the wax-up does not change are not estimated", () => {
    const t = run(0.3, { 36: "crown-zr" }).teeth[0];
    expect(t.surfaces).toEqual([]);
    expect(t.note).toMatch(/margin is unknown/);
  });
  it("merges saved thickness edits and ignores bad values", () => {
    const m = mergeMaterials([{ id: "veneer-ld", facial: 0.6, edge: "x" }, { id: "nope", facial: 1 }, null]);
    const v = m.find((x) => x.id === "veneer-ld")!;
    expect(v.facial).toBe(0.6);
    expect(v.edge).toBe(1.0);
    expect(m.length).toBe(DEFAULT_MATERIALS.length);
    expect(mergeMaterials("garbage")).toEqual(DEFAULT_MATERIALS);
  });
});
