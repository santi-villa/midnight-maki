/**
 * Procedural layered character renderer.
 * Every character (player, raccoons, villagers) is composed from: back layer (tail, long hair, cape),
 * body template (skin/clothes/shoes), face, clothing details, hair, ears, face accessory and head accessory.
 * Frames are 16x24 px. Optional `drop` rows make smaller / stubbier characters (e.g. Pip).
 */
import type { Appearance, Dir, Species } from '../core/types';
import { CLOTHES_BY_ID } from '../data/clothes';
import { ctx2d, drawTemplate, makeCanvas, px, shade, type Ctx } from './pixel';

export const FW = 16;
export const FH = 24;

export type Expr = 'neutral' | 'blink' | 'happy' | 'surprised' | 'sad' | 'smug' | 'sleep';
export type Legs = 'idle' | 'a' | 'b';

// ------------------------------------------------------------------ body templates
const HEAD = [
  '................',
  '................',
  '................',
  '.....OOOOOO.....',
  '...OOSSSSSSOO...',
  '..OSSSSSSSSSSO..',
  '.OSSSSSSSSSSSSO.',
  '.OSSSSSSSSSSSSO.',
  '.OSSSSSSSSSSSSO.',
  '.OSSSSSSSSSSSSO.',
  '.OSSSSSSSSSSSSO.',
  '.OSSSSSSSSSSSSO.',
  '..OSSSSSSSSSSO..',
  '...OOSSSSSSOO...',
];

const BODY_FRONT = [
  '.....OOSSOO.....',
  '....OTTTTTTO....',
  '...OATTTTTTAO...',
  '...OATTTTTTAO...',
  '...OATTTTTTAO...',
  '...OhBBBBBBhO...',
  '....OBBBBBBO....',
];
const LEGS_FRONT: Record<Legs, string[]> = {
  idle: ['....OLLOOLLO....', '....OFFOOFFO....', '....OOOOOOOO....'],
  a: ['....OLLOOFFO....', '....OFFOOOOO....', '....OOOO........'],
  b: ['....OFFOOLLO....', '....OOOOOFFO....', '........OOOO....'],
};
const BODY_SIDE = [
  '......OSSO......',
  '.....OTTTTO.....',
  '.....OTTTTO.....',
  '.....OTATTO.....',
  '.....OTATTO.....',
  '.....OBhBBO.....',
  '.....OBBBBO.....',
];
const LEGS_SIDE: Record<Legs, string[]> = {
  idle: ['.....OLLLLO.....', '.....OFFFFFO....', '.....OOOOOOO....'],
  a: ['....OLLOOLLO....', '....OFFFOFFFO...', '....OOOOOOOOO...'],
  b: ['.....OLLLLO.....', '.....OFFFFFO....', '.....OOOOOOO....'],
};

/** mirror an 8-wide half template into 16-wide */
const mirror = (rows: string[]) => rows.map((r) => r + r.split('').reverse().join(''));

// ------------------------------------------------------------------ hair styles
interface HairStyle {
  name: string;
  front: string[]; // half template, starting at row 0
  back?: string[]; // half template drawn behind body (long hair), starts at row 12
  tail?: { side: string[]; up: string[]; sideY: number; upY: number }; // ponytail extras
}

export const HAIR_STYLES: HairStyle[] = [
  {
    name: 'Melena corta',
    front: [
      '........', '........', '.....OOO', '...OOHHH', '..OHHHHH', '.OHHHHHH', '.OHHHHHH', '.OHHhHHh',
      '.OHh....', '.OHh....', '.OHh....', '.OHh....', '..OH....',
    ],
  },
  {
    name: 'Pelo largo',
    front: [
      '........', '........', '.....OOO', '...OOHHH', '..OHHHHH', '.OHHHHHH', '.OHHHHHH', '.OHHhHHh',
      '.OHh....', '.OHh....', '.OHh....', '.OHh....', '.OHh....',
    ],
    back: ['.OHh....', '.OHh....', '.OHH....', '.OHh....', '.OHH....', '..OO....'],
  },
  {
    name: 'Corto',
    front: [
      '........', '........', '.....OOO', '...OOHHH', '..OHHhHH', '.OHHHHHH', '.OHHHhHH', '.OHhOHhO',
      '.OH.....', '.Oh.....',
    ],
  },
  {
    name: 'Rodetes',
    front: [
      '.OOO....', 'OHHHO...', 'OHhHOOOO', '.OOOOHHH', '..OHHHHH', '.OHHHHHH', '.OHHHHHH', '.OHHhHHh',
      '.OHh....', '.OH.....', '.OH.....',
    ],
  },
  {
    name: 'Colita',
    front: [
      '........', '........', '.....OOO', '...OOHHH', '..OHHHHH', '.OHHHHHH', '.OHHHHHH', '.OHHhHHh',
      '.OHh....', '.OH.....', '.OH.....',
    ],
    tail: {
      side: ['.OO.', 'OHHO', 'OHhO', 'OHHO', 'OhHO', 'OHHO', '.OHO', '..O.'],
      up: ['.OO.', 'OHHO', 'OHhO', 'OHHO', 'OhHO', 'OHHO', '.OO.'],
      sideY: 6,
      upY: 9,
    },
  },
  {
    name: 'Rulos',
    front: [
      '........', '....OOOO', '..OOHHHH', '.OHHhHHH', 'OHhHHHhH', 'OHHHHHHH', 'OHHhHHHH', 'OHHHhHHh',
      'OHhH....', 'OHHh....', 'OHhH....', '.OHH....', '..OO....',
    ],
  },
  { name: 'Sin peinado', front: [] },
];

