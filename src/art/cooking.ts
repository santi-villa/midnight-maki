/** Kitchen-only sprites. Cached at native resolution; inventory art stays unchanged. */
import { INGREDIENT_ALIASES, ITEMS_BY_ID } from '../data/items';
import type { RecipePresentation } from '../core/types';
import type { RecipeDef } from '../data/recipes';
import { iconCanvas } from './icons';
import { ctx2d, makeCanvas, shade } from './pixel';

const cache = new Map<string, HTMLCanvasElement>();
const RICE = '#fbf7ee';
const NORI = '#2f3b33';

/** A raster oval, including its outline, with no antialiased edges. */
export function kitchenOval(g: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, color: string) {
  g.fillStyle = color;
  for (let y = -Math.floor(ry); y <= Math.floor(ry); y++) {
    const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y / ry) ** 2)));
    g.fillRect(Math.round(cx) - half, Math.round(cy) + y, half * 2 + 1, 1);
  }
}

export function cookingIngredient(id: string): HTMLCanvasElement {
  id = INGREDIENT_ALIASES[id] ?? id;
  const found = cache.get(id);
  if (found) return found;
  const c = makeCanvas(32, 24);
  const g = ctx2d(c);
  const item = ITEMS_BY_ID[id];
  const color = item?.icon.c1 ?? '#e8826f';
  const light = item?.icon.c2 ?? shade(color, 0.3);
  const rect = (x: number, y: number, w: number, h: number, fill: string) => {
    g.fillStyle = fill;
    g.fillRect(x, y, w, h);
  };
  if (id === 'rice') {
    kitchenOval(g, 16, 16, 13, 6, '#56382c');
    kitchenOval(g, 16, 14, 13, 5, '#7f9890');
    kitchenOval(g, 16, 11, 11, 6, RICE);
    for (let i = 0; i < 18; i++) rect(8 + (i * 7) % 16, 8 + (i * 3) % 7, 2, 1, i % 3 ? '#ded7c6' : '#ffffff');
    rect(5, 17, 22, 1, '#b4c9bd');
    rect(11, 21, 10, 1, '#56382c');
  } else if (id === 'nori') {
    rect(3, 4, 26, 17, '#20302a');
    rect(4, 3, 24, 16, NORI);
    rect(4, 3, 24, 1, '#63805a');
    for (let y = 6; y < 18; y += 3) for (let x = 6; x < 28; x += 5) rect(x, y, 3, 1, '#455b3c');
    rect(26, 16, 2, 3, '#7b9262');
  } else if (['salmon', 'tuna', 'eel', 'f_carp'].includes(id) || item?.icon.type === 'fillet') {
    rect(3, 17, 26, 3, shade(color, -0.4));
    rect(3, 7, 25, 11, color);
    rect(5, 5, 22, 2, color);
    rect(28, 9, 2, 7, shade(color, -0.2));
    for (let x = 5; x < 26; x += 6) {
      rect(x, 7, 2, 3, light);
      rect(x + 2, 10, 2, 4, light);
      rect(x + 4, 14, 2, 3, light);
    }
    rect(5, 5, 19, 1, shade(light, 0.25));
    if (id === 'eel') for (let x = 6; x < 26; x += 4) rect(x, 8, 1, 9, '#b28242');
  } else if (id === 'cucumber' || id === 'carrot' || id === 'crab' || id === 'scallion') {
    for (let i = 0; i < 3; i++) {
      const y = 5 + i * 5;
      rect(3 + i * 2, y + 3, 24 - i * 2, 2, shade(color, -0.3));
      rect(3 + i * 2, y, 24 - i * 2, 3, color);
      rect(4 + i * 2, y, 21 - i * 2, 1, light);
      if (id === 'cucumber') for (let x = 8; x < 24; x += 5) rect(x, y + 1, 2, 1, '#e3ebbe');
    }
  } else if (id === 'avocado') {
    kitchenOval(g, 16, 13, 11, 9, '#405a35');
    kitchenOval(g, 16, 12, 9, 8, '#88ae5e');
    kitchenOval(g, 16, 11, 7, 6, '#d4d992');
    kitchenOval(g, 16, 13, 4, 4, '#91583b');
    rect(14, 10, 3, 1, '#c9935f');
    rect(9, 7, 2, 3, '#f1efbc');
  } else if (id === 'shrimp') {
    for (let i = 0; i < 6; i++) {
      const y = 5 + Math.round(i * i / 6);
      rect(4 + i * 3, y, 6, 5, color);
      rect(4 + i * 3, y, 2, 4, '#fbdec1');
    }
    rect(22, 17, 6, 3, '#cf6d55');
    rect(27, 15, 3, 3, color);
    rect(27, 20, 3, 2, color);
  } else if (id === 'egg') {
    rect(3, 17, 26, 3, '#b0853e');
    rect(3, 6, 26, 11, '#f2d27a');
    rect(4, 5, 24, 2, '#fff0b5');
    for (let y = 9; y < 17; y += 3) rect(4, y, 24, 1, '#d4a953');
    rect(15, 6, 4, 14, NORI);
    rect(15, 6, 1, 11, '#526847');
  } else if (id === 'shiitake') {
    rect(13, 9, 6, 13, '#eadbbb');
    rect(17, 12, 2, 10, '#b6a485');
    kitchenOval(g, 16, 9, 12, 7, '#69442f');
    kitchenOval(g, 16, 7, 11, 5, '#9c6848');
    rect(10, 6, 12, 2, '#eadbbb');
    rect(15, 3, 2, 9, '#eadbbb');
  } else if (['sesame', 'tempura', 'roe', 'sakura'].includes(id)) {
    kitchenOval(g, 16, 16, 13, 6, '#b8c5b6');
    kitchenOval(g, 16, 14, 12, 5, '#e8eddb');
    for (let i = 0; i < 20; i++) {
      const x = 8 + (i * 7) % 16, y = 10 + (i * 3) % 8;
      rect(x, y, id === 'sesame' ? 1 : 2, 2, color);
      if (id === 'roe') rect(x, y, 1, 1, '#ffd58d');
      if (id === 'sakura') rect(x - 1, y + 1, 3, 1, '#f7bccb');
    }
  } else {
    // Reuse the existing item silhouette for less common ingredients.
    g.drawImage(iconCanvas(item?.icon ?? { type: 'blob', c1: color }), 4, 0, 24, 24);
  }
  cache.set(id, c);
  return c;
}

