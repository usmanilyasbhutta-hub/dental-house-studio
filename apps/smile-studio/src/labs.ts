// Labs: opt-in beta features. Settings › Labs › "Auto-detect (beta)", stored on this phone, OFF by default.
// With the flag off nothing below the dynamic import runs and no model file is requested.
export const LABS_KEY = "smile-studio.labs.autodetect.v1";

export function labsOn(): boolean {
  try {
    return localStorage.getItem(LABS_KEY) === "1";
  } catch {
    return false;
  }
}

export function setLabs(on: boolean) {
  try {
    if (on) localStorage.setItem(LABS_KEY, "1");
    else localStorage.removeItem(LABS_KEY);
  } catch {
    /* private mode: the beta simply stays off */
  }
}

export const LABS_FAIL = "Auto-detect isn't available on this phone; you can place the dots by hand.";
export const LABS_FAIL_TEETH = "Auto-detect isn't available on this phone; you can paint the teeth by hand.";
export const LABS_TIMEOUT_MS = 8000;

export type Assist = typeof import("./ai/assist");

/** Loads the on-device assist module on first use and runs fn; rejects on any failure or after the timeout. */
export function withAssist<T>(fn: (a: Assist) => Promise<T>, ms = LABS_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = window.setTimeout(() => reject(new Error("Auto-detect timed out")), ms);
    import("./ai/assist")
      .then(fn)
      .then(
        (v) => {
          window.clearTimeout(t);
          resolve(v);
        },
        (e) => {
          window.clearTimeout(t);
          reject(e);
        },
      );
  });
}
