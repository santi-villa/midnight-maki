/** Restaurant UI: order board, kitchen station, free cooking, experiments, upgrades. */
import { iconElement } from '../art/icons';
import { recipeIllustration } from '../art/cooking';
import { audio } from '../audio/audio';
import { game } from '../core/state';
import { ITEMS_BY_ID } from '../data/items';
import { EXPERIMENTS, RECIPES, RECIPES_BY_ID, type RecipeDef } from '../data/recipes';
import { BALANCE } from '../core/balance';
import { add, h, panel, toast, uiRoot } from '../ui/dom';
import { registerAction } from '../systems/actions';
import { cook, type CookResult } from './cooking';
import { PRESENTATIONS, recordRecipeResult, recipePresentation } from './recipeCollection';
import { canCook, customerAsk, customerName, GENERIC_CUSTOMERS, learnRecipe, maxOrders, refreshOrders, serveOrder, addRestaurantXp, unlockLevelRecipes, charm } from './orders';
import { guestViews, plateState, serviceBoardNote, stagePlate, type PaidMeal } from './service';
import { UPGRADES, buyUpgrade } from './upgrades';
import { runScene, say } from '../dialogue/dialogue';
import { STAGE_NAMES, applyStageGrants, stageForLevel } from './stages';
import { QUICK_STARS, nextStarGoal, quickQuality, recipeStars, mastery, recordMastery, starsText } from './mastery';

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
              const r = RECIPES_BY_ID[o.recipe];
              const view = guestViews().find((g) => g.orderUid === o.uid);
              const q = ['Aceptable', 'Muy bueno', 'Perfecto'][o.plate?.quality ?? 0];
              return h('div', { class: 'tray-plate', title: q }, r ? iconElement(r.icon) : null, h('div', { class: 'hint' }, `${view?.tableId ? 'Mesa ' + (view.tableId.match(/\d+/)?.[0] ?? view.tableId) : customerName(o.customer)} · ${q}`));
            })),
          h('div', { class: 'hint' }, 'Cuando termines acá, llevalos a sus mesas.'),
        ),
      );
    if (!game.save.orders.length) body.append(h('p', { class: 'muted' }, 'No hay pedidos en el mostrador. Cuando un cliente se siente, tomá el pedido en su mesa.'));
    for (const o of game.save.orders) {
      const r = RECIPES_BY_ID[o.recipe];
      if (!r) continue;
      const held = plateState(o.uid);
      const ready = held !== 'plated' && canCook(r.id);
      const cost = ready || held === 'plated' ? 0 : missingCost(r);
      const special = o.special === 'odd' ? 'Pedido sin remitente' : o.special === 'tutorial' ? 'Pedido de práctica' : '';
      body.append(
        h(
          'div',
          { class: 'card col', style: { gap: '6px', borderColor: o.special ? '#f2c66d' : undefined } },
          h('div', { class: 'row', style: { justifyContent: 'space-between' } },
            h('div', { class: 'row' }, iconElement(r.icon), h('div', null, h('b', null, r.name), h('span', { class: 'mastery-stars', title: nextStarGoal(mastery(r.id)) ?? 'Receta dominada' }, ' ' + starsText(recipeStars(r.id))), h('div', { class: 'hint' }, special || `Para: ${customerName(o.customer)}`))),
            h('span', { class: 'coin' }, `${o.reward} ●`)),
          !special && customerAsk(o.customer, o.uid) ? h('div', { class: 'order-ask' }, `“${customerAsk(o.customer, o.uid)}”`) : null,
          held === 'plated' ? h('div', { class: 'hint' }, 'El plato está listo. Llevalo a la mesa.') : ingList(r),
          h('div', { class: 'row', style: { justifyContent: 'flex-end', flexWrap: 'wrap' } },
            held !== 'plated' && !ready && cost != null ? h('button', { class: 'btn small', onclick: () => { if (buyMissing(r)) render(); else toast('No te alcanzan las monedas.'); } }, `Comprar lo que falta (${cost} ●)`) : null,
            held !== 'plated' && !ready && cost == null ? h('span', { class: 'hint' }, 'Faltan ingredientes que no se compran acá.') : null,
            held !== 'plated' && ready && quickQuality(recipeStars(r.id))
              ? h('button', { class: 'btn small', title: 'Receta dominada: se prepara en un toque', onclick: async () => {
                  p.root.parentElement!.style.display = 'none';
                  try { await cookOrder(o.uid, true); } finally {
                    if (p.root.isConnected) { p.root.parentElement!.style.display = ''; render(); }
                  }
                } }, 'Rápido')
              : null,
            h('button', { class: 'btn small primary', disabled: held === 'plated' || !ready, onclick: async () => {
              // the station stays open between dishes: hide it while the board is up, then show the updated list
              p.root.parentElement!.style.display = 'none';
              try { await cookOrder(o.uid); } finally {
                if (p.root.isConnected) { p.root.parentElement!.style.display = ''; render(); }
              }
            } }, held === 'plated' ? 'En la mesa' : 'Cocinar'),
          ),
        ),
      );
    }
    body.append(h('p', { class: 'hint' }, `Hasta ${maxOrders()} pedidos a la vez. Tomá cada pedido en la mesa. Los de la historia siguen en el mostrador.`));
  };
  render();
  const p = panel({ title: 'Cocina · Pedidos', body, foot: [h('button', { class: 'btn', onclick: () => p.close() }, 'Volver al salón')] });
}

/** Cook one order. A party that is waiting eats at the table; story orders pay here. */
export function cookOrder(uid: number, quick = false) {
  return startOrder(uid, quick);
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
  if (plateState(uid) === 'plated') {
    toast('Ese plato ya está listo. Llevalo a la mesa.');
    return;
  }
  const o = game.save.orders.find((x) => x.uid === uid);
  if (!o) return;
  const r = RECIPES_BY_ID[o.recipe];
  const forTable = plateState(uid) === 'cooking';
  if (!game.consumeIngredients(r.ingredients)) {
    toast('Faltan ingredientes.');
    return;
  }
  const res = quick ? quickResult(r) : await cook(r.id, customerName(o.customer));
  if (res.ok && !quick) celebrate(r, res);
  if (!res.ok) {
    // cancelled: give the ingredients back (no punishment)
    for (const [id, q] of Object.entries(r.ingredients)) game.addItem(id, q, 'refund');
    toast('Guardaste los ingredientes para después.');
    return;
  }
  if (forTable && stagePlate(uid, res.quality, res.variantBonus, res.variant)) {
    await showPlate(r, res.quality, res.variant);
    toast(`Listo. Llevá ${r.name} a la mesa.`);
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

/** Coins, reaction and level-up after a table has eaten. The tip stays on the table. */
export async function presentPaidMeal(meal: PaidMeal) {
  const r = RECIPES_BY_ID[meal.recipe];
  if (!r) return;
  audio.sfxPlay('coin');
  await showServeResult(r, meal.result, meal.quality, customerName(meal.customer), meal.customer, meal.variant, true);
}

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
  celebrate(r, res);
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
