/**
 * Cooking as a short act (the default way to cook inside the restaurant). Sofi works in the real kitchen, the camera frames
 * her, and this panel asks for one simple thing at a time: tap on the beat, hold to the gold mark, or pick the right
 * ingredients. Same contract as the preparation board (`KitchenBoard`), so the kitchen session treats both alike.
 */
import { haptic } from '../core/haptics';
import { iconElement } from '../art/icons';
import { cookingIngredient } from '../art/cooking';
import { audio } from '../audio/audio';
import { settings } from '../core/settings';
import { game } from '../core/state';
import { ITEMS_BY_ID } from '../data/items';
import type { CookStep, RecipeDef } from '../data/recipes';
import { challengeLimit, judgeCook } from '../restaurant/cookScore';
import { doneness } from '../restaurant/grill';
import { world } from '../scenes/WorldScene';
import { h } from '../ui/dom';
import type { CookHost, CookResult } from './board';
import { holdScore, holdSeconds, holdTolerance, itemsScore, planBeats, pulsePeriod, pulseScore, tapPeriod, type Beat, type CookModeName, type Station, type Verdict } from './beats';

const STEP_NAMES: Record<CookStep['t'], string> = {
  nori: 'Alga', rice: 'Arroz', place: 'Relleno', slice: 'Cortar', roll: 'Enrollar', cut: 'Porciones',
  shape: 'Moldear', top: 'Cubrir', wrap: 'Envolver', cone: 'Cono', garnish: 'Decorar', cook: 'Cocinar', plate: 'Emplatar',
};
/** where Sofi stands for each station of the kitchen (the row in front of the wall equipment) */
const SPOT: Record<Station, { x: number; y: number }> = { stove: { x: 2, y: 3 }, rice: { x: 4, y: 3 }, board: { x: 5, y: 3 }, plate: { x: 6, y: 3 } };
const VERDICT: Record<Verdict, string> = { perfect: '¡Perfecto!', good: '¡Bien!', ok: 'Casi', miss: 'Uy…' };
const nameOf = (id: string) => (id === 'nori' ? 'Alga' : ITEMS_BY_ID[id]?.name ?? id);

export class KitchenAct {
  private root!: HTMLElement; private stepsEl!: HTMLElement; private progressEl!: HTMLElement; private msg!: HTMLElement; private feedback!: HTMLElement;
  private stage!: HTMLElement; private timerEl!: HTMLElement;
  private beats: Beat[] = []; private bi = 0;
  private done = false; private active = true; private raf = 0; private last = 0;
  /** seconds this dish has been on screen: pauses with it */
  private t = 0;
  private prec: number[] = []; private mistakes = 0;
  private cookRaw: { item: string; how: 'plancha' | 'sarten' | 'olla' }[] = [];
  private cookedPieces: { item: string; p: number }[] = [];
  private needPot = false; private waitItem: string | null = null;
  private variant: { item: string; name: string; bonus: number } | null = null; private variantUsed = false;
  private timeLimit = 0; private feedbackUntil = 0; private revealTimer = 0; private finishNow: (() => void) | null = null;
  /** what the current beat is doing each frame */
  private tick: ((dt: number) => void) | null = null;
  private onKey: ((down: boolean) => void) | null = null;
  private arrived = 0;
  private mode: CookModeName = 'relaxed';

  constructor(private r: RecipeDef, private title: string, private finish: (r: CookResult) => void, private host?: CookHost) {}

  // ------------------------------------------------------------------ the contract shared with the board
  get recipe() { return this.r; }
  get rawPieces() { return this.cookRaw; }
  takeRaw(i: number) { return this.cookRaw.splice(i, 1)[0] ?? null; }
  putCooked(item: string, p: number) { this.cookedPieces.push({ item, p }); this.tryWait(); }
  get waitingFor(): string | null { return !this.done && this.waitItem ? this.waitItem : null; }
  get customer() { return this.title; }
  get finished() { return this.done; }
  get progress() { return this.done ? 1 : (this.beats[this.bi]?.step ?? 0) / Math.max(1, this.r.steps.length); }
  get stepName() { return this.done ? '¡Listo!' : STEP_NAMES[this.r.steps[this.beats[this.bi]?.step ?? 0]?.t ?? 'plate']; }

