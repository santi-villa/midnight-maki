/**
 * Weather drawn by the GPU (Phaser 4's SpriteGPULayer): thousands of snowflakes, raindrops, autumn leaves or spring petals
 * over the whole village in one draw call. Every particle is placed once and its fall, sway and spin are tween-like
 * animations the shader runs on its own (looping forever, each one out of step with the others), so the CPU does nothing
 * per frame: denser weather at no cost. Battery mode and reduced motion keep the old, lighter effects instead.
 */
import Phaser from 'phaser';
import { richFx } from './gpuProbe';
import { fallMs, particleCount, type GpuWeatherKind } from './fxMath';

export type { GpuWeatherKind };


const KEY = 'gpu_weather';
/** The particles' little pictures, in one 32×8 texture (one image only: the layer cannot use several). */
const FRAMES: Record<string, { x: number; y: number; w: number; h: number; draw: (g: CanvasRenderingContext2D, x: number, y: number) => void }> = {
  snow: { x: 0, y: 0, w: 2, h: 2, draw: (g, x, y) => { g.fillStyle = '#ffffff'; g.fillRect(x, y, 2, 2); } },
  snowBig: { x: 3, y: 0, w: 3, h: 3, draw: (g, x, y) => { g.fillStyle = '#f4f8ff'; g.fillRect(x + 1, y, 1, 3); g.fillRect(x, y + 1, 3, 1); } },
  rain: { x: 7, y: 0, w: 1, h: 6, draw: (g, x, y) => { g.fillStyle = '#bcd4e6'; g.fillRect(x, y, 1, 6); } },
  petal: { x: 9, y: 0, w: 3, h: 3, draw: (g, x, y) => { g.fillStyle = '#f9cad8'; g.fillRect(x + 1, y, 2, 2); g.fillRect(x, y + 1, 2, 1); g.fillStyle = '#ee9fb8'; g.fillRect(x + 1, y + 2, 1, 1); } },
  leaf0: { x: 13, y: 0, w: 3, h: 3, draw: (g, x, y) => leaf(g, x, y, '#e8963e', '#b9622a') },
  leaf1: { x: 17, y: 0, w: 3, h: 3, draw: (g, x, y) => leaf(g, x, y, '#d8563a', '#9c3424') },
  leaf2: { x: 21, y: 0, w: 3, h: 3, draw: (g, x, y) => leaf(g, x, y, '#ecc04a', '#b98a2a') },
};
function leaf(g: CanvasRenderingContext2D, x: number, y: number, a: string, b: string) {
  g.fillStyle = a; g.fillRect(x + 2, y, 1, 1); g.fillRect(x + 1, y + 1, 1, 1);
  g.fillStyle = b; g.fillRect(x + 2, y + 1, 1, 1); g.fillRect(x, y + 2, 1, 1); g.fillRect(x + 1, y + 2, 1, 1);
}

function texture(scene: Phaser.Scene): string {
  if (scene.textures.exists(KEY)) return KEY;
  const c = document.createElement('canvas');
  c.width = 32; c.height = 8;
  const g = c.getContext('2d')!;
  for (const f of Object.values(FRAMES)) f.draw(g, f.x, f.y);
  const tex = scene.textures.addCanvas(KEY, c)!;
  for (const [name, f] of Object.entries(FRAMES)) tex.add(name, 0, f.x, f.y, f.w, f.h);
  return KEY;
}

/** Fills a SpriteGPULayer over a w×h area (world pixels from 0,0) with falling particles. Returns null without WebGL. */
export function gpuWeather(scene: Phaser.Scene, kind: GpuWeatherKind, w: number, h: number, depth: number, rand = Math.random): Phaser.GameObjects.SpriteGPULayer | null {
  if (!richFx(scene.renderer)) return null;
  const n = particleCount(kind, w, h);
  if (!n) return null;
  const layer = scene.add.spriteGPULayer(texture(scene), n).setDepth(depth);
  const r = (a: number, b: number) => a + rand() * (b - a);
  for (let i = 0; i < n; i++) {
    let speed: number, frame: string, alpha = 1, drift = 0, swing = 0, spin = 0, flip = false;
    if (kind === 'snow') { speed = r(14, 30); frame = rand() < 0.2 ? 'snowBig' : 'snow'; alpha = r(0.7, 1); drift = r(-8, 8); swing = r(4, 12); }
    else if (kind === 'rain') { speed = r(170, 320); frame = 'rain'; alpha = r(0.18, 0.4); drift = -speed * 0.28; }
    else if (kind === 'leaves') { speed = r(10, 20); frame = 'leaf' + Math.floor(rand() * 3); drift = r(-6, 16); swing = r(8, 18); spin = r(2, 5); flip = true; }
    else { speed = r(7, 13); frame = 'petal'; drift = r(4, 14); swing = r(6, 14); spin = r(2, 4); flip = true; }
    const dur = fallMs(h, speed);
    const x0 = r(0, w);
    layer.addMember({
      frame,
      // the fall: from just above the area to just below it, then again from the top
      y: { base: -20, amplitude: h + 40, duration: dur, ease: 'Linear', loop: true, yoyo: false },
      // drifting with the wind across the fall, plus a gentle side to side
      x: drift ? { base: x0, amplitude: drift * (dur / 1000), duration: dur, ease: 'Linear', loop: true, yoyo: false } : x0,
      ...(swing ? { scaleX: flip ? { base: -1, amplitude: 2, duration: r(900, 1800), ease: 'Sine.easeInOut', loop: true, yoyo: true } : 1 } : {}),
      rotation: kind === 'rain' ? 0.27 : spin ? { base: 0, amplitude: Math.PI * 2, duration: r(2500, 5000) / spin * 3, ease: 'Linear', loop: true, yoyo: false } : 0,
      alpha,
      // each one somewhere along its fall already: no wave of particles starting together
      creationTime: -r(0, dur),
    } as unknown as Phaser.Types.GameObjects.SpriteGPULayer.Member);
  }
  return layer;
}
