import { beforeEach, describe, expect, it } from 'vitest';
import { game, newSave } from '../core/state';
import { ZONES } from '../data/zones';
import { nextDoor, routeGoal } from '../world/guide';

const origin = (id: string) => ZONES[id].world!;

beforeEach(() => {
  game.load(newSave('Guía'));
  for (const f of ['unlock_beach', 'unlock_station', 'unlock_garden', 'unlock_forest']) game.setFlag(f);
});

describe('objective guide across the continuous village', () => {
  it('points from any outdoor district at the restaurant door itself, not at the border it is about to cross', () => {
    const door = ZONES.plaza.doors.find((d) => d.to === 'restaurant')!;
    for (const id of ['forest', 'deepforest', 'garden', 'beach', 'residential', 'plaza']) {
      const g = routeGoal(id, 'restaurant')!;
      expect(g, id).toBeTruthy();
      // the same tile of the world whichever district you stand in
      expect(g.x + origin(id).x, id).toBe(origin('plaza').x + door.x);
      expect(g.y + origin(id).y, id).toBe(origin('plaza').y + door.y);
    }
    // while the old rule sent the forest to its own corner door
    expect(nextDoor('forest', 'restaurant')).toEqual({ x: 30, y: 23 });
  });

  it('aims at the spot itself when the objective is outdoors, in the coordinates of where the player stands', () => {
    const g = routeGoal('forest', 'plaza', { x: 5, y: 7 })!;
    expect(g).toEqual({ x: origin('plaza').x - origin('forest').x + 5, y: origin('plaza').y - origin('forest').y + 7 });
  });

  it('keeps the exit door from an interior and nothing when the way is still locked', () => {
    expect(routeGoal('restaurant', 'forest')).toEqual(nextDoor('restaurant', 'forest'));
    game.save.flags = {} as typeof game.save.flags;
    expect(routeGoal('plaza', 'forest')).toBeNull();
    expect(routeGoal('forest', 'forest')).toBeNull();
  });
});
