/** The "Personal" screen: the raccoon crew and the hired staff, what they do, how well, and what they cost. */
import { game } from '../core/state';
import { audio } from '../audio/audio';
import {
  COOK_SECONDS, CREW_INFO, LEVEL_NAMES, MAX_LEVEL, TRAITS, candidates, crew, crewUnlocked, employees, fire, hire, hireCost, roleLimit, runtime, setCrew, setRestock, setStaff,
  MAX_CARRY_UPGRADES, carryUpgradeCost, riggCapacity, staffSave, train, trainCost, trainCrew, upgradeRiggTray, wageOf, type CrewId, type Employee, type StaffRole,
} from '../restaurant/staff';
import { h, panel, toast } from './dom';
import { previewCanvas } from './creator';
import { ITEMS_BY_ID } from '../data/items';

const stars = (n: number) => `${'★'.repeat(n)}${'☆'.repeat(MAX_LEVEL - n)}`;

function face(e: Employee) {
  const cv = previewCanvas(e.look, ['down'], 2);
  cv.style.cssText = 'width:48px;height:auto;image-rendering:pixelated';
  return cv;
}

const ROLE = { waiter: 'Mesero', cook: 'Cocinero', cashier: 'Cajero', helper: 'Ayudante' } as const;
const ROLE_JOB = {
  waiter: 'Toma pedidos y lleva los platos de la bandeja a las mesas.',
  cook: 'Cocina los pedidos del salón con la despensa.',
  cashier: 'Recoge las propinas de las mesas.',
  helper: 'Mantiene la despensa: recibe paquetes de los proveedores (los paga el restaurante).',
} as const;
const RESTOCK_ITEMS = ['rice', 'nori', 'salmon', 'cucumber', 'egg', 'sesame'];
const RESTOCK_STEPS = [0, 6, 12, 20];

