import React, { useMemo } from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { clinic, colors, video } from "../brand";
import type { MapRouteBrief } from "../brief/schema";
import { MAP_ROUTE } from "../brief/timing";
import { ThemeContext, useTheme } from "../theme";
import { PALETTES, ROAD, buildCity, closestOnPath, gx, gz, makePath, smoothAt, type Path } from "../three/city";
import { HalftoneReveal } from "../fx/Halftone";
import { Sfx } from "../fx/effects";
import { KineticHeadline } from "./shared/Headline";
import { prog } from "./shared/motion";
import { Shell, type QcProps } from "./shared/Shell";
import { headline, mono } from "./shared/text";

const FOV = 40;
const ease = Easing.bezier(0.45, 0, 0.35, 1);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** Timeline in frames, derived from the brief (single source of truth for camera, route and overlays). */
function useTimeline(b: MapRouteBrief) {
  const { fps } = useVideoConfig();
  const L = Math.round(MAP_ROUTE.lead * fps);
  const D = Math.round(b.seconds * fps);
  return {
    L,
    D,
    fps,
    /** route progress 0–1 */
    draw: (f: number) => ease(clamp01((f - L) / D)),
    /** chase → overview blend 0–1 */
    blend: (f: number) => Easing.inOut(Easing.cubic)(clamp01((f - (L + 0.5 * D)) / (0.42 * D))),
    pin: L + Math.round(0.95 * D),
    card: L + D + Math.round(0.35 * fps),
    hold: (f: number) => clamp01((f - L - D) / (MAP_ROUTE.hold * fps)),
  };
}

type Cam = { pos: THREE.Vector3; look: THREE.Vector3 };

function overview(path: Path, drift: number): Cam {
  const box = new THREE.Box3().setFromPoints(path.pts);
  const c = box.getCenter(new THREE.Vector3());
  const hw = (box.max.x - box.min.x) / 2 + 0.9;
  const hd = (box.max.z - box.min.z) / 2 + 0.7;
  const el = (64 * Math.PI) / 180;
  const az = -0.2 + drift * 0.1;
  const tv = Math.tan(((FOV / 2) * Math.PI) / 180);
  const th = tv * (video.width / video.height);
  const R = Math.max(hw / (th * 0.86), (hd * Math.sin(el)) / (tv * 0.35)) * (1 - drift * 0.09); // route fills the band above the card
  const dir = new THREE.Vector3(Math.sin(az), 0, Math.cos(az));
  const look = c.clone().addScaledVector(dir, (0.2 * R * tv) / Math.sin(el)); // route sits above centre, clear of the card
  const pos = look.clone().add(new THREE.Vector3(Math.sin(az) * R * Math.cos(el), R * Math.sin(el), Math.cos(az) * R * Math.cos(el)));
  return { pos, look };
}

function chase(path: Path, d: number): Cam {
  const fwd = smoothAt(path, d + 0.5, 0.9).sub(smoothAt(path, d - 0.5, 0.9)).setY(0).normalize();
  const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
  const pos = smoothAt(path, d - 2.4, 1.4).addScaledVector(right, 0.3).add(new THREE.Vector3(0, 2.7, 0));
  const look = smoothAt(path, d + 0.9, 1.0); // head sits a little below centre, city ahead fills the frame
  return { pos, look };
}

function camAt(path: Path, tl: ReturnType<typeof useTimeline>, f: number): Cam {
  const d = tl.draw(f) * path.length;
  const a = chase(path, d);
  const b = overview(path, tl.hold(f));
  const w = tl.blend(f);
  return { pos: a.pos.lerp(b.pos, w), look: a.look.lerp(b.look, w) };
}

/** World → screen pixels with the same camera the canvas uses. null when behind the camera. */
function project(cam: Cam, p: THREE.Vector3) {
  const c = new THREE.PerspectiveCamera(FOV, video.width / video.height, 0.05, 300);
  c.position.copy(cam.pos);
  c.lookAt(cam.look);
  c.updateMatrixWorld();
  c.updateProjectionMatrix();
  const v = p.clone().project(c);
  if (v.z > 1 || v.z < -1) return null;
  return { x: ((v.x + 1) / 2) * video.width, y: ((1 - v.y) / 2) * video.height };
}

