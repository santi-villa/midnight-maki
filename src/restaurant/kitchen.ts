/** Restaurant UI: order board, kitchen station, free cooking, experiments, upgrades. */
import { DRINK_BY_ID, canPrepareDrink } from './drinkData';
import { prepareDrink, openDrinks } from './drinks';
import { runTask } from '../core/errors';
import './tray';
import './cornerPanel';
import { iconElement } from '../art/icons';
import { recipeIllustration } from '../art/cooking';
import { audio } from '../audio/audio';
import { game } from '../core/state';
import { ITEMS_BY_ID } from '../data/items';
import { EXPERIMENTS, RECIPES, RECIPES_BY_ID, type RecipeDef } from '../data/recipes';
import { bus } from '../core/events';
import { add, h, panel, toast, openModal } from '../ui/dom';
import { registerAction } from '../systems/actions';
import { cook, type CookResult } from './cooking';
import { kitchenOpen, openKitchenSession, type KitchenHooks } from './kitchenSession';
import { PRESENTATIONS, recordRecipeResult, recipePresentation } from './recipeCollection';
import { canCook, customerAsk, customerName, GENERIC_CUSTOMERS, learnRecipe, maxOrders, refreshOrders, serveOrder, addRestaurantXp, unlockLevelRecipes, charm } from './orders';
import { plateState, serviceBoardNote, stagePlate, servingName, tableLabel, type PaidMeal } from './service';
import { UPGRADES, buyUpgrade, upgradeMissing } from './upgrades';
import { advanceMissing, advanceRestaurant, levelProgress, nextAdvance, xpFloor } from './progression';
import { freeCookCoins } from './economy';
import { runScene, say } from '../dialogue/dialogue';
import { STAGE_NAMES, applyStageGrants, stageForLevel } from './stages';
import { QUICK_STARS, nextStarGoal, quickQuality, recipeStars, mastery, recordMastery, starsText } from './mastery';

const CAT_NAME = { basic: 'Básica', intermediate: 'Intermedia', special: 'Especial' };