export function openStaff() {
  const body = h('div', { class: 'col' });
  let confirmFire = '';
  const render = () => {
    body.innerHTML = '';
    const s = staffSave();
    const lvl = game.save.restaurant.level;
    const list = employees();
    const wages = list.reduce((n, e) => n + wageOf(e), 0);
    body.append(
      h('div', { class: 'card row', style: { justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' } },
        h('div', null, h('b', null, 'Equipo del restaurante'), h('div', { class: 'hint' }, `Sueldos por día: ${wages} ●. Los mapaches ayudan sin cobrar.`)),
        h('button', { class: 'btn small' + (s.paused ? '' : ' primary'), onclick: () => { setStaff({ paused: !s.paused }); render(); } }, s.paused ? 'Todos en pausa: reanudar' : 'Trabajando: pausar a todos')),
      h('b', null, 'Los mapaches'),
      h('p', { class: 'hint' }, 'Al principio van despacio. Mejoran con el tiempo (cada trabajo suma práctica) y capacitándolos con monedas.'),
    );
    for (const id of ['pip', 'rigg', 'spicy'] as CrewId[]) {
      const info = CREW_INFO[id], m = crew(id), ok = crewUnlocked(id);
      const speed = id === 'spicy' ? `Un plato cada ${COOK_SECONDS.crew[m.level]} s` : id === 'rigg' ? `Lleva ${riggCapacity()} plato${riggCapacity() > 1 ? 's' : ''} por viaje` : 'Recibe un grupo a la vez';
      body.append(
        h('div', { class: 'card col', style: { gap: '6px', opacity: ok ? '1' : '.7' } },
          h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', null, info.name), h('span', { class: 'hint' }, `${LEVEL_NAMES[m.level]} ${stars(m.level)}`)),
          h('div', { class: 'hint' }, info.job),
          ok ? h('div', { class: 'hint' }, speed) : h('div', { class: 'hint' }, `Necesita amistad nivel ${info.unlock} con ${info.name}.`),
          ok && id !== 'pip' ? h('div', { class: 'staff-doing' }, m.on ? runtime.get(id)?.doing ?? 'Esperando' : 'Descansando (no ayuda hoy)') : null,
          h('div', { class: 'row', style: { gap: '6px', justifyContent: 'flex-end', flexWrap: 'wrap' } },
            ok && id !== 'pip' ? h('button', { class: 'btn small' + (m.on ? ' primary' : ''), onclick: () => { setCrew(id, !m.on); render(); } }, m.on ? '✓ Ayudando en el salón' : 'Pedirle que ayude') : null,
            ok && id === 'rigg' ? (crew('rigg').carry ?? 0) < MAX_CARRY_UPGRADES
              ? h('button', { class: 'btn small', title: 'Una bandeja más grande para llevar más platos por viaje', disabled: game.coins < carryUpgradeCost(), onclick: () => { const err = upgradeRiggTray(); if (err) toast(err); else { audio.sfxPlay('success'); toast(`Rigg ahora lleva ${riggCapacity()} platos por viaje.`); } render(); } }, `Bandeja de Rigg: ${riggCapacity()} → ${riggCapacity() + 1} (${carryUpgradeCost()} ●)`)
              : h('span', { class: 'hint' }, `Bandeja al máximo: ${riggCapacity()} platos`) : null,
            ok && m.level < MAX_LEVEL ? h('button', { class: 'btn small', disabled: game.coins < trainCost(m.level, true), onclick: () => { const err = trainCrew(id); if (err) toast(err); else { audio.sfxPlay('success'); toast(`${info.name} mejoró: ahora es ${LEVEL_NAMES[crew(id).level].toLowerCase()}.`); } render(); } }, `Capacitar (${trainCost(m.level, true)} ●)`) : null)),
      );
    }
    body.append(h('b', null, `Personal contratado`));
    if (!roleLimit('waiter', lvl)) body.append(h('p', { class: 'hint' }, 'Podés contratar un mesero desde el nivel 3 del restaurante, un cocinero desde el 4, un cajero desde el 5 y un ayudante desde el 6.'));
    for (const e of list) {
      const r = runtime.get(e.id);
      body.append(
        h('div', { class: 'card col', style: { gap: '6px' } },
          h('div', { class: 'row', style: { gap: '10px' } }, face(e),
            h('div', { style: { flex: '1' } }, h('b', null, `${e.name} · ${ROLE[e.role]}`), h('div', { class: 'hint' }, `${TRAITS[e.trait].name}: ${TRAITS[e.trait].line}`),
              h('div', { class: 'hint' }, `${LEVEL_NAMES[e.level]} ${stars(e.level)} · ${wageOf(e)} ● por día${e.role === 'cook' ? ` · un plato cada ${COOK_SECONDS.hired[e.level]} s` : ''}`),
              h('div', { class: 'staff-doing' }, e.unpaid ? 'No cobró: no trabaja hasta que se le pague.' : r?.doing ?? 'Esperando'))),
          e.role === 'waiter' ? h('div', { class: 'row', style: { gap: '6px', flexWrap: 'wrap' } },
            h('button', { class: 'btn small' + (e.takeOrders ? ' primary' : ''), onclick: () => { e.takeOrders = !e.takeOrders; game.touch('staff'); render(); } }, e.takeOrders ? '✓ Toma pedidos' : 'Toma pedidos'),
            h('button', { class: 'btn small' + (e.serve ? ' primary' : ''), onclick: () => { e.serve = !e.serve; game.touch('staff'); render(); } }, e.serve ? '✓ Sirve platos' : 'Sirve platos'),
            h('button', { class: 'btn small', title: 'Qué hace primero cuando hay de las dos cosas', onclick: () => { e.priority = e.priority === 'serve' ? 'orders' : 'serve'; game.touch('staff'); render(); } }, e.priority === 'serve' ? 'Primero: platos' : 'Primero: pedidos')) : null,
          h('div', { class: 'row', style: { gap: '6px', justifyContent: 'flex-end', flexWrap: 'wrap' } },
            e.level < MAX_LEVEL ? h('button', { class: 'btn small', disabled: game.coins < trainCost(e.level), onclick: () => { const err = train(e.id); if (err) toast(err); else { audio.sfxPlay('success'); toast(`${e.name} aprendió: ahora es ${LEVEL_NAMES[e.level].toLowerCase()}.`); } render(); } }, `Capacitar (${trainCost(e.level)} ●)`) : null,
            h('button', { class: 'btn small', onclick: () => { if (confirmFire !== e.id) { confirmFire = e.id; render(); return; } fire(e.id); confirmFire = ''; toast(`${e.name} dejó el restaurante.`); render(); } }, confirmFire === e.id ? 'Tocá otra vez para despedir' : 'Despedir'))),
      );
    }
    if (list.some((e) => e.role === 'helper')) {
      const wanted = staffSave().restock ?? {};
      body.append(h('b', null, 'Reposición del ayudante'), h('p', { class: 'hint' }, 'Tocá un ingrediente para elegir cuántas unidades quiere tener siempre en la despensa. Cuando baja, el ayudante recibe un paquete y lo paga el restaurante.'),
        h('div', { class: 'row', style: { flexWrap: 'wrap', gap: '6px' } }, ...RESTOCK_ITEMS.map((id) => { const min = wanted[id] ?? 0; return h('button', { class: 'btn small' + (min ? ' primary' : ''), onclick: () => { setRestock(id, RESTOCK_STEPS[(RESTOCK_STEPS.indexOf(min) + 1) % RESTOCK_STEPS.length]); render(); } }, `${ITEMS_BY_ID[id].name}: ${min ? 'mín. ' + min : 'no'}`); })));
    }
    for (const role of ['waiter', 'cook', 'cashier', 'helper'] as StaffRole[]) {
      const limit = roleLimit(role, lvl);
      if (!limit || list.filter((e) => e.role === role).length >= limit) continue;
      body.append(h('b', null, `Buscan trabajo: ${ROLE[role].toLowerCase()}`), h('p', { class: 'hint' }, `${ROLE_JOB[role]} Contratar cuesta ${hireCost(role)} ●. Al principio trabajan despacio. Sin monedas para el sueldo, no trabajan.`));
      for (const c of candidates(role)) {
        body.append(h('div', { class: 'card row', style: { gap: '10px' } }, face(c),
          h('div', { style: { flex: '1' } }, h('b', null, c.name), h('div', { class: 'hint' }, `${TRAITS[c.trait].name}: ${TRAITS[c.trait].line}`), h('div', { class: 'hint' }, `${ROLE[role]} · ${wageOf(c)} ● por día`)),
          h('button', { class: 'btn small primary', disabled: game.coins < hireCost(role), onclick: () => { const err = hire(c); if (err) toast(err); else { audio.sfxPlay('coin'); toast(`${c.name} empezó a trabajar.`); } render(); } }, 'Contratar')));
      }
    }
  };
  render();
  const timer = window.setInterval(() => { if (document.contains(body)) updateDoing(body); }, 700);
  panel({ title: 'Personal', wide: true, body, onClose: () => clearInterval(timer) });
}

function updateDoing(body: HTMLElement) {
  const cards = [...body.querySelectorAll('.staff-doing')] as HTMLElement[];
  const ids: string[] = [];
  for (const id of ['rigg', 'spicy'] as CrewId[]) if (crewUnlocked(id) && crew(id).on) ids.push(id);
  const all = [...(['rigg', 'spicy'] as CrewId[]).filter((id) => crewUnlocked(id)).map((id) => ({ id, on: crew(id).on })), ...employees().map((e) => ({ id: e.id, on: true, e }))];
  cards.forEach((el, i) => {
    const w = all[i] as { id: string; on: boolean; e?: Employee } | undefined;
    if (!w) return;
    if (w.e?.unpaid) el.textContent = 'No cobró: no trabaja hasta que se le pague.';
    else if (!w.on) el.textContent = 'Descansando (no ayuda hoy)';
    else el.textContent = runtime.get(w.id)?.doing ?? 'Esperando';
  });
  void ids;
}
