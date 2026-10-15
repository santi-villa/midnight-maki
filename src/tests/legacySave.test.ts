import { describe, expect, it } from 'vitest';
import { game, newSave } from '../core/state';
import { validateSave } from '../persistence/validate';
import { clientsDemand, nextTownGuest } from '../restaurant/townVisits';
import { staffSave } from '../restaurant/staff';

describe('saves from before stages 2, 3 and 8', () => {
  it('load without pantry, staff or clients and the new systems create them on demand', () => {
    const old = JSON.parse(JSON.stringify(newSave('Vieja')));
    delete old.pantry; delete old.staff; delete old.clients; delete old.bestTimes;
    const ok = validateSave(old);
    expect(ok).toBeTruthy();
    game.load(old);
    expect(game.pantryCount('rice')).toBe(0);
    expect(staffSave().employees).toEqual([]);
    expect(clientsDemand()).toBeGreaterThan(0);
    expect(nextTownGuest(() => false, 0.99)).toBeNull();
    expect(JSON.parse(JSON.stringify(game.save)).clients).toBeTruthy();
  });
});
