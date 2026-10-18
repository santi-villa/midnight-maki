/** IndexedDB persistence: 3 slots, each with an automatic save, a rolling backup and a manual checkpoint. */
import { game } from '../core/state';
import { reportError } from '../core/errors';
import { sanitizeBindings } from '../input/bindings';
import type { SaveData, Settings } from '../core/types';
import { SaveError, validateSave } from './validate';

const DB_NAME = 'midnight-maki';
const STORE = 'saves';
/** Pre-slot keys. Slot 0 still reads them when its own automatic save is missing. */
const LEGACY_MAIN = 'main';
const LEGACY_BACKUP = 'backup';
const ACTIVE_KEY = 'mm_active_slot';
const RESUME_KEY = 'mm_resume_once';

export const SLOT_COUNT = 3;

/** Something outside (the cloud) wants to know when a slot was written. Kept as a plain callback so storage imports nothing from it. */
/** While she visits a friend's restaurant her runtime save holds borrowed data: nothing may be written until it is put back. */
let saveBlocked = false;
export function setSaveBlocked(v: boolean) { saveBlocked = v; }
export const saveIsBlocked = () => saveBlocked;

let saveObserver: ((slot: number) => void) | null = null;
export function setSaveObserver(fn: ((slot: number) => void) | null) { saveObserver = fn; }
const told = (slot: number) => { try { saveObserver?.(slot); } catch { /* sync is never allowed to break a save */ } };
export type SaveKind = 'auto' | 'manual' | 'latest';
export type SavePart = 'auto' | 'backup' | 'manual';

export interface SaveBrief {
  kind: 'auto' | 'manual';
  updatedAt: number;
  name: string;
  restaurant: string;
  day: number;
  period: number;
  minutes: number;
  coins: number;
}

export interface SlotInfo {
  slot: number;
  auto: SaveBrief | null;
  manual: SaveBrief | null;
}

export interface ContinueTarget {
  slot: number;
  kind: 'auto' | 'manual';
  data: SaveData;
}

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

function normalizeSlot(slot: number): number {
  const n = Math.floor(Number(slot));
  return n === 1 || n === 2 ? n : 0;
}

function slotKey(slot: number, part: SavePart): string {
  return `s${slot}-${part}`;
}

/** Which playthrough autosave writes. Defaults to the first slot. */
export function activeSlot(): number {
  try {
    return normalizeSlot(Number(localStorage.getItem(ACTIVE_KEY)));
  } catch {
    return 0;
  }
}

export function setActiveSlot(slot: number): void {
  try {
    localStorage.setItem(ACTIVE_KEY, String(normalizeSlot(slot)));
  } catch {
    /* the next save still lands on the default slot */
  }
}

/** After a reload, the title should walk straight back into the snapshot just chosen. */
export function markResumeOnce(): void {
  try {
    sessionStorage.setItem(RESUME_KEY, '1');
  } catch {
    /* Continuar still loads the snapshot that was just prepared */
  }
}

export function takeResumeOnce(): boolean {
  try {
    if (sessionStorage.getItem(RESUME_KEY) !== '1') return false;
    sessionStorage.removeItem(RESUME_KEY);
    return true;
  } catch {
    return false;
  }
}

function autoKeys(slot: number): string[] {
  // The rolling backup stays ahead of a pre-slot copy, so a broken new save
  // does not resurrect the original playthrough while a newer backup exists.
  const keys = [slotKey(slot, 'auto'), slotKey(slot, 'backup')];
  if (slot === 0) keys.push(LEGACY_MAIN, LEGACY_BACKUP);
  return keys;
}

async function readValid(key: string): Promise<SaveData | null> {
  try {
    const raw = await idbGet(key);
    if (!raw) return null;
    return validateSave(structuredClone(raw));
  } catch (err) {
    reportError('save:load:' + key, err, false);
    return null;
  }
}

async function readFirst(keys: string[]): Promise<SaveData | null> {
  for (const key of keys) {
    const data = await readValid(key);
    if (data) return data;
  }
  return null;
}

function briefOf(data: SaveData, kind: 'auto' | 'manual'): SaveBrief {
  return {
    kind,
    updatedAt: Number.isFinite(data.updatedAt) ? data.updatedAt : 0,
    name: data.player?.name || 'Sin nombre',
    restaurant: data.player?.restaurantName || '',
    day: data.time?.day || 1,
    period: data.time?.period || 0,
    minutes: data.time?.minutes || 0,
    coins: data.coins || 0,
  };
}

/** One row per slot. `auto` is whatever loading the automatic choice would resume, backup included. */
export async function listSlots(): Promise<SlotInfo[]> {
  const out: SlotInfo[] = [];
  for (let slot = 0; slot < SLOT_COUNT; slot++) {
    const auto = await loadGame(slot, 'auto');
    const manual = await loadGame(slot, 'manual');
    out.push({
      slot,
      auto: auto ? briefOf(auto, 'auto') : null,
      manual: manual ? briefOf(manual, 'manual') : null,
    });
  }
  return out;
}

