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


def erode(mask, rounds=1):
    """Shrink a mask by one pixel in the four directions, `rounds` times."""
    return ~dilate(~mask, rounds)


def cutout_mask(image):
    """The figure, when the picture has already been cut out for us.

    A supplied cut-out is worth far more than any threshold this file can
    invent: the edge is exact, so the warp below is working from the real
    outline rather than from wherever navy stopped looking like navy. Alpha if
    the file carries it, otherwise a near-white ground, which is what a cut-out
    flattened to JPEG looks like.

    Returns None when the picture is an ordinary photograph, and the colour
    tests take over.
    """
    if image.mode in ("RGBA", "LA") or "transparency" in image.info:
        alpha = np.asarray(image.convert("RGBA"))[..., 3]
        if (alpha < 200).mean() > 0.05:
            return alpha > 128

    a = np.asarray(image.convert("RGB")).astype(int)
    # np.ptp(a, ...), not a.ptp(...): numpy 2 removed the method.
    near_white = (a.min(axis=2) > 238) & (np.ptp(a, axis=2) < 12)
    # A photograph has sky and shirts and stray highlights; it does not have
    # two fifths of the frame at paper white with nothing in it.
    edge = np.concatenate([near_white[0], near_white[-1], near_white[:, 0], near_white[:, -1]])
    if near_white.mean() > 0.25 and edge.mean() > 0.9:
        return ~near_white
    return None


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
    # Loose on purpose. A tight skin test drops the shadowed side of a face and
    # the greyer midtones, and a face with holes in it is worse than a face
    # with a little background in it: the holes change where the silhouette's
    # edge is, and the warp below is built entirely out of that edge. It cost
    # the head about half its width and smeared the face across the collar.
    # Anything this over-catches elsewhere in the frame is discarded by the
    # flood fill, which only keeps what is joined to the figure.
    skin = (r > 88) & (r > g + 8) & (g > b - 6)
    # Anything dark, whatever colour it leans. The navy test asks for blue and
    # hair is warm -- a value like (94, 64, 64) fails it outright, so the top
    # of the head fell outside the figure and the bleed flooded sky down over
    # it. On a relief that is worse than a texture fault: the mask is the
    # silhouette the mesh is built from, so it took the shape of his head off
    # as well. The flood fill is what makes this safe to be so loose; dark
    # things elsewhere in the frame are simply not joined to him.
    dark = lum < 95
    grass = (g > r + 18) & (g > b + 18)
    candidate = (navy | skin | dark) & ~grass
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


def extents(mask, smooth=9):
    """Left and right edge of a silhouette on every row, lightly smoothed.

    Smoothed because the scan's outline is a decimated one: raw per-row edges
    step in and out by a pixel or two and a warp built on them ripples down the
    figure. Rows with nothing in them are filled from their neighbours so the
    mapping stays continuous over gaps between the legs and the like.
    """
    h = mask.shape[0]
    left = np.full(h, np.nan)
    right = np.full(h, np.nan)
    for y in range(h):
        xs = np.nonzero(mask[y])[0]
        if len(xs):
            left[y], right[y] = xs[0], xs[-1]
    known = ~np.isnan(left)
    if not known.any():
        raise SystemExit("empty silhouette")
    idx = np.arange(h)
    left = np.interp(idx, idx[known], left[known])
    right = np.interp(idx, idx[known], right[known])
    if smooth > 1:
        window = np.ones(smooth) / smooth
        pad = smooth // 2
        left = np.convolve(np.pad(left, pad, mode="edge"), window, "valid")[:h]
        right = np.convolve(np.pad(right, pad, mode="edge"), window, "valid")[:h]
    return left, right


