/** "Pedido a domicilio" card of the pantry: order from Taro's store and wait for the helper instead of walking there. */
import { iconElement } from '../art/icons';
import { audio } from '../audio/audio';
import { game } from '../core/state';
import { ITEMS_BY_ID } from '../data/items';
import { DELIVERY_FEE, DELIVERY_MINUTES, deliverable, minutesLeft, orderCost, pendingOrder, placeOrder, suggestedOrder } from '../restaurant/delivery';
import { shopGate } from '../systems/npcs';
import { h, toast } from './dom';

/** Quantities picked by hand stay while the pantry is open. */
const picked: Record<string, number> = {};

export function deliveryCard(rerender: () => void): HTMLElement {
  const card = h('div', { class: 'card col', style: { gap: '6px' } });
  const pending = pendingOrder();
  if (pending) {
    const list = Object.entries(pending.items).map(([id, q]) => `${ITEMS_BY_ID[id]?.name ?? id} ×${q}`).join(' · ');
    const left = minutesLeft();
    card.append(
      h('b', null, 'Pedido en camino'),
      h('div', { class: 'hint' }, left > 0 ? `El ayudante de Taro llega en unos ${left} minutos.` : 'Está por llegar.'),
      h('div', null, list),
    );
    return card;
  }
  const gate = shopGate('taro');
  const quick = suggestedOrder();
  const quickCost = orderCost(quick);
  const send = (items: Record<string, number>) => {
    const why = placeOrder(items);
    if (why) { toast(why); return; }
    audio.sfxPlay('coin');
    for (const id of Object.keys(picked)) delete picked[id];
    toast(`Pedido hecho. Llega en unos ${DELIVERY_MINUTES} minutos a la despensa.`);
    rerender();
  };
  card.append(
    h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', null, 'Pedido a domicilio'), h('span', { class: 'hint' }, gate.open ? 'Almacén de Taro abierto' : `Cerrado · ${gate.hours}`)),
    h('div', { class: 'hint' }, `Te lo traen a la despensa sin ir hasta la plaza. Envío: ${DELIVERY_FEE} monedas.`),
    h('button', { class: 'btn small primary', disabled: !gate.open || !quickCost, onclick: () => send(quick) },
      quickCost ? `Pedir lo que falta (${Object.values(quick).reduce((a, b) => a + b, 0)} u. · ${quickCost} monedas)` : 'No falta nada para tus recetas'),
  );
  // picking by hand: + and − per ingredient
  const more = h('details', null, h('summary', null, 'Elegir a mano'));
  const grid = h('div', { class: 'grid' });
  const total = h('div', { class: 'row', style: { justifyContent: 'space-between', marginTop: '6px' } });
  const paint = () => {
    const cost = orderCost(picked);
    total.innerHTML = '';
    total.append(h('span', { class: 'hint' }, cost ? `Total: ${cost} monedas (tenés ${game.coins})` : 'Elegí cantidades'),
      h('button', { class: 'btn small', disabled: !gate.open || !cost, onclick: () => send({ ...picked }) }, 'Pedir'));
  };
  for (const id of deliverable()) {
    const it = ITEMS_BY_ID[id];
    const qty = h('span', { class: 'qty' }, String(picked[id] ?? 0));
    const step = (d: number) => { picked[id] = Math.max(0, Math.min(20, (picked[id] ?? 0) + d)); qty.textContent = String(picked[id]); paint(); };
    grid.append(h('div', { class: 'slot' }, iconElement(it.icon), h('span', null, it.name), h('span', { class: 'hint' }, `${it.buy} c/u`),
      h('div', { class: 'row', style: { gap: '4px' } }, h('button', { class: 'btn small', onclick: () => step(-1) }, '−'), h('button', { class: 'btn small', onclick: () => step(1) }, '+')), qty));
  }
  more.append(grid, total);
  paint();
  card.append(more);
  return card;
}
