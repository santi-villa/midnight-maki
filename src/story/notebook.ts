/** Investigation notebook: browse clues, connect two of them, choose a conclusion, progressive hints. */
import { audio } from '../audio/audio';
import { game } from '../core/state';
import { h, toast } from '../ui/dom';
import { CLUE_BY_ID, DEDUCTIONS, type Deduction } from './clues';

const KIND_ICON: Record<string, string> = { carta: '✉', foto: '▣', testimonio: '❝', objeto: '◆', lugar: '⌂', 'contradicción': '⚡', 'hipótesis': '?' };

export function notebookView(): HTMLElement {
  const wrap = h('div', { class: 'col' });
  const clues = game.save.story.clues.map((id) => CLUE_BY_ID[id]).filter(Boolean);
  const open = DEDUCTIONS.filter((d) => !game.has(d.solvedFlag) && d.pair.every((c) => game.save.story.clues.includes(c)));
  const solved = DEDUCTIONS.filter((d) => game.has(d.solvedFlag));
  if (!clues.length) {
    wrap.append(h('p', { class: 'muted' }, 'Todavía no anotaste ninguna pista. Rigg dice: "Todo lo raro va al diario".'));
    return wrap;
  }
  if (open.length) {
    const d = open[0];
    wrap.append(h('div', { class: 'card col', style: { borderColor: '#f2c66d' } }, h('b', null, 'Pregunta abierta'), h('div', null, d.question), h('button', { class: 'btn primary', onclick: () => connectMode(wrap, d) }, 'Conectar pistas')));
  }
  for (const d of solved) {
    wrap.append(h('div', { class: 'card', style: { background: '#e8f0e0' } }, h('b', null, '✓ ' + d.question), h('div', { class: 'hint' }, d.conclusions[d.correct])));
  }
  const byCh = new Map<number, typeof clues>();
  for (const c of clues) byCh.set(c.chapter, [...(byCh.get(c.chapter) ?? []), c]);
  for (const [ch, list] of [...byCh.entries()].sort((a, b) => a[0] - b[0])) {
    wrap.append(h('h3', null, ch === 0 ? 'Prólogo' : `Capítulo ${ch}`));
    for (const c of list) wrap.append(h('div', { class: 'card' }, h('div', null, h('span', { style: { marginRight: '6px' } }, KIND_ICON[c.kind] ?? '•'), h('b', null, c.title), h('span', { class: 'pill', style: { marginLeft: '6px' } }, c.kind)), h('p', { style: { margin: '6px 0 0', lineHeight: '1.35' } }, c.text)));
  }
  return wrap;
}

function connectMode(container: HTMLElement, d: Deduction) {
  container.innerHTML = '';
  const sel: string[] = [];
  const hintBox = h('div', { class: 'hint' });
  const hintLevel = Number(game.flag('hint_' + d.id) ?? 0);
  let level = hintLevel;
  const showHints = () => {
    hintBox.innerHTML = '';
    for (let i = 0; i < level; i++) hintBox.append(h('div', null, `Pista ${i + 1}: ${d.hints[i]}`));
  };
  showHints();
  const list = h('div', { class: 'col' });
  const render = () => {
    list.innerHTML = '';
    for (const id of game.save.story.clues) {
      const c = CLUE_BY_ID[id];
      if (!c) continue;
      list.append(h('button', { class: 'card', style: { textAlign: 'left', borderColor: sel.includes(id) ? '#f2c66d' : undefined, background: sel.includes(id) ? '#fff2cc' : undefined }, onclick: () => { const i = sel.indexOf(id); if (i >= 0) sel.splice(i, 1); else { if (sel.length >= 2) sel.shift(); sel.push(id); } audio.sfxPlay('tap'); render(); } }, h('b', null, `${KIND_ICON[c.kind] ?? '•'} ${c.title}`), h('div', { class: 'hint' }, c.text)));
    }
  };
  render();
  container.append(
    h('div', { class: 'card col', style: { borderColor: '#f2c66d' } },
      h('b', null, d.question),
      h('div', { class: 'hint' }, 'Elegí dos pistas que se relacionen.'),
      h('div', { class: 'row', style: { flexWrap: 'wrap' } },
        h('button', { class: 'btn primary', onclick: () => {
          if (sel.length !== 2) return toast('Elegí dos pistas.');
          const ok = d.pair.every((p) => sel.includes(p));
          if (!ok) {
            audio.sfxPlay('error');
            toast('Mmm... esas dos no parecen conectarse. Probá otra combinación.');
            return;
          }
          audio.sfxPlay('clue');
          conclude(container, d);
        } }, 'Conectar'),
        h('button', { class: 'btn small', onclick: () => { if (level < 3) { level++; game.setFlag('hint_' + d.id, level); showHints(); } } }, 'Pedir una pista'),
      ),
      hintBox,
    ),
    list,
  );
}

function conclude(container: HTMLElement, d: Deduction) {
  container.innerHTML = '';
  container.append(h('div', { class: 'card col' }, h('b', null, '¡Las pistas encajan! ¿Cuál es la conclusión?'), ...d.conclusions.map((c, i) => h('button', { class: 'btn', style: { textAlign: 'left' }, onclick: () => {
    if (i !== d.correct) {
      audio.sfxPlay('error');
      toast('No del todo... pensalo de nuevo.');
      return;
    }
    audio.sfxPlay('success');
    game.setFlag(d.solvedFlag);
    game.stat('deductions');
    toast('¡Deducción correcta!');
    container.innerHTML = '';
    container.append(notebookView());
  } }, c))));
}
