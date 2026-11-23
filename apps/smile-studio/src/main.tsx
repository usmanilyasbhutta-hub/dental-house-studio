// App entry: mounts Home (saved cases) or the Editor for the open case.

import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { Editor } from "./Editor";
import { Home } from "./Home";
import type { CaseData } from "./model";
import "./styles.css";

function App() {
  const [open, setOpen] = useState<CaseData | null>(null);
  return open ? <Editor key={open.id} initial={open} onClose={() => setOpen(null)} /> : <Home onOpen={setOpen} />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Offline support once built (installed to the home screen it works without internet).
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}
