import { describe, expect, it } from 'vitest';
import { ago, decideSync } from '../cloud/decide';

const never = { local: 0, remote: 0 };

describe('cloud sync decisions', () => {
  it('uploads when the cloud has nothing and downloads when the device has nothing', () => {
    expect(decideSync(500, null, never)).toBe('push');
    expect(decideSync(null, 500, never)).toBe('pull');
    expect(decideSync(null, null, never)).toBe('none');
  });
  it('does nothing when both sides are the same moment', () => {
    expect(decideSync(500, 500, never)).toBe('none');
  });
  it('pushes only what this device changed since the last sync', () => {
    expect(decideSync(900, 500, { local: 500, remote: 500 })).toBe('push');
  });
  it('pulls only what changed in the cloud since the last sync', () => {
    expect(decideSync(500, 900, { local: 500, remote: 500 })).toBe('pull');
  });
  it('asks the player when both changed, or when two different games meet for the first time', () => {
    expect(decideSync(900, 800, { local: 500, remote: 500 })).toBe('conflict');
    expect(decideSync(900, 800, never)).toBe('conflict');
  });
  it('says how long ago in plain words', () => {
    expect(ago(100_000, 95_000)).toBe('recién');
    expect(ago(1_000_000, 1_000_000 - 5 * 60_000)).toBe('hace 5 min');
    expect(ago(1_000_000_000, 1_000_000_000 - 3 * 3_600_000)).toBe('hace 3 h');
    expect(ago(1_000_000_000, 1_000_000_000 - 86_400_000)).toBe('ayer');
  });
});