  setActive(on: boolean) {
    if (this.done || on === this.active) return;
    this.active = on;
    if (!on) { cancelAnimationFrame(this.raf); this.root.style.display = 'none'; this.unbindKeys(); }
    else { this.last = 0; this.root.style.display = ''; this.bindKeys(); this.loop(); if (this.beats[this.bi]) void this.enterBeat(false); }
  }
  discard() { if (this.done) return; this.done = true; this.cleanup(); }

  // ------------------------------------------------------------------ start
  start() {
    this.mode = settings.cookMode;
    this.timeLimit = this.mode === 'challenge' ? challengeLimit(this.r.steps.length) : 0;
    this.cookRaw = this.r.steps.flatMap((st) => (st.t === 'cook' ? [{ item: st.item, how: st.how }] : []));
    this.needPot = !!this.host && this.r.steps.some((st) => st.t === 'rice' || st.t === 'shape');
    if (this.needPot) this.cookRaw.unshift({ item: 'rice', how: 'olla' });
    this.beats = planBeats(this.r, this.mode, this.needPot);
    this.variant = this.r.variants?.find((vv) => game.countUsable(vv.item) > 0) ?? null;
    this.stepsEl = h('div', { class: 'cook-steps' });
    this.timerEl = h('div', { class: 'pill' });
    this.progressEl = h('b', { class: 'cook-progress' });
    this.msg = h('div', { class: 'cook-msg', id: 'cook-instruction' });
    this.feedback = h('div', { class: 'cook-feedback', role: 'status', 'aria-live': 'polite' });
    this.stage = h('div', { class: 'act-stage' });
    const head = h('div', { class: 'cook-head' },
      h('div', { class: 'cook-order' }, iconElement(this.r.icon), h('div', { class: 'col', style: { gap: '2px' } }, h('b', null, this.r.name + (this.title ? ` — ${this.title}` : '')), this.stepsEl)),
      h('div', { class: 'col', style: { alignItems: 'flex-end', gap: '4px' } }, this.timerEl));
    this.root = h('div', { class: 'cook act' }, head, h('div', { class: 'cook-instruction' }, this.progressEl, h('div', { class: 'cook-guidance' }, this.msg, this.feedback)), this.stage);
    (this.host ? this.host.el : document.body).append(this.root);
    this.bindKeys();
    this.loop();
    void this.enterBeat(true);
  }

  private loop = () => {
    if (!this.active || this.done) return;
    const now = performance.now();
    const dt = this.last ? Math.min(0.1, (now - this.last) / 1000) : 0.016;
    this.last = now;
    this.t += dt;
    if (this.timeLimit) { const left = Math.max(0, this.timeLimit - this.t); this.timerEl.textContent = `⏱ ${Math.ceil(left)}s`; this.timerEl.classList.toggle('warn', left < 10); }
    if (this.feedbackUntil && now > this.feedbackUntil) { this.feedback.classList.remove('visible'); this.feedbackUntil = 0; }
    this.tick?.(dt);
    this.raf = requestAnimationFrame(this.loop);
  };

  private bindKeys() {
    this.unbindKeys();
    const down = (e: KeyboardEvent) => { if ((e.code === 'Space' || e.code === 'Enter') && !e.repeat && this.onKey) { e.preventDefault(); this.onKey(true); } };
    const up = (e: KeyboardEvent) => { if ((e.code === 'Space' || e.code === 'Enter') && this.onKey) { e.preventDefault(); this.onKey(false); } };
    window.addEventListener('keydown', down, true); window.addEventListener('keyup', up, true);
    this.keyOff = () => { window.removeEventListener('keydown', down, true); window.removeEventListener('keyup', up, true); };
  }
  private keyOff: (() => void) | null = null;
  private unbindKeys() { this.keyOff?.(); this.keyOff = null; }

  private renderSteps() {
    const cur = this.beats[this.bi]?.step ?? this.r.steps.length;
    this.stepsEl.replaceChildren(...this.r.steps.map((s, i) => h('span', { class: 's' + (i < cur || this.done ? ' done' : i === cur ? ' now' : ''), 'aria-current': i === cur && !this.done ? 'step' : null }, STEP_NAMES[s.t])));
    this.progressEl.textContent = this.done ? '¡Listo!' : `${Math.min(cur + 1, this.r.steps.length)}/${this.r.steps.length}`;
  }
  private say(t: string) { this.msg.textContent = t; }
  private respond(text: string, kind: 'good' | 'gentle' = 'good') { this.feedback.textContent = text; this.feedback.dataset.kind = kind; this.feedback.classList.add('visible'); this.feedbackUntil = performance.now() + 1100; }
  private sfxFor(b: Beat): string { const s = this.r.steps[b.step]?.t; return s === 'cut' || s === 'slice' ? 'cut' : s === 'roll' || s === 'cone' ? 'roll' : s === 'rice' || s === 'shape' ? 'rice' : 'place'; }
  private stageOn() { return !!world && world.cookActive && this.active && !this.done; }

