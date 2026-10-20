/**
 * Main story: prologue + 8 chapters. Quests define progression; scenes live here as async functions.
 * Every step has an always-available path (no missable windows): NPC beats trigger wherever the NPC is.
 */
import { iconElement } from '../art/icons';
import { audio } from '../audio/audio';
import { bus } from '../core/events';
import { runTask } from '../core/errors';
import { game } from '../core/state';
import { CHARACTERS } from '../data/characters';
import { ITEMS_BY_ID } from '../data/items';
import { askText, choose, fmt, runScene, say } from '../dialogue/dialogue';
import { check, defineQuests, isDone } from '../quests/quests';
import { learnRecipe } from '../restaurant/orders';
import { mirror } from '../restaurant/mirror';
import { pantryTotal } from '../restaurant/supplies';
import { world } from '../scenes/WorldScene';
import { registerAction } from '../systems/actions';
import { clock } from '../systems/time';
import { toast } from '../ui/dom';
import { CLUE_BY_ID } from './clues';
import { playIntroShotOnce } from './introAudio';
import { recordDecision } from './echoes';

// ------------------------------------------------------------------ helpers
export function addClue(id: string, silent = false) {
  if (game.save.story.clues.includes(id)) return;
  game.save.story.clues.push(id);
  game.touch('clue');
  if (!silent) {
    audio.sfxPlay('clue');
    toast(`Pista anotada: ${CLUE_BY_ID[id]?.title ?? id}`, iconElement({ type: 'journal' }));
  }
}
const hasClue = (id: string) => game.save.story.clues.includes(id);
const give = (id: string, n = 1) => {
  game.addItem(id, n, 'story');
  toast(`Obtuviste: ${ITEMS_BY_ID[id]?.name ?? id}`, iconElement(ITEMS_BY_ID[id]?.icon ?? { type: 'gift' }));
};
const villagersMet = () => CHARACTERS.filter((c) => !c.raccoon && game.rel(c.id).points > 0).length;
const served = () => game.save.restaurant.served;
const chapterDone = (n: number) => game.has(`ch${n}_done`);
const setChapter = (n: number) => {
  if (game.save.story.chapter < n) game.save.story.chapter = n;
  game.touch('chapter');
};

async function lock(fn: () => Promise<void>) {
  world.inputLocked++;
  try {
    await fn();
  } finally {
    world.inputLocked--;
  }
}

