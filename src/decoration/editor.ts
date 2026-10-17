/**
 * Grid-based interior decoration editor running on top of the world scene.
 * Place / move / rotate / store furniture, change floors & walls, undo, path-safety validation.
 * The sheet only browses. A chosen piece is dragged on the room, or nudged with the arrow keys.
 */
import Phaser from 'phaser';
import { furnitureCanvas } from '../art/furniture';
import { FLOOR_STYLES, WALL_STYLES } from '../art/tiles';
import { audio } from '../audio/audio';
import { bus } from '../core/events';
import { game } from '../core/state';
import type { PlacedFurniture } from '../core/types';
import { CHAR_BY_ID } from '../data/characters';
import { FURNITURE, FURN_BY_ID, furnSize, type FurnCat, type FurnitureDef } from '../data/furniture';
import type { RoomDef } from '../data/zones';
import { decorChips, firstDecorView, ghostAnchor } from './decorView';
import { TILE } from '../entities/Actor';
import { world } from '../scenes/WorldScene';
import { furnTexture } from '../scenes/textures';
import { clock } from '../systems/time';
import { isTypingTarget, stepIndex } from '../input/bindings';
import { add, h, modalOpen, toast, uiRoot } from '../ui/dom';
import { showHud } from '../ui/hud';
import { decorateBlockReason } from '../world/contextActions';
import { furnitureSolidTiles, placementBlock, roomAt } from '../world/zoneRuntime';

interface Ghost { id: string; x: number; y: number; rot: number; uid?: number; }

let active = false;

export function startDecor() {
  if (active) return;
  const z = world.zone;
  const room = z ? roomAt(z.def, world.player.tx, world.player.ty) : undefined;
  const reason = decorateBlockReason(room);
  if (reason) {
    toast(reason);
    return;
  }
  new DecorEditor(room!).open();
}

class DecorEditor {
  private sheet!: HTMLElement;
  private browse!: HTMLElement;
  private chips!: HTMLElement;
  private list!: HTMLElement;
  private hint!: HTMLElement;
  private placeBox!: HTMLElement;
  private placeName!: HTMLElement;
  private status!: HTMLElement;
  private actions!: HTMLElement;
  private gfx!: Phaser.GameObjects.Graphics;
  private ghostImg: Phaser.GameObjects.Image | null = null;
  private ghost: Ghost | null = null;
  private undo: string[] = [];
  private view = 'room';
  private handler = (p: Phaser.Input.Pointer) => this.onTap(p);
  private moveHandler = (p: Phaser.Input.Pointer) => this.onDrag(p);
  private down: { x: number; y: number } | null = null;
  private downHandler = (p: Phaser.Input.Pointer) => (this.down = { x: p.x, y: p.y });
  private startOwned = 0;
  private initial = '';
  private frameObserver: ResizeObserver | null = null;

  constructor(private room: RoomDef) {}

