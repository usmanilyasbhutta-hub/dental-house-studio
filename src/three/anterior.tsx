/**
 * Anterior arch + restorative instruments, built in code with three.js (no downloaded models, no licences).
 * Units ≈ cm. Upper teeth: incisal edges at the bottom (y ≈ −0.55), cervical margins under the gum (y ≈ +0.45).
 * The two centrals (11, 21) meet at x = 0, where the mesial cavities face each other.
 * Every prop is frame-driven by the caller (useCurrentFrame); nothing animates on its own.
 */
import React, { useMemo } from "react";
import * as THREE from "three";
import type {} from "@react-three/fiber";

/** Curve of the arch: teeth further from the midline sit further back. */
export const archZ = (x: number) => -0.09 * x * x;
export const archRotY = (x: number) => Math.atan(-0.18 * x);

type ToothSpec = { id: string; x: number; w: number; h: number; incisal: number; canine?: boolean };
export const TEETH: ToothSpec[] = [
  { id: "13", x: -1.98, w: 0.74, h: 1.08, incisal: -0.58, canine: true },
  { id: "12", x: -1.26, w: 0.64, h: 0.92, incisal: -0.46 },
  { id: "11", x: -0.45, w: 0.86, h: 1.1, incisal: -0.6 },
  { id: "21", x: 0.45, w: 0.86, h: 1.1, incisal: -0.6 },
  { id: "22", x: 1.26, w: 0.64, h: 0.92, incisal: -0.46 },
  { id: "23", x: 1.98, w: 0.74, h: 1.08, incisal: -0.58, canine: true },
];

/**
 * Crown as a smooth superellipsoid (rounded box with dense, evenly subdivided faces, so curvature shades smoothly):
 * tapered towards the cervical, thinned towards the incisal edge, convex labially, pointed cusp for canines.
 * Local origin: incisal edge centre (y = 0) up to the cervical (y = h).
 */
function crownGeometry(w: number, h: number, canine = false) {
  const g = new THREE.SphereGeometry(1, 96, 72);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const hw = w / 2, hd = 0.2;
  const sp = (v: number, e: number) => Math.sign(v) * Math.pow(Math.abs(v), e);
  for (let i = 0; i < pos.count; i++) {
    const nx = pos.getX(i), ny = pos.getY(i), nz = pos.getZ(i);
    let x = sp(nx, 0.45) * hw;
    const t = (sp(ny, 0.5) + 1) / 2; // 0 incisal → 1 cervical
    let y = t * h;
    let z = sp(nz, 0.55) * hd;
    x *= 1 - 0.26 * Math.pow(t, 1.6); // narrower at the neck
    z *= 0.5 + 0.5 * Math.min(1, t * 1.6); // thin incisal edge
    if (z > 0) z += 0.06 * Math.sin(Math.min(1, t * 1.1) * Math.PI) - 0.08 * (x * x) / (hw * hw); // labial convexity
    if (canine && t < 0.25) y -= 0.14 * (1 - Math.abs(x) / hw) * (1 - t / 0.25); // cusp tip
    if (t > 0.92) y += 0.05 * Math.cos((x / hw) * Math.PI * 0.5); // rounded cervical line
    pos.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  const col = new Float32Array(pos.count * 3);
  const cerv = new THREE.Color("#E6D3AE"), body = new THREE.Color("#F4EFE4"), inc = new THREE.Color("#DCE3E8"), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const t = Math.min(1, Math.max(0, pos.getY(i) / h));
    if (t < 0.18) c.copy(inc).lerp(body, t / 0.18);
    else if (t > 0.7) c.copy(body).lerp(cerv, (t - 0.7) / 0.3);
    else c.copy(body);
    col.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return g;
}

/** Front-face z of a tooth at a local x (approximate; for placing lesions/instruments). */
export const faceZ = 0.2;

export const Tooth2: React.FC<{ spec: ToothSpec; tint?: string }> = ({ spec, tint }) => {
  const g = useMemo(() => crownGeometry(spec.w, spec.h, spec.canine), [spec]);
  return (
    <group position={[spec.x, spec.incisal, archZ(spec.x)]} rotation={[0, archRotY(spec.x), 0]}>
      <mesh geometry={g}>
        <meshPhysicalMaterial vertexColors color={tint ?? "#ffffff"} roughness={0.24} clearcoat={0.8} clearcoatRoughness={0.18} sheen={0.25} />
      </mesh>
    </group>
  );
};

/** Gingiva: a curved band with scalloped margins and papillae between the teeth. */
export const Gum: React.FC = () => {
  const g = useMemo(() => {
    const s = new THREE.Shape();
    const L = -2.8, R = 2.8, top = 3.2; // tall: its top edge stays out of frame
    s.moveTo(L, top);
    s.lineTo(L, 0.32);
    let x = L;
    for (const t of TEETH) {
      const left = t.x - t.w / 2, right = t.x + t.w / 2;
      const margin = t.incisal + t.h * 0.9; // cervical arc top
      s.lineTo(left, 0.22 + (t.incisal + 0.6) * 0.4); // papilla tip between teeth
      s.bezierCurveTo(left + t.w * 0.2, margin + 0.12, right - t.w * 0.2, margin + 0.12, right, 0.22 + (t.incisal + 0.6) * 0.4);
      x = right;
    }
    s.lineTo(R, 0.32);
    s.lineTo(R, top);
    s.lineTo(L, top);
    void x;
    const geo = new THREE.ExtrudeGeometry(s, { depth: 0.55, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.08, bevelSegments: 5, curveSegments: 16 });
    geo.translate(0, 0, -0.32);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) pos.setZ(i, pos.getZ(i) + archZ(pos.getX(i)));
    geo.computeVertexNormals();
    return geo;
  }, []);
  return (
    <mesh geometry={g}>
      <meshPhysicalMaterial color="#C25E66" roughness={0.55} clearcoat={0.22} clearcoatRoughness={0.5} sheen={0.5} sheenColor="#E89A9A" />
    </mesh>
  );
};

