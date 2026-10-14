/** IndexedDB persistence with a rolling backup, export/import and a localStorage fallback. */
import { game } from '../core/state';
import { reportError } from '../core/errors';
import { sanitizeBindings } from '../input/bindings';
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
      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => { db.close(); dbPromise = null; };
        db.onclose = () => { dbPromise = null; };
        resolve(db);
      };
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
    tx.onerror = tx.onabort = () => reject(tx.error ?? new DOMException('Transaction aborted', 'AbortError'));
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
      reportError('save:load:' + key, err, false);
    }
  }
  return null;
}

let writes: Promise<unknown> = Promise.resolve();
let lastBackup = 0;
const SAVE_NOTICE = 'No se pudo guardar. Tu progreso sigue en esta sesión; reintentá o exportá una copia antes de salir.';

/** Capture at the call, then serialize writes. Only a completed transaction counts as saved. */
export async function saveGame(reason = 'auto'): Promise<boolean> {
  if (!game.loaded) return false;
  const source = game.save;
  const revision = game.revision;
  let snapshot: SaveData;
  try {
    snapshot = validateSave(JSON.parse(JSON.stringify(source)));
  } catch (err) {
    reportError('save:snapshot', err, SAVE_NOTICE);
    return false;
  }
  const write = writes.then(async () => {
    try {
      // Rotate only a validated previous save. Never replace a good backup with corrupt data.
      if (Date.now() - lastBackup > 120_000) {
        let prev: unknown;
        try { prev = await idbGet(MAIN); }
        catch (err) { reportError('save:backup-read', err, false); }
        if (prev) {
          let backup: SaveData | undefined;
          try { backup = validateSave(structuredClone(prev)); }
          catch (err) { reportError('save:backup-invalid', err, false); }
          if (backup) await idbPut(BACKUP, backup);
        }
        lastBackup = Date.now();
      }
      await idbPut(MAIN, snapshot);
      if (game.save === source && game.revision === revision) game.dirty = false;
      return true;
    } catch (err) {
      reportError('save:write:' + reason, err, SAVE_NOTICE);
      return false;
    }
  });
  writes = write;
  return write;
}

export async function deleteSave() {
  await idbDelete(MAIN);
  await idbDelete(BACKUP);
}

function exportName() {
  const name = game.save.player.name.replace(/[^\w-]+/g, '') || 'partida';
  return `midnight-maki-${name}-dia${game.save.time.day}.json`;
}

function markBackup() {
  try {
    localStorage.setItem('mm_last_backup', String(Date.now()));
  } catch {
    /* ignore */
  }
}

/** Days since the player last exported/shared/copied a backup (Infinity if never). */
export function daysSinceBackup(): number {
  try {
    const t = Number(localStorage.getItem('mm_last_backup'));
    return t ? (Date.now() - t) / 86400000 : Infinity;
  } catch {
    return Infinity;
  }
}

/** Asks the browser not to evict our data under storage pressure (best effort). */
export async function requestPersistence(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}

/** Phone-friendly backup: opens the share sheet (WhatsApp, Drive, mail...) with the save file. */
export async function shareSave(): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const data = JSON.stringify({ ...game.save, exportedAt: Date.now() });
  const file = new File([data], exportName(), { type: 'application/json' });
  const nav = navigator as any;
  if (nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: 'Midnight Maki: copia de mi partida', text: 'Copia de seguridad de mi partida de Midnight Maki.' });
      markBackup();
      return 'shared';
    } catch {
      return 'cancelled';
    }
  }
  exportSave();
  return 'downloaded';
}

/** Compact text code of the save (base64 of the JSON), handy to paste in a chat or notes. */
export function saveCode(): string {
  const json = JSON.stringify(game.save);
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  markBackup();
  return 'MM1:' + btoa(bin);
}

export function saveFromCode(code: string): SaveData {
  const raw = code.trim().replace(/^MM1:/, '');
  try {
    const bin = atob(raw);
    const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
    return validateSave(JSON.parse(new TextDecoder().decode(bytes)));
  } catch (err) {
    throw err instanceof SaveError ? err : new SaveError('El código no es válido. Copialo completo.');
  }
}

export function exportSave(): void {
  markBackup();
  const data = JSON.stringify({ ...game.save, exportedAt: Date.now() }, null, 1);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = exportName();
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
  haptics: false,
  joystick: true,
  guide: true,
  perf: 'auto',
  cookMode: 'relaxed',
  settingsVersion: 2,
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem('mm_settings');
    if (raw) {
      const saved = JSON.parse(raw);
      // v2: the virtual joystick is on by default (older saves stored it switched off)
      if (!saved.settingsVersion || saved.settingsVersion < 2) Object.assign(saved, { joystick: true, settingsVersion: 2 });
      return { ...DEFAULT_SETTINGS, ...saved, haptics: saved.haptics === true, bindings: sanitizeBindings(saved.bindings) };
    }
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