  open() {
    active = true;
    world.decorMode = true;
    world.player.stop();
    clock.pause();
    showHud(false);
    this.initial = this.serialize();
    this.gfx = world.add.graphics().setDepth(190000);
    world.input.on('pointerdown', this.downHandler);
    world.input.on('pointermove', this.moveHandler);
    world.input.on('pointerup', this.handler);
    this.chips = h('div', { class: 'decor-chips', role: 'tablist' });
    this.list = h('div', { class: 'decor-tray' });
    this.hint = h('p', { class: 'decor-hint' });
    this.browse = h('div', { class: 'decor-browse' }, this.chips, this.list, this.hint);
    this.placeName = h('b', { class: 'decor-piece' });
    this.status = h('div', { class: 'decor-status' });
    this.actions = h('div', { class: 'decor-actions' });
    this.placeBox = h('div', { class: 'decor-place' }, this.placeName, this.status, this.actions);
    this.placeBox.hidden = true;
    const chips = decorChips(game.save.furnitureOwned, FURNITURE);
    this.view = firstDecorView(chips);
    this.sheet = h(
      'div',
      { class: 'decor-sheet', role: 'dialog', 'aria-label': `Decorar: ${this.room.name}` },
      h('div', { class: 'decor-head' },
        h('b', null, this.room.name),
        h('div', { class: 'decor-head-actions' },
          h('button', { type: 'button', class: 'btn small', onclick: () => this.doUndo() }, 'Deshacer'),
          h('button', { type: 'button', class: 'btn small', onclick: () => this.cancel() }, 'Cancelar'),
          h('button', { type: 'button', class: 'btn small primary', onclick: () => this.done() }, 'Listo'))),
      this.placeBox,
      this.browse,
    );
    uiRoot().append(this.sheet);
    const frame = (ms: number) => world.frameRoom(this.room, this.sheet.getBoundingClientRect().height, ms);
    frame(400);
    this.frameObserver = new ResizeObserver(() => frame(0));
    this.frameObserver.observe(this.sheet);
    (this.sheet as HTMLElement & { __close?: () => void }).__close = () => this.cancel();
    window.addEventListener('keydown', this.onKey, true);
    this.startOwned = Object.values(game.save.furnitureOwned).reduce((a, b) => a + b, 0);
    this.renderList();
    this.drawGrid();
    this.chips.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
  }

  private onKey = (e: KeyboardEvent) => {
    if (!active || modalOpen() || isTypingTarget(e.target) || e.key === 'Escape') return;
    const arrows = e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight';
    if (this.ghost && arrows) {
      e.preventDefault();
      e.stopPropagation();
      const nudgeTo = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' } as const;
      this.nudge(nudgeTo[e.key as keyof typeof nudgeTo]);
      return;
    }
    const items = [...this.sheet.querySelectorAll('button')].filter((el) => el.getClientRects().length > 0);
    if (!items.length) return;
    if (e.key === 'Tab' || arrows) {
      e.preventDefault();
      e.stopPropagation();
      const dir: 1 | -1 = e.key === 'ArrowUp' || e.key === 'ArrowLeft' || (e.key === 'Tab' && e.shiftKey) ? -1 : 1;
      const i = items.indexOf(document.activeElement as HTMLButtonElement);
      const next = i < 0 ? items[0] : items[stepIndex(i, items.length, dir)];
      next.focus({ preventScroll: true });
    }
  };

  private serialize(): string {
    return JSON.stringify({ rooms: game.save.decor, owned: game.save.furnitureOwned, styles: game.save.roomStyle });
  }

  /** Listo: whatever is selected is put down where it is, and everything stays. */
  private done() {
    if (this.ghost && !this.commitGhost()) return;
    this.close();
  }

  /** Cancelar: back to how the room was when the editor opened. */
  private cancel() {
    this.clearGhost(true);
    if (this.serialize() !== this.initial) {
      const d = JSON.parse(this.initial);
      game.save.decor = d.rooms; game.save.furnitureOwned = d.owned; game.save.roomStyle = d.styles;
      world.refreshFurniture();
      bus.emit('decor:changed', { room: this.room.id });
      toast('Dejaste el cuarto como estaba.');
    }
    this.startOwned = Object.values(game.save.furnitureOwned).reduce((a, b) => a + b, 0);
    this.close();
  }

  private close() {
    if (!active) return;
    active = false;
    window.removeEventListener('keydown', this.onKey, true);
    this.clearGhost(true);
    this.gfx.destroy();
    world.input.off('pointerup', this.handler);
    world.input.off('pointermove', this.moveHandler);
    world.input.off('pointerdown', this.downHandler);
    this.frameObserver?.disconnect();
    this.sheet.remove();
    world.unframeRoom();
    world.decorMode = false;
    clock.resume();
    showHud(true);
    this.reactions();
    game.touch('decor');
    bus.emit('ui:modal', { open: false });
  }

