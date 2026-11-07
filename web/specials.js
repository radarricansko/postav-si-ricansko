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
B.kebab=(G)=>{pad(G,6,5.6,"#d8d2c6");kenney(G,"h","#e0572b",0,-.6,3.1);awning(G,3.2,0,1.25,1.15,"#e4352b","#ffffff",.8);umbrella(G,1.9,1.9,"#ffd23f");umbrella(G,.4,2.2,"#e4352b");prop(G,"dumpster",-2.5,-1.7,3)};
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
B.rozhledna=(G)=>{pad(G,4.4,4.4,"#cdbf98",.06);const H=6.4,r0=1.25,r1=.55;const rad=y=>r0+(r1-r0)*y/H;
 for(let i=0;i<4;i++){const a=i*Math.PI/2+Math.PI/4;beam(G,[Math.cos(a)*r0,0,Math.sin(a)*r0],[Math.cos(a)*r1,H,Math.sin(a)*r1],.09,"#7a5636")}
 [1.6,3.2,4.8].forEach(y=>{const w=rad(y)*1.5;box(G,w,.1,w,"#9b6b3f",0,y,0);for(let i=0;i<4;i++){const a=i*Math.PI/2+Math.PI/4,b=a+Math.PI/2;beam(G,[Math.cos(a)*rad(y-1.6),y-1.55,Math.sin(a)*rad(y-1.6)],[Math.cos(b)*rad(y),y,Math.sin(b)*rad(y)],.04,"#6b4a2c")}});
 const top=r1*1.9;box(G,top,.12,top,"#9b6b3f",0,H,0);[[0,top/2],[0,-top/2]].forEach(([x,z])=>box(G,top,.5,.05,"#7a5636",x,H+.12,z));[[top/2,0],[-top/2,0]].forEach(([x,z])=>box(G,.05,.5,top,"#7a5636",x,H+.12,z));
 for(let i=0;i<4;i++){const a=i*Math.PI/2+Math.PI/4;cyl(G,.05,.05,1.1,"#6b4a2c",Math.cos(a)*top*.66,H+.12,Math.sin(a)*top*.66,5)}const r=new T.ConeGeometry(top*.95,.9,4);r.rotateY(Math.PI/4);r.translate(0,H+1.65,0);G.add(mesh(r,"#7a3a22"));
 cyl(G,.04,.04,.9,"#e4352b",0,H+2.1,0,4)};
B.podium=(G)=>{pad(G,6,5.6,"#4b5263",.05);box(G,4.6,.8,2.6,"#2a2f3a",0,0,-1.2);[-2.2,2.2].forEach(x=>{box(G,.15,3.4,.15,"#9aa1ad",x,0,-2.4);box(G,.15,3.4,.15,"#9aa1ad",x,0,0)});box(G,4.6,.2,2.6,"#9aa1ad",0,3.4,-1.2);
 ["#ff3b6b","#ffd23f","#5fa8e8","#7cf29a"].forEach((c,i)=>{const s=new T.SphereGeometry(.16,8,6);s.translate(0,3.25,0);G.add(mesh(s,new T.MeshBasicMaterial({color:c}),-1.6+i*1.05,0,-.1))});box(G,.8,1.4,.6,"#111",-1.9,.8,-1.8);box(G,.8,1.4,.6,"#111",1.9,.8,-1.8)};


/* ===== velké stavby (předělané), půdorysy fp v jednotkách scény; domek ≈ poloměr 2.4 ===== */
const SEATS=["#e0572b","#2f72d6","#2f72d6","#e0572b"];
function stand(G,x,z,len,ry,rows=5,col="#2f72d6"){// tribuna: stupňovité řady sedaček s betonovou spodní částí
 const g=new T.Group();for(let k=0;k<rows;k++){box(g,len,.42,.9,"#b8bcc6",0,k*.42,k*.9);for(let sx=-len/2+.5;sx<len/2-.3;sx+=.6)box(g,.5,.22,.5,(Math.floor((sx+len/2)/.6)+k)%3===0?"#d9dde5":col,sx,k*.42+.42,k*.9+.12)}
 box(g,len,.2,rows*.9,"#9aa1ad",0,-.02,(rows*.9)/2-.45);box(g,len+.4,rows*.42+1.2,.35,"#d9dde5",0,0,rows*.9-.15);// zadní stěna
 for(let sx=-len/2;sx<=len/2;sx+=len/4)box(g,.3,rows*.42+1.2,.4,"#9aa1ad",sx,0,rows*.9-.15);g.position.set(x,0,z);g.rotation.y=ry;G.add(g);return g}
