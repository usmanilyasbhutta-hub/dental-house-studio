import { useEffect, useMemo, useRef, useState } from "react";
import { measure, pupilAngle, PROPORTIONS, SHAPE_LABELS, TOOTH_NAMES, deg } from "./geometry";
import { defaultLips, type CaseData, type Design, type Proportion, type ToothCount, type ToothShape } from "./model";
import { exportCanvas, type Scene, type Step } from "./render";
import { SHADES } from "./shades";
import { Stage } from "./Stage";
import { saveCase, thumbnail } from "./storage";
import { Chips, Hint, Slider } from "./ui";

const STEPS: { id: Step; label: string; n: string }[] = [
  { id: "guides", label: "Face", n: "01" },
  { id: "lips", label: "Lips", n: "02" },
  { id: "design", label: "Teeth", n: "03" },
  { id: "shade", label: "Shade", n: "04" },
  { id: "compare", label: "Compare", n: "05" },
];

export function Editor({ initial, onClose }: { initial: CaseData; onClose: () => void }) {
  const [c, setC] = useState(initial);
  const [img, setImg] = useState<ImageBitmap | null>(null);
  const [step, setStep] = useState<Step>("guides");
  const [mode, setMode] = useState<"mockup" | "outline">("mockup");
  const [showOriginal, setShowOriginal] = useState(false);
  const [busy, setBusy] = useState("");
  const saveTimer = useRef<number>(0);

  useEffect(() => {
    let alive = true;
    createImageBitmap(c.photo).then((b) => alive && setImg(b));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c.id]);

  // autosave (debounced), on this device only
  useEffect(() => {
    if (c === initial) return;
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => saveCase({ ...c, updatedAt: Date.now() }), 500);
  }, [c, initial]);

  const scene: Scene | null = useMemo(
    () => (img ? { img, imgW: c.imgW, imgH: c.imgH, guides: c.guides, lips: c.lips, design: c.design } : null),
    [img, c],
  );
  const setDesign = (d: Partial<Design>) => setC((x) => ({ ...x, design: { ...x.design, ...d } }));
  const m = measure(c.design, c.guides, c.centralMm, c.calib);
  const mm = (px: number) => (m.pxPerMm ? `${(px / m.pxPerMm).toFixed(1)} mm` : `${Math.round(px)} px`);

  const doExport = async (layout: "after" | "side-by-side") => {
    if (!scene) return;
    setBusy("Preparing image…");
    try {
      await document.fonts.load('700 20px "Oswald"');
      await document.fonts.load('500 20px "JetBrains Mono"');
      const cv = exportCanvas(scene, layout);
      const blob = await new Promise<Blob>((r) => cv.toBlob((b) => r(b!), "image/png"));
      const date = new Date().toISOString().slice(0, 10);
      const file = new File([blob], `smile-simulation-${layout}-${date}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Smile simulation" }).catch(() => {});
      } else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = file.name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      }
    } finally {
      setBusy("");
    }
  };

  const close = async () => {
    window.clearTimeout(saveTimer.current);
    if (img) await saveCase({ ...c, updatedAt: Date.now(), thumb: thumbnail(img, c.imgW, c.imgH) });
    onClose();
  };

  const centerOnMidline = () => {
    // slide the design along the pupil line so its center sits on the facial midline
    const pa = pupilAngle(c.guides);
    setDesign({
      center: { x: c.design.center.x - m.midlineDev * Math.cos(pa), y: c.design.center.y - m.midlineDev * Math.sin(pa) },
    });
  };

  const idx = STEPS.findIndex((s) => s.id === step);

  return (
    <div className="editor">
      <header className="topbar">
        <button className="ghost" onClick={close} aria-label="Back to cases">
          ‹ Cases
        </button>
        <div className="title">
          <span className="mono">{STEPS[idx].n} / 05</span>
          <span className="h">{STEPS[idx].label}</span>
        </div>
        <button
          className="ghost"
          onPointerDown={() => setShowOriginal(true)}
          onPointerUp={() => setShowOriginal(false)}
          onPointerLeave={() => setShowOriginal(false)}
          aria-label="Hold to see the original photo"
        >
          Hold: before
        </button>
      </header>

      {scene ? (
        <Stage
          scene={scene}
          step={step}
          mode={mode}
          showOriginal={showOriginal}
          onGuides={(guides) => setC((x) => ({ ...x, guides }))}
          onLips={(lips) => setC((x) => ({ ...x, lips }))}
          onDesign={(design) => setC((x) => ({ ...x, design }))}
        />
      ) : (
        <div className="stage loading">Loading photo…</div>
      )}

      {(step === "design" || step === "shade") && (
        <div className="readout mono" aria-live="polite">
          <span>W/L {m.wlPct}%</span>
          <span>Central {mm(m.centralW)} × {mm(m.centralL)}</span>
          <span>Cant {m.cant.toFixed(1)}°</span>
          <span>Midline {Math.abs(m.midlineDev) < 0.5 ? "on" : mm(Math.abs(m.midlineDev))}</span>
        </div>
      )}

      <section className="panel">
        {step === "guides" && (
          <>
            <Hint>
              Drag the two <b>bronze dots</b> onto the pupils and the <b>grey dot</b> onto the middle of the face
              (philtrum / nose tip). The teeth follow this level.
            </Hint>
            <p className="mono small">Pupil line {deg(pupilAngle(c.guides)).toFixed(1)}° from level</p>
          </>
        )}
        {step === "lips" && (
          <>
            <Hint>
              Drag the dots onto the <b>inside edge of the lips</b>. The new teeth only show inside this line, so the
              lips stay in front.
            </Hint>
            <button className="btn secondary" onClick={() => setC((x) => ({ ...x, lips: defaultLips(x.design.center, x.design.width) }))}>
              Reset lip line around the teeth
            </button>
          </>
        )}
        {step === "design" && (
          <>
            <Chips
              label="View"
              value={mode}
              options={[
                { value: "mockup", label: "Mockup" },
                { value: "outline", label: "Outline" },
              ]}
              onChange={setMode}
            />
            <Chips
              label="Shape"
              value={c.design.shape}
              options={(Object.keys(SHAPE_LABELS) as ToothShape[]).map((k) => ({ value: k, label: SHAPE_LABELS[k] }))}
              onChange={(shape) => setDesign({ shape })}
            />
            <Chips
              label="Proportion"
              value={c.design.proportion}
              options={(Object.keys(PROPORTIONS) as Proportion[]).map((k) => ({ value: k, label: PROPORTIONS[k].label }))}
              onChange={(proportion) => setDesign({ proportion })}
            />
            <Hint>{PROPORTIONS[c.design.proportion].note}</Hint>
            <Chips
              label="Teeth"
              value={c.design.count}
              options={([6, 8, 10] as ToothCount[]).map((k) => ({ value: k, label: String(k) }))}
              onChange={(count) => setDesign({ count })}
            />
            <Slider label="Central width / length" value={c.design.wl} min={0.65} max={0.95} step={0.01} format={(v) => `${Math.round(v * 100)}%`} onChange={(wl) => setDesign({ wl })} />
            <Slider label="Smile arc" value={c.design.arc} min={0} max={1} step={0.01} format={(v) => (v < 0.15 ? "flat" : v < 0.55 ? "gentle" : "curved")} onChange={(arc) => setDesign({ arc })} />
            <Slider label="Lateral step" value={c.design.lateralStep} min={0} max={0.25} step={0.01} format={(v) => `${Math.round(v * 100)}%`} onChange={(lateralStep) => setDesign({ lateralStep })} />
            <Slider label="Tilt vs pupil line" value={c.design.tilt} min={-6} max={6} step={0.1} format={(v) => `${v.toFixed(1)}°`} onChange={(tilt) => setDesign({ tilt })} />
            <div className="row">
              <button className="btn secondary" onClick={centerOnMidline}>Center on midline</button>
              <button className="btn secondary" onClick={() => setDesign({ tilt: 0 })}>Level to pupils</button>
            </div>
            <table className="widths mono">
              <tbody>
                {m.widths.map((w, i) => (
                  <tr key={i}>
                    <td>{TOOTH_NAMES[i]}</td>
                    <td>{mm(w)}</td>
                    <td>{Math.round((w / m.centralW) * 100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Hint>Drag ✛ (below the teeth) to move, the side dots for width and the top dot for length. Pinch to zoom.</Hint>
          </>
        )}
        {step === "shade" && (
          <>
            <div className="field">
              <span className="field-label">Shade (screen preview only)</span>
              <div className="swatches">
                {SHADES.map((s) => (
                  <button
                    key={s.id}
                    className={c.design.shade === s.id ? "swatch on" : "swatch"}
                    style={{ background: `linear-gradient(${s.cervical}, ${s.body} 45%, #c9cfd3)` }}
                    onClick={() => setDesign({ shade: s.id })}
                    aria-label={`Shade ${s.label}`}
                  >
                    <span>{s.id}</span>
                  </button>
                ))}
              </div>
            </div>
            <Slider label="Blend with photo" value={c.design.opacity} min={0.4} max={1} step={0.01} format={(v) => `${Math.round(v * 100)}%`} onChange={(opacity) => setDesign({ opacity })} />
            <Hint>Phone screens differ. The real shade is matched in the chair with a shade guide.</Hint>
          </>
        )}
        {step === "compare" && (
          <>
            <Hint>Slide across the photo to compare now and the simulation.</Hint>
            <label className="field">
              <span className="field-label">Calibrate: real central width (mm, optional)</span>
              <input
                className="input"
                type="number"
                inputMode="decimal"
                min={5}
                max={12}
                step={0.1}
                placeholder="e.g. 8.5"
                value={c.centralMm ?? ""}
                onChange={(e) => setC((x) => ({ ...x, centralMm: e.target.value ? Number(e.target.value) : undefined }))}
              />
            </label>
            <div className="row">
              <button className="btn" onClick={() => doExport("side-by-side")} disabled={!!busy}>Share side by side</button>
              <button className="btn secondary" onClick={() => doExport("after")} disabled={!!busy}>Share simulation</button>
            </div>
            <Hint>
              Every exported image carries a permanent “Smile simulation · for discussion only” label. It is not a
              promised result. Get the patient’s consent before sharing their photo.
            </Hint>
          </>
        )}
      </section>

      <nav className="steps" aria-label="Design steps">
        {STEPS.map((s) => (
          <button key={s.id} className={s.id === step ? "step on" : "step"} onClick={() => setStep(s.id)} aria-current={s.id === step}>
            <span className="mono">{s.n}</span>
            {s.label}
          </button>
        ))}
      </nav>
      {busy && <div className="toast">{busy}</div>}
    </div>
  );
}
