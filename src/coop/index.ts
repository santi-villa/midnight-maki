/** The game's single coop session, wired to the real game state and transport. */
import { game } from '../core/state';
import { ZONES } from '../data/zones';
import { world } from '../scenes/WorldScene';
import { setSaveBlocked } from '../persistence/storage';
import { cloud } from '../cloud/cloud';
import { CoopError } from './errors';
import type { PeerInfo, PosState, Role, WorldPack } from './protocol';
import { CoopSession } from './session';
import { createBroadcastTransport, type CoopTransport } from './transport';

async function openTransport(role: Role, code: string): Promise<CoopTransport> {
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
  };
}

export const coop = new CoopSession({ openTransport, buildWorld, me });

// ------------------------------------------------------------------ the guest sees the host's restaurant
interface Stash {
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
    time: { ...s.time },
    at: { zone: world.zoneId, x: world.player.tx, y: world.player.ty, dir: world.player.dir },
  };
  setSaveBlocked(true);
  s.decor = w.decor; s.roomStyle = w.roomStyle;
  s.restaurant.level = w.restaurant.level; s.restaurant.upgrades = [...w.restaurant.upgrades]; s.restaurant.reputation = w.restaurant.reputation;
  s.time.day = w.time.day; s.time.period = w.time.period; s.time.minutes = w.time.minutes;
  const door = ZONES.plaza.doors.find((d) => d.to === 'restaurant');
  await world.enterZone('restaurant', door?.tx ?? 16, door?.ty ?? 3, door?.dir ?? 'down', true, true);
}

async function leaveGuestWorld() {
  if (!stash) return;
  const st = stash; stash = null;
  const s = game.save;
  s.decor = st.decor; s.roomStyle = st.roomStyle;
  s.restaurant.level = st.restaurant.level; s.restaurant.upgrades = st.restaurant.upgrades; s.restaurant.reputation = st.restaurant.reputation;
  s.time.day = st.time.day; s.time.period = st.time.period; s.time.minutes = st.time.minutes;
  setSaveBlocked(false);
  await world.enterZone(st.at.zone, st.at.x, st.at.y, st.at.dir, true, true);
}

coop.onWorld((w) => { void enterGuestWorld(w); });

/** What the world scene needs: where the friend is, and a way to tell the friend where we are. */
export const coopLink = {
  peer: () => { const st = coop.state(); return st.phase === 'connected' && st.peer && st.peerPos ? { info: st.peer, pos: st.peerPos } : null; },
  send: (p: PosState) => coop.sendPos(p),
};
let wasGuestConnected = false;
import('../core/events').then(({ bus }) => bus.on('coop:changed', () => {
  const st = coop.state();
  const guest = st.role === 'guest' && st.phase === 'connected';
  if (wasGuestConnected && !guest) void leaveGuestWorld();
  wasGuestConnected = guest;
}));