function floodlight(G,x,z,h=9){cyl(G,.14,.2,h,"#9aa1ad",x,0,z,8);box(G,1.4,.9,.25,"#2a2f3a",x,h,z);for(let i=0;i<4;i++){const l=mesh(new T.SphereGeometry(.14,8,6),new T.MeshLambertMaterial({color:"#fff7c2",emissive:"#ffe27a",emissiveIntensity:.8}),x-.5+i*.33,h+.45,z+.18);G.add(l)}}
function parking(G,x,z,w,d,ry=0,n=6){const g=new T.Group();pad(g,w,d,"#7b8190",.05);for(let i=0;i<n;i++){const px=-w/2+1+i*((w-2)/Math.max(1,n-1));box(g,.08,.02,d-.6,"#e9edf5",px,.05,0);if(i%2===0&&window.MODELS)car(g,["sedan","suv","taxi","van","hatchback-sports","delivery"][i%6],px+(w-2)/Math.max(1,n-1)/2,0,Math.PI/2,.5)}
 g.position.set(x,0,z);g.rotation.y=ry;G.add(g);return g}
B.stadion=(G)=>{// fp 10: hřiště 11×7, tribuny ze 4 stran, střecha nad hlavní, stožáry, brána, parkoviště
 const t=lines(600,400,(g,w,h)=>{for(let i=0;i<10;i++){g.fillStyle=i%2?"#4c9a3c":"#58a845";g.fillRect(i*w/10,0,w/10,h)}g.strokeStyle="#fff";g.lineWidth=5;g.strokeRect(30,30,w-60,h-60);g.beginPath();g.moveTo(w/2,30);g.lineTo(w/2,h-30);g.stroke();g.beginPath();g.arc(w/2,h/2,46,0,7);g.stroke();g.strokeRect(30,h/2-80,70,160);g.strokeRect(w-100,h/2-80,70,160)});
 pad(G,19,15,"#b8bcc6",.06);const p=pad(G,11,7,"#fff",.1);p.material=new T.MeshLambertMaterial({map:t});
 // branky
 [-5.4,5.4].forEach(x=>{[-1,1].forEach(sd=>cyl(G,.04,.04,.9,"#fff",x,.1,sd*.9,6));const bar=new T.BoxGeometry(.06,.06,1.8);G.add(mesh(bar,"#fff",x,1,0))});
 // tribuny: podélné (sever/jih) a čelní (východ/západ)
 stand(G,0,4.3,11.6,0,7,"#2f72d6");stand(G,0,-4.3,11.6,Math.PI,7,"#e0572b");stand(G,6.4,0,7.6,-Math.PI/2,5,"#e0572b");stand(G,-6.4,0,7.6,Math.PI/2,5,"#2f72d6");
 // střecha hlavní tribuny (sever) na sloupech
 for(let x=-5.5;x<=5.5;x+=2.75)cyl(G,.14,.14,6.2,"#9aa1ad",x,0,10.6,8);const roof=box(G,12.6,.25,6.2,"#e9edf5",0,6.1,7.6);roof.rotation.x=.14;const roof2=box(G,8,.22,4.2,"#e9edf5",0,5.1,-7.0);roof2.rotation.x=-.14;for(let x=-3;x<=3;x+=3)cyl(G,.12,.12,5.2,"#9aa1ad",x,0,-9.3,8);
 // stožáry + zábradlí po obvodu + brána + nápis
 [[-8.2,-6.2],[8.2,-6.2],[-8.2,6.2],[8.2,6.2]].forEach(([x,z])=>floodlight(G,x,z,9));
 box(G,19,.9,.12,"#9aa1ad",0,0,-7.4);box(G,.12,.9,15,"#9aa1ad",9.4,0,0);box(G,.12,.9,15,"#9aa1ad",-9.4,0,0);
 box(G,.5,3.2,.5,"#2a2f3a",-2.2,0,-7.4);box(G,.5,3.2,.5,"#2a2f3a",2.2,0,-7.4);box(G,5,.6,.5,"#2a2f3a",0,3.2,-7.4);
 parking(G,-13,0,6,12,0,5);parking(G,13,0,6,12,0,5);tree(G,-12,-7.5,4);tree(G,12,7.5,4);
 [-6,-2,2,6].forEach(x=>prop(G,"lamp",x,-8.3,3));};
