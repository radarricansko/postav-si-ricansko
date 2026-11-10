#!/usr/bin/env node
/* Pan Radar přes Google Gemini TTS (zdarma v AI Studiu). Výstup: PCM 24 kHz -> mp3 přes ffmpeg.
   node tools/hlas/gemini.js nahledy [--out out]         -> out/gemini-<hlas>.mp3 pro několik hlasů
   Jako modul: require('./gemini').tts(text,{voice,style}) -> Buffer s mp3 (nebo null) */
const fs=require('fs'),path=require('path'),{spawnSync}=require('child_process');
const KEY=process.env.GEMINI_API_KEY;
const STYLE='Čti česky jako starý, klidný a laskavý vypravěč s hlubokým, trochu chraplavým hlasem. Pomalu, zřetelně, s lehkým tajemnem, jako děda u kamen:';
const MODELS=(process.env.GEMINI_TTS_MODEL?[process.env.GEMINI_TTS_MODEL]:[]).concat(['gemini-2.5-flash-preview-tts','gemini-2.5-pro-preview-tts','gemini-2.5-flash-tts']);
let MODEL=null;
async function call(model,text,voice){const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,{method:'POST',headers:{'x-goog-api-key':KEY,'content-type':'application/json'},
  body:JSON.stringify({contents:[{parts:[{text}]}],generationConfig:{responseModalities:['AUDIO'],speechConfig:{voiceConfig:{prebuiltVoiceConfig:{voiceName:voice}}}}})});
 const t=await r.text();let j=null;try{j=JSON.parse(t)}catch(e){}return{ok:r.ok,status:r.status,j,t}}
async function findModels(){try{const r=await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200',{headers:{'x-goog-api-key':KEY}});const j=await r.json();return (j.models||[]).map(m=>m.name.replace('models/','')).filter(n=>/tts/i.test(n))}catch(e){return[]}}
function toMp3(pcm,rate){const r=spawnSync('ffmpeg',['-v','error','-f','s16le','-ar',String(rate),'-ac','1','-i','pipe:0','-af','loudnorm=I=-16:TP=-1.5','-ar','44100','-b:a','160k','-f','mp3','pipe:1'],{input:pcm,maxBuffer:1<<28});if(r.status!==0)console.error('ffmpeg selhal:',r.error?r.error.message:String(r.stderr).slice(0,200));return r.status===0?r.stdout:null}
async function tts(text,opt={}){if(!KEY)return null;const voice=opt.voice||process.env.GEMINI_VOICE||'Charon';const full=(opt.style===''?'':(opt.style||STYLE)+' ')+text;
 let list=MODEL?[MODEL]:MODELS;for(let pass=0;pass<2;pass++){for(const m of list){for(let a=0;a<3;a++){const r=await call(m,full,voice);
    if(r.ok){const p=(((r.j.candidates||[])[0]||{}).content||{}).parts||[];const d=p.find(x=>x.inlineData);if(!d){console.error('gemini: bez zvuku',String(r.t).slice(0,200));break}
     MODEL=m;const rate=+((d.inlineData.mimeType||'').match(/rate=(\d+)/)||[])[1]||24000;return toMp3(Buffer.from(d.inlineData.data,'base64'),rate)}
    if(r.status===429||r.status>=500){console.error('gemini',m,r.status,String(r.t).slice(0,160).replace(/\s+/g,' '));await new Promise(z=>setTimeout(z,8000*(a+1)));continue}
    console.error('gemini',m,r.status,String(r.t).slice(0,200));break}}
  if(pass===0&&!MODEL){list=(await findModels()).filter(x=>!MODELS.includes(x));if(!list.length)break;console.log('gemini: zkouším modely',list.join(', '))}}
 return null}
module.exports={tts};
if(require.main===module){(async()=>{if(!KEY){console.error('chybí GEMINI_API_KEY');process.exit(1)}
 const i=process.argv.indexOf('--out');const out=i>0?process.argv[i+1]:'out';fs.mkdirSync(out,{recursive:true});
 const TEXT='Tady Pan Radar. Padesát dva obcí, každá sama za sebe. Co kdyby se Říčansko spojilo v jedno město? Mnichovice mají čtyřicet obyvatel, Strančice třicet osm. Tak co, Strančice? Zítra den osmý. Pan Radar končí hlášení.';
 const voices=(process.env.HLASY||'Charon,Algenib,Gacrux,Sadaltager,Rasalgethi').split(',');let ok=0;
 for(const v of voices){const b=await tts(TEXT,{voice:v.trim()});if(b){fs.writeFileSync(path.join(out,`gemini-${v.trim()}.mp3`),b);ok++;console.log('ok',v,b.length)}else console.log('nepovedlo se',v)}
 console.log('model:',MODEL,'ukázek:',ok);process.exit(ok?0:2)})()}
