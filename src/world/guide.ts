/**
 * Objective guide: works out where the tracked quest step wants the player to go, from the step text
 * (character names and place names), and turns that into a point in the current zone
 * (the character, the place, or the exit that leads towards it). DOM-free.
 */
import { game } from '../core/state';
import { CHARACTERS } from '../data/characters';
import { ZONES } from '../data/zones';
import { currentStep } from '../quests/quests';
import { whereIs } from '../systems/npcs';

export interface GuideTarget {
  zone: string;
  /** tile in that zone, when known */
  x?: number;
  y?: number;
  npc?: string;
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

  // Explicit structured target takes precedence over regex guessing
  if (step.target) {
    const t = step.target;
    if (t.kind === 'npc') {
      const z = locate(t.npc);
      return z ? { zone: z, npc: t.npc } : null;
    }
    if (t.kind === 'object') {
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

/** Shortest chain of zones (via doors) from `from` to `to`; returns the first door to take, if any. */
export function nextDoor(from: string, to: string): { x: number; y: number } | null {
  if (from === to) return null;
  const prev = new Map<string, { zone: string; x: number; y: number }>();
  const queue = [from];
  const seen = new Set([from]);
  while (queue.length) {
    const z = queue.shift()!;
    for (const d of ZONES[z]?.doors ?? []) {
      if (seen.has(d.to)) continue;
      if (d.lock && !game.has(d.lock.flag)) continue;
      seen.add(d.to);
      prev.set(d.to, { zone: z, x: d.x, y: d.y });
      if (d.to === to) {
        // walk back to the first hop
        let cur = to;
        let hop = prev.get(cur)!;
        while (hop.zone !== from) {
          cur = hop.zone;
          hop = prev.get(cur)!;
        }
        return { x: hop.x, y: hop.y };
      }
      queue.push(d.to);
    }
  }
  return null;
}
