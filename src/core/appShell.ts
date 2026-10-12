/**
 * Makes the game behave like an app, not a web page:
 * - no pinch / double-tap / ctrl+wheel zoom, no long-press menus or text selection
 * - the back button/gesture never leaves the game: it closes the open window or opens the menu
 * - on Android (Capacitor) the status bar is hidden and the hardware back button is handled
 */
import { Capacitor } from '@capacitor/core';

let backHandler: () => void = () => {};

/** what "back" does: set by the UI once the game is running */
export function onBack(fn: () => void) {
  backHandler = fn;
}

export function installAppShell() {
  // ---- zoom & browser gestures
  const stop = (e: Event) => e.preventDefault();
  document.addEventListener('gesturestart', stop, { passive: false } as any);
  document.addEventListener('gesturechange', stop, { passive: false } as any);
  document.addEventListener('touchmove', (e) => {
    if ((e as TouchEvent).touches.length > 1) e.preventDefault();
  }, { passive: false });
  // double-tap zoom is disabled by `touch-action: none/manipulation` in CSS (no JS needed,
  // so quick repeated taps on buttons keep working)
  window.addEventListener('wheel', (e) => {
    if (e.ctrlKey) e.preventDefault();
  }, { passive: false });
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && ['+', '-', '=', '0'].includes(e.key)) e.preventDefault();
  });
  document.addEventListener('contextmenu', (e) => {
    if (!(e.target as HTMLElement)?.closest('input, textarea')) e.preventDefault();
  });

  // ---- back button / swipe-back on the web: trap history so the page never navigates away
  history.pushState({ mm: 1 }, '');
  window.addEventListener('popstate', () => {
    history.pushState({ mm: 1 }, '');
    backHandler();
  });

  // ---- native Android shell
  if (Capacitor.isNativePlatform()) {
    import('@capacitor/app').then(({ App }) => {
      App.addListener('backButton', () => backHandler());
    });
    import('@capacitor/status-bar').then(({ StatusBar }) => {
      StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {});
      StatusBar.hide().catch(() => {});
    });
  }
}
