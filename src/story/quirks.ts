/** Small spontaneous raccoon moments, without interrupting play or scripted scenes. */
import type { Actor, Act } from '../entities/Actor';
import type { WorldScene } from '../scenes/WorldScene';
import { game } from '../core/state';

interface Quirk { text: string; act?: Act; flag?: string; home?: boolean }
const QUIRKS: Record<string, Quirk[]> = {
  pip: [
    { text: 'z z z', act: 'sleep', home: true },
    { text: '¡Un tesoro!', act: 'play', flag: 'pip_treasure_ready' },
    { text: 'Una canica, dos canicas...', act: 'play' },
    { text: '¡Este rincón queda limpio!', act: 'clean' },
    { text: '¿Eso brilla?', act: 'surprised' },
    { text: '♪', act: 'happy' },
  ],
  spicy: [
    { text: '¡Obra maestra!', act: 'happy' },
    { text: '¿Más wasabi? Sí.', act: 'cook' },
    { text: 'Cada frasco en su lugar.', act: 'clean' },
    { text: 'Un sorbito y sigo.', act: 'drink' },
    { text: '♪ tarara ♪', act: 'happy' },
  ],
  rigg: [
    { text: 'Una página más.', act: 'read' },
    { text: '(anota algo)', act: 'work' },
    { text: 'Este libro iba acá.', act: 'clean' },
    { text: 'Me guardo este ratito.', act: 'sit' },
    { text: 'Interesante.', act: 'look' },
  ],
};
const recent = new Map<string, string>();

function available(id: string, actor: Actor, scene: WorldScene) {
  const n = scene.npcs.get(id);
  return scene.canAct() && game.has('intro_done') && n?.actor === actor && !n.social && !n.traveling && n.t < 80 &&
    !actor.path.length && actor.act !== 'sleep' && !game.flag('at_' + id);
}
function show(id: string, q: Quirk, actor: Actor, scene: WorldScene) {
  actor.emote(q.text, 2.4);
  if (!q.act) return;
  const prev = actor.act;
  actor.setAct(q.act);
  scene.time.delayedCall(q.act === 'sleep' ? 6000 : 2600, () => {
    const current = scene.npcs.get(id);
    if (current?.actor === actor && !current.social && !current.traveling && actor.sprite.active && actor.act === q.act) actor.setAct(prev === q.act ? 'idle' : prev);
  });
}
export function runQuirk(id: string, actor: Actor, scene: WorldScene) {
  if (!available(id, actor, scene)) return;
  const list = QUIRKS[id]?.filter(q => (!q.home || scene.zoneId === 'home') && q.text !== recent.get(id));
  if (!list?.length) return;
  const q = list[Math.floor(Math.random() * list.length)];
  recent.set(id, q.text);
  if (q.flag) game.setFlag(q.flag, game.save.time.day);
  show(id, q, actor, scene);
}

/** At most one brief reaction per character/day; no popup or automatic reward. */
export function reactToDecor(id: string, actor: Actor, scene: WorldScene) {
  const text = { pip: '¡Un rincón para nuevos tesoros!', spicy: '¡El restaurante tiene buena pinta!', rigg: 'Se siente un poquito más como casa.' }[id];
  if (!text || !available(id, actor, scene) || game.flag('decor_reaction_' + id) === game.save.time.day) return;
  game.setFlag('decor_reaction_' + id, game.save.time.day);
  show(id, { text, act: 'happy' }, actor, scene);
}