function ingList(r: { ingredients: Record<string, number> }) {
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
function missingCost(r: { ingredients: Record<string, number> }): number | null {
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

function buyMissing(r: { ingredients: Record<string, number> }): boolean {
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
        h('div', null, h('b', null, `Nivel ${rs.level}`), h('div', { class: 'bar', style: { width: '140px', marginTop: '4px' } }, h('i', { style: { width: `${levelProgress() * 100}%` } })), h('div', { class: 'hint' }, `XP total: ${rs.totalXp ?? xpFloor(rs.level) + rs.xp}${nextAdvance() && !advanceMissing().length ? ' · Ascenso disponible' : ''}`)),
        h('div', { class: 'hint' }, `Reputación ${rs.reputation} · Encanto ${charm()} · Servidos ${rs.served}`),
        h('button', { class: 'btn small', onclick: () => openUpgrades(render) }, 'Mejoras'),
      ),
    );
    const note = serviceBoardNote();
    body.append(
      h('div', { class: 'card col', style: { gap: '4px' } },
        h('b', null, 'Horario'),
        h('div', { class: 'hint' }, note.status),
        ...note.summary.map((line) => h('div', null, line)),
      ),
    );
    // the tray: dishes that are done and wait to be carried to their tables
    const ready = game.save.orders.filter((o) => plateState(o.uid) === 'plated');
    if (ready.length)
      body.append(
        h('div', { class: 'card col kitchen-tray', style: { gap: '6px', borderColor: '#7fa356' } },
          h('b', null, `Bandeja de salida (${ready.length})`),
          h('div', { class: 'row', style: { flexWrap: 'wrap', gap: '8px' } },
            ...ready.map((o) => {
              const r = o.kind === 'drink' ? DRINK_BY_ID[o.recipe] : RECIPES_BY_ID[o.recipe];

              const q = ['Aceptable', 'Muy bueno', 'Perfecto'][o.plate?.quality ?? 0];
              return h('div', { class: 'tray-plate', title: q }, r ? iconElement(r.icon) : null, h('div', { class: 'hint' }, `${o.service?.tableId ? tableLabel(o.service.tableId) + ' · ' + customerName(o.customer) : customerName(o.customer)} · ${q}`));
            })),
          h('div', { class: 'hint' }, 'Recogelos en la bandeja física junto al mostrador y llevalos a sus mesas.'),
        ),
      );
    if (!game.save.orders.length) body.append(h('p', { class: 'muted' }, 'No hay pedidos en el mostrador. Cuando un cliente se siente, tomá el pedido en su mesa.'));
    for (const o of game.save.orders) {
      const r = o.kind === 'drink' ? DRINK_BY_ID[o.recipe] : RECIPES_BY_ID[o.recipe];
      if (!r) continue;
      const held = plateState(o.uid);
      const cooked = ['plated', 'carried', 'delivered'].includes(held);
      const ready = !cooked && (o.kind === 'drink' ? canPrepareDrink(r.id) : canCook(r.id));
      const cost = ready || cooked ? 0 : missingCost(r);
      const special = o.special === 'odd' ? 'Pedido sin remitente' : o.special === 'tutorial' ? 'Pedido de práctica' : '';
      body.append(
        h(
          'div',
          { class: 'card col', style: { gap: '6px', borderColor: o.special ? '#f2c66d' : undefined } },
          h('div', { class: 'row', style: { justifyContent: 'space-between' } },
            h('div', { class: 'row' }, iconElement(r.icon), h('div', null, h('b', null, r.name), o.kind === 'drink' ? null : h('span', { class: 'mastery-stars', title: nextStarGoal(mastery(r.id)) ?? 'Receta dominada' }, ' ' + starsText(recipeStars(r.id))), h('div', { class: 'hint' }, special || `Para: ${customerName(o.customer)}${o.service ? ' · ' + tableLabel(o.service.tableId) : ''}`))),
            h('span', { class: 'coin' }, `${o.reward} ●`)),
          !special && customerAsk(o.customer, o.uid) ? h('div', { class: 'order-ask' }, `“${customerAsk(o.customer, o.uid)}”`) : null,
          cooked ? h('div', { class: 'hint' }, held === 'carried' ? 'Lo estás llevando a su mesa.' : held === 'delivered' ? 'Entregado. El grupo está comiendo o esperando el resto.' : 'Listo en la bandeja de salida.') : ingList(r),
          h('div', { class: 'row', style: { justifyContent: 'flex-end', flexWrap: 'wrap' } },
            !cooked && !ready && cost != null ? h('button', { class: 'btn small', onclick: () => { if (buyMissing(r)) render(); else toast('No te alcanzan las monedas.'); } }, `Comprar lo que falta (${cost} ●)`) : null,
            !cooked && !ready && cost == null ? h('span', { class: 'hint' }, 'Faltan ingredientes que no se compran acá.') : null,
            !cooked && o.kind !== 'drink' && ready && quickQuality(recipeStars(r.id))
              ? h('button', { class: 'btn small', title: 'Receta dominada: se prepara en un toque', onclick: async () => {
                  p.root.parentElement!.style.display = 'none';
                  try { await runTask('kitchen:order', () => cookOrder(o.uid, true)); } finally {
                    if (p.root.isConnected) { p.root.parentElement!.style.display = ''; render(); }
                  }
                } }, 'Rápido')
              : null,
            h('button', { class: 'btn small primary', disabled: cooked || !ready, onclick: async () => {
              // the station stays open between dishes: hide it while the board is up, then show the updated list
              p.root.parentElement!.style.display = 'none';
              try { await runTask('kitchen:order', () => cookOrder(o.uid)); } finally {
                if (p.root.isConnected) { p.root.parentElement!.style.display = ''; render(); }
              }
            } }, cooked ? (held === 'delivered' ? 'Entregado' : held === 'carried' ? 'En tus manos' : 'En bandeja') : o.kind === 'drink' ? 'Preparar bebida' : 'Cocinar'),
          ),
        ),
      );
    }
    body.append(h('p', { class: 'hint' }, `Hasta ${maxOrders()} grupos a la vez. Cada integrante tiene su pedido. Recogé los platos listos en la bandeja. Los de la historia siguen en el mostrador.`));
  };
  render();
  const p = panel({ title: 'Cocina · Pedidos', body, foot: [h('button', { class: 'btn', onclick: () => p.close() }, 'Volver al salón')] });
}

