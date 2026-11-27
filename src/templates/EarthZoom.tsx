import React, { useMemo } from "react";
import { AbsoluteFill, Img, OffthreadVideo, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { clinic, video } from "../brand";
import { carousel as P } from "../theme";
import type { EarthZoomBrief } from "../brief/schema";
import { SITE, buildRealCity } from "../three/realcity";
import geo from "../data/realmap.json";
import track from "../data/panels-track.json";
import { ClinicModel, FACADE, RealFacadeBuilding, Traffic, routeGeometry, useFontReady, useTex, windowTex } from "./promo/DroneMap";
import { Shell, type QcProps } from "./shared/Shell";

/**
 * Earth → Dental House in ONE camera move through ONE 3D world (owner T28/T29). Local metres around the clinic pin
 * (x east, y up, z south); Earth is a sphere of radius R centred at (0, −R, 0), turned so the pin is on top.
 * Ground = stacked, edge-feathered imagery levels on the curved surface, each fading in as the camera's footprint
 * shrinks: NASA Blue Marble globe → Pakistan → Sentinel-2 160 km → 60 km → 12.4 km → street plan (OpenStreetMap) with
 * illustrative blocks that grow out of the satellite colours. The last frame matches the owner's drive-by clip, which
 * follows as a matched cut. Text, pin and route are ours (no AI, no Google).
 */
const W = video.width, H = video.height;
const R = 6_371_000;
const C = new THREE.Vector3(0, -R, 0);
const rx = SITE.roadX, cl = SITE.clinic, lm = SITE.landmark;
const LAT0 = 32.5054616, LON0 = 74.546536;
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const D2R = Math.PI / 180;

// ---------- smooth keyframe curves (monotone cubic: no overshoot) ------------------------------------------------------------
function mono(xs: number[], ys: number[]) {
  const n = xs.length, d: number[] = [], m: number[] = [];
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  m.push(d[0]);
  for (let i = 1; i < n - 1; i++) m.push(d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2);
  m.push(d[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], h = a * a + b * b;
    if (h > 9) { const t = 3 / Math.sqrt(h); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  return (x: number) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}
const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ---------- the one camera path (s = 0..1 over the zoom) -------------------------------------------------------------------------
const END = { x: rx + 3, h: 1.5, z: 1 }; // the drive-by position: mid-road, eye level, moving north, facing the clinic (west)
const S = [0, 0.12, 0.3, 0.45, 0.55, 0.64, 0.72, 0.8, 0.88, 0.95, 1];
const logH = mono(S, [4.6e7, 1.1e7, 8e5, 12000, 1500, 380, 110, 35, 7, 2.4, END.h].map(Math.log10));
// ground track: slides south while pitching up, then flies north up Commissioner Road and slows to the drive-by speed (~3 m/s)
const SX = [0.45, 0.55, 0.64, 0.72, 0.8, 0.88, 0.95, 1];
const offX = mono(SX, [0, rx + 40, rx + 15, rx + 5, rx + 3, rx + 5, rx + 5, END.x]);
const offZ = mono(SX, [0, 700, 520, 330, 170, 30, 7, END.z]);
const pitch = mono(SX, [-90, -62, -45, -32, -20, -6, 10, 19]);
const yaw = mono([0.45, 0.84, 0.95, 1], [0, 0, 70, 90]); // turn left to face the clinic only at the very end
const fovAt = mono([0, 0.3, 0.84, 1], [36, 40, 52, 64]); // ends at the phone's portrait field of view
const D0 = new THREE.Vector3(-0.42, 0.8, 0.43).normalize(); // start: over the Arabian Sea side, Earth turns Pakistan into view

function camAt(s: number) {
  const h = 10 ** logH(s);
  const w = smooth(0, 0.42, s);
  const dir = D0.clone().lerp(new THREE.Vector3(0, 1, 0), w).normalize();
  const pos = C.clone().add(dir.clone().multiplyScalar(R + h));
  if (s > 0.45) pos.set(offX(s), h, offZ(s));
  const c = new THREE.PerspectiveCamera(fovAt(s), W / H, Math.max(0.08, h * 0.01), h > 2e5 ? h + 1.4e7 : Math.sqrt(2 * R * h) + 30000);
  c.position.copy(pos);
  if (s <= 0.45) {
    c.up.set(0, 0, -1).lerp(dir, 0).normalize(); // north up on screen
    c.up.copy(new THREE.Vector3(0, 0, -1));
    c.lookAt(C);
  } else {
    const p = pitch(s) * D2R, y = yaw(s) * D2R;
    const f = new THREE.Vector3(-Math.sin(y) * Math.cos(p), Math.sin(p), -Math.cos(y) * Math.cos(p));
    c.up.set(0, 1, 0).lerp(new THREE.Vector3(-Math.sin(y), 0, -Math.cos(y)), smooth(-70, -90, pitch(s))).normalize();
    c.lookAt(pos.clone().add(f));
  }
  c.updateProjectionMatrix();
  c.updateMatrixWorld();
  return { cam: c, h };
}
const Rig: React.FC<{ cam: THREE.PerspectiveCamera }> = ({ cam }) => {
  const camera = useThree((st) => st.camera) as THREE.PerspectiveCamera;
  camera.fov = cam.fov; camera.near = cam.near; camera.far = cam.far;
  camera.position.copy(cam.position); camera.quaternion.copy(cam.quaternion);
  camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  return null;
};
function project(c: THREE.Camera, p: THREE.Vector3) {
  const q = p.clone().project(c);
  return { x: ((q.x + 1) / 2) * W, y: ((1 - q.y) / 2) * H, ok: q.z < 1 && q.z > -1 };
}

// ---------- ground: globe + curved, feathered imagery caps --------------------------------------------------------------------
/** globe turned so (LON0, LAT0) points up and north points to −z */
function globeRotation() {
  const sph = (lon: number, lat: number) => {
    const th = ((lon + 180) / 360) * Math.PI * 2, ph = lat * D2R;
    return new THREE.Vector3(-Math.cos(th) * Math.cos(ph), Math.sin(ph), Math.sin(th) * Math.cos(ph));
  };
  const u = sph(LON0, LAT0).normalize();
  const e = sph(LON0 + 0.01, LAT0).sub(sph(LON0 - 0.01, LAT0)).normalize();
  const n = new THREE.Vector3().crossVectors(u, e).normalize(); // north
  const local = new THREE.Matrix4().makeBasis(e, u, n);
  const world = new THREE.Matrix4().makeBasis(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, -1));
  return world.multiply(local.transpose());
}
/** an imagery level on the curved surface; alpha feathers to 0 at the edges */
function capGeometry(b: number[], seg = 128, feather = 0.14) {
  const g = new THREE.PlaneGeometry(1, 1, seg, seg);
  const pos = g.attributes.position, uv = g.attributes.uv;
  const col = new Float32Array(pos.count * 4);
  for (let i = 0; i < pos.count; i++) {
    const u = uv.getX(i), v = uv.getY(i);
    const x = b[0] + u * (b[2] - b[0]), yN = b[1] + v * (b[3] - b[1]);
    const r2 = x * x + yN * yN;
    pos.setXYZ(i, x, Math.sqrt(Math.max(0, R * R - r2)) - R, -yN);
    const edge = Math.min(u, 1 - u, v, 1 - v);
    col.set([1, 1, 1, smooth(0, feather, edge)], i * 4);
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 4));
  g.computeVertexNormals();
  return g;
}

const Ground: React.FC<{ h: number; sat: (THREE.Texture | null)[]; world: THREE.Texture | null }> = ({ h, sat, world }) => {
  const rot = useMemo(() => globeRotation(), []);
  const caps = useMemo(() => geo.pyramid.map((l, i) => capGeometry(l.bounds, i === 0 ? 160 : 96, i === 0 ? 0.08 : 0.16)), []);
  // each level fades in as the view footprint shrinks below a few times its size
  const fades = [[3.5e6, 1.6e6], [3.2e5, 1.6e5], [1.1e5, 5.5e4], [2.4e4, 1.2e4]];
  const globeO = interpolate(Math.log10(h), [Math.log10(1.2e5), Math.log10(2.5e5)], [0, 1], clamp);
  return (
    <group>
      {globeO > 0 ? (
        <group position={C} rotation={new THREE.Euler().setFromRotationMatrix(rot)}>
          <mesh renderOrder={-10}>
            <sphereGeometry args={[R, 192, 128]} />
            {world ? <meshStandardMaterial map={world} roughness={0.9} depthWrite={false} transparent opacity={globeO} /> : <meshStandardMaterial color="#1F4E79" depthWrite={false} />}
          </mesh>
          <mesh renderOrder={-11}>
            <sphereGeometry args={[R * 1.022, 96, 64]} />
            <meshBasicMaterial color="#7DB7FF" transparent opacity={0.2 * globeO} side={THREE.BackSide} depthWrite={false} />
          </mesh>
        </group>
      ) : null}
      {geo.pyramid.map((l, i) => {
        const [a, b] = fades[i];
        const o = interpolate(Math.log10(h), [Math.log10(b), Math.log10(a)], [1, 0], clamp);
        if (o <= 0.001 || !sat[i]) return null;
        return (
          <mesh key={l.src} geometry={caps[i]} renderOrder={-9 + i}>
            <meshBasicMaterial map={sat[i]} vertexColors transparent opacity={o} depthWrite={false} toneMapped={false} />
          </mesh>
        );
      })}
    </group>
  );
};

// ---------- city ----------------------------------------------------------------------------------------------------------------
function satSampler(tex: THREE.Texture | null, b: number[]) {
  if (!tex?.image) return undefined;
  const img = tex.image as HTMLImageElement;
  const cv = document.createElement("canvas");
  cv.width = img.width; cv.height = img.height;
  const g = cv.getContext("2d")!;
  g.drawImage(img, 0, 0);
  const data = g.getImageData(0, 0, cv.width, cv.height).data;
  return (x: number, z: number) => {
    const u = (x - b[0]) / (b[2] - b[0]), v = (-z - b[1]) / (b[3] - b[1]);
    if (u < 0 || u > 1 || v < 0 || v > 1) return null;
    const i = (Math.floor((1 - v) * (cv.height - 1)) * cv.width + Math.floor(u * (cv.width - 1))) * 4;
    return new THREE.Color(`rgb(${data[i]},${data[i + 1]},${data[i + 2]})`).convertSRGBToLinear().convertLinearToSRGB();
  };
}

const City: React.FC<{ h: number; s: number; time: number; route: number; routeColor: string; signs: boolean; satCity: THREE.Texture | null; facade: THREE.Texture | null }> = ({ h, s, time, route, routeColor, signs, satCity, facade }) => {
  const cityB = geo.pyramid[geo.pyramid.length - 1].bounds;
  const g = useMemo(() => buildRealCity(11, 1100, satSampler(satCity, cityB)), [satCity, cityB]);
  const win = useMemo(() => windowTex(), []);
  const rt = useMemo(() => routeGeometry(), []);
  const rise = interpolate(Math.log10(h), [Math.log10(450), Math.log10(2200)], [1, 0], clamp);
  const paved = interpolate(Math.log10(h), [Math.log10(160), Math.log10(700)], [1, 0], clamp);
  const roads = interpolate(Math.log10(h), [Math.log10(900), Math.log10(3000)], [1, 0], clamp);
  const n = (gg: THREE.BufferGeometry, k: number) => gg.setDrawRange(0, Math.floor(((gg.index?.count ?? 0) * k) / 3) * 3);
  n(rt.core, route); n(rt.glow, route);
  const routeO = interpolate(s, [0.84, 0.89], [1, 0], clamp);
  if (rise <= 0 && roads <= 0) return null;
  return (
    <group>
      {paved > 0 ? (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} renderOrder={-2} receiveShadow>
          <circleGeometry args={[1150, 96]} /><meshStandardMaterial color="#D9D0C0" roughness={1} transparent opacity={paved} depthWrite={false} />
        </mesh>
      ) : null}
      <mesh geometry={g.roads} receiveShadow><meshStandardMaterial color="#8B877F" roughness={0.95} transparent opacity={roads} /></mesh>
      <mesh geometry={g.hero} receiveShadow><meshStandardMaterial color="#56534F" roughness={0.9} transparent opacity={roads} /></mesh>
      <mesh geometry={g.lines}><meshBasicMaterial color="#F6F3EC" transparent opacity={roads} /></mesh>
      <group scale={[1, Math.max(0.001, rise), 1]}>
        <mesh geometry={g.blocks} castShadow receiveShadow><meshStandardMaterial vertexColors map={win} roughness={0.85} /></mesh>
        <mesh geometry={g.named} castShadow receiveShadow><meshStandardMaterial vertexColors map={win} roughness={0.85} /></mesh>
        <mesh geometry={g.tanks} castShadow><meshStandardMaterial vertexColors roughness={0.6} /></mesh>
        <mesh geometry={g.trees} castShadow><meshStandardMaterial vertexColors roughness={0.85} flatShading /></mesh>
        {facade ? <RealFacadeBuilding facade={facade} /> : <ClinicModel accent={P.ink} signs={signs} dhSign={false} />}
      </group>
      {rise > 0.95 ? <Traffic time={time} hide={(x, z) => s > 0.82 && Math.abs(x - END.x) < 14 && z > -40 && z < 70} /> : null}
      {route > 0 && routeO > 0 ? (
        <>
          <mesh geometry={rt.glow}><meshBasicMaterial color={routeColor} transparent opacity={0.3 * routeO} toneMapped={false} depthWrite={false} /></mesh>
          <mesh geometry={rt.core}><meshBasicMaterial color="#E3F3FF" transparent opacity={routeO} toneMapped={false} /></mesh>
        </>
      ) : null}
    </group>
  );
};

