/**
 * The griddle/pan station of the kitchen. Several pieces cook at once, each one of a dish she
 * started; they keep cooking while she works on other dishes and tell her when they are ready.
 * Tap a raw piece, tap a free spot to put it on; tap a cooking piece to take it off.
 */
import { game as gs } from '../core/state';
import { cookingIngredient } from '../art/cooking';
import { cookSprite, preloadCookSprites } from '../art/cookingSprites';
import { audio } from '../audio/audio';
import { haptic } from '../core/haptics';
import { settings } from '../core/settings';
import { h } from '../ui/dom';
import { iconElement } from '../art/icons';
import { ITEMS_BY_ID } from '../data/items';
import type { DishBoard as CookingGame } from '../kitchen/types';
import { kitchenOval } from '../art/cooking';
import { ZONES, doneness, grillAdvance, grillZone, type GrillZone } from './grill';

export const GRILL_SLOTS = 4;
/** one pot of rice is enough for this many dishes */
export const POT_PORTIONS = 5;
const CW = 64;
const CH = 56;

interface Piece { game: CookingGame; item: string; how: 'plancha' | 'sarten'; p: number; zone: GrillZone; seen: GrillZone }
interface DishRef { game: CookingGame; who: string }
interface Pot { cooking: boolean; p: number; zone: GrillZone; seen: GrillZone; stock: number; stockP: number }
/** the cooked rice outlives the kitchen window: it stays in the pot for the rest of the day */
let potMemory: { day: number; stock: number; stockP: number } | null = null;

const ZONE_TEXT: Record<GrillZone, string> = { raw: 'Cocinándose…', ready: '¡En su punto!', over: '¡Se está pasando!', burnt: '¡Quemado!' };

export class Grill {
  readonly el: HTMLElement;
  private slots: (Piece | null)[] = new Array(GRILL_SLOTS).fill(null);
  private selected: { game: CookingGame; i: number } | null = null;
  private tray = h('div', { class: 'gr-tray' });
  private note = h('div', { class: 'gr-note', role: 'status', 'aria-live': 'polite' });
  private canvases: HTMLCanvasElement[] = [];
  private slotEls: HTMLElement[] = [];
  private t = 0;
  private lastBadge = '';
  private pot: Pot = { cooking: false, p: 0, zone: 'raw', seen: 'raw', stock: 0, stockP: 0 };
  private potEl!: HTMLElement;
  private potCv!: HTMLCanvasElement;

  constructor(private dishes: () => DishRef[], private changed: () => void) {
    if (potMemory && potMemory.day === gs.save.time.day) { this.pot.stock = potMemory.stock; this.pot.stockP = potMemory.stockP; }
    const board = h('div', { class: 'gr-board' });
    for (let i = 0; i < GRILL_SLOTS; i++) {
      const cv = h('canvas', { width: CW, height: CH, 'aria-hidden': 'true' }) as HTMLCanvasElement;
      const el = h('button', { class: 'gr-slot', 'aria-label': `Lugar ${i + 1} de la plancha`, onclick: () => this.tapSlot(i) }, cv, h('span', { class: 'gr-label' }));
      this.canvases.push(cv);
      this.slotEls.push(el);
      board.append(el);
    }
    this.potCv = h('canvas', { width: 160, height: 80, 'aria-hidden': 'true' }) as HTMLCanvasElement;
    this.potEl = h('button', { class: 'gr-slot gr-pot', 'aria-label': 'Olla de arroz', onclick: () => this.tapPot() }, this.potCv, h('span', { class: 'gr-label' }));
    this.el = h('div', { class: 'gr' },
      this.note,
      h('section', { class: 'gr-sec' }, h('b', { class: 'gr-h' }, 'Olla de arroz'),
        h('p', { class: 'hint' }, `Una olla rinde ${POT_PORTIONS} platos. Tocala para empezar; cuando esté en su punto, tocala de nuevo para sacar el arroz: queda listo para todos los platos que lo pidan.`), this.potEl),
      h('section', { class: 'gr-sec' }, h('b', { class: 'gr-h' }, 'Plancha y sartenes'),
        h('p', { class: 'hint' }, 'Tocá un ingrediente de abajo y después un lugar libre para ponerlo. Cuando esté en su punto, tocalo para sacarlo: si te olvidás, se quema (pero tarda).'), board,
        h('b', { class: 'gr-h' }, 'Para cocinar'), this.tray));
    preloadCookSprites(['plancha', 'sarten-tamago']);
    this.render();
  }

