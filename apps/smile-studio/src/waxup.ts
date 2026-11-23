// Wax-up engine: compares the lab's digital wax-up (STL) with the patient's original scan (STL), on the device.
// Nothing here touches the network. Units are millimetres (STL files from scanners / exocad are in mm).
//
// Steps: parse + weld → align the wax-up onto the original (PCA starts + trimmed ICP on the unchanged areas)
// → signed distance of every wax-up vertex to the original surface (+ = material added, − = tooth to reduce)
// → per-tooth summary along the arch (tooth numbers are estimated from mean tooth widths; the dentist can shift them).

export interface Mesh {
  /** welded vertex positions xyz… */
  pos: Float32Array;
  /** triangles (3 vertex indices each) */
  idx: Uint32Array;
}

/** Row-major 3×3 rotation + translation: p' = R p + t */
export interface Rigid {
  R: number[];
  t: [number, number, number];
}

export const IDENTITY: Rigid = { R: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [0, 0, 0] };

// ---------- STL ----------

/** Parses a binary or ASCII STL and welds shared corners. Throws a readable error for anything else. */
export function parseStl(buf: ArrayBuffer): Mesh {
  const dv = new DataView(buf);
  let tris: Float32Array;
  const n = buf.byteLength >= 84 ? dv.getUint32(80, true) : 0;
  if (buf.byteLength >= 84 && 84 + n * 50 === buf.byteLength && n > 0) {
    tris = new Float32Array(n * 9);
    for (let i = 0; i < n; i++) {
      const o = 84 + i * 50 + 12;
      for (let k = 0; k < 9; k++) tris[i * 9 + k] = dv.getFloat32(o + k * 4, true);
    }
  } else {
    const text = new TextDecoder().decode(new Uint8Array(buf, 0, Math.min(buf.byteLength, 1 << 28)));
    if (!/^\s*solid/i.test(text) || !/vertex/i.test(text)) throw new Error("This file is not an STL mesh.");
    const re = /vertex\s+(\S+)\s+(\S+)\s+(\S+)/gi;
    const v: number[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) v.push(+m[1], +m[2], +m[3]);
    if (v.length < 9 || v.length % 9 !== 0 || v.some((x) => !Number.isFinite(x))) throw new Error("This STL file is damaged.");
    tris = Float32Array.from(v);
  }
  return weld(tris);
}

/** Merges corners closer than 0.1 µm (STL repeats each corner for every triangle). */
export function weld(tris: Float32Array): Mesh {
  const nv = tris.length / 3;
  const map = new Map<string, number>();
  const pos: number[] = [];
  const idx = new Uint32Array(nv);
  for (let i = 0; i < nv; i++) {
    const x = tris[i * 3], y = tris[i * 3 + 1], z = tris[i * 3 + 2];
    const key = `${Math.round(x * 1e4)},${Math.round(y * 1e4)},${Math.round(z * 1e4)}`;
    let j = map.get(key);
    if (j === undefined) {
      j = pos.length / 3;
      map.set(key, j);
      pos.push(x, y, z);
    }
    idx[i] = j;
  }
  // drop degenerate triangles
  const keep: number[] = [];
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t], b = idx[t + 1], c = idx[t + 2];
    if (a !== b && b !== c && a !== c) keep.push(a, b, c);
  }
  return { pos: Float32Array.from(pos), idx: Uint32Array.from(keep) };
}

/** Area-weighted vertex normals (follow the file's triangle winding, outward for scanner / CAD exports). */
export function vertexNormals(m: Mesh): Float32Array {
  const n = new Float32Array(m.pos.length);
  const p = m.pos;
  for (let t = 0; t < m.idx.length; t += 3) {
    const a = m.idx[t] * 3, b = m.idx[t + 1] * 3, c = m.idx[t + 2] * 3;
    const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2];
    const vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
    const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx; // |c| = 2 × area
    for (const k of [a, b, c]) {
      n[k] += cx;
      n[k + 1] += cy;
      n[k + 2] += cz;
    }
  }
  for (let i = 0; i < n.length; i += 3) {
    const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1;
    n[i] /= l;
    n[i + 1] /= l;
    n[i + 2] /= l;
  }
  return n;
}

