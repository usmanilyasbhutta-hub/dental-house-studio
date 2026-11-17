import { useEffect, useRef, useState } from "react";
import { initialLayout, newId, type CaseData } from "./model";
import { deleteCase, listCases, loadPhoto, saveCase } from "./storage";

export function Home({ onOpen }: { onOpen: (c: CaseData) => void }) {
  const [cases, setCases] = useState<CaseData[] | null>(null);
  const [error, setError] = useState("");
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);

  const refresh = () => listCases().then(setCases).catch(() => setCases([]));
  useEffect(() => {
    refresh();
  }, []);

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setError("");
    try {
      const { blob, w, h } = await loadPhoto(f);
      const now = Date.now();
      const label = `Case ${new Date(now).toLocaleDateString(undefined, { day: "numeric", month: "short" })} · ${new Date(now).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`;
      const c: CaseData = { id: newId(), label, createdAt: now, updatedAt: now, photo: blob, imgW: w, imgH: h, ...initialLayout(w, h) };
      await saveCase(c);
      onOpen(c);
    } catch {
      setError("That file could not be opened as a photo. Try a JPG or PNG.");
    }
  };

  return (
    <div className="home">
      <header className="brandbar">
        <img src="./brand/logo-white.png" alt="Dental House" className="logo" />
      </header>
      <section className="hero">
        <p className="mono kicker">Smile studio</p>
        <h1>
          Design the smile <em>together</em>
        </h1>
        <p className="lede">Take a smiling photo, set the face lines, and try tooth shapes, proportions and shades in the chair.</p>
        <div className="row">
          <button className="btn" onClick={() => camera.current?.click()}>Take photo</button>
          <button className="btn secondary" onClick={() => gallery.current?.click()}>Choose photo</button>
        </div>
        <input ref={camera} type="file" accept="image/*" capture="user" hidden onChange={(e) => onFile(e.target.files?.[0])} />
        <input ref={gallery} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />
        {error && <p className="error">{error}</p>}
      </section>

      <section className="tips">
        <p className="mono kicker">For a good photo</p>
        <ol>
          <li>Face straight to the camera, eyes visible, natural full smile.</li>
          <li>Phone at mouth height, about 1 m away, zoom 2×. Even light, no flash glare.</li>
          <li>Ask the patient before taking or sharing any photo.</li>
        </ol>
      </section>

      <section className="cases">
        <p className="mono kicker">On this phone</p>
        {cases === null ? (
          <p className="muted">Loading…</p>
        ) : cases.length === 0 ? (
          <p className="muted">No designs yet. Photos and designs stay on this device only.</p>
        ) : (
          <ul className="grid">
            {cases.map((c) => (
              <li key={c.id} className="card">
                <button className="card-open" onClick={() => onOpen(c)}>
                  {c.thumb ? <img src={c.thumb} alt="" /> : <div className="noimg" />}
                  <span>{c.label}</span>
                </button>
                <button
                  className="card-del"
                  aria-label={`Delete ${c.label}`}
                  onClick={async () => {
                    if (confirm("Delete this design and its photo from this phone?")) {
                      await deleteCase(c.id);
                      refresh();
                    }
                  }}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <footer className="foot mono">Private: nothing leaves this device · Simulations are for discussion, not a promised result</footer>
    </div>
  );
}