  // ---------------------------------------------------------------- model
  private pieces() { return this.slots.filter((p): p is Piece => !!p); }

  /** how this dish's piece is doing, for its waiting board */
  status(game: CookingGame, item: string): { text: string; p: number } | null {
    if (item === 'rice') {
      if (this.pot.cooking) return { text: this.pot.zone === 'raw' ? 'El arroz se está cocinando…' : this.pot.zone === 'ready' ? '¡El arroz está listo! Sacalo de la olla' : '¡El arroz se pasa!', p: this.pot.p };
      return game.rawPieces.some((r) => r.item === 'rice') ? { text: 'Falta hacer arroz: tocá la olla', p: 0 } : null;
    }
    const on = this.pieces().find((p) => p.game === game && p.item === item);
    if (on) return { text: ZONE_TEXT[on.zone], p: on.p };
    if (game.rawPieces.some((r) => r.item === item)) return { text: 'Falta ponerlo en la plancha', p: 0 };
    return null;
  }

  /** pieces of a dish that was dropped leave the stove */
  dropDish(game: CookingGame) {
    this.slots = this.slots.map((p) => (p && p.game === game ? null : p));
    if (this.selected?.game === game) this.selected = null;
    this.render();
  }

  /** text for the station tab: what needs her attention */
  badge(): string {
    const ps: { zone: GrillZone }[] = [...this.pieces(), ...(this.pot.cooking ? [{ zone: this.pot.zone }] : [])];
    const burnt = ps.filter((p) => p.zone === 'burnt').length;
    if (burnt) return '¡Se quema!';
    const over = ps.filter((p) => p.zone === 'over').length;
    if (over) return '¡Ya!';
    const ready = ps.filter((p) => p.zone === 'ready').length;
    if (ready) return `¡${ready} listo${ready > 1 ? 's' : ''}!`;
    return ps.length ? `${ps.length}` : '';
  }

  private say(text: string) {
    this.note.textContent = text;
  }

  // ---------------------------------------------------------------- play
  tick(dt: number, visible: boolean) {
    this.t += dt;
    let alert: string | null = null;
    for (const p of this.pieces()) {
      p.p = grillAdvance(p.p, dt, p.item, settings.cookMode);
      p.zone = grillZone(p.p);
      if (p.zone !== p.seen) {
        p.seen = p.zone;
        if (p.zone === 'ready') { audio.sfxPlay('sparkle'); haptic('tap'); alert = '¡Listo!'; }
        else if (p.zone === 'over') { audio.sfxPlay('tap'); alert = 'Se está pasando'; }
        else if (p.zone === 'burnt') { audio.sfxPlay('tap'); haptic('tap'); alert = 'Se quemó'; }
      }
    }
    if (this.pot.cooking) {
      this.pot.p = grillAdvance(this.pot.p, dt, 'rice', settings.cookMode);
      this.pot.zone = grillZone(this.pot.p);
      if (this.pot.zone !== this.pot.seen) {
        this.pot.seen = this.pot.zone;
        if (this.pot.zone === 'ready') { audio.sfxPlay('sparkle'); haptic('tap'); alert = '¡Arroz listo!'; }
        else if (this.pot.zone === 'burnt') { audio.sfxPlay('tap'); alert = 'Se quemó el arroz'; }
      }
    }
    if (this.deal()) alert = alert ?? 'Arroz servido';
    if (alert && !visible) this.changed();
    const b = this.badge();
    if (b !== this.lastBadge) { this.lastBadge = b; this.changed(); }
    if (visible) this.draw();
  }

