"""Curate VectoRaith "Traditional Japanese Buildings" facades into one small runtime atlas (requires Pillow).

The pack itself is NOT in the repository (its licence forbids redistributing the loose assets). Point JP_BUILDINGS_SRC at
the pack's Original/16x16 folder (the one with vectoraith_tileset_buildings_japanese_traditional_ATLAS.png):

    JP_BUILDINGS_SRC=/path/to/Original/16x16 python3 scripts/build-japanese-buildings.py

Each facade is cut whole from the pack's ATLAS sheet at native size and carries its own geometry, in facade pixels:
`door` (the doorway the street path and the shop shutter line up with), `windows` (warm panes at night) and `sign`
(the top of the name plaque). `replaces` names the game's prop IDs it draws; the game keeps their saved IDs.
"""
import json
import os
import sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'src/assets/jp-buildings'
SRC = Path(os.environ.get('JP_BUILDINGS_SRC', ''))
SHEET = SRC / 'vectoraith_tileset_buildings_japanese_traditional_ATLAS.png'
if not SHEET.is_file():
    sys.exit('JP_BUILDINGS_SRC must point at the Original/16x16 folder of the pack')
atlas_src = Image.open(SHEET).convert('RGBA')

# The pack repeats every sheet in three roofs: blue (x + 0), dark brown (x + 256) and grey-green (x + 512).
BLUE, BROWN, GREEN = 0, 256, 512

HOUSE = dict(rect=(128, 256, 112, 112), door=(48, 90, 16, 20), sign=73, windows=[
    (10, 88, 12, 10), (25, 88, 12, 10), (74, 88, 12, 10), (89, 88, 12, 10),
    (28, 49, 10, 6), (42, 49, 11, 6), (60, 49, 10, 6), (74, 49, 11, 6)])
INN = dict(rect=(0, 512, 144, 128), door=(58, 96, 28, 30),  # the doorway includes its front steps
           sign=85, windows=[
    (12, 100, 16, 10), (30, 100, 22, 10), (92, 100, 22, 10), (116, 100, 16, 10),
    (36, 78, 10, 4), (67, 78, 10, 4), (99, 78, 10, 4)])
SHOP = dict(rect=(1, 421, 78, 75), door=(45, 53, 16, 16), sign=27, windows=[(6, 53, 34, 10)])
TOWNHALL = dict(rect=(128, 896, 112, 128), door=(44, 102, 12, 18), sign=88, windows=[
    (10, 105, 15, 12), (65, 105, 10, 12), (82, 105, 12, 12), (16, 56, 30, 14), (64, 56, 30, 14)])

facades = []


def add(key, name, replaces, shape, roof):
    x, y, w, h = shape['rect']
    facades.append(dict(id='jp_' + key, name=name, replaces=replaces, rect=[x + roof, y, w, h],
                        door=list(shape['door']), windows=[list(r) for r in shape['windows']], sign=shape['sign']))


# Midnight Maki grows with the story: an old dark house, the same house restored, a bigger blue house, the grand inn.
add('restaurant_s0', 'Casa vieja (Midnight Maki, etapa 0)', ['bld_restaurant_s0'], HOUSE, BROWN)
add('restaurant_s1', 'Casa restaurada (Midnight Maki, etapa 1)', ['bld_restaurant_s1'], HOUSE, GREEN)
add('restaurant_s2', 'Casa grande (Midnight Maki, etapa 2)', ['bld_restaurant_s2', 'bld_restaurant'], HOUSE, BLUE)
add('restaurant_s3', 'Posada (Midnight Maki, etapa 3)', ['bld_restaurant_s3'], INN, BLUE)
# The three shops share the awning frontage, each under its own roof; the library is the two-storey hall.
add('bakery', 'Panadería', ['bld_bakery'], SHOP, BROWN)
add('clothes', 'Ropa de Yuki', ['bld_clothes'], SHOP, GREEN)
add('store', 'Almacén de Taro', ['bld_store'], SHOP, BLUE)
add('library', 'Biblioteca', ['bld_library'], TOWNHALL, BLUE)

# Shelf packing, one facade per slot.
W = 512
x = y = shelf = 0
for f in facades:
    w, h = f['rect'][2], f['rect'][3]
    if x + w > W:
        x, y, shelf = 0, y + shelf + 1, 0
    f['atlas'] = dict(x=x, y=y, w=w, h=h)
    x += w + 1
    shelf = max(shelf, h)
atlas = Image.new('RGBA', (W, y + shelf))
for f in facades:
    sx, sy, sw, sh = f['rect']
    atlas.paste(atlas_src.crop((sx, sy, sx + sw, sy + sh)), (f['atlas']['x'], f['atlas']['y']))

DEST.mkdir(parents=True, exist_ok=True)
atlas.save(DEST / 'atlas.png', optimize=True)
(DEST / 'catalog.json').write_text(json.dumps(dict(
    source='VectoRaith, Traditional Japanese Buildings Tileset (16x16, ATLAS sheet)', facades=facades),
    indent=1, ensure_ascii=False) + '\n', encoding='utf-8')
print(f'{len(facades)} facades -> {atlas.width}x{atlas.height}')
