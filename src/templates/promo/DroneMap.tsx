import React, { useEffect, useMemo, useState } from "react";
import { AbsoluteFill, Easing, continueRender, delayRender, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { clinic, video } from "../../brand";
import { carousel as P } from "../../theme";
import type { PromoBrief } from "../../brief/schema";
import { CITY_COLORS as C, ROAD_W, SITE, buildRealCity, heroRoad } from "../../three/realcity";
import net from "../../data/realroads.json";
import ring from "../../data/pakistan-ring.json";

/**
 * Location journey (own_map.style: drone), after the owner's reference ("This kind of drone view. Starting from earth to pakistan to
 * sialkot to commisioner road to Dental house at ahsan medical centre"):
 *   A  NASA Blue Marble globe (public domain) turns to Pakistan; the border (Natural Earth) is traced; Sialkot pulses.
 *   B  through a cloud bank onto Copernicus Sentinel-2 imagery of Sialkot (22 Nov 2026); 3D blocks rise on the OpenStreetMap street plan;
 *      the drone drops onto Commissioner Road and follows a glowing route past traffic to the Ahsan Medical Centre front.
 * Buildings, cars and the clinic model are our own illustration (chip says so). No Google imagery or marks.
 */
const W = video.width, H = video.height;
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const inOut = Easing.bezier(0.45, 0, 0.3, 1);
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const rx = SITE.roadX, cl = SITE.clinic, lm = SITE.landmark;
const LAT0 = 32.5054616, LON0 = 74.546536;
const T = 192; // authored length (frames); scaled to the page length

const font = (size: number, weight = 900, color: string = P.ink): React.CSSProperties => ({
  fontFamily: P.headline, fontWeight: weight, fontSize: size, color, lineHeight: 1.0, letterSpacing: weight >= 900 ? "-0.02em" : "0",
});

/** texture that holds the render until it has loaded (Remotion must not capture a frame without it) */
function useTex(src: string) {
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  const [h] = useState(() => delayRender(`texture ${src}`));
  useEffect(() => {
    new THREE.TextureLoader().load(staticFile(src), (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
      setTex(t);
      continueRender(h);
    }, undefined, () => continueRender(h));
  }, [src, h]);
  return tex;
}

// ---------- A: globe ------------------------------------------------------------------------------------------------------------
/** lon/lat → point on three's SphereGeometry (u = (lon + 180) / 360 around, v from the north pole) */
function sph(lon: number, lat: number, r = 1) {
  const th = ((lon + 180) / 360) * Math.PI * 2, ph = (lat * Math.PI) / 180;
  return v(-Math.cos(th) * Math.cos(ph) * r, Math.sin(ph) * r, Math.sin(th) * Math.cos(ph) * r);
}
const SK = sph(LON0, LAT0);
function globeCam(t: number) {
  const d0 = sph(28, 14).normalize(), d1 = sph(LON0 - 1.5, LAT0 - 4).normalize();
  const dir = d0.clone().lerp(d1, inOut(Math.min(1, t * 1.25))).normalize();
  const dist = 3.6 * (1.22 / 3.6) ** Easing.bezier(0.55, 0, 0.6, 1)(t);
  const c = new THREE.PerspectiveCamera(36, W / H, 0.001, 100);
  c.position.copy(dir.multiplyScalar(dist));
  c.up.set(0, 1, 0);
  c.lookAt(SK.clone().multiplyScalar(t > 0.5 ? 0.2 + 0.8 * Math.min(1, (t - 0.5) * 2) : 0.2 * t * 2));
  c.updateProjectionMatrix();
  c.updateMatrixWorld();
  return c;
}
const GlobeRig: React.FC<{ cam: THREE.PerspectiveCamera }> = ({ cam }) => {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  camera.fov = cam.fov; camera.near = cam.near; camera.far = cam.far;
  camera.position.copy(cam.position); camera.quaternion.copy(cam.quaternion);
  camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  return null;
};
const Globe: React.FC<{ border: number; tex: THREE.Texture | null }> = ({ border, tex }) => {
  const tube = useMemo(() => {
    const pts = ring.rings[0].map(([lo, la]) => sph(lo, la, 1.0015));
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true, "centripetal"), 900, 0.0014, 6, true);
  }, []);
  const stars = useMemo(() => {
    const g = new THREE.BufferGeometry(), a: number[] = [];
    let s = 7;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 1600; i++) { const p = v(r() - 0.5, r() - 0.5, r() - 0.5).normalize().multiplyScalar(40); a.push(p.x, p.y, p.z); }
    g.setAttribute("position", new THREE.Float32BufferAttribute(a, 3));
    return g;
  }, []);
  tube.setDrawRange(0, Math.floor(((tube.index?.count ?? 0) * border) / 3) * 3);
  return (
    <group>
      <points geometry={stars}><pointsMaterial color="#DDE6FF" size={0.06} sizeAttenuation transparent opacity={0.8} /></points>
      <mesh><sphereGeometry args={[1, 160, 120]} />{tex ? <meshStandardMaterial map={tex} roughness={0.85} metalness={0} /> : <meshStandardMaterial color="#1F4E79" />}</mesh>
      <mesh><sphereGeometry args={[1.018, 96, 72]} /><meshBasicMaterial color="#8CC4FF" transparent opacity={0.16} side={THREE.BackSide} /></mesh>
      <mesh><sphereGeometry args={[1.004, 96, 72]} /><meshBasicMaterial color="#BFE0FF" transparent opacity={0.06} /></mesh>
      <mesh geometry={tube}><meshBasicMaterial color="#FFD889" toneMapped={false} /></mesh>
    </group>
  );
};

