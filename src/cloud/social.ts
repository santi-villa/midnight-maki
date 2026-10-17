/**
 * Friends online, first slice: a public restaurant card, a friend code, a friend list and fixed postcards.
 * Firestore layout (see firestore.rules):
 *   profiles/{uid}            public card, readable by any signed-in player, written only by its owner
 *   codes/{code}              friend code -> uid
 *   users/{uid}/friends/{id}  who this player follows (one-way: no friend request to approve)
 *   users/{uid}/inbox/{from}  the postcard a friend sent; one per sender, a new one replaces the old
 */
import { collection, deleteDoc, doc, getDoc, getDocs, runTransaction, setDoc } from 'firebase/firestore';
import { game } from '../core/state';
import type { Appearance } from '../core/types';
import { cloud } from './cloud';
import { firebaseDb, firebaseUid } from './firebase';
import { generateCode, normalizeCode, POSTCARD_BY_ID } from './friendCode';
import { CloudError } from './types';

export interface Profile {
  uid: string;
  name: string;
  restaurant: string;
  level: number;
  reputation: number;
  served: number;
  recipes: number;
  appearance: Appearance;
  code: string;
}
export interface Postcard { from: string; fromName: string; card: string; at: number }

const CODE_KEY = 'mm_friend_code';
let lastPublished = '';

function me(): string {
  const uid = firebaseUid();
  if (!uid || !cloud.status().user) throw new CloudError('Primero ingresá a tu cuenta.');
  return uid;
}

function myCardBody() {
  const s = game.save;
  return {
    name: s.player.name || 'Jugador',
    restaurant: s.player.restaurantName || 'Midnight Maki',
    level: s.restaurant.level,
    reputation: Math.round(s.restaurant.reputation),
    served: s.restaurant.served,
    recipes: Object.values(s.recipesCooked).filter((n) => n > 0).length,
    appearance: JSON.parse(JSON.stringify(s.player.appearance)),
  };
}

/** Claim a free code once and keep it. Collisions retry with another code. */
async function ensureCode(uid: string): Promise<string> {
  const db = firebaseDb();
  const mine = await getDoc(doc(db, 'profiles', uid));
  const known = mine.exists() ? String(mine.data().code ?? '') : localStorage.getItem(`${CODE_KEY}:${uid}`) ?? '';
  if (normalizeCode(known)) return known;
  for (let i = 0; i < 8; i++) {
    const code = generateCode();
    const ok = await runTransaction(db, async (tx) => {
      const ref = doc(db, 'codes', code);
      if ((await tx.get(ref)).exists()) return false;
      tx.set(ref, { uid });
      return true;
    });
    if (ok) { try { localStorage.setItem(`${CODE_KEY}:${uid}`, code); } catch { /* the profile keeps it */ } return code; }
  }
  throw new CloudError('No se pudo crear tu código. Probá de nuevo.');
}

export const social = {
  /** Publish (or refresh) this player's card. Cheap when nothing changed. */
  async publishProfile(force = false): Promise<string> {
    const uid = me();
    const body = myCardBody();
    const code = await ensureCode(uid);
    const key = JSON.stringify(body) + code;
    if (!force && key === lastPublished) return code;
    await setDoc(doc(firebaseDb(), 'profiles', uid), { ...body, code, updatedAt: Date.now() });
    lastPublished = key;
    return code;
  },

  async myCode(): Promise<string> { return social.publishProfile(); },

  async addFriend(input: string): Promise<Profile> {
    const uid = me();
    const code = normalizeCode(input);
    if (!code) throw new CloudError('Ese código no parece válido: son 6 letras y números.');
    const db = firebaseDb();
    const hit = await getDoc(doc(db, 'codes', code));
    if (!hit.exists()) throw new CloudError('No encontré a nadie con ese código.');
    const friendUid = String(hit.data().uid);
    if (friendUid === uid) throw new CloudError('Ese es tu propio código.');
    const profile = await getDoc(doc(db, 'profiles', friendUid));
    if (!profile.exists()) throw new CloudError('Esa persona todavía no publicó su restaurante.');
    await setDoc(doc(db, 'users', uid, 'friends', friendUid), { at: Date.now() });
    return { uid: friendUid, ...(profile.data() as Omit<Profile, 'uid'>) };
  },

  async removeFriend(friendUid: string): Promise<void> {
    await deleteDoc(doc(firebaseDb(), 'users', me(), 'friends', friendUid));
  },

  async friends(): Promise<Profile[]> {
    const uid = me();
    const db = firebaseDb();
    const ids = (await getDocs(collection(db, 'users', uid, 'friends'))).docs.map((d) => d.id);
    const out: Profile[] = [];
    for (const id of ids) {
      const p = await getDoc(doc(db, 'profiles', id));
      if (p.exists()) out.push({ uid: id, ...(p.data() as Omit<Profile, 'uid'>) });
    }
    return out.sort((a, b) => b.level - a.level || a.name.localeCompare(b.name, 'es'));
  },

  async sendPostcard(friendUid: string, cardId: string): Promise<void> {
    const uid = me();
    if (!POSTCARD_BY_ID[cardId]) throw new CloudError('Esa tarjeta no existe.');
    await setDoc(doc(firebaseDb(), 'users', friendUid, 'inbox', uid), { fromName: myCardBody().name, card: cardId, at: Date.now() });
  },

  async inbox(): Promise<Postcard[]> {
    const uid = me();
    const snap = await getDocs(collection(firebaseDb(), 'users', uid, 'inbox'));
    return snap.docs.map((d) => ({ from: d.id, fromName: String(d.data().fromName ?? 'Un amigo'), card: String(d.data().card ?? ''), at: Number(d.data().at) || 0 }))
      .filter((p) => POSTCARD_BY_ID[p.card]).sort((a, b) => b.at - a.at);
  },

  async clearPostcard(from: string): Promise<void> {
    await deleteDoc(doc(firebaseDb(), 'users', me(), 'inbox', from));
  },
};
