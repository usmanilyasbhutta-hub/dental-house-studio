// Offline support. Same-origin GETs only; nothing is ever sent anywhere.
// Network-first (so updates arrive), cache fallback offline. Only good responses are cached.
// The version below is replaced at build time with a hash of the file list, so each release gets a fresh cache.
const CACHE = "smile-studio-__VERSION__";
// The build fills in the hashed asset list below (see vite.config.ts "precache-list").
const SHELL = ["./", /*__PRECACHE__*/];

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
});

self.addEventListener("activate", (e) =>
  e.waitUntil(
    caches
      .keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  ),
);

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && res.type === "basic") {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() =>
        // ignoreVary: precached entries were fetched with different request headers than the page's own requests
        caches
          .match(req, { ignoreVary: true })
          .then((r) => r || (req.mode === "navigate" ? caches.match("./", { ignoreVary: true }) : Response.error())),
      ),
  );
});
