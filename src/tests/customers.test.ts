import { describe, expect, it } from 'vitest';
import { buildCustomerFrames, CUSTOMER_H, CUSTOMER_W, CUSTOMERS } from '../art/customers';

describe('restaurant customers (28x40)', () => {
  it('keeps the original 8 animals and adds cat, bunny and otter', () => {
    expect(CUSTOMERS.map((c) => c.id)).toEqual(['oli', 'toby', 'fredi', 'pipo', 'po', 'gigi', 'nico', 'leo', 'hana', 'mugi', 'kuri']);
  });

  it('draws 26 non-empty 28x40 frames each, all different where they should be', () => {
    for (const c of CUSTOMERS) {
      const frames = buildCustomerFrames(c.id);
      expect(frames).toHaveLength(26);
      const sig = frames.map((f) => {
        expect([f.w, f.h]).toEqual([CUSTOMER_W, CUSTOMER_H]);
        let n = 0;
        let s = 0;
        for (let i = 0; i < f.data.length; i += 4) if (f.data[i + 3]) { n++; s = (s * 31 + f.data[i] + f.data[i + 1] * 3 + f.data[i + 2] * 7 + i) >>> 0; }
        expect(n, c.id).toBeGreaterThan(150);
        return s;
      });
      // front, side, walk x4 and eat x4 are all distinct drawings
      // sitting facing the camera and with their back to it are their own drawings
      expect(new Set([sig[14], sig[20], sig[8], sig[0]]).size, c.id).toBe(4);
      expect(new Set([sig[16], sig[17], sig[18], sig[19]]).size, c.id).toBe(4);
      expect(new Set([sig[0], sig[2], sig[4], sig[5], sig[6], sig[7], sig[10], sig[11], sig[12], sig[13]]).size, c.id).toBe(10);
    }
  });
  it('keeps stable outfits and every pose when a customer puts on a raincoat', () => {
    const sig = (id: typeof CUSTOMERS[number]['id'], seed: string, raincoat = false) => buildCustomerFrames(id, { seed, raincoat });
    const dry = sig('hana', 'c_writer'), same = sig('hana', 'c_writer'), wet = sig('hana', 'c_writer', true);
    expect(dry.map(f => [...f.data])).toEqual(same.map(f => [...f.data]));
    expect([...sig('hana', 'c_tourist')[0].data]).not.toEqual([...dry[0].data]);
    expect(wet).toHaveLength(dry.length);
    for (let i = 0; i < wet.length; i++) {
      expect([wet[i].w, wet[i].h]).toEqual([28, 40]);
      expect([...wet[i].data]).not.toEqual([...dry[i].data]);
      // The face/ears and feet keep their alignment; the coat occupies the existing body.
      expect([...wet[i].data.slice(0, 22 * 28 * 4)]).toEqual([...dry[i].data.slice(0, 22 * 28 * 4)]);
    }
  });
});
