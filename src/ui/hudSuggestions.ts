/**
 * Corner prompts used to offer "Preparar sushi" and "Ir a pescar".
 * Those shortcuts did nothing useful (cooking opened the old board), so the corner is the phone instead.
 * The input stays so callers and tests keep one place that decides the list is empty.
 */

export interface HudSuggestionInput {
  introDone: boolean;
  pendingOrders: boolean;
  beachUnlocked: boolean;
  period: number;
  atBeach: boolean;
}

export function hudSuggestionLabels(input: HudSuggestionInput): string[] {
  return input.introDone ? [] : [];
}