/** Cook one order. Food opens the kitchen with that dish started; drinks and one-tap dishes keep their short flow. */
const cooking = new Set<number>();
export async function cookOrder(uid: number, quick = false) {
  if (cooking.has(uid) || kitchenOpen()) return;
  cooking.add(uid);
  try {
    const o = game.save.orders.find((x) => x.uid === uid);
    if (o && o.kind !== 'drink' && !quick && !['plated', 'carried', 'delivered'].includes(plateState(uid))) await enterKitchen(uid);
    else await startOrder(uid, quick);
  } finally { cooking.delete(uid); }
}

/** The multi-dish kitchen: orders are claimed (ingredients consumed) when a dish starts and refunded if it is dropped. */
export async function enterKitchen(firstUid?: number) {
  if (kitchenOpen()) return;
  refreshOrders(false);
  const taken = new Set<number>();
  const plan = (uid: number) => {
    const o = game.save.orders.find((x) => x.uid === uid);
    return o && o.kind !== 'drink' ? { o, r: RECIPES_BY_ID[o.recipe] } : null;
  };
  const hooks: KitchenHooks = {
    orders: () => game.save.orders
      .filter((o) => o.kind !== 'drink' && RECIPES_BY_ID[o.recipe] && !['plated', 'carried', 'delivered'].includes(plateState(o.uid)))
      .map((o) => ({ uid: o.uid, recipe: RECIPES_BY_ID[o.recipe], who: customerName(o.customer), reward: o.reward, ready: taken.has(o.uid) || canCook(o.recipe), note: o.service ? tableLabel(o.service.tableId) : o.special === 'odd' ? 'sin remitente' : undefined })),
    take: (uid) => {
      const p = plan(uid);
      if (!p || taken.has(uid) || !game.consumeIngredients(p.r.ingredients)) return false;
      taken.add(uid);
      return true;
    },
    cancel: (uid) => {
      const p = plan(uid);
      if (!taken.delete(uid)) return;
      const r = p?.r ?? null;
      if (r) for (const [id, q] of Object.entries(r.ingredients)) game.addItem(id, q, 'refund');
    },
    done: (uid, res) => {
      const p = plan(uid);
      taken.delete(uid);
      if (!p) return null;
      const { o, r } = p;
      const refund = () => { for (const [id, q] of Object.entries(r.ingredients)) game.addItem(id, q, 'refund'); };
      celebrate(r, res);
      if (o.service || plateState(uid) === 'cooking') {
        if (!stagePlate(uid, res.quality, res.variantBonus, res.variant)) {
          refund();
          return async () => { toast('El pedido cambió. Te devolví los ingredientes.'); };
        }
        return async () => { await showPlate(r, res.quality, res.variant); toast(`Listo. Recogé ${r.name} en la bandeja de salida.`); };
      }
      const special = o.special;
      const out = serveOrder(uid, res.quality, res.variantBonus);
      if (!out) { refund(); return async () => { toast('El cliente ya no está. Te devolví los ingredientes.'); }; }
      audio.sfxPlay('coin');
      return async () => {
        await showServeResult(r, out, res.quality, customerName(o.customer), o.customer, res.variant);
        if (special === 'odd') { const { oddOrderServed } = await import('../story/story'); await oddOrderServed(); }
      };
    },
  };
  await openKitchenSession(hooks, firstUid);
}

/** Result of a one-tap dish (mastered recipes): no board, and it never raises mastery. */
function quickResult(r: RecipeDef): Awaited<ReturnType<typeof cook>> {
  const q = quickQuality(recipeStars(r.id)) ?? 1;
  return { ok: true, quality: q, score: q === 2 ? 100 : 80, variantBonus: 0 };
}

