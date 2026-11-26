/**
 * 3D "drone" city on the real street layout (OpenStreetMap, ODbL) around the clinic. Roads are OSM geometry; buildings are
 * procedural clay blocks placed along the road frontages (OSM has almost no buildings mapped here), so the scene is an
 * illustration on a real plan: the page keeps an "Illustrative 3D" chip and the OSM credit.
 * Units: metres. Three.js axes: x = east, y = up, z = south (z = -north). Origin = the clinic pin (src/brand.ts location).
 */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import net from "../data/realroads.json";
import { rng } from "./city";

export const ROAD_W: Record<string, number> = {
  primary: 16, secondary: 14, secondary_link: 9, tertiary: 11, unclassified: 8, residential: 7, living_street: 6, service: 4.5, track: 3,
};
export const SITE = {
  roadX: 10.7, // Commissioner Road centre line at the pin (make_realmap.py → road_x_at_pin)
  // x = centre, front = x of the face towards the road; depth along x (away from the road), len along the road (z)
  clinic: { x: 10.7 - 7 - 2 - 8, front: 10.7 - 7 - 2, z: 0, depth: 16, len: 26, h: 15 }, // Ahsan Medical Centre / Dental House, west side
  landmark: { x: 10.7 + 7 + 8 + 16, front: 10.7 + 7 + 8, z: 2, depth: 32, len: 46, h: 19 }, // Trauma Centre, directly opposite (owner)
};
export const CITY_COLORS = {
  sky: "#EDE6DA", ground: "#E3DACB", road: "#B9B0A2", hero: "#6E6862", line: "#F8F4EC", tree: "#8FB59A", tank: "#3E4744",
};
const BUILDING = ["#F4EFE6", "#EDE3D3", "#E9DCC7", "#F1E6D6", "#E2D8CA", "#F6F2EC", "#E7D6C0"];

type Seg = { ax: number; az: number; bx: number; bz: number; hw: number };
const toXZ = ([x, y]: number[]) => [x, -y] as const;

function colorBox(w: number, h: number, d: number, col: THREE.Color, shade = 0.78) {
  const b = new THREE.BoxGeometry(w, h, d).toNonIndexed();
  b.deleteAttribute("uv");
  b.translate(0, h / 2, 0);
  const pos = b.attributes.position;
  const c = new Float32Array(pos.count * 3);
  const low = col.clone().multiplyScalar(shade);
  const t = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    t.copy(low).lerp(col, Math.min(1, 0.3 + 0.7 * (pos.getY(i) / h)));
    c.set([t.r, t.g, t.b], i * 3);
  }
  b.setAttribute("color", new THREE.BufferAttribute(c, 3));
  return b;
}

function ribbon(ax: number, az: number, bx: number, bz: number, w: number, y: number) {
  const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz) || 1;
  const nx = (-dz / L) * (w / 2), nz = (dx / L) * (w / 2);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute([
    ax + nx, y, az + nz, bx + nx, y, bz + nz, bx - nx, y, bz - nz,
    ax + nx, y, az + nz, bx - nx, y, bz - nz, ax - nx, y, az - nz,
  ], 3));
  return g;
}
function disc(x: number, z: number, r: number, y: number) {
  const g = new THREE.CircleGeometry(r, 14).toNonIndexed();
  g.rotateX(-Math.PI / 2);
  g.translate(x, y, z);
  return g;
}
const plain = (g: THREE.BufferGeometry) => { g.deleteAttribute("normal"); g.deleteAttribute("uv"); return g; };

function distToSeg(px: number, pz: number, s: Seg) {
  const dx = s.bx - s.ax, dz = s.bz - s.az, L2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((px - s.ax) * dx + (pz - s.az) * dz) / L2));
  return Math.hypot(px - (s.ax + t * dx), pz - (s.az + t * dz));
}

/** The highlighted road: the north-south secondary road through the site, as an ordered polyline (south → north). */
export function heroRoad(): THREE.Vector3[] {
  const pts: [number, number][] = [];
  for (const w of net.ways) {
    if (w.hw !== "secondary") continue;
    for (const p of w.pts) if (Math.abs(p[0] - SITE.roadX) < 60 && Math.abs(p[1]) < 1000) pts.push(toXZ(p) as [number, number]);
  }
  pts.sort((a, b) => b[1] - a[1]);
  return pts.filter((p, i) => i === 0 || Math.abs(p[1] - pts[i - 1][1]) > 0.5).map(([x, z]) => new THREE.Vector3(x, 0, z));
}

