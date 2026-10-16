import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../core/balance';
import { game, newSave, SAVE_VERSION } from '../core/state';
import { INGREDIENT_ALIASES, ITEMS_BY_ID } from '../data/items';
import { PROJECTS_BY_ID } from '../data/projects';
import { plaza } from '../data/plazaMap';
import { MIGRATIONS, validateSave } from '../persistence/validate';
import { TEMPLATES } from '../quests/daily';
import { SIDE_META } from '../quests/side';
import { questDef } from '../quests/quests';
import { applyRare, expectedFishValue, fishTable, quoteFishSale, rarityLabel } from '../systems/fishMarket';
import { bestRod, grantStarterRod, greenZone, planRodPurchase, RODS, tuneOf, type RodWallet } from '../systems/rods';

const weight = (rows: { weight: number }[]) => rows.reduce((sum, row) => sum + row.weight, 0);
const price = (id: string) => ITEMS_BY_ID[id].sell;

function wallet(over: Partial<RodWallet> = {}): RodWallet {
  return { coins: 0, inventory: {}, fishCaught: 0, ...over };
}

describe('fishing rods', () => {
  it('keeps three cheap-to-rare rods and a fail path', () => {
    expect(RODS.map((rod) => rod.id)).toEqual(['rod_basic', 'rod_better', 'rod_advanced']);
    expect(RODS[0].price).toBe(40);
    expect(RODS[0].price).toBeLessThanOrEqual(BALANCE.startCoins / 2);
    expect(RODS[1].price).toBe(150);
    expect(RODS[2].price).toBe(360);
    expect(RODS[2].rare).toBeGreaterThan(1);
    expect(RODS[2].rare).toBeLessThan(1.5);
    expect(RODS[2].gain).toBeGreaterThan(1);
    expect(RODS[2].control).toBeGreaterThan(0);
    expect(RODS[2].control).toBeLessThan(1);
    for (const rod of RODS) expect(ITEMS_BY_ID[rod.id].sell).toBe(0);

    const advanced = tuneOf('rod_advanced');
    const generous = greenZone(1, true, advanced);
    const hard = greenZone(5, false, advanced);
    expect(generous).toBeGreaterThan(16);
    expect(generous).toBeLessThanOrEqual(72);
    expect(hard).toBeGreaterThanOrEqual(16);
    expect(hard).toBeLessThan(generous);
    expect(hard).toBeLessThanOrEqual(72);

    const fishing = readFileSync(new URL('../minigames/fishing.ts', import.meta.url), 'utf8');
    expect(fishing).toContain('if (!equipped)');
    expect(fishing).toContain('progress += (inside ? 0.3 * tune.gain : relaxed ? -0.09 : -0.16) * dt;');
  });

  it('picks the best rod and gates each upgrade', () => {
    expect(bestRod({})).toBeNull();
    expect(bestRod({ rod_basic: 1, rod_advanced: 1 })?.id).toBe('rod_advanced');
    expect(planRodPurchase(wallet(), 'missing')).toBe('Esa caña no está a la venta.');
    expect(planRodPurchase(wallet({ inventory: { rod_advanced: 1 }, coins: 999 }), 'rod_basic')).toBe('Ya tenés una caña así o mejor.');
    expect(planRodPurchase(wallet({ coins: 999, fishCaught: 20 }), 'rod_better')).toBe('Primero conseguí la caña anterior.');
    expect(planRodPurchase(wallet({ coins: 999, inventory: { rod_basic: 1 } }), 'rod_better')).toMatch(/^Pescá 4 peces/);
    expect(planRodPurchase(wallet({ coins: 999, fishCaught: 4, inventory: { rod_basic: 1 } }), 'rod_better')).toBe('Te falta 2 Madera.');
    expect(planRodPurchase(wallet({ coins: 10, fishCaught: 4, inventory: { rod_basic: 1, wood: 2 } }), 'rod_better')).toBe('No te alcanzan las monedas.');

    const better = planRodPurchase(wallet({ coins: 150, fishCaught: 4, inventory: { rod_basic: 1, wood: 2 } }), 'rod_better');
    expect(better).toMatchObject({ id: 'rod_better', price: 150, take: { wood: 2, rod_basic: 1 }, give: 'rod_better' });

    expect(planRodPurchase(wallet({ coins: 999, fishCaught: 12, inventory: { rod_better: 1, wood: 3 } }), 'rod_advanced')).toBe('Te falta 1 Piedra.');
    const advanced = planRodPurchase(wallet({ coins: 360, fishCaught: 12, inventory: { rod_better: 1, wood: 3, stone: 1 } }), 'rod_advanced');
    expect(advanced).toMatchObject({ take: { wood: 3, stone: 1, rod_better: 1 }, give: 'rod_advanced' });
  });

  it('gives a basic rod only to saves that already fished', () => {
    const fresh = { inventory: { salmon: 2 } };
    grantStarterRod(fresh);
    expect(fresh.inventory).toEqual({ salmon: 2 });

    const caught: { inventory: Record<string, number>; stats: { fishCaught: number } } = { inventory: {}, stats: { fishCaught: 1 } };
    grantStarterRod(caught);
    expect(caught.inventory.rod_basic).toBe(1);

    const holding: { inventory: Record<string, number> } = { inventory: { f_sardine: 2 } };
    grantStarterRod(holding);
    expect(holding.inventory.rod_basic).toBe(1);

    const album: { inventory: Record<string, number>; collections: { fish: Record<string, number> } } = { inventory: {}, collections: { fish: { f_carp: 1 } } };
    grantStarterRod(album);
    expect(album.inventory.rod_basic).toBe(1);

    const upgraded = { inventory: { rod_better: 1 }, stats: { fishCaught: 9 } };
    grantStarterRod(upgraded);
    expect(upgraded.inventory).toEqual({ rod_better: 1 });

    expect(SAVE_VERSION).toBe(1);
    expect(MIGRATIONS).toEqual({});
    const loaded = validateSave(newSave());
    expect(loaded.inventory.rod_basic).toBeUndefined();
    const veteran = newSave() as ReturnType<typeof newSave> & { stats: { fishCaught: number }; collections: { fish: Record<string, number> } };
    veteran.stats = { fishCaught: 2 };
    veteran.inventory = { rice: 1 };
    const kept = validateSave(veteran);
    expect(kept.version).toBe(1);
    expect(kept.inventory.rod_basic).toBe(1);
    expect(kept.inventory.rice).toBe(1);
  });
});

