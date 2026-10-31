/**
 * The small pieces of screen the physical kitchen needs: the fridge picker, the cutting-board reflex bar and the order tickets.
 * They leave cooking time running; action cards sit beside their station and tickets stay at the edge.
 */
import { iconCanvas, iconElement, type IconSpec } from '../art/icons';
import { lowFx } from '../core/perf';
import { h } from './dom';
import { indicatorAt, judgeCut, type CutSpec, type CutVerdict } from '../galley/cut';
import { itemLabel } from '../galley/model';
import { pinTicket, type Ticket } from '../galley/tickets';
import { settings } from '../core/settings';
import { normalizeUiScale } from '../core/uiScale';
import './galley.css';
import { followActionPanel, type ActionAnchor } from './actionPanel';

const root = () => document.getElementById('ui')!;

// ------------------------------------------------------------------ fridge picker
export interface FridgeChoice { id: string; name: string; icon: IconSpec; have: number; wanted: boolean }

let fridgeEl: HTMLElement | null = null;
let fridgeKeys: ((e: KeyboardEvent) => void) | null = null;
let stopFridgeAnchor: (() => void) | null = null;

export function fridgeOpen(): boolean { return !!fridgeEl; }

export function closeFridgePicker() {
  stopFridgeAnchor?.(); stopFridgeAnchor = null;
  fridgeEl?.remove();
  fridgeEl = null;
  if (fridgeKeys) window.removeEventListener('keydown', fridgeKeys, true);
  fridgeKeys = null;
}

export function openFridgePicker(choices: FridgeChoice[], onPick: (id: string) => void, onClose: () => void, anchor?: ActionAnchor) {
  closeFridgePicker();
  const buttons: HTMLButtonElement[] = [];
  const grid = h('div', { class: 'gl-fridge-grid', role: 'listbox', 'aria-label': 'Ingredientes de la heladera' });
  choices.forEach((c, i) => {
    const b = h('button', { type: 'button', class: 'gl-choice' + (c.wanted ? ' wanted' : ''), role: 'option', title: c.wanted ? 'Lo piden los tickets' : c.name, onclick: () => onPick(c.id) },
      h('span', { class: 'gl-choice-icon' }, iconElement(c.icon)),
      h('span', { class: 'gl-choice-name' }, c.name),
      h('span', { class: 'gl-choice-n' }, `×${c.have}`),
      i < 9 ? h('kbd', null, String(i + 1)) : null) as HTMLButtonElement;
    buttons.push(b);
    grid.append(b);
  });
  const empty = h('p', { class: 'gl-empty' }, 'La heladera está vacía. Comprá ingredientes en el almacén de Taro.');
  fridgeEl = h('div', { class: 'gl-fridge paper', role: 'dialog', 'aria-label': 'Heladera' },
    h('div', { class: 'gl-fridge-head' }, h('b', null, 'Heladera'), h('button', { type: 'button', class: 'gl-x', 'aria-label': 'Cerrar', onclick: () => { closeFridgePicker(); onClose(); } }, '✕')),
    choices.length ? grid : empty);
  root().append(fridgeEl);
  if (anchor) stopFridgeAnchor = followActionPanel(fridgeEl, anchor);
  buttons[0]?.focus({ preventScroll: true });
  fridgeKeys = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); closeFridgePicker(); onClose(); return; }
    const n = Number(e.key);
    if (n >= 1 && n <= Math.min(9, buttons.length)) { e.preventDefault(); e.stopImmediatePropagation(); onPick(choices[n - 1].id); return; }
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const cols = 4;
    const move = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowDown' ? cols : e.key === 'ArrowUp' ? -cols : 0;
    if (move && buttons.length) { e.preventDefault(); e.stopImmediatePropagation(); buttons[(Math.max(0, at) + move + buttons.length) % buttons.length].focus(); }
  };
  window.addEventListener('keydown', fridgeKeys, true);
}

// ------------------------------------------------------------------ cutting bar
export interface CutRun { cancel(): void }
let cutEl: HTMLElement | null = null;
let cutStop: (() => void) | null = null;

export function cutting(): boolean { return !!cutEl; }

/** The series in progress: verdicts so far and the run of good-or-better cuts (it resets on a miss and with every new series). */
const series = { verdicts: [] as CutVerdict[], streak: 0, best: 0 };
const GOOD = new Set<CutVerdict>(['perfect', 'good']);
const VERDICT_TEXT: Record<CutVerdict, string> = { perfect: '¡Perfecto!', good: '¡Bien!', regular: 'Regular', fail: 'Uy…' };
const SPARK_COLOR: Record<CutVerdict, string[]> = {
  perfect: ['#fff2b0', '#f2c66d', '#ffffff'], good: ['#bfe3a0', '#8fb36a', '#fff8ec'], regular: ['#d9c7a3', '#b9a385'], fail: ['#d98a7a', '#8a7a60'],
};

