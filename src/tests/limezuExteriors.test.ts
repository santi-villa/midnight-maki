import { describe, expect, it } from 'vitest';
import catalog from '../assets/limezu/exteriors.json';
import { PROPS } from '../data/props';
import { TILE_INDEX } from '../art/tiles';
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
    for (const id of ['planter_pink', 'planter_white', 'planter_red', 'pigeon']) expect(ids.has(id), id).toBe(true);
    for (const row of plaza.ground) expect(row).not.toMatch(/[ryl]{2}/);
  });
});
