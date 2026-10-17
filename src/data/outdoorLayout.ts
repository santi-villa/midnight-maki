/** Authored streets and small outdoor scenes. Coordinates express a purpose, never a scatter seed.
 * Applied once while defining the maps; simulation, time and illumination use their normal systems.
 */
import type { PropPlace, ZoneDef } from './zones';
import { HOUSES, houseDoorTile } from './houses';
import { PROPS } from './props';
import { EAST_PROPS } from './plazaEast';

type Place = readonly [id: string, x: number, y: number, cond?: string];
type Path = readonly [x: number, y: number, w: number, h: number, tile: string];
export interface StreetPlan { paths: readonly Path[]; props: readonly Place[]; }
const DECOR = new Set(['lamppost', 'stonelantern', 'lantern_red', 'lantern_cream', 'bench',
  'crate', 'barrel', 'sack', 'flowers', 'flowers_lav', 'bush', 'bush_flower', 'bush_berry',
  'pot_rose', 'pot_cream', 'bicycle', 'bicycle_rose', 'vending_blue', 'vending_red',
  'lanternstring', 'reeds', 'puddle', 'fence', 'boat', 'sign', 'menuboard', 'library_books',
  'village_net', 'village_bank_w', 'village_bank_e', 'boat_rope', 'village_fish_crate']);
const TREES = new Set(['tree', 'tree_dark', 'pine', 'sakura']);

