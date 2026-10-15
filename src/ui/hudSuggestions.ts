/** Short HUD prompts. Visit and collection stay in the journal and the NoriPhone, not here. */

export interface HudSuggestionInput {
  introDone: boolean;
  pendingOrders: boolean;
  beachUnlocked: boolean;
  period: number;
  atBeach: boolean;
}

export function hudSuggestionLabels(input: HudSuggestionInput): string[] {
  if (!input.introDone) return [];
  const out: string[] = [];
  if (input.pendingOrders) out.push('Preparar sushi');
  if (input.beachUnlocked && input.period < 3 && !input.atBeach) out.push('Ir a pescar');
  return out.slice(0, 3);
}
