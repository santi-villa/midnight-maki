/** Ending the day: fade, new day hooks, morning summary. Always available from your bed. */
import { audio } from '../audio/audio';
import { game } from '../core/state';
import { choose, runScene, say } from '../dialogue/dialogue';
import { saveGame } from '../persistence/storage';
import { world } from '../scenes/WorldScene';
import { fade, sleep } from '../ui/dom';
import { clock } from './time';
import { dayMinutes, displayedMinutesPerPeriodMinute } from './daytime';
import { DEFAULT_SLEEP, energyAfterSleep, getEnergy, hhmm, MAX_SLEEP, MIN_SLEEP, setEnergy, wakePlan } from './fatigue';
import { settings, updateSettings } from '../core/settings';

let sleeping = false;
let lastNight: { hours: number; wake: string } | null = null;

/** Ask how long to sleep, showing when she would wake. Returns null if she changes her mind. */
export async function pickSleepHours(): Promise<number | null> {
  const t = game.save.time, bed = dayMinutes(t.period, t.minutes);
  const options: number[] = [];
  for (let h = MIN_SLEEP + 1; h <= MAX_SLEEP; h++) options.push(h);
  const saved = settings.sleepHours ?? DEFAULT_SLEEP;
  const labels = options.map((h) => `${h} horas · despertás a las ${hhmm(wakePlan(bed, h).wakeMinute)}${h === saved ? ' (la de siempre)' : ''}`);
  labels.push('Todavía no');
  let pick = labels.length - 1;
  await runScene('bed_hours', async () => { pick = await choose(labels, 'player', `¿Cuántas horas dormís? Energía: ${Math.round(getEnergy())}/100`); });
  if (pick >= options.length) return null;
  updateSettings({ sleepHours: options[pick] });
  return options[pick];
}

export async function sleepNow(opts?: { hours?: number }) {
  if (sleeping) return;
  sleeping = true;
  try {
    const t0 = game.save.time;
    const plan = wakePlan(dayMinutes(t0.period, t0.minutes), opts?.hours ?? settings.sleepHours ?? DEFAULT_SLEEP);
    lastNight = { hours: Math.round(plan.sleptHours * 10) / 10, wake: hhmm(plan.wakeMinute) };
    const { showDaySummary, snapshotDay } = await import('../ui/daySummary');
    await showDaySummary();
    await fade(true, 600);
    audio.play('home');
    clock.newDay();
    game.save.time.minutes = plan.lateMinutes / displayedMinutesPerPeriodMinute(0);
    setEnergy(energyAfterSleep(getEnergy(), plan.sleptHours));
    snapshotDay();
    // morning: wake up in your room. A closed shop must not trap this warp.
    await world.enterZone('home', 3, 5, 'down', false, true);
    await sleep(300);
    await fade(false, 700);
    await saveGame('sleep');
    const rain = game.flag('weather') === 'rain';
    const fest = game.flag('festival_today');
    await runScene('morning', async () => {
      await say('narr', `${clock.dateLabel()}. ${rain ? 'Se escucha la lluvia en el techo.' : 'Entra una luz tibia por la ventana.'}`);
      if (lastNight) await say('narr', `Dormiste ${lastNight.hours} horas y te despertaste a las ${lastNight.wake}. Energía: ${Math.round(getEnergy())}/100.`);
      if (game.has('slept_exhausted')) {
        const dropped = Number(game.flag('slept_dropped')) || 0;
        await say('narr', dropped > 0
          ? `Te venció el sueño lejos de la cama. Amaneciste en tu cuarto, y se te cayeron ${dropped} monedas.`
          : 'Te venció el sueño lejos de la cama. Amaneciste en tu cuarto.');
        game.setFlag('slept_exhausted', false);
        game.setFlag('slept_dropped', false);
      } else if (game.has('slept_closing')) {
        await say('narr', 'Anoche el restaurante cerró con la misión a medias. Hoy podés seguirla.');
        game.setFlag('slept_closing', false);
      }
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
  } finally {
    sleeping = false;
  }
}
