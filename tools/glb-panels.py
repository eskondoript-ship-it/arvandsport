#!/usr/bin/env python3
"""
Split a textured ball GLB into its panels, and shrink it enough to ship.

The Trionda arrives as a single welded mesh — 6,676 triangles, one material,
three 2K/1K PNG textures, 5.4MB. Its four panels are moulded into the surface
as grooves; nothing in the file says where one ends and the next begins.

They come out of the creases, the same way the thirty-two panels of the older
ball did (see tools/obj-to-glb.py). Inside a panel the surface is gently curved
and neighbouring triangles meet at a shallow angle; across a groove they meet at
a sharp one. The dihedral histogram is strongly bimodal — 88% of edges under 10
degrees, then a separate cluster from 35 up — and flood-filling below 50 splits
the surface into exactly four regions of 1,666 triangles each. Four equal
regions out of a mesh that was never told to have any is the check that this is
reading the real construction and not a threshold that happened to work.

Two things make it harder than the OBJ:

  * The mesh is un-welded for UVs: 20,028 vertices for 3,340 distinct
    positions, because a vertex on a texture seam exists once per seam side.
    Adjacency has to be computed on welded positions or every seam reads as a
    crease and the fill shatters. The panels are then cut from the original
    un-welded indices, so the UVs still line up with the textures.
  * The textures are most of the file. They are resized and re-encoded here;
    the geometry alone is a fifth of the weight.

Usage:  python3 tools/glb-panels.py <input.glb> <output.glb> [--panels N]
"""
import argparse
import io
import json
import struct
from collections import defaultdict, deque

import numpy as np
from PIL import Image

CREASE_DEG = 50.0
MIN_PANEL_FACES = 40

# Texture budget. The ball is never more than about a third of the viewport, so
# a 2K base colour is several times more than any pixel on screen can show.
TEXTURE_SIZES = {"baseColorTexture": 1024, "metallicRoughnessTexture": 512, "normalTexture": 512}
JPEG_QUALITY = 88

COMPONENT = {5120: "b", 5121: "B", 5122: "h", 5123: "H", 5125: "I", 5126: "f"}
TYPE_COUNT = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}


def read_glb(path):
    data = open(path, "rb").read()
    magic, version, total = struct.unpack("<III", data[:12])
    if magic != 0x46546C67:
        raise SystemExit(f"{path} is not a GLB")
    gltf, binary = None, b""
    offset = 12
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
    stride = view.get("byteStride")
    if stride and stride != n * dtype.itemsize:
        # Interleaved. Walk it element by element rather than assuming packed.
        out = np.empty((a["count"], n), dtype=dtype)
        for i in range(a["count"]):
            off = start + i * stride
            out[i] = np.frombuffer(binary, dtype=dtype, count=n, offset=off)
        return out
    flat = np.frombuffer(binary, dtype=dtype, count=a["count"] * n, offset=start)
    return flat.reshape(a["count"], n) if n > 1 else flat


def find_panels(V, F, expect):
    """Flood-fill faces across shallow shared edges, on welded positions."""
    normals = np.cross(V[F[:, 1]] - V[F[:, 0]], V[F[:, 2]] - V[F[:, 0]])
    length = np.linalg.norm(normals, axis=1)
    length[length == 0] = 1.0
    normals /= length[:, None]

    # A vertex on a UV seam is duplicated, so two triangles that share an edge
    # in space do not share indices. Weld by position or the fill leaks nowhere.
    welded = np.unique(np.round(V, 6), axis=0, return_inverse=True)[1][F]

    edges = defaultdict(list)
    for fi, tri in enumerate(welded):
        for a, b in ((tri[0], tri[1]), (tri[1], tri[2]), (tri[2], tri[0])):
            edges[(min(a, b), max(a, b))].append(fi)

    cos_limit = np.cos(np.radians(CREASE_DEG))
    neighbours = defaultdict(list)
    for faces in edges.values():
        if len(faces) != 2:
            continue
        a, b = faces
        if float(normals[a] @ normals[b]) >= cos_limit:
            neighbours[a].append(b)
            neighbours[b].append(a)

    label = np.full(len(F), -1, dtype=np.int64)
    count = 0
    for seed in range(len(F)):
        if label[seed] != -1:
            continue
        queue = deque([seed])
        label[seed] = count
        while queue:
            cur = queue.popleft()
            for nb in neighbours[cur]:
                if label[nb] == -1:
                    label[nb] = count
                    queue.append(nb)
        count += 1

    sizes = np.bincount(label, minlength=count)
    big = np.where(sizes >= MIN_PANEL_FACES)[0]
    if len(big) != expect:
        raise SystemExit(
            f"expected {expect} panels from the crease fill, got {len(big)} "
            f"(sizes {sorted(sizes[big].tolist(), reverse=True)[:8]}). "
            f"The mesh is not what this tool assumes, or CREASE_DEG needs revisiting."
        )

    centres = {}
    for i in big:
        c = V[F[label == i]].reshape(-1, 3).mean(axis=0)
        centres[int(i)] = c / (np.linalg.norm(c) or 1.0)

    ids = list(centres)
    dirs = np.array([centres[i] for i in ids])
    members = {i: list(np.where(label == i)[0]) for i in ids}

    # Groove slivers go to whichever panel they point at, so nothing is dropped.
    leftover = np.where(~np.isin(label, big))[0]
    if len(leftover):
        cen = V[F[leftover]].mean(axis=1)
        cen /= np.linalg.norm(cen, axis=1)[:, None]
        for face, k in zip(leftover, (cen @ dirs.T).argmax(axis=1)):
            members[ids[k]].append(int(face))

    if sum(len(m) for m in members.values()) != len(F):
        raise SystemExit("faces were lost or duplicated while assigning grooves")
    return [(F[sorted(members[i])], centres[i]) for i in ids]


