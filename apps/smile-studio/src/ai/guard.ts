// Labs: egress guard, installed the first time the Auto-detect beta is used (never with the flag off).
// The MediaPipe library contains a usage logger that would POST anonymous task statistics to a Google endpoint.
// Smile Studio sends nothing anywhere, so any request to another host is refused here (the built app's CSP
// `connect-src 'self'` blocks it as well). Same-origin, data: and blob: requests pass unchanged.
let installed = false;

const foreign = (u: string | URL) => {
  try {
    const url = new URL(String(u), document.baseURI);
    return url.protocol !== "data:" && url.protocol !== "blob:" && url.origin !== location.origin;
  } catch {
    return true;
  }
};

export function installEgressGuard() {
  if (installed) return;
  installed = true;
  const f = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const u = input instanceof Request ? input.url : input;
    return foreign(u) ? Promise.reject(new TypeError("Smile Studio: requests to other hosts are blocked")) : f(input, init);
  };
  const open = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (this: XMLHttpRequest, method: string, url: string | URL, ...rest: unknown[]) {
    if (foreign(url)) throw new TypeError("Smile Studio: requests to other hosts are blocked");
    return (open as (...a: unknown[]) => void).call(this, method, url, ...rest);
  } as typeof XMLHttpRequest.prototype.open;
  if (navigator.sendBeacon) {
    const beacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = (url: string | URL, data?: BodyInit | null) => (foreign(url) ? false : beacon(url, data));
  }
}
