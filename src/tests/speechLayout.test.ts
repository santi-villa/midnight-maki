import { expect, it } from 'vitest';
import { layoutSpeech, type SpeechRect } from '../ui/speechLayout';
const overlaps = (a: SpeechRect, b: SpeechRect) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
it('separates three simultaneous neighboring bubbles inside a small camera', () => {
  const view = { x: 40, y: 60, width: 180, height: 160 };
  const result = layoutSpeech([0, 1, 2].map(() => ({ x: 30, y: 66, width: 108, height: 28 })), view);
  for (let i = 0; i < result.length; i++) {
    const r = result[i];
    expect(r.x).toBeGreaterThanOrEqual(view.x); expect(r.y).toBeGreaterThanOrEqual(view.y);
    expect(r.x + r.width).toBeLessThanOrEqual(view.x + view.width); expect(r.y + r.height).toBeLessThanOrEqual(view.y + view.height);
    for (const b of result.slice(i + 1)) expect(overlaps(r, b)).toBe(false);
  }
});
it('preserves clear bubbles and does not mutate their natural positions', () => {
  const rects = [{ x: 10, y: 10, width: 40, height: 20 }, { x: 90, y: 40, width: 40, height: 20 }];
  expect(layoutSpeech(rects, { x: 0, y: 0, width: 180, height: 100 })).toEqual(rects);
});
