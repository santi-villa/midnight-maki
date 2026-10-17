"""Add the demo's small outdoor accessories to free space in the existing cozy atlas."""
from pathlib import Path
from zipfile import ZipFile
from io import BytesIO
from PIL import Image
import hashlib
import json
import re

root = Path(__file__).resolve().parents[1]
name = 'vectoraith_tileset_16x16_buildings_japanese_traditional_demo.png'
with ZipFile(root / 'ASSETS DESCARGADOS/vectoraith_tileset_buildings_japanese_traditional_DEMO.zip') as archive:
    raw = archive.read(name)
source = Image.open(BytesIO(raw)).convert('RGBA')
atlas_path = root / 'src/assets/cozy-town/atlas.png'
atlas = Image.open(atlas_path).convert('RGBA')
frames_path = root / 'src/art/cozyFrames.ts'
frames = json.loads(re.search(r'export const COZY_FRAMES = (\{.*\}) as const;', frames_path.read_text(), re.S)[1])
provenance_path = root / 'src/assets/cozy-town/provenance.json'
provenance = json.loads(provenance_path.read_text())
crops = {
    'villagePine': ([80, 64, 96, 96], [176, 112]),
    'villageMailbox': ([80, 48, 96, 64], [192, 112]),
    'villageNotice': ([64, 16, 80, 32], [208, 112]),
    'villageWoodbox': ([80, 32, 96, 48], [224, 112]),
}
for key, (rect, position) in crops.items():
    image = source.crop(rect)
    atlas.paste(image, position)
    frames[key] = dict(x=position[0], y=position[1], w=image.width, h=image.height)
    provenance = [p for p in provenance if p['frame'] != key]
    provenance.append(dict(frame=key, source=name, crop=rect, sha256=hashlib.sha256(raw).hexdigest(), author='VectoRaith'))
atlas.save(atlas_path, optimize=True)
frames_path.write_text('/** Native crops from the supplied VectoRaith demo and Bitglow pack. See docs/asset-credits.md. */\n'
                       + 'export const COZY_FRAMES = ' + json.dumps(frames, indent=2) + ' as const;\n')
provenance_path.write_text(json.dumps(provenance, indent=2) + '\n')