  private setStatus(t: string, kind?: 'ok' | 'bad') {
    this.status.textContent = t;
    this.status.classList.toggle('ok', kind === 'ok');
    this.status.classList.toggle('bad', kind === 'bad');
  }

  private snapshot() {
    this.undo.push(JSON.stringify({ room: game.room(this.room.id), owned: game.save.furnitureOwned, style: game.save.roomStyle[this.room.id] ?? null }));
    if (this.undo.length > 30) this.undo.shift();
  }

  private doUndo() {
    const s = this.undo.pop();
    if (!s) return toast('No hay nada para deshacer.');
    this.clearGhost(true);
    const d = JSON.parse(s);
    game.save.decor[this.room.id] = d.room;
    game.save.furnitureOwned = d.owned;
    if (d.style) game.save.roomStyle[this.room.id] = d.style;
    else delete game.save.roomStyle[this.room.id];
    this.commit();
  }

  private commit() {
    game.touch('decor');
    world.refreshFurniture();
    bus.emit('decor:changed', { room: this.room.id });
    this.renderList();
    this.drawGrid();
  }

  // ------------------------------------------------------------------ lists
  private renderList() {
    const chips = decorChips(game.save.furnitureOwned, FURNITURE);
    if (!chips.some((c) => c.id === this.view)) this.view = firstDecorView(chips);
    this.chips.innerHTML = '';
    for (const chip of chips) {
      const on = chip.id === this.view;
      this.chips.append(h('button', {
        type: 'button',
        class: 'btn small decor-chip' + (on ? ' primary' : ''),
        role: 'tab',
        'aria-selected': on ? 'true' : 'false',
        onclick: () => { this.view = chip.id; this.renderList(); },
      }, chip.label));
    }
    this.list.innerHTML = '';
    this.hint.hidden = true;
    if (this.view === 'room') this.renderRoom();
    else if (this.view === 'style') this.renderStyle();
    else this.renderOwned(this.view as FurnCat);
  }

  private renderOwned(cat: FurnCat) {
    this.list.className = 'decor-tray';
    const ids = Object.entries(game.save.furnitureOwned)
      .filter(([, n]) => n > 0)
      .map(([id, n]) => ({ f: FURN_BY_ID[id], n }))
      .filter((row): row is { f: FurnitureDef; n: number } => !!row.f && row.f.cat === cat)
      .sort((a, b) => a.f.name.localeCompare(b.f.name, 'es'));
    if (!ids.length) {
      this.hint.hidden = false;
      this.hint.textContent = 'No te queda ninguno de estos. Mirá En el cuarto, o comprá en el Almacén de Taro, el puesto de Sumi o el Mercado Nocturno.';
      return;
    }
    for (const { f, n } of ids) this.list.append(this.card(f, n, () => this.pickNew(f.id)));
  }

  private renderRoom() {
    this.list.className = 'decor-tray';
    const placed = game.room(this.room.id).filter((p) => FURN_BY_ID[p.id]);
    if (!placed.length) {
      this.hint.hidden = false;
      this.hint.textContent = 'Todavía no hay muebles en esta habitación. Elegí uno guardado para colocarlo.';
      return;
    }
    for (const p of placed) this.list.append(this.card(FURN_BY_ID[p.id], 0, () => this.pickExisting(p)));
  }

