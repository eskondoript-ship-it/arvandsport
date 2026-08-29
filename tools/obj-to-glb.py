#!/usr/bin/env python3
"""
Turn the client's Soccer_Ball.obj into a GLB whose 32 panels are separate
meshes, so the 3D scene can pull them apart.

The source model is one welded shell: 8,192 vertices, 16,380 triangles, one
material, no texture. Nothing in it says which faces are a pentagon and which
are a hexagon, so the panels have to be recovered from the geometry.

They come out of the creases. Every panel is gently domed, so triangles inside
one meet at a shallow angle, while triangles across a seam meet at a sharp one
-- the dihedral histogram is bimodal, with 95% of edges under 13 degrees and a
separate cluster between 45 and 89. Flood-filling across shared edges below 30
degrees finds 32 large regions: 20 of 546 triangles and 12 of 426 to 450, which
is a truncated icosahedron's hexagons and pentagons. Getting exactly 32 is the
check that the threshold is right, and it holds anywhere from 12 to 35 degrees,
so the split is a property of the model rather than of a tuned constant.

The panels are modelled inset, with a narrow groove between them, and that
groove is 204 triangles the fill leaves over in 78 slivers. Each is handed to
the panel whose centre it points closest to, so no faces are dropped and every
panel stays a closed piece when the scene pulls it apart.

(An earlier version classified faces by their angle to the nearest icosahedron
vertex direction. It cuts across the subdivided mesh instead of following it
and leaves ragged panel edges. Left here as a warning.)

Each panel becomes its own glTF primitive, named panel_pent_NN / panel_hex_NN,
with its centroid direction stored in the node's extras. The scene reads those
directions to translate panels outward for the exploded view. Positions are
recentred on the origin and scaled to a unit radius, so the scene can size the
ball in its own units.

Usage:  python3 tools/obj-to-glb.py <input.obj> <output.glb>
"""
import json
import struct
import sys
from collections import defaultdict, deque

import numpy as np

CREASE_DEG = 30.0
# Anything smaller than this is groove filler between panels, not a panel.
MIN_PANEL_FACES = 50
# A truncated icosahedron, which is what this model is.
EXPECT_PANELS = 32
EXPECT_PENTAGONS = 12
EXPECT_HEXAGONS = 20


def read_obj(path):
    """Positions and triangles only. Normals are recomputed per panel, and the
    UVs are for a texture the client did not supply."""
    verts = []
    tris = []
    with open(path, "r") as fh:
        for line in fh:
            if line.startswith("v "):
                verts.append([float(x) for x in line.split()[1:4]])
            elif line.startswith("f "):
                idx = [int(tok.split("/")[0]) - 1 for tok in line.split()[1:]]
                # Fan-triangulate anything that is not already a triangle.
                for i in range(1, len(idx) - 1):
                    tris.append((idx[0], idx[i], idx[i + 1]))
    return np.array(verts, dtype=np.float64), np.array(tris, dtype=np.int32)


def face_normals(V, F):
    n = np.cross(V[F[:, 1]] - V[F[:, 0]], V[F[:, 2]] - V[F[:, 0]])
    length = np.linalg.norm(n, axis=1)
    length[length == 0] = 1.0
    return n / length[:, None]


def find_panels(V, F):
    """Flood-fill faces across shallow shared edges. Returns a label per face."""
    N = face_normals(V, F)

    edge_faces = defaultdict(list)
    for fi, tri in enumerate(F):
        for a, b in ((tri[0], tri[1]), (tri[1], tri[2]), (tri[2], tri[0])):
            edge_faces[(min(a, b), max(a, b))].append(fi)

    cos_limit = np.cos(np.radians(CREASE_DEG))
    neighbours = defaultdict(list)
    for faces in edge_faces.values():
        # A closed shell gives every edge exactly two faces; skip anything else
        # rather than guessing at a hole.
        if len(faces) != 2:
            continue
        a, b = faces
        if float(N[a] @ N[b]) >= cos_limit:
            neighbours[a].append(b)
            neighbours[b].append(a)

    label = np.full(len(F), -1, dtype=np.int32)
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
    return label, count


