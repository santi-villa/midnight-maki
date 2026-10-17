"""Curate native Bitglow interior sprites into one runtime atlas (requires Pillow).

Run from any directory: python3 scripts/build-interior-assets.py
Source coordinates are explicit: never slice an entire sheet into arbitrary tiles.
No recolouring or scaling; original licenses stay beside the atlas.
"""
import json
import math
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'ASSETS DESCARGADOS/ORGANIZADO/biblioteca/02_interiores'
DEST = ROOT / 'src/assets/interiors'
SHEETS = {
    'beds': '20/beds_BR.png', 'wardrobes': '20/wardrobes_BR.png',
    'bedroom': '20/decorations_BR.png', 'living': '21/livingroom_LRK.png',
    'decor': '21/decorations_LRK.png', 'shelves': '21/cabinets_LRK.png',
    'kitchen': '21/kitchen_LRK.png', 'bath': '19/fixtures_BA.png',
    'bathstore': '19/cabinets_BA.png', 'textiles': '19/textiles_BA.png',
}
pieces = []


def add(key, name, cat, kind, price, sheet, rect, *, w=None, h=1, style='cozy', **extra):
    width, height = rect[2:]
    piece = dict(id='interior_' + key, name=name, cat=cat, kind=kind, price=price,
                 style=style, w=w or math.ceil(width / 16), h=h, sh=max(height, h * 16),
                 frames=[dict(sheet=SHEETS[sheet], rect=list(rect))], **extra)
    pieces.append(piece)
    return piece


# Bedroom: all ten complete beds, closed/open wardrobes, drawers and vanities.
for row, color in enumerate(['terracota', 'oliva', 'celeste']):
    for col, (x, width, label) in enumerate([(16, 32, 'individual'), (64, 48, 'doble')]):
        add(f'bed_{color}_{col}', f'Cama {label} {color}', 'bedroom', 'bed', 280 + col * 120,
            'beds', (x, 24 + row * 80, width, 56), h=3)
for row in range(2):
    for x, width, label in [(128, 32, 'individual'), (176, 48, 'doble')]:
        add(f'bed_white_{row}_{width}', f'Cama {label} blanca · modelo {row + 1}',
            'bedroom', 'bed', 300 if width == 32 else 420,
            'beds', (x, 24 + row * 80, width, 56), h=3, style='minimal')
add('futon_rose', 'Futón de tela terracota', 'bedroom', 'futon', 200, 'beds', (16, 38, 32, 40), h=2, walkable=True, style='japanese')
add('futon_blue', 'Futón de tela celeste', 'bedroom', 'futon', 200, 'beds', (16, 198, 32, 40), h=2, walkable=True, style='japanese')
for row, color in enumerate(['nogal', 'madera', 'blanco']):
    for opened, x, width in [(False, 16, 48), (True, 80, 64)]:
        add(f'wardrobe_{row}_{int(opened)}', f'Ropero {color}' + (' abierto' if opened else ''),
            'bedroom', 'wardrobe', 320, 'wardrobes', (x, 32 + row * 80, width, 66 if opened else 64), h=2)
    for col, x in enumerate([208, 272]):
        for model, y in enumerate([24, 72]):
            add(f'dresser_{row}_{col}_{model}', f'Cómoda {color} · modelo {col * 2 + model + 1}',
                'bedroom', 'chest', 160, 'wardrobes', (x, y + row * 96, 48, 40))
    for model, rect in enumerate([(160, 20 + row * 96, 16, 20), (177, 20 + row * 96, 14, 20),
                                  (160, 52 + row * 96, 32, 20), (160, 84 + row * 96, 32, 20)]):
        add(f'nightstand_{row}_{model}', f'Mesita de luz {color} · modelo {model + 1}',
            'bedroom', 'chest', 70, 'wardrobes', rect)
    add(f'vanity_{row}', f'Tocador {color}', 'bedroom', 'desk', 220,
        'wardrobes', (16 + row * 48, 304, 32, 44))
