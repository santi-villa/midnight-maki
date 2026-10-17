/** Cozy Farm Lite (Bramble & Byte, commercial use allowed): crop stages and a few farm props. One small atlas, see scripts/build-farm-assets.py. */
import catalog from '../assets/farm/farm.json';
import atlasURL from '../assets/farm/farm.png';
import { ctx2d, makeCanvas } from './pixel';

export const FARM_ATLAS_KEY = 'farm-source';
export const FARM_ATLAS_URL = atlasURL;
let atlas: CanvasImageSource | null = null;
export function installFarmAtlas(source: CanvasImageSource) { atlas = source; }

const rects = catalog.pieces as unknown as Record<string, [number, number, number, number]>;

/** A piece of the atlas as its own canvas, or null when the atlas is not loaded (the procedural art then stays). */
export function farmPiece(name: string): HTMLCanvasElement | null {
  const r = rects[name];
  if (!atlas || !r) return null;
  const c = makeCanvas(r[2], r[3]);
  ctx2d(c).drawImage(atlas, r[0], r[1], r[2], r[3], 0, 0, r[2], r[3]);
  return c;
}

/** Props whose id starts with `farm_` use a piece of the atlas (prop id → piece name). */
const PROP_PIECES: Record<string, string> = { farm_hay: 'hay', farm_crate: 'crate', farm_barrel: 'barrel', farm_bush: 'bush', farm_flowers: 'flowers', farm_rock: 'rock', farm_oak: 'oak' };
export function farmObject(id: string, width: number, height: number): HTMLCanvasElement | null {
  const piece = PROP_PIECES[id] && farmPiece(PROP_PIECES[id]);
  if (!piece) return null;
  // the piece sits on the bottom of its footprint, like every other prop
  const c = makeCanvas(width, height);
  ctx2d(c).drawImage(piece, Math.floor((width - piece.width) / 2), height - piece.height);
  return c;
}

/** Crops that have their own growth art: the seed they come from, and the sheet name. */
export const CROP_ART: Record<string, string> = { sd_carrot: 'carrot', sd_tomato: 'tomato', sd_wheat: 'wheat' };
/** 0 seeds, 1 sprout, 2 growing, 3 ready */
export const cropStage = (progress: number, ready: boolean) => (ready ? 3 : Math.max(0, Math.min(2, Math.floor(progress * 3))));
