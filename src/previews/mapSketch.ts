/** Review-only map composition using the game's real tiles and prop renderer. Never registers or modifies a game zone. */
import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/600.css';
import { COZY_ATLAS_URL, installCozyAtlas } from '../art/cozyAssets';
import { VILLAGE_ATLAS_URL, installVillageAtlas } from '../art/villageAssets';
import { SERENE_ATLAS_URL, installSereneAtlas } from '../art/serene';
import { EXTERIOR_ATLAS_URL, installExteriorAtlas } from '../art/exteriors';
import { JAPANESE_CITY_ATLAS_URL, installJapaneseCityAtlas } from '../art/japaneseCity';
import { BRIDGE_ATLAS_URL, installBridgeAtlas, bridgeRailCanvas } from '../art/bridges';
import { FARM_ATLAS_URL, installFarmAtlas, farmPiece } from '../art/farm';
import { buildTileset, TILE_INDEX, TILESET_COLS } from '../art/tiles';
import { tileFor, buildOverlay } from '../world/zoneRuntime';
import { PROPS } from '../data/props';
import { propCanvas } from '../scenes/textures';
import { defaultAppearance } from '../core/state';
import { heroFrame } from '../art/heroRender';
import { folkFrame } from '../art/folk';
import { FOLK_SPECS } from '../data/folkSpecs';
import { windowGlowRects } from '../art/windowGlow';
import { restaurantFacadeLayout } from '../art/restaurantFacade';
import type { ZoneDef } from '../data/zones';
import { createSketchLayout, W, H, plaza, shoreAt } from './mapSketchLayout';
import { paverTile, GREY_STONE } from '../art/nature';
import { rng } from '../art/pixel';
import cliffURL from '../assets/map-study/cliffs.png';

const T = 16;
const canvas = document.querySelector<HTMLCanvasElement>('#map')!;
canvas.width = W * T; canvas.height = H * T;
const c = canvas.getContext('2d')!;
c.imageSmoothingEnabled = false;
const { grid, placements, plots, waterAreas, rails, crops, zones } = createSketchLayout();
const lights: { x: number; y: number; size: number }[] = [];
const windows: { x: number; y: number; w: number; h: number }[] = [];

