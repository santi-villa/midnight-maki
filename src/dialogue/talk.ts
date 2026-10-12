/** Everyday conversations, gifts and friendship progression. */
import { iconElement } from '../art/icons';
import { audio } from '../audio/audio';
import { BALANCE } from '../core/balance';
import { bus } from '../core/events';
import { game } from '../core/state';
import { CHAR_BY_ID, RACCOONS } from '../data/characters';
import { ITEMS, ITEMS_BY_ID } from '../data/items';
import { h, panel, toast } from '../ui/dom';
import { choose, runScene, say } from './dialogue';
import { GIFT_REACT, LINES, type Line } from './lines';
import { clock } from '../systems/time';

const lastLine: Record<string, string> = {};
let currentZone = '';
bus.on('zone:enter', ({ zone }) => {
  currentZone = zone;
});

function pickLine(id: string): Line | null {
  const pool = LINES[id] ?? [];
  const lvl = game.friendLevel(id);
  const per = clock.period;
  const rain = game.flag('weather') === 'rain';
  const zone = currentZone;
  const valid = pool.filter(
    (l) =>
      (!l.p || l.p.includes(per)) &&
      (l.rain === undefined || l.rain === rain) &&
      (!l.lvl || lvl >= l.lvl) &&
      (!l.flag || game.has(l.flag)) &&
      (!l.noflag || !game.has(l.noflag)) &&
      (!l.zone || l.zone === zone) &&
      (!l.set || !game.has(l.set)) &&
      lastLine[id] !== l.t,
  );
  if (!valid.length) return pool[0] ?? null;
  // memory lines first, then contextual ones, then random
  const maxW = Math.max(...valid.map((l) => l.weight ?? (l.rain || l.zone || l.p ? 2 : 1)));
  const top = valid.filter((l) => (l.weight ?? (l.rain || l.zone || l.p ? 2 : 1)) >= Math.min(maxW, 2));
  return top[Math.floor(Math.random() * top.length)];
}

export async function talkTo(id: string) {
  // story beats take priority
  const { storyTalk } = await import('../story/story');
  const scene = storyTalk(id);
  if (scene) {
    await scene();
    return;
  }
  const def = CHAR_BY_ID[id];
  if (!def) return;
  const side = await import('../quests/side');
  await runScene('talk_' + id, async () => {
    const qt = side.questTalk(id);
    if (qt) await say(id, qt.text, 'happy');
    const offer = !qt ? side.offerableBy(id) : null;
    if (offer && game.flag('offer_' + offer) !== game.save.time.day) {
      game.setFlag('offer_' + offer, game.save.time.day);
      await say(id, side.SIDE_META[offer].intro);
      const c = await choose(['¡Claro, te ayudo!', 'Ahora no, quizás más tarde.']);
      if (c === 0) {
        side.acceptSide(offer);
        await say(id, '¡Gracias! Sin apuro, eh.', 'happy');
      } else await say(id, 'No pasa nada. También está en la cartelera de la plaza.');
    }
    const special = qt || offer ? true : await specialTalk(id);
    if (!special) {
      const line = pickLine(id);
      if (line) {
        lastLine[id] = line.t;
        await say(id, line.t, line.e ?? 'neutral');
        if (line.reply) await say(id, line.reply);
        if (line.set) game.setFlag(line.set);
      }
    }
    // first chat of the day grows friendship (never decays)
    const r = game.rel(id);
    if (r.lastTalkDay !== game.save.time.day) {
      r.lastTalkDay = game.save.time.day;
      const up = game.addFriendship(id, BALANCE.talkPoints);
      if (up) await friendshipUp(id, up);
    }
    const opts = ['Charlar un rato', 'Regalar algo', ...(RACCOONS.includes(id) && game.friendLevel(id) >= 1 ? ['Cambiar su atuendo'] : []), 'Nada, solo saludar'];
    const c = await choose(opts);
    const pick = opts[c];
    if (pick === 'Charlar un rato') {
      const l2 = pickLine(id);
      if (l2) {
        lastLine[id] = l2.t;
        await say(id, l2.t, l2.e ?? 'neutral');
        if (l2.set) game.setFlag(l2.set);
      }
    } else if (pick === 'Regalar algo') {
      const item = await pickGift();
      if (item) {
        await giveGift(id, item);
      } else {
        await say(id, 'No te preocupes, en otro momento.', 'neutral');
      }
    } else if (pick === 'Cambiar su atuendo') {
      const { openRaccoonOutfit } = await import('../ui/wardrobe');
      openRaccoonOutfit(id);
    }
  });
}

