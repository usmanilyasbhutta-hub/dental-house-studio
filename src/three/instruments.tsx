/**
 * Dental instrument models (GLB, exported from clinical-3d/whitening with --generic --glb).
 * Units are millimetres; the exporter writes Blender Z-up as glTF Y-up, so <Instrument> rotates back to the
 * Blender build convention: working end at the origin, handle along -Y, tooth surface facing +Z (the camera).
 */
import React, { useEffect, useMemo, useState } from "react";
import { continueRender, delayRender, staticFile } from "remotion";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { INSTRUMENTS } from "../brief/schema";

export type InstrumentName = (typeof INSTRUMENTS)[number];

/** Base display roll about the vertical axis (same as the Blender comparison views). */
export const DISPLAY_ROLL: Record<InstrumentName, number> = {
  scaler: 0, barrier_syringe: 0, curing_light: 90, syringe: 0, suction: 0, polisher: 90,
};

const cache = new Map<InstrumentName, Promise<THREE.Group>>();
function loadModel(name: InstrumentName) {
  if (!cache.has(name)) {
    cache.set(
      name,
      new Promise((resolve, reject) =>
        new GLTFLoader().load(staticFile(`models/whitening/${name}.glb`), (g) => resolve(fixMaterials(g.scene)), undefined, reject),
      ),
    );
  }
  return cache.get(name)!;
}

/** The exporter cannot carry the clear-plastic mix shader; rebuild it, and tune the rest for three.js. */
function fixMaterials(root: THREE.Group) {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const m = mesh.material as THREE.MeshStandardMaterial;
    const n = (m.name || "").toLowerCase();
    if (n.includes("clear")) {
      mesh.material = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color("#dfeaf0"), roughness: 0.06, metalness: 0, transparent: true,
        opacity: n.includes("thin") ? 0.18 : 0.3, depthWrite: false, side: THREE.DoubleSide, clearcoat: 1, clearcoatRoughness: 0.05,
      });
      mesh.renderOrder = 2;
    } else if (n.includes("curing window")) {
      m.emissive = new THREE.Color("#2a5cff");
      m.emissiveIntensity = 0.9;
    } else {
      m.envMapIntensity = 1.0;
    }
  });
  return root;
}

/** Loads models once per tab; rendering waits for them (Remotion delayRender). */
export function useModels(names: InstrumentName[]) {
  const key = names.join(",");
  const [models, setModels] = useState<THREE.Group[] | null>(null);
  const [handle] = useState(() => delayRender(`load ${key}`));
  useEffect(() => {
    let live = true;
    Promise.all(names.map(loadModel))
      .then((list) => {
        if (live) setModels(list.map((g) => g.clone(true)));
        continueRender(handle);
      })
      .catch((e) => {
        console.error(e);
        continueRender(handle);
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return models;
}

/** Studio reflections for metal and gloss (procedural room, no files). */
export const StudioEnvironment: React.FC = () => {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    return () => {
      env.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);
  return null;
};

/** World transform of an instrument on the stage: glTF fix, display roll, turntable, offset. */
export function instrumentMatrix(name: InstrumentName, turn: number, offsetX: number, tilt = 0, scale = 1) {
  const fix = new THREE.Matrix4().makeRotationX(Math.PI / 2);
  const roll = new THREE.Matrix4().makeRotationY(THREE.MathUtils.degToRad(DISPLAY_ROLL[name]));
  const spin = new THREE.Matrix4().makeRotationY(turn);
  const lean = new THREE.Matrix4().makeRotationX(tilt);
  const size = new THREE.Matrix4().makeScale(scale, scale, scale);
  const move = new THREE.Matrix4().makeTranslation(offsetX, 0, 0);
  return move.multiply(size).multiply(lean).multiply(spin).multiply(roll).multiply(fix);
}

/** Blender model-space point (mm) -> world, through the same transform. */
export function modelPointToWorld(name: InstrumentName, p: [number, number, number], turn: number, offsetX: number, tilt = 0, scale = 1) {
  // Blender coordinates -> glTF coordinates first (x, z, -y), then the instrument matrix.
  const v = new THREE.Vector3(p[0], p[2], -p[1]);
  return v.applyMatrix4(instrumentMatrix(name, turn, offsetX, tilt, scale));
}

/** World-space bounds of a model at a given pose. */
export function modelBounds(model: THREE.Group, name: InstrumentName, offsetX: number, tilt = 0, scale = 1) {
  const g = new THREE.Group();
  const c = model.clone(true);
  g.add(c);
  c.matrixAutoUpdate = false;
  c.matrix.copy(instrumentMatrix(name, 0, offsetX, tilt, scale));
  g.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(g);
}

export const Instrument: React.FC<{ model: THREE.Group; name: InstrumentName; turn: number; offsetX: number; tilt?: number; scale?: number }> = ({ model, name, turn, offsetX, tilt = 0, scale = 1 }) => {
  const m = useMemo(() => instrumentMatrix(name, turn, offsetX, tilt, scale), [name, turn, offsetX, tilt, scale]);
  return <primitive object={model} matrixAutoUpdate={false} matrix={m} />;
};

/** Fixed orthographic view (R3F's default camera otherwise looks at the world origin). */
export const OrthoRig: React.FC<{ x: number; y: number; zoom: number }> = ({ x, y, zoom }) => {
  const camera = useThree((st) => st.camera) as THREE.OrthographicCamera;
  camera.position.set(x, y, 600);
  camera.lookAt(x, y, 0);
  camera.zoom = zoom;
  camera.updateProjectionMatrix();
  return null;
};
