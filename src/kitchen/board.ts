/**
 * The preparation board: ONE continuous table for every step of a dish (the stove is a separate station).
 * Nori is dragged to the mat, rice is spread with real strokes (a coverage mask), fillings go where the hand drops
 * them, the roll advances only with a slow, real gesture, the knife cuts along subtle marks, and every piece is
 * plated by hand. Recipes, orders, ingredients and the 0|1|2 quality are the same as before.
 */
import { haptic } from '../core/haptics';
import { iconElement } from '../art/icons';
import { cookingIngredient, drawCookingPlate, kitchenOval } from '../art/cooking';
import { audio } from '../audio/audio';
import type { Track } from '../audio/audio';
import { settings } from '../core/settings';
import { game } from '../core/state';
import { ITEMS_BY_ID } from '../data/items';
import { RECIPES_BY_ID, type CookStep, type RecipeDef } from '../data/recipes';
import { h, openModal } from '../ui/dom';
import { recipePresentation } from '../restaurant/recipeCollection';
import { challengeLimit, judgeCook } from '../restaurant/cookScore';
import { doneness } from '../restaurant/grill';
import { QUICK_STARS, recipeStars } from '../restaurant/mastery';
import { RICE_H, RICE_W, newMask, riceScore, riceStats, spread, type RiceMask } from './rice';
import { PRESS_SECONDS, newRoll, rollStep, rollScore, type PointerKind, type RollState } from './roll';
import { knifeMove, newMarks, pieceLayout, cutScore, type Mark } from './cut';
import { autoSpots, plateScore, settle, type PlateShape } from './plating';
import {
  NORI, RICE_C, drawBowl, drawHand, drawKnifeAt, drawMat, drawNori, drawPiece, drawPlateDeco, drawRiceBall, drawRiceMask, drawRoll, drawShelfBoard, drawStrip, drawTable,
  hash, ingColor, ingLight, rect, type G, type PieceLook, type R,
} from './art';

import type { DishBoard } from './types';
export interface CookResult { ok: boolean; quality: 0 | 1 | 2; score: number; variant?: string; variantItem?: string; variantBonus: number; /** active seconds spent, hard mode only */ seconds?: number; hard?: boolean; }

/** Where an embedded board lives (the multi-dish kitchen) and how it talks back to it. */
export interface CookHost {
  el: HTMLElement;
  onBack: () => void;
  /** switches the kitchen to the griddle station */
  goGrill: () => void;
  /** what the stove says about this dish's piece right now (for the waiting board) */
  status: (game: DishBoard, item: string) => { text: string; p: number } | null;
}

const STEP_NAMES: Record<CookStep['t'], string> = {
  nori: 'Alga', rice: 'Arroz', place: 'Relleno', slice: 'Cortar', roll: 'Enrollar', cut: 'Porciones',
  shape: 'Moldear', top: 'Cubrir', wrap: 'Envolver', cone: 'Cono', garnish: 'Decorar', cook: 'Cocinar', plate: 'Emplatar',
};
const LABELS: Record<string, string> = { nori: 'Alga', rice: 'Arroz', deco_wasabi: 'Wasabi', deco_ginger: 'Jengibre', deco_sauce: 'Salsa' };
const SHEET_W = 150, SHEET_H = 76, ROLL_R = 12;

type Mode = 'wait' | 'nori' | 'ricedrop' | 'rice' | 'flip' | 'place' | 'slice' | 'roll' | 'press' | 'garnish' | 'cut' | 'stand' | 'shape' | 'top' | 'wrap' | 'cone' | 'plate' | 'done';
interface Fill { id: string; x: number; y: number; len: number; seed: number }
interface Piece extends PieceLook { x: number; y: number; plated: boolean; ready: number; hold: number; molded: boolean }
interface Slice { id: string; x: number; w: number; used: boolean }
interface ShelfItem { id: string; left: number }
interface Bit { x: number; y: number; vx: number; vy: number; t: number; c: string }

const nameOf = (id: string) => LABELS[id] ?? ITEMS_BY_ID[id]?.name ?? id;

/** Starts cooking. Ingredients must already be consumed by the caller. */
export function cook(recipeId: string, title = ''): Promise<CookResult> {
  return new Promise((resolve) => {
    new KitchenBoard(RECIPES_BY_ID[recipeId], title, (r) => resolve(r)).start();
  });
}

export class KitchenBoard {
  private root!: HTMLElement; private canvas!: HTMLCanvasElement; private g!: G;
  private msg!: HTMLElement; private feedback!: HTMLElement; private progressEl!: HTMLElement; private stepsEl!: HTMLElement; private timerEl!: HTMLElement;
  private actionBtn!: HTMLButtonElement; private undoBtn!: HTMLButtonElement; private trashBtn!: HTMLButtonElement; private quickBtn!: HTMLButtonElement;
  private close!: () => void;
  private stageResize: ResizeObserver | null = null;
  private W = 320; private H = 240; private S = 1;
  private mat!: R; private sheet!: R; private plate!: PlateShape;
  private stepIdx = 0; private mode: Mode = 'nori';
  private done = false; private active = true; private raf = 0; private lastFrame = 0; private startT = performance.now(); private pausedAt = 0;
  private musicBefore: Track = 'none'; private timeLimit = 0;
  private mistakes = 0; private prec: number[] = [];
  private cookRaw: { item: string; how: 'plancha' | 'sarten' | 'olla' }[] = [];
  private needPot = false; private riceReady = false; private waitItem: string | null = null;
  private cookedPieces: { item: string; p: number }[] = [];
  private variant: { item: string; name: string; bonus: number } | null = null; private variantUsed = false;
  // table state
  private noriPlaced = false; private flipped = false; private flipT = 0; private uramaki = false;
  private mask: RiceMask = newMask(); private riceBall = false; private riceTotal = 1;
  private fills: Fill[] = []; private needPlace: string[] = [];
  private roll: RollState = newRoll(); private rolling: { y: number; t: number; vy: number } | null = null; private bend = 0; private rollCy = 0; private rollDone = false; private rollEase = 0;
  private rollFills: string[] = []; private toppings: { id: string; x: number; seed: number }[] = []; private needGarnish: string[] = [];
  private marks: Mark[] = []; private knife: { x: number; y: number; px: number } | null = null; private cutKind: 'roll' | 'fish' = 'roll'; private pieceCount = 0;
  private fish: { id: string; slices: Slice[]; x: number; y: number; w: number; h: number } | null = null;
  private standT = 0; private pieces: Piece[] = []; private decos: { id: string; x: number; y: number; seed: number }[] = [];
  private needShape = 0;
  private cone = 0; private coneDrag: { x: number; y: number; t: number } | null = null;
  private drag: { id: string; x: number; y: number; piece?: Piece; slice?: Slice } | null = null;
  private ptr: { id: number; kind: PointerKind } | null = null; private handAt: { x: number; y: number } | null = null;
  private sub = { rice: 0, fill: 0.85, roll: 1, cut: 1, plate: 1 }; private quick = false;
  private shelf: ShelfItem[] = [];
  private bits: Bit[] = []; private sparkles: { x: number; y: number; t: number }[] = [];
  private feedbackUntil = 0; private advanceAt = 0; private sfxAt = 0; private revealTimer = 0;
  private finishNow: (() => void) | null = null; private clock = 0;

  constructor(private r: RecipeDef, private title: string, private finish: (r: CookResult) => void, private host?: CookHost) {}

  // ------------------------------------------------------------------ public contract (used by the kitchen session and the stove)
  get recipe() { return this.r; }
  get rawPieces() { return this.cookRaw; }
  takeRaw(i: number) { return this.cookRaw.splice(i, 1)[0] ?? null; }
  putCooked(item: string, p: number) { this.cookedPieces.push({ item, p }); this.tryCook(); }
  get waitingFor(): string | null { return !this.done && this.mode === 'wait' ? this.waitItem : null; }
  get customer() { return this.title; }
  get finished() { return this.done; }
  get progress() { return this.done ? 1 : this.stepIdx / Math.max(1, this.r.steps.length); }
  get stepName() { return this.done ? '¡Listo!' : STEP_NAMES[this.step?.t ?? 'plate']; }
  private get step(): CookStep { return this.r.steps[this.stepIdx]; }

  setActive(on: boolean) {
    if (this.done || on === this.active) return;
    this.active = on;
    if (!on) { this.pausedAt = performance.now(); cancelAnimationFrame(this.raf); this.root.style.display = 'none'; }
    else { this.startT += performance.now() - this.pausedAt; this.lastFrame = 0; this.root.style.display = ''; this.resize(); this.loop(); }
  }
  discard() { if (this.done) return; this.done = true; this.cleanup(); }

