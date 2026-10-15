import { FRAMES } from '../art/characters';

export interface RestPose { frame: number; bob: number; lie: boolean; z: boolean }

/**
 * How a sleeper settles, then breathes.
 * Pip curls down slowly. Spicy fidgets, then drops. Rigg reads a moment, then rests.
 * Everyone else lies down and breathes.
 */
export function restPose(id: string, t: number): RestPose {
  if (id === 'spicy' && t < 1.2) {
    return { frame: t < 0.45 ? FRAMES.happy : t < 0.9 ? FRAMES.sit : FRAMES.sleep, bob: t < 0.9 && Math.sin(t * 14) > 0 ? 2 : 0, lie: false, z: false };
  }
  if (id === 'rigg' && t < 1.6) {
    return { frame: t < 1.05 ? FRAMES.read : FRAMES.sleep, bob: 0, lie: false, z: false };
  }
  if (id === 'pip' && t < 1.8) {
    return { frame: t < 0.7 ? FRAMES.sit : FRAMES.sleep, bob: t < 0.7 ? 1 : 0, lie: false, z: false };
  }
  const rate = id === 'spicy' ? 2.05 : id === 'rigg' ? 1.15 : 1.5;
  return {
    frame: FRAMES.sleep,
    bob: Math.sin(t * rate) > 0.35 ? 1 : 0,
    lie: true,
    z: t > 3 && Math.floor(t) % 8 === 0 && t % 1 < 0.05,
  };
}
