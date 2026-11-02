/**
 * The NoriPhone games: Víbora, Lluvia de sushi and Memoria (rules in logic.ts). Each opens as a phone screen, drawn on a
 * small pixel canvas. They are only for fun: the best score of each is kept in the save as a flag, nothing else changes.
 * Keyboard (arrows / WASD), swipes and on-screen buttons all work.
 */
import { audio } from '../../../audio/audio';
import { game } from '../../../core/state';
import { h, panel } from '../../dom';
import { flip, hideOpen, movePlate, newCatch, newMemory, newSnake, PLATE_W, PLATE_Y, snakeDelay, stepCatch, stepSnake, turn, type Catch, type Dir4, type Memory, type Snake } from './logic';
import './arcade.css';

const KEYS: Record<string, Dir4> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right' };

function best(id: string): number { return Number(game.flag('arcade_' + id) ?? 0) || 0; }
/** Keeps the new mark if it beats the old one (`low`: fewer is better). Returns true when it is a record. */
function record(id: string, score: number, low = false): boolean {
  const old = best(id);
  if (score <= 0 || (old && (low ? score >= old : score <= old))) return false;
  game.setFlag('arcade_' + id, score);
  return true;
}

function canvas(w: number, hgt: number) {
  const c = h('canvas', { class: 'arc-canvas', width: w, height: hgt });
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  return { c, g };
}

/** A key listener that lives only while the game screen is open and keeps the arrows away from the rest of the game. */
function keys(on: (e: KeyboardEvent) => boolean) {
  const fn = (e: KeyboardEvent) => { if (on(e)) { e.preventDefault(); e.stopPropagation(); } };
  window.addEventListener('keydown', fn, true);
  return () => window.removeEventListener('keydown', fn, true);
}

