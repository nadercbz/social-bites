/* Social Bites Wissensgehirn: Links rein, Wissen raus. Alles Fremde läuft durch esc(), safeHref() und safeSrc().
   Backend: Whiteboard Worker (Whiteboard/src/wissen.js). Gleicher Zugang wie das Whiteboard, gleiche Sitzung. */
(function () {
  'use strict';
  const params = new URLSearchParams(location.search);
  const LOCAL = params.get('api') === 'local';
  const API = LOCAL ? 'http://127.0.0.1:8203' : 'https://social-bites-board.bitey-cloud.workers.dev';
  const TOKEN_KEY = LOCAL ? 'sb-wb-token-local' : 'sb-wb-token';
  const SALT = 'SocialBites-Whiteboard-v1';
  const UI_KEY = 'sb-gehirn-ui';
  const REGALE_KEY = 'sb-gehirn-regale';
  const POLL_MS = 12000;
  const SEITE = 60;
  const LESER_ALT_MS = 45 * 60e3;
  const MOUTH = 'mouth.webp';

  const $ = s => document.querySelector(s);
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = s => String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, c => ESC[c]);
  const safeHref = v => {
    try {
      const u = new URL(String(v || ''));
      if (u.protocol === 'https:' || u.protocol === 'http:') return u.toString();
    } catch (_) { /* ungültig */ }
    return null;
  };
  const safeSrc = v => {
    try {
      const u = new URL(String(v || ''));
      if (u.protocol === 'https:' || (LOCAL && u.origin === API)) return u.toString();
    } catch (_) { /* ungültig */ }
    return '';
  };
  const safeEmbed = v => (/^https:\/\/(www\.youtube-nocookie\.com\/embed\/|player\.vimeo\.com\/video\/)[\w?=&%-]+$/.test(String(v || '')) ? v : '');
  const einmal = s => s.replace(/\s+/g, ' ').trim();
  const fmtDatum = t => (t ? new Date(t).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '');
  const fmtKurz = t => (t ? new Date(t).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '');
  const fmtAgo = t => {
    const d = Date.now() - t;
    if (d < 90e3) return 'gerade eben';
    if (d < 36e5) return `vor ${Math.round(d / 60e3)} Min`;
    if (d < 864e5) return `vor ${Math.round(d / 36e5)} Std`;
    return `am ${fmtKurz(t)}`;
  };
  const fmtZahl = n => (n >= 1e6 ? `${(n / 1e6).toFixed(1).replace('.', ',').replace(',0', '')} Mio` : n >= 1e4 ? `${Math.round(n / 1e3)} Tsd` : n.toLocaleString('de-DE'));

  const STATUS = {
    neu: { text: 'Wartet auf Leser', cls: 'p-laeuft' },
    liest: { text: 'Wird gelesen', cls: 'p-laeuft' },
    bereit: { text: 'Wartet auf Auswertung', cls: 'p-laeuft' },
    ausgewertet: { text: 'Bitte prüfen', cls: 'p-pruefen' },
    fehler: { text: 'Fehler', cls: 'p-fehler' },
    fertig: { text: '', cls: '' },
  };
  const WARTET = new Set(['neu', 'liest', 'bereit']);

  const G = {
    me: null, items: new Map(), trash: new Map(), voll: new Map(), regale: [], hookTypen: [], eigeneRegale: [],
    regal: 'alle', q: '', typ: '', plattform: '', quelle: '', sort: 'neu', view: 'karten', limit: SEITE,
    open: null, since: 0, leser: null, textTreffer: null, frisch: new Set(), erst: true, intern: false, spielt: null, sortSpalte: null,
    lastListe: null, lastRegale: null, lastDetailKey: null,
  };

  if (window.self !== window.top) document.documentElement.classList.add('eingebettet');
  // Auf Touch Geräten gibt es kein Ziehen, und der Platz ist knapp.
  if (window.matchMedia && window.matchMedia('(hover: none)').matches) {
    $('#einwurf').placeholder = 'Link einfügen';
    $('#suche').placeholder = 'Suchen';
  }
  try {
    const ui = JSON.parse(localStorage.getItem(UI_KEY)) || {};
    if (ui.view === 'tabelle' || ui.view === 'karten') G.view = ui.view;
    if (ui.sort) G.sort = ui.sort;
    G.eigeneRegale = JSON.parse(localStorage.getItem(REGALE_KEY)) || [];
  } catch (_) { /* egal */ }
  const merkeUi = () => { try { localStorage.setItem(UI_KEY, JSON.stringify({ view: G.view, sort: G.sort })); } catch (_) { /* egal */ } };

  /* ---------- API ---------- */
  const token = () => { try { return localStorage.getItem(TOKEN_KEY); } catch (_) { return null; } };
  const setToken = t => { try { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); } catch (_) { /* privat */ } };

  async function api(path, { method = 'GET', body } = {}) {
    const h = {};
    const tok = token();
    if (tok) h.Authorization = `Bearer ${tok}`;
    if (body !== undefined) h['Content-Type'] = 'application/json';
    let res;
    try {
      res = await fetch(API + path, { method, headers: h, body: body !== undefined ? JSON.stringify(body) : undefined });
    } catch (_) {
      const e = new Error('Keine Verbindung.');
      e.network = true;
      throw e;
    }
    let data = null;
    try { data = await res.json(); } catch (_) { /* kein JSON */ }
    if (!res.ok) {
      const e = new Error((data && data.error) || 'Das hat nicht geklappt.');
      e.status = res.status;
      if (res.status === 401 && path !== '/auth/login') authWeg();
      throw e;
    }
    return data;
  }

  /* ---------- Hilfen ---------- */
  let toastT;
  function toast(text, aktion, fn) {
    const el = $('#toast');
    el.textContent = text;
    if (aktion) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = aktion;
      b.addEventListener('click', () => { el.classList.remove('on'); fn(); });
      el.appendChild(b);
    }
    el.classList.add('on');
    clearTimeout(toastT);
    toastT = setTimeout(() => el.classList.remove('on'), aktion ? 6000 : 3400);
  }
  async function kopiere(text, meldung) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (_) {
      const t = document.createElement('textarea');
      t.value = text;
      t.style.position = 'fixed';
      t.style.opacity = '0';
      document.body.appendChild(t);
      t.select();
      try { document.execCommand('copy'); } catch (_2) { /* egal */ }
      t.remove();
    }
    toast(meldung || 'Kopiert.');
  }
  let syncT;
  const setSync = (text, schlecht) => {
    const s = $('#sync');
    s.textContent = text || '';
    s.classList.toggle('schlecht', !!schlecht);
    clearTimeout(syncT);
    if (text && !schlecht && text !== 'Speichert') syncT = setTimeout(() => { s.textContent = ''; }, 2200);
  };

  const nameVon = it => it.titel || it.hook || einmal(it.kern || '').slice(0, 90) || (it.url ? it.url.replace(/^https?:\/\/(www\.)?/, '').slice(0, 80) : '') || 'Ohne Titel';
  const alleRegale = () => {
    const set = new Set(G.regale);
    for (const r of G.eigeneRegale) set.add(r);
    for (const it of G.items.values()) if (it.bereich) set.add(it.bereich);
    return [...set];
  };

  /* ---------- Speichern ---------- */
  const offen = new Map();
  let speicherT;
  function aendere(id, patch, { sofort = false } = {}) {
    const it = G.items.get(id) || G.trash.get(id);
    if (!it) return;
    Object.assign(it, patch);
    const voll = G.voll.get(id);
    if (voll) Object.assign(voll, patch);
    offen.set(id, { ...(offen.get(id) || {}), ...patch });
    setSync('Speichert');
    clearTimeout(speicherT);
    speicherT = setTimeout(speichern, sofort ? 0 : 650);
    malen({ detail: false });
  }
  async function speichern() {
    const jobs = [...offen.entries()];
    offen.clear();
    let fehler = false;
    for (const [id, patch] of jobs) {
      try {
        const r = await api(`/wissen/${id}`, { method: 'POST', body: patch });
        if (!offen.has(id)) merke(r.item);
      } catch (e) {
        if (e.network) {
          offen.set(id, { ...patch, ...(offen.get(id) || {}) });
          fehler = true;
        } else if (e.status !== 401) {
          toast(e.message);
        }
      }
    }
    if (fehler) { setSync('Nicht gespeichert, versucht es wieder', true); speicherT = setTimeout(speichern, 5000); } else if (!offen.size) setSync('Gespeichert');
  }
  const merke = it => {
    if (it.deleted_at) { G.items.delete(it.id); G.trash.set(it.id, it); } else { G.trash.delete(it.id); G.items.set(it.id, it); }
  };

  /* ---------- Filter ---------- */
  function heuhaufen(it) {
    return `${it.titel || ''} ${it.hook || ''} ${it.kern || ''} ${it.nutzen || ''} ${it.hinweis || ''} ${(it.tags || []).join(' ')} ${it.autor || ''} ${it.bereich || ''} ${it.hook_typ || ''} ${it.site || ''} ${it.beschreibung || ''}`.toLowerCase();
  }
  function passtSonst(it) {
    if (G.typ && it.hook_typ !== G.typ) return false;
    if (G.plattform && it.plattform !== G.plattform) return false;
    if (G.quelle && it.quelle !== G.quelle) return false;
    if (G.q) {
      const worte = G.q.toLowerCase().split(/\s+/).filter(Boolean);
      const h = heuhaufen(it);
      if (!worte.every(w => h.includes(w)) && !(G.textTreffer && G.textTreffer.has(it.id))) return false;
    }
    return true;
  }
  function passtRegal(it, r = G.regal) {
    if (r === 'alle') return true;
    if (r === '__eingang') return !it.bereich;
    if (r === '__pruefen') return it.status === 'ausgewertet';
    if (r === '__wartet') return WARTET.has(it.status);
    if (r === '__fehler') return it.status === 'fehler';
    return it.bereich === r;
  }
  function sortiert(list) {
    const s = G.sortSpalte;
    const mal = s && s.dir === 'ab' ? -1 : 1;
    if (s) {
      const wert = { titel: nameVon, bereich: it => it.bereich || '', typ: it => it.hook_typ || '', plattform: it => it.plattform || '', status: it => it.status || '', von: it => it.created_by || '', datum: it => it.created_at || 0 }[s.k];
      return list.sort((a, b) => {
        const x = wert(a), y = wert(b);
        return mal * (typeof x === 'number' ? x - y : String(x).localeCompare(String(y), 'de'));
      });
    }
    switch (G.sort) {
      case 'geaendert': return list.sort((a, b) => b.updated_at - a.updated_at);
      case 'az': return list.sort((a, b) => nameVon(a).localeCompare(nameVon(b), 'de'));
      case 'views': return list.sort((a, b) => ((b.zahlen && b.zahlen.views) || 0) - ((a.zahlen && a.zahlen.views) || 0) || b.created_at - a.created_at);
      default: return list.sort((a, b) => b.created_at - a.created_at);
    }
  }
  const auswahl = () => {
    if (G.regal === '__papierkorb') return sortiert([...G.trash.values()].filter(passtSonst));
    return sortiert([...G.items.values()].filter(it => passtRegal(it) && passtSonst(it)));
  };
  const filterAn = () => !!(G.q || G.typ || G.plattform || G.quelle);

  /* ---------- Malen ---------- */
  let malT = null;
  let malDetail = false;
  function malen({ detail = true } = {}) {
    malDetail = malDetail || detail;
    if (malT) return;
    // Kein requestAnimationFrame: im versteckten Tab oder Pane käme der nie.
    malT = setTimeout(() => {
      malT = null;
      malStand();
      malRegale();
      malFilter();
      malListe();
      if (malDetail) malDetailPanel(); else syncDetail();
      malDetail = false;
    }, 16);
  }

  function malStand() {
    const alle = [...G.items.values()];
    const wartet = alle.filter(i => WARTET.has(i.status)).length;
    const pruefen = alle.filter(i => i.status === 'ausgewertet').length;
    const teile = [`${alle.length.toLocaleString('de-DE')} Einträge`];
    if (wartet) teile.push(`${wartet} in Arbeit`);
    if (pruefen) teile.push(`${pruefen} prüfen`);
    $('#stand').textContent = teile.join(' · ');
    document.documentElement.classList.toggle('kaut', wartet > 0);

    const lesend = alle.filter(i => i.status === 'neu' || i.status === 'liest').length;
    const el = $('#leser');
    const alt = !G.leser || Date.now() - G.leser > LESER_ALT_MS;
    if (lesend && alt) {
      el.hidden = false;
      el.textContent = `${lesend} ${lesend === 1 ? 'Link wartet' : 'Links warten'}. Der Leser läuft auf Naders Mac und war ${G.leser ? `zuletzt ${fmtAgo(G.leser)}` : 'noch nicht'} aktiv. Sobald der Mac an ist, geht es weiter.`;
    } else el.hidden = true;
  }

  const regalZeile = (key, name, n, { drop = false, cls = '' } = {}) =>
    `<button class="regal ${cls}" type="button" data-sel="${esc(key)}"${drop ? ` data-regal="${esc(key === '__eingang' ? '' : key)}"` : ''} aria-current="${G.regal === key}"><span>${esc(name)}</span><b>${n}</b></button>`;

  function malRegale() {
    const liste = [...G.items.values()].filter(passtSonst);
    const zahl = fn => liste.filter(fn).length;
    const html = [
      '<h2>Regale</h2>',
      regalZeile('alle', 'Alles', liste.length),
      regalZeile('__eingang', 'Eingang', zahl(i => !i.bereich), { drop: true }),
      ...alleRegale().map(r => regalZeile(r, r, zahl(i => i.bereich === r), { drop: true })),
      '<button class="regal regal-neu" type="button" data-neues-regal>+ Neues Regal</button>',
      '<h2>Arbeit</h2>',
      regalZeile('__pruefen', 'Bitte prüfen', zahl(i => i.status === 'ausgewertet'), { cls: zahl(i => i.status === 'ausgewertet') ? 'fokus' : '' }),
      regalZeile('__wartet', 'In Arbeit', zahl(i => WARTET.has(i.status))),
      regalZeile('__fehler', 'Fehler', zahl(i => i.status === 'fehler'), { cls: zahl(i => i.status === 'fehler') ? 'warn' : '' }),
      regalZeile('__papierkorb', 'Papierkorb', G.trash.size || ''),
    ].join('');
    if (html !== G.lastRegale) { $('#regale').innerHTML = html; G.lastRegale = html; }
    const sel = $('#einwurfRegal');
    const ziel = ['', ...alleRegale()];
    if (sel.dataset.k !== ziel.join('|')) {
      const v = sel.value;
      sel.innerHTML = ziel.map(r => `<option value="${esc(r)}">${r ? esc(r) : 'Eingang'}</option>`).join('');
      sel.value = ziel.includes(v) ? v : '';
      sel.dataset.k = ziel.join('|');
    }
  }

  function setzeOptionen(sel, leer, werte, aktuell) {
    const k = werte.join('|');
    if (sel.dataset.k !== k) {
      sel.innerHTML = `<option value="">${esc(leer)}</option>${werte.map(w => `<option value="${esc(w)}">${esc(w)}</option>`).join('')}`;
      sel.dataset.k = k;
    }
    sel.value = aktuell;
    sel.classList.toggle('an', !!aktuell);
  }
  function malFilter() {
    const alle = [...G.items.values()];
    const uniq = fn => [...new Set(alle.map(fn).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'de'));
    setzeOptionen($('#fTyp'), 'Alle Hook Typen', [...new Set([...G.hookTypen, ...uniq(i => i.hook_typ)])], G.typ);
    setzeOptionen($('#fPlattform'), 'Alle Plattformen', uniq(i => i.plattform), G.plattform);
    setzeOptionen($('#fQuelle'), 'Alle Herkünfte', uniq(i => i.quelle), G.quelle);
    $('#fSort').value = G.sort;
    for (const b of document.querySelectorAll('#ansicht button')) b.setAttribute('aria-pressed', b.dataset.v === G.view);
  }

  function statusPille(it) {
    const s = STATUS[it.status];
    return s && s.text ? `<span class="pille ${s.cls}">${esc(s.text)}</span>` : '';
  }
  const viewsPille = it => (it.zahlen && it.zahlen.views ? `<span class="pille">${esc(fmtZahl(it.zahlen.views))} Views</span>` : '');

  function karte(it, i) {
    const id = esc(it.id);
    const akt = G.open === it.id;
    const frisch = G.frisch.has(it.id) ? ' frisch' : '';
    const ort = [it.bereich || 'Eingang', it.hook_typ, it.plattform && it.plattform !== 'Text' ? it.plattform : ''].filter(Boolean).join(' · ');
    const vorsicht = it.hinweis ? '<span class="pille p-vorsicht">Vorsicht</span>' : '';
    const kopie = it.hook ? `<button class="k-kopie" type="button" data-kopie-hook="${id}">Hook kopieren</button>` : '';
    const fuss = `<div class="k-fuss">${statusPille(it)}${viewsPille(it)}${vorsicht}${kopie}</div>`;
    const stil = i < 18 ? ` style="--i:${i}"` : '';
    const attr = `class="karte${it.hook && !it.url ? ' hook' : ''}${frisch}" draggable="true" data-id="${id}" tabindex="0" role="button" aria-current="${akt}"${stil}`;
    if (it.hook && !it.url) {
      return `<article ${attr}><div class="k-in"><div class="k-ort">${esc(ort)}</div><div class="k-gross">${esc(it.hook)}</div>${it.kern ? `<div class="k-text">${esc(it.kern)}</div>` : ''}${fuss}</div></article>`;
    }
    const bild = safeSrc(it.bild);
    return `<article ${attr}>${bild ? `<div class="k-bild"><img src="${esc(bild)}" alt="" loading="lazy" draggable="false" referrerpolicy="no-referrer"></div>` : ''}<div class="k-in"><div class="k-ort">${esc(ort)}</div><div class="k-titel">${esc(nameVon(it))}</div>${it.hook ? `<div class="k-hookzeile">${esc(it.hook)}</div>` : ''}${it.kern ? `<div class="k-text">${esc(it.kern)}</div>` : it.beschreibung ? `<div class="k-text">${esc(it.beschreibung)}</div>` : ''}${it.status === 'fehler' && it.fehler ? `<div class="k-text">${esc(it.fehler)}</div>` : ''}${fuss}</div></article>`;
  }

  const spaltenKopf = (k, name) => {
    const s = G.sortSpalte;
    const pfeil = s && s.k === k ? (s.dir === 'ab' ? ' ↓' : ' ↑') : '';
    return `<th scope="col"${s && s.k === k ? ` aria-sort="${s.dir === 'ab' ? 'descending' : 'ascending'}"` : ''}><button type="button" data-spalte="${k}">${esc(name)}${pfeil}</button></th>`;
  };
  function tabelle(list) {
    const regale = alleRegale();
    const zeile = it => {
      const id = esc(it.id);
      const s = STATUS[it.status];
      const regalOpt = [''].concat(regale).map(r => `<option value="${esc(r)}"${(it.bereich || '') === r ? ' selected' : ''}>${r ? esc(r) : 'Eingang'}</option>`).join('');
      const typOpt = [''].concat(G.hookTypen).map(t => `<option value="${esc(t)}"${(it.hook_typ || '') === t ? ' selected' : ''}>${t ? esc(t) : 'Kein Typ'}</option>`).join('');
      return `<tr data-id="${id}" draggable="true" tabindex="0" aria-current="${G.open === it.id}">
        <td class="t-titel">${esc(nameVon(it))}${it.autor ? `<small>${esc(it.autor)}</small>` : ''}</td>
        <td><select data-zelle="bereich" aria-label="Regal">${regalOpt}</select></td>
        <td><select data-zelle="hook_typ" aria-label="Hook Typ">${typOpt}</select></td>
        <td class="t-klein">${esc(it.plattform || '')}</td>
        <td class="t-klein">${s && s.text ? esc(s.text) : 'Fertig'}</td>
        <td class="t-kern"><span>${esc(it.kern || it.beschreibung || '')}</span></td>
        <td class="t-klein">${esc(it.created_by || '')}</td>
        <td class="t-klein">${esc(fmtKurz(it.created_at))}</td>
      </tr>`;
    };
    return `<div class="tabelle-wrap"><table id="tab"><thead><tr>${spaltenKopf('titel', 'Titel')}${spaltenKopf('bereich', 'Regal')}${spaltenKopf('typ', 'Hook Typ')}${spaltenKopf('plattform', 'Plattform')}${spaltenKopf('status', 'Status')}<th scope="col">Kernaussage</th>${spaltenKopf('von', 'Von')}${spaltenKopf('datum', 'Datum')}</tr></thead><tbody>${list.map(zeile).join('')}</tbody></table></div>`;
  }

  function leerZustand() {
    if (filterAn()) return `<div class="leer"><b>Nichts gefunden.</b>Mit diesen Filtern gibt es hier nichts.<br><button class="tb" type="button" data-filter-weg>Filter löschen</button></div>`;
    if (G.regal === '__papierkorb') return '<div class="leer"><b>Papierkorb ist leer.</b></div>';
    if (G.regal === '__pruefen') return '<div class="leer"><b>Alles geprüft.</b>Hier landet, was die KI ausgewertet hat.</div>';
    if (G.regal === '__wartet') return '<div class="leer"><b>Nichts in Arbeit.</b></div>';
    if (G.regal === '__fehler') return '<div class="leer"><b>Keine Fehler.</b></div>';
    return `<div class="leer"><img src="${MOUTH}" alt="" data-logo-fixed><b>Hunger.</b>Zieh einen Link hierher oder füg ihn oben ein. Das Gehirn liest ihn und sortiert ihn ein.</div>`;
  }

  let beobachter;
  function malListe() {
    const list = auswahl();
    const liste = $('#liste');
    const teil = list.slice(0, G.limit);
    let html;
    if (!list.length) html = leerZustand();
    else if (G.view === 'tabelle' && window.innerWidth > 820) html = tabelle(teil);
    else html = `<div class="spalten">${teil.map(karte).join('')}</div>`;
    if (list.length > teil.length) html += '<div class="mehr" id="mehr"></div>';
    if (html === G.lastListe) return;
    // Ein offenes Auswahlfeld in der Tabelle nicht unter dem Finger wegziehen.
    if (document.activeElement && document.activeElement.matches && document.activeElement.matches('#tab select')) return;
    liste.classList.toggle('erst', G.erst);
    liste.innerHTML = html;
    G.lastListe = html;
    if (G.erst && list.length) { G.erst = false; setTimeout(() => liste.classList.remove('erst'), 1200); }
    G.frisch.clear();
    if (beobachter) beobachter.disconnect();
    const sent = $('#mehr');
    if (sent) {
      beobachter = new IntersectionObserver(e => { if (e.some(x => x.isIntersecting)) { G.limit += SEITE; malen({ detail: false }); } }, { root: liste, rootMargin: '500px' });
      beobachter.observe(sent);
    }
  }

  /* ---------- Detail ---------- */
  const offenesItem = () => G.items.get(G.open) || G.trash.get(G.open);
  const wachse = el => { if (!el) return; el.style.height = 'auto'; el.style.height = `${el.scrollHeight + 2}px`; };

  function statusBlock(it) {
    if (it.deleted_at) return '';
    switch (it.status) {
      case 'neu': return `<div class="d-info">Der Leser auf Naders Mac holt gleich den Text aus diesem Link.${G.leser ? ` Zuletzt aktiv ${esc(fmtAgo(G.leser))}.` : ''}</div>`;
      case 'liest': return '<div class="d-info">Wird gerade gelesen. Bei Videos dauert das Transkript etwas.</div>';
      case 'bereit': return '<div class="d-info">Text ist da. Die Auswertung läuft als Nächstes. Du kannst Claude auch sagen: „Werte das Gehirn aus“.</div>';
      case 'ausgewertet': return `<div class="d-info pruefen"><span>Ausgewertet von <b>${esc(it.ausgewertet_von || 'KI')}</b>. Bitte kurz prüfen und korrigieren, dann gilt der Eintrag als fertig.</span><div class="knoepfe"><button class="tb voll" type="button" data-aktion="fertig">Passt, fertig</button></div></div>`;
      case 'fehler': return `<div class="d-info fehler"><span>${esc(it.fehler || 'Das Lesen hat nicht geklappt.')}</span><div class="knoepfe"><button class="tb" type="button" data-aktion="nochmal">Nochmal lesen</button><button class="tb voll" type="button" data-aktion="text-selbst">Text selbst einfügen</button></div></div>`;
      default: return '';
    }
  }

  function medien(it) {
    const bild = safeSrc(it.bild);
    const embed = safeEmbed(it.embed);
    if (embed && G.spielt === it.id) return `<div class="d-medien"><iframe src="${esc(embed)}" title="${esc(nameVon(it))}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`;
    if (!bild && !embed) return '';
    return `<div class="d-medien">${bild ? `<img src="${esc(bild)}" alt="" referrerpolicy="no-referrer">` : ''}${embed ? '<button class="d-play" type="button" data-aktion="spielen" aria-label="Video abspielen"><span>▶ Abspielen</span></button>' : ''}</div>`;
  }

  const auswahlFeld = (label, feld, werte, aktuell, leer, extra = '') => `<label class="f">${esc(label)}<select data-feld="${feld}"><option value="">${esc(leer)}</option>${werte.map(w => `<option value="${esc(w)}"${w === aktuell ? ' selected' : ''}>${esc(w)}</option>`).join('')}${aktuell && !werte.includes(aktuell) ? `<option value="${esc(aktuell)}" selected>${esc(aktuell)}</option>` : ''}${extra}</select></label>`;

  function malDetailPanel() {
    const box = $('#detail');
    const it = offenesItem();
    if (!it) {
      box.hidden = true;
      box.innerHTML = '';
      G.lastDetailKey = null;
      return;
    }
    const voll = G.voll.get(it.id);
    const key = `${it.id}|${it.status}|${it.deleted_at || ''}|${G.spielt === it.id}|${it.bild || ''}|${voll ? 1 : 0}|${alleRegale().join(',')}`;
    if (key === G.lastDetailKey) { syncDetail(); return; }
    const fokus = box.contains(document.activeElement) && document.activeElement.matches('textarea,input');
    if (fokus && G.lastDetailKey && G.lastDetailKey.startsWith(`${it.id}|`)) { syncDetail(); return; }
    const scroll = box.scrollTop;
    const gleicher = G.lastDetailKey && G.lastDetailKey.startsWith(`${it.id}|`);
    G.lastDetailKey = key;
    const href = safeHref(it.url);
    const z = it.zahlen;
    const zahlen = z ? ['views', 'likes', 'kommentare'].filter(k => z[k] !== undefined).map(k => `${fmtZahl(z[k])} ${k === 'views' ? 'Views' : k === 'likes' ? 'Likes' : 'Kommentare'}`).join(' · ') + (z.stand ? `, Stand ${esc(z.stand)}` : '') : '';
    const plattformen = [...new Set(['Instagram', 'TikTok', 'YouTube', 'LinkedIn', 'X', 'Facebook', 'Web', 'Text', ...[...G.items.values()].map(i => i.plattform).filter(Boolean)])];
    const pfad = [it.bereich || 'Eingang', it.quelle && it.quelle !== 'Link' ? `aus ${it.quelle}` : ''].filter(Boolean).join(' · ');
    const rohLen = voll && voll.rohtext ? voll.rohtext.length : it.textlaenge || 0;
    box.innerHTML = `
      <div class="d-kopf">
        <div class="d-pfad">${esc(pfad)}</div>
        ${it.hook ? `<button class="tb" type="button" data-aktion="kopie-hook">Hook kopieren</button>` : ''}
        <button class="tb" type="button" data-aktion="kopie-eintrag">Kopieren</button>
        <button class="tb ico" type="button" data-aktion="zu" aria-label="Schließen" title="Schließen (Esc)">✕</button>
      </div>
      <div class="d-in">
        ${medien(it)}
        <div>
          <label class="sr" for="dTitel">Titel</label>
          <textarea class="d-titel" id="dTitel" data-feld="titel" rows="1" placeholder="Titel">${esc(it.titel || '')}</textarea>
          ${href ? `<a class="d-link" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(it.site || 'Original')} öffnen ↗</a>` : ''}
          ${zahlen ? `<div class="d-zahlen">${zahlen} laut Plattform</div>` : ''}
          ${it.beschreibung ? `<p class="d-besch">${esc(it.beschreibung)}</p>` : ''}
        </div>
        ${statusBlock(it)}
        <div class="d-grid">
          ${auswahlFeld('Regal', 'bereich', alleRegale(), it.bereich || '', 'Eingang', '<option value="__neu">+ Neues Regal</option>')}
          ${auswahlFeld('Hook Typ', 'hook_typ', G.hookTypen, it.hook_typ || '', 'Kein Typ')}
          ${auswahlFeld('Plattform', 'plattform', plattformen, it.plattform || '', 'Keine')}
        </div>
        <section class="d-block">
          <h3>Quelle sagt <small>nicht von uns geprüft</small></h3>
          <label class="f">Hook, wörtlich<textarea data-feld="hook" rows="1">${esc(it.hook || '')}</textarea></label>
          <label class="f">Kernaussage<textarea data-feld="kern" rows="2">${esc(it.kern || '')}</textarea></label>
        </section>
        <section class="d-block">
          <h3>Unsere Einordnung</h3>
          <label class="f">Wie nutzen wir das für Marken?<textarea data-feld="nutzen" rows="2">${esc(it.nutzen || '')}</textarea></label>
          <label class="f">Vorsicht, Recht, Täuschung<textarea data-feld="hinweis" rows="1">${esc(it.hinweis || '')}</textarea></label>
          <label class="f">Tags, mit Komma getrennt<input data-feld="tags" type="text" value="${esc((it.tags || []).join(', '))}"></label>
        </section>
        <details class="d-roh" ${it.status === 'fehler' ? 'open' : ''}>
          <summary>Originaltext <small>${rohLen ? `${rohLen.toLocaleString('de-DE')} Zeichen` : 'noch keiner'}</small></summary>
          <label class="sr" for="dRoh">Originaltext</label>
          <textarea id="dRoh" data-feld="rohtext" placeholder="${voll ? 'Text hier einfügen, zum Beispiel die Caption oder ein Transkript.' : 'Lädt.'}" ${voll ? '' : 'disabled'}>${esc((voll && voll.rohtext) || '')}</textarea>
        </details>
        <div class="d-fuss">
          <span>${esc(it.created_by || '')}, ${esc(fmtDatum(it.created_at))}${it.updated_by && it.updated_at !== it.created_at ? `. Zuletzt ${esc(it.updated_by)}, ${esc(fmtDatum(it.updated_at))}` : ''}</span>
          <div class="knoepfe">
            ${it.deleted_at
              ? '<button class="tb" type="button" data-aktion="zurueck">Zurückholen</button><button class="tb gefahr" type="button" data-aktion="weg">Endgültig löschen</button>'
              : `${rohLen && it.status === 'fertig' ? '<button class="tb" type="button" data-aktion="auswerten">Neu auswerten</button>' : ''}<button class="tb gefahr" type="button" data-aktion="papierkorb">In den Papierkorb</button>`}
          </div>
        </div>
      </div>`;
    box.hidden = false;
    for (const t of box.querySelectorAll('textarea:not(#dRoh)')) wachse(t);
    if (gleicher) box.scrollTop = scroll; else box.scrollTop = 0;
  }

  // Fremde Änderungen übernehmen, ohne jemandem das Feld unter den Fingern zu ändern.
  function syncDetail() {
    const it = offenesItem();
    const box = $('#detail');
    if (!it || box.hidden) return;
    const voll = G.voll.get(it.id);
    const off = offen.get(it.id) || {};
    const rohFeld = $('#dRoh');
    if (rohFeld && voll && rohFeld.disabled) { rohFeld.disabled = false; rohFeld.placeholder = 'Text hier einfügen, zum Beispiel die Caption oder ein Transkript.'; }
    for (const el of box.querySelectorAll('[data-feld]')) {
      if (el === document.activeElement) continue;
      const f = el.dataset.feld;
      if (off[f] !== undefined) continue;
      let wert;
      if (f === 'tags') wert = (it.tags || []).join(', ');
      else if (f === 'rohtext') { if (!voll) continue; wert = voll.rohtext || ''; }
      else wert = it[f] || '';
      if (el.value !== wert && el.tagName !== 'SELECT') { el.value = wert; if (el.tagName === 'TEXTAREA' && el.id !== 'dRoh') wachse(el); }
      if (el.tagName === 'SELECT' && el.value !== wert && [...el.options].some(o => o.value === wert)) el.value = wert;
    }
  }

  async function oeffne(id, { fokus = false } = {}) {
    G.open = id;
    G.spielt = null;
    G.lastDetailKey = null;
    try { history.replaceState(null, '', `#e=${id}`); } catch (_) { /* egal */ }
    malen();
    if (!G.voll.has(id)) {
      try {
        const r = await api(`/wissen/${id}`);
        G.voll.set(id, r.item);
        if (G.open === id) { const roh = $('#dRoh'); if (roh && roh === document.activeElement) return; malen(); }
      } catch (e) { if (!e.network && e.status !== 401) toast(e.message); }
    }
    if (fokus) setTimeout(() => { const roh = $('#dRoh'); if (roh) { roh.closest('details').open = true; roh.focus(); } }, 60);
  }
  function schliesse() {
    if (!G.open) return;
    const war = G.open;
    G.open = null;
    G.spielt = null;
    G.voll.delete(war);
    try { history.replaceState(null, '', location.pathname + location.search); } catch (_) { /* egal */ }
    malen();
    const el = document.querySelector(`[data-id="${CSS.escape(war)}"]`);
    if (el) el.focus({ preventScroll: true });
  }

  /* ---------- Füttern ---------- */
  const URL_RE = /(?:https?:\/\/|www\.)[^\s<>"'`]+|\b(?:[\w-]+\.)+(?:com|de|net|org|io|be|tv|co|ai|app|me|fm)\/[^\s<>"'`]*/gi;
  function linksIn(text) {
    const out = [];
    for (let m of String(text || '').match(URL_RE) || []) {
      m = m.replace(/[.,;:!?)\]}]+$/, '');
      if (m && !out.includes(m)) out.push(m);
    }
    return out;
  }
  function beissen() {
    const a = $('#abwurf');
    a.hidden = false;
    a.classList.add('biss');
    setTimeout(() => { a.hidden = true; a.classList.remove('biss'); }, 600);
  }
  async function fuettereLinks(links, { regal, biss = true } = {}) {
    const bereich = regal === undefined ? $('#einwurfRegal').value : regal;
    if (biss) beissen();
    setSync('Speichert');
    try {
      const r = await api('/wissen', { method: 'POST', body: { links: links.slice(0, 50), bereich: bereich || null } });
      for (const it of r.added) { merke(it); G.frisch.add(it.id); }
      if (r.added.length && !['alle', '__wartet'].includes(G.regal) && G.regal !== (bereich || '__eingang')) G.regal = bereich || '__eingang';
      const teile = [];
      if (r.added.length) teile.push(`${r.added.length} ${r.added.length === 1 ? 'Link' : 'Links'} im Gehirn`);
      if (r.dupes.length) teile.push(`${r.dupes.length} schon drin`);
      if (r.bad.length) teile.push(`${r.bad.length} ungültig`);
      if (links.length > 50) teile.push('nur die ersten 50 genommen');
      const einzel = r.dupes.length === 1 && !r.added.length ? r.dupes[0].id : null;
      if (einzel) toast('Schon drin.', 'Ansehen', () => oeffne(einzel));
      else toast(`${teile.join(', ')}.`);
      setSync('Gespeichert');
      if (G.q || G.typ || G.plattform || G.quelle) { if (r.added.length) filterWeg(); }
      malen();
      $('#liste').scrollTop = 0;
      return true;
    } catch (e) {
      setSync(e.network ? 'Keine Verbindung' : '', true);
      if (e.status !== 401) toast(e.network ? 'Keine Verbindung. Der Link bleibt hier stehen.' : e.message);
      return false;
    }
  }
  async function fuettereText(text, titel) {
    beissen();
    try {
      const r = await api('/wissen', { method: 'POST', body: { text, titel: titel || null, bereich: $('#einwurfRegal').value || null } });
      for (const it of r.added) { merke(it); G.frisch.add(it.id); }
      toast('Text im Gehirn.');
      malen();
      return true;
    } catch (e) {
      if (e.status !== 401) toast(e.message);
      return false;
    }
  }
  function nimmEinwurf(text, titel) {
    const links = linksIn(text);
    if (links.length) return fuettereLinks(links);
    if (text.trim()) return fuettereText(text.trim(), titel);
    return Promise.resolve(false);
  }

  function wachseEinwurf() {
    const e = $('#einwurf');
    const klein = window.innerWidth <= 820;
    const min = klein ? 44 : 38;
    e.style.height = `${min}px`;
    if (e.value && (e.value.includes('\n') || e.scrollHeight > min + 2)) e.style.height = `${Math.min(e.scrollHeight, 132)}px`;
  }

  $('#fuettern').addEventListener('submit', async ev => {
    ev.preventDefault();
    const e = $('#einwurf');
    const text = e.value;
    if (!text.trim()) { e.focus(); return; }
    const btn = $('#fuetternBtn');
    btn.disabled = true;
    const okk = await nimmEinwurf(text);
    btn.disabled = false;
    if (okk) { e.value = ''; wachseEinwurf(); }
  });
  $('#einwurf').addEventListener('input', wachseEinwurf);
  $('#einwurf').addEventListener('keydown', ev => {
    if (ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing) { ev.preventDefault(); $('#fuettern').requestSubmit(); }
  });

  // Einfügen irgendwo auf der Seite
  document.addEventListener('paste', ev => {
    const t = ev.target;
    if (t && t.closest && t.closest('input,textarea,select,[contenteditable="true"]')) return;
    if (!$('#app') || $('#app').hidden) return;
    const text = (ev.clipboardData && ev.clipboardData.getData('text')) || '';
    const links = linksIn(text);
    if (links.length) { ev.preventDefault(); fuettereLinks(links); }
  });

  /* ---------- Ziehen ---------- */
  const TYP = 'text/x-sb-wissen';
  let dragT;
  function zeigeAbwurf() {
    const a = $('#abwurf');
    a.classList.remove('biss');
    a.hidden = false;
    clearTimeout(dragT);
    dragT = setTimeout(() => { a.hidden = true; }, 260);
  }
  document.addEventListener('dragstart', ev => {
    G.intern = true;
    const el = ev.target.closest && ev.target.closest('[data-id]');
    if (!el) return;
    ev.dataTransfer.setData(TYP, el.dataset.id);
    ev.dataTransfer.effectAllowed = 'move';
    el.classList.add('zieht');
    document.body.classList.add('ziehen');
  });
  document.addEventListener('dragend', ev => {
    G.intern = false;
    document.body.classList.remove('ziehen');
    if (ev.target.classList) ev.target.classList.remove('zieht');
    for (const z of document.querySelectorAll('.regal.ziel')) z.classList.remove('ziel');
  });
  const istFremd = ev => {
    if (G.intern) return false;
    const typen = [...((ev.dataTransfer && ev.dataTransfer.types) || [])];
    return typen.includes('text/uri-list') || typen.includes('text/plain') || typen.includes('text/html') || typen.includes('Files');
  };
  document.addEventListener('dragover', ev => {
    if (G.intern) {
      const r = ev.target.closest && ev.target.closest('.regal[data-regal]');
      for (const z of document.querySelectorAll('.regal.ziel')) if (z !== r) z.classList.remove('ziel');
      if (r) { ev.preventDefault(); ev.dataTransfer.dropEffect = 'move'; r.classList.add('ziel'); }
      return;
    }
    if (!istFremd(ev) || $('#app').hidden) return;
    ev.preventDefault();
    ev.dataTransfer.dropEffect = 'copy';
    zeigeAbwurf();
  });
  document.addEventListener('drop', async ev => {
    const dt = ev.dataTransfer;
    const eigene = dt.getData(TYP);
    if (eigene) {
      const r = ev.target.closest && ev.target.closest('.regal[data-regal]');
      if (r) {
        ev.preventDefault();
        const neu = r.dataset.regal || null;
        const it = G.items.get(eigene);
        if (it && (it.bereich || null) !== neu) {
          aendere(eigene, { bereich: neu }, { sofort: true });
          toast(`Nach ${neu || 'Eingang'} gelegt.`);
        }
      }
      return;
    }
    if (!istFremd(ev) || $('#app').hidden) return;
    ev.preventDefault();
    clearTimeout(dragT);
    const r = ev.target.closest && ev.target.closest('.regal[data-regal]');
    if (dt.files && dt.files.length) {
      const f = dt.files[0];
      if (/\.(txt|md|srt|vtt|csv)$/i.test(f.name) || f.type.startsWith('text/')) {
        if (f.size > 110000) { $('#abwurf').hidden = true; toast('Die Textdatei ist zu groß, höchstens rund 100.000 Zeichen.'); return; }
        await fuettereText(await f.text(), f.name);
      } else {
        $('#abwurf').hidden = true;
        toast('Das Gehirn frisst Links und Textdateien. Diese Datei kann es nicht lesen.');
      }
      return;
    }
    let links = [];
    const uri = dt.getData('text/uri-list');
    if (uri) links = uri.split(/\r?\n/).filter(l => l && !l.startsWith('#'));
    const roh = dt.getData('text/plain');
    if (!links.length) links = linksIn(roh);
    if (!links.length) {
      const hrefs = [...new DOMParser().parseFromString(dt.getData('text/html') || '', 'text/html').querySelectorAll('a[href]')].map(a => a.href).filter(h => /^https?:/.test(h));
      links = [...new Set(hrefs)];
    }
    if (links.length) await fuettereLinks(links, { regal: r ? (r.dataset.regal || null) : undefined });
    else if (roh && roh.trim()) await fuettereText(roh.trim());
    else { $('#abwurf').hidden = true; toast('Da war kein Link dabei.'); }
  });

  /* ---------- Klicks ---------- */
  function filterWeg() {
    G.q = ''; G.typ = ''; G.plattform = ''; G.quelle = ''; G.textTreffer = null;
    $('#suche').value = '';
  }
  async function ladePapierkorb() {
    try {
      const r = await api('/wissen?papierkorb=1');
      G.trash = new Map(r.items.map(i => [i.id, i]));
      malen();
    } catch (_) { /* nächster Versuch beim nächsten Öffnen */ }
  }
  function waehleRegal(key) {
    G.regal = key;
    G.limit = SEITE;
    if (key === '__papierkorb') ladePapierkorb();
    $('#liste').scrollTop = 0;
    malen();
  }

  function dialog(html) {
    const d = $('#dlg');
    d.innerHTML = html;
    d.showModal();
    return d;
  }
  function neuesRegal(fuerId) {
    const d = dialog(`<h2>Neues Regal</h2><p>Zum Beispiel Algorithmus, Thumbnails oder Community.</p><form id="dlgForm"><label class="sr" for="dlgName">Name</label><input id="dlgName" maxlength="40" autocomplete="off" placeholder="Name des Regals"><div class="knoepfe"><button class="tb" type="button" data-dlg-zu>Abbrechen</button><button class="tb voll" type="submit">Anlegen</button></div></form>`);
    $('#dlgName').focus();
    $('#dlgForm').addEventListener('submit', ev => {
      ev.preventDefault();
      const name = einmal($('#dlgName').value);
      if (!name) return;
      if (!G.eigeneRegale.includes(name) && !G.regale.includes(name)) {
        G.eigeneRegale.push(name);
        try { localStorage.setItem(REGALE_KEY, JSON.stringify(G.eigeneRegale)); } catch (_) { /* egal */ }
      }
      d.close();
      if (fuerId) aendere(fuerId, { bereich: name }, { sofort: true });
      G.lastDetailKey = null;
      malen();
    });
  }

  function eintragText(it) {
    return [`## ${nameVon(it)}`,
      it.hook ? `Hook: ${it.hook}` : '',
      it.kern ? `Quelle sagt (nicht geprüft): ${it.kern}` : '',
      it.nutzen ? `Unsere Einordnung: ${it.nutzen}` : '',
      it.hinweis ? `Vorsicht: ${it.hinweis}` : '',
      it.url ? `Link: ${it.url}` : ''].filter(Boolean).join('\n');
  }
  function briefing() {
    const list = auswahl();
    if (!list.length) { toast('Hier gibt es nichts zu kopieren.'); return; }
    const teil = list.slice(0, 80);
    const name = G.regal === 'alle' ? 'Alles' : G.regal === '__eingang' ? 'Eingang' : G.regal.replace('__', '');
    const kopf = `# Wissensgehirn, Auswahl ${name}${G.typ ? `, ${G.typ}` : ''}${G.q ? `, Suche "${G.q}"` : ''} (${teil.length} von ${list.length})\nAussagen der Quellen sind Lernnotizen und nicht von uns geprüft. Nicht als Fakt gegenüber Kunden verwenden.`;
    kopiere(`${kopf}\n\n${teil.map(eintragText).join('\n\n')}`, `${teil.length} Einträge kopiert.`);
  }
  async function abmelden() {
    try { await api('/auth/logout', { method: 'POST', body: {} }); } catch (_) { /* egal */ }
    setToken(null);
    try { localStorage.setItem('sb-wb-out', '1'); } catch (_) { /* egal */ }
    stopPoll();
    $('#app').hidden = true;
    zeigeLogin();
  }

  async function aktion(a, it) {
    switch (a) {
      case 'zu': schliesse(); return;
      case 'fertig':
        aendere(it.id, { status: 'fertig' }, { sofort: true });
        toast('Fertig.');
        malen();
        return;
      case 'nochmal':
        aendere(it.id, { status: 'neu', fehler: null }, { sofort: true });
        malen();
        return;
      case 'auswerten':
        aendere(it.id, { status: 'bereit', fehler: null }, { sofort: true });
        malen();
        return;
      case 'text-selbst': {
        const roh = $('#dRoh');
        if (roh) { roh.closest('details').open = true; roh.focus(); roh.scrollIntoView({ block: 'center' }); }
        return;
      }
      case 'spielen': G.spielt = it.id; malen(); return;
      case 'kopie-hook': kopiere(it.hook, 'Hook kopiert.'); return;
      case 'kopie-eintrag': kopiere(eintragText(it), 'Eintrag kopiert.'); return;
      case 'papierkorb': {
        const id = it.id;
        try {
          const r = await api(`/wissen/${id}`, { method: 'DELETE' });
          merke(r.item);
          G.open = null;
          try { history.replaceState(null, '', location.pathname + location.search); } catch (_) { /* egal */ }
          malen();
          toast('Im Papierkorb.', 'Rückgängig', async () => { const z = await api(`/wissen/${id}/zurueck`, { method: 'POST', body: {} }); merke(z.item); malen(); });
        } catch (e) { if (e.status !== 401) toast(e.message); }
        return;
      }
      case 'zurueck':
        try { const z = await api(`/wissen/${it.id}/zurueck`, { method: 'POST', body: {} }); merke(z.item); G.lastDetailKey = null; malen(); toast('Zurückgeholt.'); } catch (e) { if (e.status !== 401) toast(e.message); }
        return;
      case 'weg': {
        const d = dialog(`<h2>Endgültig löschen?</h2><p>„${esc(nameVon(it))}“ ist danach weg und kommt nicht zurück.</p><div class="knoepfe"><button class="tb" type="button" data-dlg-zu>Abbrechen</button><button class="tb gefahr" type="button" id="dlgWeg">Endgültig löschen</button></div>`);
        $('#dlgWeg').addEventListener('click', async () => {
          d.close();
          try { await api(`/wissen/${it.id}/weg`, { method: 'POST', body: {} }); G.trash.delete(it.id); G.open = null; malen(); toast('Gelöscht.'); } catch (e) { if (e.status !== 401) toast(e.message); }
        });
        return;
      }
      default:
    }
  }

  document.addEventListener('click', ev => {
    const t = ev.target;
    if (!t.closest) return;
    if (t.closest('[data-dlg-zu]')) { $('#dlg').close(); return; }
    const kop = t.closest('[data-kopie-hook]');
    if (kop) { ev.stopPropagation(); const it = G.items.get(kop.dataset.kopieHook) || G.trash.get(kop.dataset.kopieHook); if (it) kopiere(it.hook, 'Hook kopiert.'); return; }
    const sel = t.closest('[data-sel]');
    if (sel) { waehleRegal(sel.dataset.sel); return; }
    if (t.closest('[data-neues-regal]')) { neuesRegal(); return; }
    if (t.closest('[data-filter-weg]')) { filterWeg(); malen(); return; }
    const sp = t.closest('[data-spalte]');
    if (sp) {
      const k = sp.dataset.spalte;
      const s = G.sortSpalte;
      G.sortSpalte = s && s.k === k ? (s.dir === 'auf' ? { k, dir: 'ab' } : null) : { k, dir: 'auf' };
      malen();
      return;
    }
    const akt = t.closest('[data-aktion]');
    if (akt) { const it = offenesItem(); if (it) aktion(akt.dataset.aktion, it); return; }
    if (t.closest('#tab select')) return;
    const eintrag = t.closest('[data-id]');
    if (eintrag) { if (G.open === eintrag.dataset.id) schliesse(); else oeffne(eintrag.dataset.id); }
  });
  document.addEventListener('keydown', ev => {
    if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === 'k') { ev.preventDefault(); $('#suche').focus(); $('#suche').select(); return; }
    if (ev.key === 'Escape') {
      if ($('#dlg').open) return;
      if (G.open) { ev.preventDefault(); schliesse(); }
      return;
    }
    if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.matches && ev.target.matches('[data-id]')) { ev.preventDefault(); oeffne(ev.target.dataset.id); }
  });

  // Tabelle: direkt in der Zeile ändern
  $('#liste').addEventListener('change', ev => {
    const s = ev.target.closest && ev.target.closest('select[data-zelle]');
    if (!s) return;
    const id = s.closest('[data-id]').dataset.id;
    s.blur();
    aendere(id, { [s.dataset.zelle]: s.value || null }, { sofort: true });
  });

  // Detail: Felder speichern sich selbst
  $('#detail').addEventListener('input', ev => {
    const el = ev.target;
    const f = el.dataset && el.dataset.feld;
    if (!f || !G.open) return;
    if (el.tagName === 'TEXTAREA' && el.id !== 'dRoh') wachse(el);
    if (f === 'tags') {
      aendere(G.open, { tags: el.value.split(',').map(einmal).filter(Boolean) });
      return;
    }
    if (el.tagName === 'SELECT') return;
    aendere(G.open, { [f]: el.value || null });
  });
  $('#detail').addEventListener('change', ev => {
    const el = ev.target;
    if (el.tagName !== 'SELECT' || !G.open) return;
    const f = el.dataset.feld;
    if (f === 'bereich' && el.value === '__neu') { el.value = (offenesItem() || {}).bereich || ''; neuesRegal(G.open); return; }
    aendere(G.open, { [f]: el.value || null }, { sofort: true });
    G.lastDetailKey = null;
  });
  $('#detail').addEventListener('focusout', ev => {
    const el = ev.target;
    if (el.id === 'dRoh' && G.open) {
      const it = offenesItem();
      // Text von Hand nachgereicht: dann darf die Auswertung loslegen.
      if (it && el.value.trim() && (it.status === 'fehler' || it.status === 'neu')) {
        aendere(it.id, { status: 'bereit', fehler: null }, { sofort: true });
        toast('Text gespeichert, die Auswertung kann loslegen.');
        G.lastDetailKey = null;
        malen();
        return;
      }
    }
    if (el.matches && el.matches('[data-feld]') && offen.size) { clearTimeout(speicherT); speichern(); }
  });
  document.addEventListener('error', ev => {
    const t = ev.target;
    if (t && t.tagName === 'IMG') { const k = t.closest('.k-bild,.d-medien'); if (k && !k.querySelector('button,iframe')) k.remove(); else if (k) t.remove(); }
  }, true);

  // Filter
  let sucheT;
  $('#suche').addEventListener('input', ev => {
    G.q = ev.target.value.trim();
    G.limit = SEITE;
    G.textTreffer = null;
    malen({ detail: false });
    clearTimeout(sucheT);
    if (G.q.length >= 3) {
      const frage = G.q;
      sucheT = setTimeout(async () => {
        try {
          const r = await api(`/wissen/suche?q=${encodeURIComponent(frage)}`);
          if (frage === G.q) { G.textTreffer = new Set(r.items.map(i => i.id)); malen({ detail: false }); }
        } catch (_) { /* dann eben nur die lokale Suche */ }
      }, 350);
    }
  });
  const bindFilter = (sel, k) => $(sel).addEventListener('change', ev => { G[k] = ev.target.value; G.limit = SEITE; if (k === 'sort') { G.sortSpalte = null; merkeUi(); } malen({ detail: false }); });
  bindFilter('#fTyp', 'typ'); bindFilter('#fPlattform', 'plattform'); bindFilter('#fQuelle', 'quelle'); bindFilter('#fSort', 'sort');
  $('#ansicht').addEventListener('click', ev => { const b = ev.target.closest('[data-v]'); if (b) { G.view = b.dataset.v; merkeUi(); malen({ detail: false }); } });
  $('#btnFilter').addEventListener('click', ev => { const auf = $('#filterMehr').classList.toggle('auf'); ev.currentTarget.setAttribute('aria-expanded', auf); });
  for (const s of ['#btnBriefing', '#btnBriefing2']) $(s).addEventListener('click', briefing);
  for (const s of ['#btnIch', '#btnIch2']) $(s).addEventListener('click', abmelden);
  window.addEventListener('resize', () => { G.lastListe = null; malen({ detail: false }); });

  /* ---------- Laden und Abgleich ---------- */
  let pollT;
  const stopPoll = () => clearTimeout(pollT);
  async function abgleich() {
    clearTimeout(pollT);
    if (!document.hidden && !$('#app').hidden) {
      try {
        const r = await api(`/wissen?since=${G.since - 3000}`);
        let neu = false;
        for (const it of r.items) {
          const alt = G.items.get(it.id) || G.trash.get(it.id);
          if (offen.has(it.id)) continue;
          if (!alt || alt.updated_at !== it.updated_at || !!alt.deleted_at !== !!it.deleted_at) {
            merke(it);
            neu = true;
            const voll = G.voll.get(it.id);
            if (voll && (!alt || alt.textlaenge !== it.textlaenge)) { G.voll.delete(it.id); if (G.open === it.id) oeffne(it.id); }
          }
        }
        G.since = r.now;
        const leserNeu = r.leser !== G.leser;
        G.leser = r.leser;
        if (neu || leserNeu) malen();
        if (offen.size === 0 && $('#sync').classList.contains('schlecht')) setSync('');
      } catch (e) {
        if (e.network) setSync('Keine Verbindung', true);
      }
    }
    pollT = setTimeout(abgleich, POLL_MS);
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !$('#app').hidden) abgleich(); });

  async function start() {
    $('#boot').hidden = true;
    $('#login').hidden = true;
    $('#app').hidden = false;
    $('#btnIch').textContent = G.me.name;
    $('#btnIch').title = `${G.me.name}: abmelden`;
    const r = await api('/wissen');
    G.items = new Map(r.items.map(i => [i.id, i]));
    G.regale = r.regale;
    G.hookTypen = r.hookTypen;
    G.leser = r.leser;
    G.since = r.now;
    wachseEinwurf();
    malen();
    const h = new URLSearchParams(location.hash.slice(1)).get('e');
    if (h && G.items.has(h)) oeffne(h);
    pollT = setTimeout(abgleich, POLL_MS);
    // Einwurf gleich bereit, außer auf dem Handy (sonst springt die Tastatur auf)
    if (window.innerWidth > 820 && window.self === window.top) $('#einwurf').focus({ preventScroll: true });
  }
  window.addEventListener('hashchange', () => {
    const h = new URLSearchParams(location.hash.slice(1)).get('e');
    if (h && h !== G.open && (G.items.has(h) || G.trash.has(h))) oeffne(h);
  });

  /* ---------- Anmeldung ---------- */
  async function derive(pass) {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(SALT), iterations: 600000 }, key, 256);
    return Array.from(new Uint8Array(bits), b => b.toString(16).padStart(2, '0')).join('');
  }
  const savedPass = () => { if (LOCAL && !location.search.includes('pwtest')) return ''; try { return localStorage.getItem('akq-pw') || sessionStorage.getItem('akq-pw') || ''; } catch (_) { return ''; } };
  const savedName = () => {
    try {
      const n = localStorage.getItem('sb-wb-name');
      if (n) return n;
      const o = JSON.parse(localStorage.getItem('sb-team-zugang'));
      if (o && o.u) return o.u[0].toUpperCase() + o.u.slice(1);
    } catch (_) { /* egal */ }
    return '';
  };
  async function doLogin(name, pass) {
    const key = await derive(pass);
    const r = await api('/auth/login', { method: 'POST', body: { key, name } });
    setToken(r.token);
    try { localStorage.removeItem('sb-wb-out'); localStorage.setItem('sb-wb-name', r.name); localStorage.setItem(LOCAL ? 'akq-pw-lokal' : 'akq-pw', pass); } catch (_) { /* egal */ }
    G.me = { name: r.name, color: r.color };
  }
  function zeigeLogin(err) {
    $('#boot').hidden = true;
    $('#app').hidden = true;
    $('#login').hidden = false;
    const hat = !!savedPass();
    $('#loginPassWrap').hidden = hat && !err;
    const name = savedName();
    $('#loginName').value = name;
    $('#loginErr').textContent = err || '';
    $('#loginText').textContent = hat && !err ? 'Noch kurz sagen, wer du bist. Danach bleibt das Gehirn auf diesem Gerät offen.' : 'Einmal anmelden, danach bleibt das Gehirn auf diesem Gerät offen.';
    (name ? (hat && !err ? $('#loginGo') : $('#loginPass')) : $('#loginName')).focus();
  }
  function authWeg() {
    setToken(null);
    stopPoll();
    zeigeLogin('Bitte neu anmelden.');
    $('#loginPassWrap').hidden = !!savedPass();
    $('#loginErr').textContent = '';
  }
  $('#loginPick').addEventListener('click', ev => { const b = ev.target.closest('[data-name]'); if (b) { $('#loginName').value = b.dataset.name; $('#loginForm').requestSubmit(); } });
  $('#loginForm').addEventListener('submit', async ev => {
    ev.preventDefault();
    const name = $('#loginName').value.trim();
    const getippt = $('#loginPassWrap').hidden ? '' : $('#loginPass').value;
    const pass = getippt || savedPass();
    const fehler = $('#loginErr');
    if (!name) { fehler.textContent = 'Bitte deinen Namen eintragen.'; $('#loginName').focus(); return; }
    if (!pass) { fehler.textContent = 'Bitte die Passphrase eintragen.'; $('#loginPassWrap').hidden = false; $('#loginPass').focus(); return; }
    fehler.textContent = '';
    const go = $('#loginGo');
    go.disabled = true;
    go.textContent = 'Prüft';
    try {
      await doLogin(name, pass);
      $('#loginPass').value = '';
      await start();
    } catch (err) {
      if (err.status === 403) $('#loginPassWrap').hidden = false;
      fehler.textContent = err.message;
      if (err.status === 403) $('#loginPass').focus();
    } finally { go.disabled = false; go.textContent = 'Gehirn öffnen'; }
  });

  async function boot() {
    if (token()) {
      try {
        const me = await api('/me');
        G.me = me;
        await start();
        return;
      } catch (e) {
        if (e.network) {
          $('#boot').textContent = 'Keine Verbindung. Versucht es gleich nochmal.';
          setTimeout(boot, 3000);
          return;
        }
      }
    }
    let raus = false;
    try { raus = localStorage.getItem('sb-wb-out') === '1'; } catch (_) { /* egal */ }
    if (!raus && savedPass() && savedName()) {
      try { await doLogin(savedName(), savedPass()); await start(); return; } catch (_) { /* Fehler zeigt das Formular */ }
    }
    zeigeLogin();
  }
  boot();
})();
