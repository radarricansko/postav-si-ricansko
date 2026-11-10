# Spuštění hry: texty a provoz

Pravidla, šablony DM a denní rutina. Příběh a scénáře dílů jsou v `pribeh-hry.md`.

## 1. Díl 1 a připnutý komentář

Scénář, hlas a popisek dílu 1 i dalších šesti dílů jsou v `pribeh-hry.md` (Prvních 7 dílů).

**Připnutý komentář (pravidla):**

> 📌 Jak hrát: 1) Napiš do komentáře svou obec (52 obcí Říčanska). 2) Jeden účet = jeden domek, platí první komentář. 3) Kdo napíše do 17:00, je druhý den v 9 na mapě a ve videu. 4) Hlasuješ takhle: „název - …“, „vlajka - symbol, barvy“, „nápad - …“. Vyhrává nejvíc lajků. 5) Na mapě je tvůj IG nick. Nechceš tam být? Napiš nám DM. 6) Sprosté a urážlivé návrhy neprojdou. Je to hra a fikce.

## 3. Šablony DM

- **Odstranit ze hry:** „Jasně, domek jsme smazali. Kdyby sis to rozmyslel/a, stačí napsat obec znovu do komentářů 🙌“
- **Změna obce (jen 1×):** „Hotovo, stěhuješ se do {obec}. Další stěhování už bohužel nejde, aby to bylo fér 😄“
- **Obec není v ORP:** „Hra je zatím jen pro 52 obcí ORP Říčany. Máš kus Říčanska rád/a? Vyber si obec, ke které máš nejblíž 💙“
- **Nevidím svůj domek:** „Mapa se mění jednou denně, v 9 ráno s novým dílem. Kdo napsal obec do 17:00, je tam hned další ráno. Kdyby ne, napiš nám nick a podíváme se.“

## 4. Denní rutina

1. **9:00** vyjde naplánovaný reel. Popisek musí obsahovat `#PostavSiŘíčansko`, podle něj se díl pozná. Do půl hodiny se mapa na webu překlopí sama.
2. **17:00** uzávěrka. Výsledky jsou v `tools/ig/navrhy/DATUM.json`, stačí napsat Claudovi „co vyhrálo“.
3. **17:00–20:00** výběr vítěze (Maty schvaluje), stavba do mapy, kontrola náhledu `…/postav-si-ricansko/?data=world-dil.json`, nový render videa (Actions → „Denní reel a klipy“).
4. **Do 20:00** reel naplánovat v Instagramu na 9:00.

## 5. Před spuštěním

- [ ] Zkušební post s `#PostavSiŘíčansko` a pár komentáři: obec → koncept → uzávěrka → mapa (celé kolečko nanečisto)
- [ ] Vybrat tempo hlasu Pana Radara
- [ ] Nový střih videa podle reference
- [ ] Test na mobilu
- [ ] Pravidla do připnutého komentáře a do highlightu

## Adresy a automatika

- **Web hry:** https://radarricansko.github.io/postav-si-ricansko/ Nasazuje se sám z repa při změně ve `web/`, `world-live.json` nebo `world-dil.json`.
- **Komentáře:** Actions → „Komentáře → world.json“, běží každých 30 minut (ráno po 9:00 každých 10). Popis v `tools/ig/README.md`.
- **Reel:** Actions → „Denní reel a klipy“, běží v 17:20 po uzávěrce, ručně přes Run workflow.
