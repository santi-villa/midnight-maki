/** Place world speech bubbles without overlap, keeping them inside the camera. */
export interface SpeechRect { x: number; y: number; width: number; height: number }
export function layoutSpeech(rects: SpeechRect[], view: SpeechRect, gap = 3): SpeechRect[] {
  const placed: SpeechRect[] = [];
  const clamp = (r: SpeechRect): SpeechRect => ({ ...r,
    x: Math.max(view.x + gap, Math.min(r.x, view.x + view.width - r.width - gap)),
    y: Math.max(view.y + gap, Math.min(r.y, view.y + view.height - r.height - gap)),
  });
  const overlap = (a: SpeechRect, b: SpeechRect) =>
    Math.max(0, Math.min(a.x + a.width + gap, b.x + b.width + gap) - Math.max(a.x, b.x)) *
    Math.max(0, Math.min(a.y + a.height + gap, b.y + b.height + gap) - Math.max(a.y, b.y));
  for (const base of rects) {
    const candidates = [clamp(base)];
    for (const p of placed) {
      candidates.push(clamp({ ...base, y: p.y - base.height - gap }), clamp({ ...base, y: p.y + p.height + gap }),
        clamp({ ...base, x: p.x - base.width - gap }), clamp({ ...base, x: p.x + p.width + gap }));
    }
    candidates.sort((a, b) => {
      const score = (r: SpeechRect) => placed.reduce((s, p) => s + overlap(r, p), 0) * 10000 + Math.hypot(r.x - base.x, r.y - base.y);
      return score(a) - score(b);
    });
    placed.push(candidates[0]);
  }
  return placed;
}
