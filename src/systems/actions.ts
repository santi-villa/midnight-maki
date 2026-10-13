/** Routes world interactions (talk, doors, gathering, objects) to their systems. */
import { iconElement } from '../art/icons';
import { audio } from '../audio/audio';
import { bus } from '../core/events';
import { reportError } from '../core/errors';
import { game } from '../core/state';
import { ITEMS_BY_ID } from '../data/items';
import { world, type Target } from '../scenes/WorldScene';
import { toast } from '../ui/dom';
import { obtain } from './collect';
import { markGathered } from './gather';

type Handler = (arg: string, target: Target) => void | Promise<void>;
const handlers = new Map<string, Handler>();

/** register `prefix` (e.g. "shop") to receive actions like "shop:yuki" */
export function registerAction(prefix: string, fn: Handler) {
  handlers.set(prefix, fn);
}

let busy = false;

export function installActions() {
  world.onInteract = async (t) => {
    if (busy) return;
    busy = true;
    try {
      await route(t);
    } catch (err) {
      reportError('world:interaction', err);
    } finally {
      busy = false;
    }
  };
}

async function route(t: Target) {
  switch (t.kind) {
    case 'npc': {
      const { talkTo } = await import('../dialogue/talk');
      await talkTo(t.id);
      return;
    }
    case 'gather': {
      const id = t.spot.item;
      const first = obtain(id, 1, 'gather');
      markGathered(t.spot);
      world.removeGather(t.spot);
      audio.sfxPlay('pickup');
      const it = ITEMS_BY_ID[id];
      toast(`${first ? '¡Nuevo! ' : ''}${it?.name ?? id}`, iconElement(it.icon));
      game.stat('gathered');
      return;
    }
    case 'bug': {
      const { catchBug } = await import('../minigames/bugcatch');
      await catchBug(t.idx);
      return;
    }
    case 'door': {
      const d = t.def;
      if (d.lock && !game.has(d.lock.flag)) {
        // the story may want to react to a locked door
        bus.emit('toast', { text: d.lock.msg });
        const { onLockedDoor } = await import('../story/story');
        onLockedDoor(d.to);
        return;
      }
      audio.sfxPlay('door');
      await world.enterZone(d.to, d.tx, d.ty, d.dir);
      return;
    }
    case 'interact': {
      const [prefix, arg = ''] = t.def.action.split(':');
      const h = handlers.get(prefix);
      if (h) await h(arg, t);
      else console.warn('[actions] no handler for', t.def.action);
      return;
    }
  }
}
