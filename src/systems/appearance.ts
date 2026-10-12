import { buildPortrait, type Expr } from '../art/characters';
import { game } from '../core/state';
import type { Appearance } from '../core/types';
import { CHAR_BY_ID } from '../data/characters';

/** Current appearance of any character, including raccoon outfit customizations. */
export function appearanceOf(id: string): Appearance {
  if (id === 'player') return game.save.player.appearance;
  const def = CHAR_BY_ID[id];
  if (!def) return game.save.player.appearance;
  const o = game.save.raccoonOutfits[id];
  if (!o) return def.appearance;
  return { ...def.appearance, head: o.head ?? def.appearance.head, extra: o.extra ?? def.appearance.extra };
}

export function dropOf(id: string): number[] {
  return CHAR_BY_ID[id]?.drop ?? [];
}

/** Stable key that changes whenever the look changes (for texture caching). */
export function appearanceKey(id: string): string {
  return id + ':' + JSON.stringify(appearanceOf(id));
}

const portraitCache = new Map<string, string>();
export function portraitURL(id: string, expr: Expr = 'neutral'): string {
  const key = appearanceKey(id) + '|' + expr;
  let url = portraitCache.get(key);
  if (!url) {
    url = buildPortrait(appearanceOf(id), expr, dropOf(id)).toDataURL();
    portraitCache.set(key, url);
  }
  return url;
}

export function displayName(id: string): string {
  if (id === 'player') return game.save.player.name;
  return CHAR_BY_ID[id]?.name ?? '';
}