function celebrate(r: RecipeDef, result: CookResult) {
  const collected = recordRecipeResult(r.id, result);
  if (collected.discovered) toast(`Variante descubierta: ${r.name} ${collected.discovered}. ¡Anotada en el recetario!`);
  const { before, after } = recordMastery(r.id, result.quality);
  if (after > before) {
    audio.sfxPlay('sparkle');
    const styles = PRESENTATIONS.filter((p) => p.stars > before && p.stars <= after);
    toast(`¡${r.name}: ${starsText(after)}!${after === QUICK_STARS ? ' Ahora podés hacerla en un toque (Rápido).' : ''}${styles.length ? ` Nueva presentación: ${styles.map((p) => p.name).join(', ')}. Elegila en el recetario.` : ''}`);
    // mastering a dish pays a one-time bonus (never twice, even if the save is reloaded)
    if (after === 5) game.once('mastered_' + r.id, () => { game.addCoins(100, 'mastery'); toast(`Plato de honor: ${r.name}. +100 monedas.`); });
  }
}

async function startOrder(uid: number, quick = false) {
  if (['plated', 'carried', 'delivered'].includes(plateState(uid))) {
    toast('Ese plato ya está listo. Llevalo a la mesa.');
    return;
  }
  const o = game.save.orders.find((x) => x.uid === uid);
  if (!o) return;
  if (o.kind === 'drink') { await prepareDrink(uid); return; }
  const r = RECIPES_BY_ID[o.recipe];
  const forTable = !!o.service || plateState(uid) === 'cooking';
  if (!game.consumeIngredients(r.ingredients)) {
    toast('Faltan ingredientes.');
    return;
  }
  let res: CookResult;
  try { res = quick ? quickResult(r) : await cook(r.id, customerName(o.customer)); }
  catch (error) { for (const [id, q] of Object.entries(r.ingredients)) game.addItem(id, q, 'refund'); throw error; }
  if (res.ok && !quick) celebrate(r, res);
  if (!res.ok) {
    // cancelled: give the ingredients back (no punishment)
    for (const [id, q] of Object.entries(r.ingredients)) game.addItem(id, q, 'refund');
    toast('Guardaste los ingredientes para después.');
    return;
  }
  if (forTable) {
    if (!stagePlate(uid, res.quality, res.variantBonus, res.variant)) {
      for (const [id, q] of Object.entries(r.ingredients)) game.addItem(id, q, 'refund');
      toast('El pedido cambió. Te devolví los ingredientes.'); return;
    }
    await showPlate(r, res.quality, res.variant);
    toast(`Listo. Recogé ${r.name} en la bandeja de salida.`);
    return;
  }
  const special = o.special;
  const out = serveOrder(uid, res.quality, res.variantBonus);
  if (!out) {
    for (const [id, q] of Object.entries(r.ingredients)) game.addItem(id, q, 'refund');
    toast('El cliente ya no está. Te devolví los ingredientes.');
    return;
  }
  audio.sfxPlay('coin');
  await showServeResult(r, out, res.quality, customerName(o.customer), o.customer, res.variant);
  if (special === 'odd') {
    const { oddOrderServed } = await import('../story/story');
    await oddOrderServed();
  }
}

