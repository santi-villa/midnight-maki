/** A short celebration after buying an upgrade: what was installed, a thumbnail, and where the furniture went. */
import { h } from '../ui/dom';
import { FURN_BY_ID } from '../data/furniture';
import { settings } from '../core/settings';
import { lowFx } from '../core/perf';
import { upgradePreview } from './upgradePreview';
import { lastPurchase, type UpgradeDef } from './upgrades';
import './upgradeUi.css';

let current: HTMLElement | null = null;
let timer = 0;

const names = (ids: string[]) => {
  const count = new Map<string, number>();
  for (const id of ids) count.set(id, (count.get(id) ?? 0) + 1);
  return [...count].map(([id, n]) => `${n > 1 ? n + '× ' : ''}${FURN_BY_ID[id]?.name ?? id}`).join(', ');
};

export function celebrateUpgrade(u: UpgradeDef, host: HTMLElement) {
  current?.remove();
  window.clearTimeout(timer);
  const report = lastPurchase();
  const mine = report && report.id === u.id ? report : null;
  const lines: HTMLElement[] = [];
  if (mine?.placed.length) lines.push(h('p', null, `Se colocó en el salón: ${names(mine.placed)}.`));
  if (mine?.stored.length) lines.push(h('p', { class: 'up-note' }, `No había lugar libre para ${names(mine.stored)}: quedó en el depósito. Podés ubicarlo desde la edición del salón.`));
  const fun = !lowFx() && !settings.reduceMotion;
  const card = h('div', { class: 'up-cele' + (fun ? ' fun' : ''), role: 'status', 'aria-live': 'polite' },
    h('div', { class: 'up-cele-tag' }, mine?.stored.length ? '¡Mejora comprada!' : '¡Mejora lista!'),
    h('button', { type: 'button', class: 'up-cele-close', 'aria-label': 'Cerrar aviso de compra', onclick: () => close() }, '✕'),
    h('div', { class: 'up-cele-body' }, upgradePreview(u.id), h('div', null, h('b', null, u.name), ...lines)),
    ...(fun ? [0, 1, 2, 3, 4, 5].map((i) => h('i', { class: 'up-bit', style: { '--i': String(i) } })) : []));
  const close = () => { card.remove(); if (current === card) current = null; window.clearTimeout(timer); };
  current = card;
  host.append(card);
  timer = window.setTimeout(close, mine?.stored.length ? 6000 : 3600);
}