function loop(tick: (dt: number) => void) {
  let last = performance.now(), raf = 0, alive = true;
  const frame = (now: number) => {
    if (!alive) return;
    tick(Math.min(0.1, (now - last) / 1000));
    last = now;
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return () => { alive = false; cancelAnimationFrame(raf); };
}

// ------------------------------------------------------------------ art
function maki(g: CanvasRenderingContext2D, x: number, y: number, s: number) {
  g.fillStyle = '#2c3b30'; g.fillRect(x + 1, y + 1, s - 2, s - 2);
  g.fillStyle = '#f6f1e6'; g.fillRect(x + 2, y + 2, s - 4, s - 4);
  g.fillStyle = '#ef8a6a'; g.fillRect(x + s / 2 - 2, y + s / 2 - 2, 4, 4);
}
function nigiri(g: CanvasRenderingContext2D, x: number, y: number) {
  g.fillStyle = '#2b1d17'; g.fillRect(x - 7, y - 4, 14, 9);
  g.fillStyle = '#f6f1e6'; g.fillRect(x - 6, y - 1, 12, 5);
  g.fillStyle = '#f08a5a'; g.fillRect(x - 6, y - 3, 12, 3);
  g.fillStyle = '#ffd0b0'; g.fillRect(x - 4, y - 3, 3, 1);
}
function chili(g: CanvasRenderingContext2D, x: number, y: number) {
  g.fillStyle = '#2b1d17'; g.fillRect(x - 3, y - 6, 7, 12);
  g.fillStyle = '#d8402e'; g.fillRect(x - 2, y - 3, 5, 8);
  g.fillStyle = '#4f8a3e'; g.fillRect(x - 1, y - 5, 3, 2);
  g.fillStyle = '#ff9a80'; g.fillRect(x - 1, y - 2, 1, 3);
}

// ------------------------------------------------------------------ Víbora
const CELL = 12;
export function openSnake() {
  let s: Snake = newSnake();
  let wait = 0, started = false;
  const { c, g } = canvas(s.w * CELL, s.h * CELL);
  const score = h('span', { class: 'arc-score' });
  const msg = h('p', { class: 'arc-msg' }, 'Tocá una flecha (o deslizá) para empezar. Comé maki sin chocar las paredes ni tu cola.');
  const show = () => { score.textContent = `Maki: ${s.score} · Récord: ${best('snake')}`; };
  const draw = () => {
    g.fillStyle = '#e9dcbf'; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = '#e1d2b2';
    for (let y = 0; y < s.h; y++) for (let x = (y % 2); x < s.w; x += 2) g.fillRect(x * CELL, y * CELL, CELL, CELL);
    maki(g, s.food.x * CELL, s.food.y * CELL, CELL);
    s.body.forEach((b, i) => {
      g.fillStyle = '#2f5a30'; g.fillRect(b.x * CELL, b.y * CELL, CELL, CELL);
      g.fillStyle = i === 0 ? '#7cc05a' : i % 2 ? '#5fa046' : '#6cb04f'; g.fillRect(b.x * CELL + 1, b.y * CELL + 1, CELL - 2, CELL - 2);
    });
    const head = s.body[0];
    g.fillStyle = '#2b1d17';
    const eyes = s.dir === 'up' || s.dir === 'down' ? [[3, s.dir === 'up' ? 3 : 7], [7, s.dir === 'up' ? 3 : 7]] : [[s.dir === 'left' ? 3 : 7, 3], [s.dir === 'left' ? 3 : 7, 7]];
    for (const [ex, ey] of eyes) g.fillRect(head.x * CELL + ex, head.y * CELL + ey, 2, 2);
    if (s.over) { g.fillStyle = 'rgba(43,29,23,.55)'; g.fillRect(0, 0, c.width, c.height); }
  };
  const go = (d: Dir4) => {
    if (s.over) return;
    if (!started) { started = true; msg.textContent = ''; }
    turn(s, d);
  };
  const restart = () => { s = newSnake(); started = false; wait = 0; msg.textContent = 'Tocá una flecha (o deslizá) para empezar.'; show(); draw(); };
  const stop = loop((dt) => {
    if (!started || s.over) return;
    wait -= dt;
    if (wait > 0) return;
    wait = snakeDelay(s.score);
    const r = stepSnake(s);
    if (r === 'eat') audio.sfxPlay('phone_tap');
    if (r === 'over') {
      audio.sfxPlay('error');
      msg.textContent = (s.won ? '¡Llenaste el tablero! ' : 'Chocaste. ') + (record('snake', s.score) ? `¡Nuevo récord: ${s.score}!` : `Comiste ${s.score}.`);
    }
    show(); draw();
  });
  const unkey = keys((e) => { const d = KEYS[e.code]; if (d) { go(d); return true; } if (e.code === 'Space' && s.over) { restart(); return true; } return false; });
  swipe(c, go);
  const pad = h('div', { class: 'arc-pad' },
    ...(['up', 'left', 'down', 'right'] as Dir4[]).map((d) => h('button', { type: 'button', class: 'arc-key ' + d, 'aria-label': d, onpointerdown: (e: PointerEvent) => { e.preventDefault(); go(d); } }, { up: '▲', down: '▼', left: '◀', right: '▶' }[d])));
  show(); draw();
  panel({ title: 'Víbora', body: [h('div', { class: 'arc' }, score, c, msg, pad)], foot: [h('button', { type: 'button', class: 'btn', onclick: restart }, 'Otra vez')], onClose: () => { stop(); unkey(); } });
}

function swipe(el: HTMLElement, go: (d: Dir4) => void) {
  let start: { x: number; y: number } | null = null;
  el.addEventListener('pointerdown', (e) => { start = { x: e.clientX, y: e.clientY }; });
  el.addEventListener('pointerup', (e) => {
    if (!start) return;
    const dx = e.clientX - start.x, dy = e.clientY - start.y;
    start = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 12) return;
    go(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
  });
}

// ------------------------------------------------------------------ Lluvia de sushi
export function openCatch() {
  const W = 168, H = 200;
  let s: Catch = newCatch();
  let started = false, held = 0;
  const { c, g } = canvas(W, H);
  const score = h('span', { class: 'arc-score' });
  const msg = h('p', { class: 'arc-msg' }, 'Mové el plato (arrastrá, flechas o botones) para atajar el sushi. ¡Esquivá los ajíes!');
  const show = () => { score.textContent = `Sushi: ${s.score} · ${'♥'.repeat(s.lives)}${'♡'.repeat(3 - s.lives)} · Récord: ${best('catch')}`; };
  const draw = () => {
    const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#f7e6c4'); sky.addColorStop(1, '#efd2a6');
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    g.fillStyle = '#8a5a38'; g.fillRect(0, H - 10, W, 10);
    g.fillStyle = '#a8724a'; g.fillRect(0, H - 10, W, 2);
    for (const d of s.drops) (d.kind === 'sushi' ? nigiri : chili)(g, Math.round(d.x * W), Math.round(d.y * H));
    const px = Math.round(s.plate * W), pw = Math.round(PLATE_W * W), py = Math.round(PLATE_Y * H);
    g.fillStyle = '#2b1d17'; g.fillRect(px - pw / 2 - 1, py, pw + 2, 6);
    g.fillStyle = '#f2ead8'; g.fillRect(px - pw / 2, py + 1, pw, 3);
    g.fillStyle = '#3d6eae'; g.fillRect(px - pw / 2 + 2, py + 4, pw - 4, 1);
    if (s.over) { g.fillStyle = 'rgba(43,29,23,.55)'; g.fillRect(0, 0, W, H); }
  };
  const begin = () => { if (!started && !s.over) { started = true; msg.textContent = ''; } };
  const stop = loop((dt) => {
    if (held) { begin(); movePlate(s, s.plate + held * dt * 0.9); }
    if (started && !s.over) {
      const r = stepCatch(s, dt);
      if (r.caught) audio.sfxPlay('phone_tap');
      if (r.lost || r.burnt) audio.sfxPlay('error');
      if (s.over) msg.textContent = record('catch', s.score) ? `¡Nuevo récord: ${s.score}!` : `Se terminó: atajaste ${s.score}.`;
      show();
    }
    draw();
  });
  const aim = (e: PointerEvent) => { const r = c.getBoundingClientRect(); begin(); movePlate(s, (e.clientX - r.left) / r.width); };
  c.addEventListener('pointerdown', (e) => { c.setPointerCapture(e.pointerId); aim(e); });
  c.addEventListener('pointermove', (e) => { if (e.buttons || e.pointerType === 'mouse') aim(e); });
  const down = new Set<string>();
  const unkey = keys((e) => {
    const d = KEYS[e.code];
    if (d !== 'left' && d !== 'right') return false;
    down.add(e.code); held = d === 'left' ? -1 : 1;
    return true;
  });
  const up = (e: KeyboardEvent) => { if (!down.delete(e.code)) return; held = [...down].some((k) => KEYS[k] === 'left') ? -1 : [...down].some((k) => KEYS[k] === 'right') ? 1 : 0; };
  window.addEventListener('keyup', up, true);
  const hold = (dir: -1 | 1, label: string) => {
    const b = h('button', { type: 'button', class: 'arc-key wide', 'aria-label': dir < 0 ? 'Izquierda' : 'Derecha' }, label);
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); held = dir; });
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, () => { if (held === dir) held = 0; });
    return b;
  };
  const restart = () => { s = newCatch(); started = false; msg.textContent = 'Mové el plato para empezar.'; show(); };
  show(); draw();
  panel({ title: 'Lluvia de sushi', body: [h('div', { class: 'arc' }, score, c, msg, h('div', { class: 'arc-row' }, hold(-1, '◀'), hold(1, '▶')))], foot: [h('button', { type: 'button', class: 'btn', onclick: restart }, 'Otra vez')], onClose: () => { stop(); unkey(); window.removeEventListener('keyup', up, true); } });
}

