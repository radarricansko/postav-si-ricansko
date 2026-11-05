# Postav si Říčansko

IG minihra RADAR Říčansko: 3D mapa ORP Říčany, kde každý sledující má domek ve své obci.

- `web/`: hra (statická stránka, Three.js r128). Otevři `web/index.html` přes libovolný statický server.
  - `game.js` (hra), `specials.js` (katalog speciálních budov s cedulemi), `reel.js` (generátor reelů), `map.js` a `land.js` (data z OpenStreetMap), `kit.js` (památky, vlak), `erb-lib.js` (stylizované erby)
  - modely Kenney City Kit (CC0) jako JSON (glTF s vloženým bufferem)
- `world.json`: herní stav, který plní Make z IG komentářů (zatím vzorek, schéma je v `make/world.schema.json`)
- `make/`: návrh scénáře Make (ID 8385083, vypnutý) a návod na jeho zprovoznění
- `docs/`: příběh hry a fáze do Vánoc, dokumentace generátoru reelů

Mapová data © přispěvatelé OpenStreetMap (ODbL). Modely © Kenney (CC0).

## Hosting

- **Netlify:** napojit repo, nastavení je v `netlify.toml` (publikuje `web/` a kopíruje do něj `world.json`).
- **Cloudflare Pages:** build command `cp world.json web/world.json`, output `web`.
- Hra načte `world.json`. Když soubor chybí nebo má `"ukazka": true`, ukáže ukázková data. Parametry URL: `?nicky=0` (jen čísla obyvatel), `?demo=1` (vynutit ukázku), `?data=URL` (jiný zdroj dat).
- Nová data se kontrolují každé 2 minuty a nové domky vyrostou s animací.
