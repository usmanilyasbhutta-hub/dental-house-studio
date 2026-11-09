/**
 * Procedural 3D dental models (three.js, built in code: no downloaded models, no licences).
 * Units: 1 ≈ 1 cm. Gum line at y = 0; crowns above, roots below.
 * Everything is driven by props (from useCurrentFrame), never by useFrame, so renders are deterministic.
 */
import React, { useMemo } from "react";
import * as THREE from "three";
import type {} from "@react-three/fiber"; // JSX types for three.js elements

export const MAT = {
  enamel: { color: "#F2EEE4", roughness: 0.32, metalness: 0, clearcoat: 0.6 },
  dentin: { color: "#E3D2B0", roughness: 0.55, metalness: 0 },
  ceramic: { color: "#F7F4EC", roughness: 0.18, metalness: 0, clearcoat: 1 },
  titanium: { color: "#C6CBD0", roughness: 0.34, metalness: 0.55 }, // moderate metalness: no env map to reflect, so full metal renders black
  gum: { color: "#D98A8A", roughness: 0.6, metalness: 0 },
  bone: { color: "#E6D5B8", roughness: 0.9, metalness: 0 },
  decay: { color: "#6B4A2B", roughness: 0.8, metalness: 0 },
} as const;

/** Lathe profile of a premolar-like tooth: [radius, height]. */
const PROFILE: [number, number][] = [
  [0.0, -1.55], [0.06, -1.5], [0.13, -1.2], [0.2, -0.8], [0.27, -0.35], [0.3, -0.05], // root → CEJ
  [0.33, 0.1], [0.4, 0.3], [0.42, 0.45], [0.4, 0.6], [0.33, 0.72], [0.2, 0.76], [0.08, 0.7], [0.0, 0.68], // crown with a shallow occlusal dip
];

function lathe(points: [number, number][], scale = 1) {
  const g = new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(r * scale, y * scale)), 64);
  g.computeVertexNormals();
  return g;
}

/** Natural tooth: crown (enamel) + root (dentin). `decay` shows a dark lesion on the crown. */
export const Tooth: React.FC<{ position?: [number, number, number]; opacity?: number; decay?: number }> = ({ position = [0, 0, 0], opacity = 1, decay = 0 }) => {
  const crown = useMemo(() => lathe(PROFILE.filter(([, y]) => y >= -0.05)), []);
  const root = useMemo(() => lathe(PROFILE.filter(([, y]) => y <= -0.05)), []);
  const t = opacity < 1;
  return (
    <group position={position}>
      <mesh geometry={crown}>
        <meshPhysicalMaterial {...MAT.enamel} transparent={t} opacity={opacity} />
      </mesh>
      <mesh geometry={root}>
        <meshStandardMaterial {...MAT.dentin} transparent={t} opacity={opacity} />
      </mesh>
      {decay > 0 ? (
        <mesh position={[0.06, 0.5, 0.36]} scale={[decay * 1.1, decay * 0.8, decay * 0.35]}>
          <sphereGeometry args={[0.15, 24, 16]} />
          <meshStandardMaterial {...MAT.decay} />
        </mesh>
      ) : null}
    </group>
  );
};

/** Prepared (reduced) tooth for a crown: smaller, flatter crown stump on the natural root. */
export const PreparedTooth: React.FC<{ position?: [number, number, number]; reduce: number }> = ({ position = [0, 0, 0], reduce }) => {
  // reduce 0 → full tooth, 1 → prepared stump
  const s = 1 - 0.28 * reduce;
  const crown = useMemo(() => lathe(PROFILE.filter(([, y]) => y >= -0.05)), []);
  const root = useMemo(() => lathe(PROFILE.filter(([, y]) => y <= -0.05)), []);
  return (
    <group position={position}>
      <mesh geometry={crown} scale={[s, 1 - 0.35 * reduce, s]}>
        <meshStandardMaterial color={new THREE.Color(MAT.enamel.color).lerp(new THREE.Color(MAT.dentin.color), reduce)} roughness={0.45} />
      </mesh>
      <mesh geometry={root}>
        <meshStandardMaterial {...MAT.dentin} />
      </mesh>
    </group>
  );
};

