/* Postav si Říčansko v2 – hra. Data: MAP (OSM silnice, obce), LAND (lesy, pole, voda), SPECIALS, ERB, KIT. */
(function(){
"use strict";
const T=THREE;
/* ---------- nastavení ---------- */
const QS=new URLSearchParams(location.search);
const CONFIG={
 SHOW_NICKS:QS.get("nicky")!=="0",          // false = na webu jen číslo obyvatele (ochrana nezletilých)
 DATA_URL:QS.get("data")||"world.json",     // herní stav (plní Make)
 POLL_MS:120000,                            // jak často kontrolovat nová data
 DEMO:QS.get("demo")==="1",                 // vynutit ukázková data
 OPEN_AT:+(QS.get("mlha")||1),              // od kolika obyvatel je obec vidět (1 = bez mlhy)
 JOBS:QS.get("povolani")==="1",              // povolání jsou vypnutá (zjednodušení hry); ?povolani=1 je zapne
 JOB_N:5,            // kolik lidí stejného povolání postaví jejich budovu
 REVIVE:+(QS.get("ozivit")||5)              // pod tímto počtem obyvatel je obec „opuštěná“ (šedé opuštěné domy)
};
/* povolání → budova, kterou si postaví */
const JOBS={hasic:{n:"Hasič",e:"🧑‍🚒",b:"hasicarna",t:o=>"SDH "+o},kuchar:{n:"Kuchař",e:"🧑‍🍳",b:"pizzerie",t:o=>"Kuchyně "+o},hospodsky:{n:"Hospodský",e:"🍺",b:"hospoda",t:o=>"Hospoda "+o},
 prodavac:{n:"Prodavač",e:"🛒",b:"vecerka",t:o=>"Večerka "+o},barista:{n:"Barista",e:"☕",b:"kavarna",t:o=>"Kavárna "+o},fotbalista:{n:"Fotbalista",e:"⚽",b:"fotbal",t:o=>"Hřiště "+o},
 sportovec:{n:"Sportovec",e:"💪",b:"workout",t:o=>"Workout "+o},skejtak:{n:"Skejťák",e:"🛹",b:"skatepark",t:o=>"Skatepark "+o},ridic:{n:"Řidič",e:"🚌",b:"nadrazi",t:o=>"Nádraží a P+R "+o},
 strojvedouci:{n:"Strojvedoucí",e:"🚆",b:"nadrazi",t:o=>"Nádraží "+o},rybar:{n:"Rybář",e:"🎣",b:"rybnik",t:o=>"Rybník "+o},plavcik:{n:"Plavčík",e:"🏊",b:"koupaliste",t:o=>"Koupaliště "+o},
 ucitel:{n:"Učitel",e:"📚",b:"knihovna",t:o=>"Knihovna "+o},muzikant:{n:"Muzikant",e:"🎸",b:"podium",t:o=>"Stage "+o},hokejista:{n:"Hokejista",e:"🏒",b:"stadion",t:o=>"Stadion "+o},
 programator:{n:"Programátor",e:"💻",b:"knihovna",t:o=>"Knihovna a Wi-Fi "+o},filmar:{n:"Filmař",e:"🎬",b:"kino",t:o=>"Kino "+o},turista:{n:"Turista",e:"🥾",b:"rozhledna",t:o=>"Rozhledna "+o},
 rytir:{n:"Rytíř",e:"🛡️",b:"tvrz",t:o=>"Tvrz "+o},pilot:{n:"Pilot",e:"✈️",b:"letiste",t:o=>"Letiště "+o}};
const JOB_ALIAS={hasic:"hasic",hasicka:"hasic",kuchar:"kuchar",kucharka:"kuchar",hospodsky:"hospodsky",hospodska:"hospodsky",barman:"hospodsky",barmanka:"hospodsky",prodavac:"prodavac",prodavacka:"prodavac",barista:"barista",kavarnik:"barista",
 fotbalista:"fotbalista",fotbalistka:"fotbalista",sportovec:"sportovec",sportovkyne:"sportovec",trener:"sportovec",skejtak:"skejtak",skater:"skejtak",ridic:"ridic",ridicka:"ridic",strojvedouci:"strojvedouci",vypravci:"strojvedouci",
 rybar:"rybar",rybarka:"rybar",plavcik:"plavcik",plavcice:"plavcik",ucitel:"ucitel",ucitelka:"ucitel",muzikant:"muzikant",muzikantka:"muzikant",dj:"muzikant",hokejista:"hokejista",programator:"programator",programatorka:"programator",ajtak:"programator",
 filmar:"filmar",filmarka:"filmar",turista:"turista",turistka:"turista",rytir:"rytir",pilot:"pilot",pilotka:"pilot"};
const jobOf=x=>{if(!x)return null;const k=String(x).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z]/g,"");return JOB_ALIAS[k]||(JOBS[k]?k:null)};
const $=id=>document.getElementById(id);
const setMsg=t=>{const e=$("loadMsg");if(e)e.textContent=t};

/* ---------- konstanty ---------- */
const CENTER={x:-2353,y:-1346,name:"Náměstí sjednocení",scale:.72};const FIXED_MAP=true;
const L=0.23;              // měřítko uvnitř obce (jednotek na metr)
const GAP=5, SPREAD=1.15;  // rozestup obcí při roztahování světa
const LOT=6.6, MAXR=170, HOUSE_S=3.6;
const ROOFS=["#c45c3e","#9c3f2c","#4e5260","#8a6646"],ROOF_W=[.42,.26,.18,.14];
const CLS={M:{w:4.8,y:.078},L:{w:1.5,y:.063},P:{w:2.7,y:.070},S:{w:2.3,y:.068},T:{w:1.9,y:.066},Z:{w:1.6,y:.05},G:{w:1.9,y:.061}};
let S=0.05,Starget=0.05;

function rng(s){return()=>{s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const smooth=s=>s<=0?0:s>=1?1:s*s*(3-2*s);
const hashStr=s=>{let h=2166136261;for(const c of s)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0};

/* ---------- renderer ---------- */
const canvas=$("gl");
const R=new T.WebGLRenderer({canvas,antialias:true,alpha:true,preserveDrawingBuffer:true});
R.setPixelRatio(Math.min(devicePixelRatio,2));R.setSize(innerWidth,innerHeight);R.shadowMap.enabled=true;R.shadowMap.type=T.PCFSoftShadowMap;
R.setClearColor(0x000000,0);R.autoClear=true;
const scene=new T.Scene();
const FOGC=new T.Color("#d7e2e2");scene.fog=new T.Fog(FOGC,600,2600);
{const c=document.createElement("canvas");c.width=4;c.height=256;const g=c.getContext("2d");const gr=g.createLinearGradient(0,0,0,256);gr.addColorStop(0,"#6fa9da");gr.addColorStop(.55,"#b9d6e8");gr.addColorStop(.8,"#e9e1cf");gr.addColorStop(1,"#d7e2e2");g.fillStyle=gr;g.fillRect(0,0,4,256);scene.background=new T.CanvasTexture(c)}
const cam=new T.PerspectiveCamera(34,innerWidth/innerHeight,2,24000);
const ctr=new T.OrbitControls(cam,canvas);ctr.enableDamping=true;ctr.dampingFactor=.08;ctr.maxPolarAngle=1.32;ctr.minDistance=14;ctr.maxDistance=2600;ctr.screenSpacePanning=false;ctr.zoomSpeed=1.2;ctr.touches={ONE:T.TOUCH.PAN,TWO:T.TOUCH.DOLLY_ROTATE};ctr.mouseButtons={LEFT:T.MOUSE.PAN,MIDDLE:T.MOUSE.DOLLY,RIGHT:T.MOUSE.ROTATE};
/* klávesnice: WSAD / šipky = posun, Q/E = otočení, R/F nebo +/− = přiblížení, Shift = rychleji */
const KEYS=new Set();addEventListener("keydown",e=>{if(e.target&&/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||e.metaKey||e.ctrlKey)return;const k=e.key.toLowerCase();if(k.length===1&&"wsadqerf+-".includes(k)||k.startsWith("arrow")||k==="shift"){KEYS.add(k);if(k.startsWith("arrow"))e.preventDefault()}});
addEventListener("keyup",e=>KEYS.delete(e.key.toLowerCase()));addEventListener("blur",()=>KEYS.clear());
function keyMove(dt){if(!KEYS.size||(KEYS.size===1&&KEYS.has("shift")))return;const off=cam.position.clone().sub(ctr.target);const dist=off.length();const fwd=new T.Vector3(-off.x,0,-off.z).normalize(),right=new T.Vector3(-fwd.z,0,fwd.x);
 let mx=0,mz=0;if(KEYS.has("w")||KEYS.has("arrowup"))mz+=1;if(KEYS.has("s")||KEYS.has("arrowdown"))mz-=1;if(KEYS.has("d")||KEYS.has("arrowright"))mx+=1;if(KEYS.has("a")||KEYS.has("arrowleft"))mx-=1;
 if(mx||mz){const sp=dist*1.15*dt*(KEYS.has("shift")?2.4:1);const mv=fwd.clone().multiplyScalar(mz*sp).add(right.multiplyScalar(mx*sp));ctr.target.add(mv);cam.position.add(mv)}
 let rot=0;if(KEYS.has("q"))rot+=1;if(KEYS.has("e"))rot-=1;if(rot){const a=rot*1.5*dt;const o=cam.position.clone().sub(ctr.target);const c=Math.cos(a),sn=Math.sin(a);cam.position.set(ctr.target.x+o.x*c-o.z*sn,cam.position.y,ctr.target.z+o.x*sn+o.z*c)}
 let zm=0;if(KEYS.has("r")||KEYS.has("+"))zm-=1;if(KEYS.has("f")||KEYS.has("-"))zm+=1;if(zm){const o=cam.position.clone().sub(ctr.target);const l=o.length();const k=Math.max(ctr.minDistance,Math.min(ctr.maxDistance,l*(1+zm*1.3*dt)))/l;cam.position.copy(ctr.target).add(o.multiplyScalar(k))}}

const hemi=new T.HemisphereLight("#d6e8ff","#6b6340",.5);scene.add(hemi);
const sun=new T.DirectionalLight("#ffd6a3",1.18);sun.castShadow=true;sun.shadow.mapSize.set(+QS.get("shadow")||2048,+QS.get("shadow")||2048);sun.shadow.bias=-.0005;sun.shadow.normalBias=.02;scene.add(sun,sun.target);
const fill=new T.DirectionalLight("#a8c6ff",.18);fill.position.set(-1,.6,1);scene.add(fill);
const SUNDIR=new T.Vector3(-.62,.5,.6).normalize();

/* ---------- filmový post-processing: tilt-shift, barevné ladění, viněta ---------- */
const POST={on:QS.get("post")!=="0"};
(function(){const isGL2=R.capabilities.isWebGL2;
 const mk=(w,h,ms)=>{const o={minFilter:T.LinearFilter,magFilter:T.LinearFilter,format:T.RGBAFormat};const t=(ms&&isGL2&&T.WebGLMultisampleRenderTarget)?new T.WebGLMultisampleRenderTarget(w,h,o):new T.WebGLRenderTarget(w,h,o);if(ms&&t.samples!==undefined)t.samples=4;return t};
 const sz=new T.Vector2();R.getDrawingBufferSize(sz);
 POST.main=mk(sz.x,sz.y,true);POST.a=mk(sz.x>>1,sz.y>>1);POST.b=mk(sz.x>>1,sz.y>>1);
 const quadCam=new T.OrthographicCamera(-1,1,1,-1,0,1);const quad=new T.Mesh(new T.PlaneGeometry(2,2));const qs=new T.Scene();qs.add(quad);
 const vs="varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}";
 const blur=new T.ShaderMaterial({uniforms:{tex:{value:null},dir:{value:new T.Vector2()}},vertexShader:vs,depthTest:false,depthWrite:false,
  fragmentShader:"uniform sampler2D tex;uniform vec2 dir;varying vec2 vUv;void main(){vec4 c=texture2D(tex,vUv)*0.2270;c+=texture2D(tex,vUv+dir*1.3846)*0.3162;c+=texture2D(tex,vUv-dir*1.3846)*0.3162;c+=texture2D(tex,vUv+dir*3.2308)*0.0703;c+=texture2D(tex,vUv-dir*3.2308)*0.0703;gl_FragColor=c;}"});
 const fin=new T.ShaderMaterial({uniforms:{sharp:{value:null},soft:{value:null},tilt:{value:1},focus:{value:.48},band:{value:.16},res:{value:new T.Vector2()}},vertexShader:vs,depthTest:false,depthWrite:false,
  fragmentShader:`uniform sampler2D sharp,soft;uniform float tilt,focus,band;uniform vec2 res;varying vec2 vUv;
  void main(){vec3 s=texture2D(sharp,vUv).rgb;vec3 b=texture2D(soft,vUv).rgb;
   float d=abs(vUv.y-focus);float k=smoothstep(band,band+.32,d)*tilt;vec3 c=mix(s,b,k);
   float bloom=max(max(b.r,b.g),b.b);c+=b*smoothstep(.72,1.,bloom)*.18;
   float l=dot(c,vec3(.2126,.7152,.0722));c=mix(vec3(l),c,1.14);c=(c-.5)*1.07+.5;
   c+=vec3(.035,.012,-.02)*smoothstep(.45,1.,l);c+=vec3(-.02,0.,.03)*(1.-smoothstep(0.,.45,l));
   vec2 q=vUv-.5;q.x*=res.x/res.y;float v=smoothstep(1.05,.32,length(q));c*=mix(.72,1.,v);
   gl_FragColor=vec4(clamp(c,0.,1.),1.);}`});
 POST.resize=()=>{R.getDrawingBufferSize(sz);POST.main.setSize(sz.x,sz.y);POST.a.setSize(sz.x>>1,sz.y>>1);POST.b.setSize(sz.x>>1,sz.y>>1);fin.uniforms.res.value.set(sz.x,sz.y)};POST.resize();
 POST.render=(tilt)=>{if(!POST.on){R.setRenderTarget(null);R.render(scene,cam);return}
  R.setRenderTarget(POST.main);R.render(scene,cam);
  quad.material=blur;blur.uniforms.tex.value=POST.main.texture;blur.uniforms.dir.value.set(1.6/POST.a.width,0);R.setRenderTarget(POST.a);R.render(qs,quadCam);
  blur.uniforms.tex.value=POST.a.texture;blur.uniforms.dir.value.set(0,1.6/POST.a.height);R.setRenderTarget(POST.b);R.render(qs,quadCam);
  blur.uniforms.tex.value=POST.b.texture;blur.uniforms.dir.value.set(2.4/POST.a.width,0);R.setRenderTarget(POST.a);R.render(qs,quadCam);
  blur.uniforms.tex.value=POST.a.texture;blur.uniforms.dir.value.set(0,2.4/POST.a.height);R.setRenderTarget(POST.b);R.render(qs,quadCam);
  quad.material=fin;fin.uniforms.sharp.value=POST.main.texture;fin.uniforms.soft.value=POST.b.texture;fin.uniforms.tilt.value=tilt;R.setRenderTarget(null);R.render(qs,quadCam)};
})();

/* ---------- modely ---------- */
const loader=new T.GLTFLoader();
const load=u=>new Promise((ok,err)=>loader.load(u,ok,undefined,err));
function mergeGeos(gs){let n=0,ni=0;gs.forEach(g=>{n+=g.attributes.position.count;ni+=g.index?g.index.count:g.attributes.position.count});
 const pos=new Float32Array(n*3),nor=new Float32Array(n*3),uv=new Float32Array(n*2),hasC=gs.some(g=>g.attributes.color),col=hasC?new Float32Array(n*3):null,idx=new Uint32Array(ni);let o=0,oi=0;
 gs.forEach(g=>{const c=g.attributes.position.count;pos.set(g.attributes.position.array,o*3);if(g.attributes.normal)nor.set(g.attributes.normal.array,o*3);if(g.attributes.uv)uv.set(g.attributes.uv.array,o*2);
  if(col){if(g.attributes.color)col.set(g.attributes.color.array,o*3);else col.fill(1,o*3,(o+c)*3)}
  if(g.index){const a=g.index.array;for(let i=0;i<a.length;i++)idx[oi+i]=a[i]+o;oi+=a.length}else{for(let i=0;i<c;i++)idx[oi+i]=o+i;oi+=c}o+=c});
 const g=new T.BufferGeometry();g.setAttribute("position",new T.BufferAttribute(pos,3));g.setAttribute("normal",new T.BufferAttribute(nor,3));g.setAttribute("uv",new T.BufferAttribute(uv,2));if(col)g.setAttribute("color",new T.BufferAttribute(col,3));g.setIndex(new T.BufferAttribute(idx,1));return g}
function meshOf(gltf){gltf.scene.updateMatrixWorld(true);const gs=[];let mat=null;gltf.scene.traverse(o=>{if(o.isMesh){const g=o.geometry.clone();g.applyMatrix4(o.matrixWorld);["color","tangent","uv2","skinIndex","skinWeight"].forEach(a=>g.deleteAttribute&&g.attributes[a]&&g.deleteAttribute(a));gs.push(g);mat=o.material}});
 if(mat.map){mat.map.encoding=T.LinearEncoding}return{geo:gs.length===1?gs[0]:mergeGeos(gs),map:mat.map}}
const roofCache={};
function recolorTex(tex,hex){const key=tex.uuid+hex;if(roofCache[key])return roofCache[key];const img=tex.image;const c=document.createElement("canvas");c.width=img.width;c.height=img.height;const g=c.getContext("2d");g.drawImage(img,0,0);
 const rgb=new T.Color(hex);const d=g.getImageData(0,0,c.width,c.height),p=d.data;for(let i=0;i<p.length;i+=4){const r=p[i],gg=p[i+1],b=p[i+2];if(gg>r+30&&gg>b+20){const k=gg/203;p[i]=Math.min(255,rgb.r*255*k);p[i+1]=Math.min(255,rgb.g*255*k);p[i+2]=Math.min(255,rgb.b*255*k)}}
 g.putImageData(d,0,0);const t=new T.CanvasTexture(c);t.flipY=false;t.encoding=T.LinearEncoding;return roofCache[key]=t}
const MODELS=window.MODELS={b:{},p:{},c:{},roofMat:(src,hex)=>{const k="m"+src.map.uuid+hex;return roofCache[k]||(roofCache[k]=new T.MeshLambertMaterial({map:recolorTex(src.map,hex)}))}};
async function loadModels(){
 const bl="abcdgjhkmr".split("");const jobs=[];
 bl.forEach(l=>jobs.push(load("m/building-type-"+l+".json").then(g=>MODELS.b[l]=meshOf(g))));
 [["tree","m/tree-large.json"],["treeS","m/tree-small.json"],["lamp","r/light-square.json"],["dumpster","r/dumpster.json"],["planter","m/planter.json"]].forEach(([k,u])=>jobs.push(load(u).then(g=>{const m=meshOf(g);MODELS.p[k]={geo:m.geo,mat:new T.MeshLambertMaterial({map:m.map})}})));
 ["sedan","suv","taxi","van","firetruck","hatchback-sports","suv-luxury","delivery","police","truck"].forEach(k=>jobs.push(load("c/"+k+".json").then(g=>{const m=meshOf(g);MODELS.c[k]={geo:m.geo,mat:new T.MeshLambertMaterial({map:m.map})}})));
 await Promise.all(jobs)}

/* ---------- obce ---------- */
const TOWNS=MAP.towns.map((t,i)=>({i,n:t.n,x:t.c[0],y:t.c[1],church:t.church,mem:t.mem,cross:t.cross,R:12,d0:12/L,P:0,F:0,players:[],items:[],group:null}));
const byName=Object.fromEntries(TOWNS.map(t=>[t.n,t]));
function updTownParams(){TOWNS.forEach(t=>{t.d0=t.R/L;t.P=t.R*(1-S/L);t.F=4.6*t.P/S;t.lim=t.d0+t.F})}
/* zobrazovací mapování: metry -> svět (spojité, obce si drží měřítko L) */
function F(x,y,o){if(S>=L-1e-9){o[0]=x*S;o[1]=-y*S;return o}let X=x*S,Y=y*S;for(let i=0;i<TOWNS.length;i++){const t=TOWNS[i];const dx=x-t.x,dy=y-t.y,lim=t.lim;if(!(lim>0)||dx>lim||dx<-lim||dy>lim||dy<-lim)continue;const d=Math.hypot(dx,dy);if(d>=lim)continue;
  let k;if(d<=t.d0)k=L-S;else k=(1-smooth((d-t.d0)/t.F))*t.P/d;X+=dx*k;Y+=dy*k}o[0]=X;o[1]=-Y;return o}
const tcA=[0,0];const tc=t=>{F(t.x,t.y,tcA);return new T.Vector3(tcA[0],0,tcA[1])};

/* ---------- silnice: příprava ---------- */
const ROADS=[];
MAP.roads.forEach(([c,pts])=>{const out=[];for(let i=0;i<pts.length;i++){if(i){const a=pts[i-1],b=pts[i];const d=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.ceil(d/28);for(let k=1;k<n;k++)out.push([a[0]+(b[0]-a[0])*k/n,a[1]+(b[1]-a[1])*k/n])}out.push(pts[i])}ROADS.push({c,m:out,d:null})});

/* ---------- vodní plochy (pro kontrolu parcel) ---------- */
function polyFromFlat(a){const p=[];for(let i=0;i<a.length;i+=2)p.push([a[i],a[i+1]]);return p}
function bbox(p){let a=1e9,b=1e9,c=-1e9,d=-1e9;p.forEach(q=>{if(q[0]<a)a=q[0];if(q[1]<b)b=q[1];if(q[0]>c)c=q[0];if(q[1]>d)d=q[1]});return[a,b,c,d]}
function inPoly(x,y,p){let ins=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const a=p[i],b=p[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])ins=!ins}return ins}
const WATER=LAND.W.map(a=>{const p=polyFromFlat(a);return{p,b:bbox(p)}});
const inWater=(x,y)=>WATER.some(w=>x>=w.b[0]&&x<=w.b[2]&&y>=w.b[1]&&y<=w.b[3]&&inPoly(x,y,w.p));