// ------------------------------------------------------------------ quests
defineQuests([
  {
    id: 'prologue', kind: 'main', title: 'Prólogo: Una carta inesperada',
    desc: 'Llegaste a Midnight Maki. Conocé a sus habitantes y aprendé a cuidar el restaurante.',
    auto: () => game.has('arrived'),
    steps: [
      { text: 'Hablá con Spicy Beacon y conocé a los mapaches.', done: () => game.has('intro_done'), target: { kind: 'npc', npc: 'spicy', label: 'Spicy Beacon' } },
      { text: 'Aprendé a preparar sushi con Spicy Beacon en la cocina.', done: () => game.has('tut_spicy'), target: { kind: 'npc', npc: 'spicy', label: 'Spicy Beacon' } },
      { text: 'Prepará tus dos primeros platos en la cocina: seguí la tarjeta y la flecha.', done: () => served() >= 1, target: { kind: 'object', zone: 'restaurant', x: 6, y: 3, label: 'Cocina' } },
      { text: 'Comprá un ingrediente o un paquete en el Almacén de Taro.', done: () => game.has('bought_supply') || ((game.save.stats.purchases ?? 0) >= 1 && !game.has('starter_decor')), hint: 'Lo suelto queda en la mochila y ya se puede cocinar. Los paquetes y las cajas se abren en la despensa.', target: { kind: 'object', zone: 'plaza', x: 27, y: 18, label: 'Almacén de Taro', interactId: 'taro_shop' } },
      { text: 'Guardá ingredientes en la despensa de la cocina.', done: () => pantryTotal() > 0 || !game.has('starter_decor'), hint: 'Tocá la despensa, al lado de la tabla. «Guardar ingredientes sueltos» pasa lo de la mochila. «Guardar paquetes y cajas» abre lo que compraste por mayor. Al cocinar se usa primero la despensa.', target: { kind: 'object', zone: 'restaurant', x: 1, y: 3, label: 'Despensa', interactId: 'fridge' } },
      { text: 'Entrá a Ropa de Yuki y mirá qué vende.', done: () => game.has('met_shop_yuki') || !game.has('starter_decor'), hint: 'Yuki vende ropa, zapatos y accesorios.', target: { kind: 'object', zone: 'plaza', x: 26, y: 6, label: 'Ropa de Yuki' } },
      { text: 'Entrá a la Panadería de Bento.', done: () => game.has('met_shop_bento') || !game.has('starter_decor'), hint: 'Bento vende pan, huevos, frutillas y dulces para regalar.', target: { kind: 'object', zone: 'plaza', x: 5, y: 18, label: 'Panadería de Bento' } },
      { text: 'Colocá en tu cuarto el cuadro y la maceta. Subí las escaleras y tocá Decorar.', done: () => (game.has('placed_pt_sushi') && game.has('placed_bamboo_pot')) || (!game.has('starter_decor') && (game.save.stats.decorMoves ?? 0) >= 1), hint: 'En Guardados elegí cada uno, movelo con las flechas y tocá Colocar acá. El cuadro se cuelga en la pared.', target: { kind: 'interior', fromZone: 'restaurant', door: { x: 16, y: 2 }, targetZone: 'home', interiorTarget: { x: 4, y: 4, label: 'Tu habitación' }, label: 'Habitación' } },
      { text: 'Descansá en tu cama para terminar el día.', done: () => game.save.time.day >= 2, target: { kind: 'interior', fromZone: 'restaurant', door: { x: 16, y: 2 }, targetZone: 'home', interiorTarget: { x: 4, y: 4, label: 'Cama' }, label: 'Dormir en tu cama' } },
    ],
    reward: { coins: 100 },
    onComplete: () => setChapter(1),
  },
  {
    id: 'ch1', kind: 'main', title: 'Capítulo 1: El restaurante olvidado',
    desc: 'Restaurar Midnight Maki y conocer Villa Nori.',
    auto: () => isDone('prologue'),
    steps: [
      { text: 'Pip quiere mostrarte algo. Buscalo.', done: () => game.has('drawing_found'), target: { kind: 'npc', npc: 'pip', label: 'Pip' } },
      { text: 'Serví pedidos en el restaurante (5).', needsOpen: true, done: () => served() >= 6, hint: 'El restaurante abre a las 8:00. Cuando un cliente se siente, aparece la flecha hacia su mesa.', target: { kind: 'object', zone: 'restaurant', x: 6, y: 3, label: 'Cocina', service: true } },
      { text: 'Conocé a tres vecinos del pueblo.', done: () => villagersMet() >= 3, target: { kind: 'location', zone: 'plaza', label: 'Plaza' } },
      { text: 'Preguntale a la Abuela Ume por el antiguo dueño.', done: () => game.has('ume_akio'), hint: 'Ume pasa las mañanas en el jardín y las tardes en el restaurante o la plaza.', target: { kind: 'npc', npc: 'ume', label: 'Abuela Ume' } },
      { text: 'Restaurá el cartel del restaurante (afuera, en la plaza).', done: () => game.has('sign_restored'), target: { kind: 'object', zone: 'plaza', x: 4, y: 7, label: 'Cartel del restaurante', interactId: 'sign' } },
      { text: 'Rigg encontró algo. Hablá con ella.', done: () => game.has('storage_open'), target: { kind: 'npc', npc: 'rigg', label: 'Rigg' } },
      { text: 'Revisá el depósito.', done: () => game.has('note_found'), target: { kind: 'interior', fromZone: 'restaurant', door: { x: 13, y: 2 }, targetZone: 'storage', interiorTarget: { x: 4, y: 2, label: 'Estante viejo' }, label: 'Depósito' } },
    ],
    reward: { coins: 200, flags: ['unlock_beach', 'ch1_done'], furniture: ['photo_frame'] },
    onComplete: async () => {
      setChapter(2);
      game.setFlag('ch1_done_day', game.save.time.day);
      await runScene('ch1_end', async () => {
        await say('narr', 'Más tarde, Nami pasa por el restaurante con las botas llenas de arena.');
        await say('?Nami|nami', '¡Terminé de arreglar el camino a la playa! Pasen cuando quieran. Traigan hambre y paciencia para pescar.');
        game.setFlag('met_nami');
      });
    },
  },
  {
    id: 'ch2', kind: 'main', title: 'Capítulo 2: El extraño pedido',
    desc: 'Un pedido sin remitente esconde instrucciones.',
    auto: () => chapterDone(1) && game.save.time.day > Number(game.flag('ch1_done_day') ?? 0),
    steps: [
      { text: 'Revisá el buzón de la plaza.', done: () => game.has('odd_order_read'), target: { kind: 'object', zone: 'plaza', x: 9, y: 6, label: 'Buzón', interactId: 'mailbox' } },
      { text: 'Prepará el pedido sin remitente (Sake maki).', needsOpen: true, done: () => game.has('odd_order_served'), target: { kind: 'object', zone: 'restaurant', x: 5, y: 3, label: 'Cocinar', interactId: 'cook' } },
      { text: 'Revisá las pistas en el Diario (Investigación) y conectá dos.', done: () => game.has('ded_order') },
      { text: 'Buscá el tablón flojo en el depósito.', done: () => game.has('compartment_open'), target: { kind: 'interior', fromZone: 'restaurant', door: { x: 13, y: 2 }, targetZone: 'storage', interiorTarget: { x: 7, y: 3, label: 'Tabla floja' }, label: 'Depósito' } },
    ],
    reward: { coins: 250, flags: ['unlock_forest', 'ch2_done'] },
    onComplete: async () => {
      setChapter(3);
      await runScene('ch2_end', async () => {
        await say('?Kiki|kiki', '¡Hola, restaurante! Despejé el sendero del bosque. Había ramas, piñas y una ardilla muy ofendida. No era yo.');
        game.setFlag('met_kiki_path');
      });
    },
  },
  {
    id: 'ch3', kind: 'main', title: 'Capítulo 3: Los recuerdos de Pip',
    desc: 'Pip reconoce algo que nunca debería haber visto.',
    auto: () => chapterDone(2),
    steps: [
      { text: 'Mostrale la fotografía antigua a Pip.', done: () => game.has('pip_saw_photo'), target: { kind: 'npc', npc: 'pip', label: 'Pip' } },
      { text: 'Visitá la cabaña del Bosque Susurrante.', done: () => game.has('cabin_cleaned'), target: { kind: 'object', zone: 'forest', x: 4, y: 6, label: 'Cabaña', interactId: 'cabin' } },
      { text: 'Resolvé la contradicción de Pip en el Diario.', done: () => game.has('ded_pip') },
      { text: 'Hablá con Pip.', done: () => game.has('pip_heart'), target: { kind: 'npc', npc: 'pip', label: 'Pip' } },
    ],
    reward: { coins: 300, flags: ['ch3_done', 'met_hoshi'], furniture: ['plush_raccoon'] },
    onComplete: () => setChapter(4),
  },
  {
    id: 'ch4', kind: 'main', title: 'Capítulo 4: La receta imposible',
    desc: 'Una receta escrita por Akio guarda una pista.',
    auto: () => chapterDone(3),
    steps: [
      { text: 'Spicy encontró algo en el depósito. Hablá con él.', done: () => game.has('notebook_found'), target: { kind: 'npc', npc: 'spicy', label: 'Spicy Beacon' } },
      { text: 'Visitá el Mercado Nocturno (de noche, por el torii del noreste de la plaza).', done: () => game.has('market_visited'), target: { kind: 'location', zone: 'market', label: 'Mercado Nocturno' } },
      { text: 'Conseguí una carambola en el mercado.', done: () => game.countUsable('starfruit') >= 1 || (game.save.recipesCooked.three_stars ?? 0) > 0, target: { kind: 'object', zone: 'market', x: 4, y: 5, label: 'Dulces de luna', interactId: 'mk_food' } },
      { text: 'Cociná las Tres Estrellas (Cocina → Cocina libre).', done: () => (game.save.recipesCooked.three_stars ?? 0) > 0, target: { kind: 'object', zone: 'restaurant', x: 5, y: 3, label: 'Cocinar', interactId: 'cook' } },
      { text: 'Hablá con la Abuela Ume sobre lo que viste.', done: () => game.has('club_known'), target: { kind: 'npc', npc: 'ume', label: 'Abuela Ume' } },
    ],
    reward: { coins: 350, flags: ['ch4_done', 'recipe_moon'], recipes: ['moonlight'] },
    onComplete: () => setChapter(5),
  },
  {
    id: 'ch5', kind: 'main', title: 'Capítulo 5: Las mentiras de Villa Nori',
    desc: 'Los vecinos recuerdan cosas distintas.',
    auto: () => chapterDone(4),
    steps: [
      { text: 'Preguntá por el club a Bento, Taro, Kumo y Hoshi.', done: () => ['t_bento', 't_taro', 't_kumo', 't_hoshi'].every(hasClue), target: { kind: 'location', zone: 'plaza', label: 'Preguntar a los vecinos' } },
      { text: 'Encontrá la contradicción en el Diario.', done: () => game.has('ded_bento') },
      { text: 'Hablá con Bento y mostrale la evidencia.', done: () => game.has('bento_confessed'), target: { kind: 'npc', npc: 'bento', label: 'Bento' } },
    ],
    reward: { coins: 400, flags: ['ch5_done', 'unlock_lighthouse_view'] },
    onComplete: () => setChapter(6),
  },
  {
    id: 'ch6', kind: 'main', title: 'Capítulo 6: El secreto de Rigg',
    desc: 'Rigg investigaba desde antes de que llegaras.',
    auto: () => chapterDone(5),
    steps: [
      { text: 'Rigg quiere hablar con vos a solas.', done: () => game.has('rigg_secret'), target: { kind: 'npc', npc: 'rigg', label: 'Rigg' } },
      { text: 'Abrí el camino a la Estación Abandonada (oeste de la plaza) con la llave oxidada.', done: () => game.has('unlock_station'), target: { kind: 'object', zone: 'plaza', x: 0, y: 12, label: 'Camino a la estación' } },
      { text: 'Resolvé el reloj detenido de la estación.', done: () => game.has('clock_solved'), target: { kind: 'object', zone: 'station', x: 11, y: 7, label: 'Reloj detenido', interactId: 'st_clock' } },
    ],
    reward: { coins: 450, flags: ['ch6_done'] },
    onComplete: () => setChapter(7),
  },
  {
    id: 'ch7', kind: 'main', title: 'Capítulo 7: La noche sin constelaciones',
    desc: 'El cielo de Villa Nori se apaga.',
    auto: () => chapterDone(6),
    steps: [
      { text: 'Algo raro pasa en el cielo. Salí afuera de noche.', done: () => game.has('dark_night_seen'), hint: 'Podés adelantar el tiempo descansando un rato en tu cama.', target: { kind: 'location', zone: 'plaza', label: 'Salir a la plaza de noche' } },
      { text: 'Hablá con Hoshi.', done: () => game.has('hoshi_key_given'), target: { kind: 'npc', npc: 'hoshi', label: 'Hoshi' } },
      { text: 'Resolvé el misterio de la luz en el Diario.', done: () => game.has('ded_light') },
      { text: 'Reuní a los mapaches: hablá con Rigg.', done: () => game.has('raccoons_ready'), target: { kind: 'npc', npc: 'rigg', label: 'Rigg' } },
    ],
    reward: { flags: ['ch7_done', 'lighthouse_open'] },
    onComplete: () => setChapter(8),
  },
  {
    id: 'ch8', kind: 'main', title: 'Capítulo 8: Las tres estrellas',
    desc: 'El faro espera.',
    auto: () => chapterDone(7),
    steps: [
      { text: 'Entrá al Faro de las Tres Estrellas (playa, lado oeste).', done: () => game.has('lh_entered'), target: { kind: 'interior', fromZone: 'beach', door: { x: 3, y: 4 }, targetZone: 'lighthouse', label: 'Faro de las Tres Estrellas' } },
      { text: 'Colocá las tres estrellas en el mecanismo.', done: () => game.has('story_done'), target: { kind: 'object', zone: 'lighthouse', x: 6, y: 3, label: 'Mecanismo', interactId: 'mechanism' } },
    ],
    reward: { coins: 1000, flags: ['ch8_done', 'star_butterfly'], recipes: ['secret_maki'] },
    onComplete: () => setChapter(9),
  },
  {
    id: 'epilogue', kind: 'main', title: 'Una cena especial',
    desc: 'Los mapaches traman algo.',
    auto: () => game.has('story_done') && ['pip', 'spicy', 'rigg'].every((r) => game.friendLevel(r) >= 3),
    steps: [{ text: 'Los mapaches te esperan en el restaurante al atardecer. Hablá con Pip.', done: () => game.has('sofi_dinner'), target: { kind: 'npc', npc: 'pip', label: 'Pip' } }],
    reward: { furniture: ['star_corner'], flags: ['recipe_sofi'], recipes: ['sofi_maki'] },
  },
]);

