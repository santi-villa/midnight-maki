/** Short casual activities: pantry sorting, plant merging, memory cards vs a raccoon. */
import { iconCanvas, iconElement, type IconSpec } from '../art/icons';
import { audio } from '../audio/audio';
import { game } from '../core/state';
import { runTask } from '../core/errors';
import { ITEMS_BY_ID } from '../data/items';
import { obtain } from '../systems/collect';
import { h, toast } from '../ui/dom';
import { boardPos, shell } from './common';

function dayOnce(key: string): boolean {
  const k = 'daily_' + key;
  if (game.flag(k) === game.save.time.day) return false;
  game.setFlag(k, game.save.time.day);
  return true;
}

// ------------------------------------------------------------------ sorting
export function sortPantry(): Promise<void> {
  return new Promise((resolve) => {
    const W = 160;
    const H = 120;
    const drawers = [
      { name: 'Pescados', cat: (id: string) => ['salmon', 'tuna', 'shrimp', 'eel', 'roe', 'crab'].includes(id), color: '#6f9fb8' },
      { name: 'Verduras', cat: (id: string) => ['cucumber', 'avocado', 'carrot', 'scallion', 'shiitake', 'chili'].includes(id), color: '#7fae5f' },
      { name: 'Despensa', cat: (id: string) => ['rice', 'nori', 'sesame', 'wasabi', 'ginger', 'egg'].includes(id), color: '#e6c79b' },
    ];
    const pool = ['salmon', 'tuna', 'shrimp', 'cucumber', 'avocado', 'carrot', 'rice', 'nori', 'sesame', 'wasabi', 'roe', 'scallion'];
    const items = Array.from({ length: 8 }, () => pool[Math.floor(Math.random() * pool.length)]).map((id, i) => ({ id, x: 12 + (i % 4) * 36, y: 10 + Math.floor(i / 4) * 24, placed: false }));
    let drag: (typeof items)[number] | null = null;
    let ox = 0;
    let oy = 0;
    let mistakes = 0;
    let done = false;
    const sh = shell('Ordenar la despensa', W, H, 2, () => finish());
    const draw = () => {
      const g = sh.g;
      g.fillStyle = '#a8734d';
      g.fillRect(0, 0, W, H);
      drawers.forEach((d, i) => {
        const x = 6 + i * 52;
        g.fillStyle = d.color;
        g.fillRect(x, 70, 46, 44);
        g.fillStyle = '#46291f';
        g.fillRect(x + 18, 74, 10, 2);
        g.fillStyle = '#2a2230';
        g.font = '8px sans-serif';
        g.fillText(d.name, x + 3, 108);
      });
      for (const it of items) if (!it.placed) g.drawImage(iconCanvas(ITEMS_BY_ID[it.id].icon), Math.round(it.x), Math.round(it.y), 16, 16);
    };
    draw();
    sh.info.textContent = 'Arrastrá cada ingrediente a su cajón.';
    sh.canvas.style.touchAction = 'none';
    sh.canvas.addEventListener('pointerdown', (e) => {
      const p = boardPos(sh.canvas, e);
      drag = [...items].reverse().find((it) => !it.placed && p.x >= it.x && p.x <= it.x + 16 && p.y >= it.y && p.y <= it.y + 16) ?? null;
      if (drag) {
        ox = p.x - drag.x;
        oy = p.y - drag.y;
        try { sh.canvas.setPointerCapture(e.pointerId); } catch { /* synthetic or released pointer */ }
      }
    });
    sh.canvas.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const p = boardPos(sh.canvas, e);
      drag.x = p.x - ox;
      drag.y = p.y - oy;
      draw();
    });
    sh.canvas.addEventListener('pointerup', (e) => {
      if (!drag) return;
      const p = boardPos(sh.canvas, e);
      const di = p.y > 66 ? Math.floor((p.x - 6) / 52) : -1;
      if (di >= 0 && di < 3) {
        if (drawers[di].cat(drag.id)) {
          drag.placed = true;
          audio.sfxPlay('place');
        } else {
          mistakes++;
          audio.sfxPlay('error');
          drag.y = 40;
        }
      }
      drag = null;
      draw();
      if (items.every((i) => i.placed)) {
        audio.sfxPlay('success');
        if (dayOnce('sort')) {
          const reward = 30 + (mistakes === 0 ? 20 : 0);
          game.addCoins(reward, 'sort');
          const bonus = ['sesame', 'nori', 'rice', 'ginger'][Math.floor(Math.random() * 4)];
          game.addItem(bonus, 2, 'sort');
          toast(`¡Despensa ordenada! +${reward} monedas y 2 ${ITEMS_BY_ID[bonus].name}.`);
        } else toast('¡Todo en su lugar! (La recompensa es una vez por día.)');
        game.stat('sorted');
        finish();
      }
    });
    function finish() {
      if (done) return;
      done = true;
      sh.close();
      resolve();
    }
  });
}

