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
  { id: 'knife', name: 'Cuchillo de Spicy', desc: 'Un golpe menos al cortar (5 → 4; 4 → 3 en modo relajado) y la zona verde un poco más ancha.', price: 350, level: 2, items: { stone: 1 } },
  { id: 'knife2', name: 'Cuchillo afilado', desc: 'Otro golpe menos (3 en total; 2 en modo relajado) y la zona verde algo más ancha todavía. Cuesta más que el primero y lo pide como requisito.', price: 1400, level: 4, items: { stone: 3 }, needs: 'knife' },
  { id: 'bamboo', name: 'Esterilla de bambú premium', desc: 'Armar un plato en la mesa de armado tarda 30 % menos. Solo cambia la espera del armado; el resto de la cocina queda igual.', price: 550, level: 3, items: { wood: 2 } },
  { id: 'lights', name: 'Iluminación cálida', desc: 'Faroles en el salón. +encanto (mejores propinas).', price: 500, level: 3, items: { wood: 1, stone: 1 } },
  { id: 'display', name: 'Vitrina de sushi', desc: 'Una vitrina en el salón. +encanto.', price: 800, level: 4, items: { wood: 3 } },
  { id: 'pantry', name: 'Despensa ampliada', desc: 'Rigg te deja ingredientes básicos cada mañana.', price: 700, level: 4, items: { wood: 3 } },
  { id: 'board2', name: 'Segunda tabla de cortar', desc: 'Una tabla más en la cocina (se ve en el mapa): dos ingredientes a la vez. Si Spicy tiene «cortador», también la usa, así que cortan juntos.', price: 1200, level: 3, items: { wood: 3, stone: 1 } },
  { id: 'rice_big', name: 'Arrocera grande', desc: 'Una arrocera más grande y dorada (se ve en el mapa): 6 porciones por tanda en vez de 4.', price: 1500, level: 4, items: { wood: 3, stone: 2 } },
  { id: 'galley_hands', name: 'Delantal con bolsillos', desc: 'En la cocina llevás dos cosas a la vez entre estaciones (ingredientes o un plato). No cambia cuántos platos llevás a las mesas: eso es la bandeja.', price: 900, level: 3, items: { wood: 2 } },
  { id: 'rice_hand', name: 'Spicy: arrocero', desc: 'Spicy trabaja en la cocina durante el servicio: saca arroz de la heladera, lo cocina y mantiene 4 porciones listas en el hangiri. Hace falta que Spicy esté en el equipo.', price: 2500, level: 5, items: { wood: 3, stone: 2 }, needs: 'rice_big' },
  { id: 'service_bell', name: 'Timbre de servicio', desc: 'Tocás el timbre del mostrador de entrega y Rigg (o un mesero) lleva los platos listos a sus mesas. Sin el timbre, el personal no retira platos de la cocina.', price: 1000, level: 3, items: { wood: 2 } },
  { id: 'cut_hand', name: 'Spicy: cortador', desc: 'Spicy también corta en la tabla lo que piden los tickets y lo deja en las mesadas de apoyo (unos cuatro segundos y medio por pieza). Necesita su mejora de arrocero.', price: 3200, level: 6, items: { wood: 4, stone: 3 }, needs: 'rice_hand' },
  { id: 'second_room', name: 'Segundo sector', desc: '+1 grupo simultáneo y muebles para el salón.', price: 1200, level: 5, items: { wood: 4, stone: 2 } },
  { id: 'garden_patio', name: 'Jardín exterior', desc: 'Macetas y faroles en la entrada del restaurante.', price: 900, level: 5, items: { wood: 3, stone: 2 } },
  { id: 'carry_tray', name: 'Bandeja de servicio', desc: 'Del mostrador a las mesas: llevás dos pedidos a la vez, incluso de mesas diferentes.', price: 180, level: 2, items: { wood: 2 } },
  { id: 'carry_tray2', name: 'Bandeja grande', desc: 'Del mostrador a las mesas: llevás tres pedidos a la vez.', price: 420, level: 4, items: { wood: 3 }, needs: 'carry_tray' },
  { id: 'carry_tray3', name: 'Carrito de servicio', desc: 'Del mostrador a las mesas: llevás cuatro pedidos a la vez.', price: 780, level: 6, items: { wood: 4, stone: 1 }, needs: 'carry_tray2' },
  { id: 'pip_corner', name: 'Rincón de tesoros de Pip', desc: 'Zabuton y baúl en su cuarto. Pip juega allí durante su descanso.', price: 140, level: 2, items: { wood: 2 }, friendship: { id: 'pip', points: 20 } },
  { id: 'spicy_corner', name: 'Rincón de sabores de Spicy', desc: 'Mesa y hierbas en su cuarto. Spicy se toma una pausa para merendar.', price: 160, level: 2, items: { wood: 2 }, friendship: { id: 'spicy', points: 20 } },
  { id: 'rigg_corner', name: 'Rincón de lectura de Rigg', desc: 'Escritorio y zabuton en su cuarto. Rigg lo usa para leer.', price: 160, level: 2, items: { wood: 2 }, friendship: { id: 'rigg', points: 20 } },
  { id: 'pip_corner2', name: 'Tesoros compartidos', desc: 'Un juguete y un portarretrato para Pip. Fotografías y juegos juntos desde su rincón.', price: 180, level: 4, items: { wood: 2 }, needs: 'pip_corner', friendship: { id: 'pip', points: 100 } },
  { id: 'spicy_corner2', name: 'Mesa de ideas de Spicy', desc: 'Juego de té y cuadro de sushi. Un rincón para compartir comida y consultar recetas.', price: 200, level: 4, items: { wood: 2, stone: 1 }, needs: 'spicy_corner', friendship: { id: 'spicy', points: 100 } },
  { id: 'rigg_corner2', name: 'Lecturas compartidas', desc: 'Portarretrato y constelación. Álbum de recuerdos y juegos de memoria desde su rincón.', price: 200, level: 4, items: { wood: 2 }, needs: 'rigg_corner', friendship: { id: 'rigg', points: 100 } },
];