B.nadrazi=(G)=>{// fp 7: nástupiště s přístřeškem, výpravní budova, koleje, P+R
 pad(G,14,9,"#c6c9d0",.06);
 // koleje (2) podél osy x
 for(let z=-3.2;z<=-1.6;z+=1.6){box(G,14,.06,.9,"#8a7a62",0,0,z);for(let x=-6.8;x<=6.8;x+=.45)box(G,.2,.08,.9,"#6b5b45",x,.06,z);[-.3,.3].forEach(o=>box(G,14,.06,.07,"#9aa1ad",0,.14,z+o))}
 // nástupiště
 box(G,12,.45,2.4,"#d9d4cb",0,0,.4);box(G,12,.02,.1,"#ffd23f",0,.46,-.7);
 for(let x=-5;x<=5;x+=2.5)cyl(G,.1,.1,2.8,"#5a6170",x,.45,.6,8);box(G,12.4,.15,2.8,"#1f3c8f",0,3.2,.5);
 // výpravní budova
 kenney(G,"m","#5a6170",0,3.6,3.6);box(G,1.2,.08,.6,"#1f3c8f",0,2.9,1.9);
 // hodiny + lavičky + lampy + cedule
 const clk=canvasTex(128,128,g=>{g.fillStyle="#fff";g.beginPath();g.arc(64,64,60,0,7);g.fill();g.strokeStyle="#111";g.lineWidth=6;g.stroke();g.beginPath();g.moveTo(64,64);g.lineTo(64,20);g.moveTo(64,64);g.lineTo(96,64);g.stroke()});
 cyl(G,.06,.06,2.4,"#5a6170",-5.6,.45,1.2,6);[1,-1].forEach(sd=>{const c=new T.Mesh(new T.CircleGeometry(.4,20),new T.MeshBasicMaterial({map:clk}));c.position.set(-5.6,2.9,1.2+sd*.05);if(sd<0)c.rotation.y=Math.PI;G.add(c)});
 bench(G,-2.5,1.2);bench(G,2.5,1.2);prop(G,"lamp",-6.5,4.2,3);prop(G,"lamp",6.5,4.2,3);
 // P+R parkoviště za budovou
 parking(G,5,4.2,7,4,0,5);
 // vlak na vzdálenější koleji
 const tr=new T.Group();box(tr,5.2,1.2,.85,"#1f3c8f",0,.3,0);box(tr,5,.5,.8,"#e9edf5",0,1.5,0);for(let x=-2;x<=2;x+=1)box(tr,.6,.4,.02,"#9fd0f2",x,.85,.44);box(tr,.5,.4,.3,"#e4352b",2.6,.4,0);
 tr.position.set(1.5,.08,-3.2);G.add(tr)};
