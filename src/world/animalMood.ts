/**
 * How the village animals spend the day. Pure numbers, so the scenes can keep the state machines they already have.
 * presence: 0 hidden, 1 a few, 2 the usual count.
 * energy: 0 resting, 1 calm, 2 busy.
 * shelters: prefer a tree, the bank, or home over wandering.
 */
export type AnimalKind =
  | 'frog' | 'duck' | 'crab' | 'squirrel'
  | 'bee' | 'dragonfly' | 'butterfly' | 'firefly'
  | 'sparrow' | 'pigeon' | 'gull'
  | 'cat' | 'dog';

export interface DayFeel {
  /** 0 morning, 1 afternoon, 2 dusk, 3 night */
  period: number;
  /** 0 spring, 1 summer, 2 autumn, 3 winter */
  season: number;
  rain: boolean;
}

const clampPeriod = (n: number) => Math.max(0, Math.min(3, Math.floor(n)));
const clampSeason = (n: number) => Math.max(0, Math.min(3, Math.floor(n)));

export function presence(kind: AnimalKind, day: DayFeel): 0 | 1 | 2 {
  const period = clampPeriod(day.period), season = clampSeason(day.season), rain = day.rain;
  const winter = season === 3, autumn = season === 2, night = period === 3, dusk = period === 2, dayTime = period <= 1;
  switch (kind) {
    case 'frog':
      return winter ? 1 : 2;
    case 'duck':
      return 2;
    case 'crab':
      return 2;
    case 'squirrel':
      if (night) return 0;
      if (dusk || winter) return 1;
      return 2;
    case 'bee':
    case 'dragonfly':
    case 'butterfly':
      if (night || winter || rain) return 0;
      if (dusk || autumn) return 1;
      return dayTime ? 2 : 1;
    case 'firefly':
      if (rain || period <= 1) return 0;
      if (dusk || winter) return 1;
      return 2;
    case 'sparrow':
    case 'pigeon':
      if (night || rain) return 0;
      if (dusk || winter) return 1;
      return 2;
    case 'gull':
      if (night || rain || dusk) return 1;
      return 2;
    case 'cat':
    case 'dog':
      return 2;
  }
}

export function energy(kind: AnimalKind, day: DayFeel): 0 | 1 | 2 {
  const period = clampPeriod(day.period), season = clampSeason(day.season), rain = day.rain;
  const hotAfternoon = period === 1 && season === 1;
  switch (kind) {
    case 'frog':
      if (season === 3 && period < 2) return 0;
      if (hotAfternoon && !rain) return 0;
      if (rain || period >= 2) return 2;
      return 1;
    case 'duck':
      if (period === 3) return 0;
      if (period === 2) return 1;
      return 2;
    case 'crab':
      if (period === 1 && !rain) return 0;
      if (rain || period >= 2) return 2;
      return 1;
    case 'squirrel':
      if (period >= 2 || rain) return 0;
      if (period === 0) return 2;
      return season === 2 ? 2 : 1;
    case 'bee':
    case 'butterfly':
      if (period === 1 && season <= 1 && !rain) return 2;
      if (period === 0) return 1;
      return 0;
    case 'dragonfly':
      if (period === 1 && !rain) return 2;
      if (period === 0) return 1;
      return 0;
    case 'firefly':
      return period === 3 ? 2 : 1;
    case 'sparrow':
    case 'pigeon':
    case 'gull':
      if (period === 3 || rain) return 0;
      if (period === 0) return 2;
      if (period === 2) return 0;
      return 1;
    case 'cat':
      if (rain) return 0;
      if (period === 0 || period === 2) return 2;
      if (period === 1) return 0;
      return 1;
    case 'dog':
      if (rain || period === 3) return 0;
      if (period === 2) return 1;
      return 2;
  }
}

export function shelters(kind: AnimalKind, day: DayFeel): boolean {
  const period = clampPeriod(day.period), season = clampSeason(day.season), rain = day.rain;
  switch (kind) {
    case 'frog':
      return season === 3 && period < 2 && !rain;
    case 'duck':
      return period === 3;
    case 'crab':
      return period === 1 && !rain;
    case 'squirrel':
      return rain || period >= 2 || (season === 3 && period !== 0);
    case 'bee':
    case 'dragonfly':
    case 'butterfly':
      return rain || period >= 2;
    case 'firefly':
      return period <= 1;
    case 'sparrow':
    case 'pigeon':
      return rain || period === 3;
    case 'gull':
      return period === 3;
    case 'cat':
    case 'dog':
      return rain;
  }
}

/** Turn a usual count into none, about half, or all of them. */
export function scaleCount(usual: number, how: 0 | 1 | 2): number {
  if (how === 0 || usual <= 0) return 0;
  if (how === 2) return usual;
  return Math.max(1, Math.ceil(usual / 2));
}
