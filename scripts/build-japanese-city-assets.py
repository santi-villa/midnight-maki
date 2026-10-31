"""Extract only the Japanese City FREE pieces used by Villa Nori (Pillow).

JAPANESE_CITY_SRC may point to Free_Version; defaults to the local download.
Coordinates refer to Tilemap/Tilemap.png, never Preview_of_paid_version_tilemap.png.
Keep native pixels, transparency and palette. The two stalls combine a free
awning with a free counter; no complete buildings or streets are imported.
"""
import hashlib
import json
import os
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = Path(os.environ.get('JAPANESE_CITY_SRC', ROOT / 'ASSETS DESCARGADOS/NUEVO/The japanese city game assets/Free_Version'))
DEST = ROOT / 'src/assets/japanese-city'
source = SRC / 'Tilemap/Tilemap.png'
sheet = Image.open(source).convert('RGBA')

# Rectangles include the transparent tile padding; trim only transparent pixels.
SELECTION = [
    ('vending_red', 'Expendedora roja', ['vending_red'], [(384, 64, 32, 32)]),
    ('vending_white', 'Expendedora blanca', ['vending_blue'], [(416, 64, 32, 32)]),
    ('power_pole', 'Poste eléctrico', ['jc_power_pole'], [(448, 64, 32, 96)]),
    ('power_pole_transformer', 'Poste con transformador', ['jc_power_pole_transformer'], [(480, 64, 32, 96)]),
    ('shop_sign_left', 'Letrero comercial izquierdo', ['jc_shop_sign_left'], [(672, 224, 32, 32)]),
    ('shop_sign_right', 'Letrero comercial derecho', ['jc_shop_sign_right'], [(704, 224, 32, 32)]),
    ('shop_display', 'Expositor de comercio', ['jc_shop_display'], [(512, 144, 32, 16)]),
    ('market_blue', 'Puesto de toldo azul', ['jc_market_blue'], [(672, 352, 64, 48), (512, 144, 32, 16)]),
    ('market_red', 'Puesto de toldo rojo', ['jc_market_red'], [(736, 352, 64, 48), (512, 144, 32, 16)]),
]

atlas = Image.new('RGBA', (256, 128))
pieces = []
x = y = row_h = 0
for key, name, ids, rects in SELECTION:
    crops = [sheet.crop((rx, ry, rx + rw, ry + rh)) for rx, ry, rw, rh in rects]
    if len(crops) == 2:
        # A counter between the awning's two posts, at the same ground contact.
        crops[0].alpha_composite(crops[1], (16, 32))
    bbox = crops[0].getbbox()
    if not bbox:
        raise ValueError(f'Empty source for {key}')
    art = crops[0].crop(bbox)
    w, h = art.size
    if x + w > atlas.width:
        x = 0
        y += row_h + 2
        row_h = 0
    if y + h > atlas.height:
        raise ValueError('Atlas overflow')
    atlas.alpha_composite(art, (x, y))
    pieces.append(dict(id=key, name=name, replaces=ids, sourceRects=[list(r) for r in rects],
                       trim=list(bbox), atlas=dict(x=x, y=y, w=w, h=h)))
    x += w + 2
    row_h = max(row_h, h)

DEST.mkdir(parents=True, exist_ok=True)
atlas.save(DEST / 'atlas.png', optimize=True)
catalog = dict(author='GuttyKreum', pack='The Japan Collection: Japanese City (Free Version)',
               url='https://guttykreum.itch.io/free-japanese-city-game-assets',
               source='Free_Version/Tilemap/Tilemap.png', sourceSha256=hashlib.sha256(source.read_bytes()).hexdigest(),
               sourceTileSize=32, scale=1, width=atlas.width, height=atlas.height, pieces=pieces)
(DEST / 'catalog.json').write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(f'{len(pieces)} pieces, {atlas.width}x{atlas.height}, {(DEST / "atlas.png").stat().st_size} bytes')