B.letiste=(G)=>{// fp 14: ranvej, pojezdová dráha, terminál, věž, hangár, 2 letadla, rukáv
 pad(G,28,16,"#8fae63",.04);
 const rw=lines(900,160,(g,w,h)=>{g.fillStyle="#555b66";g.fillRect(0,0,w,h);g.fillStyle="#fff";for(let x=30;x<w-30;x+=60)g.fillRect(x,h/2-4,34,8);g.fillRect(10,16,w-20,5);g.fillRect(10,h-21,w-20,5);for(let i=0;i<8;i++){g.fillRect(20+i*12,30,6,40);g.fillRect(w-26-i*12,h-70,6,40)}});
 const r=pad(G,26,4.4,"#fff",.08);r.material=new T.MeshLambertMaterial({map:rw});r.position.z=-4.5;
 pad(G,22,1.6,"#6b717c",.07).position.z=-1.2;box(G,1.6,.07,3.4,"#6b717c",-9,.0,-2.8);box(G,1.6,.07,3.4,"#6b717c",6,0,-2.8);
 // terminál
 const term=new T.Mesh(new T.BoxGeometry(9,2.2,3.2),new T.MeshLambertMaterial({color:"#9fd0f2",transparent:true,opacity:.85}));term.position.set(-2,1.1,3.2);term.castShadow=true;G.add(term);
 for(let x=-6;x<=2;x+=1.6)box(G,.14,2.2,3.3,"#e9edf5",x,0,3.2);box(G,9.4,.25,3.6,"#e9edf5",-2,2.2,3.2);box(G,2.4,.6,.2,"#1f3c8f",-2,2.45,1.5);
 // věž
 cyl(G,.5,.6,6,"#e9edf5",6.5,0,3.5,10);const cab=new T.Mesh(new T.CylinderGeometry(1.5,1.1,1.2,10),new T.MeshLambertMaterial({color:"#9fd0f2",transparent:true,opacity:.9}));cab.position.set(6.5,6.6,3.5);G.add(cab);cyl(G,1.6,1.6,.25,"#2a2f3a",6.5,7.2,3.5,10);cyl(G,.04,.04,1.5,"#9aa1ad",6.5,7.4,3.5,6);
 // hangár
 const hg=new T.CylinderGeometry(2.6,2.6,5,16,1,false,0,Math.PI);hg.rotateZ(Math.PI/2);hg.rotateY(Math.PI/2);G.add(mesh(hg,"#b8bcc6",-10.5,0,3.4));box(G,5,.1,5.2,"#9aa1ad",-10.5,0,3.4);box(G,4.4,2.2,.2,"#2a2f3a",-10.5,0,.9);
 // letadla
 const plane=(x,z,ry,col)=>{const pl=new T.Group();const body=new T.CylinderGeometry(.32,.26,4,12);body.rotateX(Math.PI/2);pl.add(mesh(body,"#f4f6fa",0,.75,0));pl.add(mesh(new T.SphereGeometry(.32,10,8),"#f4f6fa",0,.75,2));
  const tail=new T.ConeGeometry(.26,.9,10);tail.rotateX(-Math.PI/2);pl.add(mesh(tail,"#f4f6fa",0,.75,-2.4));box(pl,4.6,.08,.8,"#e9edf5",0,.7,.2);box(pl,1.6,.06,.45,"#e9edf5",0,.85,-2.2);box(pl,.08,1,.6,col,0,.8,-2.3);
  [-1.1,1.1].forEach(w=>{const e=new T.CylinderGeometry(.16,.16,.7,8);e.rotateX(Math.PI/2);pl.add(mesh(e,"#9aa1ad",w,.52,.3))});[[0,1.2],[-.7,-.2],[.7,-.2]].forEach(([wx,wz])=>cyl(pl,.08,.08,.4,"#2a2f3a",wx,.05,wz,6));
  for(let i=-1.2;i<=1.2;i+=.4)box(pl,.03,.12,.2,"#1f3c8f",.33,.85,i);pl.position.set(x,.08,z);pl.rotation.y=ry;G.add(pl)};
 plane(-4,-4.5,Math.PI/2,"#e0572b");plane(2.5,-1.2,Math.PI/2+.35,"#2f72d6");
 // větrný rukáv + ploty + auta
 cyl(G,.04,.04,2.6,"#9aa1ad",11.5,0,-7.2,6);const sock=new T.ConeGeometry(.22,1.2,8);sock.rotateZ(-Math.PI/2);G.add(mesh(sock,"#e0572b",12.2,2.5,-7.2));
 parking(G,3,6.4,8,3,0,6);tree(G,-13,-7,4);tree(G,13,7,4);[-12,-4,4,12].forEach(x=>prop(G,"lamp",x,7.6,3))};
