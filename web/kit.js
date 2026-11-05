/* Postav si Říčansko – stavebnice 3D modelů (sdílená katalogem i hrou). Vyžaduje THREE (r128). */
(function(){
"use strict";
const T=THREE;
const KIT={};window.KIT=KIT;

// ---------- data: obce ORP Říčany (Wikidata souřadnice), kostely (Wikipedie) ----------
KIT.OBCE=[
["Říčany",49.9917,14.6543],["Světice",49.9701,14.6659],["Strančice",49.9482,14.6775],["Mukařov",49.9912,14.7416],["Mnichovice",49.9361,14.7091],
["Velké Popovice",49.9221,14.6393],["Kamenice",49.9016,14.5825],["Kostelec nad Černými lesy",49.9941,14.8593],["Ondřejov",49.9047,14.7843],["Kunice",49.9366,14.6716],
["Babice",50.0081,14.7159],["Březí",50.0147,14.6993],["Černé Voděrady",49.9416,14.8068],["Čestlice",50.0026,14.5837],["Dobřejovice",49.9817,14.5783],
["Doubek",50.0177,14.7378],["Herink",49.9669,14.5750],["Hrusice",49.9099,14.7381],["Jevany",49.9706,14.8105],["Kaliště",49.8827,14.7746],
["Klokočná",49.9585,14.7186],["Konojedy",49.9486,14.8513],["Kostelec u Křížků",49.9071,14.5573],["Kozojedy",49.9972,14.8161],["Křenice",50.0311,14.6686],
["Křížkový Újezdec",49.9309,14.5854],["Louňovice",49.9823,14.7618],["Mirošovice",49.9099,14.7113],["Modletice",49.9702,14.5911],["Nučice",49.9556,14.8845],
["Nupaky",49.9940,14.6023],["Oleška",49.9717,14.9167],["Oplany",49.9242,14.8674],["Pětihosty",49.8864,14.7055],["Petříkov",49.9253,14.6170],
["Popovičky",49.9626,14.5979],["Prusice",49.9684,14.8779],["Radějovice",49.9473,14.5648],["Senohraby",49.8955,14.7182],["Sluštice",50.0391,14.6855],
["Struhařov",49.9520,14.7445],["Stříbrná Skalice",49.8977,14.8462],["Sulice",49.9257,14.5567],["Svojetice",49.9715,14.7386],["Štíhlice",50.0056,14.7800],
["Tehov",49.9716,14.6939],["Tehovec",49.9816,14.7304],["Vlkančice",49.9020,14.8972],["Všestary",49.9587,14.6853],["Výžerky",49.9451,14.8834],
["Vyžlovka",49.9847,14.7892],["Zvánovice",49.9320,14.7803]];
// památka v centru obce: [typ, název]
const CH=(n)=>["kostel",n],CP=(n)=>["kaple",n];
KIT.LANDMARKS={
"Říčany":["hrad","Zřícenina hradu Říčany"],"Velké Popovice":["pivovar","Pivovar Velké Popovice"],"Ondřejov":["hvezdarna","Ondřejovská hvězdárna"],
"Kamenice":["stirin","Zámek Štiřín"],"Kunice":["berchtold","Zámek Berchtold"],"Kostelec nad Černými lesy":["kostelec","Zámek Kostelec"],
"Jevany":["rybnik","Jevanské rybníky"],"Vyžlovka":["koupaliste","Koupaliště Vyžlovka"],"Čestlice":["zona","Obchodní zóna Čestlice"],
"Mukařov":CH("Kostel Nanebevzetí Panny Marie"),"Mnichovice":CH("Kostel Narození Panny Marie"),"Strančice":CP("Kaple sv. Anny se studánkou"),
"Senohraby":CP("Kaple sv. Vojtěcha"),"Březí":CH("Kostel sv. Bartoloměje"),"Hrusice":CH("Kostel sv. Václava"),"Konojedy":CH("Kostel sv. Václava"),
"Kostelec u Křížků":CH("Kostel sv. Martina"),"Kozojedy":CH("Kostel sv. Martina"),"Oleška":CH("Kostel Všech svatých"),"Popovičky":CH("Kostel sv. Bartoloměje"),
"Radějovice":CH("Kostel Narození Panny Marie"),"Sluštice":CH("Kostel sv. Jakuba Staršího"),"Stříbrná Skalice":CH("Kostel sv. Jana Nepomuckého"),
"Tehov":CH("Kostel sv. Jana Křtitele")};
KIT.landmarkOf=n=>KIT.LANDMARKS[n]||["kaple","Kaple na návsi"];
// druhé kostely (zobrazí se jako stavba v obci)
KIT.CHURCH_EXTRA={"Říčany":"Kostel sv. Petra a Pavla","Velké Popovice":"Kostel Panny Marie Sněžné","Ondřejov":"Kostel sv. Šimona a Judy","Kamenice":"Kostel sv. Františka Serafinského","Kunice":"Kostel sv. Máří Magdaleny","Kostelec nad Černými lesy":"Kostel sv. Andělů Strážných","Jevany":"Kostel sv. Jiří (Aldašín)","Čestlice":"Kostel sv. Prokopa"};
KIT.TIERS=[{n:"dřevěný",min:5,c:"#9a6534"},{n:"stříbrný",min:20,c:"#c3cbd6"},{n:"zlatý",min:50,c:"#e8b630"},{n:"platinový",min:100,c:"#dfe6ff"}];
KIT.tierOf=n=>n>=100?3:n>=50?2:n>=20?1:0;
KIT.BUILD_TYPES={hospoda:["Hospoda",150],vecerka:["Večerka",150],kavarna:["Kavárna",150],kebab:["Kebab",150],hriste:["Hřiště",250],posilovna:["Posilovna",250],skatepark:["Skatepark",500],kino:["Kino",500],bazen:["Koupaliště",500],rozhledna:["Rozhledna",1000],sidliste:["Sídliště",1500]};

// ---------- materials & textures ----------
const matCache={};
KIT.mat=(c,opt)=>{const k=c+(opt?JSON.stringify(opt):"");return matCache[k]||(matCache[k]=new T.MeshLambertMaterial(Object.assign({color:c},opt||{})))};
KIT.basic=c=>matCache["b"+c]||(matCache["b"+c]=new T.MeshBasicMaterial({color:c}));
function ctex(w,h,draw,rx,ry){const c=document.createElement("canvas");c.width=w;c.height=h;draw(c.getContext("2d"),w,h);const t=new T.CanvasTexture(c);t.wrapS=t.wrapT=T.RepeatWrapping;if(rx)t.repeat.set(rx,ry||rx);return t}
let rs=3;const r=()=>{rs=(rs*16807)%2147483647;return (rs-1)/2147483646};
const TX={};KIT.TX=TX;
TX.road=ctex(64,128,(g,w,h)=>{g.fillStyle="#565c68";g.fillRect(0,0,w,h);for(let i=0;i<300;i++){g.fillStyle=`rgba(255,255,255,${r()*.05})`;g.fillRect(r()*w,r()*h,2,2)}g.fillStyle="#eef0f3";g.fillRect(3,0,3,h);g.fillRect(w-6,0,3,h);g.fillStyle="#f6f1dd";g.fillRect(30,0,4,h*.5)});
TX.street=ctex(64,64,(g,w,h)=>{g.fillStyle="#6a707b";g.fillRect(0,0,w,h);for(let i=0;i<200;i++){g.fillStyle=`rgba(255,255,255,${r()*.05})`;g.fillRect(r()*w,r()*h,2,2)}g.fillStyle="#d9d4c7";g.fillRect(0,0,6,h);g.fillRect(w-6,0,6,h)});
TX.d1=ctex(256,128,(g,w,h)=>{g.fillStyle="#7d8b62";g.fillRect(0,0,w,h);g.fillStyle="#4b515c";g.fillRect(8,0,108,h);g.fillRect(140,0,108,h);g.fillStyle="#f0f2f5";[10,112,142,244].forEach(x=>g.fillRect(x,0,3,h));g.fillStyle="#f6f1dd";[46,80,176,210].forEach(x=>g.fillRect(x,0,3,h*.45));g.fillStyle="#b9bcc2";g.fillRect(124,0,8,h)});
TX.ballast=ctex(64,64,(g,w,h)=>{g.fillStyle="#8a8278";g.fillRect(0,0,w,h);for(let i=0;i<500;i++){const v=70+r()*70|0;g.fillStyle=`rgb(${v},${v-6},${v-14})`;g.fillRect(r()*w,r()*h,2,2)}});
TX.cobble=ctex(128,128,(g,w,h)=>{g.fillStyle="#d4c8b2";g.fillRect(0,0,w,h);for(let y=0;y<h;y+=8)for(let x=((y/8)%2)*4;x<w;x+=8){const v=190+r()*30|0;g.fillStyle=`rgb(${v},${v-10},${v-28})`;g.fillRect(x+.5,y+.5,7,7)}},3,2);
TX.sgraffito=ctex(64,64,(g,w,h)=>{g.fillStyle="#f2efe8";g.fillRect(0,0,w,h);g.strokeStyle="#9c958a";g.lineWidth=2;for(let y=-16;y<h+16;y+=16)for(let x=-16;x<w+16;x+=16){g.beginPath();g.moveTo(x,y+8);g.lineTo(x+8,y);g.lineTo(x+16,y+8);g.lineTo(x+8,y+16);g.closePath();g.stroke();g.fillStyle="rgba(150,140,125,.18)";g.beginPath();g.moveTo(x+8,y);g.lineTo(x+16,y+8);g.lineTo(x+8,y+8);g.fill()}},3,2);
TX.brick=ctex(64,64,(g,w,h)=>{g.fillStyle="#d8cfc4";g.fillRect(0,0,w,h);for(let y=0;y<h;y+=8)for(let x=((y/8)%2)*8;x<w+16;x+=16){g.fillStyle=`hsl(${8+r()*8},${50+r()*10}%,${38+r()*8}%)`;g.fillRect(x-16+1,y+1,14,6)}},2,2);
TX.stone=ctex(64,64,(g,w,h)=>{g.fillStyle="#8e877c";g.fillRect(0,0,w,h);for(let i=0;i<60;i++){const v=110+r()*60|0;g.fillStyle=`rgb(${v},${v-6},${v-14})`;g.fillRect(r()*w,r()*h,6+r()*12,4+r()*6)}},2,2);
TX.wood=ctex(32,64,(g,w,h)=>{g.fillStyle="#8a5a33";g.fillRect(0,0,w,h);g.fillStyle="#6e4524";for(let y=0;y<h;y+=8)g.fillRect(0,y,w,2)},1,1);
TX.panel=ctex(128,128,(g,w,h)=>{g.fillStyle="#e9e4da";g.fillRect(0,0,w,h);for(let y=0;y<h;y+=16){g.fillStyle="#d8d1c3";g.fillRect(0,y+14,w,2);for(let x=4;x<w;x+=16){g.fillStyle=r()<.25?"#ffe9a8":"#3d4f66";g.fillRect(x,y+4,9,8)}}},1,1);
TX.pitch=ctex(128,80,(g,w,h)=>{for(let i=0;i<8;i++){g.fillStyle=i%2?"#4fae5c":"#58b968";g.fillRect(i*16,0,16,h)}g.strokeStyle="#fff";g.lineWidth=2;g.strokeRect(4,4,w-8,h-8);g.beginPath();g.moveTo(w/2,4);g.lineTo(w/2,h-4);g.stroke();g.beginPath();g.arc(w/2,h/2,12,0,7);g.stroke();g.strokeRect(4,h/2-16,16,32);g.strokeRect(w-20,h/2-16,16,32)});
TX.glass=null;
KIT.M={glass:new T.MeshLambertMaterial({color:"#8fc4e8",emissive:"#1d3c5c",emissiveIntensity:.35}),win:KIT.mat("#2e3f55"),door:KIT.mat("#6b4a2f"),white:KIT.mat("#f6f4ef"),graph:KIT.mat("#3b4049"),
 wood:new T.MeshLambertMaterial({map:TX.wood}),panel:null,brick:new T.MeshLambertMaterial({map:TX.brick}),stone:new T.MeshLambertMaterial({map:TX.stone}),sgraffito:new T.MeshLambertMaterial({map:TX.sgraffito}),
 cobble:new T.MeshLambertMaterial({map:TX.cobble}),pitch:new T.MeshLambertMaterial({map:TX.pitch}),grass:KIT.mat("#86c062"),water:KIT.mat("#5cb3e8"),sand:KIT.mat("#efdca2"),tile:KIT.mat("#c7553a"),
 copper:KIT.mat("#5fa88d"),metal:KIT.mat("#b9c0ca"),dark:KIT.mat("#2a2f38"),neon:KIT.basic("#5ff2ff"),solar:new T.MeshLambertMaterial({color:"#22355e",emissive:"#0b1a3a",emissiveIntensity:.4})};

// ---------- geometry helpers ----------
const G={};KIT.G=G;
G.box=(w,h,d)=>{const g=new T.BoxGeometry(w,h,d);g.translate(0,h/2,0);return g};
G.prism=(w,h,d,mono)=>{// gable roof along z; base at y=0
  const x=w/2,z=d/2;const pts=mono?[[-x,0],[x,0],[-x,h]]:[[-x,0],[x,0],[0,h]];const s=new T.Shape();s.moveTo(pts[0][0],pts[0][1]);pts.slice(1).forEach(p=>s.lineTo(p[0],p[1]));s.closePath();
  const g=new T.ExtrudeGeometry(s,{depth:d,bevelEnabled:false});g.translate(0,0,-z);return g};
G.hip=(w,h,d)=>{const g=new T.ConeGeometry(Math.SQRT1_2,1,4,1);g.rotateY(Math.PI/4);g.scale(w,h,d);g.translate(0,h/2,0);return g};
G.cyl=(rt,rb,h,s=12)=>{const g=new T.CylinderGeometry(rt,rb,h,s);g.translate(0,h/2,0);return g};
G.cone=(rad,h,s=8)=>{const g=new T.ConeGeometry(rad,h,s);g.translate(0,h/2,0);return g};
G.dome=(rad,s=16)=>new T.SphereGeometry(rad,s,s/2,0,Math.PI*2,0,Math.PI/2);
G.sphere=(rad,s=12)=>new T.SphereGeometry(rad,s,s*.75|0);
const geoCache={};const gc=(k,f)=>geoCache[k]||(geoCache[k]=f());

// A model = list of parts {geo, mat (Material | "ROOF" | "WALL" | "ACC"), m:Matrix4}
function Model(){this.parts=[]}
Model.prototype.add=function(geo,mat,x=0,y=0,z=0,ry=0,sx=1,sy=1,sz=1,rx=0,rz=0){const m=new T.Matrix4().compose(new T.Vector3(x,y,z),new T.Quaternion().setFromEuler(new T.Euler(rx,ry,rz)),new T.Vector3(sx,sy,sz));this.parts.push({geo,mat,m});return this};
KIT.Model=Model;
const WALLS=["#fbf6ec","#f3ead8","#eef2f7","#f7e9dd","#fff8e6","#efe3cf"];KIT.WALLS=WALLS;
function windows(md,w,y,z,n,mat=KIT.M.win,ww=.34,wh=.34){for(let i=0;i<n;i++){const x=-w/2+(i+.5)*w/n;md.add(gc("win"+ww+wh,()=>new T.BoxGeometry(ww,wh,.05)),mat,x,y,z)}}
function windowsSide(md,d,y,x,n,mat=KIT.M.win){for(let i=0;i<n;i++){const z=-d/2+(i+.5)*d/n;md.add(gc("wins",()=>new T.BoxGeometry(.05,.34,.34)),mat,x,y,z)}}

// ---------- merge helpers (model → few draw calls) ----------
function nonIdx(g){g=g.index?g.toNonIndexed():g.clone();if(!g.attributes.normal)g.computeVertexNormals();if(!g.attributes.uv)g.setAttribute("uv",new T.Float32BufferAttribute(new Float32Array(g.attributes.position.count*2),2));return g}
function mergeGeos(list){const gs=list.map(nonIdx);let n=0;gs.forEach(g=>n+=g.attributes.position.count);const pos=new Float32Array(n*3),nor=new Float32Array(n*3),uv=new Float32Array(n*2);let o=0;
  gs.forEach(g=>{pos.set(g.attributes.position.array,o*3);nor.set(g.attributes.normal.array,o*3);uv.set(g.attributes.uv.array,o*2);o+=g.attributes.position.count});
  const m=new T.BufferGeometry();m.setAttribute("position",new T.BufferAttribute(pos,3));m.setAttribute("normal",new T.BufferAttribute(nor,3));m.setAttribute("uv",new T.BufferAttribute(uv,2));m.computeBoundingSphere();return m}
Model.prototype.compile=function(){if(this._c)return this._c;const groups=new Map();this.parts.forEach(p=>{const k=typeof p.mat==="string"?p.mat:p.mat.uuid;if(!groups.has(k))groups.set(k,{mat:p.mat,geos:[]});const g=p.geo.clone();g.applyMatrix4(p.m);groups.get(k).geos.push(g)});
  const out=new Model();groups.forEach(v=>out.parts.push({geo:mergeGeos(v.geos),mat:v.mat,m:new T.Matrix4()}));this._c=out;return out};
Model.prototype.push=function(geo,mat,M){this.parts.push({geo,mat,m:M.clone()});return this};
// box with real-size UVs (textures tile consistently), base at y=0
G.boxU=(w,h,d,unit=1)=>{const g=new T.BoxGeometry(w,h,d);const uv=g.attributes.uv;const dims=[[d,h],[d,h],[w,d],[w,d],[w,h],[w,h]];for(let f=0;f<6;f++)for(let k=0;k<4;k++){const i=f*4+k;uv.setXY(i,uv.getX(i)*dims[f][0]/unit,uv.getY(i)*dims[f][1]/unit)}g.translate(0,h/2,0);return g};
// textures for houses
TX.curtain=ctex(128,128,(g,w,h)=>{const gr=g.createLinearGradient(0,0,0,h);gr.addColorStop(0,"#bfe3f6");gr.addColorStop(.55,"#6fa8cf");gr.addColorStop(1,"#3f6f95");g.fillStyle=gr;g.fillRect(0,0,w,h);
  g.fillStyle="rgba(255,255,255,.18)";g.beginPath();g.moveTo(0,h*.15);g.lineTo(w*.6,0);g.lineTo(w*.9,0);g.lineTo(0,h*.55);g.fill();g.fillStyle="#e9eef3";g.fillRect(0,0,w,4);g.fillRect(0,0,4,h);g.fillRect(w/2-1,0,2,h)});
TX.cladding=ctex(64,64,(g,w,h)=>{for(let x=0;x<w;x+=8){g.fillStyle=`hsl(28,${38+r()*10}%,${40+r()*10}%)`;g.fillRect(x,0,8,h);g.fillStyle="rgba(0,0,0,.25)";g.fillRect(x+7,0,1,h)}});
TX.logs=ctex(64,64,(g,w,h)=>{for(let y=0;y<h;y+=10){g.fillStyle=`hsl(26,${45+r()*10}%,${34+r()*8}%)`;g.fillRect(0,y,w,10);g.fillStyle="rgba(0,0,0,.35)";g.fillRect(0,y+9,w,1);g.fillStyle="rgba(255,255,255,.08)";g.fillRect(0,y+1,w,2)}});
TX.render=ctex(64,64,(g,w,h)=>{g.fillStyle="#ffffff";g.fillRect(0,0,w,h);for(let i=0;i<200;i++){g.fillStyle=`rgba(0,0,0,${r()*.03})`;g.fillRect(r()*w,r()*h,2,2)}});
TX.tiles=ctex(64,64,(g,w,h)=>{g.fillStyle="#ffffff";g.fillRect(0,0,w,h);g.fillStyle="rgba(0,0,0,.16)";for(let y=0;y<h;y+=8){g.fillRect(0,y+7,w,1);for(let x=(y/8%2)*6;x<w;x+=12)g.fillRect(x,y,1,8)}});
const HM={glass:new T.MeshLambertMaterial({map:TX.curtain}),clad:new T.MeshLambertMaterial({map:TX.cladding}),logs:new T.MeshLambertMaterial({map:TX.logs}),frame:KIT.mat("#f4f4f2"),dframe:KIT.mat("#2b3038"),
  pane:new T.MeshLambertMaterial({color:"#3a5878",emissive:"#0d1f33",emissiveIntensity:.3}),sill:KIT.mat("#d9d4c9"),plinth:KIT.mat("#a59e93"),slab:KIT.mat("#f2f1ee"),rail:new T.MeshLambertMaterial({color:"#cfe8f7",transparent:true,opacity:.45}),
  green:KIT.mat("#6fae4f"),chim:KIT.mat("#b4553f"),gutter:KIT.mat("#8a8f97"),door:KIT.mat("#5b3f28"),wdoor:KIT.mat("#3a3f47"),deck:KIT.mat("#b08a5a"),pool:KIT.mat("#4fb6ea"),roofTile:new T.MeshLambertMaterial({map:TX.tiles,color:"#ffffff"})};
KIT.HM=HM;
// ----- assembly helpers (front = +z) -----
const _M=(x,y,z,ry=0,rx=0,rz=0)=>new T.Matrix4().compose(new T.Vector3(x,y,z),new T.Quaternion().setFromEuler(new T.Euler(rx,ry,rz)),new T.Vector3(1,1,1));
function win(md,x,y,z,face,w=.42,h=.5,dark=false,shutter=null){// face: 0:+z 1:-z 2:+x 3:-x ; y = window centre
  const ry=[0,Math.PI,Math.PI/2,-Math.PI/2][face];const R=_M(x,y,z,ry);const f=dark?HM.dframe:HM.frame;
  md.push(new T.BoxGeometry(w+.1,h+.1,.05),f,R.clone().multiply(_M(0,0,.025)));md.push(new T.BoxGeometry(w,h,.06),HM.pane,R.clone().multiply(_M(0,0,.035)));
  md.push(new T.BoxGeometry(w+.18,.06,.14),HM.sill,R.clone().multiply(_M(0,-h/2-.06,.07)));if(!dark)md.push(new T.BoxGeometry(.03,h,.065),f,R.clone().multiply(_M(0,0,.04)));
  if(shutter){[-1,1].forEach(s=>md.push(new T.BoxGeometry(w*.48,h+.06,.04),shutter,R.clone().multiply(_M(s*(w/2+w*.26+.05),0,.03))))}}
function door(md,x,z,face,w=.55,h=1,canopy=true,mat=HM.door){const ry=[0,Math.PI,Math.PI/2,-Math.PI/2][face];const R=_M(x,0,z,ry);
  md.push(new T.BoxGeometry(w+.12,h+.08,.05),HM.frame,R.clone().multiply(_M(0,(h+.08)/2+.18,.025)));md.push(new T.BoxGeometry(w,h,.07),mat,R.clone().multiply(_M(0,h/2+.2,.035)));
  md.push(new T.BoxGeometry(w+.5,.2,.5),HM.sill,R.clone().multiply(_M(0,.1,.25)));if(canopy)md.push(new T.BoxGeometry(w+.5,.07,.55),HM.dframe,R.clone().multiply(_M(0,h+.42,.27)))}
// gable roof: ridge along local Z (span across X); y = eave height; returns roof top y
function gable(md,cx,cz,span,len,h,y,ov,roofMat,wallMat,rotY=0,chim=null){const P=_M(cx,0,cz,rotY);const a=Math.atan2(h,span/2);const sl=Math.hypot(h,span/2)+ov;const t=.14;
  md.push(G.prism(span,h,len),wallMat,P.clone().multiply(_M(0,y,0)));
  [-1,1].forEach(s=>{const mx=s*(span/2+ov*Math.cos(a))/2,my=y+(h-ov*Math.sin(a))/2;md.push(new T.BoxGeometry(sl,t,len+2*ov),roofMat,P.clone().multiply(_M(mx+s*Math.sin(a)*t/2,my+Math.cos(a)*t/2,0,0,0,-s*a)))});
  md.push(new T.BoxGeometry(.18,.16,len+2*ov+.02),HM.gutter,P.clone().multiply(_M(0,y+h+.05,0)));
  [-1,1].forEach(s=>md.push(new T.CylinderGeometry(.05,.05,len+2*ov,6),HM.gutter,P.clone().multiply(_M(s*(span/2+ov*Math.cos(a)),y-ov*Math.sin(a)-.02,0,0,Math.PI/2))));
  if(chim){const [cxo,czo]=chim;const yr=y+h*(1-Math.abs(cxo)/(span/2));md.push(G.boxU(.32,1.1,.32),HM.chim,P.clone().multiply(_M(cxo,yr-.5,czo)));md.push(new T.BoxGeometry(.42,.08,.42),HM.plinth,P.clone().multiply(_M(cxo,yr+.64,czo)))}}
function hip(md,cx,cz,w,d,h,y,ov,roofMat){md.push(G.hip(w+2*ov,h,d+2*ov),roofMat,_M(cx,y,cz));md.push(new T.BoxGeometry(w+2*ov,.1,d+2*ov),HM.gutter,_M(cx,y-.05,cz))}
function flat(md,cx,cz,w,d,y,mat=HM.slab,par=.22){md.push(new T.BoxGeometry(w,.12,d),KIT.mat("#7d8188"),_M(cx,y+.06,cz));[[0,d/2,w,.12],[0,-d/2,w,.12],[w/2,0,.12,d],[-w/2,0,.12,d]].forEach(([x,z,ww,dd])=>md.push(G.boxU(ww,par,dd),mat,_M(cx+x,y,cz+z)))}
function walls(md,w,h,d,mat,x=0,z=0,y=0){md.push(G.boxU(w+.08,.3,d+.08),HM.plinth,_M(x,y,z));md.push(G.boxU(w,h,d),mat,_M(x,y+.3,z))}
const H={};KIT.HOUSES=H;
// ===== DŘEVO – venkovské domky =====
H.d1=()=>{const m=new Model();walls(m,2.6,1.5,3.2,"WALL");gable(m,0,0,2.6,3.2,1.25,1.8,.28,"ROOF","WALL",0,[.5,-.6]);
  door(m,.55,1.6,0);win(m,-.55,1.05,1.6,0,.42,.52,false,"ACC");win(m,0,2.35,1.6,0,.32,.38);win(m,1.3,1.05,-.5,2,.42,.52,false,"ACC");win(m,1.3,1.05,.7,2,.42,.52,false,"ACC");win(m,-1.3,1.05,0,3,.42,.52,false,"ACC");return m};
H.d2=()=>{const m=new Model();walls(m,3,1.5,2.4,HM.logs);gable(m,0,0,2.4,3,1.1,1.8,.35,"ROOF",HM.logs,Math.PI/2,[-.4,.6]);
  m.push(new T.BoxGeometry(3,.14,1.1),HM.deck,_M(0,.3,1.75));[-1.35,0,1.35].forEach(x=>m.push(G.boxU(.12,1.35,.12),HM.door,_M(x,.37,2.2)));m.push(new T.BoxGeometry(3.3,.1,1.3),"ROOF",_M(0,1.82,1.75,0,-.22));
  door(m,0,1.2,0,.55,1,false);win(m,-.95,1.1,1.2,0,.42,.48,false,"ACC");win(m,.95,1.1,1.2,0,.42,.48,false,"ACC");win(m,1.5,1.1,0,2,.42,.48,false,"ACC");return m};
H.d3=()=>{const m=new Model();walls(m,3.6,1.5,2.2,"WALL",0,-.6);walls(m,1.8,1.5,2,"WALL",-.9,1.5);
  gable(m,0,-.6,2.2,3.6,1.1,1.8,.28,"ROOF","WALL",Math.PI/2,[.7,.1]);gable(m,-.9,1.4,1.8,2.2,.9,1.8,.28,"ROOF","WALL",0);
  door(m,.5,.5,0);win(m,1.3,1.05,.5,0);win(m,-.9,1.05,2.5,0,.42,.52,false,"ACC");win(m,-.9,2.25,2.5,0,.28,.34);win(m,1.8,1.05,-.6,2);return m};
// ===== STŘÍBRO – hezčí rodinné domy =====
H.s1=()=>{const m=new Model();walls(m,3,2.8,2.6,"WALL");hip(m,0,0,3,2.6,1.2,3.1,.32,"ROOF");m.push(new T.BoxGeometry(3.06,.1,2.66),HM.sill,_M(0,1.6,0));
  walls(m,1.9,1.5,2.4,HM.slab,2.45,.1);flat(m,2.45,.1,1.9,2.4,1.8,HM.slab,.25);m.push(new T.BoxGeometry(1.5,1.1,.06),KIT.mat("#c9ccd2"),_M(2.45,.85,1.33));for(let i=0;i<4;i++)m.push(new T.BoxGeometry(1.5,.03,.07),KIT.mat("#9aa0a8"),_M(2.45,.45+i*.27,1.34));
  m.push(new T.BoxGeometry(1.9,.06,.1),HM.rail,_M(2.45,2.35,1.3));door(m,-.6,1.3,0);[-.8,.25,1.05].forEach((x,i)=>win(m,x,2.45,1.3,0,.48,.6));win(m,.55,1.05,1.3,0,.7,.6);win(m,-1.5,1.05,0,3);win(m,-1.5,2.45,0,3);return m};
H.s2=()=>{const m=new Model();walls(m,3.6,1.6,2.6,"WALL");gable(m,0,0,2.6,3.6,1.7,1.9,.35,"ROOF","WALL",Math.PI/2,[.6,-1.1]);
  // vikýře (na rovině střechy)
  const a=Math.atan2(1.7,1.3);[-.9,.9].forEach(x=>{const z0=.75,yb=1.9+1.7*(1-z0/1.3);m.push(G.boxU(.8,.75,.9),"WALL",_M(x,yb-.25,z0+.05));m.push(G.prism(1,.42,1.05),"ROOF",_M(x,yb+.5,z0+.05));win(m,x,yb+.15,z0+.51,0,.4,.4)});
  m.push(G.boxU(1.4,1.2,.6),"WALL",_M(1,.3,1.6));m.push(new T.BoxGeometry(1.6,.12,.8),"ROOF",_M(1,1.56,1.6));win(m,1,1,1.91,0,.9,.6);
  door(m,-.7,1.3,0);m.push(G.boxU(.1,1.2,.1),HM.frame,_M(-1.25,.3,1.9));m.push(G.boxU(.1,1.2,.1),HM.frame,_M(-.15,.3,1.9));m.push(new T.BoxGeometry(1.3,.1,.8),"ROOF",_M(-.7,1.55,1.6));
  win(m,-1.8,1.1,0,3);win(m,1.8,1.1,-.5,2);return m};
H.s3=()=>{const m=new Model();walls(m,4.4,2.6,2.6,"WALL");gable(m,0,0,2.6,4.4,1.3,2.9,.3,"ROOF","WALL",Math.PI/2,[-1.4,.1]);
  m.push(G.boxU(.16,3.9,2.7),HM.plinth,_M(0,.3,0));[-1,1].forEach(s=>{door(m,s*1.6,1.3,0);win(m,s*.7,1.15,1.3,0,.6,.6);win(m,s*.7,2.3,1.3,0,.5,.55);win(m,s*1.6,2.3,1.3,0,.5,.55);
    m.push(new T.BoxGeometry(1.2,.06,.7),HM.dframe,_M(s*.7,1.85,1.65));m.push(new T.BoxGeometry(1.2,.4,.04),HM.rail,_M(s*.7,2.1,1.98))});
  return m};
// ===== ZLATO – moderní domy =====
H.z1=()=>{const m=new Model();m.push(G.boxU(4.2,.3,3.4),HM.plinth,_M(.2,0,-.3));
  m.push(G.boxU(3,1.55,2.4,1),HM.glass,_M(-.2,.3,-.4));m.push(G.boxU(1.2,1.55,2.4,1),HM.clad,_M(1.6,.3,-.4));
  m.push(G.boxU(3.6,1.4,2.6),new T.MeshLambertMaterial({map:TX.render}),_M(.35,1.85,.1));m.push(new T.BoxGeometry(3.6,.08,.06),"ACC",_M(.35,1.86,1.43));
  m.push(new T.BoxGeometry(2.4,.9,.06),HM.dframe,_M(.1,2.5,1.42));m.push(new T.BoxGeometry(2.3,.8,.07),HM.pane,_M(.1,2.5,1.43));m.push(new T.BoxGeometry(.06,1.4,.6),HM.dframe,_M(2.16,2.55,1.1));
  flat(m,.35,.1,3.6,2.6,3.25,HM.slab,.18);m.push(new T.BoxGeometry(2.2,.08,1.5),HM.slab,_M(-1.1,1.75,1.35));[-2.1,-.2].forEach(x=>m.push(G.boxU(.08,1.45,.08),HM.dframe,_M(x,.3,2)));
  door(m,1.3,.81,0,.6,1.2,false,HM.wdoor);m.push(new T.BoxGeometry(1.6,.05,1.4),HM.deck,_M(-1.2,.3,1.4));return m};
H.z2=()=>{const m=new Model();m.push(G.boxU(2.9,.3,4.2),HM.plinth,_M(0,0,0));m.push(G.boxU(2.8,1.7,4),HM.clad,_M(0,.3,0));
  const a=Math.atan2(1.6,1.4);m.push(G.prism(2.8,1.6,4),HM.clad,_M(0,2,0));[-1,1].forEach(s=>m.push(new T.BoxGeometry(Math.hypot(1.6,1.4)+.05,.1,4.04),HM.dframe,_M(s*.7+s*Math.sin(a)*.05,2.8+Math.cos(a)*.05,0,0,0,-s*a)));
  // prosklený štít
  m.push(new T.BoxGeometry(2.4,1.5,.05),HM.dframe,_M(0,1.1,2.01));m.push(new T.BoxGeometry(2.3,1.4,.06),HM.pane,_M(0,1.1,2.02));const tri=G.prism(2.2,1.3,.06);m.push(tri,HM.pane,_M(0,2.05,2.0));
  m.push(new T.BoxGeometry(.05,2.8,.08),HM.dframe,_M(0,1.6,2.04));m.push(new T.BoxGeometry(3.2,.1,1.5),HM.deck,_M(0,.3,2.8));win(m,1.41,1.2,-.8,2,.9,.7,true);win(m,1.41,1.2,.9,2,.5,.7,true);
  m.push(G.boxU(.3,.9,.3),HM.dframe,_M(-.6,2.9,-1.2));return m};
H.z3=()=>{const m=new Model();const hs=[2.9,3.3,2.9];for(let i=0;i<3;i++){const x=(i-1)*1.45;m.push(G.boxU(1.4,.3,2.8),HM.plinth,_M(x,0,0));
    m.push(G.boxU(1.4,hs[i],2.6),i===1?HM.clad:new T.MeshLambertMaterial({map:TX.render}),_M(x,.3,0));flat(m,x,0,1.4,2.6,hs[i]+.3,HM.slab,.16);
    door(m,x-.3,1.3,0,.45,1,false,HM.wdoor);m.push(new T.BoxGeometry(.6,.65,.05),HM.dframe,_M(x+.3,.95,1.31));m.push(new T.BoxGeometry(.52,.57,.06),HM.pane,_M(x+.3,.95,1.32));
    m.push(new T.BoxGeometry(1.1,.9,.05),HM.dframe,_M(x,2.2,1.31));m.push(new T.BoxGeometry(1,.8,.06),HM.pane,_M(x,2.2,1.32));m.push(new T.BoxGeometry(1.3,.08,.5),HM.slab,_M(x,1.7,1.55));m.push(new T.BoxGeometry(1.3,.45,.04),HM.rail,_M(x,1.97,1.79));
    m.push(new T.BoxGeometry(.06,hs[i],.06),"ACC",_M(x+.7,.3+hs[i]/2,1.31))}return m};
// ===== PLATINA – skleněné vily a mini mrakodrapy =====
H.p1=()=>{const m=new Model();m.push(new T.BoxGeometry(4.4,.2,4.2),HM.slab,_M(0,.1,.3));
  m.push(G.boxU(3.2,1.5,2.6,1),HM.glass,_M(-.5,.2,0));m.push(G.boxU(.3,1.5,2.6),HM.slab,_M(1.25,.2,0));
  m.push(new T.BoxGeometry(4.2,.22,3.2),HM.slab,_M(.1,1.81,-.1));m.push(new T.BoxGeometry(4.2,.05,.05),"ACC",_M(.1,1.68,1.5));
  m.push(G.boxU(3.4,1.4,2.4,1),HM.glass,_M(.6,1.92,-.4));m.push(new T.BoxGeometry(3.7,.2,2.7),HM.slab,_M(.6,3.43,-.4));m.push(new T.BoxGeometry(3.7,.05,.05),"ACC",_M(.6,3.3,.95));
  m.push(new T.BoxGeometry(1.7,.45,.04),HM.rail,_M(-.95,2.15,1.48));m.push(new T.BoxGeometry(.04,.45,1),HM.rail,_M(-1.98,2.15,1));
  m.push(new T.BoxGeometry(3.7,.4,.04),HM.rail,_M(.6,3.73,.93));m.push(new T.BoxGeometry(2.4,.06,1),HM.pool,_M(-1,.2,1.75));
  m.push(new T.BoxGeometry(.9,.06,.6),KIT.M.solar,_M(1.3,3.62,-.9,0,-.25));return m};
H.p2=()=>{const m=new Model();const F=9,fh=.72;m.push(G.boxU(2.6,1.1,2.6,1),HM.glass,_M(0,0,0));m.push(new T.BoxGeometry(2.8,.18,2.8),HM.slab,_M(0,1.19,0));
  m.push(G.boxU(2,F*fh,2,fh),HM.glass,_M(0,1.28,0));for(let i=1;i<=F;i+=2)m.push(new T.BoxGeometry(2.06,.06,2.06),HM.slab,_M(0,1.28+i*fh,0));
  [[1.02,1.02],[-1.02,1.02],[1.02,-1.02],[-1.02,-1.02]].forEach(([x,z])=>m.push(G.boxU(.12,F*fh,.12),HM.slab,_M(x,1.28,z)));
  const top=1.28+F*fh;m.push(G.boxU(1.4,.9,1.4,.9),HM.glass,_M(0,top,0));m.push(new T.BoxGeometry(2.1,.1,2.1),HM.slab,_M(0,top,0));m.push(new T.BoxGeometry(1.5,.12,1.5),HM.slab,_M(0,top+.9,0));
  m.push(new T.CylinderGeometry(.04,.06,1.6,6),KIT.M.metal,_M(0,top+1.75,0));m.push(new T.SphereGeometry(.09,8,6),"ACC",_M(0,top+2.6,0));
  [[0,1.011],[0,-1.011],[1.011,0],[-1.011,0]].forEach(([x,z],i)=>m.push(new T.BoxGeometry(i<2?1.95:.04,.06,i<2?.04:1.95),"ACC",_M(x,top-.05,z)));
  m.push(new T.BoxGeometry(1.2,.08,.8),HM.slab,_M(0,.95,1.65));[-.5,.5].forEach(x=>m.push(G.boxU(.06,.95,.06),HM.dframe,_M(x,0,1.95)));return m};
H.p3=()=>{const m=new Model();const lv=[[3.6,3.2,0,0],[3,2.6,-.2,-.2],[2.3,2,-.35,-.35],[1.6,1.4,-.4,-.4]];let y=0;
  lv.forEach(([w,d,ox,oz],i)=>{const h=i?1.2:1.4;m.push(G.boxU(w,h,d,1),HM.glass,_M(ox,y,oz));m.push(new T.BoxGeometry(w+.2,.16,d+.2),HM.slab,_M(ox,y+h+.08,oz));m.push(new T.BoxGeometry(w+.2,.04,.04),"ACC",_M(ox,y+h,oz+d/2+.1));
    if(i<lv.length-1){const n=lv[i+1];m.push(new T.BoxGeometry(w-.1,.12,(d-n[1])/2+.05),HM.green,_M(ox,y+h+.2,oz+d/2-((d-n[1])/2+.05)/2));m.push(new T.SphereGeometry(.28,8,6),KIT.mat("#4f9a45"),_M(ox+w/2-.4,y+h+.5,oz+d/2-.35));
      m.push(new T.BoxGeometry(w+.2,.35,.03),HM.rail,_M(ox,y+h+.35,oz+d/2+.1))}y+=h+.16});
  m.push(new T.BoxGeometry(.9,.05,.6),KIT.M.solar,_M(-.4,y+.1,-.4,0,-.25));return m};
KIT.HOUSE_KEYS=[["d1","d2","d3"],["s1","s2","s3"],["z1","z2","z3"],["p1","p2","p3"]];
KIT.HOUSE_NAMES={d1:"Chalupa s okenicemi",d2:"Roubenka se zápražím",d3:"Domek do L",s1:"Patrový dům s garáží",s2:"Vila s vikýři",s3:"Dvojdomek",z1:"Moderní vila s prosklením",z2:"Moderní stodola",z3:"Řadové domy",p1:"Skleněná vila s bazénem",p2:"Mini mrakodrap",p3:"Terasový skleněný dům"};

// build a Group from a Model (for catalog / one-off use)
KIT.groupOf=(md,colors)=>{md=md.compile();const g=new T.Group();colors=colors||{};md.parts.forEach(p=>{let mat=p.mat;if(typeof mat==="string")mat=KIT.mat(mat==="ROOF"?(colors.ROOF||"#d1603f"):mat==="WALL"?(colors.WALL||"#f3ead8"):(colors.ACC||colors.ROOF||"#48b0ff"));
  if(p.mat==="ACC"&&colors.neon)mat=KIT.basic(colors.ROOF||"#5ff2ff");const me=new T.Mesh(p.geo,mat);me.applyMatrix4(p.m);me.castShadow=true;me.receiveShadow=true;g.add(me)});return g};

// ---------- Instanced pool (for game) ----------
KIT.Pool=function(scene,md,cap,neon){md=md.compile();const bb=new T.Box3();md.parts.forEach(p=>{p.geo.computeBoundingBox();bb.union(p.geo.boundingBox)});this.size=bb.getSize(new T.Vector3());this.parts=md.parts.map(p=>{const tinted=typeof p.mat==="string";let mat=tinted?(p.mat==="ACC"&&neon?new T.MeshBasicMaterial({color:"#fff"}):new T.MeshLambertMaterial({color:"#fff"})):p.mat;
  const im=new T.InstancedMesh(p.geo,mat,cap);im.count=0;im.castShadow=true;im.receiveShadow=true;if(tinted)im.instanceColor=new T.InstancedBufferAttribute(new Float32Array(cap*3).fill(1),3);
  im.frustumCulled=false;scene.add(im);return{im,local:p.m,key:p.mat}});this.n=0;this.cap=cap;this.owner=[]};
const _m=new T.Matrix4(),_c=new T.Color();
KIT.Pool.prototype.add=function(world,colors,owner){if(this.n>=this.cap)return -1;const id=this.n++;this.parts.forEach(p=>{_m.multiplyMatrices(world,p.local);p.im.setMatrixAt(id,_m);
  if(p.im.instanceColor){_c.set(p.key==="ROOF"?colors.ROOF:p.key==="WALL"?colors.WALL:colors.ACC);p.im.setColorAt(id,_c);p.im.instanceColor.needsUpdate=true}p.im.count=this.n;p.im.instanceMatrix.needsUpdate=true});this.owner[id]=owner;return id};
KIT.Pool.prototype.hide=function(id){_m.makeScale(0,0,0);this.parts.forEach(p=>{p.im.setMatrixAt(id,_m);p.im.instanceMatrix.needsUpdate=true});this.owner[id]=null};
KIT.Pool.prototype.meshes=function(){return this.parts.map(p=>p.im)};

// ---------- SÍDLIŠTĚ (panelák) ----------
KIT.panelak=(floors=6,len=8,accent="#48b0ff")=>{const g=new T.Group();const h=floors*.9;const t=TX.panel.clone();t.needsUpdate=true;t.repeat.set(len/2,floors/2);
  const body=new T.Mesh(G.box(len,h,2.8),[KIT.mat("#ded7ca"),KIT.mat("#ded7ca"),KIT.mat("#cfc8bb"),KIT.mat("#cfc8bb"),new T.MeshLambertMaterial({map:t}),new T.MeshLambertMaterial({map:t})]);g.add(body);
  const roof=new T.Mesh(G.box(len+.2,.2,3),KIT.M.graph);roof.position.y=h;g.add(roof);
  for(let i=0;i<Math.max(1,Math.round(len/4));i++){const x=-len/2+(i+.5)*len/Math.max(1,Math.round(len/4));const st=new T.Mesh(G.box(.9,h,.12),KIT.mat(accent));st.position.set(x,0,1.42);g.add(st);
    const can=new T.Mesh(G.box(1.4,.1,.7),KIT.M.graph);can.position.set(x,.95,1.75);g.add(can)}
  g.traverse(c=>{if(c.isMesh){c.castShadow=true;c.receiveShadow=true}});return g};

// ---------- BUILDINGS k zakoupení ----------
KIT.building=(type,accent="#48b0ff")=>{const m=new Model();const A=accent;
  switch(type){
  case"hospoda":{m.add(G.box(3,1.6,2.2),KIT.mat("#c98b4a")).add(G.prism(3.3,1,2.6),KIT.M.tile,0,1.6,0,Math.PI/2*0);m.parts[1].m=new T.Matrix4().makeRotationY(Math.PI/2).setPosition(0,1.6,0);m.parts[1].geo=G.prism(2.6,1,3.3);
    m.add(gc("door",()=>new T.BoxGeometry(.38,.7,.05)),KIT.M.door,0,.4,1.11);windows(m,2.6,.9,1.11,3);m.add(G.box(1.6,.38,.06),KIT.mat("#2f2418"),0,1.3,1.14);m.add(G.box(1.3,.22,.07),KIT.mat("#f0c050"),0,1.38,1.16);
    [[-1,1.9],[1,1.9]].forEach(([x,z])=>{m.add(G.cyl(.04,.04,1.3,6),KIT.M.metal,x,0,z).add(G.cone(.7,.35,10),KIT.mat(A),x,1.25,z).add(G.box(.9,.06,.5),KIT.mat("#8a5a33"),x,.5,z)});break}
  case"vecerka":{m.add(G.box(2.6,1.5,2),KIT.mat("#f4f4f2")).add(G.box(2.8,.12,2.2),KIT.M.graph,0,1.5,0);m.add(gc("gbv",()=>new T.BoxGeometry(2,.8,.04)),KIT.M.glass,0,.55,1.01);
    for(let i=0;i<6;i++)m.add(G.box(.46,.1,.6),KIT.mat(i%2?"#ffffff":A),-1.15+i*.46,1.12,1.25,0,1,1,1,.35);m.add(G.box(1.8,.32,.06),KIT.mat(A),0,1.5,1.12);break}
  case"kavarna":{m.add(G.box(2.4,1.7,2),KIT.mat("#e8d2b0")).add(G.hip(2.8,.8,2.4),KIT.mat("#7a5a3c"),0,1.7,0);m.add(gc("gbk",()=>new T.BoxGeometry(1.6,.9,.04)),KIT.M.glass,0,.6,1.01);
    m.add(G.box(2.4,.05,1.2),KIT.mat("#c9b28a"),0,0,1.65);[[-.7,1.6],[.7,1.6]].forEach(([x,z])=>{m.add(G.cyl(.25,.25,.5,10),KIT.M.white,x,0,z).add(G.cyl(.03,.03,1.2,6),KIT.M.metal,x,.5,z).add(G.cone(.55,.25,10),KIT.mat(A),x,1.5,z)});break}
  case"kebab":{m.add(G.box(1.8,1.4,1.4),KIT.mat("#e9b44c")).add(G.box(2,.12,1.7),KIT.mat("#c43c2c"),0,1.4,.1);m.add(gc("gbkb",()=>new T.BoxGeometry(1.4,.55,.04)),KIT.M.glass,0,.85,.71);
    m.add(G.box(.8,.5,.08),KIT.mat("#c43c2c"),0,1.6,.2);m.add(G.cyl(.18,.12,.9,8),KIT.mat("#a8572b"),0,1.62,.0);m.add(G.cyl(.04,.04,.4,6),KIT.M.metal,0,1.52,0);break}
  case"hriste":{m.add(G.box(5,.06,3.2),KIT.M.pitch);[-2.4,2.4].forEach(x=>{m.add(G.box(.08,.75,.08),KIT.M.white,x,0,-.55).add(G.box(.08,.75,.08),KIT.M.white,x,0,.55).add(G.box(.08,.08,1.18),KIT.M.white,x,.72,0)});
    for(let i=0;i<4;i++)m.add(G.cyl(.04,.04,2.2,6),KIT.M.metal,(i<2?-2.6:2.6),0,(i%2?-1.7:1.7)).add(G.box(.3,.15,.15),KIT.mat("#fffbe0"),(i<2?-2.6:2.6),2.2,(i%2?-1.7:1.7));break}
  case"posilovna":{m.add(G.box(3,1.9,2.2),KIT.mat("#7d8aa6")).add(G.box(3.1,.1,2.3),KIT.M.graph,0,1.9,0);m.add(gc("gbp",()=>new T.BoxGeometry(2.4,.9,.04)),KIT.M.glass,0,.6,1.11);
    m.add(G.box(1.6,.35,.06),KIT.mat(A),0,1.45,1.13);m.add(new T.CylinderGeometry(.08,.08,1.2,8),KIT.M.graph,0,2.3,0,0,1,1,1,0,Math.PI/2).add(new T.CylinderGeometry(.28,.28,.16,12),KIT.M.dark,-.52,2.3,0,0,1,1,1,0,Math.PI/2).add(new T.CylinderGeometry(.28,.28,.16,12),KIT.M.dark,.52,2.3,0,0,1,1,1,0,Math.PI/2);break}
  case"skatepark":{m.add(G.box(4.4,.12,3.2),KIT.mat("#b8bcc6"));m.add(G.box(1.2,.5,.9),KIT.mat("#9aa0ad"),.8,0,.2);m.add(G.box(.06,.06,1.8),KIT.M.metal,-.2,.5,-.8);
    const q=new T.CylinderGeometry(1,1,3,16,1,true,0,Math.PI/2);q.rotateZ(Math.PI/2);m.add(q,new T.MeshLambertMaterial({color:"#9aa0ad",side:T.DoubleSide}),-1.2,1.05,0,Math.PI);m.add(G.box(.15,.06,3),KIT.mat(A),-2.2,1.05,0);break}
  case"kino":{m.add(G.box(3.4,2.3,2.6),KIT.mat("#3a2f5c")).add(G.box(3.6,.15,2.8),KIT.M.graph,0,2.3,0);m.add(G.box(3.5,.55,.25),KIT.basic("#ffd36a"),0,2,1.4);
    m.add(G.box(1.2,.9,.05),KIT.M.glass,0,.45,1.31);for(let i=0;i<5;i++)m.add(G.sphere(.06,6),KIT.basic("#fff4c2"),-1.4+i*.7,1.75,1.55);break}
  case"bazen":{m.add(G.box(4.6,.3,3.2),KIT.mat("#e9eef5")).add(G.box(3.9,.32,2.4),KIT.M.water,0,.01,0);m.add(G.cyl(.05,.05,1.6,6),KIT.M.metal,1.9,0,-1.4).add(G.box(.4,.06,2),KIT.mat(A),1.6,.9,-.4,0,1,1,1,-.45);
    [[-1.8,1.4],[-1,1.4]].forEach(([x,z])=>m.add(G.box(.5,.08,.9),KIT.M.white,x,.3,z));m.add(G.cone(.6,.3,10),KIT.mat("#ff5b5b"),-2.6,1.4,1.4).add(G.cyl(.03,.03,1.4,6),KIT.M.metal,-2.6,0,1.4);break}
  case"rozhledna":{for(let i=0;i<4;i++){const a=i*Math.PI/2+Math.PI/4;m.add(G.box(.18,7.4,.18),KIT.mat("#8a5a33"),Math.cos(a)*.8,0,Math.sin(a)*.8,0,1,1,1,-Math.sin(a)*.07,Math.cos(a)*.07)}
    for(let k=1;k<6;k++)m.add(G.box(1.5-k*.08,.1,1.5-k*.08),KIT.mat("#6e4524"),0,k*1.25,0);m.add(G.box(1.6,.12,1.6),KIT.mat("#6e4524"),0,7.3,0).add(G.hip(1.9,.8,1.9),KIT.mat(A),0,8.2,0);
    [[0,.8],[.8,0],[0,-.8],[-.8,0]].forEach(([x,z])=>m.add(G.box(x?.06:1.6,.5,x?1.6:.06),KIT.mat("#6e4524"),x,7.4,z));break}
  }
  return m};

// ---------- PAMÁTKY (realističtější) ----------
KIT.landmark=(type,name)=>{const g=new T.Group();const P=(geo,mat,x=0,y=0,z=0,ry=0,rx=0,rz=0)=>{const me=new T.Mesh(geo,typeof mat==="string"?KIT.mat(mat):mat);me.position.set(x,y,z);me.rotation.set(rx,ry,rz);g.add(me);return me};
  switch(type){
  case"hrad":{// Zřícenina hradu Říčany: travnatý pahorek, jednolitá zeď paláce s okenními otvory, navazující boční zeď a torza hradby
    const stoneT=TX.stone.clone();stoneT.needsUpdate=true;stoneT.repeat.set(.35,.35);const SM=new T.MeshLambertMaterial({map:stoneT});
    const hill=new T.LatheGeometry([new T.Vector2(0,2.2),new T.Vector2(6.2,2.2),new T.Vector2(7.4,1.6),new T.Vector2(8.6,.6),new T.Vector2(9.2,0)],14);P(hill,new T.MeshLambertMaterial({color:"#7aa257",side:T.DoubleSide}));
    const wallShape=(w,h,top,holes)=>{const s=new T.Shape();s.moveTo(0,0);s.lineTo(w,0);top.forEach(([x,y])=>s.lineTo(x,y));s.closePath();
      holes.forEach(([x,y,hw,hh])=>{const p=new T.Path();p.moveTo(x,y);p.lineTo(x+hw,y);p.lineTo(x+hw,y+hh);p.absarc(x+hw/2,y+hh,hw/2,0,Math.PI,false);p.lineTo(x,y);s.holes.push(p)});return s};
    const ext=(shape,d)=>{const g=new T.ExtrudeGeometry(shape,{depth:d,bevelEnabled:false});return g};
    // hlavní palácová zeď 6 m × 6.6 m, tloušťka 1.2
    const main=wallShape(6.4,6.6,[[6.4,5.2],[5.9,5.9],[5.3,5.5],[4.6,6.6],[3.8,6.2],[3.1,6.5],[2.3,5.6],[1.6,6],[.9,5.1],[0,5.4]],[[.9,2.6,.9,1.1],[4.5,2.6,.9,1.1],[2.75,1.1,.9,.9],[2.85,4,.7,.7]]);
    const mg=ext(main,1.2);const mw=P(mg,SM,-3.2,2.2,-1.6);
    // boční zeď navazující v rohu (osa Z)
    const side=wallShape(3.6,4,[[3.6,2.8],[3,3.4],[2.2,3],[1.5,4],[.7,3.6],[0,4.1]],[[1.3,1.4,.7,.9]]);const sg=ext(side,1.1);const sw=P(sg,SM,-2.1,2.2,-.4,-Math.PI/2);
    // nízké torzo hradby na hraně pahorku
    const low=wallShape(5,1.4,[[5,.9],[4.2,1.3],[3.4,.8],[2.4,1.2],[1.4,.7],[0,1.1]],[]);[[1,2.6,.2],[ -5.2,1.4,1.3]].forEach(([x,z,ry])=>P(ext(low,.8),SM,x,2.2,z,ry));
    for(let i=0;i<7;i++){const a=i/7*Math.PI*2+.3;const rr=new T.DodecahedronGeometry(.7+r()*.6,0);P(rr,"#8f877c",Math.cos(a)*8.1,.45,Math.sin(a)*8.1,r()*3)}
    for(let i=0;i<5;i++)P(G.boxU(.5+r()*.5,.35+r()*.3,.5+r()*.5),SM,-1.5+r()*4,2.2,.6+r()*2.4,r()*3);break}
  case"kostelec":{// Zámek Kostelec: renesanční čtyřkřídlý zámek se sgrafity a branskou věží
    const s=11,wd=2.6,h=4.2;[[0,-s/2+wd/2,s,wd],[0,s/2-wd/2,s,wd],[-s/2+wd/2,0,wd,s-2*wd],[s/2-wd/2,0,wd,s-2*wd]].forEach(([x,z,w,d],i)=>{P(G.box(w,h,d),KIT.M.sgraffito,x,0,z);
      const roof=P(G.hip(1,1,1),KIT.M.tile,x,h,z);roof.scale.set(w+.4,1.8,d+.4);for(let k=0;k<Math.floor((w>d?w:d)/1.6);k++){}});
    for(const [x,z] of [[0,-s/2+.05],[0,s/2-.05]])for(let k=-2;k<=2;k++){if(!k)continue;P(new T.BoxGeometry(.5,.7,.06),KIT.M.win,x+k*1.8,2.8,z+(z<0?-.03:.03))}
    P(G.box(3,7.4,3),KIT.M.sgraffito,0,0,s/2-.5);P(G.box(3.1,.3,3.1),"#9c958a",0,7.4,s/2-.5);const tr=P(G.hip(1,1,1),KIT.M.tile,0,7.7,s/2-.5);tr.scale.set(3.4,2.2,3.4);
    P(G.cyl(.5,.6,1,8),"#3b4049",0,9.9,s/2-.5);P(G.cone(.7,1.4,8),KIT.M.tile,0,10.9,s/2-.5);P(G.box(1.4,2.2,.1),"#4a3b2c",0,0,s/2+1.01);P(G.box(1.8,.4,.12),"#8c6c46",0,2.2,s/2+1.02);
    for(let k=0;k<3;k++)P(new T.BoxGeometry(.5,.7,.06),KIT.M.win,0,3.8+k*1.4,s/2+1.03);
    P(G.box(s-2*wd,.05,s-2*wd),KIT.M.cobble,0,0,0);break}
  case"stirin":{// Zámek Štiřín: barokně-klasicistní, U-půdorys, okrová fasáda, mansardové střechy
    const ochre="#e2b26c",trim="#f4ecd8";const wing=(w,d,x,z)=>{P(G.box(w,3.6,d),ochre,x,0,z);const mr=P(G.prism(d+.4,1.6,w+.4),"#b9553a",x,3.6,z,Math.PI/2);
      for(let i=0;i<Math.floor(w/1.4);i++){const xx=x-w/2+.7+i*1.4;P(new T.BoxGeometry(.5,.9,.06),KIT.M.win,xx,1,z+d/2+.03);P(new T.BoxGeometry(.5,.9,.06),KIT.M.win,xx,2.4,z+d/2+.03)}};
    wing(12,3,0,-3);wing(3,6,-4.5,1.5);wing(3,6,4.5,1.5);
    P(G.box(3.2,4.6,3.4),trim,0,0,-2.8);P(G.prism(3.4,1.4,1),"#f0e4cb",0,4.6,-1.1,0);P(G.box(1.1,1.8,.08),"#5a4632",0,0,-1.05);P(G.cyl(.45,.45,.5,10),"#3e7d6a",0,5.4,-2.8);P(G.cone(.5,1,8),"#3e7d6a",0,5.9,-2.8);
    P(G.box(6,.05,6.5),KIT.mat("#d8cfb8"),0,0,3.2);for(let i=0;i<6;i++){const x=(i%2?2.2:-2.2),z=1.5+Math.floor(i/2)*1.8;P(G.sphere(.55,8),"#3f8b47",x,.5,z)}break}
  case"berchtold":{// Zámek Berchtold: symetrický, pískově okrový, středová věž s cibulí, francouzská zahrada
    const sand="#d9b47c",trim="#f2e6cf";P(G.box(13,3.6,3.2),sand,0,0,0);const rf=P(G.prism(3.6,1.6,13.4),"#b65a3b",0,3.6,0,Math.PI/2);
    [-5.3,5.3].forEach(x=>{P(G.box(2.4,4.6,3.6),sand,x,0,.3);const r2=P(G.hip(1,1,1),"#b65a3b",x,4.6,.3);r2.scale.set(2.8,1.6,4)});
    P(G.box(3.2,5.6,3.8),trim,0,0,.4);P(G.prism(3.4,1.3,.9),"#f6ecd8",0,5.6,2.1,0);const tw=P(G.box(1.6,2.2,1.6),trim,0,5.6,.2);P(G.sphere(.9,12),"#3a6f60",0,8.4,.2);P(G.cone(.25,1.4,8),"#3a6f60",0,9.1,.2);
    for(let i=0;i<9;i++){const x=-6+i*1.5;if(Math.abs(x)<1.5)continue;P(new T.BoxGeometry(.55,.95,.06),KIT.M.win,x,1,1.63);P(new T.BoxGeometry(.55,.95,.06),KIT.M.win,x,2.4,1.63)}
    P(G.box(1.2,2,.1),"#5a4632",0,0,2.32);P(G.box(5,.05,7),KIT.mat("#e3dccb"),0,0,6);[-1,1].forEach(s=>{for(let k=0;k<3;k++){P(G.box(3.2,.45,1.2),"#3f8b47",s*4.2,0,4.5+k*2);P(G.cone(.35,1.6,8),"#2f6f3a",s*2.6,0,4.2+k*2)}});break}
  case"hvezdarna":{// Ondřejovská hvězdárna: cihlová věž se zelenou měděnou kopulí + další kopule
    P(G.cyl(1.8,1.9,4.4,10),KIT.M.brick,0,0,0);P(G.cyl(1.95,1.95,.3,12),"#e8dfd2",0,4.4,0);P(G.dome(1.9,20),KIT.M.copper,0,4.7,0);P(G.box(.45,1.3,3.9),"#26303d",0,5.3,0);
    P(G.box(3.4,2.6,2.6),KIT.M.brick,2.8,0,0);for(let k=0;k<3;k++)P(G.box(2.6-k*.8,.55,2.7),KIT.M.brick,2.8,2.6+k*.55,0);P(G.box(.9,1.5,.08),"#6b4a2f",2.8,0,1.33);
    P(G.cyl(1.2,1.2,2,14),KIT.M.white,-4.2,0,1.6);P(G.dome(1.25,18),KIT.mat("#f2f4f6"),-4.2,2,1.6);P(G.cyl(1,1,1.6,14),KIT.M.white,-1.5,0,4.4);P(G.dome(1.05,18),KIT.mat("#eef0f2"),-1.5,1.6,4.4);
    P(G.box(2.6,1.4,2),KIT.mat("#f4efe6"),3,0,4);P(G.prism(2.2,1,2.8),KIT.M.tile,3,1.4,4,Math.PI/2);break}
  case"pivovar":{// Pivovar Velké Popovice: dlouhá bílá budova se strmou střechou, okna v červených rámech, varna, komín, tanky
    P(G.box(9,3.6,3.6),KIT.M.white,0,0,0);P(G.prism(3.8,3.2,9.2),"#6a5d55",0,3.6,0,Math.PI/2);
    for(let i=0;i<5;i++){const x=-3.6+i*1.8;[1.2,2.6].forEach(y=>{P(new T.BoxGeometry(.7,.9,.06),"#c0392b",x,y,1.83);P(new T.BoxGeometry(.5,.7,.07),KIT.M.win,x,y+.1,1.84)})}
    P(new T.CylinderGeometry(.35,.35,.08,16),"#c0392b",4.62,5.6,0,0,0,Math.PI/2);
    P(G.box(3,6,3),KIT.M.white,-6.4,0,0);P(G.hip(3.4,1.4,3.4),"#6a5d55",-6.4,6,0);P(G.cyl(.45,.6,10,10),KIT.M.brick,-6.4,0,-2.6);
    for(let i=0;i<3;i++){P(G.cyl(.8,.8,3.6,14),KIT.M.metal,-1.5+i*2,0,-3.5);P(G.dome(.8,12),KIT.M.metal,-1.5+i*2,3.6,-3.5)}break}
  case"kostel":case"kaple":{const k=type==="kaple"?.62:1;const onion=name&&/Panny Marie|Narození|Nanebevzetí|Sněžné/.test(name);
    P(G.box(3.2*k,3*k,6*k),"#f6f1e4",0,0,0);P(G.prism(3.6*k,2*k,6.2*k),"#a53d2b",0,3*k,0,Math.PI/2*0);g.children.at(-1).rotation.y=0;g.children.at(-1).geometry=G.prism(3.6*k,2*k,6.2*k);
    const ap=P(G.cyl(1.6*k,1.6*k,3*k,12),"#f6f1e4",0,0,3*k);P(G.cone(1.75*k,1.4*k,12),"#a53d2b",0,3*k,3*k);
    P(G.box(2*k,6.2*k,2*k),"#f6f1e4",0,0,-3.6*k);P(G.box(2.2*k,.2*k,2.2*k),"#d8cfbf",0,6.2*k,-3.6*k);
    if(onion){P(G.cyl(.8*k,.9*k,.8*k,8),"#3e8e6d",0,6.4*k,-3.6*k);P(G.sphere(.85*k,12),"#3e8e6d",0,7.6*k,-3.6*k);P(G.cone(.25*k,1.6*k,8),"#3e8e6d",0,8.2*k,-3.6*k)}
    else{const sp=P(G.hip(1,1,1),"#3b4c5e",0,6.4*k,-3.6*k);sp.scale.set(2.2*k,3.6*k,2.2*k)}
    P(G.cyl(.06,.06,.9*k,6),"#d9b84a",0,(onion?9.8:10)*k,-3.6*k);P(new T.BoxGeometry(.5*k,.08,.08),"#d9b84a",0,(onion?10.4:10.6)*k,-3.6*k);
    for(let i=0;i<3;i++){P(new T.BoxGeometry(.06,1.1*k,.55*k),"#5b7aa0",1.62*k,1.1*k,-1.8*k+i*1.8*k);P(new T.BoxGeometry(.06,1.1*k,.55*k),"#5b7aa0",-1.62*k,1.1*k,-1.8*k+i*1.8*k)}
    P(new T.BoxGeometry(.7*k,1.3*k,.06),"#6b4a2f",0,.65*k,-4.62*k);P(new T.CylinderGeometry(.35*k,.35*k,.06,14),"#26303d",0,4.2*k,-4.61*k,0,Math.PI/2);break}
  case"rybnik":{const p=P(new T.CircleGeometry(7,32),KIT.M.water,0,.16,0,0,-Math.PI/2);P(new T.RingGeometry(7,7.8,32),KIT.mat("#7fae5b"),0,.15,0,0,-Math.PI/2);
    P(G.box(.9,.12,4),KIT.mat("#8a5a33"),5.5,.15,-2,.6);P(G.box(1.8,.4,.7),KIT.mat("#c9a26a"),3.5,.15,-1.4,.6);for(let i=0;i<10;i++){const a=r()*7;P(G.cone(.6,2.2,6),"#2f7d3f",Math.cos(a)*9,0,Math.sin(a)*9)}break}
  case"koupaliste":{P(new T.CircleGeometry(7,32),KIT.M.water,0,.16,0,0,-Math.PI/2);P(new T.RingGeometry(7,9.5,32,1,Math.PI*.1,Math.PI*.8),KIT.M.sand,0,.15,0,0,-Math.PI/2);
    for(let i=0;i<5;i++){const a=Math.PI*.15+i*.15;const x=Math.cos(a)*8.2,z=-Math.sin(a)*8.2;P(G.cyl(.04,.04,1.4,6),KIT.M.metal,x,0,z);P(G.cone(.7,.35,10),["#ff5b5b","#ffc94a","#48b0ff"][i%3],x,1.3,z)}
    P(G.box(.6,.15,3),KIT.mat("#8a5a33"),-5,.18,1.5,-.6);P(G.box(2.6,1.6,1.8),KIT.mat("#7fb6d8"),-7,0,-6);P(G.box(2.8,.12,2),KIT.M.white,-7,1.6,-6);break}
  case"zona":{P(G.box(11,3.2,7),KIT.mat("#dfe3e8"),0,0,0);P(G.box(11.2,.25,7.2),KIT.M.graph,0,3.2,0);P(G.box(4,.8,.1),KIT.mat("#2f5fbf"),0,2.3,3.55);P(new T.BoxGeometry(3,1.6,.05),KIT.M.glass,0,.8,3.53);
    P(G.box(7,3.6,6),KIT.mat("#f2c230"),10,0,0);P(G.box(7.2,.25,6.2),KIT.M.graph,10,3.6,0);P(G.box(17,.06,7),KIT.mat("#8f959e"),4,0,8);for(let i=0;i<9;i++)P(G.box(.08,.07,2),KIT.M.white,-3+i*1.9,0,8)
    for(let i=0;i<6;i++)P(G.box(.9,.6,1.7),["#d33","#36c","#eee","#333","#5a5","#fc3"][i],-2+i*2.6,0,7.8);break}
  }
  g.traverse(c=>{if(c.isMesh){c.castShadow=true;c.receiveShadow=true}});return g};

// ---------- NÁMĚSTÍ (obdélníkové) ----------
KIT.square=(w=16,d=11,accent="#48b0ff")=>{const g=new T.Group();const t=TX.cobble.clone();t.needsUpdate=true;t.repeat.set(w/5,d/5);
  const pl=new T.Mesh(new T.PlaneGeometry(w,d),new T.MeshLambertMaterial({map:t}));pl.rotation.x=-Math.PI/2;pl.position.y=.12;pl.receiveShadow=true;g.add(pl);
  const curb=new T.Mesh(G.box(w+.4,.14,d+.4),KIT.mat("#bdb4a3"));curb.position.y=-.02;g.add(curb);
  const b=new T.Mesh(G.cyl(1.7,1.8,.55,24),KIT.mat("#cfc6b4"));b.position.y=.12;g.add(b);const wt=new T.Mesh(G.cyl(1.45,1.45,.57,24),KIT.M.water);wt.position.y=.13;g.add(wt);
  const col=new T.Mesh(G.cyl(.2,.3,1.8,8),KIT.mat("#cfc6b4"));col.position.y=.6;g.add(col);const bowl=new T.Mesh(G.cyl(.6,.3,.25,12),KIT.mat("#cfc6b4"));bowl.position.y=2.3;g.add(bowl);
  [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx,sz])=>{const x=sx*(w/2-1.4),z=sz*(d/2-1.4);const tr=new T.Mesh(G.sphere(.9,8),KIT.mat("#4f9a45"));tr.position.set(x,1.7,z);g.add(tr);const tk=new T.Mesh(G.cyl(.12,.15,1.3,6),KIT.mat("#6e4524"));tk.position.set(x,.12,z);g.add(tk);
    const lp=new T.Mesh(G.cyl(.05,.05,2.2,6),KIT.M.graph);lp.position.set(x*.55,.12,z);g.add(lp);const lh=new T.Mesh(G.sphere(.16,8),KIT.basic("#fff2c4"));lh.position.set(x*.55,2.35,z);g.add(lh);
    const be=new T.Mesh(G.box(1.2,.35,.35),KIT.mat("#8a5a33"));be.position.set(x*.3,.12,z*.75);g.add(be)});
  const flag=new T.Mesh(new T.PlaneGeometry(1.1,.7),new T.MeshBasicMaterial({color:accent,side:T.DoubleSide}));flag.position.set(w/2-1,3.6,0);g.add(flag);const fp=new T.Mesh(G.cyl(.04,.04,4,6),KIT.M.graph);fp.position.set(w/2-1.55,.12,0);g.add(fp);
  g.traverse(c=>{if(c.isMesh){c.castShadow=true;c.receiveShadow=true}});return g};

