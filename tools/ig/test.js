#!/usr/bin/env node
/* Test tools/ig/komentare.js – bez frameworku: node tools/ig/test.js
   Ověřuje parsování, slučování do kopie world.json v dočasném adresáři a API vrstvu s podvrženým fetch (bez sítě). */
const fs = require('fs'), os = require('os'), path = require('path'), assert = require('assert'), { spawnSync } = require('child_process');
const K = require('./komentare.js');
const ROOT = path.resolve(__dirname, '../..');
const SKRIPT = path.join(__dirname, 'komentare.js'), FIXTURE = path.join(__dirname, 'fixture.json');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'postav-ig-'));
const json = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const testy = [];
const test = (jmeno, fn) => testy.push([jmeno, fn]);

/* malý validátor – jen ta část JSON Schema, kterou používá make/world.schema.json */
function validuj(s, v, kde = 'world') {
  const ch = [];
  const typ = x => x === null ? 'null' : Array.isArray(x) ? 'array' : Number.isInteger(x) ? 'integer' : typeof x;
  if (s.type) { const t = [].concat(s.type), m = typ(v); if (!t.includes(m) && !(m === 'integer' && t.includes('number'))) return [`${kde}: typ ${m}, čekám ${t}`]; }
  if ('const' in s && v !== s.const) ch.push(`${kde}: není ${s.const}`);
  if (s.enum && !s.enum.includes(v)) ch.push(`${kde}: ${JSON.stringify(v)} není ve výčtu`);
  if (typeof v === 'string') {
    if (s.pattern && !new RegExp(s.pattern).test(v)) ch.push(`${kde}: neodpovídá ${s.pattern}`);
    if (s.maxLength != null && [...v].length > s.maxLength) ch.push(`${kde}: delší než ${s.maxLength}`);
    if (s.format === 'date-time' && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(v)) ch.push(`${kde}: není date-time`);
  }
  if (typeof v === 'number' && s.minimum != null && v < s.minimum) ch.push(`${kde}: menší než ${s.minimum}`);
  if (Array.isArray(v)) {
    if (s.maxItems != null && v.length > s.maxItems) ch.push(`${kde}: víc než ${s.maxItems} položek`);
    if (s.uniqueItems && new Set(v.map(x => JSON.stringify(x))).size !== v.length) ch.push(`${kde}: duplicitní položky`);
    if (s.items) v.forEach((x, i) => ch.push(...validuj(s.items, x, `${kde}[${i}]`)));
  } else if (v && typeof v === 'object') {
    for (const r of s.required || []) if (!(r in v)) ch.push(`${kde}: chybí ${r}`);
    for (const [k, x] of Object.entries(v)) {
      if (s.properties && s.properties[k]) ch.push(...validuj(s.properties[k], x, `${kde}.${k}`));
      else if (s.additionalProperties === false) ch.push(`${kde}: pole ${k} schéma nezná`);
    }
  }
  return ch;
}
const SCHEMA = json(path.join(ROOT, 'make/world.schema.json'));
const validni = w => assert.deepStrictEqual(validuj(SCHEMA, w), []);
const hrac = (w, ig) => { for (const o of w.obce) for (const h of o.hraci) if (h.ig.toLowerCase() === ig.toLowerCase()) return { ...h, obec: o.id }; return null; };
const kopieSveta = jmeno => { const d = fs.mkdtempSync(path.join(TMP, jmeno + '-')); fs.copyFileSync(path.join(ROOT, 'world.json'), path.join(d, 'world.json')); return { world: path.join(d, 'world.json'), ner: path.join(d, 'nerozpoznane.json') }; };
const spust = (args, env = {}) => spawnSync(process.execPath, [SKRIPT, ...args], { encoding: 'utf8', env: { PATH: process.env.PATH, ...env } });

