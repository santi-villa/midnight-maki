import type Phaser from 'phaser';
import { audio } from '../audio/audio';
import { continueGame, setPhaser, startNewGame } from '../core/flow';
import { hasSave, importSaveFile, loadGame } from '../persistence/storage';
import { openCreator } from './creator';
import { confirmBox, h, hideBoot, panel, toast, uiRoot } from './dom';
import { openSettings } from './settingsPanel';

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
  root.append(
    h('div', { class: 'title-logo' }, h('div', { class: 't1' }, ...[...'Midnight Maki'].map((ch, i) => h('span', { class: 'wave', style: { animationDelay: i * 0.08 + 's' } }, ch === ' ' ? '\u00a0' : ch))), h('div', { class: 't2' }, 'Los secretos de Villa Nori')),
    h(
      'div',
      { class: 'title-menu' },
      saved ? cont : null,
      nueva,
      h('button', { class: 'btn', onclick: () => { start(); openSettings(false); } }, 'Ajustes'),
      h('button', { class: 'btn', onclick: () => { start(); imp.click(); } }, 'Importar partida'),
      h('button', { class: 'btn ghost', onclick: () => credits() }, 'Créditos'),
      imp,
    ),
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
