/** Stable faces and a saved draw bag; selections stay distinct within a group. */
import type { CustomerId } from '../art/customers';
import { GENERIC_CUSTOMERS } from './orders';

export const CUSTOMER_LOOK: Record<string, CustomerId> = {
  c_tourist: 'oli', c_student: 'toby', c_fisher: 'nico', c_grandpa: 'po', c_couple: 'mugi',
  c_kid: 'pipo', c_painter: 'gigi', c_runner: 'leo', c_writer: 'hana', c_sailor: 'kuri',
  c_oli: 'oli', c_toby: 'toby', c_fredi: 'fredi', c_pipo: 'pipo', c_po: 'po', c_gigi: 'gigi', c_nico: 'nico', c_leo: 'leo',
};
export const customerLook = (id: string): CustomerId => CUSTOMER_LOOK[id] ?? 'oli';
export function drawCustomer(bag: string[], excluded: string[], last: string | null, rng: () => number): string | null {
  if (!bag.length) {
    bag.push(...GENERIC_CUSTOMERS.map(c => c.id));
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.min(i, Math.max(0, Math.floor(rng() * (i + 1))));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
  }
  const valid = (id: string) => !excluded.includes(id) && !excluded.some(other => customerLook(other) === customerLook(id));
  let index = bag.findIndex(id => id !== last && valid(id));
  if (index < 0) index = bag.findIndex(valid);
  return index < 0 ? null : bag.splice(index, 1)[0];
}
