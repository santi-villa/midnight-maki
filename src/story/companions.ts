import { game } from '../core/state';
import { CHAR_BY_ID } from '../data/characters';
import { ITEMS_BY_ID } from '../data/items';
import { runScene, say } from '../dialogue/dialogue';
import { recordCompany, companyVisits, sharedToday, SNACKS, type CompanyActivity } from '../systems/companionship';
import { runTask } from '../core/errors';
import { h, panel } from '../ui/dom';
import { skinIconEl } from '../ui/skin';
import { iconElement } from '../art/icons';
import type { WorldScene } from '../scenes/WorldScene';

const LINES: Record<string, Record<'pet' | 'share' | 'sit', string[]>> = {
  pip: {
    pet: ['¿Así se siente una nube? ¡Quedate un poquito!', 'Me despeinaste. Ahora tengo pelo de aventura.'],
    share: ['¡Merienda compartida! Es mi tamaño favorito de merienda.', 'Voy a comer despacito. Así dura más este ratito.'],
    sit: ['¿Te cuento mi plan? Primero nos quedamos acá. Después vemos.', 'Si encontramos un tesoro mañana, lo guardamos entre los dos.'],
  },
  spicy: {
    pet: ['¡El chef acepta esta pausa! Pero el pañuelo tiene que quedar derecho.', 'Creo que acabás de mejorar mi receta para un buen día.'],
    share: ['Un ingrediente, dos catadores. ¡Eso ya es una receta!', 'Mmm. Le pondría... nada. Hoy está bien así.'],
    sit: ['Se me ocurrió una receta nueva. La dejo reposar conmigo un ratito.', '¿Escuchás? Por una vez, la cocina está respirando despacio.'],
  },
  rigg: {
    pet: ['...Sí. Podés. No lo anotes como un evento extraordinario.', 'Qué raro. Por un momento no estaba pensando en ninguna lista.'],
    share: ['Gracias. Las meriendas también son mejores con compañía.', 'Reservé esta página del cuaderno para cosas buenas. Esto cuenta.'],
    sit: ['Podemos quedarnos en silencio. También es una forma de hablar.', 'Hay cosas que no necesitan resolverse hoy. Este rato, por ejemplo.'],
  },
};

export function openCompany(world: WorldScene, id: string) {
  if (!world.canKeepCompany(id)) return;
  let close = () => {};
  const action = (kind: CompanyActivity, label: string, icon: string) => h('button', { class: 'btn', onclick: () => {
    close(); void runTask('company:' + kind, () => world.keepCompany(id, kind));
  } }, skinIconEl(icon), ' ', label);
  const body = h('div', { class: 'col' }, h('p', { class: 'hint' }, 'Un ratito juntos, sin apuro.'),
    action('pet', 'Acariciar', 'pet'), action('play', 'Jugar', 'play'), action('share', 'Compartir merienda', 'maki'), action('sit', 'Sentarse juntos', 'heart'),
    h('button', { class: 'btn', onclick: () => { close(); void runTask('company:photo', () => import('../ui/camera').then(m => m.takePhoto())); } }, skinIconEl('camera'), ' Foto juntos'));
  close = panel({ title: `Compañía · ${CHAR_BY_ID[id].name}`, body }).close;
}

function pickSnack(): Promise<string | null> {
  return new Promise(resolve => {
    let chosen = false;
    const body = h('div', { class: 'col' }, h('p', { class: 'hint' }, 'Elegí una merienda de tu mochila. Se comparte una unidad.'));
    for (const id of SNACKS.filter(id => game.count(id) > 0)) body.append(h('button', { class: 'btn', onclick: () => { chosen = true; p.close(); resolve(id); } }, iconElement(ITEMS_BY_ID[id].icon), ` ${ITEMS_BY_ID[id].name} · ${game.count(id)}`));
    if (!SNACKS.some(id => game.count(id) > 0)) body.append(h('p', null, 'Hoy no tenés una merienda en la mochila. Igual pueden compartir un rato o jugar.'));
    const p = panel({ title: 'Compartir merienda', body, onClose: () => { if (!chosen) resolve(null); } });
  });
}

export async function companyScene(id: string, kind: CompanyActivity): Promise<boolean> {
  if (kind === 'play') {
    const before = game.save.stats.memoryGames ?? 0;
    await (await import('../minigames/casual')).memoryGame(id);
    return (game.save.stats.memoryGames ?? 0) > before && recordCompany(id, kind);
  }
  const repeatSnack = kind === 'share' && sharedToday(id);
  const snack = kind === 'share' && !repeatSnack ? await pickSnack() : null;
  if (kind === 'share' && !repeatSnack && !snack) return false;
  let completed = false;
  await runScene('company_' + id + '_' + kind, async () => {
    if (repeatSnack) await say(id, {
      pip: 'Todavía guardo un poquito... o un recuerdo de la merienda. ¡Quedate!',
      spicy: 'La merienda de hoy ya pasó la prueba del chef. ¿Me hacés compañía?',
      rigg: 'Ya compartimos la merienda. Ahora podemos compartir un ratito de calma.',
    }[id]!, 'happy');
    else {
      await say('narr', kind === 'pet' ? `Le hacés una caricia a ${CHAR_BY_ID[id].name}.` : kind === 'sit' ? `Te sentás junto a ${CHAR_BY_ID[id].name}. El pueblo puede esperar un momento.` : `Compartís ${ITEMS_BY_ID[snack!].name.toLowerCase()} con ${CHAR_BY_ID[id].name}.`);
      const lines = LINES[id][kind];
      await say(id, lines[companyVisits(id, kind) % lines.length], 'happy');
    }
    completed = true;
  });
  return completed && recordCompany(id, kind, snack ?? undefined);
}