/** Character-specific dynamic moments (Pip's treasures, Spicy's experiments). */
async function specialTalk(id: string): Promise<boolean> {
  if (id === 'pip' && game.flag('pip_treasure_ready') === game.save.time.day && game.flag('pip_treasure_given') !== game.save.time.day) {
    game.setFlag('pip_treasure_given', game.save.time.day);
    const n = (game.save.stats.pipTreasures ?? 0) + 1;
    game.save.stats.pipTreasures = n;
    await say('pip', '¡{name}! ¡Encontré un tesoro!', 'happy');
    const loot = n === 1 ? 'spoon' : ['st_seaglass', 'fl_daisy', 'sh_cowrie', 'berry', 'st_quartz', 'wood', 'g_candy'][n % 7];
    if (loot === 'spoon') {
      await say('narr', 'Pip te entrega el tesoro con mucha ceremonia. Es una cuchara.');
      await say('pip', 'Bueno... es un tesoro bastante útil.', 'smug');
    } else await say('narr', `Pip te da: ${ITEMS_BY_ID[loot].name}.`);
    game.addItem(loot, 1, 'pip');
    if (n >= 5) game.setFlag('ach_pip_treasure');
    return true;
  }
  if (id === 'spicy' && game.friendLevel('spicy') >= 1 && !game.has('spicy_lab_intro')) {
    game.setFlag('spicy_lab_intro');
    await say('spicy', 'Acabo de crear mi obra maestra.', 'happy');
    await say('player', '¿Qué tiene?');
    await say('spicy', 'Arroz, salmón, pepino y una cantidad preocupante de wasabi.', 'smug');
    await say('spicy', 'Si alguna vez querés experimentar conmigo, usá la tabla de cocina y elegí "Experimentar". ¡La ciencia culinaria nos espera!', 'happy');
    return true;
  }
  return false;
}

export async function friendshipUp(id: string, lvl: number) {
  audio.sfxPlay('sparkle');
  const name = CHAR_BY_ID[id]?.name ?? id;
  await say('narr', `Tu amistad con ${name} creció. (Nivel ${lvl} de 5)`);
  const rewards: Record<string, Record<number, () => Promise<void>>> = {
    pip: {
      2: async () => {
        game.setFlag('recipe_pip');
        const { learnRecipe } = await import('../restaurant/orders');
        learnRecipe('pip_happy');
        await say('pip', '¡Te voy a enseñar mi receta secreta! Se llama Pip\'s Happy Maki. Tiene mango y frutillas y felicidad.', 'happy');
      },
      3: async () => {
        if (!game.save.clothesOwned.includes('bg_raccoon')) game.save.clothesOwned.push('bg_raccoon');
        await say('pip', 'Te hice una mochila igual a mí. ¡Así siempre me llevás con vos!', 'happy');
      },
    },
    spicy: {
      2: async () => {
        game.setFlag('recipe_spicy');
        const { learnRecipe } = await import('../restaurant/orders');
        learnRecipe('spicy_beacon');
        await say('spicy', 'Te ganaste mi receta firma: el Spicy Beacon Roll. Tratalo con respeto. Y con wasabi.', 'happy');
      },
      3: async () => {
        if (!game.save.clothesOwned.includes('hd_chef')) game.save.clothesOwned.push('hd_chef');
        if (!game.save.clothesOwned.includes('top_chef')) game.save.clothesOwned.push('top_chef');
        await say('spicy', 'Una verdadera chef necesita su uniforme. ¡Tomá! Ahora somos colegas.', 'happy');
      },
    },
    rigg: {
      2: async () => {
        game.setFlag('recipe_rigg');
        const { learnRecipe } = await import('../restaurant/orders');
        learnRecipe('rigg_midnight');
        await say('rigg', 'Te anoté una receta. Se llama Midnight Roll. Es para comer en silencio. Probalo.', 'smug');
      },
      3: async () => {
        if (!game.save.clothesOwned.includes('fc_round')) game.save.clothesOwned.push('fc_round');
        await say('rigg', 'Unos anteojos como los míos. Para ver detalles. No es para que nos parezcamos. Bueno, un poco.', 'happy');
      },
    },
  };
  await rewards[id]?.[lvl]?.();
  await personalStory(id, lvl);
  if (lvl >= 3) game.setFlag(`friend3_${id}`);
  if (lvl >= 5) game.setFlag(`friend5_${id}`);
  game.touch('friend');
}

