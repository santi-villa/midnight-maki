"""Resize scripts/icon-master.png into the shortcut and Android launcher icons.

The 32px tab icon is drawn by hand (public/icons/favicon-32.png) so it stays
readable. This script does not replace it.
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
MASTER = ROOT / "scripts" / "icon-master.png"
NAVY = (18, 30, 56)


def full(master: Image.Image, size: int) -> Image.Image:
    return master.resize((size, size), Image.Resampling.LANCZOS)


def maskable(master: Image.Image, size: int) -> Image.Image:
    canvas = Image.new("RGB", (size, size), NAVY)
    inner = int(round(size * 0.80))
    art = master.resize((inner, inner), Image.Resampling.LANCZOS)
    canvas.paste(art, ((size - inner) // 2, (size - inner) // 2))
    return canvas


def main() -> None:
    master = Image.open(MASTER).convert("RGB")
    icons = ROOT / "public" / "icons"
    icons.mkdir(parents=True, exist_ok=True)
    full(master, 180).save(icons / "icon-180.png", optimize=True)
    full(master, 192).save(icons / "icon-192.png", optimize=True)
    full(master, 512).save(icons / "icon-512.png", optimize=True)
    maskable(master, 192).save(icons / "icon-maskable-192.png", optimize=True)
    maskable(master, 512).save(icons / "icon-maskable-512.png", optimize=True)
    res = ROOT / "android" / "app" / "src" / "main" / "res"
    if res.exists():
        densities = {"mdpi": (48, 108), "hdpi": (72, 162), "xhdpi": (96, 216), "xxhdpi": (144, 324), "xxxhdpi": (192, 432)}
        for name, (size, foreground) in densities.items():
            folder = res / f"mipmap-{name}"
            folder.mkdir(parents=True, exist_ok=True)
            full(master, size).save(folder / "ic_launcher.png", optimize=True)
            full(master, size).save(folder / "ic_launcher_round.png", optimize=True)
            maskable(master, foreground).save(folder / "ic_launcher_foreground.png", optimize=True)
    print("shortcut icons resized")


if __name__ == "__main__":
    main()
