import Phaser from 'phaser';
import { ensureTileset } from './textures';

/** Generates the shared tileset, then shows the title. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }
  create() {
    ensureTileset(this);
    this.scene.start('title');
    this.game.events.emit('booted');
  }
}
