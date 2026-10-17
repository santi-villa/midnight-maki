/**
 * One shared-restaurant session between two players. The host runs the restaurant; the guest joins it.
 * This file is the handshake, the heartbeat and the bookkeeping. It knows nothing about Phaser or Firebase.
 */
import { generateCode, normalizeCode } from '../cloud/friendCode';
import { bus } from '../core/events';
import { CoopError } from './errors';
import { COOP_VERSION, isMsg, isPos, normalizeWorld, type Msg, type PeerInfo, type PosState, type Role, type WorldPack } from './protocol';
import type { CoopTransport } from './transport';

export type CoopPhase = 'idle' | 'opening' | 'waiting' | 'connected' | 'closed';
export interface CoopState {
  phase: CoopPhase;
  role: Role | null;
  code: string | null;
  peer: PeerInfo | null;
  peerPos: PosState | null;
  /** the host's restaurant as the guest was told to see it */
  world: WorldPack | null;
  /** why it ended or failed, in plain words */
  note: string | null;
}

/** how long without a sign of life before the other side counts as gone */
export const SILENCE_MS = 9000;
const HEARTBEAT_MS = 2000;

/** A pipe that never answers (wrong database URL, no internet) must end in a message, not an endless "Abriendo…". */
export const OPEN_TIMEOUT_MS = 12000;
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new CoopError('No se pudo conectar con la base en tiempo real. Revisá tu conexión, la URL en .env.local y que las reglas estén publicadas.')), ms);
    p.then((v) => { clearTimeout(id); resolve(v); }, (e) => { clearTimeout(id); reject(e); });
  });
}

export interface CoopDeps {
  openTransport: (role: Role, code: string) => Promise<CoopTransport>;
  /** the host's restaurant, taken when the guest arrives */
  buildWorld: () => WorldPack;
  me: () => PeerInfo;
  now?: () => number;
}

export class CoopSession {
  private st: CoopState = { phase: 'idle', role: null, code: null, peer: null, peerPos: null, world: null, note: null };
  private t: CoopTransport | null = null;
  private beat = 0;
  private lastHeard = 0;
  private handlers = new Map<string, ((m: unknown) => void)[]>();
  private worldHook: ((w: WorldPack) => void) | null = null;
  private floorHook: ((v: unknown) => void) | null = null;
  constructor(private deps: CoopDeps) {}

  state(): CoopState { return this.st; }
  private now() { return (this.deps.now ?? Date.now)(); }
  private set(p: Partial<CoopState>) { this.st = { ...this.st, ...p }; bus.emit('coop:changed', {}); }

  /** Subscribe to extra messages (added by later features). */
  on(type: string, fn: (m: unknown) => void) { const l = this.handlers.get(type) ?? []; l.push(fn); this.handlers.set(type, l); }
  onWorld(fn: (w: WorldPack) => void) { this.worldHook = fn; }
  send(msg: Msg | { t: string; [k: string]: unknown }) { this.t?.send(msg as Msg); }
  /** The host's dining room, as the guest should see it. Latest value wins. */
  sendFloor(v: unknown) { if (this.st.phase === 'connected') this.t?.state('floor', v); }
  onFloor(fn: (v: unknown) => void) { this.floorHook = fn; }
  sendPos(p: PosState) { if (this.st.phase === 'connected') this.t?.state('pos', p); }

  async host(): Promise<string> {
    if (this.st.phase !== 'idle' && this.st.phase !== 'closed') throw new CoopError('Ya estás en una sala.');
    this.set({ phase: 'opening', role: 'host', note: null, peer: null, peerPos: null, world: null });
    for (let i = 0; i < 5; i++) {
      const code = generateCode();
      try {
        const t = await withTimeout(this.deps.openTransport('host', code), OPEN_TIMEOUT_MS);
        this.attach(t, code);
        this.set({ phase: 'waiting', code });
        return code;
      } catch (e) {
        if (e instanceof CoopError && e.message === 'retry') continue;
        this.set({ phase: 'closed', note: e instanceof CoopError ? e.message : 'No se pudo abrir la sala. Probá de nuevo.' });
        throw e;
      }
    }
    this.set({ phase: 'closed', note: 'No se pudo abrir la sala. Probá de nuevo.' });
    throw new CoopError('No se pudo abrir la sala.');
  }