export function drawCookingPlate(g: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, style: RecipePresentation = 'classic') {
  const colors = {
    classic: ['#60796d', '#a3b7a1', '#e8e8d3', '#cdd6c3', '#f8f4e4', '#728e7a'],
    indigo: ['#333951', '#526185', '#f0eedf', '#b7c5d2', '#f8f4e4', '#51698a'],
    sakura: ['#94606c', '#d79aab', '#f5e1dc', '#e5b7c1', '#fff1e7', '#b96983'],
    gold: ['#594833', '#d5ad59', '#4d5350', '#d4b067', '#333e39', '#f2cb73'],
  }[style];
  kitchenOval(g, cx + 2, cy + 4, rx + 1, ry, '#765139');
  kitchenOval(g, cx, cy + 2, rx, ry, colors[0]);
  kitchenOval(g, cx, cy, rx, ry, colors[1]);
  kitchenOval(g, cx, cy - 1, rx - 3, ry - 2, colors[2]);
  kitchenOval(g, cx, cy - 1, rx - 9, ry - 6, colors[3]);
  kitchenOval(g, cx, cy - 2, rx - 11, ry - 7, colors[4]);
  g.fillStyle = colors[5];
  for (const side of [-1, 1]) {
    const x = Math.round(cx + side * (rx - 6));
    g.fillRect(x, Math.round(cy) - 2, 2, 5);
    g.fillRect(x - 2, Math.round(cy), 6, 1);
    if (style === 'sakura') {
      g.fillRect(x - 2, Math.round(cy) - 3, 2, 2);
      g.fillRect(x + 2, Math.round(cy) + 2, 2, 2);
    } else if (style === 'indigo') {
      g.fillRect(x - 2, Math.round(cy) - 5, 5, 1);
      g.fillRect(x - 2, Math.round(cy) + 5, 5, 1);
    }
  }
}

/** Original recipe illustration, with the same ceramic styles used when serving. */
export function recipeIllustration(recipe: RecipeDef, style: RecipePresentation = 'classic', quality: 0 | 1 | 2 = 2, variant?: string): HTMLCanvasElement {
  const key = `recipe:${recipe.id}:${style}:${quality}:${variant ?? ''}`;
  const saved = cache.get(key);
  if (saved) return saved;
  const c = makeCanvas(96, 64);
  const g = ctx2d(c);
  drawCookingPlate(g, 48, 37, 39, 15, style);
  const shape = recipe.steps.find((s) => s.t === 'shape');
  const cut = recipe.steps.find((s) => s.t === 'cut');
  const count = Math.min(6, shape?.t === 'shape' ? shape.count : cut?.t === 'cut' ? cut.pieces : 1);
  const columns = Math.min(3, count);
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / columns);
    const inRow = Math.min(columns, count - row * columns);
    const x = Math.round(48 - inRow * 19 / 2 + (i % columns) * 19);
    const y = (count > 3 ? 17 : 23) + row * 15 + (quality === 0 ? i % 2 * 3 : 0);
    drawRecipePiece(g, recipe, x, y);
    if (variant === 'sesame') {
      g.fillStyle = '#e8c070';
      for (let k = 0; k < 4; k++) g.fillRect(x + 3 + k * 3, y + (k % 2) + 2, 1, 1);
    } else if (variant === 'salmon') {
      g.fillStyle = '#ef9a78';
      g.fillRect(x + 6, y + 7, 5, 3);
    }
  }
  if (quality >= 1) {
    kitchenOval(g, 75, 41, 4, 2, '#f4b0b5');
    kitchenOval(g, 22, 40, 3, 2, '#95b66b');
  }
  if (variant === 'wasabi') kitchenOval(g, 22, 39, 4, 3, '#a3c46f');
  if (quality === 2) {
    g.fillStyle = '#fff2c9';
    g.fillRect(19, 23, 1, 5);
    g.fillRect(17, 25, 5, 1);
    g.fillRect(78, 29, 1, 3);
    g.fillRect(77, 30, 3, 1);
  }
  cache.set(key, c);
  return c;
}

