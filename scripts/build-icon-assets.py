"""Sushi 16x16 (pack 14) and Fishing Icon Pack 16x16 (pack 16) into one icon atlas, 16x16 cells, named.
Run: python3 scripts/build-icon-assets.py   (needs Pillow). Both packs are used with the owner's permission (private project)."""
from pathlib import Path
from PIL import Image
import json, re

root = Path(__file__).resolve().parents[1]
lib = root / 'ASSETS DESCARGADOS/ORGANIZADO/biblioteca'
dest = root / 'src/assets/icons16'
dest.mkdir(parents=True, exist_ok=True)

named = {}
for f in sorted((lib / '01_comida/14/Sushi-Pixel-Art-Pack').glob('*.png')):
    named['sushi_' + f.stem.lower().replace('-', '_')] = Image.open(f).convert('RGBA')
for f in sorted((lib / '07_pesca/16/Separated Sprites/16x16').glob('*.png')):
    n = int(re.findall(r'(\d+)', f.stem)[-1])
    named[f'fish_{n}'] = Image.open(f).convert('RGBA')

cols = 16
rows = (len(named) + cols - 1) // cols
atlas = Image.new('RGBA', (cols * 16, rows * 16), (0, 0, 0, 0))
cells = {}
for i, (n, im) in enumerate(named.items()):
    assert im.size == (16, 16), (n, im.size)
    x, y = (i % cols) * 16, (i // cols) * 16
    atlas.paste(im, (x, y))
    cells[n] = [x, y]
atlas.save(dest / 'icons.png', optimize=True)
(dest / 'icons.json').write_text(json.dumps(dict(cell=16, cells=cells), indent=0) + '\n')
print(len(cells), 'icons', atlas.size)
