/**
 * Conversation topics. Pure: given what is going on (the time, the weather, what the speaker is doing and looking at, how the
 * restaurant is going, what the neighbours are up to) they pick a line, never the same one twice in a row.
 * `{name}` is replaced by the player's name when the line is said.
 */
import type { Expr } from '../art/characters';
import type { NpcAct } from '../data/characters';

export type Topic = 'how' | 'doing' | 'town' | 'news' | 'restaurant' | 'joke';
export const TOPIC_LABEL: Record<Topic, string> = {
  how: '¿Cómo andás?', doing: '¿Qué estás haciendo?', town: 'Contame del pueblo', news: '¿Alguna novedad?', restaurant: 'Hablemos del restaurante', joke: 'Contarle un chiste',
};

export interface TalkCtx {
  id: string;
  /** what they are doing; 'ride' and 'walk' are extra */
  act?: NpcAct | 'ride' | 'walk';
  /** where they are (bench, sea, fountain, garden, forest, market, shop, home, stroll, read) */
  place?: string;
  /** their trade, to say what "work" is for them */
  work?: string;
  zone: string;
  period: number;
  rain: boolean;
  festival: boolean;
  open: boolean;
  guests: number;
  level: number;
  reputation: number;
  /** friendship level 0-5 */
  friend: number;
  day: number;
  /** what some neighbours are doing right now */
  others?: { name: string; what: string }[];
  /** their own things to say, when they are not one of the story characters */
  flavour?: string[];
  /** a dish a regular liked, to bring up */
  favourite?: string;
}

export interface TopicLine { t: string; e?: Expr; /** for jokes: the joke the player tells before the reaction */ joke?: string }

const hash = (s: string) => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };
const turn = new Map<string, number>();
/** how many times this was asked (so repeating the question walks through the pool) */
function nth(key: string) { const n = turn.get(key) ?? 0; turn.set(key, n + 1); return n; }
export const resetTopicMemory = () => turn.clear();
/** `ordered`: the first answer is the first line (the one that fits the situation), then the rest in turn */
const pick = <T,>(pool: T[], key: string, seed: number, ordered = false): T => pool[((ordered ? 0 : seed) + nth(key)) % pool.length];

// ------------------------------------------------------------------ how
const HOW_PERIOD = [
  ['Recién arranco el día, pero ya me siento bien.', 'Mañana tranquila: mi parte favorita.', 'Con el primer té del día todo mejora.', 'Dormí bien, así que hoy ando de buen humor.'],
  ['A media tarde me da un poco de sueño, pero ando bien.', 'Tarde linda. Con este sol da gusto andar.', 'Ocupado, pero contento.', 'Ni mal ni bien: bien tranquilo.'],
  ['Esta hora es mi favorita: todo se pone dorado.', 'Ya se siente el final del día, y eso me gusta.', 'Cansado, pero de los buenos cansancios.', 'Con los faroles prendiéndose, ¿cómo no estar bien?'],
  ['De noche el pueblo se siente más mío.', 'Con la noche se calma todo. Estoy tranquilo.', 'Un poco de sueño, pero me gusta este silencio.', 'La noche me encuentra pensando en cosas lindas.'],
];
const HOW_RAIN = ['Con esta lluvia dan ganas de quedarse adentro con algo calentito.', 'Llueve, pero a mí la lluvia me gusta. Suena lindo.', 'Un poco mojado, pero de buen humor.', 'La lluvia lo limpia todo. Hasta los pensamientos.'];
const HOW_FRIEND = ['Mejor ahora que apareciste, {name}.', 'Siempre da gusto verte, {name}.', '¿Yo? Bien. Pero más contento de que me preguntes vos.'];
const FLAVOUR: Record<string, string[]> = {
  pip: ['¡Hoy encontré una piedra casi redonda! Casi.', 'Tengo hambre, pero de las lindas.'],
  spicy: ['¡Estoy en mi mejor forma! Dramáticamente hablando.', 'Hoy el picante me habla. Y me dice cosas buenas.'],
  rigg: ['Todo en orden. Lo anoté, por las dudas.', 'Observando. Es lo que mejor se me da.'],
  taro: ['Con buen negocio y buen rumor, ¿cómo voy a andar?', 'Vendí bastante. Y escuché más.'],
  yuki: ['Hilo de más, tiempo de menos. Normal.', 'Estoy con un diseño nuevo en la cabeza.'],
  kumo: ['Entre libros siempre estoy bien. Es el mundo exterior el que me cansa.', 'Hoy encontré una nota vieja en un libro. Misterio.'],
  nami: ['¡Con el mar así, perfecta!', 'Me dieron ganas de salir a pescar apenas me levanté.'],
  hoshi: ['Dormí poco, pero soñé con una constelación nueva.', 'Mi horario es raro, pero mi ánimo, estable.'],
  bento: ['Con el horno prendido siempre estoy bien.', 'Hoy el pan salió más esponjoso que nunca.'],
  sumi: ['La luz de hoy me tiene inspirada.', 'Estoy a un trazo de terminar algo bonito.'],
  kiki: ['¡Con ganas de explorar, como siempre!', 'Hoy descubrí otro atajo. No te lo digo, es secreto.'],
  sora: ['Puntual, como siempre. Las cartas no esperan.', 'Con la bolsa llena, pero el ánimo liviano.'],
  ume: ['A mi edad, cada día bueno es un regalo.', 'Con ganas de tomar té y contar historias, hijo.'],
  momo: ['Con las flores abiertas, ando bien.', 'Algo cansada de regar, pero feliz.'],
};

