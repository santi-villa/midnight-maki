/** Character creator (also reused from the wardrobe for appearance changes). The player is Santiago or Sofi, with lots of options. */
import { drawCharacter, FH, FW } from '../art/characters';
import { BROW_STYLES, EARRINGS, EYE_STYLES, FACE_SHAPES, FACIAL_HAIR, HERO_DEFAULTS, HERO_EYE_COLORS, HERO_HAIR, HERO_HAIR_COLORS, HERO_SKINS, NECK, heroLook } from '../art/hero';
import { drawHero, heroHeadshot, HERO_H, HERO_W, isHeroLook } from '../art/heroRender';
import { ctx2d, makeCanvas } from '../art/pixel';
import { audio } from '../audio/audio';
import { defaultAppearance } from '../core/state';
import type { Appearance, Dir } from '../core/types';
import { CLOTHES, CLOTHES_BY_ID, type ClothingSlot } from '../data/clothes';
import { h, panel } from './dom';

const LIP_COLORS = ['#c9606c', '#a8434f', '#e58f98', '#8e3e4e', '#b8707a'];
const BROW_COLORS = ['#1f1a22', '#3a281f', '#5a3d2e', '#8a6a44', '#b8a07a', '#8c8a96'];
const BUILDS = ['Delgada', 'Normal', 'Robusta'];
const NOSES = ['Chica', 'Normal', 'Marcada'];
const OPEN_EXTRAS = ['hd_bow', 'hd_flower', 'fc_glasses', 'fc_round', 'fc_sun', 'ex_scarf_red', 'bg_satchel', 'hd_beanie', 'top_kimono_sakura', 'bot_dress_rose', 'top_stripes_navy'];

