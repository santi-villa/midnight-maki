"""Native Serene Village cliff crops shared by the approved village and its map study."""
import hashlib
import json
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1]
source = root / 'ASSETS DESCARGADOS/NUEVO/Serene Village/SERENE_VILLAGE_REVAMPED/Serene_Village_16x16.png'
out = root / 'src/assets/map-study'
sheet = Image.open(source).convert('RGBA')
palette = {tuple(p['original']): tuple(p['adapted']) for p in json.loads((root / 'src/assets/serene/catalog.json').read_text(encoding='utf-8'))['palette']}
atlas = Image.new('RGBA', (32, 16))
for variant in range(2):
    image = sheet.crop((16, 160, 32, 176))
    pixels = image.load()
    for y in range(16):
        for x in range(16):
            r, g, b, a = pixels[x, y]
            green = g > r * 1.05 and g > b * 1.15
            rgb = (139, 120, 101) if variant and green else palette.get((r, g, b), (r, g, b))
            pixels[x, y] = (*rgb, a)
    atlas.alpha_composite(image, (variant * 16, 0))
out.mkdir(parents=True, exist_ok=True)
atlas.save(out / 'cliffs.png', optimize=True)
(out / 'credits.json').write_text(json.dumps(dict(
    author='LimeZu', pack='Serene Village revamped v1.9',
    source='https://limezu.itch.io/serenevillagerevamped',
    license='https://creativecommons.org/licenses/by/4.0/',
    sourceSha256=hashlib.sha256(source.read_bytes()).hexdigest(), rect=[16, 160, 16, 16],
    changes='Native cliff crop; green palette matched to Villa Nori; second variant replaces grass cap with stone for tall faces.',
), ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(f'Village native cliff atlas: {(out / "cliffs.png").stat().st_size} bytes')
