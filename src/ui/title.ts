import type Phaser from 'phaser';
import { audio } from '../audio/audio';
import { continueGame, setPhaser, startNewGame } from '../core/flow';
import { hasSave, importSaveFile, loadGame } from '../persistence/storage';
import { openCreator } from './creator';
import { confirmBox, h, hideBoot, panel, toast, uiRoot } from './dom';
import { openSettings } from './settingsPanel';
import { skinIconEl } from './skin';

export async function showTitle(phaser: Phaser.Game) {
  setPhaser(phaser);
  hideBoot();
  const saved = await hasSave();
  const root = h('div', { class: 'title-screen' });
  const close = () => root.remove();
  const start = () => audio.unlock();

  const cont = h('button', {
    class: 'btn primary',
    onclick: async () => {
      start();
      const s = await loadGame();
      if (!s) {
        toast('No se pudo leer la partida guardada.');
        return;
      }
      close();
      continueGame(s);
    },
  }, 'Continuar');
  const nueva = h('button', {
    class: 'btn rose',
    onclick: async () => {
      start();
      if (saved && !(await confirmBox('Ya hay una partida guardada. Si empezás una nueva, se reemplazará. ¿Seguir?', 'Empezar de nuevo'))) return;
      openCreator({
        title: 'Tu personaje',
        askNames: true,
        confirmLabel: 'Comenzar',
        onDone: (a, name, rest) => {
          close();
          startNewGame(a, name, rest);
        },
      });
    },
  }, 'Nueva partida');
  const imp = h('input', { type: 'file', accept: 'application/json,.json', style: { display: 'none' } }) as HTMLInputElement;
  imp.addEventListener('change', async () => {
    const f = imp.files?.[0];
    if (!f) return;
    try {
      const s = await importSaveFile(f);
      close();
      continueGame(s);
      toast('Partida importada.');
    } catch (err: any) {
      toast(err?.message ?? 'No se pudo importar.');
    }
    imp.value = '';
  });
  const logo = h(
    'div',
    { class: 'title-logo mm-logo' },
    h('div', { class: 'logo-row' }, skinIconEl('lantern', 'logo-lantern'), h('div', { class: 't1' }, ...[...'MIDNIGHT'].map((ch, i) => h('span', { class: 'wave', style: { animationDelay: i * 0.08 + 's' } }, ch))), skinIconEl('lantern', 'logo-lantern')),
    h('div', { class: 'logo-row' }, skinIconEl('maki', 'logo-maki'), skinIconEl('maki', 'logo-maki'), h('div', { class: 't1 red' }, ...[...'MAKI'].map((ch, i) => h('span', { class: 'wave', style: { animationDelay: 0.7 + i * 0.08 + 's' } }, ch))), skinIconEl('maki', 'logo-maki'), skinIconEl('maki', 'logo-maki')),
    h('div', { class: 't2' }, 'Los secretos de Villa Nori'),
  );
  const items = [saved ? cont : null, nueva, h('button', { class: 'btn', onclick: () => { start(); openSettings(false); } }, 'Opciones'), h('button', { class: 'btn', onclick: () => { start(); imp.click(); } }, 'Importar partida'), h('button', { class: 'btn', onclick: () => credits() }, 'Créditos')].filter(Boolean) as HTMLElement[];
  for (const it of items) it.className = 'board-item';
  items[0]?.classList.add('sel');
  for (const it of items) it.addEventListener('pointerenter', () => { for (const o of items) o.classList.toggle('sel', o === it); });
  // optional illustrated background (public/title-bg.jpg and, for phones held upright, public/title-bg-vertical.jpg)
  const base = import.meta.env.BASE_URL;
  const bgImg = h('img', { class: 'title-bg-img', alt: '', draggable: 'false' }) as HTMLImageElement;
  const bg = h('picture', { class: 'title-bg' }, h('source', { media: '(orientation: portrait)', srcset: base + 'title-bg-vertical.jpg' }), bgImg);
  bgImg.onload = () => root.classList.add('has-bg');
  bgImg.onerror = () => {
    // no vertical version: fall back to the main image once, then to the animated scene
    if (!bgImg.dataset.fallback) {
      bgImg.dataset.fallback = '1';
      bg.querySelector('source')?.remove();
      bgImg.src = base + 'title-bg.jpg';
    } else bg.remove();
  };
  bgImg.src = base + 'title-bg.jpg';
  root.append(bg);
  root.append(
    logo,
    h('div', { class: 'title-menu title-board' }, ...items, imp),
    h('div', { class: 'title-foot' }, 'Un pequeño mundo hecho con cariño · sin anuncios, sin compras, sin conexión necesaria'),
  );
  uiRoot().append(root);
}

function credits() {
  panel({
    title: 'Créditos',
    body: h(
      'div',
      { class: 'col', style: { lineHeight: '1.5' } },
      h('p', null, h('b', null, 'Midnight Maki: Los secretos de Villa Nori')),
      h('p', null, 'Un regalo para Sofi, de Santi.'),
      h('p', null, 'Arte pixel, música y sonidos generados por el propio juego: todo es original.'),
      h('p', null, 'Hecho con Phaser, TypeScript y Vite. Tipografía: Pixelify Sans (OFL).'),
      h('p', { class: 'muted' }, 'Pip, Spicy Beacon y Rigg te mandan saludos.'),
    ),
  });
}
