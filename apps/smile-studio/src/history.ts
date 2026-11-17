// Undo / redo for the editor. Snapshots are small (guides, lips, design, calibration), so we keep whole copies.
// A snapshot is committed when a drag ends, or ~350 ms after the last control change (so a slider drag is one step).
import { useCallback, useEffect, useRef, useState } from "react";

const LIMIT = 50;
const SETTLE_MS = 350;

export function useHistory<T>(current: T, apply: (s: T) => void) {
  const base = useRef(current);
  const baseKey = useRef(JSON.stringify(current));
  const past = useRef<T[]>([]);
  const future = useRef<T[]>([]);
  const busy = useRef(false); // a gesture is in progress: do not commit half a drag
  const cur = useRef(current);
  const timer = useRef(0);
  const [, setTick] = useState(0);
  cur.current = current;

  const commit = useCallback(() => {
    window.clearTimeout(timer.current);
    const key = JSON.stringify(cur.current);
    if (key === baseKey.current) return;
    past.current.push(base.current);
    if (past.current.length > LIMIT) past.current.shift();
    future.current.length = 0; // keep the same array: jump() holds a reference to it
    base.current = cur.current;
    baseKey.current = key;
    setTick((t) => t + 1);
  }, []);

  // settle-commit after control changes
  useEffect(() => {
    if (busy.current) return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(commit, SETTLE_MS);
    return () => window.clearTimeout(timer.current);
  }, [current, commit]);

  const jump = (from: T[], to: T[]) => {
    commit();
    const s = from.pop();
    if (s === undefined) return;
    to.push(base.current);
    base.current = s;
    baseKey.current = JSON.stringify(s);
    apply(s);
    setTick((t) => t + 1);
  };

  return {
    undo: () => jump(past.current, future.current),
    redo: () => jump(future.current, past.current),
    canUndo: past.current.length > 0 || JSON.stringify(current) !== baseKey.current,
    canRedo: future.current.length > 0,
    /** Call with true when a drag starts and false when it ends (commits right after the final render). */
    gesture: (active: boolean) => {
      busy.current = active;
      window.clearTimeout(timer.current);
      // the final drag position is pushed in the same event: commit after React has rendered it
      if (!active) timer.current = window.setTimeout(commit, 0);
    },
  };
}
