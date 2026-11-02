import { describe, expect, it } from 'vitest';
import { flip, hideOpen, movePlate, newCatch, newMemory, newSnake, PLATE_W, PLATE_Y, snakeDelay, stepCatch, stepSnake, turn } from '../ui/phone/games/logic';

const fixed = (v: number) => () => v;

describe('Víbora', () => {
  it('grows and scores when it eats a maki', () => {
    const s = newSnake(10, 10, fixed(0));
    const head = s.body[0];
    s.food = { x: head.x + 1, y: head.y };
    expect(stepSnake(s, fixed(0))).toBe('eat');
    expect(s.score).toBe(1);
    expect(s.body.length).toBe(4);
  });
  it('ignores a U-turn and keeps two quick turns in order', () => {
    const s = newSnake(10, 10, fixed(0));
    turn(s, 'left');
    expect(s.queue).toEqual([]);
    turn(s, 'up'); turn(s, 'left');
    expect(s.queue).toEqual(['up', 'left']);
  });
  it('ends at the wall and when it bites itself', () => {
    const s = newSnake(6, 6, fixed(0));
    s.food = { x: 0, y: 0 };
    let r = 'move';
    for (let i = 0; i < 6 && r !== 'over'; i++) r = stepSnake(s, fixed(0));
    expect(r).toBe('over');
    const t = newSnake(10, 10, fixed(0));
    t.body = [{ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 4, y: 6 }, { x: 5, y: 6 }, { x: 6, y: 6 }];
    t.dir = 'down';
    expect(stepSnake(t, fixed(0))).toBe('over');
  });
  it('speeds up with the score but not without limit', () => {
    expect(snakeDelay(10)).toBeLessThan(snakeDelay(0));
    expect(snakeDelay(500)).toBeGreaterThan(0.05);
  });
});

describe('Lluvia de sushi', () => {
  it('a sushi on the plate scores, one that falls past costs a heart, a chili on the plate costs a heart', () => {
    const c = newCatch();
    c.spawn = 99;
    movePlate(c, 0.5);
    c.drops = [{ x: 0.5, y: PLATE_Y - 0.01, v: 0.1, kind: 'sushi' }, { x: 0.05, y: 1.03, v: 0.1, kind: 'sushi' }, { x: 0.5 + PLATE_W / 4, y: PLATE_Y, v: 0, kind: 'chili' }];
    const r = stepCatch(c, 0.05);
    expect(r).toEqual({ caught: 1, lost: 1, burnt: 1 });
    expect(c.score).toBe(1);
    expect(c.lives).toBe(1);
  });
  it('ends with no hearts left and keeps the plate on screen', () => {
    const c = newCatch();
    c.lives = 1; c.spawn = 99;
    c.drops = [{ x: 0.95, y: 1.03, v: 0.1, kind: 'sushi' }];
    movePlate(c, 0.1);
    stepCatch(c, 0.05);
    expect(c.over).toBe(true);
    movePlate(c, -5);
    expect(c.plate).toBe(PLATE_W / 2);
  });
});

describe('Memoria', () => {
  it('has every face twice', () => {
    const m = newMemory(8);
    const count = new Map<number, number>();
    for (const c of m.cards) count.set(c.face, (count.get(c.face) ?? 0) + 1);
    expect([...count.values()].every((n) => n === 2)).toBe(true);
    expect(m.cards.length).toBe(16);
  });
  it('keeps a pair face up, hides a miss, counts turns and ends when all are found', () => {
    const m = newMemory(2, fixed(0));
    const a = m.cards.findIndex((c) => c.face === 0), b = m.cards.findIndex((c, i) => c.face === 0 && i !== a);
    const x = m.cards.findIndex((c) => c.face === 1), y = m.cards.findIndex((c, i) => c.face === 1 && i !== x);
    flip(m, a);
    expect(flip(m, x)).toBe('miss');
    expect(flip(m, b)).toBe('none'); // two already open: wait
    hideOpen(m);
    flip(m, a);
    expect(flip(m, b)).toBe('pair');
    flip(m, x);
    expect(flip(m, y)).toBe('pair');
    expect(m.over).toBe(true);
    expect(m.turns).toBe(3);
  });
});
