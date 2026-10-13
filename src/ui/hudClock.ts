/** Small pixel clock, using the same canvas palette as the game's wooden UI. */
import { ctx2d, ellipse, px } from '../art/pixel';

export { dayMinutes as hudTime } from '../systems/daytime';

/** Presentation wraps midnight while leaving the existing period/day clock untouched. */
export function formatHudTime(minutes: number): string {
  const value = Number.isFinite(minutes) ? Math.floor(minutes) : 0;
  const dayMinute = ((value % 1440) + 1440) % 1440;
  return `${String(Math.floor(dayMinute / 60)).padStart(2, '0')}:${String(dayMinute % 60).padStart(2, '0')}`;
}

export function paintHudClock(canvas: HTMLCanvasElement, minutes: number) {
  const label = formatHudTime(minutes);
  canvas.setAttribute('aria-label', `Hora del juego: ${label}`);
  canvas.title = label;
  if (canvas.dataset.time === label) return;
  canvas.dataset.time = label;
  const g = ctx2d(canvas);
  g.clearRect(0, 0, 32, 32);
  ellipse(g, 15.5, 16.5, 15, 15, '#38251c');
  ellipse(g, 15.5, 15.5, 15, 15, '#38251c');
  ellipse(g, 15.5, 15.5, 13.5, 13.5, '#bd8e63');
  ellipse(g, 15.5, 15.5, 12, 12, '#765034');
  ellipse(g, 15.5, 15.5, 11, 11, '#f2dfb3');
  ellipse(g, 15, 15, 9.5, 9.5, '#faebc9');
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI / 6 - Math.PI / 2;
    px(g, Math.round(15.5 + Math.cos(a) * 9), Math.round(15.5 + Math.sin(a) * 9), '#896341', i % 3 === 0 ? 2 : 1, i % 3 === 0 ? 2 : 1);
  }
  const hand = (angle: number, length: number, color: string, width: number) => {
    for (let d = 0; d <= length; d += 0.5) px(g, Math.round(16 + Math.cos(angle) * d), Math.round(16 + Math.sin(angle) * d), color, width, width);
  };
  hand((minutes % 720) / 720 * Math.PI * 2 - Math.PI / 2, 5, '#513722', 2);
  hand((minutes % 60) / 60 * Math.PI * 2 - Math.PI / 2, 8, '#a14b35', 1);
  px(g, 15, 15, '#513722', 3, 3);
  px(g, 16, 16, '#d8ad73');
}
