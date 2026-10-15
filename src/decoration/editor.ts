/**
 * Grid-based interior decoration editor running on top of the world scene.
 * Place / move / rotate / store furniture, change floors & walls, undo, path-safety validation.
 */
import Phaser from 'phaser';
import { drawObject } from '../art/objects';
import { FLOOR_STYLES, WALL_STYLES } from '../art/tiles';
import { audio } from '../audio/audio';
import { bus } from '../core/events';
import { game } from '../core/state';
import type { PlacedFurniture } from '../core/types';
import { CHAR_BY_ID } from '../data/characters';
import { FURN_BY_ID, furnSize, type FurnitureDef } from '../data/furniture';
import type { RoomDef } from '../data/zones';
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
  private list!: HTMLElement;
  private actions!: HTMLElement;
  private status!: HTMLElement;
  private gfx!: Phaser.GameObjects.Graphics;
  private ghostImg: Phaser.GameObjects.Image | null = null;
  private ghost: Ghost | null = null;
  private undo: string[] = [];
  private tab = 0;
  private handler = (p: Phaser.Input.Pointer) => this.onTap(p);
  private down: { x: number; y: number } | null = null;
  private downHandler = (p: Phaser.Input.Pointer) => (this.down = { x: p.x, y: p.y });
  private startOwned = 0;

  constructor(private room: RoomDef) {}

  open() {
    active = true;
    world.decorMode = true;
    world.player.stop();
    clock.pause();
    showHud(false);
    this.gfx = world.add.graphics().setDepth(190000);
    world.input.on('pointerdown', this.downHandler);
    world.input.on('pointerup', this.handler);
    this.status = h('div', { class: 'hint', style: { color: '#f6ecd6' } });
    this.actions = h('div', { class: 'row', style: { flexWrap: 'wrap', gap: '6px' } });
    this.list = h('div', { class: 'cook-tray', style: { minHeight: '92px' } });
    const tabs = h('div', { class: 'row', style: { gap: '6px' } });
    const tabBtns = ['Guardados', 'En la habitación', 'Piso y pared'].map((n, i) =>
      h('button', { class: 'btn small' + (i === 0 ? ' primary' : ''), onclick: () => { this.tab = i; tabBtns.forEach((b, j) => b.classList.toggle('primary', j === i)); this.renderList(); } }, n),
    );
    tabs.append(...tabBtns);
    this.sheet = h(
      'div',
      { class: 'decor-sheet', role: 'dialog', 'aria-label': `Decorar: ${this.room.name}`, style: { position: 'fixed', left: '0', right: '0', bottom: '0', padding: '8px calc(8px + var(--safe-r)) calc(8px + var(--safe-b)) calc(8px + var(--safe-l))', background: 'rgba(31,36,64,.92)', borderTop: '3px solid #46291f', display: 'flex', flexDirection: 'column', gap: '6px', zIndex: '25' } },
      h('div', { class: 'row', style: { justifyContent: 'space-between', flexWrap: 'wrap' } },
        h('b', { style: { color: '#f2c66d' } }, `Decorar: ${this.room.name}`),
        h('div', { class: 'row', style: { gap: '6px' } }, h('button', { class: 'btn small', onclick: () => this.doUndo() }, 'Deshacer'), h('button', { class: 'btn small primary', onclick: () => this.close() }, 'Listo'))),
      tabs, this.list, this.actions, this.status,
    );
    uiRoot().append(this.sheet);
    (this.sheet as any).__close = () => this.close();
    window.addEventListener('keydown', this.onKey, true);
    this.sheet.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
    this.startOwned = Object.values(game.save.furnitureOwned).reduce((a, b) => a + b, 0);
    this.renderList();
    this.drawGrid();
    this.setStatus('Elegí un mueble guardado o tocá uno de la habitación.');
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

  private close() {
    if (!active) return;
    active = false;
    window.removeEventListener('keydown', this.onKey, true);
    this.clearGhost(true);
    this.gfx.destroy();
    world.input.off('pointerup', this.handler);
    world.input.off('pointerdown', this.downHandler);
    this.sheet.remove();
    world.decorMode = false;
    clock.resume();
    showHud(true);
    this.reactions();
    game.touch('decor');
    bus.emit('ui:modal', { open: false });
  }

  private setStatus(t: string) {
    this.status.textContent = t;
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
    this.list.innerHTML = '';
    this.actions.innerHTML = '';
    if (this.tab === 0) {
      const ids = Object.entries(game.save.furnitureOwned).filter(([, n]) => n > 0);
      if (!ids.length) this.list.append(h('div', { class: 'hint', style: { color: '#f6ecd6', padding: '8px' } }, 'No tenés muebles guardados. Comprá en el Almacén de Taro, el puesto de Sumi o el Mercado Nocturno.'));
      for (const [id, n] of ids) {
        const f = FURN_BY_ID[id];
        if (!f) continue;
        this.list.append(this.card(f, n, () => this.pickNew(id)));
      }
    } else if (this.tab === 1) {
      for (const p of game.room(this.room.id)) {
        const f = FURN_BY_ID[p.id];
        if (!f) continue;
        this.list.append(this.card(f, 0, () => this.pickExisting(p)));
      }
    } else {
      const floors = Object.entries(FLOOR_STYLES).filter(([k, s]) => s.price === 0 || game.has('floor_' + k) || k === this.room.defFloor);
      const walls = Object.entries(WALL_STYLES).filter(([k, s]) => s.price === 0 || game.has('wall_' + k) || k === this.room.defWall);
      for (const [k, s] of floors) {
        const c = document.createElement('canvas');
        c.width = 16;
        c.height = 16;
        s.draw(c.getContext('2d')!, 0, 0, Math.random);
        c.style.cssText = 'width:36px;height:36px;image-rendering:pixelated';
        this.list.append(h('button', { class: 'ing', onclick: () => this.setStyle('floor', k) }, c, h('span', null, s.name)));
      }
      for (const [k, s] of walls) this.list.append(h('button', { class: 'ing', onclick: () => this.setStyle('wall', k) }, h('div', { style: { width: '36px', height: '36px', background: s.base, border: `3px solid ${s.accent}`, borderRadius: '4px' } }), h('span', null, s.name)));
      this.list.append(h('div', { class: 'hint', style: { color: '#f6ecd6', padding: '6px', maxWidth: '160px' } }, 'Más pisos y paredes en el Almacén de Taro.'));
    }
  }

  private card(f: FurnitureDef, n: number, onClick: () => void) {
    const c = drawObject(f.kind, f.w * 16, f.sh, f.c1, f.c2 || f.c1, f.variant ?? 0);
    c.style.cssText = `width:${Math.min(44, f.w * 22)}px;max-height:44px;image-rendering:pixelated`;
    return h('button', { class: 'ing', style: { width: '86px' }, onclick: onClick }, n ? h('span', { class: 'q' }, n) : null, c, h('span', null, f.name));
  }

  private setStyle(kind: 'floor' | 'wall', k: string) {
    this.snapshot();
    const cur = game.save.roomStyle[this.room.id] ?? { floor: this.room.defFloor, wall: this.room.defWall };
    game.save.roomStyle[this.room.id] = { ...cur, [kind]: k };
    audio.sfxPlay('place');
    this.commit();
    this.renderList();
  }

  // ------------------------------------------------------------------ ghost placement
  private pickNew(id: string) {
    this.clearGhost(true);
    const f = FURN_BY_ID[id];
    const spot = this.findFreeSpot(f) ?? { x: this.room.x + 1, y: this.room.y + (f.wall ? 1 : 2) };
    this.ghost = { id, x: spot.x, y: spot.y, rot: 0 };
    this.showGhost();
  }

  private pickExisting(p: PlacedFurniture) {
    this.clearGhost(true);
    this.ghost = { id: p.id, x: p.x, y: p.y, rot: p.rot, uid: p.uid };
    const spr = world.furnSpriteByUid(p.uid);
    spr?.setAlpha(0.35);
    this.showGhost();
  }

  private showGhost() {
    const g = this.ghost!;
    const f = FURN_BY_ID[g.id];
    this.ghostImg?.destroy();
    this.ghostImg = world.add.image(0, 0, furnTexture(world as unknown as Phaser.Scene, g.id, g.rot)).setOrigin(0.5, 1).setDepth(195000).setAlpha(0.85);
    this.updateGhost();
    this.actions.innerHTML = '';
    add(this.actions,
      h('button', { class: 'btn small primary', onclick: () => this.place() }, 'Colocar acá'),
      f.rotatable ? h('button', { class: 'btn small', onclick: () => { g.rot = (g.rot + 1) % 4; this.showGhost(); audio.sfxPlay('tap'); } }, 'Rotar') : null,
      ...(['↑', '↓', '←', '→'] as const).map((a) => h('button', { class: 'btn small', onclick: () => this.nudge(a) }, a)),
      g.uid != null ? h('button', { class: 'btn small rose', onclick: () => this.store() }, 'Guardar') : null,
      h('button', { class: 'btn small', onclick: () => { this.clearGhost(true); this.renderList(); } }, 'Cancelar'),
    );
  }

  private nudge(a: '↑' | '↓' | '←' | '→') {
    if (!this.ghost) return;
    if (a === '↑') this.ghost.y--;
    if (a === '↓') this.ghost.y++;
    if (a === '←') this.ghost.x--;
    if (a === '→') this.ghost.x++;
    this.updateGhost();
  }

  private updateGhost() {
    const g = this.ghost;
    if (!g || !this.ghostImg) return;
    const f = FURN_BY_ID[g.id];
    const size = furnSize(f, g.rot);
    this.ghostImg.setPosition(g.x * TILE + (size.w * TILE) / 2, (g.y + size.h) * TILE);
    const why = this.blockReason(g);
    this.ghostImg.setTint(why ? 0xf0a0a0 : 0xc8f0c0);
    this.setStatus(why ?? (f.wall ? 'Verde: se puede colgar.' : 'Verde: se puede colocar.'));
    this.drawGrid();
  }

  private clearGhost(restore: boolean) {
    if (restore && this.ghost?.uid != null) world.furnSpriteByUid(this.ghost.uid)?.setAlpha(1);
    this.ghostImg?.destroy();
    this.ghostImg = null;
    this.ghost = null;
    this.actions.innerHTML = '';
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

  private place() {
    const g = this.ghost;
    if (!g) return;
    const why = this.blockReason(g);
    if (why) {
      audio.sfxPlay('error');
      this.setStatus(why);
      return;
    }
    this.snapshot();
    const list = game.room(this.room.id);
    if (g.uid != null) {
      const p = list.find((x) => x.uid === g.uid);
      if (p) Object.assign(p, { x: g.x, y: g.y, rot: g.rot });
    } else {
      if ((game.save.furnitureOwned[g.id] ?? 0) <= 0) return;
      game.save.furnitureOwned[g.id]--;
      if (game.save.furnitureOwned[g.id] <= 0) delete game.save.furnitureOwned[g.id];
      list.push({ uid: game.uid(), id: g.id, x: g.x, y: g.y, rot: g.rot });
      game.stat('decorPlaced');
    }
    game.stat('decorMoves');
    audio.sfxPlay('place');
    this.clearGhost(false);
    this.commit();
    this.setStatus('¡Listo! Podés seguir decorando.');
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

  private onTap(p: Phaser.Input.Pointer) {
    if (!this.down || Math.hypot(p.x - this.down.x, p.y - this.down.y) > 12) return;
    const tx = Math.floor(p.worldX / TILE);
    const ty = Math.floor(p.worldY / TILE);
    if (this.ghost) {
      const f = FURN_BY_ID[this.ghost.id];
      const size = furnSize(f, this.ghost.rot);
      this.ghost.x = tx - Math.floor((size.w - 1) / 2);
      this.ghost.y = ty - (size.h - 1);
      this.updateGhost();
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
    gfx.clear();
    const r = this.room;
    gfx.lineStyle(1, 0xf6ecd6, 0.25);
    for (let y = r.y; y < r.y + r.h; y++)
      for (let x = r.x; x < r.x + r.w; x++) {
        if (!this.inRoomInterior(x, y, false) && !this.inRoomInterior(x, y, true)) continue;
        gfx.strokeRect(x * TILE + 0.5, y * TILE + 0.5, TILE - 1, TILE - 1);
      }
    const g = this.ghost;
    if (g) {
      const f = FURN_BY_ID[g.id];
      const size = furnSize(f, g.rot);
      const ok = this.valid(g);
      gfx.fillStyle(ok ? 0x6f9e6a : 0xc0676b, 0.35);
      gfx.fillRect(g.x * TILE, g.y * TILE, size.w * TILE, size.h * TILE);
    }
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
