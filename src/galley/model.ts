/**
 * The physical kitchen as a state machine. Hands, work surfaces, cookers, the cutting board, the assembly table, the pass.
 * The player and any employee use the very same operations (`perform`), so a crew member is just an agent that walks to a
 * station's standing tile and calls them. No Phaser, no DOM, no save access: everything it needs comes through `GalleyEnv`.
 * Layout: galley/layout.ts. Rules for dishes: galley/prep.ts. Design: docs/cocina-fisica.md.
 */
import { ITEMS_BY_ID } from '../data/items';
import { DRINKS, DRINK_BY_ID } from '../restaurant/drinkData';
import { RECIPES_BY_ID } from '../data/recipes';
import { STATION_BY_ID, STATIONS, effectiveKind, type StationDef } from './layout';
import { COOKABLE, CUTTABLE, judgeDish, recipesFor, type DrinkItem, type DishItem, type Form, type GItem, type Grade, type IngItem, type Match } from './prep';
import { VERDICT_GRADE, type CutVerdict } from './cut';

export interface Stock {
  have(id: string): number;
  take(id: string): boolean;
  give(id: string): void;
}

export interface GalleyEnv {
  stock: Stock;
  upgrades(): readonly string[];
  rng(): number;
  known(recipe: string): boolean;
  /** drinks are on the menu (the restaurant reached level 2); missing means yes */
  drinks?(): boolean;
  /** hands a finished dish to the service. `ok: false` keeps it in the hands. */
  deliver(dish: DishItem | DrinkItem, who: string): { ok: boolean; msg?: string };
}

/** Seconds a cooker takes, and when what it holds goes a little past (good → regular) and burns. */
export const COOK = {
  rice: { time: 22, over1: 8, over2: 16, burn: 32, grace: 6 },
  stove: { time: 9, over1: 5, over2: 10, burn: 16, grace: 4 },
} as const;
export const ASSEMBLE_SECONDS = 1.4;
/** the blender: seconds to mix a drink */
export const MIX_SECONDS = 3.5;
export const PLAYER = 'player';

export type Verb = 'open' | 'return' | 'put' | 'take' | 'chop' | 'assemble' | 'deliver' | 'trash' | 'cup';
/** Machines start by themselves when loaded. The cooker keeps taking portions for a few seconds (`grace`) after the first one. */

export type GalleyEvent =
  | { t: 'take'; who: string; item: GItem; from: string }
  | { t: 'put'; who: string; item: GItem; at: string }
  | { t: 'fridge'; who: string }
  | { t: 'cookStart'; station: string }
  | { t: 'ready'; station: string }
  | { t: 'over'; station: string }
  | { t: 'burnt'; station: string }
  | { t: 'cut'; station: string; verdict: CutVerdict; item: IngItem }
  | { t: 'assembling'; station: string; recipe: string }
  | { t: 'assembled'; station: string; dish: DishItem }
  | { t: 'mixed'; station: string; drink: DrinkItem }
  | { t: 'trash'; who: string; item: GItem }
  | { t: 'refund'; who: string; item: IngItem }
  | { t: 'delivered'; who: string; dish: DishItem | DrinkItem };

export interface Result { ok: boolean; msg?: string; events: GalleyEvent[]; needsCut?: boolean; needsPick?: boolean }
const fail = (msg: string): Result => ({ ok: false, msg, events: [] });

interface StationState {
  items: GItem[];
  /** cookers: idle (loading) → cooking → done (waiting to be emptied) */
  phase: 'idle' | 'cooking' | 'done';
  /** seconds in the current phase */
  t: number;
  /** assembly: a dish being put together */
  work: { recipe: string; variant?: string; bonus: number; t: number; total: number } | null;
  /** board: the item on it is waiting for its cut */
  pending: boolean;
}

export interface GalleySnapshot {
  v: 1;
  nextUid: number;
  hands: Record<string, GItem[]>;
  st: Record<string, Partial<StationState>>;
}

export const itemLabel = (i: GItem): string => {
  if (i.kind === 'dish') return RECIPES_BY_ID[i.recipe]?.name ?? 'Plato';
  if (i.kind === 'cup') return 'Vaso';
  if (i.kind === 'drink') return DRINK_BY_ID[i.drink]?.name ?? 'Bebida';
  const name = i.ing === 'nori' ? 'Alga' : ITEMS_BY_ID[i.ing]?.name ?? i.ing;
  const state = i.form === 'cut' ? ' cortado' : i.form === 'cooked' ? ' cocido' : i.form === 'cooked_cut' ? ' cocido y cortado' : '';
  return name + state;
};

