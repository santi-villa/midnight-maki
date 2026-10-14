import { haptic } from '../core/haptics';
/**
 * Sushi preparation minigame. A full-screen canvas board drives each recipe step:
 * drag ingredients, spread rice by rubbing, slice along a guide, roll with an upward
 * drag, cut the roll, shape rice by tapping, hold a gentle cooking mark, wrap, garnish
 * and plate. Recipes, ingredients and the 0|1|2 quality result are unchanged.
 * Modes: relaxed (default, no timer), normal (scored), challenge (optional timer).
 * The board is drawn in board pixels and shown at an integer scale.
 */
import { iconElement } from '../art/icons';
import { cookingIngredient, drawCookingKnife, drawCookingPlate, kitchenOval } from '../art/cooking';
import { recipePresentation } from './recipeCollection';
import { audio } from '../audio/audio';
import type { Track } from '../audio/audio';
import { settings } from '../core/settings';
import { game } from '../core/state';
import { ITEMS_BY_ID, INGREDIENT_ALIASES } from '../data/items';
import { RECIPES_BY_ID, type CookStep, type RecipeDef } from '../data/recipes';
import { h, openModal, sleep } from '../ui/dom';
import {
  challengeLimit,
  guideTolerance,
  heatHit,
  heatMark,
  heatWindow,
  inPlate,
  judgeCook,
  missCosts,
  nextGuide,
  platePrecision,
  coneDrag,
  fishCutSpeed,
  fishCutSummary,
  fishCutVerdict,
  fishCutZones,
  pressRate,
  pressVerdict,
  pressZone,
  cutWidths,
  evenness,
  riceStats,
  riceVerdict,
  rollFromDrag,
  swipeCuts,
  RICE_COLS,
  RICE_MAX_LAYERS,
  RICE_ROWS,
  type CookJudgement,
  type FishCut,
  type PressKind,
  type RiceKind,
} from './cookScore';

export interface CookResult { ok: boolean; quality: 0 | 1 | 2; score: number; variant?: string; variantItem?: string; variantBonus: number; }

const STEP_NAMES: Record<CookStep['t'], string> = {
  nori: 'Alga', rice: 'Arroz', place: 'Relleno', slice: 'Cortar', roll: 'Enrollar', cut: 'Porciones',
  shape: 'Moldear', top: 'Cubrir', wrap: 'Envolver', cone: 'Cono', garnish: 'Decorar', plate: 'Emplatar',
};

const STEP_HELP: Record<CookStep['t'], string> = {
  nori: 'Arrastrá el alga hasta la esterilla.',
  rice: 'Arrastrá el arroz y frotá hasta cubrir la esterilla. Si te quedás en un lugar, se acumula más arroz: buscá dos capas parejas.',
  place: 'Arrastrá cada relleno a su lugar sobre el arroz.',
  slice: 'Tocá cuando la marca pase por el centro dorado: cada toque es un corte.',
  roll: 'Arrastrá hacia arriba, como si cerraras la esterilla. Después apretá y soltá en la zona verde.',
  cut: 'Deslizá de arriba hacia abajo sobre la siguiente marca.',
  shape: 'Tocá el arroz tres veces para moldear cada pieza. Después apretá y soltá en la zona verde.',
  top: 'Arrastrá la cobertura sobre cada bolita.',
  wrap: 'Deslizá de izquierda a derecha para envolver con alga.',
  cone: 'Arrastrá en diagonal, de la esquina de abajo hacia arriba a la derecha, para armar el cono.',
  garnish: 'Arrastrá los ingredientes para decorar.',
  plate: 'Arrastrá cada pieza hasta el centro del plato.',
};

const RICE = '#fbf7ee';
const NORI = '#2f3b33';

function ingColor(id: string): string {
  const it = ITEMS_BY_ID[INGREDIENT_ALIASES[id] ?? id] ?? ITEMS_BY_ID[id];
  return it?.icon.c1 ?? '#e8826f';
}

/** Starts cooking. Ingredients must already be consumed by the caller. */
export function cook(recipeId: string, title = ''): Promise<CookResult> {
  const recipe = RECIPES_BY_ID[recipeId];
  return new Promise((resolve) => {
    const mg = new CookingGame(recipe, title, (r) => resolve(r));
    mg.start();
  });
}

/** Where an embedded board lives (the multi-dish kitchen) and how it talks back to it. */
export interface CookHost { el: HTMLElement; onBack: () => void; }

export class CookingGame {
  private root!: HTMLElement;
  private canvas!: HTMLCanvasElement;
  private g!: CanvasRenderingContext2D;
  private tray!: HTMLElement;
  private msg!: HTMLElement;
  private feedback!: HTMLElement;
  private progressEl!: HTMLElement;
  private stepsEl!: HTMLElement;
  private timerEl!: HTMLElement;
  private close!: () => void;
  private stepIdx = 0;
  private W = 320;
  private H = 240;
  private S = 1; // css px per board px
  // board state
  private noriPlaced = false;
  /** layers of rice on every cell of the mat (0..3): staying on a spot adds more */
  private riceCover = new Uint8Array(RICE_COLS * RICE_ROWS);
  private riceTime = new Float64Array(RICE_COLS * RICE_ROWS);
  private riceBtn: HTMLElement | null = null;
  private cutXs: number[] = [];
  private pressOn = false;
  private pressing = false;
  private pressP = 0;
  private asp: { rice?: RiceKind; press?: PressKind; cut?: number; fish?: 'clean' | 'ok' | 'ragged' } = {};
  private sliceT = 0;
  private fishCuts: FishCut[] = [];
  private coneProgress = 0;
  private coned = false;
  private coneStraight: number[] = [];
  private fillPrec: number[] = [];
  private finishNow: (() => void) | null = null;
  private riceAdded = false;
  private fillings: { id: string; x: number; y: number }[] = [];
  private needPlace: string[] = [];
  private sliceDone = 0;
  private sliceNeeded = 0;
  private sliceItem = '';
  private rollProgress = 0;
  private rolled = false;
  private cutsDone = 0;
  private cutsNeeded = 0;
  private balls = 0;
  private ballsNeeded = 0;
  private ballTaps: number[] = [];
  private toppings: boolean[] = [];
  private topItem = '';
  private wrapProgress = 0;
  private wrapped = false;
  private garnish: { id: string; x: number; y: number }[] = [];
  private needGarnish: string[] = [];
  private plated = 0;
  private plateNeeded = 0;
  private pieces = 0;
  private mistakes = 0;
  private startT = performance.now();
  private swipe: { x: number; y: number; t: number } | null = null;
  private raf = 0;
  private done = false;
  private variant: { item: string; name: string; bonus: number } | null = null;
  private variantUsed = false;
  private timeLimit = 0;
  private sparkles: { x: number; y: number; t: number }[] = [];
  private bits: { x: number; y: number; vx: number; vy: number; t: number; c: string }[] = [];
  private prec: number[] = [];
  private heatOn = false;
  private heated = false;
  private heatT = 0;
  private verdict: CookJudgement | null = null;
  private finger: { x: number; y: number } | null = null;
  private rubTravel = 0;
  private riceSfx = 0;
  private musicBefore: Track = 'none';
  private lastFrame = 0;
  private feedbackUntil = 0;
  private advancing = false;
  private dragCleanup: (() => void) | null = null;
  private revealTimer = 0;
  private knifeStroke: { x: number; y: number; age: number } | null = null;
  private landing: { x: number; y: number; age: number } | null = null;
  private stageResize: ResizeObserver | null = null;

  private pausedAt = 0;
  private active = true;

  constructor(private r: RecipeDef, private title: string, private finish: (r: CookResult) => void, private host?: CookHost) {}

  get recipe() { return this.r; }
  get customer() { return this.title; }
  get finished() { return this.done; }
  /** 0..1 of the steps already done, for the dish chip */
  get progress() { return this.done ? 1 : this.stepIdx / Math.max(1, this.r.steps.length); }
  get stepName() { return this.done ? '¡Listo!' : STEP_NAMES[this.step?.t ?? 'plate']; }

  /** Embedded boards run only while shown; hidden ones freeze (and their timer with them). */
  setActive(on: boolean) {
    if (this.done || on === this.active) return;
    this.active = on;
    if (!on) {
      this.pausedAt = performance.now();
      cancelAnimationFrame(this.raf);
      this.root.style.display = 'none';
    } else {
      this.startT += performance.now() - this.pausedAt;
      this.lastFrame = 0;
      this.root.style.display = '';
      this.resize();
      this.loop();
    }
  }

  /** Throws the dish away (the caller refunds). */
  discard() {
    if (this.done) return;
    this.done = true;
    this.cleanup();
  }

