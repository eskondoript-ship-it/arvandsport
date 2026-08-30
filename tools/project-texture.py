#!/usr/bin/env python3
"""
Give an untextured scan its own face, by projecting a photograph onto it.

The owner's figure comes out of Tripo with positions and normals and nothing
else -- no UVs, so there is no coordinate for a texture to be read at and no
amount of assigning an image to the material will do anything. This makes the
coordinates.

The projection is planar and front-on. Each vertex takes its u from its
horizontal position and its v from its height, both normalised to the mesh's
bounding box, which is exactly what a camera at infinity in front of the figure
would see. That works here for a specific reason: the mesh was generated from
this photograph, so the silhouette the projection lands on is the silhouette the
photograph was cut from. It is not general-purpose -- the texture smears across
surfaces that face away from the camera, so the figure should not be turned far
from the projection axis in the scene.

Run --preview first. Which way the scan faces is not recorded anywhere, and
guessing wrong maps the photograph onto the back of his head. The preview
renders the silhouette from all four sides so the front is obvious, and then
--axis bakes it.

Usage:
  python3 tools/project-texture.py <mesh.glb> --preview
  python3 tools/project-texture.py <mesh.glb> <photo> <out.glb> --axis -z
"""
import argparse
import io
import json
import struct

import numpy as np
from PIL import Image, ImageDraw

COMPONENT = {5120: "b", 5121: "B", 5122: "h", 5123: "H", 5125: "I", 5126: "f"}
TYPE_COUNT = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}

# Which world axis points at the camera, and which way u runs across the frame.
AXES = {
    "+z": (2, 0, 1.0),
    "-z": (2, 0, -1.0),
    "+x": (0, 2, -1.0),
    "-x": (0, 2, 1.0),
}


def read_glb(path):
    data = open(path, "rb").read()
    magic, _v, total = struct.unpack("<III", data[:12])
    if magic != 0x46546C67:
        raise SystemExit(f"{path} is not a GLB")
    gltf, binary, off = None, b"", 12
    while off < total:
        length, kind = struct.unpack("<II", data[off : off + 8])
        chunk = data[off + 8 : off + 8 + length]
        if kind == 0x4E4F534A:
            gltf = json.loads(chunk)
        elif kind == 0x004E4942:
            binary = chunk
        off += 8 + length
    return gltf, binary


def accessor(gltf, binary, index):
    a = gltf["accessors"][index]
    view = gltf["bufferViews"][a["bufferView"]]
    n = TYPE_COUNT[a["type"]]
    start = view.get("byteOffset", 0) + a.get("byteOffset", 0)
    dtype = np.dtype("<" + COMPONENT[a["componentType"]])
    flat = np.frombuffer(binary, dtype=dtype, count=a["count"] * n, offset=start)
    return flat.reshape(a["count"], n) if n > 1 else flat


def load_mesh(path):
    gltf, binary = read_glb(path)
    prim = gltf["meshes"][0]["primitives"][0]
    V = accessor(gltf, binary, prim["attributes"]["POSITION"]).astype(np.float64)
    N = accessor(gltf, binary, prim["attributes"]["NORMAL"]).astype(np.float64)
    F = accessor(gltf, binary, prim["indices"]).astype(np.int64).reshape(-1, 3)
    return gltf, V, N, F


def preview(V, F, out_dir):
    """Silhouettes from four sides, so the front is a decision and not a guess."""
    from pathlib import Path
    Path(out_dir).mkdir(parents=True, exist_ok=True)
    for name, (depth_axis, u_axis, sign) in AXES.items():
        keep = [i for i in range(3) if i != depth_axis]
        u = V[:, u_axis] * sign
        v = V[:, 1]
        size = 320
        pad = 12
        us = (u - u.min()) / max(np.ptp(u), 1e-9)
        vs = (v - v.min()) / max(np.ptp(v), 1e-9)
        img = Image.new("L", (size, size), 0)
        draw = ImageDraw.Draw(img)
        # Painter's order by depth, so the near surface wins the pixel.
        order = np.argsort(V[F].mean(axis=1)[:, depth_axis] * (1 if sign > 0 else -1))
        for f in F[order][::3]:
            pts = [
                (pad + us[k] * (size - 2 * pad), size - pad - vs[k] * (size - 2 * pad))
                for k in f
            ]
            draw.polygon(pts, fill=200)
        img.save(f"{out_dir}/front-{name.replace('+', 'p').replace('-', 'm')}.png")
        void = keep
    print(f"wrote four silhouettes to {out_dir}/ -- pick the one facing you and pass it as --axis")


def project(V, axis):
    depth_axis, u_axis, sign = AXES[axis]
    u = V[:, u_axis] * sign
    v = V[:, 1]
    uu = (u - u.min()) / max(np.ptp(u), 1e-9)
    vv = (v - v.min()) / max(np.ptp(v), 1e-9)
    # glTF's v runs down from the top of the image; the mesh's y runs up.
    return np.stack([uu, 1.0 - vv], axis=1)


