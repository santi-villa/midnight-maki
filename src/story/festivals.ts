/**
 * Calendar events as small playable scenes. Each runs once per in-game year when you visit
 * the right place on the right day. Missing one is fine: it comes back next year.
 */
import { BALANCE, dayOfSeason, seasonOf } from '../core/balance';
import { game } from '../core/state';
import { RECIPES_BY_ID } from '../data/recipes';
import { choose, runScene, say } from '../dialogue/dialogue';
import { learnRecipe } from '../restaurant/orders';
import { clock } from '../systems/time';
import { toast } from '../ui/dom';

const year = () => Math.floor((game.save.time.day - 1) / (BALANCE.daysPerSeason * 4)) + 1;
const doneKey = (id: string) => `fest_${id}_${year()}`;

function giveCloth(id: string) {
  if (!game.save.clothesOwned.includes(id)) game.save.clothesOwned.push(id);
}
function giveFurn(id: string, n = 1) {
  game.save.furnitureOwned[id] = (game.save.furnitureOwned[id] ?? 0) + n;
}

export async function checkFestival(zone: string) {
  const ev = game.flag('festival_today');
  if (typeof ev === 'string' && !game.has(doneKey(ev))) {
    const run = SCENES[ev];
    if (run && run.where === zone && (!run.night || clock.period >= 2)) {
      game.setFlag(doneKey(ev));
      await runScene('fest_' + ev + '_' + year(), run.play);
      game.touch('festival');
      return;
    }
  }
  // rainy day gathering: the first rainy day of each season, at the restaurant
  if (zone === 'restaurant' && game.flag('weather') === 'rain' && game.has('intro_done')) {
    const k = `rainday_${year()}_${seasonOf(game.save.time.day)}`;
    if (!game.has(k)) {
      game.setFlag(k);
      await runScene('rainday', rainDay);
    }
  }
  // raccoon birthdays are celebrated when you enter the restaurant or home
  for (const r of ['pip', 'spicy', 'rigg']) {
    const b = { pip: 105, spicy: 212, rigg: 311 }[r]!;
    if (seasonOf(game.save.time.day) === Math.floor(b / 100) && dayOfSeason(game.save.time.day) === b % 100) {
      const k = `bday_${r}_${year()}`;
      if (!game.has(k) && (zone === 'restaurant' || zone === 'home')) {
        game.setFlag(k);
        await runScene('bday_' + r, () => birthday(r));
      }
    }
  }
}

async function birthday(r: string) {
  const name = { pip: 'Pip', spicy: 'Spicy Beacon', rigg: 'Rigg' }[r];
  await say('narr', `Hoy es el cumpleaños de ${name}. Los otros dos mapaches colgaron una guirnalda torcida en el salón.`);
  if (r === 'pip') await say('pip', '¡Es mi cumple! ¿Sabías? ¡Ahora sí sabés! Acepto abrazos, regalos y cucharas.', 'happy');
  if (r === 'spicy') await say('spicy', 'Hoy no cocino. Hoy me cocinan. Bueno, cocino un poquito. Es mi cumpleaños y hago lo que quiero.', 'happy');
  if (r === 'rigg') await say('rigg', 'No hacía falta... pero gracias. De verdad. ¿Esa guirnalda la colgó Pip? Está al revés. Me encanta.', 'happy');
  await say('narr', `Un regalo hoy vale el doble para ${name}.`);
  game.setFlag('bday_today_' + r, game.save.time.day);
}

async function rainDay() {
  await say('narr', 'Llueve fuerte sobre Villa Nori. Uno a uno, los vecinos se refugian en Midnight Maki.');
  await say('bento', 'Traje pan. La lluvia y el pan se llevan muy bien.', 'happy');
  await say('ume', 'Cuando llovía así, Akio preparaba té para todos y contaba historias.');
  const c = await choose(['Preparar té para todos', 'Contar una historia de tu viaje']);
  if (c === 0) await say('narr', 'Servís té caliente. Las ventanas se empañan. Nadie tiene apuro por irse.');
  else await say('narr', 'Contás cómo llegaste con una carta misteriosa. Pip escucha con la boca abierta. Rigg toma notas.');
  for (const v of ['bento', 'ume', 'momo', 'kumo']) game.addFriendship(v, 10);
  game.addCoins(80, 'rainday');
  toast('Día de la Lluvia: +amistad con los vecinos.');
}

