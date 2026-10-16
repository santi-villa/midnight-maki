import Phaser from 'phaser';
import { ensureTileset } from './textures';
import { COZY_ATLAS_KEY, COZY_ATLAS_URL, installCozyAtlas } from '../art/cozyAssets';

/** Generates the shared tileset, then shows the title. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }
  preload() {
    this.load.image(COZY_ATLAS_KEY, COZY_ATLAS_URL);
  }
  create() {
    if (this.textures.exists(COZY_ATLAS_KEY)) installCozyAtlas(this.textures.get(COZY_ATLAS_KEY).getSourceImage() as HTMLImageElement);
    const tip = document.getElementById('boot-tip');
    if (tip) tip.textContent = 'Dando color a Villa Nori…';
    ensureTileset(this);
    if (tip) tip.textContent = 'Abriendo Maki & Mapaches…';
    this.scene.start('title');
    this.game.events.emit('booted');
  }
}