/* ---------- plán obce (lokální jednotky, 0,0 = střed obce) ---------- */
class Hash{constructor(c){this.c=c;this.m=new Map()}k(x,z){return(Math.floor(x/this.c)+4096)*8192+(Math.floor(z/this.c)+4096)}
 add(x,z,v){const k=this.k(x,z);let a=this.m.get(k);if(!a)this.m.set(k,a=[]);a.push(x,z,v)}
 near(x,z,r,skip){const c=this.c,x0=Math.floor((x-r)/c),x1=Math.floor((x+r)/c),z0=Math.floor((z-r)/c),z1=Math.floor((z+r)/c);
  for(let i=x0;i<=x1;i++)for(let j=z0;j<=z1;j++){const a=this.m.get((i+4096)*8192+(j+4096));if(!a)continue;for(let q=0;q<a.length;q+=3){if(skip&&skip(a[q+2]))continue;if((a[q]-x)**2+(a[q+1]-z)**2<r*r)return a[q+2]}}return null}}
const LANDMARK_R={hrad:7.6,pivovar:8,hvezdarna:7,stirin:8.5,berchtold:8.5,kostelec:8.5,rybnik:6,koupaliste:6,zona:9,kostel:5.4,kaple:3.6,pomnik:3};
function landmarkFor(t){const lm=KIT.LANDMARKS[t.n];if(lm)return{type:lm[0],name:lm[1]};
 if(KIT.CHURCH_EXTRA&&KIT.CHURCH_EXTRA[t.n])return{type:"kostel",name:KIT.CHURCH_EXTRA[t.n]};
 return{type:"pomnik",name:t.cross&&!t.mem?"Kříž na návsi":"Pomník na návsi",cross:t.cross&&!t.mem}}

/* ---------- plán obce: navržená čtvrť (mřížka / vlnitá mřížka / prstence) ----------
   Obec už nekopíruje skutečné uličky. Každá má čistý vzor ulic kolem návsi a roste po blocích.
   Dálnici a trati se bloky vyhnou, ostatní silnice se na okraji obce napojí na její ulice. */
const LW=5.8,LD=6.3,SW=CLS.G.w,HOFF=3.15,ZONE=900,ROAD_CLR=4.3;
const PATTERN={"Říčany":0,"Mnichovice":2,"Strančice":1,"Mukařov":2,"Velké Popovice":1,"Kamenice":0,"Ondřejov":2,"Kostelec nad Černými lesy":0,"Světice":2,"Senohraby":1,"Mirošovice":0,"Tehov":1,"Tehovec":2};
function planTown(t){
 const zoneM=ZONE/L;const toL=(x,y)=>({x:(x-t.x)*L,z:-(y-t.y)*L});
 // dálnice + trať (tvrdé překážky) a všechny silnice (pro umístění velkých staveb), lokálně
 const HH=new Hash(8),RH=new Hash(8);
 const runs=[];
 ROADS.forEach(rd=>{const hard=rd.c==="M"||rd.c==="Z";let prev=null,run=null;for(const q of rd.m){const dx=q[0]-t.x,dy=q[1]-t.y;if(dx*dx+dy*dy>zoneM*zoneM){prev=null;run=null;continue}const p=toL(q[0],q[1]);
   const n=prev?Math.max(1,Math.ceil(Math.hypot(p.x-prev.x,p.z-prev.z)/3)):1;for(let k=1;k<=n;k++){const f=k/n;const x=prev?prev.x+(p.x-prev.x)*f:p.x,z=prev?prev.z+(p.z-prev.z)*f:p.z;RH.add(x,z,1);if(hard)HH.add(x,z,1);else{if(!run){run=[];runs.push(run)}run.push(x,z)}}prev=p}});
 t.HH=HH;t.RH=RH;t.roadRuns=runs; // běžné silnice (ne dálnice, ne trať) zůstávají v obci celé; domky jim uhnou a ulice se na ně napojí
 const hardNear=(x,z)=>HH.near(x,z,6.4)!==null,wet=(x,z)=>inWater(t.x+x/L,t.y-z/L);t.wet=wet;
 // spojka k nejbližší silnici (uplatní se jen tam, kde obcí žádná silnice nevede)
 {let best=null,bd=1e18;ROADS.forEach(rd=>{if(!"PST".includes(rd.c))return;rd.m.forEach(q=>{const d=(q[0]-t.x)**2+(q[1]-t.y)**2;if(d<bd){bd=d;best=q}})});
  t.connectors=[];if(best&&bd<3000*3000){const c=[];const n=Math.max(2,Math.ceil(Math.sqrt(bd)/28));for(let k=0;k<=n;k++)c.push([t.x+(best[0]-t.x)*k/n,t.y+(best[1]-t.y)*k/n]);t.connectors.push(c)}}
 // památka co nejblíž středu (ne na dálnici, trati ani ve vodě)
 const lmi=landmarkFor(t);const lmR=LANDMARK_R[lmi.type]||5;let lm=null;
 for(const clr of[lmR+3,0]){for(let rr=0;rr<=64&&!lm;rr+=4)for(let a=0;a<12&&!lm;a++){const an=a/12*6.283+rr/7;const x=Math.cos(an)*rr,z=Math.sin(an)*rr;if(HH.near(x,z,lmR+11)===null&&!wet(x,z)&&(!clr||RH.near(x,z,clr)===null))lm={x,z}}if(lm)break}
 lm=lm||{x:0,z:0};
 const h=hashStr(t.n+"plan")>>>0;const th=(h%628)/100;const pat=PATTERN[t.n]!=null?PATTERN[t.n]:[0,1,2,1,0,2,1][h%7];
 const cs=Math.cos(th),sn=Math.sin(th);
 t.lm=Object.assign(lmi,{x:lm.x,z:lm.z,r:lmR,ry:-th});
 const PV=2*LD+SW,TAU=Math.PI*2,Q=3*PV,NQ=7,LWQ=(Q-SW)/NQ;
 const lotAttr=(o,rr)=>{o.roof=0;const v=rr();let acc=0;for(let k=0;k<4;k++){acc+=ROOF_W[k];if(v<acc){o.roof=k;break}}o.tree=rr()<.6;o.tr=rr();o.lamp=false;o.st=null;return o};
 const mkLot=(p,e,rr)=>{const nx=p.x-e.x,nz=p.z-e.z,l=Math.hypot(nx,nz)||1;return lotAttr({x:p.x,z:p.z,ry:Math.atan2(-nx/l,-nz/l),sx:e.x,sz:e.z},rr)};
 const dlm=p=>(p.x-lm.x)**2+(p.z-lm.z)**2;
 // sousední obce (lokálně): blok, který je blíž sousedovi než nám, nestavíme → obce srostou podél hranice, ale nepřekryjí se
 const NB=TOWNS.filter(o=>o!==t&&Math.hypot(o.x-t.x,o.y-t.y)<2*zoneM).map(o=>({x:(o.x-t.x)*L,z:-(o.y-t.y)*L}));
 const foreign=(x,z)=>{const d0=x*x+z*z;for(const o of NB)if((x-o.x)**2+(z-o.z)**2<d0)return true;return false};
 const blocked=(x,z)=>hardNear(x,z)||wet(x,z)||foreign(x,z);
 /* „deka“: čtvercové bloky Q×Q v pravidelné síti ulic; každý blok má jinou náplň (řady podél, řady napříč, dvůr se zelení, park) */
 const A=pat===1?3.4:0,l1=38+h%13,l2=44+h%9;
 const W=(u,v)=>{const uu=u+A*Math.sin(v/l1),vv=v+A*Math.sin(u/l2);return{x:lm.x+cs*uu-sn*vv,z:lm.z+sn*uu+cs*vv}};
 const inv=(x,z)=>{const dx=x-lm.x,dz=z-lm.z;return{u:cs*dx+sn*dz,v:-sn*dx+cs*dz}};
 const kind=(m,k)=>{if(!m&&!k)return 0;const q=(hashStr(t.n+"q"+m+","+k)>>>0)%20;return q<7?0:q<14?1:q<18?2:3};// 0 řady podél u, 1 řady podél v, 2 dvůr, 3 park
 const seg=(u0,v0,u1,v1)=>{const k=Math.max(1,Math.ceil(Math.hypot(u1-u0,v1-v0)/6));const a=[];for(let i=0;i<=k;i++)a.push(W(u0+(u1-u0)*i/k,v0+(v1-v0)*i/k));return a};
 const quiltGen=(Rg,Rmin)=>{const out=[];const mk=Math.ceil(Rg/Q)+1;
  for(let m=-mk;m<=mk;m++)for(let k=-mk;k<=mk;k++){const cu=m*Q,cv=k*Q;const c=W(cu,cv);const d=Math.sqrt(dlm(c))+m*.013+k*.007;if(d>Rg)continue;const ty=kind(m,k);if(ty===3)continue;
   if(Rmin){let inside=false;for(const su of[-1,1])for(const sv of[-1,1])if(Math.hypot(cu+su*Q/2,cv+sv*Q/2)<Rmin)inside=true;if(inside)continue}
   let bad=false;for(let i=0;i<=4&&!bad;i++)for(let j=0;j<=4;j++){const q=W(cu+(i/4-.5)*Q,cv+(j/4-.5)*Q);if(blocked(q.x,q.z)){bad=true;break}}if(bad)continue;
   const rr=rng(hashStr(t.n+m+":"+k));const lots=[];const L2=(a,b)=>ty===1?W(cu+b,cv+a):W(cu+a,cv+b);// a = podél řady, b = napříč
   const put=(p,e)=>{if(dlm(p)>=(lmR+5.4)**2&&RH.near(p.x,p.z,ROAD_CLR)===null)lots.push(mkLot(p,e,rr))};
   if(ty<2){for(let r=-1;r<=1;r++)for(const side of[-1,1])for(let i=0;i<NQ;i++){const a=-Q/2+SW/2+(i+.5)*LWQ,bs=r*PV+side*(LD+SW/2);put(L2(a,bs-side*(SW/2+HOFF)),L2(a,bs-side*SW/2))}}
   else{for(const side of[-1,1]){for(let i=0;i<NQ;i++){const a=-Q/2+SW/2+(i+.5)*LWQ,bs=side*Q/2;put(W(cu+a,cv+bs-side*(SW/2+HOFF)),W(cu+a,cv+bs-side*SW/2))}
     for(let i=1;i<NQ-1;i++){const a=-Q/2+SW/2+(i+.5)*LWQ,bs=side*Q/2;put(W(cu+bs-side*(SW/2+HOFF),cv+a),W(cu+bs-side*SW/2,cv+a))}}}
   if(!lots.length)continue;lots.sort((p,q)=>dlm(p)-dlm(q));
   let ext=0;for(const su of[-1,1])for(const sv of[-1,1]){const q=W(cu+su*(Q/2+SW),cv+sv*(Q/2+SW));ext=Math.max(ext,Math.hypot(q.x,q.z))}
   const edges=["H:"+(k-1)+":"+m,"H:"+k+":"+m,"V:"+(m-1)+":"+k,"V:"+m+":"+k];if(ty<2)edges.push("i:"+m+":"+k+":0","i:"+m+":"+k+":1");
   out.push({key:m+":"+k,d,cx:c.x,cz:c.z,ext,lr:Q*.92,lots,edges,hit:(x,z,r)=>{const q=inv(x,z);return Math.hypot(Math.max(Math.abs(q.u-cu)-Q/2-SW,0),Math.max(Math.abs(q.v-cv)-Q/2-SW,0))<r+A}})}
  return out};
 const quiltEdge=key=>{const q=key.split(":"),i=+q[1],j=+q[2];if(q[0]==="H")return seg((j-.5)*Q,(i+.5)*Q,(j+.5)*Q,(i+.5)*Q);if(q[0]==="V")return seg((i+.5)*Q,(j-.5)*Q,(i+.5)*Q,(j+.5)*Q);
  const o=(+q[3]-.5)*PV;return kind(i,j)===1?seg(i*Q+o,(j-.5)*Q,i*Q+o,(j+.5)*Q):seg((i-.5)*Q,j*Q+o,(i+.5)*Q,j*Q+o)};
 const quiltLow=k=>k[0]==="H"?0:k[0]==="V"?.002:.004;
 let gen,edge,low;
 if(pat!==2){gen=Rg=>quiltGen(Rg,0).sort((a,b)=>a.d-b.d);edge=quiltEdge;low=quiltLow}
 else{ // prstence kolem návsi (jádro obce), za nimi pokračuje „deka“
  const r0=lmR+2.6+SW/2;const Kof=j=>j<1?4:j<3?8:j<8?16:32;const pol=(rr,a)=>({x:lm.x+Math.cos(a)*rr,z:lm.z+Math.sin(a)*rr});const lmD=Math.hypot(lm.x,lm.z);const JMAX=7,RR=r0+JMAX*PV+SW+3;
  gen=Rg=>{const out=[];for(let j=0;j<JMAX;j++){const ra=r0+j*PV,rm=ra+PV/2;if(rm>Rg+PV)break;const K=Kof(j);
    for(let i=0;i<K;i++){const a0=th+i/K*TAU,a1=th+(i+1)/K*TAU,am=(a0+a1)/2;let dA=am-(th+j*2.4);dA=Math.abs(Math.atan2(Math.sin(dA),Math.cos(dA)));const d=rm+dA/Math.PI*.7+i*1e-4;if(d>Rg)continue;
     let bad=false;for(let q=0;q<=6&&!bad;q++)for(const rr of[ra,rm,ra+PV]){const p=pol(rr,a0+(a1-a0)*q/6);if(blocked(p.x,p.z)){bad=true;break}}if(bad)continue;
     const rr_=rng(hashStr(t.n+"r"+j+":"+i));const lots=[];
     for(const [rs,side] of[[ra+SW/2,1],[ra+PV-SW/2,-1]]){const rh=rs+side*HOFF;const gap=(SW/2+.9)/rh;const span=a1-a0-2*gap;const cnt=Math.floor(rh*span/LW);if(cnt<1)continue;
      for(let q=0;q<cnt;q++){const a=a0+gap+(q+.5)*span/cnt;const lp=pol(rh,a);if(RH.near(lp.x,lp.z,ROAD_CLR)===null)lots.push(mkLot(lp,pol(rs,a),rr_))}}
     if(!lots.length)continue;lots.sort((a,b)=>dlm(a)-dlm(b));
     const q0=i*32/K,q1=(i+1)*32/K;const edges=["s:"+j+":"+q0,"s:"+j+":"+(q1%32)];for(let q=q0;q<q1;q++)edges.push("a:"+j+":"+q,"a:"+(j+1)+":"+q);
     const c=pol(rm,am);out.push({key:"r"+j+":"+i,d,cx:c.x,cz:c.z,ext:lmD+ra+PV+SW,lr:Math.hypot(PV/2+5,rm*(a1-a0)/2+4),lots,edges,
      hit:(x,z,r)=>{const dx=x-lm.x,dz=z-lm.z,ro=Math.hypot(dx,dz);let da=Math.atan2(dz,dx)-am;da=Math.atan2(Math.sin(da),Math.cos(da));return Math.hypot(Math.max(Math.abs(da)-(a1-a0)/2,0)*ro,Math.max(ra-SW-ro,ro-ra-PV-SW,0))<r}})}}
   if(Rg>RR)quiltGen(Rg,RR).forEach(b=>{b.d=Math.max(b.d,RR+b.d*.001);out.push(b)});
   return out.sort((a,b)=>a.d-b.d)};
  edge=key=>{if(key[0]!=="a"&&key[0]!=="s")return quiltEdge(key);const q=key.split(":"),j=+q[1],k=+q[2];const a=[];if(q[0]==="a"){const rr=r0+j*PV,a0=th+k/32*TAU,stp=Math.max(2,Math.ceil(rr*TAU/32/3.5));for(let i=0;i<=stp;i++)a.push(pol(rr,a0+TAU/32*i/stp))}
   else{const an=th+k/32*TAU;a.push(pol(r0+j*PV,an),pol(r0+j*PV+PV/2,an),pol(r0+(j+1)*PV,an))}return a};
  low=k=>k[0]==="a"?0:k[0]==="s"?.002:quiltLow(k);
 }
 t.plan={pat,gen,edge,low,Rg:90,blocks:gen(90)}}
/* rozmístění: domky po blocích od návsi, velké stavby na okraji; obec je pak obroste */
function layoutTown(t){const pl=t.plan,lm=t.lm;const slots=[],res=[],usedB=[];let Rb=Math.hypot(lm.x,lm.z)+lm.r+5,bi=0,li=0;
 const next=()=>{for(let g=0;g<20000;g++){if(bi>=pl.blocks.length){if(pl.Rg>2500)return null;pl.Rg=Math.max(pl.Rg*1.35,pl.Rg+50);pl.blocks=pl.gen(pl.Rg);continue}
   const b=pl.blocks[bi];if(li===0){if(res.some(q=>b.hit(q.x,q.z,q.r))){bi++;continue}usedB.push(b);Rb=Math.max(Rb,b.ext)}
   const s=b.lots[li++];if(li>=b.lots.length){bi++;li=0}return s}return null};
 for(let i=0;i<t.items.length;i++){const it=t.items[i];const fp=it.k==="s"?fpOf(it.id):0;
  if(fp>3.2){const h=hashStr(t.n+it.id+i)>>>0;let best=null;
   for(let rr=Rb+fp+2.5;rr<Rb+fp+80&&!best;rr+=4)for(let k=0;k<24;k++){const a=(((h%24)+k*7)%24)/24*6.283;const x=Math.cos(a)*rr,z=Math.sin(a)*rr;
    if(t.RH.near(x,z,fp+2.5)!==null||t.wet(x,z)||t.wet(x+fp*.6,z)||t.wet(x-fp*.6,z)||t.wet(x,z+fp*.6)||t.wet(x,z-fp*.6))continue;
    if(res.some(q=>Math.hypot(q.x-x,q.z-z)<q.r+fp+3))continue;best={x,z};break}
   if(!best){const a=(h%628)/100;best={x:Math.cos(a)*(Rb+fp+3),z:Math.sin(a)*(Rb+fp+3)}}
   const s={x:best.x,z:best.z,ry:Math.atan2(-best.x,-best.z),st:null,big:fp,sx:best.x,sz:best.z};res.push({x:s.x,z:s.z,r:fp+1.5});slots.push(s);it.pos=s}
  else{const s=next();if(!s)break;s.lamp=slots.length%4===2;slots.push(s)}}
 for(let k=abandonedN(t);k>0;k--){const s=next();if(!s)break;slots.push(s)}
 t.slots=slots;t.usedB=usedB;t.Rb=Rb;let R=Rb+2;res.forEach(q=>{R=Math.max(R,Math.hypot(q.x,q.z)+q.r+2)});t.Rlay=Math.max(R,14)}

/* ---------- materiály, textury ---------- */
function canvasTex(w,h,draw,rep){const c=document.createElement("canvas");c.width=w;c.height=h;draw(c.getContext("2d"),w,h);const t=new T.CanvasTexture(c);t.anisotropy=8;if(rep){t.wrapS=t.wrapT=T.RepeatWrapping}return t}
const roadTex=canvasTex(64,128,(g,w,h)=>{g.fillStyle="#6f7480";g.fillRect(0,0,w,h);for(let i=0;i<220;i++){g.fillStyle=`rgba(${Math.random()<.5?0:255},${Math.random()<.5?0:255},255,.04)`;g.fillRect(Math.random()*w,Math.random()*h,2,2)}g.fillStyle="#e9ecf2";g.fillRect(2,0,3,h);g.fillRect(w-5,0,3,h);g.fillRect(w/2-1.5,0,3,h*.45)},true);
const laneTex=canvasTex(64,64,(g,w,h)=>{g.fillStyle="#7d828c";g.fillRect(0,0,w,h);g.fillStyle="#9ea3ab";g.fillRect(0,0,4,h);g.fillRect(w-4,0,4,h)},true);
const d1Tex=canvasTex(128,128,(g,w,h)=>{g.fillStyle="#666b76";g.fillRect(0,0,w,h);g.fillStyle="#5f9a48";g.fillRect(w/2-6,0,12,h);g.fillStyle="#d9dde5";g.fillRect(w/2-9,0,2,h);g.fillRect(w/2+7,0,2,h);g.fillRect(3,0,3,h);g.fillRect(w-6,0,3,h);
 g.fillStyle="#eef1f5";[w*.27,w*.73].forEach(x=>g.fillRect(x-1.5,0,3,h*.5))},true);
