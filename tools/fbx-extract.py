import struct, zlib, sys

def read_node(b, off, u64=False):
    OFF = '<Q' if u64 else '<I'
    sz  = 8 if u64 else 4
    end, = struct.unpack_from(OFF, b, off); off += sz
    nprop, = struct.unpack_from(OFF, b, off); off += sz
    plen, = struct.unpack_from(OFF, b, off); off += sz
    nlen = b[off]; off += 1
    name = b[off:off+nlen].decode('utf8', 'replace'); off += nlen
    if end == 0: return None, off
    props = []
    pend = off + plen
    while off < pend:
        t = chr(b[off]); off += 1
        if t in 'YCIFDL':
            fmt = {'Y':'<h','C':'<?','I':'<i','F':'<f','D':'<d','L':'<q'}[t]
            n = struct.calcsize(fmt)
            props.append(struct.unpack_from(fmt, b, off)[0]); off += n
        elif t in 'fidlb':
            alen, enc, clen = struct.unpack_from('<III', b, off); off += 12
            raw = b[off:off+clen]; off += clen
            if enc == 1: raw = zlib.decompress(raw)
            fmt = {'f':'f','i':'i','d':'d','l':'q','b':'?'}[t]
            props.append(list(struct.unpack('<%d%s' % (alen, fmt), raw)))
        elif t in 'SR':
            l, = struct.unpack_from('<I', b, off); off += 4
            v = b[off:off+l]; off += l
            props.append(v.decode('utf8','replace') if t=='S' else v)
        else:
            raise ValueError('unknown prop %r' % t)
    off = pend
    kids = []
    while off < end:
        k, off = read_node(b, off, u64)
        if k is None: break
        kids.append(k)
    return {'name': name, 'props': props, 'kids': kids}, end

b = open(sys.argv[1],'rb').read()
ver, = struct.unpack_from('<I', b, 23)
u64 = ver >= 7500
off = 27
roots = []
while off < len(b) - 16:
    n, off = read_node(b, off, u64)
    if n is None: break
    roots.append(n)

def walk(nodes, depth=0):
    for n in nodes:
        yield n, depth
        yield from walk(n['kids'], depth+1)

geos = []
for n,_ in walk(roots):
    if n['name'] == 'Geometry':
        v = pvi = None
        for k in n['kids']:
            if k['name']=='Vertices': v = k['props'][0]
            if k['name']=='PolygonVertexIndex': pvi = k['props'][0]
        if v and pvi: geos.append((v, pvi))

print('FBX version', ver, '| geometries:', len(geos))
for i,(v,pvi) in enumerate(geos):
    faces=[]; cur=[]
    for idx in pvi:
        if idx < 0: cur.append(~idx); faces.append(cur); cur=[]
        else: cur.append(idx)
    sizes={}
    for f in faces: sizes[len(f)]=sizes.get(len(f),0)+1
    print(f'  geo{i}: verts={len(v)//3} faces={len(faces)} face-sizes={sizes}')
    import json
    json.dump({'verts':v,'faces':faces}, open(f'/tmp/claude-0/-home-user-novaclip-site/11349094-514b-5775-9c6a-f86a6c041393/scratchpad/geo{i}.json','w'))
