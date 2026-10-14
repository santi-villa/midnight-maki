import { beforeEach, describe, expect, it, vi } from 'vitest';
import { game, newSave } from '../core/state';
import { validateSave } from '../persistence/validate';
import { TOWN_MEMORIES, playTownMemory, townMemoryReady, townMemorySeen, restorationSecretReady } from '../story/restoration';
import { say } from '../dialogue/dialogue';

vi.mock('../dialogue/dialogue', () => ({
  inDialogue: () => false,
  say: vi.fn(async () => {}),
  // Production reports errors and resolves; the caller must not mark an unfinished scene.
  runScene: async (_id: string, fn: () => Promise<void>) => { try { await fn(); } catch {} },
}));
beforeEach(() => { game.load(newSave()); vi.mocked(say).mockReset(); vi.mocked(say).mockResolvedValue(undefined); });
function restore() {
  for (const m of TOWN_MEMORIES) { game.setFlag('proj_' + m.project + '_1'); game.setFlag('proj_' + m.project + '_2'); }
}
describe('optional restoration lore', () => {
  it('requires restoration and the completed Pip chapter, including old saves', async () => {
    expect(await playTownMemory('tea')).toBe(false);
    restore(); expect(TOWN_MEMORIES.some(townMemoryReady)).toBe(false);
    game.setFlag('ch3_done');
    game.load(validateSave(JSON.parse(JSON.stringify(game.save))));
    expect(TOWN_MEMORIES.every(townMemoryReady)).toBe(true);
    expect(await playTownMemory('invalid')).toBe(false);
    expect(await playTownMemory('album')).toBe(false);
  });
  it('unlocks the final page through all six scenes without main-story flags or repeat rewards', async () => {
    restore(); game.setFlag('ch3_done'); const coins = game.coins;
    for (const m of TOWN_MEMORIES) expect(await playTownMemory(m.id)).toBe(true);
    expect(restorationSecretReady()).toBe(true);
    expect(await playTownMemory('album')).toBe(true);
    expect(await playTownMemory('album')).toBe(true);
    expect(game.coins).toBe(coins); expect(game.has('story_done')).toBe(false); expect(game.has('ch4_done')).toBe(false);
    game.load(validateSave(JSON.parse(JSON.stringify(game.save)))); expect(townMemorySeen('album')).toBe(true);
  });
  it('leaves a failed memory unread and releases the lock for retry', async () => {
    restore(); game.setFlag('ch3_done'); vi.mocked(say).mockRejectedValueOnce(new Error('interrupted'));
    expect(await playTownMemory('tea')).toBe(false); expect(townMemorySeen('tea')).toBe(false);
    expect(await playTownMemory('tea')).toBe(true);
  });
  it('rejects concurrent playback and marks only after the dialogue completes', async () => {
    restore(); game.setFlag('ch3_done'); let release!: () => void;
    vi.mocked(say).mockImplementationOnce(() => new Promise<void>(resolve => { release = resolve; }));
    const first = playTownMemory('tea');
    expect(townMemorySeen('tea')).toBe(false); expect(await playTownMemory('lights')).toBe(false);
    release(); expect(await first).toBe(true); expect(await playTownMemory('lights')).toBe(true);
  });
});
