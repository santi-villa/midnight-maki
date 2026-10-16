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
  expect(shopGate('taro').phase).toBe('open');
});

it('keeps the prologue steps and their saved indices, starting with Spicy', () => {
  const q = questDef('prologue')!;
  expect(q.steps).toHaveLength(9);
  expect(q.steps[0].target).toMatchObject({ kind: 'npc', npc: 'spicy' });
  expect(q.steps.every(s => !s.done())).toBe(true);
  expect(q.steps.map(s => s.text).join(' ')).toMatch(/sushi.*Taro.*despensa.*Yuki.*Bento.*cuadro.*Descansá/);
  expect(storyTalk('spicy')).not.toBeNull();
  game.setFlag('intro_done');
  expect(q.steps[0].done()).toBe(true);
  expect(q.steps[1].done()).toBe(false);
  game.setFlag('tut_spicy');
  expect(q.steps[1].done()).toBe(true);
  expect(q.steps[2].done()).toBe(false);
  expect(game.save.quests.done).not.toContain('prologue');
});

it('starts the bedroom with a painting and a potted plant, and points the carambola at the sweets stall', () => {
  expect(game.save.furnitureOwned).toMatchObject({ pt_sushi: 1, bamboo_pot: 1 });
  expect(game.has('starter_decor')).toBe(true);
  const decor = questDef('prologue')!.steps.find((s) => s.text.includes('cuadro'))!;
  expect(decor.done()).toBe(false);
  game.setFlag('placed_pt_sushi');
  expect(decor.done()).toBe(false);
  game.setFlag('placed_bamboo_pot');
  expect(decor.done()).toBe(true);
  const fruit = questDef('ch4')!.steps.find((s) => s.text.includes('carambola'))!;
  expect(fruit.target).toMatchObject({ zone: 'market', x: 4, y: 5, interactId: 'mk_food', label: 'Dulces de luna' });
});