/** One short receipt per group, preserving meaningful recipe/level celebrations. */
export async function presentPaidMeals(meals: PaidMeal[]) {
  if (!meals.length) return;
  audio.sfxPlay('coin');
  await runScene('serve_group', async () => {
    const coins = meals.reduce((n, m) => n + m.result.coins, 0), tips = meals.reduce((n, m) => n + m.result.tip, 0);
    const reply = GENERIC_CUSTOMERS.find(c => c.id === meals[0].customer);
    if (reply) await say('?' + reply.name, reply.react?.[meals[0].quality] ?? ['Gracias por la comida.', '¡Muy rico! Fue un lindo rato.', '¡Perfecto! Vamos a volver.'][meals[0].quality]);
    await say('narr', `${meals.length} pedido${meals.length === 1 ? '' : 's'} servidos. Cobraste ${coins} monedas.${tips ? ` Quedaron ${tips} de propina en la mesa.` : ''}`);
    for (const m of meals.filter(m => m.result.firstTime)) await say('narr', `¡Primera vez que preparás ${servingName({ recipe: m.recipe, kind: m.kind } as import('../core/types').Order)}! Quedó en tus colecciones.`);
    const level = Math.max(...meals.map(m => m.result.levelUp));
    if (level) {
      await say('spicy', `¡Midnight Maki subió a nivel ${level}! ¡Seguimos creciendo!`, 'happy');
      for (const recipe of [...new Set(meals.flatMap(m => m.result.newRecipes))]) await say('narr', `Nueva receta: ${RECIPES_BY_ID[recipe].name}.`);
      applyStageGrants();
      if (meals.some(m => m.result.levelUp && stageForLevel(m.result.levelUp) !== stageForLevel(m.result.levelUp - 1))) {
        await say('narr', `Midnight Maki se ve distinto: ${STAGE_NAMES[stageForLevel(level)]}.`);
        const { world } = await import('../scenes/WorldScene');
        if (world.zoneId === 'restaurant' && world.player) await world.enterZone('restaurant', world.player.tx, world.player.ty, world.player.dir, false);
      }
    }
    for (const m of meals.filter(m => m.result.gift)) await say('narr', `${customerName(m.customer)} dejó un regalito: ${ITEMS_BY_ID[m.result.gift!]?.name ?? m.result.gift}.`);
  });
}
export async function presentPaidMeal(meal: PaidMeal) { await presentPaidMeals([meal]); }

async function showServeResult(r: RecipeDef, out: NonNullable<ReturnType<typeof serveOrder>>, quality: number, who: string, customer: string, variant?: string, tipOnTable = false) {
  const generic = GENERIC_CUSTOMERS.find((c) => c.id === customer);
  if (!tipOnTable) await showPlate(r, quality, variant);
  await runScene('serve', async () => {
    if (out.firstTime) {
      audio.sfxPlay('sparkle');
      await say('narr', `¡Primera vez que preparás ${r.name}! Quedó anotado en tus colecciones.`);
    }
    if (generic) await say('?' + generic.name, generic.react?.[quality] ?? generic.line);
    else if (customer !== 'c_odd') await say(customer, ['Mmm... está rico. Gracias.', '¡Qué rico! Muy bien hecho.', '¡Perfecto! Volvería todos los días.'][quality], quality === 2 ? 'happy' : 'neutral');
    const tipLine = out.tip ? (tipOnTable ? `. Dejó ${out.tip} de propina en la mesa` : ` (¡con ${out.tip} de propina!)`) : '';
    const paid = tipOnTable
      ? `${who === 'Cliente' ? 'Pagaron' : who + ' pagó'} ${out.coins} monedas${tipLine}`
      : `${who === 'Cliente' ? '' : who + ' pagó '}${out.coins} monedas${tipLine}`;
    await say('narr', `${paid}${variant ? ` (variante ${variant})` : ''}. +${out.xp} experiencia.`);
    if (out.gift) {
      audio.sfxPlay('pickup');
      await say('narr', `Además te dejó un regalito: ${ITEMS_BY_ID[out.gift]?.name ?? out.gift}.`);
    }
    if (out.levelUp) {
      audio.sfxPlay('success');
      await say('spicy', `¡Midnight Maki subió a nivel ${out.levelUp}! ¡Somos famosos! Bueno, un poquito.`, 'happy');
      for (const id of out.newRecipes) await say('narr', `Nueva receta: ${RECIPES_BY_ID[id].name}.`);
      // at some levels the whole restaurant changes its look (stages.ts): say it and redraw the room now
      if (stageForLevel(out.levelUp) !== stageForLevel(out.levelUp - 1)) {
        audio.sfxPlay('sparkle');
        applyStageGrants();
        await say('narr', `Midnight Maki se ve distinto: ${STAGE_NAMES[stageForLevel(out.levelUp)]}. Mirá la fachada la próxima vez que salgas.`);
        const { world } = await import('../scenes/WorldScene');
        if (world.zoneId === 'restaurant' && world.player) void world.enterZone('restaurant', world.player.tx, world.player.ty, world.player.dir, false);
      }
    }
  });
  if ((game.save.stats.spicyServed ?? 0) >= 5) game.setFlag('many_spicy');
}