/** Vertices on an open edge (an edge used by one triangle): the trimmed rim of a scan or model. */
export function rimVertices(m: Mesh): number[] {
  const count = new Map<number, number>();
  const nv = m.pos.length / 3;
  const key = (a: number, b: number) => (a < b ? a * nv + b : b * nv + a);
  for (let t = 0; t < m.idx.length; t += 3)
    for (let e = 0; e < 3; e++) {
      const k = key(m.idx[t + e], m.idx[t + ((e + 1) % 3)]);
      count.set(k, (count.get(k) ?? 0) + 1);
    }
  const out = new Set<number>();
  for (const [k, c] of count)
    if (c === 1) {
      out.add(Math.floor(k / nv));
      out.add(k % nv);
    }
  return [...out];
}

// ---------- nearest-neighbour grid ----------

/** Uniform hash grid over points for nearest-point queries. */
export class Grid {
  private cell: number;
  private pts: ArrayLike<number>;
  private cells = new Map<number, number[]>();
  constructor(pts: ArrayLike<number>, cell = 1, ids?: number[]) {
    this.pts = pts;
    this.cell = cell;
    const list = ids ?? Array.from({ length: pts.length / 3 }, (_, i) => i);
    for (const i of list) {
      const k = this.key(Math.floor(pts[i * 3] / cell), Math.floor(pts[i * 3 + 1] / cell), Math.floor(pts[i * 3 + 2] / cell));
      const c = this.cells.get(k);
      if (c) c.push(i);
      else this.cells.set(k, [i]);
    }
  }
  private key(i: number, j: number, k: number) {
    return ((i + 512) * 1024 + (j + 512)) * 1024 + (k + 512);
  }
  /** Index of the nearest point within maxDist (mm), or -1. Second value: the distance. */
  nearest(x: number, y: number, z: number, maxDist: number): [number, number] {
    const c = this.cell;
    const ci = Math.floor(x / c), cj = Math.floor(y / c), ck = Math.floor(z / c);
    const R = Math.ceil(maxDist / c);
    let best = -1;
    let bd = maxDist * maxDist;
    const p = this.pts;
    for (let r = 0; r <= R; r++) {
      for (let i = ci - r; i <= ci + r; i++)
        for (let j = cj - r; j <= cj + r; j++) {
          const edge = i === ci - r || i === ci + r || j === cj - r || j === cj + r;
          const step = edge ? 1 : 2 * r || 1;
          for (let k = ck - r; k <= ck + r; k += step) {
            const list = this.cells.get(this.key(i, j, k));
            if (!list) continue;
            for (const q of list) {
              const dx = p[q * 3] - x, dy = p[q * 3 + 1] - y, dz = p[q * 3 + 2] - z;
              const d = dx * dx + dy * dy + dz * dz;
              if (d < bd) {
                bd = d;
                best = q;
              }
            }
          }
        }
      // everything in later rings is at least r·cell away
      if (best >= 0 && bd <= (r * c) * (r * c)) break;
    }
    return [best, best >= 0 ? Math.sqrt(bd) : Infinity];
  }
}

// ---------- small linear algebra ----------

/** Eigen-decomposition of a symmetric n×n matrix (Jacobi). Returns values (descending) and column vectors. */
export function eigSym(A: number[][]): { values: number[]; vectors: number[][] } {
  const n = A.length;
  const a = A.map((r) => r.slice());
  const v: number[][] = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
  for (let sweep = 0; sweep < 60; sweep++) {
    let off = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += a[i][j] * a[i][j];
    if (off < 1e-22) break;
    for (let p = 0; p < n; p++)
      for (let q = p + 1; q < n; q++) {
        if (Math.abs(a[p][q]) < 1e-300) continue;
        const th = (a[q][q] - a[p][p]) / (2 * a[p][q]);
        const t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1));
        const cs = 1 / Math.sqrt(t * t + 1), sn = t * cs;
        for (let k = 0; k < n; k++) {
          const akp = a[k][p], akq = a[k][q];
          a[k][p] = cs * akp - sn * akq;
          a[k][q] = sn * akp + cs * akq;
        }
        for (let k = 0; k < n; k++) {
          const apk = a[p][k], aqk = a[q][k];
          a[p][k] = cs * apk - sn * aqk;
          a[q][k] = sn * apk + cs * aqk;
        }
        for (let k = 0; k < n; k++) {
          const vkp = v[k][p], vkq = v[k][q];
          v[k][p] = cs * vkp - sn * vkq;
          v[k][q] = sn * vkp + cs * vkq;
        }
      }
  }
  const order = Array.from({ length: n }, (_, i) => i).sort((i, j) => a[j][j] - a[i][i]);
  return { values: order.map((i) => a[i][i]), vectors: order.map((i) => v.map((r) => r[i])) };
}