// ---------- B: city --------------------------------------------------------------------------------------------------------------
const ALT0 = 6500;
const POS = new THREE.CatmullRomCurve3([
  v(rx + 300, ALT0, 2600), v(rx + 140, 1500, 1500), v(rx + 40, 230, 820), v(rx + 10, 62, 380), v(rx + 3, 34, 150), v(rx + 13, 15, 54),
], false, "centripetal");
const LOOK = new THREE.CatmullRomCurve3([
  v(0, 0, 0), v(rx, 0, 280), v(rx, 0, 220), v(rx - 2, 4, 70), v(rx - 4, 8, 8), v(cl.front - 2, 11, 3),
], false, "centripetal");
function cityCam(u: number) {
  const c = new THREE.PerspectiveCamera(52, W / H, 0.5, 40000);
  c.position.copy(POS.getPoint(u));
  c.lookAt(LOOK.getPoint(u));
  c.updateProjectionMatrix();
  c.updateMatrixWorld();
  return c;
}
const CityRig: React.FC<{ cam: THREE.PerspectiveCamera }> = ({ cam }) => {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  camera.fov = cam.fov; camera.near = cam.near; camera.far = cam.far;
  camera.position.copy(cam.position); camera.quaternion.copy(cam.quaternion);
  camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  return null;
};
function project(c: THREE.Camera, p: THREE.Vector3) {
  const q = p.clone().project(c);
  return { x: ((q.x + 1) / 2) * W, y: ((1 - q.y) / 2) * H, behind: q.z > 1 };
}

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, repeat = false) {
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  draw(cv.getContext("2d")!);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  return t;
}
/** one window bay: plain wall around a glass pane (the texture's corner stays plain for roofs) */
const windowTex = () => canvasTex(128, 128, (g) => {
  g.fillStyle = "#FFFFFF"; g.fillRect(0, 0, 128, 128);
  const gr = g.createLinearGradient(0, 30, 0, 98);
  gr.addColorStop(0, "#9DB3BF"); gr.addColorStop(0.45, "#5C717D"); gr.addColorStop(1, "#3D4D57");
  g.fillStyle = "#D9D4CC"; g.fillRect(30, 28, 68, 74);
  g.fillStyle = gr; g.fillRect(34, 32, 60, 64);
  g.fillStyle = "rgba(255,255,255,0.35)"; g.fillRect(62, 32, 3, 64);
  g.fillStyle = "#E8E3DA"; g.fillRect(28, 100, 72, 6);
}, true);

