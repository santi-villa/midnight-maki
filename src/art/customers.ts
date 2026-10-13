import { PixBuf } from './pixbuf';

// Clientes independientes: no se cargan ni aparecen en ninguna escena todavía.
// Mismo formato procedural que los otros personajes; cada cuadro mide 28×40.
export const CUSTOMER_W = 28;
export const CUSTOMER_H = 40;

export type CustomerId = 'oli' | 'toby' | 'fredi' | 'pipo' | 'po' | 'gigi' | 'nico' | 'leo';

interface CustomerStyle {
  id: CustomerId;
  name: string;
  species: string;
  fur: string;
  light: string;
  shade: string;
  shirt: string;
  shirtLight: string;
  shirtShade: string;
}

export const CUSTOMERS: readonly CustomerStyle[] = [
  { id: 'oli', name: 'Oli', species: 'Cerdito', fur: '#e9a2a5', light: '#f7bfc0', shade: '#bd717e', shirt: '#46728b', shirtLight: '#6c96ac', shirtShade: '#304958' },
  { id: 'toby', name: 'Toby', species: 'Koala', fur: '#9b9ca6', light: '#bfc1c8', shade: '#747583', shirt: '#b75550', shirtLight: '#db7a6b', shirtShade: '#873e40' },
  { id: 'fredi', name: 'Fredi', species: 'Zorro', fur: '#c77538', light: '#e99a52', shade: '#97512e', shirt: '#62824f', shirtLight: '#8da56b', shirtShade: '#435d3e' },
  { id: 'pipo', name: 'Pipo', species: 'Pingüino', fur: '#343e51', light: '#566277', shade: '#242b3b', shirt: '#c35d32', shirtLight: '#ef9050', shirtShade: '#8d3f2b' },
  { id: 'po', name: 'Po', species: 'Panda', fur: '#e3e4dc', light: '#f9f6e9', shade: '#b9c4c3', shirt: '#53656a', shirtLight: '#78888b', shirtShade: '#39464e' },
  { id: 'gigi', name: 'Gigi', species: 'Jirafa', fur: '#d9ae54', light: '#f2d17b', shade: '#a2773d', shirt: '#806844', shirtLight: '#a18a58', shirtShade: '#584834' },
  { id: 'nico', name: 'Nico', species: 'Capibara', fur: '#986743', light: '#b98c5b', shade: '#704b35', shirt: '#7b8050', shirtLight: '#9a9b67', shirtShade: '#555b3d' },
  { id: 'leo', name: 'Leo', species: 'León', fur: '#ddad4e', light: '#f4ce72', shade: '#ad7b35', shirt: '#a94337', shirtLight: '#d66345', shirtShade: '#77322e' },
];

const OUT = '#302a32';
const CREAM = '#f2e9d4';
const INK = '#292b38';
const PINK = '#c47480';
const SHOE = '#483732';

export interface CustomerAnimation {
  frames: readonly number[];
  frameRate: number;
  repeat: number;
}

// Listas listas para generateFrameNumbers al integrar los clientes más adelante.
// walk/sit/eat miran a la derecha; flipX sirve para mirar a la izquierda.
// idle es la vista frontal de la referencia; idleSide evita girar al dejar de caminar.
export const CUSTOMER_ANIMATIONS = {
  idle: { frames: [0, 0, 0, 0, 1, 0], frameRate: 3, repeat: -1 },
  idleSide: { frames: [2, 2, 2, 2, 3, 2], frameRate: 3, repeat: -1 },
  walk: { frames: [4, 5, 6, 7], frameRate: 7, repeat: -1 },
  sit: { frames: [8, 9], frameRate: 1.5, repeat: -1 },
  eat: { frames: [10, 11, 12, 13], frameRate: 3, repeat: -1 },
} as const satisfies Record<string, CustomerAnimation>;

export type CustomerAction = keyof typeof CUSTOMER_ANIMATIONS;

function eyes(b: PixBuf, side: boolean, y: number, blink: boolean, x = 13) {
  for (const ex of side ? [x + 4] : [x - 4, x + 4]) {
    if (blink) b.hline(ex - 1, y + 1, 3, OUT);
    else b.rect(ex, y, 2, 3, INK).set(ex, y, CREAM);
  }
}

