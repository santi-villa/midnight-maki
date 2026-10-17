"""Pick the Cozy Farm Lite pieces the game uses (crop stages, farm props) into one small atlas.
Source: ASSETS DESCARGADOS/ORGANIZADO/biblioteca/03_mundo_y_huerta/07/cozy-farm-lite (commercial use allowed, see its LICENSE.txt).
Run: python3 scripts/build-farm-assets.py   (needs Pillow)"""
from pathlib import Path
from PIL import Image
import hashlib, json, shutil

root = Path(__file__).resolve().parents[1]
src = root / 'ASSETS DESCARGADOS/ORGANIZADO/biblioteca/03_mundo_y_huerta/07/cozy-farm-lite'
dest = root / 'src/assets/farm'
dest.mkdir(parents=True, exist_ok=True)

# name -> (file, crop box inside the file or None for the whole picture)
pieces = {}
for crop in ('carrot', 'tomato', 'wheat'):
    for stage in range(4):
        pieces[f'{crop}_{stage}'] = (f'crops/1x/{crop}-stages.png', (stage * 16, 0, stage * 16 + 16, 16))
for name, f in {'hay': 'hay-bale', 'crate': 'crate', 'barrel': 'barrel', 'bush': 'bush', 'flowers': 'flowers', 'rock': 'rock'}.items():
    pieces[name] = (f'props/1x/{f}.png', None)
pieces['oak'] = ('trees/1x/oak.png', None)

images = {n: Image.open(src / f).convert('RGBA').crop(box) if box else Image.open(src / f).convert('RGBA') for n, (f, box) in pieces.items()}
# simple shelf packing, tallest first, in rows 192 px wide
W = 192
x = y = row_h = 0
rects = {}
for n, im in sorted(images.items(), key=lambda kv: (-kv[1].height, kv[0])):
    if x + im.width > W:
        x, y, row_h = 0, y + row_h, 0
    rects[n] = [x, y, im.width, im.height]
    x += im.width; row_h = max(row_h, im.height)
H = y + row_h
atlas = Image.new('RGBA', (W, H), (0, 0, 0, 0))
for n, (rx, ry, _, _) in rects.items():
    atlas.paste(images[n], (rx, ry))
atlas.save(dest / 'farm.png', optimize=True)
(dest / 'farm.json').write_text(json.dumps(dict(size=[W, H], pieces=rects), indent=1) + '\n')
shutil.copy(src / 'LICENSE.txt', dest / 'Cozy-Farm-Lite-LICENSE.txt')
(dest / 'provenance.json').write_text(json.dumps(dict(pack='Cozy Farm Lite', files=sorted({f for f, _ in pieces.values()}),
    sha256={f: hashlib.sha256((src / f).read_bytes()).hexdigest() for f in sorted({f for f, _ in pieces.values()})}), indent=1) + '\n')
print(len(rects), 'pieces', (W, H))
