import { audio } from '../audio/audio';
import { bus } from '../core/events';
import { game } from '../core/state';
import { CHAR_BY_ID } from '../data/characters';
import { CLOTHES_BY_ID } from '../data/clothes';
import { appearanceOf } from '../systems/appearance';
import { openCreator, previewCanvas } from './creator';
import { h, panel, toast } from './dom';

/** Change the player's look using owned clothes; progress is untouched. */
export function openWardrobe() {
  openCreator({
    title: 'Tu apariencia',
    askNames: false,
    initial: game.save.player.appearance,
    ownedClothes: game.save.clothesOwned,
    confirmLabel: 'Listo',
    onDone: (a) => {
      game.save.player.appearance = a;
      game.touch('appearance');
      bus.emit('appearance:changed', {});
      audio.sfxPlay('sparkle');
    },
  });
}

/** Raccoons can wear owned head accessories and extras (scarves, aprons, capes). */
export function openRaccoonOutfit(id: string) {
  const name = CHAR_BY_ID[id]?.name ?? id;
  const cur = { ...(game.save.raccoonOutfits[id] ?? { head: CHAR_BY_ID[id].appearance.head, extra: CHAR_BY_ID[id].appearance.extra }) };
  const preview = h('div', { class: 'preview', style: { display: 'flex', justifyContent: 'center', background: 'linear-gradient(#b7a8d6,#9bb59a)', borderRadius: '12px', padding: '8px', border: '3px solid #46291f' } });
  const draw = () => {
    preview.innerHTML = '';
    game.save.raccoonOutfits[id] = cur;
    preview.append(previewCanvas(appearanceOf(id), ['down', 'right'], 5));
  };
  const original = game.save.raccoonOutfits[id];
  const owned = (slot: 'head' | 'extra') => ['', CHAR_BY_ID[id].appearance[slot], ...game.save.clothesOwned.filter((c) => CLOTHES_BY_ID[c]?.slot === slot)].filter((v, i, a) => a.indexOf(v) === i);
  const row = (slot: 'head' | 'extra', label: string) => {
    const span = h('span', null);
    const set = () => (span.textContent = cur[slot] ? CLOTHES_BY_ID[cur[slot]]?.name ?? '—' : 'Nada');
    set();
    const step = (d: number) => {
      const list = owned(slot);
      cur[slot] = list[(list.indexOf(cur[slot]) + d + list.length) % list.length];
      set();
      draw();
    };
    return h('div', { class: 'opt-row' }, h('label', null, label), h('div', { class: 'stepper' }, h('button', { onclick: () => step(-1) }, '‹'), span, h('button', { onclick: () => step(1) }, '›')));
  };
  draw();
  let saved = false;
  panel({
    title: `Atuendo de ${name}`,
    body: h('div', { class: 'col' }, preview, row('head', 'Cabeza'), row('extra', 'Extra'), h('p', { class: 'hint' }, 'Podés usar los accesorios que tengas en tu ropero.')),
    foot: [h('button', { class: 'btn primary', onclick: (e: Event) => { saved = true; game.touch('outfit'); bus.emit('appearance:changed', {}); toast(`¡A ${name} le encanta!`); ((e.target as HTMLElement).closest('.panel-backdrop') as any).__close(); } }, 'Guardar')],
    onClose: () => {
      if (!saved) {
        if (original) game.save.raccoonOutfits[id] = original;
        else delete game.save.raccoonOutfits[id];
      }
    },
  });
}
