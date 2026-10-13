import { afterEach, expect, it, vi } from 'vitest';
import { bus } from '../core/events';
import { errorReports, reportError, runTask } from '../core/errors';

afterEach(() => vi.restoreAllMocks());

it('records bounded, actionable diagnostics without raw messages, URLs, or rejected objects', () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  const err = new TypeError('Private name, email@example.com, token=secret');
  err.stack = 'TypeError: Private name\n at fn (https://host/src/core/flow.ts:10:2)\n at private (https://host/?token=secret:1:3)';
  for (let i = 0; i < 25; i++) reportError('flow:new', err, false);
  reportError('global:promise', { save: { name: 'Private name' } }, false);
  const reports = errorReports();
  expect(reports).toHaveLength(20);
  expect(reports[0]).toMatchObject({ operation: 'flow:new', name: 'TypeError', frames: ['/src/core/flow.ts:10:2'] });
  expect(JSON.stringify(log.mock.calls)).not.toMatch(/Private|secret|email@|https/);
});

it('observes asynchronous event failures and keeps subsequent listeners working', async () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  const next = vi.fn();
  const off = bus.on('settings:changed', async () => { throw new TypeError('private'); });
  const offNext = bus.on('settings:changed', next);
  try {
    bus.emit('settings:changed', {});
    await Promise.resolve();
    expect(next).toHaveBeenCalledOnce();
    expect(log).toHaveBeenCalledWith('[midnight-maki]', expect.objectContaining({ operation: 'event:settings:changed' }));
  } finally { off(); offNext(); }
});

it('handles synchronous and asynchronous detached failures', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  expect(await runTask('test:sync', () => { throw new Error(); }, false)).toBeUndefined();
  expect(await runTask('test:async', () => Promise.reject(new Error()), false)).toBeUndefined();
  expect(await runTask('test:ok', () => 42)).toBe(42);
});
