/* Hintergrundfarben zum Ausprobieren (nur im hellen Modus). Die Wahl steht in localStorage "sb-bg".
   Jede Variante setzt --paper (Seite) und --paper-2 (zweite Fläche), optional die Papierkörnung. Im dunklen Modus bleibt alles beim dunklen Design. */
(function () {
  "use strict";
  var K = "sb-bg", root = document.documentElement;
  var P = [
    ["weiss",   "Fast Weiß",       "#FEFEFE", "#E3EAE0", 0],   // Standard
    ["rein",    "Reinweiß",        "#FFFFFF", "#F1F4F0", 0],
    ["mint",    "Weiß mit Mint",   "#FDFFFD", "#DDEADF", 0],
    ["kuehl",   "Kühles Weiß",     "#FAFBFC", "#E8EEF3", 0],
    ["perl",    "Perlgrau",        "#F5F5F3", "#E6E7E3", 0],
    ["warm",    "Warm White",      "#F8F5F0", "#EFEBE4", 0],
    ["keywhite","Key White (alt)", "#FEFDFA", "#E3EAE0", 1],
    ["papier",  "Papier",          "#FAF8F3", "#ECE8DD", 1],
    ["creme",   "Creme",           "#FEFCF6", "#F2EEE2", 1],
    ["beige",   "Beige",           "#F4EFE4", "#E9E2D2", 1]
  ];
  function get() { try { var v = localStorage.getItem(K); for (var i = 0; i < P.length; i++) if (P[i][0] === v) return v; } catch (e) {} return P[0][0]; }
  function find(id) { for (var i = 0; i < P.length; i++) if (P[i][0] === id) return P[i]; return P[0]; }
  function apply() {
    var p = find(get()), dark = root.getAttribute("data-theme") === "dark";
    if (dark) { ["--paper", "--paper-2", "--grain"].forEach(function (v) { root.style.removeProperty(v); }); }
    else {
      root.style.setProperty("--paper", p[2]); root.style.setProperty("--paper-2", p[3]);
      if (p[4]) root.style.removeProperty("--grain"); else root.style.setProperty("--grain", "none");
      if (p[4]) root.style.setProperty("--grain", getComputedStyle(root).getPropertyValue("--grain-papier") || "none");
      var meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.setAttribute("content", p[2]);
    }
    var dot = document.querySelector("#bgsw-cur i"); if (dot) dot.style.background = p[2];
    [].forEach.call(document.querySelectorAll("#bgsw-menu [data-bg]"), function (b) { b.setAttribute("aria-checked", String(b.getAttribute("data-bg") === p[0])); });
  }
  function set(id) { try { localStorage.setItem(K, id); } catch (e) {} apply(); }
  apply();
  document.addEventListener("DOMContentLoaded", function () {
    var box = document.getElementById("bgsw"); if (!box) { apply(); return; }
    var cur = document.getElementById("bgsw-cur"), menu = document.getElementById("bgsw-menu");
    menu.innerHTML = '<li class="bgsw-h">Hintergrund</li>' + P.map(function (p, i) {
      return '<li><button type="button" role="menuitemradio" data-bg="' + p[0] + '" aria-checked="false"><i style="background:' + p[2] + '"></i><span>' + (i + 1) + '. ' + p[1] + '</span><b>' + p[2] + '</b></button></li>';
    }).join("");
    function close() { box.classList.remove("open"); cur.setAttribute("aria-expanded", "false"); }
    cur.addEventListener("click", function (e) { e.stopPropagation(); var o = box.classList.toggle("open"); cur.setAttribute("aria-expanded", String(o)); });
    menu.addEventListener("click", function (e) { var b = e.target.closest("[data-bg]"); if (b) set(b.getAttribute("data-bg")); });
    document.addEventListener("click", function (e) { if (!box.contains(e.target)) close(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
    apply();
  });
  if (window.MutationObserver) new MutationObserver(apply).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
  window.sbBg = { set: set, get: get, list: P };
})();
