/**
 * The small animals of the village, drawn in code like the birds (textures.ts critterTexture): each frame is a few rows of
 * letters, one per colour, with a dark outline added around the shape. All of them face right; the scene mirrors them.
 */
import Phaser from 'phaser';
import { ctx2d, makeCanvas, outline } from '../art/pixel';

export type WildKind = 'frog' | 'duck' | 'duckling' | 'crab' | 'squirrel' | 'dragonfly' | 'bee';

const INK = '#2b1d17';

const PALETTE: Record<WildKind, Record<string, string>> = {
  frog: { g: '#72b04c', G: '#4b8236', y: '#d9e89c', w: '#f6f1e6', k: INK, p: '#eef6c4' },
  duck: { b: '#c9a27a', d: '#946e4a', h: '#3f8a5a', H: '#2f6a46', y: '#f2a93a', w: '#f4efe4', k: INK },
  duckling: { Y: '#f6d55c', D: '#d9b23c', o: '#e8913a', k: INK },
  crab: { r: '#e0603e', R: '#a83c28', w: '#f6f1e6', k: INK },
  squirrel: { o: '#c47436', O: '#8a4a22', c: '#f2dcb4', n: '#8a5a2a', k: INK },
  dragonfly: { b: '#3a9ad8', B: '#246090', W: '#dff2ff', k: INK },
  bee: { y: '#f2c43a', k: INK, W: '#eef8ff' },
};

/** Frames per animal. The names after the frames say what each is for (see FRAME). */
const FRAMES: Record<WildKind, string[][]> = {
  frog: [
    // sit
    ['..ww.ww..', '..wk.wk..', '.ggggggg.', 'gGgggggGg', 'gyyyyyyyg', 'GG.....GG'],
    // crouch, about to jump
    ['.........', '..ww.ww..', '..wk.wk..', 'ggggggggg', 'gyyyyyyyg', 'GGG...GGG'],
    // in the air, legs stretched back
    ['..ww.ww..', '..wk.wk..', '.ggggggg.', '.gyyyyyg.', '..ggggg..', '.GG...GG.'],
    // croaking: the throat puffs out
    ['..ww.ww..', '..wk.wk..', '.ggggggg.', 'gGgppppGg', 'gyypppyyg', 'GG.....GG'],
  ],
  duck: [
    // swimming (the bottom row stays empty: the water hides the feet)
    ['.......hh..', '......hkhy.', '......hhyy.', '.bb...bH...', 'bbbbbbbbb..', 'dbwwwwbbd..', '.ddddddd...', '...........'],
    // swimming, the head bobs
    ['...........', '.......hh..', '......hkhy.', '.bb...hhyy.', 'bbbbbbbH...', 'dbwwwwbbd..', '.ddddddd...', '...........'],
    // dabbling: head under, tail up
    ['..b........', '.bbb.......', '.bbbbb.....', '..bbbbbb...', '...dddddd..', '.....dd....', '...........', '...........'],
    // walking on the bank: the feet show, one step and the other
    ['.......hh..', '......hkhy.', '......hhyy.', '.bb...bH...', 'bbbbbbbbb..', 'dbwwwwbbd..', '.ddddddd...', '...y..y....'],
    ['.......hh..', '......hkhy.', '......hhyy.', '.bb...bH...', 'bbbbbbbbb..', 'dbwwwwbbd..', '.ddddddd...', '..y....y...'],
    // pecking at the ground
    ['...........', '...........', '.bb........', 'bbbbbbbbb..', 'dbwwwwbbbh.', '.dddddddhkh', '.........yy', '...y..y....'],
  ],
  duckling: [
    ['...YY.', '...Yko', 'YY.YY.', 'YYYYY.', '.DDD..', '......'],
    ['......', '...YY.', 'YY.Yko', 'YYYYY.', '.DDD..', '......'],
    // waddling on the bank
    ['...YY.', '...Yko', 'YY.YY.', 'YYYYY.', '.DDD..', '.o..o.'],
    ['...YY.', '...Yko', 'YY.YY.', 'YYYYY.', '.DDD..', '..o.o.'],
  ],
  crab: [
    ['.k.....k.', '.w.....w.', 'r.rrrrr.r', 'rrrrrrrrr', '.RRRRRRR.', 'R.R...R.R'],
    ['.k.....k.', '.w.....w.', 'r.rrrrr.r', 'rrrrrrrrr', '.RRRRRRR.', '.R.R.R.R.'],
    // dug in: only the eyes stick out of the sand
    ['.........', '.........', '.........', '.........', '.k.....k.', '.w.....w.'],
  ],
  squirrel: [
    // running
    ['.OO.......', 'OooO......', 'Oooo...o..', '.Ooo..ooko', '..ooooocc.', '...occcc..', '...O..O...'],
    ['.OO.......', 'OooO......', 'Oooo...o..', '.Ooo..ooko', '..ooooocc.', '..occccc..', '.O.....O..'],
    // sitting up, nibbling
    ['.OO....o..', 'OooO..ook.', 'Oooo..occ.', '.Ooo.oocn.', '..Oooocc..', '...occc...', '...O.O....'],
  ],
  dragonfly: [
    ['.WW...WW.', 'WWWWbWWWW', '....b....', '....b....', '....B....'],
    ['.........', '.WWWbWWW.', 'WW..b..WW', '....b....', '....B....'],
  ],
  bee: [
    ['.W.W.', '.WkW.', 'kykyk', '.yky.'],
    ['.....', 'WWkWW', 'kykyk', '.yky.'],
  ],
};