function roundEar(b: PixBuf, x: number, y: number, s: CustomerStyle, large = false) {
  b.ellipse(x, y, large ? 3 : 2, large ? 4 : 2, s.shade);
  b.ellipse(x, y - 1, large ? 2 : 1, large ? 2 : 1, s.light);
}

function head(s: CustomerStyle, side: boolean, blink: boolean, chew = false) {
  const b = new PixBuf(CUSTOMER_W, 26);
  const cx = side ? 14 : 13;
  const muzzleX = side ? 20 : 13;

  switch (s.id) {
    case 'oli':
      roundEar(b, side ? 9 : 5, 6, s);
      roundEar(b, side ? 16 : 21, 6, s);
      b.ellipse(cx, 13, 8, 7, s.fur);
      b.hline(cx - 4, 7, 8, s.light);
      b.rect(cx - 6, 9, 2, 4, s.light);
      b.ellipse(muzzleX, 17, 4, 2, s.shade);
      b.rect(muzzleX - 3, 15, 7, 3, '#f2b1ae');
      b.set(muzzleX - 1, 16, '#a25e6a').set(muzzleX + 2, 16, '#a25e6a');
      b.set(cx - 6, 15, PINK).set(cx + 6, 15, PINK);
      eyes(b, side, 11, blink, cx);
      break;
    case 'toby':
      roundEar(b, side ? 7 : 5, 10, s, true);
      roundEar(b, side ? 17 : 21, 10, s, true);
      b.ellipse(cx, 14, 7, 7, s.fur);
      b.hline(cx - 4, 8, 8, s.light);
      b.rect(cx - 6, 11, 2, 5, s.light);
      b.ellipse(muzzleX, 16, 4, 3, s.light);
      eyes(b, side, 12, blink, cx);
      b.rect(side ? 20 : 11, 13, 4, 5, '#494652');
      b.hline(side ? 20 : 12, 13, 2, '#67616c');
      b.hline(muzzleX - 1, 19, 3, s.shade);
      break;
    case 'fredi':
      for (const [x, outerRight] of (side ? [[8, false], [16, true]] : [[5, false], [18, true]]) as [number, boolean][]) {
        const tip = outerRight ? x + 3 : x;
        b.set(tip, 2, INK);
        b.hline(outerRight ? x + 2 : x, 3, 2, s.shade);
        b.hline(outerRight ? x + 1 : x, 4, 3, s.fur);
        b.rect(x, 5, 4, 4, s.fur).rect(x + 1, 6, 2, 2, CREAM);
      }
      b.ellipse(cx, 13, 8, 6, s.fur);
      b.hline(cx - 4, 8, 8, s.light);
      b.hline(cx - 7, 16, 15, CREAM).hline(cx - 5, 17, 11, CREAM);
      b.hline(cx - 3, 18, 7, CREAM).hline(cx - 1, 19, 3, CREAM);
      if (side) b.rect(20, 14, 4, 3, CREAM);
      eyes(b, side, 11, blink, cx);
      b.rect(muzzleX, 15, 2, 2, OUT);
      b.set(muzzleX, 18, s.shade);
      break;
    case 'pipo':
      b.ellipse(cx, 14, 8, 9, s.fur);
      b.hline(cx - 3, 6, 7, s.light);
      b.ellipse(side ? 18 : 9, 14, 3, 5, CREAM);
      if (!side) b.ellipse(17, 14, 3, 5, CREAM);
      b.rect(side ? 16 : 9, 14, side ? 7 : 9, 6, CREAM);
      eyes(b, side, 12, blink, cx);
      b.hline(muzzleX - 1, 17, 4, s.shirtLight).hline(muzzleX, 18, 2, '#c27b39');
      break;
    case 'po':
      b.ellipse(side ? 8 : 6, 6, 2, 3, INK);
      b.ellipse(side ? 17 : 20, 6, 2, 3, INK);
      b.ellipse(cx, 13, 8, 7, s.fur);
      b.hline(cx - 4, 7, 9, s.light);
      b.ellipse(side ? 18 : 9, 13, 3, 3, INK);
      if (!side) b.ellipse(17, 13, 3, 3, INK);
      if (blink) {
        b.hline(side ? 17 : 8, 13, 3, s.light);
        if (!side) b.hline(16, 13, 3, s.light);
      } else {
        b.set(side ? 18 : 9, 12, s.light);
        if (!side) b.set(17, 12, s.light);
      }
      b.ellipse(muzzleX, 17, 3, 2, s.light);
      b.hline(muzzleX - 1, 16, 3, INK).set(muzzleX, 17, INK);
      b.set(muzzleX - 1, 18, s.shade).set(muzzleX + 1, 18, s.shade);
      break;
    case 'gigi':
      for (const x of side ? [11, 17] : [9, 17]) {
        b.rect(x, 3, 2, 5, s.fur).rect(x - 1, 2, 3, 2, s.shade);
      }
      b.rect(side ? 7 : 4, 6, 4, 3, s.fur).set(side ? 8 : 5, 7, s.light);
      b.rect(side ? 19 : 20, 6, 4, 3, s.fur).set(side ? 21 : 22, 7, s.light);
      b.ellipse(cx, 12, 6, 6, s.fur);
      b.rect(cx - 3, 7, 2, 2, s.shade).rect(cx + 3, 8, 2, 2, s.shade);
      b.ellipse(muzzleX, 17, 4, 2, s.light);
      b.set(muzzleX - 2, 17, s.shade).set(muzzleX + 2, 17, s.shade);
      eyes(b, side, 11, blink, cx);
      for (const gx of side ? [cx + 4] : [cx - 4, cx + 4]) {
        b.hline(gx - 2, 10, 5, '#4d665b').hline(gx - 2, 14, 5, '#4d665b');
        b.vline(gx - 2, 11, 3, '#4d665b').vline(gx + 2, 11, 3, '#4d665b');
      }
      if (!side) b.hline(12, 12, 3, '#4d665b');
      break;
    case 'nico':
      b.rect(side ? 8 : 6, 7, 3, 4, s.shade);
      b.rect(side ? 17 : 18, 7, 3, 4, s.shade);
      b.rect(cx - 7, 10, 14, 9, s.fur);
      b.rect(cx - 5, 8, 10, 13, s.fur);
      b.hline(cx - 4, 9, 8, s.light).vline(cx - 6, 11, 5, s.light);
      b.rect(muzzleX - 4, 15, side ? 8 : 9, 5, s.shade);
      b.hline(muzzleX - 3, 15, 6, s.light);
      eyes(b, side, 12, blink, cx);
      b.set(muzzleX - 1, 17, OUT).set(muzzleX + 2, 17, OUT);
      b.hline(muzzleX, 19, 3, '#593d31');
      break;
    case 'leo':
      b.ellipse(cx - 1, 14, 10, 10, '#795031');
      b.rect(cx - 9, 8, 3, 8, '#9c6936').rect(cx + 6, 8, 3, 10, '#64432d');
      b.hline(cx - 5, 4, 9, '#b7803f');
      b.rect(cx - 7, 6, 3, 3, '#b7803f').rect(cx + 3, 5, 3, 3, '#a36b34');
      b.rect(cx - 7, 19, 3, 3, '#a36b34').rect(cx + 3, 21, 3, 2, '#976032');
      roundEar(b, cx - 6, 9, s);
      roundEar(b, cx + 5, 9, s);
      b.ellipse(cx, 14, 6, 6, s.fur);
      b.hline(cx - 3, 9, 6, s.light);
      b.ellipse(muzzleX, 18, 4, 2, s.light);
      eyes(b, side, 12, blink, cx);
      b.hline(muzzleX - 1, 16, 3, '#75452f').set(muzzleX, 17, '#75452f');
      b.set(muzzleX - 1, 19, s.shade).set(muzzleX + 1, 19, s.shade);
      break;
  }
  if (chew) b.hline(muzzleX, s.id === 'gigi' ? 19 : 20, 2, OUT);
  return b.outline(OUT);
}

