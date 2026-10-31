/** Registers every world interaction handler. Imported once when the world starts. */
import { iconElement } from '../art/icons';
import { audio } from '../audio/audio';
import { game } from '../core/state';
import { ITEMS, ITEMS_BY_ID } from '../data/items';
import { ZONES } from '../data/zones';
import { choose, runScene, say } from '../dialogue/dialogue';
import { boardQuests, acceptSide, SIDE_META } from '../quests/side';
import { questDef } from '../quests/quests';
import { PROJECT_AMENITIES } from '../data/projects';
import { recordLibraryRead } from '../restaurant/projects';
import { projectsSection, openProjectAmenity } from '../ui/projects';
import { world } from '../scenes/WorldScene';
import { confirmBox, h, panel, toast } from '../ui/dom';
import { tabBar } from '../ui/kit';
import { bestRod, commitRodPlan, planRodPurchase, ROD_BY_ID, type RodWallet } from './rods';
import { errandsSection } from '../ui/errands';
import { registerAction } from './actions';
import { harvest, plant, SEED_INFO, water } from './garden';
import { clock } from './time';
import { shopGate } from './npcs';
import { shopInteractionText } from './schedule';
import '../restaurant/kitchen';
import '../story/story';
import '../quests/side';
import './achievements';


registerAction('shop', async (id) => {
  const { openShop } = await import('../ui/shops');
  await openShop(id);
});

registerAction('bed', async () => {
  const { mirror } = await import('../restaurant/mirror');
  if (mirror.on) { toast('Estás de visita: para dormir usá «Jugar juntos». Amanece cuando duermen los dos.'); return; }
  const c = await new Promise<number>((resolve) => {
    runScene('bed', async () => {
      resolve(await choose(clock.period < 3 ? ['Dormir', 'Descansar un rato (pasar al siguiente momento)', 'Todavía no'] : ['Dormir', 'Todavía no'], 'player', '¿Descansar?'));
    });
  });
  const opts = clock.period < 3 ? ['sleep', 'rest', 'no'] : ['sleep', 'no'];
  if (opts[c] === 'sleep') {
    const { sleepNow, pickSleepHours } = await import('./sleep');
    const hours = await pickSleepHours();
    if (hours) await sleepNow({ hours });
  } else if (opts[c] === 'rest') {
    clock.advancePeriod();
    const { addEnergy, REST_GAIN } = await import('./fatigue');
    addEnergy(REST_GAIN);
    toast(`Descansaste un rato. Ahora es ${clock.label().toLowerCase()}.`);
  }
});

registerAction('wardrobe', async () => {
  const { openWardrobe } = await import('../ui/wardrobe');
  openWardrobe();
});

