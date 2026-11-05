/* Postav si Říčansko – rozhraní pro hráče (bez admin nástrojů). Admin: ?admin=1 */
(function(){
"use strict";
const QS=new URLSearchParams(location.search);const ADMIN=QS.get("admin")==="1";
const $=id=>document.getElementById(id);
document.body.classList.add(ADMIN?"admin":"player");
if(ADMIN)return;
const IG="https://www.instagram.com/radar_ricansko/";
const TIERN={wood:"Dřevěná obec",silver:"Stříbrná obec",gold:"Zlatá obec",plat:"Platinová obec"};
const TIERC={wood:"#a8723e",silver:"#9aa3b1",gold:"#e2a90f",plat:"#7fd8ff"};
const nextTier=n=>n<1?{to:1,lab:"do prvního domku"}:n<20?{to:20,lab:"do stříbrné ligy"}:n<50?{to:50,lab:"do zlaté ligy"}:n<100?{to:100,lab:"do platinové ligy"}:null;
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

const root=document.createElement("div");root.id="pui";root.innerHTML=`
<div id="pTop" class="card">
 <div class="pBrand"><span class="logo">RADAR</span><div><b>Postav si Říčansko</b><small id="pSub">Den 1 · 0 obyvatel</small></div></div>
 <div class="pSearch"><input id="pQ" type="search" placeholder="Najdi svůj domek nebo obec…" autocomplete="off"><div id="pRes"></div></div>
</div>
<div id="pSide" class="card">
 <div class="pTabs"><button data-t="rank" class="on">🏆 Obce</button><button data-t="how">❓ Jak hrát</button></div>
 <div id="pRank" class="pPane"></div>
 <div id="pHow" class="pPane" hidden>
  <ol class="steps"><li><b>Sleduj @radar_ricansko</b><span>Hra běží na Instagramu Radaru.</span></li>
  <li><b>Napiš do komentářů svou obec</b><span>Pod herní příspěvek název obce z ORP Říčany, klidně i s povoláním: „Mukařov hasič“.</span></li>
  <li><b>Najdi svůj domek</b><span>Do 2 hodin vyroste na mapě s tvým číslem obyvatele.</span></li></ol>
  <div class="rules"><p>🧑‍🚒 K obci napiš i povolání (např. „Mukařov hasič“). Když se sejde <b>5 hasičů</b>, postaví si obec hasičárnu.</p><p>🏗️ Nejlajkovanější nápad dne se postaví i s cedulí a jménem autora.</p><p>🛡️ Erb obce dostane rámeček podle velikosti: dřevo, stříbro (20), zlato (50), platina (100).</p><p>🎄 Hrajeme do Štědrého dne.</p></div>
  <a class="cta" href="${IG}" target="_blank" rel="noopener">Hrát na Instagramu</a>
 </div>
</div>
<div id="pTown" class="card" hidden></div>
<a id="pCta" href="${IG}" target="_blank" rel="noopener"><span class="dot"></span><span class="long"><b>Chceš domek?</b> Sleduj @radar_ricansko a napiš obec do komentářů</span><span class="short"><b>Chceš domek?</b> Napiš svou obec na IG</span><span class="arr">→</span></a>
<nav id="pNav"><button data-s="rank">🏆<span>Obce</span></button><button data-s="search">🔍<span>Hledat</span></button><button data-s="how">❓<span>Jak hrát</span></button><button data-s="over">🗺️<span>Mapa</span></button></nav>`;
document.body.appendChild(root);

/* záložky */
root.querySelectorAll(".pTabs button").forEach(b=>b.onclick=()=>tab(b.dataset.t));
function tab(t){root.querySelectorAll(".pTabs button").forEach(x=>x.classList.toggle("on",x.dataset.t===t));$("pRank").hidden=t!=="rank";$("pHow").hidden=t!=="how"}
root.querySelectorAll("#pNav button").forEach(b=>b.onclick=()=>{const s=b.dataset.s;
 if(s==="over"){closeSheets();GAME.overview();return}
 if(s==="search"){closeSheets();$("pTop").classList.add("open");$("pQ").focus();return}
 const open=$("pSide").classList.contains("sheet")&&!$("pSide").hidden&&root.dataset.sheet===s;closeSheets();if(open)return;root.dataset.sheet=s;tab(s);$("pSide").classList.add("sheet")});
function closeSheets(){$("pSide").classList.remove("sheet");$("pTop").classList.remove("open");root.dataset.sheet=""}

/* žebříček */
function erbImg(u,cls){return u?`<img class="${cls||"erb"}" src="${u}" alt="">`:`<span class="${cls||"erb"} ph"></span>`}
function renderRank(){const r=GAME.ranking();$("pRank").innerHTML=r.map((t,i)=>{const nt=nextTier(t.players);const pct=nt?Math.min(100,t.players/nt.to*100):100;
 return`<button class="rk${t.open?"":" fog"}" data-n="${esc(t.name)}"><span class="pos">${i+1}</span>${erbImg(t.erbUrl)}<span class="nm"><b>${esc(t.name)}</b>
 <span class="bar"><i style="width:${pct}%;background:${t.open?TIERC[t.tier]:"#b8c0cf"}"></i></span><small>${t.open?(nt?`${t.players} obyvatel · ${nt.to-t.players} ${nt.lab}`:`${t.players} obyvatel · platinová liga`):`zatím nikdo · buď první`}</small></span>${t.week?`<span class="wk">+${t.week}</span>`:""}</button>`}).join("");
 $("pRank").querySelectorAll(".rk").forEach(b=>b.onclick=()=>{closeSheets();GAME.focusTown(b.dataset.n)})}

/* karta obce */
let curTown=null;
GAME.onTownFocus=n=>{curTown=n;GAME.closeInfo();renderTown()};
function renderTown(){document.body.classList.toggle("card-open",!!curTown);if(!curTown)return;const t=GAME.townInfo(curTown);const nt=nextTier(t.players);const el=$("pTown");el.hidden=false;
 el.innerHTML=`<button class="x" id="pTownX">×</button><div class="tHead">${erbImg(t.erbUrl,"erbL")}<div><h3>${esc(t.name)}</h3><span class="tier" style="--c:${t.open?TIERC[t.tier]:"#9aa3b1"}">${t.open?TIERN[t.tier]:"Zatím bez obyvatel"}</span></div></div>
 <div class="tStats"><div><b>${t.players}</b><span>obyvatel</span></div><div><b>${t.specials.length}</b><span>staveb</span></div><div><b>${nt?nt.to-t.players:"✓"}</b><span>${nt?(t.open?nt.lab:"do odhalení"):"max. liga"}</span></div></div>
 ${t.open?"":`<p class="note">V obci zatím nikdo nebydlí. Napiš „${esc(t.name)}“ do komentářů a buď první!</p>`}
 ${t.jobs&&t.jobs.length?`<div class="jobs">${t.jobs.map(j=>`<div class="job"><span>${j.e} ${esc(j.n)}</span><span class="jb"><i style="width:${Math.min(100,j.c/j.need*100)}%"></i></span><small>${j.built?"✓ "+esc(j.b):j.c+"/"+j.need+" → "+esc(j.b)}</small></div>`).join("")}</div>`:""}
 <p class="lm">📍 ${esc(t.landmark)}</p>
 ${t.specials.length?`<div class="sp">${t.specials.map(x=>`<span>🏗️ ${esc(x.text)}</span>`).join("")}</div>`:""}
 ${t.next?`<p class="nx">Další stavba se odemkne při <b>${t.next.th} obyvatelích</b> ${t.next.emoji}</p>`:""}
 ${t.founders.length?`<p class="fd"><small>Zakladatelé</small>${t.founders.map(esc).join(" · ")}</p>`:""}
 <a class="cta" href="${IG}" target="_blank" rel="noopener">Bydlím tady → napiš „${esc(t.name)}“ do komentářů</a>`;
 $("pTownX").onclick=()=>{el.hidden=true;curTown=null;renderTown()}}
/* karta domku nahradí kartu obce */
const info=$("info");new MutationObserver(()=>{if(info.classList.contains("on")){$("pTown").hidden=true;curTown=null}document.body.classList.toggle("card-open",!!curTown||info.classList.contains("on"))}).observe(info,{attributes:true,attributeFilter:["class"]});

/* hledání */
const q=$("pQ"),res=$("pRes");let selI=-1;
q.addEventListener("input",()=>{const v=q.value.trim();if(!v){res.innerHTML="";return}
 const towns=GAME.ranking().filter(t=>t.name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").includes(v.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,""))).slice(0,4);
 const ppl=GAME.find(v);
 res.innerHTML=(towns.map(t=>`<button data-k="t" data-n="${esc(t.name)}">${erbImg(t.erbUrl,"erbS")}<span><b>${esc(t.name)}</b><small>${t.players} obyvatel</small></span></button>`).join("")+
  ppl.map(p=>`<button data-k="h" data-n="${esc(p.town)}" data-i="${p.idx}"><span class="hs">🏠</span><span><b>${esc(p.nick)}</b><small>${esc(p.town)}</small></span></button>`).join(""))||`<div class="empty">Nic jsme nenašli. Domek se objeví do 2 hodin od komentáře.</div>`;
 res.querySelectorAll("button").forEach(b=>b.onclick=()=>{q.value="";res.innerHTML="";closeSheets();q.blur();if(b.dataset.k==="t")GAME.focusTown(b.dataset.n);else{$("pTown").hidden=true;GAME.select(b.dataset.n,+b.dataset.i)}})});
q.addEventListener("keydown",e=>{if(e.key==="Enter"){const b=res.querySelector("button");if(b)b.click()}if(e.key==="Escape"){q.value="";res.innerHTML=""}});

function upd(){const i=GAME.info();$("pSub").textContent=`Den ${i.day} · ${i.pop.toLocaleString("cs-CZ")} obyvatel · ${i.open}/${i.total} obcí`;renderRank();renderTown()}
GAME.onUpdate=()=>{clearTimeout(upd.t);upd.t=setTimeout(upd,150)};
const wait=setInterval(()=>{if(window.done){clearInterval(wait);upd();setTimeout(upd,1500)}},200);
})();
