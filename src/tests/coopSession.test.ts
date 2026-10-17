import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { COOP_VERSION, isMsg, isPos, type WorldPack } from '../coop/protocol';
import { CoopSession } from '../coop/session';
import { createMemoryPair, type CoopTransport } from '../coop/transport';

const app = (name: string) => ({ name, appearance: { species: 'human' } as never });
const world: WorldPack = { decor: {}, roomStyle: {}, restaurant: { level: 3, upgrades: ['pantry'], reputation: 40 }, time: { day: 4, period: 1, minutes: 10 }, restaurantName: 'Midnight Maki' };

function pair() {
  const { host, guest } = createMemoryPair();
  const mk = (t: CoopTransport, name: string) => new CoopSession({ openTransport: async () => t, buildWorld: () => world, me: () => app(name) });
  return { h: mk(host, 'Ana'), g: mk(guest, 'Beto') };
}
const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => { vi.stubGlobal('window', { setInterval, clearInterval, addEventListener: () => undefined, removeEventListener: () => undefined }); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('shared restaurant session', () => {
  it('connects, swaps names and gives the guest the host restaurant', async () => {
    const { h, g } = pair();
    const code = await h.host();
    expect(code).toHaveLength(6);
    expect(h.state().phase).toBe('waiting');
    const seen: WorldPack[] = [];
    g.onWorld((w) => seen.push(w));
    await g.join(code);
    await flush(); await flush(); await flush();
    expect(h.state().phase).toBe('connected');
    expect(h.state().peer?.name).toBe('Beto');
    expect(g.state().peer?.name).toBe('Ana');
    expect(g.state().world?.restaurant.level).toBe(3);
    expect(seen).toHaveLength(1);
    await h.leave(); await g.leave();
  });

  it('passes positions one way at a time and ignores nonsense', async () => {
    const { h, g } = pair();
    const code = await h.host(); await g.join(code);
    await flush(); await flush(); await flush();
    g.sendPos({ x: 40, y: 80, dir: 'left', moving: true, zone: 'restaurant' });
    await flush();
    expect(h.state().peerPos).toMatchObject({ x: 40, y: 80, dir: 'left' });
    expect(isPos({ x: 'a' })).toBe(false);
    expect(isMsg({ t: 'hello', v: COOP_VERSION })).toBe(false);
    expect(isMsg({ t: 'nope' })).toBe(false);
    await h.leave(); await g.leave();
  });

  it('tells the other side when someone leaves', async () => {
    const { h, g } = pair();
    const code = await h.host(); await g.join(code);
    await flush(); await flush(); await flush();
    await h.leave();
    await flush();
    expect(g.state().phase).toBe('closed');
    expect(g.state().note).toMatch(/cerró|desconect/);
  });

  it('keeps a fixed room open for the next guest when the first one leaves', async () => {
    const { h, g } = pair();
    const code = await h.host('ABC234');
    expect(code).toBe('ABC234');
    await g.join(code);
    await flush(); await flush(); await flush();
    expect(h.state().phase).toBe('connected');
    await g.leave();
    await flush();
    expect(h.state().phase).toBe('waiting');
    expect(h.state().peer).toBeNull();
    expect(h.state().note).toMatch(/salió/);
    // a room with a random code is over when the guest leaves
    const second = pair();
    const c2 = await second.h.host(); await second.g.join(c2);
    await flush(); await flush(); await flush();
    await second.g.leave(); await flush();
    expect(second.h.state().phase).toBe('closed');
  });

  it('refuses a bad code', async () => {
    const { g } = pair();
    await expect(g.join('abc')).rejects.toThrow(/código/);
  });
});

describe('what survives the Realtime Database', () => {
  it('repairs a world pack whose empty parts went missing or became objects', async () => {
    const { normalizeWorld, pack, unpack } = await import('../coop/protocol');
    const mangled = { decor: { dining: { 0: { uid: 1, id: 'table_wood', x: 3, y: 3, rot: 0 } } }, restaurant: { level: 2 }, time: { day: 3 } } as never;
    const w = normalizeWorld(mangled);
    expect(Array.isArray(w.decor.dining)).toBe(true);
    expect(w.decor.dining).toHaveLength(1);
    expect(w.restaurant.upgrades).toEqual([]);
    expect(w.roomStyle).toEqual({});
    expect(normalizeWorld(undefined).time.day).toBe(1);
    expect(unpack(pack({ a: [], b: {} }))).toEqual({ a: [], b: {} });
  });
});
