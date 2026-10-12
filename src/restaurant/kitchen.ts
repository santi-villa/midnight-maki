/** Restaurant UI: order board, kitchen station, free cooking, experiments, upgrades. */
import { iconCanvas, iconElement } from '../art/icons';
import { ctx2d, makeCanvas } from '../art/pixel';
import { audio } from '../audio/audio';
import { game } from '../core/state';
import { ITEMS_BY_ID } from '../data/items';
import { EXPERIMENTS, RECIPES, RECIPES_BY_ID, type RecipeDef } from '../data/recipes';
import { BALANCE } from '../core/balance';
import { add, h, panel, toast, uiRoot } from '../ui/dom';
import { registerAction } from '../systems/actions';
import { cook } from './cooking';
import { canCook, customerAsk, customerName, GENERIC_CUSTOMERS, learnRecipe, maxOrders, refreshOrders, serveOrder, addRestaurantXp, unlockLevelRecipes, charm } from './orders';
import { UPGRADES, buyUpgrade } from './upgrades';
import { runScene, say } from '../dialogue/dialogue';

const CAT_NAME = { basic: 'Básica', intermediate: 'Intermedia', special: 'Especial' };

function ingList(r: RecipeDef) {
  return h(
    'div',
    { class: 'row', style: { flexWrap: 'wrap', gap: '4px' } },
    ...Object.entries(r.ingredients).map(([id, q]) => {
      const have = game.countUsable(id);
      const ok = have >= q;
      const c = iconElement(ITEMS_BY_ID[id]?.icon ?? { type: 'blob' });
      c.style.cssText = 'width:20px;height:20px;image-rendering:pixelated';
      return h('span', { class: 'pill', title: ITEMS_BY_ID[id]?.name, style: { background: ok ? '#dfe9d6' : '#f2d0cf' } }, c, ` ${have}/${q}`);
    }),
  );
}

/** cost to buy what's missing for a recipe (basic shop ingredients only) */
function missingCost(r: RecipeDef): number | null {
  let cost = 0;
  for (const [id, q] of Object.entries(r.ingredients)) {
    const miss = q - game.countUsable(id);
    if (miss <= 0) continue;
    const it = ITEMS_BY_ID[id];
    if (!it?.buy) return null;
    cost += Math.ceil(it.buy * 1.2) * miss;
  }
  return cost;
}

function buyMissing(r: RecipeDef): boolean {
  const cost = missingCost(r);
  if (cost == null) return false;
  if (!game.spend(cost, 'restock')) return false;
  for (const [id, q] of Object.entries(r.ingredients)) {
    const miss = q - game.countUsable(id);
    if (miss > 0) game.addItem(id, miss, 'restock');
  }
  game.stat('purchases');
  audio.sfxPlay('coin');
  return true;
}