type Lane = { pts: THREE.Vector2[]; cum: number[]; len: number; off: number };
function lanes(): Lane[] {
  const out: Lane[] = [];
  for (const w of net.ways) {
    if (!["primary", "secondary", "tertiary"].includes(w.hw)) continue;
    const pts = w.pts.map(([x, y]) => new THREE.Vector2(x, -y));
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
    if (cum[cum.length - 1] < 40) continue;
    out.push({ pts, cum, len: cum[cum.length - 1], off: (ROAD_W[w.hw] / 2) * 0.48 });
  }
  return out;
}
function along(l: Lane, s: number) {
  s = ((s % l.len) + l.len) % l.len;
  let i = 1;
  while (i < l.cum.length - 1 && l.cum[i] < s) i++;
  const a = l.pts[i - 1], b = l.pts[i], k = (s - l.cum[i - 1]) / Math.max(0.001, l.cum[i] - l.cum[i - 1]);
  return { p: a.clone().lerp(b, k), d: b.clone().sub(a).normalize() };
}

const Traffic: React.FC<{ time: number }> = ({ time }) => {
  const data = useMemo(() => {
    const L = lanes();
    let s = 3;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const cars: { lane: Lane; s0: number; dir: 1 | -1; v: number; kind: 0 | 1 }[] = [];
    for (const lane of L) {
      const hero = lane.pts.some((p) => Math.abs(p.x - rx) < 30 && Math.abs(p.y) < 900);
      const gap = hero ? 20 : 38;
      for (const dir of [1, -1] as const) for (let x = r() * gap; x < lane.len; x += gap * (0.6 + r() * 0.9))
        cars.push({ lane, s0: x, dir, v: 7 + r() * 5, kind: r() < (hero ? 0.35 : 0.2) ? 1 : 0 });
    }
    const body = new THREE.BoxGeometry(4.3, 1.25, 1.85); body.translate(0, 0.95, 0);
    const cab = new THREE.BoxGeometry(2.3, 0.85, 1.65); cab.translate(-0.2, 1.95, 0);
    const carG = mergeGeometries([body, cab]);
    const rk = new THREE.BoxGeometry(2.7, 1.75, 1.35); rk.translate(0, 1.1, 0);
    const meshes = [0, 1].map((k) => {
      const n = cars.filter((c) => c.kind === k).length;
      const m = new THREE.InstancedMesh(k ? rk : carG, new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: k ? 0 : 0.35 }), n);
      m.castShadow = true;
      let i = 0;
      const pal = k ? ["#2E8B4E", "#3A9A57", "#2D7F47"] : ["#F4F4F2", "#C9CDD2", "#2B2F33", "#8E1F2B", "#E9E7E1", "#6C7680", "#F4F4F2"];
      for (const c of cars) if (c.kind === k) m.setColorAt(i++, new THREE.Color(pal[Math.floor(r() * pal.length)]));
      return m;
    });
    return { cars, meshes };
  }, []);
  const idx = [0, 0], o = new THREE.Object3D();
  for (const c of data.cars) {
    const { p, d } = along(c.lane, c.s0 + c.dir * c.v * time);
    const dir = d.clone().multiplyScalar(c.dir);
    const left = new THREE.Vector2(dir.y, -dir.x); // drive on the left
    o.position.set(p.x + left.x * c.lane.off, 0.05, p.y + left.y * c.lane.off);
    o.rotation.set(0, -Math.atan2(dir.y, dir.x), 0);
    o.updateMatrix();
    data.meshes[c.kind].setMatrixAt(idx[c.kind]++, o.matrix);
  }
  for (const m of data.meshes) m.instanceMatrix.needsUpdate = true;
  return <>{data.meshes.map((m, i) => <primitive key={i} object={m} />)}</>;
};

/** route line: northbound lane of Commissioner Road, then into the clinic forecourt */
function routeGeometry() {
  const road = heroRoad().filter((p) => p.z > 6 && p.z < 1150);
  const pts = road.map((p) => v(p.x - 3.4, 0.35, p.z));
  pts.push(v(rx - 3.4, 0.35, 6), v(rx - 7.5, 0.35, 2.5), v(cl.front + 2.2, 0.35, 1));
  const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal");
  return { core: new THREE.TubeGeometry(curve, 700, 0.5, 8, false), glow: new THREE.TubeGeometry(curve, 700, 1.6, 8, false) };
}

