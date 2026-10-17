/** "Amigos online": your code, your friends' restaurants and the postcards you exchange. */
import { POSTCARDS, POSTCARD_BY_ID } from '../cloud/friendCode';
import { ago } from '../cloud/decide';
import { cloud } from '../cloud/cloud';
import { social, type Postcard, type Profile } from '../cloud/social';
import { previewCanvas } from './creator';
import { confirmBox, h, panel, toast } from './dom';
import { skinIconEl } from './skin';

export function openFriends() {
  if (!cloud.status().user) { void import('./account').then((m) => m.openAccount()); return; }
  const body = h('div', { class: 'col friends' });
  panel({ title: 'Amigos online', body, wide: true });
  const fail = (e: unknown) => toast(e instanceof Error ? e.message : 'No se pudo. Probá de nuevo.');

  const card = (p: Profile) => {
    const art = previewCanvas(p.appearance, ['down'], 3);
    art.className = 'friend-art';
    return h('div', { class: 'card friend' },
      art,
      h('div', { class: 'col grow' },
        h('b', null, p.restaurant), h('div', null, p.name),
        h('div', { class: 'hint' }, `Nivel ${p.level} · ${p.served.toLocaleString('es-AR')} servidos · ${p.recipes} recetas`)),
      h('div', { class: 'col' },
        h('button', { class: 'btn small primary', onclick: () => void pickCard(p) }, 'Mandar tarjeta'),
        h('button', { class: 'btn small', onclick: () => void remove(p) }, 'Quitar')));
  };

  const pickCard = async (p: Profile) => {
    const list = h('div', { class: 'col' }, ...POSTCARDS.map((c) => h('button', {
      class: 'btn with-icon', onclick: async () => { box.close(); try { await social.sendPostcard(p.uid, c.id); toast(`Tarjeta enviada a ${p.name}.`); } catch (e) { fail(e); } },
    }, skinIconEl(c.icon, 'skin-icon'), h('span', null, c.text))));
    const box = panel({ title: `Tarjeta para ${p.name}`, body: list });
  };

  const remove = async (p: Profile) => {
    if (!(await confirmBox(`¿Quitar a ${p.name} de tus amigos?`, 'Quitar', 'Cancelar'))) return;
    try { await social.removeFriend(p.uid); } catch (e) { fail(e); }
    void render();
  };

  const render = async () => {
    body.replaceChildren(h('p', { class: 'hint' }, 'Cargando…'));
    try {
      const [code, friends, inbox] = await Promise.all([social.myCode(), social.friends(), social.inbox()]);
      const input = h('input', { type: 'text', placeholder: 'Código de un amigo', maxLength: '9', autocapitalize: 'characters', 'aria-label': 'Código de un amigo' }) as HTMLInputElement;
      const add = async () => {
        try { const f = await social.addFriend(input.value); toast(`${f.name} ya es tu amigo.`); void render(); } catch (e) { fail(e); }
      };
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') void add(); });
      body.replaceChildren(...[
        h('div', { class: 'card col' },
          h('b', null, 'Tu código'),
          h('div', { class: 'friend-code', 'aria-label': `Tu código es ${code.split('').join(' ')}` }, code),
          h('div', { class: 'hint' }, 'Pasáselo a quien quieras. Quien lo escriba te agrega a su lista y ve la tarjeta de tu restaurante.'),
          h('button', { class: 'btn small', onclick: async () => { try { await navigator.clipboard.writeText(code); toast('Código copiado.'); } catch { toast(`Tu código: ${code}`); } } }, 'Copiar código')),
        h('button', { class: 'btn primary big', onclick: () => void import('./coop').then((m) => m.openCoop()) }, 'Jugar juntos en el restaurante'),
        h('div', { class: 'row' }, input, h('button', { class: 'btn primary', onclick: () => void add() }, 'Agregar amigo')),
        inbox.length ? h('h3', null, `Tarjetas recibidas (${inbox.length})`) : null,
        ...inbox.map((m: Postcard) => h('div', { class: 'card row' },
          skinIconEl(POSTCARD_BY_ID[m.card].icon, 'skin-icon'),
          h('div', { class: 'col grow' }, h('b', null, m.fromName), h('div', null, POSTCARD_BY_ID[m.card].text), h('div', { class: 'hint' }, ago(Date.now(), m.at))),
          h('button', { class: 'btn small', onclick: async () => { try { await social.clearPostcard(m.from); } catch (e) { fail(e); } void render(); } }, 'Guardar y cerrar'))),
        h('h3', null, friends.length ? `Tus amigos (${friends.length})` : 'Tus amigos'),
        friends.length ? null : h('p', { class: 'hint' }, 'Todavía no agregaste a nadie. Escribí el código de un amigo arriba.'),
        ...friends.map(card),
      ].filter(Boolean) as Node[]);
    } catch (e) {
      body.replaceChildren(h('p', { class: 'account-error', role: 'alert' }, e instanceof Error ? e.message : 'No se pudo cargar.'), h('button', { class: 'btn', onclick: () => void render() }, 'Reintentar'));
    }
  };
  void render();
}