function fullCoverage(rows: string[]): string[] {
  // fills the inside of each row between the first and last non-transparent pixel (back of head)
  return rows.map((r) => {
    const a = r.search(/[^.]/);
    if (a < 0) return r;
    const b = r.length - 1 - r.split('').reverse().join('').search(/[^.]/);
    let out = '';
    for (let i = 0; i < r.length; i++) {
      if (i < a || i > b) out += '.';
      else if (i === a || i === b) out += r[i] === '.' ? 'O' : r[i];
      else out += r[i] === '.' || r[i] === 'O' ? 'H' : r[i];
    }
    return out;
  });
}

function hairDown(s: HairStyle) {
  return mirror(s.front.map((r) => r.padEnd(8, '.')));
}
function hairUp(s: HairStyle) {
  const rows = fullCoverage(hairDown(s));
  // close the bottom so the back of the head is fully covered down to row 12
  if (rows.length) {
    while (rows.length < 13) rows.push('.OHHHHHHHHHHHHO.');
    rows[12] = '..OHHHHhhHHHHO..';
    rows.push('...OOHHHHHHOO...');
  }
  return rows;
}
function hairSide(s: HairStyle) {
  const full = fullCoverage(hairDown(s));
  return full.map((r, y) => {
    if (y < 8) return r;
    // keep only the back half (left) of the head visible below the bangs
    return r
      .split('')
      .map((ch, x) => (x <= 7 ? ch : '.'))
      .join('');
  });
}

// ------------------------------------------------------------------ ears & species
const EARS: Partial<Record<Species, string[]>> = {
  cat: ['........', '..O.....', '..OO....', '..OIO...', '..OIIO..', '..OSSO..'],
  fox: ['..O.....', '..OO....', '..OIO...', '..OIIO..', '..OSSSO.'],
  bunny: ['...OO...', '..OIIO..', '..OIIO..', '..OIIO..', '..OSSO..'],
  bear: ['........', '........', '.OOO....', 'OSISO...', 'OSSSO...'],
  raccoon: ['........', '..OO....', '.OWWO...', '.OWIWO..', '.OSSSO..'],
  owl: ['........', '........', '..O.....', '..OIO...', '...OIO..'],
  squirrel: ['........', '..O.....', '..OIO...', '..OIIO..', '..OSSO..'],
  otter: ['........', '........', '........', '........', '........', '.OO.....', 'OIIO....'],
  dog: ['........', '........', '........', '........', '.OO.....', 'OIIO....', 'OIIO....', 'OIIO....', '.OO.....'],
};

const MUZZLE: Partial<Record<Species, boolean>> = { raccoon: true, fox: true, dog: true, bear: true, otter: true };

const TAILS: Partial<Record<Species, { down: string[]; side: string[]; up: string[] }>> = {
  raccoon: {
    down: ['.OO.', 'OTTO', 'ODDO', 'OTTO', 'ODDO', '.OO.'],
    side: ['..OOOO..', '.OTTDDO.', 'OTTDDTTO', 'ODDTTO..', '.OOO....'],
    up: ['.OOO.', 'OTDTO', 'ODTDO', 'OTDTO', 'ODTDO', '.ODO.', '..O..'],
  },
  fox: {
    down: ['.OO.', 'OTTO', 'OTTO', 'OTTO', 'OWWO', '.OO.'],
    side: ['..OOOO..', '.OTTTTO.', 'OWTTTTTO', 'OWWTTO..', '.OOO....'],
    up: ['.OOO.', 'OTTTO', 'OTTTO', 'OTTTO', 'OWWWO', '.OWO.', '..O..'],
  },
  cat: {
    down: ['.O', 'OT', 'OT', 'OT', 'OO'],
    side: ['....OO..', '...OTO..', '..OTO...', '.OTO....', '.OO.....'],
    up: ['..O..', '.OTO.', '.OTO.', '.OTO.', '..O..'],
  },
  squirrel: {
    down: ['.OOO', 'OTTT', 'OTTO', 'OTTO', 'OTTO', '.OO.'],
    side: ['.OOOO...', 'OTTTTO..', 'OTTTTTO.', 'OTTTTO..', '.OTTO...', '..OO....'],
    up: ['.OOO.', 'OTTTO', 'OTTTO', 'OTTTO', '.OTO.', '..O..'],
  },
  dog: { down: ['.O', 'OT', 'OO'], side: ['.OO.', 'OTO.', '.OO.'], up: ['.O.', 'OTO', '.O.'] },
  bunny: { down: ['OO', 'OO'], side: ['.OO', 'OWWO', '.OO.'], up: ['.OO.', 'OWWO', '.OO.'] },
  otter: {
    down: ['.O', 'OT', 'OT', 'OO'],
    side: ['.....OO.', '..OOOTO.', '.OTTTO..', '.OOO....'],
    up: ['.O.', 'OTO', 'OTO', '.O.'],
  },
};

// ------------------------------------------------------------------ helpers
interface Colors {
  skin: string;
  skinO: string;
  top: string;
  top2: string;
  arm: string;
  bottom: string;
  bottom2: string;
  leg: string;
  shoe: string;
  hair: string;
}

function colorsFor(a: Appearance): Colors {
  const top = CLOTHES_BY_ID[a.top];
  const bot = CLOTHES_BY_ID[a.bottom];
  const sh = CLOTHES_BY_ID[a.shoes];
  const skin = a.skin;
  const topC = top?.c1 ?? skin;
  const shortSleeve = !top || top.kind === 'tee' || top.kind === 'tank';
  const longLegs = bot && ['pants', 'overalls', 'hakama'].includes(bot.kind);
  return {
    skin,
    skinO: shade(skin, -0.55),
    top: topC,
    top2: top?.c2 ?? shade(topC, -0.15),
    arm: shortSleeve ? skin : topC,
    bottom: bot?.c1 ?? shade(skin, -0.1),
    bottom2: bot?.c2 ?? shade(bot?.c1 ?? skin, -0.2),
    leg: longLegs ? bot!.c1 : skin,
    shoe: sh?.c1 ?? shade(skin, -0.3),
    hair: a.hairColor,
  };
}

