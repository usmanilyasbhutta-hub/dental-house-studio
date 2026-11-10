/**
 * Procedural "clay" city for map-route videos: road grid, blocks, buildings, parks, river and bridges.
 * Pure functions of (cols, rows, seed): every render is identical. Illustration only, not a real map.
 * Units: one block pitch = 1. Ground at y = 0, roads run along integer grid lines.
 */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export const PITCH = 1;
export const ROAD = 0.26;
const PLINTH = 0.03;

export type Grid = { cols: number; rows: number };
export type GridPoint = [number, number];

/** Grid intersection (col, row) → world x/z. Row 0 is far away, the last row is nearest the camera. */
export const gx = (g: Grid, i: number) => (i - g.cols / 2) * PITCH;
export const gz = (g: Grid, j: number) => (j - g.rows / 2) * PITCH;

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const RIVER_W = 0.85;
/** River centre line z(x): a gentle S-curve crossing the city at ~40 % depth. */
export function riverZ(g: Grid, seed: number, x: number) {
  const r = rng(seed * 31 + 5);
  const phase = r() * Math.PI * 2;
  return gz(g, Math.round(g.rows * 0.4)) + 0.5 + Math.sin(x * 0.42 + phase) * 1.1;
}

export type Palette = {
  bg: string;
  road: string;
  plinth: string;
  low: string; // building base colour (fake ambient occlusion)
  high: string; // building top colour
  park: string;
  tree: string;
  river: string;
  bridge: string;
  route: string;
  glow: string;
};

export const PALETTES: Record<"clay" | "brand", Palette> = {
  clay: { bg: "#E4E8EE", road: "#E4E8EE", plinth: "#F4F6F9", low: "#CDD3DC", high: "#FFFFFF", park: "#9ED8C6", tree: "#78C6AE", river: "#B4C3F2", bridge: "#EEF1F5", route: "#2E5BFF", glow: "#6E8DFF" },
  brand: { bg: "#1C2220", road: "#1C2220", plinth: "#262E2B", low: "#2E3734", high: "#5B6762", park: "#34503F", tree: "#4E7360", river: "#22333A", bridge: "#2B3431", route: "#E2C49A", glow: "#C9AB86" },
};

function box(w: number, h: number, d: number, x: number, y: number, z: number, low: THREE.Color, high: THREE.Color) {
  const b = new THREE.BoxGeometry(w, h, d);
  b.translate(x, y + h / 2, z);
  const pos = b.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const k = Math.min(1, Math.max(0, (pos.getY(i) - y) / Math.max(h, 0.001)));
    c.copy(low).lerp(high, low.equals(high) ? 1 : 0.35 + 0.65 * k);
    col.set([c.r, c.g, c.b], i * 3);
  }
  b.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return b;
}

function tint(g: THREE.BufferGeometry, color: THREE.Color) {
  const n = g.attributes.position.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) col.set([color.r, color.g, color.b], i * 3);
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  if (g.index) return g.toNonIndexed();
  return g;
}

