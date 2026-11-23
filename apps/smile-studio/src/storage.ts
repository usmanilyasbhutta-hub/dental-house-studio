// Cases are stored only on this device (IndexedDB). Nothing is uploaded anywhere.
import type { CaseData } from "./model";

const DB = "smile-studio";
const STORE = "cases";
/** Wax-up STL files per case, kept apart so the case list never loads big meshes. */
const WAX = "waxups";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 2);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
      if (!db.objectStoreNames.contains(WAX)) db.createObjectStore(WAX, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>, store = STORE): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction(store, mode).objectStore(store));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const listCases = async () =>
  (await tx<CaseData[]>("readonly", (s) => s.getAll())).sort((a, b) => b.updatedAt - a.updatedAt);
export const saveCase = (c: CaseData) => tx("readwrite", (s) => s.put(c));
export const deleteCase = async (id: string) => {
  await tx("readwrite", (s) => s.delete(id), WAX);
  return tx("readwrite", (s) => s.delete(id));
};

/** One STL slot: the patient's original scan or the lab's wax-up, for one arch. */
export interface WaxFile {
  name: string;
  blob: Blob;
}
/** One jaw: files, the dentist's tooth-number corrections and material per tooth (FDI → material id) for the reduction estimate. */
export interface WaxJaw {
  original?: WaxFile;
  waxup?: WaxFile;
  shift?: number;
  flip?: boolean;
  materials?: Record<number, string>;
}
/** Wax-up files of a case (key = case id). Stays on this device like the photo. */
export interface WaxupData {
  id: string;
  lower?: WaxJaw;
  upper?: WaxJaw;
  updatedAt: number;
}
export const loadWaxup = (id: string) => tx<WaxupData | undefined>("readonly", (s) => s.get(id), WAX);
export const saveWaxup = (w: WaxupData) => tx("readwrite", (s) => s.put(w), WAX);
export const deleteWaxup = (id: string) => tx("readwrite", (s) => s.delete(id), WAX);

/** Deletes the whole database (stronger than deleting records: the browser drops the files). */
export const wipeAll = () =>
  new Promise<void>((resolve, reject) => {
    const r = indexedDB.deleteDatabase(DB);
    r.onsuccess = () => resolve();
    r.onerror = () => reject(r.error);
    r.onblocked = () => resolve();
  });

/** Days a case is kept on the phone before it is cleared automatically. */
export const KEEP_DAYS = 30;

/** Removes cases not touched for KEEP_DAYS (shared clinic phones should not keep faces forever). */
export async function purgeOld(days = KEEP_DAYS) {
  const cut = Date.now() - days * 864e5;
  for (const c of await listCases()) if (c.updatedAt < cut) await deleteCase(c.id);
}

/** Loads a photo, applies EXIF orientation, downsizes to maxSide and strips metadata (re-encoded JPEG). */
export async function loadPhoto(file: Blob, maxSide = 2048) {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const k = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * k);
  const h = Math.round(bmp.height * k);
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  cv.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  // re-encoding through a canvas drops all EXIF / GPS metadata
  const blob = await new Promise<Blob>((res, rej) =>
    cv.toBlob((b) => (b ? res(b) : rej(new Error("Could not encode photo"))), "image/jpeg", 0.92),
  );
  return { blob, w, h };
}

export function thumbnail(img: CanvasImageSource, w: number, h: number, side = 240) {
  const k = side / Math.max(w, h);
  const cv = document.createElement("canvas");
  cv.width = Math.round(w * k);
  cv.height = Math.round(h * k);
  cv.getContext("2d")!.drawImage(img, 0, 0, cv.width, cv.height);
  return cv.toDataURL("image/jpeg", 0.7);
}
