import { recipeCollectionView } from './recipes';
import { runTask } from '../core/errors';
/** Main in-game menus: bag, journal (quests, investigation, relations, collections, calendar), and menu. */
import { iconElement } from '../art/icons';
import { BALANCE } from '../core/balance';
import { game } from '../core/state';
import { CHARACTERS } from '../data/characters';
import { ITEMS, ITEMS_BY_ID, type ItemCat } from '../data/items';
import { allQuests, currentStep, questDef, trackedText } from '../quests/quests';
import { world } from '../scenes/WorldScene';
import { clock } from '../systems/time';
import { EVENTS, upcomingEvents } from '../systems/events';
import { collectionProgress } from '../systems/collect';
import { portraitURL } from '../systems/appearance';
import { confirmBox, h, panel, toast } from './dom';
import { openSettings } from './settingsPanel';
import type { HudHandlers } from './hud';
import { whereIs } from '../systems/npcs';
import { ZONES } from '../data/zones';
import { hudSuggestionLabels } from './hudSuggestions';
import { ACHIEVEMENTS } from '../systems/achievements';
import { openPhone, registerPhoneApps, type PhoneApp } from './phone/phone';
import { openTownMemories } from './townMemories';
import { chip, emptyState, tabBar } from './kit';
import { skinIconEl } from './skin';
import { dayOfSeason, seasonOf, SEASONS, weekday } from '../core/balance';

function tabs(names: string[], onPick: (i: number) => void, start = 0, icons: string[] = []) {
  const bar = tabBar(names.map((label, i) => ({ label, icon: icons[i] })), onPick, start);
  bar.classList.add('compact');
  return bar;
}

// ------------------------------------------------------------------ bag
const BAG_CATS: { name: string; cats: ItemCat[] }[] = [
  { name: 'Ingredientes', cats: ['ingredient', 'supply', 'seed'] },
  { name: 'Colección', cats: ['fish', 'bug', 'flower', 'shell', 'material', 'rare'] },
  { name: 'Regalos', cats: ['gift'] },
  { name: 'Especiales', cats: ['key'] },
];

export function openBag(start = 0) {
  const body = h('div');
  const show = (i: number) => {
    body.innerHTML = '';
    const items = ITEMS.filter((it) => BAG_CATS[i].cats.includes(it.cat) && game.count(it.id) > 0);
    const info = h('div', { class: 'dock-info' }, h('span', { class: 'hint' }, 'Tocá un objeto para ver su descripción.'));
    const grid = h('div', { class: 'grid items' });
    for (const it of items) {
      const b = h('button', { class: 'slot', onclick: () => {
        grid.querySelectorAll('.slot').forEach((s) => s.classList.remove('selected'));
        b.classList.add('selected');
        info.replaceChildren(h('div', { class: 'row', style: { gap: '10px', alignItems: 'flex-start' } }, iconElement(it.icon), h('div', { class: 'col', style: { gap: '2px' } }, h('b', null, `${it.name} ×${game.count(it.id)}`), h('div', null, it.desc), h('div', { class: 'chips' }, chip(`${it.sell} c/u`, 'gold', 'coin'), it.where ? chip(it.where, 'blue') : null))));
      } }, iconElement(it.icon), h('span', null, it.name), h('span', { class: 'qty' }, game.count(it.id)));
      grid.append(b);
    }
    items.sort((a, b) => a.name.localeCompare(b.name, 'es'));
    body.append(items.length ? grid : emptyState('Nada por acá todavía. Lo que juntes, compres o pesques aparece en esta pestaña.', 'bag'), info);
  };
  show(start);
  const counts = BAG_CATS.map((c) => ITEMS.filter((it) => c.cats.includes(it.cat) && game.count(it.id) > 0).length);
  panel({ title: 'Mochila', tabs: tabs(BAG_CATS.map((c, i) => `${c.name}${counts[i] ? ` (${counts[i]})` : ''}`), show, start, ['bag', 'lantern', 'gift', 'scroll']), body: h('div', null, h('div', { class: 'chips', style: { marginBottom: '10px' } }, chip(`${game.coins} monedas`, 'gold', 'coin'), chip('Sin límite de espacio')), body) });
}