/** 1 when a street label would sit on top of the destination label (then it fades out as the pin lands). */
function crowd(cam: Cam, a: THREE.Vector3, b: THREE.Vector3) {
  const p = project(cam, a), q = project(cam, b);
  return p && q && Math.abs(p.x - q.x) < 300 && Math.abs(p.y - q.y) < 150 ? 1 : 0;
}

const Rig: React.FC<{ cam: Cam }> = ({ cam }) => {
  const camera = useThree((s) => s.camera);
  camera.position.copy(cam.pos);
  camera.lookAt(cam.look);
  camera.updateMatrixWorld();
  return null;
};

export const MapRoute: React.FC<{ brief: MapRouteBrief } & QcProps> = ({ brief, showSafeZones }) => {
  const frame = useCurrentFrame();
  const tl = useTimeline(brief);
  const pal = PALETTES[brief.palette];
  const path = useMemo(() => makePath(brief.grid, brief.route as [number, number][]), [brief.grid, brief.route]);
  const cam = camAt(path, tl, frame);
  const d = tl.draw(frame) * path.length;
  const dest = path.pts[path.pts.length - 1];
  const destLabel = brief.destination.label ?? clinic.name;
  const light = brief.palette === "clay";
  const ink = light ? colors.slateDeep : colors.white;
  const camDist = cam.pos.distanceTo(cam.look);

  // street labels: appear when the route head passes them, otherwise when the camera pulls back
  const streets = brief.streets.map((s) => {
    const x = gx(brief.grid, s.at[0]), z = gz(brief.grid, s.at[1]);
    const near = closestOnPath(path, x, z);
    const showAt = near.dist < 0.7 ? tl.L + tl.D * (near.d / path.length) * 0.9 : tl.L + 0.55 * tl.D;
    return { ...s, pos: new THREE.Vector3(x + ROAD, 0.05, z), showAt };
  });

  return (
    <Shell brief={brief} endSeconds={4.5} showSafeZones={showSafeZones} chrome="minimal">
      <AbsoluteFill>
        <ThreeCanvas width={video.width} height={video.height} camera={{ fov: FOV, near: 0.05, far: 300, position: [0, 5, 10] }} gl={{ antialias: true }}>
          <color attach="background" args={[pal.bg]} />
          <fog attach="fog" args={[pal.bg, camDist * 0.95, camDist * 0.95 + 16]} />
          <Rig cam={cam} />
          <hemisphereLight args={["#ffffff", pal.bg, light ? 1.25 : 0.9]} />
          <directionalLight position={[-5, 9, 4]} intensity={light ? 1.5 : 1.1} />
          <directionalLight position={[6, 4, -3]} intensity={light ? 0.35 : 0.25} color={light ? "#dfe6ff" : colors.bronzeLight} />
          <City brief={brief} />
          <Route path={path} d={d} color={pal.route} glow={pal.glow} light={light} onTop={tl.blend(frame) > 0.35} widen={1 + tl.blend(frame) * 1.1} />
        </ThreeCanvas>
      </AbsoluteFill>

      {/* dark band behind the white logo bug (light map) */}
      {light ? <AbsoluteFill style={{ height: 320, background: "linear-gradient(180deg, rgba(20,26,30,0.62), rgba(20,26,30,0))" }} /> : null}

      <Chip text={brief.chip} light={light} dot={pal.route} />

      {/* start marker */}
      <Marker cam={cam} p={path.pts[0]} color={pal.route} label={brief.start?.label} ink={ink} light={light} appear={prog(frame, tl.L, 10)} />

      {streets.map((s, i) => (
        <StreetLabel key={i} cam={cam} p={s.pos} text={s.text} appear={prog(frame, Math.round(s.showAt), 10) * (1 - crowd(cam, s.pos, dest) * prog(frame, tl.pin + 8, 8))} light={light} />
      ))}

      <Pin cam={cam} p={dest} color={pal.route} frame={frame - tl.pin} label={destLabel} light={light} />
      <Sfx name="whoosh" at={tl.L} volume={0.35} />
      <Sfx name="pop" at={tl.pin + 6} volume={0.45} />

      <EndCardOverlay brief={brief} frame={frame - tl.card} light={light} />

      <HalftoneReveal duration={26} color={brief.palette === "clay" ? "#151a1e" : colors.slateDeep} origin={[0.5, 0.62]} />
    </Shell>
  );
};