export class Galley {
  private nextUid = 1;
  private hands = new Map<string, GItem[]>();
  private st: Record<string, StationState> = {};

  constructor(private env: GalleyEnv) {
    for (const s of STATIONS) this.st[s.id] = blank();
  }

  // ------------------------------------------------------------------ queries
  capacity(who: string): number { return who === PLAYER && this.env.upgrades().includes('galley_hands') ? 2 : 1; }
  held(who: string): GItem[] { return this.hands.get(who) ?? []; }
  station(id: string): Readonly<StationState> { return this.st[id]; }
  def(id: string): StationDef { return STATION_BY_ID[id]; }
  kind(id: string) { return effectiveKind(STATION_BY_ID[id], this.env.upgrades()); }
  slots(id: string): number {
    const s = STATION_BY_ID[id];
    if (this.kind(id) === 'counter' && s.kind !== 'counter') return 2; // a locked station is a plain 2-place counter
    if (id === 'rice' && this.env.upgrades().includes('rice_big')) return 6;
    return s.slots;
  }
  /** Whether a station is working (a cooker cooking, the assembly assembling). */
  busy(id: string): boolean { const s = this.st[id]; return s.phase === 'cooking' || !!s.work; }
  /** Progress 0..1 of what a station is doing, or null. */
  progress(id: string): number | null {
    const s = this.st[id];
    if (s.work) return s.work.t / s.work.total;
    if (s.phase === 'cooking') return s.t / COOK[id === 'rice' ? 'rice' : 'stove'].time;
    return null;
  }
  /** The recipes the pieces on the assembly table make right now. */
  preview(id = 'assembly'): Match[] {
    const s = this.st[id];
    if (!s || s.work || s.items.some((i) => i.kind === 'dish')) return [];
    return recipesFor(s.items.filter((i): i is IngItem => i.kind === 'ing'), this.env.known);
  }

  /** The drink the mixer holds right now: one glass and exactly the ingredients of a drink. */
  drinkIn(id = 'mixer'): string | null {
    const s = this.st[id];
    if (!s || s.work || !this.drinksOn()) return null;
    const cups = s.items.filter((i) => i.kind === 'cup').length;
    const ings = s.items.filter((i): i is IngItem => i.kind === 'ing');
    if (cups !== 1 || s.items.length !== 1 + ings.length) return null;
    return DRINKS.find((d) => {
      const need = Object.entries(d.ingredients);
      return need.length === new Set(ings.map((i) => i.ing)).size && need.every(([ing, n]) => ings.filter((i) => i.ing === ing).length === n);
    })?.id ?? null;
  }
  drinksOn(): boolean { return this.env.drinks ? this.env.drinks() : true; }

  private accepts(id: string, item: GItem): boolean {
    const s = STATION_BY_ID[id];
    const kind = this.kind(id);
    if (kind === 'counter') {
      if (s.accepts === 'rice') return item.kind === 'ing' && item.ing === 'rice' && item.form === 'cooked';
      return true;
    }
    if (kind === 'assembly') return item.kind === 'ing';
    if (kind === 'mixer') return item.kind === 'cup' ? !this.st[id].items.some((i) => i.kind === 'cup') : item.kind === 'ing' && item.form === 'raw' && DRINK_INGREDIENTS.has(item.ing);
    if (kind === 'cooker') {
      if (item.kind !== 'ing' || item.form !== 'raw') return false;
      return s.cooker === 'rice' ? item.ing === 'rice' : COOKABLE.has(item.ing);
    }
    if (kind === 'board') return item.kind === 'ing' && CUTTABLE.has(item.ing) && (item.form === 'raw' || item.form === 'cooked');
    return false;
  }