// ------------------------------------------------------------------ order board
export function openOrders() {
  refreshOrders(false);
  const body = h('div', { class: 'col' });
  const render = () => {
    body.innerHTML = '';
    const rs = game.save.restaurant;
    body.append(
      h('div', { class: 'card row', style: { justifyContent: 'space-between', flexWrap: 'wrap' } },
        h('div', null, h('b', null, `Nivel ${rs.level}`), h('div', { class: 'bar', style: { width: '140px', marginTop: '4px' } }, h('i', { style: { width: `${Math.min(100, (rs.xp / BALANCE.restaurantXpPerLevel(rs.level)) * 100)}%` } }))),
        h('div', { class: 'hint' }, `Reputación ${rs.reputation} · Encanto ${charm()} · Servidos ${rs.served}`),
        h('button', { class: 'btn small', onclick: () => openUpgrades() }, 'Mejoras'),
      ),
    );
    if (!game.save.orders.length) body.append(h('p', { class: 'muted' }, 'No hay pedidos por ahora. Volvé más tarde.'));
    for (const o of game.save.orders) {
      const r = RECIPES_BY_ID[o.recipe];
      if (!r) continue;
      const ready = canCook(r.id);
      const cost = ready ? 0 : missingCost(r);
      const special = o.special === 'odd' ? 'Pedido sin remitente' : o.special === 'tutorial' ? 'Pedido de práctica' : '';
      body.append(
        h(
          'div',
          { class: 'card col', style: { gap: '6px', borderColor: o.special ? '#f2c66d' : undefined } },
          h('div', { class: 'row', style: { justifyContent: 'space-between' } },
            h('div', { class: 'row' }, iconElement(r.icon), h('div', null, h('b', null, r.name), h('div', { class: 'hint' }, special || `Para: ${customerName(o.customer)}`))),
            h('span', { class: 'coin' }, `${o.reward} ●`)),
          !special && customerAsk(o.customer, o.uid) ? h('div', { class: 'order-ask' }, `“${customerAsk(o.customer, o.uid)}”`) : null,
          ingList(r),
          h('div', { class: 'row', style: { justifyContent: 'flex-end', flexWrap: 'wrap' } },
            !ready && cost != null ? h('button', { class: 'btn small', onclick: () => { if (buyMissing(r)) render(); else toast('No te alcanzan las monedas.'); } }, `Comprar lo que falta (${cost} ●)`) : null,
            !ready && cost == null ? h('span', { class: 'hint' }, 'Faltan ingredientes que no se compran acá.') : null,
            h('button', { class: 'btn small primary', disabled: !ready, onclick: () => { p.close(); startOrder(o.uid); } }, 'Cocinar'),
          ),
        ),
      );
    }
    body.append(h('p', { class: 'hint' }, `Hasta ${maxOrders()} pedidos a la vez. Los pedidos se renuevan cada día y por la tarde.`));
  };
  render();
  const p = panel({ title: 'Pedidos', body });
}

async function startOrder(uid: number) {
  const o = game.save.orders.find((x) => x.uid === uid);
  if (!o) return;
  const r = RECIPES_BY_ID[o.recipe];
  if (!game.consumeIngredients(r.ingredients)) {
    toast('Faltan ingredientes.');
    return;
  }
  const res = await cook(r.id, customerName(o.customer));
  if (!res.ok) {
    // cancelled: give the ingredients back (no punishment)
    for (const [id, q] of Object.entries(r.ingredients)) game.addItem(id, q, 'refund');
    toast('Guardaste los ingredientes para después.');
    return;
  }
  const special = o.special;
  const out = serveOrder(uid, res.quality, res.variantBonus);
  if (!out) return;
  audio.sfxPlay('coin');
  await showServeResult(r, out, res.quality, customerName(o.customer), o.customer, res.variant);
  if (special === 'odd') {
    const { oddOrderServed } = await import('../story/story');
    await oddOrderServed();
  }
}

async function showServeResult(r: RecipeDef, out: NonNullable<ReturnType<typeof serveOrder>>, quality: number, who: string, customer: string, variant?: string) {
  const generic = GENERIC_CUSTOMERS.find((c) => c.id === customer);
  await showPlate(r, quality);
  await runScene('serve', async () => {
    if (out.firstTime) {
      audio.sfxPlay('sparkle');
      await say('narr', `¡Primera vez que preparás ${r.name}! Quedó anotado en tus colecciones.`);
    }
    if (generic) await say('?' + generic.name, generic.react?.[quality] ?? generic.line);
    else if (customer !== 'c_odd') await say(customer, ['Mmm... está rico. Gracias.', '¡Qué rico! Muy bien hecho.', '¡Perfecto! Volvería todos los días.'][quality], quality === 2 ? 'happy' : 'neutral');
    await say('narr', `${who === 'Cliente' ? '' : who + ' pagó '}${out.coins} monedas${out.tip ? ` (¡con ${out.tip} de propina!)` : ''}${variant ? ` (variante ${variant})` : ''}. +${out.xp} experiencia.`);
    if (out.gift) {
      audio.sfxPlay('pickup');
      await say('narr', `Además te dejó un regalito: ${ITEMS_BY_ID[out.gift]?.name ?? out.gift}.`);
    }
    if (out.levelUp) {
      audio.sfxPlay('success');
      await say('spicy', `¡Midnight Maki subió a nivel ${out.levelUp}! ¡Somos famosos! Bueno, un poquito.`, 'happy');
      for (const id of out.newRecipes) await say('narr', `Nueva receta: ${RECIPES_BY_ID[id].name}.`);
    }
  });
  if ((game.save.stats.spicyServed ?? 0) >= 5) game.setFlag('many_spicy');
}

