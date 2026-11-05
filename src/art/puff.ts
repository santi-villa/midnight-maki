/**
 * A puff of smoke or steam that grows, takes shape and comes apart, drawn pixel by pixel (no scaling, so it keeps the
 * game's pixel grid). The frames come from the Pixelbolt recipe in `fx/puff.recipe.json`, which is the source to edit
 * and preview (`npx -y pixelbolt@0.11.0 inspect src/art/fx/puff.recipe.json --out <png>`). Each particle plays the
 * frames once over its life (scenes/textures.ts → puffTexture).
 * Colours: `l` the lit top, `m` the body, `d` the underside; smoke is grey stone, steam is warm cream (art/palette.ts).
 */
import recipe from './fx/puff.recipe.json';
import { PAL } from './palette';

export type PuffKind = 'smoke' | 'steam';

export const PUFF_W: number = recipe.width;
export const PUFF_H: number = recipe.height;
/** The grid of each frame, top to bottom; '.' is see-through. */
export const PUFF_FRAMES: readonly string[][] = recipe.frames.map((f) => f.ops[0].rows);

export const PUFF_COLORS: Record<PuffKind, Record<'l' | 'm' | 'd', string>> = {
  smoke: { l: PAL.white, m: PAL.stoneL, d: PAL.stone },
  steam: { l: PAL.white, m: PAL.cream, d: PAL.cream2 },
};

/** Every frame side by side in one strip (frame i starts at x = i × PUFF_W). */
export function paintPuffStrip(g: CanvasRenderingContext2D, kind: PuffKind) {
  const colors = PUFF_COLORS[kind];
  PUFF_FRAMES.forEach((rows, i) => rows.forEach((row, y) => [...row].forEach((ch, x) => {
    const c = colors[ch as 'l' | 'm' | 'd'];
    if (!c) return;
    g.fillStyle = c;
    g.fillRect(i * PUFF_W + x, y, 1, 1);
  })));
}
