import json, math, sys
import numpy as np
from PIL import Image

SC='/tmp/claude-0/-home-user-novaclip-site/11349094-514b-5775-9c6a-f86a6c041393/scratchpad'
d=json.load(open(f'{SC}/geo0.json'))
V=np.array(d['verts'],dtype=np.float64).reshape(-1,3)
tris=[]
for f in d['faces']:
    for i in range(1,len(f)-1): tris.append((f[0],f[i],f[i+1]))
F=np.array(tris,dtype=np.int32)

# centre and normalise to a unit sphere
V-=V.mean(axis=0)
V/=np.abs(V).max()

def render(angle, size=360, ss=3):
    S=size*ss
    ca,sa=math.cos(angle),math.sin(angle)
    Ry=np.array([[ca,0,sa],[0,1,0],[-sa,0,ca]])
    tilt=math.radians(-14); ct,st=math.cos(tilt),math.sin(tilt)
    Rx=np.array([[1,0,0],[0,ct,-st],[0,st,ct]])
    P=V@Ry.T@Rx.T

    n0,n1,n2=P[F[:,0]],P[F[:,1]],P[F[:,2]]
    nrm=np.cross(n1-n0,n2-n0)
    ln=np.linalg.norm(nrm,axis=1); ln[ln==0]=1
    nrm/=ln[:,None]
    facing=nrm[:,2]>0                      # backface cull
    idx=np.where(facing)[0]
    z=(n0[:,2]+n1[:,2]+n2[:,2])/3
    idx=idx[np.argsort(z[idx])]            # painter's algorithm

    L=np.array([-0.5,0.62,0.61]); L/=np.linalg.norm(L)
    lam=np.clip(nrm@L,0,1)
    Hh=np.array([-0.34,0.42,0.84]); Hh/=np.linalg.norm(Hh)
    spec=np.clip(nrm@Hh,0,1)**16
    rim=np.clip(1-nrm[:,2],0,1)**3.0

    img=Image.new('RGBA',(S,S),(0,0,0,0))
    from PIL import ImageDraw
    dr=ImageDraw.Draw(img,'RGBA')
    cx=cy=S/2; R=S*0.455
    for i in idx:
        tri=[(cx+P[F[i,k],0]*R, cy-P[F[i,k],1]*R) for k in range(3)]
        base=10+lam[i]*54                      # dark chrome body
        r=int(base*0.72+spec[i]*230+rim[i]*22)
        g=int(base*0.94+spec[i]*245+rim[i]*118)
        bl=int(base*1.18+spec[i]*250+rim[i]*150)
        dr.polygon(tri,fill=(min(r,255),min(g,255),min(bl,255),255))
    return img.resize((size,size),Image.LANCZOS)

if __name__=='__main__':
    render(0.0).save(f'{SC}/ball-test.png')
    print('test frame written')
