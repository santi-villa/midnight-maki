import { PixBuf } from './pixbuf';
import type { ShopPhase } from '../systems/schedule';

export function shutterLevel(phase: ShopPhase): number {
  return phase === 'open' ? 0 : phase === 'closed' ? 1 : 0.5;
}

/** Warm grey metal, horizontal slats and two recessed guide rails. No new collision. */
export function shopShutter(w: number, h: number): PixBuf {
  const b = new PixBuf(w, h);
  b.rect(0, 0, w, h, '#49454b').rect(1, 1, w - 2, h - 1, '#7b8080');
  for (let y = 1; y < h; y += 4) {
    b.hline(2, y, w - 4, '#a5aaa2').hline(2, y + 1, w - 4, '#8d9390');
    b.hline(2, y + 3, w - 4, '#5c6266');
  }
  b.vline(1, 1, h - 1, '#b1aea1').vline(w - 2, 1, h - 1, '#53525c');
  return b;
}