/**
 * The ingredient on the board, drawn on a small canvas: every cut adds a slice line and pulls the pieces slightly apart, so the
 * series visibly ends in a sliced ingredient (a bad cut leaves a ragged gap). Cheap: it redraws only on a hit.
 */
function sliceBoard(icon: IconSpec | undefined, total: number) {
  const W = 150, H = 56, SCALE = 3;
  const canvas = h('canvas', { class: 'gl-slices', width: W, height: H, 'aria-hidden': 'true' }) as HTMLCanvasElement;
  const g = canvas.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  const src = icon ? iconCanvas(icon) : null;
  const cuts: CutVerdict[] = [];
  let anim = 0;
  const draw = (spread: number) => {
    g.clearRect(0, 0, W, H);
    // a little board under it
    g.fillStyle = '#b98d5a'; g.fillRect(8, H - 8, W - 16, 6);
    g.fillStyle = '#d9b27a'; g.fillRect(8, H - 8, W - 16, 2);
    if (!src) return;
    const w = src.width * SCALE, hh = src.height * SCALE, x0 = Math.round((W - w) / 2), y0 = H - 8 - hh;
    const n = cuts.length + 1;
    const edges = Array.from({ length: n + 1 }, (_, i) => Math.round((w * i) / n));
    for (let i = 0; i < n; i++) {
      const sx = (edges[i] / SCALE), sw = (edges[i + 1] - edges[i]) / SCALE;
      const off = (i - (n - 1) / 2) * spread;
      const bad = i > 0 && (cuts[i - 1] === 'fail' || cuts[i - 1] === 'regular');
      g.drawImage(src, sx, 0, sw, src.height, Math.round(x0 + edges[i] + off), Math.round(y0 + (bad && i % 2 ? 1 : 0)), edges[i + 1] - edges[i], hh);
      // a lighter cut face on the left edge of each slice but the first
      if (i > 0) { g.fillStyle = 'rgba(255, 248, 230, .55)'; g.fillRect(Math.round(x0 + edges[i] + off), y0 + 4, 1, hh - 8); }
    }
  };
  const to = (target: number) => {
    if (lowFx()) { draw(target); return; }
    cancelAnimationFrame(anim);
    const from = 0, t0 = performance.now();
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / 160);
      draw(from + (target - from) * (1 - (1 - k) * (1 - k)));
      if (k < 1) anim = requestAnimationFrame(step);
    };
    step();
  };
  draw(0);
  return {
    canvas,
    hit(v: CutVerdict) { cuts.push(v); to(Math.min(10, 2 + cuts.length * (6 / Math.max(1, total)))); },
    stop() { cancelAnimationFrame(anim); },
  };
}

/**
 * Shows the reflex bar. The indicator bounces until the player presses (Space, E, Enter, a tap on the card or the button),
 * or the limit passes (that counts as a miss). `onDone` fires once, immediately, with the verdict.
 * Feedback: a trail behind the indicator, the zone glowing while the indicator is inside it, sparks and a flash on every hit, dots
 * for the series, a streak counter and the ingredient being sliced. With reduced motion or low effects only the dots, the streak
 * and the sliced ingredient remain (no trail, flash, sparks or shake).
 */
