import { buildPortrait, type Expr } from '../art/characters';
import { buildFolkPortrait, type FolkCustom } from '../art/folk';
import { heroPortrait, isHeroLook } from '../art/heroRender';
import { CLOTHES_BY_ID } from '../data/clothes';
import { FOLK_SPECS } from '../data/folkSpecs';
import { game } from '../core/state';
import type { Appearance } from '../core/types';
import { CHAR_BY_ID } from '../data/characters';
import spicyPortrait from '../assets/portraits/spicy.png';
import riggPortrait from '../assets/portraits/rigg.png';
import pipPortrait from '../assets/portraits/pip.png';

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

/** Hat / body item the player chose in the raccoons' wardrobe (when it differs from their own look). */
export function folkCustom(id: string): FolkCustom | undefined {
  const spec = FOLK_SPECS[id];
  const o = game.save.raccoonOutfits[id];
  const def = CHAR_BY_ID[id];
  if (!spec || !o || !def) return undefined;
  const pick = (cid: string) => {
    const d = cid ? CLOTHES_BY_ID[cid] : undefined;
    return d ? { kind: d.kind, c1: d.c1, c2: d.c2 ?? d.c1 } : undefined;
  };
  const custom: FolkCustom = {};
  if (o.head !== def.appearance.head) custom.head = pick(o.head) ?? { kind: 'none', c1: '#000', c2: '#000' };
  if (o.extra !== def.appearance.extra) custom.extra = pick(o.extra) ?? { kind: 'none', c1: '#000', c2: '#000' };
  return custom.head || custom.extra ? custom : undefined;
}

/** Stable key that changes whenever the look changes (for texture caching). */
export function appearanceKey(id: string): string {
  return id + ':' + JSON.stringify(appearanceOf(id));
}

/** Illustrated portraits (the raccoons' reference art) take precedence over generated ones. */
const ILLUSTRATED: Record<string, string> = { spicy: spicyPortrait, rigg: riggPortrait, pip: pipPortrait };

const portraitCache = new Map<string, string>();
export function portraitURL(id: string, expr: Expr = 'neutral'): string {
  const folk = FOLK_SPECS[id];
  if (!folk && ILLUSTRATED[id]) return ILLUSTRATED[id];
  const key = appearanceKey(id) + '|' + expr;
  let url = portraitCache.get(key);
  if (!url) {
    const a = appearanceOf(id);
    url = (folk ? buildFolkPortrait(folk, expr, 5, folkCustom(id)) : id === 'player' && isHeroLook(a) ? heroPortrait(a, expr) : buildPortrait(a, expr, dropOf(id))).toDataURL();
    portraitCache.set(key, url);
  }
  return url;
}

export function displayName(id: string): string {
  if (id === 'player') return game.save.player.name;
  return CHAR_BY_ID[id]?.name ?? '';
}
