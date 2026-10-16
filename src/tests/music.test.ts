import { describe, expect, it } from 'vitest';
import { songURLs } from '../audio/audio';

describe('custom songs', () => {
  it('tries an ogg before the m4a for the title and the intro', () => {
    for (const track of ['title', 'intro'] as const) {
      const urls = songURLs(track);
      expect(urls.length).toBeGreaterThanOrEqual(2);
      expect(urls[0]).toMatch(/\.ogg/);
      expect(urls.some((url) => url.includes('.m4a'))).toBe(true);
    }
  });
});