const SCENES: Record<string, { where: string; night?: boolean; play: () => Promise<void> }> = {
  flowers: {
    where: 'garden',
    play: async () => {
      await say('momo', '¡{Bienvenido|Bienvenida} al Festival de las Flores! Hoy el jardín se viste de fiesta.', 'happy');
      await say('momo', 'Hay un concurso: traé la flor más linda que tengas. No importa ganar... bueno, un poquito importa.');
      const flowers = Object.keys(game.save.inventory).filter((id) => id.startsWith('fl_'));
      if (!flowers.length) {
        await say('momo', '¿No trajiste flores? No pasa nada. Tomá unas semillas, para el año que viene.', 'happy');
        game.addItem('sd_flower', 3, 'festival');
      } else {
        const best = flowers.sort((a, b) => (b === 'fl_star' ? 1 : 0) - (a === 'fl_star' ? 1 : 0))[0];
        game.removeItem(best, 1);
        await say('narr', 'Presentás tu flor. Los vecinos aplauden con cortesía... y después con ganas.');
        await say('momo', '¡Primer premio! Te ganaste la receta del Sakura Roll y un bonsái muy especial.', 'happy');
        game.setFlag('recipe_sakura');
        learnRecipe('sakura_roll');
        giveFurn('bonsai_sakura');
      }
      game.addFriendship('momo', 20);
    },
  },
  sushi: {
    where: 'plaza',
    play: async () => {
      await say('spicy', '¡FESTIVAL DEL SUSHI! ¡El día más importante del año! Después de mi cumpleaños.', 'happy');
      await say('taro', 'Las reglas son simples: cada cocinera presenta su mejor plato. El jurado: Bento, Ume y yo. Imparcialísimo.', 'smug');
      const known = game.save.recipesKnown.map((id) => RECIPES_BY_ID[id]).sort((a, b) => b.price - a.price).slice(0, 3);
      const c = await choose(known.map((r) => `Presentar ${r.name}`));
      const r = known[c];
      const score = r.difficulty + ((game.save.recipesCooked[r.id] ?? 0) > 3 ? 1 : 0);
      await say('narr', `Preparás ${r.name} frente a todo el pueblo. Spicy llora de emoción. Pip aplaude con las cuatro patas.`);
      if (score >= 3) {
        await say('bento', '¡Primer puesto para Midnight Maki!', 'happy');
        game.addCoins(400, 'festival');
        giveCloth('hd_chef');
      } else {
        await say('ume', 'Un segundo puesto muy merecido. El año que viene, el primero.', 'happy');
        game.addCoins(200, 'festival');
      }
      game.save.restaurant.reputation += 20;
    },
  },
  raccoons: {
    where: 'restaurant',
    play: async () => {
      await say('narr', '¡Día de los Mapaches! El pueblo entero celebra a Pip, Spicy Beacon y Rigg.');
      await say('pip', '¡Es nuestro día! ¡Hay torta! ¡Y gorritos! ¡Y gorritos de torta!', 'happy');
      await say('spicy', 'Yuki nos hizo ropa a juego. Para vos también, obviamente. Somos una pandilla.', 'happy');
      await say('rigg', 'Esto es demasiada atención. Me encanta. No se lo digas a nadie.', 'smug');
      giveCloth('top_raccoon_hoodie');
      giveCloth('hd_raccoon');
      giveCloth('bg_raccoon');
      giveFurn('rug_raccoon');
      for (const r of ['pip', 'spicy', 'rigg']) game.addFriendship(r, 15);
      toast('Recibiste el atuendo de mapache y una alfombra especial.');
    },
  },
  lanterns: {
    where: 'plaza',
    night: true,
    play: async () => {
      await say('narr', 'Es la Noche de Faroles. Cientos de faroles de papel cuelgan sobre la plaza y se reflejan en la fuente.');
      await say('hoshi', 'Cada farol es un deseo. Dicen que las estrellas los leen.', 'happy');
      const c = await choose(['Desear que los mapaches sean felices', 'Desear volver a ver a Akio', 'Desear muchos días tranquilos']);
      game.save.story.decisions['lantern_' + year()] = String(c);
      await say('narr', 'Soltás tu farol. Sube despacio, se mezcla con los otros y por un momento parece una constelación nueva.');
      giveFurn('lantern_red', 2);
      giveFurn('lantern_cream', 2);
      toast('Recibiste faroles para decorar.');
    },
  },
  moon: {
    where: 'market',
    play: async () => {
      await say('?Vendedor de luna', '{Bienvenido|Bienvenida} al Mercado de la Luna. Hoy todo brilla un poco más.', 'happy');
      await say('narr', 'Los puestos venden cosas que no se ven el resto del año. Te regalan una perla de luna por venir.');
      game.addItem('moonpearl', 2, 'festival');
      game.addItem('starfruit', 1, 'festival');
      giveFurn('starlamp');
    },
  },
};

/** the Moon Market keeps the night market open the whole evening */
export function festivalMarketOpen(): boolean {
  return game.flag('festival_today') === 'moon';
}

