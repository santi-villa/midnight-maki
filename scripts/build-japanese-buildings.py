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

# Scenery: whole pieces drawn bottom-centred at native size. `tiles` (optional) is the footprint the piece needs.
pieces = []


def piece(key, name, replaces, rect, tiles=None):
    x, y, w, h = rect
    left, top, right, bottom = atlas_src.crop((x, y, x + w, y + h)).getbbox()
    pieces.append(dict(id='jp_' + key, name=name, replaces=replaces, rect=[x + left, y + top, right - left, bottom - top],
                       **({'tiles': list(tiles)} if tiles else {})))


piece('shrine', 'Santuario', ['shrine'], (178, 640, 78, 108), (6, 1))
piece('torii', 'Torii', ['torii_w6', 'torii_w4'], (178, 576, 78, 64))
piece('stone_lantern', 'Farol de piedra', ['stonelantern'], (176, 514, 16, 30))
piece('komainu_l', 'Komainu', ['komainu_l'], (144, 526, 16, 34))
piece('komainu_r', 'Komainu', ['komainu_r'], (160, 526, 16, 34))
piece('pine', 'Pino japonés', ['pine'], (8, 640, 48, 47))
piece('stairs', 'Escalón de piedra', ['stonestairs'], (16, 144, 16, 16))
piece('board', 'Tablero de anuncios', ['board'], (96, 290, 32, 30))
piece('well', 'Pozo', ['well'], (98, 320, 30, 48))
piece('sakura', 'Cerezo', ['sakura'], (720, 1169, 48, 47))
# The fish market sheet: small awning stalls (one per roof colour) for the market's stalls, and the harbour's fish
# drying rack and crates of fish.
piece('stall_blue', 'Puesto con toldo (azul)', ['stall_night', 'stall_rose'], (128, 1648, 48, 48))
piece('stall_brown', 'Puesto con toldo (marrón)', ['stall_gold'], (128 + BROWN, 1648, 48, 48))
piece('stall_green', 'Puesto con toldo (verde)', ['stall_sage'], (128 + GREEN, 1648, 48, 48))
piece('fish_rack', 'Secadero de pescado', ['wharf_fish_rack'], (208, 1696, 48, 32))
piece('fish_crate_blue', 'Cajón de pescado azul', ['wharf_fish_crate_b'], (208, 1632, 48, 32))
piece('fish_crate_red', 'Cajón de pescado rojo', ['wharf_fish_crate_r'], (208, 1760, 48, 32))

# Shelf packing, one facade per slot.
W = 512
x = y = shelf = 0
for f in facades + pieces:
    w, h = f['rect'][2], f['rect'][3]
    if x + w > W:
        x, y, shelf = 0, y + shelf + 1, 0
    f['atlas'] = dict(x=x, y=y, w=w, h=h)
    x += w + 1
    shelf = max(shelf, h)
# Paths: the terrain sheet's sandy path on grass (an autotile: 3x3 edges and corners at 32..80, narrow pieces in column 16
# and row 48), copied as one 64x64 block; the game picks each tile from its neighbours (art/japaneseBuildings.ts).
TERRAIN = Image.open(SRC / 'vectoraith_tileset_terrains_3x3.png').convert('RGBA')
path_block = TERRAIN.crop((16, 0, 80, 64))


def drop_guide_dots(im):
    """The sheet marks its tiles with small grass dots inside the sand: paint each isolated speck with the sand around it."""
    px = im.load()
    W_, H_ = im.size
    grass = lambda c: c[3] > 0 and c[1] > c[0]
    out = im.copy(); po = out.load()
    for yy in range(H_):
        for xx in range(W_):
            if not grass(px[xx, yy]):
                continue
            win = [px[i, j] for j in range(max(0, yy - 3), min(H_, yy + 4)) for i in range(max(0, xx - 3), min(W_, xx + 4))]
            g = sum(1 for c in win if grass(c))
            if g < 16:
                sand = [c for c in win if c[3] > 0 and not grass(c)]
                if sand:
                    po[xx, yy] = max(set(sand), key=sand.count)
    return out


path_block = drop_guide_dots(path_block)
# The sheet builds tiles from quarters (RPG Maker style), so even the middle tile has grass in its corners. Corners that
# face more path (both sides along it are path) are filled with sand taken from the clean middle of the centre tile.
PIECES = {15: (2, 1), 14: (2, 0), 11: (2, 2), 7: (1, 1), 13: (3, 1), 6: (1, 0), 12: (3, 0), 3: (1, 2), 9: (3, 2),
          5: (0, 1), 4: (0, 0), 1: (0, 2), 10: (2, 3), 2: (1, 3), 8: (3, 3), 0: (0, 3)}
sand = path_block.crop((32 + 4, 16 + 4, 32 + 12, 16 + 12))
bp = path_block.load(); sp = sand.load()
for mask, (col, row) in PIECES.items():
    n, e, s_, w = mask & 1, mask & 2, mask & 4, mask & 8
    for corner, ok in (((0, 0), n and w), ((11, 0), n and e), ((0, 11), s_ and w), ((11, 11), s_ and e)):
        if not ok:
            continue
        for dy in range(5):
            for dx in range(5):
                x0, y0 = col * 16 + corner[0] + dx, row * 16 + corner[1] + dy
                bp[x0, y0] = sp[x0 % 8, y0 % 8]
terrain_at = dict(x=0, y=y + shelf + 1)
atlas = Image.new('RGBA', (W, y + shelf + 1 + 64))
atlas.paste(path_block, (terrain_at['x'], terrain_at['y']))
for f in facades + pieces:
    sx, sy, sw, sh = f['rect']
    atlas.paste(atlas_src.crop((sx, sy, sx + sw, sy + sh)), (f['atlas']['x'], f['atlas']['y']))

DEST.mkdir(parents=True, exist_ok=True)
atlas.save(DEST / 'atlas.png', optimize=True)
(DEST / 'catalog.json').write_text(json.dumps(dict(
    source='VectoRaith, Traditional Japanese Buildings Tileset (16x16, ATLAS sheet)', facades=facades, pieces=pieces,
    paths=dict(sheet='vectoraith_tileset_terrains_3x3.png', rect=[16, 0, 64, 64], atlas=terrain_at)),
    indent=1, ensure_ascii=False) + '\n', encoding='utf-8')
print(f'{len(facades)} facades, {len(pieces)} pieces -> {atlas.width}x{atlas.height}')