// ---------- RIBBON / ROADS / RAIL ----------
KIT.ribbon=(pts,width,y,mat,uvLen)=>{const n=pts.length,pos=[],uv=[],idx=[];let acc=0;
  for(let i=0;i<n;i++){const p=pts[i],a=pts[Math.max(0,i-1)],b=pts[Math.min(n-1,i+1)];let dx=b.x-a.x,dz=b.z-a.z;const l=Math.hypot(dx,dz)||1;dx/=l;dz/=l;const px=-dz*width/2,pz=dx*width/2;
    if(i>0)acc+=Math.hypot(p.x-pts[i-1].x,p.z-pts[i-1].z);pos.push(p.x+px,y,p.z+pz,p.x-px,y,p.z-pz);uv.push(0,acc/uvLen,1,acc/uvLen);if(i<n-1){const k=i*2;idx.push(k,k+2,k+1,k+1,k+2,k+3)}}
  const g=new T.BufferGeometry();g.setAttribute("position",new T.Float32BufferAttribute(pos,3));g.setAttribute("uv",new T.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();const m=new T.Mesh(g,mat);m.receiveShadow=true;return m};
KIT.smooth=(ctrl,step=1.5)=>{const c=new T.CatmullRomCurve3(ctrl.map(p=>new T.Vector3(p.x,0,p.z)),false,"centripetal");const n=Math.max(8,Math.ceil(c.getLength()/step));return c.getSpacedPoints(n).map(v=>({x:v.x,z:v.z}))};
KIT.roadMat=()=>new T.MeshLambertMaterial({map:TX.road});KIT.streetMat=()=>new T.MeshLambertMaterial({map:TX.street});KIT.d1Mat=()=>new T.MeshLambertMaterial({map:TX.d1});
// motorway with barrier + D1 signs
KIT.motorway=(scene,pts)=>{const grp=new T.Group();grp.add(KIT.ribbon(pts,8.5,.16,KIT.d1Mat(),14));
  const bar=KIT.ribbon(pts,.25,.5,KIT.mat("#c9ced6"),1);grp.add(bar);
  let acc=0,next=20;const signs=[];for(let i=1;i<pts.length;i++){acc+=Math.hypot(pts[i].x-pts[i-1].x,pts[i].z-pts[i-1].z);if(acc>next){next+=70;const p=pts[i],a=pts[i-1];const ang=Math.atan2(p.x-a.x,p.z-a.z);
    const s=KIT.d1Sign();s.position.set(p.x+Math.cos(ang)*5.2,0,p.z-Math.sin(ang)*5.2);s.rotation.y=ang;grp.add(s);signs.push(new T.Vector3(s.position.x,3,s.position.z))}}
  scene.add(grp);return{grp,signs}};
const d1Tex=ctex(128,64,(g,w,h)=>{g.fillStyle="#d4262c";g.fillRect(0,0,w,h);g.strokeStyle="#fff";g.lineWidth=5;g.strokeRect(5,5,w-10,h-10);g.fillStyle="#fff";g.font="900 40px Arial";g.textAlign="center";g.textBaseline="middle";g.fillText("D1",w/2,h/2+2)});
KIT.d1Sign=()=>{const g=new T.Group();[-.5,.5].forEach(x=>{const p=new T.Mesh(G.cyl(.06,.06,2.6,6),KIT.M.metal);p.position.x=x;g.add(p)});const s=new T.Mesh(new T.BoxGeometry(1.5,.75,.08),[KIT.M.metal,KIT.M.metal,KIT.M.metal,KIT.M.metal,new T.MeshBasicMaterial({map:d1Tex}),new T.MeshBasicMaterial({map:d1Tex})]);s.position.y=2.7;g.add(s);return g};
// railway: ballast + sleepers + rails + catenary masts
KIT.railway=(scene,pts)=>{const grp=new T.Group();grp.add(KIT.ribbon(pts,3.2,.14,new T.MeshLambertMaterial({map:TX.ballast}),3));
  const off=(d)=>pts.map((p,i)=>{const a=pts[Math.max(0,i-1)],b=pts[Math.min(pts.length-1,i+1)];let dx=b.x-a.x,dz=b.z-a.z;const l=Math.hypot(dx,dz)||1;return{x:p.x-dz/l*d,z:p.z+dx/l*d}});
  [-.55,.55].forEach(d=>grp.add(KIT.ribbon(off(d),.14,.36,KIT.mat("#b6bcc6"),1)));
  // sleepers
  const sl=[];let acc=0;for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i],l=Math.hypot(b.x-a.x,b.z-a.z);for(let s=0;s<l;s+=.8){const t=s/l;sl.push([a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t,Math.atan2(b.x-a.x,b.z-a.z)])}}
  const im=new T.InstancedMesh(new T.BoxGeometry(2,.14,.32),KIT.mat("#6b4b2e"),sl.length);const m=new T.Matrix4(),q=new T.Quaternion(),e=new T.Euler();sl.forEach(([x,z,a],i)=>{q.setFromEuler(e.set(0,a,0));m.compose(new T.Vector3(x,.24,z),q,new T.Vector3(1,1,1));im.setMatrixAt(i,m)});im.receiveShadow=true;grp.add(im);
  // masts
  const ms=[];for(let i=0;i<pts.length;i+=Math.max(1,Math.round(14/1.5))){const p=pts[i],b=pts[Math.min(pts.length-1,i+1)];ms.push([p.x,p.z,Math.atan2(b.x-p.x,b.z-p.z)])}
  const mast=new T.InstancedMesh(G.cyl(.08,.1,3.6,6),KIT.M.metal,ms.length),arm=new T.InstancedMesh(new T.BoxGeometry(1.8,.08,.08),KIT.M.metal,ms.length);
  ms.forEach(([x,z,a],i)=>{q.setFromEuler(e.set(0,a,0));const ox=Math.cos(a)*1.9,oz=-Math.sin(a)*1.9;m.compose(new T.Vector3(x+ox,0,z+oz),q,new T.Vector3(1,1,1));mast.setMatrixAt(i,m);m.compose(new T.Vector3(x+ox*.55,3.4,z+oz*.55),q,new T.Vector3(1,1,1));arm.setMatrixAt(i,m)});
  mast.castShadow=true;grp.add(mast,arm);grp.add(KIT.ribbon(pts,.04,3.35,KIT.mat("#444a55"),1));scene.add(grp);return grp};
