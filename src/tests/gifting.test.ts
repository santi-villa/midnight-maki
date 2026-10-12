import { beforeEach, describe, expect, it } from 'vitest';
import { BALANCE } from '../core/balance';
import { game, newSave } from '../core/state';
import { CHAR_BY_ID } from '../data/characters';
import { evaluateGift, processGift } from '../dialogue/talk';

beforeEach(() => {
  game.load(newSave('Tester'));
  game.save.time.day = 1;
});

describe('gifting system', () => {
  it('correctly evaluates loved, liked, disliked and neutral reactions', () => {
    // Pip loves 'spoon' and 'g_blanket', likes 'st_seaglass', dislikes 'f_wasabi'
    const loved = evaluateGift('pip', 'spoon')!;
    expect(loved.reaction).toBe('love');
    expect(loved.points).toBe(BALANCE.giftLoved);

    const liked = evaluateGift('pip', 'st_seaglass')!;
    expect(liked.reaction).toBe('like');
    expect(liked.points).toBe(BALANCE.giftLiked);

    const disliked = evaluateGift('pip', 'wasabi')!;
    expect(disliked.reaction).toBe('dislike');
    expect(disliked.points).toBe(2);

    const neutral = evaluateGift('pip', 'wood')!;
    expect(neutral.reaction).toBe('neutral');
    expect(neutral.points).toBe(BALANCE.giftNeutral);
  });

  it('doubles friendship points on the character birthday', () => {
    game.setFlag('bday_today_pip', 1);
    const loved = evaluateGift('pip', 'spoon')!;
    expect(loved.points).toBe(BALANCE.giftLoved * 2);
  });

  it('atomically deducts item from inventory and increases friendship', () => {
    game.addItem('spoon', 2);
    expect(game.count('spoon')).toBe(2);

    const res = processGift('pip', 'spoon');
    expect(res.success).toBe(true);
    expect(res.reaction).toBe('love');
    expect(res.points).toBe(BALANCE.giftLoved);
    expect(game.count('spoon')).toBe(1);
    expect(game.rel('pip').points).toBe(BALANCE.giftLoved);
    expect(game.rel('pip').lastGiftDay).toBe(1);
    expect(game.flag('gift_pip_spoon')).toBe(true);
    expect(game.save.stats.gifts).toBe(1);
  });

  it('rejects gifting if item is not in inventory', () => {
    expect(game.count('spoon')).toBe(0);
    const res = processGift('pip', 'spoon');
    expect(res.success).toBe(false);
    expect(res.reason).toBe('missing_item');
    expect(game.rel('pip').points).toBe(0);
  });

  it('prevents gifting more than once on the same day', () => {
    game.addItem('spoon', 2);
    const first = processGift('pip', 'spoon');
    expect(first.success).toBe(true);

    const second = processGift('pip', 'spoon');
    expect(second.success).toBe(false);
    expect(second.reason).toBe('already_gifted_today');
    expect(game.count('spoon')).toBe(1); // Item not consumed on failed second gift
  });

  it('allows gifting again on the next day', () => {
    game.addItem('spoon', 2);
    const first = processGift('pip', 'spoon');
    expect(first.success).toBe(true);

    // Advance day
    game.save.time.day = 2;
    const second = processGift('pip', 'spoon');
    expect(second.success).toBe(true);
    expect(game.count('spoon')).toBe(0);
  });

  it('triggers level-up flag when points cross the threshold', () => {
    // Level 1 requires BALANCE.friendshipPerLevel (100)
    game.addItem('spoon', 5);
    // Give enough points to level up
    game.rel('pip').points = BALANCE.friendshipPerLevel - 5;
    const res = processGift('pip', 'spoon');
    expect(res.success).toBe(true);
    expect(res.levelUp).toBe(1);
    expect(game.friendLevel('pip')).toBe(1);
  });

  it('works with Sumi and maintains legacy Mika alias', () => {
    expect(CHAR_BY_ID.sumi).toBeDefined();
    expect(CHAR_BY_ID.mika).toBe(CHAR_BY_ID.sumi);

    // Sumi loves 'fl_star', 'b_sakura', 'st_quartz'
    const evalSumi = evaluateGift('sumi', 'fl_star')!;
    expect(evalSumi.reaction).toBe('love');

    const evalMika = evaluateGift('mika', 'fl_star')!;
    expect(evalMika.reaction).toBe('love');

    game.addItem('fl_star', 1);
    const res = processGift('sumi', 'fl_star');
    expect(res.success).toBe(true);
    expect(game.count('fl_star')).toBe(0);
  });
});