  // ------------------------------------------------------------------ beats
  private async enterBeat(fresh: boolean) {
    const b = this.beats[this.bi];
    if (!b || this.done) return;
    this.tick = null; this.onKey = null;
    this.renderSteps();
    this.stage.replaceChildren();
    if (b.kind === 'wait') { this.startWait(b); return; }
    this.say(b.hint);
    const ticket = ++this.arrived;
    if (this.stageOn()) {
      world.cookPop(null);
      const spot = SPOT[b.station];
      await world.cookGo(spot.x, spot.y, b.station === 'plate' ? 'right' : 'up');
      if (ticket !== this.arrived || this.done || !this.active) return;
      world.cookPose(true);
    }
    void fresh;
    switch (b.kind) {
      case 'tap': this.runPulses(b, 1); break;
      case 'rhythm': this.runPulses(b, b.pulses ?? 3); break;
      case 'hold': this.runHold(b); break;
      case 'items': this.runItems(b); break;
    }
  }

  private beatDone(scores: number[], wrong = 0) {
    this.tick = null; this.onKey = null;
    const score = scores.length ? scores.reduce((a, c) => a + c, 0) / scores.length : 0.8;
    this.prec.push(score);
    if (this.mode !== 'relaxed') this.mistakes += wrong;
    if (this.stageOn()) world.cookPose(false);
    this.bi++;
    if (this.bi >= this.beats.length) { this.complete(); return; }
    setTimeout(() => { if (!this.done && this.active) void this.enterBeat(false); }, 350);
  }

  /** a ring closes on a circle: tap when they meet */
  private runPulses(b: Beat, pulses: number) {
    const period = b.kind === 'tap' ? tapPeriod(this.mode) : pulsePeriod(this.mode);
    const lead = 1.0;
    const t0 = this.t + lead;
    const hits = Array.from({ length: pulses }, (_, i) => t0 + (i + 1) * period);
    const target = h('div', { class: 'act-target' }, h('span', null, b.kind === 'tap' ? '¡Ahora!' : 'Tocá'));
    const ring = h('div', { class: 'act-ring' });
    const dots = h('div', { class: 'act-dots' }, ...hits.map(() => h('i')));
    const verdict = h('div', { class: 'act-verdict' });
    const pad = h('button', { type: 'button', class: 'act-pad', 'aria-label': b.title }, ring, target);
    this.stage.replaceChildren(pad, dots, verdict);
    const scores: number[] = [];
    let k = 0;
    const settle = (score: number, v: Verdict) => {
      scores.push(score);
      (dots.children[k] as HTMLElement).dataset.v = v;
      verdict.textContent = VERDICT[v]; verdict.dataset.v = v;
      if (this.stageOn()) { world.cookSpark(v); }
      audio.sfxPlay(v === 'miss' ? 'tap' : this.sfxFor(b));
      if (v === 'perfect') haptic('light' as never);
      k++;
      if (k >= pulses) { this.tick = null; this.onKey = null; setTimeout(() => this.beatDone(scores), 500); }
    };
    const press = () => {
      if (k >= pulses) return;
      const off = this.t - hits[k];
      if (off < -period * 0.55) { this.respond('Todavía… esperá el aro', 'gentle'); return; }
      const r = pulseScore(off, period, this.mode);
      settle(r.score, r.verdict);
    };
    pad.addEventListener('pointerdown', (e) => { e.preventDefault(); press(); });
    this.onKey = (down) => { if (down) press(); };
    this.tick = () => {
      if (k >= pulses) return;
      const left = hits[k] - this.t;
      const s = 1 + Math.max(0, Math.min(1, left / (period * 0.95))) * 1.5;
      ring.style.transform = `scale(${s.toFixed(3)})`;
      ring.style.opacity = left > period * 1.1 ? '0' : '1';
      if (this.t > hits[k] + period * 0.45) { press(); /* too late: counts as a miss */ }
    };
  }

