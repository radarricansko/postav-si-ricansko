/* Proměnné pro scénáře dílů: {{pocet}}, {{top1}}, {{zakl_1}}… se dosadí z dat (world-dil.json) a z výsledků hlasování
   (tools/ig/navrhy/DATUM.json). Scénář = tools/video/dily/dil-N.json, viz docs/pribeh-hry.md.
   node tools/video/dil-data.js [--data world-dil.json] [--navrhy soubor.json] [--dil N]   -> vypíše proměnné (a nedosazená místa ve scénáři) */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '../..');
const cti = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } };
const OBCE = (cti(path.join(ROOT, 'tools/ig/obce-aliasy.json')) || { obce: [] }).obce;
const cz = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const nick = s => '@' + String(s || '').replace(/^@/, '');
// nejnovější soubor s výsledky hlasování
function posledniNavrhy(dir = path.join(ROOT, 'tools/ig/navrhy')) { try { const f = fs.readdirSync(dir).filter(x => /^\d{4}-\d{2}-\d{2}\.json$/.test(x)).sort().pop(); return f ? cti(path.join(dir, f)) : null; } catch (e) { return null; } }

function promenne(world, navrhy, opts = {}) {
  const obce = (world.obce || []).map(o => ({ id: o.id, nazev: o.nazev || (OBCE.find(x => x.id === o.id) || {}).nazev || o.id, hraci: (o.hraci || []).slice().sort((a, b) => String(a.datum).localeCompare(String(b.datum))), stavby: o.specialni_budovy || [] }));
  const s = obce.filter(o => o.hraci.length).sort((a, b) => b.hraci.length - a.hraci.length || a.nazev.localeCompare(b.nazev, 'cs'));
  const vse = s.flatMap(o => o.hraci.map(h => ({ ...h, obec: o.nazev })));
  const posl = vse.map(h => String(h.datum || '')).sort().pop() || '';
  const od = posl ? new Date(Date.parse(posl) - 864e5).toISOString() : '';
  const novi = vse.filter(h => String(h.datum || '') > od);
  const v = { dil: opts.dil || world.den_hry || 1, pocet: cz(vse.length), pocet_n: vse.length, novych: cz(novi.length), novych_n: novi.length, obci: 52, obci_s_hraci: s.length, obci_zivych: s.filter(o => o.hraci.length >= 5).length };
  s.slice(0, 3).forEach((o, i) => { v['top' + (i + 1)] = o.nazev; v['top' + (i + 1) + '_n'] = o.hraci.length; });
  if (s[0] && s[1]) v.rozdil = s[0].hraci.length - s[1].hraci.length;
  // derby: dvě obce (mimo první), které jsou si počtem nejblíž
  let d = null; for (let i = 1; i + 1 < s.length; i++) { const r = s[i].hraci.length - s[i + 1].hraci.length; if (s[i + 1].hraci.length >= 3 && (!d || r < d.r)) d = { a: s[i], b: s[i + 1], r }; }
  if (d) { v.derby_a = d.a.nazev; v.derby_b = d.b.nazev; v.derby_rozdil = d.r; }
  // zakladatelé: obec, která včera přibyla nejvíc a má aspoň 3 lidi
  const pri = {}; novi.forEach(h => { pri[h.obec] = (pri[h.obec] || 0) + 1; });
  const zo = s.filter((o, i) => o.hraci.length >= 3 && (i > 0 || s.length < 2 || s[1].hraci.length < 3)).sort((a, b) => (pri[b.nazev] || 0) - (pri[a.nazev] || 0) || b.hraci.length - a.hraci.length)[0];
  if (zo) { v.zakl_obec = zo.nazev; zo.hraci.slice(0, 3).forEach((h, i) => { v['zakl_' + (i + 1)] = nick(h.ig); }); }
  // prázdná obec: každý díl jiná
  const prazdne = OBCE.filter(o => !s.some(x => x.id === o.id || x.nazev === o.nazev)).map(o => o.nazev);
  if (prazdne.length) v.prazdna = prazdne[(v.dil * 7) % prazdne.length];
  v.prazdnych = prazdne.length;
  if (world.stat && world.stat.nazev) v.stat = world.stat.nazev;
  // poslední stavba
  const st = s.flatMap(o => o.stavby.map(b => ({ ...b, obec: o.nazev }))).sort((a, b) => String(b.datum || '').localeCompare(String(a.datum || '')))[0];
  if (st) { v.stavba = st.nazev_cedule || st.typ; v.stavba_obec = st.obec; if (st.autor) v.stavba_autor = nick(st.autor); }
  const hl = (navrhy && navrhy.hlasovani) || {};
  for (const k of ['nazev', 'vlajka', 'napad', 'mena', 'jidlo']) if (hl[k] && hl[k][0]) { v['hlas_' + k] = hl[k][0].text; if (hl[k][0].autori && hl[k][0].autori[0]) v['hlas_' + k + '_autor'] = nick(hl[k][0].autori[0]); }
  const top = navrhy && navrhy.navrhy && navrhy.navrhy[0]; if (top) { v.komentar = top.text; v.komentar_autor = nick(top.autor); }
  // výslovnost nicků pro hlas: bez zavináče, tečky a podtržítka jako mezery („{{zakl_1_hlas}}“)
  for (const k of Object.keys(v)) if (typeof v[k] === 'string' && v[k][0] === '@') v[k + '_hlas'] = v[k].slice(1).replace(/[._]+/g, ' ').replace(/(\D)(\d)/g, '$1 $2').trim();
  return v;
}
// dosadí {{klíč}} do všech textů scénáře; záběr s "kdyz": "klíč" se vypustí, když klíč chybí. Vrací { def, chybi: [...] }
function dosad(def, v) {
  const chybi = new Set();
  const txt = s => String(s).replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (m, k) => { if (v[k] == null || v[k] === '') { chybi.add(k); return m; } return String(v[k]); });
  const jdi = x => Array.isArray(x) ? x.map(jdi) : x && typeof x === 'object' ? Object.fromEntries(Object.entries(x).map(([k, y]) => [k, jdi(y)])) : typeof x === 'string' ? txt(x) : x;
  const out = { ...def, shots: (def.shots || []).filter(sh => !sh.kdyz || String(sh.kdyz).split(',').every(k => v[k.trim()] != null && v[k.trim()] !== '')) };
  return { def: jdi(out), chybi: [...chybi] };
}
module.exports = { promenne, dosad, posledniNavrhy };

if (require.main === module) {
  const arg = k => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : ''; };
  const world = cti(path.resolve(ROOT, arg('data') || (fs.existsSync(path.join(ROOT, 'world-dil.json')) ? 'world-dil.json' : 'world.json')));
  const nav = arg('navrhy') ? cti(path.resolve(ROOT, arg('navrhy'))) : posledniNavrhy();
  const v = promenne(world || { obce: [] }, nav, { dil: +arg('dil') || undefined });
  console.log(JSON.stringify(v, null, 1));
  if (arg('dil')) { const def = cti(path.join(__dirname, 'dily', `dil-${arg('dil')}.json`)); if (def) { const r = dosad(def, v); console.log('chybí:', r.chybi.join(', ') || 'nic'); console.log(r.def.shots.map(s => '· ' + s.vo).join('\n')); } }
}