  private renderStyle() {
    this.list.className = 'decor-style';
    const cur = game.save.roomStyle[this.room.id] ?? { floor: this.room.defFloor, wall: this.room.defWall };
    const floors = Object.entries(FLOOR_STYLES).filter(([k, s]) => s.price === 0 || game.has('floor_' + k) || k === this.room.defFloor || k === cur.floor);
    const walls = Object.entries(WALL_STYLES).filter(([k, s]) => s.price === 0 || game.has('wall_' + k) || k === this.room.defWall || k === cur.wall);
    this.list.append(
      this.swatchRow('Piso', floors.map(([k, s]) => this.floorSwatch(k, s.name, s.draw, k === cur.floor))),
      this.swatchRow('Pared', walls.map(([k, s]) => this.wallSwatch(k, s.name, s.base, s.accent, k === cur.wall))),
      h('p', { class: 'decor-style-name' }, `${FLOOR_STYLES[cur.floor]?.name ?? 'Piso'} · ${WALL_STYLES[cur.wall]?.name ?? 'Pared'}`),
    );
    this.hint.hidden = false;
    this.hint.textContent = 'Más pisos y paredes en el Almacén de Taro.';
  }

  private swatchRow(label: string, swatches: HTMLElement[]) {
    return h('div', { class: 'decor-style-row' }, h('span', null, label), h('div', { class: 'decor-swatches' }, ...swatches));
  }

  private floorSwatch(key: string, name: string, draw: (c: CanvasRenderingContext2D, x: number, y: number, r: () => number) => void, on: boolean) {
    const c = document.createElement('canvas');
    c.width = 32;
    c.height = 32;
    const g = c.getContext('2d')!;
    const rnd = styleRand(key);
    draw(g, 0, 0, rnd);
    draw(g, 16, 0, rnd);
    draw(g, 0, 16, rnd);
    draw(g, 16, 16, rnd);
    return h('button', { type: 'button', class: 'btn decor-swatch' + (on ? ' primary' : ''), 'aria-label': name, 'aria-pressed': on ? 'true' : 'false', onclick: () => this.setStyle('floor', key) }, c);
  }

  private wallSwatch(key: string, name: string, base: string, accent: string, on: boolean) {
    const chip = h('i');
    chip.style.background = base;
    chip.style.boxShadow = `inset 0 0 0 6px ${accent}`;
    return h('button', { type: 'button', class: 'btn decor-swatch' + (on ? ' primary' : ''), 'aria-label': name, 'aria-pressed': on ? 'true' : 'false', onclick: () => this.setStyle('wall', key) }, chip);
  }

  private card(f: FurnitureDef, n: number, onClick: () => void) {
    const c = furnitureCanvas(f.id);
    c.className = 'decor-art';
    return h('button', { type: 'button', class: 'btn decor-card', onclick: onClick }, n ? h('span', { class: 'q' }, String(n)) : null, c, h('span', { class: 'decor-name' }, f.name));
  }

  private setStyle(kind: 'floor' | 'wall', k: string) {
    this.snapshot();
    const cur = game.save.roomStyle[this.room.id] ?? { floor: this.room.defFloor, wall: this.room.defWall };
    game.save.roomStyle[this.room.id] = { ...cur, [kind]: k };
    audio.sfxPlay('place');
    this.commit();
  }

  // ------------------------------------------------------------------ ghost placement
  private pickNew(id: string) {
    if (this.ghost && !this.commitGhost()) return;
    const f = FURN_BY_ID[id];
    const spot = this.findFreeSpot(f) ?? { x: this.room.x + 1, y: this.room.y + (f.wall ? 1 : 2) };
    this.ghost = { id, x: spot.x, y: spot.y, rot: 0 };
    this.showGhost();
  }

  private pickExisting(p: PlacedFurniture) {
    if (this.ghost && !this.commitGhost()) return;
    this.ghost = { id: p.id, x: p.x, y: p.y, rot: p.rot, uid: p.uid };
    const spr = world.furnSpriteByUid(p.uid);
    spr?.setAlpha(0.35);
    this.showGhost();
  }

