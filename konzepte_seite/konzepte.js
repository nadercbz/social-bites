/* Seite Konzepte (Social Bites): Pakete, Baukasten, Anfrage über das Anfrage Fenster der Startseite, Video Fenster, Menü. */
(function () {
  'use strict';
  var d = document, root = d.documentElement;

  var GROUPS = [
    { name: 'Marke', items: [
      ['logo', 'Logo und Bildmarke', 'Das Zeichen deiner Marke, in allen Formaten.'],
      ['farben', 'Farben und Schrift', 'Eine klare Farbwelt und passende Schriften.'],
      ['brandbook', 'Brandbook', 'Alle Regeln deiner Marke an einem Ort.'],
      ['namecheck', 'Namens Recherche', 'Erste Prüfung, ob der Name frei ist.']
    ]},
    { name: 'Produkt', items: [
      ['karte', 'Speisekarte und Rezepturen', 'Angebot, Preisstruktur und Rezeptkarten.'],
      ['fotos', 'Produktfotos', 'Bilder für Karte, Website und Social Media.'],
      ['verpackung', 'Verpackung und Becher', 'Design für Becher, Tüten und Boxen.']
    ]},
    { name: 'Store', items: [
      ['visual', '3D Visualisierung', 'Dein Laden als 3D Bild, bevor gebaut wird.'],
      ['ladenbau', 'Ladenbau Plan', 'Grundriss und Plan für den Ausbau.'],
      ['werbeanlage', 'Werbeanlage und Schild', 'Fassade und Leuchtschrift als Zeichnung.'],
      ['menuboard', 'Menüboard', 'Gestaltung der Karte über der Theke.']
    ]},
    { name: 'Betrieb', items: [
      ['ablauf', 'Abläufe Küche und Service', 'Wer macht was, Schritt für Schritt.'],
      ['onboarding', 'Onboarding Video', 'Ein Video, das neue Mitarbeiter einarbeitet.'],
      ['businessplan', 'Businessplan', 'Zahlen, Kosten und Planung als Excel.'],
      ['franchise', 'Franchise Handbuch', 'Für Systeme nach einem erfolgreichen Pilotbetrieb.']
    ]},
    { name: 'Auftritt', items: [
      ['website', 'Website', 'Moderne Website, fertig online.'],
      ['social', 'Social Media Start', 'Profile, Vorlagen und die ersten Beiträge.'],
      ['imagefilm', 'Imagefilm', 'Ein kurzer Film über deine Marke.'],
      ['erklaer', 'Erklärvideo', 'Dein Konzept in einer Minute erklärt.'],
      ['launch', 'Eröffnungsplan', 'Was vor und am Eröffnungstag passiert.']
    ]}
  ];
  var PACKS = [
    { id: 'marke', title: 'Marke', sub: 'Für den sichtbaren Start.', items: ['logo', 'farben', 'brandbook', 'website', 'social'] },
    { id: 'laden', title: 'Marke und Store', sub: 'Für die Eröffnung deines Ladens.', top: true, plus: 'Alles aus Marke', items: ['karte', 'fotos', 'visual', 'ladenbau', 'werbeanlage', 'imagefilm'] },
    { id: 'komplett', title: 'Komplett', sub: 'Fertig zum Eröffnen und Wachsen.', plus: 'Alles aus Marke und Store', items: ['verpackung', 'menuboard', 'ablauf', 'onboarding', 'businessplan', 'launch'] }
  ];
  var LABEL = {};
  GROUPS.forEach(function (g) { g.items.forEach(function (it) { LABEL[it[0]] = it[1]; }); });
  function packItems(id) {
    var out = [];
    for (var i = 0; i < PACKS.length; i++) { out = out.concat(PACKS[i].items); if (PACKS[i].id === id) break; }
    return out;
  }

  var sel = new Set(), packName = '', scen = '';
  var elPacks = d.getElementById('kzPakete'), elBlocks = d.getElementById('kzBausteine');

  if (elPacks && elBlocks) {
    elPacks.innerHTML = PACKS.map(function (p, i) {
      var lis = (p.plus ? '<li class="kz-plus">' + p.plus + '</li>' : '') + p.items.map(function (k) { return '<li>' + LABEL[k] + '</li>'; }).join('');
      return '<div class="kz-pack' + (p.top ? ' is-top' : '') + '">' + (p.top ? '<span class="kz-badge">Empfohlen</span>' : '') +
        '<span class="kz-num mono">0' + (i + 1) + '</span><h3>' + p.title + '</h3><p class="kz-pack-sub">' + p.sub + '</p><ul>' + lis + '</ul>' +
        '<button type="button" class="btn" data-pack="' + p.id + '"><span>Paket wählen</span><i class="dot"></i></button></div>';
    }).join('');

    elBlocks.innerHTML = GROUPS.map(function (g) {
      return '<div class="kz-group"><h3>' + g.name + '</h3><div class="kz-grid">' + g.items.map(function (it) {
        return '<button type="button" class="kz-block" aria-pressed="false" data-id="' + it[0] + '"><strong>' + it[1] + '</strong><span>' + it[2] + '</span></button>';
      }).join('') + '</div></div>';
    }).join('');

    var bar = d.createElement('div');
    bar.className = 'kz-bar';
    bar.innerHTML = '<span><b id="kzBarCount">0</b> <span id="kzBarW">Bausteine</span></span><a href="#kzSummary">Paket ansehen</a>';
    d.body.appendChild(bar);

    var elList = d.getElementById('kzList'), elCount = d.getElementById('kzCount'), elSend = d.getElementById('kzSend'), elSum = d.getElementById('kzSummary');
    var ids = [];
    var render = function () {
      elBlocks.querySelectorAll('.kz-block').forEach(function (b) { b.setAttribute('aria-pressed', sel.has(b.dataset.id) ? 'true' : 'false'); });
      ids = []; GROUPS.forEach(function (g) { g.items.forEach(function (it) { if (sel.has(it[0])) ids.push(it[0]); }); });
      var w = ids.length === 1 ? 'Baustein' : 'Bausteine';
      elCount.textContent = ids.length; d.getElementById('kzCountW').textContent = w;
      d.getElementById('kzBarCount').textContent = ids.length; d.getElementById('kzBarW').textContent = w;
      bar.classList.toggle('is-on', ids.length > 0);
      elSum.classList.toggle('is-live', ids.length > 0);
      elList.innerHTML = ids.length ? ids.map(function (k) { return '<li>' + LABEL[k] + '</li>'; }).join('') : '<li class="kz-empty">Noch nichts ausgewählt.</li>';
      elSend.disabled = !ids.length;
    };
    var renderScen = function () {
      d.querySelectorAll('.kz-scen').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.scen === scen ? 'true' : 'false'); });
      d.getElementById('kzScen').innerHTML = scen ? 'Ausgangslage: <b>' + scen + '</b>' : 'Ausgangslage: noch nicht gewählt';
    };
    var flash = function () { elSum.classList.remove('is-flash'); void elSum.offsetWidth; elSum.classList.add('is-flash'); };

    d.querySelectorAll('.kz-scen').forEach(function (b) {
      b.addEventListener('click', function () { scen = scen === b.dataset.scen ? '' : b.dataset.scen; renderScen(); render(); });
    });
    elBlocks.addEventListener('click', function (e) {
      var b = e.target.closest('.kz-block'); if (!b) return;
      var id = b.dataset.id; if (sel.has(id)) sel.delete(id); else sel.add(id); render(); flash();
    });
    elPacks.addEventListener('click', function (e) {
      var b = e.target.closest('[data-pack]'); if (!b) return;
      var p = PACKS.filter(function (x) { return x.id === b.dataset.pack; })[0];
      sel = new Set(packItems(p.id)); packName = p.title; render();
      d.getElementById('kz-baukasten').scrollIntoView({ behavior: 'smooth' });
      setTimeout(flash, 500);
    });
    d.getElementById('kzReset').addEventListener('click', function () { sel.clear(); packName = ''; render(); });
    // Anfrage: Auswahl merken und im Anfrage Fenster der Startseite öffnen
    elSend.addEventListener('click', function () {
      if (!ids.length) return;
      var text = 'Konzept Paket' + (packName ? ' (Start: ' + packName + ')' : '') + '\n' + (scen ? 'Ausgangslage: ' + scen + '\n' : '') +
        'Bausteine: ' + ids.map(function (k) { return LABEL[k]; }).join(', ');
      try { sessionStorage.setItem('sb-konzept-anfrage', JSON.stringify({ paket: 'Konzept ' + (packName || 'nach Wahl'), text: text })); } catch (e) {}
      location.href = 'index.html#anfrage';
    });
    render();
  }

  // Video Fenster
  var lb = d.getElementById('kzLb'), vid = d.getElementById('kzLbVid'), x = d.getElementById('kzLbX');
  if (lb && vid) {
    var last = null, timer = 0;
    var open = function (src, poster, from) {
      clearTimeout(timer); last = from || null;
      vid.poster = poster || ''; vid.src = src;
      lb.hidden = false; d.body.style.overflow = 'hidden';
      requestAnimationFrame(function () { lb.classList.add('is-open'); });
      var pl = vid.play(); if (pl && pl.catch) pl.catch(function () {});
      x.focus();
    };
    var close = function () {
      vid.pause(); lb.classList.remove('is-open'); d.body.style.overflow = '';
      timer = setTimeout(function () { lb.hidden = true; vid.removeAttribute('src'); vid.load(); }, 300);
      if (last) last.focus();
    };
    d.addEventListener('click', function (e) {
      var t = e.target.closest('[data-video]'); if (!t) return;
      e.preventDefault(); open(t.getAttribute('data-video'), t.getAttribute('data-poster'), t);
    });
    x.addEventListener('click', close);
    lb.addEventListener('click', function (e) { if (e.target === lb) close(); });
    d.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !lb.hidden) close(); });
  }

  // Kopfleiste wie auf der Startseite: beim Runterscrollen weg, beim Hochscrollen wieder da
  var head = d.querySelector('.site-head'), lastY = window.scrollY, ticking = false;
  function onScroll() {
    var y = window.scrollY;
    head.classList.toggle('is-stuck', y > 40);
    if (!root.classList.contains('menu-open')) {
      if (y > lastY + 4 && y > 320) head.classList.add('is-hidden');
      else if (y < lastY - 4 || y <= 320) head.classList.remove('is-hidden');
    }
    lastY = y; ticking = false;
  }
  if (head) { window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true }); onScroll(); }

  // Handy Menü
  var mbtn = d.querySelector('.menu-btn'), mnav = d.getElementById('mnav'), main = d.querySelector('main');
  if (mbtn && mnav) {
    var setMenu = function (o) {
      root.classList.toggle('menu-open', o);
      mbtn.setAttribute('aria-expanded', String(o)); mbtn.setAttribute('aria-label', o ? 'Menü schließen' : 'Menü öffnen');
      mnav.inert = !o; if (main) main.inert = o;
      if (o && head) head.classList.remove('is-hidden');
    };
    mbtn.addEventListener('click', function () { setMenu(!root.classList.contains('menu-open')); });
    mnav.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
    d.addEventListener('keydown', function (e) { if (e.key === 'Escape' && root.classList.contains('menu-open')) { setMenu(false); mbtn.focus(); } });
  }

  // Uhr im Footer (Berlin)
  var clock = d.getElementById('clock');
  if (clock) {
    var tick = function () {
      try { clock.textContent = 'Berlin ' + new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' }).format(new Date()); } catch (e) {}
    };
    tick(); setInterval(tick, 30000);
  }
})();
