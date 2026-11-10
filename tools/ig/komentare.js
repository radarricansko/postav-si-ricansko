#!/usr/bin/env node
/* Postav si Říčansko – komentáře pod herním postem → world.json (náhrada Make scénářů 8385083 a 8387398).
   node tools/ig/komentare.js [--dry] [--publikovat] [--fixture soubor.json] [--world cesta] [--live cesta] [--stav cesta] [--nerozpoznane cesta]
   Komentáře se berou ze VŠECH postů s #postavsiricansko (díly hry). Denní rytmus: díl vyjde ráno, uzávěrka je v 17:00 (Praha).
     world.json      = koncept: všechno, co kdy přišlo (průběžně)
     world-dil.json  = stav k poslední uzávěrce → z něj se dělá video dalšího dílu a večer se na něm ladí mapa
     world-live.json = web: stav k uzávěrce před nejnovějším dílem. Mění se tedy jednou denně, ve chvíli, kdy vyjde nový díl.
   --publikovat: web hned ukáže celý koncept (do dalšího dílu). PUBLIKACE=hned: web = koncept při každém běhu.
   Po uzávěrce se jednou uloží tools/ig/navrhy/RRRR-MM-DD.json = nejlajkovanější komentáře dne pod nejnovějším dílem.
   env: IG_TOKEN, IG_MEDIA_ID, IG_MEDIA_URL (jen jeden post), POSTY_OD (YYYY-MM-DD, starší posty ignorovat), PUBLIKACE, UZAVERKA_HODINA (17), START_DATE (2026-11-16), IG_OWN (radar_ricansko), IG_API_VERSION (v21.0), NAVRHY_MIN_LIKES (1)
   Node 20+, bez závislostí. Token se nikdy nevypisuje (viz redact). */
const fs = require('fs'), path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const DATA = JSON.parse(fs.readFileSync(path.join(__dirname, 'obce-aliasy.json'), 'utf8'));
const HASHTAG = '#postavsiricansko';
const MAX_SLOV_VETA = 12;      // delší komentář už nebereme jako přihlášku (obec uprostřed věty)
const MAX_NEROZPOZNANE = 200;
const MAX_STRAN_KOMENTARU = 2000;
const cfg = { cekani: [3000, 10000] }; // pauzy mezi opakováním dočasných chyb (test si je nuluje)

/* ---------- parsování komentáře (logika modulu 2 a 3 z make/blueprint-komentare.json) ---------- */
const ALIAS = {}, NAZEV = {};
for (const o of DATA.obce) { NAZEV[o.id] = o.nazev; for (const a of o.aliasy) ALIAS[a] = o.id; }
const POV = DATA.povolani;                               // slovo → kanonické id
const PREFIX_RE = new RegExp('^\\s*((' + DATA.predpony.join('|') + ')\\s+)+');
const NICK_RE = new RegExp(DATA.filtr_nicku);
const IG_RE = /^[A-Za-z0-9._]{1,30}$/;                   // vzor ig ze schématu
const MAX_ALIAS_SLOV = Math.max(...Object.keys(ALIAS).map(a => a.split(' ').length));
const JEN_CELY = new Set(DATA.jen_cely_komentar || []);
// alias platí jen jako celý komentář, i když má před sebou předložku („v popovice“)
const jenCely = a => JEN_CELY.has(a) || JEN_CELY.has(a.replace(PREFIX_RE, ''));

const ascii = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
// malá písmena bez diakritiky, pryč @zmínky a URL, zbytek mimo a-z0-9 na mezery
const normText = s => ascii(s).replace(/(@\S+|https?:\/\/\S+)/g, ' ').replace(/[^a-z0-9 ]+/g, ' ');
const nevhodne = s => NICK_RE.test(ascii(s));

/* hlasování v komentáři: „název - Říčanská republika“, „vlajka - jelen, zelená a zlatá“, „nápad - metro do Říčan“.
   Všechno za klíčovým slovem je hlas, ne přihláška: obec se hledá jen v části před ním („Mukařov, vlajka - jelen“). */
