/**
 * Sleeping cats and the village dogs, drawn in code like the wild animals (wildlifeArt.ts): curled up or belly up, each in two breaths
 * (out, in). The colours are the cats' own from the pets atlas, so the sleeper is the same cat that was awake.
 */
import Phaser from 'phaser';
import { ctx2d, makeCanvas, outline } from '../art/pixel';

export type CatColor = 'cat_brown' | 'cat_white' | 'cat_siamese';
export type SleepPose = 'curl' | 'back';

const INK = '#2e2b27';
const PALETTE: Record<CatColor, Record<string, string>> = {
  cat_brown: { b: '#5d5852', s: '#4d4840', l: '#d8cec3', e: '#cfaca0', p: '#4d4840', c: '#759359', k: INK },
  cat_white: { b: '#e8e8e8', s: '#c8beb3', l: '#f6f4f0', e: '#cfaca0', p: '#d1ccc5', c: '#e08ec6', k: INK },
  cat_siamese: { b: '#d6c4ac', s: '#bba88e', l: '#e8dccb', e: '#cfaca0', p: '#463218', c: '#225664', k: INK },
};

/** b fur, s shade, l belly and muzzle, e inner ear, p points (ears, tail, paws), c collar, k closed eyes. Facing right. */
const FRAMES: string[][] = [
  // curled up, breathing out / in (the back rises)
  ['......................', '.............p....p...', '.....bbbbb..pep..pep..', '...bbbbbbbbbbbbbbbbb..', '..bbbbbbbbbsbbbbbbbbb.', '.bbbbbbbbbbsbkkbbbkkb.', '.bbbbbbbbbbsbbbbblbbb.', 'bbsbbbbbbbbbccbllllbb.', 'bssbbbbbbbbbbbbbbbbbs.', 'bsspppppppppppbbbbbss.', '.sssssssssssssspppp...'],
  ['......................', '....bbbbbb...p....p...', '..bbbbbbbbb.pep..pep..', '.bbbbbbbbbbbbbbbbbbb..', '.bbbbbbbbbbsbbbbbbbbb.', '.bbbbbbbbbbsbkkbbbkkb.', 'bbbbbbbbbbbsbbbbblbbb.', 'bbsbbbbbbbbbccbllllbb.', 'bssbbbbbbbbbbbbbbbbbs.', 'bsspppppppppppbbbbbss.', '.sssssssssssssspppp...'],
  // belly up, paws in the air, the head upside down (ears at the bottom)
  ['......................', '......................', '....l.l....l.l........', '....b.b....b.b........', '...bbbbbbbbbbbbb......', '..bblllllllllllbbbb...', '.bbllllllllllllblllb..', 'pbbllllllllllllbkbkb..', 'pbbblllllllllbbbbbbb..', '.pbbbbbbbbbbbbbebbeb..', '..ssssssssssssspssp...'],
  ['......................', '....l.l....l.l........', '....b.b....b.b........', '...bbbbbbbbbbbb.......', '..bbllllllllllbbb.....', '..bblllllllllllbbbb...', '.bbllllllllllllblllb..', 'pbbllllllllllllbkbkb..', 'pbbblllllllllbbbbbbb..', '.pbbbbbbbbbbbbbebbeb..', '..ssssssssssssspssp...'],
];

/** Frame index for a pose and a breath (0 out, 1 in). */
export function sleepFrame(pose: SleepPose, breath: 0 | 1): number {
  return (pose === 'curl' ? 0 : 2) + breath;
}

/** Breath in or out at `t` seconds: slow, a little longer out than in. */
export function breathAt(t: number, period = 2.4): 0 | 1 {
  const f = ((t % period) + period) % period / period;
  return f < 0.42 ? 1 : 0;
}

/** How many of the three z's show at `t` seconds: one, two, three, then they go in reverse (3, 2, 1) and a rest. */
export function zzzAt(t: number, step = 0.55): number {
  const seq = [1, 2, 3, 3, 2, 1, 0, 0];
  return seq[Math.floor(((t / step) % seq.length + seq.length) % seq.length)];
}

export function sleepCatTexture(scene: Phaser.Scene, cat: CatColor): string {
  const key = 'sleep_' + cat;
  return scene.textures.exists(key) ? key : sheet(scene, key, FRAMES, PALETTE[cat]);
}