// ------------------------------------------------------------------ zone triggers
// the night without constellations also starts if night falls while you're outside
bus.on('time:changed', ({ period }) => {
  if (period === 3 && game.has('ch6_done') && !game.has('dark_night_seen') && world?.zone?.def.outdoor) setTimeout(() => void runTask('story:dark-night', darkNight), 800);
});
export async function onEnterZone(zone: string) {
  // A visit borrows the host's clock and weather, never the guest's personal story.
  if (mirror.on) return;
  game.setFlag('visited_' + zone);
  if (zone === 'restaurant' && game.has('arrived') && !game.has('intro_done')) await startArrivalEncounter();
  const moon = game.flag('festival_today') === 'moon';
  game.setFlag('market_open', clock.period === 3 && (((!!game.flag('market_night') || game.has('market_force')) && game.has('market_known')) || moon));
  if (zone === 'garden' && clock.isNight()) game.setFlag('garden_night');
  if (zone === 'market' && !game.has('market_visited')) {
    game.setFlag('market_visited');
    game.setFlag('market_force', false);
    await runScene('market_first', async () => {
      await say('narr', 'Del otro lado del torii, la noche está llena de faroles, olor a caramelo y música suave. Hay puestos que de día no existen.');
      await say('?Vendedor de luna', '{Bienvenido|Bienvenida} al Mercado Nocturno. Abrimos los viernes y sábados... y cuando el pueblo lo necesita.');
    });
  }
  if (zone === 'lighthouse' && !game.has('lh_entered')) {
    game.setFlag('lh_entered');
    await runScene('lh_enter', async () => {
      await say('narr', 'Adentro del faro hace frío y huele a sal. En el centro, un mecanismo dorado con tres huecos espera en silencio.');
      await say('rigg', 'Acá es. Lo sabía. Lo sabía y no lo sabía.', 'surprised');
    });
  }
  if (game.has('ch6_done') && !game.has('dark_night_seen') && clock.isNight() && world.zone.def.outdoor) await darkNight();
  const { checkFestival } = await import('./festivals');
  await checkFestival(zone);
  check();
}

export async function onContinue() {
  await startArrivalEncounter();
  check();
}

export function onLockedDoor(to: string): boolean {
  if (to === 'station' && game.count('k_station') > 0 && game.has('rigg_secret')) {
    game.setFlag('unlock_station');
    toast('La llave oxidada abrió el portón de la estación.');
    return true;
  }
  return false;
}

// ------------------------------------------------------------------ talk beats
type Beat = () => Promise<void>;
export function storyTalk(id: string): Beat | null {
  const S = (key: string, fn: () => Promise<void>): Beat => () => runScene(key, fn);
  // Fallback for an older unfinished arrival; new games trigger this after the illustrated intro.
  if (id === 'spicy' && !game.has('intro_done') && world.zoneId === 'restaurant') return startArrivalEncounter;
  // prologue
  if (id === 'spicy' && game.has('intro_done') && !game.has('tut_spicy')) return S('tut_spicy', tutSpicy);
  // chapter 1
  if (id === 'pip' && isDone('prologue') && !game.has('drawing_found')) return S('drawing', pipDrawing);
  if (id === 'ume' && game.has('drawing_found') && !game.has('ume_akio')) return S('ume_akio', umeAkio);
  if (id === 'rigg' && game.has('sign_restored') && !game.has('storage_open')) return S('rigg_key', riggKey);
  // chapter 3
  if (id === 'pip' && chapterDone(2) && !game.has('pip_saw_photo')) return S('pip_photo', pipPhoto);
  if (id === 'pip' && game.has('ded_pip') && !game.has('pip_heart')) return S('pip_heart', pipHeart);
  // chapter 4
  if (id === 'spicy' && chapterDone(3) && !game.has('notebook_found')) return S('notebook', spicyNotebook);
  if (id === 'ume' && (game.save.recipesCooked.three_stars ?? 0) > 0 && !game.has('club_known')) return S('club', umeClub);
  // chapter 5 testimonies
  if (chapterDone(4) && !chapterDone(5)) {
    const t: Record<string, string> = { bento: 't_bento', taro: 't_taro', kumo: 't_kumo', hoshi: 't_hoshi' };
    if (t[id] && !hasClue(t[id])) return S('test_' + id, () => testimony(id, t[id]));
    if (id === 'bento' && game.has('ded_bento') && !game.has('bento_confessed')) return S('bento_confront', bentoConfront);
  }
  // chapter 6
  if (id === 'rigg' && chapterDone(5) && !game.has('rigg_secret')) return S('rigg_secret', riggSecret);
  // chapter 7
  if (id === 'hoshi' && game.has('dark_night_seen') && !game.has('hoshi_key_given')) return S('hoshi_key', hoshiKey);
  if (id === 'rigg' && game.has('ded_light') && !game.has('raccoons_ready')) return S('raccoons_ready', raccoonsReady);
  // epilogue
  if (id === 'pip' && game.has('story_done') && !game.has('sofi_dinner') && ['pip', 'spicy', 'rigg'].every((r) => game.friendLevel(r) >= 3)) {
    if (world.zoneId === 'restaurant' && clock.period >= 2) return S('sofi_dinner', sofiDinner);
  }
  // after the dinner: a short, optional look back at the pages of the album the player actually filled
  if (id === 'pip' && game.has('sofi_dinner') && !game.has('epilogue_album') && world.zoneId === 'restaurant') return S('epilogue_album', epilogueAlbum);
  return null;
}

