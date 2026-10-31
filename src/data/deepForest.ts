/**
 * Bosque profundo: the forest grown westward, as its own map beside the village one (world x -40). Dense trees on both
 * sides of a winding two-tile trail that is always clear, a clearing with a carved stump and stone lanterns, a pond to
 * fish in and things to gather. It opens from the west edge of the Bosque de los Susurros.
 */
import { Builder, treeBorder, zone } from './zoneKit';
import type { ZoneDef } from './zones';

export const DEEP_FOREST = { id: 'deepforest', w: 40, h: 25, world: { x: -40, y: 0 }, door: 6 } as const;

export function deepForest(): ZoneDef {
  const { w: W, h: H, door } = DEEP_FOREST;
  const b = new Builder(W, H, 'G');
  // the trail: in from the east edge, round the clearing, down to the pond and back up along the west
  const trail: [number, number][] = [[W - 1, door], [30, door], [30, 13], [21, 13], [21, 8], [8, 8], [8, 18], [24, 18], [24, 21], [33, 21]];
  for (let n = 1; n < trail.length; n++) {
    let [x, y] = trail[n - 1];
    const [tx, ty] = trail[n];
    while (true) {
      b.rect(x, y, 2, 2, 'p');
      if (x === tx && y === ty) break;
      if (x !== tx) x += Math.sign(tx - x); else y += Math.sign(ty - y);
    }
  }
  b.rect(12, 10, 8, 6, 'g'); // the clearing
  // the pond, north of the trail's last stretch: a rounded shape, not a square
  for (let y = 14; y < 21; y++) for (let x = 26; x < 35; x++) if (((x + 0.5 - 30.5) / 4) ** 2 + ((y + 0.5 - 17.3) / 2.8) ** 2 < 1) b.g[y][x] = 'w';
  treeBorder(b, [[W - 1, door], [W - 1, door + 1]], ['tree_dark']);
  b.prop('stump', 15, 12).prop('stonelantern', 12, 10).prop('stonelantern', 19, 10).prop('bench', 13, 15)
    .prop('mushroom', 17, 14).prop('mushroom', 18, 11).prop('flowers_lav', 12, 14).prop('bush_berry', 19, 15)
    .prop('reeds', 27, 15).prop('reeds', 33, 15).prop('reeds', 33, 19).prop('bigrock', 26, 20)
    .prop('mushroom', 10, 6).prop('mushroom', 6, 16).prop('bush_berry', 35, 4);
  // dense woods: a tree on every other tile that is grass, not beside the trail, the clearing or the water, and not on
  // the scenery above
  const open = (x: number, y: number) => {
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (!'G'.includes(b.g[y + j]?.[x + i] ?? 'G')) return true;
    return false;
  };
  for (let y = 2; y < H - 1; y += 2) for (let x = 1 + (y / 2) % 2; x < W - 1; x += 2) {
    if (b.g[y][x] !== 'G' || open(x, y) || b.props.some((p) => p.y === y && Math.abs(p.x - x) <= 1)) continue;
    b.prop('tree_dark', x, y); // the forest's one kind of tree
  }
  return {
    ...zone(b, {
      id: DEEP_FOREST.id, name: 'Bosque Profundo', music: 'forest', outdoor: true,
      doors: [door, door + 1].map((y) => ({ x: W - 1, y, to: 'forest', tx: 1, ty: y, dir: 'right' as const, walk: true, label: 'Bosque de los Susurros' })),
      interact: [
        { id: 'deep_fish1', x: 28, y: 20, label: 'Pescar', action: 'fish:lake' },
        { id: 'deep_fish2', x: 31, y: 20, label: 'Pescar', action: 'fish:lake' },
      ],
      rooms: [],
      gather: [
        { x: 10, y: 9, pool: ['shiitake', 'berry'] },
        { x: 16, y: 14, pool: ['fl_bell', 'shiitake', 'st_amethyst'] },
        { x: 9, y: 16, pool: ['wood', 'shiitake'] },
        { x: 22, y: 19, pool: ['berry', 'fl_camellia'] },
        { x: 31, y: 7, pool: ['wood', 'stone', 'st_quartz'] },
        { x: 25, y: 11, pool: ['berry', 'fl_bell'] },
      ],
      fishing: 'lake',
      bugs: true,
    }),
    world: DEEP_FOREST.world,
  };
}
