import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('../scenes/WorldScene', () => ({ world: { zoneId: 'restaurant' } }));
import { game, newSave } from '../core/state';
import { RESTAURANT_ENTRY, ZONES } from '../data/zones';
import { shopGate, charactersIn } from '../systems/npcs';
import { questDef } from '../quests/quests';
import { storyTalk } from '../story/story';
import { buildZone, ensureDefaultDecor } from '../world/zoneRuntime';
beforeEach(() => { game.load(newSave()); game.save.time.period = 2; });

it('arrives on a free entry tile, faces inside and does not overlap a resident', () => {
  ensureDefaultDecor();
  const { x, y, dir } = RESTAURANT_ENTRY;
  expect(buildZone('restaurant', true).grid.isSolid(x, y)).toBe(false);
  expect(charactersIn('restaurant', 2).some(({ stop }) => stop.x === x && stop.y === y)).toBe(false);
  expect(dir).toBe('up');
  expect(ZONES.plaza.doors.find(d => d.to === 'restaurant')).toMatchObject({ tx: x, ty: y, dir });
  expect(shopGate('taro').phase).toBe('closed');
});

it('keeps all six prologue steps and their saved indices, starting with Spicy', () => {
  const q = questDef('prologue')!;
  expect(q.steps).toHaveLength(6);
  expect(q.steps[0].target).toMatchObject({ kind: 'npc', npc: 'spicy' });
  expect(q.steps.every(s => !s.done())).toBe(true);
  expect(q.steps.map(s => s.text).join(' ')).toMatch(/sushi.*Taro.*Decorá.*Descansá/);
  expect(storyTalk('spicy')).not.toBeNull();
  game.setFlag('intro_done');
  expect(q.steps[0].done()).toBe(true);
  expect(q.steps[1].done()).toBe(false);
  game.setFlag('tut_spicy');
  expect(q.steps[1].done()).toBe(true);
  expect(q.steps[2].done()).toBe(false);
  expect(game.save.quests.done).not.toContain('prologue');
});
