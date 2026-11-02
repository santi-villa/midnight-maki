/**
 * Objective guide: works out where the tracked quest step wants the player to go, from the step text
 * (character names and place names), and turns that into a point in the current zone
 * (the character, the place, or the exit that leads towards it). DOM-free.
 */
import { game } from '../core/state';
import { CHARACTERS } from '../data/characters';
import { ZONES } from '../data/zones';
import { currentStep, stepWaitsForOpening } from '../quests/quests';
import { whereIs } from '../systems/npcs';
import { serviceGuide } from '../restaurant/service';

export interface GuideTarget {
  zone: string;
  /** tile in that zone, when known */
  x?: number;
  y?: number;
  npc?: string;
  /** a dining table (the guest sitting there is ready to order) */
  tableId?: string;
}

const PLACE_WORDS: [RegExp, string, string?][] = [
  [/cocina|cocinar|pedido|sushi|preparar/i, 'restaurant', 'cook'],
  [/midnight maki|restaurante|salón|barra/i, 'restaurant'],
  [/dep[oó]sito/i, 'storage'],
  [/habitaci[oó]n|tu cuarto|tu cama|dormir|ropero/i, 'home'],
  [/playa|pescar|pesca|conchas|muelle/i, 'beach'],
  [/bosque|hongos|lago/i, 'forest'],
  [/jard[ií]n|plantar|regar|cantero/i, 'garden'],
  [/estaci[oó]n|tren|v[ií]as/i, 'station'],
  [/mercado/i, 'market'],
  [/faro/i, 'lighthouse'],
  [/biblioteca/i, 'plaza', 'library'],
  [/cartelera/i, 'plaza', 'board'],
  [/buz[oó]n/i, 'plaza', 'mailbox'],
  [/fuente/i, 'plaza', 'fountain'],
  [/cartel del restaurante|cartel/i, 'plaza', 'sign'],
  [/plaza|pueblo/i, 'plaza'],
];

/** Where the tracked quest currently points to, or null. */
export function questTarget(locate: (id: string) => string | null = whereIs): GuideTarget | null {
  const id = game.save.quests.tracked;
  if (!id) return null;
  const step = currentStep(id);
  if (!step) return null;
  if (stepWaitsForOpening(step)) return null;

  // Explicit structured target takes precedence over regex guessing
  if (step.target) {
    const t = step.target;
    if (t.kind === 'npc') {
      const z = locate(t.npc);
      return z ? { zone: z, npc: t.npc } : null;
    }
    if (t.kind === 'object') {
      if (t.service) {
        const g = serviceGuide();
        if (!g) return null;
        return g === 'counter' ? { zone: t.zone, x: t.x, y: t.y } : { zone: t.zone, tableId: g.tableId };
      }
      return { zone: t.zone, x: t.x, y: t.y };
    }
    if (t.kind === 'interior') {
      return { zone: t.fromZone, x: t.door.x, y: t.door.y };
    }
    if (t.kind === 'location') {
      return { zone: t.zone, x: t.x, y: t.y };
    }
  }

  const text = step.text.replace(/<[^>]+>/g, '');
  // a character named in the step wins (they move around, so follow them)
  for (const c of CHARACTERS) {
    const first = c.name.split(' ')[0];
    if (new RegExp(`\\b${first}\\b`, 'i').test(text)) {
      const z = locate(c.id);
      if (z) return { zone: z, npc: c.id };
    }
  }
  for (const [re, zone, interact] of PLACE_WORDS) {
    if (!re.test(text) || !ZONES[zone]) continue;
    const def = ZONES[zone];
    const it = interact ? def.interact.find((i) => i.id === interact || i.action === interact) : undefined;
    return it ? { zone, x: it.x, y: it.y } : { zone };
  }
  return null;
}

interface Hop { zone: string; x: number; y: number; to: string }

/** Shortest chain of doors from `from` to `to` (locked ways stay out of it); null when there is none. */
function route(from: string, to: string): Hop[] | null {
  if (from === to) return null;
  const prev = new Map<string, Hop>();
  const queue = [from];
  const seen = new Set([from]);
  while (queue.length) {
    const z = queue.shift()!;
    for (const d of ZONES[z]?.doors ?? []) {
      if (seen.has(d.to)) continue;
      if (d.lock && !game.has(d.lock.flag)) continue;
      seen.add(d.to);
      prev.set(d.to, { zone: z, x: d.x, y: d.y, to: d.to });
      if (d.to === to) {
        const hops: Hop[] = [];
        for (let cur = to; cur !== from; cur = prev.get(cur)!.zone) hops.unshift(prev.get(cur)!);
        return hops;
      }
      queue.push(d.to);
    }
  }
  return null;
}

/** Shortest chain of zones (via doors) from `from` to `to`; returns the first door to take, if any. */
export function nextDoor(from: string, to: string): { x: number; y: number } | null {
  const hops = route(from, to);
  return hops ? { x: hops[0].x, y: hops[0].y } : null;
}

const inWorld = (id: string) => !!ZONES[id]?.outdoor && !!ZONES[id]?.world;

/**
 * Where to point the player from `from` to reach `to`, as a tile in `from`'s own coordinates (it may lie outside that zone).
 * Outdoors the village is one continuous place, so the guide aims at the real destination: the door where the route leaves
 * the village for an interior, or the spot itself (`at`) when it is outdoors, not at the border door of the zone being crossed.
 * From an interior it is the door out, as before.
 */
export function routeGoal(from: string, to: string, at?: { x?: number; y?: number }): { x: number; y: number } | null {
  const hops = route(from, to);
  if (!hops) return null;
  if (!inWorld(from)) return { x: hops[0].x, y: hops[0].y };
  const here = ZONES[from].world!;
  const local = (zone: string, x: number, y: number) => ({ x: ZONES[zone].world!.x - here.x + x, y: ZONES[zone].world!.y - here.y + y });
  const out = hops.find((h) => !inWorld(h.to));
  if (out) return local(out.zone, out.x, out.y);
  if (at?.x != null && at.y != null) return local(to, at.x, at.y);
  const last = hops[hops.length - 1];
  return local(last.zone, last.x, last.y);
}
