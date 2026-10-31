/** The kitchen pantry: what the restaurant has in stock, with room left, and where packs and boxes get stored. */
import { iconElement } from '../art/icons';
import { audio } from '../audio/audio';
import { bus } from '../core/events';
import { game } from '../core/state';
import { ITEMS_BY_ID, PACKS } from '../data/items';
import { SUPPLY_GROUPS, pantryCapacity, pantryFree, pantryTotal, storeLoose, storePacks, whereToGet } from '../restaurant/supplies';
import { h, panel, toast } from './dom';
import type { ActionAnchor } from './actionPanel';

export function openPantry(anchor?: ActionAnchor) {
  const body = h('div', { class: 'col' });
  const render = () => {
    body.innerHTML = '';
    const cap = pantryCapacity(), total = pantryTotal();
    const packs = PACKS.filter((p) => game.count(p.id) > 0);
    const loose = SUPPLY_GROUPS.flatMap((g) => g.items).filter((id) => game.count(id) > 0);
    body.append(
      h('div', { class: 'card col', style: { gap: '6px' } },
        h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', null, 'Despensa de la cocina'), h('span', { class: 'hint' }, `${total} / ${cap} unidades`)),
        h('div', { class: 'bar' }, h('i', { style: { width: `${Math.min(100, (total / cap) * 100)}%` } })),
        h('div', { class: 'hint' }, game.save.restaurant.upgrades.includes('pantry') ? 'Despensa ampliada.' : 'La mejora “Despensa ampliada” agranda el lugar.'),
        h('div', { class: 'row', style: { flexWrap: 'wrap', gap: '6px' } },
          h('button', { class: 'btn small primary', disabled: !packs.length, onclick: () => {
            const r = storePacks();
            if (r.stored) { audio.sfxPlay('pickup'); toast(`Guardaste ${r.stored} unidades.${r.left ? ' No entró todo: falta lugar.' : ''}`); }
            else toast(r.left ? 'No hay lugar para otro paquete.' : 'No traés paquetes ni cajas.');
            render();
          } }, packs.length ? `Guardar paquetes y cajas (${packs.reduce((n, p) => n + game.count(p.id), 0)})` : 'Sin paquetes para guardar'),
          h('button', { class: 'btn small', disabled: !loose.length, onclick: () => {
            const n = storeLoose();
            toast(n ? `Guardaste ${n} ingredientes de la mochila.` : 'No hay lugar.');
            if (n) audio.sfxPlay('pickup');
            render();
          } }, loose.length ? 'Guardar ingredientes sueltos' : 'Mochila sin ingredientes sueltos'))),
    );
    for (const g of SUPPLY_GROUPS) {
      const grid = h('div', { class: 'grid' });
      for (const id of g.items) {
        const it = ITEMS_BY_ID[id];
        if (!it) continue;
        const stocked = game.pantryCount(id), carried = game.count(id);
        grid.append(h('div', { class: 'slot' + (stocked ? '' : ' empty'), title: stocked ? it.name : `${it.name}: ${whereToGet(id)}` },
          iconElement(it.icon), h('span', null, it.name), h('span', { class: 'qty' }, stocked), carried ? h('span', { class: 'hint' }, `+${carried} en mochila`) : null));
      }
      body.append(h('b', null, g.name), grid);
    }
    body.append(h('p', { class: 'hint' }, `Hay lugar para ${pantryFree()} unidades más. Al cocinar se usa primero la despensa y después lo que llevás en la mochila.`));
  };
  render();
  const off = bus.on('inventory:changed', render);
  panel({ title: 'Despensa', wide: !anchor, body, anchor, onClose: () => off() });
}
