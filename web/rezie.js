/* Postav si Říčansko – režie dílu v prohlížeči.  …/?admin=KLÍČ&rezie=N
   Balíček dílu (scénář s dosazenými čísly, hlas po větách, stav světa) ukládá workflow „Díl“ do větve previews.
   Tady jde díl přehrát a nahrát v plné kvalitě 1080×1920 na grafice počítače, s texty i jako čisté záběry pro střih,
   Voiceover a zvuk z Instagramu se přidávají až ve střihu. */
(function () {
  "use strict";
  var Z = window.REZIE; if (!Z || !window.REEL) return;
  var $ = function (id) { return document.getElementById(id); };
  var HANDLE = "@radar_ricansko", pkg = null, script = null, busy = false, voice = "ai", lastUrl = null, ran = false;

  var css = document.createElement("style");
  css.textContent =
    "#rz{position:fixed;inset:0;z-index:99990;background:#0A1233;color:#fff;font:500 14px Inter,system-ui,sans-serif;display:flex;gap:22px;padding:18px;box-sizing:border-box;overflow:auto}" +
    "#rzMount{height:calc(100vh - 36px);aspect-ratio:9/16;border-radius:16px;overflow:hidden;background:#000;flex:none}#rzMount canvas{width:100%;height:100%;display:block}" +
    "#rzSide{flex:1;min-width:300px;max-width:560px;display:flex;flex-direction:column;gap:12px}" +
    "#rz h2{margin:0;font:700 24px 'Space Grotesk',Inter,sans-serif}#rz h3{margin:6px 0 0;font:700 13px Inter;letter-spacing:.06em;text-transform:uppercase;color:#C6FF3D}" +
    "#rz p{margin:0;color:#b9c2e0;line-height:1.45}#rz .row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}" +
    "#rz button,#rz select{font:600 14px Inter,system-ui;border:0;border-radius:999px;padding:10px 16px;cursor:pointer;background:#C6FF3D;color:#0A1233}" +
    "#rz button.alt,#rz select{background:rgba(255,255,255,.12);color:#fff}#rz button:disabled{opacity:.4;cursor:default}#rz button.rec{background:#ff4f6a;color:#fff}" +
    "#rz textarea{width:100%;min-height:150px;box-sizing:border-box;border-radius:12px;border:0;padding:12px;background:rgba(255,255,255,.08);color:#fff;font:500 13.5px/1.5 Inter,system-ui;resize:vertical}" +
    "#rzStat{background:rgba(255,255,255,.08);border-radius:12px;padding:10px 12px;color:#dfe5fb}#rzStat b{color:#fff}#rzMsg{min-height:20px;color:#C6FF3D}#rzMsg.err{color:#ff8a9c}" +
    "#rzDiag{color:#dfe5fb;font-size:13px}#rzDiag .rzJump{display:inline-flex;align-items:center;gap:4px;margin:6px 8px 0 0;background:rgba(255,255,255,.08);border-radius:8px;padding:4px}#rzDiag .rzJump img{height:120px;border-radius:4px}#rzDiag .rzJump span{writing-mode:vertical-rl;color:#C6FF3D;font-weight:700}" +
    "#rzDl a{color:#0A1233;background:#C6FF3D;border-radius:999px;padding:10px 16px;text-decoration:none;font-weight:700;display:inline-block}" +
    "@media(max-width:820px){#rz{flex-direction:column}#rzMount{height:auto;width:100%}}";
  document.head.appendChild(css);

  var el = document.createElement("div"); el.id = "rz";
  el.innerHTML =
    '<div id="rzMount"></div><div id="rzSide">' +
    '<h2>Režie · díl <span id="rzN"></span></h2><div id="rzStat">Načítám balíček dílu…</div><div id="rzMsg"></div>' +
    '<h3>S texty a hlasem</h3><div class="row"><button id="rzPlay" disabled>▶ Přehrát</button><button id="rzRec" class="rec" disabled>⏺ Vyrobit video</button></div>' +
    '<h3>Čisté záběry pro střih</h3><p>Jen obraz hry, bez textů, titulků a zvuku. Načasování záběrů zůstává podle hlasu.</p>' +
    '<div class="row"><button id="rzClean" class="alt" disabled>▶ Přehrát</button><button id="rzCleanRec" class="rec" disabled>⏺ Vyrobit čisté záběry</button><button id="rzStop" class="alt" disabled>■ Stop</button></div>' +
    '<div id="rzDl"></div><div id="rzDiag"></div>' +
    '<h3>Hlas</h3><p>AI hlas je jen vodítko pro tempo. Vlastní voiceover a zvuk z Instagramu se přidávají až ve střihu.</p>' +
    '<div class="row"><button id="rzAi" class="alt" disabled>AI hlas</button><button id="rzMute" class="alt" disabled>Ztlumený (časování zůstává)</button><button id="rzNoVoice" class="alt" disabled>Bez hlasu</button></div>' +
    '<div class="row"><span>Hudba</span><select id="rzMusic"></select></div>' +
    '<h3>Text k namluvení</h3><textarea id="rzText" readonly></textarea>' +
    '<div class="row"><button id="rzTxt" class="alt" disabled>Stáhnout text</button><button id="rzSrt" class="alt" disabled>Stáhnout titulky .srt</button><button id="rzClose" class="alt">Zavřít režii</button></div>' +
    '<p>Video se vyrábí snímek po snímku na grafice tohohle počítače: 1080×1920, 30 snímků za vteřinu. Nech kartu v popředí. Před dalším během dílu, kde přibývají domky nebo vlajky, obnov stránku.</p></div>';
  document.body.appendChild(el);
  $("rzN").textContent = Z.dil;
  REEL.musicStyles.forEach(function (m) { var o = document.createElement("option"); o.value = m; o.textContent = m; $("rzMusic").appendChild(o); });

  function msg(t, err) { var m = $("rzMsg"); m.textContent = t || ""; m.className = err ? "err" : ""; }
  function lock(b) { busy = b; ["rzPlay", "rzRec", "rzClean", "rzCleanRec", "rzAi", "rzMute", "rzNoVoice", "rzTxt", "rzSrt"].forEach(function (i) { $(i).disabled = b || !script; }); $("rzStop").disabled = !b; $("rzAi").disabled = b || !script || voice === "ai"; $("rzNoVoice").disabled = b || !script || voice === "bez"; $("rzMute").disabled = b || !script || voice === "tichy"; }
  function b64blob(c) { var s = atob(c), u = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return new Blob([u], { type: "audio/mpeg" }); }
  function save(name, text, type) { var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: type || "text/plain;charset=utf-8" })); a.download = name; a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000); }
  function sec(ms) { return (ms / 1000).toFixed(1).replace(".", ",") + " s"; }

  /* scénář se staví znovu před každým během: záběry si drží rozpracovaný stav a detailní domek se vrací na začátek */
  function build() {
    script = REEL.scriptFromShots(JSON.parse(JSON.stringify(pkg.def)), { handle: HANDLE });
    var clips = voice !== "bez" ? (pkg.clips || []).map(function (c) { return c ? b64blob(c) : null; }) : [];
    var p = clips.some(Boolean) ? REEL.setVoiceSegments(script, clips, { padMs: 140 }) : REEL.setVoiceTrack(null);
    return Promise.resolve(p).then(function () { return voice === "tichy" ? REEL.setVoiceTrack(null) : null; }).then(function () {   // ztlumený: délky záběrů podle AI hlasu, ale hlas ve videu není (pod vlastní voiceover)
      REEL.setMusic($("rzMusic").value);
      var v = REEL.voiceScript(script), n = script.scenes.filter(function (s) { return s.vo; }).length;
      $("rzText").value = (v.segments || []).map(function (s, i) { return (i + 1) + ". " + s.text; }).join("\n\n");
      $("rzStat").innerHTML = "<b>" + sec(script.total) + "</b> · " + script.scenes.length + " záběrů · " + n + " vět · hlas: <b>" +
        (!clips.some(Boolean) ? (voice === "bez" ? "bez hlasu" : "v balíčku žádný není") : voice === "ai" ? "AI (" + (pkg.via || "?") + ")" : "ztlumený, časování podle AI") + "</b>";
      return v;
    });
  }

  /* Přehrát = v reálném čase (náhled). Vyrobit = snímek po snímku: každý snímek se vykreslí celý a zakóduje,
     takže video má přesně 30 snímků za vteřinu v 1080×1920, i když počítač hru v reálném čase nestíhá. */
  function lib() { return window.Mp4Muxer ? Promise.resolve() : new Promise(function (ok, no) { var t = document.createElement("script"); t.src = "https://cdn.jsdelivr.net/npm/mp4-muxer@5.1.3/build/mp4-muxer.min.js"; t.onload = ok; t.onerror = function () { no(new Error("nepodařilo se načíst knihovnu pro MP4")); }; document.head.appendChild(t); }); }
  function offline(clean) {
    var fps = 30, W = REEL.W, H = REEL.H, SR = 48000, err = null, target, muxer, venc, abuf = null, n = 0, total = script.total, frames = Math.ceil(total / 1000 * fps);
    /* kontrola plynulosti: rozdíl sousedních snímků; velký skok mimo střih = chyba v obraze (vyskočení, probliknutí) */
    var dc = document.createElement("canvas"); dc.width = 54; dc.height = 96; var dg = dc.getContext("2d", { willReadFrequently: true }), prevPx = null, diffs = [], tc2 = document.createElement("canvas"); tc2.width = 135; tc2.height = 240; var tg = tc2.getContext("2d"), prevThumb = "", pairs = {}, nPairs = 0;
    function probe(cv, i) { dg.drawImage(cv, 0, 0, 54, 96); var px = dg.getImageData(0, 0, 54, 96).data, v = 0; if (prevPx) { for (var k = 1; k < px.length; k += 4) v += Math.abs(px[k] - prevPx[k]); v /= px.length / 4; } diffs.push(v); prevPx = px;
      tg.drawImage(cv, 0, 0, 135, 240); var u = tc2.toDataURL("image/jpeg", 0.72); if (v > 9 && ++nPairs < 400) pairs[i] = [prevThumb, u]; prevThumb = u; }
    function report() { var starts = {}; script.scenes.forEach(function (sc) { var f = Math.round(sc.t0 / 1000 * fps); starts[f - 1] = starts[f] = starts[f + 1] = 1; });
      var inside = [], cuts = 0; for (var i = 1; i < diffs.length; i++) { var nb = diffs.slice(Math.max(0, i - 8), i + 9).sort(function (a, b) { return a - b; }), med = nb[nb.length >> 1]; if (diffs[i] > 9 && diffs[i] > 3.5 * Math.max(med, 0.5)) { if (starts[i]) cuts++; else inside.push({ f: i, t: +(i / fps).toFixed(2), d: +diffs[i].toFixed(1), okoli: +med.toFixed(1) }); } }
      Z.diag = { stihu: cuts, uvnitr: inside, snimku: diffs.length };
      var el = $("rzDiag"); el.innerHTML = "<b>Kontrola plynulosti:</b> " + (inside.length ? inside.length + " skoků uvnitř záběru" : "žádný skok uvnitř záběru") + " · střihů " + cuts +
        inside.slice(0, 12).map(function (x) { var pr = pairs[x.f] || ["", ""]; return '<div class="rzJump"><span>' + String(x.t).replace(".", ",") + " s</span><img src=\"" + pr[0] + '"><img src="' + pr[1] + '"></div>'; }).join(""); }
    if (!window.VideoEncoder || !window.VideoFrame) return Promise.reject(new Error("tenhle prohlížeč neumí kódovat video (potřebuje Chrome nebo Edge)"));
    return lib().then(function () { return clean ? null : REEL.renderAudio(script).then(function (wav) { return wav.arrayBuffer(); }).then(function (ab) { var C = window.OfflineAudioContext || window.webkitOfflineAudioContext; return new C(2, 2, SR).decodeAudioData(ab); }); })
      .then(function (buf) { abuf = buf && window.AudioEncoder ? buf : null;
        target = new Mp4Muxer.ArrayBufferTarget();
        muxer = new Mp4Muxer.Muxer({ target: target, video: { codec: "avc", width: W, height: H, frameRate: fps }, audio: abuf ? { codec: "aac", numberOfChannels: 2, sampleRate: SR } : undefined, fastStart: "in-memory" });
        venc = new VideoEncoder({ output: function (c, m) { muxer.addVideoChunk(c, m); }, error: function (e) { err = e; } });
        venc.configure({ codec: "avc1.640028", width: W, height: H, bitrate: 9000000, framerate: fps });
        return REEL.frames(script, { fps: fps, clean: clean, mount: $("rzMount"), each: function (cv, t, i) {
          if (err) throw err; if (stopAsk) return false; probe(cv, i);
          var f = new VideoFrame(cv, { timestamp: Math.round(i * 1e6 / fps), duration: Math.round(1e6 / fps) }); venc.encode(f, { keyFrame: i % 60 === 0 }); f.close(); n = i + 1;
          if (i % 15 === 0) msg("Vyrábím video: " + Math.round(100 * i / frames) + " %");
          return venc.encodeQueueSize > 6 ? new Promise(function (r) { (function w() { venc.encodeQueueSize > 3 ? setTimeout(w, 4) : r(); })(); }) : null;
        } });
      }).then(function () { return venc.flush(); }).then(function () { venc.close(); if (!abuf) return;
        var aenc = new AudioEncoder({ output: function (c, m) { muxer.addAudioChunk(c, m); }, error: function (e) { err = e; } });
        aenc.configure({ codec: "mp4a.40.2", sampleRate: SR, numberOfChannels: 2, bitrate: 192000 });
        var len = Math.min(abuf.length, Math.round(n / fps * SR)), L = abuf.getChannelData(0), Rr = abuf.getChannelData(abuf.numberOfChannels > 1 ? 1 : 0), step = 4800;
        for (var p = 0; p < len; p += step) { var k = Math.min(step, len - p), d = new Float32Array(k * 2); d.set(L.subarray(p, p + k), 0); d.set(Rr.subarray(p, p + k), k);
          var ad = new AudioData({ format: "f32-planar", sampleRate: SR, numberOfFrames: k, numberOfChannels: 2, timestamp: Math.round(p / SR * 1e6), data: d }); aenc.encode(ad); ad.close(); }
        return aenc.flush().then(function () { aenc.close(); });
      }).then(function () { if (err) throw err; try { report(); } catch (e) {} muxer.finalize(); var blob = new Blob([target.buffer], { type: "video/mp4" }); blob.extension = "mp4"; return blob; });
  }
  var stopAsk = false, offRun = false;
  function run(kind) {
    if (busy || !pkg) return; lock(true); stopAsk = false; msg(ran ? "Běží znovu ve stejné relaci. Kdyby obraz neseděl, obnov stránku." : "");
    var clean = kind === "clean" || kind === "cleanrec", rec = kind === "rec" || kind === "cleanrec", mount = $("rzMount"), t0 = performance.now();
    if (lastUrl) { URL.revokeObjectURL(lastUrl); lastUrl = null; } $("rzDl").innerHTML = "";
    build().then(function () {
      if (!rec) return REEL.play(script, { mount: mount, clean: clean, tts: false });
      msg("Vyrábím video…");
      offRun = true;
      return offline(clean).then(function (blob) {
        lastUrl = URL.createObjectURL(blob); var name = "postav-si-ricansko-dil-" + Z.dil + (clean ? "-ciste-zabery" : voice === "ai" ? "" : "-bez-hlasu") + "." + (blob.extension || "mp4");
        $("rzDl").innerHTML = '<a href="' + lastUrl + '" download="' + name + '">Stáhnout ' + name + " (" + (blob.size / 1048576).toFixed(1).replace(".", ",") + " MB)</a>";
        msg(stopAsk ? "Zastaveno, video je kratší." : "Hotovo za " + Math.round((performance.now() - t0) / 1000) + " s.");
      });
    }).catch(function (e) { msg("Nepovedlo se: " + (e && e.message || e), true); }).then(function () { ran = true; offRun = false; lock(false); });
  }

  $("rzAi").onclick = function () { voice = "ai"; lock(true); build().then(function () { msg("Zpátky AI hlas."); lock(false); }); };
  $("rzMute").onclick = function () { voice = "tichy"; lock(true); build().then(function () { msg("Hlas je ztlumený, záběry mají délku podle AI hlasu."); lock(false); }); };
  $("rzNoVoice").onclick = function () { voice = "bez"; lock(true); build().then(function () { msg("Bez hlasu: záběry mají délku podle textu."); lock(false); }); };
  $("rzMusic").onchange = function () { REEL.setMusic(this.value); };
  $("rzPlay").onclick = function () { run("play"); }; $("rzRec").onclick = function () { run("rec"); };
  $("rzClean").onclick = function () { run("clean"); }; $("rzCleanRec").onclick = function () { run("cleanrec"); };
  $("rzStop").onclick = function () { stopAsk = true; if (!offRun) REEL.stop(); };
  $("rzTxt").onclick = function () { save("dil-" + Z.dil + "-text.txt", $("rzText").value); };
  $("rzSrt").onclick = function () { save("dil-" + Z.dil + ".srt", REEL.voiceScript(script).srt || ""); };
  $("rzClose").onclick = function () { REEL.stop(); el.style.display = "none"; };

  /* start: balíček + hotová hra */
  var w = setInterval(function () {
    if (!window.done) return; clearInterval(w);
    Z.pkg.then(function (p) {
      if (!p || !p.def) throw new Error("balíček je prázdný");
      pkg = p; $("rzMusic").value = REEL.musicStyles.indexOf(p.def.hudba) >= 0 ? p.def.hudba : "bez";
      if (!(p.clips || []).some(Boolean)) voice = "bez";
      return build();
    }).then(function () { msg(pkg.vznik ? "Balíček z " + new Date(pkg.vznik).toLocaleString("cs-CZ") + "." : ""); lock(false); })
      .catch(function (e) { $("rzStat").textContent = "Díl " + Z.dil + " tu zatím není."; msg((e && e.message || e) + ". Nejdřív pusť na GitHubu Actions → „Díl (rychlý render po částech)“ s tímhle číslem.", true); });
  }, 250);
})();
