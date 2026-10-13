/** Bounded, local diagnostics. Never log save contents, arbitrary rejection values or URLs. */
export interface ErrorReport {
  time: number;
  operation: string;
  name: string;
  frames: string[];
}
const reports: ErrorReport[] = [];
let shown = -Infinity;
let installed = false;
const ERROR_NAMES = new Set(['Error', 'TypeError', 'RangeError', 'ReferenceError', 'SyntaxError',
  'NotAllowedError', 'NotSupportedError', 'AbortError', 'QuotaExceededError', 'InvalidStateError',
  'DataCloneError', 'IndexSizeError', 'SecurityError', 'UnknownError', 'TransactionInactiveError', 'SaveError']);

function notify(msg: string) {
  if (typeof document === 'undefined' || !document.body || Date.now() - shown < 8000) return;
  shown = Date.now();
  const el = document.createElement('div');
  el.className = 'toast';
  el.style.cssText = 'position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:999';
  el.textContent = msg;
  document.body.append(el);
  setTimeout(() => el.remove(), 4000);
}

export function errorReports(): ErrorReport[] {
  return reports.map((r) => ({ ...r, frames: [...r.frames] }));
}

export function reportError(operation: string, err: unknown, notice: string | false = 'Algo raro pasó. Intentá de nuevo; si sigue pasando, recargá el juego.') {
  const error = err instanceof Error ? err : null;
  const frames = (error?.stack ?? '').split('\n').slice(1).flatMap((line) => {
    const frame = line.replace(/\?[^)\s]*?(?=:\d+:\d+(?:\)|$))/g, '').match(/\/(?:src|assets)\/[\w./-]+(?::\d+){2}/);
    return frame ? [frame[0]] : [];
  }).slice(0, 6);
  const report: ErrorReport = {
    time: Date.now(),
    operation: /^[\w:.-]{1,80}$/.test(operation) ? operation : 'unknown',
    name: error && ERROR_NAMES.has(error.name) ? error.name : 'Error',
    frames,
  };
  reports.push(report);
  if (reports.length > 20) reports.shift();
  console.error('[midnight-maki]', report);
  if (notice) notify(notice);
}

/** Handle detached work at the boundary, including synchronous failures. */
export async function runTask<T>(operation: string, action: () => T | PromiseLike<T>, notice?: string | false): Promise<T | undefined> {
  try {
    return await action();
  } catch (err) {
    reportError(operation, err, notice);
    return undefined;
  }
}

export function installErrorGuard() {
  if (installed) return;
  installed = true;
  window.addEventListener('error', (e) => reportError('global:error', e.error ?? new Error(e.message)));
  window.addEventListener('unhandledrejection', (e) => reportError('global:promise', e.reason));
}
