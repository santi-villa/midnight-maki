/**
 * The griddle/pan station of the kitchen. Several pieces cook at once, each one of a dish she
 * started; they keep cooking while she works on other dishes and tell her when they are ready.
 * Tap a raw piece, tap a free spot to put it on; tap a cooking piece to take it off.
 */
import { cookingIngredient } from '../art/cooking';
import { audio } from '../audio/audio';
import { haptic } from '../core/haptics';
import { settings } from '../core/settings';
import { h } from '../ui/dom';
import { iconElement } from '../art/icons';
import { ITEMS_BY_ID } from '../data/items';
import type { CookingGame } from './cooking';
import { ZONES, doneness, grillAdvance, grillZone, type GrillZone } from './grill';

export const GRILL_SLOTS = 4;
const CW = 64;
const CH = 56;

interface Piece { game: CookingGame; item: string; how: 'plancha' | 'sarten'; p: number; zone: GrillZone; seen: GrillZone }
interface DishRef { game: CookingGame; who: string }

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

  constructor(private dishes: () => DishRef[], private changed: () => void) {
    const board = h('div', { class: 'gr-board' });
    for (let i = 0; i < GRILL_SLOTS; i++) {
      const cv = h('canvas', { width: CW, height: CH, 'aria-hidden': 'true' }) as HTMLCanvasElement;
      const el = h('button', { class: 'gr-slot', 'aria-label': `Lugar ${i + 1} de la plancha`, onclick: () => this.tapSlot(i) }, cv, h('span', { class: 'gr-label' }));
      this.canvases.push(cv);
      this.slotEls.push(el);
      board.append(el);
    }
    this.el = h('div', { class: 'gr' },
      h('p', { class: 'hint' }, 'Tocá un ingrediente de abajo y después un lugar libre para ponerlo. Cuando esté en su punto, tocalo para sacarlo: si te olvidás, se quema (pero tarda).'),
      this.note, board,
      h('b', { class: 'gr-h' }, 'Para cocinar'), this.tray);
    this.render();
  }

  // ---------------------------------------------------------------- model
  private pieces() { return this.slots.filter((p): p is Piece => !!p); }

  /** how this dish's piece is doing, for its waiting board */
  status(game: CookingGame, item: string): { text: string; p: number } | null {
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
    const ps = this.pieces();
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
    sel.game.takeRaw(sel.i);
    this.slots[i] = { game: sel.game, item: piece.item, how: piece.how, p: 0, zone: 'raw', seen: 'raw' };
    this.selected = null;
    audio.sfxPlay('tap');
    this.say('');
    this.render();
    this.changed();
  }

  private firstRaw(): { game: CookingGame; i: number } | null {
    for (const d of this.dishes()) if (d.game.rawPieces.length) return { game: d.game, i: 0 };
    return null;
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
      // iron plate with a lit edge and grill marks
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
