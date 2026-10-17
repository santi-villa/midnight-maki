/**
 * The cloud as the game sees it: who is signed in, how the last sync went, and the sync itself.
 * Everything is optional: with no Firebase config the game plays exactly as before.
 */
import { bus } from '../core/events';
import { game } from '../core/state';
import { reportError } from '../core/errors';
import { SLOT_COUNT, activeSlot, applyCloudSlot, setSaveObserver, slotForCloud } from '../persistence/storage';
import type { SaveData } from '../core/types';
import { decideSync, type SyncMarks } from './decide';
import { CloudError, type CloudProvider, type CloudUser } from './types';

export interface CloudStatus {
  /** the app was built with a Firebase config */
  configured: boolean;
  /** the stored session has been checked */
  ready: boolean;
  user: CloudUser | null;
  syncing: boolean;
  lastSync: number | null;
  error: string | null;
}

export interface ConflictInfo { slot: number; local: SaveData; remote: SaveData }
export type ConflictChoice = 'local' | 'remote' | 'skip';
export interface SyncSummary { pushed: number; pulled: number; skipped: number; /** the slot being played came down from the cloud: restart to use it */ reload: boolean }

const MARKS_KEY = 'mm_cloud_marks';
const SYNC_KEY = 'mm_cloud_last';

let provider: CloudProvider | null = null;
let state: CloudStatus = { configured: false, ready: false, user: null, syncing: false, lastSync: null, error: null };
let starting: Promise<void> | null = null;
let resolver: ((c: ConflictInfo) => Promise<ConflictChoice>) | undefined;
let onSynced: ((s: SyncSummary, auto: boolean) => void) | undefined;
/** The account screen plugs the "which one do you keep?" question in here, so this file stays free of UI. */
export function setCloudUi(ui: { resolve: (c: ConflictInfo) => Promise<ConflictChoice>; synced: (s: SyncSummary, auto: boolean) => void }) { resolver = ui.resolve; onSynced = ui.synced; }
const remoteAt = new Map<number, number>();
const timers = new Map<number, number>();

function emit() { bus.emit('cloud:changed', {}); }
function patch(p: Partial<CloudStatus>) { state = { ...state, ...p }; emit(); }

function readMarks(uid: string): Record<string, SyncMarks> {
  try { return JSON.parse(localStorage.getItem(`${MARKS_KEY}:${uid}`) ?? '{}'); } catch { return {}; }
}
function writeMark(uid: string, slot: number, m: SyncMarks) {
  try { const all = readMarks(uid); all[String(slot)] = m; localStorage.setItem(`${MARKS_KEY}:${uid}`, JSON.stringify(all)); } catch { /* the next sync decides again */ }
}
const newest = (d: { auto: SaveData | null; manual: SaveData | null }): number | null => {
  const a = d.auto?.updatedAt ?? null, m = d.manual?.updatedAt ?? null;
  return a == null ? m : m == null ? a : Math.max(a, m);
};

