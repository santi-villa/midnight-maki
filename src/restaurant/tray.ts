import { game } from '../core/state';
import { panel, h, toast } from '../ui/dom';
import { iconElement } from '../art/icons';
import { RECIPES_BY_ID } from '../data/recipes';
import { DRINK_BY_ID } from './drinkData';
import { carriedOrders, pickupPlate, returnPlate, servingName, tableLabel, trayOrders } from './service';
import { carryCapacity } from './carry';
import { customerName } from './orders';
import { registerAction } from '../systems/actions';

export function openTray() {
  const body = h('div', { class: 'col' });
  const carried = carriedOrders(), capacity = carryCapacity(game.save);
  for (const order of carried) body.append(h('div', { class: 'card col' }, h('b', null, `Llevás ${servingName(order)}`), h('p', { class: 'hint' }, `${customerName(order.customer)} · ${tableLabel(order.service?.tableId)}`),
    h('button', { class: 'btn', onclick: () => { toast(returnPlate(order.uid)); p.close(); } }, 'Dejar en la bandeja')));
  for (const order of trayOrders()) {
    const def = order.kind === 'drink' ? DRINK_BY_ID[order.recipe] : RECIPES_BY_ID[order.recipe];
    body.append(h('div', { class: 'card col' }, h('div', { class: 'row' }, def && iconElement(def.icon), h('b', null, servingName(order))),
      h('p', { class: 'hint' }, `${customerName(order.customer)} · ${tableLabel(order.service?.tableId)} · ${['Aceptable', 'Muy bueno', 'Perfecto'][order.plate!.quality]}`),
      h('button', { class: 'btn primary', disabled: carried.length >= capacity, onclick: () => { toast(pickupPlate(order.uid)); p.close(); } }, 'Recoger')));
  }
  if (!trayOrders().length && !carried.length) body.append(h('p', null, 'La bandeja está vacía. Los pedidos terminados esperan acá, sin volver a gastar ingredientes.'));
  body.append(h('p', { class: 'hint' }, `Transporte: ${carried.length}/${capacity}. Los marcadores señalan las mesas correspondientes.${capacity === 1 ? ' La mejora Bandeja de servicio permite llevar dos.' : ''}`));
  const p = panel({ title: 'Bandeja de salida', body });
}
registerAction('tray', openTray);
// Imported by the kitchen, so the saved dish list remains a single source of truth.
export const hasTrayOrders = () => game.save.orders.some(o => !!o.plate);