export async function hasSave(): Promise<boolean> {
  if ((await listSlots()).some((s) => s.auto || s.manual)) return true;
  const keys = [LEGACY_MAIN, LEGACY_BACKUP];
  for (let slot = 0; slot < SLOT_COUNT; slot++) keys.push(slotKey(slot, 'auto'), slotKey(slot, 'backup'), slotKey(slot, 'manual'));
  for (const key of keys) {
    try {
      if (await idbGet(key)) return true;
    } catch {
      return true;
    }
  }
  return false;
}

/**
 * `auto` walks the slot's automatic save, then its rolling backup, then (slot 0) the legacy keys.
 * `manual` is only the checkpoint the player asked for.
 * `latest` prefers that automatic chain, then the manual checkpoint.
 * No arguments keep the active slot, which tests and Continuar rely on.
 */
export async function loadGame(slot = activeSlot(), kind: SaveKind = 'latest'): Promise<SaveData | null> {
  const n = normalizeSlot(slot);
  if (kind === 'manual') return readValid(slotKey(n, 'manual'));
  const auto = await readFirst(autoKeys(n));
  if (kind === 'auto' || auto) return auto;
  return readValid(slotKey(n, 'manual'));
}

/** Active slot first. If that slot is empty, the newest snapshot of any other slot. */
export async function continueTarget(): Promise<ContinueTarget | null> {
  const active = activeSlot();
  const auto = await loadGame(active, 'auto');
  if (auto) return { slot: active, kind: 'auto', data: auto };
  const manual = await loadGame(active, 'manual');
  if (manual) return { slot: active, kind: 'manual', data: manual };
  let best: { slot: number; kind: 'auto' | 'manual'; at: number } | null = null;
  for (const info of await listSlots()) {
    if (info.slot === active) continue;
    for (const brief of [info.auto, info.manual]) {
      if (!brief) continue;
      if (!best || brief.updatedAt > best.at) best = { slot: info.slot, kind: brief.kind, at: brief.updatedAt };
    }
  }
  if (!best) return null;
  const data = await loadGame(best.slot, best.kind);
  return data ? { slot: best.slot, kind: best.kind, data } : null;
}

let writes: Promise<unknown> = Promise.resolve();
const lastBackup = new Map<number, number>();
const SAVE_NOTICE = 'No se pudo guardar. Tu progreso sigue en esta sesión; reintentá o exportá una copia antes de salir.';

function enqueue<T>(job: () => Promise<T>): Promise<T> {
  const run = writes.then(job, job);
  writes = run.then(() => undefined, () => undefined);
  return run;
}

function snapshotSave(source: SaveData): SaveData | null {
  try {
    return validateSave(JSON.parse(JSON.stringify(source)));
  } catch (err) {
    reportError('save:snapshot', err, SAVE_NOTICE);
    return null;
  }
}

function sameMoment(a: SaveData, b: SaveData): boolean {
  return a.updatedAt === b.updatedAt
    && a.coins === b.coins
    && a.player.name === b.player.name
    && a.time.day === b.time.day
    && a.time.period === b.time.period
    && a.time.minutes === b.time.minutes;
}

async function removeKey(key: string): Promise<void> {
  try {
    await idbDelete(key);
  } catch (err) {
    reportError('save:delete:' + key, err, false);
  }
}

async function rotateBackup(slot: number): Promise<void> {
  if (Date.now() - (lastBackup.get(slot) ?? 0) <= 120_000) return;
  const prev = await readFirst(autoKeys(slot));
  if (prev) await idbPut(slotKey(slot, 'backup'), prev);
  lastBackup.set(slot, Date.now());
}

/** Capture at the call, then serialize writes. Only a completed transaction counts as saved. */
export async function saveGame(reason = 'auto'): Promise<boolean> {
  if (!game.loaded) return false;
  if (saveBlocked) return true; // nothing to write now; the real save is untouched and comes back after the visit
  const source = game.save;
  const revision = game.revision;
  const slot = activeSlot();
  const snapshot = snapshotSave(source);
  if (!snapshot) return false;
  return enqueue(async () => {
    try {
      // Rotate only a validated previous save, and only for this slot's own timer.
      await rotateBackup(slot);
      await idbPut(slotKey(slot, 'auto'), snapshot);
      if (game.save === source && game.revision === revision) game.dirty = false;
      told(slot);
      return true;
    } catch (err) {
      reportError('save:write:' + reason, err, SAVE_NOTICE);
      return false;
    }
  });
}

/**
 * One checkpoint written to the manual slot and the automatic slot.
 * Later autosaves update only the automatic side, so this point stays put.
 */