/* ---------- parsování ---------- */
test('parsování: obec, povolání, předpony, překlepy, obec ve větě', () => {
  const p = [
    // text, obec, povolání
    ['Říčany', 'ricany', ''],
    ['  ŘÍČANY!!! 🔥🔥', 'ricany', ''],
    ['rycany', 'ricany', ''],                               // překlep z aliasů
    ['mukarow', 'mukarov', ''],
    ['mnichovyce', 'mnichovice', ''],
    ['z Říčan', 'ricany', ''],                              // 2. pád + předložka
    ['v Mnichovicích', 'mnichovice', ''],
    ['jsem z Mukařova', 'mukarov', ''],
    ['hraju za Strančice', 'strancice', ''],
    ['obec Světice', 'svetice', ''],
    ['KNCL', 'kostelec-nad-cernymi-lesy', ''],
    ['Kostelec nad Černými lesy', 'kostelec-nad-cernymi-lesy', ''],
    ['Kostelec u Křížků', 'kostelec-u-krizku', ''],
    ['Kostelec', '', ''],                                   // záměrně nejednoznačné
    ['Mukařov hasič', 'mukarov', 'hasic'],                  // povolání v různém pořadí
    ['hasič Mukařov', 'mukarov', 'hasic'],
    ['Mnichovice, kuchařka 🔥', 'mnichovice', 'kuchar'],
    ['jsem hasička z Mukařova', 'mukarov', 'hasic'],
    ['DJ Říčany', 'ricany', 'muzikant'],
    ['Říčany barmanka', 'ricany', 'hospodsky'],
    ['ajťák z Kunic', 'kunice', 'programator'],
    ['hasič', '', 'hasic'],                                 // jen povolání = bez obce
    ['hasičárna Mukařov', 'mukarov', ''],                   // povolání jen jako celé slovo
    ['@kamoska pojď! https://example.com/a Světice', 'svetice', ''],  // zmínky a URL pryč
    ['ahoj, já jsem z Mukařova 😀', 'mukarov', ''],          // obec uprostřed věty
    ['Mukařov 🔥 jdeme do toho', 'mukarov', ''],
    ['bydlím ve Velkých Popovicích', 'velke-popovice', ''],
    ['ze Světic u Říčan', 'svetice', ''],                   // „u Říčan“ je jen upřesnění
    ['Mukařov u Říčan', 'mukarov', ''],
    ['Popovice', 'velke-popovice', ''],                     // krátký obecný alias: jen jako celý komentář
    ['z Popovic… teda Popovice', '', ''],
    ['byl jsem na výletě a popovice jsou fajn', '', ''],
    ['Skalice', 'stribrna-skalice', ''],
    ['jedeme do skalice', '', ''],
    ['Voděrady', 'cerne-voderady', ''],
    ['Újezdec', 'krizkovy-ujezdec', ''],
    ['Jsem z Kunic, ale Babice jsou lepší', '', ''],        // dvě různé obce = nerozpoznáno
    ['super hra 👏', '', ''],
    ['', '', ''],
  ];
  for (const [text, obec, pov] of p) {
    const r = K.parsuj(text);
    assert.strictEqual(r.obec, obec, `obec pro „${text}“`);
    assert.strictEqual(r.povolani, pov, `povolání pro „${text}“`);
  }
  assert.strictEqual(K.parsuj('Jsem z Kunic, ale Babice jsou lepší').duvod, 'vic_obci');
  // dlouhý komentář se zmínkou obce není přihláška
  assert.strictEqual(K.parsuj('Tohle je fakt super nápad, konečně něco pro mladý, snad se přidají i Říčany a celé okolí').obec, '');
});

test('obce-aliasy.json odpovídá blueprintu a make/obce.json', () => {
  const bp = json(path.join(ROOT, 'make/blueprint-komentare.json'));
  const vars = bp.flow.find(m => m.id === 2).mapper.variables;
  const pary = (jmeno, znacka) => { const s = vars.find(x => x.name === jmeno).value; const a = [...s.slice(s.lastIndexOf(znacka) + znacka.length).matchAll(/"((?:[^"\\]|\\.)*)"/g)].map(m => m[1]); a.pop(); const o = {}; for (let i = 0; i < a.length; i += 2) o[a[i]] = a[i + 1]; return o; };
  const zBlueprintu = pary('obec_id', '"/\\s+/g"; " "));'), zJsonu = {};
  for (const o of K.DATA.obce) for (const a of o.aliasy) zJsonu[a] = o.id;
  assert.deepStrictEqual(zJsonu, zBlueprintu);
  assert.strictEqual(Object.keys(zJsonu).length, 208);
  assert.deepStrictEqual(K.DATA.povolani, pary('povolani', '"$1");'));
  assert.strictEqual(K.DATA.filtr_nicku, bp.flow.find(m => m.id === 3).filter.conditions[0].find(c => c.o === 'text:notpattern').b);
  const obce = json(path.join(ROOT, 'make/obce.json')).obce;
  assert.deepStrictEqual(K.DATA.obce.map(o => [o.id, o.nazev]).sort(), obce.map(o => [o.id, o.nazev]).sort());
  assert.strictEqual(K.DATA.obce.length, 52);
  for (const a of K.DATA.jen_cely_komentar) assert.ok(zJsonu[a], a);
});

test('den hry: Europe/Prague, minimálně 1', () => {
  assert.strictEqual(K.denHry('2026-11-16', new Date('2026-11-10T12:00:00Z')), 1);   // před startem
  assert.strictEqual(K.denHry('2026-11-16', new Date('2026-11-16T06:00:00Z')), 1);
  assert.strictEqual(K.denHry('2026-11-16', new Date('2026-11-16T22:59:00Z')), 1);   // 23:59 v Praze
  assert.strictEqual(K.denHry('2026-11-16', new Date('2026-11-16T23:00:00Z')), 2);   // půlnoc v Praze
  assert.strictEqual(K.denHry('2026-11-16', new Date('2026-12-24T12:00:00Z')), 39);
  assert.strictEqual(K.denHry('2027-03-27', new Date('2027-03-28T21:59:00Z')), 2);   // přes změnu času
  assert.strictEqual(K.denHry('2027-03-27', new Date('2027-03-28T22:00:00Z')), 3);
  assert.throws(() => K.denHry('16.11.2026', new Date()));
});

test('shortcode z odkazu', () => {
  assert.strictEqual(K.shortcode('https://www.instagram.com/p/DCx_Ab-12/?igsh=abc'), 'DCx_Ab-12');
  assert.strictEqual(K.shortcode('https://www.instagram.com/radar_ricansko/reel/DCxAb12/'), 'DCxAb12');
  assert.strictEqual(K.shortcode('DCxAb12'), 'DCxAb12');
  assert.strictEqual(K.shortcode('https://www.instagram.com/radar_ricansko/'), '');
});