/** All static city geometry, merged into a few meshes (one draw call each). */
export function buildCity(g: Grid, seed: number, river: boolean, pal: Palette) {
  const r = rng(seed);
  const C = (s: string) => new THREE.Color(s);
  const low = C(pal.low), high = C(pal.high), plinthC = C(pal.plinth), parkC = C(pal.park), treeC = C(pal.tree);
  const blocks: THREE.BufferGeometry[] = [];
  const trees: THREE.BufferGeometry[] = [];
  const bw = PITCH - ROAD;
  const margin = 6; // blocks beyond the grid so the city doesn't end in view
  for (let i = -margin; i < g.cols + margin; i++) {
    for (let j = -margin; j < g.rows + margin; j++) {
      const cx = gx(g, i) + PITCH / 2, cz = gz(g, j) + PITCH / 2;
      if (river && Math.abs(cz - riverZ(g, seed, cx)) < RIVER_W / 2 + bw * 0.62) continue;
      const roll = r();
      if (roll < 0.08) {
        // park: green plinth + a cluster of round trees
        blocks.push(box(bw, PLINTH, bw, cx, 0, cz, parkC, parkC));
        const n = 4 + Math.floor(r() * 4);
        for (let k = 0; k < n; k++) {
          const s = 0.09 + r() * 0.08;
          const t = new THREE.IcosahedronGeometry(s, 1);
          t.translate(cx + (r() - 0.5) * (bw - 0.25), PLINTH + s * 0.9, cz + (r() - 0.5) * (bw - 0.25));
          trees.push(tint(t, treeC));
        }
        continue;
      }
      blocks.push(box(bw, PLINTH, bw, cx, 0, cz, plinthC, plinthC));
      const split = r();
      const nx = split < 0.4 ? 2 : split < 0.7 ? 2 : 1;
      const nz = split < 0.4 ? 2 : 1;
      const inset = 0.05;
      const lw = (bw - inset * (nx + 1)) / nx, ld = (bw - inset * (nz + 1)) / nz;
      for (let a = 0; a < nx; a++) {
        for (let b = 0; b < nz; b++) {
          if (r() < 0.05) continue;
          const h = 0.16 + Math.pow(r(), 1.7) * 0.7;
          const x = cx - bw / 2 + inset + lw / 2 + a * (lw + inset);
          const z = cz - bw / 2 + inset + ld / 2 + b * (ld + inset);
          blocks.push(box(lw, h, ld, x, PLINTH, z, low, high));
        }
      }
    }
  }
  const city = mergeGeometries(blocks.map((b) => (b.index ? b.toNonIndexed() : b)));
  const forest = trees.length ? mergeGeometries(trees) : null;

  let water: THREE.BufferGeometry | null = null;
  let bridges: THREE.BufferGeometry | null = null;
  if (river) {
    const x0 = gx(g, -margin) - 2, x1 = gx(g, g.cols + margin) + 2;
    const pos: number[] = [];
    const idx: number[] = [];
    const N = 200;
    for (let k = 0; k <= N; k++) {
      const x = x0 + ((x1 - x0) * k) / N;
      const z = riverZ(g, seed, x);
      pos.push(x, 0.006, z - RIVER_W / 2, x, 0.006, z + RIVER_W / 2);
      if (k < N) idx.push(2 * k, 2 * k + 1, 2 * k + 2, 2 * k + 1, 2 * k + 3, 2 * k + 2);
    }
    water = new THREE.BufferGeometry();
    water.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    water.setIndex(idx);
    water.computeVertexNormals();
    const bs: THREE.BufferGeometry[] = [];
    for (let i = -margin; i <= g.cols + margin; i++) {
      const x = gx(g, i);
      const b = new THREE.BoxGeometry(ROAD * 0.95, 0.012, RIVER_W + 0.5);
      b.translate(x, 0.008, riverZ(g, seed, x));
      bs.push(b);
    }
    bridges = mergeGeometries(bs);
  }
  return { city, forest, water, bridges };
}

// ---- route path --------------------------------------------------------------

export type Path = { pts: THREE.Vector3[]; cum: number[]; length: number };

export function makePath(g: Grid, route: GridPoint[], y = 0): Path {
  const pts = route.map(([i, j]) => new THREE.Vector3(gx(g, i), y, gz(g, j)));
  const cum = [0];
  for (let k = 1; k < pts.length; k++) cum.push(cum[k - 1] + pts[k].distanceTo(pts[k - 1]));
  return { pts, cum, length: cum[cum.length - 1] };
}

/** Point at arc length d; extrapolates straight beyond both ends (for camera look-ahead/behind). */
export function pointAt(p: Path, d: number): THREE.Vector3 {
  const n = p.pts.length;
  if (d <= 0) {
    const dir = p.pts[1].clone().sub(p.pts[0]).normalize();
    return p.pts[0].clone().addScaledVector(dir, d);
  }
  if (d >= p.length) {
    const dir = p.pts[n - 1].clone().sub(p.pts[n - 2]).normalize();
    return p.pts[n - 1].clone().addScaledVector(dir, d - p.length);
  }
  let k = 1;
  while (p.cum[k] < d) k++;
  const t = (d - p.cum[k - 1]) / (p.cum[k] - p.cum[k - 1]);
  return p.pts[k - 1].clone().lerp(p.pts[k], t);
}

/** Smoothed point: average over a window, so the camera rounds corners instead of snapping. */
export function smoothAt(p: Path, d: number, win = 1.1, n = 9): THREE.Vector3 {
  const acc = new THREE.Vector3();
  for (let k = 0; k < n; k++) acc.add(pointAt(p, d + ((k / (n - 1)) - 0.5) * 2 * win));
  return acc.divideScalar(n);
}

/** Arc length of the closest point on the path to (x, z), and its distance. */
export function closestOnPath(p: Path, x: number, z: number) {
  let best = { d: 0, dist: Infinity };
  for (let k = 1; k < p.pts.length; k++) {
    const a = p.pts[k - 1], b = p.pts[k];
    const ab = b.clone().sub(a);
    const t = Math.max(0, Math.min(1, ((x - a.x) * ab.x + (z - a.z) * ab.z) / ab.lengthSq()));
    const q = a.clone().addScaledVector(ab, t);
    const dist = Math.hypot(q.x - x, q.z - z);
    if (dist < best.dist) best = { d: p.cum[k - 1] + t * ab.length(), dist };
  }
  return best;
}
