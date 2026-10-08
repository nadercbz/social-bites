/* Skyline: ein Jahr Aktivität als Heatmap, die sich zur isometrischen Stadt aufklappt (und zurück).
   Vanilla Port der Contribution Skyline (21st.dev), ohne React und Tailwind, im Look von Social Bites.
   Ein Canvas, eine Szene: 2D ist das Raster von oben, 3D dasselbe Raster von der Ecke. Beim Umschalten schwenkt eine Kamera,
   und die Säulen wachsen als Welle von der ältesten zur neuesten Woche.
   Aufruf:  SBSkyline.mount(element, { data:[{date:"2026-10-09",count:3}], endDate:"2026-10-09", unit:"Event", unitPlural:"Events", title:"…" })
   Nur echte Zahlen übergeben, es gibt hier bewusst keinen Beispieldaten Generator. */
(function () {
  "use strict";
  var DAY_MS = 86400000;
  var clamp01 = function (v) { return v > 0 ? (v < 1 ? v : 1) : 0; };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var easeInOutCubic = function (x) { var t = clamp01(x); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  var easeOutCubic = function (x) { return 1 - Math.pow(1 - clamp01(x), 3); };
  var smoothstep = function (a, b, x) { var t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  var toKey = function (ms) { return new Date(ms).toISOString().slice(0, 10); };
  var dayMs = function (v) {
    if (typeof v === "number") return Math.floor(v / DAY_MS) * DAY_MS;
    if (typeof v === "string") {
      var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
      if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3]);
      v = new Date(v);
    }
    return Date.UTC(v.getFullYear(), v.getMonth(), v.getDate());
  };

  function levelOf(count, busy) { return count <= 0 ? 0 : busy <= 0 ? 4 : 1 + Math.min(3, Math.floor((count / busy) * 4)); }

  function buildGrid(data, endMs, weekStart) {
    var counts = {}, i, d;
    for (i = 0; i < data.length; i++) {
      d = data[i];
      if (!d || typeof d.date !== "string") continue;
      var ms = dayMs(d.date), c = Number(d.count);
      if (!isFinite(ms) || !(c > 0) || !isFinite(c)) continue;
      var k = toKey(ms);
      counts[k] = (counts[k] || 0) + c;
    }
    var start = endMs - 364 * DAY_MS;
    start -= ((new Date(start).getUTCDay() - weekStart + 7) % 7) * DAY_MS;
    var cells = [];
    for (var m2 = start, n = 0; m2 <= endMs; m2 += DAY_MS, n++) {
      var date = toKey(m2);
      cells.push({ date: date, count: counts[date] || 0, level: 0, week: Math.floor(n / 7), day: n % 7 });
    }
    var nz = cells.map(function (x) { return x.count; }).filter(function (x) { return x > 0; }).sort(function (a, b) { return a - b; });
    var busy = nz.length ? nz[Math.floor(0.95 * (nz.length - 1))] : 0;
    cells.forEach(function (x) { x.level = levelOf(x.count, busy); });
    return { cells: cells, weeks: cells.length ? cells[cells.length - 1].week + 1 : 0, max: nz.length ? nz[nz.length - 1] : 0 };
  }

  function computeStats(cells) {
    var total = 0, best = 0, bestDate = null, active = 0;
    cells.forEach(function (c) { total += c.count; if (c.count > 0) active++; if (c.count > best) { best = c.count; bestDate = c.date; } });
    return { total: total, busiest: { count: best, date: bestDate }, active: active, avg: active ? total / active : 0,
      first: cells.length ? cells[0].date : null, last: cells.length ? cells[cells.length - 1].date : null };
  }

  function monthLabels(cells, weeks, fmt) {
    var out = [], prev = -1;
    for (var w = 0; w < weeks; w++) {
      var c = cells[w * 7];
      if (!c) break;
      var m = +c.date.slice(5, 7);
      if (m !== prev) out.push({ week: w, label: fmt.format(dayMs(c.date)) });
      prev = m;
    }
    if (out.length > 1 && out[1].week - out[0].week < 3) out.shift();
    return out;
  }

  var barHeight = function (count, max, scale) { return count > 0 && max > 0 ? 0.4 + Math.pow(count / max, 0.85) * 7.2 * (scale || 1) : 0.2; };
  var WAVE = 0.42;
  var riseAt = function (t, week, weeks, day) {
    var d = (weeks > 1 ? week / (weeks - 1) : 0) * 0.36 + (day / 6) * 0.06;
    return easeOutCubic((t - d) / (1 - WAVE));
  };
  var YAW_3D = Math.PI / 4, ELEV_3D = (34 * Math.PI) / 180;
  var YAW_RANGE = [(8 * Math.PI) / 180, (82 * Math.PI) / 180], ELEV_RANGE = [(18 * Math.PI) / 180, (62 * Math.PI) / 180];
  function camera(e, dYaw, dElev) {
    var yaw = Math.min(YAW_RANGE[1], Math.max(0, lerp(0, YAW_3D + (dYaw || 0), e)));
    var elev = lerp(Math.PI / 2, Math.min(ELEV_RANGE[1], Math.max(ELEV_RANGE[0], ELEV_3D + (dElev || 0))), e);
    return { cs: Math.cos(yaw), sn: Math.sin(yaw), se: Math.sin(elev), ce: Math.cos(elev) };
  }
  var project = function (c, x, y, z) { return [x * c.cs - y * c.sn, (x * c.sn + y * c.cs) * c.se - z * c.ce]; };
  var mixRGB = function (a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; };
  var luminance = function (c) { return (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255; };
  var rgbString = function (r, g, b) { return "rgb(" + Math.round(r) + "," + Math.round(g) + "," + Math.round(b) + ")"; };

  var PALETTES = {
    bites: { light: ["#FDE3D2", "#F9A06B", "#F26A21", "#B8420C"], dark: ["#4A2410", "#8E3F14", "#E0601E", "#FFA466"] },
    mint: { light: ["#D5E3D0", "#9CC49A", "#4F9A66", "#1F6B45"], dark: ["#1E3A2A", "#2F6A48", "#46A56B", "#8BE0A6"] }
  };
  var FG_FALLBACK = [35, 35, 33], BG_FALLBACK = [255, 255, 255];
  var probe = null;
  function toRGB(color, fallback) {
    if (!probe) { var c = document.createElement("canvas"); c.width = c.height = 1; probe = c.getContext("2d", { willReadFrequently: true }); }
    if (!probe) return fallback;
    probe.clearRect(0, 0, 1, 1);
    probe.fillStyle = "rgba(0,0,0,0)";
    probe.fillStyle = color;
    probe.fillRect(0, 0, 1, 1);
    var d = probe.getImageData(0, 0, 1, 1).data;
    if (d[3] < 8) return fallback;
    return [d[0], d[1], d[2]];
  }
  function pointInQuad(p, o, x, y) {
    var sign = 0;
    for (var k = 0; k < 4; k++) {
      var ax = p[o + k * 2], ay = p[o + k * 2 + 1], bx = p[o + ((k + 1) % 4) * 2], by = p[o + ((k + 1) % 4) * 2 + 1];
      var cross = (bx - ax) * (y - ay) - (by - ay) * (x - ax);
      if (Math.abs(cross) < 1e-9) continue;
      var s = cross > 0 ? 1 : -1;
      if (sign === 0) sign = s; else if (s !== sign) return false;
    }
    return sign !== 0;
  }
  function quadPath(ctx, p, o, r) {
    if (r < 0.3) {
      ctx.moveTo(p[o], p[o + 1]); ctx.lineTo(p[o + 2], p[o + 3]); ctx.lineTo(p[o + 4], p[o + 5]); ctx.lineTo(p[o + 6], p[o + 7]); ctx.closePath();
      return;
    }
    ctx.moveTo((p[o + 6] + p[o]) / 2, (p[o + 7] + p[o + 1]) / 2);
    for (var k = 0; k < 4; k++) { var b = (k + 1) % 4; ctx.arcTo(p[o + k * 2], p[o + k * 2 + 1], p[o + b * 2], p[o + b * 2 + 1], r); }
    ctx.closePath();
  }

  var GRID_ICON = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1" fill="currentColor"/><rect x="9" y="1.5" width="5.5" height="5.5" rx="1" fill="currentColor"/><rect x="1.5" y="9" width="5.5" height="5.5" rx="1" fill="currentColor"/><rect x="9" y="9" width="5.5" height="5.5" rx="1" fill="currentColor"/></svg>';
  var CUBE_ICON = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M8 1.2 14.2 4.6v6.8L8 14.8 1.8 11.4V4.6Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M1.8 4.6 8 8l6.2-3.4M8 8v6.8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>';

  var CSS = '\
.sky{position:relative;width:100%;border:1px solid var(--line,rgba(35,35,33,.14));border-radius:16px;padding:14px;background:var(--card,#fff);color:var(--ink,#232321);font-family:inherit;box-sizing:border-box;}\
.sky *{box-sizing:border-box;}\
.sky-h{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px 16px;margin-bottom:12px;}\
.sky-t{margin:0;font-size:15px;font-weight:500;line-height:1.3;letter-spacing:-.01em;}\
.sky-t b{font-weight:800;}\
.sky-tog{position:relative;display:inline-flex;border:1px solid var(--line,rgba(35,35,33,.14));border-radius:10px;padding:2px;}\
.sky-pill{position:absolute;top:2px;bottom:2px;left:2px;width:32px;border-radius:8px;background:var(--ink,#232321);transition:transform .5s cubic-bezier(.65,0,.35,1);}\
.sky-tog button{position:relative;z-index:1;display:grid;place-items:center;width:32px;height:28px;border:0;background:transparent;padding:0;border-radius:8px;cursor:pointer;color:var(--mute,#6C6F68);transition:color .5s;}\
.sky-tog button[aria-pressed="true"]{color:var(--card,#fff);}\
.sky button:focus-visible,.sky canvas:focus-visible{outline:2px solid var(--accent-ink,#C4490F);outline-offset:2px;}\
.sky-box{position:relative;border:1px solid var(--line,rgba(35,35,33,.14));border-radius:12px;}\
.sky-in{position:relative;padding:12px 12px 0;}\
.sky-stage{position:relative;width:100%;overflow:hidden;border-radius:8px;height:150px;}\
.sky-stage canvas{position:absolute;top:0;left:0;display:block;max-width:none;outline:none;}\
.sky-tip{position:absolute;top:12px;left:12px;z-index:5;pointer-events:none;white-space:nowrap;border-radius:8px;padding:7px 10px;font-size:12px;line-height:1;background:var(--ink,#232321);color:var(--card,#fff);box-shadow:0 8px 20px rgba(0,0,0,.25);opacity:0;transition:opacity .15s;}\
.sky-tip i{position:absolute;top:100%;left:var(--arrow,50%);margin-left:-5px;border:5px solid transparent;border-top-color:var(--ink,#232321);border-bottom:0;}\
.sky-tip span{opacity:.75;}\
.sky-cn{position:absolute;display:flex;flex-direction:column;gap:20px;pointer-events:none;opacity:0;transition:opacity .3s,transform .3s cubic-bezier(.65,0,.35,1);}\
.sky-cn.tr{top:4px;right:4px;align-items:flex-end;transform:translateY(-10px);}\
.sky-cn.bl{bottom:4px;left:4px;align-items:flex-start;transform:translateY(10px);}\
.sky.is3 .sky-cn{opacity:1;transform:none;transition-duration:.6s;}\
.sky.is3 .sky-cn.tr{transition-delay:var(--d1,700ms);}\
.sky.is3 .sky-cn.bl{transition-delay:var(--d2,820ms);}\
.sky-st{min-width:0;}\
.sky-st .l{font-size:12.5px;line-height:1.2;color:var(--mute,#6C6F68);}\
.sky-st .v{display:flex;align-items:baseline;gap:6px;margin-top:3px;}\
.sky-st .v b{font-weight:800;line-height:1;letter-spacing:-.03em;font-variant-numeric:tabular-nums;transition:color .5s;}\
.sky-st .v span{font-size:14px;}\
.sky-st .s{margin-top:2px;font-size:11.5px;color:var(--mute,#6C6F68);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}\
.sky-row{display:grid;grid-template-rows:1fr;transition:grid-template-rows var(--dur,1300ms) cubic-bezier(.65,0,.35,1),opacity var(--dur,1300ms) cubic-bezier(.65,0,.35,1);}\
.sky-row>div{min-height:0;overflow:hidden;}\
.sky-row .g{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px 16px;padding:14px 12px 4px;}\
@media (min-width:760px){.sky-row .g{grid-template-columns:repeat(4,minmax(0,1fr));}}\
.sky.wide.is3 .sky-row{grid-template-rows:0fr;opacity:0;}\
.sky-ft{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px 16px;padding:10px 12px 12px;font-size:12px;color:var(--mute,#6C6F68);}\
.sky-hint{position:relative;display:grid;flex:1;}\
.sky-hint span{grid-area:1/1;transition:opacity .5s;}\
.sky-lg{display:flex;align-items:center;gap:6px;}\
.sky-lg button{width:11px;height:11px;border:0;padding:0;border-radius:2px;cursor:pointer;box-shadow:inset 0 0 0 1px rgba(127,127,127,.15);transition:background-color .5s,transform .2s;}\
.sky-lg button:hover{transform:scale(1.25);}\
.sky-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;}\
@media (prefers-reduced-motion:reduce){.sky *{transition:none!important;}}';
  var cssDone = false;
  function addCss() { if (cssDone) return; cssDone = true; var s = document.createElement("style"); s.textContent = CSS; document.head.appendChild(s); }

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  function mount(host, opts) {
    opts = opts || {};
    addCss();
    var locale = opts.locale || "de-DE";
    var unit = opts.unit || "Aktion", plural = opts.unitPlural || unit + "s";
    var L = Object.assign({ total: "Gesamt", busiest: "Stärkster Tag", active: "Aktive Tage", avg: "Ø pro aktivem Tag", days: "Tage", less: "Weniger", more: "Mehr", flat: "Flache Heatmap", city: "3D Skyline", no: "Keine", on: "am",
      hint2: "Tag überfahren für Details · Pfeiltasten zum Erkunden", hint3: "Ziehen zum Drehen · Doppelklick setzt zurück", levels: ["Keine", "Wenig", "Mittel", "Viel", "Am meisten"] }, opts.labels || {});
    var duration = opts.duration || 1300, heightScale = opts.heightScale || 1, weekStart = opts.weekStart == null ? 1 : opts.weekStart, orbit = opts.orbit !== false;
    var pal = opts.palette ? (typeof opts.palette === "string" ? PALETTES[opts.palette] || PALETTES.bites : opts.palette) : PALETTES.bites;

    var nf = new Intl.NumberFormat(locale);
    var df = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" });
    var dfy = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
    var dfl = new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
    var mf = new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" });
    var wf = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" });
    var noun = function (n) { return n === 1 ? unit : plural; };

    var data = opts.data || [];
    var dates = data.map(function (d) { return dayMs(d.date); }).filter(isFinite);
    var endMs = opts.endDate != null ? dayMs(opts.endDate) : (dates.length ? Math.max.apply(null, dates) : dayMs(new Date()));
    var model = buildGrid(data, endMs, weekStart);
    model.stats = computeStats(model.cells);
    model.months = monthLabels(model.cells, model.weeks, mf);
    var stats = model.stats;

    var title = opts.title != null ? opts.title : '<b>' + nf.format(stats.total) + '</b> ' + esc(noun(stats.total)) + ' im Zeitraum';
    var rangeTxt = function (a, b, y) { if (!a || !b) return "–"; var f = y ? dfy : df; return f.format(dayMs(a)) + " bis " + f.format(dayMs(b)); };
    var blocks = [
      { l: L.total, v: nf.format(stats.total), u: noun(stats.total), s: rangeTxt(stats.first, stats.last, true) },
      { l: L.busiest, v: nf.format(stats.busiest.count), u: noun(stats.busiest.count), s: stats.busiest.date ? df.format(dayMs(stats.busiest.date)) : "–" },
      { l: L.active, v: nf.format(stats.active), u: stats.active === 1 ? "Tag" : L.days, s: "mit mindestens 1 " + unit },
      { l: L.avg, v: nf.format(Math.round(stats.avg * 10) / 10), u: noun(2), s: "an aktiven Tagen" }
    ];
    function statHtml(b, size) {
      return '<div class="sky-st"><div class="l">' + esc(b.l) + '</div><div class="v"><b style="font-size:' + size + 'px">' + esc(b.v) + '</b><span>' + esc(b.u) + '</span></div><div class="s">' + esc(b.s) + '</div></div>';
    }
    var showStats = opts.showStats !== false;

    host.innerHTML = '<section class="sky" aria-label="' + esc(opts.ariaLabel || "Aktivität als Skyline") + '">' +
      '<header class="sky-h"><h3 class="sky-t">' + title + '</h3>' +
      '<div class="sky-tog" role="group" aria-label="Ansicht"><span class="sky-pill" aria-hidden="true"></span>' +
      '<button type="button" data-v="2d" aria-pressed="false" aria-label="' + esc(L.flat) + '" title="' + esc(L.flat) + '">' + GRID_ICON + '</button>' +
      '<button type="button" data-v="3d" aria-pressed="false" aria-label="' + esc(L.city) + '" title="' + esc(L.city) + '">' + CUBE_ICON + '</button></div></header>' +
      '<div class="sky-box"><div class="sky-in"><div class="sky-stage"><canvas tabindex="0" role="img"></canvas>' +
      (showStats ? '<div class="sky-cn tr" aria-hidden="true">' + statHtml(blocks[0], 40) + statHtml(blocks[1], 40) + '</div><div class="sky-cn bl" aria-hidden="true">' + statHtml(blocks[2], 40) + statHtml(blocks[3], 40) + '</div>' : '') +
      '</div><div class="sky-tip" role="tooltip" aria-hidden="true"></div></div>' +
      (showStats ? '<div class="sky-row"><div><div class="g">' + blocks.map(function (b) { return statHtml(b, 26); }).join("") + '</div></div></div>' : '') +
      '<div class="sky-ft"><span class="sky-hint"><span class="h2">' + esc(L.hint2) + '</span><span class="h3">' + esc(L.hint3) + '</span></span>' +
      '<div class="sky-lg"><span>' + esc(L.less) + '</span>' + [0, 1, 2, 3, 4].map(function (i) { return '<button type="button" data-lv="' + i + '" aria-pressed="false" aria-label="' + esc(L.levels[i]) + '" title="' + esc(L.levels[i]) + '"></button>'; }).join("") + '<span>' + esc(L.more) + '</span></div></div></div>' +
      '<p class="sky-sr" aria-live="polite"></p></section>';

    var root = host.firstChild, stage = root.querySelector(".sky-stage"), canvas = root.querySelector("canvas"), tip = root.querySelector(".sky-tip");
    var pill = root.querySelector(".sky-pill"), sr = root.querySelector(".sky-sr"), hint2 = root.querySelector(".h2"), hint3 = root.querySelector(".h3");
    var legendBtns = [].slice.call(root.querySelectorAll(".sky-lg button")), stBs = [].slice.call(root.querySelectorAll(".sky-st .v b"));
    var ctx = canvas.getContext("2d");
    if (!ctx) return null;
    root.style.setProperty("--dur", duration + "ms");
    root.style.setProperty("--d1", Math.round(duration * 0.55) + "ms");
    root.style.setProperty("--d2", Math.round(duration * 0.65) + "ms");
    canvas.setAttribute("aria-label", nf.format(stats.total) + " " + noun(stats.total) + " zwischen " + rangeTxt(stats.first, stats.last, true) + ". Mit den Pfeiltasten einzelne Tage lesen.");

    var reduceMq = window.matchMedia("(prefers-reduced-motion: reduce)");
    var reduced = reduceMq.matches;
    var view = opts.defaultView === "2d" ? "2d" : "3d";
    var t = 0, target = 0, entered = false;
    var yaw = 0, elev = 0, yawGoal = 0, elevGoal = 0;
    var W = 0, H2 = 0, H3 = 0, Hmax = 0, lastH = -1, dpr = 1, gutter = 30, labelW = 30, font = "10px sans-serif";
    var col = new Float32Array(15), colGoal = new Float32Array(15), colReady = false;
    var fg = FG_FALLBACK, bg = BG_FALLBACK, isDark = false;
    var cells = model.cells, n = cells.length, weeks = model.weeks;
    var wk = new Float32Array(n), dy = new Float32Array(n), lv = new Uint8Array(n), hgt = new Float32Array(n), zs = new Float32Array(n), hover = new Float32Array(n), dim = new Float32Array(n);
    var polys = new Float32Array(n * 24), faces = new Uint8Array(n), order = [], months = model.months, weekdayRows = [];
    var hovered = -1, pinned = -1, activeIdx = -1, tipW = 0, raf = 0, last = 0, legendLevel = -1;
    for (var i0 = 0; i0 < n; i0++) { var c0 = cells[i0]; wk[i0] = c0.week; dy[i0] = c0.day; lv[i0] = c0.level; hgt[i0] = barHeight(c0.count, model.max, heightScale); order.push(i0); }
    for (var d0 = 0; d0 < 7 && d0 < n; d0++) { var dow = new Date(dayMs(cells[d0].date)).getUTCDay(); if (dow === 1 || dow === 3 || dow === 5) weekdayRows.push({ day: d0, label: wf.format(dayMs(cells[d0].date)) }); }

    function describe(i) { var c = cells[i]; if (!c) return ""; return (c.count ? nf.format(c.count) + " " + noun(c.count) : L.no + " " + plural) + " " + L.on + " " + dfl.format(dayMs(c.date)); }

    function retheme() {
      var cs = getComputedStyle(root);
      fg = toRGB(cs.color, FG_FALLBACK) || FG_FALLBACK;
      var b = toRGB(cs.backgroundColor, null);
      bg = b || (luminance(fg) > 0.5 ? [10, 10, 10] : BG_FALLBACK);
      isDark = luminance(bg) < 0.45;
      font = "400 10px " + (cs.fontFamily || "sans-serif");
      var p = isDark ? pal.dark : pal.light;
      var empty = mixRGB(bg, fg, isDark ? 0.11 : 0.075);
      var all = [empty].concat(p.map(function (c) { return toRGB(c, FG_FALLBACK) || FG_FALLBACK; }));
      for (var k = 0; k < 5; k++) for (var ch = 0; ch < 3; ch++) colGoal[k * 3 + ch] = all[k][ch];
      if (!colReady || reduced) { col.set(colGoal); colReady = true; }
      ctx.font = font;
      labelW = Math.ceil(Math.max.apply(null, [20].concat(weekdayRows.map(function (r) { return ctx.measureText(r.label).width; })))) + 8;
      var sw = all.map(function (c) { return rgbString(c[0], c[1], c[2]); });
      legendBtns.forEach(function (bt, i) { bt.style.background = sw[i]; });
      stBs.forEach(function (bt) { bt.style.color = sw[4]; });
      kick();
    }

    function extent(cam, e, full) {
      var w = lerp(0.78, 0.9, e), off = (1 - w) / 2, minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
      function add(x, y, z) { var p = project(cam, x, y, z); if (p[0] < minx) minx = p[0]; if (p[0] > maxx) maxx = p[0]; if (p[1] < miny) miny = p[1]; if (p[1] > maxy) maxy = p[1]; }
      for (var i = 0; i < n; i++) {
        var x0 = wk[i] + off, y0 = dy[i] + off, z = full ? hgt[i] * e : zs[i];
        add(x0, y0, z); add(x0 + w, y0, z); add(x0, y0 + w, z); add(x0 + w, y0 + w, 0); add(x0, y0 + w, 0); add(x0 + w, y0, 0);
      }
      add(0, 7 + 1.5 * e, 0); add(weeks, 7 + 1.5 * e, 0);
      return { minx: minx, maxx: maxx, miny: miny, maxy: maxy };
    }

    function relayout() {
      var w = Math.round(stage.clientWidth);
      if (!w || !n) return;
      W = w;
      root.classList.toggle("wide", W >= 560);
      gutter = W < 520 ? 0 : labelW;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      var b2 = extent(camera(0), 0, true);
      H2 = 20 + 4 + ((b2.maxy - b2.miny) / (b2.maxx - b2.minx)) * (W - gutter - 4);
      var b3 = extent(camera(1), 1, true);
      var natural = ((b3.maxy - b3.miny) / (b3.maxx - b3.minx)) * (W - 40) + 40;
      H3 = Math.max(Math.min(natural, W * 0.72, 620), Math.min(natural, 240));
      Hmax = Math.ceil(Math.max(H2, H3));
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(Hmax * dpr);
      canvas.style.width = W + "px"; canvas.style.height = Hmax + "px";
      lastH = -1;
      draw();
    }

    function draw() {
      if (!W || !n) return;
      var e = easeInOutCubic(t), cam = camera(e, yaw, elev), Hc = lerp(H2, H3, e);
      if (Math.abs(Hc - lastH) > 0.2) { stage.style.height = Hc.toFixed(1) + "px"; lastH = Hc; }
      var i, k;
      for (i = 0; i < n; i++) zs[i] = riseAt(t, wk[i], weeks, dy[i]) * hgt[i];
      var b = extent(cam, e, false), pad = lerp(2, 20, e), left = pad + gutter * (1 - e), top = pad + 20 * (1 - e);
      var aw = W - left - pad, ah = Hc - top - pad, bw = Math.max(1e-6, b.maxx - b.minx), bh = Math.max(1e-6, b.maxy - b.miny);
      var s = Math.min(aw / bw, ah / bh), ox = left + (aw - bw * s) / 2 - b.minx * s, oy = top + (ah - bh * s) / 2 - b.miny * s;
      var cs = cam.cs, sn = cam.sn, se = cam.se, ce = cam.ce;
      var px = function (x, y) { return ox + (x * cs - y * sn) * s; };
      var py = function (x, y, z) { return oy + ((x * sn + y * cs) * se - z * ce) * s; };
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, Hmax);
      order.sort(function (a, c) { return (wk[a] + 0.5) * sn + (dy[a] + 0.5) * cs - ((wk[c] + 0.5) * sn + (dy[c] + 0.5) * cs); });
      var w = lerp(0.78, 0.9, e), off = (1 - w) / 2, radius = lerp(0.17, 0.03, e) * s, outline = (1 - e) * 0.07, lift = 0.7 * e;
      var ex = col[0], ey = col[1], ez = col[2];
      for (k = 0; k < n; k++) {
        i = order[k];
        var x0 = wk[i] + off, y0 = dy[i] + off, x1 = x0 + w, y1 = y0 + w, z = zs[i] + hover[i] * lift, o = i * 24;
        polys[o] = px(x0, y0); polys[o + 1] = py(x0, y0, z); polys[o + 2] = px(x1, y0); polys[o + 3] = py(x1, y0, z);
        polys[o + 4] = px(x1, y1); polys[o + 5] = py(x1, y1, z); polys[o + 6] = px(x0, y1); polys[o + 7] = py(x0, y1, z);
        polys[o + 8] = px(x0, y1); polys[o + 9] = py(x0, y1, 0); polys[o + 10] = px(x1, y1); polys[o + 11] = py(x1, y1, 0);
        polys[o + 12] = polys[o + 4]; polys[o + 13] = polys[o + 5]; polys[o + 14] = polys[o + 6]; polys[o + 15] = polys[o + 7];
        polys[o + 16] = px(x1, y0); polys[o + 17] = py(x1, y0, 0); polys[o + 18] = polys[o + 10]; polys[o + 19] = polys[o + 11];
        polys[o + 20] = polys[o + 4]; polys[o + 21] = polys[o + 5]; polys[o + 22] = polys[o + 2]; polys[o + 23] = polys[o + 3];
        var tall = z * ce * s, f = 0;
        if (tall > 0.35 && w * cs * s > 0.35) f |= 1;
        if (tall > 0.35 && w * sn * s > 0.35) f |= 2;
        faces[i] = f;
        var Lx = lv[i] * 3, r = col[Lx], g = col[Lx + 1], bl = col[Lx + 2], d = dim[i];
        if (d > 0.002) { r += (ex - r) * 0.72 * d; g += (ey - g) * 0.72 * d; bl += (ez - bl) * 0.72 * d; }
        var hv = hover[i];
        if (hv > 0.002) { var m = 0.16 * hv; r += (fg[0] - r) * m; g += (fg[1] - g) * m; bl += (fg[2] - bl) * m; }
        if (f & 1) { ctx.beginPath(); quadPath(ctx, polys, o + 8, 0); ctx.fillStyle = rgbString(r * 0.84, g * 0.84, bl * 0.84); ctx.fill(); }
        if (f & 2) { ctx.beginPath(); quadPath(ctx, polys, o + 16, 0); ctx.fillStyle = rgbString(r * 0.68, g * 0.68, bl * 0.68); ctx.fill(); }
        ctx.beginPath(); quadPath(ctx, polys, o, radius); ctx.fillStyle = rgbString(r, g, bl); ctx.fill();
        if (outline > 0.004) { ctx.strokeStyle = "rgba(" + fg[0] + "," + fg[1] + "," + fg[2] + "," + outline.toFixed(3) + ")"; ctx.lineWidth = 1; ctx.stroke(); }
        if (hv > 0.02) { ctx.strokeStyle = "rgba(" + fg[0] + "," + fg[1] + "," + fg[2] + "," + (0.85 * hv).toFixed(3) + ")"; ctx.lineWidth = 1.5; ctx.stroke(); }
      }
      var muted = mixRGB(bg, fg, 0.55);
      ctx.font = font;
      var a2 = 1 - smoothstep(0, 0.4, e), a3 = smoothstep(0.62, 1, e), mi, mm, x, edge, tw;
      var rgba = function (a) { return "rgba(" + Math.round(muted[0]) + "," + Math.round(muted[1]) + "," + Math.round(muted[2]) + "," + a.toFixed(3) + ")"; };
      if (a2 > 0.004) {
        ctx.fillStyle = rgba(a2); ctx.textAlign = "left"; ctx.textBaseline = "bottom"; edge = -Infinity;
        for (mi = 0; mi < months.length; mi++) { mm = months[mi]; x = px(mm.week + off, -0.3); tw = ctx.measureText(mm.label).width; if (x < edge || x + tw > W) continue; ctx.fillText(mm.label, x, py(mm.week + off, -0.3, 0) - 3); edge = x + tw + 6; }
        ctx.textAlign = "right"; ctx.textBaseline = "middle";
        if (gutter > 0) weekdayRows.forEach(function (r) { ctx.fillText(r.label, px(0, r.day + 0.5) - 6, py(0, r.day + 0.5, 0)); });
      }
      if (a3 > 0.004) {
        ctx.fillStyle = rgba(a3); ctx.textAlign = "left"; ctx.textBaseline = "top"; edge = -Infinity;
        for (mi = 0; mi < months.length; mi++) { mm = months[mi]; x = px(mm.week + 0.5, 7.3); tw = ctx.measureText(mm.label).width; if (x < edge || x + tw > W) continue; ctx.fillText(mm.label, x, py(mm.week + 0.5, 7.3, 0) + 2); edge = x + tw + 10; }
      }
      if (activeIdx >= 0 && activeIdx < n) {
        i = activeIdx;
        var zz = zs[i] + hover[i] * lift, tx = px(wk[i] + 0.5, dy[i] + 0.5);
        var ty = Math.min(py(wk[i] + off, dy[i] + off, zz), py(wk[i] + off + w, dy[i] + off, zz), py(wk[i] + off, dy[i] + off + w, zz));
        var half = tipW / 2, cx = Math.min(W - half - 2, Math.max(half + 2, tx));
        tip.style.transform = "translate(" + (cx - half).toFixed(1) + "px," + (ty - 8).toFixed(1) + "px) translateY(-100%)";
        tip.style.setProperty("--arrow", (tx - cx + half).toFixed(1) + "px");
      }
    }

    function tick(now) {
      raf = 0;
      var dt = Math.min(0.05, Math.max(0, (now - last) / 1000)), moving = false;
      if (t !== target) { var step = reduced ? 1 : (dt * 1000) / Math.max(1, duration); t = target > t ? Math.min(target, t + step) : Math.max(target, t - step); moving = true; }
      var ko = reduced ? 1 : 1 - Math.exp(-dt * 12);
      yaw += (yawGoal - yaw) * ko; elev += (elevGoal - elev) * ko;
      if (Math.abs(yawGoal - yaw) > 1e-4 || Math.abs(elevGoal - elev) > 1e-4) moving = true; else { yaw = yawGoal; elev = elevGoal; }
      var kc = reduced ? 1 : 1 - Math.exp(-dt * 7), k;
      for (k = 0; k < 15; k++) { var dd = colGoal[k] - col[k]; if (Math.abs(dd) > 0.4) { col[k] += dd * kc; moving = true; } else col[k] = colGoal[k]; }
      var kh = reduced ? 1 : 1 - Math.exp(-dt * 16), kd = reduced ? 1 : 1 - Math.exp(-dt * 10);
      for (var i = 0; i < n; i++) {
        var hg = i === activeIdx ? 1 : 0, dg = legendLevel >= 0 && lv[i] !== legendLevel ? 1 : 0, h = hover[i], d = dim[i];
        if (h !== hg) { hover[i] = Math.abs(hg - h) < 0.003 ? hg : h + (hg - h) * kh; moving = true; }
        if (d !== dg) { dim[i] = Math.abs(dg - d) < 0.003 ? dg : d + (dg - d) * kd; moving = true; }
      }
      draw();
      if (moving) raf = requestAnimationFrame(tick);
    }
    function kick() { if (raf) return; last = performance.now(); raf = requestAnimationFrame(tick); }

    function setTip() {
      var c = cells[activeIdx];
      if (!c) { tip.style.opacity = 0; tip.setAttribute("aria-hidden", "true"); return; }
      tip.innerHTML = '<strong>' + esc(c.count ? nf.format(c.count) + " " + noun(c.count) : L.no + " " + plural) + '</strong><span> ' + esc(L.on) + ' ' + esc(dfy.format(dayMs(c.date))) + '</span><i></i>';
      tipW = tip.offsetWidth; tip.style.opacity = 1; tip.setAttribute("aria-hidden", "false");
    }
    function refreshActive() {
      var next = hovered >= 0 ? hovered : pinned;
      if (next === activeIdx) return;
      activeIdx = next; setTip(); kick();
    }
    function hit(x, y) {
      for (var k = n - 1; k >= 0; k--) {
        var i = order[k], o = i * 24;
        if (pointInQuad(polys, o, x, y)) return i;
        if (faces[i] & 1 && pointInQuad(polys, o + 8, x, y)) return i;
        if (faces[i] & 2 && pointInQuad(polys, o + 16, x, y)) return i;
      }
      return -1;
    }
    function local(ev) { var r = canvas.getBoundingClientRect(); return [ev.clientX - r.left, ev.clientY - r.top]; }
    var drag = null;
    canvas.addEventListener("pointerdown", function (ev) {
      if (ev.button !== 0) return;
      var can = orbit && target === 1;
      drag = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, yaw: yawGoal, elev: elevGoal, moved: false, orbit: can, mouse: ev.pointerType === "mouse" };
      if (can) { try { canvas.setPointerCapture(ev.pointerId); } catch (e) { /* egal */ } }
    });
    canvas.addEventListener("pointermove", function (ev) {
      if (drag && drag.orbit && ev.pointerId === drag.id) {
        var dx = ev.clientX - drag.x, dyy = ev.clientY - drag.y;
        if (drag.moved || Math.hypot(dx, dyy) > 4) {
          drag.moved = true;
          yawGoal = Math.min(YAW_RANGE[1] - YAW_3D, Math.max(YAW_RANGE[0] - YAW_3D, drag.yaw + dx * 0.006));
          if (drag.mouse) elevGoal = Math.min(ELEV_RANGE[1] - ELEV_3D, Math.max(ELEV_RANGE[0] - ELEV_3D, drag.elev + dyy * 0.004));
          canvas.style.cursor = "grabbing"; hovered = -1; refreshActive(); kick(); return;
        }
      }
      if (ev.pointerType !== "mouse") return;
      var p = local(ev), i = hit(p[0], p[1]);
      if (i !== hovered) { hovered = i; refreshActive(); }
      canvas.style.cursor = orbit && target === 1 ? "grab" : i >= 0 ? "pointer" : "default";
    });
    canvas.addEventListener("pointerup", function (ev) {
      if (!drag || ev.pointerId !== drag.id) return;
      var wasMoved = drag.moved; drag = null;
      if (canvas.hasPointerCapture && canvas.hasPointerCapture(ev.pointerId)) canvas.releasePointerCapture(ev.pointerId);
      canvas.style.cursor = orbit && target === 1 ? "grab" : "default";
      if (wasMoved) return;
      var p = local(ev), i = hit(p[0], p[1]);
      pinned = i === pinned ? -1 : i;
      if (ev.pointerType !== "mouse") hovered = -1;
      refreshActive();
      if (i >= 0 && opts.onCellClick) opts.onCellClick({ date: cells[i].date, count: cells[i].count });
    });
    canvas.addEventListener("pointercancel", function () { drag = null; });
    canvas.addEventListener("pointerleave", function () { if (drag) return; hovered = -1; refreshActive(); });
    canvas.addEventListener("dblclick", function () { yawGoal = 0; elevGoal = 0; kick(); });
    canvas.addEventListener("keydown", function (ev) {
      var keys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "Escape", "Enter", " "];
      if (keys.indexOf(ev.key) < 0 || !n) return;
      ev.preventDefault();
      if (ev.key === "Escape") { pinned = -1; hovered = -1; refreshActive(); return; }
      var i = pinned >= 0 ? pinned : activeIdx >= 0 ? activeIdx : n - 1;
      if (ev.key === "Enter" || ev.key === " ") { if (opts.onCellClick) opts.onCellClick({ date: cells[i].date, count: cells[i].count }); return; }
      if (pinned >= 0 || activeIdx >= 0) {
        if (ev.key === "ArrowLeft") i -= 7; if (ev.key === "ArrowRight") i += 7;
        if (ev.key === "ArrowUp") i -= 1; if (ev.key === "ArrowDown") i += 1;
        if (ev.key === "Home") i = 0; if (ev.key === "End") i = n - 1;
      }
      i = Math.max(0, Math.min(n - 1, i)); pinned = i; hovered = -1; refreshActive(); sr.textContent = describe(i);
    });
    canvas.addEventListener("blur", function () { pinned = -1; refreshActive(); });

    function setView(v) {
      view = v;
      root.classList.toggle("is3", v === "3d");
      pill.style.transform = v === "3d" ? "translateX(100%)" : "none";
      [].forEach.call(root.querySelectorAll(".sky-tog button"), function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-v") === v ? "true" : "false"); });
      var h3 = v === "3d" && orbit;
      hint2.style.opacity = h3 ? 0 : 1; hint3.style.opacity = h3 ? 1 : 0;
      hint2.setAttribute("aria-hidden", h3 ? "true" : "false"); hint3.setAttribute("aria-hidden", h3 ? "false" : "true");
      if (entered) applyTarget();
    }
    function applyTarget() {
      var goal = view === "3d" ? 1 : 0;
      if (goal !== target) { target = goal; if (goal === 0) { yawGoal = 0; elevGoal = 0; } canvas.style.cursor = orbit && target === 1 ? "grab" : "default"; kick(); }
    }
    root.querySelector(".sky-tog").addEventListener("click", function (ev) { var b = ev.target.closest("button[data-v]"); if (b) setView(b.getAttribute("data-v")); });
    var lg = root.querySelector(".sky-lg");
    lg.addEventListener("mouseleave", function () { legendLevel = -1; legendBtns.forEach(function (b) { b.setAttribute("aria-pressed", "false"); }); kick(); });
    legendBtns.forEach(function (b) {
      var lvl = +b.getAttribute("data-lv");
      function set(l) { legendLevel = l; legendBtns.forEach(function (x) { x.setAttribute("aria-pressed", +x.getAttribute("data-lv") === l ? "true" : "false"); }); kick(); }
      b.addEventListener("mouseenter", function () { set(lvl); });
      b.addEventListener("focus", function () { set(lvl); });
      b.addEventListener("blur", function () { set(-1); });
      b.addEventListener("click", function () { set(legendLevel === lvl ? -1 : lvl); });
    });

    setView(view);
    retheme();
    relayout();

    function enter() { if (entered) return; entered = true; if (reduced) t = view === "3d" ? 1 : 0; applyTarget(); }
    var io = null;
    if ("IntersectionObserver" in window) {
      io = new IntersectionObserver(function (es) { if (es.some(function (x) { return x.isIntersecting; })) { enter(); io.disconnect(); } }, { threshold: 0.35 });
      io.observe(stage);
    } else enter();
    var ro = new ResizeObserver(function () { if (Math.round(stage.clientWidth) !== W) relayout(); });
    ro.observe(stage);
    var mo = new MutationObserver(retheme);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style", "data-theme"] });
    reduceMq.addEventListener("change", function () { reduced = reduceMq.matches; kick(); });
    var darkMq = window.matchMedia("(prefers-color-scheme: dark)");
    darkMq.addEventListener("change", retheme);

    return {
      setView: setView,
      destroy: function () { if (raf) cancelAnimationFrame(raf); if (io) io.disconnect(); ro.disconnect(); mo.disconnect(); darkMq.removeEventListener("change", retheme); host.innerHTML = ""; }
    };
  }

  window.SBSkyline = { mount: mount, palettes: PALETTES };
})();
