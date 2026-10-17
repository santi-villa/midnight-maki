import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  disconnect: vi.fn(), cancel: vi.fn(), publish: vi.fn(), transaction: vi.fn(),
}));
vi.mock('../cloud/firebase', () => ({ firebaseDb: () => ({}), firebaseUid: () => 'guest-account' }));
vi.mock('firebase/app', () => ({ getApp: () => ({}) }));
vi.mock('firebase/firestore', () => ({
  doc: () => ({}), getDoc: async () => ({ exists: () => true, data: () => ({ uid: 'host-account' }) }),
}));
vi.mock('firebase/database', () => ({
  getDatabase: () => ({}), ref: (_db: unknown, path: string) => path,
  get: async () => ({ exists: () => true, val: () => ({ hostUid: 'host-account' }) }),
  runTransaction: mocks.transaction, set: mocks.publish,
  onDisconnect: () => ({ remove: mocks.disconnect, cancel: mocks.cancel }),
  onChildAdded: () => () => undefined, onValue: () => () => undefined,
  remove: async () => undefined, push: async () => undefined,
}));

import { openFirebaseTransport } from '../coop/firebaseTransport';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.disconnect.mockResolvedValue(undefined);
  mocks.cancel.mockResolvedValue(undefined);
  mocks.publish.mockResolvedValue(undefined);
  mocks.transaction.mockResolvedValue({ committed: true });
});

describe('online presence setup', () => {
  it('registers disconnect cleanup before announcing the guest is present', async () => {
    const transport = await openFirebaseTransport('guest', 'ABC234');
    expect(mocks.disconnect.mock.invocationCallOrder[0]).toBeLessThan(mocks.publish.mock.invocationCallOrder[0]);
    expect(mocks.publish).toHaveBeenCalledWith('coop/host-account/presence/guest', true);
    await transport.close();
  });

  it('rejects a failed registration and releases only the failed guest reservation', async () => {
    mocks.disconnect.mockRejectedValueOnce(new Error('permission_denied'));
    await expect(openFirebaseTransport('guest', 'ABC234')).rejects.toThrow(/no te deja entrar/);
    expect(mocks.publish).not.toHaveBeenCalled();
    const [path, release] = mocks.transaction.mock.calls[1];
    expect(path).toBe('coop/host-account/meta/guestUid');
    expect(release('guest-account')).toBeNull();
    expect(release('another-account')).toBeUndefined();
    expect(mocks.cancel).toHaveBeenCalledOnce();
  });
});
