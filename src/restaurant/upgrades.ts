import { bus } from '../core/events';
import { game } from '../core/state';
import { payRenovation } from './progression';
import { cornerForUpgrade, installCorner, planCorner } from './corners';
import { FURN_BY_ID, furnSize } from '../data/furniture';
import { ensureDefaultDecor, placementKeepsPaths } from '../world/zoneRuntime';

export interface UpgradeDef { id: string; name: string; desc: string; price: number; level: number; items?: Record<string, number>; friendship?: { id: string; points: number }; needs?: string; }

/** Every upgrade changes something visible or tangible in the restaurant. */
export const UPGRADES: UpgradeDef[] = [
  { id: 'tables2', name: 'Más mesas', desc: '+1 grupo simultáneo. Una mesa y silla para el salón; si el lugar está ocupado, quedan en el depósito.', price: 300, level: 2, items: { wood: 2 } },
  { id: 'knife', name: 'Cuchillo de Spicy', desc: 'Un corte menos al rebanar ingredientes.', price: 350, level: 2, items: { stone: 1 } },
  { id: 'bamboo', name: 'Esterilla de bambú premium', desc: 'Enrollar requiere menos gestos.', price: 550, level: 3, items: { wood: 2 } },
  { id: 'lights', name: 'Iluminación cálida', desc: 'Faroles en el salón. +encanto (mejores propinas).', price: 500, level: 3, items: { wood: 1, stone: 1 } },
  { id: 'display', name: 'Vitrina de sushi', desc: 'Una vitrina en el salón. +encanto.', price: 800, level: 4, items: { wood: 3 } },
  { id: 'pantry', name: 'Despensa ampliada', desc: 'Rigg te deja ingredientes básicos cada mañana.', price: 700, level: 4, items: { wood: 3 } },
  { id: 'board2', name: 'Segunda tabla de cortar', desc: 'Una tabla más en la cocina: dos ingredientes cortándose a la vez.', price: 420, level: 3, items: { wood: 2 } },
  { id: 'rice_big', name: 'Arrocera grande', desc: 'La arrocera cocina 6 porciones por tanda en vez de 4.', price: 600, level: 4, items: { wood: 2, stone: 1 } },
  { id: 'galley_hands', name: 'Delantal con bolsillos', desc: 'Llevás dos cosas a la vez en la cocina.', price: 380, level: 3, items: { wood: 1 } },
  { id: 'rice_hand', name: 'Ayudante arrocero', desc: 'Un ayudante trabaja en la cocina: saca arroz de la heladera, lo cocina y lo deja listo en el hangiri.', price: 900, level: 5, items: { wood: 2 }, needs: 'rice_big' },
  { id: 'second_room', name: 'Segundo sector', desc: '+1 grupo simultáneo y muebles para el salón.', price: 1200, level: 5, items: { wood: 4, stone: 2 } },
  { id: 'garden_patio', name: 'Jardín exterior', desc: 'Macetas y faroles en la entrada del restaurante.', price: 900, level: 5, items: { wood: 3, stone: 2 } },
  { id: 'carry_tray', name: 'Bandeja de servicio', desc: 'Llevá dos pedidos a la vez, incluso de mesas diferentes.', price: 180, level: 2, items: { wood: 2 } },
  { id: 'carry_tray2', name: 'Bandeja grande', desc: 'Llevá tres pedidos a la vez.', price: 420, level: 4, items: { wood: 3 }, needs: 'carry_tray' },
  { id: 'carry_tray3', name: 'Carrito de servicio', desc: 'Llevá cuatro pedidos a la vez.', price: 780, level: 6, items: { wood: 4, stone: 1 }, needs: 'carry_tray2' },
  { id: 'pip_corner', name: 'Rincón de tesoros de Pip', desc: 'Zabuton y baúl en su cuarto. Pip juega allí durante su descanso.', price: 140, level: 2, items: { wood: 2 }, friendship: { id: 'pip', points: 20 } },
  { id: 'spicy_corner', name: 'Rincón de sabores de Spicy', desc: 'Mesa y hierbas en su cuarto. Spicy se toma una pausa para merendar.', price: 160, level: 2, items: { wood: 2 }, friendship: { id: 'spicy', points: 20 } },
  { id: 'rigg_corner', name: 'Rincón de lectura de Rigg', desc: 'Escritorio y zabuton en su cuarto. Rigg lo usa para leer.', price: 160, level: 2, items: { wood: 2 }, friendship: { id: 'rigg', points: 20 } },
  { id: 'pip_corner2', name: 'Tesoros compartidos', desc: 'Un juguete y un portarretrato para Pip. Fotografías y juegos juntos desde su rincón.', price: 180, level: 4, items: { wood: 2 }, needs: 'pip_corner', friendship: { id: 'pip', points: 100 } },
  { id: 'spicy_corner2', name: 'Mesa de ideas de Spicy', desc: 'Juego de té y cuadro de sushi. Un rincón para compartir comida y consultar recetas.', price: 200, level: 4, items: { wood: 2, stone: 1 }, needs: 'spicy_corner', friendship: { id: 'spicy', points: 100 } },
  { id: 'rigg_corner2', name: 'Lecturas compartidas', desc: 'Portarretrato y constelación. Álbum de recuerdos y juegos de memoria desde su rincón.', price: 200, level: 4, items: { wood: 2 }, needs: 'rigg_corner', friendship: { id: 'rigg', points: 100 } },
];