// ------------------------------------------------------------------ prologue scenes
let arrivalEncounter: Promise<void> | null = null;
export function startArrivalEncounter(): Promise<void> {
  if (arrivalEncounter) return arrivalEncounter;
  if (game.has('intro_done') || world.zoneId !== 'restaurant') return Promise.resolve();
  arrivalEncounter = meetRaccoons().finally(() => { arrivalEncounter = null; });
  return arrivalEncounter;
}

async function meetRaccoons() {
  await lock(async () => {
    playIntroShotOnce('wooden_door', 0.42, 2.4);
    const pip = world.actor('pip', 6, 6);
    const spicy = world.actor('spicy', 3, 3);
    const rigg = world.actor('rigg', 14, 10);
    pip.face('up');
    rigg.setAct('read');
    await runScene('meet', async () => {
      await say('narr', 'Adentro hay luz tibia, olor a arroz y un silencio raro... hasta que algo se mueve junto al mostrador.');
      pip.emote('!');
      await say('narr', 'Un mapache grandote y redondito, en puntas de pie sobre un banquito que cruje, intenta alcanzar un frasco del estante.');
      await say('?Mapache grandote|pip', 'Un poquito más... un poquititito más...');
      playIntroShotOnce('metal_jar', 0.7);
      pip.setAct('surprised');
      await say('narr', '¡CRASH! El frasco cae y rueda por el piso. Por suerte era de lata.');
      await world.walk('spicy', 5, 6);
      spicy.emote('!!');
      await say('?Mapache con pañuelo|spicy', '¡PIP! ¡Ese era mi frasco de sésamo premium! ¡Lo tosté a mano! ¡Con mis manos!', 'surprised');
      await say('pip', 'Era para una emergencia de sésamo...', 'sad');
      rigg.emote('...');
      await say('?Mapache de anteojos|rigg', 'Tenemos visita.', 'neutral');
      pip.face('down');
      spicy.face('down');
      await say('pip', '¡Una persona! ¡Una persona de verdad!', 'happy');
      await say('player', 'Hola... Soy {name}. Recibí una carta ofreciéndome hacerme cargo de este restaurante.');
      await say('rigg', 'Entonces... llegaste, al final.', 'neutral');
      await say('spicy', '¿Hacerte cargo? ¡Eso significa que podríamos volver a abrir!', 'happy');
      await say('pip', '¡Podríamos tener clientes de verdad! ¡Y mesas! ¡Y servilletas lindas!', 'happy');
      await say('?Mapache con pañuelo|spicy', 'Yo soy Spicy Beacon, chef principal, artista del arroz.', 'happy');
      await say('pip', '¡Yo soy Pip! Atiendo las mesas. Bueno, cuando hay mesas. Y gente. Hace mucho que no hay gente.', 'happy');
      await world.walk('rigg', 12, 8);
      await say('rigg', 'Rigg. Me ocupo de... pensar. Alguien tiene que hacerlo.', 'smug');
      await say('rigg', 'El restaurante está casi abandonado. Hace años que no viene nadie. Nosotros lo mantenemos como podemos.');
      await say('spicy', 'Si lo vamos a abrir, el cartel necesita un nombre.', 'happy');
      const restaurant = await askText('spicy', '¿Cómo se va a llamar el restaurante?', 'Midnight Maki', 20);
      game.save.player.restaurantName = restaurant;
      game.touch('restaurant-name');
      await say('pip', '¡{restaurant}! Me gusta cómo suena.', 'happy');
      const c = await choose(['Me quedo. Vamos a abrir {restaurant} juntos.', 'No sé cocinar sushi... pero puedo aprender.']);
      if (c === 0) await say('pip', '¡SÍ! ¡Se queda! ¡Se queda!', 'happy');
      else await say('spicy', '¡Para eso estoy yo! Te voy a enseñar todo. Bueno, casi todo. Algunos secretos son secretos.', 'smug');
      recordDecision('prologue_stay', c === 0 ? 'decidida' : 'aprender');
      await say('rigg', '{Bienvenido|Bienvenida}, {name}. Tu cuarto está arriba. Spicy te va a enseñar la cocina.', 'happy');
    });
    if (game.save.story.seenScenes.includes('meet')) game.setFlag('intro_done');
    world.releaseActor('pip');
    world.releaseActor('spicy');
    world.releaseActor('rigg');
    world.spawnNpcs(false);
  });
  check();
}

async function tutSpicy() {
  await say('spicy', '¡Ah, mi aprendiz! Primera lección: el sushi no se apura. Se acompaña.', 'happy');
  await say('spicy', 'Los pedidos aparecen en unas tarjetitas en pantalla. Los preparás vos, caminando por la cocina.');
  await say('spicy', 'Rigg dejó dos pedidos de práctica: un Kappa maki y un Nigiri de salmón. Dos platos distintos para aprender los dos caminos.');
  await say('spicy', 'En la cocina caminás de estación en estación: sacás los ingredientes de la heladera, cocinás el arroz en la arrocera, cortás en la tabla y armás en la mesa. Yo te voy guiando paso a paso con una tarjeta en pantalla.');
  await say('spicy', 'El arroz, el alga, el pepino y el salmón de hoy ya están en tu mochila. Cuando se acaben, se compran en lo de Taro y se guardan en la despensa, al lado de esta tabla.');
  game.save.orders = game.save.orders.filter((o) => o.special !== 'tutorial');
  game.addOrder({ recipe: 'kappa', customer: 'rigg', reward: 20, special: 'tutorial' });
  game.addOrder({ recipe: 'sake_nigiri', customer: 'rigg', reward: 24, special: 'tutorial' });
  game.setFlag('tut_spicy');
}

// ------------------------------------------------------------------ chapter 1
async function pipDrawing() {
  await say('pip', '¡{name}! ¡Mirá lo que encontré debajo de mi futón! Estaba ahí escondido, como yo cuando juego a las escondidas.', 'happy');
  await say('narr', 'Pip te muestra un papel amarillento: tres estrellas unidas por líneas, dibujadas sobre un faro.');
  addClue('drawing_stars');
  await say('player', 'Tres estrellas... ¿Sabés quién lo dibujó?');
  await say('pip', 'No... pero me da una sensación rara. Como cuando te olvidás una palabra que sabés.', 'sad');
  await say('rigg', '(desde lejos) Guardalo en el diario. Todo lo raro va al diario.');
  await say('narr', 'Ahora tenés un Diario con una sección de Investigación. Todas las pistas quedan anotadas ahí.');
  game.setFlag('drawing_found');
}

async function umeAkio() {
  await say('ume', 'Así que vos sos {el nuevo dueño|la nueva dueña} de Midnight Maki. Qué alegría, {querido|querida}.', 'happy');
  const c = await choose(['¿Conoció al antiguo dueño?', 'Encontramos un dibujo de tres estrellas.']);
  if (c === 1) await say('ume', 'Tres estrellas... hacía mucho que no escuchaba eso.', 'surprised');
  await say('ume', 'El dueño se llamaba Akio. Cocinaba lento, hablaba poco y se reía fuerte.');
  await say('ume', 'Cerró el restaurante una noche de tormenta, hace diez años. Al otro día ya no estaba. Nadie lo vio irse.', 'sad');
  addClue('akio_gone');
  await say('ume', 'Pero dejó las luces encendidas. Siempre me pareció que esperaba volver... o que alguien volviera.');
  game.setFlag('ume_akio');
  game.setFlag('ch1_started');
}