function frontView(dir: Dir) {
  return dir === 'down' || dir === 'up';
}

// ------------------------------------------------------------------ main composer
export interface FrameOpts {
  dir: Dir;
  legs: Legs;
  expr: Expr;
}

export function drawCharacter(ctx: Ctx, ox: number, oy: number, a: Appearance, o: FrameOpts): void {
  const col = colorsFor(a);
  const side = !frontView(o.dir);
  const flip = o.dir === 'left';
  // Draw into a temp canvas facing right, then mirror for left to keep templates simple.
  const tmp = makeCanvas(FW, FH);
  const t = ctx2d(tmp);
  const dir: Dir = o.dir === 'left' ? 'right' : o.dir;

  const style = HAIR_STYLES[a.species === 'human' || a.hairStyle < HAIR_STYLES.length ? a.hairStyle : HAIR_STYLES.length - 1] ?? HAIR_STYLES[0];
  const hairPal = { H: col.hair, h: shade(col.hair, -0.18), O: shade(col.hair, -0.6) };

  // ---------- back layer
  drawTail(t, a, dir, col);
  if (style.back && dir !== 'up') {
    const rows = dir === 'down' ? mirror(style.back) : mirror(style.back).map((r) => r.slice(0, 8).padEnd(16, '.'));
    drawTemplate(t, rows, hairPal, 0, 12);
  }
  const extra = CLOTHES_BY_ID[a.extra];
  if (extra?.kind === 'cape' && dir !== 'up') {
    px(t, dir === 'down' ? 3 : 3, 15, extra.c1, dir === 'down' ? 10 : 4, 7);
    px(t, dir === 'down' ? 3 : 3, 21, shade(extra.c1, -0.3), dir === 'down' ? 10 : 4, 1);
  }
  const bag = CLOTHES_BY_ID[a.bag];
  if (bag && dir === 'right') drawBagBack(t, bag.kind, bag.c1, bag.c2 ?? bag.c1, 'side');

  // ---------- body
  const pal: Record<string, string> = {
    O: col.skinO, S: col.skin, T: col.top, A: col.arm, B: col.bottom, h: col.skin, L: col.leg, F: col.shoe,
  };
  const mk = a.marks;
  if (mk?.arms) {
    if (!a.top) {
      pal.A = mk.arms;
      pal.h = mk.arms;
    }
    if (!a.shoes) pal.F = mk.arms;
    if (!a.bottom) pal.L = mk.arms;
  }
  drawTemplate(t, HEAD, pal, 0, 0);
  const body = side ? BODY_SIDE : BODY_FRONT;
  drawTemplate(t, body, pal, 0, 14);
  drawTemplate(t, (side ? LEGS_SIDE : LEGS_FRONT)[o.legs], pal, 0, 21);
  if (mk?.belly && !a.top && dir !== 'up') {
    if (side) px(t, 8, 16, mk.belly, 2, 3);
    else {
      px(t, 6, 15, mk.belly, 4, 4);
      px(t, 7, 19, mk.belly, 2, 1);
    }
  }
  drawBottomDetails(t, a, dir, col, o.legs);
  drawTopDetails(t, a, dir, col);
  drawShoeDetails(t, a, dir, o.legs);

  // ---------- face (not visible from the back)
  if (dir !== 'up') drawFace(t, a, dir, o.expr, col);

  // ---------- extras over the torso
  if (extra) drawExtra(t, extra.kind, extra.c1, extra.c2 ?? extra.c1, dir);
  if (bag && dir !== 'right') drawBagBack(t, bag.kind, bag.c1, bag.c2 ?? bag.c1, dir === 'up' ? 'up' : 'down');

  // ---------- hair
  if (style.front.length) {
    const rows = dir === 'down' ? hairDown(style) : dir === 'up' ? hairUp(style) : hairSide(style);
    drawTemplate(t, rows, hairPal, 0, 0);
    if (style.back && dir === 'up') drawTemplate(t, mirror(style.back).map((r) => r.replace(/\./g, (c, i) => (i > 2 && i < 13 ? 'H' : c))), hairPal, 0, 12);
    if (style.tail) {
      if (dir === 'right') drawTemplate(t, style.tail.side, hairPal, 0, style.tail.sideY);
      if (dir === 'up') drawTemplate(t, style.tail.up, hairPal, 6, style.tail.upY);
    }
  }

  // ---------- ears
  const ears = EARS[a.species];
  if (ears) {
    const ePal = { O: col.skinO, S: col.skin, I: earInner(a.species, col.skin), W: a.marks?.ear ?? shade(col.skin, 0.55) };
    if (side) drawTemplate(t, ears, ePal, 3, 0);
    else drawTemplate(t, mirror(ears), ePal, 0, 0);
  }

  // ---------- accessories
  const face = CLOTHES_BY_ID[a.face];
  if (face && dir !== 'up') drawFaceAcc(t, face.kind, face.c1, face.c2 ?? face.c1, dir);
  const head = CLOTHES_BY_ID[a.head];
  if (head) drawHeadAcc(t, head.kind, head.c1, head.c2 ?? head.c1, dir);

  if (flip) {
    ctx.save();
    ctx.translate(ox + FW, oy);
    ctx.scale(-1, 1);
    ctx.drawImage(tmp, 0, 0);
    ctx.restore();
  } else ctx.drawImage(tmp, ox, oy);
}

