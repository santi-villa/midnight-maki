/** The game's single coop session, wired to the real game state and transport. */
import { bus } from '../core/events';
import { reportError } from '../core/errors';
import { game } from '../core/state';
import { ZONES } from '../data/zones';
import { world } from '../scenes/WorldScene';
import { setSaveBlocked } from '../persistence/storage';
import { cloud } from '../cloud/cloud';
import { social } from '../cloud/social';
import { mirror, normalizeFloor, type PartySnap } from '../restaurant/mirror';
import { buildFloor, dropGuestCooking, releaseGuestClaims, runAct } from './serve';
import { CoopError } from './errors';
import type { ActKind, PeerInfo, PosState, Role, WorldPack } from './protocol';
import { CoopSession } from './session';
import { createBroadcastTransport, type CoopTransport } from './transport';

async function openTransport(role: Role, code: string): Promise<CoopTransport> {
  if (!game.loaded || !world?.player) throw new CoopError('Primero cargá una partida: jugar juntos se abre desde adentro del juego.');
  // `?coop-local` links two tabs of the same browser: for trying it out and for the automatic tests
  if (new URLSearchParams(location.search).has('coop-local')) return createBroadcastTransport(role, code);
  const { databaseConfigured, openFirebaseTransport } = await import('./firebaseTransport');
  if (!databaseConfigured()) throw new CoopError('Jugar juntos todavía no está activado: falta crear la base de datos en tiempo real en Firebase.');
  if (!cloud.status().user) throw new CoopError('Para jugar juntos ingresá primero a tu cuenta.');
  return openFirebaseTransport(role, code);
}

function me(): PeerInfo {
  return { name: game.save.player.name || 'Jugador', appearance: JSON.parse(JSON.stringify(game.save.player.appearance)) };
}

function buildWorld(): WorldPack {
  const s = game.save;
  return {
    decor: JSON.parse(JSON.stringify(s.decor)),
    roomStyle: JSON.parse(JSON.stringify(s.roomStyle)),
    restaurant: { level: s.restaurant.level, upgrades: [...s.restaurant.upgrades], reputation: s.restaurant.reputation },
    time: { day: s.time.day, period: s.time.period, minutes: s.time.minutes },
    restaurantName: s.player.restaurantName,
    weather: game.flag('weather') === 'rain' ? 'rain' : 'clear',
  };
}

export const coop = new CoopSession({ openTransport, buildWorld, me });

// ------------------------------------------------------------------ the guest sees the host's restaurant
interface Stash {
  weather?: number | string | boolean;
  decor: typeof game.save.decor;
  roomStyle: typeof game.save.roomStyle;
  restaurant: { level: number; upgrades: string[]; reputation: number };
  time: { day: number; period: number; minutes: number };
  at: { zone: string; x: number; y: number; dir: 'up' | 'down' | 'left' | 'right' };
}
let stash: Stash | null = null;
export const inGuestWorld = () => stash !== null;

/** Borrow the host's restaurant for this visit. The guest's own save is put back, untouched, when it ends. */
async function enterGuestWorld(w: WorldPack) {
  if (stash) return;
  const s = game.save;
  stash = {
    decor: s.decor, roomStyle: s.roomStyle,
    restaurant: { level: s.restaurant.level, upgrades: s.restaurant.upgrades, reputation: s.restaurant.reputation },
    time: { ...s.time }, weather: s.flags.weather,
    at: { zone: world.zoneId, x: world.player.tx, y: world.player.ty, dir: world.player.dir },
  };
  setSaveBlocked(true);
  if (w.weather) s.flags.weather = w.weather;
  mirror.start();
  s.decor = w.decor; s.roomStyle = w.roomStyle;
  s.restaurant.level = w.restaurant.level; s.restaurant.upgrades = [...w.restaurant.upgrades]; s.restaurant.reputation = w.restaurant.reputation;
  s.time.day = w.time.day; s.time.period = w.time.period; s.time.minutes = w.time.minutes;
  const door = ZONES.plaza.doors.find((d) => d.to === 'restaurant');
  await world.enterZone('restaurant', door?.tx ?? 16, door?.ty ?? 3, door?.dir ?? 'down', true, true);
}

