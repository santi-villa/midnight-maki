/**
 * Street furniture for the enlarged village: obstacles that visibly close a path until the story opens it
 * (fallen logs, vine-choked gate, works barricade, garden gate, market rope), side-entrance houses and a small shrine.
 */
import { ellipse, px, shade, type Ctx } from './pixel';

type DrawFn = (c: Ctx, W: number, H: number, c1: string, c2: string, rot: number, r: () => number) => void;

const INK = '#2b1d17';
const BARK = '#7a4c30';

function log(c: Ctx, x: number, y: number, len: number, h: number, col: string, endLeft = true) {
  px(c, x, y, INK, len, h);
  px(c, x + 1, y + 1, col, len - 2, h - 2);
  px(c, x + 1, y + 1, shade(col, 0.22), len - 2, 1);
  px(c, x + 1, y + h - 2, shade(col, -0.3), len - 2, 1);
  for (let i = 6; i < len - 4; i += 9) px(c, x + i, y + 2, shade(col, -0.25), 3, 1);
  const ex = endLeft ? x : x + len - h;
  ellipse(c, ex + h / 2, y + h / 2, h / 2, h / 2, INK);
  ellipse(c, ex + h / 2, y + h / 2, h / 2 - 1, h / 2 - 1, '#d9b27c');
  ellipse(c, ex + h / 2, y + h / 2, h / 4, h / 4, '#b98a57');
}

function leaves(c: Ctx, x: number, y: number, n: number, r: () => number) {
  for (let i = 0; i < n; i++) {
    const lx = x + Math.round((r() - 0.5) * 14);
    const ly = y + Math.round((r() - 0.5) * 8);
    px(c, lx, ly, r() > 0.5 ? '#2f8a3e' : '#6cc456', 3, 2);
    px(c, lx + 1, ly - 1, '#9be06a', 1, 1);
  }
}

function post(c: Ctx, x: number, y: number, w: number, h: number, col = '#a8714a') {
  px(c, x, y, INK, w, h);
  px(c, x + 1, y + 1, col, w - 2, h - 1);
  px(c, x + 1, y + 1, shade(col, 0.25), 1, h - 2);
  px(c, x + w - 2, y + 1, shade(col, -0.3), 1, h - 2);
}

function lantern(c: Ctx, x: number, y: number, col = '#d9675f') {
  px(c, x, y - 3, INK, 1, 3);
  px(c, x - 2, y, INK, 5, 1);
  ellipse(c, x, y + 4, 3, 3.6, shade(col, -0.4));
  ellipse(c, x, y + 4, 2.4, 3.1, col);
  px(c, x - 1, y + 2, '#ffe9b0', 2, 2);
  px(c, x - 2, y + 8, INK, 5, 1);
}

function tiles(c: Ctx, x: number, y: number, w: number, h: number, col: string) {
  const dark = shade(col, -0.35);
  const edge = shade(col, -0.6);
  for (let j = 0; j < h; j++) {
    px(c, x, y + j, j === 0 ? edge : j % 3 === 2 ? dark : col, w, 1);
    if (j % 3 !== 2 && j > 0) for (let i = 2 + (Math.floor(j / 3) % 2) * 3; i < w - 1; i += 6) px(c, x + i, y + j, shade(col, 0.2), 4, 1);
  }
  px(c, x, y + h - 2, edge, w, 2);
  px(c, x + 1, y + 1, shade(col, 0.25), w - 2, 1);
}

