import sys,numpy as np
from PIL import Image
def decode(path,CS=6,W=1680,H=906):
    im=np.asarray(Image.open(path).convert('RGB')).astype(int);ih,iw=im.shape[:2]
    sx=iw/W;sy=ih/H;cols=W//CS;rows=H//CS;bits=[]
    for r in range(rows):
        for q in range(cols):
            x=(q*CS+CS/2)*sx;y=(r*CS+CS/2)*sy
            x0,x1=int(x-1),int(x+1)+1;y0,y1=int(y-1),int(y+1)+1
            p=im[y0:y1,x0:x1].reshape(-1,3).mean(0)
            bits+= [int(p[0]>127),int(p[1]>127),int(p[2]>127)]
    b=np.packbits(np.array(bits,dtype=np.uint8))
    return bytes(b)
if __name__=='__main__':
    d=decode(sys.argv[1])
    s=12345;t=[]
    for i in range(20000):
        s=(s*1103515245+12345)&0x7fffffff;t.append(s>>16&255)
    err=sum(1 for i in range(min(len(d),15855)) if d[i]!=t[i])
    print(len(d),'byte errors',err)
