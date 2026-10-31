/** In-game camera: snapshots the world canvas into a small album thumbnail. */
import { audio } from '../audio/audio';
import { game } from '../core/state';
import { CHAR_BY_ID } from '../data/characters';
import { ZONES } from '../data/zones';
import { TILE } from '../entities/Actor';
import { isTypingTarget } from '../input/bindings';
import { world } from '../scenes/WorldScene';
import { h, openModal, panel, sleep, toast } from './dom';
import {
  clampFrameZoom,
  panScroll,
  photoSubject,
  scrollUnderPoint,
  walkingZoom,
  zoomLabel,
  zoomScroll,
  zoomStep,
  type PhotoView,
} from './frameMath';
import { showHud } from './hud';
import { isPhoneOpen } from './phone/phone';

let framing = false;

/** Instant shot of wherever Sofi is looking. Dialogue, the menu and companions use this. */
export async function takePhoto() {
  if (!world?.player) return;
  showHud(false);
  await sleep(60);
  const focus = { x: world.player.x, y: world.player.y };
  world.game.renderer.snapshot((img: unknown) => {
    showHud(true);
    if (!(img instanceof HTMLImageElement)) return;
    const done = () => presentSnapshot(img, focus, null);
    if (img.complete) done();
    else img.onload = done;
  }, 'image/png');
}

/**
 * Phone camera. Drag to choose the frame, pinch or use + and − to zoom, then shoot.
 * The visor is DOM, so it stays out of the picture.
 */
