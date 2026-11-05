/* Postav si Říčansko – katalog speciálních budov. Každá budova: přední strana +Z, půdorys cca 6 × 5.6, cedule s názvem. */
(function(){
"use strict";
const T=THREE;
const MC={};
const M=(c,o)=>{const k=c+(o?JSON.stringify(o):"");return MC[k]||(MC[k]=new T.MeshLambertMaterial(Object.assign({color:c},o||{})))};
function mesh(g,m,x=0,y=0,z=0,ry=0){const me=new T.Mesh(g,typeof m==="string"?M(m):m);me.position.set(x,y,z);me.rotation.y=ry;me.castShadow=true;me.receiveShadow=true;return me}
const box=(G,w,h,d,c,x=0,y=0,z=0,ry=0)=>{const g=new T.BoxGeometry(w,h,d);g.translate(0,h/2,0);const m=mesh(g,c,x,y,z,ry);G.add(m);return m};
const cyl=(G,r1,r2,h,c,x=0,y=0,z=0,seg=12)=>{const g=new T.CylinderGeometry(r1,r2,h,seg);g.translate(0,h/2,0);const m=mesh(g,c,x,y,z);G.add(m);return m};
function canvasTex(w,h,draw){const c=document.createElement("canvas");c.width=w;c.height=h;draw(c.getContext("2d"),w,h);const t=new T.CanvasTexture(c);t.anisotropy=4;return t}
function rr(g,x,y,w,h,r){g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath()}
function signTexture(text,color,emoji){return canvasTex(768,256,(g,w,h)=>{
  g.fillStyle="#fff";rr(g,6,6,w-12,h-12,34);g.fill();g.lineWidth=10;g.strokeStyle=color;rr(g,6,6,w-12,h-12,34);g.stroke();
  g.fillStyle=color;rr(g,24,24,190,h-48,26);g.fill();
  g.font="120px 'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif";g.textAlign="center";g.textBaseline="middle";g.fillText(emoji||"★",119,h/2+6);
  g.fillStyle="#0d1838";g.textAlign="left";const maxW=w-270;let size=78,lines;
  const words=text.split(" ");
  for(;size>=34;size-=4){g.font=`700 ${size}px 'Space Grotesk',Inter,Arial,sans-serif`;lines=[];let cur="";
   for(const wd of words){const t=cur?cur+" "+wd:wd;if(g.measureText(t).width>maxW&&cur){lines.push(cur);cur=wd}else cur=t}lines.push(cur);
   if(lines.length<=2&&lines.every(l=>g.measureText(l).width<=maxW))break}
  const lh=size*1.05,y0=h/2-(lines.length-1)*lh/2;lines.forEach((l,i)=>g.fillText(l,240,y0+i*lh+4));
 })}
/* stojanová cedule u ulice */
function sign(G,text,color,emoji,x=-1.9,z=2.45,w=2.7){
 const s=new T.Group();const h=w/3;const tex=signTexture(text,color,emoji);
 const face=new T.MeshLambertMaterial({map:tex});const back=M("#e9edf5");
 const board=new T.Mesh(new T.BoxGeometry(w,h,.12),[back,back,back,back,face,face]);board.position.y=1.15+h/2;board.castShadow=true;s.add(board);
 [-w/2+.15,w/2-.15].forEach(px=>cyl(s,.06,.06,1.2,"#4a5266",px,0,0,6));
 s.position.set(x,0,z);G.add(s);G.userData.sign={text,color,emoji};return s}
/* Kenney budova (přední strana modelu je +X → otočit na +Z) */
function kenney(G,type,roof,x=0,z=0,sc=3.4){const src=window.MODELS&&window.MODELS.b[type];if(!src)return null;
 const m=new T.Mesh(src.geo,window.MODELS.roofMat(src,roof));m.scale.setScalar(sc);m.rotation.y=-Math.PI/2;m.position.set(x,0,z);m.castShadow=m.receiveShadow=true;G.add(m);return m}
function prop(G,kind,x,z,sc=3.4,ry=0){const p=window.MODELS&&window.MODELS.p[kind];if(!p)return null;const m=new T.Mesh(p.geo,p.mat);m.scale.setScalar(sc);m.position.set(x,0,z);m.rotation.y=ry;m.castShadow=true;G.add(m);return m}
function car(G,kind,x,z,ry=0,sc=.55){const c=window.MODELS&&window.MODELS.c[kind];if(!c)return null;const m=new T.Mesh(c.geo,c.mat);m.scale.setScalar(sc);m.position.set(x,.16,z);m.rotation.y=ry;m.castShadow=true;G.add(m);return m}
function tree(G,x,z,s=4.2){const t=window.MODELS&&window.MODELS.p.tree;if(!t)return;const m=new T.Mesh(t.geo,t.mat);m.scale.setScalar(s);m.position.set(x,0,z);m.castShadow=true;G.add(m)}
function stripes(a,b,n=8){return canvasTex(128,64,(g,w,h)=>{for(let i=0;i<n;i++){g.fillStyle=i%2?b:a;g.fillRect(i*w/n,0,w/n,h)}g.fillStyle="rgba(0,0,0,.12)";g.fillRect(0,h-8,w,8)})}
function awning(G,w,x,y,z,a,b,depth=.9){const t=stripes(a,b);const m=new T.Mesh(new T.BoxGeometry(w,.08,depth),[M(a),M(a),new T.MeshLambertMaterial({map:t}),M(a),new T.MeshLambertMaterial({map:t}),M(a)]);
 m.position.set(x,y,z);m.rotation.x=.32;m.castShadow=true;G.add(m);return m}
function umbrella(G,x,z,c){cyl(G,.04,.04,1.3,"#6b6f7a",x,0,z,6);const g=new T.ConeGeometry(.75,.35,8);g.translate(0,1.4,0);G.add(mesh(g,c,x,0,z));
 box(G,.7,.06,.7,"#c8a477",x,.62,z);[[-.45,0],[.45,0]].forEach(([dx])=>box(G,.18,.4,.5,"#8a6a45",x+dx,0,z))}
function bench(G,x,z,ry=0){const b=new T.Group();box(b,1.1,.08,.35,"#9b6b3f",0,.42,0);box(b,1.1,.3,.06,"#9b6b3f",0,.5,-.16);[-.45,.45].forEach(px=>box(b,.06,.42,.3,"#3c4252",px,0,0));b.position.set(x,0,z);b.rotation.y=ry;G.add(b)}
function pad(G,w,d,c,y=.05){const m=new T.Mesh(new T.BoxGeometry(w,y,d),M(c));m.position.y=y/2;m.receiveShadow=true;G.add(m);return m}
function lines(w,d,draw){return canvasTex(512,Math.round(512*d/w),draw)}

function beam(G,a,b,r,c){const A=new T.Vector3(...a),Bv=new T.Vector3(...b);const len=A.distanceTo(Bv);const g=new T.CylinderGeometry(r,r,len,6);const m=mesh(g,c);m.position.copy(A).add(Bv).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),Bv.clone().sub(A).normalize());G.add(m);return m}
const B={};
B.pomnik=(G)=>{pad(G,4.6,4.2,"#d9cdb4",.08);const s=new T.Group();box(s,1.6,.35,1.6,"#b9b1a3");box(s,1.1,.5,1.1,"#a39b8c",0,.35);box(s,.55,2.6,.55,"#c9c2b5",0,.85);
 const p=new T.ConeGeometry(.42,.6,4);p.rotateY(Math.PI/4);p.translate(0,3.75,0);s.add(mesh(p,"#c9c2b5"));G.add(s);
 [[-1.6,-1.2],[1.6,-1.2]].forEach(([x,z])=>tree(G,x,z,3.6));[[-1.3,1.1],[1.3,1.1]].forEach(([x,z])=>{cyl(G,.35,.3,.3,"#7a6a58",x,0,z,8);const f=new T.SphereGeometry(.32,8,6);f.translate(0,.42,0);G.add(mesh(f,"#d64b6a",x,0,z))});bench(G,0,-1.6,Math.PI)};
