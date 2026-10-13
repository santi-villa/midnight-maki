/**
 * Side quests (villager & raccoon requests) and small optional tasks.
 * Steps can be conditions, item deliveries to the giver, or talking to someone.
 */
import { game } from '../core/state';
import { CLOTHES_BY_ID } from '../data/clothes';
import { ITEMS_BY_ID } from '../data/items';
import { charm } from '../restaurant/orders';
import { defineQuests, isActive, isDone, questDef, currentStep, startQuest, check, type QuestDef, type QuestStep } from './quests';

export interface SideMeta {
  intro: string;      // what the giver says when offering
  avail: () => boolean;
  deliver?: Record<number, Record<string, number>>; // step index -> items given to giver
  talk?: Record<number, string>;                    // step index -> npc to talk to
}
export const SIDE_META: Record<string, SideMeta> = {};

const f = (k: string) => () => game.has(k);
const stat = (k: string, n: number) => () => (game.save.stats[k] ?? 0) >= n;
const col = (cat: string, id: string) => () => game.collected(cat, id);
const delivered = (q: string, i: number) => () => game.has(`qd_${q}_${i}`);
const talked = (q: string, i: number) => () => game.has(`qt_${q}_${i}`);
const itemsText = (m: Record<string, number>) => Object.entries(m).map(([id, n]) => `${n} ${ITEMS_BY_ID[id]?.name ?? id}`).join(', ');

function side(
  id: string, giver: string, title: string, desc: string, intro: string, avail: () => boolean,
  steps: (QuestStep | { deliver: Record<string, number>; text?: string } | { talk: string; text: string })[],
  reward: QuestDef['reward'],
) {
  const meta: SideMeta = { intro, avail, deliver: {}, talk: {} };
  const real: QuestStep[] = steps.map((s, i) => {
    if ('deliver' in s) {
      meta.deliver![i] = s.deliver;
      return {
        text: s.text ?? `Llevale a ${nameOf(giver)}: ${itemsText(s.deliver)}.`,
        done: delivered(id, i),
        target: { kind: 'npc' as const, npc: giver, label: nameOf(giver) },
      };
    }
    if ('talk' in s) {
      meta.talk![i] = s.talk;
      return {
        text: s.text,
        done: talked(id, i),
        target: { kind: 'npc' as const, npc: s.talk, label: nameOf(s.talk) },
      };
    }
    return s;
  });
  SIDE_META[id] = meta;
  return { id, kind: 'side' as const, title, giver, desc, steps: real, reward: { ...reward, friend: [giver, 25] as [string, number] } };
}

const NAMES: Record<string, string> = { pip: 'Pip', spicy: 'Spicy', rigg: 'Rigg', momo: 'Momo', taro: 'Taro', yuki: 'Yuki', kumo: 'Kumo', nami: 'Nami', hoshi: 'Hoshi', bento: 'Bento', sumi: 'Sumi', mika: 'Sumi', kiki: 'Kiki', sora: 'Sora', ume: 'Abuela Ume' };
const nameOf = (id: string) => NAMES[id] ?? id;
const after = (k: string) => () => game.has(k);
const always = () => game.has('intro_done');

