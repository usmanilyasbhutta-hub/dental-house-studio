/**
 * Effects set 3 (reference reel: /git-city, /teardown, /map-route, /headline). Rebuilt in our own code for clinic use.
 * - DataCity: 3D columns rising from a grid of numbers (real data only; the gallery uses demo data, labelled).
 * - Teardown: an object materialises from particles, then explodes into labelled parts (dental implant).
 * - Newspaper: a front page that writes itself (our OWN masthead; never imitate a real newspaper).
 * - Map route lives in templates/MapRoute.tsx (brief type `map-route`); the halftone reveal in fx/Halftone.tsx.
 * All driven by useCurrentFrame (deterministic). Not for clinical photos.
 */
import React, { useMemo } from "react";
import { AbsoluteFill, Easing, Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { colors, video } from "../brand";
import { Abutment, Crown, DentalLights, Implant, MAT } from "../three/dental";
import { rng } from "../three/city";
import { headline, mono, serif } from "../templates/shared/text";

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeOut = Easing.bezier(0.22, 1, 0.36, 1);

const LookAt: React.FC<{ pos: THREE.Vector3; look: THREE.Vector3 }> = ({ pos, look }) => {
  const camera = useThree((s) => s.camera);
  camera.position.copy(pos);
  camera.lookAt(look);
  camera.updateMatrixWorld();
  return null;
};

function project(pos: THREE.Vector3, look: THREE.Vector3, fov: number, p: THREE.Vector3, w = video.width, h = video.height) {
  const c = new THREE.PerspectiveCamera(fov, w / h, 0.05, 200);
  c.position.copy(pos);
  c.lookAt(look);
  c.updateMatrixWorld();
  const v = p.clone().project(c);
  return { x: ((v.x + 1) / 2) * w, y: ((1 - v.y) / 2) * h };
}

// ---- 31 Data city -------------------------------------------------------------------------------

/** Demo grid of values 0..1 (clearly labelled demo data in the gallery). Use real numbers in a video. */
export function demoGrid(n = 16, seed = 3): number[][] {
  const r = rng(seed);
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => {
      const ridge = Math.exp(-(((i - n * 0.55) ** 2 + (j - n * 0.45) ** 2) / (n * 2.2)));
      return clamp01(0.08 + ridge * 0.8 * (0.5 + r()) + (r() < 0.08 ? r() * 0.5 : 0));
    }),
  );
}

