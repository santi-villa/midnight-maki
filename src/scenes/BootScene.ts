import Phaser from 'phaser';
import { ensureTileset } from './textures';
import { COZY_ATLAS_KEY, COZY_ATLAS_URL, installCozyAtlas } from '../art/cozyAssets';

/** Generates the shared tileset, then shows the title. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }
  preload() {
    const bar = (p: number) => (window as unknown as { __bootProgress?: (p: number) => void }).__bootProgress?.(p * 0.7);
    this.load.on('progress', bar);
    this.load.image(COZY_ATLAS_KEY, COZY_ATLAS_URL);
  }
  create() {
    if (this.textures.exists(COZY_ATLAS_KEY)) installCozyAtlas(this.textures.get(COZY_ATLAS_KEY).getSourceImage() as HTMLImageElement);
    const tip = document.getElementById('boot-tip');
    if (tip) tip.textContent = 'Dando color a Villa Nori…';
    const prog = (window as unknown as { __bootProgress?: (p: number) => void }).__bootProgress;
    prog?.(0.85);
    ensureTileset(this);
    prog?.(1);
    if (tip) tip.textContent = 'Abriendo Mapaches y Sushi…';
    this.scene.start('title');
    this.game.events.emit('booted');
  }
}
