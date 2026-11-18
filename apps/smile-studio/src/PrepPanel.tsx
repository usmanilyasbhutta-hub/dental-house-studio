// Prep map side panel: mandatory disclaimer, legend and the per-tooth outline comparison (clinician wording).
import { useEffect, useRef } from "react";
import { hiddenLegend, PREP_DISCLAIMER, prepWording, type PrepResult } from "./engineShim";
import { TOOTH_NAMES } from "./geometry";
import { CLINICIAN } from "./sheetCopy";

/** The mandatory disclaimer; scrolls itself into view when the map is switched on (small phone panels). */
export function PrepDisclaimer() {
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    ref.current?.scrollIntoView?.({ block: "nearest" });
  }, []);
  return (
    <p className="disclaimer" role="note" ref={ref}>
      {PREP_DISCLAIMER}
    </p>
  );
}

/** Legend; `prep` adds the hatched "hidden behind the opposing teeth" swatch when the map has such an area. */
export function PrepLegend({ prep }: { prep?: PrepResult | null }) {
  const lower = prep?.teeth[0]?.label[0] === "L";
  return (
    <div className="legend" aria-label="Prep map legend">
      <span>
        <i className="sw add" aria-hidden="true" /> Green · {CLINICIAN.legendAdd.replace(/^Added: /, "added: ")}
      </span>
      <span>
        <i className="sw reduce" aria-hidden="true" /> Red · {CLINICIAN.legendReduce.replace(/^Reduced: /, "reduced: ")}
      </span>
      {prep?.hidden && (
        <span className="legend-hidden">
          <i className="sw hidden" aria-hidden="true" /> Grey hatch · {hiddenLegend(lower)}
        </span>
      )}
    </div>
  );
}

export function PrepPanel({
  prep,
  pxPerMm,
  onCalibrate,
  onMarkTeeth,
  manualMask,
}: {
  prep: PrepResult | null;
  pxPerMm?: number;
  onCalibrate: () => void;
  onMarkTeeth: () => void;
  /** true when the clinician has checked / painted the existing-teeth mask */
  manualMask: boolean;
}) {
  return (
    <div className="prep">
      <PrepDisclaimer />
      <PrepLegend prep={prep} />
      {!pxPerMm && (
        <p className="note">
          Not calibrated: changes show as add / reduce only, no mm.{" "}
          <button className="link" onClick={onCalibrate}>
            Calibrate for mm
          </button>
        </p>
      )}
      {!manualMask && (
        <p className="hint">
          The existing teeth were found automatically.{" "}
          <button className="link" onClick={onMarkTeeth}>
            Check the existing-teeth outline
          </button>
        </p>
      )}
      {prep ? (
        <ul className="prep-list" aria-label="Per tooth">
          {prep.teeth.map((t) => {
            const w = prepWording(t, pxPerMm);
            const warn = (l: string) => /^(Large incisal|Proximal reduction)/.test(l);
            const muted = (l: string) => /^Partly hidden behind/.test(l);
            return (
              <li key={t.label}>
                <span className="mono tooth">
                  {t.label}
                  <small>{TOOTH_NAMES[t.kind]}</small>
                </span>
                <span className="lines">
                  {w.clinician.map((l, i) => (
                    <span key={i} className={warn(l) ? "warn" : muted(l) ? "muted" : undefined}>
                      {l}
                    </span>
                  ))}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="hint">Working out the outline comparison…</p>
      )}
    </div>
  );
}