  /** What can be done at a station right now, most useful first. */
  verbs(who: string, id: string): Verb[] {
    const s = this.st[id];
    const held = this.held(who)[0];
    const room = this.held(who).length < this.capacity(who);
    const kind = this.kind(id);
    const out: Verb[] = [];
    if (kind === 'fridge') {
      if (room) out.push('open');
      if (held?.kind === 'ing' && held.form === 'raw') out.push('return');
    } else if (kind === 'counter') {
      if (held && s.items.length < this.slots(id) && this.accepts(id, held)) out.push('put');
      if (s.items.length && room) out.push('take');
    } else if (kind === 'cooker') {
      const cfg = COOK[STATION_BY_ID[id].cooker === 'rice' ? 'rice' : 'stove'];
      const loading = s.phase === 'idle' || (s.phase === 'cooking' && s.t < cfg.grace);
      if (loading) {
        if (held && s.items.length < this.slots(id) && this.accepts(id, held)) out.push('put');
        if (s.items.length && room) out.push('take'); // change of mind while it is still loading
      } else if (s.phase === 'done' && s.items.length && room) out.push('take');
    } else if (kind === 'board') {
      if (s.items[0] && s.pending) out.push('chop');
      else if (s.items[0] && room) out.push('take');
      else if (!s.items[0] && held && this.accepts(id, held)) out.push('chop');
    } else if (kind === 'assembly') {
      if (!s.work) {
        if (held && !s.items.some((i) => i.kind === 'dish') && s.items.length < this.slots(id) && this.accepts(id, held)) out.push('put');
        if (this.preview(id).length) out.push('assemble');
        if (s.items.length && room) out.push('take');
      }
    } else if (kind === 'mixer') {
      if (!s.work) {
        if (held && s.items.length < this.slots(id) && this.accepts(id, held)) out.push('put');
        if (s.items.length && room) out.push('take');
      }
    } else if (kind === 'cups') {
      if (room && this.drinksOn()) out.push('cup');
    } else if (kind === 'pass') {
      if (held?.kind === 'dish' || held?.kind === 'drink') out.push('deliver');
    } else if (kind === 'bin') {
      if (held) out.push('trash');
    }
    // with an empty hand the useful verb comes first; with something in the hand, putting it down does
    if (!held) out.sort((a, b) => rank(a) - rank(b));
    return out;
  }

  // ------------------------------------------------------------------ actions
  perform(who: string, id: string, verb: Verb, arg?: string): Result {
    if (!this.verbs(who, id).includes(verb)) return fail(this.why(who, id, verb));
    const ev: GalleyEvent[] = [];
    const s = this.st[id];
    const hands = this.hands.get(who) ?? [];
    if (verb === 'open') return { ok: true, events: [{ t: 'fridge', who }], needsPick: true };
    if (verb === 'return') {
      const item = hands.shift() as IngItem;
      this.env.stock.give(item.ing);
      return { ok: true, events: [{ t: 'refund', who, item }] };
    }
    if (verb === 'put') {
      const item = hands.shift()!;
      this.hands.set(who, hands);
      s.items.push(item);
      ev.push({ t: 'put', who, item, at: id });
      if (this.kind(id) === 'cooker' && s.phase === 'idle') { s.phase = 'cooking'; s.t = 0; ev.push({ t: 'cookStart', station: id }); }
      if (this.kind(id) === 'mixer' && this.drinkIn(id)) { s.work = { recipe: this.drinkIn(id)!, bonus: 0, t: 0, total: MIX_SECONDS }; ev.push({ t: 'cookStart', station: id }); }
      return { ok: true, events: ev };
    }
    if (verb === 'take') {
      const item = s.items.pop()!;
      if (s.pending) s.pending = false;
      if (!s.items.length && s.phase !== 'idle' && this.kind(id) === 'cooker') { s.phase = 'idle'; s.t = 0; }
      this.hands.set(who, [...hands, item]);
      ev.push({ t: 'take', who, item, from: id });
      return { ok: true, events: ev };
    }
    if (verb === 'cup') {
      this.hands.set(who, [...hands, { kind: 'cup', uid: this.nextUid++ }]);
      return { ok: true, events: [{ t: 'take', who, item: this.held(who)[this.held(who).length - 1], from: id }] };
    }
    if (verb === 'chop') {
      if (!s.items[0]) {
        const item = hands.shift()!;
        this.hands.set(who, hands);
        s.items.push(item);
        s.pending = true;
        ev.push({ t: 'put', who, item, at: id });
      }
      return { ok: true, events: ev, needsCut: true };
    }
    if (verb === 'assemble') {
      const options = this.preview(id);
      const pick = options.find((m) => m.recipe.id === arg) ?? options[0];
      const bamboo = this.env.upgrades().includes('bamboo') ? 0.7 : 1;
      s.work = { recipe: pick.recipe.id, variant: pick.variant?.name, bonus: pick.variant?.bonus ?? 0, t: 0, total: ASSEMBLE_SECONDS * bamboo };
      return { ok: true, events: [{ t: 'assembling', station: id, recipe: pick.recipe.id }] };
    }
    if (verb === 'deliver') {
      const dish = hands[0] as DishItem | DrinkItem;
      const res = this.env.deliver(dish, who);
      if (!res.ok) return { ok: false, msg: res.msg, events: [] };
      hands.shift();
      return { ok: true, events: [{ t: 'delivered', who, dish }] };
    }
    // trash
    const item = hands.shift()!;
    return { ok: true, events: [{ t: 'trash', who, item }] };
  }

