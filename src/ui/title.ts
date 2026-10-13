import type Phaser from 'phaser';
import { audio } from '../audio/audio';
import { continueGame, setPhaser, startNewGame } from '../core/flow';
import { bus } from '../core/events';
import { runTask } from '../core/errors';
import { lowFx } from '../core/perf';
import { settings } from '../core/settings';
import { hasSave, importSaveFile, loadGame, saveFromCode } from '../persistence/storage';
import { openCreator } from './creator';
import { confirmBox, h, hideBoot, panel, toast, uiRoot } from './dom';
import { openSettings } from './settingsPanel';
import { skinIconEl } from './skin';

/** Where the animated touches sit, in pixels of each illustration (768x1376 vertical, 1376x768 horizontal). */
interface Layout {
  w: number;
  h: number;
  glows: [number, number, number][]; // x, y, radius
  stars: [number, number][];
  water: [number, number, number][]; // x, y, width
  leaves: [number, number][]; // start x, start y (they drift down and sideways)
}
const LAYOUTS: Record<'vertical' | 'horizontal', Layout> = {
  vertical: {
    w: 768, h: 1376,
    glows: [[100, 262, 95], [668, 262, 95], [412, 712, 62], [553, 727, 62], [743, 745, 62], [505, 722, 78]],
    stars: [[30, 40], [210, 35], [290, 95], [380, 40], [450, 120], [540, 100], [620, 60], [740, 130], [20, 170], [740, 190], [40, 450], [180, 470], [300, 445], [110, 540], [330, 520]],
    water: [[270, 690, 46], [236, 722, 34], [192, 762, 40], [118, 952, 40], [58, 1022, 36], [18, 1088, 24]],
    leaves: [[120, 700], [330, 760], [520, 880], [250, 1000], [60, 640]],
  },
  horizontal: {
    w: 1376, h: 768,
    glows: [[420, 135, 95], [950, 135, 95], [893, 318, 62], [1048, 325, 62], [1260, 348, 62], [985, 332, 78], [1330, 325, 50]],
    stars: [[40, 30], [120, 20], [300, 25], [350, 70], [170, 130], [60, 170], [250, 190], [390, 15], [1330, 25], [1100, 12], [1000, 20], [20, 95]],
    water: [[270, 330, 60], [300, 346, 40], [238, 362, 50], [122, 562, 40], [58, 622, 50], [148, 692, 40], [38, 732, 40]],
    leaves: [[500, 330], [700, 360], [900, 470], [300, 480], [1100, 540]],
  },
};

