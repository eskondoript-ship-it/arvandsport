#!/usr/bin/env python3
"""
Shrink a dense scan-style GLB enough to put on a web page.

The owner's figure arrives from Tripo as 192,296 triangles with positions and
normals and nothing else -- no UVs, no material, no texture -- at 4.75MB. That
is more than the entire homepage budget for a figure that stands about a
tenth of the frame, so it has to come down.

The method is vertex clustering. Snap every vertex to a grid, keep one
representative per occupied cell, rewrite the triangles to point at
representatives, and drop the ones that collapsed to a line. It is not the
best decimation there is -- quadric error metrics keep silhouettes far better
-- but it is a hundred lines instead of a thousand, it never produces holes,
and at the size this figure is drawn the difference is not visible. If he ever
needs to be seen close up, that is the point to reach for a real simplifier.

Two details that matter:

  * The representative is the cell's centroid, not the first vertex in it.
    Taking the first is faster and gives a visibly lumpier surface, because
    the kept points sit wherever the file happened to list them rather than in
    the middle of what they replace.
  * Normals are re-averaged from the decimated triangles rather than carried
    over. A normal from the original mesh describes a surface that no longer
    exists, and reusing them makes a low-polygon model look dented.

Usage:  python3 tools/decimate-glb.py <in.glb> <out.glb> [--target 25000]
"""
import argparse
import json
import struct

import numpy as np

COMPONENT = {5120: "b", 5121: "B", 5122: "h", 5123: "H", 5125: "I", 5126: "f"}
TYPE_COUNT = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}


def read_glb(path):
    data = open(path, "rb").read()
    magic, _version, total = struct.unpack("<III", data[:12])
    if magic != 0x46546C67:
        raise SystemExit(f"{path} is not a GLB")
    gltf, binary, offset = None, b"", 12
    while offset < total:
        length, kind = struct.unpack("<II", data[offset : offset + 8])
        chunk = data[offset + 8 : offset + 8 + length]
        if kind == 0x4E4F534A:
            gltf = json.loads(chunk)
        elif kind == 0x004E4942:
            binary = chunk
        offset += 8 + length
    return gltf, binary


def accessor(gltf, binary, index):
    a = gltf["accessors"][index]
    view = gltf["bufferViews"][a["bufferView"]]
    n = TYPE_COUNT[a["type"]]
    start = view.get("byteOffset", 0) + a.get("byteOffset", 0)
    dtype = np.dtype("<" + COMPONENT[a["componentType"]])
    flat = np.frombuffer(binary, dtype=dtype, count=a["count"] * n, offset=start)
    return flat.reshape(a["count"], n) if n > 1 else flat


def cluster(V, F, target):
    """Collapse vertices onto a grid until the triangle count is near target."""
    span = V.max(axis=0) - V.min(axis=0)
    # Start from the cube root of how much has to go, then close in. The first
    # guess is usually within a factor of two, and each pass is cheap.
    ratio = max(target / max(len(F), 1), 1e-6)
    grid = int(round((len(F) / max(target, 1)) ** (1 / 3) * 34))
    best = None
    for _ in range(14):
        grid = max(8, min(768, grid))
        cell = span.max() / grid
        keys = np.floor((V - V.min(axis=0)) / cell).astype(np.int64)
        _uniq, inverse = np.unique(keys, axis=0, return_inverse=True)

        tris = inverse[F]
        alive = (tris[:, 0] != tris[:, 1]) & (tris[:, 1] != tris[:, 2]) & (tris[:, 0] != tris[:, 2])
        tris = tris[alive]
        # Two triangles on the same three points are the same triangle.
        tris = np.unique(np.sort(tris, axis=1), axis=0, return_index=True)[1]
        kept = inverse[F][alive][tris]

        if best is None or abs(len(kept) - target) < abs(len(best[1]) - target):
            best = (inverse, kept)
        if abs(len(kept) - target) / target < 0.12:
            break
        grid = int(grid * (target / max(len(kept), 1)) ** (1 / 3))

    inverse, tris = best
    # Centroid per cell, not the first vertex that landed in it.
    count = inverse.max() + 1
    sums = np.zeros((count, 3))
    np.add.at(sums, inverse, V)
    hits = np.bincount(inverse, minlength=count).reshape(-1, 1)
    centres = sums / np.maximum(hits, 1)

    used = np.unique(tris)
    remap = np.full(count, -1, dtype=np.int64)
    remap[used] = np.arange(len(used))
    return centres[used], remap[tris]


