/**
 * Occasional glances between people and animals. Pure, so the scene can keep the
 * pose machine it already has. Most meetings do nothing.
 */

export type CompanionKind = 'cat' | 'dog' | 'bird' | 'duck' | 'frog' | 'fish';

export interface Companion {
  kind: CompanionKind;
  x: number;
  y: number;
  /** A cat that is sitting, not stalking. */
  calm?: boolean;
}

export interface Glance {
  dir: 'left' | 'right' | 'up' | 'down';
  /** null keeps the current pose and only turns the head (a fisher stays fishing). */
  pose: 'look' | 'happy' | 'wave' | null;
  seconds: number;
}

export interface GlancePerson {
  x: number;
  y: number;
  traits: readonly string[];
  act?: string;
  moving: boolean;
  settled: boolean;
}

const BUSY = new Set(['sleep', 'eat', 'cook', 'read', 'sit', 'drink', 'stars', 'paint', 'work', 'talk', 'clean', 'play']);
const REACH = 40;

function dirOf(dx: number, dy: number): Glance['dir'] {
  if (Math.abs(dx) >= Math.abs(dy)) return dx < 0 ? 'left' : 'right';
  return dy < 0 ? 'up' : 'down';
}

/**
 * One short look, or nothing. `roll` is 0..1.
 * Winter and rain make meetings rarer. A sleeping or working person is left alone.
 * Fishing only turns toward a fish that just jumped.
 */
export function pickGlance(person: GlancePerson, near: readonly Companion[], roll: number, season = 0, rain = false): Glance | null {
  if (!person.settled || person.moving || !near.length) return null;
  const fish = near.find((c) => c.kind === 'fish' && Math.hypot(c.x - person.x, c.y - person.y) <= 56);
  if (person.act === 'fish') {
    if (!fish || roll > 0.55) return null;
    return { dir: dirOf(fish.x - person.x, fish.y - person.y), pose: null, seconds: 2.2 };
  }
  if (person.act && BUSY.has(person.act)) return null;
  const shy = person.traits.includes('shy');
  const social = person.traits.includes('sociable');
  let gate = social ? 0.62 : shy ? 0.28 : 0.44;
  if (season === 3) gate *= 0.45;
  if (rain) gate *= 0.75;
  if (roll > gate) return null;
  const choices = near.filter((c) => c.kind !== 'fish' && Math.hypot(c.x - person.x, c.y - person.y) <= REACH);
  if (!choices.length) return null;
  const c = choices[Math.floor(roll * choices.length) % choices.length];
  const dir = dirOf(c.x - person.x, c.y - person.y);
  if (c.kind === 'dog' && social) return { dir, pose: 'wave', seconds: 1.5 };
  if (c.kind === 'cat' && c.calm && social && !shy) return { dir, pose: 'happy', seconds: 1.8 };
  return { dir, pose: 'look', seconds: 2.2 };
}