def shrink_textures(gltf, binary):
    """Resize and re-encode every image the material actually uses."""
    material = gltf["materials"][0]
    slots = {}
    pbr = material.get("pbrMetallicRoughness", {})
    for name, holder in (
        ("baseColorTexture", pbr),
        ("metallicRoughnessTexture", pbr),
        ("normalTexture", material),
    ):
        if name in holder:
            slots[gltf["textures"][holder[name]["index"]]["source"]] = name

    encoded = {}
    for index, image in enumerate(gltf["images"]):
        view = gltf["bufferViews"][image["bufferView"]]
        start = view.get("byteOffset", 0)
        blob = binary[start : start + view["byteLength"]]
        picture = Image.open(io.BytesIO(blob)).convert("RGB")
        target = TEXTURE_SIZES.get(slots.get(index, ""), 512)
        if max(picture.size) > target:
            picture = picture.resize((target, target), Image.LANCZOS)
        out = io.BytesIO()
        picture.save(out, "JPEG", quality=JPEG_QUALITY, optimize=True, progressive=True)
        encoded[index] = out.getvalue()
        print(
            f"  texture {index} ({slots.get(index, 'unused')}): "
            f"{len(blob) // 1024}KB PNG -> {len(encoded[index]) // 1024}KB JPEG at {target}px"
        )
    return encoded


def write_glb(panels, V, N, UV, images, material, out_path):
    buf = bytearray()
    views, accessors, meshes, nodes = [], [], [], []

    def push(data, target=None):
        while len(buf) % 4:
            buf.append(0)
        view = {"buffer": 0, "byteOffset": len(buf), "byteLength": data.nbytes}
        if target:
            view["target"] = target
        buf.extend(data.tobytes())
        views.append(view)
        return len(views) - 1

    for i, (faces, direction) in enumerate(panels):
        used = np.unique(faces)
        remap = {int(v): k for k, v in enumerate(used)}
        local = np.array([[remap[int(v)] for v in tri] for tri in faces], dtype=np.uint32)

        pos = V[used].astype(np.float32)
        nrm = N[used].astype(np.float32)
        uv = UV[used].astype(np.float32)

        base = len(accessors)
        vp = push(pos, 34962)
        vn = push(nrm, 34962)
        vt = push(uv, 34962)
        vi = push(local.ravel(), 34963)

        accessors.append({
            "bufferView": vp, "componentType": 5126, "count": len(pos), "type": "VEC3",
            "min": pos.min(axis=0).tolist(), "max": pos.max(axis=0).tolist(),
        })
        accessors.append({"bufferView": vn, "componentType": 5126, "count": len(nrm), "type": "VEC3"})
        accessors.append({"bufferView": vt, "componentType": 5126, "count": len(uv), "type": "VEC2"})
        accessors.append({"bufferView": vi, "componentType": 5125, "count": local.size, "type": "SCALAR"})

        name = f"panel_shell_{i:02d}"
        meshes.append({
            "name": name,
            "primitives": [{
                "attributes": {"POSITION": base, "NORMAL": base + 1, "TEXCOORD_0": base + 2},
                "indices": base + 3,
                "material": 0,
            }],
        })
        nodes.append({
            "name": name,
            "mesh": len(meshes) - 1,
            # The scene translates each panel along this to open the ball.
            "extras": {"panel": "shell", "dir": [round(float(x), 6) for x in direction]},
        })

    image_defs = []
    for index in sorted(images):
        blob = images[index]
        while len(buf) % 4:
            buf.append(0)
        views.append({"buffer": 0, "byteOffset": len(buf), "byteLength": len(blob)})
        buf.extend(blob)
        image_defs.append({"bufferView": len(views) - 1, "mimeType": "image/jpeg"})

    gltf = {
        "asset": {"version": "2.0", "generator": "arvandsport tools/glb-panels.py"},
        "scene": 0,
        "scenes": [{"nodes": list(range(len(nodes)))}],
        "nodes": nodes,
        "meshes": meshes,
        "materials": [material],
        "textures": [{"source": i, "sampler": 0} for i in range(len(image_defs))],
        "images": image_defs,
        "samplers": [{"magFilter": 9729, "minFilter": 9987, "wrapS": 10497, "wrapT": 10497}],
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
    ap.add_argument("--panels", type=int, default=4)
    args = ap.parse_args()

    gltf, binary = read_glb(args.src)
    prim = gltf["meshes"][0]["primitives"][0]
    V = accessor(gltf, binary, prim["attributes"]["POSITION"]).astype(np.float64)
    N = accessor(gltf, binary, prim["attributes"]["NORMAL"]).astype(np.float64)
    UV = accessor(gltf, binary, prim["attributes"]["TEXCOORD_0"]).astype(np.float64)
    F = accessor(gltf, binary, prim["indices"]).astype(np.int64).reshape(-1, 3)
    print(f"read {len(V)} vertices, {len(F)} triangles, {len(gltf['images'])} textures")

    # Recentre and normalise to a unit radius, so the scene sets the scale.
    V = V - V.mean(axis=0)
    V = V / np.linalg.norm(V, axis=1).max()

    panels = find_panels(V, F, args.panels)
    print(f"panels: {len(panels)} ({', '.join(str(len(f)) for f, _ in panels)} triangles)")

    images = shrink_textures(gltf, binary)

    material = gltf["materials"][0]
    material.setdefault("name", "ball")
    write_glb(panels, V, N, UV, images, material, args.dst)

    import os
    print(f"wrote {args.dst} ({os.path.getsize(args.dst) / 1024:.0f} KB, was {os.path.getsize(args.src) / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
