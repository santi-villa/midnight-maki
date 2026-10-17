"""Extract the native VectoRaith wooden autotile, including inner/outer corners."""
from pathlib import Path
from io import BytesIO
from zipfile import ZipFile
from PIL import Image
import json
import hashlib

root = Path(__file__).resolve().parents[1]
archive = root / 'ASSETS DESCARGADOS/vectoraith_tileset_buildings_japanese_traditional_DEMO.zip'
name = 'vectoraith_tileset_16x16_terrains_temperate_autotile_rpgmaker.png'
with ZipFile(archive) as z:
    original = z.read(name)
source = Image.open(BytesIO(original)).convert('RGBA')
dest = root / 'src/assets/bridges'
dest.mkdir(parents=True, exist_ok=True)
source.crop((160, 96, 192, 144)).save(dest / 'wood.png', optimize=True)
(dest / 'provenance.json').write_text(json.dumps(dict(author='VectoRaith', archive=archive.name,
    source=name, crop=[160, 96, 32, 48], sha256=hashlib.sha256(original).hexdigest()), indent=2) + '\n')