export function runCutBar(spec: CutSpec, label: string, onDone: (verdict: CutVerdict) => void, step?: { n: number; of: number; icon?: IconSpec }, anchor?: ActionAnchor): CutRun {
  cutStop?.();
  if (!step || step.n === 1) { series.verdicts = []; series.streak = 0; series.best = 0; }
  const fx = !lowFx();
  const indicator = h('i', { class: 'gl-ind' }, fx ? h('i', { class: 'gl-trail' }) : null);
  const zone = h('i', { class: 'gl-zone', style: { left: `${spec.start * 100}%`, width: `${spec.width * 100}%` } }, h('i', { class: 'gl-zone-core' }));
  const flash = h('i', { class: 'gl-flash' });
  const verdict = h('div', { class: 'gl-verdict', 'aria-live': 'assertive' }, '');
  const press = h('button', { type: 'button', class: 'btn primary gl-press' }, '¡Cortar!');
  const total = step?.of ?? 1;
  const pips = Array.from({ length: total }, (_, i) => h('i', { class: 'gl-pip' + (series.verdicts[i] ? ' ' + series.verdicts[i] : i === series.verdicts.length ? ' now' : '') }));
  const streak = h('span', { class: 'gl-streak' + (series.streak >= 2 ? ' on' : ''), 'aria-hidden': 'true' }, series.streak >= 2 ? `×${series.streak}` : '');
  const board = sliceBoard(step?.icon, total);
  // replay the cuts already made in this series so the ingredient keeps its slices between bars
  for (const v of series.verdicts) board.hit(v);
  const bar = h('div', { class: 'gl-bar' }, zone, indicator, flash);
  const sparks = h('div', { class: 'gl-sparks', 'aria-hidden': 'true' });
  cutEl = h('div', { class: 'gl-cut paper', role: 'dialog', 'aria-label': `Cortar ${label}` },
    h('div', { class: 'gl-cut-title' }, `Cortar ${label}`, step ? h('span', { class: 'gl-cut-step' }, ` · corte ${step.n} de ${step.of}`) : null, streak),
    board.canvas,
    h('div', { class: 'gl-pips', 'aria-hidden': 'true' }, ...pips),
    h('div', { class: 'gl-bar-wrap' }, bar, sparks),
    verdict, press);
  root().append(cutEl);
  if (anchor) followActionPanel(cutEl, anchor);
  const el = cutEl;
  const t0 = performance.now();
  let raf = 0;
  let done = false;
  let last = 0;
  const burst = (v: CutVerdict, pos: number) => {
    if (!fx) return;
    const colors = SPARK_COLOR[v];
    const n = v === 'perfect' ? 14 : v === 'good' ? 8 : 4;
    for (let i = 0; i < n; i++) {
      const dot = h('i', { class: 'gl-spark', style: { left: `${pos * 100}%`, background: colors[i % colors.length] } });
      const a = -Math.PI * (0.1 + Math.random() * 0.8), d = 14 + Math.random() * (v === 'perfect' ? 44 : 28);
      dot.style.setProperty('--dx', `${Math.round(Math.cos(a) * d)}px`);
      dot.style.setProperty('--dy', `${Math.round(Math.sin(a) * d)}px`);
      sparks.append(dot);
      window.setTimeout(() => dot.remove(), 520);
    }
    if (v === 'perfect') { const ring = h('i', { class: 'gl-ring', style: { left: `${pos * 100}%` } }); sparks.append(ring); window.setTimeout(() => ring.remove(), 520); }
  };
  const finish = (v: CutVerdict, pos: number) => {
    if (done) return;
    done = true;
    cancelAnimationFrame(raf);
    window.removeEventListener('keydown', keys, true);
    series.verdicts.push(v);
    series.streak = GOOD.has(v) ? series.streak + 1 : 0;
    series.best = Math.max(series.best, series.streak);
    verdict.textContent = VERDICT_TEXT[v] + (series.streak >= 2 ? `  ×${series.streak}` : '');
    verdict.className = 'gl-verdict show ' + v;
    indicator.style.left = `${pos * 100}%`;
    pips[series.verdicts.length - 1]?.setAttribute('class', 'gl-pip hit ' + v);
    pips[series.verdicts.length]?.classList.add('now');
    el.classList.add('done', 'hit-' + v);
    board.hit(v);
    burst(v, pos);
    onDone(v);
    window.setTimeout(() => { board.stop(); el.remove(); if (cutEl === el) cutEl = null; }, step && step.n < step.of ? 260 : 520);
  };
  const frame = () => {
    const t = (performance.now() - t0) / 1000;
    if (t >= spec.limit) { finish('fail', indicatorAt(t, spec.speed)); return; }
    const pos = indicatorAt(t, spec.speed);
    indicator.style.left = `${pos * 100}%`;
    if (fx) {
      // the trail points back along the way the indicator came; the zone lights up while it is inside
      const fwd = pos >= last;
      indicator.classList.toggle('fwd', fwd); indicator.classList.toggle('back', !fwd);
      zone.classList.toggle('hot', pos >= spec.start && pos <= spec.start + spec.width);
    }
    last = pos;
    raf = requestAnimationFrame(frame);
  };
  const stop = () => {
    const t = (performance.now() - t0) / 1000;
    const pos = indicatorAt(t, spec.speed);
    finish(judgeCut(pos, spec), pos);
  };
  const keys = (e: KeyboardEvent) => {
    if (![' ', 'Enter', 'e', 'E', 'ArrowDown'].includes(e.key) || e.repeat) return;
    e.preventDefault(); e.stopImmediatePropagation();
    stop();
  };
  window.addEventListener('keydown', keys, true);
  el.addEventListener('pointerdown', (e) => { e.preventDefault(); stop(); });
  raf = requestAnimationFrame(frame);
  const cancel = () => { if (done) return; done = true; cancelAnimationFrame(raf); board.stop(); window.removeEventListener('keydown', keys, true); el.remove(); if (cutEl === el) cutEl = null; };
  cutStop = cancel;
  return { cancel };
}

