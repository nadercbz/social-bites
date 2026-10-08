/* Sprachen der Startseite: Deutsch (Original im HTML), Englisch, Türkisch, Russisch, Ukrainisch, Arabisch, Vietnamesisch.
   Die Texte stehen in i18n_data.js (window.SB_I18N = {sprache: {"deutscher Text": "Übersetzung"}}).
   Fehlt ein Text, bleibt er Deutsch. Eigennamen und Zahlen werden nie übersetzt. Die Wahl wird in localStorage "sb-lang" gemerkt. */
(function () {
  "use strict";
  var LANGS = [["de", "Deutsch", "DE"], ["en", "English", "EN"], ["tr", "Türkçe", "TR"], ["ru", "Русский", "RU"], ["uk", "Українська", "UK"], ["ar", "العربية", "AR"], ["vi", "Tiếng Việt", "VI"]];
  var LOCALE = {de: "de-DE", en: "en-GB", tr: "tr-TR", ru: "ru-RU", uk: "uk-UA", ar: "ar-EG-u-nu-latn", vi: "vi-VN"};
  var KEY = "sb-lang", D = window.SB_I18N || {}, lang = "de", orig = new WeakMap(), wrote = new WeakMap(), busy = false;
  var root = document.documentElement;
  try { var s = localStorage.getItem(KEY); if (s && D[s] || s === "de") lang = s; } catch (e) {}

  function norm(t) { return t.replace(/\s+/g, " ").trim(); }
  function look(k) { var d = D[lang]; return d && Object.prototype.hasOwnProperty.call(d, k) ? d[k] : null; }
  function tr(raw) {
    var k = norm(raw); if (!k) return null;
    var v = look(k); if (v !== null) return v;
    var m = k.match(/^(Schritt|Beitrag|Reel) (\d+)$/);
    if (m && (v = look(m[1])) !== null) return v + " " + m[2];
    m = k.match(/^([\d.,]+) (.+)$/);
    if (m && (v = look(m[2])) !== null) return m[1] + " " + v;
    if (k.indexOf(" · ") > 0) {
      var parts = k.split(" · "), any = false;
      var out = parts.map(function (p) { var t = tr(p); if (t !== null) { any = true; return t; } return p; });
      if (any) return out.join(" · ");
    }
    return null;
  }
  function textNodes(rootEl) {
    var w = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT, { acceptNode: function (n) {
      var p = n.parentNode && n.parentNode.nodeName; return /^(SCRIPT|STYLE|NOSCRIPT)$/.test(p) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT; } });
    var list = [], n; while ((n = w.nextNode())) list.push(n); return list;
  }
  function setNode(n) {
    var o = orig.has(n) && wrote.get(n) === n.nodeValue ? orig.get(n) : n.nodeValue;   // wurde der Text von außen geändert, gilt er als neues Original
    if (!orig.has(n) || wrote.get(n) !== n.nodeValue) orig.set(n, o);
    if (lang === "de") { if (n.nodeValue !== o) n.nodeValue = o; wrote.set(n, o); return; }
    var t = tr(o);
    if (t === null) { wrote.set(n, n.nodeValue); return; }
    var lead = /^\s/.test(o) ? " " : "", trail = /\s$/.test(o) ? " " : "";
    var nv = lead + t + trail;
    if (n.nodeValue !== nv) n.nodeValue = nv;
    wrote.set(n, nv);
  }
  var ATTRS = ["placeholder", "aria-label", "title", "alt"];
  function setAttrs(el) {
    ATTRS.forEach(function (a) {
      if (!el.hasAttribute || !el.hasAttribute(a)) return;
      var key = "data-i18n-" + a, o = el.getAttribute(key);
      if (o === null) { o = el.getAttribute(a); el.setAttribute(key, o); }
      var t = lang === "de" ? null : tr(o);
      var nv = t === null ? o : t;
      if (el.getAttribute(a) !== nv) el.setAttribute(a, nv);
    });
  }
  function run(scope) {
    busy = true;
    try {
      textNodes(scope).forEach(setNode);
      if (scope.querySelectorAll) { setAttrs(scope); [].forEach.call(scope.querySelectorAll("[placeholder],[aria-label],[title],[alt]"), setAttrs); }
    } finally { busy = false; }
  }
  function apply() {
    var meta = LANGS.filter(function (l) { return l[0] === lang; })[0];
    root.lang = lang;
    root.classList.toggle("lang-ar", lang === "ar");
    root.classList.toggle("lang-cyr", lang === "ru" || lang === "uk");
    run(document.body);
    var cur = document.getElementById("lang-cur"); if (cur) cur.textContent = meta[2];
    [].forEach.call(document.querySelectorAll("#lang-menu [data-l]"), function (b) { b.setAttribute("aria-checked", String(b.getAttribute("data-l") === lang)); });
    document.dispatchEvent(new CustomEvent("sblang", {detail: {lang: lang, locale: LOCALE[lang]}}));
  }
  function set(l) { lang = l; try { localStorage.setItem(KEY, l); } catch (e) {} apply(); }

  function buildMenu() {
    var box = document.getElementById("lang"); if (!box) return;
    var menu = document.getElementById("lang-menu"), cur = document.getElementById("lang-cur");
    menu.innerHTML = LANGS.filter(function (l) { return l[0] === "de" || D[l[0]]; }).map(function (l) {
      return '<li><button type="button" role="menuitemradio" data-l="' + l[0] + '" aria-checked="false" lang="' + l[0] + '"><b>' + l[2] + '</b><span>' + l[1] + '</span></button></li>';
    }).join("");
    function close() { box.classList.remove("open"); cur.setAttribute("aria-expanded", "false"); }
    cur.addEventListener("click", function (e) { e.stopPropagation(); var o = box.classList.toggle("open"); cur.setAttribute("aria-expanded", String(o)); });
    menu.addEventListener("click", function (e) { var b = e.target.closest("[data-l]"); if (!b) return; set(b.getAttribute("data-l")); close(); cur.focus(); });
    document.addEventListener("click", function (e) { if (!box.contains(e.target)) close(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
  }

  document.addEventListener("DOMContentLoaded", function () {
    buildMenu();
    if (lang !== "de") apply(); else { var cur = document.getElementById("lang-cur"); if (cur) cur.textContent = "DE"; var it = document.querySelector('#lang-menu [data-l="de"]'); if (it) it.setAttribute("aria-checked", "true"); }
    if (window.MutationObserver) {
      new MutationObserver(function (muts) {
        if (busy || lang === "de") return;
        busy = true;
        try {
          muts.forEach(function (m) {
            if (m.type === "characterData") { if (wrote.get(m.target) !== m.target.nodeValue) setNode(m.target); }
            else m.addedNodes.forEach(function (n) { if (n.nodeType === 3) setNode(n); else if (n.nodeType === 1) { textNodes(n).forEach(setNode); setAttrs(n); [].forEach.call(n.querySelectorAll("[placeholder],[aria-label],[title],[alt]"), setAttrs); } });
          });
        } finally { busy = false; }
      }).observe(document.body, { childList: true, subtree: true, characterData: true });
    }
  });
  window.sbLang = { get: function () { return lang; }, set: set, locale: function () { return LOCALE[lang]; } };
})();