  private showGhost() {
    const g = this.ghost!;
    const f = FURN_BY_ID[g.id];
    this.ghostImg?.destroy();
    this.ghostImg = world.add.image(0, 0, furnTexture(world as unknown as Phaser.Scene, g.id, g.rot)).setOrigin(0.5, 1).setDepth(195000).setAlpha(0.85).setFlipX(!f.rotatable && (g.rot & 2) !== 0);
    this.placeBox.hidden = false;
    this.placeName.textContent = f.name;
    this.actions.innerHTML = '';
    // pieces that cannot turn into another shape are mirrored instead: rot 0 / 2
    const turn = () => { g.rot = f.rotatable ? (g.rot + 1) % 4 : g.rot === 0 ? 2 : 0; this.showGhost(); audio.sfxPlay('tap'); };
    add(this.actions,
      h('button', { type: 'button', class: 'btn', onclick: turn }, f.rotatable ? '↻ Rotar' : '⇆ Girar'),
      g.uid != null ? h('button', { type: 'button', class: 'btn', onclick: () => this.store() }, 'Quitar') : null,
    );
    this.updateGhost();
  }

  private nudge(a: '↑' | '↓' | '←' | '→') {
    if (!this.ghost) return;
    if (a === '↑') this.ghost.y--;
    if (a === '↓') this.ghost.y++;
    if (a === '←') this.ghost.x--;
    if (a === '→') this.ghost.x++;
    this.updateGhost();
  }

  private moveGhostTo(worldX: number, worldY: number) {
    const g = this.ghost;
    if (!g) return;
    const size = furnSize(FURN_BY_ID[g.id], g.rot);
    const next = ghostAnchor(Math.floor(worldX / TILE), Math.floor(worldY / TILE), size.w, size.h);
    if (next.x === g.x && next.y === g.y) return;
    g.x = next.x;
    g.y = next.y;
    this.updateGhost();
  }

  private updateGhost() {
    const g = this.ghost;
    if (!g || !this.ghostImg) return;
    const f = FURN_BY_ID[g.id];
    const size = furnSize(f, g.rot);
    this.ghostImg.setPosition(g.x * TILE + (size.w * TILE) / 2, (g.y + size.h) * TILE + (f.wallOffsetY ?? 0));
    const why = this.blockReason(g);
    this.ghostImg.setTint(why ? 0xf0a0a0 : 0xc8f0c0);
    this.setStatus(why ?? 'Tocá o arrastrá en el cuarto para moverlo. Cuando termines, tocá Listo.', why ? 'bad' : 'ok');
    this.drawGrid();
  }

  private clearGhost(restore: boolean) {
    if (restore && this.ghost?.uid != null) world.furnSpriteByUid(this.ghost.uid)?.setAlpha(1);
    this.ghostImg?.destroy();
    this.ghostImg = null;
    this.ghost = null;
    this.actions.innerHTML = '';
    if (this.placeBox) this.placeBox.hidden = true;
    this.drawGrid();
  }

  private inRoomInterior(x: number, y: number, wall: boolean) {
    const r = this.room;
    const ch = world.zone.def.ground[y]?.[x];
    if (x < r.x || y < r.y || x >= r.x + r.w || y >= r.y + r.h) return false;
    if (roomAt(world.zone.def, x, y)?.id !== r.id) return false;
    if (wall) return ch === 'W' || ch === 'V';
    return ch === 'f' || ch === 'k' || ch === 't';
  }

