/**
 * Contextual actions for the player. Pure: no Phaser and no DOM.
 * The world scene feeds positions; this module decides what is relevant
 * and how to fold extras into a compact menu.
 */
import { game } from '../core/state';
import type { Dir } from '../core/types';
import { DRINK_BY_ID } from '../restaurant/drinkData';
import { RECIPES_BY_ID } from '../data/recipes';
import { ZONES, type DoorDef, type InteractDef, type RoomDef } from '../data/zones';
import { canCook, customerName } from '../restaurant/orders';
import { carriedOrder, trayOrders, tableJobs, type TableJob } from '../restaurant/service';
import { galleyOn } from '../galley/mode';
import { hostHasIngredients, mirror } from '../restaurant/mirror';
import type { GatherSpot } from '../systems/gather';

export const TILE = 16;

const FACING: Record<Dir, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const TABLE_KINDS = new Set(['table', 'roundtable', 'kotatsu']);

export type ActionIcon = 'talk' | 'gift' | 'act' | 'door' | 'bed' | 'decor' | 'maki' | 'clipboard' | 'serve' | 'coin' | 'inspect' | 'shop' | 'heart';

export type Target =
  | { kind: 'npc'; id: string; label: string }
  | { kind: 'neighbor'; id: string; label: string }
  | { kind: 'interact'; def: InteractDef; label: string }
  | { kind: 'door'; def: DoorDef; label: string }
  | { kind: 'gather'; spot: GatherSpot; label: string }
  | { kind: 'bug'; idx: number; label: string };

export type ContextIntent =
  | { type: 'pet'; id: string }
  | { type: 'target'; target: Target }
  | { type: 'gift'; npcId: string }
  | { type: 'company'; npcId: string }
  | { type: 'decorate' }
  | { type: 'orders' }
  | { type: 'tray' }
  | { type: 'takeOrder'; tableId: string }
  | { type: 'cookOrder'; uid: number }
  | { type: 'galley'; station: string; verb: string }
  | { type: 'deliver'; tableId: string }
  | { type: 'tip'; tableId: string };

export interface ContextAction {
  id: string;
  /** Short label on the touch button. */
  label: string;
  /** Longer line inside the compact menu. */
  detail: string;
  icon: ActionIcon;
  intent: ContextIntent;
}

/** Talking to someone (a character or a neighbour). */
export const isTalk = (a: ContextAction | null | undefined): boolean => !!a && (a.id.startsWith('npc:') || a.id.startsWith('nb:'));
/** Things you do with somebody besides talking (company, a gift, petting): never the main action. */
const isSocial = (a: ContextAction): boolean => a.id.startsWith('company:') || a.id.startsWith('gift:') || a.id.startsWith('pet:');

/**
 * E and F are the two best things to do, Space talks, and the numbered list (Q) holds everything in the order it was first
 * seen, so a new action always lands at the bottom. Company, gifts and petting only live in the list.
 */
export function arrange(o: ContextOffer, seen: Map<string, number>): ContextOffer {
  const ranked = [o.primary, o.chip, ...o.overflow].filter((a): a is ContextAction => !!a);
  if (!ranked.length) return o;
  let next = seen.size ? Math.max(...seen.values()) + 1 : 0;
  for (const a of ranked) if (!seen.has(a.id)) seen.set(a.id, next++);
  const talk = ranked.find(isTalk) ?? null;
  const deeds = ranked.filter((a) => !isTalk(a) && !isSocial(a));
  const [main = null, second = null] = deeds;
  const all = [...ranked].sort((a, b) => (seen.get(a.id) ?? 0) - (seen.get(b.id) ?? 0));
  return { ...o, primary: main, chip: second, talk, overflow: ranked.filter((a) => a !== main && a !== second && a !== talk), all };
}

/** The numbered list (Space). Without `all` (an offer that was not arranged) it is the old "everything but E". */
export const secondaryActions = (o: ContextOffer): ContextAction[] => o.all ?? [...(o.chip ? [o.chip] : []), ...o.overflow];
/** The list is worth opening when something does not fit on E, F and Space. */
export const needsMore = (o: ContextOffer): boolean => (o.all ? o.overflow.length > 0 : !!o.primary && secondaryActions(o).length > 1);

