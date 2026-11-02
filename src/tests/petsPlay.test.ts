import { describe, expect, it } from 'vitest';
import { throwLanding } from '../scenes/dogs';
import { breathAt, sleepFrame, zzzAt } from '../scenes/petArt';
import { ponds, pondLife } from '../scenes/wildlife';
import { resolveContext, TILE, type ContextSense } from '../world/contextActions';

// a wall at x = 5, open ground elsewhere
const solid = (x: number, y: number) => x === 5 || x < 0 || y < 0;

describe('throwing the ball', () => {
  it('flies up to six tiles the way the player faces', () => {
    expect(throwLanding(() => false, 10, 10, 'down')).toEqual([10, 16]);
    expect(throwLanding(() => false, 10, 10, 'left', 3)).toEqual([7, 10]);
  });
  it('lands before a wall or water instead of past it', () => {
    expect(throwLanding(solid, 1, 3, 'right')).toEqual([4, 3]);
  });
  it('does not leave the hand when the next tile is already blocked', () => {
    expect(throwLanding(solid, 4, 3, 'right')).toBeNull();
  });
});

describe('a sleeping cat', () => {
  it('shows the z one, two, three and then takes them away in reverse, with a rest', () => {
    const seq = Array.from({ length: 8 }, (_, i) => zzzAt(i * 0.55 + 0.1));
    expect(seq).toEqual([1, 2, 3, 3, 2, 1, 0, 0]);
    expect(zzzAt(8 * 0.55 + 0.1)).toBe(1); // and again
  });
  it('breathes in and out and has its own frames for each pose', () => {
    const breaths = new Set(Array.from({ length: 24 }, (_, i) => breathAt(i * 0.1)));
    expect(breaths).toEqual(new Set([0, 1]));
    expect(new Set([sleepFrame('curl', 0), sleepFrame('curl', 1), sleepFrame('back', 0), sleepFrame('back', 1)]).size).toBe(4);
  });
});

describe('ponds are not all the same', () => {
  it('tells two separate ponds apart', () => {
    const g = ['wwg..', 'wwg.w', '....w'];
    const found = ponds(g).map((p) => p.length).sort();
    expect(found).toEqual([2, 4]);
  });
  it('gives some ponds no frogs, some ducks and some none, and never ducks in a puddle', () => {
    const lives = Array.from({ length: 60 }, (_, i) => pondLife({ x: i * 7, y: i * 3 }, 20));
    expect(lives.some((l) => l.frogs === 0)).toBe(true);
    expect(lives.some((l) => l.frogs > 0)).toBe(true);
    expect(lives.some((l) => l.ducks)).toBe(true);
    expect(lives.some((l) => !l.ducks)).toBe(true);
    expect(Array.from({ length: 30 }, (_, i) => pondLife({ x: i, y: i * 2 }, 6)).some((l) => l.ducks)).toBe(false);
  });
});

describe('the ball in the contextual actions', () => {
  const base = (ball: ContextSense['ball']): ContextSense => ({
    zoneId: 'plaza', px: 10 * TILE + 8, py: 10 * TILE + 14, dir: 'right', room: null, npcs: [], interacts: [], doors: [], gathers: [], bugs: [], furniture: [], ball,
  });
  it('offers to pick it up as the main action when it is at your feet', () => {
    expect(resolveContext(base({ x: 11 * TILE + 8, y: 10 * TILE + 12, held: false, dog: 'Kuri' })).primary?.id).toBe('ball:take');
  });
  it('does not offer it from far away', () => {
    expect(resolveContext(base({ x: 20 * TILE, y: 10 * TILE, held: false, dog: 'Kuri' })).primary).toBeNull();
  });
  it('offers to throw it while you hold it', () => {
    expect(resolveContext(base({ x: 0, y: 0, held: true, dog: 'Kuri' })).primary?.id).toBe('ball:throw');
  });
});