/* ---------- slučování: skutečný world.json s ukázkou (CLI, dočasný adresář) ---------- */
test('CLI: --dry nic nezapíše', () => {
  const s = kopieSveta('dry'), pred = fs.readFileSync(s.world, 'utf8');
  const r = spust(['--dry', '--fixture', FIXTURE, '--world', s.world, '--nerozpoznane', s.ner]);
  assert.strictEqual(r.status, 0, r.stderr);
  assert.match(r.stdout, /nových hráčů: 17/);
  assert.match(r.stdout, /--dry: nic nezapisuji/);
  assert.strictEqual(fs.readFileSync(s.world, 'utf8'), pred);
  assert.ok(!fs.existsSync(s.ner));
});

test('CLI: fixture do kopie world.json – ukázka pryč, hráči, čísla, odznaky, povolání', () => {
  const s = kopieSveta('beh'), pred = json(s.world), out = path.join(path.dirname(s.world), 'gh-output');
  assert.strictEqual(pred.ukazka, true, 'test počítá s ukázkovým world.json v repu');
  const r = spust(['--fixture', FIXTURE, '--world', s.world, '--nerozpoznane', s.ner], { START_DATE: '2026-11-16', GITHUB_OUTPUT: out });
  assert.strictEqual(r.status, 0, r.stderr);
  const w = json(s.world);
  validni(w);
  assert.ok(!('ukazka' in w));
  assert.strictEqual(hrac(w, 'hrac_01'), null, 'ukázkoví hráči jsou pryč');
  assert.strictEqual(w.revize, pred.revize + 1);
  assert.strictEqual(w.verze, 1);
  assert.deepStrictEqual(w.log_udalosti, []);
  assert.strictEqual(w.den_hry, K.denHry('2026-11-16', new Date()));
  assert.strictEqual(w.obce.reduce((n, o) => n + o.hraci.length, 0), 17);
  for (const o of w.obce) {
    assert.strictEqual(o.pocet_hracu, o.hraci.length);
    assert.deepStrictEqual(o.hraci.map(h => h.cislo_obyvatele), o.hraci.map((_, i) => i + 1));
    o.hraci.forEach((h, i) => assert.deepStrictEqual(h.odznaky, [i === 0 ? 'prvni_v_obci' : 'novacek']));
    assert.deepStrictEqual(o.specialni_budovy, []);
  }
  assert.deepStrictEqual(w.obce.find(o => o.id === 'mukarov').hraci, [
    { ig: 'pepa_z_mukarova', cislo_obyvatele: 1, datum: '2026-11-16T08:05:00Z', odznaky: ['prvni_v_obci'] },
    { ig: 'hasic_tom', cislo_obyvatele: 2, datum: '2026-11-16T08:10:00Z', odznaky: ['novacek'], povolani: 'hasic' },
    { ig: 'jana.h', cislo_obyvatele: 3, datum: '2026-11-16T09:00:00Z', odznaky: ['novacek'], povolani: 'hasic' },
  ]);
  assert.strictEqual(w.obce.find(o => o.id === 'kostelec-nad-cernymi-lesy').nazev, 'Kostelec nad Černými lesy');
  assert.strictEqual(hrac(w, 'anicka.n').obec, 'ricany', 'duplicitní účet: platí první komentář');
  assert.strictEqual(hrac(w, 'radar_ricansko'), null, 'vlastní účet');
  assert.strictEqual(hrac(w, 'kokot123'), null, 'nevhodný nick');
  assert.strictEqual(hrac(w, 'marek_s').povolani, 'skejtak', 'povolání doplněné pozdějším komentářem');
  assert.strictEqual(hrac(w, 'hasic_tom').povolani, 'hasic', 'už nastavené povolání se nemění');
  assert.ok(!('povolani' in hrac(w, 'anicka.n')));
  assert.strictEqual(hrac(w, 'kuchta.eva').povolani, 'kuchar');
  assert.strictEqual(hrac(w, 'svetak').obec, 'svetice');
  assert.strictEqual(hrac(w, 'velky.popo').obec, 'velke-popovice');
  assert.strictEqual(hrac(w, 'rycany_typo').cislo_obyvatele, 2);
  assert.strictEqual(hrac(w, 'franta_nupaky').ig, 'Franta_Nupaky');
  for (const ig of ['vyletnik_cz', 'nekdo_novy', 'dve_obce', 'bezobce', 'jen_job', 'ukecany']) assert.strictEqual(hrac(w, ig), null, ig);
  // navrhy_dne = top komentáře podle lajků (bez vlastního účtu, nevhodných nicků a komentářů bez lajku)
  assert.deepStrictEqual(w.navrhy_dne.map(n => [n.autor, n.hlasy]), [['pepa_z_mukarova', 12], ['petr.o', 7], ['bezobce', 5], ['jana.h', 4], ['anicka.n', 3], ['kuchta.eva', 2], ['kncl_boy', 1], ['ukecany', 1]]);
  assert.deepStrictEqual(w.navrhy_dne[0], { id: 'ig-17900000000000002', obec_id: 'mukarov', text: 'ahoj, já jsem z Mukařova 😀', autor: 'pepa_z_mukarova', hlasy: 12, datum: '2026-11-16T08:05:00Z' });
  assert.ok(!('obec_id' in w.navrhy_dne[2]));
  // nerozpoznané komentáře
  const ner = json(s.ner);
  assert.deepStrictEqual(ner.map(n => n.username), ['vyletnik_cz', 'nekdo_novy', 'dve_obce', 'bezobce', 'jen_job', 'ukecany']);
  assert.deepStrictEqual(ner[1], { username: 'nekdo_novy', text: 'Kostelec', timestamp: '2026-11-16T08:55:00Z' });
  assert.match(r.stdout, /\? @nekdo_novy/);
  assert.strictEqual(fs.readFileSync(out, 'utf8'), 'novi=17\nzmena=true\npublikovano=false\n');
  // druhý běh nad stejnými komentáři nic nemění (revize ani soubor)
  const po1 = fs.readFileSync(s.world, 'utf8');
  const r2 = spust(['--fixture', FIXTURE, '--world', s.world, '--nerozpoznane', s.ner], { START_DATE: '2026-11-16' });
  assert.strictEqual(r2.status, 0, r2.stderr);
  assert.match(r2.stdout, /nových hráčů: 0/);
  assert.match(r2.stdout, /world\.json: beze změny/);
  assert.strictEqual(fs.readFileSync(s.world, 'utf8'), po1);
});

