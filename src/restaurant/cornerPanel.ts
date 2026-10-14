import { game } from '../core/state';
import { runTask } from '../core/errors';
import { h, panel, toast } from '../ui/dom';
import { registerAction } from '../systems/actions';
import { CORNERS, hasCorner, setCornerAccent } from './corners';

export function openCorner(id: string) {
  const c = CORNERS.find(c => c.id === id);
  if (!c || !hasCorner(id)) return;
  const improved = game.save.restaurant.upgrades.includes(c.second);
  const body = h('div', { class: 'col' }, h('p', null, {
    pip: 'Un lugar para jugar y guardar tesoros. Pip viene durante su descanso de la tarde.',
    spicy: 'Una mesa para descansar de la cocina y probar ideas. Spicy viene durante su pausa de la tarde.',
    rigg: 'Libros, un escritorio y un lugar tranquilo. Rigg lee acá durante su descanso de la tarde.',
  }[id]!), h('p', { class: 'hint' }, 'Elegí un detalle. Se cambia solo la decoración nueva del rincón; tus muebles se conservan.'));
  for (const accent of ['rose', 'indigo'] as const) body.append(h('button', { class: 'btn', onclick: () => {
    if (setCornerAccent(id, accent)) toast('El rincón tiene un nuevo detalle.');
  } }, id === 'spicy' ? accent === 'rose' ? 'Hierbas aromáticas' : 'Bonsái' : accent === 'rose' ? 'Zabuton rosa' : 'Zabuton índigo'));
  const together = (kind: import('../systems/companionship').CompanyActivity, text: string) => h('button', { class: 'btn', onclick: () => {
    p.close(); void runTask('corner:company', async () => {
      const { world } = await import('../scenes/WorldScene');
      if (!world.canKeepCompany(id)) { toast('Acercate cuando esté descansando para compartir este rato.'); return; }
      await world.keepCompany(id, kind);
    });
  } }, text);
  body.append(together('sit', 'Sentarse juntos'));
  if (improved) {
    body.append(together(id === 'spicy' ? 'share' : 'play', id === 'spicy' ? 'Compartir merienda' : 'Jugar juntos'));
    body.append(h('button', { class: 'btn', onclick: () => { p.close(); void runTask('corner:collection', async () => {
      const m = await import('../ui/menus');
      if (id === 'spicy') m.openJournal(4); else m.openPhotoAlbum();
    }); } }, id === 'spicy' ? 'Consultar recetario' : 'Ver álbum de fotos'));
    if (id === 'rigg') body.append(h('button', { class: 'btn', onclick: () => { p.close(); void runTask('corner:memories', () => import('../ui/townMemories').then(m => m.openTownMemories())); } }, 'Recuerdos del pueblo'));
    if (id === 'pip') body.append(h('button', { class: 'btn', onclick: () => {
      p.close(); void runTask('corner:photo', async () => {
        const { world } = await import('../scenes/WorldScene');
        if (!world.canKeepCompany(id)) { toast('Acercate a Pip para sacar una foto juntos.'); return; }
        await (await import('../ui/camera')).takePhoto();
      });
    } }, 'Foto juntos'));
  } else body.append(h('p', { class: 'hint' }, 'La segunda mejora suma recuerdos y accesos a actividades compartidas. Las opciones habituales de compañía siguen disponibles.'));
  const p = panel({ title: c.title, body });
}
registerAction('corner', openCorner);
