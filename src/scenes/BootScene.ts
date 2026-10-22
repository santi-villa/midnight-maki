import Phaser from 'phaser';
import { ensureTileset } from './textures';
import { COZY_ATLAS_KEY, COZY_ATLAS_URL, installCozyAtlas } from '../art/cozyAssets';
import { INTERIOR_ATLAS_KEY, INTERIOR_ATLAS_URL, installInteriorAtlas } from '../art/interiors';
import { BRIDGE_ATLAS_KEY, BRIDGE_ATLAS_URL, installBridgeAtlas } from '../art/bridges';
import { FARM_ATLAS_KEY, FARM_ATLAS_URL, installFarmAtlas } from '../art/farm';
import { ICON_ATLAS_KEY, ICON_ATLAS_URL, installIconAtlas } from '../art/iconArt';
import { PETS_ATLAS_KEY, PETS_ATLAS_URL } from './pets';
import { installPipSheet, PIP_SHEET_KEY, PIP_SHEET_URL } from '../art/pipSheet';
import { VILLAGE_ATLAS_KEY, VILLAGE_ATLAS_URL, installVillageAtlas } from '../art/villageAssets';

/** Generates the shared tileset, then shows the title. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }
  preload() {
    const bar = (p: number) => (window as unknown as { __bootProgress?: (p: number) => void }).__bootProgress?.(p * 0.7);
    this.load.on('progress', bar);
    this.load.image(COZY_ATLAS_KEY, COZY_ATLAS_URL);
    this.load.image(INTERIOR_ATLAS_KEY, INTERIOR_ATLAS_URL);
    this.load.image(BRIDGE_ATLAS_KEY, BRIDGE_ATLAS_URL);
    this.load.image(VILLAGE_ATLAS_KEY, VILLAGE_ATLAS_URL);
    this.load.image(FARM_ATLAS_KEY, FARM_ATLAS_URL);
    this.load.image(ICON_ATLAS_KEY, ICON_ATLAS_URL);
    this.load.image(PETS_ATLAS_KEY, PETS_ATLAS_URL);
    this.load.image(PIP_SHEET_KEY, PIP_SHEET_URL);
  }
  create() {
    if (this.textures.exists(COZY_ATLAS_KEY)) installCozyAtlas(this.textures.get(COZY_ATLAS_KEY).getSourceImage() as HTMLImageElement);
    if (this.textures.exists(INTERIOR_ATLAS_KEY)) installInteriorAtlas(this.textures.get(INTERIOR_ATLAS_KEY).getSourceImage() as HTMLImageElement);
    if (this.textures.exists(BRIDGE_ATLAS_KEY)) installBridgeAtlas(this.textures.get(BRIDGE_ATLAS_KEY).getSourceImage() as HTMLImageElement);
    if (this.textures.exists(VILLAGE_ATLAS_KEY)) installVillageAtlas(this.textures.get(VILLAGE_ATLAS_KEY).getSourceImage() as HTMLImageElement);
    if (this.textures.exists(FARM_ATLAS_KEY)) installFarmAtlas(this.textures.get(FARM_ATLAS_KEY).getSourceImage() as HTMLImageElement);
    if (this.textures.exists(PIP_SHEET_KEY)) installPipSheet(this.textures.get(PIP_SHEET_KEY).getSourceImage() as HTMLImageElement);
    if (this.textures.exists(ICON_ATLAS_KEY)) installIconAtlas(this.textures.get(ICON_ATLAS_KEY).getSourceImage() as HTMLImageElement);
    const tip = document.getElementById('boot-tip');
    if (tip) tip.textContent = 'Dando color a Villa Nori…';
    const prog = (window as unknown as { __bootProgress?: (p: number) => void }).__bootProgress;
    prog?.(0.85);
    ensureTileset(this);
    prog?.(1);
    if (tip) tip.textContent = 'Abriendo Maki & Mapaches…';
    this.scene.start('title');
    this.game.events.emit('booted');
  }
}