/** Plated dish showcase: the finished sushi on a wooden board with 1-3 stars. Tap to continue. */
function showPlate(r: RecipeDef, quality: number): Promise<void> {
  return new Promise((resolve) => {
    const scale = 4;
    const cv = makeCanvas(64, 40);
    const g = ctx2d(cv);
    // wooden geta board + white plate
    g.fillStyle = '#2b1d17';
    g.fillRect(4, 24, 56, 12);
    g.fillStyle = '#c48d5e';
    g.fillRect(6, 24, 52, 9);
    g.fillStyle = '#e2b585';
    g.fillRect(6, 24, 52, 1);
    g.fillStyle = '#7a4c30';
    g.fillRect(10, 33, 5, 4);
    g.fillRect(49, 33, 5, 4);
    g.fillStyle = 'rgba(0,0,0,.18)';
    g.beginPath();
    g.ellipse(32, 24, 18, 5, 0, 0, Math.PI * 2);
    g.fill();
    const ic = iconCanvas(r.icon);
    g.imageSmoothingEnabled = false;
    for (const x of [12, 24, 36]) g.drawImage(ic, x, 6, 16, 16);
    g.fillStyle = '#f4a6b0';
    g.fillRect(50, 18, 5, 4);
    g.fillStyle = '#8fbf5f';
    g.fillRect(55, 17, 4, 4);
    for (let i = 0; i <= quality; i++) {
      g.fillStyle = '#ffc23a';
      g.fillRect(22 + i * 7, 2, 5, 5);
    }
    cv.style.width = cv.width * scale + 'px';
    cv.style.height = cv.height * scale + 'px';
    cv.style.maxWidth = '86vw';
    const stars = h('div', { class: 'plate-stars' }, ...[0, 1, 2].map((i) => h('span', { class: i <= quality ? 'on' : '' }, '★')));
    const words = ['¡Listo para servir!', '¡Muy bien hecho!', '¡Perfecto!'][quality];
    const wrap = h('div', { class: 'plate-show' }, h('div', { class: 'plate-card' }, h('div', { class: 'plate-name' }, r.name), cv, stars, h('div', { class: 'plate-words' }, words), h('div', { class: 'hint' }, 'Tocá para servir')));
    wrap.addEventListener('pointerup', () => {
      wrap.classList.add('out');
      setTimeout(() => {
        wrap.remove();
        resolve();
      }, 250);
    });
    audio.sfxPlay(quality === 2 ? 'success' : 'sparkle');
    uiRoot().append(wrap);
  });
}

// ------------------------------------------------------------------ kitchen station
export function openKitchen() {
  const body = h('div', { class: 'col' });
  const pending = game.save.orders.filter((o) => canCook(o.recipe));
  add(body,
    h('div', { class: 'card col' },
      h('b', null, 'Pedidos'),
      h('p', { class: 'hint' }, pending.length ? `Tenés ${pending.length} pedido(s) listos para cocinar.` : 'No hay pedidos con todos los ingredientes. Revisá el mostrador.'),
      h('button', { class: 'btn primary', onclick: () => { p.close(); openOrders(); } }, 'Ver pedidos')),
    h('div', { class: 'card col' },
      h('b', null, 'Cocina libre'),
      h('p', { class: 'hint' }, 'Prepará cualquier receta que conozcas. Un cliente sin reserva siempre la compra.'),
      h('button', { class: 'btn', onclick: () => { p.close(); openFreeCook(); } }, 'Elegir receta')),
    game.has('spicy_lab_intro') || game.friendLevel('spicy') >= 1
      ? h('div', { class: 'card col' },
          h('b', null, 'Experimentar con Spicy'),
          h('p', { class: 'hint' }, 'Combiná ingredientes para descubrir recetas ocultas.'),
          h('button', { class: 'btn rose', onclick: () => { p.close(); openLab(); } }, 'Experimentar'))
      : null,
  );
  const p = panel({ title: 'Tabla de cocina', body });
}