const HLAS_SLOVA = { vlajka: 'vlajka', vlajku: 'vlajka', vlajky: 'vlajka', vlajce: 'vlajka', nazev: 'nazev', jmeno: 'nazev', napad: 'napad', navrh: 'napad', mena: 'mena', jidlo: 'jidlo' };
// „vlajka“ stačí samotná, u ostatních slov musí následovat pomlčka nebo dvojtečka („super nápad!“ hlas není)
const HLAS_RE = /(^|[^\p{L}])(?:(vlajk[auye])(?![\p{L}])\s*[-–—:=>]*|(n[aá]zev|jm[eé]no|n[aá]pad|n[aá]vrh|m[eě]na|j[ií]dlo)\s*[-–—:=>]+)\s*/giu;
function hlasy(text) {
  const t = String(text || ''), m = [...t.matchAll(HLAS_RE)], out = [];
  m.forEach((x, i) => {
    const od = x.index + x[0].length, po = i + 1 < m.length ? m[i + 1].index : t.length;
    const obsah = t.slice(od, po).replace(/\s+/g, ' ').replace(/^[\s,.;:–—-]+|[\s,;:–—-]+$/g, '');
    if (obsah) out.push({ druh: HLAS_SLOVA[ascii(x[2] || x[3])], text: zkrat(obsah, 80) });
  });
  return out;
}
function parsuj(text) {
  const prvniHlas = [...String(text || '').matchAll(HLAS_RE)][0];
  if (prvniHlas) text = String(text).slice(0, prvniHlas.index);
  const slova = normText(text).split(' ').filter(Boolean);
  let povolani = '';
  for (const s of slova) if (POV[s]) povolani = POV[s];   // poslední slovo povolání vyhrává (jako v Make)
  const zbytek = slova.filter(s => !POV[s]);
  const norm = zbytek.join(' ').replace(PREFIX_RE, '').trim();
  // 1) přesně jako Make: celý komentář po normalizaci = alias
  if (ALIAS[norm]) return { obec: ALIAS[norm], povolani, norm, zpusob: 'cely' };
  // 2) navíc: obec jako celé slovo/sousloví kdekoli v krátkém komentáři
  if (zbytek.length <= MAX_SLOV_VETA) {
    const shoda = (i) => {                                // nejdelší alias začínající na pozici i
      for (let n = Math.min(MAX_ALIAS_SLOV, zbytek.length - i); n >= 1; n--) {
        const f = zbytek.slice(i, i + n).join(' ');
        if (ALIAS[f] && !jenCely(f)) return { id: ALIAS[f], n };
      }
      return null;
    };
    const nalez = new Set();
    for (let i = 0; i < zbytek.length;) {
      const m = shoda(i);
      if (!m) { i++; continue; }
      nalez.add(m.id); i += m.n;
      // „Světic u Říčan“: obec za „u“ je jen upřesnění, nepočítá se
      if (zbytek[i] === 'u') { const u = shoda(i + 1); if (u) i += 1 + u.n; }
    }
    if (nalez.size === 1) return { obec: [...nalez][0], povolani, norm, zpusob: 'veta' };
    if (nalez.size > 1) return { obec: '', povolani, norm, duvod: 'vic_obci' };
  }
  return { obec: '', povolani, norm, duvod: 'neznama_obec' };
}

/* ---------- slučování do world.json ---------- */
// IG vrací „2026-11-16T08:00:00+0000“; do world.json jde ISO s „Z“
function iso(ts) {
  const d = new Date(String(ts || '').replace(/([+-]\d{2})(\d{2})$/, '$1:$2'));
  return isNaN(d) ? null : d.toISOString().replace(/\.\d{3}Z$/, 'Z');
}
function denHry(start, now) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || isNaN(Date.parse(start + 'T00:00:00Z'))) throw new Error('START_DATE musí být YYYY-MM-DD, je: ' + start);
  const p = {};
  for (const x of new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Prague', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)) p[x.type] = x.value;
  const dni = Math.round((Date.parse(`${p.year}-${p.month}-${p.day}T00:00:00Z`) - Date.parse(start + 'T00:00:00Z')) / 864e5);
  return Math.max(1, dni + 1);
}
const cmpId = (a, b) => { a = String(a); b = String(b); return a.length - b.length || (a < b ? -1 : a > b ? 1 : 0); };
const bezMeta = w => { const c = { ...w }; delete c.revize; delete c.aktualizovano; return JSON.stringify(c); };
const zkrat = (s, n) => [...String(s).replace(/\s+/g, ' ').trim()].slice(0, n).join('');

/* world = obsah world.json, komentare = [{id,text,username,timestamp,like_count}], vrací nový world a přehled změn.
   opts: now (Date), start (YYYY-MM-DD), vlastni [username], blokovane [username], minLikes */