/** Previews of any look (shops, wardrobe): heroes use the new renderer, the old animal species the old one. */
export function previewCanvas(a: Appearance, dirs: Dir[] = ['down', 'right', 'up'], scale = 4): HTMLCanvasElement {
  const hero = isHeroLook(a);
  const fw = hero ? HERO_W : FW;
  const fh = hero ? HERO_H : FH;
  const c = makeCanvas(fw * dirs.length + (dirs.length - 1) * 2, fh);
  const g = ctx2d(c);
  dirs.forEach((d, i) => {
    if (hero) drawHero(g, i * (fw + 2), 0, a, { dir: d });
    else drawCharacter(g, i * (fw + 2), 0, a, { dir: d, legs: 'idle', expr: 'neutral' });
  });
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
  // any older (animal) look is turned into the human hero; the clothes are kept
  const base = o.initial ?? defaultAppearance('m');
  const a: Appearance = isHeroLook(base) ? { ...base, hero: heroLook(base) } : { ...defaultAppearance(), top: base.top, bottom: base.bottom, shoes: base.shoes };
  const L = () => a.hero as NonNullable<Appearance['hero']>;
  const gender = () => L().gender ?? 'f';
  const defaultName = () => HERO_DEFAULTS[gender() === 'm' ? 'm' : 'f'].name;
  let name = o.name ?? defaultName();
  let nameTouched = !!o.name && o.name !== 'Sofi' && o.name !== 'Santiago';
  let rest = o.restaurant ?? 'Midnight Maki';
  let done = false;

  // ---------------------------------------------------------------- big animated preview (turns and walks)
  const DIRS: Dir[] = ['down', 'left', 'up', 'right'];
  let dirIdx = 0;
  let walking = false;
  let frame = 0;
  const stage = makeCanvas(HERO_W + 8, HERO_H + 4);
  stage.className = 'cr-stage-canvas';
  const sg = ctx2d(stage);
  const paintStage = () => {
    sg.clearRect(0, 0, stage.width, stage.height);
    sg.fillStyle = 'rgba(30,60,30,.28)';
    sg.beginPath();
    sg.ellipse(stage.width / 2, stage.height - 3, 8, 2, 0, 0, Math.PI * 2);
    sg.fill();
    const legs = walking ? (['idle', 'a', 'idle', 'b'] as const)[frame % 4] : 'idle';
    const blink = !walking && frame % 18 === 17;
    drawHero(sg, 4, 2, a, { dir: DIRS[dirIdx], legs, expr: blink ? 'blink' : 'neutral', bob: walking && legs !== 'idle' ? -1 : 0 });
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
  const walkBtn = h('button', { class: 'btn small', onclick: () => { walking = !walking; walkBtn.textContent = walking ? 'Quieto' : 'Caminar'; } }, 'Caminar');
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
  const swatches = (colors: () => string[], get: () => string, set: (c: string) => void, none?: string) => {
    const wrap = h('div', { class: 'cr-swatches' });
    const draw = () => {
      wrap.innerHTML = '';
      if (none) wrap.append(h('button', { class: 'btn small' + (get() === '' ? ' sel' : ''), style: get() === '' ? { outline: '3px solid var(--gold)' } : {}, onclick: () => { set(''); audio.sfxPlay('tap'); rerender(); } }, none));
      for (const c of colors())
        wrap.append(h('button', { class: 'swatch' + (c === get() ? ' sel' : ''), style: { background: c }, 'aria-label': c, onclick: () => { set(c); audio.sfxPlay('tap'); rerender(); } }));
    };
    draw();
    refreshers.push(draw);
    return wrap;
  };
  const clone = (): Appearance => ({ ...a, hero: { ...L() } });
  /** grid of tiles; each tile shows a mini preview of the character with that option applied */
  const tiles = (options: () => { key: string; label: string; apply: (x: Appearance) => void; current: boolean }[], crop: 'head' | 'body' | 'full' = 'full') => {
    const wrap = h('div', { class: 'cr-tiles ' + crop });
    const draw = () => {
      wrap.innerHTML = '';
      for (const op of options()) {
        const look = clone();
        op.apply(look);
        const cv = crop === 'head' ? heroHeadshot(look) : previewCanvas(look, ['down'], 1);
        cv.removeAttribute('style');
        wrap.append(h('button', { class: 'cr-tile' + (op.current ? ' sel' : ''), title: op.label, onclick: () => { op.apply(a); audio.sfxPlay('tap'); rerender(); } }, cv, h('span', null, op.label)));
      }
    };
    draw();
    refreshers.push(draw);
    return wrap;
  };
  const look = <K extends keyof NonNullable<Appearance['hero']>>(key: K, labels: string[], crop: 'head' | 'full' = 'head') =>
    tiles(() => labels.map((label, i) => ({ key: String(i), label, current: L()[key] === i, apply: (x: Appearance) => { (x.hero as Record<string, unknown>)[key] = i; } })), crop);
  const flag = (key: 'freckles' | 'mole' | 'blush', yes: string, no: string) =>
    tiles(() => [false, true].map((v) => ({ key: String(v), label: v ? yes : no, current: !!L()[key] === v, apply: (x: Appearance) => { (x.hero as Record<string, unknown>)[key] = v; } })), 'head');

  const clothesFor = (slot: ClothingSlot) => {
    const list = CLOTHES.filter((c) => c.slot === slot && (o.ownedClothes ? o.ownedClothes.includes(c.id) : (c.price === 0 && c.shop === 'yuki') || OPEN_EXTRAS.includes(c.id)));
    const ids = list.map((c) => c.id);
    if (slot !== 'top' && slot !== 'bottom' && slot !== 'shoes') ids.unshift('');
    return ids;
  };
  const clothTiles = (slot: ClothingSlot) =>
    tiles(() => clothesFor(slot).map((id) => ({ key: id, label: id ? CLOTHES_BY_ID[id]?.name ?? id : 'Nada', current: a[slot] === id, apply: (x: Appearance) => { x[slot] = id; } })), slot === 'head' || slot === 'face' ? 'head' : 'full');

  const nameInput = h('input', { type: 'text', value: name, maxlength: '14', 'aria-label': 'Nombre', oninput: (e: Event) => { name = (e.target as HTMLInputElement).value; nameTouched = true; } }) as HTMLInputElement;
  const restInput = h('input', { type: 'text', value: rest, maxlength: '20', 'aria-label': 'Nombre del restaurante', oninput: (e: Event) => (rest = (e.target as HTMLInputElement).value) });

  /** switch between the two heroes: starts again from that hero's own look (and name, unless the player typed one) */
  const pickHero = (g: 'm' | 'f') => {
    const d = defaultAppearance(g);
    Object.assign(a, d, o.ownedClothes ? { top: a.top, bottom: a.bottom, shoes: a.shoes, head: a.head, face: a.face, extra: a.extra, bag: a.bag } : {});
    if (!nameTouched) { name = HERO_DEFAULTS[g].name; nameInput.value = name; }
  };

  // ---------------------------------------------------------------- tabs
  const pages: [string, () => HTMLElement][] = [];
  if (o.askNames)
    pages.push(['Personaje', () => h('div', null,
      section('¿Quién sos?', tiles(() => (['m', 'f'] as const).map((g) => ({ key: g, label: HERO_DEFAULTS[g].name, current: gender() === g, apply: (x: Appearance) => { if (x === a) pickHero(g); else Object.assign(x, defaultAppearance(g)); } })), 'full')),
      h('p', { class: 'hint' }, 'Santiago o Sofi: elegí a quien quieras ser. Después podés cambiarle todo: pelo, cara, ropa y accesorios.'),
    )]);
  pages.push(
    ['Cuerpo', () => h('div', null,
      section('Contextura', look('build', BUILDS, 'full')),
      section('Piel', swatches(() => HERO_SKINS, () => a.skin, (c) => (a.skin = c))),
      section('Forma de cara', look('face', FACE_SHAPES)),
      section('Pecas', flag('freckles', 'Con pecas', 'Sin pecas')),
      section('Lunar', flag('mole', 'Con lunar', 'Sin lunar')),
      section('Rubor', flag('blush', 'Con rubor', 'Sin rubor')),
    )],
    ['Cara', () => h('div', null,
      section('Ojos', tiles(() => EYE_STYLES.map((n, i) => ({ key: String(i), label: n, current: a.eyes === i, apply: (x: Appearance) => { x.eyes = i; } })), 'head')),
      section('Color de ojos', swatches(() => HERO_EYE_COLORS, () => a.eyeColor, (c) => (a.eyeColor = c))),
      section('Cejas', look('brow', BROW_STYLES)),
      section('Color de cejas', swatches(() => BROW_COLORS, () => L().browColor ?? '', (c) => (L().browColor = c), 'Como el pelo')),
      section('Nariz', look('nose', NOSES)),
      section('Labios', swatches(() => LIP_COLORS, () => L().lips ?? '', (c) => (L().lips = c), 'Naturales')),
      section('Barba y bigote', look('facial', FACIAL_HAIR)),
    )],
    ['Pelo', () => h('div', null,
      section('Peinado', tiles(() => HERO_HAIR.map((hs, i) => ({ key: String(i), label: hs.name, current: a.hairStyle === i, apply: (x: Appearance) => { x.hairStyle = i; } })), 'head')),
      section('Color de pelo', swatches(() => HERO_HAIR_COLORS, () => a.hairColor, (c) => (a.hairColor = c))),
      section('Mechas y reflejos', swatches(() => HERO_HAIR_COLORS, () => L().hairHi ?? '', (c) => (L().hairHi = c), 'Automático')),
    )],
    ['Ropa', () => h('div', null, section('Arriba', clothTiles('top')), section('Abajo', clothTiles('bottom')), section('Calzado', clothTiles('shoes')))],
    ['Accesorios', () => h('div', null,
      section('Aros', look('earrings', EARRINGS)),
      section('Cuello', look('neck', NECK, 'full')),
      section('Cabeza', clothTiles('head')),
      section('Lentes y cara', clothTiles('face')),
      section('Extra', clothTiles('extra')),
      section('Bolso', clothTiles('bag')),
    )],
  );
  if (o.askNames) pages.push(['Nombre', () => h('div', null, section('Tu nombre', nameInput), section('Nombre del restaurante', restInput), h('p', { class: 'hint' }, 'Podés cambiar tu ropa y tu look más adelante desde el ropero de tu habitación.'))]);

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

  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)];
  const randomize = () => {
    const l = L();
    a.skin = pick(HERO_SKINS);
    a.hairStyle = Math.floor(Math.random() * HERO_HAIR.length);
    a.hairColor = pick(HERO_HAIR_COLORS);
    l.hairHi = Math.random() < 0.25 ? pick(HERO_HAIR_COLORS) : '';
    a.eyes = Math.floor(Math.random() * EYE_STYLES.length);
    a.eyeColor = pick(HERO_EYE_COLORS);
    l.build = pick([0, 1, 2] as const);
    l.face = Math.floor(Math.random() * FACE_SHAPES.length);
    l.brow = Math.floor(Math.random() * BROW_STYLES.length);
    l.browColor = '';
    l.nose = Math.floor(Math.random() * NOSES.length);
    l.lips = Math.random() < 0.4 ? pick(LIP_COLORS) : '';
    l.freckles = Math.random() < 0.2;
    l.mole = Math.random() < 0.15;
    l.blush = Math.random() < 0.35;
    l.facial = l.gender === 'm' && Math.random() < 0.4 ? 1 + Math.floor(Math.random() * (FACIAL_HAIR.length - 1)) : 0;
    l.earrings = Math.random() < 0.3 ? 1 + Math.floor(Math.random() * (EARRINGS.length - 1)) : 0;
    l.neck = Math.random() < 0.5 ? 1 + Math.floor(Math.random() * (NECK.length - 1)) : 0;
    for (const sl of ['top', 'bottom', 'shoes', 'head', 'face', 'extra', 'bag'] as ClothingSlot[]) {
      const opts = clothesFor(sl);
      a[sl] = sl === 'face' || sl === 'extra' || sl === 'bag' || sl === 'head' ? (Math.random() < 0.6 ? '' : pick(opts)) : pick(opts);
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
          const nm = name.trim().slice(0, 14) || defaultName();
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
