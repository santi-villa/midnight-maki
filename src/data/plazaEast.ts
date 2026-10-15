/**
 * The east of Villa Nori, laid out after the village illustration (public/mapa/villa-nori.webp):
 * a river that falls over rocks at the top, turns a watermill and splits round a peninsula of houses,
 * the shrine hill with its terraces, stairs and the market torii, the cherry grove with its pond, and the coast.
 * Everything west of x = 32 (the old centre) keeps its coordinates.
 */
import type { Builder } from './zoneKit';

export const EAST = {
  /** zone width: the illustration needs room on the east side */
  W: 72,
  /** terrace rows (the shrine hill): A is the top, B carries the east road */
  cliff1: [7, 9] as const,
  cliff2: [14, 15] as const,
  /** the two stair columns (2 wide) up the first cliff, and the one down the second */
  stairsA: 53,
  stairsB: 63,
  /** market gate on the top terrace */
  market: { x: 63, y: 0 },
  garden: { x: 71, y: 12 },
  shrine: { x: 48, y: 1 },
} as const;

type Pt = [number, number];

/** a river along a centre line, about 4 cells across (a disc is stamped along the line); the middle is deep */
function river(b: Builder, pts: Pt[], deepFromY = 2) {
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
    const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 3));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps, fx = x0 + (x1 - x0) * t, fy = y0 + (y1 - y0) * t;
      for (let y = Math.floor(fy - 2.4); y <= Math.ceil(fy + 2.4); y++) for (let x = Math.floor(fx - 2.4); x <= Math.ceil(fx + 2.4); x++) {
        const d = Math.hypot(x + 0.5 - fx, y + 0.5 - fy);
        if (d > 1.9 || !b.g[y]?.[x] || b.g[y][x] === 'b') continue;
        b.set(x, y, d <= 0.95 && y >= deepFromY ? 'd' : b.g[y][x] === 'd' ? 'd' : 'w');
      }
    }
  }
}
/** cells the river occupies at a row (for bridges and banks) */
export const riverCells = (b: Builder, y: number) => b.g[y].map((c, x) => ('wd'.includes(c) ? x : -1)).filter((x) => x >= 0);

export const WEST_RIVER: Pt[] = [[41, 0], [41, 4], [40, 9], [40, 13], [39, 17], [38, 21], [38, 27], [38, 33], [38, 36], [38, 38]];
export const EAST_BRANCH: Pt[] = [[38, 17], [43, 18], [49, 18], [55, 19], [58, 22], [58, 27], [58, 31], [59, 35], [59, 38]];

export function buildEastTerrain(b: Builder) {
  const { W } = EAST;
  const H = b.h;
  // ------------------------------------------------------------ the hill: two terraces and two rock faces
  b.rect(47, 0, W - 47, 7, 'G');                       // top terrace (shrine, market)
  b.rect(47, 7, W - 47, 3, 'C');                       // first rock face
  b.rect(47, 10, W - 47, 4, 'g');                      // second terrace (the east road)
  b.rect(47, 14, W - 47, 2, 'C');                      // second rock face
  // the rocks the river falls over, at the very top
  b.rect(34, 0, 13, 3, 'C');
  // ragged rock edges: a stone sticks out of each face here and there
  for (let x = 48; x < W; x++) {
    if ((x * 7) % 5 === 0 && ![53, 54, 63, 64].includes(x)) b.set(x, 6, 'C');
    if ((x * 5) % 7 === 0 && ![53, 54, 63, 64, 53, 64].includes(x) && x !== 71) b.set(x, 10, 'C');
  }
  // stairs: a walkable strip through each rock face
  for (const [x, y0, y1] of [[EAST.stairsA, 7, 9], [EAST.stairsB, 7, 9], [EAST.stairsB, 14, 15]] as const) b.rect(x, y0, 2, y1 - y0 + 1, 'c');

  // ------------------------------------------------------------ roads and paths
  b.rect(23, 12, W - 23, 2, 'p');                      // east road, over the river and along the terrace to the garden
  b.rect(0, 30, 36, 3, 'c'); b.rect(40, 30, W - 40, 3, 'c'); // harbour promenade, across both bridges
  b.rect(46, 14, 2, 16, 'p');                          // the peninsula's street
  b.rect(44, 10, 2, 2, 'p');                           // to the mill door
  b.rect(EAST.market.x, 1, 2, 6, 'c'); b.rect(61, 3, 6, 1, 'c'); // top terrace: market approach
  b.rect(49, 5, 6, 2, 'c'); b.rect(50, 2, 2, 3, 'c');  // top terrace: to the shrine
  b.rect(EAST.stairsB, 16, 2, 7, 'p');                 // down into the cherry grove
  b.rect(61, 22, 10, 2, 'p'); b.rect(61, 29, 10, 1, 'p');  // grove loop north and south of the pond
  b.rect(61, 22, 2, 8, 'p'); b.rect(69, 22, 2, 8, 'p');
  b.rect(EAST.stairsB, 29, 2, 1, 'p');

  // ------------------------------------------------------------ the river: waterfall, mill, a branch round the peninsula
  river(b, WEST_RIVER, 3);
  river(b, EAST_BRANCH, 3);
  // the east road crosses the river on a plank bridge, the street over the branch, the promenade over both
  for (const y of [12, 13]) for (const x of riverCells(b, y)) b.set(x, y, 'b');
  for (const y of [30, 31, 32]) for (const x of riverCells(b, y)) b.set(x, y, 'b');
  for (let y = 14; y <= 21; y++) for (const x of [46, 47]) if ('wd'.includes(b.g[y][x])) b.set(x, y, 'b');

  // ------------------------------------------------------------ the cherry pond with a little island and a plank bridge
  b.rect(64, 25, 5, 3, 'w'); b.rect(65, 26, 3, 1, 'd');
  b.rect(66, 25, 1, 2, 'G');
  b.rect(66, 24, 1, 1, 'b');

  // ------------------------------------------------------------ the coast: sand, shore, sea
  b.rect(48, 34, W - 48, 3, 's');
  b.rect(48, 37, W - 48, 1, 'h');
  b.rect(48, 38, W - 48, H - 38, 'w');
  b.rect(42, 41, W - 42, H - 41, 'd');
  // the rivers reach the sea over the sand
  river(b, [[38, 36], [38, 38]], 3); river(b, [[59, 36], [59, 38]], 3);
  b.rect(33, 36, 15, 8, 'w').rect(35, 38, 11, 6, 'd'); // the old bay and its piers stay
  b.rect(30, 39, 7, 2, 'b').rect(36, 35, 2, 5, 'b');
  b.rect(46, 14, 2, 1, 'p');
}