function openFreeCook() {
  const body = h('div', { class: 'col' });
  const known = RECIPES.filter((r) => game.save.recipesKnown.includes(r.id));
  for (const r of known) {
    const ready = canCook(r.id);
    const cost = ready ? 0 : missingCost(r);
    body.append(
      h('div', { class: 'card col', style: { gap: '6px' } },
        h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('div', { class: 'row' }, iconElement(r.icon), h('div', null, h('b', null, r.name), h('div', { class: 'hint' }, `${CAT_NAME[r.cat]} · ${'★'.repeat(r.difficulty)}`))), h('span', { class: 'coin' }, `~${Math.round(r.price * 0.7)} ●`)),
        ingList(r),
        h('div', { class: 'row', style: { justifyContent: 'flex-end', flexWrap: 'wrap' } },
          !ready && cost != null ? h('button', { class: 'btn small', onclick: () => { if (buyMissing(r)) { p.close(); openFreeCook(); } else toast('No te alcanzan las monedas.'); } }, `Comprar lo que falta (${cost} ●)`) : null,
          h('button', { class: 'btn small primary', disabled: !ready, onclick: () => { p.close(); freeCook(r.id); } }, 'Cocinar')),
      ),
    );
  }
  const p = panel({ title: 'Cocina libre', body });
}

async function freeCook(id: string) {
  const r = RECIPES_BY_ID[id];
  if (!game.consumeIngredients(r.ingredients)) return;
  const res = await cook(id, 'Cocina libre');
  if (!res.ok) {
    for (const [i, q] of Object.entries(r.ingredients)) game.addItem(i, q, 'refund');
    return;
  }
  const first = !game.save.recipesCooked[id];
  game.save.recipesCooked[id] = (game.save.recipesCooked[id] ?? 0) + 1;
  const coins = Math.round(r.price * (0.6 + res.quality * 0.1)) + res.variantBonus;
  game.addCoins(coins, 'walkin');
  const lvl = addRestaurantXp(Math.round(r.xp * 0.6));
  if (lvl) unlockLevelRecipes();
  game.stat('freeCooked');
  if (r.spicy) game.stat('spicyServed');
  game.touch('freecook');
  audio.sfxPlay('coin');
  await runScene('freecook', async () => {
    if (first) await say('narr', `¡Primera vez que preparás ${r.name}!`);
    await say('narr', `Un cliente sin reserva compró tu ${r.name} por ${coins} monedas.`);
    if (lvl) await say('spicy', `¡Nivel ${lvl}! ¡Seguimos creciendo!`, 'happy');
    if (id === 'three_stars' && !game.has('plate_seen')) {
      game.setFlag('plate_seen');
      await say('narr', 'Antes de que se lo lleven, notás algo: las tres piezas, sobre el plato, forman un dibujo. La plaza, la estación... y el faro.');
      await say('spicy', '¡Un mapa comestible! Akio era un genio. Un genio raro. Como yo.', 'surprised');
      await say('narr', 'La Abuela Ume seguro sabe algo de esto.');
    }
  });
}

