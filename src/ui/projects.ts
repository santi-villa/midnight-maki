/** Restoration board: begin participation before doing activities, then build explicitly. */
import { iconElement } from '../art/icons';
import { audio } from '../audio/audio';
import { runTask } from '../core/errors';
import { game } from '../core/state';
import { ITEMS_BY_ID } from '../data/items';
import { PROJECT_AMENITIES, PROJECTS_BY_ID } from '../data/projects';
import { buildNextPhase, phaseStatus, projectDone, startProjectPhase, visibleProjects, amenityOpen, amenitySuppliesAvailable, claimProjectSupplies } from '../restaurant/projects';
import { h, panel, toast } from './dom';
import { openTownMemories } from './townMemories';
import { TOWN_MEMORIES, townMemoryReady, townMemorySeen } from '../story/restoration';

export function projectsSection(onBuilt: () => Promise<boolean>): HTMLElement & { refresh: () => void } {
  const root = h('div', { class: 'col projects-section' });
  const render = () => {
    root.replaceChildren(h('h3', null, 'Proyectos del pueblo'), h('p', { class: 'hint' }, 'Colaborá, reuní materiales y construí a tu ritmo. Las etapas completadas suman encanto y abren servicios en el pueblo.'));
    root.append(h('button', { class: 'btn small', onclick: openTownMemories }, 'Álbum del pueblo · Recuerdos de las restauraciones'));
    for (const project of visibleProjects()) {
      const stages = phaseStatus(project.id), done = projectDone(project.id), next = stages.find((s) => s.state === 'next');
      const card = h('article', { class: 'card col project-card', 'data-project-id': project.id },
        h('div', { class: 'project-heading' }, h('b', null, project.name), h('span', { class: 'pill' }, `${done}/${project.phases.length}`)),
        h('p', { class: 'hint' }, project.intro));
      const completed = project.phases.slice(0, done).filter((p) => p.benefit);
      if (completed.length) card.append(h('div', { class: 'project-benefits' }, h('b', null, 'Ya disponible'), ...completed.map((p) => h('div', { class: 'hint' }, '✓ ' + p.benefit))));
      if (next) {
        card.append(h('b', null, `Próxima etapa: ${next.phase.name}`), h('p', { class: 'hint' }, next.phase.desc), ...(next.phase.benefit ? [h('div', { class: 'project-benefit' }, 'Al terminar: ' + next.phase.benefit)] : []));
        if (next.activity) {
          card.append(h('div', { class: 'project-activity' }, h('b', null, next.phase.activity!.text), h('p', { class: 'hint' }, next.phase.activity!.hint),
            h('div', { class: 'bar', role: 'progressbar', 'aria-label': 'Participación en la etapa', 'aria-valuemin': 0, 'aria-valuemax': next.activity.goal, 'aria-valuenow': next.activity.progress }, h('i', { style: { width: `${next.activity.progress / next.activity.goal * 100}%` } })),
            h('span', { class: 'hint' }, next.activity.started ? `${next.activity.progress}/${next.activity.goal} · Sin vencimiento` : 'Todavía no empezaste; iniciar no gasta materiales ni monedas'),
            !next.activity.started ? h('button', { class: 'btn small', disabled: (next.phase.level ?? 1) > game.save.restaurant.level, onclick: () => {
              if (startProjectPhase(project.id, next.index)) { audio.sfxPlay('tap'); render(); toast('Colaboración iniciada. Tus próximas actividades cuentan para esta etapa.'); }
            } }, 'Comenzar colaboración') : null));
        }
        card.append(h('div', { class: 'project-cost' }, `${next.phase.coins} monedas`, ...Object.entries(next.phase.items ?? {}).map(([id, n]) => h('span', null, iconElement(ITEMS_BY_ID[id].icon), `${n} × ${ITEMS_BY_ID[id].name}`))),
          ...(next.missing.length ? [h('p', { class: 'hint project-missing' }, 'Falta: ' + next.missing.join(' · '))] : []),
          h('button', { class: 'btn small primary', disabled: next.missing.length > 0, onclick: () => void runTask('project:build', async () => {
            if (!buildNextPhase(project.id, next.index)) { toast('La etapa todavía no está lista o ya fue construida.'); return; }
            audio.sfxPlay('success'); render();
            if (!await onBuilt()) toast('La mejora se guardó. Volvé a entrar a la zona para verla.');
            toast(next.phase.thanks);
            const memory = TOWN_MEMORIES.find((m) => m.project === project.id);
            if (memory && townMemoryReady(memory) && !townMemorySeen(memory.id)) toast('Hay un recuerdo nuevo en el Álbum del pueblo.');
          }) }, 'Construir etapa'));
      } else card.append(h('b', { class: 'project-finished' }, '¡Proyecto terminado!'));
      card.append(h('details', { class: 'project-stages' }, h('summary', null, 'Ver todas las etapas'), ...stages.map((s) => h('div', { class: 'hint' }, `${s.state === 'done' ? '✓' : s.state === 'next' ? '▸' : '·'} ${s.phase.name}${s.phase.level ? ` · Nivel ${s.phase.level}` : ''}`, s.phase.benefit ? h('div', null, s.phase.benefit) : null))));
      root.append(card);
    }
  };
  render(); return Object.assign(root, { refresh: render });
}

export function openProjectAmenity(id: string) {
  const amenity = PROJECT_AMENITIES.find((a) => a.id === id);
  if (!amenity || !amenityOpen(id)) { toast('Este rincón todavía está en restauración.'); return; }
  const body = h('div', { class: 'col' });
  let close = () => {};
  const render = () => {
    body.replaceChildren();
    if (amenity.items) {
      const available = amenitySuppliesAvailable(id);
      body.append(h('p', null, 'Provisión compartida del pueblo. Una vez por día del juego.'),
        h('div', { class: 'project-cost' }, ...Object.entries(amenity.items).map(([item, n]) => h('span', null, iconElement(ITEMS_BY_ID[item].icon), `${n} × ${ITEMS_BY_ID[item].name}`))),
        h('button', { class: 'btn primary', disabled: !available, onclick: () => {
          const items = claimProjectSupplies(id);
          if (items) { audio.sfxPlay('pickup'); toast('Recibiste: ' + Object.entries(items).map(([item, n]) => `${n} ${ITEMS_BY_ID[item].name}`).join(', ')); }
          render();
        } }, available ? 'Retirar provisión' : 'Ya retiraste la provisión de hoy'));
    }
    if (amenity.game && projectDone(amenity.project) >= (amenity.gamePhase ?? amenity.phase)) {
      body.append(h('p', { class: 'hint' }, 'Comparte las recompensas diarias del mismo minijuego en otros lugares.'), h('button', { class: 'btn', onclick: () => {
        close(); void runTask('project:game', async () => {
          const games = await import('../minigames/casual');
          if (amenity.game === 'sort') await games.sortPantry();
          else await games.memoryGame(amenity.opponent ?? 'pip');
        });
      } }, amenity.game === 'sort' ? 'Ordenar en el taller' : `Juego de memoria con ${amenity.opponent === 'rigg' ? 'Rigg' : 'Pip'}`));
    }
    body.append(h('p', { class: 'hint' }, 'Restaurado: ' + PROJECTS_BY_ID[amenity.project].name));
    const memory = TOWN_MEMORIES.find((m) => m.project === amenity.project);
    if (memory && townMemoryReady(memory)) body.append(h('button', { class: 'btn small', onclick: () => { close(); openTownMemories(); } }, 'Recuerdos de este rincón · Álbum del pueblo'));
  };
  render(); close = panel({ title: amenity.title, body }).close;
}
