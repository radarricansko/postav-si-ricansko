/* Noční render reelu „Postav si Říčansko“ (headless Chromium + ffmpeg).
 *   Rychlý render po částech (dil.yml): --voice-out soubor (jen hlas) · --voice-in soubor --part k/P (jen snímky části k z P) · --voice-in soubor --mux (zvuk + složení)
 *   node tools/video/render.js --dil N [--sheet]     díl podle scénáře tools/video/dily/dil-N.json (--sheet = jen náhledové snímky po 0,5 s)
 *   node tools/video/render.js [--out out/] [--day N] [--data world.json] [--handle @radar_ricansko] [--scale 0.5] [--fps 30] [--frames N]
 * Env: ELEVENLABS_API_KEY (volitelně, hlas), ELEVENLABS_VOICE_ID (ID hlasu z Voice Library), ELEVENLABS_MODEL (default eleven_multilingual_v2)
 * Výstup: <out>/reel-den-N.mp4 (H.264 + AAC, 1080×1920, 30 fps), reel-den-N.srt, reel-den-N.txt (voiceover), reel-den-N.json (scénář)
 */
const fs=require('fs'),path=require('path'),http=require('http'),{execFileSync,spawnSync}=require('child_process');
const {chromium}=require('playwright');
const arg=(k,d)=>{const i=process.argv.indexOf('--'+k);return i>0?process.argv[i+1]:d};
const ROOT=path.resolve(__dirname,'../..');const OUT=path.resolve(arg('out','out'));fs.mkdirSync(OUT,{recursive:true});
const FPS=+arg('fps',25),HANDLE=arg('handle','@radar_ricansko'),MAXF=+arg('frames',0);
const MIME={'.html':'text/html','.js':'text/javascript','.json':'application/json','.png':'image/png','.gltf':'model/gltf+json','.css':'text/css','.svg':'image/svg+xml'};

