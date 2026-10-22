/**
 * Skills of the people who work in the restaurant (hired staff and the three raccoons). They come with the level they already
 * have: some arrive by themselves, and at levels 2 and 4 you choose one of two (free to change, so it is a taste, not a trap).
 * Every effect is small and shown in the menu. Nobody can ever be faster than a share of what the player does (see `floorSeconds`).
 */
import { galleyOn } from '../galley/mode';

export type PerkWho = 'cook' | 'waiter' | 'cashier' | 'helper' | 'spicy' | 'rigg' | 'pip';

export interface PerkFx {
  /** multiplies the time a job takes (0.85 = 15 % faster) */
  speed?: number;
  /** multiplies the walking speed */
  walk?: number;
  /** added to the chance of a perfect result (0..1) */
  quality?: number;
  /** extra cooked portions kept ready (Spicy) */
  reserve?: number;
  /** extra plates on the tray */
  carry?: number;
}

export interface PerkDef {
  id: string;
  who: PerkWho;
  /** level needed */
  level: number;
  /** perks of one group are alternatives: only one can be active */
  group?: 'a' | 'b';
  name: string;
  desc: string;
  fx: PerkFx;
}

const P = (id: string, who: PerkWho, level: number, name: string, desc: string, fx: PerkFx, group?: 'a' | 'b'): PerkDef => ({ id, who, level, group, name, desc, fx });

export const PERKS: PerkDef[] = [
  // ---- the hired cook (works the stove or the knife, see `Employee.job`)
  P('cook_hands', 'cook', 2, 'Manos veloces', 'Todo le lleva un 15 % menos de tiempo.', { speed: 0.85 }, 'a'),
  P('cook_eye', 'cook', 2, 'Ojo de brasa', 'Sus platos y cortes salen perfectos más seguido.', { quality: 0.12 }, 'a'),
  P('cook_rhythm', 'cook', 3, 'Buen ritmo', 'Se mueve un 15 % más rápido entre estaciones.', { walk: 1.15 }),
  P('cook_mise', 'cook', 4, 'Mise en place', 'Otro 15 % menos de tiempo en cada tarea.', { speed: 0.85 }, 'b'),
  P('cook_gold', 'cook', 4, 'Mano de oro', 'Aún más chances de que salga perfecto.', { quality: 0.2 }, 'b'),
  // ---- Spicy (rice and knife in the physical kitchen)
  P('spicy_batch', 'spicy', 2, 'Tanda grande', 'Mantiene 2 porciones más de arroz listas en el hangiri.', { reserve: 2 }, 'a'),
  P('spicy_knife', 'spicy', 2, 'Cuchillo de chef', 'Corta un 15 % más rápido.', { speed: 0.85 }, 'a'),
  P('spicy_step', 'spicy', 3, 'Paso firme', 'Camina un 15 % más rápido entre estaciones.', { walk: 1.15 }),
  P('spicy_rice', 'spicy', 4, 'Ojo de arroz', 'El arroz y los cortes salen perfectos más seguido.', { quality: 0.2 }, 'b'),
  P('spicy_double', 'spicy', 4, 'Doble ritmo', 'Otro 15 % menos de tiempo en cada tarea.', { speed: 0.85 }, 'b'),
  // ---- Rigg (tray and orders)
  P('rigg_memory', 'rigg', 2, 'Memoria de mesas', 'Recoge y sirve los platos un 15 % más rápido.', { speed: 0.85 }, 'a'),
  P('rigg_tray', 'rigg', 2, 'Bandeja ligera', 'Lleva un plato más por viaje.', { carry: 1 }, 'a'),
  P('rigg_notebook', 'rigg', 3, 'Libreta al día', 'Camina un 15 % más rápido.', { walk: 1.15 }),
  P('rigg_calm', 'rigg', 4, 'Atención tranquila', 'Otro 15 % menos de tiempo en todo.', { speed: 0.85 }, 'b'),
  P('rigg_double', 'rigg', 4, 'Doble viaje', 'Un plato más por viaje (se suma a «Bandeja ligera»).', { carry: 1 }, 'b'),
  // ---- Pip (reception)
  P('pip_smile', 'pip', 2, 'Sonrisa rápida', 'Recibe a cada grupo un 15 % más rápido.', { speed: 0.85 }),
  P('pip_steps', 'pip', 3, 'Pasitos veloces', 'Lleva a los clientes a su mesa más ligero.', { walk: 1.15 }),
  P('pip_host', 'pip', 4, 'Anfitrión nato', 'Otro 10 % menos de tiempo recibiendo.', { speed: 0.9 }),
  // ---- hired staff
  P('waiter_feet', 'waiter', 2, 'Pies ligeros', 'Camina un 15 % más rápido.', { walk: 1.15 }, 'a'),
  P('waiter_pad', 'waiter', 2, 'Libreta rápida', 'Toma pedidos y sirve un 15 % más rápido.', { speed: 0.85 }, 'a'),
  P('waiter_tray', 'waiter', 4, 'Bandeja extra', 'Lleva un plato más por viaje.', { carry: 1 }, 'b'),
  P('waiter_calm', 'waiter', 4, 'Calma de oficio', 'Otro 15 % menos de tiempo en cada tarea.', { speed: 0.85 }, 'b'),
  P('cashier_eye', 'cashier', 2, 'Ojo de propina', 'Recoge las propinas un 15 % más rápido.', { speed: 0.85 }, 'a'),
  P('cashier_feet', 'cashier', 2, 'Pies ligeros', 'Camina un 15 % más rápido.', { walk: 1.15 }, 'a'),
  P('cashier_flow', 'cashier', 4, 'Caja ordenada', 'Otro 15 % menos de tiempo.', { speed: 0.85 }, 'b'),
  P('cashier_run', 'cashier', 4, 'Recorrido corto', 'Otro 15 % más rápido al caminar.', { walk: 1.15 }, 'b'),
  P('helper_pack', 'helper', 2, 'Paquetes al hombro', 'Guarda los paquetes un 15 % más rápido.', { speed: 0.85 }, 'a'),
  P('helper_feet', 'helper', 2, 'Pies ligeros', 'Camina un 15 % más rápido.', { walk: 1.15 }, 'a'),
  P('helper_shelf', 'helper', 4, 'Estante a mano', 'Otro 15 % menos de tiempo.', { speed: 0.85 }, 'b'),
  P('helper_run', 'helper', 4, 'Recorrido corto', 'Otro 15 % más rápido al caminar.', { walk: 1.15 }, 'b'),
];

