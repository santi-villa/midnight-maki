/** Story puzzles with progressive hints: station clock, forest stump sequence, lighthouse stars. */
import { iconCanvas } from '../art/icons';
import { audio } from '../audio/audio';
import { game } from '../core/state';
import { obtain } from '../systems/collect';
import { h, toast } from '../ui/dom';
import { boardPos, shell } from './common';

function hintButton(sh: { buttons: HTMLElement; info: HTMLElement }, key: string, hints: string[]) {
  let lvl = Number(game.flag('ph_' + key) ?? 0);
  const box = h('div', { class: 'hint', style: { textAlign: 'center' } });
  const show = () => (box.innerHTML = hints.slice(0, lvl).map((t, i) => `Pista ${i + 1}: ${t}`).join('<br>'));
  show();
  sh.buttons.append(h('button', { class: 'btn small', onclick: () => { if (lvl < hints.length) { lvl++; game.setFlag('ph_' + key, lvl); show(); } } }, 'Pista'));
  sh.info.after(box);
}

// ------------------------------------------------------------------ clock
export function clockPuzzle(): Promise<boolean> {
  return new Promise((resolve) => {
    let hour = 4;
    let minute = 6; // in 5-minute steps (0..11)
    let done = false;
    const sh = shell('Reloj detenido', 100, 100, 2, () => finish(false));
    const draw = () => {
      const g = sh.g;
      g.fillStyle = '#5d5864';
      g.fillRect(0, 0, 100, 100);
      g.fillStyle = '#f6ecd6';
      g.beginPath();
      g.arc(50, 50, 40, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#2a2230';
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
        g.fillRect(50 + Math.cos(a) * 34 - 1, 50 + Math.sin(a) * 34 - 1, 2, 2);
      }
      const ha = ((hour % 12) / 12 + minute / 144) * Math.PI * 2 - Math.PI / 2;
      const ma = (minute / 12) * Math.PI * 2 - Math.PI / 2;
      g.strokeStyle = '#2a2230';
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(50, 50);
      g.lineTo(50 + Math.cos(ha) * 20, 50 + Math.sin(ha) * 20);
      g.stroke();
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(50, 50);
      g.lineTo(50 + Math.cos(ma) * 32, 50 + Math.sin(ma) * 32);
      g.stroke();
      sh.info.textContent = `${hour}:${String(minute * 5).padStart(2, '0')}`;
    };
    draw();
    sh.buttons.append(
      h('button', { class: 'btn small', onclick: () => { hour = (hour % 12) + 1; audio.sfxPlay('tap'); draw(); } }, 'Hora +'),
      h('button', { class: 'btn small', onclick: () => { minute = (minute + 1) % 12; audio.sfxPlay('tap'); draw(); } }, 'Minutos +'),
      h('button', { class: 'btn small primary', onclick: () => {
        if (hour === 10 && minute === 2) {
          audio.sfxPlay('success');
          finish(true);
        } else {
          audio.sfxPlay('error');
          toast('Nada pasa. Quizás sea otra hora.');
        }
      } }, 'Probar'),
    );
    hintButton(sh, 'clock', ['Rigg habló de una hora importante.', 'Revisá la pista "La hora en que se conocieron".', 'Las diez y diez: 10:10.']);
    function finish(ok: boolean) {
      if (done) return;
      done = true;
      sh.close();
      resolve(ok);
    }
  });
}

// ------------------------------------------------------------------ forest stump (Simon-like, optional secret)
export function stumpPuzzle(): Promise<boolean> {
  return new Promise((resolve) => {
    const symbols = ['☾', '✿', '♨', '★'];
    const colors = ['#b7a8d6', '#e8a0b0', '#e8904a', '#f2c66d'];
    const seq: number[] = [];
    const len = 4;
    for (let i = 0; i < len; i++) seq.push(Math.floor(Math.random() * 4));
    let input: number[] = [];
    let showing = true;
    let done = false;
    const sh = shell('Tocón tallado', 120, 120, 2, () => finish(false));
    const cell = (i: number) => ({ x: (i % 2) * 60, y: Math.floor(i / 2) * 60 });
    const draw = (lit = -1) => {
      const g = sh.g;
      for (let i = 0; i < 4; i++) {
        const c = cell(i);
        g.fillStyle = i === lit ? colors[i] : '#8a5a3c';
        g.fillRect(c.x + 2, c.y + 2, 56, 56);
        g.fillStyle = i === lit ? '#2a2230' : '#e6c79b';
        g.font = '28px serif';
        g.fillText(symbols[i], c.x + 16, c.y + 40);
      }
    };
    draw();
    sh.info.textContent = 'Mirá la secuencia de símbolos y repetila.';
    const play = async () => {
      showing = true;
      for (const s of seq) {
        await new Promise((r) => setTimeout(r, 350));
        draw(s);
        audio.sfxPlay('blip');
        await new Promise((r) => setTimeout(r, 450));
        draw();
      }
      showing = false;
      input = [];
    };
    setTimeout(play, 500);
    sh.canvas.addEventListener('pointerdown', (e) => {
      if (showing) return;
      const p = boardPos(sh.canvas, e);
      const i = (p.x >= 60 ? 1 : 0) + (p.y >= 60 ? 2 : 0);
      draw(i);
      setTimeout(() => draw(), 200);
      audio.sfxPlay('tap');
      input.push(i);
      if (input[input.length - 1] !== seq[input.length - 1]) {
        sh.info.textContent = 'Casi. Mirá de nuevo.';
        setTimeout(play, 600);
      } else if (input.length === seq.length) {
        audio.sfxPlay('success');
        const first = !game.has('stump_solved');
        game.setFlag('stump_solved');
        if (first) {
          obtain('st_amethyst');
          toast('El tocón se abre: ¡una amatista!');
        } else toast('El tocón brilla un momento.');
        finish(true);
      }
    });
    sh.buttons.append(h('button', { class: 'btn small', onclick: () => !showing && play() }, 'Ver de nuevo'));
    function finish(ok: boolean) {
      if (done) return;
      done = true;
      sh.close();
      resolve(ok);
    }
  });
}