test('ukázkový world.json bez skutečného hráče zůstane beze změny', () => {
  const svet = json(path.join(ROOT, 'world.json'));
  const v = K.zpracuj(svet, [{ id: '1', text: 'super hra', username: 'nekdo', timestamp: '2026-11-16T08:00:00+0000', like_count: 3 }, { id: '2', text: 'Říčany', username: 'radar_ricansko', timestamp: '2026-11-16T08:01:00+0000', like_count: 0 }], { now: new Date('2026-11-20T10:00:00Z') });
  assert.strictEqual(v.zmena, false);
  assert.deepStrictEqual(v.world, svet);
  assert.strictEqual(v.nerozpoznane.length, 1);
});

/* ---------- slučování do rozehraného světa (funkce) ---------- */
test('rozehraný svět: stávající hráči a stavby zůstávají, číslování pokračuje', () => {
  const svet = {
    verze: 1, revize: 41, den_hry: 2, aktualizovano: '2026-11-17T10:00:00Z', podpis: 'abc',
    obce: [
      { id: 'ricany', nazev: 'Říčany', pocet_hracu: 2, hraci: [
        { ig: 'stara.garda', cislo_obyvatele: 1, datum: '2026-11-16T07:00:00Z', odznaky: ['prvni_v_obci', 'follow_overen'] },
        { ig: 'bez_prace', cislo_obyvatele: 4, datum: '2026-11-16T07:30:00Z', odznaky: ['novacek'], povolani: '' } ],
        specialni_budovy: [{ typ: 'radnice', nazev_cedule: 'Radnice Říčany', autor: 'radar', datum: '2026-11-16T08:00:00Z' }] },
      { id: 'mukarov', nazev: 'Mukařov', pocet_hracu: 1, hraci: [{ ig: 'prestehovany', cislo_obyvatele: 1, datum: '2026-11-16T07:40:00Z', odznaky: ['prvni_v_obci'] }], specialni_budovy: [] },
    ],
    navrhy_dne: [{ id: 'd2-1', obec_id: 'ricany', text: 'Skatepark u nádraží', autor: 'radar', hlasy: 7, datum: '2026-11-17T09:00:00Z' }, { id: 'ig-999', text: 'starý návrh z minulého běhu', autor: 'nekdo', hlasy: 2, datum: '2026-11-16T09:00:00Z' }],
    log_udalosti: [{ typ: 'novy_den', text: 'Začíná den 2', datum: '2026-11-17T06:00:00Z' }],
  };
  const original = JSON.stringify(svet);
  const kom = [
    { id: '10', text: 'Říčany', username: 'stara.garda', timestamp: '2026-11-16T07:00:00+0000', like_count: 0 },
    { id: '11', text: 'hasič', username: 'bez_prace', timestamp: '2026-11-16T07:10:00+0000', like_count: 0 },      // před registrací: nepočítá se
    { id: '12', text: 'Říčany', username: 'bez_prace', timestamp: '2026-11-16T07:30:00+0000', like_count: 0 },
    { id: '13', text: 'jsem kuchař 👨‍🍳', username: 'BEZ_PRACE', timestamp: '2026-11-17T12:00:00+0000', like_count: 6 },  // po registraci: doplní povolání
    { id: '14', text: 'Říčany', username: 'prestehovany', timestamp: '2026-11-16T07:35:00+0000', like_count: 0 },  // ručně přesunutý hráč se nevrací
    { id: '15', text: 'z Říčan', username: 'novy.ricanak', timestamp: '2026-11-17T13:00:00+0000', like_count: 0 },
    { id: '16', text: 'Tehov rytíř', username: 'tehovak', timestamp: '2026-11-17T13:05:00+0000', like_count: 0 },
    { id: '17', text: 'Tehov', username: 'zakazany', timestamp: '2026-11-17T13:06:00+0000', like_count: 0 },
    { id: '18', text: 'Říčany', username: 'odpoved', timestamp: '2026-11-17T13:07:00+0000', like_count: 0, parent_id: '15' },  // odpověď ve vlákně
    { id: '19', text: 'Tehov', username: 'pozde', timestamp: '2026-11-17T13:08:00+0000', like_count: 0 },
  ];
  const opts = { now: new Date('2026-11-17T14:00:00Z'), start: '2026-11-16', blokovane: ['Zakazany'] };
  const v = K.zpracuj(svet, kom, opts), w = v.world;
  assert.strictEqual(JSON.stringify(svet), original, 'vstup se nemění');
  validni(w);
  assert.strictEqual(v.zmena, true);
  assert.strictEqual(w.revize, 42);
  assert.strictEqual(w.aktualizovano, '2026-11-17T14:00:00Z');
  assert.strictEqual(w.den_hry, 2);
  assert.strictEqual(w.podpis, 'abc');
  assert.deepStrictEqual(w.log_udalosti, svet.log_udalosti);
  const ricany = w.obce[0];
  assert.deepStrictEqual(ricany.hraci[0], svet.obce[0].hraci[0]);
  assert.deepStrictEqual(ricany.specialni_budovy, svet.obce[0].specialni_budovy);
  assert.strictEqual(ricany.hraci[1].povolani, 'kuchar');
  assert.deepStrictEqual(ricany.hraci[2], { ig: 'novy.ricanak', cislo_obyvatele: 5, datum: '2026-11-17T13:00:00Z', odznaky: ['novacek'] });
  assert.strictEqual(ricany.pocet_hracu, 3);
  assert.strictEqual(hrac(w, 'prestehovany').obec, 'mukarov');
  assert.deepStrictEqual(w.obce[2], { id: 'tehov', nazev: 'Tehov', pocet_hracu: 2, hraci: [
    { ig: 'tehovak', cislo_obyvatele: 1, datum: '2026-11-17T13:05:00Z', odznaky: ['prvni_v_obci'], povolani: 'rytir' },
    { ig: 'pozde', cislo_obyvatele: 2, datum: '2026-11-17T13:08:00Z', odznaky: ['novacek'] } ], specialni_budovy: [] });
  assert.strictEqual(hrac(w, 'zakazany'), null);
  assert.strictEqual(hrac(w, 'odpoved'), null);
  assert.deepStrictEqual(v.novi.map(n => n.ig), ['novy.ricanak', 'tehovak', 'pozde']);
  assert.deepStrictEqual(v.doplneno, [{ ig: 'bez_prace', povolani: 'kuchar' }]);
  // ruční návrh zůstal, starý „ig-“ návrh nahradil aktuální žebříček
  assert.deepStrictEqual(w.navrhy_dne.map(n => n.id), ['d2-1', 'ig-13']);
  // idempotence: stejné komentáře podruhé = žádná změna, další den = změna jen kvůli den_hry
  const v2 = K.zpracuj(w, kom, opts);
  assert.strictEqual(v2.zmena, false);
  assert.strictEqual(v2.world, w);
  const v3 = K.zpracuj(w, kom, { ...opts, now: new Date('2026-11-18T05:00:00Z') });
  assert.strictEqual(v3.zmena, true);
  assert.strictEqual(v3.world.den_hry, 3);
  assert.strictEqual(v3.world.revize, 43);
  assert.strictEqual(v3.novi.length, 0);
});

