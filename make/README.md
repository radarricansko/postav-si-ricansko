# Postav si Říčansko – Make → GitHub (noční návrh)

Stav k 5. 11. 2026. Nic není zapnuté ani spuštěné, na Instagram se nic neposlalo, existující scénáře jsem neměnil.

## Co v Make vzniklo (tým „My Team“ 2022233, eu1)

| Věc | ID | Stav |
|---|---|---|
| Scénář **[NÁVRH] Postav si Říčansko – komentáře → world.json** | **8385083** | neaktivní, chybí webhook a connection |
| Data store **postav_hraci** (1 MB) | **246350** | prázdný, struktura 681250 |
| Data store **postav_obce** (1 MB) | **246351** | prázdný, struktura 681251 |

Existující data store `radar-videne-clanky` i všechny scénáře RADAR BOT zůstaly beze změny. Nové názvy s ničím nekolidují.

Soubory v této složce:
- `blueprint.json`: přesně to, co je ve scénáři 8385083. Když se scénář smaže, dá se z něj znovu naimportovat.
- `world.schema.json` a `world.sample.json`: datový model a vzorek s 5 obcemi a vymyšlenými hráči `hrac_01`–`hrac_09`. Vzorek prošel validací proti schématu.
- `obce.json`: 52 obcí ORP Říčany, každá má `id` (slug) a 208 aliasů celkem.

## Jak tok funguje

```
IG webhook „nový komentář“ (instagram-business:NewComment)
  │ filtr: media.id = herní post, jen komentář nejvyšší úrovně (ne odpověď), ne @radar_ricansko
  ▼
[2] Set variables: normalizace textu + switch(alias → obec_id), ig_norm
  │ filtr: obec_id není prázdné, username neodpovídá blocklistu
  ▼
[3] Data store postav_hraci GET (klíč = IG user id)
  │ filtr: záznam neexistuje (jeden hráč = jedna obec, deduplikace)
  ▼
[4] Data store postav_obce GET (klíč = obec_id) → číslo obyvatele = pocet_hracu + 1
[5] Parse JSON: složí objekt hráče a událost pro log
[6] postav_hraci ADD (overwrite = false)
[7] postav_obce ADD/replace (hraci += nový hráč, pocet_hracu + 1)
[8] postav_obce SEARCH všechny → [9] Array aggregator → obce[]
[10] HTTP GET api.github.com/repos/radarricansko/postav-si-ricansko/contents/world.json (kvůli sha a den_hry/navrhy_dne/logu)
[11] Parse JSON (base64 → JSON) → [12] Transform to JSON (nový world.json)
[13] HTTP PUT …/contents/world.json  {message, content: base64, sha, branch: main}
```

Scénář má zapnuté **sekvenční zpracování**. Bez něj by dva komentáře ve stejnou chvíli způsobily konflikt `sha` na GitHubu (chyba 409) a mohla by vzniknout dvě stejná čísla obyvatele.

**Zdroj pravdy je data store, `world.json` je jen výstup.** Speciální budovy se zapisují do `postav_obce.specialni_budovy` (ručně v Make). `den_hry` a `navrhy_dne` Make přebírá z aktuálního souboru na GitHubu, takže je můžeš měnit přímo v repu. Log drží posledních 200 událostí.

## Pravidla hry v automatu

- **Normalizace:** malá písmena, bez diakritiky (`ascii(…; true)`). Odstraní se @zmínky a URL a všechno kromě a–z, 0–9 a mezer. Smažou se úvodní slova „jsem / hraju za / obec / město / z / ze / za / v / ve“ a sloučí se mezery. Výsledek se porovná přesnou shodou se seznamem aliasů v `obce.json`.
- **Aliasy** pokrývají 2. a 6. pád („z Říčan“, „v Mnichovicích“), časté překlepy (rycany, mukarow, mnichovyce), zkratky (KNCL, „kostelec ncl“) a varianty „u Prahy / u Říčan“. Samotné „Kostelec“ je **záměrně nejednoznačné**, takový komentář projde bez reakce.
- **Omezení:** komentář musí obsahovat jen název obce (emoji nevadí). Text „Mukařov 🔥 jdeme do toho“ neprojde. Kdyby to vadilo, dá se do modulu 2 doplnit druhý pokus nad prvními 1–3 slovy. Skutečné fuzzy hledání (Levenshtein) Make bez kódu neumí.
- **Jeden hráč = jedna obec:** klíč je IG user id (stabilní i po změně username). Platí první platný komentář. Další komentáře téhož člověka se ignorují (stojí 3 operace).
- **Změnu obce** zatím dělá Radar ručně po DM: v `postav_hraci` přepsat `obec_id` a v `postav_obce` přesunout hráče mezi obcemi. Později se dá udělat přes Telegram bota (RADAR BOT2).
- **Filtr nevhodných jmen** je regex nad usernamem: `kurv|pic[ae]|kokot|curak|zmrd|mrd|debil|hitler|nazi|negr|cigan|buzn|porn|fuck|shit|hovn|prdel|sex|onlyfans`. Je to startovní seznam, rozšiř ho podle potřeby. Stejný filtr použij i na texty cedulí speciálních budov.

## Co musí Maty ráno udělat ručně