export function buildRealCity(seed = 11, radius = 1000) {
  const R = rng(seed);
  const segs: Seg[] = [];
  const roads: THREE.BufferGeometry[] = [];
  const hero: THREE.BufferGeometry[] = [];
  for (const w of net.ways) {
    const hw = ROAD_W[w.hw];
    if (!hw) continue;
    const isHero = w.hw === "secondary" && w.pts.some((p) => Math.abs(p[0] - SITE.roadX) < 60);
    const y = isHero ? 0.06 : 0.04;
    for (let i = 0; i + 1 < w.pts.length; i++) {
      const [ax, az] = toXZ(w.pts[i]), [bx, bz] = toXZ(w.pts[i + 1]);
      segs.push({ ax, az, bx, bz, hw: hw / 2 });
      (isHero ? hero : roads).push(plain(ribbon(ax, az, bx, bz, hw, y)));
    }
    for (const p of w.pts) {
      const [x, z] = toXZ(p);
      (isHero ? hero : roads).push(plain(disc(x, z, hw / 2, y)));
    }
  }

  // dashed centre line on the hero road
  const lines: THREE.BufferGeometry[] = [];
  const hr = heroRoad();
  for (let i = 0; i + 1 < hr.length; i++) {
    const a = hr[i], b = hr[i + 1], L = a.distanceTo(b);
    for (let s = 0; s + 3 < L; s += 9) {
      const p = a.clone().lerp(b, s / L), q = a.clone().lerp(b, (s + 4) / L);
      lines.push(plain(ribbon(p.x, p.z, q.x, q.z, 0.35, 0.09)));
    }
  }

  // reserved footprints: the two named buildings
  const placed: { x: number; z: number; r: number }[] = [];
  const reserve = (x: number, z: number, w: number, d: number) => placed.push({ x, z, r: Math.hypot(w, d) / 2 });
  reserve(SITE.clinic.x, SITE.clinic.z, SITE.clinic.depth, SITE.clinic.len);
  reserve(SITE.landmark.x, SITE.landmark.z, SITE.landmark.depth, SITE.landmark.len);
  reserve(SITE.landmark.x + SITE.landmark.depth * 0.6, SITE.landmark.z - SITE.landmark.len * 0.5, SITE.landmark.depth * 0.7, SITE.landmark.len * 0.5);

  // spatial hash of road segments for the clearance test
  const cell = 40, hash = new Map<string, Seg[]>();
  for (const s of segs) {
    const x0 = Math.floor(Math.min(s.ax, s.bx) / cell) - 1, x1 = Math.floor(Math.max(s.ax, s.bx) / cell) + 1;
    const z0 = Math.floor(Math.min(s.az, s.bz) / cell) - 1, z1 = Math.floor(Math.max(s.az, s.bz) / cell) + 1;
    for (let i = x0; i <= x1; i++) for (let j = z0; j <= z1; j++) {
      const k = `${i},${j}`;
      if (!hash.has(k)) hash.set(k, []);
      hash.get(k)!.push(s);
    }
  }
  const clear = (x: number, z: number, r: number) => {
    for (const s of hash.get(`${Math.floor(x / cell)},${Math.floor(z / cell)}`) ?? []) if (distToSeg(x, z, s) < s.hw + 1.5 + r * 0.72) return false;
    for (const p of placed) if (Math.hypot(p.x - x, p.z - z) < (p.r + r) * 0.78) return false;
    return Math.hypot(x, z) < radius;
  };

  const blocks: THREE.BufferGeometry[] = [];
  const tanks: THREE.BufferGeometry[] = [];
  const trees: THREE.BufferGeometry[] = [];
  const addBuilding = (x: number, z: number, w: number, d: number, h: number, ang: number, col?: THREE.Color) => {
    const c = col ?? new THREE.Color(BUILDING[Math.floor(R() * BUILDING.length)]);
    const b = colorBox(w, h, d, c);
    b.rotateY(ang);
    b.translate(x, 0, z);
    blocks.push(b);
    if (R() < 0.55) { // black rooftop water tank
      const t = colorBox(1.4, 1.5, 1.4, new THREE.Color(CITY_COLORS.tank), 0.9);
      t.translate((R() - 0.5) * w * 0.5, h, (R() - 0.5) * d * 0.5);
      t.rotateY(ang);
      t.translate(x, 0, z);
      tanks.push(t);
    }
    if (R() < 0.35) { // parapet / stair room
      const s = colorBox(w * 0.3, 2.6, d * 0.3, c, 0.85);
      s.translate((R() - 0.5) * w * 0.3, h, (R() - 0.5) * d * 0.3);
      s.rotateY(ang);
      s.translate(x, 0, z);
      blocks.push(s);
    }
  };

  // frontage rows along every road (both sides), denser and taller along the bigger roads
  for (const s of segs) {
    const dx = s.bx - s.ax, dz = s.bz - s.az, L = Math.hypot(dx, dz);
    if (L < 6 || s.hw < 2.5) continue;
    const ux = dx / L, uz = dz / L, ang = -Math.atan2(dz, dx);
    const major = s.hw >= 5.5;
    for (let t = 4; t < L - 4; t += 9 + R() * 6) {
      for (const side of [1, -1]) {
        const w = 8 + R() * 7, d = 10 + R() * 10;
        const off = s.hw + 2 + d / 2;
        const x = s.ax + ux * t - uz * off * side, z = s.az + uz * t + ux * off * side;
        const r = Math.hypot(w, d) / 2;
        if (!clear(x, z, r)) continue;
        const floors = major ? 2 + Math.floor(R() * 3) : 1 + Math.floor(R() * 3);
        placed.push({ x, z, r });
        addBuilding(x, z, w, d, floors * 3.4 + 0.8, ang);
      }
    }
  }
  // infill inside the blocks
  for (let i = 0; i < 9000; i++) {
    const x = (R() * 2 - 1) * radius, z = (R() * 2 - 1) * radius;
    const w = 9 + R() * 8, d = 9 + R() * 10, r = Math.hypot(w, d) / 2;
    if (!clear(x, z, r)) continue;
    placed.push({ x, z, r });
    addBuilding(x, z, w, d, (1 + Math.floor(R() * 3)) * 3.4 + 0.8, (R() - 0.5) * 0.3);
  }
  // street trees along the hero road
  for (let i = 0; i + 1 < hr.length; i++) {
    const a = hr[i], b = hr[i + 1], L = a.distanceTo(b);
    for (let s = 6; s < L; s += 16 + R() * 10) {
      const p = a.clone().lerp(b, s / L);
      for (const side of [-1, 1]) {
        if (R() < 0.45 || Math.abs(p.z) < 40) continue;
        const g = new THREE.IcosahedronGeometry(2.6 + R() * 1.4, 0).toNonIndexed();
        g.translate(p.x + side * 8.2, 4.2, p.z);
        const col = new THREE.Color(CITY_COLORS.tree).multiplyScalar(0.9 + R() * 0.2);
        const c = new Float32Array(g.attributes.position.count * 3);
        for (let k = 0; k < g.attributes.position.count; k++) c.set([col.r, col.g, col.b], k * 3);
        g.setAttribute("color", new THREE.BufferAttribute(c, 3));
        g.deleteAttribute("uv");
        trees.push(g);
      }
    }
  }

  // the two named buildings (fronts face the road)
  const named: THREE.BufferGeometry[] = [];
  const cl = SITE.clinic, lm = SITE.landmark;
  const clinicB = colorBox(cl.depth, cl.h, cl.len, new THREE.Color("#F3E9D8"), 0.82); // long side along the road
  clinicB.translate(cl.x, 0, cl.z);
  named.push(clinicB);
  const lmB = colorBox(lm.depth, lm.h, lm.len, new THREE.Color("#FBFAF7"), 0.84);
  lmB.translate(lm.x, 0, lm.z);
  named.push(lmB);
  const wing = colorBox(lm.depth * 0.7, lm.h * 0.6, lm.len * 0.5, new THREE.Color("#F6F4EF"), 0.84);
  wing.translate(lm.x + lm.depth * 0.6, 0, lm.z - lm.len * 0.5);
  named.push(wing);

  const merge = (gs: THREE.BufferGeometry[]) => {
    const m = mergeGeometries(gs.map((g) => (g.attributes.normal ? g : (g.computeVertexNormals(), g))));
    m.computeVertexNormals();
    return m;
  };
  return {
    roads: mergeGeometries(roads), hero: mergeGeometries(hero), lines: mergeGeometries(lines),
    blocks: merge([...blocks, ...named]), tanks: merge(tanks), trees: merge(trees),
    count: placed.length,
  };
}