function zpracuj(world, komentare, opts = {}) {
  const now = opts.now || new Date();
  const vlastni = new Set((opts.vlastni || ['radar_ricansko']).filter(Boolean).map(ascii));
  const blok = new Set((opts.blokovane || []).map(ascii));
  const minLikes = opts.minLikes == null ? 1 : opts.minLikes;
  const bylaUkazka = !!world.ukazka;
  const w = JSON.parse(JSON.stringify(world));
  delete w.ukazka;                                         // schéma pole ukazka nezná
  if (bylaUkazka) { w.obce = []; w.navrhy_dne = []; w.log_udalosti = []; }  // ukázková data pryč
  if (!Array.isArray(w.obce)) w.obce = [];
  if (!Array.isArray(w.navrhy_dne)) w.navrhy_dne = [];
  if (!Array.isArray(w.log_udalosti)) w.log_udalosti = [];
  if (w.verze == null) w.verze = 1;

  const hraci = new Map();                                 // ig lowercase → hráč
  for (const o of w.obce) { if (!Array.isArray(o.hraci)) o.hraci = []; for (const h of o.hraci) hraci.set(ascii(h.ig), h); }
  const obecById = new Map(w.obce.map(o => [o.id, o]));

  const kom = (Array.isArray(komentare) ? komentare : [])
    .map(c => ({ id: String(c.id), text: typeof c.text === 'string' ? c.text : '', username: String(c.username || (c.from && c.from.username) || ''), datum: iso(c.timestamp), likes: Math.max(0, parseInt(c.like_count, 10) || 0), parent: c.parent_id, media: c.media == null ? '' : String(c.media) }))
    .filter(c => c.username && c.datum && !c.parent)       // jen top-level komentáře s autorem a časem
    .sort((a, b) => (a.datum < b.datum ? -1 : a.datum > b.datum ? 1 : cmpId(a.id, b.id)));

  const novi = [], doplneno = [], odmitnuti = new Map(), nerozpoznane = [], hl = [];
  let vlastnich = 0, duplicit = 0;
  for (const c of kom) {
    const u = ascii(c.username);
    if (vlastni.has(u)) { vlastnich++; continue; }
    if (blok.has(u)) { odmitnuti.set(u, 'blokovaný účet'); continue; }
    const p = parsuj(c.text), ch = hlasy(c.text);
    if (IG_RE.test(c.username) && !nevhodne(c.username)) for (const x of ch) if (!NICK_RE.test(normText(x.text))) hl.push({ druh: x.druh, text: x.text, autor: c.username, lajky: c.likes, datum: c.datum, media: c.media });
    const h = hraci.get(u);
    if (h) {
      // jeden účet = jeden domek; pozdější komentář může jen doplnit chybějící povolání
      if (!h.povolani && p.povolani && !(c.datum < h.datum)) { h.povolani = p.povolani; doplneno.push({ ig: h.ig, povolani: p.povolani }); }
      else if (p.obec && c.datum !== h.datum) duplicit++;
      continue;
    }
    if (!p.obec && ch.length) continue;                    // jen hlas bez obce – není to nerozpoznaná přihláška
    if (!p.obec) { nerozpoznane.push({ username: c.username, text: zkrat(c.text, 300), timestamp: c.datum, duvod: p.duvod }); continue; }
    if (nevhodne(c.username)) { odmitnuti.set(u, 'nevhodný nick'); continue; }
    if (!IG_RE.test(c.username)) { odmitnuti.set(u, 'neplatný username'); continue; }
    let o = obecById.get(p.obec);
    if (!o) { o = { id: p.obec, nazev: NAZEV[p.obec], pocet_hracu: 0, hraci: [], specialni_budovy: [] }; w.obce.push(o); obecById.set(o.id, o); }
    const cislo = o.hraci.reduce((m, x) => Math.max(m, x.cislo_obyvatele | 0), 0) + 1;
    const hrac = { ig: c.username, cislo_obyvatele: cislo, datum: c.datum, odznaky: [o.hraci.length === 0 ? 'prvni_v_obci' : 'novacek'] };
    if (p.povolani) hrac.povolani = p.povolani;
    o.hraci.push(hrac); hraci.set(u, hrac);
    novi.push({ ig: hrac.ig, obec: o.id, cislo, povolani: p.povolani || '' });
  }
  const nerozp = nerozpoznane.filter(n => !hraci.has(ascii(n.username)) && !odmitnuti.has(ascii(n.username))).slice(-MAX_NEROZPOZNANE);
  const prehled = { komentaru: kom.length, novi, doplneno, odmitnuti: [...odmitnuti].map(([ig, duvod]) => ({ ig, duvod })), nerozpoznane: nerozp, vlastnich, duplicit, hracu: hraci.size, hlasy: hl, ukazkaZahozena: false };

  // dokud není žádný skutečný hráč, ukázkový world.json necháme být
  if (bylaUkazka && hraci.size === 0) return { ...prehled, world, zmena: false };
  prehled.ukazkaZahozena = bylaUkazka;

  for (const o of w.obce) { o.pocet_hracu = o.hraci.length; if (!Array.isArray(o.specialni_budovy)) o.specialni_budovy = []; }

  // navrhy_dne: ruční položky zůstávají, položky „ig-…“ = top 10 komentářů podle lajků
  // nápady se berou jen z nejnovějšího dílu (opts.navrhyMedia), ať se nemíchají s minulými
  const top = kom.filter(c => (!opts.navrhyMedia || c.media === String(opts.navrhyMedia)) && (!opts.navrhyDo || c.datum <= opts.navrhyDo) && c.likes >= minLikes && c.text.trim() && !vlastni.has(ascii(c.username)) && !blok.has(ascii(c.username)) && IG_RE.test(c.username) && !nevhodne(c.username) && !NICK_RE.test(normText(c.text)))
    .sort((a, b) => b.likes - a.likes || (a.datum < b.datum ? -1 : a.datum > b.datum ? 1 : cmpId(a.id, b.id))).slice(0, 10)
    .map(c => { const ob = parsuj(c.text).obec; const n = { id: 'ig-' + c.id }; if (ob) n.obec_id = ob; return Object.assign(n, { text: zkrat(c.text, 140), autor: c.username, hlasy: c.likes, datum: c.datum }); });
  w.navrhy_dne = w.navrhy_dne.filter(n => !String(n.id).startsWith('ig-')).concat(top);

  w.den_hry = denHry(opts.start || '2026-11-16', now);
  const zmena = bezMeta(w) !== bezMeta(world);
  if (zmena) { w.revize = (parseInt(world.revize, 10) || 0) + 1; w.aktualizovano = now.toISOString().replace(/\.\d{3}Z$/, 'Z'); }
  return { ...prehled, world: zmena ? w : world, zmena };
}