export async function saveManual(): Promise<boolean> {
  if (!game.loaded) return false;
  if (saveBlocked) { reportError('save:manual-blocked', new Error('coop'), 'No se puede guardar mientras visitás el restaurante de un amigo.'); return false; }
  const source = game.save;
  const revision = game.revision;
  const slot = activeSlot();
  const snapshot = snapshotSave(source);
  if (!snapshot) return false;
  return enqueue(async () => {
    try {
      await idbPut(slotKey(slot, 'auto'), snapshot);
      await idbPut(slotKey(slot, 'manual'), snapshot);
      if (game.save === source && game.revision === revision) game.dirty = false;
      told(slot);
      return true;
    } catch (err) {
      reportError('save:manual', err, SAVE_NOTICE);
      return false;
    }
  });
}

/** Make this snapshot the slot's automatic save. The manual checkpoint is left as it is. */
export async function adoptSnapshot(slot: number, data: SaveData): Promise<boolean> {
  const n = normalizeSlot(slot);
  const snapshot = snapshotSave(data);
  if (!snapshot) return false;
  return enqueue(async () => {
    try {
      const prev = await readFirst(autoKeys(n));
      if (prev && !sameMoment(prev, snapshot)) {
        await idbPut(slotKey(n, 'backup'), prev);
        lastBackup.set(n, Date.now());
      }
      await idbPut(slotKey(n, 'auto'), snapshot);
      setActiveSlot(n);
      return true;
    } catch (err) {
      reportError('save:adopt', err, SAVE_NOTICE);
      return false;
    }
  });
}

/** Replace a whole slot with an imported playthrough. The old manual checkpoint does not stay. */
export async function installSave(slot: number, data: SaveData): Promise<boolean> {
  const n = normalizeSlot(slot);
  const snapshot = snapshotSave(data);
  if (!snapshot) return false;
  return enqueue(async () => {
    try {
      await removeKey(slotKey(n, 'auto'));
      await removeKey(slotKey(n, 'backup'));
      await removeKey(slotKey(n, 'manual'));
      if (n === 0) {
        await removeKey(LEGACY_MAIN);
        await removeKey(LEGACY_BACKUP);
      }
      await idbPut(slotKey(n, 'auto'), snapshot);
      lastBackup.set(n, 0);
      setActiveSlot(n);
      return true;
    } catch (err) {
      reportError('save:install', err, SAVE_NOTICE);
      return false;
    }
  });
}

export async function clearManual(slot = activeSlot()): Promise<void> {
  const n = normalizeSlot(slot);
  await enqueue(async () => {
    await removeKey(slotKey(n, 'manual'));
  });
}

/** Wipe one playthrough, including a legacy copy hiding behind slot 0. */
export async function deleteSlot(slot: number): Promise<void> {
  const n = normalizeSlot(slot);
  await enqueue(async () => {
    await removeKey(slotKey(n, 'auto'));
    await removeKey(slotKey(n, 'backup'));
    await removeKey(slotKey(n, 'manual'));
    if (n === 0) {
      await removeKey(LEGACY_MAIN);
      await removeKey(LEGACY_BACKUP);
    }
  });
}

/** Test isolation: every slot, the legacy keys and the active-slot pointer. */
export async function deleteSave() {
  for (let slot = 0; slot < SLOT_COUNT; slot++) await deleteSlot(slot);
  lastBackup.clear();
  try {
    localStorage.removeItem(ACTIVE_KEY);
  } catch {
    /* ignore */
  }
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
  nightBrightness: 'normal',
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
      return { ...DEFAULT_SETTINGS, ...saved, nightBrightness: saved.nightBrightness === 'dark' ? 'dark' : 'normal', haptics: saved.haptics === true, bindings: sanitizeBindings(saved.bindings) };
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


// ------------------------------------------------------------------ cloud helpers
/** What a slot holds right now, for the cloud: its newest automatic save and its manual checkpoint. */
export async function slotForCloud(slot: number): Promise<{ auto: SaveData | null; manual: SaveData | null }> {
  const n = normalizeSlot(slot);
  return { auto: await loadGame(n, 'auto'), manual: await loadGame(n, 'manual') };
}

/** Write what came down from the cloud into a slot (validated). Does not touch the other slots. */
export async function applyCloudSlot(slot: number, remote: { auto: unknown | null; manual: unknown | null }): Promise<boolean> {
  const n = normalizeSlot(slot);
  try {
    const auto = remote.auto ? validateSave(structuredClone(remote.auto)) : null;
    const manual = remote.manual ? validateSave(structuredClone(remote.manual)) : null;
    if (!auto && !manual) return false;
    return await enqueue(async () => {
      if (auto) { const prev = await readFirst(autoKeys(n)); if (prev && !sameMoment(prev, auto)) await idbPut(slotKey(n, 'backup'), prev); await idbPut(slotKey(n, 'auto'), auto); }
      if (manual) await idbPut(slotKey(n, 'manual'), manual);
      return true;
    });
  } catch (err) {
    reportError('save:cloud-apply', err, 'La partida de la nube no se pudo leer.');
    return false;
  }
}
