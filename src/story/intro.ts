/** Opening: rain, a letter, arrival at Villa Nori. */
import { audio } from '../audio/audio';
import { game } from '../core/state';
import { world } from '../scenes/WorldScene';
import { fmt, runScene, say } from '../dialogue/dialogue';
import { fade, h, uiRoot } from '../ui/dom';
import { paintSlide, type SlideId } from './slides';
import { showHud } from '../ui/hud';
import { addClue } from './story';

function letter(lines: string[], sign: string): Promise<void> {
  return new Promise((resolve) => {
    const paper = h(
      'div',
      {
        style: {
          padding: '18px 18px', maxWidth: '440px', width: '90%', maxHeight: '86vh', overflowY: 'auto',
          lineHeight: '1.5', fontSize: '1.05em', color: '#3a2418',
        },
      },
      ...lines.map((l) => h('p', { style: { margin: '0 0 10px' } }, fmt(l))),
      h('p', { style: { textAlign: 'right', margin: '14px 0 0', fontStyle: 'italic' } }, sign),
      h('p', { class: 'hint', style: { textAlign: 'center', marginTop: '16px' } }, 'Tocá para continuar'),
    );
    paper.className = 'letter-paper';
    const wrap = h('div', { class: 'letter-wrap' }, paper);
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

// ------------------------------------------------------------------ storybook pages
let skipped = false;
let book: HTMLElement | null = null;

/** A still illustration (hand-made public/intro/<n>.jpg|png if present, otherwise painted) with its lines of text. */
async function page(n: number, id: SlideId, lines: string[]): Promise<void> {
  if (skipped || !book) return;
  const pic = h('div', { class: 'book-pic' });
  const custom = await findCustom(n);
  if (custom) pic.append(h('img', { src: custom, alt: '' }));
  else {
    const cv = paintSlide(id, game.save.player.appearance);
    pic.append(cv);
  }
  const text = h('div', { class: 'book-text' });
  const pageEl = h('div', { class: 'book-page' }, pic, h('div', { class: 'book-caption' }, text, h('div', { class: 'book-next' }, '▼')));
  const prev = book.querySelector('.book-page');
  book.append(pageEl);
  requestAnimationFrame(() => pageEl.classList.add('in'));
  if (prev) {
    prev.classList.remove('in');
    setTimeout(() => prev.remove(), 500);
  }
  for (const line of lines) {
    if (skipped) return;
    text.textContent = fmt(line);
    text.classList.remove('show');
    void text.offsetWidth;
    text.classList.add('show');
    await waitTap(pageEl);
  }
}

function waitTap(el: HTMLElement): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      el.removeEventListener('pointerup', done);
      window.removeEventListener('mm-skip', done);
      audio.sfxPlay('blip');
      resolve();
    };
    // a short delay avoids skipping a line with the same tap that showed it
    setTimeout(() => {
      el.addEventListener('pointerup', done);
      window.addEventListener('mm-skip', done);
    }, 250);
  });
}

const customCache = new Map<number, string | null>();
function findCustom(n: number): Promise<string | null> {
  if (customCache.has(n)) return Promise.resolve(customCache.get(n)!);
  const base = import.meta.env.BASE_URL + 'intro/' + n;
  const tryUrl = (u: string) => new Promise<boolean>((res) => {
    const img = new Image();
    img.onload = () => res(true);
    img.onerror = () => res(false);
    img.src = u;
  });
  return (async () => {
    for (const ext of ['.jpg', '.png', '.webp']) if (await tryUrl(base + ext)) {
      customCache.set(n, base + ext);
      return base + ext;
    }
    customCache.set(n, null);
    return null;
  })();
}

function openBook() {
  skipped = false;
  const skip = h('button', { class: 'btn small book-skip', onclick: () => { skipped = true; window.dispatchEvent(new Event('mm-skip')); } }, 'Saltar intro ›');
  book = h('div', { class: 'book' }, skip);
  uiRoot().append(book);
}

function closeBook() {
  book?.remove();
  book = null;
}

export async function playIntro() {
  await fade(true, 10);
  openBook();
  audio.ambience('rain');
  audio.play('intro');
  await fade(false, 500);
  await page(1, 'city', [
    'En una ciudad grande y gris, {name} trabajaba hasta tarde todas las noches.',
    'Le gustaban las cosas simples: el sushi, los animales tiernos, las historias con misterio.',
  ]);
  if (!skipped) audio.sfxPlay('paper');
  await page(2, 'letter', [
    'Una noche de lluvia, alguien deslizó una carta por debajo de la puerta.',
    'No tenía remitente. Solo una estrella dibujada en el sello.',
  ]);
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
    audio.ambience('waves');
    audio.play('beach');
    audio.sfxPlay('train');
  }
  await page(3, 'train', [
    'A la mañana siguiente, {name} tomó el primer tren hacia el sur. Hacia el mar.',
    'El paisaje gris se fue quedando atrás, y aparecieron colinas, gaviotas... y el mar.',
  ]);
  if (!skipped) {
    audio.ambience('none');
    audio.play('town');
  }
  await page(4, 'arrival', ['Al atardecer llegó a Villa Nori: un pueblo pequeño, con olor a pino, a sal y a arroz recién hecho.']);
  await fade(true, 500);
  closeBook();
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
