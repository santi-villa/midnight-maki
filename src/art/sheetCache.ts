/**
 * Character sheets are painted in code (hundreds of milliseconds each). The painted sheets are kept in IndexedDB, so the
 * next time the same build opens, starting a game only decodes pictures. Keyed by texture key (which already encodes the
 * look) and invalidated by every new build. Off in the dev server, where the art code changes under a running build.
 */
import { APP_BUILT, APP_COMMIT } from '../core/version';

export interface SheetMeta { fw: number; fh: number; pad?: number; sideSit?: boolean }
interface Entry { key: string; build: string; meta: SheetMeta; blob: Blob }

const DB = 'mm-sheets', STORE = 'sheets';
const BUILD = `${APP_COMMIT}|${APP_BUILT}`;
const enabled = typeof indexedDB !== 'undefined' && !import.meta.env.DEV && !!APP_BUILT;
const mem = new Map<string, { canvas: HTMLCanvasElement; meta: SheetMeta }>();
let db: Promise<IDBDatabase | null> | null = null;

function open(): Promise<IDBDatabase | null> {
  if (!enabled) return Promise.resolve(null);
  return (db ??= new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'key' });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch { resolve(null); }
  }));
}

/** Reads every sheet of this build into memory (stale builds are dropped). Never throws: a miss just paints again. */
let loading: Promise<number> | null = null;
export function loadSheetCache(): Promise<number> {
  return (loading ??= readAll());
}
async function readAll(): Promise<number> {
  const d = await open();
  if (!d) return 0;
  try {
    const all = await new Promise<Entry[]>((resolve, reject) => {
      const req = d.transaction(STORE, 'readonly').objectStore(STORE).getAll();
      req.onsuccess = () => resolve(req.result as Entry[]);
      req.onerror = () => reject(req.error);
    });
    const stale = all.filter((e) => e.build !== BUILD).map((e) => e.key);
    if (stale.length) {
      const st = d.transaction(STORE, 'readwrite').objectStore(STORE);
      for (const k of stale) st.delete(k);
    }
    await Promise.all(all.filter((e) => e.build === BUILD).map(async (e) => {
      const bmp = await createImageBitmap(e.blob);
      const c = document.createElement('canvas');
      c.width = bmp.width; c.height = bmp.height;
      c.getContext('2d')!.drawImage(bmp, 0, 0);
      bmp.close();
      mem.set(e.key, { canvas: c, meta: e.meta });
    }));
  } catch { /* a broken cache only costs the painting time */ }
  return mem.size;
}

/** The painted sheet for this key, when an earlier visit kept it. */
export function cachedSheet(key: string) {
  return mem.get(key) ?? null;
}

/** Keeps a freshly painted sheet for the next visit (in the background). */
export function storeSheet(key: string, canvas: HTMLCanvasElement, meta: SheetMeta) {
  if (!enabled || mem.has(key)) return;
  mem.set(key, { canvas, meta });
  canvas.toBlob((blob) => {
    if (!blob) return;
    void open().then((d) => {
      if (!d) return;
      try { d.transaction(STORE, 'readwrite').objectStore(STORE).put({ key, build: BUILD, meta, blob } satisfies Entry); } catch { /* full or blocked: fine */ }
    });
  }, 'image/png');
}
