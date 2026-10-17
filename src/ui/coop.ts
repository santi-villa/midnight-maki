/** "Jugar juntos": open your restaurant to a friend with a code, or join theirs. Two people at most. */
import { bus } from '../core/events';
import { h, panel, toast } from './dom';

let open: { close: () => void } | null = null;

export async function openCoop() {
  if (open) return;
  const { coop } = await import('../coop');
  const body = h('div', { class: 'col account' });
  const off = bus.on('coop:changed', () => render());
  const p = panel({ title: 'Jugar juntos', body, onClose: () => { open = null; off(); } });
  open = p;
  const fail = (e: unknown) => toast(e instanceof Error ? e.message : 'No se pudo. Probá de nuevo.');

  function render() {
    const st = coop.state();
    body.replaceChildren();
    if (st.phase === 'idle' || st.phase === 'closed') {
      const input = h('input', { type: 'text', placeholder: 'Código de la sala', maxLength: '9', autocapitalize: 'characters', 'aria-label': 'Código de la sala', style: { textTransform: 'uppercase' } }) as HTMLInputElement;
      const join = () => { void coop.join(input.value).catch(fail); };
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') join(); });
      body.append(...[
        st.note ? h('p', { class: 'account-error', role: 'alert' }, st.note) : null,
        h('p', null, h('b', null, 'Cociná y serví con un amigo'), h('br'), 'Uno abre su restaurante y el otro entra con un código. Máximo 2 personas.'),
        h('button', { class: 'btn primary big', onclick: () => { void coop.host().catch(fail); } }, 'Abrir mi restaurante a un amigo'),
        h('div', { class: 'hint', style: { textAlign: 'center' } }, 'o entrá al de un amigo'),
        input,
        h('button', { class: 'btn', onclick: join }, 'Unirme con este código'),
        h('p', { class: 'hint' }, 'En el restaurante de un amigo vos cocinás y servís, y te quedás con las propinas que recojas. Tu partida no se toca.'),
      ].filter(Boolean) as Node[]);
    } else if (st.phase === 'opening') {
      body.append(h('p', null, 'Abriendo la sala…'));
    } else if (st.phase === 'waiting') {
      body.append(
        h('p', null, h('b', null, 'Tu sala está abierta')),
        h('div', { class: 'friend-code', 'aria-label': `Código ${st.code?.split('').join(' ')}` }, st.code ?? ''),
        h('p', { class: 'hint' }, 'Pasale este código a tu amigo. Esperando que entre…'),
        h('button', { class: 'btn small', onclick: async () => { try { await navigator.clipboard.writeText(st.code ?? ''); toast('Código copiado.'); } catch { toast(`Tu código: ${st.code}`); } } }, 'Copiar código'),
        h('button', { class: 'btn', onclick: () => void coop.leave() }, 'Cerrar la sala'));
    } else {
      body.append(
        h('p', null, h('b', null, st.role === 'host' ? `${st.peer?.name ?? 'Tu amigo'} está en tu restaurante` : `Estás en el restaurante de ${st.peer?.name ?? 'tu amigo'}`)),
        h('p', { class: 'hint' }, st.role === 'host' ? 'Atiendan juntos: uno cocina y el otro sirve.' : 'Cocinás y servís. Te quedás con las propinas que recojas.'),
        h('button', { class: 'btn danger', onclick: () => { void coop.leave(); p.close(); } }, st.role === 'host' ? 'Cerrar la sala' : 'Salir del restaurante'));
    }
  }
  render();
}
