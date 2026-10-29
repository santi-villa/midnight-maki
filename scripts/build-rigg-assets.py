"""Slice the approved 4x6 Rigg sheet into the existing 30-frame actor layout.

Requires Pillow, like the other asset builders. Runtime only loads rigg.png.
"""
from pathlib import Path
from collections import deque
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'src/assets/characters/rigg-source.png'
TARGET = ROOT / 'src/assets/characters/rigg.png'
im = Image.open(SOURCE).convert('RGBA')
assert im.size == (1024, 1536), 'Expected the approved 4x6 sheet (256px cells)'
# Generated poses slightly cross the nominal cell edges. Extract each connected
# silhouette before placing it on a real grid: a rigid crop would cut ears/feet
# and include fragments from the next row.
w, h = im.size
mask = bytearray(1 if a >= 128 else 0 for a in im.getchannel('A').getdata())
components = []
for start in range(len(mask)):
    if not mask[start]:
        continue
    queue = deque([start])
    mask[start] = 0
    pixels = []
    while queue:
        k = queue.popleft()
        pixels.append(k)
        x, y = k % w, k // w
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                xx, yy = x + dx, y + dy
                if 0 <= xx < w and 0 <= yy < h:
                    n = yy * w + xx
                    if mask[n]:
                        mask[n] = 0
                        queue.append(n)
    if len(pixels) > 1000:
        bounds = (min(k % w for k in pixels), min(k // w for k in pixels),
                  max(k % w for k in pixels) + 1, max(k // w for k in pixels) + 1)
        components.append((bounds, pixels))
assert len(components) == 24, 'Expected exactly 24 separate character silhouettes'
components.sort(key=lambda c: (c[0][1] + c[0][3]) / 2)
frames = []
for row in range(6):
    for bounds, pixels in sorted(components[row * 4:row * 4 + 4], key=lambda c: c[0][0]):
        alpha = Image.new('L', (w, h))
        data = bytearray(w * h)
        for k in pixels:
            data[k] = 255
        alpha.frombytes(bytes(data))
        frame = im.copy()
        frame.putalpha(alpha)
        frames.append(frame.crop(bounds))

# One shared scale, rather than stretching each pose to the same height.
scale = 34 / max(f.height for f in frames)
cells = []
for frame in frames:
    frame = frame.resize((round(frame.width * scale), round(frame.height * scale)), Image.Resampling.NEAREST)
    cell = Image.new('RGBA', (40, 39))
    cell.alpha_composite(frame, ((40 - frame.width) // 2, 37 - frame.height))
    cells.append(cell)

# down/up/right/left, expressions, breathing, work, wave, read, sit.
# Unavailable expressions reuse neutral art rather than changing Rigg's size.
order = [0, 1, 2, 12, 13, 14, 8, 9, 10, 4, 5, 6,
         0, 17, 0, 21, 8, 4, 0, 0, 0, 12, 8, 4,
         18, 19, 16, 17, 18, 20]
assert len(order) == 30
sheet = Image.new('RGBA', (40 * len(order), 39))
for i, source in enumerate(order):
    sheet.alpha_composite(cells[source], (40 * i, 0))
sheet.save(TARGET, optimize=True)
print(f'{TARGET.relative_to(ROOT)}: {sheet.width}x{sheet.height}, 30 frames')