  // ------------------------------------------------------------------ layout and DOM
  private layout() {
    const matW = Math.min(184, this.W - 16);
    this.mat = { x: Math.round((this.W - matW) / 2), y: 46, w: matW, h: 108 };
    this.sheet = { x: this.mat.x + Math.round((matW - SHEET_W) / 2), y: this.mat.y + 16, w: SHEET_W, h: SHEET_H };
    const below = this.H - (this.mat.y + this.mat.h);
    this.plate = { cx: this.W / 2, cy: this.mat.y + this.mat.h + Math.round(below / 2) + 1, rx: Math.min(88, this.W / 2 - 8), ry: Math.min(34, Math.round(below / 2) - 3) };
    this.rollCy = this.mat.y + this.mat.h / 2 - 4;
  }

  start() {
    if (window.innerHeight > window.innerWidth * 1.15) { this.W = 220; this.H = 300; }
    this.layout();
    this.timeLimit = settings.cookMode === 'challenge' ? challengeLimit(this.r.steps.length) : 0;
    this.cookRaw = this.r.steps.flatMap((st) => (st.t === 'cook' ? [{ item: st.item, how: st.how }] : []));
    // in the kitchen the rice of each dish is cooked in the pot, a batch at a time (alone on the board there is no pot)
    this.needPot = !!this.host && this.r.steps.some((st) => st.t === 'rice' || st.t === 'shape');
    if (this.needPot) this.cookRaw.unshift({ item: 'rice', how: 'olla' });
    const ri = this.r.steps.findIndex((s) => s.t === 'roll'), gi = this.r.steps.findIndex((s) => s.t === 'garnish'), ci = this.r.steps.findIndex((s) => s.t === 'cut');
    this.uramaki = ri >= 0 && gi > ri && ci > gi;
    if (!this.host) { this.musicBefore = audio.currentTrack(); audio.crossfade('kitchen'); }
    this.stepsEl = h('div', { class: 'cook-steps' });
    this.timerEl = h('div', { class: 'pill' });
    this.msg = h('div', { class: 'cook-msg', id: 'cook-instruction' });
    this.progressEl = h('b', { class: 'cook-progress' });
    this.feedback = h('div', { class: 'cook-feedback', role: 'status', 'aria-live': 'polite' });
    this.canvas = h('canvas', { class: 'board', 'aria-label': 'Mesa de preparación de sushi', 'aria-describedby': 'cook-instruction' }) as HTMLCanvasElement;
    const stage = h('div', { class: 'cook-stage' }, this.canvas);
    const instruction = h('div', { class: 'cook-instruction' }, this.progressEl, h('div', { class: 'cook-guidance' }, this.msg, this.feedback));
    const head = h('div', { class: 'cook-head' },
      h('div', { class: 'cook-order' }, iconElement(this.r.icon), h('div', { class: 'col', style: { gap: '2px' } }, h('b', null, this.r.name + (this.title ? ` — ${this.title}` : '')), this.stepsEl)),
      h('div', { class: 'col', style: { alignItems: 'flex-end', gap: '4px' } }, this.timerEl, this.host ? null : h('button', { class: 'close-x', 'aria-label': 'Salir', onclick: () => this.abort() }, '✕')));
    this.actionBtn = h('button', { class: 'btn primary', onclick: () => this.onAction() }) as HTMLButtonElement;
    this.undoBtn = h('button', { class: 'btn small', title: 'Saca lo último que pusiste', onclick: () => this.undoLast() }, 'Sacar último') as HTMLButtonElement;
    this.trashBtn = h('button', { class: 'btn small', title: 'Tirá lo de este paso y empezá de nuevo', onclick: () => this.trash() }, '🗑 Tacho') as HTMLButtonElement;
    this.quickBtn = h('button', { class: 'btn small', title: 'Ya dominás este plato: emplatá en un toque', onclick: () => this.quickPlate() }, '⚡ Emplatar rápido') as HTMLButtonElement;
    const tools = h('div', { class: 'cook-tools cook-bar' }, this.actionBtn, this.undoBtn, this.trashBtn, this.quickBtn);
    this.root = h('div', { class: 'cook' }, head, instruction, stage, h('div', { class: 'cook-trayrow' }, tools));
    if (this.host) { this.host.el.append(this.root); this.close = () => this.root.remove(); }
    else { this.close = openModal(this.root); (this.root as any).__close = () => this.abort(); }
    this.g = this.canvas.getContext('2d')!;
    this.bindInput();
    this.resize();
    window.addEventListener('resize', this.resize);
    this.variant = this.r.variants?.find((vv) => game.countUsable(vv.item) > 0) ?? null;
    if (import.meta.env.DEV) (window as any).__board = this;
    this.enterStep();
    this.stageResize = new ResizeObserver(this.resize);
    this.stageResize.observe(stage);
    this.loop();
  }

  private resize = () => {
    const stage = this.canvas.parentElement!;
    const rw = stage.clientWidth, rh = stage.clientHeight;
    // the board fills the stage: drawn at an integer scale (no seams), shown with crisp nearest-neighbour stretching
    const fit = Math.max(0.2, Math.min(rw / this.W, rh / this.H, 6));
    this.S = Math.max(1, Math.floor(fit));
    const cw = Math.round(this.W * fit), ch = Math.round(this.H * fit);
    this.canvas.width = this.W * this.S; this.canvas.height = this.H * this.S;
    this.canvas.style.width = cw + 'px'; this.canvas.style.height = ch + 'px';
    this.canvas.style.left = Math.round((rw - cw) / 2) + 'px'; this.canvas.style.top = Math.round((rh - ch) / 2) + 'px';
    this.g.setTransform(this.S, 0, 0, this.S, 0, 0);
    this.g.imageSmoothingEnabled = false;
  };

  private renderSteps() {
    this.stepsEl.innerHTML = '';
    this.r.steps.forEach((s, i) => this.stepsEl.append(h('span', { class: 's' + (i < this.stepIdx || this.done ? ' done' : i === this.stepIdx ? ' now' : ''), 'aria-current': i === this.stepIdx && !this.done ? 'step' : null }, STEP_NAMES[s.t])));
    this.progressEl.textContent = this.done ? '¡Listo!' : `${this.stepIdx + 1}/${this.r.steps.length}`;
  }
  private say(t: string) { this.msg.textContent = t; }
  private respond(text: string, kind: 'good' | 'gentle' = 'good') {
    this.feedback.textContent = text; this.feedback.dataset.kind = kind; this.feedback.classList.add('visible'); this.feedbackUntil = performance.now() + 1300;
  }
  private elapsed() { return (performance.now() - this.startT) / 1000; }
  private puff(x: number, y: number, c: string, n = 7) {
    if (settings.reduceMotion) return;
    for (let i = 0; i < n; i++) this.bits.push({ x, y, vx: (Math.random() - 0.5) * 50, vy: -Math.random() * 40 - 8, t: 0, c });
  }
  private sfx(name: string, gap = 0) {
    const now = performance.now();
    if (gap && now - this.sfxAt < gap) return;
    this.sfxAt = now; audio.sfxPlay(name);
  }
  private tol() { return (settings.cookMode === 'relaxed' ? 1.5 : settings.cookMode === 'challenge' ? 0.8 : 1.1) * (this.ptr?.kind === 'touch' ? 1.3 : 1); }

  // ------------------------------------------------------------------ steps
  private nextStep() { this.stepIdx++; this.enterStep(); }
  private later(sec: number, fn: () => void) { const at = this.clock + sec; this.advanceAt = at; this.pending = fn; }
  private pending: (() => void) | null = null;

  /** takes a cooked piece of `item` that came off the stove: its doneness counts for the dish */
  private useCooked(item: string): boolean {
    const i = this.cookedPieces.findIndex((c) => c.item === item);
    if (i < 0) return false;
    const d = doneness(this.cookedPieces.splice(i, 1)[0].p);
    this.prec.push(d.score);
    if (d.mistake) this.mistakes++;
    if (item === 'rice') this.riceReady = true;
    this.respond(item === 'rice' ? `Arroz: ${d.label.toLowerCase()}` : d.label, d.mistake ? 'gentle' : 'good');
    return true;
  }
  private tryCook() {
    if (this.done || this.mode !== 'wait' || !this.waitItem) return;
    if (!this.useCooked(this.waitItem)) return;
    const wasCook = this.step?.t === 'cook';
    this.waitItem = null;
    if (wasCook) this.nextStep(); else this.enterStep();
  }

