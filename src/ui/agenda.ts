/** "Hoy": the agenda screen (see systems/agenda.ts for what goes in it). */
import { agendaNow, type AgendaGroup } from '../systems/agenda';
import { h, panel } from './dom';
import { skinIconEl } from './skin';

const TITLES: Record<AgendaGroup, string> = { now: 'Ahora', later: 'Después', unlocked: 'Ya disponible' };

export function openAgenda() {
  const body = h('div', { class: 'col agenda' });
  const items = agendaNow();
  for (const g of ['now', 'later', 'unlocked'] as AgendaGroup[]) {
    const list = items.filter((i) => i.group === g);
    if (!list.length) continue;
    body.append(h('h3', null, TITLES[g]), ...list.map((i) => h('div', { class: 'card row' }, skinIconEl(i.icon, 'skin-icon'), h('div', { class: 'col grow' }, h('b', null, i.title), h('div', { class: 'hint' }, i.detail)))));
  }
  if (!items.length) body.append(h('p', { class: 'hint' }, 'Todavía no hay nada para sugerir. Seguí la historia y vuelvo con ideas.'));
  panel({ title: 'Hoy', body });
}