/** Best run of good-or-better cuts of the series that just ended (for a closing flourish). */
export const lastCutStreak = (): number => series.best;

// ------------------------------------------------------------------ tickets
let ticketsEl: HTMLElement | null = null;
let ticketsKey = '';
/** tickets the player opened to read the ingredients */
const ticketsExpanded = new Set<string>();
/** The orders fold into a small chip ("Pedidos 3 ▾") so they do not cover the kitchen; the choice is remembered. */
let ticketsOpen = (() => { try { return localStorage.getItem('mm_ticketsopen') === '1'; } catch { return false; } })();

export function showTickets(list: Ticket[], visible: boolean, hint: string | null) {
  if (!visible || (!list.length && !hint)) { ticketsEl?.classList.add('hidden'); return; }
  const key = JSON.stringify(list.map((t) => [t.id, t.lines.map((l) => [l.recipe, l.waiting, l.ready]), Math.round(t.patience * 20), t.impatient, !!t.pinned, t.lines.map((l) => l.needs.map((n) => n.have ?? 0))])) + (hint ?? '') + ticketsOpen + [...ticketsExpanded].join(',');
  if (!ticketsEl) { ticketsEl = h('div', { class: 'gl-tickets', 'aria-label': 'Pedidos de la cocina' }); root().append(ticketsEl); }
  ticketsEl.classList.remove('hidden');
  // sit right under the round buttons (the mission line is on the other side), wherever they end up on this screen
  const below = ['.hud-buttons'].map((q) => document.querySelector<HTMLElement>(q)).filter((el): el is HTMLElement => !!el && el.offsetParent !== null).reduce((m, el) => Math.max(m, el.getBoundingClientRect().bottom), 0);
  const scale = normalizeUiScale(settings.uiScale);
  if (below > 0) ticketsEl.style.top = `${Math.round((below + 3) / scale)}px`;
  // as wide as the round buttons: from the bag to the pause button
  const btns = [...document.querySelectorAll<HTMLElement>('.hud-buttons .icon-btn')].filter((el) => el.offsetParent !== null);
  if (btns.length) {
    const left = Math.min(...btns.map((b) => b.getBoundingClientRect().left)), right = Math.max(...btns.map((b) => b.getBoundingClientRect().right));
    ticketsEl.style.left = `${Math.round(left / scale)}px`; ticketsEl.style.width = `${Math.round((right - left) / scale)}px`; ticketsEl.style.right = 'auto';
  }
  if (key === ticketsKey) return;
  ticketsKey = key;
  const pending = list.filter((t) => !t.done).length;
  const late = list.some((t) => t.impatient && !t.done);
  const chip = list.length ? h('button', {
    type: 'button', class: 'gl-orders-chip paper' + (late ? ' late' : ''), 'aria-expanded': String(ticketsOpen), 'aria-label': `Pedidos: ${pending} pendientes`,
    onclick: () => {
      ticketsOpen = !ticketsOpen;
      try { localStorage.setItem('mm_ticketsopen', ticketsOpen ? '1' : '0'); } catch { /* ignore */ }
      ticketsKey = '';
      showTickets(list, visible, hint);
    },
  }, h('b', null, 'Pedidos'), h('span', { class: 'gl-count' }, String(pending || list.length)), h('span', { class: 'gl-caret', 'aria-hidden': 'true' }, ticketsOpen ? '▴' : '▾')) : null;
  /** " · 3/4 piezas" when part of what the line needs is already prepared in the kitchen */
  const prepared = (l: Ticket['lines'][number]) => {
    let have = 0, total = 0;
    for (const n of l.needs) { total += n.count * Math.max(1, l.waiting); have += Math.min(n.have ?? 0, n.count * Math.max(1, l.waiting)); }
    return have > 0 ? ` · ${have}/${total} piezas` : '';
  };
  const needChips = (l: Ticket['lines'][number]) => [...(l.cup ? [h('span', { class: 'gl-need cup' }, 'Vaso')] : []),
    ...l.needs.map((n) => {
      const total = n.count * Math.max(1, l.waiting), have = Math.min(n.have ?? 0, total);
      const label = `${n.count > 1 ? n.count + '× ' : ''}${itemLabel({ kind: 'ing', uid: 0, ing: n.ing, form: n.form, q: 2 })}`;
      // ✓ ready / ½ part ready: a mark as well as a tone, so it reads without colour
      return h('span', { class: 'gl-need' + (have >= total ? ' ready' : have ? ' part' : ''), title: have >= total ? 'Ya está preparado' : have ? `Preparado ${have} de ${total}` : 'Falta preparar' }, (have >= total ? '✓ ' : have ? `${have}/${total} ` : '') + label);
    })];
  const cards = ticketsOpen ? list.slice(0, 3).map((t) => {
    const open = ticketsExpanded.has(t.id);
    return h('div', {
      class: 'gl-ticket paper' + (t.pinned ? ' pinned' : '') + (t.done ? ' done' : '') + (t.impatient ? ' late' : '') + (open ? ' open' : ''), role: 'button', tabindex: '0', 'aria-expanded': String(open),
      onclick: () => { if (open) ticketsExpanded.delete(t.id); else ticketsExpanded.add(t.id); ticketsKey = ''; showTickets(list, visible, hint); },
    },
      h('div', { class: 'gl-ticket-head' }, h('b', null, t.label), h('span', { class: 'hint' }, t.favourite ? t.who + ' · su favorito' : t.who),
        t.done ? null : h('button', { type: 'button', class: 'gl-pin' + (t.pinned ? ' on' : ''), 'aria-pressed': String(!!t.pinned), title: t.pinned ? 'Dejar de priorizar' : 'Cocinar este primero',
          onclick: (e: Event) => { e.stopPropagation(); pinTicket(t.id); ticketsKey = ''; showTickets(list, visible, hint); } }, t.pinned ? '★ Primero' : '☆'),
        h('span', { class: 'gl-caret', 'aria-hidden': 'true' }, open ? '▴' : '▾')),
      ...t.lines.map((l) => h('div', { class: 'gl-line' },
        h('span', { class: 'gl-qty' }, `${l.waiting + l.ready}×`),
        h('span', { class: 'gl-name' }, (t.favourite === l.recipe ? '♥ ' : '') + l.name),
        h('span', { class: 'gl-state' + (l.waiting ? '' : ' ok') }, l.waiting ? (l.ready ? `${l.ready} listo` : 'pendiente') + prepared(l) : '✓ en el mostrador'),
        open ? h('div', { class: 'gl-needs' }, ...needChips(l)) : null)),
      h('div', { class: 'gl-patience', role: 'img', 'aria-label': `Paciencia ${Math.round(t.patience * 100)}%` }, h('i', { style: { width: `${Math.round(t.patience * 100)}%` } })));
  }) : [];
  const more = ticketsOpen && list.length > 3 ? [h('div', { class: 'gl-more' }, `+${list.length - 3} más`)] : [];
  ticketsEl.replaceChildren(...(chip ? [chip] : []), ...cards, ...more, ...(hint ? [h('div', { class: 'gl-hint paper' }, hint)] : []));
}

