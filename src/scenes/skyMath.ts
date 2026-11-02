/** The numbers behind the sky and the hour bell: pure, so they can be tested without a scene. */

/** A random wait in seconds between `min` and `max`; `r` is a random number in [0, 1). */
export const wait = (r: number, min: number, max: number) => min + r * (max - min);

export const RAINBOW = { fadeIn: 4, hold: 66, fadeOut: 8 };
export const RAINBOW_LENGTH = RAINBOW.fadeIn + RAINBOW.hold + RAINBOW.fadeOut;

/** How visible the rainbow is `t` seconds after it appeared: 0 → 1 over the fade in, held, then back to 0. */
export function rainbowEnvelope(t: number): number {
  if (t <= 0 || t >= RAINBOW_LENGTH) return 0;
  if (t < RAINBOW.fadeIn) return t / RAINBOW.fadeIn;
  if (t < RAINBOW.fadeIn + RAINBOW.hold) return 1;
  return 1 - (t - RAINBOW.fadeIn - RAINBOW.hold) / RAINBOW.fadeOut;
}

/** A rainbow follows rain that clears by day (morning or afternoon). */
export function rainbowAfter(wasRaining: boolean, raining: boolean, period: number): boolean {
  return wasRaining && !raining && period <= 1;
}

/** The hour (0..23) of a time given in minutes since midnight; the night runs on past 24:00 into the next morning. */
export const hourOfDay = (dayMinutes: number) => Math.floor(Math.max(0, dayMinutes) / 60) % 24;

/** Strokes of the station clock at an hour: as many as the hour on a twelve-hour face, at most `cap`. */
export function bellStrokes(hour: number, cap = 6): number {
  const n = hour % 12 === 0 ? 12 : hour % 12;
  return Math.min(cap, n);
}

/** How loud the hour bell is from where the player stands: full in the station, faint in the streets beside it, none elsewhere. */
export function bellVolume(zone: string): number {
  return zone === 'station' ? 1 : zone === 'residential' || zone === 'shrine' || zone === 'plaza' ? 0.22 : 0;
}
