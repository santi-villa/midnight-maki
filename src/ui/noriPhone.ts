import { runTask } from '../core/errors';
import { clock } from '../systems/time';
import { game } from '../core/state';
import { bus } from '../core/events';
import { formatHudTime, hudTime } from './hudClock';
import { h, panel } from './dom';
import { skinIconEl } from './skin';

export interface PhoneApp { id: string; name: string; icon: string; hint: string; run: () => void | Promise<unknown>; closePhone?: boolean; }
/** Navigation only: each app opens an existing interface and returns here when closed. */
export function mountNoriPhone(apps: PhoneApp[]) {
  if (document.querySelector('.phone-shell')) return;
  const hour = h('b');
  const date = h('small');
  const refresh = () => { const time = game.save.time; hour.textContent = formatHudTime(hudTime(time.period, time.minutes)); date.textContent = clock.dateLabel(); };
  refresh();
  const body = h('div', { class: 'noriphone' },
    h('div', { class: 'phone-status' }, hour, h('span', null, 'Villa Nori')),
    h('div', { class: 'phone-greeting' }, 'Un pueblo, tres mapaches y vos.', date),
    h('div', { class: 'phone-apps' }));
  let close = () => {};
  let opening = false;
  for (const app of apps) body.querySelector('.phone-apps')!.append(h('button', {
    type: 'button', class: 'phone-app', 'data-app': app.id, title: app.hint, 'aria-label': `${app.name}: ${app.hint}`,
    onclick: () => {
      if (opening) return;
      opening = true;
      if (app.closePhone) close();
      void runTask('phone:' + app.id, app.run).finally(() => { opening = false; });
    },
  }, h('span', { class: 'phone-app-icon', 'aria-hidden': 'true' }, skinIconEl(app.icon)), h('span', null, app.name)));
  body.append(h('p', { class: 'hint phone-help' }, 'Cerrá una aplicación para volver al teléfono. El juego está en pausa.'));
  const offTime = bus.on('time:changed', refresh);
  const phone = panel({ title: 'NoriPhone', body, onClose: offTime });
  phone.root.classList.add('phone-shell');
  close = phone.close;
  body.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
}