test('navrhy_dne: nejvýš 10, text do 140 znaků', () => {
  const kom = [{ id: '1', text: 'Říčany', username: 'prvni', timestamp: '2026-11-16T08:00:00+0000', like_count: 0 }];
  for (let i = 0; i < 15; i++) kom.push({ id: String(100 + i), text: 'dlouhý návrh 🏗️ '.repeat(20), username: 'user' + i, timestamp: `2026-11-16T09:${String(i).padStart(2, '0')}:00+0000`, like_count: i + 1 });
  const w = K.zpracuj({ verze: 1, revize: 0, den_hry: 1, aktualizovano: '2026-11-16T00:00:00Z', obce: [], navrhy_dne: [], log_udalosti: [] }, kom, { now: new Date('2026-11-16T12:00:00Z') }).world;
  validni(w);
  assert.strictEqual(w.navrhy_dne.length, 10);
  assert.deepStrictEqual(w.navrhy_dne.map(n => n.hlasy), [15, 14, 13, 12, 11, 10, 9, 8, 7, 6]);
  assert.ok(w.navrhy_dne.every(n => [...n.text].length <= 140));
});

/* ---------- CLI bez tokenu ---------- */
test('CLI: bez IG_TOKEN skončí kódem 0 a nic nezmění', () => {
  const s = kopieSveta('bez-tokenu'), pred = fs.readFileSync(s.world, 'utf8');
  for (const args of [[], ['token-info'], ['refresh']]) {
    const r = spust([...args, '--world', s.world, '--nerozpoznane', s.ner]);
    assert.strictEqual(r.status, 0, r.stderr);
    assert.match(r.stdout, /IG_TOKEN není nastaven/);
  }
  assert.strictEqual(fs.readFileSync(s.world, 'utf8'), pred);
  assert.ok(!fs.existsSync(s.ner));
});

