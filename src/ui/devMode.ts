/** In-game test panel: warp anywhere, open the roads, and fill the current save. */
import { runTask } from '../core/errors';
import { BALANCE } from '../core/balance';
import { game } from '../core/state';
import { ZONES } from '../data/zones';
import { world } from '../scenes/WorldScene';
import { DEV_PLACE_FLAGS, devArrival, devZoneGroups, giveTestKit, maxFriendships, openPlaces, prepareEverything } from '../systems/devMode';
import { clock } from '../systems/time';
import { h, panel, toast } from './dom';

function roadsOpen() {
  return DEV_PLACE_FLAGS.every((flag) => game.has(flag));
}

async function refreshHere() {
  const player = world.player;
  if (!player || !world.zoneId) return;
  await world.enterZone(world.zoneId, player.tx, player.ty, player.dir, false, true);
}

async function goZone(id: string) {
  const spot = devArrival(id);
  const name = ZONES[id]?.name ?? id;
  if (!spot || !world.player) {
    toast(`No pude entrar a ${name}.`);
    return;
  }
  try {
    const ok = await world.enterZone(id, spot.x, spot.y, spot.dir, true, true);
    if (!ok) toast(`No pude entrar a ${name}. Esperá un segundo y probá de nuevo.`);
  } catch {
    toast(`No pude entrar a ${name}.`);
  }
}

export function openDevMode() {
  if (!game.loaded || !world.player) {
    toast('Entrá a una partida para usar el modo prueba.');
    return;
  }
  let close = () => {};
  const body = h('div', { class: 'col dev-mode' });

  const go = (fn: () => void | Promise<void>) => () => { void runTask('dev:mode', fn); };

  function render() {
    const places = devZoneGroups().map((group) => h('div', { class: 'col' },
      h('h3', null, group.title),
      h('div', { class: 'dev-places' }, ...group.ids.map((id) =>
        h('button', { type: 'button', class: 'btn small', onclick: () => { close(); void runTask('dev:go', () => goZone(id)); } }, ZONES[id].name))),
    ));
    body.replaceChildren(
      h('p', { class: 'hint' }, 'Entrá a cualquier lugar, abrí los portones o llená esta partida para probar. Se guarda acá. Los capítulos de la historia no se marcan como terminados. En la compu, F8 abre este menú mientras caminás.'),
      h('p', { class: 'hint' }, roadsOpen()
        ? 'Los caminos de esta partida ya están abiertos. Las tiendas atienden fuera de horario.'
        : 'Los caminos siguen como en tu historia. Igual podés entrar a un lugar desde la lista.'),
      h('button', { type: 'button', class: 'btn primary', onclick: go(async () => { prepareEverything(); await refreshHere(); toast('Listo para probar: caminos abiertos, despensa llena y amistades al máximo.'); render(); }) }, 'Preparar todo'),
      h('h3', null, 'Ir a un lugar'),
      ...places,
      h('h3', null, 'Hora del día'),
      h('p', { class: 'hint' }, 'El mercado nocturno se abre de noche, si los caminos ya están abiertos.'),
      h('div', { class: 'dev-places' }, ...BALANCE.periodNames.map((name, period) =>
        h('button', {
          type: 'button', class: 'btn small' + (clock.period === period ? ' primary' : ''),
          onclick: go(async () => { clock.place(period, 20); await refreshHere(); toast(`Ahora es ${name.toLowerCase()}.`); render(); }),
        }, name))),
      h('h3', null, 'Por separado'),
      h('div', { class: 'dev-places' },
        h('button', { type: 'button', class: 'btn small', onclick: go(async () => { openPlaces(); await refreshHere(); toast('Caminos y tiendas abiertos.'); render(); }) }, 'Abrir caminos y tiendas'),
        h('button', { type: 'button', class: 'btn small', onclick: go(() => { giveTestKit(); toast('Recetas, monedas e ingredientes listos.'); render(); }) }, 'Dar recetas y despensa'),
        h('button', { type: 'button', class: 'btn small', onclick: go(() => { maxFriendships(); toast('Amistades al máximo.'); render(); }) }, 'Amistades al máximo'),
      ),
    );
  }

  render();
  const p = panel({ title: 'Modo prueba', body, wide: true });
  close = p.close;
}
