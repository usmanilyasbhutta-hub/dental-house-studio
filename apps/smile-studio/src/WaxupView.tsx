// 3D wax-up: the lab's digital wax-up (STL) over the patient's original scan (STL), measured on this phone.
// Files are kept in IndexedDB with the case and are never uploaded. Loaded lazily (three.js is only needed here).
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { archLength, changedTeeth, FAR_MM, MEAN_WIDTH, perTooth, SAME_MM, toothLine, WAXUP_DISCLAIMER, type Mesh, type Rigid, type Thickness, type ToothChange, type WaxArch } from "./waxup";
import type { WaxReply } from "./waxupWorker";
import { mergeMaterials, reduction, reductionLine, REDUCTION_DISCLAIMER, THICKNESS_KEY, type MaterialMin, type ToothReduction } from "./reduction";
import { loadWaxup, saveWaxup, type WaxFile, type WaxupData } from "./storage";
import { Chips, Hint, Icon, Toggle } from "./ui";

type Mode = "before" | "after" | "changes" | "reduction";
type View = "front" | "occlusal" | "side";
type Slot = "original" | "waxup";

interface Loaded {
  key: string;
  original?: Mesh;
  waxup: Mesh;
  th?: Thickness & { T?: Rigid };
  fit?: number;
  close?: number;
}

const MAX_MB = 80;

/** Colour of a signed distance: green = material added, red = tooth to reduce, ivory = unchanged, grey = not compared. */
export function heatColour(d: number): [number, number, number] {
  const ivory: [number, number, number] = [0.91, 0.89, 0.85];
  if (Number.isNaN(d)) return [0.62, 0.65, 0.64];
  if (Math.abs(d) <= SAME_MM) return ivory;
  const k = Math.min(1, (Math.abs(d) - SAME_MM) / (1 - SAME_MM));
  const to: [number, number, number] = d > 0 ? [0.1, 0.6, 0.33] : [0.84, 0.25, 0.25];
  return [ivory[0] + (to[0] - ivory[0]) * k, ivory[1] + (to[1] - ivory[1]) * k, ivory[2] + (to[2] - ivory[2]) * k];
}

