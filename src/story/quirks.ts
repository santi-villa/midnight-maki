/** Small spontaneous raccoon moments that make them feel alive without interrupting play. */
import type { Actor } from '../entities/Actor';
import type { WorldScene } from '../scenes/WorldScene';
import { game } from '../core/state';

const QUIRKS: Record<string, { text: string; act?: 'sleep' | 'happy' | 'surprised'; flag?: string }[]> = {
  pip: [
    { text: 'z z z', act: 'sleep' },
    { text: '¡Un tesoro!', act: 'happy', flag: 'pip_treasure_ready' },
    { text: '♪', act: 'happy' },
    { text: '¿Eso brilla?', act: 'surprised' },
    { text: '¡Ups!', act: 'surprised' },
  ],
  spicy: [
    { text: '¡Obra maestra!', act: 'happy' },
    { text: '¿Más wasabi? Sí.' },
    { text: '¡¿Quién movió mi ají?!', act: 'surprised' },
    { text: '♪ tarara ♪', act: 'happy' },
  ],
  rigg: [
    { text: '...' },
    { text: '(lee un libro al revés)' },
    { text: 'Interesante.' },
    { text: '(anota algo)' },
  ],
};

export function runQuirk(id: string, actor: Actor, scene: WorldScene) {
  // Conversations are coordinated by the world, with context and safe lifetimes.
  if (scene.npcs.get(id)?.social || scene.npcs.get(id)?.traveling) return;
  const list = QUIRKS[id];
  if (!list) return;
  const q = list[Math.floor(Math.random() * list.length)];
  if (q.flag) {
    // Pip found a "treasure": a gift waits for the player the next time you talk to Pip
    if (game.has('intro_done')) game.setFlag(q.flag, game.save.time.day);
  }
  actor.emote(q.text, 2.4);
  if (q.act) {
    const prev = actor.act;
    actor.setAct(q.act);
    scene.time.delayedCall(q.act === 'sleep' ? 9000 : 1800, () => {
      const current = scene.npcs.get(id);
      if (current?.actor === actor && !current.social && !current.traveling && actor.sprite.active && actor.act === q.act) actor.setAct(prev === q.act ? 'idle' : prev);
    });
  }
}