add('bed_bench', 'Banquito al pie de cama', 'bedroom', 'bench', 80, 'wardrobes', (24, 280, 32, 16))
add('bed_rug_oval', 'Alfombra ovalada crema', 'rug', 'rug', 120, 'bedroom', (16, 128, 64, 48), h=3, walkable=True)
add('bed_rug_blue', 'Alfombra azul tejida', 'rug', 'rug', 140, 'bedroom', (94, 128, 68, 48), h=3, walkable=True)
add('bed_landscape', 'Cuadro del amanecer', 'wall', 'painting', 100, 'bedroom', (132, 19, 40, 26), wall=True)
add('bed_clock', 'Reloj pequeño de pared', 'wall', 'clock', 65, 'bedroom', (98, 29, 12, 12), wall=True)
for i, rect in enumerate([(98, 53, 12, 19), (114, 53, 12, 19), (131, 57, 10, 15)]):
    add(f'bed_lamp_{i}', ['Velador crema', 'Velador rosa', 'Velador pequeño'][i],
        'light', 'tablelamp', 65, 'bedroom', rect, light='#f4d68c')
add('bed_candles', 'Velas del dormitorio', 'light', 'candles', 50, 'bedroom', (145, 55, 16, 17), light='#f4c070')
add('bed_fairy_lights', 'Guirnalda cálida', 'wall', 'garland', 95, 'bedroom', (96, 80, 44, 28), wall=True, light='#f4d68c')
for i, x in enumerate([142, 160]):
    add(f'bed_mirror_{i}', ['Espejo ovalado dorado', 'Espejo ovalado blanco'][i],
        'wall', 'painting', 85, 'bedroom', (x, 80, 16, 32), wall=True)

# Living room: complete orientations belong to one item, not four duplicate purchases.
for row, color in enumerate(['crema', 'gris']):
    y = row * 64
    sofa = add(f'sofa_{row}', f'Sofá {color}', 'bedroom', 'bench', 260,
               'living', (16, 32 + y, 48, 32), h=2, rotatable=True)
    sofa['frames'] += [dict(sheet=SHEETS['living'], rect=r) for r in
                       [[192, 16 + y, 32, 48], [80, 32 + y, 48, 32], [144, 16 + y, 32, 48]]]
    sofa['sh'] = 48
    chair = add(f'armchair_{row}', f'Sillón {color}', 'bedroom', 'bench', 170,
                'living', (240, 32 + y, 32, 32), h=2, rotatable=True)
    chair['frames'] += [dict(sheet=SHEETS['living'], rect=r) for r in
                        [[384, 32 + y, 32, 33], [288, 32 + y, 32, 32], [336, 32 + y, 32, 33]]]
    chair['sh'] = 33
    for model, rect in enumerate([(432, 16 + y, 32, 48), (480, 16 + y, 32, 48),
                                  (528, 16 + y, 32, 48), (576, 16 + y, 32, 48)]):
        # The fire is part of the original static art, not a new gameplay system.
        add(f'fireplace_{row}_{model}', f'Chimenea {color}' + (' encendida' if model % 2 else '') + f' · {model // 2 + 1}',
            'special', 'stove', 280, 'living', rect, **({'light': '#f4b070'} if model % 2 else {}))
for label, x, basey, round_table, color in [('oak', 16, 160, False, 'roble'), ('walnut', 288, 160, False, 'nogal'),
                                          ('white_round', 16, 208, True, 'blanca'), ('brown_round', 224, 208, True, 'marrón')]:
    table = add(f'table_{label}', f'Mesa {"redonda " if round_table else "de "}{color}', 'restaurant',
        'roundtable' if round_table else 'table', 120 if round_table else 180, 'living',
        (x, basey, 32 if round_table else 48, 32), h=2)
    if not round_table:
        side = [80 if label == 'oak' else 352, 144, 32, 48]
        front = table['frames'][0].copy()
        table['frames'] += [dict(sheet=SHEETS['living'], rect=side), front, dict(sheet=SHEETS['living'], rect=side)]
        table['rotatable'] = True
        table['sh'] = 48
for name, x, y in [('oak', 128, 144), ('walnut', 416, 144), ('white', 64, 208), ('brown', 272, 208)]:
    chair = add(f'chair_{name}', 'Silla ' + {'oak': 'roble', 'walnut': 'nogal', 'white': 'blanca', 'brown': 'marrón'}[name],
                'restaurant', 'chair', 65, 'living', (x, y, 16, 32), rotatable=True, sit=True)
    chair['frames'] += [dict(sheet=SHEETS['living'], rect=r) for r in
                        [[x + 72, y, 16, 32], [x + 24, y, 16, 32], [x + 48, y, 16, 32]]]
