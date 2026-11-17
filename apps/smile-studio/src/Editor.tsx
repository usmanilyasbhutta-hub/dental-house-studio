import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { centralLength, centralWidth, deg, fitArcToLowerLip, measure, pupilAngle, PROPORTIONS, rad, SHAPE_LABELS, TOOTH_NAMES } from "./geometry";
import { useHistory } from "./history";
import { defaultLips, type CaseData, type Design, type Proportion, type ToothCount, type ToothShape } from "./model";
import { exportCanvas, type Scene, type Step } from "./render";
import { SHADES } from "./shades";
import { Stage, type Calib } from "./Stage";
import { saveCase, thumbnail } from "./storage";
import { Chips, Hint, Sheet, Slider, Toggle, useToast } from "./ui";

const STEPS: { id: Step; label: string; n: string; goal: string }[] = [
  { id: "guides", label: "Face", n: "01", goal: "Set the face level: both pupils and the facial midline." },
  { id: "lips", label: "Lips", n: "02", goal: "Trace the inside of the lips so the new teeth sit behind them." },
  { id: "design", label: "Teeth", n: "03", goal: "Choose a shape and size that suits this face." },
  { id: "shade", label: "Shade", n: "04", goal: "Pick a shade to discuss. The screen colour is a preview only." },
  { id: "compare", label: "Compare", n: "05", goal: "Show the patient now and the simulation, then share if they agree." },
];

const COACH_KEY = "smile-studio.coach.v1";

type Snap = Pick<CaseData, "guides" | "lips" | "design" | "calib" | "centralMm">;

/** Central width/length descriptor for the slider. */
export function wlLabel(v: number) {
  const pct = `${Math.round(v * 100)}%`;
  if (v < 0.72) return `${pct} · long / narrow`;
  if (v >= 0.75 && v <= 0.8) return `${pct} · ideal range`;
  if (v > 0.85) return `${pct} · short / square (worn look)`;
  return pct;
}

type Level = "ok" | "amber" | "red";