  start() {
    // portrait phones get a taller, narrower board so it fills the screen
    if (window.innerHeight > window.innerWidth * 1.15) {
      this.W = 220;
      this.H = 300;
    }
    this.mat = { x: Math.round((this.W - 192) / 2), y: Math.round(this.H * 0.3), w: 192, h: 100 };
    const mode = settings.cookMode;
    if (mode === 'challenge') this.timeLimit = challengeLimit(this.r.steps.length);
    if (!this.host) {
      this.musicBefore = audio.currentTrack();
      audio.crossfade('kitchen');
    }
    this.stepsEl = h('div', { class: 'cook-steps' });
    this.timerEl = h('div', { class: 'pill' });
    this.msg = h('div', { class: 'cook-msg', id: 'cook-instruction' });
    this.progressEl = h('b', { class: 'cook-progress' });
    this.feedback = h('div', { class: 'cook-feedback', role: 'status', 'aria-live': 'polite' });
    this.canvas = h('canvas', { class: 'board', 'aria-label': 'Mesa de preparación de sushi', 'aria-describedby': 'cook-instruction' }) as HTMLCanvasElement;
    const stage = h('div', { class: 'cook-stage' }, this.canvas);
    const instruction = h('div', { class: 'cook-instruction' }, this.progressEl, h('div', { class: 'cook-guidance' }, this.msg, this.feedback));
    this.tray = h('div', { class: 'cook-tray' });
    const head = h(
      'div',
      { class: 'cook-head' },
      h('div', { class: 'cook-order' }, iconElement(this.r.icon), h('div', { class: 'col', style: { gap: '2px' } }, h('b', null, this.r.name + (this.title ? ` — ${this.title}` : '')), this.stepsEl)),
      h('div', { class: 'col', style: { alignItems: 'flex-end', gap: '4px' } }, this.timerEl, this.host ? null : h('button', { class: 'close-x', 'aria-label': 'Salir', onclick: () => this.abort() }, '✕')),
    );
    this.root = h('div', { class: 'cook' }, head, instruction, stage, this.tray);
    if (this.host) {
      this.host.el.append(this.root);
      this.close = () => this.root.remove();
    } else {
      this.close = openModal(this.root);
      (this.root as any).__close = () => this.abort();
    }
    this.g = this.canvas.getContext('2d')!;
    this.bindInput();
    this.resize();
    window.addEventListener('resize', this.resize);
    // optional variant ingredient (adds bonus)
    const v = this.r.variants?.find((vv) => game.countUsable(vv.item) > 0);
    if (v) this.variant = v;
    this.enterStep();
    this.resize();
    this.stageResize = new ResizeObserver(this.resize);
    this.stageResize.observe(stage);
    this.loop();
  }

  private resize = () => {
    const stage = this.canvas.parentElement!;
    const rect = { width: stage.clientWidth, height: stage.clientHeight };
    const fit = Math.min(rect.width / this.W, rect.height / this.H);
    this.S = Math.max(1, Math.floor(fit) || 1);
    // Keep native pixels; shrink only when the phone cannot fit a whole board.
    const displayScale = Math.min(this.S, Math.max(0.1, fit));
    this.canvas.width = this.W * this.S;
    this.canvas.height = this.H * this.S;
    this.canvas.style.width = this.W * displayScale + 'px';
    this.canvas.style.height = this.H * displayScale + 'px';
    this.canvas.style.left = Math.round((rect.width - this.W * displayScale) / 2) + 'px';
    this.canvas.style.top = Math.round((rect.height - this.H * displayScale) / 2) + 'px';
    this.g.setTransform(this.S, 0, 0, this.S, 0, 0);
    this.g.imageSmoothingEnabled = false;
  };

  private get step(): CookStep {
    return this.r.steps[this.stepIdx];
  }

  private renderSteps() {
    this.stepsEl.innerHTML = '';
    this.r.steps.forEach((s, i) => this.stepsEl.append(h('span', { class: 's' + (i < this.stepIdx || this.done ? ' done' : i === this.stepIdx ? ' now' : ''), 'aria-current': i === this.stepIdx && !this.done ? 'step' : null }, STEP_NAMES[s.t])));
    this.progressEl.textContent = this.done ? '¡Listo!' : `${this.stepIdx + 1}/${this.r.steps.length}`;
  }

  private say(t: string) {
    this.msg.textContent = t;
  }

  private respond(text: string, kind: 'good' | 'gentle' = 'good') {
    this.feedback.textContent = text;
    this.feedback.dataset.kind = kind;
    this.feedback.classList.add('visible');
    this.feedbackUntil = performance.now() + 1100;
  }

  private landed(x: number, y: number) {
    if (!settings.reduceMotion) this.landing = { x, y, age: 0 };
    this.puff(x, y, '#fff1c5');
  }

  private enterStep() {
    this.advancing = false;
    this.swipe = null;
    this.finger = null;
    this.renderSteps();
    const s = this.step;
    if (!s) return this.complete();
    this.say(STEP_HELP[s.t]);
    this.tray.innerHTML = '';
    switch (s.t) {
      case 'nori':
        this.addTrayItem('nori');
        break;
      case 'rice':
        this.addTrayItem('rice');
        this.riceBtn = null;
        break;
      case 'place':
        this.needPlace = [...s.items];
        for (const id of new Set(s.items)) this.addTrayItem(id);
        break;
      case 'slice':
        this.sliceItem = s.item;
        this.sliceDone = 0;
        this.sliceT = 0;
        this.fishCuts = [];
        this.sliceNeeded = game.save.restaurant.upgrades.includes('knife') ? Math.max(1, s.cuts - 1) : s.cuts;
        break;
      case 'roll':
        this.rollProgress = 0;
        break;
      case 'cut':
        this.cutsDone = 0;
        this.cutXs = [];
        this.cutsNeeded = Math.max(1, Math.floor(s.pieces / 2)) + 1;
        this.pieces = s.pieces;
        break;
      case 'shape':
        this.balls = 0;
        this.ballsNeeded = s.count;
        this.ballTaps = new Array(s.count).fill(0);
        this.pieces = s.count;
        this.addTrayItem('rice');
        break;
      case 'top':
        this.topItem = s.item;
        this.toppings = new Array(this.ballsNeeded || 2).fill(false);
        this.addTrayItem(s.item);
        break;
      case 'wrap':
        this.wrapProgress = 0;
        this.wrapped = false;
        break;
      case 'cone':
        this.coneProgress = 0;
        this.coned = false;
        this.pieces = 1;
        break;
      case 'garnish':
        this.needGarnish = [...s.items];
        for (const id of new Set(s.items)) this.addTrayItem(id);
        break;
      case 'plate':
        this.plated = 0;
        this.plateNeeded = Math.min(this.pieces || 1, 8);
        this.say(STEP_HELP.plate + ' También podés tocar "Servir todo".');
        this.tray.append(h('button', { class: 'btn primary', onclick: () => this.serveAll() }, 'Servir todo'));
        break;
    }
    // Every recipe can receive its extra before serving, including nigiri with no garnish step.
    if (this.variant && !this.variantUsed && ['place', 'garnish', 'plate'].includes(s.t)) this.addTrayItem(this.variant.item, true);
  }

  private addTrayItem(id: string, optional = false) {
    const it = ITEMS_BY_ID[id];
    const sprite = h('canvas') as HTMLCanvasElement;
    sprite.width = 32; sprite.height = 24;
    sprite.getContext('2d')!.drawImage(cookingIngredient(id), 0, 0);
    const name = (it?.name ?? id) + (optional ? ' ★' : '');
    const el = h('div', { class: 'ing', 'data-id': id, 'aria-label': name }, sprite, h('span', null, name));
    if (optional) el.title = 'Ingrediente opcional (variante)';
    el.addEventListener('pointerdown', (e) => this.startDrag(e, id, optional));
    this.tray.append(el);
  }

