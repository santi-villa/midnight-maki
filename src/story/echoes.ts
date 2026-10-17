/**
 * Echoes: a few of the story's choices come back some days later, as a scene with the same character and a small gift that depends
 * on what the player chose. Nothing here changes the story's path; it makes the choice recognisable hours afterwards.
 * Pure data + one function that finds the echo waiting for a character. The choices are recorded by `decide()` in story.ts.
 */
import { game } from '../core/state';

export type Line = [speaker: string, text: string, mood?: string];
export interface EchoVariant { lines: Line[]; items?: Record<string, number>; coins?: number; friendship?: number; energy?: number }
export interface Echo {
  id: string;
  who: string;
  /** the decision key (story.decisions[key]) and the flag that says the scene that asked it was finished */
  key: string;
  flag: string;
  /** days after the choice */
  after: number;
  variants: Record<string, EchoVariant>;
}

export const ECHOES: Echo[] = [
  {
    id: 'pip_heart', who: 'pip', key: 'pip_heart', flag: 'pip_heart', after: 3,
    variants: {
      hogar: {
        lines: [['pip', '{name}, ¿te acordás de lo que me dijiste? Que acá estoy seguro. Armé un rincón de siesta con tres almohadones. ¿Te sentás conmigo un ratito?', 'happy'], ['narr', 'Se quedan un rato en silencio, escuchando el arroz que hierve abajo. Descansás de verdad.']],
        energy: 25, friendship: 10,
      },
      recordar: {
        lines: [['pip', 'Estuve pensando en lo que me prometiste. Hoy me acordé de algo: Akio guardaba una caja detrás del estante de la cocina. Fui a mirar y... ¡había cosas!', 'surprised'], ['narr', 'Pip te entrega ingredientes de la caja de Akio.']],
        items: { rice: 3, nori: 3, salmon: 2 }, friendship: 10,
      },
    },
  },
  {
    id: 'rigg', who: 'rigg', key: 'rigg', flag: 'rigg_secret', after: 3,
    variants: {
      apoyo: {
        lines: [['rigg', 'Estuve repasando lo que me dijiste. Ya no llevo todo sola. Tomá, es para vos: té de jazmín. Ayuda a pensar.', 'happy']],
        items: { g_tea: 2 }, friendship: 15,
      },
      equipo: {
        lines: [['rigg', 'Los Detectives Nocturnos cerraron su primer caso: la gotera de la cocina. Spicy ya pidió uniformes.', 'smug'], ['rigg', 'Los honorarios. Un libro de acertijos y algo de plata. No lo gastes todo en pepinos.']],
        items: { g_book: 1 }, coins: 60,
      },
    },
  },
  {
    id: 'bento', who: 'bento', key: 'bento', flag: 'bento_confessed', after: 2,
    variants: {
      gratitud: {
        lines: [['bento', 'Esta mañana amasé de más y pensé en vos. Son dulces de la receta vieja de Akio. Para vos.', 'happy']],
        items: { g_candy: 2 }, friendship: 10,
      },
      pregunta: {
        lines: [['bento', 'Me preguntaste por qué no dije nada. Lo pensé mucho: me callé por miedo a que te fueras. Ya no. Contá conmigo para lo que sea.', 'sad']],
        friendship: 20, coins: 50,
      },
    },
  },
  {
    id: 'prologue', who: 'spicy', key: 'prologue_stay', flag: 'intro_done', after: 2,
    variants: {
      decidida: {
        lines: [['spicy', 'Jefa, dijiste que te quedabas, así que ya sos de la casa. Te guardé un poco de picante para el coraje.', 'happy']],
        items: { chili: 3 }, friendship: 10,
      },
      aprender: {
        lines: [['spicy', 'Dijiste que ibas a aprender. Hoy hay clase: el secreto es el arroz. Siempre el arroz. Llevate un poco para practicar.', 'smug']],
        items: { rice: 5, nori: 3 }, friendship: 10,
      },
    },
  },
];

/** Record a choice together with the day it was made. */
export function recordDecision(key: string, value: string) {
  const d = game.save.story.decisions;
  d[key] = value;
  d[`${key}_day`] = String(game.save.time.day);
}

/** The echo waiting to be played when the player talks to this character, if any. */
export function pendingEcho(who: string): { echo: Echo; variant: EchoVariant } | null {
  const d = game.save.story.decisions;
  for (const e of ECHOES) {
    if (e.who !== who || !game.has(e.flag) || game.has('echo_' + e.id)) continue;
    const chose = d[e.key];
    const day = Number(d[`${e.key}_day`]);
    // a choice from before this was recorded has no day: it counts as old enough
    if (!chose || !e.variants[chose]) continue;
    if (Number.isFinite(day) && game.save.time.day - day < e.after) continue;
    return { echo: e, variant: e.variants[chose] };
  }
  return null;
}
