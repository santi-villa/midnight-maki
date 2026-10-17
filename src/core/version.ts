/** Which build is running. The values are fixed when the game is built (see vite.config.ts). */
declare const __APP_VERSION__: string;
declare const __APP_COMMIT__: string;
declare const __APP_BUILT__: number;

const safe = <T>(read: () => T, fallback: T): T => { try { return read(); } catch { return fallback; } };

export const APP_VERSION = safe(() => __APP_VERSION__, 'dev');
export const APP_COMMIT = safe(() => __APP_COMMIT__, 'dev');
export const APP_BUILT = safe(() => __APP_BUILT__, 0);

/** "v0.5.0 · a1b2c3d · 17 oct, 02:45": small enough for a corner, enough to tell two builds apart. */
export function versionLabel(): string {
  const when = APP_BUILT ? new Date(APP_BUILT).toLocaleString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }) : '';
  return ['v' + APP_VERSION, APP_COMMIT, when].filter(Boolean).join(' · ');
}