/** every tree, lamp, bench and flower of the east, as plain data (applied with the rest of the street dressing) */
export const EAST_PROPS: readonly (readonly [string, number, number, string?])[] = [
  // the waterfall, flat over the rocks and the first cells of the river
  ['waterfall', 39, 0], ['rock', 35, 2], ['rock', 45, 2], ['rock', 43, 1], ['rock', 36, 0],
  // the mill beside the river, with its door on the street
  ['mill', 42, 7],
  ['pine', 44, 4], ['pine', 46, 5], ['tree_dark', 43, 5], ['bush', 42, 10], ['flowers', 43, 11],
  ['lamppost', 43, 14], ['bench', 47, 10],
  // the east road: lamps and a signpost
  ['lamppost', 56, 11], ['lamppost', 66, 11], ['sign_garden', 69, 10],
  // top terrace: market stalls either side of the approach and the torii
  ['stall_rose', 56, 3], ['stall_sage', 59, 3], ['stall_gold', 66, 3], ['stall_night', 69, 3],
  ['stall_night', 56, 5], ['stall_rose', 59, 5], ['stall_sage', 66, 5], ['stall_gold', 69, 5],
  ['lantern_red', 55, 2], ['lantern_cream', 62, 2], ['lantern_red', 65, 2], ['lantern_cream', 70, 2],
  ['barrel', 62, 6], ['crate', 65, 6], ['sack', 55, 6],
  // top terrace: the shrine and its lanterns
  ['stonelantern', 49, 4], ['stonelantern', 52, 4], ['stonelantern', 53, 6], ['stonelantern', 48, 6],
  ['sakura', 47, 3], ['sakura', 54, 1], ['flowers_lav', 51, 6], ['flowers', 49, 6], ['bush_flower', 47, 6],
  ['pine', 70, 6], ['pine', 47, 0],
  // second terrace
  ['stonelantern', 52, 11], ['stonelantern', 65, 11], ['sakura', 49, 11], ['sakura', 58, 10], ['flowers', 55, 11], ['flowers_lav', 60, 11],
  ['bench', 57, 13], ['sign_shrine', 54, 11],
  // the peninsula: street lamps, benches and a garden
  ['lamppost', 50, 24], ['lamppost', 45, 29], ['lamppost', 49, 29],
  ['bench', 49, 20], ['flowers', 41, 20], ['flowers_lav', 42, 20], ['tree', 34, 15], ['tree', 54, 21], ['bush', 54, 22],
  ['fence', 48, 26], ['fence', 49, 26], ['fence', 50, 26], ['fence', 51, 26], ['fence', 52, 26],
  ['flowers', 49, 27], ['flowers_lav', 50, 27], ['flowers', 51, 27], ['bench', 50, 28],
  ['pot_rose', 44, 24], ['pot_cream', 47, 24], ['tree', 41, 25],
  ['lantern_cream', 46, 22], ['lantern_cream', 46, 28], ['reeds', 36, 22], ['reeds', 36, 28], ['reeds', 54, 24],
  // the cherry grove: trees, lanterns and seats around the pond
  ['sakura', 60, 18], ['sakura', 66, 18], ['sakura', 69, 20], ['sakura', 61, 20], ['sakura', 54, 25], ['sakura', 70, 25],
  ['sakura', 70, 33], ['sakura', 70, 28], ['sakura', 63, 28],
  ['stonelantern', 63, 24], ['stonelantern', 69, 24], ['stonelantern', 63, 27], ['stonelantern', 69, 27],
  ['bench', 64, 21], ['bench', 67, 21], ['bench', 64, 28], ['flowers', 66, 28], ['flowers_lav', 67, 28],
  ['bush_flower', 61, 21], ['bush_flower', 70, 21], ['pot_rose', 63, 29], ['pot_cream', 67, 29],
  ['tree', 57, 17], ['tree', 70, 17], ['pine', 71, 19], ['pine', 71, 30],
  // the garden gate keeps its flanking lanterns
  ['stonelantern', 70, 11], ['bush_flower', 71, 11],
  // the promenade and the coast
  ['lamppost', 55, 29], ['lamppost', 62, 33],
  ['bench', 52, 33], ['bench', 66, 33],
  ['boat', 54, 40], ['boat', 63, 39], ['boat', 69, 42], ['boat', 46, 41],
  ['village_net', 52, 35], ['crate', 54, 35], ['barrel', 55, 36], ['sack', 53, 36], ['crate', 63, 35],
  ['rock', 49, 35], ['rock', 64, 36], ['rock', 70, 35], ['bush', 66, 34],
  ['lantern_cream', 50, 36], ['lantern_cream', 65, 35],
];
