/**
 * Fishing, in four beats: cast, wait for the bite, hook it fast, then reel: hold to raise the green zone and follow the fish.
 * Fish wander, some dart after a warning, and air bubbles drift up: catch one with the zone for a bonus.
 * Losing a fish costs nothing.
 */
import { iconCanvas, iconElement } from '../art/icons';
import { audio } from '../audio/audio';
import { haptic } from '../core/haptics';
import { settings } from '../core/settings';
import { game } from '../core/state';
import { ITEMS_BY_ID } from '../data/items';
import { obtain, rollFish } from '../systems/collect';
import { bestRod, greenZone, tuneOf } from '../systems/rods';
import { h, toast } from '../ui/dom';
import { shell } from './common';

type State = 'cast' | 'wait' | 'bite' | 'reel' | 'won' | 'end';
interface Bubble { x: number; y: number; life: number; got: boolean }
interface Spark { x: number; y: number; vx: number; vy: number; life: number; c: string }

export function fish(kind: 'sea' | 'lake'): Promise<string | null> {
  return new Promise((resolve) => {
    const equipped = bestRod(game.save.inventory);
    if (!equipped) {
      toast('Para pescar hace falta una caña.');
      resolve(null);
      return;
    }
    const tune = tuneOf(equipped.id);
    const W = 96;
    const H = 180;
    const SURFACE = 22;
    let state: State = 'cast';
    const roll = rollFish(kind, tune.rare);
    const it = ITEMS_BY_ID[roll.id];
    const icon = iconCanvas(it.icon);
    const relaxed = settings.cookMode === 'relaxed';
    const d = Math.max(0, roll.difficulty);
    const zoneH = greenZone(d, relaxed, tune) * (H / 160);
    let zoneY = H - zoneH - 10;
    let zoneV = 0;
    let fishY = H * 0.55;
    let fishX = W / 2 - 8;
    let fishT = 0;
    let fishTarget = fishY;
    let dartIn = 2.5 + Math.random() * 2;
    let warn = 0;
    let dashing = 0;
    let progress = 0.25;
    let holding = false;
    let waitT = 0;
    let biteT = 0;
    let biteLeft = 0;
    let bubbleT = 1.2;
    let combo = 0;
    let comboShown = 0;
    let shake = 0;
    let wonT = 0;
    let raf = 0;
    let last = performance.now();
    let castT = 0;
    const bubbles: Bubble[] = [];
    const sparks: Spark[] = [];
    const sh = shell(kind === 'sea' ? 'Pesca en el mar' : 'Pesca en el lago', W, H, 2, () => end(false));
    const say = (t: string) => { sh.info.textContent = t; };
    say(tune.name);
    const btn = h('button', { class: 'btn primary', style: { minWidth: '180px', minHeight: '60px', fontSize: '1.1em' } }, 'Lanzar') as HTMLButtonElement;
    sh.buttons.append(btn);
    const label = (t: string) => { if (btn.textContent !== t) btn.textContent = t; };

    const burst = (x: number, y: number, n: number, c: string) => {
      if (settings.reduceMotion) return;
      for (let i = 0; i < n; i++) sparks.push({ x, y, vx: (Math.random() - 0.5) * 90, vy: -20 - Math.random() * 70, life: 0.5 + Math.random() * 0.4, c });
    };

    const startWait = (again = false) => {
      state = 'wait';
      waitT = (1.2 + Math.random() * 2.2) * tune.bite;
      label('Esperando…');
      say(again ? 'Se soltó. Esperá otro pique.' : 'La línea está en el agua. Esperá el pique…');
    };

    const down = (e: Event) => {
      e.preventDefault();
      if (state === 'cast') {
        state = 'wait';
        castT = 0.5;
        audio.sfxPlay('splash');
        haptic('tap');
        startWait();
      } else if (state === 'wait') {
        say('Paciencia… todavía no pica.');
      } else if (state === 'bite') {
        const quick = biteLeft - biteT < 0.45;
        state = 'reel';
        progress = quick ? 0.42 : 0.28;
        audio.sfxPlay('splash');
        haptic('light' as never);
        burst(W / 2, SURFACE + 8, 12, '#ffffff');
        label('Mantener');
        say(quick ? '¡Gran anzuelada!' : 'Seguí al pez con la zona verde.');
      }
      holding = true;
    };
    const up = () => (holding = false);
    for (const el of [btn, sh.canvas]) {
      el.addEventListener('pointerdown', down);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointerleave', up);
      el.addEventListener('pointercancel', up);
    }
    const key = (e: KeyboardEvent) => {
      if (e.repeat) return;
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
        toast(`${first ? '¡Nuevo! ' : ''}Pescaste: ${it.name}`, iconElement(it.icon));
        resolve(roll.id);
      } else resolve(null);
    }

    const water = (g: CanvasRenderingContext2D, t: number) => {
      const sea = kind === 'sea';
      const sky = g.createLinearGradient(0, 0, 0, SURFACE);
      sky.addColorStop(0, sea ? '#f7d9a8' : '#cfe8c2');
      sky.addColorStop(1, sea ? '#f3b9a0' : '#a9d3b8');
      g.fillStyle = sky;
      g.fillRect(0, 0, W, SURFACE);
      const grad = g.createLinearGradient(0, SURFACE, 0, H);
      grad.addColorStop(0, sea ? '#7fc0d6' : '#8cc7ae');
      grad.addColorStop(1, sea ? '#2f4f7c' : '#3f6b57');
      g.fillStyle = grad;
      g.fillRect(0, SURFACE, W, H - SURFACE);
      // light rays and drifting glints
      g.fillStyle = 'rgba(255,255,255,.07)';
      for (let i = 0; i < 3; i++) { const x = 10 + i * 30 + Math.sin(t / 1600 + i) * 4; g.fillRect(x, SURFACE, 8, H - SURFACE - 30); }
      g.fillStyle = 'rgba(255,255,255,.18)';
      for (let i = 0; i < 5; i++) g.fillRect(((t / 40 + i * 37) % (W + 20)) - 10, SURFACE + 8 + i * 30, 8, 1);
      // wavy surface line
      g.fillStyle = 'rgba(255,255,255,.55)';
      for (let x = 0; x < W; x += 4) g.fillRect(x, SURFACE + Math.round(Math.sin(t / 400 + x / 6)), 3, 1);
      // lazy fish silhouettes in the background
      g.fillStyle = 'rgba(20,40,70,.22)';
      for (let i = 0; i < 3; i++) {
        const x = ((t / (50 + i * 17) + i * 41) % (W + 30)) - 15;
        const y = 60 + i * 38 + Math.sin(t / 700 + i) * 3;
        g.fillRect(x, y, 9, 3); g.fillRect(x + 9, y - 1, 2, 5);
      }
    };

    const loop = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      const g = sh.g;
      g.save();
      if (shake > 0) { shake = Math.max(0, shake - dt); g.translate(Math.round((Math.random() - 0.5) * 4), Math.round((Math.random() - 0.5) * 3)); }
      water(g, t);

      if (state === 'cast' || state === 'wait' || state === 'bite') {
        const bob = Math.sin(t / 300) * 1.5;
        const bx = W / 2;
        const by = SURFACE + 14 + bob;
        // the line comes from the rod tip at the top corner
        g.strokeStyle = 'rgba(255,255,255,.7)';
        g.beginPath(); g.moveTo(W - 8, 2); g.lineTo(bx, SURFACE + bob); g.stroke();
        g.fillStyle = '#6a4a2a'; g.fillRect(W - 20, 0, 16, 3);
        if (state !== 'cast') {
          g.fillStyle = '#d9675f'; g.fillRect(bx - 2, by - 6, 4, 6);
          g.fillStyle = '#f6ecd6'; g.fillRect(bx - 2, by, 4, 3);
          // ripples
          g.strokeStyle = 'rgba(255,255,255,.35)';
          const r = (t / 120) % 12;
          g.strokeRect(bx - 4 - r / 2, SURFACE + 1 - 0, 8 + r, 1);
        } else {
          g.fillStyle = '#f6ecd6'; g.font = '8px monospace'; g.fillText('¡Lanzá!', W / 2 - 14, 70);
        }
      }

      if (state === 'wait') {
        castT = Math.max(0, castT - dt);
        waitT -= dt;
        // a shadow swims towards the bobber just before the bite
        if (waitT < 1.1) {
          const k = 1 - Math.max(0, waitT) / 1.1;
          const sx = W / 2 + (1 - k) * 34, sy = SURFACE + 26 + (1 - k) * 8;
          g.fillStyle = 'rgba(20,40,70,.45)'; g.fillRect(sx - 6, sy, 12, 4); g.fillRect(sx + 6, sy - 1, 3, 6);
        }
        if (waitT <= 0) {
          state = 'bite';
          biteLeft = biteT = (relaxed ? 2.4 : 1.4) * tune.hook;
          audio.sfxPlay('bite');
          haptic('tap');
          label('¡AHORA!');
          say('¡Picó!');
        }
      } else if (state === 'bite') {
        biteT -= dt;
        const s = Math.sin(t / 25) * 2;
        g.fillStyle = '#ffe08a'; g.fillRect(W / 2 - 2 + s, SURFACE - 14, 4, 8); g.fillRect(W / 2 - 2 + s, SURFACE - 4, 4, 3);
        // time left to react
        // a small bar under the fish: when it empties, the fish swims away
        const left = Math.max(0, biteT / biteLeft);
        g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(W / 2 - 15, SURFACE + 7, 30, 5);
        g.fillStyle = left > 0.35 ? '#ffe08a' : '#f08a7a'; g.fillRect(W / 2 - 14, SURFACE + 8, 28 * left, 3);
        if (biteT <= 0) { startWait(true); }
      } else if (state === 'reel' || state === 'won') {
        const reeling = state === 'reel';
        if (reeling) {
          // the fish wanders; harder ones also dart after a short warning
          fishT -= dt;
          if (dashing <= 0 && fishT <= 0) {
            fishT = 0.5 + Math.random() * (1.3 - Math.min(0.5, d * 0.1));
            fishTarget = SURFACE + 14 + Math.random() * (H - SURFACE - 30);
          }
          dartIn -= dt;
          if (warn <= 0 && dashing <= 0 && dartIn <= 0 && !relaxed) { warn = 0.45; shake = 0.2; audio.sfxPlay('bite'); }
          if (warn > 0) {
            warn -= dt;
            if (warn <= 0) {
              dashing = 0.55;
              fishTarget = fishY < H / 2 ? H - 20 - Math.random() * 20 : SURFACE + 14 + Math.random() * 20;
              dartIn = Math.max(1.8, 4.5 - d * 0.5) + Math.random() * 2;
            }
          }
          if (dashing > 0) dashing -= dt;
          const pace = dashing > 0 ? 4.2 : (1 + d * 0.55) * (relaxed ? 0.75 : 1);
          fishY += (fishTarget - fishY) * Math.min(1, dt * pace);
          fishX = W / 2 - 8 + Math.sin(t / 380) * 6 + (dashing > 0 ? Math.sin(t / 30) * 2 : 0);
          // Hold rises, release sinks. Drag is per second: a per-frame factor froze the zone on fast screens.
          const push = (holding ? -980 : 760) * tune.control;
          zoneV = (zoneV + push * dt) * Math.exp(-2.8 * dt);
          const cap = 220 * tune.control;
          if (zoneV > cap) zoneV = cap;
          else if (zoneV < -cap) zoneV = -cap;
          zoneY = Math.max(SURFACE, Math.min(H - zoneH, zoneY + zoneV * dt));
          if (zoneY === SURFACE || zoneY === H - zoneH) zoneV = 0;
          const inside = fishY > zoneY && fishY < zoneY + zoneH;
          progress += (inside ? 0.3 * tune.gain : relaxed ? -0.09 : -0.16) * dt;
          if (inside && Math.random() < dt * 14) burst(fishX + 8, fishY, 1, '#e8f5e0');
          // bubbles with a bonus
          bubbleT -= dt;
          if (bubbleT <= 0 && bubbles.length < 3) { bubbleT = 1.6 + Math.random() * 1.6; bubbles.push({ x: 20 + Math.random() * (W - 56), y: H - 14, life: 5, got: false }); }
          for (const b of bubbles) {
            b.life -= dt; b.y -= dt * 22; b.x += Math.sin(t / 300 + b.y) * dt * 8;
            if (!b.got && b.y > zoneY && b.y < zoneY + zoneH) {
              b.got = true; b.life = 0.25; combo++; comboShown = 1.2;
              progress = Math.min(1, progress + 0.07 + Math.min(4, combo) * 0.01);
              audio.sfxPlay('sparkle'); haptic('light' as never);
              burst(b.x, b.y, 8, '#fff6d0');
            }
          }
          for (let i = bubbles.length - 1; i >= 0; i--) if (bubbles[i].life <= 0 || bubbles[i].y < SURFACE) { if (!bubbles[i].got) combo = 0; bubbles.splice(i, 1); }
          if (progress >= 1) {
            state = 'won'; wonT = 1.15;
            audio.sfxPlay('success'); haptic('excellent');
            label('¡Listo!'); say(`¡Pescaste ${it.name}!`);
            burst(W / 2, H / 2, 24, '#ffe08a');
          } else if (progress <= 0) {
            toast('El pez se escapó. ¡Otra vez será!');
            return end(false);
          }
        }
        if (reeling) {
          // zone
          g.fillStyle = 'rgba(155,220,140,.5)'; g.fillRect(10, zoneY, W - 34, zoneH);
          g.strokeStyle = '#e8f5e0'; g.strokeRect(10.5, zoneY + 0.5, W - 35, zoneH - 1);
          for (const b of bubbles) {
            g.fillStyle = b.got ? 'rgba(255,246,208,.9)' : 'rgba(255,255,255,.55)';
            g.beginPath(); g.arc(b.x, b.y, b.got ? 6 : 4, 0, Math.PI * 2); g.fill();
            g.fillStyle = 'rgba(255,255,255,.9)'; g.fillRect(b.x - 1, b.y - 2, 1, 1);
          }
          if (warn > 0) { g.fillStyle = '#ffe08a'; g.font = 'bold 14px monospace'; g.fillText('!', fishX + 18, fishY + 2); }
          g.drawImage(icon, fishX, fishY - 8, 16, 16);
          if (comboShown > 0) { comboShown -= dt; if (combo >= 2) { g.fillStyle = '#ffe08a'; g.font = 'bold 9px monospace'; g.fillText(`x${combo}`, W - 34, SURFACE + 14); } }
          // progress bar
          g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(W - 18, SURFACE + 2, 10, H - SURFACE - 8);
          g.fillStyle = progress > 0.66 ? '#f2c66d' : progress > 0.33 ? '#a9d98b' : '#d9a3a6';
          const ph = (H - SURFACE - 8) * Math.max(0, Math.min(1, progress));
          g.fillRect(W - 18, H - 6 - ph, 10, ph);
        } else {
          // the catch jumps out of the water
          wonT -= dt;
          const k = Math.max(0, wonT) / 1.15;
          const s = 3.2 + Math.sin((1 - k) * Math.PI) * 1.2;
          g.drawImage(icon, W / 2 - 8 * s, H / 2 - 8 * s - (1 - k) * 18, 16 * s, 16 * s);
          if (wonT <= 0) { return end(true); }
        }
      }

      // sparks
      for (let i = sparks.length - 1; i >= 0; i--) {
        const p = sparks[i];
        p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 120 * dt;
        if (p.life <= 0) { sparks.splice(i, 1); continue; }
        g.fillStyle = p.c; g.fillRect(Math.round(p.x), Math.round(p.y), 2, 2);
      }
      g.restore();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
  });
}