const ClinicModel: React.FC<{ accent: string; signs: boolean }> = ({ accent, signs }) => {
  const tex = useMemo(() => signs ? {
    dh: canvasTex(1024, 160, (g) => {
      g.fillStyle = accent; g.fillRect(0, 0, 1024, 160);
      g.fillStyle = "#FFFFFF"; g.font = "900 110px Roboto"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("DENTAL HOUSE", 512, 86);
    }),
    amc: canvasTex(1024, 96, (g) => {
      g.fillStyle = "#EFE6D4"; g.fillRect(0, 0, 1024, 96);
      g.fillStyle = "#2B2A27"; g.font = "900 64px Roboto"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("AHSAN MEDICAL CENTRE", 512, 52);
    }),
  } : null, [accent, signs]);
  const fx = cl.depth / 2; // local x of the front face
  const cream = "#E7DCC6";
  return (
    <group position={[cl.x, 0, cl.z]}>
      <mesh castShadow receiveShadow position={[0, 8, 0]}><boxGeometry args={[cl.depth, 16, cl.len]} /><meshStandardMaterial color={cream} roughness={0.8} /></mesh>
      {/* ground floor: shutters, entrance, steps */}
      <mesh position={[fx + 0.12, 1.7, -3]}><boxGeometry args={[0.24, 3.2, 17]} /><meshStandardMaterial color="#5A5E60" roughness={0.6} metalness={0.3} /></mesh>
      <mesh position={[fx + 0.14, 1.6, 8]}><boxGeometry args={[0.26, 3.0, 4.4]} /><meshStandardMaterial color="#2A2C2D" /></mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={i} receiveShadow position={[fx + 1.6 - i * 0.45, 0.18 + i * 0.3, 8]}><boxGeometry args={[0.9, 0.36 + i * 0.6, 5]} /><meshStandardMaterial color="#D8CFBE" /></mesh>
      ))}
      {/* pilasters, glass, cornice */}
      {[-12.4, -4.2, 4.2, 12.4].map((z) => (
        <mesh key={z} castShadow position={[fx + 0.3, 10, z]}><boxGeometry args={[0.6, 12, 1.1]} /><meshStandardMaterial color="#F1E8D6" roughness={0.7} /></mesh>
      ))}
      {[-8.3, 0, 8.3].map((z) => (
        <mesh key={z} position={[fx + 0.12, 10.4, z]}><boxGeometry args={[0.24, 9.6, 6.6]} /><meshStandardMaterial color="#6E93A3" roughness={0.18} metalness={0.15} /></mesh>
      ))}
      <mesh castShadow position={[fx + 0.45, 16.2, 0]}><boxGeometry args={[0.9, 0.9, cl.len + 0.8]} /><meshStandardMaterial color="#F4ECDC" /></mesh>
      {tex ? (
        <>
          <mesh position={[fx + 0.3, 4.3, 0]} rotation={[0, Math.PI / 2, 0]}><planeGeometry args={[19, 19 * (96 / 1024) * 1.6]} /><meshBasicMaterial map={tex.amc} toneMapped={false} /></mesh>
          {/* Dental House rooftop sign, turned towards the road and the approach (south) */}
          <group position={[2, 16.6, cl.len * 0.18]} rotation={[0, 0.6, 0]}>
            <mesh position={[0, 4.8, 0]}><planeGeometry args={[22, 22 * (160 / 1024)]} /><meshBasicMaterial map={tex.dh} toneMapped={false} side={THREE.DoubleSide} /></mesh>
            <mesh position={[-7.5, 1.6, -0.2]}><boxGeometry args={[0.4, 3.2, 0.4]} /><meshStandardMaterial color="#3E4744" /></mesh>
            <mesh position={[7.5, 1.6, -0.2]}><boxGeometry args={[0.4, 3.2, 0.4]} /><meshStandardMaterial color="#3E4744" /></mesh>
          </group>
        </>
      ) : null}
    </group>
  );
};