registerAction('story', async (arg) => {
  const scenes: Record<string, () => Promise<void>> = {
    sign: signRestore,
    storage_shelf: storageShelf,
    hidden_compartment: hiddenCompartment,
    cabin: cabin,
    station_office: stationOffice,
    station_sign: async () => runScene('station_sign', async () => say('narr', 'Un cartel descolorido: "Villa Nori — Última parada antes del mar".')),
    station_crate: stationCrate,
    mechanism: mechanism,
  };
  await scenes[arg]?.();
});

async function signRestore() {
  if (game.has('sign_restored')) return;
  if (!game.has('ume_akio')) {
    await runScene('sign_early', async () => say('narr', 'El cartel de Midnight Maki está cubierto de polvo y hojas. Algún día habría que limpiarlo.'));
    return;
  }
  const { restoration } = await import('../minigames/restore');
  const ok = await restoration('Restaurar el cartel', 'sign');
  if (!ok) return;
  game.setFlag('sign_restored');
  await runScene('sign_done', async () => {
    await say('narr', 'Debajo del polvo, el cartel tiene pintadas tres estrellitas al lado del nombre. Brillan un poco al atardecer.');
    await say('pip', '(asomándose) ¡Ahora sí parece un restaurante de verdad!', 'happy');
    await say('rigg', '(asomándose también) Mmm. Tres estrellas. Otra vez. Vení a verme después, tengo algo que mostrarte.');
  });
  world.refreshFurniture();
}

async function riggKey() {
  await say('rigg', 'El frasco que Pip tiró la noche que llegaste. No era sésamo lo que sonaba adentro.', 'smug');
  await say('narr', 'Rigg te da una llave pequeña, de bronce. Tiene una etiqueta: "Depósito".');
  give('k_storage');
  await say('rigg', 'El depósito está cerrado desde que tengo memoria. Spicy dice que ahí "duermen las bolsas de arroz". Vamos a ver qué más duerme ahí.');
  game.setFlag('storage_open');
  world.refreshFurniture();
  world.buildZoneObjects(world.zoneId);
  world.spawnNpcs(false);
}

async function storageShelf() {
  if (!game.has('note_found')) {
    await runScene('note', async () => {
      await say('narr', 'Entre bolsas de arroz viejas y cajones, un estante tiene un sobre clavado con una chinche.');
      await say('narr', '"Las tres estrellas no se perdieron. Están esperando. Donde el arroz duerme, la madera recuerda." — A.');
      addClue('note_storage');
      await say('rigg', 'A. Como la carta que recibiste. Akio.', 'surprised');
      game.setFlag('note_found');
    });
    return;
  }
  if (chapterDone(3) && !game.has('notebook_found')) {
    await runScene('shelf_spicy_hint', async () => say('narr', 'Hay un hueco en el estante, como si alguien se hubiera llevado un libro. Spicy anduvo por acá.'));
    return;
  }
  await runScene('shelf', async () => say('narr', 'Bolsas de arroz, frascos vacíos y un olor a madera vieja. Tranquilo.'));
}

// ------------------------------------------------------------------ chapter 2
export async function readOddOrder() {
  await runScene('odd_order', async () => {
    await say('narr', 'Hay un sobre sin remitente en el buzón. Adentro, un pedido escrito con letra prolija:');
    await say('narr', '"Un sake maki para la mesa que nadie usa. Servilo cuando la sombra del depósito toque el tercer tablón."');
    addClue('odd_order');
    await say('player', '¿La mesa que nadie usa? ¿El tercer tablón?');
    game.setFlag('odd_order_read');
    game.save.orders = game.save.orders.filter((o) => o.special !== 'odd');
    game.addOrder({ recipe: 'sake_maki', customer: 'c_odd', reward: 60, special: 'odd' });
    await say('narr', 'El pedido quedó anotado en el mostrador.');
  });
}

export async function oddOrderServed() {
  game.setFlag('odd_order_served');
  await runScene('odd_served', async () => {
    await say('narr', 'Dejás el sake maki en la mesita del rincón, la que siempre está vacía. Nadie viene a buscarlo.');
    await say('rigg', 'Nadie lo va a buscar. No es un pedido: son instrucciones.', 'smug');
    await say('rigg', 'Abrí el Diario, sección Investigación. Conectá dos pistas que hablen del mismo lugar.');
  });
}

async function hiddenCompartment() {
  if (!game.has('ded_order')) {
    await runScene('plank_early', async () => say('narr', 'Uno de los tablones del piso cruje distinto. ¿Será importante?'));
    return;
  }
  if (game.has('compartment_open')) {
    await runScene('plank_done', async () => say('narr', 'El compartimento está vacío ahora. Solo queda polvo y olor a pino.'));
    return;
  }
  await runScene('compartment', async () => {
    await say('narr', 'Contás los tablones desde la puerta. Uno, dos, tres. El tercero se levanta con un suspiro de madera.');
    await say('narr', 'Abajo hay una caja de lata. Adentro: una fotografía y una llave oxidada.');
    addClue('photo_old');
    addClue('rusty_key');
    give('k_station');
    await say('narr', 'En la foto, un señor sonriente sostiene a tres mapachitos diminutos frente al restaurante. Al dorso: "Mis tres estrellitas. Año 1."');
    await say('rigg', '...', 'surprised');
    await say('player', '¿Rigg? ¿Estás bien?');
    await say('rigg', 'Sí. Es... polvo. Me entró polvo. Deberíamos mostrarle esto a Pip. Más adelante.', 'sad');
    game.setFlag('compartment_open');
  });
}

// ------------------------------------------------------------------ chapter 3
async function pipPhoto() {
  await say('narr', 'Le mostrás la fotografía a Pip. Se queda quieto mucho rato. Pip nunca se queda quieto.');
  await say('pip', 'Yo... conozco esa sonrisa. Y esa cabaña del fondo. Huele a pino. ¿Cómo sé a qué huele una foto?', 'surprised');
  addClue('pip_memory');
  addClue('pip_claim');
  await say('pip', 'Siempre dije que llegué solo, hace poquito. Que nunca conocí al dueño de antes. Pero...', 'sad');
  await say('pip', 'Hay una cabaña en el bosque. Kiki me contó. ¿Vamos? ¿Me acompañás?');
  game.setFlag('pip_saw_photo');
}

async function cabin() {
  if (!game.has('pip_saw_photo')) {
    await runScene('cabin_early', async () => say('narr', 'Una cabaña cerrada, cubierta de hojas. Por la ventana se ve todo desordenado.'));
    return;
  }
  if (game.has('cabin_cleaned')) {
    await runScene('cabin_after', async () => say('narr', 'La cabaña quedó ordenada. Huele a pino y a algo dulce, como un recuerdo.'));
    return;
  }
  const { restoration } = await import('../minigames/restore');
  await runScene('cabin_in', async () => {
    await say('narr', 'La puerta cede. Adentro hay polvo, hojas y una cunita pequeña hecha con un cajón de frutas.');
  });
  const ok = await restoration('Ordenar la cabaña', 'cabin');
  if (!ok) return;
  await runScene('cabin_found', async () => {
    await say('narr', 'Al ordenar, encontrás una mantita diminuta con una estrella rosada bordada. Algo duro hay envuelto adentro.');
    addClue('cabin_blanket');
    give('star1');
    await say('narr', 'Es una pieza de metal con forma de estrella, tibia al tacto. Brilla con un rosa suave.');
    game.setFlag('cabin_cleaned');
  });
}

