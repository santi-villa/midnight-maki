import { haptic } from '../core/haptics';
/** Quest engine: main story quests, side quests and small optional tasks. */
import { bus } from '../core/events';
import { runTask } from '../core/errors';
import { game } from '../core/state';
import { restaurantPhase } from '../systems/schedule';

export type QuestTarget =
  | { kind: 'location'; zone: string; x?: number; y?: number; label?: string }
  | { kind: 'npc'; npc: string; label?: string }
  | { kind: 'object'; zone: string; x: number; y: number; label?: string; interactId?: string; /** the arrow follows the dining service (opening hours, a seated customer ready to order) instead of a fixed spot */ service?: boolean }
  | { kind: 'interior'; fromZone: string; door: { x: number; y: number }; targetZone: string; interiorTarget?: { x: number; y: number; label?: string }; label?: string };

export interface QuestStep {
  text: string;
  done: () => boolean;
  hint?: string;
  onDone?: () => void;
  target?: QuestTarget;
  /** needs the restaurant to be open: while it is closed the tracker says to explore instead */
  needsOpen?: boolean;
}

/** True when this step cannot be done right now because the restaurant is closed. */
export function stepWaitsForOpening(step: QuestStep | null | undefined): boolean {
  return !!step?.needsOpen && restaurantPhase(game.save.time.period, game.save.time.minutes) !== 'open';
}

export interface QuestDef {
  id: string;
  kind: 'main' | 'side' | 'task';
  title: string;
  giver?: string;
  desc: string;
  steps: QuestStep[];
  reward?: { coins?: number; items?: Record<string, number>; flags?: string[]; friend?: [string, number]; clothes?: string[]; furniture?: string[]; recipes?: string[] };
  /** auto-start when true (main quests, tasks). Side quests may also be started by NPC dialogue. */
  auto?: () => boolean;
  onComplete?: () => void | Promise<void>;
}

const REG = new Map<string, QuestDef>();

export function defineQuests(list: QuestDef[]) {
  for (const q of list) {
    if (REG.has(q.id)) console.warn('[quests] duplicate id', q.id);
    REG.set(q.id, q);
  }
}

export function questDef(id: string) {
  return REG.get(id);
}
export function allQuests() {
  return [...REG.values()];
}

export function isActive(id: string) {
  return !!game.save.quests.active[id];
}
export function isDone(id: string) {
  return game.save.quests.done.includes(id);
}

export function startQuest(id: string): boolean {
  const q = REG.get(id);
  if (!q || isActive(id) || isDone(id)) return false;
  game.save.quests.active[id] = { step: 0, progress: {} };
  if (q.kind === 'main' || !game.save.quests.tracked) game.save.quests.tracked = id;
  game.touch('quest');
  bus.emit('quest:changed', { id });
  if (q.kind !== 'task') bus.emit('toast', { text: `Nueva misión: ${q.title}` });
  check();
  return true;
}

export function currentStep(id: string): QuestStep | null {
  const q = REG.get(id);
  const st = game.save.quests.active[id];
  if (!q || !st) return null;
  return q.steps[st.step] ?? null;
}

export function currentQuestTarget(): QuestTarget | null {
  const id = game.save.quests.tracked;
  if (!id) return null;
  const q = REG.get(id);
  const st = game.save.quests.active[id];
  if (!q || !st) return null;
  const step = q.steps[st.step];
  return step?.target ?? null;
}

let checking = false;
let pendingRewards: (() => Promise<void> | void)[] = [];

/** Re-evaluates all active quests; advances steps whose condition is met. */
export function check() {
  if (checking || !game.loaded) return;
  checking = true;
  try {
    // auto-start
    for (const q of REG.values()) if (q.auto && !isActive(q.id) && !isDone(q.id) && q.auto()) startQuest(q.id);
    let changed = true;
    let guard = 0;
    while (changed && guard++ < 20) {
      changed = false;
      for (const [id, st] of Object.entries(game.save.quests.active)) {
        const q = REG.get(id);
        if (!q) continue;
        const step = q.steps[st.step];
        if (!step) continue;
        if (step.done()) {
          step.onDone?.();
          st.step++;
          changed = true;
          bus.emit('quest:changed', { id });
          if (st.step >= q.steps.length) complete(q);
        }
      }
    }
  } finally {
    checking = false;
  }
  if (pendingRewards.length) {
    const list = pendingRewards;
    pendingRewards = [];
    void runTask('quest:rewards', async () => {
      for (const f of list) await runTask('quest:complete', f);
    });
  }
}

function complete(q: QuestDef) {
  delete game.save.quests.active[q.id];
  if (!game.save.quests.done.includes(q.id)) game.save.quests.done.push(q.id);
  game.save.flags[`q_${q.id}_done`] = true; // lets dialogue remember finished requests
  if (game.save.quests.tracked === q.id) {
    const next = Object.keys(game.save.quests.active);
    game.save.quests.tracked = next.find((k) => REG.get(k)?.kind === 'main') ?? next.find((k) => REG.get(k)?.kind === 'side') ?? next[0] ?? null;
  }
  const r = q.reward;
  if (r) {
    if (r.coins) game.addCoins(r.coins, 'quest');
    for (const [id, n] of Object.entries(r.items ?? {})) game.addItem(id, n, 'quest');
    for (const f of r.flags ?? []) game.setFlag(f);
    if (r.friend) game.addFriendship(r.friend[0], r.friend[1]);
    for (const c of r.clothes ?? []) if (!game.save.clothesOwned.includes(c)) game.save.clothesOwned.push(c);
    for (const f of r.furniture ?? []) game.save.furnitureOwned[f] = (game.save.furnitureOwned[f] ?? 0) + 1;
    for (const rc of r.recipes ?? []) if (!game.save.recipesKnown.includes(rc)) game.save.recipesKnown.push(rc);
  }
  game.touch('quest');
  haptic('unlock');
  if (q.kind !== 'task') bus.emit('toast', { text: `Misión completada: ${q.title}` });
  if (r?.coins) bus.emit('reward:coins', { coins: r.coins, title: q.title });
  if (q.onComplete) pendingRewards.push(q.onComplete);
}

export function trackedText(): string | null {
  const id = game.save.quests.tracked;
  if (!id) return null;
  const q = REG.get(id);
  const step = currentStep(id);
  if (!q || !step) return null;
  if (stepWaitsForOpening(step)) return `<b>${q.title}</b><br><span class="step">Explorá el pueblo un rato: el restaurante abre a las 8:00.</span>`;
  return `<b>${q.title}</b><br><span class="step">${step.text}</span>`;
}

let t: ReturnType<typeof setTimeout> | undefined;
bus.on('state:changed', () => {
  if (t) clearTimeout(t);
  t = setTimeout(check, 120);
});
bus.on('zone:enter', () => check());