B.kebab=(G)=>{pad(G,6,5.6,"#d8d2c6");kenney(G,"h","#e0572b",0,-.6,3.1);awning(G,3.2,0,1.25,1.15,"#e4352b","#ffffff",.8);umbrella(G,1.9,1.9,"#ffd23f");umbrella(G,.4,2.2,"#e4352b");prop(G,"dumpster",-2.5,-1.7,3)};
B.lavicka=(G)=>{pad(G,4,3.2,"#c9b99a",.05);bench(G,0,0);bench(G,-1.4,.2,.35);tree(G,1.6,-.8,5);prop(G,"lamp",-2.2,-.6,4)};
B.zastavka=(G)=>{pad(G,6,3,"#c6c9d0",.12);const s=new T.Group();box(s,3.2,.1,1.4,"#2f72d6",0,2.2,-.2);[-1.55,1.55].forEach(x=>box(s,.08,2.2,1.3,"#5f6b80",x,0,-.2));
 const gl=new T.Mesh(new T.BoxGeometry(3.1,1.8,.04),new T.MeshLambertMaterial({color:"#bfe4ff",transparent:true,opacity:.45}));gl.position.set(0,1.2,-.85);s.add(gl);bench(s,0,-.4);G.add(s);
 cyl(G,.05,.05,2.6,"#4a5266",2.3,0,.9,6);const z=canvasTex(128,128,(g)=>{g.fillStyle="#ffd23f";g.beginPath();g.arc(64,64,60,0,7);g.fill();g.fillStyle="#0d1838";g.font="700 70px Arial";g.textAlign="center";g.textBaseline="middle";g.fillText("BUS",64,68)});
 const zm=new T.Mesh(new T.CircleGeometry(.45,24),new T.MeshBasicMaterial({map:z,side:T.DoubleSide}));zm.position.set(2.3,2.5,.92);G.add(zm);car(G,"van",-1,2.2,Math.PI/2,.5)};