// ------------------------------------------------------------------ journal
export function openJournal(start = 0) {
  const body = h('div');
  const views = [questsView, investigationView, relationsView, collectionsView, recipeCollectionView, calendarView];
  const show = (i: number) => {
    body.innerHTML = '';
    body.append(views[i]());
  };
  show(start);
  panel({ title: 'Diario', wide: true, tabs: tabs(['Misiones', 'Investigación', 'Amigos', 'Colección', 'Recetas', 'Calendario'], show, start, ['clipboard', 'inspect', 'heart', 'gift', 'maki', 'calendar']), body });
}

function questsView() {
  const wrap = h('div', { class: 'col' });
  const active = Object.keys(game.save.quests.active).map((id) => questDef(id)).filter(Boolean);
  wrap.append(h('p', { class: 'hint' }, 'La misión marcada se muestra en pantalla. Ninguna es urgente.'));
  if (!active.length) wrap.append(emptyState('Todavía no tenés misiones. Hablá con los vecinos y mirá la cartelera de la plaza.', 'clipboard'));
  for (const kind of ['main', 'side', 'task'] as const) {
    const list = active.filter((q) => q!.kind === kind);
    if (!list.length) continue;
    wrap.append(h('h3', null, kind === 'main' ? 'Historia' : kind === 'side' ? 'Misiones secundarias' : 'Pequeños objetivos'));
    for (const q of list) {
      const st = currentStep(q!.id);
      const stepNo = game.save.quests.active[q!.id]?.step ?? 0;
      const tracked = game.save.quests.tracked === q!.id;
      wrap.append(
        h('div', { class: 'card col', style: { gap: '4px', borderColor: tracked ? '#f2c66d' : undefined } },
          h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', null, q!.title), h('button', { class: 'btn small ' + (tracked ? 'primary' : ''), onclick: (e: Event) => { game.save.quests.tracked = q!.id; game.touch('track'); (e.target as HTMLElement).textContent = 'Marcada'; } }, tracked ? 'Marcada' : 'Marcar')),
          h('div', { class: 'hint' }, q!.desc),
          q!.steps.length > 1 ? h('div', { class: 'steps', role: 'img', 'aria-label': `Paso ${stepNo + 1} de ${q!.steps.length}` }, ...q!.steps.map((_, k) => h('i', { class: k < stepNo ? 'done' : k === stepNo ? 'now' : '' }))) : null,
          st ? h('div', null, '→ ', st.text) : null,
          st?.hint ? h('div', { class: 'hint' }, 'Pista: ' + st.hint) : null,
        ),
      );
    }
  }
  const done = game.save.quests.done.map((id) => questDef(id)).filter(Boolean);
  if (done.length) wrap.append(h('h3', null, `Completadas (${done.length})`), h('div', { class: 'hint' }, done.map((q) => q!.title).join(' · ')));
  const total = allQuests().filter((q) => q.kind === 'side').length;
  wrap.append(h('p', { class: 'hint' }, `Misiones secundarias en el juego: ${total}. Revisá la cartelera de la plaza y hablá con los vecinos.`));
  return wrap;
}

function investigationView() {
  const div = h('div');
  import('../story/notebook').then(({ notebookView }) => div.append(notebookView()));
  return div;
}