// ------------------------------------------------------------------ Memoria
const FACES = ['🍣', '🍙', '🍤', '🐟', '🍵', '🦝', '🌸', '🏮'];
export function openMemory() {
  let m: Memory = newMemory(FACES.length);
  let timer = 0;
  const score = h('span', { class: 'arc-score' });
  const msg = h('p', { class: 'arc-msg' }, 'Encontrá los 8 pares en la menor cantidad de turnos.');
  const grid = h('div', { class: 'arc-memo', role: 'grid' });
  const show = () => { const b = best('memo'); score.textContent = `Turnos: ${m.turns} · Récord: ${b ? b : '—'}`; };
  const render = () => {
    grid.innerHTML = '';
    m.cards.forEach((card, i) => {
      const up = card.open || card.done;
      grid.append(h('button', {
        type: 'button', class: 'arc-card' + (up ? ' up' : '') + (card.done ? ' done' : ''), 'aria-label': up ? FACES[card.face] : 'Carta boca abajo',
        onclick: () => {
          const r = flip(m, i);
          if (r === 'none') return;
          audio.sfxPlay(r === 'pair' ? 'phone_swap' : 'phone_tap');
          if (r === 'miss') { clearTimeout(timer); timer = window.setTimeout(() => { hideOpen(m); render(); }, 750); }
          if (m.over) msg.textContent = record('memo', m.turns, true) ? `¡Nuevo récord: ${m.turns} turnos!` : `¡Listo! ${m.turns} turnos.`;
          show(); render();
        },
      }, up ? FACES[card.face] : ''));
    });
  };
  const restart = () => { clearTimeout(timer); m = newMemory(FACES.length); msg.textContent = 'Encontrá los 8 pares en la menor cantidad de turnos.'; show(); render(); };
  show(); render();
  panel({ title: 'Memoria', body: [h('div', { class: 'arc' }, score, grid, msg)], foot: [h('button', { type: 'button', class: 'btn', onclick: restart }, 'Otra vez')], onClose: () => clearTimeout(timer) });
}
