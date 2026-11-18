import { useCallback, useEffect, useId, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Short text of an option label, used to decide whether a segmented control fits. */
const textLen = (n: ReactNode): number => (typeof n === "string" || typeof n === "number" ? String(n).length : 12);

/**
 * Single choice. Two to four short options render as an iOS segmented control; longer sets as capsule chips
 * (wrapping, or one scrolling row with `scroll`). Always a radiogroup for assistive tech.
 */
export function Chips<T extends string | number>({
  label,
  value,
  options,
  onChange,
  scroll,
  segmented,
}: {
  label: string;
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  scroll?: boolean;
  segmented?: boolean;
}) {
  const seg = segmented ?? (options.length >= 2 && options.length <= 4 && options.reduce((n, o) => n + textLen(o.label), 0) <= 34);
  const box = seg ? "seg" : scroll ? "chips scroll" : "chips";
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <div className={box} role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={String(o.value)}
            role="radio"
            aria-checked={o.value === value}
            className={o.value === value ? `${seg ? "seg-item" : "chip"} on` : seg ? "seg-item" : "chip"}
            onClick={() => {
              if (o.value !== value) tick();
              onChange(o.value);
            }}
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
          <Icon name="minus" />
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
          <Icon name="plus" />
        </button>
      </div>
    </div>
  );
}

