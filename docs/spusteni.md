# Spuštění hry: texty a provoz

Hotové texty pro teaser a start, pravidla, šablony DM a denní rutina. Fáze a eventy najdeš v `pribeh-hry.md`.

## 1. Teaser (čt 12. 11.)

**Reel:** mapa Říčanska v mlze, uprostřed se rozsvítí Radar a pomalu odkrývá kus mapy. Titulek `RADAR ZACHYTIL SIGNÁL…`. Konec: `16. 11. · POSTAV SI ŘÍČANSKO`.

**Popisek:**

> 📡 Celé Říčansko zmizelo v mlze. 52 obcí, ani jeden domek. Od pondělí ho budeme stavět zpátky a každý, kdo se přidá, dostane na mapě vlastní domek se svým jménem.
>
> 🏡 Obec vyleze z mlhy, až v ní bude bydlet aspoň 5 lidí. Pak roste, staví hospody, hřiště, kebaby. Co přesně, o tom rozhodneš ty v komentářích.
>
> 👇 Napiš do komentářů svou obec. Kdo bude první z mlhy?
>
> 📸 RADAR Říčansko

## 2. Start (po 16. 11.)

**Popisek:**

> 🗺️ Postav si Říčansko začíná! Dej follow @radar_ricansko a napiš do komentářů jen název své obce. Dostaneš domek s vlastním číslem obyvatele a uvidíš ho v dalším videu.
>
> 🔥 Každý den ukážeme, které obce rostou nejrychleji, a nejlajkovanější nápad v komentářích se postaví i s cedulí s tvým jménem. Hrajeme až do Štědrého dne.
>
> 👇 Tvoje obec? Napiš ji do komentářů a označ kámoše ze stejné vesnice.
>
> 📸 RADAR Říčansko · pravidla v připnutém komentáři

**Připnutý komentář (pravidla):**

> 📌 Pravidla: 1) Sleduj @radar_ricansko. 2) Napiš do komentářů jen název obce z ORP Říčany (52 obcí). 3) Jeden člověk = jeden domek, platí první komentář. 4) Obec se objeví, až má 5 obyvatelů. 5) Na mapě se ukazuje tvůj IG nick. Nechceš ve hře být? Napiš nám DM a domek odstraníme. Hra je jen pro zábavu, nejsou v ní žádné ceny.

## 3. Šablony DM

- **Odstranit ze hry:** „Jasně, domek jsme smazali. Kdyby sis to rozmyslel/a, stačí napsat obec znovu do komentářů 🙌“
- **Změna obce (jen 1×):** „Hotovo, stěhuješ se do {obec}. Další stěhování už bohužel nejde, aby to bylo fér 😄“
- **Obec není v ORP:** „Hra je zatím jen pro 52 obcí ORP Říčany. Máš kus Říčanska rád/a? Vyber si obec, ke které máš nejblíž 💙“
- **Nevidím svůj domek:** „Domky se do mapy propisují zhruba každé 2 hodiny (8–23 h). Když tam do zítřka nebudeš, napiš nám nick a podíváme se.“

## 4. Denní rutina (cca 20 min)

1. **Ráno:** otevři hru a zkontroluj, že přibyli noví obyvatelé (Make je zapisuje do `world.json`).
2. **Top komentář:** pod včerejším reelem vyber nejlajkovanější nápad, který projde moderací (žádná jména lidí mimo hru, nic urážlivého, max. 30 znaků). Zapiš ho jako speciální budovu do data storu `postav_obce`.
3. **Reel:** ve hře tlačítko 🎬 Reel dne → Nahrát video. Voiceover vlož z Text voiceoveru do CapCut TTS (nebo namluv). Video převeď do H.264, pokud ho IG nevezme.
4. **Popisek:** formát 2 odstavce + CTA + 📸. V CTA vždy jedna konkrétní otázka (např. „Kdo dotáhne Tehovec na 5/5?“).
5. **Neděle:** kontrola follow (stránka `tools/follow/`). Domky nesledujících zešednou, nemažou se.

## 5. Před spuštěním

- [ ] Make: webhook, GitHub token, ID herního postu, test (viz `make/README.md`)
- [ ] Rozhodnout operace na Core: úsporná varianta, nebo dokoupit kredity
- [ ] Hosting (Cloudflare Pages / Netlify z tohoto repa) a adresa hra.radar-ricansko.cz
- [ ] Rozhodnout zobrazování nicků (`?nicky=0` skryje nicky a nechá jen čísla obyvatel)
- [ ] Zkušební reel v Chrome s českým hlasem
- [ ] Pravidla do připnutého komentáře a do highlightu
