#!/usr/bin/env python3
"""
Cuts the raccoon sheet received for Pip (art-source/pip/hoja-aportada.webp: 28 poses on a flat dark background) and packs
it into the game's 30-frame character layout (see FRAMES in src/art/characters.ts) at src/assets/pip/pip-sheet.png.

Every pose is isolated by flood fill (the background is a flat navy), shrunk 4x with area averaging and cut to a hard alpha,
and bottom-aligned in a 36x32 frame. Walk cycles keep one horizontal anchor so the body does not jitter between steps.
"""
import collections, json, sys
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'art-source/pip/hoja-aportada.webp'
OUT = ROOT / 'src/assets/pip/pip-sheet.png'
FW, FH, SCALE = 36, 32, 4

im = Image.open(SRC).convert('RGB')
a = np.array(im).astype(int)
fg = np.abs(a - np.array([35, 38, 49])).sum(2) > 28
H, W = fg.shape
lab = np.zeros((H, W), int)
comps = []
for y in range(H):
    for x in range(W):
        if fg[y, x] and not lab[y, x]:
            n = len(comps) + 1
            q = collections.deque([(y, x)]); lab[y, x] = n
            x0 = x1 = x; y0 = y1 = y; cnt = 0
            while q:
                cy, cx = q.popleft(); cnt += 1
                x0 = min(x0, cx); x1 = max(x1, cx); y0 = min(y0, cy); y1 = max(y1, cy)
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        ny, nx = cy + dy, cx + dx
                        if 0 <= ny < H and 0 <= nx < W and fg[ny, nx] and not lab[ny, nx]:
                            lab[ny, nx] = n; q.append((ny, nx))
            comps.append((n, x0, y0, x1, y1, cnt))
poses = sorted([c for c in comps if c[5] > 1000], key=lambda c: (round((c[2] + c[4]) / 2 / 70), c[1]))
if len(poses) != 28:
    sys.exit(f'expected 28 poses, found {len(poses)}')


def cutout(c):
    """RGBA crop of one pose with its holes filled (the eyes and the white belly are inside the silhouette)."""
    n, x0, y0, x1, y1, _ = c
    m = lab[y0:y1 + 1, x0:x1 + 1] == n
    h, w = m.shape
    out = np.zeros((h, w), bool)  # background reachable from the border
    q = collections.deque()
    for y in range(h):
        for x in (0, w - 1):
            if not m[y, x] and not out[y, x]: out[y, x] = True; q.append((y, x))
    for x in range(w):
        for y in (0, h - 1):
            if not m[y, x] and not out[y, x]: out[y, x] = True; q.append((y, x))
    while q:
        cy, cx = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = cy + dy, cx + dx
            if 0 <= ny < h and 0 <= nx < w and not m[ny, nx] and not out[ny, nx]:
                out[ny, nx] = True; q.append((ny, nx))
    alpha = ~out
    rgb = a[y0:y1 + 1, x0:x1 + 1].astype(float)
    pad = (-h) % SCALE, (-w) % SCALE
    rgb = np.pad(rgb, ((0, pad[0]), (0, pad[1]), (0, 0)), mode='edge')
    al = np.pad(alpha.astype(float), ((0, pad[0]), (0, pad[1])))
    hh, ww = al.shape
    blk = lambda v: v.reshape(hh // SCALE, SCALE, ww // SCALE, SCALE, *v.shape[2:]).sum((1, 3))
    wsum = blk(al)
    col = blk(rgb * al[..., None]) / np.maximum(wsum, 1)[..., None]
    cov = wsum / (SCALE * SCALE)
    res = np.zeros((hh // SCALE, ww // SCALE, 4), np.uint8)
    on = cov >= 0.5
    res[..., :3][on] = np.clip(col[on], 0, 255).astype(np.uint8)
    res[..., 3][on] = 255
    return Image.fromarray(res, 'RGBA')


crops = [cutout(c) for c in poses]


def bbox_centre(img):
    bb = img.getchannel('A').getbbox()
    return (bb[0] + bb[2]) / 2

# pose index (row-major in the received sheet) -> role
IDLE = {'down': 0, 'up': 1, 'right': 12, 'left': 15}
WALK = {'down': [0, 5, 7], 'up': [1, 8, 10], 'right': [12, 13, 14], 'left': [15, 18, 19]}
anchor = {d: bbox_centre(crops[IDLE[d]]) for d in IDLE}


def frame(i, anchor_x=None):
    img = crops[i]
    bb = img.getchannel('A').getbbox()
    ax = anchor_x if anchor_x is not None else bbox_centre(img)
    f = Image.new('RGBA', (FW, FH))
    f.alpha_composite(img, (round(FW / 2 - ax), FH - 1 - bb[3]))
    return f


def breathe(f):
    """Same pose, the upper body one pixel lower (like the generated sheets)."""
    up = FH - 6
    out = Image.new('RGBA', (FW, FH))
    out.alpha_composite(f.crop((0, up, FW, FH)), (0, up))
    out.alpha_composite(f.crop((0, 0, FW, up)), (0, 1))
    out.alpha_composite(f.crop((0, up - 1, FW, up)), (0, up - 1))
    return out


walk = lambda d, k: frame(WALK[d][k], anchor[d])
F = [None] * 30
F[0], F[1], F[2] = walk('down', 0), walk('down', 1), walk('down', 2)
F[3], F[4], F[5] = walk('up', 0), walk('up', 1), walk('up', 2)
F[6], F[7], F[8] = walk('right', 0), walk('right', 1), walk('right', 2)
F[9], F[10], F[11] = walk('left', 0), walk('left', 1), walk('left', 2)
F[12] = F[0]                      # blink: the received sheet has no closed-eye standing frame
F[13] = frame(4)                  # happy: the one with blushing cheeks
F[14] = frame(22)                 # surprised: sitting, wide eyes
F[15] = frame(23)                 # asleep: curled up
F[16], F[17] = F[6], F[9]
F[18] = frame(20)                 # sad: sitting, eyes closed
F[19] = frame(24)                 # smug: sitting, content
F[20], F[21], F[22], F[23] = (breathe(F[i]) for i in (0, 3, 6, 9))
F[24], F[25] = F[0], frame(4)     # cooking
F[26], F[27] = frame(25), F[0]    # waving
F[28] = frame(27)                 # reading: the one with the leaf
F[29] = frame(21)                 # sitting

sheet = Image.new('RGBA', (FW * 30, FH))
for i, f in enumerate(F):
    sheet.alpha_composite(f, (i * FW, 0))
OUT.parent.mkdir(parents=True, exist_ok=True)
sheet.save(OUT, optimize=True)
print(OUT, sheet.size, OUT.stat().st_size, 'bytes')
