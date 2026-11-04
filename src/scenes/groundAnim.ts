/**
 * The moving water of the village drawn by the GPU (Phaser 4's TilemapGPULayer). Instead of the game rewriting every water
 * tile a few times a second, the tileset itself says which tile follows which: the shader then animates every water,
 * shoreline and bank tile on its own, at no cost for the CPU.
 *
 * Each animated tile names its whole cycle starting from itself, so a tile placed on a later frame (the ponds start each
 * tile a little out of step, the banks alternate) keeps that offset forever, exactly as the old frame-by-frame painting did.
 */

/** One animation: the tiles in order and how long each one shows. */
export interface TileCycle { frames: number[]; ms: number }

/** The sea (and its waterline) moves every 225 ms; the drawn ponds every 450 ms; the grass banks every 900 ms. */
export const SEA_MS = 225, POND_MS = 450, BANK_MS = 900;

/**
 * Every water cycle in a tileset index (name → tile): `sea…_0..7`, `seashore…_0..7`, `wt…_0..3`, the beach waterline
 * (`shore`, `shore1..3`) and each bank shape (`bk<m>` ↔ `bkb<m>`).
 */
export function waterCycles(index: Record<string, number>): TileCycle[] {
  const groups = new Map<string, number[]>();
  for (const [name, tile] of Object.entries(index)) {
    const m = /^((?:sea|wt)[A-Za-z0-9]*)_(\d+)$/.exec(name);
    if (!m) continue;
    const list = groups.get(m[1]) ?? [];
    list[Number(m[2])] = tile;
    groups.set(m[1], list);
  }
  const out: TileCycle[] = [];
  for (const [name, list] of groups) {
    // only complete runs 0..n-1 of real tiles are animations
    if (list.length < 2 || list.some((t) => t === undefined)) continue;
    out.push({ frames: list, ms: name.startsWith('wt') ? POND_MS : SEA_MS });
  }
  const shore = ['shore', 'shore1', 'shore2', 'shore3'].map((n) => index[n]);
  if (shore.every((t) => t !== undefined)) out.push({ frames: shore, ms: POND_MS });
  for (let m = 1; m < 16; m++) {
    const a = index['bk' + m], b = index['bkb' + m];
    if (a !== undefined && b !== undefined) out.push({ frames: [a, b], ms: BANK_MS });
  }
  return out;
}

/** Tiled-style animation data for a Phaser tileset: tile (minus `firstgid`) → its cycle, starting from itself. */
export function tileAnimations(cycles: TileCycle[], firstgid = 0): Record<number, { animation: { tileid: number; duration: number }[]; animationDuration: number }> {
  const out: Record<number, { animation: { tileid: number; duration: number }[]; animationDuration: number }> = {};
  for (const { frames, ms } of cycles) {
    frames.forEach((tile, k) => {
      const id = tile - firstgid;
      // a tile in two cycles keeps the first (no tileset has that today)
      if (out[id]) return;
      const order = [...frames.slice(k), ...frames.slice(0, k)];
      out[id] = { animation: order.map((t) => ({ tileid: t - firstgid, duration: ms })), animationDuration: ms * frames.length };
    });
  }
  return out;
}