// ------------------------------------------------------------------ merging (bounded, no energy timers)
const TIERS: { name: string; icon: IconSpec }[] = [
  { name: 'Semilla', icon: { type: 'seed', c1: '#e8a0b0' } },
  { name: 'Brote', icon: { type: 'sprout', c1: '#7fae5f' } },
  { name: 'Hojita', icon: { type: 'leaf', c1: '#6f9e5a' } },
  { name: 'Capullo', icon: { type: 'flower', c1: '#f4d7d0', c2: '#9bb59a' } },
  { name: 'Flor', icon: { type: 'flower', c1: '#e8a0b0', c2: '#f2c66d' } },
  { name: 'Flor estrella', icon: { type: 'flower', c1: '#f2c66d', c2: '#fff6c8' } },
];

export function mergeGarden(): Promise<void> {
  return new Promise((resolve) => {
    const N = 4;
    const grid: (number | null)[] = new Array(N * N).fill(null);
    let seeds = 24; // one bounded round per day; replay allowed without reward
    let sel = -1;
    let done = false;
    const rewardable = game.flag('daily_merge') !== game.save.time.day;
    const sh = shell('Banco de macetas', 128, 128, 2, () => finish());
    const draw = () => {
      const g = sh.g;
      g.fillStyle = '#7a5a44';
      g.fillRect(0, 0, 128, 128);
      for (let i = 0; i < N * N; i++) {
        const x = (i % N) * 32;
        const y = Math.floor(i / N) * 32;
        g.fillStyle = i === sel ? '#f2c66d' : '#a8734d';
        g.fillRect(x + 2, y + 2, 28, 28);
        g.fillStyle = '#5e4334';
        g.fillRect(x + 6, y + 18, 20, 10);
        const v = grid[i];
        if (v != null) g.drawImage(iconCanvas(TIERS[v].icon), x + 8, y + 4, 16, 16);
      }
      sh.info.textContent = `Semillas: ${seeds}. Juntá dos iguales para que crezcan.`;
    };
    draw();
    sh.buttons.append(
      h('button', { class: 'btn small primary', onclick: () => {
        const free = grid.map((v, i) => (v == null ? i : -1)).filter((i) => i >= 0);
        if (!free.length) return toast('No hay macetas libres.');
        if (seeds <= 0) return toast('No quedan semillas por hoy. ¡Volvé mañana!');
        seeds--;
        grid[free[Math.floor(Math.random() * free.length)]] = 0;
        audio.sfxPlay('place');
        draw();
      } }, 'Sembrar'),
    );
    sh.canvas.addEventListener('pointerdown', (e) => {
      const p = boardPos(sh.canvas, e);
      const i = Math.floor(p.y / 32) * N + Math.floor(p.x / 32);
      if (i < 0 || i >= N * N) return;
      if (sel < 0) {
        if (grid[i] != null) sel = i;
      } else if (sel === i) sel = -1;
      else if (grid[i] == null) {
        grid[i] = grid[sel];
        grid[sel] = null;
        sel = -1;
      } else if (grid[i] === grid[sel] && grid[i]! < TIERS.length - 1) {
        grid[i] = grid[i]! + 1;
        grid[sel] = null;
        sel = -1;
        audio.sfxPlay('sparkle');
        if (grid[i] === TIERS.length - 1) {
          grid[i] = null;
          if (rewardable) {
            obtain('fl_star');
            game.setFlag('daily_merge', game.save.time.day);
            toast('¡Floreció una Flor estrella! Quedó en tu mochila.');
          } else toast('¡Una Flor estrella! (Las recompensas son una vez por día.)');
        } else if (grid[i] === 4 && rewardable) {
          game.addItem(['fl_tulip', 'fl_daisy', 'fl_bell'][Math.floor(Math.random() * 3)], 1, 'merge');
        }
      } else sel = i;
      draw();
    });
    function finish() {
      if (done) return;
      done = true;
      game.stat('merges');
      sh.close();
      resolve();
    }
  });
}

