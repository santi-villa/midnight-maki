import { settings, updateSettings } from '../core/settings';
import { game } from '../core/state';
import { exportSave, importSaveFile, saveGame } from '../persistence/storage';
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
    toggle('Flecha de objetivo', 'guide', 'Una flechita dorada señala hacia dónde ir en la misión actual.'),
    inGame
      ? h(
          'div',
          { class: 'col' },
          h('h3', null, 'Partida'),
          h('p', { class: 'hint' }, 'El juego guarda solo. Podés exportar tu partida para pasarla a otro dispositivo.'),
          h('div', { class: 'row', style: { flexWrap: 'wrap' } }, h('button', { class: 'btn small', onclick: () => { saveGame('manual').then(() => toast('Partida guardada.')); } }, 'Guardar ahora'), h('button', { class: 'btn small', onclick: () => exportSave() }, 'Exportar'), h('button', { class: 'btn small', onclick: () => imp.click() }, 'Importar'), imp),
        )
      : null,
  );
  panel({ title: 'Ajustes', body });
}