defineQuests([
  side('sq_momo_garden', 'momo', 'La llave del jardín', 'Momo cuida el Jardín de los Faroles.', 'El jardín está cerrado desde hace mucho... Si me trajeras tres flores de la plaza, sabría que vas a cuidarlo bien. Y te daría la llave.', after('ch1_started'),
    [{ deliver: { fl_daisy: 2, fl_tulip: 1 } }], { flags: ['unlock_garden'], items: { sd_flower: 2, sd_scallion: 2 } }),
  side('sq_pip_marble', 'pip', 'La canica brillante', 'Pip perdió su tesoro favorito.', 'Perdí mi canica brillante. Era rosa y tibia. ¿Me ayudás? Kiki dice que en el bosque hay piedras parecidas.', after('unlock_forest'),
    [{ deliver: { st_quartz: 1 } }], { items: { g_candy: 2 }, coins: 80 }),
  side('sq_spicy_chili', 'spicy', 'Ingrediente legendario', 'Spicy necesita ajíes para un experimento.', 'Necesito tres ajíes. Frescos. Valientes. Podés cultivarlos en el jardín o comprarlos en lo de Taro.', always,
    [{ deliver: { chili: 3 } }], { coins: 120, items: { g_hotsauce: 1 } }),
  side('sq_rigg_book', 'rigg', 'El libro perdido', 'Rigg dejó un libro en la biblioteca.', 'Olvidé un libro en la biblioteca. "Mapas de la costa". ¿Lo buscarías? Kumo me mira raro cuando voy.', always,
    [{ text: 'Buscá el libro en la biblioteca de la plaza.', done: f('rigg_book_found'), target: { kind: 'interior', fromZone: 'plaza', door: { x: 11, y: 24 }, targetZone: 'library', interiorTarget: { x: 5, y: 3, label: 'Leer en la biblioteca' }, label: 'Biblioteca' } }, { deliver: { g_book: 0 }, text: 'Devolvéselo a Rigg.' }], { coins: 100, furniture: ['bookstack'] }),
  side('sq_charm', 'spicy', 'Un salón con encanto', 'Decorar el salón del restaurante.', 'Los clientes comen con los ojos también. ¡Decoremos el salón! Plantas, faroles, cuadros...', after('ch1_started'),
    [{ text: 'Subí el encanto del salón a 15 (decorá con muebles).', done: () => charm() >= 15, target: { kind: 'interior', fromZone: 'plaza', door: { x: 5, y: 6 }, targetZone: 'restaurant', label: 'Salón del restaurante' } }], { coins: 200, furniture: ['lantern_red'] }),
  side('sq_bento_help', 'bento', 'Ayuda en la panadería', 'Bento necesita orden.', 'Mi despensa es un desastre. ¿Me ayudás a ordenar los cajones del depósito del restaurante? Es para practicar, je.', after('storage_open'),
    [{ text: 'Ordená los cajones del depósito.', done: stat('sorted', 1), target: { kind: 'interior', fromZone: 'restaurant', door: { x: 13, y: 2 }, targetZone: 'storage', interiorTarget: { x: 2, y: 3, label: 'Cajones' }, label: 'Depósito' } }], { coins: 120, items: { g_candy: 2 } }),
  side('sq_nami_shells', 'nami', 'Conchas para el puesto', 'Nami quiere decorar su puesto.', '¡Me faltan conchas para el puesto! Dos vieiras y una caracola, ¿sí?', after('unlock_beach'),
    [{ deliver: { sh_scallop: 2, sh_spiral: 1 } }], { coins: 90, clothes: ['fc_sun'] }),
  side('sq_nami_tuna', 'nami', 'El pez grande', 'Pescar un atún joven.', 'De tarde los atunes se acercan al muelle. ¡Atrapá uno y te ganás mi respeto eterno!', after('unlock_beach'),
    [{ text: 'Pescá un Atún joven (mar, de tarde).', done: col('fish', 'f_tuna'), target: { kind: 'location', zone: 'beach', x: 20, y: 17, label: 'Muelle de pesca' } }], { coins: 200 }),
  side('sq_nami_aquarium', 'nami', 'Coleccionista de peces', 'Pescar cinco peces distintos.', 'Si pescás cinco peces distintos te regalo un acuario para el restaurante. ¡Para que los clientes miren peces mientras comen pescado! Bueno, no suena tan bien así.', after('unlock_beach'),
    [{ text: 'Registrá 5 peces distintos en tu colección.', done: () => Object.keys(game.save.collections.fish ?? {}).length >= 5, target: { kind: 'location', zone: 'beach', label: 'Playa de las Conchas' } }], { furniture: ['aquarium'] }),
  side('sq_kumo_bottle', 'kumo', 'Mensaje en una botella', 'El mar trae mensajes.', 'Hay botellas que llegan a la playa con mensajes. Si encontrás una, traémela. Las colecciono... y las leo.', after('ch2_started'),
    [{ deliver: { bottle_msg: 1 } }], { items: { g_book: 1 }, coins: 120 }),
  side('sq_yuki_model', 'yuki', 'Modelo por un día', 'Yuki quiere ver su ropa japonesa en acción.', '¿Serías mi modelo? Ponete una prenda superior y una inferior de estilo japonés y vení a mostrármelas.', always,
    [{ text: 'Vestite con arriba y abajo de estilo japonés y hablá con Yuki.', done: () => game.has('qt_sq_yuki_model_0'), target: { kind: 'npc', npc: 'yuki', label: 'Yuki' } }], { clothes: ['hd_flower', 'sh_geta'] }),
  side('sq_sumi_photos', 'sumi', 'Retratos de Villa Nori', 'Sumi necesita referencias.', 'Quiero pintar el pueblo entero, pero necesito referencias. ¿Me sacás tres fotos lindas?', always,
    [{ text: 'Guardá 3 fotos en tu álbum (Menú → Cámara).', done: () => game.save.photos.length >= 3, target: { kind: 'npc', npc: 'sumi', label: 'Sumi' } }], { furniture: ['pt_landscape'] }),
  side('sq_kiki_explore', 'kiki', 'Exploradora novata', 'Visitar los rincones del pueblo.', '¡Te propongo un desafío! Visitá el bosque, la playa y el jardín. Una verdadera exploradora conoce su pueblo.', after('unlock_forest'),
    [{ text: 'Visitá el Bosque, la Playa y el Jardín.', done: () => ['forest', 'beach', 'garden'].every((z) => game.has('visited_' + z)), target: { kind: 'location', zone: 'forest', label: 'Bosque Susurrante' } }], { clothes: ['bg_backpack'], coins: 100 }),
  side('sq_sora_mail', 'sora', 'Cartero por un día', 'Ayudar a Sora con el reparto.', '¡Tengo la espalda hecha un nudo! ¿Me ayudás a entregar cartas? Una para Momo y otra para Taro.', always,
    [{ talk: 'momo', text: 'Entregale la carta a Momo.' }, { talk: 'taro', text: 'Entregale la carta a Taro.' }], { coins: 150, clothes: ['hd_beret'] }),
  side('sq_hoshi_moth', 'hoshi', 'La polilla lunar', 'Hoshi estudia insectos nocturnos.', 'Las polillas lunares bailan alrededor de los faroles. Si atrapás una, me ayudarías muchísimo.', after('met_hoshi'),
    [{ text: 'Atrapá una Polilla lunar (de noche).', done: col('bugs', 'b_moth'), target: { kind: 'location', zone: 'plaza', label: 'Faroles de noche' } }], { furniture: ['starlamp'] }),
  side('sq_ume_tea', 'ume', 'Té para la abuela', 'Una tarde de té con Ume.', 'Me encantaría un té de jazmín y una camelia para el florero. Como en los viejos tiempos.', after('ume_akio'),
    [{ deliver: { g_tea: 1, fl_camellia: 1 } }], { furniture: ['tea_set'], coins: 80 }),
  side('sq_fountain', 'ume', 'La fuente de la plaza', 'Restaurar la fuente.', 'La fuente de la plaza estaba siempre limpia cuando Akio vivía acá. ¿Le darías una mano?', after('sign_restored'),
    [{ text: 'Limpiá la fuente de la plaza.', done: f('fountain_restored'), target: { kind: 'object', zone: 'plaza', x: 15, y: 13, label: 'Fuente', interactId: 'fountain' } }], { coins: 200 }),
  side('sq_taro_amethyst', 'taro', 'Negocio brillante', 'Taro busca una gema.', 'Tengo un cliente que pagaría muy bien por una amatista. Dicen que el bosque esconde algunas. ¿Socia?', after('unlock_forest'),
    [{ deliver: { st_amethyst: 1 } }], { coins: 300 }),
  side('sq_spicy_lab', 'spicy', 'Ciencia culinaria', 'Experimentar en el laboratorio.', '¡Experimentemos! Usá la tabla de cocina y elegí "Experimentar con Spicy". Tres intentos, aunque salgan raros.', after('spicy_lab_intro'),
    [{ text: 'Hacé 3 experimentos con Spicy.', done: stat('experiments', 3), target: { kind: 'object', zone: 'restaurant', x: 5, y: 3, label: 'Tabla de cocina', interactId: 'cook' } }], { coins: 150, items: { roe: 2, eel: 1 } }),
  side('sq_pip_photo', 'pip', 'Una foto juntos', 'Pip quiere una foto.', '¿Nos sacamos una foto? ¡Para el álbum! Acercate a mí y usá la cámara del menú.', after('intro_done'),
    [{ text: 'Sacá una foto con Pip cerca.', done: f('photo_raccoon_pip'), target: { kind: 'npc', npc: 'pip', label: 'Pip' } }], { furniture: ['photo_frame'] }),
  side('sq_rigg_night', 'rigg', 'El jardín de noche', 'Rigg quiere ver los faroles encendidos.', 'Dicen que el Jardín de los Faroles de noche es otro lugar. ¿Vamos a ver si es verdad? Yo voy por mi cuenta, te espero ahí.', after('unlock_garden'),
    [{ text: 'Visitá el Jardín de los Faroles de noche.', done: f('garden_night'), target: { kind: 'location', zone: 'garden', label: 'Jardín de los Faroles' } }], { items: { g_tea: 2 } }),
  side('sq_momo_harvest', 'momo', 'Primera cosecha', 'Cultivar algo propio.', 'Plantá algo en las parcelas del jardín, regalo cada día y cosechalo. Las plantas no se apuran, vos tampoco.', after('unlock_garden'),
    [{ text: 'Cosechá algo en el jardín.', done: stat('harvests', 1), target: { kind: 'location', zone: 'garden', x: 5, y: 5, label: 'Parcelas del jardín' } }], { items: { sd_chili: 2, sd_sakura: 1 } }),
  side('sq_memory', 'pip', 'Revancha de memoria', 'Ganarle a la memoria.', 'En el Mercado Nocturno hay un juego de memoria. ¡Te reto! Si me ganás, te doy algo lindo.', after('market_visited'),
    [{ text: 'Ganá una partida de memoria en el Mercado Nocturno.', done: stat('memoryWins', 1), target: { kind: 'object', zone: 'market', x: 5, y: 12, label: 'Juego de memoria', interactId: 'mk_game' } }], { furniture: ['plush_cat'] }),
  side('sq_level3', 'spicy', 'Fama local', 'Llevar el restaurante al nivel 3.', 'Si llegamos al nivel 3, ¡colgamos una ristra de ajíes en la cocina! Es tradición. Mía. Desde hoy.', always,
    [{ text: 'Llevá Midnight Maki al nivel 3.', done: () => game.save.restaurant.level >= 3, target: { kind: 'object', zone: 'restaurant', x: 7, y: 5, label: 'Mostrador de pedidos' } }], { furniture: ['chili_wreath'] }),
  side('sq_star_flower', 'momo', 'La flor estrella', 'Un rumor botánico.', 'Dicen que si juntás macetas iguales en el banco del jardín, al final florece una flor estrella. ¿Lo probás?', after('unlock_garden'),
    [{ text: 'Conseguí una Flor estrella en el banco de macetas.', done: col('flowers', 'fl_star'), target: { kind: 'location', zone: 'garden', label: 'Banco de macetas' } }], { furniture: ['bonsai_sakura'] }),
  side('sq_kiki_stump', 'kiki', 'El tocón tallado', 'Un secreto del bosque.', 'En el bosque hay un tocón con símbolos tallados. Dicen que si repetís su canción, se abre. ¡Yo nunca pude!', after('unlock_forest'),
    [{ text: 'Resolvé el acertijo del tocón tallado.', done: f('stump_solved'), target: { kind: 'object', zone: 'forest', x: 10, y: 12, label: 'Tocón tallado', interactId: 'stump' } }], { coins: 150, items: { berry: 4 } }),
  side('sq_bento_breakfast', 'bento', 'Desayuno de campeones', 'Ingredientes para Bento.', 'Quiero inventar un pan con fruta. ¿Me traés frutillas silvestres y un huevo?', after('unlock_forest'),
    [{ deliver: { berry: 3, egg: 1 } }], { coins: 110, items: { g_candy: 1 } }),
]);
if (SIDE_META.sq_sumi_photos) SIDE_META.sq_mika_photos = SIDE_META.sq_sumi_photos;