describe('fish sale and catch value', () => {
  it('keeps the old afternoon weights and a small rare bump', () => {
    const sea = fishTable('sea', 1, false);
    expect(sea.map((row) => [row.id, row.weight, row.difficulty])).toEqual([
      ['f_sardine', 30, 1], ['f_mackerel', 24, 1], ['f_starfish', 12, 1],
      ['f_tuna', 14, 3], ['f_octopus', 6, 3], ['f_puffer', 1, 2], ['f_moonfish', 0, 5],
    ]);
    const lake = fishTable('lake', 1, false);
    expect(lake.find((row) => row.id === 'f_eel')?.weight).toBe(3);
    expect(lake.find((row) => row.id === 'f_koi')?.weight).toBe(0.5);

    const boosted = applyRare(sea, 1.28);
    for (const row of sea) {
      const next = boosted.find((item) => item.id === row.id)!;
      expect(next.weight).toBe(row.difficulty >= 3 ? row.weight * 1.28 : row.weight);
    }
    expect(expectedFishValue(boosted, price)).toBeLessThan(16);
    expect(expectedFishValue(boosted, price)).toBeGreaterThan(6);

    const night = applyRare(fishTable('sea', 3, true), 1.28);
    const moon = night.find((row) => row.id === 'f_moonfish')!;
    expect(moon.weight / weight(night)).toBeGreaterThan(0);
    expect(moon.weight / weight(night)).toBeLessThan(0.06);
    expect(ITEMS_BY_ID.f_sardine.sell).toBe(6);
    expect(ITEMS_BY_ID.f_tuna.sell).toBe(16);
    expect(ITEMS_BY_ID.f_moonfish.sell).toBe(40);
    expect(INGREDIENT_ALIASES.f_salmon).toBe('salmon');
    expect(INGREDIENT_ALIASES.f_tuna).toBe('tuna');
    expect(INGREDIENT_ALIASES.f_eel).toBe('eel');
  });

  it('quotes one chosen amount and never the whole bag by itself', () => {
    expect(quoteFishSale(6, 3, 2)).toEqual({ qty: 2, total: 12 });
    expect(quoteFishSale(6, 3.9, 3)).toEqual({ qty: 3, total: 18 });
    expect(quoteFishSale(6, 3, 4)).toBeNull();
    expect(quoteFishSale(6, 3, 0)).toBeNull();
    expect(quoteFishSale(0, 3, 1)).toBeNull();
    expect(quoteFishSale(6, 0, 1)).toBeNull();
    expect(rarityLabel(3)).toBe('Raro');
    expect(rarityLabel(2)).toBe('Poco común');
    expect(rarityLabel(1)).toBe('Común');

    const shops = readFileSync(new URL('../ui/shops.ts', import.meta.url), 'utf8');
    expect(shops).toContain("name: 'Caña'");
    expect(shops).toContain("name: 'Cañas'");
    expect(shops).toContain('No se vende el resto solo');
    expect(shops.toLowerCase()).not.toContain('vender todo');
  });

  it('lets the player fish in the plaza before any beach quest asks for a fish', () => {
    const town = plaza();
    const spots = town.interact.filter((spot) => spot.action === 'fish:sea' || spot.action === 'fish:lake');
    expect(spots.some((spot) => spot.action === 'fish:lake')).toBe(true);
    expect(spots.some((spot) => spot.action === 'fish:sea')).toBe(true);
    expect(spots.every((spot) => !spot.cond?.includes('unlock_beach'))).toBe(true);
    expect(town.gather.some((node) => node.pool.includes('wood'))).toBe(true);
    expect(town.gather.some((node) => node.pool.includes('stone'))).toBe(true);

    game.load(newSave());
    expect(SIDE_META.sq_nami_tuna.avail()).toBe(false);
    expect(SIDE_META.sq_nami_aquarium.avail()).toBe(false);
    expect(questDef('t_fish')?.auto?.()).toBe(false);
    expect(TEMPLATES.find((item) => item.kind === 'fish')?.open()).toBe(false);
    expect(PROJECTS_BY_ID.beach_corner.needs).toBe('unlock_beach');
    expect(PROJECTS_BY_ID.beach_corner.phases.some((phase) => phase.activity?.counter === 'fishCaught')).toBe(true);
    expect(Object.keys(SIDE_META.sq_nami_tuna.deliver ?? {})).toEqual([]);

    game.setFlag('unlock_beach');
    expect(SIDE_META.sq_nami_tuna.avail()).toBe(true);
    expect(SIDE_META.sq_nami_aquarium.avail()).toBe(true);
    expect(questDef('t_fish')?.auto?.()).toBe(true);
    expect(TEMPLATES.find((item) => item.kind === 'fish')?.open()).toBe(true);
  });
});
