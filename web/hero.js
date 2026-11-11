/* Detailní domek pro záběry zblízka (videa): skládá se po kouskách, panáček k němu dojde a zamává.
   HERO.build({scene}) · HERO.place(x,z,ry,s) · HERO.start(now,{ms}) · HERO.show() · HERO.hide()
   HERO.man(now,{path:[[x,z],…],ms,wave,face}) · HERO.update(now) · HERO.pts() → body ve světě (hlava panáčka, střed domku)
   Souřadnice dílů jsou místní: střed domku v počátku, průčelí s dveřmi míří k +z (k ulici). */
(function(){
"use strict";
const T=window.THREE;
const lam=(c,o)=>new T.MeshLambertMaterial(Object.assign({color:c},o||{}));
const flat=(c,o)=>new T.MeshLambertMaterial(Object.assign({color:c,flatShading:true},o||{}));
const M={wall:lam("#e9dfc8"),base:lam("#8d8a86"),trim:lam("#4b5270"),roof:lam("#b5432c"),roofE:lam("#8f3220"),door:lam("#a8652f"),doorD:lam("#7c4720"),frame:lam("#f6f2e8"),
 glass:lam("#8cc6ea",{emissive:"#2a5f86",emissiveIntensity:.35}),slab:lam("#c9c5ba"),path:lam("#d8d3c6"),brick:lam("#9c4a33"),metal:lam("#23252b"),
 lantern:lam("#fff0b8",{emissive:"#ffcf5a",emissiveIntensity:1}),fence:lam("#f7f4ec"),wood:lam("#8a5a34"),leaf:flat("#3f9a42"),leafD:flat("#2f7d3a"),trunk:lam("#c0622c"),
 f1:flat("#ef4b4b"),f2:flat("#f7b92d"),f3:flat("#ffffff"),skin:flat("#ecbd94"),hair:flat("#5b3620"),jacket:lam("#2f4aa8"),jacket2:lam("#c6ff3d"),pants:lam("#20232c"),shoe:lam("#14151a"),eye:lam("#17181c"),gold:lam("#f5c431")};
const W=4.8,D=3.9,WH=2.35,RH=1.55;   // půdorys, výška zdi, výška štítu
const H={group:null,parts:[],T0:-1,ms:3200,man:null,W,D};
const box=(G,w,h,d,x,y,z,mat,ry)=>{const m=new T.Mesh(new T.BoxGeometry(w,h,d),mat);m.position.set(x,y+h/2,z);if(ry)m.rotation.y=ry;m.castShadow=m.receiveShadow=true;G.add(m);return m};
const blob=(G,r,x,y,z,mat,sy)=>{const m=new T.Mesh(new T.IcosahedronGeometry(r,0),mat);m.position.set(x,y,z);m.scale.y=sy||1;m.rotation.set(x*3,z*5,x+z);m.castShadow=true;G.add(m);return m};
// díl: skupina s počátkem na zemi; at = kdy naskočí (0–1 doby stavby), drop = z jaké výšky spadne
function part(at,drop,fn,o){const g=new T.Group();fn(g);g.visible=false;H.group.add(g);H.parts.push(Object.assign({g,at,drop:drop||0,dur:360,base:g.position.clone()},o||{}));return g}
function gable(w,h,len){const s=new T.Shape();s.moveTo(-w/2,0);s.lineTo(w/2,0);s.lineTo(0,h);s.closePath();const geo=new T.ExtrudeGeometry(s,{depth:len,bevelEnabled:false});geo.translate(0,0,-len/2);geo.rotateY(Math.PI/2);return geo}
function win(G,x,y,z,w,h,ry){const g=new T.Group();g.position.set(x,y,z);g.rotation.y=ry||0;box(g,w+.22,h+.22,.1,0,-.11,0,M.trim);box(g,w,h,.08,0,0,.04,M.glass);box(g,.07,h,.1,0,0,.05,M.frame);box(g,w,.07,.1,0,h/2-.035,.05,M.frame);box(g,w+.36,.09,.24,0,-.2,.08,M.frame);G.add(g);return g}

H.build=function(o){if(H.group)return H;const G=H.group=new T.Group();G.visible=false;(o.scene||o).add(G);
 // 1 základová deska a chodník k ulici
 part(0,0,g=>{box(g,W+2.6,.1,D+2.6,0,0,.5,M.slab);box(g,W+.3,.22,D+.3,0,.02,0,M.base)},{flat:1,dur:420});
 part(.07,0,g=>{box(g,1.3,.05,1.25,.95,.1,D/2+1.2,M.path)},{flat:1});
 // 2 zdi
 part(.15,5,g=>{box(g,W,WH,D,0,.2,0,M.wall);box(g,W+.08,.3,D+.08,0,.2,0,M.trim)},{dur:420,boom:1});
 // 3 dveře se schodem
 part(.31,0,g=>{box(g,1.14,2.0,.1,.95,.2,D/2+.02,M.trim);box(g,.9,1.82,.1,.95,.24,D/2+.06,M.door);box(g,.62,.5,.04,.95,1.38,D/2+.12,M.doorD);box(g,.62,.62,.04,.95,.5,D/2+.12,M.doorD);
  box(g,.08,.08,.1,1.27,1.1,D/2+.14,M.gold);box(g,1.5,.16,.62,.95,.06,D/2+.36,M.base)});
 // 4 okna: průčelí, boky
 part(.39,0,g=>{win(g,-1.15,1.05,D/2+.02,1.5,1.05)});
 part(.45,0,g=>{win(g,-W/2-.02,1.05,.2,1.3,1.05,-Math.PI/2);win(g,W/2+.02,1.05,.2,1.3,1.05,Math.PI/2)});
 // 5 střecha (hřeben podél průčelí), štíty, komín
 part(.53,6,g=>{const r=new T.Mesh(gable(D+1.1,RH,W+.9),M.roof);r.position.y=WH+.2;r.castShadow=r.receiveShadow=true;g.add(r);
  const e=new T.Mesh(gable(D+1.3,.16,W+1.0),M.roofE);e.position.y=WH+.12;e.castShadow=true;g.add(e)},{dur:440,boom:1});
 part(.65,3,g=>{box(g,.5,1.15,.5,1.35,WH+.75,-.75,M.brick);box(g,.64,.14,.64,1.35,WH+1.9,-.75,M.metal)});
 // 6 lampa u chodníku
 part(.71,0,g=>{box(g,.12,2.9,.12,-.55,.1,D/2+1.5,M.metal);box(g,.7,.1,.1,-.22,2.9,D/2+1.5,M.metal);box(g,.34,.1,.34,.1,2.72,D/2+1.5,M.metal);box(g,.26,.3,.26,.1,2.42,D/2+1.5,M.lantern);
  const l=new T.PointLight("#ffd27a",.0,9);l.position.set(.1,2.4,D/2+1.5);g.add(l);H.lamp=l});
 // 7 plot (dva úseky) – bílé laťky
 const fence=(g,x0,z0,x1,z1)=>{const n=Math.round(Math.hypot(x1-x0,z1-z0)/.36),ry=Math.atan2(x1-x0,z1-z0)+Math.PI/2;for(let i=0;i<=n;i++){const f=i/n;box(g,.14,.74,.06,x0+(x1-x0)*f,.1,z0+(z1-z0)*f,M.fence,ry)}
  for(const y of[.34,.62])box(g,Math.hypot(x1-x0,z1-z0)+.1,.07,.05,(x0+x1)/2,y,(z0+z1)/2,M.fence,ry)};
 part(.79,0,g=>fence(g,-W/2-1.25,D/2+1.75,-.85,D/2+1.75));
 part(.84,0,g=>fence(g,-W/2-1.25,-D/2-.6,-W/2-1.25,D/2+1.75));
 // 8 truhlík s kytkami pod oknem, keře
 part(.9,0,g=>{box(g,1.7,.3,.4,-1.15,.46,D/2+.3,M.wood);for(let i=0;i<6;i++){blob(g,.15,-1.85+i*.28,.9+(i%2)*.06,D/2+.32,[M.f1,M.f2,M.f3][i%3]);blob(g,.12,-1.72+i*.28,.8,D/2+.22,M.leaf)}});
 part(.95,0,g=>{blob(g,.62,W/2+.75,.45,D/2+.55,M.leaf,.85);blob(g,.45,W/2+1.35,.34,D/2+1.0,M.leafD,.85);blob(g,.5,-W/2-.5,.36,-D/2-.2,M.leafD,.8)});
 // okolí (stojí od začátku): pár stromů za domkem a po stranách, ať záběr zblízka není holý trávník
 const dec=H.decor=new T.Group();G.add(dec);const tree=(x,z,s)=>{const g=new T.Group();g.position.set(x,0,z);g.scale.setScalar(s);box(g,.34,1.5,.34,0,0,0,M.trunk);
  const c1=new T.Mesh(new T.ConeGeometry(1.5,2.7,7),M.leafD);c1.position.y=2.5;c1.castShadow=true;g.add(c1);const c2=new T.Mesh(new T.ConeGeometry(1.15,2.3,7),M.leaf);c2.position.y=3.9;c2.castShadow=true;g.add(c2);dec.add(g)};
 [[-5.6,-4.6,1.25],[-2.2,-6.2,1.5],[2.6,-5.6,1.2],[6.2,-3.6,1.45],[-7.6,.2,1.1],[7.6,.8,1.0]].forEach(t=>tree(t[0],t[1],t[2]));
 buildMan();return H};

/* panáček: kostičkové tělo, klouby v kyčlích a ramenou */
function buildMan(){const g=new T.Group();g.visible=false;H.group.add(g);const m=H.man={g,segs:[],x:0,z:0,ry:0,ph:0,wave:0};
 const limb=(x,y,w,h,d,mat,foot)=>{const p=new T.Group();p.position.set(x,y,0);box(p,w,h,d,0,-h,0,mat);if(foot)box(p,w+.02,.12,d+.12,0,-h-.12,.05,M.shoe);g.add(p);return p};
 m.legL=limb(-.15,.72,.22,.6,.24,M.pants,1);m.legR=limb(.15,.72,.22,.6,.24,M.pants,1);
 const body=m.body=new T.Group();g.add(body);box(body,.62,.66,.36,0,.7,0,M.jacket);box(body,.62,.1,.37,0,.7,0,M.jacket2);
 m.armL=limb(-.41,1.33,.18,.56,.2,M.jacket);m.armR=limb(.41,1.33,.18,.56,.2,M.jacket);[m.armL,m.armR].forEach(a=>{const h=new T.Mesh(new T.BoxGeometry(.17,.14,.19),M.skin);h.position.y=-.63;a.add(h)});
 const head=m.head=new T.Group();head.position.y=1.38;g.add(head);const hd=new T.Mesh(new T.IcosahedronGeometry(.3,1),M.skin);hd.position.y=.28;hd.castShadow=true;head.add(hd);
 const hair=new T.Mesh(new T.SphereGeometry(.325,8,5,0,Math.PI*2,0,Math.PI*.5),M.hair);hair.position.y=.3;hair.rotation.x=-.28;hair.castShadow=true;head.add(hair);
 box(head,.07,.09,.04,-.11,.27,.27,M.eye);box(head,.07,.09,.04,.11,.27,.27,M.eye);box(head,.15,.04,.04,0,.11,.275,M.eye);box(head,.05,.04,.04,-.1,.135,.265,M.eye);box(head,.05,.04,.04,.1,.135,.265,M.eye)}   // úsměv: střed a zvednuté koutky

H.place=function(x,z,ry,s){if(!H.group)return;H.group.position.set(x,0,z);H.group.rotation.y=ry||0;H.group.scale.setScalar(s||1);H.group.visible=true};
H.start=function(now,o){o=o||{};H.T0=now;H.ms=o.ms||3200;H.parts.forEach(p=>{p.g.visible=false});if(H.lamp)H.lamp.intensity=0;H.group.visible=true};
H.show=function(){H.T0=-1;H.parts.forEach(p=>{p.g.visible=true;p.g.scale.set(1,1,1);p.g.position.copy(p.base)});if(H.group)H.group.visible=true};
H.hide=function(){if(H.group)H.group.visible=false;if(H.man){H.man.g.visible=false;H.man.segs=[]}};
H.times=function(ms){return H.parts.map(p=>({t:p.at*(ms||H.ms),boom:!!p.boom}))};
// path = body v místních souřadnicích; wave = jak dlouho po dojití mává (ms); face = kam se nakonec otočí
H.walk=function(now,o){const m=H.man;if(!m)return;const P=o.path,L=[];let tot=0;for(let i=1;i<P.length;i++){const l=Math.hypot(P[i][0]-P[i-1][0],P[i][1]-P[i-1][1]);L.push(l);tot+=l}
 m.w={t0:now,ms:o.ms||2400,P,L,tot,wave:o.wave||0,face:o.face||null};m.x=P[0][0];m.z=P[0][1];m.g.position.set(m.x,0,m.z);m.g.visible=true;m.born=now;m.sc=o.scale||1};
const outBack=p=>{const c=1.70158;p=Math.min(1,Math.max(0,p));return 1+(c+1)*Math.pow(p-1,3)+c*Math.pow(p-1,2)};
H.update=function(now){if(!H.group||!H.group.visible)return;
 if(H.T0>=0){let all=true;H.parts.forEach(p=>{const a=(now-H.T0-p.at*H.ms)/p.dur;if(a<=0){p.g.visible=false;all=false;return}p.g.visible=true;
   if(a>=1.6){p.g.scale.set(1,1,1);p.g.position.copy(p.base);return}all=false;const e=outBack(a),q=Math.min(1,a);
   if(p.flat)p.g.scale.set(Math.max(.001,e),1,Math.max(.001,e));else if(p.drop){const sq=a<1?1:1-.1*Math.sin(Math.min(1,(a-1)/.6)*Math.PI);p.g.scale.set(1+(1-sq)*.5,sq,1+(1-sq)*.5);p.g.position.y=p.base.y+Math.pow(1-q,2)*p.drop}
   else{const s=Math.max(.001,e);p.g.scale.set(s,s,s)}});
  if(H.lamp)H.lamp.intensity=Math.min(.9,Math.max(0,(now-H.T0-.74*H.ms)/300));if(all)H.T0=-1}
 const m=H.man;if(m&&m.g.visible&&m.w){const w=m.w,a=Math.min(1,Math.max(0,(now-w.t0)/w.ms)),d=a*w.tot;let k=0,acc=0;while(k<w.L.length-1&&acc+w.L[k]<d){acc+=w.L[k];k++}
  const A=w.P[k],B=w.P[k+1],f=w.L[k]?Math.min(1,(d-acc)/w.L[k]):1;m.x=A[0]+(B[0]-A[0])*f;m.z=A[1]+(B[1]-A[1])*f;let ry=Math.atan2(B[0]-A[0],B[1]-A[1]);
  const pop=outBack((now-m.born)/260)*m.sc;m.g.scale.setScalar(Math.max(.001,pop));
  if(a<1){m.ph=d*4.6;const s=Math.sin(m.ph);m.legL.rotation.x=s*.75;m.legR.rotation.x=-s*.75;m.armL.rotation.x=-s*.6;m.armR.rotation.x=s*.6;m.armR.rotation.z=0;m.g.position.set(m.x,Math.abs(Math.cos(m.ph))*.07,m.z);m.body.rotation.z=s*.04;m.head.rotation.z=-s*.03}
  else{const t=now-w.t0-w.ms;if(w.face)ry=Math.atan2(w.face[0]-m.x,w.face[1]-m.z);const rel=Math.min(1,t/200);m.legL.rotation.x*=1-rel;m.legR.rotation.x*=1-rel;m.armL.rotation.x*=1-rel;m.body.rotation.z=0;m.g.position.set(m.x,0,m.z);
   if(t<w.wave){const up=Math.min(1,t/180);m.armR.rotation.x=0;m.armR.rotation.z=up*(2.55+Math.sin(t/85)*.38);m.head.rotation.z=Math.sin(t/170)*.08}else{m.armR.rotation.z*=.8;m.armR.rotation.x*=1-rel;m.head.rotation.z=0}}
  let dr=ry-m.ry;while(dr>Math.PI)dr-=2*Math.PI;while(dr<-Math.PI)dr+=2*Math.PI;m.ry+=dr*.3;m.g.rotation.y=m.ry}};
const _v=new T.Vector3();
H.pts=function(){if(!H.group||!H.group.visible)return null;const o={};_v.set(0,WH+RH+.6,0);H.group.localToWorld(_v);o.house={x:_v.x,y:_v.y,z:_v.z};_v.set(.95,2.6,D/2);H.group.localToWorld(_v);o.door={x:_v.x,y:_v.y,z:_v.z};
 const m=H.man;if(m&&m.g.visible){_v.set(m.x,2.15*(m.sc||1),m.z);H.group.localToWorld(_v);o.man={x:_v.x,y:_v.y,z:_v.z};_v.set(m.x,1.0,m.z);H.group.localToWorld(_v);o.body={x:_v.x,y:_v.y,z:_v.z}}return o};
window.HERO=H;
})();
