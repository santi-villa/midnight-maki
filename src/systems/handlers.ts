/** Registers every world interaction handler. Imported once when the world starts. */
import { iconElement } from '../art/icons';
import { audio } from '../audio/audio';
import { game } from '../core/state';
import { ITEMS, ITEMS_BY_ID } from '../data/items';
import { ZONES } from '../data/zones';
import { choose, runScene, say } from '../dialogue/dialogue';
import { boardQuests, acceptSide, SIDE_META } from '../quests/side';
import { questDef } from '../quests/quests';
import { world } from '../scenes/WorldScene';
import { h, panel, toast } from '../ui/dom';
import { registerAction } from './actions';
import { harvest, plant, SEED_INFO, water } from './garden';
import { clock } from './time';
import '../restaurant/kitchen';
import '../story/story';
import '../quests/side';
import './achievements';


registerAction('shop', async (id) => {
  const { openShop } = await import('../ui/shops');
  await openShop(id);
});

registerAction('bed', async () => {
  const c = await new Promise<number>((resolve) => {
    runScene('bed', async () => {
      resolve(await choose(clock.period < 3 ? ['Dormir hasta mañana', 'Descansar un rato (pasar al siguiente momento)', 'Todavía no'] : ['Dormir hasta mañana', 'Todavía no'], 'player', '¿Descansar?'));
    });
  });
  const opts = clock.period < 3 ? ['sleep', 'rest', 'no'] : ['sleep', 'no'];
  if (opts[c] === 'sleep') {
    const { sleepNow } = await import('./sleep');
    await sleepNow();
  } else if (opts[c] === 'rest') {
    clock.advancePeriod();
    toast(`Descansaste un rato. Ahora es ${clock.label().toLowerCase()}.`);
  }
});

registerAction('wardrobe', async () => {
  const { openWardrobe } = await import('../ui/wardrobe');
  openWardrobe();
});

registerAction('pantry', () => {
  import('../ui/menus').then((m) => m.openBag(0));
});

registerAction('door', async (to) => {
  const d = world.zone.def.doors.find((dd) => dd.to === to);
  if (!d) return;
  if (d.lock && !game.has(d.lock.flag)) {
    toast(d.lock.msg);
    const { onLockedDoor } = await import('../story/story');
    onLockedDoor(to);
    return;
  }
  audio.sfxPlay('door');
  await world.enterZone(d.to, d.tx, d.ty, d.dir);
});

registerAction('board', () => {
  const ids = boardQuests();
  const body = h('div', { class: 'col' });
  body.append(h('p', { class: 'hint' }, 'Pedidos de los vecinos. Aceptá solo los que tengas ganas: ninguno vence.'));
  if (!ids.length) body.append(h('p', { class: 'muted' }, 'No hay pedidos nuevos por ahora. Volvé otro día.'));
  for (const id of ids) {
    const q = questDef(id)!;
    body.append(
      h('div', { class: 'card col', style: { gap: '4px' } },
        h('b', null, q.title),
        h('div', { class: 'hint' }, `De: ${q.giver ? q.giver.charAt(0).toUpperCase() + q.giver.slice(1) : '—'} · ${q.desc}`),
        h('div', null, `"${SIDE_META[id].intro}"`),
        h('button', { class: 'btn small primary', onclick: (e: Event) => { acceptSide(id); (e.target as HTMLButtonElement).replaceWith(h('span', { class: 'pill' }, 'Aceptado')); } }, 'Aceptar')),
    );
  }
  panel({ title: 'Cartelera de Villa Nori', body });
});

