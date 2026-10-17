/** What the two players say to each other. The host's game is the authority; the guest asks and the host answers. */
import type { Appearance, Dir, PlacedFurniture } from '../core/types';

export const COOP_VERSION = 4;
export type Role = 'host' | 'guest';

export interface PeerInfo { name: string; appearance: Appearance }
export interface PosState { x: number; y: number; dir: Dir; moving: boolean; zone: string }

/** The parts of the host's restaurant the guest needs to see it the same way. */
export interface WorldPack {
  decor: Record<string, PlacedFurniture[]>;
  roomStyle: Record<string, { floor: string; wall: string }>;
  restaurant: { level: number; upgrades: string[]; reputation: number };
  time: { day: number; period: number; minutes: number };
  restaurantName: string;
}

/** What the guest can ask the host to do in the dining room. The host checks everything again. */
export type ActKind = 'take' | 'claim' | 'release' | 'deliver' | 'tip' | 'cookTake' | 'cookCancel' | 'plate';
export const ACT_KINDS: ActKind[] = ['take', 'claim', 'release', 'deliver', 'tip', 'cookTake', 'cookCancel', 'plate'];
/** `plate` reports a finished dish: quality 0-2, the bonus the board gave, and the variant name. */
export interface ActMsg { t: 'act'; id: number; a: ActKind; tableId?: string; uid?: number; q?: number; b?: number; v?: string }
/** The host's answer: a line to show, and the tip coins that now belong to the guest. */
export interface ResMsg { t: 'res'; id: number; text: string; coins?: number }

export type Msg =
  | { t: 'hello'; v: number; info: PeerInfo }
  | { t: 'world'; world: WorldPack }
  | ActMsg
  | ResMsg
  | { t: 'bye'; why: 'left' | 'full' | 'closed' | 'version' };

export type StateKey = 'pos' | 'hb' | 'floor';

/**
 * Realtime Database drops empty arrays and objects and turns some arrays into objects, so anything that crosses it is sent as one
 * JSON string. This also repairs a world pack that still arrives mangled: the guest must never end up with a missing decor or menu.
 */
const asArray = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : v && typeof v === 'object' ? (Object.values(v) as T[]) : []);
const asObject = <T>(v: unknown): Record<string, T> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, T>) : {});

export function normalizeWorld(raw: Partial<WorldPack> | null | undefined): WorldPack {
  const w = (raw ?? {}) as Partial<WorldPack>;
  const decor: Record<string, PlacedFurniture[]> = {};
  for (const [room, list] of Object.entries(asObject<unknown>(w.decor))) decor[room] = asArray<PlacedFurniture>(list);
  const r = (w.restaurant ?? {}) as Partial<WorldPack['restaurant']>;
  const t = (w.time ?? {}) as Partial<WorldPack['time']>;
  return {
    decor,
    roomStyle: asObject<{ floor: string; wall: string }>(w.roomStyle),
    restaurant: { level: Number(r.level) || 1, upgrades: asArray<string>(r.upgrades), reputation: Number(r.reputation) || 0 },
    time: { day: Number(t.day) || 1, period: Number(t.period) || 0, minutes: Number(t.minutes) || 0 },
    restaurantName: typeof w.restaurantName === 'string' ? w.restaurantName : 'Midnight Maki',
  };
}

export const pack = (v: unknown): string => JSON.stringify(v);
export function unpack(s: unknown): unknown { try { return typeof s === 'string' ? JSON.parse(s) : s; } catch { return null; } }

export function isMsg(m: unknown): m is Msg {
  if (!m || typeof m !== 'object') return false;
  const t = (m as { t?: unknown }).t;
  if (t === 'hello') { const x = m as { v?: unknown; info?: { name?: unknown } }; return typeof x.v === 'number' && typeof x.info?.name === 'string'; }
  if (t === 'world') return typeof (m as { world?: unknown }).world === 'object' && (m as { world?: unknown }).world !== null;
  if (t === 'act') { const x = m as { id?: unknown; a?: unknown; tableId?: unknown; uid?: unknown; q?: unknown; b?: unknown; v?: unknown }; return Number.isFinite(x.id) && ACT_KINDS.includes(String(x.a) as ActKind) && (x.tableId === undefined || typeof x.tableId === 'string') && (x.uid === undefined || Number.isFinite(x.uid)) && (x.q === undefined || Number.isFinite(x.q)) && (x.b === undefined || Number.isFinite(x.b)) && (x.v === undefined || typeof x.v === 'string'); }
  if (t === 'res') { const x = m as { id?: unknown; text?: unknown; coins?: unknown }; return Number.isFinite(x.id) && typeof x.text === 'string' && (x.coins === undefined || Number.isFinite(x.coins)); }
  if (t === 'bye') return ['left', 'full', 'closed', 'version'].includes(String((m as { why?: unknown }).why));
  return false;
}

export function isPos(v: unknown): v is PosState {
  if (!v || typeof v !== 'object') return false;
  const p = v as Record<string, unknown>;
  return Number.isFinite(p.x) && Number.isFinite(p.y) && ['up', 'down', 'left', 'right'].includes(String(p.dir)) && typeof p.moving === 'boolean' && typeof p.zone === 'string';
}

/** Short room codes reuse the friend-code alphabet, so they are easy to read out loud. */
export const ROOM_CODE_LENGTH = 6;