/* statický server nad repem (web/ + world.json) */
function serve(){return new Promise(res=>{const s=http.createServer((rq,rs)=>{let p=decodeURIComponent(rq.url.split('?')[0]);if(p==='/')p='/index.html';
 let f=path.join(ROOT,'web',p);if(!fs.existsSync(f))f=path.join(ROOT,p);if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){rs.writeHead(404);return rs.end('nf')}
 rs.writeHead(200,{'content-type':MIME[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(rs)});s.listen(0,'127.0.0.1',()=>res(s))})}

/* ElevenLabs TTS – jeden segment → mp3 Buffer */
/* ElevenLabs: hlavní hlas Pana Radara (knihovní hlas kOWmvbNszhdJeaeyEzJB vyžaduje Creator tarif).
   Na Free/Starter se automaticky použije náhradní předpřipravený hlas (ELEVENLABS_FALLBACK_VOICE, výchozí „Bill“ – starší klidný mužský). */
let ttsVoice=null;
async function ttsOnce(text,voice){const key=process.env.ELEVENLABS_API_KEY;
 const r=await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`,{method:'POST',headers:{'xi-api-key':key,'content-type':'application/json'},
  body:JSON.stringify({text,model_id:process.env.ELEVENLABS_MODEL||'eleven_multilingual_v2',voice_settings:{stability:.5,similarity_boost:.8,style:.3,use_speaker_boost:true}})});
 if(!r.ok){const t=await r.text().catch(()=>'');console.error('ElevenLabs',r.status,t.slice(0,160));return{err:t}}return{buf:Buffer.from(await r.arrayBuffer())}}
let GEM=null;try{GEM=require('../hlas/gemini')}catch(e){}
let ttsVia='';
async function tts(text){if(process.env.GEMINI_API_KEY&&GEM){const b=await GEM.tts(text);if(b){ttsVia='Gemini';return b}}const key=process.env.ELEVENLABS_API_KEY;if(!key)return null;ttsVia='ElevenLabs';
 const main=process.env.ELEVENLABS_VOICE_ID||'kOWmvbNszhdJeaeyEzJB',fb=process.env.ELEVENLABS_FALLBACK_VOICE||'pqHfZKP75CvOlQylNhV4';
 if(!ttsVoice){const r=await ttsOnce(text,main);if(r.buf){ttsVoice=main;return r.buf}
  if(/free_users_not_allowed|creator tier|voice_not_found|not found/i.test(r.err||'')){console.log('hlas: hlavní hlas není na tomto tarifu dostupný, používám náhradní',fb);ttsVoice=fb}else return null}
 const r=await ttsOnce(text,ttsVoice);return r.buf||null}

/* Díl: celý text namluvený na jeden zátah (drží tempo a intonaci), pak rozdělený na věty podle pauz.
   Hranice = ticho nejblíž místu, kde věta končí podle počtu znaků. Vrací pole mp3 Bufferů (jedno na záběr) nebo null. */
function splitTake(mp3,texts){const tmp=path.join(OUT,'take.mp3');fs.writeFileSync(tmp,mp3);
 const r=spawnSync('ffmpeg',['-hide_banner','-i',tmp,'-af','silencedetect=noise=-34dB:d=0.09','-f','null','-'],{encoding:'utf8'});const log=r.stderr||'';
 const dm=log.match(/Duration: (\d+):(\d+):([\d.]+)/);if(!dm)return null;const total=+dm[1]*3600+ +dm[2]*60+ +dm[3];
 const sil=[];const re=/silence_start: ([\d.]+)[\s\S]*?silence_end: ([\d.]+)/g;let m;while((m=re.exec(log)))sil.push([+m[1],+m[2]]);
 let s0=0,s1=total;if(sil.length&&sil[0][0]<.05)s0=sil[0][1];if(sil.length&&sil[sil.length-1][1]>total-.05)s1=sil[sil.length-1][0];
 const len=texts.map(t=>t.replace(/[^\p{L}\p{N}]/gu,'').length||1),sum=len.reduce((a,b)=>a+b,0);const cuts=[Math.max(0,s0-.05)];let acc=0;
 for(let i=0;i<texts.length-1;i++){acc+=len[i];const T=s0+(s1-s0)*acc/sum;let best=null;for(const [a,b] of sil){const mid=(a+b)/2;if(mid<=cuts[cuts.length-1]+.35||mid>=s1-.2)continue;const sc=Math.abs(mid-T)-1.2*(b-a);if(Math.abs(mid-T)<1.6&&(!best||sc<best.sc))best={sc,mid}}cuts.push(best?best.mid:T)}
 cuts.push(Math.min(total,s1+.12));const out=[];
 for(let i=0;i<texts.length;i++){const f=path.join(OUT,`take-${i}.mp3`);const q=spawnSync('ffmpeg',['-v','error','-y','-i',tmp,'-ss',cuts[i].toFixed(3),'-to',cuts[i+1].toFixed(3),'-b:a','160k',f]);if(q.status!==0)return null;out.push(fs.readFileSync(f));fs.unlinkSync(f)}
 fs.unlinkSync(tmp);console.log('hlas: jeden zátah',total.toFixed(1),'s, střihy',cuts.map(c=>c.toFixed(2)).join(' '),'(pauz nalezeno',sil.length+')');return out}

(async()=>{const srv=await serve();const base=`http://127.0.0.1:${srv.address().port}`;
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required']});
 const p=await b.newPage({viewport:{width:1100,height:720}});p.on('pageerror',e=>console.error('page:',e.message));p.on('console',m=>{if(/^frame/.test(m.text()))console.log(m.text())});
 const three=arg('three');if(three)await p.route(/three(\.min)?\.js|OrbitControls\.js|GLTFLoader\.js/,r=>{const f=r.request().url().split('/').pop();const m={'three.min.js':'build/three.min.js','OrbitControls.js':'examples/js/controls/OrbitControls.js','GLTFLoader.js':'examples/js/loaders/GLTFLoader.js'}[f];m?r.fulfill({path:path.join(three,m)}):r.continue()});
 const DIL=arg('dil');let def=DIL?JSON.parse(fs.readFileSync(path.join(ROOT,'tools/video/dily',`dil-${DIL}.json`),'utf8')):null;const SHEET=process.argv.includes('--sheet');
 const data=def&&def.data?def.data:arg('data','world.json');
 /* scénář dílu: {{proměnné}} z dat a z výsledků hlasování */
 if(def){const DD=require('./dil-data');const w=JSON.parse(fs.readFileSync(path.join(ROOT,data),'utf8'));const nav=arg('navrhy')?JSON.parse(fs.readFileSync(path.resolve(ROOT,arg('navrhy')),'utf8')):DD.posledniNavrhy();const r=DD.dosad(def,DD.promenne(w,nav,{dil:parseInt(DIL,10)||1}));def=r.def;if(r.chybi.length)console.log('POZOR: ve scénáři zůstalo nedosazeno:',r.chybi.join(', '))}const dayQ=arg('day')?`&den=${arg('day')}`:'';
 await p.goto(`${base}/index.html?admin=fofrburg96&perf=0&render=${arg('scale','0.5')}&data=${encodeURIComponent('/'+data)}${dayQ}${def?'&mlha=0':''}`);
 await p.waitForFunction(()=>window.done===1,null,{timeout:180000});await p.waitForTimeout(2000);
 const info=await p.evaluate(()=>({day:GAME.info().day,pop:GAME.info().pop,hasReel:!!window.REEL}));console.log('hra:',info);if(!info.hasReel)throw new Error('REEL chybí');
 /* scénář */
 const script=await p.evaluate(([h,def])=>{const s=def?REEL.scriptFromShots(def,{handle:h}):REEL.scriptFromDay(GAME.dayData(),{handle:h,lastHook:null,narrator:'Pan Radar'});window.__script=s;const v=REEL.voiceScript(s);return{hook:s.hook,scenes:s.scenes.map(x=>x.type||x.name),vo:v,total:s.total||s.duration}},[HANDLE,def]);
 const tag=def?`dil-${DIL}`:`reel-den-${info.day}`;fs.writeFileSync(path.join(OUT,tag+'.srt'),script.vo.srt);fs.writeFileSync(path.join(OUT,tag+'.txt'),script.vo.text);
 console.log('hook:',script.hook,'scény:',script.scenes.join(' › '));
 /* hlas po segmentech */
 const VIN=arg('voice-in'),VOUT=arg('voice-out'),PART=arg('part'),MUX=process.argv.includes('--mux');const vin=VIN&&fs.existsSync(VIN)?JSON.parse(fs.readFileSync(VIN,'utf8')):null;
 const segs=script.vo.segments||[];let voiced=0;if((vin||process.env.ELEVENLABS_API_KEY||process.env.GEMINI_API_KEY)&&segs.length&&!SHEET){let clips=vin?vin.clips||[]:[];if(vin){voiced=clips.filter(Boolean).length;ttsVia=vin.via||''}
  if(!vin){
  if(def&&process.env.GEMINI_API_KEY&&GEM){const take=await GEM.tts(segs.map(s=>s.text).join(' '),{zive:true,tempo:+process.env.GEMINI_TEMPO||1.06});const parts=take?splitTake(take,segs.map(s=>s.text)):null;if(parts){clips=parts.map(b=>b.toString('base64'));voiced=parts.length;ttsVia='Gemini (jeden zátah)'}}
  if(!clips.length)for(const s of segs){const buf=await tts(s.text);clips.push(buf?buf.toString('base64'):null);if(buf)voiced++}}
  if(VOUT){fs.writeFileSync(VOUT,JSON.stringify({clips,via:ttsVia}));console.log('hlas uložen:',VOUT,'segmentů',voiced,'/',segs.length,ttsVia);await b.close();srv.close();return}
  if(clips.some(Boolean))  await p.evaluate(async clips=>{const blobs=clips.map(c=>c?new Blob([Uint8Array.from(atob(c),ch=>ch.charCodeAt(0))],{type:'audio/mpeg'}):null);await REEL.setVoiceSegments(window.__script,blobs,{padMs:window.__script.hook==='dil'?0:80})},clips);
  console.log('hlas: segmentů',voiced,'/',segs.length)}else if(VOUT){fs.writeFileSync(VOUT,JSON.stringify({clips:[],via:''}));console.log('hlas: žádný klíč, video bude bez hlasu');await b.close();srv.close();return}else console.log('hlas: bez ElevenLabs (chybí ELEVENLABS_API_KEY) – video bude jen s hudbou, text je v .txt/.srt');
 fs.writeFileSync(path.join(OUT,tag+'.json'),JSON.stringify(await p.evaluate(()=>window.__script),null,1));
 /* snímky */
 if(SHEET){const sd=path.join(OUT,'sheet');fs.rmSync(sd,{recursive:true,force:true});fs.mkdirSync(sd);await p.exposeFunction('__sheet',(i,b64)=>fs.writeFileSync(path.join(sd,String(i).padStart(3,'0')+'.jpg'),Buffer.from(b64,'base64')));
  const n=await p.evaluate(()=>REEL.frames(window.__script,{fps:2,each:async(cv,t,i)=>{await window.__sheet(i,cv.toDataURL('image/jpeg',.8).slice(23))}}));console.log('náhledů:',n,'délka',(script.total/1000).toFixed(1),'s');await b.close();srv.close();return}
 const fdir=path.join(OUT,'frames');if(!MUX){fs.rmSync(fdir,{recursive:true,force:true});fs.mkdirSync(fdir)}
 let n=0;const t0=Date.now();
 if(PART){ /* jen část k z P: hranice na začátcích záběrů, čísla snímků průběžná přes celé video */
  const [k,P]=PART.split('/').map(Number);const sc=await p.evaluate(()=>({total:window.__script.total,t0:window.__script.scenes.map(s=>s.t0)}));const step=1000/FPS;
  const B=[0];for(let j=1;j<P;j++){const T=sc.total*j/P;const c=sc.t0.filter(t=>t>B[B.length-1]).sort((a,b)=>Math.abs(a-T)-Math.abs(b-T))[0];B.push(c==null?sc.total:c)}B.push(sc.total);
  const i0=Math.max(0,Math.ceil(B[k]/step-1e-6)),i1=Math.ceil(B[k+1]/step-1e-6);console.log('část',k,'/',P,'snímky',i0,'–',i1-1,'z',Math.ceil(sc.total/step));
  await p.exposeFunction('__frame',(i,b64)=>fs.writeFileSync(path.join(fdir,String(i).padStart(5,'0')+'.jpg'),Buffer.from(b64,'base64')));
  if(i1>i0)n=await p.evaluate(async([fps,i0,i1])=>REEL.frames(window.__script,{fps,start:i0*1000/fps,end:i1*1000/fps,each:async(cv,t,i)=>{await window.__frame(i0+i,cv.toDataURL('image/jpeg',.92).slice(23));if(i%30===0)console.log('frame',i0+i,t|0)}}),[FPS,i0,i1]);
  console.log('snímků:',n,'za',((Date.now()-t0)/1000).toFixed(0),'s');await b.close();srv.close();return}
 if(!MUX){await p.exposeFunction('__frame',(i,b64)=>fs.writeFileSync(path.join(fdir,String(i).padStart(5,'0')+'.jpg'),Buffer.from(b64,'base64')));
 n=await p.evaluate(async([fps,maxf])=>REEL.frames(window.__script,{fps,end:maxf?maxf*1000/fps:undefined,each:async(cv,t,i)=>{const d=cv.toDataURL('image/jpeg',.92).slice(23);await window.__frame(i,d);if(i%30===0)console.log('frame',i,t|0)}}),[FPS,MAXF]);console.log('render',((Date.now()-t0)/1000).toFixed(0),'s');
 console.log('snímků:',n)}else console.log('skládám snímky z',fdir,'(',fs.readdirSync(fdir).length,')');
 /* audio (OfflineAudioContext) */
 const wav=await p.evaluate(async()=>{const bl=await REEL.renderAudio(window.__script);const ab=await bl.arrayBuffer();let s='';const u=new Uint8Array(ab);for(let i=0;i<u.length;i+=8192)s+=String.fromCharCode.apply(null,u.subarray(i,i+8192));return btoa(s)});
 const wavPath=path.join(OUT,tag+'.wav');fs.writeFileSync(wavPath,Buffer.from(wav,'base64'));
 const mp4=path.join(OUT,tag+'.mp4');
 execFileSync('ffmpeg',['-y','-framerate',String(FPS),'-i',path.join(fdir,'%05d.jpg'),'-i',wavPath,'-c:v','libx264','-preset','veryfast','-crf','19','-pix_fmt','yuv420p','-r',String(FPS),'-c:a','aac','-b:a','160k','-shortest','-movflags','+faststart',mp4],{stdio:'inherit'});
 fs.rmSync(fdir,{recursive:true,force:true});fs.unlinkSync(wavPath);console.log('hotovo:',mp4,'hlas:',voiced?ttsVia:'bez hlasu');
 await b.close();srv.close()})().catch(e=>{console.error(e);process.exit(1)});
