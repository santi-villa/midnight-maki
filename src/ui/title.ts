import type Phaser from 'phaser';
import { audio } from '../audio/audio';
import { continueGame, setPhaser, startNewGame } from '../core/flow';
import type { SaveData } from '../core/types';
import { bus } from '../core/events';
import { runTask } from '../core/errors';
import { lowFx } from '../core/perf';
import { settings, updateSettings } from '../core/settings';
import { continueTarget, hasSave, importSaveFile, installSave, saveFromCode, setActiveSlot, takeResumeOnce } from '../persistence/storage';
import { openCreator } from './creator';
import { versionLabel } from '../core/version';
import { confirmBox, h, hideBoot, panel, toast, uiRoot } from './dom';
import { skinIconEl } from './skin';
import { loadChoiceList, resumeSnapshot, slotChoiceList, slotTitle } from './saves';
import { openSettings } from './settingsPanel';
import './title.css';

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
  const saved = await hasSave();
  const base = import.meta.env.BASE_URL;
  const root = h('div', { class: 'title-screen tt' });
  let offSettings = () => {};
  const close = () => {
    offSettings();
    window.removeEventListener('resize', layout);
    window.removeEventListener('keydown', onKey);
    root.remove();
  };

  // ---- actions (same behaviour as before; only the presentation changed)
  const doContinue = async () => {
    const found = await continueTarget();
    if (!found) {
      toast('No se pudo leer la partida guardada.');
      return;
    }
    setActiveSlot(found.slot);
    close();
    await continueGame(found.data);
  };
  const doNew = async () => {
    let picker: { close: () => void; root: HTMLElement } | null = null;
    const list = await slotChoiceList(async (slot, info) => {
      const occupied = info.auto ?? info.manual;
      if (occupied && !(await confirmBox(`${slotTitle(slot)} ya tiene la partida de ${occupied.name}. Si empezás de nuevo y confirmás el personaje, se borran el guardado automático y el manual. ¿Seguir?`, 'Empezar de nuevo'))) return;
      picker?.close();
      openCreator({
        title: 'Tu personaje',
        askNames: true,
        confirmLabel: 'Comenzar',
        onDone: (a, name, rest, difficulty) => {
          if (difficulty) updateSettings({ cookMode: difficulty });
          close();
          void runTask('flow:new', () => startNewGame(a, name, rest, slot));
        },
      });
    });
    picker = panel({
      title: 'Nueva partida',
      body: h('div', { class: 'col' }, h('p', { class: 'hint' }, 'Hay tres partidas. Una vacía empieza de cero. En una ocupada, la anterior se borra recién cuando confirmás el personaje.'), list),
    });
    picker.root.classList.add('save-picker');
  };
  let loadPanel: { close: () => void } | null = null;
  const offerImport = async (data: SaveData) => {
    let picker: { close: () => void; root: HTMLElement } | null = null;
    const list = await slotChoiceList(async (slot, info) => {
      if ((info.auto || info.manual) && !(await confirmBox(`${slotTitle(slot)} ya está ocupada. Esta copia reemplaza su guardado automático y su manual. ¿Seguir?`, 'Reemplazar'))) return;
      if (!(await installSave(slot, data))) {
        toast('No se pudo guardar la copia.');
        return;
      }
      picker?.close();
      loadPanel?.close();
      close();
      await continueGame(data);
      toast('Partida importada.');
    });
    picker = panel({
      title: 'Elegir partida',
      wide: true,
      body: h('div', { class: 'col' }, h('p', { class: 'hint' }, `La copia es de ${data.player.name}. Elegí en qué partida guardarla.`), list),
    });
  };
  const imp = h('input', { type: 'file', accept: 'application/json,.json', style: { display: 'none' } }) as HTMLInputElement;
  imp.addEventListener('change', async () => {
    const f = imp.files?.[0];
    if (!f) return;
    try {
      await offerImport(await importSaveFile(f));
    } catch (err: any) {
      toast(err?.message ?? 'No se pudo importar.');
    }
    imp.value = '';
  });
  const doLoad = async () => {
    const codeBox = h('textarea', { rows: '3', placeholder: 'Pegá acá el código (empieza con MM1:)', style: { width: '100%', fontSize: '.8em', userSelect: 'text', WebkitUserSelect: 'text', display: 'none' } }) as HTMLTextAreaElement;
    const codeGo = h('button', {
      class: 'btn small rose', style: { display: 'none' }, onclick: () => {
        try {
          const loaded = saveFromCode(codeBox.value);
          void runTask('flow:import-code', () => offerImport(loaded));
        } catch (err: any) {
          toast(err?.message ?? 'No se pudo leer el código.');
        }
      },
    }, 'Cargar desde el código');
    const list = await loadChoiceList((slot, kind) => {
      loadPanel?.close();
      void runTask('flow:load-slot', async () => {
        const data = await resumeSnapshot(slot, kind);
        if (!data) return;
        close();
        await continueGame(data);
      });
    });
    const body = h(
      'div',
      { class: 'col' },
      list,
      h('h3', null, 'Copia de seguridad'),
      h('p', { class: 'hint' }, 'Un archivo o un código se guarda en la partida que elijas.'),
      h('button', { class: 'btn', onclick: () => imp.click() }, 'Abrir archivo de copia'),
      h('button', { class: 'btn', onclick: () => { codeBox.style.display = ''; codeGo.style.display = ''; codeBox.focus(); } }, 'Pegar código de copia'),
      codeBox,
      codeGo,
    );
    loadPanel = panel({ title: 'Cargar partida', body, onClose: () => { loadPanel = null; } });
  };

  // ---- clean artwork plates; title and controls remain independent of the illustration
  const back = h('img', { class: 'tt-back', alt: '', draggable: 'false' }) as HTMLImageElement;
  const img = h('img', { class: 'tt-img', alt: 'Maki & Mapaches: Pip, Spicy y Rigg junto a Midnight Maki', draggable: 'false' }) as HTMLImageElement;
  let artworkReady!: () => void;
  const artwork = new Promise<void>(resolve => { artworkReady = resolve; });
  const fx = h('div', { class: 'tt-fx' });
  const frame = h('div', { class: 'tt-frame' }, img, fx);
  // In landscape the background is a short looping video (fireflies, smoke, lanterns, clouds). The still picture stays under it
  // and is what shows while it loads, when it cannot play, in portrait, and in the calm / battery modes.
  const video = h('video', { class: 'tt-video', muted: '', loop: '', playsinline: '', 'aria-hidden': 'true', preload: 'auto', tabindex: '-1' }) as HTMLVideoElement;
  video.muted = true; video.loop = true; video.playsInline = true; video.disablePictureInPicture = true;
  let videoOn = false;
  let stillTimer = 0;
  let videoFailed = false; // once it could not start, the still picture stays (no retry loop on every layout)
  const giveUp = () => { videoFailed = true; videoOn = false; window.clearTimeout(stillTimer); root.classList.remove('tt-video-on', 'tt-video-wait'); };
  const syncVideo = () => {
    const want = mode === 'horizontal' && !calm() && !lowFx();
    if (want && !videoOn && !videoFailed) {
      videoOn = true;
      if (!video.src) video.src = base + 'title/title-loop-v2.mp4';
      // until the video runs the screen stays plain dark (no still picture flashing before it); if it cannot start
      // in a few seconds the still picture fades in instead
      root.classList.add('tt-video-wait');
      window.clearTimeout(stillTimer);
      stillTimer = window.setTimeout(giveUp, 3500);
      video.addEventListener('playing', () => { window.clearTimeout(stillTimer); videoFailed = false; videoOn = true; root.classList.add('tt-video-on'); root.classList.remove('tt-video-wait'); }, { once: true });
      video.addEventListener('error', giveUp, { once: true });
      void video.play().catch(() => { /* blocked until a gesture: the timer falls back to the still picture */ });
    } else if (!want && videoOn) {
      videoOn = false;
      window.clearTimeout(stillTimer);
      video.pause();
      root.classList.remove('tt-video-on', 'tt-video-wait');
    }
  };
  let mode: 'vertical' | 'horizontal' | '' = '';
  const build = (m: 'vertical' | 'horizontal') => {
    const L = LAYOUTS[m];
    fx.replaceChildren();
    const pos = (x: number, y: number) => ({ left: (x / L.w) * 100 + '%', top: (y / L.h) * 100 + '%' });
    L.glows.slice(2).forEach(([x, y, r], i) => fx.append(h('i', { class: 'tt-glow', style: { ...pos(x, y), width: ((r * 2) / L.w) * 100 + '%', animationDelay: -((i * 1.37) % 5) + 's', animationDuration: 3.2 + (i % 4) * 0.7 + 's' } })));
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
      const url = base + 'title/title-art-' + m + '.webp';
      img.src = url;
      back.src = url;
      build(m);
    }
    const L = LAYOUTS[m];
    // the room for the menu is kept from the start, so the picture does not shift when it appears
    // (in landscape the card floats over the picture, so the picture needs no room of its own)
    const reserved = m === 'vertical' ? menu.getBoundingClientRect().height + 36 : 0;
    root.style.setProperty('--title-menu-space', reserved + 'px');
    const k = Math.min(vw / L.w, Math.max(150, vh - reserved) / L.h);
    frame.style.width = Math.floor(L.w * k) + 'px';
    frame.style.height = Math.floor(L.h * k) + 'px';
    frame.style.setProperty('--u', k + 'px');
    root.classList.toggle('tt-portrait', m === 'vertical');
    syncVideo();
  };
  const calm = (): boolean => settings.reduceMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const refreshCalm = () => {
    root.classList.toggle('tt-calm', calm());
    root.classList.toggle('tt-low', lowFx());
  };
  img.onload = () => {
    root.classList.add('has-bg', 'ready');
    // the illustration covers the screen: stop drawing the Phaser fallback scene
    try { phaser.scene.sleep('title'); } catch { /* scene already gone */ }
    artworkReady();
  };
  img.onerror = () => { root.classList.add('no-bg'); artworkReady(); };

  // the title is the logo image over the clean artwork; the text brand only stands in when the artwork cannot load
  const logo = h('img', { class: 'tt-logo', src: base + 'title/logo.webp', alt: 'Mapaches y Sushi', draggable: 'false' }) as HTMLImageElement;
  const fallback = brandLogo('title-logo mm-logo tt-brand');

  // ---- menu, revealed after the first tap
  const btn = (label: string, cls: string, fn: () => void, icon?: string) =>
    h('button', { type: 'button', class: 'btn tt-btn ' + cls, onclick: fn }, h('span', { class: 'tt-btn-label' }, label), icon ? skinIconEl(icon, 'skin-icon tt-btn-icon') : null) as HTMLButtonElement;
  const buttons: HTMLButtonElement[] = [];
  if (saved) buttons.push(btn('Continuar', 'primary', () => void runTask('flow:continue', doContinue), 'maki'));
  buttons.push(btn('Nueva partida', saved ? 'rose' : 'primary', () => void runTask('flow:new-menu', doNew), 'heart'));
  buttons.push(btn('Cargar partida', '', () => void runTask('flow:load-menu', doLoad), 'disk'), btn('Opciones', '', () => openSettings(false), 'gear'), btn('Créditos', '', credits, 'clipboard'));
  buttons.push(btn('Cuenta y nube', '', () => void import('./account').then((m) => m.openAccount()), 'cloud'));
  const mainCount = saved ? 3 : 2;
  const menu = h('nav', { class: 'tt-menu', 'aria-label': 'Menú principal' },
    h('div', { class: 'tt-main-actions' }, ...buttons.slice(0, mainCount)),
    h('div', { class: 'tt-utilities' }, ...buttons.slice(mainCount)), imp);
  menu.inert = true;
  const touchy = window.matchMedia('(pointer: coarse)').matches;
  const prompt = h('button', { type: 'button', class: 'tt-prompt', onclick: () => reveal() }, touchy ? 'Tocá para empezar' : 'Presioná una tecla para empezar');

  let revealed = false;
  let sounded = false;
  /** Browsers only allow audio after a gesture: the first touch or key press starts the title music. */
  const sound = () => {
    if (sounded) return;
    sounded = true;
    audio.unlock();
    audio.play('title');
  };
  const reveal = (auto = false) => {
    if (revealed || !root.classList.contains('ready') && !root.classList.contains('no-bg')) return;
    revealed = true;
    if (!auto) sound();
    root.classList.add('open');
    prompt.hidden = true;
    layout();
    // buttons ignore taps until the fade-in is under way, so the tap that opened the menu cannot press one
    window.setTimeout(() => {
      root.classList.add('armed');
      menu.inert = false;
      buttons[0]?.focus({ preventScroll: true });
    }, 420);
  };
  root.addEventListener('pointerdown', () => { sound(); reveal(); });
  const onKey = (e: KeyboardEvent) => {
    if (!document.body.contains(root) || document.querySelector('.panel, .modal, .overlay')) return;
    if (!revealed) {
      if (['Escape', 'Shift', 'Control', 'Alt', 'Meta', 'Tab'].includes(e.key)) return;
      e.preventDefault();
      sound(); reveal();
      return;
    }
    sound();
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (['ArrowDown', 'ArrowRight'].includes(e.key)) { e.preventDefault(); buttons[(i + 1 + buttons.length) % buttons.length].focus(); }
    if (['ArrowUp', 'ArrowLeft'].includes(e.key)) { e.preventDefault(); buttons[(i - 1 + buttons.length) % buttons.length].focus(); }
  };
  window.addEventListener('keydown', onKey);
  window.addEventListener('resize', layout);

  root.append(h('div', { class: 'tt-bg' }, back, frame, video), logo, fallback, prompt, menu, h('div', { class: 'tt-version', 'aria-label': 'Versión del juego' }, versionLabel()));
  refreshCalm();
  uiRoot().append(root);
  layout(); // after mounting, so the menu's real height is known
  await artwork;
  hideBoot();
  if (saved && takeResumeOnce()) void runTask('flow:resume', doContinue);
  // keep the calm / battery flags in sync with the settings panel
  offSettings = bus.on('settings:changed', () => { if (document.body.contains(root)) { refreshCalm(); layout(); } });
}

