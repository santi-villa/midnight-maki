import { describe, expect, it } from 'vitest';
import { rainCells, WetGround, wetnessAfter } from '../scenes/rainmath';
import { Footsteps, stepGain, stepSurface } from '../audio/footsteps';

describe('rain on ground', () => {
  it('excludes water, walls, void and solid props; wood and sand receive impacts but no puddles', () => {
    const ground = ['gpcobshwdWV#x'];
    const cells = rainCells(ground, (x) => x === 1);
    expect(cells.map((c) => ground[c.y][c.x])).toEqual(['g', 'c', 'o', 'b', 's', 'h']);
    expect(cells.filter((c) => c.puddle).map((c) => ground[c.y][c.x])).toEqual(['g', 'c', 'o']);
    expect(rainCells(ground, (x) => x === 1)).toEqual(cells);
  });

  it('gathers rain slowly, dries gradually, and clamps both ends', () => {
    expect(wetnessAfter(0, true, 1)).toBeCloseTo(0.012);
    expect(wetnessAfter(0, true, 90)).toBe(1);
    expect(wetnessAfter(1, false, 30)).toBeCloseTo(0.88);
    expect(wetnessAfter(1, false, 300)).toBe(0);
    expect(wetnessAfter(0.4, true, NaN)).toBe(0.4);
  });

  it('retains outdoor wetness across doorways and dries visited places while indoors', () => {
    const wet = new WetGround();
    expect(wet.visit('plaza')).toBe(0);
    wet.advance(40, true);
    expect(wet.visit('plaza')).toBeCloseTo(0.48);
    wet.visit('garden'); wet.advance(30, false);
    expect(wet.visit('plaza')).toBeCloseTo(0.36);
    expect(wet.visit('garden')).toBe(0);
  });
});

describe('nearby footsteps', () => {
  it('uses the actual tile, wet outdoors and dry interiors', () => {
    expect(stepSurface(true, 'c', false)).toBe('step_stone');
    expect(stepSurface(true, 'g', false)).toBe('step_grass');
    expect(stepSurface(true, 's', false)).toBe('step_sand');
    expect(stepSurface(true, 'b', false)).toBe('step_wood');
    for (const tile of 'gGpcsobh') expect(stepSurface(true, tile, true)).toBe('step_wet');
    expect(stepSurface(false, 'f', true)).toBe('step_wood');
  });

  it('attenuates neighbours by distance and keeps pets quieter', () => {
    expect(stepGain(10)).toBeGreaterThan(stepGain(70));
    expect(stepGain(112)).toBe(0);
    expect(stepGain(300)).toBe(0);
    expect(stepGain(20, true)).toBeLessThan(stepGain(20));
  });

  it('requires real distance, caps cadence and ignores teleports, idles and movement during pauses', () => {
    const feet = new Footsteps(), actor = {};
    expect(feet.sample(actor, 0, 0, 0.1, false)).toBe(false);
    expect(feet.sample(actor, 0, 0, 2, false)).toBe(false);
    expect(feet.sample(actor, 11, 0, 0.1, false)).toBe(false);
    expect(feet.sample(actor, 12, 0, 0.1, false)).toBe(true);
    expect(feet.sample(actor, 24, 0, 0.01, false)).toBe(false);
    expect(feet.sample(actor, 25, 0, 0.3, false)).toBe(true);
    expect(feet.sample(actor, 300, 0, 1, false)).toBe(false);
    expect(feet.sample(actor, 315, 0, 1, true)).toBe(false);
    expect(feet.sample(actor, 315, 0, 1, false)).toBe(false);
  });

  it('tracks people separately and allows smaller quiet pet steps', () => {
    const feet = new Footsteps(), a = {}, b = {}, pet = {};
    for (const id of [a, b, pet]) feet.sample(id, 0, 0, 0.1, false);
    expect(feet.sample(a, 12, 0, 0.3, false)).toBe(true);
    expect(feet.sample(b, 0, 0, 0.3, false)).toBe(false);
    expect(feet.sample(pet, 7, 0, 0.3, false, true)).toBe(true);
  });
});