KIT.station=(name)=>{const g=new T.Group();const pl=new T.Mesh(G.box(2.2,.55,16),KIT.mat("#c9c3b6"));pl.position.x=2.9;g.add(pl);const edge=new T.Mesh(G.box(.2,.02,16),KIT.basic("#f4d03f"));edge.position.set(1.9,.56,0);g.add(edge);
  const hut=new T.Mesh(G.box(2.8,2.4,6),KIT.mat("#f1e6cf"));hut.position.set(5.4,0,0);g.add(hut);const rf=new T.Mesh(G.prism(3.4,1.2,6.4),KIT.M.tile);rf.position.set(5.4,2.4,0);g.add(rf);
  for(let k=0;k<3;k++){const w=new T.Mesh(new T.BoxGeometry(.06,.8,.6),KIT.M.win);w.position.set(3.98,1.2,-1.8+k*1.8);g.add(w)}
  const can=new T.Mesh(G.box(2,.1,8),KIT.M.graph);can.position.set(2.9,2.4,0);g.add(can);[-3,0,3].forEach(z=>{const p=new T.Mesh(G.cyl(.06,.06,1.85,6),KIT.M.graph);p.position.set(3.4,.55,z);g.add(p)});
  g.traverse(c=>{if(c.isMesh){c.castShadow=true;c.receiveShadow=true}});return g};
