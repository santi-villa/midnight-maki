/** Shared world coordinates. Historic house IDs remain addresses, never coordinate parsers. */
export const VILLAGE_BOUNDS = {
  plaza: { x: 31, y: 23, w: 41, h: 37, name: 'Centro de Villa Nori', music: 'town' },
  forest: { x: 0, y: 0, w: 31, h: 25, name: 'Bosque de los Susurros', music: 'forest' },
  garden: { x: 0, y: 25, w: 31, h: 23, name: 'Jardín de los Faroles', music: 'garden' },
  beach: { x: 0, y: 48, w: 31, h: 32, name: 'Playa de las Conchas', music: 'beach' },
  shrine: { x: 31, y: 0, w: 41, h: 23, name: 'Colina del Santuario', music: 'garden' },
  station: { x: 72, y: 0, w: 48, h: 23, name: 'Estación Abandonada', music: 'mystery' },
  residential: { x: 72, y: 23, w: 48, h: 37, name: 'Barrio residencial y ribera', music: 'town' },
  market: { x: 31, y: 60, w: 43, h: 20, name: 'Mercado del Puerto', music: 'market' },
  harbor: { x: 74, y: 60, w: 46, h: 20, name: 'Puerto y Faro', music: 'beach' },
} as const;
export type VillageZone = keyof typeof VILLAGE_BOUNDS;
export const VILLAGE_REVISION = 2;
export function villageSpot(x: number, y: number) {
  const entry = Object.entries(VILLAGE_BOUNDS).find(([, b]) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h);
  if (!entry) throw new Error(`Outside Villa Nori: ${x},${y}`);
  return { zone: entry[0] as VillageZone, x: x - entry[1].x, y: y - entry[1].y };
}
/** In HOUSES order: eleven residences, three waterfront homes, two garden homes. */
export const VILLAGE_HOME_SITES: readonly (readonly [VillageZone, number, number])[] = [
  ['residential', 10, 7], ['residential', 20, 7], ['residential', 30, 7], ['residential', 40, 7],
  ['residential', 10, 18], ['residential', 20, 18], ['residential', 30, 18], ['residential', 40, 18],
  ['residential', 20, 29], ['residential', 30, 29], ['residential', 40, 29],
  ['harbor', 10, 3], ['market', 7, 4], ['harbor', 0, 3],
  ['garden', 6, 4], ['garden', 24, 4],
];