  private setShelf(items: ShelfItem[]) { this.shelf = items; }
  private count(ids: string[]): ShelfItem[] {
    const m = new Map<string, number>(); ids.forEach((i) => m.set(i, (m.get(i) ?? 0) + 1));
    return [...m].map(([id, left]) => ({ id, left }));
  }

  private enterStep() {
    this.drag = null; this.pending = null; this.advanceAt = 0;
    this.renderSteps();
    const s = this.step;
    if (!s) return this.beginPlateOrFinish();
    if ((s.t === 'rice' || s.t === 'shape') && this.needPot && !this.riceReady && !this.useCooked('rice')) {
      this.mode = 'wait'; this.waitItem = 'rice'; this.setShelf([]);
      this.say('Falta el arroz: ponelo en la olla (pestaña Plancha). Mientras se cocina podés seguir con otros platos.');
      this.syncUI(); return;
    }
    switch (s.t) {
      case 'cook':
        if (!this.host) { setTimeout(() => this.nextStep(), 0); return; }
        this.mode = 'wait'; this.waitItem = s.item; this.setShelf([]); this.say('Esto se cocina en la plancha. Ponelo allá y volvé cuando esté en su punto; mientras tanto podés avanzar con otros platos.');
        this.syncUI();
        setTimeout(() => this.tryCook(), 0);
        break;
      case 'nori': this.mode = 'nori'; this.setShelf([{ id: 'nori', left: 1 }]); this.say('Arrastrá el alga hasta la esterilla.'); break;
      case 'rice': this.mode = 'ricedrop'; this.setShelf([{ id: 'rice', left: 1 }]); this.say('Llevá el arroz sobre el alga.'); break;
      case 'place':
        this.mode = 'place'; this.needPlace = [...s.items]; this.setShelf(this.count(s.items));
        this.say(this.noriPlaced ? 'Arrastrá cada ingrediente sobre el arroz. Cae donde lo sueltes.' : 'Arrastrá cada ingrediente sobre el arroz.');
        break;
      case 'roll':
        this.mode = this.roll.progress >= 1 ? 'press' : 'roll'; this.setShelf([]);
        this.say('Arrastrá hacia arriba, despacio, para enrollar con la esterilla.');
        break;
      case 'garnish':
        this.needGarnish = [...s.items]; this.mode = 'garnish'; this.setShelf(this.count(s.items));
        this.say(this.rollDone && !this.pieces.length ? 'Poné los ingredientes por encima del rollo.' : 'Arrastrá cada ingrediente sobre las piezas.');
        break;
      case 'cut': this.startCut(s.pieces); break;
      case 'slice': this.startSlice(s.item, this.hasKnifeUpgrade() ? Math.max(1, s.cuts - 1) : s.cuts); break;
      case 'shape':
        this.mode = 'shape'; this.needShape = s.count; this.setShelf([{ id: 'rice', left: s.count }]);
        this.say('Llevá un poco de arroz a la mesa y mantené apretado para moldear.');
        break;
      case 'top': this.mode = 'top'; this.setShelf([{ id: s.item, left: 99 }]); this.say('Poné la cobertura sobre cada bolita (también podés usar las láminas de la mesa).'); break;
      case 'wrap': this.mode = 'wrap'; this.setShelf([{ id: 'nori', left: 99 }]); this.say('Arrastrá una tira de alga sobre cada pieza.'); break;
      case 'cone': this.mode = 'cone'; this.cone = 0; this.roll = newRoll(); this.setShelf([]); this.say('Arrastrá en diagonal, de abajo a la izquierda hacia arriba a la derecha, para armar el cono.'); break;
      case 'plate': this.beginPlateOrFinish(); return;
    }
    this.syncUI();
  }

  private hasKnifeUpgrade() { return game.save.restaurant.upgrades.includes('knife'); }

  private beginPlateOrFinish() {
    this.mode = 'plate'; this.drag = null;
    // a dish that never made pieces (should not happen) still gets one
    if (!this.pieces.length) this.pieces.push(this.makePiece(this.W / 2, this.rollCy, 0));
    this.pieces.forEach((p, i) => { if (!p.plated) { p.y = this.mat.y + this.mat.h * 0.55; p.x = this.rowX(i, this.pieces.length); } });
    const decor: ShelfItem[] = [{ id: 'deco_wasabi', left: 1 }, { id: 'deco_ginger', left: 1 }];
    if (this.variant && !this.variantUsed) decor.unshift({ id: this.variant.item, left: 1 });
    this.setShelf(decor);
    this.say('Llevá cada pieza al plato. Después podés sumar un detalle (opcional).');
    this.syncUI();
  }
  private rowX(i: number, n: number) {
    const gap = Math.min(21, (this.mat.w - 20) / Math.max(1, n));
    return this.W / 2 + (i - (n - 1) / 2) * gap;
  }

  private startCut(pieces: number) {
    this.mode = 'cut'; this.cutKind = 'roll'; this.pieceCount = pieces; this.marks = newMarks(pieces); this.setShelf([]); this.knife = null;
    if (!this.rollDone) { this.rollDone = true; this.roll.progress = 1; }
    this.rollEase = 0;
    this.say('Cortá siguiendo las marcas: arrastrá el cuchillo hacia abajo sobre cada una. Primero el medio.');
  }
  private startSlice(item: string, cuts: number) {
    this.mode = 'slice'; this.cutKind = 'fish'; this.marks = newMarks(cuts + 1); this.setShelf([]); this.knife = null; this.pieceCount = cuts + 1;
    const w = 128, hh = 30;
    this.fish = { id: item, slices: [], x: this.W / 2 - w / 2, y: this.mat.y + 40, w, h: hh };
    this.say('Cortá el pescado en láminas: arrastrá el cuchillo hacia abajo sobre cada marca.');
  }

  private makePiece(x: number, y: number, i: number): Piece {
    const kind: Piece['kind'] = this.r.id === 'onigiri' ? 'onigiri' : this.r.id === 'gunkan' ? 'gunkan' : this.cutKind === 'roll' || this.cone ? (this.cone ? 'cone' : 'maki') : 'nigiri';
    return { kind, fills: [...new Set(this.rollFills)], outer: this.uramaki ? 'rice' : 'nori', deco: [], seed: 7 + i * 13.3, x, y, plated: false, ready: 0, hold: 0, molded: false };
  }

  // ------------------------------------------------------------------ UI state (buttons)
  private syncUI() {
    const m = this.mode;
    const hasItems = (m === 'place' && this.fills.length > 0) || (m === 'garnish' && (this.toppings.length > 0 || this.decos.length > 0 || this.pieces.some((p) => p.deco.length)));
    this.undoBtn.disabled = !hasItems;
    this.trashBtn.disabled = !(hasItems || m === 'rice');
    this.undoBtn.style.display = m === 'place' || m === 'garnish' ? '' : 'none';
    this.trashBtn.style.display = m === 'place' || m === 'garnish' || m === 'rice' ? '' : 'none';
    this.quickBtn.style.display = m === 'plate' && recipeStars(this.r.id) >= QUICK_STARS ? '' : 'none';
    let label = '', show = true, disabled = false;
    if (m === 'rice') { const st = riceStats(this.mask); label = st.ok ? 'Listo el arroz' : `Arroz ${Math.round(st.coverage * 100)}%`; disabled = !st.ok; }
    else if (m === 'flip') label = 'Dar vuelta el alga';
    else if (m === 'place') { label = this.needPlace.length ? `Faltan ${this.needPlace.length}` : 'Listo el relleno'; disabled = this.needPlace.length > 0; }
    else if (m === 'garnish') { label = this.needGarnish.length ? `Faltan ${this.needGarnish.length}` : 'Listo'; disabled = this.needGarnish.length > 0; }
    else if (m === 'plate') { const left = this.pieces.filter((p) => !p.plated).length; label = left ? `Faltan ${left} piezas` : 'Servir'; disabled = left > 0; }
    else if (m === 'wait' && this.host) label = this.waitItem === 'rice' ? 'Ir a la olla' : 'Ir a la plancha';
    else show = false;
    this.actionBtn.style.display = show ? '' : 'none'; this.actionBtn.textContent = label; this.actionBtn.disabled = disabled;
  }

  private onAction() {
    if (this.done) return;
    if (this.mode === 'wait') this.host?.goGrill();
    else if (this.mode === 'rice') { const st = riceStats(this.mask); if (st.ok) this.finishRice(); }
    else if (this.mode === 'flip') this.flip();
    else if (this.mode === 'place' && !this.needPlace.length) this.finishPlace();
    else if (this.mode === 'garnish' && !this.needGarnish.length) { this.nextStep(); }
    else if (this.mode === 'plate' && this.pieces.every((p) => p.plated)) this.complete();
  }

