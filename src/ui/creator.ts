/** Character creator (also reused later from the wardrobe for appearance changes). */
import { drawCharacter, EYE_STYLES, FH, FW, HAIR_STYLES } from '../art/characters';
import { ctx2d, makeCanvas } from '../art/pixel';
import { audio } from '../audio/audio';
import { defaultAppearance } from '../core/state';
import type { Appearance, Dir, Species } from '../core/types';
import { CLOTHES, CLOTHES_BY_ID, type ClothingSlot } from '../data/clothes';
import { h, panel } from './dom';

export const SPECIES: { id: Species; name: string }[] = [
  { id: 'human', name: 'Humana' },
  { id: 'cat', name: 'Gatita' },
  { id: 'fox', name: 'Zorrita' },
  { id: 'bunny', name: 'Conejita' },
  { id: 'raccoon', name: 'Mapache' },
  { id: 'bear', name: 'Osita' },
  { id: 'dog', name: 'Perrita' },
  { id: 'squirrel', name: 'Ardilla' },
];

const SKINS_HUMAN = ['#f7dcc6', '#f2cfb3', '#e3b48e', '#c98e66', '#9c6644', '#6e4630'];
const FURS = ['#f3e6c8', '#e0c08a', '#d8874f', '#a8734d', '#8d8a93', '#5d5864', '#fbf6ea', '#c9a0a0'];
const HAIRS = ['#2a2230', '#5b3a2e', '#8a5a3c', '#d8a05a', '#f2dc8a', '#b2585e', '#d9a3a6', '#b7a8d6', '#6f9fb8', '#9bb59a', '#d8d2c8'];
const EYES = ['#5d4037', '#2a2230', '#4f6b52', '#3b6f9c', '#9686bd', '#c27f86', '#a07116'];

export function previewCanvas(a: Appearance, dirs: Dir[] = ['down', 'right', 'up'], scale = 4): HTMLCanvasElement {
  const c = makeCanvas(FW * dirs.length + (dirs.length - 1) * 4, FH);
  const g = ctx2d(c);
  dirs.forEach((d, i) => drawCharacter(g, i * (FW + 4), 0, a, { dir: d, legs: 'idle', expr: 'neutral' }));
  c.style.width = c.width * scale + 'px';
  c.style.height = c.height * scale + 'px';
  return c;
}

interface CreatorOpts {
  title: string;
  initial?: Appearance;
  name?: string;
  restaurant?: string;
  askNames: boolean;
  ownedClothes?: string[]; // when editing later, only owned items
  confirmLabel: string;
  onDone: (a: Appearance, name: string, restaurant: string) => void;
  onCancel?: () => void;
}

