import { game } from '../core/state';
import { RACCOONS } from '../data/characters';

export type CompanyActivity = 'pet' | 'share' | 'sit' | 'play';
export const SNACKS = ['berry', 'mango', 'cucumber', 'g_candy', 'rice', 'umeboshi'];
const marker = (id: string, kind: CompanyActivity) => `company_day_${id}_${kind}`;
export const sharedToday = (id: string) => game.flag(marker(id, 'share')) === game.save.time.day;
export const companyVisits = (id: string, kind: CompanyActivity) => game.save.stats[`company_${id}_${kind}`] ?? 0;
/** Only completed optional moments count. Existing friendship and save flags are reused. */
export function recordCompany(id: string, kind: CompanyActivity, snack?: string): boolean {
  if (!RACCOONS.includes(id) || !game.has('intro_done')) return false;
  if (kind === 'share' && !sharedToday(id) && (!snack || !SNACKS.includes(snack) || game.count(snack) < 1)) return false;
  if (game.flag(marker(id, kind)) !== game.save.time.day) {
    // A fixed key per activity keeps long-running saves small.
    const previous = game.flag(marker(id, kind)) ?? 0;
    game.setFlag(marker(id, kind), game.save.time.day);
    if (kind === 'share' && !game.removeItem(snack!, 1)) { game.setFlag(marker(id, kind), previous); return false; }
    game.addFriendship(id, kind === 'share' || kind === 'play' ? 3 : 2);
    game.stat('companyMoments');
    if (!game.has('memory_' + id + '_company')) game.setFlag('memory_' + id + '_company', `Un rato juntos: ${id === 'spicy' ? 'Spicy Bacon' : id === 'pip' ? 'Pip' : 'Rigg'}`);
  }
  game.stat(`company_${id}_${kind}`); game.touch('company');
  return true;
}