const VISUAL: Record<string, [string, number, number, number?][]> = {
  tables2: [['table_round', 10, 11], ['chair_wood', 11, 11, 3]],
  lights: [['lantern_red', 11, 6], ['lantern_red', 15, 6]],
  display: [['display_case', 10, 6]],
  second_room: [['table_low', 7, 10], ['cushion_rose', 7, 11], ['cushion_indigo', 8, 11]],
};

const purchasing = new Set<string>();
export function upgradeMissing(u: UpgradeDef): string[] {
  const missing: string[] = [];
  if (game.save.restaurant.level < u.level) missing.push(`Nivel ${u.level}`);
  if (u.needs && !game.save.restaurant.upgrades.includes(u.needs)) missing.push('Primero construí el rincón');
  if (u.friendship && (game.save.relationships[u.friendship.id]?.points ?? 0) < u.friendship.points) missing.push(`Amistad: ${game.save.relationships[u.friendship.id]?.points ?? 0}/${u.friendship.points}`);
  if (game.coins < u.price) missing.push('Monedas');
  for (const [id, q] of Object.entries(u.items ?? {})) if (game.count(id) < q) missing.push(`${id === 'wood' ? 'Madera' : 'Piedra'}: ${game.count(id)}/${q}`);
  return missing;
}
export function buyUpgrade(id: string): boolean {
  const u = UPGRADES.find((x) => x.id === id);
  if (!u || purchasing.size || game.save.restaurant.upgrades.includes(id) || upgradeMissing(u).length) return false;
  purchasing.add(id);
  try {
    ensureDefaultDecor();
    const corner = planCorner(id);
    if (!corner) return false;
    const room = game.room('dining'), original = [...room];
    const visual: { id: string; x: number; y: number; rot: number; placed: boolean }[] = [];
    try {
      for (const [fid, x, y, rot] of VISUAL[id] ?? []) {
        const fd = FURN_BY_ID[fid];
        const box = furnSize(fd, rot ?? 0);
        const overlaps = (px: number, py: number) => px >= x && px < x + box.w && py >= y && py < y + box.h;
        const blocked = room.some(f => { const d = FURN_BY_ID[f.id]; if (!d) return false; const s = furnSize(d, f.rot); return x < f.x + s.w && x + box.w > f.x && y < f.y + s.h && y + box.h > f.y; }) ||
          y + box.h > 10 && x <= 9 && x + box.w > 8 ||
          game.save.player.zone === 'restaurant' && overlaps(game.save.player.x, game.save.player.y) ||
          !!game.save.dining?.floor.tables.some(t => t.partyId && t.seats.some(s => overlaps(s.x, s.y)));
        const placed = !blocked && placementKeepsPaths('restaurant', 'dining', { uid: -1, id: fid, x, y, rot: rot ?? 0 });
        visual.push({ id: fid, x, y, rot: rot ?? 0, placed });
        if (placed) room.push({ uid: -1 - visual.length, id: fid, x, y, rot: rot ?? 0 });
      }
    } finally { room.splice(0, room.length, ...original); }
    if (!payRenovation(u.price, u.items ?? {}, () => {
      game.save.restaurant.upgrades.push(id);
      installCorner(id, corner);
      for (const f of visual) {
        if (f.placed) room.push({ uid: game.uid(), id: f.id, x: f.x, y: f.y, rot: f.rot });
        else game.save.furnitureOwned[f.id] = (game.save.furnitureOwned[f.id] ?? 0) + 1;
      }
      if (id === 'garden_patio') game.save.flags.patio = true;
    })) return false;
    game.touch('upgrade');
    bus.emit('decor:changed', { room: cornerForUpgrade(id) ? 'room_' + cornerForUpgrade(id)!.id : 'dining' });
    return true;
  } finally { purchasing.delete(id); }
}