// ------------------------------------------------------------------ doing
const DOING: Partial<Record<NpcAct | 'ride' | 'walk', string[]>> = {
  sleep: ['Shh... estoy durmiendo. Bueno, ya no tanto.', 'Zzz... ¿eh? Ah, hola. Me quedé dormido.'],
  cook: ['Estoy cocinando algo. No preguntes, que se me quema.', 'Probando una receta. Todavía le falta algo.'],
  read: ['Leyendo. Estoy justo en la mejor parte.', 'Un libro tranquilo: perfecto para esta hora.'],
  sit: ['Descansando un rato. A veces eso es todo lo que hace falta.', 'Me senté a ver cómo pasa el pueblo.'],
  play: ['Jugando un rato. Los grandes también podemos.', 'Estoy a mitad de una partida importantísima.'],
  work: ['Trabajando, como siempre. Pero con ganas.', 'Acomodando cosas. Siempre hay algo para acomodar.'],
  fish: ['Pescando. Todo es cuestión de paciencia.', 'Esperando que algo pique. Mientras, pienso.'],
  paint: ['Pintando. Hoy la luz está justa.', 'Estoy a medio cuadro. No mires todavía.'],
  stars: ['Mirando el cielo. Hay una estrella que parpadea distinto.', 'Buscando constelaciones. Acabo de inventar una.'],
  eat: ['Comiendo algo rico. ¿Querés un poquito?', 'Un bocado y sigo.'],
  drink: ['Tomando un té. El mejor momento del día.', 'Un traguito y vuelvo a lo mío.'],
  clean: ['Limpiando un poco. Dejar todo prolijo me relaja.', 'Barriendo. Es raro, pero me gusta.'],
  talk: ['Charlando, como ahora.', 'Contando cosas a quien quiera oírlas.'],
  ride: ['Voy en bici. ¡Permiso!', 'Dando una vuelta rápida, que el viento está bueno.'],
  walk: ['Caminando, sin apuro.', 'Estirando las piernas por el pueblo.'],
};
const WORK: Record<string, string[]> = {
  taro: ['Ordenando el almacén: arroz, nori y rumores.', 'Anotando precios. Y chismes, pero esos no se cobran.'],
  yuki: ['Planchando y doblando telas.', 'Cosiendo un dobladillo que no quiere cooperar.'],
  bento: ['Amasando el pan de mañana.', 'Mirando el horno como quien cuida a un bebé.'],
  sumi: ['Preparando pinceles y colores.', 'Colgando un cuadro. Está medio torcido a propósito.'],
  nami: ['Limpiando el pescado de hoy.', 'Revisando las redes: siempre hay un nudo.'],
  kumo: ['Catalogando libros. Uno por uno.', 'Poniendo en orden el estante de historia.'],
  momo: ['Regando y cortando flores.', 'Armando un ramito para alguien especial.'],
  ren: ['Lijando una tabla. Lleva su tiempo.', 'Calculando cuánta madera hace falta.'],
};
const SEE: Record<string, string[]> = {
  fountain: ['Desde acá se ve cómo la fuente dibuja anillos en el agua.', 'Los reflejos de la fuente cambian a cada rato.'],
  sea: ['Se ve el mar hasta donde se acaba. Nunca es igual dos veces.', 'Hay barquitos a lo lejos.'],
  bench: ['Desde el banco se ve pasar medio pueblo.', 'Desde acá todo se mira más tranquilo.'],
  garden: ['Las flores abrieron varias esta semana.', 'Hay mariposas dando vueltas por los canteros.'],
  forest: ['Entre los árboles se cuela una luz medio verde.', 'Se escucha un pájaro que no conozco.'],
  market: ['Los puestos tienen cosas que de día no se ven.', 'Los farolitos brillan lindo desde acá.'],
  read: ['Por la ventana entra una luz tranquila.'],
  stroll: ['Se ve casi todo el pueblo desde acá.'],
};
const SEE_RAIN = ['Se ven las gotas bailando en cada charco.', 'La lluvia hace que todo brille un poquito más.'];

