/** Pure rules for syncing a slot with the cloud. No DOM, no Firebase: easy to test. */

export interface SyncMarks {
  /** local updatedAt at the last successful sync, 0 if never */
  local: number;
  /** remote updatedAt at the last successful sync, 0 if never */
  remote: number;
}

export type SyncAction = 'none' | 'push' | 'pull' | 'conflict';

/**
 * `local` and `remote` are the updatedAt of the newest snapshot on each side (null = nothing there).
 * Both sides changed since the last sync: that is a conflict. The cloud copy is the one that stays.
 */
export function decideSync(local: number | null, remote: number | null, marks: SyncMarks): SyncAction {
  if (local == null && remote == null) return 'none';
  if (remote == null) return 'push';
  if (local == null) return 'pull';
  if (local === remote) return 'none';
  const localChanged = local > marks.local;
  const remoteChanged = remote > marks.remote;
  if (localChanged && !remoteChanged) return 'push';
  if (remoteChanged && !localChanged) return 'pull';
  return 'conflict';
}

/** Short text for the account panel: "hace 5 min", "hace 2 h", "ayer"... */
export function ago(now: number, then: number): string {
  const s = Math.max(0, Math.round((now - then) / 1000));
  if (s < 45) return 'recién';
  if (s < 3600) return `hace ${Math.max(1, Math.round(s / 60))} min`;
  if (s < 86400) return `hace ${Math.round(s / 3600)} h`;
  const d = Math.round(s / 86400);
  return d === 1 ? 'ayer' : `hace ${d} días`;
}