/** Finished sushi on the recipe's selected ceramic, with its variant and 1–3 stars. */
function showPlate(r: RecipeDef, quality: number, variant?: string): Promise<void> {
  return new Promise((resolve) => {
    const cv = h('canvas', { width: 96, height: 64, 'aria-label': r.name });
    const extra = r.variants?.find((v) => v.name === variant)?.item;
    cv.getContext('2d')!.drawImage(recipeIllustration(r, recipePresentation(r.id), quality as 0 | 1 | 2, extra), 0, 0);
    cv.style.width = '288px';
    cv.style.height = 'auto';
    cv.style.maxWidth = '86vw';
    const stars = h('div', { class: 'plate-stars' }, ...[0, 1, 2].map((i) => h('span', { class: i <= quality ? 'on' : '' }, '★')));
    const words = ['¡Listo para servir!', '¡Muy bien hecho!', '¡Perfecto!'][quality];
    const wrap = h('div', { class: 'plate-show' }, h('div', { class: 'plate-card' }, h('div', { class: 'plate-name' }, r.name), cv, stars, h('div', { class: 'plate-words' }, words), h('div', { class: 'hint' }, 'Tocá para continuar')));
    wrap.addEventListener('pointerup', () => {
      wrap.classList.add('out');
      setTimeout(() => {
        close();
        resolve();
      }, 250);
    });
    audio.sfxPlay(quality === 2 ? 'success' : 'sparkle');
    const close = openModal(wrap);
  });
}