  private tapSlot(i: number) {
    const on = this.slots[i];
    if (on) {
      const d = doneness(on.p);
      this.slots[i] = null;
      on.game.putCooked(on.item, on.p);
      audio.sfxPlay('pickup');
      this.say(`${ITEMS_BY_ID[on.item]?.name ?? on.item}: ${d.label.toLowerCase()}.`);
      this.render();
      this.changed();
      return;
    }
    const sel = this.selected ?? this.firstRaw();
    if (!sel) { this.say('No queda nada para poner. Empezá otro pedido o esperá a que se cocine lo que hay.'); return; }
    const piece = sel.game.rawPieces[sel.i];
    if (!piece) return;
    if (piece.how === 'olla') { this.say('El arroz va en la olla, no en la plancha.'); this.selected = null; this.render(); return; }
    sel.game.takeRaw(sel.i);
    this.slots[i] = { game: sel.game, item: piece.item, how: piece.how, p: 0, zone: 'raw', seen: 'raw' };
    this.selected = null;
    audio.sfxPlay('tap');
    this.say('');
    this.render();
    this.changed();
  }

  private firstRaw(): { game: CookingGame; i: number } | null {
    for (const d of this.dishes()) { const i = d.game.rawPieces.findIndex((r) => r.how !== 'olla'); if (i >= 0) return { game: d.game, i }; }
    return null;
  }

  private tapPot() {
    const pot = this.pot;
    if (pot.cooking) {
      if (pot.zone === 'raw') { this.say('Todavía se está cocinando: esperá a que esté listo.'); return; }
      pot.stock = POT_PORTIONS; pot.stockP = pot.p;
      pot.cooking = false; pot.p = 0; pot.zone = 'raw'; pot.seen = 'raw';
      audio.sfxPlay('pickup');
      this.say(`Sacaste el arroz: alcanza para ${POT_PORTIONS} platos.`);
      this.deal(); this.remember(); this.render(); this.changed(); return;
    }
    if (pot.stock > 0) { this.say(`Todavía quedan ${pot.stock} porciones de arroz listas.`); return; }
    pot.cooking = true; pot.p = 0; pot.zone = 'raw'; pot.seen = 'raw';
    audio.sfxPlay('tap');
    this.say(`Arroz en la olla: rinde ${POT_PORTIONS} platos.`);
    this.render(); this.changed();
  }

  private remember() { potMemory = { day: gs.save.time.day, stock: this.pot.stock, stockP: this.pot.stockP }; }

  /** the dishes that wait for rice take a portion from the pot, one each */
  private deal(): boolean {
    const pot = this.pot;
    let gave = false;
    for (const d of this.dishes()) {
      while (pot.stock > 0) {
        const i = d.game.rawPieces.findIndex((r) => r.item === 'rice');
        if (i < 0) break;
        d.game.takeRaw(i); d.game.putCooked('rice', pot.stockP);
        pot.stock--; gave = true;
        this.say(pot.stock > 0 ? `Arroz para ${d.game.recipe.name}. Quedan ${pot.stock} porciones.` : `Arroz para ${d.game.recipe.name}. Se acabó el arroz de la olla.`);
        break;
      }
    }
    if (gave) { this.remember(); this.render(); }
    return gave;
  }

  // ---------------------------------------------------------------- draw
  render() {
    this.tray.innerHTML = '';
    let any = false;
    for (const d of this.dishes()) {
      d.game.rawPieces.forEach((r, i) => {
        any = true;
        const on = this.selected?.game === d.game && this.selected.i === i;
        this.tray.append(
          h('button', { class: 'gr-raw' + (on ? ' on' : ''), onclick: () => { this.selected = on ? null : { game: d.game, i }; this.render(); } },
            iconElement(ITEMS_BY_ID[r.item]?.icon ?? { type: 'blob' }),
            h('span', null, h('b', null, ITEMS_BY_ID[r.item]?.name ?? r.item), h('small', null, `${d.game.recipe.name} · ${d.who}`))),
        );
      });
    }
    if (!any) this.tray.append(h('p', { class: 'muted' }, 'Nada esperando. Los ingredientes de cada plato aparecen acá apenas lo empezás.'));
    this.draw();
  }

