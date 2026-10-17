/** Minimal typed event bus shared by game systems, scenes and UI. */
import { reportError } from './errors';
export interface GameEvents {
  'state:changed': { reason: string };
  'coins:changed': { coins: number; delta: number };
  'inventory:changed': { id: string; qty: number; delta: number };
  'time:changed': { day: number; period: number };
  'energy:changed': { energy: number };
  'reward:coins': { coins: number; title?: string };
  'cloud:changed': Record<string, never>;
  'zone:enter': { zone: string };
  'dialogue:start': { id: string };
  'dialogue:end': { id: string };
  'ui:modal': { open: boolean };
  'interact:available': { label: string | null; kind?: string };
  'quest:changed': { id: string };
  'recipe:cooked': { id: string; quality: number };
  'toast': { text: string; icon?: string };
  'decor:changed': { room: string };
  'appearance:changed': {};
  'phone:changed': {};
  'flag:set': { key: string };
  'settings:changed': {};
  'input:method': { method: 'touch' | 'mouse' | 'keyboard' };
  'item:collected': { id: string; source: string };
}

type Handler<T> = (payload: T) => void | Promise<void>;

class EventBus {
  private map = new Map<string, Set<Handler<any>>>();

  on<K extends keyof GameEvents>(ev: K, fn: Handler<GameEvents[K]>): () => void {
    let set = this.map.get(ev);
    if (!set) this.map.set(ev, (set = new Set()));
    set.add(fn);
    return () => set!.delete(fn);
  }

  emit<K extends keyof GameEvents>(ev: K, payload: GameEvents[K]): void {
    const set = this.map.get(ev);
    if (!set) return;
    for (const fn of [...set]) {
      try {
        const result = fn(payload);
        if (result) void Promise.resolve(result).catch((err) => reportError(`event:${ev}`, err));
      } catch (err) {
        reportError(`event:${ev}`, err);
      }
    }
  }
}

export const bus = new EventBus();