for i, rect in enumerate([(16, 256, 64, 32), (96, 256, 32, 64), (144, 256, 64, 32), (224, 256, 32, 64),
                          (272, 256, 16, 64), (304, 256, 16, 64), (336, 256, 64, 16), (336, 288, 64, 16),
                          (416, 256, 48, 32), (464, 288, 32, 32), (416, 320, 48, 32), (464, 352, 32, 32),
                          (16, 336, 64, 32), (96, 336, 32, 64), (144, 336, 64, 32), (224, 336, 32, 64)]):
    add(f'living_rug_{i}', f'Alfombra de salón · diseño {i + 1}', 'rug', 'rug', 90 + i % 4 * 15,
        'living', rect, h=math.ceil(rect[3] / 16), walkable=True)
for i, rect in enumerate([(312, 350, 32, 6), (358, 342, 36, 20), (312, 382, 32, 6), (358, 374, 36, 20)]):
    add(f'wall_shelf_{i}', ['Estante blanco', 'Pantalla de pared', 'Estante negro', 'Pantalla azul'][i],
        'wall', 'painting', 90, 'living', rect, wall=True)

# Lamps, flowers and small decorations.
for i, x in enumerate([16, 48, 80]):
    add(f'floor_lamp_{i}', ['Lámpara trípode', 'Lámpara de pie crema', 'Lámpara de pie redonda'][i],
        'light', 'floorlamp', 130, 'decor', (x, 15, 16, 48), light='#f4d68c')
for i, x in enumerate([120, 152]):
    add(f'table_lamp_{i}', ['Lámpara de mesa redonda', 'Lámpara de mesa crema'][i],
        'light', 'tablelamp', 75, 'decor', (x, 22, 16, 25), light='#f4d68c')
for i, rect in enumerate([(16, 80, 16, 32), (48, 80, 16, 32), (80, 80, 16, 32),
                          (16, 128, 16, 16), (48, 120, 16, 24), (64, 120, 16, 24), (80, 120, 16, 24)]):
    add(f'plant_{i}', ['Monstera de interior', 'Maceta de hojas finas', 'Arbusto redondo', 'Jarrón con flores',
                      'Jarrón alto crema', 'Jarrón fino', 'Florero pequeño'][i],
        'plant', 'plant' if i < 3 else 'vase', 60 + i % 3 * 20, 'decor', rect)
add('wall_art_warm', 'Cuadro de casitas', 'wall', 'painting', 100, 'decor', (112, 64, 32, 16), wall=True)
add('wall_art_blue', 'Cuadro azul', 'wall', 'painting', 100, 'decor', (112, 96, 32, 16), wall=True)
add('grandfather_clock', 'Reloj de péndulo', 'bedroom', 'clock', 200, 'decor', (160, 64, 16, 48))
add('wall_clock', 'Reloj de salón', 'wall', 'clock', 70, 'decor', (160, 128, 16, 16), wall=True)

# Native front-facing bookcases, display cabinets and storage modules, in three woods.
for row, color in enumerate(['miel', 'nogal', 'blanco']):
    y = row * 128
    for model, x in enumerate([16, 80, 208]):
        add(f'bookcase_{row}_{model}', f'Biblioteca {color} · modelo {model + 1}',
            'bedroom', 'shelf', 220, 'shelves', (x, 16 + y, 48, 48), h=2, likes=['rigg'])
    for model, x in enumerate([16, 80, 208]):
        add(f'cabinet_{row}_{model}', f'Aparador {color} · modelo {model + 1}',
            'bedroom', 'wardrobe', 200, 'shelves', (x, 80 + y, 48, 48), h=2)
    add(f'low_shelf_{row}', f'Biblioteca baja {color}', 'bedroom', 'shelf', 150,
        'shelves', (336, 32 + y, 48, 32), likes=['rigg'])
    add(f'wall_cabinet_{row}', f'Alacena {color}', 'wall', 'shelf', 140,
        'shelves', (528, 32 + y, 48, 32), wall=True)
    add(f'writing_desk_{row}', f'Escritorio {color}', 'bedroom', 'desk', 240,
        'shelves', (624, 32 + y, 48, 32), likes=['rigg'])

