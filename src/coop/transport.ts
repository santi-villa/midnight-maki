/** Two-person pipe. The session only knows this interface: memory (tests), same-browser (dev) and Firebase Realtime Database (real). */
import type { Msg, Role, StateKey } from './protocol';

export interface CoopTransport {
  readonly role: Role;
  /** reliable, in order */
  send(msg: Msg): void;
  /** latest value wins; the caller throttles */
  state(key: StateKey, value: unknown): void;
  onMessage(fn: (m: unknown) => void): void;
  onState(fn: (key: string, value: unknown) => void): void;
  /** the other side connected / disconnected */
  onPeer(fn: (present: boolean) => void): void;
  close(): Promise<void>;
}

type Handlers = { msg: ((m: unknown) => void)[]; state: ((k: string, v: unknown) => void)[]; peer: ((p: boolean) => void)[] };
const fresh = (): Handlers => ({ msg: [], state: [], peer: [] });

/** Two ends wired together in memory. Used by the unit tests. */
export function createMemoryPair(): { host: CoopTransport; guest: CoopTransport } {
  const h = fresh(), g = fresh();
  let open = true;
  const make = (role: Role, mine: Handlers, theirs: Handlers): CoopTransport => ({
    role,
    send(msg) { if (open) queueMicrotask(() => theirs.msg.forEach((f) => f(JSON.parse(JSON.stringify(msg))))); },
    state(key, value) { if (open) queueMicrotask(() => theirs.state.forEach((f) => f(key, JSON.parse(JSON.stringify(value))))); },
    onMessage(fn) { mine.msg.push(fn); },
    onState(fn) { mine.state.push(fn); },
    onPeer(fn) { mine.peer.push(fn); queueMicrotask(() => fn(true)); },
    async close() { if (!open) return; open = false; theirs.peer.forEach((f) => f(false)); },
  });
  return { host: make('host', h, g), guest: make('guest', g, h) };
}

/** Same browser, two tabs: for developing and for the automatic tests, no internet needed. */
export function createBroadcastTransport(role: Role, code: string): CoopTransport {
  const ch = new BroadcastChannel(`mm-coop-${code}`);
  const hs = fresh();
  let peer = false;
  const other: Role = role === 'host' ? 'guest' : 'host';
  const post = (m: Record<string, unknown>) => ch.postMessage({ from: role, ...m });
  ch.onmessage = (e: MessageEvent) => {
    const d = e.data as { from?: Role; kind?: string; msg?: unknown; key?: string; value?: unknown };
    if (!d || d.from !== other) return;
    if (d.kind === 'hi') { if (!peer) { peer = true; hs.peer.forEach((f) => f(true)); } post({ kind: 'hi-ack' }); }
    else if (d.kind === 'hi-ack') { if (!peer) { peer = true; hs.peer.forEach((f) => f(true)); } }
    else if (d.kind === 'bye') { peer = false; hs.peer.forEach((f) => f(false)); }
    else if (d.kind === 'msg') hs.msg.forEach((f) => f(d.msg));
    else if (d.kind === 'state' && d.key) hs.state.forEach((f) => f(d.key!, d.value));
  };
  queueMicrotask(() => post({ kind: 'hi' }));
  const leave = () => post({ kind: 'bye' });
  window.addEventListener('pagehide', leave);
  return {
    role,
    send(msg) { post({ kind: 'msg', msg }); },
    state(key, value) { post({ kind: 'state', key, value }); },
    onMessage(fn) { hs.msg.push(fn); },
    onState(fn) { hs.state.push(fn); },
    onPeer(fn) { hs.peer.push(fn); if (peer) fn(true); },
    async close() { leave(); window.removeEventListener('pagehide', leave); ch.close(); },
  };
}