/** Best rotation + translation taking points P onto Q (Horn's quaternion method). */
export function kabsch(P: number[], Q: number[]): Rigid {
  const n = P.length / 3;
  const cp = [0, 0, 0], cq = [0, 0, 0];
  for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) {
    cp[k] += P[i * 3 + k] / n;
    cq[k] += Q[i * 3 + k] / n;
  }
  const S = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (let i = 0; i < n; i++)
    for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) S[a * 3 + b] += (P[i * 3 + a] - cp[a]) * (Q[i * 3 + b] - cq[b]);
  const [xx, xy, xz, yx, yy, yz, zx, zy, zz] = S;
  const N = [
    [xx + yy + zz, yz - zy, zx - xz, xy - yx],
    [yz - zy, xx - yy - zz, xy + yx, zx + xz],
    [zx - xz, xy + yx, -xx + yy - zz, yz + zy],
    [xy - yx, zx + xz, yz + zy, -xx - yy + zz],
  ];
  const [w, x, y, z] = eigSym(N).vectors[0];
  const R = [
    w * w + x * x - y * y - z * z, 2 * (x * y - w * z), 2 * (x * z + w * y),
    2 * (x * y + w * z), w * w - x * x + y * y - z * z, 2 * (y * z - w * x),
    2 * (x * z - w * y), 2 * (y * z + w * x), w * w - x * x - y * y + z * z,
  ];
  const t: [number, number, number] = [0, 1, 2].map((k) => cq[k] - (R[k * 3] * cp[0] + R[k * 3 + 1] * cp[1] + R[k * 3 + 2] * cp[2])) as [number, number, number];
  return { R, t };
}

export function apply(T: Rigid, x: number, y: number, z: number): [number, number, number] {
  const R = T.R;
  return [R[0] * x + R[1] * y + R[2] * z + T.t[0], R[3] * x + R[4] * y + R[5] * z + T.t[1], R[6] * x + R[7] * y + R[8] * z + T.t[2]];
}

/** A then B */
export function compose(B: Rigid, A: Rigid): Rigid {
  const R: number[] = [];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) R.push(B.R[i * 3] * A.R[j] + B.R[i * 3 + 1] * A.R[3 + j] + B.R[i * 3 + 2] * A.R[6 + j]);
  const t = apply(B, ...A.t);
  return { R, t };
}

/** Centroid and principal axes (rows, largest spread first) of a point set. */
export function pca(pts: ArrayLike<number>, ids?: number[]) {
  const list = ids ?? Array.from({ length: pts.length / 3 }, (_, i) => i);
  const c = [0, 0, 0];
  for (const i of list) for (let k = 0; k < 3; k++) c[k] += pts[i * 3 + k] / list.length;
  const C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const i of list) {
    const d = [pts[i * 3] - c[0], pts[i * 3 + 1] - c[1], pts[i * 3 + 2] - c[2]];
    for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) C[a][b] += (d[a] * d[b]) / list.length;
  }
  const e = eigSym(C);
  const ax = e.vectors.map((v) => v.slice());
  // right-handed
  const [a, b] = ax;
  ax[2] = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  return { c, axes: ax, spread: e.values };
}

// ---------- alignment ----------