function credits() {
  panel({
    title: 'Créditos',
    body: h(
      'div',
      { class: 'col', style: { lineHeight: '1.5' } },
      h('p', null, h('b', null, 'Maki & Mapaches: Los secretos de Villa Nori')),
      h('p', null, 'Un regalo para Sofi, de Santi.'),
      h('p', null, 'Ilustraciones pixel art, música y sonidos para Villa Nori.'),
      h('p', null, 'Terreno y tejas: VectoRaith (demo Traditional Japanese, con adaptación de color). Muebles y decoración: Bitglow y Modern Interiors, de LimeZu. Playa: Modern Exteriors, de LimeZu. Huerta: Cozy Farm Lite, de Bramble & Byte.'),
      h('p', null, 'Expendedoras, letreros, postes y puestos comerciales: The Japan Collection: Japanese City (Free Version), de GuttyKreum.'),
      h('p', null, 'Naturaleza: ', h('a', { href: 'https://limezu.itch.io/serenevillagerevamped', target: '_blank', rel: 'noopener noreferrer' }, 'Serene Village revamped, de LimeZu'), '. ', h('a', { href: 'https://creativecommons.org/licenses/by/4.0/', target: '_blank', rel: 'noopener noreferrer' }, 'CC BY 4.0'), '. Recortes y paleta adaptada para Villa Nori.'),
      h('p', null, 'Hecho con Phaser, TypeScript y Vite. Tipografía: Pixelify Sans (OFL).'),
      h('p', { class: 'muted' }, 'Pip, Spicy Bacon y Rigg te mandan saludos.'),
    ),
  });
}

function brandLogo(className: string) {
  return h('div', { class: className, 'aria-label': 'Maki & Mapaches' },
    h('div', { class: 'brand-top' }, 'MAKI ', h('span', null, '&')),
    h('div', { class: 'brand-bottom' }, 'MAPACHES'),
    h('div', { class: 'brand-subtitle' }, 'Los secretos de Villa Nori'),
    h('div', { class: 'brand-family' }, 'Pip · Spicy Bacon · Rigg'));
}
