"""Curate Serene Village v1.9 at native 16px resolution (Pillow).

SERENE_SRC may point at SERENE_VILLAGE_REVAMPED. Only actual PNG sprites are
used, never store previews. Rectangles, source hash and palette edits are recorded.
The muted greens and beige paths fit Villa Nori's existing grass transitions.
No houses, animated water or extra map clutter are imported.
"""
import hashlib
import json
import os
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = Path(os.environ.get('SERENE_SRC', ROOT / 'ASSETS DESCARGADOS/NUEVO/Serene Village/SERENE_VILLAGE_REVAMPED'))
DEST = ROOT / 'src/assets/serene'
source = SRC / 'Serene_Village_16x16.png'
sheet = Image.open(source).convert('RGBA')

# Keep the source's pixel geometry; use restrained foliage and low-contrast ground.
PALETTE = {
    (118, 197, 100): (175, 193, 131),
    (123, 203, 105): (177, 195, 133),
    (105, 173, 89): (162, 180, 119),
    (203, 154, 78): (232, 210, 171),
    (210, 159, 81): (236, 215, 174),
    (155, 194, 70): (146, 171, 103),
    (184, 208, 64): (177, 194, 132),
    (86, 141, 97): (104, 136, 92),
    (93, 194, 70): (127, 161, 99),
    (112, 208, 64): (160, 184, 114),
    (86, 141, 125): (94, 128, 108),
}


def crop(rect, muted=True):
    x, y, w, h = rect
    image = sheet.crop((x, y, x + w, y + h))
    if muted:
        pixels = image.load()
        for py in range(h):
            for px in range(w):
                r, g, b, a = pixels[px, py]
                pixels[px, py] = (*PALETTE.get((r, g, b), (r, g, b)), a)
    return image


# Only fully opaque interior ground tiles: no grass border baked into dirt.
TILES = [
    ('grass', (64, 16, 16, 16)),
    ('dirt', (160, 32, 16, 16)),
]
SELECTION = [
    ('oak_sage', 'Árbol frondoso salvia', ['tree'], (144, 192, 32, 48)),
    ('oak_forest', 'Árbol frondoso de bosque', ['tree_dark'], (176, 192, 32, 48)),
    ('bush', 'Arbusto bajo', ['bush'], (112, 192, 16, 16)),
    ('bush_rose', 'Arbusto rosado', ['bush_flower', 'bush_berry'], (32, 192, 16, 16)),
    ('daisies', 'Margaritas', ['flowers'], (32, 224, 16, 16)),
    ('flowers_blue', 'Flores azules', ['flowers_lav'], (48, 192, 16, 16)),
    ('rock', 'Piedra', ['rock'], (16, 240, 16, 16)),
    ('rocks', 'Grupo de piedras', ['bigrock'], (0, 272, 32, 16)),
    ('fence', 'Tramo de cerca rural', ['fence'], (80, 240, 16, 16)),
]

atlas = Image.new('RGBA', (256, 128))
tiles = {}
for i, (key, rect) in enumerate(TILES):
    atlas.alpha_composite(crop(rect), (i * 16, 0))
    tiles[key] = dict(rect=list(rect), atlas=dict(x=i * 16, y=0, w=16, h=16))

pieces = []
x, y, row_h = 0, 18, 0
for key, name, ids, rect in SELECTION:
    image = crop(rect)
    bbox = image.getbbox()
    if bbox is None:
        raise ValueError(f'Empty sprite: {key}')
    image = image.crop(bbox)
    w, h = image.size
    if x + w > atlas.width:
        x, y, row_h = 0, y + row_h + 2, 0
    if y + h > atlas.height:
        raise ValueError('Atlas overflow')
    atlas.alpha_composite(image, (x, y))
    pieces.append(dict(id=key, name=name, replaces=ids, rect=list(rect), trim=list(bbox),
                       atlas=dict(x=x, y=y, w=w, h=h)))
    x += w + 2
    row_h = max(row_h, h)

DEST.mkdir(parents=True, exist_ok=True)
atlas.save(DEST / 'atlas.png', optimize=True)
catalog = dict(author='LimeZu', pack='Serene Village revamped v1.9',
    url='https://limezu.itch.io/serenevillagerevamped', license='CC-BY-4.0',
    licenseUrl='https://creativecommons.org/licenses/by/4.0/',
    source=source.name, sourceSha256=hashlib.sha256(source.read_bytes()).hexdigest(),
    sourceTileSize=16, scale=1, width=atlas.width, height=atlas.height,
    palette=[dict(original=list(a), adapted=list(b)) for a, b in PALETTE.items()],
    tiles=tiles, pieces=pieces)
(DEST / 'catalog.json').write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
(DEST / 'CREDITS.txt').write_text(
    'Serene Village - revamped v1.9 by LimeZu\n'
    'https://limezu.itch.io/serenevillagerevamped\n'
    'Licensed under Creative Commons Attribution 4.0 International (CC BY 4.0).\n'
    'https://creativecommons.org/licenses/by/4.0/\n'
    'Changes for Midnight Maki: selected crops, transparent margins trimmed,\n'
    'greens and dirt palette adapted, packed in a small atlas. Native pixel size retained.\n', encoding='utf-8')
print(f'{len(tiles)} ground tiles, {len(pieces)} sprites, {(DEST / "atlas.png").stat().st_size} bytes')
