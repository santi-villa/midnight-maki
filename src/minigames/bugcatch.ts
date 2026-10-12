/** Gentle bug catching: tap when the shrinking ring is inside the green band. */
import { iconCanvas, iconElement } from '../art/icons';
import { audio } from '../audio/audio';
import { settings } from '../core/settings';
import { game } from '../core/state';
import { ITEMS_BY_ID } from '../data/items';
import { world } from '../scenes/WorldScene';
import { obtain } from '../systems/collect';
import { h, toast } from '../ui/dom';
import { shell } from './common';

export function catchBug(idx: number): Promise<boolean> {
  const id = world.bugItem(idx);
  if (!id) return Promise.resolve(false);
  const it = ITEMS_BY_ID[id];
  const rare = it.rarity ?? 1;
  return new Promise((resolve) => {
    let done = false;
    const sh = shell(`Atrapar: ${it.name}`, 120, 120, 2, () => finish(false));
    const band = settings.cookMode === 'relaxed' ? 9 : 6 - rare;
    const target = 22;
    let r = 56;
    let speed = 22 + rare * 8;
    let tries = 3;
    let raf = 0;
    let last = performance.now();
    const icon = iconCanvas(it.icon);
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      sh.close();
      if (ok) {
        world.removeBug(idx);
        const first = obtain(id, 1, 'bug');
        game.stat('bugsCaught');
        audio.sfxPlay('pickup');
        toast(`${first ? '¡Nuevo! ' : ''}Atrapaste: ${it.name}`, iconElement(it.icon));
      }
      resolve(ok);
    };
    const loop = (t: number) => {
      const dt = (t - last) / 1000;
      last = t;
      r -= speed * dt;
      if (r < 8) r = 56;
      const g = sh.g;
      g.fillStyle = '#9bb59a';
      g.fillRect(0, 0, 120, 120);
      g.strokeStyle = 'rgba(111,158,106,.9)';
      g.lineWidth = band;
      g.beginPath();
      g.arc(60, 60, target, 0, Math.PI * 2);
      g.stroke();
      g.strokeStyle = '#f6ecd6';
      g.lineWidth = 2;
      g.beginPath();
      g.arc(60, 60, r, 0, Math.PI * 2);
      g.stroke();
      const wob = Math.sin(t / 120) * 2;
      g.drawImage(icon, 52 + wob, 52, 16, 16);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    sh.info.textContent = `Tocá cuando el aro blanco esté sobre el verde. Intentos: ${tries}`;
    const tap = () => {
      if (Math.abs(r - target) <= band / 2 + 1) finish(true);
      else {
        tries--;
        audio.sfxPlay('error');
        speed *= 0.85;
        if (tries <= 0) {
          toast(`${it.name} se escapó volando. ¡Ya va a volver!`);
          finish(false);
        } else sh.info.textContent = `¡Casi! Intentos: ${tries}`;
      }
    };
    sh.canvas.addEventListener('pointerdown', tap);
    sh.buttons.append(h('button', { class: 'btn primary', onclick: tap }, 'Atrapar'));
  });
}
