/** Ending the day: fade, new day hooks, morning summary. Always available from your bed. */
import { audio } from '../audio/audio';
import { game } from '../core/state';
import { runScene, say } from '../dialogue/dialogue';
import { saveGame } from '../persistence/storage';
import { world } from '../scenes/WorldScene';
import { fade, sleep } from '../ui/dom';
import { clock } from './time';

export async function sleepNow() {
  await fade(true, 600);
  audio.play('home');
  clock.newDay();
  // morning: wake up in your room
  await world.enterZone('home', 3, 5, 'down', false);
  await sleep(300);
  await fade(false, 700);
  await saveGame('sleep');
  const rain = game.flag('weather') === 'rain';
  const fest = game.flag('festival_today');
  await runScene('morning', async () => {
    await say('narr', `${clock.dateLabel()}. ${rain ? 'Se escucha la lluvia en el techo.' : 'Entra una luz tibia por la ventana.'}`);
    if (game.save.restaurant.upgrades.includes('pantry')) await say('narr', 'Rigg dejó ingredientes básicos en la despensa: arroz y alga.');
    if (fest) await say('narr', 'Hoy hay un evento especial en el pueblo. Revisá el calendario del Diario.');
    if (game.flag('market_night')) await say('narr', 'Esta noche abre el Mercado Nocturno.');
  });
}
