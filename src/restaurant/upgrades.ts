import { bus } from '../core/events';
import { game } from '../core/state';

export interface UpgradeDef { id: string; name: string; desc: string; price: number; level: number; }

/** Every upgrade changes something visible or tangible in the restaurant. */
export const UPGRADES: UpgradeDef[] = [
  { id: 'tables2', name: 'Más mesas', desc: '+1 pedido simultáneo. Aparece una mesa nueva en el salón.', price: 500, level: 2 },
  { id: 'knife', name: 'Cuchillo de Spicy', desc: 'Un corte menos al rebanar ingredientes.', price: 600, level: 2 },
  { id: 'bamboo', name: 'Esterilla de bambú premium', desc: 'Enrollar requiere menos gestos.', price: 550, level: 3 },
  { id: 'lights', name: 'Iluminación cálida', desc: 'Faroles en el salón. +encanto (mejores propinas).', price: 500, level: 3 },
  { id: 'display', name: 'Vitrina de sushi', desc: 'Una vitrina en el salón. +encanto.', price: 800, level: 4 },
  { id: 'pantry', name: 'Despensa ampliada', desc: 'Rigg te deja ingredientes básicos cada mañana.', price: 700, level: 4 },
  { id: 'second_room', name: 'Segundo sector', desc: '+1 pedido simultáneo y más espacio para decorar.', price: 1200, level: 5 },
  { id: 'garden_patio', name: 'Jardín exterior', desc: 'Macetas y faroles en la entrada del restaurante.', price: 900, level: 5 },
];

const VISUAL: Record<string, [string, number, number, number?][]> = {
  tables2: [['table_round', 10, 11], ['chair_wood', 11, 11, 3]],
  lights: [['lantern_red', 11, 6], ['lantern_red', 15, 6]],
  display: [['display_case', 10, 6]],
  second_room: [['table_low', 7, 10], ['cushion_rose', 7, 11], ['cushion_indigo', 8, 11]],
};

export function buyUpgrade(id: string): boolean {
  const u = UPGRADES.find((x) => x.id === id);
  if (!u || game.save.restaurant.upgrades.includes(id) || game.save.restaurant.level < u.level) return false;
  if (!game.spend(u.price, 'upgrade')) return false;
  game.save.restaurant.upgrades.push(id);
  // physical change: furniture added to the dining room (player can move it later)
  for (const [fid, x, y, rot] of VISUAL[id] ?? []) {
    const room = game.room('dining');
    if (room.some((f) => f.x === x && f.y === y)) game.save.furnitureOwned[fid] = (game.save.furnitureOwned[fid] ?? 0) + 1;
    else room.push({ uid: game.uid(), id: fid, x, y, rot: rot ?? 0 });
  }
  if (id === 'garden_patio') game.setFlag('patio');
  game.touch('upgrade');
  bus.emit('decor:changed', { room: 'dining' });
  return true;
}
