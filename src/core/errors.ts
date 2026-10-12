/** Controlled error handling: log, show a gentle notice, keep the game running. */
let shown = 0;

function notify(msg: string) {
  if (Date.now() - shown < 8000) return;
  shown = Date.now();
  const el = document.createElement('div');
  el.className = 'toast';
  el.style.cssText = 'position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:999';
  el.textContent = msg;
  document.body.append(el);
  setTimeout(() => el.remove(), 4000);
}

export function installErrorGuard() {
  window.addEventListener('error', (e) => {
    console.error('[error]', e.error ?? e.message);
    notify('Algo raro pasó, pero tu partida está a salvo.');
  });
  window.addEventListener('unhandledrejection', (e) => {
    console.error('[promise]', e.reason);
    notify('Algo raro pasó, pero tu partida está a salvo.');
  });
}