/** Deterministic pseudo-random sample of vertex indices. */
export function sample(nv: number, count: number, seed = 7): number[] {
  if (nv <= count) return Array.from({ length: nv }, (_, i) => i);
  let s = seed >>> 0;
  const out: number[] = [];
  const seen = new Set<number>();
  while (out.length < count) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const i = s % nv;
    if (!seen.has(i)) {
      seen.add(i);
      out.push(i);
    }
  }
  return out;
}

export interface AlignResult {
  T: Rigid;
  /** median distance of the kept (unchanged) half, mm */
  fit: number;
  /** share of sampled wax-up points that sit within 0.1 mm of the original */
  close: number;
}

/**
 * Finds where the wax-up sits on the original scan. The wax-up only changes some teeth, so ICP keeps the closest
 * 60 % of pairs (the unchanged teeth and gums) and ignores the rest. Several starts (as-is, and principal axes with
 * each sign) are tried; the tightest wins.
 */
export function align(original: Mesh, waxup: Mesh, opts: { samples?: number; iters?: number; grid?: Grid } = {}): AlignResult {
  const grid = opts.grid ?? new Grid(original.pos, 1);
  const ids = sample(waxup.pos.length / 3, opts.samples ?? 2500);
  const W = waxup.pos;
  const po = pca(original.pos, sample(original.pos.length / 3, 20000, 3));
  const pw = pca(W, sample(W.length / 3, 20000, 5));
  const starts: Rigid[] = [];
  const toFrame = (axes: number[][], c: number[]): Rigid => {
    const R = axes.flat();
    return { R, t: [0, 1, 2].map((k) => -(R[k * 3] * c[0] + R[k * 3 + 1] * c[1] + R[k * 3 + 2] * c[2])) as [number, number, number] };
  };
  const fromFrame = (axes: number[][], c: number[]): Rigid => {
    const R = [axes[0][0], axes[1][0], axes[2][0], axes[0][1], axes[1][1], axes[2][1], axes[0][2], axes[1][2], axes[2][2]];
    return { R, t: [c[0], c[1], c[2]] };
  };
  // as-is, centroids matched
  starts.push({ R: IDENTITY.R.slice(), t: [po.c[0] - pw.c[0], po.c[1] - pw.c[1], po.c[2] - pw.c[2]] });
  // principal axes, 4 proper sign flips
  for (const [s0, s1] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const ax = [pw.axes[0].map((v) => v * s0), pw.axes[1].map((v) => v * s1), pw.axes[2].map((v) => v * s0 * s1)];
    starts.push(compose(fromFrame(po.axes, po.c), toFrame(ax, pw.c)));
  }
  const iters = opts.iters ?? 40;
  let best: AlignResult | null = null;
  for (const T0 of starts) {
    let T = T0;
    let fit = Infinity;
    let close = 0;
    for (let it = 0; it < iters; it++) {
      const maxD = it < 6 ? 8 : it < 15 ? 3 : 1.5;
      const pairs: { d: number; p: number[]; q: number[] }[] = [];
      for (const i of ids) {
        const p = apply(T, W[i * 3], W[i * 3 + 1], W[i * 3 + 2]);
        const [j, d] = grid.nearest(p[0], p[1], p[2], maxD);
        if (j >= 0) pairs.push({ d, p, q: [original.pos[j * 3], original.pos[j * 3 + 1], original.pos[j * 3 + 2]] });
      }
      if (pairs.length < 12) break;
      pairs.sort((a, b) => a.d - b.d);
      const keep = pairs.slice(0, Math.max(12, Math.floor(pairs.length * (it < 5 ? 0.9 : 0.6))));
      fit = keep[Math.floor(keep.length / 2)].d;
      close = pairs.filter((x) => x.d < 0.1).length / ids.length;
      const D = kabsch(keep.flatMap((x) => x.p), keep.flatMap((x) => x.q));
      T = compose(D, T);
    }
    if (Number.isFinite(fit) && (!best || fit < best.fit - 1e-4 || (Math.abs(fit - best.fit) < 1e-4 && close > best.close))) best = { T, fit, close };
    // a near-perfect start needs no other tries
    if (best && best.fit < 0.08 && best.close > 0.3) break;
  }
  if (!best) throw new Error("The two scans do not overlap. Check that both files are the same jaw.");
  return best;
}

