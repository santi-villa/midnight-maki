/** Collectible recipe album. Viewing previews never unlocks or records a preparation. */
import { recipeIllustration } from '../art/cooking';
import { iconElement } from '../art/icons';
import { game } from '../core/state';
import { ITEMS_BY_ID } from '../data/items';
import { RECIPES, RECIPES_BY_ID, type CookStep, type RecipeDef } from '../data/recipes';
import { mastery, nextStarGoal, recipeStars, starsText } from '../restaurant/mastery';
import { PRESENTATIONS, recipePresentation, recipeRecord, selectRecipePresentation } from '../restaurant/recipeCollection';
import { h } from './dom';

const CATEGORIES = { basic: 'Básicas', intermediate: 'Intermedias', special: 'Especiales' };
const QUALITY = ['Listo para servir', 'Muy bien hecho', 'Perfecto'];
const STEPS: Record<CookStep['t'], string> = { nori: 'Alga', rice: 'Arroz', place: 'Relleno', slice: 'Cortar', roll: 'Enrollar', cut: 'Porciones', shape: 'Moldear', top: 'Cubrir', wrap: 'Envolver', cone: 'Cono', garnish: 'Decorar', cook: 'Cocinar', plate: 'Emplatar' };

function picture(recipe: RecipeDef, style = recipePresentation(recipe.id), variant?: string) {
  const cv = h('canvas', { class: 'recipe-picture', width: 96, height: 64, 'aria-label': `Ilustración de ${recipe.name}${variant ? ' con ingrediente extra' : ''}` });
  cv.getContext('2d')!.drawImage(recipeIllustration(recipe, style, 2, variant), 0, 0);
  return cv;
}

function hiddenPicture() {
  return h('div', { class: 'recipe-silhouette', 'aria-hidden': 'true' }, '？');
}