export function Editor({ initial, onClose }: { initial: CaseData; onClose: () => void }) {
  const [c, setC] = useState(initial);
  const [img, setImg] = useState<ImageBitmap | null>(null);
  const [imgError, setImgError] = useState(false);
  const [step, setStep] = useState<Step>("guides");
  const [reached, setReached] = useState(initial.updatedAt - initial.createdAt > 2000 ? 4 : 0);
  const [mode, setMode] = useState<"mockup" | "outline">("mockup");
  const [showOriginal, setShowOriginal] = useState(false);
  const [calibrating, setCalibrating] = useState(false);
  const [compareView, setCompareView] = useState<"mouth" | "face">("mouth");
  const [present, setPresent] = useState(false);
  const [save, setSave] = useState<"saved" | "saving" | "error">("saved");
  const [coach, setCoach] = useState(() => !localStorage.getItem(COACH_KEY));
  const [shareAsk, setShareAsk] = useState<null | "after" | "side-by-side">(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const showToast = toast.show;
  const saveTimer = useRef(0);
  const latest = useRef(c);
  latest.current = c;
  const dirty = useRef(false);
  const flushNext = useRef(false);
  const panelRef = useRef<HTMLElement>(null);
  // each step / mode starts at the top of its panel (goal line first)
  useEffect(() => {
    panelRef.current?.scrollTo?.({ top: 0 });
  }, [step, calibrating]);

  useEffect(() => {
    let alive = true;
    createImageBitmap(c.photo)
      .then((b) => {
        if (!alive) return;
        setImg(b);
        // thumbnail as soon as the photo is decoded, so Home has it even if the app is closed mid-design
        if (!latest.current.thumb) setC((x) => ({ ...x, thumb: thumbnail(b, x.imgW, x.imgH) }));
      })
      .catch(() => alive && setImgError(true));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c.id]);

  // autosave (debounced), on this device only
  const saveNow = useCallback(() => {
    window.clearTimeout(saveTimer.current);
    if (!dirty.current) return Promise.resolve();
    dirty.current = false;
    setSave("saving");
    return saveCase({ ...latest.current, updatedAt: Date.now() })
      .then(() => setSave("saved"))
      .catch(() => {
        dirty.current = true;
        setSave("error");
        showToast("Could not save on this phone. Storage may be full.", "error", 6000);
      });
  }, [showToast]);

  useEffect(() => {
    if (c === initial) return;
    dirty.current = true;
    setSave("saving");
    window.clearTimeout(saveTimer.current);
    // a finished drag saves straight away (the phone may be locked right after); control changes are debounced
    saveTimer.current = window.setTimeout(saveNow, flushNext.current ? 0 : 500);
    flushNext.current = false;
  }, [c, initial, saveNow]);

  // the page can be hidden or closed inside the debounce: save straight away
  useEffect(() => {
    const flush = () => void saveNow();
    const vis = () => document.visibilityState === "hidden" && flush();
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", vis);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", vis);
    };
  }, [saveNow]);

  const snap: Snap = useMemo(
    () => ({ guides: c.guides, lips: c.lips, design: c.design, calib: c.calib, centralMm: c.centralMm }),
    [c.guides, c.lips, c.design, c.calib, c.centralMm],
  );
  const history = useHistory<Snap>(snap, (s) => setC((x) => ({ ...x, ...s })));

  // keyboard shortcuts: Ctrl/Cmd+Z undo, Shift+Ctrl/Cmd+Z or Ctrl+Y redo
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || (e.target as HTMLElement).tagName === "INPUT") return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) history.undo();
      else if ((k === "z" && e.shiftKey) || k === "y") history.redo();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [history]);

  const scene: Scene | null = useMemo(
    () => (img ? { img, imgW: c.imgW, imgH: c.imgH, guides: c.guides, lips: c.lips, design: c.design } : null),
    [img, c.imgW, c.imgH, c.guides, c.lips, c.design],
  );
  const setDesign = (d: Partial<Design>) => setC((x) => ({ ...x, design: { ...x.design, ...d } }));
  const m = measure(c.design, c.guides, c.centralMm, c.calib);
  const ppm = m.pxPerMm;
  const fmt = (px: number) => (ppm ? `${(px / ppm).toFixed(1)} mm` : `${Math.round(px)} px`);
  const pupilTilt = deg(pupilAngle(c.guides));

  const goTo = (s: Step) => {
    const i = STEPS.findIndex((x) => x.id === s);
    setReached((r) => Math.max(r, i));
    if (s !== "design") setCalibrating(false);
    setStep(s);
  };
  const idx = STEPS.findIndex((s) => s.id === step);

  const doExport = async (layout: "after" | "side-by-side") => {
    if (!scene) return;
    setBusy(true);
    toast.show("Preparing image…", "info", 0);
    try {
      await document.fonts.load('700 20px "Oswald"');
      await document.fonts.load('500 20px "JetBrains Mono"');
      const cv = exportCanvas(scene, layout);
      const blob = await new Promise<Blob>((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error("encode"))), "image/png"));
      const date = new Date().toISOString().slice(0, 10);
      const file = new File([blob], `smile-simulation-${layout}-${date}.png`, { type: "image/png" });
      let shared = false;
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: "Smile simulation" });
          shared = true;
        } catch (e) {
          if ((e as Error).name === "AbortError") {
            toast.hide();
            return;
          }
        }
      }
      if (!shared) {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = file.name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      }
      toast.show(shared ? "Shared" : "Image saved to downloads");
    } catch {
      toast.show("Could not make the image. Try again, or close other apps to free memory.", "error", 6000);
    } finally {
      setBusy(false);
    }
  };
  const askExport = (layout: "after" | "side-by-side") => (c.consentShareAt ? doExport(layout) : setShareAsk(layout));

  const close = async () => {
    window.clearTimeout(saveTimer.current);
    try {
      await saveCase({ ...latest.current, updatedAt: dirty.current || c !== initial ? Date.now() : latest.current.updatedAt });
    } catch {
      /* the toast already said it; do not trap the user in the editor */
    }
    onClose();
  };

  const centerOnMidline = () => {
    // slide the design along the pupil line so its center sits on the facial midline
    const pa = pupilAngle(c.guides);
    setDesign({ center: { x: c.design.center.x - m.midlineDev * Math.cos(pa), y: c.design.center.y - m.midlineDev * Math.sin(pa) } });
  };

  const startCalibrate = () => {
    setStep("design");
    setReached((r) => Math.max(r, 2));
    if (!c.calib) {
      const d = c.design;
      const cw = centralWidth(d);
      const y = d.center.y - centralLength(d) * 0.5;
      setC((x) => ({ ...x, calib: { a: { x: d.center.x - cw, y }, b: { x: d.center.x, y } } }));
    }
    setCalibrating(true);
  };

  // readout levels (Kokich 1999/2006 perception thresholds), only meaningful once calibrated
  const devMm = ppm ? Math.abs(m.midlineDev) / ppm : undefined;
  const midOn = devMm !== undefined ? devMm < 0.5 : Math.abs(m.midlineDev) < 2;
  const midLevel: Level = devMm === undefined ? "ok" : devMm >= 4 ? "red" : devMm >= 2 ? "amber" : "ok";
  const cantMm = ppm ? (c.design.width / ppm) * Math.abs(Math.tan(rad(m.cant))) : undefined;
  const cantLevel: Level = cantMm === undefined ? "ok" : cantMm >= 3 ? "red" : cantMm >= 1 ? "amber" : "ok";

  if (imgError) {
    return (
      <div className="editor">
        <div className="empty-error">
          <p className="mono kicker">Photo</p>
          <p>This photo could not be opened on this phone. Delete the design and take the photo again.</p>
          <button className="btn" onClick={onClose}>Back to designs</button>
        </div>
      </div>
    );
  }

  const readout = (step === "design" || step === "shade") && !calibrating && (
    <div className="readout mono" aria-live="polite">
      <span>W/L {m.wlPct}%</span>
      <span>
        Central {fmt(m.centralW)} × {fmt(m.centralL)}
      </span>
      <span className={cantLevel}>
        Cant {m.cant.toFixed(1)}°{cantMm !== undefined && ` · ${cantMm.toFixed(1)} mm`}
      </span>
      <span className={midLevel}>Midline {midOn ? "on" : fmt(Math.abs(m.midlineDev))}</span>
      {!ppm && (
        <button className="link mono" onClick={startCalibrate}>
          Calibrate for mm
        </button>
      )}
      {Math.abs(pupilTilt) > 3 && <span className="amber">Check head tilt; pupils may be uneven.</span>}
    </div>
  );

  return (
    <div className={present ? "editor present" : "editor"}>
      <header className="topbar">
        <button className="ghost" onClick={close} aria-label="Back to cases">
          ‹ Cases
        </button>
        <div className="hist">
          <button className="icon" onClick={history.undo} disabled={!history.canUndo} aria-label="Undo">
            ↶
          </button>
          <button className="icon" onClick={history.redo} disabled={!history.canRedo} aria-label="Redo">
            ↷
          </button>
        </div>
        <div className="title">
          <span className="mono">
            {STEPS[idx].n} / 05 ·{" "}
            <span className={save === "error" ? "save err" : "save"}>
              {save === "saved" ? "Saved ✓" : save === "saving" ? "Saving…" : "Not saved"}
            </span>
          </span>
          <h1 className="h">{STEPS[idx].label}</h1>
        </div>
        <button className={showOriginal ? "ghost pressed" : "ghost"} aria-pressed={showOriginal} onClick={() => setShowOriginal((v) => !v)}>
          Before
        </button>
      </header>

      {scene ? (
        <Stage
          scene={scene}
          step={step}
          mode={mode}
          showOriginal={showOriginal}
          calibrating={calibrating}
          calib={c.calib}
          compareView={compareView}
          onGuides={(guides) => setC((x) => ({ ...x, guides }))}
          onLips={(lips) => setC((x) => ({ ...x, lips }))}
          onDesign={(design) => setC((x) => ({ ...x, design }))}
          onCalib={(calib: Calib) => setC((x) => ({ ...x, calib }))}
          onGesture={(active) => {
            history.gesture(active);
            if (!active) flushNext.current = true;
          }}
        />
      ) : (
        <div className="stage loading" role="status">
          <span className="spinner" aria-hidden="true" /> Opening photo…
        </div>
      )}

      {present && (
        <button className="btn exit-present" onClick={() => setPresent(false)}>
          Exit
        </button>
      )}

      <div className="side">
        {readout}
        <section className="panel" ref={panelRef} aria-label={`${STEPS[idx].label} controls`}>
          <p className="goal">{calibrating ? "Calibrate: measure one existing central so the read-out shows mm." : STEPS[idx].goal}</p>

          {step === "guides" && (
            <>
              <Hint>
                Drag the two <b>bronze dots</b> onto the pupils and the <b>grey dot</b> onto the middle of the face (philtrum /
                nose tip). Pinch to zoom.
              </Hint>
              <p className={Math.abs(pupilTilt) > 3 ? "mono small amber" : "mono small"}>
                Pupil line {pupilTilt.toFixed(1)}° from level
                {Math.abs(pupilTilt) > 3 && " · Check head tilt; pupils may be uneven."}
              </p>
            </>
          )}

          {step === "lips" && (
            <>
              <Hint>
                Drag the dots onto the <b>inside edge of the lips</b>. The teeth outline shows where the design sits.
              </Hint>
              <button className="btn secondary" onClick={() => setC((x) => ({ ...x, lips: defaultLips(x.design.center, x.design.width) }))}>
                Reset lip line around the teeth
              </button>
            </>
          )}

          {step === "design" && calibrating && (
            <>
              <Hint>
                Drag the two pins onto the <b>left and right edges of one existing upper central</b> (the patient's own tooth).
                A tap moves the nearest pin there.
              </Hint>
              <label className="field">
                <span className="field-label">Existing central width, measured in the mouth (mm)</span>
                <MmInput value={c.centralMm} onChange={(centralMm) => setC((x) => ({ ...x, centralMm }))} />
              </label>
              <p className="mono small">{ppm ? `Calibrated · ${ppm.toFixed(1)} px per mm` : "Enter the width to switch the read-out to mm."}</p>
              <div className="row">
                <button className="btn" onClick={() => setCalibrating(false)}>
                  Done
                </button>
                <button
                  className="btn secondary"
                  onClick={() => {
                    setC((x) => ({ ...x, calib: undefined, centralMm: undefined }));
                    setCalibrating(false);
                  }}
                >
                  Clear
                </button>
              </div>
            </>
          )}

          {step === "design" && !calibrating && (
            <>
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
              <div className="actions">
                <button className="btn secondary" onClick={centerOnMidline}>
                  Center on midline
                </button>
                <button className="btn secondary" onClick={() => setDesign({ tilt: 0 })}>
                  Level to pupils
                </button>
                <button
                  className="btn secondary"
                  onClick={() => {
                    setDesign({ arc: fitArcToLowerLip(c.lips, c.design, c.guides) });
                    toast.show("Smile arc now follows the lower lip");
                  }}
                >
                  Follow lower lip
                </button>
              </div>
              <details className="fine">
                <summary>Fine-tune</summary>
                <Toggle label="Outline view" note="Edges only, like a wax-up template" checked={mode === "outline"} onChange={(v) => setMode(v ? "outline" : "mockup")} />
                <Slider label="Central width / length" value={c.design.wl} min={0.65} max={0.95} step={0.01} format={wlLabel} onChange={(wl) => setDesign({ wl })} />
                <Slider label="Smile arc" value={c.design.arc} min={0} max={1} step={0.01} format={(v) => (v < 0.15 ? "flat" : v < 0.55 ? "gentle" : "curved")} onChange={(arc) => setDesign({ arc })} />
                <Slider label="Lateral step" value={c.design.lateralStep} min={0} max={0.25} step={0.01} format={(v) => `${Math.round(v * 100)}%`} onChange={(lateralStep) => setDesign({ lateralStep })} />
                <Slider label="Tilt vs pupil line" value={c.design.tilt} min={-6} max={6} step={0.1} format={(v) => `${v.toFixed(1)}°`} onChange={(tilt) => setDesign({ tilt: Math.round(tilt * 10) / 10 })} />
                <table className="widths mono">
                  <caption className="sr-only">Tooth widths</caption>
                  <tbody>
                    {m.widths.map((w, i) => (
                      <tr key={i}>
                        <td>{TOOTH_NAMES[i]}</td>
                        <td>{fmt(w)}</td>
                        <td>{Math.round((w / m.centralW) * 100)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button className="link mono" onClick={startCalibrate}>
                  {ppm ? "Recalibrate" : "Calibrate for mm"}
                </button>
              </details>
              <Hint>Drag ✛ (below the teeth) to move, the side dots for width and the top dot for length.</Hint>
            </>
          )}

          {step === "shade" && (
            <>
              <div className="field">
                <span className="field-label">Shade (screen preview only)</span>
                <div className="swatches" role="radiogroup" aria-label="Shade">
                  {SHADES.map((s) => (
                    <button
                      key={s.id}
                      role="radio"
                      aria-checked={c.design.shade === s.id}
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
              {c.design.shade.startsWith("BL") && <p className="note">Bleach shades need whitening or new restorations; discuss before showing.</p>}
              <Slider label="Blend with photo" value={c.design.opacity} min={0.4} max={1} step={0.01} format={(v) => `${Math.round(v * 100)}%`} onChange={(opacity) => setDesign({ opacity })} />
              <Toggle
                label="Mouth backdrop"
                note="Covers the old teeth inside the lip line"
                checked={c.design.backdrop !== false}
                onChange={(backdrop) => setDesign({ backdrop })}
              />
              <Hint>Phone screens differ. The real shade is matched in the chair with a shade guide.</Hint>
            </>
          )}

          {step === "compare" && (
            <>
              <Chips
                label="View"
                value={compareView}
                options={[
                  { value: "mouth", label: "Mouth" },
                  { value: "face", label: "Whole face" },
                ]}
                onChange={setCompareView}
              />
              <Hint>Slide across the photo to compare now and the simulation.</Hint>
              <button
                className="btn secondary wide"
                onClick={() => {
                  setPresent(true);
                  document.documentElement.requestFullscreen?.().catch(() => {});
                }}
              >
                Present full screen
              </button>
              <div className="row">
                <button className="btn" onClick={() => askExport("side-by-side")} disabled={busy}>
                  Share side by side
                </button>
                <button className="btn secondary" onClick={() => askExport("after")} disabled={busy}>
                  Share simulation
                </button>
              </div>
              <Hint>Every exported image carries a permanent “Smile simulation · for discussion only” label. It is not a promised result.</Hint>
            </>
          )}
        </section>

        <div className="stepper">
          <button className="btn secondary" onClick={() => goTo(STEPS[idx - 1].id)} disabled={idx === 0}>
            ‹ Back
          </button>
          {idx < STEPS.length - 1 ? (
            <button className="btn" onClick={() => goTo(STEPS[idx + 1].id)}>
              Next: {STEPS[idx + 1].label} ›
            </button>
          ) : (
            <button className="btn" onClick={close}>
              Finish
            </button>
          )}
        </div>

        <nav className="steps" aria-label="Design steps">
          {STEPS.map((s, i) => {
            const done = i <= reached && i !== idx && (i < reached || reached === 4);
            return (
              <button key={s.id} className={s.id === step ? "step on" : "step"} onClick={() => goTo(s.id)} aria-current={s.id === step ? "step" : undefined}>
                <span className="mono">{done ? "✓" : s.n}</span>
                {s.label}
                {done && <span className="sr-only"> (done)</span>}
              </button>
            );
          })}
        </nav>
      </div>

      {coach && (
        <Sheet
          title={
            <>
              Five steps to a <em>smile</em> mockup
            </>
          }
          onClose={() => {
            localStorage.setItem(COACH_KEY, "1");
            setCoach(false);
          }}
        >
          <ol className="coach">
            <li><b>Face</b> · dots on the pupils and the midline</li>
            <li><b>Lips</b> · dots on the inside edge of the lips</li>
            <li><b>Teeth</b> · shape, proportion and size</li>
            <li><b>Shade</b> · a colour to discuss</li>
            <li><b>Compare</b> · now and simulation, then share</li>
          </ol>
          <p className="hint">One finger drags a dot or moves the photo. Two fingers zoom. ↶ undoes any change.</p>
          <button
            className="btn wide"
            onClick={() => {
              localStorage.setItem(COACH_KEY, "1");
              setCoach(false);
            }}
          >
            Got it
          </button>
        </Sheet>
      )}

      {shareAsk && (
        <Sheet title="Share this image?" onClose={() => setShareAsk(null)}>
          <p>Patient agreed to share this image? It will leave the app (WhatsApp, gallery, cloud backup).</p>
          <div className="row">
            <button
              className="btn"
              onClick={() => {
                const layout = shareAsk;
                setShareAsk(null);
                setC((x) => ({ ...x, consentShareAt: Date.now() }));
                void doExport(layout);
              }}
            >
              Yes, patient agreed
            </button>
            <button className="btn secondary" onClick={() => setShareAsk(null)}>
              Not now
            </button>
          </div>
        </Sheet>
      )}
      {toast.node}
    </div>
  );
}

/** mm input that keeps what is typed ("8.") and only reports valid widths (4–13 mm). */
function MmInput({ value, onChange }: { value?: number; onChange: (v: number | undefined) => void }) {
  const [text, setText] = useState(value ? String(value) : "");
  const n = Number(text.replace(",", "."));
  const bad = text !== "" && !(n >= 4 && n <= 13);
  return (
    <>
      <input
        className="input"
        type="text"
        inputMode="decimal"
        placeholder="e.g. 8.5"
        value={text}
        aria-invalid={bad}
        onChange={(e) => {
          const t = e.target.value;
          setText(t);
          const v = Number(t.replace(",", "."));
          onChange(t && v >= 4 && v <= 13 ? v : undefined);
        }}
      />
      {bad && <span className="error small">Enter a width between 4 and 13 mm.</span>}
    </>
  );
}