/** A coloured patch sitting on a tooth's labial surface (lesion, cavity, etch, composite layers). */
export const Patch: React.FC<{ x: number; y: number; rx: number; ry: number; color: string; z?: number; depth?: number; gloss?: number; opacity?: number; emissive?: string }> = ({
  x, y, rx, ry, color, z = faceZ, depth = 0.05, gloss = 0.4, opacity = 1, emissive,
}) => (
  <mesh position={[x, y, z + archZ(x)]} scale={[rx, ry, depth]} rotation={[0, archRotY(x), 0]}>
    <sphereGeometry args={[1, 32, 20]} />
    <meshPhysicalMaterial color={color} roughness={1 - gloss} clearcoat={gloss} transparent={opacity < 1} opacity={opacity} emissive={emissive ?? "#000"} emissiveIntensity={emissive ? 0.6 : 0} />
  </mesh>
);

/* ------------------------------------------------------------------ instruments */

const METAL = { color: "#C9CED3", roughness: 0.3, metalness: 0.6 } as const;

/** Text label texture for generic product labels (brand fonts are loaded before any frame renders). */
function labelTexture(text: string, bg: string, fg: string, sub?: string) {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 256;
  const x = c.getContext("2d")!;
  x.fillStyle = bg;
  x.fillRect(0, 0, c.width, c.height);
  x.fillStyle = fg;
  x.font = "700 120px Oswald, Arial, sans-serif";
  x.textBaseline = "middle";
  x.fillText(text, 40, sub ? 100 : 128);
  if (sub) {
    x.font = "500 52px 'JetBrains Mono', monospace";
    x.fillText(sub, 44, 200);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Generic composite/etch syringe. Tip points to −y in local space (origin at the tip). */
export const Syringe: React.FC<{ label: string; sub?: string; barrel: string; labelBg?: string; labelFg?: string; position?: [number, number, number]; rotation?: [number, number, number] }> = ({
  label, sub, barrel, labelBg = "#F7F8F6", labelFg = "#1C2220", position = [0, 0, 0], rotation = [0, 0, 0],
}) => {
  const tex = useMemo(() => labelTexture(label, labelBg, labelFg, sub), [label, labelBg, labelFg, sub]);
  const tip = useMemo(() => new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0.42, 0), new THREE.Vector3(0, 0.12, 0), new THREE.Vector3(0.06, 0, 0.05)), 20, 0.018, 10), []);
  return (
    <group position={position} rotation={rotation}>
      <mesh geometry={tip}><meshStandardMaterial {...METAL} /></mesh>
      <mesh position={[0, 0.5, 0]}><cylinderGeometry args={[0.035, 0.09, 0.18, 32]} /><meshStandardMaterial color={barrel} roughness={0.35} /></mesh>
      <mesh position={[0, 1.15, 0]}><cylinderGeometry args={[0.1, 0.1, 1.15, 48]} /><meshPhysicalMaterial color={barrel} roughness={0.3} clearcoat={0.6} /></mesh>
      <mesh position={[0, 1.2, 0]} rotation={[0, Math.PI / 2, 0]}>
        <cylinderGeometry args={[0.102, 0.102, 0.7, 48, 1, true]} />
        <meshStandardMaterial map={tex} roughness={0.5} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 1.78, 0]}><cylinderGeometry args={[0.16, 0.16, 0.04, 32]} /><meshStandardMaterial color={barrel} roughness={0.4} /></mesh>
      <mesh position={[0, 2.0, 0]}><cylinderGeometry args={[0.035, 0.035, 0.42, 16]} /><meshStandardMaterial color="#E9E9E6" roughness={0.5} /></mesh>
      <mesh position={[0, 2.22, 0]}><cylinderGeometry args={[0.12, 0.12, 0.04, 32]} /><meshStandardMaterial color="#E9E9E6" roughness={0.5} /></mesh>
    </group>
  );
};

