/** Restoration: rub away dust/leaves to reveal the object underneath. Satisfying, no fail state. */
import { drawObject } from '../art/objects';
import { audio } from '../audio/audio';
import { h } from '../ui/dom';
import { boardPos, shell } from './common';

export function restoration(title: string, kind: 'sign' | 'cabin' | 'fountain' | 'table'): Promise<boolean> {
  return new Promise((resolve) => {
    const W = 160;
    const H = 110;
    let done = false;
    const sh = shell(title, W, H, 2, () => finish(false));
    // picture underneath
    const base = document.createElement('canvas');
    base.width = W;
    base.height = H;
    const b = base.getContext('2d')!;
    b.imageSmoothingEnabled = false;
    if (kind === 'sign') {
      b.fillStyle = '#efe1c4';
      b.fillRect(0, 0, W, H);
      b.fillStyle = '#2c3358';
      b.fillRect(14, 26, W - 28, 50);
      b.fillStyle = '#f2c66d';
      b.font = 'bold 16px Pixelify Sans, sans-serif';
      b.fillText('Midnight Maki', 26, 56);
      for (const [x, y] of [[30, 68], [80, 70], [128, 66]]) b.fillRect(x, y, 4, 4);
    } else if (kind === 'cabin') {
      b.fillStyle = '#a8734d';
      b.fillRect(0, 0, W, H);
      b.drawImage(drawObject('crate', 32, 32, '', ''), 18, 50);
      b.drawImage(drawObject('futon', 16, 32, '#d9a3a6', '#f6ecd6'), 70, 40);
      b.drawImage(drawObject('shelf', 32, 40, '#8a5a3c', '#3b4470'), 104, 30);
      b.fillStyle = '#f4c6cf';
      b.fillRect(75, 54, 6, 6);
    } else {
      b.fillStyle = '#a59f9a';
      b.fillRect(0, 0, W, H);
      b.fillStyle = '#6f9fb8';
      b.fillRect(30, 30, W - 60, H - 60);
    }
    // dirt layer
    const dirt = document.createElement('canvas');
    dirt.width = W;
    dirt.height = H;
    const d = dirt.getContext('2d')!;
    d.fillStyle = '#7a6a55';
    d.fillRect(0, 0, W, H);
    for (let i = 0; i < 260; i++) {
      d.fillStyle = ['#6b5c48', '#8a7a62', '#5f7f55', '#9a8a6a'][i % 4];
      d.fillRect(Math.random() * W, Math.random() * H, 2 + Math.random() * 5, 2 + Math.random() * 3);
    }
    let rubbing = false;
    let lastSfx = 0;
    const clean = (x: number, y: number) => {
      d.globalCompositeOperation = 'destination-out';
      d.beginPath();
      d.arc(x, y, 9, 0, Math.PI * 2);
      d.fill();
      d.globalCompositeOperation = 'source-over';
      if (performance.now() - lastSfx > 120) {
        lastSfx = performance.now();
        audio.sfxPlay('roll');
      }
    };
    const coverage = () => {
      const data = d.getImageData(0, 0, W, H).data;
      let n = 0;
      for (let i = 3; i < data.length; i += 16) if (data[i] > 0) n++;
      return n / (data.length / 16);
    };
    const draw = () => {
      sh.g.drawImage(base, 0, 0);
      sh.g.drawImage(dirt, 0, 0);
    };
    draw();
    sh.info.textContent = 'Frotá con el dedo (o el mouse) para limpiar.';
    sh.canvas.style.touchAction = 'none';
    sh.canvas.addEventListener('pointerdown', (e) => {
      rubbing = true;
      try { sh.canvas.setPointerCapture(e.pointerId); } catch { /* synthetic or released pointer */ }
      const p = boardPos(sh.canvas, e);
      clean(p.x, p.y);
      draw();
    });
    sh.canvas.addEventListener('pointermove', (e) => {
      if (!rubbing) return;
      const p = boardPos(sh.canvas, e);
      clean(p.x, p.y);
      draw();
    });
    sh.canvas.addEventListener('pointerup', () => {
      rubbing = false;
      const c = coverage();
      sh.info.textContent = `Limpio: ${Math.round((1 - c) * 100)}%`;
      if (c < 0.12) {
        d.clearRect(0, 0, W, H);
        draw();
        audio.sfxPlay('success');
        sh.info.textContent = '¡Quedó como nuevo!';
        sh.buttons.innerHTML = '';
        sh.buttons.append(h('button', { class: 'btn primary', onclick: () => finish(true) }, 'Listo'));
      }
    });
    function finish(ok: boolean) {
      if (done) return;
      done = true;
      sh.close();
      resolve(ok);
    }
  });
}
