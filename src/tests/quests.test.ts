import { beforeEach, describe, expect, it } from 'vitest';
import { game, newSave } from '../core/state';
import { CHARACTERS, CHAR_BY_ID } from '../data/characters';
import { validateSave } from '../persistence/validate';
import { buildZone, doorLeadingTo } from '../world/zoneRuntime';
import { currentQuestTarget, questDef, startQuest } from '../quests/quests';
import '../quests/side';

beforeEach(() => {
  game.load(newSave('Tester'));
});

describe('naming validation (no Mica variants)', () => {
  it('contains no characters with Mica, Mika, Micha, Micaela or similar in ID or name', () => {
    const forbidden = [/mic[ak]a/i, /micha/i];
    for (const c of CHARACTERS) {
      for (const pattern of forbidden) {
        expect(c.id).not.toMatch(pattern);
        expect(c.name).not.toMatch(pattern);
      }
    }
  });

  it('has Sumi properly registered and maintains legacy alias for mika', () => {
    expect(CHAR_BY_ID.sumi).toBeDefined();
    expect(CHAR_BY_ID.sumi.name).toBe('Sumi');
    expect(CHAR_BY_ID.mika).toBe(CHAR_BY_ID.sumi);
  });

  it('migrates legacy mika data in existing saves to sumi', () => {
    const raw = newSave('LegacyPlayer');
    // Simulate legacy save with old mika data
    raw.relationships['mika'] = {
      points: 75,
      lastTalkDay: 2,
      lastGiftDay: 0,
    };
    raw.quests.active['sq_mika_photos'] = { step: 1, progress: {} };
    raw.quests.done.push('sq_mika_photos');

    const migrated = validateSave(raw);

    // Should migrate relationships
    expect(migrated.relationships['sumi']).toBeDefined();
    expect(migrated.relationships['sumi']?.points).toBe(75);

    // Should migrate quests
    expect(migrated.quests.active['sq_sumi_photos']).toBeDefined();
    expect(migrated.quests.active['sq_sumi_photos']?.step).toBe(1);
    expect(migrated.quests.active['sq_mika_photos']).toBeUndefined();
    expect(migrated.quests.done).toContain('sq_sumi_photos');
    expect(migrated.quests.done).not.toContain('sq_mika_photos');
  });
});

describe('quest routing and door navigation', () => {
  it('correctly finds direct doors between adjacent zones', () => {
    const toRestaurant = doorLeadingTo('plaza', 'restaurant');
    expect(toRestaurant).toBeDefined();
    expect(toRestaurant?.to).toBe('restaurant');
    expect(toRestaurant?.x).toBe(5);
    expect(toRestaurant?.y).toBe(6);

    const toBeach = doorLeadingTo('plaza', 'beach');
    expect(toBeach).toBeDefined();
    expect(toBeach?.to).toBe('beach');

    const toHome = doorLeadingTo('restaurant', 'home');
    expect(toHome).toBeDefined();
    expect(toHome?.to).toBe('home');
  });

  it('routes multi-step paths through intermediate doors', () => {
    // From plaza to home goes through restaurant
    const plazaToHome = doorLeadingTo('plaza', 'home');
    expect(plazaToHome).toBeDefined();
    expect(plazaToHome?.to).toBe('restaurant');

    // From plaza to lighthouse goes through beach
    const plazaToLighthouse = doorLeadingTo('plaza', 'lighthouse');
    expect(plazaToLighthouse).toBeDefined();
    expect(plazaToLighthouse?.to).toBe('beach');

    // From beach to lighthouse is direct
    const beachToLighthouse = doorLeadingTo('beach', 'lighthouse');
    expect(beachToLighthouse).toBeDefined();
    expect(beachToLighthouse?.to).toBe('lighthouse');
  });

  it('maintains solids on doors marked walk: false', () => {
    // Storage door in restaurant is locked initially and walk: false
    const restaurantZone = buildZone('restaurant');
    // storage door is at (13, 2)
    expect(restaurantZone.grid.isSolid(13, 2)).toBe(true);

    // Lighthouse door in beach is at (3, 4) with walk: false
    const beachZone = buildZone('beach');
    expect(beachZone.grid.isSolid(3, 4)).toBe(true);
  });
});

describe('quest objective differentiation', () => {
  it('ensures side quests define explicit targets for their steps', () => {
    const sumiQuest = questDef('sq_sumi_photos');
    expect(sumiQuest).toBeDefined();
    expect(sumiQuest?.steps[0].target).toBeDefined();
    expect(sumiQuest?.steps[0].target?.kind).toBe('npc');
    if (sumiQuest?.steps[0].target?.kind === 'npc') {
      expect(sumiQuest.steps[0].target.npc).toBe('sumi');
    }
  });

  it('provides currentQuestTarget correctly when a quest is tracked', () => {
    // Start side quest
    const started = startQuest('sq_sumi_photos');
    expect(started).toBe(true);
    game.save.quests.tracked = 'sq_sumi_photos';

    const target = currentQuestTarget();
    expect(target).toBeDefined();
    expect(target?.kind).toBe('npc');
    if (target?.kind === 'npc') {
      expect(target.npc).toBe('sumi');
    }
  });

  it('resolves questTarget from guide correctly using structured target', async () => {
    const { questTarget } = await import('../world/guide');
    // Start side quest
    startQuest('sq_sumi_photos');
    game.save.quests.tracked = 'sq_sumi_photos';

    const gt = questTarget();
    expect(gt).toBeDefined();
    expect(gt?.npc).toBe('sumi');
  });
});