// ------------------------------------------------------------------ optional tiny tasks (auto, discreet)
defineQuests([
  { id: 't_three', kind: 'task', title: 'Tres recetas', desc: 'Preparar tres recetas diferentes.', auto: () => game.has('intro_done') && game.save.time.day >= 2, steps: [{ text: 'Prepará tres recetas diferentes.', done: () => Object.keys(game.save.recipesCooked).length >= 3 }], reward: { coins: 60 } },
  { id: 't_fish', kind: 'task', title: 'Primer pez', desc: 'Pescar un pez.', auto: f('unlock_beach'), steps: [{ text: 'Pescá un pez.', done: stat('fishCaught', 1) }], reward: { coins: 40 } },
  { id: 't_accessory', kind: 'task', title: 'Un accesorio nuevo', desc: 'Comprar un accesorio.', auto: () => game.save.time.day >= 2, steps: [{ text: 'Comprá un accesorio en lo de Yuki.', done: () => game.save.clothesOwned.some((c) => ['head', 'face', 'extra', 'bag'].includes(CLOTHES_BY_ID[c]?.slot) && CLOTHES_BY_ID[c].price > 0) }], reward: { coins: 40 } },
  { id: 't_photo', kind: 'task', title: 'Foto de mapache', desc: 'Fotografiar a un mapache.', auto: () => game.save.time.day >= 2, steps: [{ text: 'Fotografiá a un mapache.', done: () => ['pip', 'spicy', 'rigg'].some((r) => game.has('photo_raccoon_' + r)) }], reward: { coins: 40 } },
  { id: 't_plant', kind: 'task', title: 'Botánica', desc: 'Descubrir una planta.', auto: () => game.save.time.day >= 2, steps: [{ text: 'Registrá una flor en tu colección.', done: () => Object.keys(game.save.collections.flowers ?? {}).length >= 1 }], reward: { coins: 30 } },
]);

