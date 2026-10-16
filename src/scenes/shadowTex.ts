/**
 * Cast shadows as real shapes: the sprite's silhouette flipped onto the ground, squashed by the sun's height and
 * sheared so the tip leans away from the light while the base stays on the feet. Phaser has no skew, so the sheared
 * silhouette is baked into a small texture, cached by (sprite frame, lean, squash). The shadow fades towards the tip.
 */
import Phaser from 'phaser';

const PREFIX = 'sh|';
let epoch = 0;
/** Changes whenever the baked shadows were thrown away: sprites holding one must ask for theirs again. */
export const castEpoch = () => epoch;

/** Lean (px at the tip) and squash, rounded so a handful of textures cover the whole day. */
export function quantize(reach: number, squash: number): { reach: number; squash: number } {
  return { reach: Math.max(-14, Math.min(14, Math.round(reach))), squash: Math.max(0.1, Math.min(0.7, Math.round(squash * 20) / 20)) };
}

/** Key of the baked shadow for this frame, created on first use. Null when the source has no drawable image. */
export function castKey(scene: Phaser.Scene, texKey: string, frameName: string | number, reach: number, squash: number, flipX = false): string | null {
  const q = quantize(reach, squash);
  const key = `${PREFIX}${texKey}|${frameName}|${q.reach}|${q.squash}|${flipX ? 1 : 0}`;
  if (scene.textures.exists(key)) return key;
  const tex = scene.textures.get(texKey);
  if (!tex || tex.key === '__MISSING') return null;
  const frame = tex.get(frameName);
  const src = frame?.source?.image as CanvasImageSource | undefined;
  if (!frame || !src) return null;
  const w = frame.cutWidth, H = frame.cutHeight;
  const lean = Math.abs(q.reach);
  const cw = w + 2 * (lean + 2), ch = Math.max(2, Math.ceil(H * q.squash) + 2);
  const c = document.createElement('canvas');
  c.width = cw; c.height = ch;
  const g = c.getContext('2d');
  if (!g) return null;
  g.imageSmoothingEnabled = false;
  // source (x, y down) -> shadow: y' = (H - y) * squash, x' = x + lean * (H - y) / H, centred on the canvas
  const sx = flipX ? -1 : 1;
  g.setTransform(sx, 0, -q.reach / H, -q.squash, flipX ? cw / 2 + w / 2 + q.reach : cw / 2 - w / 2 + q.reach, q.squash * H);
  g.drawImage(src, frame.cutX, frame.cutY, w, H, 0, 0, w, H);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = '#140c24';
  g.fillRect(0, 0, cw, ch);
  // fade: dark at the feet, lighter towards the tip
  g.globalCompositeOperation = 'destination-in';
  const grad = g.createLinearGradient(0, 0, 0, ch);
  grad.addColorStop(0, 'rgba(0,0,0,1)'); grad.addColorStop(1, 'rgba(0,0,0,0.35)');
  g.fillStyle = grad;
  g.fillRect(0, 0, cw, ch);
  scene.textures.addCanvas(key, c);
  return key;
}

/** Throw the baked shadows away once there are many of them. Whatever still shows one is pointed at the blank default first. */
export function trimCasts(scene: Phaser.Scene, limit = 300) {
  const keys = scene.textures.getTextureKeys().filter((k) => k.startsWith(PREFIX));
  if (keys.length <= limit) return false;
  epoch++;
  for (const o of scene.children.list as Phaser.GameObjects.Image[]) {
    if (o.texture && o.texture.key.startsWith(PREFIX)) { o.setTexture('__DEFAULT'); o.setVisible(false); }
  }
  for (const k of keys) scene.textures.remove(k);
  return true;
}