export interface ContextOffer {
  primary: ContextAction | null;
  /** Second action, shown beside the primary when there are only two. */
  chip: ContextAction | null;
  /** Everything past the first two. The HUD opens these from Más. */
  overflow: ContextAction[];
  /** Name plaque for the player's own room, otherwise null. */
  roomTag: string | null;
  /** Everything on offer in a stable order (the numbered list). Set once arranged. */
  all?: ContextAction[];
  /** Whoever is close to talk to (Space). Set once arranged. */
  talk?: ContextAction | null;
}

export interface SenseFurniture {
  uid: number;
  id: string;
  kind: string;
  name: string;
  room: string;
  x: number;
  y: number;
  w: number;
  h: number;
  sit?: boolean;
}

export interface ContextSense {
  pets?: { id: string; name: string; x: number; y: number }[];
  zoneId: string;
  px: number;
  py: number;
  dir: Dir;
  room: RoomDef | null;
  npcs: { id: string; name: string; x: number; y: number; company?: boolean }[];
  /** ambient neighbours walking by */
  neighbors?: { id: string; name: string; x: number; y: number }[];
  interacts: InteractDef[];
  doors: DoorDef[];
  gathers: { x: number; y: number; label: string; spot: GatherSpot }[];
  bugs: { x: number; y: number; idx: number; label: string }[];
  furniture: SenseFurniture[];
  /** True when that tile cannot be stood on. Missing means every tile off the table is open. */
  blocked?: (x: number, y: number) => boolean;
  /** Seated customers, so an order can be taken from beside the person as well as the table. */
  guests?: { tableId: string; x: number; y: number }[];
  /** What the physical kitchen's stations next to the player offer (already limited to the ones in reach). */
  galley?: { action: ContextAction; x: number; y: number; bias: number }[];
}

export function isPlayerRoom(room: { id: string; owner?: string } | null | undefined): boolean {
  return !!room && (room.owner === 'player' || room.id === 'room_player');
}

/** Why decoration is refused, or null when this room may be edited. */
export function decorateBlockReason(room: { id: string; name: string; owner?: string } | null | undefined): string | null {
  if (!room || room.id === 'hall') return 'Para decorar, entrá a tu habitación.';
  if (isPlayerRoom(room)) return null;
  if (room.owner) return `No podés cambiar ${room.name}. La decoración es solo de tu habitación.`;
  return 'Solo podés decorar tu habitación.';
}

export function idleOffer(roomTag: string | null): ContextOffer {
  return { primary: null, chip: null, overflow: [], roomTag };
}

export function offerKey(o: ContextOffer): string {
  const part = (a: ContextAction | null) => (a ? `${a.id}:${a.label}` : '');
  return `${o.roomTag ?? ''}#${part(o.primary)}#${part(o.chip)}#${o.overflow.map(part).join(',')}#${(o.all ?? []).map((a) => a.id).join(',')}#${o.talk?.id ?? ''}`;
}

interface Scored { action: ContextAction; score: number; }

function keep(bag: Map<string, Scored>, action: ContextAction, score: number) {
  const prev = bag.get(action.id);
  if (!prev || score < prev.score) bag.set(action.id, { action, score });
}

function consider(bag: Map<string, Scored>, action: ContextAction, x: number, y: number, maxD: number, sense: ContextSense, rank: number, bias = 0) {
  const d = Math.hypot(x - sense.px, y - sense.py);
  if (d > maxD) return;
  const [fx, fy] = FACING[sense.dir];
  const dot = ((x - sense.px) * fx + (y - sense.py) * fy) / (d || 1);
  keep(bag, action, d - dot * 8 + rank * 0.01 + bias);
}

