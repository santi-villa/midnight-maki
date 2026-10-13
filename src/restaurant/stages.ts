/**
 * The four looks of Midnight Maki, driven by the restaurant level (the ten levels stay as they are):
 *   0 inherited (1-2)  ·  1 recovered (3-4)  ·  2 popular (5-7)  ·  3 heart of Villa Nori (8-10)
 * Pure, so the map, the lights and the tests can all ask the same question.
 */
export type RestaurantStage = 0 | 1 | 2 | 3;

export function stageForLevel(level: number): RestaurantStage {
  if (level >= 8) return 3;
  if (level >= 5) return 2;
  if (level >= 3) return 1;
  return 0;
}

export const STAGE_NAMES = ['Restaurante heredado', 'Restaurante recuperado', 'Restaurante popular', 'Corazón de Villa Nori'] as const;
