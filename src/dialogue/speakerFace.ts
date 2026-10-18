/** Who is speaking, and which picture belongs in the dialogue box. */
import type { Expr } from '../art/characters';
import { buildPortrait } from '../art/characters';
import { buildCustomerFrames, type CustomerId } from '../art/customers';
import { ctx2d, makeCanvas } from '../art/pixel';
import { PixBuf } from '../art/pixbuf';
import { narratorPortrait, NARRATOR_PORTRAIT_IMAGE } from '../art/narratorPortrait';
import { game } from '../core/state';
import type { Appearance, Species } from '../core/types';
import { CHAR_BY_ID, CHARACTERS } from '../data/characters';
import { NEIGHBOR_BY_ID, NEIGHBORS } from '../data/neighbors';
import { portraitURL } from '../systems/appearance';
import { customerLook } from '../restaurant/customers';
import { GENERIC_CUSTOMERS } from '../restaurant/orders';

export type SpeakerArt =
  | { kind: 'narr' }
  | { kind: 'letter' }
  | { kind: 'player' }
  | { kind: 'character'; id: string }
  | { kind: 'neighbor'; id: string }
  | { kind: 'customer'; id: CustomerId; seed?: string }
  | { kind: 'guest'; id: string };

export interface SpeakerFace {
  id: string;
  /** who the voice belongs to when `id` is empty (customers, visitors); the narrator and letters have none */
  vkey?: string;
  name: string;
  voice: number;
  art: SpeakerArt;
}

const SPECIES: Species[] = ['cat', 'fox', 'bunny', 'bear', 'dog', 'otter', 'squirrel', 'owl'];
const FURS = ['#e2a96b', '#f0e6d8', '#8a6a4a', '#c27f86', '#6b5444', '#b9764b', '#e8e0d4', '#8a8f9a'];
const HAIR = ['#2b2231', '#5b3a2e', '#a8503a', '#c9a24a', '#c9c2b4'];
const TOPS = ['top_tee_sage', 'top_cardigan_moss', 'top_hoodie_lav', 'top_kimono_indigo', 'top_sweater_rose', 'top_tee_cream'];

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function named<T extends { id: string; name: string }>(list: readonly T[], name: string): T | undefined {
  const key = name.trim().toLowerCase();
  return list.find((item) => item.name.toLowerCase() === key);
}

function customerIdOf(idOrName: string): CustomerId | null {
  const generic = GENERIC_CUSTOMERS.find((c) => c.id === idOrName) ?? named(GENERIC_CUSTOMERS, idOrName);
  if (!generic) return null;
  return customerLook(generic.id);
}

function faceForId(id: string, name: string): SpeakerFace | null {
  const def = CHAR_BY_ID[id];
  if (def) return { id, name: name || def.name, voice: def.voice, art: { kind: 'character', id } };
  const neighbor = NEIGHBOR_BY_ID[id];
  if (neighbor) return { id, name: name || neighbor.name, voice: 0.95, art: { kind: 'neighbor', id } };
  const customer = customerIdOf(id);
  if (customer) return { id: '', vkey: 'guest:' + id, name: name || id, voice: 0.9, art: { kind: 'customer', id: customer, seed: id } };
  return null;
}

function faceForName(name: string): SpeakerFace | null {
  const def = named(CHARACTERS, name);
  if (def) return faceForId(def.id, name);
  const neighbor = named(NEIGHBORS, name);
  if (neighbor) return faceForId(neighbor.id, name);
  const customer = customerIdOf(name);
  if (customer) return { id: '', vkey: 'guest:' + name, name, voice: 0.9, art: { kind: 'customer', id: customer, seed: named(GENERIC_CUSTOMERS, name)?.id } };
  return null;
}