B.tvrz=(G)=>{// fp 5: kamenná tvrz – hradby s cimbuřím, 4 nárožní věže, brána s mostem, vnitřní věž s vlajkou
 pad(G,10,10,"#8f9f6a",.04);const STONE="#bdb5a6",STONE2="#a69d8d";const W=7,H=2.4;
 // příkop
 const moat=new T.Mesh(new T.RingGeometry(4.4,5.6,40),new T.MeshLambertMaterial({color:"#3f8fc4"}));moat.rotation.x=-Math.PI/2;moat.position.y=.05;G.add(moat);
 // hradby
 [[0,-W/2,W,0],[0,W/2,W,0],[-W/2,0,W,Math.PI/2],[W/2,0,W,Math.PI/2]].forEach(([x,z,l,ry])=>{const g=new T.Group();box(g,l,H,.7,STONE,0,0,0);for(let k=-l/2+.35;k<l/2;k+=.7)if(Math.round(k*10)%14===0||true){if(Math.floor((k+l/2)/.7)%2===0)box(g,.5,.45,.7,STONE2,k,H,0)}g.position.set(x,0,z);g.rotation.y=ry;G.add(g)});
 // nárožní věže
 [[-W/2,-W/2],[W/2,-W/2],[-W/2,W/2],[W/2,W/2]].forEach(([x,z])=>{cyl(G,1,1.05,H+1.4,STONE,x,0,z,12);for(let k=0;k<8;k++)box(G,.4,.4,.35,STONE2,x+Math.cos(k/8*6.283)*.9,H+1.4,z+Math.sin(k/8*6.283)*.9);const c=new T.Mesh(new T.ConeGeometry(1.15,1.4,12),M("#7a3a22"));c.position.set(x,H+1.4+.9,z);c.castShadow=true;G.add(c)});
 // brána + most
 box(G,2.2,2.1,.9,"#5a4a3a",0,0,W/2,0);const arch=new T.Mesh(new T.CylinderGeometry(1,1,.95,12,1,false,0,Math.PI),M(STONE2));arch.rotation.z=Math.PI/2;arch.rotation.y=Math.PI/2;arch.position.set(0,2.1,W/2);G.add(arch);
 box(G,1.4,.1,2.4,"#8b6a3e",0,.5,W/2+1.4);[-.7,.7].forEach(x=>box(G,.08,.5,2.4,"#8b6a3e",x,.5,W/2+1.4));
 // vnitřní věž (donjon) + vlajka + nádvoří
 pad(G,W-1.2,W-1.2,"#c9b99a",.08);box(G,2.6,5.2,2.6,STONE,0,0,-.6);box(G,3,.3,3,STONE2,0,5.2,-.6);for(let k=0;k<4;k++){const a=k/4*6.283+.78;box(G,.5,.5,.5,STONE2,Math.cos(a)*1.4,5.5,-.6+Math.sin(a)*1.4)}
 const r=new T.Mesh(new T.ConeGeometry(1.9,2.2,4),M("#7a3a22"));r.rotation.y=Math.PI/4;r.position.set(0,6.6,-.6);r.castShadow=true;G.add(r);
 cyl(G,.05,.05,2.4,"#9aa1ad",0,7.6,-.6,6);box(G,1,.6,.05,"#e4352b",.55,9.3,-.6);
 for(let k=0;k<4;k++)box(G,.5,.9,.1,"#1f3c8f",-1,1.6+k*0,-.6+1.32,0);box(G,.4,.8,.1,"#1f3c8f",0,2.9,.72);box(G,.4,.8,.1,"#1f3c8f",0,4.2,.72);
 tree(G,2.2,1.6,2.6);prop(G,"lamp",-2.4,2.2,2.6)};
B.fotbal=(G)=>{// fp 7: hřiště s lajnami, branky, střídačky, malá tribuna, osvětlení
 const t=lines(600,420,(g,w,h)=>{for(let i=0;i<8;i++){g.fillStyle=i%2?"#4c9a3c":"#58a845";g.fillRect(i*w/8,0,w/8,h)}g.strokeStyle="#fff";g.lineWidth=5;g.strokeRect(30,30,w-60,h-60);g.beginPath();g.moveTo(w/2,30);g.lineTo(w/2,h-30);g.stroke();g.beginPath();g.arc(w/2,h/2,50,0,7);g.stroke();g.strokeRect(30,h/2-90,80,180);g.strokeRect(w-110,h/2-90,80,180)});
 pad(G,13,10,"#8fae63",.05);const p=pad(G,9.6,6.6,"#fff",.09);p.material=new T.MeshLambertMaterial({map:t});
 [-4.7,4.7].forEach(x=>{[-1,1].forEach(sd=>cyl(G,.04,.04,.8,"#fff",x,.09,sd*.8,6));G.add(mesh(new T.BoxGeometry(.05,.05,1.6),"#fff",x,.9,0))});
 stand(G,0,4,8,0,3,"#2f72d6");[-2.6,2.6].forEach(x=>{box(G,2,.9,.8,"#2a2f3a",x,0,-4.2);box(G,2.2,.1,1,"#9fd0f2",x,.95,-4.2)});
 [[-6,-4.6],[6,-4.6],[-6,4.6],[6,4.6]].forEach(([x,z])=>floodlight(G,x,z,6));box(G,13,.6,.08,"#9aa1ad",0,0,-5);prop(G,"lamp",-6.3,0,3)};