async function pipHeart() {
  await say('pip', '{name}... Rigg me explicó lo de la foto. Que yo era chiquito. Que Akio nos cuidaba.', 'sad');
  await say('pip', 'No me acuerdo de su cara. Pero me acuerdo de una canción. Y de sentirme seguro.');
  const c = await choose(['Ahora también estás seguro. Acá, con nosotros.', 'Tal vez algún día recuerdes más. Te voy a ayudar.']);
  recordDecision('pip_heart', c === 0 ? 'hogar' : 'recordar');
  if (c === 0) await say('pip', 'Sí. Acá huele a arroz y a vos. Es mi lugar favorito.', 'happy');
  else await say('pip', '¿Me prometés? Bueno, yo también te ayudo a vos. Con lo que sea. Menos con el wasabi.', 'happy');
  await say('pip', 'Esa estrella rosada... guardala vos. Siento que es importante.');
  game.addFriendship('pip', 30);
  game.setFlag('pip_heart');
}

// ------------------------------------------------------------------ chapter 4
async function spicyNotebook() {
  await say('spicy', '{name}. Sentate. Respirá. Lo que te voy a mostrar cambia la gastronomía para siempre.', 'smug');
  await say('narr', 'Spicy sostiene un cuaderno de tapas gastadas. "Recetas — Akio".');
  addClue('old_notebook');
  await say('spicy', 'Hay una receta que se llama "Tres Estrellas". Una pieza dulce, una picante y una misteriosa. La misteriosa lleva carambola.', 'happy');
  await say('spicy', 'Y la carambola solo se consigue en... el Mercado Nocturno.', 'surprised');
  await say('player', '¿El mercado que aparece algunas noches?');
  await say('spicy', '¡Ese! Taro siempre habla de eso. Esta noche el torii del noreste debería estar abierto. Lo siento en los bigotes.');
  learnRecipe('three_stars');
  game.setFlag('recipe_three');
  game.setFlag('market_known');
  game.setFlag('market_force');
  game.setFlag('notebook_found');
}

async function umeClub() {
  await say('ume', 'Me contaron que cocinaste las Tres Estrellas. Ay... qué recuerdo.', 'happy');
  await say('narr', 'Le describís cómo las piezas formaron un dibujo en el plato: la plaza, la estación y el faro.');
  addClue('plate_map');
  await say('ume', 'Los martes nos juntábamos en el restaurante después del cierre. Akio, Bento, yo, y la mamá de Hoshi.');
  await say('ume', 'Le decíamos el Club de las Tres Estrellas. Cuidábamos el faro... y los recuerdos del pueblo.');
  addClue('secret_club');
  await say('ume', 'Pero eso es todo lo que puedo contarte. Lo demás no me corresponde. Preguntale a los otros.', 'sad');
  game.setFlag('club_known');
  game.setFlag('ch5_started');
}

// ------------------------------------------------------------------ chapter 5
async function testimony(id: string, clue: string) {
  const T: Record<string, () => Promise<void>> = {
    bento: async () => {
      await say('bento', '¿El faro? Yo nunca estuve en el faro. Nunca. Ni siquiera sé cómo es por dentro.', 'surprised');
      await say('bento', 'Hago pan. Pan y más pan. ¿Querés pan?');
    },
    taro: async () => {
      await say('taro', '¿Rumores sobre el faro? Uh, tengo uno bueno, pero no se lo digas a nadie.', 'smug');
      await say('taro', 'Hace años, Bento me pidió que le copiara una llave. Tenía tres estrellas grabadas. La llave del faro, diría yo.');
    },
    kumo: async () => {
      await say('kumo', 'El club... sí. Se deshizo la noche de la tormenta.', 'sad');
      await say('kumo', 'Akio devolvió un libro a la biblioteca al día siguiente. Por el buzón. Con una página marcada: el mecanismo del faro.');
    },
    hoshi: async () => {
      await say('hoshi', 'La luz del faro se apagó esa misma noche. Lo vi desde mi telescopio.', 'sad');
      await say('hoshi', 'Mi mamá decía que solo se enciende si las tres estrellas vuelven a su lugar.');
    },
  };
  await T[id]?.();
  addClue(clue);
}

async function bentoConfront() {
  await say('bento', 'Ah, hola, hola. ¿Más preguntas? Ya te dije que...', 'neutral');
  const c = await choose(['Presentar: Testimonio de Taro', 'Presentar: Fotografía antigua', 'Presentar: Dibujo de tres estrellas'], 'player', '¿Qué evidencia presentás?');
  if (c !== 0) {
    await say('bento', 'Eso es muy lindo... pero no tiene nada que ver conmigo, ¿no?', 'smug');
    await say('narr', '(Pensá qué testimonio contradice lo que dijo Bento.)');
    return;
  }
  await say('player', 'Taro dice que le pediste copiar una llave con tres estrellas grabadas. La llave del faro.');
  await say('bento', '...', 'surprised');
  await say('bento', 'Uf. Soy malísimo mintiendo. Por eso hago pan: el pan no pregunta nada.', 'sad');
  await say('bento', 'Akio me dio algo antes de irse. Me pidió que lo guardara hasta que llegara "alguien que hiciera reír a los mapaches otra vez".');
  await say('bento', 'Te vi con ellos. Ese alguien sos vos.', 'happy');
  give('star2');
  await say('narr', 'Bento te entrega una estrella de metal naranja, tibia como pan recién salido del horno.');
  const d = await choose(['Gracias por cuidarla tanto tiempo.', '¿Por qué no lo dijiste antes?']);
  recordDecision('bento', d === 0 ? 'gratitud' : 'pregunta');
  if (d === 0) await say('bento', 'Era lo mínimo. Akio me enseñó a amasar. Le debo mucho.', 'happy');
  else await say('bento', 'Le prometí no contar nada hasta estar seguro. Las promesas con Akio eran serias.', 'sad');
  game.addFriendship('bento', 25);
  game.setFlag('bento_confessed');
}

// ------------------------------------------------------------------ chapter 6
async function riggSecret() {
  await say('rigg', 'Esperé a que estuviéramos tranquilos. Te debo una explicación.', 'sad');
  await say('rigg', 'Yo sí me acuerdo de Akio. Un poco. Más que Pip, menos de lo que quisiera.');
  await say('rigg', 'Antes de irse me dejó una carta. Yo era chiquita, no la entendía. La leí mil veces desde entonces.');
  addClue('rigg_letter');
  await say('narr', '"La última estrella espera cuando el reloj marque la hora en que nos conocimos."');
  await say('rigg', 'Me encontró en la estación. Me dijo la hora de su reloj: las diez y diez. Es lo único que recuerdo con claridad.');
  addClue('clock_time');
  await say('rigg', 'Investigué sola todos estos años porque... no quería que Pip y Spicy se preocuparan. Ni ilusionarlos.', 'sad');
  const c = await choose(['No tenías que cargar con esto solo.', 'Ahora somos un equipo de detectives.']);
  recordDecision('rigg', c === 0 ? 'apoyo' : 'equipo');
  if (c === 0) await say('rigg', 'Ya lo sé. Ahora lo sé. Gracias, {name}.', 'happy');
  else await say('rigg', 'Detectives Nocturnos. Suena bien. No se lo digas a Spicy, va a querer uniformes.', 'smug');
  await say('rigg', 'La llave oxidada abre el portón de la estación, al oeste de la plaza. Vamos.');
  game.addFriendship('rigg', 30);
  game.setFlag('rigg_secret');
}

