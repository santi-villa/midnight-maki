/** Delivery targets for the food Sofi carries: one per table, with every dish for that table in its label. */
export interface DeliveryDish { tableId: string; x: number; y: number; table: string; dish: string }
export interface DeliveryGoal { x: number; y: number; label: string }

export function deliveryGoals(dishes: DeliveryDish[]): DeliveryGoal[] {
  const byTable = new Map<string, DeliveryGoal>();
  for (const d of dishes) {
    const found = byTable.get(d.tableId);
    if (found) found.label += ` + ${d.dish}`;
    else byTable.set(d.tableId, { x: d.x, y: d.y, label: `${d.table} · ${d.dish}` });
  }
  return [...byTable.values()];
}

export function nearestGoal<T extends { x: number; y: number }>(goals: T[], x: number, y: number): T | null {
  return [...goals].sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0] ?? null;
}
