"""Crop the user-supplied village sheet; keep the source out of the runtime bundle."""
from pathlib import Path
from PIL import Image
import hashlib
import json

root = Path(__file__).resolve().parents[1]
source_path = root / 'art-source/village/lamina-aportada.png'
source = Image.open(source_path).convert('RGBA')
# Rectangles are in the uploaded image's actual pixels, not an assumed 16px grid.
rects = {
    'restaurant_1': [348, 345, 52, 63],
    'restaurant_2': [253, 169, 74, 73],
    'restaurant_3': [676, 169, 94, 84],
    'boat': [254, 805, 41, 17], 'boat_rope': [254, 827, 41, 17],
    'shrub': [513, 254, 29, 28], 'shrub_wide': [555, 254, 29, 28],
    'fishrack': [310, 760, 24, 19], 'nettable': [307, 781, 30, 20],
    'fish_crate': [310, 740, 25, 19],
    'lanterns': [120, 136, 49, 16], 'paperlamp': [87, 96, 12, 10],
    'woodstand': [49, 183, 14, 15], 'barrel': [127, 802, 10, 10],
    'stall_blue': [85, 675, 53, 71], 'stall_gray': [254, 675, 53, 71], 'stall_green': [423, 675, 53, 71],
    'stone_lamp': [43, 211, 13, 24],
}
# Opening/window rectangles relative to each selected facade, used by its art and light mask.
facades = [
    dict(frame='restaurant_1', maxHeight=82, door=[18, 51, 16, 12], windows=[[4, 54, 9, 7], [38, 54, 10, 7]], sign=[26, 43]),
    dict(frame='restaurant_2', maxHeight=100, door=[29, 55, 18, 18], windows=[[5, 58, 20, 11], [51, 58, 19, 11], [33, 32, 13, 10]], sign=[37, 51]),
    dict(frame='restaurant_3', maxHeight=108, door=[37, 63, 21, 21], windows=[[6, 65, 24, 12], [63, 65, 25, 12]], sign=[47, 58]),
]
atlas = Image.new('RGBA', (512, 256))
frames = {}; x = y = row_height = 0
for key, (sx, sy, w, h) in rects.items():
    if x + w + 2 > atlas.width:
        x = 0; y += row_height + 2; row_height = 0
    if y + h > atlas.height:
        raise ValueError('Atlas full')
    piece = source.crop((sx, sy, sx + w, sy + h))
    # The uploaded sheet has a faint black matte (alpha 43) around some isolated pieces.
    pixels = list(piece.getdata())
    piece.putdata([(r, g, b, 0 if a < 128 else a) for r, g, b, a in pixels])
    atlas.paste(piece, (x, y))
    frames[key] = dict(x=x, y=y, w=w, h=h, source=[sx, sy, w, h])
    x += w + 2; row_height = max(row_height, h)
dest = root / 'src/assets/village'
dest.mkdir(parents=True, exist_ok=True)
atlas.save(dest / 'atlas.png', optimize=True)
(dest / 'catalog.json').write_text(json.dumps(dict(
    source='art-source/village/lamina-aportada.png', sourceSize=list(source.size),
    sha256=hashlib.sha256(source_path.read_bytes()).hexdigest(),
    author='VectoRaith', frames=frames, facades=facades,
), indent=2) + '\n')
print(f'{len(frames)} pieces in {atlas.width}x{atlas.height}')