const railTex=canvasTex(64,64,(g,w,h)=>{g.fillStyle="#8d8579";g.fillRect(0,0,w,h);g.fillStyle="#6b4f37";for(let y=2;y<h;y+=10)g.fillRect(6,y,w-12,5);g.fillStyle="#c9ccd2";g.fillRect(18,0,4,h);g.fillRect(w-22,0,4,h)},true);
const MAT={
 T:new T.MeshLambertMaterial({map:roadTex,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}),
 G:new T.MeshLambertMaterial({map:laneTex,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}),
 M:new T.MeshLambertMaterial({map:d1Tex,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4}),
 Z:new T.MeshLambertMaterial({map:railTex,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}),
 cap:new T.MeshLambertMaterial({color:"#6f7480",polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}),
 rail:new T.MeshLambertMaterial({color:"#d9dde6",side:T.DoubleSide}),
 plaza:new T.MeshLambertMaterial({color:"#d8ccb4",polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3}),
 plazaRim:new T.MeshLambertMaterial({color:"#b2a284",polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3}),
 lawn:new T.MeshLambertMaterial({color:"#8fbd5f",polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}),
 garden:new T.MeshLambertMaterial({color:"#9ccb6a"}),
 drive:new T.MeshLambertMaterial({color:"#b9bcc4"}),
};

const lawnTex=canvasTex(256,256,(g,w,h)=>{const r=g.createRadialGradient(128,128,0,128,128,128);r.addColorStop(0,"rgba(255,255,255,1)");r.addColorStop(.62,"rgba(255,255,255,1)");r.addColorStop(1,"rgba(255,255,255,0)");g.fillStyle=r;g.fillRect(0,0,w,h)});
const lawnMats={};function lawnMat(R){const k=Math.round(R);return lawnMats[k]||(lawnMats[k]=new T.MeshLambertMaterial({color:"#93c063",alphaMap:lawnTex,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}))}
/* ---------- pás silnice ---------- */
function ribbonInto(pts,w,y,uvS,P,U,I,H,off=0){const n=pts.length/2;if(n<2)return;const base=P.length/3;let acc=0;
 for(let i=0;i<n;i++){const x0=pts[i*2],z0=pts[i*2+1];let nx,nz;
  // normály sousedních segmentů; v rohu pokos (miter) s omezením, aby se pás nezužoval ani nepřestřeloval
  const hasP=i>0,hasN=i<n-1;let n1x=0,n1z=0,n2x=0,n2z=0;
  if(hasP){const dx=x0-pts[i*2-2],dz=z0-pts[i*2-1],l=Math.hypot(dx,dz)||1;n1x=-dz/l;n1z=dx/l}
  if(hasN){const dx=pts[i*2+2]-x0,dz=pts[i*2+3]-z0,l=Math.hypot(dx,dz)||1;n2x=-dz/l;n2z=dx/l}
  if(hasP&&hasN){let mx=n1x+n2x,mz=n1z+n2z;const ml=Math.hypot(mx,mz);if(ml<1e-4){mx=n1x;mz=n1z}else{mx/=ml;mz/=ml}const d=mx*n1x+mz*n1z;const k=Math.min(2.2,1/Math.max(.3,d));nx=mx*k*w/2;nz=mz*k*w/2}
  else if(hasP){nx=n1x*w/2;nz=n1z*w/2}else{nx=n2x*w/2;nz=n2z*w/2}
  if(i)acc+=Math.hypot(pts[i*2]-pts[i*2-2],pts[i*2+1]-pts[i*2-1]);const yy=y+(H?H[i]:0);const ox=off?nx/(w/2)*off:0,oz=off?nz/(w/2)*off:0;const x=pts[i*2]+ox,z=pts[i*2+1]+oz;P.push(x+nx,yy,z+nz,x-nx,yy,z-nz);U.push(0,acc/uvS,1,acc/uvS);
  if(i){const k=base+(i-1)*2;I.push(k,k+2,k+1,k+1,k+2,k+3)}}}
function geoFrom(P,U,I){const g=new T.BufferGeometry();g.setAttribute("position",new T.Float32BufferAttribute(P,3));g.setAttribute("uv",new T.Float32BufferAttribute(U,2));
 const N=new Float32Array(P.length);for(let i=1;i<N.length;i+=3)N[i]=1;g.setAttribute("normal",new T.BufferAttribute(N,3));g.setIndex(I);g.computeBoundingSphere();return g}

/* ---------- krajina: pole, louky, voda ---------- */
const FIELD=["#c8b46a","#b7c36a","#9dbd59","#d0b878","#a7b75d","#c3a75a","#8db15a","#bfc77c"];
const fieldTex=canvasTex(64,64,(g,w,h)=>{g.fillStyle="#fff";g.fillRect(0,0,w,h);g.fillStyle="rgba(0,0,0,.07)";for(let y=0;y<h;y+=8)g.fillRect(0,y,w,3)},true);
let landMesh,waterMesh,landSrc=null,waterSrc=null;
function buildLandSource(){const r=rng(5);
 // každá plocha má vlastní výšku (pole < ostatní < louky < les), aby se překrývající plochy neprolínaly
 const LY={A:.012,O:.02,M:.028,F:.036,W:0};
 const mk=(arr,kind,out)=>arr.forEach((a,pi)=>{const p=polyFromFlat(a);if(p.length<3)return;const yy=LY[kind]+(pi%7)*.0009;let tri;try{tri=T.ShapeUtils.triangulateShape(p.map(q=>new T.Vector2(q[0],q[1])),[])}catch(e){return}if(!tri.length)return;
  const base=out.m.length/2;let col;if(kind==="A")col=new T.Color(FIELD[Math.floor(r()*FIELD.length)]);else if(kind==="M")col=new T.Color(r()<.5?"#a4cc6c":"#97c463");else if(kind==="O")col=new T.Color("#88b85a");else if(kind==="F")col=new T.Color("#5d8a43");else col=new T.Color("#4f9ccc");
  const an=r()*Math.PI,ca=Math.cos(an),sa=Math.sin(an);const sc=kind==="A"?26:60;
  p.forEach(q=>{out.m.push(q[0],q[1]);out.y.push(yy);out.c.push(col.r,col.g,col.b);out.u.push((q[0]*ca+q[1]*sa)/sc,(-q[0]*sa+q[1]*ca)/sc)});tri.forEach(t3=>{const a=p[t3[0]],b=p[t3[1]],c=p[t3[2]];const cr=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);if(cr>0)out.i.push(base+t3[0],base+t3[1],base+t3[2]);else out.i.push(base+t3[0],base+t3[2],base+t3[1])})});
 landSrc={m:[],y:[],c:[],u:[],i:[]};mk(LAND.F,"F",landSrc);mk(LAND.M,"M",landSrc);mk(LAND.O,"O",landSrc);mk(LAND.A,"A",landSrc);
 waterSrc={m:[],y:[],c:[],u:[],i:[]};mk(LAND.W,"W",waterSrc);
 const g=new T.BufferGeometry();g.setAttribute("position",new T.BufferAttribute(new Float32Array(landSrc.m.length/2*3),3));g.setAttribute("color",new T.Float32BufferAttribute(landSrc.c,3));g.setAttribute("uv",new T.Float32BufferAttribute(landSrc.u,2));
 const N=new Float32Array(landSrc.m.length/2*3);for(let i=1;i<N.length;i+=3)N[i]=1;g.setAttribute("normal",new T.BufferAttribute(N,3));g.setIndex(landSrc.i);
 landMesh=new T.Mesh(g,new T.MeshLambertMaterial({vertexColors:true,map:fieldTex,polygonOffset:true,polygonOffsetFactor:-.5,polygonOffsetUnits:-.5}));landMesh.receiveShadow=true;landMesh.frustumCulled=false;scene.add(landMesh);
 const w=new T.BufferGeometry();w.setAttribute("position",new T.BufferAttribute(new Float32Array(waterSrc.m.length/2*3),3));const WN=new Float32Array(waterSrc.m.length/2*3);for(let i=1;i<WN.length;i+=3)WN[i]=1;w.setAttribute("normal",new T.BufferAttribute(WN,3));w.setIndex(waterSrc.i);
 waterMesh=new T.Mesh(w,new T.MeshPhongMaterial({color:"#4c9fd0",shininess:80,specular:"#cfe8ff",polygonOffset:true,polygonOffsetFactor:-1.5,polygonOffsetUnits:-1.5}));waterMesh.frustumCulled=false;waterMesh.receiveShadow=false;scene.add(waterMesh)}
const tmp2=[0,0];
function mapLand(){const pa=landMesh.geometry.attributes.position.array,m=landSrc.m;for(let i=0,j=0;i<m.length;i+=2,j+=3){F(m[i],m[i+1],tmp2);pa[j]=tmp2[0];pa[j+1]=landSrc.y[i>>1];pa[j+2]=tmp2[1]}landMesh.geometry.attributes.position.needsUpdate=true;
 const wa=waterMesh.geometry.attributes.position.array,w=waterSrc.m;for(let i=0,j=0;i<w.length;i+=2,j+=3){F(w[i],w[i+1],tmp2);wa[j]=tmp2[0];wa[j+1]=.085;wa[j+2]=tmp2[1]}waterMesh.geometry.attributes.position.needsUpdate=true}