// ------------------------------------------------------------------ lighthouse stars
export function starPuzzle(): Promise<boolean> {
  return new Promise((resolve) => {
    // slots engraved: heart (Pip), flame (Spicy), book (Rigg) — in a shuffled order
    const slots = [
      { mark: '♨', want: 'star2' },
      { mark: '♥', want: 'star1' },
      { mark: '✎', want: 'star3' },
    ];
    const placed: (string | null)[] = [null, null, null];
    let selected: string | null = null;
    let done = false;
    const sh = shell('Mecanismo del faro', 150, 90, 2, () => finish(false));
    const stars = ['star1', 'star2', 'star3'];
    const icons: Record<string, HTMLCanvasElement> = {
      star1: iconCanvas({ type: 'star', c1: '#f4c6cf' }),
      star2: iconCanvas({ type: 'star', c1: '#e8904a' }),
      star3: iconCanvas({ type: 'star', c1: '#94c0d2' }),
    };
    const draw = () => {
      const g = sh.g;
      g.fillStyle = '#2c3358';
      g.fillRect(0, 0, 150, 90);
      slots.forEach((s, i) => {
        const x = 20 + i * 45;
        g.fillStyle = '#c9a24a';
        g.beginPath();
        g.arc(x + 12, 34, 16, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#2a2230';
        g.beginPath();
        g.arc(x + 12, 34, 12, 0, Math.PI * 2);
        g.fill();
        if (placed[i]) g.drawImage(icons[placed[i]!], x + 4, 26, 16, 16);
        else {
          g.fillStyle = '#c9a24a';
          g.font = '12px serif';
          g.fillText(s.mark, x + 7, 39);
        }
      });
      g.fillStyle = '#f6ecd6';
      g.font = '8px sans-serif';
      g.fillText(selected ? 'Elegí un hueco' : 'Elegí una estrella abajo', 34, 78);
    };
    draw();
    const tray = h('div', { class: 'row' });
    const renderTray = () => {
      tray.innerHTML = '';
      for (const s of stars) {
        if (placed.includes(s)) continue;
        const c = document.createElement('canvas');
        c.width = 16;
        c.height = 16;
        c.getContext('2d')!.drawImage(icons[s], 0, 0);
        c.style.cssText = 'width:40px;height:40px;image-rendering:pixelated';
        tray.append(h('button', { class: 'slot' + (selected === s ? ' selected' : ''), style: { minHeight: '56px' }, onclick: () => { selected = s; renderTray(); draw(); } }, c));
      }
    };
    renderTray();
    sh.buttons.append(tray);
    sh.info.textContent = 'Cada hueco tiene un símbolo grabado.';
    sh.canvas.addEventListener('pointerdown', (e) => {
      const p = boardPos(sh.canvas, e);
      const i = slots.findIndex((_, k) => Math.hypot(p.x - (32 + k * 45), p.y - 34) < 18);
      if (i < 0) return;
      if (placed[i]) {
        placed[i] = null;
        renderTray();
        draw();
        return;
      }
      if (!selected) return;
      placed[i] = selected;
      selected = null;
      audio.sfxPlay('place');
      renderTray();
      draw();
      if (placed.every(Boolean)) {
        if (placed.every((s, k) => s === slots[k].want)) {
          audio.sfxPlay('success');
          setTimeout(() => finish(true), 600);
        } else {
          audio.sfxPlay('error');
          sh.info.textContent = 'El mecanismo no gira. Algo no está en su lugar.';
        }
      }
    });
    hintButton(sh, 'stars', ['Cada estrella pertenece a un mapache.', 'Rosa y tibia: Pip (♥). Naranja y cálida: Spicy (♨).', 'Celeste y precisa: Rigg (✎, le encantan los libros).']);
    function finish(ok: boolean) {
      if (done) return;
      done = true;
      sh.close();
      resolve(ok);
    }
  });
}
