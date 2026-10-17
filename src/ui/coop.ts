/** "Jugar juntos": open your restaurant to a friend with a code, or join theirs. Two people at most. */
import { bus } from '../core/events';
import { h, panel, toast } from './dom';

let open: { close: () => void } | null = null;

export async function openCoop() {
  if (open) return;
  const { coop, coopOpenPref, joinFriend, leaveCoop, openMyRoom, setCoopOpenPref } = await import('../coop');
  const body = h('div', { class: 'col account' });
  const off = bus.on('coop:changed', () => render());
  const p = panel({ title: 'Jugar juntos', body, onClose: () => { open = null; off(); } });
  open = p;
  const fail = (e: unknown) => toast(e instanceof Error ? e.message : 'No se pudo. Probá de nuevo.');

  const copy = (code: string) => async () => { try { await navigator.clipboard.writeText(code); toast('Código copiado.'); } catch { toast(`Tu código: ${code}`); } };

  function joinBox() {
    const input = h('input', { type: 'text', placeholder: 'Código de tu amigo', maxLength: '9', autocapitalize: 'characters', 'aria-label': 'Código de tu amigo', style: { textTransform: 'uppercase' } }) as HTMLInputElement;
    const join = () => { void joinFriend(input.value).catch(fail); };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') join(); });
    return [
      h('div', { class: 'hint', style: { textAlign: 'center' } }, 'o entrá al restaurante de un amigo con su código'),
      input,
      h('button', { class: 'btn', onclick: join }, 'Unirme'),
      h('p', { class: 'hint' }, 'También podés tocar "Unirme" en la lista de Amigos online cuando diga "Abierto". En el restaurante de un amigo cocinás y servís, y te quedás con las propinas que recojas. Tu partida no se toca.'),
    ];
  }

  function render() {
    const st = coop.state();
    body.replaceChildren();
    if (st.phase === 'idle' || st.phase === 'closed') {
      const on = coopOpenPref();
      body.append(...[
        st.note ? h('p', { class: 'account-error', role: 'alert' }, st.note) : null,
        h('p', null, h('b', null, 'Cociná y serví con un amigo'), h('br'), 'Tu restaurante queda abierto para tus amigos mientras jugás: entran con tu código de amigo. Máximo 2 personas.'),
        on ? h('p', { class: 'hint' }, 'Se abre solo cuando estás con tu cuenta. Si no abrió, tocá el botón.') : h('p', { class: 'hint' }, 'Lo tenés apagado: nadie puede entrar.'),
        h('button', { class: 'btn primary big', onclick: () => { if (!on) setCoopOpenPref(true); void openMyRoom().catch(fail); } }, 'Abrir mi restaurante a amigos'),
        ...joinBox(),
      ].filter(Boolean) as Node[]);
    } else if (st.phase === 'opening') {
      body.append(h('p', null, 'Abriendo…'));
    } else if (st.phase === 'waiting') {
      body.append(...[
        h('p', null, h('b', null, 'Tu restaurante está abierto a amigos')),
        st.note ? h('p', { class: 'hint' }, st.note) : null,
        h('div', { class: 'friend-code', 'aria-label': `Código ${st.code?.split('').join(' ')}` }, st.code ?? ''),
        h('p', { class: 'hint' }, 'Tus amigos entran con este código (o desde Amigos online, cuando te ven "Abierto"). Se queda abierto mientras estés jugando.'),
        h('button', { class: 'btn small', onclick: copy(st.code ?? '') }, 'Copiar código'),
        h('button', { class: 'btn', onclick: () => { setCoopOpenPref(false); } }, 'Cerrar mi restaurante a amigos'),
        ...joinBox(),
      ].filter(Boolean) as Node[]);
    } else {
      body.append(
        h('p', null, h('b', null, st.role === 'host' ? `${st.peer?.name ?? 'Tu amigo'} está en tu restaurante` : `Estás en el restaurante de ${st.peer?.name ?? 'tu amigo'}`)),
        h('p', { class: 'hint' }, st.role === 'host' ? 'Atiendan juntos: uno cocina y el otro sirve.' : 'Cocinás y servís. Te quedás con las propinas que recojas.'),
        h('button', { class: 'btn danger', onclick: () => { void leaveCoop(); p.close(); } }, st.role === 'host' ? 'Cerrar la sala' : 'Salir del restaurante'));
    }
  }
  render();
}
