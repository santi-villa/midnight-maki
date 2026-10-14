import Phaser from 'phaser';
import { ensureTileset } from './textures';

/** Generates the shared tileset, then shows the title. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }
  create() {
    const tip = document.getElementById('boot-tip');
    if (tip) tip.textContent = 'Dando color a Villa Nori…';
    ensureTileset(this);
    if (tip) tip.textContent = 'Abriendo Maki & Mapaches…';
    this.scene.start('title');
    this.game.events.emit('booted');
  }
}