/** Ceramic crown (the crown part of the tooth shape, slightly larger). */
export const Crown: React.FC<{ position?: [number, number, number]; opacity?: number }> = ({ position = [0, 0, 0], opacity = 1 }) => {
  const g = useMemo(() => lathe(PROFILE.filter(([, y]) => y >= -0.05), 1.02), []);
  return (
    <mesh geometry={g} position={position}>
      <meshPhysicalMaterial {...MAT.ceramic} transparent={opacity < 1} opacity={opacity} />
    </mesh>
  );
};

/** Threaded titanium implant (top at y = 0 in its own space). */
export const Implant: React.FC<{ position?: [number, number, number]; rotationY?: number }> = ({ position = [0, 0, 0], rotationY = 0 }) => {
  const H = 1.25;
  const thread = useMemo(() => {
    const turns = 9;
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 400; i++) {
      const u = i / 400;
      const y = -0.08 - u * (H - 0.2);
      const r = 0.19 - 0.06 * u; // tapers with the body
      pts.push(new THREE.Vector3(Math.cos(u * turns * Math.PI * 2) * r, y, Math.sin(u * turns * Math.PI * 2) * r));
    }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 600, 0.028, 8, false);
  }, []);
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[0, -H / 2, 0]}>
        <cylinderGeometry args={[0.18, 0.11, H, 48]} />
        <meshStandardMaterial {...MAT.titanium} />
      </mesh>
      <mesh geometry={thread}>
        <meshStandardMaterial {...MAT.titanium} />
      </mesh>
      <mesh position={[0, -H - 0.02, 0]}>
        <sphereGeometry args={[0.11, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
        <meshStandardMaterial {...MAT.titanium} />
      </mesh>
    </group>
  );
};

/** Abutment: connects implant to crown (bottom at y = 0 in its own space). */
export const Abutment: React.FC<{ position?: [number, number, number] }> = ({ position = [0, 0, 0] }) => (
  <group position={position}>
    <mesh position={[0, 0.06, 0]}>
      <cylinderGeometry args={[0.2, 0.17, 0.12, 48]} />
      <meshStandardMaterial {...MAT.titanium} />
    </mesh>
    <mesh position={[0, 0.3, 0]}>
      <cylinderGeometry args={[0.12, 0.16, 0.36, 48]} />
      <meshStandardMaterial {...MAT.titanium} />
    </mesh>
  </group>
);

/** Jaw section: gum on top of bone, semi-transparent "x-ray" so roots and implants stay visible. */
export const JawSection: React.FC<{ width?: number; xray?: number }> = ({ width = 3.6, xray = 0.55 }) => (
  <group>
    <mesh position={[0, -0.1, 0]}>
      <boxGeometry args={[width, 0.24, 1.0]} />
      <meshStandardMaterial {...MAT.gum} transparent opacity={0.92} />
    </mesh>
    <mesh position={[0, -1.12, 0]}>
      <boxGeometry args={[width, 1.8, 0.98]} />
      <meshStandardMaterial {...MAT.bone} transparent opacity={xray} depthWrite={false} />
    </mesh>
  </group>
);

/** Studio lighting that suits enamel and titanium on the dark brand backdrop (no HDR downloads). */
export const DentalLights: React.FC<{ rim?: string }> = ({ rim = "#C9AB86" }) => (
  <>
    <ambientLight intensity={0.55} />
    <directionalLight position={[2.5, 4, 3]} intensity={2.2} />
    <directionalLight position={[-3, 1.5, -2]} intensity={1.1} color={rim} />
    <pointLight position={[0, 1.5, 2.5]} intensity={6} distance={6} />
  </>
);
