/** Opening pictures: the letter, the train, and the first sight of Midnight Maki. */
import { audio } from '../audio/audio';
import { game } from '../core/state';
import { RESTAURANT_ENTRY } from '../data/zones';
import { clock } from '../systems/time';
import { fmt } from '../dialogue/dialogue';
import { world } from '../scenes/WorldScene';
import { fade, h, screenTransition, uiRoot } from '../ui/dom';
import { showHud } from '../ui/hud';
import { applyIntroCue, stopIntroAudio } from './introAudio';
import { INTRO_SCENES, LETTER_LINES, LETTER_SIGN, takeCues, type IntroMusic, type IntroScene } from './introScript';
import { addClue } from './story';

let skipped = false;
let book: HTMLElement | null = null;
let music: IntroMusic | '' = '';
const fired = new Set<string>();

const ADVANCE_KEYS = new Set(['Enter', ' ', 'ArrowRight', 'ArrowDown']);

function playMusic(track: IntroMusic) {
  if (track === music) return;
  music = track;
  audio.unlock();
  audio.crossfade(track);
}

function runCues(scene: IntroScene, at: 'enter' | number) {
  if (skipped) return;
  for (const cue of takeCues(scene, at, fired)) applyIntroCue(cue);
}

function openBook() {
  skipped = false;
  music = '';
  fired.clear();
  const skip = h('button', { class: 'btn small book-skip', type: 'button', onclick: skipIntro }, 'Saltar intro ›');
  book = h('div', { class: 'book' }, skip);
  uiRoot().append(book);
}

function skipIntro() {
  skipped = true;
  window.dispatchEvent(new Event('mm-skip'));
}

function closeBook() {
  book?.remove();
  book = null;
}

function waitTap(el: HTMLElement): Promise<void> {
  return new Promise((resolve) => {
    let doneOnce = false;
    const done = (fromSkip = false) => {
      if (doneOnce) return;
      doneOnce = true;
      el.removeEventListener('pointerup', onPointer);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mm-skip', onSkip);
      if (!fromSkip && !skipped) audio.sfxPlay('blip');
      resolve();
    };
    const onPointer = () => done(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || !ADVANCE_KEYS.has(e.key)) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'BUTTON' || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      e.preventDefault();
      done(false);
    };
    const onSkip = () => done(true);
    window.setTimeout(() => {
      if (skipped || !el.isConnected) {
        done(true);
        return;
      }
      el.addEventListener('pointerup', onPointer);
      window.addEventListener('keydown', onKey);
      window.addEventListener('mm-skip', onSkip);
    }, 250);
  });
}

function probe(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });
}

async function findImage(n: number): Promise<string | null> {
  const base = import.meta.env.BASE_URL + 'intro/' + n;
  for (const ext of ['.jpg', '.png', '.webp']) {
    if (await probe(base + ext)) return base + ext;
  }
  return null;
}

async function showLetter(): Promise<void> {
  if (skipped || !book) return;
  await new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.removeEventListener('mm-skip', finish);
      window.removeEventListener('keydown', onKey);
      wrap.remove();
      addClue('letter_inherit', true);
      resolve();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      finish();
    };
    const paper = h(
      'div',
      { class: 'letter-paper', role: 'dialog', 'aria-label': 'Carta' },
      h('div', { class: 'letter-scroll' }, ...LETTER_LINES.map((line) => h('p', null, fmt(line))), h('p', { class: 'letter-sign' }, LETTER_SIGN)),
      h('button', { class: 'btn primary letter-close', type: 'button', onclick: finish }, 'Cerrar carta'),
    );
    const wrap = h('div', { class: 'letter-wrap' }, paper);
    wrap.addEventListener('pointerdown', (e) => e.stopPropagation());
    book?.append(wrap);
    window.addEventListener('mm-skip', finish);
    window.addEventListener('keydown', onKey);
    const close = paper.querySelector('button');
    if (close instanceof HTMLButtonElement) close.focus();
  });
}

async function showScene(scene: IntroScene): Promise<void> {
  if (skipped || !book) return;
  const pic = h('div', { class: 'book-pic' });
  const src = await findImage(scene.image);
  if (skipped || !book) return;
  if (src) pic.append(h('img', { class: 'book-photo', src, alt: scene.alt }));
  else pic.append(h('div', { class: 'book-missing' }, `Falta la ilustración public/intro/${scene.image}.jpg`));
  const who = h('div', { class: 'book-who' });
  const text = h('div', { class: 'book-text' });
  const pageEl = h(
    'div',
    { class: 'book-page' },
    pic,
    h('div', { class: 'book-caption' }, who, text, h('div', { class: 'book-next', 'aria-hidden': 'true' }, '▼')),
  );
  const prev = book.querySelector('.book-page');
  book.append(pageEl);
  requestAnimationFrame(() => pageEl.classList.add('in'));
  if (prev) {
    prev.classList.remove('in');
    window.setTimeout(() => prev.remove(), 500);
  }
  if (scene.musicAt == null) playMusic(scene.music);
  runCues(scene, 'enter');
  for (let i = 0; i < scene.lines.length; i++) {
    if (skipped) return;
    const line = scene.lines[i];
    if (scene.musicAt === i) playMusic(scene.music);
    runCues(scene, i);
    who.textContent = line.who === 'player' ? game.save.player.name : '';
    who.hidden = line.who !== 'player';
    text.textContent = fmt(line.text);
    text.classList.remove('show');
    void text.offsetWidth;
    text.classList.add('show');
    await waitTap(pageEl);
    if (skipped) return;
    if (scene.letterAfter === i) await showLetter();
  }
}

export async function playIntro() {
  await fade(true, 10);
  openBook();
  audio.unlock();
  playMusic('intro');
  await fade(false, 500);
  try {
    for (const scene of INTRO_SCENES) {
      if (skipped) break;
      await showScene(scene);
    }
  } catch (err) {
    await stopIntroAudio(0); closeBook(); throw err;
  }
  world.inputLocked++;
  clock.pause();
  try {
    await screenTransition('doors', async () => {
      await stopIntroAudio(0);
      closeBook();
      addClue('letter_inherit', true);
      audio.crossfade(clock.period >= 2 ? 'restaurant_night' : 'restaurant');
      const entry = RESTAURANT_ENTRY;
      await world.enterZone(entry.zone, entry.x, entry.y, entry.dir, false);
    });
    game.setFlag('arrived');
    game.touch('intro');
    const { check } = await import('../quests/quests');
    check();
    showHud(true);
  } finally { world.inputLocked--; clock.resume(); }
}
