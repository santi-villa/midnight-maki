/**
 * First-day coach: one-time friendly tips that appear at the right moment and make the related
 * button glow (joystick, action button, map, bag, menu). Each tip is shown once per save.
 */
import { bus } from '../core/events';
import { game } from '../core/state';
import { inDialogue } from '../dialogue/dialogue';
import { h, modalOpen, uiRoot } from './dom';
import { portraitURL } from '../systems/appearance';

interface Tip { id: string; who: string; text: string; target?: string; }

let current: HTMLElement | null = null;
const queue: Tip[] = [];

function show(t: Tip) {
  if (game.has('tip_' + t.id) || queue.some((q) => q.id === t.id) || current?.dataset.id === t.id) return;
  queue.push(t);
  pump();
}

function pump() {
  if (current || !queue.length || !game.loaded) return;
  if (inDialogue() || modalOpen()) {
    setTimeout(pump, 800);
    return;
  }
  const t = queue.shift()!;
  game.setFlag('tip_' + t.id);
  const glow = t.target ? document.querySelector<HTMLElement>(t.target) : null;
  glow?.classList.add('coach-glow');
  const close = () => {
    glow?.classList.remove('coach-glow');
    current?.remove();
    current = null;
    setTimeout(pump, 600);
  };
  current = h('div', { class: 'coach', 'data-id': t.id },
    h('img', { src: portraitURL(t.who, 'happy'), alt: '' }),
    h('div', { class: 'coach-text' }, t.text),
    h('button', { class: 'btn small primary', onclick: close }, '¡Entendido!'));
  uiRoot().append(current);
  setTimeout(() => current?.dataset.id === t.id && close(), 14000);
}

let installed = false;
export function installCoach() {
  if (installed) return;
  installed = true;
  const arrival = () => {
    show({ id: 'move', who: 'pip', target: '.joystick', text: 'Para caminar, arrastrá la ruedita de madera. También podés tocar el suelo y {name} va sola.'.replace('{name}', game.save.player.name) });
    show({ id: 'arrow', who: 'rigg', text: 'Si no sabés adónde ir, seguí la flechita dorada que gira a tu alrededor. Siempre apunta a tu misión.' });
  };
  bus.on('flag:set', ({ key }) => {
    if (key === 'arrived') setTimeout(arrival, 600);
  });
  bus.on('zone:enter', ({ zone }) => {
    if (zone === 'plaza' && game.has('arrived')) arrival();
    if (zone === 'restaurant' && game.has('tut_spicy')) show({ id: 'bag', who: 'spicy', target: '.hud-buttons .icon-btn:nth-child(1)', text: 'En la Mochila están tus ingredientes. ¡Sin arroz no hay sushi, y sin sushi no hay gloria!' });
    if (zone === 'home') show({ id: 'menu', who: 'pip', target: '.hud-buttons .icon-btn:nth-child(4)', text: 'En el Menú está Decorar, el ropero, la cámara y para descansar. ¡Mi cuarto es el más lindo, igual!' });
  });
  bus.on('interact:available', ({ label }) => {
    if (label) show({ id: 'act', who: 'spicy', target: '.hud-interact', text: 'Cuando aparece este botón grande, tocalo para hablar o usar lo que tenés cerca.' });
  });
  bus.on('recipe:cooked', () => {
    show({ id: 'map', who: 'rigg', target: '.hud-buttons .icon-btn:nth-child(3)', text: 'Buen trabajo. Para explorar Villa Nori usá el Mapa: te muestra dónde estás y dónde andamos nosotros.' });
  });
}
