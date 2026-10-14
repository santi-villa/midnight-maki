import { beforeEach, describe, expect, it, vi } from 'vitest';
import { game, newSave } from '../core/state';
import { activeSlot, adoptSnapshot, clearManual, continueTarget, deleteSave, deleteSlot, hasSave, installSave, loadGame, saveGame, saveManual, setActiveSlot } from '../persistence/storage';

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
    const previous = values.get('mm_s0-auto');
    game.addCoins(23);
    setItem.mockImplementationOnce(() => { throw new DOMException('private content', 'QuotaExceededError'); });
    expect(await saveGame('test')).toBe(false);
    expect(game.dirty).toBe(true);
    expect(values.get('mm_s0-auto')).toBe(previous);
    expect(await saveGame('retry')).toBe(true);
    expect((await loadGame())?.coins).toBe(game.coins);
  });

  it('catches serialization failure without overwriting either slot', async () => {
    const cyclic = game.save.flags as Record<string, unknown>;
    cyclic.cycle = game.save;
    expect(await saveGame()).toBe(false);
    expect(values.has('mm_s0-auto')).toBe(false);
    expect(values.has('mm_s0-backup')).toBe(false);
    expect(values.has('mm_s0-manual')).toBe(false);
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
    const writes = setItem.mock.calls.filter(([key]) => key === 'mm_s0-auto').map(([, value]) => JSON.parse(value).coins);
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
    values.set('mm_s0-auto', '{broken');
    values.set('mm_s0-backup', JSON.stringify({ ...game.save, coins: 789 }));
    expect((await loadGame())?.coins).toBe(789);
  });
});