export function doorCopy(zoneId: string, door: DoorDef): { label: string; detail: string } {
  const here = ZONES[zoneId];
  const dest = ZONES[door.to];
  const place = door.label || dest?.name || 'allá';
  if (zoneId === 'restaurant' && door.to === 'home') return { label: 'Subir', detail: 'Subir a las habitaciones' };
  if (zoneId === 'home' && door.to === 'restaurant') return { label: 'Bajar', detail: 'Bajar al restaurante' };
  const hereOut = !!here?.outdoor;
  const destOut = !!dest?.outdoor || door.to === 'plaza';
  if ((!hereOut && destOut) || (hereOut && door.to === 'plaza')) {
    return { label: 'Salir', detail: dest?.name ? `Salir a ${dest.name}` : 'Salir' };
  }
  return { label: 'Entrar', detail: `Entrar a ${place}` };
}

function shortWho(name: string) {
  return name.split(/\s+/)[0] || name;
}

function jobAction(job: TableJob): ContextAction | null {
  if (job.status === 'tip' && job.tip > 0) {
    return {
      id: `tip:${job.tableId}`,
      label: 'Propina',
      detail: `Hay ${job.tip} de propina en la mesa.`,
      icon: 'coin',
      intent: { type: 'tip', tableId: job.tableId },
    };
  }
  if (job.phase === 'waiting_order') {
    const who = job.customerId ? customerName(job.customerId) : 'El cliente';
    return {
      id: `take:${job.tableId}`,
      label: job.members > 1 ? 'Tomar pedidos' : 'Tomar pedido',
      detail: job.members > 1 ? `Tomar los pedidos de ${job.members} personas.` : `${who} está listo para pedir.`,
      icon: 'clipboard',
      intent: { type: 'takeOrder', tableId: job.tableId },
    };
  }
  if (job.phase !== 'waiting_food' || !job.recipe) return null;
  const who = job.customerId ? customerName(job.customerId) : 'el cliente';
  const dish = RECIPES_BY_ID[job.recipe]?.name ?? DRINK_BY_ID[job.recipe]?.name ?? 'el pedido';
  if (carriedOrder(job.tableId)) {
    return {
      id: `deliver:${job.tableId}`,
      label: 'Entregar',
      detail: `${dish} para ${who}.`,
      icon: 'serve',
      intent: { type: 'deliver', tableId: job.tableId },
    };
  }
  if (job.plated) return { id: `tray:${job.tableId}`, label: 'Recoger pedido', detail: `${dish} espera en la bandeja de salida.`, icon: 'serve', intent: mirror.on ? { type: 'tray' } : { type: 'orders' } };
  // visiting a friend's restaurant: cook from their snapshot, or nothing to do when someone is already on it
  if (mirror.on) {
    const todo = mirror.snap.cookable.find((o) => o.uid === job.orderUid);
    const made = todo && (todo.kind === 'drink' ? DRINK_BY_ID[todo.recipe] : RECIPES_BY_ID[todo.recipe]);
    if (!todo || !made || !hostHasIngredients(made.ingredients)) return null;
    return { id: `cook:${todo.uid}`, label: `${todo.kind === 'drink' ? 'Preparar' : 'Cocinar'} · ${shortWho(who)}`, detail: `${made.name} para ${who}. Se hace con los ingredientes de tu amigo.`, icon: 'maki', intent: { type: 'cookOrder', uid: todo.uid } };
  }
  const order = game.save.orders.find(o => o.uid === job.orderUid);
  // in the physical kitchen nothing is cooked from the table: the ticket on screen says what is pending
  if (galleyOn()) return null;
  const ready = !!job.orderUid && order?.kind !== 'drink' && canCook(job.recipe);
  return {
    id: ready ? `cook:${job.orderUid}` : `order:${job.orderUid}`,
    label: `${ready ? 'Cocinar' : 'Pedido'} · ${shortWho(who)}`,
    detail: ready ? `${dish} para ${who}. La mesa está lista.` : `${dish} para ${who}. Faltan ingredientes.`,
    icon: 'maki',
    intent: ready && job.orderUid ? { type: 'cookOrder', uid: job.orderUid } : { type: 'orders' },
  };
}

