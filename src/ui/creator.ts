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
  const preview = h('div', { class: 'preview' });
  const body = h('div', { class: 'creator' });
  const rerender = () => {
    preview.innerHTML = '';
    const c = previewCanvas(a);
    c.style.width = c.width * 4 + 'px';
    c.style.height = 'auto';
    c.style.maxWidth = '100%';
    preview.append(c);
  };

  const stepper = (label: string, get: () => string, prev: () => void, next: () => void) => {
    const span = h('span', null, get());
    const row = h(
      'div',
      { class: 'opt-row' },
      h('label', null, label),
      h(
        'div',
        { class: 'stepper' },
        h('button', { 'aria-label': 'Anterior', onclick: () => { prev(); span.textContent = get(); audio.sfxPlay('tap'); rerender(); } }, '‹'),
        span,
        h('button', { 'aria-label': 'Siguiente', onclick: () => { next(); span.textContent = get(); audio.sfxPlay('tap'); rerender(); } }, '›'),
      ),
    );
    return row;
  };
  const swatches = (label: string, colors: () => string[], get: () => string, set: (c: string) => void) => {
    const wrap = h('div', { class: 'swatches' });
    const draw = () => {
      wrap.innerHTML = '';
      for (const c of colors())
        wrap.append(h('button', { class: 'swatch' + (c === get() ? ' sel' : ''), style: { background: c }, 'aria-label': c, onclick: () => { set(c); audio.sfxPlay('tap'); draw(); rerender(); } }));
    };
    draw();
    (wrap as any).redraw = draw;
    return h('div', { class: 'opt-row' }, h('label', null, label), wrap);
  };
  const cycle = <T,>(arr: T[], cur: T, d: number) => arr[(arr.indexOf(cur) + d + arr.length) % arr.length];

  const clothesFor = (slot: ClothingSlot) => {
    const list = CLOTHES.filter((c) => c.slot === slot && (o.ownedClothes ? o.ownedClothes.includes(c.id) : c.price === 0 && c.shop === 'yuki' || ['hd_bow', 'hd_flower', 'fc_glasses', 'ex_scarf_red', 'bg_satchel', 'hd_beanie', 'top_kimono_sakura', 'bot_dress_rose', 'top_stripes_navy'].includes(c.id)));
    const ids = list.map((c) => c.id);
    if (['head', 'face', 'extra', 'bag'].includes(slot)) ids.unshift('');
    return ids;
  };
  const clothStepper = (label: string, slot: ClothingSlot) =>
    stepper(
      label,
      () => (a[slot] ? CLOTHES_BY_ID[a[slot]]?.name ?? '—' : 'Nada'),
      () => (a[slot] = cycle(clothesFor(slot), a[slot], -1)),
      () => (a[slot] = cycle(clothesFor(slot), a[slot], 1)),
    );

  const skinRow = swatches('Piel / pelaje', () => (a.species === 'human' ? SKINS_HUMAN : FURS), () => a.skin, (c) => (a.skin = c));
  const speciesRow = stepper(
    'Apariencia',
    () => SPECIES.find((s) => s.id === a.species)?.name ?? '',
    () => setSpecies(-1),
    () => setSpecies(1),
  );
  function setSpecies(d: number) {
    const i = SPECIES.findIndex((s) => s.id === a.species);
    a.species = SPECIES[(i + d + SPECIES.length) % SPECIES.length].id;
    const pal = a.species === 'human' ? SKINS_HUMAN : FURS;
    if (!pal.includes(a.skin)) a.skin = pal[a.species === 'human' ? 1 : a.species === 'raccoon' ? 4 : 1];
    (skinRow.querySelector('.swatches') as any).redraw();
  }

  const nameInput = h('input', { type: 'text', value: name, maxlength: '14', 'aria-label': 'Nombre', oninput: (e: Event) => (name = (e.target as HTMLInputElement).value) });
  const restInput = h('input', { type: 'text', value: rest, maxlength: '20', 'aria-label': 'Nombre del restaurante', oninput: (e: Event) => (rest = (e.target as HTMLInputElement).value) });

  body.append(
    preview,
    o.askNames ? h('div', { class: 'opt-row' }, h('label', null, 'Nombre'), nameInput) : null as any,
    speciesRow,
    skinRow,
    stepper('Peinado', () => HAIR_STYLES[a.hairStyle]?.name ?? '', () => (a.hairStyle = (a.hairStyle + HAIR_STYLES.length - 1) % HAIR_STYLES.length), () => (a.hairStyle = (a.hairStyle + 1) % HAIR_STYLES.length)),
    swatches('Color de pelo', () => HAIRS, () => a.hairColor, (c) => (a.hairColor = c)),
    stepper('Ojos', () => EYE_STYLES[a.eyes] ?? '', () => (a.eyes = (a.eyes + EYE_STYLES.length - 1) % EYE_STYLES.length), () => (a.eyes = (a.eyes + 1) % EYE_STYLES.length)),
    swatches('Color de ojos', () => EYES, () => a.eyeColor, (c) => (a.eyeColor = c)),
    clothStepper('Arriba', 'top'),
    clothStepper('Abajo', 'bottom'),
    clothStepper('Calzado', 'shoes'),
    clothStepper('Cabeza', 'head'),
    clothStepper('Cara', 'face'),
    clothStepper('Extra', 'extra'),
    clothStepper('Bolso', 'bag'),
    o.askNames ? h('div', { class: 'opt-row' }, h('label', null, 'Restaurante'), restInput) : null as any,
  );
  rerender();

  const randomize = () => {
    a.species = SPECIES[Math.floor(Math.random() * SPECIES.length)].id;
    const pal = a.species === 'human' ? SKINS_HUMAN : FURS;
    a.skin = pal[Math.floor(Math.random() * pal.length)];
    a.hairStyle = Math.floor(Math.random() * (HAIR_STYLES.length - 1));
    a.hairColor = HAIRS[Math.floor(Math.random() * HAIRS.length)];
    a.eyes = Math.floor(Math.random() * EYE_STYLES.length);
    for (const s of ['top', 'bottom', 'shoes', 'head', 'face', 'extra', 'bag'] as ClothingSlot[]) {
      const opts = clothesFor(s);
      a[s] = opts[Math.floor(Math.random() * opts.length)];
    }
    done = true;
    p.close();
    openCreator({ ...o, initial: a, name, restaurant: rest });
  };

  let done = false;
  const p = panel({
    title: o.title,
    body,
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
      if (!done) o.onCancel?.();
    },
  });
}
