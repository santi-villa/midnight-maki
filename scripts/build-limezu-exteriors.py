"""Curate LimeZu "Modern Exteriors" pieces into one small runtime atlas (requires Pillow).

The pack itself is NOT in the repository (its license forbids redistributing it). Point LIMEZU_EXT_SRC at the pack's
Modern_Exteriors_16x16 folder (the one with ME_Theme_Sorter_16x16 and Animated_16x16):

    LIMEZU_EXT_SRC=/path/to/Modern_Exteriors_16x16 python3 scripts/build-limezu-exteriors.py

Two kinds of entries, both with explicit 16x16 source rectangles:
- tiles: ground tiles drawn into the game's tileset (sand, the animated sea and its shoreline);
- pieces: props drawn at native size; each names the prop IDs of the game it draws (`replaces`).
Sand and the sandy pixels of the shoreline use a muted cream palette; sea and props keep their original colours.
"""
import colorsys
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
    'seacorner': 'Animated_16x16/Animated_Terrains_16x16/Sea_Water_Tileset_Outer_Corners_16x16.png',
}
_sheets = {}


def sheet(name):
    if name not in _sheets:
        _sheets[name] = Image.open(SRC / SHEETS[name]).convert('RGBA')
    return _sheets[name]


tiles = []  # (name, sheet, (x, y))  in tile units

# Lower the strong orange/yellow saturation and the contrast of the repeating ripples; a warm cream close to the village's dirt paths.
# The shoreline shares these colours so an orange seam cannot remain along the water.
SAND_PALETTE = {
    (209, 117, 69): (190, 177, 143),
    (219, 132, 71): (204, 191, 156),
    (225, 147, 75): (215, 201, 165),
    (228, 155, 79): (222, 208, 172),
    (224, 155, 78): (225, 211, 175),
    (227, 166, 82): (228, 214, 178),
    (230, 174, 85): (231, 217, 181),
    (232, 182, 91): (233, 219, 183),
    (232, 187, 91): (235, 221, 185),
    (233, 192, 98): (237, 223, 187),
    (168, 195, 167): (183, 207, 196),
}


def soften_sand(image):
    pixels = list(image.getdata())
    image.putdata([(*SAND_PALETTE.get((r, g, b), (r, g, b)), a) for r, g, b, a in pixels])
    return image


def sand_tone(image):
    """Desaturates the pack's orange sand toward the muted cream of SAND_PALETTE, keeping each pixel's lightness."""
    out = []
    for r, g, b, a in image.getdata():
        h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
        r2, g2, b2 = colorsys.hsv_to_rgb(0.11, min(s, 1) * 0.42, min(1, v * 1.02))
        out.append((round(r2 * 255), round(g2 * 255), round(b2 * 255), a))
    image.putdata(out)
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
        # the pool's sides follow a coast that steps down: sand on the left (W) or on the right (E)
        tile(f'seashoreW{p}_{f}', 'sea', f * 4, 1 + p)
        tile(f'seashoreE{p}_{f}', 'sea', f * 4 + 3, 1 + p)
    tile(f'seashoreNW0_{f}', 'sea', f * 4, 0)
    tile(f'seashoreNE0_{f}', 'sea', f * 4 + 3, 0)
    # inner corners: open water with sand only at its top-left (IW) or top-right (IE) corner
    tile(f'seashoreIE0_{f}', 'seacorner', f * 2, 1)
    tile(f'seashoreIW0_{f}', 'seacorner', f * 2 + 1, 1)

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
    if not (SRC / sh).exists():  # the beach singles have no ME_Singles_ prefix
        sh = f'ME_Theme_Sorter_16x16/{folder}_Singles_16x16/{single}.png'
    SHEETS[sh] = sh
    left, top, right, bottom = sheet(sh).getbbox()
    add(key, name, replaces, sh, (left, top, right - left, bottom - top))


# Plaza: the fountain, its benches, street lamps, mailbox, pots, planters on the flower beds and two pigeons.
add_single('fountain', 'Fuente de la plaza', ['fountain'], '17_Garden', 'Garden_16x16_Fountain_3_4')
add_single('bench', 'Banco de plaza', ['bench', 'wharf_bench'], '3_City_Props', 'City_Props_16x16_Bench_7')
add_single('street_lamp', 'Farol', ['lamppost', 'street_lamp_l', 'street_lamp_r'], '3_City_Props', 'City_Props_16x16_Street_Lamp_5')
add_single('mailbox', 'Buzón', ['mailbox'], '3_City_Props', 'City_Props_16x16_Mailbox_1')
add_single('pot_pink', 'Maceta con flores rosas', ['pot_rose'], '17_Garden', 'Garden_16x16_Big_Pink_Flower_Vase')
add_single('pot_topiary', 'Maceta con arbusto', ['pot_cream'], '17_Garden', 'Garden_16x16_Bush_Potted_3')
add_single('planter_pink', 'Cantero rosa', ['planter_pink'], '3_City_Props', 'City_Props_16x16_Flower_Bush_1')
add_single('planter_red', 'Cantero rojo', ['planter_red'], '3_City_Props', 'City_Props_16x16_Flower_Bush_2')
add_single('planter_white', 'Cantero blanco', ['planter_white'], '3_City_Props', 'City_Props_16x16_Flower_Bush_3')
add_single('pigeon', 'Paloma', ['pigeon'], '3_City_Props', 'City_Props_16x16_Pigeon_1')
add_single('pigeon_peck', 'Paloma picoteando', ['pigeon_peck'], '3_City_Props', 'City_Props_16x16_Pigeon_2')

