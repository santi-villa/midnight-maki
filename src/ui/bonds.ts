/** "Vínculos": the personal scenes with Pip, Spicy and Rigg, what unlocks each and a replay for the ones already lived. */
import { runTask } from '../core/errors';
import { game } from '../core/state';
import { BONDS, bondDone, bondsDone, playBond, type Bond } from '../story/bonds';
import { h, panel } from './dom';

const WHO: [Bond['who'], string][] = [['pip', 'Pip'], ['spicy', 'Spicy Bacon'], ['rigg', 'Rigg'], ['trio', 'Los tres juntos']];

export function openBonds() {
  let close = () => {};
  const replay = (b: Bond) => { close(); void runTask('bond:replay', async () => { await playBond(b, true); openBonds(); }); };
  const body = h('div', { class: 'col' }, h('p', { class: 'hint' }, `Escenas cortas con los mapaches, ligadas a lo que hacés en el pueblo. Nunca se pierden: cuando se cumple lo que piden, hablá con ellos. Vividas: ${bondsDone()}/${BONDS.length}.`));
  for (const [who, label] of WHO) {
    const list = BONDS.filter((b) => b.who === who);
    body.append(h('h3', null, label));
    for (const b of list) {
      const done = bondDone(b);
      const ready = !done && b.ready();
      const who2 = b.who === 'trio' ? 'Pip, en el restaurante' : label.split(' ')[0];
      body.append(h('article', { class: 'card col' },
        h('b', null, done || ready ? b.title : 'Una escena por descubrir'),
        h('p', { class: 'hint' }, done ? `✓ ${b.reward.memory}` : ready ? `Está lista: hablá con ${who2}.` : b.hint),
        done ? h('button', { class: 'btn small', onclick: () => replay(b) }, 'Recordar (sin premios)') : null));
    }
  }
  close = panel({ title: 'Vínculos', body }).close;
}

/** Number of scenes ready to play, for the little dot on the phone's Amigos icon. */
export function bondsNews(): number {
  return game.loaded ? BONDS.filter((b) => !bondDone(b) && b.ready()).length : 0;
}