export const STREET_PLANS: Record<string, StreetPlan> = {
  plaza: {
    paths: [
      [10, 8, 2, 1, 'c'], // restaurant walk meets the square instead of ending at a lamp
      [63, 10, 2, 2, 'c'], [53, 10, 2, 2, 'c'], // stair landings reach the east road
      [15, 7, 2, 3, 'c'], // open north approach: benches flank the axis instead of blocking it
      [26, 7, 5, 2, 'c'], [29, 9, 2, 13, 'c'], [26, 19, 5, 3, 'c'], // shop walk around Taro's facade
      [31, 8, 2, 5, 'p'], // florist's garden opens onto the west-bank landing
      [2, 31, 34, 2, 'c'], [15, 26, 2, 17, 'p'], // residential street ends at its first porch
      [2, 39, 28, 2, 'c'], [28, 32, 2, 8, 'c'], // harbour lane and loading approach
      [35, 30, 6, 3, 'b'], [56, 30, 4, 3, 'b'], // lower bridges over both branches, with open approaches
      [6, 25, 10, 2, 'c'], // library forecourt, connected to the south axis
    ],
    props: [
      // Restaurant forecourt: door and mailbox stay clear; bicycles have a parking bay.
      ['pot_rose', 1, 9], ['pot_cream', 8, 9], ['menuboard', 10, 10],
      ['lantern_red', 2, 8], ['lantern_red', 8, 10], ['bicycle', 9, 4],
      ['bush_flower', 2, 9], ['flowers', 4, 10], ['flowers', 5, 10],
      // Civic green: benches are also the existing characters' seated stops.
      ['bench', 11, 17], ['bench', 18, 17], ['bench', 9, 14], ['bench', 21, 14],
      ['sakura', 13, 6], ['sakura', 19, 6],
      ['street_lamp_l', 10, 6], ['street_lamp_r', 21, 8],
      ['flowers', 9, 9], ['flowers_lav', 10, 9], ['flowers', 21, 16], ['flowers_lav', 22, 16],
      ['tree', 5, 11], ['bush_flower', 3, 11],
      // Shop displays against their own frontages, never across a threshold.
      ['pot_cream', 28, 6], ['street_lamp_r', 28, 11],
      ['deco_mannequin', 21, 5], // one display beside Yuki; the rack no longer hides behind the cherry tree
      ['deco_breadcart', 7, 19], ['street_lamp_l', 9, 19], // Bento: a bread cart by the door
      ['deco_vegcrates', 22, 19], ['deco_sacks', 20, 18], ['street_lamp_r', 31, 19], // Taro: sacks and crates of vegetables
      ['vending_blue', 31, 18],
      ['pot_cream', 5, 24], ['street_lamp_l', 5, 25], ['street_lamp_r', 14, 24],
      ['bench', 4, 26], ['flowers_lav', 4, 24], ['deco_bookcart', 6, 22], // library: books to return
      ['bicycle_rose', 21, 23], ['pot_rose', 22, 22],
      // West river landing: a tea garden and shaded seat beside the crossing.
      ['tree', 35, 9], ['tree', 35, 18],
      ['street_lamp_l', 36, 11],
      ['bench', 31, 16], ['flowers_lav', 34, 20], ['flowers_lav', 35, 20],
      ['bush_flower', 32, 18], ['bush_flower', 33, 19],
      // Residential veredas and communal courtyard, clear of the new porches.
      ['street_lamp_l', 1, 30], ['street_lamp_l', 8, 30], ['street_lamp_r', 17, 33], ['street_lamp_r', 25, 33],
      ['pot_rose', 1, 29],
      ['fence', 2, 33], ['fence', 3, 33], ['fence', 4, 33], ['fence', 10, 33], ['fence', 11, 33],
      ['flowers', 5, 34], ['flowers', 6, 34], ['flowers_lav', 12, 34], ['flowers_lav', 13, 34],
      ['sakura', 8, 34], ['tree', 19, 35],
      ['village_pine', 8, 29], ['village_pine', 24, 35],
      ['bench', 11, 36], ['pot_cream', 14, 36],
      ['street_lamp_l', 8, 38], ['street_lamp_l', 21, 38], ['street_lamp_l', 32, 38],
      // Harbour: cargo at the fishing houses, clear deck and fishing stations.
      ['crate', 30, 38], ['barrel', 31, 38], ['sack', 32, 36], ['village_net', 31, 37],
      ['deco_flowerstand', 25, 29],
      // Trees frame quiet lawns and back gardens, leaving streets and porches in view.
      ['tree', 11, 2], ['tree', 20, 2], ['sakura', 21, 25],
      ['tree', 34, 25], ['tree', 33, 34], ['tree', 56, 33],
      ['bush_flower', 11, 4], ['bush_flower', 20, 4],
      ['lantern_cream', 35, 34], ['lantern_cream', 38, 34],
      ['boat_rope', 34, 42], ['boat', 39, 38],
      ['puddle', 12, 18, 'rain'], ['puddle', 20, 17, 'rain'], ['puddle', 17, 18, 'rain'],
      ['sign_forest', 17, 3], ['sign_station', 2, 10], ['sign_riverside', 34, 10],
      ['sign_harbor', 17, 26], ['sign_beach', 19, 41],
      ...EAST_PROPS,
    ],
  },
  beach: {
    paths: [[13, 3, 4, 7, 'p'], [4, 10, 25, 2, 'p'], [28, 10, 4, 3, 'p'], [30, 7, 16, 2, 'p'], [30, 8, 2, 5, 'p'], [45, 8, 2, 5, 'p'], [31, 12, 15, 1, 'p']],
    props: [
      // Fish/conch market and Nami's work space. The sand remains a broad public walk.
      ['street_lamp_l', 12, 4], ['street_lamp_r', 17, 4], ['street_lamp_l', 4, 9], ['street_lamp_r', 12, 9],
      ['village_fish_crate', 4, 7], ['barrel', 12, 7], ['village_net', 6, 6],
      ['deco_fishrack', 34, 6], // drying fish by the fishmonger's cabin
      ['vending_red', 23, 6], ['bicycle', 20, 6], ['pot_cream', 29, 5],
      ['bench', 25, 8], ['pot_rose', 28, 8],
      ['crate', 22, 12], ['barrel', 18, 12], ['lantern_cream', 17, 12], ['lantern_cream', 21, 12],
      ['boat_rope', 23, 14], ['boat', 31, 14], ['boat_rope', 44, 14],
      ['village_beach_pier', 19, 12], ['village_beach_pier', 38, 12],
      // Cove homes: work gear beside walls, seats overlooking the water, clear pier mouths.
      ['street_lamp_l', 29, 8], ['street_lamp_r', 46, 7], ['street_lamp_r', 37, 6],
      ['village_fish_crate', 36, 6], ['barrel', 38, 6], ['village_net', 24, 13], ['sack', 44, 6],
      ['lantern_cream', 37, 13], ['lantern_cream', 40, 13],
      ['tree', 30, 2], ['tree', 38, 2], ['pot_rose', 39, 6],
      ['village_pine', 38, 5],
      ['bush_flower', 30, 4],
      ['reeds', 1, 14], ['reeds', 12, 14], ['reeds', 30, 14], ['reeds', 47, 14],
      ['sign_plaza_up', 17, 2], ['sign_lighthouse', 5, 6], ['puddle', 12, 12, 'rain'],
    ],
  },
  forest: {
    paths: [[8, 9, 10, 2, 'g'], [4, 6, 4, 1, 'p'], [30, 12, 14, 2, 'p'], [41, 6, 2, 6, 'p']],
    props: [
      // Cabin supplies beside its wall; quiet lanterns at path junctions, not city lamps.
      ['crate', 2, 6], ['sack', 3, 6], ['stonelantern', 8, 7], ['stonelantern', 8, 14],
      ['stonelantern', 17, 14], ['flowers_lav', 6, 15], ['flowers_lav', 7, 15],
      ['bush_berry', 12, 18], ['bush_berry', 23, 21], ['bush_berry', 31, 20], ['bush_berry', 46, 6],
      ['reeds', 19, 10], ['reeds', 27, 10], ['reeds', 35, 2], ['reeds', 38, 6],
      ['reeds', 33, 14], ['reeds', 40, 14], ['village_forest_bridge', 36, 12],
      // The old shrine has a symmetric arrival court and an uncluttered offering area.
      ['stonelantern', 39, 10], ['stonelantern', 44, 10], ['stonelantern', 41, 14], ['stonelantern', 45, 14],
      ['flowers_lav', 43, 10], ['flowers_lav', 44, 11], ['flowers', 46, 7],
      ['sign', 40, 11], ['sign_plaza_down', 16, 21],
    ],
  },
  garden: {
    paths: [[10, 16, 2, 7, 'p'], [3, 20, 23, 2, 'p'], [25, 10, 2, 6, 'p'], [34, 10, 2, 6, 'p'],
      [11, 11, 12, 2, 'p'], [25, 9, 1, 2, 'c'], // continuous garden walk and tea-house entrance
      [30, 12, 2, 3, 'p'], [24, 16, 2, 9, 'p'], [36, 12, 1, 13, 'p'], [24, 24, 13, 1, 'p']], // koi-pond loop
    props: [
      // Cultivation: tools/seed bank close to the plots, fences at the garden edge.
      ['fence', 2, 6], ['fence', 3, 6], ['fence', 4, 6], ['fence', 6, 6], ['fence', 7, 6], ['fence', 8, 6],
      ['pot_rose', 9, 8], ['pot_cream', 9, 9], ['stonelantern', 12, 3], ['stonelantern', 21, 7],
      ['lantern_red', 2, 8], ['lantern_cream', 8, 8], ['bench', 13, 8], ['reeds', 21, 5],
      ['flowers', 3, 13], ['flowers', 4, 13], ['flowers_lav', 18, 2],
      // Tea/florist forecourts and a separate river-facing path into the koi garden.
      ['lantern_red', 24, 9], ['lantern_cream', 36, 9], ['pot_rose', 24, 8], ['pot_cream', 36, 8],
      ['bench', 22, 16], ['bench', 36, 9], ['stonelantern', 29, 15], ['stonelantern', 32, 15],
      ['stonelantern', 29, 25], ['stonelantern', 33, 25], ['village_garden_bridge', 30, 15],
      ['reeds', 26, 20], ['reeds', 35, 18], ['reeds', 27, 23],
      ['flowers', 22, 14], ['flowers_lav', 23, 15], ['flowers', 35, 9],
      ['pot_rose', 20, 19], ['pot_cream', 13, 19],
      ['flowers_lav', 22, 18], ['flowers_lav', 23, 18],
      ['bush_flower', 22, 7], ['bush', 37, 5],
      ['village_pine', 23, 8],
      ['sakura', 6, 14], ['sakura', 3, 22], ['sakura', 6, 23], ['sakura', 9, 22],
      ['sakura', 18, 23], ['sakura', 21, 22], ['sakura', 4, 24], ['sakura', 8, 24], ['sakura', 17, 24], ['sakura', 22, 24],
      ['flowers', 32, 5], ['flowers_lav', 33, 5], ['flowers', 34, 5],
      ['flowers', 32, 6], ['flowers_lav', 33, 6], ['flowers', 34, 6],
      ['sign_plaza_left', 1, 8], ['puddle', 7, 12, 'rain'],
    ],
  },
  station: {
    paths: [[2, 13, 7, 2, 'p'], [2, 19, 7, 1, 'p'], [12, 18, 7, 2, 'p']],
    props: [
      // Public platform and signed entrance; freight stays in the depot yard.
      ['sign', 15, 8], ['street_lamp_r', 18, 8], ['street_lamp_l', 2, 8],
      ['bench', 5, 8], ['bench', 11, 8], ['pot_cream', 17, 8],
      ['crate', 0, 16], ['crate', 1, 16], ['barrel', 7, 18], ['sack', 0, 18], ['village_net', 0, 19],
      ['street_lamp_l', 8, 16], ['street_lamp_r', 12, 20],
      ['bush', 7, 21], ['bush', 12, 15], ['bush', 22, 6],
      ['reeds', 16, 20], ['flowers_lav', 7, 20],
      ['sign_plaza_right', 20, 8],
    ],
  },
  market: {
    paths: [[2, 5, 37, 4, 'c'], [2, 12, 37, 3, 'c'], [12, 5, 2, 13, 'c']],
    props: [
      // Two clear shopping aisles: hanging lights belong to the stalls and the perimeter.
      ['lantern_red', 2, 3], ['lantern_cream', 8, 3], ['lantern_red', 14, 3], ['lantern_cream', 19, 3], ['lantern_red', 24, 3],
      ['lantern_red', 26, 3], ['lantern_cream', 31, 3], ['lantern_red', 36, 3],
      ['lantern_cream', 3, 10], ['lantern_red', 17, 9], ['lantern_cream', 27, 10], ['lantern_red', 33, 10], ['lantern_cream', 38, 10],
      ['street_lamp_l', 1, 5], ['street_lamp_r', 39, 5], ['street_lamp_l', 1, 12], ['street_lamp_r', 39, 12],
      // Tea / memory corner between stalls, seats and bins against the boundaries.
      ['bench', 15, 10], ['bench', 31, 10], ['pot_rose', 8, 10], ['pot_cream', 17, 10], ['pot_rose', 30, 10], ['pot_cream', 36, 10],
      ['crate', 7, 11], ['barrel', 22, 11], ['vending_red', 15, 15],
      ['crate', 29, 15], ['barrel', 36, 15], ['bush_flower', 1, 8], ['bush_flower', 38, 3], ['bush', 25, 3],
      ['sign_plaza_down', 17, 15],
    ],
  },
};

