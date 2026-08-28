#!/usr/bin/env python3
"""
Generate responsive WebP derivatives beside the source images.

Why a Python script and not part of the build: `npm run build` deliberately has
no dependencies — the Pages workflow runs it with nothing installed — and there
is no image library in the standard Node library. Derivatives are generated
here, committed, and copied to dist/ with the rest of static/, so the build
stays dependency-free and CI stays fast.

Run after adding or replacing any image:

    pip install pillow && python3 tools/optimize-images.py

Sources are never modified. Every original stays in place as the <img> fallback
for browsers without WebP, and the derivatives sit next to it as
`name-<width>.webp`.
"""
import os
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow is required: pip install pillow")

ROOT = Path(__file__).resolve().parent.parent
IMG = ROOT / "static/assets/img"

# Widths per image role. A phone never needs the 1920px hero, and the roster
# renders its portraits at roughly 230px wide.
PLANS = {
    "ui/hero-bg": [640, 1024, 1440, 1920],
    "ui/smoke": [960, 1920],
    "players/": [265, 400, 529],
    "clients/": [265, 400, 529],
    "coaches/": [209],
    "team/": [400, 800],
    "news/": [400, 800],
}

QUALITY = 78


def plan_for(rel: str):
    for prefix, widths in PLANS.items():
        if rel.startswith(prefix):
            return widths
    return None


def main() -> None:
    made = saved = 0
    for path in sorted(IMG.rglob("*")):
        if path.suffix.lower() not in {".png", ".jpg", ".jpeg"}:
            continue
        rel = str(path.relative_to(IMG)).replace(os.sep, "/")
        stem = rel.rsplit(".", 1)[0]
        widths = plan_for(stem) or plan_for(rel)
        if not widths:
            continue

        with Image.open(path) as im:
            im.load()
            source_w = im.width
            has_alpha = im.mode in ("RGBA", "LA", "P")
            base = im.convert("RGBA" if has_alpha else "RGB")

            for width in widths:
                # Never upscale: a derivative wider than the source is waste.
                if width > source_w:
                    continue
                out = path.parent / f"{path.stem}-{width}.webp"
                height = round(base.height * width / base.width)
                resized = base.resize((width, height), Image.LANCZOS)
                resized.save(out, "WEBP", quality=QUALITY, method=6)
                made += 1
                saved += path.stat().st_size - out.stat().st_size

    print(f"wrote {made} derivatives")
    print(f"total img dir: {sum(f.stat().st_size for f in IMG.rglob('*') if f.is_file()) // 1024} KB")


if __name__ == "__main__":
    main()