export const cloud = {
  status: (): CloudStatus => state,

  /** Call once at start. Does nothing (and loads no Firebase code) without a config. */
  start(): Promise<void> {
    if (starting) return starting;
    starting = (async () => {
      try {
        const { firebaseConfigFromEnv, createFirebaseProvider } = await import('./firebase');
        const cfg = firebaseConfigFromEnv();
        if (!cfg) { patch({ configured: false, ready: true }); return; }
        provider = createFirebaseProvider(cfg);
        state = { ...state, configured: true };
        const last = Number(localStorage.getItem(SYNC_KEY));
        if (Number.isFinite(last) && last > 0) state.lastSync = last;
        await provider.init((user) => { patch({ user, ready: true, error: null }); if (user) { void cloud.sync(resolver).then((sum) => onSynced?.(sum, true)).catch(() => undefined); void publishCard(); } });
        setSaveObserver((slot) => cloud.queuePush(slot));
        patch({ ready: true });
      } catch (err) {
        reportError('cloud:start', err, false);
        patch({ ready: true, configured: false });
      }
    })();
    return starting;
  },

  async signInGoogle() { await run(() => need().signInGoogle()); },
  async signInEmail(email: string, password: string) { await run(() => need().signInEmail(email, password)); },
  async signUpEmail(email: string, password: string, name: string) { await run(() => need().signUpEmail(email, password, name)); },
  async resetPassword(email: string) { await need().resetPassword(email); },
  async signOut() { await need().signOut(); remoteAt.clear(); patch({ user: null, lastSync: null }); },
  async deleteAccount() {
    const uid = state.user?.uid;
    await need().deleteAccount();
    if (uid) { try { localStorage.removeItem(`${MARKS_KEY}:${uid}`); } catch { /* ignore */ } }
    patch({ user: null, lastSync: null });
  },

  /** Sync after a save: one upload a few seconds later, never a burst. */
  queuePush(slot: number) {
    if (!provider || !state.user) return;
    window.clearTimeout(timers.get(slot));
    timers.set(slot, window.setTimeout(() => { void cloud.pushSlot(slot).catch(() => undefined); void publishCard(); }, 8000));
  },

  async pushSlot(slot: number) {
    const user = state.user;
    if (!provider || !user) return;
    // only overwrite the cloud if it has not changed on its own since this device last saw it
    const known = remoteAt.get(slot);
    const remote = known === undefined ? await provider.getSlot(slot) : null;
    const rAt = known ?? (remote ? newest(remote) : null);
    const marks = readMarks(user.uid)[String(slot)] ?? { local: 0, remote: 0 };
    const mine = await slotForCloud(slot);
    const lAt = newest(mine);
    if (lAt == null) return;
    if (decideSync(lAt, rAt, marks) === 'conflict' || (rAt != null && rAt > marks.remote && lAt <= marks.local)) return; // let the next full sync ask the player
    patch({ syncing: true });
    try {
      const at = await provider.putSlot(slot, mine);
      remoteAt.set(slot, at);
      writeMark(user.uid, slot, { local: lAt, remote: at });
      markSynced();
    } catch (err) { patch({ error: msg(err) }); throw err; }
    finally { patch({ syncing: false }); }
  },

  /** Compare every slot with the cloud. Conflicts go to `resolve`; nothing is overwritten unasked. */
  async sync(resolve?: (c: ConflictInfo) => Promise<ConflictChoice>): Promise<SyncSummary> {
    const user = state.user;
    const sum: SyncSummary = { pushed: 0, pulled: 0, skipped: 0, reload: false };
    if (!provider || !user) return sum;
    patch({ syncing: true, error: null });
    try {
      for (let slot = 0; slot < SLOT_COUNT; slot++) {
        const mine = await slotForCloud(slot);
        const theirs = await provider.getSlot(slot);
        const lAt = newest(mine), rAt = theirs ? newest(theirs) : null;
        if (rAt != null) remoteAt.set(slot, rAt);
        const marks = readMarks(user.uid)[String(slot)] ?? { local: 0, remote: 0 };
        let act = decideSync(lAt, rAt, marks);
        if (act === 'conflict') {
          const a = mine.auto ?? mine.manual, b = theirs?.auto ?? theirs?.manual;
          const choice: ConflictChoice = resolve && a && b ? await resolve({ slot, local: a, remote: b }) : 'skip';
          act = choice === 'local' ? 'push' : choice === 'remote' ? 'pull' : 'none';
          if (choice === 'skip') sum.skipped++;
        }
        if (act === 'push') {
          const at = await provider.putSlot(slot, mine);
          remoteAt.set(slot, at); writeMark(user.uid, slot, { local: lAt ?? 0, remote: at }); sum.pushed++;
        } else if (act === 'pull' && theirs) {
          if (await applyCloudSlot(slot, theirs)) {
            writeMark(user.uid, slot, { local: rAt ?? 0, remote: rAt ?? 0 }); sum.pulled++;
            if (slot === activeSlot() && game.loaded) sum.reload = true;
          }
        } else if (act === 'none' && lAt != null && rAt != null && lAt === rAt) writeMark(user.uid, slot, { local: lAt, remote: rAt });
      }
      markSynced();
    } catch (err) { patch({ error: msg(err) }); throw err; }
    finally { patch({ syncing: false }); }
    return sum;
  },
};

/** Keep the public restaurant card fresh. Its own failures never matter to the save. */
function publishCard() { return import('./social').then((m) => m.social.publishProfile()).catch(() => undefined); }

function need(): CloudProvider {
  if (!provider) throw new CloudError('La nube todavía no está disponible.');
  return provider;
}
async function run(fn: () => Promise<void>) {
  patch({ error: null });
  try { await fn(); } catch (err) { patch({ error: msg(err) }); throw err; }
}
function msg(err: unknown): string { return err instanceof CloudError ? err.message : 'No se pudo sincronizar. Probá de nuevo en un rato.'; }
function markSynced() {
  const now = Date.now();
  try { localStorage.setItem(SYNC_KEY, String(now)); } catch { /* ignore */ }
  patch({ lastSync: now });
}