const VISUAL: Record<string, [string, number, number, number?][]> = {
  // off the door's aisle, the kitchen gates and the table grid (restaurant/stages.ts)
  tables2: [['table_round', 6, 7], ['chair_wood', 7, 7, 3]],
  lights: [['lantern_red', 22, 6], ['lantern_red', 22, 9]],
  display: [['display_case', 21, 9]],
  second_room: [['table_low', 20, 11], ['cushion_rose', 20, 10], ['cushion_indigo', 21, 10]],
};

const purchasing = new Set<string>();

/** What the last purchase did, for the celebration: furniture that went into the room and furniture kept in storage for lack of space. */
export interface PurchaseReport { id: string; placed: string[]; stored: string[] }
let lastReport: PurchaseReport | null = null;
export const lastPurchase = (): PurchaseReport | null => lastReport;
export function upgradeMissing(u: UpgradeDef): string[] {
  const missing: string[] = [];
  if (game.save.restaurant.level < u.level) missing.push(`Nivel ${u.level}`);
  if (u.needs && !game.save.restaurant.upgrades.includes(u.needs)) missing.push(`Primero: ${UPGRADES.find((x) => x.id === u.needs)?.name ?? 'la mejora anterior'}`);
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
      lastReport = { id, placed: visual.filter((f) => f.placed).map((f) => f.id), stored: visual.filter((f) => !f.placed).map((f) => f.id) };
    })) return false;
    game.touch('upgrade');
    bus.emit('decor:changed', { room: cornerForUpgrade(id) ? 'room_' + cornerForUpgrade(id)!.id : 'dining' });
    return true;
  } finally { purchasing.delete(id); }
}
