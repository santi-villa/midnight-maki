import { describe, expect, it } from 'vitest';
import { createService, type ServiceTable } from '../restaurant/floor';

const tables: ServiceTable[] = [{ id: 't1', x: 9, y: 8, w: 1, h: 1, capacity: 1, seats: [{ id: 's1', x: 9, y: 9, rot: 2 }] }];

describe('physical hosting', () => {
  it('waits for arrival, Pip, and real chair and exit arrivals regardless of elapsed seconds', () => {
    const floor = createService(tables, { physical: true });
    floor.arrive({ id: 'v1', customerId: 'c_tourist' });
    floor.tick(100); expect(floor.party('v1')?.phase).toBe('outside');
    floor.reachReception('v1'); floor.tick(1);
    expect(floor.party('v1')?.phase).toBe('reception');
    expect(floor.hostParty('v1')[0].type).toBe('assigned');
    floor.tick(100); expect(floor.party('v1')?.phase).toBe('walking');
    floor.reachSeats('v1'); floor.tick(2);
    expect(floor.party('v1')?.phase).toBe('waiting_order');
    floor.windDown(); floor.tick(100);
    expect(floor.party('v1')?.phase).toBe('leaving');
    floor.reachExit('v1'); expect(floor.parties()).toEqual([]);
    expect(floor.audit()).toEqual([]);
  });

  it('greets a waiting party and respects the queue when a table becomes free', () => {
    const floor = createService(tables, { physical: true });
    for (const id of ['v1', 'v2', 'v3']) { floor.arrive({ id, customerId: 'c_tourist' }); floor.reachReception(id); }
    floor.hostParty('v1'); floor.hostParty('v2');
    expect(floor.party('v2')?.phase).toBe('queued');
    expect(floor.hostParty('v3')).toEqual([]);
    floor.windDown(); floor.reachExit('v1'); floor.reachExit('v2'); floor.reachExit('v3');
    floor.arrive({ id: 'v4', customerId: 'c_tourist' }); floor.reachReception('v4'); floor.hostParty('v4');
    expect(floor.party('v4')?.phase).toBe('walking');
    expect(floor.audit()).toEqual([]);
  });
});