/** High-speed turbine handpiece with bur. Origin at the bur tip; body runs up/right. */
export const Turbine: React.FC<{ position?: [number, number, number]; rotation?: [number, number, number]; spin?: number }> = ({ position = [0, 0, 0], rotation = [0, 0, 0], spin = 0 }) => (
  <group position={position} rotation={rotation}>
    <group rotation={[0, spin, 0]}>
      <mesh position={[0, 0.11, 0]}><cylinderGeometry args={[0.016, 0.016, 0.2, 12]} /><meshStandardMaterial color="#D4AF55" metalness={0.7} roughness={0.25} /></mesh>
      <mesh position={[0, 0.02, 0]}><sphereGeometry args={[0.032, 16, 12]} /><meshStandardMaterial color="#D4AF55" metalness={0.7} roughness={0.35} /></mesh>
    </group>
    <mesh position={[0, 0.27, 0]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.13, 0.13, 0.16, 40]} /><meshStandardMaterial {...METAL} /></mesh>
    <mesh position={[0.32, 0.3, 0]} rotation={[0, 0, Math.PI / 2 - 0.12]}><cylinderGeometry args={[0.06, 0.075, 0.55, 32]} /><meshStandardMaterial {...METAL} /></mesh>
    <mesh position={[1.35, 0.42, 0]} rotation={[0, 0, Math.PI / 2 - 0.12]}><cylinderGeometry args={[0.095, 0.11, 1.6, 40]} /><meshStandardMaterial {...METAL} roughness={0.38} /></mesh>
    {[0.75, 0.95, 1.15, 1.35, 1.55, 1.75].map((x) => (
      <mesh key={x} position={[x, 0.42 - (x - 1.35) * 0.12, 0]} rotation={[0, 0, Math.PI / 2 - 0.12]}><torusGeometry args={[0.104, 0.008, 8, 32]} /><meshStandardMaterial color="#8E959B" metalness={0.6} roughness={0.4} /></mesh>
    ))}
  </group>
);

/** Contra-angle with a spiral polishing disc. Origin at the disc centre. */
export const PolisherDisc: React.FC<{ position?: [number, number, number]; rotation?: [number, number, number]; spin?: number }> = ({ position = [0, 0, 0], rotation = [0, 0, 0], spin = 0 }) => {
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 512;
    const x = c.getContext("2d")!;
    x.fillStyle = "#EFE6D2";
    x.beginPath(); x.arc(256, 256, 256, 0, Math.PI * 2); x.fill();
    x.strokeStyle = "#CDBF9F"; x.lineWidth = 10;
    for (let k = 0; k < 18; k++) {
      x.beginPath();
      for (let r = 40; r < 250; r += 4) {
        const a = (k / 18) * Math.PI * 2 + r / 70;
        x.lineTo(256 + Math.cos(a) * r, 256 + Math.sin(a) * r);
      }
      x.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  return (
    <group position={position} rotation={rotation}>
      <mesh rotation={[0, spin, 0]}><cylinderGeometry args={[0.32, 0.32, 0.02, 64]} /><meshStandardMaterial map={tex} roughness={0.8} /></mesh>
      <mesh position={[0, 0.08, 0]}><cylinderGeometry args={[0.02, 0.02, 0.16, 12]} /><meshStandardMaterial {...METAL} /></mesh>
      <mesh position={[0, 0.2, 0]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.1, 0.1, 0.14, 32]} /><meshStandardMaterial {...METAL} /></mesh>
      <mesh position={[0.3, 0.26, 0]} rotation={[0, 0, Math.PI / 2 - 0.25]}><cylinderGeometry args={[0.055, 0.07, 0.5, 32]} /><meshStandardMaterial {...METAL} /></mesh>
      <mesh position={[1.3, 0.5, 0]} rotation={[0, 0, Math.PI / 2 - 0.25]}><cylinderGeometry args={[0.1, 0.11, 1.6, 40]} /><meshStandardMaterial {...METAL} roughness={0.38} /></mesh>
      <mesh position={[0.72, 0.36, 0]} rotation={[0, 0, Math.PI / 2 - 0.25]}><torusGeometry args={[0.105, 0.02, 10, 32]} /><meshStandardMaterial color="#5B7FE0" roughness={0.4} /></mesh>
    </group>
  );
};

