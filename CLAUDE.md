# Postav si Říčansko: pracovní příručka pro Clauda

Instagramová hra RADARu Říčansko (regionální médium pro mladé, Radar s.r.o.). Sledující napíšou do komentáře svou obec (52 obcí ORP Říčany) a dostanou domek s nickem na 3D mapě. Příběh vypráví Pan Radar. Majitel projektu: Maty Fořt (Matyáš). Komunikace česky, stručně, přirozeně, bez formálností.

## Nejdřív přečti
- `docs/pribeh-hry.md` — příběh, denní rytmus, plán dílů (verze 4, **příběh se ještě mění**: kolegové říkají, že "odtržení od Česka" je moc politické a má to být zábavnější; příběh se vymýšlí s Matym, neměň ho sám)
- `tools/video/dily/README.md` — scénáře dílů, styl `v2`, proměnné
- `tools/ig/README.md` — zpracování komentářů
- `docs/spusteni.md` — spuštění

## Pevná pravidla (platí vždy)
- **Žádné tajné klíče v chatu ani v repu.** Jen GitHub Secrets: `ELEVENLABS_API_KEY`, `GEMINI_API_KEY`, `IG_TOKEN`. Gemini klíč, který byl jednou vložen do chatu, se nepoužívá.
- **Nic nepublikuju na Instagram.** Postuje člověk.
- **Žádná skutečná politika.** Hra je fikce. Žádné strany, starostové ani radnice v obsahu. (Maty je zastupitel, riziko je reálné.)
- Neprovádím účty, souhlasy s podmínkami, hesla ani tokeny. To dělá Maty.
- Make: scénáře zůstávají **neaktivní**; nesahat na scénáře RADAR BOT ani na data store `radar-videne-clanky`.
- Do Make a GitHubu šahám bez ptaní na povolení (Maty to výslovně dovolil). Placené věci (Higgsfield jeho kredity, placený Gemini) jen s jeho výslovným souhlasem.
- Administrační odkaz (`?admin=…`) se nesdílí veřejně a nepíše se do veřejných textů.
- Maty chce stav v chatu a kritické sebehodnocení práce (ne jen "hotovo").

## Rozhodnutí, která platí
- **Denní rytmus:** díl v 9:00; 9–17 komentáře a hlasy; 17:00 uzávěrka; 17–20 Maty + Claude vybírají vítěze a staví do mapy; mapa se překlopí najednou s dalším dílem. Follow se neověřuje (na důvěru). Jeden účet = jeden domek. Komentáře se čtou pod všemi díly.
- **Mapa:** přijatá ("zatím nejideálnější"). Čeká se max. ~2 000 lidí, nepřekomplikovat. Mlha zůstává ve hře. Náměstí sjednocení zůstává.
- **Hlas:** Gemini Sadaltager "živě" zůstává. Tarify: jen jména. Jeden dotaz na díl (bezplatná kvóta je malá).
- **Hudba:** vybíráme spolu s Matym, ne v Instagramu.
- **Koruna** = největší obec. Každý díl vyzve jednu prázdnou obec.
- **Zápis hlasů:** `název - …`, `vlajka - symbol, barvy`, `nápad - …`, `měna - …`, `jídlo - …`.

## Technika
- Hra: Three.js r128, `web/` (`game.js`, `hero.js`, `reel.js`, `namesti.js`). GitHub Pages.
- Komentáře: `node tools/ig/komentare.js`, testy `node tools/ig/test.js` (musí projít všech 20).
- Video: `tools/video/render.js` (`--dil N`, `--sheet`, `--od/--do`, `--sfps`, `--query`, `--part k/P`), scénáře `tools/video/dily/dil-N.json`.
- Render dílu v cloudu: `gh api -X POST repos/radarricansko/postav-si-ricansko/actions/workflows/dil.yml/dispatches -f ref=main -f 'inputs[dil]=1'` (příkaz `gh workflow run` je blokovaný). Hotové video je ve větvi `previews` jako `nahledy/dil-N.mp4`; stáhni `git fetch origin '+refs/heads/previews:refs/remotes/origin/previews'`. Trvá ~20 min.
- Snímky hry lokálně jsou pomalé (swiftshader): pouštěj na pozadí a čekej.
- Commity: autor "RADAR Říčansko", s trailery Co-Authored-By a Claude-Session.