registerAction('mail', async () => {
  if (game.has('ch1_done') && !game.has('odd_order_read') && game.save.time.day > Number(game.flag('ch1_done_day') ?? 0)) {
    const { readOddOrder } = await import('../story/story');
    await readOddOrder();
    return;
  }
  if (game.has('story_done') && !game.has('akio_visit') && game.save.time.day > Number(game.flag('story_done_day') ?? 0)) {
    await runScene('akio_letter', async () => {
      await say('narr', 'Hay una carta con matasellos de la Ciudad del Puerto. La letra es la misma de la carta de la herencia.');
      await say('?Akio (carta)', '"{Querido|Querida} {name}: vi la luz del faro desde mi ventana. Mi salud está mejor y mi hija dice que el aire de mar me hará bien. ¿Me guardarían una mesa? Prometo no meterme en la cocina. Mucho. — Akio."');
      game.setFlag('akio_visit');
      await say('narr', 'Desde ahora, Akio visita Villa Nori. Podés encontrarlo en el restaurante, el jardín o la playa.');
    });
    return;
  }
  await runScene('mail', async () => {
    const day = game.save.time.day;
    if (game.flag('mail_day') === day) {
      await say('narr', 'El buzón está vacío. Sora pasa todas las mañanas.');
      return;
    }
    game.setFlag('mail_day', day);
    const letters = [
      ['Sora', '¡Buen día! Te dejo un folleto: "Hoy, té gratis con cada sonrisa en la panadería". Bento lo escribió a mano.'],
      ['Yuki', 'Llegaron telas nuevas. Pasá cuando quieras, ¡te guardo la mejor!'],
      ['Nami', '¿Sabías que los peces muerden más cuando no los mirás? Probá. Es ciencia. Creo.'],
      ['Taro', 'OFERTA: arroz al precio de siempre. No es oferta, pero queda lindo escribirlo.'],
      ['Kumo', 'Recordatorio: los libros se devuelven. Esto no va dirigido a nadie en particular. Rigg.'],
    ];
    const [from, text] = letters[day % letters.length];
    await say('narr', `Una carta de ${from}: "${text}"`);
    if (day % 3 === 0) {
      const gift = ['g_candy', 'sesame', 'nori', 'rice', 'sd_flower'][day % 5];
      game.addItem(gift, 1, 'mail');
      await say('narr', `Venía con un regalito: ${ITEMS_BY_ID[gift].name}.`);
    }
  });
});

registerAction('fountain', async () => {
  if (game.has('sq_fountain_active') || (game.save.quests.active.sq_fountain && !game.has('fountain_restored'))) {
    const { restoration } = await import('../minigames/restore');
    if (await restoration('Limpiar la fuente', 'fountain')) {
      game.setFlag('fountain_restored');
      toast('¡La fuente brilla otra vez!');
    }
    return;
  }
  await runScene('fountain', async () => {
    if (game.coins >= 1 && game.flag('wish_day') !== game.save.time.day) {
      const c = await choose(['Tirar una moneda y pedir un deseo', 'Solo mirar el agua']);
      if (c === 0) {
        game.spend(1, 'wish');
        game.setFlag('wish_day', game.save.time.day);
        audio.sfxPlay('water');
        await say('narr', 'La moneda brilla un momento en el fondo. Te sentís un poquito más liviana.');
        if (Math.random() < 0.25) {
          game.addItem('st_seaglass', 1, 'fountain');
          await say('narr', 'Algo brilla entre las monedas viejas: ¡un vidrio de mar!');
        }
        return;
      }
    }
    await say('narr', 'El agua de la fuente hace un ruido tranquilo. Se ven monedas viejas en el fondo.');
  });
});

registerAction('plot', async (arg) => {
  setTimeout(() => world.placeCrops(), 50);
  const i = Number(arg);
  const p = game.save.garden[i];
  if (!p) return;
  if (p.ready) {
    const y = harvest(i);
    if (y) {
      audio.sfxPlay('pickup');
      toast('Cosechaste: ' + y.map(([id, n]) => `${n} ${ITEMS_BY_ID[id].name}`).join(', '));
      for (const [id] of y) if (ITEMS_BY_ID[id].cat === 'flower') game.collect('flowers', id);
    }
    return;
  }
  if (p.seed) {
    if (water(i)) {
      audio.sfxPlay('water');
      toast(`Regaste ${SEED_INFO[p.seed].name}. Crece un día por cada día regado.`);
    } else toast(`${SEED_INFO[p.seed].name}: ${p.plantedDay}/${SEED_INFO[p.seed].days} días. Ya está regado hoy.`);
    return;
  }
  const seeds = ITEMS.filter((it) => it.cat === 'seed' && game.count(it.id) > 0);
  if (!seeds.length) {
    toast('No tenés semillas. Taro vende en su almacén.');
    return;
  }
  const grid = h('div', { class: 'grid' });
  const pnl = panel({ title: 'Plantar', body: grid });
  for (const s of seeds)
    grid.append(h('button', { class: 'slot', onclick: () => { if (plant(i, s.id)) { world.placeCrops(); audio.sfxPlay('place'); toast(`Plantaste ${SEED_INFO[s.id].name}. ¡Regala!`); } pnl.close(); } }, iconElement(s.icon), h('span', null, s.name), h('span', { class: 'qty' }, game.count(s.id))));
});

registerAction('fish', async (kind) => {
  if (clock.paused) return;
  const { fish } = await import('../minigames/fishing');
  await fish(kind === 'sea' ? 'sea' : 'lake');
});