def build_panels(V, F):
    label, count = find_panels(V, F)
    sizes = np.bincount(label, minlength=count)
    big = np.where(sizes >= MIN_PANEL_FACES)[0]

    if len(big) != EXPECT_PANELS:
        raise SystemExit(
            f"expected {EXPECT_PANELS} panels from the crease fill, got {len(big)}. "
            f"The mesh is not the truncated icosahedron this tool assumes, or "
            f"CREASE_DEG ({CREASE_DEG}) needs revisiting."
        )

    # Hexagons are the larger 20. The sizes cluster hard -- 546 against 426-450 --
    # so rank and split rather than matching an exact count, which the source
    # mesh does not give (its pentagons are not all subdivided identically).
    order = sorted(big, key=lambda i: -sizes[i])
    hexagons = set(int(i) for i in order[:EXPECT_HEXAGONS])
    if sizes[order[EXPECT_HEXAGONS - 1]] <= sizes[order[EXPECT_HEXAGONS]]:
        raise SystemExit(
            f"no clean gap between hexagon and pentagon sizes: {sorted(sizes[big].tolist())}"
        )

    centres = {}
    for i in big:
        c = V[F[label == i]].reshape(-1, 3).mean(axis=0)
        centres[int(i)] = c / (np.linalg.norm(c) or 1.0)

    ids = list(centres.keys())
    dirs = np.array([centres[i] for i in ids])

    # Hand every groove sliver to the panel it points closest to.
    members = {i: list(np.where(label == i)[0]) for i in ids}
    leftover = np.where(~np.isin(label, big))[0]
    if len(leftover):
        cen = V[F[leftover]].mean(axis=1)
        cen = cen / np.linalg.norm(cen, axis=1)[:, None]
        nearest = (cen @ dirs.T).argmax(axis=1)
        for face, k in zip(leftover, nearest):
            members[ids[k]].append(int(face))

    panels = []
    for i in ids:
        panels.append({"faces": F[sorted(members[i])], "pentagon": i not in hexagons})

    n_pent = sum(1 for p in panels if p["pentagon"])
    if n_pent != EXPECT_PENTAGONS:
        raise SystemExit(f"found {n_pent} pentagons, expected {EXPECT_PENTAGONS}")
    if sum(len(p["faces"]) for p in panels) != len(F):
        raise SystemExit("faces were lost or duplicated while assigning grooves")
    return panels


def pack_primitive(V, faces, buf):
    """Write one panel's vertex data into the binary chunk.

    Panels are un-welded from each other so each has its own vertex range, and
    each gets flat-shaded normals from its own faces: seam vertices are shared
    in the source, and averaging across a crease rounds the panel edges off.
    """
    used = np.unique(faces)
    remap = {int(v): i for i, v in enumerate(used)}
    pos = V[used].astype(np.float32)
    local = np.array([[remap[int(v)] for v in tri] for tri in faces], dtype=np.uint32)

    # Area-weighted vertex normals within the panel. The dome is gentle, so this
    # reads as a soft-shaded panel with a hard edge at every seam.
    fn = np.cross(pos[local[:, 1]] - pos[local[:, 0]], pos[local[:, 2]] - pos[local[:, 0]])
    nrm = np.zeros_like(pos)
    for k in range(3):
        np.add.at(nrm, local[:, k], fn)
    length = np.linalg.norm(nrm, axis=1)
    length[length == 0] = 1.0
    nrm = (nrm / length[:, None]).astype(np.float32)

    views = []
    for data in (pos, nrm, local.astype(np.uint32).ravel()):
        while len(buf) % 4:
            buf.extend(b"\x00")
        views.append((len(buf), data.nbytes))
        buf.extend(data.tobytes())

    centroid = pos.mean(axis=0)
    return pos, nrm, local, views, centroid


