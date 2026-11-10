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
  // grafický kit RADAR: Noc, tmavě modrá, akcent (limetka), světle modrá; text na akcentu #0B0C12
  var C = { night: '#0A1233', blue: '#2F4AA8', acc: '#C6FF3D', sky: '#66B2FF', white: '#ffffff', ink: '#0B0C12' };
  C.navy = C.night;   // aliasy pro starší helpery
  var FONT_H = '"Archivo", "Inter", "Segoe UI", Roboto, Arial, sans-serif';   // nadpisy, čísla, titulky (expanded 125 %, 800)
  var FONT_B = '"Inter", "Segoe UI", Roboto, Arial, sans-serif';              // text v bublinách, popisky
  var FONT = FONT_H;
  var TIERS = { wood: { label: 'dřevěná liga' }, silver: { label: 'stříbrná liga' }, gold: { label: 'zlatá liga' }, plat: { label: 'platinová liga' } };

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
  function font(size, weight) { if (R.g) { try { R.g.fontStretch = 'expanded'; R.g.letterSpacing = '-0.02em'; } catch (e) {} } return (weight || 800) + ' ' + Math.round(size) + 'px ' + FONT_H; }
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
    var cols = [C.acc, C.sky, C.white, C.blue, C.acc, C.sky], n = o.n || 70, k = 2.2, grav = 1500;
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
    g.fillStyle = C.sky; g.fillText(text, x - amt, y);
    g.fillStyle = C.acc; g.fillText(text, x + amt, y + amt * 0.25);
    g.restore();
    g.save(); g.font = font(size, 900); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = color; g.fillText(text, x, y); g.restore();
  }
  // mapový špendlík (hrot dole v x,y)
  function pin(g, x, y, s, color, inner) {
    g.save(); g.translate(x, y); g.scale(s / 100, s / 100);
    g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 18; g.shadowOffsetY = 8;
    g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(-18, -38, -50, -62, -50, -100); g.arc(0, -100, 50, Math.PI, 0); g.bezierCurveTo(50, -62, 18, -38, 0, 0); g.closePath();
    g.fillStyle = color || C.acc; g.fill(); g.shadowBlur = 0; g.shadowOffsetY = 0;
    g.fillStyle = '#fff'; g.beginPath(); g.arc(0, -100, 30, 0, 7); g.fill();
    if (inner === 'house') { g.fillStyle = C.ink; g.beginPath(); g.moveTo(-17, -94); g.lineTo(0, -116); g.lineTo(17, -94); g.lineTo(13, -94); g.lineTo(13, -82); g.lineTo(-13, -82); g.lineTo(-13, -94); g.closePath(); g.fill(); }
    else if (inner) { g.fillStyle = C.ink; g.font = font(inner.length > 2 ? 22 : 34, 800); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(inner, 0, -98); }
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
      eq: need + ' ' + up(jobForm(jb.job, need)) + ' = 1 ' + up(b), eqText: need + ' ' + jobForm(jb.job, need) + ' = 1 ' + lowerCs(b),
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
      vo: 'Korunu má ' + cr.name + ', největší obec Říčanska! Kdo ' + pr + ' ji vezme?'
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
      ask: 'JSI ' + up(job) + ' Z ' + up(gen) + '?', askText: 'Jsi ' + job + ' z ' + gen + '?',
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
      vo: 'Zítra stavíme top komentář. Co to bude? Dej follow, napiš svou obec a máš domek se jménem!'
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

  // ------------------------------------------------------------------ KIT: písmo
  // Archivo (expanded 125 %, 800, -0.02em) pro nadpisy/čísla/titulky, Inter pro text v bublinách a popisky.
  // Bez sítě: fallback Inter + lehké horizontální roztažení (HX), aby zůstal „expanded“ charakter.
  var HX = 1;
  function hf(g, size, weight) { g.font = (weight || 800) + ' ' + Math.round(size) + 'px ' + FONT_H; try { g.fontStretch = 'expanded'; g.letterSpacing = '-0.02em'; } catch (e) {} }
  function bf(g, size, weight) { g.font = (weight || 600) + ' ' + Math.round(size) + 'px ' + FONT_B; try { g.fontStretch = 'normal'; g.letterSpacing = '0px'; } catch (e) {} }
  function hw(g, text) { return g.measureText(text).width * HX; }
  function htext(g, text, x, y) {
    if (HX === 1) { g.fillText(text, x, y); return; }
    g.save(); g.translate(x, y); g.scale(HX, 1); g.fillText(text, 0, 0); g.restore();
  }
  function hfit(g, text, maxW, size, weight, min) { hf(g, size, weight); var w = hw(g, text); return w <= maxW ? size : Math.max(min || 12, Math.floor(size * maxW / w)); }
  // pop-in s přestřelem: .6 → 1.08 → 1 (vrací scale pro p 0..1)
  function popS(p) { if (p <= 0) return 0.6; if (p >= 1) return 1; return p < 0.7 ? lerp(0.6, 1.08, E.outCubic(p / 0.7)) : lerp(1.08, 1, (p - 0.7) / 0.3); }
  function popA(p) { return clamp(p * 4, 0, 1); }
  var POP = 220;

  // ------------------------------------------------------------------ KIT: podklad
  function drawGame(g) {
    var gc = G() && G().canvas;
    g.fillStyle = C.night; g.fillRect(0, 0, W, H);
    if (!gc || !gc.width) return;
    var s = Math.max(W / gc.width, H / gc.height), dw = gc.width * s, dh = gc.height * s;
    try { g.drawImage(gc, (W - dw) / 2, (H - dh) / 2, dw, dh); } catch (e) {}
  }
  // tint Noc + 2 rozmazané bloby (světle modrý .6, tmavě modrý .35), pomalu se hýbou
  function backdrop(g, t, tint, o) {
    o = o || {};
    g.fillStyle = 'rgba(10,18,51,' + clamp(tint, 0, 1) + ')'; g.fillRect(0, 0, W, H);
    var blobs = [
      { x: 180 + Math.sin(t / 4300) * 110, y: 520 + Math.cos(t / 5100) * 80, c: '102,178,255', a: 0.6 },
      { x: 900 + Math.cos(t / 4700) * 100, y: 1520 + Math.sin(t / 3900) * 90, c: '47,74,168', a: 0.35 }
    ];
    if (o.blobs === false) return;
    blobs.forEach(function (b) {
      var r = 230, gr = g.createRadialGradient(b.x, b.y, 0, b.x, b.y, r * 1.35);
      gr.addColorStop(0, 'rgba(' + b.c + ',' + b.a + ')'); gr.addColorStop(0.55, 'rgba(' + b.c + ',' + (b.a * 0.55) + ')'); gr.addColorStop(1, 'rgba(' + b.c + ',0)');
      g.fillStyle = gr; g.beginPath(); g.arc(b.x, b.y, r * 1.35, 0, 7); g.fill();
    });
  }

  // ------------------------------------------------------------------ KIT: prvky
  // zaoblený obdélník s různými rohy [tl, tr, br, bl]
  function rrc(g, x, y, w, h, r) {
    if (typeof r === 'number') return rr(g, x, y, w, h, r);
    var tl = r[0], tr = r[1], br = r[2], bl = r[3];
    g.beginPath(); g.moveTo(x + tl, y); g.lineTo(x + w - tr, y); g.arcTo(x + w, y, x + w, y + tr, tr); g.lineTo(x + w, y + h - br); g.arcTo(x + w, y + h, x + w - br, y + h, br);
    g.lineTo(x + bl, y + h); g.arcTo(x, y + h, x, y + h - bl, bl); g.lineTo(x, y + tl); g.arcTo(x, y, x + tl, y, tl); g.closePath();
  }
  // skleněná plocha: ztmavení + bílá .09, rámeček .22, horní highlight .28, stín 0 10 26
  function glass(g, x, y, w, h, r, o) {
    o = o || {};
    g.save();
    g.shadowColor = 'rgba(0,0,0,0.4)'; g.shadowBlur = 26; g.shadowOffsetY = 10;
    g.fillStyle = 'rgba(10,18,51,' + (o.dark == null ? 0.42 : o.dark) + ')'; rrc(g, x, y, w, h, r); g.fill();
    g.shadowBlur = 0; g.shadowOffsetY = 0;
    g.fillStyle = o.fill || 'rgba(255,255,255,0.09)'; rrc(g, x, y, w, h, r); g.fill();
    g.save(); rrc(g, x, y, w, h, r); g.clip(); g.fillStyle = 'rgba(255,255,255,0.28)'; g.fillRect(x, y, w, 1.5); g.restore();
    g.strokeStyle = o.border || 'rgba(255,255,255,0.22)'; g.lineWidth = o.lw || 1.5; rrc(g, x, y, w, h, r); g.stroke();
    g.restore();
  }
  function solidBox(g, x, y, w, h, r) {
    g.save(); g.shadowColor = 'rgba(0,0,0,0.35)'; g.shadowBlur = 24; g.shadowOffsetY = 10; g.fillStyle = C.acc; rrc(g, x, y, w, h, r); g.fill(); g.restore();
  }
  // čip (pill): glass, text Inter 600 bílý, čísla Archivo akcent; o.solid = plná akcentová výplň s tmavým textem
  function chip(g, text, cx, y, o) {
    o = o || {};
    var size = o.size || 34, h = size * 1.75, padX = size * 0.75, parts = String(text).split(' '), ws = [], tw = 0, sp = size * 0.28;
    parts.forEach(function (p) { var num = !o.solid && /^[+#]?\d[\d\s/]*%?$/.test(p); if (num) hf(g, size * 1.1, 800); else bf(g, size, 700); var w = num ? hw(g, p) : g.measureText(p).width; ws.push([w, num]); tw += w; });
    tw += sp * (parts.length - 1);
    var w = tw + padX * 2 + (o.icon ? h * 0.55 : 0), x = o.align === 'left' ? cx : o.align === 'right' ? cx - w : cx - w / 2;
    var sc = o.scale == null ? 1 : Math.max(0.001, o.scale);
    g.save(); g.globalAlpha = o.alpha == null ? 1 : clamp(o.alpha, 0, 1);
    g.translate(x + w / 2, y); g.scale(sc, sc); g.translate(-(x + w / 2), -y);
    if (o.solid) solidBox(g, x, y - h / 2, w, h, h / 2); else glass(g, x, y - h / 2, w, h, h / 2, o);
    g.textBaseline = 'middle'; g.textAlign = 'left';
    var tx = x + padX;
    if (o.icon) { o.icon(g, x + padX + h * 0.08, y, h * 0.26); tx += h * 0.55; }
    parts.forEach(function (p, i) {
      if (ws[i][1]) { hf(g, size * 1.1, 800); g.fillStyle = o.numColor || C.acc; htext(g, p, tx, y + 1); }
      else { bf(g, size, 700); g.fillStyle = o.solid ? C.ink : (o.color || C.white); g.fillText(p, tx, y + 1); }
      tx += ws[i][0] + sp;
    });
    g.restore();
    return w;
  }
  // razítko: Archivo 800 akcent, 3px rámeček, radius 10, rotace -6°
  function stamp(g, text, cx, cy, o) {
    o = o || {};
    var size = o.size || 44, p = o.p == null ? 1 : o.p; if (p <= 0) return;
    hf(g, size, 800); var tw = hw(g, text), padX = size * 0.55, w = tw + padX * 2, h = size * 1.45;
    g.save(); g.globalAlpha = popA(p) * (o.alpha == null ? 1 : o.alpha);
    g.translate(cx, cy); g.rotate(o.rot == null ? -0.105 : o.rot); var sc = popS(p); g.scale(sc, sc);
    g.fillStyle = 'rgba(10,18,51,0.55)'; rr(g, -w / 2, -h / 2, w, h, 10); g.fill();
    g.strokeStyle = C.acc; g.lineWidth = 3; rr(g, -w / 2, -h / 2, w, h, 10); g.stroke();
    g.fillStyle = C.acc; g.textAlign = 'center'; g.textBaseline = 'middle'; hf(g, size, 800); htext(g, text, 0, 1);
    g.restore();
    return w;
  }
  // číselná karta: glass + velké číslo Archivo v akcentu + popisek Inter .8
  function numCard(g, cx, cy, w, h, num, label, o) {
    o = o || {};
    var p = o.p == null ? 1 : o.p; if (p <= 0) return;
    g.save(); g.globalAlpha = popA(p) * (o.alpha == null ? 1 : o.alpha); var sc = popS(p); g.translate(cx, cy); g.scale(sc, sc);
    glass(g, -w / 2, -h / 2, w, h, 20);
    var ns = o.numSize || h * 0.48; hf(g, ns, 800); g.fillStyle = C.acc; g.textAlign = 'center'; g.textBaseline = 'middle';
    htext(g, num, 0, -h * 0.1 + (label ? 0 : h * 0.08));
    if (label) { bf(g, o.labelSize || 28, 600); g.fillStyle = 'rgba(255,255,255,0.8)'; g.fillText(label, 0, h * 0.3); }
    g.restore();
  }
  // chat bublina (glass): side 'left' → rohy 20 20 20 6, 'right' → 20 20 6 20. Vrací výšku.
  function bubble(g, x, y, w, lines, o) {
    o = o || {};
    var pad = o.pad || 34, lh = o.lh || 50, headH = o.head ? 92 : 0, footH = o.foot ? 58 : 0, h = pad * 2 + headH + lines.length * lh + footH;
    var r = o.side === 'right' ? [20, 20, 6, 20] : [20, 20, 20, 6];
    g.save(); g.globalAlpha *= (o.alpha == null ? 1 : o.alpha);
    glass(g, x, y, w, h, r);
    var ty = y + pad;
    if (o.head) {
      var ar = 30, ax = x + pad + ar, ay = ty + ar;
      g.save(); g.beginPath(); g.arc(ax, ay, ar, 0, 7); g.clip();
      if (o.avatarImg) g.drawImage(o.avatarImg, ax - ar, ay - ar, ar * 2, ar * 2);
      else { g.fillStyle = C.blue; g.fillRect(ax - ar, ay - ar, ar * 2, ar * 2); hf(g, 30, 800); g.fillStyle = C.white; g.textAlign = 'center'; g.textBaseline = 'middle'; htext(g, up(String(o.head).replace(/[^a-zA-Zá-žÁ-Ž0-9]/g, '')).slice(0, 1) || '?', ax, ay + 1); }
      g.restore();
      g.strokeStyle = C.acc; g.lineWidth = 3; g.beginPath(); g.arc(ax, ay, ar + 3, 0, 7); g.stroke();
      bf(g, 30, 700); g.fillStyle = C.white; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(o.head, ax + ar + 18, ay - 14);
      if (o.sub) { bf(g, 24, 500); g.fillStyle = 'rgba(255,255,255,0.65)'; g.fillText(o.sub, ax + ar + 18, ay + 18); }
      ty += headH;
    }
    bf(g, o.size || 38, 600); g.fillStyle = C.white; g.textAlign = 'left'; g.textBaseline = 'middle';
    var reveal = o.reveal == null ? 1 : o.reveal;
    for (var i = 0; i < lines.length; i++) {
      var li = clamp(reveal * lines.length - i, 0, 1); if (li <= 0) continue;
      g.save(); g.globalAlpha *= li; g.fillText(lines[i], x + pad, ty + lh / 2 + i * lh + (1 - E.outCubic(li)) * 14); g.restore();
    }
    if (o.foot) o.foot(g, x + pad, ty + lines.length * lh + footH / 2 + 6, w - pad * 2);
    g.restore();
    return h;
  }
  // řádek nadpisu (Archivo): slova pop-in s malým zpožděním. o.box = glass pozadí, o.solid = akcentový blok s tmavým textem
  function kLine(g, text, cx, y, size, lt, delay, o) {
    o = o || {};
    var weight = o.weight || 800, stagger = o.stagger == null ? 45 : o.stagger, maxW = o.maxW || 960;
    size = hfit(g, text, maxW - ((o.box || o.solid) ? 80 : 0), size, weight, 28); hf(g, size, weight);
    var words = String(text).split(' '), sp = size * 0.24;
    var ws = words.map(function (w) { return hw(g, w); });
    var total = ws.reduce(function (a, b) { return a + b; }, 0) + sp * (words.length - 1);
    var x = cx - total / 2, outT = o.out, pIn = prog(lt, delay, delay + POP), pOut = outT != null ? prog(lt, outT, outT + 200) : 0;
    if (pIn <= 0 || pOut >= 1) return { w: total, h: size };
    g.save(); g.textBaseline = 'middle'; g.textAlign = 'left';
    if (o.box || o.solid) {
      var padX = size * 0.4, bw = total + padX * 2, bh = size * 1.5, bs = popS(pIn) * (1 - pOut);
      g.save(); g.globalAlpha = popA(pIn) * (1 - pOut); g.translate(cx, y); g.scale(bs, bs);
      if (o.solid) solidBox(g, -bw / 2, -bh / 2, bw, bh, 14); else glass(g, -bw / 2, -bh / 2, bw, bh, 14);
      g.restore();
    }
    for (var i = 0; i < words.length; i++) {
      var p = prog(lt, delay + i * stagger, delay + i * stagger + POP);
      if (p <= 0) { x += ws[i] + sp; continue; }
      var s = popS(p), a = popA(p), q = outT != null ? prog(lt, outT + i * 25, outT + i * 25 + 180) : 0;
      a *= 1 - q;
      g.save(); g.globalAlpha = a; g.translate(x + ws[i] / 2, y - E.inCubic(q) * size * 0.4); g.scale(s, s);
      if (!o.box && !o.solid && o.shadow !== false) { g.shadowColor = 'rgba(0,0,0,0.4)'; g.shadowBlur = size * 0.16; g.shadowOffsetY = size * 0.04; }
      g.fillStyle = o.solid ? C.ink : (o.color || C.white); hf(g, size, weight); htext(g, words[i], -ws[i] / 2, 1);
      g.restore();
      x += ws[i] + sp;
    }
    g.restore();
    return { w: total, h: size };
  }

  // ---- ikonky (vektor, žádné emoji)
  function iconDot(color, t) { return function (g, x, y, r) { var p = (Math.sin(t / 180) + 1) / 2; g.fillStyle = color; g.beginPath(); g.arc(x, y, r * 0.55, 0, 7); g.fill(); g.strokeStyle = color; g.globalAlpha *= 1 - p; g.lineWidth = 3; g.beginPath(); g.arc(x, y, r * (0.6 + p * 0.9), 0, 7); g.stroke(); g.globalAlpha = 1; }; }
  function heart(g, x, y, s, color) {
    g.save(); g.translate(x, y); g.scale(s / 32, s / 32); g.fillStyle = color;
    g.beginPath(); g.moveTo(0, 10); g.bezierCurveTo(-26, -6, -14, -26, 0, -12); g.bezierCurveTo(14, -26, 26, -6, 0, 10); g.closePath(); g.fill(); g.restore();
  }
  function shield(g, x, y, w, h, color, letter) {
    g.save(); g.translate(x, y); g.scale(w / 100, h / 120);
    g.beginPath(); g.moveTo(8, 8); g.lineTo(92, 8); g.lineTo(92, 60); g.bezierCurveTo(92, 88, 72, 104, 50, 113); g.bezierCurveTo(28, 104, 8, 88, 8, 60); g.closePath();
    g.fillStyle = color; g.fill(); g.lineWidth = 5; g.strokeStyle = '#fff'; g.stroke();
    if (letter) { g.fillStyle = '#fff'; hf(g, 54, 800); g.textAlign = 'center'; g.textBaseline = 'middle'; htext(g, letter, 50, 58); }
    g.restore();
  }
  function iconCheck(color) { return function (g, x, y, r) { g.strokeStyle = color; g.lineWidth = r * 0.42; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); g.moveTo(x - r * 0.8, y); g.lineTo(x - r * 0.15, y + r * 0.65); g.lineTo(x + r * 0.95, y - r * 0.7); g.stroke(); }; }
  function iconStar(color) { return function (g, x, y, r) { g.fillStyle = color; g.beginPath(); for (var k = 0; k < 5; k++) { var a = -Math.PI / 2 + k * Math.PI * 2 / 5, b = a + Math.PI / 5; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); g.lineTo(x + Math.cos(b) * r * 0.42, y + Math.sin(b) * r * 0.42); } g.closePath(); g.fill(); }; }
  function iconPin(color) { return function (g, x, y, r) { pin(g, x, y + r, r * 2, color, null); }; }
  function iconArrow(color) { return function (g, x, y, r) { g.strokeStyle = color; g.lineWidth = r * 0.4; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); g.moveTo(x, y - r * 0.9); g.lineTo(x, y + r * 0.9); g.moveTo(x - r * 0.7, y + r * 0.2); g.lineTo(x, y + r * 0.9); g.lineTo(x + r * 0.7, y + r * 0.2); g.stroke(); }; }

  // ---- odometr (rolovací číslice, Archivo akcent)
  function odometer(g, value, cx, y, size, color) {
    var v = Math.max(0, value), digits = String(Math.floor(v)).length;
    hf(g, size, 800);
    var cw = hw(g, '0') * 1.02, gap = size * 0.18, ch = size * 1.05;
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
      g.fillStyle = color || C.acc;
      hf(g, size, 800); htext(g, String(dVal), x + cw / 2, y - e * ch);
      htext(g, String((dVal + 1) % 10), x + cw / 2, y + ch - e * ch);
      g.restore();
      x += cw; if (k > 0 && k % 3 === 0) x += gap;
    }
    g.restore();
    return totalW;
  }

  // ---- reticle (zaměření obce / domku) – akcent
  function reticle(g, cx, cy, lt, color) {
    var p = E.outBack(prog(lt, 250, 750)), r = 120 * p + 10, a = lt / 900;
    if (p <= 0) return;
    g.save(); g.translate(cx, cy); g.globalAlpha = clamp(p, 0, 1);
    g.strokeStyle = color || C.acc; g.lineWidth = 5; g.lineCap = 'round';
    for (var i = 0; i < 4; i++) { g.save(); g.rotate(a + i * Math.PI / 2); g.beginPath(); g.arc(0, 0, r, -0.35, 0.35); g.stroke(); g.restore(); }
    g.lineWidth = 2; g.globalAlpha *= 0.7; g.beginPath(); g.arc(0, 0, r * 0.55, 0, 7); g.stroke();
    var pp = (lt % 1200) / 1200;
    g.globalAlpha = (1 - pp) * 0.8; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, r * (0.6 + pp * 1.4), 0, 7); g.stroke();
    g.restore();
  }
  // kamera „shake“ – vrátí offset
  function shakeAt(lt, t0, amp) { var q = 1 - prog(lt, t0, t0 + 320); return q > 0 ? [Math.sin(lt / 15) * amp * q, Math.cos(lt / 21) * amp * q] : [0, 0]; }

  // ------------------------------------------------------------------ SCÉNY
  var SCENES = {};
  var HOOKS = {};

  // ---- kamera
  function camHouse(h, dist, ms) {
    if (!h) return Promise.resolve();
    var d = dist || 24;
    return gcall('flyTo', { target: { x: h.x, y: 1.5, z: h.z }, pos: { x: h.x + d * 0.3, y: d * 0.62, z: h.z + d * 0.72 } }, Math.max(16, ms || 0));
  }
  function camTown(name, ms) { return name ? gcall('focusTown', name, Math.max(16, ms || 0)) : gcall('overview', Math.max(16, ms || 0)); }
  function houseY() { return R.opts.houseY || H / 2; }
  function townY() { return R.opts.focusY || 1130; }
  function flash(g, lt, t0, a) { var f = 1 - prog(lt, t0, t0 + 180); if (f > 0) { g.fillStyle = 'rgba(255,255,255,' + f * a + ')'; g.fillRect(0, 0, W, H); } }

  // ---------- HOOK: klasika (+N nových sousedů)
  HOOKS.classic = {
    enter: function (s, sc) {
      var st = safeState(), town = (st.towns || []).filter(function (t) { return t.name === s.town; })[0] || (st.towns || [])[0];
      var h = town && town.houses && town.houses[town.houses.length - 1];
      gcall('orbit', 0);
      (h ? gcall('focusHouse', h.id, 0) : gcall('overview', 0)).then(function () {
        later(function () { (town ? gcall('focusTown', town.name, 2300) : gcall('overview', 2300)).then(function () { gcall('orbit', 0.35); }); }, 120);
      });
      AU.boom(0); AU.ping(0.08, 1480); AU.whoosh(s.dur / 1000 - 0.3, 0.6);
    },
    draw: function (g, s, lt) {
      backdrop(g, lt, 0.3);
      flash(g, lt, 0, 0.35);
      var sh = shakeAt(lt, 0, 8), out = s.dur - 320;
      g.save(); g.translate(sh[0], sh[1]);
      var bigIsNum = /^\+\d/.test(s.big);
      kLine(g, s.big, W / 2, bigIsNum ? 780 : 740, bigIsNum ? 270 : 190, lt, 60, { color: C.acc, out: out });
      kLine(g, s.big2, W / 2, bigIsNum ? 985 : 900, 94, lt, 300, { out: out + 40, stagger: 60 });
      chip(g, s.sticker, W / 2, bigIsNum ? 1115 : 1040, { size: 34, scale: popS(prog(lt, 620, 620 + POP)), alpha: popA(prog(lt, 620, 620 + POP)) * (1 - prog(lt, out + 60, out + 220)) });
      g.restore();
    }
  };

  // ---------- HOOK: VÝPADEK RADARU (glitch → střih na číslo)
  HOOKS.glitch = {
    cut: 950, headerAt: 950,
    enter: function (s) {
      gcall('orbit', 0); camTown(s.town, 16).then(function () { gcall('orbit', 0.3); });
      AU.glitch(0, 0.28); AU.glitch(0.34, 0.2); AU.glitch(0.66, 0.26); AU.boom(0.95); AU.ping(1.0, 1480); AU.whoosh(s.dur / 1000 - 0.3, 0.6);
    },
    draw: function (g, s, lt) {
      var cut = this.cut, seed = 'g' + Math.floor(lt / 70);
      if (lt < cut) {
        g.fillStyle = 'rgba(10,18,51,0.92)'; g.fillRect(0, 0, W, H);
        var jit = rnd(seed) > 0.72 ? 1 : 0, amt = 5 + jit * 12;
        stamp(g, 'SIGNÁL ZTRACEN', W / 2, 600, { size: 40, p: prog(lt, 60, 60 + POP) });
        var tp = prog(lt, 80, 260);
        g.save(); g.globalAlpha = tp;
        rgbText(g, 'VÝPADEK', W / 2 + (jit ? (rnd(seed + 'q') - 0.5) * 24 : 0), 800, 170, C.white, amt);
        rgbText(g, 'RADARU', W / 2 - (jit ? (rnd(seed + 'w') - 0.5) * 24 : 0), 970, 170, C.acc, amt * 0.8);
        g.restore();
        g.save(); for (var i = 0; i < 24; i++) { g.fillStyle = 'rgba(255,255,255,' + (0.04 + rnd(seed + 'n' + i) * 0.16) + ')'; g.fillRect(rnd(seed + 'x' + i) * W, rnd(seed + 'y' + i) * H, 20 + rnd(seed + 'w' + i) * 220, 3); } g.restore();
        scanlines(g, 0.2);
        sliceShift(g, jit ? 46 : 10, seed, jit ? 5 : 2);
        var fl = prog(lt, cut - 90, cut); if (fl > 0) { g.fillStyle = 'rgba(255,255,255,' + fl * 0.9 + ')'; g.fillRect(0, 0, W, H); }
        return;
      }
      var l2 = lt - cut;
      backdrop(g, lt, 0.3);
      flash(g, l2, 0, 0.6);
      var out = s.dur - cut - 320;
      kLine(g, s.big, W / 2, 780, 270, l2, 40, { color: C.acc, out: out });
      kLine(g, s.big2, W / 2, 985, 94, l2, 220, { out: out + 40, stagger: 60 });
      chip(g, s.sticker, W / 2, 1115, { size: 34, scale: popS(prog(l2, 450, 450 + POP)), alpha: popA(prog(l2, 450, 450 + POP)) * (1 - prog(l2, out + 60, out + 220)) });
      if (l2 < 300) sliceShift(g, 50 * (1 - l2 / 300), 'r' + Math.floor(l2 / 60), 4, C.night);
    }
  };

  // ---------- HOOK: +38 LIDÍ ZA 24 HODIN (ciferník)
  HOOKS.counter = {
    enter: function (s) {
      gcall('orbit', 0); gcall('overview', 16); later(function () { if (R.running) camTown(s.town, 2400).then(function () { gcall('orbit', 0.3); }); }, 200);
      AU.boom(0); AU.ping(0.1, 1480); AU.ping(1.45, 1760); AU.whoosh(s.dur / 1000 - 0.3, 0.6); R.lastCount = -1;
    },
    draw: function (g, s, lt) {
      backdrop(g, lt, 0.4);
      flash(g, lt, 0, 0.3);
      var cx = W / 2, cy = 860, r = 250, out = s.dur - 320;
      var ap = prog(lt, 0, POP), a = popA(ap) * (1 - prog(lt, out, out + 250)), p = E.outCubic(prog(lt, 150, 1400));
      if (a > 0) {
        g.save(); g.globalAlpha = a; g.translate(cx, cy); g.scale(popS(ap), popS(ap));
        glass(g, -r - 60, -r - 60, (r + 60) * 2, (r + 60) * 2, r + 60);
        g.lineWidth = 22; g.strokeStyle = 'rgba(255,255,255,0.14)'; g.beginPath(); g.arc(0, 0, r, 0, 7); g.stroke();
        for (var i = 0; i < 24; i++) {
          var ang = -Math.PI / 2 + i / 24 * Math.PI * 2, on = i / 24 <= p, l = i % 6 === 0 ? 26 : 14;
          g.strokeStyle = on ? C.acc : 'rgba(255,255,255,0.35)'; g.lineWidth = i % 6 === 0 ? 5 : 3;
          g.beginPath(); g.moveTo(Math.cos(ang) * (r + 24), Math.sin(ang) * (r + 24)); g.lineTo(Math.cos(ang) * (r + 24 + l), Math.sin(ang) * (r + 24 + l)); g.stroke();
        }
        g.strokeStyle = C.acc; g.lineWidth = 22; g.lineCap = 'round';
        if (p > 0.002) { g.beginPath(); g.arc(0, 0, r, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2); g.stroke(); }
        var ea = -Math.PI / 2 + p * Math.PI * 2;
        g.fillStyle = C.white; g.beginPath(); g.arc(Math.cos(ea) * r, Math.sin(ea) * r, 18, 0, 7); g.fill();
        g.restore();
        var val = Math.round(lerp(0, s.n, p)), bump = 1 + Math.sin(prog(lt, 1400, 1700) * Math.PI) * 0.1;
        if (val !== R.lastCount && lt - (R._lastTick || 0) > 45 && lt < 1450) { AU.tick(0, 1900 + (val % 7) * 90); R._lastTick = lt; R.lastCount = val; }
        g.save(); g.globalAlpha = a; g.translate(cx, cy - 24); g.scale(popS(ap) * bump, popS(ap) * bump);
        var size = hfit(g, '+' + s.n, 380, 190, 800, 80); hf(g, size, 800); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = C.acc; htext(g, '+' + val, 0, 0);
        hf(g, 56, 800); g.fillStyle = C.white; htext(g, s.big2, 0, size * 0.62);
        g.restore();
      }
      chip(g, s.sticker, W / 2, 1250, { size: 34, scale: popS(prog(lt, 900, 900 + POP)), alpha: popA(prog(lt, 900, 900 + POP)) * (1 - prog(lt, out + 60, out + 220)) });
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
      backdrop(g, lt, 0.35);
      var out = s.dur - 320, oa = 1 - prog(lt, out, out + 200);
      var lp = popS(prog(lt, 800, 800 + POP)) * popA(prog(lt, 800, 800 + POP)) * oa;
      var lx = W / 2 + Math.sin(lt / 650) * 250, ly = 1110 + Math.sin(lt / 410) * 80, lr = 150;
      for (var i = 0; i < 12; i++) {
        var px = 130 + rnd('px' + i) * 820, py = 990 + rnd('py' + i) * 290, t0 = 280 + i * 70, q = prog(lt, t0, t0 + 420);
        if (q <= 0) continue;
        var by = (1 - E.outBack(q)) * -260, hot = Math.hypot(px - lx, py - 50 - ly) < lr && lp > 0.5;
        g.save(); g.globalAlpha = clamp(q * 3, 0, 1) * oa;
        pin(g, px, py + by, hot ? 92 : 70, hot ? C.white : C.acc, 'house');
        g.restore();
      }
      if (lp > 0.01) {
        var gc = G() && G().canvas;
        g.save(); g.translate(lx, ly); g.scale(lp, lp); g.translate(-lx, -ly);
        g.save(); g.beginPath(); g.arc(lx, ly, lr, 0, 7); g.clip();
        if (gc && gc.width) {
          var sc = Math.max(W / gc.width, H / gc.height), ox = (W - gc.width * sc) / 2, oy = (H - gc.height * sc) / 2, z = 2;
          var sx = (lx - ox) / sc, sy = (ly - oy) / sc, hwid = lr / (sc * z);
          try { g.drawImage(gc, sx - hwid, sy - hwid, hwid * 2, hwid * 2, lx - lr, ly - lr, lr * 2, lr * 2); } catch (e) {}
        }
        g.restore();
        g.lineCap = 'round'; g.strokeStyle = C.night; g.lineWidth = 40;
        g.beginPath(); g.moveTo(lx + Math.cos(0.8) * (lr + 14), ly + Math.sin(0.8) * (lr + 14)); g.lineTo(lx + Math.cos(0.8) * (lr + 120), ly + Math.sin(0.8) * (lr + 120)); g.stroke();
        g.strokeStyle = C.acc; g.lineWidth = 26; g.stroke();
        g.strokeStyle = C.white; g.lineWidth = 12; g.shadowColor = 'rgba(0,0,0,.4)'; g.shadowBlur = 20; g.beginPath(); g.arc(lx, ly, lr, 0, 7); g.stroke();
        g.restore();
      }
      flash(g, lt, 0, 0.3);
      kLine(g, 'KDE JE', W / 2, 655, 124, lt, 30, { out: out });
      kLine(g, 'TVŮJ DOMEK?', W / 2, 790, 118, lt, 200, { color: C.acc, out: out + 30 });
      chip(g, s.sticker, W / 2, 915, { size: 32, scale: popS(prog(lt, 640, 640 + POP)), alpha: popA(prog(lt, 640, 640 + POP)) * oa });
    }
  };

  // ---------- HOOK: odpočet 3·2·1 → DEN X
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
      backdrop(g, lt, 0.3);
      if (lt < end + 200) {
        var oa = 1 - prog(lt, end, end + 200);
        g.fillStyle = 'rgba(10,18,51,' + 0.85 * oa + ')'; g.fillRect(0, 0, W, H);
        if (lt < end) {
          var k = Math.floor(lt / stp), f = (lt % stp) / stp, dgt = 3 - k;
          g.save();
          g.strokeStyle = 'rgba(255,255,255,0.3)'; g.lineWidth = 3;
          g.beginPath(); g.arc(cx, cy, 280, 0, 7); g.stroke(); g.beginPath(); g.arc(cx, cy, 225, 0, 7); g.stroke();
          g.beginPath(); g.moveTo(cx - 420, cy); g.lineTo(cx + 420, cy); g.moveTo(cx, cy - 320); g.lineTo(cx, cy + 380); g.stroke();
          g.fillStyle = 'rgba(198,255,61,0.22)'; g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, 280, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2); g.closePath(); g.fill();
          g.strokeStyle = C.acc; g.lineWidth = 8; g.beginPath(); g.arc(cx, cy, 280 + E.outCubic(f) * 110, 0, 7); g.globalAlpha = 1 - f; g.stroke(); g.globalAlpha = 1;
          var sc = popS(prog(f, 0, 0.5));
          g.translate(cx, cy); g.scale(sc, sc); hf(g, 330, 800); g.textAlign = 'center'; g.textBaseline = 'middle';
          g.fillStyle = C.white; htext(g, String(dgt), 0, 10);
          g.restore();
          scanlines(g, 0.1);
        }
      }
      var fl = prog(lt, end, end + 40) * (1 - prog(lt, end + 40, end + 300)); if (fl > 0) { g.fillStyle = 'rgba(255,255,255,' + fl * 0.7 + ')'; g.fillRect(0, 0, W, H); }
      var sh = shakeAt(lt, end, 10);
      g.save(); g.translate(sh[0], sh[1]);
      kLine(g, 'DEN ' + s.day, W / 2, 840, 250, lt, end, { color: C.acc, out: out, stagger: 60 });
      chip(g, s.sticker, W / 2, 1040, { size: 34, scale: popS(prog(lt, end + 260, end + 260 + POP)), alpha: popA(prog(lt, end + 260, end + 260 + POP)) * (1 - prog(lt, out + 60, out + 220)) });
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
      backdrop(g, lt, 0.3);
      flash(g, lt, 0, 0.3);
      var bp = E.outCubic(prog(lt, 0, 900)), hs = lerp(240, 180, bp), oa = 1 - prog(lt, out, out + 200);
      g.save(); g.globalAlpha = oa;
      brackets(g, cx, cy, hs, hs, 70, 8, lt > rv ? C.acc : C.white);
      if (lt < rv) { var yy = cy - hs + ((lt * 0.5) % (hs * 2)); g.fillStyle = 'rgba(198,255,61,0.55)'; g.fillRect(cx - hs, yy - 2, hs * 2, 4); }
      if (Math.floor(lt / 400) % 2 === 0 || lt > rv) { g.fillStyle = C.acc; g.beginPath(); g.arc(cx - hs + 34, cy - hs + 36, 10, 0, 7); g.fill(); }
      bf(g, 26, 700); g.fillStyle = C.white; g.textBaseline = 'middle'; g.textAlign = 'left'; g.fillText('REC', cx - hs + 54, cy - hs + 37);
      g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 3; g.beginPath(); g.moveTo(cx - 22, cy); g.lineTo(cx + 22, cy); g.moveTo(cx, cy - 22); g.lineTo(cx, cy + 22); g.stroke();
      g.restore();
      if (lt > rv) reticle(g, cx, cy, lt - rv + 250, C.acc);
      kLine(g, 'KDO TO JE?', W / 2, 680, 134, lt, 40, { out: out, stagger: 70 });
      var txt = s.reveal || '?', chars = 'ABCDEFHJKLMNPRSTUVXYZ0123456789_', shown = '';
      for (var i = 0; i < txt.length; i++) { var at = rv + i * 30; shown += (lt >= at || txt[i] === ' ') ? txt[i] : chars[hash(i + ':' + Math.floor(lt / 55)) % chars.length]; }
      var cp = prog(lt, 500, 500 + POP), done = lt >= rv + txt.length * 30;
      if (cp > 0) chip(g, shown, W / 2, 1290, { size: 44, solid: done, scale: popS(cp) * (1 + Math.sin(prog(lt, rv, rv + 260) * Math.PI) * 0.1), alpha: popA(cp) * (1 - prog(lt, out, out + 200)) });
    }
  };

  // ---------- HOOK: MIMOŘÁDNĚ (razítko + pásky)
  HOOKS.breaking = {
    enter: function (s) {
      gcall('orbit', 0); camTown(s.townB || s.town, 1400).then(function () { gcall('orbit', 0.25); });
      AU.boom(0); AU.beep(0.02, 880, 0.14); AU.beep(0.2, 660, 0.14); AU.beep(0.38, 880, 0.14); AU.beep(0.56, 660, 0.14);
      AU.whoosh(s.dur / 1000 - 0.3, 0.6);
    },
    draw: function (g, s, lt) {
      backdrop(g, lt, 0.45);
      var out = s.dur - 320, oa = 1 - prog(lt, out, out + 220);
      flash(g, lt, 0, 0.4);
      var sh = shakeAt(lt, 0, 9);
      g.save(); g.translate(sh[0], sh[1]);
      stamp(g, 'MIMOŘÁDNĚ', W / 2, 600, { size: 50, p: prog(lt, 0, POP), alpha: oa });
      kLine(g, s.line1, W / 2, 785, 150, lt, 80, { out: out });
      kLine(g, s.line2, W / 2, 905, 80, lt, 260, { out: out + 30, color: C.sky });
      kLine(g, s.sticker, W / 2, 1020, 54, lt, 520, { solid: true, out: out + 60, stagger: 30 });
      g.restore();
      [[s.ticker1, 1165, -0.05, 'acc', 1], [s.ticker2, 1262, 0.035, 'glass', -1]].forEach(function (b, k) {
        var ip = E.outCubic(prog(lt, 180 + k * 120, 560 + k * 120)); if (ip <= 0) return;
        g.save(); g.globalAlpha = oa; g.translate(W / 2 + (1 - ip) * b[4] * -1400, b[1]); g.rotate(b[2]);
        if (b[3] === 'acc') { g.fillStyle = C.acc; g.fillRect(-800, -38, 1600, 76); } else glass(g, -800, -38, 1600, 76, 0);
        hf(g, 36, 800); g.fillStyle = b[3] === 'acc' ? C.ink : C.white; g.textBaseline = 'middle'; g.textAlign = 'left';
        var txt = b[0], tw = hw(g, txt), x0 = -800 - ((lt * 0.35 * b[4]) % tw + tw) % tw;
        for (var x = x0; x < 800; x += tw) htext(g, txt, x, 2);
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
      backdrop(g, lt, 0.4);
      var dp = E.outCubic(prog(lt, 0, 420));
      g.save(); g.globalAlpha = 0.6 * oa;
      g.fillStyle = C.blue; g.beginPath(); g.moveTo(0, 570); g.lineTo(lerp(-200, 600, dp), 570); g.lineTo(lerp(-400, 480, dp), 1300); g.lineTo(0, 1300); g.closePath(); g.fill();
      g.fillStyle = C.night; g.beginPath(); g.moveTo(W, 570); g.lineTo(lerp(W + 400, 600, dp), 570); g.lineTo(lerp(W + 200, 480, dp), 1300); g.lineTo(W, 1300); g.closePath(); g.fill();
      g.restore();
      if (dp > 0.6) { g.save(); g.globalAlpha = oa; g.strokeStyle = C.white; g.lineWidth = 6; g.beginPath(); g.moveTo(600, 570); g.lineTo(480, 1300); g.stroke(); g.restore(); }
      var sh = shakeAt(lt, sl, 12);
      g.save(); g.translate(sh[0], sh[1]);
      [[s.a, 285, -1, 1], [s.b, 795, 1, 2]].forEach(function (it) {
        var o = it[0], x = it[1], pp = prog(lt, 60 + it[3] * 80, 60 + it[3] * 80 + POP), img = s._img && s._img[it[3] === 1 ? 'a' : 'b'];
        if (pp <= 0) return;
        var px = x + (1 - E.outCubic(pp)) * it[2] * 400;
        g.save(); g.globalAlpha = popA(pp) * oa; g.translate(px, 770); g.rotate(it[2] * 0.05); g.scale(popS(pp), popS(pp));
        g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = 40; g.shadowOffsetY = 14;
        if (img) g.drawImage(img, -95, -114, 190, 228); else shield(g, -95, -114, 190, 228, it[3] === 1 ? C.blue : C.sky, up(o.name)[0]);
        g.restore();
        g.save(); g.globalAlpha = popA(pp) * oa;
        var fs = hfit(g, up(o.name), 400, 58, 800, 30); hf(g, fs, 800); g.fillStyle = C.white; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 16; htext(g, up(o.name), px, 950);
        g.restore();
        var np = prog(lt, sl + 200 + it[3] * 120, sl + 200 + it[3] * 120 + POP);
        if (np > 0) chip(g, '+' + o.n, px, 1050, { size: 40, scale: popS(np), alpha: popA(np) * oa });
      });
      var vp = prog(lt, sl - 120, sl + 160);
      if (vp > 0) {
        var vs = lerp(3, 1, E.outBack(vp));
        g.save(); g.globalAlpha = clamp(vp * 2, 0, 1) * oa; g.translate(540, 800); g.rotate(-0.105); g.scale(vs, vs);
        hf(g, 160, 800); g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillStyle = 'rgba(10,18,51,0.7)'; rr(g, -150, -95, 300, 190, 10); g.fill(); g.strokeStyle = C.acc; g.lineWidth = 4; rr(g, -150, -95, 300, 190, 10); g.stroke();
        g.fillStyle = C.acc; htext(g, 'VS', 0, 4);
        g.restore();
      }
      g.restore();
      kLine(g, 'KDO DNES VYHRÁL?', W / 2, 1190, 64, lt, sl + 400, { box: true, out: out + 40, stagger: 30 });
      flash(g, lt, sl, 0.4);
    }
  };

  // ---------- společná hlavička hooku: DEN X (glass chip) + stav s číslem v akcentu (counter)
  function hookHeader(g, s, lt, h) {
    if (lt < 0) return;
    var out = s.dur - 320 - (h.headerAt || 0), oa = 1 - prog(lt, out, out + 220);
    if (!h.noDay) { var dp = prog(lt, 0, POP); chip(g, 'DEN ' + s.day, W / 2, 395, { size: 36, scale: popS(dp), alpha: popA(dp) * oa }); }
    var p = E.outCubic(prog(lt, 60, 760)), a = prog(lt, 60, 220) * oa;
    if (a <= 0) return;
    var num = fmt(Math.round(lerp(s.from || 0, s.pop || 0, p))), pre = s.statusPre, post = ' ' + s.statusPost;
    g.save(); g.globalAlpha = a; g.textBaseline = 'middle';
    var size = 50; hf(g, size, 800);
    var w1 = hw(g, pre), w2 = hw(g, fmt(s.pop || 0)), w3 = hw(g, post), tot = w1 + w2 + w3;
    if (tot > 960) { size = Math.floor(size * 960 / tot); hf(g, size, 800); w1 = hw(g, pre); w2 = hw(g, fmt(s.pop || 0)); w3 = hw(g, post); tot = w1 + w2 + w3; }
    var x = W / 2 - tot / 2, y = 483 + (1 - E.outCubic(prog(lt, 60, 360))) * 24;
    g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowBlur = 18; g.textAlign = 'left';
    g.fillStyle = C.white; htext(g, pre, x, y);
    g.fillStyle = C.acc; g.textAlign = 'center'; htext(g, num, x + w1 + w2 / 2, y);
    g.fillStyle = C.white; g.textAlign = 'left'; htext(g, post, x + w1 + w2, y);
    g.restore();
  }

  // ---------- koruna (vektor, akcent; x,y = střed spodní hrany)
  function drawCrown(g, x, y, w, t) {
    var h = w * 0.66;
    g.save(); g.translate(x, y);
    g.shadowColor = 'rgba(198,255,61,0.5)'; g.shadowBlur = w * 0.2;
    g.beginPath(); g.moveTo(-w / 2, 0); g.lineTo(-w / 2, -h * 0.58); g.lineTo(-w * 0.24, -h * 0.28); g.lineTo(0, -h); g.lineTo(w * 0.24, -h * 0.28); g.lineTo(w / 2, -h * 0.58); g.lineTo(w / 2, 0); g.closePath();
    g.fillStyle = C.acc; g.fill(); g.shadowBlur = 0;
    g.lineJoin = 'round'; g.lineWidth = w * 0.03; g.strokeStyle = C.ink; g.stroke();
    g.fillStyle = C.ink; g.fillRect(-w / 2 + w * 0.015, -h * 0.2, w - w * 0.03, w * 0.03);
    [[-w / 2, -h * 0.58], [0, -h], [w / 2, -h * 0.58]].forEach(function (p) { g.fillStyle = C.white; g.beginPath(); g.arc(p[0], p[1], w * 0.06, 0, 7); g.fill(); g.strokeStyle = C.ink; g.lineWidth = w * 0.02; g.stroke(); });
    [[-w * 0.29], [0], [w * 0.29]].forEach(function (j) { g.fillStyle = C.ink; g.beginPath(); g.arc(j[0], -h * 0.1, w * 0.045, 0, 7); g.fill(); });
    for (var i = 0; i < 3; i++) {
      var q = ((t || 0) / 900 + i / 3) % 1, a = (1 - Math.abs(q - 0.5) * 2), sx = [-w * 0.42, w * 0.38, w * 0.05][i], sy = [-h * 0.95, -h * 0.85, -h * 1.25][i], r = w * 0.07 * a;
      g.fillStyle = 'rgba(255,255,255,' + a + ')'; g.beginPath(); g.moveTo(sx, sy - r); g.lineTo(sx + r * 0.25, sy - r * 0.25); g.lineTo(sx + r, sy); g.lineTo(sx + r * 0.25, sy + r * 0.25); g.lineTo(sx, sy + r); g.lineTo(sx - r * 0.25, sy + r * 0.25); g.lineTo(sx - r, sy); g.lineTo(sx - r * 0.25, sy - r * 0.25); g.closePath(); g.fill();
    }
    g.restore();
  }
  function iconCrown(g, x, y, r) { drawCrown(g, x, y + r * 0.7, r * 2.1, 0); }

  // ---------- HOOK: KDO MÁ KORUNU TÝDNE?
  HOOKS.crown = {
    land: 650,
    enter: function (s) {
      gcall('orbit', 0); gcall('overview', 16); later(function () { if (R.running) camTown(s.crown.name, 1800).then(function () { gcall('orbit', 0.3); }); }, 300);
      AU.riser(0, 0.6); AU.boom(this.land / 1000); AU.ping(this.land / 1000 + 0.05, 2200); AU.whoosh(s.dur / 1000 - 0.3, 0.6);
      loadAssets(s);
    },
    draw: function (g, s, lt) {
      var out = s.dur - 320, oa = 1 - prog(lt, out, out + 220), land = this.land;
      backdrop(g, lt, 0.4);
      var p = prog(lt, 120, land), y = lerp(-200, 840, E.inCubic(p)), sq = lt > land ? 1 + Math.sin(prog(lt, land, land + 260) * Math.PI) * 0.12 : 1;
      if (p > 0) { g.save(); g.globalAlpha = oa; g.translate(W / 2, y); g.scale(sq, 1 / sq); drawCrown(g, 0, 0, 320, lt); g.restore(); }
      if (s.reveal) {
        kLine(g, 'KORUNU TÝDNE MÁ', W / 2, 940, 60, lt, land + 80, { out: out, color: C.sky, stagger: 40 });
        kLine(g, up(s.crown.name), W / 2, 1075, 116, lt, land + 260, { out: out, color: C.acc });
        kLine(g, 'KDO ' + up(townPron(s.crown.name)) + ' JI VEZME?', W / 2, 1200, 54, lt, land + 600, { box: true, out: out + 40, stagger: 30 });
      } else {
        kLine(g, 'KDO MÁ', W / 2, 970, 106, lt, land + 60, { out: out });
        kLine(g, 'KORUNU TÝDNE?', W / 2, 1100, 100, lt, land + 240, { color: C.acc, out: out + 30 });
      }
      flash(g, lt, land, 0.4);
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

  // ---------- POČÍTADLO
  SCENES.overview = {
    enter: function (s) {
      gcall('orbit', 0);
      gcall('overview', 1700).then(function () { gcall('orbit', 0.12); });
      AU.ping(0.5, 1180); R.lastCount = -1;
    },
    draw: function (g, s, lt) {
      backdrop(g, lt, 0.4);
      var out = s.dur - 300;
      kLine(g, 'ZATÍM NÁS JE', W / 2, 460, 84, lt, 80, { out: out });
      var p = E.outCubic(prog(lt, 500, 2600)), val = lerp(s.from, s.to, p);
      var ap = prog(lt, 420, 420 + POP), a = popA(ap) * (1 - prog(lt, out, out + 250));
      if (a > 0) {
        g.save(); g.globalAlpha = a; g.translate(W / 2, 700); g.scale(popS(ap), popS(ap));
        glass(g, -380, -170, 760, 340, 20);
        odometer(g, val, 0, -30, 220, C.acc);
        bf(g, 30, 600); g.fillStyle = 'rgba(255,255,255,0.8)'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(plural(s.to, 'obyvatel', 'obyvatelé', 'obyvatel') + ' Říčanska', 0, 110);
        g.restore();
        var cur = Math.floor(val); if (cur !== R.lastCount && lt < 2650) { if (R.lastCount >= 0 && lt - (R._lastTick || 0) > 45) { AU.tick(0, 1900 + (cur % 7) * 90); R._lastTick = lt; } R.lastCount = cur; }
      }
      var items = [{ t: '+' + s.n + ' dnes' }, { t: s.towns + ' ' + plural(s.towns, 'obec', 'obce', 'obcí') }];
      if (s.expanded) items.push({ t: 'nové území', solid: true });
      var co = 1 - prog(lt, out, out + 250), widths = [], gap = 20;
      items.forEach(function (it) { bf(g, 34, 700); widths.push(chipWidth(g, it.t, 34, it.solid)); });
      var tot = widths.reduce(function (a2, b) { return a2 + b; }, 0) + gap * (items.length - 1), x = W / 2 - tot / 2;
      items.forEach(function (it, i) {
        var pi = prog(lt, 2300 + i * 110, 2300 + i * 110 + POP);
        if (pi > 0) chip(g, it.t, x, 960 - (1 - E.outCubic(pi)) * 120, { size: 34, solid: it.solid, align: 'left', scale: popS(pi), alpha: popA(pi) * co });
        x += widths[i] + gap;
      });
      if (lt > 2300 && !s._p) { s._p = 1; AU.pop(0, 700); }
    }
  };
  function chipWidth(g, text, size, solid) {
    var parts = String(text).split(' '), tw = 0, sp = size * 0.28;
    parts.forEach(function (p) { var num = !solid && /^[+#]?\d[\d\s/]*%?$/.test(p); if (num) { hf(g, size * 1.1, 800); tw += hw(g, p); } else { bf(g, size, 700); tw += g.measureText(p).width; } });
    return tw + sp * (parts.length - 1) + size * 1.5;
  }

  // ---------- TOP OBEC
  SCENES.town = {
    enter: function (s) {
      gcall('orbit', 0);
      gcall('focusTown', s.name, 1150).then(function () { gcall('orbit', 0.22); });
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
      backdrop(g, lt, 0.38);
      var out = s.dur - 300, oa = 1 - prog(lt, out, out + 200);
      reticle(g, W / 2, townY(), lt, C.acc);
      var rp = prog(lt, 60, 60 + POP);
      chip(g, '#' + s.rank + ' dnešní přírůstek', W / 2, 390, { size: 32, solid: s.rank === 1, scale: popS(rp), alpha: popA(rp) * oa });
      var ep = prog(lt, 120, 120 + POP), eo = prog(lt, out, out + 260);
      if (ep > 0 && eo < 1) {
        var es = popS(ep) * (1 - E.inCubic(eo)), ew = 160, eh = 192, ex = W / 2, ey = 560;
        g.save(); g.globalAlpha = popA(ep); g.translate(ex, ey); g.rotate(Math.sin(lt / 420) * 0.03); g.scale(es, es);
        g.shadowColor = 'rgba(0,0,0,0.45)'; g.shadowBlur = 40; g.shadowOffsetY = 14;
        if (s.img) g.drawImage(s.img, -ew / 2, -eh / 2, ew, eh); else shield(g, -ew / 2, -eh / 2, ew, eh, C.blue, up(s.name)[0]);
        g.restore();
      }
      kLine(g, up(s.name), W / 2, 775, 110, lt, 260, { out: out, stagger: 50 });
      var pp = prog(lt, 560, 560 + POP);
      if (pp > 0) {
        var cnt = Math.round(lerp(0, s.n, E.outCubic(prog(lt, 600, 1300))));
        numCard(g, W / 2, 940, 420, 170, '+' + cnt, plural(s.n, 'obyvatel', 'obyvatelé', 'obyvatel'), { p: pp, alpha: oa, numSize: 84, labelSize: 26 });
      }
      var tier = TIERS[s.tier] || TIERS.wood, tp = prog(lt, 900, 900 + POP);
      if (tp > 0) chip(g, tier.label, W / 2, 1100, { size: 28, scale: popS(tp), alpha: popA(tp) * oa, icon: iconStar(C.acc) });
    }
  };

  // ---------- CHTĚLI JSTE → POSTAVILI JSME (chat bubliny)
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
      var out = s.dur - 300, oa = 1 - prog(lt, out, out + 220);
      if (s._buildAt == null) s._buildAt = s.building ? Math.max(1800, wordStart(s, /^Tak$/, s.dur * 0.5) - 150) : Math.max(2200, s.dur * 0.56);
      backdrop(g, lt, 0.48);
      var lp = prog(lt, 50, 50 + POP);
      stamp(g, s.building ? 'CHTĚLI JSTE' : 'TOP KOMENTÁŘ', 300, 400, { size: 40, p: lp, alpha: oa, rot: -0.07 });
      // bublina komentáře (vlevo)
      var cp = prog(lt, 150, 150 + POP), co = prog(lt, out, out + 260);
      if (cp > 0 && co < 1) {
        var bw = 860, x = 80; bf(g, 44, 600);
        var lines = wrap(g, s.text, bw - 68); if (lines.length > 4) { bf(g, 36, 600); lines = wrap(g, s.text, bw - 68); }
        var y = 470, e = popS(cp), big = lines.length <= 4;
        s._bh = 68 + 92 + lines.length * (big ? 56 : 46) + 58;
        var lk = Math.round(lerp(0, s.likes, E.outCubic(prog(lt, 700, 1700)))), bump = 1 + Math.max(0, Math.sin(prog(lt, 1600, 1900) * Math.PI)) * 0.3;
        g.save(); g.globalAlpha = popA(cp) * (1 - co);
        g.translate(x, y + 60 - E.inCubic(co) * 120); g.scale(e, e); g.translate(-x, -(y + 60));
        bubble(g, x, y, bw, lines, {
          side: 'left', head: '@' + s.author, sub: 'nejlajkovanější komentář dne', avatarImg: s._av, size: big ? 44 : 36, lh: big ? 56 : 46,
          reveal: prog(lt, 450, 450 + lines.length * 220),
          foot: function (g2, fx, fy, fw) {
            heart(g2, fx + 18, fy, 34 * bump, C.white);
            hf(g2, 36, 800); g2.fillStyle = C.acc; g2.textAlign = 'left'; g2.textBaseline = 'middle'; htext(g2, fmt(lk), fx + 50, fy + 1);
            bf(g2, 26, 500); g2.fillStyle = 'rgba(255,255,255,0.55)'; g2.textAlign = 'right'; g2.fillText('Odpovědět', fx + fw, fy);
          }
        });
        g.restore();
      }
      if (s.building) {
        var b0 = s._buildAt, bp = prog(lt, b0, b0 + POP), bo = 1 - prog(lt, out, out + 220);
        if (bp > 0) {
          var yb = Math.min(1110, 470 + (s._bh || 400) + 110), sh = shakeAt(lt, b0, 8);
          g.save(); g.translate(sh[0], sh[1]);
          stamp(g, 'TAK JSME POSTAVILI', W / 2 + 60, yb, { size: 40, p: bp, alpha: bo });
          kLine(g, up(s.building.name), W / 2, yb + 130, 88, lt, b0 + 180, { out: out, maxW: 960, color: C.acc });
          if (prog(lt, b0 + 380, b0 + 700) > 0) { g.save(); g.globalAlpha = prog(lt, b0 + 380, b0 + 700) * bo; bf(g, 32, 600); g.fillStyle = 'rgba(255,255,255,0.8)'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('v obci ' + s.building.town, W / 2, yb + 212); g.restore(); }
          g.restore();
        }
      }
    }
  };

  // ---------- POVOLÁNÍ: „MUKAŘOVU CHYBÍ 1 HASIČ!“ (číselná karta + progress + chip)
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
      backdrop(g, lt, 0.45);
      var cp = prog(lt, 40, 40 + POP);
      chip(g, up(jobForm(s.job, 'pl')) + ' · ' + up(s.town), W / 2, 395, { size: 28, scale: popS(cp), alpha: popA(cp) * oa });
      kLine(g, s.line1, W / 2, 560, 112, lt, 120, { out: out });
      kLine(g, s.line2, W / 2, 690, 96, lt, 300, { color: C.acc, out: out + 30, stagger: 50 });
      // číselná karta 4/5 + progress
      var kp = prog(lt, 420, 420 + POP), ko = prog(lt, out, out + 260);
      if (kp > 0 && ko < 1) {
        var fp = E.outCubic(prog(lt, 700, 700 + 160 * s.count + 300)), shownC = Math.round(lerp(0, s.count, fp));
        var cw = 760, chh = 290, cx = W / 2, cy = 920 - E.inCubic(ko) * 120;
        g.save(); g.globalAlpha = popA(kp) * (1 - ko); g.translate(cx, cy); g.scale(popS(kp), popS(kp));
        glass(g, -cw / 2, -chh / 2, cw, chh, 20);
        hf(g, 120, 800); g.textAlign = 'center'; g.textBaseline = 'middle';
        var wN = hw(g, String(shownC)); hf(g, 64, 800); var wS = hw(g, '/' + s.need); hf(g, 120, 800); var w0 = wN + 8 + wS;
        g.fillStyle = C.acc; htext(g, String(shownC), -w0 / 2 + wN / 2, -38);
        hf(g, 64, 800); g.fillStyle = 'rgba(255,255,255,0.8)'; htext(g, '/' + s.need, -w0 / 2 + wN + 8 + wS / 2, -24);
        bf(g, 28, 600); g.fillStyle = 'rgba(255,255,255,0.8)'; g.fillText(jobForm(s.job, s.need) + ' · cíl: ' + s.building, 0, 46);
        var bx = -cw / 2 + 40, by = 92, bw = cw - 80, bh = 16;
        g.fillStyle = 'rgba(255,255,255,0.18)'; rr(g, bx, by, bw, bh, bh / 2); g.fill();
        var fw = bw * (s.count / s.need) * fp;
        if (fw > 2) { g.fillStyle = C.acc; rr(g, bx, by, Math.max(fw, bh), bh, bh / 2); g.fill(); }
        if (fp >= 1) { var pul = (Math.sin(lt / 160) + 1) / 2; g.fillStyle = 'rgba(198,255,61,' + (0.2 + pul * 0.35) + ')'; rr(g, bx + fw, by, bw / s.need, bh, bh / 2); g.fill(); }
        g.restore();
      }
      var ta = wordStart(s, /^Jsi$/i, 2600), ap = prog(lt, ta - 80, ta - 80 + POP), np = prog(lt, ta + 380, ta + 380 + POP);
      if (ap > 0) {
        bf(g, 38, 600); var qw = g.measureText(s.askText).width + 80, qx = W / 2 - qw / 2, qy = 1110;
        g.save(); g.globalAlpha = popA(ap) * oa; g.translate(W / 2, qy + 40); g.scale(popS(ap), popS(ap)); g.translate(-W / 2, -(qy + 40));
        bubble(g, qx, qy, qw, [s.askText], { side: 'right', size: 38, lh: 46, pad: 20 });
        g.restore();
      }
      if (np > 0) chip(g, 'napiš to do komentů', W / 2, 1255, { size: 34, solid: true, scale: popS(np), alpha: popA(np) * oa, icon: iconArrow(C.ink) });
    }
  };

  // ---------- POVOLÁNÍ HOTOVO: „HASIČI Z MNICHOVIC SI POSTAVILI HASIČÁRNU!“
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
      backdrop(g, lt, 0.45);
      var sh = shakeAt(lt, 500, 9);
      g.save(); g.translate(sh[0], sh[1]);
      stamp(g, 'NOVÁ BUDOVA', 320, 400, { size: 40, p: prog(lt, 40, 40 + POP), alpha: oa, rot: -0.07 });
      kLine(g, s.head, W / 2, 540, 86, lt, 120, { out: out, stagger: 40 });
      kLine(g, 'SI POSTAVILI', W / 2, 650, 68, lt, 300, { out: out + 20, color: C.sky, stagger: 40 });
      kLine(g, s.acc + '!', W / 2, 800, 140, lt, 500, { color: C.acc, out: out + 40, maxW: 980 });
      if (s.name && up(s.name) !== up(s.building)) { var np = prog(lt, 820, 820 + POP); chip(g, s.name, W / 2, 945, { size: 34, scale: popS(np), alpha: popA(np) * oa }); }
      g.restore();
      var ep = prog(lt, 1500, 1500 + POP);
      if (ep > 0) numCard(g, W / 2, 1120, 620, 200, s.need + ' = 1', s.eqText, { p: ep, alpha: oa, numSize: 96, labelSize: 26 });
      flash(g, lt, 500, 0.35);
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
      backdrop(g, lt, 0.38);
      stamp(g, 'MILNÍK', 240, 400, { size: 40, p: prog(lt, 40, 40 + POP), alpha: oa, rot: -0.07 });
      kLine(g, 'OBYVATEL Č.', W / 2, 530, 90, lt, 120, { out: out });
      var p = E.outCubic(prog(lt, 300, land)), val = lerp(0, s.no, p), a = prog(lt, 280, 420) * oa;
      if (a > 0) {
        var cur = Math.floor(val); if (cur !== R.lastCount && lt < land + 30) { if (lt - (R._lastTick || 0) > 45) { AU.tick(0, 1900 + (cur % 7) * 90); R._lastTick = lt; } R.lastCount = cur; }
        var bump = 1 + Math.sin(prog(lt, land, land + 300) * Math.PI) * 0.14;
        g.save(); g.globalAlpha = a; g.translate(W / 2, 700); g.scale(bump, bump);
        odometer(g, lt >= land ? s.no : val, 0, 0, 230, C.acc);
        g.restore();
      }
      if (s.house) reticle(g, W / 2, houseY(), lt - 300, C.acc);
      var np = prog(lt, land + 100, land + 100 + POP);
      if (np > 0 && s.owner) chip(g, s.owner, W / 2, 1160, { size: 42, solid: true, scale: popS(np), alpha: popA(np) * oa });
      var tp = prog(lt, land + 300, land + 600) * oa;
      if (tp > 0 && s.town) { g.save(); g.globalAlpha = tp; bf(g, 34, 600); g.fillStyle = 'rgba(255,255,255,0.8)'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('z ' + townGen(s.town), W / 2, 1240); g.restore(); }
      flash(g, lt, land, 0.3);
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
      backdrop(g, lt, 0.36);
      var pp = prog(lt, drop - 420, drop);
      if (pp > 0) {
        for (var k = 0; k < 3 && lt > drop; k++) {
          var q = ((lt - drop) / 1300 + k / 3) % 1;
          g.save(); g.globalAlpha = (1 - q) * 0.8 * oa; g.strokeStyle = C.acc; g.lineWidth = 5;
          g.beginPath(); g.ellipse(W / 2, ty, 40 + q * 260, (40 + q * 260) * 0.42, 0, 0, 7); g.stroke(); g.restore();
        }
        var yy = lerp(-300, ty, E.inCubic(pp)), sq = lt > drop ? 1 - Math.sin(prog(lt, drop, drop + 260) * Math.PI) * 0.18 : 1;
        g.save(); g.globalAlpha = oa; g.translate(W / 2, yy); g.scale(1 / sq, sq); pin(g, 0, 0, 100, C.acc, 'house'); g.restore();
      }
      stamp(g, 'NOVÁ OBEC', 270, 400, { size: 40, p: prog(lt, 40, 40 + POP), alpha: oa, rot: -0.07 });
      var ep = prog(lt, 160, 160 + POP), eo = prog(lt, out, out + 260);
      if (ep > 0 && eo < 1) {
        var es = popS(ep) * (1 - E.inCubic(eo)), ew = 150, eh = 180, img = s._img && s._img.erb;
        g.save(); g.globalAlpha = popA(ep); g.translate(W / 2, 580); g.rotate(Math.sin(lt / 420) * 0.03); g.scale(es, es);
        g.shadowColor = 'rgba(0,0,0,0.45)'; g.shadowBlur = 40; g.shadowOffsetY = 14;
        if (img) g.drawImage(img, -ew / 2, -eh / 2, ew, eh); else shield(g, -ew / 2, -eh / 2, ew, eh, C.blue, up(s.name)[0]);
        g.restore();
      }
      kLine(g, up(s.name), W / 2, 775, 124, lt, 300, { out: out, color: C.acc });
      var fp = prog(lt, drop + 100, drop + 100 + POP);
      if (fp > 0) chip(g, s.first ? '1. obyvatel ' + s.first : 'má prvního obyvatele', W / 2, 880, { size: 32, scale: popS(fp), alpha: popA(fp) * oa });
      if (s.others && s.others.length) {
        var op = prog(lt, drop + 400, drop + 700) * oa;
        if (op > 0) { g.save(); g.globalAlpha = op; bf(g, 30, 600); g.fillStyle = 'rgba(255,255,255,0.8)'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('a taky: ' + s.others.join(', '), W / 2, ty + 85); g.restore(); }
      }
      flash(g, lt, drop, 0.25);
    }
  };

  // ---------- NAJDI SE VE VIDEU (průlet domky, nicky jako glass chipy)
  SCENES.findMe = {
    start: 280,
    enter: function (s) { s._cut = -1; gcall('orbit', 0); AU.ping(0.02, 1320); if (!s.items.some(function (i) { return i.house; })) gcall('overview', 900); },
    draw: function (g, s, lt) {
      var out = s.dur - 260, oa = 1 - prog(lt, out, out + 200), cy = houseY();
      var res = s.items.filter(function (i) { return i.house; });
      backdrop(g, lt, 0.3);
      if (res.length) {
        var per = Math.max(520, (s.dur - this.start - 300) / res.length), k = clamp(Math.floor((lt - this.start) / per), 0, res.length - 1);
        if (lt >= this.start && k !== s._cut) {
          s._cut = k; camHouse(res[k].house, R.opts.findDist || 40, Math.min(380, per * 0.6));
          if (R.running) { AU.tick(0, 2600); AU.whoosh(0, 0.28); AU.pop(0.3, 760 + k * 60); }
        }
        var loc = lt - this.start - k * per, it = res[k];
        if (lt >= this.start) {
          flash(g, loc, 0, 0.3);
          var bp = E.outCubic(prog(loc, 0, 300)), hs = lerp(230, 150, bp);
          g.save(); g.globalAlpha = oa; brackets(g, W / 2, cy, hs, hs, 50, 7, C.acc); g.restore();
          var lp = prog(loc, 180, 180 + POP);
          if (lp > 0) {
            chip(g, it.nick, W / 2, cy - 236, { size: 44, scale: popS(lp), alpha: popA(lp) * oa });
            if (it.town) { g.save(); g.globalAlpha = prog(loc, 300, 500) * oa; bf(g, 30, 700); g.fillStyle = C.white; g.shadowColor = 'rgba(5,10,30,0.85)'; g.shadowBlur = 14; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(it.town, W / 2, cy + 212); g.restore(); }
          }
          g.save(); g.globalAlpha = oa;
          for (var d = 0; d < res.length; d++) { g.fillStyle = d === k ? C.acc : 'rgba(255,255,255,0.4)'; g.beginPath(); g.arc(W / 2 + (d - (res.length - 1) / 2) * 34, cy + 262, d === k ? 9 : 6, 0, 7); g.fill(); }
          g.restore();
        }
      } else {
        s.items.forEach(function (it2, i) {
          var p = prog(lt, 300 + i * 220, 300 + i * 220 + POP); if (p <= 0) return;
          chip(g, it2.nick, 200 + rnd('fx' + i) * 680, 700 + i * (560 / Math.max(1, s.items.length)), { size: 38, solid: i % 2 === 0, scale: popS(p), alpha: popA(p) * oa });
        });
      }
      kLine(g, 'NAJDI SE', W / 2, 410, 92, lt, 20, { out: out });
      kLine(g, 'VE VIDEU', W / 2, 520, 56, lt, 180, { solid: true, out: out + 30, stagger: 30 });
    }
  };

  // ---------- KORUNA TÝDNE
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
      backdrop(g, lt, 0.42);
      stamp(g, 'KORUNA TÝDNE', 300, 400, { size: 40, p: prog(lt, 40, 40 + POP), alpha: oa, rot: -0.07 });
      var ep = prog(lt, 100, 100 + POP), eo = prog(lt, out, out + 260), img = s._img && s._img.erb;
      if (ep > 0 && eo < 1) {
        var es = popS(ep) * (1 - E.inCubic(eo)), ew = 170, eh = 204, ey = 700;
        g.save(); g.globalAlpha = popA(ep); g.translate(W / 2, ey); g.rotate(Math.sin(lt / 420) * 0.03); g.scale(es, es);
        g.shadowColor = 'rgba(0,0,0,0.45)'; g.shadowBlur = 40; g.shadowOffsetY = 14;
        if (img) g.drawImage(img, -ew / 2, -eh / 2, ew, eh); else shield(g, -ew / 2, -eh / 2, ew, eh, C.blue, up(s.name)[0]);
        g.restore();
        var p = prog(lt, 300, land), cy = lerp(200, ey - eh / 2 + 18, E.inCubic(p)), sq = lt > land ? 1 + Math.sin(prog(lt, land, land + 240) * Math.PI) * 0.14 : 1;
        if (p > 0) { g.save(); g.globalAlpha = 1 - eo; g.translate(W / 2, cy); g.rotate(-0.08 * (1 - p) + Math.sin(lt / 500) * 0.02); g.scale(sq * es, es / sq); drawCrown(g, 0, 0, 180, lt); g.restore(); }
      }
      kLine(g, 'KORUNU TÝDNE MÁ', W / 2, 890, 58, lt, land - 150, { out: out, color: C.sky, stagger: 40 });
      kLine(g, up(s.name), W / 2, 1020, 118, lt, land + 50, { out: out, color: C.acc });
      var wp = prog(lt, land + 350, land + 350 + POP);
      if (wp > 0 && s.week) chip(g, '+' + s.week + ' za týden', W / 2, 1105, { size: 34, scale: popS(wp), alpha: popA(wp) * oa });
      kLine(g, 'KDO ' + up(s.pron) + ' JI VEZME?', W / 2, 1240, 60, lt, wordStart(s, /^Kdo$/i, land + 1400) - 100, { box: true, out: out + 40, stagger: 30 });
      flash(g, lt, land, 0.3);
      confetti(g, lt, { t0: land, x: W / 2, y: 600, n: 60, seed: 'cr', spread: 3 });
    }
  };

  // ---------- OTEVŘENÁ SMYČKA + SLIB + CTA
  SCENES.cta = {
    enter: function (s) {
      gcall('orbit', 0);
      gcall('overview', 1500).then(function () { gcall('orbit', 0.16); });
      AU.ping(0.1, 1320); AU.pop(0.5, 700);
      var td = wordStart(s, /^Dej$/i, 2400) / 1000; AU.ping(td, 1760); AU.pop(td + 0.5, 800); AU.pop(td + 1.0, 900);
    },
    draw: function (g, s, lt) {
      backdrop(g, lt, 0.5);
      var out = s.dur - 260, oa = 1 - prog(lt, out, out + 200);
      var tQ = wordStart(s, /^Co$/i, 1200), tD = wordStart(s, /^Dej$/i, 2400), tN = wordStart(s, /^napiš$/i, tD + 500), tM = wordStart(s, /^máš$/i, tN + 1200);
      // 1) otevřená smyčka
      kLine(g, 'ZÍTRA STAVÍME', W / 2, 640, 106, lt, 60, { out: tQ - 260 });
      kLine(g, 'TOP KOMENTÁŘ', W / 2, 775, 118, lt, 260, { out: tQ - 220, color: C.acc });
      var cp = prog(lt, tQ - 200, tQ - 200 + POP);
      chip(g, 'zítra stavíme top komentář', W / 2, 395, { size: 28, scale: popS(cp), alpha: popA(cp) * oa, icon: iconStar(C.acc) });
      kLine(g, 'CO TO BUDE?', W / 2, 545, 122, lt, tQ - 120, { out: out });
      // vedoucí komentář (bublina vlevo)
      if (s.next) {
        var mp = prog(lt, tQ + 150, tQ + 150 + POP), mo = prog(lt, tD - 150, tD + 150);
        if (mp > 0 && mo < 1) {
          var bw = 760, bx = 80; bf(g, 34, 600);
          var lines = wrap(g, s.next.text, bw - 68).slice(0, 2);
          g.save(); g.globalAlpha = popA(mp) * (1 - mo) * oa; g.translate(bx, 700); g.scale(popS(mp), popS(mp)); g.translate(-bx, -700);
          bubble(g, bx, 640, bw, lines, { side: 'left', head: '@' + s.next.author, sub: (s.next.likes ? '♥ ' + s.next.likes + ' · ' : '') + 'zatím vede', size: 34, lh: 44, pad: 28 });
          g.restore();
        }
      }
      // 2) slib: dej follow (chip) + bublina „napiš obec a povolání do komentů ↓“ + = DOMEK S TVÝM JMÉNEM
      var fp = prog(lt, tD - 60, tD - 60 + POP);
      if (fp > 0) chip(g, 'dej follow', 300, 660, { size: 40, solid: true, scale: popS(fp), alpha: popA(fp) * oa, icon: iconCheck(C.ink) });
      var bp2 = prog(lt, tN - 120, tN - 120 + POP);
      if (bp2 > 0) {
        var w2 = 720, x2 = W - 80 - w2;
        g.save(); g.globalAlpha = popA(bp2) * oa; g.translate(x2 + w2, 800); g.scale(popS(bp2), popS(bp2)); g.translate(-(x2 + w2), -800);
        bubble(g, x2, 740, w2, ['napiš svou obec', 'do komentů ↓'], { side: 'right', size: 40, lh: 52, pad: 30 });
        g.restore();
      }
      // psaní komentáře (ukázka)
      var tIn = tN + 380, ip = prog(lt, tIn, tIn + POP);
      if (ip > 0) {
        var iw = 820, ih = 104, ix = (W - iw) / 2, iy = 985;
        g.save(); g.globalAlpha = popA(ip) * oa; g.translate(W / 2, iy + ih / 2); g.scale(popS(ip), popS(ip)); g.translate(-W / 2, -(iy + ih / 2));
        glass(g, ix, iy, iw, ih, ih / 2, { dark: 0.6 });
        g.fillStyle = C.blue; g.beginPath(); g.arc(ix + 56, iy + ih / 2, 34, 0, 7); g.fill();
        hf(g, 26, 800); g.fillStyle = C.white; g.textAlign = 'center'; g.textBaseline = 'middle'; htext(g, 'TY', ix + 56, iy + ih / 2 + 1);
        var tT = tIn + 250, per = 1300, k = Math.floor(Math.max(0, lt - tT) / per), name = s.sample[k % s.sample.length], ph = (Math.max(0, lt - tT) % per) / per;
        var typed = name.slice(0, Math.ceil(clamp(ph / 0.55, 0, 1) * name.length));
        if (ph > 0.85) typed = name.slice(0, Math.ceil((1 - (ph - 0.85) / 0.15) * name.length));
        if (lt < tT) typed = '';
        g.textAlign = 'left'; bf(g, 40, 600); g.fillStyle = typed ? C.white : 'rgba(255,255,255,0.5)';
        g.fillText(typed || 'Přidej komentář…', ix + 112, iy + ih / 2 + 2);
        if (typed && Math.floor(lt / 260) % 2 === 0) { var cw2 = g.measureText(typed).width; g.fillStyle = C.acc; g.fillRect(ix + 116 + cw2, iy + 28, 4, ih - 56); }
        bf(g, 32, 700); g.fillStyle = typed ? C.acc : 'rgba(255,255,255,0.35)'; g.textAlign = 'right'; g.fillText('Zveřejnit', ix + iw - 40, iy + ih / 2 + 2);
        g.restore();
        if (typed && typed !== s._lastTyped) { if (typed.length > (s._lastTyped || '').length) AU.tick(0, 3000 + typed.length * 40); s._lastTyped = typed; }
        if (!typed) s._lastTyped = '';
      }
      kLine(g, '= DOMEK S TVÝM JMÉNEM', W / 2, 1180, 56, lt, Math.max(tM - 150, tIn + 300), { solid: true, out: out + 40, stagger: 30 });
    }
  };

  // ---------- OUTRO (Noc, logo, zítra den X+1; poslední snímek se vrací k prvnímu)
  SCENES.outro = {
    enter: function (s) {
      gcall('orbit', 0.4);
      AU.boom(0.05); AU.ping(0.12, 1480); AU.stopMusic(s.dur / 1000);
    },
    draw: function (g, s, lt) {
      var p = E.inOut(prog(lt, 0, 420)), back = prog(lt, s.dur - 420, s.dur - 60);
      // plný Noc podklad se rozbalí zespodu (a na konci zase ustoupí – smyčka na hook)
      var cover = p * (1 - back);
      g.save(); g.beginPath(); g.rect(0, H * (1 - cover), W, H * cover); g.clip();
      g.fillStyle = C.night; g.fillRect(0, 0, W, H);
      backdrop(g, lt + 5000, 0, {});
      g.restore();
      if (back > 0) backdrop(g, lt, 0.3 * back, { blobs: false });
      var vis = 1 - back;
      g.save(); g.globalAlpha = vis;
      var lp = prog(lt, 260, 260 + POP);
      if (lp > 0) {
        g.save(); g.translate(W / 2, H / 2 - 70); g.scale(popS(lp), popS(lp)); g.globalAlpha *= popA(lp);
        hf(g, 230, 800); try { g.letterSpacing = '0.04em'; } catch (e) {} g.fillStyle = C.white; g.textAlign = 'center'; g.textBaseline = 'middle'; htext(g, 'RADAR', 0, 0);
        g.restore();
      }
      var sp = prog(lt, 520, 520 + POP);
      if (sp > 0) { g.save(); g.globalAlpha *= popA(sp); bf(g, 40, 600); g.fillStyle = 'rgba(255,255,255,0.85)'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('Postav si Říčansko', W / 2, H / 2 + 100); g.restore(); }
      var dp = prog(lt, 760, 760 + POP);
      if (dp > 0) chip(g, 'ZÍTRA DEN ' + (s.day + 1), W / 2, H / 2 + 230, { size: 40, solid: true, scale: popS(dp), alpha: popA(dp) });
      if (s.handle) { var hp = prog(lt, 1000, 1200); if (hp > 0) { g.save(); g.globalAlpha *= hp; bf(g, 34, 600); g.fillStyle = 'rgba(255,255,255,0.7)'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(s.handle, W / 2, H / 2 + 340); g.restore(); } }
      g.restore();
    }
  };

  function wordStart(s, re, def) { var w = (s.words || []).filter(function (x) { return re.test(x.w); })[0]; return w ? w.start : def; }

  // ---- perzistentní UI: progress (6 segmentů), logo RADAR vlevo, časový kód vpravo
  function drawChrome(g, t, sc) {
    var script = R.script, sType = sc && sc.type, lt = t - sc.t0;
    var appear = sType === 'hook' ? E.outCubic(prog(lt, 400, 800)) : sType === 'outro' ? 1 - prog(lt, 0, 300) + prog(lt, sc.dur - 420, sc.dur - 60) : 1;
    if (appear <= 0) return;
    var n = script.scenes.length, frac = clamp((sc.idx + clamp(lt / sc.dur, 0, 1)) / n, 0, 1);
    g.save(); g.globalAlpha = appear;
    // progress bar
    var segs = 6, gap = 8, x0 = 56, bw = W - 112, sw = (bw - gap * (segs - 1)) / segs, y = 230, fill = frac * segs;
    for (var i = 0; i < segs; i++) {
      var x = x0 + i * (sw + gap), f = clamp(fill - i, 0, 1);
      g.fillStyle = 'rgba(255,255,255,0.22)'; rr(g, x, y, sw, 4, 2); g.fill();
      if (f > 0) { g.fillStyle = C.acc; rr(g, x, y, sw * f, 4, 2); g.fill(); }
    }
    // logo + časový kód
    hf(g, 40, 800); try { g.letterSpacing = '0.04em'; } catch (e) {}
    g.fillStyle = C.white; g.textBaseline = 'middle'; g.textAlign = 'left';
    g.shadowColor = 'rgba(0,0,0,0.45)'; g.shadowBlur = 14; htext(g, 'RADAR', 56, 300);
    var sec = Math.floor(t / 1000), tc = Math.floor(sec / 60) + ':' + (sec % 60 < 10 ? '0' : '') + (sec % 60);
    bf(g, 30, 600); g.textAlign = 'right'; g.fillStyle = 'rgba(255,255,255,0.85)'; g.fillText(tc, W - 56, 300);
    g.restore();
  }

  // ---- titulky karaoke: Archivo 700, aktuální slovo na akcentu, odeznělá bílá, budoucí .45
  function drawSubs(g, t, sc) {
    if (!sc || !sc.chunks || !sc.chunks.length || sc.noSubs || sc.type === 'hook' || sc.type === 'outro' || R.opts.subtitles === false) return;
    var lt = t - sc.t0, ws = sc.words, ci = -1, wi = -1;
    var live = R.live && R.live.scene === sc.idx && R.live.started ? R.live : null;
    if (live) {
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
    var pop = prog(t - R._chunkAt, 0, 180), sc2 = popS(pop);
    var words = ch.map(function (j) { return subDisplay(ws[j].w); });
    var disp = [], map = [];
    for (var a = 0; a < words.length; a++) {
      if (words[a] === '+' && a + 1 < words.length) { disp.push('+' + words[a + 1]); map.push([ch[a], ch[a + 1]]); a++; }
      else { disp.push(words[a]); map.push([ch[a]]); }
    }
    var size = 66, padX = 10, sp = 22;
    var text = disp.join(' '); size = hfit(g, text, 900 - padX * 2 * disp.length, size, 700, 44); hf(g, size, 700);
    var widths = disp.map(function (w) { return hw(g, w); });
    var tot = widths.reduce(function (x1, y1) { return x1 + y1; }, 0) + sp * (disp.length - 1) + padX * 2;
    var y = H - SAFE_BOTTOM - 160, x = W / 2 - tot / 2 + padX;
    g.save(); g.translate(W / 2, y); g.scale(sc2, sc2); g.translate(-W / 2, -y);
    g.globalAlpha = popA(pop);
    g.textBaseline = 'middle'; g.textAlign = 'left';
    for (var d = 0; d < disp.length; d++) {
      var active = map[d].indexOf(wi) >= 0, spoken = map[d][0] <= wi;
      if (active) { g.fillStyle = C.acc; rr(g, x - padX, y - size * 0.6, widths[d] + padX * 2, size * 1.2, 8); g.fill(); g.fillStyle = C.ink; hf(g, size, 700); htext(g, disp[d], x, y + 1); }
      else { g.save(); g.globalAlpha *= spoken ? 1 : 0.45; g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowBlur = 14; g.shadowOffsetY = 4; g.fillStyle = C.white; hf(g, size, 700); htext(g, disp[d], x, y + 1); g.restore(); }
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
  // střih: krátký dip do Noci (2 × 90 ms) na hranici scén
  function dip(g, a) { if (a > 0) { g.fillStyle = 'rgba(10,18,51,' + clamp(a, 0, 1) + ')'; g.fillRect(0, 0, W, H); } }
  function renderFrame(t) {
    var g = R.g, sc = sceneAt(t), lt = t - sc.t0;
    try { g.fontStretch = 'normal'; g.letterSpacing = '0px'; } catch (e) {}
    drawGame(g);
    var S = SCENES[sc.type];
    if (S && S.draw) { g.save(); S.draw(g, sc, lt); g.restore(); }
    var next = R.script.scenes[sc.idx + 1], DIP = 90;
    if (next && next.type !== 'outro' && sc.t0 + sc.dur - t < DIP) dip(g, 1 - (sc.t0 + sc.dur - t) / DIP);
    if (sc.type !== 'hook' && sc.type !== 'outro' && lt < DIP) dip(g, 1 - lt / DIP);
    drawChrome(g, t, sc);
    drawSubs(g, t, sc);
    if (R.opts.debugSafe) drawSafe(g);
    return sc;
  }

  function enterScene(sc) {
    var S = SCENES[sc.type];
    if (S && S.enter) try { S.enter(sc, R); } catch (e) { console.warn('[REEL] enter', sc.type, e); }
    if (sc.type !== 'hook' && sc.type !== 'outro') AU.whoosh(-0.05, 0.5);
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
    if (R.opts.fixedStep) { R.vt = (R.vt == null ? 0 : R.vt + R.opts.fixedStep); t = R.vt; }
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

  // ---- fonty: Archivo (Google Fonts) + Inter; bez sítě fallback na Inter/sans-serif + HX roztažení
  var FONTS_CSS = 'https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,500..900&family=Inter:wght@400;600;700&display=swap';
  function archivoLoaded() {
    try { var ok = false; document.fonts.forEach(function (f) { if (/archivo/i.test(f.family) && f.status === 'loaded') ok = true; }); return ok; } catch (e) { return false; }
  }
  function loadFonts(opts) {
    opts = opts || {};
    if (!document.fonts || !document.fonts.load) { HX = 1.08; return Promise.resolve(false); }
    if (R.fontsDone) return Promise.resolve(R.archivo);
    if (!R._fontLink && opts.fonts !== false && !document.querySelector('link[href*="family=Archivo"]')) {
      var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = FONTS_CSS; document.head.appendChild(l); R._fontLink = l;
    }
    var load = Promise.all(['800', '700'].map(function (w) { return document.fonts.load(w + ' 64px Archivo').catch(function () { return []; }); }))
      .then(function () { return document.fonts.ready; });
    return Promise.race([load, sleep(opts.fontTimeout || 3500)]).then(function () {
      R.archivo = archivoLoaded(); R.fontsDone = R.archivo;   // bez Archiva to zkusí při příštím play znovu
      HX = R.archivo ? 1 : 1.08;
      return R.archivo;
    });
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
    var jobs = [loadFonts(opts)];
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