const City: React.FC<{ accent: string; rise: number; satO: number; roadO: number; route: number; time: number; signs: boolean; sat: THREE.Texture | null; satW: THREE.Texture | null }> = ({ accent, rise, satO, roadO, route, time, signs, sat, satW }) => {
  const g = useMemo(() => buildRealCity(11, 1100), []);
  const win = useMemo(() => windowTex(), []);
  const rt = useMemo(() => routeGeometry(), []);
  const cross = useMemo(() => canvasTex(256, 128, (x) => {
    x.fillStyle = "#FFFFFF"; x.fillRect(0, 0, 256, 128);
    x.fillStyle = "#C8102E"; x.fillRect(113, 16, 30, 96); x.fillRect(80, 49, 96, 30);
  }), []);
  const n = (gg: THREE.BufferGeometry, k: number) => gg.setDrawRange(0, Math.floor(((gg.index?.count ?? 0) * k) / 3) * 3);
  n(rt.core, route); n(rt.glow, route);
  return (
    <group>
      {/* ground layers draw first without depth writes (no z-fighting between the stacked planes at altitude) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.6, 0]} renderOrder={-4}><planeGeometry args={[60000, 60000]} /><meshBasicMaterial map={satW} color={satW ? "#FFFFFF" : "#9C9580"} toneMapped={false} depthWrite={false} /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.4, 0]} renderOrder={-3}><planeGeometry args={[12400, 12400]} /><meshBasicMaterial map={sat} color={sat ? "#FFFFFF" : "#9C9580"} toneMapped={false} depthWrite={false} /></mesh>
      {/* paved ground under the 3D blocks; the satellite shows through from altitude */}
      {satO < 1 ? (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.2, 0]} receiveShadow renderOrder={-2}>
          <circleGeometry args={[1150, 96]} /><meshStandardMaterial color={C.ground} roughness={1} transparent opacity={1 - satO} depthWrite={false} />
        </mesh>
      ) : null}
      <mesh geometry={g.roads} receiveShadow><meshStandardMaterial color="#8B877F" roughness={0.95} transparent opacity={roadO} /></mesh>
      <mesh geometry={g.hero} receiveShadow><meshStandardMaterial color="#4E4C4A" roughness={0.9} transparent opacity={roadO} /></mesh>
      <mesh geometry={g.lines}><meshBasicMaterial color={C.line} transparent opacity={roadO} /></mesh>
      <group scale={[1, Math.max(0.001, rise), 1]}>
        <mesh geometry={g.blocks} castShadow receiveShadow><meshStandardMaterial vertexColors map={win} roughness={0.85} /></mesh>
        <mesh geometry={g.named} castShadow receiveShadow><meshStandardMaterial vertexColors map={win} roughness={0.85} /></mesh>
        <mesh geometry={g.tanks} castShadow><meshStandardMaterial vertexColors roughness={0.6} /></mesh>
        <mesh geometry={g.trees} castShadow><meshStandardMaterial vertexColors roughness={0.85} flatShading /></mesh>
        <ClinicModel accent={accent} signs={signs} />
        <mesh position={[lm.front - 0.2, lm.h - 4, lm.z + 6]} rotation={[0, -Math.PI / 2, 0]}><planeGeometry args={[8, 4]} /><meshBasicMaterial map={cross} toneMapped={false} /></mesh>
        <mesh position={[lm.x - 4, lm.h + 3.5, lm.z + lm.len * 0.35]} rotation={[0, -0.25, 0]}><planeGeometry args={[9, 4.5]} /><meshBasicMaterial map={cross} toneMapped={false} side={THREE.DoubleSide} /></mesh>
      </group>
      {rise > 0.9 ? <Traffic time={time} /> : null}
      {route > 0 ? (
        <>
          <mesh geometry={rt.glow}><meshBasicMaterial color="#58D6FF" transparent opacity={0.28} toneMapped={false} depthWrite={false} /></mesh>
          <mesh geometry={rt.core}><meshBasicMaterial color="#B8F1FF" toneMapped={false} /></mesh>
        </>
      ) : null}
    </group>
  );
};

/** canvas signs need the brand font loaded first */
function useFontReady() {
  const [ready, setReady] = useState(false);
  const [h] = useState(() => delayRender("sign fonts"));
  useEffect(() => {
    Promise.all([document.fonts.load("900 110px Roboto"), document.fonts.ready]).then(() => { setReady(true); continueRender(h); });
  }, [h]);
  return ready;
}