function relationsView() {
  const grid = h('div', { class: 'col' }, h('div', { class: 'chips' }, h('button', { class: 'btn small', onclick: openPhotoAlbum }, 'Fotos juntos'), h('button', { class: 'btn small', onclick: () => openJournal(3) }, 'Recuerdos y momentos'), h('button', { class: 'btn small', onclick: () => import('./bonds').then((m) => m.openBonds()) }, 'Vínculos')));
  for (const c of CHARACTERS) {
    const r = game.rel(c.id);
    if (!c.raccoon && r.points <= 0) continue;
    const lvl = game.friendLevel(c.id);
    const pct = ((r.points % BALANCE.friendshipPerLevel) / BALANCE.friendshipPerLevel) * 100;
    const where = whereIs(c.id);
    grid.append(
      h('div', { class: 'card friend' },
        h('img', { src: portraitURL(c.id, 'happy'), alt: c.name }),
        h('div', { class: 'col', style: { gap: '3px', minWidth: '0' } },
          h('div', { class: 'row', style: { justifyContent: 'space-between', flexWrap: 'wrap', gap: '2px 8px' } }, h('b', null, `${c.name} · ${c.title}`), h('span', { class: 'hearts', role: 'img', 'aria-label': `Amistad ${lvl} de 5` }, '♥'.repeat(lvl) + '♡'.repeat(5 - lvl))),
          lvl < 5 ? h('div', { class: 'bar' }, h('i', { style: { width: pct + '%' } })) : h('div', { class: 'hint' }, '¡Amistad máxima!'),
          h('div', { class: 'hint' }, c.bio),
          h('div', { class: 'hint' }, `Ahora: ${where ? ZONES[where]?.name ?? where : 'en su casa'}${game.rel(c.id).lastTalkDay === game.save.time.day ? ' · ya charlaron hoy' : ''}`),
          lvl >= 1 ? h('div', { class: 'hint' }, 'Le encanta: ' + c.loves.filter((id) => game.has(`gift_${c.id}_${id}`) || lvl >= 2).map((id) => ITEMS_BY_ID[id]?.name ?? id).slice(0, 3).join(', ')) : null,
        ),
      ),
    );
  }
  return grid;
}

