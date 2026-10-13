/**
 * Cinematic prologue: one still picture per scene, lines the player advances, and sound cues.
 * One continuous music bed accompanies all pictures; effects keep their own scene cues.
 * The jar and the restaurant door are not cues here: they play on the first visit inside.
 */
import type { IntroSoundId, IntroSoundKind } from './introSounds';

/** Game music beds the intro is allowed to ask for. */
export const INTRO_MUSIC = ['intro'] as const;
export type IntroMusic = (typeof INTRO_MUSIC)[number];

export type CueAt = 'enter' | number;

export interface IntroCue {
  sound: IntroSoundId;
  /** Relative level before the player's ambience or effects slider. 0 fades a bed out. */
  volume: number;
  kind: IntroSoundKind;
  /** Crossfade in seconds. Beds and stops default to 1.5. */
  fade?: number;
  /** One-shots: fade this play out after this many seconds so a long file stays brief. */
  hold?: number;
  /** Fade out a one-shot that is already playing. Does not start a new copy. */
  stop?: boolean;
}

export interface IntroLine {
  text: string;
  who?: 'player';
  cues?: IntroCue[];
}

export interface IntroScene {
  id: string;
  image: number;
  alt: string;
  /** Played when the picture appears, unless musicAt says otherwise. */
  music: IntroMusic;
  /** Line index that brings the music in. Until then the previous track keeps playing. */
  musicAt?: number;
  enter?: IntroCue[];
  lines: IntroLine[];
  /** Show the letter after this line index has been read. */
  letterAfter?: number;
}

const bed = (sound: IntroSoundId, volume: number, fade = 1.5): IntroCue => ({ sound, volume, kind: 'bed', fade });
const shot = (sound: IntroSoundId, volume: number, hold?: number): IntroCue => ({ sound, volume, kind: 'shot', hold });

export const LETTER_LINES = [
  '{Querido|Querida} {name}:',
  'Hace unos meses recibí una postal tuya.',
  'Tal vez no la recuerdes. Era una pregunta sencilla sobre qué hace que un lugar se sienta como un hogar.',
  'Me quedé pensando en tu respuesta mucho más de lo que imaginás.',
  'En un pequeño pueblo junto al mar existe un restaurante llamado Midnight Maki. Durante muchos años fue un lugar lleno de conversaciones, platos compartidos y personas que siempre encontraban una silla libre.',
  'Pero las cosas cambiaron.',
  'Hoy el restaurante necesita a alguien nuevo. Alguien que quiera devolverle aquello que lo hacía especial.',
  'Por eso decidí ofrecerte la posibilidad de hacerte cargo de él. Dentro de este sobre encontrarás una llave, algunas fotografías y los documentos necesarios para formalizar el traspaso si aceptás.',
  'No espero que sepas administrar un restaurante, ni que tengas todas las respuestas.',
  'Solo te pido que lo conozcas antes de decidir.',
  'Hay tres pequeños habitantes que todavía cuidan ese lugar. Son bastante distintos entre sí, y probablemente te den más de un dolor de cabeza.',
  'Pero tienen un corazón enorme.',
  'No necesitás responder esta carta.',
  'Si decidís venir, seguí el camino que sale de la estación hasta la plaza. Vas a reconocer el restaurante por sus dos faroles.',
  'Ojalá encuentres en Villa Nori algo de lo que escribiste aquella vez.',
  'Con cariño,',
];

export const LETTER_SIGN = 'A.';

