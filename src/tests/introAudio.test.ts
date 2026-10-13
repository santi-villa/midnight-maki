import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('../audio/audio', () => ({ audio: { unlock: vi.fn() } }));
vi.mock('../core/settings', () => ({ settings: { ambience: 1, sfx: 1 } }));
import { applyIntroCue, stopIntroAudio } from '../story/introAudio';

const callbacks = new Map<number, FrameRequestCallback>();
let id = 0;
const elements: FakeAudio[] = [];
class FakeAudio {
  src: string;
  loop = false;
  preload = '';
  paused = true;
  private v = 1;
  get volume() { return this.v; }
  set volume(v: number) {
    if (v < 0 || v > 1) throw new RangeError('Invalid media volume');
    this.v = v;
  }
  constructor(src: string) { this.src = src; elements.push(this); }
  getAttribute() { return this.src; }
  removeAttribute() { this.src = ''; }
  play() { this.paused = false; return Promise.resolve(); }
  pause() { this.paused = true; }
  load() {}
  addEventListener() {}
}
beforeEach(() => {
  callbacks.clear(); elements.length = 0;
  vi.stubGlobal('Audio', FakeAudio);
  vi.stubGlobal('window', { addEventListener: vi.fn(), removeEventListener: vi.fn(), setTimeout });
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { callbacks.set(++id, cb); return id; });
  vi.stubGlobal('cancelAnimationFrame', (n: number) => callbacks.delete(n));
  vi.spyOn(performance, 'now').mockReturnValue(1000);
});
afterEach(async () => { await stopIntroAudio(0); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('clamps an animation-frame timestamp preceding performance.now instead of throwing globally', () => {
  applyIntroCue({ sound: 'rain_window', kind: 'bed', volume: 0.34, fade: 1.5 });
  const tick = [...callbacks.values()][0];
  expect(() => tick(999.95)).not.toThrow();
  expect(elements[0].volume).toBe(0);
  expect(() => tick(3000)).not.toThrow();
  expect(elements[0].volume).toBeCloseTo(0.34 * 0.55);
  expect(elements[0].loop).toBe(true);
});
