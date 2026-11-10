/**
 * Composite restoration of carious 11/21 (mesial), stage by stage. Generic products only.
 * stages: decay → prep → etch → bond → layer → cure → polish   (PROCEDURE_STAGES.composite)
 */
import React from "react";
import { Easing, interpolate } from "remotion";
import { useThree } from "@react-three/fiber";
import { CuringLight, Gum, MicroBrush, Patch, PolisherDisc, Spray, Syringe, TEETH, Tooth2, Turbine } from "./anterior";
import { DentalLights } from "./dental";

const ease = Easing.bezier(0.33, 1, 0.68, 1);
const io = Easing.bezier(0.65, 0, 0.35, 1);
const r = (v: number, a: number, b: number, from: number, to: number, e = ease) =>
  interpolate(v, [a, b], [from, to], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: e });
const mix = (a: number[], b: number[], k: number) => a.map((v, i) => v + (b[i] - v) * k) as [number, number, number];

/** The two mesial cavities face each other at the midline. */
const SITES = [
  { x: -0.13, y: -0.14 },
  { x: 0.13, y: -0.12 },
];
const Z = 0.16;
const TARGET: [number, number, number] = [0, -0.13, Z + 0.06];

const CameraRig: React.FC<{ pos: [number, number, number]; look: [number, number, number] }> = ({ pos, look }) => {
  const camera = useThree((s) => s.camera);
  camera.position.set(...pos);
  camera.lookAt(...look);
  return null;
};

/** Instrument enters along a path, holds at the target, leaves. k = stage progress 0..1. */
function travel(k: number, from: [number, number, number], at: [number, number, number], to: [number, number, number], inEnd = 0.3, outStart = 0.82) {
  if (k <= inEnd) return mix(from, at, r(k, 0, inEnd, 0, 1));
  if (k >= outStart) return mix(at, to, r(k, outStart, 1, 0, 1, Easing.in(Easing.cubic)));
  return at;
}

