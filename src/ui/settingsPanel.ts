import { settings, updateSettings } from '../core/settings';
import { game } from '../core/state';
import type { SaveData } from '../core/types';
import { resetAutoPerf } from '../core/perf';
import { ACTION_LABEL, EDITABLE_ACTIONS, bindingConflict, bindingMap, keyLabel, sanitizeBindings, type GameAction } from '../input/bindings';
import { armKeyCapture } from '../input/keys';
import { activeSlot, clearManual, exportSave, importSaveFile, markResumeOnce, saveCode, saveFromCode, saveGame, saveManual, shareSave } from '../persistence/storage';
import { h, panel, toast } from './dom';
import { section, seg, setting, switchEl } from './kit';
import { haptic, supportsHaptics } from '../core/haptics';

export function openSettings(inGame: boolean) {
  const slider = (label: string, key: 'music' | 'ambience' | 'sfx') => {
    const val = h('span', { class: 'val' }, Math.round(settings[key] * 100) + '%');
    const input = h('input', { type: 'range', min: '0', max: '1', step: '0.05', value: String(settings[key]), 'aria-label': label, oninput: (e: Event) => { const v = +(e.target as HTMLInputElement).value; updateSettings({ [key]: v } as any); val.textContent = Math.round(v * 100) + '%'; } });
    return setting(label, '', h('div', { class: 'row', style: { gap: '4px', flexWrap: 'nowrap' } }, input, val), false);
  };
  const toggle = (label: string, key: 'reduceMotion' | 'joystick' | 'guide' | 'haptics', hint: string) => {
    const row = setting(label, hint, switchEl(() => !!settings[key], (v) => { updateSettings({ [key]: v } as any); if (key === 'haptics' && v) haptic('reward'); }, label));
    row.classList.add('inline');
    return row;
  };
  const choice = <T extends string | number>(label: string, opts: [T, string][], get: () => T, set: (v: T) => void, hint = '') =>
    setting(label, hint, seg(opts, get, set, label), true);
  async function restore(s: SaveData): Promise<boolean> {
    const previous = game.save;
    const wasDirty = game.dirty;
    game.load(s);
    if (!(await saveGame('import'))) {
      game.load(previous);
      game.dirty = wasDirty;
      return false;
    }
    await clearManual(activeSlot());
    // Pagehide must not replace the imported coordinates with the old world's position.
    const { stopAutosave } = await import('../core/flow');
    stopAutosave();
    return true;
  }
  const imp = h('input', { type: 'file', accept: 'application/json,.json', style: { display: 'none' } }) as HTMLInputElement;
  imp.addEventListener('change', async () => {
    const f = imp.files?.[0];
    if (!f) return;
    try {
      const s = await importSaveFile(f);
      if (!(await restore(s))) return;
      toast('Partida importada. Recargando…');
      markResumeOnce();
      setTimeout(() => location.reload(), 800);
    } catch (err: any) {
      toast(err?.message ?? 'No se pudo importar.');
    }
  });
  const codeBox = h('textarea', { rows: '3', placeholder: 'Pegá acá el código (empieza con MM1:)', style: { display: 'none', width: '100%', fontSize: '.75em', userSelect: 'text', WebkitUserSelect: 'text' } }) as HTMLTextAreaElement;
  const restoreBtn = h('button', {
    class: 'btn small rose', style: { display: 'none' }, onclick: async () => {
      try {
        const s = saveFromCode(codeBox.value);
        if (!(await restore(s))) return;
        toast('Partida restaurada. Recargando…');
        markResumeOnce();
        setTimeout(() => location.reload(), 800);
      } catch (err: any) {
        toast(err?.message ?? 'No se pudo leer el código.');
      }
    },
  }, 'Restaurar desde el código');
  const body = h(
    'div',
    { class: 'col' },
    section('Sonido', 'lantern', slider('Música', 'music'), slider('Ambiente', 'ambience'), slider('Efectos', 'sfx')),
    section('Lectura', 'scroll',
      choice('Tamaño de texto', [[0.9, 'Chico'], [1, 'Normal'], [1.15, 'Grande'], [1.3, 'Enorme']], () => settings.textScale, (v) => updateSettings({ textScale: v })),
      choice('Velocidad del texto', [[25, 'Lenta'], [45, 'Normal'], [90, 'Rápida'], [0, 'Instantánea']], () => settings.textSpeed, (v) => updateSettings({ textSpeed: v }))),
    section('Juego', 'gear',
      choice('Cocina', [['relaxed', 'Relajado'], ['normal', 'Normal'], ['challenge', 'Difícil (con reloj)']], () => settings.cookMode, (v) => {
        updateSettings({ cookMode: v });
        if (game.loaded) game.setFlag('play_difficulty', v);
      }),
      sleepHoursSetting(),
      choice('Cómo cocinar', [['act', 'En el restaurante'], ['board', 'Tablero de gestos (clásico)']], () => settings.cookStyle ?? 'act', (v) => updateSettings({ cookStyle: v })),
      toggle('Flecha de objetivo', 'guide', 'Una flechita dorada señala hacia dónde ir en la misión actual.'),
      toggle('Joystick virtual', 'joystick', 'Aparece al usar el dedo, además de tocar el suelo para caminar.'),
      choice<string>('Atajo del NoriPhone (teclado)', [['p', 'P'], ['n', 'N'], ['t', 'T']], () => settings.phoneKey ?? 'p', (v) => updateSettings({ phoneKey: v }))),
    section('Pantalla y comodidad', 'phone',
      choice<'normal' | 'dark'>('Noche', [['normal', 'Normal'], ['dark', 'Oscura']], () => settings.nightBrightness ?? 'normal', (v) => updateSettings({ nightBrightness: v }), 'Brillo del exterior por la noche. Sofi conserva una luz tenue para orientarte.'),
      choice<'auto' | 'high' | 'low'>('Efectos visuales', [['auto', 'Automático'], ['high', 'Lindos'], ['low', 'Ahorro de batería']], () => settings.perf ?? 'auto', (v) => { if (v === 'auto') resetAutoPerf(); updateSettings({ perf: v }); }),
      toggle('Reducir movimiento', 'reduceMotion', 'Menos partículas y animaciones de fondo.'),
      toggle('Vibración', 'haptics', supportsHaptics() ? 'Toques breves en momentos especiales. El dispositivo puede limitar la vibración.' : 'Este navegador no ofrece vibración. Tu preferencia se guarda para dispositivos compatibles.')),
    controlsSection(),
    inGame
      ? section('Partida y copias de seguridad', 'scroll',
          h('div', { class: 'col', style: { padding: '6px 0' } },
          h('p', { class: 'hint' }, `Estás en la partida ${activeSlot() + 1} de 3. El progreso se guarda solo en este dispositivo. Guardar ahora deja un punto fijo de esta partida. Conviene hacer una copia por si se borran los datos del navegador o cambiás de teléfono.`),
          h('div', { class: 'row', style: { flexWrap: 'wrap' } }, h('button', { class: 'btn small', onclick: async () => { const { syncPlayerPos } = await import('../core/flow'); syncPlayerPos(); if (await saveManual()) toast(`Partida ${activeSlot() + 1} guardada a mano.`); } }, 'Guardar ahora')),
          h('b', null, 'Copia de seguridad'),
          h('div', { class: 'row', style: { flexWrap: 'wrap' } },
            h('button', { class: 'btn small primary', onclick: async () => { await saveGame('manual'); const r = await shareSave(); if (r === 'shared') toast('¡Copia enviada!'); else if (r === 'downloaded') toast('Se descargó el archivo de tu partida.'); } }, 'Compartir copia'),
            h('button', { class: 'btn small', onclick: () => exportSave() }, 'Descargar archivo'),
            h('button', { class: 'btn small', onclick: () => imp.click() }, 'Abrir archivo'),
            imp),
          h('div', { class: 'row', style: { flexWrap: 'wrap' } },
            h('button', { class: 'btn small', onclick: async () => { await saveGame('manual'); const code = saveCode(); try { await navigator.clipboard.writeText(code); toast('Código copiado. Pegalo en tus notas o en un chat.'); } catch { codeBox.value = code; codeBox.style.display = ''; codeBox.select(); toast('Copiá el código de la caja.'); } } }, 'Copiar código'),
            h('button', { class: 'btn small', onclick: () => { codeBox.value = ''; codeBox.style.display = ''; codeBox.focus(); restoreBtn.style.display = ''; } }, 'Pegar código')),
          codeBox,
          restoreBtn,
        ))
      : null,
  );
  panel({ title: 'Ajustes', body });
}

