#!/usr/bin/env python3
"""Generate crisp dock icons and UI logos from assets/logo-source.png."""

from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "desktop" / "public" / "assets" / "logo-source.png"
ICONS = ROOT / "src-tauri" / "icons"
PUBLIC = ROOT / "desktop" / "public"
OUT = ROOT / "desktop" / "out"


def lanczos(img: Image.Image, size: int) -> Image.Image:
    if img.mode != "RGBA":
        img = img.convert("RGBA")
    return img.resize((size, size), Image.Resampling.LANCZOS)


def crop_mark(img: Image.Image) -> Image.Image:
    """Shield-focused crop for small sidebar / menu sizes."""
    w, h = img.size
    side = int(min(w, h) * 0.58)
    left = (w - side) // 2
    top = int(h * 0.06)
    return img.crop((left, top, left + side, top + side))


def save_png(path: Path, img: Image.Image) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, format="PNG", optimize=True)


def build_icns(icon_1024: Path, dest: Path) -> None:
    iconset = dest.with_suffix(".iconset")
    if iconset.exists():
        shutil.rmtree(iconset)
    iconset.mkdir()

    master = Image.open(icon_1024).convert("RGBA")
    pairs = [
        ("icon_16x16.png", 16),
        ("icon_16x16@2x.png", 32),
        ("icon_32x32.png", 32),
        ("icon_32x32@2x.png", 64),
        ("icon_128x128.png", 128),
        ("icon_128x128@2x.png", 256),
        ("icon_256x256.png", 256),
        ("icon_256x256@2x.png", 512),
        ("icon_512x512.png", 512),
        ("icon_512x512@2x.png", 1024),
    ]
    for name, dim in pairs:
        save_png(iconset / name, lanczos(master, dim))

    subprocess.run(["iconutil", "-c", "icns", str(iconset), "-o", str(dest)], check=True)
    shutil.rmtree(iconset)


def main() -> None:
    if not SRC.exists():
        raise SystemExit(f"Missing source logo: {SRC}")

    source = Image.open(SRC).convert("RGBA")
    mark = crop_mark(source)

    # Upscale master once for dock + retina UI (best quality from 500px source)
    master_1024 = lanczos(source, 1024)
    if source.size[0] < 1024:
        master_1024 = master_1024.filter(
            ImageFilter.UnsharpMask(radius=1.1, percent=125, threshold=2)
        )
    mark_512 = lanczos(mark, 512)

    # Tauri / macOS dock
    save_png(ICONS / "icon.png", master_1024)
    save_png(ICONS / "32x32.png", lanczos(master_1024, 32))
    save_png(ICONS / "128x128.png", lanczos(master_1024, 128))
    save_png(ICONS / "128x128@2x.png", lanczos(master_1024, 256))
    build_icns(ICONS / "icon.png", ICONS / "icon.icns")

    # UI — multiple densities for sharp <img> rendering
    ui_exports = [
        ("logo-square-1024.png", master_1024),
        ("logo-square-512.png", lanczos(master_1024, 512)),
        ("logo-square-256.png", lanczos(master_1024, 256)),
        ("logo-square.png", lanczos(master_1024, 512)),
        ("logo-mark-512.png", mark_512),
        ("logo-mark-256.png", lanczos(mark_512, 256)),
        ("logo-mark-128.png", lanczos(mark_512, 128)),
        ("logo-mark.png", lanczos(mark_512, 256)),
    ]

    OUT.mkdir(parents=True, exist_ok=True)
    for name, img in ui_exports:
        save_png(PUBLIC / name, img)
        save_png(OUT / name, img)

    print(f"Generated icons from {SRC} ({source.size[0]}x{source.size[1]} → 1024 Lanczos)")


if __name__ == "__main__":
    main()
