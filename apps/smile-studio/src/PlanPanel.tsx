// Step 06 Plan: shade gap, FDI chart with per-tooth plan, case flags + checklist, warnings and lab hand-off.
// The app records the dentist's decisions and checks them for conflicts; it never picks a material, prep or depth.
import { useRef, useState, type ReactNode } from "react";
import { PREP_DISCLAIMER } from "./engineShim";
import type { Arch, CasePlan, Coverage, Margin, PrepLevel, ToothPlan, Visibility } from "./model";
import {
  addClinicMaterial,
  CATEGORY_LABEL,
  CHECKLIST,
  coverageLabel,
  coverageOptions,
  getTooth,
  LOWER_ROW,
  MARGIN_LABEL,
  materialOf,
  MATERIALS,
  nearestTab,
  planShadeGap,
  planSummary,
  planWarnings,
  position,
  PREP_LABEL,
  removeClinicMaterial,
  setTooth,
  toothName,
  toothType,
  UPPER_ROW,
  VISIBLE_LABEL,
  archOfFdi,
  type Material,
  type MaterialCategory,
  type PlanWarning,
} from "./planner";
import { SHADES } from "./shades";
import { Chips, haptic, Hint, Sheet, Toggle } from "./ui";

export type PlanTab = "shade" | "teeth" | "checks" | "review";
export type PickRole = "reference" | "match" | null;

const LEVEL_WORD = { stop: "Stop", caution: "Caution", info: "Info" } as const;

interface Props {
  plan: CasePlan;
  /** false until the dentist has changed anything (the plan shown is the suggestion) */
  recorded: boolean;
  arch: Arch;
  lib: Material[];
  setPlan: (fn: (p: CasePlan) => CasePlan) => void;
  tab: PlanTab;
  setTab: (t: PlanTab) => void;
  pickRole: PickRole;
  setPickRole: (r: PickRole) => void;
  onMaterials: () => void;
  onLabSheet: () => void;
  onPrepSheet: () => void;
  busy: boolean;
}