export const DroneMap: React.FC<{ brief: PromoBrief; accent: string; len: number }> = ({ brief, accent, len }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const m = brief.own_map!;
  const f = (x: number) => Math.round((x / T) * len);
  const signs = useFontReady();
  const world = useTex("footage/realmap/world.jpg");
  const sat = useTex("footage/realmap/s2-city.jpg");
  const satW = useTex("footage/realmap/s2-wide.jpg");

  // A: globe 0–58
  const tg = interpolate(frame, [0, f(56)], [0, 1], clamp);
  const gcam = globeCam(tg);
  const border = interpolate(frame, [f(8), f(34)], [0, 1], { ...clamp, easing: inOut });
  const skP = project(gcam, SK.clone().multiplyScalar(1.002));
  const pulse = (frame % 24) / 24;
  // clouds 44–66
  const cloud = interpolate(frame, [f(42), f(54), f(58), f(70)], [0, 1, 1, 0], clamp);
  const showGlobe = frame < f(56);
  // B: city 52–192
  const u = interpolate(frame, [f(54), f(184)], [0, 1], { ...clamp, easing: Easing.bezier(0.3, 0, 0.22, 1) });
  const ccam = cityCam(u);
  const alt = ccam.position.y;
  const rise = interpolate(alt, [500, 1700], [1, 0], clamp);
  const satO = interpolate(alt, [140, 700], [0, 1], clamp);
  const roadO = interpolate(alt, [1400, 3200], [1, 0], clamp);
  const route = interpolate(frame, [f(92), f(172)], [0, 1], { ...clamp, easing: Easing.bezier(0.25, 0, 0.3, 1) });
  const time = frame / fps;

  const lab = (a: number, b: number) => interpolate(frame, [f(a), f(a) + 6, f(b) - 6, f(b)], [0, 1, 1, 0], clamp);
  const stops = [
    { n: "01", label: m.country, o: lab(10, 50), dark: true },
    { n: "02", label: m.city, o: lab(64, 106), dark: false },
    { n: "03", label: m.road, o: lab(110, 164), dark: false },
  ];
  const hosp = project(ccam, v(lm.front + 4, lm.h + 2, lm.z + 8));
  const hospO = interpolate(frame, [f(132), f(138), f(160), f(166)], [0, 1, 1, 0], clamp);
  const door = project(ccam, v(cl.front + 3.2, 0.4, cl.z + 8)); // forecourt at the steps, under the signs
  const pin = spring({ frame: frame - f(172), fps, config: { damping: 9, stiffness: 190 } });
  const card = interpolate(frame, [f(176), f(184)], [0, 1], clamp);

  return (
    <AbsoluteFill style={{ background: "#CFDCE6", overflow: "hidden" }}>
      {!showGlobe ? (
        <ThreeCanvas width={W} height={H} shadows camera={{ fov: 52, near: 0.5, far: 40000, position: [0, 6500, 2600] }} gl={{ antialias: true }}>
          <color attach="background" args={["#CFDCE6"]} />
          <fog attach="fog" args={["#D6E0E6", Math.max(600, alt * 1.2), Math.max(2600, alt * 5)]} />
          <CityRig cam={ccam} />
          <hemisphereLight args={["#EAF3FF", "#CDBFA6", 1.05]} />
          <directionalLight position={[-420, 520, 300]} intensity={2.1} color="#FFF1DC" castShadow
            shadow-mapSize={[4096, 4096]} shadow-bias={-0.0004}
            shadow-camera-left={-500} shadow-camera-right={500} shadow-camera-top={500} shadow-camera-bottom={-500}
            shadow-camera-near={10} shadow-camera-far={2000} />
          <City accent={accent} rise={rise} satO={satO} roadO={roadO} route={route} time={time} signs={signs} sat={sat} satW={satW} />
        </ThreeCanvas>
      ) : (
        <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 45%, #0E1C3A 0%, #050A18 60%, #02040A 100%)" }}>
          <ThreeCanvas width={W} height={H} camera={{ fov: 36, near: 0.001, far: 100, position: [0, 0, 3.6] }} gl={{ antialias: true, alpha: true }}>
            <GlobeRig cam={gcam} />
            <ambientLight intensity={0.55} />
            <directionalLight position={[2, 1.5, 3]} intensity={2.2} />
            <Globe border={border} tex={world} />
          </ThreeCanvas>
          {!skP.behind && border > 0.6 ? (
            <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
              <circle cx={skP.x} cy={skP.y} r={10 + 30 * pulse} fill="none" stroke="#FFFFFF" strokeWidth={4} opacity={1 - pulse} />
              <circle cx={skP.x} cy={skP.y} r={10} fill={accent} stroke="#FFFFFF" strokeWidth={4} />
            </svg>
          ) : null}
        </AbsoluteFill>
      )}

      {/* cloud bank between the globe and the city */}
      {cloud > 0 ? (
        <AbsoluteFill style={{ opacity: cloud, pointerEvents: "none" }}>
          {[[20, 30, 1.0], [70, 22, 1.2], [45, 60, 1.4], [85, 75, 1.1], [10, 85, 1.3], [55, 40, 1.6]].map(([x, y, s], i) => (
            <div key={i} style={{ position: "absolute", left: `${x}%`, top: `${y}%`, width: 900 * s, height: 700 * s,
              transform: `translate(-50%, -50%) scale(${1 + cloud * 0.6 + i * 0.05})`,
              background: "radial-gradient(closest-side, rgba(255,255,255,0.98), rgba(255,255,255,0.7) 55%, rgba(255,255,255,0) 100%)" }} />
          ))}
          <AbsoluteFill style={{ background: `rgba(246,249,252,${Math.max(0, cloud - 0.35)})` }} />
        </AbsoluteFill>
      ) : null}

      {/* numbered stops */}
      {stops.map((s, i) => s.o > 0 ? (
        <div key={i} style={{ position: "absolute", left: 70, top: 270, opacity: s.o, transform: `translateY(${(1 - s.o) * 18}px)`,
          background: s.dark ? "rgba(8,14,30,0.55)" : "rgba(251,247,240,0.92)", borderRadius: 22, padding: "16px 26px 20px",
          boxShadow: "0 8px 24px rgba(0,0,0,0.18)", border: s.dark ? "1px solid rgba(255,255,255,0.25)" : "none" }}>
          <div style={{ ...font(28, 500, s.dark ? "#FFD889" : P.bronze), letterSpacing: "0.2em" }}>{s.n}</div>
          <div style={{ ...font(96, 900, s.dark ? "#FFFFFF" : P.ink), marginTop: 6 }}>{s.label}</div>
        </div>
      ) : null)}

      {/* the hospital opposite, tagged as the drone passes */}
      {hospO > 0 && !hosp.behind ? (
        <div style={{ position: "absolute", left: Math.min(Math.max(70, hosp.x - 40), 940 - 420), top: Math.max(470, hosp.y - 150), width: 420, opacity: hospO,
          background: "#FFFFFF", borderRadius: 18, padding: "14px 22px", boxShadow: "0 10px 24px rgba(0,0,0,0.22)", borderLeft: "10px solid #C8102E" }}>
          <div style={{ ...font(24, 700, "#C8102E"), letterSpacing: "0.14em", textTransform: "uppercase" }}>{m.landmark.relation}</div>
          <div style={{ ...font(42, 900), marginTop: 4 }}>{m.landmark.title}</div>
        </div>
      ) : null}

      {/* arrival: pin at the entrance + card */}
      <div style={{ position: "absolute", left: door.x, top: door.y, transform: `translate(-50%, -100%) translateY(${(1 - pin) * -160}px)`, opacity: Math.min(1, pin * 3) }}>
        <svg viewBox="0 0 24 32" style={{ width: 110, height: 147, filter: "drop-shadow(0 10px 12px rgba(0,0,0,0.4))" }}>
          <path d="M12 31s10-11 10-19A10 10 0 0 0 2 12c0 8 10 19 10 19z" fill={accent} />
          <circle cx="12" cy="12" r="4" fill={P.paper} />
        </svg>
      </div>
      <div style={{ position: "absolute", left: 70, top: 290, width: 640, opacity: card, transform: `translateY(${(1 - card) * 20}px)`,
        background: "#FFFFFF", borderRadius: 20, padding: "20px 28px", boxShadow: "0 12px 28px rgba(0,0,0,0.25)", borderLeft: `12px solid ${accent}` }}>
        <div style={font(60, 900)}>{clinic.name}</div>
        <div style={{ ...font(32, 500, P.soft), marginTop: 8 }}>Ahsan Medical Centre · {m.road}</div>
        <div style={{ ...font(28, 700, "#C8102E"), marginTop: 8 }}>{m.landmark.relation} {m.landmark.title}</div>
      </div>

      {/* licence credits + honesty chip */}
      <div style={{ position: "absolute", left: 70, top: 1452, ...font(22, 600, P.ink), lineHeight: 1.3, background: "rgba(255,255,255,0.85)",
        padding: "8px 16px", borderRadius: 14, maxWidth: 830 }}>
        {m.chip} · NASA Blue Marble · Contains modified Copernicus Sentinel data (2026)
      </div>
    </AbsoluteFill>
  );
};