export function openCreator(o: CreatorOpts) {
  const a: Appearance = { ...(o.initial ?? defaultAppearance()) };
  let name = o.name ?? 'Sofi';
  let rest = o.restaurant ?? 'Midnight Maki';
  let done = false;

  // ---------------------------------------------------------------- big animated preview (turns and walks)
  const DIRS: Dir[] = ['down', 'left', 'up', 'right'];
  let dirIdx = 0;
  let walking = false;
  let frame = 0;
  const stage = makeCanvas(FW + 8, FH + 4);
  stage.className = 'cr-stage-canvas';
  const sg = ctx2d(stage);
  const paintStage = () => {
    sg.clearRect(0, 0, stage.width, stage.height);
    sg.fillStyle = 'rgba(30,60,30,.28)';
    sg.beginPath();
    sg.ellipse(stage.width / 2, stage.height - 3, 7, 2, 0, 0, Math.PI * 2);
    sg.fill();
    const legs = walking ? (['idle', 'a', 'idle', 'b'] as const)[frame % 4] : 'idle';
    const blink = !walking && frame % 18 === 17;
    drawCharacter(sg, 4, (walking && legs !== 'idle' ? -1 : 0) + 1, a, { dir: DIRS[dirIdx], legs, expr: blink ? 'blink' : 'neutral' });
  };
  const timer = window.setInterval(() => {
    frame++;
    paintStage();
  }, 180);
  const turn = (d: number) => {
    dirIdx = (dirIdx + d + 4) % 4;
    audio.sfxPlay('tap');
    paintStage();
  };
  const walkBtn = h('button', { class: 'btn small', onclick: () => { walking = !walking; walkBtn.textContent = walking ? 'Quieta' : 'Caminar'; } }, 'Caminar');
  const stageBox = h(
    'div',
    { class: 'cr-stage' },
    stage,
    h('div', { class: 'cr-stage-tools' },
      h('button', { class: 'btn small', 'aria-label': 'Girar a la izquierda', onclick: () => turn(-1) }, '⟲'),
      walkBtn,
      h('button', { class: 'btn small', 'aria-label': 'Girar a la derecha', onclick: () => turn(1) }, '⟳'),
    ),
  );
  const rerender = () => {
    paintStage();
    for (const fn of refreshers) fn();
  };
  const refreshers: (() => void)[] = [];

  // ---------------------------------------------------------------- building blocks
  const section = (label: string, ...kids: (HTMLElement | null)[]) => h('div', { class: 'cr-sec' }, h('div', { class: 'cr-label' }, label), ...kids.filter(Boolean) as HTMLElement[]);
  const swatches = (colors: () => string[], get: () => string, set: (c: string) => void) => {
    const wrap = h('div', { class: 'cr-swatches' });
    const draw = () => {
      wrap.innerHTML = '';
      for (const c of colors())
        wrap.append(h('button', { class: 'swatch' + (c === get() ? ' sel' : ''), style: { background: c }, 'aria-label': c, onclick: () => { set(c); audio.sfxPlay('tap'); rerender(); } }));
    };
    draw();
    refreshers.push(draw);
    return wrap;
  };
  /** grid of tiles; each tile shows a mini preview of the character with that option applied */
  const tiles = (options: () => { key: string; label: string; apply: (x: Appearance) => void; current: boolean }[], crop: 'head' | 'body' | 'full' = 'full') => {
    const wrap = h('div', { class: 'cr-tiles ' + crop });
    const draw = () => {
      wrap.innerHTML = '';
      for (const op of options()) {
        const look: Appearance = { ...a };
        op.apply(look);
        const cv = makeCanvas(FW, crop === 'head' ? 18 : FH);
        drawCharacter(ctx2d(cv), 0, 0, look, { dir: 'down', legs: 'idle', expr: 'neutral' });
        wrap.append(h('button', { class: 'cr-tile' + (op.current ? ' sel' : ''), title: op.label, onclick: () => { op.apply(a); audio.sfxPlay('tap'); rerender(); } }, cv, h('span', null, op.label)));
      }
    };
    draw();
    refreshers.push(draw);
    return wrap;
  };

  const clothesFor = (slot: ClothingSlot) => {
    const list = CLOTHES.filter((c) => c.slot === slot && (o.ownedClothes ? o.ownedClothes.includes(c.id) : c.price === 0 && c.shop === 'yuki' || ['hd_bow', 'hd_flower', 'fc_glasses', 'ex_scarf_red', 'bg_satchel', 'hd_beanie', 'top_kimono_sakura', 'bot_dress_rose', 'top_stripes_navy'].includes(c.id)));
    const ids = list.map((c) => c.id);
    if (['head', 'face', 'extra', 'bag'].includes(slot)) ids.unshift('');
    return ids;
  };
  const clothTiles = (slot: ClothingSlot) =>
    tiles(() => clothesFor(slot).map((id) => ({ key: id, label: id ? CLOTHES_BY_ID[id]?.name ?? id : 'Nada', current: a[slot] === id, apply: (x: Appearance) => { x[slot] = id; } })), slot === 'head' || slot === 'face' ? 'head' : 'full');

  const setSpecies = (sp: Species) => {
    a.species = sp;
    const pal = sp === 'human' ? SKINS_HUMAN : FURS;
    if (!pal.includes(a.skin)) a.skin = pal[sp === 'human' ? 1 : sp === 'raccoon' ? 4 : 1];
  };

  const nameInput = h('input', { type: 'text', value: name, maxlength: '14', 'aria-label': 'Nombre', oninput: (e: Event) => (name = (e.target as HTMLInputElement).value) });
  const restInput = h('input', { type: 'text', value: rest, maxlength: '20', 'aria-label': 'Nombre del restaurante', oninput: (e: Event) => (rest = (e.target as HTMLInputElement).value) });

  // ---------------------------------------------------------------- tabs
  const pages: [string, () => HTMLElement][] = [
    ['Cuerpo', () => h('div', null,
      section('Apariencia', tiles(() => SPECIES.map((sp) => ({ key: sp.id, label: sp.name, current: a.species === sp.id, apply: (x: Appearance) => { x.species = sp.id; const pal = sp.id === 'human' ? SKINS_HUMAN : FURS; if (!pal.includes(x.skin)) x.skin = pal[sp.id === 'human' ? 1 : sp.id === 'raccoon' ? 4 : 1]; } })), 'head')),
      section(a.species === 'human' ? 'Piel' : 'Pelaje', swatches(() => (a.species === 'human' ? SKINS_HUMAN : FURS), () => a.skin, (c) => (a.skin = c))),
    )],
    ['Pelo y ojos', () => h('div', null,
      section('Peinado', tiles(() => HAIR_STYLES.map((hs, i) => ({ key: String(i), label: hs.name, current: a.hairStyle === i, apply: (x: Appearance) => { x.hairStyle = i; } })), 'head')),
      section('Color de pelo', swatches(() => HAIRS, () => a.hairColor, (c) => (a.hairColor = c))),
      section('Ojos', tiles(() => EYE_STYLES.map((n, i) => ({ key: String(i), label: n, current: a.eyes === i, apply: (x: Appearance) => { x.eyes = i; } })), 'head')),
      section('Color de ojos', swatches(() => EYES, () => a.eyeColor, (c) => (a.eyeColor = c))),
    )],
    ['Ropa', () => h('div', null, section('Arriba', clothTiles('top')), section('Abajo', clothTiles('bottom')), section('Calzado', clothTiles('shoes')))],
    ['Accesorios', () => h('div', null, section('Cabeza', clothTiles('head')), section('Cara', clothTiles('face')), section('Extra', clothTiles('extra')), section('Bolso', clothTiles('bag')))],
  ];
  if (o.askNames) pages.push(['Nombre', () => h('div', null, section('Tu nombre', nameInput), section('Nombre del restaurante', restInput), h('p', { class: 'hint' }, 'Podés cambiar tu ropa más adelante desde el ropero de tu habitación.'))]);

  const content = h('div', { class: 'cr-page' });
  const tabBar = h('div', { class: 'tabs cr-tabs' });
  const show = (i: number) => {
    refreshers.length = 0;
    content.innerHTML = '';
    content.append(pages[i][1]());
    [...tabBar.children].forEach((t, j) => t.classList.toggle('active', j === i));
    content.scrollTop = 0;
  };
  pages.forEach(([label], i) => tabBar.append(h('button', { class: 'tab', onclick: () => { audio.sfxPlay('tap'); show(i); } }, label)));
  const body = h('div', { class: 'creator2' }, stageBox, h('div', { class: 'cr-side' }, tabBar, content));
  show(0);
  paintStage();
  void setSpecies;

  const randomize = () => {
    setSpecies(SPECIES[Math.floor(Math.random() * SPECIES.length)].id);
    const pal = a.species === 'human' ? SKINS_HUMAN : FURS;
    a.skin = pal[Math.floor(Math.random() * pal.length)];
    a.hairStyle = Math.floor(Math.random() * (HAIR_STYLES.length - 1));
    a.hairColor = HAIRS[Math.floor(Math.random() * HAIRS.length)];
    a.eyes = Math.floor(Math.random() * EYE_STYLES.length);
    a.eyeColor = EYES[Math.floor(Math.random() * EYES.length)];
    for (const sl of ['top', 'bottom', 'shoes', 'head', 'face', 'extra', 'bag'] as ClothingSlot[]) {
      const opts = clothesFor(sl);
      a[sl] = opts[Math.floor(Math.random() * opts.length)];
    }
    audio.sfxPlay('tap');
    const active = [...tabBar.children].findIndex((t) => t.classList.contains('active'));
    show(Math.max(0, active));
    paintStage();
  };

  const p = panel({
    title: o.title,
    body,
    wide: true,
    foot: [
      h('button', { class: 'btn', onclick: randomize }, 'Al azar'),
      h('button', {
        class: 'btn primary',
        onclick: () => {
          done = true;
          const nm = name.trim().slice(0, 14) || 'Sofi';
          const rs = rest.trim().slice(0, 20) || 'Midnight Maki';
          p.close();
          o.onDone(a, nm, rs);
        },
      }, o.confirmLabel),
    ],
    onClose: () => {
      window.clearInterval(timer);
      if (!done) o.onCancel?.();
    },
  });
  p.root.classList.add('creator-panel');
}