def normals_for(V, F):
    """Re-averaged from the mesh that now exists, not carried from the old one."""
    fn = np.cross(V[F[:, 1]] - V[F[:, 0]], V[F[:, 2]] - V[F[:, 0]])
    out = np.zeros_like(V)
    for k in range(3):
        np.add.at(out, F[:, k], fn)
    length = np.linalg.norm(out, axis=1)
    length[length == 0] = 1.0
    return out / length[:, None]


def write_glb(V, N, F, out_path, name):
    buf = bytearray()
    views, accessors = [], []

    def push(data, target):
        while len(buf) % 4:
            buf.append(0)
        views.append({"buffer": 0, "byteOffset": len(buf), "byteLength": data.nbytes, "target": target})
        buf.extend(data.tobytes())
        return len(views) - 1

    pos = V.astype(np.float32)
    nrm = N.astype(np.float32)
    idx = F.astype(np.uint32).ravel()

    vp, vn, vi = push(pos, 34962), push(nrm, 34962), push(idx, 34963)
    accessors.append({
        "bufferView": vp, "componentType": 5126, "count": len(pos), "type": "VEC3",
        "min": pos.min(axis=0).tolist(), "max": pos.max(axis=0).tolist(),
    })
    accessors.append({"bufferView": vn, "componentType": 5126, "count": len(nrm), "type": "VEC3"})
    accessors.append({"bufferView": vi, "componentType": 5125, "count": idx.size, "type": "SCALAR"})

    gltf = {
        "asset": {"version": "2.0", "generator": "arvandsport tools/decimate-glb.py"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"name": name, "mesh": 0}],
        "meshes": [{"name": name, "primitives": [{
            "attributes": {"POSITION": 0, "NORMAL": 1}, "indices": 2, "material": 0}]}],
        "materials": [{"name": "figure", "pbrMetallicRoughness": {
            "baseColorFactor": [0.62, 0.66, 0.72, 1.0], "metallicFactor": 0.05, "roughnessFactor": 0.62}}],
        "accessors": accessors,
        "bufferViews": views,
        "buffers": [{"byteLength": len(buf)}],
    }

    json_chunk = json.dumps(gltf, separators=(",", ":")).encode("utf-8")
    json_chunk += b" " * ((4 - len(json_chunk) % 4) % 4)
    bin_chunk = bytes(buf) + b"\x00" * ((4 - len(buf) % 4) % 4)
    with open(out_path, "wb") as fh:
        fh.write(struct.pack("<III", 0x46546C67, 2, 12 + 8 + len(json_chunk) + 8 + len(bin_chunk)))
        fh.write(struct.pack("<II", len(json_chunk), 0x4E4F534A))
        fh.write(json_chunk)
        fh.write(struct.pack("<II", len(bin_chunk), 0x004E4942))
        fh.write(bin_chunk)


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("src")
    ap.add_argument("dst")
    ap.add_argument("--target", type=int, default=25000, help="triangles to aim for")
    ap.add_argument("--name", default="figure")
    args = ap.parse_args()

    gltf, binary = read_glb(args.src)
    prim = gltf["meshes"][0]["primitives"][0]
    V = accessor(gltf, binary, prim["attributes"]["POSITION"]).astype(np.float64)
    F = accessor(gltf, binary, prim["indices"]).astype(np.int64).reshape(-1, 3)
    print(f"read {len(V)} vertices, {len(F)} triangles")

    # Stand on the origin at unit height, so the scene sets the scale and does
    # not have to know how the model was authored.
    V = V - V.mean(axis=0)
    V = V / (V[:, 1].max() - V[:, 1].min())
    V[:, 1] -= V[:, 1].min()

    V2, F2 = cluster(V, F, args.target)
    N2 = normals_for(V2, F2)
    print(f"decimated to {len(V2)} vertices, {len(F2)} triangles "
          f"({100 * len(F2) / len(F):.1f}% of the original)")

    write_glb(V2, N2, F2, args.dst, args.name)
    import os
    print(f"wrote {args.dst} ({os.path.getsize(args.dst) / 1024:.0f} KB, "
          f"was {os.path.getsize(args.src) / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
