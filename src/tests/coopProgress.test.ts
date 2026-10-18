import { afterEach, expect, it } from 'vitest';
import { game, newSave } from '../core/state';
import { mirror } from '../restaurant/mirror';
import { check, defineQuests, isDone, startQuest } from '../quests/quests';

afterEach(() => mirror.stop());
it('does not grant personal quest progress from the host borrowed day or restaurant level', () => {
  game.load(newSave('Visitante'));
  defineQuests([{ id: 'coop_personal_day', kind: 'task', title: 'Descansar', desc: '', steps: [
    { text: 'Empezá el día dos', done: () => game.save.time.day >= 2 },
  ], reward: { coins: 10 } }]);
  startQuest('coop_personal_day');
  const coins = game.coins;
  mirror.start(); game.save.time.day = 5;
  check();
  expect(isDone('coop_personal_day')).toBe(false);
  expect(game.coins).toBe(coins);
  mirror.stop(); game.save.time.day = 1; check();
  expect(isDone('coop_personal_day')).toBe(false);
  game.save.time.day = 2; check();
  expect(isDone('coop_personal_day')).toBe(true);
  expect(game.coins).toBe(coins + 10);
});
