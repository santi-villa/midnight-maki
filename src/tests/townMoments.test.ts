import { beforeEach, describe, expect, it } from 'vitest';
import { game, newSave } from '../core/state';
import { markSeen, pendingMoment } from '../systems/townMoments';

beforeEach(() => { game.load(newSave('Pueblo')); });

describe('town moments', () => {
  it('wait for the change they react to, and are said only once', () => {
    expect(pendingMoment('momo')).toBeNull();
    game.save.restaurant.upgrades.push('lights');
    const m = pendingMoment('momo');
    expect(m?.id).toBe('lights');
    expect(pendingMoment('bento')).toBeNull();
    markSeen(m!);
    expect(pendingMoment('momo')).toBeNull();
  });
});
