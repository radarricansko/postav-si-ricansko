#!/usr/bin/env node
/* Pan Radar přes Google Gemini TTS (zdarma v AI Studiu). Výstup: PCM 24 kHz -> mp3 přes ffmpeg.
   node tools/hlas/gemini.js nahledy [--out out]         -> out/gemini-<hlas>.mp3 pro několik hlasů
   Jako modul: require('./gemini').tts(text,{voice,style}) -> Buffer s mp3 (nebo null) */
const fs=require('fs'),path=require('path'),{spawnSync}=require('child_process');
const KEY=process.env.GEMINI_API_KEY;
const STYLE='Čti česky svižně a plynule, v rychlém tempu jako vypravěč krátkého videa na sociálních sítích, bez dlouhých pauz mezi větami. Hlas staršího klidného vypravěče s lehkým tajemnem a jiskrou:';
const MODELS=(process.env.GEMINI_TTS_MODEL?[process.env.GEMINI_TTS_MODEL]:[]).concat(['gemini-3.1-flash-tts-preview','gemini-2.5-pro-preview-tts','gemini-2.5-flash-preview-tts']);
/* „režijní“ prompt podle dokumentace Gemini TTS: profil hlasu, scéna, poznámky režiséra, přepis. V přepisu fungují značky jako [excited], [laughs]. */
const ZIVE=text=>`# AUDIO PROFILE: Pan Radar
Vypravěč krátkých videí regionálního média pro mladé lidi z Říčanska. Chlap, který má celý kraj přečtený, baví ho to a je to na něm slyšet. Rodilý mluvčí češtiny.

## SCENE
Reel na Instagram, pětadvacet sekund. Diváci jsou studenti, kteří video pustí o přestávce. První věta je musí zastavit.

### DIRECTOR'S NOTES
Language: Czech (cs). Native Czech pronunciation: correct vowel length (á, é, í, ó, ú, ů, ý), clean "ř", "ch" and "ě", stress always on the first syllable of each word, natural Czech sentence melody. Never an English or Slavic-foreign accent.
Style: energetic, amused, slightly ironic, like a radio host who is clearly enjoying the story. Big intonation, punch on the key words, a grin in the voice. Never a news reader, never monotone.
Pacing: fast and tight, no long pauses between sentences, a tiny beat only before a punchline. Questions go clearly up.

#### TRANSCRIPT
${text}`;
let MODEL=null;
async function call(model,text,voice){const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,{method:'POST',headers:{'x-goog-api-key':KEY,'content-type':'application/json'},
  body:JSON.stringify({contents:[{parts:[{text}]}],generationConfig:{responseModalities:['AUDIO'],speechConfig:{voiceConfig:{prebuiltVoiceConfig:{voiceName:voice}}}}})});
 const t=await r.text();let j=null;try{j=JSON.parse(t)}catch(e){}return{ok:r.ok,status:r.status,j,t}}