// ------------------------------------------------------------------ kitchen station
export function openKitchen() {
  const body = h('div', { class: 'col' });
  const pending = game.save.orders.filter((o) => canCook(o.recipe));
  add(body,
    h('div', { class: 'card col' },
      h('b', null, 'Cocinar'),
      h('p', { class: 'hint' }, 'Entrá a la cocina: tomá varios pedidos, elegí cuáles hacer y pasá de un plato a otro cuando quieras.'),
      h('button', { class: 'btn primary', onclick: () => { p.close(); void runTask('kitchen:session', () => enterKitchen()); } }, 'Entrar a la cocina')),
    h('div', { class: 'card col' },
      h('b', null, 'Pedidos'),
      h('p', { class: 'hint' }, pending.length ? `Tenés ${pending.length} pedido(s) listos para cocinar.` : 'No hay pedidos con todos los ingredientes. Revisá el mostrador.'),
      h('button', { class: 'btn primary', onclick: () => { p.close(); openOrders(); } }, 'Ver pedidos')),
    h('div', { class: 'card col' },
      h('b', null, 'Cocina libre'),
      h('p', { class: 'hint' }, 'Prepará cualquier receta que conozcas. Un cliente sin reserva siempre la compra.'),
      h('button', { class: 'btn', onclick: () => { p.close(); openFreeCook(); } }, 'Elegir receta')),
    h('div', { class: 'card col' }, h('b', null, 'Bebidas'), h('p', { class: 'hint' }, 'Té verde, ramune y leche de frutilla desde nivel 2.'), h('button', { class: 'btn', onclick: () => { p.close(); openDrinks(); } }, 'Estación de bebidas')),
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
        h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('div', { class: 'row' }, iconElement(r.icon), h('div', null, h('b', null, r.name), h('div', { class: 'hint' }, `${CAT_NAME[r.cat]} · ${'★'.repeat(r.difficulty)}`))), h('span', { class: 'coin' }, `${freeCookCoins(r, 0)}–${freeCookCoins(r, 2)} ●`)),
        ingList(r),
        h('div', { class: 'row', style: { justifyContent: 'flex-end', flexWrap: 'wrap' } },
          !ready && cost != null ? h('button', { class: 'btn small', onclick: () => { if (buyMissing(r)) { p.close(); openFreeCook(); } else toast('No te alcanzan las monedas.'); } }, `Comprar lo que falta (${cost} ●)`) : null,
          h('button', { class: 'btn small primary', disabled: !ready, onclick: () => { p.close(); void runTask('kitchen:free', () => freeCook(r.id)); } }, 'Cocinar')),
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
  celebrate(r, res);
  const first = !game.save.recipesCooked[id];
  game.save.recipesCooked[id] = (game.save.recipesCooked[id] ?? 0) + 1;
  const coins = freeCookCoins(r, res.quality, res.variantBonus);
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
export function openUpgrades(onClose?: () => void) {
  const body = h('div', { class: 'col' });
  const resources = (coins: number, items: Record<string, number>) => `${coins} ●${Object.entries(items).map(([id, q]) => ` · ${ITEMS_BY_ID[id]?.name ?? id} ${game.count(id)}/${q}`).join('')}`;
  const render = () => {
    body.innerHTML = '';
    const rs = game.save.restaurant, advance = nextAdvance();
    body.append(h('p', { class: 'hint' }, `Monedas: ${game.coins} ●. Elegí qué construir; las compras anteriores se conservan.`));
    body.append(h('div', { class: 'card col' }, h('b', null, `Midnight Maki · Nivel ${rs.level}`), h('p', { class: 'hint' }, `XP total: ${rs.totalXp ?? xpFloor(rs.level) + rs.xp}. La experiencia y reputación no se gastan.`),
      advance ? h('div', { class: 'col' }, h('span', null, `Ascenso a nivel ${advance.level}`),
        h('span', { class: 'hint' }, `XP ${rs.totalXp ?? xpFloor(rs.level) + rs.xp}/${xpFloor(advance.level)} · Reputación ${rs.reputation}/${advance.reputation}`),
        h('span', { class: 'hint' }, resources(advance.coins, advance.items)),
        advanceMissing().length ? h('span', { class: 'hint' }, `Falta: ${advanceMissing().join(' · ')}`) : null,
        h('button', { class: 'btn primary', disabled: !!advanceMissing().length, onclick: () => {
          void runTask('restaurant:advance', async () => {
            const before = rs.level;
            if (!advanceRestaurant(advance.level)) { toast('Revisá los requisitos del ascenso.'); render(); return; }
            const recipes = unlockLevelRecipes(); applyStageGrants(); audio.sfxPlay('success');
            toast(`¡Nivel ${advance.level}!${recipes.length ? ' Nuevas recetas: ' + recipes.map(id => RECIPES_BY_ID[id].name).join(', ') : ''}`);
            p.close();
            if (stageForLevel(before) !== stageForLevel(advance.level)) {
              const { world } = await import('../scenes/WorldScene');
              if (world.zoneId === 'restaurant' && world.player) await world.enterZone('restaurant', world.player.tx, world.player.ty, world.player.dir, false);
            }
          });
        } }, 'Ascender')) : h('p', { class: 'hint' }, rs.level === 1 ? 'El nivel 2 se alcanza cocinando, sin cobrar monedas ni materiales.' : 'Nivel máximo alcanzado. Seguí eligiendo mejoras y disfrutando del pueblo.')));
    for (const u of UPGRADES) {
      const owned = game.save.restaurant.upgrades.includes(u.id);
      const missing = upgradeMissing(u);
      body.append(
        h('div', { class: 'card col' },
          h('b', null, u.name), h('div', { class: 'hint' }, u.desc),
          owned ? h('span', { class: 'pill' }, 'Comprada') : h('div', { class: 'col' }, h('span', { class: 'hint' }, resources(u.price, u.items ?? {})),
            missing.length ? h('span', { class: 'hint' }, `Falta: ${missing.join(' · ')}`) : null,
            h('button', { class: 'btn primary', disabled: !!missing.length, onclick: () => { if (buyUpgrade(u.id)) { audio.sfxPlay('coin'); toast(`¡${u.name}!`); render(); } else { toast('No se pudo construir: revisá los recursos o el espacio libre del cuarto. No se cobró nada.'); render(); } } }, 'Construir'))),
      );
    }
  };
  render();
  const off = bus.on('state:changed', render);
  const p = panel({ title: 'Mejoras del restaurante', body, onClose: () => { off(); onClose?.(); } });
}

registerAction('orders', () => openOrders());
registerAction('cook', () => openKitchen());