// ------------------------------------------------------------------ memory vs raccoon
export function memoryGame(opponent = 'pip'): Promise<void> {
  return new Promise((resolve) => {
    const kinds: IconSpec[] = [
      { type: 'maki', c1: '#6f9e5a' }, { type: 'nigiri', c1: '#ef9a78' }, { type: 'onigiri', c1: '#c4505a' }, { type: 'temaki', c1: '#c4505a', c2: '#6f9e5a' },
      { type: 'gunkan', c1: '#f08a4a' }, { type: 'uramaki', c1: '#e8826f', c2: '#f3e6c8' }, { type: 'egg', c1: '#f2d27a' }, { type: 'shrimp', c1: '#f09a7a' },
    ];
    const deck = [...kinds.keys(), ...kinds.keys()].sort(() => Math.random() - 0.5);
    const open = new Array(16).fill(false);
    const owner: (0 | 1 | null)[] = new Array(16).fill(null);
    const seen = new Map<number, number[]>();
    let flipped: number[] = [];
    let turn: 0 | 1 = 0;
    let busy = false;
    let done = false;
    const score = [0, 0];
    const name = opponent === 'pip' ? 'Pip' : opponent === 'spicy' ? 'Spicy' : 'Rigg';
    const sh = shell(`Memoria con ${name}`, 128, 128, 2, () => finish());
    const draw = () => {
      const g = sh.g;
      g.fillStyle = '#3b4470';
      g.fillRect(0, 0, 128, 128);
      for (let i = 0; i < 16; i++) {
        const x = (i % 4) * 32;
        const y = Math.floor(i / 4) * 32;
        g.fillStyle = open[i] || flipped.includes(i) ? (owner[i] === 1 ? '#e8b8c0' : '#f6ecd6') : '#c27f86';
        g.fillRect(x + 3, y + 3, 26, 26);
        if (open[i] || flipped.includes(i)) g.drawImage(iconCanvas(kinds[deck[i]]), x + 8, y + 8, 16, 16);
        else {
          g.fillStyle = '#f2c66d';
          g.fillRect(x + 14, y + 14, 4, 4);
        }
      }
      sh.info.textContent = `Vos ${score[0]} · ${name} ${score[1]} — ${turn === 0 ? 'tu turno' : `turno de ${name}`}`;
    };
    const remember = (i: number) => seen.set(deck[i], [...new Set([...(seen.get(deck[i]) ?? []), i])]);
    const flip = async (i: number) => {
      if (done || open[i] || flipped.includes(i)) return;
      flipped.push(i);
      remember(i);
      audio.sfxPlay('tap');
      draw();
      if (flipped.length < 2) return;
      busy = true;
      await new Promise((r) => setTimeout(r, 700));
      if (done) return;
      const [a, b] = flipped;
      if (deck[a] === deck[b]) {
        open[a] = open[b] = true;
        owner[a] = owner[b] = turn;
        score[turn]++;
        audio.sfxPlay('pickup');
      } else turn = turn === 0 ? 1 : 0;
      flipped = [];
      busy = false;
      draw();
      if (open.every(Boolean)) return end();
      if (turn === 1) void runTask('memory:opponent', aiTurn);
    };
    const aiTurn = async () => {
      if (done) return;
      busy = true;
      await new Promise((r) => setTimeout(r, 600));
      if (done) return;
      const closed = open.map((o, i) => (o ? -1 : i)).filter((i) => i >= 0);
      // raccoons remember some cards (Rigg more, Pip less)
      const memory = opponent === 'rigg' ? 0.8 : opponent === 'spicy' ? 0.55 : 0.35;
      let pick: number[] | null = null;
      if (Math.random() < memory) for (const [, idx] of seen) {
        const c = idx.filter((i) => !open[i]);
        if (c.length === 2) {
          pick = c;
          break;
        }
      }
      const first = pick ? pick[0] : closed[Math.floor(Math.random() * closed.length)];
      busy = false;
      await flip(first);
      if (done) return;
      busy = true;
      await new Promise((r) => setTimeout(r, 500));
      if (done) return;
      let second = pick ? pick[1] : -1;
      if (second < 0) {
        const known = (seen.get(deck[first]) ?? []).find((i) => i !== first && !open[i]);
        second = known != null && Math.random() < memory ? known : closed.filter((i) => i !== first)[Math.floor(Math.random() * (closed.length - 1))];
      }
      busy = false;
      await flip(second);
    };
    const end = () => {
      if (done) return;
      const win = score[0] > score[1];
      if (win) game.stat('memoryWins');
      if (win && dayOnce('memory_' + opponent)) {
        game.addCoins(40, 'memory');
        game.addFriendship(opponent, 10);
        toast(`¡Ganaste! +40 monedas. ${name} quiere la revancha.`);
      } else toast(win ? '¡Ganaste otra vez!' : score[0] === score[1] ? '¡Empate!' : `Ganó ${name}. ¡Qué memoria!`);
      game.stat('memoryGames');
      setTimeout(finish, 900);
    };
    sh.canvas.addEventListener('pointerdown', (e) => {
      if (done || busy || turn !== 0) return;
      const p = boardPos(sh.canvas, e);
      void runTask('memory:flip', () => flip(Math.floor(p.y / 32) * 4 + Math.floor(p.x / 32)));
    });
    draw();
    function finish() {
      if (done) return;
      done = true;
      sh.close();
      resolve();
    }
  });
}

export { iconElement };