function earInner(s: Species, skin: string) {
  if (s === 'raccoon') return '#2f2a33';
  if (s === 'fox') return '#3a2a2a';
  if (s === 'dog' || s === 'otter') return shade(skin, -0.3);
  if (s === 'owl') return shade(skin, -0.25);
  return '#e8a5ae';
}

function drawTail(t: Ctx, a: Appearance, dir: Dir, col: Colors) {
  const tail = TAILS[a.species];
  if (!tail) return;
  const pal = { O: col.skinO, T: col.skin, D: '#3a3440', W: '#f6ecd6' };
  if (dir === 'down') drawTemplate(t, tail.down, pal, 12, 16);
  else if (dir === 'right') drawTemplate(t, tail.side, pal, 0, 15);
  // up: drawn in front later? Tail is in front of the back: draw now; body covers only centre so offset low
  else if (dir === 'up') drawTemplate(t, tail.up, pal, 6, 17);
}

function drawFace(t: Ctx, a: Appearance, dir: Dir, expr: Expr, col: Colors) {
  // on a dark raccoon mask, closed/happy eyes are drawn as light strokes so they stay visible
  const K = a.species === 'raccoon' ? '#2a2230' : '#2a2230';
  const KL = a.species === 'raccoon' ? '#d8d2de' : '#2a2230';
  const E = a.eyeColor;
  const W = '#ffffff';
  const skin = col.skin;
  const side = dir === 'right';
  const eyes: [number, number][] = side ? [[10, 9]] : [[4, 9], [10, 9]];

  // species face markings
  if (a.species === 'raccoon') {
    const mk = a.marks ?? {};
    const m = mk.mask ?? '#3a3440';
    if (mk.stripe && !side) px(t, 7, 3, mk.stripe, 2, 5);
    if (mk.stripe && side) px(t, 8, 3, mk.stripe, 2, 4);
    if (mk.face) {
      // light fur around the eye patches and brows
      if (side) {
        px(t, 8, 7, mk.face, 6, 5);
      } else {
        px(t, 2, 7, mk.face, 12, 5);
        px(t, 3, 12, mk.face, 10, 1);
      }
    }
    if (side) {
      px(t, 9, 8, m, 4, 3);
      px(t, 10, 11, m, 2, 1);
    } else {
      // rounded patches like the plushies
      px(t, 3, 8, m, 4, 3);
      px(t, 9, 8, m, 4, 3);
      px(t, 2, 9, m, 1, 2);
      px(t, 13, 9, m, 1, 2);
      px(t, 4, 11, m, 2, 1);
      px(t, 10, 11, m, 2, 1);
    }
  }
  if (a.species === 'owl') {
    const disc = shade(skin, 0.35);
    if (side) px(t, 9, 8, disc, 4, 4);
    else {
      px(t, 3, 8, disc, 4, 4);
      px(t, 9, 8, disc, 4, 4);
    }
  }
  if (MUZZLE[a.species]) {
    const mz = a.marks?.face ?? shade(skin, 0.5);
    if (side) {
      px(t, 11, 10, mz, 4, 3);
      px(t, 14, 10, '#2a2230', 1, 1);
    } else {
      px(t, 5, 11, mz, 6, 2);
      px(t, 6, 10, mz, 4, 1);
      px(t, 7, 10, '#2a2230', 2, 1);
    }
  }

  const eyeLight = a.species === 'raccoon' ? shade(E, 0.25) : E;
  for (const [x, y] of eyes) {
    switch (expr) {
      case 'blink':
      case 'sleep':
        px(t, x, y + 1, KL, 2, 1);
        break;
      case 'happy':
        px(t, x, y + 1, KL);
        px(t, x + 1, y, KL);
        px(t, x + 2 > 13 ? x + 1 : x + 2, y + 1, KL);
        break;
      case 'surprised':
        px(t, x, y - 1, K, 2, 1);
        px(t, x, y, eyeLight, 2, 2);
        px(t, x + 1, y, W);
        break;
      case 'sad':
        px(t, x, y, K, 2, 1);
        px(t, x, y + 1, eyeLight, 2, 1);
        px(t, x + (x < 8 ? -1 : 2), y - 1, shade(skin, -0.35));
        break;
      case 'smug':
        px(t, x, y, shade(skin, -0.3), 2, 1);
        px(t, x, y + 1, K, 2, 1);
        break;
      default:
        drawEyeStyle(t, a.eyes, x, y, K, eyeLight, W);
    }
  }

  // blush
  const blush = '#e58f98';
  if (a.species !== 'raccoon' && a.species !== 'owl') {
    if (side) px(t, 9, 11, blush);
    else {
      px(t, 3, 11, blush);
      px(t, 12, 11, blush);
    }
  }
  // mouth
  const mouth = '#8e3e46';
  const my = MUZZLE[a.species] ? 12 : 11;
  if (a.species === 'owl') {
    if (side) px(t, 13, 10, '#e2a84a', 2, 2);
    else {
      px(t, 7, 10, '#e2a84a', 2, 1);
      px(t, 7, 11, '#c98d32', 2, 1);
    }
    return;
  }
  if (side) {
    if (expr === 'surprised') px(t, 12, my, mouth, 1, 1);
    else if (expr === 'happy') px(t, 11, my, mouth, 2, 1);
    else px(t, 12, my, mouth);
    return;
  }
  switch (expr) {
    case 'surprised':
      px(t, 7, my, mouth, 2, 2);
      break;
    case 'happy':
      px(t, 6, my, mouth);
      px(t, 7, my + 1 > 12 ? my : my + 1, mouth, 2, 1);
      px(t, 9, my, mouth);
      break;
    case 'sad':
      px(t, 7, my, mouth, 2, 1);
      px(t, 6, my + (my < 12 ? 1 : 0), mouth);
      px(t, 9, my + (my < 12 ? 1 : 0), mouth);
      break;
    case 'smug':
      px(t, 8, my, mouth, 2, 1);
      px(t, 10, my - 1, mouth);
      break;
    case 'sleep':
      px(t, 7, my, mouth, 1, 1);
      break;
    default:
      px(t, 7, my, mouth, 2, 1);
  }
}