export function openCamera() {
  if (!world?.player || framing || world.cookActive) return;
  framing = true;
  const inPhone = isPhoneOpen();
  world.beginPhotoFrame();
  if (!inPhone) showHud(false);

  const zoomEl = h('span', { class: 'cam-zoom', 'aria-live': 'polite' }, '1×');
  const minus = h('button', { type: 'button', class: 'btn cam-step', 'aria-label': 'Alejar' }, '−');
  const plus = h('button', { type: 'button', class: 'btn cam-step', 'aria-label': 'Acercar' }, '+');
  const shutter = h('button', { type: 'button', class: 'btn primary cam-shutter' }, 'Sacar foto');
  const cancel = h('button', { type: 'button', class: 'btn small' }, inPhone ? '‹ Volver' : 'Cancelar');
  const live = h('canvas', { class: 'cam-live', width: 480, height: 320, 'aria-label': 'Vista en vivo de la cámara' });
  const finder = h(
    'div',
    { class: 'cam-finder' + (inPhone ? ' pn-camera' : ''), role: inPhone ? 'region' : 'dialog', 'aria-modal': inPhone ? undefined : 'true', 'aria-label': 'Cámara' },
    h('div', { class: 'cam-top' }, cancel, inPhone ? h('b', null, 'Cámara') : null, h('p', { class: 'cam-hint' }, 'Arrastrá para encuadrar. Pellizcá o usá + y − para acercar.')),
    inPhone ? h('div', { class: 'cam-live-wrap' }, live) : null,
    h('div', { class: 'cam-bar' }, minus, zoomEl, plus, shutter),
  );
  let lastPreview = 0;
  const paintPreview = () => {
    const now = performance.now(); if (now - lastPreview < 50 || !live.isConnected) return;
    lastPreview = now;
    const source = world.game.canvas, height = Math.max(1, Math.round(480 * source.height / source.width));
    if (live.height !== height) live.height = height;
    const ctx = live.getContext('2d')!; ctx.imageSmoothingEnabled = false;
    ctx.drawImage(source, 0, 0, live.width, live.height);
  };

  const ac = new AbortController();
  const listen = { signal: ac.signal };
  const pointers = new Map<number, { x: number; y: number }>();
  let pinch: { dist: number; zoom: number; wx: number; wy: number } | null = null;
  let wheelAcc = 0;
  let shooting = false;
  let closed = false;
  let closeModal = () => {};

  const finish = () => {
    if (closed) return;
    closed = true;
    ac.abort();
    if (inPhone) world.game.events.off('postrender', paintPreview);
    closeModal();
    world.endPhotoFrame();
    if (!inPhone) showHud(true);
    framing = false;
  };
  (finder as HTMLElement & { __close?: () => void }).__close = finish;
  closeModal = openModal(finder, () => { if (!closed) finish(); });
  if (inPhone) world.game.events.on('postrender', paintPreview);

  const fit = () => walkingZoom(world.scale.width, world.scale.height, TILE);
  const refreshZoom = () => {
    const cam = world.cameras.main;
    const base = fit();
    const label = zoomLabel(cam.zoom, base);
    zoomEl.textContent = label;
    zoomEl.setAttribute('aria-label', 'Zoom ' + label);
    minus.disabled = shooting || cam.zoom <= base;
    plus.disabled = shooting || cam.zoom >= base * 3;
    shutter.disabled = shooting;
  };
  const applyZoom = (next: number, sx: number, sy: number) => {
    const cam = world.cameras.main;
    const z = clampFrameZoom(next, fit());
    if (z === cam.zoom) return;
    const sc = zoomScroll(cam.scrollX, cam.scrollY, cam.zoom, z, sx, sy);
    world.applyPhotoFrame(sc.scrollX, sc.scrollY, z);
    refreshZoom();
  };
  const step = (dir: number) => {
    if (shooting || closed) return;
    const cam = world.cameras.main;
    applyZoom(cam.zoom + dir * zoomStep(fit()), cam.width / 2, cam.height / 2);
  };

  minus.addEventListener('click', () => step(-1), listen);
  plus.addEventListener('click', () => step(1), listen);
  cancel.addEventListener('click', () => finish(), listen);
  shutter.addEventListener('click', () => shoot(), listen);

  finder.addEventListener('pointerdown', (e) => {
    if (shooting || (e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { finder.setPointerCapture(e.pointerId); } catch { /* the drag still follows pointermove */ }
    if (pointers.size >= 2) armPinch();
  }, { ...listen, passive: false });
  finder.addEventListener('pointermove', (e) => {
    if (shooting || closed || !pointers.has(e.pointerId)) return;
    const prev = pointers.get(e.pointerId)!;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size >= 2) {
      if (!pinch) armPinch();
      applyPinch();
      return;
    }
    const a = gamePoint(prev.x, prev.y);
    const b = gamePoint(e.clientX, e.clientY);
    const cam = world.cameras.main;
    const p = panScroll(cam.scrollX, cam.scrollY, b.x - a.x, b.y - a.y, cam.zoom);
    world.applyPhotoFrame(p.scrollX, p.scrollY, cam.zoom);
  }, listen);
  const lift = (e: PointerEvent) => {
    pointers.delete(e.pointerId);
    pinch = null;
  };
  finder.addEventListener('pointerup', lift, listen);
  finder.addEventListener('pointercancel', lift, listen);
  finder.addEventListener('wheel', (e) => {
    if (shooting || closed) return;
    e.preventDefault();
    wheelAcc += e.deltaY;
    if (Math.abs(wheelAcc) < 40) return;
    const dir = wheelAcc > 0 ? -1 : 1;
    wheelAcc = 0;
    const at = gamePoint(e.clientX, e.clientY);
    stepToward(dir, at.x, at.y);
  }, { ...listen, passive: false });
  finder.addEventListener('contextmenu', (e) => e.preventDefault(), listen);
  window.addEventListener('keydown', (e) => {
    if (closed || isTypingTarget(e.target)) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      finish();
      return;
    }
    if (e.key === '+' || e.key === '=') { e.preventDefault(); step(1); }
    else if (e.key === '-' || e.key === '_') { e.preventDefault(); step(-1); }
  }, { ...listen, capture: true });

  refreshZoom();
  shutter.focus({ preventScroll: true });

  function stepToward(dir: number, sx: number, sy: number) {
    if (shooting || closed) return;
    applyZoom(world.cameras.main.zoom + dir * zoomStep(fit()), sx, sy);
  }

  function gamePoint(clientX: number, clientY: number) {
    const cam = world.cameras.main;
    const rect = (inPhone ? live : world.game.canvas).getBoundingClientRect();
    if (inPhone) {
      const aspect = live.width / live.height, width = Math.min(rect.width, rect.height * aspect), height = width / aspect;
      return { x: (clientX - rect.left - (rect.width - width) / 2) * cam.width / width, y: (clientY - rect.top - (rect.height - height) / 2) * cam.height / height };
    }
    const sx = rect.width > 0 ? cam.width / rect.width : 1;
    const sy = rect.height > 0 ? cam.height / rect.height : 1;
    return { x: (clientX - rect.left) * sx, y: (clientY - rect.top) * sy };
  }

  function pinchGeom() {
    if (pointers.size < 2) return null;
    const [p, q] = [...pointers.values()];
    const a = gamePoint(p.x, p.y);
    const b = gamePoint(q.x, q.y);
    return { dist: Math.hypot(b.x - a.x, b.y - a.y), sx: (a.x + b.x) / 2, sy: (a.y + b.y) / 2 };
  }

  function armPinch() {
    const g = pinchGeom();
    if (!g || g.dist < 12) { pinch = null; return; }
    const cam = world.cameras.main;
    pinch = { dist: g.dist, zoom: cam.zoom, wx: cam.scrollX + g.sx / cam.zoom, wy: cam.scrollY + g.sy / cam.zoom };
  }

  function applyPinch() {
    if (!pinch || shooting) return;
    const g = pinchGeom();
    if (!g || g.dist < 12) return;
    const z = clampFrameZoom(pinch.zoom * (g.dist / pinch.dist), fit());
    const sc = scrollUnderPoint(pinch.wx, pinch.wy, g.sx, g.sy, z);
    world.applyPhotoFrame(sc.scrollX, sc.scrollY, z);
    refreshZoom();
  }

  function shoot() {
    if (shooting || closed || !world.player) return;
    shooting = true;
    refreshZoom();
    const cam = world.cameras.main;
    const focus = { x: cam.midPoint.x, y: cam.midPoint.y };
    const wv = cam.worldView;
    const view: PhotoView = { x: wv.x, y: wv.y, right: wv.right, bottom: wv.bottom };
    // The renderer reads the next painted frame. Leave the scroll alone until that image comes back.
    world.game.renderer.snapshot((img: unknown) => {
      if (closed) return;
      finish();
      if (!(img instanceof HTMLImageElement)) {
        toast('No se pudo sacar la foto.');
        return;
      }
      const show = () => presentSnapshot(img, focus, view);
      if (img.complete) show();
      else img.onload = show;
    }, 'image/png');
  }
}