/** Resolves narrators, the player, neighbours, customers and unnamed speakers. */
export function speakerFace(who: string): SpeakerFace {
  if (who === 'narr') return { id: '', name: '', voice: 1, art: { kind: 'narr' } };
  if (who === 'player') return { id: 'player', name: game.save.player.name, voice: 1.2, art: { kind: 'player' } };
  if (who.startsWith('?')) {
    const [nm, pid] = who.slice(1).split('|');
    const name = nm || '???';
    if (pid) {
      const known = faceForId(pid, name);
      if (known) return known;
    }
    const byName = faceForName(name);
    if (byName) return byName;
    if (/carta/i.test(name)) return { id: '', name, voice: 0.85, art: { kind: 'letter' } };
    return { id: '', vkey: 'guest:' + name, name, voice: 0.9, art: { kind: 'guest', id: name } };
  }
  return faceForId(who, '') ?? faceForName(who) ?? (
    /carta/i.test(who)
      ? { id: '', name: who, voice: 0.85, art: { kind: 'letter' } }
      : { id: who, vkey: 'guest:' + who, name: who, voice: 1, art: { kind: 'guest', id: who } }
  );
}

const pictures = new Map<string, string>();

function urlOf(buf: PixBuf): string {
  const c = makeCanvas(buf.w, buf.h);
  const g = ctx2d(c);
  const img = g.createImageData(buf.w, buf.h);
  img.data.set(buf.data);
  g.putImageData(img, 0, 0);
  return c.toDataURL();
}

function cropTop(src: PixBuf, h: number): PixBuf {
  const out = new PixBuf(src.w, h);
  out.data.set(src.data.subarray(0, src.w * h * 4));
  return out;
}

function letter(): PixBuf {
  const b = new PixBuf(18, 22);
  b.rect(2, 3, 14, 16, '#f6ecd6');
  b.rect(2, 3, 14, 3, '#d9c4a0');
  b.hline(4, 9, 10, '#c4b49a');
  b.hline(4, 12, 8, '#c4b49a');
  b.hline(4, 15, 6, '#c4b49a');
  b.outline('#2b1d17');
  return b;
}

function guestLook(seed: string): Appearance {
  const n = hash(seed);
  return {
    species: SPECIES[n % SPECIES.length],
    skin: FURS[n % FURS.length],
    hairStyle: n % 4,
    hairColor: HAIR[(n >>> 3) % HAIR.length],
    eyes: n % 3,
    eyeColor: '#3b2a22',
    top: TOPS[(n >>> 5) % TOPS.length],
    bottom: '',
    shoes: '',
    head: '',
    face: '',
    extra: '',
    bag: '',
  };
}

/** A picture for every speaker, including the narrator and people without a stored portrait. */
export function portraitSrc(face: SpeakerFace, expr: Expr = 'neutral'): string {
  const art = face.art;
  const key = art.kind === 'character' || art.kind === 'neighbor' || art.kind === 'player' || art.kind === 'guest' || art.kind === 'customer'
    ? `${art.kind}:${art.kind === 'player' ? 'player' : art.id}:${art.kind === 'customer' ? art.seed ?? '' : ''}:${expr}`
    : art.kind;
  const cached = pictures.get(key);
  if (cached) return cached;
  let url: string;
  if (art.kind === 'narr') url = NARRATOR_PORTRAIT_IMAGE ?? urlOf(narratorPortrait().scaled(3));
  else if (art.kind === 'letter') url = urlOf(letter().scaled(4));
  else if (art.kind === 'player') url = portraitURL('player', expr);
  else if (art.kind === 'character') url = portraitURL(art.id, expr);
  else if (art.kind === 'neighbor') url = buildPortrait(NEIGHBOR_BY_ID[art.id].look, expr, [], 4).toDataURL();
  else if (art.kind === 'customer') url = urlOf(cropTop(buildCustomerFrames(art.id, { seed: art.seed })[0], 24).scaled(3));
  else url = buildPortrait(guestLook(art.id), expr, [], 4).toDataURL();
  pictures.set(key, url);
  return url;
}
