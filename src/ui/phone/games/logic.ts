/**
 * The three little NoriPhone games, as pure state + steps (no DOM), so they can be tested:
 * - Víbora: the classic snake, eating maki on a small board. Walls and its own tail end the game.
 * - Lluvia de sushi: slide the plate to catch the falling sushi; a missed sushi or a caught chili costs a heart.
 * - Memoria: find the eight pairs of cards in as few turns as possible.
 */
export type Dir4 = 'up' | 'down' | 'left' | 'right';
export type Rand = () => number;
type P = { x: number; y: number };

const DELTA: Record<Dir4, P> = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
const OPPOSITE: Record<Dir4, Dir4> = { up: 'down', down: 'up', left: 'right', right: 'left' };

// ---------------------------------------------------------------- Víbora
export interface Snake { w: number; h: number; body: P[]; dir: Dir4; queue: Dir4[]; food: P; score: number; over: boolean; won: boolean }

export function newSnake(w = 14, h = 14, rand: Rand = Math.random): Snake {
  const y = Math.floor(h / 2), x = Math.floor(w / 2);
  const s: Snake = { w, h, body: [{ x, y }, { x: x - 1, y }, { x: x - 2, y }], dir: 'right', queue: [], food: { x: 0, y: 0 }, score: 0, over: false, won: false };
  placeFood(s, rand);
  return s;
}

/** Up to two turns are remembered between steps, so a quick "up, left" is not lost; a U-turn into itself is ignored. */
export function turn(s: Snake, d: Dir4) {
  const last = s.queue[s.queue.length - 1] ?? s.dir;
  if (d === last || d === OPPOSITE[last] || s.queue.length >= 2) return;
  s.queue.push(d);
}

export function placeFood(s: Snake, rand: Rand = Math.random) {
  const free: P[] = [];
  for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) if (!s.body.some((b) => b.x === x && b.y === y)) free.push({ x, y });
  if (!free.length) { s.won = true; s.over = true; return; }
  s.food = free[Math.floor(rand() * free.length) % free.length];
}

/** One move. Returns what happened, for the sound. */
export function stepSnake(s: Snake, rand: Rand = Math.random): 'move' | 'eat' | 'over' {
  if (s.over) return 'over';
  s.dir = s.queue.shift() ?? s.dir;
  const head = s.body[0], d = DELTA[s.dir];
  const next = { x: head.x + d.x, y: head.y + d.y };
  const eats = next.x === s.food.x && next.y === s.food.y;
  // the tail moves away this step unless it grows, so stepping onto it is fine
  const body = eats ? s.body : s.body.slice(0, -1);
  if (next.x < 0 || next.y < 0 || next.x >= s.w || next.y >= s.h || body.some((b) => b.x === next.x && b.y === next.y)) { s.over = true; return 'over'; }
  s.body = [next, ...body];
  if (!eats) return 'move';
  s.score++;
  placeFood(s, rand);
  return s.over ? 'over' : 'eat';
}

/** Seconds per step: starts calm and speeds up a little with every maki, never frantic. */
export function snakeDelay(score: number) { return Math.max(0.075, 0.2 - score * 0.006); }

// ---------------------------------------------------------------- Lluvia de sushi
export type Drop = { x: number; y: number; v: number; kind: 'sushi' | 'chili' };
export interface Catch { plate: number; drops: Drop[]; score: number; lives: number; t: number; spawn: number; over: boolean }

/** Positions go from 0 to 1 across and down the screen. The plate sits at y = PLATE_Y and is PLATE_W wide. */
export const PLATE_Y = 0.9, PLATE_W = 0.2;

export function newCatch(): Catch { return { plate: 0.5, drops: [], score: 0, lives: 3, t: 0, spawn: 0.6, over: false }; }

export function stepCatch(c: Catch, dt: number, rand: Rand = Math.random): { caught: number; lost: number; burnt: number } {
  const out = { caught: 0, lost: 0, burnt: 0 };
  if (c.over) return out;
  c.t += dt;
  c.spawn -= dt;
  if (c.spawn <= 0) {
    // faster and more often as the score climbs; about one in six is a chili
    c.spawn = Math.max(0.38, 1.1 - c.score * 0.025) * (0.7 + rand() * 0.6);
    c.drops.push({ x: 0.08 + rand() * 0.84, y: -0.05, v: 0.28 + Math.min(0.4, c.score * 0.012) + rand() * 0.08, kind: rand() < 0.17 ? 'chili' : 'sushi' });
  }
  for (const d of c.drops) d.y += d.v * dt;
  c.drops = c.drops.filter((d) => {
    if (d.y >= PLATE_Y - 0.03 && d.y <= PLATE_Y + 0.03 && Math.abs(d.x - c.plate) <= PLATE_W / 2) {
      if (d.kind === 'sushi') { c.score++; out.caught++; } else { c.lives--; out.burnt++; }
      return false;
    }
    if (d.y > 1.02) { if (d.kind === 'sushi') { c.lives--; out.lost++; } return false; }
    return true;
  });
  if (c.lives <= 0) { c.lives = 0; c.over = true; }
  return out;
}

export function movePlate(c: Catch, x: number) { c.plate = Math.max(PLATE_W / 2, Math.min(1 - PLATE_W / 2, x)); }

// ---------------------------------------------------------------- Memoria
export interface Memory { cards: { face: number; open: boolean; done: boolean }[]; turns: number; pick: number[]; over: boolean }

export function newMemory(pairs = 8, rand: Rand = Math.random): Memory {
  const faces = Array.from({ length: pairs * 2 }, (_, i) => i % pairs);
  for (let i = faces.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)) % (i + 1); [faces[i], faces[j]] = [faces[j], faces[i]]; }
  return { cards: faces.map((face) => ({ face, open: false, done: false })), turns: 0, pick: [], over: false };
}

/**
 * Turn a card over. With two open: a pair stays face up; otherwise `hide` is true and the caller waits a moment and calls
 * `hideOpen` (so the player gets to see both).
 */
export function flip(m: Memory, i: number): 'none' | 'open' | 'pair' | 'miss' {
  const c = m.cards[i];
  if (!c || c.open || c.done || m.pick.length >= 2 || m.over) return 'none';
  c.open = true;
  m.pick.push(i);
  if (m.pick.length < 2) return 'open';
  m.turns++;
  const [a, b] = m.pick.map((k) => m.cards[k]);
  if (a.face === b.face) {
    a.done = b.done = true;
    m.pick = [];
    m.over = m.cards.every((k) => k.done);
    return 'pair';
  }
  return 'miss';
}

export function hideOpen(m: Memory) {
  for (const k of m.pick) m.cards[k].open = false;
  m.pick = [];
}