/** Which frame does what, per animal. */
export const FRAME = {
  frog: { sit: 0, crouch: 1, air: 2, croak: 3 },
  duck: { swim: 0, bob: 1, dabble: 2, walkA: 3, walkB: 4, peck: 5 },
  duckling: { swim: 0, bob: 1, walkA: 2, walkB: 3 },
  crab: { a: 0, b: 1, hidden: 2 },
  squirrel: { runA: 0, runB: 1, sit: 2 },
  dragonfly: { up: 0, down: 1 },
  bee: { up: 0, down: 1 },
} as const;

/** The sprite sheet of one animal (frames side by side), made once. */
export function wildTexture(scene: Phaser.Scene, kind: WildKind): string {
  const key = 'wild_' + kind;
  if (scene.textures.exists(key)) return key;
  const frames = FRAMES[kind], pal = PALETTE[kind];
  const w = frames[0][0].length, h = frames[0].length;
  // wings are see-through: no outline around them, so they stay light
  const lineless = kind === 'dragonfly' || kind === 'bee';
  const c = makeCanvas((w + 2) * frames.length, h + 2), g = ctx2d(c);
  frames.forEach((rows, i) => {
    const f = makeCanvas(w + 2, h + 2), fg = ctx2d(f);
    rows.forEach((r, y) => [...r].forEach((ch, x) => {
      const col = pal[ch];
      if (!col) return;
      fg.globalAlpha = ch === 'W' ? 0.75 : 1;
      fg.fillStyle = col;
      fg.fillRect(x + 1, y + 1, 1, 1);
    }));
    fg.globalAlpha = 1;
    if (!lineless) outline(f, INK);
    g.drawImage(f, i * (w + 2), 0);
  });
  const tex = scene.textures.addCanvas(key, c)!;
  frames.forEach((_, i) => tex.add(i, 0, i * (w + 2), 0, w + 2, h + 2));
  return key;
}

/** Things that fall from the trees: a cherry petal, a green leaf, autumn leaves in three colours. */
export type FallKind = 'petal' | 'leaf' | 'autumn0' | 'autumn1' | 'autumn2';
const FALL: Record<FallKind, { rows: string[]; pal: Record<string, string> }> = {
  petal: { rows: ['.aa', 'aab', '.b.'], pal: { a: '#f9cad8', b: '#ee9fb8' } },
  leaf: { rows: ['..a', '.ab', 'ab.', 'b..'], pal: { a: '#9cc865', b: '#6c9c3e' } },
  autumn0: { rows: ['..a', '.ab', 'ab.', 'b..'], pal: { a: '#e8963e', b: '#b9622a' } },
  autumn1: { rows: ['..a', '.ab', 'ab.', 'b..'], pal: { a: '#d8563a', b: '#9c3424' } },
  autumn2: { rows: ['..a', '.ab', 'ab.', 'b..'], pal: { a: '#ecc04a', b: '#b98a2a' } },
};

export function fallTexture(scene: Phaser.Scene, kind: FallKind): string {
  const key = 'fall_' + kind;
  if (scene.textures.exists(key)) return key;
  const { rows, pal } = FALL[kind];
  const c = makeCanvas(rows[0].length, rows.length), g = ctx2d(c);
  rows.forEach((r, y) => [...r].forEach((ch, x) => { if (pal[ch]) { g.fillStyle = pal[ch]; g.fillRect(x, y, 1, 1); } }));
  scene.textures.addCanvas(key, c);
  return key;
}