// ---------- doctors' board highlight ------------------------------------------------------------------------------------------------
/** panel corners on the straightened front (UV of facade-rect.jpg), see scripts/track_panels.py */
const PANEL_UV: Record<"usman" | "ayesha", number[][]> = {
  ayesha: [[0.0691, 0.5659], [0.1274, 0.5667], [0.132, 0.6066], [0.074, 0.6058]],
  usman: [[0.1274, 0.5667], [0.1868, 0.5675], [0.1911, 0.6074], [0.132, 0.6066]],
};
const panelWorld = (u: number, v: number) => new THREE.Vector3(cl.front + 0.06, FACADE.h * (1 - v), cl.z + FACADE.w / 2 - u * FACADE.w);
type Pt = { x: number; y: number };
const GLOW = "#FFC94D";

const Highlights: React.FC<{ docs: EarthZoomBrief["highlight_doctors"]; polys: Partial<Record<"usman" | "ayesha", Pt[]>>; o: number; lines: number; pulse: number }> = ({ docs, polys, o, lines, pulse }) => {
  if (o <= 0 || !docs.length) return null;
  // cards side by side above the board, ordered like the panels (left panel → left card) so the lines never cross
  const order = [...docs].sort((a, b) => (polys[a.panel]?.[0].x ?? 0) - (polys[b.panel]?.[0].x ?? 0));
  const cardW = 445, gap = 26, top = 600, cardH = 104;
  const cardX = (i: number) => 70 + i * (cardW + gap);
  return (
    <AbsoluteFill style={{ opacity: o }}>
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        <defs><filter id="glow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation={8 + 5 * pulse} /></filter></defs>
        {order.map((d, i) => {
          const p = polys[d.panel];
          if (!p) return null;
          const pts = p.map((q) => `${q.x},${q.y}`).join(" ");
          const tip = { x: (p[0].x + p[1].x) / 2, y: Math.min(p[0].y, p[1].y) - 6 };
          const visible = tip.x > -20 && tip.x < W + 20;
          const from = { x: cardX(i) + cardW / 2, y: top + cardH };
          return (
            <g key={d.panel}>
              <polygon points={pts} fill={`rgba(255,201,77,${0.22 + 0.12 * pulse})`} stroke={GLOW} strokeWidth={14} filter="url(#glow)" />
              <polygon points={pts} fill="none" stroke={GLOW} strokeWidth={5} strokeLinejoin="round" />
              {visible ? (
                <g opacity={lines}>
                  <path d={`M ${from.x} ${from.y} C ${from.x} ${from.y + 60}, ${tip.x} ${tip.y - 70}, ${tip.x} ${tip.y}`} fill="none" stroke={GLOW} strokeWidth={5} strokeLinecap="round" />
                  <circle cx={tip.x} cy={tip.y} r={8} fill={GLOW} />
                </g>
              ) : null}
            </g>
          );
        })}
      </svg>
      {order.map((d, i) => (
        <div key={d.panel} style={{ position: "absolute", left: cardX(i), top, width: cardW, height: cardH, boxSizing: "border-box", background: "rgba(255,255,255,0.97)",
          borderRadius: 18, padding: "14px 20px", boxShadow: "0 10px 24px rgba(0,0,0,0.25)", borderBottom: `8px solid ${GLOW}` }}>
          <div style={{ fontFamily: P.headline, fontWeight: 900, fontSize: 34, color: P.ink, lineHeight: 1.05, whiteSpace: "nowrap" }}>{d.name}</div>
          <div style={{ fontFamily: P.headline, fontWeight: 600, fontSize: 24, color: "#6B5A2A", marginTop: 6, letterSpacing: "0.08em", textTransform: "uppercase" }}>{d.role}</div>
        </div>
      ))}
    </AbsoluteFill>
  );
};