function sleepHoursSetting() {
  const saved = Math.max(4, Math.min(10, Math.round(settings.sleepHours ?? 8)));
  const val = h('span', { class: 'val' }, `${saved} h`);
  const input = h('input', {
    type: 'range', min: '4', max: '10', step: '1', value: String(saved), 'aria-label': 'Horas de sueño',
    oninput: (e: Event) => {
      const v = Math.max(4, Math.min(10, Math.round(Number((e.target as HTMLInputElement).value))));
      updateSettings({ sleepHours: v });
      val.textContent = `${v} h`;
    },
  });
  return setting('Horas de sueño', 'Cuántas horas propone la cama. Podés cambiarlas antes de dormir.', h('div', { class: 'row', style: { gap: '4px', flexWrap: 'nowrap' } }, input, val), false);
}

function controlsSection() {
  const host = h('div', { class: 'col' });
  const status = h('p', { class: 'hint' }, 'WASD y las flechas mueven. Elegí Cambiar y presioná la tecla nueva.');
  let disarm = () => {};

  function draw() {
    disarm();
    disarm = () => {};
    const map = bindingMap(settings.bindings);
    const list = h('div', { class: 'col', style: { gap: '0' } });
    list.append(setting('Movimiento', '', h('span', { class: 'chip' }, 'WASD y flechas')));
    list.append(setting('Cerrar', '', h('span', { class: 'chip' }, 'Esc')));
    for (const action of EDITABLE_ACTIONS) {
      const change = h('button', {
        type: 'button',
        class: 'btn small',
        'aria-label': `${ACTION_LABEL[action]}: ${keyLabel(map[action])}. Cambiar`,
        onclick: () => listen(action, change),
      }, keyLabel(map[action]));
      list.append(setting(ACTION_LABEL[action], '', change));
    }
    const restore = h('button', {
      type: 'button',
      class: 'btn small',
      onclick: () => {
        disarm();
        updateSettings({ bindings: undefined });
        status.textContent = 'Controles restaurados.';
        draw();
      },
    }, 'Restaurar controles');
    host.replaceChildren(section('Controles', 'act', status, list, h('div', { style: { padding: '6px 0' } }, restore)));
  }

  function listen(action: GameAction, button: HTMLButtonElement) {
    disarm();
    button.classList.add('binding-wait');
    button.textContent = '…';
    status.textContent = `Presioná una tecla para ${ACTION_LABEL[action]}. Escape cancela.`;
    disarm = armKeyCapture((press) => {
      if (press.repeat || press.ctrl || press.meta || press.alt) return 'again';
      if (press.code === 'Escape') {
        status.textContent = 'Sin cambios.';
        draw();
        return 'done';
      }
      const map = bindingMap(settings.bindings);
      const conflict = bindingConflict(map, action, press.code);
      if (conflict) {
        status.textContent = `${keyLabel(press.code)} ya se usa para ${conflict}.`;
        button.textContent = '…';
        return 'again';
      }
      updateSettings({ bindings: sanitizeBindings({ ...settings.bindings, [action]: press.code }) });
      status.textContent = `${ACTION_LABEL[action]}: ${keyLabel(press.code)}.`;
      draw();
      return 'done';
    });
  }

  draw();
  return host;
}
