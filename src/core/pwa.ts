/** Registers the service worker in production builds (offline play after first load). */
export function registerSW() {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err) => console.warn('[pwa] sw failed', err));
  });
}