async function leaveGuestWorld() {
  if (!stash) return;
  const st = stash; stash = null;
  mirror.stop();
  const s = game.save;
  s.decor = st.decor; s.roomStyle = st.roomStyle;
  s.restaurant.level = st.restaurant.level; s.restaurant.upgrades = st.restaurant.upgrades; s.restaurant.reputation = st.restaurant.reputation;
  s.time.day = st.time.day; s.time.period = st.time.period; s.time.minutes = st.time.minutes;
  if (st.weather === undefined) delete s.flags.weather; else s.flags.weather = st.weather;
  setSaveBlocked(false);
  await world.enterZone(st.at.zone, st.at.x, st.at.y, st.at.dir, true, true);
}

coop.onWorld((w) => {
  enterGuestWorld(w).catch(async (err) => {
    reportError('coop:enter', err, false);
    await leaveGuestWorld().catch(() => undefined);
    await coop.leave();
    bus.emit('toast', { text: 'No se pudo entrar al restaurante de tu amigo. Probá de nuevo.' });
  });
});

// ------------------------------------------------------------------ shared service
// guest: what the friend's dining room looks like, and requests the host carries out
let actId = 0;
/** requests sent and not answered yet: the same one is not sent again meanwhile, and an answer nobody asked for is ignored */
const pending = new Map<number, { key: string; at: number }>();
mirror.ask = (a: ActKind, arg: { tableId?: string; uid?: number; q?: number; b?: number; v?: string }) => {
  const key = `${a}:${arg.tableId ?? ''}:${arg.uid ?? ''}`;
  const now = Date.now();
  for (const [id, p] of pending) if (now - p.at > 6000) pending.delete(id);
  for (const p of pending.values()) if (p.key === key) return;
  const id = ++actId;
  pending.set(id, { key, at: now });
  coop.send({ t: 'act', id, a, ...arg });
  mirror.predict(a, arg);
};
coop.onFloor((raw) => {
  const s = normalizeFloor(raw);
  if (!s || !mirror.on) return;
  if (stash && s.weather) game.save.flags.weather = s.weather;
  mirror.apply(s);
});
coop.on('res', (m) => {
  const r = m as { id: number; text: string; coins?: number };
  if (!pending.delete(r.id)) return;
  if (r.text) bus.emit('toast', { text: r.text });
  if (r.coins && r.coins > 0) game.addCoins(Math.min(r.coins, 500), 'tip');
});
// guest: the bubbles of the customers in the host's room
coop.on('say', (m) => {
  const x = m as { who: string; text: string; s: number; ex?: string; c?: number };
  if (coop.state().role === 'guest' && mirror.on) world?.coopSay(x.who, x.text, Math.min(8, Math.max(1, x.s)), x.ex, x.c);
});
// host: carry out what the guest asks, then show the result right away
let floorDirty = false;
const handled = new Set<number>();
coop.on('act', (m) => {
  const st = coop.state();
  if (st.role !== 'host' || st.phase !== 'connected') return;
  const act = m as Parameters<typeof runAct>[0];
  if (handled.has(act.id)) return; // a request delivered twice is carried out once
  handled.add(act.id);
  coop.send(runAct(act));
  floorDirty = true;
});
let lastFloor = ''; let lastFloorAt = 0;

/** What the world scene needs: where the friend is, and a way to tell the friend where we are. */
export const coopLink = {
  peer: () => { const st = coop.state(); return st.phase === 'connected' && st.peer && st.peerPos ? { info: st.peer, pos: st.peerPos } : null; },
  send: (p: PosState) => coop.sendPos(p),
  /** true on the host while a friend is in the restaurant: the scene then reports where the customers stand */
  hosting: () => { const st = coop.state(); return st.role === 'host' && st.phase === 'connected'; },
  isDirty: () => { const d = floorDirty; floorDirty = false; return d; },
  /** host: a customer's line (or the coins over their head) goes to the guest too */
  say: (who: string, text: string, s: number, ex?: string, c?: number) => { if (coop.state().role === 'host' && coop.state().phase === 'connected') coop.send({ t: 'say', who, text, s, ...(ex ? { ex } : {}), ...(c ? { c } : {}) }); },
  sendFloor: (parties: PartySnap[]) => {
    const snap = JSON.stringify(buildFloor(parties));
    const now = Date.now();
    if (snap === lastFloor && now - lastFloorAt < 2000) return;
    lastFloor = snap; lastFloorAt = now;
    coop.sendFloor(JSON.parse(snap));
  },
};
let wasGuestConnected = false;
bus.on('coop:changed', () => {
  const st = coop.state();
  const guest = st.role === 'guest' && st.phase === 'connected';
  if (wasGuestConnected && !guest) void leaveGuestWorld();
  wasGuestConnected = guest;
  // plates a friend was carrying go back to the tray when they leave
  if (st.role === 'host' && st.phase !== 'connected') { releaseGuestClaims(); dropGuestCooking(); handled.clear(); }
  if (st.role === 'guest' && st.phase !== 'connected') pending.clear();
});