async function load(url: string, install: (image: HTMLImageElement) => void) {
  const image = new Image(); image.src = url; await image.decode(); install(image);
}
await Promise.all([
  load(COZY_ATLAS_URL, installCozyAtlas), load(VILLAGE_ATLAS_URL, installVillageAtlas),
  load(SERENE_ATLAS_URL, installSereneAtlas), load(EXTERIOR_ATLAS_URL, installExteriorAtlas),
  load(JAPANESE_CITY_ATLAS_URL, installJapaneseCityAtlas), load(BRIDGE_ATLAS_URL, installBridgeAtlas),
  load(FARM_ATLAS_URL, installFarmAtlas),
]);
const cliff = new Image(); cliff.src = cliffURL; await cliff.decode();
await document.fonts.ready;
const tiles = buildTileset();
const tileColumns = TILESET_COLS;
const def: ZoneDef = { id: 'sketch', name: 'Villa Nori (boceto)', outdoor: true, music: 'town', w: W, h: H, ground: grid.map(row => row.join('')), props: [], doors: [], interact: [], rooms: [], gather: [] };
const overlay = buildOverlay(def);
const base = document.createElement('canvas'); base.width = canvas.width; base.height = canvas.height;
const g = base.getContext('2d')!; g.imageSmoothingEnabled = false;
function drawTile(index: number, x: number, y: number) {
  if (!Number.isInteger(index)) throw new Error(`Missing tile at ${x},${y}: ${grid[y][x]}`);
  g.drawImage(tiles, index % tileColumns * T, Math.floor(index / tileColumns) * T, T, T, x * T, y * T, T, T);
}
const stone = document.createElement('canvas'); stone.width = 48; stone.height = 16;
const sg = stone.getContext('2d')!;
for (let i = 0; i < 3; i++) paverTile(i, GREY_STONE)(sg, i * T, 0, rng(410 + i));
const land = new Path2D(); land.moveTo(0, 0); land.lineTo(canvas.width, 0);
for (let x = canvas.width; x >= 0; x -= 4) land.lineTo(x, Math.round(shoreAt(x / T) * T));
land.closePath();
// First the sea, then one continuous land silhouette: coves never become rectangular tile cutouts.
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) drawTile(TILE_INDEX[`seac${y > 71 ? 'm' : 's'}${x % 2 + (y % 2) * 2}_0`], x, y);
g.fillStyle = '#5d93a226'; g.fillRect(0, 0, canvas.width, canvas.height);
g.save(); g.clip(land);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const ch = grid[y][x];
  if (ch === '~') continue;
  if (ch === 'C') { g.drawImage(cliff, grid[y - 1]?.[x] === 'C' ? 16 : 0, 0, T, T, x * T, y * T, T, T); continue; }
  drawTile(tileFor(def, ch === 'w' || ch === 'b' ? 'g' : ch, x, y), x, y);
  const inPlaza = x >= plaza.x && x < plaza.x + plaza.w && y >= plaza.y && y < plaza.y + plaza.h;
  if (inPlaza && ch === 'c') g.drawImage(stone, ((x * 7 + y * 11 + x * y % 5) % 3) * T, 0, T, T, x * T, y * T, T, T);
  if (overlay[y][x] >= 0 && !['C', 'b', 'w', 'S', 'R'].includes(ch) && !inPlaza) drawTile(overlay[y][x], x, y);
}
for (const area of waterAreas) {
  const shape = new Path2D();
  area.points.forEach(([x, y], i) => i ? shape.lineTo(Math.round(x * T / 2) * 2, Math.round(y * T / 2) * 2) : shape.moveTo(x * T, y * T));
  shape.closePath();
  g.save(); g.clip(shape);
  const minX = Math.max(0, Math.floor(Math.min(...area.points.map(p => p[0])))), maxX = Math.min(W - 1, Math.ceil(Math.max(...area.points.map(p => p[0]))));
  const minY = Math.max(0, Math.floor(Math.min(...area.points.map(p => p[1])))), maxY = Math.min(H - 1, Math.ceil(Math.max(...area.points.map(p => p[1]))));
  for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) drawTile(tileFor(def, 'w', x, y), x, y);
  g.restore();
  g.strokeStyle = '#789d83'; g.lineWidth = 3; g.stroke(shape);
  g.strokeStyle = '#c0d5bb'; g.lineWidth = 1; g.stroke(shape);
}
// Coastal rock faces and a quiet foam line follow the same continuous coastline.
for (let x = 32; x < W; x++) {
  const y = shoreAt(x + .5), bank = grid[Math.max(0, Math.floor(y) - 1)]?.[x];
  if (bank !== 'w' && bank !== 'b') g.drawImage(cliff, 0, 0, T, T, x * T, Math.round(y * T) - T, T, T);
}
g.restore();
for (let x = 0; x < canvas.width; x += 2) {
  const y = Math.round(shoreAt(x / T) * T), bank = grid[Math.max(0, Math.floor(y / T) - 1)]?.[Math.min(W - 1, Math.floor(x / T))];
  if (bank === 'w' || bank === 'b') continue;
  g.fillStyle = x < 31 * T ? '#d0c3a5' : '#718e85'; g.fillRect(x, y - 2, 2, 2);
  g.fillStyle = x % 16 < 12 ? '#d9ede1' : '#a6d0c9'; g.fillRect(x, y, 2, 2);
}
// The lighthouse stands on a small rounded promontory, reached by a timber footbridge.
const island = new Path2D(); island.ellipse(99 * T, 68 * T, 4.2 * T, 4.3 * T, 0, 0, Math.PI * 2);
g.save(); g.clip(island);
for (let y = 63; y < 73; y++) for (let x = 94; x < W; x++) {
  if (y > 70) g.drawImage(cliff, 0, 0, T, T, x * T, y * T, T, T);
  else drawTile(tileFor(def, 'g', x, y), x, y);
}
g.restore();
// Bridges and working wharves sit above both river and sea, at the same scale as in play.
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (grid[y][x] === 'b') drawTile(tileFor(def, 'b', x, y), x, y);
for (const rail of rails) g.drawImage(bridgeRailCanvas(rail.axis, rail.span), rail.x * T - 2, rail.y * T - 7);
// Stone kerbs define the public square; each frontage has its own contact stones and lawn.
g.strokeStyle = '#918674'; g.lineWidth = 2;
g.strokeRect(plaza.x * T + 1, plaza.y * T + 1, plaza.w * T - 2, plaza.h * T - 2);
for (const placement of placements.sort((a, b) => (a.y + PROPS[a.id].h) - (b.y + PROPS[b.id].h))) {
  const p = PROPS[placement.id], image = propCanvas(placement.id);
  const x = (placement.x + p.w / 2) * T, y = (placement.y + p.h) * T;
  if (!p.ground && p.sombra !== 'ninguna') {
    g.fillStyle = 'rgba(43,51,32,0.17)'; g.beginPath();
    g.ellipse(x + 5, y + 3, Math.min(image.width * 0.4, 42), Math.min(8, image.width * 0.13), 0, 0, Math.PI * 2); g.fill();
  }
  g.drawImage(image, Math.floor(x - image.width / 2), y - image.height);
  if (p.light) lights.push({ x, y: y - 14, size: p.kind === 'stall' ? 47 : 38 });
  if (['building', 'townhouse', 'sidehouse'].includes(p.kind) && placement.id !== 'bld_station') {
    lights.push({ x, y: y - 22, size: 34 });
    const panes = placement.id.startsWith('bld_restaurant') ? restaurantFacadeLayout(p.sw, p.sh, p.stage ?? 0).windows
      : windowGlowRects(p.sw, p.sh, p.variant ?? 0, false, p.kind === 'townhouse' ? 'front' : p.kind === 'sidehouse' ? 'side' : undefined);
    for (const pane of panes) windows.push({ x: x - image.width / 2 + pane.x, y: y - image.height + pane.y, w: pane.w, h: pane.h });
  }
  if (placement.id === 'lighthouse') lights.push({ x, y: y - 80, size: 42 });
}
// Crops and villagers are references for the size the place would have during play.
for (const [x, y] of crops) {
  const image = farmPiece('carrot_3'); if (image) g.drawImage(image, x * T, y * T - image.height + T);
}
const people = [
  { image: heroFrame(defaultAppearance(), { dir: 'down', legs: 'idle', expr: 'neutral' }), x: 55, y: 42 },
  { image: folkFrame(FOLK_SPECS.taro, { dir: 'down', legs: 'idle', expr: 'neutral' }), x: 67, y: 40 },
  { image: folkFrame(FOLK_SPECS.pip, { dir: 'down', legs: 'idle', expr: 'neutral' }), x: 54, y: 56 },
];
for (const p of people) g.drawImage(p.image, p.x * T - p.image.width / 2, p.y * T - p.image.height);

