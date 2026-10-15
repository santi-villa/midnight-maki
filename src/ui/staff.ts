/** The "Personal" screen: who works at the restaurant, what they do, how well, and what they cost. */
import { game } from '../core/state';
import { audio } from '../audio/audio';
import { MAX_LEVEL, TRAITS, candidates, employees, fire, hire, hireCost, runtime, setStaff, staffLimit, staffSave, train, trainCost, wageOf, type Employee } from '../restaurant/staff';
import { h, panel, toast } from './dom';
import { previewCanvas } from './creator';

const LEVELS = ['Recién llegado', 'Aprendiz', 'Práctico', 'Capacitado', 'Experto'];

function face(e: Employee) {
  const cv = previewCanvas(e.look, ['down'], 2);
  cv.style.cssText = 'width:48px;height:auto;image-rendering:pixelated';
  return cv;
}

export function openStaff() {
  const body = h('div', { class: 'col' });
  let confirmFire = '';
  const render = () => {
    body.innerHTML = '';
    const s = staffSave();
    const limit = staffLimit(game.save.restaurant.level);
    const list = employees();
    const wages = list.reduce((n, e) => n + wageOf(e), 0);
    body.append(
      h('div', { class: 'card row', style: { justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' } },
        h('div', null, h('b', null, `Personal ${list.length}/${limit}`), h('div', { class: 'hint' }, `Sueldos por día: ${wages} ●`)),
        h('button', { class: 'btn small' + (s.paused ? '' : ' primary'), onclick: () => { setStaff({ paused: !s.paused }); render(); } }, s.paused ? 'Personal en pausa: reanudar' : 'Trabajando: pausar a todos')),
    );
    if (!limit) body.append(h('p', { class: 'hint' }, 'Podés contratar personal desde el nivel 3 del restaurante. Un mesero toma pedidos y lleva los platos listos.'));
    for (const e of list) {
      const r = runtime.get(e.id);
      body.append(
        h('div', { class: 'card col', style: { gap: '6px' } },
          h('div', { class: 'row', style: { gap: '10px' } }, face(e),
            h('div', { style: { flex: '1' } }, h('b', null, `${e.name} · Mesero`), h('div', { class: 'hint' }, `${TRAITS[e.trait].name}: ${TRAITS[e.trait].line}`),
              h('div', { class: 'hint' }, `${LEVELS[e.level]} ${'★'.repeat(e.level)}${'☆'.repeat(MAX_LEVEL - e.level)} · ${wageOf(e)} ● por día`),
              h('div', { class: 'staff-doing' }, e.unpaid ? 'No cobró: no trabaja hasta que se le pague.' : r?.doing ?? 'Esperando'))),
          h('div', { class: 'row', style: { gap: '6px', flexWrap: 'wrap' } },
            h('button', { class: 'btn small' + (e.takeOrders ? ' primary' : ''), onclick: () => { e.takeOrders = !e.takeOrders; game.touch('staff'); render(); } }, e.takeOrders ? '✓ Toma pedidos' : 'Toma pedidos'),
            h('button', { class: 'btn small' + (e.serve ? ' primary' : ''), onclick: () => { e.serve = !e.serve; game.touch('staff'); render(); } }, e.serve ? '✓ Sirve platos' : 'Sirve platos'),
            h('button', { class: 'btn small', title: 'Qué hace primero cuando hay de las dos cosas', onclick: () => { e.priority = e.priority === 'serve' ? 'orders' : 'serve'; game.touch('staff'); render(); } }, e.priority === 'serve' ? 'Primero: platos' : 'Primero: pedidos')),
          h('div', { class: 'row', style: { gap: '6px', justifyContent: 'flex-end', flexWrap: 'wrap' } },
            e.level < MAX_LEVEL ? h('button', { class: 'btn small', disabled: game.coins < trainCost(e), onclick: () => { const err = train(e.id); if (err) toast(err); else { audio.sfxPlay('success'); toast(`${e.name} aprendió: ahora es ${LEVELS[e.level].toLowerCase()}.`); } render(); } }, `Capacitar (${trainCost(e)} ●)`) : null,
            h('button', { class: 'btn small', onclick: () => { if (confirmFire !== e.id) { confirmFire = e.id; render(); return; } fire(e.id); confirmFire = ''; toast(`${e.name} dejó el restaurante.`); render(); } }, confirmFire === e.id ? 'Tocá otra vez para despedir' : 'Despedir'))),
      );
    }
    if (limit && list.length < limit) {
      body.append(h('b', null, 'Buscan trabajo hoy'), h('p', { class: 'hint' }, `Contratar cuesta ${hireCost()} ●. Al principio trabajan despacio; mejoran practicando o con capacitación. Pagá los sueldos: sin monedas no trabajan.`));
      for (const c of candidates()) {
        body.append(h('div', { class: 'card row', style: { gap: '10px' } }, face(c),
          h('div', { style: { flex: '1' } }, h('b', null, c.name), h('div', { class: 'hint' }, `${TRAITS[c.trait].name}: ${TRAITS[c.trait].line}`), h('div', { class: 'hint' }, `Mesero · ${wageOf(c)} ● por día`)),
          h('button', { class: 'btn small primary', disabled: game.coins < hireCost(), onclick: () => { const err = hire(c); if (err) toast(err); else { audio.sfxPlay('coin'); toast(`${c.name} empezó a trabajar.`); } render(); } }, 'Contratar')));
      }
    } else if (limit) body.append(h('p', { class: 'hint' }, 'No hay lugar para más personal por ahora. Con el restaurante en nivel 5 y 7 se suman más puestos.'));
  };
  render();
  const timer = window.setInterval(() => { if (document.contains(body)) updateDoing(body); }, 700);
  panel({ title: 'Personal', wide: true, body, onClose: () => clearInterval(timer) });
}

function updateDoing(body: HTMLElement) {
  const list = employees();
  body.querySelectorAll('.staff-doing').forEach((el, i) => {
    const e = list[i];
    if (!e) return;
    el.textContent = e.unpaid ? 'No cobró: no trabaja hasta que se le pague.' : runtime.get(e.id)?.doing ?? 'Esperando';
  });
}