async function findModels(){try{const r=await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200',{headers:{'x-goog-api-key':KEY}});const j=await r.json();return (j.models||[]).map(m=>m.name.replace('models/','')).filter(n=>/tts/i.test(n))}catch(e){return[]}}
function toMp3(pcm,rate,tempo){const af=(tempo&&Math.abs(tempo-1)>.01?'atempo='+tempo+',':'')+'loudnorm=I=-16:TP=-1.5';const r=spawnSync('ffmpeg',['-v','error','-f','s16le','-ar',String(rate),'-ac','1','-i','pipe:0','-af',af,'-ar','44100','-b:a','160k','-f','mp3','pipe:1'],{input:pcm,maxBuffer:1<<28});if(r.status!==0)console.error('ffmpeg selhal:',r.error?r.error.message:String(r.stderr).slice(0,200));return r.status===0?r.stdout:null}
async function tts(text,opt={}){if(!KEY)return null;const voice=opt.voice||process.env.GEMINI_VOICE||'Sadaltager';const tempo=opt.tempo||+process.env.GEMINI_TEMPO||1;const full=opt.zive?ZIVE(text):(opt.style===''?'':(opt.style||STYLE)+' ')+text;
 if(opt.model)MODEL=null;let list=opt.model?[opt.model]:MODEL?[MODEL]:MODELS;for(let pass=0;pass<2;pass++){for(const m of list){for(let a=0;a<5;a++){const r=await call(m,full,voice);
    if(r.ok){const p=(((r.j.candidates||[])[0]||{}).content||{}).parts||[];const d=p.find(x=>x.inlineData);if(!d){console.error('gemini: bez zvuku',String(r.t).slice(0,200));break}
     MODEL=m;const rate=+((d.inlineData.mimeType||'').match(/rate=(\d+)/)||[])[1]||24000;return toMp3(Buffer.from(d.inlineData.data,'base64'),rate,tempo)}
    if(r.status===429||r.status>=500){console.error('gemini',m,r.status,String(r.t).slice(0,160).replace(/\s+/g,' '));await new Promise(z=>setTimeout(z,8000*(a+1)));continue}
    console.error('gemini',m,r.status,String(r.t).slice(0,200));break}}
  if(opt.model)break;if(pass===0&&!MODEL){list=(await findModels()).filter(x=>!MODELS.includes(x));if(!list.length)break;console.log('gemini: zkouším modely',list.join(', '))}}
 return null}
/* Přepis krátkého zvuku zpět na text (kontrola, že střih hlasu sedí na věty). Vrací text nebo null. */
const PREPIS_MODELY=(process.env.GEMINI_ASR_MODEL?[process.env.GEMINI_ASR_MODEL]:[]).concat(['gemini-2.5-flash','gemini-2.5-flash-lite','gemini-2.0-flash']);let PREPIS_MODEL=null;
// aktuální textové modely se mění; když žádný z vyjmenovaných neexistuje, vezme se nejnovější „flash“ ze seznamu modelů
async function prepisModely(){try{const r=await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=300',{headers:{'x-goog-api-key':KEY}});const j=await r.json();
  const ver=n=>{const m=n.match(/gemini-(\d+(?:\.\d+)?)/);return m?+m[1]:0};
  return (j.models||[]).filter(m=>(m.supportedGenerationMethods||[]).includes('generateContent')).map(m=>m.name.replace('models/','')).filter(n=>/^gemini-[\d.]+-flash(-lite)?(-latest)?$/.test(n)).sort((a,b)=>ver(b)-ver(a)||a.length-b.length)}catch(e){return[]}}
async function prepis(mp3){if(!KEY||!mp3)return null;if(!PREPIS_MODEL&&!prepis.hledano){prepis.hledano=1;const nove=await prepisModely();if(nove.length){console.log('prepis: modely',nove.slice(0,4).join(', '));PREPIS_MODELY.unshift(...nove.slice(0,3))}}
 for(const m of(PREPIS_MODEL?[PREPIS_MODEL]:[...new Set(PREPIS_MODELY)])){for(let a=0;a<4;a++){let r;try{r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`,{method:'POST',headers:{'x-goog-api-key':KEY,'content-type':'application/json'},
   body:JSON.stringify({contents:[{parts:[{text:'Přepiš přesně, slovo od slova, co je v nahrávce řečeno česky. Vrať jen přepis, nic dalšího. Když v nahrávce nic nezazní, vrať prázdný řádek.'},{inlineData:{mimeType:'audio/mpeg',data:mp3.toString('base64')}}]}],generationConfig:{temperature:0}})})}catch(e){console.error('prepis: síť',e.message);await new Promise(z=>setTimeout(z,3000));continue}
   const t=await r.text();if(r.ok){let j=null;try{j=JSON.parse(t)}catch(e){}PREPIS_MODEL=m;const p=((((j||{}).candidates||[])[0]||{}).content||{}).parts||[];return p.map(x=>x.text||'').join(' ').trim()}
   if(r.status===429||r.status>=500){await new Promise(z=>setTimeout(z,6000*(a+1)));continue}console.error('prepis',m,r.status,t.slice(0,160).replace(/\s+/g,' '));break}}return null}
module.exports={tts,prepis,ZIVE,model:()=>MODEL};
if(require.main===module){(async()=>{if(!KEY){console.error('chybí GEMINI_API_KEY');process.exit(1)}
 const i=process.argv.indexOf('--out');const out=i>0?process.argv[i+1]:'out';fs.mkdirSync(out,{recursive:true});
 if(process.argv[2]==='zive'){ // ukázky „živě“: text dílu 1, režijní prompt, víc hlasů a modelů
  const D1='Co kdyby se Říčansko osamostatnilo? Tak jo. Od dneška jsme stát! Dvaapadesát obcí, nula obyvatel, žádný název a žádná vlajka. To je trochu málo. Napiš do komentáře svou obec a máš tu domek se svým jménem. Prvních pět v každé obci jsou zakladatelé. Napořád. A rovnou rozhodni: jak se náš stát jmenuje? A co bude na vlajce? Hlasuje se do pěti.';
  const D1T='[curious] Co kdyby se Říčansko osamostatnilo? [amused] Tak jo. [excited] Od dneška jsme stát! Dvaapadesát obcí, nula obyvatel, žádný název a žádná vlajka. [deadpan] To je trochu málo. [energetic] Napiš do komentáře svou obec a máš tu domek se svým jménem. Prvních pět v každé obci jsou zakladatelé. [emphatic] Napořád. A rovnou rozhodni: jak se náš stát jmenuje? A co bude na vlajce? [fast] Hlasuje se do pěti.';
  const tempo=+process.env.TEMPO||1.06;const N=(process.env.HLASY||'Sadaltager,Fenrir,Puck,Algenib').split(',').map(x=>x.trim()).filter(Boolean);
  const plan=[];N.forEach((v,k)=>{plan.push([v,'zive',D1,null]);if(!k){plan.push([v,'zive-znacky',D1T,null]);plan.push([v,'zive-pro',D1,'gemini-2.5-pro-preview-tts'])}});
  let ok=0;for(const [v,jm,text,model] of plan){const b=await tts(text,{voice:v,tempo,zive:true,model});const f=`dil1-${v}-${jm}.mp3`;if(b){fs.writeFileSync(path.join(out,f),b);ok++;console.log('ok',f,b.length,'model',MODEL)}else console.log('nepovedlo se',f)}
  console.log('ukázek:',ok);process.exit(ok?0:2)}
 const TEXT='Tady Pan Radar. Dvaapadesát obcí, každá sama za sebe. Co kdyby se Říčansko osamostatnilo? Mnichovice mají čtyřicet obyvatel, Strančice třicet osm. Tak co, Strančice? Zítra den osmý. Pan Radar končí hlášení.';
 const voices=(process.env.HLASY||'Sadaltager').split(',');const tempa=(process.env.TEMPA||'1,1.12,1.25').split(',').map(Number);let ok=0;
 for(const v of voices)for(const tp of tempa){const b=await tts(TEXT,{voice:v.trim(),tempo:tp});const f=`gemini-${v.trim()}-rychle${tp===1?'':'-'+Math.round(tp*100)}.mp3`;if(b){fs.writeFileSync(path.join(out,f),b);ok++;console.log('ok',f,b.length)}else console.log('nepovedlo se',f)}
 console.log('model:',MODEL,'ukázek:',ok);process.exit(ok?0:2)})()}
