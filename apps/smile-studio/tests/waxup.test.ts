// Wax-up engine tests on synthetic meshes only (never patient scans).
import { describe, expect, it } from "vitest";
import { align, analyseWaxup, apply, archLength, changedTeeth, kabsch, MEAN_WIDTH, parseStl, perTooth, toothLine, weld, type Mesh, type Rigid } from "../src/waxup";

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

function binaryStl(m: Mesh): ArrayBuffer {
  const n = m.idx.length / 3;
  const buf = new ArrayBuffer(84 + n * 50);
  const dv = new DataView(buf);
  dv.setUint32(80, n, true);
  for (let t = 0; t < n; t++)
    for (let k = 0; k < 3; k++)
      for (let c = 0; c < 3; c++) dv.setFloat32(84 + t * 50 + 12 + k * 12 + c * 4, m.pos[m.idx[t * 3 + k] * 3 + c], true);
  return buf;
}

describe("STL", () => {
  it("reads binary STL and welds shared corners", () => {
    const m = arch();
    const back = parseStl(binaryStl(m));
    expect(back.pos.length).toBe(m.pos.length);
    expect(back.idx.length).toBe(m.idx.length);
  });
  it("reads ASCII STL", () => {
    const txt = "solid t\nfacet normal 0 0 1\nouter loop\nvertex 0 0 0\nvertex 1 0 0\nvertex 0 1 0\nendloop\nendfacet\nendsolid t\n";
    const m = parseStl(new TextEncoder().encode(txt).buffer as ArrayBuffer);
    expect(m.idx.length).toBe(3);
    expect(m.pos.length).toBe(9);
  });
  it("refuses a file that is not a mesh", () => {
    expect(() => parseStl(new TextEncoder().encode("hello").buffer as ArrayBuffer)).toThrow(/not an STL/);
  });
});

describe("alignment", () => {
  it("Kabsch recovers a known rigid motion", () => {
    const P = [0, 0, 0, 1, 0, 0, 0, 2, 0, 0, 0, 3, 1, 1, 1];
    const Q = P.flatMap((_, i) => (i % 3 === 0 ? apply(ROT, P[i], P[i + 1], P[i + 2]) : [])).flat();
    const T = kabsch(P, Q);
    for (let k = 0; k < 9; k++) expect(T.R[k]).toBeCloseTo(ROT.R[k], 6);
    for (let k = 0; k < 3; k++) expect(T.t[k]).toBeCloseTo(ROT.t[k], 6);
  });
  it("puts a moved wax-up back on the original, ignoring the changed teeth", () => {
    const original = arch();
    const wax = moved(arch(0.6), ROT);
    const r = align(original, wax);
    expect(r.fit).toBeLessThan(0.05);
    expect(r.close).toBeGreaterThan(0.4);
  });
});

describe("thickness and per-tooth changes", () => {
  const original = arch();
  const wax = moved(arch(0.6), ROT);
  const { th } = analyseWaxup(original, wax);
  it("measures the added layer in mm and leaves the rest unchanged", () => {
    const v = Array.from(th.d).filter((x) => !Number.isNaN(x));
    const added = v.filter((x) => x > 0.1);
    expect(added.length / v.length).toBeGreaterThan(0.25);
    expect(added.length / v.length).toBeLessThan(0.6);
    const med = added.sort((a, b) => a - b)[Math.floor(added.length / 2)];
    expect(med).toBeGreaterThan(0.4);
    expect(med).toBeLessThan(0.9);
    expect(v.filter((x) => x < -0.1).length).toBe(0);
  });
  it("lists the six front teeth as changed, with estimated tooth numbers", () => {
    const teeth = perTooth(th, original, wax, "lower");
    const changed = changedTeeth(teeth).map((t) => t.fdi).sort();
    expect(changed).toEqual([31, 32, 33, 41, 42, 43]);
    const t31 = teeth.find((t) => t.fdi === 31)!;
    expect(t31.facialAdd).toBeGreaterThan(0.3);
    expect(toothLine(t31)).toMatch(/facial \+0\.\d/);
  });
  it("swaps sides when flipped", () => {
    const a = perTooth(th, original, wax, "lower").map((t) => t.fdi);
    const b = perTooth(th, original, wax, "lower", { flip: true }).map((t) => t.fdi);
    expect(new Set(a)).toEqual(new Set(b));
    expect(b[0]).toBe(a[0]); // sorted chart order stays right → left
  });
});
