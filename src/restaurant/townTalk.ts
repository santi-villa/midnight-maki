/** A chat with an ambient neighbour: a few words, an invitation, or a piece of furniture. */
import { runScene, say, choose } from '../dialogue/dialogue';
import { BALANCE } from '../core/balance';
import { game } from '../core/state';
import { NEIGHBOR_BY_ID } from '../data/neighbors';
import { RECIPES_BY_ID } from '../data/recipes';
import { giftFurniture, pickFurnitureGift } from '../world/furnGift';
import { inviteNeighbor, clients } from './townVisits';

export async function talkToNeighbor(id: string) {
  const n = NEIGHBOR_BY_ID[id];
  if (!n) return;
  await runScene(`nb_${id}_${game.save.time.day}`, async () => {
    const reg = clients().regulars[id];
    const fav = reg && Object.entries(reg.likes).sort((a, b) => b[1] - a[1])[0];
    const hello = fav ? `¡Hola! Qué rico estaba el ${RECIPES_BY_ID[fav[0]]?.name ?? 'plato'} del otro día.` : n.lines[(game.save.time.day + id.length) % n.lines.length];
    await say(n.name, hello);
    const known = game.rel(id);
    if (known.points < BALANCE.talkPoints) game.addFriendship(id, BALANCE.talkPoints - known.points);
    known.lastTalkDay = game.save.time.day;
    const pick = await choose(['Invitar a Midnight Maki', 'Regalar un mueble', 'Seguir charlando', 'Nada, hasta luego'], 'player');
    if (pick === 0) {
      const r = inviteNeighbor(id);
      await say(n.name, r.line);
      if (r.answer === 'later') await say('player', '¡Te esperamos!');
    } else if (pick === 1) {
      const furn = await pickFurnitureGift();
      if (!furn) await say(n.name, 'No te preocupes, en otro momento.');
      else await say(n.name, giftFurniture(id, furn).line);
    } else if (pick === 2) {
      await say(n.name, n.lines[(game.save.time.day + id.length + 1) % n.lines.length]);
    }
  });
}