## Stav videí (důležité)
- Maty: videa byla "hrozně slabá". Hlavní příčiny, které se ukázaly až na skutečné grafice (17. 11.): záběry zblízka byly rozmazané (tilt-shift naplno), stíny na detailním domku rozpité (velký výřez stínové mapy), cloud kreslí v polovičním rozlišení.
- **Režie v prohlížeči** (`web/rezie.js`, `?admin=KLÍČ&rezie=N`): díl se v Chromu vyrobí snímek po snímku v 1080×1920 / 30 fps za zhruba minutu (WebCodecs + mp4-muxer). Umí čisté záběry bez textů a ztlumený hlas se zachovaným časováním. Tohle je hlavní cesta; cloud (`dil.yml`) dodává hlas a balíček `nahledy/dil-N.rezie.json`.
- **Voiceover si tým přidává sám** ve střihu, neřešit. AI hlas je jen vodítko pro tempo. Trendy zvuk (Timeless, Runaway…) se přidává až v Instagramu; do souboru chráněnou hudbu nevkládat.
- Varianty dílu 1: `dil-1` (dům, příběh se státem), `dil-1b` (rychlá), `dil-1c` (bez státu), `dil-1d` (verze komise: jedna výzva „napiš obec“, háček „JSI Z ŘÍČANSKA?“, asi 24 s). Vzory: reels @nahotovo_mesto.
- Maty k první sadě: "záběry mapy se bugují". Příčiny: problikávání ploch (viz níže), ztmavnutí u každého střihu (ve stylu `v2` zrušeno, střihy jsou ostré) a panáček, který v dalším záběru znovu vyskočil (`pop:false`). Režie má kontrolu plynulosti (`REZIE.diag`): skok uvnitř záběru znamená chybu, výjimkou je nájezd závěrečné karty.
- Soubory z režie se jmenují `postav-si-ricansko-dil-N[-bez-hlasu|-ciste-zabery].mp4`; při nové sadě přidávám příponu verze (poslední je `-v7` pro 1, 1c, 1d a `-v5` pro 1b). Všechny tři soubory jedné varianty dělat z jednoho načtení stránky, ať mají stejné časování hlasu. Po každé změně vzhledu mapy je sada stará.
- Když mám propojený Matyho počítač a Chrome, můžu se na video i mapu dívat na skutečné grafice (snímky během přehrávání). Bez toho stavím naslepo.

## Vzhled mapy a výkon
- Vzhled 2 (výchozí od 17. 11.), po komisi: přirozená sytá zeleň, tráva se stébly (`bladesTex`), měkké skvrny (`softTex`, `groundPatch`) a plující stíny mraků (`cloudShade`) místo bílých obláčků, pole s řádky v klidnější paletě, voda s vlnkami a tmavým porostlým břehem, trávník obce s měkkým okrajem, teplý šedý asfalt s čárou jen na hlavních silnicích, domky s malým rozptylem natočení a výšky, stromy v obci ze stejné geometrie jako les a vysoké jako domek, erb živé obce roste s dálkou. Původní je `?vzhled=1`. Paleta je v `PAL` na začátku `game.js`.
- **Světlo:** součet světla na osluněné ploše držet pod zhruba 1,2 (teď slunce .76, obloha .66, slunce 40° nad obzorem). Výš se barvy v 8 bitech oříznou: střechy svítí oranžově, kostel je bílá plocha bez tvaru, tráva zežloutne do limetkova.
- Maty první verzi vzhledu 2 odmítl jako "zešedlou a nerealistickou" (bledá béžová paleta, šedý opar). Nevracet se k tlumeným barvám; sytost trávy nedávat pod zhruba 55 %.
- **Problikávání ploch:** pole, louky a lesy leží skoro ve stejné výšce. Proto `landMesh` nezapisuje hloubku a kreslí se v pevném pořadí (`renderOrder`), stejně břeh; bližší rovina kamery se posouvá s dálkou. Nové ploché vrstvy dělat stejně, ne přes drobné rozdíly ve výšce.
- **Problikávání země zblízka:** zem je obří plocha; ze dvou trojúhelníků vycházela hloubka zblízka nepřesně a tráva na jednotlivých snímcích zaplavila silnici a desku pod domkem. Dělo se to jen v softwarovém vykreslování (cloud, 14 % snímků záběrů domku), na M1 ne. Zem je proto dělená 64×64 (`GSEG`, `?zem=1` vrátí starý stav pro srovnání).
- Výkon: lesy po dlaždicích s ořezem a jednoduchými stromy v dálce; stíny domků, stromků a lamp jen do vzdálenosti 1000; na dotykových zařízeních poměr pixelů 1,5, stíny 1024 a bez vyhlazování plátna; automatické snižování kvality ignoruje snímky delší než 0,25 s (odskok do jiné aplikace). Změřeno komisí: s 2 000 hráči 4,9 mil. trojúhelníků na snímek, protože domky nemají ořez ani zjednodušení (otevřené, viz níže).
- Ladění na živém webu: `GAME.look()` vrací scénu, světla a materiály. Barvy jde zkoušet rovnou v Chromu a do kódu psát až výsledek.
- Knihovny three.js jsou ve `web/vendor/` (ne z CDN). `pages.yml` před nasazením kontroluje skripty, data a testy.

