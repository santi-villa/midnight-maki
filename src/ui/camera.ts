/** In-game camera: snapshots the world canvas into a small album thumbnail. */
import { audio } from '../audio/audio';
import { game } from '../core/state';
import { CHAR_BY_ID } from '../data/characters';
import { ZONES } from '../data/zones';
import { world } from '../scenes/WorldScene';
import { h, panel, sleep, toast } from './dom';
import { showHud } from './hud';

export async function takePhoto() {
  if (!world?.player) return;
  showHud(false);
  await sleep(60);
  world.game.renderer.snapshot((img) => {
    showHud(true);
    if (!(img instanceof HTMLImageElement)) return;
    const done = () => {
      const maxW = 200;
      const scale = Math.min(1, maxW / img.width);
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      const g = c.getContext('2d')!;
      g.imageSmoothingEnabled = false;
      g.drawImage(img, 0, 0, c.width, c.height);
      const data = c.toDataURL('image/jpeg', 0.7);
      // who is in the picture?
      let subject = ZONES[world.zoneId]?.name ?? 'Villa Nori';
      let nearest = 999;
      for (const [id, n] of world.npcs) {
        const d = Math.hypot(n.actor.x - world.player.x, n.actor.y - world.player.y);
        if (d < 80 && d < nearest) {
          nearest = d;
          subject = CHAR_BY_ID[id]?.name ?? subject;
          if (CHAR_BY_ID[id]?.raccoon) game.setFlag('photo_raccoon_' + id);
        }
      }
      audio.sfxPlay('camera');
      const flash = h('div', { style: { position: 'fixed', inset: '0', background: '#fff', opacity: '.6', zIndex: '90', pointerEvents: 'none', transition: 'opacity .3s' } });
      document.body.append(flash);
      setTimeout(() => (flash.style.opacity = '0'), 30);
      setTimeout(() => flash.remove(), 400);
      const photo = { id: game.uid(), day: game.save.time.day, zone: world.zoneId, subject, data };
      panel({
        title: 'Foto',
        body: h('div', { class: 'col', style: { alignItems: 'center' } }, h('img', { src: data, style: { width: '100%', maxWidth: '360px', imageRendering: 'pixelated', borderRadius: '8px', border: '3px solid #46291f' } }), h('div', { class: 'hint' }, subject)),
        foot: [
          h('button', { class: 'btn', onclick: (e: Event) => ((e.target as HTMLElement).closest('.panel-backdrop') as any).__close() }, 'Descartar'),
          h('button', {
            class: 'btn primary',
            onclick: (e: Event) => {
              if (game.save.photos.length >= 60) game.save.photos.shift();
              game.save.photos.push(photo);
              game.stat('photos');
              game.touch('photo');
              toast('Guardada en el álbum.');
              ((e.target as HTMLElement).closest('.panel-backdrop') as any).__close();
            },
          }, 'Guardar en el álbum'),
        ],
      });
    };
    if (img.complete) done();
    else img.onload = done;
  }, 'image/png');
}
