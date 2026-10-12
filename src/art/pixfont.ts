/** Tiny 3x5 pixel font for in-world signs (uppercase, digits, arrows, Spanish accents). */
import { px, type Ctx } from './pixel';

const G: Record<string, string> = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111',
  F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010',
  K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010',
  P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
  U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010',
  Z: '111001010100111', Ñ: '110101101101101',
  '0': '111101101101111', '1': '010110010010111', '2': '110001010100111', '3': '110001010001110', '4': '101101111001001',
  '5': '111100110001110', '6': '011100111101111', '7': '111001010010010', '8': '111101111101111', '9': '111101111001110',
  '←': '001011111011001', '→': '100110111110100', '↑': '010111010010010', '↓': '010010010111010', '.': '000000000000010',
  '-': '000000111000000', "'": '010010000000000', '&': '010101010101011',
};
/** wider glyphs (rows of variable width) for letters that don't read at 3px */
const WIDE: Record<string, string[]> = {
  M: ['10001', '11011', '10101', '10001', '10001'],
  N: ['1001', '1101', '1011', '1001', '1001'],
  W: ['10001', '10001', '10101', '11011', '10001'],
  Ñ: ['1001', '1101', '1011', '1001', '1001'],
};
const ACCENT: Record<string, string> = { Á: 'A', É: 'E', Í: 'I', Ó: 'O', Ú: 'U' };

/** Width in px of a text drawn with drawPixText (glyph 3 + 1 spacing; spaces 2). */
export function pixTextWidth(text: string): number {
  let w = 0;
  for (const ch of text.toUpperCase()) w += ch === ' ' ? 3 : (WIDE[ch]?.[0].length ?? 3) + 1;
  return Math.max(0, w - 1);
}

/** Draws uppercase text; (x, y) is the top-left of the 5px tall line (accents use the row above). */
export function drawPixText(c: Ctx, text: string, x: number, y: number, color: string, shadow?: string) {
  let cx = x;
  for (const raw of text.toUpperCase()) {
    if (raw === ' ') {
      cx += 3;
      continue;
    }
    const base = ACCENT[raw] ?? raw;
    const wide = WIDE[base];
    if (wide) {
      wide.forEach((row, j) => [...row].forEach((v, i) => {
        if (v !== '1') return;
        if (shadow) px(c, cx + i, y + j + 1, shadow);
        px(c, cx + i, y + j, color);
      }));
      if (raw === 'Ñ') px(c, cx, y - 2, color, wide[0].length, 1);
      cx += wide[0].length + 1;
      continue;
    }
    const g = G[base];
    if (!g) {
      cx += 4;
      continue;
    }
    for (let j = 0; j < 5; j++)
      for (let i = 0; i < 3; i++) {
        if (g[j * 3 + i] !== '1') continue;
        if (shadow) px(c, cx + i, y + j + 1, shadow);
        px(c, cx + i, y + j, color);
      }
    if (raw === 'Ñ') px(c, cx, y - 2, color, 3, 1);
    if (ACCENT[raw]) px(c, cx + 2, y - 2, color);
    cx += 4;
  }
}

/** Wooden plaque with centred text; returns nothing, draws at (cx, top). */
export function drawPlaque(c: Ctx, cx: number, top: number, text: string, opts: { wood?: string; ink?: string; pad?: number } = {}) {
  const pad = opts.pad ?? 3;
  const tw = pixTextWidth(text);
  const w = tw + pad * 2 + 2;
  const x = Math.round(cx - w / 2);
  const ink = '#2b1d17';
  px(c, x, top, ink, w, 11);
  px(c, x + 1, top + 1, opts.wood ?? '#e2c08c', w - 2, 9);
  px(c, x + 1, top + 1, '#f0d7a8', w - 2, 1);
  px(c, x + 1, top + 9, '#b9925e', w - 2, 1);
  drawPixText(c, text, x + pad + 1, top + 3, opts.ink ?? '#3a2418');
}
