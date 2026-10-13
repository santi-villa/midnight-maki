/** "Encargos" section of the town notice board: today's errands and the weekly goal. */
import { audio } from '../audio/audio';
import { claimErrand, ensureDaily, errandFrom, errandText, isComplete, progressOf, type Errand } from '../quests/daily';
import { h, toast } from './dom';

export function errandsSection(): HTMLElement {
  const wrap = h('div', { class: 'col' });
  const render = () => {
    wrap.innerHTML = '';
    const st = ensureDaily();
    const card = (e: Errand, weekly: boolean) => {
      const p = progressOf(e);
      const done = isComplete(e);
      return h('div', { class: 'card col', style: { gap: '4px', borderColor: done && !e.claimed ? '#7fa356' : undefined, opacity: e.claimed ? '.6' : '1' } },
        h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', null, `${weekly ? 'Semanal · ' : ''}${errandFrom(e)}`), h('span', { class: 'coin' }, `${e.coins} ●`)),
        h('div', null, errandText(e)),
        h('div', { class: 'bar' }, h('i', { style: { width: `${(p / e.goal) * 100}%` } })),
        h('div', { class: 'row', style: { justifyContent: 'space-between' } },
          h('span', { class: 'hint' }, e.claimed ? 'Cobrado' : `${p}/${e.goal}`),
          done && !e.claimed
            ? h('button', { class: 'btn small primary', onclick: () => {
                const c = claimErrand(e.id);
                if (c) { audio.sfxPlay('coin'); toast(`Encargo cumplido: +${c} monedas.`); }
                render();
              } }, 'Cobrar')
            : null),
      );
    };
    wrap.append(
      h('h3', null, 'Encargos de hoy'),
      h('p', { class: 'hint' }, 'Opcionales. No vencen con castigo: mañana habrá otros.'),
      ...st.daily.map((e) => card(e, false)),
      ...st.weekly.map((e) => card(e, true)),
    );
  };
  render();
  return wrap;
}
