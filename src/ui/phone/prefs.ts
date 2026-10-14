/** The player's phone: model, colour, wallpaper, what is unlocked and what was already seen. Lives in `save.phone`. */
import { bus } from '../../core/events';
import { game } from '../../core/state';
import type { PhonePrefs } from '../../core/types';
import { projectsDoneTotal } from '../../restaurant/projects';
import { DEFAULT_PHONE, ITEMS, itemOf, ruleMet, type PhoneKind, type UnlockCtx } from './catalog';

export function unlockCtx(): UnlockCtx {
  return {
    level: game.save.restaurant.level,
    has: (f) => game.has(f),
    friend: (id) => game.friendLevel(id),
    projectPhases: projectsDoneTotal(),
    achievement: (id) => game.save.achievements.includes(id),
  };
}

export function phonePrefs(): PhonePrefs {
  const s = game.save;
  const p: any = s.phone;
  if (!p || typeof p !== 'object') s.phone = { ...DEFAULT_PHONE, unlocked: [], seen: {} };
  else { // saves from a backup or an older build: keep what is valid, fall back to the defaults for the rest
    if (!Array.isArray(p.unlocked)) p.unlocked = [];
    else p.unlocked = p.unlocked.filter((x: unknown) => typeof x === 'string');
    if (!p.seen || typeof p.seen !== 'object') p.seen = {};
    for (const k of ['model', 'color', 'wallpaper'] as const) if (!itemOf(k, p[k])) p[k] = DEFAULT_PHONE[k];
  }
  return s.phone!;
}

const key = (kind: PhoneKind, id: string) => `${kind}:${id}`;

export function isUnlocked(kind: PhoneKind, id: string): boolean {
  const it = itemOf(kind, id);
  if (!it) return false;
  return !it.unlock || phonePrefs().unlocked.includes(key(kind, id)) || ruleMet(kind, id, unlockCtx());
}

/** Records what the rules now allow. Returns the names that are new, so the caller can say so. */
export function refreshUnlocks(): string[] {
  const p = phonePrefs();
  const fresh: string[] = [];
  const ctx = unlockCtx();
  for (const kind of Object.keys(ITEMS) as PhoneKind[])
    for (const it of ITEMS[kind]) {
      if (!it.unlock || p.unlocked.includes(key(kind, it.id)) || !it.unlock.test(ctx)) continue;
      p.unlocked.push(key(kind, it.id));
      fresh.push(it.name);
    }
  if (fresh.length) game.touch('phone');
  return fresh;
}

/** Unlocked designs the player has not looked at yet (badge on "Personalizar"). */
export function unseenDesigns(): number {
  const p = phonePrefs();
  return p.unlocked.filter((k) => !(p.seen.designs ?? []).includes(k)).length;
}

export function markDesignsSeen() {
  const p = phonePrefs();
  p.seen.designs = [...p.unlocked];
  game.touch('phone');
}

/** Saves a choice. Locked options are refused, and a bad id never reaches the save. */
export function choose(kind: PhoneKind, id: string): boolean {
  if (!itemOf(kind, id) || !isUnlocked(kind, id)) return false;
  phonePrefs()[kind] = id;
  game.touch('phone');
  bus.emit('phone:changed', {});
  return true;
}

/** Counters used for the little "new" dots on the home screen. */
export function noveltyCounts(): { recipes: number; quests: number; designs: number } {
  const s = game.save;
  return { recipes: s.recipesKnown.length, quests: Object.keys(s.quests.active).length + s.quests.done.length, designs: unseenDesigns() };
}