  // ------------------------------------------------------------------ input
  private toBoard(e: PointerEvent) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) / rect.width) * this.W, y: ((e.clientY - rect.top) / rect.height) * this.H };
  }

  private bindInput() {
    const c = this.canvas;
    c.style.touchAction = 'none';
    c.addEventListener('pointerdown', (e) => {
      try { c.setPointerCapture(e.pointerId); } catch { /* synthetic or released pointer */ }
      if (this.verdict) {
        this.finishNow?.();
        return;
      }
      if (this.advancing || this.done) return;
      const p = this.toBoard(e);
      this.swipe = { ...p, t: performance.now() };
      this.finger = p;
      this.rubTravel = 0;
      this.onTap(p.x, p.y);
    });
    c.addEventListener('pointermove', (e) => {
      if (!this.swipe) return;
      const p = this.toBoard(e);
      this.onRub(p.x, p.y, this.swipe);
      this.finger = p;
    });
    c.addEventListener('pointerup', (e) => {
      if (!this.swipe) return;
      if (this.pressOn) {
        this.swipe = null;
        this.finger = null;
        if (this.pressing) this.releasePress();
        return;
      }
      const p = this.toBoard(e);
      this.onSwipe(this.swipe, p);
      this.swipe = null;
      this.finger = null;
      this.rubTravel = 0;
    });
    c.addEventListener('pointercancel', () => {
      if (this.pressOn) {
        this.pressing = false;
        this.pressP = 0;
      }
      this.swipe = null;
      this.finger = null;
      this.rubTravel = 0;
    });
  }

  private startDrag(e: PointerEvent, id: string, optional: boolean) {
    if (this.done || this.advancing || (e.currentTarget as HTMLElement).classList.contains('empty')) return;
    this.dragCleanup?.();
    e.preventDefault();
    const ghost = h('canvas', { class: 'drag-ghost cook-drag' }) as HTMLCanvasElement;
    ghost.width = 64;
    ghost.height = 48;
    const gg = ghost.getContext('2d')!;
    gg.imageSmoothingEnabled = false;
    gg.drawImage(cookingIngredient(id), 0, 0, 64, 48);
    document.body.append(ghost);
    const move = (ev: PointerEvent) => {
      ghost.style.left = ev.clientX + 'px';
      ghost.style.top = ev.clientY + 'px';
    };
    move(e);
    const clear = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', clear);
      ghost.remove();
      this.dragCleanup = null;
    };
    const up = (ev: PointerEvent) => {
      clear();
      if (this.done || this.advancing) return;
      const rect = this.canvas.getBoundingClientRect();
      if (ev.clientX < rect.left || ev.clientX > rect.right || ev.clientY < rect.top || ev.clientY > rect.bottom) return;
      const p = this.toBoard(ev);
      this.onDrop(id, p.x, p.y, optional);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', clear);
    this.dragCleanup = clear;
  }

  private mat = { x: 64, y: 70, w: 192, h: 100 };

  private inMat(x: number, y: number) {
    const m = this.mat;
    return x >= m.x && x <= m.x + m.w && y >= m.y && y <= m.y + m.h;
  }

  private onDrop(id: string, x: number, y: number, optional: boolean) {
    const s = this.step;
    if (!s) return;
    if (optional && this.variant && id === this.variant.item && !this.variantUsed) {
      const box = this.plateBox();
      if (!(s.t === 'plate' ? inPlate(x, y, box.cx, box.cy, box.rx, box.ry) : this.inMat(x, y))) {
        this.say(s.t === 'plate' ? 'Soltá el ingrediente extra sobre el plato.' : 'Soltá el ingrediente extra sobre la esterilla.');
        return;
      }
      this.garnish.push({ id, x, y });
      audio.sfxPlay('place');
      this.say(`¡Variante ${this.variant.name}!`);
      this.respond(`Variante ${this.variant.name}`);
      this.landed(x, y);
      (this.tray.querySelector(`[data-id="${id}"]`) as HTMLElement)?.classList.add('empty');
      this.variantUsed = true;
      return;
    }
    switch (s.t) {
      case 'nori':
        if (id === 'nori' && this.inMat(x, y)) {
          this.noriPlaced = true;
          this.landed(x, y);
          audio.sfxPlay('place');
          this.checkStep();
        } else this.miss('Soltalo sobre la esterilla de bambú.');
        break;
      case 'rice':
        if (id === 'rice' && this.inMat(x, y)) {
          this.riceAdded = true;
          this.landed(x, y);
          audio.sfxPlay('place');
          this.respond('Ahora esparcí el arroz');
          this.say('¡Ahora frotá para esparcir el arroz!');
          this.rub(x, y, 3);
        }
        break;
      case 'place':
      case 'garnish': {
        const list = s.t === 'place' ? this.needPlace : this.needGarnish;
        const i = list.indexOf(id);
        if (i >= 0 && (s.t === 'garnish' || this.inMat(x, y))) {
          list.splice(i, 1);
          if (s.t === 'place') {
            const spot = this.slotAt(this.fillings.length, s.items.length);
            const pp = Math.max(0, 1 - Math.hypot(x - spot.x, y - spot.y) / 48);
            this.prec.push(pp);
            this.fillPrec.push(pp);
            this.fillings.push({ id, x: spot.x - 9, y: spot.y - 5 });
          } else this.garnish.push({ id, x, y });
          audio.sfxPlay('place');
          this.landed(x, y);
          this.respond(s.t === 'place' ? 'Relleno colocado' : 'Un toque de color');
          if (!list.includes(id)) (this.tray.querySelector(`[data-id="${id}"]`) as HTMLElement)?.classList.add('empty');
          this.checkStep();
        } else if (i < 0) this.miss('Ese ingrediente no va en este paso.');
        break;
      }
      case 'top': {
        if (id !== this.topItem) return this.miss('Esa no es la cobertura.');
        const idx = this.ballAt(x, y);
        if (idx >= 0 && !this.toppings[idx]) {
          this.toppings[idx] = true;
          this.landed(this.ballPos(idx).x, this.ballPos(idx).y);
          this.respond('Cobertura colocada');
          audio.sfxPlay('place');
          this.checkStep();
        }
        break;
      }
      case 'shape':
        if (id === 'rice') this.onTap(x, y);
        break;
    }
  }

  private miss(t: string) {
    this.mistakes++;
    audio.sfxPlay('error');
    this.say(t);
    this.respond('Probá otra vez, sin apuro', 'gentle');
  }

  private rub(x: number, y: number, r = 1) {
    if (!this.riceAdded) return;
    const m = this.mat;
    const cx = Math.floor(((x - m.x) / m.w) * RICE_COLS);
    const cy = Math.floor(((y - m.y) / m.h) * RICE_ROWS);
    const now = performance.now();
    let changed = false;
    for (let j = -r; j <= r; j++)
      for (let i = -r - 1; i <= r + 1; i++) {
        const gx = cx + i;
        const gy = cy + j;
        if (gx < 0 || gy < 0 || gx >= RICE_COLS || gy >= RICE_ROWS) continue;
        const k = gy * RICE_COLS + gx;
        if (!this.riceCover[k]) {
          this.riceCover[k] = 1;
          this.riceTime[k] = now;
          changed = true;
        } else if (this.riceCover[k] < RICE_MAX_LAYERS && now - this.riceTime[k] > 520) {
          this.riceCover[k]++;
          this.riceTime[k] = now;
          changed = true;
        }
      }
    if (changed) this.checkStep();
  }

  private riceRatio() {
    return riceStats(this.riceCover).coverage;
  }

  /** The player is happy with the rice: judge the thickness and move on. */
  private finishRice() {
    if (this.advancing || this.done) return;
    const st = riceStats(this.riceCover);
    const v = riceVerdict(st.mean);
    this.asp.rice = v.kind;
    this.prec.push(v.prec);
    if (v.kind === 'good') audio.sfxPlay('success');
    this.say(v.kind === 'thin' ? 'Poco arroz: el rollo va a quedar flojo.' : v.kind === 'thick' ? 'Mucho arroz: va a costar cerrarlo.' : '¡El grosor justo!');
    this.respond(v.kind === 'good' ? '¡Arroz en su punto!' : v.kind === 'thin' ? 'Arroz finito' : 'Arroz abundante', v.kind === 'good' ? 'good' : 'gentle');
    this.riceBtn?.remove();
    this.riceBtn = null;
    this.nextStep();
  }

  private releasePress() {
    if (!this.pressOn) return;
    const v = pressVerdict(this.pressP, settings.cookMode);
    this.asp.press = v.kind;
    this.prec.push(v.prec);
    this.pressOn = false;
    this.pressing = false;
    this.heated = true;
    audio.sfxPlay(v.kind === 'firm' ? 'success' : 'tap');
    this.puff(this.W / 2, this.mat.y + this.mat.h * 0.5, v.kind === 'squeezed' ? ingColor(this.fillings[0]?.id ?? 'cucumber') : '#f6ecd6');
    const shaping = this.step?.t === 'shape';
    this.say(shaping
      ? v.kind === 'loose' ? 'El arroz quedó suelto: se desarma un poco.' : v.kind === 'squeezed' ? 'Quedó muy compacto, casi una piedrita.' : '¡Arroz firme y esponjoso!'
      : v.kind === 'loose' ? 'Quedó flojito: puede abrirse al cortar.' : v.kind === 'squeezed' ? '¡Uy! Se apretó de más y el relleno asoma.' : '¡Rollo firme y parejo!');
    this.respond(v.kind === 'firm' ? '¡Firme y parejo!' : v.kind === 'loose' ? 'Quedó flojito' : 'Un poco apretado', v.kind === 'firm' ? 'good' : 'gentle');
    this.nextStep();
  }

  /** One knife stroke on the fish: judged by where the marker is when the player taps. A miss never restarts anything. */
  private tapCut() {
    if (this.sliceDone >= this.sliceNeeded) return;
    const knife = game.save.restaurant.upgrades.includes('knife');
    const v = fishCutVerdict(this.sliceMark(), settings.cookMode, knife);
    if (v.kind === 'perfect') haptic('cut');
    this.fishCuts.push(v.kind);
    this.prec.push(v.prec);
    this.sliceDone++;
    const l = this.sliceLayout();
    const n = this.sliceNeeded + 1;
    const x = l.x0 + (l.w / n) * this.sliceDone;
    if (!settings.reduceMotion) this.knifeStroke = { x, y: l.y0, age: 0 };
    audio.sfxPlay(v.kind === 'miss' ? 'tap' : 'cut');
    this.sparkles.push({ x, y: l.y0 + 30, t: v.kind === 'perfect' ? 0.5 : 0.3 });
    this.puff(x, l.y0 + 30, ingColor(this.sliceItem));
    this.say(v.kind === 'perfect' ? '¡Corte limpio!' : v.kind === 'good' ? 'Buen corte.' : 'Corte irregular, pero seguimos.');
    this.respond(v.kind === 'perfect' ? '¡Corte limpio!' : v.kind === 'good' ? 'Buen corte' : 'Corte irregular, seguimos', v.kind === 'miss' ? 'gentle' : 'good');
    if (this.sliceDone >= this.sliceNeeded) this.asp.fish = fishCutSummary(this.fishCuts);
    this.checkStep();
  }

  private sliceMark(): number {
    const s = this.step;
    const speed = fishCutSpeed(settings.cookMode, this.r.difficulty, this.sliceDone);
    void s;
    return 0.5 + 0.42 * Math.sin(this.sliceT * speed * 2.4);
  }

  private onTap(x: number, y: number) {
    if (this.pressOn) {
      this.pressing = true;
      this.pressP = 0;
      audio.sfxPlay('tap');
      return;
    }
    if (this.heatOn) {
      this.tryHeat();
      return;
    }
    const s = this.step;
    if (!s) return;
    if (s.t === 'slice') {
      this.tapCut();
      return;
    }
    if (s.t === 'shape') {
      const idx = this.balls < this.ballsNeeded ? this.balls : -1;
      if (idx < 0) return;
      this.ballTaps[idx]++;
      this.landed(this.ballPos(idx).x, this.ballPos(idx).y);
      audio.sfxPlay('tap');
      if (this.ballTaps[idx] >= 3) {
        this.balls++;
        audio.sfxPlay('place');
        this.sparkles.push({ x: this.ballPos(idx).x, y: this.ballPos(idx).y, t: 0.6 });
        this.puff(this.ballPos(idx).x, this.ballPos(idx).y, RICE);
        this.checkStep();
      }
      void x;
      void y;
    }
  }

  private onRub(x: number, y: number, start: { x: number; y: number }) {
    if (this.advancing || this.done) return;
    const s = this.step;
    if (s?.t === 'rice' && this.riceAdded) {
      this.rub(x, y, 1);
      this.riceSfx++;
      if (this.riceSfx % 10 === 0) audio.sfxPlay('rice');
      if (this.riceSfx % 6 === 0) this.puff(x, y, RICE);
    }
    if (s?.t === 'roll' && this.finger) {
      const up = this.finger.y - y;
      if (up > 0) {
        const bamboo = game.save.restaurant.upgrades.includes('bamboo');
        this.rollProgress = Math.min(1, this.rollProgress + rollFromDrag(up, bamboo));
        this.rubTravel += up;
        if (this.rollProgress >= 1 && !this.rolled) {
          this.rolled = true;
          audio.sfxPlay('roll');
          this.checkStep();
        }
      }
    }
    if (s?.t === 'cone' && !this.coned) {
      const d = coneDrag(x - start.x, y - start.y);
      this.coneProgress = Math.max(this.coneProgress, d.progress);
      this.coneStraight.push(d.straight);
      if (this.coneProgress >= 1) {
        this.coned = true;
        this.prec.push(this.coneStraight.reduce((a, b) => a + b, 0) / Math.max(1, this.coneStraight.length));
        audio.sfxPlay('roll');
        this.puff(this.W / 2, this.mat.y + this.mat.h / 2, '#2f3b33');
        this.checkStep();
      }
    }
    if (s?.t === 'wrap') {
      const p = Math.max(0, Math.min(1, (x - start.x) / 140));
      this.wrapProgress = Math.max(this.wrapProgress, p);
      if (this.wrapProgress >= 1 && !this.wrapped) {
        this.wrapped = true;
        audio.sfxPlay('roll');
        this.checkStep();
      }
    }
  }

  private onSwipe(a: { x: number; y: number; t: number }, b: { x: number; y: number }) {
    if (this.advancing || this.done) return;
    const s = this.step;
    if (!s) return;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    if (s.t === 'cut') {
      const layout = { x0: this.mat.x, w: this.mat.w };
      const done = this.cutsDone;
      const needed = this.cutsNeeded;
      const guide = nextGuide(done, needed, layout.x0, layout.w);
      const midX = (a.x + b.x) / 2;
      const hit = swipeCuts(dx, dy, midX, guide, guideTolerance(settings.cookMode));
      if (hit === 'hit') {
        this.cutsDone++;
        const tol = guideTolerance(settings.cookMode);
        this.prec.push(Math.max(0, 1 - Math.abs(midX - (guide ?? midX)) / tol));
        this.cutXs.push(midX);
        if (!settings.reduceMotion) this.knifeStroke = { x: midX, y: this.mat.y + 8, age: 0 };
        this.respond('¡Una porción más!');
        audio.sfxPlay('cut');
        this.sparkles.push({ x: midX, y: (a.y + b.y) / 2, t: 0.4 });
        this.puff(midX, (a.y + b.y) / 2, ingColor('rice'));
        this.checkStep();
      } else if (hit === 'miss') {
        if (missCosts(settings.cookMode)) this.mistakes++;
        audio.sfxPlay('tap');
        this.say('Seguí la línea punteada, de arriba hacia abajo.');
      } else if (Math.hypot(dx, dy) > 25) this.say('Cortá de arriba hacia abajo sobre la línea.');
    }
    if (s.t === 'roll') {
      if (dy < -30 && this.rubTravel < 8) {
        const bamboo = game.save.restaurant.upgrades.includes('bamboo');
        this.rollProgress = Math.min(1, this.rollProgress + rollFromDrag(-dy, bamboo));
        audio.sfxPlay('roll');
        if (this.rollProgress >= 1) this.rolled = true;
        this.checkStep();
      } else if (this.rollProgress < 1 && Math.hypot(dx, dy) > 25 && dy >= -30) this.say('Arrastrá hacia arriba para enrollar.');
    }
    if (s.t === 'plate' && this.plated < this.plateNeeded) {
      const box = this.plateBox();
      const inside = inPlate(b.x, b.y, box.cx, box.cy, box.rx, box.ry);
      const tap = Math.hypot(dx, dy) < 28;
      if (inside || (settings.cookMode === 'relaxed' && tap)) this.placePiece(b.x, b.y, !inside);
      else if (Math.hypot(dx, dy) > 18) this.say('Soltá la pieza sobre el plato.');
    }
  }

  private serveAll() {
    if (this.advancing || this.done) return;
    const bump = settings.cookMode === 'challenge' ? 0.4 : 0.72;
    while (this.plated < this.plateNeeded) {
      this.plated++;
      this.prec.push(bump);
    }
    audio.sfxPlay('place');
    const box = this.plateBox();
    this.landed(box.cx, box.cy);
    this.respond('¡Listo para servir!');
    this.checkStep();
  }

  private placePiece(x: number, y: number, loose: boolean) {
    if (this.plated >= this.plateNeeded) return;
    const box = this.plateBox();
    this.prec.push(loose ? 0.8 : platePrecision(x, y, box.cx, box.cy, box.rx, box.ry));
    this.plated++;
    this.landed(x, y);
    audio.sfxPlay('place');
    this.puff(x, y, '#fff6e4');
    this.checkStep();
  }

  private plateBox() {
    return {
      cx: this.W / 2,
      cy: this.H - 46,
      rx: Math.min(86, this.W / 2 - 16),
      ry: 24,
    };
  }

  private sliceLayout() {
    const w = 180;
    return { x0: Math.round((this.W - w) / 2), y0: Math.round(this.H * 0.25), w, h: 60 };
  }

  private tryHeat() {
    if (!this.heatOn) return;
    const band = heatWindow(settings.cookMode);
    const mark = heatMark(this.heatT, band.speed);
    if (heatHit(mark, band.half)) {
      this.prec.push(1);
      this.finishHeat(true);
    } else if (missCosts(settings.cookMode)) {
      this.mistakes++;
      audio.sfxPlay('error');
      this.say('Casi. Esperá a que la marca llegue al dorado.');
    } else {
      audio.sfxPlay('tap');
      this.say('Un poquito antes o después. El centro es el punto justo.');
    }
  }

  private finishHeat(ok: boolean) {
    if (!this.heatOn) return;
    if (!ok && missCosts(settings.cookMode)) this.mistakes++;
    if (!ok) this.prec.push(0.35);
    this.heatOn = false;
    this.heated = true;
    audio.sfxPlay(ok ? 'steam' : 'tap');
    this.puff(this.W / 2, this.H * 0.42, '#f6ecd6');
    this.nextStep();
  }

  private puff(x: number, y: number, c: string) {
    if (settings.reduceMotion) return;
    const cap = settings.perf === 'low' ? 8 : 28;
    for (let i = 0; i < 5 && this.bits.length < cap; i++) {
      this.bits.push({
        x, y,
        vx: (Math.random() - 0.5) * 18,
        vy: -10 - Math.random() * 16,
        t: 0.45 + Math.random() * 0.25,
        c,
      });
    }
  }

  private checkStep() {
    if (this.advancing || this.done) return;
    const s = this.step;
    if (!s) return;
    let ok = false;
    switch (s.t) {
      case 'nori': ok = this.noriPlaced; break;
      case 'rice': {
        const st = riceStats(this.riceCover);
        if (this.riceAdded && st.coverage < 0.8) this.say(`Arroz esparcido: ${Math.round(Math.min(1, st.coverage / 0.8) * 100)}%`);
        if (st.coverage >= 0.8) {
          const v = riceVerdict(st.mean).kind;
          this.say(`Cubierto. Grosor: ${v === 'thin' ? 'finito (seguí un poco más)' : v === 'thick' ? 'de más' : 'justo'}. Tocá Listo cuando quieras.`);
          if (!this.riceBtn) {
            this.riceBtn = h('button', { class: 'btn primary', onclick: () => this.finishRice() }, 'Listo');
            this.tray.append(this.riceBtn);
          }
        }
        ok = false; // the player decides when the rice is right
        break;
      }
      case 'place': ok = this.needPlace.length === 0; break;
      case 'slice': ok = this.sliceDone >= this.sliceNeeded; break;
      case 'roll': ok = this.rolled; break;
      case 'cut': ok = this.cutsDone >= this.cutsNeeded; break;
      case 'shape': ok = this.balls >= this.ballsNeeded; break;
      case 'top': ok = this.toppings.every(Boolean); break;
      case 'wrap': ok = this.wrapped; break;
      case 'cone': ok = this.coned; break;
      case 'garnish': ok = this.needGarnish.length === 0; break;
      case 'plate': ok = this.plated >= this.plateNeeded; break;
    }
    if (!ok || this.heatOn || this.pressOn) return;
    if (s.t === 'roll' && !this.heated) {
      this.pressOn = true;
      this.pressing = false;
      this.pressP = 0;
      this.say('Mantené apretado y soltá cuando la barra esté en la zona verde.');
      audio.sfxPlay('roll');
      return;
    }
    if (s.t === 'shape' && !this.heated) {
      this.pressOn = true;
      this.pressing = false;
      this.pressP = 0;
      this.say('Mantené apretado y soltá cuando la barra esté en la zona verde.');
      audio.sfxPlay('roll');
      return;
    }
    this.nextStep();
  }

  private async nextStep() {
    if (this.advancing || this.done) return;
    this.advancing = true;
    const cur = this.stepIdx;
    audio.sfxPlay('tap');
    this.sparkles.push({ x: this.W / 2, y: this.H / 2, t: 0.5 });
    await sleep(250);
    if (this.stepIdx !== cur || this.done) return;
    this.stepIdx++;
    if (this.stepIdx >= this.r.steps.length) this.complete();
    else this.enterStep();
  }

  private elapsed() {
    return (performance.now() - this.startT) / 1000;
  }

  private complete() {
    if (this.done) return;
    this.done = true;
    const mode = settings.cookMode;
    if (this.cutXs.length) this.asp.cut = evenness(cutWidths(this.cutXs, this.mat.x, this.mat.w));
    const precision = this.prec.length ? this.prec.reduce((sum, n) => sum + n, 0) / this.prec.length : 0.75;
    const judged = judgeCook({
      mode,
      mistakes: this.mistakes,
      elapsed: this.elapsed(),
      steps: this.r.steps.length,
      timeLimit: this.timeLimit,
      precision,
    });
    this.verdict = judged;
    if (judged.quality === 2) haptic('excellent');
    const used = this.variantUsed && this.variant && game.consumeIngredients({ [this.variant.item]: 1 });
    audio.sfxPlay(judged.quality === 2 ? 'success' : 'sparkle');
    this.say(judged.label);
    this.renderSteps();
    // the verdict stays long enough to read how the dish turned out; a tap skips it
    let closed = false;
    const leave = () => {
      if (closed) return;
      closed = true;
      this.cleanup();
      this.finish({
        ok: true,
        quality: judged.quality,
        score: judged.score,
        variant: used ? this.variant!.name : undefined,
        variantItem: used ? this.variant!.item : undefined,
        variantBonus: used ? this.variant!.bonus : 0,
      });
    };
    const shownAt = performance.now();
    this.finishNow = () => {
      if (performance.now() - shownAt > 600) leave();
    };
    this.revealTimer = window.setTimeout(leave, this.aspectLines().length ? 2600 : 1400);
  }

  private abort() {
    if (this.done) return;
    this.done = true;
    this.cleanup();
    this.finish({ ok: false, quality: 0, score: 0, variantBonus: 0 });
  }

  private cleanup() {
    cancelAnimationFrame(this.raf);
    clearTimeout(this.revealTimer);
    this.dragCleanup?.();
    this.stageResize?.disconnect();
    window.removeEventListener('resize', this.resize);
    if (!this.host) audio.crossfade(this.musicBefore);
    this.close();
  }

  // ------------------------------------------------------------------ drawing
  private ballPos(i: number) {
    const n = Math.max(1, this.ballsNeeded || 2);
    const gap = Math.min(60, (this.W - 40) / Math.max(1, n));
    const x0 = this.W / 2 - ((n - 1) * gap) / 2;
    return { x: x0 + i * gap, y: 128 };
  }
  private ballAt(x: number, y: number) {
    for (let i = 0; i < (this.ballsNeeded || 2); i++) {
      const p = this.ballPos(i);
      if (Math.abs(x - p.x) < 26 && Math.abs(y - p.y) < 26) return i;
    }
    return -1;
  }

  private loop = () => {
    const now = performance.now();
    const dt = this.lastFrame ? Math.min(0.05, (now - this.lastFrame) / 1000) : 0;
    this.lastFrame = now;
    if (this.feedbackUntil && now > this.feedbackUntil) {
      this.feedback.classList.remove('visible');
      this.feedbackUntil = 0;
    }
    if (this.knifeStroke && (this.knifeStroke.age += dt) > 0.24) this.knifeStroke = null;
    if (this.landing && (this.landing.age += dt) > 0.3) this.landing = null;
    for (const sp of this.sparkles) sp.t -= dt;
    this.sparkles = this.sparkles.filter(sp => sp.t > 0);
    if (this.step?.t === 'slice' && !this.done) this.sliceT += dt;
    if (this.pressOn && this.pressing && !this.done) {
      this.pressP += pressRate(settings.cookMode) * dt;
      if (this.pressP >= 1.08) this.releasePress();
    }
    if (this.swipe && this.finger && this.step?.t === 'rice' && this.riceAdded && !this.done) this.rub(this.finger.x, this.finger.y, 1);
    if (this.heatOn && !this.done) {
      this.heatT += dt;
      if (this.heatT >= heatWindow(settings.cookMode).giveUp) this.finishHeat(false);
      else if (!settings.reduceMotion && Math.random() < dt * 2) this.puff(this.W / 2, this.mat.y + 8, '#f6ecd6');
    }
    if (!settings.reduceMotion) {
      for (const bit of this.bits) {
        bit.t -= dt;
        bit.x += bit.vx * dt;
        bit.y += bit.vy * dt;
      }
      this.bits = this.bits.filter((bit) => bit.t > 0);
    }
    this.draw();
    if (this.timeLimit) {
      const left = Math.max(0, this.timeLimit - this.elapsed());
      this.timerEl.textContent = `⏱ ${Math.ceil(left)}s (opcional)`;
    } else this.timerEl.textContent = settings.cookMode === 'relaxed' ? 'Relajado' : 'Normal';
    this.raf = requestAnimationFrame(this.loop);
  };

  private draw() {
    const g = this.g;
    const W = this.W;
    const H = this.H;
    // counter: warm hinoki boards with grain, seams and a soft highlight
    const tones = ['#c48d5e', '#b98252', '#c9935f', '#bd8656'];
    for (let y = 0, i = 0; y < H; y += 14, i++) {
      g.fillStyle = tones[i % tones.length];
      g.fillRect(0, y, W, 14);
      g.fillStyle = 'rgba(255,240,210,.18)';
      g.fillRect(0, y, W, 2);
      g.fillStyle = '#8e5d3c';
      g.fillRect(0, y + 13, W, 1);
      g.fillStyle = 'rgba(120,70,40,.25)';
      g.fillRect((i * 53) % W, y + 6, 40, 1);
      g.fillRect((i * 97 + 120) % W, y + 9, 26, 1);
      g.fillStyle = '#8e5d3c';
      g.fillRect((i * 71 + 30) % W, y, 1, 13);
    }
    g.fillStyle = 'rgba(42,24,16,.28)';
    g.fillRect(0, 0, W, 8);
    g.fillRect(0, H - 8, W, 8);
    g.fillRect(0, 0, 6, H);
    g.fillRect(W - 6, 0, 6, H);
    const s = this.step;
    const usesMat = this.r.steps.some((st) => st.t === 'nori' || st.t === 'rice');
    const m = this.mat;
    const shapeMode = !usesMat;
    if (!shapeMode) {
      // bamboo mat
      g.fillStyle = 'rgba(40,24,16,.35)';
      g.fillRect(m.x - 4, m.y - 2, m.w + 12, m.h + 12);
      g.fillStyle = '#2b1d17';
      g.fillRect(m.x - 7, m.y - 7, m.w + 14, m.h + 14);
      for (let x = m.x - 6; x < m.x + m.w + 6; x += 6) {
        g.fillStyle = '#d9bf84';
        g.fillRect(x, m.y - 6, 5, m.h + 12);
        g.fillStyle = '#ead39c';
        g.fillRect(x, m.y - 6, 1, m.h + 12);
        g.fillStyle = '#b39660';
        g.fillRect(x + 4, m.y - 6, 1, m.h + 12);
      }
      // binding strings
      g.fillStyle = '#4f6b47';
      for (const yy of [m.y + 8, m.y + m.h / 2, m.y + m.h - 8]) g.fillRect(m.x - 6, Math.round(yy), m.w + 12, 2);
      const rollP = this.rolled ? 1 : this.rollProgress;
      const visH = m.h * (1 - rollP * 0.85);
      if (this.noriPlaced && !this.rolled) {
        g.fillStyle = NORI;
        g.fillRect(m.x, m.y + m.h - visH, m.w, visH);
      }
      // rice coverage
      if (this.riceAdded && !this.rolled) {
        const cw = m.w / RICE_COLS;
        const ch = m.h / RICE_ROWS;
        for (let j = 0; j < RICE_ROWS; j++)
          for (let i = 0; i < RICE_COLS; i++) {
            const layers = this.riceCover[j * RICE_COLS + i];
            if (!layers) continue;
            const yy = m.y + j * ch;
            if (yy < m.y + m.h - visH) continue;
            const x0 = Math.floor(m.x + i * cw);
            const y0 = Math.floor(yy);
            // one layer is thin (the nori shows through), three are a heap with a lit top edge
            g.fillStyle = layers === 1 ? '#e9e3d2' : (i + j) % 3 ? RICE : '#f1ebdc';
            g.fillRect(x0, y0, Math.ceil(cw), Math.ceil(ch));
            if (layers >= 3) {
              g.fillStyle = '#ffffff';
              g.fillRect(x0, y0, Math.ceil(cw), 1);
              g.fillStyle = '#d9d2bf';
              g.fillRect(x0, y0 + Math.ceil(ch) - 1, Math.ceil(cw), 1);
            } else if (layers === 1 && (i + j) % 2) {
              g.fillStyle = 'rgba(47,59,51,.35)';
              g.fillRect(x0 + 1, y0 + 1, 2, 1);
            }
          }
        if (s?.t === 'rice' && this.riceRatio() < 0.05) {
          g.fillStyle = RICE;
          g.beginPath();
          g.arc(m.x + m.w / 2, m.y + m.h / 2, 14, 0, Math.PI * 2);
          g.fill();
        }
      }
      if (!this.rolled && s?.t === 'place') {
        const total = Math.max(1, this.needPlace.length + this.fillings.length);
        for (let i = 0; i < this.needPlace.length; i++) {
          const slot = this.slotAt(this.fillings.length + i, total);
          g.fillStyle = 'rgba(246,236,214,.45)';
          g.beginPath();
          g.arc(slot.x, slot.y, 8, 0, Math.PI * 2);
          g.fill();
        }
      }
      if (!this.rolled) {
        for (const f of this.fillings) {
          const x = Math.min(Math.max(f.x, m.x + 4), m.x + m.w - 22);
          const y = Math.min(Math.max(f.y, m.y + 4), m.y + m.h - 14);
          this.drawIng(f.id, x, y, 18, 10);
        }
      }
      // roll
      if (this.rollProgress > 0 || this.rolled) {
        const ry = m.y + m.h - visH - 10;
        const rr = 10 + rollP * 10;
        g.fillStyle = NORI;
        g.fillRect(m.x, ry - rr / 2, m.w, rr);
        g.fillStyle = '#3d4b40';
        g.fillRect(m.x, ry - rr / 2, m.w, 2);
      }
      // cut pieces
      if (this.rolled && (s?.t === 'cut' || s?.t === 'garnish' || s?.t === 'slice' || s?.t === 'plate' || s?.t === 'wrap') && s?.t !== 'plate') {
        const total = s?.t === 'cut' ? 1 + this.cutsDone : this.pieces || 6;
        // while cutting, the pieces take the widths of the cuts the player actually made
        const widths = s?.t === 'cut' ? cutWidths(this.cutXs, m.x, m.w) : new Array(total).fill(m.w / total);
        let px = m.x;
        for (let i = 0; i < widths.length; i++) {
          const pw = Math.max(4, widths[i] - 3);
          this.drawRollSlice(px + (i ? 1 : 0), m.y + m.h / 2 - 14, pw, 28, s?.t === 'cut' ? this.cutsDone > 0 : true);
          px += widths[i];
        }
        if (s?.t === 'cut') {
          g.fillStyle = 'rgba(246,236,214,.7)';
          for (let i = 1; i <= this.cutsNeeded; i++) {
            const x = m.x + (m.w / (this.cutsNeeded + 1)) * i;
            for (let y = m.y + 10; y < m.y + m.h - 10; y += 6) g.fillRect(x, y, 1, 3);
          }
        }
      }
    } else {
      // shaping board (nigiri/onigiri/gunkan)
      g.fillStyle = '#e6c79b';
      g.fillRect(14, 70, W - 28, 120);
      g.fillStyle = '#d2b27f';
      g.fillRect(14, 186, W - 28, 4);
      const n = this.ballsNeeded || (s?.t === 'slice' ? 0 : 2);
      for (let i = 0; i < n; i++) {
        const p = this.ballPos(i);
        const formed = i < this.balls;
        const taps = this.ballTaps[i] ?? 0;
        if (!formed && s?.t === 'shape' && i === this.balls) {
          g.fillStyle = RICE;
          const r = 18 - taps * 2;
          g.beginPath();
          g.ellipse(p.x, p.y, r + 4, r, 0, 0, Math.PI * 2);
          g.fill();
          g.fillStyle = 'rgba(42,34,48,.5)';
          g.font = '11px "Pixelify Sans", sans-serif';
          g.fillText('toc ' + (3 - taps), p.x - 12, p.y + 30);
        } else if (formed) {
          g.save();
          if (this.pressOn && this.pressing && !settings.reduceMotion) {
            const pressure = Math.min(1, this.pressP);
            g.translate(p.x, p.y);
            g.scale(1 + pressure * 0.06, 1 - pressure * 0.1);
            g.translate(-p.x, -p.y);
          }
          g.fillStyle = RICE;
          if (this.r.id === 'onigiri') {
            g.beginPath();
            g.moveTo(p.x, p.y - 22);
            g.lineTo(p.x - 20, p.y + 14);
            g.lineTo(p.x + 20, p.y + 14);
            g.closePath();
            g.fill();
          } else g.fillRect(p.x - 18, p.y - 8, 36, 18);
          if (this.asp.press === 'loose') {
            g.fillStyle = RICE;
            for (let k = 0; k < 6; k++) g.fillRect(p.x - 22 + ((k * 13 + i * 7) % 44), p.y + 8 + ((k * 5) % 7), 2, 2);
          } else if (this.asp.press === 'squeezed') {
            g.fillStyle = 'rgba(40,24,16,.2)';
            g.fillRect(p.x - 18, p.y + 6, 36, 4);
          }
          if (this.toppings[i]) this.drawIng(this.topItem, p.x - 22, p.y - 16, 44, 10);
          if (this.wrapped || (s?.t === 'wrap' && this.wrapProgress > 0)) {
            g.fillStyle = NORI;
            const w = this.wrapped ? 1 : this.wrapProgress;
            if (this.r.id === 'onigiri') g.fillRect(p.x - 12, p.y + 2, 24 * w, 12);
            else g.fillRect(p.x - 19, p.y - 2, 38 * w, 6);
          }
          g.restore();
        }
      }
      for (const f of this.fillings) this.drawIng(f.id, f.x - 6, f.y - 4, 12, 8);
    }
    // slicing station
    if (s?.t === 'slice') {
      const x0 = Math.round((W - 180) / 2);
      const y0 = Math.round(H * 0.25);
      const w = 180;
      g.fillStyle = '#e6c79b';
      g.fillRect(x0 - 10, y0 - 10, w + 20, 80);
      const n = this.sliceNeeded + 1;
      const pw = w / n;
      for (let i = 0; i < n; i++) {
        const sep = i <= this.sliceDone ? 3 : 0;
        // a missed cut leaves its piece a little crooked
        const jag = i > 0 && i <= this.sliceDone && this.fishCuts[i - 1] === 'miss' ? (i % 2 ? 3 : -3) : 0;
        this.drawIng(this.sliceItem, x0 + i * pw + i * sep * 0.6, y0 + 10 + jag, pw - 2, 40);
      }
      g.fillStyle = 'rgba(246,236,214,.75)';
      for (let i = this.sliceDone + 1; i < n; i++) for (let y = y0; y < y0 + 60; y += 6) g.fillRect(x0 + i * pw, y, 1, 3);
    }
    // wrap hint arrow
    if (s?.t === 'wrap' && !this.wrapped) {
      g.fillStyle = 'rgba(246,236,214,.8)';
      const bx = (W - 160) / 2;
      g.fillRect(bx, H - 30, 160 * this.wrapProgress, 4);
      g.fillRect(bx, H - 32, 2, 8);
      g.fillRect(bx + 158, H - 32, 2, 8);
    }
    // garnish on top
    for (const f of this.garnish) this.drawIng(f.id, f.x - 6, f.y - 3, 12, 6);
    // plate
    if (s?.t === 'plate') {
      const box = this.plateBox();
      drawCookingPlate(g, box.cx, box.cy, box.rx, box.ry, recipePresentation(this.r.id));
      for (let i = 0; i < this.plated; i++) {
        const pos = this.platedPosition(i, this.plateNeeded, box.cx, box.cy);
        this.drawRollSlice(pos.x, pos.y, 18, 18, true);
      }
      const waiting = this.plateNeeded - this.plated;
      for (let i = 0; i < waiting; i++) this.drawRollSlice(16 + i * 22, 28, 18, 18, true);
      if (this.finger && waiting > 0) this.drawRollSlice(this.finger.x - 7, this.finger.y - 8, 14, 14, true);
      g.fillStyle = '#4a3428';
      g.font = '12px "Pixelify Sans", sans-serif';
      g.fillText(`${this.plated}/${this.plateNeeded}`, box.cx - 12, box.cy - box.ry - 8);
    }
    // roll hint
    if (s?.t === 'roll') {
      g.fillStyle = 'rgba(246,236,214,.85)';
      g.fillRect(W - 14, 80, 6, 90);
      g.fillStyle = '#c27f86';
      g.fillRect(W - 14, 170 - 90 * this.rollProgress, 6, 90 * this.rollProgress);
      g.fillStyle = 'rgba(246,236,214,.85)';
      g.beginPath();
      g.moveTo(W - 11, 64);
      g.lineTo(W - 19, 76);
      g.lineTo(W - 3, 76);
      g.fill();
    }
    if (s?.t === 'slice' && this.sliceDone < this.sliceNeeded) this.drawFishBar();
    if (s?.t === 'cone' || this.coned) this.drawCone();
    if (s?.t === 'cut' && this.swipe && this.finger) {
      g.strokeStyle = 'rgba(246,236,214,.9)';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(Math.round(this.swipe.x), Math.round(this.swipe.y));
      g.lineTo(Math.round(this.finger.x), Math.round(this.finger.y));
      g.stroke();
    }
    if (this.knifeStroke && !settings.reduceMotion) {
      const k = this.knifeStroke;
      const travel = Math.sin((k.age / 0.24) * Math.PI) * 16;
      drawCookingKnife(g, k.x, k.y - 15 + travel);
    } else if ((s?.t === 'slice' || s?.t === 'cut') && !this.advancing) {
      // Resting tool also identifies the cutting station with reduced motion.
      drawCookingKnife(g, W - 24, 18);
    }
    if (this.landing && !settings.reduceMotion) {
      const l = this.landing;
      const d = Math.round(4 + l.age * 25);
      g.fillStyle = '#fff1c5';
      for (const dir of [-1, 1]) {
        g.fillRect(Math.round(l.x) + dir * d, Math.round(l.y) - 2, 2, 4);
        g.fillRect(Math.round(l.x) - 2, Math.round(l.y) + dir * d, 4, 2);
      }
    }
    if (this.heatOn) this.drawHeat();
    if (this.pressOn) this.drawPress();
    if (s?.t === 'rice' && this.riceAdded) this.drawRiceMeter();
    for (const bit of this.bits) {
      g.globalAlpha = Math.max(0, bit.t * 2);
      g.fillStyle = bit.c;
      g.fillRect(Math.round(bit.x), Math.round(bit.y), 2, 2);
      g.globalAlpha = 1;
    }
    if (this.verdict) this.drawVerdict();
    // sparkles
    for (const sp of settings.reduceMotion ? [] : this.sparkles) {
      g.fillStyle = `rgba(242,198,109,${Math.max(0, sp.t * 2)})`;
      const r = (0.6 - sp.t) * 30;
      for (let a = 0; a < 6; a++) g.fillRect(sp.x + Math.cos(a) * r, sp.y + Math.sin(a) * r, 2, 2);
    }
    this.sparkles = this.sparkles.filter((s2) => s2.t > 0);
  }

  private slotAt(index: number, total: number) {
    const m = this.mat;
    return { x: m.x + ((index + 1) / (total + 1)) * m.w, y: m.y + m.h * 0.62 };
  }

  private drawHeat() {
    const g = this.g;
    const band = heatWindow(settings.cookMode);
    const mark = heatMark(this.heatT, band.speed);
    const x = 28;
    const y = this.H - 26;
    const w = this.W - 56;
    g.fillStyle = '#4a3428';
    g.font = '11px "Pixelify Sans", sans-serif';
    g.fillText('Fuego', x, y - 4);
    g.fillStyle = 'rgba(40,24,16,.35)';
    g.fillRect(x + 1, y + 2, w, 12);
    g.fillStyle = '#6b4330';
    g.fillRect(x, y, w, 10);
    const sweet = w * band.half * 2;
    g.fillStyle = '#e7b15a';
    g.fillRect(x + w / 2 - sweet / 2, y, sweet, 10);
    g.fillStyle = '#f6ecd6';
    g.fillRect(x + mark * w - 2, y - 2, 4, 14);
  }

  private drawMeter(label: string, value: number, lo: number, hi: number) {
    const g = this.g;
    const x = 28;
    const y = this.H - 26;
    const w = this.W - 56;
    g.fillStyle = '#4a3428';
    g.font = '11px "Pixelify Sans", sans-serif';
    g.fillText(label, x, y - 4);
    g.fillStyle = 'rgba(40,24,16,.35)';
    g.fillRect(x + 1, y + 2, w, 12);
    g.fillStyle = '#6b4330';
    g.fillRect(x, y, w, 10);
    g.fillStyle = '#7fa356';
    g.fillRect(x + w * lo, y, w * (hi - lo), 10);
    g.fillStyle = '#f6ecd6';
    const fx = x + Math.max(0, Math.min(1, value)) * w;
    g.fillRect(fx - 2, y - 2, 4, 14);
  }

  private drawFishBar() {
    const g = this.g;
    const z = fishCutZones(settings.cookMode, game.save.restaurant.upgrades.includes('knife'));
    const x = 28;
    const y = this.H - 26;
    const w = this.W - 56;
    g.fillStyle = '#4a3428';
    g.font = '11px "Pixelify Sans", sans-serif';
    g.fillText(`Corte ${Math.min(this.sliceDone + 1, this.sliceNeeded)} de ${this.sliceNeeded}`, x, y - 4);
    g.fillStyle = 'rgba(40,24,16,.35)';
    g.fillRect(x + 1, y + 2, w, 12);
    g.fillStyle = '#6b4330';
    g.fillRect(x, y, w, 10);
    g.fillStyle = '#7fa356';
    g.fillRect(x + w * (0.5 - z.good), y, w * z.good * 2, 10);
    g.fillStyle = '#f2c66d';
    g.fillRect(x + w * (0.5 - z.perfect), y, w * z.perfect * 2, 10);
    g.fillStyle = '#f6ecd6';
    g.fillRect(x + this.sliceMark() * w - 2, y - 2, 4, 14);
  }

  /** Temaki: a corner of the nori folds over into a cone as the finger travels up and to the right. */
  private drawCone() {
    const g = this.g;
    const m = this.mat;
    const p = this.coned ? 1 : this.coneProgress;
    if (p <= 0 || this.step?.t === 'plate') return;
    g.fillStyle = NORI;
    g.beginPath();
    g.moveTo(m.x, m.y + m.h);
    g.lineTo(m.x + m.w * p * 0.9, m.y + m.h);
    g.lineTo(m.x + m.w * p * 0.45, m.y + m.h - m.h * p);
    g.closePath();
    g.fill();
    g.fillStyle = '#3d4b40';
    g.fillRect(m.x, m.y + m.h - 2, Math.max(1, m.w * p * 0.9), 2);
  }

  private drawPress() {
    this.drawMeter(this.pressing ? 'Apretando…' : 'Mantené apretado', this.pressP, pressZone(settings.cookMode).lo, pressZone(settings.cookMode).hi);
  }

  private drawRiceMeter() {
    const st = riceStats(this.riceCover);
    if (st.coverage < 0.05) return;
    this.drawMeter('Grosor del arroz', st.mean / RICE_MAX_LAYERS, 1.55 / RICE_MAX_LAYERS, 2.55 / RICE_MAX_LAYERS);
  }

  /** The things the player did well or badly, shown on the finished dish. */
  private aspectLines(): string[] {
    const out: string[] = [];
    const a = this.asp;
    if (a.rice) out.push(`Arroz: ${a.rice === 'good' ? 'justo' : a.rice === 'thin' ? 'poco' : 'de más'}`);
    if (this.fillPrec.length) out.push(`Relleno: ${this.fillPrec.reduce((x, y) => x + y, 0) / this.fillPrec.length >= 0.65 ? 'bien acomodado' : 'desprolijo'}`);
    if (a.fish) out.push(`Corte del pescado: ${a.fish === 'clean' ? 'limpio' : a.fish === 'ok' ? 'aceptable' : 'irregular'}`);
    if (a.press) out.push(`${this.r.steps.some((st) => st.t === 'shape') ? 'Arroz moldeado' : 'Enrollado'}: ${a.press === 'firm' ? 'firme' : a.press === 'loose' ? 'flojo' : 'apretado'}`);
    if (a.cut != null) out.push(`Cortes: ${a.cut >= 0.8 ? 'parejos' : a.cut >= 0.5 ? 'casi parejos' : 'desparejos'}`);
    return out;
  }

  private platedPosition(i: number, total: number, cx: number, cy: number) {
    const columns = Math.min(4, total);
    const row = Math.floor(i / columns);
    const inRow = Math.min(columns, total - row * columns);
    return { x: cx - (inRow * 24) / 2 + (i % columns) * 24 + 3, y: cy - (total > 4 ? 20 : 10) + row * 20 };
  }

  private drawVerdict() {
    if (!this.verdict) return;
    const g = this.g;
    g.fillStyle = 'rgba(28,16,12,.72)';
    g.fillRect(0, 0, this.W, this.H);
    const box = { cx: this.W / 2, cy: Math.round(this.H * 0.36) + 8, rx: Math.min(86, this.W / 2 - 16), ry: 30 };
    drawCookingPlate(g, box.cx, box.cy, box.rx, box.ry, recipePresentation(this.r.id));
    const n = Math.min(8, Math.max(1, this.pieces || this.plateNeeded || 1));
    for (let i = 0; i < n; i++) {
      const pos = this.platedPosition(i, n, box.cx, box.cy);
      const crooked = this.verdict.quality === 0 ? (i % 2 ? 3 : -2) : 0;
      this.drawRollSlice(pos.x, pos.y + crooked, 18, 18, true);
    }
    // Garnishes reflect the existing quality result; they are not new rewards.
    if (this.verdict.quality >= 1) {
      kitchenOval(g, box.cx + box.rx - 19, box.cy + 3, 5, 3, '#f1a6a7');
      kitchenOval(g, box.cx + box.rx - 22, box.cy + 5, 4, 2, '#f7c8ba');
      kitchenOval(g, box.cx - box.rx + 18, box.cy + 2, 4, 3, '#91ad64');
    }
    if (this.verdict.quality === 2) {
      g.fillStyle = '#fff1b5';
      for (const [x, y] of [[box.cx - 42, box.cy - 25], [box.cx + 34, box.cy - 20]]) {
        g.fillRect(x, y - 2, 1, 5);
        g.fillRect(x - 2, y, 5, 1);
      }
    }
    g.font = '16px "Pixelify Sans", sans-serif';
    g.textAlign = 'center';
    for (let i = 0; i < 3; i++) {
      g.fillStyle = i <= this.verdict.quality ? '#ffd576' : '#8b7b68';
      g.fillText('★', this.W / 2 - 20 + i * 20, box.cy - box.ry - 14);
    }
    g.font = '11px "Pixelify Sans", sans-serif';
    g.fillStyle = '#fbf6ea';
    const lines = this.aspectLines();
    lines.push('Tocá para continuar');
    let y = box.cy + box.ry + 18;
    for (const line of lines) {
      const words = line.split(' ');
      let row = '';
      for (const word of words) {
        const next = row ? row + ' ' + word : word;
        if (row && g.measureText(next).width > this.W - 24) {
          g.fillText(row, this.W / 2, y);
          y += 12;
          row = word;
        } else row = next;
      }
      g.fillText(row, this.W / 2, y);
      y += 12;
    }
    g.textAlign = 'left';
  }

  private drawIng(id: string, x: number, y: number, w: number, hgt: number) {
    this.g.drawImage(cookingIngredient(id), Math.round(x), Math.round(y), Math.max(4, Math.round(w)), Math.max(3, Math.round(hgt)));
  }

  private drawRollSlice(x: number, y: number, w: number, hh: number, cut: boolean) {
    const g = this.g;
    g.fillStyle = 'rgba(40,24,16,.28)';
    g.fillRect(Math.round(x) + 1, Math.round(y) + 2, Math.round(w), Math.round(hh));
    const shapeOnly = !this.r.steps.some((st) => st.t === 'nori' || st.t === 'rice');
    if (shapeOnly) {
      // nigiri, onigiri and gunkan pieces
      const topItem = this.topItem || (this.r.steps.find((st) => st.t === 'top') as { item?: string } | undefined)?.item || 'rice';
      if (this.r.id === 'onigiri') {
        g.fillStyle = RICE;
        g.beginPath();
        g.moveTo(x + w / 2, y);
        g.lineTo(x, y + hh);
        g.lineTo(x + w, y + hh);
        g.closePath();
        g.fill();
        g.fillStyle = NORI;
        g.fillRect(x + w * 0.3, y + hh * 0.62, w * 0.4, hh * 0.38);
      } else if (this.r.id === 'gunkan') {
        kitchenOval(g, x + w / 2, y + hh * 0.55, w / 2, hh * 0.45, NORI);
        kitchenOval(g, x + w / 2, y + hh * 0.22, w / 2 - 1, hh * 0.22, ingColor(topItem));
        g.fillStyle = '#ffd58d';
        for (let i = 2; i < w - 2; i += 3) g.fillRect(Math.round(x + i), Math.round(y + (i % 2) + 2), 1, 1);
      } else {
        kitchenOval(g, x + w / 2, y + hh * 0.66, w / 2, hh * 0.32, RICE);
        this.drawIng(topItem, x - 1, y, w + 2, hh * 0.65);
        g.fillStyle = 'rgba(255,255,255,.4)';
        g.fillRect(x + 1, y + hh * 0.2, w - 2, 1);
      }
      return;
    }
    if (this.r.id === 'temaki') {
      g.fillStyle = NORI;
      g.beginPath();
      g.moveTo(x, y + hh);
      g.lineTo(x + w, y + hh);
      g.lineTo(x + w * 0.35, y);
      g.closePath();
      g.fill();
      const f = this.fillings[0]?.id ?? 'cucumber';
      g.fillStyle = ingColor(f);
      g.fillRect(x + w * 0.2, y - 2, Math.max(2, w * 0.35), 3);
      g.fillStyle = RICE;
      g.fillRect(x + w * 0.38, y + hh * 0.45, Math.max(2, w * 0.3), 2);
      return;
    }
    const inside = this.r.steps.some((s) => s.t === 'garnish') && this.r.icon.type === 'uramaki';
    const round = cut && w <= 26;
    if (round) kitchenOval(g, x + w / 2, y + hh / 2, w / 2, hh / 2, inside ? RICE : NORI);
    else {
      g.fillStyle = inside ? RICE : NORI;
      g.fillRect(x, y, w, hh);
    }
    if (!cut) return;
    // the rice layer and the pressure the player used show in the cross-section
    const margin = this.asp.rice === 'thin' ? 3 : this.asp.rice === 'thick' ? 1 : 2;
    if (round) kitchenOval(g, x + w / 2, y + hh / 2, w / 2 - margin, hh / 2 - margin, inside ? NORI : RICE);
    else {
      g.fillStyle = inside ? NORI : RICE;
      g.fillRect(x + margin, y + margin, w - margin * 2, hh - margin * 2);
    }
    const squeezed = this.asp.press === 'squeezed';
    const loose = this.asp.press === 'loose';
    const fills = this.fillings.length ? this.fillings : [{ id: 'cucumber' }];
    const fw = Math.max(1, Math.floor((w - 8) / fills.length));
    fills.forEach((f, i) => {
      g.fillStyle = ingColor(f.id);
      const bulge = squeezed ? 2 : 0;
      g.fillRect(x + 4 + i * fw - (i === 0 ? bulge : 0), y + hh / 2 - 3 - bulge, fw + (i === 0 || i === fills.length - 1 ? bulge : 0), 6 + bulge * 2);
    });
    g.fillStyle = '#ffffff';
    for (let i = 0; i < Math.floor(w / 5); i++) g.fillRect(Math.round(x + 3 + i * 4), Math.round(y + hh - margin - 2), 2, 1);
    g.fillStyle = inside ? '#e3dfcb' : '#51634a';
    g.fillRect(Math.round(x + 1), Math.round(y), Math.max(1, Math.round(w - 2)), 1);
    if (loose) {
      // a loose roll opens a little seam along the top
      g.fillStyle = 'rgba(40,24,16,.55)';
      g.fillRect(x + 2, y + 1, Math.max(2, w - 4), 1);
      g.fillRect(x + w - 3, y + 1, 1, 4);
    }
  }
}
