/** Brief, cancellable touch interactions; ingredients are charged only when completed. */
import { customerName } from './orders';
import { game } from '../core/state';
import { h, panel, toast } from '../ui/dom';
import { iconElement } from '../art/icons';
import { DRINKS, DRINK_BY_ID, canPrepareDrink, drinksUnlocked } from './drinkData';
import { stagePlate, servingName, tableLabel, plateState } from './service';
import { hostHasIngredients, mirror } from './mirror';
import { runTask } from '../core/errors';
import { audio } from '../audio/audio';
import { registerAction } from '../systems/actions';

const preparing = new Set<number>();
export async function prepareDrink(uid: number): Promise<boolean> {
  // visiting a friend: the drink is made with their ingredients and goes to their tray
  const guest = mirror.on;
  const order = guest ? mirror.snap.cookable.find(o => o.uid === uid && o.kind === 'drink') : game.save.orders.find(o => o.uid === uid && o.kind === 'drink');
  const drink = order && DRINK_BY_ID[order.recipe];
  if (!order || !drink || (!guest && !drinksUnlocked()) || preparing.has(uid) || (!guest && plateState(uid) !== 'cooking')) return false;
  if (guest ? !hostHasIngredients(drink.ingredients) : !canPrepareDrink(drink.id)) { toast('Faltan ingredientes. Podés conseguirlos en el almacén de Taro.'); return false; }
  preparing.add(uid);
  try {
    return await new Promise<boolean>(resolve => {
      let step = 0, done = false;
      const body = h('div', { class: 'col drink-preparation' });
      const finish = (ok: boolean) => { if (done) return; done = true; p.close(); resolve(ok); };
      const render = () => {
        body.replaceChildren(iconElement(drink.icon), h('p', { class: 'hint' }, `Paso ${step + 1} de ${drink.steps.length} · ${drink.name}`),
          h('div', { class: 'drink-vessel', 'aria-label': 'Preparación de la bebida' }, h('div', { class: 'drink-fill', style: { height: `${step / drink.steps.length * 100}%`, background: drink.icon.c1 } })),
          h('button', { class: 'btn primary', onclick: () => {
            if (done) return;
            audio.sfxPlay('tap'); step++;
            if (step < drink.steps.length) { render(); return; }
            if (guest) { mirror.ask?.('drink', { uid }); finish(true); return; }
            const current = game.save.orders.find(o => o.uid === uid);
            if (current !== order || plateState(uid) !== 'cooking' || !canPrepareDrink(drink.id)) { finish(false); toast('El pedido cambió. Los ingredientes siguen en tu mochila.'); return; }
            // Both checks and consumption are synchronous, before any asynchronous presentation.
            if (!game.consumeIngredients(drink.ingredients)) { finish(false); return; }
            if (!stagePlate(uid, 1)) {
              for (const [id, qty] of Object.entries(drink.ingredients)) game.addItem(id, qty, 'refund');
              finish(false); toast('No se pudo dejar la bebida. Te devolví los ingredientes.'); return;
            }
            game.stat('drinksPrepared'); game.stat('drink_' + drink.id); game.touch('drink');
            audio.sfxPlay('pickup'); finish(true); toast(`${drink.name} lista en la bandeja de salida.`);
          } }, drink.steps[step]));
      };
      const p = panel({ title: drink.name, body, onClose: () => { if (!done) { done = true; resolve(false); } } });
      render();
    });
  } finally { preparing.delete(uid); }
}
export function openDrinks() {
  const body = h('div', { class: 'col' });
  if (mirror.on) {
    const pending = mirror.snap.cookable.filter(o => o.kind === 'drink' && DRINK_BY_ID[o.recipe]);
    body.append(h('p', { class: 'hint' }, 'Estás de visita: las bebidas salen de los ingredientes de tu amigo.'));
    for (const o of pending) body.append(h('div', { class: 'card col' }, h('b', null, DRINK_BY_ID[o.recipe].name), h('p', { class: 'hint' }, `${tableLabel(o.service?.tableId)} · ${customerName(o.customer)}`),
      h('button', { class: 'btn primary', onclick: () => { p.close(); void runTask('drink:prepare', () => prepareDrink(o.uid)); } }, 'Preparar')));
    if (!pending.length) body.append(h('p', null, 'No hay bebidas pendientes.'));
    const p = panel({ title: 'Estación de bebidas', body });
    return;
  }
  if (!drinksUnlocked()) body.append(h('p', null, 'Spicy habilita las bebidas al llegar al nivel 2. Primero volvamos a poner en marcha la cocina.'));
  else {
    body.append(h('p', { class: 'hint' }, 'Preparaciones cortitas. Recogé las bebidas terminadas en la bandeja y llevalas a su mesa.'));
    const pending = game.save.orders.filter(o => o.kind === 'drink' && plateState(o.uid) === 'cooking');
    for (const o of pending) body.append(h('div', { class: 'card col' }, h('b', null, servingName(o)), h('p', { class: 'hint' }, `${tableLabel(o.service?.tableId)} · ${customerName(o.customer)}`),
      h('button', { class: 'btn primary', onclick: () => { p.close(); void runTask('drink:prepare', () => prepareDrink(o.uid)); } }, 'Preparar')));
    if (!pending.length) body.append(h('p', null, 'No hay bebidas pendientes. Los clientes pueden pedirlas junto con su sushi.'));
    body.append(h('p', { class: 'hint' }, DRINKS.map(d => d.name).join(' · ')));
  }
  const p = panel({ title: 'Estación de bebidas', body });
}
registerAction('drinks', openDrinks);