  draw() {
    this.slots.forEach((p, i) => {
      const g = this.canvases[i].getContext('2d')!;
      g.imageSmoothingEnabled = false;
      g.clearRect(0, 0, CW, CH);
      const pan = p?.how === 'sarten';
      // art from public/cocina when it exists; otherwise an iron plate drawn here
      const art = cookSprite(pan ? 'sarten-tamago' : 'plancha');
      if (art) g.drawImage(art, 0, 4, CW, CH - 10);
      else {
      g.fillStyle = '#1d1a1f';
      g.fillRect(2, 6, CW - 4, CH - 14);
      g.fillStyle = '#3b3640';
      g.fillRect(3, 7, CW - 6, CH - 17);
      g.fillStyle = '#4d4856';
      g.fillRect(3, 7, CW - 6, 2);
      g.fillStyle = 'rgba(255,255,255,.07)';
      for (let x = 8; x < CW - 6; x += 8) g.fillRect(x, 10, 2, CH - 22);
      if (pan) {
        g.fillStyle = '#2a2530';
        g.beginPath(); g.ellipse(CW / 2, 26, 26, 14, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#524b5e';
        g.beginPath(); g.ellipse(CW / 2, 25, 24, 12, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#6b4a35';
        g.fillRect(CW - 12, 24, 12, 3);
      }
      }
      if (p) {
        const sprite = tinted(p.item, p.p);
        const bob = p.zone === 'raw' || p.zone === 'ready' ? Math.round(Math.sin(this.t * 5 + i) * 0.6) : 0;
        g.drawImage(sprite, CW / 2 - 24, 10 + bob, 48, 36);
        // steam
        if (!settings.reduceMotion && p.zone !== 'raw') {
          g.fillStyle = 'rgba(255,255,255,.5)';
          for (let k = 0; k < 3; k++) {
            const ph = (this.t * 0.8 + k / 3 + i * 0.17) % 1;
            g.fillRect(CW / 2 - 12 + k * 12 + Math.round(Math.sin(ph * 6 + k) * 2), Math.round(14 - ph * 12), 2, 2);
          }
        }
        // zone bar
        const bx = 4;
        const bw = CW - 8;
        const by = CH - 6;
        g.fillStyle = '#17131a';
        g.fillRect(bx - 1, by - 1, bw + 2, 6);
        const seg = (a: number, b: number, c: string) => { g.fillStyle = c; g.fillRect(bx + Math.round(a * bw / 1.0), by, Math.round((b - a) * bw / 1.0), 4); };
        seg(0, ZONES.ready, '#9a7a3c');
        seg(ZONES.ready, ZONES.over, '#5f9a47');
        seg(ZONES.over, ZONES.burnt, '#c9782d');
        seg(ZONES.burnt, 1, '#8c2f2a');
        g.fillStyle = '#fff6d8';
        g.fillRect(bx + Math.round(Math.min(1, p.p) * bw) - 1, by - 2, 2, 8);
      }
      const label = this.slotEls[i].querySelector('.gr-label') as HTMLElement;
      const t = p ? ZONE_TEXT[p.zone] : 'Libre';
      if (label.textContent !== t) label.textContent = t;
      this.slotEls[i].dataset.zone = p?.zone ?? 'free';
    });
    this.drawPot();
  }

  private drawPot() {
    const g = this.potCv.getContext('2d')!, W = 160, H = 80, pot = this.pot;
    g.imageSmoothingEnabled = false; g.clearRect(0, 0, W, H);
    kitchenOval(g, 80, 56, 46, 10, 'rgba(0,0,0,.35)');
    // the pot: a wide steel body with a lid rim and two handles
    g.fillStyle = '#8e9aa3'; g.fillRect(32, 22, 96, 34); g.fillStyle = '#c7d2d8'; g.fillRect(32, 22, 96, 4); g.fillStyle = '#5f6b73'; g.fillRect(32, 50, 96, 6);
    g.fillStyle = '#5b4636'; g.fillRect(16, 30, 16, 5); g.fillRect(128, 30, 16, 5);
    const full = pot.cooking || pot.stock > 0;
    kitchenOval(g, 80, 22, 48, 10, '#b4bec5'); kitchenOval(g, 80, 21, 44, 8, full ? '#ede7d4' : '#6b747a');
    if (full && !settings.reduceMotion) { g.fillStyle = 'rgba(255,255,255,.55)'; for (let k = 0; k < 5; k++) { const ph = (this.t * 0.8 + k / 5) % 1; g.fillRect(48 + k * 15 + Math.round(Math.sin(ph * 6 + k) * 2), Math.round(18 - ph * 16), 2, 2); } }
    // portions left, one grain pile each
    for (let k = 0; k < POT_PORTIONS; k++) { g.fillStyle = k < pot.stock ? '#fbf7ee' : '#3d3945'; g.fillRect(46 + k * 15, 34, 11, 8); }
    const bx = 10, bw = W - 20, by = H - 8;
    g.fillStyle = '#17131a'; g.fillRect(bx - 1, by - 1, bw + 2, 7);
    const seg = (a: number, b: number, c: string) => { g.fillStyle = c; g.fillRect(bx + Math.round(a * bw), by, Math.round((b - a) * bw), 5); };
    seg(0, ZONES.ready, '#9a7a3c'); seg(ZONES.ready, ZONES.over, '#5f9a47'); seg(ZONES.over, ZONES.burnt, '#c9782d'); seg(ZONES.burnt, 1, '#8c2f2a');
    if (pot.cooking) { g.fillStyle = '#fff6d8'; g.fillRect(bx + Math.round(Math.min(1, pot.p) * bw) - 1, by - 2, 2, 9); }
    const label = this.potEl.querySelector('.gr-label') as HTMLElement;
    const t = pot.cooking ? `${ZONE_TEXT[pot.zone]} · toca para sacarla cuando esté lista` : pot.stock > 0 ? `Arroz listo: ${pot.stock} de ${POT_PORTIONS} porciones` : 'Olla vacía · tocá para hacer arroz';
    if (label.textContent !== t) label.textContent = t;
    this.potEl.dataset.zone = pot.cooking ? pot.zone : pot.stock > 0 ? 'ready' : 'free';
  }
}

const tintCache = new Map<string, HTMLCanvasElement>();
/** the ingredient sprite, paler when raw, golden when done, brown then black when it overcooks */
function tinted(item: string, p: number): HTMLCanvasElement {
  const zone = grillZone(p);
  const level = zone === 'raw' ? 0 : zone === 'ready' ? 1 : zone === 'over' ? 2 : 3;
  // a few steps inside raw and ready so the change is visible while it happens
  const step = zone === 'raw' ? Math.floor((p / ZONES.ready) * 3) : zone === 'ready' ? Math.floor(((p - ZONES.ready) / (ZONES.over - ZONES.ready)) * 3) : 0;
  const key = `${item}:${level}:${step}`;
  const found = tintCache.get(key);
  if (found) return found;
  const src = cookingIngredient(item);
  const c = document.createElement('canvas');
  c.width = src.width; c.height = src.height;
  const g = c.getContext('2d')!;
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  const fill = zone === 'raw' ? `rgba(255,236,236,${0.45 - step * 0.13})` : zone === 'ready' ? `rgba(214,150,60,${0.05 + step * 0.08})` : zone === 'over' ? 'rgba(110,60,25,.42)' : 'rgba(18,10,8,.72)';
  g.fillStyle = fill;
  g.fillRect(0, 0, c.width, c.height);
  tintCache.set(key, c);
  return c;
}