# Kitchen: appliances and independently usable modules, not entire sample rooms.
for row, color in enumerate(['crema', 'oliva', 'blanco']):
    y = row * 128
    add(f'kitchen_sink_{row}', f'Mueble con pileta {color}', 'kitchen', 'sink', 180,
        'kitchen', (48, 16 + y, 64, 48), h=2)
    add(f'kitchen_counter_{row}', f'Mesada {color}', 'kitchen', 'wardrobe', 120,
        'kitchen', (48, 80 + y, 64, 48), h=2)
    for lit, x in [(False, 192), (True, 240)]:
        add(f'oven_{row}_{int(lit)}', f'Horno {color}' + (' encendido' if lit else ''),
            'kitchen', 'stove', 210, 'kitchen', (x, 80 + y, 32, 48), h=2)
    add(f'fridge_{row}', f'Heladera {color}', 'kitchen', 'fridge', 260,
        'kitchen', (352, 16 + y, 32 if row < 2 else 48, 64), h=2)

# Bathroom: complete fixtures, cabinets, mats and curtains.
for filled, y in [(False, 16), (True, 64)]:
    add(f'bathtub_{int(filled)}', 'Bañera' + (' con agua' if filled else ' vacía'),
        'bath', 'sink', 240, 'bath', (14, y, 66, 32), h=2)
    add(f'washbasin_{int(filled)}', 'Lavamanos' + (' azul' if filled else ' blanco'),
        'bath', 'sink', 110, 'bath', (104, y - 3, 34, 24))
add('toilet', 'Inodoro blanco', 'bath', 'stool', 120, 'bath', (164, 16, 24, 44), h=2)
for row, color in enumerate(['madera', 'nogal', 'blanco']):
    add(f'bath_drawer_{row}', f'Mueble de baño {color}', 'bath', 'chest', 95,
        'bathstore', (16, 12 + row * 32, 32, 20))
    add(f'bath_cabinet_{row}', f'Armario de baño {color}', 'bath', 'wardrobe', 140,
        'bathstore', (64 + row * 32, 16, 16, 48))
for i, rect in enumerate([(16, 32, 32, 16), (64, 24, 32, 24), (16, 64, 64, 32),
                          (112, 32, 32, 16), (160, 24, 32, 24), (112, 64, 64, 32),
                          (208, 32, 32, 16), (256, 24, 32, 24), (208, 64, 64, 32)]):
    add(f'bath_mat_{i}', f'Alfombra de baño · diseño {i + 1}', 'rug', 'rug', 55,
        'textiles', rect, h=math.ceil(rect[3] / 16), walkable=True)
for i, x in enumerate([24, 72, 120]):
    add(f'bath_curtain_{i}', ['Cortina crema', 'Cortina rosa', 'Cortina celeste'][i],
        'wall', 'painting', 80, 'textiles', (x, 112, 40, 48), wall=True)


def main():
    DEST.mkdir(parents=True, exist_ok=True)
    atlas = Image.new('RGBA', (1024, 1024))
    x, y, row_h = 1, 1, 0
    seen = set()
    for piece in pieces:
        assert piece['id'] not in seen, piece['id']
        seen.add(piece['id'])
        for frame in piece['frames']:
            image = Image.open(SOURCE / frame['sheet']).convert('RGBA')
            sx, sy, w, h = frame['rect']
            assert sx >= 0 and sy >= 0 and sx + w <= image.width and sy + h <= image.height, frame
            crop = image.crop((sx, sy, sx + w, sy + h))
            assert crop.getbbox() is not None, frame
            if x + w + 1 > atlas.width:
                x, y, row_h = 1, y + row_h + 2, 0
            assert y + h + 1 <= atlas.height
            atlas.paste(crop, (x, y))
            frame['atlas'] = dict(x=x, y=y, w=w, h=h)
            x += w + 2
            row_h = max(row_h, h)
    # Power-of-two height: the GPU uploads only the part actually used.
    height = 2 ** math.ceil(math.log2(y + row_h + 1))
    atlas = atlas.crop((0, 0, 1024, height))
    atlas.save(DEST / 'atlas.png', optimize=True)
    catalog = dict(author='Bitglow', packs=[19, 20, 21], width=atlas.width, height=atlas.height, pieces=pieces)
    (DEST / 'catalog.json').write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + '\n')
    (DEST / 'Bitglow-license.txt').write_bytes((SOURCE / '20/license.txt').read_bytes())
    print(f'{len(pieces)} items, {sum(len(p["frames"]) for p in pieces)} frames, {atlas.width}x{atlas.height} atlas')


if __name__ == '__main__':
    main()
