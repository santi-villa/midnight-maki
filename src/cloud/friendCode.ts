/** Friend codes and the postcards a friend can send. Pure data, no Firebase. */

/** No 0/O, 1/I/L: a code read out loud or typed on a phone should not be ambiguous. */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 6;

export function generateCode(rand: () => number = Math.random): string {
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i++) out += ALPHABET[Math.floor(rand() * ALPHABET.length)];
  return out;
}

/** Accepts what a person types: lowercase, spaces, dashes. Returns null when it cannot be a code. */
export function normalizeCode(input: string): string | null {
  const c = input.toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
  const fixed = [...c].map((ch) => (ch === '0' || ch === '1' ? '?' : ch)).join('');
  if (c.length !== CODE_LENGTH || fixed.includes('?')) return null;
  return [...c].every((ch) => ALPHABET.includes(ch)) ? c : null;
}

export interface PostcardDef { id: string; icon: string; text: string }
/** Fixed messages only: nothing a player types ever reaches another player. */
export const POSTCARDS: PostcardDef[] = [
  { id: 'hello', icon: 'heart', text: '¡Hola! Pasá cuando quieras por mi restaurante.' },
  { id: 'delicious', icon: 'maki', text: '¡Tu restaurante se ve delicioso!' },
  { id: 'thanks', icon: 'gift', text: '¡Gracias por ser mi amigo!' },
  { id: 'luck', icon: 'coin', text: '¡Mucha suerte con tus pedidos de hoy!' },
  { id: 'rest', icon: 'bed', text: 'Descansá un poco, te lo merecés.' },
  { id: 'proud', icon: 'clipboard', text: '¡Qué buen trabajo en la cocina!' },
  { id: 'fish', icon: 'act', text: '¡Hoy pesqué algo increíble! Contame cómo te va.' },
  { id: 'miss', icon: 'talk', text: 'Te extraño por el pueblo. ¡Volvé pronto!' },
];
export const POSTCARD_BY_ID: Record<string, PostcardDef> = Object.fromEntries(POSTCARDS.map((p) => [p.id, p]));
