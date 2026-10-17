/** Ending the day: fade, and a new morning only when the sleep actually crosses 06:00. */
import { audio } from '../audio/audio';
import { game } from '../core/state';
import { settings, updateSettings } from '../core/settings';
import { runScene, say } from '../dialogue/dialogue';
import { saveGame } from '../persistence/storage';
import { world } from '../scenes/WorldScene';
import { fade, h, panel, sleep } from '../ui/dom';
import { clock } from './time';
import { dayMinutes } from './daytime';
import { DEFAULT_SLEEP, energyAfterSleep, getEnergy, hhmm, MAX_SLEEP, MIN_SLEEP, setEnergy, wakePlan } from './fatigue';

let sleeping = false;
let lastNight: { hours: number; wake: string } | null = null;

/** Ask how long to sleep, with a slider that shows the real wake time. Null if she changes her mind. */
export async function pickSleepHours(): Promise<number | null> {
  const bed = dayMinutes(game.save.time.period, game.save.time.minutes);
  let result: number | null = null;
  await runScene('bed_hours', async () => { result = await sleepSlider(bed); });
  return result;
}

function sleepSlider(bed: number): Promise<number | null> {
  const saved = Math.max(MIN_SLEEP, Math.min(MAX_SLEEP, Math.round(settings.sleepHours ?? DEFAULT_SLEEP)));
  let hours = saved;
  let settled = false;
  let closePanel = () => {};
  const before = Math.round(getEnergy());
  const wake = h('div', { class: 'sleep-wake' }, '');
  const detail = h('p', { class: 'sleep-detail' }, '');
  const energy = h('p', { class: 'hint' }, '');
  const input = h('input', {
    type: 'range',
    class: 'sleep-range',
    min: String(MIN_SLEEP),
    max: String(MAX_SLEEP),
    step: '1',
    value: String(saved),
    'aria-label': 'Horas de sueño',
  }) as HTMLInputElement;
  const paint = () => {
    hours = Math.max(MIN_SLEEP, Math.min(MAX_SLEEP, Math.round(Number(input.value) || saved)));
    const plan = wakePlan(bed, hours);
    const after = Math.round(energyAfterSleep(before, plan.sleptHours));
    const when = hhmm(plan.wakeMinute);
    wake.textContent = when;
    detail.textContent = `${plan.sleptHours} ${plan.sleptHours === 1 ? 'hora' : 'horas'} · despertás a las ${when}`;
    energy.textContent = `Energía ${before} → ${after}`;
    input.setAttribute('aria-valuetext', `${plan.sleptHours} horas, despertás a las ${when}`);
  };
  input.addEventListener('input', paint);
  const ticks: HTMLElement[] = [];
  for (let n = MIN_SLEEP; n <= MAX_SLEEP; n++) ticks.push(h('span', null, String(n)));
  return new Promise((resolve) => {
    const finish = (value: number | null) => {
      if (settled) return;
      settled = true;
      if (value != null) updateSettings({ sleepHours: value });
      closePanel();
      resolve(value);
    };
    const opened = panel({
      title: 'A dormir',
      body: h('div', { class: 'sleep-pick' },
        h('p', { class: 'hint' }, 'Deslizá cuántas horas pasan. El reloj avanza esas horas, no salta a las 6.'),
        wake,
        detail,
        input,
        h('div', { class: 'sleep-scale', 'aria-hidden': 'true' }, ...ticks),
        energy,
      ),
      foot: [
        h('button', { type: 'button', class: 'btn', onclick: () => finish(null) }, 'Todavía no'),
        h('button', { type: 'button', class: 'btn primary', onclick: () => finish(hours) }, 'Dormir'),
      ],
      onClose: () => finish(null),
    });
    closePanel = opened.close;
    paint();
  });
}

