/** Small wooden signs for playing together: "Ana salió del restaurante", "Ana quiere dormir [Dormir] [Todavía no]". They never pause the game. */
import { h, uiRoot } from '../ui/dom';

let wrap: HTMLElement | null = null;
const host = () => {
  if (!wrap?.isConnected) { wrap = h('div', { class: 'coop-signs', role: 'status', 'aria-live': 'polite' }); uiRoot().append(wrap); }
  return wrap;
};

export interface SignButton { label: string; primary?: boolean; run: () => void }

/** Show a sign. It goes away by itself after `seconds` (0 = stays until `close()` or a button is used). */
export function sign(text: string, opts: { icon?: string; seconds?: number; buttons?: SignButton[]; key?: string } = {}): { close: () => void } {
  const root = host();
  if (opts.key) root.querySelector(`[data-key="${opts.key}"]`)?.remove();
  let timer = 0;
  const el = h('div', { class: 'coop-sign', ...(opts.key ? { 'data-key': opts.key } : {}) },
    opts.icon ? h('span', { class: 'cs-icon', 'aria-hidden': 'true' }, opts.icon) : null,
    h('span', { class: 'cs-text' }, text),
    ...(opts.buttons ?? []).map((b) => h('button', { class: 'btn small' + (b.primary ? ' primary' : ''), onclick: () => { close(); b.run(); } }, b.label)));
  const close = () => { window.clearTimeout(timer); el.remove(); };
  root.append(el);
  if (opts.seconds) timer = window.setTimeout(close, opts.seconds * 1000);
  return { close };
}

/** Take a keyed sign down (nothing happens when it is not there). */
export function closeSign(key: string) { wrap?.querySelector(`[data-key="${key}"]`)?.remove(); }
