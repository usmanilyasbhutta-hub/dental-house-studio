import React, { useMemo } from "react";
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { clinic, video } from "../../brand";
import { carousel as P } from "../../theme";
import { PALETTES, buildCity, gx, gz } from "../../three/city";
import type { PromoBrief } from "../../brief/schema";
import outline from "../../data/pakistan-map.json";

/**
 * Own, ad-safe location map (owner: "Use own map that can be used"): Pakistan outline from Natural Earth (public domain),
 * then our procedural clay city as a miniature, a highlighted road and two markers. Illustration only: the chip says so.
 * No Google / third-party map imagery (Google Earth content may not be used for promotion).
 */
const FOV = 38;
const GRID = { cols: 12, rows: 18 };
const ROAD_COL = 6; // the highlighted road runs along this grid line
const SITE_ROW = 9.5; // clinic (west side) and landmark (east side) sit at this depth
const ease = Easing.bezier(0.45, 0, 0.35, 1);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const font = (size: number, weight = 900, color: string = P.ink): React.CSSProperties => ({
  fontFamily: P.headline, fontWeight: weight, fontSize: size, color, lineHeight: 1.0, letterSpacing: weight >= 900 ? "-0.02em" : "0",
});

type Cam = { pos: THREE.Vector3; look: THREE.Vector3 };
const lerpCam = (a: Cam, b: Cam, t: number): Cam => ({ pos: a.pos.clone().lerp(b.pos, t), look: a.look.clone().lerp(b.look, t) });

const roadX = gx(GRID, ROAD_COL);
const siteZ = gz(GRID, SITE_ROW);
const CAMS: Cam[] = [
  { pos: new THREE.Vector3(0.5, 21, 15), look: new THREE.Vector3(0, 0, -0.5) }, // whole miniature city
  { pos: new THREE.Vector3(roadX + 2.2, 8.5, siteZ + 6.5), look: new THREE.Vector3(roadX, 0, siteZ - 0.5) }, // gliding down the road
  { pos: new THREE.Vector3(roadX + 0.35, 6.2, siteZ + 2.0), look: new THREE.Vector3(roadX, 0, siteZ - 0.15) }, // steep view: road visible between the two buildings
];

function project(cam: Cam, p: THREE.Vector3) {
  const c = new THREE.PerspectiveCamera(FOV, video.width / video.height, 0.05, 300);
  c.position.copy(cam.pos);
  c.lookAt(cam.look);
  c.updateMatrixWorld();
  const v = p.clone().project(c);
  return { x: ((v.x + 1) / 2) * video.width, y: ((1 - v.y) / 2) * video.height };
}

const Rig: React.FC<{ cam: Cam }> = ({ cam }) => {
  const camera = useThree((s) => s.camera);
  camera.position.copy(cam.pos);
  camera.lookAt(cam.look);
  camera.updateMatrixWorld();
  return null;
};

const City: React.FC<{ seed: number; road: number }> = ({ seed, road }) => {
  const pal = PALETTES.clay;
  const g = useMemo(() => buildCity(GRID, seed, false, pal), [seed, pal]);
  const z0 = gz(GRID, 1), z1 = gz(GRID, 17);
  const len = (z1 - z0) * road;
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]}>
        <planeGeometry args={[400, 400]} />
        <meshStandardMaterial color={pal.road} roughness={1} />
      </mesh>
      <mesh geometry={g.city}>
        <meshStandardMaterial vertexColors roughness={0.92} />
      </mesh>
      {g.forest ? (
        <mesh geometry={g.forest}>
          <meshStandardMaterial vertexColors roughness={0.85} flatShading />
        </mesh>
      ) : null}
      {/* the named road, drawn in the season accent from the far end towards the camera */}
      {road > 0 ? (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[roadX, 0.02, z0 + len / 2]}>
          <planeGeometry args={[0.2, Math.max(0.001, len)]} />
          <meshBasicMaterial color="#7A1F2E" />
        </mesh>
      ) : null}
    </group>
  );
};

