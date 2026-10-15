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

export function clampPage(page: number, count: number): number {
  if (count <= 0) return 0;
  const n = Number.isFinite(page) ? Math.floor(page) : 0;
  return Math.max(0, Math.min(count - 1, n));
}
