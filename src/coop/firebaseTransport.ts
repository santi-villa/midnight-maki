/** Firebase Realtime Database transport. Needs VITE_FIREBASE_DATABASE_URL and the rules in database.rules.json. */
import { getApp } from 'firebase/app';
import { get, getDatabase, onChildAdded, onDisconnect, onValue, push, ref, remove, runTransaction, set, type Database } from 'firebase/database';
import { doc, getDoc } from 'firebase/firestore';
import { firebaseDb, firebaseUid } from '../cloud/firebase';
import { CoopError } from './errors';
import { pack, unpack, type Role } from './protocol';
import type { CoopTransport } from './transport';

export function databaseConfigured(): boolean { return !!import.meta.env.VITE_FIREBASE_DATABASE_URL; }
function db(): Database { return getDatabase(getApp(), import.meta.env.VITE_FIREBASE_DATABASE_URL as string); }

const ROOM_TTL = 6 * 3600_000;

function friendly(e: unknown): CoopError {
  if (e instanceof CoopError) return e;
  const msg = String((e as { message?: string })?.message ?? e);
  if (/permission[_ ]denied/i.test(msg)) return new CoopError('La base en tiempo real no te deja entrar: pegá database.rules.json en Realtime Database → Reglas y tocá Publicar.');
  if (/url|database/i.test(msg)) return new CoopError('La URL de la base en tiempo real no es válida. Revisá VITE_FIREBASE_DATABASE_URL en .env.local.');
  return new CoopError('No se pudo abrir la sala. Probá de nuevo.');
}

/**
 * A room is named after its host's account, so a friend's code always leads to the same place and nobody else can open it.
 * The guest types (or taps) the host's friend code and it is looked up here.
 */
async function roomOwner(code: string): Promise<string> {
  const hit = await getDoc(doc(firebaseDb(), 'codes', code));
  if (!hit.exists()) throw new CoopError('No encontré a nadie con ese código.');
  return String(hit.data().uid);
}

export type RoomState = 'closed' | 'open' | 'busy';

/** Which of these players have their restaurant open to visitors right now. Calls back on every change; returns the unsubscribe. */
export function watchRooms(uids: string[], cb: (uid: string, state: RoomState) => void): () => void {
  const d = db();
  const offs: (() => void)[] = [];
  for (const u of uids) {
    let host = false, guest = false;
    const emit = () => cb(u, !host ? 'closed' : guest ? 'busy' : 'open');
    offs.push(onValue(ref(d, `coop/${u}/presence/host`), (s) => { host = s.exists(); emit(); }, () => cb(u, 'closed')));
    offs.push(onValue(ref(d, `coop/${u}/presence/guest`), (s) => { guest = s.exists(); emit(); }, () => undefined));
  }
  return () => offs.forEach((o) => o());
}

/** Host: open the room that belongs to this account. Guest: take the empty seat of the host's room. */
export async function openFirebaseTransport(role: Role, code: string): Promise<CoopTransport> {
  try { return await open(role, code); } catch (e) { throw friendly(e); }
}

async function open(role: Role, code: string): Promise<CoopTransport> {
  const uid = firebaseUid();
  if (!uid) throw new CoopError('Primero ingresá a tu cuenta.');
  const d = db();
  const owner = role === 'host' ? uid : await roomOwner(code);
  const base = `coop/${owner}`;
  if (role === 'host') {
    const claimed = await runTransaction(ref(d, `${base}/meta`), (cur) => {
      if (cur && cur.hostUid !== uid && Date.now() - Number(cur.createdAt || 0) < ROOM_TTL) return undefined;
      return { hostUid: uid, createdAt: Date.now() };
    });
    if (!claimed.committed) throw new CoopError('retry');
    await remove(ref(d, `${base}/toGuest`)); await remove(ref(d, `${base}/toHost`));
  } else {
    const meta = await get(ref(d, `${base}/meta`));
    if (!meta.exists()) throw new CoopError('Tu amigo no tiene el restaurante abierto ahora.');
    if (meta.val().hostUid === uid) throw new CoopError('Esa sala es tuya: pedile el código a tu amigo.');
    const host = await get(ref(d, `${base}/presence/host`));
    if (!host.exists()) throw new CoopError('Tu amigo no tiene el restaurante abierto ahora.');
    const seat = await runTransaction(ref(d, `${base}/meta/guestUid`), (cur) => (cur == null || cur === uid ? uid : undefined));
    if (!seat.committed) throw new CoopError('Esa sala ya está completa (máximo 2 personas).');
  }
  const other: Role = role === 'host' ? 'guest' : 'host';
  const mine = `${base}/${role === 'host' ? 'toHost' : 'toGuest'}`;   // what I read
  const theirs = `${base}/${role === 'host' ? 'toGuest' : 'toHost'}`; // what I write
  const myPresence = ref(d, `${base}/presence/${role}`);
  await set(myPresence, true);
  void onDisconnect(myPresence).remove();

  const handlers = { msg: [] as ((m: unknown) => void)[], state: [] as ((k: string, v: unknown) => void)[], peer: [] as ((p: boolean) => void)[] };
  const offs: (() => void)[] = [];
  offs.push(onChildAdded(ref(d, `${mine}/q`), (snap) => { const v = unpack((snap.val() as { j?: string } | null)?.j); void remove(snap.ref); if (v) handlers.msg.forEach((f) => f(v)); }));
  const seen: Record<string, number> = {};
  offs.push(onValue(ref(d, `${mine}/state`), (snap) => {
    snap.forEach((c) => { const v = c.val() as { j: string; n: number } | null; if (v && v.n !== seen[c.key!]) { seen[c.key!] = v.n; handlers.state.forEach((f) => f(c.key!, unpack(v.j))); } });
  }));
  let present = false;
  offs.push(onValue(ref(d, `${base}/presence/${other}`), (snap) => { present = snap.exists(); handlers.peer.forEach((f) => f(present)); }));
  let n = 0;
  return {
    role,
    send(msg) { void push(ref(d, `${theirs}/q`), { j: pack(msg) }).catch(() => undefined); },
    state(key, value) { void set(ref(d, `${theirs}/state/${key}`), { j: pack(value), n: ++n }).catch(() => undefined); },
    onMessage(fn) { handlers.msg.push(fn); },
    onState(fn) { handlers.state.push(fn); },
    onPeer(fn) { handlers.peer.push(fn); if (present) fn(true); },
    /** host: the guest is gone: empty the seat and the mailboxes so the next one starts clean */
    async resetGuest() {
      if (role !== 'host') return;
      await Promise.all([remove(ref(d, `${base}/toGuest`)), remove(ref(d, `${base}/toHost`)), remove(ref(d, `${base}/meta/guestUid`))]).catch(() => undefined);
      for (const k of Object.keys(seen)) delete seen[k];
    },
    async close() {
      offs.forEach((o) => o());
      await remove(myPresence).catch(() => undefined);
      if (role === 'host') await remove(ref(d, base)).catch(() => undefined);
      else await remove(ref(d, `${base}/meta/guestUid`)).catch(() => undefined);
    },
  };
}