// ------------------------------------------------------------------ town / restaurant / news / jokes
const TOWN_ANY = [
  'El río suena distinto según la hora. ¿Lo notaste?', 'Dicen que en el santuario se piden deseos. Yo todavía no pedí ninguno.', 'Los cerezos de la ribera son lo más lindo de por acá.',
  'Si te perdés, seguí el río: siempre termina en el mar.', 'En la plaza siempre hay alguien con quien charlar.', 'El que quiere madera o piedra, que pase por la carpintería de Ren.',
];
const TOWN_NIGHT = ['De noche a veces aparece un mercado detrás del torii. Eso dicen.', 'Con las luces del pueblo prendidas, parece otro lugar.'];
const NEWS_ANY = ['Dicen que alguien dejó un regalito en la fuente. Nadie confiesa.', 'Mucho movimiento por el pueblo últimamente, ¿no?', 'Escuché que pronto va a haber novedades en la plaza. Ya veremos.'];
const WHAT_PLACE: Record<string, string> = {
  bench: 'sentado en un banco', sea: 'mirando el mar', fountain: 'junto a la fuente', garden: 'en el jardín', forest: 'paseando por el bosque', market: 'en el mercado',
  shop: 'en su trabajo', read: 'leyendo en la biblioteca', home: 'descansando en su casa', stroll: 'paseando por ahí', chat: 'charlando con alguien', ride: 'en bicicleta',
};
export const whatPlace = (kind: string) => WHAT_PLACE[kind] ?? 'por ahí';

export const JOKES = [
  '¿Qué le dice un maki a otro maki? —¡Qué enrollado que estás hoy!',
  '¿Cuál es el colmo de un cocinero? Quedarse... en su punto.',
  '¿Qué le dice el nori al arroz? —No me sueltes, que me desenrollo.',
  '¿Por qué el mapache cruzó la cocina? Para llegar al otro... bocadillo.',
  '¿Qué le dijo un faro a otro? —Qué luz que tenés hoy.',
  '¿Qué hace un pez cuando se aburre? Nada. Literalmente.',
  '¿Cómo se despide un panadero? —Nos vemos... ¡en la masa!',
  '¿Qué le dice una taza de té a otra? —Qué bueno encontrarte... en infusión.',
  '¿Cuál es el pez más cansado? El pez... espada, porque siempre está en guardia.',
  '¿Por qué los pájaros no usan Internet? Porque ya tienen su propio tuit.',
];
const REACT: Record<string, string[]> = {
  pip: ['¡Jajaja! ¡Otra, otra!', 'Ji ji... enrollado. Entendí tarde, pero entendí.'],
  spicy: ['¡Eso es humor de alta cocina! Casi.', 'Mmm... le falta picante, pero me reí igual.'],
  rigg: ['...Voy a anotar que me hizo gracia. No sé dónde.', 'Eso fue sorprendentemente eficiente.'],
  ume: ['Ay, hijo, qué cosas decís. Jajaja.', 'Ese no lo conocía. Lo voy a contar en el té.'],
};
const REACT_ANY = ['¡Jajaja! Buenísimo.', 'Ay, no... qué malo. Me encantó.', 'Jaja, ese no lo conocía.', 'Uf, cuántas ganas de enojarme y qué risa que me dio.', '(se ríe bajito) Me lo voy a acordar.'];

