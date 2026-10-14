import { haptic } from '../core/haptics';
/** Restoration flags stay compatible; new participation baselines and benefits are additive. */
import { game } from '../core/state';
import { activityCount } from '../core/activityCounters';
import { PROJECTS, PROJECTS_BY_ID, PROJECT_AMENITIES, type ProjectPhase } from '../data/projects';
import { ITEMS_BY_ID } from '../data/items';

export const phaseFlag = (id: string, n: number) => `proj_${id}_${n}`;
const workFlag = (id: string, n: number) => `proj_work_${id}_${n}`;
export function projectDone(id: string): number {
  const p = PROJECTS_BY_ID[id];
  if (!p) return 0;
  let n = 0;
  while (n < p.phases.length && game.has(phaseFlag(id, n + 1))) n++;
  return n;
}
export function projectsDoneTotal(): number { return PROJECTS.reduce((a, p) => a + projectDone(p.id), 0); }
export function townCharm(): number { return projectsDoneTotal() * 2; }
export function visibleProjects() { return PROJECTS.filter((p) => !p.needs || game.has(p.needs)); }
function workBase(id: string, n: number): number | undefined {
  const raw = game.flag(workFlag(id, n));
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0) return undefined;
  return raw;
}
export interface PhaseStatus {
  phase: ProjectPhase; index: number; state: 'done' | 'next' | 'locked'; missing: string[];
  activity?: { started: boolean; progress: number; goal: number };
}
export function phaseStatus(id: string): PhaseStatus[] {
  const p = PROJECTS_BY_ID[id];
  if (!p) return [];
  const done = projectDone(id);
  return p.phases.map((phase, i) => {
    const missing: string[] = [];
    const base = workBase(id, i + 1);
    const activity = phase.activity ? { started: base !== undefined, progress: i < done ? phase.activity.goal : base === undefined ? 0 : Math.max(0, Math.min(phase.activity.goal, activityCount(phase.activity.counter) - base)), goal: phase.activity.goal } : undefined;
    if (i === done) {
      if (p.needs && !game.has(p.needs)) missing.push('Primero abrí esta zona siguiendo la historia');
      if (phase.level && game.save.restaurant.level < phase.level) missing.push(`Restaurante nivel ${phase.level}`);
      if (game.coins < phase.coins) missing.push(`${phase.coins - game.coins} monedas`);
      for (const [item, q] of Object.entries(phase.items ?? {})) {
        const have = game.count(item);
        if (have < q) missing.push(`${q - have} ${ITEMS_BY_ID[item]?.name ?? item}`);
      }
      if (activity && (!activity.started || activity.progress < activity.goal)) missing.push(activity.started ? `${phase.activity!.text}: ${activity.progress}/${activity.goal}` : 'Comenzá la colaboración para registrar tu participación');
    }
    return { phase, index: i, state: i < done ? 'done' : i === done ? 'next' : 'locked', missing, activity };
  });
}
export function startProjectPhase(id: string, index: number): boolean {
  const p = PROJECTS_BY_ID[id], phase = p?.phases[index];
  if (!p || !phase?.activity || index !== projectDone(id) || (p.needs && !game.has(p.needs)) || (phase.level && game.save.restaurant.level < phase.level)) return false;
  if (workBase(id, index + 1) !== undefined) return false;
  game.setFlag(workFlag(id, index + 1), activityCount(phase.activity.counter));
  return true;
}
const building = new Set<string>();
/** Expected index protects a stale button; the lock also prevents reentrant charges from events. */
export function buildNextPhase(id: string, expectedIndex?: number): boolean {
  const p = PROJECTS_BY_ID[id];
  if (!p || building.has(id) || (p.needs && !game.has(p.needs))) return false;
  const st = phaseStatus(id).find((s) => s.state === 'next');
  if (!st || st.missing.length || expectedIndex !== undefined && expectedIndex !== st.index) return false;
  building.add(id);
  try {
    for (const [item, q] of Object.entries(st.phase.items ?? {})) if (game.count(item) < q) return false;
    if (!game.spend(st.phase.coins, 'project')) return false;
    for (const [item, q] of Object.entries(st.phase.items ?? {})) game.removeItem(item, q);
    game.setFlag(phaseFlag(id, st.index + 1));
    game.stat('projectPhases');
    applyProjectBenefits();
    game.touch('project');
    haptic('unlock');
    return true;
  } finally { building.delete(id); }
}
/** Restore the extra empty plots when loading, without replacing any existing crop. */
export function applyProjectBenefits(): boolean {
  if (!game.has(phaseFlag('garden_lanterns', 4)) || game.save.garden.length >= 8) return false;
  while (game.save.garden.length < 8) game.save.garden.push({ plot: game.save.garden.length, seed: null, plantedDay: 0, watered: 0, ready: false });
  game.touch('project:garden');
  return true;
}
export function amenityOpen(id: string): boolean {
  const a = PROJECT_AMENITIES.find((a) => a.id === id);
  const p = a && PROJECTS_BY_ID[a.project];
  return !!a && !!p && (!p.needs || game.has(p.needs)) && projectDone(a.project) >= a.phase;
}
export function amenitySuppliesAvailable(id: string): boolean {
  const a = PROJECT_AMENITIES.find((a) => a.id === id);
  return !!a?.items && amenityOpen(id) && !game.has(`once_project_supply_${id}_${game.save.time.day}`);
}
export function claimProjectSupplies(id: string): Record<string, number> | null {
  const a = PROJECT_AMENITIES.find((a) => a.id === id);
  if (!a?.items || !amenitySuppliesAvailable(id)) return null;
  if (!game.once(`project_supply_${id}_${game.save.time.day}`, () => {
    for (const [item, n] of Object.entries(a.items!)) game.addItem(item, n, 'project');
    game.stat('projectVisits');
  })) return null;
  return { ...a.items };
}
/** Called only after reading through the library's shared business gate. */
export function recordLibraryRead(): boolean {
  game.stat('libraryReads');
  game.touch('library:read');
  return projectDone('library_corner') >= 2 && game.once(`project_library_${game.save.time.day}`, () => game.addFriendship('kumo', 3));
}
