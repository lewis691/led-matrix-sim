# Rear-light space check: ray-casts the Head STEP meshes along -z (model frame, mm).
# Usage: python -I rear-light-space.py ../../context/step_extract/meshes
import numpy as np, sys, os
M=sys.argv[1]
def load(n):
    b=open(os.path.join(M,n),'rb').read(); c=int.from_bytes(b[80:84],'little')
    a=np.frombuffer(b[84:84+c*50],dtype=np.dtype([('n','<3f4'),('v','<9f4'),('a','<u2')]))
    return a['v'].reshape(-1,3,3).astype(float)
def hits(T,x,y):
    # vertical rays along z at (x,y): return list of (z, nz)
    A,B,C=T[:,0],T[:,1],T[:,2]
    def s(P,Q,R): return (Q[:,0]-P[:,0])*(R[:,1]-P[:,1])-(Q[:,1]-P[:,1])*(R[:,0]-P[:,0])
    P=np.array([[x,y,0]]).repeat(len(T),0)
    w0=s(B,C,P);w1=s(C,A,P);w2=s(A,B,P);tot=w0+w1+w2
    m=((w0>=0)&(w1>=0)&(w2>=0)|(w0<=0)&(w1<=0)&(w2<=0))&(np.abs(tot)>1e-12)
    z=(w0[m]*A[m,2]+w1[m]*B[m,2]+w2[m]*C[m,2])/tot[m]
    n=np.cross(B[m]-A[m],C[m]-A[m]); n/=np.linalg.norm(n,axis=1)[:,None]
    o=np.argsort(z); return z[o],n[o]
HB=load('Head_Back.stl'); O=[load(k+'.stl') for k in ['Neck','Mic_Array','DM_J3507_Mounting_Plate','DM_J3507_motor_ASSUMED_PLACEMENT']]
print('rows y, cols x; . = clear dome, normal<20deg from -z, wall 3-3.5, no part in path; o = obstructed/other')
xs=range(-35,36,5)
print('      '+''.join(f'{x:4d}' for x in xs))
for y in range(40,-26,-5):
  row=''
  for x in xs:
    z,n=hits(HB,x,y); c='   -'
    if len(z)>=2:
      tilt=np.degrees(np.arccos(abs(n[0][2]))); wall=z[1]-z[0]
      obs=any(len(hits(T,x,y)[0]) for T in O)
      c='   .' if (tilt<20 and len(z)==2 and wall<3.6 and not obs) else ('   ~' if (tilt<35 and len(z)==2 and not obs) else '   o')
    row+=c
  print(f'{y:5d} '+row)