function photoActors() {
  const out = [];
  for (const [id, n] of world.npcs) {
    const def = CHAR_BY_ID[id];
    out.push({ id, name: def?.name ?? id, x: n.actor.x, y: n.actor.y, raccoon: !!def?.raccoon });
  }
  return out;
}

function presentSnapshot(img: HTMLImageElement, focus: { x: number; y: number }, view: PhotoView | null) {
  const maxW = 200;
  const scale = Math.min(1, maxW / img.width);
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * scale);
  c.height = Math.round(img.height * scale);
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  g.drawImage(img, 0, 0, c.width, c.height);
  const data = c.toDataURL('image/jpeg', 0.7);
  const shot = photoSubject(photoActors(), focus, ZONES[world.zoneId]?.name ?? 'Villa Nori', view);
  for (const id of shot.raccoons) game.setFlag('photo_raccoon_' + id);
  audio.sfxPlay('camera');
  const flash = h('div', { style: { position: 'fixed', inset: '0', background: '#fff', opacity: '.6', zIndex: '90', pointerEvents: 'none', transition: 'opacity .3s' } });
  document.body.append(flash);
  setTimeout(() => (flash.style.opacity = '0'), 30);
  setTimeout(() => flash.remove(), 400);
  const photo = { id: game.uid(), day: game.save.time.day, zone: world.zoneId, subject: shot.subject, data };
  panel({
    title: 'Foto',
    body: h('div', { class: 'col', style: { alignItems: 'center' } }, h('img', { src: data, style: { width: '100%', maxWidth: '360px', imageRendering: 'pixelated', borderRadius: '8px', border: '3px solid #46291f' } }), h('div', { class: 'hint' }, shot.subject)),
    foot: [
      h('button', { class: 'btn', onclick: (e: Event) => ((e.target as HTMLElement).closest('.panel-backdrop') as HTMLElement & { __close?: () => void }).__close?.() }, 'Descartar'),
      h('button', {
        class: 'btn primary',
        onclick: (e: Event) => {
          if (game.save.photos.length >= 60) game.save.photos.shift();
          game.save.photos.push(photo);
          game.stat('photos');
          game.touch('photo');
          toast('Guardada en el álbum.');
          ((e.target as HTMLElement).closest('.panel-backdrop') as HTMLElement & { __close?: () => void }).__close?.();
        },
      }, 'Guardar en el álbum'),
    ],
  });
}
