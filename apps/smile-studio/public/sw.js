// Offline support. Same-origin GETs only; nothing is ever sent anywhere.
// Network-first (so updates arrive), cache fallback offline. Only good responses are cached.
// The version below is replaced at build time with a hash of the file list, so each release gets a fresh cache.
const CACHE = "smile-studio-__VERSION__";
// Labs (Auto-detect beta) files: never precached; cached here on first use (cache-first), kept across app updates
// until the model files themselves change.
const LABS = "smile-studio-labs-__LABS_VERSION__";
const isLabs = (url) => /\/models\//.test(url.pathname) || /\/assets\/labs-/.test(url.pathname);
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
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE && k !== LABS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  ),
);

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  if (isLabs(url)) {
    e.respondWith(
      caches.open(LABS).then((c) =>
        c.match(req, { ignoreVary: true }).then(
          (hit) =>
            hit ||
            fetch(req).then((res) => {
              if (res.ok && res.type === "basic") c.put(req, res.clone());
              return res;
            }),
        ),
      ),
    );
    return;
  }
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
