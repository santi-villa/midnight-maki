import { describe, expect, it } from 'vitest';
import {
  clampFrameZoom,
  panScroll,
  photoSubject,
  scrollUnderPoint,
  walkingZoom,
  zoomLabel,
  zoomScroll,
  zoomStep,
} from '../ui/frameMath';

describe('phone camera frame', () => {
  it('keeps the walking zoom formula', () => {
    expect(walkingZoom(400, 800, 16)).toBe(2);
    expect(walkingZoom(1920, 1080, 16)).toBe(6);
    expect(walkingZoom(100, 200, 16)).toBe(2);
  });

  it('snaps zoom to whole steps between the walking zoom and three times that', () => {
    expect(clampFrameZoom(2.4, 2)).toBe(2);
    expect(clampFrameZoom(2.6, 2)).toBe(3);
    expect(clampFrameZoom(1, 2)).toBe(2);
    expect(clampFrameZoom(100, 2)).toBe(6);
    expect(clampFrameZoom(4, 2)).toBe(4);
  });

  it('steps the buttons by about half a walking zoom', () => {
    expect(zoomStep(2)).toBe(1);
    expect(zoomStep(4)).toBe(2);
    expect(zoomStep(6)).toBe(3);
  });

  it('pans so the world follows the finger', () => {
    expect(panScroll(10, 10, 20, -8, 2)).toEqual({ scrollX: 0, scrollY: 14 });
  });

  it('keeps the same world point under the focus when zooming', () => {
    const next = zoomScroll(100, 50, 2, 4, 40, 20);
    expect(next.scrollX + 40 / 4).toBeCloseTo(100 + 40 / 2);
    expect(next.scrollY + 20 / 4).toBeCloseTo(50 + 20 / 2);
    expect(zoomScroll(100, 50, 2, 2, 40, 20)).toEqual({ scrollX: 100, scrollY: 50 });
  });

  it('places a pinched world point under the new finger midpoint', () => {
    expect(scrollUnderPoint(120, 60, 40, 20, 4)).toEqual({ scrollX: 110, scrollY: 55 });
  });

  it('labels zoom relative to the walking zoom', () => {
    expect(zoomLabel(2, 2)).toBe('1×');
    expect(zoomLabel(3, 2)).toBe('1.5×');
    expect(zoomLabel(6, 2)).toBe('3×');
  });

  it('names the closest person within 80px and flags every raccoon there', () => {
    const shot = photoSubject(
      [
        { id: 'spicy', name: 'Spicy', x: 30, y: 0, raccoon: true },
        { id: 'pip', name: 'Pip', x: 0, y: 0, raccoon: true },
        { id: 'taro', name: 'Taro', x: 70, y: 0 },
      ],
      { x: 0, y: 0 },
      'Plaza',
    );
    expect(shot).toEqual({ subject: 'Pip', raccoons: ['spicy', 'pip'] });
  });

  it('ignores someone at 80px or more, and prefers a nearer neighbour over a raccoon', () => {
    expect(photoSubject([{ id: 'pip', name: 'Pip', x: 80, y: 0, raccoon: true }], { x: 0, y: 0 }, 'Plaza')).toEqual({
      subject: 'Plaza',
      raccoons: [],
    });
    expect(
      photoSubject(
        [
          { id: 'taro', name: 'Taro', x: 0, y: 0 },
          { id: 'pip', name: 'Pip', x: 40, y: 0, raccoon: true },
        ],
        { x: 0, y: 0 },
        'Plaza',
      ),
    ).toEqual({ subject: 'Taro', raccoons: ['pip'] });
  });

  it('counts a framed body, including a close-up whose feet fall past the edge, and skips someone outside it', () => {
    const pip = { id: 'pip', name: 'Pip', x: 20, y: 50, raccoon: true };
    const tight = { x: 0, y: 0, right: 40, bottom: 30 };
    expect(photoSubject([pip], { x: 20, y: 20 }, 'Plaza', tight)).toEqual({ subject: 'Pip', raccoons: ['pip'] });
    const missed = { x: 0, y: 0, right: 20, bottom: 20 };
    expect(photoSubject([{ id: 'pip', name: 'Pip', x: 200, y: 200, raccoon: true }], { x: 200, y: 200 }, 'Plaza', missed)).toEqual({
      subject: 'Plaza',
      raccoons: [],
    });
  });
});
