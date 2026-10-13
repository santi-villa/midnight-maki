import { runTask } from '../core/errors';
import { PROJECTS_BY_ID } from '../data/projects';
import { TOWN_MEMORIES, townMemoryReady, townMemorySeen, playTownMemory, restorationSecretReady } from '../story/restoration';
import { h, panel } from './dom';

export function openTownMemories() {
  const body = h('div', { class: 'col' }, h('p', { class: 'hint' }, 'Recuerdos opcionales de las restauraciones. Completá dos etapas de cada rincón y el capítulo 3. Podés volver a leerlos sin gastar recursos.'));
  let close = () => {};
  const play = (id: string) => {
    close();
    void runTask('restoration:memory', async () => { await playTownMemory(id); openTownMemories(); });
  };
  for (const memory of TOWN_MEMORIES) {
    const ready = townMemoryReady(memory), seen = townMemorySeen(memory.id);
    body.append(h('article', { class: 'card col' }, h('b', null, ready ? memory.title : 'Un recuerdo por descubrir'),
      h('p', { class: 'hint' }, PROJECTS_BY_ID[memory.project].name),
      h('p', { class: 'hint' }, ready ? seen ? '✓ Guardado en el álbum' : 'Hay una escena nueva para leer' : 'Completá dos etapas de este proyecto y terminá el capítulo 3.'),
      h('button', { class: 'btn small', disabled: !ready, onclick: () => play(memory.id) }, ready ? seen ? 'Recordar' : 'Descubrir recuerdo' : 'Todavía no disponible')));
  }
  body.append(h('button', { class: 'btn primary', disabled: !restorationSecretReady(), onclick: () => play('album') }, townMemorySeen('album') ? 'Recordar la página compartida' : 'Reunir los seis recuerdos'));
  close = panel({ title: 'Álbum del pueblo', body }).close;
}
