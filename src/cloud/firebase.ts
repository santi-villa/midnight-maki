/** Firebase backend: Google and e-mail sign-in, one Firestore document per slot. Loaded only when the app has a Firebase config. */
import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  GoogleAuthProvider, browserLocalPersistence, createUserWithEmailAndPassword, deleteUser, getAuth, getRedirectResult, onAuthStateChanged,
  reauthenticateWithPopup, sendPasswordResetEmail, setPersistence, signInWithEmailAndPassword, signInWithPopup, signInWithRedirect, signOut, updateProfile, type Auth, type User,
} from 'firebase/auth';
import { deleteDoc, doc, getDoc, getFirestore, setDoc, type Firestore } from 'firebase/firestore';
import { SAVE_VERSION } from '../core/state';
import type { SaveData } from '../core/types';
import { CloudError, type CloudProvider, type CloudUser, type RemoteSlot } from './types';

export interface FirebaseConfig { apiKey: string; authDomain: string; projectId: string; appId: string }

export function firebaseConfigFromEnv(): FirebaseConfig | null {
  const e = import.meta.env;
  const c = { apiKey: e.VITE_FIREBASE_API_KEY, authDomain: e.VITE_FIREBASE_AUTH_DOMAIN, projectId: e.VITE_FIREBASE_PROJECT_ID, appId: e.VITE_FIREBASE_APP_ID } as Partial<FirebaseConfig>;
  return c.apiKey && c.authDomain && c.projectId && c.appId ? (c as FirebaseConfig) : null;
}

const MESSAGES: Record<string, string> = {
  'auth/invalid-email': 'Ese correo no parece válido.',
  'auth/missing-password': 'Escribí tu contraseña.',
  'auth/weak-password': 'La contraseña es muy corta: usá al menos 6 caracteres.',
  'auth/email-already-in-use': 'Ya hay una cuenta con ese correo. Probá ingresar.',
  'auth/invalid-credential': 'Correo o contraseña incorrectos.',
  'auth/wrong-password': 'Correo o contraseña incorrectos.',
  'auth/user-not-found': 'Correo o contraseña incorrectos.',
  'auth/too-many-requests': 'Demasiados intentos. Esperá un rato y probá de nuevo.',
  'auth/network-request-failed': 'No hay conexión. Probá de nuevo cuando vuelva.',
  'auth/popup-closed-by-user': 'Cerraste la ventana de Google antes de terminar.',
  'auth/cancelled-popup-request': 'Cerraste la ventana de Google antes de terminar.',
  'auth/requires-recent-login': 'Por seguridad, volvé a ingresar y repetí la acción.',
};
function friendly(err: unknown): CloudError {
  const code = (err as { code?: string })?.code ?? '';
  return new CloudError(MESSAGES[code] ?? 'No se pudo completar. Probá de nuevo en un momento.');
}

// saves are text: gzip + base64 keeps each slot far below the 1 MB document limit
async function pack(data: SaveData | null): Promise<string | null> {
  if (!data) return null;
  const json = JSON.stringify(data);
  if (typeof CompressionStream === 'undefined') return 'j:' + json;
  const stream = new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return 'z:' + btoa(bin);
}
async function unpack(text: unknown): Promise<unknown | null> {
  if (typeof text !== 'string' || !text) return null;
  if (text.startsWith('j:')) return JSON.parse(text.slice(2));
  if (!text.startsWith('z:')) return null;
  const bin = atob(text.slice(2));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return JSON.parse(await new Response(stream).text());
}

export function createFirebaseProvider(config: FirebaseConfig): CloudProvider {
  const app: FirebaseApp = initializeApp(config);
  const auth: Auth = getAuth(app);
  const db: Firestore = getFirestore(app);
  const toUser = (u: User): CloudUser => ({ uid: u.uid, name: u.displayName || u.email?.split('@')[0] || 'Jugador', email: u.email ?? '', via: u.providerData[0]?.providerId === 'google.com' ? 'google' : u.providerData[0]?.providerId === 'password' ? 'email' : 'other' });
  const slotRef = (slot: number) => {
    const u = auth.currentUser;
    if (!u) throw new CloudError('Primero ingresá a tu cuenta.');
    return doc(db, 'users', u.uid, 'slots', String(slot));
  };
  return {
    async init(onUser) {
      await setPersistence(auth, browserLocalPersistence).catch(() => undefined);
      await getRedirectResult(auth).catch(() => null);
      await new Promise<void>((resolve) => {
        let first = true;
        onAuthStateChanged(auth, (u) => { onUser(u ? toUser(u) : null); if (first) { first = false; resolve(); } });
      });
    },
    async signInGoogle() {
      const provider = new GoogleAuthProvider();
      try { await signInWithPopup(auth, provider); }
      catch (err) {
        if ((err as { code?: string }).code === 'auth/popup-blocked') { await signInWithRedirect(auth, provider); return; }
        throw friendly(err);
      }
    },
    async signInEmail(email, password) { try { await signInWithEmailAndPassword(auth, email.trim(), password); } catch (err) { throw friendly(err); } },
    async signUpEmail(email, password, name) {
      try {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        if (name.trim()) await updateProfile(cred.user, { displayName: name.trim() });
      } catch (err) { throw friendly(err); }
    },
    async resetPassword(email) { try { await sendPasswordResetEmail(auth, email.trim()); } catch (err) { throw friendly(err); } },
    async signOut() { await signOut(auth); },
    async deleteAccount() {
      const u = auth.currentUser;
      if (!u) return;
      try {
        for (let slot = 0; slot < 3; slot++) await deleteDoc(doc(db, 'users', u.uid, 'slots', String(slot))).catch(() => undefined);
        if (u.providerData[0]?.providerId === 'google.com') await reauthenticateWithPopup(u, new GoogleAuthProvider()).catch(() => undefined);
        await deleteUser(u);
      } catch (err) { throw friendly(err); }
    },
    async getSlot(slot) {
      try {
        const snap = await getDoc(slotRef(slot));
        if (!snap.exists()) return null;
        const d = snap.data();
        return { updatedAt: Number(d.updatedAt) || 0, auto: (await unpack(d.auto)) as SaveData | null, manual: (await unpack(d.manual)) as SaveData | null } satisfies RemoteSlot;
      } catch (err) { throw friendly(err); }
    },
    async putSlot(slot, data) {
      const updatedAt = Math.max(data.auto?.updatedAt ?? 0, data.manual?.updatedAt ?? 0);
      try {
        await setDoc(slotRef(slot), { updatedAt, auto: await pack(data.auto), manual: await pack(data.manual), v: SAVE_VERSION, at: Date.now() });
        return updatedAt;
      } catch (err) { throw friendly(err); }
    },
  };
}

