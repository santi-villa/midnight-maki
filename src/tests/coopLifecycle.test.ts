import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CoopSession, OPEN_TIMEOUT_MS } from '../coop/session';
import type { CoopTransport } from '../coop/transport';

function transport() {
  let state: (key: string, value: unknown) => void = () => undefined;
  const pipe: CoopTransport = {
    role: 'guest', send: vi.fn(), state: vi.fn(),
    onMessage: vi.fn(), onPeer: vi.fn(), onState: (fn) => { state = fn; },
    close: vi.fn(async () => undefined),
  };
  return { pipe, state: (key: string, value: unknown) => state(key, value) };
}
function session(openTransport: () => Promise<CoopTransport>) {
  return new CoopSession({ openTransport, me: () => ({ name: 'Sofi', appearance: {} as never }), buildWorld: () => ({} as never) });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('window', { setInterval, clearInterval });
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('coop connection lifecycle', () => {
  it('closes a late transport instead of joining after the player cancelled', async () => {
    const { pipe } = transport();
    let resolve!: (t: CoopTransport) => void;
    const visit = session(() => new Promise((r) => { resolve = r; }));
    const joined = visit.join('ABC234');
    const rejected = expect(joined).rejects.toThrow(/cancel/i);
    await visit.leave();
    resolve(pipe);
    await rejected;
    expect(visit.state().phase).toBe('idle');
    expect(pipe.close).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cleans up a pipe that opens after the connection timed out', async () => {
    const { pipe } = transport();
    let resolve!: (t: CoopTransport) => void;
    const visit = session(() => new Promise((r) => { resolve = r; }));
    const rejected = expect(visit.join('ABC234')).rejects.toThrow(/tiempo/i);
    await vi.advanceTimersByTimeAsync(OPEN_TIMEOUT_MS + 1);
    await rejected;
    resolve(pipe);
    await vi.advanceTimersByTimeAsync(0);
    expect(visit.state().phase).toBe('closed');
    expect(pipe.close).toHaveBeenCalledOnce();
  });

  it('ends a guest handshake that never receives the host world', async () => {
    const { pipe } = transport();
    const visit = session(async () => pipe);
    await visit.join('ABC234');
    await vi.advanceTimersByTimeAsync(OPEN_TIMEOUT_MS + 2000);
    expect(visit.state().phase).toBe('closed');
    expect(visit.state().note).toMatch(/respond|conexión/i);
    expect(pipe.close).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('ignores queued state events from a transport already closed', async () => {
    const pipe = transport();
    const visit = session(async () => pipe.pipe);
    await visit.join('ABC234');
    await visit.leave();
    pipe.state('pos', { x: 40, y: 80, dir: 'left', moving: true, zone: 'restaurant' });
    expect(visit.state().peerPos).toBeNull();
    expect(visit.state().phase).toBe('idle');
  });
});
