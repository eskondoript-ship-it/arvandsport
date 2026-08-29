#!/usr/bin/env python3
"""
Turn a photograph of a person into a plate that can be projected onto their scan.

tools/project-texture.py maps the texture's whole rectangle onto the mesh's
whole bounding box: u runs 0 to 1 across the mesh's width and v runs 0 to 1 down
its height, with no offset and no margin anywhere. So the image it is handed has
to be the figure and nothing else -- cropped to the exact rectangle the figure
occupies. Hand it the photograph as taken and the stadium behind him lands on
his shirt.

Cropping by eye gets close and is wrong in a way that is hard to see and easy to
feel: a few pixels out and the collar sits on his chin. This finds the rectangle
by fitting it, which is possible because the mesh already knows what shape the
person is. It renders the scan's silhouette, builds a silhouette from the
photograph, and slides and stretches the crop until the two overlap as well as
they are going to. On the owner's photograph that takes the overlap from 0.83 to
0.87 and lines his shoulders up with his shoulders.

Two more things it does, both about the edge:

  * The background is flooded with the nearest foreground colour. The two
    silhouettes never agree perfectly, so a band a few pixels wide around him
    reads from outside his outline -- and grass is a very obvious thing to find
    on the side of someone's leg. Bleeding his own colours outward makes that
    band skin and navy instead, which is invisible.
  * The plate is written at the crop's own aspect, not squared off.
    project-texture.py resizes to a square itself, and doing it twice is one
    resample too many.

The foreground test is written for this photograph: dark navy clothing and skin
against grass. It is not a segmentation model and does not pretend to be. If it
picks up the wrong thing, --preview writes the mask and the overlay so it is
obvious, and the thresholds are flags.

Usage:
  python3 tools/prepare-photo.py <photo> <mesh.glb> <out.jpg> [--preview DIR]
"""
import argparse
import importlib.util
import pathlib
from collections import deque

import numpy as np
from PIL import Image, ImageDraw

HERE = pathlib.Path(__file__).resolve().parent


