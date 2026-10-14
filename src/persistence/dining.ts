/** Validate optional service snapshots before they can replace a player's save. */
import { createService } from '../restaurant/floor';
import type { DiningSave, Order } from '../core/types';

const object = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const number = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const id = (v: unknown) => typeof v === 'string' && v.length > 0 && v.length <= 100;
const phases = ['outside', 'reception', 'queued', 'walking', 'seated', 'waiting_order', 'waiting_food', 'eating', 'paying', 'leaving'];
const statuses = ['free', 'reserved', 'occupied', 'waiting_order', 'waiting_food', 'eating', 'tip', 'cleanup'];

export function validateDining(value: unknown, orders: Order[]): DiningSave | undefined {
  if (value === undefined) return;
  const fail = () => { throw new Error('Invalid dining snapshot'); };
  if (!object(value) || !number(value.day) || value.day < 1 || !object(value.floor) || !Array.isArray(value.floor.tables) || !Array.isArray(value.floor.parties) || value.floor.tables.length > 60 || value.floor.parties.length > 30 || !number(value.floor.nextTicket)) return fail();
  const tables = new Set<string>(), seats = new Set<string>(), parties = new Set<string>(), members = new Set<string>(), uids = new Set<number>();
  for (const t of value.floor.tables) {
    if (!object(t) || !id(t.id) || tables.has(t.id) || !number(t.x) || !number(t.y) || !number(t.capacity) || !Array.isArray(t.seats) || t.capacity > t.seats.length || !statuses.includes(t.status) || !number(t.tip) || t.partyId !== null && !id(t.partyId)) return fail();
    tables.add(t.id);
    for (const s of t.seats) { if (!object(s) || !id(s.id) || seats.has(s.id) || !number(s.x) || !number(s.y) || !number(s.rot)) return fail(); seats.add(s.id); }
  }
  for (const p of value.floor.parties) {
    if (!object(p) || !id(p.id) || parties.has(p.id) || !id(p.customerId) || !phases.includes(p.phase) || !number(p.phaseT) || !number(p.size) || p.size < 1 || p.size > 4 || !Array.isArray(p.members) || p.members.length !== p.size || !number(p.patience) || !number(p.maxPatience) || !Array.isArray(p.seatIds) || typeof p.individual !== 'boolean' || typeof p.impatient !== 'boolean' || !number(p.tipRate) || !number(p.bill) || !number(p.tip) || !number(p.reward) || !number(p.variantBonus)) return fail();
    parties.add(p.id);
    const table = value.floor.tables.find((t: any) => t.id === p.tableId);
    if (p.tableId !== null && (!table || table.capacity < p.size || p.seatIds.length !== p.size || new Set(p.seatIds).size !== p.size || p.seatIds.some((s: string) => !table.seats.some((seat: any) => seat.id === s)))) return fail();
    if (p.individual && new Set(p.members.map((m: any) => m.customerId)).size !== p.size) return fail();
    for (const m of p.members) {
      if (!object(m) || !id(m.id) || members.has(m.id) || !id(m.customerId) || !number(m.patience) || !number(m.maxPatience) || m.maxPatience < 1 || typeof m.impatient !== 'boolean' || !Array.isArray(m.items) || m.items.length > 2 || new Set(m.items.map((i: any) => i.kind)).size !== m.items.length) return fail();
      members.add(m.id);
      for (const item of m.items) {
        if (!object(item) || !['food', 'drink'].includes(item.kind) || !id(item.recipe) || !number(item.reward) || !number(item.ticket) || item.quality !== null && ![0, 1, 2].includes(item.quality) || !number(item.variantBonus) || item.orderUid !== null && (!number(item.orderUid) || item.orderUid < 1 || uids.has(item.orderUid))) return fail();
        if (!item.orderUid) continue;
        uids.add(item.orderUid);
        const order = orders.find(o => o.uid === item.orderUid);
        if (!order && p.phase !== 'leaving') return fail();
        if (order?.service && ((item.quality !== null) !== (order.plate?.state === 'delivered'))) return fail();
        if (order && (order.recipe !== item.recipe || order.customer !== m.customerId || order.service && (order.service.partyId !== p.id || order.service.memberId !== m.id || order.service.tableId !== p.tableId))) return fail();
      }
    }
  }
  for (const order of orders) if (order.service && !uids.has(order.uid)) return fail();
  const check = createService([]); check.restore(value.floor as unknown as DiningSave['floor']); if (check.audit().length) return fail();
  for (const t of value.floor.tables) {
    if (t.partyId && !parties.has(t.partyId) || t.status === 'free' && (t.partyId || t.tip)) return fail();
  }
  if (!Array.isArray(value.bag) || value.bag.length > 50 || value.bag.some(v => !id(v)) || new Set(value.bag).size !== value.bag.length || value.lastCustomer !== null && !id(value.lastCustomer) || !number(value.nextId) || value.nextId < 1) return fail();
  if (value.shift !== null && (!object(value.shift) || !['open', 'closed'].includes(value.shift.state) || ['day', 'arrived', 'served', 'coins', 'tips'].some(k => !number(value.shift[k])))) return fail();
  return value as unknown as DiningSave;
}
