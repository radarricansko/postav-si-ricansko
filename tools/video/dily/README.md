# Díly podle scénáře

Každý díl je jeden soubor `dil-N.json`: seznam záběrů. Jedna věta Pana Radara = jeden záběr.

```json
{ "vo": "Je nás {{pocet}}.",
  "cam": { "at": "lm:{{top1}}", "from": [420, 0.8, 0.3], "to": [300, 0.62, 0.7] },
  "ui": [ { "k": "num", "num": "{{pocet}}", "label": "obyvatel", "y": 560, "at": 100 } ] }
```

- `vo` = co řekne hlas (z toho se dělají i titulky; `noSubs: true` je vypne, když je věta už na obraze).
- `cam.at` = kam kamera míří: `center` (Náměstí sjednocení), `lm:Obec` (náves), `slot:Obec:0` (domek), `stavba:Obec` (poslední stavba). `from` → `to` = [vzdálenost, výška úhlu, směr], kamera mezi nimi pomalu jede.
- `ui` = co je přes obraz: `title`, `chip`, `stamp`, `num`, `bubble` (komentář), `tag` (jmenovka), `flag` (státní vlajka), `end` (závěrečná karta). `at` = kdy naskočí (ms od začátku záběru).
- `cam.in` = rychlý nájezd kamery (ms), potom pomalý dojezd. Bez něj kamera jede plynule celou dobu.
- `walk` = postavičky s jmenovkou dojdou ke svému domku a ten se postaví: `{ "town": "Mukařov", "n": 4, "at": 150, "every": 420, "ms": 1700, "nicks": ["@bara", …] }`.
- `flags` = státní vlajky vyjedou na stožáry: `{ "at": 150, "ms": 1700 }`.
- `add` = domky jen naskočí (bez postaviček). `kdyz: "klíč"` = záběr se vypustí, když údaj chybí.
- Čísla v kartách `num` se sama roztočí od nuly.
- `"hudba": "lofi"` na začátku scénáře = podkres dílu (`lofi`, `funk`, `minimal`, `trap`, `puvodni`, `bez`).

Hlas: celý text se namluví na jeden zátah s dlouhými pauzami mezi řádky, podle nich se rozstříhá na záběry a ticho se ořízne. Bezplatný tarif Gemini má malý denní strop dotazů, proto jeden dotaz na díl. S placeným tarifem jde zapnout přesnější režim (proměnná `HLAS_REZIM` = `vety`, každá věta zvlášť).

## Proměnné `{{…}}`

Dosazují se samy z `world-dil.json` (stav k uzávěrce) a z posledních výsledků hlasování `tools/ig/navrhy/DATUM.json`:

`pocet`, `novych`, `obci_zivych`, `prazdnych`, `prazdna` (každý díl jiná), `top1`–`top3` + `_n`, `rozdil_txt`, `zakl_obec`, `zakl_1`–`zakl_3`, `derby_a`, `derby_b`, `derby_rozdil_txt`, `stat`, `stavba`, `stavba_obec`, `stavba_autor`, `hlas_nazev`, `hlas_vlajka`, `hlas_napad`, `hlas_mena`, `hlas_jidlo` (+ `_autor`), `komentar`, `komentar_autor`.

U nicků existuje i tvar pro hlas bez zavináče a podtržítek: `{{zakl_1_hlas}}`.

Co se dosadí, vypíše: `node tools/video/dil-data.js --dil 3`.

## Výroba

- **Večer:** Actions → „Díl (rychlý render po částech)“ → Run workflow → `dil` = číslo. Šest strojů kreslí zároveň, hotovo je zhruba za 20 minut. Video je pak ve větvi `previews`: `nahledy/dil-N.mp4`.
- **Zkouška nanečisto:** totéž se zaškrtnutým `zkouska` (vymyšlená data, žádný Instagram).
- **Náhled bez hlasu (snímky po půl vteřině):** `node tools/video/render.js --dil 3 --sheet`.
- **Nanečisto bez Instagramu:** `--data tools/video/dily/zkouska-svet.json --navrhy tools/video/dily/zkouska-navrhy.json` (64 vymyšlených lidí, stát „Radarie“, stavba, měna, jídlo).
- Díl 7 má dva konce: `dil-7.json` (konec) a `dil-7b.json` (pokračování), spouští se jako `dil` = `7` nebo `7b`.
