import React, { useMemo } from "react";
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { clinic, video } from "../../brand";
import { carousel as P } from "../../theme";
import type { PromoBrief } from "../../brief/schema";
import { CITY_COLORS as C, SITE, buildRealCity } from "../../three/realcity";

/**
 * Drone flight down Commissioner Road to Dental House (own_map.style: drone; owner: "3d drone view leading to Dental house").
 * Real street plan from OpenStreetMap, procedural clay buildings, our own model of the clinic building with its sign and the
 * Trauma Centre directly opposite. An illustration on a real plan: the chip says so and credits OSM.
 */
const FOV = 50;
const W = video.width, H = video.height;
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const rx = SITE.roadX;
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
// flying north (towards -z) along the road, from high over the south end down to the clinic front
const POS = new THREE.CatmullRomCurve3([v(rx + 110, 360, 1150), v(rx + 40, 170, 640), v(rx + 16, 95, 340), v(rx + 5, 70, 150)]);
const LOOK = new THREE.CatmullRomCurve3([v(rx, 0, 380), v(rx, 0, 150), v(rx - 3, 2, 6), v(rx + 1, 0, -8)]);

const font = (size: number, weight = 900, color: string = P.ink): React.CSSProperties => ({
  fontFamily: P.headline, fontWeight: weight, fontSize: size, color, lineHeight: 1.0, letterSpacing: weight >= 900 ? "-0.02em" : "0",
});

function camAt(t: number) {
  const c = new THREE.PerspectiveCamera(FOV, W / H, 1, 6000);
  c.position.copy(POS.getPoint(t));
  c.lookAt(LOOK.getPoint(t));
  c.updateMatrixWorld();
  return c;
}
function project(c: THREE.PerspectiveCamera, p: THREE.Vector3) {
  const q = p.clone().project(c);
  return { x: ((q.x + 1) / 2) * W, y: ((1 - q.y) / 2) * H };
}

const Rig: React.FC<{ t: number }> = ({ t }) => {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  camera.fov = FOV;
  camera.near = 1;
  camera.far = 6000;
  camera.position.copy(POS.getPoint(t));
  camera.lookAt(LOOK.getPoint(t));
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  return null;
};

function signTexture(draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, w = 1024, h = 160) {
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  draw(cv.getContext("2d")!, w, h);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

const Scene: React.FC<{ accent: string }> = ({ accent }) => {
  const g = useMemo(() => buildRealCity(11), []);
  const cl = SITE.clinic, lm = SITE.landmark;
  const clinicSign = useMemo(() => signTexture((x, w, h) => {
    x.fillStyle = accent; x.fillRect(0, 0, w, h);
    x.fillStyle = "#FFFFFF"; x.font = "900 108px Roboto, Arial, sans-serif"; x.textAlign = "center"; x.textBaseline = "middle";
    x.fillText("DENTAL HOUSE", w / 2, h / 2 + 6);
  }), [accent]);
  const hospitalSign = useMemo(() => signTexture((x, w, h) => {
    x.fillStyle = "#FFFFFF"; x.fillRect(0, 0, w, h);
    x.fillStyle = "#C8102E"; x.fillRect(w / 2 - 22, 20, 44, 120); x.fillRect(w / 2 - 60, 58, 120, 44);
  }, 512, 160), []);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[6000, 6000]} />
        <meshStandardMaterial color={C.ground} roughness={1} />
      </mesh>
      <mesh geometry={g.roads} receiveShadow><meshStandardMaterial color={C.road} roughness={1} /></mesh>
      <mesh geometry={g.hero} receiveShadow><meshStandardMaterial color={C.hero} roughness={0.95} /></mesh>
      <mesh geometry={g.lines}><meshBasicMaterial color={C.line} /></mesh>
      <mesh geometry={g.blocks} castShadow receiveShadow><meshStandardMaterial vertexColors roughness={0.9} /></mesh>
      <mesh geometry={g.tanks} castShadow><meshStandardMaterial vertexColors roughness={0.6} /></mesh>
      <mesh geometry={g.trees} castShadow><meshStandardMaterial vertexColors roughness={0.85} flatShading /></mesh>
      {/* Dental House sign across the clinic front (faces the road, east) */}
      <mesh position={[cl.front + 0.15, cl.h - 4.2, cl.z]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[cl.len * 0.86, cl.len * 0.86 * (160 / 1024)]} />
        <meshBasicMaterial map={clinicSign} toneMapped={false} />
      </mesh>
      {/* rooftop sign facing the approaching drone (south), turned a little towards the road */}
      <group position={[cl.x + 1, cl.h, cl.z + cl.len * 0.3]} rotation={[0, 0.35, 0]}>
        <mesh position={[0, 4.8, 0]}>
          <planeGeometry args={[24, 24 * (160 / 1024)]} />
          <meshBasicMaterial map={clinicSign} toneMapped={false} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[-8, 1.4, -0.2]}><boxGeometry args={[0.4, 2.8, 0.4]} /><meshStandardMaterial color="#3E4744" /></mesh>
        <mesh position={[8, 1.4, -0.2]}><boxGeometry args={[0.4, 2.8, 0.4]} /><meshStandardMaterial color="#3E4744" /></mesh>
      </group>
      {/* rooftop red cross on the hospital, also facing south */}
      <mesh position={[lm.x - 4, lm.h + 3.5, lm.z + lm.len * 0.35]} rotation={[0, -0.25, 0]}>
        <planeGeometry args={[11, 3.4]} />
        <meshBasicMaterial map={hospitalSign} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      {/* red-cross panel on the hospital front (faces the road, west) */}
      <mesh position={[lm.front - 0.15, lm.h - 4, lm.z]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[12, 3.75]} />
        <meshBasicMaterial map={hospitalSign} toneMapped={false} />
      </mesh>
    </group>
  );
};