export const DataCity: React.FC<{ values: number[][]; caption?: string; palette?: "teal" | "brand"; rise?: number }> = ({ values, caption, palette = "brand", rise = 70 }) => {
  const frame = useCurrentFrame();
  const n = values.length, m = values[0].length;
  const low = new THREE.Color(palette === "teal" ? "#1B3F8F" : colors.bronzeDark);
  const high = new THREE.Color(palette === "teal" ? "#3FF2C8" : "#F0D3A6");
  const ang = 0.7 + frame * 0.004;
  const R = 31 - clamp01(frame / 120) * 4;
  const pos = new THREE.Vector3(Math.sin(ang) * R, 17 - clamp01(frame / 120) * 3, Math.cos(ang) * R);
  const look = new THREE.Vector3(0, 0.4, 0);
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 45%, ${palette === "teal" ? "#0E1A33" : colors.slate}, ${palette === "teal" ? "#04070F" : colors.slateDeep})` }}>
      <ThreeCanvas width={video.width} height={video.height} camera={{ fov: 34 }} gl={{ antialias: true, alpha: true }}>
        <LookAt pos={pos} look={look} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 10, 4]} intensity={1.6} />
        <directionalLight position={[-6, 3, -4]} intensity={0.6} color={palette === "teal" ? "#7FB8FF" : colors.bronzeLight} />
        {values.flatMap((row, i) =>
          row.map((v, j) => {
            // diagonal wave: tiles appear, then columns rise
            const delay = (i + j) * 1.3;
            const tile = clamp01((frame - delay) / 10);
            const grow = easeOut(clamp01((frame - 18 - delay) / rise));
            const h = 0.06 + v * 3.2 * grow;
            const c = low.clone().lerp(high, clamp01(v * grow * 1.15));
            return (
              <mesh key={`${i}-${j}`} position={[(i - n / 2) * 0.62, h / 2, (j - m / 2) * 0.62]} scale={[tile, 1, tile]}>
                <boxGeometry args={[0.52, h, 0.52]} />
                <meshStandardMaterial color={c} emissive={c} emissiveIntensity={0.25 + 0.5 * v * grow} roughness={0.5} />
              </mesh>
            );
          }),
        )}
      </ThreeCanvas>
      {caption ? (
        <div style={{ position: "absolute", top: 300, left: 0, right: 0, textAlign: "center", ...mono(24, colors.mist), opacity: clamp01((frame - 30) / 15) }}>{caption}</div>
      ) : null}
    </AbsoluteFill>
  );
};

// ---- 32 Teardown (exploded view) ----------------------------------------------------------------

/** Abutment screw (generic). Top of the head at y = 0 in its own space. */
const Screw: React.FC = () => (
  <group>
    <mesh position={[0, -0.04, 0]}>
      <cylinderGeometry args={[0.085, 0.085, 0.08, 32]} />
      <meshStandardMaterial {...MAT.titanium} color="#B8BEC6" />
    </mesh>
    <mesh position={[0, -0.42, 0]}>
      <cylinderGeometry args={[0.05, 0.045, 0.68, 24]} />
      <meshStandardMaterial {...MAT.titanium} color="#A9B0B8" />
    </mesh>
  </group>
);

type Part = { name: string; label: string; assembled: number; exploded: number; node: React.ReactNode; anchor: [number, number] };

export const IMPLANT_PARTS: Part[] = [
  { name: "crown", label: "Crown", assembled: 0.06, exploded: 2.2, node: <Crown />, anchor: [0.42, 0.45] },
  { name: "screw", label: "Abutment screw", assembled: 0.5, exploded: 1.4, node: <Screw />, anchor: [0.1, -0.2] },
  { name: "abutment", label: "Abutment", assembled: 0, exploded: 0.05, node: <Abutment />, anchor: [0.2, 0.3] },
  { name: "implant", label: "Implant", assembled: 0, exploded: -0.8, node: <Implant />, anchor: [0.2, -0.6] },
];

export const Teardown: React.FC<{ parts?: Part[]; explodeAt?: number; title?: string }> = ({ parts = IMPLANT_PARTS, explodeAt = 40, title = "Illustration · not to scale" }) => {
  const frame = useCurrentFrame();
  const solid = clamp01((frame - 18) / 18);
  const ex = Easing.inOut(Easing.cubic)(clamp01((frame - explodeAt) / 40));
  const ang = -0.5 + frame * 0.006;
  const fov = 30;
  const pos = new THREE.Vector3(Math.sin(ang) * 13.5, 2.8, Math.cos(ang) * 13.5);
  const look = new THREE.Vector3(0, 0.45, 0);
  const cloud = useMemo(() => {
    const r = rng(11);
    const N = 2600;
    const from = new Float32Array(N * 3), to = new Float32Array(N * 3);
    for (let k = 0; k < N; k++) {
      const a = r() * Math.PI * 2, rad = 2 + r() * 3, y = (r() - 0.5) * 6;
      from.set([Math.cos(a) * rad, y, Math.sin(a) * rad], k * 3);
      const ty = -1.3 + r() * 2.1; // inside the assembled implant + crown envelope
      const tr = (ty > 0 ? 0.42 : 0.18) * Math.sqrt(r());
      const ta = r() * Math.PI * 2;
      to.set([Math.cos(ta) * tr, ty, Math.sin(ta) * tr], k * 3);
    }
    return { from, to, N };
  }, []);
  const k = easeOut(clamp01(frame / 26));
  const pts = new Float32Array(cloud.N * 3);
  for (let i = 0; i < pts.length; i++) pts[i] = cloud.from[i] + (cloud.to[i] - cloud.from[i]) * k;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pts, 3));
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 42%, ${colors.slate}, ${colors.slateDeep})` }}>
      <ThreeCanvas width={video.width} height={video.height} camera={{ fov }} gl={{ antialias: true, alpha: true }}>
        <LookAt pos={pos} look={look} />
        <DentalLights />
        {solid < 1 ? (
          <points geometry={geo}>
            <pointsMaterial size={0.035} color={colors.bronzeLight} transparent opacity={1 - solid} depthWrite={false} />
          </points>
        ) : null}
        <group scale={solid > 0 ? 0.92 + 0.08 * solid : 0.001}>
          {parts.map((p) => (
            <group key={p.name} position={[0, p.assembled + (p.exploded - p.assembled) * ex, 0]}>
              {p.node}
            </group>
          ))}
        </group>
      </ThreeCanvas>
      {parts.map((p, i) => {
        const y = p.assembled + (p.exploded - p.assembled) * ex;
        const s = project(pos, look, fov, new THREE.Vector3(p.anchor[0], y + p.anchor[1], 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), 0));
        const a = clamp01((frame - explodeAt - 30 - i * 6) / 10);
        const lx = Math.max(640, s.x + 80);
        return (
          <div key={p.name} style={{ position: "absolute", left: 0, top: 0, opacity: a }}>
            <div style={{ position: "absolute", left: s.x + 30, top: s.y, width: Math.max(0, lx - s.x - 40) * a, height: 2, background: colors.bronzeLight, opacity: 0.8 }} />
            <div style={{ position: "absolute", left: s.x + 22, top: s.y - 6, width: 14, height: 14, borderRadius: 7, border: `2px solid ${colors.bronzeLight}` }} />
            <div style={{ position: "absolute", left: lx, top: s.y - 22, display: "flex", gap: 14, alignItems: "baseline", whiteSpace: "nowrap" }}>
              <span style={mono(22, colors.bronzeLight)}>{String(i + 1).padStart(2, "0")}</span>
              <span style={{ ...headline(34, colors.white) }}>{p.label}</span>
            </div>
          </div>
        );
      })}
      <div style={{ position: "absolute", right: video.safe.right + 10, top: video.safe.top + 30, ...mono(20, colors.mist) }}>{title}</div>
    </AbsoluteFill>
  );
};

