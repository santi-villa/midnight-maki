import { runTask } from '../core/errors';
/** Main in-game menus: bag, journal (quests, investigation, relations, collections, calendar), and menu. */
import { iconElement } from '../art/icons';
import { audio } from '../audio/audio';
import { BALANCE } from '../core/balance';
import { game } from '../core/state';
import { CHARACTERS } from '../data/characters';
import { ITEMS, ITEMS_BY_ID, type ItemCat } from '../data/items';
import { RECIPES } from '../data/recipes';
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
import { ACHIEVEMENTS } from '../systems/achievements';

function tabs(names: string[], onPick: (i: number) => void, start = 0) {
  const bar = h('div', { class: 'tabs' });
  const btns = names.map((n, i) => h('button', { class: 'tab' + (i === start ? ' active' : ''), onclick: () => { btns.forEach((b, j) => b.classList.toggle('active', j === i)); audio.sfxPlay('tap'); onPick(i); } }, n));
  bar.append(...btns);
  return bar;
}

// ------------------------------------------------------------------ bag
const BAG_CATS: { name: string; cats: ItemCat[] }[] = [
  { name: 'Ingredientes', cats: ['ingredient', 'seed'] },
  { name: 'Colección', cats: ['fish', 'bug', 'flower', 'shell', 'material', 'rare'] },
  { name: 'Regalos', cats: ['gift'] },
  { name: 'Especiales', cats: ['key'] },
];

export function openBag(start = 0) {
  const body = h('div');
  const show = (i: number) => {
    body.innerHTML = '';
    const items = ITEMS.filter((it) => BAG_CATS[i].cats.includes(it.cat) && game.count(it.id) > 0);
    const info = h('div', { class: 'card', style: { marginTop: '10px', minHeight: '64px' } }, h('span', { class: 'hint' }, 'Tocá un objeto para ver su descripción.'));
    const grid = h('div', { class: 'grid' });
    for (const it of items) {
      const b = h('button', { class: 'slot', onclick: () => {
        grid.querySelectorAll('.slot').forEach((s) => s.classList.remove('selected'));
        b.classList.add('selected');
        info.innerHTML = '';
        info.append(h('b', null, it.name), h('p', { style: { margin: '4px 0' } }, it.desc), h('div', { class: 'hint' }, `Valor: ${it.sell} ●${it.where ? ' · ' + it.where : ''}`));
      } }, iconElement(it.icon), h('span', null, it.name), h('span', { class: 'qty' }, game.count(it.id)));
      grid.append(b);
    }
    if (!items.length) grid.append(h('p', { class: 'muted' }, 'Nada por acá todavía.'));
    body.append(grid, info);
  };
  show(start);
  panel({ title: 'Mochila', tabs: tabs(BAG_CATS.map((c) => c.name), show, start), body: h('div', null, h('div', { class: 'row', style: { justifyContent: 'space-between', marginBottom: '8px' } }, h('span', { class: 'coin' }, `${game.coins} monedas`), h('span', { class: 'hint' }, 'Sin límite de espacio')), body) });
}

// ------------------------------------------------------------------ journal
export function openJournal(start = 0) {
  const body = h('div');
  const views = [questsView, investigationView, relationsView, collectionsView, recipesView, calendarView];
  const show = (i: number) => {
    body.innerHTML = '';
    body.append(views[i]());
  };
  show(start);
  panel({ title: 'Diario', wide: true, tabs: tabs(['Misiones', 'Investigación', 'Amigos', 'Colección', 'Recetas', 'Calendario'], show, start), body });
}