// ---------- thickness ----------

/** Typical mesio-distal crown widths, mm (central → second molar). Used only to place estimated tooth numbers. */
export const MEAN_WIDTH = {
  upper: [8.6, 6.6, 7.6, 7.0, 6.7, 10.2, 9.3],
  lower: [5.4, 5.9, 6.9, 7.0, 7.1, 11.2, 10.5],
} as const;

export type WaxArch = "upper" | "lower";

export interface Thickness {
  /** signed mm per wax-up vertex; NaN = not compared (base, trimmed rim, no original nearby) */
  d: Float32Array;
  /** wax-up vertex positions moved into the original's space */
  pos: Float32Array;
  /** original-scan frame: centre, width axis, depth axis (towards the lips), occlusal axis (towards the opposing jaw) */
  frame: { c: number[]; w: number[]; f: number[]; o: number[] };
  /** arch curve in the frame: depth = a·w² + b·w + k (occlusal view) */
  arch: { a: number; b: number; k: number };
  compared: number;
  added: number;
  reduced: number;
  /** estimated midline, as arch length from the apex (mm); "changes" = centre of the changed span, "arch" = apex */
  mid: number;
  midFrom: "changes" | "arch";
}

/** below this the wax-up is treated as "same as the scan" (scanner + print accuracy) */
export const SAME_MM = 0.1;
/** further than this from the original = not the same surface (model base, trimmed areas) */
export const FAR_MM = 3;