  /** hold a button while the bar fills; let go on the gold mark */
  private runHold(b: Beat) {
    const target = b.target ?? 0.8;
    const secs = holdSeconds(this.mode);
    const fill = h('i', { class: 'act-fill' });
    const tol = holdTolerance(this.mode);
    const band = h('u', { class: 'act-band', style: { left: `${(target - tol) * 100}%`, width: `${tol * 200}%` } });
    const mark = h('u', { class: 'act-mark', style: { left: `${target * 100}%` } });
    const bar = h('div', { class: 'act-hold', role: 'img', 'aria-label': 'Barra: soltá en la marca dorada' }, band, fill, mark);
    const pad = h('button', { type: 'button', class: 'act-pad hold', 'aria-label': b.title }, h('div', { class: 'act-target' }, h('span', null, 'Mantené')));
    const verdict = h('div', { class: 'act-verdict' });
    this.stage.replaceChildren(pad, bar, verdict);
    let t0 = 0, down = false, finished = false;
    const release = () => {
      if (!down || finished) return;
      down = false; finished = true;
      const v = Math.min(1.2, (this.t - t0) / secs);
      const r = holdScore(Math.min(1, v), target, this.mode);
      verdict.textContent = VERDICT[r.verdict]; verdict.dataset.v = r.verdict;
      pad.classList.remove('on');
      if (this.stageOn()) { world.cookSpark(r.verdict); world.cookPose(false); }
      audio.sfxPlay(r.verdict === 'miss' ? 'tap' : this.sfxFor(b));
      this.tick = null; this.onKey = null;
      setTimeout(() => this.beatDone([r.score]), 550);
    };
    const press = () => { if (down || finished) return; down = true; t0 = this.t; pad.classList.add('on'); audio.sfxPlay('tap'); };
    pad.addEventListener('pointerdown', (e) => { e.preventDefault(); try { pad.setPointerCapture(e.pointerId); } catch { /* synthetic */ } press(); });
    pad.addEventListener('pointerup', release); pad.addEventListener('pointercancel', release);
    this.onKey = (d) => (d ? press() : release());
    this.tick = () => {
      if (!down) return;
      const v = (this.t - t0) / secs;
      fill.style.width = `${Math.min(1, v) * 100}%`;
      if (v >= 1.15) release(); // held far too long
    };
  }

  /** pick the right ingredients, in any order */
  private runItems(b: Beat) {
    const need = [...(b.items ?? [])];
    const total = need.length;
    const ids = [...new Set([...(b.items ?? []), ...(b.decoys ?? [])])].sort((a, c) => (a + c).length - (c + a).length + (a < c ? -1 : 1));
    // a stable but not obvious order: decoys mixed in
    ids.sort((a, c) => ((a.charCodeAt(0) * 7 + a.length) % 5) - ((c.charCodeAt(0) * 7 + c.length) % 5));
    let wrong = 0, placed = 0;
    const left = (id: string) => need.filter((x) => x === id).length;
    const row = h('div', { class: 'act-items' });
    const verdict = h('div', { class: 'act-verdict' });
    const paint = () => {
      row.replaceChildren(...ids.map((id) => {
        const n = left(id), sprite = cookingIngredient(id);
        const cv = h('canvas', { width: 32, height: 24 }) as HTMLCanvasElement;
        cv.getContext('2d')!.drawImage(sprite, 0, 0);
        const btn = h('button', { type: 'button', class: 'act-item' + (b.items!.includes(id) ? '' : ' decoy') + (n === 0 && b.items!.includes(id) ? ' empty' : ''), 'aria-label': nameOf(id), disabled: n === 0 && b.items!.includes(id), onclick: () => pick(id, btn) },
          cv, h('span', null, nameOf(id)), b.items!.includes(id) && n > 0 ? h('b', { class: 'act-qty' }, `×${n}`) : null) as HTMLButtonElement;
        return btn;
      }));
    };
    const pick = (id: string, btn: HTMLElement) => {
      const i = need.indexOf(id);
      if (i < 0) {
        wrong++;
        btn.classList.add('shake'); setTimeout(() => btn.classList.remove('shake'), 350);
        audio.sfxPlay('error'); this.respond(this.mode === 'relaxed' ? 'Ese no va ahora' : 'Ese no va: cuesta un error', 'gentle');
        return;
      }
      need.splice(i, 1); placed++;
      audio.sfxPlay(this.sfxFor(b));
      if (this.stageOn()) { const it = ITEMS_BY_ID[id]; world.cookPop(it?.icon ?? null); world.cookSpark('good'); }
      verdict.textContent = `${placed}/${total}`;
      paint();
      if (!need.length) {
        this.tick = null;
        verdict.textContent = wrong ? 'Listo' : '¡Perfecto!'; verdict.dataset.v = wrong ? 'good' : 'perfect';
        setTimeout(() => this.beatDone([itemsScore(placed, wrong)], wrong), 450);
      }
    };
    paint();
    this.stage.replaceChildren(row, verdict);
  }