B.koupaliste=(G)=>{// fp 5: bazén s plavci, skluzavka, lehátka, bufet
 pad(G,10,8,"#efe7d4",.06);const w=new T.Mesh(new T.BoxGeometry(6.4,.1,3.6),M("#41b4e6"));w.position.set(-.6,.12,-.6);w.receiveShadow=true;G.add(w);
 const lane=canvasTex(256,128,g=>{g.fillStyle="#41b4e6";g.fillRect(0,0,256,128);g.strokeStyle="#fff";g.lineWidth=3;for(let y=16;y<128;y+=24){g.beginPath();g.moveTo(0,y);g.lineTo(256,y);g.stroke()}});w.material=new T.MeshLambertMaterial({map:lane});
 box(G,6.8,.14,.3,"#d9d4cb",-.6,.1,-2.55);box(G,6.8,.14,.3,"#d9d4cb",-.6,.1,1.35);box(G,.3,.14,3.9,"#d9d4cb",-3.95,.1,-.6);box(G,.3,.14,3.9,"#d9d4cb",2.75,.1,-.6);
 // skluzavka
 cyl(G,.1,.1,2.6,"#9aa1ad",3.6,0,-1.6,6);box(G,.6,.1,2.4,"#ffd23f",3.6,2.2,-.8).rotation.x=.6;
 // lehátka + slunečníky + bufet
 [[-3,2.4],[-1.6,2.4],[-.2,2.4],[1.2,2.4]].forEach(([x,z])=>{box(G,.9,.12,.45,"#f4f6fa",x,.3,z);box(G,.3,.4,.45,"#f4f6fa",x-.3,.3,z,0)});umbrella(G,-2.3,2.9,"#e0572b");umbrella(G,.5,2.9,"#2f72d6");
 box(G,2.4,1.3,1.4,"#fff2cc",3.5,0,2.6);awning(G,2.6,3.5,1.35,1.9,"#e4352b","#ffffff",.8);tree(G,-4.4,3.2,3.6);prop(G,"lamp",4.6,-3.2,3)};
const CAT=[
 ["kebab","Kebab / bistro",5,"Kebab u Alenky","🥙","#e0572b",2.6],
 ["vecerka","Večerka",8,"Večerka U Pepy","🛒","#2fa35a",2.6],
 ["hospoda","Hospoda",10,"Hospoda U Dvorku","🍺","#7a3a22",2.6],
 ["workout","Hřiště / workout",10,"Hřiště Za školou","💪","#d04f3a",2.8],
 ["kavarna","Kavárna",12,"Kavárna Na rohu","☕","#2d2a33",2.6],
 ["hasicarna","Hasičárna",15,"Hasičárna SDH Mukařov","🚒","#c33",3.2],
 ["fotbal","Fotbalové hřiště",15,"Hřiště Sokol Strančice","⚽","#3f8f3a",7],
 ["pizzerie","Pizzerie",18,"Pizzerie Da Terka","🍕","#c0392b",2.6],
 ["rybnik","Rybník s molem",20,"Rybník Mlýnský","🎣","#3f8fc4",4],
 ["knihovna","Knihovna",25,"Knihovna Jana Nerudy","📚","#2f72d6",2.6],
 ["skatepark","Skatepark",25,"Skatepark Betonka","🛹","#6b7280",4.2],
 ["kino","Kino pod širákem",30,"Letní kino Na louce","🎬","#1f3c8f",4.2],
 ["nadrazi","Nádraží / P+R",30,"Nádraží Mnichovice","🚆","#1f3c8f",7],
 ["koupaliste","Koupaliště",40,"Koupaliště Jureček","🏊","#41b4e6",5],
 ["rozhledna","Rozhledna",40,"Rozhledna Na Klokočné","🔭","#7a5636",3.4],
 ["podium","Festivalové pódium",50,"Stage Letní slavnosti","🎤","#7c3aed",4.2],
 ["tvrz","Tvrz",60,"Tvrz Popovická","🏰","#7a3a22",5.5],
 ["stadion","Stadion",100,"Stadion Říčanské derby","🏟️","#2f72d6",10],
 ["letiste","Letiště",150,"Letiště Mukařov","✈️","#5fa8e8",14],
].map(([id,name,th,example,emoji,color,fp])=>({id,name,th,example,emoji,color,fp}));
const fp=id=>{const c=CAT.find(x=>x.id===id);return c?c.fp:2.6};
function build(id,text){const c=CAT.find(x=>x.id===id)||CAT[0];const G=new T.Group();(B[c.id]||B.hospoda)(G);const f=c.fp;
 // cedule před vchodem: u malých staveb vlevo u chodníku, u velkých u vjezdu
 const sx=f<=3.4?-1.9:-(f*.25),sz=f<=3.4?2.5:f*.62,w=f<=3.4?2.7:Math.min(4,2.7+f*.08);
 sign(G,text||c.example,c.color,c.emoji,sx,sz,w);G.userData.special={id:c.id,text:text||c.example};return G}
window.SPECIALS={CAT,build,fp,signTexture,bench,tree:(G,x,z,s)=>tree(G,x,z,s),prop:(G,k,x,z,s,r)=>prop(G,k,x,z,s,r),M};
})();