export function Toggle({ label, checked, onChange, note }: { label: string; checked: boolean; onChange: (v: boolean) => void; note?: string }) {
  return (
    <button
      className="toggle"
      role="switch"
      aria-checked={checked}
      onClick={() => {
        tick();
        onChange(!checked);
      }}
    >
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

/** Inset grouped list (iOS Settings style): a rounded card whose rows are separated by hairlines. */
export function Group({ header, footer, children, className }: { header?: ReactNode; footer?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={className ? `group-wrap ${className}` : "group-wrap"}>
      {header && <p className="group-head">{header}</p>}
      <div className="group">{children}</div>
      {footer && <p className="group-foot">{footer}</p>}
    </div>
  );
}

/**
 * Bottom sheet dialog with a grabber. Escape, the backdrop or a downward drag on the grabber / title closes it;
 * focus moves into it. On wide screens it is a centred card (iPad form sheet).
 */
export function Sheet({ title, children, onClose, className }: { title: ReactNode; children: ReactNode; onClose: () => void; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const downOnBack = useRef(false);
  const close = useRef(onClose);
  close.current = onClose;
  const drag = useRef<{ y: number; id: number } | null>(null);
  const pressedInside = useRef(false);
  const [dy, setDy] = useState(0);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const first = ref.current?.querySelector<HTMLElement>("input, button.btn, button:not(.grabber)");
    first?.focus();
    const key = (e: KeyboardEvent) => e.key === "Escape" && close.current();
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("keydown", key);
      prev?.focus?.();
    };
  }, []);
  const dragProps = {
    onPointerDown: (e: RPointerEvent) => {
      drag.current = { y: e.clientY, id: e.pointerId };
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    },
    onPointerMove: (e: RPointerEvent) => {
      if (drag.current && drag.current.id === e.pointerId) setDy(Math.max(0, e.clientY - drag.current.y));
    },
    onPointerUp: () => {
      const d = dy;
      drag.current = null;
      setDy(0);
      if (d > 90) close.current();
    },
    onPointerCancel: () => {
      drag.current = null;
      setDy(0);
    },
  };
  // portalled to <body>: a sheet opened from inside a scrolling panel still covers the whole screen
  return createPortal(
    <div
      className="sheet-back"
      // close only when the press also STARTED on the backdrop: the click that ends a long-press which opened this sheet
      // must not close it again
      onPointerDown={(e) => (downOnBack.current = e.target === e.currentTarget)}
      onClick={(e) => {
        if (e.target === e.currentTarget && downOnBack.current) onClose();
        downOnBack.current = false;
      }}
    >
      <div
        className={className ? `sheet ${className}` : "sheet"}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={ref}
        style={dy ? { transform: `translateY(${dy}px)`, transition: "none" } : undefined}
        // the finger that long-pressed to open this sheet lifts over it: that release must not press a control here
        onPointerDownCapture={() => (pressedInside.current = true)}
        onClickCapture={(e) => {
          if (e.detail !== 0 && !pressedInside.current) {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
      >
        <div className="sheet-head" {...dragProps}>
          <span className="grabber-bar" aria-hidden="true" />
          <h2 id={titleId}>{title}</h2>
        </div>
        {children}
      </div>
    </div>,
    document.body,
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
      {toast && (
        <div className={`toast ${toast.kind}`}>
          {toast.kind === "error" ? <Icon name="alert" /> : toast.text.endsWith("…") ? <span className="spinner" aria-hidden="true" /> : <Icon name="check" />}
          <span>{toast.text}</span>
        </div>
      )}
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
/** Light selection tick (meaningful commits only: a choice changed, a switch flipped). */
export const tick = () => navigator.vibrate?.(8);

const PATHS: Record<string, ReactNode> = {
  back: <path d="M15 5l-7 7 7 7" />,
  forward: <path d="M9 5l7 7-7 7" />,
  undo: <path d="M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 010 11H11" />,
  redo: <path d="M15 14l5-5-5-5M20 9H9.5a5.5 5.5 0 000 11H13" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  more: (
    <>
      <circle cx="5.5" cy="12" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="18.5" cy="12" r="1.3" fill="currentColor" stroke="none" />
    </>
  ),
  fit: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
  alert: <path d="M12 4l9 16H3zM12 10v4M12 17.2v.3" />,
  sliders: <path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 4.5v5M8 14.5v5" />,
  camera: <path d="M4 8h3.5L9 5.5h6L16.5 8H20v11H4zM12 16.5a3.2 3.2 0 100-6.4 3.2 3.2 0 000 6.4z" />,
  photo: <path d="M4 5h16v14H4zM4 16l5-5 4 4 2.5-2.5L20 17M15.5 9.5h.01" />,
  trash: <path d="M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13" />,
  face: <path d="M12 3.5c4.4 0 7.5 3.4 7.5 8.2 0 5-3.4 8.8-7.5 8.8s-7.5-3.8-7.5-8.8C4.5 6.9 7.6 3.5 12 3.5zM9 10.5h.01M15 10.5h.01M9.3 15.2c1.6 1.3 3.8 1.3 5.4 0" />,
  lips: <path d="M3 12c2.5-3.5 5-5 6.5-4 1 .7 1.7.7 2.5.2.8.5 1.5.5 2.5-.2C16 7 18.5 8.5 21 12c-2.5 3.6-5.6 5-9 5s-6.5-1.4-9-5zM3 12h18" />,
  tooth: <path d="M7.5 4C5 4 4 6 4 8.5c0 2.4 1.2 4 1.8 6.5.5 2.3.8 5 2.2 5 1.6 0 1.6-4.5 4-4.5s2.4 4.5 4 4.5c1.4 0 1.7-2.7 2.2-5 .6-2.5 1.8-4.1 1.8-6.5C20 6 19 4 16.5 4c-1.8 0-2.7 1-4.5 1S9.3 4 7.5 4z" />,
  drop: <path d="M12 3.5s6 6.4 6 10.6a6 6 0 01-12 0C6 9.9 12 3.5 12 3.5z" />,
  compare: <path d="M12 3v18M4 6h16v12H4z" />,
  plan: <path d="M8 4.5h8V7H8zM6 6H4.5v14.5h15V6H18M8 12h8M8 16h5" />,
  search: <path d="M10.5 17a6.5 6.5 0 100-13 6.5 6.5 0 000 13zM15.5 15.5L20 20" />,
};

/** SF-Symbols-style line icon (24 grid, 1.6 px stroke). Decorative: the button around it carries the name. */
export function Icon({ name, size = 22 }: { name: keyof typeof PATHS | string; size?: number }) {
  return (
    <svg className="ico" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {PATHS[name]}
    </svg>
  );
}