  private undoLast() {
    if (this.mode === 'place' && this.fills.length) { const f = this.fills.pop()!; this.needPlace.push(f.id); this.setShelf(this.count(this.needPlace)); this.sub.fill = 0.85; }
    else if (this.mode === 'garnish') {
      if (this.toppings.length) { const t = this.toppings.pop()!; this.needGarnish.push(t.id); }
      else { const p = [...this.pieces].reverse().find((q) => q.deco.length); if (p) this.needGarnish.push(p.deco.pop()!); else return; }
      this.setShelf(this.count(this.needGarnish));
    } else return;
    this.sfx('tap'); this.respond('Lo sacaste: ponelo de nuevo', 'gentle'); this.syncUI();
  }
  private trash() {
    if (this.mode === 'rice') { this.mask = newMask(); this.riceBall = false; this.mode = 'ricedrop'; this.setShelf([{ id: 'rice', left: 1 }]); this.say('Llevá el arroz sobre el alga.'); }
    else if (this.mode === 'place' && this.fills.length) { this.fills = []; this.needPlace = [...(this.step as Extract<CookStep, { t: 'place' }>).items]; this.setShelf(this.count(this.needPlace)); }
    else if (this.mode === 'garnish') { const s = this.step as Extract<CookStep, { t: 'garnish' }>; this.toppings = []; this.pieces.forEach((p) => { p.deco = []; }); this.needGarnish = [...s.items]; this.setShelf(this.count(this.needGarnish)); }
    else return;
    this.mistakes++; this.sfx('tap'); this.respond('Al tacho. ¡Otra vez!', 'gentle'); this.syncUI();
  }
  private quickPlate() {
    if (this.mode !== 'plate') return;
    const spots = autoSpots(this.pieces.length, this.plate, this.pieceSize());
    this.pieces.forEach((p, i) => { p.x = spots[i].x; p.y = spots[i].y; p.plated = true; });
    this.sub.plate = 0.85; this.quick = true;
    this.puff(this.plate.cx, this.plate.cy, '#fff1c5', 10); this.sfx('place'); this.complete();
  }
  private pieceSize() { return this.pieces[0]?.kind === 'nigiri' || this.pieces[0]?.kind === 'gunkan' ? 19 : 18; }

  // ------------------------------------------------------------------ rice, filling and the roll
  private finishRice() {
    const st = riceStats(this.mask);
    this.sub.rice = riceScore(st); this.prec.push(this.sub.rice);
    this.respond(st.coverage > 0.9 ? '¡Arroz bien parejo!' : 'Arroz listo', 'good'); this.sfx('place');
    if (this.uramaki) { this.mode = 'flip'; this.say('Es un uramaki: el arroz va por fuera. Dale vuelta al alga.'); this.syncUI(); }
    else this.nextStep();
  }
  private flip() {
    this.flipped = true; this.flipT = 0; this.sfx('place'); this.puff(this.sheet.x + this.sheet.w / 2, this.sheet.y + this.sheet.h / 2, '#fff1c5', 8);
    this.nextStep();
  }
  private finishPlace() {
    const s = this.step as Extract<CookStep, { t: 'place' }>; void s;
    this.rollFills = [...new Set(this.fills.map((f) => f.id))];
    // fillings should lie near the middle of the sheet, in a band the roll will wrap
    const mid = this.sheet.y + this.sheet.h / 2;
    const off = this.fills.length ? this.fills.reduce((a, f) => a + Math.abs(f.y - mid), 0) / this.fills.length : 0;
    this.sub.fill = Math.max(0, 1 - off / (this.sheet.h * 0.42));
    this.prec.push(this.sub.fill);
    this.nextStep();
  }

