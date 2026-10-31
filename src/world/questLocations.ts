/** Resolve authored quest names/IDs to current map objects, so arrows survive a town redesign. */
import type { QuestTarget } from '../quests/quests';
import { ZONES } from '../data/zones';
export function currentMapTarget(t: QuestTarget): QuestTarget {
  if (t.kind === 'npc') return t;
  if (t.kind === 'interior') {
    const z = Object.values(ZONES).find(z => z.doors.some(d => d.to === t.targetZone));
    const d = z?.doors.find(d => d.to === t.targetZone);
    return z && d ? { ...t, fromZone: z.id, door: { x: d.x, y: d.y } } : t;
  }
  if (!ZONES[t.zone]?.outdoor) return t;
  if (t.kind === 'object' && t.interactId) {
    const z = Object.values(ZONES).find(z => z.outdoor && z.interact.some(i => i.id === t.interactId));
    const i = z?.interact.find(i => i.id === t.interactId);
    if (z && i) return { ...t, zone: z.id, x: i.x, y: i.y };
  }
  const label = t.label ?? '';
  const destination = /taro/i.test(label) ? 'shop_taro' : /yuki/i.test(label) ? 'shop_yuki' : /bento|panader[ií]a/i.test(label) ? 'shop_bento' : /camino.*estaci[oó]n/i.test(label) ? 'station' : null;
  if (destination) {
    const z = Object.values(ZONES).find(z => z.outdoor && z.doors.some(d => d.to === destination));
    const d = z?.doors.find(d => d.to === destination);
    if (z && d) return { ...t, zone: z.id, x: d.x, y: d.y };
  }
  if (t.zone === 'garden' && /parcela/i.test(label)) {
    const i = ZONES.garden.interact.find(i => i.id === 'plot0')!;
    return { ...t, x: i.x, y: i.y };
  }
  return t;
}
