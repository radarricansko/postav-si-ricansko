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
    "#rzDl a{color:#0A1233;background:#C6FF3D;border-radius:999px;padding:10px 16px;text-decoration:none;font-weight:700;display:inline-block}" +
    "@media(max-width:820px){#rz{flex-direction:column}#rzMount{height:auto;width:100%}}";
  document.head.appendChild(css);

  var el = document.createElement("div"); el.id = "rz";
  el.innerHTML =
    '<div id="rzMount"></div><div id="rzSide">' +
    '<h2>Režie · díl <span id="rzN"></span></h2><div id="rzStat">Načítám balíček dílu…</div><div id="rzMsg"></div>' +
    '<h3>S texty a hlasem</h3><div class="row"><button id="rzPlay" disabled>▶ Přehrát</button><button id="rzRec" class="rec" disabled>⏺ Nahrát video</button></div>' +
    '<h3>Čisté záběry pro střih</h3><p>Jen obraz hry, bez textů, titulků a zvuku. Načasování záběrů zůstává podle hlasu.</p>' +
    '<div class="row"><button id="rzClean" class="alt" disabled>▶ Přehrát</button><button id="rzCleanRec" class="rec" disabled>⏺ Nahrát čisté záběry</button><button id="rzStop" class="alt" disabled>■ Stop</button></div>' +
    '<div id="rzDl"></div>' +
    '<h3>Hlas</h3><p>AI hlas je jen vodítko pro tempo. Vlastní voiceover a zvuk z Instagramu se přidávají až ve střihu.</p>' +
    '<div class="row"><button id="rzAi" class="alt" disabled>AI hlas</button><button id="rzNoVoice" class="alt" disabled>Bez hlasu</button></div>' +
    '<div class="row"><span>Hudba</span><select id="rzMusic"></select></div>' +
    '<h3>Text k namluvení</h3><textarea id="rzText" readonly></textarea>' +
    '<div class="row"><button id="rzTxt" class="alt" disabled>Stáhnout text</button><button id="rzSrt" class="alt" disabled>Stáhnout titulky .srt</button><button id="rzClose" class="alt">Zavřít režii</button></div>' +
    '<p>Nahrává se v reálném čase na grafice tohohle počítače. Nech kartu v popředí a okno nezmenšuj. Před dalším přehráním dílu, kde přibývají domky nebo vlajky, obnov stránku.</p></div>';
  document.body.appendChild(el);
  $("rzN").textContent = Z.dil;
  REEL.musicStyles.forEach(function (m) { var o = document.createElement("option"); o.value = m; o.textContent = m; $("rzMusic").appendChild(o); });

  function msg(t, err) { var m = $("rzMsg"); m.textContent = t || ""; m.className = err ? "err" : ""; }
  function lock(b) { busy = b; ["rzPlay", "rzRec", "rzClean", "rzCleanRec", "rzAi", "rzNoVoice", "rzTxt", "rzSrt"].forEach(function (i) { $(i).disabled = b || !script; }); $("rzStop").disabled = !b; $("rzAi").disabled = b || !script || voice === "ai"; $("rzNoVoice").disabled = b || !script || voice === "bez"; }
  function b64blob(c) { var s = atob(c), u = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return new Blob([u], { type: "audio/mpeg" }); }
  function save(name, text, type) { var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: type || "text/plain;charset=utf-8" })); a.download = name; a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000); }
  function sec(ms) { return (ms / 1000).toFixed(1).replace(".", ",") + " s"; }

  /* scénář se staví znovu před každým během: záběry si drží rozpracovaný stav a detailní domek se vrací na začátek */
  function build() {
    script = REEL.scriptFromShots(JSON.parse(JSON.stringify(pkg.def)), { handle: HANDLE });
    var clips = voice === "ai" ? (pkg.clips || []).map(function (c) { return c ? b64blob(c) : null; }) : [];
    var p = clips.some(Boolean) ? REEL.setVoiceSegments(script, clips, { padMs: 140 }) : REEL.setVoiceTrack(null);
    return Promise.resolve(p).then(function () {
      REEL.setMusic($("rzMusic").value);
      var v = REEL.voiceScript(script), n = script.scenes.filter(function (s) { return s.vo; }).length;
      $("rzText").value = (v.segments || []).map(function (s, i) { return (i + 1) + ". " + s.text; }).join("\n\n");
      $("rzStat").innerHTML = "<b>" + sec(script.total) + "</b> · " + script.scenes.length + " záběrů · " + n + " vět · hlas: <b>" +
        (voice === "ai" ? (clips.some(Boolean) ? "AI (" + (pkg.via || "?") + ")" : "v balíčku žádný není") : "bez hlasu") + "</b>";
      return v;
    });
  }

  function run(kind) {
    if (busy || !pkg) return; lock(true); msg(ran ? "Běží znovu ve stejné relaci. Kdyby obraz neseděl, obnov stránku." : "");
    var clean = kind === "clean" || kind === "cleanrec", rec = kind === "rec" || kind === "cleanrec", mount = $("rzMount");
    if (lastUrl) { URL.revokeObjectURL(lastUrl); lastUrl = null; } $("rzDl").innerHTML = "";
    build().then(function () {
      var o = { mount: mount, clean: clean, tts: false, bitrate: 16000000 };
      if (!rec) return REEL.play(script, o);
      msg("Nahrávám " + sec(script.total) + "…");
      return REEL.record(script, o).then(function (blob) {
        lastUrl = URL.createObjectURL(blob); var name = "dil-" + Z.dil + (clean ? "-ciste-zabery" : "") + "." + (blob.extension || "webm");
        $("rzDl").innerHTML = '<a href="' + lastUrl + '" download="' + name + '">Stáhnout ' + name + " (" + (blob.size / 1048576).toFixed(1).replace(".", ",") + " MB)</a>";
        msg("Hotovo.");
      });
    }).catch(function (e) { msg("Nepovedlo se: " + (e && e.message || e), true); }).then(function () { ran = true; lock(false); });
  }

  $("rzAi").onclick = function () { voice = "ai"; lock(true); build().then(function () { msg("Zpátky AI hlas."); lock(false); }); };
  $("rzNoVoice").onclick = function () { voice = "bez"; lock(true); build().then(function () { msg("Bez hlasu: záběry mají délku podle textu."); lock(false); }); };
  $("rzMusic").onchange = function () { REEL.setMusic(this.value); };
  $("rzPlay").onclick = function () { run("play"); }; $("rzRec").onclick = function () { run("rec"); };
  $("rzClean").onclick = function () { run("clean"); }; $("rzCleanRec").onclick = function () { run("cleanrec"); };
  $("rzStop").onclick = function () { REEL.stop(); };
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