B.vecerka=(G)=>{pad(G,6,5.6,"#d8d2c6");kenney(G,"c","#3d7bd9",0,-.6,3.3);const gl=canvasTex(256,128,(g,w,h)=>{g.fillStyle="#1d2b44";g.fillRect(0,0,w,h);g.fillStyle="#ffe9a8";for(let i=0;i<5;i++)g.fillRect(10+i*49,18,40,92)});
 const f=new T.Mesh(new T.PlaneGeometry(2.6,1.1),new T.MeshBasicMaterial({map:gl}));f.position.set(0,.65,1.15);G.add(f);awning(G,3,0,1.4,1.3,"#2fa35a","#ffffff",.7);
 box(G,.9,.5,.5,"#f2b134",1.8,0,1.9);box(G,.9,.5,.5,"#e04848",-.2,0,2)};
B.hospoda=(G)=>{pad(G,6,5.6,"#d3c7b1");kenney(G,"d","#7a3a22",0,-.8,3.1);awning(G,3.4,0,1.35,1.3,"#7a3a22","#f2e2c4",.8);
 [[-1,2],[1.3,2.1]].forEach(([x,z])=>{box(G,1.4,.08,.6,"#9b6b3f",x,.72,z);[-.55,.55].forEach(d=>box(G,.08,.72,.5,"#6b4a2c",x+d,0,z));box(G,1.4,.06,.25,"#9b6b3f",x,.42,z-.55);box(G,1.4,.06,.25,"#9b6b3f",x,.42,z+.55)});
 prop(G,"lamp",2.6,1.4,4)};
B.workout=(G)=>{const t=lines(512,480,(g,w,h)=>{g.fillStyle="#d04f3a";g.fillRect(0,0,w,h);g.fillStyle="#2f72d6";g.fillRect(40,40,w-80,h-80);g.fillStyle="#d04f3a";g.fillRect(70,70,w-140,h-140)});
 const p=pad(G,6,5.6,"#fff",.06);p.material=new T.MeshLambertMaterial({map:t});
 const bar=(x,z,w,h)=>{[-w/2,w/2].forEach(d=>cyl(G,.06,.06,h,"#3c4252",x+d,0,z,6));const g=new T.CylinderGeometry(.045,.045,w,6);g.rotateZ(Math.PI/2);g.translate(0,h,0);G.add(mesh(g,"#ffd23f",x,0,z))};
 bar(-1.4,-1,1.6,2.2);bar(1.2,-1.2,1.2,1.4);bar(1.2,.4,1.2,1.0);for(let i=0;i<5;i++)bar(-1.6+i*.5,1.3,.4,.7+i*.25);tree(G,2.5,2.1,3.6)};
B.kavarna=(G)=>{pad(G,6,5.6,"#e2d6c2");kenney(G,"g","#2d2a33",0,-.8,3.3);awning(G,3.4,0,1.3,1.2,"#1d1d24","#d8b98a",.8);umbrella(G,-1.6,1.9,"#f5ead7");umbrella(G,1.6,1.9,"#f5ead7");
 for(let i=0;i<3;i++){cyl(G,.25,.3,.4,"#7a6a58",-2.6+i*.4,0,-2.4,8)}};