export const CompositeScene: React.FC<{ after: (k: number) => number; frame: number; stage: number; pullBack: number }> = ({ after, frame, stage, pullBack }) => {
  const [p0, p1, p2, p3, p4, p5, p6] = [0, 1, 2, 3, 4, 5, 6].map(after);
  // camera: wide on the arch → push in on the centrals → pull back at the end
  const push = r(p0, 0.15, 0.9, 0, 1, io) * (1 - pullBack);
  const cam = mix([0, 0.15, 7.6], [0.05, -0.05, 3.3], push);
  const look = mix([0, -0.05, 0], [0, -0.12, 0], push);
  const decay = 1 - r(p1, 0.45, 0.65, 0, 1);
  const cavity = r(p1, 0.5, 0.7, 0, 1) * (1 - r(p4, 0.2, 0.5, 0, 1));
  const etchGel = r(p2, 0.3, 0.55, 0, 1) * (1 - r(p2, 0.72, 0.85, 0, 1));
  const etched = r(p2, 0.75, 0.9, 0, 1) * (1 - r(p3, 0.35, 0.6, 0, 1));
  const bond = r(p3, 0.35, 0.6, 0, 1) * (1 - r(p4, 0.25, 0.45, 0, 1));
  const dentinLayer = r(p4, 0.25, 0.5, 0, 1);
  const enamelLayer = r(p4, 0.55, 0.8, 0, 1);
  const cure = stage === 5 ? Math.sin(Math.PI * Math.min(1, p5 * 1.15)) : 0;
  const blend = r(p6, 0.25, 0.85, 0, 1); // polishing blends the restoration into the tooth
  const restoration = Math.max(dentinLayer, enamelLayer) * (1 - blend);
  return (
    <>
      <CameraRig pos={cam} look={look} />
      <DentalLights />
      <directionalLight position={[0, -2, 4]} intensity={0.6} />
      {/* polish: moving specular highlight */}
      {stage === 6 ? <pointLight position={[interpolate(p6, [0.2, 0.9], [-1.2, 1.2], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }), 0.2, 1.4]} intensity={6} distance={3} /> : null}
      <Gum />
      {TEETH.map((t) => <Tooth2 key={t.id} spec={t} />)}

      {SITES.map((s, i) => (
        <group key={i}>
          {/* caries: chalky halo + dark lesion */}
          {decay > 0.01 ? (
            <>
              <Patch x={s.x} y={s.y} rx={0.15} ry={0.2} z={Z - 0.005} depth={0.03} color="#EFE7D2" gloss={0.1} opacity={0.9 * decay} />
              <Patch x={s.x} y={s.y} rx={0.09} ry={0.13} z={Z} depth={0.045} color="#5A3A22" gloss={0.2} opacity={decay} />
            </>
          ) : null}
          {/* prepared cavity: exposed dentin, slightly darker rim */}
          {cavity > 0.01 ? (
            <>
              <Patch x={s.x} y={s.y} rx={0.16} ry={0.22} z={Z - 0.01} depth={0.035} color="#C79B5C" gloss={0.15} opacity={cavity} />
              <Patch x={s.x} y={s.y} rx={0.12} ry={0.17} z={Z + 0.004} depth={0.03} color="#DDBC86" gloss={0.15} opacity={cavity} />
            </>
          ) : null}
          {etchGel > 0.01 ? <Patch x={s.x} y={s.y} rx={0.18 * etchGel} ry={0.24 * etchGel} z={Z + 0.02} depth={0.05} color="#3E7BE0" gloss={0.9} opacity={0.9} /> : null}
          {etched > 0.01 ? <Patch x={s.x} y={s.y} rx={0.18} ry={0.24} z={Z + 0.01} depth={0.03} color="#F4F2EC" gloss={0.02} opacity={0.85 * etched} /> : null}
          {bond > 0.01 ? <Patch x={s.x} y={s.y} rx={0.18} ry={0.24} z={Z + 0.02} depth={0.035} color="#FFF4D6" gloss={1} opacity={0.55 * bond} /> : null}
          {/* composite layers, colour-coded like a textbook: dentin body (warm), enamel (white) */}
          {restoration > 0.01 ? (
            <>
              <Patch x={s.x} y={s.y} rx={0.17} ry={0.23} z={Z + 0.01} depth={0.03 + 0.03 * dentinLayer} color="#E8A0A8" gloss={0.4} opacity={restoration * (1 - enamelLayer * 0.85)} emissive={cure > 0.05 ? "#2A4FCC" : undefined} />
              {enamelLayer > 0.01 ? <Patch x={s.x} y={s.y} rx={0.19} ry={0.25} z={Z + 0.015} depth={0.05} color="#F2EEE4" gloss={0.7} opacity={enamelLayer * (1 - blend)} emissive={cure > 0.05 ? "#3E6BFF" : undefined} /> : null}
            </>
          ) : null}
        </group>
      ))}

      {/* 1 prep: turbine with spinning bur and water spray */}
      {stage === 1 ? (
        <>
          <Turbine position={travel(p1, [3, 2.4, 1.8], [TARGET[0] + Math.sin(frame * 1.7) * 0.012, TARGET[1] + 0.02, TARGET[2]], [3, 2.6, 2])} rotation={[0.35, -0.5, 0.15]} spin={frame * 2.5} />
          <Spray frame={frame} origin={[TARGET[0] + 0.05, TARGET[1] + 0.05, TARGET[2]]} amount={p1 > 0.3 && p1 < 0.82 ? 1 : 0} />
        </>
      ) : null}
      {/* 2 etch: blue gel syringe */}
      {stage === 2 ? <Syringe label="ETCH 37%" sub="PHOSPHORIC GEL" barrel="#3E7BE0" labelBg="#1C2A44" labelFg="#F7F8F6" position={travel(p2, [-3, 2.6, 1.5], [TARGET[0] - 0.05, TARGET[1] + 0.02, TARGET[2]], [-3, 2.8, 1.6])} rotation={[0.25, r(p2, 0, 0.3, 4, 0.4), 0.45]} /> : null}
      {/* 3 bond: micro-brush */}
      {stage === 3 ? <MicroBrush position={travel(p3, [2.5, 2.4, 1.6], [TARGET[0] + Math.sin(frame * 0.6) * 0.06, TARGET[1], TARGET[2]], [2.6, 2.6, 1.8])} rotation={[0.3, 0, -0.5]} /> : null}
      {/* 4 layer: composite syringe */}
      {stage === 4 ? <Syringe label="COMPOSITE" sub={p4 < 0.52 ? "DENTIN SHADE" : "ENAMEL SHADE"} barrel="#ECECE8" position={travel(p4, [3, 2.8, 1.4], [TARGET[0] + 0.05, TARGET[1] + 0.02, TARGET[2]], [3.2, 3, 1.6], 0.25, 0.85)} rotation={[0.25, r(p4, 0, 0.25, -4, -0.4), -0.45]} /> : null}
      {/* 5 cure: curing light */}
      {stage === 5 ? <CuringLight position={travel(p5, [-2.6, 2.4, 2], [0, 0.05, 0.75], [-2.8, 2.6, 2.2], 0.25, 0.85)} rotation={[-0.9, 0, 0.2]} on={cure} /> : null}
      {/* 6 polish: spiral disc sweeping across the restorations */}
      {stage === 6 ? (
        <PolisherDisc position={travel(p6, [2.8, 1.8, 2], [interpolate(p6, [0.2, 0.85], [-0.25, 0.25], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }), -0.2, 0.42], [3, 2, 2.2], 0.2, 0.88)} rotation={[Math.PI / 2 - 0.15, 0, 0.25]} spin={frame * 1.6} />
      ) : null}
    </>
  );
};
