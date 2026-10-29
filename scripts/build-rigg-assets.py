"""Slice Rigg into the shared 30-frame actor layout plus six motion frames.

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

# Walking poses share the same height and head anchor. Tail width must not
# recenter the body between steps. There is no extra procedural vertical bounce.
cells = []
for index, frame in enumerate(frames):
    height = 30 if index < 16 else 31
    scale = height / frame.height
    upper = frame.getchannel('A').crop((0, 0, frame.width, round(frame.height * .3))).getbbox()
    head_x = (upper[0] + upper[2]) / 2
    resized = frame.resize((round(frame.width * scale), height), Image.Resampling.NEAREST)
    cell = Image.new('RGBA', (40, 39))
    left = max(0, min(40 - resized.width, 20 - round(head_x * scale)))
    cell.alpha_composite(resized, (left, 37 - height))
    cells.append(cell)

# Build blinks by cropping the closed eyelids already drawn in pose 21.
# Only the eye rectangles change: never swap to a sitting body to blink.
def blink(source, boxes):
    frame = frames[source].copy()
    for eye, box in enumerate(boxes):
        lid = frames[21].crop((40, 69, 67, 90) if eye == 0 else (98, 69, 125, 90))
        frame.paste(lid.resize((box[2] - box[0], box[3] - box[1]), Image.Resampling.NEAREST), box)
    base = cells[source]
    height = 30 if source < 16 else 31
    scale = height / frame.height
    upper = frames[source].getchannel('A').crop((0, 0, frame.width, round(frame.height * .3))).getbbox()
    left = max(0, min(40 - round(frame.width * scale), 20 - round((upper[0] + upper[2]) / 2 * scale)))
    result = base.copy()
    # Composite only the eyes to guarantee identical pixels everywhere else.
    for box in boxes:
        x0, y0 = left + round(box[0] * scale), 37 - height + round(box[1] * scale)
        x1, y1 = left + round(box[2] * scale), 37 - height + round(box[3] * scale)
        result.paste(frame.crop(box).resize((x1 - x0, y1 - y0), Image.Resampling.NEAREST), (x0, y0))
    return result

blinks = {
    0: blink(0, [(37, 63, 60, 86), (89, 63, 115, 86)]),
    8: blink(8, [(149, 62, 171, 88)]),
    4: blink(4, [(31, 63, 52, 88)]),
    18: blink(18, [(43, 67, 68, 92), (99, 66, 125, 91)]),
    20: blink(20, [(42, 67, 65, 92), (98, 66, 123, 91)]),
}
# Existing actor slots plus the fourth walk frame per direction and read/sit blink.
order = [0, 1, 2, 12, 13, 14, 8, 9, 10, 4, 5, 6,
         0, 17, 0, 21, 8, 4, 0, 0, 0, 12, 8, 4,
         18, 19, 16, 17, 18, 20, 3, 15, 11, 7, 18, 20]
assert len(order) == 36
sheet = Image.new('RGBA', (40 * len(order), 39))
for i, source in enumerate(order):
    cell = blinks[source] if i in (12, 16, 17, 34, 35) else cells[source]
    sheet.alpha_composite(cell, (40 * i, 0))
sheet.save(TARGET, optimize=True)
print(f'{TARGET.relative_to(ROOT)}: {sheet.width}x{sheet.height}, 36 frames')