KIT.train=()=>{const t=new T.Group();for(let i=0;i<3;i++){const c=new T.Group();const body=new T.Mesh(new T.BoxGeometry(1.9,2.4,6),KIT.mat("#f4f6fa"));body.position.y=1.55;c.add(body);
  const b1=new T.Mesh(new T.BoxGeometry(1.94,.5,6.04),KIT.mat("#1f4fd6"));b1.position.y=.75;c.add(b1);const w1=new T.Mesh(new T.BoxGeometry(1.96,.45,5.4),KIT.mat("#203047"));w1.position.y=1.35;c.add(w1);
  const w2=new T.Mesh(new T.BoxGeometry(1.96,.45,5.4),KIT.mat("#203047"));w2.position.y=2.1;c.add(w2);const rf=new T.Mesh(new T.BoxGeometry(1.8,.2,5.8),KIT.mat("#c7ccd4"));rf.position.y=2.85;c.add(rf);
  if(i===0){const n=new T.Mesh(new T.BoxGeometry(1.9,1.8,.9),KIT.mat("#e7343b"));n.position.set(0,1.3,3.3);c.add(n);const pg=new T.Mesh(new T.BoxGeometry(.8,.06,.06),KIT.M.graph);pg.position.set(0,3.4,1);c.add(pg)}
  c.position.z=-i*6.4;c.traverse(x=>{if(x.isMesh)x.castShadow=true});t.add(c)}return t};