// ------------------------------------------------------------------ tutorial card
let tutEl: HTMLElement | null = null;
let tutKey = '';

/** The lesson card: which dish, which step of how many, and what to do now. `null` hides it. */
export function showTutorial(card: { dish: string; n: number; of: number; text: string; done?: boolean } | null, onSkip: () => void) {
  if (!card) { tutEl?.remove(); tutEl = null; tutKey = ''; return; }
  const key = `${card.dish}|${card.n}|${card.text}`;
  if (tutEl && key === tutKey) return;
  tutKey = key;
  tutEl?.remove();
  tutEl = h('div', { class: 'gl-tut paper', role: 'status', 'aria-live': 'polite' },
    h('div', { class: 'gl-tut-head' }, h('b', null, card.done ? 'Primera lección' : `Lección · ${card.dish}`), h('span', { class: 'hint' }, card.done ? '' : `${card.n} / ${card.of}`)),
    h('p', null, card.text),
    card.done ? null : h('button', { type: 'button', class: 'btn small', onclick: onSkip }, 'Omitir lección'));
  root().append(tutEl);
}

export function removeGalleyUi() {
  showTutorial(null, () => {});
  closeFridgePicker();
  cutStop?.();
  cutEl?.remove(); cutEl = null;
  ticketsEl?.remove(); ticketsEl = null; ticketsKey = '';
}