const ground=new T.Mesh(new T.PlaneGeometry(1,1),new T.MeshLambertMaterial({color:"#90b95f"}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);

/* ---------- stromy (lesy + remízky) ---------- */
function treeGeo(kind,leaf){const parts=[];const col=(g,c)=>{const n=g.attributes.position.count,a=new Float32Array(n*3),cc=new T.Color(c);for(let i=0;i<n;i++){a[i*3]=cc.r;a[i*3+1]=cc.g;a[i*3+2]=cc.b}g.setAttribute("color",new T.BufferAttribute(a,3));return g};
 const tr=new T.CylinderGeometry(.09,.13,.9,5);tr.translate(0,.45,0);parts.push(col(tr,"#6b5a45"));
 if(kind===0){const a=new T.ConeGeometry(.78,1.7,7);a.translate(0,1.55,0);const b=new T.ConeGeometry(.6,1.35,7);b.translate(0,2.35,0);const c=new T.ConeGeometry(.4,1,7);c.translate(0,3,0);[a,b,c].forEach(g=>parts.push(col(g,leaf)))}
 else{const a=new T.IcosahedronGeometry(.95,0);a.translate(0,1.75,0);const b=new T.IcosahedronGeometry(.62,0);b.translate(.42,2.25,.2);[a,b].forEach(g=>parts.push(col(g,leaf)))}
 parts.forEach(g=>{g.deleteAttribute("uv");g.setAttribute("uv",new T.BufferAttribute(new Float32Array(g.attributes.position.count*2),2))});return mergeGeos(parts.map(g=>g.index?g:g))}
const treeMat=new T.MeshLambertMaterial({vertexColors:true});
const TREEK=[[0,"#2f6a3a"],[0,"#3d7d3f"],[1,"#4f8f3c"],[1,"#6aa046"]];// les po dlaždicích: mimo záběr se stromy vůbec nekreslí (rychlejší mobil i render videa)
const FTILE=480,TREEGEO=TREEK.map(([k,c])=>{const g=treeGeo(k,c);g.boundingSphere=new T.Sphere(new T.Vector3(0,6,0),FTILE*.75+24);return g});let FOREST=[],forestShadow=true;
let forestPts=null;
function sampleForest(){const r=rng(9);forestPts=[];const sp=(S>.15?13:7.2)/S;
 LAND.F.forEach(a=>{const p=polyFromFlat(a);const b=bbox(p);for(let x=b[0];x<b[2];x+=sp)for(let y=b[1];y<b[3];y+=sp){const px=x+r()*sp*.8,py=y+r()*sp*.8;if(inPoly(px,py,p))forestPts.push(px,py,r()<.62?0:1,r())}});
 LAND.A.forEach(a=>{for(let i=0;i<a.length;i+=2){if(r()<.18)forestPts.push(a[i]+(r()-.5)*20,a[i+1]+(r()-.5)*20,1,r())}});
 LAND.M.forEach(a=>{for(let i=0;i<a.length;i+=2){if(r()<.12)forestPts.push(a[i]+(r()-.5)*20,a[i+1]+(r()-.5)*20,r()<.5?0:1,r())}})}
const GREENS=["#3f7a3a","#4b8a3e","#57943f","#35703a","#6a9a45","#2f6436"].map(c=>new T.Color(c));
const M4=new T.Matrix4(),Q=new T.Quaternion(),V=new T.Vector3(),SC=new T.Vector3(),UP=new T.Vector3(0,1,0);
let roadHash=null;
function placeForest(){FOREST.forEach(m=>{scene.remove(m);m.dispose&&m.dispose()});FOREST=[];const B=new Map();const tcs=TOWNS.map(t=>[tc(t),t.R+2.5,t]);if(window.NAMESTI){F(CENTER.x,CENTER.y,tmp2);tcs.push([{x:tmp2[0],z:tmp2[1]},(NAMESTI.HZ||NAMESTI.H)*(CENTER.scale||1)*1.45])}
 for(let i=0;i<forestPts.length;i+=4){F(forestPts[i],forestPts[i+1],tmp2);const X=tmp2[0],Z=tmp2[1];let bad=false;
  for(const [c,rad,tw] of tcs){if((c.x-X)**2+(c.z-Z)**2<rad*rad){if(tw&&tw.ZH&&tw.ZH.near(X-c.x,Z-c.z,17)===null&&(X-c.x-tw.lm.x)**2+(Z-c.z-tw.lm.z)**2>(tw.lm.r+16)**2&&!tw.slots.some(q=>q.big&&(q.x-X+c.x)**2+(q.z-Z+c.z)**2<(q.big+6)**2))continue;bad=true;break}}if(bad)continue;if(roadHash&&roadHash.near(X,Z,3.2)!==null)continue;
  const s=forestPts[i+3];const k=forestPts[i+2]*2+(s*997%1<.5?0:1);const tx=Math.floor(X/FTILE),tz=Math.floor(Z/FTILE),key=k+":"+tx+":"+tz;let a=B.get(key);if(!a)B.set(key,a={k,tx,tz,d:[]});a.d.push(X,Z,s)}
 B.forEach(a=>{const n=a.d.length/3,cx=(a.tx+.5)*FTILE,cz=(a.tz+.5)*FTILE;const m=new T.InstancedMesh(TREEGEO[a.k],treeMat,n);m.position.set(cx,0,cz);
  for(let i=0;i<n;i++){const s=a.d[i*3+2];Q.setFromAxisAngle(UP,s*6.28);V.set(a.d[i*3]-cx,0,a.d[i*3+1]-cz);const h=S>.15?2.3+s*1.6:1.25+s*.9;SC.set(h,h*(0.9+s*.3),h);M4.compose(V,Q,SC);m.setMatrixAt(i,M4)}
  m.castShadow=forestShadow;m.receiveShadow=true;m.updateMatrixWorld();scene.add(m);FOREST.push(m)})}

/* ---------- silnice: vykreslení ---------- */
let roadGroup=new T.Group();scene.add(roadGroup);let carPaths=[],railPath=null;
function buildRoads(){roadGroup.children.forEach(c=>c.geometry.dispose());roadGroup.clear();roadHash=new Hash(10);carPaths=[];
 const buf={};const B=k=>buf[k]||(buf[k]={P:[],U:[],I:[]});const caps={P:[],U:[],I:[]};
 const all=ROADS.concat(TOWNS.flatMap(t=>(t.connectors||[]).map(c=>({c:"T",m:c}))));
 let longestRail=null,lr=0;
 all.forEach(rd=>{const pts=new Float32Array(rd.m.length*2);rd.m.forEach((q,i)=>{F(q[0],q[1],tmp2);pts[i*2]=tmp2[0];pts[i*2+1]=tmp2[1]});rd.d=pts});
 // dvojkolejné tratě: souběžnou kolej (do 2.4 j.) vynechat, kreslí se jedna
 {const ZH=new Hash(6);all.forEach(rd=>{if(rd.c!=="Z")return;const p=rd.d;let near=0,n=0;for(let i=0;i<p.length;i+=2){n++;if(ZH.near(p[i],p[i+1],2.4)!==null)near++}if(n&&near/n>.6){rd.d=new Float32Array(0);return}for(let i=0;i<p.length;i+=2)ZH.add(p[i],p[i+1],1)})}
 // nadjezdy: segmenty dálnice do mřížky, křížení ostatních silnic = most
 const MH=new Hash(12);const mseg=[];all.forEach(rd=>{if(rd.c!=="M")return;const p=rd.d;for(let i=2;i<p.length;i+=2){mseg.push([p[i-2],p[i-1],p[i],p[i+1]]);MH.add((p[i-2]+p[i])/2,(p[i-1]+p[i+1])/2,mseg.length-1)}});
 const segX=(ax,az,bx,bz,cx,cz,dx,dz)=>{const d=(bx-ax)*(dz-cz)-(bz-az)*(dx-cx);if(Math.abs(d)<1e-9)return null;const u=((cx-ax)*(dz-cz)-(cz-az)*(dx-cx))/d,v=((cx-ax)*(bz-az)-(cz-az)*(bx-ax))/d;return u>=0&&u<=1&&v>=0&&v<=1?u:null};
 const BR={P:[],U:[],I:[]};
 let SQ=null;if(window.NAMESTI){F(CENTER.x,CENTER.y,tmp2);const sc=CENTER.scale||1;SQ={x:tmp2[0],z:tmp2[1],a:NAMESTI.H*sc*1.62,b:(NAMESTI.HZ||NAMESTI.H)*sc*1.34,cuts:[]}}
 // zóny, kde se silnice ořezávají: okruh náměstí (vše) a kruh kolem každé obce (vše kromě dálnice a trati)
 const ZN=[];if(SQ)ZN.push({sq:1,x:SQ.x,z:SQ.z,a:SQ.a,b:SQ.b});
 // obce: silnice zůstávají celé; jen si poznamenáme, kde protínají okraj zástavby (tam stojí cedule obce)
 const TZ=[];TOWNS.forEach(t=>{t.cuts=[];if(!t.group||!t.Rb||!t.items.length)return;const c=t.group.position;TZ.push({t,x:c.x,z:c.z,r2:(t.Rb+5)**2})});
 const inZ=(z,x,y)=>((x-z.x)/z.a)**2+((y-z.z)/z.b)**2<1;
 const entries=(pts,c)=>{if(!"PST".includes(c))return;for(const z of TZ){let pin=null;for(let i=0;i<pts.length;i+=2){const inn=(pts[i]-z.x)**2+(pts[i+1]-z.z)**2<z.r2;if(pin!==null&&inn!==pin){const ax=pts[i-2],az=pts[i-1],bx=pts[i],bz=pts[i+1];let lo=0,hi=1;for(let k=0;k<8;k++){const m=(lo+hi)/2;const q=(ax+(bx-ax)*m-z.x)**2+(az+(bz-az)*m-z.z)**2<z.r2;if(q===pin)lo=m;else hi=m}z.t.cuts.push({x:ax+(bx-ax)*lo,z:az+(bz-az)*lo,c})}pin=inn}}};
 const cutAt=(z,x,y,c)=>{if(c==="M"||c==="Z")return;if(z.sq)SQ.cuts.push([x,y]);else z.t.cuts.push({x,z:y,c})};
 const clipAll=(pts,c)=>{let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9;for(let i=0;i<pts.length;i+=2){const x=pts[i],y=pts[i+1];if(x<x0)x0=x;if(x>x1)x1=x;if(y<z0)z0=y;if(y>z1)z1=y}
  const hard=c==="M"||c==="Z";const zs=ZN.filter(z=>(z.sq||!hard)&&!(z.x+z.a<x0||z.x-z.a>x1||z.z+z.b<z0||z.z-z.b>z1));if(!zs.length)return[pts];
  const which=(x,y)=>{for(const z of zs)if(inZ(z,x,y))return z;return null};
  const runs=[];let cur=[],pz=null,px=0,py=0,has=false;
  const step=(x,y)=>{const z=which(x,y);
   if(has&&z!==pz&&!(z&&pz)){const zz=z||pz,aIn=!!pz;let lo=0,hi=1;for(let k=0;k<10;k++){const m=(lo+hi)/2;if(inZ(zz,px+(x-px)*m,py+(y-py)*m)===aIn)lo=m;else hi=m}
    const m=(lo+hi)/2,cx=px+(x-px)*m,cy=py+(y-py)*m;if(z){cur.push(cx,cy);if(cur.length>=4)runs.push(new Float32Array(cur));cur=[]}else cur=[cx,cy];cutAt(zz,cx,cy,c)}
   if(!z)cur.push(x,y);pz=z;px=x;py=y;has=true};
  for(let i=0;i<pts.length;i+=2){const x=pts[i],y=pts[i+1];
   if(has){const d=Math.hypot(x-px,y-py);if(d>6){const n=Math.ceil(d/5),ax=px,ay=py;for(let k=1;k<n;k++)step(ax+(x-ax)*k/n,ay+(y-ay)*k/n)}}step(x,y)}
  if(cur.length>=4)runs.push(new Float32Array(cur));return runs};
 all.forEach(rd0=>{entries(rd0.d,rd0.c);clipAll(rd0.d,rd0.c).forEach(pts=>{const rd={c:rd0.c,d:pts};const cls=CLS[rd.c];const key=rd.c==="M"?"M":rd.c==="Z"?"Z":"T";let H=null;
  if(rd.c!=="M"&&rd.c!=="Z"){const n=pts.length/2;const cum=new Float32Array(n);for(let i=1;i<n;i++)cum[i]=cum[i-1]+Math.hypot(pts[i*2]-pts[i*2-2],pts[i*2+1]-pts[i*2-1]);const xs=[];
   for(let i=1;i<n;i++){const ax=pts[i*2-2],az=pts[i*2-1],bx=pts[i*2],bz=pts[i*2+1];let hit=null;MH.near((ax+bx)/2,(az+bz)/2,14,id=>{if(hit!==null)return true;const m=mseg[id];const u=segX(ax,az,bx,bz,m[0],m[1],m[2],m[3]);if(u!==null)hit=u;return true});if(hit!==null)xs.push(cum[i-1]+hit*(cum[i]-cum[i-1]))}
   if(xs.length){H=new Float32Array(n);const W=11;for(let i=0;i<n;i++){let h=0;xs.forEach(x0=>{const u=Math.abs(cum[i]-x0)/W;if(u<1){const k=1-u*u*(3-2*u);h=Math.max(h,1.5*k)}});H[i]=h}
    // zábradlí: dva úzké pásy po stranách, jen kde je most
    const hb=Array.from(H,h=>h>.08?h+.38:-1);let run=[];const flush=()=>{if(run.length>1){const sub=new Float32Array(run.length*2),sh=new Float32Array(run.length);run.forEach((j,k)=>{sub[k*2]=pts[j*2];sub[k*2+1]=pts[j*2+1];sh[k]=hb[j]});ribbonInto(sub,.26,cls.y,4,BR.P,BR.U,BR.I,sh,cls.w/2+.1);ribbonInto(sub,.26,cls.y,4,BR.P,BR.U,BR.I,sh,-(cls.w/2+.1))}run=[]};
    for(let i=0;i<n;i++){if(hb[i]>0)run.push(i);else flush()}flush()}}
  ribbonInto(pts,cls.w,cls.y,key==="M"?8:key==="Z"?2:6,B(key).P,B(key).U,B(key).I,H);
  for(let i=0;i<pts.length;i+=4)roadHash.add(pts[i],pts[i+1],1);
  // kloub v ostrých zatáčkách: kruhová záplata, aby ve spoji neprosvítala tráva
  if(rd.c!=="Z"){for(let i=2;i<pts.length-2;i+=2){const ax=pts[i]-pts[i-2],az=pts[i+1]-pts[i-1],bx=pts[i+2]-pts[i],bz=pts[i+3]-pts[i+1];const la=Math.hypot(ax,az)||1,lb=Math.hypot(bx,bz)||1;const cosT=(ax*bx+az*bz)/(la*lb);if(cosT<.86){const nn=caps.P.length/3;const r=cls.w/2,yy=cls.y-.001+(H?H[i/2]:0);caps.P.push(pts[i],yy,pts[i+1]);caps.U.push(.5,.5);for(let a=0;a<=10;a++){const an=a/10*6.283;caps.P.push(pts[i]+Math.cos(an)*r,yy,pts[i+1]+Math.sin(an)*r);caps.U.push(.5,.5);if(a)caps.I.push(nn,nn+a+1,nn+a)}}}}
  if(rd.c!=="Z"&&rd.c!=="L"){[0,pts.length-2].forEach(j=>{const n=caps.P.length/3;const r=cls.w/2,y=cls.y-.002;caps.P.push(pts[j],y,pts[j+1]);caps.U.push(.5,.5);for(let a=0;a<=10;a++){const an=a/10*6.283;caps.P.push(pts[j]+Math.cos(an)*r,y,pts[j+1]+Math.sin(an)*r);caps.U.push(.5,.5);if(a)caps.I.push(n,n+a+1,n+a)}})}
  let len=0;for(let i=2;i<pts.length;i+=2)len+=Math.hypot(pts[i]-pts[i-2],pts[i+1]-pts[i-1]);
  if(rd.c==="Z"&&len>lr){lr=len;longestRail=pts}
  if("MPS".includes(rd.c)&&len>60)carPaths.push({pts,len,c:rd.c})})});
 // okruh kolem náměstí
 if(window.NAMESTI){F(CENTER.x,CENTER.y,tmp2);const sc=CENTER.scale||1;const cx=tmp2[0],cz=tmp2[1],ra=NAMESTI.H*sc*1.62,rb=(NAMESTI.HZ||NAMESTI.H)*sc*1.34;const n=72;const pts=new Float32Array((n+1)*2);for(let i=0;i<=n;i++){const a=i/n*Math.PI*2;pts[i*2]=cx+Math.cos(a)*ra;pts[i*2+1]=cz+Math.sin(a)*rb}ribbonInto(pts,CLS.S.w,CLS.S.y+.004,6,B("T").P,B("T").U,B("T").I);for(let i=0;i<=n;i+=2)roadHash.add(pts[i*2],pts[i*2+1],1);carPaths.push({pts,len:Math.PI*(ra+rb),c:"S"})}
 // spojky: každá silnice uříznutá okruhem se napojí kolmo (radiálně) na okruh
 if(window.NAMESTI&&SQ){const seen=[];SQ.cuts.forEach(([ex,ez])=>{if(seen.some(q=>Math.hypot(q[0]-ex,q[1]-ez)<5))return;seen.push([ex,ez]);
   // bod na elipse okruhu ve směru řezu
   const vx=(ex-SQ.x)/SQ.a,vz=(ez-SQ.z)/SQ.b;const l=Math.hypot(vx,vz)||1;const ox=SQ.x+vx/l*SQ.a,oz=SQ.z+vz/l*SQ.b;const d=Math.hypot(ex-ox,ez-oz);if(d<.5)return;
   const pts=new Float32Array([ox,oz,ex,ez]);ribbonInto(pts,CLS.S.w,CLS.S.y+.002,6,B("T").P,B("T").U,B("T").I);for(let u=0;u<=1;u+=.1)roadHash.add(ox+(ex-ox)*u,oz+(ez-oz)*u,1);
   const nn=caps.P.length/3,r=CLS.S.w/2,yy=CLS.S.y+.001;caps.P.push(ox,yy,oz);caps.U.push(.5,.5);for(let a=0;a<=10;a++){const an=a/10*6.283;caps.P.push(ox+Math.cos(an)*r,yy,oz+Math.sin(an)*r);caps.U.push(.5,.5);if(a)caps.I.push(nn,nn+a+1,nn+a)}})}
 // vjezdy do obce: hlavní silnice napřed, blízké vjezdy slít
 {const RANK={P:0,S:1,T:2};TOWNS.forEach(t=>{t.cutsOk=[];(t.cuts||[]).sort((a,b)=>RANK[a.c]-RANK[b.c]).forEach(c=>{if(!t.cutsOk.some(q=>Math.hypot(q.x-c.x,q.z-c.z)<40))t.cutsOk.push(c)})})}
 railPath=longestRail;
 Object.entries(buf).forEach(([k,b])=>{const m=new T.Mesh(geoFrom(b.P,b.U,b.I),MAT[k]);m.receiveShadow=true;roadGroup.add(m)});
 if(BR.P.length){const m=new T.Mesh(geoFrom(BR.P,BR.U,BR.I),MAT.rail);m.castShadow=true;roadGroup.add(m)}
 const cm=new T.Mesh(geoFrom(caps.P,caps.U,caps.I),MAT.cap);cm.receiveShadow=true;roadGroup.add(cm)}

/* ---------- domy, zahrady, lampy ---------- */
let MAXH=+QS.get("maxh")||16000;let HOUSE=[],ABAND=null,GARDEN,DRIVE,YARD,LAMPS;const houseRef=[[],[],[],[]];
function initInstanced(){const hr=MODELS.b.r;[...HOUSE,ABAND,GARDEN,DRIVE,YARD,LAMPS].forEach(m=>{if(m){scene.remove(m);m.dispose&&m.dispose()}});
 HOUSE=ROOFS.map(c=>{const m=new T.InstancedMesh(hr.geo,MODELS.roofMat(hr,c),MAXH);m.castShadow=m.receiveShadow=true;m.count=0;m.frustumCulled=false;scene.add(m);return m});
 {const img=hr.map.image;const c=document.createElement("canvas");c.width=img.width;c.height=img.height;const g=c.getContext("2d");g.filter="grayscale(1) brightness(.5) contrast(1.15) sepia(.18)";g.drawImage(img,0,0);const tx=new T.CanvasTexture(c);tx.flipY=false;
  ABAND=new T.InstancedMesh(hr.geo,new T.MeshLambertMaterial({map:tx}),600);ABAND.castShadow=ABAND.receiveShadow=true;ABAND.count=0;ABAND.frustumCulled=false;scene.add(ABAND)}
 GARDEN=new T.InstancedMesh(new T.BoxGeometry(5.9,.06,5.9),MAT.garden,MAXH);GARDEN.receiveShadow=true;GARDEN.frustumCulled=false;scene.add(GARDEN);
 DRIVE=new T.InstancedMesh(new T.BoxGeometry(1,.07,1),MAT.drive,MAXH);DRIVE.receiveShadow=true;DRIVE.frustumCulled=false;scene.add(DRIVE);
 YARD=new T.InstancedMesh(MODELS.p.treeS.geo,MODELS.p.treeS.mat,MAXH);YARD.castShadow=true;YARD.frustumCulled=false;scene.add(YARD);
 LAMPS=new T.InstancedMesh(MODELS.p.lamp.geo,MODELS.p.lamp.mat,MAXH);LAMPS.castShadow=true;LAMPS.frustumCulled=false;scene.add(LAMPS)}
const born=new Map();
function abandonedN(t){return Math.max(0,CONFIG.REVIVE-t.players.length)}
function placeHouses(now){{let tot=0;TOWNS.forEach(t=>{tot+=t.items.length});if(tot>MAXH){MAXH=Math.ceil(tot*1.4/4000)*4000;initInstanced()}}const cnt=[0,0,0,0];let gi=0,di=0,yi=0,li=0,ai=0;houseRef.forEach(a=>a.length=0);
 TOWNS.forEach(t=>{const ab=abandonedN(t);if(ab){const c=tc(t);const base=t.items.length;for(let k=0;k<ab;k++){const s=base+k<capN(t)?t.slots[base+k]:null;if(!s)break;const w=hashStr(t.n+k)%1000/1000;
   Q.setFromEuler(new T.Euler((w-.5)*.24,s.ry-Math.PI/2+(w-.5)*.3,(w-.3)*.2));V.set(c.x+s.x,-.55-w*.3,c.z+s.z);SC.set(HOUSE_S*.96,HOUSE_S*(.72+w*.12),HOUSE_S*.96);M4.compose(V,Q,SC);ABAND.setMatrixAt(ai++,M4)}}});
 if(ABAND){ABAND.count=ai;ABAND.instanceMatrix.needsUpdate=true}
 TOWNS.forEach(t=>{if(!t.items.length)return;const c=tc(t);t.items.forEach((it,idx)=>{const s=idx<capN(t)?t.slots[idx]:null;if(!s)return;
   if(it.k==="s"){return}if(gi>=MAXH||cnt[s.roof]>=MAXH)return;
   let k=1;const key=t.n+"#"+idx;if(born.has(key)){const a=(now-born.get(key))/650;if(a<0)k=0.001;else if(a<1)k=a<.7?a/.7*1.12:1.12-(a-.7)/.3*.12;else born.delete(key)}
   Q.setFromAxisAngle(UP,s.ry-Math.PI/2);V.set(c.x+s.x,0,c.z+s.z);SC.set(HOUSE_S*k,HOUSE_S*k,HOUSE_S*k);M4.compose(V,Q,SC);houseRef[s.roof][cnt[s.roof]]={t,idx};HOUSE[s.roof].setMatrixAt(cnt[s.roof]++,M4);
   Q.setFromAxisAngle(UP,s.ry);SC.set(1,1,1);V.set(c.x+s.x,.02,c.z+s.z);M4.compose(V,Q,SC);GARDEN.setMatrixAt(gi++,M4);
   const dx=s.sx-s.x,dz=s.sz-s.z,Ld=Math.hypot(dx,dz);const len=Math.max(.3,Ld-1.9);V.set(c.x+s.x+dx/Ld*(1.9+len/2),.03,c.z+s.z+dz/Ld*(1.9+len/2));SC.set(1.25,1,len);M4.compose(V,Q,SC);DRIVE.setMatrixAt(di++,M4);
   if(s.tree){const side=s.tr<.5?1:-1;const fx=dx/Ld,fz=dz/Ld;V.set(c.x+s.x-fx*2.3+fz*2.2*side,0,c.z+s.z-fz*2.3-fx*2.2*side);const h=3.6+s.tr*1.6;SC.set(h*k,h*k,h*k);M4.compose(V,Q,SC);YARD.setMatrixAt(yi++,M4)}
   if(s.lamp){const fx=dx/Ld,fz=dz/Ld;V.set(c.x+s.sx+fz*2.9-fx*.35,0,c.z+s.sz-fx*2.9-fz*.35);Q.setFromAxisAngle(UP,Math.atan2(fx,fz)+Math.PI/2);SC.set(4.2,4.2,4.2);M4.compose(V,Q,SC);LAMPS.setMatrixAt(li++,M4)}})});
 HOUSE.forEach((h,i)=>{h.count=cnt[i];h.instanceMatrix.needsUpdate=true});[[GARDEN,gi],[DRIVE,di],[YARD,yi],[LAMPS,li]].forEach(([m,n])=>{m.count=n;m.instanceMatrix.needsUpdate=true})}

/* ---------- obec: památka, náměstíčko, uličky, speciální budovy ---------- */
function monument(lm){const g=new T.Group();const Mm=SPECIALS.M;const add=(geo,c,x=0,y=0,z=0)=>{const m=new T.Mesh(geo,Mm(c));m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;g.add(m);return m};
 const bx=(w,h,d,c,x,y,z)=>{const geo=new T.BoxGeometry(w,h,d);geo.translate(0,h/2,0);return add(geo,c,x,y,z)};
 bx(1.7,.3,1.7,"#b9b1a3",0,0,0);bx(1.2,.45,1.2,"#a39b8c",0,.3,0);
 if(lm.cross){bx(.22,2.6,.22,"#c9c2b5",0,.75,0);bx(1.1,.22,.22,"#c9c2b5",0,2.55,0)}else{bx(.6,2.5,.6,"#c9c2b5",0,.75,0);const p=new T.ConeGeometry(.45,.6,4);p.rotateY(Math.PI/4);p.translate(0,3.55,0);add(p,"#c9c2b5")}
 [[-1.3,1.1],[1.3,1.1],[-1.3,-1.1],[1.3,-1.1]].forEach(([x,z])=>{const f=new T.SphereGeometry(.3,8,6);f.translate(0,.32,0);add(f,"#d6506d",x,0,z);const p=new T.CylinderGeometry(.32,.28,.25,8);p.translate(0,.12,0);add(p,"#7a6a58",x,0,z)});return g}
function buildTown(t){if(t.group){scene.remove(t.group)}const g=new T.Group();t.group=g;scene.add(g);const lm=t.lm;
 const pl=new T.Mesh(new T.CircleGeometry(lm.r+1.6,40).rotateX(-Math.PI/2),MAT.plaza);pl.position.set(lm.x,.08,lm.z);pl.receiveShadow=true;g.add(pl);
 const rim=new T.Mesh(new T.RingGeometry(lm.r+1.6,lm.r+2.3,40).rotateX(-Math.PI/2),MAT.plazaRim);rim.position.set(lm.x,.081,lm.z);g.add(rim);
 let o;if(lm.type==="pomnik")o=monument(lm);else{o=KIT.landmark(lm.type,lm.name);o.scale.setScalar(lm.type==="kaple"?1.15:lm.type==="kostel"?.95:.78)}
 o.traverse(m=>{if(m.isMesh){m.castShadow=true;m.receiveShadow=true}});o.position.set(lm.x,0,lm.z);o.rotation.y=lm.ry;g.add(o);t.lmObj=o;
 for(let i=0;i<4;i++){const a=lm.ry+Math.PI/4+i*Math.PI/2;const x=lm.x+Math.cos(a)*(lm.r+1.2),z=lm.z+Math.sin(a)*(lm.r+1.2);const l=new T.Mesh(MODELS.p.lamp.geo,MODELS.p.lamp.mat);l.scale.setScalar(4.2);l.position.set(x,0,z);l.rotation.y=-a;l.castShadow=true;g.add(l)}
 t.dyn=new T.Group();g.add(t.dyn);t.specialObjs=[];refreshTown(t)}
function refreshTown(t){(t.specialObjs||[]).forEach(o=>{if(o.userData.lbl)o.userData.lbl.remove()});const g=t.dyn;g.children.forEach(c=>{c.traverse(m=>{if(m.geometry&&m.userData.tmp)m.geometry.dispose()})});g.clear();t.specialObjs=[];
 const used=Math.min(t.items.length,t.slots.length);
 // lawn pod obcí (zakryje pole)
 // stožár se státní vlajkou u návsi každé živé obce
 if(t.players.length>=CONFIG.REVIVE){const lm=t.lm;const fp=flagpole(lm.x+Math.cos(lm.ry+.9)*(lm.r+.6),lm.z+Math.sin(lm.ry+.9)*(lm.r+.6),lm.type==="kaple"||lm.type==="pomnik"?8:10.5);fp.traverse(m=>{m.userData.tmp=1});g.add(fp)}
 // trávník jen pod zastavěnými bloky (ne velký kruh): čtverec kolem každého bloku + kruh kolem návsi
 {const lp=[],li=[];const fan=(pts)=>{const b=lp.length/3;let cx=0,cz=0;pts.forEach(q=>{cx+=q.x;cz+=q.z});cx/=pts.length;cz/=pts.length;lp.push(cx,.044,cz);pts.forEach(q=>lp.push(q.x,.044,q.z));for(let i=0;i<pts.length;i++)li.push(b,b+1+(i+1)%pts.length,b+1+i)};
  const circ=(x,z,r)=>{const a=[];for(let i=0;i<28;i++){const an=i/28*6.283;a.push({x:x+Math.cos(an)*r,z:z+Math.sin(an)*r})}fan(a)};
  circ(t.lm.x,t.lm.z,t.lm.r+14);(t.usedB||[]).forEach(b=>{circ(b.cx,b.cz,b.lr)});(t.slots||[]).forEach(q=>{if(q.big)circ(q.x,q.z,q.big+4)});
  const lg=new T.BufferGeometry();lg.setAttribute("position",new T.Float32BufferAttribute(lp,3));lg.setIndex(li);lg.computeVertexNormals();const lawn=new T.Mesh(lg,MAT.lawn);lawn.receiveShadow=true;lawn.userData.tmp=1;g.add(lawn)}
 // zastavěné území (parcely načatých bloků + ulice): podle něj se ořezávají silnice, kácí les a sází parky
 {const ZH=new Hash(14);(t.usedB||[]).forEach(b=>b.lots.forEach(q=>ZH.add(q.x,q.z,1)));ZH.add(t.lm.x,t.lm.z,1);t.ZH=ZH}
 // ulice čtvrti: obvod každého načatého bloku (vodorovné nahoře, příčné o chlup níž), zaoblené rohy
 const P=[],U=[],I=[],cP=[],cU=[],cI=[];const pl=t.plan;const ek=new Set();(t.usedB||[]).forEach(b=>b.edges.forEach(e=>ek.add(e)));
 const disc=(x,z,rr)=>{const base=cP.length/3;cP.push(x,CLS.G.y-.003,z);cU.push(.5,.5);for(let a=0;a<=12;a++){const an=a/12*6.283;cP.push(x+Math.cos(an)*rr,CLS.G.y-.003,z+Math.sin(an)*rr);cU.push(.5,.5);if(a)cI.push(base,base+a+1,base+a)}};
 t.builtPts=[];t.builtEnds=[];const nodes=new Map();
 ek.forEach(k=>{const line=pl.edge(k);const pts=new Float32Array(line.length*2);line.forEach((q,i)=>{pts[i*2]=q.x;pts[i*2+1]=q.z;t.builtPts.push(q)});ribbonInto(pts,SW,CLS.G.y-pl.low(k),6,P,U,I);
  [line[0],line[line.length-1]].forEach(q=>nodes.set(Math.round(q.x*4)+":"+Math.round(q.z*4),q))});
 nodes.forEach(q=>{disc(q.x,q.z,SW/2);if(Math.hypot(q.x,q.z)>t.Rb*.72)t.builtEnds.push(q)});t.builtPts.forEach(q=>t.ZH.add(q.x,q.z,1));
 if(!t.builtPts.length){const lm=t.lm;t.builtPts.push({x:lm.x,z:lm.z});t.builtEnds.push({x:lm.x,z:lm.z})}
 // spojky: uliční síť + silnice v obci jako graf; co není dojezdné z největší části, dostane nejkratší spojku (vyhne se domkům a vodě)
 {const lm=t.lm;const X=[],Z=[],par=[],isSt=[];const add=(x,z,st)=>{X.push(x);Z.push(z);par.push(par.length);isSt.push(st);return X.length-1};
  const find=i=>{while(par[i]!==i){par[i]=par[par[i]];i=par[i]}return i},uni=(a,b)=>{a=find(a);b=find(b);if(a!==b)par[a]=b};
  const G=new Map(),gk=(x,z)=>(Math.floor(x/8)+4096)*8192+Math.floor(z/8)+4096;const gadd=i=>{const k=gk(X[i],Z[i]);let a=G.get(k);if(!a)G.set(k,a=[]);a.push(i)};
  const around=(x,z,r,fn)=>{const x0=Math.floor((x-r)/8),x1=Math.floor((x+r)/8),z0=Math.floor((z-r)/8),z1=Math.floor((z+r)/8);for(let i=x0;i<=x1;i++)for(let j=z0;j<=z1;j++){const a=G.get((i+4096)*8192+j+4096);if(a)for(const q of a)fn(q)}};
  const lines=[];ek.forEach(k=>{const line=pl.edge(k);let pi=-1;const ids=[];line.forEach(q=>{const i=add(q.x,q.z,1);if(pi>=0)uni(pi,i);pi=i;ids.push(i)});lines.push(ids)});
  const nSt=X.length;for(let i=0;i<nSt;i++)gadd(i);
  // křižovatky ulic: konec ulice se chytí čehokoli do 3,4 j.
  lines.forEach(ids=>[ids[0],ids[ids.length-1]].forEach(i=>around(X[i],Z[i],3.4,q=>{if((X[q]-X[i])**2+(Z[q]-Z[i])**2<3.4*3.4)uni(q,i)})));
  // silnice v dosahu zástavby: body po 3 j., ulice se na ně chytí do 3,6 j., silnice mezi sebou v uzlech
  const lim=(t.Rb+60)**2;const r0=X.length;(t.roadRuns||[]).forEach(run=>{let pi=-1;for(let i=0;i<run.length;i+=2){const x=run[i],z=run[i+1];if(x*x+z*z>lim){pi=-1;continue}const id=add(x,z,0);if(pi>=0)uni(pi,id);pi=id}});
  for(let i=r0;i<X.length;i++){around(X[i],Z[i],3.6,q=>{const d=(X[q]-X[i])**2+(Z[q]-Z[i])**2;if(q<nSt?d<3.6*3.6:d<1.2)uni(q,i)});gadd(i)}
  // náves
  const li=add(lm.x,lm.z,2);around(lm.x,lm.z,lm.r+6,q=>{if((X[q]-lm.x)**2+(Z[q]-lm.z)**2<(lm.r+5.2)**2)uni(q,li)});
  const comp=new Map();for(let i=0;i<X.length;i++){if(!isSt[i])continue;const r=find(i);let c=comp.get(r);if(!c)comp.set(r,c={n:0,ids:[]});c.ids.push(i);if(isSt[i]===1)c.n++}
  if(comp.size>1&&nSt){const LH=new Hash(6);for(let i=0;i<used;i++){const q=t.slots[i];if(q&&!q.big)LH.add(q.x,q.z,1)}
   let main=null;comp.forEach((c,r)=>{if(!main||c.n>main.c.n)main={r,c}});
   const todo=[...comp.entries()].filter(([r])=>r!==main.r).map(([r,c])=>c);const mainR=()=>find(main.c.ids[0]);
   const cost=(ax,az,bx,bz)=>{const d=Math.hypot(bx-ax,bz-az),n=Math.max(1,Math.ceil(d/2));let bad=0;for(let k=1;k<n;k++){const x=ax+(bx-ax)*k/n,z=az+(bz-az)*k/n;if(LH.near(x,z,3.5)!==null)bad+=3;else if(t.wet(x,z))bad+=1;else if(t.HH.near(x,z,2)!==null)bad+=.2}return bad};
   for(let guard=0;guard<40&&todo.length;guard++){let best=null;const mr=mainR();
    todo.forEach((c,ci)=>{if(find(c.ids[0])===mr){c.done=1;return}const cand=[];
     for(const i of c.ids){for(const R of[14,30,60,120,260]){let bd=1e9,bq=-1;around(X[i],Z[i],R,q=>{if(find(q)!==mr)return;const d=(X[q]-X[i])**2+(Z[q]-Z[i])**2;if(d<bd){bd=d;bq=q}});if(bq>=0&&bd<=R*R){cand.push([Math.sqrt(bd),i,bq]);break}}}
     cand.sort((a,b)=>a[0]-b[0]);let pick=null;for(const k of cand.slice(0,30)){const b=cost(X[k[1]],Z[k[1]],X[k[2]],Z[k[2]]);const sc=k[0]+b*40;if(!pick||sc<pick.sc)pick={sc,k};if(!b)break}
     if(pick&&(!best||pick.sc<best.sc))best={sc:pick.sc,k:pick.k,ci}});
    for(let i=todo.length-1;i>=0;i--)if(todo[i].done)todo.splice(i,1);
    if(!best)break;const [d,a,b]=best.k;uni(a,b);todo.splice(todo.indexOf(todo.find(c=>c.ids.includes(a))),1);
    let ax=X[a],az=Z[a];const bx=X[b],bz=Z[b];if(isSt[a]===2){const l=Math.hypot(bx-ax,bz-az)||1;ax+=(bx-ax)/l*(lm.r+1.4);az+=(bz-az)/l*(lm.r+1.4)}
    if(Math.hypot(bx-ax,bz-az)<.6)continue;
    const n=Math.max(1,Math.ceil(Math.hypot(bx-ax,bz-az)/5));const seg=new Float32Array((n+1)*2);for(let k=0;k<=n;k++){const x=ax+(bx-ax)*k/n,z=az+(bz-az)*k/n;seg[k*2]=x;seg[k*2+1]=z;t.builtPts.push({x,z});t.ZH.add(x,z,1)}
    ribbonInto(seg,SW,CLS.G.y-.006,6,P,U,I);disc(ax,az,SW/2);disc(bx,bz,SW/2)}}}
 // příjezdová cesta k velkým stavbám (k nejbližšímu bodu hlavní silnice nebo postavené uličky)
 {const pts=t.builtPts;
  for(let i=0;i<used;i++){const it=t.items[i];if(it.k!=="s"||!it.pos)continue;const f=fpOf(it.id);const fx=it.pos.x+Math.sin(it.pos.ry)*f*.9,fz=it.pos.z+Math.cos(it.pos.ry)*f*.9;let q=null,bd=1e9;pts.forEach(p=>{const d=Math.hypot(p.x-fx,p.z-fz);if(d<bd){bd=d;q=p}});
   if(q&&bd>1.5&&bd<60){const seg=new Float32Array([fx,fz,q.x,q.z]);ribbonInto(seg,CLS.G.w,CLS.G.y,6,P,U,I);const base=cP.length/3;cP.push(fx,CLS.G.y-.001,fz);cU.push(.5,.5);for(let a=0;a<=12;a++){const an=a/12*6.283;cP.push(fx+Math.cos(an)*CLS.G.w/2,CLS.G.y-.001,fz+Math.sin(an)*CLS.G.w/2);cU.push(.5,.5);if(a)cI.push(base,base+a+1,base+a)}}}}
 if(P.length){const m=new T.Mesh(geoFrom(P,U,I),MAT.G);m.receiveShadow=true;m.userData.tmp=1;g.add(m)}
 if(cP.length){const m=new T.Mesh(geoFrom(cP,cU,cI),new T.MeshLambertMaterial({color:"#7d828c",polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}));m.userData.tmp=1;m.receiveShadow=true;g.add(m)}
 // speciální budovy
 for(let i=0;i<used;i++){const it=t.items[i];if(it.k!=="s")continue;const s=itemPos(t,i);const o=SPECIALS.build(it.id,it.text);o.position.set(s.x,0,s.z);o.rotation.y=s.ry;o.traverse(m=>{if(m.isMesh){m.castShadow=true;m.receiveShadow=true}});
  o.userData.ref={t,idx:i};const key=t.n+"#"+i;if(born.has(key)){o.scale.setScalar(.01);o.userData.grow=born.get(key)}g.add(o);t.specialObjs.push(o)}
 t.decorKey=null}
const signTexC={};
function townSignTex(n){if(signTexC[n])return signTexC[n];return signTexC[n]=canvasTex(512,200,(g,w,h)=>{g.fillStyle="#fff";g.fillRect(0,0,w,h);g.strokeStyle="#111";g.lineWidth=10;g.strokeRect(16,16,w-32,h-32);
 g.fillStyle="#111";let f=96;g.font=`700 ${f}px Arial`;while(g.measureText(n).width>w-70&&f>30){f-=4;g.font=`700 ${f}px Arial`}g.textAlign="center";g.textBaseline="middle";g.fillText(n,w/2,h/2+4)})}
/* cedule u příjezdů a stromy kolem obce – staví se až po silnicích (podle míst, kde silnice vstupují do obce) */
function townDecor(t){const cuts=t.cutsOk||[];const key=Math.round(t.R)+"|"+t.slots.length+"|"+cuts.map(c=>Math.round(c.x)+","+Math.round(c.z)).join(";");if(t.decorKey===key)return;t.decorKey=key;
 if(t.decor){t.group.remove(t.decor);t.decor.traverse(m=>{if(m.isInstancedMesh)m.dispose()})}const g=t.decor=new T.Group();t.group.add(g);const c0=t.group.position;
 const tex=townSignTex(t.n);const face=new T.MeshLambertMaterial({map:tex});const back=new T.MeshLambertMaterial({color:"#e7e9ee"});
 cuts.slice(0,3).forEach(c=>{const x=c.x-c0.x,z=c.z-c0.z;const l=Math.hypot(x,z)||1;const ox=x/l,oz=z/l;const sg=new T.Group();
  const board=new T.Mesh(new T.BoxGeometry(2.6,1.02,.08),[back,back,back,back,face,back]);board.position.y=2.25;board.castShadow=true;sg.add(board);
  const post=new T.Mesh(new T.CylinderGeometry(.07,.07,2.2,6),SPECIALS.M("#8e95a1"));post.position.y=1.1;post.castShadow=true;sg.add(post);
  sg.position.set(x+ox*2.2-oz*2.6,0,z+oz*2.2+ox*2.6);sg.rotation.y=Math.atan2(ox,oz);g.add(sg)});
 const r=rng(hashStr(t.n)+7);const tree=MODELS.p.tree;const n0=0,np=Math.min(2600,30+(t.usedB||[]).length*14);const n=n0+np;const im=new T.InstancedMesh(tree.geo,tree.mat,n);let k=0;
 const big=t.slots.filter(s=>s.big);
 // parky: stromy v prolukách uvnitř obce (kde není parcela, ulice, stavba ani voda)
 {const LH=new Hash(6),STH=new Hash(6);t.slots.forEach(s=>{if(!s.big)LH.add(s.x,s.z,1)});(t.builtPts||[]).forEach(q=>STH.add(q.x,q.z,1));const lm=t.lm;const UB=t.usedB||[];
  for(let i=0;i<np*3&&k<np&&UB.length;i++){const b=UB[Math.floor(r()*UB.length)];const x=b.cx+(r()-.5)*2*b.lr,z=b.cz+(r()-.5)*2*b.lr;
   if(LH.near(x,z,5.2)!==null||STH.near(x,z,3.3)!==null||Math.hypot(x-lm.x,z-lm.z)<lm.r+3.5||big.some(s=>Math.hypot(s.x-x,s.z-z)<s.big+1.5)||t.wet(x,z))continue;if(roadHash&&roadHash.near(c0.x+x,c0.z+z,3.2)!==null)continue;
   Q.setFromAxisAngle(UP,r()*6.3);V.set(x,0,z);const h=3.2+r()*2.4;SC.set(h,h,h);M4.compose(V,Q,SC);im.setMatrixAt(k++,M4)}}
 const k0=k;
 im.count=k;im.castShadow=true;g.add(im)}
const fpOf=id=>(SPECIALS.fp?SPECIALS.fp(id):null)||2.4;
function itemPos(t,i){if(!t.items[i])return null;if(!t.slots||!t.slots[i])layoutTown(t);return t.slots[i]||null}
const capN=t=>t.slots.length;
function townRadius(t){return t.Rlay||14}

/* ---------- erby, mlha, popisky ---------- */
const tierOf=n=>n>=100?"plat":n>=50?"gold":n>=20?"silver":"wood";
function erbTexture(name,tier,gray){return new Promise(ok=>{const d=ERB.E.find(e=>e[0]===name)||ERB.E.find(e=>e[0]==="Křížkový Újezdec");const svg=ERB.erb(d,tier);const url="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(svg);
 const img=new Image();img.onload=()=>{const c=document.createElement("canvas");c.width=216;c.height=256;const g=c.getContext("2d");if(gray)g.filter="grayscale(1) brightness(1.15) opacity(.85)";g.drawImage(img,0,0,216,256);const t=new T.CanvasTexture(c);ok({t,url})};img.onerror=()=>ok({t:null,url});img.src=url})}
const fogTex=canvasTex(128,128,(g,w,h)=>{const r=g.createRadialGradient(64,64,4,64,64,62);r.addColorStop(0,"rgba(255,255,255,.95)");r.addColorStop(.6,"rgba(240,244,248,.55)");r.addColorStop(1,"rgba(240,244,248,0)");g.fillStyle=r;g.fillRect(0,0,w,h)});
async function setErb(t){const open=t.players.length>=CONFIG.REVIVE;const tier=tierOf(t.players.length);const key=tier+(open?"":"g");if(t.erbKey===key)return;t.erbKey=key;const {t:tex,url}=await erbTexture(t.n,tier,!open);if(!tex)return;
 if(!t.erb){t.erb=new T.Sprite(new T.SpriteMaterial({map:tex,fog:false,transparent:true,depthWrite:false}));t.group.add(t.erb)}else{t.erb.material.map=tex;t.erb.material.needsUpdate=true}t.erbUrl=url;if(window.NAMESTI)NAMESTI.setPlaque(t.n,tex,!open)}
function setFog(t){if(t.open){if(t.fog){t.group.remove(t.fog);t.fog=null}return}if(t.fog)return;const f=new T.Group();const r=rng(hashStr(t.n)+1);
 for(let i=0;i<9;i++){const s=new T.Sprite(new T.SpriteMaterial({map:fogTex,transparent:true,depthWrite:false,opacity:.75+r()*.2}));const a=r()*6.28,d=r()*7;s.position.set(t.lm.x+Math.cos(a)*d,2+r()*5,t.lm.z+Math.sin(a)*d);const sc=10+r()*8;s.scale.set(sc,sc*.7,1);s.userData.ph=r()*6;f.add(s)}
 t.fog=f;t.group.add(f)}
const lblWrap=document.body;
TOWNS.forEach(t=>{const l=document.createElement("div");l.className="lbl";lblWrap.appendChild(l);t.lbl=l;l.onclick=()=>focusTown(t)});

/* ---------- cedule Praha / Benešov ---------- */
function bigSign(text){const tex=canvasTex(1024,300,(g,w,h)=>{g.fillStyle="#1f56b0";g.beginPath();g.moveTo(30,6);g.arcTo(w-6,6,w-6,h-6,30);g.arcTo(w-6,h-6,6,h-6,30);g.arcTo(6,h-6,6,6,30);g.arcTo(6,6,w-6,6,30);g.fill();g.strokeStyle="#fff";g.lineWidth=10;g.stroke();
 g.fillStyle="#fff";g.font="700 150px 'Space Grotesk',Arial";g.textAlign="center";g.textBaseline="middle";g.fillText(text,w/2,h/2+8)});const grp=new T.Group();
 const b=new T.Mesh(new T.BoxGeometry(24,7,.4),[SPECIALS.M("#e9edf5"),SPECIALS.M("#e9edf5"),SPECIALS.M("#e9edf5"),SPECIALS.M("#e9edf5"),new T.MeshBasicMaterial({map:tex}),new T.MeshBasicMaterial({map:tex})]);b.position.y=12;grp.add(b);
 [-9,9].forEach(x=>{const p=new T.Mesh(new T.CylinderGeometry(.35,.35,12,8),SPECIALS.M("#aab1bd"));p.position.set(x,6,0);p.castShadow=true;grp.add(p)});scene.add(grp);return grp}
let D1ends=null;
(function(){const ms=ROADS.filter(r=>r.c==="M");let nw=null,se=null,a=-1e18,b=-1e18;ms.forEach(r=>r.m.forEach(q=>{if(-q[0]+q[1]>a){a=-q[0]+q[1];nw=q}if(q[0]-q[1]>b){b=q[0]-q[1];se=q}}));D1ends={nw,se}})();
const SIGNS=[{txt:"↖ Praha",get:()=>D1ends.nw},{txt:"Benešov ↘",get:()=>D1ends.se}];

/* ---------- auta a vlak ---------- */
let cars=[];let train=null;
function initCars(){const kinds=["sedan","suv","taxi","van","hatchback-sports","suv-luxury","delivery","truck","sedan","suv"];const r=rng(21);
 for(let i=0;i<70;i++){const c=MODELS.c[kinds[i%kinds.length]];const m=new T.Mesh(c.geo,c.mat);m.scale.setScalar(.62);m.castShadow=true;scene.add(m);cars.push({m,p:Math.floor(r()*1e6),u:r(),dir:r()<.5?1:-1,v:9+r()*7})}
 train=KIT.train();train.scale.setScalar(.55);train.traverse(m=>{if(m.isMesh)m.castShadow=true});scene.add(train)}
function posOn(pts,dist,out){let acc=0;for(let i=2;i<pts.length;i+=2){const d=Math.hypot(pts[i]-pts[i-2],pts[i+1]-pts[i-1]);if(acc+d>=dist){const f=(dist-acc)/d;out.x=pts[i-2]+(pts[i]-pts[i-2])*f;out.z=pts[i-1]+(pts[i+1]-pts[i-1])*f;out.dx=(pts[i]-pts[i-2])/d;out.dz=(pts[i+1]-pts[i-1])/d;return out}acc+=d}out.x=pts[pts.length-2];out.z=pts[pts.length-1];out.dx=1;out.dz=0;return out}
const cp={};let trainU=0;
function moveCars(dt){if(!carPaths.length)return;cars.forEach(c=>{const P=carPaths[c.p%carPaths.length];c.u+=c.dir*c.v*(P.c==="M"?2:1)*dt/P.len;if(c.u>1||c.u<0){c.p=Math.floor(Math.random()*1e6);c.u=c.dir>0?0:1;return}
  posOn(P.pts,c.u*P.len,cp);const lane=(P.c==="M"?1.3:.55)*c.dir;c.m.position.set(cp.x-cp.dz*lane,.08,cp.z+cp.dx*lane);c.m.rotation.y=Math.atan2(cp.dx*c.dir,cp.dz*c.dir)});
 if(railPath&&train){let len=0;for(let i=2;i<railPath.length;i+=2)len+=Math.hypot(railPath[i]-railPath[i-2],railPath[i+1]-railPath[i-1]);trainU=(trainU+dt*14/len)%1;posOn(railPath,trainU*len,cp);train.position.set(cp.x,.05,cp.z);train.rotation.y=Math.atan2(cp.dx,cp.dz)}}

/* ---------- hráči (demo data) ---------- */
let DAY=1,POP=0;const ALLP=[];
const DEMO_JOBS=Object.keys(JOBS);function newPlayer(t,day,o){POP++;if(o&&!CONFIG.JOBS)o=Object.assign({},o,{job:null});if(CONFIG.JOBS&&!o&&Math.random()<.55)o={job:Math.random()<.35?"hasic":DEMO_JOBS[Math.floor(Math.random()*DEMO_JOBS.length)]};const no=POP;o=o||{};const p={no,ig:o.ig||null,nick:o.ig?"@"+o.ig:"@hrac_"+String(no).padStart(4,"0"),town:t.n,day,local:t.players.length+1,active:o.active!==undefined?o.active:Math.random()<.55,first:o.first!==undefined?o.first:t.players.length<5,badges:o.badges||[],follow:o.follow,job:jobOf(o.job)};t.players.push(p);ALLP.push(p);return p}
const shown=p=>CONFIG.SHOW_NICKS?p.nick:"Obyvatel č. "+String(p.no).padStart(4,"0");
/* ---------- skutečná data z world.json ---------- */
const TYPE_MAP={pomnik:"hospoda",kebab:"kebab",bistro:"kebab",lavicka:"workout",zastavka:"nadrazi",vecerka:"vecerka",obchod:"vecerka",hospoda:"hospoda",pub:"hospoda",hriste:"workout",workout:"workout",kavarna:"kavarna",hasicarna:"hasicarna",hasici:"hasicarna",fotbal:"fotbal",stadion:"stadion",pizzerie:"pizzerie",pizza:"pizzerie",rybnik:"rybnik",knihovna:"knihovna",skatepark:"skatepark",kino:"kino",nadrazi:"nadrazi",koupaliste:"koupaliste",rozhledna:"rozhledna",podium:"podium",kluziste:"stadion",tvrz:"tvrz",hrad:"tvrz",coworking:"knihovna",metro:"nadrazi",letiste:"letiste",radnice:"knihovna"};
const norm=x=>String(x||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim();
const townByNorm=Object.fromEntries(TOWNS.map(t=>[norm(t.n),t]));
let WORLD_REV=null;const KNOWN=new Set();
function worldEvents(w){const ev=[];(w.obce||[]).forEach(o=>{const t=townByNorm[norm(o.nazev)]||townByNorm[norm(String(o.id||"").replace(/-/g," "))];if(!t)return;
  (o.hraci||[]).forEach(h=>ev.push({d:h.datum||"",t,k:"h",h}));(o.specialni_budovy||[]).forEach(b=>ev.push({d:b.datum||"",t,k:"s",b}))});
 ev.sort((a,b)=>a.d<b.d?-1:a.d>b.d?1:0);return ev}
function applyEvents(ev,anim){const d0=ev.length?Date.parse(ev[0].d)||Date.now():Date.now();const now=performance.now();const changed=new Set();let k=0;
 ev.forEach(e=>{const key=e.k==="h"?"h:"+e.h.ig:"s:"+e.t.n+":"+(e.b.nazev_cedule||e.b.typ)+":"+e.d;if(KNOWN.has(key))return;KNOWN.add(key);const t=e.t;
  const day=Math.max(1,Math.floor(((Date.parse(e.d)||d0)-d0)/864e5)+1);
  if(e.k==="h"){const od=e.h.odznaky||[];newPlayer(t,day,{ig:e.h.ig,job:e.h.povolani,first:od.includes("prvni_v_obci")||t.players.length<5,active:true,badges:od,follow:od.includes("follow_overen")});const idx=addItem(t,{k:"h",p:t.players[t.players.length-1]});if(anim)born.set(t.n+"#"+idx,now+(k++)*120);const jb=jobBuild(t,day);if(jb>=0&&anim)born.set(t.n+"#"+jb,now+(k++)*120)}
  else{const id=SPECIALS.CAT.find(c=>c.id===(TYPE_MAP[norm(e.b.typ).replace(/ /g,"")]||"hospoda"))?(TYPE_MAP[norm(e.b.typ).replace(/ /g,"")]||"hospoda"):"hospoda";const idx=addItem(t,{k:"s",id,text:e.b.nazev_cedule||SPECIALS.CAT.find(c=>c.id===id).example,author:e.b.autor?"@"+String(e.b.autor).replace(/^@/,""):"komunita",day});if(anim)born.set(t.n+"#"+idx,now+(k++)*120)}
  changed.add(t)});return changed}
async function fetchWorld(){const urls=QS.get("data")?[CONFIG.DATA_URL]:["world.json","../world.json"];for(const u of urls){try{const r=await fetch(u+(u.includes("?")?"&":"?")+"t="+Date.now(),{cache:"no-store"});if(!r.ok)continue;const w=await r.json();if(!w||!Array.isArray(w.obce)||w.ukazka)continue;CONFIG.DATA_URL=u;QS.set("data",u);return w}catch(e){}}return null}
/* nový stát: název do hlavičky, vlajka na stožáry u návsí a na Náměstí sjednocení (world.stat, pro náhled ?stat=Název) */
const STAT={nazev:"",svg:""};const FLAG_TEX=new T.CanvasTexture(Object.assign(document.createElement("canvas"),{width:384,height:256}));
const FLAG_MAT=new T.MeshLambertMaterial({map:FLAG_TEX,side:T.DoubleSide,visible:false}),POLE_MAT=new T.MeshLambertMaterial({color:0xd9dde6});
function flagSvg(v){if(v&&v.svg)return v.svg;const pr=(v&&v.pruhy&&v.pruhy.length?v.pruhy:["#2F4AA8","#ffffff"]),n=pr.length,ver=v&&v.smer==="v";
 const bands=pr.map((c,i)=>ver?`<rect x="${i*300/n}" y="0" width="${300/n+.5}" height="200" fill="${c}"/>`:`<rect x="0" y="${i*200/n}" width="300" height="${200/n+.5}" fill="${c}"/>`).join("");
 const sym=v&&v.symbol?`<text x="150" y="104" font-size="96" text-anchor="middle" dominant-baseline="middle">${String(v.symbol).replace(/[<&>]/g,"")}</text>`:"";
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200" width="300" height="200">${bands}${sym}</svg>`}
function applyStat(st){const nazev=(st&&st.nazev?String(st.nazev):"").slice(0,40),svg=st&&st.vlajka?flagSvg(st.vlajka):"";if(nazev===STAT.nazev&&svg===STAT.svg)return;STAT.nazev=nazev;STAT.svg=svg;
 const h=document.querySelector("#brand h1");if(h){h.innerHTML="";if(svg){const im=new Image();im.src="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(svg);im.alt="";im.style.cssText="height:18px;border-radius:3px;margin-right:7px;vertical-align:-3px;box-shadow:0 0 0 1px rgba(0,0,0,.15)";h.appendChild(im)}
  h.appendChild(document.createTextNode(nazev||"Postav si Říčansko"));if(nazev){const sm=document.createElement("small");sm.textContent="Postav si Říčansko";sm.style.cssText="display:block;font:600 11px Inter,sans-serif;opacity:.6;margin-top:2px";h.appendChild(sm)}}
 document.title=nazev?nazev+" · Postav si Říčansko":"Postav si Říčansko";
 if(svg){const im=new Image();im.onload=()=>{const c=FLAG_TEX.image,x=c.getContext("2d");x.clearRect(0,0,c.width,c.height);x.drawImage(im,0,0,c.width,c.height);FLAG_TEX.needsUpdate=true;FLAG_MAT.visible=true};im.src="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(svg)}else FLAG_MAT.visible=false;
 if(window.GAME&&GAME.onStat)GAME.onStat({nazev,svg})}
function flagpole(x,z,h){const o=new T.Group();const pole=new T.Mesh(new T.CylinderGeometry(.11,.14,h,8),POLE_MAT);pole.position.y=h/2;pole.castShadow=true;o.add(pole);const knob=new T.Mesh(new T.SphereGeometry(.24,10,8),POLE_MAT);knob.position.y=h+.1;o.add(knob);
 const fl=new T.Mesh(new T.PlaneGeometry(h*.42,h*.28,6,1),FLAG_MAT);const pa=fl.geometry.attributes.position;for(let i=0;i<pa.count;i++)pa.setZ(i,Math.sin(pa.getX(i)*1.7)*.16);fl.geometry.computeVertexNormals();fl.position.set(h*.21+.12,h-h*.16,0);fl.castShadow=true;o.add(fl);o.position.set(x,0,z);o.rotation.y=.6;return o}
async function pollWorld(){const w=await fetchWorld();if(!w)return;if(!QS.get("stat"))applyStat(w.stat);if(w.revize!==undefined&&w.revize===WORLD_REV)return;WORLD_REV=w.revize;const before=POP;const ch=applyEvents(worldEvents(w),true);if(w.den_hry)DAY=w.den_hry;
 if(ch.size){refreshAll([...ch]);if(POP>before)toast(`+${POP-before} nových obyvatel`,[...ch].map(t=>t.n).slice(0,3).join(" · "))}else updateUI()}
/* názvy staveb z komentářů: filtr sprostých slov + délka; nevhodné -> výchozí název kategorie */
const BAD=/(kurv|pi[cč][aeouy]|kokot|[cč]ur[aá]k|mrd|debil|hitler|nac[ií]s|nazi|negr|cig[aá]n|buzn|buzer|porn|fuck|shit|bitch|hovn|prdel|sex|onlyfans|penis|vagin|kund|ho[vw]ad|sra[cč]k|jeb|zasran|smrd|drog|pervit|kokain|hero[ií]n|\bfet(ak|ák|ka|ky)?\b|chc[ií]p|zabij|smrt|nen[aá]vi|rasis|xenof|teror)/i;
function cleanName(text,id){const t=String(text||"").replace(/\s+/g," ").trim();const d=(SPECIALS.CAT.find(c=>c.id===id)||{}).example||"";if(!t||t.length<2||t.length>40||BAD.test(t)||BAD.test(t.normalize("NFD").replace(/[\u0300-\u036f]/g,"")))return d;return t}
function addItem(t,it){if(it.k==="s")it.text=cleanName(it.text,it.id);t.items.push(it);return t.items.length-1}
function jobCounts(t){const c={};t.players.forEach(p=>{if(p.job)c[p.job]=(c[p.job]||0)+1});return c}
function jobBuild(t,day){if(!CONFIG.JOBS)return -1;const c=jobCounts(t);for(const [j,n] of Object.entries(c)){if(n<CONFIG.JOB_N)continue;const J=JOBS[j];if(t.items.some(x=>x.k==="s"&&(x.job===j||x.id===J.b)))continue;return addItem(t,{k:"s",id:J.b,text:J.t(t.n).slice(0,30),author:"cech "+J.n.toLowerCase()+"ů",job:j,day})}return -1}
function unlockedCatalog(t){return SPECIALS.CAT.filter(c=>t.players.length>=c.th)}
function seedDemo(){const r=rng(77);const big={"Říčany":72,"Mnichovice":34,"Velké Popovice":26,"Mukařov":22,"Kamenice":24,"Kostelec nad Černými lesy":18,"Strančice":16,"Světice":14,"Ondřejov":12,"Kunice":11,"Sulice":9,"Senohraby":8,"Mirošovice":7,"Tehovec":6,"Babice":5};
 const order=[];TOWNS.forEach(t=>{const n=big[t.n]!==undefined?big[t.n]:Math.floor(r()*r()*5);for(let i=0;i<n;i++)order.push(t)});
 for(let i=order.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[order[i],order[j]]=[order[j],order[i]]}
 const demoNames={"Říčany":[["kebab","Kebab u Alenky"],["hospoda","U Zlatého Radaru"],["fotbal","Okresní přebor Arena"],["kavarna","Kafe & drby"],["skatepark","Skatepark Odřená kolena"]],"Mnichovice":[["hasicarna","SDH Rychlí jak Wi-Fi"],["vecerka","Večerka do kdy se mi chce"]],"Velké Popovice":[["hospoda","Hospoda U Kozla"]],"Mukařov":[["workout","Workout pro ty, co tam chodí"]],"Kamenice":[["pizzerie","Pizza Alla Kamenice"]],"Kostelec nad Černými lesy":[["zastavka","Zastávka Poslední 3 minuty"]],"Strančice":[["lavicka","Lavička, kde se řeší všechno"]]};
 order.forEach((t,i)=>{const day=1+Math.floor(i/order.length*11);newPlayer(t,day);addItem(t,{k:"h",p:t.players[t.players.length-1]});jobBuild(t,day);
  const dn=demoNames[t.n];if(dn){const nb=t.items.filter(x=>x.k==="s").length;const want=dn.filter((d,k)=>t.players.length>=[6,12,20,30,45][k]).length;
   if(want>nb){const [id,text]=dn[nb];addItem(t,{k:"s",id,text,author:t.players[Math.floor(r()*t.players.length)].nick,day})}}});
 DAY=12}

/* ---------- roztahování světa ---------- */
function requiredS(){let s=0.02;for(let i=0;i<TOWNS.length;i++){const a=TOWNS[i];for(let j=i+1;j<TOWNS.length;j++){const b=TOWNS[j];const d=Math.hypot(a.x-b.x,a.y-b.y);s=Math.max(s,(SPREAD*(a.R+b.R)+GAP)/d)}}return s}
let animS=null;
const stationG=new T.Group();scene.add(stationG);let stations=null;
function stationObj(name){const g=new T.Group();const pl=new T.Mesh(new T.BoxGeometry(1.6,.45,12),SPECIALS.M("#cfc9bc"));pl.position.y=.22;pl.castShadow=pl.receiveShadow=true;g.add(pl);
 const rf=new T.Mesh(new T.BoxGeometry(1.8,.12,4),SPECIALS.M("#2f72d6"));rf.position.y=2.4;rf.castShadow=true;g.add(rf);[-1.6,1.6].forEach(z=>{const c=new T.Mesh(new T.CylinderGeometry(.06,.06,2,6),SPECIALS.M("#9aa1ad"));c.position.set(.5,1.4,z);g.add(c)});
 const tex=canvasTex(512,128,(c,w,h)=>{c.fillStyle="#1f3c8f";c.fillRect(0,0,w,h);c.fillStyle="#fff";let f=64;c.font=`700 ${f}px Arial`;while(c.measureText(name).width>w-30&&f>24){f-=4;c.font=`700 ${f}px Arial`}c.textAlign="center";c.textBaseline="middle";c.fillText(name,w/2,h/2+3)});
 const b=new T.Mesh(new T.PlaneGeometry(3,.75),new T.MeshBasicMaterial({map:tex,side:T.DoubleSide}));b.position.set(.85,2,0);b.rotation.y=Math.PI/2;g.add(b);return g}
function placeStations(){if(!stations){const rail=ROADS.filter(r=>r.c==="Z");stations=MAP.stations.filter(st=>{const near=TOWNS.some(t=>Math.hypot(t.x-st[0][0],t.y-st[0][1])<2500);return near}).map(st=>{let best=null,bd=1e18,rd=null,bi=0;rail.forEach(r=>r.m.forEach((q,i)=>{const d=(q[0]-st[0][0])**2+(q[1]-st[0][1])**2;if(d<bd){bd=d;best=q;rd=r;bi=i}}));
  if(!best||bd>250*250)return null;const o=stationObj(st[1]);o.traverse(m=>{if(m.isMesh)m.castShadow=true});stationG.add(o);return{o,rd,bi}}).filter(Boolean)}
 stations.forEach(s=>{const m=s.rd.m;const a=m[Math.max(0,s.bi-1)],b=m[Math.min(m.length-1,s.bi+1)],c=m[s.bi];F(a[0],a[1],tmp2);const ax=tmp2[0],az=tmp2[1];F(b[0],b[1],tmp2);const bx=tmp2[0],bz=tmp2[1];F(c[0],c[1],tmp2);
  const dx=bx-ax,dz=bz-az,l=Math.hypot(dx,dz)||1;s.o.position.set(tmp2[0]-dz/l*2.1,0,tmp2[1]+dx/l*2.1);s.o.rotation.y=Math.atan2(dx,dz)})}
const cloudTex=canvasTex(256,128,(g,w,h)=>{for(let i=0;i<14;i++){const x=40+Math.random()*176,y=50+Math.random()*30,r=26+Math.random()*30;const gr=g.createRadialGradient(x,y,0,x,y,r);gr.addColorStop(0,"rgba(255,255,255,.95)");gr.addColorStop(1,"rgba(255,255,255,0)");g.fillStyle=gr;g.beginPath();g.arc(x,y,r,0,7);g.fill()}});
const clouds=[];for(let i=0;i<14;i++){const sp=new T.Sprite(new T.SpriteMaterial({map:cloudTex,transparent:true,depthWrite:false,opacity:0,fog:false}));sp.userData={u:Math.random(),v:Math.random(),sz:.7+Math.random()*.8};scene.add(sp);clouds.push(sp)}
function updClouds(now,dist){const b=regionBox();const W=b[2]-b[0],H=b[3]-b[1];const op=Math.max(0,Math.min(.42,(dist-600*S/0.06)/(1400*S/0.06)));
 clouds.forEach(c=>{const u=(c.userData.u+now*.000004)%1;c.position.set(b[0]-W*.1+u*W*1.2,dist*.45,b[1]+c.userData.v*H);const s=W*.16*c.userData.sz;c.scale.set(s,s*.5,1);c.material.opacity=op})}
/* ---------- spojování obcí: když se dvě obce dotknou, jejich uličky se propojí ---------- */
let linkGroup=null;const LINKS=new Set(),LINKSEG=[];
function buildLinks(){if(!linkGroup){linkGroup=new T.Group();scene.add(linkGroup)}linkGroup.children.forEach(m=>m.geometry&&m.geometry.dispose());linkGroup.clear();
 const P=[],U=[],I=[],cP=[],cU=[],cI=[];const cap=(x,z)=>{const base=cP.length/3;cP.push(x,CLS.G.y-.001,z);cU.push(.5,.5);for(let a=0;a<=12;a++){const an=a/12*6.283;cP.push(x+Math.cos(an)*CLS.G.w/2,CLS.G.y-.001,z+Math.sin(an)*CLS.G.w/2);cU.push(.5,.5);if(a)cI.push(base,base+a+1,base+a)}};
 const fresh=[];LINKSEG.length=0;
 for(let i=0;i<TOWNS.length;i++)for(let j=i+1;j<TOWNS.length;j++){const a=TOWNS[i],b=TOWNS[j];if(!a.open||!b.open||!a.builtEnds||!b.builtEnds)continue;
  const pa=a.group.position,pb=b.group.position;const d=Math.hypot(pa.x-pb.x,pa.z-pb.z);if(d>a.R+b.R+14)continue;
  const W=(t,p)=>({x:t.group.position.x+p.x,z:t.group.position.z+p.z});const segs=[];
  const pick=(from,to)=>{let best=null,bd=1e9;from.builtEnds.forEach(e=>{const we=W(from,e);to.builtPts.forEach(q=>{const wq=W(to,q);const dd=Math.hypot(we.x-wq.x,we.z-wq.z);if(dd<bd){bd=dd;best=[we,wq]}})});if(best&&bd>2&&bd<60)segs.push(best)};
  pick(a,b);pick(b,a);if(!segs.length)continue;
  if(segs.length===2&&Math.hypot(segs[0][0].x-segs[1][1].x,segs[0][0].z-segs[1][1].z)<6)segs.pop();
  segs.forEach(([p,q])=>{LINKSEG.push({a:a.n,b:b.n,p,q});ribbonInto(new Float32Array([p.x,p.z,q.x,q.z]),CLS.G.w,CLS.G.y,6,P,U,I);cap(p.x,p.z);cap(q.x,q.z)});
  const key=a.n+"|"+b.n;if(!LINKS.has(key)){LINKS.add(key);fresh.push([a.n,b.n])}}
 if(P.length){const m=new T.Mesh(geoFrom(P,U,I),MAT.G);m.receiveShadow=true;linkGroup.add(m)}
 if(cP.length){const m=new T.Mesh(geoFrom(cP,cU,cI),new T.MeshLambertMaterial({color:"#7d828c",polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}));m.receiveShadow=true;linkGroup.add(m)}
 if(ready&&fresh.length)toast(`🤝 ${fresh[0][0]} a ${fresh[0][1]} se spojily!`,"ulice obou obcí se propojily");return fresh}
function relayout(full){updTownParams();TOWNS.forEach(t=>{const c=tc(t);t.group.position.copy(c)});if(window.NAMESTI&&NAMESTI.group){F(CENTER.x,CENTER.y,tmp2);NAMESTI.group.position.set(tmp2[0],0,tmp2[1])}
 const span=60000*S;ground.scale.set(span,span,1);ground.position.set(0,0,0);
 mapLand();buildRoads();TOWNS.forEach(townDecor);placeHouses(performance.now());placeStations();buildLinks();
 SIGNS.forEach(s=>{if(!s.g)s.g=bigSign(s.txt);const q=s.get();F(q[0],q[1],tmp2);s.g.position.set(tmp2[0]+(s.txt[0]==="↖"?-8:8),0,tmp2[1]+(s.txt[0]==="↖"?-8:8));s.g.lookAt(cam.position.x,0,cam.position.z)});
 if(full){sampleForest();placeForest()}
 scene.fog.near=180*S/0.09;scene.fog.far=2400*S/0.09;ctr.maxDistance=2400*S/0.09}

/* ---------- koruna týdne (putovní) ---------- */
let crownObj=null,crownT=null;
function weekGain(t,d=DAY){return t.players.filter(p=>p.day>d-7&&p.day<=d).length}
function crownAt(d){let best=null,bn=0;TOWNS.forEach(t=>{const n=t.players.filter(p=>p.day<=d).length;if(n>=CONFIG.REVIVE&&n>bn){bn=n;best=t}});return best}
/* koruna: nosí ji obec s nejvíc obyvateli */
function crownTown(){let best=null,bn=0;TOWNS.forEach(t=>{const n=t.players.length;if(n>=CONFIG.REVIVE&&t.group&&n>bn){bn=n;best=t}});return best}
/* ---------- návrh středu sjednoceného města (náčrt, ?stred=0 skryje) ---------- */
const CENTER_PTS=[{x:-1078,y:-403,n:"Střed Říčanska",sub:"průměr poloh 52 obcí · u Klokočné",main:true},{x:-2781,y:826,n:"Těžiště obyvatel",sub:"vážené počtem obyvatel · u Tehova",main:false}];
const centerMarks=[];
function buildCenterMarks(){if(QS.get("stred")!=="1")return;CENTER_PTS.forEach((c,i)=>{const g=new T.Group();const gold=new T.MeshStandardMaterial({color:c.main?"#f4c430":"#9fe0ff",emissive:c.main?"#7a5200":"#1b5a7a",emissiveIntensity:.5,metalness:.5,roughness:.35});
 const h=c.main?26:14;const pil=new T.Mesh(new T.CylinderGeometry(c.main?1.1:.7,c.main?1.6:1,h,10),gold);pil.position.y=h/2;g.add(pil);const ball=new T.Mesh(new T.SphereGeometry(c.main?2.4:1.4,16,12),gold);ball.position.y=h+1.5;g.add(ball);
 const ring=new T.Mesh(new T.RingGeometry(c.main?6:3.5,c.main?7.2:4.2,40),new T.MeshBasicMaterial({color:c.main?"#f4c430":"#9fe0ff",transparent:true,opacity:.75,side:T.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.y=.3;g.add(ring);
 g.traverse(m=>{if(m.isMesh&&m!==ring)m.castShadow=true});scene.add(g);const l=document.createElement("div");l.className="lbl";l.innerHTML=`${c.main?"📍 ":"◎ "}${c.n}<small>${c.sub}</small>`;l.style.color=c.main?"#ffd34d":"#cfefff";lblWrap.appendChild(l);centerMarks.push({c,g,l,ring})})}
function updCenterMarks(now){const v=new T.Vector3();centerMarks.forEach(m=>{F(m.c.x,m.c.y,tmp2);m.g.position.set(tmp2[0],0,tmp2[1]);m.ring.scale.setScalar(1+Math.sin(now/600)*.08);v.set(tmp2[0],(m.c.main?32:18),tmp2[1]).project(cam);const vis=v.z<1&&Math.abs(v.x)<1.05&&Math.abs(v.y)<1.05;m.l.style.display=vis?"":"none";if(vis){m.l.style.left=(v.x*.5+.5)*innerWidth+"px";m.l.style.top=(-v.y*.5+.5)*innerHeight+"px";m.l.style.fontSize="13px"}})}
function makeCrown(){const g=new T.Group();const gold=new T.MeshStandardMaterial({color:"#f4c430",metalness:.7,roughness:.32,emissive:"#7a5200",emissiveIntensity:.4,side:T.DoubleSide});
 const ring=new T.Mesh(new T.CylinderGeometry(2.1,2.4,1.4,24,1,true),gold);g.add(ring);const base=new T.Mesh(new T.TorusGeometry(2.4,.24,10,32),gold);base.rotation.x=Math.PI/2;base.position.y=-.7;g.add(base);
 for(let i=0;i<8;i++){const a=i/8*Math.PI*2;const sp=new T.Mesh(new T.ConeGeometry(.5,1.7,6),gold);sp.position.set(Math.cos(a)*2.15,1.5,Math.sin(a)*2.15);g.add(sp);
  const gem=new T.Mesh(new T.SphereGeometry(.3,10,8),new T.MeshStandardMaterial({color:i%2?"#e63946":"#2f6df6",emissive:i%2?"#6a0a12":"#0b2a6e",emissiveIntensity:.6,roughness:.15,metalness:.1}));gem.position.set(Math.cos(a)*2.45,.25,Math.sin(a)*2.45);g.add(gem)}
 const light=new T.PointLight("#ffd36a",.9,22);light.position.y=2;g.add(light);g.traverse(m=>{if(m.isMesh)m.castShadow=true});return g}
function updCrown(){const t=crownTown();if(t===crownT&&crownObj)return;if(crownObj&&crownObj.parent)crownObj.parent.remove(crownObj);crownObj=null;const was=crownT;crownT=t;if(!t)return;
 crownObj=makeCrown();crownObj.scale.setScalar(1.35);const top=t.lmObj?new T.Box3().setFromObject(t.lmObj).max.y:8;crownObj.userData.y=top+4.5;crownObj.position.set(t.lm.x,crownObj.userData.y,t.lm.z);t.group.add(crownObj);
 if(ready&&was&&was!==t)toast(`👑 Koruna týdne putuje do obce ${t.n}!`,`největší přírůstek za 7 dní · +${weekGain(t)}`)}
function refreshAll(changed){let grew=false;(changed||TOWNS).forEach(t=>{layoutTown(t);const wasOpen=t.open;const wasRev=t.rev;t.rev=t.players.length>=CONFIG.REVIVE;if(t.rev&&wasRev===false&&ready)toast(`🏡 ${t.n} ožila!`,`opuštěné domy mají nové obyvatele (${CONFIG.REVIVE}/${CONFIG.REVIVE})`);t.open=t.players.length>=CONFIG.OPEN_AT;const R=townRadius(t);if(Math.abs(R-t.R)>.01)grew=true;t.R=R;refreshTown(t);setFog(t);setErb(t);
  if(t.open&&!wasOpen&&ready)toast(`🏡 ${t.n} je na mapě!`,"první obyvatel postavil domek")});
 const need=FIXED_MAP?0:requiredS();if(need>S*1.0005){Starget=need*1.04;animS={from:S,to:Starget,t0:performance.now()};if(ready)toast("🌍 Říčansko se rozrostlo!",`obce se od sebe odsunuly · měřítko světa ×${(Starget/S0).toFixed(2)}`)}
 relayout(grew&&!animS);updCrown();updateUI()}

/* ---------- UI ---------- */
let S0=0.05,ready=false;
const sel=$("sel");
function updateUI(){if(window.GAME&&GAME.onUpdate)GAME.onUpdate();$("sDay").textContent=DAY;$("sPop").textContent=POP;$("sTowns").textContent=TOWNS.filter(t=>t.open).length+"/"+TOWNS.length;
 const cur=sel.value;sel.innerHTML=TOWNS.slice().sort((a,b)=>b.players.length-a.players.length).map(t=>`<option value="${t.n}">${t.n} · ${t.players.length}${t.open?"":" 🔒"}</option>`).join("");if(cur)sel.value=cur;
 TOWNS.forEach(t=>{const n=t.players.length,rv=n>=CONFIG.REVIVE;t.lbl.className="lbl"+(rv?"":" lock");t.lbl.innerHTML=rv?`${t===crownT?"👑 ":""}${t.n}<small>${n} obyvatel</small>`:`${t.n}<small>🏚️ opuštěná · ${n}/${CONFIG.REVIVE}</small>`})}
let tt;function toast(a,b){const e=$("toast");e.innerHTML=a+(b?`<small>${b}</small>`:"");e.classList.add("on");clearTimeout(tt);tt=setTimeout(()=>e.classList.remove("on"),2800)}
function addPlayers(t,n){const now=performance.now();for(let k=0;k<n;k++){newPlayer(t,DAY);const idx=addItem(t,{k:"h",p:t.players[t.players.length-1]});born.set(t.n+"#"+idx,now+k*90);const jb=jobBuild(t,DAY);if(jb>=0){born.set(t.n+"#"+jb,now+k*90+300);const it=t.items[jb];toast(`${JOBS[it.job].e} ${t.n}: ${CONFIG.JOB_N} ${JOBS[it.job].n.toLowerCase()}ů staví!`,it.text)}}
 if(t.players.length>=CONFIG.OPEN_AT&&t.players.length-n<CONFIG.OPEN_AT){t.items.forEach((it,i)=>born.set(t.n+"#"+i,now+i*60))}refreshAll([t])}
function buildSpecial(t){const cat=unlockedCatalog(t);const done=new Set(t.items.filter(x=>x.k==="s").map(x=>x.id));const c=cat.find(x=>!done.has(x.id));
 if(!t.open){toast(`${t.n} zatím nemá obyvatele`,"nejdřív se musí někdo přistěhovat");return}if(!c){toast("Další budova se odemkne později",`další práh: ${(SPECIALS.CAT.find(x=>x.th>t.players.length)||{th:"–"}).th} obyvatel`);return}
 const author=t.players[Math.floor(Math.random()*t.players.length)].nick;const idx=addItem(t,{k:"s",id:c.id,text:c.example,author,day:DAY});born.set(t.n+"#"+idx,performance.now());
 toast(`🏗️ ${t.n} staví: ${c.name}`,`„${c.example}“ · nápad od ${author}`);refreshAll([t]);const s=itemPos(t,idx);if(s)flyToLocal(t,s,30)}
sel.onchange=()=>focusTown(byName[sel.value]);
$("add1").onclick=()=>{const t=byName[sel.value];addPlayers(t,1);if(t.open){const s=t.slots[t.items.length-1];if(s)flyToLocal(t,s,40)}};
$("add10").onclick=()=>{addPlayers(byName[sel.value],10)};
/* hromadné přidání bez animace (zátěžový test: co když přijde 2 000 lidí) */
function bulkAdd(add){const t0=performance.now();add.forEach((n,t)=>{for(let k=0;k<n;k++){newPlayer(t,DAY);addItem(t,{k:"h",p:t.players[t.players.length-1]})}});refreshAll([...add.keys()]);born.clear();placeHouses(performance.now());return Math.round(performance.now()-t0)}
function randomSplit(N){const w=TOWNS.map(t=>t.players.length+1.5);const sum=w.reduce((a,b)=>a+b,0);const add=new Map();for(let k=0;k<N;k++){let v=Math.random()*sum,i=0;while(v>w[i]){v-=w[i];i++}add.set(TOWNS[i],(add.get(TOWNS[i])||0)+1)}return add}
if($("add100"))$("add100").onclick=()=>{const t=byName[sel.value];bulkAdd(new Map([[t,100]]));toast(`${t.n}: +100 obyvatel`,`celkem ${t.players.length}`)};
if($("add500"))$("add500").onclick=()=>{const t=byName[sel.value];bulkAdd(new Map([[t,500]]));toast(`${t.n}: +500 obyvatel`,`celkem ${t.players.length}`)};
if($("wave2k"))$("wave2k").onclick=()=>{DAY++;const add=randomSplit(2000);const ms=bulkAdd(add);toast(`Den ${DAY}: +2 000 nových obyvatel`,`celkem ${POP} · přepočet ${ms} ms`)};
$("build").onclick=()=>buildSpecial(byName[sel.value]);
$("wave").onclick=()=>{DAY++;const w=TOWNS.map(t=>t.players.length+1.5);const sum=w.reduce((a,b)=>a+b,0);const add=new Map();for(let k=0;k<40;k++){let v=Math.random()*sum,i=0;while(v>w[i]){v-=w[i];i++}add.set(TOWNS[i],(add.get(TOWNS[i])||0)+1)}
 const now=performance.now();const ch=[];add.forEach((n,t)=>{for(let k=0;k<n;k++){newPlayer(t,DAY);const idx=addItem(t,{k:"h",p:t.players[t.players.length-1]});born.set(t.n+"#"+idx,now+k*90)}ch.push(t)});refreshAll(ch);toast(`Den ${DAY}: +40 nových obyvatel`,[...add.entries()].sort((a,b)=>b[1]-a[1]).slice(0,3).map(([t,n])=>`${t.n} +${n}`).join(" · "))};
$("over").onclick=()=>overview();
$("toggleHud").onclick=()=>$("hud").classList.toggle("open");
$("infoX").onclick=()=>closeInfo();
$("catBtn").onclick=()=>openCatalog();$("catX").onclick=()=>$("cat").classList.remove("on");

/* ---------- výběr domku ---------- */
const ray=new T.Raycaster(),mouse=new T.Vector2();let downAt=null;const ring=new T.Mesh(new T.RingGeometry(3.6,4.3,40).rotateX(-Math.PI/2),new T.MeshBasicMaterial({color:"#ffd23f",transparent:true,opacity:.95,depthWrite:false}));ring.visible=false;scene.add(ring);
canvas.addEventListener("pointerdown",e=>{downAt=[e.clientX,e.clientY]});
canvas.addEventListener("pointerup",e=>{if(!downAt||Math.hypot(e.clientX-downAt[0],e.clientY-downAt[1])>6)return;mouse.set(e.clientX/innerWidth*2-1,-e.clientY/innerHeight*2+1);ray.setFromCamera(mouse,cam);
 const hits=ray.intersectObjects(HOUSE.concat(TOWNS.flatMap(t=>t.specialObjs||[])),true);if(!hits.length)return;const h=hits[0];
 if(h.object.isInstancedMesh){const ri=HOUSE.indexOf(h.object);const ref=houseRef[ri][h.instanceId];if(ref)selectItem(ref.t,ref.idx)}else{let o=h.object;while(o&&!o.userData.ref)o=o.parent;if(o)selectItem(o.userData.ref.t,o.userData.ref.idx)}});
function badge(c,t){return`<span class="b ${c}">${t}</span>`}
function selectItem(t,idx){const it=t.items[idx],s=itemPos(t,idx);if(!it||!s)return;const c=tc(t);ring.position.set(c.x+s.x,.12,c.z+s.z);ring.visible=true;ring.userData.t0=performance.now();
 const tierN={wood:"Dřevěná",silver:"Stříbrná",gold:"Zlatá",plat:"Platinová"}[tierOf(t.players.length)];
 let html;if(it.k==="h"){const p=it.p;const rank=t.players.indexOf(p)+1;const b=[];if(p.first)b.push(badge("gold","⭐ Zakladatel obce"));if(p.no<=100)b.push(badge("blue","🏅 Prvních 100"));if(p.follow)b.push(badge("green","✔️ Sleduje Radar"));b.push(p.active?badge("green","🟢 Aktivní tento týden"):badge("","💤 Tento týden spí"));if(p.job)b.unshift(badge("gold",`${JOBS[p.job].e} ${JOBS[p.job].n}`));b.push(badge("",`🛡️ ${tierN} obec`));
  html=`<div class="top"><div class="av">${CONFIG.SHOW_NICKS?p.nick.slice(1,3).toUpperCase():"#"}</div><div><h3>${shown(p)}</h3><div class="sub">${CONFIG.SHOW_NICKS?"Obyvatel č. "+String(p.no).padStart(4,"0")+" · ":""}${p.local}. obyvatel obce ${t.n}</div></div></div><div class="badges">${b.join("")}</div>
  <dl><dt>Přistěhoval/a</dt><dd>Den ${p.day}</dd><dt>Domek v obci</dt><dd>${rank}. z ${t.players.length}</dd><dt>Status</dt><dd>${p.first?"Zakladatel":"Obyvatel"}${p.active?" · hlasuje":""}</dd></dl>`}
 else{const c2=SPECIALS.CAT.find(x=>x.id===it.id);html=`<div class="top"><div class="av" style="background:${c2.color}">${c2.emoji}</div><div><h3>${it.text}</h3><div class="sub">${c2.name} · ${t.n}</div></div></div><div class="badges">${badge("gold","🏗️ Speciální budova")}${badge("",`odemčeno od ${c2.th} obyvatel`)}</div>
  <dl><dt>Nápad od</dt><dd>${CONFIG.SHOW_NICKS?(it.author||"komunita"):"komunita"}</dd><dt>Postaveno</dt><dd>Den ${it.day||DAY}</dd></dl>`}
 $("infoBody").innerHTML=html;$("info").classList.add("on");flyToLocal(t,s,it.k==="h"?20:28)}
function closeInfo(){$("info").classList.remove("on");ring.visible=false}

/* ---------- kamera ---------- */
let fly=null;
function flyTo(target,pos,ms=1500){if(ms<=1){fly=null;ctr.target.copy(target);cam.position.copy(pos);return Promise.resolve()}return new Promise(ok=>{fly={from:ctr.target.clone(),to:target.clone(),cf:cam.position.clone(),ct:pos.clone(),t0:performance.now(),ms,ok}})}
function flyToLocal(t,s,dist){const c=tc(t);const target=new T.Vector3(c.x+s.x,1.5,c.z+s.z);const az=ctr.getAzimuthalAngle();const el=.62;const pos=target.clone().add(new T.Vector3(Math.sin(az)*Math.cos(el),Math.sin(el),Math.cos(az)*Math.cos(el)).multiplyScalar(dist));return flyTo(target,pos,1300)}
function focusTown(t,ms,quiet){sel.value=t.n;if(!quiet&&window.GAME&&GAME.onTownFocus)GAME.onTownFocus(t.n);const c=tc(t);const d=Math.max(60,t.R*2.6);const az=ctr.getAzimuthalAngle();return flyTo(new T.Vector3(c.x,0,c.z),new T.Vector3(c.x+Math.sin(az)*d*.62,d*.72,c.z+Math.cos(az)*d*.62),ms||1500)}
function overview(ms){const b=regionBox();const c=new T.Vector3((b[0]+b[2])/2,0,(b[1]+b[3])/2);const d=Math.max(b[2]-b[0],b[3]-b[1])*.78;return flyTo(c,new T.Vector3(c.x+d*.18,d*.82,c.z+d*.62),ms||1800)}
function regionBox(){let a=1e9,b=1e9,c=-1e9,d=-1e9;TOWNS.forEach(t=>{const p=tc(t);a=Math.min(a,p.x);c=Math.max(c,p.x);b=Math.min(b,p.z);d=Math.max(d,p.z)});return[a,b,c,d]}

/* ---------- katalog ---------- */
let catDone=false;
let thumbs=null;
function catalogThumbs(){if(thumbs)return thumbs;const rr=new T.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});rr.setSize(320,240);rr.setPixelRatio(1);const sc=new T.Scene();sc.add(new T.HemisphereLight("#e6f2ff","#7a8a5a",.7));const dl=new T.DirectionalLight("#ffe6c4",.9);dl.position.set(-4,8,6);sc.add(dl);
 const cm=new T.PerspectiveCamera(30,4/3,.1,400);const base=new T.Mesh(new T.CircleGeometry(5.2,40).rotateX(-Math.PI/2),new T.MeshLambertMaterial({color:"#9ccb6a"}));sc.add(base);const aim=f=>{const d=Math.max(7.5,f*3.3);cm.position.set(d*.68,d*.66,d);cm.lookAt(0,Math.max(1.2,f*.2),0);base.scale.setScalar(Math.max(1,f/4))};
 thumbs=SPECIALS.CAT.map(c=>{const o=SPECIALS.build(c.id,c.example);sc.add(o);aim(c.fp||2.6);rr.render(sc,cm);const url=rr.domElement.toDataURL("image/png");sc.remove(o);const job=Object.values(JOBS).find(j=>j.b===c.id);return Object.assign({},c,{img:url,job:job?{n:job.n,e:job.e}:null})});rr.dispose();return thumbs}
function openCatalog(){$("cat").classList.add("on");if(catDone)return;catDone=true;const grid=$("catGrid");
 const rr=new T.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});rr.setSize(320,240);rr.setPixelRatio(1);const sc=new T.Scene();sc.add(new T.HemisphereLight("#e6f2ff","#7a8a5a",.7));const dl=new T.DirectionalLight("#ffe6c4",.9);dl.position.set(-4,8,6);sc.add(dl);
 const cm=new T.PerspectiveCamera(30,4/3,.1,400);const base=new T.Mesh(new T.CircleGeometry(5.2,40).rotateX(-Math.PI/2),new T.MeshLambertMaterial({color:"#9ccb6a"}));sc.add(base);const aim=f=>{const d=Math.max(7.5,f*3.3);cm.position.set(d*.68,d*.66,d);cm.lookAt(0,Math.max(1.2,f*.2),0);base.scale.setScalar(Math.max(1,f/4))};
 SPECIALS.CAT.forEach(c=>{const o=SPECIALS.build(c.id,c.example);sc.add(o);aim(c.fp||2.6);rr.render(sc,cm);const url=rr.domElement.toDataURL("image/png");sc.remove(o);
  const d=document.createElement("div");d.className="it";d.innerHTML=`<img alt="${c.name}" src="${url}"><div><span class="th">od ${c.th}</span><b>${c.emoji} ${c.name}</b><span>„${c.example}“</span></div>`;grid.appendChild(d)});rr.dispose()}

/* ---------- smyčka ---------- */
let last=performance.now();const frameCbs=[];
/* automatické snížení kvality, když se to seká (slabší telefony) */
const PERF={acc:0,n:0,lvl:0,t0:performance.now()};
function perfTick(dt,now){if(aspectLock||PERF.lvl>=3||QS.get("perf")==="0")return;PERF.acc+=dt;PERF.n++;if(now-PERF.t0<2500)return;const ms=PERF.acc/PERF.n*1000;PERF.acc=0;PERF.n=0;PERF.t0=now;
 if(ms>38){PERF.lvl++;if(PERF.lvl===1){R.setPixelRatio(1);R.setSize(innerWidth,innerHeight);POST.resize()}else if(PERF.lvl===2){POST.on=false}else{sun.shadow.mapSize.set(1024,1024);sun.shadow.map&&sun.shadow.map.dispose();sun.shadow.map=null;forestShadow=false;FOREST.forEach(m=>m.castShadow=false)}}}
function loop(now){requestAnimationFrame(loop);const rawDt=(now-last)/1000;const dt=Math.min(.05,rawDt);last=now;if(ready)perfTick(rawDt,now);
 if(animS){const a=Math.min(1,(now-animS.t0)/1600),e=a<.5?2*a*a:1-Math.pow(-2*a+2,2)/2;const prev=S;S=animS.from+(animS.to-animS.from)*e;const f=S/prev;ctr.target.x*=f;ctr.target.z*=f;cam.position.x*=f;cam.position.z*=f;
  if(fly){fly.from.x*=f;fly.from.z*=f;fly.to.x*=f;fly.to.z*=f;fly.cf.x*=f;fly.cf.z*=f;fly.ct.x*=f;fly.ct.z*=f}
  if(a>=1){animS=null;relayout(true)}else relayout(false)}
 if(born.size){placeHouses(now);TOWNS.forEach(t=>(t.specialObjs||[]).forEach(o=>{if(o.userData.grow){const a=(now-o.userData.grow)/700;const k=a<0?.01:a<1?(a<.7?a/.7*1.1:1.1-(a-.7)/.3*.1):1;o.scale.setScalar(Math.max(.01,k));if(a>=1){o.userData.grow=0;born.delete(o.userData.ref.t.n+"#"+o.userData.ref.idx)}}}))}
 if(fly){const a=Math.min(1,(now-fly.t0)/fly.ms),e=a<.5?4*a*a*a:1-Math.pow(-2*a+2,3)/2;ctr.target.lerpVectors(fly.from,fly.to,e);cam.position.lerpVectors(fly.cf,fly.ct,e);if(a>=1){const ok=fly.ok;fly=null;ok&&ok()}}
 if(orbitSpeed){const off=cam.position.clone().sub(ctr.target);off.applyAxisAngle(UP,orbitSpeed*dt);cam.position.copy(ctr.target).add(off)}
 if(!fly)keyMove(dt);ctr.update();moveCars(dt);
 const dist=cam.position.distanceTo(ctr.target);updClouds(now,dist);cam.near=Math.max(.8,dist*.02);cam.far=Math.max(3000,dist*12);cam.updateProjectionMatrix();
 {const fs=PERF.lvl<3&&dist<420*S/0.09;if(fs!==forestShadow){forestShadow=fs;FOREST.forEach(m=>m.castShadow=fs)}}scene.fog.near=dist*.9;scene.fog.far=dist*3.2+200;
 const sh=Math.min(Math.max(dist*.9,60),700);const sc=sun.shadow.camera;if(Math.abs(sc.right-sh)>2){sc.left=-sh;sc.right=sh;sc.top=sh;sc.bottom=-sh;sc.near=1;sc.far=sh*4;sc.updateProjectionMatrix()}
 sun.position.copy(ctr.target).addScaledVector(SUNDIR,sh*1.8);sun.target.position.copy(ctr.target);
 if(ring.visible){const k=1+.08*Math.sin(now/180);ring.scale.set(k,1,k)}
 const v=new T.Vector3();TOWNS.forEach((t,i)=>{if(t.erb){const lh=t.lm.type==="pomnik"?9:t.lm.type==="kaple"?13:17;t.erb.position.set(t.lm.x,lh+Math.sin(now/800+i)*.5,t.lm.z);const s=Math.min(14,Math.max(6,dist*.035))*Math.min(1,.45+cam.aspect*.4);t.erb.scale.set(s*.84,s,1)}
  if(t.fog)t.fog.children.forEach((s,k)=>{s.position.y+=Math.sin(now/1500+s.userData.ph)*.004;s.material.rotation=Math.sin(now/3000+k)*.2});
  const c=tc(t);v.set(c.x+t.lm.x,(t.erb?(t.lm.type==="pomnik"?9:17)+8:10),c.z+t.lm.z).project(cam);const vis=v.z<1&&Math.abs(v.x)<1.05&&Math.abs(v.y)<1.05;
  const far=cam.position.distanceTo(c);const show=vis&&(t.open?far<2600*S/0.09:far<900*S/0.09);t.lbl.style.display=show?"":"none";if(show){t.lbl.style.left=(v.x*.5+.5)*innerWidth+"px";t.lbl.style.top=(-v.y*.5+.5)*innerHeight+"px";t.lbl.style.fontSize=(t.open?13:11)+"px"}});
 SIGNS.forEach(s=>s.g&&s.g.lookAt(cam.position.x,s.g.position.y,cam.position.z));updCenterMarks(now);if(window.NAMESTI)NAMESTI.update(now);
 TOWNS.forEach(t=>(t.specialObjs||[]).forEach(o=>{o.getWorldPosition(v);const d=cam.position.distanceTo(v);let l=o.userData.lbl;const show=d<95;if(!show){if(l)l.style.display="none";return}
  if(!l){const it=t.items[o.userData.ref.idx];const c=SPECIALS.CAT.find(x=>x.id===it.id);l=document.createElement("div");l.className="slbl";l.innerHTML=`<span>${c.emoji}</span>${String(it.text).replace(/</g,"&lt;")}`;l.onclick=()=>selectItem(t,o.userData.ref.idx);document.body.appendChild(l);o.userData.lbl=l}
  v.y+=5.2;v.project(cam);const vis=v.z<1&&Math.abs(v.x)<1&&Math.abs(v.y)<1;l.style.display=vis?"":"none";if(vis){l.style.left=(v.x*.5+.5)*innerWidth+"px";l.style.top=(-v.y*.5+.5)*innerHeight+"px";l.style.opacity=Math.min(1,(95-d)/25)}}));
 document.querySelector("#compass .n").style.transform=`rotate(${-ctr.getAzimuthalAngle()}rad)`;
 POST.render(Math.max(.35,Math.min(1,(700*S/0.09-dist)/(500*S/0.09))));if(crownObj){crownObj.rotation.y=now*.0009;crownObj.position.y=crownObj.userData.y+Math.sin(now*.0022)*.45}frameCbs.forEach(f=>f(now))}
addEventListener("resize",()=>{if(aspectLock)return;cam.aspect=innerWidth/innerHeight;cam.updateProjectionMatrix();R.setSize(innerWidth,innerHeight);POST.resize()});
let orbitSpeed=0,aspectLock=false;

/* ---------- API pro generátor reelů ---------- */
window.GAME={canvas,THREE:T,
 state:()=>({day:DAY,totalPlayers:POP,towns:TOWNS.map(t=>{const c=tc(t);return{name:t.n,players:t.players.length,abandoned:abandonedN(t),revive:CONFIG.REVIVE,open:!!t.open,tier:tierOf(t.players.length),erbUrl:t.erbUrl||null,erbSvg:(()=>{const d=ERB.E.find(e=>e[0]===t.n);return d?ERB.erb(d,tierOf(t.players.length)):''})(),center:{x:c.x,y:0,z:c.z},lm:{x:c.x+t.lm.x,y:0,z:c.z+t.lm.z,r:t.lm.r},radius:t.R,
  houses:t.items.map((it,i)=>{const s=t.slots[i];return s&&it.k==="h"?{id:t.n+"#"+i,owner:it.p.nick,no:it.p.no,x:c.x+s.x,y:0,z:c.z+s.z}:null}).filter(Boolean)}})}),
 setAspect:(w,h)=>{aspectLock=!!w;if(w){const k=Math.min(1,+QS.get("render")||1);R.setPixelRatio(1);R.setSize(Math.round(w*k),Math.round(h*k),false);cam.aspect=w/h}else{R.setPixelRatio(Math.min(devicePixelRatio,2));R.setSize(innerWidth,innerHeight);cam.aspect=innerWidth/innerHeight}cam.updateProjectionMatrix();POST.resize()},
 flyTo:(o,ms)=>flyTo(new T.Vector3(o.target.x,o.target.y,o.target.z),new T.Vector3(o.pos.x,o.pos.y,o.pos.z),ms),
 focusTown:(n,ms,quiet)=>focusTown(byName[n],ms,quiet),
 focusHouse:(id,ms)=>{const [n,i]=id.split("#");const t=byName[n];const s=t.slots[+i];return s?flyToLocal(t,s,22):Promise.resolve()},
 overview:ms=>overview(ms),orbit:s=>{orbitSpeed=s||0},
 // pro videa: kamera smí níž a blíž (záběry z ulice); slot = místo i-tého domku obce ve světě
 stat:()=>({nazev:STAT.nazev,svg:STAT.svg}),specialPos:n=>{const t=byName[n];if(!t)return null;for(let i=t.items.length-1;i>=0;i--)if(t.items[i].k==="s"&&t.slots[i]){const c=tc(t),q=t.slots[i];return{x:c.x+q.x,y:0,z:c.z+q.z,r:q.big||6}}return null},camFree:on=>{ctr.maxPolarAngle=on?1.5:1.32;ctr.minDistance=on?4:14},slot:(n,i)=>{const t=byName[n];if(!t)return null;const c=tc(t);const q=t.slots[i]||itemPos(t,i)||t.lm;return{x:c.x+q.x,y:0,z:c.z+q.z}},
 addPlayers:(n,list,quiet)=>{const t=byName[n];if(t){addPlayers(t,(list&&list.length)||1);if(quiet){born.clear();placeHouses(performance.now())}}},
 links:()=>[...LINKS].map(k=>k.split('|')),linkSegs:()=>LINKSEG,buildSpecial:n=>buildSpecial(byName[n]),dbgItems:n=>byName[n].items.map((it,i)=>({k:it.k,id:it.id,pos:it.pos||null,slot:!!byName[n].slots[i]})),buildSpecialId:(n,id,text)=>{const t=byName[n];if(!t)return;const idx=addItem(t,{k:"s",id,text:text||id,author:"admin",day:DAY});born.set(t.n+"#"+idx,performance.now());refreshAll([t]);const s=itemPos(t,idx);if(s)flyToLocal(t,s,30)},
 dbg:n=>{const t=byName[n];return {lm:[t.lm.x|0,t.lm.z|0,t.lm.type],R:t.R|0,pat:t.plan.pat,blocks:t.usedB.length,Rb:t.Rb|0,cuts:(t.cutsOk||[]).length,slots:t.slots.slice(0,Math.min(t.items.length,t.slots.length)).map(s=>Math.round(Math.hypot(s.x,s.z))).join(",")}},select:(n,idx)=>selectItem(byName[n],idx),closeInfo:()=>closeInfo(),
 find:q=>{q=String(q||"").toLowerCase().replace(/^@/,"").trim();if(!q)return [];const out=[];TOWNS.forEach(t=>t.items.forEach((it,i)=>{if(it.k==="h"&&t.slots[i]){const p=it.p;const nk=p.nick.toLowerCase().slice(1);if(nk.includes(q)||String(p.no)===q.replace(/^#|^0+/,""))out.push({town:t.n,idx:i,nick:CONFIG.SHOW_NICKS?p.nick:"Obyvatel č. "+String(p.no).padStart(4,"0"),no:p.no,open:t.open})}}));return out.slice(0,8)},
 townInfo:n=>{const t=byName[n];const _ab=abandonedN(t);const nx=SPECIALS.CAT.find(c=>c.th>t.players.length);return{name:t.n,players:t.players.length,abandoned:_ab,revive:CONFIG.REVIVE,full:false,linked:[...LINKS].filter(k=>k.split('|').includes(t.n)).map(k=>k.split('|').find(x=>x!==t.n)),crown:t===crownT,weekGain:weekGain(t),open:!!t.open,tier:tierOf(t.players.length),erbUrl:t.erbUrl,landmark:t.lm.name,specials:t.items.filter(x=>x.k==="s").map(x=>({text:x.text,id:x.id,author:CONFIG.SHOW_NICKS?x.author:null})),next:nx?{name:nx.name,th:nx.th,emoji:nx.emoji}:null,jobs:Object.entries(jobCounts(t)).sort((a,b)=>b[1]-a[1]).slice(0,4).map(([j,n])=>({n:JOBS[j].n,e:JOBS[j].e,c:n,need:CONFIG.JOB_N,built:t.items.some(x=>x.k==="s"&&(x.job===j||x.id===JOBS[j].b)),b:SPECIALS.CAT.find(c=>c.id===JOBS[j].b).name})),founders:t.players.slice(0,5).map(p=>CONFIG.SHOW_NICKS?p.nick:"#"+String(p.no).padStart(4,"0"))}},
 ranking:()=>TOWNS.map(t=>({name:t.n,crown:t===crownT,players:t.players.length,open:t.players.length>=CONFIG.REVIVE,tier:tierOf(t.players.length),erbUrl:t.erbUrl,week:t.players.filter(p=>p.day>DAY-7).length})).sort((a,b)=>b.players-a.players),
 jobs:()=>Object.entries(JOBS).map(([k,v])=>({k,n:v.n,e:v.e,b:SPECIALS.CAT.find(c=>c.id===v.b).name})),jobN:()=>CONFIG.JOB_N,openAt:()=>CONFIG.OPEN_AT,history:()=>{const days=[];for(let d=1;d<=DAY;d++)days.push(d);const tot=days.map(d=>ALLP.filter(p=>p.day<=d).length);const towns={};TOWNS.forEach(t=>{if(t.players.length)towns[t.n]=days.map(d=>t.players.filter(p=>p.day<=d).length)});return{days,total:tot,towns}},
 dayLog:d=>{const np=ALLP.filter(p=>p.day===d);const byT={};np.forEach(p=>byT[p.town]=(byT[p.town]||0)+1);const top=Object.entries(byT).sort((a,b)=>b[1]-a[1]).slice(0,3);
  const built=TOWNS.flatMap(t=>t.items.filter(x=>x.k==="s"&&x.day===d).map(x=>({town:t.n,text:x.text,job:x.job?JOBS[x.job].n:null,emoji:SPECIALS.CAT.find(c=>c.id===x.id).emoji})));
  const firsts=TOWNS.filter(t=>t.players.length&&t.players[0].day===d).map(t=>t.n);const revived=TOWNS.filter(t=>t.players.length>=CONFIG.REVIVE&&t.players[CONFIG.REVIVE-1].day===d).map(t=>t.n);
  return{day:d,count:np.length,total:ALLP.filter(p=>p.day<=d).length,top,built,firsts,revived}},
 catalogThumbs:()=>catalogThumbs(),revive:()=>CONFIG.REVIVE,crown:()=>crownT?{name:crownT.n,week:weekGain(crownT),players:crownT.players.length}:null,center:()=>{F(CENTER.x,CENTER.y,tmp2);return{x:tmp2[0],z:tmp2[1],name:CENTER.name}},focusCenter:(ms)=>{F(CENTER.x,CENTER.y,tmp2);return flyTo(new T.Vector3(tmp2[0],3,tmp2[1]+2),new T.Vector3(tmp2[0]+34,44,tmp2[1]+66),ms||1400)},
 info:()=>({day:DAY,pop:POP,open:TOWNS.filter(t=>t.open).length,total:TOWNS.length}),reload:()=>pollWorld(),get S(){return S},pairs:()=>{const o=[];for(let i=0;i<TOWNS.length;i++)for(let j=i+1;j<TOWNS.length;j++){const a=TOWNS[i],b=TOWNS[j];const d=Math.hypot(a.x-b.x,a.y-b.y);o.push([((SPREAD*(a.R+b.R)+GAP)/d).toFixed(4),a.n,b.n,Math.round(d),a.R.toFixed(0),b.R.toFixed(0)])}return o.sort((x,y)=>y[0]-x[0]).slice(0,6)},onFrame:cb=>frameCbs.push(cb),towns:()=>TOWNS.map(t=>t.n),
 dayData:()=>{const np=ALLP.filter(p=>p.day===DAY).map(p=>{const t=byName[p.town];const idx=t?t.items.findIndex(it=>it.k==="h"&&it.p===p):-1;return{town:p.town,owner:p.nick.slice(1),no:p.no,id:idx>=0?p.town+"#"+idx:null}});
  const sp=TOWNS.flatMap(t=>t.items.filter(x=>x.k==="s"&&x.day===DAY&&!x.job).map(x=>({town:t.n,name:x.text,type:x.id})));
  const jb=TOWNS.flatMap(t=>t.items.filter(x=>x.k==="s"&&x.day===DAY&&x.job).map(x=>({town:t.n,job:JOBS[x.job].n,emoji:JOBS[x.job].e,building:SPECIALS.CAT.find(c=>c.id===x.id).name,name:x.text})));
  const jobs=TOWNS.flatMap(t=>Object.entries(jobCounts(t)).filter(([j,n])=>n<CONFIG.JOB_N&&n>=CONFIG.JOB_N-2&&!t.items.some(x=>x.k==="s"&&(x.job===j||x.id===JOBS[j].b))).map(([j,n])=>({town:t.n,job:JOBS[j].n,emoji:JOBS[j].e,count:n,need:CONFIG.JOB_N,building:SPECIALS.CAT.find(c=>c.id===JOBS[j].b).name}))).sort((a,b)=>(b.count/b.need)-(a.count/a.need)).slice(0,2);
  const ms=[100,250,500,1000,1500,2000,2026,3000].map(m=>ALLP.find(p=>p.no===m&&p.day===DAY)).filter(Boolean).map(p=>({no:p.no,owner:p.nick.slice(1),town:p.town}))[0]||null;
  const nt=TOWNS.filter(t=>t.players.length&&t.players[0].day===DAY).map(t=>t.n);
  const auth=(ALLP[ALLP.length-1]||{nick:"@hrac_0001"}).nick;
  return{day:DAY,date:new Date().toISOString().slice(0,10),crown:crownT?{name:crownT.n,week:weekGain(crownT),prev:(crownAt(DAY-1)||{}).n||null,changed:(crownAt(DAY-1)||{}).n!==crownT.n}:null,newPlayers:np,topComment:sp[0]?{author:auth,text:"Postavte "+sp[0].name+"!",likes:87}:{author:auth,text:"Chceme v obci hospodu U Zlatého Radaru 🍺",likes:64},newBuilding:sp[0]||null,expanded:false,
   jobs,jobBuilt:jb[0]||null,milestone:ms,newTowns:nt,links:[...LINKS].map(k=>k.split('|')),fullTowns:[],findMe:np.slice(0,12).map(p=>p.owner)}}};

/* ---------- start ---------- */
(async()=>{try{setMsg("načítám 3D modely…");await loadModels()}catch(e){setMsg("Nepodařilo se načíst modely");throw e}
 setMsg("plánuji 52 obcí podle skutečných silnic…");await new Promise(r=>setTimeout(r,20));
 TOWNS.forEach(planTown);initInstanced();
 setMsg("načítám herní data…");let real=CONFIG.DEMO?null:await fetchWorld();
 applyStat(QS.get("stat")?{nazev:QS.get("stat"),vlajka:{pruhy:["#2F4AA8","#C6FF3D"],symbol:"⭐"}}:real&&real.stat);
 if(real){WORLD_REV=real.revize;applyEvents(worldEvents(real),false);DAY=real.den_hry||DAY}else{seedDemo();document.getElementById("demoTag").style.display=""}if(+QS.get("den")>0)DAY=+QS.get("den");
 TOWNS.forEach(t=>{t.open=t.players.length>=CONFIG.OPEN_AT;layoutTown(t);t.R=townRadius(t)});
 S=Starget=S0=+QS.get("s")||L;updTownParams();// celá mapa v měřítku domků: nic se nenafukuje (?s=0.05 = staré rybí oko)
 setMsg("krajina, lesy a pole…");await new Promise(r=>setTimeout(r,20));
 buildLandSource();TOWNS.forEach(buildTown);TOWNS.forEach(t=>{setFog(t);setErb(t)});relayout(true);initCars();updateUI();
 const t0=byName["Říčany"];const c=tc(t0);ctr.target.set(c.x,0,c.z);cam.position.set(c.x+260,300,c.z+420);
 $("load").remove();if(window.NAMESTI){F(CENTER.x,CENTER.y,tmp2);NAMESTI.build({scene,x:tmp2[0],z:tmp2[1],scale:CENTER.scale,cathedralScale:1.5,towns:TOWNS.map(t=>t.n),signTex:townSignTex(CENTER.name)});TOWNS.forEach(t=>{t.erbKey=null;setErb(t)});buildRoads()}buildCenterMarks();updCrown();updateUI();ready=true;requestAnimationFrame(loop);window.done=1;
 setTimeout(()=>focusTown(t0,2600,true),300);if(real)setInterval(pollWorld,CONFIG.POLL_MS)})();
})();