registerAction('pantry', () => {
  import('../ui/pantry').then((m) => m.openPantry(world.zoneId === 'restaurant' ? world.galleyView.anchorFor('fridge') : undefined));
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

/** A visible obstacle (logs, vines, barricade...) that closes a path until its flag is set. */
registerAction('blocked', async (to) => {
  const d = world.zone.def.doors.find((dd) => dd.to === to && dd.lock);
  if (!d?.lock) return;
  if (game.has(d.lock.flag)) { world.refreshZone(); return; }
  toast(d.lock.msg);
  const { onLockedDoor } = await import('../story/story');
  if (onLockedDoor(to)) world.refreshZone();
});

const NOTES: Record<string, string | string[]> = {
  house: 'La luz está encendida. Se oye una radio bajita adentro.',
  tea: 'La casa de té abre solo para los vecinos del barrio. Huele a té de cebada.',
  fish: 'El pescador salió temprano. Dejó una nota: "Vuelvo con la marea".',
  flower: 'Un cartelito: "Las flores de hoy están en el jardín. Pasen por la tarde".',
  shrine: 'Dejás una moneda imaginaria y pedís un deseo chiquito. El viento mueve las tiras de papel.',
  // inside the village houses
  in_home: ['Una cama contra la pared y una mesita con dos tazas.', 'Alguien dejó un crucigrama a medias sobre la mesa.'],
  in_home2: ['El ropero está cerrado con cuidado.', 'Hay un baúl chico al pie de la cama.'],
  in_tea: ['Un futón junto a la pared y una mesita baja con dos tacitas.', 'La tetera descansa. Alguien vive acá, aunque ahora no esté.'],
  in_tea2: ['Un andon apagado y un almohadón todavía con la forma de quien se sentó.', 'Huele a cebada y a madera.'],
  in_fish: ['La mesa tiene una red chiquita y un anzuelo suelto.', 'Huele un poco a mar, aunque la ventana esté cerrada.'],
  in_fish2: ['Una caña descansa junto a la pared, con el sedal bien enrollado.', 'En un rincón hay un balde vacío, esperando la marea.'],
  in_flower: ['Jarrones en la mesa y macetas en los rincones. Alguien arma ramos en casa.', 'El cuarto huele a tallo verde y a tierra húmeda.'],
  in_flower2: ['Un bonsái junto a la ventana, con las hojas limpias.', 'Hay pétalos sueltos, barridos hacia un lado con cuidado.'],
  in_ren: ['Sobre la mesa hay un lápiz de carpintero y viruta todavía tibia.', 'El cuarto huele a madera recién lijada.'],
  in_ren2: ['Un baúl con clavos ordenados por tamaño.', 'El banquito está gastado justo donde alguien se sienta a trabajar.'],
  in_mika: ['La mesa tiene un casco y una lista de entregas.', 'Hay una botella de agua y un mapa del pueblo doblado.'],
  in_mika2: ['Un peluche de gato mira la puerta, como esperando el próximo viaje.', 'La lámpara rosada está inclinada hacia la alfombra.'],
  in_haru: ['La mesa desaparece bajo los libros abiertos.', 'Un marcapáginas de tela sobresale de una novela.'],
  in_haru2: ['La biblioteca llega casi al techo. Los lomos están ordenados por color.', 'Una pila de libros hace de mesita de noche.'],
  in_tomo: ['La mesa tiene una red chiquita y un anzuelo suelto.', 'Huele un poco a mar, aunque la ventana esté cerrada.'],
  in_tomo2: ['En el acuario nada un pez que parece conocer el horario de la marea.', 'Una caña descansa junto a la pared, con el sedal bien enrollado.'],
  in_nene: ['La mesa tiene una tijera de podar y un lazo rojo.', 'Hay pétalos secos guardados entre las páginas de un cuaderno.'],
  in_nene2: ['Los jarrones están llenos, cada uno de un color distinto.', 'El bonsái tiene una notita: "no regar de más".'],
  in_goro: ['La mesa baja tiene un té frío y el diario de ayer.', 'Los almohadones están hundidos de tanto sentarse a charlar.'],
  in_goro2: ['El futón está doblado con una prolijidad de muchos años.', 'El andon espera la noche, quieto.'],
  in_fuyu: ['La tetera todavía está tibia. Alguien se fue hace un rato.', 'Dos tacitas, una con el borde pintado de índigo.'],
  in_fuyu2: ['El futón está preparado para quien se queda hasta tarde.', 'De noche este cuarto debe verse todo ámbar.'],
  in_sato: ['Sobre la mesa hay sobres atados con hilo.', 'El escritorio tiene la próxima ronda ya ordenada.'],
  in_sato2: ['El baúl guarda cartas que todavía no tienen dueño.', 'El reloj de la pared marca la hora sin apuro.'],
  in_mame: ['La mesa tiene migas y un repasador a cuadros.', 'Huele a pan, aunque acá no haya horno.'],
  in_mame2: ['El estante guarda frascos de mermelada con la tapa a medias.', 'El juego de té está listo para la merienda.'],
  in_kai: ['La mesa tiene negativos y un lápiz de luz.', 'Hay una foto a medio revelar, todavía pálida.'],
  in_kai2: ['El atril tiene un bosque empezado y pintura en el borde.', 'El portarretrato está vacío: "para una que todavía no saqué".'],
  in_rin: ['La mesa tiene una botella y un cronómetro.', 'Casi no hay adornos. El lugar está listo para salir corriendo.'],
  in_rin2: ['El banco de madera está junto a la pared, para estirar.', 'Las zapatillas descansan alineadas, por una vez.'],
  in_oto: ['Sobre la mesa hay una partitura con el faro dibujado al margen.', 'El piano tiene una tecla más gastada que las otras.'],
  in_oto2: ['La radio está bajita, en una emisora de noche.', 'Una partitura a medio borrar espera la próxima frase.'],
};
registerAction('note', (key) => {
  const t = NOTES[key] ?? 'No hay nadie.';
  toast(Array.isArray(t) ? t[(game.save.time.day + key.length + Math.floor(game.save.time.minutes / 15)) % t.length] : t);
});

registerAction('board', () => {
  const ids = boardQuests();
  const orders = h('div', { class: 'col board-orders' });
  orders.append(h('p', { class: 'hint' }, 'Favores de los vecinos. Aceptá solo los que tengas ganas: ninguno vence.'));
  if (!ids.length) orders.append(h('p', { class: 'muted' }, 'No hay pedidos nuevos por ahora. Volvé otro día.'));
  for (const id of ids) {
    const q = questDef(id)!;
    orders.append(
      h('div', { class: 'card col', style: { gap: '4px' } },
        h('b', null, q.title),
        h('div', { class: 'hint' }, `De: ${q.giver ? q.giver.charAt(0).toUpperCase() + q.giver.slice(1) : '—'} · ${q.desc}`),
        h('div', null, `"${SIDE_META[id].intro}"`),
        h('button', { class: 'btn small primary', onclick: (e: Event) => { if (acceptSide(id)) (e.target as HTMLButtonElement).replaceWith(h('span', { class: 'pill' }, 'Aceptado')); } }, 'Aceptar')),
    );
  }
  const projects = projectsSection(async () => {
    const p = world.player;
    return p ? await world.enterZone(world.zoneId, p.tx, p.ty, p.dir, false) : false;
  });
  const errands = errandsSection(projects.refresh);
  const pages = [errands, projects, orders];
  const host = h('div', { class: 'board-pages' });
  const show = (i: number) => host.replaceChildren(pages[i]);
  show(0);
  panel({
    title: 'Cartelera de Villa Nori',
    wide: true,
    tabs: tabBar([
      { label: 'Encargos', icon: 'clipboard' },
      { label: 'Proyectos', icon: 'act' },
      { label: 'Favores', icon: 'scroll' },
    ], show),
    body: host,
  });
});

registerAction('project', (id) => {
  const a = PROJECT_AMENITIES.find((a) => a.id === id);
  if (!a || world.zoneId !== a.zone) return;
  openProjectAmenity(id);
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

function rodWallet(): RodWallet {
  return { coins: game.coins, inventory: game.save.inventory, fishCaught: game.save.stats.fishCaught ?? 0 };
}

registerAction('fish', async (kind) => {
  if (clock.paused) return;
  if (!bestRod(game.save.inventory)) {
    const basic = ROD_BY_ID.rod_basic;
    const plan = planRodPurchase(rodWallet(), basic.id);
    if (typeof plan === 'string') {
      toast(`${plan} La caña básica sale ${basic.price} monedas, en el almacén de Taro o en el puesto de Nami.`);
      return;
    }
    const yes = await confirmBox(`Para pescar hace falta una caña. ¿Comprar la ${basic.name} por ${basic.price} monedas?`, 'Comprar', 'Ahora no');
    if (!yes || !commitRodPlan(plan)) return;
    toast(`Listo: ${basic.name}.`);
  }
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
  const status = shopGate('library');
  if (!status.open) { toast(shopInteractionText(status)); return; }
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
  if (recordLibraryRead()) toast('El club de lectura te acerca a Kumo. +3 amistad.');
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