  // ------------------------------------------------------------------ waiting for the stove and the rice pot
  private startWait(b: Beat) {
    this.waitItem = b.wait ?? null;
    if (this.useCooked(this.waitItem!)) { this.waitItem = null; this.bi++; void this.enterBeat(false); return; }
    const goTo = h('button', { class: 'btn primary act-go', onclick: () => this.host?.goGrill() }, this.waitItem === 'rice' ? 'Ir a la olla' : 'Ir a la plancha');
    const status = h('div', { class: 'act-wait' });
    this.stage.replaceChildren(h('div', { class: 'act-wait-box' }, status, this.host ? goTo : null));
    this.say(b.hint);
    if (this.stageOn()) { void world.cookGo(SPOT[b.station].x, SPOT[b.station].y, 'up').then(() => world.cookPose(false)); }
    this.tick = () => {
      const st = this.waitItem ? this.host?.status(this, this.waitItem) : null;
      status.textContent = st ? st.text : b.hint;
    };
    this.onKey = null;
  }

  private useCooked(item: string): boolean {
    const i = this.cookedPieces.findIndex((c) => c.item === item);
    if (i < 0) return false;
    const d = doneness(this.cookedPieces.splice(i, 1)[0].p);
    this.prec.push(d.score);
    if (d.mistake) this.mistakes++;
    this.respond(item === 'rice' ? `Arroz: ${d.label.toLowerCase()}` : d.label, d.mistake ? 'gentle' : 'good');
    return true;
  }
  private tryWait() {
    if (this.done || !this.waitItem) return;
    if (!this.useCooked(this.waitItem)) return;
    this.waitItem = null;
    this.bi++;
    if (this.bi >= this.beats.length) { this.complete(); return; }
    void this.enterBeat(false);
  }

  // ------------------------------------------------------------------ finish
  private complete() {
    if (this.done) return;
    this.done = true; this.tick = null; this.onKey = null;
    const mode = settings.cookMode;
    const precision = this.prec.length ? this.prec.reduce((a, c) => a + c, 0) / this.prec.length : 0.75;
    const elapsed = this.t;
    const judged = judgeCook({ mode, mistakes: this.mistakes, elapsed, steps: this.r.steps.length, timeLimit: this.timeLimit, precision });
    const used = this.variantUsed && this.variant && game.consumeIngredients({ [this.variant.item]: 1 });
    if (judged.quality === 2) haptic('excellent');
    audio.sfxPlay(judged.quality === 2 ? 'success' : 'sparkle');
    if (this.stageOn()) { world.cookPose(false); world.cookPop(this.r.icon); world.cookSpark(judged.quality === 2 ? 'perfect' : 'good'); }
    this.say(judged.label); this.renderSteps();
    this.stage.replaceChildren(h('div', { class: 'act-final', 'data-q': String(judged.quality) }, h('b', null, judged.label), h('div', { class: 'hint' }, this.r.name)));
    let closed = false;
    const leave = () => {
      if (closed) return; closed = true;
      this.cleanup();
      this.finish({ ok: true, quality: judged.quality, score: judged.score, variant: used ? this.variant!.name : undefined, variantItem: used ? this.variant!.item : undefined, variantBonus: used ? this.variant!.bonus : 0, seconds: Math.round(elapsed * 10) / 10, hard: mode === 'challenge' });
    };
    const shown = performance.now();
    this.finishNow = () => { if (performance.now() - shown > 500) leave(); };
    this.stage.addEventListener('pointerdown', () => this.finishNow?.());
    this.revealTimer = window.setTimeout(leave, 1900);
  }

  private cleanup() {
    cancelAnimationFrame(this.raf); clearTimeout(this.revealTimer); this.unbindKeys();
    if (world?.cookActive) world.cookPop(null);
    this.root.remove();
  }
}
