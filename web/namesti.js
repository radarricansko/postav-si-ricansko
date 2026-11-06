/* Náměstí sjednocení – gotická katedrála, renesanční domy s podloubím, alej, socha 52 mečů s erby.
   Použití: NAMESTI.build({scene,x,z,towns:[jména],signTex}) ; NAMESTI.setPlaque(jméno, textura, šedě) ; NAMESTI.update(now) */
(function(){
"use strict";
const T=window.THREE;
const H=20,HZ=36;           // poloosy oválu náměstí (x, z); domek ≈ 4
const N={group:null,plaques:{},figure:null,H,HZ};
const lam=(c,o)=>new T.MeshLambertMaterial(Object.assign({color:c},o||{}));
const M={
 stone:lam("#d6d0c0"),stoneD:lam("#b5ae9d"),stoneL:lam("#ebe6d8"),granite:lam("#4f5363"),
 roof:lam("#3d4658"),roofG:lam("#4f8470"),tile:lam("#b7452f"),tile2:lam("#a63d2a"),
 glass:lam("#223a7c",{emissive:"#15306a",emissiveIntensity:.45}),rose:lam("#7a2fa8",{emissive:"#55208a",emissiveIntensity:.6}),
 gold:new T.MeshStandardMaterial({color:"#f5c431",metalness:.7,roughness:.28,emissive:"#5e4300",emissiveIntensity:.3}),
 goldD:new T.MeshStandardMaterial({color:"#c9971c",metalness:.7,roughness:.35}),
 dark:lam("#2b2a2e"),wood:lam("#6b4a2e"),lawn:lam("#8fbd5f",{polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}),
 water:lam("#4aa5d8",{transparent:true,opacity:.85}),rim:lam("#a99d85",{polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3}),
 plaza:null,
};
const PASTEL=["#f2d9a6","#e9c9c0","#cfe0c2","#f6e3b4","#d9d6ea","#f0cfa0","#e3d8c4","#cfdde8","#f3e0d0","#dbe6b8"];
function tex(w,h,fn){const c=document.createElement("canvas");c.width=w;c.height=h;fn(c.getContext("2d"),w,h);const t=new T.CanvasTexture(c);t.anisotropy=8;t.wrapS=t.wrapT=T.RepeatWrapping;return t}
M.plaza=lam("#ffffff",{polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3});
M.plaza.map=tex(256,256,(g,w,h)=>{g.fillStyle="#cdbfa3";g.fillRect(0,0,w,h);for(let y=0;y<h;y+=16)for(let x=0;x<w;x+=16){const v=200+Math.random()*30;g.fillStyle=`rgb(${v},${v-14},${v-40})`;g.fillRect(x+1,y+1,14,14)}
 // kruhový vzor
 g.strokeStyle="rgba(90,60,30,.16)";g.lineWidth=2;g.beginPath();g.arc(w/2,h/2,w*.38,0,7);g.stroke()});M.plaza.map.repeat.set(14,14);
const mesh=(geo,mat,x,y,z,ry)=>{const m=new T.Mesh(geo,mat);m.position.set(x,y,z);if(ry)m.rotation.y=ry;m.castShadow=m.receiveShadow=true;return m};
const box=(G,w,h,d,x,y,z,mat,ry)=>{const m=mesh(new T.BoxGeometry(w,h,d),mat,x,y+h/2,z,ry);G.add(m);return m};
const prism=(G,w,h,d,x,y,z,mat,ry)=>{// sedlová střecha jako trojboký hranol (podél osy z)
 const s=new T.Shape();s.moveTo(-w/2,0);s.lineTo(w/2,0);s.lineTo(0,h);s.closePath();const g=new T.ExtrudeGeometry(s,{depth:d,bevelEnabled:false});g.translate(0,0,-d/2);const m=mesh(g,mat,x,y,z,ry);G.add(m);return m};
const lancetGeo={};const lancet=(G,w,h,x,y,z,ry,mat)=>{// lomené okno: jeden vytažený tvar (obdélník + lomený oblouk)
 const k=w+"x"+h;let g=lancetGeo[k];if(!g){const sh=new T.Shape();sh.moveTo(-w/2,0);sh.lineTo(w/2,0);sh.lineTo(w/2,h);sh.quadraticCurveTo(w/2,h+w*.55,0,h+w*.8);sh.quadraticCurveTo(-w/2,h+w*.55,-w/2,h);sh.closePath();g=lancetGeo[k]=new T.ExtrudeGeometry(sh,{depth:.14,bevelEnabled:false});g.translate(0,0,-.07)}
 const m=mesh(g,mat||M.glass,x,y,z,ry||0);m.castShadow=false;G.add(m);return m};

/* ---------- gotická katedrála ---------- */
function cathedral(){const G=new T.Group();const L=22,W=9,HH=13;// loď
 box(G,W,HH,L,0,0,0,M.stone);
 // boční lodě (nižší)
 [-1,1].forEach(s=>{box(G,3.2,HH*.55,L-2,s*(W/2+1.6),0,0,M.stone);const r=prism(G,3.6,1.6,L-2,s*(W/2+1.6)+ (s>0?-1.8:1.8),HH*.55,0,M.roof);r.scale.x=1;});
 // střecha lodi
 prism(G,W+.6,6.5,L+.4,0,HH,0,M.roof);
 // hřebenové ozdoby
 for(let i=-4;i<=4;i++){const f=new T.Mesh(new T.ConeGeometry(.16,.9,4),M.goldD);f.position.set(0,HH+6.5+.45,i*2.4);G.add(f)}
 // apsida s věncem kaplí
 const aps=mesh(new T.CylinderGeometry(W/2,W/2,HH,10,1,false,0,Math.PI),M.stone,0,HH/2,L/2);aps.rotation.y=Math.PI;G.add(aps);
 const apsR=new T.Mesh(new T.ConeGeometry(W/2+.3,4.5,10,1,false,0,Math.PI),M.roof);apsR.position.set(0,HH+2.25,L/2);apsR.rotation.y=Math.PI;apsR.castShadow=true;G.add(apsR);
 for(let k=0;k<5;k++){const a=Math.PI+(k+.5)/5*Math.PI;const x=Math.cos(a)*(W/2+1.3),z=L/2+Math.sin(a)*(W/2+1.3)*-1;box(G,2,HH*.5,2,x,0,z,M.stoneD,-a);const c=new T.Mesh(new T.ConeGeometry(1.4,2,4),M.roof);c.rotation.y=Math.PI/4-a;c.position.set(x,HH*.5+1,z);G.add(c)}
 // opěrné pilíře + oblouky (opěrný systém) + fiály
 for(let i=-4;i<=4;i++){const z=i*2.5;[-1,1].forEach(s=>{const px=s*(W/2+3.6);box(G,.9,HH*.7,1.1,px,0,z,M.stoneD);
  const fi=new T.Mesh(new T.ConeGeometry(.42,2.2,4),M.stoneD);fi.rotation.y=Math.PI/4;fi.position.set(px,HH*.7+1.1,z);G.add(fi);
  // opěrný oblouk: šikmý trám od pilíře ke zdi lodi
  const arc=mesh(new T.BoxGeometry(3.4,.5,.6),M.stoneD,s*(W/2+1.9),HH*.78,z);arc.rotation.z=s*-.42;G.add(arc);
  const arc2=mesh(new T.BoxGeometry(3,.4,.5),M.stoneD,s*(W/2+2.1),HH*.62,z);arc2.rotation.z=s*-.42;G.add(arc2);
  // vysoká lomená okna lodi (horní řada) + boční lodě
  lancet(G,1.1,4.6,s*(W/2+.03),HH*.58,z,s>0?Math.PI/2:-Math.PI/2);
  lancet(G,.9,3,s*(W/2+3.23),1.6,z,s>0?Math.PI/2:-Math.PI/2)})}
 // průčelí: dvě věže
 const TW=4,TH=24;[-1,1].forEach(s=>{const x=s*(W/2-.4);const zf=-L/2-1.4;box(G,TW,TH,TW,x,0,zf,M.stoneL);
  for(let k=1;k<5;k++)box(G,TW+.35,.45,TW+.35,x,k*4.6,zf,M.stoneD);
  for(let k=0;k<4;k++)lancet(G,.9,2.6,x,4.5+k*4.6,zf-TW/2-.03,0);
  [-1,1].forEach(q=>{for(let k=0;k<4;k++)lancet(G,.7,2.2,x+q*(TW/2+.03),4.7+k*4.6,zf,q>0?Math.PI/2:-Math.PI/2)});
  // zvonicové patro s otevřenými okny
  for(let k=0;k<2;k++)lancet(G,1.1,3.2,x+k*0,TH-3.8,zf-TW/2-.03,0,M.dark);
  // špice s nárožními fiálami a křížem
  const sp=new T.Mesh(new T.ConeGeometry(TW*.74,11,8),M.roof);sp.position.set(x,TH+5.5,zf);sp.castShadow=true;G.add(sp);
  for(let k=0;k<3;k++){const lk=new T.Mesh(new T.ConeGeometry(.5,1.2,4),M.roof);lk.position.set(x+Math.cos(k*2.1)*TW*.46,TH+5+k*.1,zf+Math.sin(k*2.1)*TW*.46);G.add(lk)}
  for(let a=0;a<4;a++){const px=x+Math.cos(a*Math.PI/2+Math.PI/4)*TW*.66,pz=zf+Math.sin(a*Math.PI/2+Math.PI/4)*TW*.66;const f=new T.Mesh(new T.ConeGeometry(.3,2.6,4),M.stoneD);f.position.set(px,TH+1.3,pz);G.add(f)}
  const cr=new T.Mesh(new T.BoxGeometry(.14,1.6,.14),M.gold);cr.position.set(x,TH+11+.8,zf);G.add(cr);const cb=new T.Mesh(new T.BoxGeometry(.9,.14,.14),M.gold);cb.position.set(x,TH+11+1.05,zf);G.add(cb)});
 // střední štít s rozetou, trojitý portál, galerie
 const zf=-L/2-1.2;box(G,W-3.4,HH+5,1.4,0,0,zf,M.stoneL);
 prism(G,W-3.2,3.6,1.6,0,HH+5,zf,M.stoneL);
 const rose=new T.Mesh(new T.CylinderGeometry(2.1,2.1,.2,32),M.rose);rose.rotation.x=Math.PI/2;rose.position.set(0,HH*.78,zf-.75);G.add(rose);
 const rim=new T.Mesh(new T.TorusGeometry(2.2,.16,8,32),M.stoneD);rim.position.set(0,HH*.78,zf-.78);G.add(rim);
 for(let k=0;k<12;k++){const sp=new T.Mesh(new T.BoxGeometry(.1,4.1,.12),M.stoneD);sp.position.set(0,HH*.78,zf-.82);sp.rotation.z=k*Math.PI/12;G.add(sp)}
 const inner=new T.Mesh(new T.TorusGeometry(1,.1,6,24),M.stoneD);inner.position.set(0,HH*.78,zf-.84);G.add(inner);
 // galerie soch nad portály
 for(let k=-3;k<=3;k++){const st=mesh(new T.CylinderGeometry(.22,.3,1.5,6),M.stoneD,k*.72,HH*.38+.75,zf-.78);G.add(st);const hd=new T.Mesh(new T.SphereGeometry(.2,8,6),M.stoneD);hd.position.set(k*.72,HH*.38+1.65,zf-.78);G.add(hd)}
 box(G,W-3.2,.25,.5,0,HH*.38-.1,zf-.75,M.stoneD);
 // trojitý ústupkový portál
 [[0,2.4,4.2],[-2.1,1.4,2.8],[2.1,1.4,2.8]].forEach(([x,w,h])=>{const p=mesh(new T.BoxGeometry(w,h,.5),M.dark,x,h/2,zf-.8);G.add(p);
  for(let k=0;k<3;k++){const arc=new T.Mesh(new T.TorusGeometry(w/2+k*.25,.12,8,16,Math.PI),M.stoneD);arc.position.set(x,h-w/2+.1,zf-.78+k*.03);G.add(arc)}
  const tip=new T.Mesh(new T.ConeGeometry(w/2+.8,w*.6,4),M.stoneL);tip.rotation.y=Math.PI/4;tip.scale.set(1,1,.28/(w/2+.8));tip.position.set(x,h+w*.3+.3,zf-.72);G.add(tip)});
 // sanktusník nad křížením
 const sank=new T.Mesh(new T.ConeGeometry(.7,7,6),M.roofG);sank.position.set(0,HH+6.5+3,L/2-6);G.add(sank);const sb=new T.Mesh(new T.CylinderGeometry(.6,.6,2,6),M.roof);sb.position.set(0,HH+6.5,L/2-6);G.add(sb);
 // schody
 for(let k=0;k<4;k++)box(G,W+6-k*.5,.22,1.3-k*.25,0,k*.22,zf-2.3-k*.5,M.stoneD);
 G.traverse(m=>{if(m.isMesh){m.castShadow=true;m.receiveShadow=true}});return G}

/* ---------- renesanční měšťanský dům s podloubím ---------- */
function townhouse(i,w){const G=new T.Group();const d=5.5,h=4.6+(i%3)*.4;const col=lam(PASTEL[i%PASTEL.length]);const trim=M.stoneL;
 // patra nad podloubím
 box(G,w,h-2.2,d,0,2.2,0,col);
 // podloubí: pilíře + stín uvnitř + oblouky
 box(G,w-.4,2.1,d-1.4,0,0,.7,lam("#5b5248"));const na=Math.max(1,Math.round(w/2.4));
 for(let k=0;k<=na;k++){const x=-w/2+k*(w/na);box(G,.5,2.2,.6,x,0,-d/2+.3,trim);box(G,.7,.2,.8,x,2,-d/2+.3,M.stoneD)}
 for(let k=0;k<na;k++){const x=-w/2+(k+.5)*(w/na);const arc=new T.Mesh(new T.TorusGeometry((w/na)/2-.25,.1,6,14,Math.PI),trim);arc.position.set(x,1.75,-d/2+.02);G.add(arc)}
 box(G,w,.25,d+.25,0,2.2,0,trim);
 // okna
 const rows=Math.max(1,Math.floor((h-2.2)/1.6));for(let r=0;r<rows;r++)for(let k=0;k<na;k++){const x=-w/2+(k+.5)*(w/na);const win=mesh(new T.BoxGeometry(.6,.9,.1),M.glass,x,3+r*1.6,-d/2-.02);G.add(win);box(G,.85,.1,.2,x,3+r*1.6-.55,-d/2-.08,trim)}
 // sgrafito pás
 box(G,w,.35,d+.1,0,h-.45,0,lam("#c9b48a"));
 // střecha + štít (renesanční: stupňovitý nebo volutový)
 const kind=i%3;
 if(kind===0){// sedlová střecha s čelním stupňovitým štítem
  prism(G,w,2.2,d,0,h,0,M.tile);for(let k=0;k<3;k++)box(G,w-k*(w/3.5),.6,.4,0,h+k*.6,-d/2-.2,col)}
 else if(kind===1){// volutový štít + valba
  prism(G,w,2.1,d,0,h,0,M.tile2);box(G,w*.7,1,.4,0,h,-d/2-.2,col);box(G,w*.4,.8,.4,0,h+1,-d/2-.2,col);const ball=new T.Mesh(new T.SphereGeometry(.22,8,6),trim);ball.position.set(0,h+2,-d/2-.2);G.add(ball)}
 else{// atika s cimbuřím (renesanční „lunetová“ atika)
  box(G,w,.8,d,0,h,0,col);for(let k=0;k<na*2;k++){const x=-w/2+(k+.5)*(w/(na*2));const lun=new T.Mesh(new T.CylinderGeometry(w/(na*2)/2-.1,w/(na*2)/2-.1,.3,10,1,false,0,Math.PI),trim);lun.rotation.x=Math.PI/2;lun.rotation.z=Math.PI/2;lun.position.set(x,h+.8,-d/2-.1);G.add(lun)}
  const rf=mesh(new T.BoxGeometry(w-.6,.5,d-.6),M.tile,0,h+1,0);G.add(rf)}
 // komín
 box(G,.45,1.1,.45,w/2-.8,h+.9,1.1,M.stoneD);
 G.traverse(m=>{if(m.isMesh){m.castShadow=true;m.receiveShadow=true}});return G}

/* ---------- socha sjednocení: 52 mečů ---------- */
function statue(towns){const G=new T.Group();
 [[8.2,.5],[7.0,.5],[5.9,.6]].forEach(([r,h],i)=>{const m=mesh(new T.CylinderGeometry(r,r+.25,h,48),i===2?M.granite:M.stoneD,0,i*.5+h/2,0);G.add(m)});
 // prstenec erbů
 const n=towns.length;const ring=new T.Group();ring.position.y=1.6;G.add(ring);
 towns.forEach((t,i)=>{const a=i/n*Math.PI*2,r=6.2;const ped=mesh(new T.BoxGeometry(.95,1.2,.5),M.granite,Math.cos(a)*r,.6,Math.sin(a)*r,-a+Math.PI/2);ring.add(ped);
  const pl=new T.Mesh(new T.PlaneGeometry(.8,.95),new T.MeshLambertMaterial({color:"#7a7a7a",transparent:true}));pl.position.set(Math.cos(a)*(r+.27),1.62,Math.sin(a)*(r+.27));pl.rotation.y=-a+Math.PI/2;ring.add(pl);N.plaques[t]=pl;
  const cap=mesh(new T.BoxGeometry(1.05,.12,.6),M.stoneL,Math.cos(a)*r,1.26,Math.sin(a)*r,-a+Math.PI/2);ring.add(cap)});
 // zlaté meče: 52 kusů opřených k sobě, hroty se sbíhají nahoře
 const fig=new T.Group();fig.position.y=1.6;G.add(fig);N.figure=fig;
 const base=mesh(new T.CylinderGeometry(3.3,3.6,.6,32),M.goldD,0,.3,0);fig.add(base);
 const SW=towns.length||52;const bl=new T.ConeGeometry(.17,7.2,4);bl.scale(1,1,.3);const gd=new T.BoxGeometry(.9,.12,.14);const pm=new T.SphereGeometry(.14,8,6);
 for(let k=0;k<SW;k++){const a=k/SW*Math.PI*2;const r0=3.0;const s=new T.Group();s.position.set(Math.cos(a)*r0,.6,Math.sin(a)*r0);
  // čepel nakloněná ke středu: pata na obvodu, hrot u osy ve výšce ~7
  const blade=new T.Mesh(bl,M.gold);blade.position.y=3.6;s.add(blade);const guard=new T.Mesh(gd,M.goldD);guard.position.y=1.1;s.add(guard);const pom=new T.Mesh(pm,M.goldD);pom.position.y=.2;s.add(pom);
  s.rotation.y=-a;
  // naklonit ke středu: osa kolmá na směr k ose
  const tilt=Math.atan2(r0-.3,7.0);const axis=new T.Vector3(-Math.sin(a),0,Math.cos(a));s.rotateOnWorldAxis(axis,-tilt);
  s.traverse(m=>{if(m.isMesh)m.castShadow=true});fig.add(s)}
 // uzel nahoře: koule + plamen
 const knot=mesh(new T.SphereGeometry(.9,20,14),M.gold,0,7.5,0);fig.add(knot);const ring2=mesh(new T.TorusGeometry(1.3,.14,8,32),M.gold,0,7.5,0);ring2.rotation.x=Math.PI/2;fig.add(ring2);
 const flame=new T.Mesh(new T.ConeGeometry(.5,1.6,8),new T.MeshStandardMaterial({color:"#ffd86a",emissive:"#ff9a1f",emissiveIntensity:.9,roughness:.6}));flame.position.y=9.1;fig.add(flame);N.flame=flame;
 const lt=new T.PointLight("#ffd36a",.9,34);lt.position.y=8;fig.add(lt);
 G.traverse(m=>{if(m.isMesh){m.castShadow=true;m.receiveShadow=true}});return G}

/* ---------- celé náměstí ---------- */
const apronTex=(()=>{const c=document.createElement("canvas");c.width=c.height=256;const g=c.getContext("2d");const r=g.createRadialGradient(128,128,0,128,128,128);r.addColorStop(0,"rgba(255,255,255,1)");r.addColorStop(.7,"rgba(255,255,255,1)");r.addColorStop(1,"rgba(255,255,255,0)");g.fillStyle=r;g.fillRect(0,0,256,256);return new T.CanvasTexture(c)})();
function plaza(opts){const G=new T.Group();const P=window.MODELS&&window.MODELS.p;
 // kulatý trávníkový podklad s měkkým okrajem (jako u obcí) + dlážděný kruh pod domy
 const ell=(a,b,n=72)=>{const sh=new T.Shape();for(let i=0;i<=n;i++){const t=i/n*Math.PI*2;const x=Math.cos(t)*a,y=Math.sin(t)*b;i?sh.lineTo(x,y):sh.moveTo(x,y)}return sh};
 const flat=(shape,mat,y)=>{const m=new T.Mesh(new T.ShapeGeometry(shape,1),mat);m.rotation.x=-Math.PI/2;m.position.y=y;m.receiveShadow=true;return m};
 const apron=flat(ell(H*1.9,HZ*1.55),new T.MeshLambertMaterial({color:"#93c063",alphaMap:apronTex,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}),.04);G.add(apron);
 const disc=flat(ell(H*1.45,HZ*1.22),M.plaza,.08);G.add(disc);
 const base=flat(ell(H+1,HZ+1),M.plaza,.1);G.add(base);
 // obruba oválu
 const rimS=ell(H+.9,HZ+.9);rimS.holes.push(ell(H+.1,HZ+.1));const rim=new T.Mesh(new T.ExtrudeGeometry(rimS,{depth:.28,bevelEnabled:false}),M.rim);rim.rotation.x=-Math.PI/2;rim.position.y=0;rim.castShadow=true;G.add(rim);
 // katedrála na severu (čelem k jihu), socha na jihu (naproti)
 const cs=opts.cathedralScale||1;const cat=cathedral();cat.scale.setScalar(cs);cat.position.set(0,0,-HZ+12*cs);cat.rotation.y=Math.PI;G.add(cat);
 const st=statue(opts.towns);st.position.set(0,0,HZ-14);G.add(st);
 // renesanční domy po východní a západní straně (čelem do náměstí) + jižní strana s mezerou pro vstup
 // domy po obvodu oválu (mimo severní konec s katedrálou a jižní vstup), čelem do náměstí
 let i=0;const A=H+3.6,Bz=HZ+3.6;const per=[];const nseg=160;let acc=0,prev=null;for(let k=0;k<=nseg;k++){const t=k/nseg*Math.PI*2;const p=[Math.cos(t)*A,Math.sin(t)*Bz];if(prev)acc+=Math.hypot(p[0]-prev[0],p[1]-prev[1]);per.push({t,x:p[0],z:p[1],s:acc});prev=p}
 const total=acc;let sPos=0;while(sPos<total){const w=4.2+((i*7)%3)*.9;const sMid=sPos+w/2;const q=per.find(e=>e.s>=sMid)||per[per.length-1];const t=q.t;const ang=Math.atan2(Math.sin(t)*Bz,Math.cos(t)*A);
  const skipN=q.z<-HZ*.45;const skipS=q.z>HZ*.55&&Math.abs(q.x)<H*.35;const skipE=Math.abs(q.z)<4&&q.x>0; // vstupy: jih a východ
  if(!skipN&&!skipS&&!skipE){const hse=townhouse(i++,w);hse.position.set(q.x,0,q.z);hse.rotation.y=Math.atan2(-q.x,-q.z)+Math.PI;G.add(hse)}sPos+=w+.35}
 // alej: dvojité řady stromů podél východní a západní strany + lampy
 if(P&&P.tree){for(let z=-HZ+30;z<=HZ-20;z+=4.2){[-1,1].forEach(s=>{[H-3,H-6].forEach(off=>{const t=new T.Mesh(P.tree.geo,P.tree.mat);t.scale.setScalar(3.6+((z*7)%3)*.25);t.position.set(s*off,0,z);t.castShadow=true;G.add(t)})})}}
 for(let z=-HZ+30;z<=HZ-20;z+=4.2){[-1,1].forEach(s=>{const lawn=new T.Mesh(new T.PlaneGeometry(3.6,4),M.lawn);lawn.rotation.x=-Math.PI/2;lawn.position.set(s*(H-4.5),.14,z);G.add(lawn)})}
 if(P&&P.lamp){for(let z=-HZ+28;z<=HZ-20;z+=6){[-1,1].forEach(s=>{const l=new T.Mesh(P.lamp.geo,P.lamp.mat);l.scale.setScalar(3);l.position.set(s*(H-8.5),0,z);l.castShadow=true;G.add(l)})}}
 // lavičky u aleje
 for(let z=-HZ+32;z<=HZ-20;z+=8.4){[-1,1].forEach(s=>{box(G,1.8,.12,.5,s*(H-8),.5,z,M.wood);box(G,1.8,.5,.12,s*(H-8),.5,z-.2,M.wood);[-.7,.7].forEach(o=>box(G,.1,.5,.5,s*(H-8)+o,0,z,M.dark))})}
 // fontány mezi sochou a katedrálou
 [[-8,4],[8,4]].forEach(([x,z])=>{const b=mesh(new T.CylinderGeometry(2.3,2.5,.55,28),M.stoneD,x,.28,z);G.add(b);const w=new T.Mesh(new T.CircleGeometry(2.05,28),M.water);w.rotation.x=-Math.PI/2;w.position.set(x,.58,z);G.add(w);const j=mesh(new T.CylinderGeometry(.14,.2,1.8,8),M.stoneL,x,1.4,z);G.add(j);const bowl=mesh(new T.CylinderGeometry(.8,.5,.3,12),M.stoneL,x,2.2,z);G.add(bowl)});
 // květináče u portálu
 if(P&&P.planter){[-4,4].forEach(x=>{const p=new T.Mesh(P.planter.geo,P.planter.mat);p.scale.setScalar(3);p.position.set(x,0,-HZ+12*cs+12*cs);G.add(p)})}
 // cedule u vstupů
 if(opts.signTex){[[0,HZ+1.2,Math.PI],[H+1.2,0,-Math.PI/2]].forEach(([x,z,ry])=>{const s=new T.Mesh(new T.PlaneGeometry(5,1.3),new T.MeshBasicMaterial({map:opts.signTex,transparent:true}));s.position.set(x,2.3,z);s.rotation.y=ry;G.add(s);const p=mesh(new T.CylinderGeometry(.08,.08,2.3,6),M.granite,x,1.15,z);G.add(p)})}
 return G}

N.build=function(opts){if(N.group&&N.group.parent)N.group.parent.remove(N.group);N.plaques={};const G=plaza(opts);G.position.set(opts.x||0,0,opts.z||0);G.scale.setScalar(opts.scale||1);N.scale=opts.scale||1;opts.scene.add(G);N.group=G;return G};
N.setPlaque=function(name,texture,gray){const pl=N.plaques[name];if(!pl)return;pl.material.map=texture;pl.material.color.set(gray?"#8a8a8a":"#ffffff");pl.material.needsUpdate=true};
N.update=function(now){if(N.flame)N.flame.scale.setScalar(1+Math.sin(now*.006)*.08)};
window.NAMESTI=N;
})();
