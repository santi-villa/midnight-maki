import { settings, updateSettings } from '../core/settings';
import { game } from '../core/state';
import { resetAutoPerf } from '../core/perf';
import { exportSave, importSaveFile, saveCode, saveFromCode, saveGame, shareSave } from '../persistence/storage';
import { h, panel, toast } from './dom';

export function openSettings(inGame: boolean) {
  const slider = (label: string, key: 'music' | 'ambience' | 'sfx') =>
    h(
      'div',
      { class: 'opt-row' },
      h('label', null, label),
      h('input', { type: 'range', min: '0', max: '1', step: '0.05', value: String(settings[key]), oninput: (e: Event) => updateSettings({ [key]: +(e.target as HTMLInputElement).value } as any) }),
    );
  const toggle = (label: string, key: 'reduceMotion' | 'joystick' | 'guide', hint: string) => {
    const b = h('button', { class: 'btn small ' + (settings[key] ? 'sage' : ''), onclick: () => { updateSettings({ [key]: !settings[key] } as any); b.className = 'btn small ' + (settings[key] ? 'sage' : ''); b.textContent = settings[key] ? 'Sí' : 'No'; } }, settings[key] ? 'Sí' : 'No');
    return h('div', { class: 'opt-row' }, h('div', null, h('b', null, label), h('div', { class: 'hint' }, hint)), b);
  };
  const choice = <T extends string | number>(label: string, opts: [T, string][], get: () => T, set: (v: T) => void) => {
    const wrap = h('div', { class: 'row', style: { flexWrap: 'wrap', justifyContent: 'flex-end' } });
    const draw = () => {
      wrap.innerHTML = '';
      for (const [v, name] of opts) wrap.append(h('button', { class: 'btn small ' + (get() === v ? 'primary' : ''), onclick: () => { set(v); draw(); } }, name));
    };
    draw();
    return h('div', { class: 'opt-row' }, h('label', null, label), wrap);
  };
  const imp = h('input', { type: 'file', accept: 'application/json,.json', style: { display: 'none' } }) as HTMLInputElement;
  imp.addEventListener('change', async () => {
    const f = imp.files?.[0];
    if (!f) return;
    try {
      const s = await importSaveFile(f);
      game.load(s);
      await saveGame('import');
      toast('Partida importada. Recargando…');
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
        game.load(s);
        await saveGame('import');
        toast('Partida restaurada. Recargando…');
        setTimeout(() => location.reload(), 800);
      } catch (err: any) {
        toast(err?.message ?? 'No se pudo leer el código.');
      }
    },
  }, 'Restaurar desde el código');
  const body = h(
    'div',
    { class: 'col' },
    h('h3', null, 'Sonido'),
    slider('Música', 'music'),
    slider('Ambiente', 'ambience'),
    slider('Efectos', 'sfx'),
    h('h3', null, 'Lectura'),
    choice('Tamaño de texto', [[0.9, 'Chico'], [1, 'Normal'], [1.15, 'Grande'], [1.3, 'Enorme']], () => settings.textScale, (v) => updateSettings({ textScale: v })),
    choice('Velocidad del texto', [[25, 'Lenta'], [45, 'Normal'], [90, 'Rápida'], [0, 'Instantánea']], () => settings.textSpeed, (v) => updateSettings({ textSpeed: v })),
    h('h3', null, 'Juego'),
    choice('Cocina', [['relaxed', 'Relajado'], ['normal', 'Normal'], ['challenge', 'Desafío']], () => settings.cookMode, (v) => updateSettings({ cookMode: v })),
    toggle('Reducir movimiento', 'reduceMotion', 'Menos partículas y animaciones de fondo.'),
    toggle('Joystick virtual', 'joystick', 'Además de tocar el suelo para caminar.'),
    choice<'auto' | 'high' | 'low'>('Efectos', [['auto', 'Automático'], ['high', 'Lindos'], ['low', 'Ahorro de batería']], () => settings.perf ?? 'auto', (v) => { if (v === 'auto') resetAutoPerf(); updateSettings({ perf: v }); }),
    toggle('Flecha de objetivo', 'guide', 'Una flechita dorada señala hacia dónde ir en la misión actual.'),
    inGame
      ? h(
          'div',
          { class: 'col' },
          h('h3', null, 'Partida'),
          h('p', { class: 'hint' }, 'El juego guarda solo en este celu. Hacé una copia de vez en cuando por si se borran los datos del navegador o cambiás de teléfono.'),
          h('div', { class: 'row', style: { flexWrap: 'wrap' } }, h('button', { class: 'btn small', onclick: () => { saveGame('manual').then(() => toast('Partida guardada.')); } }, 'Guardar ahora')),
          h('h3', null, 'Copia de seguridad'),
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
        )
      : null,
  );
  panel({ title: 'Ajustes', body });
}
