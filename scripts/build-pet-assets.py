"""Village pets: a few cats, a sleeping dog, a barking dog and a frog, from Cat Pixel Mega Pack (pack 3) and Animal Mega Pack (pack 2).
Used with the owner's permission (private project). Run: python3 scripts/build-pet-assets.py   (needs Pillow)"""
from pathlib import Path
from PIL import Image
import json

root = Path(__file__).resolve().parents[1]
lib = root / 'ASSETS DESCARGADOS/ORGANIZADO/biblioteca/05_animales'
cats = lib / '03/AllCatsDemo'
dogs = lib / '02/FreeAnimalPack'
dest = root / 'src/assets/pets'
dest.mkdir(parents=True, exist_ok=True)

# name -> (file, frame width, frame height)
sheets = {
    'cat_brown_idle': (cats / 'Brown/IdleCattt.png', 32, 32), 'cat_brown_jump': (cats / 'Brown/JumpCatttt.png', 32, 32),
    'cat_white_idle': (cats / 'White/IdleCatttt.png', 32, 32), 'cat_white_jump': (cats / 'White/JumpCattttt.png', 32, 32),
    'cat_siamese_idle': (cats / 'Siamese/IdleCattt.png', 32, 32), 'cat_siamese_jump': (cats / 'Siamese/JumpCatttt.png', 32, 32),
    'frog_idle': (dogs / 'FrogIdle.png', 32, 32),
    'dog_sleep': (dogs / 'SleepDog.png', 64, 64), 'dog_golden': (dogs / 'GoldenBarking.png', 64, 64),
}
images = {n: Image.open(f).convert('RGBA') for n, (f, _, _) in sheets.items()}
W = max(im.width for im in images.values())
H = sum(im.height for im in images.values())
atlas = Image.new('RGBA', (W, H), (0, 0, 0, 0))
meta, y = {}, 0
for n, im in images.items():
    atlas.paste(im, (0, y))
    fw, fh = sheets[n][1], sheets[n][2]
    meta[n] = dict(y=y, w=fw, h=fh, frames=im.width // fw)
    y += im.height
atlas.save(dest / 'pets.png', optimize=True)
(dest / 'pets.json').write_text(json.dumps(meta, indent=1) + '\n')
print(len(meta), 'sheets', atlas.size)