/** Personal stories and "memories" unlocked by deep friendship. Memories are collected in the album. */
async function personalStory(id: string, lvl: number) {
  const memory = (key: string, title: string) => {
    game.collect('memories', key);
    game.setFlag('memory_' + key, title);
    toast(`Nuevo recuerdo: ${title}`);
  };
  const S: Record<string, Record<number, () => Promise<void>>> = {
    pip: {
      4: async () => {
        await say('pip', '{name}, ¿puedo contarte un secreto? Tengo miedo de las tormentas. Mucho.', 'sad');
        await say('pip', 'Cuando era chiquito, una noche de tormenta alguien me tapó con una manta y me cantó. Creo que por eso me gustan tanto las mantas.');
        const c = await choose(['La próxima tormenta, te hago compañía.', 'Podemos inventar una canción nueva juntos.']);
        await say('pip', c === 0 ? '¿En serio? Entonces ya no les tengo tanto miedo.' : '¡Sí! Una que diga "mapache" muchas veces.', 'happy');
        memory('pip_storm', 'La canción de la tormenta');
      },
      5: async () => {
        await say('pip', 'Te hice algo. Es una caja de tesoros para vos. Adentro hay una piedra rosa, una cuchara... y un dibujo nuestro.', 'happy');
        await say('narr', 'En el dibujo, torcido y lleno de color, estás vos con tres mapaches. Arriba dice: "MI FAMILIA".');
        game.save.furnitureOwned.plush_raccoon = (game.save.furnitureOwned.plush_raccoon ?? 0) + 1;
        memory('pip_family', 'Mi familia, por Pip');
      },
    },
    spicy: {
      4: async () => {
        await say('spicy', 'La primera vez que cociné algo, se me quemó. Era un huevo. UN HUEVO.', 'sad');
        await say('spicy', 'Akio se lo comió igual y dijo "tiene carácter". Desde ese día, cocino con carácter. Con mucho.');
        memory('spicy_egg', 'El huevo con carácter');
      },
      5: async () => {
        await say('spicy', 'Quiero que tengas esto: mi cucharón de la suerte. Bueno, uno igualito. El original no lo suelto ni loco.', 'happy');
        await say('spicy', 'Sos la mejor compañera de cocina que tuve. Incluso mejor que mi reflejo en la olla.');
        game.save.furnitureOwned.shelf_kitchen = (game.save.furnitureOwned.shelf_kitchen ?? 0) + 1;
        memory('spicy_ladle', 'El cucharón de la suerte');
      },
    },
    rigg: {
      4: async () => {
        await say('rigg', 'Antes de que llegaras, contaba los días en mi cuaderno. Ahora me olvido de contarlos. Creo que eso es bueno.', 'smug');
        await say('rigg', 'Te muestro algo: un mapa de Villa Nori que dibujé yo. Te agregué. Estás acá, en el restaurante. Con nosotros.');
        memory('rigg_map', 'El mapa de Rigg');
      },
      5: async () => {
        await say('rigg', 'Escribí una última página en mi cuaderno: "Caso cerrado. Encontré lo que buscaba". No hablaba solo de las estrellas.', 'happy');
        game.save.furnitureOwned.telescope = (game.save.furnitureOwned.telescope ?? 0) + 1;
        memory('rigg_case', 'Caso cerrado');
      },
    },
  };
  if (S[id]?.[lvl]) {
    await S[id][lvl]();
    return;
  }
  // villagers: a thoughtful gift at level 3 and something special at 5
  const def = CHAR_BY_ID[id];
  if (!def || def.raccoon) return;
  if (lvl === 3) {
    const gift = def.likes.find((i) => ITEMS_BY_ID[i]) ?? 'g_candy';
    game.addItem(gift, 2, 'friend');
    await say(id, `Te guardé esto. Me hizo acordar a vos.`, 'happy');
    await say('narr', `${def.name} te regaló 2 ${ITEMS_BY_ID[gift].name}.`);
  } else if (lvl === 5) {
    game.addCoins(250, 'friend');
    await say(id, 'Sos de las mejores cosas que le pasaron a Villa Nori. Lo digo en serio.', 'happy');
    memory('friend_' + id, `Amistad con ${def.name}`);
  }
}