B.hasicarna=(G)=>{pad(G,6,5.6,"#c4c7cf");const b=box(G,4.6,2.1,3,"#f0ece4",0,0,-1.1);const r=new T.CylinderGeometry(.01,1.8,1,4,1);
 const roof=new T.Mesh(new T.BoxGeometry(4.9,.25,3.3),M("#b3302a"));roof.position.set(0,2.2,-1.1);roof.castShadow=true;G.add(roof);
 const door=canvasTex(256,128,(g,w,h)=>{g.fillStyle="#c33";g.fillRect(0,0,w,h);g.strokeStyle="#8f1f1a";g.lineWidth=6;for(let y=16;y<h;y+=18){g.beginPath();g.moveTo(0,y);g.lineTo(w,y);g.stroke()}});
 [-1.15,1.15].forEach(x=>{const d=new T.Mesh(new T.PlaneGeometry(1.7,1.6),new T.MeshLambertMaterial({map:door}));d.position.set(x,.8,.41);G.add(d)});
 box(G,1,3.6,1,"#f0ece4",-2.6,0,-2.1);box(G,1.2,.25,1.2,"#b3302a",-2.6,3.6,-2.1);car(G,"firetruck",1.6,1.9,0,.55)};
B.fotbal=(G)=>{const t=lines(600,420,(g,w,h)=>{for(let i=0;i<8;i++){g.fillStyle=i%2?"#4c9a3c":"#58a845";g.fillRect(i*w/8,0,w/8,h)}g.strokeStyle="#fff";g.lineWidth=5;g.strokeRect(20,20,w-40,h-40);g.beginPath();g.moveTo(w/2,20);g.lineTo(w/2,h-20);g.stroke();g.beginPath();g.arc(w/2,h/2,48,0,7);g.stroke();g.strokeRect(20,h/2-70,70,140);g.strokeRect(w-90,h/2-70,70,140)});
 const p=pad(G,6.2,4.4,"#fff",.06);p.material=new T.MeshLambertMaterial({map:t});p.position.z=-.5;
 [-2.95,2.95].forEach(x=>{const g=new T.Group();box(g,.06,.7,.06,"#fff",0,0,-.6);box(g,.06,.7,.06,"#fff",0,0,.6);box(g,.06,.06,1.26,"#fff",0,.7,0);g.position.set(x,0,-.5);G.add(g)});
 for(let i=0;i<3;i++)box(G,4.4,.25,.4,"#2f72d6",0,i*.25,2.05+i*.3)};
B.pizzerie=(G)=>{pad(G,6,5.6,"#e2d6c2");kenney(G,"j","#c0392b",0,-.7,3.2);awning(G,3.2,0,1.3,1.25,"#2fa35a","#ffffff",.8);umbrella(G,1.8,2,"#c0392b");car(G,"hatchback-sports",-1.8,2,Math.PI/2,.45)};
B.rybnik=(G)=>{const w=new T.Mesh(new T.CircleGeometry(2.6,32),new T.MeshLambertMaterial({color:"#3f8fc4"}));w.rotation.x=-Math.PI/2;w.position.set(0,.07,-.3);w.receiveShadow=true;G.add(w);
 const sh=new T.Mesh(new T.RingGeometry(2.6,3,32),M("#cdbf98"));sh.rotation.x=-Math.PI/2;sh.position.set(0,.065,-.3);G.add(sh);
 box(G,.8,.12,2.2,"#9b6b3f",0,.15,1.3);for(let i=0;i<4;i++)cyl(G,.05,.05,.3,"#6b4a2c",-.35+(i%2)*.7,0,.4+Math.floor(i/2)*1.6,5);tree(G,-2.6,-2.2,4.4);tree(G,2.4,-2.4,4)};