  private dropOnTable(id: string, x: number, y: number, fromSlice?: Slice): boolean {
    const inMat = x > this.mat.x - 6 && x < this.mat.x + this.mat.w + 6 && y > this.mat.y - 6 && y < this.mat.y + this.mat.h + 6;
    const sh = this.sheet, inSheet = x > sh.x - 4 && x < sh.x + sh.w + 4 && y > sh.y - 4 && y < sh.y + sh.h + 4;
    switch (this.mode) {
      case 'nori':
        if (!inMat) return false;
        this.noriPlaced = true; this.puff(sh.x + sh.w / 2, sh.y + sh.h / 2, '#63805a'); this.sfx('place'); this.nextStep(); return true;
      case 'ricedrop':
        if (!inSheet) return false;
        this.riceBall = true; this.riceTotal = this.mask.left; this.mode = 'rice'; this.setShelf([]);
        this.say('Frotá con la mano, de lado a lado o en círculos, para extender el arroz por toda el alga.'); this.sfx('place');
        this.puff(x, y, '#fbf7ee'); this.syncUI(); return true;
      case 'place': {
        if (this.pieces.some((p) => p.kind === 'onigiri')) { // onigiri: the filling goes into the ball
          const b = this.nearest(x, y, 22, (p) => !p.fills.length); if (!b) return false;
          const k = this.needPlace.indexOf(id); if (k < 0) return false; this.needPlace.splice(k, 1);
          b.fills.push(id); this.dropShelf(id); this.sfx('place'); this.puff(b.x, b.y, ingColor(id)); if (!this.needPlace.length) setTimeout(() => this.finishPlace(), 450); this.syncUI(); return true;
        }
        if (!inSheet) return false;
        const i = this.needPlace.indexOf(id); if (i < 0) return false;
        this.needPlace.splice(i, 1);
        const jitter = (hash(this.fills.length * 5.7 + 1) - 0.5) * 6;
        this.fills.push({ id, x: Math.min(sh.x + sh.w - 6, Math.max(sh.x + 6, x)), y: Math.min(sh.y + sh.h - 6, Math.max(sh.y + 6, y)) + jitter * 0.3, len: Math.round(sh.w * (0.78 + hash(this.fills.length * 3.1) * 0.16)), seed: this.fills.length * 11.3 });
        this.dropShelf(id); this.sfx('place'); this.puff(x, y, ingColor(id), 5);
        if (!this.needPlace.length) this.respond('Todo en su lugar', 'good');
        this.syncUI(); return true;
      }
      case 'garnish': {
        if (this.needGarnish.indexOf(id) < 0) return false;
        if (this.rollDone && !this.pieces.length) {
          if (Math.abs(y - this.rollCy) > ROLL_R + 10 || x < this.mat.x || x > this.mat.x + this.mat.w) return false;
          this.toppings.push({ id, x: Math.min(sh.x + sh.w - 12, Math.max(sh.x + 12, x)), seed: this.toppings.length * 4.7 + 2 });
        } else {
          const p = this.nearest(x, y, 22); if (!p) return false;
          p.deco.push(id);
        }
        this.needGarnish.splice(this.needGarnish.indexOf(id), 1); this.dropShelf(id);
        this.sfx('place'); this.puff(x, y, ingColor(id), 5); this.syncUI();
        if (!this.needGarnish.length) this.respond('Bien decorado', 'good');
        return true;
      }
      case 'shape': {
        if (id !== 'rice' || !inMat) return false;
        if (this.pieces.length >= this.needShape) return false;
        const n = this.needShape, i = this.pieces.length;
        const p = this.makePiece(this.rowX(i, n), this.mat.y + this.mat.h * 0.62, i); p.kind = this.r.id === 'onigiri' ? 'onigiri' : this.r.id === 'gunkan' ? 'gunkan' : 'nigiri'; p.fills = []; p.outer = 'rice';
        this.pieces.push(p); this.dropShelf('rice'); this.sfx('place'); this.puff(p.x, p.y, '#fbf7ee'); return true;
      }
      case 'top': {
        const p = this.nearest(x, y, 24, (q) => !q.top && q.molded); if (!p) return false;
        p.top = id; if (fromSlice) fromSlice.used = true;
        this.sfx('place'); this.puff(p.x, p.y - 4, ingColor(id), 6);
        if (this.pieces.every((q) => q.top)) this.later(0.5, () => this.nextStep());
        return true;
      }
      case 'wrap': {
        const p = this.nearest(x, y, 24, (q) => !q.wrapped && q.molded); if (!p) return false;
        p.wrapped = true; this.sfx('roll'); this.puff(p.x, p.y, '#63805a', 5);
        if (this.pieces.every((q) => q.wrapped)) this.later(0.5, () => this.nextStep());
        return true;
      }
      case 'plate': {
        if (!(id.startsWith('deco_') || this.variant?.item === id)) return false;
        const pl = this.plate;
        if (((x - pl.cx) / pl.rx) ** 2 + ((y - pl.cy) / pl.ry) ** 2 > 1.2) return false;
        this.decos.push({ id, x: Math.max(pl.cx - pl.rx + 14, Math.min(pl.cx + pl.rx - 14, x)), y: Math.max(pl.cy - pl.ry + 9, Math.min(pl.cy + pl.ry - 6, y)), seed: this.decos.length * 3 });
        if (this.variant?.item === id) { this.variantUsed = true; this.respond(`¡Variante ${this.variant.name}!`); }
        this.dropShelf(id); this.sfx('place'); this.puff(x, y, ingColor(id), 4); return true;
      }
    }
    return false;
  }
  private dropShelf(id: string) { const s = this.shelf.find((i) => i.id === id); if (s && s.left < 90) s.left = Math.max(0, s.left - 1); }
  private nearest(x: number, y: number, max: number, ok: (p: Piece) => boolean = () => true): Piece | null {
    let best: Piece | null = null, bd = max;
    for (const p of this.pieces) { if (!ok(p)) continue; const d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; best = p; } }
    return best;
  }

  private rollFinished() {
    this.rollDone = true; this.mode = 'press'; this.rolling = null;
    this.say('Mantené apretado el rollo un momento para compactarlo.'); this.sfx('roll'); this.syncUI();
  }
  private pressDone() {
    this.sub.roll = rollScore(this.roll, true); this.prec.push(this.sub.roll);
    this.puff(this.W / 2, this.rollCy, '#fff1c5', 9); this.sfx('success'); haptic('light' as any);
    this.nextStep();
  }

  // ------------------------------------------------------------------ cutting
  private startKnife(x: number, y: number) { this.knife = { x, y, px: x }; }
  private cutRect(): R {
    return this.cutKind === 'fish' && this.fish ? { x: this.fish.x, y: this.fish.y, w: this.fish.w, h: this.fish.h } : { x: this.sheet.x, y: this.rollCy - ROLL_R, w: this.sheet.w, h: ROLL_R * 2 };
  }
  private moveKnife(x: number, y: number) {
    const k = this.knife; if (!k) return;
    const cr = this.cutRect(), dy = y - k.y;
    const xn = (x - cr.x) / cr.w, tol = (this.cutKind === 'fish' ? 0.07 : 0.05) * this.tol();
    // the blade must be over the piece to bite
    if (y > cr.y - 10 && y < cr.y + cr.h + 12 && dy > 0) {
      const hit = knifeMove(this.marks, xn, dy / Math.max(10, cr.h), tol);
      this.sfx('cut', 80);
      if (hit >= 0) this.onCutDone(hit);
    }
    k.x = x; k.y = y;
  }
  private onCutDone(i: number) {
    const cr = this.cutRect();
    this.puff(cr.x + this.marks[i].x * cr.w, cr.y + cr.h / 2, '#fbf7ee', 4); haptic('light' as any);
    if (this.marks.every((m) => m.done >= 1)) {
      this.sub.cut = cutScore(this.marks, 0.05 * this.tol()); this.prec.push(this.sub.cut);
      this.knife = null;
      if (this.cutKind === 'fish') {
        const f = this.fish!; const lay = pieceLayout(this.pieceCount, this.marks, f.w, 3);
        f.slices = lay.map((p) => ({ id: f.id, x: this.W / 2 + p.x, w: p.w, used: false }));
        this.respond('Láminas parejas', 'good'); this.later(0.5, () => this.nextStep());
      } else {
        this.mode = 'stand'; this.standT = 0; this.respond(this.sub.cut > 0.8 ? '¡Cortes limpios!' : 'Piezas listas', 'good');
        this.sfx('success');
      }
      this.setShelf([]);
    }
  }
  private finishStand() {
    const lay = pieceLayout(this.pieceCount, this.marks, this.sheet.w, 3);
    this.pieces = lay.map((_p, i) => { const pc = this.makePiece(this.rowX(i, lay.length), this.rollCy, i); pc.molded = true; pc.outer = this.uramaki ? 'rice' : 'nori'; if (this.toppings[0]) pc.top = this.toppings[i % this.toppings.length].id; return pc; });
    this.nextStep();
  }

  // ------------------------------------------------------------------ input
  private toBoard(e: PointerEvent) {
    const r = this.canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * this.W, y: ((e.clientY - r.top) / r.height) * this.H };
  }
  private shelfAt(x: number, y: number): ShelfItem | null {
    if (y > 44 || !this.shelf.length) return null;
    const n = this.shelf.length, cell = Math.min(52, this.W / n);
    const i = Math.floor((x - (this.W - cell * n) / 2) / cell);
    const it = this.shelf[i]; return it && it.left > 0 ? it : null;
  }
  private bindInput() {
    const c = this.canvas; c.style.touchAction = 'none';
    c.addEventListener('pointerdown', (e) => {
      try { c.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
      if (this.mode === 'done') { this.finishNow?.(); return; }
      if (this.ptr || this.done) return;
      this.ptr = { id: e.pointerId, kind: (e.pointerType as PointerKind) || 'mouse' };
      const p = this.toBoard(e); this.onDown(p.x, p.y, e.timeStamp / 1000);
    });
    c.addEventListener('pointermove', (e) => { if (!this.ptr || e.pointerId !== this.ptr.id) return; const p = this.toBoard(e); this.onMove(p.x, p.y, e.timeStamp / 1000); });
    const up = (e: PointerEvent) => { if (!this.ptr || e.pointerId !== this.ptr.id) return; const p = this.toBoard(e); this.onUp(p.x, p.y); this.ptr = null; };
    c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
  }

  private onDown(x: number, y: number, t: number) {
    const it = this.shelfAt(x, y);
    if (it) { this.drag = { id: it.id, x, y }; this.sfx('tap'); return; }
    switch (this.mode) {
      case 'rice': if (this.inSheet(x, y, 8)) { this.handAt = { x, y }; } break;
      case 'roll': if (x > this.mat.x - 8 && x < this.mat.x + this.mat.w + 8 && y > this.mat.y - 10 && y < this.mat.y + this.mat.h + 10) this.rolling = { y, t, vy: 0 }; break;
      case 'press': if (Math.abs(y - this.rollCy) < ROLL_R + 12) { this.roll.pressed = true; this.roll.pressT = 0; } break;
      case 'cut': case 'slice': this.startKnife(x, y); break;
      case 'cone': if (this.inSheet(x, y, 14)) this.coneDrag = { x, y, t }; break;
      case 'shape': { const p = this.pieces.find((q) => !q.molded && Math.hypot(q.x - x, q.y - y) < 16); if (p) p.hold = 0.0001; break; }
      case 'top': {
        const f = this.fish; if (f) { const s = f.slices.find((q) => !q.used && Math.abs(q.x - x) < q.w / 2 + 6 && Math.abs(this.mat.y + 18 - y) < 12); if (s) this.drag = { id: s.id, x, y, slice: s }; }
        break;
      }
      case 'plate': {
        let best: Piece | null = null, bd = 13;
        for (const p of this.pieces) { const d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; best = p; } }
        if (best) { this.drag = { id: 'piece', x, y, piece: best }; this.sfx('tap'); }
        break;
      }
    }
  }
  private inSheet(x: number, y: number, m = 0) { const s = this.sheet; return x > s.x - m && x < s.x + s.w + m && y > s.y - m && y < s.y + s.h + m; }

  private onMove(x: number, y: number, t: number) {
    if (this.drag) { this.drag.x = x; this.drag.y = y; if (this.drag.piece) { this.drag.piece.x = x; this.drag.piece.y = y; } }
    switch (this.mode) {
      case 'rice': if (this.handAt) {
        const s = this.sheet;
        const lo = this.handAt, a = { x: Math.min(1, Math.max(0, (lo.x - s.x) / s.w)), y: Math.min(1, Math.max(0, (lo.y - s.y) / s.h)) }, b = { x: Math.min(1, Math.max(0, (x - s.x) / s.w)), y: Math.min(1, Math.max(0, (y - s.y) / s.h)) };
        if (this.inSheet(x, y, 4) && spread(this.mask, a.x, a.y, b.x, b.y, 0.07)) { this.sfx('rice', 90); }
        this.handAt = { x, y }; this.syncUI();
        if (riceStats(this.mask).coverage >= 0.93) this.later(0.4, () => { if (this.mode === 'rice') this.finishRice(); });
      } break;
      case 'roll': if (this.rolling) {
        const r = this.rolling, dt = t - r.t;
        if (dt >= 0.035) {
          const dy = (r.y - y) / SHEET_H;
          const verdict = rollStep(this.roll, dy, dt, this.ptr?.kind ?? 'mouse');
          r.vy = dy / dt; this.bend = Math.min(1, Math.abs(r.vy) * 1.2);
          if (verdict === 'fast') this.say('¡Más despacio! La esterilla se arruga si apurás.');
          else if (verdict === 'slow' && dy > 0) this.say('Seguí subiendo, con ritmo parejo.');
          else this.say('Así, despacito y parejo.');
          if (dy > 0.002) this.sfx('roll', 160);
          r.y = y; r.t = t;
          if (this.roll.progress >= 1) this.rollFinished();
        }
      } break;
      case 'cut': case 'slice': this.moveKnife(x, y); break;
      case 'cone': if (this.coneDrag) {
        const s = this.sheet, dt = t - this.coneDrag.t;
        if (dt >= 0.035) {
          const ux = s.w, uy = -s.h, L = Math.hypot(ux, uy);
          const d = ((x - this.coneDrag.x) * ux + (y - this.coneDrag.y) * uy) / (L * L);
          const verdict = rollStep(this.roll, d * 1.4, dt, this.ptr?.kind ?? 'mouse'); this.cone = this.roll.progress;
          if (verdict === 'fast') this.say('¡Más despacio, que se rompe el alga!');
          this.coneDrag = { x, y, t }; if (d > 0) this.sfx('roll', 160);
          if (this.cone >= 1) this.coneFinished();
        }
      } break;
    }
  }

  private onUp(x: number, y: number) {
    this.handAt = null; this.rolling = null; this.coneDrag = null; this.bend = 0; this.roll.pressed = false; this.roll.pressT = 0;
    this.pieces.forEach((p) => { if (!p.molded) p.hold = 0; });
    if (this.knife) this.knife = null;
    const d = this.drag; this.drag = null;
    if (!d) return;
    if (d.piece) {
      const p = d.piece, others = this.pieces.filter((q) => q !== p && q.plated);
      const q = settle({ x, y }, others, this.plate, this.pieceSize());
      if (q) { p.x = q.x; p.y = q.y; p.plated = true; this.sfx('place'); this.puff(p.x, p.y + 4, '#fff1c5', 4); }
      else { p.plated = false; p.y = this.mat.y + this.mat.h * 0.55; p.x = this.rowX(this.pieces.indexOf(p), this.pieces.length); }
      this.syncUI(); return;
    }
    if (!this.dropOnTable(d.id, x, y, d.slice)) { if (y > 44) this.respond('Ahí no va', 'gentle'); }
  }

  private coneFinished() {
    this.coneDrag = null; this.sub.roll = rollScore(this.roll, true); this.prec.push(this.sub.roll);
    this.rollFills = [...new Set(this.fills.map((f) => f.id))];
    const pc = this.makePiece(this.W / 2, this.mat.y + this.mat.h * 0.55, 0); pc.kind = 'cone'; pc.fills = this.rollFills; pc.molded = true; this.pieces = [pc];
    this.sfx('success'); this.puff(this.W / 2, this.rollCy, '#fff1c5', 9); this.nextStep();
  }

  // ------------------------------------------------------------------ loop
  private loop = () => {
    if (!this.active || (this.done && this.mode !== 'done')) return;
    const now = performance.now(), dt = this.lastFrame ? Math.min(0.1, (now - this.lastFrame) / 1000) : 0.016;
    this.lastFrame = now; this.update(dt); this.draw();
    this.raf = requestAnimationFrame(this.loop);
  };

  private update(dt: number) {
    this.clock += dt;
    if (this.pending && this.clock >= this.advanceAt) { const f = this.pending; this.pending = null; f(); }
    if (this.feedbackUntil && performance.now() > this.feedbackUntil) { this.feedback.classList.remove('visible'); this.feedbackUntil = 0; }
    if (this.timeLimit && this.mode !== 'done') { const left = Math.max(0, this.timeLimit - this.elapsed()); this.timerEl.textContent = `⏱ ${Math.ceil(left)}s`; this.timerEl.classList.toggle('warn', left < 10); }
    if (this.flipped && this.flipT < 1) this.flipT = Math.min(1, this.flipT + dt * 2.5);
    this.rollEase += (1 - this.rollEase) * Math.min(1, dt * 6);
    if (this.mode === 'press' && this.roll.pressed) {
      this.roll.pressT += dt;
      if (this.roll.pressT >= PRESS_SECONDS) this.pressDone();
    }
    if (this.mode === 'stand') { this.standT += dt; if (this.standT >= 0.7) this.finishStand(); }
    if (this.mode === 'shape') for (const p of this.pieces) if (p.hold > 0 && !p.molded) {
      p.hold += dt; if (this.clock % 0.2 < dt) this.sfx('rice', 150);
      if (p.hold >= 0.7) { p.molded = true; p.hold = 0; this.sfx('place'); this.puff(p.x, p.y, '#fbf7ee', 6); this.prec.push(0.9); if (this.pieces.filter((q) => q.molded).length >= this.needShape) this.later(0.5, () => this.nextStep()); }
    }
    if (this.mode === 'wait') {
      const st = this.waitItem ? this.host?.status(this, this.waitItem) : null;
      this.say(st ? st.text : this.waitItem === 'rice' ? 'Falta el arroz: ponelo en la olla.' : 'Esto se cocina en la plancha. Ponelo allá y volvé cuando esté en su punto.');
    }
    for (const b of this.bits) { b.t += dt; b.x += b.vx * dt; b.y += b.vy * dt; b.vy += 120 * dt; }
    this.bits = this.bits.filter((b) => b.t < 0.7);
    for (const s of this.sparkles) s.t += dt;
    this.sparkles = this.sparkles.filter((s) => s.t < 1);
  }

  // ------------------------------------------------------------------ drawing
  private draw() {
    const g = this.g, W = this.W, H = this.H;
    drawTable(g, W, H);
    this.drawShelf(g);
    drawMat(g, this.mat);
    this.drawWork(g);
    if (this.mode === 'plate' || this.mode === 'done' || this.pieces.some((p) => p.plated)) this.drawPlate(g);
    this.drawPieces(g);
    this.drawOverlay(g);
    for (const b of this.bits) { g.globalAlpha = Math.max(0, 1 - b.t / 0.7); rect(g, b.x, b.y, 2, 2, b.c); }
    g.globalAlpha = 1;
    for (const s of this.sparkles) { const a = 1 - s.t; g.globalAlpha = a; rect(g, s.x - 1, s.y - 5 * s.t - 1, 3, 3, '#fff1c5'); rect(g, s.x, s.y - 5 * s.t - 3, 1, 7, '#ffe08a'); }
    g.globalAlpha = 1;
  }

  private drawShelf(g: G) {
    drawShelfBoard(g, this.W, 44);
    const n = this.shelf.length; if (!n) { g.fillStyle = '#d9b98a'; g.font = '8px monospace'; g.textBaseline = 'top'; g.fillText(this.hint(), 6, 17); return; }
    const cell = Math.min(52, this.W / n), x0 = (this.W - cell * n) / 2;
    this.shelf.forEach((it, i) => {
      const cx = Math.round(x0 + cell * i + cell / 2);
      drawBowl(g, cx, 20, it.id.startsWith('deco_') ? null : cookingIngredient(it.id), it.left > 90 ? 0 : it.left, it.left <= 0);
      if (it.id.startsWith('deco_')) { g.save(); g.translate(0, 0); drawPlateDeco(g, it.id, cx, 19, 1); g.restore(); }
      g.fillStyle = '#f3e3c3'; g.font = '7px monospace'; g.textAlign = 'center'; g.textBaseline = 'top'; g.fillText(nameOf(it.id).slice(0, 9), cx, 35); g.textAlign = 'left';
    });
  }
  private hint(): string {
    switch (this.mode) {
      case 'rice': return 'Frotá el arroz sobre el alga';
      case 'roll': return 'Arrastrá hacia arriba, despacio';
      case 'press': return 'Mantené apretado el rollo';
      case 'cut': case 'slice': return 'Cuchillo: arrastrá hacia abajo';
      case 'shape': return 'Mantené apretado para moldear';
      case 'cone': return 'Arrastrá en diagonal';
      case 'plate': return 'Llevá cada pieza al plato';
      case 'wait': return 'Esperando la cocina';
      default: return '';
    }
  }

  private sheetDrawRect(): R { return this.sheet; }

  private drawWork(g: G) {
    const sh = this.sheetDrawRect(), m = this.mode;
    const showSheet = this.noriPlaced && !this.rollDone && !this.pieces.length && this.cone < 1;
    if (showSheet && this.cone === 0) {
      const flat = Math.round(sh.h * (1 - this.roll.progress));
      if (this.roll.progress < 1) {
        // flipping shows the rice side swap
        const sx = this.flipped && this.flipT < 1 ? Math.abs(Math.cos(this.flipT * Math.PI)) : 1;
        const flatRect = { x: sh.x + (sh.w * (1 - sx)) / 2, y: sh.y, w: Math.max(2, sh.w * sx), h: Math.max(0, flat) };
        if (flatRect.h > 0) {
          g.save(); g.beginPath(); g.rect(flatRect.x, flatRect.y, flatRect.w, flatRect.h); g.clip();
          const shown = { x: flatRect.x, y: sh.y, w: flatRect.w, h: sh.h };
          if (this.flipped) { drawRiceMask(g, { ...shown }, this.mask, 3); drawNori(g, { ...shown, h: sh.h }, 2); }
          else {
            drawNori(g, shown, 1);
            if (this.riceBall || this.mask.travel > 0) {
              drawRiceMask(g, shown, this.mask, 1);
              // the rice never reaches the very edge: a thin border of nori stays visible
              rect(g, shown.x, shown.y, shown.w, 2, NORI); rect(g, shown.x, shown.y, 2, shown.h, NORI); rect(g, shown.x + shown.w - 2, shown.y, 2, shown.h, NORI); rect(g, shown.x, shown.y + shown.h - 2, shown.w, 2, NORI);
            }
          }
          g.restore();
          if (this.flipped && this.flipT >= 0.5) { rect(g, shown.x, shown.y, shown.w, 2, '#f0ecdc'); }
          this.drawFills(g, flat);
        }
        if (this.riceBall && m === 'rice' && this.mask.travel < 3) drawRiceBall(g, sh.x + sh.w / 2, sh.y + sh.h / 2, Math.max(4, 11 * (this.mask.left / this.riceTotal)));
        if (this.roll.progress > 0) this.drawRolling(g, sh, flat);
      } else this.drawRolling(g, sh, 0);
    }
    if (this.rollDone && !this.pieces.length) this.drawFinishedRoll(g);
    if (m === 'slice' || this.fish) this.drawFish(g);
    if (this.cone > 0 && this.pieces.length === 0) this.drawConeFold(g);
    if (m === 'wait') this.drawWait(g);
  }

  private drawFills(g: G, flat: number) {
    const sh = this.sheet;
    // fillings that fall in the part already rolled disappear under the roll
    for (const f of this.fills) { if (f.y - sh.y > flat + 2) continue; drawStrip(g, f.id, f.x - (f.x - (sh.x + sh.w / 2)) * 0.3, f.y, f.len, f.seed); }
  }

  private drawRolling(g: G, sh: R, flat: number) {
    const p = this.roll.progress, r = Math.round(3 + p * (ROLL_R - 3));
    const settle = this.rollDone ? this.rollEase : 0;
    const cy = Math.round(sh.y + flat + r * 0.4 + (this.rollCy - (sh.y + r * 0.4)) * settle * 0);
    const ro = { x: sh.x, w: sh.w, cy: p >= 1 ? this.rollCy : cy, r };
    drawRoll(g, ro, { outer: this.uramaki ? 'rice' : 'nori', fills: [...new Set(this.fills.map((f) => f.id))], seed: 2 });
    if (!this.rollDone || this.mode === 'press') {
      // the bamboo mat wraps the roll and bends with the hand
      const b = Math.round(this.bend * 3);
      for (let x = ro.x; x < ro.x + ro.w; x += 3) {
        const off = Math.round(Math.sin(((x - ro.x) / ro.w) * Math.PI) * b);
        rect(g, x, ro.cy - r - 1 - off, 2, r * 2 + 3, 'rgba(214,187,130,.88)');
        rect(g, x + 2, ro.cy - r - 1 - off, 1, r * 2 + 3, 'rgba(139,107,63,.6)');
      }
      rect(g, ro.x + 14, ro.cy - r - 2, 2, r * 2 + 4, '#f1ead2'); rect(g, ro.x + ro.w - 15, ro.cy - r - 2, 2, r * 2 + 4, '#f1ead2');
    }
    if (this.mode === 'press' && this.roll.pressed) { const k = Math.min(1, this.roll.pressT / PRESS_SECONDS); rect(g, ro.x, ro.cy + r + 3, Math.round(ro.w * k), 2, '#ffe08a'); }
  }

  private drawFinishedRoll(g: G) {
    const ro = { x: this.sheet.x, w: this.sheet.w, cy: this.rollCy, r: ROLL_R };
    const standing = this.mode === 'stand' ? Math.min(1, this.standT / 0.7) : 0;
    if (this.mode === 'stand') {
      const lay = pieceLayout(this.pieceCount, this.marks, this.sheet.w, 3 + standing * 8);
      lay.forEach((p, i) => {
        const cx = this.W / 2 + p.x;
        if (standing < 0.55) drawRoll(g, { x: cx - p.w / 2, w: p.w, cy: this.rollCy, r: ROLL_R }, { outer: this.uramaki ? 'rice' : 'nori', fills: this.rollFills, seed: 2 + i, shadow: false });
        else drawPiece(g, { kind: 'maki', fills: this.rollFills, outer: this.uramaki ? 'rice' : 'nori', deco: [], seed: 7 + i * 13.3 }, cx, this.rollCy, 8);
      });
      return;
    }
    const lay = this.mode === 'cut' ? pieceLayout(this.pieceCount, this.marks, this.sheet.w, 1.4) : null;
    if (lay) lay.forEach((p, i) => drawRoll(g, { x: this.W / 2 + p.x - p.w / 2, w: Math.max(1, p.w), cy: this.rollCy, r: ROLL_R }, { outer: this.uramaki ? 'rice' : 'nori', fills: this.rollFills, seed: 2 + i, shadow: i === 0 }));
    else drawRoll(g, ro, { outer: this.uramaki ? 'rice' : 'nori', fills: this.rollFills, seed: 2 });
    // toppings lie along the top of the roll
    for (const t of this.toppings) drawStrip(g, t.id, t.x, this.rollCy - ROLL_R - 3, 34, t.seed, 5);
    if (this.mode === 'cut') {
      for (const mk of this.marks) {
        const x = Math.round(this.sheet.x + mk.x * this.sheet.w);
        if (mk.done < 1) for (let y = this.rollCy - ROLL_R - 6; y < this.rollCy + ROLL_R + 6; y += 4) rect(g, x, y, 1, 2, 'rgba(255,240,200,.55)');
        else rect(g, x, this.rollCy - ROLL_R, 1, ROLL_R * 2, 'rgba(0,0,0,.4)');
        if (mk.done > 0 && mk.done < 1) rect(g, x, this.rollCy - ROLL_R, 1, Math.round(ROLL_R * 2 * mk.done), '#7a1f1f');
      }
    }
  }

  private drawFish(g: G) {
    const f = this.fish; if (!f) return;
    if (this.mode === 'slice') {
      const c = ingColor(f.id), l = ingLight(f.id);
      const segs = pieceLayout(this.pieceCount, this.marks, f.w, 2.4);
      segs.forEach((s, i) => {
        const x = Math.round(this.W / 2 + s.x - s.w / 2);
        kitchenOval(g, x + s.w / 2 + 1, f.y + f.h + 1, s.w / 2 + 1, 3, 'rgba(0,0,0,.28)');
        rect(g, x, f.y, s.w, f.h, c); rect(g, x, f.y, s.w, 2, l); rect(g, x, f.y + f.h - 3, s.w, 3, 'rgba(0,0,0,.25)');
        for (let k = 0; k < 5; k++) rect(g, x + 2 + hash(i * 7 + k) * Math.max(1, s.w - 6), f.y + 4 + hash(i + k * 3) * (f.h - 10), 5, 1, l);
      });
      for (const mk of this.marks) {
        const x = Math.round(f.x + mk.x * f.w);
        if (mk.done < 1) for (let y = f.y - 6; y < f.y + f.h + 6; y += 4) rect(g, x, y, 1, 2, 'rgba(255,240,200,.55)');
        if (mk.done > 0 && mk.done < 1) rect(g, x, f.y, 1, Math.round(f.h * mk.done), '#7a1f1f');
      }
    } else {
      // slices wait on the back of the table
      f.slices.forEach((s) => { if (!s.used) drawStrip(g, s.id, s.x, this.mat.y + 14, Math.max(14, Math.min(26, s.w)), s.x, 7); });
    }
  }

  private coneArt: HTMLCanvasElement | null = null;
  private drawConeFold(g: G) {
    const s = this.sheet, p = this.cone, cx = this.W / 2, cy = this.mat.y + this.mat.h * 0.5;
    if (!this.coneArt) {
      const c = document.createElement('canvas'); c.width = s.w; c.height = s.h;
      const k = c.getContext('2d')!; k.imageSmoothingEnabled = false;
      const r = { x: 0, y: 0, w: s.w, h: s.h };
      drawNori(k, r, 5); drawRiceMask(k, r, this.mask, 1);
      rect(k, 0, 0, s.w, 2, NORI); rect(k, 0, 0, 2, s.h, NORI); rect(k, s.w - 2, 0, 2, s.h, NORI); rect(k, 0, s.h - 2, s.w, 2, NORI);
      for (const f of this.fills) drawStrip(k, f.id, f.x - s.x, f.y - s.y, f.len, f.seed);
      this.coneArt = c;
    }
    g.save(); g.translate(cx, cy); g.rotate(-0.6 * p); g.scale(1 - 0.55 * p, 1 - 0.5 * p);
    g.drawImage(this.coneArt, -s.w / 2, -s.h / 2);
    g.restore();
  }

  private drawWait(g: G) {
    const cx = this.W / 2, cy = this.mat.y + this.mat.h / 2;
    if (this.waitItem === 'rice') { kitchenOval(g, cx, cy + 8, 30, 12, '#3a3a3f'); rect(g, cx - 30, cy - 12, 60, 20, '#8e9aa3'); rect(g, cx - 30, cy - 12, 60, 3, '#c7d2d8'); kitchenOval(g, cx, cy - 12, 30, 7, '#b4bec5'); kitchenOval(g, cx, cy - 13, 27, 5, '#ede7d4'); rect(g, cx - 40, cy - 6, 10, 3, '#5b4636'); rect(g, cx + 30, cy - 6, 10, 3, '#5b4636'); }
    else { kitchenOval(g, cx, cy + 6, 40, 14, '#2b2b2b'); kitchenOval(g, cx, cy + 3, 38, 12, '#4a4a4a'); kitchenOval(g, cx, cy + 2, 32, 9, '#1f1f1f'); }
    const st = this.waitItem ? this.host?.status(this, this.waitItem) : null;
    if (st) { rect(g, cx - 30, cy + 26, 60, 4, '#2b2236'); rect(g, cx - 29, cy + 27, Math.round(58 * Math.max(0, Math.min(1, st.p))), 2, '#ffd36b'); }
  }

  private drawPieces(g: G) {
    const sorted = [...this.pieces].filter((p) => p !== this.drag?.piece);
    for (const p of sorted) {
      const mold = !p.molded && p.hold > 0 ? Math.min(1, p.hold / 0.7) : 1;
      if (!p.molded) { drawRiceBall(g, p.x, p.y, Math.round(6 + 4 * mold)); if (p.hold > 0) { rect(g, p.x - 10, p.y + 10, 20, 2, '#2b2236'); rect(g, p.x - 10, p.y + 10, Math.round(20 * mold), 2, '#ffe08a'); } continue; }
      drawPiece(g, p, p.x, p.y, 8);
    }
    if (this.mode === 'top' && this.fish) this.drawFish(g);
    if (this.drag?.piece) drawPiece(g, this.drag.piece, this.drag.x, this.drag.y, 8, 5);
  }

  private drawPlate(g: G) {
    const pl = this.plate;
    drawCookingPlate(g, pl.cx, pl.cy, pl.rx, pl.ry, recipePresentation(this.r.id));
    for (const d of this.decos) drawPlateDeco(g, d.id, d.x, d.y, d.seed);
  }

  private drawOverlay(g: G) {
    if (this.drag && !this.drag.piece) {
      const d = this.drag;
      if (d.id.startsWith('deco_')) drawPlateDeco(g, d.id, d.x, d.y, 1);
      else if (d.id === 'rice') drawRiceBall(g, d.x, d.y, 8);
      else if (d.id === 'nori' && this.mode === 'wrap') { rect(g, d.x - 3, d.y - 8, 6, 16, NORI); }
      else if (d.id === 'nori') drawNori(g, { x: d.x - 40, y: d.y - 20, w: 80, h: 40 }, 3);
      else if (this.mode === 'place' || this.mode === 'garnish') drawStrip(g, d.id, d.x, d.y, 56, 3);
      else g.drawImage(cookingIngredient(d.id), Math.round(d.x - 16), Math.round(d.y - 12));
    }
    if (this.handAt && this.mode === 'rice') drawHand(g, this.handAt.x, this.handAt.y, true);
    if (this.knife && (this.mode === 'cut' || this.mode === 'slice')) drawKnifeAt(g, this.knife.x, this.knife.y + 6, 0);
    if (this.mode === 'done') {
      g.fillStyle = 'rgba(20,12,30,.55)'; g.fillRect(0, this.H / 2 - 22, this.W, 44);
      g.fillStyle = '#fff1c5'; g.font = '14px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(this.verdictText, this.W / 2, this.H / 2 - 6);
      g.font = '8px monospace'; g.fillStyle = '#e3d5b0'; g.fillText(this.verdictSub, this.W / 2, this.H / 2 + 10); g.textAlign = 'left';
    }
  }
  private verdictText = ''; private verdictSub = '';

  // ------------------------------------------------------------------ finish
  private complete() {
    if (this.done) return;
    this.done = true;
    const mode = settings.cookMode;
    this.sub.plate = this.quick ? 0.85 : plateScore(this.pieces.map((p) => ({ x: p.x, y: p.y })), this.plate);
    this.prec.push(this.sub.plate);
    const precision = this.prec.length ? this.prec.reduce((a, b) => a + b, 0) / this.prec.length : 0.75;
    const judged = judgeCook({ mode, mistakes: this.mistakes, elapsed: this.elapsed(), steps: this.r.steps.length, timeLimit: this.timeLimit, precision });
    if (judged.quality === 2) haptic('excellent');
    const used = this.variantUsed && this.variant && game.consumeIngredients({ [this.variant.item]: 1 });
    audio.sfxPlay(judged.quality === 2 ? 'success' : 'sparkle');
    this.mode = 'done';
    this.verdictText = judged.label;
    const notes: string[] = [];
    if (this.sub.rice > 0.85) notes.push('arroz parejo');
    if (this.sub.roll > 0.9 && this.r.steps.some((s) => s.t === 'roll')) notes.push('rollo firme');
    if (this.sub.cut > 0.85 && this.r.steps.some((s) => s.t === 'cut')) notes.push('cortes limpios');
    if (this.sub.plate > 0.85) notes.push('plato prolijo');
    this.verdictSub = notes.length ? notes.join(' · ') : 'a seguir practicando';
    this.pieces.forEach((p) => { this.sparkles.push({ x: p.x, y: p.y, t: Math.random() * 0.3 }); });
    for (let i = 0; i < 6; i++) this.sparkles.push({ x: this.plate.cx + (Math.random() - 0.5) * this.plate.rx * 1.6, y: this.plate.cy + (Math.random() - 0.5) * this.plate.ry, t: Math.random() * 0.5 });
    this.say(judged.label); this.renderSteps(); this.syncUI();
    this.actionBtn.style.display = 'none'; this.undoBtn.style.display = 'none'; this.trashBtn.style.display = 'none'; this.quickBtn.style.display = 'none';
    let closed = false;
    const leave = () => {
      if (closed) return; closed = true; this.cleanup();
      this.finish({ ok: true, quality: judged.quality, score: judged.score, variant: used ? this.variant!.name : undefined, variantItem: used ? this.variant!.item : undefined, variantBonus: used ? this.variant!.bonus : 0, seconds: Math.round(this.elapsed() * 10) / 10, hard: mode === 'challenge' });
    };
    const shownAt = performance.now();
    this.finishNow = () => { if (performance.now() - shownAt > 600) leave(); };
    this.done = true;
    this.revealTimer = window.setTimeout(leave, notes.length ? 2600 : 1600);
    this.keepDrawing();
  }
  private keepDrawing() { cancelAnimationFrame(this.raf); const tick = () => { if (!this.active) return; this.update(0.016); this.draw(); this.raf = requestAnimationFrame(tick); }; tick(); }

  private abort() {
    if (this.done && this.mode === 'done') return;
    if (this.done) return;
    this.done = true; this.cleanup(); this.finish({ ok: false, quality: 0, score: 0, variantBonus: 0 });
  }
  private cleanup() {
    cancelAnimationFrame(this.raf); clearTimeout(this.revealTimer);
    this.stageResize?.disconnect(); window.removeEventListener('resize', this.resize);
    if (!this.host) audio.crossfade(this.musicBefore);
    this.close();
  }
}
void RICE_C; void RICE_W; void RICE_H; void ingLight;