export const INTRO_SCENES: IntroScene[] = [
  {
    id: 'room',
    image: 1,
    alt: '{name} en su habitación, mirando la lluvia',
    music: 'intro',
    enter: [bed('rain_window', 0.34), bed('city_night', 0.14)],
    lines: [
      { text: 'La lluvia golpeaba suavemente las ventanas de la ciudad.' },
      { text: 'Había sido otro día como cualquier otro. Las mismas calles, la misma sensación de que el tiempo pasaba demasiado rápido.' },
      { text: '{name} no estaba buscando una aventura. Le gustaba su pequeño mundo, sus cosas, sus momentos de tranquilidad.' },
      { text: 'Pero a veces se preguntaba cómo sería empezar algo completamente diferente.' },
    ],
  },
  {
    id: 'under_door',
    image: 2,
    alt: 'Una carta aparece bajo la puerta',
    music: 'intro',
    enter: [bed('city_night', 0.08), shot('paper_slide_on_wood', 0.62, 1.6)],
    lines: [
      { text: 'Aquella noche, mientras la ciudad dormía, algo interrumpió el sonido de la lluvia.' },
      {
        text: 'Un sobre había aparecido bajo su puerta.',
        cues: [shot('envelope_sliding', 0.42, 2.2), shot('paper_slide_on_wood', 0.62, 1.6)],
      },
      { text: 'Era de papel grueso, un poco amarillento. No tenía remitente.' },
      { text: 'Solo llevaba su nombre y un pequeño dibujo de tres estrellas.' },
    ],
  },
  {
    id: 'reading',
    image: 3,
    alt: '{name} abre y lee la carta en su habitación',
    music: 'intro',
    enter: [bed('city_night', 0)],
    letterAfter: 2,
    lines: [
      { text: '{name} abrió el sobre con curiosidad.', cues: [shot('paper_rustle', 0.5, 1.4)] },
      {
        text: 'Dentro había una carta escrita a mano, unas fotografías de un restaurante y una pequeña llave de metal.',
        cues: [shot('small_key_drop', 0.4, 1.3)],
      },
      { text: 'La carta hablaba de un pueblo llamado Villa Nori, de un restaurante de sushi junto al mar y de una oportunidad que parecía demasiado extraña para ser verdad.' },
      { text: 'Cuando terminó de leerla, {name} se quedó mirando las fotografías.' },
      { text: '¿Un restaurante? Pero si yo no sé nada de restaurantes...', who: 'player' },
      { text: 'Volvió a mirar la llave.' },
      { text: 'Aunque... podría ir a conocerlo.', who: 'player' },
    ],
  },
  {
    id: 'packing',
    image: 4,
    alt: '{name} prepara su valija',
    music: 'intro',
    enter: [bed('rain_window', 0.16)],
    lines: [
      { text: 'Esa noche casi no pudo dormir.' },
      { text: 'Buscó Villa Nori en un mapa. Era un pueblo pequeño, bastante lejos de la ciudad, al que se llegaba tomando un tren hasta la costa.' },
      { text: 'Todavía no sabía si aceptaría hacerse cargo del restaurante.' },
      { text: 'Pero había algo en aquella carta que no conseguía sacarse de la cabeza.' },
      {
        text: 'A la mañana siguiente, guardó algo de ropa, sus cosas favoritas y la llave en una pequeña valija.',
        cues: [shot('suitcase_zipper', 0.55, 2)],
      },
      { text: 'Bueno... supongo que voy a averiguarlo.', who: 'player', cues: [shot('wooden_footsteps', 0.4, 1.7)] },
    ],
  },
  {
    id: 'train',
    image: 5,
    alt: '{name} viaja en tren',
    music: 'intro',
    enter: [bed('rain_window', 0, 1.5), shot('steam_train', 0.5)],
    lines: [
      { text: 'El tren partió temprano.' },
      { text: 'Con cada estación, los edificios de la ciudad fueron desapareciendo.' },
      { text: 'Los reemplazaron montañas, bosques, pequeños ríos y casas escondidas entre los árboles.' },
      { text: '{name} miraba el paisaje desde la ventanilla.' },
      { text: 'Todavía tenía un montón de preguntas.' },
      { text: 'Pero hacía tiempo que no sentía tanta curiosidad por lo que vendría después.' },
    ],
  },
  {
    id: 'village',
    image: 6,
    alt: '{name} llega a Villa Nori',
    music: 'intro',
    enter: [
      { sound: 'steam_train', volume: 0, kind: 'shot', fade: 1.5, stop: true },
      bed('small_town', 0.4),
      bed('water_fountain', 0.2),
    ],
    lines: [
      { text: 'Cuando llegó a Villa Nori, el sol ya comenzaba a esconderse.' },
      { text: 'El pueblo parecía salido de un cuento.' },
      { text: 'Había árboles rosados, pequeños comercios de madera, faroles encendidos y una fuente en el centro de la plaza.' },
      { text: 'Algunos vecinos paseaban tranquilamente mientras otros cerraban sus tiendas.' },
      { text: '{name} respiró hondo.' },
      { text: 'Es... más lindo de lo que imaginaba.', who: 'player' },
      { text: 'Sacó la carta para comprobar la dirección.' },
      { text: 'Midnight Maki debía estar cerca.' },
    ],
  },
  {
    id: 'midnight',
    image: 7,
    alt: '{name} frente al restaurante Midnight Maki',
    music: 'intro',
    enter: [bed('water_fountain', 0.07, 1.8)],
    lines: [
      { text: 'Al final de uno de los caminos encontró una pequeña construcción de madera.' },
      { text: 'Sobre la entrada había un cartel antiguo: MIDNIGHT MAKI.' },
      { text: 'El edificio parecía necesitar algunas reparaciones, pero sus faroles estaban encendidos.' },
      { text: 'Y detrás de las ventanas se distinguían pequeñas sombras moviéndose.' },
      { text: '{name} se acercó a la puerta.', cues: [shot('wooden_footsteps', 0.36, 1.6)] },
      { text: 'Estaba a punto de sacar la llave cuando escuchó voces desde el interior.' },
      { text: '¿Hay alguien adentro...?', who: 'player' },
      { text: 'Respiró hondo y se acercó a la entrada.' },
    ],
  },
];

/** Cues for one moment. A one-shot plays once per scene, so advancing text does not replay it. */
export function takeCues(scene: IntroScene, at: CueAt, fired: Set<string>): IntroCue[] {
  const list = at === 'enter' ? scene.enter ?? [] : scene.lines[at]?.cues ?? [];
  const out: IntroCue[] = [];
  for (const cue of list) {
    if (cue.kind === 'bed' || cue.stop) {
      out.push(cue);
      continue;
    }
    const key = `${scene.id}:${cue.sound}`;
    if (fired.has(key)) continue;
    fired.add(key);
    out.push(cue);
  }
  return out;
}
