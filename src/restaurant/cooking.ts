/**
 * Sushi preparation minigame. A full-screen canvas board drives each recipe step:
 * drag ingredients, spread rice by rubbing, slice with swipes, roll with upward swipes,
 * cut the roll, shape rice by tapping, wrap, garnish and plate.
 * Modes: relaxed (default, no timer), normal (scored), challenge (optional timer).
 */
import { iconCanvas, iconElement } from '../art/icons';
import { audio } from '../audio/audio';
import { settings } from '../core/settings';
import { game } from '../core/state';
import { ITEMS_BY_ID, INGREDIENT_ALIASES } from '../data/items';
import { RECIPES_BY_ID, type CookStep, type RecipeDef } from '../data/recipes';
import { h, openModal, sleep } from '../ui/dom';

export interface CookResult { ok: boolean; quality: 0 | 1 | 2; score: number; variant?: string; variantBonus: number; }

const STEP_NAMES: Record<CookStep['t'], string> = {
  nori: 'Alga', rice: 'Arroz', place: 'Relleno', slice: 'Cortar', roll: 'Enrollar', cut: 'Porciones',
  shape: 'Moldear', top: 'Cubrir', wrap: 'Envolver', garnish: 'Decorar', plate: 'Emplatar',
};

const STEP_HELP: Record<CookStep['t'], string> = {
  nori: 'Arrastrá el alga a la esterilla.',
  rice: 'Arrastrá el arroz y frotá con el dedo para esparcirlo.',
  place: 'Arrastrá los ingredientes del relleno sobre el arroz.',
  slice: 'Deslizá el dedo de arriba hacia abajo sobre las líneas para cortar.',
  roll: 'Deslizá hacia arriba varias veces para enrollar.',
  cut: 'Deslizá de arriba hacia abajo sobre las marcas para cortar.',
  shape: 'Tocá el arroz para moldear cada bolita.',
  top: 'Arrastrá la cobertura sobre cada bolita.',
  wrap: 'Deslizá de izquierda a derecha para envolver con alga.',
  garnish: 'Arrastrá los ingredientes para decorar.',
  plate: 'Arrastrá las piezas al plato.',
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

class CookingGame {
  private root!: HTMLElement;
  private canvas!: HTMLCanvasElement;
  private g!: CanvasRenderingContext2D;
  private tray!: HTMLElement;
  private msg!: HTMLElement;
  private stepsEl!: HTMLElement;
  private timerEl!: HTMLElement;
  private close!: () => void;
  private stepIdx = 0;
  private W = 320;
  private H = 240;
  private S = 1; // css px per board px
  // board state
  private noriPlaced = false;
  private riceCover = new Uint8Array(24 * 10);
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
  private timeLimit = 0;
  private sparkles: { x: number; y: number; t: number }[] = [];

  constructor(private r: RecipeDef, private title: string, private finish: (r: CookResult) => void) {}

  start() {
    // portrait phones get a taller, narrower board so it fills the screen
    if (window.innerHeight > window.innerWidth * 1.15) {
      this.W = 220;
      this.H = 300;
    }
    this.mat = { x: Math.round((this.W - 192) / 2), y: Math.round(this.H * 0.3), w: 192, h: 100 };
    const mode = settings.cookMode;
    if (mode === 'challenge') this.timeLimit = 40 + this.r.steps.length * 12;
    this.stepsEl = h('div', { class: 'cook-steps' });
    this.timerEl = h('div', { class: 'pill' });
    this.msg = h('div', { class: 'cook-msg' });
    this.canvas = h('canvas', { class: 'board' }) as HTMLCanvasElement;
    const stage = h('div', { class: 'cook-stage' }, this.canvas, this.msg);
    this.tray = h('div', { class: 'cook-tray' });
    const head = h(
      'div',
      { class: 'cook-head' },
      h('div', { class: 'cook-order' }, iconElement(this.r.icon), h('div', { class: 'col', style: { gap: '2px' } }, h('b', null, this.r.name + (this.title ? ` — ${this.title}` : '')), this.stepsEl)),
      h('div', { class: 'col', style: { alignItems: 'flex-end', gap: '4px' } }, this.timerEl, h('button', { class: 'close-x', 'aria-label': 'Salir', onclick: () => this.abort() }, '✕')),
    );
    this.root = h('div', { class: 'cook' }, head, stage, this.tray);
    this.close = openModal(this.root);
    (this.root as any).__close = () => this.abort();
    this.g = this.canvas.getContext('2d')!;
    this.bindInput();
    this.resize();
    window.addEventListener('resize', this.resize);
    // optional variant ingredient (adds bonus)
    const v = this.r.variants?.find((vv) => game.countUsable(vv.item) > 0);
    if (v) this.variant = v;
    this.enterStep();
    this.loop();
  }

  private resize = () => {
    const rect = this.canvas.parentElement!.getBoundingClientRect();
    this.S = Math.max(0.5, Math.min(rect.width / this.W, rect.height / this.H));
    this.canvas.width = this.W;
    this.canvas.height = this.H;
    this.canvas.style.width = this.W * this.S + 'px';
    this.canvas.style.height = this.H * this.S + 'px';
    this.canvas.style.left = (rect.width - this.W * this.S) / 2 + 'px';
    this.canvas.style.top = (rect.height - this.H * this.S) / 2 + 'px';
    this.g.imageSmoothingEnabled = false;
  };

  private get step(): CookStep {
    return this.r.steps[this.stepIdx];
  }

  private renderSteps() {
    this.stepsEl.innerHTML = '';
    this.r.steps.forEach((s, i) => this.stepsEl.append(h('span', { class: 's' + (i < this.stepIdx ? ' done' : i === this.stepIdx ? ' now' : '') }, STEP_NAMES[s.t])));
  }

  private say(t: string) {
    this.msg.textContent = t;
  }

  private enterStep() {
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
        break;
      case 'place':
        this.needPlace = [...s.items];
        for (const id of new Set(s.items)) this.addTrayItem(id);
        if (this.variant) this.addTrayItem(this.variant.item, true);
        break;
      case 'slice':
        this.sliceItem = s.item;
        this.sliceDone = 0;
        this.sliceNeeded = game.save.restaurant.upgrades.includes('knife') ? Math.max(1, s.cuts - 1) : s.cuts;
        break;
      case 'roll':
        this.rollProgress = 0;
        break;
      case 'cut':
        this.cutsDone = 0;
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
      case 'garnish':
        this.needGarnish = [...s.items];
        for (const id of new Set(s.items)) this.addTrayItem(id);
        if (this.variant && !this.r.steps.some((st) => st.t === 'place')) this.addTrayItem(this.variant.item, true);
        break;
      case 'plate':
        this.plated = 0;
        this.plateNeeded = Math.min(this.pieces || 1, 8);
        this.say(STEP_HELP.plate + ' (o tocá "Servir todo")');
        this.tray.append(h('button', { class: 'btn primary', onclick: () => { this.plated = this.plateNeeded; audio.sfxPlay('place'); this.checkStep(); } }, 'Servir todo'));
        break;
    }
  }

  private addTrayItem(id: string, optional = false) {
    const it = ITEMS_BY_ID[id];
    const el = h('div', { class: 'ing', 'data-id': id }, iconElement(it?.icon ?? { type: 'blob' }), h('span', null, (it?.name ?? id).split(' ')[0] + (optional ? ' ★' : '')));
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
      const p = this.toBoard(e);
      this.swipe = { ...p, t: performance.now() };
      this.onTap(p.x, p.y);
    });
    c.addEventListener('pointermove', (e) => {
      if (!this.swipe) return;
      const p = this.toBoard(e);
      this.onRub(p.x, p.y, this.swipe);
    });
    c.addEventListener('pointerup', (e) => {
      if (!this.swipe) return;
      const p = this.toBoard(e);
      this.onSwipe(this.swipe, p);
      this.swipe = null;
    });
    c.addEventListener('pointercancel', () => (this.swipe = null));
  }

  private startDrag(e: PointerEvent, id: string, optional: boolean) {
    e.preventDefault();
    const ghost = h('canvas', { class: 'drag-ghost' }) as HTMLCanvasElement;
    ghost.width = 16;
    ghost.height = 16;
    ghost.getContext('2d')!.drawImage(iconCanvas(ITEMS_BY_ID[id]?.icon ?? { type: 'blob' }), 0, 0);
    document.body.append(ghost);
    const move = (ev: PointerEvent) => {
      ghost.style.left = ev.clientX + 'px';
      ghost.style.top = ev.clientY + 'px';
    };
    move(e);
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      ghost.remove();
      const rect = this.canvas.getBoundingClientRect();
      if (ev.clientX < rect.left || ev.clientX > rect.right || ev.clientY < rect.top || ev.clientY > rect.bottom) return;
      const p = this.toBoard(ev);
      this.onDrop(id, p.x, p.y, optional);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  private mat = { x: 64, y: 70, w: 192, h: 100 };

  private inMat(x: number, y: number) {
    const m = this.mat;
    return x >= m.x && x <= m.x + m.w && y >= m.y && y <= m.y + m.h;
  }

  private onDrop(id: string, x: number, y: number, optional: boolean) {
    const s = this.step;
    if (!s) return;
    if (optional && this.variant && id === this.variant.item) {
      this.garnish.push({ id, x, y });
      audio.sfxPlay('place');
      this.say(`¡Variante ${this.variant.name}!`);
      (this.tray.querySelector(`[data-id="${id}"]`) as HTMLElement)?.classList.add('empty');
      (this as any).variantUsed = true;
      return;
    }
    switch (s.t) {
      case 'nori':
        if (id === 'nori' && this.inMat(x, y)) {
          this.noriPlaced = true;
          audio.sfxPlay('place');
          this.checkStep();
        } else this.miss('Soltalo sobre la esterilla de bambú.');
        break;
      case 'rice':
        if (id === 'rice' && this.inMat(x, y)) {
          this.riceAdded = true;
          audio.sfxPlay('place');
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
          (s.t === 'place' ? this.fillings : this.garnish).push({ id, x, y });
          audio.sfxPlay('place');
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
  }

  private rub(x: number, y: number, r = 1) {
    if (!this.riceAdded) return;
    const m = this.mat;
    const cx = Math.floor(((x - m.x) / m.w) * 24);
    const cy = Math.floor(((y - m.y) / m.h) * 10);
    let changed = false;
    for (let j = -r; j <= r; j++)
      for (let i = -r - 1; i <= r + 1; i++) {
        const gx = cx + i;
        const gy = cy + j;
        if (gx < 0 || gy < 0 || gx >= 24 || gy >= 10) continue;
        if (!this.riceCover[gy * 24 + gx]) {
          this.riceCover[gy * 24 + gx] = 1;
          changed = true;
        }
      }
    if (changed) this.checkStep();
  }

  private riceRatio() {
    let n = 0;
    for (const v of this.riceCover) n += v;
    return n / this.riceCover.length;
  }

  private onTap(x: number, y: number) {
    const s = this.step;
    if (!s) return;
    if (s.t === 'shape') {
      const idx = this.balls < this.ballsNeeded ? this.balls : -1;
      if (idx < 0) return;
      this.ballTaps[idx]++;
      audio.sfxPlay('tap');
      if (this.ballTaps[idx] >= 3) {
        this.balls++;
        audio.sfxPlay('place');
        this.sparkles.push({ x: this.ballPos(idx).x, y: this.ballPos(idx).y, t: 0.6 });
        this.checkStep();
      }
      void x;
      void y;
    } else if (s.t === 'plate') {
      if (this.plated < this.plateNeeded) {
        this.plated++;
        audio.sfxPlay('place');
        this.checkStep();
      }
    }
  }

  private onRub(x: number, y: number, start: { x: number; y: number }) {
    const s = this.step;
    if (s?.t === 'rice' && this.riceAdded) this.rub(x, y, 1);
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
    const s = this.step;
    if (!s) return;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    if (s.t === 'slice' || s.t === 'cut') {
      if (dy > 35 && Math.abs(dx) < 50) {
        if (s.t === 'slice') this.sliceDone++;
        else this.cutsDone++;
        audio.sfxPlay('cut');
        this.sparkles.push({ x: b.x, y: (a.y + b.y) / 2, t: 0.4 });
        this.checkStep();
      } else if (Math.hypot(dx, dy) > 25) this.say('Cortá de arriba hacia abajo.');
    }
    if (s.t === 'roll') {
      if (dy < -30) {
        this.rollProgress = Math.min(1, this.rollProgress + (game.save.restaurant.upgrades.includes('bamboo') ? 0.5 : 0.34));
        audio.sfxPlay('roll');
        if (this.rollProgress >= 1) this.rolled = true;
        this.checkStep();
      } else if (Math.hypot(dx, dy) > 25) this.say('Deslizá hacia arriba para enrollar.');
    }
    if (s.t === 'plate' && dy > 20 && this.plated < this.plateNeeded) {
      this.plated++;
      audio.sfxPlay('place');
      this.checkStep();
    }
  }

  private checkStep() {
    const s = this.step;
    if (!s) return;
    let ok = false;
    switch (s.t) {
      case 'nori': ok = this.noriPlaced; break;
      case 'rice': {
        const ratio = this.riceRatio();
        if (this.riceAdded) this.say(`Arroz esparcido: ${Math.round(Math.min(1, ratio / 0.8) * 100)}%`);
        ok = ratio >= 0.8;
        break;
      }
      case 'place': ok = this.needPlace.length === 0; break;
      case 'slice': ok = this.sliceDone >= this.sliceNeeded; break;
      case 'roll': ok = this.rolled; break;
      case 'cut': ok = this.cutsDone >= this.cutsNeeded; break;
      case 'shape': ok = this.balls >= this.ballsNeeded; break;
      case 'top': ok = this.toppings.every(Boolean); break;
      case 'wrap': ok = this.wrapped; break;
      case 'garnish': ok = this.needGarnish.length === 0; break;
      case 'plate': ok = this.plated >= this.plateNeeded; break;
    }
    if (ok) this.nextStep();
  }

  private async nextStep() {
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
    const t = this.elapsed();
    const par = 10 + this.r.steps.length * 7;
    let quality: 0 | 1 | 2;
    if (mode === 'relaxed') quality = this.mistakes <= 2 ? 2 : 1;
    else {
      const score = Math.max(0, 100 - this.mistakes * 10 - Math.max(0, t - par) * 1.5);
      quality = score >= 80 ? 2 : score >= 50 ? 1 : 0;
      if (mode === 'challenge' && this.timeLimit && t <= this.timeLimit) quality = Math.min(2, quality + 1) as 0 | 1 | 2;
    }
    const used = (this as any).variantUsed && this.variant;
    if (used && this.variant) game.consumeIngredients({ [this.variant.item]: 1 });
    audio.sfxPlay('success');
    this.say(['¡Listo!', '¡Muy bien!', '¡Perfecto!'][quality]);
    this.renderSteps();
    setTimeout(() => {
      this.cleanup();
      this.finish({ ok: true, quality, score: quality, variant: used ? this.variant!.name : undefined, variantBonus: used ? this.variant!.bonus : 0 });
    }, 900);
  }

  private abort() {
    if (this.done) return;
    this.done = true;
    this.cleanup();
    this.finish({ ok: false, quality: 0, score: 0, variantBonus: 0 });
  }

  private cleanup() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.resize);
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
    // counter wood background
    g.fillStyle = '#8a5a3c';
    g.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += 12) {
      g.fillStyle = '#7b4f35';
      g.fillRect(0, y, W, 1);
    }
    const s = this.step;
    const usesMat = this.r.steps.some((st) => st.t === 'nori' || st.t === 'rice');
    const m = this.mat;
    const shapeMode = !usesMat;
    if (!shapeMode) {
      // bamboo mat
      g.fillStyle = '#cdb27a';
      g.fillRect(m.x - 6, m.y - 6, m.w + 12, m.h + 12);
      for (let x = m.x - 6; x < m.x + m.w + 6; x += 6) {
        g.fillStyle = '#b39660';
        g.fillRect(x, m.y - 6, 1, m.h + 12);
      }
      const rollP = this.rolled ? 1 : this.rollProgress;
      const visH = m.h * (1 - rollP * 0.85);
      if (this.noriPlaced && !this.rolled) {
        g.fillStyle = NORI;
        g.fillRect(m.x, m.y + m.h - visH, m.w, visH);
      }
      // rice coverage
      if (this.riceAdded && !this.rolled) {
        const cw = m.w / 24;
        const ch = m.h / 10;
        for (let j = 0; j < 10; j++)
          for (let i = 0; i < 24; i++) {
            if (!this.riceCover[j * 24 + i]) continue;
            const yy = m.y + j * ch;
            if (yy < m.y + m.h - visH) continue;
            g.fillStyle = (i + j) % 3 ? RICE : '#efe8d8';
            g.fillRect(Math.floor(m.x + i * cw), Math.floor(yy), Math.ceil(cw), Math.ceil(ch));
          }
        if (s?.t === 'rice' && this.riceRatio() < 0.05) {
          g.fillStyle = RICE;
          g.beginPath();
          g.arc(m.x + m.w / 2, m.y + m.h / 2, 14, 0, Math.PI * 2);
          g.fill();
        }
      }
      if (!this.rolled) for (const f of this.fillings) this.drawIng(f.id, m.x + 16, Math.min(Math.max(f.y, m.y + m.h - visH + 6), m.y + m.h - 12), m.w - 32, 8);
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
        const n = s?.t === 'cut' ? 1 + this.cutsDone : this.pieces || 6;
        const total = n;
        const pw = (m.w - (total - 1) * 4) / total;
        for (let i = 0; i < total; i++) {
          const px = m.x + i * (pw + 4);
          const py = m.y + m.h / 2 - 14;
          this.drawRollSlice(px, py, pw, 28, s?.t === 'cut' ? this.cutsDone > 0 : true);
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
          g.font = '10px sans-serif';
          g.fillText('toc ' + (3 - taps), p.x - 12, p.y + 30);
        } else if (formed) {
          g.fillStyle = RICE;
          if (this.r.id === 'onigiri') {
            g.beginPath();
            g.moveTo(p.x, p.y - 22);
            g.lineTo(p.x - 20, p.y + 14);
            g.lineTo(p.x + 20, p.y + 14);
            g.closePath();
            g.fill();
          } else g.fillRect(p.x - 18, p.y - 8, 36, 18);
          if (this.toppings[i]) this.drawIng(this.topItem, p.x - 22, p.y - 16, 44, 10);
          if (this.wrapped || (s?.t === 'wrap' && this.wrapProgress > 0)) {
            g.fillStyle = NORI;
            const w = this.wrapped ? 1 : this.wrapProgress;
            if (this.r.id === 'onigiri') g.fillRect(p.x - 12, p.y + 2, 24 * w, 12);
            else g.fillRect(p.x - 19, p.y - 2, 38 * w, 6);
          }
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
        this.drawIng(this.sliceItem, x0 + i * pw + i * sep * 0.6, y0 + 10, pw - 2, 40);
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
      g.fillStyle = '#d8d2c8';
      g.beginPath();
      g.ellipse(W / 2, H - 40, Math.min(90, W / 2 - 10), 26, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#fbf6ea';
      g.beginPath();
      g.ellipse(W / 2, H - 43, Math.min(82, W / 2 - 18), 21, 0, 0, Math.PI * 2);
      g.fill();
      for (let i = 0; i < this.plated; i++) {
        const x = W / 2 - 64 + (i % 8) * 16;
        this.drawRollSlice(x, H - 52, 14, 14, true);
      }
      g.fillStyle = 'rgba(246,236,214,.9)';
      g.font = '11px sans-serif';
      g.fillText(`Piezas: ${this.plated}/${this.plateNeeded}`, W / 2 - 30, H - 80);
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
    // sparkles
    for (const sp of this.sparkles) {
      sp.t -= 1 / 60;
      g.fillStyle = `rgba(242,198,109,${Math.max(0, sp.t * 2)})`;
      const r = (0.6 - sp.t) * 30;
      for (let a = 0; a < 6; a++) g.fillRect(sp.x + Math.cos(a) * r, sp.y + Math.sin(a) * r, 2, 2);
    }
    this.sparkles = this.sparkles.filter((s2) => s2.t > 0);
  }

  private drawIng(id: string, x: number, y: number, w: number, hgt: number) {
    const g = this.g;
    const c = ingColor(id);
    g.fillStyle = c;
    g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(hgt));
    g.fillStyle = 'rgba(255,255,255,.25)';
    g.fillRect(Math.round(x), Math.round(y), Math.round(w), 1);
    const it = ITEMS_BY_ID[id];
    if (it?.icon.type === 'flakes' || it?.icon.type === 'roe') {
      g.fillStyle = 'rgba(42,34,48,.25)';
      for (let i = 0; i < w; i += 3) g.fillRect(x + i, y + ((i * 7) % Math.max(1, hgt)), 1, 1);
    }
  }

  private drawRollSlice(x: number, y: number, w: number, hh: number, cut: boolean) {
    const g = this.g;
    const inside = this.r.steps.some((s) => s.t === 'garnish') && this.r.icon.type === 'uramaki';
    g.fillStyle = inside ? RICE : NORI;
    g.fillRect(x, y, w, hh);
    if (!cut) return;
    g.fillStyle = inside ? NORI : RICE;
    g.fillRect(x + 2, y + 2, w - 4, hh - 4);
    const fills = this.fillings.length ? this.fillings : [{ id: 'cucumber' }];
    const fw = Math.max(1, Math.floor((w - 8) / fills.length));
    fills.forEach((f, i) => {
      g.fillStyle = ingColor(f.id);
      g.fillRect(x + 4 + i * fw, y + hh / 2 - 3, fw, 6);
    });
  }
}
