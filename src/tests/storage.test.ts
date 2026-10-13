import { beforeEach, describe, expect, it, vi } from 'vitest';
import { game, newSave } from '../core/state';
import { deleteSave, loadGame, saveGame } from '../persistence/storage';

const values = new Map<string, string>();
const setItem = vi.fn((key: string, value: string) => { values.set(key, value); });
beforeEach(async () => {
  vi.restoreAllMocks();
  values.clear();
  setItem.mockClear();
  vi.stubGlobal('indexedDB', undefined);
  vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem, removeItem: (key: string) => values.delete(key) });
  vi.spyOn(console, 'error').mockImplementation(() => {});
  game.load(newSave('Privado'));
  game.touch('test');
  await deleteSave();
});

describe('save transaction outcomes and snapshots', () => {
  it('reports quota failures honestly, retains the previous save and allows retry', async () => {
    expect(await saveGame()).toBe(true);
    const previous = values.get('mm_main');
    game.addCoins(23);
    setItem.mockImplementationOnce(() => { throw new DOMException('private content', 'QuotaExceededError'); });
    expect(await saveGame('test')).toBe(false);
    expect(game.dirty).toBe(true);
    expect(values.get('mm_main')).toBe(previous);
    expect(await saveGame('retry')).toBe(true);
    expect((await loadGame())?.coins).toBe(game.coins);
  });

  it('catches serialization failure without overwriting either slot', async () => {
    const cyclic = game.save.flags as Record<string, unknown>;
    cyclic.cycle = game.save;
    expect(await saveGame()).toBe(false);
    expect(values.has('mm_main')).toBe(false);
    expect(game.dirty).toBe(true);
  });

  it('does not clear dirty when progress changes before the write completes', async () => {
    const writing = saveGame();
    game.addCoins(57);
    expect(await writing).toBe(true);
    expect(game.dirty).toBe(true);
    expect((await loadGame())?.coins).toBe(game.coins - 57);
    expect(await saveGame()).toBe(true);
    expect(game.dirty).toBe(false);
    expect((await loadGame())?.coins).toBe(game.coins);
  });

  it('serializes simultaneous save calls in invocation order', async () => {
    const results: Promise<boolean>[] = [];
    const coins: number[] = [];
    for (let i = 0; i < 5; i++) {
      game.addCoins(10);
      coins.push(game.coins);
      results.push(saveGame());
    }
    expect(await Promise.all(results)).toEqual([true, true, true, true, true]);
    const writes = setItem.mock.calls.filter(([key]) => key === 'mm_main').map(([, value]) => JSON.parse(value).coins);
    expect(writes).toEqual(coins);
    expect((await loadGame())?.coins).toBe(game.coins);
  });

  it('does not clear dirty for a replacement game while an old save is in flight', async () => {
    const writing = saveGame();
    game.load(newSave('Otro'));
    game.touch('replacement');
    expect(await writing).toBe(true);
    expect(game.dirty).toBe(true);
  });

  it('falls back to a validated rolling backup when main is corrupt', async () => {
    values.set('mm_main', '{broken');
    values.set('mm_backup', JSON.stringify({ ...game.save, coins: 789 }));
    expect((await loadGame())?.coins).toBe(789);
  });
});