// ------------------------------------------------------------------ hooks used by talk/board
export function offerableBy(npc: string): string | null {
  for (const [id, m] of Object.entries(SIDE_META)) {
    const q = questDef(id);
    if (q?.giver !== npc || isActive(id) || isDone(id)) continue;
    if (!m.avail()) continue;
    return id;
  }
  return null;
}

export function boardQuests(): string[] {
  return Object.entries(SIDE_META).filter(([id, m]) => !isActive(id) && !isDone(id) && m.avail()).map(([id]) => id);
}

/** Called when talking to an NPC: handles deliveries and "talk to" steps. Returns a line to say or null. */
export function questTalk(npc: string): { text: string; quest: string } | null {
  for (const id of Object.keys(game.save.quests.active)) {
    const q = questDef(id);
    const m = SIDE_META[id];
    if (!q || !m) continue;
    const st = game.save.quests.active[id].step;
    const t = m.talk?.[st];
    if (t === npc) {
      game.setFlag(`qt_${id}_${st}`);
      check();
      return { quest: id, text: npc === 'momo' ? '¿Una carta para mí? Ay, gracias... es de mi hermana.' : npc === 'taro' ? '¡Correspondencia! Seguro es una factura. O un rumor. Ojalá un rumor.' : '¡Gracias por traerla!' };
    }
    if (id === 'sq_yuki_model' && npc === 'yuki' && st === 0) {
      const a = game.save.player.appearance;
      if (CLOTHES_BY_ID[a.top]?.style === 'japanese' && CLOTHES_BY_ID[a.bottom]?.style === 'japanese') {
        game.setFlag(`qt_${id}_0`);
        check();
        return { quest: id, text: '¡Perfecto! Así es como imaginaba que se vería. Sos mi modelo oficial.' };
      }
    }
    if (q.giver !== npc) continue;
    const need = m.deliver?.[st];
    if (!need) continue;
    if (id === 'sq_rigg_book') {
      if (game.has('rigg_book_found')) {
        game.setFlag(`qd_${id}_${st}`);
        check();
        return { quest: id, text: '¡Mi libro! Y sin ninguna página doblada. Sos de confianza.' };
      }
      continue;
    }
    const ok = Object.entries(need).every(([it, n]) => game.count(it) >= n);
    if (!ok) continue;
    for (const [it, n] of Object.entries(need)) game.removeItem(it, n);
    game.setFlag(`qd_${id}_${st}`);
    check();
    return { quest: id, text: '¡Justo lo que necesitaba! Muchísimas gracias.' };
  }
  return null;
}

export function acceptSide(id: string) {
  startQuest(id);
  game.save.quests.tracked = game.save.quests.tracked ?? id;
}

export function stepOf(id: string) {
  return currentStep(id);
}