export function PlanPanel(p: Props) {
  const warnings = planWarnings(p.plan, p.lib);
  const stops = warnings.filter((w) => w.level === "stop").length;
  const cautions = warnings.filter((w) => w.level === "caution").length;
  const badge = stops ? `${stops} stop` : cautions ? `${cautions}` : "";
  return (
    <>
      <div className="plan-tabs" role="tablist" aria-label="Plan sections">
        {(
          [
            ["shade", "Shade"],
            ["teeth", "Teeth"],
            ["checks", "Checks"],
            ["review", "Review"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            id={`plan-tab-${id}`}
            aria-selected={p.tab === id}
            aria-controls="plan-tabpanel"
            className={p.tab === id ? "plan-tab on" : "plan-tab"}
            onClick={() => {
              p.setTab(id);
              if (id !== "shade") p.setPickRole(null);
            }}
          >
            {label}
            {id === "review" && badge && (
              <span className={stops ? "tab-badge stop" : "tab-badge"} aria-label={stops ? `, ${stops} stop` : `, ${cautions} cautions`}>
                {badge}
              </span>
            )}
          </button>
        ))}
      </div>
      <div id="plan-tabpanel" role="tabpanel" aria-labelledby={`plan-tab-${p.tab}`}>
        {p.tab === "shade" && <ShadeCard {...p} />}
        {p.tab === "teeth" && <TeethCard {...p} warnings={warnings} />}
        {p.tab === "checks" && <ChecksCard {...p} />}
        {p.tab === "review" && <ReviewCard {...p} warnings={warnings} />}
      </div>
    </>
  );
}

// ---------- shade ----------

const fmtLab = (l: number[]) => `L ${l[0].toFixed(1)} · a ${l[1].toFixed(1)} · b ${l[2].toFixed(1)}`;

function ShadeCard({ plan, setPlan, pickRole, setPickRole }: Props) {
  const gap = planShadeGap(plan);
  const samples = plan.shade.samples;
  const setShade = (patch: Partial<CasePlan["shade"]>) => setPlan((x) => ({ ...x, shade: { ...x.shade, ...patch } }));
  let nR = 0;
  let nM = 0;
  return (
    <>
      <div className="row tight pick">
        {(["reference", "match"] as const).map((r) => (
          <button
            key={r}
            className={pickRole === r ? "btn" : "btn secondary"}
            aria-pressed={pickRole === r}
            onClick={() => setPickRole(pickRole === r ? null : r)}
          >
            <i className={`pin-dot ${r}`} aria-hidden="true" />
            {r === "reference" ? "Pick reference" : "Pick tooth to match"}
          </button>
        ))}
      </div>
      {gap ? (
        <div className={`gap ${gap.band}`} aria-live="polite">
          <p className="gap-num">
            <span className="mono">ΔE00</span> {gap.dE00.toFixed(1)}
            <span className="mono band">
              {gap.band === "below" ? "below perceptibility 0.8" : gap.band === "perceptible" ? "perceptible · under 1.8" : "beyond acceptability 1.8"}
            </span>
          </p>
          <p className="mono small">
            ΔL {signed(gap.dL)} · ΔC {signed(gap.dC)} · ΔH {signed(gap.dH)} · mostly {gap.dominant}
          </p>
          <p className="gap-text">{gap.text}</p>
        </div>
      ) : (
        samples.length > 0 && <p className="mono small">Place one reference and one tooth to match to see the gap.</p>
      )}
      {samples.length > 0 && (
        <ul className="samples" aria-label="Shade samples">
          {samples.map((s, i) => {
            const tag = s.role === "reference" ? `R${++nR}` : `M${++nM}`;
            const ok = s.lab[0] > 0;
            return (
              <li key={i}>
                <span className={`mono tag ${s.role}`}>{tag}</span>
                <span className="lab">
                  {s.role === "reference" ? "Reference" : "To match"}
                  <small className="mono">{ok ? `${fmtLab(s.lab)} · near ${nearestTab(s.lab).label}` : "Only shine or shadow here: move the pin onto the tooth"}</small>
                </span>
                <button
                  className="icon"
                  aria-label={`Remove ${s.role === "reference" ? "reference" : "match"} pin ${tag}`}
                  onClick={() => setShade({ samples: samples.filter((_, j) => j !== i) })}
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {samples.length < 2 && (
        <Hint>
          Tap <b>Pick reference</b>, then the tooth whose colour you want to reach (e.g. an upper crown). Then <b>Pick tooth to match</b>{" "}
          and tap the tooth to treat. Aim at the middle third, away from shine. Drag a pin to adjust.
        </Hint>
      )}
      <Chips
        label="Target tab (your choice, from the shade guide)"
        value={plan.shade.targetTab ?? ""}
        options={[{ value: "", label: "Not set" }, ...SHADES.map((s) => ({ value: s.id, label: s.id }))]}
        onChange={(v) => setShade({ targetTab: v || undefined })}
      />
      <Toggle label="Whitening first" note="Planned before the restorations" checked={!!plan.shade.whiteningFirst} onChange={(v) => setShade({ whiteningFirst: v })} />
      <Toggle label="Whitening done" note="Re-take the shade 2 weeks after" checked={!!plan.shade.whiteningDone} onChange={(v) => setShade({ whiteningDone: v })} />
      <p className="note">Nearest tabs are approximate. Phone photos shift colour: confirm with a shade guide in the chair.</p>
    </>
  );
}

const signed = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}`;

// ---------- teeth chart ----------

/** Arch-shaped chart on an 8-column grid: front teeth in one row, premolars and molars running back on both sides. */
function chartCells(showMolars: boolean) {
  const cells: { fdi: number; row: number; col: number }[] = [];
  const back = showMolars ? [8, 7, 6, 5] : [5];
  let r = 1;
  // upper: molars at the top, front row at the bottom (next to the lower front row, like a bite)
  for (const n of back) {
    cells.push({ fdi: 10 + n, row: r, col: 1 }, { fdi: 20 + n, row: r, col: 8 });
    r++;
  }
  const upperFront = UPPER_ROW.filter((f) => position(f) <= 4);
  upperFront.forEach((fdi, i) => cells.push({ fdi, row: r, col: i + 1 }));
  const upperLabelRow = r - 1;
  r++;
  const lowerFrontRow = r;
  LOWER_ROW.filter((f) => position(f) <= 4).forEach((fdi, i) => cells.push({ fdi, row: r, col: i + 1 }));
  r++;
  for (const n of [...back].reverse()) {
    cells.push({ fdi: 40 + n, row: r, col: 1 }, { fdi: 30 + n, row: r, col: 8 });
    r++;
  }
  return { cells, upperLabelRow, lowerLabelRow: lowerFrontRow + 1, rows: r - 1, lowerFrontRow };
}

function TeethCard({ plan, recorded, arch, lib, setPlan, warnings, onMaterials }: Props & { warnings: PlanWarning[] }) {
  const [showMolars, setShowMolars] = useState(() => plan.teeth.some((t) => t.include && position(t.fdi) >= 6));
  const [open, setOpen] = useState<number | null>(null);
  const [bulk, setBulk] = useState(false);
  const { cells, upperLabelRow, lowerLabelRow, lowerFrontRow } = chartCells(showMolars);
  const summary = planSummary(plan, lib);
  const levelOf = (fdi: number) => {
    const w = warnings.filter((x) => x.teeth?.includes(fdi));
    return w.some((x) => x.level === "stop") ? "stop" : w.some((x) => x.level === "caution") ? "caution" : w.length ? "info" : "";
  };
  const toggle = (fdi: number) => {
    haptic();
    setPlan((x) => setTooth(x, fdi, { include: !getTooth(x, fdi).include }));
  };
  const included = summary.teeth;
  return (
    <>
      <p className="summary">{summary.text}</p>
      {!recorded && (
        <p className="note">Suggested start: the front six of the {arch} arch from the design. Change it to your plan; nothing is decided for you.</p>
      )}
      <div className="odonto" style={{ gridTemplateRows: `repeat(${cells.length ? Math.max(...cells.map((c) => c.row)) : 1}, 48px)` }}>
        {upperLabelRow >= 1 && (
          <span className="arch-label mono" style={{ gridRow: upperLabelRow, gridColumn: "2 / 8" }}>
            Upper
          </span>
        )}
        <span className="arch-label mono" style={{ gridRow: lowerLabelRow, gridColumn: "2 / 8" }}>
          Lower
        </span>
        <span className="bite" style={{ gridRow: lowerFrontRow, gridColumn: "1 / 9" }} aria-hidden="true" />
        {cells.map(({ fdi, row, col }) => {
          const t = getTooth(plan, fdi);
          const lv = levelOf(fdi);
          return (
            <ToothButton
              key={fdi}
              t={t}
              level={lv}
              style={{ gridRow: row, gridColumn: col }}
              onToggle={() => toggle(fdi)}
              onLong={() => setOpen(fdi)}
            />
          );
        })}
      </div>
      <div className="chart-foot">
        <button className="link" onClick={() => setShowMolars((v) => !v)} aria-expanded={showMolars}>
          {showMolars ? "Hide molars" : "Show molars"}
        </button>
        <span className="mono small legend-inline">
          <i className="key inc" aria-hidden="true" /> in plan <i className="key vis" aria-hidden="true" /> visible
        </span>
      </div>
      <Hint>
        <b>Tap</b> a tooth to add or remove it. <b>Long-press</b> it, or use the list below, for material, prep, coverage and margin.
      </Hint>
      {included.length > 0 && (
        <>
          <ul className="planned" aria-label="Planned teeth">
            {included.map((fdi) => {
              const t = getTooth(plan, fdi);
              const lv = levelOf(fdi);
              return (
                <li key={fdi}>
                  <button className="planned-row" onClick={() => setOpen(fdi)} aria-label={`Tooth ${fdi}, ${toothName(fdi)}: edit plan`}>
                    <span className="mono fdi">{fdi}</span>
                    <span className="what">
                      {materialOf(t.material, lib)?.name ?? "Material not chosen"}
                      <small>
                        {PREP_LABEL[t.prep]}
                        {t.prepMm?.facial !== undefined ? ` ${t.prepMm.facial} mm F` : ""}
                        {t.prepMm?.incisal !== undefined ? ` ${t.prepMm.incisal} mm I` : ""} · {coverageLabel(t.coverage, archOfFdi(fdi))} · {MARGIN_LABEL[t.margin]}
                      </small>
                    </span>
                    {lv && <span className={`lv ${lv}`} aria-label={LEVEL_WORD[lv]} />}
                    <span aria-hidden="true">›</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <button className="btn secondary wide" onClick={() => setBulk(true)}>
            Apply to selected ({included.length})
          </button>
        </>
      )}
      {open !== null && <ToothSheet fdi={open} plan={plan} lib={lib} setPlan={setPlan} warnings={warnings} onClose={() => setOpen(null)} onMaterials={onMaterials} />}
      {bulk && <BulkSheet teeth={included} lib={lib} setPlan={setPlan} onClose={() => setBulk(false)} />}
    </>
  );
}

function ToothButton({
  t,
  level,
  style,
  onToggle,
  onLong,
}: {
  t: ToothPlan;
  level: string;
  style: React.CSSProperties;
  onToggle: () => void;
  onLong: () => void;
}) {
  const timer = useRef(0);
  const fired = useRef(false);
  const start = useRef({ x: 0, y: 0 });
  const vis = t.visible === "smile" || t.visible === "speech";
  const kind = toothType(t.fdi);
  const cancel = () => window.clearTimeout(timer.current);
  return (
    <button
      className={["tooth", t.include ? "inc" : "", vis ? "vis" : "", kind === "molar" ? "molar" : "", level ? `w-${level}` : ""].join(" ")}
      style={style}
      aria-pressed={t.include}
      aria-label={`${t.fdi}, ${toothName(t.fdi)}${vis ? ", visible" : ""}${level ? `, ${LEVEL_WORD[level as keyof typeof LEVEL_WORD]}` : ""}`}
      onPointerDown={(e) => {
        fired.current = false;
        start.current = { x: e.clientX, y: e.clientY };
        cancel();
        timer.current = window.setTimeout(() => {
          fired.current = true;
          haptic();
          onLong();
        }, 450);
      }}
      onPointerMove={(e) => {
        if (Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 10) cancel();
      }}
      onPointerUp={cancel}
      onPointerCancel={cancel}
      onPointerLeave={cancel}
      onContextMenu={(e) => {
        e.preventDefault();
        if (!fired.current) {
          fired.current = true;
          cancel();
          onLong();
        }
      }}
      onClick={() => {
        if (fired.current) {
          fired.current = false;
          return;
        }
        onToggle();
      }}
    >
      <span className="num">{t.fdi}</span>
      <i className={`glyph ${kind}`} aria-hidden="true" />
    </button>
  );
}

/** Decimal mm field (0–3 mm) that keeps what is typed and reports only valid values; empty clears. */
function MmField({ label, value, onChange }: { label: string; value?: number; onChange: (v: number | undefined) => void }) {
  const [text, setText] = useState(value !== undefined ? String(value) : "");
  const n = Number(text.replace(",", "."));
  const bad = text !== "" && !(n >= 0 && n <= 3);
  return (
    <label className="field mm">
      <span className="field-label">{label}</span>
      <input
        className="input"
        type="text"
        inputMode="decimal"
        placeholder="mm"
        value={text}
        aria-invalid={bad}
        onChange={(e) => {
          const v = e.target.value;
          setText(v);
          const x = Number(v.replace(",", "."));
          if (v === "") onChange(undefined);
          else if (x >= 0 && x <= 3) onChange(Math.round(x * 100) / 100);
        }}
      />
      {bad && <span className="error small">0 to 3 mm</span>}
    </label>
  );
}

function MaterialPicker({ value, lib, onChange, allowKeep }: { value: string; lib: Material[]; onChange: (id: string) => void; allowKeep?: boolean }) {
  const m = materialOf(value, lib);
  return (
    <>
      <Chips
        label="Material (your choice)"
        value={value}
        options={[...(allowKeep ? [{ value: "\u0000", label: "Keep" }] : []), ...lib.map((x) => ({ value: x.id, label: x.name }))]}
        onChange={onChange}
      />
      {m && (m.pros || m.cons) && value !== "\u0000" && (
        <p className="procon">
          {m.pros && (
            <span>
              <b>For:</b> {m.pros}
            </span>
          )}
          {m.cons && (
            <span>
              <b>Against:</b> {m.cons}
            </span>
          )}
        </p>
      )}
    </>
  );
}

function ToothSheet({
  fdi,
  plan,
  lib,
  setPlan,
  warnings,
  onClose,
  onMaterials,
}: {
  fdi: number;
  plan: CasePlan;
  lib: Material[];
  setPlan: Props["setPlan"];
  warnings: PlanWarning[];
  onClose: () => void;
  onMaterials: () => void;
}) {
  const t = getTooth(plan, fdi);
  const set = (patch: Partial<ToothPlan>) => setPlan((x) => setTooth(x, fdi, patch));
  const mine = warnings.filter((w) => w.teeth?.includes(fdi));
  const arch = archOfFdi(fdi);
  return (
    <Sheet
      title={
        <>
          Tooth {fdi} <em>plan</em>
        </>
      }
      onClose={onClose}
    >
      <p className="mono small sub">{toothName(fdi)}</p>
      {mine.length > 0 && <WarningList warnings={mine} compact />}
      <Toggle label="In the plan" checked={t.include} onChange={(include) => set({ include })} />
      <Chips<Visibility>
        label="Visible"
        value={t.visible}
        options={(["smile", "speech", "no", "unknown"] as Visibility[]).map((v) => ({ value: v, label: VISIBLE_LABEL[v] }))}
        onChange={(visible) => set({ visible })}
      />
      <MaterialPicker value={t.material} lib={lib} onChange={(material) => set({ material })} />
      <button className="link small-gap" onClick={onMaterials}>
        Clinic materials…
      </button>
      <Chips<PrepLevel>
        label="Prep level"
        value={t.prep}
        options={(Object.keys(PREP_LABEL) as PrepLevel[]).map((v) => ({ value: v, label: PREP_LABEL[v] }))}
        onChange={(prep) => set({ prep })}
      />
      <Chips<Coverage>
        label="Coverage"
        value={t.coverage}
        options={coverageOptions(fdi).map((v) => ({ value: v, label: coverageLabel(v, arch) }))}
        onChange={(coverage) => set({ coverage })}
      />
      <Chips<Margin>
        label="Margin"
        value={t.margin}
        options={(Object.keys(MARGIN_LABEL) as Margin[]).map((v) => ({ value: v, label: MARGIN_LABEL[v] }))}
        onChange={(margin) => set({ margin })}
      />
      <div className="field">
        <span className="field-label">Prep depth from the mock-up / index (you enter it; the app does not measure depth)</span>
        <div className="row tight mm-row">
          <MmField label="Facial mm" value={t.prepMm?.facial} onChange={(facial) => set({ prepMm: { ...t.prepMm, facial } })} />
          <MmField label={toothType(fdi) === "premolar" || toothType(fdi) === "molar" ? "Occlusal mm" : "Incisal mm"} value={t.prepMm?.incisal} onChange={(incisal) => set({ prepMm: { ...t.prepMm, incisal } })} />
        </div>
      </div>
      <p className="disclaimer" role="note">
        {PREP_DISCLAIMER}
      </p>
      <label className="field">
        <span className="field-label">Notes for this tooth</span>
        <textarea className="input area" rows={2} value={t.notes ?? ""} onChange={(e) => set({ notes: e.target.value || undefined })} />
      </label>
      <button className="btn wide" onClick={onClose}>
        Done
      </button>
    </Sheet>
  );
}

const KEEP = "\u0000";

function BulkSheet({ teeth, lib, setPlan, onClose }: { teeth: number[]; lib: Material[]; setPlan: Props["setPlan"]; onClose: () => void }) {
  const [material, setMaterial] = useState(KEEP);
  const [prep, setPrep] = useState<PrepLevel | typeof KEEP>(KEEP);
  const [margin, setMargin] = useState<Margin | typeof KEEP>(KEEP);
  const [visible, setVisible] = useState<Visibility | typeof KEEP>(KEEP);
  const apply = () => {
    setPlan((x) => {
      let p = x;
      for (const fdi of teeth) {
        const patch: Partial<ToothPlan> = {};
        if (material !== KEEP) patch.material = material;
        if (prep !== KEEP) patch.prep = prep;
        if (margin !== KEEP) patch.margin = margin;
        if (visible !== KEEP) patch.visible = visible;
        p = setTooth(p, fdi, patch);
      }
      return p;
    });
    onClose();
  };
  const keep = { value: KEEP, label: "Keep" } as const;
  return (
    <Sheet
      title={
        <>
          Apply to <em>selected</em>
        </>
      }
      onClose={onClose}
    >
      <p className="mono small sub">{teeth.join(" · ")}</p>
      <MaterialPicker value={material} lib={lib} onChange={setMaterial} allowKeep />
      <Chips<PrepLevel | typeof KEEP>
        label="Prep level"
        value={prep}
        options={[keep, ...(Object.keys(PREP_LABEL) as PrepLevel[]).map((v) => ({ value: v, label: PREP_LABEL[v] }))]}
        onChange={setPrep}
      />
      <Chips<Margin | typeof KEEP>
        label="Margin"
        value={margin}
        options={[keep, ...(Object.keys(MARGIN_LABEL) as Margin[]).map((v) => ({ value: v, label: MARGIN_LABEL[v] }))]}
        onChange={setMargin}
      />
      <Chips<Visibility | typeof KEEP>
        label="Visible"
        value={visible}
        options={[keep, ...(["smile", "speech", "no", "unknown"] as Visibility[]).map((v) => ({ value: v, label: VISIBLE_LABEL[v] }))]}
        onChange={setVisible}
      />
      <p className="hint">Coverage and prep mm differ per tooth: set them in each tooth's sheet.</p>
      <div className="row">
        <button className="btn" onClick={apply}>
          Apply to {teeth.length} teeth
        </button>
        <button className="btn secondary" onClick={onClose}>
          Cancel
        </button>
      </div>
    </Sheet>
  );
}

// ---------- flags + checklist ----------

function ChecksCard({ plan, setPlan }: Props) {
  const flag = (k: keyof CasePlan["flags"]) => (v: boolean) => setPlan((x) => ({ ...x, flags: { ...x.flags, [k]: v } }));
  const check = (id: string) => (v: boolean) =>
    setPlan((x) => ({
      ...x,
      checklist: { ...x.checklist, [id]: v },
      // one control for perio: the checklist item is the perio-stable flag
      flags: id === "perio" ? { ...x.flags, perioStable: v } : x.flags,
    }));
  return (
    <>
      <p className="field-label">Case flags</p>
      <Toggle label="Deep bite" checked={!!plan.flags.deepBite} onChange={flag("deepBite")} />
      <Toggle label="Bruxism / parafunction" checked={!!plan.flags.bruxism} onChange={flag("bruxism")} />
      <Toggle label="Gingival recession" checked={!!plan.flags.recession} onChange={flag("recession")} />
      <p className="field-label">Checklist</p>
      {CHECKLIST.map((c) => (
        <Toggle
          key={c.id}
          label={c.label}
          note={c.id === "nightGuard" && !plan.flags.bruxism ? "Only needed with bruxism" : undefined}
          checked={c.id === "perio" ? plan.flags.perioStable === true : !!plan.checklist[c.id]}
          onChange={check(c.id)}
        />
      ))}
    </>
  );
}

// ---------- review ----------

export function WarningList({ warnings, compact }: { warnings: PlanWarning[]; compact?: boolean }) {
  if (!warnings.length) return <p className="mono small">No conflicts found in what is recorded. This is a check, not an approval.</p>;
  return (
    <ul className={compact ? "warnings compact" : "warnings"} aria-label="Plan warnings">
      {warnings.map((w, i) => (
        <li key={i} className={w.level}>
          <span className="mono lvl">{LEVEL_WORD[w.level]}</span>
          {w.teeth && w.teeth.length > 0 && !compact && (
            <span className="tags">
              {w.teeth.map((t) => (
                <span key={t} className="mono ttag">
                  {t}
                </span>
              ))}
            </span>
          )}
          <span className="wtext">{w.text}</span>
        </li>
      ))}
    </ul>
  );
}

function ReviewCard({ plan, lib, warnings, onLabSheet, onPrepSheet, onMaterials, busy }: Props & { warnings: PlanWarning[] }) {
  const summary = planSummary(plan, lib);
  const hasPrep = plan.teeth.some((t) => t.include && (t.prep !== "none" || t.prepMm?.facial !== undefined || t.prepMm?.incisal !== undefined));
  return (
    <>
      <p className="summary">{summary.text}</p>
      <WarningList warnings={warnings} />
      {hasPrep && (
        <p className="disclaimer" role="note">
          {PREP_DISCLAIMER}
        </p>
      )}
      <div className="field sheets">
        <span className="field-label">Hand-off · A4</span>
        <div className="row tight">
          <button className="btn" onClick={onLabSheet} disabled={busy}>
            Lab prescription
          </button>
          <button className="btn secondary" onClick={onPrepSheet} disabled={busy}>
            Prep sheet + plan
          </button>
        </div>
        <button className="btn secondary wide" onClick={onMaterials}>
          Clinic materials
        </button>
      </div>
    </>
  );
}

// ---------- clinic materials (settings) ----------

export function MaterialsEditor({ clinic, onChange }: { clinic: Material[]; onChange: (list: Material[]) => void }) {
  const [name, setName] = useState("");
  const [cat, setCat] = useState<MaterialCategory>("ceramic-veneer");
  const [msg, setMsg] = useState("");
  const add = () => {
    const next = addClinicMaterial(clinic, name, cat);
    if (next === clinic) {
      setMsg(name.trim() ? "Already in the list." : "Type a name first.");
      return;
    }
    setMsg("");
    setName("");
    onChange(next);
  };
  return (
    <>
      <p className="hint">Your clinic's materials, kept on this phone and offered in every plan. Use generic names; no brand claims.</p>
      <form
        className="mat-add"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <label className="field">
          <span className="field-label">Name</span>
          <input className="input" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="e.g. Pressed lithium disilicate (lab X)" />
        </label>
        <Chips<MaterialCategory>
          label="Category"
          value={cat}
          options={(["composite", "ceramic-veneer", "crown", "whitening", "other"] as MaterialCategory[]).map((v) => ({ value: v, label: CATEGORY_LABEL[v] }))}
          onChange={setCat}
        />
        <button className="btn wide" type="submit">
          Add material
        </button>
        {msg && <p className="error small" role="alert">{msg}</p>}
      </form>
      <p className="field-label">Clinic materials</p>
      {clinic.length ? (
        <ul className="mats">
          {clinic.map((m) => (
            <li key={m.id}>
              <span>
                {m.name}
                <small className="mono">{CATEGORY_LABEL[m.category]}</small>
              </span>
              <button className="btn danger slim" onClick={() => onChange(removeClinicMaterial(clinic, m.id))} aria-label={`Delete ${m.name}`}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mono small">None yet.</p>
      )}
      <details className="fine">
        <summary>Built-in materials ({MATERIALS.length})</summary>
        <ul className="mats builtin">
          {MATERIALS.map((m) => (
            <li key={m.id}>
              <span>
                {m.name}
                <small className="mono">{CATEGORY_LABEL[m.category]}</small>
                {m.pros && <small>For: {m.pros}</small>}
                {m.cons && <small>Against: {m.cons}</small>}
              </span>
            </li>
          ))}
        </ul>
      </details>
    </>
  );
}

export function MaterialsSheet({ clinic, onChange, onClose }: { clinic: Material[]; onChange: (l: Material[]) => void; onClose: () => void }): ReactNode {
  return (
    <Sheet
      title={
        <>
          Clinic <em>materials</em>
        </>
      }
      onClose={onClose}
    >
      <MaterialsEditor clinic={clinic} onChange={onChange} />
      <button className="btn secondary wide" onClick={onClose}>
        Done
      </button>
    </Sheet>
  );
}