export const DroneMap: React.FC<{ brief: PromoBrief; accent: string; len: number }> = ({ brief, accent, len }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const m = brief.own_map!;
  const f = (x: number) => Math.round((x / 138) * len); // timeline authored for 138 frames, scaled to the page length

  const t = interpolate(frame, [0, f(100)], [0, 1], { ...clamp, easing: Easing.bezier(0.3, 0.05, 0.2, 1) });
  const cam = camAt(t);
  const cP = project(cam, v(SITE.clinic.x + 1, SITE.clinic.h + 7.5, SITE.clinic.z + SITE.clinic.len * 0.3)); // just above the rooftop sign
  const lRaw = project(cam, v(SITE.landmark.front + 3, SITE.landmark.h + 2, SITE.landmark.z + SITE.landmark.len * 0.3));
  const lP = { x: Math.min(lRaw.x, 880), y: lRaw.y }; // keep clear of the Reels buttons
  const pin = spring({ frame: frame - f(98), fps, config: { damping: 9, stiffness: 200 } });
  const tag = interpolate(frame, [f(102), f(108)], [0, 1], clamp);
  const link = interpolate(frame, [f(108), f(116)], [0, 1], { ...clamp, easing: Easing.bezier(0.5, 0, 0.3, 1) });
  const card = interpolate(frame, [f(114), f(120)], [0, 1], clamp);
  const label = interpolate(frame, [f(4), f(12), f(92), f(100)], [0, 1, 1, 0], clamp);

  return (
    <AbsoluteFill style={{ background: C.sky, overflow: "hidden" }}>
      <ThreeCanvas width={W} height={H} shadows camera={{ fov: FOV, near: 1, far: 6000, position: [0, 300, 1000] }} gl={{ antialias: true }}>
        <color attach="background" args={[C.sky]} />
        <fog attach="fog" args={[C.sky, 450, 1500]} />
        <Rig t={t} />
        <hemisphereLight args={["#ffffff", "#d9cbb5", 1.1]} />
        <directionalLight position={[-420, 520, 260]} intensity={1.9} color="#fff3e2" castShadow
          shadow-mapSize={[4096, 4096]} shadow-bias={-0.0004}
          shadow-camera-left={-700} shadow-camera-right={700} shadow-camera-top={700} shadow-camera-bottom={-700}
          shadow-camera-near={10} shadow-camera-far={2000} />
        <Scene accent={accent} />
      </ThreeCanvas>

      {/* road label while flying */}
      {label > 0 ? (
        <div style={{ position: "absolute", left: 70, top: 270, opacity: label, transform: `translateY(${(1 - label) * 18}px)`,
          background: "rgba(251,247,240,0.92)", borderRadius: 22, padding: "16px 26px 20px", boxShadow: "0 8px 24px rgba(0,0,0,0.18)" }}>
          <div style={{ ...font(28, 500, P.bronze), letterSpacing: "0.2em" }}>{m.city.toUpperCase()}</div>
          <div style={{ ...font(92, 900), marginTop: 6 }}>{m.road}</div>
        </div>
      ) : null}

      {/* clinic pin + tag */}
      <div style={{ position: "absolute", left: cP.x, top: cP.y, transform: `translate(-50%, -100%) translateY(${(1 - pin) * -140}px)`, opacity: Math.min(1, pin * 3) }}>
        <svg viewBox="0 0 24 32" style={{ width: 100, height: 133, filter: "drop-shadow(0 8px 10px rgba(0,0,0,0.35))" }}>
          <path d="M12 31s10-11 10-19A10 10 0 0 0 2 12c0 8 10 19 10 19z" fill={accent} />
          <circle cx="12" cy="12" r="4" fill={P.paper} />
        </svg>
      </div>
      <div style={{ position: "absolute", left: Math.max(70, Math.min(cP.x - 250, 940 - 460)), top: cP.y - 330, width: 460, opacity: tag,
        transform: `scale(${0.92 + 0.08 * tag})`, transformOrigin: "center bottom", background: "#FFFFFF", borderRadius: 18, padding: "16px 24px",
        boxShadow: "0 10px 24px rgba(0,0,0,0.22)", borderLeft: `10px solid ${accent}` }}>
        <div style={font(50, 900)}>{clinic.name}</div>
        <div style={{ ...font(30, 500, P.soft), marginTop: 6 }}>{m.road}</div>
      </div>

      {/* landmark directly opposite */}
      <svg width={W} height={H} style={{ position: "absolute", inset: 0, opacity: link > 0 ? 1 : 0 }}>
        <path d={`M ${cP.x} ${cP.y - 20} Q ${(cP.x + lP.x) / 2} ${Math.min(cP.y, lP.y) - 140} ${lP.x} ${lP.y - 20}`}
          fill="none" stroke={P.ink} strokeWidth={6} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - link} />
      </svg>
      <div style={{ position: "absolute", left: lP.x - 40, top: lP.y - 60, width: 80, height: 80, borderRadius: "50%", background: "#FFFFFF",
        border: `6px solid ${accent}`, transform: `scale(${link})`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 18px rgba(0,0,0,0.3)" }}>
        <div style={{ position: "relative", width: 36, height: 36 }}>
          <div style={{ position: "absolute", left: 13, top: 0, width: 10, height: 36, background: accent }} />
          <div style={{ position: "absolute", left: 0, top: 13, width: 36, height: 10, background: accent }} />
        </div>
      </div>
      <div style={{ position: "absolute", left: 940 - 560, top: lP.y + 230, width: 560, opacity: card,
        transform: `translateY(${(1 - card) * 16}px)`, background: "#FFFFFF", borderRadius: 18, padding: "18px 26px", boxShadow: "0 10px 24px rgba(0,0,0,0.22)" }}>
        <div style={{ ...font(26, 700, accent), letterSpacing: "0.14em", textTransform: "uppercase" }}>{m.landmark.relation}</div>
        <div style={{ ...font(46, 900), marginTop: 6 }}>{m.landmark.title}</div>
        {m.landmark.sub ? <div style={{ ...font(30, 500, P.soft), marginTop: 6, lineHeight: 1.15 }}>{m.landmark.sub}</div> : null}
      </div>

      <div style={{ position: "absolute", left: 70, top: 1470, ...font(24, 600, P.ink), background: "rgba(255,255,255,0.88)", padding: "8px 16px", borderRadius: 999 }}>
        {m.chip}
      </div>
    </AbsoluteFill>
  );
};