const SIDES: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** Stand points on every open tile touching the table. */
function approachPoints(table: SenseFurniture, sense: ContextSense): { x: number; y: number }[] {
  const seen = new Set<string>();
  const points: { x: number; y: number }[] = [];
  const inside = (x: number, y: number) => x >= table.x && y >= table.y && x < table.x + table.w && y < table.y + table.h;
  for (let j = 0; j < table.h; j++) for (let i = 0; i < table.w; i++) {
    for (const [dx, dy] of SIDES) {
      const x = table.x + i + dx;
      const y = table.y + j + dy;
      const key = `${x},${y}`;
      if (seen.has(key) || inside(x, y) || x < 0 || y < 0) continue;
      seen.add(key);
      if (sense.blocked?.(x, y)) continue;
      points.push({ x: x * TILE + TILE / 2, y: y * TILE + TILE - 2 });
    }
  }
  return points;
}

function addTables(bag: Map<string, Scored>, sense: ContextSense) {
  if (sense.zoneId !== 'restaurant' || !game.has('intro_done')) return;
  for (const job of tableJobs()) {
    const table = sense.furniture.find((f) => f.room === 'dining' && TABLE_KINDS.has(f.kind) && String(f.uid) === job.tableId);
    if (!table) continue;
    const action = jobAction(job);
    if (!action) continue;
    // Within reach, attention and delivery get half a tile of preference over casual actions.
    const service = action.intent.type === 'takeOrder' || action.intent.type === 'deliver';
    const bias = service ? -TILE / 2 : 0;
    for (const spot of approachPoints(table, sense)) consider(bag, action, spot.x, spot.y, 20, sense, 4, bias);
    for (const guest of sense.guests ?? []) {
      if (guest.tableId !== job.tableId) continue;
      consider(bag, action, guest.x, guest.y, 24, sense, 4, bias);
    }
  }
}

