/* Cesta C: hra vyrenderuje surové klipy dne (9:16, bez grafiky) + brief.json/brief.md s kontextem pro střih a voiceover.
 *   node tools/video/clips.js [--out out/clips] [--day N] [--data world.json] [--fps 25] [--scale 0.5] [--three <dir>] [--max 9]
 * Výstup: klip-NN-<id>.mp4, brief.json, brief.md, nahled.jpg (kontaktní arch prvních snímků)
 */
const fs=require('fs'),path=require('path'),http=require('http'),{execFileSync}=require('child_process');
const {chromium}=require('playwright');
const arg=(k,d)=>{const i=process.argv.indexOf('--'+k);return i>0?process.argv[i+1]:d};
const ROOT=path.resolve(__dirname,'../..');const OUT=path.resolve(arg('out','out/clips'));fs.mkdirSync(OUT,{recursive:true});
const FPS=+arg('fps',25),SCALE=arg('scale','0.5'),MAX=+arg('max',9);
const MIME={'.html':'text/html','.js':'text/javascript','.json':'application/json','.png':'image/png','.css':'text/css','.svg':'image/svg+xml'};
function serve(){return new Promise(res=>{const s=http.createServer((rq,rs)=>{let p=decodeURIComponent(rq.url.split('?')[0]);if(p==='/')p='/index.html';let f=path.join(ROOT,'web',p);if(!fs.existsSync(f))f=path.join(ROOT,p);if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){rs.writeHead(404);return rs.end('nf')}rs.writeHead(200,{'content-type':MIME[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(rs)});s.listen(0,'127.0.0.1',()=>res(s))})}

/* plán klipů z dayData: co ukázat a proč (text pro voiceover je jen návrh) */
function plan(d,info){const P=[];const top={};d.newPlayers.forEach(p=>top[p.town]=(top[p.town]||0)+1);const topTowns=Object.entries(top).sort((a,b)=>b[1]-a[1]);
 P.push({id:'prelet',dur:6,action:'overview',what:`Přelet celé mapy. Den ${d.day}, ${info.pop} obyvatel, ${info.alive}/52 oživených obcí, dnes +${d.newPlayers.length}.`,vo:`Tady Pan Radar. Den ${d.day}. Říčansko má ${info.pop} obyvatel.`});
 P.push({id:'namesti',dur:5,action:'center',what:'Náměstí sjednocení: katedrála a socha 52 mečů, erby svítí podle stavu obcí.',vo:`Na soše svítí ${info.alive} erbů z 52.`});
 (d.newTowns||[]).slice(0,2).forEach(n=>P.push({id:'nova-'+slug(n),dur:4,action:'town',town:n,what:`${n}: dnes první obyvatel, obec se objevila na mapě.`,vo:`${n} má prvního obyvatele.`}));
 (d.revived||[]).slice(0,2).forEach(n=>P.push({id:'ozila-'+slug(n),dur:4,action:'town',town:n,what:`${n} ožila: 5 obyvatel, erb se rozsvítil.`,vo:`${n} ožila. Pátý obyvatel, erb svítí.`}));
 if(d.newBuilding)P.push({id:'stavba-'+slug(d.newBuilding.town),dur:5,action:'town',town:d.newBuilding.town,what:`Nová stavba v obci ${d.newBuilding.town}: „${d.newBuilding.name}“ (${d.newBuilding.type}).`,vo:`${d.newBuilding.town} postavila ${d.newBuilding.name}.`});
 (d.jobBuilt||[]).slice(0,1).forEach(j=>P.push({id:'povolani-'+slug(j.town),dur:5,action:'town',town:j.town,what:`${j.town}: ${j.job} si postavili ${j.building} („${j.name}“).`,vo:`${j.job} z obce ${j.town} si postavili ${j.building}.`}));
 if(d.crown)P.push({id:'koruna',dur:4,action:'town',town:d.crown.name,what:`Koruna týdne: ${d.crown.name} (+${d.crown.week} za 7 dní)${d.crown.changed?', dnes ji převzala':''}.`,vo:`Korunu týdne má ${d.crown.name}. Kdo ji vezme?`});
 topTowns.slice(0,2).forEach(([n,c])=>P.push({id:'rust-'+slug(n),dur:4,action:'town',town:n,what:`${n}: dnes +${c} obyvatel.`,vo:`${n}: dnes plus ${c}.`}));
 (d.findMe||d.newPlayers||[]).slice(0,3).forEach(p=>P.push({id:'domek-'+slug(p.owner||p.nick||'x'),dur:3,action:'house',house:p.id||null,town:p.town,owner:p.owner||p.nick,what:`Nový domek: @${p.owner||p.nick} v obci ${p.town}.`,vo:`${p.owner||p.nick}, tvůj domek stojí v obci ${p.town}.`}));
 (d.jobs||[]).slice(0,1).forEach(j=>P.push({id:'chybi-'+slug(j.town),dur:4,action:'town',town:j.town,what:`${j.town}: ${j.count}/${j.need} ${j.job}, chybí ${j.need-j.count} do stavby ${j.building}.`,vo:`${j.town} potřebuje ještě ${j.need-j.count} ${j.job.toLowerCase()}.`}));
 return P.slice(0,MAX)}
const slug=s=>String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,24)||'x';

(async()=>{const srv=await serve();const base=`http://127.0.0.1:${srv.address().port}`;
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
 const p=await b.newPage({viewport:{width:1100,height:720}});p.on('pageerror',e=>console.error('page:',e.message));
 const three=arg('three');if(three)await p.route(/three(\.min)?\.js|OrbitControls\.js|GLTFLoader\.js/,r=>{const f=r.request().url().split('/').pop();const m={'three.min.js':'build/three.min.js','OrbitControls.js':'examples/js/controls/OrbitControls.js','GLTFLoader.js':'examples/js/loaders/GLTFLoader.js'}[f];m?r.fulfill({path:path.join(three,m)}):r.continue()});
 const data=arg('data','world.json');const dayQ=arg('day')?`&den=${arg('day')}`:'';
 await p.goto(`${base}/index.html?admin=fofrburg96&perf=0&nicky=1&render=${SCALE}&data=${encodeURIComponent('/'+data)}${dayQ}`);
 await p.waitForFunction(()=>window.done===1,null,{timeout:180000});await p.waitForTimeout(1500);
 const ctx=await p.evaluate(()=>{const i=GAME.info();const r=GAME.ranking();const d=GAME.dayData();d.revived=GAME.dayLog(i.day).revived;const np=d.newPlayers.map(x=>Object.assign({},x));return{info:{day:i.day,pop:i.pop,alive:r.filter(t=>t.players>=GAME.revive()).length,total:i.total,top:r.slice(0,5).map(t=>({name:t.name,players:t.players,week:t.week,tier:t.tier}))},day:d}});
 const P=plan(ctx.day,ctx.info);console.log('klipy:',P.map(c=>c.id).join(', '));
 /* virtuální čas + zachycení snímků hry */
 await p.exposeFunction('__frame',(name,i,b64)=>{const dir=path.join(OUT,'f-'+name);if(i===0)fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,String(i).padStart(5,'0')+'.jpg'),Buffer.from(b64,'base64'))});
 await p.evaluate(()=>{const W=window;W.__vt={q:[],t:performance.now(),realRAF:W.requestAnimationFrame.bind(W),realNow:performance.now.bind(performance)};
  W.requestAnimationFrame=cb=>{W.__vt.q.push(cb);return 1};performance.now=()=>W.__vt.t;
  W.__step=function(dt){W.__vt.t+=dt;const cbs=W.__vt.q;W.__vt.q=[];cbs.forEach(cb=>{try{cb(W.__vt.t)}catch(e){console.error(e)}})}});
 await p.evaluate(()=>new Promise(r=>window.__vt.realRAF(()=>window.__vt.realRAF(r))));// smyčka hry se přihlásí do virtuální fronty
 await p.evaluate(()=>{GAME.setAspect(1080,1920);document.body.classList.add('admin');const h=document.getElementById('hud');if(h)h.style.display='none';['info','compass','help','attr','toast'].forEach(id=>{const e=document.getElementById(id);if(e)e.style.display='none'});const L=document.getElementById('labels');if(L)L.style.display='none'});
 const hide=`document.querySelectorAll('.lbl,.slbl').forEach(e=>e.style.display='none')`;
 const t0=Date.now();const briefClips=[];
 for(const [k,c] of P.entries()){const name=String(k+1).padStart(2,'0')+'-'+c.id;const n=Math.round(c.dur*FPS);
  await p.evaluate(async c=>{if(c.action==='overview')GAME.overview(1400);else if(c.action==='center')GAME.focusCenter(1400);else if(c.action==='town')GAME.focusTown(c.town,1400,true);else if(c.action==='house'){if(c.house)GAME.focusHouse(c.house,1400);else GAME.focusTown(c.town,1400,true)}GAME.orbit(c.action==='overview'?.08:.22)},c);
  const cnt=await p.evaluate(async([name,n,fps,hide])=>{for(let i=0;i<n;i++){window.__step(1000/fps);eval(hide);const d=GAME.canvas.toDataURL('image/jpeg',.9).slice(23);await window.__frame(name,i,d)}return n},[name,n,FPS,hide]);
  const dir=path.join(OUT,'f-'+name),mp4=path.join(OUT,'klip-'+name+'.mp4');
  execFileSync('ffmpeg',['-y','-v','error','-framerate',String(FPS),'-i',path.join(dir,'%05d.jpg'),'-vf','scale=1080:1920:flags=lanczos','-c:v','libx264','-preset','veryfast','-crf','20','-pix_fmt','yuv420p','-r',String(FPS),'-movflags','+faststart',mp4]);
  fs.copyFileSync(path.join(dir,'00000.jpg'),path.join(OUT,'n-'+name+'.jpg'));fs.rmSync(dir,{recursive:true,force:true});
  briefClips.push(Object.assign({file:'klip-'+name+'.mp4',frames:cnt,seconds:c.dur},c));console.log(name,cnt,'snímků',((Date.now()-t0)/1000|0)+'s')}
 /* brief */
 const brief={den:ctx.info.day,datum:new Date().toISOString().slice(0,10),stav:ctx.info,udalosti:ctx.day,klipy:briefClips,
  pokyny:'Klipy jsou surové záběry z mapy (9:16, bez grafiky a zvuku) v pořadí, které dává smysl jako díl: přelet → náměstí → novinky → najdi se → otevřená smyčka. Voiceover: Pan Radar, starší klidný hlas, krátké věty, čísla vždy říct. Struktura reelu: hook (den + stav) → co se změnilo → najdi se → otázka na zítra + „napiš obec do komentářů“.'};
 fs.writeFileSync(path.join(OUT,'brief.json'),JSON.stringify(brief,null,1));
 const md=[`# Brief dne ${ctx.info.day} (${brief.datum})`,'',`Obyvatel: **${ctx.info.pop}** · oživených obcí: **${ctx.info.alive}/52** · dnes nových: **${ctx.day.newPlayers.length}**`,'',
  '## Klipy (v pořadí)',...briefClips.map((c,i)=>`${i+1}. \`${c.file}\` (${c.seconds} s): ${c.what}\n   - VO návrh: „${c.vo}“`),'',
  '## Top obce',...ctx.info.top.map((t,i)=>`${i+1}. ${t.name}: ${t.players} obyvatel (+${t.week} za týden, ${t.tier})`),'',
  '## Jak stříhat','- Hook do 1 s: den + číslo obyvatel přes přelet.','- Každý klip max 3–5 s, střih na přízvuk hlasu.','- Konec: otázka na zítra (co postavíme / kdo vezme korunu) + „napiš obec do komentářů“.','- Hlas: Pan Radar (ElevenLabs, Voice ID v render.js), tón klidný, lehce tajemný, žádné nadávky.'].join('\n');
 fs.writeFileSync(path.join(OUT,'brief.md'),md);
 try{execFileSync('ffmpeg',['-y','-v','error','-pattern_type','glob','-i',path.join(OUT,'n-*.jpg'),'-vf',`scale=270:-1,tile=${Math.min(5,briefClips.length)}x${Math.ceil(briefClips.length/5)}`,'-frames:v','1',path.join(OUT,'nahled.jpg')])}catch(e){}
 fs.readdirSync(OUT).filter(f=>f.startsWith('n-')).forEach(f=>fs.unlinkSync(path.join(OUT,f)));
 console.log('hotovo:',OUT);await b.close();srv.close()})().catch(e=>{console.error(e);process.exit(1)});