def load_projector():
    """project-texture.py is a script, not a module, so import it by path."""
    spec = importlib.util.spec_from_file_location("pt", HERE / "project-texture.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def dilate(mask, rounds=1):
    """Grow a mask by one pixel in the four directions, `rounds` times."""
    out = mask
    for _ in range(rounds):
        grown = out.copy()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            grown |= np.roll(out, (dy, dx), (0, 1))
        out = grown
    return out


def foreground(rgb, seed=None):
    """The person, as one connected region.

    Colour alone is not enough -- the stands carry the same navy and the same
    shadows -- so colour only proposes and a flood fill from the middle of the
    figure decides. Anything not joined to him is not him.
    """
    a = rgb.astype(int)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    lum = (r + g + b) / 3
    navy = (lum < 115) & (b >= r - 4)
    skin = (r > 110) & (r > g + 12) & (g > b + 4)
    grass = (g > r + 18) & (g > b + 18)
    candidate = (navy | skin) & ~grass
    # A highlight on the neck is enough to cut the head off the body, and the
    # fill has no way back across a one-pixel gap -- it returned a headless
    # figure until this closed the join. Grow the region, fill, shrink back:
    # the shape is the one the thresholds found, minus the hairline breaks.
    grown = dilate(candidate, 2)

    h, w = candidate.shape
    if seed is None:
        # The middle of the frame is not reliably the middle of the person, and
        # a seed that lands a few pixels off him starts the fill in a shadow.
        # The densest column across the waist band is: whatever else is in the
        # picture, the subject is the tall solid thing in the middle of it.
        band = candidate[int(h * 0.35) : int(h * 0.65)]
        column = int(band.sum(axis=0).argmax())
        rows = np.nonzero(band[:, column])[0]
        seed = (column, int(h * 0.35) + int(np.median(rows)))
    if not candidate[seed[1], seed[0]]:
        raise SystemExit(
            f"the seed pixel {seed} is not foreground -- pass --seed X,Y inside the figure"
        )

    seen = np.zeros_like(grown)
    queue = deque([seed])
    seen[seed[1], seed[0]] = True
    while queue:
        x, y = queue.popleft()
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and grown[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True
                queue.append((nx, ny))
    return seen & candidate


def silhouette(project, V, F, axis, size):
    """The scan as the projection will see it: a filled outline at the plate's size."""
    w, h = size
    uv = project(V, axis)
    us, vs = uv[:, 0] * (w - 1), uv[:, 1] * (h - 1)
    img = Image.new("L", (w, h), 0)
    draw = ImageDraw.Draw(img)
    for face in F:
        draw.polygon([(us[k], vs[k]) for k in face], fill=255)
    return np.asarray(img) > 0


def fit_crop(mask, target, start, pad=48):
    """Slide and stretch the crop until it covers the scan's outline best.

    Coordinate descent on the four edges, coarse to fine. The starting rectangle
    is the mask's own bounding box, which is already close, so this is a nudge
    and not a search.
    """
    h, w = mask.shape
    padded = np.zeros((h + 2 * pad, w + 2 * pad), bool)
    padded[pad : pad + h, pad : pad + w] = mask
    plate = Image.fromarray((padded * 255).astype(np.uint8))
    tw, th = target.shape[1], target.shape[0]

    def score(rect):
        box = tuple(v + pad for v in rect)
        if box[0] < 0 or box[1] < 0 or box[2] > plate.width or box[3] > plate.height:
            return -1.0
        other = np.asarray(plate.resize((tw, th), Image.BILINEAR, box=box)) > 127
        return (target & other).sum() / (target | other).sum()

    best, top = start, score(start)
    for step in (6, 3, 1):
        moved = True
        while moved:
            moved = False
            for edge in range(4):
                for delta in (-step, step):
                    trial = list(best)
                    trial[edge] += delta
                    trial = tuple(trial)
                    if trial[2] - trial[0] < 40 or trial[3] - trial[1] < 40:
                        continue
                    value = score(trial)
                    if value > top + 1e-5:
                        top, best, moved = value, trial, True
    return best, top


def bleed(rgb, mask, rounds=400):
    """Push foreground colour outward, so the edge never reads the background."""
    out = rgb.astype(np.int16).copy()
    filled = mask.copy()
    for _ in range(rounds):
        if filled.all():
            break
        total = np.zeros_like(out, dtype=np.int32)
        hits = np.zeros(filled.shape, dtype=np.int32)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            shifted_mask = np.roll(filled, (dy, dx), (0, 1))
            shifted_rgb = np.roll(out, (dy, dx), (0, 1))
            if dy:
                edge = 0 if dy > 0 else -1
                shifted_mask[edge, :] = False
            if dx:
                edge = 0 if dx > 0 else -1
                shifted_mask[:, edge] = False
            total += shifted_rgb * shifted_mask[..., None]
            hits += shifted_mask
        grow = (~filled) & (hits > 0)
        out[grow] = (total[grow] / hits[grow][:, None]).astype(np.int16)
        filled |= grow
    return out.astype(np.uint8)


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("photo")
    ap.add_argument("mesh")
    ap.add_argument("out")
    ap.add_argument("--axis", default="+z", help="the direction the scan faces")
    ap.add_argument("--seed", help="X,Y of a pixel inside the figure")
    ap.add_argument("--preview", help="directory for the mask and the overlay")
    ap.add_argument("--quality", type=int, default=90)
    args = ap.parse_args()

    projector = load_projector()
    _gltf, V, _N, F = projector.load_mesh(args.mesh)
    span = V.max(axis=0) - V.min(axis=0)
    print(f"mesh: {len(V)} vertices, bounding box {span[0]:.4f} wide by {span[1]:.4f} tall")

    photo = Image.open(args.photo).convert("RGB")
    pixels = np.asarray(photo)
    seed = tuple(int(v) for v in args.seed.split(",")) if args.seed else None
    mask = foreground(pixels, seed)
    ys, xs = np.nonzero(mask)
    start = (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)
    print(f"figure found at {start}, {mask.sum()} pixels")

    size = (start[2] - start[0], start[3] - start[1])
    outline = silhouette(projector.project, V, F, args.axis, size)
    rect, overlap = fit_crop(mask, outline, start)
    print(f"crop fitted to {rect}, silhouettes overlap {overlap:.3f}")

    plate = photo.crop(rect)
    plate_mask = Image.fromarray((mask * 255).astype(np.uint8)).crop(rect)
    painted = bleed(np.asarray(plate), np.asarray(plate_mask) > 127)
    Image.fromarray(painted).save(args.out, "JPEG", quality=args.quality, optimize=True)

    if args.preview:
        out_dir = pathlib.Path(args.preview)
        out_dir.mkdir(parents=True, exist_ok=True)
        Image.fromarray((mask * 255).astype(np.uint8)).save(out_dir / "mask.png")
        check = silhouette(projector.project, V, F, args.axis, plate.size)
        over = np.asarray(plate).copy()
        over[check] = (over[check] * 0.45 + np.array([255, 60, 60]) * 0.55).astype(np.uint8)
        Image.fromarray(over).save(out_dir / "overlay.png")
        Image.fromarray(painted).save(out_dir / "plate.png")
        print(f"preview written to {out_dir}/")

    import os
    print(f"wrote {args.out} ({os.path.getsize(args.out) / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
