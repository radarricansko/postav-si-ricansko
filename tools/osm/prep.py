import json,math,re
j=json.load(open('osm/osm.json'));LAT0,LON0=j['lat0'],j['lon0']
KX=111320*math.cos(math.radians(LAT0));KY=110540
P=lambda la,lo:[(lo-LON0)*KX,(la-LAT0)*KY]
obce=json.load(open('test/obce.json'))
N=j['roads']['N'];W=j['roads']['W']
CL={'motorway':'M','trunk':'P','primary':'P','secondary':'S','tertiary':'T','motorway_link':'L','trunk_link':'L','primary_link':'L','secondary_link':'L','tertiary_link':'L','rail:main':'Z'}
# chain-merge edges of same class through degree-2 nodes
E=[[CL[w[0]],w[1],w[2],[N[w[1]]]+w[3]+[N[w[2]]],w[4],w[5]] for w in W if w[0] in CL]
def merge(E):
    changed=True
    while changed:
        changed=False;inc={}
        for i,e in enumerate(E):
            if e is None: continue
            for n in (e[1],e[2]): inc.setdefault(n,[]).append(i)
        for n,L in inc.items():
            if len(L)!=2: continue
            i,k=L
            if i==k: continue
            a,b=E[i],E[k]
            if a is None or b is None or a[0]!=b[0] or a[1]==a[2] or b[1]==b[2]: continue
            A=a[3] if a[2]==n else a[3][::-1]; a0=a[1] if a[2]==n else a[2]
            B=b[3] if b[1]==n else b[3][::-1]; b1=b[2] if b[1]==n else b[1]
            if a0==b1: continue
            E[i]=[a[0],a0,b1,A+B[1:],a[4] or b[4],a[5] or b[5]];E[k]=None;changed=True
        E=[e for e in E if e]
    return E
E=merge(E)
def dp(p,eps):
    if len(p)<3: return p
    a,b=p[0],p[-1];dx,dy=b[0]-a[0],b[1]-a[1];L=math.hypot(dx,dy) or 1
    d=[abs(dy*(q[0]-a[0])-dx*(q[1]-a[1]))/L for q in p[1:-1]];m=max(d);ix=d.index(m)+1
    return dp(p[:ix+1],eps)[:-1]+dp(p[ix:],eps) if m>eps else [a,b]
roads=[[e[0],[[round(x),round(y)] for x,y in dp(e[3],6)],e[4],e[5]] for e in E]
from collections import Counter;print('roads',Counter(r[0] for r in roads),sum(len(r[1]) for r in roads))
# poi
pois=j['pois']
def near(c,typ,maxd,name=None):
    best=None;bd=maxd
    for p in pois:
        if p[1] not in typ: continue
        if name and p[2]!=name: continue
        d=math.dist(p[0],c)
        if d<bd: bd=d;best=p
    return best
towns=[]
for n,la,lo in obce:
    c=P(la,lo)
    v=near(c,('village','town','suburb','hamlet'),2500,n)
    vc=v[0] if v else c
    ch=near(vc,('place_of_worship','church'),650)
    if n=='Říčany':
        sq=[p for p in pois if p[1]=='square' and 'Masaryk' in p[2]]
        cen=sq[0][0] if sq else vc
    else: cen=ch[0] if ch else vc
    mem=near(cen,('memorial',),500); cross=near(cen,('wayside_cross','wayside_shrine'),500); fire=near(cen,('fire_station',),700)
    towns.append({'n':n,'c':[round(cen[0]),round(cen[1])],'church':(ch[2] if ch else ''),'mem':bool(mem),'cross':bool(cross),'fire':bool(fire),'pop':(v[5] if v else '')})
print([ (t['n'],t['church'][:20]) for t in towns[:12]])
# land: forest & water
land=[]
for l in j['land']:
    t=l['t']
    if t in('forest','wood'):k='F'
    elif t in('water','basin'):k='W'
    elif t in('river',):k='R'
    elif t in('orchard',):k='O'
    else: continue
    p=l['p']
    if k in'FW':
        xs=[q[0] for q in p];ys=[q[1] for q in p]
        if (max(xs)-min(xs))*(max(ys)-min(ys))<(2500 if k=='F' else 600): continue
    land.append([k,dp(p,10 if k=='F' else 4)])
print('land',Counter(l[0] for l in land),sum(len(l[1]) for l in land))
stations=[[p[0],p[2]] for p in pois if p[1] in('station','halt')]
out={'towns':towns,'roads':roads,'land':land,'stations':stations,'lat0':LAT0,'lon0':LON0}
s='window.MAP='+json.dumps(out,separators=(',',':'),ensure_ascii=False)+';'
open('v2/map.js','w').write(s);print('size',len(s))
xs=[q[0] for r in roads for q in r[1]];ys=[q[1] for r in roads for q in r[1]];print(min(xs),max(xs),min(ys),max(ys))
