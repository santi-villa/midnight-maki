/** Device preference, independent of text size and the Phaser canvas. */
export const MIN_UI_SCALE = 0.7;
export const MAX_UI_SCALE = 1;

export function normalizeUiScale(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(MAX_UI_SCALE, Math.max(MIN_UI_SCALE, value))
    : MAX_UI_SCALE;
}
