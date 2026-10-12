import { h, openModal } from '../ui/dom';

export interface MgShell {
  root: HTMLElement;
  box: HTMLElement;
  canvas: HTMLCanvasElement;
  g: CanvasRenderingContext2D;
  info: HTMLElement;
  buttons: HTMLElement;
  close: () => void;
}

/** Standard minigame overlay: title, a pixel canvas, status line, button row. */
export function shell(title: string, w: number, hgt: number, scale = 2, onExit?: () => void): MgShell {
  const canvas = h('canvas', { width: String(w), height: String(hgt) }) as HTMLCanvasElement;
  const fit = () => {
    const maxW = Math.min(window.innerWidth - 48, 520);
    const maxH = window.innerHeight - 260;
    const s = Math.max(1, Math.min(scale * 2, Math.floor(Math.min(maxW / w, maxH / hgt) * 2) / 2));
    canvas.style.width = w * s + 'px';
    canvas.style.height = hgt * s + 'px';
  };
  fit();
  const info = h('div', { style: { textAlign: 'center', minHeight: '1.4em' } });
  const buttons = h('div', { class: 'row', style: { flexWrap: 'wrap', justifyContent: 'center' } });
  let close = () => {};
  const box = h('div', { class: 'mg-box' }, h('div', { class: 'row', style: { justifyContent: 'space-between', width: '100%' } }, h('b', null, title), h('button', { class: 'close-x', 'aria-label': 'Salir', onclick: () => { close(); onExit?.(); } }, '✕')), canvas, info, buttons);
  const root = h('div', { class: 'mg' }, box);
  close = openModal(root);
  (root as any).__close = () => {
    close();
    onExit?.();
  };
  window.addEventListener('resize', fit);
  const g = canvas.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  return {
    root, box, canvas, g, info, buttons,
    close: () => {
      window.removeEventListener('resize', fit);
      close();
    },
  };
}

export function boardPos(canvas: HTMLCanvasElement, e: PointerEvent) {
  const r = canvas.getBoundingClientRect();
  return { x: ((e.clientX - r.left) / r.width) * canvas.width, y: ((e.clientY - r.top) / r.height) * canvas.height };
}
