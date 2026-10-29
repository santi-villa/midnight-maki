import type Phaser from 'phaser';
import { CHAR_BY_ID } from '../data/characters';
import { appearanceOf } from '../systems/appearance';
import riggSheet from '../assets/characters/rigg.png';

export const RIGG_SHEET_KEY = 'rigg_illustrated_v1';
export const RIGG_SHEET_URL = riggSheet;
export const RIGG_FRAME_WIDTH = 40;
export const RIGG_FRAME_HEIGHT = 39;

/** Custom outfits keep the existing renderer until matching sprite art is available. */
export function illustratedRigg(scene: Phaser.Scene, id: string): boolean {
  if (id !== 'rigg' || !scene.textures.exists(RIGG_SHEET_KEY)) return false;
  const look = appearanceOf(id);
  const original = CHAR_BY_ID.rigg.appearance;
  return look.head === original.head && look.extra === original.extra;
}