let night = false, labels = true, zoom = 1;
const viewport = document.querySelector<HTMLElement>('#viewport')!;
const surface = document.querySelector<HTMLElement>('#surface')!;
function plaque(text: string, x: number, y: number, number?: number) {
  c.font = "600 17px 'Pixelify Sans'";
  const width = c.measureText(text).width + (number ? 45 : 22), h = 29, left = x * T - width / 2, top = y * T;
  c.fillStyle = '#422e2a55'; c.fillRect(left + 2, top + 3, width, h);
  c.fillStyle = '#f8e9cb'; c.strokeStyle = '#755140'; c.lineWidth = 2;
  c.beginPath(); c.roundRect(left, top, width, h, 5); c.fill(); c.stroke();
  if (number) {
    c.fillStyle = '#9b4e48'; c.beginPath(); c.arc(left + 15, top + 14.5, 12, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#fff3da'; c.textAlign = 'center'; c.fillText(String(number), left + 15, top + 21);
  }
  c.fillStyle = '#533d31'; c.textAlign = 'left'; c.fillText(text, left + (number ? 33 : 11), top + 21);
}
function render() {
  c.clearRect(0, 0, canvas.width, canvas.height); c.drawImage(base, 0, 0);
  if (night) {
    c.globalCompositeOperation = 'multiply'; c.fillStyle = '#737e9c'; c.fillRect(0, 0, canvas.width, canvas.height);
    c.globalCompositeOperation = 'screen';
    c.fillStyle = 'rgba(255,207,121,0.6)';
    for (const pane of windows) c.fillRect(pane.x, pane.y, pane.w, pane.h);
    for (const light of lights) for (let band = 6; band > 0; band--) {
      c.fillStyle = `rgba(255,183,87,${0.013 + (6 - band) * 0.005})`; c.beginPath();
      c.arc(light.x, light.y, light.size * band / 6, 0, Math.PI * 2); c.fill();
    }
    c.globalCompositeOperation = 'source-over';
  }
  if (labels) {
    for (const zone of zones) plaque(zone.name, zone.x, zone.y, zone.n);
    plaque('Tu restaurante', 54, 57);
    plaque('Faro', 100, 75);
  }
  document.querySelector('#status')!.textContent = `${night ? 'Noche' : 'Día'} · Assets reales del juego`;
  document.querySelector('#day')!.setAttribute('aria-pressed', String(!night));
  document.querySelector('#night')!.setAttribute('aria-pressed', String(night));
  document.querySelector('#labels')!.setAttribute('aria-pressed', String(labels));
}
function fit(focus?: number[]) {
  const scale = Math.min((viewport.clientWidth - 14) / canvas.width, (viewport.clientHeight - 14) / canvas.height) * zoom;
  surface.style.width = `${Math.floor(canvas.width * scale)}px`;
  requestAnimationFrame(() => viewport.scrollTo({ left: focus ? focus[0] * T * scale - viewport.clientWidth / 2 : 0, top: focus ? focus[1] * T * scale - viewport.clientHeight / 2 : 0 }));
}
for (const zone of zones) {
  const button = document.createElement('button'); button.className = 'zone';
  const number = document.createElement('span'); number.className = 'number'; number.textContent = String(zone.n);
  const name = document.createElement('span'); name.textContent = zone.name;
  button.append(number, name); button.addEventListener('click', () => {
    zoom = 2.8; fit(zone.focus);
    if (window.innerWidth < 950) viewport.scrollIntoView({ block: 'center', behavior: 'smooth' });
  });
  document.querySelector('#zones')!.append(button);
}
document.querySelector('#day')!.addEventListener('click', () => { night = false; render(); });
document.querySelector('#night')!.addEventListener('click', () => { night = true; render(); });
document.querySelector('#labels')!.addEventListener('click', () => { labels = !labels; render(); });
document.querySelector('#fit')!.addEventListener('click', () => { zoom = 1; fit(); });
document.querySelector('#zoom')!.addEventListener('click', () => { zoom = zoom >= 3 ? 1 : zoom + 1; fit([52, 40]); });
document.querySelector('#export')!.addEventListener('click', () => {
  const link = document.createElement('a'); link.download = `Villa-Nori-boceto-${night ? 'noche' : 'dia'}.png`;
  link.href = canvas.toDataURL('image/png'); link.click();
});
window.addEventListener('resize', () => fit());
render(); fit();
(window as unknown as { __sketchReady: boolean; __sketchPlots: unknown; __sketchPlaza: unknown }).__sketchPlots = plots;
(window as unknown as { __sketchPlaza: unknown }).__sketchPlaza = plaza;
(window as unknown as { __sketchGrid: string[] }).__sketchGrid = grid.map(row => row.join(''));
(window as unknown as { __sketchReady: boolean }).__sketchReady = true;