export function thickness(original: Mesh, waxup: Mesh, T: Rigid, opts: { grid?: Grid } = {}): Thickness {
  const grid = opts.grid ?? new Grid(original.pos, 1);
  const on = vertexNormals(original);
  const wn = vertexNormals(waxup);
  const R = T.R;
  const rim = rimVertices(original);
  const rimGrid = new Grid(original.pos, 1, rim);
  const nv = waxup.pos.length / 3;
  const pos = new Float32Array(nv * 3);
  const d = new Float32Array(nv).fill(NaN);
  let compared = 0, added = 0, reduced = 0;
  const O = original.pos;
  for (let i = 0; i < nv; i++) {
    const p = apply(T, waxup.pos[i * 3], waxup.pos[i * 3 + 1], waxup.pos[i * 3 + 2]);
    pos[i * 3] = p[0];
    pos[i * 3 + 1] = p[1];
    pos[i * 3 + 2] = p[2];
    const [j] = grid.nearest(p[0], p[1], p[2], FAR_MM);
    if (j < 0) continue;
    if (rim.length && rimGrid.nearest(p[0], p[1], p[2], 1.2)[0] >= 0) continue; // trimmed edge of the scan
    // the same surface faces the same way; the model's base or inner walls face elsewhere
    const nx = wn[i * 3], ny = wn[i * 3 + 1], nz = wn[i * 3 + 2];
    const facing =
      (R[0] * nx + R[1] * ny + R[2] * nz) * on[j * 3] + (R[3] * nx + R[4] * ny + R[5] * nz) * on[j * 3 + 1] + (R[6] * nx + R[7] * ny + R[8] * nz) * on[j * 3 + 2];
    if (facing < 0.2) continue;
    const s = (p[0] - O[j * 3]) * on[j * 3] + (p[1] - O[j * 3 + 1]) * on[j * 3 + 1] + (p[2] - O[j * 3 + 2]) * on[j * 3 + 2];
    d[i] = s;
    compared++;
    if (s > SAME_MM) added++;
    else if (s < -SAME_MM) reduced++;
  }
  // frame of the original scan
  const pc = pca(O, sample(O.length / 3, 30000, 11));
  let w = pc.axes[0];
  if (w[0] < 0) w = w.map((v) => -v);
  let o = pc.axes[2];
  // occlusal points away from the trimmed rim (gum / base side); with no rim, towards the added material
  const side = (pts: number[], from: Float32Array) => {
    let m = 0;
    for (const r of pts) m += (from[r * 3] - pc.c[0]) * o[0] + (from[r * 3 + 1] - pc.c[1]) * o[1] + (from[r * 3 + 2] - pc.c[2]) * o[2];
    return pts.length ? m / pts.length : 0;
  };
  if (rim.length) {
    if (side(rim, O) > 0) o = o.map((v) => -v);
  } else {
    const addIds: number[] = [];
    for (let i = 0; i < nv; i++) if (d[i] > SAME_MM) addIds.push(i);
    if (side(addIds, pos) < 0) o = o.map((v) => -v);
  }
  let f = [o[1] * w[2] - o[2] * w[1], o[2] * w[0] - o[0] * w[2], o[0] * w[1] - o[1] * w[0]];
  // arch: fit depth = a w² + b w + k over the original; the front teeth are where the parabola peaks
  const ids = sample(O.length / 3, 20000, 13);
  const loc = (x: number, y: number, z: number) => {
    const dx = x - pc.c[0], dy = y - pc.c[1], dz = z - pc.c[2];
    return [dx * w[0] + dy * w[1] + dz * w[2], dx * f[0] + dy * f[1] + dz * f[2], dx * o[0] + dy * o[1] + dz * o[2]];
  };
  let arch = fitParabola(ids.map((i) => loc(O[i * 3], O[i * 3 + 1], O[i * 3 + 2])));
  if (arch.a > 0) {
    // the arch opens towards +depth: flip depth so +depth points to the lips
    f = f.map((v) => -v);
    w = w.map((v) => -v);
    arch = fitParabola(ids.map((i) => loc(O[i * 3], O[i * 3 + 1], O[i * 3 + 2])));
  }
  // midline: a wax-up of several front teeth is usually symmetric, so the centre of the changed span is a better
  // estimate than the arch apex (scans are often trimmed unevenly). Short spans keep the apex.
  const sAdd: number[] = [];
  for (let i = 0; i < nv; i++) {
    if (!(d[i] > SAME_MM)) continue;
    const dx = pos[i * 3] - pc.c[0], dy = pos[i * 3 + 1] - pc.c[1], dz = pos[i * 3 + 2] - pc.c[2];
    sAdd.push(archLength(arch, dx * w[0] + dy * w[1] + dz * w[2]));
  }
  let mid = 0;
  let midFrom: "changes" | "arch" = "arch";
  if (sAdd.length > 200) {
    sAdd.sort((a, b) => a - b);
    const lo = sAdd[Math.floor(sAdd.length * 0.05)], hi = sAdd[Math.floor(sAdd.length * 0.95)];
    if (hi - lo >= 20) {
      mid = round1((lo + hi) / 2);
      midFrom = "changes";
    }
  }
  return { d, pos, frame: { c: pc.c, w, f, o }, arch, compared, added, reduced, mid, midFrom };
}

function fitParabola(pts: number[][]) {
  // least squares on (w², w, 1)
  const M = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  const r = [0, 0, 0];
  for (const [x, y] of pts) {
    const v = [x * x, x, 1];
    for (let i = 0; i < 3; i++) {
      r[i] += v[i] * y;
      for (let j = 0; j < 3; j++) M[i][j] += v[i] * v[j];
    }
  }
  const s = solve3(M, r);
  return { a: s[0], b: s[1], k: s[2] };
}

function solve3(M: number[][], r: number[]) {
  const det = (m: number[][]) =>
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const D = det(M) || 1e-12;
  return [0, 1, 2].map((c) => det(M.map((row, i) => row.map((v, j) => (j === c ? r[i] : v)))) / D);
}

/** Arc length along the arch from its apex to width position x (signed). */
export function archLength(arch: { a: number; b: number }, x: number) {
  const x0 = -arch.b / (2 * arch.a || 1e-9);
  // ∫ sqrt(1 + (2a(u-x0))²) du, u from x0 to x  (closed form)
  const g = (u: number) => {
    const s = 2 * arch.a * (u - x0);
    return (s * Math.sqrt(1 + s * s) + Math.asinh(s)) / (4 * arch.a || 1e-9);
  };
  return g(x) - g(x0);
}

