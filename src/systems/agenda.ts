/**
 * "Hoy": what is worth doing now, what comes later and what is already available. Pure: `agenda` reads only its input,
 * and `agendaNow` builds that input from the game. It adds no quests; it makes the existing things easier to find.
 */
import { game } from '../core/state';
import { ZONES } from '../data/zones';
import { RECIPES_BY_ID } from '../data/recipes';
import { canCook } from '../restaurant/orders';
import { employees, hireCost, roleLimit } from '../restaurant/staff';
import { UPGRADES, upgradeMissing } from '../restaurant/upgrades';
import { currentStep } from '../quests/quests';
import { getEnergy, TIRED_LIMIT, WARN_LIMIT } from './fatigue';
import { restaurantPhase, RESTAURANT_HOURS, type ShopPhase } from './schedule';

export type AgendaGroup = 'now' | 'later' | 'unlocked';
export interface AgendaItem { id: string; group: AgendaGroup; icon: string; title: string; detail: string; zone?: string }

export interface AgendaInput {
  introDone: boolean;
  phase: ShopPhase;
  energy: number;
  coins: number;
  level: number;
  orders: number;
  /** text of the tracked quest step, if any */
  quest: string | null;
  /** a known recipe can be cooked with what the restaurant has */
  canCookAny: boolean;
  /** the cheapest upgrade that fits the level: ready to buy, or what it still needs */
  upgrade: { name: string; price: number; missing: string[] } | null;
  canHire: boolean;
  hireFrom: number;
  festival: boolean;
  marketTonight: boolean;
  beach: boolean;
  drinks: boolean;
}

const MAX_PER_GROUP = 3;
const where = (zone?: string) => (zone && ZONES[zone] ? ` · ${ZONES[zone].name}` : '');

export function agenda(i: AgendaInput): AgendaItem[] {
  if (!i.introDone) return [];
  const now: AgendaItem[] = [], later: AgendaItem[] = [], unlocked: AgendaItem[] = [];
  const open = i.phase === 'open' || i.phase === 'closing';

  if (i.energy <= TIRED_LIMIT) now.push({ id: 'sleep', group: 'now', icon: 'bed', title: 'Dormir un rato', detail: 'Estás muy cansada y no podés cocinar. Tu cama te espera.' + where('home'), zone: 'home' });
  else if (i.energy <= WARN_LIMIT) later.push({ id: 'tired', group: 'later', icon: 'bed', title: 'Pronto vas a necesitar descansar', detail: 'La energía está baja. Dormir o descansar un rato la recupera.' });

  if (open && i.orders > 0) now.push({ id: 'orders', group: 'now', icon: 'serve', title: 'Atender los pedidos', detail: `Hay ${i.orders} ${i.orders === 1 ? 'pedido' : 'pedidos'} en el restaurante.` + where('restaurant'), zone: 'restaurant' });
  else if (open && !i.quest) now.push({ id: 'guests', group: 'now', icon: 'heart', title: 'Invitar a un vecino', detail: 'El restaurante está abierto y sin pedidos: invitá a alguien desde Clientes.' + where('restaurant'), zone: 'restaurant' });

  if (!i.canCookAny && (open || i.phase === 'setup')) now.push({ id: 'ingredients', group: 'now', icon: 'bag', title: 'Conseguir ingredientes', detail: 'No alcanza para ninguna receta. Pasá por el almacén de Taro o el mercado.' + where('plaza'), zone: 'plaza' });

  if (i.upgrade && i.upgrade.missing.length === 0) now.push({ id: 'upgrade', group: 'now', icon: 'shop', title: `Mejorar el restaurante: ${i.upgrade.name}`, detail: `Ya podés pagarlo (${i.upgrade.price} ●). Se compra desde Restaurante.`, zone: 'restaurant' });
  else if (i.upgrade) later.push({ id: 'upgrade', group: 'later', icon: 'shop', title: `Próxima mejora: ${i.upgrade.name}`, detail: `Falta: ${i.upgrade.missing.join(', ')}.` });

  if (i.quest) now.push({ id: 'quest', group: 'now', icon: 'clipboard', title: 'Seguir la misión', detail: i.quest });

  if (!open && i.phase !== 'closing') later.push({ id: 'opens', group: 'later', icon: 'calendar', title: i.phase === 'setup' ? 'El restaurante abre pronto' : 'El restaurante está cerrado', detail: `Atiende de ${RESTAURANT_HOURS.hours}. Mientras tanto, visitá a un vecino, juntá ingredientes o pescá.` });
  if (i.marketTonight) later.push({ id: 'market', group: 'later', icon: 'map', title: 'Mercado Nocturno esta noche', detail: 'Objetos raros y decoración, solo de noche.' });
  if (i.festival) now.push({ id: 'festival', group: 'now', icon: 'calendar', title: 'Hoy hay un evento en el pueblo', detail: 'Mirá el Calendario del celu.' });

  if (i.beach) unlocked.push({ id: 'fishing', group: 'unlocked', icon: 'act', title: 'Pescar en la playa', detail: 'Pescados frescos para el restaurante.' + where('beach'), zone: 'beach' });
  if (i.canHire) unlocked.push({ id: 'hire', group: 'unlocked', icon: 'heart', title: 'Contratar personal', detail: `Un mozo cuesta desde ${i.hireFrom} ●. Se contrata en Personal.` });
  if (i.drinks) unlocked.push({ id: 'drinks', group: 'unlocked', icon: 'serve', title: 'Bebidas', detail: 'Los clientes ya pueden pedir té y ramune. Se preparan en la estación de bebidas.' });

  return [...now.slice(0, MAX_PER_GROUP), ...later.slice(0, MAX_PER_GROUP), ...unlocked.slice(0, MAX_PER_GROUP)];
}

/** The input for the current game. */
export function agendaInput(): AgendaInput {
  const t = game.save.time, r = game.save.restaurant;
  const next = UPGRADES.filter((u) => !r.upgrades.includes(u.id) && !u.friendship && u.level <= r.level + 1)
    .sort((a, b) => a.price - b.price)[0];
  const tracked = game.save.quests.tracked;
  const step = tracked ? currentStep(tracked) : null;
  return {
    introDone: game.has('intro_done'),
    phase: restaurantPhase(t.period, t.minutes),
    energy: getEnergy(), coins: game.coins, level: r.level,
    orders: game.save.orders.length,
    quest: step ? step.text.replace(/<[^>]+>/g, '') : null,
    canCookAny: game.save.recipesKnown.some((id) => RECIPES_BY_ID[id] && canCook(id)),
    upgrade: next ? { name: next.name, price: next.price, missing: upgradeMissing(next) } : null,
    canHire: employees().length < roleLimit('waiter', r.level) && game.coins >= hireCost('waiter'),
    hireFrom: hireCost('waiter'),
    festival: !!game.flag('festival_today'),
    marketTonight: !!game.flag('market_night'),
    beach: game.has('unlock_beach'),
    drinks: game.has('intro_done') && r.level >= 2,
  };
}

export const agendaNow = () => agenda(agendaInput());