const City: React.FC<{ brief: MapRouteBrief }> = ({ brief }) => {
  const pal = PALETTES[brief.palette];
  const g = useMemo(() => buildCity(brief.grid, brief.seed, brief.river, pal), [brief.grid, brief.seed, brief.river, pal]);
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
      {g.water ? (
        <mesh geometry={g.water}>
          <meshStandardMaterial color={pal.river} roughness={0.6} side={THREE.DoubleSide} />
        </mesh>
      ) : null}
      {g.bridges ? (
        <mesh geometry={g.bridges}>
          <meshStandardMaterial color={pal.bridge} roughness={0.9} />
        </mesh>
      ) : null}
    </group>
  );
};

/** Glow texture for the route head (built once, no files). */
function glowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const x = c.getContext("2d")!;
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.25, "rgba(255,255,255,0.55)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

/** The route drawn up to arc length d: core line + two glow layers, round joins, glowing head. */
const Route: React.FC<{ path: Path; d: number; color: string; glow: string; light: boolean; onTop: boolean; widen: number }> = ({ path, d, color, glow, light, onTop, widen }) => {
  const tex = useMemo(glowTexture, []);
  const layers = [
    { w: 0.42 * widen, y: 0.012, op: light ? 0.1 : 0.14, c: glow },
    { w: 0.2 * widen, y: 0.014, op: light ? 0.3 : 0.32, c: glow },
    { w: 0.085 * widen, y: 0.016, op: 1, c: color },
  ];
  const segs: { mid: THREE.Vector3; len: number; rot: number }[] = [];
  const joints: THREE.Vector3[] = [path.pts[0]];
  for (let k = 1; k < path.pts.length; k++) {
    const a = path.pts[k - 1], b = path.pts[k];
    const vis = Math.min(path.cum[k] - path.cum[k - 1], Math.max(0, d - path.cum[k - 1]));
    if (vis <= 0) break;
    const dir = b.clone().sub(a).normalize();
    segs.push({ mid: a.clone().addScaledVector(dir, vis / 2), len: vis, rot: Math.atan2(dir.x, dir.z) });
    joints.push(a.clone().addScaledVector(dir, vis));
  }
  const head = joints[joints.length - 1];
  const drawing = d > 0.01;
  return (
    <group>
      {layers.map((l, li) => (
        <group key={li} position={[0, l.y, 0]}>
          {segs.map((s, i) => (
            <mesh key={i} position={[s.mid.x, 0, s.mid.z]} rotation={[0, s.rot, 0]} renderOrder={onTop ? 10 + li : 0}>
              <boxGeometry args={[l.w, 0.004, s.len]} />
              <meshBasicMaterial color={l.c} transparent={l.op < 1 || onTop} opacity={l.op} depthWrite={l.op === 1} depthTest={!onTop} fog={false} blending={l.op < 1 && !light ? THREE.AdditiveBlending : THREE.NormalBlending} />
            </mesh>
          ))}
          {drawing
            ? joints.map((j, i) => (
                <mesh key={`j${i}`} position={[j.x, 0, j.z]} renderOrder={onTop ? 10 + li : 0}>
                  <cylinderGeometry args={[l.w / 2, l.w / 2, 0.004, 24]} />
                  <meshBasicMaterial color={l.c} transparent={l.op < 1 || onTop} opacity={l.op} depthWrite={l.op === 1} depthTest={!onTop} fog={false} />
                </mesh>
              ))
            : null}
        </group>
      ))}
      {drawing && d < path.length - 0.01 ? (
        <group position={[head.x, 0.05, head.z]}>
          <sprite scale={[0.55, 0.55, 0.55]}>
            <spriteMaterial map={tex} color={glow} transparent opacity={light ? 0.7 : 0.85} depthWrite={false} fog={false} blending={light ? THREE.NormalBlending : THREE.AdditiveBlending} />
          </sprite>
          <mesh>
            <sphereGeometry args={[0.035, 16, 12]} />
            <meshBasicMaterial color="#ffffff" fog={false} />
          </mesh>
          <pointLight color={glow} intensity={1.2} distance={1.8} />
        </group>
      ) : null}
    </group>
  );
};

