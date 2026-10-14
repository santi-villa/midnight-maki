/**
 * The kitchen as one place with several stations (Papa's-Pizza style): she can take many orders,
 * start any of them, and jump between the dishes that are in progress. Each dish is its own
 * CookingGame board embedded here; the hidden ones freeze until she comes back.
 */
import { audio } from '../audio/audio';
import type { Track } from '../audio/audio';
import { iconElement } from '../art/icons';
import { bus } from '../core/events';
import { h, openModal, toast } from '../ui/dom';
import type { RecipeDef } from '../data/recipes';
import { CookingGame, type CookResult } from './cooking';
import { Grill } from './grillView';

export const MAX_DISHES = 4;

export interface SessionOrder {
  uid: number;
  recipe: RecipeDef;
  who: string;
  reward: number;
  /** ingredients available right now */
  ready: boolean;
  note?: string;
}

export interface KitchenHooks {
  /** every food order that can be cooked or is waiting */
  orders(): SessionOrder[];
  /** claim the order and consume its ingredients; false when it cannot be started */
  take(uid: number): boolean;
  /** the dish is finished: hand it over right away; the returned presenter runs after the kitchen closes */
  done(uid: number, res: CookResult): (() => Promise<void>) | null;
  /** the dish was thrown away or the kitchen was left: give the ingredients back */
  cancel(uid: number): void;
}

type View = 'orders' | 'table' | 'grill';
interface Dish { uid: number; game: CookingGame; order: SessionOrder; }

let open = false;
export const kitchenOpen = () => open;

