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
  gloom?: boolean; // dim stone rooms (lighthouse): cooler than a house, lighter than a closed depot
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

/** Perceived brightness of a multiply colour, 0..255. Daylight sits near 250. */
export function tintLum(c: number): number {
  return 0.2126 * ch(c, 16) + 0.7152 * ch(c, 8) + 0.0722 * ch(c, 0);
}

/**
 * Multiply colour under a lamp. Null means the street is already bright, so a soft erase is enough.
 * A full erase at night uncovers the daytime tiles, so the pool stays dimmer than daylight and never darker than the street.
 */
export interface Box { l: number; r: number; t: number; b: number }

/**
 * A lit pane should slip behind someone standing in front of the wall and overlapping that pane.
 * Feet above the wall are on the roof side: the pane stays up, or the whole window would dim.
 */
export function coversLitPane(feetY: number, body: Box, pane: Box, baseY: number): boolean {
  if (feetY < baseY - 2) return false;
  return body.r > pane.l && body.l < pane.r && body.b > pane.t && body.t < pane.b;
}

export function lampPoolTint(ambient: number, lampColor: number, strength: number, cap = 150): number | null {
  if (tintLum(ambient) > 200) return null;
  const k = Math.max(0, Math.min(1, strength));
  const mixed = mixHex(ambient, lampColor, 0.22 + 0.2 * k);
  const chAt = (sh: number) => {
    const a = ch(ambient, sh);
    const m = ch(mixed, sh);
    return Math.max(a, Math.min(cap, m));
  };
  return (chAt(16) << 16) | (chAt(8) << 8) | chAt(0);
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
// every period starts exactly where the previous one ends, so the clock never makes the light jump
const AFTERNOON = [[0, 0xfffaf0], [1, 0xffdca8]] as [number, number][];
// warm gold -> rose -> dusky lavender
const DUSK = [[0, 0xffdca8], [0.4, 0xf4b0a8], [0.75, 0xb69ad0], [1, 0x6a6cb2]] as [number, number][];
const NIGHT = [[0, 0x6a6cb2], [0.3, 0x4a5296], [1, 0x383f82]] as [number, number][];
// ---- indoor: stays warm so interiors read as lit rooms against the cold street
const IN_DAY = 0xffffff;
const IN_DUSK = [[0, 0xffeed8], [1, 0xe6c8c0]] as [number, number][];
const IN_NIGHT = 0xc7a8b8;
// A lit sushi bar stays honey/cream against the blue street, rather than turning purple.
const RESTAURANT_DUSK = [[0, IN_DUSK[0][1]], [1, 0xe4cbb0]] as [number, number][];
const RESTAURANT_NIGHT = 0xd9bfa8;

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
  } else if (i.gloom) {
    tint = 0xb7c0d4;
    vig = 0.28;
    lamp = 0.9;
    windows = 0.55;
    moon = 0.25;
  } else if (i.outdoor) {
    if (per === 0) {
      tint = ramp(MORNING, k);
      vig = 0.06;
      lamp = 0.3 * (1 - smooth(0, 0.7, k));
      windows = 0.35 * (1 - smooth(0, 0.6, k));
    } else if (per === 1) {
      tint = ramp(AFTERNOON, k);
      vig = 0.05 + 0.09 * smooth(0.6, 1, k);
      lamp = 0.3 * smooth(0.6, 1, k);
      windows = 0;
    } else if (per === 2) {
      tint = ramp(DUSK, k);
      vig = 0.14 + 0.2 * k;
      lamp = 0.3 + 0.7 * smooth(0, 0.8, k);
      windows = smooth(0.1, 0.75, k);
      moon = 0.6 * smooth(0.5, 1, k);
    } else {
      tint = ramp(NIGHT, k);
      vig = 0.34 + 0.08 * smooth(0, 0.3, k);
      lamp = 1;
      windows = 1;
      moon = 0.6 + 0.4 * smooth(0, 0.4, k);
    }
  } else {
    const dusk = i.restaurant ? RESTAURANT_DUSK : IN_DUSK;
    const night = i.restaurant ? RESTAURANT_NIGHT : IN_NIGHT;
    if (per === 0) tint = IN_DAY;
    else if (per === 1) tint = mixHex(IN_DAY, dusk[0][1], smooth(0.5, 1, k));
    else if (per === 2) tint = ramp(dusk, k);
    else tint = mixHex(dusk[1][1], night, smooth(0, 0.4, k));
    vig = per === 3 ? 0.26 + 0.1 * smooth(0, 0.4, k) : per === 2 ? 0.26 : 0.1 + (per === 1 ? 0.16 * smooth(0.5, 1, k) : 0);
    if (i.restaurant && per >= 2) vig = per === 2 ? 0.26 : 0.26 + 0.02 * smooth(0, 0.4, k);
    lamp = per === 3 ? 1 : per === 2 ? 0.4 + 0.6 * k : per === 1 ? 0.35 + 0.05 * k : 0.35;
    windows = 1;
  }
  let halo = 1;
  if (i.rain && !i.dark) {
    // rain: a grey-blue veil in daylight, a deeper blue at night, lamps stay on but their light is wetter and a touch dimmer
    // the veil changes colour gradually through dusk, so there is no jump when the night starts
    if (per < 2) tint = mixHex(tint, i.outdoor ? 0x8592b4 : 0xd8d4e0, i.outdoor ? 0.55 : 0.25);
    else if (per === 2) tint = i.outdoor ? mixHex(tint, mixHex(0x8592b4, 0x2c3466, k), 0.55 - 0.25 * k) : mixHex(tint, mixHex(0xd8d4e0, 0x2c3466, k), 0.25 - 0.2 * k);
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

export interface CastAnchor {
  /** feet of the shadow, in the same pixels as the object's base */
  x: number;
  y: number;
  /** lean around the feet, radians. Positive reaches to the right. */
  angle: number;
  scaleY: number;
}

/**
 * Projected shadow: the silhouette pivots on the object's feet.
 * `reach` is how far the tip should travel. The whole shape is not slid sideways.
 */
export function castAnchor(baseX: number, baseY: number, reach: number, heightPx: number, scaleY: number): CastAnchor {
  const h = Math.max(6, Math.abs(heightPx * scaleY));
  return { x: baseX, y: baseY, angle: Math.atan2(reach, h), scaleY };
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