// ---------- ERB ----------
KIT.ERB_IMG={};// name -> HTMLImageElement / canvas (doplní se ze souboru erbů)
KIT.erbCanvas=(name,color,tier)=>{const c=document.createElement("canvas");c.width=256;c.height=300;const g=c.getContext("2d");
  const shield=(s=1)=>{g.save();g.translate(128,152);g.scale(s,s);g.translate(-128,-152);g.beginPath();g.moveTo(22,22);g.lineTo(234,22);g.lineTo(234,150);g.quadraticCurveTo(234,248,128,284);g.quadraticCurveTo(22,248,22,150);g.closePath();g.restore()};
  const F=[["#c08a52","#7a4a22","#5a3415"],["#ffffff","#c7cfda","#8a94a3"],["#fff3a6","#e5ac22","#9a6608"],["#ffffff","#d6dff2","#a9b6d8"]][tier];
  shield();const gr=g.createLinearGradient(0,0,256,300);gr.addColorStop(0,F[0]);gr.addColorStop(.5,F[1]);gr.addColorStop(1,F[2]);g.fillStyle=gr;g.fill();
  if(tier===0){g.save();shield();g.clip();g.strokeStyle="rgba(60,30,10,.35)";g.lineWidth=2;for(let y=0;y<300;y+=9){g.beginPath();g.moveTo(0,y);g.bezierCurveTo(80,y+6,170,y-6,256,y+3);g.stroke()}g.restore()}
  if(tier===3){g.save();shield();g.clip();const ir=g.createLinearGradient(0,0,256,300);ir.addColorStop(0,"rgba(255,180,240,.35)");ir.addColorStop(.5,"rgba(160,230,255,.35)");ir.addColorStop(1,"rgba(200,170,255,.35)");g.fillStyle=ir;g.fillRect(0,0,256,300);g.restore()}
  const img=KIT.ERB_IMG[name];g.save();shield(.8);g.clip();
  if(img){g.fillStyle="#fff";g.fillRect(0,0,256,300);const iw=img.width,ih=img.height;const s=Math.max(170/iw,212/ih);g.imageSmoothingEnabled=true;g.imageSmoothingQuality="high";g.drawImage(img,128-iw*s/2,46+106-ih*s/2,iw*s,ih*s)}
  else{g.fillStyle=color;g.fillRect(0,0,256,300);g.fillStyle="rgba(255,255,255,.22)";g.beginPath();g.moveTo(22,22);g.lineTo(140,22);g.lineTo(22,170);g.fill();g.fillStyle="#fff";g.strokeStyle="rgba(10,20,50,.5)";g.lineWidth=6;g.font="900 112px Georgia, serif";g.textAlign="center";g.textBaseline="middle";g.strokeText(name[0],128,148);g.fillText(name[0],128,148)}
  g.restore();// lesk
  g.save();shield(.8);g.clip();const sh=g.createLinearGradient(0,0,256,120);sh.addColorStop(0,"rgba(255,255,255,.28)");sh.addColorStop(1,"rgba(255,255,255,0)");g.fillStyle=sh;g.fillRect(0,0,256,120);g.restore();
  g.save();shield(.8);g.lineWidth=4;g.strokeStyle="rgba(0,0,0,.35)";g.stroke();g.restore();return c};