// ---------- page -------------------------------------------------------------------------------------------------------------------
const lerpColor = (a: string, b: string, t: number) => "#" + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString();

export const EarthZoom: React.FC<{ brief: EarthZoomBrief } & QcProps> = ({ brief, showSafeZones }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const zoomFrames = Math.round(brief.seconds * fps);
  const s0 = Math.min(1, frame / (zoomFrames - 1));
  // "sialkot" start = the same single camera path, entered at ~18 km straight above the city (satellite only)
  const s = brief.start === "sialkot" ? 0.43 + 0.57 * s0 : s0;
  const { cam, h } = camAt(s);
  const signs = useFontReady();
  const world = useTex("footage/realmap/world.jpg");
  const lv = geo.pyramid.map((l) => l.src);
  const t0 = useTex(lv[0]), t1 = useTex(lv[1]), t2 = useTex(lv[2]), t3 = useTex(lv[3]);
  const sat = [t0, t1, t2, t3];
  const facade = useTex("footage/arrival/facade-rect.jpg");

  // sky: space → blue haze as we come down
  const lh = Math.log10(h);
  const skyT = interpolate(lh, [Math.log10(3e4), Math.log10(6e5)], [1, 0], clamp);
  const sky = lerpColor("#03060F", "#BFD6EA", skyT);
  const fogOn = h < 8e4;
  const route = interpolate(s, [0.55, 0.9], [0, 1], clamp);
  const shadows = h < 900;

  const pinW = new THREE.Vector3(cl.x, cl.h + 4, cl.z);
  const pinP = project(cam, pinW);
  const pinIn = spring({ frame: frame - Math.round(0.8 * zoomFrames), fps, config: { damping: 10, stiffness: 170 } });
  const pinO = interpolate(s, [0.8, 0.83, 0.95, 0.985], [0, 1, 1, 0], clamp);
  const lmP = project(cam, new THREE.Vector3(lm.front + 4, lm.h + 2, lm.z + 8));
  const lmO = interpolate(s, [0.78, 0.81, 0.87, 0.9], [0, 1, 1, 0], clamp);
  const cardO = interpolate(frame, [Math.round(0.91 * zoomFrames), Math.round(0.95 * zoomFrames)], [0, 1], clamp);
  const creditO = interpolate(s, [0, 0.04, 0.7, 0.76], [0, 1, 1, 0], clamp);
  const clipStart = zoomFrames;
  // doctors' panels: projected on the 3D front during the approach, tracked in the real clip after the cut
  const polys: Partial<Record<"usman" | "ayesha", Pt[]>> = {};
  if (frame < clipStart) {
    for (const k of ["usman", "ayesha"] as const) polys[k] = PANEL_UV[k].map(([u, v]) => project(cam, panelWorld(u, v)));
  } else {
    const tf = track.frames[Math.min(track.frames.length - 1, frame - clipStart)] as Record<string, unknown>;
    if (tf?.ok) for (const k of ["usman", "ayesha"] as const) polys[k] = (tf[k] as number[][]).map(([x, y]) => ({ x: (x / track.width) * W, y: (y / track.height) * H }));
  }
  const hlO = interpolate(s, [0.9, 0.95], [0, 1], clamp);
  const hlLines = frame >= clipStart ? interpolate(frame - clipStart, [40, 60], [1, 0], clamp) : 1;

  return (
    <Shell brief={brief} endSeconds={0} chrome="none" backdrop={false} end={<></>} showSafeZones={showSafeZones}>
      <AbsoluteFill style={{ background: sky }}>
        {frame < clipStart ? (
          <ThreeCanvas width={W} height={H} shadows camera={{ fov: 36, near: 1, far: 1e8, position: [0, 2.6e7, 0] }} gl={{ antialias: true }}>
            <color attach="background" args={[sky]} />
            {fogOn ? <fog attach="fog" args={[sky, h * 2 + 400, h * 14 + 4000]} /> : null}
            <Rig cam={cam} />
            <hemisphereLight args={["#EEF5FF", "#CDBFA6", 0.9]} />
            <ambientLight intensity={h > 2e5 ? 0.25 : 0} />
            {/* one sun for the whole move: morning, east-south-east (the drive-by facade is sunlit) */}
            <directionalLight position={[420, 520, 180]} intensity={2.2} color="#FFF1DC" castShadow={shadows}
              shadow-mapSize={[4096, 4096]} shadow-bias={-0.0004}
              shadow-camera-left={-260} shadow-camera-right={260} shadow-camera-top={260} shadow-camera-bottom={-260}
              shadow-camera-near={10} shadow-camera-far={2000} />
            <Ground h={h} sat={sat} world={world} />
            <City h={h} s={s} time={frame / fps} route={brief.overlays ? route : 0} routeColor={brief.route_color} signs={signs} satCity={t3} facade={facade} />
          </ThreeCanvas>
        ) : null}
      </AbsoluteFill>

      {/* matched cut: the owner's real drive-by continues the move */}
      {brief.end_frame ? (
        <Sequence from={clipStart}>
          <AbsoluteFill>
            {/\.(mp4|mov|webm)$/i.test(brief.end_frame)
              ? <OffthreadVideo src={staticFile(brief.end_frame)} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <Img src={staticFile(brief.end_frame)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
          </AbsoluteFill>
        </Sequence>
      ) : null}

      {/* Dental House logo pin over Ahsan Medical Centre */}
      {brief.overlays && pinO > 0 && pinP.ok ? (
        <div style={{ position: "absolute", left: pinP.x, top: pinP.y, opacity: pinO, transform: `translate(-50%, -100%) translateY(${(1 - pinIn) * -140}px) scale(${0.85 + 0.15 * pinIn})`, transformOrigin: "bottom center" }}>
          <svg viewBox="0 0 120 160" style={{ width: 150, height: 200, filter: "drop-shadow(0 12px 14px rgba(0,0,0,0.4))" }}>
            <path d="M60 156 C60 156 112 96 112 56 A52 52 0 0 0 8 56 C8 96 60 156 60 156 Z" fill="#333C39" stroke="#C9AB86" strokeWidth={4} />
            <circle cx="60" cy="56" r="40" fill="#FBF7F0" />
          </svg>
          <Img src={staticFile("brand/mark.png")} style={{ position: "absolute", left: 75 - 34, top: 70 - 30, width: 68 }} />
        </div>
      ) : null}

      {/* landmark opposite, small (compliance: landmark only) */}
      {brief.overlays && lmO > 0 && lmP.ok && brief.landmark ? (
        <div style={{ position: "absolute", left: Math.min(Math.max(70, lmP.x - 60), 940 - 440), top: Math.max(300, lmP.y - 140), width: 440, opacity: lmO,
          background: "rgba(255,255,255,0.94)", borderRadius: 16, padding: "12px 20px", boxShadow: "0 8px 20px rgba(0,0,0,0.2)" }}>
          <div style={{ fontFamily: P.headline, fontWeight: 700, fontSize: 24, color: P.bronze, letterSpacing: "0.14em", textTransform: "uppercase" }}>{brief.landmark.relation}</div>
          <div style={{ fontFamily: P.headline, fontWeight: 900, fontSize: 34, color: P.ink, lineHeight: 1.05, marginTop: 4 }}>{brief.landmark.title}</div>
          {brief.landmark.sub ? <div style={{ fontFamily: P.headline, fontWeight: 500, fontSize: 24, color: "#4E5551", marginTop: 4 }}>{brief.landmark.sub}</div> : null}
        </div>
      ) : null}

      {/* arrival card: stays through the matched cut */}
      {brief.overlays && cardO > 0 ? (
        <div style={{ position: "absolute", left: 70, top: 300, width: 660, opacity: cardO, transform: `translateY(${(1 - cardO) * 18}px)`,
          background: "#FFFFFF", borderRadius: 20, padding: "20px 28px", boxShadow: "0 12px 28px rgba(0,0,0,0.25)", borderLeft: "12px solid #333C39" }}>
          <div style={{ fontFamily: P.headline, fontWeight: 900, fontSize: 62, color: P.ink, lineHeight: 1 }}>{clinic.name}</div>
          <div style={{ fontFamily: P.headline, fontWeight: 500, fontSize: 32, color: "#4E5551", marginTop: 10 }}>in {clinic.addressShort}</div>
        </div>
      ) : null}

      {brief.overlays ? <Highlights docs={brief.highlight_doctors} polys={polys} o={hlO} lines={hlLines} pulse={0.5 + 0.5 * Math.sin(frame / 5)} /> : null}

      {/* licence credits + honesty chip */}
      {brief.overlays ? <div style={{ position: "absolute", left: 70, top: 1470, maxWidth: 840, fontFamily: P.headline, fontWeight: 600, fontSize: 24, lineHeight: 1.3,
        color: P.ink, background: "rgba(255,255,255,0.86)", padding: "8px 16px", borderRadius: 14 }}>
        {frame < clipStart ? brief.chip : "Real footage"}
        {creditO > 0 ? <span style={{ opacity: creditO }}> · NASA Blue Marble · Contains modified Copernicus Sentinel data (2026)</span> : null}
      </div> : null}
    </Shell>
  );
};