// hlasy → pořadí: stejné texty (bez diakritiky a velikosti písmen) se sčítají; body = počet komentářů + jejich lajky
function sectiHlasy(hl) {
  const out = {};
  for (const h of hl) {
    const k = normText(h.text).replace(/\s+/g, ' ').trim(); if (!k) continue;
    const sk = (out[h.druh] = out[h.druh] || new Map());
    const z = sk.get(k) || { text: h.text, body: 0, komentaru: 0, lajku: 0, autori: [] };
    z.komentaru++; z.lajku += h.lajky; z.body = z.komentaru + z.lajku; if (z.autori.length < 5 && !z.autori.includes(h.autor)) z.autori.push(h.autor);
    sk.set(k, z);
  }
  for (const d of Object.keys(out)) out[d] = [...out[d].values()].sort((a, b) => b.body - a.body || a.text.localeCompare(b.text, 'cs')).slice(0, 15);
  return out;
}

/* ---------- uzávěrka a řez světa ---------- */
const PRAHA = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Prague', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
const vPraze = d => { const o = {}; for (const p of PRAHA.formatToParts(d)) o[p.type] = p.value; return o; };
const bezMs = d => d.toISOString().replace(/\.\d{3}Z$/, 'Z');
// okamžik (Date), kdy je v Praze daný den HH:00
function prahaCas(den, hodina) {
  let t = Date.parse(`${den}T${String(hodina).padStart(2, '0')}:00:00Z`);
  for (let i = 0; i < 3; i++) { const p = vPraze(new Date(t)); t -= Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`) - Date.parse(`${den}T${String(hodina).padStart(2, '0')}:00:00Z`); }
  return new Date(t);
}
const denPlus = (den, n) => new Date(Date.parse(den + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
// poslední uzávěrka (HH:00 pražského času), která nastala nejpozději v okamžiku `kdy`; vrací { den, cas (ISO) }
function uzaverkaPred(kdy, hodina = 17) {
  const d = new Date(kdy), p = vPraze(d); let den = `${p.year}-${p.month}-${p.day}`;
  if (prahaCas(den, hodina) > d) den = denPlus(den, -1);
  return { den, cas: bezMs(prahaCas(den, hodina)) };
}
// svět jen s hráči do `hraciDo` a stavbami do `budovyDo` (ISO časy); čísla obyvatel se nemění
function rez(world, hraciDo, budovyDo) {
  const w = JSON.parse(JSON.stringify(world));
  if (!Array.isArray(w.obce)) return w;
  for (const o of w.obce) {
    o.hraci = (o.hraci || []).filter(h => !h.datum || iso(h.datum) <= hraciDo);
    o.pocet_hracu = o.hraci.length;
    o.specialni_budovy = (o.specialni_budovy || []).filter(b => !b.datum || !budovyDo || iso(b.datum) <= budovyDo);
  }
  w.obce = w.obce.filter(o => o.hraci.length || o.specialni_budovy.length);
  if (w.stat && w.stat.datum && budovyDo && iso(w.stat.datum) > budovyDo) delete w.stat;   // název a vlajka se na webu objeví až s dílem
  if (Array.isArray(w.log_udalosti)) w.log_udalosti = w.log_udalosti.filter(e => !e.datum || iso(e.datum) <= (budovyDo || hraciDo));
  return w;
}

/* ---------- Graph API ---------- */
let TOKEN = '';
const redact = s => { s = String(s); if (TOKEN) s = s.split(TOKEN).join('***'); return s.replace(/access_token=[^&\s"']+/g, 'access_token=***'); };
const log = (...a) => console.log(a.map(redact).join(' '));
const sleep = ms => new Promise(r => setTimeout(r, ms));
class ApiError extends Error { constructor(msg, x = {}) { super(msg); Object.assign(this, x); } }

function adresa(base, cesta, params = {}) {
  const u = new URL(base + cesta);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  u.searchParams.set('access_token', TOKEN);
  return u.toString();
}
// GET s opakováním při rate-limitu a dočasných chybách; chybová hláška je vždy bez tokenu
async function api(url) {
  for (let pokus = 0; ; pokus++) {
    let chyba;
    try {
      const r = await fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(30000) });
      const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch (e) { }
      if (r.ok && j && !j.error) return j;
      const er = (j && j.error) || {};
      const limit = r.status === 429 || [4, 17, 32, 613].includes(er.code);
      chyba = new ApiError(`HTTP ${r.status}${er.code != null ? ' kód ' + er.code : ''}${limit ? ' (rate-limit)' : ''}: ${redact(er.message || t.slice(0, 200))}`, { status: r.status, code: er.code, docasna: limit || r.status >= 500 || er.is_transient === true });
    } catch (e) {
      chyba = new ApiError('síť: ' + redact((e.cause && (e.cause.code || e.cause.message)) || e.name || e.message), { docasna: true });
    }
    if (!chyba.docasna || pokus >= cfg.cekani.length) throw chyba;
    await sleep(cfg.cekani[pokus]);
  }
}
// projde stránky přes paging.next; další adresa musí vést na stejný host (nese token)
async function* stranky(conn, url, maxStran, pres) {
  for (let n = 0; url; n++) {
    if (n >= maxStran) { if (pres === 'chyba') throw new ApiError('víc než ' + maxStran + ' stránek, končím'); return; }
    const j = await api(url);
    yield Array.isArray(j.data) ? j.data : [];
    url = j.paging && j.paging.next;
    if (url && new URL(url).origin !== new URL(conn.base).origin) throw new ApiError('paging.next vede na jiný host');
  }
}

// zkusí graph.instagram.com (s verzí i bez), pak graph.facebook.com; vrátí {druh, base, id, username, mediaCesta}
async function pripoj(env = process.env) {
  const ver = env.IG_API_VERSION || 'v21.0';
  const zakladny = [['ig', `https://graph.instagram.com/${ver}`], ['ig', 'https://graph.instagram.com'], ['fb', `https://graph.facebook.com/${ver}`], ['fb', 'https://graph.facebook.com']];
  for (const [druh, base] of zakladny) {
    try {
      if (druh === 'ig') {
        const me = await api(adresa(base, '/me', { fields: 'user_id,username' }));
        return { druh, base, id: String(me.user_id || me.id), username: me.username || '', mediaCesta: '/me/media' };
      }
      await api(adresa(base, '/me', { fields: 'id' }));
      // user token: IG účet visí na FB stránce; page token: přímo na /me
      let ucty = [];
      try { const acc = await api(adresa(base, '/me/accounts', { fields: 'instagram_business_account{id,username}', limit: '100' })); ucty = (acc.data || []).map(p => p.instagram_business_account).filter(Boolean); } catch (e) { }
      if (!ucty.length) { try { const pg = await api(adresa(base, '/me', { fields: 'instagram_business_account{id,username}' })); if (pg.instagram_business_account) ucty = [pg.instagram_business_account]; } catch (e) { } }
      // system-user token (Unified login): /me je systémový uživatel, IG účet je přiřazený asset → zkusit přímo ID účtu
      if (!ucty.length) { const uid = String(env.IG_USER_ID || '17841474213627967'); try { const u = await api(adresa(base, '/' + uid, { fields: 'id,username' })); if (u && u.id) ucty = [{ id: u.id, username: u.username || '' }]; } catch (e) { log(`  ${base.replace('https://', '')}: /${uid} selhalo – ${e.message}`); } }
      if (!ucty.length) throw new ApiError('token nevidí žádný Instagram business účet');
      const own = ascii(env.IG_OWN || 'radar_ricansko');
      const ig = ucty.find(a => ascii(a.username) === own) || ucty[0];
      return { druh, base, id: String(ig.id), username: ig.username || '', mediaCesta: `/${ig.id}/media` };
    } catch (e) { log(`  ${base.replace('https://', '')}: /me selhalo – ${e.message}`); }
  }
  throw new ApiError('/me selhalo na graph.instagram.com i graph.facebook.com (neplatný token, nebo nedostupná síť – viz výše)');
}

const MEDIA_POLE = 'id,caption,permalink,timestamp,comments_count';
function shortcode(s) {
  s = String(s || '').trim();
  const m = s.match(/\/(?:p|reels?|tv)\/([A-Za-z0-9_-]+)/);
  return m ? m[1] : (/^[A-Za-z0-9_-]{5,}$/.test(s) ? s : '');
}
// herní posty: IG_MEDIA_ID / IG_MEDIA_URL = právě ten jeden post; jinak všechna média s hashtagem (díly hry), od nejstaršího.
// [] = nenalezeno (vypíše seznam posledních médií)
const MAX_STRAN_MEDII = 8;
async function najdiPosty(conn, env = process.env) {
  let id = String(env.IG_MEDIA_ID || '').trim(), odkaz = String(env.IG_MEDIA_URL || '').trim();
  if (id && !/^\d+$/.test(id)) { odkaz = id; id = ''; }   // do IG_MEDIA_ID přišel odkaz nebo shortcode
  if (id) return [await api(adresa(conn.base, '/' + id, { fields: MEDIA_POLE }))];
  const sc = shortcode(odkaz), prvni = [], nalezene = [];
  const od = /^\d{4}-\d{2}-\d{2}$/.test(String(env.POSTY_OD || '').trim()) ? String(env.POSTY_OD).trim() : '';
  if (odkaz && !sc) log('IG_MEDIA_URL není permalink ani shortcode:', odkaz);
  if (!odkaz || sc) {
    for await (const str of stranky(conn, adresa(conn.base, conn.mediaCesta, { fields: MEDIA_POLE, limit: '50' }), sc ? 10 : MAX_STRAN_MEDII, 'stop')) {
      if (prvni.length < 10) prvni.push(...str.slice(0, 10 - prvni.length));
      if (sc) { const m = str.find(m => String(m.permalink || '').includes('/' + sc + '/') || String(m.permalink || '').endsWith('/' + sc)); if (m) return [m]; continue; }
      nalezene.push(...str.filter(m => m && m.id && ascii(m.caption).includes(HASHTAG) && (!od || (iso(m.timestamp) || '').slice(0, 10) >= od)));
      // média chodí od nejnovějších: jakmile je celá stránka starší než POSTY_OD, dál už nic nebude
      if (od && str.length && str.every(m => (iso(m.timestamp) || '9').slice(0, 10) < od)) break;
    }
  }
  if (nalezene.length) { const videno = new Set(); return nalezene.filter(m => !videno.has(m.id) && videno.add(m.id)).sort((a, b) => (iso(a.timestamp) || '').localeCompare(iso(b.timestamp) || '') || cmpId(a.id, b.id)); }
  log(sc ? `Herní post se shortcodem „${sc}“ jsem mezi médii nenašel.` : `Žádné médium nemá v popisku ${HASHTAG}${od ? ' (od ' + od + ')' : ''} a IG_MEDIA_ID / IG_MEDIA_URL není nastaveno.`);
  log('Posledních 10 médií (id · datum · začátek popisku · odkaz):');
  for (const m of prvni) log(`  ${m.id} · ${(iso(m.timestamp) || '?').slice(0, 10)} · ${JSON.stringify(zkrat(m.caption || '', 60))} · ${m.permalink || ''}`);
  if (!prvni.length) log('  (účet nevrátil žádná média)');
  return [];
}
async function nactiKomentare(conn, mediaId) {
  const vse = [];
  const prvni = adresa(conn.base, `/${mediaId}/comments`, { fields: 'id,text,username,timestamp,like_count,from', limit: '50' });
  for await (const str of stranky(conn, prvni, MAX_STRAN_KOMENTARU, 'chyba')) vse.push(...str);
  const videno = new Set();                                // stránkování může komentář vrátit dvakrát
  return vse.filter(c => c && c.id && !videno.has(c.id) && videno.add(c.id)).map(c => ({ ...c, media: String(mediaId) }));
}

/* ---------- režimy token-info a refresh ---------- */
const datumCz = d => new Intl.DateTimeFormat('cs-CZ', { timeZone: 'Europe/Prague', dateStyle: 'medium', timeStyle: 'short' }).format(d);
async function tokenInfo(env) {
  const c = await pripoj(env);
  log('host:', c.base.replace('https://', ''));
  log('username:', c.username || '?');
  log('user_id:', c.id);
  if (c.druh === 'fb') {
    try {
      const d = (await api(adresa(c.base, '/debug_token', { input_token: TOKEN }))).data || {};
      log('platnost tokenu:', d.expires_at ? datumCz(new Date(d.expires_at * 1000)) : 'bez expirace');
      if (d.data_access_expires_at) log('přístup k datům do:', datumCz(new Date(d.data_access_expires_at * 1000)));
    } catch (e) { log('platnost tokenu: nepodařilo se zjistit –', e.message); }
  } else log('platnost tokenu: graph.instagram.com ji neumí vrátit; `refresh` token prodlouží a expiraci vypíše');
  return 0;
}
async function refresh(env) {
  const c = await pripoj(env);
  if (c.druh !== 'ig') { log('refresh umí jen token z „Instagram API“ (graph.instagram.com); tenhle token je facebookový.'); return 1; }
  const j = await api(adresa('https://graph.instagram.com', '/refresh_access_token', { grant_type: 'ig_refresh_token' }));
  log('token prodloužen, nová expirace:', j.expires_in ? datumCz(new Date(Date.now() + j.expires_in * 1000)) : 'neznámá');
  if (j.access_token && j.access_token !== TOKEN) log('POZOR: API vrátilo jiný token, než je v IG_TOKEN. Skript ho schválně nevypisuje ani neukládá – nový token je potřeba vygenerovat a ručně uložit do secretu IG_TOKEN.');
  return 0;
}

/* ---------- hlavní běh ---------- */
function zapis(soubor, text) { const tmp = soubor + '.tmp'; fs.writeFileSync(tmp, text); fs.renameSync(tmp, soubor); }
async function main(argv = process.argv.slice(2), env = process.env) {
  const arg = k => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : ''; };
  const dry = argv.includes('--dry'), vynutit = argv.includes('--publikovat'), fixture = arg('fixture'), rezim = argv[0] && !argv[0].startsWith('--') ? argv[0] : '';
  const worldCesta = arg('world') || path.join(ROOT, 'world.json'), nerCesta = arg('nerozpoznane') || path.join(__dirname, 'nerozpoznane.json');
  const liveCesta = arg('live') || path.join(path.dirname(worldCesta), 'world-live.json'), dilCesta = arg('dil') || path.join(path.dirname(worldCesta), 'world-dil.json'), stavCesta = arg('stav') || path.join(path.dirname(nerCesta), 'stav.json');
  const rezimPub = String(env.PUBLIKACE || '').trim().toLowerCase() === 'hned' ? 'hned' : 'dil';
  const hodina = Math.min(23, Math.max(0, parseInt(env.UZAVERKA_HODINA, 10) || 17)), ted = env.TED ? new Date(env.TED) : new Date();   // TED = čas pro testy
  TOKEN = String(env.IG_TOKEN || '').trim();
  if (rezim && rezim !== 'token-info' && rezim !== 'refresh') { log('neznámý režim:', rezim, '(umím token-info, refresh)'); return 1; }
  if (!fixture && !TOKEN) { log('IG_TOKEN není nastaven – nic nedělám, world.json zůstává beze změny.'); return 0; }
  if (rezim === 'token-info') return tokenInfo(env);
  if (rezim === 'refresh') return refresh(env);

  const world = JSON.parse(fs.readFileSync(worldCesta, 'utf8'));
  if (!world || typeof world !== 'object' || Array.isArray(world)) throw new Error('world.json není objekt');
  const vlastni = [env.IG_OWN || 'radar_ricansko'];
  let komentare, posty = [];
  if (fixture) {
    komentare = JSON.parse(fs.readFileSync(fixture, 'utf8'));
    if (!Array.isArray(komentare)) throw new Error('fixture musí být pole komentářů');
    log(`fixture: ${komentare.length} komentářů z ${path.basename(fixture)}`);
  } else {
    const conn = await pripoj(env);
    vlastni.push(conn.username);
    log(`účet: ${conn.username || '?'} (${conn.id}) přes ${conn.base.replace('https://', '')}`);
    posty = await najdiPosty(conn, env);
    if (!posty.length) { log('Herní post nenalezen – world.json zůstává beze změny.'); return 0; }
    if (posty.length > 1) log(`herních postů (dílů) s ${HASHTAG}: ${posty.length}`);
    komentare = [];
    for (const post of posty) {
      log(`herní post: ${post.id} · ${(iso(post.timestamp) || '').slice(0, 10)} · ${post.permalink || ''} · komentářů podle IG: ${post.comments_count == null ? '?' : post.comments_count}`);
      komentare.push(...await nactiKomentare(conn, post.id));
    }
  }
  let blokovane = [];
  try { blokovane = JSON.parse(fs.readFileSync(path.join(__dirname, 'blokovane.json'), 'utf8')); } catch (e) { }   // nepovinný seznam usernamů
  const posledni = posty.length ? posty[posty.length - 1] : null;
  const v = zpracuj(world, komentare, { navrhyMedia: posledni && posty.length > 1 ? posledni.id : '', navrhyDo: posledni ? bezMs(new Date(Date.parse(uzaverkaPred(iso(posledni.timestamp) || bezMs(ted), hodina).cas) + 864e5)) : '', now: ted, start: (env.START_DATE || '').trim() || '2026-11-16', vlastni, blokovane: Array.isArray(blokovane) ? blokovane : [], minLikes: env.NAVRHY_MIN_LIKES ? parseInt(env.NAVRHY_MIN_LIKES, 10) || 0 : 1 });

  log(`komentářů: ${v.komentaru} · nových hráčů: ${v.novi.length} · doplněných povolání: ${v.doplneno.length} · odmítnutých účtů: ${v.odmitnuti.length} · nerozpoznaných: ${v.nerozpoznane.length} · přeskočeno (vlastní účet / další komentář hráče): ${v.vlastnich} / ${v.duplicit} · hráčů celkem: ${v.hracu}`);
  for (const n of v.novi) log(`  + @${n.ig} → ${n.obec} č. ${n.cislo}${n.povolani ? ' (' + n.povolani + ')' : ''}`);
  for (const d of v.doplneno) log(`  ~ @${d.ig}: povolání ${d.povolani}`);
  for (const o of v.odmitnuti) log(`  x @${o.ig}: ${o.duvod}`);
  for (const n of v.nerozpoznane) log(`  ? @${n.username} (${n.duvod}): ${JSON.stringify(zkrat(n.text, 120))}`);
  if (v.ukazkaZahozena) log('ukázková data z world.json zahozena, začínám z prázdných obcí');
  log(v.zmena ? `world.json: změna, revize ${v.world.revize}, den hry ${v.world.den_hry}` : 'world.json: beze změny');

  // koncept (world.json) → díl (world-dil.json, stav k poslední uzávěrce) → web (world-live.json, stav k uzávěrce před nejnovějším dílem)
  const txt = w => JSON.stringify(w, null, 1) + '\n';
  const cti = f => { try { return fs.readFileSync(f, 'utf8'); } catch (e) { return null; } };
  const pocet = w => (w.obce || []).reduce((n, o) => n + (o.hraci || []).length, 0);
  const konceptText = v.zmena ? txt(v.world) : fs.readFileSync(worldCesta, 'utf8');
  let stav = {}; try { stav = JSON.parse(fs.readFileSync(stavCesta, 'utf8')) || {}; } catch (e) { }
  const ukazka = !!v.world.ukazka;                          // ukázková data se neřežou
  const uz = uzaverkaPred(ted, hodina);
  const dil = ukazka ? v.world : rez(v.world, uz.cas, '');
  const dilText = ukazka ? konceptText : txt(dil);
  let rucne = stav.rucne && stav.rucne.kdy ? String(stav.rucne.kdy) : '';
  if (vynutit) rucne = bezMs(ted);
  let liveText = null, popis = '';
  if (rezimPub === 'hned' || ukazka) { liveText = konceptText; popis = ukazka ? 'ukázková data' : 'režim „hned“ – celý koncept'; }
  else if (posledni) {
    const vydano = iso(posledni.timestamp) || bezMs(ted);
    const zaDil = uzaverkaPred(vydano, hodina).cas;
    // ruční publikace platí, dokud nevyjde další díl
    if (rucne && rucne > vydano) { liveText = txt(rez(v.world, rucne, rucne)); popis = `ruční publikace ${rucne}`; }
    else { rucne = ''; liveText = txt(rez(v.world, zaDil, vydano)); popis = `díl z ${vydano.slice(0, 16)}Z → uzávěrka ${zaDil.slice(0, 16)}Z`; }
  } else if (vynutit) { liveText = konceptText; popis = 'ruční publikace'; }
  const live = cti(liveCesta), publikovat = liveText != null && liveText !== live;
  const naWebu = liveText != null ? pocet(JSON.parse(liveText)) : null;
  log(`díl (uzávěrka ${uz.den} ${hodina}:00): ${pocet(dil)} hráčů · koncept: ${v.hracu} hráčů`);
  log(liveText == null ? 'web: beze změny (žádný díl s hashtagem)' : `web: ${publikovat ? 'MĚNÍM' : 'beze změny'} – ${naWebu} hráčů (${popis})`);
  const novyStav = { rezim: rezimPub, uzaverka_hodina: hodina, posty: posty.length ? posty.map(p => ({ id: String(p.id), odkaz: p.permalink || '', datum: iso(p.timestamp) || '' })) : (stav.posty || []) };
  if (rucne) novyStav.rucne = { kdy: rucne };
  // nápady dne: jednou po uzávěrce se uloží pořadí komentářů pod nejnovějším dílem
  let navrhySoubor = '', navrhyText = '';
  if (posledni && !ukazka && uzaverkaPred(iso(posledni.timestamp) || bezMs(ted), hodina).cas < uz.cas) {
    navrhySoubor = path.join(path.dirname(stavCesta), 'navrhy', uz.den + '.json');
    navrhyText = txt({ den: uz.den, uzaverka: uz.cas, dil: { id: String(posledni.id), odkaz: posledni.permalink || '' }, hlasovani: sectiHlasy(v.hlasy.filter(h => (posty.length < 2 || h.media === String(posledni.id)) && h.datum <= uz.cas)), navrhy: (v.world.navrhy_dne || []).filter(n => String(n.id).startsWith('ig-')) });
    if (fs.existsSync(navrhySoubor)) navrhySoubor = '';      // už uloženo, pořadí se po uzávěrce nemění
    else log(`nápady dne ${uz.den}: uloženo ${JSON.parse(navrhyText).navrhy.length} (tools/ig/navrhy/${uz.den}.json)`);
  }

  const nerText = JSON.stringify(v.nerozpoznane.map(({ username, text, timestamp }) => ({ username, text, timestamp })), null, 1) + '\n';
  if (dry) { log('--dry: nic nezapisuji'); return 0; }
  if (v.zmena) zapis(worldCesta, konceptText);
  if (cti(dilCesta) !== dilText) zapis(dilCesta, dilText);
  if (publikovat) zapis(liveCesta, liveText);
  if (posty.length || vynutit) { const st = txt(novyStav); if (cti(stavCesta) !== st) zapis(stavCesta, st); }
  if (navrhySoubor) { fs.mkdirSync(path.dirname(navrhySoubor), { recursive: true }); zapis(navrhySoubor, navrhyText); }
  let stare = null; try { stare = fs.readFileSync(nerCesta, 'utf8'); } catch (e) { }
  if (stare !== nerText) zapis(nerCesta, nerText);
  if (env.GITHUB_OUTPUT) fs.appendFileSync(env.GITHUB_OUTPUT, `novi=${v.novi.length}\nzmena=${v.zmena}\npublikovano=${publikovat}\n`);
  return 0;
}

module.exports = { hlasy, sectiHlasy, uzaverkaPred, rez, parsuj, normText, zpracuj, denHry, iso, shortcode, redact, main, cfg, DATA };
if (require.main === module) main().then(k => { process.exitCode = k; }, e => { console.error('CHYBA: ' + redact(e && e.message || e)); process.exitCode = 1; });
