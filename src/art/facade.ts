/**
 * Drawn over the restaurant facade sprite (112x90): the same building, four stages of care.
 * Coordinates follow the building sprite: walls start at y 35, the door is x 49..63, windows at x 8, 28, 69, 89.
 */
import { px, shade, type Ctx } from './pixel';

const WALL_Y = 35;
const WINDOWS = [8, 28, 69, 89];
const DOOR_X = 49;
const DOOR_W = 14;

function flowerBox(c: Ctx, x: number, bloom: string) {
  px(c, x - 1, WALL_Y + 19, '#7a4c30', 14, 4);
  px(c, x - 1, WALL_Y + 19, '#a8734d', 14, 1);
  for (let i = 0; i < 6; i++) {
    px(c, x + i * 2, WALL_Y + 17 + (i % 2), '#5f8a47', 1, 2);
    px(c, x + i * 2, WALL_Y + 16 + (i % 2), i % 3 ? bloom : '#fff6e4', 1, 1);
  }
}

export function facadeStage(c: Ctx, W: number, H: number, stage: number) {
  if (stage <= 0) {
    // weathered: stains on the plaster, missing roof tiles, dark windows, boards, weeds and unlit lanterns
    for (let i = 0; i < 16; i++) px(c, 5 + ((i * 29) % (W - 14)), WALL_Y + 4 + ((i * 11) % 36), i % 2 ? '#cdbd98' : '#bba983', 3 + (i % 3), 2 + (i % 2));
    for (const [x, y, w, h] of [[22, 12, 9, 4], [70, 20, 11, 4], [44, 5, 7, 3], [88, 9, 8, 3]]) px(c, x, y, '#3a2f3a', w, h);
    WINDOWS.forEach((x, i) => {
      px(c, x, WALL_Y + 8, '#2a2d46', 12, 10);
      px(c, x, WALL_Y + 8, '#3a3f5c', 12, 1);
      if (i === 1) {
        // boarded up
        px(c, x - 1, WALL_Y + 10, '#7a5a3c', 14, 3);
        px(c, x - 1, WALL_Y + 15, '#6a4c30', 14, 3);
      } else {
        for (let k = 0; k < 8; k++) px(c, x + 2 + k, WALL_Y + 9 + k, '#c9c6d4', 1, 1); // crack
      }
    });
    for (const lx of [DOOR_X - 6, DOOR_X + DOOR_W + 3]) {
      px(c, lx - 1, H - 28, '#8a8a92', 5, 8);
      px(c, lx, H - 27, '#6c6c74', 3, 6);
    }
    for (let x = 4; x < 16; x += 2) px(c, x, H - 3 - (x % 3), '#5f7a3e', 1, 3);
    for (let x = 88; x < 106; x += 2) px(c, x, H - 3 - (x % 4), '#5f7a3e', 1, 3);
    px(c, DOOR_X - 2, WALL_Y + 1, '#d8cfc0', 1, 6); // cobweb
    px(c, DOOR_X - 3, WALL_Y + 2, '#d8cfc0', 3, 1);
    return;
  }
  // recovered and beyond: flower boxes under two windows
  flowerBox(c, WINDOWS[0], '#f47fa0');
  flowerBox(c, WINDOWS[3], '#f2c66d');
  if (stage >= 2) {
    // popular: striped awning over the door, a noren curtain and a string of little lanterns
    for (let i = 0; i < DOOR_W + 8; i += 4) {
      px(c, DOOR_X - 4 + i, H - 33, i % 8 ? '#f6e3d0' : '#c94a4a', 4, 6);
      px(c, DOOR_X - 4 + i, H - 28, shade(i % 8 ? '#f6e3d0' : '#c94a4a', -0.2), 4, 1);
    }
    for (let i = 0; i < 4; i++) {
      px(c, DOOR_X + 1 + i * 3, H - 27, '#2f3b6a', 2, 9);
      px(c, DOOR_X + 1 + i * 3, H - 22, '#f6e3d0', 2, 1);
    }
    for (let x = 6; x < W - 6; x += 7) {
      px(c, x, WALL_Y + 3 + (x % 2), '#4a3428', 1, 1);
      px(c, x, WALL_Y + 4 + (x % 2), '#e0653a', 2, 2);
    }
  }
  if (stage >= 3) {
    // heart of the village: gold trim, three stars on the ridge, paper lanterns, warm glow in the windows
    px(c, 0, Math.floor(H * 0.42) - 2, '#f2c66d', W, 1);
    for (const sx of [W / 2 - 10, W / 2 - 1, W / 2 + 8]) {
      px(c, sx, 3, '#f2c66d', 3, 3);
      px(c, sx + 1, 1, '#f2c66d', 1, 7);
      px(c, sx - 1, 4, '#f2c66d', 5, 1);
      px(c, sx + 1, 4, '#fff6c8', 1, 1);
    }
    for (const lx of [26, 84]) {
      px(c, lx, WALL_Y + 1, '#4a3428', 1, 5);
      px(c, lx - 3, WALL_Y + 6, '#d9675f', 7, 8);
      px(c, lx - 2, WALL_Y + 7, '#f4b08c', 2, 3);
      px(c, lx - 3, WALL_Y + 6, '#f2c66d', 7, 1);
      px(c, lx - 3, WALL_Y + 13, '#f2c66d', 7, 1);
    }
    for (const x of WINDOWS) px(c, x + 1, WALL_Y + 9, 'rgba(255,214,120,.35)', 10, 8);
  }
}
