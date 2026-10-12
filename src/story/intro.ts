/** Opening: rain, a letter, arrival at Villa Nori. */
import { audio } from '../audio/audio';
import { game } from '../core/state';
import { world } from '../scenes/WorldScene';
import { fmt, runScene, say } from '../dialogue/dialogue';
import { fade, h, sleep, uiRoot } from '../ui/dom';
import type { CinematicScene } from '../scenes/CinematicScene';
import { showHud } from '../ui/hud';
import { addClue } from './story';

function letter(lines: string[], sign: string): Promise<void> {
  return new Promise((resolve) => {
    const paper = h(
      'div',
      {
        style: {
          background: '#f6ecd6', border: '4px solid #6b4330', borderRadius: '6px', padding: '22px 20px', maxWidth: '420px', width: '90%',
          boxShadow: '0 10px 30px rgba(0,0,0,.5)', lineHeight: '1.55', fontSize: '1.05em', animation: 'popin .6s ease-out', color: '#2a2230',
        },
      },
      ...lines.map((l) => h('p', { style: { margin: '0 0 10px' } }, fmt(l))),
      h('p', { style: { textAlign: 'right', margin: '14px 0 0', fontStyle: 'italic' } }, sign),
      h('p', { class: 'hint', style: { textAlign: 'center', marginTop: '16px' } }, 'Tocá para continuar'),
    );
    const wrap = h('div', { style: { position: 'fixed', inset: '0', background: '#14162a', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: '70' } }, paper);
    wrap.addEventListener('pointerup', () => {
      wrap.style.transition = 'opacity .5s';
      wrap.style.opacity = '0';
      setTimeout(() => {
        wrap.remove();
        resolve();
      }, 500);
    });
    uiRoot().append(wrap);
  });
}

// ------------------------------------------------------------------ cinematic helpers
let skipped = false;
let subBox: HTMLElement | null = null;

async function startCinematic(): Promise<CinematicScene> {
  skipped = false;
  const sp = world.scene;
  if (!sp.isActive('cinematic')) sp.launch('cinematic');
  sp.bringToTop('cinematic');
  await sleep(120);
  const skip = h('button', { class: 'btn small ghost cine-skip', onclick: () => { skipped = true; subBox?.querySelector<HTMLElement>('.cine-sub')?.click(); } }, 'Saltar intro ›');
  subBox = h('div', { class: 'cine' }, skip);
  uiRoot().append(subBox);
  return sp.get('cinematic') as CinematicScene;
}

function endCinematic() {
  world.scene.stop('cinematic');
  subBox?.remove();
  subBox = null;
}

/** storybook subtitle; types out, waits for a tap */
function subtitle(text: string): Promise<void> {
  if (skipped || !subBox) return Promise.resolve();
  return new Promise((resolve) => {
    const full = fmt(text);
    const el = h('div', { class: 'cine-sub' });
    subBox!.append(el);
    let i = 0;
    const tm = setInterval(() => {
      i += 2;
      el.textContent = full.slice(0, i);
      if (i >= full.length) clearInterval(tm);
    }, 40);
    el.addEventListener('click', () => {
      if (i < full.length && !skipped) {
        i = full.length;
        el.textContent = full;
        return;
      }
      clearInterval(tm);
      el.classList.add('out');
      setTimeout(() => el.remove(), 300);
      resolve();
    });
    // also advance when tapping anywhere on the picture
    subBox!.onclick = (e) => {
      if (e.target === subBox) el.click();
    };
  });
}

async function crossfade(next: () => void) {
  if (skipped) return;
  await fade(true, 450);
  next();
  await fade(false, 450);
}

export async function playIntro() {
  await fade(true, 10);
  audio.ambience('rain');
  audio.play('emotional');
  const cine = await startCinematic();
  await fade(false, 600);
  if (!skipped) {
    cine.shotCity();
    await subtitle('En una ciudad grande y gris, {name} trabajaba hasta tarde todas las noches.');
    await subtitle('Le gustaban las cosas simples: el sushi, los animales tiernos, las historias con misterio.');
  }
  if (!skipped) {
    await crossfade(() => cine.shotLetter());
    await subtitle('Una noche de lluvia, alguien deslizó una carta por debajo de la puerta.');
    await subtitle('No tenía remitente. Solo una estrella dibujada en el sello.');
  }
  await fade(true, 400);
  await letter(
    [
      'Querida {name}:',
      'Si estás leyendo esto, es porque Midnight Maki ahora es tuyo. Un pequeño restaurante de sushi en Villa Nori, junto al mar.',
      'Está un poco descuidado. Pero no está vacío. Cuidalo, y cuidá a quienes viven ahí. Ellos te van a estar esperando.',
      'Hay cosas que no puedo explicarte en una carta. Villa Nori te las va a contar de a poquito.',
    ],
    '— A.',
  );
  addClue('letter_inherit', true);
  if (!skipped) {
    audio.ambience('none');
    audio.play('beach');
    cine.shotTrain();
    await fade(false, 600);
    await subtitle('A la mañana siguiente, {name} tomó el primer tren hacia el sur. Hacia el mar.');
    await subtitle('El paisaje gris se fue quedando atrás, y aparecieron colinas, gaviotas... y el mar.');
    await crossfade(() => cine.shotArrival());
    audio.play('town');
    await subtitle('Al atardecer llegó a Villa Nori: un pueblo pequeño, con olor a pino, a sal y a arroz recién hecho.');
    await fade(true, 500);
  }
  endCinematic();
  await world.enterZone('plaza', 15, 22, 'up', false);
  showHud(false);
  world.inputLocked++;
  audio.ambience('none');
  audio.play('town');
  await fade(false, 900);
  await runScene('arrival', async () => {
    await say('narr', 'Después de un largo viaje en tren y un trecho a pie, llegás a Villa Nori. Huele a mar, a pino y a pan recién horneado.');
    await say('player', 'Así que este es el pueblo... Es más lindo de lo que imaginaba.');
    await say('narr', 'Al fondo de la plaza, un cartel apagado dice "Midnight Maki". Tiene las ventanas encendidas. ¿Alguien adentro?');
  });
  world.inputLocked--;
  showHud(true);
  game.setFlag('arrived');
  game.touch('intro');
  const { check } = await import('../quests/quests');
  check();
}