// ------------------------------------------------------------------ the restaurant stays open to friends
const PREF = 'mm_coop_open';
/** Open to friends by default: anyone with your friend code can come in while you are online. Turn it off any time. */
export function coopOpenPref(): boolean { try { return localStorage.getItem(PREF) !== '0'; } catch { return true; } }
let userClosed = false;
let retryAt = 0;

export function setCoopOpenPref(on: boolean) {
  try { localStorage.setItem(PREF, on ? '1' : '0'); } catch { /* the choice lasts until the page closes */ }
  userClosed = !on;
  retryAt = 0;
  const st = coop.state();
  if (!on && st.role === 'host' && (st.phase === 'opening' || st.phase === 'waiting' || st.phase === 'connected')) void coop.leave();
  else if (on) void autoOpen();
}

/** The host closes the room by hand: it stays closed until they open it again or reload the game. */
export async function leaveCoop() {
  if (coop.state().role === 'host') userClosed = true;
  await coop.leave();
}
/** Open (again) the room that belongs to this account, if the player wants it. */
export async function openMyRoom() { userClosed = false; retryAt = 0; await autoOpen(true); }

async function autoOpen(manual = false) {
  const st = coop.state();
  if (st.phase !== 'idle' && st.phase !== 'closed') return;
  if (!manual && (!coopOpenPref() || userClosed || Date.now() < retryAt)) return;
  if (!game.loaded || !world?.player || !cloud.status().user) return;
  if (new URLSearchParams(location.search).has('coop-local')) return;
  retryAt = Date.now() + 60_000;
  try {
    const { databaseConfigured } = await import('./firebaseTransport');
    if (!databaseConfigured()) return;
    const code = await social.myCode();
    if (coop.state().phase === 'idle' || coop.state().phase === 'closed') await coop.host(code);
  } catch (e) { if (manual) throw e; }
}
setInterval(() => { void autoOpen(); }, 5000);

/** Join a friend's restaurant. My own open room (with nobody in it) is closed first. */
export async function joinFriend(code: string) {
  const st = coop.state();
  if (st.role === 'host' && st.phase === 'connected') throw new CoopError('Tenés a un amigo en tu restaurante. Cerrá tu sala primero.');
  if (st.role === 'host' && st.phase === 'waiting') await coop.leave();
  if (coop.state().phase === 'closed') await coop.leave();
  await coop.join(code);
}

// signs for who came in and who left, on both sides
import { sign } from './notice';
let peerName: string | null = null;
let wasTogether = false;
bus.on('coop:changed', () => {
  const st = coop.state();
  const together = st.phase === 'connected';
  const name = st.peer?.name ?? 'Tu amigo';
  if (together && !wasTogether) {
    peerName = name;
    sign(st.role === 'host' ? `${name} entró a tu restaurante.` : `Entraste al restaurante de ${name}.`, { icon: '👋', seconds: 4, key: 'coop-presence' });
  } else if (!together && wasTogether) {
    const who = peerName ?? name;
    const note = (st.note ?? '').replace('Tu amigo', who);
    // the player's own exit says nothing; anything else is explained
    if (st.phase !== 'idle') sign(note || `${who} salió.`, { icon: st.role === 'host' ? '🚪' : '🏮', seconds: 7, key: 'coop-presence' });
    peerName = null;
  }
  wasTogether = together;
});

void import('./sleepTogether');