/** Bonding applicator (micro-brush). Origin at the tip. */
export const MicroBrush: React.FC<{ position?: [number, number, number]; rotation?: [number, number, number] }> = ({ position = [0, 0, 0], rotation = [0, 0, 0] }) => (
  <group position={position} rotation={rotation}>
    <mesh position={[0, 0.03, 0]}><sphereGeometry args={[0.045, 16, 12]} /><meshStandardMaterial color="#F3F1E6" roughness={0.95} /></mesh>
    <mesh position={[0, 0.9, 0]}><cylinderGeometry args={[0.02, 0.02, 1.7, 12]} /><meshStandardMaterial color="#E8C35A" roughness={0.5} /></mesh>
  </group>
);

/** Curing light: wand with an angled light guide; `on` 0..1 lights a blue cone. Origin at the guide tip. */
export const CuringLight: React.FC<{ position?: [number, number, number]; rotation?: [number, number, number]; on?: number }> = ({ position = [0, 0, 0], rotation = [0, 0, 0], on = 0 }) => (
  <group position={position} rotation={rotation}>
    <mesh position={[0, 0.02, 0]}><cylinderGeometry args={[0.07, 0.07, 0.04, 32]} /><meshStandardMaterial color="#9fc3ff" emissive="#5aa0ff" emissiveIntensity={1.4 * on} /></mesh>
    <mesh position={[0, 0.25, 0]} rotation={[0, 0, -0.35]}><cylinderGeometry args={[0.06, 0.07, 0.45, 24]} /><meshStandardMaterial color="#E3A33A" roughness={0.2} transparent opacity={0.85} /></mesh>
    <mesh position={[0.55, 0.62, 0]} rotation={[0, 0, Math.PI / 2 - 0.35]}><cylinderGeometry args={[0.12, 0.13, 1.4, 40]} /><meshPhysicalMaterial color="#F2F2EE" roughness={0.3} clearcoat={0.6} /></mesh>
    {on > 0.01 ? (
      <>
        <mesh position={[0, -0.32, 0]}><coneGeometry args={[0.3, 0.6, 32, 1, true]} /><meshBasicMaterial color="#6FA8FF" transparent opacity={0.1 * on} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} /></mesh>
        <pointLight position={[0, -0.25, 0.2]} color="#5aa0ff" intensity={5 * on} distance={1.6} />
      </>
    ) : null}
  </group>
);

/** Little water-spray droplets from the turbine (seeded, frame-driven). */
export const Spray: React.FC<{ frame: number; origin: [number, number, number]; amount?: number }> = ({ frame, origin, amount = 1 }) => {
  if (amount < 0.05) return null;
  return (
    <>
      {Array.from({ length: 18 }, (_, i) => {
        const life = ((frame * 0.07 + i * 0.37) % 1);
        const a = i * 2.39;
        return (
          <mesh key={i} position={[origin[0] + Math.cos(a) * life * 0.35, origin[1] - life * 0.25 + Math.sin(a * 1.7) * 0.05, origin[2] + Math.sin(a) * life * 0.3 + 0.1]} scale={(1 - life) * 0.022 * amount + 0.004}>
            <sphereGeometry args={[1, 8, 6]} />
            <meshPhysicalMaterial color="#ffffff" transmission={0.9} roughness={0.05} transparent opacity={0.8 * amount} />
          </mesh>
        );
      })}
    </>
  );
};
