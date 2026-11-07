/* Noční render reelu „Postav si Říčansko“ (headless Chromium + ffmpeg).
 *   node tools/video/render.js [--out out/] [--day N] [--data world.json] [--handle @radar_ricansko] [--scale 0.5] [--fps 30] [--frames N]
 * Env: ELEVENLABS_API_KEY (volitelně, hlas), ELEVENLABS_VOICE_ID (ID hlasu z Voice Library), ELEVENLABS_MODEL (default eleven_multilingual_v2)
 * Výstup: <out>/reel-den-N.mp4 (H.264 + AAC, 1080×1920, 30 fps), reel-den-N.srt, reel-den-N.txt (voiceover), reel-den-N.json (scénář)
 */
const fs=require('fs'),path=require('path'),http=require('http'),{execFileSync}=require('child_process');
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
async function tts(text){const key=process.env.ELEVENLABS_API_KEY;if(!key)return null;
 const main=process.env.ELEVENLABS_VOICE_ID||'kOWmvbNszhdJeaeyEzJB',fb=process.env.ELEVENLABS_FALLBACK_VOICE||'pqHfZKP75CvOlQylNhV4';
 if(!ttsVoice){const r=await ttsOnce(text,main);if(r.buf){ttsVoice=main;return r.buf}
  if(/free_users_not_allowed|creator tier|voice_not_found|not found/i.test(r.err||'')){console.log('hlas: hlavní hlas není na tomto tarifu dostupný, používám náhradní',fb);ttsVoice=fb}else return null}
 const r=await ttsOnce(text,ttsVoice);return r.buf||null}

(async()=>{const srv=await serve();const base=`http://127.0.0.1:${srv.address().port}`;
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required']});
 const p=await b.newPage({viewport:{width:1100,height:720}});p.on('pageerror',e=>console.error('page:',e.message));p.on('console',m=>{if(/^frame/.test(m.text()))console.log(m.text())});
 const three=arg('three');if(three)await p.route(/three(\.min)?\.js|OrbitControls\.js|GLTFLoader\.js/,r=>{const f=r.request().url().split('/').pop();const m={'three.min.js':'build/three.min.js','OrbitControls.js':'examples/js/controls/OrbitControls.js','GLTFLoader.js':'examples/js/loaders/GLTFLoader.js'}[f];m?r.fulfill({path:path.join(three,m)}):r.continue()});
 const data=arg('data','world.json');const dayQ=arg('day')?`&den=${arg('day')}`:'';
 await p.goto(`${base}/index.html?admin=fofrburg96&perf=0&render=${arg('scale','0.5')}&data=${encodeURIComponent('/'+data)}${dayQ}`);
 await p.waitForFunction(()=>window.done===1,null,{timeout:180000});await p.waitForTimeout(2000);
 const info=await p.evaluate(()=>({day:GAME.info().day,pop:GAME.info().pop,hasReel:!!window.REEL}));console.log('hra:',info);if(!info.hasReel)throw new Error('REEL chybí');
 /* scénář */
 const script=await p.evaluate(h=>{const s=REEL.scriptFromDay(GAME.dayData(),{handle:h,lastHook:null,narrator:'Pan Radar'});window.__script=s;const v=REEL.voiceScript(s);return{hook:s.hook,scenes:s.scenes.map(x=>x.type||x.name),vo:v,total:s.total||s.duration}},HANDLE);
 const tag=`reel-den-${info.day}`;fs.writeFileSync(path.join(OUT,tag+'.srt'),script.vo.srt);fs.writeFileSync(path.join(OUT,tag+'.txt'),script.vo.text);
 console.log('hook:',script.hook,'scény:',script.scenes.join(' › '));
 /* hlas po segmentech */
 const segs=script.vo.segments||[];let voiced=0;if(process.env.ELEVENLABS_API_KEY&&segs.length){const clips=[];for(const s of segs){const buf=await tts(s.text);clips.push(buf?buf.toString('base64'):null);if(buf)voiced++}
  await p.evaluate(async clips=>{const blobs=clips.map(c=>c?new Blob([Uint8Array.from(atob(c),ch=>ch.charCodeAt(0))],{type:'audio/mpeg'}):null);await REEL.setVoiceSegments(window.__script,blobs,{padMs:80})},clips);
  console.log('hlas: segmentů',voiced,'/',segs.length)}else console.log('hlas: bez ElevenLabs (chybí ELEVENLABS_API_KEY) – video bude jen s hudbou, text je v .txt/.srt');
 fs.writeFileSync(path.join(OUT,tag+'.json'),JSON.stringify(await p.evaluate(()=>window.__script),null,1));
 /* snímky */
 const fdir=path.join(OUT,'frames');fs.rmSync(fdir,{recursive:true,force:true});fs.mkdirSync(fdir);
 await p.exposeFunction('__frame',(i,b64)=>fs.writeFileSync(path.join(fdir,String(i).padStart(5,'0')+'.jpg'),Buffer.from(b64,'base64')));
 const t0=Date.now();const n=await p.evaluate(async([fps,maxf])=>REEL.frames(window.__script,{fps,end:maxf?maxf*1000/fps:undefined,each:async(cv,t,i)=>{const d=cv.toDataURL('image/jpeg',.92).slice(23);await window.__frame(i,d);if(i%30===0)console.log('frame',i,t|0)}}),[FPS,MAXF]);console.log('render',((Date.now()-t0)/1000).toFixed(0),'s');
 console.log('snímků:',n);
 /* audio (OfflineAudioContext) */
 const wav=await p.evaluate(async()=>{const bl=await REEL.renderAudio(window.__script);const ab=await bl.arrayBuffer();let s='';const u=new Uint8Array(ab);for(let i=0;i<u.length;i+=8192)s+=String.fromCharCode.apply(null,u.subarray(i,i+8192));return btoa(s)});
 const wavPath=path.join(OUT,tag+'.wav');fs.writeFileSync(wavPath,Buffer.from(wav,'base64'));
 const mp4=path.join(OUT,tag+'.mp4');
 execFileSync('ffmpeg',['-y','-framerate',String(FPS),'-i',path.join(fdir,'%05d.jpg'),'-i',wavPath,'-c:v','libx264','-preset','veryfast','-crf','19','-pix_fmt','yuv420p','-r',String(FPS),'-c:a','aac','-b:a','160k','-shortest','-movflags','+faststart',mp4],{stdio:'inherit'});
 fs.rmSync(fdir,{recursive:true,force:true});fs.unlinkSync(wavPath);console.log('hotovo:',mp4,'hlas:',voiced?'ElevenLabs':'bez hlasu');
 await b.close();srv.close()})().catch(e=>{console.error(e);process.exit(1)});
