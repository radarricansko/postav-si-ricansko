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
  function G() { return root.GAME || null; }
  function gcall(name) {
    var g = G(), args = [].slice.call(arguments, 1);
    if (!g || typeof g[name] !== 'function') return Promise.resolve();
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
      this.master = c.createGain(); this.master.gain.value = 0.9;
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
        var t = this.ctx.currentTime;
        this.music.gain.cancelScheduledValues(t); this.music.gain.setValueAtTime(this.music.gain.value, t);
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
      if (!this.ctx) return; var c = this.ctx, t = c.currentTime + (dt || 0); dur = dur || 0.55;
      var n = this.noise(t, dur), bp = c.createBiquadFilter(), g = c.createGain();
      bp.type = 'bandpass'; bp.Q.value = 1.2;
      bp.frequency.setValueAtTime(300, t); bp.frequency.exponentialRampToValueAtTime(5200, t + dur * 0.6); bp.frequency.exponentialRampToValueAtTime(900, t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.7, t + dur * 0.55); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      n.connect(bp); bp.connect(g);
      if (c.createStereoPanner) { var p = c.createStereoPanner(); p.pan.setValueAtTime(-0.8, t); p.pan.linearRampToValueAtTime(0.8, t + dur); g.connect(p); p.connect(this.sfx); }
      else g.connect(this.sfx);
    },
    boom: function (dt) {
      if (!this.ctx) return; var c = this.ctx, t = c.currentTime + (dt || 0);
      var o = this.osc('sine', 110, t, 1.2), g = c.createGain();
      o.frequency.exponentialRampToValueAtTime(32, t + 0.9); this.env(g, t, 0.003, 1.0, 1.1); o.connect(g); g.connect(this.sfx);
      var n = this.noise(t, 0.5), lp = c.createBiquadFilter(), ng = c.createGain();
      lp.type = 'lowpass'; lp.frequency.setValueAtTime(3000, t); lp.frequency.exponentialRampToValueAtTime(200, t + 0.4);
      this.env(ng, t, 0.002, 0.6, 0.45); n.connect(lp); lp.connect(ng); ng.connect(this.sfx);
    },
    ping: function (dt, f) {
      if (!this.ctx) return; var c = this.ctx, t = c.currentTime + (dt || 0); f = f || 1320;
      var dl = c.createDelay(); dl.delayTime.value = 0.18; var fb = c.createGain(); fb.gain.value = 0.35;
      var g = c.createGain(); this.env(g, t, 0.002, 0.35, 0.7);
      var o1 = this.osc('sine', f, t, 0.9), o2 = this.osc('sine', f * 1.5, t, 0.5);
      o1.connect(g); o2.connect(g); g.connect(this.sfx); g.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(this.sfx);
      setTimeout(function () { try { fb.disconnect(); dl.disconnect(); } catch (e) {} }, (dt || 0) * 1000 + 2500);
    },
    tick: function (dt, f) {
      if (!this.ctx) return; var c = this.ctx, t = c.currentTime + (dt || 0);
      var o = this.osc('square', f || 2400, t, 0.03), g = c.createGain(); this.env(g, t, 0.001, 0.08, 0.025); o.connect(g); g.connect(this.sfx);
    },
    pop: function (dt, f) {
      if (!this.ctx) return; var c = this.ctx, t = c.currentTime + (dt || 0); f = f || 520;
      var o = this.osc('sine', f, t, 0.15), g = c.createGain(); o.frequency.exponentialRampToValueAtTime(f * 2.2, t + 0.08);
      this.env(g, t, 0.002, 0.3, 0.12); o.connect(g); g.connect(this.sfx);
    },
    riser: function (dt, dur) {
      if (!this.ctx) return; var c = this.ctx, t = c.currentTime + (dt || 0);
      var n = this.noise(t, dur), hp = c.createBiquadFilter(), g = c.createGain();
      hp.type = 'bandpass'; hp.Q.value = 2; hp.frequency.setValueAtTime(400, t); hp.frequency.exponentialRampToValueAtTime(7000, t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.35, t + dur * 0.95); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.05);
      n.connect(hp); hp.connect(g); g.connect(this.sfx);
    },
    playVoice: function () {
      if (!this.ctx || !this.voiceBuf) return;
      var s = this.ctx.createBufferSource(); s.buffer = this.voiceBuf; s.connect(this.voice); s.start(this.ctx.currentTime + 0.02);
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
  var DEFAULT_DUR = { hook: 2700, overview: 3800, town: 2400, comment: 5200, cta: 3400, outro: 2400 };
  var EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu;

  function scriptFromDay(day, opts) {
    opts = opts || {};
    day = day || {};
    var st = (G() && G().state) ? (function () { try { return G().state(); } catch (e) { return null; } })() : null;
    st = st || { day: day.day, totalPlayers: 0, towns: [] };
    var d = day.day || st.day || 1;
    var np = day.newPlayers || [];
    var townBy = {}; (st.towns || []).forEach(function (t) { townBy[t.name] = t; });
    // kolik nových hráčů už ve stavu hry je (podle owner)
    var owners = {}; (st.towns || []).forEach(function (t) { (t.houses || []).forEach(function (h) { owners[t.name + '|' + h.owner] = 1; }); });
    var already = np.filter(function (p) { return owners[p.town + '|' + p.owner]; }).length;
    var before = Math.max(0, (st.totalPlayers || 0) - already), after = before + np.length;
    var activeTowns = (st.towns || []).filter(function (t) { return t.players > 0; }).length;

    var groups = {};
    np.forEach(function (p) { (groups[p.town] = groups[p.town] || []).push(p); });
    var ranked = Object.keys(groups).map(function (k) { return { name: k, list: groups[k] }; })
      .sort(function (a, b) { return b.list.length - a.list.length || a.name.localeCompare(b.name, 'cs'); });
    var nTowns = opts.towns || (ranked.length >= 3 ? 3 : ranked.length);
    var top = ranked.slice(0, nTowns);
    var n = np.length;
    var variant = opts.hookVariant != null ? opts.hookVariant : (d % 3);

    var scenes = [];
    // 1) HOOK
    var hook = { type: 'hook', day: d, n: n, expanded: !!day.expanded, variant: variant, town: top[0] && top[0].name };
    if (day.expanded) {
      hook.kicker = 'DEN ' + d; hook.big = 'MAPA'; hook.big2 = 'SE ROZŠÍŘILA'; hook.sticker = '+' + n + ' ' + up(plural(n, 'nový soused', 'noví sousedé', 'nových sousedů'));
      hook.vo = 'Den ' + d + '. Mapa se právě rozšířila!';
    } else if (n === 0) {
      hook.kicker = 'DEN ' + d; hook.big = 'ZATÍM'; hook.big2 = 'JE TICHO…'; hook.sticker = 'BUDEŠ PRVNÍ?';
      hook.vo = 'Den ' + d + '. Zatím je ticho. Budeš první?';
    } else {
      hook.kicker = 'DEN ' + d;
      hook.big = '+' + n;
      hook.big2 = up(plural(n, 'nový soused', 'noví sousedé', 'nových sousedů'));
      hook.sticker = variant === 2 ? 'ZA POSLEDNÍCH 24 H' : 'ZA JEDINÝ DEN';
      hook.vo = [
        'Den ' + d + '. Za jediný den ' + plural(n, 'přibyl', 'přibyli', 'přibylo') + ' ' + n + ' ' + plural(n, 'nový soused', 'noví sousedé', 'nových sousedů') + '!',
        'Den ' + d + '. Říčansko zase roste!',
        'Den ' + d + '. Tohle se stalo za 24 hodin!'
      ][variant];
    }
    scenes.push(hook);

    // 2) PŘELET + POČÍTADLO
    scenes.push({
      type: 'overview', from: before, to: after, n: n, towns: activeTowns, expanded: !!day.expanded,
      vo: 'Zatím je nás ' + after + '. ' + (day.expanded ? 'A mapa má nové území!' : 'Každý má svůj domek.')
    });

    // 3) TOP OBCE
    var ordVo = ['Nejvíc roste {T}, plus {N}!', 'Druhé místo: {T}, plus {N}!', 'Třetí {T}, plus {N}!'];
    top.forEach(function (t, i) {
      var info = townBy[t.name] || {};
      scenes.push({
        type: 'town', rank: i + 1, name: t.name, n: t.list.length, list: t.list,
        tier: info.tier || 'wood', erbSvg: info.erbSvg || '', players: (info.players || 0),
        vo: ordVo[i].replace('{T}', t.name).replace('{N}', t.list.length)
      });
    });

    // 4) TOP KOMENTÁŘ + CO SE POSTAVÍ
    var tc = day.topComment;
    if (tc && tc.text) {
      var txt = String(tc.text).trim(); if (txt.length > 110) txt = txt.slice(0, 107).replace(/\s+\S*$/, '') + '…';
      var spoken = txt.replace(EMOJI, '').replace(/[„“"]/g, '').replace(/\s+/g, ' ').trim();
      if (spoken.length > 64) spoken = spoken.slice(0, 62).replace(/\s+\S*$/, '') + '…';
      var nb = day.newBuilding;
      var author = String(tc.author || 'anonym').replace(/^@/, '');
      var vo = 'Top komentář: ' + spoken + (/[.!?…]$/.test(spoken) ? ' ' : '. ');
      vo += nb ? 'A proto se staví: ' + nb.name + '!' : 'Co se postaví zítra? Rozhodneš ty!';
      scenes.push({ type: 'comment', noSubs: true, author: author, text: txt, likes: tc.likes || 0, avatar: tc.avatar || null, building: nb || null, vo: vo });
    }

    // 5) CTA + OUTRO
    var sample = (st.towns || []).map(function (t) { return t.name; });
    if (sample.length < 3) sample = ['Říčany', 'Mukařov', 'Strančice', 'Kunice', 'Mnichovice'];
    scenes.push({ type: 'cta', subsUntil: /^Napiš/i, sample: sample.slice(0, 8), vo: 'Chceš tu mít svůj domek? Napiš svou obec do komentářů!' });
    scenes.push({ type: 'outro', day: d, vo: 'Zítra den ' + (d + 1) + '. Sleduj Radar!', handle: opts.handle || '' });

    var script = { version: 1, day: d, title: 'Postav si Říčansko · Den ' + d, scenes: scenes, opts: opts };
    layout(script);
    return script;
  }

  // spočítá časy scén a titulků (deterministicky, sedí s voiceScript)
  function layout(script) {
    var t = 0;
    script.scenes.forEach(function (s, i) {
      s.voStart = s.voStart != null ? s.voStart : (s.type === 'hook' ? 180 : s.type === 'outro' ? 450 : 260);
      var tw = timeWords(s.vo || '', s.voStart);
      s.words = tw.words; s.chunks = chunkWords(s.words);
      var need = (s.vo ? tw.end : 0) + (s.type === 'outro' ? 700 : 300);
      s.dur = s.durFixed || Math.max(DEFAULT_DUR[s.type] || 3000, Math.round(need));
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
      segs.push({ scene: s.type, start: Math.round(a), end: Math.round(b), text: s.vo });
      lines.push('[' + (a / 1000).toFixed(1) + ' s – ' + (b / 1000).toFixed(1) + ' s]  ' + s.vo);
      s.chunks.forEach(function (ch, ci) {
        var w0 = s.words[ch[0]], w1 = s.words[ch[ch.length - 1]], nx = s.chunks[ci + 1];
        var end = nx ? Math.min(w1.end + 200, s.words[nx[0]].start - 20) : w1.end + 300;
        srt.push(k++ + '\n' + msToSrt(s.t0 + w0.start) + ' --> ' + msToSrt(s.t0 + end) + '\n' + ch.map(function (j) { return s.words[j].w; }).join(' ') + '\n');
      });
    });
    var head = 'RADAR · ' + script.title + ' · délka ' + (script.total / 1000).toFixed(1) + ' s\n' +
      'Voiceover (tykání, energicky, tempo cca 16 znaků/s). Časy = začátek–konec od začátku videa.\n\n';
    return { text: head + lines.join('\n') + '\n', plain: segs.map(function (s) { return s.text; }).join(' '), segments: segs, srt: srt.join('\n'), total: script.total };
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

  SCENES.hook = {
    enter: function (s, sc) {
      var st = safeState(), town = (st.towns || []).filter(function (t) { return t.name === s.town; })[0] || (st.towns || [])[0];
      var h = town && town.houses && town.houses[town.houses.length - 1];
      gcall('orbit', 0);
      (h ? gcall('focusHouse', h.id, 0) : gcall('overview', 0)).then(function () {
        setTimeout(function () { (town ? gcall('focusTown', town.name, 2300) : gcall('overview', 2300)).then(function () { gcall('orbit', 0.35); }); }, 120);
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
      chip(g, s.kicker, W / 2, 420, { size: 44, bg: C.yellow, color: C.ink, weight: 900, spacing: 4, scale: E.outBack(prog(lt, 0, 300)), alpha: prog(lt, 0, 120) });
      var out = s.dur - 340;
      var bigIsNum = /^\+\d/.test(s.big);
      kLine(g, s.big, W / 2, bigIsNum ? 790 : 690, bigIsNum ? 360 : 230, lt, 60, { color: C.yellow, out: out, punch: 2.2, stroke: 0 });
      kLine(g, s.big2, W / 2, bigIsNum ? 935 : 880, 112, lt, 300, { color: C.white, out: out + 40, stagger: 90 });
      kLine(g, s.sticker, W / 2, bigIsNum ? 1090 : 1050, 64, lt, 620, { sticker: C.white, color: C.ink, out: out + 80, punch: 1.3, stagger: 50 });
      g.restore();
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
      if (add.length) setTimeout(function () { gcall('addPlayers', s.name, add); }, 900);
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
      s._buildAt = Math.max(2200, s.dur * 0.56);
      if (s.building) { AU.riser(s._buildAt / 1000 - 0.6, 0.6); AU.boom(s._buildAt / 1000); }
      if (s.avatar && s._av === undefined) { s._av = null; loadImage(s.avatar).then(function (im) { s._av = im; }); }
    },
    draw: function (g, s, lt) {
      var out = s.dur - 300;
      if (s._buildAt == null) s._buildAt = Math.max(2200, s.dur * 0.56);
      grade(g, 0.6, 0.6, 0.3 * prog(lt, 0, 400) * (1 - prog(lt, out, out + 250)));
      // label
      var lp = E.outBack(prog(lt, 50, 380)), lo = 1 - prog(lt, out, out + 200);
      chip(g, 'TOP KOMENTÁŘ', W / 2, 400, {
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
          kLine(g, 'STAVÍ SE:', W / 2, yb, 56, lt, b0, { sticker: C.yellow, color: C.ink, out: out, punch: 1.4 });
          kLine(g, up(s.building.name), W / 2, yb + 130, 92, lt, b0 + 180, { out: out, maxW: 960 });
          if (prog(lt, b0 + 380, b0 + 700) > 0) {
            g.save(); g.globalAlpha = prog(lt, b0 + 380, b0 + 700) * bo; g.fillStyle = C.ice; g.font = font(40, 700); g.textAlign = 'center';
            g.fillText('v obci ' + s.building.town, W / 2, yb + 205); g.restore();
          }
        }
      }
    }
  };

  SCENES.cta = {
    enter: function (s) {
      gcall('orbit', 0);
      gcall('overview', 1500).then(function () { gcall('orbit', 0.16); });
      AU.ping(0.1, 1320);
    },
    draw: function (g, s, lt) {
      grade(g, 0.6, 0.65, 0.12);
      var out = s.dur - 260;
      var tN = wordStart(s, /^Napiš/i, 900);
      kLine(g, 'CHCEŠ SVŮJ DOMEK?', W / 2, 430, 62, lt, 120, { out: out, color: C.ice, stagger: 60 });
      kLine(g, 'NAPIŠ SVOU OBEC', W / 2, 580, 108, lt, tN - 120, { out: out });
      kLine(g, 'DO KOMENTÁŘŮ', W / 2, 745, 100, lt, tN + 260, { sticker: C.yellow, color: C.ink, out: out, punch: 1.5 });
      // fake comment input s psaním názvů obcí
      var tIn = Math.min(tN + 520, s.dur - 1500), ip = E.outBack(prog(lt, tIn, tIn + 350)), io = 1 - prog(lt, out, out + 200);
      if (ip > 0) {
        var iw = 820, ih = 116, ix = (W - iw) / 2, iy = 900;
        g.save(); g.globalAlpha = clamp(ip, 0, 1) * io;
        g.translate(W / 2, iy + ih / 2); g.scale(Math.max(0.001, ip), Math.max(0.001, ip)); g.translate(-W / 2, -(iy + ih / 2));
        g.shadowColor = 'rgba(0,0,0,.4)'; g.shadowBlur = 40; g.shadowOffsetY = 12;
        g.fillStyle = 'rgba(255,255,255,0.97)'; rr(g, ix, iy, iw, ih, ih / 2); g.fill(); g.shadowBlur = 0; g.shadowOffsetY = 0;
        // avatar „ty“
        var ag = g.createLinearGradient(ix, iy, ix + 100, iy + 100); ag.addColorStop(0, C.sky); ag.addColorStop(1, C.blue);
        g.fillStyle = ag; g.beginPath(); g.arc(ix + 62, iy + ih / 2, 38, 0, 7); g.fill();
        g.fillStyle = '#fff'; g.font = font(34, 900); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('TY', ix + 62, iy + ih / 2 + 1);
        // psaní
        var tT = tIn + 250, per = 1150, k = Math.floor(Math.max(0, lt - tT) / per), name = s.sample[k % s.sample.length], ph = (Math.max(0, lt - tT) % per) / per;
        var typed = name.slice(0, Math.ceil(clamp(ph / 0.55, 0, 1) * name.length));
        if (ph > 0.85) typed = name.slice(0, Math.ceil((1 - (ph - 0.85) / 0.15) * name.length));
        if (lt < tT) typed = '';
        g.textAlign = 'left'; g.font = font(48, 700); g.fillStyle = typed ? C.ink : '#9aa4ba';
        var txt = typed || 'Přidej komentář…'; g.fillText(txt, ix + 124, iy + ih / 2 + 2);
        if (typed && Math.floor(lt / 260) % 2 === 0) { var cw = g.measureText(typed).width; g.fillStyle = C.blue; g.fillRect(ix + 128 + cw, iy + 30, 5, ih - 60); }
        // odeslat
        g.fillStyle = typed ? C.blue : '#c3cbe0'; g.font = font(40, 800); g.textAlign = 'right'; g.fillText('Zveřejnit', ix + iw - 44, iy + ih / 2 + 2);
        g.restore();
        if (typed && typed !== s._lastTyped) { if (typed.length > (s._lastTyped || '').length) AU.tick(0, 3000 + typed.length * 40); s._lastTyped = typed; }
        if (!typed) s._lastTyped = '';
      }
      // šipka dolů (poskakuje)
      var ap = prog(lt, tIn + 200, tIn + 500);
      if (ap > 0) {
        var bounce = Math.abs(Math.sin(lt / 210)) * 34, ax = W / 2, ay = 1170 + bounce;
        g.save(); g.globalAlpha = ap * (1 - prog(lt, out, out + 200));
        g.fillStyle = C.yellow; g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 24;
        g.beginPath(); g.moveTo(ax - 32, ay - 70); g.lineTo(ax + 32, ay - 70); g.lineTo(ax + 32, ay); g.lineTo(ax + 78, ay); g.lineTo(ax, ay + 84); g.lineTo(ax - 78, ay); g.lineTo(ax - 32, ay); g.closePath(); g.fill();
        g.restore();
      }
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
  function safeState() { try { return (G() && G().state && G().state()) || {}; } catch (e) { return {}; } }

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
      if (s.type === 'comment' && s.avatar && s._av === undefined) jobs.push(loadImage(s.avatar).then(function (im) { s._av = im; }));
      delete s._p; delete s._lastTyped;
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
    R.running = true; R.t0 = now(); R.last = R.t0;
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
    version: '1.0.0', W: W, H: H, SAFE_TOP: SAFE_TOP, SAFE_BOTTOM: SAFE_BOTTOM, colors: C,
    scriptFromDay: scriptFromDay, layout: layout, play: play, record: record, stop: stop,
    voiceScript: voiceScript, setVoiceTrack: setVoiceTrack, renderAt: renderAt,
    get canvas() { return ensureCanvas(); },
    get time() { return R.t || 0; },
    get running() { return R.running; },
    get voiceName() { return TTS.voice ? TTS.voice.name : null; },
    snapshot: function (type, q) { return ensureCanvas().toDataURL(type || 'image/png', q); },
    mimeType: pickMime,
    _audio: AU, _scenes: SCENES
  };
})(typeof window !== 'undefined' ? window : this);
