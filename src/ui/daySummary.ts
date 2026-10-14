/**
 * End-of-day summary shown when going to bed: what you did today (dishes, coins, catches, friendships)
 * and a little comment from one of the raccoons.
 */
import { audio } from '../audio/audio';
import { game } from '../core/state';
import { CHAR_BY_ID } from '../data/characters';
import { portraitURL } from '../systems/appearance';
import { h, panel } from './dom';

const TRACKED = ['served', 'drinksServed', 'groupsReceived', 'coinsEarned', 'fishCaught', 'bugsCaught', 'gathered', 'harvests', 'gifts', 'purchases', 'photos'] as const;
type Snap = { stats: Record<string, number>; friends: Record<string, number> };

function current(): Snap {
  const stats: Record<string, number> = {};
  for (const k of TRACKED) stats[k] = game.save.stats[k] ?? 0;
  const friends: Record<string, number> = {};
  for (const [id, r] of Object.entries(game.save.relationships)) friends[id] = r.points;
  return { stats, friends };
}

/** Called when a new day starts, so tomorrow's summary only counts tomorrow. */
export function snapshotDay() {
  game.setFlag('day_snapshot', JSON.stringify(current()));
}

function previous(): Snap {
  try {
    const raw = game.flag('day_snapshot');
    if (typeof raw === 'string') return JSON.parse(raw);
  } catch {
    /* fall through */
  }
  return { stats: {}, friends: {} };
}

const LABELS: Record<(typeof TRACKED)[number], [string, string]> = {
  served: ['🍣', 'platos servidos'],
  drinksServed: ['☕', 'bebidas servidas'],
  groupsReceived: ['♥', 'grupos recibidos'],
  coinsEarned: ['●', 'monedas ganadas'],
  fishCaught: ['🐟', 'peces pescados'],
  bugsCaught: ['🦋', 'bichitos atrapados'],
  gathered: ['🍄', 'cosas recolectadas'],
  harvests: ['🌱', 'cosechas'],
  gifts: ['🎁', 'regalos hechos'],
  purchases: ['🛍', 'compras'],
  photos: ['📷', 'fotos'],
};

function comment(served: number, friendsUp: number, coins: number): { who: string; text: string } {
  if (served >= 6) return { who: 'spicy', text: '¡Qué jornada! La cocina echaba chispas. Mañana, el doble. Bueno, no. Pero casi.' };
  if (served >= 1) return { who: 'spicy', text: 'Buen servicio hoy. El arroz estaba orgulloso de vos. Yo también, un poquito.' };
  if (friendsUp >= 2) return { who: 'pip', text: 'Hoy hablaste con un montón de gente. ¡El pueblo te quiere! Yo más.' };
  if (coins >= 150) return { who: 'rigg', text: 'Anoté las ganancias de hoy. Están bien. Muy bien, en realidad.' };
  const calm = [
    { who: 'pip', text: 'Hoy fue un día tranquilo. Los días tranquilos también cuentan. ¡Buenas noches!' },
    { who: 'rigg', text: 'Mañana hay más pueblo para descubrir. Descansá. Yo vigilo las estrellas.' },
    { who: 'spicy', text: 'Mañana cocinamos algo glorioso. Ahora, a dormir. Hasta los chefs duermen.' },
  ];
  return calm[game.save.time.day % calm.length];
}

/** Shows the day summary and resolves when the player closes it. */
export function showDaySummary(): Promise<void> {
  const now = current();
  const prev = previous();
  const rows: HTMLElement[] = [];
  for (const k of TRACKED) {
    const d = (now.stats[k] ?? 0) - (prev.stats[k] ?? 0);
    if (d > 0) rows.push(h('div', { class: 'ds-row' }, h('span', { class: 'ds-ico' }, LABELS[k][0]), h('b', null, String(d)), h('span', null, LABELS[k][1])));
  }
  let friendsUp = 0;
  const friendRows: HTMLElement[] = [];
  for (const [id, pts] of Object.entries(now.friends)) {
    const d = pts - (prev.friends[id] ?? 0);
    if (d <= 0 || !CHAR_BY_ID[id]) continue;
    friendsUp++;
    friendRows.push(h('div', { class: 'ds-friend' }, h('img', { src: portraitURL(id, 'happy'), alt: '' }), h('span', null, CHAR_BY_ID[id].name), h('span', { class: 'ds-hearts' }, '♥'.repeat(Math.min(5, Math.max(1, Math.round(d / 10)))))));
  }
  const coins = (now.stats.coinsEarned ?? 0) - (prev.stats.coinsEarned ?? 0);
  const served = (now.stats.served ?? 0) - (prev.stats.served ?? 0);
  const c = comment(served, friendsUp, coins);
  const body = h('div', { class: 'ds' },
    h('div', { class: 'ds-title' }, `Día ${game.save.time.day}`),
    rows.length ? h('div', { class: 'ds-grid' }, ...rows) : h('p', { class: 'hint' }, 'Un día tranquilo, sin apuros.'),
    friendRows.length ? h('div', null, h('div', { class: 'cr-label' }, 'Amistades que crecieron'), h('div', { class: 'ds-friends' }, ...friendRows)) : null,
    h('div', { class: 'ds-comment' }, h('img', { src: portraitURL(c.who, 'happy'), alt: '' }), h('div', null, h('b', null, CHAR_BY_ID[c.who]?.name ?? ''), h('div', null, c.text))),
  );
  audio.sfxPlay('success');
  return new Promise((resolve) => {
    const p = panel({ title: 'Fin del día', body, foot: [h('button', { class: 'btn primary', onclick: () => p.close() }, 'Dormir')], onClose: () => resolve() });
  });
}