  private blockReason(g: Ghost): string | null {
    const f = FURN_BY_ID[g.id];
    const size = furnSize(f, g.rot);
    for (let j = 0; j < size.h; j++) for (let i = 0; i < size.w; i++) {
      const x = g.x + i;
      const y = g.y + j;
      if (!this.inRoomInterior(x, y, !!f.wall)) return 'No entra en esta habitación.';
      if (!f.wall && this.propAt(x, y)) return 'Ahí hay un objeto fijo.';
      if (!f.wall && !f.walkable && this.entranceTile(x, y)) return 'Ese paso tiene que quedar libre.';
    }
    if (f.wall) {
      const hit = game.room(this.room.id).some((p) => p.uid !== g.uid && FURN_BY_ID[p.id]?.wall && overlap(p, FURN_BY_ID[p.id], g, f));
      return hit ? 'Ahí ya hay algo colgado.' : null;
    }
    for (const p of game.room(this.room.id)) {
      if (p.uid === g.uid) continue;
      const pf = FURN_BY_ID[p.id];
      if (!pf || pf.wall) continue;
      if (overlap(p, pf, g, f) && (!pf.walkable || f.walkable)) return 'Ahí ya hay un mueble.';
    }
    if (f.walkable) return null;
    const cand: PlacedFurniture = { uid: g.uid ?? -1, id: g.id, x: g.x, y: g.y, rot: g.rot };
    const tiles = furnitureSolidTiles(cand, f);
    if (tiles.some(([x, y]) => x === world.player.tx && y === world.player.ty)) return 'Estás parado ahí.';
    for (const [, n] of world.npcs) if (tiles.some(([x, y]) => x === n.actor.tx && y === n.actor.ty)) return 'Hay alguien parado ahí.';
    return placementBlock(world.zoneId, this.room.id, cand, g.uid);
  }

  private valid(g: Ghost): boolean {
    return this.blockReason(g) === null;
  }

  private propAt(x: number, y: number): boolean {
    return world.zone.props.some((p) => x >= p.x && x < p.x + p.def.w && y >= p.y && y < p.y + p.def.h);
  }