export interface ToothChange {
  fdi: number;
  /** points compared in this tooth's slice */
  n: number;
  /** share of the slice changed by more than SAME_MM */
  changedPct: number;
  /** 90th percentile of added material on the facial (lip / cheek) side, mm */
  facialAdd: number;
  /** 90th percentile added on the incisal edge / occlusal surface, mm */
  edgeAdd: number;
  /** 90th percentile added on the tongue side, mm */
  lingualAdd: number;
  /** deepest reduction (10th percentile of negatives), mm, ≤ 0 */
  reduce: number;
  /** change in crown height (highest wax-up point − highest original point along the occlusal axis), mm */
  lengthen: number;
}

/**
 * Per-tooth summary. Teeth are slices along the arch from the midline (apex + shift), using mean widths:
 * an estimate to read the numbers by, not a segmentation. Left/right comes from the scan's geometry; `flip` swaps it
 * (for a mirrored export).
 */
export function perTooth(
  th: Thickness,
  original: Mesh,
  waxup: Mesh,
  arch: WaxArch,
  /** shift: mm added to the estimated midline (dentist's correction) */
  opts: { shift?: number; flip?: boolean } = {},
): ToothChange[] {
  const { c, w, f, o } = th.frame;
  const shift = th.mid + (opts.shift ?? 0);
  const widths = MEAN_WIDTH[arch];
  const bounds = [0];
  for (const x of widths) bounds.push(bounds[bounds.length - 1] + x);
  const slot = (x: number, y: number, z: number) => {
    const dx = x - c[0], dy = y - c[1], dz = z - c[2];
    const lw = dx * w[0] + dy * w[1] + dz * w[2];
    const s = archLength(th.arch, lw) - shift;
    // patient's left = occlusal × anterior: −w for a lower jaw (occlusal up), +w for an upper jaw (occlusal down)
    const left = arch === "lower" ? s < 0 : s >= 0;
    const side = left !== !!opts.flip ? 1 : -1; // +1 = patient's left
    const a = Math.abs(s);
    for (let k = 0; k < widths.length; k++) if (a < bounds[k + 1]) return { tooth: k, side, h: dx * o[0] + dy * o[1] + dz * o[2], lw };
    return null;
  };
  const quadrant = (side: number) => (arch === "upper" ? (side > 0 ? 2 : 1) : side > 0 ? 3 : 4);
  type Acc = { n: number; ch: number; fac: number[]; edge: number[]; lin: number[]; red: number[]; hw: number; ho: number };
  const acc = new Map<number, Acc>();
  const get = (fdi: number) => {
    let a = acc.get(fdi);
    if (!a) acc.set(fdi, (a = { n: 0, ch: 0, fac: [], edge: [], lin: [], red: [], hw: -Infinity, ho: -Infinity }));
    return a;
  };
  const wn = vertexNormals(waxup);
  const R = (th as Thickness & { T?: Rigid }).T?.R;
  const nv = waxup.pos.length / 3;
  for (let i = 0; i < nv; i++) {
    const dd = th.d[i];
    if (Number.isNaN(dd)) continue;
    const x = th.pos[i * 3], y = th.pos[i * 3 + 1], z = th.pos[i * 3 + 2];
    const s = slot(x, y, z);
    if (!s) continue;
    const a = get(quadrant(s.side) * 10 + s.tooth + 1);
    a.n++;
    if (Math.abs(dd) > SAME_MM) a.ch++;
    a.hw = Math.max(a.hw, s.h);
    if (dd < -SAME_MM) a.red.push(dd);
    else if (dd > SAME_MM) {
      // which surface: normal (rotated into the original's space) against the arch directions
      let nx = wn[i * 3], ny = wn[i * 3 + 1], nz = wn[i * 3 + 2];
      if (R) [nx, ny, nz] = [R[0] * nx + R[1] * ny + R[2] * nz, R[3] * nx + R[4] * ny + R[5] * nz, R[6] * nx + R[7] * ny + R[8] * nz];
      const no = nx * o[0] + ny * o[1] + nz * o[2];
      // outward from the arch: the depth direction rotated by the arch slope at this point
      const slope = 2 * th.arch.a * s.lw + th.arch.b;
      const nf = nx * f[0] + ny * f[1] + nz * f[2];
      const nw = nx * w[0] + ny * w[1] + nz * w[2];
      const out = (nf - slope * nw) / Math.sqrt(1 + slope * slope);
      if (no > 0.6) a.edge.push(dd);
      else if (out > 0.3) a.fac.push(dd);
      else if (out < -0.3) a.lin.push(dd);
    }
  }
  // highest original point per tooth slice
  const O = original.pos;
  for (let i = 0; i < O.length / 3; i++) {
    const s = slot(O[i * 3], O[i * 3 + 1], O[i * 3 + 2]);
    if (!s) continue;
    const fdi = quadrant(s.side) * 10 + s.tooth + 1;
    const a = acc.get(fdi);
    if (a) a.ho = Math.max(a.ho, s.h);
  }
  const pct = (v: number[], q: number) => {
    if (!v.length) return 0;
    const s = v.slice().sort((x, y) => x - y);
    return s[Math.min(s.length - 1, Math.floor(q * (s.length - 1)))];
  };
  const out: ToothChange[] = [];
  for (const [fdi, a] of acc) {
    if (a.n < 30) continue;
    out.push({
      fdi,
      n: a.n,
      changedPct: Math.round((a.ch / a.n) * 100),
      facialAdd: round1(pct(a.fac, 0.9)),
      edgeAdd: round1(pct(a.edge, 0.9)),
      lingualAdd: round1(pct(a.lin, 0.9)),
      reduce: round1(a.red.length > a.n * 0.02 ? pct(a.red, 0.1) : 0),
      lengthen: round1(Number.isFinite(a.ho) ? a.hw - a.ho : 0),
    });
  }
  // patient's right → left, as the dentist reads a chart: 18…11 | 21…28 (upper), 48…41 | 31…38 (lower)
  const order = (fdi: number) => {
    const q = Math.floor(fdi / 10), t = fdi % 10;
    return q === 1 || q === 4 ? -t : t;
  };
  return out.sort((x, y) => order(x.fdi) - order(y.fdi));
}

