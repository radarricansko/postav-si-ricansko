/* Postav si Říčansko – rozhraní pro hráče (bez admin nástrojů). Admin: ?admin=fofrburg96 */
(function(){
"use strict";
const QS=new URLSearchParams(location.search);const ADMIN=QS.get("admin")==="fofrburg96";
const $=id=>document.getElementById(id);
document.body.classList.add(ADMIN?"admin":"player");
if(ADMIN)return;
const IG="https://www.instagram.com/radar_ricansko/";
const START=new Date(2026,10,16);// den 1 = po 16. 11. 2026
const dayDate=d=>{const x=new Date(START);x.setDate(x.getDate()+d-1);return x.toLocaleDateString("cs-CZ",{weekday:"short",day:"numeric",month:"numeric"})};
const TIERN={wood:"Dřevěná liga",silver:"Stříbrná liga",gold:"Zlatá liga",plat:"Platinová liga"};
const TIERC={wood:"#a8723e",silver:"#8d97a8",gold:"#d99a00",plat:"#3fb4e6"};
const nextTier=n=>n<20?{to:20,lab:"do stříbrné ligy"}:n<50?{to:50,lab:"do zlaté ligy"}:n<100?{to:100,lab:"do platinové ligy"}:null;
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const plural=(n,a,b,c)=>n===1?a:n>=2&&n<=4?b:c;
/* příběh po dnech (scénář), doplněný o automatické hlášení z dat */
const STORY={
 1:{t:"Říčansko se sjednocuje",x:"Pan Radar vyhlásil sjednocení. Uprostřed regionu vzniklo Náměstí sjednocení se sochou 52 mečů a 52 erby. Všechny jsou zatím šedé: 52 obcí, všechny opuštěné. Každý nový obyvatel opraví jeden dům, při 5 lidech obec ožije a její erb na soše se rozsvítí.",ph:"Fáze 1 · Probuzení"},
 2:{t:"Praha má metro. My?",x:"Napiš do komentářů, co má Praha a sjednocené město ještě ne. Nejlajkovanější přání se postaví u náměstí, až na něj bude dost lidí."},
 3:{t:"První povolání",x:"K obci můžeš napsat i povolání. Když se sejde 5 hasičů, postaví si hasičárnu. 5 skejťáků skatepark."},
 5:{t:"Koruna týdne",x:"Nad obcí s největším přírůstkem za 7 dní se objevila zlatá koruna. Je putovní: kdo roste rychleji, ten ji vezme."},
 8:{t:"Rozmach",x:"Odemykají se ligy erbů a povolanské budovy. Kdo bude první stříbrná obec? A které přání proti Praze se splní jako první?",ph:"Fáze 2 · Rozmach"},
 15:{t:"Svazky obcí",x:"Sousední obce se můžou spojit do svazku (max. 3) a postavit společnou stavbu.",ph:"Fáze 3 · Svazky a Mikuláš"},
 17:{t:"Výpadek radaru",x:"Pan Radar na pár sekund ztratil signál. Co se mezitím na mapě objevilo?"},
 20:{t:"Mikuláš",x:"Anděl nadělil nejaktivnější obci, čert nasypal uhlí obci, která tři dny nevyrostla."},
 22:{t:"Zima",x:"Na Říčansko napadl sníh a na okraji mapy se objevila tajemná budova.",ph:"Fáze 4 · Zima"},
 29:{t:"Vánoční trh",x:"Každá obydlená obec dostane stánek na Náměstí sjednocení. Název vybere top komentář.",ph:"Fáze 5 · Vánoční trh"},
 36:{t:"Finále",x:"Poslední týden. Cíl: rozsvítit všech 52 erbů na soše.",ph:"Fáze 6 · Finále"},
 39:{t:"Rozsvícení",x:"Socha svítí celá. Pan Radar končí hlášení."}
};
const TABN={rank:"Obce",story:"Příběh",build:"Stavby",stats:"Čísla",info:"Jak hrát"};
const TABI={rank:"🏆",story:"📅",build:"🏗️",stats:"📈",info:"❓"};
const TABS=["rank","story","build","stats","info"];

const root=document.createElement("div");root.id="pui";root.innerHTML=`
<div id="pTop" class="glass">
 <div class="pTitle"><h1>Postav si <span>Říčansko</span></h1><span id="pSub" class="pDay">Den 1</span><button id="pSearchBtn" class="ico" aria-label="Hledat">🔍</button></div>
 <div class="pStats">
  <span class="chip"><b id="kPop">0</b>obyvatel</span>
  <span class="chip"><b id="kAlive">0<i id="kTot"></i></b>oživených obcí</span>
  <button id="pCrown" class="chip crown" hidden></button>
  <button id="pCenter" class="chip center" title="Náměstí sjednocení">⛪ Náměstí</button>
  <div class="pSearch"><input id="pQ" type="search" placeholder="Najdi svůj domek…" autocomplete="off" spellcheck="false"><div id="pRes"></div></div>
 </div>
</div>
<div id="pSide" class="glass">
 <div class="pBrand"><span class="logo">RADAR</span><span class="tag">#postavsiricansko</span><button id="pSideX" class="x" aria-label="Zavřít">×</button></div>
 <div class="pTabs">${TABS.map(t=>`<button data-t="${t}"${t==="rank"?' class="on"':""}><i>${TABI[t]}</i>${TABN[t]}</button>`).join("")}</div>
 ${TABS.map(t=>`<div id="pane-${t}" class="pPane"${t==="rank"?"":" hidden"}></div>`).join("")}
</div>
<div id="pTown" class="glass" hidden></div>
<a id="pCta" href="${IG}" target="_blank" rel="noopener"><span class="dot"></span><span class="long"><b>Chceš domek?</b> Sleduj @radar_ricansko a napiš obec do komentářů</span><span class="short"><b>Chceš domek?</b> Napiš svou obec na IG</span><span class="arr">→</span></a>
<nav id="pNav">${TABS.map(t=>`<button data-s="${t}"><i>${TABI[t]}</i><span>${TABN[t]}</span></button>`).join("")}</nav>`;
document.body.appendChild(root);

/* ---------- záložky ---------- */
let curTab="rank";
root.querySelectorAll(".pTabs button").forEach(b=>b.onclick=()=>tab(b.dataset.t));
function tab(t){curTab=t;root.querySelectorAll(".pTabs button").forEach(x=>x.classList.toggle("on",x.dataset.t===t));TABS.forEach(k=>$("pane-"+k).hidden=k!==t);render(t)}
root.querySelectorAll("#pNav button").forEach(b=>b.onclick=()=>{const s=b.dataset.s;const open=$("pSide").classList.contains("sheet")&&curTab===s;closeSheets();if(open)return;tab(s);$("pSide").classList.add("sheet");root.querySelectorAll("#pNav button").forEach(x=>x.classList.toggle("on",x===b))});
$("pSideX").onclick=()=>closeSheets();
$("pCenter").onclick=()=>{closeSheets();if(GAME.focusCenter)GAME.focusCenter()};
$("pSearchBtn").onclick=()=>{const o=$("pTop").classList.toggle("open");if(o){closeSheets(true);$("pQ").focus()}};
function closeSheets(keepSearch){$("pSide").classList.remove("sheet");if(!keepSearch)$("pTop").classList.remove("open");root.querySelectorAll("#pNav button").forEach(x=>x.classList.remove("on"))}

function erbImg(u,cls){return u?`<img class="${cls||"erb"}" src="${u}" alt="">`:`<span class="${cls||"erb"} ph"></span>`}
function render(t){if(t==="rank")renderRank();else if(t==="story")renderStory();else if(t==="build")renderBuild();else if(t==="stats")renderStats();else renderInfo()}

/* ---------- obce ---------- */
function renderRank(){const r=GAME.ranking();const rv=GAME.revive();$("pane-rank").innerHTML=`<div class="paneHead"><b>Žebříček obcí</b><small>podle počtu obyvatel · zeleně přírůstek za 7 dní</small></div>`+r.map((t,i)=>{
 const alive=t.players>=rv;const nt=alive?nextTier(t.players):{to:rv,lab:"do oživení"};const pct=nt?Math.min(100,t.players/nt.to*100):100;
 return`<button class="rk${alive?"":" dead"}${t.crown?" crowned":""}" data-n="${esc(t.name)}"><span class="pos">${i+1}</span>${erbImg(t.erbUrl)}<span class="nm"><b>${t.crown?"👑 ":""}${esc(t.name)}</b>
 <span class="bar"><i style="width:${pct}%;background:${alive?TIERC[t.tier]:"#b8a990"}"></i></span><small>${alive?(nt?`${t.players} obyvatel · ${nt.to-t.players} ${nt.lab}`:`${t.players} obyvatel · platinová liga`):(t.players?`🏚️ opuštěná · ${t.players}/${rv} obyvatel`:`🏚️ opuštěná · buď první`)}</small></span>${t.week?`<span class="wk">+${t.week}</span>`:""}</button>`}).join("");
 $("pane-rank").querySelectorAll(".rk").forEach(b=>b.onclick=()=>{closeSheets();GAME.focusTown(b.dataset.n)})}

/* ---------- příběh po dnech ---------- */
function storyFacts(d,latest){const L=GAME.dayLog(d);const f=[];
 if(latest){let dd=null;try{dd=GAME.dayData&&GAME.dayData()}catch(e){}
  if(dd&&dd.topComment&&dd.topComment.text)f.push(`<li><i>💬</i><span>Lidi si přáli: <b>„${esc(dd.topComment.text)}“</b></span></li>`);
  const cr=GAME.crown();if(cr)f.push(`<li><i>👑</i><span>Koruna týdne: <b>${esc(cr.name)}</b></span></li>`)}
 L.revived.forEach(n=>f.push(`<li><i>🏡</i><span><b>${esc(n)}</b> ožila</span></li>`));
 L.built.forEach(b=>f.push(`<li><i>${b.emoji}</i><span><b>${esc(b.town)}</b> postavila ${esc(b.text)}${b.job?` <small>(${esc(b.job)})</small>`:""}</span></li>`));
 return f}
function storyDay(d,latest){const s=STORY[d];const facts=storyFacts(d,latest);
 return`<div class="day${latest?" today":""}"><div class="dn"><b>Den ${d}</b><small>${dayDate(d)}</small></div><div class="dc">${s&&s.ph?`<span class="ph">${s.ph}</span>`:""}${s?`<h4>${esc(s.t)}</h4><p>${esc(s.x)}</p>`:""}${facts.length?`<ul>${facts.join("")}</ul>`:(s?"":`<p class="q">Klidný den na radaru.</p>`)}</div></div>`}
function renderStory(){const d0=GAME.info().day;let h=`<div class="paneHead"><b>Příběh Říčanska</b><small>co se dnes stalo na mapě</small></div><div class="tl">${storyDay(d0,true)}</div>`;
 if(d0>1){h+=`<details class="old"><summary><span>Starší dny</span><em>${d0-1}</em></summary><div class="tl">`;for(let d=d0-1;d>=1;d--)h+=storyDay(d,false);h+=`</div></details>`}
 h+=`<p class="next">Co bude dál? Sleduj reely na <a href="${IG}" target="_blank" rel="noopener">@radar_ricansko</a>.</p>`;$("pane-story").innerHTML=h}

/* ---------- katalog staveb ---------- */
let buildDone=false;
function renderBuild(){if(buildDone)return;const el=$("pane-build");el.innerHTML=`<div class="paneHead"><b>Katalog staveb</b><small>Odemykají se počtem obyvatel obce. Co se postaví, vybírá nejlajkovanější komentář a stavba dostane ceduli s názvem.</small></div><div class="loading">Připravuji náhledy…</div>`;
 setTimeout(()=>{const th=GAME.catalogThumbs();el.innerHTML=el.querySelector(".paneHead").outerHTML+`<div class="cgrid">`+th.map(c=>`<div class="cit"><img src="${c.img}" alt=""><div><b>${c.emoji} ${esc(c.name)}</b><span class="th">od ${c.th} ${plural(c.th,"obyvatele","obyvatel","obyvatel")}</span>${c.job?`<span class="jb2">nebo ${GAME.jobN()}× ${c.job.e} ${esc(c.job.n.toLowerCase())}</span>`:""}<small>„${esc(c.example)}“</small></div></div>`).join("")+`</div>`;buildDone=true},30)}

/* ---------- čísla ---------- */
function renderStats(){const H=GAME.history();const r=GAME.ranking();const i=GAME.info();const rv=GAME.revive();
 const top=r.slice(0,5).map(t=>t.name);const week=r.slice().sort((a,b)=>b.week-a.week)[0];
 const jobs={};GAME.ranking().forEach(t=>{const ti=GAME.townInfo(t.name);(ti.jobs||[]).forEach(j=>jobs[j.n]=(jobs[j.n]||0)+j.c)});const topJob=Object.entries(jobs).sort((a,b)=>b[1]-a[1])[0];
 $("pane-stats").innerHTML=`<div class="paneHead"><b>Čísla Říčanska</b><small>vývoj od dne 1</small></div>
 <div class="kpi2"><div><b>${i.pop}</b><span>obyvatel</span></div><div><b>${r.filter(t=>t.players>=rv).length}/${i.total}</b><span>ožilých obcí</span></div>
 <div><b>${week&&week.week?esc(week.name):"–"}</b><span>nejrychlejší tento týden${week&&week.week?` (+${week.week})`:""}</span></div><div><b>${topJob?esc(topJob[0]):"–"}</b><span>nejčastější povolání</span></div></div>
 <h5>Obyvatelé celkem</h5><canvas id="chTot" height="150"></canvas><h5>Top 5 obcí</h5><canvas id="chTop" height="170"></canvas><div class="legend" id="chLeg"></div>`;
 const COLS=["#2F4AA8","#e0572b","#2fa35a","#d99a00","#7c3aed"];
 drawChart($("chTot"),H.days,[{v:H.total,c:"#2F4AA8",fill:true}]);
 drawChart($("chTop"),H.days,top.map((n,k)=>({v:H.towns[n]||H.days.map(()=>0),c:COLS[k]})));
 $("chLeg").innerHTML=top.map((n,k)=>`<span><i style="background:${COLS[k]}"></i>${esc(n)}</span>`).join("")}
function drawChart(cv,days,series){const dpr=Math.min(2,devicePixelRatio||1);const w=cv.clientWidth||300,h=+cv.getAttribute("height");cv.width=w*dpr;cv.height=h*dpr;cv.style.height=h+"px";const g=cv.getContext("2d");g.scale(dpr,dpr);
 const max=Math.max(1,...series.flatMap(s=>s.v));const pl=34,pr=8,pt=8,pb=20;const X=i=>pl+(w-pl-pr)*(days.length<2?0:i/(days.length-1)),Y=v=>pt+(h-pt-pb)*(1-v/max);
 g.font="11px Inter,system-ui";g.fillStyle="#6b7595";g.strokeStyle="rgba(10,18,51,.1)";g.lineWidth=1;
 for(let k=0;k<=3;k++){const v=Math.round(max*k/3),y=Y(v);g.beginPath();g.moveTo(pl,y);g.lineTo(w-pr,y);g.stroke();g.textAlign="right";g.fillText(v,pl-6,y+4)}
 g.textAlign="center";const st=Math.max(1,Math.ceil(days.length/6));days.forEach((d,i)=>{if(i%st===0||i===days.length-1)g.fillText("D"+d,X(i),h-5)});
 series.forEach(s=>{g.beginPath();s.v.forEach((v,i)=>i?g.lineTo(X(i),Y(v)):g.moveTo(X(i),Y(v)));g.strokeStyle=s.c;g.lineWidth=2.2;g.lineJoin="round";g.stroke();
  if(s.fill){g.lineTo(X(s.v.length-1),Y(0));g.lineTo(X(0),Y(0));g.closePath();const gr=g.createLinearGradient(0,pt,0,h-pb);gr.addColorStop(0,s.c+"44");gr.addColorStop(1,s.c+"00");g.fillStyle=gr;g.fill()}
  const li=s.v.length-1;g.fillStyle=s.c;g.beginPath();g.arc(X(li),Y(s.v[li]),3.2,0,7);g.fill()})}

/* ---------- jak hrát ---------- */
let infoDone=false;
function renderInfo(){if(infoDone)return;infoDone=true;const rv=GAME.revive();const jn=GAME.jobN();
 const frames=["wood","silver","gold","plat"].map(t=>{const d=ERB.E.find(e=>e[0]==="Říčany");return`<div class="lg"><img src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(ERB.erb(d,t))}" alt=""><b>${TIERN[t]}</b><small>${{wood:"5–19",silver:"20–49",gold:"50–99",plat:"100+"}[t]} obyvatel</small></div>`}).join("");
 $("pane-info").innerHTML=`<div class="paneHead"><b>Jak hrát</b></div>
 <p class="lead">Říčansko se sjednocuje v jedno město a chce být lepší než Praha. Na mapě je 52 obcí, uprostřed Náměstí sjednocení se sochou 52 erbů. <b>Kdo se přidá, dostane domek se svým nickem</b> a rozsvěcí erb své obce.</p>
 <ol class="steps"><li><b>Sleduj @radar_ricansko</b><span>Hra běží na Instagramu Radaru.</span></li>
 <li><b>Napiš do komentářů svou obec</b><span>Pod herní příspěvek, klidně i s povoláním: „Mukařov hasič“.</span></li>
 <li><b>Najdi svůj domek</b><span>Do 2 hodin vyroste na mapě. Hledej podle nicku.</span></li></ol>
 <h5>🏚️ Opuštěné obce</h5><p>Pod ${rv} obyvatel je obec opuštěná: šedé domy, šedý erb. Každý nový obyvatel jeden dům opraví, při ${rv} obec <b>ožije</b>.</p>
 <h5>🛡️ Ligy obcí</h5><p>Rámeček erbu roste s počtem obyvatel.</p><div class="lgs">${frames}</div>
 <h5>👑 Koruna týdne</h5><p>Vznáší se nad obcí s <b>největším přírůstkem za 7 dní</b>. Kdo roste rychleji, ten ji vezme.</p>
 <h5>🧑‍🚒 Povolání</h5><p>${jn} lidí se stejným povoláním v jedné obci = vlastní budova.</p><div class="jobsG">${GAME.jobs().map(j=>`<span>${j.e} ${esc(j.n)} <small>→ ${esc(j.b)}</small></span>`).join("")}</div>
 <h5>🏗️ Nápad dne</h5><p>Napiš pod reel, co má obec postavit, nebo co má Praha a my ne (metro, zoo…). Nejlajkovanější nápad se postaví i s cedulí a tvým nickem.</p>
 <a class="cta" href="${IG}" target="_blank" rel="noopener">Hrát na Instagramu</a>
 <p class="fine">Nechceš být ve hře? Napiš nám DM a domek odstraníme. Hra je fikce a zábava, žádné reálné slučování obcí, bez cen. Mapa © OpenStreetMap.</p>`}

/* ---------- karta obce ---------- */
let curTown=null;
GAME.onTownFocus=n=>{curTown=n;GAME.closeInfo();renderTown()};
function renderTown(){document.body.classList.toggle("card-open",!!curTown||info.classList.contains("on"));if(!curTown)return;const t=GAME.townInfo(curTown);const rv=t.revive;const alive=t.players>=rv;const nt=nextTier(t.players);const el=$("pTown");el.hidden=false;
 const H=GAME.history();const ser=H.towns[t.name]||[];
 el.innerHTML=`<button class="x" id="pTownX" aria-label="Zavřít">×</button><div class="tHead">${erbImg(t.erbUrl,"erbL")}<div><h3>${esc(t.name)}</h3><span class="tier" style="--c:${alive?TIERC[t.tier]:"#9b8b6e"}">${alive?TIERN[t.tier]:"🏚️ Opuštěná obec"}</span></div></div>
 <div class="tStats"><div><b>${t.players}</b><span>obyvatel</span></div><div><b>${t.specials.length}</b><span>staveb</span></div><div><b>${alive?(nt?nt.to-t.players:"✓"):rv-t.players}</b><span>${alive?(nt?nt.lab:"max. liga"):"do oživení"}</span></div></div>
 ${t.crown?`<p class="note gold">👑 <b>Koruna týdne!</b> Největší přírůstek za 7 dní (+${t.weekGain}). Udrží ji do neděle?</p>`:""}
 ${alive?"":`<p class="note">🏚️ V obci stojí ${t.abandoned} ${plural(t.abandoned,"opuštěný dům","opuštěné domy","opuštěných domů")}. Každý nový obyvatel jeden opraví. Při ${rv} obyvatelích obec ožije!</p>`}
 ${t.full?`<p class="note">🏘️ Obec je nabitá k prasknutí (${t.cap} parcel) – další domky se vejdou jen po zahuštění.</p>`:""}
 ${t.linked&&t.linked.length?`<p class="note">🤝 Spojeno s: <b>${t.linked.map(esc).join(", ")}</b></p>`:""}
 ${ser.length>1&&t.players?`<canvas id="tSpark" height="54"></canvas>`:""}
 ${t.jobs&&t.jobs.length?`<div class="jobs">${t.jobs.map(j=>`<div class="job"><span>${j.e} ${esc(j.n)}</span><span class="jb"><i style="width:${Math.min(100,j.c/j.need*100)}%"></i></span><small>${j.built?"✓ "+esc(j.b):j.c+"/"+j.need+" → "+esc(j.b)}</small></div>`).join("")}</div>`:""}
 <p class="lm">📍 ${esc(t.landmark)}</p>
 ${t.specials.length?`<div class="sp">${t.specials.map(x=>`<span>🏗️ ${esc(x.text)}</span>`).join("")}</div>`:""}
 ${t.next?`<p class="nx">Další stavba se odemkne při <b>${t.next.th} obyvatelích</b> ${t.next.emoji}</p>`:""}
 ${t.founders.length?`<p class="fd"><small>Zakladatelé</small>${t.founders.map(esc).join(" · ")}</p>`:""}
 <a class="cta" href="${IG}" target="_blank" rel="noopener">Bydlím tady → napiš „${esc(t.name)}“ do komentářů</a>`;
 $("pTownX").onclick=()=>{el.hidden=true;curTown=null;renderTown()};
 const sp=$("tSpark");if(sp)drawChart(sp,H.days,[{v:ser,c:alive?TIERC[t.tier]:"#9b8b6e",fill:true}])}
const info=$("info");new MutationObserver(()=>{if(info.classList.contains("on")){$("pTown").hidden=true;curTown=null}document.body.classList.toggle("card-open",!!curTown||info.classList.contains("on"))}).observe(info,{attributes:true,attributeFilter:["class"]});

/* ---------- hledání ---------- */
const q=$("pQ"),res=$("pRes");
const fold=x=>x.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"");
q.addEventListener("input",()=>{const v=q.value.trim();if(!v){res.innerHTML="";return}
 const towns=GAME.ranking().filter(t=>fold(t.name).includes(fold(v))).slice(0,4);const ppl=GAME.find(v);
 res.innerHTML=(towns.map(t=>`<button data-k="t" data-n="${esc(t.name)}">${erbImg(t.erbUrl,"erbS")}<span><b>${esc(t.name)}</b><small>${t.players} obyvatel</small></span></button>`).join("")+
  ppl.map(p=>`<button data-k="h" data-n="${esc(p.town)}" data-i="${p.idx}"><span class="hs">🏠</span><span><b>${esc(p.nick)}</b><small>${esc(p.town)} · obyvatel č. ${String(p.no).padStart(4,"0")}</small></span></button>`).join(""))||`<div class="empty">Nic jsme nenašli. Domek se objeví do 2 hodin od komentáře.</div>`;
 res.querySelectorAll("button").forEach(b=>b.onclick=()=>{q.value="";res.innerHTML="";closeSheets();q.blur();if(b.dataset.k==="t")GAME.focusTown(b.dataset.n);else{$("pTown").hidden=true;curTown=null;GAME.select(b.dataset.n,+b.dataset.i)}})});
q.addEventListener("keydown",e=>{if(e.key==="Enter"){const b=res.querySelector("button");if(b)b.click()}if(e.key==="Escape"){q.value="";res.innerHTML="";q.blur()}});
document.addEventListener("pointerdown",e=>{if(res.innerHTML&&!e.target.closest(".pSearch"))res.innerHTML=""});

/* ---------- kompas: popisky na dial zůstávají vzpřímené (game.js otáčí #compass .n) ---------- */
(function(){const n=document.querySelector("#compass .n");const c=$("compass");if(!n||!c||!GAME.onFrame)return;let last="";
 GAME.onFrame(()=>{const tr=n.style.transform;if(tr===last)return;last=tr;const m=/rotate\((-?[\d.e+-]+)rad\)/.exec(tr);c.style.setProperty("--r",m?(-m[1])+"rad":"0rad")})})();

/* ---------- aktualizace ---------- */
function upd(){const i=GAME.info();const r=GAME.ranking();const rv=GAME.revive();$("pSub").textContent=`Den ${i.day} · ${dayDate(i.day)}`;
 $("kPop").textContent=i.pop.toLocaleString("cs-CZ");$("kAlive").firstChild.textContent=r.filter(t=>t.players>=rv).length;$("kTot").textContent="/"+i.total;
 const cr=GAME.crown();const cb=$("pCrown");cb.hidden=!cr;if(cr){cb.innerHTML=`<i>👑</i><b>${esc(cr.name)}</b><span>koruna týdne · +${cr.week}</span>`;cb.title="Koruna týdne: "+cr.name;cb.onclick=()=>{closeSheets();GAME.focusTown(cr.name)}}
 if(curTab==="rank"||curTab==="story"||curTab==="stats")render(curTab);renderTown();fitTop()}
function fitTop(){document.documentElement.style.setProperty("--topB",($("pTop").offsetTop+$("pTop").offsetHeight+12)+"px")}
new ResizeObserver(fitTop).observe($("pTop"));addEventListener("resize",fitTop);fitTop();
GAME.onUpdate=()=>{clearTimeout(upd.t);upd.t=setTimeout(upd,150)};
const wait=setInterval(()=>{if(window.done){clearInterval(wait);upd();setTimeout(upd,1500)}},200);
})();
