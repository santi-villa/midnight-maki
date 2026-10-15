/** A chat with an ambient neighbour: topics, an invitation, a furniture gift, a joke or a photo. */
import { runScene, say, choose } from '../dialogue/dialogue';
import { baseTalkContext, chatMenu } from '../dialogue/talk';
import { topicLine, type TalkCtx } from '../dialogue/topics';
import { BALANCE } from '../core/balance';
import { game } from '../core/state';
import { NEIGHBOR_BY_ID } from '../data/neighbors';
import { RECIPES_BY_ID } from '../data/recipes';
import { giftFurniture, pickFurnitureGift } from '../world/furnGift';
import { inviteNeighbor, clients } from './townVisits';

async function neighborContext(id: string): Promise<TalkCtx> {
  const { world } = await import('../scenes/WorldScene');
  const n = NEIGHBOR_BY_ID[id];
  const sit = world.neighborSituation(id);
  const reg = clients().regulars[id];
  const fav = reg && Object.entries(reg.likes).sort((a, b) => b[1] - a[1])[0];
  return {
    ...(await baseTalkContext('nb_' + id)),
    act: sit.act, place: sit.place, zone: sit.zone, work: n.job, flavour: n.lines, others: sit.others.filter((o) => o.name !== n.name),
    favourite: fav ? RECIPES_BY_ID[fav[0]]?.name : undefined,
  };
}

export async function talkToNeighbor(id: string) {
  const n = NEIGHBOR_BY_ID[id];
  if (!n) return;
  const next: { run: (() => Promise<void>) | null } = { run: null };
  await runScene(`nb_${id}_${game.save.time.day}`, async () => {
    const ctx = await neighborContext(id);
    const reg = clients().regulars[id];
    const fav = reg && Object.entries(reg.likes).sort((a, b) => b[1] - a[1])[0];
    const hello = fav ? `¡Hola! Qué rico estaba el ${RECIPES_BY_ID[fav[0]]?.name ?? 'plato'} del otro día.` : n.lines[(game.save.time.day + id.length) % n.lines.length];
    await say(n.name, hello);
    // the first chat makes you acquaintances
    const known = game.rel(id);
    if (known.points < BALANCE.talkPoints) game.addFriendship(id, BALANCE.talkPoints - known.points);
    known.lastTalkDay = game.save.time.day;
    for (;;) {
      const opts = ['Charlar…', 'Invitar a Midnight Maki', 'Regalar…', 'Más acciones…', 'Nada, hasta luego'];
      const pick = opts[await choose(opts)];
      if (pick === 'Charlar…') {
        await chatMenu(n.name, ctx, async () => { await say(n.name, n.lines[(game.save.time.day + id.length + Math.floor(Math.random() * 7)) % n.lines.length]); });
      } else if (pick === 'Invitar a Midnight Maki') {
        const r = inviteNeighbor(id);
        await say(n.name, r.line);
        if (r.answer === 'later') await say('player', '¡Te esperamos!');
        break;
      } else if (pick === 'Regalar…') {
        const gifts = ['Un mueble guardado', 'Volver'];
        if (gifts[await choose(gifts, 'player', 'Regalar…')] !== 'Un mueble guardado') continue;
        const furn = await pickFurnitureGift();
        if (!furn) { await say(n.name, 'No te preocupes, en otro momento.'); continue; }
        await say(n.name, giftFurniture(id, furn).line);
        break;
      } else if (pick === 'Más acciones…') {
        const more = ['Sacarnos una foto', 'Contarle un chiste', 'Volver'];
        const m = more[await choose(more, 'player', 'Más acciones…')];
        if (m === 'Contarle un chiste') {
          const l = topicLine('joke', ctx);
          await say('player', l.joke!);
          await say(n.name, l.t, 'happy');
        } else if (m === 'Sacarnos una foto') { next.run = async () => { await import('../ui/camera').then((x) => x.takePhoto()); }; break; }
      } else break;
    }
  });
  if (next.run) await next.run();
}
