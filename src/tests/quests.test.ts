import { beforeEach, describe, expect, it } from 'vitest';
import { game, newSave } from '../core/state';
import { CHARACTERS, CHAR_BY_ID } from '../data/characters';
import { validateSave } from '../persistence/validate';
import { buildZone, doorLeadingTo } from '../world/zoneRuntime';
import { currentQuestTarget, questDef, startQuest } from '../quests/quests';
import '../quests/side';
import { ZONES } from '../data/zones';

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
    expect(toRestaurant).toMatchObject({ x: ZONES.plaza.doors.find(d => d.to === 'restaurant')!.x, y: ZONES.plaza.doors.find(d => d.to === 'restaurant')!.y });

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

    // The lighthouse now belongs to the eastern harbour.
    const plazaToLighthouse = doorLeadingTo('plaza', 'lighthouse');
    expect(plazaToLighthouse).toBeDefined();
    expect(plazaToLighthouse?.to).toBe('residential');

    // From beach to lighthouse is direct
    const beachToLighthouse = doorLeadingTo('harbor', 'lighthouse');
    expect(beachToLighthouse).toBeDefined();
    expect(beachToLighthouse?.to).toBe('lighthouse');
  });

  it('maintains solids on doors marked walk: false', () => {
    // Storage door in restaurant is locked initially and walk: false
    const restaurantZone = buildZone('restaurant');
    // storage door is at (13, 2)
    expect(restaurantZone.grid.isSolid(13, 2)).toBe(true);

    // Lighthouse door in beach is at (3, 4) with walk: false
    const harbor = buildZone('harbor'), door = ZONES.harbor.doors.find(d => d.to === 'lighthouse')!;
    expect(harbor.grid.isSolid(door.x, door.y)).toBe(true);
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

describe('notice board', () => {
  it('only lists quests that really exist (the legacy sumi alias used to crash it)', async () => {
    const { game, newSave } = await import('../core/state');
    const { boardQuests } = await import('../quests/side');
    game.load(newSave('T'));
    for (const f of ['unlock_beach', 'unlock_forest', 'unlock_garden', 'intro_done', 'ch1_started']) game.setFlag(f);
    const ids = boardQuests();
    expect(ids.length).toBeGreaterThan(5);
    expect(ids.every((i) => !!questDef(i))).toBe(true);
    expect(ids).not.toContain('sq_mika_photos');
  });
});

describe('restaurant occasions', () => {
  it('count only what happens after the request was accepted, pay once, and never block a giver forever', async () => {
    const { check, isActive, isDone } = await import('../quests/quests');
    const { giverBusy } = await import('../quests/side');
    game.save.stats.perfectServed = 9; // an old total must not finish a new request
    game.save.restaurant.level = 2; game.setFlag('intro_done'); game.save.furnitureOwned = {};
    expect(startQuest('sq_spicy_party')).toBe(true);
    check();
    expect(isActive('sq_spicy_party')).toBe(true);
    game.stat('perfectServed', 2); check();
    expect(isActive('sq_spicy_party')).toBe(true);
    game.stat('perfectServed', 1); check();
    expect(isDone('sq_spicy_party')).toBe(true);
    expect(game.save.furnitureOwned.garland).toBe(1);
    expect(game.save.furnitureOwned.plush_raccoon).toBe(1);
    check(); check();
    expect(game.save.furnitureOwned.garland).toBe(1); // no second reward
    expect(giverBusy('spicy')).toBe(false);
  });

  it('the raccoons\' picnic needs a shared snack with each of the three', async () => {
    const { check, isDone } = await import('../quests/quests');
    game.setFlag('intro_done'); game.save.furnitureOwned = {};
    startQuest('sq_merienda_trio');
    game.save.stats.company_pip_share = 1; game.save.stats.company_spicy_share = 1; check();
    expect(isDone('sq_merienda_trio')).toBe(false);
    game.save.stats.company_rigg_share = 1; check();
    expect(isDone('sq_merienda_trio')).toBe(true);
    expect(game.save.furnitureOwned.table_low).toBe(1);
  });

  it('survive a save round trip with the baselines kept', () => {
    startQuest('sq_rigg_meeting');
    game.setFlag('qb_sq_rigg_meeting_neighborsServed', 4);
    const back = validateSave(JSON.parse(JSON.stringify(game.save)));
    expect(back.flags.qb_sq_rigg_meeting_neighborsServed).toBe(4);
    expect(back.quests.active.sq_rigg_meeting).toBeDefined();
  });
});