describe('three slots and manual checkpoints', () => {
  it('keeps a manual checkpoint when a later autosave changes only the automatic save', async () => {
    game.save.coins = 10;
    game.save.updatedAt = 50;
    expect(await saveManual()).toBe(true);
    game.save.coins = 15;
    game.save.updatedAt = 80;
    expect(await saveGame()).toBe(true);
    expect((await loadGame(0, 'manual'))?.coins).toBe(10);
    expect((await loadGame(0, 'auto'))?.coins).toBe(15);
    expect((await loadGame(0, 'latest'))?.coins).toBe(15);
    expect(values.has('mm_main')).toBe(false);
  });

  it('does not let a failed autosave replace the manual checkpoint or the previous automatic save', async () => {
    expect(await saveManual()).toBe(true);
    const manual = values.get('mm_s0-manual');
    const auto = values.get('mm_s0-auto');
    game.addCoins(2);
    setItem.mockImplementationOnce(() => { throw new DOMException('private content', 'QuotaExceededError'); });
    expect(await saveGame('test')).toBe(false);
    expect(values.get('mm_s0-manual')).toBe(manual);
    expect(values.get('mm_s0-auto')).toBe(auto);
    expect(game.dirty).toBe(true);
  });

  it('keeps the old manual checkpoint when the new manual write fails after the automatic one', async () => {
    expect(await saveManual()).toBe(true);
    const manual = values.get('mm_s0-manual');
    game.addCoins(4);
    const next = game.coins;
    setItem.mockImplementation((key: string, value: string) => {
      if (String(key).endsWith('manual')) throw new DOMException('private content', 'QuotaExceededError');
      values.set(key, value);
    });
    try {
      expect(await saveManual()).toBe(false);
      expect(game.dirty).toBe(true);
      expect(values.get('mm_s0-manual')).toBe(manual);
      expect(JSON.parse(values.get('mm_s0-auto')!).coins).toBe(next);
    } finally {
      setItem.mockImplementation((key: string, value: string) => { values.set(key, value); });
    }
  });

  it('stores three playthroughs without mixing their saves', async () => {
    game.save.coins = 1;
    expect(await saveGame()).toBe(true);
    const kept = values.get('mm_s0-auto');
    setActiveSlot(1);
    game.save.coins = 2;
    expect(await saveGame()).toBe(true);
    setActiveSlot(2);
    game.save.coins = 3;
    expect(await saveManual()).toBe(true);
    expect(values.get('mm_s0-auto')).toBe(kept);
    expect(JSON.parse(values.get('mm_s1-auto')!).coins).toBe(2);
    expect(JSON.parse(values.get('mm_s2-auto')!).coins).toBe(3);
    expect(JSON.parse(values.get('mm_s2-manual')!).coins).toBe(3);
    expect(values.has('mm_s0-manual')).toBe(false);
    expect(values.has('mm_s1-manual')).toBe(false);
    expect(await loadGame(1, 'manual')).toBeNull();
  });

  it('rotates a backup on its own timer when another slot was just saved', async () => {
    expect(await saveGame()).toBe(true);
    setActiveSlot(1);
    values.set('mm_s1-auto', JSON.stringify({ ...game.save, coins: 321 }));
    game.save.coins = 654;
    expect(await saveGame()).toBe(true);
    expect(JSON.parse(values.get('mm_s1-backup')!).coins).toBe(321);
    expect(JSON.parse(values.get('mm_s1-auto')!).coins).toBe(654);
    expect(values.has('mm_s0-backup')).toBe(false);
  });

  it('reads a legacy save as slot 0 until a new automatic key exists', async () => {
    values.set('mm_main', JSON.stringify({ ...game.save, coins: 111 }));
    expect((await loadGame())?.coins).toBe(111);
    values.set('mm_main', '{broken');
    values.set('mm_backup', JSON.stringify({ ...game.save, coins: 456 }));
    expect((await loadGame())?.coins).toBe(456);
    values.set('mm_main', JSON.stringify({ ...game.save, coins: 111 }));
    values.set('mm_s0-auto', JSON.stringify({ ...game.save, coins: 222 }));
    expect((await loadGame())?.coins).toBe(222);
    values.set('mm_s0-auto', '{broken');
    values.set('mm_s0-backup', JSON.stringify({ ...game.save, coins: 789 }));
    expect((await loadGame())?.coins).toBe(789);
  });

  it('loads manual only from the manual key', async () => {
    values.set('mm_s1-auto', JSON.stringify({ ...game.save, coins: 1 }));
    values.set('mm_s2-manual', JSON.stringify({ ...game.save, coins: 77 }));
    expect(await loadGame(1, 'manual')).toBeNull();
    expect((await loadGame(1, 'auto'))?.coins).toBe(1);
    expect(await loadGame(2, 'auto')).toBeNull();
    expect((await loadGame(2, 'latest'))?.coins).toBe(77);
  });

  it('forgets a wiped slot, including a legacy copy of slot 0', async () => {
    values.set('mm_main', JSON.stringify(game.save));
    values.set('mm_backup', JSON.stringify(game.save));
    values.set('mm_s0-manual', JSON.stringify(game.save));
    await deleteSlot(0);
    expect(values.has('mm_main')).toBe(false);
    expect(values.has('mm_backup')).toBe(false);
    expect(values.has('mm_s0-manual')).toBe(false);
    expect(await loadGame(0, 'latest')).toBeNull();
  });

  it('installs an import as the automatic save and drops the manual checkpoint', async () => {
    values.set('mm_s1-manual', JSON.stringify({ ...game.save, coins: 7 }));
    const imported = { ...game.save, coins: 50, player: { ...game.save.player, name: 'Nueva' } };
    expect(await installSave(1, imported)).toBe(true);
    expect(activeSlot()).toBe(1);
    expect((await loadGame(1, 'auto'))?.player.name).toBe('Nueva');
    expect((await loadGame(1, 'auto'))?.coins).toBe(50);
    expect(await loadGame(1, 'manual')).toBeNull();
  });

  it('clears only the manual checkpoint', async () => {
    expect(await saveManual()).toBe(true);
    await clearManual();
    expect(await loadGame(0, 'manual')).toBeNull();
    expect((await loadGame(0, 'auto'))?.coins).toBe(game.coins);
  });

  it('adopts a manual snapshot into the automatic save and leaves the checkpoint', async () => {
    game.save.coins = 10;
    game.save.updatedAt = 1000;
    expect(await saveManual()).toBe(true);
    game.save.coins = 40;
    game.save.updatedAt = 4000;
    expect(await saveGame()).toBe(true);
    const checkpoint = await loadGame(0, 'manual');
    expect(checkpoint?.coins).toBe(10);
    expect(await adoptSnapshot(0, checkpoint!)).toBe(true);
    expect((await loadGame(0, 'auto'))?.coins).toBe(10);
    expect((await loadGame(0, 'manual'))?.coins).toBe(10);
  });

  it('continues the active slot before a newer save in another slot', async () => {
    game.save.updatedAt = 100;
    game.save.coins = 5;
    expect(await saveGame()).toBe(true);
    setActiveSlot(1);
    game.save.updatedAt = 9000;
    game.save.coins = 9;
    expect(await saveGame()).toBe(true);
    setActiveSlot(0);
    const found = await continueTarget();
    expect(found?.slot).toBe(0);
    expect(found?.kind).toBe('auto');
    expect(found?.data.coins).toBe(5);
  });

  it('continues the newest other slot when the active one is empty', async () => {
    setActiveSlot(1);
    game.save.updatedAt = 1000;
    game.save.coins = 1;
    expect(await saveGame()).toBe(true);
    setActiveSlot(2);
    game.save.updatedAt = 5000;
    game.save.coins = 2;
    expect(await saveManual()).toBe(true);
    setActiveSlot(0);
    const found = await continueTarget();
    expect(found?.slot).toBe(2);
    expect(found?.data.coins).toBe(2);
    expect(await hasSave()).toBe(true);
  });

  it('wipes every slot and forgets which one was active', async () => {
    setActiveSlot(2);
    expect(await saveManual()).toBe(true);
    expect(await hasSave()).toBe(true);
    await deleteSave();
    expect(activeSlot()).toBe(0);
    expect(await hasSave()).toBe(false);
    expect(values.has('mm_s2-auto')).toBe(false);
    expect(values.has('mm_s2-manual')).toBe(false);
  });
});