def warp_to_silhouette(rgb, photo_mask, mesh_mask):
    """Bend the photograph until its outline is the scan's outline.

    The bounding-box fit gets the figure as a whole into the right rectangle
    and no further. Inside it the two shapes still disagree -- most visibly at
    the head, which a photogrammetry scan reconstructs a size and a shape of
    its own, so the face lands low and wide and comes out smeared. No amount of
    nudging the crop fixes that, because it is not a translation.

    This resamples scanline by scanline instead. Vertically, rows are matched by
    where they fall in each silhouette's cumulative area, so the head band of
    the photograph maps onto the head band of the scan whatever their relative
    heights. Horizontally, each row's photo span is stretched onto that row's
    mesh span, so shoulders land on shoulders and the face lands on the face.

    It is a warp, so it distorts -- but the distortion is exactly the difference
    between the scan and the person, which is the difference that was showing
    up as a smear.
    """
    h, w, _ = rgb.shape
    p_left, p_right = extents(photo_mask)
    m_left, m_right = extents(mesh_mask)

    # Rows map straight across. The crop has already been fitted so that the
    # two figures share a top and a bottom, and anything cleverer than that
    # made things worse: matching the silhouettes by cumulative area sounds
    # right and is not, because a scan's arms and torso carry different
    # proportions of the mass than the photograph's do -- it dragged the face
    # down into the collar. Left and right is where the two shapes actually
    # disagree, and that is all this corrects.
    rows = np.arange(h, dtype=np.float64)

    out_x = np.arange(w, dtype=np.float64)
    src_x = np.empty((h, w))
    for y in range(h):
        ml, mr = m_left[y], m_right[y]
        pl, pr = p_left[int(round(np.clip(rows[y], 0, h - 1)))], p_right[
            int(round(np.clip(rows[y], 0, h - 1)))
        ]
        span = max(mr - ml, 1e-6)
        src_x[y] = pl + (out_x - ml) * (pr - pl) / span

    src_y = np.repeat(rows[:, None], w, axis=1)
    return sample(rgb, src_x, src_y)


def sample(rgb, x, y):
    """Bilinear resample of an image at arbitrary coordinates."""
    h, w, _ = rgb.shape
    x = np.clip(x, 0, w - 1.001)
    y = np.clip(y, 0, h - 1.001)
    x0, y0 = np.floor(x).astype(int), np.floor(y).astype(int)
    fx, fy = (x - x0)[..., None], (y - y0)[..., None]
    a = rgb[y0, x0].astype(np.float64)
    b = rgb[y0, x0 + 1].astype(np.float64)
    c = rgb[y0 + 1, x0].astype(np.float64)
    d = rgb[y0 + 1, x0 + 1].astype(np.float64)
    top = a + (b - a) * fx
    bottom = c + (d - c) * fx
    return np.clip(top + (bottom - top) * fy, 0, 255).astype(np.uint8)


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("photo")
    ap.add_argument("mesh")
    ap.add_argument("out")
    ap.add_argument("--axis", default="+z", help="the direction the scan faces")
    ap.add_argument("--seed", help="X,Y of a pixel inside the figure")
    ap.add_argument("--preview", help="directory for the mask and the overlay")
    ap.add_argument("--quality", type=int, default=90)
    ap.add_argument("--no-warp", action="store_true",
                    help="crop only, without bending the photograph onto the scan")
    args = ap.parse_args()

    projector = load_projector()
    _gltf, V, _N, F = projector.load_mesh(args.mesh)
    span = V.max(axis=0) - V.min(axis=0)
    print(f"mesh: {len(V)} vertices, bounding box {span[0]:.4f} wide by {span[1]:.4f} tall")

    source = Image.open(args.photo)
    photo = source.convert("RGB")
    supplied = cutout_mask(source)
    if supplied is not None:
        mask = supplied
        print("using the supplied cut-out's own edge")
    else:
        seed = tuple(int(v) for v in args.seed.split(",")) if args.seed else None
        mask = foreground(np.asarray(photo), seed)
    ys, xs = np.nonzero(mask)
    start = (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)
    print(f"figure found at {start}, {mask.sum()} pixels")

    size = (start[2] - start[0], start[3] - start[1])
    rect, overlap = fit_crop(mask, silhouette(projector.project, V, F, args.axis, size), start)
    print(f"crop fitted to {rect}, silhouettes overlap {overlap:.3f}")

    plate = photo.crop(rect)
    plate_mask = np.asarray(Image.fromarray((mask * 255).astype(np.uint8)).crop(rect)) > 127
    outline = silhouette(projector.project, V, F, args.axis, plate.size)

    body = np.asarray(plate)
    if not args.no_warp:
        body = warp_to_silhouette(body, plate_mask, outline)
        plate_mask = outline
        print("warped the photograph onto the scan's outline, scanline by scanline")

    # Eroded by two before the bleed. The outermost ring of a cut-out edge is
    # half background whatever cut it -- a green rim came off the grass and sat
    # on his shoes -- and the bleed replaces it with the colour just inside.
    painted = bleed(body, erode(plate_mask, 2))
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
