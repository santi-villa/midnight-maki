/** Optional browser/WebView feedback. Unsupported platforms retain every gameplay action. */
import { settings } from './settings';
import { reportError } from './errors';

type Cue = 'cut' | 'excellent' | 'unlock' | 'reward';
const PATTERNS: Record<Cue, number | number[]> = { cut: 12, excellent: [18, 35, 18], unlock: [20, 40, 30], reward: 20 };
let last = -Infinity;
export const supportsHaptics = () => typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
export function haptic(cue: Cue): boolean {
  if (!settings.haptics || !supportsHaptics() || typeof document !== 'undefined' && document.hidden) return false;
  const now = performance.now();
  if (now - last < 350) return false;
  last = now;
  try { return navigator.vibrate(PATTERNS[cue]); }
  catch (err) { reportError('haptics:feedback', err, false); return false; }
}
