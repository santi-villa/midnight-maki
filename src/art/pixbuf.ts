// Mini "lienzo de píxeles" que funciona igual en el navegador y en Node.
// Todo el arte del juego se dibuja con esto, así no dependemos de archivos de imagen.

export class PixBuf {
  readonly data: Uint8ClampedArray;

  constructor(public readonly w: number, public readonly h: number) {
    this.data = new Uint8ClampedArray(w * h * 4);
  }

  static parse(hex: string): [number, number, number, number] {
    const h = hex.replace('#', '');
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    const a = h.length >= 8 ? parseInt(h.slice(6, 8), 16) : 255;
    return [r, g, b, a];
  }

  inside(x: number, y: number) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  alpha(x: number, y: number) {
    if (!this.inside(x, y)) return 0;
    return this.data[(y * this.w + x) * 4 + 3];
  }

  set(x: number, y: number, color: string) {
    x = Math.round(x);
    y = Math.round(y);
    if (!this.inside(x, y)) return this;
    const [r, g, b, a] = PixBuf.parse(color);
    const i = (y * this.w + x) * 4;
    if (a === 255) {
      this.data[i] = r;
      this.data[i + 1] = g;
      this.data[i + 2] = b;
      this.data[i + 3] = 255;
    } else {
      const da = this.data[i + 3] / 255;
      const sa = a / 255;
      const oa = sa + da * (1 - sa);
      if (oa === 0) return this;
      this.data[i] = (r * sa + this.data[i] * da * (1 - sa)) / oa;
      this.data[i + 1] = (g * sa + this.data[i + 1] * da * (1 - sa)) / oa;
      this.data[i + 2] = (b * sa + this.data[i + 2] * da * (1 - sa)) / oa;
      this.data[i + 3] = oa * 255;
    }
    return this;
  }

  erase(x: number, y: number) {
    if (!this.inside(x, y)) return this;
    this.data[(y * this.w + x) * 4 + 3] = 0;
    return this;
  }

  rect(x: number, y: number, w: number, h: number, color: string) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, color);
    return this;
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, color: string) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x - cx) / (rx + 0.35);
        const dy = (y - cy) / (ry + 0.35);
        if (dx * dx + dy * dy <= 1) this.set(x, y, color);
      }
    }
    return this;
  }

  hline(x: number, y: number, w: number, color: string) {
    return this.rect(x, y, w, 1, color);
  }

  vline(x: number, y: number, h: number, color: string) {
    return this.rect(x, y, 1, h, color);
  }

  // Contorno de 1px alrededor de todo lo dibujado (look pixel art clásico).
  outline(color: string, diagonal = false) {
    const marks: [number, number][] = [];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.alpha(x, y) > 0) continue;
        const n =
          this.alpha(x - 1, y) || this.alpha(x + 1, y) || this.alpha(x, y - 1) || this.alpha(x, y + 1) ||
          (diagonal && (this.alpha(x - 1, y - 1) || this.alpha(x + 1, y - 1) || this.alpha(x - 1, y + 1) || this.alpha(x + 1, y + 1)));
        if (n) marks.push([x, y]);
      }
    }
    for (const [x, y] of marks) this.set(x, y, color);
    return this;
  }

  blit(src: PixBuf, dx: number, dy: number, flipX = false) {
    for (let y = 0; y < src.h; y++) {
      for (let x = 0; x < src.w; x++) {
        const sx = flipX ? src.w - 1 - x : x;
        const i = (y * src.w + sx) * 4;
        const a = src.data[i + 3];
        if (!a) continue;
        const tx = dx + x;
        const ty = dy + y;
        if (!this.inside(tx, ty)) continue;
        const o = (ty * this.w + tx) * 4;
        if (a === 255) {
          this.data[o] = src.data[i];
          this.data[o + 1] = src.data[i + 1];
          this.data[o + 2] = src.data[i + 2];
          this.data[o + 3] = 255;
        } else {
          const hex = '#' + [src.data[i], src.data[i + 1], src.data[i + 2], a].map((v) => v.toString(16).padStart(2, '0')).join('');
          this.set(tx, ty, hex);
        }
      }
    }
    return this;
  }

  scaled(k: number) {
    const out = new PixBuf(this.w * k, this.h * k);
    for (let y = 0; y < out.h; y++) {
      for (let x = 0; x < out.w; x++) {
        const i = (Math.floor(y / k) * this.w + Math.floor(x / k)) * 4;
        const o = (y * out.w + x) * 4;
        out.data[o] = this.data[i];
        out.data[o + 1] = this.data[i + 1];
        out.data[o + 2] = this.data[i + 2];
        out.data[o + 3] = this.data[i + 3];
      }
    }
    return out;
  }
}

// Une varios cuadros en una tira horizontal (spritesheet).
export function strip(frames: PixBuf[]) {
  const fw = frames[0].w;
  const fh = frames[0].h;
  const out = new PixBuf(fw * frames.length, fh);
  frames.forEach((f, i) => out.blit(f, i * fw, 0));
  return out;
}

// Generador pseudoaleatorio con semilla: el arte sale siempre igual.
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
