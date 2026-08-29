import json, math
import numpy as np
from PIL import Image, ImageDraw

SC='/tmp/claude-0/-home-user-novaclip-site/11349094-514b-5775-9c6a-f86a6c041393/scratchpad'
d=json.load(open(f'{SC}/geo0.json'))
V=np.array(d['verts'],dtype=np.float64).reshape(-1,3)
tris=[]
for f in d['faces']:
    for i in range(1,len(f)-1): tris.append((f[0],f[i],f[i+1]))
F=np.array(tris,dtype=np.int32)
V-=V.mean(axis=0); V/=np.abs(V).max()

# The 12 pentagon centres of a truncated icosahedron sit on the icosahedron's
# vertex directions. Classify each face by the angle from its own direction to
# the nearest of those, so panels get their colour from geometry rather than
# from material data the FBX does not carry.
phi=(1+5**0.5)/2
ico=[]
for s1 in(1,-1):
    for s2 in(1,-1):
        ico += [(0,s1,s2*phi),(s1,s2*phi,0),(s1*phi,0,s2)]
I=np.unique(np.round(np.array(ico)/np.linalg.norm(ico,axis=1)[:,None],6),axis=0)

# Panels come from the mesh itself: flood-fill triangles across every shared
# edge whose dihedral angle is under 20 degrees and the creased seams split
# the surface into exactly 32 regions — 12 of 410 faces and 20 of 492, the
# pentagons and hexagons of a truncated icosahedron. Colouring by region
# gives exact panel edges; thresholding by angle to the nearest icosahedron
# vertex, which is where this started, left them ragged.
BLACK=np.load(f'{SC}/isblack.npy')

def render(angle, size=360, ss=3):
    S=size*ss
    ca,sa=math.cos(angle),math.sin(angle)
    Ry=np.array([[ca,0,sa],[0,1,0],[-sa,0,ca]])
    t=math.radians(-14); ct,st=math.cos(t),math.sin(t)
    Rx=np.array([[1,0,0],[0,ct,-st],[0,st,ct]])
    P=V@Ry.T@Rx.T
    n0,n1,n2=P[F[:,0]],P[F[:,1]],P[F[:,2]]
    nrm=np.cross(n1-n0,n2-n0); L=np.linalg.norm(nrm,axis=1); L[L==0]=1; nrm/=L[:,None]
    idx=np.where(nrm[:,2]>0)[0]
    z=(n0[:,2]+n1[:,2]+n2[:,2])/3
    idx=idx[np.argsort(z[idx])]

    Ld=np.array([-0.45,0.6,0.66]); Ld/=np.linalg.norm(Ld)
    lam=np.clip(nrm@Ld,0,1)
    H=np.array([-0.3,0.4,0.87]); H/=np.linalg.norm(H)
    spec=np.clip(nrm@H,0,1)**20
    rim=np.clip(1-nrm[:,2],0,1)**3.2
    black=BLACK

    img=Image.new('RGBA',(S,S),(0,0,0,0)); dr=ImageDraw.Draw(img,'RGBA')
    c=S/2; R=S*0.455
    for i in idx:
        tri=[(c+P[F[i,k],0]*R, c-P[F[i,k],1]*R) for k in range(3)]
        # Neutral grey, deliberately. An earlier pass gave blue a small boost
        # for a chrome look; on a white-and-black ball that boost dominates the
        # dark panels and they read teal rather than black.
        if black[i]:
            v = 10 + lam[i] * 20 + spec[i] * 95 + rim[i] * 16
        else:
            v = 126 + lam[i] * 116 + spec[i] * 86 + rim[i] * 10
        v = max(0, min(255, int(v)))
        r = g = b = v
        dr.polygon(tri,fill=(r,g,b,255))
    return img.resize((size,size),Image.LANCZOS)

if __name__=='__main__':
    from PIL import ImageFilter
    sheet=Image.new('RGBA',(360*3,360),(0,0,0,0))
    for k,a in enumerate([0.0,1.1,2.2]):
        sheet.paste(render(a).filter(ImageFilter.GaussianBlur(0.4)),(k*360,0))
    sheet.save(f'{SC}/bw-test.png')
    print('rendered')
