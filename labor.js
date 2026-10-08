/* Labor: der Ablauf unserer Dienstleistung als 3D Maschine.
   Der Kunde wählt Bausteine (oder ein Paket als Vorlage), und die Stationen reihen sich in der richtigen Reihenfolge auf einem Förderband auf.
   Ein Auftrag fährt durch alle gewählten Stationen. Idee und Aufbau angelehnt an die Agentic Factory (21st.dev), neu gebaut für Social Bites mit three.js.
   Die Bausteine sind die echten Schritte aus dem Playbook, es stehen bewusst keine Preise oder Fristen darin, die nicht im Playbook stehen.
   Aufruf: SBLabor.mount(element) und zurück kommt eine dispose Funktion. Lädt three.js erst beim ersten Öffnen. */
(function () {
  "use strict";
  var THREE_URL = "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";
  var ORBIT_URL = "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js";
  var RBOX_URL = "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/geometries/RoundedBoxGeometry.js";

  /* Bausteine in fester Reihenfolge des Ablaufs. kind bestimmt die Form der Station. */
  var MODULES = [
    { id: "erst", name: "Erstgespräch", kind: "talk", team: "Tommy", desc: "Treffen vor Ort oder per Call. Wir hören zu, sehen den Laden und klären Ziel, Umfeld und Rahmen." },
    { id: "angebot", name: "Angebot", kind: "paper", team: "Tommy", desc: "Aus dem Gespräch wird ein klares Angebot. Kunde sagt zu, dann legen wir die Kundenakte an." },
    { id: "konzept", name: "Kick-off und Konzept", kind: "bulb", team: "Nader und Tommy", desc: "Gemeinsamer Start. Idee, Strategie und Plan für die Inhalte, abgestimmt mit der Marke." },
    { id: "pre", name: "Pre-Production", kind: "board", team: "Nader", desc: "Drehplan, Orte, Menschen, Technik. Alles ist organisiert, bevor die Kamera läuft." },
    { id: "dreh", name: "Dreh", kind: "cam", team: "Nader und Team", desc: "Der Drehtag im Laden oder vor Ort. Reels, Fotos und Bewegtbild für Social Media." },
    { id: "schnitt", name: "Schnitt und Freigabe", kind: "screen", team: "Nader", desc: "Schnitt, Ton, Untertitel. Der Kunde sieht alles im Portal und gibt frei, bevor etwas rausgeht." },
    { id: "ads", name: "Teaser und Ads", kind: "horn", team: "Tommy", desc: "Vorfreude aufbauen und bezahlte Reichweite dazunehmen, wenn es zum Projekt passt." },
    { id: "influencer", name: "Influencer Einsatz", kind: "heads", team: "Tommy und Nader", desc: "Creator aus unserem Netzwerk besuchen den Laden und tragen ihn in ihre Community." },
    { id: "event", name: "Opening Event", kind: "arch", team: "Tommy und Nader", desc: "Der große Tag. Event mit Gästen, Content live vor Ort und Aufmerksamkeit in der Stadt." },
    { id: "posting", name: "Posting und Community", kind: "phone", team: "Tommy", desc: "Veröffentlichen, Kommentare beantworten, dranbleiben. Die Community wird mit gepflegt." },
    { id: "report", name: "Report und Gespräch", kind: "bars", team: "Tommy", desc: "Was lief gut, was ziehen wir nach. Zahlen und nächste Schritte im Gespräch." },
    { id: "rechnung", name: "Rechnung und Ablage", kind: "stack", team: "Tommy", desc: "Rechnung raus, alle Dateien sauber in der Ablage. Danach gibt es die Option zu verlängern." }
  ];
  var PRESETS = {
    opening: { name: "Bites Opening", sub: "Neuer Laden mit Content und Opening Event", ids: ["erst", "angebot", "konzept", "pre", "dreh", "schnitt", "ads", "influencer", "event", "posting", "report", "rechnung"] },
    gastro: { name: "Bites for Gastro", sub: "Monatliche Betreuung für bestehende Läden", ids: ["erst", "angebot", "konzept", "pre", "dreh", "schnitt", "posting", "report", "rechnung"] },
    brands: { name: "Bites for Brands", sub: "Kampagnen für Ketten und Marken", ids: ["erst", "angebot", "konzept", "pre", "dreh", "schnitt", "ads", "influencer", "posting", "report", "rechnung"] }
  };

  var CSS = '\
.lab{display:grid;grid-template-columns:minmax(0,300px) minmax(0,1fr);gap:14px;align-items:start;}\
@media (max-width:900px){.lab{grid-template-columns:1fr;}}\
.lab-side{background:var(--card,#fff);border:1px solid var(--line,rgba(35,35,33,.14));border-radius:16px;padding:14px;}\
.lab-side h3{margin:0 0 4px;font-size:13px;letter-spacing:.02em;}\
.lab-side .sub{margin:0 0 10px;color:var(--mute,#6C6F68);font-size:12.5px;line-height:1.4;}\
.lab-pre{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;}\
.lab-pre button,.lab-cam button{font:650 12.5px/1 var(--display,system-ui,sans-serif);padding:8px 11px;border-radius:999px;border:1.5px solid var(--ink,#232321);background:transparent;color:inherit;cursor:pointer;transition:background-color .2s,color .2s;}\
.lab-pre button:hover,.lab-cam button:hover{background:var(--paper-2,#F2EEE2);}\
.lab-pre button[aria-pressed="true"],.lab-cam button[aria-pressed="true"]{background:var(--ink,#232321);color:var(--card,#fff);}\
.lab-list{display:grid;gap:6px;max-height:420px;overflow:auto;padding-right:2px;}\
.lab-it{display:grid;grid-template-columns:auto minmax(0,1fr);gap:10px;align-items:center;border:1px solid var(--line,rgba(35,35,33,.14));border-radius:12px;padding:8px 10px;cursor:pointer;background:transparent;text-align:left;color:inherit;font:inherit;transition:border-color .2s,background-color .2s;}\
.lab-it:hover{border-color:var(--ink,#232321);}\
.lab-it[aria-pressed="true"]{border-color:var(--accent,#F26A21);background:var(--accent-tint,#FDE3D2);}\
.lab-it .n{width:26px;height:26px;border-radius:8px;display:grid;place-items:center;font:700 11px/1 ui-monospace,Menlo,monospace;background:var(--paper-2,#F2EEE2);}\
.lab-it[aria-pressed="true"] .n{background:var(--accent,#F26A21);color:#fff;}\
.lab-it b{font-size:13.5px;font-weight:700;display:block;}\
.lab-it small{font-size:11.5px;color:var(--mute,#6C6F68);}\
.lab-main{position:relative;background:var(--card,#fff);border:1px solid var(--line,rgba(35,35,33,.14));border-radius:16px;overflow:hidden;}\
.lab-bar{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;justify-content:space-between;padding:10px 12px;border-bottom:1px solid var(--line,rgba(35,35,33,.14));}\
.lab-cam{display:flex;gap:6px;flex-wrap:wrap;}\
.lab-cnt{font:11px ui-monospace,Menlo,monospace;color:var(--mute,#6C6F68);letter-spacing:.04em;}\
.lab-stage{position:relative;height:clamp(380px,52vw,600px);background:radial-gradient(ellipse at 50% 45%,var(--paper-2,#F2EEE2),transparent 75%);touch-action:none;}\
.lab-stage canvas{display:block;width:100%;height:100%;}\
.lab-lbl{position:absolute;left:0;top:0;pointer-events:none;white-space:nowrap;font:700 11.5px/1 var(--display,system-ui,sans-serif);background:var(--ink,#232321);color:#fff;border-radius:8px;padding:6px 9px;opacity:.94;will-change:transform;}\
.lab-lbl i{font:700 10px ui-monospace,Menlo,monospace;color:var(--accent,#F26A21);margin-right:7px;font-style:normal;}\
.lab-lbl.sel{background:var(--accent,#F26A21);}\
.lab-lbl.sel i{color:#fff;}\
.lab-info{padding:12px 14px;border-top:1px solid var(--line,rgba(35,35,33,.14));min-height:74px;}\
.lab-info b{display:block;font-size:15px;letter-spacing:-.02em;}\
.lab-info span{display:block;margin-top:3px;font-size:13.5px;line-height:1.45;color:var(--mute,#6C6F68);}\
.lab-info em{font-style:normal;font:11px ui-monospace,Menlo,monospace;letter-spacing:.04em;color:var(--accent-ink,#C4490F);}\
.lab-msg{position:absolute;inset:0;display:grid;place-items:center;text-align:center;padding:24px;color:var(--mute,#6C6F68);font-size:14px;}\
.lab-empty{position:absolute;left:0;right:0;top:46%;text-align:center;color:var(--mute,#6C6F68);font-size:14px;pointer-events:none;}';
  var cssDone = false;
  function addCss() { if (cssDone) return; cssDone = true; var s = document.createElement("style"); s.textContent = CSS; document.head.appendChild(s); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  var libs = null;
  function loadLibs() {
    if (!libs) libs = Promise.all([import(THREE_URL), import(ORBIT_URL), import(RBOX_URL)]).then(function (m) { return { THREE: m[0], OrbitControls: m[1].OrbitControls, RoundedBoxGeometry: m[2].RoundedBoxGeometry }; });
    return libs;
  }

  function mount(host, opts) {
    opts = opts || {};
    addCss();
    var sel = {}; (opts.start || PRESETS.opening.ids).forEach(function (id) { sel[id] = true; });
    var preset = "opening", selected = null, cameraMode = "overview", spreadOn = false, playing = !matchMedia("(prefers-reduced-motion: reduce)").matches;
    var dead = false, api = null;

    host.innerHTML = '<div class="lab"><aside class="lab-side"><h3>Dein Ablauf</h3><p class="sub">Vorlage wählen oder Bausteine einzeln an und aus schalten. Die Maschine rechts baut sich sofort um.</p>' +
      '<div class="lab-pre" role="group" aria-label="Vorlage">' + Object.keys(PRESETS).map(function (k) { return '<button type="button" data-pre="' + k + '" aria-pressed="' + (k === preset) + '" title="' + esc(PRESETS[k].sub) + '">' + esc(PRESETS[k].name) + '</button>'; }).join("") + '<button type="button" data-pre="leer" aria-pressed="false">Leer</button></div>' +
      '<div class="lab-list">' + MODULES.map(function (m, i) { return '<button type="button" class="lab-it" data-m="' + m.id + '" aria-pressed="false"><span class="n">' + String(i + 1).padStart(2, "0") + '</span><span><b>' + esc(m.name) + '</b><small>' + esc(m.team) + '</small></span></button>'; }).join("") + '</div></aside>' +
      '<section class="lab-main"><div class="lab-bar"><div class="lab-cam" role="group" aria-label="Ansicht"><button type="button" data-cam="overview" aria-pressed="true">Übersicht</button><button type="button" data-cam="side" aria-pressed="false">Seite</button><button type="button" data-cam="top" aria-pressed="false">Oben</button><button type="button" data-cam="flight" aria-pressed="false">Rundflug</button><button type="button" data-spread aria-pressed="false">Auseinander</button><button type="button" data-play aria-pressed="false" aria-label="Pausieren">Pause</button></div><span class="lab-cnt"></span></div>' +
      '<div class="lab-stage" role="img" aria-label="3D Maschine mit den gewählten Stationen deines Ablaufs. Ziehen zum Drehen, Scrollen zum Zoomen, Station anklicken für Details."><div class="lab-msg">Maschine wird aufgebaut …</div></div>' +
      '<div class="lab-info"><b>Station anklicken</b><span>Tippe oder klicke eine Station in der Maschine, dann siehst du hier, was dort passiert.</span></div></section></div>';

    var stage = host.querySelector(".lab-stage"), info = host.querySelector(".lab-info"), cnt = host.querySelector(".lab-cnt");
    var items = [].slice.call(host.querySelectorAll(".lab-it"));

    function chosen() { return MODULES.filter(function (m) { return sel[m.id]; }); }
    function syncUi() {
      items.forEach(function (b) { b.setAttribute("aria-pressed", sel[b.getAttribute("data-m")] ? "true" : "false"); });
      [].forEach.call(host.querySelectorAll("[data-pre]"), function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-pre") === preset ? "true" : "false"); });
      [].forEach.call(host.querySelectorAll("[data-cam]"), function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-cam") === cameraMode ? "true" : "false"); });
      host.querySelector("[data-spread]").setAttribute("aria-pressed", spreadOn ? "true" : "false");
      var pb = host.querySelector("[data-play]"); pb.setAttribute("aria-pressed", playing ? "false" : "true"); pb.textContent = playing ? "Pause" : "Weiter";
      var n = chosen().length; cnt.textContent = n + (n === 1 ? " STATION" : " STATIONEN") + " IM ABLAUF";
    }
    function showInfo(m, idx, total) {
      if (!m) { info.innerHTML = "<b>Station anklicken</b><span>Tippe oder klicke eine Station in der Maschine, dann siehst du hier, was dort passiert.</span>"; return; }
      info.innerHTML = "<em>SCHRITT " + (idx + 1) + " VON " + total + " · " + esc(m.team) + "</em><b>" + esc(m.name) + "</b><span>" + esc(m.desc) + "</span>";
    }
    function rebuild() { syncUi(); if (api) api.setStations(chosen()); if (selected && !sel[selected]) { selected = null; showInfo(null); } }

    host.querySelector(".lab-side").addEventListener("click", function (ev) {
      var p = ev.target.closest("[data-pre]"), m = ev.target.closest("[data-m]");
      if (p) {
        var k = p.getAttribute("data-pre"); preset = k; sel = {};
        if (k !== "leer") PRESETS[k].ids.forEach(function (id) { sel[id] = true; });
        rebuild();
      } else if (m) { var id = m.getAttribute("data-m"); sel[id] = !sel[id]; preset = ""; rebuild(); }
    });
    host.querySelector(".lab-bar").addEventListener("click", function (ev) {
      var c = ev.target.closest("[data-cam]"), s = ev.target.closest("[data-spread]"), pl = ev.target.closest("[data-play]");
      if (c) { cameraMode = c.getAttribute("data-cam"); if (api) api.setCamera(cameraMode); }
      if (s) { spreadOn = !spreadOn; if (api) api.setSpread(spreadOn); }
      if (pl) { playing = !playing; if (api) api.setPlaying(playing); }
      syncUi();
    });
    syncUi();

    loadLibs().then(function (L) {
      if (dead) return;
      api = build(L, stage, {
        onPick: function (m, i, n) { selected = m ? m.id : null; showInfo(m, i, n); },
        playing: playing
      });
      stage.querySelector(".lab-msg") && stage.querySelector(".lab-msg").remove();
      api.setStations(chosen());
    }, function () {
      var m = stage.querySelector(".lab-msg"); if (m) m.textContent = "Die 3D Bibliothek konnte nicht geladen werden. Bitte Internetverbindung prüfen und die Seite neu laden.";
    });

    return { dispose: function () { dead = true; if (api) api.dispose(); host.innerHTML = ""; } };
  }

  function build(L, stage, cb) {
    var THREE = L.THREE, OrbitControls = L.OrbitControls, RoundedBoxGeometry = L.RoundedBoxGeometry;
    var W = stage.clientWidth || 600, H = stage.clientHeight || 420;
    var renderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); } catch (e) { stage.innerHTML = '<div class="lab-msg">WebGL ist hier nicht verfügbar. Bitte Hardwarebeschleunigung im Browser einschalten.</div>'; return { setStations: function () {}, setCamera: function () {}, setSpread: function () {}, setPlaying: function () {}, dispose: function () {} }; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setSize(W, H);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    stage.appendChild(renderer.domElement);
    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(34, W / H, 0.1, 200);
    var controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.enablePan = false; controls.minDistance = 8; controls.maxDistance = 60; controls.maxPolarAngle = Math.PI * 0.48; controls.rotateSpeed = 0.6;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7a6a, 1.5));
    var key = new THREE.DirectionalLight(0xfff3df, 2.6); key.position.set(-5, 12, 8); key.castShadow = true; key.shadow.mapSize.set(1536, 1536);
    Object.assign(key.shadow.camera, { left: -14, right: 14, top: 12, bottom: -12, near: 1, far: 40 }); scene.add(key);
    var rim = new THREE.DirectionalLight(0xdfe8ff, 1.2); rim.position.set(6, 6, -9); scene.add(rim);

    var ORANGE = 0xF26A21, INK = 0x232321, STONE = 0x6C6F68, CREAM = 0xF2EEE2, WHITE = 0xFEFEFE;
    function mat(c, m, r, ex) { return new THREE.MeshStandardMaterial(Object.assign({ color: c, metalness: m == null ? 0.2 : m, roughness: r == null ? 0.5 : r }, ex || {})); }
    var M = { ink: mat(INK, 0.5, 0.4), orange: mat(ORANGE, 0.2, 0.4), cream: mat(CREAM, 0.1, 0.6), white: mat(WHITE, 0.05, 0.6), stone: mat(STONE, 0.4, 0.5), chrome: mat(0xc9cdd0, 0.9, 0.2), glow: mat(ORANGE, 0.1, 0.3, { emissive: ORANGE, emissiveIntensity: 1.3 }), dark: mat(0x15171a, 0.4, 0.5) };

    var machine = new THREE.Group(); scene.add(machine);
    var floor = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.ShadowMaterial({ opacity: 0.16 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -0.5; floor.receiveShadow = true; scene.add(floor);
    function rbox(g, w, h, d, x, y, z, m, r) { var o = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, Math.min(r == null ? 0.08 : r, w / 3, h / 3, d / 3)), m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; g.add(o); return o; }
    function cyl(g, r, h, x, y, z, m, r2, seg) { var o = new THREE.Mesh(new THREE.CylinderGeometry(r2 == null ? r : r2, r, h, seg || 28), m); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; }
    function sph(g, r, x, y, z, m) { var o = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), m); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; }

    // Platte, Förderband ist eine Ellipse
    var RX = 5.4, RZ = 3.1;
    rbox(machine, RX * 2 + 7.0, 0.5, RZ * 2 + 7.0, 0, -0.25, 0, M.ink, 0.3);
    rbox(machine, RX * 2 + 6.7, 0.08, RZ * 2 + 6.7, 0, 0.03, 0, M.stone, 0.12);
    rbox(machine, RX * 2 + 6.5, 0.08, RZ * 2 + 6.5, 0, 0.1, 0, M.cream, 0.1);
    var beltPts = []; for (var i = 0; i < 64; i++) { var a = (i / 64) * Math.PI * 2; beltPts.push(new THREE.Vector3(Math.cos(a) * RX, 0.28, Math.sin(a) * RZ)); }
    var path = new THREE.CatmullRomCurve3(beltPts, true);
    var beltMesh = new THREE.Mesh(new THREE.TubeGeometry(path, 160, 0.42, 8, true), M.dark); beltMesh.scale.y = 0.28; beltMesh.position.y = 0.18; machine.add(beltMesh);
    var SLATS = 120, slats = new THREE.InstancedMesh(new RoundedBoxGeometry(0.16, 0.07, 0.8, 2, 0.02), M.stone, SLATS); slats.castShadow = false; machine.add(slats);
    var dummy = new THREE.Object3D(), pv = new THREE.Vector3(), tv = new THREE.Vector3();
    function updateBelt(t) { for (var i = 0; i < SLATS; i++) { var u = (i / SLATS + t * 0.01) % 1; path.getPointAt(u, pv); path.getTangentAt(u, tv); dummy.position.copy(pv); dummy.position.y = 0.52; dummy.rotation.set(0, -Math.atan2(tv.z, tv.x), 0); dummy.updateMatrix(); slats.setMatrixAt(i, dummy.matrix); } slats.instanceMatrix.needsUpdate = true; }
    [-1, 1].forEach(function (side) { var pts = []; for (var i = 0; i <= 120; i++) { path.getPointAt(i / 120, pv); path.getTangentAt(i / 120, tv); pts.push(new THREE.Vector3(pv.x - tv.z * 0.5 * side, 0.62, pv.z + tv.x * 0.5 * side)); } machine.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 160, 0.035, 6, true), M.chrome)); });

    function labelTex(txt, n) {
      var c = document.createElement("canvas"); c.width = 512; c.height = 128; var g = c.getContext("2d");
      g.fillStyle = "#232321"; g.fillRect(0, 0, 512, 128);
      g.fillStyle = "#F26A21"; g.font = "700 40px ui-monospace,Menlo,monospace"; g.fillText(String(n).padStart(2, "0"), 22, 80);
      g.fillStyle = "#FEFEFE"; var size = 38; g.font = "800 " + size + "px sans-serif"; while (g.measureText(txt).width > 360 && size > 18) { size -= 2; g.font = "800 " + size + "px sans-serif"; } g.fillText(txt, 110, 78);
      var t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
    }

    function topShape(g, kind, accent) {
      var y = 0.9;
      switch (kind) {
        case "talk": cyl(g, 0.34, 0.5, -0.4, y + 0.25, 0, M.cream, 0.28); cyl(g, 0.34, 0.5, 0.4, y + 0.25, 0, M.white, 0.28); sph(g, 0.22, -0.4, y + 0.7, 0, M.cream); sph(g, 0.22, 0.4, y + 0.7, 0, M.white); break;
        case "paper": rbox(g, 0.9, 0.06, 1.15, 0, y + 0.05, 0, M.white, 0.02); rbox(g, 0.9, 0.06, 1.15, 0.05, y + 0.11, -0.04, M.white, 0.02); rbox(g, 0.5, 0.02, 0.07, 0, y + 0.16, -0.25, accent, 0.01); rbox(g, 0.62, 0.02, 0.05, 0, y + 0.16, -0.05, M.stone, 0.01); rbox(g, 0.62, 0.02, 0.05, 0, y + 0.16, 0.12, M.stone, 0.01); break;
        case "bulb": sph(g, 0.46, 0, y + 0.62, 0, M.glow); cyl(g, 0.2, 0.3, 0, y + 0.2, 0, M.chrome, 0.26); break;
        case "board": rbox(g, 1.3, 0.8, 0.08, 0, y + 0.45, -0.1, M.white, 0.03); [-0.38, 0, 0.38].forEach(function (x, i) { rbox(g, 0.26, 0.2 + i * 0.1, 0.04, x, y + 0.3 + i * 0.05, -0.04, i === 1 ? accent : M.cream, 0.02); }); break;
        case "cam": rbox(g, 0.95, 0.55, 0.6, 0, y + 0.35, 0, M.dark, 0.08); var lens = cyl(g, 0.26, 0.5, 0, y + 0.35, 0.5, M.chrome, 0.2); lens.rotation.x = Math.PI / 2; var ring = cyl(g, 0.3, 0.1, 0, y + 0.35, 0.28, accent, 0.3); ring.rotation.x = Math.PI / 2; break;
        case "screen": rbox(g, 1.3, 0.8, 0.07, 0, y + 0.55, -0.1, M.dark, 0.04); rbox(g, 1.15, 0.65, 0.02, 0, y + 0.55, -0.06, accent, 0.02); [-0.4, -0.1, 0.25].forEach(function (x, i) { rbox(g, 0.28 - i * 0.04, 0.1, 0.03, x, y + 0.5, -0.04, M.white, 0.01); }); rbox(g, 0.3, 0.14, 0.2, 0, y + 0.07, -0.1, M.stone, 0.03); break;
        case "horn": var cone = cyl(g, 0.5, 0.9, 0.1, y + 0.55, 0, accent, 0.12); cone.rotation.z = Math.PI / 2 + 0.2; rbox(g, 0.3, 0.3, 0.3, -0.45, y + 0.4, 0, M.dark, 0.05); break;
        case "heads": [[-0.45, 0.2], [0.05, 0.38], [0.5, 0.2]].forEach(function (p, i) { cyl(g, 0.22, p[1] + 0.2, p[0], y + (p[1] + 0.2) / 2, 0, i === 1 ? accent : M.cream, 0.18); sph(g, 0.17, p[0], y + p[1] + 0.38, 0, i === 1 ? accent : M.white); }); break;
        case "arch": var tor = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.1, 12, 28, Math.PI), accent); tor.position.set(0, y + 0.08, 0); tor.castShadow = true; g.add(tor); cyl(g, 0.1, 0.1, -0.55, y + 0.05, 0, M.dark); cyl(g, 0.1, 0.1, 0.55, y + 0.05, 0, M.dark); sph(g, 0.1, 0, y + 0.7, 0, M.glow); break;
        case "phone": rbox(g, 0.62, 1.1, 0.08, 0, y + 0.62, -0.05, M.dark, 0.08); rbox(g, 0.54, 0.98, 0.02, 0, y + 0.62, -0.005, accent, 0.05); rbox(g, 0.4, 0.1, 0.02, 0, y + 0.85, 0.01, M.white, 0.02); sph(g, 0.1, 0, y + 0.55, 0.03, M.white); break;
        case "bars": [0.35, 0.65, 0.5, 0.95].forEach(function (h, i) { rbox(g, 0.24, h, 0.3, -0.45 + i * 0.3, y + h / 2, 0, i === 3 ? accent : M.cream, 0.04); }); break;
        default: for (var s = 0; s < 5; s++) rbox(g, 0.95, 0.07, 1.15, 0, y + 0.06 + s * 0.09, 0, s === 4 ? accent : M.white, 0.02); break;
      }
    }

    var stationGroup = new THREE.Group(); machine.add(stationGroup);
    var stations = [], targetSpread = 0, spread = 0, playing = cb.playing !== false, selectedIdx = -1, hoveredIdx = -1;
    var labelsEl = document.createElement("div"); labelsEl.style.cssText = "position:absolute;inset:0;pointer-events:none;overflow:hidden"; stage.appendChild(labelsEl);
    var emptyEl = document.createElement("div"); emptyEl.className = "lab-empty"; emptyEl.textContent = "Noch keine Station gewählt. Links einen Baustein einschalten."; emptyEl.style.display = "none"; stage.appendChild(emptyEl);
    var packet = new THREE.Group(); machine.add(packet);
    rbox(packet, 0.8, 1.05, 0.06, 0, 0, 0, M.white, 0.03); rbox(packet, 0.64, 0.32, 0.02, 0, 0.25, 0.04, M.orange, 0.02); rbox(packet, 0.5, 0.06, 0.02, 0, -0.1, 0.04, M.stone, 0.01); rbox(packet, 0.4, 0.06, 0.02, -0.05, -0.24, 0.04, M.stone, 0.01);

    function clearStations() {
      while (stationGroup.children.length) { var c = stationGroup.children.pop(); c.traverse(function (o) { if (o.geometry) o.geometry.dispose(); if (o.material && o.material.map) { o.material.map.dispose(); o.material.dispose(); } }); }
      stations.forEach(function (s) { s.el.remove(); }); stations = [];
    }
    function setStations(list) {
      var prev = selectedIdx >= 0 && stations[selectedIdx] ? stations[selectedIdx].m.id : null;
      clearStations(); selectedIdx = -1;
      var n = list.length; emptyEl.style.display = n ? "none" : "block"; packet.visible = n > 0;
      list.forEach(function (m, i) {
        var u = (i + 0.5) / n; var a = (u - 0.25) * Math.PI * 2 * -1 + Math.PI * 1.5; // Start links unten, im Uhrzeigersinn
        a = -Math.PI / 2 - u * Math.PI * 2 + Math.PI; // vorne starten
        var px = Math.cos(a) * (RX + 1.9), pz = Math.sin(a) * (RZ + 1.9);
        var g = new THREE.Group(); g.position.set(px, 0, pz); stationGroup.add(g);
        var out = new THREE.Vector3(Math.cos(a) * 1.0, 0, Math.sin(a) * 1.0).normalize();
        g.rotation.y = Math.atan2(out.x, out.z);
        var acc = new THREE.MeshStandardMaterial({ color: ORANGE, metalness: 0.2, roughness: 0.4, emissive: ORANGE, emissiveIntensity: 0.05 });
        // Stationen stehen außen am Band: Sockel, Plakette, Form
        var off = new THREE.Group(); off.position.set(0, 0, 0); g.add(off);
        rbox(off, 2.1, 0.22, 1.8, 0, 0.11, 0, M.dark, 0.1);
        rbox(off, 2.0, 0.04, 1.7, 0, 0.24, 0, acc, 0.06);
        rbox(off, 1.9, 0.5, 1.6, 0, 0.52, 0, M.ink, 0.12);
        var plaque = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.42), new THREE.MeshBasicMaterial({ map: labelTex(m.name, i + 1), toneMapped: false })); plaque.position.set(0, 0.5, 0.805); off.add(plaque);
        topShape(off, m.kind, acc);
        var el = document.createElement("div"); el.className = "lab-lbl"; el.innerHTML = "<i>" + String(i + 1).padStart(2, "0") + "</i>" + esc(m.name); labelsEl.appendChild(el);
        stations.push({ m: m, g: g, off: off, acc: acc, el: el, pos: new THREE.Vector3(px, 0, pz), a: a, u: u });
      });
      // Auftrag fährt ab der ersten Station
      packetT = 0;
      if (prev) { var k = list.findIndex(function (m) { return m.id === prev; }); if (k >= 0) selectedIdx = k; }
      cb.onPick && selectedIdx < 0 && cb.onPick(null);
      frame(true);
    }

    // Kamera
    var cameraMode = "overview", flightT = 0, desiredPos = new THREE.Vector3(), desiredTarget = new THREE.Vector3(0, 0.6, 0), animating = true;
    function setCameraGoal() {
      var asp = Math.max(0.5, W / H), dist = 25 / Math.min(1.2, Math.max(0.6, asp / 1.6)) * (spread > 0.5 ? 1.15 : 1);
      desiredTarget.set(0, 0.6, 0);
      if (cameraMode === "side") desiredPos.set(10, 4.5, 20).normalize().multiplyScalar(dist * 0.92).add(desiredTarget);
      else if (cameraMode === "top") desiredPos.set(0.01, dist, 1.4).add(desiredTarget);
      else desiredPos.set(11, 12, 17).normalize().multiplyScalar(dist).add(desiredTarget);
    }
    setCameraGoal(); camera.position.copy(desiredPos); controls.target.copy(desiredTarget); controls.update(); animating = false;

    // Auswahl und Hover
    var ray = new THREE.Raycaster(), ptr = new THREE.Vector2(), down = null;
    function pick(ev) {
      var r = renderer.domElement.getBoundingClientRect(); ptr.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ptr, camera);
      var hits = ray.intersectObjects(stationGroup.children, true); if (!hits.length) return -1;
      var o = hits[0].object; while (o && o.parent !== stationGroup) o = o.parent;
      for (var i = 0; i < stations.length; i++) if (stations[i].g === o) return i;
      return -1;
    }
    renderer.domElement.addEventListener("pointermove", function (ev) { if (ev.buttons) return; var i = pick(ev); hoveredIdx = i; renderer.domElement.style.cursor = i >= 0 ? "pointer" : "grab"; });
    renderer.domElement.addEventListener("pointerleave", function () { hoveredIdx = -1; });
    renderer.domElement.addEventListener("pointerdown", function (ev) { down = [ev.clientX, ev.clientY]; animating = false; });
    renderer.domElement.addEventListener("pointerup", function (ev) {
      if (!down || Math.hypot(ev.clientX - down[0], ev.clientY - down[1]) > 5) { down = null; return; }
      down = null; var i = pick(ev);
      if (i >= 0) { selectedIdx = i; cb.onPick && cb.onPick(stations[i].m, i, stations.length); }
    });

    // Schleife
    var simT = 0, packetT = 0, last = performance.now(), raf = 0, visible = true, hold = 0, holdIdx = -1;
    var io = new IntersectionObserver(function (es) { visible = es[0].isIntersecting; last = performance.now(); }, { threshold: 0.01 }); io.observe(stage);
    var tmp = new THREE.Vector3();
    function frame(force) {
      var now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (!visible && !force) return;
      if (playing) { simT += dt; flightT += dt; }
      spread += (targetSpread - spread) * (1 - Math.exp(-dt * 4));
      // Auftrag: bleibt kurz an jeder Station
      var n = stations.length;
      if (n && playing) {
        var seg = 1 / n;
        if (hold > 0) { hold -= dt; }
        else {
          var prevT = packetT; packetT = (packetT + dt * (0.09 / Math.max(1, n * 0.5 + 2))) % 1;
          for (var i = 0; i < n; i++) { var s0 = (i + 0.5) / n; var wrapped = prevT > packetT; if ((!wrapped && prevT < s0 && packetT >= s0) || (wrapped && s0 > prevT)) { hold = 0.9; packetT = s0; holdIdx = i; break; } }
        }
      }
      if (n) {
        var u = packetT, a = -Math.PI / 2 - u * Math.PI * 2 + Math.PI;
        packet.position.set(Math.cos(a) * RX, 1.2 + Math.sin(simT * 3) * 0.04, Math.sin(a) * RZ);
        packet.lookAt(packet.position.x + Math.cos(a) * 3, packet.position.y, packet.position.z + Math.sin(a) * 3);
      }
      updateBelt(simT);
      stations.forEach(function (s, i) {
        var lift = spread * 1.0, out = tmp.set(Math.cos(s.a), 0, Math.sin(s.a));
        s.g.position.set(s.pos.x + out.x * spread * 2.2, 0, s.pos.z + out.z * spread * 2.2);
        s.off.position.y = spread * (i % 2 ? 0.2 : 0.5);
        var active = i === hoveredIdx || i === selectedIdx || (hold > 0 && holdIdx === i);
        s.acc.emissiveIntensity += ((active ? 1.2 : 0.05) - s.acc.emissiveIntensity) * 0.2;
        s.off.scale.setScalar(1 + (i === hoveredIdx ? 0.03 : 0));
      });
      if (cameraMode === "flight" && playing) { var d = 26, aa = flightT * 0.15; desiredTarget.set(0, 0.6, 0); desiredPos.set(Math.sin(aa) * d * 0.85, d * 0.5, Math.cos(aa) * d * 0.85); animating = true; }
      if (animating) { var k = 1 - Math.exp(-dt * 3); camera.position.lerp(desiredPos, k); controls.target.lerp(desiredTarget, k); if (cameraMode !== "flight" && camera.position.distanceTo(desiredPos) < 0.02) animating = false; }
      controls.autoRotate = playing && cameraMode === "overview" && !animating && stations.length > 0 && now - lastTouch > 7000; controls.autoRotateSpeed = 0.35;
      controls.update();
      var sel = selectedIdx;
      stations.forEach(function (s, i) {
        tmp.copy(s.g.position); tmp.y = s.off.position.y + 2.3; tmp.project(camera);
        var x = (tmp.x * 0.5 + 0.5) * W, y = (-tmp.y * 0.5 + 0.5) * H;
        s.el.style.transform = "translate(" + (x - s.el.offsetWidth / 2).toFixed(1) + "px," + (y - 12).toFixed(1) + "px)";
        s.el.classList.toggle("sel", i === sel);
        s.el.style.display = tmp.z < 1 ? "" : "none";
      });
      renderer.render(scene, camera);
    }
    var lastTouch = performance.now();
    controls.addEventListener("start", function () { lastTouch = performance.now(); });
    function loop() { raf = requestAnimationFrame(loop); frame(false); }
    loop();

    var ro = new ResizeObserver(function () { var w = stage.clientWidth, h = stage.clientHeight; if (!w || !h) return; W = w; H = h; renderer.setSize(W, H); camera.aspect = W / H; camera.updateProjectionMatrix(); setCameraGoal(); animating = true; });
    ro.observe(stage);

    return {
      setStations: setStations,
      setCamera: function (m) { cameraMode = m; flightT = 0; setCameraGoal(); animating = true; },
      setSpread: function (on) { targetSpread = on ? 1 : 0; setCameraGoal(); animating = true; },
      setPlaying: function (p) { playing = p; },
      dispose: function () {
        cancelAnimationFrame(raf); io.disconnect(); ro.disconnect(); controls.dispose(); clearStations();
        scene.traverse(function (o) { if (o.geometry) o.geometry.dispose(); if (o.material) { var ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach(function (m) { if (m.map) m.map.dispose(); m.dispose(); }); } });
        renderer.dispose(); if (renderer.forceContextLoss) renderer.forceContextLoss(); renderer.domElement.remove(); labelsEl.remove(); emptyEl.remove();
      }
    };
  }

  window.SBLabor = { mount: mount, modules: MODULES, presets: PRESETS };
})();
