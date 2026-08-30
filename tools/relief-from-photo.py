#!/usr/bin/env python3
"""
Build a 3D model of a person out of one photograph of them.

There is no second view and no depth sensor here, so nothing can recover what
the back of someone looks like. What one photograph does carry exactly is the
outline, and an outline plus a plausible thickness is a solid: cut the shape
out, inflate it smoothly toward the middle, mirror a shallower copy behind it,
and the result is a figure with real volume that is correct from the front and
approximate everywhere else. It is the "Teddy" construction, and it is the
honest thing to do with a single frame.

What it buys over a photogrammetry scan of the same person is precision where
it shows. A scan reconstructs its own silhouette, which never quite agrees with
the photograph, so the picture has to be warped onto it and the join is
somewhere around the head. Here the silhouette *is* the photograph's: every
vertex takes its texture coordinate from the pixel it was built at, so the
projection is exact by construction. Nothing is fitted and nothing is warped.

What it costs is the round. Turn the figure much past thirty degrees and it
reads as a relief, because that is what it is. In a scene that keeps him
nearly front-on, that trade is worth making.

Two details that decide whether it looks like a person or a balloon:

  * Depth follows the square root of the distance to the outline, and reaches
    full thickness a fixed distance in rather than at the middle. A dome that
    keeps swelling all the way to the centre gives a body the cross-section of
    a rugby ball; a person is mostly a slab with rounded edges.
  * The back is shallower than the front and is never lit as though it were
    right. It exists so the figure has a silhouette from the side and does not
    vanish at ninety degrees.

Usage:
  python3 tools/relief-from-photo.py <photo> <out.glb> [--step 4] [--depth .075]
"""
import argparse
import importlib.util
import io
import json
import pathlib
import struct

import numpy as np
from PIL import Image

HERE = pathlib.Path(__file__).resolve().parent