export const OwnMap: React.FC<{ brief: PromoBrief; accent: string; len: number }> = ({ brief, accent, len }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const m = brief.own_map!;
  const f = (x: number) => Math.round((x / 138) * len); // timeline authored for 138 frames, scaled to the page length

  // ---- stage A: Pakistan outline, zoom into Sialkot ------------------------------------------------------------------------
  const draw = interpolate(frame, [0, f(18)], [0, 1], { ...clamp, easing: ease });
  const zoom = interpolate(frame, [f(32), f(52)], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
  const aOpacity = interpolate(frame, [f(44), f(54)], [1, 0], clamp);
  const scale = 1 + zoom * 16;
  const W = 980, H = Math.round((W / outline.width) * outline.height), top = 520;
  const sx = 50 + (outline.sialkot[0] / outline.width) * W, sy = top + (outline.sialkot[1] / outline.height) * H;
  const pulse = (frame % 24) / 24;

  // ---- stage B: miniature city, glide along the road, markers ------------------------------------------------------------
  const bOpacity = interpolate(frame, [f(44), f(54)], [0, 1], clamp);
  const t1 = interpolate(frame, [f(74), f(100)], [0, 1], { ...clamp, easing: ease });
  const t2 = interpolate(frame, [f(100), f(118)], [0, 1], { ...clamp, easing: ease });
  const cam = t2 > 0 ? lerpCam(CAMS[1], CAMS[2], t2) : lerpCam(CAMS[0], CAMS[1], t1);
  const road = interpolate(frame, [f(70), f(98)], [0, 1], { ...clamp, easing: ease });
  const mini = interpolate(frame, [f(50), f(56), f(92), f(104)], [0, 1, 1, 0], clamp); // tilt-shift strength
  const clinicP = project(cam, new THREE.Vector3(roadX - 0.5, 0.35, siteZ));
  const landP = project(cam, new THREE.Vector3(roadX + 0.5, 0.35, siteZ));
  const pin = spring({ frame: frame - f(108), fps, config: { damping: 9, stiffness: 200 } });
  const tag = interpolate(frame, [f(112), f(118)], [0, 1], clamp);
  const link = interpolate(frame, [f(116), f(124)], [0, 1], { ...clamp, easing: ease });
  const card = interpolate(frame, [f(122), f(128)], [0, 1], clamp);

  const stops = [
    { n: "01", label: m.country, a: 4, b: 42, light: true },
    { n: "02", label: m.city, a: 52, b: 80, light: true },
    { n: "03", label: m.road, a: 82, b: 116, light: true },
  ];
  const band = "linear-gradient(180deg, black 0%, black 16%, transparent 36%, transparent 64%, black 86%, black 100%)";

  return (
    <AbsoluteFill style={{ background: P.paper, overflow: "hidden" }}>
      {/* B: our own clay city */}
      <AbsoluteFill style={{ opacity: bOpacity }}>
        <ThreeCanvas width={video.width} height={video.height} camera={{ fov: FOV, near: 0.05, far: 300, position: [0, 20, 15] }} gl={{ antialias: true }}>
          <color attach="background" args={[PALETTES.clay.bg]} />
          <fog attach="fog" args={[PALETTES.clay.bg, 22, 46]} />
          <Rig cam={cam} />
          <hemisphereLight args={["#ffffff", PALETTES.clay.bg, 1.25]} />
          <directionalLight position={[-5, 9, 4]} intensity={1.5} />
          <directionalLight position={[6, 4, -3]} intensity={0.35} color="#ffe8cc" />
          <City seed={m.seed} road={road} />
        </ThreeCanvas>
        {/* miniature look: soft focus above and below a sharp band */}
        {mini > 0.01 ? (
          <AbsoluteFill style={{ backdropFilter: `blur(${7 * mini}px) saturate(${1 + 0.25 * mini})`, WebkitMaskImage: band, maskImage: band }} />
        ) : null}
      </AbsoluteFill>

      {/* A: Pakistan outline (Natural Earth, public domain) */}
      {aOpacity > 0 ? (
        <AbsoluteFill style={{ opacity: aOpacity, background: P.paper }}>
          <div style={{ position: "absolute", left: 50, top, width: W, height: H, transform: `scale(${scale})`, transformOrigin: `${sx - 50}px ${sy - top}px` }}>
            <svg viewBox={`0 0 ${outline.width} ${outline.height}`} width={W} height={H}>
              {Object.entries(outline.paths).filter(([k]) => k !== "Pakistan").map(([k, d]) => (
                <path key={k} d={d as string} fill="#ECE5D8" stroke="#D6CCBA" strokeWidth={1.4} />
              ))}
              <path d={outline.paths.Pakistan} fill="#F3E6D2" fillOpacity={draw} stroke={P.bronze} strokeWidth={3.2} strokeLinejoin="round"
                pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} />
              <circle cx={outline.sialkot[0]} cy={outline.sialkot[1]} r={9 + 26 * pulse} fill="none" stroke={accent} strokeWidth={3} opacity={(1 - pulse) * draw} />
              <circle cx={outline.sialkot[0]} cy={outline.sialkot[1]} r={9} fill={accent} opacity={draw} />
            </svg>
          </div>
          <div style={{ position: "absolute", left: sx + 24, top: sy - 22, ...font(34, 700, accent), opacity: draw * (1 - zoom) }}>{m.city}</div>
        </AbsoluteFill>
      ) : null}

      {/* stop labels, numbered like a route */}
      {stops.map((s, i) => {
        const o = interpolate(frame, [f(s.a), f(s.a) + 6, f(s.b) - 6, f(s.b)], [0, 1, 1, 0], clamp);
        if (o <= 0) return null;
        return (
          <div key={i} style={{ position: "absolute", left: 90, top: 290, opacity: o, transform: `translateY(${(1 - o) * 18}px)` }}>
            <div style={{ ...font(28, 500, P.bronze), letterSpacing: "0.2em" }}>{s.n}</div>
            <div style={{ ...font(104, 900), marginTop: 6, textShadow: "0 2px 18px rgba(251,247,240,0.9)" }}>{s.label}</div>
          </div>
        );
      })}

      {/* clinic pin + tag */}
      <div style={{ position: "absolute", left: clinicP.x, top: clinicP.y, transform: `translate(-50%, -100%) translateY(${(1 - pin) * -120}px)`, opacity: Math.min(1, pin * 3) }}>
        <svg viewBox="0 0 24 32" style={{ width: 92, height: 122, filter: "drop-shadow(0 8px 10px rgba(0,0,0,0.35))" }}>
          <path d="M12 31s10-11 10-19A10 10 0 0 0 2 12c0 8 10 19 10 19z" fill={accent} />
          <circle cx="12" cy="12" r="4" fill={P.paper} />
        </svg>
      </div>
      <div style={{ position: "absolute", left: Math.max(90, Math.min(clinicP.x - 330, 940 - 520)), top: clinicP.y - 290, width: 420, opacity: tag,
        transform: `scale(${0.92 + 0.08 * tag})`, transformOrigin: "left bottom", background: "#FFFFFF", borderRadius: 18, padding: "16px 24px",
        boxShadow: "0 10px 24px rgba(0,0,0,0.22)", borderLeft: `10px solid ${accent}` }}>
        <div style={font(46, 900)}>{clinic.name}</div>
        <div style={{ ...font(30, 500, P.soft), marginTop: 6 }}>{m.road}</div>
      </div>

      {/* landmark directly opposite, with the "opposite" link across the road */}
      <svg width={video.width} height={video.height} style={{ position: "absolute", inset: 0, opacity: link > 0 ? 1 : 0 }}>
        <path d={`M ${clinicP.x} ${clinicP.y - 10} Q ${(clinicP.x + landP.x) / 2} ${Math.min(clinicP.y, landP.y) - 90} ${landP.x} ${landP.y - 10}`}
          fill="none" stroke={P.ink} strokeWidth={6} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - link} />
      </svg>
      <div style={{ position: "absolute", left: (clinicP.x + landP.x) / 2 - 110, top: Math.min(clinicP.y, landP.y) - 150, width: 220, textAlign: "center",
        opacity: link, ...font(30, 900, P.ink), letterSpacing: "0.12em", textTransform: "uppercase", textShadow: "0 2px 10px rgba(255,255,255,0.9)" }}>
        {m.landmark.relation}
      </div>
      <div style={{ position: "absolute", left: landP.x - 40, top: landP.y - 40, width: 80, height: 80, borderRadius: "50%", background: "#FFFFFF",
        border: `6px solid ${accent}`, transform: `scale(${link})`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 18px rgba(0,0,0,0.3)" }}>
        <div style={{ position: "relative", width: 36, height: 36 }}>
          <div style={{ position: "absolute", left: 13, top: 0, width: 10, height: 36, background: accent }} />
          <div style={{ position: "absolute", left: 0, top: 13, width: 36, height: 10, background: accent }} />
        </div>
      </div>
      {/* landmark card anchored under the hospital marker (east side), inside the safe area */}
      <div style={{ position: "absolute", left: Math.min(Math.max(90, landP.x - 300), 940 - 560), top: landP.y + 70, width: 560, opacity: card,
        transform: `translateY(${(1 - card) * 16}px)`, background: "#FFFFFF", borderRadius: 18, padding: "18px 26px", boxShadow: "0 10px 24px rgba(0,0,0,0.22)" }}>
        <div style={{ ...font(26, 700, accent), letterSpacing: "0.14em", textTransform: "uppercase" }}>{m.landmark.relation}</div>
        <div style={{ ...font(46, 900), marginTop: 6 }}>{m.landmark.title}</div>
        {m.landmark.sub ? <div style={{ ...font(30, 500, P.soft), marginTop: 6, lineHeight: 1.15 }}>{m.landmark.sub}</div> : null}
      </div>

      {/* honesty chip: this is a drawing, not a real map */}
      <div style={{ position: "absolute", left: 90, top: 1478, ...font(26, 700, P.ink), letterSpacing: "0.06em", background: "rgba(255,255,255,0.88)",
        padding: "8px 16px", borderRadius: 999 }}>{m.chip}</div>
    </AbsoluteFill>
  );
};
