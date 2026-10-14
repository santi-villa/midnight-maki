import { describe, expect, it } from 'vitest';
import { phoneArtGrids } from '../ui/phone/appIcons';
import { APPS_PER_PAGE, clampPage, HOME_ORDER, orderPhoneApps, phonePages } from '../ui/phone/pages';

const ids = ['camera', 'photos', 'map', 'quests', 'friends', 'collections', 'recipes', 'restaurant', 'calendar', 'memories', 'investigation', 'bag', 'settings', 'more', 'customize'];

describe('NoriPhone home pages', () => {
  it('puts six apps on a page, with the daily ones first', () => {
    const pages = phonePages(orderPhoneApps(ids.map((id) => ({ id }))));
    expect(APPS_PER_PAGE).toBe(6);
    expect(pages.map((page) => page.map((app) => app.id))).toEqual([
      ['quests', 'map', 'bag', 'recipes', 'restaurant', 'friends'],
      ['camera', 'photos', 'collections', 'calendar', 'memories', 'investigation'],
      ['customize', 'settings', 'more'],
    ]);
  });

  it('keeps unknown apps and clamps the page', () => {
    expect(phonePages(orderPhoneApps([{ id: 'zzz' }, { id: 'map' }])).map((page) => page.map((app) => app.id))).toEqual([['map', 'zzz']]);
    expect(clampPage(-2, 3)).toBe(0);
    expect(clampPage(8, 3)).toBe(2);
    expect(clampPage(Number.NaN, 3)).toBe(0);
    expect(phonePages([])).toEqual([[]]);
  });

  it('draws an icon for every home app', () => {
    const art = phoneArtGrids();
    for (const id of HOME_ORDER) expect(art[id]?.some((row) => row.some(Boolean))).toBe(true);
    for (const id of ['paw', 'leaf', 'cherry', 'charm', 'signals']) expect(art[id]?.some((row) => row.some(Boolean))).toBe(true);
  });
});
