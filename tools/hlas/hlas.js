#!/usr/bin/env node
/* Pan Radar – vlastní hlas přes ElevenLabs Voice Design (funguje i na bezplatném tarifu, hlas je náš, ne z knihovny).
   node tools/hlas/hlas.js nahledy [--popis "..."]   -> out/hlas-1.mp3 … + out/hlas.json (generated_voice_id)
   node tools/hlas/hlas.js ulozit --id <generated_voice_id> [--jmeno "Pan Radar"] -> vypíše voice_id */
const fs=require('fs'),path=require('path');
const arg=(k,d)=>{const i=process.argv.indexOf('--'+k);return i>0&&process.argv[i+1]?process.argv[i+1]:d};
const KEY=process.env.ELEVENLABS_API_KEY;if(!KEY){console.error('chybí ELEVENLABS_API_KEY');process.exit(1)}
const POPIS=arg('popis','')||'An old Czech man in his seventies, a calm and warm storyteller with a slightly raspy, deep voice. He speaks slowly and clearly in native Czech with a gentle, wise and a little mysterious tone, like a grandfather narrating a legend by the fireplace. Studio quality, close microphone.';
const TEXT=arg('text','')||'Tady Pan Radar. Padesát dva obcí, každá sama za sebe. Co kdyby se Říčansko spojilo v jedno město? Mnichovice mají čtyřicet obyvatel, Strančice třicet osm. Tak co, Strančice? Zítra den osmý. Pan Radar končí hlášení.';
const H={'xi-api-key':KEY,'content-type':'application/json'};
async function post(url,body){const r=await fetch(url,{method:'POST',headers:H,body:JSON.stringify(body)});const t=await r.text();let j=null;try{j=JSON.parse(t)}catch(e){}return{ok:r.ok,status:r.status,j,t}}
(async()=>{const out=arg('out','out');fs.mkdirSync(out,{recursive:true});const akce=process.argv[2];
 if(akce==='nahledy'){
  let r=null;const tries=[['https://api.elevenlabs.io/v1/text-to-voice/design',{voice_description:POPIS,text:TEXT,model_id:'eleven_ttv_v3'}],
   ['https://api.elevenlabs.io/v1/text-to-voice/design',{voice_description:POPIS,text:TEXT,model_id:'eleven_multilingual_ttv_v2'}],
   ['https://api.elevenlabs.io/v1/text-to-voice/create-previews',{voice_description:POPIS,text:TEXT}]];
  for(const [u,b] of tries){r=await post(u,b);console.log('pokus',u.split('/').pop(),b.model_id||'',r.status);if(r.ok&&r.j&&r.j.previews)break;console.log(String(r.t).slice(0,300))}
  if(!r.ok||!r.j||!r.j.previews){console.error('Voice Design se nepovedl');process.exit(2)}
  const list=r.j.previews.map((p,i)=>{const f=`hlas-${i+1}.mp3`;fs.writeFileSync(path.join(out,f),Buffer.from(p.audio_base_64,'base64'));return{soubor:f,id:p.generated_voice_id}});
  fs.writeFileSync(path.join(out,'hlas.json'),JSON.stringify({popis:POPIS,text:TEXT,nahledy:list},null,1));console.log(JSON.stringify(list,null,1))}
 else if(akce==='ulozit'){const id=arg('id');if(!id){console.error('chybí --id');process.exit(1)}
  const r=await post('https://api.elevenlabs.io/v1/text-to-voice',{voice_name:arg('jmeno','Pan Radar'),voice_description:POPIS,generated_voice_id:id});
  console.log('ulozit',r.status,String(r.t).slice(0,400));if(!r.ok)process.exit(2);console.log('VOICE_ID='+r.j.voice_id);fs.writeFileSync(path.join(out,'voice_id.txt'),r.j.voice_id)}
 else{console.error('použití: nahledy | ulozit --id …');process.exit(1)}})();