export const TOWN_KINDS: Record<string, DrawFn> = {
  /** Fallen trunks with branches across a forest path. */
  logpile(c, W, H, _c1, _c2, _rot, r) {
    const base = H - 3;
    ellipse(c, W / 2, H - 2, W / 2 - 1, 3, 'rgba(30,20,40,0.28)');
    log(c, 1, base - 9, W - 2, 9, BARK, true);
    log(c, 4, base - 17, W - 8, 8, shade(BARK, 0.12), false);
    log(c, 0, base - 25 + 8, W - 3, 8, shade(BARK, -0.12), true);
    // broken branches and moss
    for (let i = 0; i < 6; i++) {
      const bx = 4 + Math.round(r() * (W - 10));
      px(c, bx, base - 24 - Math.round(r() * 3), INK, 1, 5);
      px(c, bx + 1, base - 22, BARK, 1, 3);
    }
    for (let i = 0; i < 9; i++) px(c, 3 + Math.round(r() * (W - 8)), base - 8 - Math.round(r() * 14), r() > 0.5 ? '#5db449' : '#43963c', 3, 1);
    leaves(c, 6, base - 22, 6, r);
    leaves(c, W - 7, base - 20, 6, r);
    leaves(c, W / 2, base - 24, 5, r);
  },

  /** Rusty iron gate swallowed by vines. */
  vinegate(c, W, H, _c1, _c2, _rot, r) {
    post(c, 0, H - 30, 5, 30, '#8d8790');
    post(c, W - 5, H - 30, 5, 30, '#8d8790');
    px(c, 0, H - 32, INK, 5, 3);
    px(c, W - 5, H - 32, INK, 5, 3);
    // iron bars
    for (let x = 6; x < W - 6; x += 4) {
      px(c, x, H - 26, INK, 3, 24);
      px(c, x + 1, H - 26, '#a3623e', 1, 24);
    }
    px(c, 5, H - 22, INK, W - 10, 3);
    px(c, 5, H - 21, '#8a4f31', W - 10, 1);
    px(c, 5, H - 9, INK, W - 10, 3);
    px(c, 5, H - 8, '#8a4f31', W - 10, 1);
    // rusty lock
    px(c, W / 2 - 3, H - 16, INK, 6, 7);
    px(c, W / 2 - 2, H - 15, '#c9a24a', 4, 5);
    px(c, W / 2 - 1, H - 20, INK, 2, 4);
    // vines
    for (let i = 0; i < 18; i++) {
      const vx = 4 + Math.round(r() * (W - 8));
      const len = 8 + Math.round(r() * 20);
      const top = H - 28 + Math.round(r() * 6);
      for (let k = 0; k < len; k++) px(c, vx + (k % 6 < 3 ? 0 : 1), top + k, k % 4 === 0 ? '#2f8a3e' : '#24683a', 2, 1);
      px(c, vx - 1, top + len, '#6cc456', 3, 2);
    }
    leaves(c, W / 2, H - 20, 14, r);
    for (let i = 0; i < 5; i++) px(c, 6 + Math.round(r() * (W - 12)), H - 24 + Math.round(r() * 16), '#fbe6f0', 2, 2);
  },

  /** Works barricade: sawhorses, striped planks, cones. A signboard name goes on the label. */
  barricade(c, W, H, _c1, _c2, _rot, _r) {
    const gy = H - 3;
    ellipse(c, W / 2, H - 2, W / 2 - 1, 3, 'rgba(30,20,40,0.25)');
    for (const x of [3, W - 11]) {
      for (const s of [0, 1]) {
        for (let k = 0; k < 14; k++) px(c, x + (s ? 8 - Math.round(k * 0.5) : Math.round(k * 0.5)), gy - 14 + k, INK, 2, 1);
        px(c, x + (s ? 6 : 0), gy - 2, INK, 3, 2);
      }
      px(c, x + 2, gy - 15, INK, 7, 2);
      px(c, x + 3, gy - 14, '#c48d5e', 5, 1);
    }
    for (const [y, off] of [[gy - 18, 0], [gy - 10, 1]] as const) {
      px(c, 1, y, INK, W - 2, 7);
      for (let x = 2; x < W - 3; x += 8) {
        px(c, x + off * 4, y + 1, '#f7e7b0', 4, 5);
        px(c, x + off * 4 + 4, y + 1, '#d9675f', 4, 5);
      }
      px(c, 2, y + 1, 'rgba(255,255,255,0.25)', W - 4, 1);
    }
    // little cone
    px(c, W / 2 - 3, gy - 7, INK, 7, 8);
    px(c, W / 2 - 2, gy - 6, '#e9873f', 5, 6);
    px(c, W / 2 - 2, gy - 4, '#f7f0e0', 5, 1);
  },

  /** Closed wooden garden gate with a rope and a tag. */
  gardengate(c, W, H, c1, _c2, _rot, r) {
    const wood = c1 || '#a8714a';
    post(c, 0, H - 30, 5, 30, shade(wood, -0.1));
    post(c, W - 5, H - 30, 5, 30, shade(wood, -0.1));
    lantern(c, 2, H - 32, '#f3e6c8');
    lantern(c, W - 3, H - 32, '#f3e6c8');
    for (let x = 6; x < W - 6; x += 5) {
      px(c, x, H - 24, INK, 5, 23);
      px(c, x + 1, H - 23, wood, 3, 21);
      px(c, x + 1, H - 23, shade(wood, 0.25), 3, 1);
      px(c, x + 3, H - 23, shade(wood, -0.2), 1, 21);
    }
    px(c, 5, H - 19, INK, W - 10, 3);
    px(c, 5, H - 18, shade(wood, -0.25), W - 10, 1);
    px(c, 5, H - 8, INK, W - 10, 3);
    px(c, 5, H - 7, shade(wood, -0.25), W - 10, 1);
    // rope loop + tag
    for (let x = 8; x < W - 8; x += 2) px(c, x, H - 14 + (Math.abs(x - W / 2) < 6 ? 2 : 0), '#e6cd98', 2, 1);
    px(c, W / 2 - 3, H - 11, INK, 7, 9);
    px(c, W / 2 - 2, H - 10, '#f6ecd6', 5, 7);
    px(c, W / 2 - 1, H - 8, '#b2585e', 3, 1);
    px(c, W / 2 - 1, H - 6, '#b2585e', 3, 1);
    for (let i = 0; i < 4; i++) px(c, 8 + Math.round(r() * (W - 16)), H - 6, '#f4a6c0', 2, 2);
  },

  /** Bamboo rails and a rope with a hanging "closed" tag (label) for the night market. */
  ropegate(c, W, H, _c1, _c2, _rot, _r) {
    for (const x of [1, W - 5]) {
      px(c, x, H - 30, INK, 4, 30);
      px(c, x + 1, H - 30, '#9bb35c', 2, 29);
      px(c, x + 1, H - 30, '#c8de88', 1, 29);
      for (const y of [H - 22, H - 12]) px(c, x, y, '#5d7a34', 4, 1);
      lantern(c, x + 2, H - 33, '#d9675f');
    }
    for (const [y, sag] of [[H - 20, 2], [H - 13, 3]] as const) {
      for (let x = 5; x < W - 5; x++) {
        const t = (x - 5) / (W - 10);
        px(c, x, y + Math.round(Math.sin(t * Math.PI) * sag), INK, 1, 2);
        px(c, x, y + Math.round(Math.sin(t * Math.PI) * sag), '#e6cd98', 1, 1);
      }
    }
    px(c, W / 2 - 4, H - 10, INK, 9, 10);
    px(c, W / 2 - 3, H - 9, '#f6ecd6', 7, 8);
    px(c, W / 2 - 2, H - 7, '#3b4470', 5, 1);
    px(c, W / 2 - 2, H - 5, '#3b4470', 5, 1);
  },

  /**
   * One leaf of a gate, seen from the front (1 tile); two of them side by side fill a two-tile path.
   * `rot` 0: rusty iron under vines; 1: wooden garden gate with a rope and a tag.
   */
  gatepanel(c, _W, H, _c1, _c2, rot, r) {
    const iron = rot === 0;
    const body = iron ? '#8a4f31' : '#a8714a';
    const postCol = iron ? '#8d8790' : '#c48d5e';
    px(c, 0, H - 17, INK, 16, 17);
    px(c, 0, H - 19, INK, 3, 19);
    px(c, 13, H - 19, INK, 3, 19);
    px(c, 1, H - 18, postCol, 1, 17);
    px(c, 14, H - 18, postCol, 1, 17);
    px(c, 1, H - 19, shade(postCol, 0.25), 1, 1);
    for (let x = 4; x < 13; x += 3) { px(c, x, H - 16, body, 2, 14); px(c, x, H - 16, shade(body, 0.25), 1, 14); }
    px(c, 3, H - 13, INK, 10, 2); px(c, 3, H - 12, shade(body, -0.2), 10, 1);
    px(c, 3, H - 5, INK, 10, 2); px(c, 3, H - 4, shade(body, -0.2), 10, 1);
    if (iron) {
      for (let i = 0; i < 12; i++) {
        const vx = 2 + Math.round(r() * 12);
        const vy = 2 + Math.round(r() * (H - 6));
        px(c, vx, vy, r() > 0.5 ? '#2f8a3e' : '#24683a', 2, 3);
        px(c, vx + 1, vy, '#6cc456', 1, 1);
      }
      px(c, 6, H - 10, INK, 4, 4); px(c, 7, H - 9, '#c9a24a', 2, 2);
    } else {
      for (let x = 3; x < 13; x += 2) px(c, x, H - 9, '#e6cd98', 1, 1);
      px(c, 6, H - 9, INK, 4, 6); px(c, 7, H - 8, '#f6ecd6', 2, 4);
      px(c, 7, H - 6, '#b2585e', 2, 1);
    }
  },

  /** A single wooden sawhorse with a striped plank, to widen a works barricade. */
  sawhorse(c, _W, H, _c1, _c2, _rot, _r) {
    const gy = H - 2;
    for (const s of [0, 1]) for (let k = 0; k < 12; k++) px(c, 2 + (s ? 10 - Math.round(k * 0.7) : Math.round(k * 0.7)), gy - 12 + k, INK, 2, 1);
    px(c, 1, gy - 13, INK, 14, 2);
    px(c, 2, gy - 12, '#c48d5e', 12, 1);
    px(c, 1, gy - 11, INK, 14, 5);
    for (let x = 2; x < 13; x += 6) { px(c, x, gy - 10, '#f7e7b0', 3, 3); px(c, x + 3, gy - 10, '#d9675f', 3, 3); }
  },

  /** A tiny roadside shrine (hokora) with a rope and an offering plate. */
  shrine(c, W, H, _c1, _c2, _rot, r) {
    const cx = Math.floor(W / 2);
    ellipse(c, cx, H - 3, W / 2 - 3, 4, 'rgba(30,20,40,0.25)');
    px(c, cx - 14, H - 8, INK, 28, 7);
    px(c, cx - 13, H - 7, '#a59f9a', 26, 5);
    px(c, cx - 13, H - 7, '#c2bcb4', 26, 1);
    px(c, cx - 11, H - 20, INK, 22, 13);
    px(c, cx - 10, H - 19, '#c48d5e', 20, 11);
    px(c, cx - 4, H - 18, INK, 8, 9);
    px(c, cx - 3, H - 17, '#2c3250', 6, 7);
    px(c, cx - 1, H - 15, '#f4d68c', 2, 3);
    tiles(c, cx - 16, H - 34, 32, 14, '#5d5864');
    px(c, cx - 1, H - 36, INK, 2, 3);
    // rope with paper strips
    for (let x = cx - 10; x < cx + 10; x++) px(c, x, H - 13, '#f6ecd6', 1, 1);
    for (const x of [cx - 7, cx, cx + 7]) { px(c, x, H - 12, '#f6ecd6', 2, 3); px(c, x, H - 10, shade('#f6ecd6', -0.25), 2, 1); }
    // offering
    px(c, cx - 4, H - 9, '#b8524f', 8, 2);
    for (let i = 0; i < 3; i++) px(c, cx - 3 + i * 3, H - 11, r() > 0.5 ? '#f2c66d' : '#fbe6f0', 2, 2);
  },

  /**
   * A townhouse seen from the front with its entrance on one SIDE: a lower porch (genkan) sticks out to the left
   * (`rot` bit 0 = 0) or right (1), with its own door, noren, lantern and steps. `rot >> 1` picks the trade:
   * 0 plain home, 1 tea house, 2 fishmonger, 3 flower shop. c1 = walls, c2 = roof.
   */
  townhouse(c, W, H, c1, c2, rot, r) {
    const right = (rot & 1) === 1;
    const kind = rot >> 1;
    const porchW = 34;
    const mainX = right ? 0 : porchW - 8;
    const mainW = W - porchW + 8;
    const roofH = Math.floor(H * 0.44);
    const wallY = roofH - 3;
    const wood = '#a8714a';
    // main wall (timber frame)
    px(c, mainX + 2, wallY, INK, mainW - 4, H - wallY - 3);
    px(c, mainX + 3, wallY, c1, mainW - 6, H - wallY - 4);
    px(c, mainX + 3, wallY, shade(c1, -0.14), mainW - 6, 3);
    for (let x = mainX + 8; x < mainX + mainW - 6; x += 14) px(c, x, wallY + 3, shade(c1, -0.3), 2, H - wallY - 8);
    px(c, mainX + 3, H - 12, shade(c1, -0.2), mainW - 6, 1);
    // windows with lattice
    const wins: number[] = [];
    for (let x = mainX + 8 + 12; x + 14 < mainX + mainW - 4; x += 24) wins.push(x);
    for (const wx of wins.slice(0, 2)) {
      const wy = wallY + 11;
      px(c, wx - 1, wy - 1, INK, 15, 15);
      px(c, wx, wy, kind === 1 ? '#f7dc8f' : '#f0d894', 13, 13);
      px(c, wx, wy, '#fff0be', 5, 2);
      for (let i = 3; i < 13; i += 3) px(c, wx + i, wy, '#7a4a2f', 1, 13);
      px(c, wx, wy + 6, '#7a4a2f', 13, 1);
      px(c, wx - 2, wy + 14, wood, 17, 2);
    }
    // main roof
    tiles(c, mainX, 0, mainW, roofH, c2);
    px(c, mainX + Math.floor(mainW / 2) - 6, 0, shade(c2, -0.6), 12, 2);
    // foundation
    px(c, mainX + 3, H - 6, '#6f6a72', mainW - 6, 4);
    for (let x = mainX + 4; x < mainX + mainW - 4; x += 5) px(c, x, H - 6, shade('#6f6a72', 0.3), 4, 1);
    // porch (genkan): lower, projecting out, door on its front
    const px0 = right ? W - porchW : 0;
    const roofY = Math.floor(H * 0.50);
    px(c, px0 + 2, roofY + 8, INK, porchW - 4, H - roofY - 11);
    px(c, px0 + 3, roofY + 8, shade(c1, 0.06), porchW - 6, H - roofY - 12);
    px(c, px0 + 3, roofY + 8, shade(c1, -0.16), porchW - 6, 3);
    // door
    const dx = px0 + Math.floor(porchW / 2) - 7;
    px(c, dx - 1, H - 29, INK, 16, 24);
    px(c, dx, H - 28, '#3b2a22', 14, 23);
    px(c, dx + 1, H - 27, kind === 1 ? '#f7dc8f' : '#c98e5a', 12, 21);
    for (let i = 4; i < 12; i += 4) px(c, dx + i, H - 27, '#7a4a2f', 1, 21);
    px(c, dx + 1, H - 17, '#7a4a2f', 12, 1);
    px(c, dx + 10, H - 16, '#f2c66d', 2, 2);
    // porch roof + noren
    tiles(c, px0, roofY, porchW, 9, shade(c2, 0.05));
    const norenCol = kind === 1 ? '#b8524f' : kind === 2 ? '#2f4f7a' : kind === 3 ? '#d9a3a6' : '#3b4470';
    px(c, dx - 1, H - 33, norenCol, 16, 7);
    for (let i = 3; i < 15; i += 4) px(c, dx + i - 1, H - 32, shade(norenCol, -0.35), 1, 6);
    px(c, dx - 1, H - 33, shade(norenCol, 0.25), 16, 1);
    if (kind === 2) for (let i = 0; i < 3; i++) px(c, dx + 2 + i * 4, H - 30, '#e8f0f8', 2, 1);
    // lantern + steps + pot
    lantern(c, right ? px0 + porchW - 6 : px0 + 5, roofY + 10, kind === 1 ? '#d9675f' : '#f3e6c8');
    px(c, dx - 3, H - 7, '#6f6a72', 20, 4);
    px(c, dx - 2, H - 7, '#c6c2cc', 18, 1);
    // trade details on the side of the main building
    const sx = right ? mainX + 6 : mainX + mainW - 28;
    if (kind === 1) {
      px(c, sx, wallY + 1, INK, 22, 9);
      px(c, sx + 1, wallY + 2, '#f6ecd6', 20, 7);
      for (let i = 0; i < 4; i++) px(c, sx + 3 + i * 5, wallY + 4, '#b2585e', 3, 3);
      px(c, sx + 6, H - 12, INK, 8, 7); px(c, sx + 7, H - 11, '#f6ecd6', 6, 5); px(c, sx + 14, H - 10, '#d9675f', 3, 4);
    } else if (kind === 2) {
      for (let i = 0; i < 3; i++) { px(c, sx + i * 8, H - 14, INK, 7, 9); px(c, sx + 1 + i * 8, H - 13, '#c48d5e', 5, 7); px(c, sx + 2 + i * 8, H - 16, '#8fb7d6', 3, 2); }
      px(c, sx - 2, wallY + 2, INK, 26, 7); px(c, sx - 1, wallY + 3, '#8fb7d6', 24, 5);
      for (let i = 0; i < 4; i++) px(c, sx + 2 + i * 6, wallY + 4, '#f6ecd6', 3, 2);
    } else if (kind === 3) {
      for (let i = 0; i < 3; i++) {
        px(c, sx + i * 8, H - 12, INK, 7, 8); px(c, sx + 1 + i * 8, H - 11, '#b0533f', 5, 6);
        ellipse(c, sx + 3.5 + i * 8, H - 14, 3, 2.5, '#5f8a47');
        px(c, sx + 2 + i * 8, H - 16, ['#f4a6c0', '#ffd36a', '#b9a0ec'][i], 2, 2);
      }
      for (let x = sx - 2; x < sx + 26; x += 4) { px(c, x, wallY + 2, ((x - sx) / 4) % 2 ? '#f6ecd6' : '#d9a3a6', 4, 5); }
    } else {
      px(c, sx + 4, H - 14, INK, 10, 10); px(c, sx + 5, H - 13, '#8a5a3c', 8, 8);
      px(c, sx + 5, H - 13, shade('#8a5a3c', 0.25), 8, 1);
      for (let i = 0; i < 4; i++) px(c, sx + 18 + i * 2, H - 8 - i, '#5f8a47', 2, 2);
    }
    void r;
  },
};
