import { useEffect, useRef, useState } from "react";
import { archOf, withArch } from "./arch";
import { initialLayout, newId, type CaseData } from "./model";
import { deleteCase, KEEP_DAYS, listCases, loadPhoto, purgeOld, saveCase, thumbnail, wipeAll } from "./storage";
import { ago, Sheet, useToast } from "./ui";

type Source = "rear" | "front" | "gallery";
type Dialog =
  | { kind: "consent"; source: Source }
  | { kind: "menu"; c: CaseData }
  | { kind: "rename"; c: CaseData }
  | { kind: "delete"; c: CaseData }
  | { kind: "wipe" }
  | null;

export function Home({ onOpen }: { onOpen: (c: CaseData) => void }) {
  const [cases, setCases] = useState<CaseData[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [showPhotos, setShowPhotos] = useState(false);
  const [name, setName] = useState("");
  const toast = useToast();
  const inputs = { rear: useRef<HTMLInputElement>(null), front: useRef<HTMLInputElement>(null), gallery: useRef<HTMLInputElement>(null) };

  const refresh = () =>
    purgeOld()
      .catch(() => {})
      .then(listCases)
      .then(setCases)
      .catch(() => setCases([]));
  useEffect(() => {
    refresh();
  }, []);

  const onFile = async (input: HTMLInputElement) => {
    const f = input.files?.[0];
    input.value = ""; // same photo can be picked again, and the File is not kept around
    if (!f) return;
    setImporting(true);
    try {
      const { blob, w, h } = await loadPhoto(f);
      const now = Date.now();
      const label = `Case ${new Date(now).toLocaleDateString(undefined, { day: "numeric", month: "short" })} · ${new Date(now).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`;
      let thumb: string | undefined;
      try {
        const bmp = await createImageBitmap(blob);
        thumb = thumbnail(bmp, w, h);
        bmp.close();
      } catch {
        /* the editor makes one when it opens */
      }
      const c: CaseData = { id: newId(), label, createdAt: now, updatedAt: now, photo: blob, imgW: w, imgH: h, consentPhotoAt: now, thumb, ...initialLayout(w, h) };
      await saveCase(c);
      onOpen(c);
    } catch {
      toast.show("That file could not be opened as a photo. Try a JPG or PNG, or take the photo again.", "error", 6000);
    } finally {
      setImporting(false);
    }
  };

  const duplicate = async (c: CaseData) => {
    const now = Date.now();
    await saveCase({ ...c, id: newId(), label: `${c.label} · variant`, createdAt: now, updatedAt: now, consentShareAt: undefined });
    toast.show("Variant added");
    refresh();
  };

  /** Same photo, lip line and existing-teeth outline; the design moves to the lower arch with the upper shade (linked). */
  const planLower = async (c: CaseData) => {
    const now = Date.now();
    const copy: CaseData = {
      ...c,
      id: newId(),
      label: `${c.label} · lower`,
      createdAt: now,
      updatedAt: now,
      consentShareAt: undefined,
      design: withArch(c.design, c.guides, "lower"),
    };
    await saveCase(copy);
    toast.show("Lower-teeth design added");
    onOpen(copy);
  };

  // returning users see their designs first; the photo tips lead only while the list is empty
  const tips = (
    <section className="tips">
      <p className="mono kicker">For a good photo</p>
      <ol>
        <li>Face straight to the camera, eyes visible, natural full smile.</li>
        <li>Phone at mouth height, about 1 m away, zoom 2×. Even light, no flash glare.</li>
        <li>Ask the patient before taking or sharing any photo.</li>
      </ol>
    </section>
  );

  const ask = (source: Source) => setDialog({ kind: "consent", source });

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
          <button className="btn" onClick={() => ask("rear")} disabled={importing}>
            Take photo
          </button>
          <button className="btn secondary" onClick={() => ask("gallery")} disabled={importing}>
            Choose photo
          </button>
        </div>
        <button className="ghost small-link" onClick={() => ask("front")} disabled={importing}>
          Use the front (selfie) camera instead
        </button>
        <input ref={inputs.rear} type="file" accept="image/*" capture="environment" hidden onChange={(e) => onFile(e.currentTarget)} />
        <input ref={inputs.front} type="file" accept="image/*" capture="user" hidden onChange={(e) => onFile(e.currentTarget)} />
        <input ref={inputs.gallery} type="file" accept="image/*" hidden onChange={(e) => onFile(e.currentTarget)} data-testid="gallery-input" />
        {importing && (
          <p className="muted" role="status">
            <span className="spinner" aria-hidden="true" /> Preparing photo…
          </p>
        )}
      </section>

      {!cases?.length && tips}

      <section className="cases">
        <div className="cases-head">
          <p className="mono kicker">On this phone</p>
          {!!cases?.length && (
            <button className="ghost" aria-pressed={showPhotos} onClick={() => setShowPhotos((v) => !v)}>
              {showPhotos ? "Hide photos" : "Show photos"}
            </button>
          )}
        </div>
        {cases === null ? (
          <p className="muted" role="status">
            Loading…
          </p>
        ) : cases.length === 0 ? (
          <div className="empty">
            <img src="./brand/mark-white.png" alt="" className="empty-mark" />
            <p>No designs on this phone yet.</p>
            <p className="muted">Start with Take photo. The photo and the design stay on this phone.</p>
          </div>
        ) : (
          <ul className="grid">
            {cases.map((c) => (
              <li key={c.id} className="card">
                <button className="card-open" onClick={() => onOpen(c)} aria-label={`Open ${c.label}, edited ${ago(c.updatedAt)}`}>
                  {c.thumb ? <img src={c.thumb} alt="" className={showPhotos ? "" : "veiled"} /> : <div className="noimg" />}
                  <span className="card-label">{c.label}</span>
                  <span className="card-time mono">{ago(c.updatedAt)}</span>
                </button>
                <button className="card-more" aria-label={`More for ${c.label}`} onClick={() => setDialog({ kind: "menu", c })}>
                  ⋯
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="small muted">Designs are cleared from this phone after {KEEP_DAYS} days.</p>
        {!!cases?.length && (
          <button className="ghost danger" onClick={() => setDialog({ kind: "wipe" })}>
            Delete all designs from this phone
          </button>
        )}
      </section>
      {!!cases?.length && tips}
      <footer className="foot mono">Private: nothing leaves this device unless you share it · Simulations are for discussion, not a promised result</footer>

      {dialog?.kind === "consent" && (
        <Sheet title="Before the photo" onClose={() => setDialog(null)}>
          <p>Patient agreed to a photo for in-chair discussion?</p>
          <div className="row">
            <button
              className="btn"
              onClick={() => {
                // must run inside this tap so the browser allows the camera / picker
                inputs[dialog.source].current?.click();
                setDialog(null);
              }}
            >
              Yes, patient agreed
            </button>
            <button className="btn secondary" onClick={() => setDialog(null)}>
              Not yet
            </button>
          </div>
        </Sheet>
      )}

      {dialog?.kind === "menu" && (
        <Sheet title={dialog.c.label} onClose={() => setDialog(null)}>
          <div className="menu">
            <button
              className="btn secondary"
              onClick={() => {
                setName(dialog.c.label);
                setDialog({ kind: "rename", c: dialog.c });
              }}
            >
              Rename
            </button>
            <button
              className="btn secondary"
              onClick={() => {
                setDialog(null);
                void duplicate(dialog.c);
              }}
            >
              Duplicate as variant
            </button>
            {archOf(dialog.c.design) === "upper" && (
              <button
                className="btn secondary"
                onClick={() => {
                  setDialog(null);
                  void planLower(dialog.c);
                }}
              >
                Plan lower teeth (copy)
              </button>
            )}
            <button className="btn danger" onClick={() => setDialog({ kind: "delete", c: dialog.c })}>
              Delete
            </button>
          </div>
        </Sheet>
      )}

      {dialog?.kind === "rename" && (
        <Sheet title="Rename" onClose={() => setDialog(null)}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const label = name.trim().slice(0, 40) || dialog.c.label;
              await saveCase({ ...dialog.c, label });
              setDialog(null);
              refresh();
            }}
          >
            <label className="field">
              <span className="field-label">Label</span>
              <input className="input" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} autoComplete="off" />
            </label>
            <p className="hint">Initials or a code only, never a name or file ID.</p>
            <button className="btn wide" type="submit">
              Save
            </button>
          </form>
        </Sheet>
      )}

      {dialog?.kind === "delete" && (
        <Sheet title="Delete this design?" onClose={() => setDialog(null)}>
          <p>The design and its photo are removed from this phone. This cannot be undone.</p>
          <div className="row">
            <button
              className="btn danger"
              onClick={async () => {
                await deleteCase(dialog.c.id);
                setDialog(null);
                toast.show("Deleted");
                refresh();
              }}
            >
              Delete
            </button>
            <button className="btn secondary" onClick={() => setDialog(null)}>
              Keep
            </button>
          </div>
        </Sheet>
      )}

      {dialog?.kind === "wipe" && (
        <Sheet title="Delete all designs?" onClose={() => setDialog(null)}>
          <p>Every photo and design in Smile Studio is removed from this phone. This cannot be undone.</p>
          <div className="row">
            <button
              className="btn danger"
              onClick={async () => {
                await wipeAll().catch(() => {});
                setDialog(null);
                toast.show("All designs deleted from this phone");
                refresh();
              }}
            >
              Delete all
            </button>
            <button className="btn secondary" onClick={() => setDialog(null)}>
              Keep
            </button>
          </div>
        </Sheet>
      )}
      {toast.node}
    </div>
  );
}
