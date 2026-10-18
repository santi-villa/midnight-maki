import { game } from '../core/state';
import { CHAR_BY_ID, type RoutineStop } from '../data/characters';
import { NEIGHBOR_BY_ID } from '../data/neighbors';
import { EXTRA_HOMES } from '../data/residentHomes';
import { FURN_BY_ID, furnSize } from '../data/furniture';
import { dayMinutes } from './daytime';

const HOURS: Record<string, [number, number]> = {
  bento: [22, 6], taro: [22.75, 7], yuki: [22.5, 7.5], kumo: [24, 8],
  momo: [21.75, 7], nami: [22, 6], ume: [21.5, 7], sora: [22, 6.5],
  sumi: [24.5, 9], kiki: [23.5, 7.5], hoshi: [27, 11], akio: [24, 8],
};
export type RestPhase = 'awake' | 'returning' | 'sleeping';

export function restHours(id: string, rain: boolean): { sleep: number; wake: number } {
  const n = NEIGHBOR_BY_ID[id];
  const hours = HOURS[id] ?? (n?.traits.includes('nocturnal') ? [25.5, 10] : n?.traits.includes('hardworking') ? [21.75, 6.5] : [23, 8]);
  return { sleep: (hours[0] * 60 - (rain ? 45 : 0) + 1440) % 1440, wake: hours[1] * 60 };
}

export function restPhase(id: string, period: number, minutes: number, rain: boolean): RestPhase {
  const now = dayMinutes(period, minutes) % 1440;
  const { sleep, wake } = restHours(id, rain);
  const since = (now - sleep + 1440) % 1440;
  const duration = (wake - sleep + 1440) % 1440;
  if (since < duration) return 'sleeping';
  return (sleep - now + 1440) % 1440 <= 30 ? 'returning' : 'awake';
}

export function residentHome(id: string): string | null {
  return NEIGHBOR_BY_ID[id]?.home ?? EXTRA_HOMES[id] ?? CHAR_BY_ID[id]?.routine.find(s => s.zone.startsWith('house_'))?.zone ?? null;
}

/** Optional saved UID only identifies an extra futon. Old furniture and progress are kept. */
export function sleepStop(id: string, sleeping: boolean): RoutineStop | null {
  const home = residentHome(id);
  if (!home) return null;
  const native = CHAR_BY_ID[id]?.routine.find(s => s.zone === home && s.bed);
  if (native && sleeping) return { ...native, wander: 0 };
  const uid = game.flag('resident_futon_' + id);
  const bed = game.save.decor[home]?.find(f => f.uid === uid);
  if (bed) {
    const d = FURN_BY_ID[bed.id], size = furnSize(d, bed.rot);
    return { zone: home, x: bed.x, y: bed.y + size.h, dir: 'up', wander: 0,
      act: sleeping ? 'sleep' : 'sit', ...(sleeping ? { bed: { x: bed.x, y: bed.y, w: size.w, h: size.h } } : {}) };
  }
  return { zone: home, x: 5, y: 5, wander: 0, act: sleeping ? 'sleep' : 'read' };
}