B.knihovna=(G)=>{pad(G,6,5.6,"#d9d4cb");kenney(G,"b","#2f72d6",0,-.6,3);box(G,1.6,.1,.6,"#ffd23f",1.6,0,1.9);bench(G,-1.6,1.9)};
B.skatepark=(G)=>{pad(G,6,5.6,"#b8bcc6",.08);
 const qp=(x,flip)=>{const s=new T.Shape();s.moveTo(0,0);s.lineTo(1.3,0);s.lineTo(1.3,1.25);s.lineTo(1.15,1.25);s.absarc(0,1.25,1.15,0,-Math.PI/2,true);s.lineTo(0,0);
  const g=new T.ExtrudeGeometry(s,{depth:3.6,bevelEnabled:false,curveSegments:10});g.translate(-1.3,0,-1.8);if(flip)g.scale(-1,1,1);g.computeVertexNormals();const m=mesh(g,"#a7aeb9",x,.08,-.4);m.material=M("#a7aeb9",{side:T.DoubleSide});G.add(m);
  const lip=new T.CylinderGeometry(.05,.05,3.6,6);lip.rotateX(Math.PI/2);G.add(mesh(lip,"#ffd23f",x+(flip?1.15:-1.15)*-1*0-(flip?-0.15:0.15)*0,1.34,-.4));
  box(G,.3,.06,3.6,"#8e95a1",x+(flip?.15:-.15),1.27,-.4)};
 qp(-1.7,true);qp(1.7,false);
 const fb=new T.Shape();fb.moveTo(-.9,0);fb.lineTo(-.35,.45);fb.lineTo(.35,.45);fb.lineTo(.9,0);fb.lineTo(-.9,0);const g=new T.ExtrudeGeometry(fb,{depth:1.2,bevelEnabled:false});g.translate(0,0,-.6);G.add(mesh(g,"#c3c8d1",0,.08,-.4));
 const rl=new T.CylinderGeometry(.04,.04,1.8,6);rl.rotateZ(Math.PI/2);rl.translate(0,.45,0);G.add(mesh(rl,"#ffd23f",0,0,1.35));[-0.8,0.8].forEach(x=>cyl(G,.03,.03,.45,"#3c4252",x,0,1.35,5))};
B.kino=(G)=>{pad(G,6,5.6,"#6f8f4c",.04);const sc=canvasTex(256,128,(g,w,h)=>{const gr=g.createLinearGradient(0,0,w,h);gr.addColorStop(0,"#5fa8e8");gr.addColorStop(1,"#1f3c8f");g.fillStyle=gr;g.fillRect(0,0,w,h);g.fillStyle="#fff";g.font="700 40px Arial";g.textAlign="center";g.fillText("RADAR",w/2,h/2+14)});
 box(G,4.6,.2,.3,"#2a2f3a",0,2.4,-2.2);[-2.25,2.25].forEach(x=>box(G,.2,2.4,.3,"#2a2f3a",x,0,-2.2));const s=new T.Mesh(new T.PlaneGeometry(4.3,2),new T.MeshBasicMaterial({map:sc}));s.position.set(0,1.4,-2.03);G.add(s);
 for(let r=0;r<3;r++)for(let c=0;c<4;c++)box(G,.7,.35,.5,"#c23b3b",-1.4+c*.95,0,-.4+r*.9)};
B.nadrazi=(G)=>{pad(G,6,5.6,"#c6c9d0",.1);kenney(G,"m","#5a6170",-1,-1,3);box(G,6,.35,1.2,"#d9d4cb",0,0,1.9);const s=canvasTex(256,64,(g,w,h)=>{g.fillStyle="#1f3c8f";g.fillRect(0,0,w,h);g.fillStyle="#fff";g.font="700 34px Arial";g.textAlign="center";g.fillText("P+R  🚆",w/2,44)});
 cyl(G,.05,.05,2.2,"#4a5266",2.3,0,1.4,6);const sm=new T.Mesh(new T.PlaneGeometry(1.2,.3),new T.MeshBasicMaterial({map:s}));sm.position.set(2.3,2.1,1.43);G.add(sm)};
B.koupaliste=(G)=>{pad(G,6,5.6,"#efe7d4",.06);const w=new T.Mesh(new T.BoxGeometry(4.2,.08,2.8),M("#41b4e6"));w.position.set(-.3,.08,-.6);G.add(w);
 const l=canvasTex(256,128,(g,wd,h)=>{g.fillStyle="#41b4e6";g.fillRect(0,0,wd,h);g.strokeStyle="#ffffff88";g.lineWidth=3;for(let i=1;i<4;i++){g.beginPath();g.moveTo(0,i*h/4);g.lineTo(wd,i*h/4);g.stroke()}});w.material=new T.MeshLambertMaterial({map:l});
 umbrella(G,2.4,-1.6,"#ff7a59");umbrella(G,2.4,.6,"#ffd23f");box(G,1.2,1.2,1,"#2f72d6",2.2,0,2)};
