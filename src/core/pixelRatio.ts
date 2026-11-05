/**
 * Sharp pixels on any screen. A phone has 2.625 or 2.75 device pixels per CSS pixel; a canvas sized in CSS pixels was
 * stretched by that odd factor, so some game pixels came out one device pixel wider than others. Now the canvas holds
 * `s` pixels per CSS pixel, where `s = dpr / k` with a whole `k`: the browser then stretches it by exactly k device pixels
 * (with `image-rendering: pixelated`) and the camera's whole-number zoom lands on whole device pixels.
 *
 * `k` is the smallest whole number that keeps `s` under a cap (2 normally, 1 in battery mode), so a 3× phone does not
 * pay for nine times the pixels: 2.625 → s 1.3125 (k 2), 3 → 1.5 (k 2), 2 → 2 (k 1), 1.25 → 1.25 (k 1); battery mode
 * 2.625 → 0.875 (k 3), fewer pixels than before and still sharp.
 *
 * Game sizes (`scene.scale.width`) are canvas pixels. Anything measured in CSS pixels (a DOM panel's height, a HUD bar)
 * is multiplied by `gamePx()` before the camera uses it.
 */

export const SCALE_CAP = 2;
export const LOW_SCALE_CAP = 1;

/** Canvas pixels per CSS pixel for a screen with `dpr` device pixels per CSS pixel. */
export function backingScale(dpr: number, cap = SCALE_CAP): number {
  const d = Number.isFinite(dpr) && dpr > 0 ? dpr : 1;
  const k = Math.max(1, Math.ceil(d / cap - 1e-9));
  return d / k;
}

/**
 * The canvas size for a `cssW`×`cssH` box, and the zoom that shows it at that CSS size. Both sides are even: Phaser's
 * camera centres on half the canvas, and an odd side put the whole world half a canvas pixel off the game's grid (a
 * sliver of the next frame showed at the edge of a character). Rounding down leaves at most one CSS pixel uncovered.
 */
export function viewportFor(cssW: number, cssH: number, scale: number) {
  const even = (v: number) => Math.max(2, 2 * Math.floor(v / 2));
  return { width: even(cssW * scale), height: even(cssH * scale), zoom: 1 / scale };
}

let current = 1;
let refit: (() => void) | null = null;

/** Canvas pixels per CSS pixel right now. */
export function gamePx(): number { return current; }

/** Set by main.ts when it sizes the canvas. */
export function setGamePx(scale: number) { current = scale; }

/** main.ts registers how to resize the canvas; battery mode calls it when it switches. */
export function onRefitViewport(fn: () => void) { refit = fn; }
export function refitViewport() { refit?.(); }