/** Colour of an estimated reduction: ivory = none needed, amber → red up to 1 mm, grey = not estimated. */
export function prepColour(p: number): [number, number, number] {
  if (Number.isNaN(p)) return [0.62, 0.65, 0.64];
  const ivory: [number, number, number] = [0.91, 0.89, 0.85];
  if (p <= SAME_MM) return ivory;
  const k = Math.min(1, (p - SAME_MM) / (1 - SAME_MM));
  const amber: [number, number, number] = [0.95, 0.68, 0.2], red: [number, number, number] = [0.78, 0.16, 0.18];
  const a = k < 0.5 ? ivory : amber, b = k < 0.5 ? amber : red, t = k < 0.5 ? k * 2 : (k - 0.5) * 2;
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function loadThickness(): MaterialMin[] {
  try {
    return mergeMaterials(JSON.parse(localStorage.getItem(THICKNESS_KEY) ?? "null"));
  } catch {
    return mergeMaterials(null);
  }
}

export default function WaxupView({ caseId, arch: startArch, onClose, deliver }: { caseId: string; arch: WaxArch; onClose: () => void; deliver: (files: File[], title: string) => Promise<void> }) {
  const [data, setData] = useState<WaxupData | null>(null);
  const [arch, setArch] = useState<WaxArch>(startArch);
  const [mode, setMode] = useState<Mode>("changes");
  const [view, setView] = useState<View>("front");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [probe, setProbe] = useState<{ d: number; fdi?: number; i: number } | null>(null);
  const [mats, setMats] = useState<MaterialMin[]>(loadThickness);
  const saveMats = (next: MaterialMin[]) => {
    setMats(next);
    try {
      localStorage.setItem(THICKNESS_KEY, JSON.stringify(next));
    } catch {
      /* private mode: edits last for this visit */
    }
  };
  const files = data?.[arch];

  useEffect(() => {
    loadWaxup(caseId).then((w) => setData(w ?? { id: caseId, updatedAt: Date.now() }));
  }, [caseId]);

  const update = (patch: Partial<NonNullable<WaxupData["lower"]>>) => {
    if (!data) return;
    const next: WaxupData = { ...data, [arch]: { ...data[arch], ...patch }, updatedAt: Date.now() };
    setData(next);
    saveWaxup(next).catch(() => setError("Could not save the file on this phone (storage full?)."));
  };

  const pick = (slot: Slot) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".stl,model/stl,application/sla,application/octet-stream";
    input.onchange = () => {
      const f = input.files?.[0];
      if (!f) return;
      if (f.size > MAX_MB * 1024 * 1024) return setError(`That file is over ${MAX_MB} MB. Export a lighter STL from the lab software.`);
      setError("");
      update({ [slot]: { name: f.name, blob: f } satisfies WaxFile });
    };
    input.click();
  };

  // measure in a worker whenever the files change
  const key = `${arch}|${files?.original?.name ?? ""}:${files?.original?.blob.size ?? 0}|${files?.waxup?.name ?? ""}:${files?.waxup?.blob.size ?? 0}`;
  useEffect(() => {
    if (!files?.waxup) {
      setLoaded(null);
      return;
    }
    if (loaded?.key === key) return;
    let dead = false;
    setBusy(files.original ? "Matching the wax-up to the scan and measuring…" : "Opening the wax-up…");
    setError("");
    const worker = new Worker(new URL("./waxupWorker.ts", import.meta.url), { type: "module" });
    (async () => {
      const job = { waxup: await files.waxup!.blob.arrayBuffer(), original: files.original ? await files.original.blob.arrayBuffer() : undefined };
      worker.onmessage = (e: MessageEvent<WaxReply>) => {
        worker.terminate();
        if (dead) return;
        setBusy("");
        const r = e.data;
        if (!r.ok) return setError(r.error);
        const th = r.result?.th;
        if (th && r.result) (th as Thickness & { T?: unknown }).T = r.result.align.T;
        setLoaded({ key, original: r.original, waxup: r.waxup, th, fit: r.result?.align.fit, close: r.result?.align.close });
        setProbe(null);
      };
      worker.onerror = () => {
        worker.terminate();
        if (!dead) {
          setBusy("");
          setError("Could not read these files on this phone.");
        }
      };
      worker.postMessage(job, [job.waxup, ...(job.original ? [job.original] : [])]);
    })();
    return () => {
      dead = true;
      worker.terminate();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const shift = files?.shift ?? 0;
  const flip = !!files?.flip;
  const teeth: ToothChange[] = useMemo(
    () => (loaded?.th && loaded.original ? changedTeeth(perTooth(loaded.th, loaded.original, loaded.waxup, arch, { shift, flip })) : []),
    [loaded, arch, shift, flip],
  );

  const choice = useMemo(() => files?.materials ?? {}, [files?.materials]);
  const red = useMemo(
    () => (loaded?.th && Object.keys(choice).length ? reduction(loaded.th, loaded.waxup, arch, choice, mats, { shift, flip }) : null),
    [loaded, arch, choice, mats, shift, flip],
  );
  const redTeeth: ToothReduction[] = red?.teeth ?? [];
  const setMaterial = (fdi: number, id: string) => {
    const next = { ...choice };
    if (id) next[fdi] = id;
    else delete next[fdi];
    update({ materials: next });
  };
  const setAll = (id: string) => update({ materials: id ? Object.fromEntries(teeth.map((t) => [t.fdi, id])) : {} });

  const canvasHost = useRef<HTMLDivElement>(null);
  const three = useRef<ReturnType<typeof makeScene> | null>(null);
  const [no3d, setNo3d] = useState(false);
  useEffect(() => {
    if (!canvasHost.current) return;
    try {
      const s = makeScene(canvasHost.current);
      three.current = s;
      return () => s.dispose();
    } catch {
      setNo3d(true); // no WebGL: the measurements below still work
    }
  }, []);
  useEffect(() => {
    three.current?.setMeshes(loaded, arch, { shift, flip }, (d, fdi, i) => setProbe({ d, fdi, i }));
  }, [loaded, arch, shift, flip]);
  useEffect(() => three.current?.setReduction(red?.prep ?? null), [red, loaded]);
  useEffect(() => three.current?.setMode(mode, !!loaded?.th), [mode, loaded, red]);
  useEffect(() => three.current?.setView(view, arch), [view, loaded, arch]);

  const saveImage = async () => {
    const s = three.current;
    if (!s || !loaded) return;
    const cv = mode === "reduction" ? s.snapshot(teeth, arch, redTeeth) : s.snapshot(teeth, arch);
    const blob = await new Promise<Blob | null>((r) => cv.toBlob(r, "image/png"));
    if (blob)
      await deliver(
        [new File([blob], `${mode === "reduction" ? "reduction" : "waxup"}-${arch}.png`, { type: "image/png" })],
        mode === "reduction" ? "Reduction estimate" : "Wax-up changes",
      );
  };

  return (
    <div className="waxup" role="dialog" aria-modal="true" aria-label="3D wax-up">
      <header className="topbar">
        <button className="nav-back" onClick={onClose} aria-label="Back to the plan">
          <Icon name="back" />
          <span>Plan</span>
        </button>
        <div className="title">
          <h1 className="h">3D wax-up</h1>
          <span className="sub">Stays on this phone</span>
        </div>
        <button className="pill" onClick={saveImage} disabled={!loaded}>
          Save image
        </button>
      </header>

      <div className="wax-stage" ref={canvasHost}>
        {no3d && <div className="wax-empty">This phone's browser cannot show 3D here. The measurements below still work.</div>}
        {!files?.waxup && !busy && !no3d && (
          <div className="wax-empty">
            <Icon name="tooth" size={36} />
            <p>Add the lab's wax-up STL and the original scan STL of the same jaw. The app lines them up and shows, in mm, where material is added or the tooth needs reducing.</p>
          </div>
        )}
        {busy && (
          <div className="wax-busy" role="status">
            <span className="spinner" aria-hidden="true" />
            {busy}
          </div>
        )}
        {probe && (
          <div className="wax-probe" role="status">
            {mode === "reduction"
              ? Number.isNaN(red?.prep[probe.i] ?? NaN)
                ? "Not estimated here"
                : red!.prep[probe.i] <= SAME_MM
                  ? "No reduction needed"
                  : `≈ ${red!.prep[probe.i].toFixed(1)} mm to reduce`
              : Number.isNaN(probe.d)
                ? "Not compared here"
                : Math.abs(probe.d) <= SAME_MM
                  ? "Unchanged"
                  : `${probe.d > 0 ? "+" : "−"}${Math.abs(probe.d).toFixed(1)} mm ${probe.d > 0 ? "added" : "to reduce"}`}
            {probe.fdi ? ` · ≈ ${probe.fdi}` : ""}
          </div>
        )}
        {loaded?.th && mode === "reduction" && (
          <div className="wax-legend" aria-label="Colour key">
            <span>0</span>
            <i className="red" />
            <span>1 mm reduce</span>
          </div>
        )}
        {loaded?.th && mode === "changes" && (
          <div className="wax-legend" aria-label="Colour key">
            <span>−1</span>
            <i />
            <span>+1 mm</span>
          </div>
        )}
      </div>

      <div className="panel wax-panel">
        <Chips label="Jaw" value={arch} options={[{ value: "upper", label: "Upper" }, { value: "lower", label: "Lower" }]} onChange={setArch} />
        <div className="wax-files">
          {(["original", "waxup"] as const).map((slot) => (
            <button key={slot} className={files?.[slot] ? "wax-file set" : "wax-file"} onClick={() => pick(slot)}>
              <span className="wax-file-k">{slot === "original" ? "Original scan" : "Lab wax-up"}</span>
              <span className="wax-file-v">{files?.[slot]?.name ?? "Add STL…"}</span>
            </button>
          ))}
        </div>
        {error && (
          <p className="wax-error" role="alert">
            {error}
          </p>
        )}
        {loaded && (
          <>
            <Chips
              label="Show"
              value={mode}
              options={[
                { value: "before", label: "Before" },
                { value: "after", label: "Wax-up" },
                { value: "changes", label: "Changes" },
                ...(loaded.th ? [{ value: "reduction" as const, label: "Reduction" }] : []),
              ]}
              onChange={setMode}
            />
            <Chips
              label="View"
              value={view}
              options={[
                { value: "front", label: "Front" },
                { value: "occlusal", label: "Occlusal" },
                { value: "side", label: "Side" },
              ]}
              onChange={setView}
            />
          </>
        )}
        {loaded && !loaded.th && <Hint>Add the original scan to measure the changes.</Hint>}
        {loaded?.th && (
          <>
            <p className="wax-fit">
              Matched on the unchanged areas: {loaded.fit! < 0.05 ? "< 0.05" : loaded.fit!.toFixed(2)} mm
              {loaded.fit! > 0.15 && " · check that both files are the same jaw"}
            </p>
            {mode === "reduction" ? (
              <>
                <div className="field">
                  <span className="field-label">Material per tooth · you choose</span>
                  {teeth.length ? (
                    <>
                      <label className="wax-mat all">
                        <span>All listed teeth</span>
                        <select value="" onChange={(e) => setAll(e.target.value)} aria-label="Set the material for all listed teeth">
                          <option value="">Set all…</option>
                          {mats.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.label}
                            </option>
                          ))}
                          <option value="">— clear all</option>
                        </select>
                      </label>
                      <ul className="wax-teeth">
                        {teeth.map((t) => {
                          const r = redTeeth.find((x) => x.fdi === t.fdi);
                          return (
                            <li key={t.fdi} className="wax-red">
                              <b>≈ {t.fdi}</b>
                              <div>
                                <select value={choice[t.fdi] ?? ""} onChange={(e) => setMaterial(t.fdi, e.target.value)} aria-label={`Material for tooth ${t.fdi}`}>
                                  <option value="">No material chosen</option>
                                  {mats.map((m) => (
                                    <option key={m.id} value={m.id}>
                                      {m.label}
                                    </option>
                                  ))}
                                </select>
                                {r && <span>{reductionLine(r)}</span>}
                                {r?.enamelNote && <span className="wax-note">{r.enamelNote}</span>}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </>
                  ) : (
                    <Hint>No tooth changed by more than {SAME_MM} mm.</Hint>
                  )}
                </div>
                <details className="field wax-thick">
                  <summary className="field-label">Minimum thickness · typical values, edit to your materials</summary>
                  <table>
                    <thead>
                      <tr>
                        <th>Material</th>
                        <th>Facial</th>
                        <th>Edge</th>
                        <th>Lingual</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mats.map((m, k) => (
                        <tr key={m.id}>
                          <td>{m.label}</td>
                          {(["facial", "edge", "lingual"] as const).map((s) => (
                            <td key={s}>
                              <input
                                type="number"
                                inputMode="decimal"
                                min={0}
                                max={3}
                                step={0.1}
                                value={m[s]}
                                aria-label={`${m.label} ${s} minimum, mm`}
                                onChange={(e) => {
                                  const v = Number(e.target.value);
                                  if (!Number.isFinite(v) || v < 0 || v > 3) return;
                                  saveMats(mats.map((x, j) => (j === k ? { ...x, [s]: v } : x)));
                                }}
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <Hint>0 = surface not covered by that restoration. Saved on this phone.</Hint>
                  <button className="btn secondary" onClick={() => saveMats(mergeMaterials(null))}>
                    Reset to typical values
                  </button>
                </details>
                <p className="disclaimer" role="note">
                  {REDUCTION_DISCLAIMER}
                </p>
              </>
            ) : (
            <div className="field">
                <span className="field-label">Per tooth · mm (90th percentile)</span>
                {teeth.length ? (
                  <ul className="wax-teeth">
                    {teeth.map((t) => (
                      <li key={t.fdi}>
                        <b>≈ {t.fdi}</b>
                        <span>{toothLine(t)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Hint>No tooth changed by more than {SAME_MM} mm.</Hint>
                )}
              </div>
            )}
            <div className="field">
              <span className="field-label">Tooth numbers {loaded.th.midFrom === "changes" ? "(midline from the wax-up)" : "(midline from the arch)"}</span>
              <div className="row tight">
                <button className="btn secondary" onClick={() => update({ shift: Math.round((shift - 0.5) * 10) / 10 })} aria-label="Move midline to the patient's right">
                  ← 0.5
                </button>
                <span className="wax-shift">{shift ? `${shift > 0 ? "+" : ""}${shift.toFixed(1)} mm` : "Midline"}</span>
                <button className="btn secondary" onClick={() => update({ shift: Math.round((shift + 0.5) * 10) / 10 })} aria-label="Move midline to the patient's left">
                  0.5 →
                </button>
              </div>
              <Toggle label="Swap left / right" checked={flip} onChange={(v) => update({ flip: v })} />
            </div>
            <p className="disclaimer" role="note">
              {WAXUP_DISCLAIMER}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

// ---------- three.js scene ----------

function geometry(m: Mesh, pos?: Float32Array) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos ?? m.pos, 3));
  g.setIndex(new THREE.BufferAttribute(m.idx, 1));
  g.computeVertexNormals();
  return g;
}

/** Point on the arch at arch length s (frame coordinates → world). */
function archPoint(th: Thickness, s: number, h: number) {
  let lo = -80, hi = 80;
  for (let i = 0; i < 50; i++) {
    const m = (lo + hi) / 2;
    if (archLength(th.arch, m) < s) lo = m;
    else hi = m;
  }
  const x = (lo + hi) / 2;
  const y = th.arch.a * x * x + th.arch.b * x + th.arch.k;
  const { c, w, f, o } = th.frame;
  const p = new THREE.Vector3(c[0] + w[0] * x + f[0] * y + o[0] * h, c[1] + w[1] * x + f[1] * y + o[1] * h, c[2] + w[2] * x + f[2] * y + o[2] * h);
  const slope = 2 * th.arch.a * x + th.arch.b;
  const out = new THREE.Vector3(f[0] - slope * w[0], f[1] - slope * w[1], f[2] - slope * w[2]).normalize();
  return { p, out };
}

function label(text: string) {
  const cv = document.createElement("canvas");
  cv.width = 96;
  cv.height = 48;
  const g = cv.getContext("2d")!;
  g.fillStyle = "rgba(28,34,32,0.82)";
  g.beginPath();
  g.roundRect(4, 4, 88, 40, 12);
  g.fill();
  g.fillStyle = "#f7f8f6";
  g.font = "600 26px -apple-system, Segoe UI, Roboto, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, 48, 25);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), depthTest: false, transparent: true }));
  sp.scale.set(3.6, 1.8, 1);
  sp.renderOrder = 10;
  return sp;
}

function makeScene(host: HTMLDivElement) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.domElement.className = "wax-canvas";
  host.prepend(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.5, 2000);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x445048, 1.6));
  const key = new THREE.DirectionalLight(0xffffff, 1.8);
  key.position.set(0.3, 0.6, 1);
  camera.add(key);
  scene.add(camera);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = false;
  controls.rotateSpeed = 0.8;
  let frame = 0;
  const draw = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => renderer.render(scene, camera));
  };
  controls.addEventListener("change", draw);
  const resize = () => {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    draw();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(host);

  const group = new THREE.Group();
  scene.add(group);
  let origMesh: THREE.Mesh | null = null;
  let waxMesh: THREE.Mesh | null = null;
  let marks: THREE.Group | null = null;
  let state: Loaded | null = null;
  let heat: Float32Array | null = null;
  let plain: Float32Array | null = null;
  let redCol: Float32Array | null = null;
  let onProbe: ((d: number, fdi: number | undefined, i: number) => void) | null = null;
  const marked = (m: Mode) => m === "changes" || m === "reduction";
  let slotOf: ((p: THREE.Vector3) => number | undefined) | null = null;
  /** front-teeth centre (midline, mid-crown) and the original's highest point along the occlusal axis */
  let focus: THREE.Vector3 | null = null;
  let modeNow: Mode = "changes";
  let viewNow: View = "front";
  const ivory = new THREE.MeshStandardMaterial({ color: 0xe9e5dc, roughness: 0.55, metalness: 0 });

  const clear = () => {
    for (const o of [...group.children]) {
      group.remove(o);
      o.traverse((x) => {
        const m = x as THREE.Mesh;
        m.geometry?.dispose();
        const mat = m.material as THREE.Material | undefined;
        if (mat && mat !== ivory) {
          (mat as THREE.SpriteMaterial).map?.dispose();
          mat.dispose();
        }
      });
    }
    origMesh = waxMesh = marks = null;
  };

  // tap (not drag) reads the value under the finger
  let down: { x: number; y: number } | null = null;
  const ray = new THREE.Raycaster();
  renderer.domElement.addEventListener("pointerdown", (e) => (down = { x: e.clientX, y: e.clientY }));
  renderer.domElement.addEventListener("pointerup", (e) => {
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;
    const target = waxMesh?.visible ? waxMesh : origMesh;
    if (!target || !state?.th || target !== waxMesh) return;
    const r = renderer.domElement.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
    const hit = ray.intersectObject(target)[0];
    if (!hit?.face) return;
    const ids = [hit.face.a, hit.face.b, hit.face.c];
    const pos = target.geometry.getAttribute("position");
    let best = ids[0], bd = Infinity;
    for (const i of ids) {
      const d = hit.point.distanceToSquared(new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)));
      if (d < bd) (bd = d), (best = i);
    }
    onProbe?.(state.th.d[best], slotOf?.(hit.point), best);
  });

  const api = {
    setMeshes(l: Loaded | null, arch: WaxArch, opts: { shift: number; flip: boolean }, probe: (d: number, fdi: number | undefined, i: number) => void) {
      onProbe = probe;
      const same = state === l && waxMesh;
      state = l;
      if (!same) {
        clear();
        heat = plain = null;
        if (!l) return draw();
        if (l.original) {
          origMesh = new THREE.Mesh(geometry(l.original), ivory);
          group.add(origMesh);
        }
        const g = geometry(l.waxup, l.th?.pos);
        const n = l.waxup.pos.length / 3;
        plain = new Float32Array(n * 3).fill(0.93);
        if (l.th) {
          heat = new Float32Array(n * 3);
          for (let i = 0; i < n; i++) heat.set(heatColour(l.th.d[i]), i * 3);
        }
        g.setAttribute("color", new THREE.BufferAttribute(heat ?? plain, 3));
        waxMesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0 }));
        group.add(waxMesh);
      }
      // tooth boundaries + estimated numbers along the arch
      if (marks) {
        group.remove(marks);
        marks.traverse((x) => {
          (x as THREE.Mesh).geometry?.dispose();
          const m = (x as THREE.Mesh).material as THREE.SpriteMaterial | undefined;
          m?.map?.dispose();
          m?.dispose();
        });
        marks = null;
      }
      slotOf = null;
      focus = null;
      const th = l?.th;
      if (th && l?.original) {
        marks = new THREE.Group();
        const widths = MEAN_WIDTH[arch];
        const mid = th.mid + opts.shift;
        // highest point of the original along the occlusal axis
        let top = -Infinity;
        const O = l.original.pos, { c, o } = th.frame;
        for (let i = 0; i < O.length; i += 9) top = Math.max(top, (O[i] - c[0]) * o[0] + (O[i + 1] - c[1]) * o[1] + (O[i + 2] - c[2]) * o[2]);
        const lineMat = new THREE.LineBasicMaterial({ color: 0xc9ab86, depthTest: false, transparent: true, opacity: 0.9 });
        const pts: THREE.Vector3[] = [];
        for (const dir of [-1, 1]) {
          let s = 0;
          for (let k = 0; k < 3; k++) {
            // label the front six (the usual wax-up span); boundaries at each tooth
            const centre = archPoint(th, mid + dir * (s + widths[k] / 2), top + 1.6);
            const left = arch === "lower" ? dir < 0 : dir > 0;
            const q = (left !== opts.flip ? (arch === "upper" ? 2 : 3) : arch === "upper" ? 1 : 4) * 10 + k + 1;
            const sp = label(String(q));
            sp.position.copy(centre.p).addScaledVector(centre.out, 5);
            marks.add(sp);
            s += widths[k];
            const b = archPoint(th, mid + dir * s, top + 0.4);
            pts.push(b.p.clone().addScaledVector(b.out, -4), b.p.clone().addScaledVector(b.out, 4));
          }
        }
        focus = archPoint(th, mid, top - 4).p;
        const m0 = archPoint(th, mid, top + 0.4);
        pts.push(m0.p.clone().addScaledVector(m0.out, -4), m0.p.clone().addScaledVector(m0.out, 4));
        const lg = new THREE.BufferGeometry().setFromPoints(pts);
        const lines = new THREE.LineSegments(lg, lineMat);
        lines.renderOrder = 9;
        marks.add(lines);
        marks.visible = marked(modeNow) && viewNow !== "side";
        group.add(marks);
        const bounds = [0];
        for (const x of widths) bounds.push(bounds[bounds.length - 1] + x);
        slotOf = (p) => {
          const { c: cc, w } = th.frame;
          const lw = (p.x - cc[0]) * w[0] + (p.y - cc[1]) * w[1] + (p.z - cc[2]) * w[2];
          const s = archLength(th.arch, lw) - mid;
          const k = bounds.findIndex((b, i) => i > 0 && Math.abs(s) < b) - 1;
          if (k < 0) return undefined;
          const left = arch === "lower" ? s < 0 : s >= 0;
          return (left !== opts.flip ? (arch === "upper" ? 2 : 3) : arch === "upper" ? 1 : 4) * 10 + k + 1;
        };
      }
      draw();
    },
    setMode(mode: Mode, measured: boolean) {
      if (!waxMesh) return;
      const showOrig = mode === "before" && !!origMesh;
      if (origMesh) origMesh.visible = showOrig;
      waxMesh.visible = !showOrig;
      const col = waxMesh.geometry.getAttribute("color") as THREE.BufferAttribute;
      const want = mode === "changes" && measured && heat ? heat : mode === "reduction" && measured && redCol ? redCol : plain!;
      if (col.array !== want) {
        waxMesh.geometry.setAttribute("color", new THREE.BufferAttribute(want, 3));
      }
      modeNow = mode;
      if (marks) marks.visible = marked(mode) && viewNow !== "side";
      draw();
    },
    /** per-vertex estimated reduction (mm, NaN = not estimated); null = no material chosen yet */
    setReduction(prep: Float32Array | null) {
      if (!prep || !waxMesh) {
        redCol = null;
        return;
      }
      const n = prep.length;
      redCol = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) redCol.set(prepColour(prep[i]), i * 3);
    },
    setView(view: View, arch: WaxArch) {
      viewNow = view;
      if (marks) marks.visible = marked(modeNow) && view !== "side";
      const mesh = waxMesh ?? origMesh;
      if (!mesh) return draw();
      const box = new THREE.Box3().setFromObject(mesh);
      const size = box.getSize(new THREE.Vector3()).length();
      const th = state?.th;
      let c = box.getCenter(new THREE.Vector3());
      let w = new THREE.Vector3(1, 0, 0), f = new THREE.Vector3(0, -1, 0), o = new THREE.Vector3(0, 0, 1);
      if (th) {
        w = new THREE.Vector3(...th.frame.w);
        f = new THREE.Vector3(...th.frame.f);
        o = new THREE.Vector3(...th.frame.o);
        // front and side views aim at the front teeth; occlusal shows the whole arch
        if (focus && view !== "occlusal") c = focus.clone();
        else c = new THREE.Vector3(...th.frame.c);
      }
      // upper jaw: occlusal points down, so "up" on screen is the other way
      const up = arch === "upper" ? o.clone().negate() : o.clone();
      // distance that fits the wanted span across the narrower side of the screen
      const span = view === "front" ? 44 : view === "side" ? 34 : Math.min(size * 0.8, 70);
      const vt = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      const dist = (span / 2 / (vt * Math.min(1, camera.aspect))) * 1.05;
      let dir: THREE.Vector3;
      if (view === "front") dir = f.clone().addScaledVector(up, 0.12);
      else if (view === "occlusal") dir = o.clone();
      else dir = w.clone().negate().addScaledVector(f, 0.35);
      camera.position.copy(c).addScaledVector(dir.normalize(), dist);
      camera.up.copy(view === "occlusal" ? f : up);
      controls.target.copy(c);
      camera.lookAt(c);
      controls.update();
      draw();
    },
    /** The current view with the per-tooth list and the disclaimer, for sharing with the lab or the patient file. */
    snapshot(teeth: ToothChange[], arch: WaxArch, red?: ToothReduction[]) {
      renderer.render(scene, camera);
      const src = renderer.domElement;
      const W = 1200;
      const imgH = Math.round((src.height / src.width) * W);
      const listH = red ? Math.max(44, red.reduce((h, t) => h + 78 + (t.enamelNote ? 26 : 0), 0)) : Math.max(1, teeth.length) * 44;
      const cv = document.createElement("canvas");
      cv.width = W;
      cv.height = imgH + 120 + listH + (red ? 170 : 120);
      const g = cv.getContext("2d")!;
      g.fillStyle = "#ffffff";
      g.fillRect(0, 0, cv.width, cv.height);
      g.fillStyle = "#1c2220";
      g.fillRect(0, 0, W, imgH);
      g.drawImage(src, 0, 0, W, imgH);
      let y = imgH + 50;
      g.fillStyle = "#1c2220";
      g.font = "600 30px -apple-system, Segoe UI, Roboto, sans-serif";
      g.fillText(red ? `Reduction estimate · ${arch} jaw · mm` : `Wax-up changes · ${arch} jaw · mm`, 40, y);
      g.font = "26px -apple-system, Segoe UI, Roboto, sans-serif";
      // key
      const key = red
        ? [
            ["#f2ad33", "≈0.5"],
            ["#c7292e", "≥1 to reduce"],
          ]
        : [
            ["#1a9954", "added"],
            ["#d64040", "to reduce"],
          ];
      let kx = W - 360;
      for (const [col, t] of key) {
        g.fillStyle = col;
        g.fillRect(kx, y - 20, 22, 22);
        g.fillStyle = "#333c39";
        g.fillText(t, kx + 30, y);
        kx += 170;
      }
      y += 54;
      g.fillStyle = "#333c39";
      if (red) {
        if (!red.length) g.fillText("No material chosen yet.", 40, y);
        for (const t of red) {
          g.font = "600 26px -apple-system, Segoe UI, Roboto, sans-serif";
          g.fillText(`≈ ${t.fdi}`, 40, y);
          g.font = "26px -apple-system, Segoe UI, Roboto, sans-serif";
          g.fillText(t.material, 150, y);
          y += 34;
          g.fillText(reductionLine(t), 150, y);
          y += t.enamelNote ? 30 : 44;
          if (t.enamelNote) {
            g.font = "20px -apple-system, Segoe UI, Roboto, sans-serif";
            g.fillStyle = "#816951";
            g.fillText(t.enamelNote, 150, y);
            g.fillStyle = "#333c39";
            y += 40;
          }
        }
      } else {
        if (!teeth.length) g.fillText(`No tooth changed by more than ${SAME_MM} mm.`, 40, y);
        for (const t of teeth) {
          g.font = "600 26px -apple-system, Segoe UI, Roboto, sans-serif";
          g.fillText(`≈ ${t.fdi}`, 40, y);
          g.font = "26px -apple-system, Segoe UI, Roboto, sans-serif";
          g.fillText(toothLine(t), 150, y);
          y += 44;
        }
      }
      g.font = "20px -apple-system, Segoe UI, Roboto, sans-serif";
      g.fillStyle = "#5b6461";
      wrap(g, `${red ? REDUCTION_DISCLAIMER : WAXUP_DISCLAIMER} Areas over ${FAR_MM} mm apart or on the trimmed rim are not compared (grey).`, 40, y + 20, W - 80, 26);
      return cv;
    },
    dispose() {
      cancelAnimationFrame(frame);
      ro.disconnect();
      controls.dispose();
      clear();
      ivory.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
  return api;
}

function wrap(g: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number) {
  let line = "";
  for (const word of text.split(" ")) {
    const t = line ? `${line} ${word}` : word;
    if (g.measureText(t).width > maxW && line) {
      g.fillText(line, x, y);
      y += lh;
      line = word;
    } else line = t;
  }
  if (line) g.fillText(line, x, y);
}
