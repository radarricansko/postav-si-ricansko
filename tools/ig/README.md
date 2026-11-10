# Komentáře → world.json (bez Make)

`komentare.js` každých 30 minut (workflow `.github/workflows/komentare.yml`) stáhne přes Instagram Graph API komentáře pod všemi díly hry (posty s `#postavsiricansko`), pozná v nich obec a povolání a doplní hráče do `world.json`. Nahrazuje oba Make scénáře (8385083 a 8387398), ty nech vypnuté, jinak by `world.json` přepisovaly dva zdroje.

## Co nastavit v GitHubu (Settings → Secrets and variables → Actions)

| kde | co | k čemu |
|---|---|---|
| Secrets | `IG_TOKEN` | Instagram user access token účtu radar_ricansko z Meta developer appky („Instagram API“ → Generate token). Potřebuje oprávnění ke čtení komentářů (`instagram_business_basic`, `instagram_business_manage_comments`). Bez secretu workflow skončí s hláškou „IG_TOKEN není nastaven“ a nic nezmění. |
| Variables | `IG_MEDIA_ID` / `IG_MEDIA_URL` | nepovinné: číst jen jeden post (ID, odkaz nebo shortcode) |
| Variables | `POSTY_OD` | nepovinné: ignorovat posty starší než `YYYY-MM-DD` |
| Variables | `PUBLIKACE` | nepovinné: `hned` = web se mění průběžně; jinak až s novým dílem |
| Variables | `START_DATE` | nepovinné: první den hry `YYYY-MM-DD` (výchozí `2026-11-16`), počítá se z něj `den_hry` |

Token platí 60 dní. Prodloužení: `IG_TOKEN=… node tools/ig/komentare.js refresh` (vypíše jen novou expiraci).

## Které posty se čtou

Komentáře se berou ze **všech** postů a reelů, které mají v popisku `#postavsiricansko` (velikost písmen a diakritika nevadí) – tedy ze všech dílů hry najednou. Kdo napíše obec pod starší díl, dostane domek taky. Jeden účet má pořád jen jeden domek, ať komentuje kdekoli.

- `POSTY_OD` (proměnná, `YYYY-MM-DD`) → posty starší než tohle datum se ignorují (zkušební posty před startem).
- `IG_MEDIA_ID` / `IG_MEDIA_URL` → čte se jen tenhle jeden post (ID, odkaz nebo shortcode). Hodí se na zkoušku.

Když se žádný post nenajde, skript vypíše posledních 10 médií (ID, datum, začátek popisku) a skončí beze změny.

## Koncept a web

- `world.json` = **koncept**: průběžný stav, doplňuje se každých 30 minut. Dělá se z něj video dalšího dílu.
- `world-live.json` = **web**: to, co vidí lidi na mapě. Překlopí se z konceptu, až když vyjde nový díl (objeví se nový post s hashtagem).
- `tools/ig/stav.json` = seznam dílů a kdy se naposledy publikovalo.
- Ručně hned: Actions → „Komentáře → world.json“ → Run workflow → zaškrtnout **publikovat**.
- Průběžně jako dřív: proměnná `PUBLIKACE` = `hned` (web = koncept při každém běhu).
- Koncept na mapě (jen pro tým): `…/postav-si-ricansko/?data=world-koncept.json`.

## Pravidla

- Parsování je stejné jako v Make (`make/blueprint-komentare.json`): malá písmena, bez diakritiky, pryč @zmínky a URL, pryč slova povolání a úvodní „jsem / hraju za / obec / z / v…“, zbytek se hledá v aliasech. Aliasy, povolání a filtr nicků jsou v `obce-aliasy.json` (vygenerováno jednou z blueprintu, test hlídá shodu).
- Navíc: obec stačí jako celé slovo kdekoli v komentáři do 12 slov („ahoj, já jsem z Mukařova 😀“). Aliasy ze seznamu `jen_cely_komentar` (popovice, skalice, voderady, ujezdec) platí jen jako celý komentář. Dvě různé obce v jednom komentáři = nerozpoznáno.
- Jeden účet = jeden domek, platí nejstarší komentář s platnou obcí. Pozdější komentář téhož účtu může jen doplnit chybějící povolání.
- Vlastní účet, odpovědi ve vláknech a nevhodné nicky se přeskakují. Účty z nepovinného `tools/ig/blokovane.json` (pole usernamů) taky – hodí se, když hráče ručně smažeš z `world.json` a nemá se vrátit.
- Stávající hráči, jejich čísla, odznaky a speciální budovy ve `world.json` zůstávají. Ručně přesunutý hráč se zpátky nevrací.
- Při prvním běhu se skutečným hráčem se zahodí ukázková data (`"ukazka": true`) a začne se z prázdných obcí.
- `navrhy_dne`: položky s ID `ig-…` jsou top 10 komentářů podle lajků (aspoň 1 lajk) pod nejnovějším dílem, přepisují se každým během. Ručně přidané položky (jiné ID) zůstávají.
- `revize` a `aktualizovano` se mění, jen když se změnil obsah (nový hráč, povolání, návrhy, nový den hry).
- Nerozpoznané komentáře jsou v logu běhu a posledních 200 v `nerozpoznane.json` (username, text, čas).

## Lokálně

```
node tools/ig/test.js                                         # testy (bez sítě)
node tools/ig/komentare.js --dry --fixture tools/ig/fixture.json   # zkouška na ukázkových komentářích
IG_TOKEN=… node tools/ig/komentare.js token-info              # ověření tokenu: username, user_id
IG_TOKEN=… node tools/ig/komentare.js --dry                   # ostrá data, nic se nezapíše
```

Volby: `--dry` (jen shrnutí), `--fixture soubor.json` (komentáře ze souboru místo API), `--world cesta`, `--nerozpoznane cesta`.