// ---- overlays ---------------------------------------------------------------

const Chip: React.FC<{ text: string; light: boolean; dot: string }> = ({ text, light, dot }) => {
  const frame = useCurrentFrame();
  const p = prog(frame, 20, 12);
  return (
    <div
      style={{
        position: "absolute",
        top: 236,
        left: video.safe.left + 4,
        opacity: p,
        transform: `translateY(${(1 - p) * -10}px)`,
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 20px",
        borderRadius: 40,
        background: light ? "rgba(255,255,255,0.92)" : "rgba(28,34,32,0.85)",
        boxShadow: "0 6px 18px rgba(0,0,0,0.12)",
        ...mono(20, light ? colors.slate : colors.mist),
        letterSpacing: "0.06em",
        textTransform: "none",
      }}
    >
      <span style={{ width: 12, height: 12, borderRadius: 6, background: dot, display: "inline-block" }} />
      {text}
    </div>
  );
};

const Marker: React.FC<{ cam: Cam; p: THREE.Vector3; color: string; label?: string; ink: string; light: boolean; appear: number }> = ({ cam, p, color, label, light, appear }) => {
  const s = project(cam, p);
  if (!s || appear <= 0) return null;
  return (
    <>
      <div style={{ position: "absolute", left: s.x - 14, top: s.y - 14, width: 28, height: 28, borderRadius: 14, background: color, border: "5px solid #fff", boxShadow: "0 3px 10px rgba(0,0,0,0.25)", transform: `scale(${appear})` }} />
      {label ? <Bubble x={s.x} y={s.y - 30} text={label} light={light} appear={appear} small /> : null}
    </>
  );
};

const Bubble: React.FC<{ x: number; y: number; text: string; light: boolean; appear: number; small?: boolean; side?: "left" | "right" | "center" }> = ({ x, y, text, light, appear, small, side = "center" }) => {
  const maxX = video.width - video.safe.right;
  return (
    <div
      style={{
        position: "absolute",
        left: Math.min(Math.max(x, video.safe.left + 10), maxX - 10),
        top: y,
        transform: `translate(${side === "left" ? "-100%" : side === "right" ? "0%" : "-50%"}, -100%) scale(${0.85 + 0.15 * appear})`,
        transformOrigin: "bottom center",
        opacity: appear,
        whiteSpace: "nowrap",
        padding: small ? "8px 16px" : "14px 26px",
        borderRadius: 14,
        background: light ? "#ffffff" : colors.slate,
        color: light ? colors.slateDeep : colors.white,
        boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
        fontFamily: "Oswald",
        fontWeight: 500,
        fontSize: small ? 28 : 40,
        letterSpacing: "0.01em",
      }}
    >
      {text}
    </div>
  );
};

