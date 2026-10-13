/** Frames, sheets and portraits of the playable heroes (cached: the creator and the shops redraw them a lot). */
import type { Appearance } from '../core/types';
import { ctx2d, makeCanvas, type Ctx } from './pixel';
import { buildFolkPortrait, buildFolkSheet, folkFrame, FOLK_H, FOLK_PAD, FOLK_W, type FolkExpr, type FolkPose } from './folk';
import { heroSpec } from './hero';

export { FOLK_H as HERO_H, FOLK_W as HERO_W, FOLK_PAD as HERO_PAD };

/** Every human look is drawn by the hero renderer; the animal species keep the older renderers. */
export const isHeroLook = (a: Appearance) => a.species === 'human';

const frames = new Map<string, HTMLCanvasElement>();

export function heroFrame(a: Appearance, pose: FolkPose): HTMLCanvasElement {
  const key = JSON.stringify([a, pose]);
  let f = frames.get(key);
  if (!f) {
    if (frames.size > 600) frames.clear();
    f = folkFrame(heroSpec(a), pose);
    frames.set(key, f);
  }
  return f;
}

export function drawHero(ctx: Ctx, ox: number, oy: number, a: Appearance, pose: { dir: FolkPose['dir']; legs?: FolkPose['legs']; expr?: FolkExpr; bob?: number; sit?: boolean }) {
  ctx.drawImage(heroFrame(a, { legs: 'idle', expr: 'neutral', ...pose }), ox, oy);
}

export const heroSheet = (a: Appearance) => buildFolkSheet(heroSpec(a));
export const heroPortrait = (a: Appearance, expr: FolkExpr, scale = 5) => buildFolkPortrait(heroSpec(a), expr, scale);

/** Just the head and shoulders (creator option tiles). */
export function heroHeadshot(a: Appearance): HTMLCanvasElement {
  const f = heroFrame(a, { dir: 'down', legs: 'idle', expr: 'neutral' });
  const cv = makeCanvas(f.width, 26);
  ctx2d(cv).drawImage(f, 0, 5, f.width, 26, 0, 0, f.width, 26);
  return cv;
}