/** The village dogs: a shiba and a black and white one. o fur, O ears, c cream, k eye, n nose, t tongue, r collar. Facing right. */
export type DogCoat = 'shiba' | 'patch';
const DOG_PALETTE: Record<DogCoat, Record<string, string>> = {
  shiba: { o: '#d98a4a', O: '#a8602e', c: '#f4e2c4', k: INK, n: INK, t: '#e07a8a', r: '#c8483a' },
  patch: { o: '#3a3634', O: '#262322', c: '#eeeae2', k: '#120f0e', n: '#120f0e', t: '#e07a8a', r: '#3a86c8' },
};
const DOG_FRAMES: string[][] = [
  // sit
  ['............O...O...', '............OO.OO...', '...........ooooooo..', '...........ookooccc.', '...........oooocccn.', '.o..........rrrcc...', '.oo........oooocc...', '..oo......ooooocc...', '...o.....oooooocc...', '...ooooooooooooc....', '...ooooooooooocc....', '...ccoooooooo.c.c...', '...cc.......cc.cc...'],
  // pant
  ['............O...O...', '............OO.OO...', '...........ooooooo..', '...........ookooccc.', '...........oooocccn.', '.o..........rrrcct..', '.oo........oooocct..', '..oo......ooooocc...', '...o.....oooooocc...', '...ooooooooooooc....', '...ooooooooooocc....', '...ccoooooooo.c.c...', '...cc.......cc.cc...'],
  // runA
  ['..............O...O.', '..............OO.OO.', '.o...........ooooooo', '.oo..........ookoocc', '..oo.........ooooccn', '...o..........rrrc..', '...oooooooooooooo...', '...ooooooooooooocc..', '...oooooooooooocc...', '...cccccccccccccc...', '..oc..............co', '.oc................c', '....................'],
  // runB
  ['....................', '..............O...O.', '.o............OO.OO.', '.oo..........ooooooo', '..oo.........ookoocc', '...o.........ooooccn', '...oooooooooooorrc..', '...ooooooooooooocc..', '...oooooooooooocc...', '...cccccccccccccc...', '....oc.......co.....', '....cc.......cc.....', '....................'],
  // bow
  ['....................', '.o..................', '.oo.................', '..oo................', '...ooooo........O..O', '...oooooooo.....OOOO', '...ooooooooooooooooo', '...oooooooooooookooc', '...ccccccccccccooocn', '...oc.co....rrrccc..', '...oc.co..cccccccc..', '...cc.cc..cc....cc..', '....................'],
  // lie
  ['....................', '....................', '....................', '....................', '....................', '...........O...O....', '..........ooooooo...', '..........ooOooOcc..', '..ooooooooooooocccn.', '.ooooooooooooooccc..', 'oooooooooooooocccc..', 'occcccccccccccccc...', '....................'],
  // lieB
  ['....................', '....................', '....................', '....................', '....................', '...........O...O....', '..........ooooooo...', '..ooooo...ooOooOcc..', '.ooooooooooooocccn..', '.ooooooooooooooccc..', 'oooooooooooooocccc..', 'occcccccccccccccc...', '....................'],
];
/** sit and pant alternate when it waits; run A/B; bow is the play bow ("throw it!"); lie and lieB are a sleeping breath. */
export const DOG_FRAME = { sit: 0, pant: 1, runA: 2, runB: 3, bow: 4, lie: 5, lieB: 6 } as const;

function sheet(scene: Phaser.Scene, key: string, frames: string[][], pal: Record<string, string>) {
  const w = frames[0][0].length, h = frames[0].length;
  const c = makeCanvas((w + 2) * frames.length, h + 2), g = ctx2d(c);
  frames.forEach((rows, i) => {
    const f = makeCanvas(w + 2, h + 2), fg = ctx2d(f);
    rows.forEach((r, y) => [...r].forEach((ch, x) => {
      if (!pal[ch]) return;
      fg.fillStyle = pal[ch];
      fg.fillRect(x + 1, y + 1, 1, 1);
    }));
    outline(f, INK);
    g.drawImage(f, i * (w + 2), 0);
  });
  const tex = scene.textures.addCanvas(key, c)!;
  frames.forEach((_, i) => tex.add(i, 0, i * (w + 2), 0, w + 2, h + 2));
  return key;
}

export function dogTexture(scene: Phaser.Scene, coat: DogCoat): string {
  const key = 'dog_' + coat;
  return scene.textures.exists(key) ? key : sheet(scene, key, DOG_FRAMES, DOG_PALETTE[coat]);
}

/** A red rubber ball with a light stripe. */
export function ballTexture(scene: Phaser.Scene): string {
  const key = 'dog_ball';
  return scene.textures.exists(key) ? key : sheet(scene, key, [['.rr.', 'rwrr', 'rrRr', '.RR.']], { r: '#d8503a', R: '#9c3424', w: '#f6e7c8' });
}
