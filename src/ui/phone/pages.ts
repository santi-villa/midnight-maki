/** Home-screen paging for the NoriPhone. Pure, so the order can be tested without opening the phone. */

export const APPS_PER_PAGE = 12;

/**
 * What the player reaches for while walking comes first.
 * An app that is not listed still appears, after these, in the order it was given.
 */
export const HOME_ORDER = [
  'quests',
  'map',
  'bag',
  'recipes',
  'restaurant',
  'supplies',
  'staff',
  'clients',
  'friends',
  'camera',
  'photos',
  'collections',
  'calendar',
  'memories',
  'investigation',
  'customize',
  'settings',
  'more',
] as const;

export function orderPhoneApps<T extends { id: string }>(apps: readonly T[]): T[] {
  const pending = new Map(apps.map((app) => [app.id, app]));
  const ordered: T[] = [];
  for (const id of HOME_ORDER) {
    const app = pending.get(id);
    if (!app) continue;
    ordered.push(app);
    pending.delete(id);
  }
  for (const app of apps) {
    if (!pending.has(app.id)) continue;
    ordered.push(app);
    pending.delete(app.id);
  }
  return ordered;
}

export function phonePages<T>(apps: readonly T[], perPage = APPS_PER_PAGE): T[][] {
  const size = Math.max(1, Math.floor(perPage));
  if (!apps.length) return [[]];
  const pages: T[][] = [];
  for (let i = 0; i < apps.length; i += size) pages.push(apps.slice(i, i + size));
  return pages;
}

/** Home screens, in the order the player swipes. Apps missing from the list still appear, on the last page that has room. */
export const PHONE_GROUPS: { title: string; ids: readonly string[] }[] = [
  { title: 'Jugar', ids: ['quests', 'map', 'bag', 'recipes', 'restaurant', 'supplies', 'staff', 'agenda', 'camera'] },
  { title: 'Gente', ids: ['friends', 'clients', 'photos', 'collections', 'calendar', 'memories', 'investigation'] },
  { title: 'Sistema', ids: ['customize', 'settings', 'more'] },
];

export function groupPhoneApps<T extends { id: string }>(apps: readonly T[]): { title: string; apps: T[] }[] {
  const pending = new Map(apps.map((app) => [app.id, app]));
  const pages = PHONE_GROUPS.map((group) => {
    const list: T[] = [];
    for (const id of group.ids) {
      const app = pending.get(id);
      if (!app) continue;
      list.push(app);
      pending.delete(id);
    }
    return { title: group.title, apps: list };
  }).filter((page) => page.apps.length);
  if (pending.size) {
    const rest = [...pending.values()];
    const last = pages[pages.length - 1];
    if (last && last.apps.length + rest.length <= 9) last.apps.push(...rest);
    else pages.push({ title: 'Más', apps: rest });
  }
  return pages.length ? pages : [{ title: 'Jugar', apps: [] }];
}

export function clampPage(page: number, count: number): number {
  if (count <= 0) return 0;
  const n = Number.isFinite(page) ? Math.floor(page) : 0;
  return Math.max(0, Math.min(count - 1, n));
}
