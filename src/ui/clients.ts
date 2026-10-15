/** The notebook of Villa Nori's customers: who has eaten at Midnight Maki, what they liked, and who is coming. */
import { game } from '../core/state';
import { NEIGHBORS } from '../data/neighbors';
import { RECIPES_BY_ID } from '../data/recipes';
import { clientsDemand, clients } from '../restaurant/townVisits';
import { h, panel } from './dom';

const PERIODS = ['por la mañana', 'a la tarde', 'al atardecer', 'de noche'];

export function openClients() {
  const s = clients(), t = game.save.time;
  const body = h('div', { class: 'col' });
  const demand = clientsDemand();
  body.append(h('p', { class: 'hint' }, `Movimiento ahora: ${demand >= 1.3 ? 'mucho' : demand >= 0.85 ? 'normal' : 'tranquilo'}. Invitá a los vecinos charlando con ellos por el pueblo.`));
  const soon = s.planned.map((p) => `${NEIGHBORS.find((n) => n.id === p.id)?.name ?? p.id} (${p.day === t.day ? 'hoy' : 'otro día'} ${PERIODS[p.period] ?? ''})`);
  if (soon.length) body.append(h('div', { class: 'card' }, h('b', null, 'Vienen pronto'), h('div', { class: 'hint' }, soon.join(' · '))));
  const known = NEIGHBORS.filter((n) => s.regulars[n.id]).sort((a, b) => s.regulars[b.id].visits - s.regulars[a.id].visits);
  if (!known.length) body.append(h('p', null, 'Todavía no vino ningún vecino. ¡Invitá a alguien!'));
  for (const n of known) {
    const r = s.regulars[n.id];
    const fav = Object.entries(r.likes).sort((a, b) => b[1] - a[1])[0];
    const hearts = Math.max(0, Math.min(5, Math.round(r.mood)));
    const status = r.visits >= 2 && r.mood >= 1 ? 'Habitual' : r.mood <= -2 ? 'Enojado' : r.visits ? 'Conocido' : 'Invitado';
    body.append(h('div', { class: 'card col', style: { gap: '2px' } },
      h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', null, `${n.name} · ${n.job}`), h('span', { class: 'hint' }, status)),
      h('div', null, '♥'.repeat(hearts) + '♡'.repeat(5 - hearts)),
      h('div', { class: 'hint' }, `${r.visits} ${r.visits === 1 ? 'visita' : 'visitas'}${fav ? ` · le gusta: ${RECIPES_BY_ID[fav[0]]?.name ?? fav[0]}` : ''}${r.waits ? ` · esperó de más ${r.waits} ${r.waits === 1 ? 'vez' : 'veces'}` : ''}`)));
  }
  panel({ title: 'Clientes del pueblo', wide: true, body });
}
