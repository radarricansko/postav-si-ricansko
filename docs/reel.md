# reel.js – denní reel „Postav si Říčansko“

Samostatný modul, který z běžící hry nahraje IG reel 9:16 (1080×1920, 30 fps, ~25–30 s).
Bez knihoven a bez bundleru. Všechno (grafika i titulky) se kreslí na 2D canvas, takže se to nahraje.

## Vložení do hry

```html
<!-- volitelně fonty (bez nich fallback na Inter/systémový) -->
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@600;700;800;900&display=swap" rel="stylesheet">
<script src="reel.js"></script>
```

Hra musí vystavit `window.GAME` (canvas s `preserveDrawingBuffer:true`, `state()`, `setAspect()`, `flyTo()`,
`focusTown()`, `focusHouse()`, `overview()`, `orbit()`, `addPlayers()`, `onFrame()`). Chybějící metody modul tiše přeskočí.

```js
const script = REEL.scriptFromDay({
  day: 7,
  newPlayers: [{ town: 'Mukařov', owner: 'terka', no: 112 }, …],
  topComment: { author: '@terka.zmukarova', text: 'Postavte rozhlednu…', likes: 87 /*, avatar: url */ },
  newBuilding: { town: 'Mukařov', name: 'Rozhledna Terky', type: 'tower' },   // nebo null
  expanded: false
}, { handle: '@radar_ricansko' });

document.body.appendChild(REEL.canvas);   // náhled (nebo předej opts.mount)
await REEL.play(script);                  // náhled s TTS hlasem
const blob = await REEL.record(script);   // video + hudba + efekty (+ voice track)
```

## API

| funkce | co dělá |
|---|---|
| `REEL.scriptFromDay(dayData, opts)` | Scénář: hook → přelet + počítadlo → top 2–3 obce → TOP KOMENTÁŘ a co se staví → CTA → outro. `opts`: `handle`, `towns` (počet obcí), `hookVariant` (0–2). |
| `REEL.play(script, opts)` | Náhled. Mluví přes `speechSynthesis` (cs-CZ, preferuje Zuzanu, Ivetu…), titulky jedou podle `onboundary`, scéna počká na doznění hlasu. |
| `REEL.record(script, opts)` → `Promise<Blob>` | `canvas.captureStream(30)` + MediaRecorder. Formát: mp4 (H.264), pokud ho prohlížeč umí, jinak webm. `blob.extension` = `mp4`/`webm`. |
| `REEL.voiceScript(script)` | `{text, srt, segments, plain}`: text voiceoveru s časy a titulky SRT. |
| `REEL.setVoiceTrack(AudioBuffer \| url \| Blob \| null)` | Namluvený hlas se přimíchá do nahrávky od času 0 a hudba se ztiší. TTS se pak nepoužije. |
| `REEL.stop()`, `REEL.canvas`, `REEL.snapshot()`, `REEL.mimeType()` | ovládání, výstupní canvas, PNG snímek, zvolený formát |

Společné `opts`: `mount` (element pro canvas), `tts` (true/false), `debugSafe` (ukáže IG safe zóny),
`subtitles:false`, `monitor:false` (nahrávat bez zvuku do repráků), `focusY` (y středu obce na obrazovce, default 1130),
`restoreAspect`, `bitrate`, `onFrame(t, scene)`.

Scénář je obyčejný objekt. Text (`scene.vo`) můžeš upravit ručně a pak zavolat `REEL.layout(script)`, které časy přepočítá.

## Voiceover (důležité)

`speechSynthesis` jde jen do reproduktorů a do MediaRecorderu se nenahraje. Proto:

1. **Nahrávka** (`record`) obsahuje syntetizovanou hudbu (124 BPM) a efekty (boom, whoosh, ping, ticky, popy) z WebAudio přes `MediaStreamDestination`.
2. **Text pro namluvení:** `REEL.voiceScript(script).text` (časy začátku a konce každé věty) nebo `.srt`. Vlož ho do CapCut TTS nebo ho namluv a v CapCutu dej pod video. Časy titulků ve videu odpovídají těmto časům.
3. **Hlas přímo ve videu:** namluv podle `voiceScript` (jedna stopa od 0 s), potom `await REEL.setVoiceTrack(soubor)` a `REEL.record(script)`. Hlas se smíchá do videa.

Tempo odhadu je asi 16 znaků/s. Když mluvíš pomaleji, zkrať `scene.vo`, nebo nastav `scene.durFixed` (ms) a zavolej `REEL.layout()`.

## Layout a safe zóny

Horních 220 px a spodních 380 px je bez důležitého textu. Badge RADAR je vlevo nahoře pod safe zónou,
spodní lišta „DEN 7 · POSTAV SI ŘÍČANSKO“ s progressem je těsně nad spodní safe zónou a titulky (2–4 slova, aktuální slovo žlutě) jsou nad ní.

## Test

`reel-test.html` obsahuje mock GAME (Three.js r128) a tlačítka Přehrát / Nahrát / Text voiceoveru / SRT.
`tools/shoot.js` je headless test v Playwrightu: screenshoty (`node shoot.js full`) a test nahrávání (`node shoot.js rec`).
Ukázky: `reel-hook.png`, `reel-counter.png`, `reel-obec.png`, `reel-top-komentar.png`, `reel-cta.png`, `reel-outro.png`.

Poznámka: Chromium bez proprietárních kodeků uloží mp4 s VP9/Opus. Instagram ho nemusí vzít.
V Google Chrome vznikne H.264. Jinak video převeď v CapCutu nebo přes `ffmpeg -i in.mp4 -c:v libx264 -c:a aac out.mp4`.
