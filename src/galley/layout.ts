/**
 * The kitchen as data. The map (data/zones.ts), the model (galley/model.ts), the dining-room view and the crew all read
 * this one table, so moving a station is a one-line change. Coordinates are tiles of the restaurant zone.
 * Design and reasons: docs/cocina-fisica.md. DOM-free and Phaser-free.
 */

export type StationKind = 'fridge' | 'counter' | 'cooker' | 'board' | 'assembly' | 'pass' | 'bin' | 'mixer' | 'cups';
/** what a surface takes: anything, or only cooked rice (the hangiri) */
export type Accept = 'any' | 'rice';

export interface StationDef {
  id: string;
  kind: StationKind;
  name: string;
  x: number;
  y: number;
  /** footprint in tiles */
  w: number;
  h: number;
  /** tiles from where a person uses it (the aisle side), nearest first */
  stand: readonly (readonly [number, number])[];
  /** prop drawn on the map */
  prop: string;
  /** until `needs` is owned the spot is this plain work counter (a surface, not the station) */
  needs?: string;
  /** how many things it can hold (a cooker: portions; a surface: items) */
  slots: number;
  cooker?: 'rice' | 'stove';
  accepts?: Accept;
  /** a bigger look once an upgrade is owned (the same station, a different prop) */
  alt?: { needs: string; prop: string };
}

/** The kitchen floor. The hall (`dining` room) starts right below at y=6 and is not touched. */
export const KITCHEN = { x: 1, y: 2, w: 12, h: 4 } as const;
/** Where the street door brings you in (the dining hall), and the gap you walk through into the kitchen. */
export const KITCHEN_GATES: readonly (readonly [number, number])[] = [[5, 5], [9, 5], [10, 5], [11, 5], [12, 5]];

export const STATIONS: readonly StationDef[] = [
  // ---- back wall (y=2): storage, rice, cutting, cooking
  { id: 'fridge', kind: 'fridge', name: 'Heladera', x: 1, y: 2, w: 1, h: 1, stand: [[1, 3]], prop: 'k_fridge', slots: 0 },
  { id: 'counter_a', kind: 'counter', name: 'Mesada de apoyo', x: 2, y: 2, w: 1, h: 1, stand: [[2, 3]], prop: 'k_work', slots: 2 },
  { id: 'rice', kind: 'cooker', cooker: 'rice', name: 'Arrocera', x: 3, y: 2, w: 1, h: 1, stand: [[3, 3]], prop: 'k_ricepot', slots: 4, alt: { needs: 'rice_big', prop: 'k_ricepot2' } },
  { id: 'hangiri', kind: 'counter', name: 'Hangiri (reserva de arroz)', x: 4, y: 2, w: 1, h: 1, stand: [[4, 3]], prop: 'k_rice', slots: 6, accepts: 'rice' },
  { id: 'board_1', kind: 'board', name: 'Tabla de cortar', x: 5, y: 2, w: 1, h: 1, stand: [[5, 3]], prop: 'k_board', slots: 1 },
  { id: 'stove', kind: 'cooker', cooker: 'stove', name: 'Fogón', x: 9, y: 2, w: 1, h: 1, stand: [[9, 3]], prop: 'k_stove', slots: 2 },
  { id: 'board_2', kind: 'board', name: 'Segunda tabla', x: 10, y: 2, w: 1, h: 1, stand: [[10, 3]], prop: 'k_board', slots: 1, needs: 'board2' },
  { id: 'mixer', kind: 'mixer', name: 'Licuadora', x: 11, y: 2, w: 1, h: 1, stand: [[11, 3]], prop: 'k_drinks', slots: 3 },
  { id: 'cups', kind: 'cups', name: 'Vasos', x: 12, y: 2, w: 1, h: 1, stand: [[12, 3]], prop: 'k_work', slots: 0 },
  // ---- front row (y=5): assembly and what you need next to it
  { id: 'counter_b', kind: 'counter', name: 'Mesada de apoyo', x: 1, y: 5, w: 1, h: 1, stand: [[1, 4]], prop: 'k_work', slots: 2 },
  { id: 'assembly', kind: 'assembly', name: 'Mesa de armado', x: 2, y: 5, w: 2, h: 1, stand: [[2, 4], [3, 4]], prop: 'k_assembly', slots: 6 },
  { id: 'bin', kind: 'bin', name: 'Tacho', x: 4, y: 5, w: 1, h: 1, stand: [[4, 4]], prop: 'k_bin', slots: 0 },
  // ---- the pass: finished plates leave the kitchen here (the tray the dining hall picks from is on its other side)
  { id: 'pass', kind: 'pass', name: 'Mostrador de entrega', x: 6, y: 4, w: 3, h: 1, stand: [[6, 3], [7, 3], [8, 3]], prop: 'k_pass', slots: 3 },
];

export const STATION_BY_ID: Readonly<Record<string, StationDef>> = Object.fromEntries(STATIONS.map((s) => [s.id, s]));

/** True when the spot is already the real station (no upgrade needed, or the upgrade is owned). */
export const stationActive = (s: StationDef, upgrades: readonly string[]): boolean => !s.needs || upgrades.includes(s.needs);

/** The kinds a spot behaves as right now: a locked station is a plain work counter. */
export function effectiveKind(s: StationDef, upgrades: readonly string[]): StationKind {
  return stationActive(s, upgrades) ? s.kind : 'counter';
}

export const stationAtTile = (x: number, y: number): StationDef | undefined =>
  STATIONS.find((s) => x >= s.x && x < s.x + s.w && y >= s.y && y < s.y + s.h);

/** Centre of a station in tile units (stations wider than a tile are centred). */
export const stationCentre = (s: StationDef): { x: number; y: number } => ({ x: s.x + s.w / 2, y: s.y + s.h / 2 });

/** Every tile a station occupies (what the grid blocks). */
export function footprint(s: StationDef): [number, number][] {
  const out: [number, number][] = [];
  for (let j = 0; j < s.h; j++) for (let i = 0; i < s.w; i++) out.push([s.x + i, s.y + j]);
  return out;
}

/** Pass counter slots: the three spots plates show on, left to right. */
export const PASS_SLOTS: readonly (readonly [number, number])[] = [[6, 4], [7, 4], [8, 4]];