registerAction('puzzle', async (arg) => {
  if (arg === 'clock') {
    if (!game.has('rigg_secret')) {
      await runScene('clock_early', async () => say('narr', 'Un reloj grande, detenido. Las agujas no se mueven desde hace años.'));
      return;
    }
    if (game.has('clock_solved')) {
      await runScene('clock_done', async () => say('narr', 'El reloj marca las diez y diez. Ahora hace tic tac, despacito.'));
      return;
    }
    const { clockPuzzle } = await import('../minigames/puzzles');
    if (await clockPuzzle()) {
      game.setFlag('clock_solved');
      await runScene('clock_open', async () => {
        await say('narr', 'Al marcar las diez y diez, se escucha un clic en la boletería. Una portezuela se abre.');
        await say('narr', 'Adentro hay una estrella de metal celeste, fría y precisa, envuelta en un pañuelo con una R bordada.');
        give('star3');
        await say('rigg', 'Una R. Él sabía que yo iba a encontrarla.', 'sad');
        await say('rigg', 'Gracias por no rendirte con este misterio. Ni conmigo.', 'happy');
      });
    }
  } else if (arg === 'stump') {
    const { stumpPuzzle } = await import('../minigames/puzzles');
    await stumpPuzzle();
  }
});

async function stationOffice() {
  await runScene('station_office', async () => {
    if (game.has('clock_solved')) await say('narr', 'La boletería está abierta. Horarios viejos, un boleto sin usar a "Ciudad del Puerto" y polvo.');
    else await say('narr', 'La boletería está cerrada con una traba extraña. Parece conectada al reloj de la estación.');
  });
}

async function stationCrate() {
  await runScene('station_crate', async () => {
    if (!game.has('crate_looted')) {
      game.setFlag('crate_looted');
      await say('narr', 'En el cajón hay mantas viejas y... ¡una mantita suave en buen estado!');
      give('g_blanket');
    } else await say('narr', 'Solo quedan mantas apolilladas.');
  });
}

// ------------------------------------------------------------------ chapter 7
async function darkNight() {
  await lock(async () => {
    await runScene('dark_night', async () => {
      await say('narr', 'Esta noche pasa algo raro. El cielo de Villa Nori está completamente negro. Ni una estrella.');
      await say('player', 'Las estrellas... desaparecieron.');
      await say('narr', 'Los faroles del pueblo parpadean. Los vecinos miran hacia arriba en silencio.');
      addClue('dark_night');
      await say('narr', 'Hoshi seguramente sabe qué está pasando.');
    });
    game.setFlag('dark_night_seen');
  });
}

async function hoshiKey() {
  await say('hoshi', 'Lo viste, ¿no? El cielo vacío. Mi mamá me contó que pasa cuando el faro lleva demasiado tiempo apagado.', 'sad');
  await say('hoshi', 'Ella era parte del club. Antes de irse a vivir al norte, me dejó esto. Me dijo: "dáselo a quien junte las tres".');
  give('k_lighthouse');
  addClue('hoshi_key');
  await say('narr', 'Una llave con tres huecos con forma de estrella. Las estrellas que tenés encajarían perfecto.');
  await say('hoshi', 'Vos tenés las tres, ¿verdad? Lo sabía. Las estrellas se notan.', 'happy');
  game.setFlag('hoshi_key_given');
}

async function raccoonsReady() {
  await say('rigg', 'Ya lo resolviste. Las estrellas son piezas del mecanismo del faro. Hay que llevarlas.', 'smug');
  await say('spicy', '(apareciendo) ¿Una aventura nocturna? Preparé onigiris de emergencia. Y picante. Para el coraje.', 'happy');
  await say('pip', '(apareciendo también) ¡Yo llevo la mantita! Por si hace frío. O por si da miedo. Por las dudas.', 'happy');
  await say('rigg', 'El faro está en la playa, del lado oeste. Vamos los cuatro.');
  const c = await choose(['¡Vamos juntos!', 'Gracias por acompañarme, chicos.']);
  game.save.story.decisions.lighthouse = c === 0 ? 'aventura' : 'gratitud';
  game.setFlag('raccoons_ready');
}

// ------------------------------------------------------------------ chapter 8 (finale)
async function mechanism() {
  if (!game.has('lh_entered')) return;
  if (game.has('story_done')) {
    let replay = false;
    await runScene('mech_after', async () => {
      await say('narr', 'El mecanismo gira despacio. Las tres estrellas brillan: rosa, naranja y celeste.');
      replay = (await choose(['Recordar la noche en que se encendió (podés elegir otra promesa)', 'Solo mirar la luz'])) === 0;
    });
    // endings are never locked: the finale can be revisited and another promise chosen
    if (replay) await finale();
    return;
  }
  if (!['star1', 'star2', 'star3'].every((s) => game.count(s) > 0)) {
    await runScene('mech_missing', async () => say('narr', 'Hay tres huecos con forma de estrella. Todavía te faltan piezas.'));
    return;
  }
  const { starPuzzle } = await import('../minigames/puzzles');
  if (!(await starPuzzle())) return;
  await finale();
}

