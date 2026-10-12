/**
 * Battery / performance mode. 'auto' watches the frame rate and switches to low effects when the phone
 * struggles; 'low' always saves battery; 'high' never reduces. The choice the auto mode makes is remembered.
 */
import { settings } from './settings';

let autoLow = (() => {
  try {
    return localStorage.getItem('mm_autolow') === '1';
  } catch {
    return false;
  }
})();

/** true when heavy effects (particles, bloom, cast shadows, sway) should be skipped */
export function lowFx(): boolean {
  if (settings.reduceMotion) return true;
  const mode = settings.perf ?? 'auto';
  return mode === 'low' || (mode === 'auto' && autoLow);
}

let acc = 0;
let frames = 0;
let slow = 0;
/** Feed real frame times; returns true the moment auto mode decides to go low. */
export function sampleFrame(dms: number): boolean {
  if ((settings.perf ?? 'auto') !== 'auto' || autoLow) return false;
  acc += dms;
  frames++;
  if (acc < 4000) return false;
  const fps = (frames * 1000) / acc;
  acc = 0;
  frames = 0;
  slow = fps < 40 ? slow + 1 : 0;
  if (slow >= 2) {
    autoLow = true;
    try {
      localStorage.setItem('mm_autolow', '1');
    } catch {
      /* ignore */
    }
    return true;
  }
  return false;
}

export function resetAutoPerf() {
  autoLow = false;
  try {
    localStorage.removeItem('mm_autolow');
  } catch {
    /* ignore */
  }
}
