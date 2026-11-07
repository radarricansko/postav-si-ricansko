# Automatický denní reel

Každý den v 5:30 (nebo ručně v GitHubu: Actions → „Denní reel“ → Run workflow) se z aktuálního `world.json` vyrenderuje reel 9:16
(1080×1920, H.264) a uloží jako artefakt běhu (Actions → běh → „reel“). Volitelně se pošle do Telegramu.

## Co nastavit

| kde | co | proč |
|---|---|---|
| Settings → Secrets → Actions | `ELEVENLABS_API_KEY` | hlas (bez něj video jen s hudbou + text v .txt/.srt) |
| Settings → Variables → Actions | `ELEVENLABS_VOICE_ID` | ID hlasu z ElevenLabs Voice Library (není tajné) |
| Secrets | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | doručení videa na mobil (bot od @BotFather, chat_id zjistíš přes @userinfobot) |

## Lokálně

```
npm i playwright && npx playwright install chromium
node tools/video/render.js --out out --day 7
```

## Klipy pro střih jinde (cesta C)

Druhý job „klipy“ vyrenderuje surové záběry dne (9:16, bez grafiky, `klip-NN-*.mp4`) a `brief.md` / `brief.json`
s kontextem (co klip ukazuje, čísla, návrh voiceoveru, pořadí). Artefakt běhu „klipy“. Lokálně:
`node tools/video/clips.js --out out/klipy --day 7 --max 7`.