export const EYE_STYLES = ['Redondos', 'Puntitos', 'Brillantes', 'Serenos', 'Pestañas'];

function drawEyeStyle(t: Ctx, style: number, x: number, y: number, K: string, E: string, W: string) {
  switch (style) {
    case 1:
      px(t, x + (x < 8 ? 1 : 0), y, K, 1, 2);
      break;
    case 2:
      px(t, x, y - 1, K, 2, 1);
      px(t, x, y, E, 2, 2);
      px(t, x + 1, y, W);
      px(t, x, y + 1, shade(E, 0.3));
      break;
    case 3:
      px(t, x, y + 1, K, 2, 1);
      px(t, x, y, shade(E, -0.1), 2, 1);
      break;
    case 4:
      px(t, x, y, K, 2, 1);
      px(t, x, y + 1, E, 2, 1);
      px(t, x + 1, y, W);
      px(t, x < 8 ? x - 1 : x + 2, y - 1, K);
      break;
    default:
      px(t, x, y, K, 2, 1);
      px(t, x, y + 1, E, 2, 1);
      px(t, x + 1, y, W);
  }
}

function drawTopDetails(t: Ctx, a: Appearance, dir: Dir, col: Colors) {
  const top = CLOTHES_BY_ID[a.top];
  if (!top) return;
  const c2 = col.top2;
  const side = dir === 'right';
  const back = dir === 'up';
  switch (top.kind) {
    case 'tee':
      if (!side) {
        px(t, 4, 16, col.top);
        px(t, 11, 16, col.top);
      } else px(t, 7, 16, col.top);
      break;
    case 'tank':
      if (!side) {
        px(t, 5, 15, col.skin);
        px(t, 10, 15, col.skin);
      }
      break;
    case 'stripes':
      if (!side) {
        px(t, 5, 16, c2, 6, 1);
        px(t, 5, 18, c2, 6, 1);
      } else {
        px(t, 6, 16, c2, 4, 1);
        px(t, 6, 18, c2, 4, 1);
      }
      break;
    case 'sweater':
      if (!side) px(t, 5, 18, c2, 6, 1);
      else px(t, 6, 18, c2, 4, 1);
      if (!side && !back) px(t, 6, 15, c2, 4, 1);
      break;
    case 'hoodie':
      if (back) px(t, 5, 15, c2, 6, 2);
      else if (!side) {
        px(t, 5, 15, c2);
        px(t, 10, 15, c2);
        px(t, 6, 18, c2, 4, 1);
        px(t, 7, 16, c2, 1, 1);
        px(t, 8, 16, c2, 1, 1);
      } else px(t, 6, 15, c2, 2, 2);
      break;
    case 'cardigan':
      if (!side && !back) px(t, 7, 15, c2, 2, 4);
      break;
    case 'kimono':
      if (!side && !back) {
        px(t, 6, 15, c2);
        px(t, 9, 15, c2);
        px(t, 7, 16, c2);
        px(t, 8, 17, c2);
      }
      if (!side) px(t, 5, 18, shade(col.top, -0.35), 6, 1);
      else px(t, 6, 18, shade(col.top, -0.35), 4, 1);
      if (!side) {
        px(t, 3, 17, col.top, 1, 2);
        px(t, 12, 17, col.top, 1, 2);
      }
      break;
    case 'chef':
      if (!side && !back) {
        px(t, 6, 16, c2);
        px(t, 6, 18, c2);
        px(t, 9, 16, c2);
        px(t, 9, 18, c2);
        px(t, 6, 15, c2, 4, 1);
      }
      break;
    case 'pajama': {
      const dots = side ? [[7, 15], [8, 17], [6, 18]] : [[5, 16], [8, 17], [10, 15], [6, 18], [9, 18]];
      for (const [x, y] of dots) px(t, x, y, c2);
      break;
    }
    case 'coat':
      if (!side && !back) {
        px(t, 5, 15, c2, 6, 1);
        px(t, 7, 16, c2);
        px(t, 7, 18, c2);
      }
      if (!side) px(t, 4, 19, col.top, 8, 1);
      break;
    case 'long':
      if (!side && !back) px(t, 7, 15, c2, 2, 1);
      break;
  }
}

