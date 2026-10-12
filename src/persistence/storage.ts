/** IndexedDB persistence with a rolling backup, export/import and a localStorage fallback. */
import { game } from '../core/state';
import type { SaveData, Settings } from '../core/types';
import { SaveError, validateSave } from './validate';

const DB_NAME = 'midnight-maki';
const STORE = 'saves';
const MAIN = 'main';
const BACKUP = 'backup';

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

async function idbGet(key: string): Promise<unknown> {
  const db = await openDb();
  if (!db) {
    const raw = localStorage.getItem('mm_' + key);
    return raw ? JSON.parse(raw) : undefined;
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const r = tx.objectStore(STORE).get(key);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

async function idbPut(key: string, value: unknown): Promise<void> {
  const db = await openDb();
  if (!db) {
    localStorage.setItem('mm_' + key, JSON.stringify(value));
    return;
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbDelete(key: string): Promise<void> {
  const db = await openDb();
  if (!db) {
    localStorage.removeItem('mm_' + key);
    return;
  }
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

export async function hasSave(): Promise<boolean> {
  try {
    return !!(await idbGet(MAIN));
  } catch {
    return false;
  }
}

export async function loadGame(): Promise<SaveData | null> {
  for (const key of [MAIN, BACKUP]) {
    try {
      const raw = await idbGet(key);
      if (!raw) continue;
      return validateSave(structuredClone(raw));
    } catch (err) {
      console.warn('[save] slot unreadable', key, err);
    }
  }
  return null;
}

let saving: Promise<void> | null = null;
let lastBackup = 0;

/** Writes the current state. Validates a deep copy first so a corrupt state is never persisted. */
export async function saveGame(reason = 'auto'): Promise<boolean> {
  if (!game.loaded) return false;
  if (saving) await saving;
  const snapshot = JSON.parse(JSON.stringify(game.save));
  try {
    validateSave(snapshot);
  } catch (err) {
    console.error('[save] refusing to write invalid state', err);
    return false;
  }
  saving = (async () => {
    try {
      // keep a backup of the previous good save every few minutes
      if (Date.now() - lastBackup > 120_000) {
        const prev = await idbGet(MAIN);
        if (prev) await idbPut(BACKUP, prev);
        lastBackup = Date.now();
      }
      await idbPut(MAIN, snapshot);
      game.dirty = false;
    } catch (err) {
      console.error('[save] write failed', reason, err);
    }
  })();
  await saving;
  saving = null;
  return true;
}

export async function deleteSave() {
  await idbDelete(MAIN);
  await idbDelete(BACKUP);
}

export function exportSave(): void {
  const data = JSON.stringify({ ...game.save, exportedAt: Date.now() }, null, 1);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const name = game.save.player.name.replace(/[^\w-]+/g, '') || 'partida';
  a.href = url;
  a.download = `midnight-maki-${name}-dia${game.save.time.day}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function importSaveFile(file: File): Promise<SaveData> {
  return new Promise((resolve, reject) => {
    if (file.size > 8 * 1024 * 1024) return reject(new SaveError('El archivo es demasiado grande.'));
    const fr = new FileReader();
    fr.onload = () => {
      try {
        resolve(validateSave(JSON.parse(String(fr.result))));
      } catch (err) {
        reject(err instanceof SaveError ? err : new SaveError('No se pudo leer el archivo.'));
      }
    };
    fr.onerror = () => reject(new SaveError('No se pudo leer el archivo.'));
    fr.readAsText(file);
  });
}

// ------------------------------------------------------------------ settings (small, localStorage)
export const DEFAULT_SETTINGS: Settings = {
  music: 0.5,
  ambience: 0.5,
  sfx: 0.7,
  textScale: 1,
  textSpeed: 45,
  reduceMotion: false,
  joystick: false,
  cookMode: 'relaxed',
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem('mm_settings');
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_SETTINGS };
}

export function storeSettings(s: Settings) {
  try {
    localStorage.setItem('mm_settings', JSON.stringify(s));
  } catch {
    /* ignore quota errors */
  }
}