export const PERKS_BY_ID: Record<string, PerkDef> = Object.fromEntries(PERKS.map((p) => [p.id, p]));
export const perksOf = (who: PerkWho): PerkDef[] => PERKS.filter((p) => p.who === who);

/** What a person has chosen (ids of perks in groups); older saves have nothing and simply use the automatic ones. */
export interface PerkChoices { perks?: string[] }

/** Perks that are on right now: the automatic ones the level allows plus the chosen alternative of each unlocked group. */
export function activePerks(who: PerkWho, level: number, m: PerkChoices): PerkDef[] {
  const out: PerkDef[] = [];
  for (const p of perksOf(who)) {
    if (p.level > level) continue;
    if (!p.group) { out.push(p); continue; }
    const chosen = m.perks?.includes(p.id);
    // with nothing chosen yet, the first alternative applies (so a loaded save never loses its benefit)
    const sameLevel = perksOf(who).filter((q) => q.group && q.level === p.level);
    const anyChosen = sameLevel.some((q) => m.perks?.includes(q.id));
    if (chosen || (!anyChosen && p === sameLevel[0])) out.push(p);
  }
  return out;
}

export interface PerkTotals { speed: number; walk: number; quality: number; reserve: number; carry: number }
export function perkTotals(who: PerkWho, level: number, m: PerkChoices): PerkTotals {
  const t: PerkTotals = { speed: 1, walk: 1, quality: 0, reserve: 0, carry: 0 };
  for (const p of activePerks(who, level, m)) {
    t.speed *= p.fx.speed ?? 1; t.walk *= p.fx.walk ?? 1; t.quality += p.fx.quality ?? 0; t.reserve += p.fx.reserve ?? 0; t.carry += p.fx.carry ?? 0;
  }
  return t;
}

/** Picks the alternative `id` (its group at that level); returns the new list of choices. */
export function chooseAlternative(who: PerkWho, level: number, m: PerkChoices, id: string): string[] | null {
  const p = PERKS_BY_ID[id];
  if (!p || p.who !== who || !p.group || p.level > level) return null;
  const rest = (m.perks ?? []).filter((x) => !(PERKS_BY_ID[x]?.who === who && PERKS_BY_ID[x]?.level === p.level));
  return [...rest, id];
}

// ------------------------------------------------------------------ never faster than the player
/**
 * What the player needs for one cut series on the board (normal mode, ~1.3 s per bar) and the stove (the machine's own time):
 * the reference every helper is compared with. A helper's job takes at least `FLOOR` times the player's, whatever the level and
 * the skills, and slower at lower levels (`SLOWER`): they free the player's hands, they do not replace the player.
 */
export const PLAYER_REF = { cut: 6.5, stove: 9, step: 1.2 } as const;
export const SLOWER = [2.2, 1.9, 1.65, 1.45, 1.3] as const;
export const FLOOR = 1.2;
export const floorSeconds = (ref: number, level: number, speedMul = 1): number => Math.max(ref * FLOOR, ref * SLOWER[Math.max(0, Math.min(4, level))] * speedMul);
export const hiredCooksWork = (): boolean => galleyOn();