function drawBottomDetails(t: Ctx, a: Appearance, dir: Dir, col: Colors, legs: Legs) {
  const bot = CLOTHES_BY_ID[a.bottom];
  if (!bot) return;
  const side = dir === 'right';
  const O = shade(bot.c1, -0.55);
  switch (bot.kind) {
    case 'skirt':
      if (!side) {
        px(t, 3, 20, O, 10, 1);
        px(t, 4, 20, bot.c1, 8, 1);
        px(t, 4, 21, O, 8, 1);
        px(t, 5, 19, col.bottom2, 1, 2);
        px(t, 8, 19, col.bottom2, 1, 2);
      } else {
        px(t, 5, 20, bot.c1, 6, 1);
        px(t, 4, 20, O);
        px(t, 11, 20, O);
        px(t, 5, 21, O, 6, 1);
      }
      break;
    case 'dress':
      if (!side) {
        px(t, 5, 17, bot.c1, 6, 2);
        px(t, 3, 20, O, 10, 2);
        px(t, 4, 20, bot.c1, 8, 1);
        px(t, 4, 21, bot.c2 ?? bot.c1, 8, 1);
        px(t, 4, 22, O, 8, 1);
        if (legs !== 'idle') px(t, legs === 'a' ? 5 : 9, 22, col.skin, 2, 1);
      } else {
        px(t, 6, 17, bot.c1, 4, 2);
        px(t, 4, 20, O, 8, 2);
        px(t, 5, 20, bot.c1, 6, 1);
        px(t, 5, 21, bot.c2 ?? bot.c1, 6, 1);
        px(t, 5, 22, O, 6, 1);
      }
      break;
    case 'overalls':
      if (dir === 'down') {
        px(t, 6, 16, bot.c1, 4, 3);
        px(t, 6, 15, bot.c1);
        px(t, 9, 15, bot.c1);
        px(t, 7, 17, bot.c2 ?? '#f2c66d');
      } else if (dir === 'up') {
        px(t, 6, 15, bot.c1, 1, 4);
        px(t, 9, 15, bot.c1, 1, 4);
      } else px(t, 7, 15, bot.c1, 2, 4);
      break;
    case 'hakama':
      if (!side) {
        px(t, 3, 21, O, 10, 1);
        px(t, 4, 21, bot.c1, 8, 1);
        px(t, 7, 19, bot.c2 ?? O, 2, 2);
      } else {
        px(t, 4, 21, O, 8, 1);
        px(t, 5, 21, bot.c1, 6, 1);
      }
      break;
    case 'pants':
      if (!side && bot.id === 'bot_pajama') px(t, 6, 19, bot.c2 ?? O, 1, 1);
      break;
  }
}

function drawShoeDetails(t: Ctx, a: Appearance, dir: Dir, legs: Legs) {
  const sh = CLOTHES_BY_ID[a.shoes];
  if (!sh) return;
  const side = dir === 'right';
  if (sh.kind === 'boots') {
    if (!side) {
      if (legs !== 'b') px(t, 5, 21, sh.c1, 2, 1);
      if (legs !== 'a') px(t, 9, 21, sh.c1, 2, 1);
    } else px(t, 6, 21, sh.c1, 4, 1);
  } else if (sh.kind === 'slippers' && !side && legs === 'idle') {
    px(t, 5, 22, sh.c2 ?? '#e8b8c0');
    px(t, 10, 22, sh.c2 ?? '#e8b8c0');
  } else if (sh.kind === 'sandals' && !side && legs === 'idle') {
    px(t, 5, 22, sh.c2 ?? '#b2585e', 2, 1);
    px(t, 9, 22, sh.c2 ?? '#b2585e', 2, 1);
  }
}

function drawExtra(t: Ctx, kind: string, c1: string, c2: string, dir: Dir) {
  const side = dir === 'right';
  switch (kind) {
    case 'scarf':
      if (!side) {
        px(t, 4, 14, c1, 8, 2);
        px(t, 4, 15, c2, 8, 1);
        if (dir === 'down') px(t, 9, 16, c1, 2, 2);
        else px(t, 6, 16, c1, 2, 2);
      } else {
        px(t, 5, 14, c1, 6, 2);
        px(t, 5, 15, c2, 6, 1);
        px(t, 4, 16, c1, 2, 2);
      }
      break;
    case 'apron':
      if (dir === 'down') {
        px(t, 6, 15, c1, 1, 1);
        px(t, 9, 15, c1, 1, 1);
        px(t, 5, 16, c1, 6, 5);
        px(t, 7, 18, c2, 2, 1);
      } else if (dir === 'up') px(t, 5, 18, c1, 6, 1);
      else px(t, 9, 16, c1, 1, 5);
      break;
    case 'necklace':
      if (dir === 'down') {
        px(t, 6, 15, c1);
        px(t, 9, 15, c1);
        px(t, 7, 16, c2, 2, 1);
      }
      break;
    case 'cape':
      if (dir === 'up') {
        px(t, 3, 15, c1, 10, 7);
        px(t, 3, 21, shade(c1, -0.3), 10, 1);
        px(t, 7, 15, c2, 2, 1);
      } else if (dir === 'down') {
        px(t, 5, 15, c2, 1, 1);
        px(t, 10, 15, c2, 1, 1);
      }
      break;
  }
}

function drawBagBack(t: Ctx, kind: string, c1: string, c2: string, view: 'down' | 'up' | 'side') {
  if (kind === 'satchel') {
    if (view === 'down') {
      px(t, 5, 15, c2);
      px(t, 6, 16, c2);
      px(t, 7, 17, c2);
      px(t, 8, 18, c1, 3, 2);
    } else if (view === 'up') {
      px(t, 10, 15, c2);
      px(t, 9, 16, c2);
      px(t, 8, 17, c2);
      px(t, 5, 18, c1, 3, 2);
    } else px(t, 7, 18, c1, 3, 2);
    return;
  }
  // backpack (and raccoon pack)
  if (view === 'down') {
    px(t, 5, 15, c2, 1, 3);
    px(t, 10, 15, c2, 1, 3);
  } else if (view === 'up') {
    px(t, 4, 15, shade(c1, -0.5), 8, 6);
    px(t, 5, 15, c1, 6, 5);
    px(t, 6, 17, c2, 4, 2);
    if (kind === 'raccoonpack') {
      px(t, 5, 14, c1);
      px(t, 10, 14, c1);
      px(t, 6, 16, '#3a3440', 4, 1);
    }
  } else {
    px(t, 3, 15, shade(c1, -0.5), 4, 6);
    px(t, 3, 16, c1, 3, 4);
    px(t, 3, 18, c2, 3, 1);
  }
}

