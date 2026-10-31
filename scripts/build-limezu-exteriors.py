"""Curate LimeZu "Modern Exteriors" pieces into one small runtime atlas (requires Pillow).

The pack itself is NOT in the repository (its license forbids redistributing it). Point LIMEZU_EXT_SRC at the pack's
Modern_Exteriors_16x16 folder (the one with ME_Theme_Sorter_16x16 and Animated_16x16):

    LIMEZU_EXT_SRC=/path/to/Modern_Exteriors_16x16 python3 scripts/build-limezu-exteriors.py

Two kinds of entries, both with explicit 16x16 source rectangles:
- tiles: ground tiles drawn into the game's tileset (sand, the animated sea and its shoreline);
- pieces: props drawn at native size; each names the prop IDs of the game it draws (`replaces`).
Sand and the sandy pixels of the shoreline use a muted cream palette; sea and props keep their original colours.
"""
import json
import os
import sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'src/assets/limezu'
SRC = Path(os.environ.get('LIMEZU_EXT_SRC', ''))
if not (SRC / 'ME_Theme_Sorter_16x16').is_dir():
    sys.exit('LIMEZU_EXT_SRC must point at the Modern_Exteriors_16x16 folder of the pack')

SHEETS = {
    'beach': 'ME_Theme_Sorter_16x16/21_Beach_16x16.png',
    'sea': 'Animated_16x16/Animated_Terrains_16x16/Sea_Water_Tileset_Basic_16x16.png',
}
_sheets = {}


def sheet(name):
    if name not in _sheets:
        _sheets[name] = Image.open(SRC / SHEETS[name]).convert('RGBA')
    return _sheets[name]


tiles = []  # (name, sheet, (x, y))  in tile units

# Lower the strong orange/yellow saturation and the contrast of the repeating ripples.
# The shoreline shares these colours so an orange seam cannot remain along the water.
SAND_PALETTE = {
    (209, 117, 69): (190, 181, 163),
    (219, 132, 71): (204, 195, 176),
    (225, 147, 75): (215, 205, 185),
    (228, 155, 79): (222, 212, 192),
    (224, 155, 78): (225, 215, 195),
    (227, 166, 82): (228, 218, 198),
    (230, 174, 85): (231, 221, 201),
    (232, 182, 91): (233, 223, 203),
    (232, 187, 91): (235, 225, 205),
    (233, 192, 98): (237, 227, 207),
    (168, 195, 167): (183, 207, 196),
}


def soften_sand(image):
    pixels = list(image.getdata())
    image.putdata([(*SAND_PALETTE.get((r, g, b), (r, g, b)), a) for r, g, b, a in pixels])
    return image


def tile(name, sh, tx, ty):
    tiles.append((name, sh, (tx * 16, ty * 16, 16, 16)))