B.rozhledna=(G)=>{pad(G,4.4,4.4,"#cdbf98",.06);const H=6.4,r0=1.25,r1=.55;const rad=y=>r0+(r1-r0)*y/H;
 for(let i=0;i<4;i++){const a=i*Math.PI/2+Math.PI/4;beam(G,[Math.cos(a)*r0,0,Math.sin(a)*r0],[Math.cos(a)*r1,H,Math.sin(a)*r1],.09,"#7a5636")}
 [1.6,3.2,4.8].forEach(y=>{const w=rad(y)*1.5;box(G,w,.1,w,"#9b6b3f",0,y,0);for(let i=0;i<4;i++){const a=i*Math.PI/2+Math.PI/4,b=a+Math.PI/2;beam(G,[Math.cos(a)*rad(y-1.6),y-1.55,Math.sin(a)*rad(y-1.6)],[Math.cos(b)*rad(y),y,Math.sin(b)*rad(y)],.04,"#6b4a2c")}});
 const top=r1*1.9;box(G,top,.12,top,"#9b6b3f",0,H,0);[[0,top/2],[0,-top/2]].forEach(([x,z])=>box(G,top,.5,.05,"#7a5636",x,H+.12,z));[[top/2,0],[-top/2,0]].forEach(([x,z])=>box(G,.05,.5,top,"#7a5636",x,H+.12,z));
 for(let i=0;i<4;i++){const a=i*Math.PI/2+Math.PI/4;cyl(G,.05,.05,1.1,"#6b4a2c",Math.cos(a)*top*.66,H+.12,Math.sin(a)*top*.66,5)}const r=new T.ConeGeometry(top*.95,.9,4);r.rotateY(Math.PI/4);r.translate(0,H+1.65,0);G.add(mesh(r,"#7a3a22"));
 cyl(G,.04,.04,.9,"#e4352b",0,H+2.1,0,4)};
B.podium=(G)=>{pad(G,6,5.6,"#4b5263",.05);box(G,4.6,.8,2.6,"#2a2f3a",0,0,-1.2);[-2.2,2.2].forEach(x=>{box(G,.15,3.4,.15,"#9aa1ad",x,0,-2.4);box(G,.15,3.4,.15,"#9aa1ad",x,0,0)});box(G,4.6,.2,2.6,"#9aa1ad",0,3.4,-1.2);
 ["#ff3b6b","#ffd23f","#5fa8e8","#7cf29a"].forEach((c,i)=>{const s=new T.SphereGeometry(.16,8,6);s.translate(0,3.25,0);G.add(mesh(s,new T.MeshBasicMaterial({color:c}),-1.6+i*1.05,0,-.1))});box(G,.8,1.4,.6,"#111",-1.9,.8,-1.8);box(G,.8,1.4,.6,"#111",1.9,.8,-1.8)};
B.kluziste=(G)=>{pad(G,6,5.6,"#d9dde5",.05);const ice=new T.Mesh(new T.BoxGeometry(5,.06,3.6),new T.MeshLambertMaterial({color:"#e8f6ff"}));ice.position.set(0,.08,-.5);G.add(ice);
 [[0,-2.3,5,.12],[0,1.3,5,.12]].forEach(([x,z,w,d])=>box(G,w,.4,d,"#2f72d6",x,0,z));[[-2.5,-.5],[2.5,-.5]].forEach(([x,z])=>box(G,.12,.4,3.6,"#2f72d6",x,0,z));tree(G,2.6,2.1,3.6)};
B.tvrz=(G)=>{pad(G,6,5.6,"#b6ad9a",.05);box(G,3.6,1.6,2.6,"#c9c2b5",0,0,-1);for(let i=0;i<6;i++)box(G,.4,.4,.4,"#b9b1a3",-1.6+i*.64,1.6,.25);cyl(G,.9,1,3.4,"#c9c2b5",-1.8,0,-1.8,10);const c=new T.ConeGeometry(1.1,1.3,10);c.translate(0,4,0);G.add(mesh(c,"#7a3a22",-1.8,0,-1.8))};
B.coworking=(G)=>{pad(G,6,5.6,"#d9dde5",.06);const gl=new T.MeshLambertMaterial({color:"#9fd0f2",transparent:true,opacity:.75});
 const a=new T.Mesh(new T.BoxGeometry(4.4,3.2,3),gl);a.position.set(0,1.6,-1);a.castShadow=true;G.add(a);for(let y=1.05;y<3.2;y+=1.05)box(G,4.45,.06,3.05,"#e9edf5",0,y,-1);box(G,4.6,.2,3.2,"#2a2f3a",0,3.2,-1);
 car(G,"suv-luxury",1.6,2,Math.PI/2,.45)};