export function resolveContext(sense: ContextSense): ContextOffer {
  const bag = new Map<string, Scored>();
  for (const p of sense.pets ?? []) consider(bag, {
    id: `pet:${p.id}`, label: `Acariciar a ${p.name}`, detail: `${p.name}, el gato de Midnight Maki`, icon: 'heart', intent: { type: 'pet', id: p.id },
  }, p.x, p.y, 24, sense, 2);
  for (const n of sense.npcs) {
    consider(bag, {
      id: `npc:${n.id}`,
      label: 'Hablar',
      detail: `Hablar con ${n.name}`,
      icon: 'talk',
      intent: { type: 'target', target: { kind: 'npc', id: n.id, label: 'Hablar' } },
    }, n.x, n.y, 22, sense, 0);
    if (n.company) consider(bag, {
      id: `company:${n.id}`, label: 'Compañía', detail: `Compartir un rato con ${n.name}`, icon: 'heart',
      intent: { type: 'company', npcId: n.id },
    }, n.x, n.y, 22, sense, 2);
    const gifted = (game.save.relationships[n.id]?.lastGiftDay ?? -1) === game.save.time.day;
    if (!gifted) {
      consider(bag, {
        id: `gift:${n.id}`,
        label: 'Regalar',
        detail: `Regalarle algo a ${n.name}`,
        icon: 'gift',
        intent: { type: 'gift', npcId: n.id },
      }, n.x, n.y, 22, sense, 5);
    }
  }
  for (const n of sense.neighbors ?? []) consider(bag, {
    id: `nb:${n.id}`, label: 'Hablar', detail: `Charlar con ${n.name}`, icon: 'talk',
    intent: { type: 'target', target: { kind: 'neighbor', id: n.id, label: 'Hablar' } },
  }, n.x, n.y, 22, sense, 1);
  if (sense.zoneId === 'restaurant' && (trayOrders().length || carriedOrder())) consider(bag, {
    id: 'station:tray', label: carriedOrder() ? 'Dejar pedido' : 'Recoger pedido', detail: 'Bandeja de salida', icon: 'serve', intent: { type: 'tray' },
  }, 6 * TILE + 8, 5 * TILE + 10, 24, sense, 0, -TILE / 2);
  for (const i of sense.interacts) {
    if (i.action === 'tray' && (trayOrders().length || carriedOrder())) continue;
    const px = i.x * TILE + 8;
    const py = i.y * TILE + 10;
    if (i.action.startsWith('door:')) {
      const to = i.action.slice(5);
      const door = sense.doors.find((d) => d.to === to);
      const copy = door ? doorCopy(sense.zoneId, door) : { label: 'Entrar', detail: i.label };
      consider(bag, {
        id: `door:${to}`,
        label: copy.label,
        detail: copy.detail,
        icon: 'door',
        intent: { type: 'target', target: { kind: 'interact', def: i, label: copy.label } },
      }, px, py, 24, sense, 2);
      continue;
    }
    const icon: ActionIcon = i.action === 'orders' ? 'clipboard' : i.action === 'cook' ? 'maki' : i.action.startsWith('shop:') ? 'shop' : ['library', 'board', 'mail', 'secret', 'fountain'].some(a => i.action === a || i.action.startsWith(a + ':')) ? 'inspect' : 'act';
    consider(bag, {
      id: `use:${i.action}`,
      label: i.label,
      detail: i.label,
      icon,
      intent: { type: 'target', target: { kind: 'interact', def: i, label: i.label } },
    }, px, py, 20, sense, 2);
  }
  for (const f of sense.furniture) {
    let action = '';
    let label = '';
    let icon: ActionIcon = 'act';
    if ((f.kind === 'bed' || f.kind === 'futon') && f.room === 'room_player') {
      action = 'bed';
      label = 'Dormir';
      icon = 'bed';
    } else if (f.kind === 'aquarium') {
      action = 'aquarium';
      label = 'Mirar el acuario';
    } else if (f.kind === 'piano') {
      action = 'piano';
      label = 'Tocar el piano';
    } else if (f.kind === 'radio') {
      action = 'radio';
      label = 'Encender la radio';
    } else if (f.kind === 'telescope') {
      action = 'telescope';
      label = 'Mirar las estrellas';
    }
    if (!action) continue;
    const def: InteractDef = { id: 'f' + f.uid, x: f.x, y: f.y, label, action };
    consider(bag, {
      id: `furn:${action}`,
      label,
      detail: action === 'bed' ? 'Dormir en tu cama' : label,
      icon,
      intent: { type: 'target', target: { kind: 'interact', def, label } },
    }, f.x * TILE + (f.w * TILE) / 2, f.y * TILE + 10, 22, sense, 1);
  }
  for (const d of sense.doors) {
    const copy = doorCopy(sense.zoneId, d);
    consider(bag, {
      id: `door:${d.to}`,
      label: copy.label,
      detail: copy.detail,
      icon: 'door',
      intent: { type: 'target', target: { kind: 'door', def: d, label: copy.label } },
    }, d.x * TILE + 8, d.y * TILE + 8, 24, sense, 3);
  }
  for (const g of sense.gathers) {
    consider(bag, {
      id: `gather:${g.spot.zone}:${g.spot.idx}`,
      label: g.label,
      detail: g.label,
      icon: 'act',
      intent: { type: 'target', target: { kind: 'gather', spot: g.spot, label: g.label } },
    }, g.x, g.y, 18, sense, 2);
  }
  sense.bugs.forEach((b) => {
    consider(bag, {
      id: `bug:${b.idx}`,
      label: b.label,
      detail: b.label,
      icon: 'act',
      intent: { type: 'target', target: { kind: 'bug', idx: b.idx, label: b.label } },
    }, b.x, b.y, 24, sense, 2);
  });
  for (const g of sense.galley ?? []) consider(bag, g.action, g.x, g.y, 44, sense, 1, g.bias - TILE);
  addTables(bag, sense);
  if (isPlayerRoom(sense.room)) {
    keep(bag, {
      id: 'decorate',
      label: 'Decorar',
      detail: 'Decorar tu habitación',
      icon: 'decor',
      intent: { type: 'decorate' },
    }, 40);
  }
  const actions = [...bag.values()].sort((a, b) => a.score - b.score).map((s) => s.action);
  return {
    primary: actions[0] ?? null,
    chip: actions[1] ?? null,
    overflow: actions.slice(2),
    roomTag: isPlayerRoom(sense.room) ? sense.room!.name : null,
  };
}
