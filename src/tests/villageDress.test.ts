import { describe, expect, it } from 'vitest';
import { VILLAGE_BOUNDS, type VillageZone } from '../data/villageGeography';
import { PROPS } from '../data/props';
import { ZONES } from '../data/zones';
import { wildFlowerGround } from '../world/habitats';
import { districtAt } from '../world/village';

/** A tile in village space, even when the neighbour sits in the next district. */
function worldTile(zone: VillageZone, x: number, y: number): string | undefined {
  const b = VILLAGE_BOUNDS[zone];
  const at = districtAt(b.x + x, b.y + y);
  return ZONES[at.zone]?.ground[at.y]?.[at.x];
}

const AREAS = ['harbor', 'market', 'plaza', 'beach', 'forest', 'garden', 'residential', 'station', 'shrine'] as const;
const WILD = new Set(['flowers', 'flowers_lav', 'farm_flowers']);

describe('village dressing', () => {
  it('does not leave wild flowers on wood, paving or water', () => {
    for (const id of AREAS) {
      const z = ZONES[id];
      for (const p of z.props) {
        if (!WILD.has(p.id)) continue;
        const d = PROPS[p.id];
        const ground = z.ground[p.y + d.h - 1]?.[p.x];
        expect(wildFlowerGround(ground), `${id} ${p.id} at ${p.x},${p.y} on ${ground}`).toBe(true);
      }
    }
  });

  it('keeps added mushrooms and reeds by fresh water, and nets on sand', () => {
    for (const id of ['forest', 'garden'] as const) {
      const z = ZONES[id];
      for (const p of z.props) {
        if (p.id !== 'mushroom' && p.id !== 'reeds') continue;
        const ground = worldTile(id, p.x, p.y);
        expect(ground === 'g' || ground === 'G', `${id} ${p.id}`).toBe(true);
        let water = false;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          if ((dx || dy) && worldTile(id, p.x + dx, p.y + dy) === 'w') water = true;
        }
        expect(water, `${id} ${p.id} at ${p.x},${p.y}`).toBe(true);
      }
    }
    for (const id of AREAS) {
      const z = ZONES[id];
      for (const p of z.props) if (p.id === 'village_net') expect(z.ground[p.y]?.[p.x]).toBe('s');
    }
  });
});