// ------------------------------------------------------------------ experiments (Spicy's lab)
function openLab() {
  const sel: string[] = [];
  const pool = Object.keys(game.save.inventory).filter((id) => ITEMS_BY_ID[id]?.cat === 'ingredient' && !['rice', 'nori'].includes(id));
  const body = h('div', { class: 'col' });
  const render = () => {
    body.innerHTML = '';
    body.append(h('p', { class: 'hint' }, 'Elegí de 2 a 4 ingredientes (además de arroz y alga). Spicy opinará. Se usa 1 de cada uno.'));
    const grid = h('div', { class: 'grid' });
    for (const id of pool) {
      const it = ITEMS_BY_ID[id];
      grid.append(h('button', { class: 'slot' + (sel.includes(id) ? ' selected' : ''), onclick: () => { const i = sel.indexOf(id); if (i >= 0) sel.splice(i, 1); else if (sel.length < 4) sel.push(id); render(); } }, iconElement(it.icon), h('span', null, it.name), h('span', { class: 'qty' }, game.count(id))));
    }
    if (!pool.length) grid.append(h('p', { class: 'muted' }, 'No tenés ingredientes para experimentar.'));
    body.append(grid);
  };
  render();
  const p = panel({
    title: 'Laboratorio de Spicy',
    body,
    foot: [h('button', { class: 'btn primary', onclick: () => { if (sel.length < 2) return toast('Elegí al menos 2 ingredientes.'); p.close(); experiment([...sel]); } }, 'Experimentar')],
  });
}

async function experiment(sel: string[]) {
  for (const id of sel) if (!game.removeItem(id, 1)) return;
  const combo = [...sel].sort().join(',');
  const hit = EXPERIMENTS.find((e) => [...e.combo].sort().join(',') === combo);
  game.stat('experiments');
  await runScene('lab', async () => {
    await say('spicy', 'Muy bien... mezclamos... enrollamos... ¡y probamos!', 'happy');
    if (hit && !game.save.recipesKnown.includes(hit.result)) {
      if (hit.unlockFlag) game.setFlag(hit.unlockFlag);
      learnRecipe(hit.result);
      audio.sfxPlay('success');
      await say('spicy', `¡EUREKA! ¡Descubrimos ${RECIPES_BY_ID[hit.result].name}! Anotalo, anotalo.`, 'surprised');
    } else if (hit) await say('spicy', 'Esto ya lo conocemos. Delicioso, igual. Me lo como yo.', 'smug');
    else if (sel.includes('chili') || sel.includes('wasabi')) await say('spicy', 'Picante... interesante... ¡demasiado interesante! Mis bigotes están transpirando. No es receta, pero es arte.', 'surprised');
    else if (sel.includes('berry') && sel.includes('tuna')) await say('spicy', 'Atún con frutillas. No. Nunca más. Olvidemos que esto pasó.', 'sad');
    else await say('spicy', 'Mmm... le falta algo. ¿Coraje? ¿Una fruta? ¿Un hongo del bosque? Seguí probando.', 'neutral');
  });
}

// ------------------------------------------------------------------ upgrades
export function openUpgrades() {
  const body = h('div', { class: 'col' });
  const render = () => {
    body.innerHTML = '';
    body.append(h('p', { class: 'hint' }, `Monedas: ${game.coins} ●. Las mejoras se ven en el restaurante.`));
    for (const u of UPGRADES) {
      const owned = game.save.restaurant.upgrades.includes(u.id);
      const locked = game.save.restaurant.level < u.level;
      body.append(
        h('div', { class: 'card row', style: { justifyContent: 'space-between', gap: '10px', opacity: locked ? '.6' : '1' } },
          h('div', null, h('b', null, u.name), h('div', { class: 'hint' }, u.desc), locked ? h('div', { class: 'hint' }, `Requiere nivel ${u.level}`) : null),
          owned ? h('span', { class: 'pill' }, 'Comprada') : h('button', { class: 'btn small primary', disabled: locked || game.coins < u.price, onclick: () => { if (buyUpgrade(u.id)) { audio.sfxPlay('coin'); toast(`¡${u.name}!`); render(); } } }, `${u.price} ●`)),
      );
    }
  };
  render();
  panel({ title: 'Mejoras del restaurante', body });
}

registerAction('orders', () => openOrders());
registerAction('cook', () => openKitchen());