def to_glb(panels, V, out_path):
    buf = bytearray()
    buffer_views, accessors, meshes, nodes = [], [], [], []

    for i, panel in enumerate(panels):
        pos, nrm, local, views, centroid = pack_primitive(V, panel["faces"], buf)

        base = len(buffer_views)
        for offset, length in views[:2]:
            buffer_views.append({"buffer": 0, "byteOffset": offset, "byteLength": length, "target": 34962})
        buffer_views.append({"buffer": 0, "byteOffset": views[2][0], "byteLength": views[2][1], "target": 34963})

        acc = len(accessors)
        accessors.append({
            "bufferView": base, "componentType": 5126, "count": len(pos), "type": "VEC3",
            "min": pos.min(axis=0).tolist(), "max": pos.max(axis=0).tolist(),
        })
        accessors.append({"bufferView": base + 1, "componentType": 5126, "count": len(nrm), "type": "VEC3"})
        accessors.append({"bufferView": base + 2, "componentType": 5125, "count": local.size, "type": "SCALAR"})

        kind = "pent" if panel["pentagon"] else "hex"
        name = f"panel_{kind}_{i:02d}"
        meshes.append({
            "name": name,
            "primitives": [{
                "attributes": {"POSITION": acc, "NORMAL": acc + 1},
                "indices": acc + 2,
                "material": 0 if panel["pentagon"] else 1,
            }],
        })
        direction = centroid / (np.linalg.norm(centroid) or 1.0)
        nodes.append({
            "name": name,
            "mesh": len(meshes) - 1,
            # The scene translates each panel along this for the exploded view.
            "extras": {"panel": kind, "dir": [round(float(x), 6) for x in direction]},
        })

    gltf = {
        "asset": {"version": "2.0", "generator": "arvandsport tools/obj-to-glb.py"},
        "scene": 0,
        "scenes": [{"nodes": list(range(len(nodes)))}],
        "nodes": nodes,
        "meshes": meshes,
        "materials": [
            {"name": "panel_dark", "pbrMetallicRoughness": {
                "baseColorFactor": [0.035, 0.038, 0.045, 1.0], "metallicFactor": 0.08, "roughnessFactor": 0.42}},
            {"name": "panel_light", "pbrMetallicRoughness": {
                "baseColorFactor": [0.94, 0.95, 0.96, 1.0], "metallicFactor": 0.04, "roughnessFactor": 0.38}},
        ],
        "accessors": accessors,
        "bufferViews": buffer_views,
        "buffers": [{"byteLength": len(buf)}],
    }

    json_chunk = json.dumps(gltf, separators=(",", ":")).encode("utf-8")
    json_chunk += b" " * ((4 - len(json_chunk) % 4) % 4)
    bin_chunk = bytes(buf) + b"\x00" * ((4 - len(buf) % 4) % 4)

    total = 12 + 8 + len(json_chunk) + 8 + len(bin_chunk)
    with open(out_path, "wb") as fh:
        fh.write(struct.pack("<III", 0x46546C67, 2, total))
        fh.write(struct.pack("<II", len(json_chunk), 0x4E4F534A))
        fh.write(json_chunk)
        fh.write(struct.pack("<II", len(bin_chunk), 0x004E4942))
        fh.write(bin_chunk)


def main():
    if len(sys.argv) != 3:
        raise SystemExit(__doc__.strip())
    src, dst = sys.argv[1], sys.argv[2]

    V, F = read_obj(src)
    print(f"read {len(V)} vertices, {len(F)} triangles")

    # Recentre and normalise to a unit radius so the scene sets the scale.
    V = V - V.mean(axis=0)
    V = V / np.linalg.norm(V, axis=1).max()

    panels = build_panels(V, F)
    pent = sum(1 for p in panels if p["pentagon"])
    print(f"panels: {len(panels)} ({pent} pentagons, {len(panels) - pent} hexagons)")

    to_glb(panels, V, dst)
    import os
    print(f"wrote {dst} ({os.path.getsize(dst) / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
