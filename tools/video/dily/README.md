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
- `add` = přistaví domky během záběru. `kdyz: "klíč"` = záběr se vypustí, když údaj chybí.

## Proměnné `{{…}}`

Dosazují se samy z `world-dil.json` (stav k uzávěrce) a z posledních výsledků hlasování `tools/ig/navrhy/DATUM.json`:

`pocet`, `novych`, `obci_zivych`, `prazdnych`, `prazdna` (každý díl jiná), `top1`–`top3` + `_n`, `rozdil_txt`, `zakl_obec`, `zakl_1`–`zakl_3`, `derby_a`, `derby_b`, `derby_rozdil_txt`, `stat`, `stavba`, `stavba_obec`, `stavba_autor`, `hlas_nazev`, `hlas_vlajka`, `hlas_napad`, `hlas_mena`, `hlas_jidlo` (+ `_autor`), `komentar`, `komentar_autor`.

U nicků existuje i tvar pro hlas bez zavináče a podtržítek: `{{zakl_1_hlas}}`.

Co se dosadí, vypíše: `node tools/video/dil-data.js --dil 3`.

## Výroba

- **Večer:** Actions → „Denní reel a klipy“ → Run workflow → `dil` = číslo. Video je pak ve větvi `previews`: `nahledy/dil-N.mp4`.
- **Náhled bez hlasu (snímky po půl vteřině):** `node tools/video/render.js --dil 3 --sheet`.
- **Nanečisto bez Instagramu:** `--data tools/video/dily/zkouska-svet.json --navrhy tools/video/dily/zkouska-navrhy.json` (64 vymyšlených lidí, stát „Radarie“, stavba, měna, jídlo).
- Díl 7 má dva konce: `dil-7.json` (konec) a `dil-7b.json` (pokračování), spouští se jako `dil` = `7` nebo `7b`.