interface Pose {
  side?: boolean;
  blink?: boolean;
  step?: number;
  seated?: boolean;
  breath?: boolean;
  bite?: number;
}

function customerFrame(s: CustomerStyle, p: Pose = {}) {
  const b = new PixBuf(CUSTOMER_W, CUSTOMER_H);
  const side = p.side ?? false;
  const seated = p.seated ?? false;
  const penguin = s.id === 'pipo';
  const giraffe = s.id === 'gigi';
  const step = p.step;
  const bob = step === 1 || step === 3 ? -1 : 0;
  const x = side ? 12 : 13;
  const y = (seated ? 27 : 23) + bob;
  const body = new PixBuf(CUSTOMER_W, CUSTOMER_H);

  // Cola detrás de la ropa; nunca sale del cuadro.
  if (s.id === 'fredi') {
    body.ellipse(x - 6, y + 6, 3, 5, s.shade);
    body.ellipse(x - 8, y + 3, 2, 3, s.fur);
    body.rect(x - 9, y, 3, 3, CREAM);
  } else if (s.id === 'oli') {
    body.rect(x - 8, y + 7, 2, 2, s.shade).set(x - 9, y + 6, s.fur);
  } else if (s.id === 'leo' || giraffe) {
    body.vline(x - 7, y + 5, 6, s.fur).rect(x - 8, y + 10, 2, 2, s.shade);
  }

  // Rodillas hacia delante al sentarse. Los pies conservan el mismo apoyo.
  const legColor = penguin || s.id === 'leo' || giraffe ? s.fur : s.id === 'oli' ? s.shirt : INK;
  if (seated) {
    body.rect(x - 4, 33, 13, 3, legColor);
    body.rect(x + 6, 35, 3, 3, legColor).rect(x + 1, 35, 3, 3, legColor);
    body.hline(x + 6, 38, 5, penguin ? '#d79544' : SHOE);
    body.hline(x + 1, 38, 4, penguin ? '#d79544' : SHOE);
  } else {
    const stride = step === 0 ? -2 : step === 2 ? 2 : 0;
    const lift = step === 1 || step === 2 ? 1 : 0;
    for (const [lx, ly] of [[x - 4 + stride, 34 - lift], [x + 2 - stride, 34 - (step === 3 || step === 0 ? 1 : 0)]]) {
      body.rect(lx, ly, 3, 4, legColor);
      body.hline(lx, ly + 3, 4, penguin ? '#d79544' : SHOE);
    }
  }

  // Silueta de la ropa, con sombra a la derecha y luz a la izquierda.
  const top = giraffe ? y + 3 : y;
  const shirt = penguin ? s.fur : s.shirt;
  body.rect(x - 5, top, 11, seated ? 7 : 10, shirt);
  body.rect(x - 6, top + 2, 13, seated ? 4 : 7, shirt);
  body.vline(x - 4, top + 2, seated ? 4 : 7, penguin ? s.light : s.shirtLight);
  body.vline(x + 5, top + 2, seated ? 4 : 7, penguin ? s.shade : s.shirtShade);

  if (s.id === 'oli') {
    body.hline(x - 5, top, 11, '#e5bf59');
    body.rect(x - 4, top, 2, 5, s.shirtLight).rect(x + 3, top, 2, 5, s.shirtLight);
    body.set(x - 3, top + 4, '#f0d785').set(x + 3, top + 4, '#f0d785');
    body.rect(x - 2, top + 6, 5, 3, s.shirtShade).hline(x - 1, top + 6, 3, s.shirtLight);
  } else if (s.id === 'toby') {
    for (const dy of [1, 4, 7]) body.hline(x - 5, top + dy, 11, CREAM);
    body.rect(side ? x - 1 : x + 1, top + 3, 1, 7, SHOE);
    body.rect(side ? x - 4 : x + 3, top + 7, 5, 4, '#484553');
    body.hline(side ? x - 4 : x + 3, top + 7, 5, '#726776');
  } else if (s.id === 'fredi' || s.id === 'nico') {
    body.vline(x + (side ? 3 : 0), top + 2, seated ? 4 : 7, s.shirtShade);
    body.set(x - 3, top + 1, s.shirtLight).set(x + 2, top + 1, s.shirtLight);
    body.hline(x - 4, top + 5, 3, s.shirtShade).hline(x + 2, top + 5, 3, s.shirtShade);
    for (const dy of [3, 6]) body.set(x + (side ? 4 : 1), top + dy, '#d8c49a');
  } else if (penguin) {
    body.ellipse(x + (side ? 2 : 0), top + 5, 4, seated ? 3 : 5, CREAM);
    body.hline(x - 4, top + 8, 8, '#c9d2d0');
    body.rect(x - 6, top, 13, 3, s.shirt).hline(x - 5, top, 11, s.shirtLight);
    body.rect(x + 3, top + 2, 3, 5, s.shirt).hline(x + 3, top + 6, 3, s.shirtShade);
  } else if (s.id === 'po') {
    body.rect(x - 2, top, 5, 2, CREAM).rect(x - 1, top + 2, 3, 1, CREAM);
    body.vline(x + 1, top + 3, seated ? 3 : 6, s.shirtShade);
    for (const dy of [4, 7]) body.set(x + 2, top + dy, CREAM);
    body.hline(x - 4, top + 8, 8, s.shirtLight);
  } else if (giraffe) {
    body.rect(x - 1, y - 3, 3, 7, s.fur).set(x, y, s.shade);
    body.hline(x - 3, top + 1, 7, s.shirtLight);
    for (const [dx, dy] of [[-3, 3], [2, 5], [-1, 7]]) body.rect(x + dx, top + dy, 2, 2, s.shirtShade);
    body.hline(x - 5, top + 8, 11, s.shirtLight);
  } else if (s.id === 'leo') {
    body.hline(x - 3, top, 7, s.shirtShade).hline(x - 4, top + 8, 9, s.shirtLight);
  }

  // Brazos alternados al caminar; manos cerca de la boca solamente al comer.
  const armShift = step === 0 ? 1 : step === 2 ? -1 : 0;
  const hand = penguin || s.id === 'po' ? INK : s.fur;
  if (!side) {
    for (const ax of [x - 7, x + 6]) {
      body.rect(ax, top + 2, 2, 5, s.id === 'oli' ? '#e5bf59' : penguin ? s.fur : s.shirt);
      body.rect(ax, top + 7, 2, 3, hand).set(ax, top + 7, s.light);
    }
  } else {
    body.rect(x - 1 + armShift, top + 2, 3, 5, s.id === 'oli' ? '#e5bf59' : penguin ? s.fur : s.shirtShade);
    body.rect(x - 1 + armShift, top + 7, 3, 2, hand);
  }
  body.outline(OUT);
  b.blit(body, 0, 0);
  const headY = (seated ? 5 : 0) + bob;
  b.blit(head(s, side, p.blink ?? false, p.bite === 2), 0, headY);

  if (p.bite !== undefined) {
    // Pequeño pan: levantar, morder, masticar, bajar. Sin mesa ni silla dibujadas.
    const foodY = headY + (p.bite === 0 || p.bite === 3 ? 22 : 19);
    const food = new PixBuf(CUSTOMER_W, CUSTOMER_H);
    food.rect(19, foodY + 2, 3, 3, hand);
    food.rect(19, foodY, p.bite >= 2 ? 3 : 5, 2, '#d6a05a');
    food.hline(19, foodY, p.bite >= 2 ? 2 : 4, '#f4d495');
    food.outline(OUT);
    b.blit(food, 0, 0);
  }
  if (p.breath) {
    // Respiración suave, sin desplazar cabeza, rodillas ni pies.
    b.hline(x - 3, top + 3, 3, penguin ? CREAM : s.shirtLight);
  }
  return b;
}

export function buildCustomerFrames(id: CustomerId): PixBuf[] {
  const s = CUSTOMERS.find((customer) => customer.id === id);
  if (!s) throw new Error(`Cliente desconocido: ${id}`);
  return [
    customerFrame(s),
    customerFrame(s, { blink: true }),
    customerFrame(s, { side: true }),
    customerFrame(s, { side: true, blink: true }),
    ...[0, 1, 2, 3].map((step) => customerFrame(s, { side: true, step })),
    customerFrame(s, { side: true, seated: true }),
    customerFrame(s, { side: true, seated: true, breath: true, blink: true }),
    ...[0, 1, 2, 3].map((bite) => customerFrame(s, { side: true, seated: true, bite, blink: bite === 2 })),
  ];
}