  /** Takes an ingredient from the fridge into the hands. Uses real stock. */
  takeFromFridge(who: string, ing: string): Result {
    if (this.held(who).length >= this.capacity(who)) return fail('Tenés las manos ocupadas.');
    if (!this.env.stock.take(ing)) return fail(`No queda ${ITEMS_BY_ID[ing]?.name.toLowerCase() ?? ing}.`);
    const item: IngItem = { kind: 'ing', uid: this.nextUid++, ing, form: 'raw', q: 2 };
    this.hands.set(who, [...this.held(who), item]);
    return { ok: true, events: [{ t: 'take', who, item, from: 'fridge' }] };
  }

  /** The reflex bar finished: the item on the board is now cut (or ruined). */
  finishCut(id: string, verdict: CutVerdict): Result {
    const s = this.st[id];
    const item = s.items[0];
    if (!item || item.kind !== 'ing' || !s.pending) return fail('No hay nada para cortar.');
    item.form = item.form === 'cooked' ? 'cooked_cut' : 'cut';
    item.q = VERDICT_GRADE[verdict];
    s.pending = false;
    return { ok: true, events: [{ t: 'cut', station: id, verdict, item }] };
  }

  /** Somebody walked away from the bar: the item stays on the board, still to be cut. */
  get pendingCut(): string | null {
    for (const s of STATIONS) if (this.st[s.id].pending) return s.id;
    return null;
  }

  // ------------------------------------------------------------------ time
  tick(dt: number): GalleyEvent[] {
    const ev: GalleyEvent[] = [];
    for (const s of STATIONS) {
      const st = this.st[s.id];
      const kind = this.kind(s.id);
      if (kind === 'cooker') {
        const cfg = COOK[s.cooker === 'rice' ? 'rice' : 'stove'];
        if (st.phase === 'cooking') {
          st.t += dt;
          if (st.t >= cfg.time) {
            for (const i of st.items) if (i.kind === 'ing') { i.form = 'cooked'; i.q = 3; }
            st.phase = 'done'; st.t = 0;
            ev.push({ t: 'ready', station: s.id });
          }
        } else if (st.phase === 'done' && st.items.length) {
          const before = st.t;
          st.t += dt;
          const grade = (g: Grade) => { for (const i of st.items) if (i.kind === 'ing' && i.q > g) i.q = g; };
          if (before < cfg.over1 && st.t >= cfg.over1) { grade(2); ev.push({ t: 'over', station: s.id }); }
          if (before < cfg.over2 && st.t >= cfg.over2) grade(1);
          if (st.t >= cfg.burn) { st.items = []; st.phase = 'idle'; st.t = 0; ev.push({ t: 'burnt', station: s.id }); }
        }
      }
      if (st.work && kind === 'mixer') {
        st.work.t += dt;
        if (st.work.t >= st.work.total) {
          const drink: DrinkItem = { kind: 'drink', uid: this.nextUid++, drink: st.work.recipe, dq: 1 };
          st.items = [drink];
          st.work = null;
          ev.push({ t: 'mixed', station: s.id, drink });
        }
      } else if (st.work) {
        st.work.t += dt;
        if (st.work.t >= st.work.total) {
          const r = RECIPES_BY_ID[st.work.recipe];
          const used = st.items.filter((i): i is IngItem => i.kind === 'ing');
          const dish: DishItem = { kind: 'dish', uid: this.nextUid++, recipe: r.id, dq: judgeDish(r, used), variant: st.work.variant, bonus: st.work.bonus };
          st.items = [dish];
          st.work = null;
          ev.push({ t: 'assembled', station: s.id, dish });
        }
      }
    }
    return ev;
  }

  // ------------------------------------------------------------------ persistence
  snapshot(): GalleySnapshot {
    const hands: Record<string, GItem[]> = {};
    for (const [who, items] of this.hands) if (items.length) hands[who] = items.map((i) => ({ ...i }));
    const st: GalleySnapshot['st'] = {};
    for (const s of STATIONS) {
      const x = this.st[s.id];
      if (x.items.length || x.phase !== 'idle' || x.work || x.pending) st[s.id] = { items: x.items.map((i) => ({ ...i })), phase: x.phase, t: x.t, work: x.work ? { ...x.work } : null, pending: x.pending };
    }
    return { v: 1, nextUid: this.nextUid, hands, st };
  }

