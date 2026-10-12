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
  // villagers chatting with each other
  const others = [...scene.npcs.entries()].filter(([oid, n]) => oid !== id && Math.hypot(n.actor.x - actor.x, n.actor.y - actor.y) < 48);
  if (others.length && Math.random() < 0.4) {
    const [, other] = others[0];
    const chat = [['¿Viste el cielo anoche?', 'Sí... raro, ¿no?'], ['¿Probaste el sushi nuevo?', '¡Tres veces!'], ['Qué lindo día.', 'Ideal para un té.'], ['♪', '♪♪']][Math.floor(Math.random() * 4)];
    actor.emote(chat[0], 2.2);
    setTimeout(() => other.actor.emote(chat[1], 2.2), 1400);
    return;
  }
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
    setTimeout(() => actor.act === q.act && actor.setAct(prev === q.act ? 'idle' : prev), q.act === 'sleep' ? 9000 : 1800);
  }
}