function questsView() {
  const wrap = h('div', { class: 'col' });
  const active = Object.keys(game.save.quests.active).map((id) => questDef(id)).filter(Boolean);
  wrap.append(h('p', { class: 'hint' }, 'La misión marcada se muestra en pantalla. Ninguna es urgente.'));
  for (const kind of ['main', 'side', 'task'] as const) {
    const list = active.filter((q) => q!.kind === kind);
    if (!list.length) continue;
    wrap.append(h('h3', null, kind === 'main' ? 'Historia' : kind === 'side' ? 'Misiones secundarias' : 'Pequeños objetivos'));
    for (const q of list) {
      const st = currentStep(q!.id);
      const tracked = game.save.quests.tracked === q!.id;
      wrap.append(
        h('div', { class: 'card col', style: { gap: '4px', borderColor: tracked ? '#f2c66d' : undefined } },
          h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', null, q!.title), h('button', { class: 'btn small ' + (tracked ? 'primary' : ''), onclick: (e: Event) => { game.save.quests.tracked = q!.id; game.touch('track'); (e.target as HTMLElement).textContent = 'Marcada'; } }, tracked ? 'Marcada' : 'Marcar')),
          h('div', { class: 'hint' }, q!.desc),
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
  const grid = h('div', { class: 'col' });
  for (const c of CHARACTERS) {
    const r = game.rel(c.id);
    if (!c.raccoon && r.points <= 0) continue;
    const lvl = game.friendLevel(c.id);
    const pct = ((r.points % BALANCE.friendshipPerLevel) / BALANCE.friendshipPerLevel) * 100;
    const where = whereIs(c.id);
    grid.append(
      h('div', { class: 'card row', style: { gap: '10px' } },
        h('img', { src: portraitURL(c.id, 'happy'), style: { width: '56px', height: '62px', imageRendering: 'pixelated', background: '#eadbbb', borderRadius: '8px' } }),
        h('div', { class: 'col', style: { gap: '3px', flex: '1' } },
          h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', null, `${c.name} · ${c.title}`), h('span', { style: { color: '#c27f86' } }, '♥'.repeat(lvl) + '♡'.repeat(5 - lvl))),
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
  // photos
  if (game.save.photos.length) {
    const ph = h('div', { class: 'grid', style: { gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' } });
    for (const p of game.save.photos) ph.append(h('div', { class: 'card col', style: { padding: '4px' } }, h('img', { src: p.data, style: { width: '100%', imageRendering: 'pixelated', borderRadius: '6px' } }), h('span', { class: 'hint' }, `Día ${p.day} · ${p.subject}`)));
    wrap.append(h('h3', null, `Álbum de fotos — ${game.save.photos.length}`), ph);
  }
  return wrap;
}

function recipesView() {
  const grid = h('div', { class: 'col' });
  const known = new Set(game.save.recipesKnown);
  for (const cat of ['basic', 'intermediate', 'special'] as const) {
    const g = h('div', { class: 'grid' });
    for (const r of RECIPES.filter((x) => x.cat === cat)) {
      const k = known.has(r.id);
      const n = game.save.recipesCooked[r.id] ?? 0;
      g.append(h('div', { class: 'slot' + (k ? '' : ' locked'), title: k ? r.desc : r.unlock.text }, iconElement(k ? r.icon : { type: 'maki', c1: '#8d8790' }), h('span', null, k ? r.name : '???'), h('span', { class: 'hint', style: { fontSize: '.85em' } }, k ? `${r.price} ● · ${n} hechos` : r.unlock.text)));
    }
    grid.append(h('h3', null, cat === 'basic' ? 'Básicas' : cat === 'intermediate' ? 'Intermedias' : 'Especiales'), g);
  }
  return grid;
}

function calendarView() {
  const wrap = h('div', { class: 'col' });
  wrap.append(h('p', null, h('b', null, clock.dateLabel()), ` — ${clock.label()}`));
  wrap.append(h('p', { class: 'hint' }, 'El calendario de Villa Nori es propio: los eventos se repiten cada año del juego y nunca dependen de la fecha real.'));
  for (const { ev, inDays } of upcomingEvents(game.save.time.day, 5)) wrap.append(h('div', { class: 'card' }, h('b', null, ev.name), h('div', { class: 'hint' }, `${inDays === 0 ? '¡Hoy!' : `En ${inDays} días`} · ${ev.desc}`)));
  wrap.append(h('p', { class: 'hint' }, `Eventos del año: ${EVENTS.map((e) => e.name).join(', ')}. El Mercado Nocturno abre los viernes y sábados a la noche.`));
  return wrap;
}

// ------------------------------------------------------------------ main menu
export function openMenu() {
  const b = (label: string, hint: string, fn: () => void, cls = '') =>
    h('button', { class: 'btn ' + cls, style: { textAlign: 'left', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px' }, onclick: () => { p.close(); void runTask('ui:menu', fn); } }, h('span', null, label), h('span', { class: 'hint', style: { fontWeight: '400' } }, hint));
  const grid = h(
    'div',
    { class: 'grid', style: { gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' } },
    b('Mochila', 'Tus objetos', () => openBag()),
    b('Personaje', 'Cambiar ropa y apariencia', () => import('./wardrobe').then((m) => m.openWardrobe())),
    b('Mapa', 'Villa Nori', () => openMap()),
    b('Misiones', 'Historia y encargos', () => openJournal(0)),
    b('Investigación', 'Pistas y cuaderno', () => openJournal(1)),
    b('Amigos', 'Relaciones', () => openJournal(2)),
    b('Colecciones', 'Álbum y logros', () => openJournal(3)),
    b('Cámara', 'Sacar una foto', () => import('./camera').then((m) => m.takePhoto())),
    b('Descansar un rato', clock.period < 3 ? 'Pasar al siguiente momento del día' : 'Es de noche: andá a dormir a tu cama', () => restPeriod()),
    b('Ajustes', 'Sonido, texto, accesibilidad', () => openSettings(true)),
    b('Guardar y salir', 'Volver al título', async () => {
      const { saveGame } = await import('../persistence/storage');
      if (!(await saveGame('exit'))) return;
      if (await confirmBox('Partida guardada. ¿Volver a la pantalla de título?', 'Salir', 'Seguir jugando')) location.reload();
    }),
  );
  const p = panel({ title: 'Menú', body: grid });
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
  const out: { label: string; run: () => void }[] = [];
  if (!game.has('intro_done')) return out;
  if (game.save.orders.length) out.push({ label: 'Preparar sushi', run: () => import('../restaurant/kitchen').then((m) => m.openOrders()) });
  const r = ['pip', 'spicy', 'rigg'].sort((a, b) => game.rel(a).lastTalkDay - game.rel(b).lastTalkDay)[0];
  if (game.rel(r).lastTalkDay !== game.save.time.day) out.push({ label: `Visitar a ${CHARACTERS.find((c) => c.id === r)!.name}`, run: () => toast(`${CHARACTERS.find((c) => c.id === r)!.name} está en: ${ZONES[whereIs(r) ?? '']?.name ?? 'su cuarto'}`) });
  if (game.has('unlock_beach') && game.save.time.period < 3 && world.zoneId !== 'beach') out.push({ label: 'Ir a pescar', run: () => toast('La playa está al sur de la plaza.') });
  else out.push({ label: 'Ver colección', run: () => openJournal(3) });
  return out.slice(0, 3);
}

export function hudHandlers(): HudHandlers {
  return {
    bag: () => openBag(),
    journal: () => openJournal(),
    menu: () => openMenu(),
    questText: () => trackedText(),
    suggestions,
  };
}