# Dry sand: the plain wave pattern, seamless with itself.
tile('sand', 'beach', 11, 8)
# Packed sand for the beach's walks: the darker take on the same pattern.
tile('sandpath', 'beach', 12, 8)
# The sea: 8 animation frames of a 4x4 pool; the 2x2 middle is open water, its top row is the waterline under sand.
for f in range(8):
    for p in range(4):
        tile(f'sea{p}_{f}', 'sea', f * 4 + 1 + p % 2, 1 + p // 2)
    for p in range(2):
        tile(f'seashore{p}_{f}', 'sea', f * 4 + 1 + p, 0)

pieces = []


def add(key, name, replaces, sh, rect):
    pieces.append(dict(id='lx_' + key, name=name, replaces=replaces, sheet=sh, rect=list(rect)))


# Beach: parasols, towels, sandcastles, signposts, a seagull, buoys and rocks standing in the sea.
add('umbrella_blue', 'Sombrilla celeste', ['beach_umbrella_blue'], 'beach', (400, 211, 47, 61))
add('umbrella_green', 'Sombrilla verde', ['beach_umbrella_green'], 'beach', (464, 211, 47, 61))
add('umbrella_orange', 'Sombrilla naranja', ['beach_umbrella_orange'], 'beach', (464, 275, 47, 61))
add('towel_lilac', 'Toallón lila', ['beach_towel_lilac'], 'beach', (418, 65, 28, 28))
add('towel_sky', 'Toallón celeste', ['beach_towel_sky'], 'beach', (418, 97, 28, 28))
add('towel_sun', 'Toallón amarillo', ['beach_towel_sun'], 'beach', (450, 97, 28, 28))
add('sandcastle', 'Castillo de arena', ['sandcastle'], 'beach', (81, 299, 47, 36))
add('sandcastle_wide', 'Castillo de arena con muralla', ['sandcastle_wide'], 'beach', (193, 300, 46, 35))
add('sandcastle_tower', 'Torre de arena', ['sandcastle_tower'], 'beach', (137, 294, 18, 25))
add('seagull', 'Gaviota', ['seagull'], 'beach', (133, 667, 23, 20))
add('buoy', 'Boya', ['buoy'], 'beach', (8, 853, 17, 27))
add('buoy_red', 'Boya faro', ['buoy_red'], 'beach', (39, 849, 18, 31))
add('buoy_orange', 'Boya naranja', ['buoy_orange'], 'beach', (72, 862, 17, 18))
add('rock_big', 'Peñasco en el mar', ['sea_rock_big'], 'beach', (2, 728, 58, 56))
add('rock_tall', 'Roca alta en el mar', ['sea_rock_tall'], 'beach', (100, 721, 24, 31))
add('rock_mid', 'Roca en el mar', ['sea_rock'], 'beach', (85, 755, 23, 29))
add('rock_small', 'Piedra en el mar', ['sea_rock_small'], 'beach', (70, 733, 20, 19))
add('rock_arch', 'Roca curva en el mar', ['sea_rock_arch'], 'beach', (166, 700, 22, 35))
add('beach_grass', 'Matas de playa', ['beach_grass'], 'beach', (54, 893, 19, 19))


def add_single(key, name, replaces, folder, single):
    """A piece from the pack's Singles folders: the whole file, trimmed to its visible pixels."""
    sh = f'ME_Theme_Sorter_16x16/{folder}_Singles_16x16/ME_Singles_{single}.png'
    SHEETS[sh] = sh
    left, top, right, bottom = sheet(sh).getbbox()
    add(key, name, replaces, sh, (left, top, right - left, bottom - top))


# Plaza: the fountain, its benches, street lamps, mailbox, pots, planters on the flower beds and two pigeons.
add_single('fountain', 'Fuente de la plaza', ['fountain'], '17_Garden', 'Garden_16x16_Fountain_3_4')
add_single('bench', 'Banco de plaza', ['bench'], '3_City_Props', 'City_Props_16x16_Bench_7')
add_single('street_lamp', 'Farol', ['lamppost', 'street_lamp_l', 'street_lamp_r'], '3_City_Props', 'City_Props_16x16_Street_Lamp_5')
add_single('mailbox', 'Buzón', ['mailbox'], '3_City_Props', 'City_Props_16x16_Mailbox_1')
add_single('pot_pink', 'Maceta con flores rosas', ['pot_rose'], '17_Garden', 'Garden_16x16_Big_Pink_Flower_Vase')
add_single('pot_topiary', 'Maceta con arbusto', ['pot_cream'], '17_Garden', 'Garden_16x16_Bush_Potted_3')
add_single('planter_pink', 'Cantero rosa', ['planter_pink'], '3_City_Props', 'City_Props_16x16_Flower_Bush_1')
add_single('planter_red', 'Cantero rojo', ['planter_red'], '3_City_Props', 'City_Props_16x16_Flower_Bush_2')
add_single('planter_white', 'Cantero blanco', ['planter_white'], '3_City_Props', 'City_Props_16x16_Flower_Bush_3')
add_single('pigeon', 'Paloma', ['pigeon'], '3_City_Props', 'City_Props_16x16_Pigeon_1')
add_single('pigeon_peck', 'Paloma picoteando', ['pigeon_peck'], '3_City_Props', 'City_Props_16x16_Pigeon_2')

# Layout: tiles in a 16-wide grid at the top, pieces on shelves underneath.
COLS = 16
W = COLS * 16
tile_rows = (len(tiles) + COLS - 1) // COLS
placed = []
x = y = 0
shelf = 0
top = tile_rows * 16
for p in pieces:
    w, h = p['rect'][2], p['rect'][3]
    if x + w > W:
        x, y, shelf = 0, y + shelf + 1, 0
    placed.append((p, x, top + y))
    x += w + 1
    shelf = max(shelf, h)
H = top + y + shelf

atlas = Image.new('RGBA', (W, H))
out_tiles = {}
for i, (name, sh, (sx, sy, sw, shh)) in enumerate(tiles):
    ax, ay = (i % COLS) * 16, (i // COLS) * 16
    image = sheet(sh).crop((sx, sy, sx + sw, sy + shh))
    if name in ('sand', 'sandpath') or name.startswith('seashore'):
        image = soften_sand(image)
    atlas.paste(image, (ax, ay))
    out_tiles[name] = dict(sheet=sh, rect=[sx, sy, sw, shh], atlas=dict(x=ax, y=ay))
out_pieces = []
for p, ax, ay in placed:
    sx, sy, sw, shh = p['rect']
    atlas.paste(sheet(p['sheet']).crop((sx, sy, sx + sw, sy + shh)), (ax, ay))
    out_pieces.append(dict(p, atlas=dict(x=ax, y=ay, w=sw, h=shh)))

DEST.mkdir(parents=True, exist_ok=True)
atlas.save(DEST / 'exteriors.png', optimize=True)
(DEST / 'exteriors.json').write_text(json.dumps(dict(source='LimeZu Modern Exteriors 16x16',
    sandPalette=[dict(original=list(k), adapted=list(v)) for k, v in SAND_PALETTE.items()],
    tiles=out_tiles, pieces=out_pieces), indent=1, ensure_ascii=False) + '\n', encoding='utf-8')
print(f'{len(out_tiles)} tiles, {len(out_pieces)} pieces -> {W}x{H}')
