# Spuštění hry: texty a provoz

Hotové texty pro teaser a start, pravidla, šablony DM a denní rutina. Fáze a eventy najdeš v `pribeh-hry.md`.

## 1. Teaser (čt 12. 11.) – verze 3 „Sjednocené Říčansko“

**Reel (15–20 s, vypráví Pan Radar – klidný starší hlas, ElevenLabs `kOWmvbNszhdJeaeyEzJB`):**

1. Přelet nad prázdnou mapou Říčanska (jen silnice, pole, lesy). Pan Radar: *„Padesát dva obcí. Každá sama za sebe. A kousek vedle Praha, která nás nevidí.“*
2. Kamera sjede na pole mezi Strančicemi, Mnichovicemi a Klokočnou, kde stojí jen cedule **Náměstí sjednocení**. *„Co kdyby se Říčansko spojilo v jedno město? Větší než Praha?“*
3. Zlatá socha 52 mečů, zatím šedá. *„Každá obec dostane svůj erb na soše. Ale jen když v ní někdo bydlí.“*
4. Titulek `POSTAV SI ŘÍČANSKO · od pondělí 16. 11.` + `👇 napiš svou obec`.

**Popisek:**

> 📡 Pan Radar má plán: spojit všech 52 obcí Říčanska v jedno město. Větší než Praha. S náměstím, katedrálou a sochou, kde bude erb každé obce.
>
> 🏡 Jenže město bez lidí nejde. Od pondělí dostane každý, kdo napíše svou obec do komentářů, vlastní domek na 3D mapě. Obec ožije při 5 obyvatelích, roste, staví a bojuje o Korunu týdne.
>
> 👇 Tvoje obec? Napiš ji sem už teď, ať víme, kdo se přidá první.
>
> 📸 RADAR Říčansko

## 2. Start (po 16. 11.) – díl 1

**Reel (30–40 s):** přelet → náměstí (katedrála, šedá socha) → první obce vylézají z mlhy → Koruna týdne → CTA. Pan Radar vyhlásí **anketu o název města** (Říčansko / Velké Říčany / Město R / Radarov / Nové Říčany) – anketa v IG stories, výsledek v díle 3.

**Popisek:**

> 🗺️ Postav si Říčansko začíná! Dej follow @radar_ricansko a napiš do komentářů jen název své obce. Dostaneš domek s vlastním číslem obyvatele a uvidíš ho v dalším videu.
>
> 👑 Každý týden dostane Korunu obec s největším přírůstkem. Pod videem navíc vybíráme nejlajkovanější nápad: co má mít naše město, co Praha nemá? Metro? Zoo s pandami? Letiště v Mukařově? Postavíme to u náměstí – i s cedulí s tvým jménem.
>
> 🏙️ A jak se má nové město jmenovat? Hlasuj ve stories.
>
> 👇 Tvoje obec? Napiš ji do komentářů a označ kámoše ze stejné vesnice.
>
> 📸 RADAR Říčansko · pravidla v připnutém komentáři

**Připnutý komentář (pravidla):**

> 📌 Pravidla: 1) Sleduj @radar_ricansko. 2) Napiš do komentářů jen název obce z ORP Říčany (52 obcí). 3) Jeden člověk = jeden domek, platí první komentář. 4) Obec se objeví, až má 5 obyvatelů. Čím víc lidí, tím hustší zástavba – a když se dvě obce dotknou, spojí se ulicemi. 5) Na mapě se ukazuje tvůj IG nick. Nechceš ve hře být? Napiš nám DM a domek odstraníme. 6) Názvy staveb vybíráme z komentářů, sprosté a urážlivé neprojdou. Hra je jen pro zábavu, nejsou v ní žádné ceny a nic se doopravdy neslučuje 😄

## 3. Šablony DM

- **Odstranit ze hry:** „Jasně, domek jsme smazali. Kdyby sis to rozmyslel/a, stačí napsat obec znovu do komentářů 🙌“
- **Změna obce (jen 1×):** „Hotovo, stěhuješ se do {obec}. Další stěhování už bohužel nejde, aby to bylo fér 😄“
- **Obec není v ORP:** „Hra je zatím jen pro 52 obcí ORP Říčany. Máš kus Říčanska rád/a? Vyber si obec, ke které máš nejblíž 💙“
- **Nevidím svůj domek:** „Domky se do mapy propisují zhruba každé 2 hodiny (8–23 h). Když tam do zítřka nebudeš, napiš nám nick a podíváme se.“

## 4. Denní rutina (cca 20 min)

1. **Ráno:** otevři hru (`?admin=fofrburg96`) a zkontroluj, že přibyli noví obyvatelé (Make je zapisuje do `world.json`).
2. **Top komentář:** pod včerejším reelem vyber nejlajkovanější nápad, který projde moderací (žádná jména lidí mimo hru, nic urážlivého, max. 30 znaků). Zapiš ho jako speciální budovu do data storu `postav_obce` (hra sprostá slova stejně nahradí výchozím názvem).
3. **Video – cesta C (cíl):** GitHub → Actions → „Denní reel a klipy“ → `co = klipy`. Za ~25 min je v artefaktu `klipy.zip` 7 klipů 1080×1920 + `brief.md` (co je v klipu, kdo je nový, koruna). Brief + klipy pošli Claudovi: namluví Pana Radara (ElevenLabs) a sestříhá.
   **Cesta A (záloha):** stejný workflow s `co = reel` → hotový reel s hlasem (potřebuje secret `ELEVENLABS_API_KEY`, jinak hlas prohlížeče).
4. **Popisek:** 2 odstavce + CTA + 📸. V CTA vždy jedna konkrétní otázka (např. „Kdo dotáhne Tehovec na 5/5?“, „Udrží Mnichovice korunu?“).
5. **Neděle:** Koruna týdne se vyhlašuje v nedělním díle; kontrola follow (stránka `tools/follow/`). Domky nesledujících zešednou, nemažou se.

## 5. Před spuštěním

- [ ] Make: připojení *Instagram for Business* (účet radar_ricansko), ID herního postu, test (viz `make/README.md`)
- [ ] GitHub secret `ELEVENLABS_API_KEY` (hlas Pana Radara); volitelně Telegram pro notifikace
- [ ] Rozhodnout název města (anketa v díle 1, nebo rovnou)
- [ ] Rozhodnout zobrazování nicků (`?nicky=0` skryje nicky a nechá jen čísla obyvatel)
- [ ] Zkušební reel/klipy z Actions, test na mobilu (kolegové)
- [ ] Pravidla do připnutého komentáře a do highlightu

## Adresy a automatika (5. 11.)

- **Web hry:** https://radarricansko.github.io/postav-si-ricansko/ (admin: `?admin=fofrburg96`). Nasazuje se samo z repa (GitHub Actions → „Web (GitHub Pages)“) při každé změně ve `web/` nebo `world.json`.
- **Denní reel:** GitHub Actions → „Denní reel“ běží každý den 5:30, výsledek je v artefaktu běhu (`reel-den-N.mp4` + `.txt` voiceover + `.srt`). Ručně: Run workflow. Nastavení hlasu a Telegramu: `tools/video/README.md`.
- **Make → Instagram:** modul „Instagram for Business“ potřebuje připojení vytvořené přes tento modul (žádá oprávnění `instagram_manage_comments`). Připojení „Radar's Facebook connection“ tato oprávnění nemá, takže ho při nastavení scénáře 8385083 nahraď novým (Add → Instagram for Business → přihlásit Facebook stránkou propojenou s IG @radar_ricansko).