// decode compact RLE erbs (palette + runs) -> canvas
KIT.decodeErb=(e,W=56,H=66)=>{const pal=e.p.split(",");const c=document.createElement("canvas");c.width=W;c.height=H;const g=c.getContext("2d");const id=g.createImageData(W,H);let k=0;
  for(const m of e.d.matchAll(/([A-L])([0-9a-z]*)/g)){const ci=m[1].charCodeAt(0)-65;const n=m[2]?parseInt(m[2],36):1;for(let i=0;i<n;i++,k++){if(ci===0)continue;const h=pal[ci-1];id.data[k*4]=parseInt(h.slice(0,2),16);id.data[k*4+1]=parseInt(h.slice(2,4),16);id.data[k*4+2]=parseInt(h.slice(4,6),16);id.data[k*4+3]=255}}
  g.putImageData(id,0,0);return c};
const glow=ctex(128,128,(g)=>{const rg=g.createRadialGradient(64,64,4,64,64,64);rg.addColorStop(0,"rgba(255,240,170,.9)");rg.addColorStop(1,"rgba(255,240,170,0)");g.fillStyle=rg;g.fillRect(0,0,128,128)});
KIT.erbObject=(name,color,tier)=>{const grp=new T.Group();const tx=new T.CanvasTexture(KIT.erbCanvas(name,color,tier));tx.anisotropy=4;
  const m=new T.Mesh(new T.PlaneGeometry(4,4.7),new T.MeshBasicMaterial({map:tx,transparent:true,side:T.DoubleSide,depthWrite:false}));const gl=new T.Sprite(new T.SpriteMaterial({map:glow,transparent:true,depthWrite:false,color:tier===3?"#dfe8ff":"#ffe9a0"}));gl.scale.set(9,9,1);gl.visible=tier>=2;
  grp.add(gl,m);grp.userData={m,gl,tier,phase:r()*6};return grp};
KIT.animateErb=(grp,camera,clock,scale=1)=>{const {m,gl,tier,phase}=grp.userData;m.quaternion.copy(camera.quaternion);m.rotateY(Math.sin(clock*1.1+phase)*.45);m.scale.setScalar(scale*[1,1.1,1.25,1.45][tier]);gl.scale.setScalar(9*scale);
  if(tier===3)m.material.color.setHSL((clock*.15)%1,.25,.94+.06*Math.sin(clock*3));gl.material.opacity=.55+.3*Math.sin(clock*2.4+phase)};
})();