// ---- 33 Newspaper front page ---------------------------------------------------------------------

export const Newspaper: React.FC<{
  masthead: string;
  edition: string;
  headline: string;
  deck?: string;
  body: string;
  image?: string;
  imageCaption?: string;
}> = ({ masthead, edition, headline: head, deck, body, image, imageCaption }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ink = "#1D1B17";
  const paper = "#F3EFE6";
  const settle = easeOut(clamp01(frame / 30));
  const typed = (text: string, start: number, cps: number) => text.slice(0, Math.max(0, Math.floor(((frame - start) / fps) * cps)));
  const headStart = 16, deckStart = headStart + Math.ceil((head.length / 36) * fps) + 4;
  const imgOn = clamp01((frame - deckStart - 6) / 16);
  const bodyStart = deckStart + 14;
  const W = 900;
  const caret = (frame % 16 < 9 ? "▍" : " ");
  const headTyped = typed(head, headStart, 36);
  return (
    <AbsoluteFill style={{ background: "#14110D", perspective: 1600 }}>
      <div
        style={{
          position: "absolute",
          left: (video.width - W) / 2,
          top: 250,
          width: W,
          height: 1300,
          background: paper,
          boxShadow: "0 30px 80px rgba(0,0,0,0.55)",
          transform: `translateY(${(1 - settle) * 140}px) rotateX(${(1 - settle) * 22}deg) rotateZ(${(1 - settle) * -3}deg)`,
          transformOrigin: "50% 100%",
          padding: "44px 50px",
          boxSizing: "border-box",
          color: ink,
          overflow: "hidden",
        }}
      >
        {/* paper grain */}
        <svg width={W} height={1300} style={{ position: "absolute", inset: 0, opacity: 0.18, mixBlendMode: "multiply" }}>
          <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="4" /><feColorMatrix values="0 0 0 0 0.3  0 0 0 0 0.25  0 0 0 0 0.2  0 0 0 0.6 0" /></filter>
          <rect width="100%" height="100%" filter="url(#grain)" />
        </svg>
        <div style={{ textAlign: "center", fontFamily: "Instrument Serif", fontSize: 92, lineHeight: 1, letterSpacing: "-0.01em" }}>{masthead}</div>
        <div style={{ display: "flex", justifyContent: "space-between", borderTop: `3px solid ${ink}`, borderBottom: `1px solid ${ink}`, marginTop: 14, padding: "8px 0", ...mono(17, ink), letterSpacing: "0.1em" }}>
          <span>{edition}</span>
          <span>Illustration</span>
        </div>
        <div style={{ fontFamily: "Instrument Serif", fontSize: 84, lineHeight: 1.0, marginTop: 30, minHeight: 170 }}>
          {headTyped}
          {headTyped.length < head.length && frame >= headStart ? caret : ""}
        </div>
        {deck ? <div style={{ ...serif(36, "#4A443A"), marginTop: 10, opacity: clamp01((frame - deckStart) / 10) }}>{deck}</div> : null}
        {image ? (
          <div style={{ marginTop: 26, height: 430, position: "relative", overflow: "hidden", borderTop: `1px solid ${ink}`, borderBottom: `1px solid ${ink}`, opacity: imgOn }}>
            <Img src={staticFile(image)} style={{ width: "100%", height: "100%", objectFit: "cover", filter: "grayscale(1) contrast(1.25)", transform: `scale(${1.08 - 0.08 * imgOn})` }} />
            {/* halftone print screen */}
            <div style={{ position: "absolute", inset: 0, backgroundImage: `radial-gradient(circle, rgba(243,239,230,0.0) 1.6px, ${paper} 2.4px)`, backgroundSize: "7px 7px", opacity: 0.55, mixBlendMode: "screen" }} />
          </div>
        ) : null}
        {imageCaption ? <div style={{ ...mono(15, "#5A5246"), letterSpacing: "0.06em", textTransform: "none", marginTop: 8, opacity: imgOn }}>{imageCaption}</div> : null}
        <div style={{ columnCount: 2, columnGap: 34, marginTop: 22, fontFamily: "Instrument Serif", fontSize: 27, lineHeight: 1.3, textAlign: "justify" }}>
          {typed(body, bodyStart, 110)}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---- gallery ---------------------------------------------------------------------------------------

export const FX3_SEG = 150;