export async function sleepNow(opts?: { hours?: number }) {
  if (sleeping) return;
  sleeping = true;
  try {
    const t0 = game.save.time;
    const plan = wakePlan(dayMinutes(t0.period, t0.minutes), opts?.hours ?? settings.sleepHours ?? DEFAULT_SLEEP);
    lastNight = { hours: plan.sleptHours, wake: hhmm(plan.wakeMinute) };
    const forced = game.has('slept_exhausted') || game.has('slept_closing');
    if (plan.advanceDay) {
      const { showDaySummary, snapshotDay } = await import('../ui/daySummary');
      await showDaySummary();
      await fade(true, 600);
      audio.play('home');
      clock.newDay();
      clock.place(plan.period, plan.minutes);
      setEnergy(energyAfterSleep(getEnergy(), plan.sleptHours));
      snapshotDay();
      await world.enterZone('home', 3, 5, 'down', false, true);
    } else {
      await fade(true, 600);
      audio.play('home');
      clock.place(plan.period, plan.minutes);
      setEnergy(energyAfterSleep(getEnergy(), plan.sleptHours));
      if (forced) await world.enterZone('home', 3, 5, 'down', false, true);
    }
    await sleep(300);
    await fade(false, 700);
    await saveGame('sleep');
    if (plan.advanceDay) await morningSpeech();
    else await earlySpeech();
  } finally {
    sleeping = false;
  }
}

async function morningSpeech() {
  const rain = game.flag('weather') === 'rain';
  const fest = game.flag('festival_today');
  await runScene('morning', async () => {
    await say('narr', `${clock.dateLabel()}. ${rain ? 'Se escucha la lluvia en el techo.' : 'Entra una luz tibia por la ventana.'}`);
    if (lastNight) await say('narr', `Dormiste ${lastNight.hours} horas y te despertaste a las ${lastNight.wake}. Energía: ${Math.round(getEnergy())}/100.`);
    await sleepReason(true);
    const wage = game.flag('wage_report');
    if (typeof wage === 'string') {
      game.setFlag('wage_report', false);
      const [paid, unpaid] = wage.split('|');
      if (Number(paid) > 0) await say('narr', `Pagaste ${paid} monedas en sueldos del personal.`);
      if (unpaid) await say('narr', `No alcanzó para pagarle a ${unpaid}: no trabaja hasta que le pagues.`);
    }
    if (game.has('starter_bundle')) { game.setFlag('starter_bundle', false); await say('rigg', 'Anoche vi la despensa vacía y dejé lo básico: arroz, alga y pepino. Después me lo devolvés con sushi.'); }
    if (game.save.restaurant.upgrades.includes('pantry')) await say('narr', 'Rigg dejó ingredientes básicos en la despensa: arroz y alga.');
    if (fest) await say('narr', 'Hoy hay un evento especial en el pueblo. Revisá el calendario del Diario.');
    if (game.flag('market_night')) await say('narr', 'Esta noche abre el Mercado Nocturno.');
  });
}

async function earlySpeech() {
  await runScene('wake', async () => {
    if (lastNight) await say('narr', `Dormiste ${lastNight.hours} horas. Abriste los ojos a las ${lastNight.wake}. Energía: ${Math.round(getEnergy())}/100.`);
    await sleepReason(false);
  });
}

async function sleepReason(dawn: boolean) {
  if (game.has('slept_exhausted')) {
    const dropped = Number(game.flag('slept_dropped')) || 0;
    await say('narr', dropped > 0
      ? `Te venció el sueño lejos de la cama. ${dawn ? 'Amaneciste' : 'Estás'} en tu cuarto, y se te cayeron ${dropped} monedas.`
      : `Te venció el sueño lejos de la cama. ${dawn ? 'Amaneciste' : 'Estás'} en tu cuarto.`);
    game.setFlag('slept_exhausted', false);
    game.setFlag('slept_dropped', false);
  } else if (game.has('slept_closing')) {
    await say('narr', 'El restaurante cerró con la misión a medias. Podés seguirla cuando abras.');
    game.setFlag('slept_closing', false);
  }
}