/* ---------- API vrstva s podvrženým fetch ---------- */
const TOKEN = 'IGTAJNY_token-123';
// spustí main() s falešným fetch; vrací kód, zachycený výstup a seznam volaných adres
async function sApi(odpovedi, argv, env) {
  const puvodni = { fetch: global.fetch, log: console.log, cekani: K.cfg.cekani };
  const vystup = [], volani = [];
  K.cfg.cekani = [0, 0];
  console.log = (...a) => vystup.push(a.join(' '));
  global.fetch = async (url) => {
    const u = new URL(url); volani.push(u.host + u.pathname);
    assert.strictEqual(u.searchParams.get('access_token'), TOKEN);
    const o = odpovedi(u, volani.length);
    if (o instanceof Error) throw o;
    const [status, telo] = o;
    return { ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(telo) };
  };
  let kod, chyba = null;
  try { kod = await K.main(argv, { IG_TOKEN: TOKEN, ...env }); } catch (e) { chyba = e; kod = 1; }
  finally { global.fetch = puvodni.fetch; console.log = puvodni.log; K.cfg.cekani = puvodni.cekani; }
  const text = vystup.join('\n') + (chyba ? '\nCHYBA: ' + K.redact(chyba.message) : '');
  assert.ok(!text.includes(TOKEN), 'token nesmí být ve výstupu');
  return { kod, text, volani, chyba };
}
const MEDIA = [
  { id: '300', caption: 'Novinky z Říčan', permalink: 'https://www.instagram.com/p/AAA111/', timestamp: '2026-11-17T10:00:00+0000', comments_count: 4 },
  { id: '200', caption: 'Hrajeme! Napiš svou obec 🏠 #PostavSiŘíčansko #ricany', permalink: 'https://www.instagram.com/reel/HRA222/', timestamp: '2026-11-16T07:00:00+0000', comments_count: 3 },
  { id: '100', caption: 'Starší verze #postavsiricansko', permalink: 'https://www.instagram.com/p/OLD333/', timestamp: '2026-11-01T07:00:00+0000', comments_count: 9 },
];
const KOM1 = [{ id: '2', text: 'Mukařov hasič', username: 'tom', timestamp: '2026-11-16T08:10:00+0000', like_count: 1, from: { id: '9', username: 'tom' } }, { id: '3', text: 'Říčany', username: 'radar_ricansko', timestamp: '2026-11-16T08:20:00+0000', like_count: 0 }];
// starší díl (post 100): jeden nový hráč + eva podruhé (jeden účet = jeden domek, platí první komentář)
const KOM0 = [{ id: '90', text: 'Kamenice', username: 'ota', timestamp: '2026-11-01T09:00:00+0000', like_count: 7 }, { id: '91', text: 'Mnichovice', username: 'eva', timestamp: '2026-11-01T09:05:00+0000', like_count: 0 }];
const KOM2 = [{ id: '1', text: 'Říčany', timestamp: '2026-11-16T08:00:00+0000', like_count: 0, from: { id: '8', username: 'eva' } }];
// graph.instagram.com: /me, média, komentáře na dvě stránky
const igHost = (zmeny = {}) => (u) => {
  const p = u.pathname.replace(/^\/v\d+\.\d+/, '');
  if (zmeny[p]) return zmeny[p](u);
  if (u.host !== 'graph.instagram.com') return [400, { error: { code: 190, message: 'Invalid OAuth access token' } }];
  if (p === '/me') return [200, { user_id: '178', username: 'radar_ricansko', id: '55' }];
  if (p === '/me/media') return [200, { data: MEDIA }];
  if (p === '/200') return [200, MEDIA[1]];
  if (p === '/100/comments') return [200, { data: KOM0 }];
  if (p === '/200/comments') return u.searchParams.get('after') ? [200, { data: KOM2 }] : [200, { data: KOM1, paging: { next: `https://graph.instagram.com/v21.0/200/comments?after=X&access_token=${TOKEN}` } }];
  return [400, { error: { code: 100, message: `Unsupported get request ${u.pathname}?access_token=${TOKEN}` } }];
};