export function recipeCollectionView(): HTMLElement {
  const root = h('div', { class: 'recipe-collection' });
  const known = (r: RecipeDef) => game.save.recipesKnown.includes(r.id);
  const prepared = (r: RecipeDef) => (mastery(r.id)?.n ?? 0) > 0 || (game.save.recipesCooked[r.id] ?? 0) > 0;
  let category = 'all';
  let status = 'all';
  let query = '';
  let listScroll = 0;
  const variantTotal = RECIPES.reduce((sum, r) => sum + (r.variants?.length ?? 0), 0);
  const variantFound = RECIPES.reduce((sum, r) => sum + (r.variants?.filter((v) => (recipeRecord(r.id)?.variants[v.item]?.count ?? 0) > 0).length ?? 0), 0);
  const summary = h('div', { class: 'recipe-summary' },
    h('h3', null, 'Recetario de Villa Nori'),
    h('div', { class: 'recipe-counts' },
      h('span', null, `${RECIPES.filter(known).length}/${RECIPES.length} recetas`),
      h('span', null, `${RECIPES.filter(prepared).length} preparadas`),
      h('span', null, `${variantFound}/${variantTotal} variantes`),
      h('span', null, `${RECIPES.filter((r) => recipeStars(r.id) === 5).length} dominadas`)));
  const search = h('input', { class: 'recipe-search', type: 'search', placeholder: 'Buscar una receta…', 'aria-label': 'Buscar recetas', oninput: () => { query = search.value; renderList(); } });
  const stateSelect = h('select', { class: 'recipe-filter', 'aria-label': 'Filtrar recetas', onchange: () => { status = stateSelect.value; renderList(); } },
    h('option', { value: 'all' }, 'Todas'), h('option', { value: 'known' }, 'Conocidas'), h('option', { value: 'prepared' }, 'Preparadas'), h('option', { value: 'locked' }, 'Por descubrir'), h('option', { value: 'mastered' }, 'Dominadas'));
  const catBar = h('div', { class: 'recipe-categories', role: 'group', 'aria-label': 'Categorías de recetas' });
  for (const [id, label] of [['all', 'Todas'], ...Object.entries(CATEGORIES)]) catBar.append(h('button', { class: 'btn small' + (id === category ? ' primary' : ''), 'aria-pressed': String(id === category), onclick: () => {
    category = id;
    for (const button of catBar.querySelectorAll('button')) {
      const active = button.textContent === label;
      button.classList.toggle('primary', active);
      button.setAttribute('aria-pressed', String(active));
    }
    renderList();
  } }, label));
  const tools = h('div', { class: 'recipe-tools' }, h('div', { class: 'recipe-search-row' }, search, stateSelect), catBar);
  const content = h('div');
  root.append(summary, tools, content);

  function renderList() {
    tools.hidden = false;
    content.replaceChildren();
    const term = query.trim().toLocaleLowerCase('es');
    const recipes = RECIPES.filter((r) => (category === 'all' || r.cat === category)
      && (status === 'all' || status === 'known' && known(r) || status === 'prepared' && known(r) && prepared(r) || status === 'locked' && !known(r) || status === 'mastered' && known(r) && recipeStars(r.id) === 5)
      && (!term || (known(r) ? r.name + ' ' + r.desc : r.unlock.text).toLocaleLowerCase('es').includes(term)));
    if (!recipes.length) {
      content.append(h('p', { class: 'recipe-empty', role: 'status' }, 'Todavía no hay recetas en esta página. Probá otra categoría o seguí explorando Villa Nori.'));
      return;
    }
    for (const cat of Object.keys(CATEGORIES) as (keyof typeof CATEGORIES)[]) {
      // known recipes first inside each category, then the ones still to discover
      const list = recipes.filter((r) => r.cat === cat).sort((a, b) => Number(known(b)) - Number(known(a)));
      if (!list.length) continue;
      const grid = h('div', { class: 'recipe-grid' });
      for (const r of list) {
        const unlocked = known(r);
        const stars = recipeStars(r.id);
        const card = h('button', { class: 'recipe-card' + (unlocked ? '' : ' undiscovered') + (stars === 5 && unlocked ? ' mastered' : ''), 'data-recipe-id': r.id, onclick: () => { listScroll = root.closest('.panel-body')?.scrollTop ?? 0; showDetail(r.id); } },
          unlocked ? picture(r) : hiddenPicture(),
          h('b', null, unlocked ? r.name : 'Receta por descubrir'),
          h('span', { class: 'hint' }, unlocked ? `${game.save.recipesCooked[r.id] ?? 0} platos vendidos` : r.unlock.text),
          unlocked ? h('span', { class: 'mastery-stars', 'aria-label': `${stars} de 5 estrellas de dominio` }, starsText(stars)) : null,
          unlocked && stars === 5 ? h('span', { class: 'recipe-seal' }, 'Dominada') : null);
        grid.append(card);
      }
      content.append(h('h3', { class: 'recipe-category-title' }, CATEGORIES[cat]), grid);
    }
  }

  function showDetail(id: string, preserveScroll = false) {
    const scroll = root.closest('.panel-body')?.scrollTop ?? 0;
    tools.hidden = true;
    content.replaceChildren();
    const r = RECIPES_BY_ID[id];
    const back = h('button', { class: 'btn small recipe-back', onclick: () => {
      renderList();
      if (root.closest('.panel-body')) root.closest('.panel-body')!.scrollTop = listScroll;
      (content.querySelector(`[data-recipe-id="${id}"]`) as HTMLElement | null)?.focus({ preventScroll: true });
    } }, '← Volver al recetario');
    const title = h('h3', { class: 'recipe-title', tabindex: '-1' }, known(r) ? r.name : 'Receta por descubrir');
    const detail = h('article', { class: 'recipe-detail', 'data-recipe-detail': id }, back, title);
    if (!known(r)) {
      detail.append(hiddenPicture(), h('p', null, r.unlock.text), h('p', { class: 'hint' }, 'La ilustración y las notas aparecen cuando descubrís esta receta.'));
    } else {
      const record = recipeRecord(id);
      const stars = recipeStars(id);
      detail.append(h('div', { class: 'recipe-hero' }, picture(r), h('div', { class: 'col' }, h('p', null, r.desc), h('span', { class: 'hint' }, `${CATEGORIES[r.cat]} · Dificultad ${'★'.repeat(r.difficulty)} · Precio base ${r.price} monedas`), h('span', { class: 'mastery-stars' }, starsText(stars)))));
      detail.append(h('h4', null, 'Ingredientes'), h('div', { class: 'recipe-ingredients' }, ...Object.entries(r.ingredients).map(([item, amount]) => h('span', { class: 'recipe-ingredient' }, iconElement(ITEMS_BY_ID[item]?.icon ?? { type: 'blob' }), `${amount} × ${ITEMS_BY_ID[item]?.name ?? item}`))));
      detail.append(h('div', { class: 'recipe-sequence' }, ...r.steps.map((step, index) => h('span', null, `${index + 1}. ${STEPS[step.t]}`))));
      detail.append(h('h4', null, 'Tus récords'), h('div', { class: 'recipe-records' },
        stat('Mejor puntaje', record?.bestScore !== undefined ? `${record.bestScore}/100` : 'Sin registrar'),
        stat('Mejor calidad', record?.bestQuality !== undefined ? QUALITY[record.bestQuality] : 'Sin registrar'),
        stat('Hechas a mano', String(mastery(id)?.n ?? 0)),
        stat('Platos vendidos', String(game.save.recipesCooked[id] ?? 0))));
      detail.append(h('p', { class: 'hint' }, record?.bestScore !== undefined ? `Récord del día ${record.bestDay ?? '—'}. Cocinar en modo Rápido no suma dominio ni récords.` : 'Los puntajes se anotan al terminar una preparación a mano. Conservamos el dominio y los platos vendidos de partidas anteriores.'));
      detail.append(h('div', { class: 'recipe-mastery-note' }, h('b', null, stars === 5 ? '¡Receta dominada!' : 'Próxima estrella'), h('p', null, nextStarGoal(mastery(id)) ?? 'Cinco estrellas: preparación rápida perfecta y todas las presentaciones disponibles.')));
      const variants = r.variants ?? [];
      detail.append(h('h4', null, `Variantes — ${variants.filter((v) => record?.variants[v.item]).length}/${variants.length}`));
      if (!variants.length) detail.append(h('p', { class: 'hint' }, 'Esta receta conserva su preparación original.'));
      for (const variant of variants) {
        const found = record?.variants[variant.item];
        detail.append(h('div', { class: 'recipe-variant' + (found ? ' found' : '') },
          found ? picture(r, recipePresentation(id), variant.item) : iconElement(ITEMS_BY_ID[variant.item]?.icon ?? { type: 'blob' }),
          h('div', { class: 'col' }, h('b', null, found ? `${r.name} ${variant.name}` : 'Variante por descubrir'), h('span', { class: 'hint' }, found ? `${found.count} preparaciones · Récord ${found.bestScore}/100 · Extra: ${ITEMS_BY_ID[variant.item]?.name ?? variant.item}` : `Agregá ${ITEMS_BY_ID[variant.item]?.name ?? variant.item} antes de servir. Es opcional.`))));
      }
      detail.append(h('h4', null, 'Presentaciones por dominio'), h('p', { class: 'hint' }, 'Elegí el plato de esta receta. Se usa al emplatar y al servir; los estilos no cambian el puntaje ni el precio.'));
      const styles = h('div', { class: 'recipe-presentations' });
      for (const style of PRESENTATIONS) {
        const unlocked = stars >= style.stars;
        const chosen = recipePresentation(id) === style.id;
        const btn = h('button', { class: 'recipe-style' + (chosen ? ' selected' : ''), disabled: !unlocked, 'data-presentation': style.id, 'aria-pressed': String(chosen), onclick: () => {
          if (selectRecipePresentation(id, style.id)) {
            showDetail(id, true);
            (content.querySelector(`[data-presentation="${style.id}"]`) as HTMLElement)?.focus({ preventScroll: true });
          }
        } }, picture(r, style.id), h('b', null, style.name), h('span', { class: 'hint' }, chosen ? 'En uso' : unlocked ? 'Elegir' : `Se abre con ${style.stars} estrellas`), h('span', { class: 'hint' }, style.desc));
        styles.append(btn);
      }
      detail.append(styles);
    }
    content.append(detail);
    title.focus({ preventScroll: true });
    if (root.closest('.panel-body')) root.closest('.panel-body')!.scrollTop = preserveScroll ? scroll : 0;
  }

  function stat(label: string, value: string) {
    return h('div', null, h('span', { class: 'hint' }, label), h('b', null, value));
  }
  renderList();
  return root;
}