registerAction('minigame', async (name) => {
  const m = await import('../minigames/casual');
  if (name === 'sort') await m.sortPantry();
  else if (name === 'merge') await m.mergeGarden();
  else if (name === 'memory') {
    const opp = await new Promise<number>((res) => runScene('memory_pick', async () => res(await choose(['Contra Pip', 'Contra Spicy', 'Contra Rigg', 'Mejor no'], 'player', '¿Con quién jugás?'))));
    if (opp < 3) await m.memoryGame(['pip', 'spicy', 'rigg'][opp]);
  }
});

registerAction('library', async () => {
  await runScene('library', async () => {
    if (game.save.quests.active.sq_rigg_book && !game.has('rigg_book_found')) {
      game.setFlag('rigg_book_found');
      await say('narr', 'En el estante de geografía, entre dos diccionarios, está "Mapas de la costa". Tiene una nota: "Propiedad de Rigg. NO tocar. Bueno, solo vos."');
      return;
    }
    const facts = [
      'Un libro sobre Villa Nori: "Fundada por pescadores que se guiaban con tres estrellas del norte".',
      'Un recetario antiguo: "El arroz de sushi se abanica mientras se mezcla, para que brille".',
      'Un libro de astronomía con una página doblada: un faro dibujado a mano.',
      'Un diccionario de flores: "La camelia significa admiración. La margarita, inocencia".',
    ];
    await say('narr', facts[game.save.time.day % facts.length]);
  });
});

registerAction('sunset', async () => {
  await runScene('sunset', async () => {
    if (clock.period === 2) {
      await say('narr', 'El sol se hunde en el mar y todo se pone rosa y dorado. Por un momento, no hay nada que hacer. Y está bien.');
      game.setFlag('saw_sunset');
    } else await say('narr', 'El mar va y viene. Las gaviotas discuten a lo lejos.');
  });
});

registerAction('fortune', async () => {
  await runScene('fortune', async () => {
    const f = [
      'Las estrellas dicen: hoy es un buen día para cocinar algo nuevo.',
      'Las estrellas dicen: alguien pequeño te tiene un regalo.',
      'Las estrellas dicen: el mar guarda algo para vos esta semana.',
      'Las estrellas dicen: una conversación tranquila vale más que mil monedas.',
      'Las estrellas dicen: probá un ingrediente que nunca usaste.',
    ];
    await say('?Adivina estelar', f[(game.save.time.day + 3) % f.length]);
  });
});

registerAction('secret', async (name) => {
  if (name === 'forest_path') {
    await runScene('secret_path', async () => {
      if (!game.has('stump_solved')) {
        await say('narr', 'Detrás de los arbustos hay un sendero cubierto de enredaderas. Algo en el tocón tallado del claro parece estar conectado.');
        return;
      }
      if (!game.has('secret_corner')) {
        game.setFlag('secret_corner');
        await say('narr', 'El sendero se abre a un rincón diminuto lleno de luciérnagas. Alguien dejó un frasco con estrellitas de papel... y un peluche de mapache.');
        game.save.furnitureOwned.plush_raccoon = (game.save.furnitureOwned.plush_raccoon ?? 0) + 1;
        game.touch('secret');
        await say('narr', 'Obtuviste: Peluche de mapache (para decorar).');
      } else await say('narr', 'El rincón secreto sigue lleno de luciérnagas. Huele a pino y a promesas.');
    });
  }
});

// furniture interactions
registerAction('aquarium', async () => {
  const fish = Object.keys(game.save.collections.fish ?? {});
  await runScene('aquarium', async () => {
    await say('narr', fish.length ? `En el acuario nadan tus capturas favoritas: ${fish.slice(0, 5).map((f) => ITEMS_BY_ID[f].name).join(', ')}.` : 'El acuario está esperando a sus primeros habitantes. ¡Andá a pescar!');
  });
});
registerAction('piano', async () => {
  for (const [i, n] of [523, 659, 784, 1046].entries()) setTimeout(() => audio.voice(n / 330), i * 180);
  toast('♪ Tocás una melodía suave.');
});
registerAction('radio', async () => {
  const tracks = ['town', 'restaurant', 'garden', 'beach', 'stars'] as const;
  const i = (Number(game.flag('radio_i') ?? 0) + 1) % tracks.length;
  game.setFlag('radio_i', i);
  audio.play(tracks[i]);
  toast('La radio cambia de canción.');
});
registerAction('telescope', async () => {
  await runScene('telescope', async () => say('narr', clock.isNight() ? (game.has('story_done') ? 'Tres estrellas brillan juntas sobre el faro. Parecen saludarte.' : 'Hay un hueco raro en el cielo, como si faltaran tres estrellas.') : 'De día solo se ve celeste. Y una nube con forma de onigiri.'));
});

export function zoneName(id: string) {
  return ZONES[id]?.name ?? id;
}