async function finale() {
  audio.play('emotional');
  await runScene('finale', async () => {
    await say('narr', 'La última estrella encaja con un clic suave. El mecanismo empieza a girar. Arriba, la luz del faro se enciende.');
    await say('narr', 'Por las ventanas se ve el cielo: tres estrellas aparecen, y después todas las demás, como si alguien hubiera prendido el pueblo entero.');
    await say('pip', '¡Mirá! ¡Volvieron! ¡Todas!', 'happy');
    await say('narr', 'Del centro del mecanismo cae una caja de lata. Adentro hay cartas, fotos y un cuaderno.');
    await say('narr', 'La primera carta está dirigida a "quien encienda el faro".');
    await say('?Akio (carta)', '"Si leés esto, encontraste las tres estrellas. Gracias. Yo ya no podía subir estas escaleras: mi salud me obligó a irme a la Ciudad del Puerto, donde me cuida mi hija."');
    await say('?Akio (carta)', '"No quise despedirme. Tenía miedo de que, si lo hacía, el pueblo se olvidara del faro. Así que escondí las estrellas con quienes más quería, para que alguien nuevo las reuniera."');
    await say('?Akio (carta)', '"El faro guarda los recuerdos de Villa Nori. La constelación es una promesa: mientras alguien la cuide, nadie va a olvidar a nadie."');
    await say('?Akio (carta)', '"Pip, Spicy, Rigg: mis tres estrellitas. Perdón por irme sin explicar. Siempre fueron mi familia. Ahora tienen una más."');
    await say('spicy', '(sorbiendo) Es el wasabi. Me lloran los ojos por el wasabi.', 'sad');
    await say('rigg', 'No hay wasabi acá, Spicy.', 'sad');
    await say('spicy', 'Hay wasabi en el corazón, Rigg.', 'sad');
    await say('narr', 'Al final del cuaderno hay una dirección: Ciudad del Puerto. Y una frase: "Escribime cuando quieras."');
    const c = await choose(
      ['Prometo cuidar a los mapaches, siempre.', 'Prometo que Villa Nori vuelva a estar unida.'],
      'player',
      'Frente a la luz del faro, hacés una promesa:',
    );
    const ending = c === 0 ? 'friendship' : 'town';
    game.save.story.decisions.ending = ending;
    if (ending === 'friendship') {
      await say('pip', '¡Y nosotros te cuidamos a vos! Ese es el trato. Sin devoluciones.', 'happy');
      await say('rigg', 'Midnight Maki es nuestra casa. De los cuatro.', 'happy');
    } else {
      await say('narr', 'Afuera, los vecinos se juntan en la playa a mirar el faro. Bento trae pan. Taro trae faroles "a precio de amigo". Momo trae flores.');
      await say('ume', '(desde la playa) ¡El club vuelve a reunirse! ¡Todos los martes en Midnight Maki!', 'happy');
    }
    // what the player chose along the way comes back one more time
    const dec = game.save.story.decisions;
    if (dec.pip_heart === 'hogar') await say('pip', 'Esta vez no tengo miedo de nada. Acá es mi casa.', 'happy');
    else if (dec.pip_heart === 'recordar') await say('pip', 'Todavía me acuerdo de la canción. Algún día la termino de recordar. Con tu ayuda.', 'happy');
    if (dec.rigg === 'apoyo') await say('rigg', 'Ya no cargo sola con todo. Gracias por eso, {name}.', 'happy');
    else if (dec.rigg === 'equipo') await say('rigg', 'Detectives Nocturnos: caso cerrado. Ahora sí pido uniformes yo también.', 'smug');
    if (dec.lighthouse === 'aventura') await say('spicy', '¡Qué aventura! ¿La repetimos el martes?', 'happy');
    else if (dec.lighthouse === 'gratitud') await say('spicy', 'De nada, pero la próxima traés tu mantita como Pip.', 'smug');
    // the stars ending needs the three raccoons' special memories (friendship level 4 stories)
    const memories = ['pip_storm', 'spicy_egg', 'rigg_map'].every((k) => game.has('memory_' + k));
    if (memories) {
      game.setFlag('ending_stars');
      await say('narr', 'Entonces pasa algo más: una lluvia de estrellas cruza el cielo. Cada estrella fugaz deja un recuerdo en el aire.');
      await say('narr', 'Ves a Akio enseñándole a Spicy a cortar pepino. A Pip dormido en un cajón de frutas. A Rigg con un mapa más grande que ella.');
      await say('narr', 'Y al final, una imagen nueva: vos, los tres mapaches y el restaurante lleno de gente. El faro guardó ese recuerdo también.');
      game.save.story.decisions.stars = 'yes';
    }
    await say('narr', '— Fin del capítulo 8 —');
    await say('narr', 'La historia principal terminó... pero Villa Nori sigue. El restaurante, los vecinos y los mapaches te esperan. Hay recetas, secretos y eventos nuevos por descubrir.');
  });
  game.setFlag('story_done');
  game.setFlag('story_done_day', game.save.time.day);
  game.setFlag(`ending_${game.save.story.decisions.ending}`);
  bus.emit('toast', { text: 'Nuevo contenido desbloqueado en Villa Nori.' });
  world.playZoneAudio();
}

async function sofiDinner() {
  const sofi = game.save.player.name;
  await lock(async () => {
    await say('pip', '¡Llegaste! Cerrá los ojos. No, mejor abrilos, si no te chocás.', 'happy');
    await say('narr', 'Los tres mapaches prepararon una mesa con mantel, velas y un plato que nunca viste: un maki con salmón, palta, mango y pétalos de sakura.');
    await say('spicy', 'Lo llamamos Maki de la casa. Tiene todo lo que te gusta. Y nada de wasabi. Bueno, un poquito.', 'happy');
    await say('rigg', 'Hay algo más. Llegó en el correo. Dice "para abrir en una cena especial". Esta es una cena especial.', 'smug');
    await say('narr', 'Un sobre con una estrella dibujada. Adentro, una carta escrita a mano:');
    await new Promise<void>((resolve) => {
      import('../ui/dom').then(({ h, uiRoot }) => {
        // The letter text is unchanged. It now fills in {name}, and it can also be closed with Enter, Space or Escape.
        const paper = h(
          'div',
          { style: { background: '#f6ecd6', border: '4px solid #6b4330', borderRadius: '6px', padding: '24px 20px', maxWidth: '420px', width: '90%', lineHeight: '1.6', fontSize: '1.1em', color: '#2a2230', animation: 'popin .8s ease-out' } },
          h('p', null, fmt('Este pequeño mundo es para vos, {name}.')),
          h('p', null, 'Para que tengas un lugar al que volver, tres mapaches que siempre te esperen y todas las aventuras que quieras vivir.'),
          h('p', { style: { textAlign: 'right', fontStyle: 'italic' } }, 'Con amor, Santi.'),
          h('p', { class: 'hint', style: { textAlign: 'center' } }, 'Tocá para cerrar'),
        );
        const wrap = h('div', { role: 'dialog', 'aria-label': 'Carta', style: { position: 'fixed', inset: '0', background: 'rgba(20,22,42,.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: '70' } }, paper);
        let closed = false;
        const close = () => {
          if (closed) return;
          closed = true;
          window.removeEventListener('keydown', onKey, true);
          wrap.remove();
          resolve();
        };
        const onKey = (e: KeyboardEvent) => { if (['Enter', ' ', 'Escape'].includes(e.key)) { e.preventDefault(); e.stopPropagation(); close(); } };
        window.addEventListener('keydown', onKey, true);
        wrap.addEventListener('pointerup', close);
        uiRoot().append(wrap);
      });
    });
    await say('pip', `¡Feliz día de cualquier día, ${sofi}!`, 'happy');
    await say('narr', 'Comen juntos hasta tarde. Afuera, el faro gira despacio sobre Villa Nori.');
  });
  game.setFlag('sofi_dinner');
}

/** After the dinner. Reads the personal scenes the player lived (src/story/bonds.ts); nothing here is required. */
async function epilogueAlbum() {
  const { BONDS, bondsDone, epilogueRecap } = await import('./bonds');
  let completed = false;
  await lock(async () => {
    await say('narr', 'Pip aparece con una caja de zapatos llena de papelitos, dibujos y una pluma de gaviota. La apoya en el mostrador con muchísimo cuidado.');
    await say('pip', '¡Hicimos un álbum! Bueno: lo estamos haciendo. Las páginas se llenan solas, cuando pasan cosas.', 'happy');
    for (const [who, text, expr] of epilogueRecap()) await say(who, text, expr ?? 'neutral');
    const left = BONDS.length - bondsDone();
    await say('spicy', left > 0 ? 'Todavía quedan páginas. Sin apuro. Las buenas se escriben despacito.' : 'Está completo. Y en cuanto cerremos la tapa, seguro pasa algo nuevo.', 'smug');
    await say('rigg', 'La luz del faro sigue girando. El resto lo vamos anotando entre todos.', 'neutral');
    await say('narr', 'Pip pone el álbum junto al portarretratos. Esa noche, el restaurante tiene una página más.');
    completed = true;
  });
  if (!completed || game.has('epilogue_album')) return;
  game.setFlag('epilogue_album', game.save.time.day);
  game.save.furnitureOwned.bond_dinner_frame = (game.save.furnitureOwned.bond_dinner_frame ?? 0) + 1;
  game.collect('memories', 'epilogue_album');
  game.setFlag('memory_epilogue_album', 'El álbum de la cena');
  toast('Nuevo recuerdo: El álbum de la cena · Decoración: Cuadro: la cena');
  game.touch('epilogue');
}