export async function showTitle(phaser: Phaser.Game) {
  setPhaser(phaser);
  hideBoot();
  const saved = await hasSave();
  const base = import.meta.env.BASE_URL;
  const root = h('div', { class: 'title-screen tt' });
  const close = () => {
    window.removeEventListener('resize', layout);
    window.removeEventListener('keydown', onKey);
    root.remove();
  };

  // ---- actions (same behaviour as before; only the presentation changed)
  const doContinue = async () => {
    const s = await loadGame();
    if (!s) {
      toast('No se pudo leer la partida guardada.');
      return;
    }
    close();
    await continueGame(s);
  };
  const doNew = async () => {
    if (saved && !(await confirmBox('Ya hay una partida guardada. Si empezás una nueva, se reemplazará. ¿Seguir?', 'Empezar de nuevo'))) return;
    openCreator({
      title: 'Tu personaje',
      askNames: true,
      confirmLabel: 'Comenzar',
      onDone: (a, name, rest) => {
        close();
        void runTask('flow:new', () => startNewGame(a, name, rest));
      },
    });
  };
  const imp = h('input', { type: 'file', accept: 'application/json,.json', style: { display: 'none' } }) as HTMLInputElement;
  imp.addEventListener('change', async () => {
    const f = imp.files?.[0];
    if (!f) return;
    try {
      const s = await importSaveFile(f);
      loadPanel?.close();
      close();
      await continueGame(s);
      toast('Partida importada.');
    } catch (err: any) {
      toast(err?.message ?? 'No se pudo importar.');
    }
    imp.value = '';
  });
  let loadPanel: { close: () => void } | null = null;
  const doLoad = () => {
    const codeBox = h('textarea', { rows: '3', placeholder: 'Pegá acá el código (empieza con MM1:)', style: { width: '100%', fontSize: '.8em', userSelect: 'text', WebkitUserSelect: 'text', display: 'none' } }) as HTMLTextAreaElement;
    const codeGo = h('button', {
      class: 'btn small rose', style: { display: 'none' }, onclick: () => {
        try {
          const s = saveFromCode(codeBox.value);
          loadPanel?.close();
          close();
          void runTask('flow:import-code', () => continueGame(s));
          toast('Partida cargada desde el código.');
        } catch (err: any) {
          toast(err?.message ?? 'No se pudo leer el código.');
        }
      },
    }, 'Cargar desde el código');
    const body = h(
      'div',
      { class: 'col' },
      h('p', { class: 'hint' }, 'Si tenés una copia de seguridad (un archivo o un código), podés cargarla acá.'),
      saved ? h('button', { class: 'btn primary', onclick: () => { loadPanel?.close(); void runTask('flow:continue', doContinue); } }, 'Seguir con la partida de este dispositivo') : null,
      h('button', { class: 'btn', onclick: () => imp.click() }, 'Abrir archivo de copia'),
      h('button', { class: 'btn', onclick: () => { codeBox.style.display = ''; codeGo.style.display = ''; codeBox.focus(); } }, 'Pegar código de copia'),
      codeBox,
      codeGo,
    );
    loadPanel = panel({ title: 'Cargar partida', body, onClose: () => { loadPanel = null; } });
  };

  // ---- artwork, framed so that nothing is ever cropped (the logo is part of the picture)
  const back = h('img', { class: 'tt-back', alt: '', draggable: 'false' }) as HTMLImageElement;
  const img = h('img', { class: 'tt-img', alt: 'Midnight Maki', draggable: 'false' }) as HTMLImageElement;
  const fx = h('div', { class: 'tt-fx' });
  const frame = h('div', { class: 'tt-frame' }, img, fx);
  let mode: 'vertical' | 'horizontal' | '' = '';
  const build = (m: 'vertical' | 'horizontal') => {
    const L = LAYOUTS[m];
    fx.replaceChildren();
    const pos = (x: number, y: number) => ({ left: (x / L.w) * 100 + '%', top: (y / L.h) * 100 + '%' });
    L.glows.forEach(([x, y, r], i) => fx.append(h('i', { class: 'tt-glow', style: { ...pos(x, y), width: ((r * 2) / L.w) * 100 + '%', animationDelay: -((i * 1.37) % 5) + 's', animationDuration: 3.2 + (i % 4) * 0.7 + 's' } })));
    L.stars.forEach(([x, y], i) => fx.append(h('i', { class: 'tt-star', style: { ...pos(x, y), animationDelay: -((i * 0.83) % 4) + 's', animationDuration: 2.2 + (i % 5) * 0.6 + 's' } })));
    L.water.forEach(([x, y, w], i) => fx.append(h('i', { class: 'tt-water', style: { ...pos(x, y), width: (w / L.w) * 100 + '%', animationDelay: -((i * 1.1) % 4) + 's', animationDuration: 3 + (i % 3) + 's' } })));
    L.leaves.forEach(([x, y], i) => fx.append(h('i', { class: 'tt-leaf l' + (i % 3), style: { ...pos(x, y), animationDelay: -((i * 4.3) % 18) + 's', animationDuration: 15 + (i % 3) * 3 + 's' } })));
  };
  const layout = () => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const m = vh > vw ? 'vertical' : 'horizontal';
    if (m !== mode) {
      mode = m;
      const url = base + 'title/title-' + m + '.webp';
      img.src = url;
      back.src = url;
      build(m);
    }
    const L = LAYOUTS[m];
    const k = Math.min(vw / L.w, vh / L.h);
    frame.style.width = Math.floor(L.w * k) + 'px';
    frame.style.height = Math.floor(L.h * k) + 'px';
    frame.style.setProperty('--u', k + 'px');
    root.classList.toggle('tt-portrait', m === 'vertical');
  };
  const calm = () => settings.reduceMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const refreshCalm = () => {
    root.classList.toggle('tt-calm', calm());
    root.classList.toggle('tt-low', lowFx());
  };
  img.onload = () => {
    root.classList.add('has-bg', 'ready');
    // the illustration covers the screen: stop drawing the Phaser fallback scene
    try { phaser.scene.sleep('title'); } catch { /* scene already gone */ }
  };
  img.onerror = () => root.classList.add('no-bg');

  // ---- fallback logo (only visible when the illustration cannot be loaded)
  const logo = h(
    'div',
    { class: 'title-logo mm-logo tt-logo-fallback' },
    h('div', { class: 'logo-row' }, skinIconEl('lantern', 'logo-lantern'), h('div', { class: 't1' }, ...[...'MIDNIGHT'].map((ch, i) => h('span', { class: 'wave', style: { animationDelay: i * 0.08 + 's' } }, ch))), skinIconEl('lantern', 'logo-lantern')),
    h('div', { class: 'logo-row' }, skinIconEl('maki', 'logo-maki'), h('div', { class: 't1 red' }, ...[...'MAKI'].map((ch, i) => h('span', { class: 'wave', style: { animationDelay: 0.7 + i * 0.08 + 's' } }, ch))), skinIconEl('maki', 'logo-maki')),
    h('div', { class: 't2' }, 'Los secretos de Villa Nori'),
  );

  // ---- menu, revealed after the first tap
  const btn = (label: string, cls: string, span: number, fn: () => void) => {
    const b = h('button', { class: 'btn tt-btn ' + cls, style: { gridColumn: 'span ' + span }, onclick: fn }, label) as HTMLButtonElement;
    return b;
  };
  const buttons: HTMLButtonElement[] = [];
  if (saved) buttons.push(btn('Continuar', 'primary', 6, () => void runTask('flow:continue', doContinue)));
  buttons.push(btn('Nueva partida', saved ? 'rose' : 'primary', saved ? 6 : 12, () => void runTask('flow:new-menu', doNew)));
  buttons.push(btn('Cargar partida', '', 5, doLoad), btn('Opciones', '', 4, () => openSettings(false)), btn('Créditos', '', 3, credits));
  const menu = h('div', { class: 'tt-menu', role: 'menu' }, ...buttons, imp);
  const prompt = h('div', { class: 'tt-prompt' }, 'Tocá para comenzar');

  let revealed = false;
  const reveal = () => {
    if (revealed) return;
    revealed = true;
    audio.unlock(); // browsers only allow audio after a gesture
    audio.play('title');
    root.classList.add('open');
    // buttons ignore taps until the fade-in is under way, so the tap that opened the menu cannot press one
    window.setTimeout(() => {
      root.classList.add('armed');
      buttons[0]?.focus({ preventScroll: true });
    }, 420);
  };
  root.addEventListener('pointerdown', () => reveal());
  const onKey = (e: KeyboardEvent) => {
    if (!document.body.contains(root) || document.querySelector('.panel, .modal, .overlay')) return;
    if (!revealed) {
      if (['Escape', 'Shift', 'Control', 'Alt', 'Meta', 'Tab'].includes(e.key)) return;
      e.preventDefault();
      reveal();
      return;
    }
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (['ArrowDown', 'ArrowRight'].includes(e.key)) { e.preventDefault(); buttons[(i + 1 + buttons.length) % buttons.length].focus(); }
    if (['ArrowUp', 'ArrowLeft'].includes(e.key)) { e.preventDefault(); buttons[(i - 1 + buttons.length) % buttons.length].focus(); }
  };
  window.addEventListener('keydown', onKey);
  window.addEventListener('resize', layout);

  root.append(h('div', { class: 'tt-bg' }, back, frame), logo, prompt, menu);
  refreshCalm();
  layout();
  uiRoot().append(root);
  // keep the calm / battery flags in sync with the settings panel
  bus.on('settings:changed', () => { if (document.body.contains(root)) refreshCalm(); });
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
