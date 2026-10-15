/** A chat with an ambient neighbour: a few words, and the chance to invite them to Midnight Maki. */
import { runScene, say, choose } from '../dialogue/dialogue';
import { game } from '../core/state';
import { NEIGHBOR_BY_ID } from '../data/neighbors';
import { RECIPES_BY_ID } from '../data/recipes';
import { inviteNeighbor, clients } from './townVisits';

export async function talkToNeighbor(id: string) {
  const n = NEIGHBOR_BY_ID[id];
  if (!n) return;
  await runScene(`nb_${id}_${game.save.time.day}`, async () => {
    const reg = clients().regulars[id];
    const fav = reg && Object.entries(reg.likes).sort((a, b) => b[1] - a[1])[0];
    const hello = fav ? `¡Hola! Qué rico estaba el ${RECIPES_BY_ID[fav[0]]?.name ?? 'plato'} del otro día.` : n.lines[(game.save.time.day + id.length) % n.lines.length];
    await say(n.name, hello);
    const pick = await choose(['Invitar a Midnight Maki', 'Seguir charlando', 'Nada, hasta luego'], 'player');
    if (pick === 0) {
      const r = inviteNeighbor(id);
      await say(n.name, r.line);
      if (r.answer === 'later') await say('player', '¡Te esperamos!');
    } else if (pick === 1) {
      await say(n.name, n.lines[(game.save.time.day + id.length + 1) % n.lines.length]);
    }
  });
}