function drawFaceAcc(t: Ctx, kind: string, c1: string, c2: string, dir: Dir) {
  const side = dir === 'right';
  switch (kind) {
    case 'glasses':
    case 'roundglasses':
    case 'sunglasses': {
      const lens = kind === 'sunglasses' ? c2 : undefined;
      const boxes = side ? [9] : [3, 9];
      for (const x of boxes) {
        if (kind === 'roundglasses') {
          px(t, x + 1, 8, c1, 2, 1);
          px(t, x + 1, 11, c1, 2, 1);
          px(t, x, 9, c1, 1, 2);
          px(t, x + 3, 9, c1, 1, 2);
        } else {
          px(t, x, 8, c1, 4, 1);
          px(t, x, 8, c1, 1, 3);
          px(t, x + 3, 8, c1, 1, 3);
          px(t, x, 10, c1, 4, 1);
        }
        if (lens) px(t, x + 1, 9, lens, 2, 1 + (kind === 'sunglasses' ? 1 : 0));
      }
      if (!side) px(t, 7, 9, c1, 2, 1);
      else px(t, 5, 9, c1, 4, 1);
      break;
    }
    case 'blush':
      if (side) px(t, 9, 11, c1, 2, 1);
      else {
        px(t, 2, 11, c1, 3, 1);
        px(t, 11, 11, c1, 3, 1);
      }
      break;
  }
}

function drawHeadAcc(t: Ctx, kind: string, c1: string, c2: string, dir: Dir) {
  const O = shade(c1, -0.55);
  const side = dir === 'right';
  const back = dir === 'up';
  switch (kind) {
    case 'beanie':
      px(t, 3, 2, O, 10, 1);
      px(t, 2, 3, O, 12, 4);
      px(t, 3, 3, c1, 10, 3);
      px(t, 2, 6, c2, 12, 1);
      for (let x = 4; x < 13; x += 2) px(t, x, 4, shade(c1, -0.15), 1, 2);
      px(t, 7, 0, c2, 2, 2);
      break;
    case 'chefhat':
      px(t, 3, 0, O, 10, 1);
      px(t, 2, 1, O, 12, 3);
      px(t, 3, 1, c1, 10, 3);
      px(t, 5, 2, c2, 1, 1);
      px(t, 9, 1, c2, 1, 1);
      px(t, 3, 4, O, 10, 3);
      px(t, 4, 4, c1, 8, 2);
      px(t, 4, 5, c2, 8, 1);
      break;
    case 'beret':
      px(t, 2, 3, O, 12, 3);
      px(t, 3, 2, O, 9, 1);
      px(t, 3, 3, c1, 10, 2);
      px(t, side ? 4 : 7, 1, O, 2, 1);
      break;
    case 'straw':
      px(t, 4, 1, O, 8, 1);
      px(t, 4, 2, c1, 8, 3);
      px(t, 3, 2, O, 1, 3);
      px(t, 12, 2, O, 1, 3);
      px(t, 4, 4, c2, 8, 1);
      px(t, 0, 5, O, 16, 2);
      px(t, 1, 5, c1, 14, 1);
      break;
    case 'bow': {
      const x = back ? 3 : side ? 4 : 10;
      px(t, x, 3, O, 5, 3);
      px(t, x + 1, 3, c1, 1, 3);
      px(t, x + 3, 3, c1, 1, 3);
      px(t, x + 2, 4, c2, 1, 1);
      break;
    }
    case 'flower':
    case 'starclip': {
      const x = back ? 3 : side ? 5 : 11;
      if (kind === 'flower') {
        px(t, x, 4, c1, 3, 1);
        px(t, x + 1, 3, c1, 1, 3);
        px(t, x + 1, 4, c2);
      } else {
        px(t, x + 1, 3, c1);
        px(t, x, 4, c1, 3, 1);
        px(t, x, 5, c1);
        px(t, x + 2, 5, c1);
        px(t, x + 1, 4, '#fff6c8');
      }
      break;
    }
    case 'catears':
      px(t, 2, 4, O, 12, 1);
      for (const x of [3, 10]) {
        px(t, x, 1, O, 3, 3);
        px(t, x + 1, 0, O, 1, 1);
        px(t, x + 1, 2, c2, 1, 1);
      }
      break;
    case 'witch':
      px(t, 6, 0, O, 4, 1);
      px(t, 5, 1, O, 6, 3);
      px(t, 6, 1, c1, 4, 3);
      px(t, 5, 3, c2, 6, 1);
      px(t, 0, 4, O, 16, 2);
      px(t, 1, 4, c1, 14, 1);
      break;
    case 'frog':
    case 'raccoonhat':
      // hood framing the face (face area left uncovered)
      px(t, 3, 2, O, 10, 1);
      if (back) {
        px(t, 1, 3, O, 14, 10);
        px(t, 2, 3, c1, 12, 9);
      } else if (side) {
        px(t, 1, 3, O, 9, 10);
        px(t, 2, 3, c1, 8, 4);
        px(t, 2, 7, c1, 5, 5);
        px(t, 7, 7, shade(c1, 0.25), 1, 5);
      } else {
        px(t, 1, 3, O, 14, 4);
        px(t, 2, 3, c1, 12, 4);
        px(t, 1, 7, O, 2, 6);
        px(t, 13, 7, O, 2, 6);
        px(t, 2, 7, c1, 1, 5);
        px(t, 13, 7, c1, 1, 5);
        px(t, 3, 7, shade(c1, 0.25), 10, 1);
      }
      if (kind === 'frog') {
        for (const x of side ? [8] : [2, 10]) {
          px(t, x, 0, O, 4, 3);
          px(t, x + 1, 0, '#f6ecd6', 2, 2);
          px(t, x + 1, 1, '#2a2230', 1, 1);
        }
      } else {
        for (const x of side ? [5] : [2, 11]) {
          px(t, x, 0, O, 3, 3);
          px(t, x + 1, 1, c2, 1, 1);
        }
        if (!back) px(t, side ? 9 : 3, 6, c2, side ? 5 : 10, 1);
      }
      break;
    case 'bandana':
      px(t, 2, 4, O, 12, 3);
      px(t, 2, 5, c1, 12, 1);
      px(t, 3, 4, c1, 10, 1);
      px(t, 6, 5, c2);
      px(t, 10, 5, c2);
      if (side || back) px(t, side ? 1 : 7, 6, c1, 2, 2);
      break;
  }
}

