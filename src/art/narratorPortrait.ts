import { PixBuf } from './pixbuf';

/** Put an imported PNG URL here to replace the procedural portrait without changing dialogue. */
export const NARRATOR_PORTRAIT_IMAGE: string | null = null;

/** Moonlit ink and a feather quill, at the portraits' native pixel resolution. */
export function narratorPortrait(): PixBuf {
  const b = new PixBuf(32, 32);
  b.rect(2, 2, 28, 28, '#342c44').rect(3, 3, 26, 26, '#49415a');
  b.hline(4, 3, 24, '#74627a').hline(4, 28, 24, '#28263b');
  b.ellipse(11, 11, 6, 6, '#d0af70').ellipse(11, 10, 5, 5, '#f2dba4');
  b.ellipse(14, 8, 5, 5, '#49415a');
  b.set(23, 6, '#f2dba4').set(6, 20, '#b2a1bb').set(26, 16, '#b2a1bb');
  // Feather barbs rise diagonally; stepped edges stay crisp when scaled.
  for (let i = 0; i < 12; i++) {
    const x = 12 + i, y = 24 - i;
    const reach = i < 8 ? 3 : 2;
    b.hline(x - reach, y, reach * 2 + 1, '#b7b3cc');
    b.hline(x - reach, y - 1, reach, '#eee4cf');
    b.set(x, y, '#85778e');
  }
  b.rect(9, 25, 8, 3, '#242637').rect(10, 24, 6, 2, '#687384');
  b.hline(11, 24, 4, '#a6bac1').set(13, 23, '#ede2c4');
  return b;
}
