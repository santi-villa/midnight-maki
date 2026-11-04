/** Adapt legacy appearances to the same renderer as the named villagers.
 * Identity, clothing and save data remain the source of truth.
 */
import type { Appearance } from '../core/types';
import { heroSpec } from './hero';
import { buildFolkSheet, type FolkSpec } from './folk';
import { shade } from './pixel';

export function neighborSpec(a: Appearance): FolkSpec {
  const base = heroSpec(a);
  if (a.species === 'human') return base;
  const ears: Record<string, FolkSpec['ears']> = { cat: 'cat', fox: 'pointy', bunny: 'long', bear: 'round', raccoon: 'round', owl: 'tuft', squirrel: 'leaf', otter: 'round', dog: 'floppy' };
  const snout: Record<string, FolkSpec['snout']> = { cat: 'short', fox: 'fox', bunny: 'bunny', bear: 'bear', raccoon: 'short', owl: 'owl', squirrel: 'short', otter: 'short', dog: 'dog' };
  const tails: Record<string, FolkSpec['tail']> = { cat: { kind: 'thin', c: a.skin }, fox: { kind: 'bushy', c: a.skin, tip: '#f4e4c9' }, bunny: { kind: 'puff', c: a.skin }, raccoon: { kind: 'ringed', c: a.skin }, squirrel: { kind: 'curl', c: a.skin }, otter: { kind: 'paddle', c: a.skin }, dog: { kind: 'nub', c: a.skin } };
  return { ...base, id: 'appearance_' + a.species, frameW: 40, human: false, humanEars: false, hero: undefined,
    ears: ears[a.species] ?? 'round', snout: snout[a.species] ?? 'short',
    nose: '#332a32', furLight: a.marks?.face ?? shade(a.skin, .35), innerEar: a.marks?.ear ?? shade(a.skin, .18),
    mask: a.marks?.mask, headMark: a.marks?.stripe, tail: tails[a.species] ?? { kind: 'none' },
    top: a.top ? base.top : a.skin, topLight: a.top ? base.topLight : shade(a.skin, .2),
    legs: a.bottom ? base.legs : 'fur', legsColor: a.bottom ? base.legsColor : a.skin,
    shoes: a.shoes ? base.shoes : shade(a.skin, -.35),
    hair: a.hairStyle === 6 ? undefined : { kind: a.hairStyle === 2 ? 'short' : a.hairStyle === 3 ? 'bun' : 'bob', c: a.hairColor },
    glasses: a.face.includes('glasses') ? '#443747' : undefined,
  };
}

export const neighborSheet = (a: Appearance) => buildFolkSheet(neighborSpec(a));
