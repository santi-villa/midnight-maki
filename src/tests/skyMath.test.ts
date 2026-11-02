import { describe, expect, it } from 'vitest';
import { bellStrokes, bellVolume, hourOfDay, rainbowAfter, rainbowEnvelope, RAINBOW, RAINBOW_LENGTH, wait } from '../scenes/skyMath';

describe('sky and hour bell', () => {
  it('fades the rainbow in, holds it, and fades it out to nothing', () => {
    expect(rainbowEnvelope(0)).toBe(0);
    expect(rainbowEnvelope(RAINBOW.fadeIn / 2)).toBeCloseTo(0.5);
    expect(rainbowEnvelope(RAINBOW.fadeIn)).toBe(1);
    expect(rainbowEnvelope(RAINBOW.fadeIn + RAINBOW.hold / 2)).toBe(1);
    expect(rainbowEnvelope(RAINBOW_LENGTH - RAINBOW.fadeOut / 2)).toBeCloseTo(0.5);
    expect(rainbowEnvelope(RAINBOW_LENGTH)).toBe(0);
    expect(rainbowEnvelope(-3)).toBe(0);
  });

  it('shows a rainbow only when rain clears by day', () => {
    expect(rainbowAfter(true, false, 0)).toBe(true);
    expect(rainbowAfter(true, false, 1)).toBe(true);
    expect(rainbowAfter(true, false, 2)).toBe(false); // dusk
    expect(rainbowAfter(true, false, 3)).toBe(false); // night
    expect(rainbowAfter(false, false, 1)).toBe(false); // it was not raining
    expect(rainbowAfter(true, true, 1)).toBe(false); // still raining
    expect(rainbowAfter(false, true, 1)).toBe(false); // it just began
  });

  it('strikes the hour on a twelve-hour face, but never more than the cap', () => {
    expect([1, 2, 3, 4].map((h) => bellStrokes(h))).toEqual([1, 2, 3, 4]);
    expect(bellStrokes(12)).toBe(6); // twelve strokes, capped
    expect(bellStrokes(0)).toBe(6); // midnight rings twelve too
    expect(bellStrokes(13)).toBe(1);
    expect(bellStrokes(15, 12)).toBe(3);
    expect(bellStrokes(0, 12)).toBe(12);
  });

  it('rings loud in the station, faintly in the streets beside it, and nowhere else', () => {
    expect(bellVolume('station')).toBe(1);
    expect(bellVolume('residential')).toBeGreaterThan(0);
    expect(bellVolume('residential')).toBeLessThan(0.5);
    expect(bellVolume('restaurant')).toBe(0);
    expect(bellVolume('beach')).toBe(0);
  });

  it('reads the hour of the day from minutes, with the night running past midnight', () => {
    expect(hourOfDay(0)).toBe(0);
    expect(hourOfDay(13 * 60 + 40)).toBe(13);
    expect(hourOfDay(24 * 60 + 70)).toBe(1);
    expect(hourOfDay(-5)).toBe(0);
  });

  it('draws a wait between its limits', () => {
    expect(wait(0, 20, 60)).toBe(20);
    expect(wait(0.5, 20, 60)).toBe(40);
    expect(wait(0.999, 20, 60)).toBeLessThan(60);
  });
});
