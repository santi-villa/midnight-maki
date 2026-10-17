/** "Tu cuenta": sign in with Google or e-mail, see how the cloud save is doing, and decide what happens when two versions meet. */
import { cloud, setCloudUi, type ConflictChoice, type ConflictInfo, type SyncSummary } from '../cloud/cloud';
import { ago } from '../cloud/decide';
import { bus } from '../core/events';
import type { SaveData } from '../core/types';
import { markResumeOnce } from '../persistence/storage';
import { confirmBox, h, panel, toast } from './dom';

let open: { close: () => void; render: () => void } | null = null;
let mode: 'in' | 'up' = 'in';

const when = (t: number) => (t ? new Date(t).toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
const nice = (s: SaveData) => `${s.player.restaurantName || s.player.name} · día ${s.time.day} · ${s.coins.toLocaleString('es-AR')} monedas`;

function reloadWith(text: string) {
  void confirmBox(text, 'Reiniciar ahora', 'Después').then((yes) => { if (yes) { markResumeOnce(); location.reload(); } });
}

function resolveConflict(c: ConflictInfo): Promise<ConflictChoice> {
  return new Promise((resolve) => {
    let done = false;
    const pick = (v: ConflictChoice) => { if (done) return; done = true; p.close(); resolve(v); };
    const side = (title: string, s: SaveData, choice: ConflictChoice, label: string) => h('div', { class: 'card col' },
      h('b', null, title), h('div', null, nice(s)), h('div', { class: 'hint' }, `Guardada: ${when(s.updatedAt)}`),
      h('button', { class: 'btn primary', onclick: () => pick(choice) }, label));
    const p = panel({
      title: `Partida ${c.slot + 1}: dos versiones`,
      closable: false,
      body: [h('p', null, 'Esta partida cambió en este dispositivo y en la nube. Elegí cuál conservar: la otra se reemplaza.'),
        side('En este dispositivo', c.local, 'local', 'Quedarme con esta'),
        side('En la nube', c.remote, 'remote', 'Traer la de la nube')],
      foot: [h('button', { class: 'btn', onclick: () => pick('skip') }, 'Decidir después')],
    });
  });
}

function summarize(s: SyncSummary, auto: boolean) {
  if (s.reload) { reloadWith('Se trajo una partida más nueva de tu cuenta. Reiniciá para usarla.'); return; }
  if (auto && !s.pushed && !s.pulled) return;
  const parts = [s.pushed ? `${s.pushed} subida${s.pushed > 1 ? 's' : ''}` : '', s.pulled ? `${s.pulled} descargada${s.pulled > 1 ? 's' : ''}` : '', s.skipped ? `${s.skipped} pendiente${s.skipped > 1 ? 's' : ''}` : ''].filter(Boolean);
  toast(parts.length ? `Nube: ${parts.join(', ')}.` : 'Tu partida ya está al día en la nube.');
}

export function initAccountUi() {
  setCloudUi({ resolve: resolveConflict, synced: summarize });
  bus.on('cloud:changed', () => open?.render());
  void cloud.start();
}

export function cloudAvailable(): boolean { return cloud.status().configured; }

export function openAccount() {
  if (open) return;
  const body = h('div', { class: 'col account' });
  const p = panel({ title: 'Tu cuenta', body, onClose: () => { open = null; } });
  const guard = async (fn: () => Promise<unknown>) => { try { await fn(); } catch { /* the message is already in the status */ } };

  const render = () => {
    const st = cloud.status();
    body.replaceChildren();
    if (!st.configured) {
      body.append(h('p', null, st.ready ? 'La nube todavía no está activada en esta versión del juego.' : 'Un momento…'),
        h('p', { class: 'hint' }, 'Tu partida se guarda en este dispositivo. Podés copiarla desde Ajustes → Copia de seguridad.'));
      return;
    }
    if (st.error) body.append(h('p', { class: 'account-error', role: 'alert' }, st.error));
    if (!st.user) {
      const email = h('input', { type: 'email', autocomplete: 'email', placeholder: 'Tu correo', 'aria-label': 'Correo' }) as HTMLInputElement;
      const pass = h('input', { type: 'password', autocomplete: mode === 'in' ? 'current-password' : 'new-password', placeholder: 'Contraseña', 'aria-label': 'Contraseña' }) as HTMLInputElement;
      const name = h('input', { type: 'text', autocomplete: 'nickname', placeholder: 'Tu nombre (opcional)', 'aria-label': 'Nombre' }) as HTMLInputElement;
      const go = () => guard(() => mode === 'in' ? cloud.signInEmail(email.value, pass.value) : cloud.signUpEmail(email.value, pass.value, name.value));
      body.append(...[
        h('p', null, h('b', null, 'Guardá tu partida en la nube'), h('br'), 'Entrá con tu cuenta y seguí jugando en cualquier dispositivo.'),
        h('button', { class: 'btn primary big', onclick: () => void guard(() => cloud.signInGoogle()) }, 'Continuar con Google'),
        h('div', { class: 'hint', style: { textAlign: 'center' } }, 'o con tu correo'),
        mode === 'up' ? name : null, email, pass,
        h('div', { class: 'row' },
          h('button', { class: 'btn primary', onclick: () => void go() }, mode === 'in' ? 'Ingresar' : 'Crear cuenta'),
          h('button', { class: 'btn', onclick: () => { mode = mode === 'in' ? 'up' : 'in'; render(); } }, mode === 'in' ? 'No tengo cuenta' : 'Ya tengo cuenta')),
        mode === 'in' ? h('button', { class: 'btn small', onclick: () => void guard(async () => { if (!email.value.trim()) { toast('Escribí tu correo arriba y tocá de nuevo.'); return; } await cloud.resetPassword(email.value); toast('Te mandamos un correo para cambiar la contraseña.'); }) }, 'Olvidé mi contraseña') : null,
        h('p', { class: 'hint' }, 'Sin cuenta también se puede jugar: la partida queda en este dispositivo.')].filter(Boolean) as Node[]);
      return;
    }
    const u = st.user;
    body.append(
      h('div', { class: 'card col' }, h('b', null, u.name), h('div', { class: 'hint' }, u.email || (u.via === 'google' ? 'Cuenta de Google' : '')),
        h('div', null, st.syncing ? 'Sincronizando…' : st.lastSync ? `Sincronizada ${ago(Date.now(), st.lastSync)}` : 'Todavía sin sincronizar')),
      h('button', { class: 'btn primary big', onclick: () => { p.close(); void import('./friends').then((m) => m.openFriends()); } }, 'Amigos online'),
      h('button', { class: 'btn', disabled: st.syncing, onclick: () => void guard(async () => summarize(await cloud.sync(resolveConflict), false)) }, 'Sincronizar ahora'),
      h('button', { class: 'btn', onclick: () => void guard(async () => { await cloud.signOut(); toast('Saliste de tu cuenta. Tu partida sigue en este dispositivo.'); }) }, 'Cerrar sesión'),
      h('button', { class: 'btn danger', onclick: () => void guard(async () => {
        if (!(await confirmBox('Se borra tu cuenta y las partidas guardadas en la nube. Las partidas de este dispositivo no se tocan. ¿Seguro?', 'Borrar cuenta', 'Cancelar'))) return;
        await cloud.deleteAccount(); toast('Cuenta borrada.');
      }) }, 'Borrar mi cuenta y datos de la nube'),
      h('p', { class: 'hint' }, 'La partida se sube sola unos segundos después de cada guardado. Si dos dispositivos cambian la misma partida, el juego te pregunta cuál conservar.'));
  };
  open = { close: p.close, render };
  render();
}
