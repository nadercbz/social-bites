/* Hell und Dunkel für alle Seiten von Social Bites.
   Einstellung in localStorage "sb-theme": "auto" (folgt dem Gerät), "light" oder "dark".
   Alle Seiten laden dieses Skript im <head>, damit nichts aufblitzt. Eingebettete Seiten (Portal) folgen
   dem Umschalter über das storage-Ereignis. Knöpfe mit data-theme-toggle schalten zwischen hell und dunkel um (nur zwei Zustände). Solange noch nichts gewählt wurde, folgt die Seite dem Gerät. */
(function () {
  "use strict";
  var K = "sb-theme", root = document.documentElement;
  var mq = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  var LOGOS = [["logo_social_bites.webp", "logo_social_bites_dark.webp"], ["media/logo_sb.webp", "media/logo_sb_dark.webp"]];
  var embedded = false;
  try { embedded = window.self !== window.top; } catch (e) { embedded = true; }

  function mode() { try { var m = localStorage.getItem(K); return m === "light" || m === "dark" ? m : "auto"; } catch (e) { return "auto"; } }
  function eff(m) { return m === "auto" ? (mq && mq.matches ? "dark" : "light") : m; }

  var ICONS = {
    light: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    dark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z"/></svg>',
    auto: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 3v18" /><path d="M12 3a9 9 0 010 18z" fill="currentColor" stroke="none"/></svg>'
  };
  var LBL = { light: "Hell", dark: "Dunkel", auto: "Automatisch" };

  function swapLogos() {
    var dark = root.getAttribute("data-theme") === "dark";
    var imgs = document.querySelectorAll("img");
    for (var i = 0; i < imgs.length; i++) {
      if (imgs[i].closest && imgs[i].closest(".lg-art, [data-logo-fixed]")) continue;  // auf Orange bleibt das schwarze Logo
      var s = imgs[i].getAttribute("src") || "";
      for (var j = 0; j < LOGOS.length; j++) {
        if (dark && s.indexOf(LOGOS[j][0]) >= 0 && s.indexOf("_dark") < 0) { imgs[i].setAttribute("src", s.replace(LOGOS[j][0], LOGOS[j][1])); break; }
        if (!dark && s.indexOf(LOGOS[j][1]) >= 0) { imgs[i].setAttribute("src", s.replace(LOGOS[j][1], LOGOS[j][0])); break; }
      }
    }
  }

  function ui() {
    var m = eff(mode()), btns = document.querySelectorAll("[data-theme-toggle]");
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i];
      if (b.getAttribute("data-mode") !== m) { b.setAttribute("data-mode", m); b.setAttribute("aria-pressed", m === "dark" ? "true" : "false"); }
      var al = "Darstellung: " + LBL[m] + ". Klicken zum Wechseln";
      if (b.getAttribute("aria-label") !== al) { b.setAttribute("aria-label", al); b.setAttribute("title", "Darstellung: " + LBL[m]); }
      var ic = b.querySelector(".tt-ic");
      if (!ic) { ic = document.createElement("span"); ic.className = "tt-ic"; b.insertBefore(ic, b.firstChild); }
      if (ic.getAttribute("data-m") !== m) { ic.innerHTML = ICONS[m]; ic.setAttribute("data-m", m); }
      var tx = b.querySelector(".tt-tx");
      if (tx && tx.textContent !== LBL[m]) tx.textContent = LBL[m];
    }
  }

  function apply() {
    var m = mode(), e = eff(m);
    root.setAttribute("data-theme", e);
    root.setAttribute("data-mode", m);
    root.style.colorScheme = e;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", e === "dark" ? "#151211" : "#FEFDFA");
    if (document.body) { swapLogos(); ui(); }
  }

  function set(m) { try { localStorage.setItem(K, m); } catch (e) {} apply(); }
  function next() { set(eff(mode()) === "dark" ? "light" : "dark"); }

  apply();

  window.addEventListener("storage", function (e) { if (e.key === K) apply(); });
  if (mq) { if (mq.addEventListener) mq.addEventListener("change", apply); else if (mq.addListener) mq.addListener(apply); }

  document.addEventListener("DOMContentLoaded", function () {
    if (!embedded && !document.querySelector("[data-theme-toggle]")) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "sb-tt"; b.setAttribute("data-theme-toggle", "");
      document.body.appendChild(b);
    }
    apply();
    if (window.MutationObserver) {
      var pend = false;
      new MutationObserver(function () {
        if (pend) return; pend = true;
        (window.requestAnimationFrame || setTimeout)(function () { pend = false; swapLogos(); ui(); });
      }).observe(document.body, { childList: true, subtree: true });
    }
  });
  document.addEventListener("click", function (e) {
    var b = e.target.closest ? e.target.closest("[data-theme-toggle]") : null;
    if (b) { e.preventDefault(); next(); }
  });

  // Drucken und PDF immer hell
  window.addEventListener("beforeprint", function () { root.setAttribute("data-theme", "light"); swapLogos(); });
  window.addEventListener("afterprint", apply);

  window.sbTheme = { mode: mode, set: set, next: next };
})();
