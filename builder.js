/* Ablauf-Builder: Aufgaben, Abhängigkeiten und Dauer pro Kunde als Zeitachse.
   Idee der Darstellung angelehnt an den Agent Trace (21st.dev): Balken auf einer Zeitachse, die man abspielen und scrubben kann,
   hier umgesetzt in Vanilla JS für Social Bites. Jede Aufgabe hat Dauer in Tagen und Vorgänger. Der Start ergibt sich aus den Vorgängern,
   parallele Aufgaben liegen untereinander übereinander, der kritische Pfad (die Kette, die das Ende bestimmt) ist orange markiert.
   Die Vorlagen enthalten Richtwerte als Platzhalter und sind in der Oberfläche so gekennzeichnet. Alles bleibt nur im Browser (localStorage).
   Aufruf: SBBuilder.mount(element) liefert { dispose }. */
(function () {
  "use strict";
  var KEY = "sb-builder-v1";
  var DAY = 86400000;
  var TEAMS = [["alle", "Beide"], ["nader", "Nader"], ["tommy", "Tommy"], ["kunde", "Kunde"], ["extern", "Extern"]];
  var TEAMNAME = { alle: "Nader und Tommy", nader: "Nader", tommy: "Tommy", kunde: "Kunde", extern: "Extern" };

  /* Vorlagen: Namen der Schritte kommen aus dem Playbook, die Tage sind Richtwerte zum Anpassen. */
  var TEMPLATES = {
    reel: { name: "Reel Paket", note: "Kurzer Ablauf für ein Reel. Tage sind Richtwerte.", tasks: [
      ["plan", "Planung und Konzept", 3, [], "alle"], ["dreh", "Dreh", 1, ["plan"], "nader"], ["schnitt", "Schnitt", 4, ["dreh"], "nader"],
      ["frei", "Freigabe durch Kunde", 2, ["schnitt"], "kunde"], ["post", "Posting", 1, ["frei"], "tommy"] ] },
    opening: { name: "Bites Opening", note: "Schritte aus dem Playbook. Laut Leistungen läuft das Opening ca. 10 Wochen vorher bis 4 Wochen danach, die Einzel Tage sind Richtwerte.", tasks: [
      ["erst", "Erstgespräch vor Ort", 2, [], "tommy"], ["ang", "Angebot schreiben", 3, ["erst"], "tommy"], ["zus", "Zusage und Kundenakte", 3, ["ang"], "tommy"],
      ["kick", "Kick-off und Konzept", 5, ["zus"], "alle"], ["pre", "Pre-Production", 14, ["kick"], "nader"], ["shoot", "Shooting", 2, ["pre"], "nader"],
      ["cut", "Schnitt und Freigabe", 10, ["shoot"], "nader"], ["inf", "Influencer Einladungen", 10, ["kick"], "tommy"], ["tease", "Teaser Phase und Ads", 28, ["cut"], "tommy"],
      ["open", "Pre-Opening und Opening", 7, ["tease", "inf"], "alle"], ["after", "Nachglühen", 28, ["open"], "tommy"], ["rep", "Report, Rechnung, Ablage", 7, ["after"], "tommy"] ] },
    gastro: { name: "Bites for Gastro (ein Monat)", note: "Monatsbetreuung nach Playbook. Tage sind Richtwerte.", tasks: [
      ["onb", "Zusage und Onboarding", 3, [], "tommy"], ["str", "Strategie und Monatsplan", 4, ["onb"], "alle"], ["vor", "Drehtag vorbereiten", 3, ["str"], "nader"],
      ["dreh", "Drehtag", 1, ["vor"], "nader"], ["cut", "Schnitt und Freigabe", 6, ["dreh"], "nader"], ["post", "Posting und Community", 14, ["cut"], "tommy"],
      ["rep", "Monatsreport und Gespräch", 2, ["post"], "tommy"], ["re", "Rechnung und Ablage", 2, ["rep"], "tommy"] ] }
  };

  var CSS = '\
.bld{display:grid;gap:14px;}\
.bld-top{display:flex;flex-wrap:wrap;gap:8px 12px;align-items:center;}\
.bld-top select,.bld-top input,.bld-ed input,.bld-ed select{font:inherit;font-size:14px;padding:8px 10px;border:1px solid var(--line-2,rgba(35,35,33,.3));border-radius:10px;background:var(--card,#fff);color:inherit;min-width:0;}\
.bld-top input[type=text]{width:180px;}\
.bld .bb{font:700 13px/1 var(--display,system-ui,sans-serif);padding:9px 13px;border-radius:999px;border:1.5px solid var(--ink,#232321);background:transparent;color:inherit;cursor:pointer;transition:background-color .2s,color .2s;}\
.bld .bb:hover{background:var(--paper-2,#F2EEE2);}\
.bld .bb.pri{background:var(--ink,#232321);color:var(--card,#fff);}\
.bld .bb.pri:hover{background:var(--accent,#F26A21);border-color:var(--accent,#F26A21);color:#fff;}\
.bld-note{font-size:13px;color:var(--mute,#6C6F68);margin:0;}\
.bld-kpi{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;}\
.bld-kpi div{background:var(--card,#fff);border:1px solid var(--line,rgba(35,35,33,.14));border-radius:14px;padding:12px 14px;}\
.bld-kpi small{display:block;font-size:12px;color:var(--mute,#6C6F68);}\
.bld-kpi b{display:block;font-size:26px;letter-spacing:-.03em;margin-top:3px;font-variant-numeric:tabular-nums;}\
.bld-kpi span{font-size:12px;color:var(--mute,#6C6F68);}\
.bld-chart{--g:200px;--m:210px;--row:36px;position:relative;background:var(--card,#fff);border:1px solid var(--line,rgba(35,35,33,.14));border-radius:16px;overflow:hidden;}\
@media (max-width:760px){.bld-chart{--g:120px;--m:84px;}.bld-m{display:none!important;}}\
.bld-hd{display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid var(--line,rgba(35,35,33,.14));}\
.bld-hd b{font-size:14px;}\
.bld-hd span{font-size:12px;color:var(--mute,#6C6F68);}\
.bld-ruler{position:relative;height:28px;border-bottom:1px solid var(--line,rgba(35,35,33,.14));cursor:ew-resize;touch-action:none;user-select:none;}\
.bld-trk{position:absolute;left:calc(var(--g) + 12px);right:calc(var(--m) + 12px);top:0;bottom:0;}\
.bld-ruler .tk{position:absolute;top:9px;transform:translateX(-50%);font:10px/1 ui-monospace,Menlo,monospace;color:var(--mute,#6C6F68);}\
.bld-body{position:relative;padding:4px 0;}\
.bld-grid i{position:absolute;top:0;bottom:0;width:1px;background:var(--line,rgba(35,35,33,.14));opacity:.7;}\
.bld-row{position:relative;display:flex;align-items:center;height:var(--row);padding:0 12px;}\
.bld-row[data-s="run"]{background:var(--paper-2,#F2EEE2);}\
.bld-lbl{width:var(--g);flex:none;display:flex;align-items:center;gap:7px;min-width:0;font-size:13px;font-weight:600;padding-right:8px;}\
.bld-lbl span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}\
.bld-lbl em{flex:none;font:700 10px/1 ui-monospace,Menlo,monospace;color:var(--mute,#6C6F68);font-style:normal;}\
.bld-row[data-s="queued"] .bld-lbl{color:var(--mute,#6C6F68);}\
.bld-tr{position:relative;flex:1;height:100%;}\
.bld-bar{position:absolute;top:50%;height:12px;transform:translateY(-50%);border-radius:999px;overflow:hidden;min-width:4px;background:var(--line,rgba(35,35,33,.14));}\
.bld-bar>i{position:absolute;inset:0;transform-origin:left;transform:scaleX(var(--p,1));background:var(--stone,#6C6F68);}\
.bld-bar.crit>i{background:var(--accent,#F26A21);}\
.bld-bar.kunde>i{background:#4F9A66;}\
.bld-m{width:var(--m);flex:none;text-align:right;font:11px ui-monospace,Menlo,monospace;color:var(--mute,#6C6F68);padding-left:8px;white-space:nowrap;}\
.bld-row[data-s="queued"] .bld-m{opacity:.35;}\
.bld-svg{position:absolute;left:calc(var(--g) + 12px);right:calc(var(--m) + 12px);top:0;bottom:0;pointer-events:none;overflow:visible;}\
.bld-svg path{fill:none;stroke:var(--mute,#6C6F68);stroke-width:1.2;vector-effect:non-scaling-stroke;opacity:.55;}\
.bld-svg path.crit{stroke:var(--accent,#F26A21);opacity:.9;stroke-width:1.6;}\
.bld-ph{position:absolute;top:0;bottom:0;left:calc(var(--g) + 12px);right:calc(var(--m) + 12px);pointer-events:none;}\
.bld-ph i{position:absolute;top:0;bottom:0;width:2px;margin-left:-1px;background:var(--accent,#F26A21);left:calc(var(--t,0) * 100%);}\
.bld-ph i:before{content:"";position:absolute;top:0;left:-3px;width:8px;height:8px;background:var(--accent,#F26A21);transform:rotate(45deg);margin-top:-4px;}\
.bld-sc{display:flex;align-items:center;gap:12px;padding:10px 14px;border-top:1px solid var(--line,rgba(35,35,33,.14));}\
.bld-play{width:38px;height:38px;border-radius:50%;border:0;background:var(--accent,#F26A21);color:#fff;font-size:13px;cursor:pointer;flex:none;}\
.bld-rail{flex:1;height:36px;position:relative;cursor:ew-resize;touch-action:none;user-select:none;}\
.bld-rail:before{content:"";position:absolute;left:6px;right:6px;top:50%;height:4px;margin-top:-2px;border-radius:99px;background:var(--line,rgba(35,35,33,.14));}\
.bld-rail b{position:absolute;left:6px;top:50%;height:4px;margin-top:-2px;border-radius:99px;background:var(--accent,#F26A21);width:calc((100% - 12px) * var(--t,0));}\
.bld-rail u{position:absolute;top:50%;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;background:var(--accent,#F26A21);border:2px solid var(--card,#fff);box-shadow:0 1px 4px rgba(0,0,0,.3);left:calc(6px + (100% - 12px) * var(--t,0));}\
.bld-clk{font:11px ui-monospace,Menlo,monospace;color:var(--mute,#6C6F68);min-width:150px;text-align:right;}\
.bld-ed{background:var(--card,#fff);border:1px solid var(--line,rgba(35,35,33,.14));border-radius:16px;padding:14px;overflow:auto;}\
.bld-ed h3{margin:0 0 4px;font-size:15px;}\
.bld-ed table{width:100%;border-collapse:collapse;min-width:640px;}\
.bld-ed th{font:700 10.5px ui-monospace,Menlo,monospace;letter-spacing:.06em;text-transform:uppercase;color:var(--mute,#6C6F68);text-align:left;padding:6px 6px;}\
.bld-ed td{padding:4px 6px;vertical-align:middle;}\
.bld-ed td input[type=text]{width:100%;}\
.bld-ed td input[type=number]{width:74px;}\
.bld-ed details{position:relative;}\
.bld-ed summary{cursor:pointer;font-size:13px;padding:8px 10px;border:1px solid var(--line-2,rgba(35,35,33,.3));border-radius:10px;list-style:none;max-width:230px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}\
.bld-ed summary::-webkit-details-marker{display:none;}\
.bld-ed .dp{position:absolute;z-index:10;top:100%;left:0;margin-top:4px;background:var(--card,#fff);border:1px solid var(--ink,#232321);border-radius:12px;padding:8px;display:grid;gap:4px;max-height:240px;overflow:auto;min-width:220px;box-shadow:0 12px 30px rgba(0,0,0,.18);}\
.bld-ed .dp label{display:flex;gap:8px;align-items:center;font-size:13px;padding:3px 4px;cursor:pointer;}\
.bld-ed .x{border:0;background:transparent;font-size:18px;cursor:pointer;color:var(--mute,#6C6F68);padding:4px 8px;}\
.bld-ed .x:hover{color:var(--bad,#B42318);}\
@media (prefers-reduced-motion:reduce){.bld *{transition:none!important;}}';
  var cssDone = false;
  function addCss() { if (cssDone) return; cssDone = true; var s = document.createElement("style"); s.textContent = CSS; document.head.appendChild(s); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function uid() { return "t" + Math.random().toString(36).slice(2, 8); }
  function today() { var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function parse(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ""); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(); }
  function addDays(iso, n) { var d = parse(iso); d.setDate(d.getDate() + n); return d; }
  var df = new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "short" });
  var dfy = new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "long", year: "numeric" });

  function fromTemplate(key, kunde, start) {
    var t = TEMPLATES[key];
    return { id: uid(), name: t.name, kunde: kunde || "", start: start || today(), note: t.note, tasks: t.tasks.map(function (r) { return { id: r[0], name: r[1], days: r[2], dep: r[3].slice(), team: r[4], gap: 0 }; }) };
  }

  /* Rechnet Start und Ende jeder Aufgabe aus den Vorgängern, dazu Puffer und kritischen Pfad */
  function calc(tasks) {
    var by = {}; tasks.forEach(function (t) { by[t.id] = t; });
    var st = {}, busy = {};
    function startOf(t) {
      if (st[t.id] != null) return st[t.id];
      if (busy[t.id]) return 0;
      busy[t.id] = true;
      var s = 0;
      (t.dep || []).forEach(function (d) { var p = by[d]; if (p && p !== t) s = Math.max(s, startOf(p) + Math.max(0, +p.days || 0) + Math.max(0, +t.gap || 0)); });
      busy[t.id] = false; st[t.id] = s; return s;
    }
    tasks.forEach(startOf);
    var total = 0; tasks.forEach(function (t) { total = Math.max(total, st[t.id] + Math.max(0, +t.days || 0)); });
    var succ = {}; tasks.forEach(function (t) { (t.dep || []).forEach(function (d) { if (by[d] && by[d] !== t) (succ[d] = succ[d] || []).push(t); }); });
    var lf = {}, memo = {};
    function lateFinish(t) {
      if (lf[t.id] != null) return lf[t.id];
      var v = total; (succ[t.id] || []).forEach(function (s) { v = Math.min(v, lateFinish(s) - Math.max(0, +s.days || 0) - Math.max(0, +s.gap || 0)); });
      lf[t.id] = v; return v;
    }
    var out = tasks.map(function (t, i) {
      var d = Math.max(0, +t.days || 0), s = st[t.id], slack = lateFinish(t) - (s + d);
      return { t: t, i: i, start: s, end: s + d, dur: d, slack: Math.round(slack * 1000) / 1000, crit: Math.abs(slack) < 1e-6 && d > 0 };
    });
    out.sort(function (a, b) { return a.start - b.start || a.i - b.i; });
    return { rows: out, total: total, by: by };
  }

  function mount(host) {
    addCss();
    var data;
    try { data = JSON.parse(localStorage.getItem(KEY)); } catch (e) { data = null; }
    if (!data || !data.plans || !data.plans.length) { var p0 = fromTemplate("reel", "", today()); data = { plans: [p0], cur: p0.id }; }
    var plan = function () { return data.plans.filter(function (p) { return p.id === data.cur; })[0] || data.plans[0]; };
    function save() { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* egal */ } }

    var t = 0, playing = false, raf = 0, last = 0, dead = false, openDp = null;
    var res;

    host.innerHTML = '<div class="bld"><div class="bld-top"></div><p class="bld-note" id="bldNote"></p><div class="bld-kpi"></div><div class="bld-chart"></div><div class="bld-ed"></div></div>';
    var top = host.querySelector(".bld-top"), note = host.querySelector("#bldNote"), kpi = host.querySelector(".bld-kpi"), chart = host.querySelector(".bld-chart"), ed = host.querySelector(".bld-ed");

    function drawTop() {
      var p = plan();
      top.innerHTML = '<select aria-label="Plan wählen" id="bPlan">' + data.plans.map(function (x) { return '<option value="' + x.id + '"' + (x.id === p.id ? " selected" : "") + ">" + esc((x.kunde ? x.kunde + " · " : "") + x.name) + "</option>"; }).join("") + "</select>" +
        '<input type="text" id="bKunde" placeholder="Kunde" aria-label="Kunde" value="' + esc(p.kunde) + '">' +
        '<input type="text" id="bName" placeholder="Name des Plans" aria-label="Name des Plans" value="' + esc(p.name) + '">' +
        '<label style="display:flex;gap:6px;align-items:center;font-size:13px">Start <input type="date" id="bStart" value="' + esc(p.start) + '"></label>' +
        '<select aria-label="Neuer Plan aus Vorlage" id="bNew"><option value="">Neuer Plan aus Vorlage …</option>' + Object.keys(TEMPLATES).map(function (k) { return '<option value="' + k + '">' + esc(TEMPLATES[k].name) + "</option>"; }).join("") + '<option value="leer">Leerer Plan</option></select>' +
        '<button class="bb" type="button" id="bDup">Duplizieren</button><button class="bb" type="button" id="bCopy">Als Text kopieren</button><button class="bb" type="button" id="bDel">Plan löschen</button>';
      note.textContent = p.note ? p.note + " Die Tage sind Richtwerte, bitte pro Kunde anpassen." : "Dauer in Tagen und Vorgänger pro Aufgabe eintragen. Der Start jeder Aufgabe ergibt sich aus ihren Vorgängern.";
    }

    function ticksFor(total) { var steps = [1, 2, 5, 7, 14, 28, 56], s = 1; for (var i = 0; i < steps.length; i++) { s = steps[i]; if (total / s <= 10) break; } var out = []; for (var d = s; d < total; d += s) out.push(d); return out; }

    function drawChart() {
      var p = plan(); res = calc(p.tasks); var tot = Math.max(1, res.total);
      var rowsN = res.rows.length, ROW = 36;
      var idx = {}; res.rows.forEach(function (r, i) { idx[r.t.id] = i; });
      var tk = ticksFor(tot);
      var html = '<div class="bld-hd"><b>' + esc((p.kunde ? p.kunde + " · " : "") + p.name) + '</b><span>' + rowsN + " Aufgaben · Start " + esc(dfy.format(parse(p.start))) + '</span></div>' +
        '<div class="bld-ruler" id="bRul"><div class="bld-trk">' + tk.map(function (d) { return '<span class="tk" style="left:' + (d / tot * 100) + '%">T' + d + "</span>"; }).join("") + '</div></div><div class="bld-body">' +
        '<div class="bld-trk bld-grid" style="position:absolute;left:calc(var(--g) + 12px);right:calc(var(--m) + 12px);top:0;bottom:0">' + tk.map(function (d) { return '<i style="left:' + (d / tot * 100) + '%"></i>'; }).join("") + "</div>";
      res.rows.forEach(function (r, i) {
        var t0 = r.t, s = addDays(p.start, Math.round(r.start)), e = addDays(p.start, Math.round(r.end));
        html += '<div class="bld-row" data-i="' + i + '" data-s="queued"><div class="bld-lbl"><em>' + String(res.rows.indexOf(r) + 1).padStart(2, "0") + "</em><span title=\"" + esc(t0.name) + "\">" + esc(t0.name || "Aufgabe") + '</span></div><div class="bld-tr"><div class="bld-bar' + (r.crit ? " crit" : "") + (t0.team === "kunde" ? " kunde" : "") + '" style="left:' + (r.start / tot * 100) + "%;width:" + (r.dur / tot * 100) + '%"><i></i></div></div><div class="bld-m">' + r.dur + (r.dur === 1 ? " Tag" : " Tage") + " · " + esc(df.format(s)) + (r.dur > 1 ? " bis " + esc(df.format(addDays(p.start, Math.round(r.end) - 1))) : "") + "</div></div>";
      });
      // Abhängigkeitslinien
      var paths = "";
      res.rows.forEach(function (r, i) {
        (r.t.dep || []).forEach(function (d) {
          var j = idx[d]; if (j == null || j === i) return; var pr = res.rows[j];
          var x1 = pr.end / tot * 1000, x2 = r.start / tot * 1000, y1 = (j + 0.5) * ROW + 4, y2 = (i + 0.5) * ROW + 4, mx = Math.min(x2 - 6, x1 + 10);
          paths += '<path class="' + (pr.crit && r.crit && Math.abs(pr.end + (+r.t.gap || 0) - r.start) < 1e-6 ? "crit" : "") + '" d="M' + x1 + " " + y1 + " L" + Math.max(x1, mx) + " " + y1 + " L" + Math.max(x1, mx) + " " + y2 + " L" + x2 + " " + y2 + '"/>';
        });
      });
      html += '<svg class="bld-svg" viewBox="0 0 1000 ' + (rowsN * ROW + 8) + '" preserveAspectRatio="none" aria-hidden="true">' + paths + '</svg><div class="bld-ph" aria-hidden="true"><i></i></div></div>' +
        '<div class="bld-sc"><button class="bld-play" type="button" id="bPlay" aria-label="Abspielen">▶</button><div class="bld-rail" id="bRail" role="slider" tabindex="0" aria-label="Zeitpunkt im Projekt" aria-valuemin="0" aria-valuemax="' + tot + '"><b></b><u></u></div><span class="bld-clk" id="bClk"></span></div>';
      chart.innerHTML = html;
      paintKpi(); paint(); focusDp();
    }

    function paintKpi() {
      var p = plan(), tot = res.total, sumDays = 0, crit = 0; res.rows.forEach(function (r) { sumDays += r.dur; if (r.crit) crit += r.dur; });
      var par = tot ? sumDays / tot : 0, end = addDays(p.start, Math.max(0, Math.round(tot) - 1));
      kpi.innerHTML = '<div><small>Gesamtdauer</small><b>' + tot + '</b><span>' + (tot === 1 ? "Tag" : "Tage") + " · ca. " + (tot / 7).toFixed(1).replace(".", ",") + " Wochen</span></div>" +
        '<div><small>Fertig am</small><b style="font-size:20px">' + esc(df.format(end)) + '</b><span>' + esc(end.getFullYear()) + "</span></div>" +
        '<div><small>Kritischer Pfad</small><b>' + res.rows.filter(function (r) { return r.crit; }).length + '</b><span>Aufgaben bestimmen das Ende</span></div>' +
        '<div><small>Parallelität</small><b>' + par.toFixed(1).replace(".", ",") + '×</b><span>Arbeitstage pro Kalendertag</span></div>';
    }

    function paint() {
      var tot = Math.max(1, res.total), ratio = Math.min(1, t / tot);
      chart.style.setProperty("--t", ratio.toFixed(5));
      [].forEach.call(chart.querySelectorAll(".bld-row"), function (row) {
        var r = res.rows[+row.getAttribute("data-i")]; if (!r) return;
        var pr = r.dur > 0 ? Math.max(0, Math.min(1, (t - r.start) / r.dur)) : (t >= r.start ? 1 : 0);
        row.querySelector(".bld-bar").style.setProperty("--p", pr.toFixed(4));
        row.setAttribute("data-s", t < r.start ? "queued" : pr < 1 ? "run" : "done");
      });
      var clk = chart.querySelector("#bClk"); if (clk) { var d = addDays(plan().start, Math.floor(t)); clk.textContent = "Tag " + Math.min(res.total, Math.floor(t) + (t < res.total ? 1 : 0)) + " von " + res.total + " · " + df.format(d); }
      var rail = chart.querySelector("#bRail"); if (rail) rail.setAttribute("aria-valuenow", Math.round(t));
      var pb = chart.querySelector("#bPlay"); if (pb) { pb.textContent = playing ? "❚❚" : "▶"; pb.setAttribute("aria-label", playing ? "Pausieren" : "Abspielen"); }
    }
    function loop(now) {
      raf = 0; var dt = Math.min(100, now - (last || now)); last = now;
      var speed = Math.max(1, res.total) / 12; // ganze Laufzeit in ca. 12 Sekunden
      t += dt / 1000 * speed;
      if (t >= res.total) { t = res.total; playing = false; }
      paint();
      if (playing) raf = requestAnimationFrame(loop);
    }
    function play() { if (t >= res.total) t = 0; playing = true; last = 0; if (!raf) raf = requestAnimationFrame(loop); paint(); }
    function pause() { playing = false; cancelAnimationFrame(raf); raf = 0; paint(); }

    function drawEditor() {
      var p = plan();
      ed.innerHTML = '<h3>Aufgaben und Abhängigkeiten</h3><p class="bld-note" style="margin-bottom:10px">„Nach“ legt fest, was fertig sein muss, bevor die Aufgabe startet. „Puffer“ sind zusätzliche Wartetage nach dem Vorgänger.</p><table><thead><tr><th>Aufgabe</th><th>Tage</th><th>Nach</th><th>Puffer</th><th>Wer</th><th></th></tr></thead><tbody>' +
        p.tasks.map(function (t0, i) {
          var names = (t0.dep || []).map(function (d) { var x = p.tasks.filter(function (q) { return q.id === d; })[0]; return x ? x.name : ""; }).filter(Boolean);
          return '<tr data-id="' + t0.id + '"><td><input type="text" data-f="name" value="' + esc(t0.name) + '" aria-label="Name der Aufgabe ' + (i + 1) + '"></td>' +
            '<td><input type="number" min="0" step="1" data-f="days" value="' + esc(t0.days) + '" aria-label="Dauer in Tagen"></td>' +
            '<td><details data-dp="' + t0.id + '"' + (openDp === t0.id ? " open" : "") + '><summary>' + esc(names.length ? names.join(", ") : "Start des Projekts") + '</summary><div class="dp">' +
            p.tasks.filter(function (q) { return q.id !== t0.id; }).map(function (q) { return '<label><input type="checkbox" data-dep="' + q.id + '"' + ((t0.dep || []).indexOf(q.id) > -1 ? " checked" : "") + "> " + esc(q.name || "Aufgabe") + "</label>"; }).join("") + '</div></details></td>' +
            '<td><input type="number" min="0" step="1" data-f="gap" value="' + esc(t0.gap || 0) + '" aria-label="Puffer in Tagen"></td>' +
            '<td><select data-f="team" aria-label="Wer macht es">' + TEAMS.map(function (x) { return '<option value="' + x[0] + '"' + (t0.team === x[0] ? " selected" : "") + ">" + x[1] + "</option>"; }).join("") + '</select></td>' +
            '<td><button class="x" type="button" data-del="' + t0.id + '" aria-label="Aufgabe löschen">×</button></td></tr>';
        }).join("") + '</tbody></table><p style="margin:12px 0 0"><button class="bb pri" type="button" id="bAdd">+ Aufgabe</button></p>';
    }
    function focusDp() {}

    function full() { drawTop(); drawChart(); drawEditor(); }
    function chartOnly() { drawChart(); }

    host.addEventListener("change", function (ev) {
      var el = ev.target, p = plan();
      if (el.id === "bPlan") { data.cur = el.value; t = 0; pause(); save(); full(); return; }
      if (el.id === "bNew") { var k = el.value; if (!k) return; var np = k === "leer" ? { id: uid(), name: "Neuer Plan", kunde: "", start: today(), note: "", tasks: [] } : fromTemplate(k, p.kunde, p.start); data.plans.push(np); data.cur = np.id; t = 0; pause(); save(); full(); return; }
      if (el.id === "bStart") { p.start = el.value || today(); save(); chartOnly(); return; }
      if (el.getAttribute("data-dep")) {
        var tr = el.closest("tr"), task = p.tasks.filter(function (q) { return q.id === tr.getAttribute("data-id"); })[0], d = el.getAttribute("data-dep");
        task.dep = (task.dep || []).filter(function (x) { return x !== d; }); if (el.checked) task.dep.push(d);
        openDp = task.id; save(); drawChart(); drawEditor(); return;
      }
      var f = el.getAttribute("data-f"); if (f) { var tr2 = el.closest("tr"), t2 = p.tasks.filter(function (q) { return q.id === tr2.getAttribute("data-id"); })[0]; t2[f] = (f === "days" || f === "gap") ? Math.max(0, Math.round(+el.value || 0)) : el.value; save(); chartOnly(); if (f === "name") drawEditor(); }
    });
    host.addEventListener("input", function (ev) {
      var el = ev.target, p = plan();
      if (el.id === "bKunde") { p.kunde = el.value; save(); var h = chart.querySelector(".bld-hd b"); if (h) h.textContent = (p.kunde ? p.kunde + " · " : "") + p.name; return; }
      if (el.id === "bName") { p.name = el.value; save(); var h2 = chart.querySelector(".bld-hd b"); if (h2) h2.textContent = (p.kunde ? p.kunde + " · " : "") + p.name; return; }
      if (el.getAttribute("data-f") === "name") { var tr = el.closest("tr"), t0 = p.tasks.filter(function (q) { return q.id === tr.getAttribute("data-id"); })[0]; if (t0) { t0.name = el.value; save(); } }
    });
    host.addEventListener("click", function (ev) {
      var p = plan(), b = ev.target.closest("button"); if (!b) return;
      if (b.id === "bPlay") { playing ? pause() : play(); return; }
      if (b.id === "bAdd") { p.tasks.push({ id: uid(), name: "Neue Aufgabe", days: 1, dep: p.tasks.length ? [p.tasks[p.tasks.length - 1].id] : [], team: "alle", gap: 0 }); save(); drawChart(); drawEditor(); return; }
      if (b.getAttribute("data-del")) { var id = b.getAttribute("data-del"); p.tasks = p.tasks.filter(function (q) { return q.id !== id; }); p.tasks.forEach(function (q) { q.dep = (q.dep || []).filter(function (d) { return d !== id; }); }); save(); drawChart(); drawEditor(); return; }
      if (b.id === "bDup") { var cp = JSON.parse(JSON.stringify(p)); cp.id = uid(); cp.name = p.name + " Kopie"; data.plans.push(cp); data.cur = cp.id; save(); full(); return; }
      if (b.id === "bDel") { if (!window.confirm("Diesen Plan löschen?")) return; data.plans = data.plans.filter(function (q) { return q.id !== p.id; }); if (!data.plans.length) data.plans.push(fromTemplate("reel", "", today())); data.cur = data.plans[0].id; save(); t = 0; pause(); full(); return; }
      if (b.id === "bCopy") {
        var r = calc(p.tasks), lines = [(p.kunde ? p.kunde + " · " : "") + p.name + " · Start " + dfy.format(parse(p.start)) + " · " + r.total + " Tage"];
        r.rows.forEach(function (x, i) { lines.push((i + 1) + ". " + x.t.name + ": " + x.dur + " Tage, " + df.format(addDays(p.start, Math.round(x.start))) + " bis " + df.format(addDays(p.start, Math.max(Math.round(x.start), Math.round(x.end) - 1))) + " (" + TEAMNAME[x.t.team] + ")" + (x.crit ? ", kritisch" : "")); });
        var txt = lines.join("\n"); (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(function () { b.textContent = "Kopiert"; setTimeout(function () { b.textContent = "Als Text kopieren"; }, 1500); }, function () { window.prompt("Zum Kopieren:", txt); });
      }
    });
    function scrubFrom(el, x) { var r = el.getBoundingClientRect(), inset = el.id === "bRail" ? 6 : 0, trk = el.id === "bRul" ? el.querySelector(".bld-trk").getBoundingClientRect() : null; var left = trk ? trk.left : r.left + inset, w = trk ? trk.width : r.width - inset * 2; if (w > 0) { t = Math.max(0, Math.min(res.total, (x - left) / w * res.total)); paint(); } }
    var dragEl = null;
    host.addEventListener("pointerdown", function (ev) { var el = ev.target.closest("#bRul,#bRail"); if (!el) return; dragEl = el; pause(); try { el.setPointerCapture(ev.pointerId); } catch (e) { /* egal */ } scrubFrom(el, ev.clientX); });
    host.addEventListener("pointermove", function (ev) { if (dragEl) scrubFrom(dragEl, ev.clientX); });
    host.addEventListener("pointerup", function () { dragEl = null; });
    host.addEventListener("keydown", function (ev) { if (ev.target.id !== "bRail") return; var st = res.total / 50; if (ev.key === "ArrowRight") t = Math.min(res.total, t + st); else if (ev.key === "ArrowLeft") t = Math.max(0, t - st); else if (ev.key === "Home") t = 0; else if (ev.key === "End") t = res.total; else return; ev.preventDefault(); paint(); });

    full();
    t = res.total; paint(); // fertig angezeigt, Abspielen auf Wunsch
    return { dispose: function () { dead = true; cancelAnimationFrame(raf); host.innerHTML = ""; } };
  }

  window.SBBuilder = { mount: mount, templates: TEMPLATES };
})();