const round1 = (v: number) => Math.round(v * 10) / 10 || 0;

/** Teeth worth listing: something visibly changed. */
export const changedTeeth = (list: ToothChange[]) => list.filter((t) => t.changedPct >= 15 && (t.facialAdd || t.edgeAdd || t.lingualAdd || t.reduce || Math.abs(t.lengthen) >= 0.2));

/** One-line wording for a tooth, in mm. */
export function toothLine(t: ToothChange) {
  const parts: string[] = [];
  if (t.facialAdd) parts.push(`facial +${t.facialAdd.toFixed(1)}`);
  if (t.edgeAdd) parts.push(`edge +${t.edgeAdd.toFixed(1)}`);
  if (t.lingualAdd) parts.push(`lingual +${t.lingualAdd.toFixed(1)}`);
  if (Math.abs(t.lengthen) >= 0.2) parts.push(`${t.lengthen > 0 ? "longer" : "shorter"} ${Math.abs(t.lengthen).toFixed(1)}`);
  if (t.reduce) parts.push(`reduce ${Math.abs(t.reduce).toFixed(1)}`);
  return parts.length ? parts.join(" · ") + " mm" : "no measurable change";
}

/** Full analysis in one call (kept for the UI and tests). */
export function analyseWaxup(original: Mesh, waxup: Mesh) {
  const grid = new Grid(original.pos, 1);
  const al = align(original, waxup, { grid });
  const th = thickness(original, waxup, al.T, { grid }) as Thickness & { T?: Rigid };
  th.T = al.T;
  return { align: al, th };
}

export const WAXUP_DISCLAIMER =
  "Measured from the lab's wax-up and the original scan, aligned on this phone. Tooth numbers are estimated from average tooth widths; check them on the model. The silicone index / mock-up in the mouth decides the final preparation.";