# Harbour and market: cargo, carts and gulls on the wharf (wharf_* may stand on decks and paths, see villageWorld).
add_single('wharf_barrel', 'Barril del muelle', ['wharf_barrel'], '3_City_Props', 'City_Props_16x16_Brown_Barrel_2')
add_single('wharf_boxes', 'Pila de cajas', ['wharf_boxes'], '6_Garage_Sales', 'Garage_Sales_16x16_Box_9')
add_single('wharf_box', 'Caja', ['wharf_box'], '6_Garage_Sales', 'Garage_Sales_16x16_Box_2')
add_single('wharf_flower_cart', 'Carro de flores', ['wharf_flower_cart'], '17_Garden', 'Garden_16x16_Big_Wood_Cart_Full_1')
add_single('wharf_flower_box', 'Cajón con flores', ['wharf_flower_box'], '17_Garden', 'Garden_16x16_Wood_Box_Full_2')
add_single('wharf_candy_cart', 'Carrito de golosinas', ['wharf_candy_cart'], '3_City_Props', 'City_Props_16x16_Candies_Cart_1')
add_single('lighthouse', 'Faro', ['lighthouse_tall'], '21_Beach', '21_Beach_16x16_Example_Lighthouse')
add_single('gull_left', 'Gaviota mirando a la izquierda', ['gull_left'], '21_Beach', '21_Beach_16x16_Seagull_Left')
add_single('gull_right', 'Gaviota mirando a la derecha', ['gull_right'], '21_Beach', '21_Beach_16x16_Seagull_Right')

# Station platform: a long bench, luggage, a trolley and potted trees.
add_single('station_bench', 'Banco del andén', ['station_bench'], '20_Subway_and_Train_Station', 'Subway_and_Train_Station_16x16_Three_Seats_Grey_Bench_Frontal_1')
add_single('station_suitcase', 'Valija', ['station_suitcase'], '20_Subway_and_Train_Station', 'Subway_and_Train_Station_16x16_Travel_Case_1')
add_single('station_baggage', 'Bolso de viaje', ['station_baggage'], '20_Subway_and_Train_Station', 'Subway_and_Train_Station_16x16_Brown_Baggage_3')
add_single('station_trolley', 'Carro de equipaje', ['station_trolley'], '20_Subway_and_Train_Station', 'Subway_and_Train_Station_16x16_Yellow_Trolley_1')
add_single('station_plant', 'Maceta del andén', ['station_plant'], '20_Subway_and_Train_Station', 'Subway_and_Train_Station_16x16_Plant_Vase_2')

# Garden and residential yards: a statue by the pond, bird houses, a planter bench, a cart, a watering can, street bins.
add_single('garden_statue', 'Estatua del estanque', ['garden_statue'], '17_Garden', 'Garden_16x16_Statue_Putto_1')
add_single('birdhouse_pink', 'Casita de pájaros rosa', ['birdhouse_pink'], '17_Garden', 'Garden_16x16_Pink_Big_Bird_House')
add_single('birdhouse_blue', 'Casita de pájaros celeste', ['birdhouse_blue'], '17_Garden', 'Garden_16x16_Blue_Big_Bird_House')
add_single('birdhouse_brown', 'Casita de pájaros marrón', ['birdhouse_brown'], '17_Garden', 'Garden_16x16_Brown_Big_Bird_House')
add_single('garden_flower_bench', 'Banco con macetas', ['garden_flower_bench'], '17_Garden', 'Garden_16x16_Flowers_Bench_Horizontal')
add_single('garden_cart', 'Carrito con flores', ['garden_cart'], '17_Garden', 'Garden_16x16_Small_Wood_Cart_Full_1')
add_single('watering_can', 'Regadera', ['watering_can'], '17_Garden', 'Garden_16x16_Green_Watering_Can_Left_Full')
add_single('street_bin', 'Tacho de basura', ['street_bin'], '3_City_Props', 'City_Props_16x16_Small_Closed_Trash_Can')

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
    image = sheet(p['sheet']).crop((sx, sy, sx + sw, sy + shh))
    # sandcastles are made of the beach's own sand: the same muted cream, keeping their shading
    atlas.paste(sand_tone(image) if p['id'].startswith('lx_sandcastle') else image, (ax, ay))
    out_pieces.append(dict(p, atlas=dict(x=ax, y=ay, w=sw, h=shh)))

DEST.mkdir(parents=True, exist_ok=True)
atlas.save(DEST / 'exteriors.png', optimize=True)
(DEST / 'exteriors.json').write_text(json.dumps(dict(source='LimeZu Modern Exteriors 16x16',
    sandPalette=[dict(original=list(k), adapted=list(v)) for k, v in SAND_PALETTE.items()],
    tiles=out_tiles, pieces=out_pieces), indent=1, ensure_ascii=False) + '\n', encoding='utf-8')
print(f'{len(out_tiles)} tiles, {len(out_pieces)} pieces -> {W}x{H}')