## Komise 17. 11. (pět nezávislých posudků)
Plné posudky jsou v projektu „RADAR AI Asistent“ jako `claude/postav-si-ricansko-komise.md`. Zapracováno je světlo a paleta, silnice, stromy, rozptyl domků, dělená zem, obrysy nadpisů, délky výzev a závěrečné karty, varianta `dil-1d`, odkaz pod díl (`dil_url` v `rozhodnuti.json`), hledání ve spodní liště, hlášky podle hodiny, zapamatovaný nick a `?nick=`, hláška při nenačtení, kontrola před nasazením, filtr parametrů adresy. **Otevřené (čeká na Matyho nebo na víc času):**
- překlápět mapu v 9:00 podle času, ne podle rozpoznání postu s hashtagem (teď 10–40 min zpoždění, bez hashtagu se nestane nic); hlídač v 9:30;
- hlášení chyb na Telegram se skutečnou chybou; týdenní prodloužení `IG_TOKEN`;
- komentáře a jména lidí se commitují do veřejného repa (`nerozpoznane.json`, `navrhy/`) a v historii zůstávají navždy;
- větev `previews` roste (stovky MB videí), přepisovat jedním commitem;
- domky: jednoduchá vzdálená podoba a sítě po obcích s ořezem (nutné pro 2 000 hráčů);
- vyhlazení zubatých silnic, meze mezi poli, víc typů domků, speciální budovy načítat až podle potřeby;
- karta domku (žargon „Zlatá obec“, „Status“), tlačítko „Sdílet můj domek“;
- nikdo neviděl hru na skutečném telefonu v prohlížeči Instagramu.

## Poučení
- **Commit jen po `node --check`** všech změněných souborů ve stejném příkazu spojeném `&&`. Jednou se takhle dostal na web rozbitý `game.js` (řádková poznámka `//` uprostřed jednořádkového kódu zakomentovala zbytek řádku).
- Po nasazení může prohlížeč držet starý `index.html`; při zkoušce přidej do adresy nový parametr (`&c=2`).
- **„Opraveno“ ověřuj na výstupu, který Maty opravdu vidí.** Na telefon mu chodí cloudové náhledy; ty blikaly, i když režie na Macu byla čistá. Cloudový náhled před odesláním projdi po snímcích (rozdíl sousedních snímků ve spodním pruhu), ne jen kontrolní list.
- Kontrola plynulosti v režii hlídá i pruh pod titulky (`kde:"dole"`); skok při 0,33 s je dopad zdi při stavbě domku, skoky na konci jsou nájezd závěrečné karty.
- Nezávislý posudek (víc pohledů najednou) našel během půl hodiny věci, které jsem přehlížel celý den. U větších celků si ho vyžádat dřív, než řeknu „hotovo“.

## Co funguje a co ne
- Funguje: krátký háček "Napiš svou obec a postavím ti tam dům", domek co se staví po kouskách, titulky slovo po slově, tichý střední blok, závěrečná karta s psaním komentáře.
- Nefunguje / otevřené: zlatý nadpis "PRVNÍCH 5" se špatně čte; tichý prostředek potřebuje hudbu; konec je klidnější; shoda hlasu se záběry nebyla ověřena sluchem.

## Inspirace: minimapa.cz (rozbor 17. 11.)
Skutečná data (výšky, OSM), jedna hlavní barva, minimum UI, počasí a roční období, úvodní přelet, deník a hodnosti (10/30/100/300/1000), tajné scény a zvířata, odkaz na konkrétní místo. Převzít jen mechaniky, ne koncept: naše mapa je hra, kde je každý domek něčí.

## Pořadí práce, když Maty není u toho
1. Čistší vzhled mapy (jedna hlavní barva, měkčí světlo, méně šumu), snímky před a po.
2. Úvodní přelet a krátký průvodce pro nové lidi z reelu.
3. Odkaz na domek `?nick=…` se zoomem a obrázkem ke sdílení.
4. Hodnosti u nicků (názvy doladí Maty).
5. Atmosféra: noc s okny, sníh, mlha podle ročního období (přepínač v administraci).
6. Tajné objekty a zvířata jako základ systému.
7. Zkouška celého večera nanečisto (komentáře → hlasy → mapa → díl).
8. Rychlejší načítání na mobilu.
9. Hotovo 17. 11.: uvítání, karta rozhodnutí, hláška hledání, líné načítání aut, hlídání komentářů, režie v prohlížeči, vzhled 2, výkon lesů.

## Co je "hotovo"
- Testy `node tools/ig/test.js` procházejí.
- Změnu jsem **viděl** (snímek před a po, na mobilním i širokém okně), ne jen napsal.
- Na kontrolu je shrnutí v chatu: co se změnilo, co ne, co mě na výsledku ještě trápí.
- Nic nerozbité, co už Maty schválil (mapa, hlas, Náměstí sjednocení).

## Pluginy v tomto projektu
`frontend-design`, `audit-suite` (vzhled, výkon, animace), `it-reelsmaker` (Remotion, titulky, 1080×1920), `social-media-skills` (hooky, scénáře reelů, příběh), `qa-my-app` (test v prohlížeči). Ke každému úkolu volím ten, který sedí; nevolám je naslepo.
