"""Curate LimeZu "Modern Interiors" pieces into one small runtime atlas (requires Pillow).

The pack itself is NOT in the repository (its license forbids redistributing it). Point LIMEZU_SRC at a folder with the
theme sheets, either the native 16x16 ones or the RPG Maker MV 48x48 ones (those are exact 3x enlargements and are reduced
back to 16x16 with nearest neighbour, so no pixel is invented or blurred):

    LIMEZU_SRC=/path/to/Theme_Sorter python3 scripts/build-limezu-assets.py

Source rectangles are explicit (16x16 coordinates); never slice a sheet into arbitrary tiles. No recolouring.
Every piece names the furniture IDs of the game it dresses (`replaces`); saved IDs, footprints and behaviour stay the same.
"""
import json
import os
import sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'src/assets/limezu'
SRC = Path(os.environ.get('LIMEZU_SRC', ''))
if not SRC.is_dir():
    sys.exit('LIMEZU_SRC must point at the folder with the Modern Interiors theme sheets')

_sheets = {}


def sheet(stem):
    """The theme sheet at 16x16, whatever resolution it was shipped in."""
    if stem not in _sheets:
        match = sorted(p for p in SRC.rglob('*.png') if p.stem == stem or p.stem.startswith(stem + '_16'))
        if not match:
            sys.exit(f'missing sheet {stem} in {SRC}')
        im = Image.open(match[0]).convert('RGBA')
        k = im.width // 256  # the theme sheets are 16 tiles wide
        if k > 1:
            im = im.resize((im.width // k, im.height // k), Image.NEAREST)
        _sheets[stem] = im
    return _sheets[stem]


JP1, JP2, GEN, LIV, LIB = 'Japanese_Interiors_01', 'Japanese_Interiors_02', 'Generic_01', 'Living_Room_01', 'Classroom_and_Library_01'
pieces = []


def add(key, name, replaces, frames):
    """frames: one (sheet, (x, y, w, h)) per rotation, in the game's order (0 down, 1 right, 2 up, 3 left)."""
    pieces.append(dict(id='lz_' + key, name=name, replaces=replaces, frames=[dict(sheet=s, rect=list(r)) for s, r in frames]))


# Restaurant dining room: izakaya box chairs (front, side, back, side), tables, cushions.
for key, name, ids, front, back, pair in [
    ('chair_slate', 'Silla de izakaya gris', ['chair_dark'], (66, 38, 13, 17), (82, 43, 13, 12), (67, 71, 26, 16)),
    ('chair_moss', 'Silla de izakaya verde', ['chair_wood'], (2, 70, 13, 17), (18, 75, 13, 12), (3, 103, 26, 16)),
    ('chair_straw', 'Silla de izakaya de paja', ['chair_rose', 'chair_sage'], (66, 102, 13, 17), (82, 107, 13, 12), (67, 135, 26, 16)),
]:
    x, y, w, h = pair
    add(key, name, ids, [(JP2, front), (JP2, (x, y, w // 2, h)), (JP2, back), (JP2, (x + w // 2, y, w - w // 2, h))])
add('table_long', 'Mesa larga de madera', ['table_long', 'table_wood', 'table_dark', 'table_pink', 'bond_table_four'], [(GEN, (85, 72, 38, 21))])
add('table_round', 'Mesita redonda', ['table_round'], [(GEN, (81, 49, 14, 14))])
add('table_family', 'Mesa familiar', ['table_family'], [(GEN, (13, 81, 38, 37))])
add('chabudai', 'Chabudai con té', ['table_low'], [(JP1, (81, 41, 30, 14))])
add('stool', 'Banquito', ['stool'], [(GEN, (73, 233, 14, 14))])
add('zabuton_sand', 'Zabuton arena', ['cushion_rose'], [(JP1, (145, 154, 13, 12))])
add('zabuton_sky', 'Zabuton celeste', ['cushion_indigo'], [(JP1, (129, 154, 13, 12))])
add('zabuton_moss', 'Zabuton verde', ['bond_nap_cushion'], [(JP1, (161, 154, 13, 12))])
add('tea_tray', 'Bandeja de té', ['tea_set'], [(JP1, (57, 53, 13, 9))])

# Rooms and houses: storage, desks, lamps, plants, paintings.
add('wardrobe_oak', 'Ropero de roble', ['wardrobe_wood'], [(LIV, (130, 4, 27, 39))])
add('wardrobe_glass', 'Ropero con vidrios', ['wardrobe_white'], [(LIV, (195, 9, 27, 32))])
add('sideboard', 'Aparador', ['shelf_kitchen'], [(LIV, (224, 153, 32, 21))])
add('desk', 'Escritorio con libros', ['desk_wood', 'desk_dark'], [(LIV, (196, 164, 25, 26))])
add('cabinet', 'Mesita de luz', ['chest_wood'], [(LIV, (144, 169, 16, 20))])
add('lamp_cream', 'Lámpara de pie crema', ['lamp_cream'], [(LIV, (129, 104, 13, 33))])
add('lamp_red', 'Lámpara de pie roja', ['lamp_rose'], [(LIV, (176, 200, 15, 33))])
add('lamp_blue', 'Lámpara de pie azul', ['bond_reading_lamp'], [(LIV, (128, 152, 15, 33))])
add('lamp_bedside', 'Velador', ['lamp_table'], [(LIV, (194, 234, 12, 16))])
add('plant_small', 'Planta chica', ['plant_fern', 'plant_herbs'], [(LIV, (2, 86, 12, 14))])
add('palm', 'Palmera en maceta', ['plant_monstera'], [(LIV, (197, 48, 23, 31))])
add('fishbowl', 'Pecera', ['aquarium'], [(LIV, (33, 186, 15, 16))])
add('painting_hills', 'Cuadro de colinas', ['pt_landscape'], [(GEN, (82, 11, 28, 13))])
add('painting_sunset', 'Cuadro de atardecer', ['pt_stars'], [(GEN, (50, 11, 28, 13))])
add('painting_fish', 'Cuadro del pez', ['pt_sushi', 'bond_plate_frame'], [(LIV, (2, 218, 13, 15))])
add('painting_sakura', 'Kakejiku de sakura', ['pt_raccoon', 'errand_thanks'], [(JP2, (2, 39, 12, 17))])

# Library and bookcases.
add('bookcase_tall', 'Biblioteca alta', ['library_shelf'], [(LIB, (130, 219, 27, 31))])
add('bookcase', 'Biblioteca', ['shelf_books'], [(LIB, (130, 219, 27, 31))])
add('bookcase_dark', 'Biblioteca de colores', ['shelf_dark'], [(LIB, (9, 183, 28, 25))])
add('reading_desk', 'Mesa de lectura', ['library_table'], [(LIB, (9, 154, 28, 22))])

# Floors: each decor floor style takes a 2x2 block (32x32). Room Builder floors repeat their seamless middle column
# (its first column carries edge shading); the tatami mat from the Japanese theme is tiled as a whole 2x2 block. Keys are the game's FLOOR_STYLES (art/tiles.ts), so saved choices keep working.
RB = 'Room_Builder_Floors'
FLOORS = {
    'wood': (RB, 64, 192), 'darkwood': (RB, 192, 416), 'tatami': (JP1, 0, 0), 'izakaya': (RB, 0, 192),
    'checker': (RB, 64, 32), 'rose': (RB, 128, 128), 'lavcarpet': (RB, 128, 288), 'moss': (RB, 0, 224),
    'night': (RB, 128, 320), 'stone': (RB, 128, 544),
}
floors = {}

# Pack: shelf packing, 1px gap so no neighbour bleeds into a frame.
crops = []
for p in pieces:
    for f in p['frames']:
        x, y, w, h = f['rect']
        crops.append((f, sheet(f['sheet']).crop((x, y, x + w, y + h))))
for key, (sh, fx, fy) in FLOORS.items():
    floors[key] = dict(sheet=sh, rect=[fx, fy, 32, 32], whole=sh != RB)
    crops.append((floors[key], sheet(sh).crop((fx, fy, fx + 32, fy + 32))))
W = 256
x = y = row = 0
for f, im in sorted(crops, key=lambda c: -c[1].height):
    if x + im.width + 1 > W:
        x, y, row = 0, y + row + 1, 0
    f['atlas'] = dict(x=x + 1, y=y + 1, w=im.width, h=im.height)
    x += im.width + 1
    row = max(row, im.height + 1)
H = y + row + 1
atlas = Image.new('RGBA', (W, H))
for f, im in crops:
    atlas.paste(im, (f['atlas']['x'], f['atlas']['y']))
DEST.mkdir(parents=True, exist_ok=True)
atlas.save(DEST / 'atlas.png', optimize=True)
catalog = dict(
    author='LimeZu', pack='Modern Interiors (full version)', url='https://limezu.itch.io/moderninteriors',
    license='Use in commercial and non-commercial projects allowed; redistribution of the asset is not. Credits required.',
    width=W, height=H, pieces=pieces, floors=floors,
)
(DEST / 'catalog.json').write_text(json.dumps(catalog, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
print(f'{len(pieces)} pieces, {len(crops)} frames, atlas {W}x{H}')
