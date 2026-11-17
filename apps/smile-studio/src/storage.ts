// Cases are stored only on this device (IndexedDB). Nothing is uploaded anywhere.
import type { CaseData } from "./model";

const DB = "smile-studio";
const STORE = "cases";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const listCases = async () =>
  (await tx<CaseData[]>("readonly", (s) => s.getAll())).sort((a, b) => b.updatedAt - a.updatedAt);
export const saveCase = (c: CaseData) => tx("readwrite", (s) => s.put(c));
export const deleteCase = (id: string) => tx("readwrite", (s) => s.delete(id));

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
  const blob = await new Promise<Blob>((r) => cv.toBlob((b) => r(b!), "image/jpeg", 0.92));
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
