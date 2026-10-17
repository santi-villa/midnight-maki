/**
 * A new day only starts when both players go to bed. The host's night is the real one (the host owns the restaurant and its clock):
 * - the host goes to bed and the guest is not ready -> the host waits ("Esperando a Ana para dormir") and the guest is asked
 * - the guest says "quiero dormir" -> the host is asked; the night starts when the host goes to bed too
 * - when the night starts the guest sleeps through it with a fade, and wakes up when the host's morning arrives
 * A short nap that does not reach the morning needs nobody. If the host is forced to bed (exhausted), the guest simply follows.
 */
import { audio } from '../audio/audio';
import { bus } from '../core/events';
import { mirror } from '../restaurant/mirror';
import { energyAfterSleep, getEnergy, setEnergy } from '../systems/fatigue';
import { fade, sleep } from '../ui/dom';
import { coop } from '.';
import { closeSign, sign, type SignButton } from './notice';

let mine = false;
let theirs = false;
let waiting: ((ok: boolean) => void) | null = null;
let slept = false;

const peerName = () => coop.state().peer?.name ?? 'Tu amigo';
const together = () => coop.state().phase === 'connected';
const tell = (m: { want?: boolean; go?: { hours: number; wake: string } }) => coop.send({ t: 'sleep', ...m });

/** Only a host with a friend in the restaurant has to wait for anybody. */
export const sleepGateNeeded = () => coop.state().role === 'host' && coop.state().phase === 'connected';

/** What the "Jugar juntos" panel needs to show. */
export const sleepWish = () => ({ mine, theirs });

function showWait(text: string, cancel: () => void) { return sign(text, { icon: '🌙', key: 'coop-sleep', buttons: [{ label: 'Cancelar', run: cancel }] }); }

/**
 * Called by `sleepNow` before a night that reaches the morning. Resolves true when the host may go to sleep now,
 * false when the host gave up waiting.
 */
export async function coopSleepGate(hours: number, wake: string, forced: boolean): Promise<boolean> {
  const st = coop.state();
  if (st.role !== 'host' || st.phase !== 'connected') return true;
  if (!forced && !theirs) {
    mine = true; tell({ want: true });
    const wait = showWait(`Esperando a ${peerName()} para dormir… El día pasa cuando duermen los dos.`, () => waiting?.(false));
    const ok = await new Promise<boolean>((resolve) => { waiting = resolve; });
    waiting = null; wait.close();
    if (!ok) { mine = false; tell({ want: false }); return false; }
  }
  mine = false; theirs = false;
  closeSign('coop-sleep');
  if (together()) tell({ go: { hours, wake } });
  return true;
}

/** The guest says "I want to sleep" (or takes it back). */
export function guestWantsSleep(on: boolean) {
  if (coop.state().role !== 'guest' || !together()) return;
  mine = on; tell({ want: on });
  if (on) showWait(`Esperando a que ${peerName()} se vaya a dormir…`, () => guestWantsSleep(false));
  else closeSign('coop-sleep');
}

/** The host asks to start going to bed now (from the panel): the same flow as the bed. */
export async function hostSleepNow() {
  const { pickSleepHours, sleepNow } = await import('../systems/sleep');
  const hours = await pickSleepHours();
  if (hours) await sleepNow({ hours });
}

function theyWant(on: boolean) {
  theirs = on;
  if (!on) { closeSign('coop-ask'); return; }
  if (waiting) { waiting(true); return; }
  const role = coop.state().role;
  const buttons: SignButton[] = role === 'guest'
    ? [{ label: 'Dormir', primary: true, run: () => guestWantsSleep(true) }, { label: 'Todavía no', run: () => undefined }]
    : [{ label: 'Ir a dormir', primary: true, run: () => void hostSleepNow() }, { label: 'Todavía no', run: () => undefined }];
  sign(`${peerName()} quiere dormir. ${role === 'guest' ? '¿Dormís también?' : 'Cuando duermas, amanece.'}`, { icon: '🌙', key: 'coop-ask', buttons });
  bus.emit('coop:changed', {});
}

/** The host started the night: the guest goes to bed too, and wakes when the host's morning arrives. */
async function followNight(hours: number, wake: string) {
  if (slept || coop.state().role !== 'guest') return;
  slept = true; mine = false; theirs = false;
  try {
    closeSign('coop-sleep'); closeSign('coop-ask');
    const day0 = mirror.snap.time.day;
    await fade(true, 600);
    audio.play('home');
    // up to ~25 s for the host's morning to come (their day summary comes first)
    for (let i = 0; i < 50 && mirror.on && mirror.snap.time.day <= day0; i++) await sleep(500);
    setEnergy(energyAfterSleep(getEnergy(), hours));
    await sleep(300);
    await fade(false, 700);
    sign(`Amaneció. Dormiste ${hours} ${hours === 1 ? 'hora' : 'horas'} y te despertaste a las ${wake}.`, { icon: '☀️', seconds: 6, key: 'coop-sleep' });
  } finally { slept = false; }
}

coop.on('sleep', (m) => {
  const x = m as { want?: boolean; go?: { hours: number; wake: string } };
  if (x.go) { void followNight(x.go.hours, x.go.wake); return; }
  if (typeof x.want === 'boolean') theyWant(x.want);
});

// when the other side is gone nobody is waited for
bus.on('coop:changed', () => {
  if (together()) return;
  const wasWaiting = waiting;
  mine = false; theirs = false;
  wasWaiting?.(true);
  closeSign('coop-sleep'); closeSign('coop-ask');
});
