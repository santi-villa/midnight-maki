import { describe, expect, it } from 'vitest';
import catalog from '../assets/limezu/exteriors.json';
import { PROPS } from '../data/props';
import { SEA_EDGES, TILE_INDEX } from '../art/tiles';
import { seaDepthAt, seaEdge } from '../world/zoneRuntime';
import { SEA_FRAMES } from '../art/exteriors';
import { ZONES } from '../data/zones';

describe('LimeZu exterior pieces', () => {
  it('only draw props that exist, each ID once', () => {
    const seen = new Set<string>();
    for (const piece of catalog.pieces) for (const id of piece.replaces) {
      expect(PROPS[id], `${piece.id} -> ${id}`).toBeTruthy();
      expect(seen.has(id), `${id} drawn twice`).toBe(false);
      seen.add(id);
    }
  });

  it('ship every frame of the sea and its waterline, and the tileset has a slot for each', () => {
    const tiles = catalog.tiles as Record<string, unknown>;
    for (let f = 0; f < SEA_FRAMES; f++) {
      for (let p = 0; p < 4; p++) {
        expect(tiles[`sea${p}_${f}`]).toBeTruthy();
        for (const k of ['c', 'r']) for (const d of ['s', 'm', 'd']) expect(TILE_INDEX[`sea${k}${d}${p}_${f}`]).toBeGreaterThan(0);
      }
      for (let p = 0; p < 2; p++) expect(TILE_INDEX[`seashore${p}_${f}`] && tiles[`seashore${p}_${f}`]).toBeTruthy();
    }
    expect(tiles.sand && tiles.sandpath).toBeTruthy();
    for (const [kind, parities] of SEA_EDGES) for (let p = 0; p < parities; p++) for (let f = 0; f < SEA_FRAMES; f++) {
      expect(tiles[`seashore${kind}${p}_${f}`], `seashore${kind}${p}_${f}`).toBeTruthy();
      expect(TILE_INDEX[`seashore${kind}${p}_${f}`]).toBeGreaterThan(0);
    }
  });

  it('follow a stepped coast with sides and corners, and lighten the sea near land', () => {
    expect(seaEdge(['ddd', 'dds', 'ddd'], 1, 1)).toBe('seashoreE1'); // sand to the right only
    expect(seaEdge(['ddd', 'sdd', 'ddd'], 1, 1)).toBe('seashoreW1'); // sand to the left only
    expect(seaEdge(['ssd', 'sdd', 'ddd'], 1, 1)).toBe('seashoreNW0'); // sand above and to the left
    expect(seaEdge(['dss', 'dds', 'ddd'], 1, 1)).toBe('seashoreNE0'); // sand above and to the right
    expect(seaEdge(['ddd', 'sss', 'ddd'], 1, 2)).toBe('seashore1'); // sand above
    expect(seaEdge(['dds', 'ddd', 'ddd'], 1, 1)).toBe('seashoreIE0'); // sand only diagonally up-right
    expect(seaEdge(['ddd', 'ddd', 'ddd'], 1, 1)).toBeNull();
    const coast = ['sssss', ...Array(8).fill('ddddd')];
    expect(seaDepthAt(coast, 2, 2)).toBe('s');
    expect(seaDepthAt(coast, 2, 8)).toBe('d');
    expect(seaEdge(['gg', 'dd'], 0, 1)).toBeNull(); // grass gets no sandy foam
  });

  it('dress the plaza square: no earlier pack draws its props first, and the planters stand where the flat beds were', async () => {
    const serene = (await import('../assets/serene/catalog.json')).default.pieces.flatMap((p) => p.replaces);
    const japanese = (await import('../assets/japanese-city/catalog.json')).default.pieces.flatMap((p) => p.replaces);
    for (const id of ['fountain', 'bench', 'street_lamp_l', 'mailbox', 'pot_rose', 'pot_cream']) {
      expect(catalog.pieces.some((p) => p.replaces.includes(id)), id).toBe(true);
      expect([...serene, ...japanese], id).not.toContain(id);
    }
    const plaza = ZONES.plaza;
    const ids = new Set(plaza.props.map((p) => p.id));
    for (const id of ['planter_pink', 'planter_white', 'planter_red']) expect(ids.has(id), id).toBe(true);
    for (const row of plaza.ground) expect(row).not.toMatch(/[ryl]{2}/);
  });
});