  restore(snap: GalleySnapshot | undefined | null) {
    this.hands.clear();
    for (const s of STATIONS) this.st[s.id] = blank();
    this.nextUid = 1;
    if (!snap || snap.v !== 1) return;
    this.nextUid = Math.max(1, Math.floor(Number(snap.nextUid) || 1));
    for (const [who, items] of Object.entries(snap.hands ?? {})) {
      const clean = (items ?? []).filter(validItem);
      if (clean.length) this.hands.set(who, clean);
    }
    for (const s of STATIONS) {
      const x = snap.st?.[s.id];
      if (!x) continue;
      this.st[s.id] = {
        items: (x.items ?? []).filter(validItem),
        phase: x.phase === 'cooking' || x.phase === 'done' ? x.phase : 'idle',
        t: Number.isFinite(x.t) ? Math.max(0, x.t as number) : 0,
        work: x.work && (RECIPES_BY_ID[x.work.recipe] || DRINK_BY_ID[x.work.recipe]) ? { ...x.work } : null,
        pending: !!x.pending,
      };
    }
    // an unfinished cut or assembly cannot survive without its inputs
    for (const s of STATIONS) {
      const x = this.st[s.id];
      if (x.pending && !(x.items[0] && x.items[0].kind === 'ing')) x.pending = false;
      if (x.phase !== 'idle' && !x.items.length) { x.phase = 'idle'; x.t = 0; }
      if (x.work && !x.items.length) x.work = null;
    }
    for (const items of this.hands.values()) for (const i of items) this.nextUid = Math.max(this.nextUid, i.uid + 1);
    for (const x of Object.values(this.st)) for (const i of x.items) this.nextUid = Math.max(this.nextUid, i.uid + 1);
  }

  /** Everything the kitchen holds as raw stock that can be handed back (used when the kitchen is cleared). */
  clear(): void {
    this.hands.clear();
    for (const s of STATIONS) this.st[s.id] = blank();
  }

  private why(who: string, id: string, verb: Verb): string {
    const held = this.held(who)[0];
    const s = this.st[id];
    if (verb === 'open' || verb === 'take') return this.held(who).length >= this.capacity(who) ? 'Tenés las manos ocupadas.' : 'No hay nada para tomar.';
    if (verb === 'put') {
      if (!held) return 'No llevás nada.';
      if (s.items.length >= this.slots(id)) return 'Ahí no cabe más.';
      const kind = this.kind(id);
      if (kind === 'cooker') return STATION_BY_ID[id].cooker === 'rice' ? 'La arrocera solo cocina arroz crudo.' : 'En el fogón se cocinan huevo, langostino y anguila.';
      if (id === 'hangiri') return 'El hangiri guarda arroz cocido.';
      if (kind === 'mixer') return 'La licuadora lleva un vaso y los ingredientes de la bebida.';
      return 'Eso no va ahí.';
    }
    if (verb === 'chop') return 'Eso no se corta.';
    if (verb === 'deliver') return 'Solo se entregan platos y bebidas terminados.';
    if (verb === 'cup') return this.drinksOn() ? 'Tenés las manos ocupadas.' : 'Las bebidas se habilitan al llegar al nivel 2.';
    return 'No se puede hacer eso ahora.';
  }
}

function rank(v: Verb): number {
  return v === 'take' ? 0 : v === 'assemble' ? 1 : v === 'open' || v === 'cup' ? 3 : 4;
}

function blank(): StationState { return { items: [], phase: 'idle', t: 0, work: null, pending: false }; }

/** raw things a drink is made of */
const DRINK_INGREDIENTS: ReadonlySet<string> = new Set(DRINKS.flatMap((d) => Object.keys(d.ingredients)));
const FORMS: readonly Form[] = ['raw', 'cooked', 'cut', 'cooked_cut'];
function validItem(i: unknown): i is GItem {
  const x = i as GItem | null;
  if (!x || typeof x !== 'object' || !Number.isFinite(x.uid)) return false;
  if (x.kind === 'dish') return !!RECIPES_BY_ID[x.recipe] && [0, 1, 2].includes(x.dq);
  if (x.kind === 'cup') return true;
  if (x.kind === 'drink') return !!DRINK_BY_ID[x.drink] && [0, 1, 2].includes(x.dq);
  if (x.kind === 'ing') return typeof x.ing === 'string' && !!ITEMS_BY_ID[x.ing] && FORMS.includes(x.form) && [0, 1, 2, 3].includes(x.q);
  return false;
}