test('API: komentáře ze všech postů s hashtagem, stránkování, token není v logu', async () => {
  const s = kopieSveta('api');
  const r = await sApi(igHost(), ['--world', s.world, '--nerozpoznane', s.ner], {});
  assert.strictEqual(r.kod, 0, r.text);
  assert.match(r.text, /herních postů \(dílů\) s #postavsiricansko: 2/);
  assert.match(r.text, /herní post: 100 /);
  assert.match(r.text, /herní post: 200 /);
  assert.deepStrictEqual(r.volani, ['graph.instagram.com/v21.0/me', 'graph.instagram.com/v21.0/me/media', 'graph.instagram.com/v21.0/100/comments', 'graph.instagram.com/v21.0/200/comments', 'graph.instagram.com/v21.0/200/comments']);
  const w = json(s.world);
  validni(w);
  // eva psala pod oba díly: platí první komentář (Mnichovice), druhý se nepočítá
  assert.deepStrictEqual(w.obce.map(o => [o.id, o.hraci.map(h => h.ig)]), [['kamenice', ['ota']], ['mnichovice', ['eva']], ['mukarov', ['tom']]]);
  // nápady dne jen z nejnovějšího dílu (post 200), i když starší komentář má víc lajků
  assert.deepStrictEqual(w.navrhy_dne.filter(n => String(n.id).startsWith('ig-')).map(n => n.id), ['ig-2']);
});

test('API: POSTY_OD odřízne starší posty', async () => {
  const s = kopieSveta('api-od');
  const r = await sApi(igHost(), ['--world', s.world, '--nerozpoznane', s.ner], { POSTY_OD: '2026-11-10' });
  assert.strictEqual(r.kod, 0, r.text);
  assert.ok(!/herní post: 100 /.test(r.text));
  assert.deepStrictEqual(json(s.world).obce.map(o => [o.id, o.hraci.map(h => h.ig)]), [['ricany', ['eva']], ['mukarov', ['tom']]]);
});

test('publikace: web se překlopí až s novým dílem; --publikovat a PUBLIKACE=hned', async () => {
  const s = kopieSveta('pub'), live = path.join(path.dirname(s.world), 'world-live.json'), stav = path.join(path.dirname(s.ner), 'stav.json');
  const args = ['--world', s.world, '--nerozpoznane', s.ner];
  const hraci = f => json(f).obce.flatMap(o => o.hraci.map(h => h.ig)).sort();
  // 1. běh: jen díl 100 → web ještě nic nemá, publikuje se
  let media = [MEDIA[2]], kom200 = KOM1.concat(KOM2);
  const host = () => igHost({ '/me/media': () => [200, { data: media }], '/200/comments': () => [200, { data: kom200 }] });
  let r = await sApi(host(), args, {});
  assert.strictEqual(r.kod, 0, r.text);
  assert.match(r.text, /web: publikuji \(web ještě nemá žádný stav\)/);
  assert.deepStrictEqual(hraci(live), ['eva', 'ota']);
  assert.strictEqual(json(stav).publikovano.post, '100');
  // 2. běh: pod dílem 100 přibyl hráč → koncept ano, web ne
  const puv = KOM0.slice(); KOM0.push({ id: '92', text: 'Tehov', username: 'iva', timestamp: '2026-11-02T09:00:00+0000', like_count: 0 });
  try {
    r = await sApi(host(), args, {});
    assert.match(r.text, /web: beze změny, čeká na další díl \(v konceptu \+1 hráčů\)/);
    assert.deepStrictEqual(hraci(s.world), ['eva', 'iva', 'ota']);
    assert.deepStrictEqual(hraci(live), ['eva', 'ota']);
    // 3. běh: vyšel díl 200 → web se překlopí na celý koncept
    media = [MEDIA[1], MEDIA[2]];
    r = await sApi(host(), args, {});
    assert.match(r.text, /web: publikuji \(nový díl https:\/\/www\.instagram\.com\/reel\/HRA222\/\)/);
    assert.deepStrictEqual(hraci(live), ['eva', 'iva', 'ota', 'tom']);
    assert.strictEqual(fs.readFileSync(live, 'utf8'), fs.readFileSync(s.world, 'utf8'));
    assert.deepStrictEqual([json(stav).publikovano.post, json(stav).posty.map(p => p.id)], ['200', ['100', '200']]);
    // 4. běh: další komentář pod dílem 200 → zase jen koncept; --publikovat web překlopí ručně
    kom200 = kom200.concat([{ id: '5', text: 'Světice', username: 'jan', timestamp: '2026-11-16T09:00:00+0000', like_count: 0 }]);
    r = await sApi(host(), args, {});
    assert.deepStrictEqual(hraci(live), ['eva', 'iva', 'ota', 'tom']);
    r = await sApi(host(), args.concat('--publikovat'), {});
    assert.match(r.text, /web: publikuji \(ruční publikace\)/);
    assert.deepStrictEqual(hraci(live), ['eva', 'iva', 'jan', 'ota', 'tom']);
    // 5. režim „hned“: web = koncept při každém běhu
    kom200 = kom200.concat([{ id: '6', text: 'Tehov', username: 'kuba', timestamp: '2026-11-16T09:30:00+0000', like_count: 0 }]);
    r = await sApi(host(), args, { PUBLIKACE: 'hned' });
    assert.match(r.text, /web: publikuji \(režim „hned“\)/);
    assert.ok(hraci(live).includes('kuba'));
    validni(json(live));
  } finally { KOM0.length = 0; KOM0.push(...puv); }
});

test('API: IG_MEDIA_ID, odkaz v IG_MEDIA_ID i IG_MEDIA_URL', async () => {
  for (const env of [{ IG_MEDIA_ID: '200' }, { IG_MEDIA_ID: 'https://www.instagram.com/reel/HRA222/?igsh=x' }, { IG_MEDIA_URL: 'HRA222' }]) {
    const s = kopieSveta('api-id');
    const r = await sApi(igHost(), ['--dry', '--world', s.world, '--nerozpoznane', s.ner], env);
    assert.strictEqual(r.kod, 0, r.text);
    assert.match(r.text, /herní post: 200 /);
    assert.match(r.text, /nových hráčů: 2/);
  }
});

test('API: herní post nenalezen → seznam médií, kód 0, beze změny', async () => {
  const s = kopieSveta('api-nic'), pred = fs.readFileSync(s.world, 'utf8');
  for (const [zmeny, env] of [[{ '/me/media': () => [200, { data: [MEDIA[0]] }] }, {}], [{}, { IG_MEDIA_URL: 'https://www.instagram.com/p/NEEXISTUJE/' }]]) {
    const r = await sApi(igHost(zmeny), ['--world', s.world, '--nerozpoznane', s.ner], env);
    assert.strictEqual(r.kod, 0, r.text);
    assert.match(r.text, /Posledních 10 médií/);
    assert.match(r.text, /300 · 2026-11-17 · "Novinky z Říčan"/);
    assert.match(r.text, /Herní post nenalezen/);
  }
  assert.strictEqual(fs.readFileSync(s.world, 'utf8'), pred);
  assert.ok(!fs.existsSync(s.ner));
});

test('API: fallback na graph.facebook.com přes /me/accounts', async () => {
  const s = kopieSveta('api-fb');
  const r = await sApi((u) => {
    const p = u.pathname.replace(/^\/v\d+\.\d+/, '');
    if (u.host !== 'graph.facebook.com') return [400, { error: { code: 190, message: 'Cannot parse access token' } }];
    if (p === '/me') return [200, { id: '1' }];
    if (p === '/me/accounts') return [200, { data: [{ id: 'p1' }, { id: 'p2', instagram_business_account: { id: '1784', username: 'radar_ricansko' } }] }];
    if (p === '/1784/media') return [200, { data: MEDIA }];
    if (p === '/200/comments') return [200, { data: KOM1.concat(KOM2) }];
    if (p === '/100/comments') return [200, { data: [] }];
    return [404, { error: { code: 100, message: 'nic' } }];
  }, ['--world', s.world, '--nerozpoznane', s.ner], {});
  assert.strictEqual(r.kod, 0, r.text);
  assert.deepStrictEqual(r.volani.slice(0, 2), ['graph.instagram.com/v21.0/me', 'graph.instagram.com/me']);
  assert.match(r.text, /účet: radar_ricansko \(1784\) přes graph\.facebook\.com/);
  assert.strictEqual(json(s.world).obce.length, 2);
});

test('API: chyba nebo rate-limit při stahování komentářů → nenulový kód, world.json beze změny', async () => {
  const s = kopieSveta('api-chyba'), pred = fs.readFileSync(s.world, 'utf8');
  // druhá stránka komentářů trvale vrací rate-limit
  const limit = await sApi(igHost({ '/200/comments': (u) => u.searchParams.get('after') ? [400, { error: { code: 4, message: `Application request limit reached access_token=${TOKEN}` } }] : [200, { data: KOM1, paging: { next: `https://graph.instagram.com/v21.0/200/comments?after=X&access_token=${TOKEN}` } }] }), ['--world', s.world, '--nerozpoznane', s.ner], {});
  assert.strictEqual(limit.kod, 1);
  assert.match(limit.text, /rate-limit/);
  assert.strictEqual(limit.volani.filter(v => v.endsWith('/200/comments')).length, 4, '1 stránka + 3 pokusy o druhou');
  // síťová chyba
  const sit = await sApi(igHost({ '/200/comments': () => Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNRESET' } }) }), ['--world', s.world, '--nerozpoznane', s.ner], {});
  assert.strictEqual(sit.kod, 1);
  // neplatný token na všech hostech
  const token = await sApi(() => [400, { error: { code: 190, message: 'Invalid OAuth access token' } }], ['--world', s.world, '--nerozpoznane', s.ner], {});
  assert.strictEqual(token.kod, 1);
  assert.strictEqual(token.volani.length, 4);
  // paging.next na cizí host se nenásleduje
  const cizi = await sApi(igHost({ '/200/comments': () => [200, { data: KOM1, paging: { next: `https://example.com/x?access_token=${TOKEN}` } }] }), ['--world', s.world, '--nerozpoznane', s.ner], {});
  assert.strictEqual(cizi.kod, 1);
  assert.strictEqual(fs.readFileSync(s.world, 'utf8'), pred);
  assert.ok(!fs.existsSync(s.ner));
  assert.ok(!fs.existsSync(path.join(path.dirname(s.world), 'world-live.json')), 'při chybě se nic nepublikuje');
  // dočasná chyba, která se po opakování spraví, běh nezastaví
  let n = 0;
  const ok = await sApi(igHost({ '/me/media': () => (++n < 3 ? [500, { error: { code: 2, message: 'Unexpected error', is_transient: true } }] : [200, { data: MEDIA }]) }), ['--dry', '--world', s.world, '--nerozpoznane', s.ner], {});
  assert.strictEqual(ok.kod, 0, ok.text);
});

test('token-info a refresh nevypisují token', async () => {
  const info = await sApi(igHost(), ['token-info'], {});
  assert.strictEqual(info.kod, 0);
  assert.match(info.text, /username: radar_ricansko/);
  assert.match(info.text, /user_id: 178/);
  const novy = 'IGNOVY_token-456';
  const ref = await sApi(igHost({ '/refresh_access_token': (u) => { assert.strictEqual(u.searchParams.get('grant_type'), 'ig_refresh_token'); return [200, { access_token: novy, token_type: 'bearer', expires_in: 5184000 }]; } }), ['refresh'], {});
  assert.strictEqual(ref.kod, 0, ref.text);
  assert.match(ref.text, /nová expirace: /);
  assert.match(ref.text, /POZOR/);
  assert.ok(!ref.text.includes(novy), 'nový token se nevypisuje');
  const stejny = await sApi(igHost({ '/refresh_access_token': () => [200, { access_token: TOKEN, expires_in: 5184000 }] }), ['refresh'], {});
  assert.ok(!/POZOR/.test(stejny.text));
});

(async () => {
  let chyb = 0;
  for (const [jmeno, fn] of testy) {
    try { await fn(); console.log('ok   ' + jmeno); }
    catch (e) { chyb++; console.log('FAIL ' + jmeno + '\n     ' + String(e && e.stack || e).split('\n').slice(0, 12).join('\n     ')); }
  }
  fs.rmSync(TMP, { recursive: true, force: true });
  console.log(chyb ? `\n${chyb} z ${testy.length} testů selhalo` : `\nvšech ${testy.length} testů prošlo`);
  process.exitCode = chyb ? 1 : 0;
})();