def load(name):
    """Sibling tools are scripts, not modules, so they are imported by path."""
    spec = importlib.util.spec_from_file_location(name.replace("-", "_"), HERE / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def distance_to_edge(mask):
    """Pixels from each interior point to the nearest point outside the mask.

    A two-pass chamfer transform: sweep forward accumulating the best distance
    from the up-and-left neighbours, then backward from the down-and-right
    ones. Exact enough for a depth ramp -- the error against a true Euclidean
    transform is under two percent, and this needs no SciPy, which the repo
    does not have and should not gain for one function.
    """
    h, w = mask.shape
    big = float(h + w)
    d = np.where(mask, big, 0.0)
    diag = 1.41421356

    for y in range(1, h):
        row, above = d[y], d[y - 1]
        row[1:] = np.minimum(row[1:], above[:-1] + diag)
        np.minimum(row, above + 1.0, out=row)
        row[:-1] = np.minimum(row[:-1], above[1:] + diag)
        for x in range(1, w):
            if row[x] > row[x - 1] + 1.0:
                row[x] = row[x - 1] + 1.0

    for y in range(h - 2, -1, -1):
        row, below = d[y], d[y + 1]
        row[1:] = np.minimum(row[1:], below[:-1] + diag)
        np.minimum(row, below + 1.0, out=row)
        row[:-1] = np.minimum(row[:-1], below[1:] + diag)
        for x in range(w - 2, -1, -1):
            if row[x] > row[x + 1] + 1.0:
                row[x] = row[x + 1] + 1.0

    return d * mask


def build(mask, depth_px, step, front, back):
    """A closed shell over the mask: front surface, back surface, shared rim.

    Vertices live on a grid every `step` pixels wherever the mask is set. The
    two surfaces share the rim exactly -- the depth ramp is zero at the outline
    -- so there is no seam to stitch and no gap to leak light through.
    """
    h, w = mask.shape
    ys = np.arange(0, h, step)
    xs = np.arange(0, w, step)
    grid = mask[np.ix_(ys, xs)]

    dist = distance_to_edge(mask)

    # How thick this row is entitled to be, and how far in it takes to get
    # there -- both from the row's own widest point rather than from one
    # number for the whole figure.
    #
    # A single global ramp is what made the first build look like a man with a
    # blade for a head: the head is a third of the torso's width, so it never
    # reached the ramp's plateau and the whole of it sat on the steep part,
    # with normals tilted far enough to shade his face nearly black. Rows are a
    # crude proxy for body parts and a very effective one on a standing figure.
    #
    # The thickness itself only follows the width part of the way -- clamped at
    # 45% -- because a head is a third as wide as a torso and nothing like a
    # third as deep.
    reach = dist.max(axis=1)
    span = max(len(reach) // 24, 1)
    kernel = np.ones(span) / span
    reach = np.convolve(np.pad(reach, span, mode="edge"), kernel, "same")[span:-span]
    reach = np.maximum(reach, 1e-6)
    thickness = np.clip(reach / reach.max(), 0.45, 1.0)

    swell = np.sqrt(np.clip(dist / reach[:, None], 0.0, 1.0)) * thickness[:, None]
    swell = swell[np.ix_(ys, xs)]

    gh, gw = grid.shape
    count = int(grid.sum())
    index = np.full((gh, gw), -1, dtype=np.int64)
    index[grid] = np.arange(count)

    px = np.repeat(xs[None, :], gh, axis=0)[grid].astype(np.float64)
    py = np.repeat(ys[:, None], gw, axis=1)[grid].astype(np.float64)
    z = swell[grid]

    # Rim vertices -- where the shell has no thickness -- are shared rather
    # than duplicated, which is what closes it.
    rim = z < 1e-6
    verts = []

    def add(x, y, zz):
        verts.append((x, y, zz))
        return len(verts) - 1

    front_id = np.empty(count, dtype=np.int64)
    back_id = np.empty(count, dtype=np.int64)
    for i in range(count):
        if rim[i]:
            shared = add(px[i], py[i], 0.0)
            front_id[i] = back_id[i] = shared
        else:
            front_id[i] = add(px[i], py[i], z[i] * front)
            back_id[i] = add(px[i], py[i], -z[i] * back)

    faces = []
    for gy in range(gh - 1):
        for gx in range(gw - 1):
            quad = (index[gy, gx], index[gy, gx + 1], index[gy + 1, gx + 1], index[gy + 1, gx])
            if min(quad) < 0:
                continue
            a, b, c, d = quad
            fa, fb, fc, fd = front_id[a], front_id[b], front_id[c], front_id[d]
            ba, bb, bc, bd = back_id[a], back_id[b], back_id[c], back_id[d]
            faces.append((fa, fc, fb))
            faces.append((fa, fd, fc))
            faces.append((ba, bb, bc))
            faces.append((ba, bc, bd))

    V = np.array(verts, dtype=np.float64)
    F = np.array(faces, dtype=np.int64)
    # Drop the triangles the rim collapsed to a line.
    keep = (F[:, 0] != F[:, 1]) & (F[:, 1] != F[:, 2]) & (F[:, 0] != F[:, 2])
    F = F[keep]

    V = smooth_xy(V, F, rounds=4)
    # UVs are recomputed from the smoothed positions, not carried from the
    # pixels the vertices were built at. That is what keeps the photograph
    # registered to the outline after it has been relaxed -- a coordinate
    # pinned to the original grid point would slide the picture a pixel or two
    # sideways all round the edge.
    UV = np.stack([V[:, 0] / max(w - 1, 1), V[:, 1] / max(h - 1, 1)], axis=1)
    return V, UV, F


def smooth_xy(V, F, rounds=4):
    """Relax the outline sideways, leaving depth alone.

    The shell is built on a grid, so its edge is a staircase with a tread the
    size of the grid step -- plainly visible down an arm at any step coarse
    enough to keep the triangle count sane. Averaging each vertex toward its
    neighbours takes the steps out. Only x and y move: the same pass on z would
    flatten the inflation this whole file exists to create.
    """
    n = len(V)
    out = V.copy()
    edges = np.concatenate([F[:, [0, 1]], F[:, [1, 2]], F[:, [2, 0]]])
    for _ in range(rounds):
        total = np.zeros((n, 2))
        hits = np.zeros(n)
        for a, b in ((edges[:, 0], edges[:, 1]), (edges[:, 1], edges[:, 0])):
            np.add.at(total, a, out[b][:, :2])
            np.add.at(hits, a, 1)
        moved = hits > 0
        average = total[moved] / hits[moved][:, None]
        out[moved, :2] = out[moved, :2] * 0.45 + average * 0.55
    return out


def normals_for(V, F):
    fn = np.cross(V[F[:, 1]] - V[F[:, 0]], V[F[:, 2]] - V[F[:, 0]])
    out = np.zeros_like(V)
    for k in range(3):
        np.add.at(out, F[:, k], fn)
    length = np.linalg.norm(out, axis=1)
    length[length == 0] = 1.0
    return out / length[:, None]


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("photo")
    ap.add_argument("out")
    ap.add_argument("--step", type=int, default=4, help="grid spacing in pixels")
    ap.add_argument("--depth", type=float, default=0.075,
                    help="half-thickness at the front, as a fraction of height")
    ap.add_argument("--back", type=float, default=0.55, help="the back's share of that")
    ap.add_argument("--full-at", type=float, default=0.075,
                    help="distance from the outline at which the shell is at full "
                         "thickness, as a fraction of height")
    ap.add_argument("--texture", type=int, default=1024)
    ap.add_argument("--seed", help="X,Y of a pixel inside the figure")
    ap.add_argument("--name", default="owner")
    args = ap.parse_args()

    prepare = load("prepare-photo")
    projector = load("project-texture")

    source = Image.open(args.photo)
    photo = source.convert("RGB")
    w, h = photo.size

    supplied = prepare.cutout_mask(source)
    if supplied is not None:
        mask = supplied
        print("using the supplied cut-out's own edge")
    else:
        seed = tuple(int(v) for v in args.seed.split(",")) if args.seed else None
        mask = prepare.foreground(np.asarray(photo), seed)
    # Two pixels of the outline are half background whatever cut it out.
    mask = prepare.erode(mask, 2)
    print(f"photo {w}x{h}, figure {mask.sum()} pixels ({100 * mask.mean():.0f}% of the frame)")

    V, UV, F = build(mask, args.full_at * h, args.step, args.depth * h, args.back)
    print(f"shell: {len(V)} vertices, {len(F)} triangles at a {args.step}px grid")

    # Into the scene's units: y up, standing on the origin, one unit tall.
    V[:, 1] = -V[:, 1]
    V -= V.mean(axis=0)
    V /= V[:, 1].max() - V[:, 1].min()
    V[:, 1] -= V[:, 1].min()

    N = normals_for(V, F)

    plate = prepare.bleed(np.asarray(photo), mask)
    image = Image.fromarray(plate).resize((args.texture, args.texture), Image.LANCZOS)
    blob = io.BytesIO()
    image.save(blob, "JPEG", quality=88, optimize=True, progressive=True)

    # Gentler than the scan's. There the shading was hiding a real defect --
    # a projection smeared across surfaces the camera never saw. Here the
    # texture coordinate is exact everywhere on the front, so this is only
    # modelling the fall of light around the form, and the scan's ramp took a
    # third of his face below half brightness.
    shade = projector.confidence(N, "+z", floor=0.32, gamma=0.45)
    projector.write_glb(V, N, UV, F, blob.getvalue(), args.out, args.name, shade)

    import os
    print(f"wrote {args.out} ({os.path.getsize(args.out) / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
