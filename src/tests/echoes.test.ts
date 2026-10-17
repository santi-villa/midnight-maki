import { beforeEach, describe, expect, it } from 'vitest';
import { game, newSave } from '../core/state';
import { pendingEcho, recordDecision } from '../story/echoes';

beforeEach(() => { game.load(newSave('Eco')); });

describe('story echoes', () => {
  it('bring a choice back after the waiting days, once, with the variant that was chosen', () => {
    game.setFlag('pip_heart'); game.save.time.day = 4;
    recordDecision('pip_heart', 'recordar');
    expect(pendingEcho('pip')).toBeNull();            // too soon
    game.save.time.day = 7;
    expect(pendingEcho('rigg')).toBeNull();           // another character
    expect(pendingEcho('pip')?.variant.items).toMatchObject({ rice: 3 });
    game.setFlag('echo_pip_heart');
    expect(pendingEcho('pip')).toBeNull();            // already played
  });

  it('ignores a choice nobody made, and counts old saves without a day as old enough', () => {
    game.setFlag('bento_confessed');
    expect(pendingEcho('bento')).toBeNull();
    game.save.story.decisions.bento = 'gratitud';
    expect(pendingEcho('bento')?.echo.id).toBe('bento');
  });
});