B.stadion=(G)=>{const t=lines(600,400,(g,w,h)=>{for(let i=0;i<10;i++){g.fillStyle=i%2?"#4c9a3c":"#58a845";g.fillRect(i*w/10,0,w/10,h)}g.strokeStyle="#fff";g.lineWidth=5;g.strokeRect(30,30,w-60,h-60);g.beginPath();g.moveTo(w/2,30);g.lineTo(w/2,h-30);g.stroke()});
 const p=pad(G,4.4,3,"#fff",.06);p.material=new T.MeshLambertMaterial({map:t});p.position.z=-.4;
 [[0,-2.4,6,.9],[0,1.6,6,.9]].forEach(([x,z,w,d],i)=>{for(let k=0;k<3;k++)box(G,w,.35,.3,"#2f72d6",x,k*.35,z+(i?k*.3:-k*.3))});
 [[-2.75,-.4],[2.75,-.4]].forEach(([x,z])=>{for(let k=0;k<2;k++)box(G,.3,.35,3,"#2f72d6",x+(x<0?-k*.3:k*.3),k*.35,z)});box(G,6.4,.12,1,"#e9edf5",0,1.6,-2.9)};
B.metro=(G)=>{pad(G,6,5.6,"#c6c9d0",.08);box(G,2.6,.03,3.2,"#1b1e26",0,.08,-.4);for(let i=0;i<5;i++)box(G,2.3,.035,.3,"#7a8190",0,.1,-1.5+i*.55);
 [-1.32,1.32].forEach(x=>{box(G,.08,.9,3.2,"#2f72d6",x,.08,-.4);const r=new T.CylinderGeometry(.04,.04,3.2,6);r.rotateX(Math.PI/2);r.translate(0,1.05,0);G.add(mesh(r,"#9aa1ad",x,0,-.4))});
 box(G,2.8,.1,3.4,"#2f72d6",0,2.2,-.4);[[-1.3,1.1],[1.3,1.1],[-1.3,-1.9],[1.3,-1.9]].forEach(([x,z])=>box(G,.08,2.2,.08,"#9aa1ad",x,0,z));
 const m=canvasTex(128,128,(g)=>{g.fillStyle="#e4352b";g.beginPath();g.arc(64,64,60,0,7);g.fill();g.fillStyle="#fff";g.font="700 80px Arial";g.textAlign="center";g.textBaseline="middle";g.fillText("M",64,70)});
 cyl(G,.06,.06,3,"#4a5266",2.2,0,1.4,6);[1,-1].forEach(sd=>{const mm=new T.Mesh(new T.CircleGeometry(.45,24),new T.MeshBasicMaterial({map:m}));mm.position.set(2.2,3.1,1.4+sd*.07);if(sd<0)mm.rotation.y=Math.PI;G.add(mm)})};
B.letiste=(G)=>{pad(G,6.2,5.6,"#8fae63",.04);const t=lines(600,300,(g,w,h)=>{g.fillStyle="#555b66";g.fillRect(0,0,w,h);g.fillStyle="#fff";for(let x=20;x<w-20;x+=50)g.fillRect(x,h/2-4,28,8);g.fillRect(10,20,w-20,6);g.fillRect(10,h-26,w-20,6)});
 const p=pad(G,6.2,2,"#fff",.07);p.material=new T.MeshLambertMaterial({map:t});p.position.z=-1.6;
 const pl=new T.Group();const body=new T.CylinderGeometry(.22,.22,2.6,10);body.rotateX(Math.PI/2);pl.add(mesh(body,"#f4f6fa",0,.55,0));pl.add(mesh(new T.SphereGeometry(.22,10,8),"#f4f6fa",0,.55,1.3));
 const tail=new T.ConeGeometry(.22,.6,10);tail.rotateX(-Math.PI/2);pl.add(mesh(tail,"#f4f6fa",0,.55,-1.6));box(pl,2.8,.06,.55,"#e9edf5",0,.5,.1);box(pl,1,.05,.3,"#e9edf5",0,.62,-1.5);box(pl,.06,.6,.4,"#2f72d6",0,.6,-1.55);
 [-0.75,.75].forEach(x=>{const e=new T.CylinderGeometry(.1,.1,.4,8);e.rotateX(Math.PI/2);pl.add(mesh(e,"#9aa1ad",x,.38,.2))});pl.rotation.y=Math.PI/2;pl.position.set(-.6,.08,-1.6);G.add(pl);
 const term=new T.Mesh(new T.BoxGeometry(3,1.2,1.4),new T.MeshLambertMaterial({color:"#9fd0f2",transparent:true,opacity:.85}));term.position.set(.6,.7,1.3);term.castShadow=true;G.add(term);box(G,3.2,.15,1.6,"#e9edf5",.6,1.3,1.3);
 cyl(G,.25,.25,2.8,"#e9edf5",-2.2,.05,1.6,8);box(G,1,.6,1,"#9fd0f2",-2.2,2.85,1.6);box(G,1.2,.1,1.2,"#2a2f3a",-2.2,3.45,1.6)};