// ------------------------------------------------------------------ sheets
/** Frame layout of every generated character sheet. */
export const FRAMES = {
  down: [0, 1, 0, 2],
  up: [3, 4, 3, 5],
  right: [6, 7, 6, 8],
  left: [9, 10, 9, 11],
  blinkDown: 12,
  happy: 13,
  surprised: 14,
  sleep: 15,
  blinkRight: 16,
  blinkLeft: 17,
  sad: 18,
  smug: 19,
  // breathing: same pose with the upper body 1px lower
  breathe: { down: 20, up: 21, right: 22, left: 23 },
} as const;
export const FRAME_COUNT = 24;

/**
 * Builds a horizontal sheet of FRAME_COUNT frames for the appearance.
 * `drop` lists frame rows to remove (makes a shorter character), content is bottom-aligned.
 */
export function buildCharacterSheet(a: Appearance, drop: number[] = []): HTMLCanvasElement {
  const sheet = makeCanvas(FW * FRAME_COUNT, FH);
  const ctx = ctx2d(sheet);
  const specs: FrameOpts[] = [
    { dir: 'down', legs: 'idle', expr: 'neutral' },
    { dir: 'down', legs: 'a', expr: 'neutral' },
    { dir: 'down', legs: 'b', expr: 'neutral' },
    { dir: 'up', legs: 'idle', expr: 'neutral' },
    { dir: 'up', legs: 'a', expr: 'neutral' },
    { dir: 'up', legs: 'b', expr: 'neutral' },
    { dir: 'right', legs: 'idle', expr: 'neutral' },
    { dir: 'right', legs: 'a', expr: 'neutral' },
    { dir: 'right', legs: 'b', expr: 'neutral' },
    { dir: 'left', legs: 'idle', expr: 'neutral' },
    { dir: 'left', legs: 'a', expr: 'neutral' },
    { dir: 'left', legs: 'b', expr: 'neutral' },
    { dir: 'down', legs: 'idle', expr: 'blink' },
    { dir: 'down', legs: 'idle', expr: 'happy' },
    { dir: 'down', legs: 'idle', expr: 'surprised' },
    { dir: 'down', legs: 'idle', expr: 'sleep' },
    { dir: 'right', legs: 'idle', expr: 'blink' },
    { dir: 'left', legs: 'idle', expr: 'blink' },
    { dir: 'down', legs: 'idle', expr: 'sad' },
    { dir: 'down', legs: 'idle', expr: 'smug' },
    { dir: 'down', legs: 'idle', expr: 'neutral' },
    { dir: 'up', legs: 'idle', expr: 'neutral' },
    { dir: 'right', legs: 'idle', expr: 'neutral' },
    { dir: 'left', legs: 'idle', expr: 'neutral' },
  ];
  const frame = makeCanvas(FW, FH);
  const fctx = ctx2d(frame);
  specs.forEach((s, i) => {
    fctx.clearRect(0, 0, FW, FH);
    drawCharacter(fctx, 0, 0, a, s);
    // walk frames bob up 1px, breathing frames sink 1px: both shift the upper body only
    const shift = s.legs !== 'idle' ? -1 : i >= 20 ? 1 : 0;
    if (shift) {
      const tmp = makeCanvas(FW, FH);
      const tg = ctx2d(tmp);
      tg.drawImage(frame, 0, 0);
      fctx.clearRect(0, 0, FW, 20);
      fctx.drawImage(tmp, 0, 0, FW, 20, 0, shift, FW, 20);
      if (shift < 0) fctx.drawImage(tmp, 0, 19, FW, 1, 0, 19, FW, 1);
    }
    if (!drop.length) ctx.drawImage(frame, i * FW, 0);
    else {
      let dy = FH - 1;
      for (let y = FH - 1; y >= 0; y--) {
        if (drop.includes(y)) continue;
        ctx.drawImage(frame, 0, y, FW, 1, i * FW, dy, FW, 1);
        dy--;
      }
    }
  });
  return sheet;
}

/** Portrait: upscaled head+shoulders crop with a given expression. */
export function buildPortrait(a: Appearance, expr: Expr, drop: number[] = [], scale = 5): HTMLCanvasElement {
  const frame = makeCanvas(FW, FH);
  const f = ctx2d(frame);
  drawCharacter(f, 0, 0, a, { dir: 'down', legs: 'idle', expr });
  let src = frame;
  if (drop.length) {
    src = makeCanvas(FW, FH);
    const s = ctx2d(src);
    let dy = FH - 1;
    for (let y = FH - 1; y >= 0; y--) {
      if (drop.includes(y)) continue;
      s.drawImage(frame, 0, y, FW, 1, 0, dy, FW, 1);
      dy--;
    }
  }
  // find first opaque row to crop tight on the head
  const data = ctx2d(src).getImageData(0, 0, FW, FH).data;
  let top = 0;
  outer: for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) if (data[(y * FW + x) * 4 + 3]) { top = y; break outer; }
  const h = 18;
  const out = makeCanvas(FW * scale + 2 * scale, h * scale + scale);
  const o = ctx2d(out);
  o.drawImage(src, 0, Math.max(0, top - 1), FW, h, scale, scale, FW * scale, h * scale);
  return out;
}
