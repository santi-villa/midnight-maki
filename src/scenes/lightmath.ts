/**
 * Pure lighting maths (no Phaser): given the time of day, weather, season and where we are, returns the ambient tint of the
 * "darkness" layer and how strongly lamps, windows and the moon should show. Kept separate so it can be unit-tested and
 * so WorldScene only recomputes it when something it depends on actually changes.
 */
export type RestaurantPhase = 'setup' | 'open' | 'closing' | 'closed';

export interface ShadowStyle {
  /** horizontal offset of cast shadows (px, tall things get 1.6x) */
  dx: number;
  /** vertical squash of cast shadows (0.3 = the old fixed look) */
  sy: number;
  /** opacity multiplier (1 = the old fixed look) */
  alpha: number;
}

export interface LightInput {
  period: number; // 0 morning, 1 afternoon, 2 dusk, 3 night
  prog: number; // 0..1 inside the period
  outdoor: boolean;
  dark?: boolean; // always-dark zones (storage, market)
  rain: boolean;
  season: number; // 0 spring .. 3 winter
  restaurant?: RestaurantPhase | null; // set while inside the restaurant
}

export interface LightState {
  tint: number; // multiply colour of the darkness layer (0xffffff = none)
  vig: number; // vignette strength
  lamp: number; // 0..1 how lit lamps / lanterns are
  windows: number; // 0..1 how lit building windows are
  moon: number; // 0..1 moon reflection on water
  halo: number; // size factor of lamp halos (wet air scatters light in the rain)
  shadow: ShadowStyle;
}

const ch = (c: number, sh: number) => (c >> sh) & 255;
export function mixHex(a: number, b: number, k: number): number {
  const t = Math.max(0, Math.min(1, k));
  const f = (sh: number) => Math.round(ch(a, sh) + (ch(b, sh) - ch(a, sh)) * t);
  return (f(16) << 16) | (f(8) << 8) | f(0);
}
export function mulHex(a: number, b: number): number {
  const f = (sh: number) => Math.round((ch(a, sh) * ch(b, sh)) / 255);
  return (f(16) << 16) | (f(8) << 8) | f(0);
}
const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
/** piecewise colour ramp: stops are [position 0..1, colour] */
function ramp(stops: [number, number][], k: number): number {
  if (k <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    if (k <= stops[i][0]) return mixHex(stops[i - 1][1], stops[i][1], (k - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]));
  }
  return stops[stops.length - 1][1];
}

// ---- outdoor ambient colours (the layer multiplies the scene, so these are "filters", not paint)
const MORNING = [[0, 0xffe2c0], [1, 0xfffaf0]] as [number, number][];
const AFTERNOON = [[0, 0xfffaf0], [1, 0xffeccc]] as [number, number][];
// warm gold -> rose -> dusky lavender
const DUSK = [[0, 0xffdca8], [0.4, 0xf4b0a8], [0.75, 0xb69ad0], [1, 0x6a6cb2]] as [number, number][];
const NIGHT = [[0, 0x4a5296], [1, 0x383f82]] as [number, number][];
// ---- indoor: stays warm so interiors read as lit rooms against the cold street
const IN_DAY = 0xffffff;
const IN_DUSK = [[0, 0xffeed8], [1, 0xe6c8c0]] as [number, number][];
const IN_NIGHT = 0xc7a8b8;

export function lightState(i: LightInput): LightState {
  const per = Math.max(0, Math.min(3, Math.floor(i.period)));
  const k = Math.max(0, Math.min(1, i.prog));
  let tint: number;
  let vig: number;
  let lamp: number;
  let windows: number;
  let moon = 0;
  if (i.dark) {
    tint = 0x4c4e94;
    vig = 0.42;
    lamp = 1;
    windows = 1;
    moon = 1;
  } else if (i.outdoor) {
    if (per === 0) {
      tint = ramp(MORNING, k);
      vig = 0.06;
      lamp = 0.3 * (1 - smooth(0, 0.7, k));
      windows = 0.35 * (1 - smooth(0, 0.6, k));
    } else if (per === 1) {
      tint = ramp(AFTERNOON, k);
      vig = 0.05;
      lamp = 0;
      windows = 0;
    } else if (per === 2) {
      tint = ramp(DUSK, k);
      vig = 0.14 + 0.2 * k;
      lamp = 0.3 + 0.7 * smooth(0, 0.8, k);
      windows = smooth(0.1, 0.75, k);
      moon = 0.6 * smooth(0.5, 1, k);
    } else {
      tint = ramp(NIGHT, k);
      vig = 0.42;
      lamp = 1;
      windows = 1;
      moon = 1;
    }
  } else {
    if (per === 0) tint = IN_DAY;
    else if (per === 1) tint = IN_DAY;
    else if (per === 2) tint = ramp(IN_DUSK, k);
    else tint = IN_NIGHT;
    vig = per === 3 ? 0.36 : per === 2 ? 0.26 : 0.1;
    lamp = per === 3 ? 1 : per === 2 ? 0.4 + 0.6 * k : 0.35;
    windows = 1;
  }
  let halo = 1;
  if (i.rain && !i.dark) {
    // rain: a grey-blue veil in daylight, a deeper blue at night, lamps stay on but their light is wetter and a touch dimmer
    if (per < 3) tint = mixHex(tint, i.outdoor ? 0x8592b4 : 0xd8d4e0, i.outdoor ? 0.55 : 0.25);
    else tint = mixHex(tint, 0x2c3466, i.outdoor ? 0.3 : 0.05);
    if (i.outdoor) {
      lamp = Math.max(lamp, 0.55);
      windows = Math.max(windows, per < 3 ? 0.6 : 1);
      vig = Math.max(vig, 0.32);
      moon *= 0.25;
      halo = 1.15;
    }
  }
  if (i.restaurant) {
    // the restaurant lights its own room by its opening hours: warm and bright when open, dim when it is closed
    const p = i.restaurant;
    const f = p === 'open' ? 1 : p === 'closing' ? 0.8 : p === 'setup' ? 0.6 : 0.3;
    lamp = lamp * f;
    if (per >= 2) tint = mixHex(tint, mixHex(tint, 0x8f7aa6, 0.55), 1 - f);
  }
  if (i.outdoor && !i.dark) {
    // seasonal colour grade: warm amber in autumn, cool blue-white in winter
    const grade = i.season === 2 ? 0xffbe84 : i.season === 3 ? 0xc4d8ff : 0xffffff;
    if (grade !== 0xffffff) tint = mulHex(tint, grade);
  }
  return { tint, vig, lamp, windows, moon, halo, shadow: shadowStyle(per, k, i.rain && i.outdoor, i.outdoor) };
}

/** Sun direction by time of day: shadows lean right in the morning, left in the afternoon and stretch at dusk. */
export function shadowStyle(period: number, prog: number, rain: boolean, outdoor: boolean): ShadowStyle {
  if (!outdoor) return { dx: 3, sy: 0.3, alpha: 1 };
  let s: ShadowStyle;
  if (period === 0) s = { dx: 6 - 4 * prog, sy: 0.4 - 0.15 * prog, alpha: 1 };
  else if (period === 1) s = { dx: -1 - 4 * prog, sy: 0.22 + 0.1 * prog, alpha: 1.05 };
  else if (period === 2) s = { dx: -5 - 4 * prog, sy: 0.34 + 0.22 * prog, alpha: 0.95 - 0.5 * prog };
  else s = { dx: 3, sy: 0.22, alpha: 0.35 };
  if (rain) s = { ...s, alpha: s.alpha * 0.4 };
  return s;
}