function collectionsView() {
  const wrap = h('div', { class: 'col' });
  const prog = collectionProgress();
  const names: Record<string, string> = { fish: 'Peces', bugs: 'Insectos', flowers: 'Flores', shells: 'Conchas' };
  const catOf: Record<string, ItemCat> = { fish: 'fish', bugs: 'bug', flowers: 'flower', shells: 'shell' };
  for (const p of prog) {
    const grid = h('div', { class: 'grid' });
    for (const it of ITEMS.filter((i) => i.cat === catOf[p.cat])) {
      const got = game.collected(p.cat, it.id);
      grid.append(h('div', { class: 'slot' + (got ? '' : ' locked'), title: got ? it.desc : it.where ?? '' }, iconElement(got ? it.icon : { type: it.icon.type, c1: '#8d8790', c2: '#a59f9a' }), h('span', null, got ? it.name : '???'), !got && it.where ? h('span', { class: 'hint', style: { fontSize: '.85em' } }, it.where) : null));
    }
    wrap.append(h('h3', null, `${names[p.cat]} — ${p.got}/${p.total}`), grid);
  }
  // memories with the raccoons and friends
  const mems = Object.entries(game.save.flags).filter(([k, v]) => k.startsWith('memory_') && typeof v === 'string');
  wrap.append(h('h3', null, `Recuerdos — ${mems.length}`));
  wrap.append(mems.length ? h('div', { class: 'col' }, ...mems.map(([, v]) => h('div', { class: 'card' }, '✦ ' + String(v)))) : h('p', { class: 'hint' }, 'Los recuerdos aparecen al profundizar la amistad con los mapaches y los vecinos.'));
  // achievements
  const got = game.save.achievements;
  wrap.append(h('h3', null, `Logros — ${got.length}/${ACHIEVEMENTS.length}`));
  const list = h('div', { class: 'grid', style: { gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' } });
  for (const a of ACHIEVEMENTS) list.append(h('div', { class: 'card' + (got.includes(a.id) ? '' : ' locked'), style: { opacity: got.includes(a.id) ? '1' : '.5' } }, h('b', null, a.name), h('div', { class: 'hint' }, a.desc)));
  wrap.append(list);
  // The same saved-photo gallery is also used by NoriPhone.
  if (game.save.photos.length) wrap.append(h('h3', null, `Álbum de fotos — ${game.save.photos.length}`), photoCards());
  wrap.append(h('button', { class: 'btn small', onclick: openTownMemories }, 'Álbum del pueblo · Restauraciones'));
  return wrap;
}

function photoCards() {
  const body = h('div', { class: 'phone-photos' });
  for (const photo of game.save.photos) body.append(h('figure', { class: 'card col' },
    h('img', { src: photo.data, alt: photo.subject, style: { width: '100%', imageRendering: 'pixelated' } }),
    h('figcaption', null, `Día ${photo.day} · ${photo.subject}`)));
  if (!game.save.photos.length) body.append(h('p', { class: 'hint' }, 'Todavía no guardaste fotos. Usá Cámara cerca de Pip, Spicy o Rigg para crear un recuerdo juntos.'));
  return body;
}
export function openPhotoAlbum() { panel({ title: 'Álbum de fotos', body: photoCards() }); }

/** The phone only navigates: each app opens one of the game's existing screens. */
function phoneApps(): PhoneApp[] {
  return [
    { id: 'camera', name: 'Cámara', icon: 'camera', hint: 'Encuadrá la foto y acercá', closePhone: true, run: () => import('./camera').then(m => m.openCamera()) },
    { id: 'photos', name: 'Fotos', icon: 'camera', hint: 'Tus fotos y momentos juntos', run: openPhotoAlbum },
    { id: 'map', name: 'Mapa', icon: 'map', hint: 'Explorar Villa Nori', run: () => import('./worldmap').then(m => m.openWorldMap()) },
    { id: 'quests', name: 'Misiones', icon: 'clipboard', hint: 'Historia y objetivos', run: () => openJournal(0) },
    { id: 'friends', name: 'Amigos', icon: 'heart', hint: 'Pip, Spicy, Rigg y los vecinos', run: () => openJournal(2) },
    { id: 'collections', name: 'Colecciones', icon: 'gift', hint: 'Descubrimientos, recuerdos y logros', run: () => openJournal(3) },
    { id: 'recipes', name: 'Recetario', icon: 'maki', hint: 'Recetas, variantes y dominio', run: () => openJournal(4) },
    { id: 'restaurant', name: 'Restaurante', icon: 'shop', hint: 'Pedidos, nivel y mejoras', run: () => import('../restaurant/kitchen').then(m => m.openOrders()) },
    { id: 'supplies', name: 'Suministros', icon: 'bag', hint: 'Despensa del restaurante y faltantes', run: () => import('./pantry').then(m => m.openPantry()) },
    { id: 'clients', name: 'Clientes', icon: 'heart', hint: 'Vecinos que vienen, favoritos y visitas', run: () => import('./clients').then(m => m.openClients()) },
    { id: 'staff', name: 'Personal', icon: 'heart', hint: 'Empleados, sueldos y tareas', run: () => import('./staff').then(m => m.openStaff()) },
    { id: 'calendar', name: 'Calendario', icon: 'calendar', hint: 'Fechas y eventos', run: () => openJournal(5) },
    { id: 'memories', name: 'Recuerdos', icon: 'scroll', hint: 'Álbum del pueblo restaurado', run: openTownMemories },
    { id: 'investigation', name: 'Pistas', icon: 'inspect', hint: 'El cuaderno de investigación', run: () => openJournal(1) },
    { id: 'bag', name: 'Mochila', icon: 'bag', hint: 'Ingredientes y objetos', run: () => openBag() },
    { id: 'settings', name: 'Ajustes', icon: 'wood_gear', hint: 'Sonido, texto y controles', run: () => openSettings(true) },
    { id: 'more', name: 'Más', icon: 'menu', hint: 'Personaje, descanso, guardado y salida', run: openMenu },
  ];
}
registerPhoneApps(phoneApps);
export function openNoriPhone() { openPhone(); }

function calendarView() {
  const wrap = h('div', { class: 'col' });
  const day = game.save.time.day;
  const season = seasonOf(day), today = dayOfSeason(day);
  const first = day - today + 1;
  wrap.append(h('div', { class: 'chips' }, chip(clock.dateLabel(), 'gold', 'calendar'), chip(clock.label())));
  wrap.append(h('h3', null, `${SEASONS[season]} — ${BALANCE.daysPerSeason} días`));
  const grid = h('div', { class: 'cal', role: 'grid' });
  for (const d of ['L', 'M', 'M', 'J', 'V', 'S', 'D']) grid.append(h('div', { class: 'dow', 'aria-hidden': 'true' }, d));
  // the first day of every season is a Monday (14 days per season = two whole weeks)
  for (let n = 1; n <= BALANCE.daysPerSeason; n++) {
    const ev = EVENTS.find((e) => e.season === season && e.day === n);
    const abs = first + n - 1;
    const cell = h('div', { class: 'day' + (n === today ? ' today' : '') + (n < today ? ' past' : '') + (ev ? ' event' : ''), role: 'gridcell', 'aria-label': `${['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'][weekday(abs)]} ${n}${n === today ? ', hoy' : ''}${ev ? ': ' + ev.name : ''}` }, h('b', null, String(n)), ev ? h('span', { class: 'ev' }, ev.name) : null);
    grid.append(cell);
  }
  wrap.append(grid);
  wrap.append(h('h3', null, 'Próximos eventos'));
  for (const { ev, inDays } of upcomingEvents(day, 5)) wrap.append(h('div', { class: 'card' }, h('div', { class: 'row', style: { justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' } }, h('b', null, ev.name), chip(inDays === 0 ? '¡Hoy!' : `En ${inDays} días`, inDays === 0 ? 'rose' : 'sage')), h('div', { class: 'hint' }, ev.desc)));
  wrap.append(h('p', { class: 'hint' }, 'El calendario de Villa Nori es propio: los eventos se repiten cada año del juego y nunca dependen de la fecha real. El Mercado Nocturno abre los viernes y sábados a la noche.'));
  return wrap;
}

// ------------------------------------------------------------------ main menu
/** Esc: pause menu. Same tiles as the main menu, with save, load and settings first. */
export function openPauseMenu() { openMenu(true); }

export function openMenu(pause = false) {
  const ICON: Record<string, string> = { Mochila: 'bag', Personaje: 'pet', Mapa: 'map', Misiones: 'clipboard', Investigación: 'inspect', Amigos: 'heart', Colecciones: 'gift', Recetario: 'maki', Cámara: 'camera', NoriPhone: 'phone', 'Descansar un rato': 'bed', Ajustes: 'gear', Guardar: 'scroll', Cuenta: 'pet', 'Amigos online': 'heart', 'Jugar juntos': 'maki', Cargar: 'door', 'Guardar y salir': 'door' };
  const b = (label: string, hint: string, fn: () => void, cls = '') =>
    h('button', { type: 'button', class: 'tile ' + cls, onclick: () => { p.close(); void runTask('ui:menu', fn); } }, skinIconEl(ICON[label] ?? 'menu'), h('span', null, label, h('small', null, hint)));
  const tiles = ([

    b('Mochila', 'Tus objetos', () => openBag()),
    b('Personaje', 'Cambiar ropa y apariencia', () => import('./wardrobe').then((m) => m.openWardrobe())),
    b('Mapa', 'Villa Nori', () => openMap()),
    b('Misiones', 'Historia y encargos', () => openJournal(0)),
    b('Investigación', 'Pistas y cuaderno', () => openJournal(1)),
    b('Amigos', 'Relaciones', () => openJournal(2)),
    b('Colecciones', 'Álbum y logros', () => openJournal(3)),
    b('Recetario', 'Recetas, variantes y dominio', () => openJournal(4)),
    b('Cámara', 'Sacar una foto', () => import('./camera').then((m) => m.takePhoto())),
    b('NoriPhone', 'Tus aplicaciones de Villa Nori', () => openNoriPhone()),
    b('Descansar un rato', clock.period < 3 ? 'Pasar al siguiente momento del día' : 'Es de noche: andá a dormir a tu cama', () => restPeriod()),
    b('Ajustes', 'Sonido, texto y controles', () => openSettings(true)),
    b('Cuenta', 'Guardado en la nube', () => import('./account').then((m) => m.openAccount())),
    b('Amigos online', 'Código, amigos y tarjetas', () => import('./friends').then((m) => m.openFriends())),
    b('Jugar juntos', 'Cociná y serví con un amigo', () => import('./coop').then((m) => m.openCoop())),
    b('Guardar', 'Deja un punto fijo de esta partida', async () => {
      const { syncPlayerPos } = await import('../core/flow');
      const { activeSlot, saveManual } = await import('../persistence/storage');
      syncPlayerPos();
      if (await saveManual()) toast(`Partida ${activeSlot() + 1} guardada a mano.`);
    }),
    b('Cargar', 'Elegí un automático o un manual', async () => {
      const { openInGameLoad } = await import('./saves');
      await openInGameLoad();
    }),
    b('Guardar y salir', 'Guarda el automático y vuelve al título', async () => {
      const { syncPlayerPos } = await import('../core/flow');
      const { saveGame } = await import('../persistence/storage');
      syncPlayerPos();
      if (!(await saveGame('exit'))) return;
      if (await confirmBox('Partida guardada. ¿Volver a la pantalla de título?', 'Salir', 'Seguir jugando')) location.reload();
    }),
  ]) as HTMLElement[];
  const FIRST = ['Guardar', 'Cargar', 'Ajustes'];
  const names = (el: HTMLElement) => el.querySelector('span')?.firstChild?.textContent ?? '';
  if (pause) tiles.sort((x, y) => (FIRST.indexOf(names(x)) + 1 || 99) - (FIRST.indexOf(names(y)) + 1 || 99));
  const grid = h('div', { class: 'tiles' }, ...tiles);
  const p = panel({ title: pause ? 'Pausa' : 'Menú', body: pause ? h('div', { class: 'col' }, h('p', { class: 'hint' }, 'El juego está en pausa. Esc para seguir jugando.'), grid) : grid });
}

function restPeriod() {
  if (clock.period >= 3) {
    toast('Es de noche. Dormí en tu cama para empezar un nuevo día.');
    return;
  }
  clock.advancePeriod();
  toast(`Descansaste un rato. Ahora es ${clock.label().toLowerCase()}.`);
}

function openMap() {
  import('./worldmap').then((m) => m.openWorldMap());
}

// ------------------------------------------------------------------ suggestions (gentle, ignorable)
function suggestions(): { label: string; run: () => void }[] {
  const run: Record<string, () => void> = {
    'Preparar sushi': () => { void import('../restaurant/kitchen').then((m) => m.openOrders()); },
    'Ir a pescar': () => toast('La playa está al sur de la plaza.'),
  };
  return hudSuggestionLabels({
    introDone: game.has('intro_done'),
    pendingOrders: game.save.orders.length > 0,
    beachUnlocked: game.has('unlock_beach'),
    period: game.save.time.period,
    atBeach: world.zoneId === 'beach',
  }).map((label) => ({ label, run: run[label] }));
}

export function hudHandlers(): HudHandlers {
  return {
    bag: () => openBag(),
    journal: () => openJournal(),
    menu: () => openNoriPhone(),
    questText: () => trackedText(),
    suggestions,
  };
}