const StreetLabel: React.FC<{ cam: Cam; p: THREE.Vector3; text: string; appear: number; light: boolean }> = ({ cam, p, text, appear, light }) => {
  const s = project(cam, p);
  if (!s || appear <= 0) return null;
  if (s.y < video.safe.top + 40 || s.y > video.height - video.safe.bottom) return null; // keep labels in the safe area
  return (
    <>
      <div style={{ position: "absolute", left: s.x - 1.5, top: s.y - 34 * appear, width: 3, height: 34 * appear, background: light ? colors.slate : colors.mist, opacity: 0.7 }} />
      <Bubble x={s.x} y={s.y - 34} text={text} light={light} appear={appear} small />
    </>
  );
};

/** Map pin that drops in with a small bounce, plus the destination label. */
const Pin: React.FC<{ cam: Cam; p: THREE.Vector3; color: string; frame: number; label: string; light: boolean }> = ({ cam, p, color, frame, label, light }) => {
  if (frame < 0) return null;
  const s = project(cam, p);
  if (!s) return null;
  const drop = interpolate(frame, [0, 9, 13, 17], [-160, 0, -18, 0], { extrapolateRight: "clamp", easing: Easing.out(Easing.quad) });
  const op = interpolate(frame, [0, 4], [0, 1], { extrapolateRight: "clamp" });
  const lab = prog(frame, 12, 10);
  const W = 64, H = 88;
  return (
    <>
      <div style={{ position: "absolute", left: s.x - 22, top: s.y - 7, width: 44, height: 14, borderRadius: "50%", background: "rgba(0,0,0,0.22)", opacity: op, transform: `scale(${1 + drop / 400})` }} />
      <svg width={W} height={H} viewBox="0 0 64 88" style={{ position: "absolute", left: s.x - W / 2, top: s.y - H + drop, opacity: op, filter: "drop-shadow(0 6px 8px rgba(0,0,0,0.25))" }}>
        <path d="M32 86 C 30 70, 4 52, 4 31 A 28 28 0 1 1 60 31 C 60 52, 34 70, 32 86 Z" fill={color} />
        <circle cx="32" cy="31" r="11" fill="#fff" />
      </svg>
      <Bubble x={s.x < video.width / 2 ? s.x + 46 : s.x - 46} y={s.y - H + 10} text={label} light={light} appear={lab} side={s.x < video.width / 2 ? "right" : "left"} />
    </>
  );
};

/** Headline + address card over the overview. Clinic address comes from src/brand.ts only. */
const EndCardOverlay: React.FC<{ brief: MapRouteBrief; frame: number; light: boolean }> = ({ brief, frame, light }) => {
  const { fps } = useVideoConfig();
  const theme = useTheme();
  if (frame < 0) return null;
  const p = prog(frame, 0, Math.round(0.5 * fps));
  const bottom = video.height - video.safe.bottom - 10;
  return (
    <div
      style={{
        position: "absolute",
        left: video.safe.left,
        width: video.width - video.safe.left - video.safe.right,
        bottom: video.height - bottom,
        opacity: p,
        transform: `translateY(${(1 - p) * 40}px)`,
        padding: "28px 36px 26px",
        borderRadius: 26,
        background: light ? "rgba(255,255,255,0.96)" : "rgba(28,34,32,0.94)",
        boxShadow: "0 18px 50px rgba(0,0,0,0.22)",
        color: light ? colors.slateDeep : colors.white,
        boxSizing: "border-box",
      }}
    >
      <ThemeContext.Provider value={light ? { ...theme, accent: colors.bronze, rule: colors.bronze } : theme}>
        <KineticHeadline lines={brief.hook.lines} accent={brief.hook.accent} width={780} max={74} />
      </ThemeContext.Provider>
      {brief.show_address ? (
        <div style={{ marginTop: 18, ...mono(21, light ? colors.slate : colors.mist), textTransform: "none", letterSpacing: "0.02em", lineHeight: 1.4, opacity: prog(frame, 10, 12) }}>
          <span style={{ ...headline(24, light ? colors.bronze : colors.bronzeLight), letterSpacing: "0.06em" }}>{clinic.name} · {clinic.city}</span>
          <br />
          {clinic.address}
        </div>
      ) : null}
    </div>
  );
};