  /** The tile just inside each door, so a table cannot seal the entrance. */
  private entranceTile(x: number, y: number): boolean {
    const r = this.room;
    for (const d of world.zone.def.doors) {
      if (!d.walk) continue;
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
        const nx = d.x + dx;
        const ny = d.y + dy;
        if (nx === x && ny === y && nx >= r.x && ny >= r.y && nx < r.x + r.w && ny < r.y + r.h) return true;
      }
    }
    return false;
  }

  /** Puts the selected piece down where it is. Returns false (and says why) when that spot is not allowed. */
  private commitGhost(): boolean {
    const g = this.ghost;
    if (!g) return true;
    const why = this.blockReason(g);
    if (why) {
      audio.sfxPlay('error');
      this.setStatus(why + ' Movelo a otro lugar.', 'bad');
      return false;
    }
    const list = game.room(this.room.id);
    const before = g.uid != null ? list.find((x) => x.uid === g.uid) : null;
    const moved = !before || before.x !== g.x || before.y !== g.y || before.rot !== g.rot;
    if (moved) this.snapshot();
    if (g.uid != null) {
      if (before) Object.assign(before, { x: g.x, y: g.y, rot: g.rot });
    } else {
      if ((game.save.furnitureOwned[g.id] ?? 0) <= 0) { this.clearGhost(false); return true; }
      game.save.furnitureOwned[g.id]--;
      if (game.save.furnitureOwned[g.id] <= 0) delete game.save.furnitureOwned[g.id];
      list.push({ uid: game.uid(), id: g.id, x: g.x, y: g.y, rot: g.rot });
      game.stat('decorPlaced');
      if (g.id === 'pt_sushi') game.setFlag('placed_pt_sushi');
      if (g.id === 'bamboo_pot') game.setFlag('placed_bamboo_pot');
    }
    if (moved) { game.stat('decorMoves'); audio.sfxPlay('place'); }
    this.clearGhost(false);
    this.commit();
    return true;
  }

  private store() {
    const g = this.ghost;
    if (!g || g.uid == null) return;
    this.snapshot();
    game.save.decor[this.room.id] = game.room(this.room.id).filter((p) => p.uid !== g.uid);
    game.save.furnitureOwned[g.id] = (game.save.furnitureOwned[g.id] ?? 0) + 1;
    game.stat('decorMoves');
    audio.sfxPlay('close');
    this.clearGhost(false);
    this.commit();
  }

  private onDrag(p: Phaser.Input.Pointer) {
    if (!this.ghost || !this.down || !p.isDown) return;
    if (Math.hypot(p.x - this.down.x, p.y - this.down.y) < 10) return;
    this.moveGhostTo(p.worldX, p.worldY);
  }

  private onTap(p: Phaser.Input.Pointer) {
    if (!this.down || Math.hypot(p.x - this.down.x, p.y - this.down.y) > 12) return;
    const tx = Math.floor(p.worldX / TILE);
    const ty = Math.floor(p.worldY / TILE);
    if (this.ghost) {
      this.moveGhostTo(tx * TILE + TILE / 2, ty * TILE + TILE / 2);
      return;
    }
    // select existing furniture (prefer non-rug)
    const hits = game.room(this.room.id).filter((q) => {
      const f = FURN_BY_ID[q.id];
      if (!f) return false;
      const size = furnSize(f, q.rot);
      return tx >= q.x && tx < q.x + size.w && ty >= q.y && ty < q.y + size.h;
    });
    const hit = hits.find((q) => !FURN_BY_ID[q.id].walkable) ?? hits[0];
    if (hit) this.pickExisting(hit);
  }

  private findFreeSpot(f: FurnitureDef): { x: number; y: number } | null {
    for (let y = this.room.y; y < this.room.y + this.room.h; y++)
      for (let x = this.room.x; x < this.room.x + this.room.w; x++) {
        const g = { id: f.id, x, y, rot: 0 };
        if (this.valid(g)) return { x, y };
      }
    return null;
  }

  private drawGrid() {
    const gfx = this.gfx;
    if (!gfx?.active) return;
    gfx.clear();
    const g = this.ghost;
    if (!g) return;
    const f = FURN_BY_ID[g.id];
    const size = furnSize(f, g.rot);
    const ok = this.valid(g);
    gfx.fillStyle(ok ? 0x6f9e6a : 0xc0676b, 0.35);
    gfx.fillRect(g.x * TILE, g.y * TILE, size.w * TILE, size.h * TILE);
  }

  /** raccoons comment on new special furniture in their rooms or the dining room */
  private reactions() {
    const now = Object.values(game.save.furnitureOwned).reduce((a, b) => a + b, 0);
    if (now >= this.startOwned) return;
    const owner = this.room.owner;
    const placed = game.room(this.room.id).map((p) => FURN_BY_ID[p.id]).filter(Boolean);
    const fans = new Set<string>();
    for (const f of placed) for (const l of f.likes ?? []) if (!owner || owner === 'player' || owner === l) fans.add(l);
    const who = [...fans][0];
    if (who && !game.has(`react_${this.room.id}_${who}_${placed.length}`)) {
      game.setFlag(`react_${this.room.id}_${who}_${placed.length}`);
      game.addFriendship(who, 5);
      game.setFlag('decor_' + who + '_liked');
      const lines: Record<string, string> = { pip: '¡Me encanta cómo quedó! Parece un nido. Un nido lindo.', spicy: '¡Esto tiene estilo! Tiene sabor. Tiene... picante decorativo.', rigg: 'Buena elección. Se nota que pensaste dónde va cada cosa.' };
      toast(`${CHAR_BY_ID[who].name}: "${lines[who]}"`);
    }
  }
}

function overlap(a: { x: number; y: number; rot?: number }, af: FurnitureDef, b: { x: number; y: number; rot?: number }, bf: FurnitureDef) {
  const as = furnSize(af, a.rot ?? 0);
  const bs = furnSize(bf, b.rot ?? 0);
  return a.x < b.x + bs.w && a.x + as.w > b.x && a.y < b.y + bs.h && a.y + as.h > b.y;
}

/** Same speckles every time the swatch is drawn, so the sample does not flicker. */
function styleRand(key: string): () => number {
  let seed = 2166136261;
  for (const ch of key) seed = Math.imul(seed ^ ch.charCodeAt(0), 16777619);
  return () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return (seed >>> 0) / 4294967296;
  };
}