export function arrangeOutdoors(zones: Record<string, ZoneDef>) {
  for (const [id, plan] of Object.entries(STREET_PLANS)) {
    const z = zones[id];
    // Old random street dressing is replaced, not stacked underneath the new scenes.
    z.props = z.props.filter(p => !DECOR.has(p.id) && !p.id.startsWith('sign_') &&
      !(id === 'plaza' && TREES.has(p.id) && p.x > 1 && p.y > 1 && p.x < z.w - 2 && p.y < z.h - 2) &&
      !(id === 'garden' && p.id === 'sakura' && p.x > 1 && p.y > 1 && p.x < z.w - 1 && p.y < z.h - 1));
    const ground = z.ground.map(r => r.split(''));
    // The market has two aisles and a central access, with grassy verges for its furniture.
    if (id === 'market') for (const row of ground) for (let x = 0; x < row.length; x++) if (row[x] === 'c') row[x] = 'G';
    if (id === 'plaza') for (let y = 26; y <= 41; y++) for (let x = 0; x < 36; x++) {
      if ('pc'.includes(ground[y][x])) ground[y][x] = 'g';
    }
    if (id === 'beach') for (let y = 7; y <= 12; y++) for (let x = 30; x < z.w; x++) {
      if ('pc'.includes(ground[y][x])) ground[y][x] = 's';
    }
    if (id === 'garden') for (let x = 3; x <= 20; x++) if (ground[19][x] === 'p') ground[19][x] = 'g';
    for (const [x, y, w, h, ch] of plan.paths) for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) {
      // A path cannot silently fill a lake; only an explicitly designed bridge spans water.
      if (ground[j]?.[i] !== undefined && (ch === 'b' || !'wdb'.includes(ground[j][i]))) ground[j][i] = ch;
    }
    // Every relocated house has an entry connected to the appropriate district's public path.
    for (const h of HOUSES.filter(h => h.zone === id)) {
      const [x, y] = houseDoorTile(h);
      for (let j = y + 1; j <= y + 2; j++) if (ground[j]?.[x] && !'wd'.includes(ground[j][x])) ground[j][x] = 'c';
    }
    // A visible threshold is part of the path, including the tile freed by the walk-through door.
    for (const d of z.doors.filter(d => d.walk)) if (ground[d.y]?.[d.x] && !'wd'.includes(ground[d.y][d.x])) ground[d.y][d.x] = 'c';
    z.ground = ground.map(r => r.join(''));
    z.props.push(...plan.props.map(([id, x, y, cond]): PropPlace => ({ id, x, y, ...(cond ? { cond } : {}) })));
    // The connected terrain now draws decks and their turns. A straight overlay would close the L-shaped join again.
    z.props = z.props.filter(p => PROPS[p.id]?.kind !== 'village_deck');
    if (id === 'beach') {
      const rock = z.props.find(p => p.id === 'rock' && p.x === 33 && p.y === 13);
      if (rock) { rock.x = 34; rock.y = 14; }
    }
  }
}

/** Used in review/tests to distinguish street fixtures from natural vegetation and working docks. */
export const isStreetFixture = (p: PropPlace) => PROPS[p.id]?.kind === 'lamppost' || PROPS[p.id]?.kind === 'signpost';