def confidence(N, axis, floor=0.1, gamma=0.75):
    """How much of the photograph a surface is entitled to, per vertex.

    A planar projection gives every vertex a coordinate, including the ones
    facing away from the camera that took the picture. Those get the colour of
    whatever was in front of them, smeared along the surface -- the sides of a
    head wear the ear that was nearest them, and the whole back wears a mirror
    of the front. It is the one thing that always gives a projected photograph
    away.

    Nothing can put real colour there; there is no picture of it. What can be
    done is stop pretending: written as a vertex colour, this darkens a surface
    as it turns from the camera, so the stretch reads as a figure falling into
    shadow rather than as a texture coming apart. glTF multiplies COLOR_0 into
    the base colour, and three.js picks it up with no material work at all.

    The floor is not zero. A silhouette with a completely black edge reads as a
    hole punched in the figure.
    """
    depth = {"+z": (2, 1.0), "-z": (2, -1.0), "+x": (0, 1.0), "-x": (0, -1.0)}[axis]
    facing = np.clip(N[:, depth[0]] * depth[1], 0.0, 1.0)
    shade = floor + (1.0 - floor) * np.power(facing, gamma)
    return np.repeat(shade[:, None], 3, axis=1)


def write_glb(V, N, UV, F, image_bytes, out_path, name, shade=None):
    buf = bytearray()
    views, accessors = [], []

    def push(data, target=None):
        while len(buf) % 4:
            buf.append(0)
        view = {"buffer": 0, "byteOffset": len(buf), "byteLength": len(data)}
        if target:
            view["target"] = target
        buf.extend(data)
        views.append(view)
        return len(views) - 1

    pos, nrm, uv = V.astype(np.float32), N.astype(np.float32), UV.astype(np.float32)
    idx = F.astype(np.uint32).ravel()
    vp = push(pos.tobytes(), 34962)
    vn = push(nrm.tobytes(), 34962)
    vt = push(uv.tobytes(), 34962)
    vi = push(idx.tobytes(), 34963)
    accessors += [
        {"bufferView": vp, "componentType": 5126, "count": len(pos), "type": "VEC3",
         "min": pos.min(axis=0).tolist(), "max": pos.max(axis=0).tolist()},
        {"bufferView": vn, "componentType": 5126, "count": len(nrm), "type": "VEC3"},
        {"bufferView": vt, "componentType": 5126, "count": len(uv), "type": "VEC2"},
        {"bufferView": vi, "componentType": 5125, "count": idx.size, "type": "SCALAR"},
    ]
    attributes = {"POSITION": 0, "NORMAL": 1, "TEXCOORD_0": 2}
    if shade is not None:
        # Normalised bytes, not floats. This is one number per vertex repeated
        # three times and it does not need 24 bits of it: floats cost 116KB on
        # this mesh against 29, for a shading ramp nobody can see the steps in.
        # VEC4, not VEC3: glTF wants each vertex attribute element aligned to
        # four bytes, and three unsigned bytes is three. The alpha is a
        # constant 255 and costs nothing that the padding would not.
        rgb = np.clip(np.rint(shade * 255), 0, 255).astype(np.uint8)
        rgba = np.concatenate([rgb, np.full((len(rgb), 1), 255, np.uint8)], axis=1)
        vc = push(rgba.tobytes(), 34962)
        accessors.append({
            "bufferView": vc, "componentType": 5121, "count": len(shade),
            "type": "VEC4", "normalized": True,
        })
        attributes["COLOR_0"] = len(accessors) - 1

    img_view = push(image_bytes)

    gltf = {
        "asset": {"version": "2.0", "generator": "arvandsport tools/project-texture.py"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"name": name, "mesh": 0}],
        "meshes": [{"name": name, "primitives": [{
            "attributes": attributes, "indices": 3, "material": 0}]}],
        "materials": [{"name": name, "pbrMetallicRoughness": {
            "baseColorTexture": {"index": 0}, "metallicFactor": 0.0, "roughnessFactor": 0.85}}],
        "textures": [{"source": 0, "sampler": 0}],
        "images": [{"bufferView": img_view, "mimeType": "image/jpeg"}],
        "samplers": [{"magFilter": 9729, "minFilter": 9987, "wrapS": 33071, "wrapT": 33071}],
        "accessors": accessors,
        "bufferViews": views,
        "buffers": [{"byteLength": len(buf)}],
    }
    json_chunk = json.dumps(gltf, separators=(",", ":")).encode()
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
    ap.add_argument("mesh")
    ap.add_argument("photo", nargs="?")
    ap.add_argument("out", nargs="?")
    ap.add_argument("--axis", choices=list(AXES), default="-z")
    ap.add_argument("--preview", action="store_true")
    ap.add_argument("--size", type=int, default=1024)
    ap.add_argument("--name", default="owner")
    ap.add_argument("--no-shade", action="store_true",
                    help="keep the smear on surfaces facing away from the camera")
    args = ap.parse_args()

    _gltf, V, N, F = load_mesh(args.mesh)
    print(f"mesh: {len(V)} vertices, {len(F)} triangles")

    if args.preview:
        preview(V, F, "scratch-preview")
        return

    if not args.photo or not args.out:
        raise SystemExit("need <photo> and <out.glb> unless --preview")

    picture = Image.open(args.photo).convert("RGB")
    # Square, because the projection normalises both axes to the bounding box
    # independently; a non-square source would stretch across the figure.
    picture = picture.resize((args.size, args.size), Image.LANCZOS)
    blob = io.BytesIO()
    picture.save(blob, "JPEG", quality=88, optimize=True, progressive=True)

    UV = project(V, args.axis)
    shade = None if args.no_shade else confidence(N, args.axis)
    write_glb(V, N, UV, F, blob.getvalue(), args.out, args.name, shade)

    import os
    print(f"projected along {args.axis}; wrote {args.out} "
          f"({os.path.getsize(args.out) / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
