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

### Styl `v2` (díl 1 od 11. 11.): pořád se něco děje, málo střihů

Na začátku scénáře `"styl": "v2"`: titulky naskakují slovo po slově (nejvýš tři najednou), vlevo nahoře štítek `badge` („DÍL 1“). `"tempo": 1.15` zrychlí hlas.

- `"hero": { "town": "Říčany", "slot": 0 }` na začátku scénáře = detailní domek pro záběry zblízka (`web/hero.js`) na místě domku obce.
- V záběru `"hero": { "build": { "at": 0, "ms": 3000 } }` = domek se složí po kouskách; `"walk": { "path": [[x,z],…], "ms": 2500, "wave": 2600, "face": [x,z] }` = panáček dojde a zamává. Souřadnice jsou místní: střed domku [0,0], dveře míří k +z, ulice je kolem z = 5.
- `cam` u domku: `{ "hero": true, "p0": [x,y,z], "l0": […], "p": […], "l": […] }` = odkud a kam se kamera dívá (místní souřadnice domku).
- `"cut": false` v `cam` = bez střihu, kamera plynule pokračuje z místa, kde je. `"hard": true` = ostrý střih bez zatmívačky (rychlé střídání).
- `"head": "KOMENTÁŘ = DŮM"` = velký nadpis nahoře (`|` = nový řádek, `headColor`). Drží přes sousední záběry se stejným textem.
- Záběr bez `vo` s `"dur": 2300` = tichý záběr (jen nadpis a obraz).
- `ui`: `herotag` (jmenovka nad panáčkem `on: "man"` / domkem `on: "house"`, `badge` = zlatý štítek, `keep` = nezhasíná na konci záběru), `cards` (kartičky komentářů s lajky + `stamp`), `endq` (závěrečná karta s otázkou `q` a psaním komentáře `type`).

Hlas: celý text se namluví na jeden zátah s dlouhými pauzami mezi řádky, podle nich se rozstříhá na záběry a ticho se ořízne. Bezplatný tarif Gemini má malý denní strop dotazů, proto jeden dotaz na díl. S placeným tarifem jde zapnout přesnější režim (proměnná `HLAS_REZIM` = `vety`, každá věta zvlášť).

## Režie v prohlížeči (rychlá výroba v plné kvalitě)

Adresa: `…/postav-si-ricansko/?admin=KLÍČ&rezie=N` (N = číslo dílu, třeba `1`, `1b`, `7b`). Otevři v Chromu na počítači.

- **Přehrát** = náhled v reálném čase.
- **Vyrobit video** = snímek po snímku na grafice počítače: MP4 1080×1920, 30 snímků za vteřinu, se zvukem. Díl 1 trvá zhruba minutu (cloud 20–30 minut a poloviční rozlišení).
- **Čisté záběry** = jen obraz hry bez textů, titulků a zvuku, pro vlastní střih.
- **Hlas:** AI hlas / ztlumený (délky záběrů zůstávají podle AI hlasu, hodí se jako podklad pod vlastní voiceover) / bez hlasu (délky podle textu).
- **Hudba:** vlastní podkresy nástroje (`lofi`, `funk`, `minimal`, `trap`, `puvodni`, `bez`). Zvuk z Instagramu se přidává až při publikování.

Odkud se bere díl: workflow „Díl“ uloží do větve `previews` balíček `nahledy/dil-N.rezie.json` (scénář s dosazenými čísly, hlas po větách, stav světa). Bez něj režie napíše, že díl ještě není.

Varianty dílu 1: `dil-1.json` (dům, podkres lofi), `dil-1b.json` (rychlá verze, ~19 s), `dil-1c.json` (bez státu a odtržení: „Co postavíme jako první?“).

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

## Po komisi 17. 11.
- `dil-1d.json`: verze podle posudku komise. Jedna výzva (napiš obec), háček „JSI Z ŘÍČANSKA?“, pět obcí po 0,7 s pod nadpisem „ODKUD JSI?“, kartičky nad prázdnou obcí, závěrečná karta „Z jaké jsi obce?“. Asi 24 s.
- Nadpisy (`head`) mají tmavý obrys, takže jdou číst i přes světlé věže a střechu; `headColor` už kvůli čitelnosti není potřeba.
- `"headAt": -600` u prvního záběru: nadpis je vidět od nultého snímku (náhled v mřížce profilu).
- Záběr s výzvou (štítky „tvoje obec“ apod.) má mít `"dur"` aspoň 2600, záběr s kartičkami (`cards`) aspoň 3000, závěrečná karta aspoň 4200. U záběru s větou je `dur` nejkratší délka.
- Montáž obcí: nejmíň 700 ms na obec a krátké názvy; štítek `size` kolem 70.
- Hudba je v záběrech bez věty hlasitější (dřív tichý blok působil jako výpadek zvuku).
- Závěrečná karta má pole široké 800 px, pravý okraj nezasahuje pod ikony Instagramu.
