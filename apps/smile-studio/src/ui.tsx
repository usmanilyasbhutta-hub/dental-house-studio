import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";

export function Chips<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <div className="chips" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={String(o.value)}
            role="radio"
            aria-checked={o.value === value}
            className={o.value === value ? "chip on" : "chip"}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Range slider with − / + steppers (44 px) for precise steps with a thumb. */
export function Slider({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  const id = useId();
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v / step) * step));
  return (
    <div className="field slider">
      <label className="field-label" htmlFor={id}>
        {label} <b>{format(value)}</b>
      </label>
      <div className="slider-row">
        <button className="step-btn" aria-label={`Less ${label.toLowerCase()}`} onClick={() => onChange(clamp(value - step))} disabled={value <= min}>
          −
        </button>
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          aria-valuetext={format(value)}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <button className="step-btn" aria-label={`More ${label.toLowerCase()}`} onClick={() => onChange(clamp(value + step))} disabled={value >= max}>
          +
        </button>
      </div>
    </div>
  );
}

export function Toggle({ label, checked, onChange, note }: { label: string; checked: boolean; onChange: (v: boolean) => void; note?: string }) {
  return (
    <button className="toggle" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}>
      <span>
        {label}
        {note && <small>{note}</small>}
      </span>
      <i aria-hidden="true" />
    </button>
  );
}

export function Hint({ children }: { children: ReactNode }) {
  return <p className="hint">{children}</p>;
}

/** Bottom sheet dialog. Escape or the backdrop closes it; focus moves into it. */
export function Sheet({ title, children, onClose }: { title: ReactNode; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const first = ref.current?.querySelector<HTMLElement>("input, button.btn, button");
    first?.focus();
    const key = (e: KeyboardEvent) => e.key === "Escape" && close.current();
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("keydown", key);
      prev?.focus?.();
    };
  }, []);
  return (
    <div className="sheet-back" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={ref}>
        <h2 id={titleId}>{title}</h2>
        {children}
      </div>
    </div>
  );
}

export type ToastKind = "info" | "error";

/** Small status message at the bottom of the screen (announced by screen readers). */
export function useToast() {
  const [toast, setToast] = useState<{ text: string; kind: ToastKind } | null>(null);
  const timer = useRef(0);
  const show = useCallback((text: string, kind: ToastKind = "info", ms = 3500) => {
    window.clearTimeout(timer.current);
    setToast({ text, kind });
    if (ms) timer.current = window.setTimeout(() => setToast(null), ms);
  }, []);
  const hide = useCallback(() => setToast(null), []);
  const node = (
    <div className="toast-slot" role="status" aria-live="polite">
      {toast && <div className={`toast ${toast.kind}`}>{toast.text}</div>}
    </div>
  );
  return { show, hide, node };
}

/** "just now", "5 min ago", "3 h ago", "2 days ago". */
export function ago(ts: number, now = Date.now()) {
  const s = Math.max(0, (now - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  const d = Math.floor(s / 86400);
  return d === 1 ? "yesterday" : `${d} days ago`;
}

export const haptic = () => navigator.vibrate?.(10);
