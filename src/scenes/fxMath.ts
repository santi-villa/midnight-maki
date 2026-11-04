/** The numbers behind the Phaser 4 effects (scenes/gpuWeather.ts, scenes/waterRipple.ts), kept apart so they can be tested without Phaser. */
export type GpuWeatherKind = 'snow' | 'rain' | 'leaves' | 'petals';

/** How many particles for an area of w×h world pixels (one per `per` square pixels, capped). */
export function particleCount(kind: GpuWeatherKind, w: number, h: number): number {
  const per = { snow: 700, rain: 520, leaves: 4200, petals: 6000 }[kind];
  const cap = { snow: 4000, rain: 5000, leaves: 700, petals: 450 }[kind];
  return Math.max(0, Math.min(cap, Math.round((w * h) / per)));
}

/**
 * One fall cycle of a particle, in ms: the time it takes to cross the area top to bottom at `speed` px/s. Exported for the
 * tests: the layer's animations loop on this.
 */
export function fallMs(height: number, speed: number) { return Math.round(((height + 40) / speed) * 1000); }


/** How many wave pictures the water cycles through. */
export const RIPPLE_FRAMES = 4;

/** The wave pattern, frame `f` of RIPPLE_FRAMES: red and green hold the sideways and up-down push around a neutral 128. */
export function rippleValue(x: number, y: number, f: number): [number, number] {
  const p = (f / RIPPLE_FRAMES) * Math.PI * 2;
  const dx = Math.sin(y * 0.55 + p) * 0.6 + Math.sin((x + y) * 0.21 - p) * 0.4;
  const dy = Math.cos(x * 0.47 - p) * 0.6 + Math.sin((x - y) * 0.18 + p) * 0.4;
  return [Math.round(128 + dx * 90), Math.round(128 + dy * 90)];
}