/** Opens the kitchen. Resolves after it closes and the presentations of the finished dishes ran. */
export function openKitchenSession(hooks: KitchenHooks, firstUid?: number): Promise<void> {
  if (open) return Promise.resolve();
  open = true;
  return new Promise((resolve) => {
    const dishes: Dish[] = [];
    const presenters: (() => Promise<void>)[] = [];
    let view: View = 'orders';
    let active: Dish | null = null;
    let leaving = false;

    const tabs = h('div', { class: 'ks-tabs', role: 'tablist' });
    const chips = h('div', { class: 'ks-chips' });
    const exit = h('button', { class: 'close-x', 'aria-label': 'Salir de la cocina', onclick: () => tryLeave() }, '✕');
    const ordersEl = h('div', { class: 'ks-orders' });
    const tableEl = h('div', { class: 'ks-table' });
    const grill = new Grill(() => dishes.map((d) => ({ game: d.game, who: d.order.who })), () => renderTabs());
    const body = h('div', { class: 'ks-body' }, ordersEl, tableEl, grill.el);
    const root = h('div', { class: 'ks' }, h('div', { class: 'ks-top' }, tabs, exit), chips, body);

    const musicBefore: Track = audio.currentTrack();
    audio.crossfade('kitchen');
    const closeModal = openModal(root);
    (root as any).__close = () => tryLeave();

    const finish = () => {
      if (leaving) return;
      leaving = true;
      off();
      clearInterval(tick);
      clearInterval(ticker);
      for (const d of dishes.splice(0)) {
        d.game.discard();
        hooks.cancel(d.uid);
      }
      audio.crossfade(musicBefore);
      closeModal();
      open = false;
      void (async () => {
        for (const p of presenters) { try { await p(); } catch (e) { console.error(e); } }
        resolve();
      })();
    };

    // the first tap warns about unfinished dishes, a second one within 3.5 s leaves
    let leaveWarn = false;
    function tryLeave() {
      if (!dishes.length || leaveWarn) return finish();
      leaveWarn = true;
      toast(`Tenés ${dishes.length} plato${dishes.length > 1 ? 's' : ''} sin terminar. Tocá otra vez para salir: se guardan los ingredientes.`);
      setTimeout(() => { leaveWarn = false; }, 3500);
    }

    const take = (o: SessionOrder) => {
      if (dishes.length >= MAX_DISHES) { toast(`Hasta ${MAX_DISHES} platos a la vez. Terminá uno primero.`); return; }
      if (dishes.some((d) => d.uid === o.uid)) return;
      if (!hooks.take(o.uid)) { toast('No se pudo empezar ese pedido.'); render(); return; }
      const dish: Dish = { uid: o.uid, order: o, game: null as unknown as CookingGame };
      dish.game = new CookingGame(o.recipe, o.who, (res) => onDone(dish, res), { el: tableEl, onBack: () => show('orders'), goGrill: () => show('grill'), status: (g, item) => grill.status(g, item) });
      dishes.push(dish);
      dish.game.start();
      dish.game.setActive(false);
      grill.render();
      select(dish);
    };

    function onDone(d: Dish, res: CookResult) {
      const i = dishes.indexOf(d);
      if (i < 0) return;
      dishes.splice(i, 1);
      grill.dropDish(d.game);
      if (!res.ok) hooks.cancel(d.uid);
      else {
        const p = hooks.done(d.uid, res);
        if (p) presenters.push(p);
        toast(`${d.order.recipe.name} para ${d.order.who} está listo.`);
      }
      if (active === d) {
        active = null;
        if (dishes.length) select(dishes[0]);
        else show('orders');
      } else render();
    }

    function select(d: Dish) {
      active = d;
      show('table');
    }

    function show(v: View) {
      view = v;
      for (const d of dishes) d.game.setActive(v === 'table' && d === active);
      if (v === 'grill') grill.render();
      render();
    }

    function discard(d: Dish) {
      d.game.discard();
      grill.dropDish(d.game);
      dishes.splice(dishes.indexOf(d), 1);
      hooks.cancel(d.uid);
      toast('Guardaste los ingredientes para después.');
      if (active === d) {
        active = null;
        if (dishes.length) select(dishes[0]);
        else show('orders');
      } else render();
    }

    function render() {
      ordersEl.style.display = view === 'orders' ? '' : 'none';
      tableEl.style.display = view === 'table' ? '' : 'none';
      grill.el.style.display = view === 'grill' ? '' : 'none';
      renderTabs();
      renderChips();
      if (view === 'orders') renderOrders();
    }

    function renderTabs() {
      tabs.innerHTML = '';
      const tab = (id: View, label: string, badge = '') =>
        tabs.append(h('button', { class: 'ks-tab' + (view === id ? ' on' : ''), role: 'tab', 'aria-selected': view === id ? 'true' : 'false', onclick: () => (id === 'table' && !active ? (dishes.length ? select(dishes[0]) : toast('Empezá un pedido primero.')) : show(id)) }, label, badge && view !== id ? h('span', { class: 'ks-badge' }, badge) : null));
      tab('orders', 'Pedidos');
      tab('table', 'Mesa');
      tab('grill', 'Plancha', grill.badge());
    }

    function renderChips() {
      chips.innerHTML = '';
      for (const d of dishes) {
        const on = view === 'table' && d === active;
        chips.append(
          h('div', { class: 'ks-chip' + (on ? ' on' : '') },
            h('button', { class: 'ks-chip-main', onclick: () => select(d), 'aria-label': `${d.order.recipe.name} para ${d.order.who}` },
              iconElement(d.order.recipe.icon),
              h('span', { class: 'ks-chip-t' }, h('b', null, d.order.recipe.name), h('small', null, `${d.order.who} · ${d.game.stepName}`)),
              h('i', { class: 'ks-chip-bar' }, h('u', { style: { width: `${Math.round(d.game.progress * 100)}%` } }))),
            h('button', { class: 'ks-chip-x', title: 'Descartar este plato', 'aria-label': 'Descartar este plato', onclick: () => discard(d) }, '🗑')),
        );
      }
    }

    function renderOrders() {
      ordersEl.innerHTML = '';
      const list = hooks.orders();
      ordersEl.append(h('p', { class: 'hint' }, `Elegí qué preparar y en qué orden. Podés tener hasta ${MAX_DISHES} platos a la vez y saltar de uno a otro desde las etiquetas de arriba.`));
      if (!list.length) ordersEl.append(h('p', { class: 'muted' }, 'No hay pedidos de comida en el mostrador. Cuando se siente un cliente, tomá su pedido en la mesa.'));
      for (const o of list) {
        const d = dishes.find((x) => x.uid === o.uid);
        ordersEl.append(
          h('div', { class: 'card ks-order' },
            h('div', { class: 'row' }, iconElement(o.recipe.icon), h('div', null, h('b', null, o.recipe.name), h('div', { class: 'hint' }, `Para ${o.who}${o.note ? ' · ' + o.note : ''}`))),
            h('span', { class: 'coin' }, `${o.reward} ●`),
            d
              ? h('button', { class: 'btn small', onclick: () => select(d) }, 'Seguir')
              : h('button', { class: 'btn small primary', disabled: !o.ready || dishes.length >= MAX_DISHES, title: o.ready ? '' : 'Faltan ingredientes', onclick: () => take(o) }, o.ready ? 'Empezar' : 'Faltan ingredientes')),
        );
      }
    }

    const off = bus.on('state:changed', () => { if (view === 'orders' && !leaving) renderOrders(); });
    // chips show live progress
    const tick = window.setInterval(() => { if (!leaving && dishes.length) renderChips(); }, 600);

    let last = performance.now();
    const ticker = window.setInterval(() => {
      const now = performance.now();
      grill.tick(Math.min(1, (now - last) / 1000), view === 'grill');
      last = now;
    }, 90);

    render();
    const first = firstUid != null ? hooks.orders().find((o) => o.uid === firstUid && o.ready) : undefined;
    if (first) take(first);
  });
}
