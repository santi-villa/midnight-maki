/** Lazily converts generated canvases into Phaser textures (cached by key). */
import Phaser from 'phaser';
import { buildCharacterSheet, FH, FRAME_COUNT, FW } from '../art/characters';
import { drawObject } from '../art/objects';
import { ctx2d, makeCanvas } from '../art/pixel';
import { buildTileset } from '../art/tiles';
import { iconCanvas, type IconSpec } from '../art/icons';
import { FURN_BY_ID } from '../data/furniture';
import { PROPS } from '../data/props';
import { appearanceKey, appearanceOf, dropOf } from '../systems/appearance';

const charKeys = new Map<string, string>(); // id -> current texture key

export function ensureTileset(scene: Phaser.Scene) {
  if (!scene.textures.exists('tiles')) scene.textures.addCanvas('tiles', buildTileset());
}

/** Returns a texture key for the character, regenerating it if their look changed. */
export function charTexture(scene: Phaser.Scene, id: string): string {
  const look = appearanceKey(id);
  const key = 'ch_' + hashStr(look);
  if (!scene.textures.exists(key)) {
    const sheet = buildCharacterSheet(appearanceOf(id), dropOf(id));
    const tex = scene.textures.addCanvas(key, sheet)!;
    for (let i = 0; i < FRAME_COUNT; i++) tex.add(i, 0, i * FW, 0, FW, FH);
  }
  const prev = charKeys.get(id);
  charKeys.set(id, key);
  if (prev && prev !== key && ![...charKeys.values()].includes(prev) && scene.textures.exists(prev)) {
    // keep memory bounded: old looks are discarded
    scene.time.delayedCall(100, () => scene.textures.exists(prev) && scene.textures.remove(prev));
  }
  return key;
}

/** Texture for an arbitrary appearance (generic customers). */
export function lookTexture(scene: Phaser.Scene, a: import('../core/types').Appearance): string {
  const key = 'lk_' + hashStr(JSON.stringify(a));
  if (!scene.textures.exists(key)) {
    const tex = scene.textures.addCanvas(key, buildCharacterSheet(a))!;
    for (let i = 0; i < FRAME_COUNT; i++) tex.add(i, 0, i * FW, 0, FW, FH);
  }
  return key;
}

export function propTexture(scene: Phaser.Scene, key: string): string {
  const k = 'pr_' + key;
  if (!scene.textures.exists(k)) {
    const d = PROPS[key];
    scene.textures.addCanvas(k, drawObject(d.kind, d.sw, d.sh, d.c1, d.c2, d.variant ?? 0, hashStr(key)));
  }
  return k;
}

export function furnTexture(scene: Phaser.Scene, id: string, rot = 0): string {
  const d = FURN_BY_ID[id];
  const variant = d.rotatable ? rot : d.variant ?? 0;
  const k = `fu_${id}_${variant}`;
  if (!scene.textures.exists(k)) scene.textures.addCanvas(k, drawObject(d.kind, d.w * 16, d.sh, d.c1, d.c2 || d.c1, variant, hashStr(id)));
  return k;
}

export function iconTexture(scene: Phaser.Scene, spec: IconSpec): string {
  const k = 'ic_' + hashStr(JSON.stringify(spec));
  if (!scene.textures.exists(k)) {
    const c = makeCanvas(16, 16);
    ctx2d(c).drawImage(iconCanvas(spec), 0, 0);
    scene.textures.addCanvas(k, c);
  }
  return k;
}

/** soft radial light used to cut holes in the night overlay */
export function lightTexture(scene: Phaser.Scene): string {
  if (!scene.textures.exists('light')) {
    const c = makeCanvas(64, 64);
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(32, 32, 2, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.6)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    scene.textures.addCanvas('light', c);
  }
  return 'light';
}

/** soft bloom sprite for additive light halos */
export function glowTexture(scene: Phaser.Scene): string {
  if (!scene.textures.exists('glow')) {
    const c = makeCanvas(64, 64);
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,0.85)');
    grad.addColorStop(0.3, 'rgba(255,255,255,0.35)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    scene.textures.addCanvas('glow', c);
  }
  return 'glow';
}

/** dark edges, clear center */
export function vignetteTexture(scene: Phaser.Scene): string {
  if (!scene.textures.exists('vignette')) {
    const c = makeCanvas(128, 128);
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(64, 64, 34, 64, 64, 92);
    grad.addColorStop(0, 'rgba(20,14,36,0)');
    grad.addColorStop(1, 'rgba(20,14,36,1)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    scene.textures.addCanvas('vignette', c);
  }
  return 'vignette';
}

export function dotTexture(scene: Phaser.Scene, key: string, color: string, w = 2, h = 2): string {
  if (!scene.textures.exists(key)) {
    const c = makeCanvas(w, h);
    const g = ctx2d(c);
    g.fillStyle = color;
    g.fillRect(0, 0, w, h);
    scene.textures.addCanvas(key, c);
  }
  return key;
}

/** Tiny ambient critters: 'bird' (2 frames) and 'cat' (2 frames), drawn as small pixel templates. */
export function critterTexture(scene: Phaser.Scene, kind: 'bird' | 'cat'): string {
  const key = 'cr_' + kind;
  if (scene.textures.exists(key)) return key;
  const B: Record<string, string> = { O: '#3a2a2a', b: '#8a6a50', w: '#f3e6c8', y: '#f2c66d', g: '#a59f9a', k: '#2a2230', p: '#e8a5ae' };
  const frames =
    kind === 'bird'
      ? [
          ['........', '...Obb..', '..Obbbk.', '.Obbwwy.', '.Obbbb..', '..O.O...'],
          ['..O..O..', '.Obbbbb.', '..Obbbk.', '...Owwy.', '....bb..', '...O.O..'],
        ]
      : [
          ['O.....O.....', 'gO...Og.....', 'ggggggg.....', 'gkggkgg..g..', 'gggpggggg...', '.ggggggg....', '.g.g..g.g...'],
          ['O.....O.....', 'gO...Og.....', 'ggggggg...g.', 'gkggkgg..g..', 'gggpggggg...', '.ggggggg....', '..g.gg.g....'],
        ];
  const w = frames[0][0].length;
  const h = frames[0].length;
  const c = makeCanvas(w * 2, h);
  const g = ctx2d(c);
  frames.forEach((rows, i) => rows.forEach((r, y) => [...r].forEach((ch, x) => {
    if (B[ch]) {
      g.fillStyle = B[ch];
      g.fillRect(i * w + x, y, 1, 1);
    }
  })));
  const tex = scene.textures.addCanvas(key, c)!;
  tex.add(0, 0, 0, 0, w, h);
  tex.add(1, 0, w, 0, w, h);
  return key;
}

export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