1. **GitHub:** vytvořit repo `radarricansko/postav-si-ricansko` a do `main` dát `world.json` jako minimální platný soubor, např. `{"verze":1,"revize":0,"den_hry":1,"aktualizovano":"2026-11-05T00:00:00Z","obce":[],"navrhy_dne":[],"log_udalosti":[]}`. Bez souboru vrátí GET 404 a scénář spadne. K tomu nahrát `obce.json`.
2. **Hosting:** GitHub Pages z **privátního** repa na free účtu nejde (potřebuje Pro/Team). Možnosti: repo zveřejnit, nebo stránku hostovat na Cloudflare Pages / Netlify / Vercel napojeném na privátní repo (zdarma). Pozor: `world.json` na veřejné stránce ukazuje IG usernamy hráčů, mezi nimi i lidí od 13 let. Do pravidel hry napiš, že se username zobrazí, a zvaž, jestli na webu nezobrazovat jen číslo obyvatele.
3. **GitHub token:** fine-grained PAT jen pro toto repo, oprávnění *Contents: Read and write*, s expirací.
4. **Make: HTTP connection** v modulech 10 a 13. Typ „API key“: hlavička `Authorization`, hodnota `Bearer <token>`, povolená URL `https://api.github.com/`. Token nevkládej jako text do hlaviček modulu.
5. **Make: Instagram connection + webhook** v modulu 1. Vytvoř webhook → přihlas se Facebook účtem s admin právy ke stránce propojené s @radar_ricansko (musí jít o Business účet, Creator nefunguje).
6. **Herní post:** v filtru před modulem 2 nahradit `DOPLNIT_ID_HERNIHO_PRISPEVKU` za ID příspěvku (zjistíš ho modulem „Get post“ nebo „List posts“).
7. **Test:** spustit „Run once“ a z druhého účtu napsat komentář (např. „Mukařov“). Zkontrolovat záznamy v data storech a commit v repu. Hlavně ověřit, že `obce`, `den_hry` a `log_udalosti` mají v JSON správné typy (pole a čísla, ne text). Pokud ne, upravit mapování v modulu 12.
8. Teprve potom scénář **zapnout**.

## Ověření follow

Meta API **neumí** vypsat followery ani zjistit, jestli konkrétní komentující sleduje účet. Webhook komentáře follow nenese. Praktický postup:

- **Teď (bez práce navíc):** hráč dostane domek hned (`follow_overeno = false`). Pravidla na postu: „Domek platí jen pro sledující @radar_ricansko, kontrolujeme každou neděli.“
- **Týdenní kontrola (poloautomat):** IG → Nastavení → Vaše aktivita → Stáhnout informace → *Followers and following*, ve formátu JSON. Soubor `followers_1.json` porovnat s `postav_hraci`. Na tohle napíšu skript nebo malý scénář, který nastaví `follow_overeno` a odznak `follow_overen`. Domky nesledujících pak dostanou stav „opuštěný“. Hráče nemazat, dát jim šanci.
- **Bot odpověď „dej follow“** jde automatizovat modulem *Create a reply* (instagram-business:CreateComment) za modul 7. Do návrhu jsem ji **nedal**, protože by to bylo veřejné posílání na IG. Jde o 1 operaci navíc na hráče.
- **Plně automaticky (pokročilé):** hráč pošle DM „domek“ a Instagram Messaging API (User Profile) vrátí `is_user_follow_business`. Funguje to jen pro lidi, kteří účtu napsali DM, a vyžaduje to oprávnění `instagram_manage_messages` (HTTP volání Graph API, v Make IG aplikaci modul není). Zároveň by se tak dala řešit změna obce přes DM.

## Limity Meta API

- Webhook chodí jen pro komentáře na médiích vlastního Business účtu, ne pro odpovědi ve vláknech (ty filtrujeme) a ne u soukromého účtu. Doručení může mít zpoždění a výjimečně se ztratí. Záloha: modul *List post comments* nad herním postem spuštěný ručně (dohledá zmeškané komentáře).
- **Webhook chodí pro komentáře pod VŠEMI posty** a každý stojí 1 operaci, i když ho filtr hned zahodí.
- Graph API má limit zhruba 200 volání za hodinu na účet. Tohle řešení Graph API nevolá, kromě případné odpovědi botem.
- Insights a data o followerech jsou jen agregované. Seznam followerů API nevrací.

## Odhad operací (plán Core ≈ 10 000 kreditů měsíčně)

Stávající scénáře podle statistik spotřebují zhruba 110 operací denně, tedy asi 3 300 měsíčně. Na hru zbývá zhruba **6 500 měsíčně, asi 200 denně**.

| Událost | Operace |
|---|---|
| komentář pod jiným postem | 1 |
| komentář pod herním postem, ale ne obec | 2 |
| hráč už existuje | 3 |
| **nový hráč** (zápis + přegenerování world.json) | **13** |

- Běžný den (10 nových hráčů, 10 duplicit, 30 jiných komentářů) ≈ 190 operací, tedy na hraně.
- Spuštění hry (150 hráčů za den) ≈ 2 100 operací. Při velkém zájmu Core nevystačí.
- **Úsporná varianta (doporučuju před spuštěním):** moduly 8–13 přesunout do druhého scénáře, který běží každé 2 hodiny v době 8–23 h (~50 operací denně). Nový hráč pak stojí jen 7 operací. Případně dokoupit kredity.