export type GiftReaction = 'love' | 'like' | 'dislike' | 'neutral';

export interface GiftResult {
  success: boolean;
  reason?: 'invalid_character' | 'already_gifted_today' | 'missing_item';
  points: number;
  reaction: GiftReaction;
  levelUp: number;
}

export function evaluateGift(id: string, item: string): { points: number; reaction: GiftReaction } | null {
  const def = CHAR_BY_ID[id];
  if (!def) return null;
  const love = def.loves?.includes(item) ?? false;
  const like = def.likes?.includes(item) ?? false;
  const dislike = def.dislikes?.includes(item) ?? false;
  const bday = game.flag('bday_today_' + id) === game.save.time.day ? 2 : 1;
  const pts = (love ? BALANCE.giftLoved : like ? BALANCE.giftLiked : dislike ? 2 : BALANCE.giftNeutral) * bday;
  const reaction: GiftReaction = love ? 'love' : like ? 'like' : dislike ? 'dislike' : 'neutral';
  return { points: pts, reaction };
}

export function processGift(id: string, item: string): GiftResult {
  const def = CHAR_BY_ID[id];
  if (!def) {
    return { success: false, reason: 'invalid_character', points: 0, reaction: 'neutral', levelUp: 0 };
  }
  const r = game.rel(id);
  if (r.lastGiftDay === game.save.time.day) {
    return { success: false, reason: 'already_gifted_today', points: 0, reaction: 'neutral', levelUp: 0 };
  }
  if (!game.count(item) || !game.removeItem(item, 1)) {
    return { success: false, reason: 'missing_item', points: 0, reaction: 'neutral', levelUp: 0 };
  }
  r.lastGiftDay = game.save.time.day;
  const evaluated = evaluateGift(id, item)!;
  game.setFlag(`gift_${id}_${item}`);
  game.stat('gifts');
  const levelUp = game.addFriendship(id, evaluated.points);
  return {
    success: true,
    points: evaluated.points,
    reaction: evaluated.reaction,
    levelUp,
  };
}

export function pickGift(): Promise<string | null> {
  return new Promise((resolve) => {
    const items = ITEMS.filter((i) => game.count(i.id) > 0 && i.cat !== 'key');
    let chosen: string | null = null;
    const grid = h('div', { class: 'grid' });
    if (!items.length) {
      grid.append(h('p', { class: 'muted', style: { padding: '16px', textAlign: 'center', gridColumn: '1 / -1' } }, 'No tenés nada para regalar todavía.'));
    }
    for (const it of items) {
      grid.append(
        h(
          'button',
          {
            class: 'slot',
            onclick: () => {
              chosen = it.id;
              p.close();
            },
          },
          iconElement(it.icon),
          h('span', null, it.name),
          h('span', { class: 'qty' }, game.count(it.id)),
        ),
      );
    }
    const p = panel({ title: 'Elegí un regalo', body: grid, onClose: () => resolve(chosen) });
  });
}

export async function giveGift(id: string, item: string) {
  const def = CHAR_BY_ID[id];
  if (!def) return;
  const r = game.rel(id);
  if (r.lastGiftDay === game.save.time.day) {
    await say(id, 'Ya me diste algo hoy. ¡Guardalo para otro día!', 'happy');
    return;
  }
  if (!game.count(item)) {
    await say(id, 'Parece que ya no tenés ese objeto.', 'neutral');
    return;
  }
  const res = processGift(id, item);
  if (!res.success) {
    if (res.reason === 'already_gifted_today') {
      await say(id, 'Ya me diste algo hoy. ¡Guardalo para otro día!', 'happy');
    } else {
      await say(id, 'Parece que ya no tenés ese objeto.', 'neutral');
    }
    return;
  }
  const pool = GIFT_REACT[res.reaction];
  await say(id, pool[Math.floor(Math.random() * pool.length)], res.reaction === 'love' || res.reaction === 'like' ? 'happy' : res.reaction === 'dislike' ? 'sad' : 'neutral');
  if (res.reaction === 'love') toast(`A ${def.name} le encantó.`);
  if (res.levelUp) await friendshipUp(id, res.levelUp);
}
