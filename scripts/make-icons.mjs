// Generates the PWA icons (Pip's face in pixel art) without dependencies.
// Usage: node scripts/make-icons.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const FACE = [
  '....OO....OO....',
  '...OWWO..OWWO...',
  '...OWIWOOWIWO...',
  '..OSSSSSSSSSSO..',
  '.OSSSSSSSSSSSSO.',
  '.OSSSSSSSSSSSSO.',
  'OSMMMMSSSSMMMMSO',
  'OSMKKMMSSMMKKMSO',
  'OSMKEMMSSMMKEMSO',
  'OSSMMMSSSSMMMSSO',
  'OSSSSLLLLLLSSSSO',
  '.OSSLLLNNLLLSSO.',
  '.OSSSLLRRLLSSSO.',
  '..OOSSSSSSSSOO..',
  '....OOOOOOOO....',
  '................',
];
const PAL = {
  O: [58, 52, 64, 255], S: [154, 151, 163, 255], W: [251, 246, 234, 255], I: [47, 42, 51, 255],
  M: [58, 52, 64, 255], K: [42, 34, 48, 255], E: [255, 255, 255, 255], L: [240, 236, 226, 255],
  N: [42, 34, 48, 255], R: [217, 103, 95, 255],
};
const BG = [31, 36, 64, 255];
const CIRCLE = [44, 51, 88, 255];
const STAR = [242, 198, 109, 255];

function render(size) {
  const px = Buffer.alloc(size * size * 4);
  const set = (x, y, c) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = c[3];
  };
  const cx = size / 2;
  const cy = size * 0.54;
  const r = size * 0.38;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) set(x, y, (x - cx) ** 2 + (y - cy) ** 2 < r * r ? CIRCLE : BG);
  const u = Math.floor(size / 48);
  for (const [sx, sy] of [[8, 8], [38, 6], [42, 16], [5, 20]]) for (let j = 0; j < u; j++) for (let i = 0; i < u; i++) set(sx * u + i, sy * u + j, STAR);
  const k = Math.floor((size * 0.6) / 16);
  const ox = Math.floor((size - 16 * k) / 2);
  const oy = Math.floor((size - 16 * k) / 2 + size * 0.06);
  FACE.forEach((row, y) => [...row].forEach((ch, x) => {
    const c = PAL[ch];
    if (!c) return;
    for (let j = 0; j < k; j++) for (let i = 0; i < k; i++) set(ox + x * k + i, oy + y * k + j, c);
  }));
  return px;
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = (b) => {
  let c = 0xffffffff;
  for (const x of b) c = crcTable[(c ^ x) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const c = Buffer.alloc(4);
  c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
};
function png(size, px) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

// Android launcher icons (only when the Capacitor project exists)
import { existsSync } from 'node:fs';
const res = 'android/app/src/main/res';
if (existsSync(res)) {
  const sizes = { mdpi: [48, 108], hdpi: [72, 162], xhdpi: [96, 216], xxhdpi: [144, 324], xxxhdpi: [192, 432] };
  for (const [d, [s, fg]] of Object.entries(sizes)) {
    const dir = `${res}/mipmap-${d}`;
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/ic_launcher.png`, png(s, render(s)));
    writeFileSync(`${dir}/ic_launcher_round.png`, png(s, render(s)));
    writeFileSync(`${dir}/ic_launcher_foreground.png`, png(fg, render(fg)));
  }
  console.log('android launcher icons');
}

mkdirSync('public/icons', { recursive: true });
for (const s of [192, 512, 180]) {
  writeFileSync(`public/icons/icon-${s}.png`, png(s, render(s)));
  console.log('icon', s);
}
