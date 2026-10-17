import type { SaveData } from '../core/types';

export interface CloudUser { uid: string; name: string; email: string; via: 'google' | 'email' | 'other' }

export interface RemoteSlot {
  /** updatedAt of the newest snapshot in this slot */
  updatedAt: number;
  auto: SaveData | null;
  manual: SaveData | null;
}

/** What the game needs from a backend. Firebase is the first one; another one only has to fill this in. */
export interface CloudProvider {
  /** resolves once the stored session (if any) has been restored */
  init(onUser: (u: CloudUser | null) => void): Promise<void>;
  signInGoogle(): Promise<void>;
  signInEmail(email: string, password: string): Promise<void>;
  signUpEmail(email: string, password: string, name: string): Promise<void>;
  resetPassword(email: string): Promise<void>;
  signOut(): Promise<void>;
  /** removes the cloud saves and the account itself */
  deleteAccount(): Promise<void>;
  getSlot(slot: number): Promise<RemoteSlot | null>;
  putSlot(slot: number, data: { auto: SaveData | null; manual: SaveData | null }): Promise<number>;
}

export class CloudError extends Error {}
