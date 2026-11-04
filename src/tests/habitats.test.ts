import { describe, expect, it } from 'vitest';
import { beeMayVisit, beetleCount, beetleGround, butterflyGround, fireflyGround, wildFlowerGround } from '../world/habitats';
import { dampMushroom, keepDressProp, netBeside, reedHere } from '../world/zoneDress';

describe('where plants and insects belong', () => {
  it('lets wild flowers grow on natural ground only', () => {
    for (const g of ['g', 'G', 'o', 'r', 'y', 'l']) expect(wildFlowerGround(g)).toBe(true);
    for (const g of ['b', 'p', 'c', 'w', 'd', 'h', 's', 'S', 'R', 'C', 'f']) expect(wildFlowerGround(g)).toBe(false);
    expect(keepDressProp('flowers', 'b')).toBe(false);
    expect(keepDressProp('flowers', 'g')).toBe(true);
    expect(keepDressProp('pot_rose', 'b')).toBe(true);
  });

  it('sends bees to real flowers and not to cargo or docks', () => {
    expect(beeMayVisit('flowers', 'g')).toBe(true);
    expect(beeMayVisit('flowers', 'b')).toBe(false);
    expect(beeMayVisit('flowers', 'p')).toBe(false);
    expect(beeMayVisit('flowers', 'w')).toBe(false);
    expect(beeMayVisit('planter_pink', 'c')).toBe(true);
    expect(beeMayVisit('planter_pink', 'b')).toBe(false);
    expect(beeMayVisit('pot_rose', 'b')).toBe(false);
    expect(beeMayVisit('pot_rose', 'g')).toBe(true);
    expect(beeMayVisit('wharf_flower_box', 'b')).toBe(false);
    expect(beeMayVisit('wharf_flower_box', 'g')).toBe(false);
  });

  it('keeps butterflies, fireflies and beetles in their own places', () => {
    expect(butterflyGround('g', false)).toBe(true);
    expect(butterflyGround('c', true)).toBe(true);
    expect(butterflyGround('b', true)).toBe(false);
    expect(butterflyGround('w', false)).toBe(false);
    expect(butterflyGround('p', false)).toBe(false);
    expect(fireflyGround('G')).toBe(true);
    expect(fireflyGround('c')).toBe(false);
    expect(beetleGround('g', false)).toBe(true);
    expect(beetleGround('g', true)).toBe(false);
    expect(beetleCount(0, 1, true)).toBe(0);
    expect(beetleCount(3, 0, false)).toBe(0);
    expect(beetleCount(3, 3, false)).toBe(1);
    expect(beetleCount(0, 3, false)).toBe(2);
    expect(beetleCount(1, 1, false)).toBe(3);
  });

  it('keeps mushrooms, reeds and nets off the walks', () => {
    expect(dampMushroom('g', true, false)).toBe(true);
    expect(dampMushroom('G', true, true)).toBe(false);
    expect(dampMushroom('p', true, false)).toBe(false);
    expect(reedHere('g', true, false)).toBe(true);
    expect(reedHere('G', true, false)).toBe(false);
    expect(netBeside('s')).toBe(true);
    expect(netBeside('b')).toBe(false);
  });
});
