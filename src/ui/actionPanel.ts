/** Client-pixel anchor supplied by the world camera; cards follow it while staying on screen. */
import { settings } from '../core/settings';
import { normalizeUiScale } from '../core/uiScale';
export type ActionAnchor = () => { x: number; y: number };
export function followActionPanel(el: HTMLElement, anchor: ActionAnchor): () => void {
  el.classList.add('action-card');
  let raf = 0, stopped = false, last = '';
  const place = () => {
    if (stopped || !el.isConnected) return;
    const scale = normalizeUiScale(settings.uiScale), vw = window.innerWidth, vh = window.innerHeight;
    const p = anchor(), belowSpace = vh - p.y - 44, aboveSpace = p.y - 44;
    const below = belowSpace >= 180 || belowSpace >= aboveSpace;
    el.style.maxWidth = `${(vw - 24) / scale}px`;
    el.style.maxHeight = `${Math.min(vh - 32, Math.max(180, vh * .62), Math.max(140, below ? belowSpace : aboveSpace)) / scale}px`;
    const box = el.getBoundingClientRect(), root = document.getElementById('ui')!.getBoundingClientRect();
    const x = Math.max(12, Math.min(vw - box.width - 12, p.x + (vw >= 700 ? 24 : -box.width / 2)));
    const y = Math.max(16, Math.min(vh - box.height - 16, below ? p.y + 28 : p.y - box.height - 28));
    const key = `${Math.round(x)}:${Math.round(y)}:${below}:${scale}`;
    if (key !== last) {
      last = key;
      el.style.left = `${(x - root.left) / scale}px`; el.style.top = `${(y - root.top) / scale}px`;
      el.style.right = 'auto'; el.style.bottom = 'auto'; el.style.transform = 'none';
      el.dataset.side = below ? 'below' : 'above';
    }
    el.style.setProperty('--action-x', `${Math.max(14, Math.min(box.width - 14, p.x - x)) / scale}px`);
    raf = requestAnimationFrame(place);
  };
  place();
  return () => { stopped = true; cancelAnimationFrame(raf); };
}
