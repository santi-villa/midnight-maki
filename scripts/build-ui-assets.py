"""Curate LimeZu "Modern Interiors" UI emotes (animated GIFs at 16x16) into one small strip atlas (requires Pillow).

The pack is NOT in the repository. Point UI_SRC at a folder with the pack's 4_User_Interface_Elements/Animated_Spritesheets
GIFs plus 4_User_Interface_Elements/UI_16x16.png copied next to them (extracted from moderninteriors-win.zip):

    UI_SRC=/path/to/Animated_Spritesheets python3 scripts/build-ui-assets.py

Each emote becomes one row of frames (still bubbles from UI_16x16.png are one-frame rows); the catalog keeps the frame size, count and the GIF's own frame durations.
"""
import json
import os
import sys
from pathlib import Path
from PIL import Image, ImageSequence

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'src/assets/ui'
SRC = Path(os.environ.get('UI_SRC', ''))
EMOTES = {
    'thinking': 'UI_thinking_emote_dots_16x16.gif',
    'angry': 'UI_angry_emote_16x16.gif',
    'tear': 'UI_tear_drop_emote_16x16.gif',
    'mail': 'UI_mail_16x16.gif',
    'arrow': 'UI_arrow_pointing_down_16x16.gif',
}
# still bubbles in UI_16x16.png: (column, row) of 16x32 cells starting at x=64
STILLS = {'heart': (2, 0), 'exclaim': (5, 0), 'alarm': (6, 0), 'sleep': (7, 0), 'music': (8, 0), 'sparkle': (1, 1)}
if not all((SRC / f).is_file() for f in [*EMOTES.values(), 'UI_16x16.png']):
    sys.exit('UI_SRC must point at the Animated_Spritesheets folder of Modern Interiors')

rows = []
for name, file in EMOTES.items():
    gif = Image.open(SRC / file)
    frames, times = [], []
    for fr in ImageSequence.Iterator(gif):
        frames.append(fr.convert('RGBA').copy())
        times.append(fr.info.get('duration', 100))
    rows.append((name, frames, times))
sheet = Image.open(SRC / 'UI_16x16.png').convert('RGBA')
for name, (cx, cy) in STILLS.items():
    rows.append((name, [sheet.crop((64 + 16 * cx, 32 * cy, 80 + 16 * cx, 32 * cy + 32))], [1000]))
W = max(len(f) * f[0].width for _, f, _ in rows)
H = sum(f[0].height for _, f, _ in rows)
atlas = Image.new('RGBA', (W, H))
catalog, y = {}, 0
for name, frames, times in rows:
    w, h = frames[0].size
    for i, fr in enumerate(frames):
        atlas.paste(fr, (i * w, y))
    catalog[name] = dict(y=y, w=w, h=h, frames=len(frames), durations=times)
    y += h
DEST.mkdir(parents=True, exist_ok=True)
atlas.save(DEST / 'emotes.png', optimize=True)
(DEST / 'emotes.json').write_text(json.dumps(dict(source='LimeZu Modern Interiors, 4_User_Interface_Elements', emotes=catalog), indent=1) + '\n', encoding='utf-8')
print({k: (v['w'], v['h'], v['frames']) for k, v in catalog.items()})

# Sprout Lands UI (Cup Nooble, free basic pack: non-commercial, no redistribution): cat-paw cursors and the dialog's
# "click to continue" indicator. Point SPROUT_UI at the pack's "Sprite sheets" folder; skipped when unset.
SPROUT = Path(os.environ.get('SPROUT_UI', ''))
if (SPROUT / 'Mouse sprites').is_dir():
    for name, file in {'paw': 'Catpaw Mouse icon', 'paw_point': 'Catpaw pointing Mouse icon', 'paw_hold': 'Catpaw holding Mouse icon'}.items():
        im = Image.open(SPROUT / 'Mouse sprites' / f'{file}.png').convert('RGBA')
        im.resize((32, 32), Image.NEAREST).save(DEST / f'{name}.png', optimize=True)
    Image.open(SPROUT / 'Dialouge UI' / 'dialog box character finished talking click to continue indicator - spritesheet .png').convert('RGBA').save(DEST / 'dialog_next.png', optimize=True)
    print('sprout lands: cursors + dialog indicator')

# Sprout Lands frames for the HTML menus, cut tight and blown up 3x (nearest) so CSS border-image stays crisp.
if (SPROUT / 'Sprite sheet for Basic Pack.png').is_file():
    basic = Image.open(SPROUT / 'Sprite sheet for Basic Pack.png').convert('RGBA')
    menu = Image.open(SPROUT / 'Setting menu.png').convert('RGBA')
    dlg = Image.open(SPROUT / 'Dialouge UI' / 'dialog box big.png').convert('RGBA')

    def tight(im, box):
        c = im.crop(box)
        return c.crop(c.getbbox())

    FRAMES = {
        'btn': tight(basic, (163, 178, 253, 205)),
        'btn_down': tight(basic, (259, 180, 349, 205)),
        'tile': tight(basic, (11, 59, 37, 87)),
        'tile_on': tight(basic, (11, 107, 37, 135)),
        'tile_dark': tight(basic, (11, 155, 37, 183)),
        'frame': tight(basic, (153, 57, 183, 87)),
        'close': tight(basic, (825, 0, 870, 30)),
        'round': tight(basic, (311, 37, 329, 57)),
        'round_down': tight(basic, (343, 38, 361, 57)),
        'panel': tight(menu, (128, 0, 256, 144)),
        'dialog': tight(dlg, (7, 0, 176, 48)),
    }
    for name, im in FRAMES.items():
        im.resize((im.width * 3, im.height * 3), Image.NEAREST).save(DEST / f'sl_{name}.png', optimize=True)
    print('sprout lands frames:', {k: v.size for k, v in FRAMES.items()})