// ------------------------------------------------------------------ the engine
export function topicLine(topic: Topic, c: TalkCtx): TopicLine {
  const seed = hash(c.id + topic + c.day);
  const key = `${c.id}:${topic}`;
  switch (topic) {
    case 'how': {
      const pool = [...(c.rain ? HOW_RAIN : HOW_PERIOD[Math.max(0, Math.min(3, c.period))]), ...(c.flavour ?? FLAVOUR[c.id] ?? []), ...(c.friend >= 3 ? HOW_FRIEND : [])];
      if (c.festival) pool.unshift('¡Con la fiesta de hoy, estoy de lo mejor!');
      return { t: pick(pool, key, seed), e: 'happy' };
    }
    case 'doing': {
      const act = c.act ?? 'sit';
      const base = act === 'work' && (WORK[c.id] || c.work) ? (WORK[c.id] ?? [`Trabajando de lo mío: ${c.work!.toLowerCase()}.`]) : DOING[act] ?? DOING.walk!;
      const see = c.rain ? SEE_RAIN : SEE[c.place ?? ''] ?? [];
      const a = pick(base, key, seed);
      const s = see.length ? ` ${see[(seed + (turn.get(key) ?? 0)) % see.length]}` : '';
      return { t: a + s, e: 'neutral' };
    }
    case 'town': {
      const pool = [...TOWN_ANY, ...(c.period === 3 ? TOWN_NIGHT : [])];
      if (c.festival) pool.unshift('¡Hoy hay fiesta! Todo el pueblo anda movido.');
      if (c.rain) pool.unshift('Con la lluvia las calles quedan casi vacías. Pero los charcos están lindos.');
      if (c.level >= 3) pool.push('Desde que arreglaron Midnight Maki, el pueblo se siente más vivo.');
      return { t: pick(pool, key, seed, true) };
    }
    case 'news': {
      const o = c.others ?? [];
      const pool: string[] = [...o.slice(0, 3).map((n) => `Vi a ${n.name} ${n.what}. Anda de buen humor.`), ...NEWS_ANY];
      if (c.favourite) pool.unshift(`Dicen que a alguien le encantó el ${c.favourite} de Midnight Maki.`);
      return { t: pick(pool, key, seed, true) };
    }
    case 'restaurant': {
      const pool: string[] = [];
      if (!c.open) pool.push('Midnight Maki ya cerró por hoy. Mañana será otro día.');
      else if (c.guests >= 3) pool.push('Vi el salón lleno. ¡Qué movimiento!');
      else if (c.guests === 0) pool.push('Estaba tranquilo cuando pasé. Es buen momento para ir.');
      else pool.push('Pasé y había gente comiendo. Se ve bien.');
      if (c.reputation >= 50) pool.push('Ya se habla del restaurante en todo el pueblo.');
      if (c.level >= 5) pool.push('Cada vez se parece más a un lugar de verdad.');
      if (c.level < 3) pool.push('Se nota que recién empieza. Pero se nota que le ponés ganas.');
      if (c.favourite) pool.push(`Me dijeron que el ${c.favourite} sale riquísimo.`);
      pool.push('A mí me gusta que cocines con cariño. Se nota en el plato.');
      return { t: pick(pool, key, seed, true), e: 'happy' };
    }
    case 'joke': {
      const n = nth(key);
      const r = [...(REACT[c.id] ?? []), ...REACT_ANY];
      return { joke: JOKES[(seed + n) % JOKES.length], t: r[(seed + n) % r.length], e: 'happy' };
    }
  }
}