  async join(input: string): Promise<void> {
    if (this.st.phase !== 'idle' && this.st.phase !== 'closed') throw new CoopError('Ya estás en una sala.');
    const code = normalizeCode(input);
    if (!code) throw new CoopError('Ese código no parece válido: son 6 letras y números.');
    this.set({ phase: 'opening', role: 'guest', code, note: null, peer: null, peerPos: null, world: null });
    try {
      const t = await withTimeout(this.deps.openTransport('guest', code), OPEN_TIMEOUT_MS);
      this.attach(t, code);
    } catch (e) {
      this.set({ phase: 'closed', note: e instanceof CoopError ? e.message : 'No se pudo entrar a la sala. Probá de nuevo.' });
      throw e;
    }
  }

  private attach(t: CoopTransport, code: string) {
    this.t = t;
    this.lastHeard = this.now();
    t.onMessage((raw) => this.receive(raw));
    t.onState((key, v) => {
      this.lastHeard = this.now();
      if (key === 'pos' && isPos(v)) this.set({ peerPos: v });
      else if (key === 'floor' && this.t?.role === 'guest') this.floorHook?.(v);
    });
    t.onPeer((present) => {
      if (present) { this.lastHeard = this.now(); if (t.role === 'guest') t.send({ t: 'hello', v: COOP_VERSION, info: this.deps.me() }); }
      else if (this.st.phase === 'connected') this.end('Tu amigo se desconectó.');
    });
    this.beat = window.setInterval(() => {
      t.state('hb', this.now());
      if ((this.st.phase === 'connected' || this.st.phase === 'waiting') && this.st.peer && this.now() - this.lastHeard > SILENCE_MS) this.end('Se perdió la conexión con tu amigo.');
    }, HEARTBEAT_MS);
    void code;
  }

  private receive(raw: unknown) {
    this.lastHeard = this.now();
    if (!isMsg(raw)) return;
    const t = this.t;
    if (!t) return;
    if (raw.t === 'hello') {
      if (raw.v !== COOP_VERSION) { t.send({ t: 'bye', why: 'version' }); if (t.role === 'host') return; this.end('Tu amigo tiene otra versión del juego. Actualizá los dos.'); return; }
      if (t.role === 'host') {
        if (this.st.peer) return; // a second hello from the same guest
        this.set({ peer: raw.info, phase: 'connected' });
        t.send({ t: 'hello', v: COOP_VERSION, info: this.deps.me() });
        t.send({ t: 'world', world: this.deps.buildWorld() });
      } else this.set({ peer: raw.info });
    } else if (raw.t === 'world') {
      if (t.role !== 'guest') return;
      const world = normalizeWorld(raw.world);
      this.set({ world, phase: 'connected' });
      this.worldHook?.(world);
    } else if (raw.t === 'bye') {
      this.end(raw.why === 'full' ? 'La sala está completa.' : raw.why === 'version' ? 'Tu amigo tiene otra versión del juego.' : t.role === 'guest' ? 'Tu amigo cerró el restaurante.' : 'Tu amigo salió.');
    }
    this.handlers.get(raw.t)?.forEach((f) => f(raw));
  }

  private end(note: string) {
    window.clearInterval(this.beat);
    this.set({ phase: 'closed', note, peerPos: null });
    const t = this.t; this.t = null;
    void t?.close();
  }

  /** The player leaves on purpose. */
  async leave() {
    const t = this.t;
    if (!t) { this.set({ phase: 'idle', role: null, code: null, peer: null, peerPos: null, world: null, note: null }); return; }
    window.clearInterval(this.beat);
    t.send({ t: 'bye', why: 'left' });
    this.t = null;
    await t.close();
    this.set({ phase: 'idle', role: null, code: null, peer: null, peerPos: null, world: null, note: null });
  }
}