const CAT=[
 ["pomnik","Pomník na návsi",5,"Tady to celé začalo","🗿","#8e95a8"],
 ["kebab","Kebab / bistro",5,"Kebab u Alenky","🥙","#e0572b"],
 ["lavicka","Lavička s výhledem",5,"Lavička, kde se řeší všechno","🪑","#9b6b3f"],
 ["zastavka","Zastávka busu",8,"Zastávka Poslední 3 minuty","🚌","#2f72d6"],
 ["vecerka","Večerka",8,"Večerka Otevřeno do kdy se mi chce","🛒","#2fa35a"],
 ["hospoda","Hospoda",10,"U Zlatého Radaru","🍺","#7a3a22"],
 ["workout","Hřiště / workout",10,"Workout pro ty, co tam fakt chodí","💪","#d04f3a"],
 ["kavarna","Kavárna",12,"Kafe & drby","☕","#2d2a33"],
 ["hasicarna","Hasičárna",15,"SDH Rychlí jak Wi-Fi","🚒","#c33"],
 ["fotbal","Fotbalové hřiště",15,"Stadion Okresní přebor Arena","⚽","#3f8f3a"],
 ["pizzerie","Pizzerie",18,"Pizza Alla Říčanská","🍕","#c0392b"],
 ["rybnik","Rybník s molem",20,"Rybník, kde nikdo nic nechytil","🎣","#3f8fc4"],
 ["knihovna","Knihovna",25,"Knihovna a Wi-Fi zdarma","📚","#2f72d6"],
 ["skatepark","Skatepark",25,"Skatepark Odřená kolena","🛹","#6b7280"],
 ["kino","Kino pod širákem",30,"Letní kino i v prosinci","🎬","#1f3c8f"],
 ["nadrazi","Nádraží / P+R",30,"Nádraží Vlak má zase zpoždění","🚆","#1f3c8f"],
 ["koupaliste","Koupaliště",40,"Koupko Jen v červenci","🏊","#41b4e6"],
 ["rozhledna","Rozhledna",40,"Rozhledna Vidím až na D1","🔭","#7a5636"],
 ["podium","Festivalové pódium",50,"Stage Celá vesnice na jednom místě","🎤","#7c3aed"],
 ["kluziste","Kluziště",50,"Kluziště Bruslím jako žirafa","⛸️","#2f72d6"],
 ["tvrz","Tvrz",60,"Tvrz Strážce okresu","🏰","#7a3a22"],
 ["coworking","Coworking",75,"Coworking Wi-Fi rychlejší než D1","💻","#0d1838"],
 ["stadion","Stadion",100,"Aréna Říčanský derby","🏟️","#2f72d6"],
 ["metro","Metro (sen)",100,"Stanice metra Konečně!","🚇","#e4352b"],
 ["letiste","Letiště (meme)",150,"Letiště Václava Radara","✈️","#5fa8e8"],
].map(([id,name,th,example,emoji,color])=>({id,name,th,example,emoji,color}));

function build(id,text){const c=CAT.find(x=>x.id===id);const G=new T.Group();B[id](G);const sx=id==="pomnik"?-1.7:id==="lavicka"?1.4:-1.9;
 sign(G,text||c.example,c.color,c.emoji,sx,id==="pomnik"?1.9:2.5,id==="pomnik"||id==="lavicka"?2.2:2.7);G.userData.special={id,text:text||c.example};return G}
window.SPECIALS={CAT,build,signTexture,bench,tree:(G,x,z,s)=>tree(G,x,z,s),prop:(G,k,x,z,s,r)=>prop(G,k,x,z,s,r),M};
})();