function drawRecipePiece(g: CanvasRenderingContext2D, recipe: RecipeDef, x: number, y: number) {
  const colors = [recipe.icon.c1 ?? '#6f9e5a', recipe.icon.c2, recipe.icon.c3].filter(Boolean) as string[];
  if (recipe.id === 'onigiri') {
    for (let row = 0; row < 17; row++) {
      const half = Math.floor(row / 2);
      g.fillStyle = '#c4b89f';
      g.fillRect(x + 9 - half, y + row, half * 2 + 1, 1);
      g.fillStyle = row % 4 ? RICE : '#e6e0ce';
      if (half > 0) g.fillRect(x + 10 - half, y + row, half * 2 - 1, 1);
    }
    g.fillStyle = NORI;
    g.fillRect(x + 5, y + 11, 8, 6);
  } else if (recipe.id === 'temaki') {
    for (let row = 4; row < 21; row++) {
      const half = Math.floor((21 - row) / 2);
      g.fillStyle = row % 3 ? NORI : '#506047';
      g.fillRect(x + 9 - half, y + row, half * 2 + 1, 1);
    }
    kitchenOval(g, x + 9, y + 5, 8, 3, RICE);
    for (let i = 0; i < colors.length; i++) {
      g.fillStyle = colors[i];
      g.fillRect(x + 5 + i * 4, y + 2, 3, 6);
    }
  } else if (recipe.id === 'gunkan') {
    kitchenOval(g, x + 9, y + 11, 9, 7, NORI);
    kitchenOval(g, x + 9, y + 6, 8, 4, colors[0]);
    g.fillStyle = '#ffd38c';
    for (let i = 0; i < 12; i++) g.fillRect(x + 4 + i % 5 * 2, y + 4 + Math.floor(i / 5) * 2, 1, 1);
  } else if (recipe.steps.some((s) => s.t === 'shape')) {
    kitchenOval(g, x + 9, y + 12, 9, 5, RICE);
    g.fillStyle = colors[0];
    g.fillRect(x, y + 4, 18, 7);
    g.fillStyle = shade(colors[0], 0.45);
    for (let i = 1; i < 17; i += 4) g.fillRect(x + i, y + 5, 2, 5);
    if (recipe.steps.some((s) => s.t === 'wrap')) {
      g.fillStyle = NORI;
      g.fillRect(x + 7, y + 4, 4, 13);
    }
  } else {
    const insideOut = recipe.icon.type === 'uramaki';
    kitchenOval(g, x + 9, y + 10, 9, 9, insideOut ? RICE : NORI);
    kitchenOval(g, x + 9, y + 10, 7, 7, insideOut ? NORI : RICE);
    kitchenOval(g, x + 9, y + 10, 5, 5, insideOut ? RICE : '#e9e4d2');
    colors.forEach((color, i) => {
      g.fillStyle = color;
      g.fillRect(x + 5 + i * 3, y + 7, 3, 6);
    });
    g.fillStyle = '#ffffff';
    for (const [dx, dy] of [[4, 5], [13, 12], [7, 15]]) g.fillRect(x + dx, y + dy, 2, 1);
  }
}

export function drawCookingKnife(g: CanvasRenderingContext2D, x: number, y: number) {
  x = Math.round(x); y = Math.round(y);
  g.fillStyle = '#553c32';
  g.fillRect(x + 3, y + 3, 7, 42);
  g.fillStyle = '#443229';
  g.fillRect(x, y, 6, 16);
  g.fillStyle = '#a87549';
  g.fillRect(x + 1, y + 1, 3, 13);
  g.fillStyle = '#ddb77b';
  g.fillRect(x + 2, y + 4, 1, 1);
  g.fillRect(x + 2, y + 10, 1, 1);
  g.fillStyle = '#768f8a';
  g.fillRect(x, y + 16, 8, 24);
  g.fillStyle = '#c9ddd4';
  g.fillRect(x + 1, y + 17, 6, 21);
  g.fillStyle = '#f4f8e7';
  g.fillRect(x + 1, y + 17, 1, 23);
  g.fillRect(x + 2, y + 39, 3, 2);
}
