/*!
 * reel.js — RADAR Říčansko · „Postav si Říčansko“
 * Generátor denního IG reelu (9:16, 1080×1920) z běžící hry.
 * Bez závislostí. Hra musí vystavit window.GAME (viz README.md).
 *
 *   REEL.scriptFromDay(dayData [, opts]) -> script
 *   REEL.play(script [, opts])           -> Promise   (náhled + TTS voiceover)
 *   REEL.record(script [, opts])         -> Promise<Blob>  (video + hudba + SFX [+ voice track])
 *   REEL.voiceScript(script)             -> {text, segments, srt, plain}
 *   REEL.setVoiceTrack(AudioBuffer|url|Blob|null) -> Promise
 *   REEL.stop(), REEL.canvas, REEL.snapshot(type, quality)
 */
(function (root) {
  'use strict';

  // ------------------------------------------------------------------ konstanty
  var W = 1080, H = 1920, FPS = 30;
  var SAFE_TOP = 220, SAFE_BOTTOM = 380;           // IG safe zóny
  var C = {
    navy: '#0b1430', navy2: '#13224f', blue: '#2f72d6', sky: '#5fa8e8', ice: '#bfe0ff',
    yellow: '#ffd23f', white: '#ffffff', ink: '#0b1430', red: '#ff4d5e'
  };
  var FONT = '"Space Grotesk", "Inter", "Segoe UI", Roboto, Arial, sans-serif';
  var TIERS = {
    wood:   { label: 'DŘEVĚNÁ LIGA',   c1: '#c98a4b', c2: '#7a4a22', fg: '#fff' },
    silver: { label: 'STŘÍBRNÁ LIGA',  c1: '#eef3fa', c2: '#9fadc2', fg: C.ink },
    gold:   { label: 'ZLATÁ LIGA',     c1: '#ffe27a', c2: '#e0a400', fg: C.ink },
    plat:   { label: 'PLATINOVÁ LIGA', c1: '#d9fbff', c2: '#6fd3e6', fg: C.ink }
  };

  // ------------------------------------------------------------------ utility
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function prog(t, a, b) { return clamp((t - a) / (b - a), 0, 1); }
  var E = {
    outCubic: function (t) { return 1 - Math.pow(1 - t, 3); },
    inCubic: function (t) { return t * t * t; },
    inOut: function (t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; },
    outExpo: function (t) { return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t); },
    outBack: function (t) { var c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
    outElastic: function (t) { return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - .75) * (2 * Math.PI / 3)) + 1; }
  };
  function up(s) { return String(s == null ? '' : s).toLocaleUpperCase('cs-CZ'); }
  function fmt(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
  function hash(s) { var h = 2166136261; s = String(s); for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  // české skloňování: plural(n, 'obyvatel', 'obyvatelé', 'obyvatel')
  function plural(n, one, few, many) { n = Math.abs(n); return n === 1 ? one : (n >= 2 && n <= 4) ? few : many; }
  function font(size, weight) { return (weight || 800) + ' ' + Math.round(size) + 'px ' + FONT; }
  function now() { return (root.performance && performance.now) ? performance.now() : Date.now(); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  // časovač scén: online setTimeout, offline (frames) virtuální čas, při renderAudio nic
  var VT = null;
  function later(fn, ms) {
    if (R.audioOnly) return;
    if (VT) VT.timers.push({ at: VT.t + ms, fn: fn }); else setTimeout(fn, ms);
  }
  function G() { return root.GAME || null; }
  function gcall(name) {
    var g = G(), args = [].slice.call(arguments, 1);
    if (!g || typeof g[name] !== 'function' || R.audioOnly) return Promise.resolve();
    try { return Promise.resolve(g[name].apply(g, args)).catch(function () {}); } catch (e) { return Promise.resolve(); }
  }
  function rr(g, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  function spacedWidth(g, s, sp) { var w = 0; for (var i = 0; i < s.length; i++) w += g.measureText(s[i]).width + (i < s.length - 1 ? sp : 0); return w; }
  function spacedText(g, s, x, y, sp, align) {
    var w = spacedWidth(g, s, sp), cx = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
    var a = g.textAlign; g.textAlign = 'left';
    for (var i = 0; i < s.length; i++) { g.fillText(s[i], cx, y); cx += g.measureText(s[i]).width + sp; }
    g.textAlign = a; return w;
  }
  function fitSize(g, text, maxW, size, weight, min) {
    g.font = font(size, weight);
    var w = g.measureText(text).width;
    if (w <= maxW) return size;
    return Math.max(min || 10, Math.floor(size * maxW / w));
  }
  function wrap(g, text, maxW) {
    var words = String(text).split(/\s+/), lines = [], cur = '';
    for (var i = 0; i < words.length; i++) {
      var t = cur ? cur + ' ' + words[i] : words[i];
      if (g.measureText(t).width > maxW && cur) { lines.push(cur); cur = words[i]; } else cur = t;
    }
    if (cur) lines.push(cur);
    return lines;
  }
  function svgToImage(svg) {
    return new Promise(function (res) {
      if (!svg) return res(null);
      var img = new Image();
      img.onload = function () { res(img); };
      img.onerror = function () { res(null); };
      if (/^(data:|https?:|blob:|\.?\/)/.test(svg)) img.src = svg;
      else {
        if (!/xmlns=/.test(svg)) svg = svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
      }
      setTimeout(function () { res(img.complete && img.naturalWidth ? img : null); }, 2500);
    });
  }
  function loadImage(src) {
    return new Promise(function (res) {
      if (!src) return res(null);
      var img = new Image(); img.crossOrigin = 'anonymous';
      img.onload = function () { res(img); }; img.onerror = function () { res(null); };
      img.src = src;
    });
  }
  function rnd(seed) { return (hash(seed) % 100000) / 100000; }
  function lowerCs(s) { return String(s == null ? '' : s).toLocaleLowerCase('cs-CZ'); }
  function normNick(s) { return lowerCs(s).replace(/^@/, '').trim(); }
  function spokenNick(s) { return String(s || '').replace(/^@/, '').replace(/[._]+/g, ' ').trim(); }

  // ------------------------------------------------------------------ čeština: pády obcí, povolání, budov
  // obec | 2. pád (z Mukařova) | 3. pád (Mukařovu chybí)
  var TOWN_CZ = {};
  ('Říčany|Říčan|Říčanům;Světice|Světic|Světicím;Strančice|Strančic|Strančicím;Mukařov|Mukařova|Mukařovu;Mnichovice|Mnichovic|Mnichovicím;' +
   'Velké Popovice|Velkých Popovic|Velkým Popovicím;Kamenice|Kamenice|Kamenici;Kostelec nad Černými lesy|Kostelce nad Černými lesy|Kostelci nad Černými lesy;' +
   'Ondřejov|Ondřejova|Ondřejovu;Kunice|Kunic|Kunicím;Babice|Babic|Babicím;Březí|Březí|Březí;Černé Voděrady|Černých Voděrad|Černým Voděradům;' +
   'Čestlice|Čestlic|Čestlicím;Dobřejovice|Dobřejovic|Dobřejovicím;Doubek|Doubku|Doubku;Herink|Herinku|Herinku;Hrusice|Hrusic|Hrusicím;Jevany|Jevan|Jevanům;' +
   'Kaliště|Kaliště|Kališti;Klokočná|Klokočné|Klokočné;Konojedy|Konojed|Konojedům;Kostelec u Křížků|Kostelce u Křížků|Kostelci u Křížků;Kozojedy|Kozojed|Kozojedům;' +
   'Křenice|Křenic|Křenicím;Křížkový Újezdec|Křížkového Újezdce|Křížkovému Újezdci;Louňovice|Louňovic|Louňovicím;Mirošovice|Mirošovic|Mirošovicím;' +
   'Modletice|Modletic|Modleticím;Nučice|Nučic|Nučicím;Nupaky|Nupak|Nupakům;Oleška|Olešky|Olešce;Oplany|Oplan|Oplanům;Pětihosty|Pětihost|Pětihostům;' +
   'Petříkov|Petříkova|Petříkovu;Popovičky|Popoviček|Popovičkám;Prusice|Prusic|Prusicím;Radějovice|Radějovic|Radějovicím;Senohraby|Senohrab|Senohrabům;' +
   'Sluštice|Sluštic|Slušticím;Struhařov|Struhařova|Struhařovu;Stříbrná Skalice|Stříbrné Skalice|Stříbrné Skalici;Sulice|Sulic|Sulicím;Svojetice|Svojetic|Svojeticím;' +
   'Štíhlice|Štíhlic|Štíhlicím;Tehov|Tehova|Tehovu;Tehovec|Tehovce|Tehovci;Vlkančice|Vlkančic|Vlkančicím;Všestary|Všestar|Všestarům;Výžerky|Výžerek|Výžerkám;' +
   'Vyžlovka|Vyžlovky|Vyžlovce;Zvánovice|Zvánovic|Zvánovicím').split(';').forEach(function (r) { var p = r.split('|'); TOWN_CZ[p[0]] = [p[1], p[2]]; });
  // k: 2 = genitiv, 3 = dativ. Víceslovné neznámé obce vrací null (volající použije „obce X“ / „obci X“).
  function townCase(name, k) {
    name = String(name || '').trim();
    var r = TOWN_CZ[name]; if (r) return r[k === 2 ? 0 : 1];
    if (/\s/.test(name)) return null;
    var rules = k === 2
      ? [[/ice$/, 'ic'], [/any$/, 'an'], [/ky$/, 'ek'], [/y$/, ''], [/ov$/, 'ova'], [/ec$/, 'ce'], [/ek$/, 'ku'], [/ka$/, 'ky'], [/á$/, 'é'], [/a$/, 'y'], [/[eěí]$/, '$&'], [/$/, 'a']]
      : [[/ice$/, 'icím'], [/ky$/, 'kám'], [/y$/, 'ům'], [/ov$/, 'ovu'], [/ec$/, 'ci'], [/ek$/, 'ku'], [/ka$/, 'ce'], [/á$/, 'é'], [/a$/, 'e'], [/ě$/, 'i'], [/[eí]$/, '$&'], [/$/, 'u']];
    for (var i = 0; i < rules.length; i++) if (rules[i][0].test(name)) return name.replace(rules[i][0], rules[i][1]);
    return name;
  }
  function townGen(n) { var g = townCase(n, 2); return g || ('obce ' + n); }      // „z Mukařova“ / „z obce X“
  function townDat(n) { var d = townCase(n, 3); return d || ('obci ' + n); }      // „Mukařovu chybí“ / „obci X chybí“
  var JOB_PL = {
    'hasič': ['hasiči', 'hasičů'], 'kuchař': ['kuchaři', 'kuchařů'], 'hospodský': ['hospodští', 'hospodských'], 'prodavač': ['prodavači', 'prodavačů'],
    'barista': ['baristé', 'baristů'], 'fotbalista': ['fotbalisté', 'fotbalistů'], 'sportovec': ['sportovci', 'sportovců'], 'skejťák': ['skejťáci', 'skejťáků'],
    'řidič': ['řidiči', 'řidičů'], 'strojvedoucí': ['strojvedoucí', 'strojvedoucích'], 'rybář': ['rybáři', 'rybářů'], 'plavčík': ['plavčíci', 'plavčíků'],
    'učitel': ['učitelé', 'učitelů'], 'muzikant': ['muzikanti', 'muzikantů'], 'hokejista': ['hokejisté', 'hokejistů'], 'programátor': ['programátoři', 'programátorů'],
    'filmař': ['filmaři', 'filmařů'], 'turista': ['turisté', 'turistů'], 'rytíř': ['rytíři', 'rytířů'], 'pilot': ['piloti', 'pilotů']
  };
  // tvar povolání k číslu: 1 hasič, 2 hasiči, 5 hasičů (n = 'pl' → 1. pád množného čísla)
  function jobForm(job, n) {
    var j = lowerCs(job).trim();
    if (n === 1) return j;
    var f = JOB_PL[j] || (/ista$/.test(j) ? [j.slice(0, -1) + 'é', j.slice(0, -1) + 'ů'] : /ec$/.test(j) ? [j.slice(0, -2) + 'ci', j.slice(0, -2) + 'ců']
      : /k$/.test(j) ? [j.slice(0, -1) + 'ci', j + 'ů'] : /ý$/.test(j) ? [j.slice(0, -1) + 'í', j.slice(0, -1) + 'ých'] : /í$/.test(j) ? [j, j + 'ch']
      : /a$/.test(j) ? [j.slice(0, -1) + 'ové', j.slice(0, -1) + 'ů'] : [j + 'i', j + 'ů']);
    return n === 'pl' || (n >= 2 && n <= 4) ? f[0] : f[1];
  }
  function cleanBuilding(b) { return String(b || '').replace(/\s*\(.*?\)\s*/g, ' ').split(' / ')[0].trim(); }
  // 4. pád budovy: hasičárna → hasičárnu, pizzerie → pizzerii, nová knihovna → novou knihovnu
  function buildingAcc(b) {
    var w = cleanBuilding(b).split(' '), done = false;
    for (var i = 0; i < w.length && !done; i++) {
      var x = w[i];
      if (/á$/.test(x)) w[i] = x.slice(0, -1) + 'ou';
      else if (/ie$/.test(x)) { w[i] = x.slice(0, -1) + 'i'; done = true; }
      else if (/a$/.test(x)) { w[i] = x.slice(0, -1) + 'u'; done = true; }
      else if (!/[éýí]$/.test(x)) done = true;
    }
    return w.join(' ');
  }
  function cap(s) { s = String(s || ''); return s.charAt(0).toLocaleUpperCase('cs-CZ') + s.slice(1); }

  // ------------------------------------------------------------------ emoji (s fallbackem, když systém nemá barevný font)
  var EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Twemoji Mozilla",sans-serif';
  var _emo = {};
  function emojiOk(e) {
    if (!e) return false;
    if (_emo[e] != null) return _emo[e];
    try {
      var c = document.createElement('canvas'); c.width = c.height = 48;
      var x = c.getContext('2d', { willReadFrequently: true });
      x.font = '36px ' + EMOJI_FONT; x.textBaseline = 'middle'; x.textAlign = 'center'; x.fillText(e, 24, 26);
      var d = x.getImageData(0, 0, 48, 48).data, col = 0;
      for (var i = 0; i < d.length; i += 4) if (d[i + 3] > 60 && (Math.abs(d[i] - d[i + 1]) > 28 || Math.abs(d[i + 1] - d[i + 2]) > 28)) col++;
      _emo[e] = col > 20;
    } catch (er) { _emo[e] = false; }
    return _emo[e];
  }
  function drawEmoji(g, e, x, y, size, fallback, fbColor) {
    g.save(); g.textAlign = 'center'; g.textBaseline = 'middle';
    if (emojiOk(e)) { g.font = Math.round(size) + 'px ' + EMOJI_FONT; g.fillText(e, x, y + size * 0.04); }
    else { g.fillStyle = fbColor || C.white; g.font = font(size * 0.9, 900); g.fillText(up(fallback || '?').slice(0, 1), x, y + size * 0.05); }
    g.restore();
  }

  // ------------------------------------------------------------------ konfety (bezstavové – jdou vykreslit v libovolném čase)
  function confetti(g, lt, o) {
    var t = (lt - o.t0) / 1000; if (t < 0 || t > 3.4) return;
    var cols = [C.yellow, C.sky, C.white, C.blue, '#ff7a59', C.ice], n = o.n || 70, k = 2.2, grav = 1500;
    g.save();
    for (var i = 0; i < n; i++) {
      var s = (o.seed || 'c') + i, ang = (o.angle == null ? -Math.PI / 2 : o.angle) + (rnd(s + 'a') - 0.5) * (o.spread || 2.6), sp = 900 + rnd(s + 'v') * 1700;
      var vx = Math.cos(ang) * sp, vy = Math.sin(ang) * sp, f = (1 - Math.exp(-k * t)) / k;
      var x = o.x + vx * f + Math.sin(t * 3 + i) * 30, y = o.y + vy * f + 0.5 * grav * t * t * 0.55;
      var life = 1 - prog(t, 2.4, 3.4); if (life <= 0 || y > H + 40) continue;
      g.save(); g.globalAlpha = life; g.translate(x, y); g.rotate(t * (4 + rnd(s + 'r') * 8) + i);
      g.scale(1, Math.cos(t * (6 + rnd(s + 'f') * 6) + i));
      g.fillStyle = cols[i % cols.length];
      if (i % 4 === 0) { g.beginPath(); g.arc(0, 0, 9, 0, 7); g.fill(); } else g.fillRect(-12, -7, 24, 14);
      g.restore();
    }
    g.restore();
  }
  var _scan = null;
  function scanlines(g, alpha) {
    if (!_scan) { var c = document.createElement('canvas'); c.width = 4; c.height = 6; var x = c.getContext('2d'); x.fillStyle = 'rgba(0,0,0,1)'; x.fillRect(0, 0, 4, 2); _scan = g.createPattern(c, 'repeat'); }
    g.save(); g.globalAlpha = alpha; g.fillStyle = _scan; g.fillRect(0, 0, W, H); g.restore();
  }
  // posun vodorovných pruhů už vykresleného snímku (glitch)
  var _slice = null;
  function sliceShift(g, amount, seed, count, fill) {
    if (amount <= 0) return;
    if (!_slice) { _slice = document.createElement('canvas'); _slice.width = W; _slice.height = 200; }
    var sx = _slice.getContext('2d');
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
    for (var i = 0; i < (count || 6); i++) {
      var y = Math.floor(rnd(seed + 'y' + i) * H), h = Math.floor(14 + rnd(seed + 'h' + i) * 90), dx = Math.round((rnd(seed + 'x' + i) - 0.5) * 2 * amount);
      try {
        sx.clearRect(0, 0, W, h); sx.drawImage(R.canvas, 0, y, W, h, 0, 0, W, h);
        g.fillStyle = fill || '#05091a'; g.fillRect(0, y, W, h);
        g.drawImage(_slice, 0, 0, W, h, dx, y, W, h);
      } catch (e) {}
    }
    g.restore();
  }
  function rgbText(g, text, x, y, size, color, amt) {
    g.save(); g.font = font(size, 900); g.textAlign = 'center'; g.textBaseline = 'middle';
    g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.85;
    g.fillStyle = '#ff2a4a'; g.fillText(text, x - amt, y);
    g.fillStyle = '#20d8ff'; g.fillText(text, x + amt, y + amt * 0.25);
    g.restore();
    g.save(); g.font = font(size, 900); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = color; g.fillText(text, x, y); g.restore();
  }
  // mapový špendlík (hrot dole v x,y)
  function pin(g, x, y, s, color, inner) {
    g.save(); g.translate(x, y); g.scale(s / 100, s / 100);
    g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 18; g.shadowOffsetY = 8;
    g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(-18, -38, -50, -62, -50, -100); g.arc(0, -100, 50, Math.PI, 0); g.bezierCurveTo(50, -62, 18, -38, 0, 0); g.closePath();
    g.fillStyle = color || C.yellow; g.fill(); g.shadowBlur = 0; g.shadowOffsetY = 0;
    g.fillStyle = '#fff'; g.beginPath(); g.arc(0, -100, 30, 0, 7); g.fill();
    if (inner === 'house') { g.fillStyle = C.navy; g.beginPath(); g.moveTo(-17, -94); g.lineTo(0, -116); g.lineTo(17, -94); g.lineTo(13, -94); g.lineTo(13, -82); g.lineTo(-13, -82); g.lineTo(-13, -94); g.closePath(); g.fill(); }
    else if (inner) { g.fillStyle = C.navy; g.font = font(inner.length > 2 ? 22 : 34, 900); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(inner, 0, -98); }
    g.restore();
  }
  function brackets(g, cx, cy, hw, hh, len, lw, color) {
    g.save(); g.strokeStyle = color || '#fff'; g.lineWidth = lw || 8; g.lineCap = 'round';
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (d) {
      var x = cx + d[0] * hw, y = cy + d[1] * hh;
      g.beginPath(); g.moveTo(x - d[0] * len, y); g.lineTo(x, y); g.lineTo(x, y - d[1] * len); g.stroke();
    });
    g.restore();
  }

  // ------------------------------------------------------------------ AUDIO (WebAudio, nahrávatelné)
  var AU = {
    ctx: null, master: null, music: null, sfx: null, voice: null, rec: null, comp: null,
    noiseBuf: null, timer: null, step: 0, nextT: 0, voiceBuf: null, voiceSrc: null, monitor: true,
    init: function () {
      if (this.ctx) return this.ctx;
      var AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return null;
      var c = this.ctx = new AC();
      this.comp = c.createDynamicsCompressor();
      this.comp.threshold.value = -14; this.comp.ratio.value = 4; this.comp.attack.value = 0.004; this.comp.release.value = 0.2;
      this.master = c.createGain(); this.master.gain.value = 0.8;
      this.music = c.createGain(); this.music.gain.value = 0.55;
      this.sfx = c.createGain(); this.sfx.gain.value = 0.8;
      this.voice = c.createGain(); this.voice.gain.value = 1.0;
      this.music.connect(this.comp); this.sfx.connect(this.comp); this.voice.connect(this.comp);
      this.comp.connect(this.master);
      this.monitorNode = c.createGain(); this.monitorNode.gain.value = 1;
      this.master.connect(this.monitorNode); this.monitorNode.connect(c.destination);
      this.rec = c.createMediaStreamDestination ? c.createMediaStreamDestination() : null;
      if (this.rec) this.master.connect(this.rec);
      var len = c.sampleRate * 2, b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = b;
      return c;
    },
    t: function () { return this.ctx ? this.ctx.currentTime : 0; },
    offT: null,   // renderAudio: „aktuální“ čas v OfflineAudioContextu
    now: function () { return this.offT != null ? this.offT : this.ctx.currentTime; },
    env: function (gain, t, a, peak, dec, sus) {
      gain.gain.cancelScheduledValues(t); gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + a);
      gain.gain.exponentialRampToValueAtTime(Math.max(sus || 0.0001, 0.0001), t + a + dec);
    },
    noise: function (t, dur) { var s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf; s.start(t, Math.random()); s.stop(t + dur + 0.05); return s; },
    osc: function (type, f, t, dur) { var o = this.ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); o.start(t); o.stop(t + dur + 0.05); return o; },
    // ---- hudba: 124 BPM, Am–F–C–G, kick/clap/hat/bass/pad/arp
    BPM: 124,
    chords: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]],
    mtof: function (m) { return 440 * Math.pow(2, (m - 69) / 12); },
    startMusic: function (intensity) {
      if (!this.ctx) return;
      this.stopMusic();
      var self = this, spb = 60 / this.BPM / 4;
      this.intensity = intensity == null ? 1 : intensity;
      this.step = 0; this.nextT = this.ctx.currentTime + 0.05;
      this.music.gain.cancelScheduledValues(this.ctx.currentTime);
      this.music.gain.setValueAtTime(this.voiceBuf ? 0.32 : 0.55, this.ctx.currentTime);
      this.timer = setInterval(function () {
        while (self.nextT < self.ctx.currentTime + 0.15) { self.playStep(self.step, self.nextT, spb); self.step++; self.nextT += spb; }
      }, 25);
    },
    stopMusic: function (fade) {
      if (this.timer) { clearInterval(this.timer); this.timer = null; }
      if (this.ctx && fade) {
        var t = this.now();
        this.music.gain.cancelScheduledValues(t); this.music.gain.setValueAtTime(this.offT != null ? (this.voiceBuf ? 0.32 : 0.55) : this.music.gain.value, t);
        this.music.gain.linearRampToValueAtTime(0.0001, t + fade);
      }
    },
    playStep: function (s, t, spb) {
      var c = this.ctx, bar = Math.floor(s / 16) % 4, st = s % 16, ch = this.chords[bar], I = this.intensity;
      if (this.muted) return;
      // kick
      if (st % 4 === 0) {
        var k = this.osc('sine', 150, t, 0.4), kg = c.createGain();
        k.frequency.exponentialRampToValueAtTime(42, t + 0.12);
        this.env(kg, t, 0.002, 0.95, 0.38); k.connect(kg); kg.connect(this.music);
      }
      // clap (2 a 4)
      if (st === 4 || st === 12) {
        var n = this.noise(t, 0.2), bp = c.createBiquadFilter(), ng = c.createGain();
        bp.type = 'bandpass'; bp.frequency.value = 1600; bp.Q.value = 0.8;
        this.env(ng, t, 0.002, 0.5 * I, 0.16); n.connect(bp); bp.connect(ng); ng.connect(this.music);
      }
      // hat (offbeat 8ths + jemné 16ths)
      if (st % 2 === 0 || I > 0.8) {
        var h = this.noise(t, 0.06), hp = c.createBiquadFilter(), hg = c.createGain();
        hp.type = 'highpass'; hp.frequency.value = 8000;
        this.env(hg, t, 0.001, (st % 4 === 2 ? 0.28 : 0.09) * I, 0.045); h.connect(hp); hp.connect(hg); hg.connect(this.music);
      }
      // bass (offbeat pump)
      if (st % 2 === 1 || st % 4 === 2) {
        var bo = this.osc('sawtooth', this.mtof(ch[0] - 24), t, spb * 1.6), lp = c.createBiquadFilter(), bg = c.createGain();
        lp.type = 'lowpass'; lp.frequency.setValueAtTime(900, t); lp.frequency.exponentialRampToValueAtTime(180, t + spb * 1.5);
        this.env(bg, t, 0.005, 0.42, spb * 1.5); bo.connect(lp); lp.connect(bg); bg.connect(this.music);
      }
      // pad (na začátku taktu, sidechain „pump“)
      if (st === 0) {
        var pg = c.createGain(), plp = c.createBiquadFilter(); plp.type = 'lowpass'; plp.frequency.value = 1400;
        var dur = spb * 16;
        pg.gain.setValueAtTime(0.0001, t);
        for (var q = 0; q < 4; q++) {
          var tq = t + q * spb * 4;
          pg.gain.setValueAtTime(0.0001, tq); pg.gain.linearRampToValueAtTime(0.07, tq + spb * 2.2);
        }
        pg.gain.linearRampToValueAtTime(0.0001, t + dur);
        for (var i = 0; i < ch.length; i++) for (var dt = -1; dt <= 1; dt += 2) {
          var po = this.osc('sawtooth', this.mtof(ch[i]), t, dur); po.detune.value = dt * 9; po.connect(plp);
        }
        plp.connect(pg); pg.connect(this.music);
      }
      // arp pluck
      if (I > 0.5) {
        var notes = [ch[0] + 12, ch[1] + 12, ch[2] + 12, ch[1] + 24], nn = notes[st % 4];
        var ao = this.osc('square', this.mtof(nn), t, 0.16), alp = c.createBiquadFilter(), ag = c.createGain();
        alp.type = 'lowpass'; alp.frequency.setValueAtTime(3200, t); alp.frequency.exponentialRampToValueAtTime(500, t + 0.14);
        this.env(ag, t, 0.002, 0.075 * I, 0.13); ao.connect(alp); alp.connect(ag); ag.connect(this.music);
      }
    },
    // ---- SFX
    whoosh: function (dt, dur) {
      if (!this.ctx) return; var c = this.ctx, t = this.now() + (dt || 0); dur = dur || 0.55;
      var n = this.noise(t, dur), bp = c.createBiquadFilter(), g = c.createGain();
      bp.type = 'bandpass'; bp.Q.value = 1.2;
      bp.frequency.setValueAtTime(300, t); bp.frequency.exponentialRampToValueAtTime(5200, t + dur * 0.6); bp.frequency.exponentialRampToValueAtTime(900, t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.7, t + dur * 0.55); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      n.connect(bp); bp.connect(g);
      if (c.createStereoPanner) { var p = c.createStereoPanner(); p.pan.setValueAtTime(-0.8, t); p.pan.linearRampToValueAtTime(0.8, t + dur); g.connect(p); p.connect(this.sfx); }
      else g.connect(this.sfx);
    },
    boom: function (dt) {
      if (!this.ctx) return; var c = this.ctx, t = this.now() + (dt || 0);
      var o = this.osc('sine', 110, t, 1.2), g = c.createGain();
      o.frequency.exponentialRampToValueAtTime(32, t + 0.9); this.env(g, t, 0.003, 1.0, 1.1); o.connect(g); g.connect(this.sfx);
      var n = this.noise(t, 0.5), lp = c.createBiquadFilter(), ng = c.createGain();
      lp.type = 'lowpass'; lp.frequency.setValueAtTime(3000, t); lp.frequency.exponentialRampToValueAtTime(200, t + 0.4);
      this.env(ng, t, 0.002, 0.6, 0.45); n.connect(lp); lp.connect(ng); ng.connect(this.sfx);
    },
    ping: function (dt, f) {
      if (!this.ctx) return; var c = this.ctx, t = this.now() + (dt || 0); f = f || 1320;
      var dl = c.createDelay(); dl.delayTime.value = 0.18; var fb = c.createGain(); fb.gain.value = 0.35;
      var g = c.createGain(); this.env(g, t, 0.002, 0.35, 0.7);
      var o1 = this.osc('sine', f, t, 0.9), o2 = this.osc('sine', f * 1.5, t, 0.5);
      o1.connect(g); o2.connect(g); g.connect(this.sfx); g.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(this.sfx);
      if (this.offT == null) setTimeout(function () { try { fb.disconnect(); dl.disconnect(); } catch (e) {} }, (dt || 0) * 1000 + 2500);
    },
    tick: function (dt, f) {
      if (!this.ctx) return; var c = this.ctx, t = this.now() + (dt || 0);
      var o = this.osc('square', f || 2400, t, 0.03), g = c.createGain(); this.env(g, t, 0.001, 0.08, 0.025); o.connect(g); g.connect(this.sfx);
    },
    pop: function (dt, f) {
      if (!this.ctx) return; var c = this.ctx, t = this.now() + (dt || 0); f = f || 520;
      var o = this.osc('sine', f, t, 0.15), g = c.createGain(); o.frequency.exponentialRampToValueAtTime(f * 2.2, t + 0.08);
      this.env(g, t, 0.002, 0.3, 0.12); o.connect(g); g.connect(this.sfx);
    },
    riser: function (dt, dur) {
      if (!this.ctx) return; var c = this.ctx, t = this.now() + (dt || 0);
      var n = this.noise(t, dur), hp = c.createBiquadFilter(), g = c.createGain();
      hp.type = 'bandpass'; hp.Q.value = 2; hp.frequency.setValueAtTime(400, t); hp.frequency.exponentialRampToValueAtTime(7000, t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.35, t + dur * 0.95); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.05);
      n.connect(hp); hp.connect(g); g.connect(this.sfx);
    },
    // přepne celý mix na jiný kontext (OfflineAudioContext); vrací funkci pro návrat
    swap: function (c) {
      var self = this, keys = ['ctx', 'comp', 'master', 'music', 'sfx', 'voice', 'monitorNode', 'rec', 'timer', 'offT', 'intensity', 'voiceSrc'], saved = {};
      keys.forEach(function (k) { saved[k] = self[k]; });
      this.timer = null; this.ctx = c;
      this.comp = c.createDynamicsCompressor();
      this.comp.threshold.value = -14; this.comp.ratio.value = 4; this.comp.attack.value = 0.004; this.comp.release.value = 0.2;
      this.master = c.createGain(); this.master.gain.value = 0.8;
      this.music = c.createGain(); this.music.gain.value = 0.55;
      this.sfx = c.createGain(); this.sfx.gain.value = 0.8;
      this.voice = c.createGain(); this.voice.gain.value = 1.0;
      this.music.connect(this.comp); this.sfx.connect(this.comp); this.voice.connect(this.comp); this.comp.connect(this.master);
      this.master.connect(c.destination); this.monitorNode = null; this.rec = null;
      if (!this.noiseBuf) {
        var len = c.sampleRate * 2, b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0);
        for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        this.noiseBuf = b;
      }
      return function () { keys.forEach(function (k) { self[k] = saved[k]; }); };
    },
    glitch: function (dt, dur) {
      if (!this.ctx) return; var c = this.ctx, t = this.now() + (dt || 0); dur = dur || 0.22;
      var n = this.noise(t, dur), bp = c.createBiquadFilter(), g = c.createGain();
      bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = 0.6;
      g.gain.setValueAtTime(0.0001, t);
      for (var i = 0; i < 6; i++) { var ti = t + i * dur / 6; g.gain.setValueAtTime(i % 2 ? 0.05 : 0.45, ti); }
      g.gain.setValueAtTime(0.0001, t + dur);
      n.connect(bp); bp.connect(g); g.connect(this.sfx);
      var o = this.osc('square', 90 + Math.random() * 60, t, dur), og = c.createGain(); og.gain.setValueAtTime(0.12, t); og.gain.setValueAtTime(0.0001, t + dur);
      o.connect(og); og.connect(this.sfx);
    },
    beep: function (dt, f, dur) {
      if (!this.ctx) return; var c = this.ctx, t = this.now() + (dt || 0); dur = dur || 0.16;
      var o = this.osc('triangle', f || 880, t, dur), g = c.createGain(); this.env(g, t, 0.004, 0.32, dur);
      o.connect(g); g.connect(this.sfx);
    },
    playVoice: function () {
      if (!this.ctx || !this.voiceBuf) return;
      var s = this.ctx.createBufferSource(); s.buffer = this.voiceBuf; s.connect(this.voice); s.start(this.now() + 0.02);
      this.voiceSrc = s;
    },
    stopAll: function () {
      this.stopMusic(0.25);
      if (this.voiceSrc) { try { this.voiceSrc.stop(); } catch (e) {} this.voiceSrc = null; }
    }
  };

  // ------------------------------------------------------------------ TTS (Web Speech API — jen náhled)
  var TTS = {
    voice: null, ready: false,
    pick: function () {
      if (!root.speechSynthesis) return Promise.resolve(null);
      var self = this;
      return new Promise(function (res) {
        function choose() {
          var vs = speechSynthesis.getVoices() || [];
          var cs = vs.filter(function (v) { return /^cs/i.test(v.lang); });
          var pref = ['Zuzana', 'Iveta', 'Vlasta', 'Jakub', 'Antonín', 'Google'];
          var best = null;
          for (var i = 0; i < pref.length && !best; i++) best = cs.filter(function (v) { return v.name.indexOf(pref[i]) >= 0; })[0] || null;
          self.voice = best || cs[0] || null; self.ready = true; res(self.voice);
        }
        if ((speechSynthesis.getVoices() || []).length) return choose();
        var done = false;
        speechSynthesis.onvoiceschanged = function () { if (!done) { done = true; choose(); } };
        setTimeout(function () { if (!done) { done = true; choose(); } }, 1200);
      });
    },
    speak: function (text, cb) {
      if (!root.speechSynthesis || !text) return null;
      var u = new SpeechSynthesisUtterance(text);
      u.lang = 'cs-CZ'; if (this.voice) u.voice = this.voice;
      u.rate = 1.12; u.pitch = 1.05; u.volume = 1;
      u.onstart = function () { cb && cb('start', 0); };
      u.onboundary = function (e) { if (e.name === undefined || e.name === 'word') cb && cb('word', e.charIndex); };
      u.onend = function () { cb && cb('end'); };
      u.onerror = function () { cb && cb('end'); };
      speechSynthesis.speak(u);
      return u;
    },
    cancel: function () { if (root.speechSynthesis) try { speechSynthesis.cancel(); } catch (e) {} }
  };

  // ------------------------------------------------------------------ titulky: rozdělení a časování
  var MS_PER_UNIT = 56;   // ~ rychlost češtiny v TTS při rate 1.1 (cca 16–17 znaků/s)
  function tokenize(text) {
    var out = [], re = /\S+/g, m;
    while ((m = re.exec(text))) out.push({ w: m[0], i: m.index });
    return out;
  }
  function timeWords(text, start) {
    var ws = tokenize(text), t = start;
    for (var i = 0; i < ws.length; i++) {
      var w = ws[i].w, u = w.replace(/[^\wÀ-ž+\d]/g, '').length + 1.2;
      if (/\d/.test(w)) u += w.replace(/\D/g, '').length * 2.2;   // čísla se čtou déle
      ws[i].start = t; t += u * MS_PER_UNIT; ws[i].end = t;
      if (/[.!?…]$/.test(w)) t += 300; else if (/[,:;–-]$/.test(w)) t += 140;
    }
    return { words: ws, end: t };
  }
  function chunkWords(ws) {
    var chunks = [], cur = [];
    function push() { if (cur.length) chunks.push(cur); cur = []; }
    for (var i = 0; i < ws.length; i++) {
      cur.push(i);
      var chars = cur.reduce(function (a, k) { return a + ws[k].w.length + 1; }, 0);
      var last = ws[i].w, next = ws[i + 1];
      if (/[.!?…:]$/.test(last)) push();
      else if (cur.length >= 4 || (chars > 17 && cur.length >= 2)) push();
      else if (/,$/.test(last) && cur.length >= 2) push();
      else if (next && cur.length >= 2 && chars + next.w.length > 20) push();
    }
    push();
    // nenechávej osamocená krátká slova na konci
    if (chunks.length > 1 && chunks[chunks.length - 1].length === 1 && chunks[chunks.length - 2].length < 4 &&
        !/[.!?…:]$/.test(ws[chunks[chunks.length - 2][chunks[chunks.length - 2].length - 1]].w)) {
      var l = chunks.pop(); chunks[chunks.length - 1] = chunks[chunks.length - 1].concat(l);
    }
    return chunks;
  }
  function subDisplay(w) { return up(w).replace(/^PLUS$/, '+'); }

  // ------------------------------------------------------------------ SCÉNÁŘ
  var DEFAULT_DUR = { hook: 2800, overview: 3300, town: 2400, comment: 4800, cta: 5200, outro: 2000, jobs: 4600, jobBuilt: 4400, milestone: 4000, newTowns: 3600, findMe: 2500, crown: 4200 };
  var MIN_TOTAL = 15000, MAX_TOTAL = 26000;   // cíl 15–25 s, pojistka 26 s (opts.minTotal / opts.maxTotal)
  var EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu;
  // pořadí hooků pro rotaci (výběr viz pickHook)
  var HOOK_IDS = ['breaking', 'who', 'crown', 'glitch', 'counter', 'versus', 'where', 'countdown', 'classic'];
  var HOOK_KEY = 'radarReel.hook';

  function safeState() { try { return (G() && G().state && G().state()) || {}; } catch (e) { return {}; } }
  function allHouses(st) { var o = []; (st.towns || []).forEach(function (t) { (t.houses || []).forEach(function (h) { o.push({ id: h.id, owner: h.owner, no: h.no, x: h.x, y: h.y || 0, z: h.z, town: t.name }); }); }); return o; }
  function findHouse(st, nick, no) {
    var k = normNick(nick), hs = allHouses(st);
    for (var i = 0; i < hs.length; i++) if (k && normNick(hs[i].owner) === k) return hs[i];
    if (no != null) for (var j = 0; j < hs.length; j++) if (hs[j].no === no) return hs[j];
    return null;
  }
  function jobsJobList() {
    try { var j = G() && G().jobs && G().jobs(); if (j && j.length) return j.map(function (x) { return lowerCs(x.n); }); } catch (e) {}
    return ['hasič', 'kuchař', 'skejťák', 'barista', 'fotbalista', 'muzikant', 'učitel', 'rybář'];
  }

  function readHookMemo() { try { return JSON.parse(root.localStorage.getItem(HOOK_KEY) || 'null'); } catch (e) { return null; } }
  function writeHookMemo(d, id) {
    try {
      var m = readHookMemo() || {};
      if (m.day !== d) { m.prevDay = m.day; m.prevId = m.id; }
      m.day = d; m.id = id; root.localStorage.setItem(HOOK_KEY, JSON.stringify(m));
    } catch (e) {}
  }
  // hook z předchozího dne (opts.lastHook > localStorage)
  function prevHook(d, opts) {
    if (opts.lastHook) return opts.lastHook;
    var m = readHookMemo(); if (!m) return null;
    if (m.day === d - 1) return m.id;
    if (m.day === d && m.prevDay === d - 1) return m.prevId;
    return null;
  }
  function hookEligible(id, x) {
    switch (id) {
      case 'breaking': return !!x.jobBuilt && !x.noBreaking;
      case 'who': return !!x.whoHouse;
      case 'crown': return !!x.crownOn;
      case 'glitch': return x.n >= 10;
      case 'counter': return x.n >= 2;
      case 'versus': return x.top.length >= 2 && x.top[1].list.length >= 2;
      case 'where': return x.findMe.length > 0 || x.n >= 5;
      case 'countdown': return true;
      case 'classic': return x.n >= 1;
    }
    return false;
  }
  function pickHook(x, opts) {
    var hv = opts.hookVariant;
    if (hv === 'quiet' || hv === 'expanded') return hv;
    if (typeof hv === 'string' && HOOK_IDS.indexOf(hv) >= 0 && (hookEligible(hv, x) || hv === 'classic' || hv === 'countdown')) return hv;   // vynucený hook jen když na něj jsou data
    if (typeof hv === 'number') return 'classic';
    if (x.expanded) return 'expanded';
    var el = HOOK_IDS.filter(function (id) { return hookEligible(id, x); });
    if (x.n === 0 && !x.jobBuilt && !x.milestone && !x.newTowns.length) return x.d % 2 ? 'quiet' : 'countdown';
    var prev = prevHook(x.d, opts);
    var pref = x.jobBuilt && !x.noBreaking ? 'breaking' : x.milestone && x.whoHouse ? 'who' : x.crownOn ? 'crown' : null;
    if (pref && pref !== prev) return pref;
    var rot = el.filter(function (id) { return id !== prev && id !== pref; });
    if (!rot.length) rot = el.length ? el : ['countdown'];
    return rot[x.d % rot.length];
  }

  function buildHook(id, x) {
    var d = x.d, n = x.n, top = x.top, sous = up(plural(n, 'nový soused', 'noví sousedé', 'nových sousedů'));
    var h = { type: 'hook', role: 'hook', variant: id, day: d, n: n, town: top[0] && top[0].name, kicker: 'DEN ' + d,
      pop: x.after, from: x.before, statusPre: 'ŘÍČANSKO MÁ ' + (x.after < 50 ? 'ZATÍM ' : ''), statusPost: up(plural(x.after, 'obyvatele', 'obyvatele', 'obyvatel')) };
    // věta stavu: „Den 7. Říčansko má 412 obyvatel.“ (vždy na začátku)
    var stat = 'Den ' + d + '. Říčansko má ' + (x.after < 50 ? 'zatím ' : '') + x.after + ' ' + plural(x.after, 'obyvatele', 'obyvatele', 'obyvatel') + '.';
    switch (id) {
      case 'expanded':
        h.big = 'MAPA'; h.big2 = 'SE ROZŠÍŘILA'; h.sticker = '+' + n + ' ' + sous; h.vo = stat + ' A mapa se rozšířila!'; break;
      case 'quiet':
        h.big = 'ZATÍM'; h.big2 = 'JE TICHO…'; h.sticker = 'BUDEŠ PRVNÍ?'; h.vo = stat + (x.after ? ' Budeš další?' : ' Budeš první?'); break;
      case 'glitch':
        h.big = '+' + n; h.big2 = sous; h.sticker = 'ZA JEDINÝ DEN';
        h.vo = 'Výpadek Radaru! ' + stat; break;
      case 'counter':
        h.big = '+' + n; h.big2 = up(plural(n, 'člověk', 'lidi', 'lidí')); h.sticker = 'ZA 24 HODIN';
        h.vo = stat + ' Plus ' + n + ' za den!'; break;
      case 'where':
        h.sticker = x.findMe.length ? 'NAJDI HO VE VIDEU' : 'MÁŠ HO NA MAPĚ?';
        h.vo = stat + ' Kde je tvůj domek?'; break;
      case 'countdown':
        h.sticker = n > 0 ? '+' + n + ' ' + sous : 'POSTAV SI ŘÍČANSKO';
        h.vo = 'Tři, dva, jedna! ' + stat; break;
      case 'who':
        h.house = x.whoHouse;
        h.reveal = x.milestone ? 'OBYVATEL Č. ' + x.milestone.no : (x.whoHouse.owner ? '@' + String(x.whoHouse.owner).replace(/^@/, '') : 'NOVÝ SOUSED');
        h.vo = stat; break;
      case 'crown':
        var cr = x.crown, ci = x.townBy[cr.name] || {};
        h.crown = { name: cr.name, week: cr.week || 0, erb: ci.erbUrl || ci.erbSvg || '' }; h.assets = { erb: h.crown.erb };
        h.vo = stat; break;
      case 'breaking':
        var jb = x.jobBuilt;
        h.line1 = up(jobForm(jb.job, 'pl')); h.line2 = 'Z ' + up(townGen(jb.town)); h.sticker = 'NĚCO POSTAVILI…';
        h.ticker1 = 'MIMOŘÁDNÁ ZPRÁVA  •  RADAR ŘÍČANSKO  •  ';
        h.ticker2 = up(jb.town) + '  •  ' + up(cleanBuilding(jb.building)) + '  •  ';
        h.town = jb.town; h.vo = stat; break;
      case 'versus':
        var a = top[0], b = top[1], ia = x.townBy[a.name] || {}, ib = x.townBy[b.name] || {};
        h.a = { name: a.name, n: a.list.length, erb: ia.erbUrl || ia.erbSvg || '' }; h.b = { name: b.name, n: b.list.length, erb: ib.erbUrl || ib.erbSvg || '' };
        h.assets = { a: h.a.erb, b: h.b.erb };
        h.vo = stat; break;
      default: // classic
        var v = x.classic;
        h.variant = 'classic'; h.classic = v;
        h.big = '+' + n; h.big2 = sous; h.sticker = v === 2 ? 'ZA POSLEDNÍCH 24 H' : 'ZA JEDINÝ DEN';
        h.vo = stat + [' Plus ' + n + ' za den!', ' A pořád roste!', ''][v];
    }
    return h;
  }

  // ---- obsahové scény
  function sceneJobBuilt(x) {
    var jb = x.jobBuilt, need = jb.need || 5, b = cleanBuilding(jb.building);
    return {
      type: 'jobBuilt', role: 'content', town: jb.town, job: jb.job, emoji: jb.emoji || '', building: b, name: jb.name || '', need: need,
      buildingEmoji: jb.buildingEmoji || '',
      head: up(jobForm(jb.job, 'pl') + ' z ' + townGen(jb.town)), acc: up(buildingAcc(b)),
      eq: need + ' ' + up(jobForm(jb.job, need)) + ' = 1 ' + up(b),
      vo: cap(jobForm(jb.job, 'pl')) + ' z ' + townGen(jb.town) + ' si postavili ' + lowerCs(buildingAcc(b)) + '! ' + need + ' ' + plural(need, 'člověk', 'lidi', 'lidí') + ', jedna budova.'
    };
  }
  function sceneMilestone(x) {
    var m = x.milestone, h = findHouse(x.st, m.owner, m.no), town = m.town || (h && h.town) || '';
    var nick = m.owner ? '@' + String(m.owner).replace(/^@/, '') : '';
    return {
      type: 'milestone', role: 'content', no: m.no, owner: nick, town: town, house: h,
      vo: 'Obyvatel číslo ' + m.no + '!' + (nick ? ' Je to ' + spokenNick(nick) + (town ? ' z ' + townGen(town) : '') + '.' : '') + ' Gratulujeme!'
    };
  }
  // zájmeno pro „KDO MU/JÍ/JIM JI VEZME?“
  function townPron(name) {
    var d = townCase(name, 3) || '';
    if (/(ům|ím|ám)$/.test(d)) return 'jim';
    if (/[aá]$/.test(name) || /(Kamenice|Skalice)$/.test(name)) return 'jí';
    return 'mu';
  }
  function sceneCrown(x) {
    var cr = x.crown, info = x.townBy[cr.name] || {}, w = cr.week || 0, pr = townPron(cr.name);
    return {
      type: 'crown', role: 'content', noSubs: true, name: cr.name, week: w, pron: pr, assets: { erb: info.erbUrl || info.erbSvg || '' },
      vo: 'Korunu týdne má ' + cr.name + '!' + (w ? ' Plus ' + w + ' za týden.' : '') + ' Kdo ' + pr + ' ji vezme?'
    };
  }
  function sceneComment(x) {
    var tc = x.day.topComment;
    var txt = String(tc.text).trim(); if (txt.length > 110) txt = txt.slice(0, 107).replace(/\s+\S*$/, '') + '…';
    var spoken = txt.replace(EMOJI, '').replace(/[„“"]/g, '').replace(/\s+/g, ' ').trim();
    if (spoken.length > 46) spoken = spoken.slice(0, 44).replace(/\s+\S*$/, '') + '…';
    var nb = x.day.newBuilding;
    if (nb && x.jobBuilt && nb.town === x.jobBuilt.town && x.usedJobBuilt) nb = null;   // stejná budova už má vlastní scénu
    var author = String(tc.author || 'anonym').replace(/^@/, '');
    var vo = nb ? 'Tohle jste chtěli. Tak tu stojí: ' + nb.name + '!'
      : 'Top komentář: ' + spoken + (/[.!?…]$/.test(spoken) ? ' ' : '. ') + 'Zítra ho postavíme!';
    return { type: 'comment', role: 'content', noSubs: true, author: author, text: txt, likes: tc.likes || 0, avatar: tc.avatar || null, building: nb || null, vo: vo };
  }
  function sceneJobs(x) {
    var list = x.jobs.slice().sort(function (a, b) { return (a.need - a.count) - (b.need - b.count) || b.count - a.count; });
    var j = list[0], missing = Math.max(1, j.need - j.count), job = lowerCs(j.job);
    var dat = townDat(j.town), gen = townGen(j.town);
    return {
      type: 'jobs', role: 'content', town: j.town, job: job, emoji: j.emoji || '', count: j.count, need: j.need, building: cleanBuilding(j.building || ''), missing: missing,
      line1: up(dat), line2: 'CHYBÍ ' + missing + ' ' + up(jobForm(job, missing)) + '!',
      ask: 'JSI ' + up(job) + ' Z ' + up(gen) + '?',
      subsUntil: /^Jsi$/i,
      vo: cap(dat) + ' chybí ' + (missing === 1 ? 'už jen jeden ' + job : 'ještě ' + missing + ' ' + jobForm(job, missing)) + '! Jsi ' + job + ' z ' + gen + '? Napiš to do komentářů!'
    };
  }
  function sceneNewTowns(x) {
    var list = x.newTowns, t = list[0], info = x.townBy[t] || {};
    var first = x.np.filter(function (p) { return p.town === t; }).sort(function (a, b) { return (a.no || 0) - (b.no || 0); })[0];
    var vo = list.length > 1
      ? 'Nové obce na mapě: ' + list.slice(0, -1).slice(0, 2).join(', ') + ' a ' + list[Math.min(list.length - 1, 2)] + '! Kdo bude další?'
      : 'Nová obec na mapě: ' + t + '! Má svého prvního obyvatele.';
    return {
      type: 'newTowns', role: 'content', name: t, others: list.slice(1, 3), first: first ? '@' + String(first.owner).replace(/^@/, '') : '',
      tier: info.tier || 'wood', assets: { erb: info.erbUrl || info.erbSvg || '' }, vo: vo
    };
  }
  function sceneTown(x, t, i) {
    var info = x.townBy[t.name] || {}, ordVo = ['Nejvíc roste {T}, plus {N}!', 'Druhé místo: {T}, plus {N}!', 'Třetí {T}, plus {N}!'];
    return {
      type: 'town', role: 'content', rank: i + 1, name: t.name, n: t.list.length, list: t.list,
      tier: info.tier || 'wood', erbSvg: info.erbUrl || info.erbSvg || '', players: (info.players || 0),
      vo: ordVo[i].replace('{T}', t.name).replace('{N}', t.list.length)
    };
  }
  function sceneFindMe(x) {
    var it = x.findMe.slice(0, 5), nr = it.filter(function (a) { return a.house; }).length;
    return { type: 'findMe', role: 'insert', items: it, durFixed: nr ? Math.max(2200, 280 + nr * 560 + 260) : 0, vo: 'Najdi se ve videu!' };
  }
  function sceneOverview(x) {
    return {
      type: 'overview', role: 'insert', from: x.before, to: x.after, n: x.n, towns: x.activeTowns, expanded: x.expanded,
      vo: 'Zatím je nás ' + x.after + '. ' + (x.expanded ? 'A mapa má nové území!' : 'Každý má svůj domek.')
    };
  }

  function normJobs(list) {
    return (list || []).filter(function (j) { return j && j.town && j.job; }).map(function (j) {
      return { town: j.town, job: j.job, emoji: j.emoji || '', count: Math.max(0, +j.count || 0), need: Math.max(1, +j.need || 5), building: j.building || '' };
    }).filter(function (j) { return j.count < j.need; });
  }
  function normFind(list, st) {
    var out = [], seen = {};
    (list || []).forEach(function (it) {
      var nick = typeof it === 'string' ? it : (it && (it.nick || it.owner)) || '';
      var k = normNick(nick); if (!k || seen[k]) return; seen[k] = 1;
      var h = findHouse(st, nick, it && it.no);
      out.push({ nick: '@' + k.replace(/^@/, ''), town: (it && it.town) || (h && h.town) || '', house: h });
    });
    return out.filter(function (a) { return a.house; }).concat(out.filter(function (a) { return !a.house; }));
  }

  function scriptFromDay(day, opts) {
    opts = opts || {};
    day = day || {};
    var st = safeState(); if (!st.towns) st = { day: day.day, totalPlayers: 0, towns: [] };
    var d = day.day || st.day || 1;
    var np = day.newPlayers || [];
    var townBy = {}; (st.towns || []).forEach(function (t) { townBy[t.name] = t; });
    // kolik nových hráčů už ve stavu hry je (podle owner)
    var owners = {}; (st.towns || []).forEach(function (t) { (t.houses || []).forEach(function (h) { owners[t.name + '|' + normNick(h.owner)] = 1; }); });
    var already = np.filter(function (p) { return owners[p.town + '|' + normNick(p.owner)]; }).length;
    var before = Math.max(0, (st.totalPlayers || 0) - already), after = before + np.length;
    var activeTowns = (st.towns || []).filter(function (t) { return t.players > 0; }).length;

    var groups = {};
    np.forEach(function (p) { (groups[p.town] = groups[p.town] || []).push(p); });
    var ranked = Object.keys(groups).map(function (k) { return { name: k, list: groups[k] }; })
      .sort(function (a, b) { return b.list.length - a.list.length || a.name.localeCompare(b.name, 'cs'); });
    var n = np.length;

    var jbRaw = day.jobBuilt && day.jobBuilt.town && day.jobBuilt.job ? day.jobBuilt : null;
    var x = {
      d: d, n: n, np: np, st: st, townBy: townBy, day: day, top: ranked.slice(0, 3), ranked: ranked, before: before, after: after, activeTowns: activeTowns,
      expanded: !!day.expanded, classic: opts.hookVariant != null && typeof opts.hookVariant === 'number' ? opts.hookVariant % 3 : d % 3,
      jobBuilt: jbRaw ? { town: jbRaw.town, job: jbRaw.job, emoji: jbRaw.emoji || '', building: jbRaw.building || jbRaw.name || '', name: jbRaw.name || '', need: jbRaw.need || 5, buildingEmoji: jbRaw.buildingEmoji || '' } : null,
      milestone: day.milestone && day.milestone.no ? day.milestone : null,
      jobs: normJobs(day.jobs),
      newTowns: (day.newTowns || []).map(function (t) { return typeof t === 'string' ? t : t && t.name; }).filter(Boolean),
      findMe: normFind(day.findMe, st)
    };
    // bez findMe: vezmi nicky nových hráčů (každý z jiné obce, nejnovější)
    if (!x.findMe.length && np.length && opts.findMe !== false) {
      var seenT = {}, pick = [];
      np.slice().reverse().forEach(function (p) { if (pick.length < 6 && !seenT[p.town]) { seenT[p.town] = 1; pick.push({ nick: p.owner, town: p.town }); } });
      np.slice().reverse().forEach(function (p) { if (pick.length < 6 && pick.indexOf(p) < 0 && !pick.some(function (q) { return q.nick === p.owner; })) pick.push({ nick: p.owner, town: p.town }); });
      x.findMe = normFind(pick, st).filter(function (f) { return f.house; });
    }
    // koruna týdne (putovní): jen když se změnila, nebo je neděle (nebo opts.crown)
    var cw = day.crown && day.crown.name ? day.crown : null;
    if (cw) {
      var dt = day.date ? new Date(day.date) : (opts.date ? new Date(opts.date) : new Date());
      x.crown = cw;
      x.crownOn = !!(opts.crown || cw.changed || (cw.prev && cw.prev !== cw.name) || (dt && dt.getDay && dt.getDay() === 0));
    }
    // kandidát na „KDO TO JE?“: dům milníku > první nalezený nick > nejnovější domek v top obci
    x.whoHouse = (x.milestone && findHouse(st, x.milestone.owner, x.milestone.no)) || (x.findMe[0] && x.findMe[0].house) || null;
    if (!x.whoHouse && x.top[0]) { var tt = townBy[x.top[0].name]; var hs = tt && tt.houses; if (hs && hs.length) { var hh = hs[hs.length - 1]; x.whoHouse = { id: hh.id, owner: hh.owner, no: hh.no, x: hh.x, z: hh.z, town: tt.name }; } }

    // 1) HOOK
    var hookId = pickHook(x, opts);
    var hook = buildHook(hookId, x);

    // 2) OBSAH (max. 2):  „chtěli jste → postavili jsme“  +  co se změnilo
    //    priorita: jobBuilt > milestone > top komentář (s postavenou budovou) > jobs > newTowns > top obce
    var tc = day.topComment && day.topComment.text ? day.topComment : null;
    var built = tc && day.newBuilding ? 'comment' : x.jobBuilt ? 'jobBuilt' : null;
    var pool = [];
    if (x.jobBuilt) pool.push(['jobBuilt', function () { x.usedJobBuilt = true; return sceneJobBuilt(x); }]);
    if (x.milestone) pool.push(['milestone', function () { return sceneMilestone(x); }]);
    if (x.crownOn) pool.push(['crown', function () { return sceneCrown(x); }]);
    if (tc && day.newBuilding) pool.push(['comment', function () { return sceneComment(x); }]);
    if (x.jobs.length) pool.push(['jobs', function () { return sceneJobs(x); }]);
    if (x.newTowns.length) pool.push(['newTowns', function () { return sceneNewTowns(x); }]);
    x.top.forEach(function (t, i) { pool.push(['town', function () { return sceneTown(x, t, i); }]); });
    var maxC = opts.maxContent || 2, chosen = pool.slice(0, maxC);
    if (built && !chosen.some(function (c) { return c[0] === built; })) { chosen.pop(); chosen.push(pool.filter(function (c) { return c[0] === built; })[0]); }
    // „chtěli jste → postavili jsme“ jde vždy hned po hooku
    if (built) { var bi = -1; chosen.forEach(function (c, i) { if (c[0] === built) bi = i; }); if (bi > 0) chosen.unshift(chosen.splice(bi, 1)[0]); }
    if (built === 'comment' && x.jobBuilt && chosen.some(function (c) { return c[0] === 'jobBuilt'; })) x.usedJobBuilt = true;
    var content = chosen.map(function (c) { return c[1](); }).filter(Boolean);

    // 3) OTEVŘENÁ SMYČKA + SLIB + CTA, OUTRO
    var sample = (st.towns || []).map(function (t) { return t.name; });
    if (sample.length < 3) sample = ['Říčany', 'Mukařov', 'Strančice', 'Kunice', 'Mnichovice'];
    var jl = jobsJobList();
    var typed = sample.slice(0, 8).map(function (t, i) { return t + ' ' + jl[(i * 3 + d) % jl.length]; });
    // kandidát na zítřek: nextComment, nebo dnešní top komentář, který ještě není postavený
    var next = day.nextComment && day.nextComment.text ? day.nextComment : (tc && !day.newBuilding ? tc : null);
    var cta = {
      type: 'cta', role: 'cta', noSubs: true, subsUntil: /^Dej$/i, sample: typed,
      next: next ? { author: String(next.author || '').replace(/^@/, ''), text: String(next.text).trim().slice(0, 90), likes: next.likes || 0 } : null,
      vo: 'Zítra stavíme top komentář. Co to bude? Dej follow, napiš obec a povolání a máš domek se jménem!'
    };
    var outro = { type: 'outro', role: 'outro', day: d, vo: 'Zítra den ' + (d + 1) + '!', handle: opts.handle || '' };

    // 4) skladba: hook → obsah → najdi se → CTA → outro; cíl 15–25 s
    var maxT = opts.maxTotal || MAX_TOTAL, minT = opts.minTotal || MIN_TOTAL;
    var ins = { overview: opts.overview ? sceneOverview(x) : null, findMe: x.findMe.length ? sceneFindMe(x) : null };
    function compose() {
      var list = [hook];
      if (ins.overview) list.push(ins.overview);
      list = list.concat(content);
      if (ins.findMe) list.push(ins.findMe);
      return list.concat([cta, outro]);
    }
    var script = { version: 2, day: d, hook: hookId, title: 'Postav si Říčansko · Den ' + d, opts: opts };
    function measure() { script.scenes = compose(); layout(script); return script.total; }
    measure();
    // moc dlouhé: zkrať průlet, pak uber druhou obsahovou scénu
    if (script.total > maxT && ins.findMe) { ins.findMe.items = ins.findMe.items.slice(0, 3); if (ins.findMe.durFixed) ins.findMe.durFixed = Math.max(2200, 280 + ins.findMe.items.filter(function (a) { return a.house; }).length * 560 + 260); measure(); }
    while (script.total > maxT && content.length > 1) { content.pop(); measure(); }
    if (hook.variant === 'crown') hook.reveal = !content.some(function (c) { return c.type === 'crown'; });
    // hook „MIMOŘÁDNĚ“ slibuje scénu jobBuilt – když vypadla, vyber jiný hook
    if (hook.variant === 'breaking' && !content.some(function (c) { return c.type === 'jobBuilt'; })) {
      x.noBreaking = true; hookId = pickHook(x, opts); hook = buildHook(hookId, x); script.hook = hookId;
      if (hookId === 'crown') hook.reveal = !content.some(function (c) { return c.type === 'crown'; });
      measure();
    }
    if (script.total < minT) {
      var stretch = script.scenes.filter(function (s) { return s.role === 'content' || s.role === 'cta' || s.role === 'insert'; });
      var extra = Math.ceil((minT - script.total) / Math.max(1, stretch.length));
      stretch.forEach(function (s) { s.durFixed = s.dur + Math.min(extra, 3000); });
      layout(script);
    }
    // vypravěč „Pan Radar“ (opts.narrator): oslovení v hooku, podpis v outru
    if (opts.narrator) {
      var nm = typeof opts.narrator === 'string' ? opts.narrator : 'Pan Radar';
      var h0 = script.scenes[0]; if (h0 && h0.vo) h0.vo = 'Tady ' + nm + '. ' + h0.vo;
      var o0 = script.scenes[script.scenes.length - 1]; if (o0 && o0.type === 'outro') o0.vo = 'Zítra den ' + (d + 1) + '. ' + nm + ' končí hlášení.';
      layout(script);
    }
    writeHookMemo(d, hookId);
    return script;
  }
  // spočítá časy scén a titulků (deterministicky, sedí s voiceScript)
  // opts.voDurations: skutečné délky namluvených segmentů v ms (pole v pořadí voiceScript().segments,
  // nebo objekt {indexScény: ms}). Scény se natáhnou/zkrátí podle audia a titulky se přepočítají.
  function layout(script, lopts) {
    var t = 0, k = 0, vd = lopts && lopts.voDurations;
    script.scenes.forEach(function (s, i) {
      s.voStart = s.voStart != null ? s.voStart : (s.type === 'hook' ? 150 : s.type === 'outro' ? 400 : 220);
      if (vd && s.vo) { var v = Array.isArray(vd) ? vd[k] : (vd[i] != null ? vd[i] : vd[s.type]); if (v > 0) s.voDur = v; k++; }
      var tw = timeWords(s.vo || '', s.voStart);
      if (s.voDur && tw.words.length) {
        var f = s.voDur / Math.max(1, tw.words[tw.words.length - 1].end - s.voStart);
        tw.words.forEach(function (w) { w.start = s.voStart + (w.start - s.voStart) * f; w.end = s.voStart + (w.end - s.voStart) * f; });
        tw.end = s.voStart + s.voDur;
      }
      s.words = tw.words; s.chunks = chunkWords(s.words);
      var need = (s.vo ? tw.end : 0) + (s.type === 'outro' ? 600 : 260);
      s.dur = s.voDur ? Math.max(s.durFixed || 0, Math.round(need), s.type === 'hook' ? 2000 : 1500) : (s.durFixed || Math.max(DEFAULT_DUR[s.type] || 3000, Math.round(need)));
      s.t0 = t; t += s.dur;
      s.idx = i;
    });
    script.total = t;
    return script;
  }

  function msToSrt(ms) {
    ms = Math.max(0, Math.round(ms));
    var h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60, x = ms % 1000;
    function p(n, l) { n = String(n); while (n.length < l) n = '0' + n; return n; }
    return p(h, 2) + ':' + p(m, 2) + ':' + p(s, 2) + ',' + p(x, 3);
  }
  function voiceScript(script) {
    if (!script.total) layout(script);
    var segs = [], lines = [], srt = [], k = 1;
    script.scenes.forEach(function (s) {
      if (!s.vo) return;
      var a = s.t0 + s.voStart, b = s.t0 + (s.words.length ? s.words[s.words.length - 1].end : s.voStart);
      segs.push({ index: segs.length, scene: s.type, sceneIndex: s.idx, start: Math.round(a), end: Math.round(b), dur: Math.round(b - a),
        sceneStart: Math.round(s.t0), sceneEnd: Math.round(s.t0 + s.dur), voStart: s.voStart, maxDur: Math.round(s.dur - s.voStart - 200), text: s.vo });
      lines.push('[' + (a / 1000).toFixed(1) + ' s – ' + (b / 1000).toFixed(1) + ' s]  ' + s.vo);
      s.chunks.forEach(function (ch, ci) {
        var w0 = s.words[ch[0]], w1 = s.words[ch[ch.length - 1]], nx = s.chunks[ci + 1];
        var end = nx ? Math.min(w1.end + 200, s.words[nx[0]].start - 20) : w1.end + 300;
        srt.push(k++ + '\n' + msToSrt(s.t0 + w0.start) + ' --> ' + msToSrt(s.t0 + end) + '\n' + ch.map(function (j) { return s.words[j].w; }).join(' ') + '\n');
      });
    });
    var head = 'RADAR · ' + script.title + ' · délka ' + (script.total / 1000).toFixed(1) + ' s\n' +
      'Voiceover (tykání, energicky, tempo cca 16 znaků/s). Časy = začátek–konec od začátku videa.\n\n';
    return { text: head + lines.join('\n') + '\n', json: JSON.stringify({ day: script.day, hook: script.hook, total: Math.round(script.total), segments: segs }, null, 1), plain: segs.map(function (s) { return s.text; }).join(' '), segments: segs, srt: srt.join('\n'), total: script.total };
  }

  // ------------------------------------------------------------------ RENDERER
  var R = {
    canvas: null, g: null, running: false, script: null, t0: 0, last: 0, idx: -1, raf: 0, mode: 'play',
    tts: false, spoken: {}, live: null, resolve: null, opts: {}, ticks: 0, lastCount: -1
  };

  function ensureCanvas() {
    if (R.canvas) return R.canvas;
    var c = document.createElement('canvas'); c.width = W; c.height = H;
    c.className = 'reel-canvas';
    R.canvas = c; R.g = c.getContext('2d', { alpha: false });
    return c;
  }

  // ---- kreslení podkladu (hra)
  function drawGame(g) {
    var gc = G() && G().canvas;
    g.fillStyle = C.navy; g.fillRect(0, 0, W, H);
    if (!gc || !gc.width) return;
    var s = Math.max(W / gc.width, H / gc.height), dw = gc.width * s, dh = gc.height * s;
    try { g.drawImage(gc, (W - dw) / 2, (H - dh) / 2, dw, dh); } catch (e) {}
  }
  function grade(g, top, bottom, dim) {
    var gr = g.createLinearGradient(0, 0, 0, 1080);
    gr.addColorStop(0, 'rgba(11,20,48,' + top + ')'); gr.addColorStop(0.55, 'rgba(11,20,48,' + (top * 0.62) + ')'); gr.addColorStop(1, 'rgba(11,20,48,0)');
    g.fillStyle = gr; g.fillRect(0, 0, W, 1080);
    var gb = g.createLinearGradient(0, 1150, 0, H);
    gb.addColorStop(0, 'rgba(11,20,48,0)'); gb.addColorStop(1, 'rgba(11,20,48,' + bottom + ')');
    g.fillStyle = gb; g.fillRect(0, 1150, W, H - 1150);
    var v = g.createRadialGradient(W / 2, H * 0.5, H * 0.3, W / 2, H * 0.5, H * 0.75);
    v.addColorStop(0, 'rgba(5,10,30,0)'); v.addColorStop(1, 'rgba(5,10,30,0.45)');
    g.fillStyle = v; g.fillRect(0, 0, W, H);
    if (dim > 0) { g.fillStyle = 'rgba(11,20,48,' + dim + ')'; g.fillRect(0, 0, W, H); }
  }

  // ---- radar (kruh, prstence, sweep, blipy)
  function drawRadar(g, cx, cy, r, ang, alpha, o) {
    o = o || {};
    g.save(); g.globalAlpha = alpha;
    if (o.fill !== false) {
      var bg = g.createRadialGradient(cx, cy, 0, cx, cy, r);
      bg.addColorStop(0, 'rgba(47,114,214,0.55)'); bg.addColorStop(0.7, 'rgba(19,34,79,0.75)'); bg.addColorStop(1, 'rgba(11,20,48,0.9)');
      g.fillStyle = bg; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
    }
    g.strokeStyle = 'rgba(95,168,232,0.55)'; g.lineWidth = o.lw || 3;
    for (var i = 1; i <= 4; i++) { g.beginPath(); g.arc(cx, cy, r * i / 4, 0, Math.PI * 2); g.stroke(); }
    g.lineWidth = (o.lw || 3) * 0.6; g.strokeStyle = 'rgba(95,168,232,0.35)';
    g.beginPath(); g.moveTo(cx - r, cy); g.lineTo(cx + r, cy); g.moveTo(cx, cy - r); g.lineTo(cx, cy + r); g.stroke();
    // tick marks
    g.strokeStyle = 'rgba(191,224,255,0.5)'; g.lineWidth = 2;
    for (var k = 0; k < 72; k++) {
      var a = k / 72 * Math.PI * 2, l = k % 6 === 0 ? 0.06 : 0.025;
      g.beginPath(); g.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); g.lineTo(cx + Math.cos(a) * r * (1 - l), cy + Math.sin(a) * r * (1 - l)); g.stroke();
    }
    // sweep
    var trail = 1.15, steps = 28;
    for (var s = 0; s < steps; s++) {
      var a0 = ang - trail * (s + 1) / steps, a1 = ang - trail * s / steps;
      g.fillStyle = 'rgba(95,168,232,' + (0.42 * Math.pow(1 - s / steps, 2)) + ')';
      g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, r, a0 - 0.012, a1 + 0.012); g.closePath(); g.fill();
    }
    g.strokeStyle = 'rgba(220,240,255,0.95)'; g.lineWidth = (o.lw || 3) * 1.3;
    g.shadowColor = C.sky; g.shadowBlur = 24;
    g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r); g.stroke();
    g.shadowBlur = 0;
    // blipy
    if (o.blips) o.blips.forEach(function (b) {
      var ba = Math.atan2(b.y, b.x), d = ((ang - ba) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
      var life = Math.max(0, 1 - d / 3.2);
      if (life <= 0) return;
      var px = cx + b.x * r, py = cy + b.y * r;
      g.fillStyle = b.hot ? 'rgba(255,210,63,' + life + ')' : 'rgba(191,224,255,' + life + ')';
      g.shadowColor = b.hot ? C.yellow : C.sky; g.shadowBlur = 18 * life;
      g.beginPath(); g.arc(px, py, (b.s || 8) * (0.7 + 0.5 * life), 0, Math.PI * 2); g.fill();
      if (b.hot && life > 0.6) { g.strokeStyle = 'rgba(255,210,63,' + (life - 0.6) * 2 + ')'; g.lineWidth = 3; g.beginPath(); g.arc(px, py, 14 + (1 - life) * 60, 0, Math.PI * 2); g.stroke(); }
    });
    g.shadowBlur = 0;
    g.fillStyle = C.ice; g.beginPath(); g.arc(cx, cy, (o.lw || 3) * 2.2, 0, Math.PI * 2); g.fill();
    g.restore();
  }

  // ---- přechod: radarový sweep wipe (p 0..1)
  function sweepWipe(g, p) {
    if (p <= 0 || p >= 1) return;
    var cx = W / 2, cy = H / 2, R0 = Math.hypot(W, H) / 2 + 10, base = -Math.PI / 2, a0, a1, edge;
    if (p < 0.5) { var q = E.inOut(p / 0.5); a0 = base; a1 = base + q * Math.PI * 2; edge = a1; }
    else { var q2 = E.inOut((p - 0.5) / 0.5); a0 = base + q2 * Math.PI * 2; a1 = base + Math.PI * 2; edge = a0; }
    g.save();
    g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, R0, a0, a1); g.closePath(); g.clip();
    var bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, C.sky); bg.addColorStop(0.45, C.blue); bg.addColorStop(1, C.navy);
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 3;
    for (var i = 1; i <= 7; i++) { g.beginPath(); g.arc(cx, cy, i * 150, 0, Math.PI * 2); g.stroke(); }
    g.font = font(150, 900); g.fillStyle = 'rgba(255,255,255,0.95)'; g.textAlign = 'center'; g.textBaseline = 'middle';
    spacedText(g, 'RADAR', cx, cy, 14, 'center');
    g.restore();
    g.save();
    var dir = p < 0.5 ? -1 : 1;
    for (var k = 0; k < 14; k++) {
      var b0 = edge + dir * 0.03 * k, b1 = edge + dir * 0.03 * (k + 1);
      g.fillStyle = 'rgba(191,224,255,' + (0.28 * (1 - k / 14)) + ')';
      g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, R0, Math.min(b0, b1) - 0.004, Math.max(b0, b1) + 0.004); g.closePath(); g.fill();
    }
    g.strokeStyle = '#ffffff'; g.lineWidth = 8; g.shadowColor = C.sky; g.shadowBlur = 40;
    g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(edge) * R0, cy + Math.sin(edge) * R0); g.stroke();
    g.restore();
  }

  // ---- kinetická typografie: jedna řádka, slova najíždějí se scale punch
  function kLine(g, text, cx, y, size, lt, delay, o) {
    o = o || {};
    var weight = o.weight || 900, stagger = o.stagger == null ? 75 : o.stagger, maxW = o.maxW || 940;
    size = fitSize(g, text, maxW - (o.sticker ? 70 : 0), size, weight, 30);
    g.font = font(size, weight);
    var words = String(text).split(' '), sp = size * 0.26;
    var ws = words.map(function (w) { return g.measureText(w).width; });
    var total = ws.reduce(function (a, b) { return a + b; }, 0) + sp * (words.length - 1);
    var x = cx - total / 2;
    var outT = o.out, pIn = prog(lt, delay, delay + 360), pOut = outT != null ? prog(lt, outT, outT + 260) : 0;
    if (pIn <= 0 || pOut >= 1) return { w: total, h: size };
    g.save();
    g.textBaseline = 'alphabetic'; g.textAlign = 'left';
    if (o.sticker) {
      var padX = size * 0.32, padY = size * 0.2, sw = total + padX * 2, sh = size * 1.12 + padY;
      var e = E.outBack(pIn), sx = clamp(e, 0, 1.2) * (1 - pOut);
      g.save(); g.translate(cx, y - size * 0.36); g.rotate((o.rot || -0.035)); g.scale(sx, 1);
      g.shadowColor = 'rgba(0,0,0,0.35)'; g.shadowBlur = 30; g.shadowOffsetY = 10;
      g.fillStyle = o.sticker; rr(g, -sw / 2, -sh / 2, sw, sh, size * 0.16); g.fill();
      g.restore();
    }
    for (var i = 0; i < words.length; i++) {
      var p = prog(lt, delay + i * stagger, delay + i * stagger + 380);
      if (p <= 0) { x += ws[i] + sp; continue; }
      var e2 = E.outBack(p), s = lerp(o.punch || 1.7, 1, e2), a = clamp(p * 4, 0, 1);
      var dy = (1 - E.outCubic(p)) * size * 0.55, q = outT != null ? prog(lt, outT + i * 35, outT + i * 35 + 240) : 0;
      dy -= E.inCubic(q) * size * 0.8; a *= 1 - q;
      g.save(); g.globalAlpha = a;
      g.translate(x + ws[i] / 2, y + dy - size * 0.35); g.rotate(o.sticker ? (o.rot || -0.035) : 0); g.scale(s, s);
      if (!o.sticker && o.shadow !== false) { g.shadowColor = 'rgba(5,10,30,0.55)'; g.shadowBlur = size * 0.18; g.shadowOffsetY = size * 0.05; }
      if (o.stroke) { g.lineJoin = 'round'; g.lineWidth = o.stroke; g.strokeStyle = o.strokeColor || C.navy; g.strokeText(words[i], -ws[i] / 2, size * 0.35); }
      g.fillStyle = o.color || C.white; g.fillText(words[i], -ws[i] / 2, size * 0.35);
      g.restore();
      x += ws[i] + sp;
    }
    g.restore();
    return { w: total, h: size };
  }

  function chip(g, text, cx, y, o) {
    o = o || {};
    var size = o.size || 38; g.font = font(size, o.weight || 800);
    var sp = o.spacing == null ? 3 : o.spacing, tw = spacedWidth(g, text, sp), padX = size * 0.6, h = size * 1.7;
    var w = tw + padX * 2 + (o.icon ? h * 0.6 : 0), x = o.align === 'left' ? cx : cx - w / 2;
    g.save(); g.globalAlpha = o.alpha == null ? 1 : o.alpha;
    if (o.scale) { g.translate(x + w / 2, y); g.scale(o.scale, o.scale); g.translate(-(x + w / 2), -y); }
    g.fillStyle = o.bg || 'rgba(11,20,48,0.72)'; rr(g, x, y - h / 2, w, h, h / 2); g.fill();
    if (o.border) { g.strokeStyle = o.border; g.lineWidth = 2.5; g.stroke(); }
    g.fillStyle = o.color || C.white; g.textBaseline = 'middle';
    var tx = x + padX;
    if (o.icon) { o.icon(g, x + padX + h * 0.12, y, h * 0.32); tx += h * 0.6; }
    spacedText(g, text, tx, y + size * 0.04, sp, 'left');
    g.restore();
    return w;
  }

  // ---- ikonky
  function iconDot(color, t) { return function (g, x, y, r) { var p = (Math.sin(t / 180) + 1) / 2; g.fillStyle = color; g.beginPath(); g.arc(x, y, r * 0.55, 0, 7); g.fill(); g.strokeStyle = color; g.globalAlpha *= 1 - p; g.lineWidth = 3; g.beginPath(); g.arc(x, y, r * (0.6 + p * 0.9), 0, 7); g.stroke(); g.globalAlpha = 1; }; }
  function iconRadar(t) { return function (g, x, y, r) { g.strokeStyle = C.sky; g.lineWidth = 2.5; g.beginPath(); g.arc(x, y, r, 0, 7); g.stroke(); g.beginPath(); g.arc(x, y, r * 0.5, 0, 7); g.stroke(); var a = t / 400; g.strokeStyle = C.white; g.lineWidth = 3; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); g.stroke(); }; }
  function heart(g, x, y, s, color) {
    g.save(); g.translate(x, y); g.scale(s / 32, s / 32); g.fillStyle = color;
    g.beginPath(); g.moveTo(0, 10); g.bezierCurveTo(-26, -6, -14, -26, 0, -12); g.bezierCurveTo(14, -26, 26, -6, 0, 10); g.closePath(); g.fill(); g.restore();
  }
  function shield(g, x, y, w, h, color, letter) {
    g.save(); g.translate(x, y); g.scale(w / 100, h / 120);
    g.beginPath(); g.moveTo(8, 8); g.lineTo(92, 8); g.lineTo(92, 60); g.bezierCurveTo(92, 88, 72, 104, 50, 113); g.bezierCurveTo(28, 104, 8, 88, 8, 60); g.closePath();
    g.fillStyle = color; g.fill(); g.lineWidth = 5; g.strokeStyle = '#fff'; g.stroke();
    if (letter) { g.fillStyle = '#fff'; g.font = font(54, 900); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(letter, 50, 58); }
    g.restore();
  }

  // ---- odometr (rolovací číslice)
  function odometer(g, value, cx, y, size, color) {
    var v = Math.max(0, value), str = fmt(Math.floor(v)), digits = String(Math.floor(v)).length;
    g.font = font(size, 900);
    var cw = g.measureText('0').width * 1.02, gap = size * 0.18, ch = size * 1.05;
    var groups = Math.floor((digits - 1) / 3), totalW = digits * cw + groups * gap;
    var x = cx - totalW / 2;
    g.save(); g.textAlign = 'center'; g.textBaseline = 'middle';
    for (var i = 0; i < digits; i++) {
      var k = digits - 1 - i, pk = Math.pow(10, k);
      var dVal = Math.floor(v / pk) % 10, frac;
      if (k === 0) frac = v - Math.floor(v);
      else { var lower = v % pk; frac = clamp(lower - (pk - 1), 0, 1); }
      var e = E.inOut(frac);
      g.save(); g.beginPath(); g.rect(x, y - ch / 2, cw, ch); g.clip();
      g.fillStyle = color || C.white;
      g.shadowColor = 'rgba(5,10,30,0.5)'; g.shadowBlur = 20;
      g.fillText(String(dVal), x + cw / 2, y - e * ch);
      g.fillText(String((dVal + 1) % 10), x + cw / 2, y + ch - e * ch);
      g.restore();
      x += cw; if (k > 0 && k % 3 === 0) x += gap;
    }
    g.restore();
    return totalW;
  }

  // ---- reticle (zaměření obce)
  function reticle(g, cx, cy, lt, color) {
    var p = E.outBack(prog(lt, 250, 750)), r = 120 * p + 10, a = lt / 900;
    if (p <= 0) return;
    g.save(); g.translate(cx, cy); g.globalAlpha = clamp(p, 0, 1);
    g.strokeStyle = color || C.yellow; g.lineWidth = 6; g.lineCap = 'round';
    for (var i = 0; i < 4; i++) {
      g.save(); g.rotate(a + i * Math.PI / 2);
      g.beginPath(); g.arc(0, 0, r, -0.35, 0.35); g.stroke();
      g.restore();
    }
    g.lineWidth = 2.5; g.globalAlpha *= 0.7;
    g.beginPath(); g.arc(0, 0, r * 0.55, 0, 7); g.stroke();
    var pp = (lt % 1200) / 1200;
    g.globalAlpha = (1 - pp) * 0.8; g.lineWidth = 4; g.beginPath(); g.arc(0, 0, r * (0.6 + pp * 1.4), 0, 7); g.stroke();
    g.restore();
  }

  // ------------------------------------------------------------------ SCÉNY
  var SCENES = {};

  var HOOKS = {};
  HOOKS.classic = {
    enter: function (s, sc) {
      var st = safeState(), town = (st.towns || []).filter(function (t) { return t.name === s.town; })[0] || (st.towns || [])[0];
      var h = town && town.houses && town.houses[town.houses.length - 1];
      gcall('orbit', 0);
      (h ? gcall('focusHouse', h.id, 0) : gcall('overview', 0)).then(function () {
        later(function () { (town ? gcall('focusTown', town.name, 2300) : gcall('overview', 2300)).then(function () { gcall('orbit', 0.35); }); }, 120);
      });
      AU.boom(0); AU.ping(0.08, 1480); AU.whoosh(s.dur / 1000 - 0.3, 0.6);
      var bl = []; for (var i = 0; i < 26; i++) { var r = 0.15 + ((hash('b' + i) % 1000) / 1000) * 0.8, a = (hash('a' + i) % 6283) / 1000; bl.push({ x: Math.cos(a) * r, y: Math.sin(a) * r, s: 7 + (i % 3) * 3, hot: i % 5 === 0 }); }
      s._blips = bl;
    },
    draw: function (g, s, lt) {
      grade(g, 0.55, 0.6, 0);
      // radarové intro, které se „otevře“ do mapy (iris)
      var iris = E.inOut(prog(lt, 380, 1100));
      if (iris < 1) {
        g.save();
        var holeR = iris * Math.hypot(W, H) * 0.6;
        g.beginPath(); g.rect(0, 0, W, H); g.arc(W / 2, 1180, holeR, 0, Math.PI * 2, true); g.clip('evenodd');
        var bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, C.navy2); bg.addColorStop(1, C.navy); g.fillStyle = bg; g.fillRect(0, 0, W, H);
        drawRadar(g, W / 2, 1180, 430, -Math.PI / 2 + lt / 260, 1, { blips: s._blips, lw: 3 });
        g.restore();
        if (holeR > 4) { g.save(); g.strokeStyle = C.sky; g.lineWidth = 6; g.shadowColor = C.sky; g.shadowBlur = 30; g.beginPath(); g.arc(W / 2, 1180, holeR, 0, 7); g.stroke(); g.restore(); }
      }
      // flash na začátku
      var fl = 1 - prog(lt, 0, 220); if (fl > 0) { g.fillStyle = 'rgba(255,255,255,' + fl * 0.5 + ')'; g.fillRect(0, 0, W, H); }
      // kamera „shake“ simulace přes offset textu
      var shake = (1 - prog(lt, 0, 400)) * 10;
      g.save(); g.translate(Math.sin(lt / 17) * shake, Math.cos(lt / 23) * shake);
      var out = s.dur - 340;
      var bigIsNum = /^\+\d/.test(s.big);
      kLine(g, s.big, W / 2, bigIsNum ? 835 : 720, bigIsNum ? 340 : 230, lt, 60, { color: C.yellow, out: out, punch: 2.2, stroke: 0 });
      kLine(g, s.big2, W / 2, bigIsNum ? 985 : 900, 108, lt, 300, { color: C.white, out: out + 40, stagger: 90 });
      kLine(g, s.sticker, W / 2, bigIsNum ? 1130 : 1060, 64, lt, 620, { sticker: C.white, color: C.ink, out: out + 80, punch: 1.3, stagger: 50 });
      g.restore();
    }
  };

  // ---- kamera
  function camHouse(h, dist, ms) {
    if (!h) return Promise.resolve();
    var d = dist || 24;
    return gcall('flyTo', { target: { x: h.x, y: 1.5, z: h.z }, pos: { x: h.x + d * 0.3, y: d * 0.62, z: h.z + d * 0.72 } }, Math.max(16, ms || 0));
  }
  function camTown(name, ms) { return name ? gcall('focusTown', name, Math.max(16, ms || 0)) : gcall('overview', Math.max(16, ms || 0)); }
  function houseY() { return R.opts.houseY || H / 2; }
  function townY() { return R.opts.focusY || 1130; }

  // ---------- HOOK: VÝPADEK RADARU (glitch → odhalení čísla)
  HOOKS.glitch = {
    cut: 950, headerAt: 950,
    enter: function (s) {
      gcall('orbit', 0); camTown(s.town, 16).then(function () { gcall('orbit', 0.3); });
      AU.glitch(0, 0.28); AU.glitch(0.34, 0.2); AU.glitch(0.66, 0.26); AU.boom(0.95); AU.ping(1.0, 1480); AU.whoosh(s.dur / 1000 - 0.3, 0.6);
    },
    draw: function (g, s, lt) {
      var cut = this.cut, seed = 'g' + Math.floor(lt / 70);
      if (lt < cut) {
        g.fillStyle = 'rgba(4,8,22,0.9)'; g.fillRect(0, 0, W, H);
        drawRadar(g, W / 2, 900, 420, -Math.PI / 2 + lt / 300, 0.35, { fill: false, lw: 3 });
        var jit = rnd(seed) > 0.72 ? 1 : 0, amt = 5 + jit * 12;
        var cp = E.outBack(prog(lt, 60, 300));
        chip(g, '⚠ SIGNÁL ZTRACEN', W / 2, 560, { size: 40, bg: C.red, color: C.white, weight: 900, spacing: 5, scale: Math.max(0.001, cp), alpha: clamp(cp, 0, 1) });
        var tp = prog(lt, 80, 260);
        g.save(); g.globalAlpha = tp;
        rgbText(g, 'VÝPADEK', W / 2 + (jit ? (rnd(seed + 'q') - 0.5) * 24 : 0), 780, 180, C.white, amt);
        rgbText(g, 'RADARU', W / 2 - (jit ? (rnd(seed + 'w') - 0.5) * 24 : 0), 960, 180, C.yellow, amt * 0.8);
        g.restore();
        // šum
        g.save(); for (var i = 0; i < 24; i++) { g.fillStyle = 'rgba(255,255,255,' + (0.04 + rnd(seed + 'n' + i) * 0.16) + ')'; g.fillRect(rnd(seed + 'x' + i) * W, rnd(seed + 'y' + i) * H, 20 + rnd(seed + 'w' + i) * 220, 3); } g.restore();
        scanlines(g, 0.22);
        sliceShift(g, jit ? 46 : 10, seed, jit ? 5 : 2);
        // blik do bíla těsně před střihem
        var fl = prog(lt, cut - 90, cut); if (fl > 0) { g.fillStyle = 'rgba(255,255,255,' + fl * 0.9 + ')'; g.fillRect(0, 0, W, H); }
        return;
      }
      var l2 = lt - cut;
      grade(g, 0.55, 0.6, 0);
      var fl2 = 1 - prog(l2, 0, 260); if (fl2 > 0) { g.fillStyle = 'rgba(255,255,255,' + fl2 * 0.7 + ')'; g.fillRect(0, 0, W, H); }
      var out = s.dur - cut - 340;
      kLine(g, s.big, W / 2, 835, 340, l2, 40, { color: C.yellow, out: out, punch: 2.2 });
      kLine(g, s.big2, W / 2, 985, 108, l2, 220, { color: C.white, out: out + 40, stagger: 80 });
      kLine(g, s.sticker, W / 2, 1130, 64, l2, 450, { sticker: C.white, color: C.ink, out: out + 80, punch: 1.3, stagger: 50 });
      if (l2 < 300) sliceShift(g, 50 * (1 - l2 / 300), 'r' + Math.floor(l2 / 60), 4, C.navy);
    }
  };

  // ---------- HOOK: +38 LIDÍ ZA 24 HODIN (ciferník 24 h)
  HOOKS.counter = {
    enter: function (s) {
      gcall('orbit', 0); gcall('overview', 16); later(function () { if (R.running) camTown(s.town, 2400).then(function () { gcall('orbit', 0.3); }); }, 200);
      AU.boom(0); AU.ping(0.1, 1480); AU.ping(1.45, 1760); AU.whoosh(s.dur / 1000 - 0.3, 0.6); R.lastCount = -1;
    },
    draw: function (g, s, lt) {
      grade(g, 0.6, 0.6, 0.35 * (1 - prog(lt, s.dur - 300, s.dur)));
      var fl = 1 - prog(lt, 0, 200); if (fl > 0) { g.fillStyle = 'rgba(255,255,255,' + fl * 0.5 + ')'; g.fillRect(0, 0, W, H); }
      var cx = W / 2, cy = 860, r = 250, out = s.dur - 320;
      var a = E.outBack(prog(lt, 0, 380)) * (1 - prog(lt, out, out + 250)), p = E.outCubic(prog(lt, 150, 1400));
      if (a > 0) {
        g.save(); g.globalAlpha = clamp(a, 0, 1); g.translate(cx, cy); g.scale(a, a);
        g.fillStyle = 'rgba(11,20,48,0.55)'; g.beginPath(); g.arc(0, 0, r + 60, 0, 7); g.fill();
        g.lineWidth = 28; g.strokeStyle = 'rgba(255,255,255,0.14)'; g.beginPath(); g.arc(0, 0, r, 0, 7); g.stroke();
        for (var i = 0; i < 24; i++) {
          var ang = -Math.PI / 2 + i / 24 * Math.PI * 2, on = i / 24 <= p, l = i % 6 === 0 ? 30 : 16;
          g.strokeStyle = on ? C.yellow : 'rgba(191,224,255,0.4)'; g.lineWidth = i % 6 === 0 ? 6 : 4;
          g.beginPath(); g.moveTo(Math.cos(ang) * (r + 26), Math.sin(ang) * (r + 26)); g.lineTo(Math.cos(ang) * (r + 26 + l), Math.sin(ang) * (r + 26 + l)); g.stroke();
        }
        g.shadowColor = C.yellow; g.shadowBlur = 30; g.strokeStyle = C.yellow; g.lineWidth = 28; g.lineCap = 'round';
        if (p > 0.002) { g.beginPath(); g.arc(0, 0, r, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2); g.stroke(); }
        var ea = -Math.PI / 2 + p * Math.PI * 2; g.shadowBlur = 0;
        g.fillStyle = '#fff'; g.beginPath(); g.arc(Math.cos(ea) * r, Math.sin(ea) * r, 22, 0, 7); g.fill();
        g.restore();
        var val = Math.round(lerp(0, s.n, p)), bump = 1 + Math.sin(prog(lt, 1400, 1700) * Math.PI) * 0.12;
        if (val !== R.lastCount && lt - (R._lastTick || 0) > 45 && lt < 1450) { AU.tick(0, 1900 + (val % 7) * 90); R._lastTick = lt; R.lastCount = val; }
        g.save(); g.globalAlpha = clamp(a, 0, 1); g.translate(cx, cy - 30); g.scale(a * bump, a * bump);
        var txt = '+' + val, size = fitSize(g, '+' + s.n, 400, 200, 900, 80);
        g.font = font(size, 900); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = C.yellow;
        g.shadowColor = 'rgba(5,10,30,0.5)'; g.shadowBlur = 24; g.fillText(txt, 0, 0);
        g.shadowBlur = 0; g.font = font(64, 900); g.fillStyle = '#fff'; spacedText(g, s.big2, 0, size * 0.62, 8, 'center');
        g.restore();
      }
      kLine(g, s.sticker, W / 2, 1250, 62, lt, 900, { sticker: C.white, color: C.ink, out: out + 60, punch: 1.3, stagger: 50 });
    }
  };

  // ---------- HOOK: KDE JE TVŮJ DOMEK? (špendlíky + lupa)
  HOOKS.where = {
    enter: function (s) {
      gcall('orbit', 0); gcall('overview', 1100).then(function () { gcall('orbit', 0.1); });
      AU.ping(0.05, 1320);
      for (var i = 0; i < 9; i++) AU.pop(0.32 + i * 0.07, 520 + i * 45);
      AU.whoosh(s.dur / 1000 - 0.3, 0.6);
    },
    draw: function (g, s, lt) {
      grade(g, 0.65, 0.5, 0);
      var out = s.dur - 320;
      // lupa – zvětšený výřez hry
      var lp = E.outBack(prog(lt, 800, 1150)) * (1 - prog(lt, out, out + 200));
      var lx = W / 2 + Math.sin(lt / 650) * 250, ly = 1110 + Math.sin(lt / 410) * 80, lr = 150;
      // špendlíky
      for (var i = 0; i < 12; i++) {
        var px = 130 + rnd('px' + i) * 820, py = 990 + rnd('py' + i) * 290, t0 = 280 + i * 70, q = prog(lt, t0, t0 + 420);
        if (q <= 0) continue;
        var by = (1 - E.outBack(q)) * -260, hot = Math.hypot(px - lx, py - 50 - ly) < lr && lp > 0.5;
        g.save(); g.globalAlpha = clamp(q * 3, 0, 1) * (1 - prog(lt, out, out + 200));
        pin(g, px, py + by, hot ? 92 : 70, hot ? C.white : C.yellow, 'house');
        g.restore();
      }
      if (lp > 0) {
        var gc = G() && G().canvas;
        g.save(); g.translate(lx, ly); g.scale(lp, lp); g.translate(-lx, -ly);
        g.save(); g.beginPath(); g.arc(lx, ly, lr, 0, 7); g.clip();
        if (gc && gc.width) {
          var sc = Math.max(W / gc.width, H / gc.height), ox = (W - gc.width * sc) / 2, oy = (H - gc.height * sc) / 2, z = 2;
          var sx = (lx - ox) / sc, sy = (ly - oy) / sc, hw = lr / (sc * z);
          try { g.drawImage(gc, sx - hw, sy - hw, hw * 2, hw * 2, lx - lr, ly - lr, lr * 2, lr * 2); } catch (e) {}
        }
        var sh = g.createRadialGradient(lx - 50, ly - 60, 10, lx, ly, lr); sh.addColorStop(0, 'rgba(255,255,255,0.25)'); sh.addColorStop(0.5, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(11,20,48,0.25)');
        g.fillStyle = sh; g.fillRect(lx - lr, ly - lr, lr * 2, lr * 2);
        g.restore();
        g.lineCap = 'round'; g.strokeStyle = C.navy; g.lineWidth = 44;
        g.beginPath(); g.moveTo(lx + Math.cos(0.8) * (lr + 14), ly + Math.sin(0.8) * (lr + 14)); g.lineTo(lx + Math.cos(0.8) * (lr + 120), ly + Math.sin(0.8) * (lr + 120)); g.stroke();
        g.strokeStyle = C.yellow; g.lineWidth = 30; g.stroke();
        g.strokeStyle = '#fff'; g.lineWidth = 14; g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 20; g.beginPath(); g.arc(lx, ly, lr, 0, 7); g.stroke();
        g.restore();
      }
      var fl = 1 - prog(lt, 0, 200); if (fl > 0) { g.fillStyle = 'rgba(255,255,255,' + fl * 0.45 + ')'; g.fillRect(0, 0, W, H); }
      kLine(g, 'KDE JE', W / 2, 655, 130, lt, 30, { out: out, punch: 2 });
      kLine(g, 'TVŮJ DOMEK?', W / 2, 790, 124, lt, 200, { color: C.yellow, out: out + 30, punch: 1.8 });
      kLine(g, s.sticker, W / 2, 915, 52, lt, 640, { sticker: C.white, color: C.ink, out: out + 60, punch: 1.3, stagger: 45 });
    }
  };

  // ---------- HOOK: odpočet 3·2·1 → DEN 7
  HOOKS.countdown = {
    step: 380, noDay: true,
    enter: function (s) {
      gcall('orbit', 0); gcall('overview', 16);
      var st = this.step / 1000;
      AU.tick(0, 1800); AU.beep(0, 660, 0.12); AU.beep(st, 660, 0.12); AU.beep(st * 2, 660, 0.12); AU.beep(st * 3, 1320, 0.3); AU.boom(st * 3);
      later(function () { if (R.running) camTown(s.town, 1600).then(function () { gcall('orbit', 0.3); }); }, this.step * 3);
      AU.whoosh(s.dur / 1000 - 0.3, 0.6);
    },
    draw: function (g, s, lt) {
      var stp = this.step, end = stp * 3, cx = W / 2, cy = 860, out = s.dur - 320;
      grade(g, 0.55, 0.6, 0);
      if (lt < end + 200) {
        var oa = 1 - prog(lt, end, end + 200);
        g.fillStyle = 'rgba(8,14,36,' + 0.82 * oa + ')'; g.fillRect(0, 0, W, H);
        if (lt < end) {
          var k = Math.floor(lt / stp), f = (lt % stp) / stp, dgt = 3 - k;
          g.save();
          // filmový leader
          g.strokeStyle = 'rgba(191,224,255,0.55)'; g.lineWidth = 4;
          g.beginPath(); g.arc(cx, cy, 280, 0, 7); g.stroke(); g.beginPath(); g.arc(cx, cy, 225, 0, 7); g.stroke();
          g.beginPath(); g.moveTo(cx - 420, cy); g.lineTo(cx + 420, cy); g.moveTo(cx, cy - 320); g.lineTo(cx, cy + 380); g.stroke();
          g.fillStyle = 'rgba(95,168,232,0.38)'; g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, 280, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2); g.closePath(); g.fill();
          g.strokeStyle = C.yellow; g.lineWidth = 10; g.beginPath(); g.arc(cx, cy, 280 + E.outCubic(f) * 110, 0, 7); g.globalAlpha = 1 - f; g.stroke(); g.globalAlpha = 1;
          var sc = lerp(1.5, 1, E.outBack(prog(f, 0, 0.45)));
          g.translate(cx, cy); g.scale(sc, sc); g.font = font(330, 900); g.textAlign = 'center'; g.textBaseline = 'middle';
          g.fillStyle = '#fff'; g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 30; g.fillText(String(dgt), 0, 10);
          g.restore();
          scanlines(g, 0.12);
        }
      }
      var fl = prog(lt, end, end + 40) * (1 - prog(lt, end + 40, end + 300)); if (fl > 0) { g.fillStyle = 'rgba(255,255,255,' + fl * 0.8 + ')'; g.fillRect(0, 0, W, H); }
      var shake = lt > end ? (1 - prog(lt, end, end + 400)) * 12 : 0;
      g.save(); g.translate(Math.sin(lt / 17) * shake, Math.cos(lt / 23) * shake);
      kLine(g, 'DEN ' + s.day, W / 2, 840, 270, lt, end, { color: C.yellow, out: out, punch: 2.3, stagger: 60 });
      kLine(g, s.sticker, W / 2, 1050, 64, lt, end + 260, { sticker: C.white, color: C.ink, out: out + 60, punch: 1.3, stagger: 50 });
      g.restore();
    }
  };

  // ---------- HOOK: KDO TO JE? (zoom na domek, odkrytí nicku)
  HOOKS.who = {
    reveal: 1500,
    enter: function (s) {
      gcall('orbit', 0);
      var h = s.house;
      camHouse(h, 14, 16); later(function () { if (R.running) camHouse(h, 60, 2400); }, 140);
      AU.ping(0.02, 1480); AU.riser(0.3, 1.15); AU.boom(this.reveal / 1000); AU.pop(this.reveal / 1000 + 0.05, 800);
      AU.whoosh(s.dur / 1000 - 0.3, 0.6);
    },
    draw: function (g, s, lt) {
      var out = s.dur - 320, cx = W / 2, cy = houseY(), rv = this.reveal;
      grade(g, 0.55, 0.55, 0);
      var fl = 1 - prog(lt, 0, 200); if (fl > 0) { g.fillStyle = 'rgba(255,255,255,' + fl * 0.5 + ')'; g.fillRect(0, 0, W, H); }
      var bp = E.outCubic(prog(lt, 0, 900)), hs = lerp(240, 180, bp), oa = 1 - prog(lt, out, out + 200);
      g.save(); g.globalAlpha = oa;
      brackets(g, cx, cy, hs, hs, 70, 9, lt > rv ? C.yellow : '#fff');
      // skenovací linka
      if (lt < rv) { var yy = cy - hs + ((lt * 0.5) % (hs * 2)); g.fillStyle = 'rgba(95,168,232,0.55)'; g.fillRect(cx - hs, yy - 2, hs * 2, 4); }
      // REC
      if (Math.floor(lt / 400) % 2 === 0 || lt > rv) { g.fillStyle = C.red; g.beginPath(); g.arc(cx - hs + 34, cy - hs + 36, 11, 0, 7); g.fill(); }
      g.fillStyle = '#fff'; g.font = font(30, 800); g.textBaseline = 'middle'; g.textAlign = 'left'; spacedText(g, 'REC', cx - hs + 56, cy - hs + 37, 3, 'left');
      g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 3; g.beginPath(); g.moveTo(cx - 22, cy); g.lineTo(cx + 22, cy); g.moveTo(cx, cy - 22); g.lineTo(cx, cy + 22); g.stroke();
      g.restore();
      if (lt > rv) reticle(g, cx, cy, lt - rv + 250, C.yellow);
      kLine(g, 'KDO TO JE?', W / 2, 680, 140, lt, 40, { out: out, punch: 2.1, stagger: 90 });
      // nick: šifrovaný → odkrytý
      var txt = s.reveal || '?', chars = 'ABCDEFHJKLMNPRSTUVXYZ0123456789_', shown = '';
      for (var i = 0; i < txt.length; i++) {
        var at = rv + i * 30;
        shown += (lt >= at || txt[i] === ' ') ? txt[i] : chars[hash(i + ':' + Math.floor(lt / 55)) % chars.length];
      }
      var cp = E.outBack(prog(lt, 500, 800)), done = lt >= rv + txt.length * 30;
      if (cp > 0) chip(g, shown, W / 2, 1290, { size: 52, bg: done ? C.yellow : 'rgba(11,20,48,0.85)', color: done ? C.ink : '#fff', border: done ? null : 'rgba(95,168,232,.8)', weight: 900, spacing: 2, scale: Math.max(0.001, cp * (1 + Math.sin(prog(lt, rv, rv + 260) * Math.PI) * 0.12)), alpha: clamp(cp, 0, 1) * (1 - prog(lt, out, out + 200)) });
    }
  };

  // ---------- HOOK: MIMOŘÁDNĚ (zpravodajská páska)
  HOOKS.breaking = {
    enter: function (s) {
      gcall('orbit', 0); camTown(s.townB || s.town, 1400).then(function () { gcall('orbit', 0.25); });
      AU.boom(0); AU.beep(0.02, 880, 0.14); AU.beep(0.2, 660, 0.14); AU.beep(0.38, 880, 0.14); AU.beep(0.56, 660, 0.14);
      AU.whoosh(s.dur / 1000 - 0.3, 0.6);
    },
    draw: function (g, s, lt) {
      grade(g, 0.65, 0.6, 0.2);
      var out = s.dur - 320, oa = 1 - prog(lt, out, out + 220);
      var fl = 1 - prog(lt, 0, 200); if (fl > 0) { g.fillStyle = 'rgba(255,77,94,' + fl * 0.45 + ')'; g.fillRect(0, 0, W, H); }
      var cp = E.outBack(prog(lt, 0, 300));
      chip(g, 'MIMOŘÁDNĚ', W / 2, 590, { size: 46, bg: C.red, color: '#fff', weight: 900, spacing: 7, scale: Math.max(0.001, cp), alpha: clamp(cp, 0, 1) * oa, icon: iconDot('#fff', lt) });
      kLine(g, s.line1, W / 2, 785, 160, lt, 80, { out: out, punch: 2 });
      kLine(g, s.line2, W / 2, 905, 84, lt, 260, { out: out + 30, color: C.ice });
      kLine(g, s.sticker, W / 2, 1020, 58, lt, 520, { sticker: C.yellow, color: C.ink, out: out + 60, punch: 1.4, stagger: 50 });
      // pásky
      [[s.ticker1, 1165, -0.05, C.yellow, C.ink, 1], [s.ticker2, 1262, 0.035, C.red, '#fff', -1]].forEach(function (b, k) {
        var ip = E.outCubic(prog(lt, 180 + k * 120, 560 + k * 120)); if (ip <= 0) return;
        g.save(); g.globalAlpha = oa; g.translate(W / 2 + (1 - ip) * b[5] * -1400, b[1]); g.rotate(b[2]);
        g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 24; g.fillStyle = b[3]; g.fillRect(-800, -40, 1600, 80); g.shadowBlur = 0;
        g.font = font(40, 900); g.fillStyle = b[4]; g.textBaseline = 'middle';
        var txt = b[0], tw = spacedWidth(g, txt, 4), x0 = -800 - ((lt * 0.35 * b[5]) % tw + tw) % tw;
        for (var x = x0; x < 800; x += tw) spacedText(g, txt, x, 2, 4, 'left');
        g.restore();
      });
    }
  };

  // ---------- HOOK: OBEC VS. OBEC
  HOOKS.versus = {
    slam: 520,
    enter: function (s) {
      gcall('orbit', 0); gcall('overview', 900).then(function () { gcall('orbit', 0.12); });
      AU.whoosh(0.05, 0.4); AU.whoosh(0.18, 0.4); AU.boom(this.slam / 1000); AU.ping(this.slam / 1000 + 0.05, 1480);
      AU.whoosh(s.dur / 1000 - 0.3, 0.6);
    },
    draw: function (g, s, lt) {
      var out = s.dur - 320, oa = 1 - prog(lt, out, out + 220), sl = this.slam;
      grade(g, 0.6, 0.6, 0.15);
      // diagonální dělení
      var dp = E.outCubic(prog(lt, 0, 420));
      g.save(); g.globalAlpha = 0.72 * oa;
      g.fillStyle = C.blue; g.beginPath(); g.moveTo(0, 570); g.lineTo(lerp(-200, 600, dp), 570); g.lineTo(lerp(-400, 480, dp), 1300); g.lineTo(0, 1300); g.closePath(); g.fill();
      g.fillStyle = C.navy2; g.beginPath(); g.moveTo(W, 570); g.lineTo(lerp(W + 400, 600, dp), 570); g.lineTo(lerp(W + 200, 480, dp), 1300); g.lineTo(W, 1300); g.closePath(); g.fill();
      g.restore();
      if (dp > 0.6) { g.save(); g.globalAlpha = oa; g.strokeStyle = '#fff'; g.lineWidth = 8; g.shadowColor = C.sky; g.shadowBlur = 30; g.beginPath(); g.moveTo(600, 570); g.lineTo(480, 1300); g.stroke(); g.restore(); }
      var shake = lt > sl ? (1 - prog(lt, sl, sl + 380)) * 14 : 0;
      g.save(); g.translate(Math.sin(lt / 15) * shake, Math.cos(lt / 21) * shake);
      [[s.a, 285, -1, 1], [s.b, 795, 1, 2]].forEach(function (it) {
        var o = it[0], x = it[1], p = E.outBack(prog(lt, 60 + it[3] * 80, 480 + it[3] * 80)), img = s._img && s._img[it[3] === 1 ? 'a' : 'b'];
        if (p <= 0) return;
        var px = x + (1 - clamp(p, 0, 1)) * it[2] * 500;
        g.save(); g.globalAlpha = clamp(p, 0, 1) * oa; g.translate(px, 770); g.rotate(it[2] * 0.06);
        g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = 40; g.shadowOffsetY = 14;
        if (img) g.drawImage(img, -95, -114, 190, 228); else shield(g, -95, -114, 190, 228, it[3] === 1 ? C.blue : C.red, up(o.name)[0]);
        g.restore();
        g.save(); g.globalAlpha = clamp(p, 0, 1) * oa;
        g.font = font(fitSize(g, up(o.name), 400, 64, 900, 30), 900); g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 16; g.fillText(up(o.name), px, 950);
        g.restore();
        var np = E.outBack(prog(lt, sl + 200 + it[3] * 120, sl + 520 + it[3] * 120));
        if (np > 0) chip(g, '+' + o.n, px, 1050, { size: 54, bg: it[3] === 1 ? C.yellow : 'rgba(255,255,255,0.95)', color: C.ink, weight: 900, scale: Math.max(0.001, np), alpha: clamp(np, 0, 1) * oa });
      });
      // VS
      var vp = prog(lt, sl - 120, sl + 160);
      if (vp > 0) {
        var vs = lerp(3, 1, E.outBack(vp));
        g.save(); g.globalAlpha = clamp(vp * 2, 0, 1) * oa; g.translate(540, 800); g.rotate(-0.12); g.scale(vs, vs);
        g.font = 'italic ' + font(170, 900); g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
        g.lineWidth = 22; g.strokeStyle = C.navy; g.strokeText('VS', 0, 0); g.fillStyle = C.yellow; g.fillText('VS', 0, 0);
        g.restore();
      }
      g.restore();
      kLine(g, 'KDO DNES VYHRÁL?', W / 2, 1190, 70, lt, sl + 400, { sticker: C.white, color: C.ink, out: out + 40, punch: 1.3, stagger: 50 });
      var fl = 1 - prog(lt, sl, sl + 200); if (lt > sl && fl > 0) { g.fillStyle = 'rgba(255,255,255,' + fl * 0.5 + ')'; g.fillRect(0, 0, W, H); }
    }
  };

  // ---------- společná hlavička hooku: DEN X + stav (vidět hned v 1. sekundě)
  function hookHeader(g, s, lt, h) {
    if (lt < 0) return;
    var out = s.dur - 320 - (h.headerAt || 0), oa = 1 - prog(lt, out, out + 220);
    if (!h.noDay) chip(g, 'DEN ' + s.day, W / 2, 395, { size: 44, bg: C.yellow, color: C.ink, weight: 900, spacing: 4, scale: Math.max(0.001, E.outBack(prog(lt, 0, 280))), alpha: prog(lt, 0, 100) * oa });
    var p = E.outCubic(prog(lt, 60, 700)), a = prog(lt, 60, 220) * oa;
    if (a <= 0) return;
    var num = fmt(Math.round(lerp(s.from || 0, s.pop || 0, p))), pre = s.statusPre, post = ' ' + s.statusPost;
    g.save(); g.globalAlpha = a; g.textBaseline = 'middle';
    var size = 52; g.font = font(size, 900);
    var w1 = g.measureText(pre).width, w2 = g.measureText(fmt(s.pop || 0)).width, w3 = g.measureText(post).width, tot = w1 + w2 + w3;
    if (tot > 960) { size = Math.floor(size * 960 / tot); g.font = font(size, 900); w1 = g.measureText(pre).width; w2 = g.measureText(fmt(s.pop || 0)).width; w3 = g.measureText(post).width; tot = w1 + w2 + w3; }
    var x = W / 2 - tot / 2, y = 483 + (1 - E.outCubic(prog(lt, 60, 360))) * 24;
    g.shadowColor = 'rgba(5,10,30,0.6)'; g.shadowBlur = 18; g.textAlign = 'left';
    g.fillStyle = '#fff'; g.fillText(pre, x, y);
    g.fillStyle = C.yellow; g.textAlign = 'center'; g.fillText(num, x + w1 + w2 / 2, y);
    g.fillStyle = '#fff'; g.textAlign = 'left'; g.fillText(post, x + w1 + w2, y);
    g.restore();
  }

  // ---------- koruna (vektor; x,y = střed spodní hrany)
  function drawCrown(g, x, y, w, t) {
    var h = w * 0.66;
    g.save(); g.translate(x, y);
    var gr = g.createLinearGradient(0, -h, 0, 0); gr.addColorStop(0, '#fff5b0'); gr.addColorStop(0.45, C.yellow); gr.addColorStop(1, '#d99a00');
    g.shadowColor = 'rgba(255,190,0,0.6)'; g.shadowBlur = w * 0.25;
    g.beginPath(); g.moveTo(-w / 2, 0); g.lineTo(-w / 2, -h * 0.58); g.lineTo(-w * 0.24, -h * 0.28); g.lineTo(0, -h); g.lineTo(w * 0.24, -h * 0.28); g.lineTo(w / 2, -h * 0.58); g.lineTo(w / 2, 0); g.closePath();
    g.fillStyle = gr; g.fill(); g.shadowBlur = 0;
    g.lineJoin = 'round'; g.lineWidth = w * 0.03; g.strokeStyle = '#a86f00'; g.stroke();
    g.fillStyle = '#e5a500'; g.fillRect(-w / 2 + w * 0.015, -h * 0.2, w - w * 0.03, h * 0.2 - w * 0.015);
    [[-w / 2, -h * 0.58], [0, -h], [w / 2, -h * 0.58]].forEach(function (p) { g.fillStyle = '#fff5b0'; g.beginPath(); g.arc(p[0], p[1], w * 0.065, 0, 7); g.fill(); g.strokeStyle = '#a86f00'; g.lineWidth = w * 0.02; g.stroke(); });
    [[-w * 0.29, C.red], [0, C.blue], [w * 0.29, C.red]].forEach(function (j) { g.fillStyle = j[1]; g.beginPath(); g.arc(j[0], -h * 0.1, w * 0.05, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.arc(j[0] - w * 0.015, -h * 0.115, w * 0.015, 0, 7); g.fill(); });
    // jiskry
    for (var i = 0; i < 3; i++) {
      var q = ((t || 0) / 900 + i / 3) % 1, a = (1 - Math.abs(q - 0.5) * 2), sx = [-w * 0.42, w * 0.38, w * 0.05][i], sy = [-h * 0.95, -h * 0.85, -h * 1.25][i], r = w * 0.07 * a;
      g.fillStyle = 'rgba(255,255,255,' + a + ')'; g.beginPath(); g.moveTo(sx, sy - r); g.lineTo(sx + r * 0.25, sy - r * 0.25); g.lineTo(sx + r, sy); g.lineTo(sx + r * 0.25, sy + r * 0.25); g.lineTo(sx, sy + r); g.lineTo(sx - r * 0.25, sy + r * 0.25); g.lineTo(sx - r, sy); g.lineTo(sx - r * 0.25, sy - r * 0.25); g.closePath(); g.fill();
    }
    g.restore();
  }
  function iconCrown(g, x, y, r) { drawCrown(g, x, y + r * 0.7, r * 2.1, 0); }

  // ---------- HOOK: KDO MÁ KORUNU TÝDNE? (teaser) / KORUNU MÁ … (když scéna koruny chybí)
  HOOKS.crown = {
    land: 650,
    enter: function (s) {
      gcall('orbit', 0); gcall('overview', 16); later(function () { if (R.running) camTown(s.crown.name, 1800).then(function () { gcall('orbit', 0.3); }); }, 300);
      AU.riser(0, 0.6); AU.boom(this.land / 1000); AU.ping(this.land / 1000 + 0.05, 2200); AU.whoosh(s.dur / 1000 - 0.3, 0.6);
      loadAssets(s);
    },
    draw: function (g, s, lt) {
      var out = s.dur - 320, oa = 1 - prog(lt, out, out + 220), land = this.land;
      grade(g, 0.62, 0.6, 0.25 * oa);
      var rp = prog(lt, land - 100, land + 300) * oa;
      if (rp > 0) { g.save(); g.translate(W / 2, 760); g.rotate(lt / 3000); g.globalAlpha = 0.18 * rp; g.fillStyle = C.yellow; for (var r = 0; r < 14; r++) { g.rotate(Math.PI / 7); g.beginPath(); g.moveTo(0, 0); g.lineTo(-50, -800); g.lineTo(50, -800); g.closePath(); g.fill(); } g.restore(); }
      var p = prog(lt, 120, land), y = lerp(-200, 840, E.inCubic(p)), sq = lt > land ? 1 + Math.sin(prog(lt, land, land + 260) * Math.PI) * 0.12 : 1;
      if (p > 0) { g.save(); g.globalAlpha = oa; g.translate(W / 2, y); g.scale(sq, 1 / sq); drawCrown(g, 0, 0, 330, lt); g.restore(); }
      if (s.reveal) {
        kLine(g, 'KORUNU TÝDNE MÁ', W / 2, 940, 64, lt, land + 80, { out: out, color: C.ice, stagger: 50 });
        kLine(g, up(s.crown.name), W / 2, 1075, 120, lt, land + 260, { out: out, color: C.yellow, punch: 2 });
        kLine(g, 'KDO ' + up(townPron(s.crown.name)) + ' JI VEZME?', W / 2, 1200, 58, lt, land + 600, { sticker: '#fff', color: C.ink, out: out + 40, stagger: 45 });
      } else {
        kLine(g, 'KDO MÁ', W / 2, 970, 110, lt, land + 60, { out: out, punch: 1.8 });
        kLine(g, 'KORUNU TÝDNE?', W / 2, 1100, 104, lt, land + 240, { color: C.yellow, out: out + 30, punch: 1.9 });
      }
      var fl = 1 - prog(lt, land, land + 220); if (lt > land && fl > 0) { g.fillStyle = 'rgba(255,240,180,' + fl * 0.5 + ')'; g.fillRect(0, 0, W, H); }
    }
  };

  // ---------- dispatcher
  SCENES.hook = {
    enter: function (s, r) { var h = HOOKS[s.variant] || HOOKS.classic; if (h.enter) h.enter.call(h, s, r); },
    draw: function (g, s, lt) {
      var h = HOOKS[s.variant] || HOOKS.classic;
      h.draw.call(h, g, s, lt);
      hookHeader(g, s, lt - (h.headerAt || 0), h);
    }
  };

  SCENES.overview = {
    enter: function (s) {
      gcall('orbit', 0);
      gcall('overview', 1700).then(function () { gcall('orbit', 0.12); });
      AU.ping(0.5, 1180); R.lastCount = -1;
    },
    draw: function (g, s, lt) {
      grade(g, 0.6, 0.55, 0);
      var out = s.dur - 300;
      kLine(g, 'ZATÍM NÁS JE…', W / 2, 450, 88, lt, 80, { out: out, color: C.white });
      var p = E.outCubic(prog(lt, 500, 2600)), val = lerp(s.from, s.to, p);
      var a = prog(lt, 420, 600) * (1 - prog(lt, out, out + 250));
      if (a > 0) {
        g.save(); g.globalAlpha = a;
        var punch = 1 + (1 - E.outBack(prog(lt, 420, 760))) * 0.5;
        g.translate(W / 2, 650); g.scale(punch, punch); g.translate(-W / 2, -650);
        odometer(g, val, W / 2, 650, 250, C.white);
        g.restore();
        var cur = Math.floor(val); if (cur !== R.lastCount && lt < 2650) { if (R.lastCount >= 0 && lt - (R._lastTick || 0) > 45) { AU.tick(0, 1900 + (cur % 7) * 90); R._lastTick = lt; } R.lastCount = cur; }
        chip(g, up(plural(s.to, 'obyvatel', 'obyvatelé', 'obyvatel')) + ' ŘÍČANSKA', W / 2, 815, { size: 38, bg: 'rgba(11,20,48,0.82)', color: C.yellow, weight: 900, spacing: 7, alpha: a });
      }
      // chips
      var cp = E.outBack(prog(lt, 2300, 2700)), co = 1 - prog(lt, out, out + 250);
      if (cp > 0) {
        var items = [{ t: '+' + s.n + ' DNES', bg: C.yellow, c: C.ink }, { t: s.towns + ' ' + up(plural(s.towns, 'obec', 'obce', 'obcí')), bg: 'rgba(11,20,48,0.78)', c: C.white, b: 'rgba(95,168,232,.7)' }];
        if (s.expanded) items.push({ t: 'NOVÉ ÚZEMÍ', bg: C.sky, c: C.ink });
        g.font = font(40, 900);
        var widths = items.map(function (it) { return spacedWidth(g, it.t, 3) + 48; }), gap = 22, tot = widths.reduce(function (a2, b) { return a2 + b; }, 0) + gap * (items.length - 1), x = W / 2 - tot / 2;
        items.forEach(function (it, i) {
          var pi = E.outBack(prog(lt, 2300 + i * 110, 2700 + i * 110));
          chip(g, it.t, x, 925, { size: 40, bg: it.bg, color: it.c, border: it.b, align: 'left', weight: 900, scale: Math.max(0.001, pi), alpha: clamp(pi, 0, 1) * co });
          x += widths[i] + gap;
        });
      }
      if (lt > 2300 && !s._p) { s._p = 1; AU.pop(0, 700); }
    }
  };

  SCENES.town = {
    enter: function (s) {
      gcall('orbit', 0);
      gcall('focusTown', s.name, 1150).then(function () { gcall('orbit', 0.22); });
      // domky vyrostou na kameru, pokud je hra ještě nemá
      var st = safeState(), t = (st.towns || []).filter(function (x) { return x.name === s.name; })[0];
      var have = {}; if (t) (t.houses || []).forEach(function (h) { have[h.owner] = 1; });
      var add = (s.list || []).filter(function (p) { return !have[p.owner]; }).map(function (p) { return { owner: p.owner, no: p.no }; });
      if (add.length) later(function () { gcall('addPlayers', s.name, add); }, 900);
      var pops = Math.min(add.length || s.n, 8);
      for (var i = 0; i < pops; i++) AU.pop(0.95 + i * 0.09, 480 + i * 60);
      AU.ping(0.35, 990 + s.rank * 120);
      if (s.img === undefined) { s.img = null; svgToImage(s.erbSvg).then(function (im) { s.img = im; }); }
    },
    draw: function (g, s, lt) {
      grade(g, 0.62, 0.5, 0);
      var out = s.dur - 300;
      reticle(g, W / 2, R.opts.focusY || 1130, lt, C.yellow);
      // pořadí
      var rp = E.outBack(prog(lt, 60, 400)), ro = 1 - prog(lt, out, out + 200);
      chip(g, '#' + s.rank + '  DNEŠNÍ PŘÍRŮSTEK', W / 2, 390, { size: 34, bg: s.rank === 1 ? C.yellow : 'rgba(11,20,48,0.8)', color: s.rank === 1 ? C.ink : C.white, border: s.rank === 1 ? null : 'rgba(95,168,232,.7)', weight: 900, scale: Math.max(0.001, rp), alpha: clamp(rp, 0, 1) * ro });
      // erb
      var ep = prog(lt, 120, 620), eo = prog(lt, out, out + 260);
      if (ep > 0 && eo < 1) {
        var es = E.outBack(ep) * (1 - E.inCubic(eo)), ew = 170, eh = 204, ex = W / 2, ey = 560, wob = Math.sin(lt / 420) * 0.04;
        g.save(); g.translate(ex, ey); g.rotate(wob + (1 - E.outCubic(ep)) * -0.5); g.scale(es, es);
        g.shadowColor = 'rgba(0,0,0,0.45)'; g.shadowBlur = 40; g.shadowOffsetY = 14;
        if (s.img) g.drawImage(s.img, -ew / 2, -eh / 2, ew, eh); else shield(g, -ew / 2, -eh / 2, ew, eh, C.blue, up(s.name)[0]);
        g.shadowBlur = 0;
        // lesk
        var sh = prog(lt, 500, 1100);
        if (sh > 0 && sh < 1) { g.globalCompositeOperation = 'source-atop'; }
        g.restore();
        if (sh > 0 && sh < 1) {
          g.save(); g.translate(ex, ey); g.scale(es, es);
          g.beginPath(); g.moveTo(-ew / 2 + 8, -eh / 2 + 8); g.lineTo(ew / 2 - 8, -eh / 2 + 8); g.lineTo(ew / 2 - 8, 0); g.quadraticCurveTo(ew / 2 - 8, eh / 2 - 10, 0, eh / 2 - 6); g.quadraticCurveTo(-ew / 2 + 8, eh / 2 - 10, -ew / 2 + 8, 0); g.closePath(); g.clip();
          var gx = lerp(-ew, ew, sh), lg = g.createLinearGradient(gx - 60, -eh / 2, gx + 60, eh / 2);
          lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(0.5, 'rgba(255,255,255,0.55)'); lg.addColorStop(1, 'rgba(255,255,255,0)');
          g.fillStyle = lg; g.fillRect(-ew / 2, -eh / 2, ew, eh); g.restore();
        }
      }
      // jméno obce
      kLine(g, up(s.name), W / 2, 775, 116, lt, 260, { out: out, stagger: 70 });
      // +N obyvatel (pill)
      var pp = E.outBack(prog(lt, 560, 900)), po = 1 - prog(lt, out, out + 220);
      if (pp > 0) {
        var cnt = Math.round(lerp(0, s.n, E.outCubic(prog(lt, 600, 1300))));
        chip(g, '+' + cnt + ' ' + up(plural(s.n, 'obyvatel', 'obyvatelé', 'obyvatel')), W / 2, 885, { size: 54, bg: C.yellow, color: C.ink, weight: 900, spacing: 2, scale: Math.max(0.001, pp), alpha: clamp(pp, 0, 1) * po });
      }
      var tier = TIERS[s.tier] || TIERS.wood, tp = prog(lt, 800, 1100);
      if (tp > 0) {
        g.save(); g.globalAlpha = tp * po;
        g.font = font(30, 800);
        var tw = spacedWidth(g, tier.label, 4) + 70, tx = W / 2 - tw / 2, ty = 975;
        var lg2 = g.createLinearGradient(tx, 0, tx + tw, 0); lg2.addColorStop(0, tier.c1); lg2.addColorStop(1, tier.c2);
        g.fillStyle = lg2; rr(g, tx, ty - 26, tw, 52, 26); g.fill();
        g.fillStyle = tier.fg; g.textBaseline = 'middle';
        g.beginPath(); var sx = tx + 30; for (var k = 0; k < 5; k++) { var aa = -Math.PI / 2 + k * Math.PI * 2 / 5, bb = aa + Math.PI / 5; g.lineTo(sx + Math.cos(aa) * 11, ty + Math.sin(aa) * 11); g.lineTo(sx + Math.cos(bb) * 4.5, ty + Math.sin(bb) * 4.5); } g.closePath(); g.fill();
        spacedText(g, tier.label, tx + 50, ty + 1, 4, 'left');
        g.restore();
      }
    }
  };

  SCENES.comment = {
    enter: function (s) {
      gcall('orbit', 0);
      var nb = s.building;
      (nb ? gcall('focusTown', nb.town, 1400) : gcall('overview', 1400)).then(function () { gcall('orbit', 0.18); });
      AU.pop(0.15, 600); AU.ping(0.2, 1760);
      s._buildAt = s.building ? Math.max(1800, wordStart(s, /^Tak$/, s.dur * 0.5) - 150) : Math.max(2200, s.dur * 0.56);
      if (s.building) { AU.riser(s._buildAt / 1000 - 0.6, 0.6); AU.boom(s._buildAt / 1000); }
      if (s.avatar && s._av === undefined) { s._av = null; loadImage(s.avatar).then(function (im) { s._av = im; }); }
    },
    draw: function (g, s, lt) {
      var out = s.dur - 300;
      if (s._buildAt == null) s._buildAt = s.building ? Math.max(1800, wordStart(s, /^Tak$/, s.dur * 0.5) - 150) : Math.max(2200, s.dur * 0.56);
      grade(g, 0.6, 0.6, 0.3 * prog(lt, 0, 400) * (1 - prog(lt, out, out + 250)));
      // label
      var lp = E.outBack(prog(lt, 50, 380)), lo = 1 - prog(lt, out, out + 200);
      chip(g, s.building ? 'CHTĚLI JSTE' : 'TOP KOMENTÁŘ', W / 2, 400, {
        size: 40, bg: C.yellow, color: C.ink, weight: 900, spacing: 5, scale: Math.max(0.001, lp), alpha: clamp(lp, 0, 1) * lo,
        icon: function (g2, x, y, r) { // korunka
          g2.fillStyle = C.ink; g2.beginPath(); g2.moveTo(x - r, y + r * 0.7); g2.lineTo(x - r, y - r * 0.5); g2.lineTo(x - r * 0.45, y); g2.lineTo(x, y - r * 0.85); g2.lineTo(x + r * 0.45, y); g2.lineTo(x + r, y - r * 0.5); g2.lineTo(x + r, y + r * 0.7); g2.closePath(); g2.fill();
        }
      });
      // karta
      var cp = prog(lt, 150, 650), co = prog(lt, out, out + 260);
      if (cp > 0 && co < 1) {
        var cardW = 920, x = (W - cardW) / 2, pad = 44;
        g.font = font(50, 700);
        var lines = wrap(g, '„' + s.text + '“', cardW - pad * 2);
        if (lines.length > 4) { g.font = font(42, 700); lines = wrap(g, '„' + s.text + '“', cardW - pad * 2); }
        var lh = lines.length > 4 ? 54 : 64, cardH = pad + 104 + 26 + lines.length * lh + 30 + 70;
        var building = s.building && lt > s._buildAt - 200;
        var y = 470;
        var e = E.outBack(cp);
        g.save();
        g.translate(W / 2, y + cardH / 2 + (1 - E.outCubic(cp)) * 260 - E.inCubic(co) * 200);
        g.rotate((1 - e) * 0.12 - 0.012); g.scale(lerp(0.85, 1, e), lerp(0.85, 1, e));
        g.globalAlpha = clamp(cp * 3, 0, 1) * (1 - co);
        g.translate(-W / 2, -(y + cardH / 2));
        g.shadowColor = 'rgba(0,0,0,0.45)'; g.shadowBlur = 60; g.shadowOffsetY = 24;
        g.fillStyle = '#ffffff'; rr(g, x, y, cardW, cardH, 44); g.fill();
        g.shadowBlur = 0; g.shadowOffsetY = 0;
        // akcent pruh
        var ag = g.createLinearGradient(x, 0, x + cardW, 0); ag.addColorStop(0, C.sky); ag.addColorStop(1, C.blue);
        g.save(); rr(g, x, y, cardW, cardH, 44); g.clip(); g.fillStyle = ag; g.fillRect(x, y, cardW, 12); g.restore();
        // avatar
        var ax = x + pad + 48, ay = y + pad + 52, ar = 48;
        g.save(); g.beginPath(); g.arc(ax, ay, ar, 0, 7); g.clip();
        if (s._av) g.drawImage(s._av, ax - ar, ay - ar, ar * 2, ar * 2);
        else {
          var hue = hash(s.author) % 360, avg = g.createLinearGradient(ax - ar, ay - ar, ax + ar, ay + ar);
          avg.addColorStop(0, 'hsl(' + hue + ',75%,62%)'); avg.addColorStop(1, 'hsl(' + ((hue + 50) % 360) + ',70%,42%)');
          g.fillStyle = avg; g.fillRect(ax - ar, ay - ar, ar * 2, ar * 2);
          g.fillStyle = '#fff'; g.font = font(44, 900); g.textAlign = 'center'; g.textBaseline = 'middle';
          g.fillText(up(s.author.replace(/[^a-zA-Zá-žÁ-Ž0-9]/g, '')).slice(0, 1) || '?', ax, ay + 2);
        }
        g.restore();
        g.strokeStyle = C.yellow; g.lineWidth = 5; g.beginPath(); g.arc(ax, ay, ar + 5, 0, 7); g.stroke();
        // nick
        g.textAlign = 'left'; g.textBaseline = 'middle';
        g.fillStyle = C.ink; g.font = font(fitSize(g, s.author, 520, 44, 800, 26), 800); g.fillText(s.author, ax + ar + 28, ay - 18);
        g.fillStyle = '#6b7896'; g.font = font(30, 600); g.fillText('nejlajkovanější komentář dne', ax + ar + 28, ay + 26);
        // text
        g.fillStyle = C.ink; g.font = font(lines.length > 4 ? 42 : 50, 700); g.textBaseline = 'alphabetic';
        var reveal = prog(lt, 450, 450 + lines.length * 260);
        for (var i = 0; i < lines.length; i++) {
          var lpI = clamp(reveal * lines.length - i, 0, 1);
          g.globalAlpha = clamp(cp * 3, 0, 1) * (1 - co) * lpI;
          g.fillText(lines[i], x + pad, y + pad + 104 + 26 + (i + 0.8) * lh + (1 - E.outCubic(lpI)) * 20);
        }
        g.globalAlpha = clamp(cp * 3, 0, 1) * (1 - co);
        // liky
        var lk = Math.round(lerp(0, s.likes, E.outCubic(prog(lt, 700, 1700))));
        var by = y + cardH - pad - 14, bump = 1 + Math.max(0, Math.sin(prog(lt, 1600, 1900) * Math.PI)) * 0.35;
        heart(g, x + pad + 22, by, 40 * bump, C.red);
        g.fillStyle = C.ink; g.font = font(40, 900); g.textBaseline = 'middle';
        g.fillText(fmt(lk), x + pad + 60, by);
        g.fillStyle = '#8a95ad'; g.font = font(32, 600); g.textAlign = 'right';
        g.fillText('Odpovědět', x + cardW - pad, by);
        g.restore();
      }
      // co se postaví
      if (s.building) {
        var b0 = s._buildAt, bp = prog(lt, b0, b0 + 420), bo = 1 - prog(lt, out, out + 220);
        if (bp > 0) {
          var yb = 1150;
          kLine(g, 'TAK JSME POSTAVILI', W / 2, yb, 52, lt, b0, { sticker: C.yellow, color: C.ink, out: out, punch: 1.4 });
          kLine(g, up(s.building.name), W / 2, yb + 130, 92, lt, b0 + 180, { out: out, maxW: 960 });
          if (prog(lt, b0 + 380, b0 + 700) > 0) {
            g.save(); g.globalAlpha = prog(lt, b0 + 380, b0 + 700) * bo; g.fillStyle = C.ice; g.font = font(40, 700); g.textAlign = 'center';
            g.fillText('v obci ' + s.building.town, W / 2, yb + 205); g.restore();
          }
        }
      }
    }
  };

  // ---- ikonky pro chipy
  function iconCheck(color) { return function (g, x, y, r) { g.strokeStyle = color; g.lineWidth = r * 0.42; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); g.moveTo(x - r * 0.8, y); g.lineTo(x - r * 0.15, y + r * 0.65); g.lineTo(x + r * 0.95, y - r * 0.7); g.stroke(); }; }
  function iconStar(color) { return function (g, x, y, r) { g.fillStyle = color; g.beginPath(); for (var k = 0; k < 5; k++) { var a = -Math.PI / 2 + k * Math.PI * 2 / 5, b = a + Math.PI / 5; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); g.lineTo(x + Math.cos(b) * r * 0.42, y + Math.sin(b) * r * 0.42); } g.closePath(); g.fill(); }; }
  function iconEmoji(e, fb, color) { return function (g, x, y, r) { drawEmoji(g, e, x, y, r * 2.1, fb, color); }; }
  function iconPin(color) { return function (g, x, y, r) { pin(g, x, y + r, r * 2, color, null); }; }
  function avatarCircle(g, x, y, r, e, fb, filled) {
    g.save();
    if (filled) {
      var gr = g.createLinearGradient(x - r, y - r, x + r, y + r); gr.addColorStop(0, C.sky); gr.addColorStop(1, C.blue);
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
      g.strokeStyle = '#fff'; g.lineWidth = 5; g.stroke();
      drawEmoji(g, e, x, y, r * 1.05, fb, '#fff');
    }
    g.restore();
  }

  // ---------- POVOLÁNÍ: „MUKAŘOVU CHYBÍ 1 HASIČ!“
  SCENES.jobs = {
    enter: function (s) {
      gcall('orbit', 0); camTown(s.town, 1300).then(function () { gcall('orbit', 0.2); });
      AU.ping(0.2, 1320);
      for (var i = 0; i < Math.min(s.count, 8); i++) AU.pop(0.75 + i * 0.12, 520 + i * 70);
      AU.beep(0.8 + s.count * 0.12, 440, 0.22);
      var ta = wordStart(s, /^Jsi$/i, 2600) / 1000; AU.ping(ta, 1760); AU.pop(ta + 0.3, 900);
    },
    draw: function (g, s, lt) {
      var out = s.dur - 300, oa = 1 - prog(lt, out, out + 220);
      grade(g, 0.62, 0.62, 0.22 * oa);
      var cp = E.outBack(prog(lt, 40, 360));
      chip(g, up(jobForm(s.job, 'pl')) + ' · ' + up(s.town), W / 2, 395, { size: 36, bg: 'rgba(11,20,48,0.82)', color: '#fff', border: 'rgba(95,168,232,.7)', weight: 900, spacing: 3, scale: Math.max(0.001, cp), alpha: clamp(cp, 0, 1) * oa, icon: iconEmoji(s.emoji, s.job, C.yellow) });
      kLine(g, s.line1, W / 2, 565, 116, lt, 120, { out: out, punch: 1.9 });
      kLine(g, s.line2, W / 2, 692, 100, lt, 300, { color: C.yellow, out: out + 30, punch: 1.8, stagger: 70 });
      // karta s partou + progress
      var kp = prog(lt, 420, 900), ko = prog(lt, out, out + 260);
      if (kp > 0 && ko < 1) {
        var x0 = 80, y0 = 770, cw = 920, chh = 300, e = E.outBack(kp);
        g.save(); g.globalAlpha = clamp(kp * 3, 0, 1) * (1 - ko);
        g.translate(W / 2, y0 + chh / 2 + (1 - E.outCubic(kp)) * 200 - E.inCubic(ko) * 150); g.scale(lerp(0.88, 1, e), lerp(0.88, 1, e)); g.translate(-W / 2, -(y0 + chh / 2));
        g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = 50; g.shadowOffsetY = 20; g.fillStyle = '#fff'; rr(g, x0, y0, cw, chh, 40); g.fill(); g.shadowBlur = 0; g.shadowOffsetY = 0;
        var n = Math.min(s.need, 8), gap = 22, r = Math.min(56, (cw - 80 - (n - 1) * gap) / (2 * n)), tw = n * r * 2 + (n - 1) * gap, cx0 = W / 2 - tw / 2 + r, cy = y0 + 92;
        for (var i = 0; i < n; i++) {
          var x = cx0 + i * (r * 2 + gap);
          if (i < s.count) {
            var ip = E.outBack(prog(lt, 750 + i * 120, 1050 + i * 120)); if (ip <= 0) continue;
            g.save(); g.translate(x, cy); g.scale(ip, ip); avatarCircle(g, 0, 0, r, s.emoji, s.job, true); g.restore();
          } else {
            var nextOne = i === s.count, pul = (Math.sin(lt / 160) + 1) / 2, ap = prog(lt, 750 + i * 120, 1000 + i * 120);
            g.save(); g.globalAlpha *= ap;
            if (nextOne) { g.fillStyle = 'rgba(255,210,63,' + (0.35 + pul * 0.4) + ')'; g.beginPath(); g.arc(x, cy, r + pul * 6, 0, 7); g.fill(); }
            g.setLineDash([10, 9]); g.lineWidth = 5; g.strokeStyle = nextOne ? '#e0a400' : '#c3cbe0'; g.beginPath(); g.arc(x, cy, r - 2, 0, 7); g.stroke(); g.setLineDash([]);
            g.fillStyle = nextOne ? C.ink : '#aab3c8'; g.font = font(nextOne ? r * 0.62 : r * 0.8, 900); g.textAlign = 'center'; g.textBaseline = 'middle';
            g.fillText(nextOne ? 'TY?' : '?', x, cy + 2);
            g.restore();
          }
        }
        // popisky + bar
        var ly = y0 + 196;
        g.textBaseline = 'middle'; g.textAlign = 'left'; g.font = font(32, 800); g.fillStyle = '#6b7896';
        var cil = 'CÍL: ', cwid = spacedWidth(g, cil, 2); spacedText(g, cil, x0 + 44, ly, 2, 'left');
        g.fillStyle = C.ink; g.font = font(fitSize(g, up(s.building), 560, 34, 900, 22), 900); spacedText(g, up(s.building), x0 + 44 + cwid + 4, ly, 2, 'left');
        var fp = E.outCubic(prog(lt, 900, 900 + 140 * s.count + 400)), shownC = Math.round(lerp(0, s.count, fp));
        g.textAlign = 'right'; g.font = font(46, 900); g.fillStyle = C.blue; g.fillText(shownC + '/' + s.need, x0 + cw - 44, ly);
        var bx = x0 + 44, by = y0 + 236, bw = cw - 88, bh = 30;
        g.fillStyle = '#e6ebf5'; rr(g, bx, by, bw, bh, bh / 2); g.fill();
        var fw = bw * (s.count / s.need) * fp;
        if (fw > 2) { var bg2 = g.createLinearGradient(bx, 0, bx + bw, 0); bg2.addColorStop(0, C.yellow); bg2.addColorStop(1, '#ffb400'); g.fillStyle = bg2; rr(g, bx, by, Math.max(fw, bh), bh, bh / 2); g.fill(); }
        if (fp >= 1) { var pul2 = (Math.sin(lt / 160) + 1) / 2; g.fillStyle = 'rgba(255,210,63,' + (0.25 + pul2 * 0.35) + ')'; rr(g, bx + fw - bh / 2, by, bw / s.need + bh / 2, bh, bh / 2); g.fill(); }
        g.restore();
      }
      var ta = wordStart(s, /^Jsi$/i, 2600);
      kLine(g, s.ask, W / 2, 1135, 62, lt, ta - 80, { color: C.ice, out: out, stagger: 55, maxW: 960 });
      kLine(g, 'NAPIŠ TO DO KOMENTÁŘŮ', W / 2, 1245, 58, lt, ta + 380, { sticker: C.yellow, color: C.ink, out: out + 40, punch: 1.4, stagger: 45 });
    }
  };

  // ---------- POVOLÁNÍ HOTOVO: „HASIČI Z MNICHOVIC POSTAVILI HASIČÁRNU!“
  SCENES.jobBuilt = {
    enter: function (s) {
      gcall('orbit', 0); camTown(s.town, 1300).then(function () { gcall('orbit', 0.25); });
      AU.riser(0, 0.5); AU.boom(0.5); AU.ping(0.55, 1760); AU.ping(0.75, 2200);
      for (var i = 0; i < 6; i++) AU.pop(0.6 + i * 0.05, 700 + i * 120);
      for (var k = 0; k < Math.min(s.need, 8); k++) AU.pop(1.55 + k * 0.08, 520 + k * 60);
      AU.beep(1.55 + s.need * 0.08 + 0.12, 1320, 0.25);
    },
    draw: function (g, s, lt) {
      var out = s.dur - 300, oa = 1 - prog(lt, out, out + 220);
      grade(g, 0.62, 0.62, 0.25 * oa);
      // záblesk + paprsky
      var bl = prog(lt, 500, 560) * (1 - prog(lt, 560, 900)); if (bl > 0) { g.fillStyle = 'rgba(255,240,180,' + bl * 0.55 + ')'; g.fillRect(0, 0, W, H); }
      var rp = prog(lt, 480, 900) * oa;
      if (rp > 0) {
        g.save(); g.translate(W / 2, 790); g.rotate(lt / 4000); g.globalAlpha = 0.16 * rp;
        g.fillStyle = C.yellow; for (var r = 0; r < 12; r++) { g.rotate(Math.PI / 6); g.beginPath(); g.moveTo(0, 0); g.lineTo(-60, -900); g.lineTo(60, -900); g.closePath(); g.fill(); }
        g.restore();
      }
      var cp = E.outBack(prog(lt, 40, 360));
      chip(g, 'NOVÁ BUDOVA', W / 2, 395, { size: 40, bg: C.yellow, color: C.ink, weight: 900, spacing: 5, scale: Math.max(0.001, cp), alpha: clamp(cp, 0, 1) * oa, icon: iconCheck(C.ink) });
      kLine(g, s.head, W / 2, 530, 92, lt, 120, { out: out, stagger: 60 });
      kLine(g, 'SI POSTAVILI', W / 2, 640, 74, lt, 300, { out: out + 20, color: C.ice, stagger: 60 });
      kLine(g, s.acc + '!', W / 2, 790, 150, lt, 500, { color: C.yellow, out: out + 40, punch: 2.3, maxW: 980 });
      if (s.name && up(s.name) !== up(s.building)) kLine(g, s.name, W / 2, 940, 52, lt, 820, { sticker: '#fff', color: C.ink, out: out + 60, punch: 1.3, stagger: 40 });
      // rovnice: N lidí = 1 budova
      var ep = prog(lt, 1500, 1800), eo = 1 - prog(lt, out, out + 200);
      if (ep > 0) {
        var n = Math.min(s.need, 8), rr0 = 36, step = 50, rowW = (n - 1) * step + rr0 * 2, bigR = 58, tot = rowW + 90 + bigR * 2, x0 = W / 2 - tot / 2, cy = 1085;
        g.save(); g.globalAlpha = eo;
        for (var i = n - 1; i >= 0; i--) {
          var ip = E.outBack(prog(lt, 1500 + i * 80, 1800 + i * 80)); if (ip <= 0) continue;
          g.save(); g.translate(x0 + rr0 + i * step, cy); g.scale(ip, ip); avatarCircle(g, 0, 0, rr0, s.emoji, s.job, true); g.restore();
        }
        var qp = E.outBack(prog(lt, 1550 + n * 80, 1850 + n * 80));
        if (qp > 0) {
          g.fillStyle = '#fff'; g.font = font(72, 900); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('=', x0 + rowW + 45, cy + 2);
          g.save(); g.translate(x0 + rowW + 90 + bigR, cy); g.scale(qp, qp);
          g.shadowColor = C.yellow; g.shadowBlur = 30; g.fillStyle = C.yellow; g.beginPath(); g.arc(0, 0, bigR, 0, 7); g.fill(); g.shadowBlur = 0;
          g.strokeStyle = '#fff'; g.lineWidth = 6; g.stroke();
          drawEmoji(g, s.buildingEmoji || s.emoji, 0, 0, bigR * 1.1, s.building, C.ink);
          g.restore();
        }
        var tp = prog(lt, 1900 + n * 80, 2200 + n * 80);
        if (tp > 0) { g.globalAlpha = tp * eo; g.fillStyle = C.ice; g.font = font(fitSize(g, s.eq, 900, 38, 800, 24), 800); g.textAlign = 'center'; g.textBaseline = 'middle'; spacedText(g, s.eq, W / 2, 1185, 3, 'center'); }
        g.restore();
      }
      confetti(g, lt, { t0: 520, x: W / 2, y: 800, n: 90, seed: 'jb', spread: 3.2 });
      confetti(g, lt, { t0: 700, x: 60, y: 1350, n: 40, seed: 'jl', angle: -1.15, spread: 0.7 });
      confetti(g, lt, { t0: 700, x: W - 60, y: 1350, n: 40, seed: 'jr', angle: -1.99, spread: 0.7 });
    }
  };

  // ---------- MILNÍK: „OBYVATEL Č. 500“
  SCENES.milestone = {
    land: 1450,
    enter: function (s) {
      gcall('orbit', 0);
      (s.house ? camHouse(s.house, 44, 1300) : camTown(s.town, 1300)).then(function () { gcall('orbit', 0.15); });
      AU.ping(0.1, 1320); AU.boom(this.land / 1000); AU.ping(this.land / 1000 + 0.05, 2200);
      for (var i = 0; i < 6; i++) AU.pop(this.land / 1000 + 0.08 + i * 0.05, 700 + i * 110);
      R.lastCount = -1;
    },
    draw: function (g, s, lt) {
      var out = s.dur - 300, oa = 1 - prog(lt, out, out + 220), land = this.land;
      grade(g, 0.62, 0.55, 0.15 * oa);
      var cp = E.outBack(prog(lt, 40, 360));
      chip(g, 'MILNÍK HRY', W / 2, 395, { size: 40, bg: C.yellow, color: C.ink, weight: 900, spacing: 5, scale: Math.max(0.001, cp), alpha: clamp(cp, 0, 1) * oa, icon: iconStar(C.ink) });
      kLine(g, 'OBYVATEL Č.', W / 2, 520, 96, lt, 120, { out: out });
      var p = E.outCubic(prog(lt, 300, land)), val = lerp(0, s.no, p), a = prog(lt, 280, 420) * oa;
      if (a > 0) {
        var cur = Math.floor(val); if (cur !== R.lastCount && lt < land + 30) { if (lt - (R._lastTick || 0) > 45) { AU.tick(0, 1900 + (cur % 7) * 90); R._lastTick = lt; } R.lastCount = cur; }
        var bump = 1 + Math.sin(prog(lt, land, land + 300) * Math.PI) * 0.16;
        g.save(); g.globalAlpha = a; g.translate(W / 2, 690); g.scale(bump, bump); g.translate(-W / 2, -690);
        odometer(g, lt >= land ? s.no : val, W / 2, 690, 240, C.yellow);
        g.restore();
      }
      if (s.house) reticle(g, W / 2, houseY(), lt - 300, C.yellow);
      var np = E.outBack(prog(lt, land + 100, land + 450));
      if (np > 0 && s.owner) chip(g, s.owner, W / 2, 1160, { size: 50, bg: '#fff', color: C.ink, weight: 900, spacing: 1, scale: Math.max(0.001, np), alpha: clamp(np, 0, 1) * oa, icon: iconStar(C.yellow) });
      var tp = prog(lt, land + 300, land + 600) * oa;
      if (tp > 0 && s.town) { g.save(); g.globalAlpha = tp; g.fillStyle = C.ice; g.font = font(40, 700); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('z ' + townGen(s.town), W / 2, 1240); g.restore(); }
      confetti(g, lt, { t0: land, x: W / 2, y: 700, n: 90, seed: 'ms', spread: 3.4 });
    }
  };

  // ---------- NOVÁ OBEC NA MAPĚ
  SCENES.newTowns = {
    drop: 760,
    enter: function (s) {
      gcall('orbit', 0); camTown(s.name, 1200).then(function () { gcall('orbit', 0.22); });
      AU.ping(0.15, 1180); AU.whoosh(0.35, 0.4); AU.boom(this.drop / 1000); AU.ping(this.drop / 1000 + 0.05, 1480);
      loadAssets(s);
    },
    draw: function (g, s, lt) {
      var out = s.dur - 300, oa = 1 - prog(lt, out, out + 220), drop = this.drop, ty = townY();
      grade(g, 0.62, 0.5, 0);
      // špendlík dopadne na obec + vlny
      var pp = prog(lt, drop - 420, drop);
      if (pp > 0) {
        for (var k = 0; k < 3 && lt > drop; k++) {
          var q = ((lt - drop) / 1300 + k / 3) % 1;
          g.save(); g.globalAlpha = (1 - q) * 0.8 * oa; g.strokeStyle = C.yellow; g.lineWidth = 6;
          g.beginPath(); g.ellipse(W / 2, ty, 40 + q * 260, (40 + q * 260) * 0.42, 0, 0, 7); g.stroke(); g.restore();
        }
        var yy = lerp(-300, ty, E.inCubic(pp)), sq = lt > drop ? 1 - Math.sin(prog(lt, drop, drop + 260) * Math.PI) * 0.18 : 1;
        g.save(); g.globalAlpha = oa; g.translate(W / 2, yy); g.scale(1 / sq, sq); pin(g, 0, 0, 100, C.yellow, 'house'); g.restore();
      }
      var cp = E.outBack(prog(lt, 40, 360));
      chip(g, 'NOVÁ OBEC NA MAPĚ', W / 2, 390, { size: 40, bg: C.yellow, color: C.ink, weight: 900, spacing: 4, scale: Math.max(0.001, cp), alpha: clamp(cp, 0, 1) * oa, icon: iconPin(C.ink) });
      // erb
      var ep = prog(lt, 160, 640), eo = prog(lt, out, out + 260);
      if (ep > 0 && eo < 1) {
        var es = E.outBack(ep) * (1 - E.inCubic(eo)), ew = 150, eh = 180, img = s._img && s._img.erb;
        g.save(); g.translate(W / 2, 560); g.rotate(Math.sin(lt / 420) * 0.04 + (1 - E.outCubic(ep)) * -0.5); g.scale(es, es);
        g.shadowColor = 'rgba(0,0,0,0.45)'; g.shadowBlur = 40; g.shadowOffsetY = 14;
        if (img) g.drawImage(img, -ew / 2, -eh / 2, ew, eh); else shield(g, -ew / 2, -eh / 2, ew, eh, C.blue, up(s.name)[0]);
        g.restore();
      }
      kLine(g, up(s.name), W / 2, 760, 130, lt, 300, { out: out, punch: 2 });
      var fp = E.outBack(prog(lt, drop + 100, drop + 420));
      if (fp > 0) chip(g, s.first ? '1. OBYVATEL ' + s.first : 'MÁ PRVNÍHO OBYVATELE', W / 2, 875, { size: 38, bg: 'rgba(11,20,48,0.85)', color: '#fff', border: 'rgba(95,168,232,.8)', weight: 800, spacing: 2, scale: Math.max(0.001, fp), alpha: clamp(fp, 0, 1) * oa });
      if (s.others && s.others.length) {
        var op = prog(lt, drop + 400, drop + 700) * oa;
        if (op > 0) { g.save(); g.globalAlpha = op; g.fillStyle = C.ice; g.font = font(36, 800); g.textAlign = 'center'; g.textBaseline = 'middle'; spacedText(g, 'A TAKY: ' + s.others.map(up).join(', '), W / 2, ty + 85, 2, 'center'); g.restore(); }
      }
    }
  };

  // ---------- NAJDI SE VE VIDEU (rychlý průlet domky)
  SCENES.findMe = {
    start: 280,
    enter: function (s) { s._cut = -1; gcall('orbit', 0); AU.ping(0.02, 1320); if (!s.items.some(function (i) { return i.house; })) gcall('overview', 900); },
    draw: function (g, s, lt) {
      var out = s.dur - 260, oa = 1 - prog(lt, out, out + 200), cy = houseY();
      var res = s.items.filter(function (i) { return i.house; });
      grade(g, 0.6, 0.5, 0);
      if (res.length) {
        var per = Math.max(520, (s.dur - this.start - 300) / res.length), k = clamp(Math.floor((lt - this.start) / per), 0, res.length - 1);
        if (lt >= this.start && k !== s._cut) {
          s._cut = k; camHouse(res[k].house, R.opts.findDist || 40, Math.min(380, per * 0.6));
          if (R.running) { AU.tick(0, 2600); AU.whoosh(0, 0.28); AU.pop(0.3, 760 + k * 60); }
        }
        var loc = lt - this.start - k * per, it = res[k];
        if (lt >= this.start) {
          var fl = 1 - prog(loc, 0, 130); if (fl > 0) { g.fillStyle = 'rgba(255,255,255,' + fl * 0.35 + ')'; g.fillRect(0, 0, W, H); }
          var bp = E.outCubic(prog(loc, 0, 300)), hs = lerp(230, 150, bp);
          g.save(); g.globalAlpha = oa; brackets(g, W / 2, cy, hs, hs, 50, 8, C.yellow); g.restore();
          var lp = E.outBack(prog(loc, 180, 420));
          if (lp > 0) {
            g.save(); g.globalAlpha = clamp(lp, 0, 1) * oa; g.fillStyle = '#fff';
            g.beginPath(); g.moveTo(W / 2 - 18, cy - 196); g.lineTo(W / 2 + 18, cy - 196); g.lineTo(W / 2, cy - 168); g.closePath(); g.fill(); g.restore();
            chip(g, it.nick, W / 2, cy - 236, { size: 52, bg: '#fff', color: C.ink, weight: 900, spacing: 1, scale: Math.max(0.001, lp), alpha: clamp(lp, 0, 1) * oa });
            if (it.town) { g.save(); g.globalAlpha = prog(loc, 300, 500) * oa; g.fillStyle = '#fff'; g.shadowColor = 'rgba(5,10,30,0.85)'; g.shadowBlur = 14; g.font = font(36, 900); g.textAlign = 'center'; g.textBaseline = 'middle'; spacedText(g, up(it.town), W / 2, cy + 212, 3, 'center'); g.restore(); }
          }
          // tečky průběhu
          g.save(); g.globalAlpha = oa;
          for (var d = 0; d < res.length; d++) { g.fillStyle = d === k ? C.yellow : 'rgba(255,255,255,0.45)'; g.beginPath(); g.arc(W / 2 + (d - (res.length - 1) / 2) * 34, cy + 262, d === k ? 10 : 7, 0, 7); g.fill(); }
          g.restore();
        }
      } else {
        // bez domků: nicky naskakují přes mapu
        s.items.forEach(function (it2, i) {
          var p = E.outBack(prog(lt, 300 + i * 220, 600 + i * 220)); if (p <= 0) return;
          chip(g, it2.nick, 200 + rnd('fx' + i) * 680, 700 + i * (560 / Math.max(1, s.items.length)), { size: 44, bg: i % 2 ? '#fff' : C.yellow, color: C.ink, weight: 900, scale: Math.max(0.001, p), alpha: clamp(p, 0, 1) * oa });
        });
      }
      kLine(g, 'NAJDI SE', W / 2, 410, 96, lt, 20, { out: out, punch: 1.8 });
      kLine(g, 'VE VIDEU', W / 2, 520, 60, lt, 180, { sticker: C.yellow, color: C.ink, out: out + 30, punch: 1.4 });
    }
  };

  // ---------- KORUNA TÝDNE: „👑 KORUNU TÝDNE MÁ MUKAŘOV (+16) · KDO MU JI VEZME?“
  SCENES.crown = {
    land: 700,
    enter: function (s) {
      gcall('orbit', 0); camTown(s.name, 1300).then(function () { gcall('orbit', 0.22); });
      AU.ping(0.1, 1320); AU.riser(0.1, 0.55); AU.boom(this.land / 1000); AU.ping(this.land / 1000 + 0.05, 2200);
      for (var i = 0; i < 5; i++) AU.pop(this.land / 1000 + 0.1 + i * 0.06, 800 + i * 120);
      loadAssets(s);
    },
    draw: function (g, s, lt) {
      var out = s.dur - 300, oa = 1 - prog(lt, out, out + 220), land = this.land;
      grade(g, 0.62, 0.6, 0.22 * oa);
      var cp = E.outBack(prog(lt, 40, 360));
      chip(g, 'KORUNA TÝDNE', W / 2, 395, { size: 40, bg: C.yellow, color: C.ink, weight: 900, spacing: 5, scale: Math.max(0.001, cp), alpha: clamp(cp, 0, 1) * oa, icon: function (g2, x, y, r) { iconCrown(g2, x, y, r); } });
      // erb + koruna, která na něj dopadne
      var ep = prog(lt, 100, 520), eo = prog(lt, out, out + 260), img = s._img && s._img.erb;
      if (ep > 0 && eo < 1) {
        var es = E.outBack(ep) * (1 - E.inCubic(eo)), ew = 180, eh = 216, ey = 690;
        g.save(); g.translate(W / 2, ey); g.rotate(Math.sin(lt / 420) * 0.03); g.scale(es, es);
        g.shadowColor = 'rgba(0,0,0,0.45)'; g.shadowBlur = 40; g.shadowOffsetY = 14;
        if (img) g.drawImage(img, -ew / 2, -eh / 2, ew, eh); else shield(g, -ew / 2, -eh / 2, ew, eh, C.blue, up(s.name)[0]);
        g.restore();
        var p = prog(lt, 300, land), cy = lerp(200, ey - eh / 2 + 18, E.inCubic(p)), sq = lt > land ? 1 + Math.sin(prog(lt, land, land + 240) * Math.PI) * 0.14 : 1;
        if (p > 0) { g.save(); g.globalAlpha = 1 - eo; g.translate(W / 2, cy); g.rotate(-0.08 * (1 - p) + Math.sin(lt / 500) * 0.02); g.scale(sq * es, es / sq); drawCrown(g, 0, 0, 190, lt); g.restore(); }
      }
      kLine(g, 'KORUNU TÝDNE MÁ', W / 2, 890, 62, lt, land - 150, { out: out, color: C.ice, stagger: 50 });
      kLine(g, up(s.name), W / 2, 1020, 124, lt, land + 50, { out: out, color: C.yellow, punch: 2.1 });
      var wp = E.outBack(prog(lt, land + 350, land + 650));
      if (wp > 0 && s.week) chip(g, '+' + s.week + ' ZA TÝDEN', W / 2, 1095, { size: 40, bg: 'rgba(11,20,48,0.85)', color: '#fff', border: 'rgba(255,210,63,.8)', weight: 900, spacing: 3, scale: Math.max(0.001, wp), alpha: clamp(wp, 0, 1) * oa });
      kLine(g, 'KDO ' + up(s.pron) + ' JI VEZME?', W / 2, 1235, 66, lt, wordStart(s, /^Kdo$/i, land + 1400) - 100, { sticker: '#fff', color: C.ink, out: out + 40, punch: 1.4, stagger: 50 });
      confetti(g, lt, { t0: land, x: W / 2, y: 600, n: 60, seed: 'cr', spread: 3 });
    }
  };

  // ---------- OTEVŘENÁ SMYČKA + SLIB + CTA
  SCENES.cta = {
    enter: function (s) {
      gcall('orbit', 0);
      gcall('overview', 1500).then(function () { gcall('orbit', 0.16); });
      AU.ping(0.1, 1320); AU.pop(0.5, 700);
      var td = wordStart(s, /^Dej$/i, 2400) / 1000; AU.ping(td, 1760);
    },
    draw: function (g, s, lt) {
      grade(g, 0.62, 0.65, 0.2);
      var out = s.dur - 260, oa = 1 - prog(lt, out, out + 200);
      var tQ = wordStart(s, /^Co$/i, 1200), tD = wordStart(s, /^Dej$/i, 2400), tN = wordStart(s, /^napiš$/i, tD + 500), tM = wordStart(s, /^máš$/i, tN + 1200);
      // 1) otevřená smyčka: ZÍTRA STAVÍME TOP KOMENTÁŘ → CO TO BUDE?
      kLine(g, 'ZÍTRA STAVÍME', W / 2, 640, 112, lt, 60, { out: tQ - 260, punch: 1.8 });
      kLine(g, 'TOP KOMENTÁŘ', W / 2, 780, 124, lt, 260, { out: tQ - 220, color: C.yellow, punch: 2 });
      var cp = E.outBack(prog(lt, tQ - 200, tQ + 120));
      chip(g, 'ZÍTRA STAVÍME TOP KOMENTÁŘ', W / 2, 395, { size: 34, bg: C.yellow, color: C.ink, weight: 900, spacing: 3, scale: Math.max(0.001, cp), alpha: clamp(cp, 0, 1) * oa, icon: iconStar(C.ink) });
      kLine(g, 'CO TO BUDE?', W / 2, 545, 128, lt, tQ - 120, { out: out, punch: 2 });
      // vedoucí komentář (pokud je)
      if (s.next) {
        var mp = prog(lt, tQ + 150, tQ + 550), mo = prog(lt, tD - 150, tD + 150);
        if (mp > 0 && mo < 1) {
          var cw = 860, cx = (W - cw) / 2, cy = 615; g.font = font(38, 700);
          var lines = wrap(g, '„' + s.next.text + '“', cw - 150).slice(0, 2), chh = 64 + lines.length * 46;
          g.save(); g.globalAlpha = clamp(mp * 2, 0, 1) * (1 - mo) * oa;
          g.translate(0, (1 - E.outCubic(mp)) * 60 - E.inCubic(mo) * 40);
          g.fillStyle = 'rgba(255,255,255,0.96)'; g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 30; rr(g, cx, cy, cw, chh, 30); g.fill(); g.shadowBlur = 0;
          var hue = hash(s.next.author) % 360; g.fillStyle = 'hsl(' + hue + ',70%,55%)'; g.beginPath(); g.arc(cx + 62, cy + chh / 2, 34, 0, 7); g.fill();
          g.fillStyle = '#fff'; g.font = font(32, 900); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(up(s.next.author).slice(0, 1) || '?', cx + 62, cy + chh / 2 + 1);
          g.textAlign = 'left'; g.fillStyle = '#6b7896'; g.font = font(26, 700); g.fillText('@' + s.next.author + (s.next.likes ? '  ·  ♥ ' + s.next.likes : '') + '  ·  zatím vede', cx + 116, cy + 30);
          g.fillStyle = C.ink; g.font = font(38, 700); for (var i = 0; i < lines.length; i++) g.fillText(lines[i], cx + 116, cy + 76 + i * 46);
          g.restore();
        }
      }
      // slib: dej follow + napiš obec a povolání = domek s tvým jménem
      var fp = E.outBack(prog(lt, tD - 60, tD + 260));
      if (fp > 0) chip(g, '+ DEJ FOLLOW', W / 2, 655, { size: 44, bg: C.sky, color: C.ink, weight: 900, spacing: 3, scale: Math.max(0.001, fp), alpha: clamp(fp, 0, 1) * oa });
      kLine(g, 'NAPIŠ OBEC', W / 2, 780, 104, lt, tN - 120, { out: out });
      kLine(g, 'A POVOLÁNÍ', W / 2, 895, 92, lt, tN + 120, { out: out, color: C.yellow });
      var tIn = tN + 380, ip = E.outBack(prog(lt, tIn, tIn + 350));
      if (ip > 0) {
        var iw = 820, ih = 112, ix = (W - iw) / 2, iy = 975;
        g.save(); g.globalAlpha = clamp(ip, 0, 1) * oa;
        g.translate(W / 2, iy + ih / 2); g.scale(Math.max(0.001, ip), Math.max(0.001, ip)); g.translate(-W / 2, -(iy + ih / 2));
        g.shadowColor = 'rgba(0,0,0,.4)'; g.shadowBlur = 40; g.shadowOffsetY = 12;
        g.fillStyle = 'rgba(255,255,255,0.97)'; rr(g, ix, iy, iw, ih, ih / 2); g.fill(); g.shadowBlur = 0; g.shadowOffsetY = 0;
        var ag = g.createLinearGradient(ix, iy, ix + 100, iy + 100); ag.addColorStop(0, C.sky); ag.addColorStop(1, C.blue);
        g.fillStyle = ag; g.beginPath(); g.arc(ix + 60, iy + ih / 2, 37, 0, 7); g.fill();
        g.fillStyle = '#fff'; g.font = font(32, 900); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('TY', ix + 60, iy + ih / 2 + 1);
        var tT = tIn + 250, per = 1300, k = Math.floor(Math.max(0, lt - tT) / per), name = s.sample[k % s.sample.length], ph = (Math.max(0, lt - tT) % per) / per;
        var typed = name.slice(0, Math.ceil(clamp(ph / 0.55, 0, 1) * name.length));
        if (ph > 0.85) typed = name.slice(0, Math.ceil((1 - (ph - 0.85) / 0.15) * name.length));
        if (lt < tT) typed = '';
        g.textAlign = 'left'; g.font = font(46, 700); g.fillStyle = typed ? C.ink : '#9aa4ba';
        g.fillText(typed || 'Přidej komentář…', ix + 120, iy + ih / 2 + 2);
        if (typed && Math.floor(lt / 260) % 2 === 0) { var cw2 = g.measureText(typed).width; g.fillStyle = C.blue; g.fillRect(ix + 124 + cw2, iy + 30, 5, ih - 60); }
        g.fillStyle = typed ? C.blue : '#c3cbe0'; g.font = font(38, 800); g.textAlign = 'right'; g.fillText('Zveřejnit', ix + iw - 42, iy + ih / 2 + 2);
        g.restore();
        if (typed && typed !== s._lastTyped) { if (typed.length > (s._lastTyped || '').length) AU.tick(0, 3000 + typed.length * 40); s._lastTyped = typed; }
        if (!typed) s._lastTyped = '';
      }
      kLine(g, '= DOMEK S TVÝM JMÉNEM', W / 2, 1180, 60, lt, Math.max(tM - 150, tIn + 300), { sticker: C.yellow, color: C.ink, out: out + 40, punch: 1.4, stagger: 45 });
    }
  };

  SCENES.outro = {
    enter: function (s) {
      gcall('orbit', 0.4);
      AU.boom(0.05); AU.ping(0.12, 1480); AU.stopMusic(s.dur / 1000);
    },
    draw: function (g, s, lt) {
      var p = E.inOut(prog(lt, 0, 520));
      // radar takeover z centra
      var rad = p * Math.hypot(W, H) * 0.62;
      g.save(); g.beginPath(); g.arc(W / 2, H / 2, Math.max(rad, 0.1), 0, 7); g.clip();
      var bg = g.createLinearGradient(0, 0, W * 0.4, H); bg.addColorStop(0, C.sky); bg.addColorStop(0.5, C.blue); bg.addColorStop(1, C.navy);
      g.fillStyle = bg; g.fillRect(0, 0, W, H);
      drawRadar(g, W / 2, H / 2, 640, -Math.PI / 2 + lt / 380, 0.55, { fill: false, lw: 4 });
      // pulzující prstence
      for (var i = 0; i < 3; i++) {
        var q = ((lt / 1400) + i / 3) % 1;
        g.strokeStyle = 'rgba(255,255,255,' + (1 - q) * 0.35 + ')'; g.lineWidth = 6;
        g.beginPath(); g.arc(W / 2, H / 2, 120 + q * 700, 0, 7); g.stroke();
      }
      g.restore();
      if (rad > 2) { g.save(); g.strokeStyle = '#fff'; g.lineWidth = 8; g.shadowColor = C.sky; g.shadowBlur = 40; g.beginPath(); g.arc(W / 2, H / 2, rad, 0, 7); g.stroke(); g.restore(); }
      // wordmark
      var lp = prog(lt, 300, 760);
      if (lp > 0) {
        var s2 = lerp(2.2, 1, E.outBack(lp));
        g.save(); g.translate(W / 2, H / 2 - 40); g.scale(s2, s2); g.globalAlpha = clamp(lp * 2, 0, 1);
        g.shadowColor = 'rgba(5,10,30,0.45)'; g.shadowBlur = 50; g.shadowOffsetY = 16;
        g.fillStyle = '#fff'; g.font = font(220, 900); g.textBaseline = 'middle';
        spacedText(g, 'RADAR', 0, 0, 18, 'center');
        g.restore();
      }
      kLine(g, 'POSTAV SI ŘÍČANSKO', W / 2, H / 2 + 150, 54, lt, 650, { punch: 1.3, stagger: 60 });
      if (lt > 900) chip(g, 'ZÍTRA DEN ' + (s.day + 1), W / 2, H / 2 + 270, { size: 38, bg: C.yellow, color: C.ink, weight: 900, spacing: 4, scale: Math.max(0.001, E.outBack(prog(lt, 900, 1250))) });
      if (s.handle && lt > 1100) { g.save(); g.globalAlpha = prog(lt, 1100, 1400); g.fillStyle = '#fff'; g.font = font(42, 700); g.textAlign = 'center'; g.fillText(s.handle, W / 2, H / 2 + 380); g.restore(); }
      var fo = prog(lt, s.dur - 250, s.dur); if (fo > 0) { g.fillStyle = 'rgba(11,20,48,' + fo + ')'; g.fillRect(0, 0, W, H); }
    }
  };

  function wordStart(s, re, def) { var w = (s.words || []).filter(function (x) { return re.test(x.w); })[0]; return w ? w.start : def; }
  // ---- perzistentní UI: badge + spodní lišta
  function drawChrome(g, t, sc) {
    var script = R.script, sType = sc && sc.type;
    if (sType === 'outro') return;
    var lt = t - sc.t0, appear = sType === 'hook' ? E.outCubic(prog(lt, 500, 900)) : 1;
    if (appear <= 0) return;
    // badge RADAR (vlevo nahoře, těsně pod safe zónou)
    g.save(); g.globalAlpha = appear; g.translate((1 - appear) * -60, 0);
    g.font = font(40, 900); var bx = 56, by = SAFE_TOP + 22, bw = 74 + spacedWidth(g, 'RADAR', 4) + 26, bh = 74;
    var bg = g.createLinearGradient(bx, by, bx + bw, by + bh); bg.addColorStop(0, C.sky); bg.addColorStop(1, '#1d4fa3');
    g.shadowColor = 'rgba(0,0,0,.3)'; g.shadowBlur = 20; g.shadowOffsetY = 6;
    g.fillStyle = bg; rr(g, bx, by, bw, bh, 18); g.fill(); g.shadowBlur = 0; g.shadowOffsetY = 0;
    iconRadar(t)(g, bx + 40, by + bh / 2, 20);
    g.fillStyle = '#fff'; g.font = font(40, 900); g.textBaseline = 'middle';
    spacedText(g, 'RADAR', bx + 74, by + bh / 2 + 2, 4, 'left');
    g.restore();
    // vpravo nahoře: denní update
    g.save(); g.globalAlpha = appear;
    g.font = font(28, 800);
    var lab = 'DENNÍ UPDATE', lw = spacedWidth(g, lab, 3) + 76, lx = W - 56 - lw, ly = SAFE_TOP + 22 + 37;
    g.fillStyle = 'rgba(11,20,48,0.7)'; rr(g, lx, ly - 27, lw, 54, 27); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 2; g.stroke();
    iconDot(C.yellow, t)(g, lx + 30, ly, 14);
    g.fillStyle = '#fff'; g.textBaseline = 'middle'; spacedText(g, lab, lx + 52, ly + 1, 3, 'left');
    g.restore();
    // spodní lišta (nad spodní safe zónou)
    var y = H - SAFE_BOTTOM - 62;
    g.save(); g.globalAlpha = appear; g.translate(0, (1 - appear) * 60);
    g.font = font(36, 900);
    var dTxt = 'DEN ' + script.day, rest = 'POSTAV SI ŘÍČANSKO';
    var w1 = spacedWidth(g, dTxt, 3); g.font = font(34, 800); var w2 = spacedWidth(g, rest, 3);
    var tot = 64 + w1 + 44 + w2 + 44, x = (W - tot) / 2, h = 72;
    g.fillStyle = 'rgba(11,20,48,0.78)'; rr(g, x, y - h / 2, tot, h, h / 2); g.fill();
    g.strokeStyle = 'rgba(95,168,232,0.65)'; g.lineWidth = 2.5; g.stroke();
    // progress
    g.save(); rr(g, x, y - h / 2, tot, h, h / 2); g.clip();
    g.fillStyle = 'rgba(255,210,63,0.9)'; g.fillRect(x, y + h / 2 - 5, tot * clamp(t / script.total, 0, 1), 5); g.restore();
    iconRadar(t)(g, x + 40, y, 16);
    g.textBaseline = 'middle'; g.font = font(36, 900); g.fillStyle = C.yellow;
    spacedText(g, dTxt, x + 66, y + 2, 3, 'left');
    g.fillStyle = 'rgba(255,255,255,0.55)'; g.beginPath(); g.arc(x + 66 + w1 + 22, y, 5, 0, 7); g.fill();
    g.font = font(34, 800); g.fillStyle = '#fff';
    spacedText(g, rest, x + 66 + w1 + 44, y + 2, 3, 'left');
    g.restore();
  }

  // ---- titulky voiceoveru
  function drawSubs(g, t, sc) {
    if (!sc || !sc.chunks || !sc.chunks.length || sc.noSubs || sc.type === 'hook' || sc.type === 'outro' || R.opts.subtitles === false) return;
    var lt = t - sc.t0, ws = sc.words, ci = -1, wi = -1;
    var live = R.live && R.live.scene === sc.idx && R.live.started ? R.live : null;
    if (live) {
      // TTS: aktuální slovo podle onboundary (charIndex) nebo odhad od onstart
      var lw = -1;
      if (live.char != null) { for (var i = 0; i < ws.length; i++) if (ws[i].i <= live.char) lw = i; }
      else { var el = now() - live.startedAt + sc.voStart; for (var j = 0; j < ws.length; j++) if (ws[j].start <= el) lw = j; }
      if (live.ended && now() - live.endedAt > 250) lw = -2;
      wi = lw;
    } else {
      for (var k = 0; k < ws.length; k++) if (ws[k].start <= lt && lt < ws[k].end + 400) wi = k;
      if (ws.length && lt > ws[ws.length - 1].end + 350) wi = -2;
    }
    if (wi < 0) return;
    if (sc.subsUntil && ws.some(function (w, k2) { return k2 <= wi && sc.subsUntil.test(w.w); })) return;
    for (var c = 0; c < sc.chunks.length; c++) if (sc.chunks[c].indexOf(wi) >= 0) ci = c;
    if (ci < 0) return;
    var ch = sc.chunks[ci];
    if (R._lastChunk !== sc.idx + ':' + ci) { R._lastChunk = sc.idx + ':' + ci; R._chunkAt = t; }
    var pop = E.outBack(prog(t - R._chunkAt, 0, 160)), sc2 = lerp(0.82, 1, pop);
    var words = ch.map(function (j) { return subDisplay(ws[j].w); });
    // spoj „+“ s číslem
    var disp = [], map = [];
    for (var a = 0; a < words.length; a++) {
      if (words[a] === '+' && a + 1 < words.length) { disp.push('+' + words[a + 1]); map.push([ch[a], ch[a + 1]]); a++; }
      else { disp.push(words[a]); map.push([ch[a]]); }
    }
    var size = 80; g.font = font(size, 900);
    var sp = size * 0.26, text = disp.join(' ');
    size = fitSize(g, text, 900, size, 900, 54); g.font = font(size, 900); sp = size * 0.26;
    var widths = disp.map(function (w) { return g.measureText(w).width; });
    var tot = widths.reduce(function (x1, y1) { return x1 + y1; }, 0) + sp * (disp.length - 1);
    var y = H - SAFE_BOTTOM - 190, x = W / 2 - tot / 2;
    g.save(); g.translate(W / 2, y); g.scale(sc2, sc2); g.translate(-W / 2, -y);
    g.textBaseline = 'middle'; g.textAlign = 'left'; g.lineJoin = 'round';
    for (var d = 0; d < disp.length; d++) {
      var active = map[d].indexOf(wi) >= 0, spoken = map[d][0] <= wi;
      g.lineWidth = size * 0.2; g.strokeStyle = C.navy;
      g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowBlur = 16; g.shadowOffsetY = 6;
      g.strokeText(disp[d], x, y); g.shadowBlur = 0; g.shadowOffsetY = 0;
      g.fillStyle = active ? C.yellow : (spoken ? '#ffffff' : 'rgba(255,255,255,0.92)');
      if (active) { g.save(); g.translate(x + widths[d] / 2, y); g.scale(1.06, 1.06); g.fillText(disp[d], -widths[d] / 2, 0); g.restore(); }
      else g.fillText(disp[d], x, y);
      x += widths[d] + sp;
    }
    g.restore();
  }

  function drawSafe(g) {
    g.save(); g.fillStyle = 'rgba(255,0,80,0.18)'; g.fillRect(0, 0, W, SAFE_TOP); g.fillRect(0, H - SAFE_BOTTOM, W, SAFE_BOTTOM);
    g.strokeStyle = 'rgba(255,0,80,0.8)'; g.setLineDash([12, 10]); g.lineWidth = 3;
    g.beginPath(); g.moveTo(0, SAFE_TOP); g.lineTo(W, SAFE_TOP); g.moveTo(0, H - SAFE_BOTTOM); g.lineTo(W, H - SAFE_BOTTOM); g.stroke();
    g.restore();
  }

  // ---- hlavní smyčka
  function sceneAt(t) {
    var sc = R.script.scenes;
    for (var i = sc.length - 1; i >= 0; i--) if (t >= sc[i].t0) return sc[i];
    return sc[0];
  }
  function renderFrame(t) {
    var g = R.g, sc = sceneAt(t), lt = t - sc.t0;
    drawGame(g);
    var S = SCENES[sc.type];
    if (S && S.draw) { g.save(); S.draw(g, sc, lt); g.restore(); }
    // přechody: sweep wipe kolem hranice scén (ne do hooku a do outra — ty mají vlastní)
    var next = R.script.scenes[sc.idx + 1], WIPE = 560;
    if (next && next.type !== 'outro' && sc.t0 + sc.dur - t < WIPE / 2) sweepWipe(g, 0.5 * (1 - (sc.t0 + sc.dur - t) / (WIPE / 2)));
    if (sc.type !== 'hook' && sc.type !== 'outro' && lt < WIPE / 2) sweepWipe(g, 0.5 + 0.5 * lt / (WIPE / 2));
    drawChrome(g, t, sc);
    drawSubs(g, t, sc);
    if (R.opts.debugSafe) drawSafe(g);
    return sc;
  }

  function enterScene(sc) {
    var S = SCENES[sc.type];
    if (S && S.enter) try { S.enter(sc, R); } catch (e) { console.warn('[REEL] enter', sc.type, e); }
    if (sc.type !== 'hook' && sc.type !== 'outro') AU.whoosh(-0.05, 0.5);
    // TTS náhled
    if (R.tts && sc.vo) {
      var idx = sc.idx;
      R.live = { scene: idx, started: false, char: null, ended: false };
      setTimeout(function () {
        if (!R.running || !R.live || R.live.scene !== idx) return;
        TTS.speak(sc.vo, function (ev, ci) {
          if (!R.live || R.live.scene !== idx) return;
          if (ev === 'start') { R.live.started = true; R.live.startedAt = now(); }
          if (ev === 'word') { R.live.started = true; R.live.char = ci; }
          if (ev === 'end') { R.live.ended = true; R.live.endedAt = now(); }
        });
      }, sc.voStart);
    }
  }

  function loop() {
    if (!R.running) return;
    var tNow = now(), dt = tNow - R.last; R.last = tNow;
    var t = tNow - R.t0;
    if (R.opts.fixedStep) { R.vt = (R.vt == null ? 0 : R.vt + R.opts.fixedStep); t = R.vt; }   // test/offline: pevný krok na snímek
    // v náhledu s TTS počkej na doznění hlasu (max 2,5 s navíc na scénu)
    var cur = sceneAt(Math.min(t, R.script.total - 1));
    if (R.tts && R.live && R.live.scene === cur.idx && cur.vo && !R.live.ended && t > cur.t0 + cur.dur - 120 && (R._hold || 0) < 2500) {
      R.t0 += dt; R._hold = (R._hold || 0) + dt; t = tNow - R.t0;
    }
    if (t >= R.script.total) { renderFrame(R.script.total - 1); finish(); return; }
    var sc = sceneAt(t);
    if (sc.idx !== R.idx) { R.idx = sc.idx; R._hold = 0; enterScene(sc); }
    renderFrame(t);
    R.t = t;
    if (R.opts.onFrame) try { R.opts.onFrame(t, sc); } catch (e) {}
    R.raf = requestAnimationFrame(loop);
  }

  function finish() {
    R.running = false;
    cancelAnimationFrame(R.raf);
    AU.stopAll();
    gcall('orbit', 0);
    var r = R.resolve; R.resolve = null;
    if (r) r();
  }

  function loadFonts() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    var ps = ['900', '800', '700', '600'].map(function (w) { return document.fonts.load(w + ' 64px "Space Grotesk"').catch(function () {}); });
    return Promise.race([Promise.all(ps), sleep(1500)]);
  }

  function prepare(script, opts) {
    if (!script.total) layout(script);
    ensureCanvas();
    if (opts.mount && R.canvas.parentNode !== opts.mount) opts.mount.appendChild(R.canvas);
    var g = G();
    if (g && g.setAspect && opts.setAspect !== false) {
      try { R._prevSize = g.canvas ? [g.canvas.clientWidth || g.canvas.width, g.canvas.clientHeight || g.canvas.height] : null; g.setAspect(W, H); } catch (e) {}
    }
    AU.init();
    var jobs = [loadFonts()];
    if (AU.ctx && AU.ctx.state === 'suspended') jobs.push(AU.ctx.resume().catch(function () {}));
    script.scenes.forEach(function (s) {
      if (s.type === 'town' && s.img === undefined) jobs.push(svgToImage(s.erbSvg).then(function (im) { s.img = im; }));
      jobs.push(loadAssets(s));
      if (s.emoji) emojiOk(s.emoji);
      if (s.type === 'comment' && s.avatar && s._av === undefined) jobs.push(loadImage(s.avatar).then(function (im) { s._av = im; }));
      delete s._p; delete s._lastTyped; delete s._cut;
    });
    if (opts.tts) jobs.push(TTS.pick());
    if (opts.voiceTrack) jobs.push(setVoiceTrack(opts.voiceTrack));
    return Promise.all(jobs);
  }

  function start(script, opts) {
    R.script = script; R.opts = opts || {}; R.idx = -1; R.live = null; R._hold = 0; R._lastChunk = null;
    AU.monitorNode.gain.value = R.opts.monitor === false ? 0 : 1;
    AU.music.gain.value = AU.voiceBuf ? 0.32 : 0.55;
    AU.intensity = 1;
    AU.startMusic(1);
    if (AU.voiceBuf && R.opts.voice !== false) AU.playVoice();
    R.running = true; R.t0 = now(); R.last = R.t0; R.vt = null;
    return new Promise(function (res) { R.resolve = res; R.raf = requestAnimationFrame(loop); });
  }

  function stop() {
    TTS.cancel();
    if (R.recorder && R.recorder.state !== 'inactive') try { R.recorder.stop(); } catch (e) {}
    if (R.running) finish();
  }

  // ------------------------------------------------------------------ PUBLIC API
  function play(script, opts) {
    opts = opts || {};
    stop();
    var useTts = opts.tts !== false && !AU.voiceBuf && !!root.speechSynthesis;
    opts.tts = useTts;
    return prepare(script, opts).then(function () {
      R.tts = useTts && !!TTS.voice || (useTts && opts.ttsAnyVoice);
      return start(script, opts);
    }).then(function () { TTS.cancel(); restoreAspect(opts); });
  }

  function pickMime() {
    if (!root.MediaRecorder) return '';
    var list = ['video/mp4;codecs=avc1.640028,mp4a.40.2', 'video/mp4;codecs=avc1.42E01F,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a',
      'video/mp4;codecs=avc1.640028,opus', 'video/mp4;codecs=avc1,opus', 'video/mp4;codecs=avc1', 'video/mp4',
      'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
    for (var i = 0; i < list.length; i++) if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(list[i])) return list[i];
    return '';
  }

  function record(script, opts) {
    opts = opts || {};
    stop();
    opts.tts = !!opts.speak && !!root.speechSynthesis;   // TTS v nahrávce NEBUDE slyšet, jen pro kontrolu
    return prepare(script, opts).then(function () {
      if (!root.MediaRecorder || !R.canvas.captureStream) throw new Error('MediaRecorder / captureStream není v tomto prohlížeči k dispozici');
      R.tts = opts.tts && !!TTS.voice;
      var vStream = R.canvas.captureStream(opts.fps || FPS);
      var tracks = vStream.getVideoTracks().slice();
      if (AU.rec) tracks = tracks.concat(AU.rec.stream.getAudioTracks());
      var stream = new MediaStream(tracks);
      var mime = opts.mimeType || pickMime();
      var rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: opts.bitrate || 12000000, audioBitsPerSecond: 192000 } : undefined);
      var chunks = [];
      rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
      R.recorder = rec;
      // první snímek, ať video nezačíná černou
      R.script = script; renderFrame(0);
      var done = new Promise(function (res) {
        rec.onstop = function () {
          var type = (mime || rec.mimeType || 'video/webm').split(';')[0];
          var blob = new Blob(chunks, { type: type });
          blob.extension = /mp4/.test(type) ? 'mp4' : 'webm';
          res(blob);
        };
      });
      rec.start(500);
      return start(script, opts).then(function () { return sleep(350); }).then(function () {
        if (rec.state !== 'inactive') rec.stop();
        vStream.getTracks().forEach(function (tr) { tr.stop(); });
        return done;
      });
    }).then(function (blob) { TTS.cancel(); restoreAspect(opts); return blob; });
  }

  function restoreAspect(opts) {
    if (opts && opts.restoreAspect && R._prevSize && G() && G().setAspect) try { G().setAspect(R._prevSize[0], R._prevSize[1]); } catch (e) {}
  }

  function setVoiceTrack(src) {
    var c = AU.init();
    if (!src) { AU.voiceBuf = null; return Promise.resolve(null); }
    if (!c) return Promise.reject(new Error('WebAudio není k dispozici'));
    if (root.AudioBuffer && src instanceof AudioBuffer) { AU.voiceBuf = src; return Promise.resolve(src); }
    var p;
    if (typeof src === 'string') p = fetch(src).then(function (r) { return r.arrayBuffer(); });
    else if (src.arrayBuffer) p = src.arrayBuffer();
    else if (src instanceof ArrayBuffer) p = Promise.resolve(src);
    else return Promise.reject(new Error('Nepodporovaný voice track'));
    return p.then(function (ab) {
      return new Promise(function (res, rej) { c.decodeAudioData(ab, res, rej); });
    }).then(function (buf) { AU.voiceBuf = buf; return buf; });
  }

  // Namluvené segmenty (externí TTS, např. ElevenLabs): jeden klip na segment z voiceScript(script).segments.
  // Přečasuje scénář podle délek audia, poskládá jednu stopu a nastaví ji jako voice track.
  function setVoiceSegments(script, clips, o) {
    o = o || {};
    var c = AU.init(); if (!c) return Promise.reject(new Error('WebAudio není k dispozici'));
    if (!script.total) layout(script);
    var dec = (clips || []).map(function (src) {
      if (!src) return Promise.resolve(null);
      if (root.AudioBuffer && src instanceof AudioBuffer) return Promise.resolve(src);
      var p = typeof src === 'string' ? fetch(src).then(function (r) { return r.arrayBuffer(); }) : src instanceof ArrayBuffer ? Promise.resolve(src.slice(0)) : src.arrayBuffer ? src.arrayBuffer() : Promise.resolve(null);
      return p.then(function (ab) { return ab ? new Promise(function (res, rej) { c.decodeAudioData(ab, res, rej); }) : null; });
    });
    return Promise.all(dec).then(function (bufs) {
      layout(script, { voDurations: bufs.map(function (b) { return b ? Math.round(b.duration * 1000) + (o.padMs || 0) : null; }) });
      var sr = c.sampleRate, len = Math.ceil(script.total / 1000 * sr) + sr, ch = 2;
      var out = c.createBuffer(ch, len, sr), k = 0;
      script.scenes.forEach(function (s) {
        if (!s.vo) return; var b = bufs[k++]; if (!b) return;
        var off = Math.round((s.t0 + s.voStart) / 1000 * sr);
        for (var j = 0; j < ch; j++) {
          var src = b.getChannelData(Math.min(j, b.numberOfChannels - 1)), dst = out.getChannelData(j);
          if (b.sampleRate === sr) dst.set(src.subarray(0, Math.min(src.length, len - off)), off);
          else { var r = b.sampleRate / sr, n = Math.min(Math.floor(src.length / r), len - off); for (var q = 0; q < n; q++) dst[off + q] = src[Math.floor(q * r)]; }
        }
      });
      AU.voiceBuf = out;
      return { total: script.total, buffer: out, segments: voiceScript(script).segments };
    });
  }

  function loadAssets(s) {
    if (!s.assets) return Promise.resolve();
    s._img = s._img || {};
    return Promise.all(Object.keys(s.assets).map(function (k) {
      if (s._img[k] !== undefined || !s.assets[k]) return null;
      s._img[k] = null; return svgToImage(s.assets[k]).then(function (im) { s._img[k] = im; });
    }));
  }

  // ------------------------------------------------------------------ OFFLINE (GitHub Actions / headless)
  // Virtuální čas: rAF a performance.now() hry jedou po pevném kroku, takže 3D záběr je deterministický.
  function virtualClock() {
    var perf = root.performance, origNow = perf.now, origRaf = root.requestAnimationFrame, origCaf = root.cancelAnimationFrame;
    var q = [], id = 0, base = origNow.call(perf);
    var vc = { t: 0, timers: [], base: base };
    perf.now = function () { return base + vc.t; };
    root.requestAnimationFrame = function (cb) { q.push({ id: ++id, cb: cb }); return id; };
    root.cancelAnimationFrame = function (i) { q = q.filter(function (x) { return x.id !== i; }); };
    vc.fire = function () {   // časovače scén splatné do vc.t
      var due = vc.timers.filter(function (x) { return x.at <= vc.t; });
      vc.timers = vc.timers.filter(function (x) { return x.at > vc.t; });
      due.forEach(function (x) { try { x.fn(); } catch (e) { console.warn('[REEL] timer', e); } });
    };
    vc.tick = function () {   // jeden snímek hry (všechny rAF callbacky) v čase vc.t
      var cur = q; q = [];
      cur.forEach(function (x) { try { x.cb(base + vc.t); } catch (e) { console.warn('[REEL] raf', e); } });
    };
    vc.waitReal = function (n) { return new Promise(function (res) { var k = 0; (function f() { if (++k > n) return res(); origRaf.call(root, f); })(); }); };
    vc.restore = function () {
      perf.now = origNow; root.requestAnimationFrame = origRaf; root.cancelAnimationFrame = origCaf;
      var pend = q; q = []; pend.forEach(function (x) { origRaf.call(root, x.cb); });
    };
    return vc;
  }

  // REEL.frames(script, {fps, each(canvas, tMs, i), start, end}) → Promise<počet snímků>
  // Deterministický průchod po krocích 1000/fps, bez zvuku a bez závislosti na hodinách. `each` může být async;
  // když vrátí false, průchod skončí.
  function frames(script, o) {
    o = o || {};
    stop();
    if (!script.total) layout(script);
    var fps = o.fps || FPS, step = 1000 / fps, opts = {};
    for (var k in o) opts[k] = o[k];
    opts.tts = false;
    return prepare(script, opts).then(function () {
      var restoreAudio = AU.ctx ? (function () { var c = AU.ctx; AU.ctx = null; return function () { AU.ctx = c; }; })() : function () {};
      var vc = VT = virtualClock();
      R.script = script; R.opts = opts; R.idx = -1; R.live = null; R.tts = false; R._lastChunk = null; R.running = true; R.offline = true;
      var t0 = Math.max(0, o.start || 0), t1 = Math.min(script.total, o.end != null ? o.end : script.total);
      var n = Math.max(0, Math.ceil((t1 - t0) / step - 1e-6)), i = 0;
      function done() { vc.restore(); VT = null; restoreAudio(); R.running = false; R.offline = false; gcall('orbit', 0); restoreAspect(opts); }
      // nech hru přejít na virtuální rAF (její aktuální callback ještě čeká na skutečný snímek)
      return vc.waitReal(2).then(function () {
        // průchod scénami před `start` (enter efekty kamery), bez vykreslování
        if (t0 > 0) for (var tt = 0; tt < t0; tt += step) { vc.t = tt; var s0 = sceneAt(tt); if (s0.idx !== R.idx) { R.idx = s0.idx; enterScene(s0); } vc.fire(); vc.tick(); }
        function next() {
          if (i >= n) return Promise.resolve(i);
          var t = t0 + i * step; vc.t = t;
          var sc = sceneAt(t);
          if (sc.idx !== R.idx) { R.idx = sc.idx; enterScene(sc); }
          vc.fire(); vc.tick();
          // mikroúlohy (then po doletu kamery) mezi snímky
          return Promise.resolve().then(function () {
            renderFrame(t); R.t = t;
            var r = o.each ? o.each(R.canvas, t, i) : null;
            return Promise.resolve(r).then(function (res) { i++; if (res === false) n = i; return next(); });
          });
        }
        return next();
      }).then(function (cnt) { done(); return cnt; }, function (e) { done(); throw e; });
    });
  }

  // REEL.renderAudio(script) → Promise<Blob audio/wav>: hudba + SFX + voice track přes OfflineAudioContext,
  // časy stejné jako v online záznamu (scéna spouští zvuky na svém začátku, SFX z draw() po snímcích 30 fps).
  function renderAudio(script, o) {
    o = o || {};
    if (!script.total) layout(script);
    var OAC = root.OfflineAudioContext || root.webkitOfflineAudioContext;
    if (!OAC) return Promise.reject(new Error('OfflineAudioContext není k dispozici'));
    stop();
    var sr = o.sampleRate || 44100, dur = script.total / 1000, off = new OAC(2, Math.ceil(dur * sr), sr);
    var restore = AU.swap(off), keep = { script: R.script, opts: R.opts, idx: R.idx, running: R.running, tts: R.tts };
    ensureCanvas();
    try {
      R.audioOnly = true; R.script = script; R.opts = { subtitles: false }; R.idx = -1; R.running = true; R.tts = false; R.live = null;
      AU.offT = 0; AU.intensity = 1;
      AU.music.gain.setValueAtTime(AU.voiceBuf ? 0.32 : 0.55, 0);
      var spb = 60 / AU.BPM / 4;
      for (var st = 0, tm = 0.05; tm < dur; st++, tm += spb) AU.playStep(st, tm, spb);
      if (AU.voiceBuf && o.voice !== false) AU.playVoice();
      var step = 1000 / (o.fps || FPS);
      for (var t = 0; t < script.total; t += step) {
        var sc = sceneAt(t); AU.offT = t / 1000;
        if (sc.idx !== R.idx) { R.idx = sc.idx; enterScene(sc); }
        var S = SCENES[sc.type];
        if (S && S.draw) { R.g.save(); try { S.draw(R.g, sc, t - sc.t0); } catch (e) {} R.g.restore(); }
      }
    } finally {
      R.audioOnly = false; AU.offT = null; restore();
      R.script = keep.script; R.opts = keep.opts; R.idx = keep.idx; R.running = keep.running; R.tts = keep.tts;
    }
    return off.startRendering().then(function (buf) { var b = wavBlob(buf); b.duration = buf.duration; return b; });
  }

  function wavBlob(buf) {
    var ch = buf.numberOfChannels, n = buf.length, sr = buf.sampleRate, ab = new ArrayBuffer(44 + n * ch * 2), v = new DataView(ab);
    function w(o, t) { for (var i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i)); }
    w(0, 'RIFF'); v.setUint32(4, 36 + n * ch * 2, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
    v.setUint16(22, ch, true); v.setUint32(24, sr, true); v.setUint32(28, sr * ch * 2, true); v.setUint16(32, ch * 2, true); v.setUint16(34, 16, true);
    w(36, 'data'); v.setUint32(40, n * ch * 2, true);
    var data = []; for (var c = 0; c < ch; c++) data.push(buf.getChannelData(c));
    for (var i = 0, o2 = 44; i < n; i++) for (var c2 = 0; c2 < ch; c2++, o2 += 2) { var x = Math.max(-1, Math.min(1, data[c2][i])); v.setInt16(o2, x < 0 ? x * 0x8000 : x * 0x7fff, true); }
    return new Blob([ab], { type: 'audio/wav' });
  }

  // debug / screenshoty: vykreslí overlay v čase t (kamera zůstane, kde je)
  function renderAt(script, t) {
    if (!script.total) layout(script);
    ensureCanvas(); R.script = script; R.opts = R.opts || {};
    var sc = sceneAt(t);
    if (R.idx !== sc.idx) { R.idx = sc.idx; }
    renderFrame(t);
    return R.canvas;
  }

  root.REEL = {
    version: '2.0.0', W: W, H: H, SAFE_TOP: SAFE_TOP, SAFE_BOTTOM: SAFE_BOTTOM, colors: C,
    scriptFromDay: scriptFromDay, layout: layout, play: play, record: record, stop: stop,
    voiceScript: voiceScript, setVoiceTrack: setVoiceTrack, setVoiceSegments: setVoiceSegments, renderAt: renderAt,
    frames: frames, renderAudio: renderAudio,
    hooks: HOOK_IDS.concat(['expanded', 'quiet']), cz: { townGen: townGen, townDat: townDat, jobForm: jobForm, buildingAcc: buildingAcc },
    get canvas() { return ensureCanvas(); },
    get time() { return R.t || 0; },
    get running() { return R.running; },
    get voiceName() { return TTS.voice ? TTS.voice.name : null; },
    snapshot: function (type, q) { return ensureCanvas().toDataURL(type || 'image/png', q); },
    mimeType: pickMime,
    _audio: AU, _scenes: SCENES
  };
})(typeof window !== 'undefined' ? window : this);
