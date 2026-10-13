/** Optional notice-board errands, with visible rewards and persistent weekly keepsakes. */
import { drawObject } from '../art/objects';
import { iconElement } from '../art/icons';
import { audio } from '../audio/audio';
import { game } from '../core/state';
import { CHAR_BY_ID } from '../data/characters';
import { FURN_BY_ID } from '../data/furniture';
import { ITEMS_BY_ID } from '../data/items';
import { claimErrandReward, ensureDaily, errandFrom, errandText, errandHint, isComplete, progressOf, WEEKLY_STAMPS, WEEKLY_THEMES, type Errand, type ErrandReward } from '../quests/daily';
import { h, toast } from './dom';

function furniturePicture(id: string): HTMLCanvasElement {
  const f = FURN_BY_ID[id];
  const c = drawObject(f.kind, f.w * 16, f.sh, f.c1, f.c2 || f.c1, f.variant ?? 0);
  c.classList.add('errand-furniture');
  return c;
}
function rewardList(coins: number, rewards?: ErrandReward) {
  const row = h('div', { class: 'errand-rewards', 'aria-label': 'Recompensas' }, h('span', { class: 'errand-reward coin' }, `${coins} monedas`));
  for (const [id, n] of Object.entries(rewards?.items ?? {})) row.append(h('span', { class: 'errand-reward' }, iconElement(ITEMS_BY_ID[id].icon), `${n} × ${ITEMS_BY_ID[id].name}`));
  for (const [id, n] of Object.entries(rewards?.furniture ?? {})) row.append(h('span', { class: 'errand-reward' }, furniturePicture(id), `${n} × ${FURN_BY_ID[id].name}`));
  if (rewards?.friendship) row.append(h('span', { class: 'errand-reward' }, `♥ +${rewards.friendship.points} amistad con ${CHAR_BY_ID[rewards.friendship.who].name}`));
  return row;
}
function rewardText(coins: number, rewards?: ErrandReward): string {
  return [`${coins} monedas`, ...Object.entries(rewards?.items ?? {}).map(([id, n]) => `${n} ${ITEMS_BY_ID[id].name}`), ...Object.entries(rewards?.furniture ?? {}).map(([id, n]) => `${n} ${FURN_BY_ID[id].name}`), ...(rewards?.friendship ? [`+${rewards.friendship.points} amistad con ${CHAR_BY_ID[rewards.friendship.who].name}`] : [])].join(' · ');
}

export function errandsSection(onClaim?: () => void): HTMLElement {
  const wrap = h('div', { class: 'col errands-section' });
  const render = () => {
    wrap.replaceChildren();
    const st = ensureDaily();
    const card = (e: Errand, weekly: boolean, pending = false) => {
      const p = progressOf(e), done = isComplete(e);
      return h('article', { class: 'card col errand-card' + (done && !e.claimed ? ' ready' : '') + (e.claimed ? ' claimed' : ''), 'data-errand-id': e.id },
        h('div', { class: 'errand-heading' }, h('b', null, errandFrom(e)), h('span', { class: 'errand-status' }, e.claimed ? 'Recibido' : done ? e.kind === 'deliver' ? 'Listo para entregar' : 'Listo para cobrar' : 'En curso')),
        h('div', null, errandText(e)),
        h('p', { class: 'hint' }, errandHint(e)),
        rewardList(e.coins, e.rewards),
        h('div', { class: 'bar', role: 'progressbar', 'aria-label': 'Progreso del encargo', 'aria-valuemin': '0', 'aria-valuemax': e.goal, 'aria-valuenow': p }, h('i', { style: { width: `${p / e.goal * 100}%` } })),
        h('div', { class: 'errand-actions' }, h('span', { class: 'hint' }, e.claimed ? 'Premio recibido' : `${p}/${e.goal}${pending ? ' · Premio guardado' : weekly ? ` · Hasta el día ${e.dueDay ?? st.week * 7 + 7}` : ' · Hoy'}`),
          done && !e.claimed ? h('button', { class: 'btn small primary', onclick: () => {
            const receipt = claimErrandReward(e.id);
            if (receipt) {
              audio.sfxPlay(receipt.stamps.length ? 'sparkle' : 'pickup');
              toast(`¡Encargo cumplido! ${rewardText(receipt.coins, receipt.rewards)}.`);
              if (receipt.stamps.length) toast(`Gracias del pueblo: ${receipt.stamps.map((id) => FURN_BY_ID[id].name).join(', ')}. Está en Decorar.`);
              onClaim?.();
            }
            render();
          } }, e.kind === 'deliver' ? `Entregar ${e.goal} y recibir` : 'Recibir premio') : null));
    };
    wrap.append(h('h3', null, `Encargos de hoy · Día ${st.day}`), h('p', { class: 'hint' }, 'Opcionales y sin castigos. Los premios de encargos completados esperan hasta que los cobres.'), ...st.daily.map((e) => card(e, false)));
    wrap.append(h('h3', null, `Meta semanal · ${WEEKLY_THEMES.find((t) => t.id === st.weeklyTheme)?.name ?? 'Ayudar al pueblo'}`), h('p', { class: 'hint' }, 'Cada semana propone otra actividad disponible. Los muebles y adornos se guardan para que elijas dónde colocarlos.'), ...st.weekly.map((e) => card(e, true)));
    if (st.pending?.length) wrap.append(h('h3', null, 'Premios pendientes'), ...st.pending.map((e) => card(e, e.id.startsWith('w'), true)));
    const completed = game.save.stats.weeklyErrandsDone ?? 0;
    wrap.append(h('h3', null, 'Gracias de Villa Nori'), h('p', { class: 'hint' }, `${completed} encargos semanales recibidos. Podés dejar pasar semanas: no hay rachas que mantener.`), h('div', { class: 'errand-stamps' }, ...WEEKLY_STAMPS.map((stamp) => {
      const got = game.has('once_errand_stamp_' + stamp.goal);
      return h('div', { class: 'errand-stamp' + (got ? ' earned' : '') }, furniturePicture(stamp.furniture), h('b', null, stamp.name), h('span', { class: 'hint' }, FURN_BY_ID[stamp.furniture].name), h('span', { class: 'hint' }, got ? 'Recibido · disponible en Decorar' : `Al recibir ${stamp.goal} metas semanales`));
    })));
  };
  render();
  return wrap;
}
