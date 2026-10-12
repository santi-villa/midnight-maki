/**
 * Calm fishing: wait for a bite, then keep the fish inside your green zone by holding.
 * The zone is generous; losing a fish costs nothing.
 */
import { iconCanvas, iconElement } from '../art/icons';
import { audio } from '../audio/audio';
import { settings } from '../core/settings';
import { game } from '../core/state';
import { ITEMS_BY_ID } from '../data/items';
import { obtain, rollFish } from '../systems/collect';
import { h, toast } from '../ui/dom';
import { shell } from './common';

export function fish(kind: 'sea' | 'lake'): Promise<string | null> {
  return new Promise((resolve) => {
    const W = 80;
    const H = 160;
    let state: 'wait' | 'bite' | 'reel' | 'end' = 'wait';
    const roll = rollFish(kind);
    const it = ITEMS_BY_ID[roll.id];
    const icon = iconCanvas(it.icon);
    const relaxed = settings.cookMode === 'relaxed';
    const zoneH = (relaxed ? 52 : 42) - roll.difficulty * 3;
    let zoneY = H - zoneH - 10;
    let zoneV = 0;
    let fishY = H / 2;
    let fishT = 0;
    let fishTarget = H / 2;
    let progress = 0.3;
    let holding = false;
    let waitT = 1.2 + Math.random() * 2.5;
    let biteT = 0;
    let raf = 0;
    let last = performance.now();
    const sh = shell(kind === 'sea' ? 'Pesca en el mar' : 'Pesca en el lago', W, H, 2, () => end(false));
    sh.info.textContent = 'Esperá a que piquen...';
    const btn = h('button', { class: 'btn primary', style: { minWidth: '160px', minHeight: '56px' } }, 'Mantener');
    sh.buttons.append(btn);
    const down = (e: Event) => {
      e.preventDefault();
      if (state === 'bite') {
        state = 'reel';
        audio.sfxPlay('splash');
        sh.info.textContent = 'Mantené para subir la zona verde y seguí al pez.';
      } else if (state === 'wait') sh.info.textContent = 'Paciencia... todavía no.';
      holding = true;
    };
    const up = () => (holding = false);
    for (const el of [btn, sh.canvas]) {
      el.addEventListener('pointerdown', down);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointerleave', up);
    }
    const key = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key === 'e') {
        if (e.type === 'keydown') down(e);
        else up();
      }
    };
    window.addEventListener('keydown', key);
    window.addEventListener('keyup', key);

    function end(ok: boolean) {
      if (state === 'end') return;
      state = 'end';
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', key);
      window.removeEventListener('keyup', key);
      sh.close();
      if (ok) {
        const first = obtain(roll.id, 1, 'fish');
        game.stat('fishCaught');
        audio.sfxPlay('success');
        toast(`${first ? '¡Nuevo! ' : ''}Pescaste: ${it.name}`, iconElement(it.icon));
        resolve(roll.id);
      } else resolve(null);
    }

    const loop = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      const g = sh.g;
      // water column
      const grad = g.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, kind === 'sea' ? '#94c0d2' : '#9fc7b0');
      grad.addColorStop(1, kind === 'sea' ? '#3b5f86' : '#4f7a62');
      g.fillStyle = grad;
      g.fillRect(0, 0, W, H);
      g.fillStyle = 'rgba(255,255,255,.15)';
      for (let i = 0; i < 5; i++) g.fillRect(((t / 40 + i * 37) % (W + 20)) - 10, 20 + i * 28, 10, 1);
      if (state === 'wait') {
        waitT -= dt;
        const bob = Math.sin(t / 300) * 2;
        g.fillStyle = '#d9675f';
        g.fillRect(W / 2 - 2, 30 + bob, 4, 6);
        g.fillStyle = '#f6ecd6';
        g.fillRect(W / 2 - 2, 36 + bob, 4, 3);
        if (waitT <= 0) {
          state = 'bite';
          biteT = relaxed ? 3 : 1.6;
          audio.sfxPlay('bite');
          sh.info.textContent = '¡Picó! ¡Tocá ahora!';
        }
      } else if (state === 'bite') {
        biteT -= dt;
        const shake = Math.sin(t / 30) * 3;
        g.fillStyle = '#d9675f';
        g.fillRect(W / 2 - 2 + shake, 34, 4, 6);
        g.fillStyle = '#f6ecd6';
        g.font = '14px sans-serif';
        g.fillText('!', W / 2 - 2, 26);
        if (biteT <= 0) {
          state = 'wait';
          waitT = 1.5 + Math.random() * 2;
          sh.info.textContent = 'Se fue... esperá otro pique.';
        }
      } else if (state === 'reel') {
        // fish movement: wanders towards random targets, faster for harder fish
        fishT -= dt;
        if (fishT <= 0) {
          fishT = 0.6 + Math.random() * (1.6 - roll.difficulty * 0.2);
          fishTarget = 12 + Math.random() * (H - 24);
        }
        fishY += (fishTarget - fishY) * dt * (1 + roll.difficulty * 0.6) * (relaxed ? 0.7 : 1);
        // player zone physics
        zoneV += (holding ? -260 : 200) * dt;
        zoneV *= 0.9;
        zoneY = Math.max(0, Math.min(H - zoneH, zoneY + zoneV * dt));
        if (zoneY === 0 || zoneY === H - zoneH) zoneV = 0;
        const inside = fishY > zoneY && fishY < zoneY + zoneH;
        progress += (inside ? 0.32 : relaxed ? -0.1 : -0.18) * dt;
        g.fillStyle = 'rgba(155,220,140,.55)';
        g.fillRect(14, zoneY, W - 34, zoneH);
        g.strokeStyle = '#e8f5e0';
        g.strokeRect(14.5, zoneY + 0.5, W - 35, zoneH - 1);
        g.drawImage(icon, W / 2 - 14, fishY - 8, 16, 16);
        // progress bar
        g.fillStyle = 'rgba(0,0,0,.25)';
        g.fillRect(W - 14, 6, 8, H - 12);
        g.fillStyle = progress > 0.66 ? '#f2c66d' : '#d9a3a6';
        const ph = (H - 12) * Math.max(0, Math.min(1, progress));
        g.fillRect(W - 14, H - 6 - ph, 8, ph);
        if (progress >= 1) return end(true);
        if (progress <= 0) {
          toast('El pez se escapó. ¡Otra vez será!');
          return end(false);
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
  });
}
