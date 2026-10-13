/** Restoration projects: state lives in save flags (`proj_<id>_<phase>`), so old saves need no migration. */
import { game } from '../core/state';
import { PROJECTS, PROJECTS_BY_ID, type ProjectPhase } from '../data/projects';
import { ITEMS_BY_ID } from '../data/items';

export const phaseFlag = (id: string, n: number) => `proj_${id}_${n}`;

/** Phases finished so far (0..phases). */
export function projectDone(id: string): number {
  const p = PROJECTS_BY_ID[id];
  if (!p) return 0;
  let n = 0;
  while (n < p.phases.length && game.has(phaseFlag(id, n + 1))) n++;
  return n;
}

export function projectsDoneTotal(): number {
  return PROJECTS.reduce((a, p) => a + projectDone(p.id), 0);
}

/** Charm the restaurant gets from the neighbourhood looking better (read by orders.charm). */
export function townCharm(): number {
  return projectsDoneTotal() * 2;
}

export function visibleProjects() {
  return PROJECTS.filter((p) => !p.needs || game.has(p.needs));
}

export interface PhaseStatus {
  phase: ProjectPhase;
  index: number; // 0-based
  state: 'done' | 'next' | 'locked';
  missing: string[];
}

export function phaseStatus(id: string): PhaseStatus[] {
  const p = PROJECTS_BY_ID[id];
  const done = projectDone(id);
  return p.phases.map((phase, i) => {
    const missing: string[] = [];
    if (i === done) {
      if (phase.level && game.save.restaurant.level < phase.level) missing.push(`Restaurante nivel ${phase.level}`);
      if (game.coins < phase.coins) missing.push(`${phase.coins - game.coins} monedas`);
      for (const [item, q] of Object.entries(phase.items ?? {})) {
        const have = game.count(item);
        if (have < q) missing.push(`${q - have} ${ITEMS_BY_ID[item]?.name ?? item}`);
      }
    }
    return { phase, index: i, state: i < done ? 'done' : i === done ? 'next' : 'locked', missing };
  });
}

/** Pays for the next phase. Returns false (and charges nothing) when anything is missing. Safe to call twice. */
export function buildNextPhase(id: string): boolean {
  const p = PROJECTS_BY_ID[id];
  if (!p || (p.needs && !game.has(p.needs))) return false;
  const st = phaseStatus(id).find((s) => s.state === 'next');
  if (!st || st.missing.length) return false;
  for (const [item, q] of Object.entries(st.phase.items ?? {})) if (game.count(item) < q) return false;
  if (!game.spend(st.phase.coins, 'project')) return false;
  for (const [item, q] of Object.entries(st.phase.items ?? {})) game.removeItem(item, q);
  game.setFlag(phaseFlag(id, st.index + 1));
  game.stat('projectPhases');
  game.touch('project');
  return true;
}
