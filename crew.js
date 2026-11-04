/* Social Bites Crew Dashboard. Oberfläche ohne Framework, Daten kommen vom Worker in Projects/56_Social Bite/Crew.
   Alle fremden Texte laufen durch esc(), Links durch safeHref(). Keine Inline Handler, die CSP in crew.html verbietet sie. */
(function () {
  'use strict';

  const LIVE_API = 'https://social-bites-crew.bitey-cloud.workers.dev';
  const qs = new URLSearchParams(location.search);
  const LOCAL = qs.get('api') === 'local';
  const API = LOCAL ? 'http://localhost:8201' : LIVE_API;
  const DEMO = ['1', 'admin'].includes(qs.get('demo')) ? qs.get('demo') : null;
  const TOKEN_KEY = LOCAL ? 'sb-crew-token-local' : 'sb-crew-token';
  const EMBED = (() => { try { return window.self !== window.top; } catch (e) { return true; } })();
  const PBKDF2_ROUNDS = 600000;

  const $ = (s, el) => (el || document).querySelector(s);
  const root = $('#root');
  const modal = $('#modal');

  const S = {
    data: null, view: 'start', auth: 'login', invite: null, inviteInfo: null, reset: null,
    timerJob: '', jobPerson: '', adminTab: null, calMonth: null, timeMonth: null, timeUser: null, skew: 0, openJob: null,
  };

  /* ---------- Kleinzeug ---------- */
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const safeHref = u => {
    if (!u) return '';
    if (/^[\w-]+\.html$/.test(u)) return u;
    try { const p = new URL(u); return p.protocol === 'https:' || p.protocol === 'http:' ? p.href : ''; } catch (e) { return ''; }
  };
  const ext = (u, label, cls = 'btn ghost sm') => { const h = safeHref(u); return h ? `<a class="${cls}" href="${esc(h)}" target="_blank" rel="noopener noreferrer">${ic('link')}${esc(label)}</a>` : ''; };
  const pad = n => String(n).padStart(2, '0');
  const dayStr = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseDay = s => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d); };
  const todayStr = () => dayStr(new Date());
  const diffDays = s => Math.round((parseDay(s) - parseDay(todayStr())) / 864e5);
  const fmtDay = (s, o = { day: 'numeric', month: 'short' }) => parseDay(s).toLocaleDateString('de-DE', o);
  const fmtRange = (a, b) => a === b ? fmtDay(a) : `${parseDay(a).getDate()}. bis ${fmtDay(b)}`;
  const fmtMs = ms => new Date(ms).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' }) + ', ' + new Date(ms).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  const monthKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  const monthName = k => { const [y, m] = k.split('-').map(Number); return new Date(y, m - 1, 1).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' }); };
  const euro = c => (c ?? 0) === 0 && c !== 0 ? '' : new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format((c || 0) / 100);
  const hours = min => { const h = (min || 0) / 60; return h.toLocaleString('de-DE', { maximumFractionDigits: 1 }); };
  const hm = min => `${Math.floor(min / 60)}:${pad(min % 60)}`;
  const initials = n => { const p = String(n || '?').trim().split(/\s+/); return ((p[0] || '?')[0] + (p[1] ? p[1][0] : '')).toUpperCase(); };
  const sum = (a, f) => a.reduce((x, y) => x + (f(y) || 0), 0);
  const plural = (n, a, b) => `${n} ${n === 1 ? a : b}`;

  function parseEuro(v) {
    const t = String(v || '').replace(/[€\s]/g, '').trim();
    if (!t) return null;
    const n = Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t);
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : NaN;
  }
  function parseDuration(v) {
    const t = String(v || '').trim();
    const m = /^(\d{1,2}):(\d{2})$/.exec(t);
    if (m) return Number(m[1]) * 60 + Number(m[2]);
    const n = Number(t.replace(',', '.'));
    return Number.isFinite(n) && n > 0 ? Math.round(n * 60) : NaN;
  }

  const ICONS = {
    home: '<path d="M4 11.2 12 4l8 7.2V19a1.5 1.5 0 0 1-1.5 1.5H15v-6H9v6H5.5A1.5 1.5 0 0 1 4 19z"/>',
    film: '<rect x="3.5" y="5" width="17" height="14" rx="2.5"/><path d="m10 9.3 5 2.7-5 2.7z"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    cal: '<rect x="4" y="5.5" width="16" height="14.5" rx="2.5"/><path d="M8 3.5v4M16 3.5v4M4 10h16"/>',
    receipt: '<path d="M6 3.5h12v17l-3-1.8-3 1.8-3-1.8-3 1.8z"/><path d="M9 8.5h6M9 12.5h6"/>',
    doc: '<path d="M6.5 3.5H14l4 4v13H6.5z"/><path d="M14 3.5v4h4M9.5 12.5h5M9.5 16h5"/>',
    users: '<circle cx="9" cy="8.5" r="3.5"/><path d="M3 19.5c.5-3.4 3-5.5 6-5.5s5.500 2.100 6 5.500M16 5.300a3.500 3.500 0 0 1 0 6.400M18 14.500c1.700.8 2.700 2.600 3 5"/>',
    shield: '<path d="M12 3.500 5 6v5.500c0 4.300 2.900 7.500 7 9 4.100-1.500 7-4.700 7-9V6z"/><path d="m9 12 2.200 2.200L15.300 10"/>',
    user: '<circle cx="12" cy="8.500" r="4"/><path d="M4.500 20c.7-3.800 3.700-6 7.500-6s6.800 2.200 7.500 6"/>',
    logout: '<path d="M10 4.500H6A1.500 1.500 0 0 0 4.500 6v12A1.500 1.500 0 0 0 6 19.500h4M15 8l4 4-4 4M19 12H9.500"/>',
    play: '<path d="M8 5.500v13l10.500-6.500z" fill="currentColor" stroke-linejoin="round"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    x: '<path d="m6 6 12 12M18 6 6 18"/>',
    check: '<path d="m5 12.500 4.500 4.500L19 7.500"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.700 0l3-3A4 4 0 0 0 13 5.300l-1 1"/><path d="M14 10a4 4 0 0 0-5.700 0l-3 3A4 4 0 0 0 11 18.700l1-1"/>',
    trash: '<path d="M5 7h14M10 7V4.500h4V7M7 7l1 12.500h8L17 7"/>',
    edit: '<path d="M5 19h3.500L18.700 8.800a1.800 1.800 0 0 0 0-2.500l-1-1a1.800 1.800 0 0 0-2.500 0L5 15.500z"/>',
    next: '<path d="m9 6 6 6-6 6"/>',
    prev: '<path d="m15 6-6 6 6 6"/>',
    spark: '<path d="M12 4v5M12 15v5M4 12h5M15 12h5"/>',
    bell: '<path d="M6 16.500V11a6 6 0 0 1 12 0v5.500l1.500 2h-15zM10 21h4"/>',
    copy: '<rect x="8.500" y="8.500" width="11" height="11" rx="2"/><path d="M15.500 8.500V6A1.500 1.500 0 0 0 14 4.500H6A1.500 1.500 0 0 0 4.500 6v8A1.500 1.500 0 0 0 6 15.500h2.500"/>',
  };
  const ic = n => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ''}</svg>`;

  function avatar(u, cls = '') {
    const src = u && u.avatar;
    if (src && (/^data:image\/(webp|jpeg|png);base64,/.test(src) || /^buero\/ag_\w+\.webp$/.test(src))) return `<span class="tile ${cls}"><img src="${esc(src)}" alt=""></span>`;
    return `<span class="tile ${cls}" aria-hidden="true">${esc(initials(u && u.name))}</span>`;
  }

  /* ---------- Server ---------- */
  const token = {
    get() { try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return token.mem || ''; } },
    set(v) { token.mem = v; try { localStorage.setItem(TOKEN_KEY, v); } catch (e) { /* privater Modus */ } },
    clear() { token.mem = ''; try { localStorage.removeItem(TOKEN_KEY); } catch (e) { /* privater Modus */ } },
  };

  async function call(method, path, body) {
    if (DEMO) return window.CrewDemo.call(method, path, body);
    let r;
    try {
      r = await fetch(API + path, {
        method,
        headers: Object.assign({ 'content-type': 'application/json' }, token.get() ? { authorization: 'Bearer ' + token.get() } : {}),
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (e) {
      throw new Error('Keine Verbindung zum Server. Bitte gleich noch einmal.');
    }
    let data = {};
    try { data = await r.json(); } catch (e) { /* leere Antwort */ }
    if (r.status === 401 && token.get() && !path.startsWith('/api/login')) {
      token.clear(); S.data = null; closeModal(); renderAuth();
      throw new Error('Bitte neu einloggen.');
    }
    if (r.status === 403 && /gesperrt/.test(data.error || '')) {
      token.clear(); S.data = null; closeModal(); renderAuth();
    }
    if (!r.ok) throw new Error(data.error || 'Da ist etwas schiefgelaufen.');
    return data;
  }

  async function deriveKey(email, pw) {
    const enc = new TextEncoder();
    const base = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode('social-bites-crew:v1:' + email.trim().toLowerCase()), iterations: PBKDF2_ROUNDS }, base, 256);
    return [...new Uint8Array(bits)].map(x => x.toString(16).padStart(2, '0')).join('');
  }

  async function load() {
    const d = await call('GET', '/api/bootstrap');
    S.skew = d.now - Date.now();
    S.data = d;
    return d;
  }

  async function refresh() {
    await load();
    if (S.data) renderView();
  }

  let toastTimer;
  function toast(msg, err) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.toggle('err', !!err);
    t.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('on'), err ? 5000 : 2600);
  }

  async function run(fn, ok) {
    try {
      const r = await fn();
      await refresh();
      if (ok) toast(ok);
      return r === undefined ? true : r;
    } catch (e) {
      toast(e.message, true);
      return false;
    }
  }

  /* Formular absenden: Knopf sperren, Fehler direkt im Formular zeigen */
  async function sending(f, fn) {
    const err = $('.form-err', f);
    if (err) err.textContent = '';
    const btns = [...f.querySelectorAll('button[type="submit"]')];
    btns.forEach(b => { b.disabled = true; });
    try {
      return await fn();
    } catch (e) {
      if (err) err.textContent = e.message; else toast(e.message, true);
      return undefined;
    } finally {
      btns.forEach(b => { b.disabled = false; });
    }
  }

  /* ---------- Fenster ---------- */
  function openModal(title, sub, body, wide) {
    modal.classList.toggle('wide', !!wide);
    modal.innerHTML = `<div class="m-h"><div><h2 id="modalTitle">${esc(title)}</h2>${sub ? `<p>${sub}</p>` : ''}</div><button class="ibtn" type="button" data-act="modal-close" aria-label="Schließen">${ic('x')}</button></div><div class="m-b">${body}</div>`;
    if (!modal.open) modal.showModal();
    const first = modal.querySelector('.m-b input:not([type=hidden]):not([type=checkbox]):not([type=radio]), .m-b textarea, .m-b select');
    if (first && matchMedia('(hover:hover)').matches) first.focus(); else modal.focus();
  }
  function closeModal() { S.openJob = null; if (modal.open) modal.close(); }
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
  modal.addEventListener('close', () => { S.openJob = null; });

  function confirmBox(title, text, label, fn) {
    openModal(title, null, `<p class="brief">${esc(text)}</p><div class="m-acts"><button class="btn ghost" type="button" data-act="modal-close">Abbrechen</button><button class="btn danger" type="button" data-act="confirm-yes">${esc(label)}</button></div>`);
    ACT['confirm-yes'] = async () => { closeModal(); await fn(); };
  }

  /* ---------- Daten ableiten ---------- */
  const isAdmin = () => S.data && S.data.me.role === 'admin';
  const me = () => S.data.me;
  const person = id => (S.data.crew || []).find(p => p.id === id) || (id === me().id ? me() : null);
  const personName = id => { const p = person(id); return p ? p.name : 'Ehemalige Person'; };
  const running = () => S.data.time.find(t => t.user_id === me().id && !t.ended_at);
  const jobById = id => S.data.jobs.find(j => j.id === id);
  const myJobs = () => S.data.jobs.filter(j => j.assignee_id === me().id);
  const myActive = () => myJobs().filter(j => ['zugewiesen', 'in_arbeit', 'feedback', 'review'].includes(j.status));
  const openJobs = () => S.data.jobs.filter(j => j.status === 'offen');
  const pendingUsers = () => (S.data.crew || []).filter(u => u.status === 'pending');
  const openRequests = () => S.data.absences.filter(a => a.status === 'beantragt');
  const openInvoices = () => S.data.invoices.filter(i => i.status === 'eingereicht');
  const byDeadline = (a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999');

  const JS = {
    offen: ['Offen', 'info'], zugewiesen: ['Neu', 'or'], in_arbeit: ['In Arbeit', 'warn'],
    review: ['Im Review', 'violet'], feedback: ['Feedback', 'bad'], fertig: ['Fertig', 'ok'],
  };
  const jobPill = j => `<span class="pill ${JS[j.status][1]}">${esc(JS[j.status][0])}${j.version ? ` V${j.version}` : ''}</span>`;

  function jobDue(j) {
    if (j.status === 'fertig') return { label: 'Abgeschlossen', cls: '' };
    return dueInfo(j.deadline);
  }
  function dueInfo(s) {
    if (!s) return { label: 'Ohne Deadline', cls: '' };
    const n = diffDays(s);
    if (n < 0) return { label: n === -1 ? 'Seit gestern fällig' : `Seit ${-n} Tagen fällig`, cls: 'over' };
    if (n === 0) return { label: 'Fällig heute', cls: 'hot' };
    if (n === 1) return { label: 'Fällig morgen', cls: 'hot' };
    if (n <= 7) return { label: `Fällig in ${n} Tagen`, cls: '' };
    return { label: `Fällig am ${fmtDay(s)}`, cls: '' };
  }

  /* Gesetzliche Feiertage in Berlin */
  function easter(y) {
    const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3),
      h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451),
      mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(y, mo - 1, da);
  }
  const holidayCache = {};
  function holidays(y) {
    if (holidayCache[y]) return holidayCache[y];
    const E = easter(y), add = n => dayStr(new Date(y, E.getMonth(), E.getDate() + n));
    const list = [[`${y}-01-01`, 'Neujahr'], [`${y}-03-08`, 'Frauentag'], [add(-2), 'Karfreitag'], [add(1), 'Ostermontag'], [`${y}-05-01`, 'Tag der Arbeit'], [add(39), 'Christi Himmelfahrt'], [add(50), 'Pfingstmontag'], [`${y}-10-03`, 'Tag der Deutschen Einheit'], [`${y}-12-25`, '1. Weihnachtstag'], [`${y}-12-26`, '2. Weihnachtstag']];
    return (holidayCache[y] = list);
  }
  const holidayOn = s => { const h = holidays(Number(s.slice(0, 4))).find(x => x[0] === s); return h ? h[1] : null; };
  const nextHoliday = () => { const t = todayStr(), y = new Date().getFullYear(); return [...holidays(y), ...holidays(y + 1)].find(h => h[0] >= t); };

  function workdays(a, b, year) {
    let n = 0;
    const end = parseDay(b);
    for (let d = parseDay(a); d <= end; d.setDate(d.getDate() + 1)) {
      if (year && d.getFullYear() !== year) continue;
      const wd = d.getDay();
      if (wd !== 0 && wd !== 6 && !holidayOn(dayStr(d))) n++;
    }
    return n;
  }
  const ABS = { urlaub: 'Urlaub', krank: 'Krank', frei: 'Nicht verfügbar' };
  const ABS_STATUS = { beantragt: 'Beantragt', ok: 'Freigegeben', abgelehnt: 'Abgelehnt' };

  function weekStart(d = new Date()) { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }
  function minutesIn(entries, from, to) { return sum(entries.filter(t => t.minutes && t.started_at >= from && t.started_at < to), t => t.minutes); }
  function weekMinutes(uid) {
    const s = weekStart().getTime();
    return minutesIn(S.data.time.filter(t => t.user_id === uid), s, s + 7 * 864e5);
  }
  function monthMinutes(uid, key = monthKey()) {
    const [y, m] = key.split('-').map(Number);
    return minutesIn(S.data.time.filter(t => t.user_id === uid), new Date(y, m - 1, 1).getTime(), new Date(y, m, 1).getTime());
  }

  /* ---------- Anmeldung ---------- */
  const TITLES = ['Cutter / Videoschnitt', 'Motion Design', 'Color Grading', 'Sound', 'Kamera', 'Social Media', 'Sonstiges'];
  const PRIVACY = `Wir speichern, was du hier einträgst: Name, E-Mail, Profil, Aufträge, Zeiten, Abwesenheiten und Rechnungsangaben. Das dient nur der Zusammenarbeit und Abrechnung mit Social Bites. Die Daten liegen in einer Datenbank in der EU bei Cloudflare. Komplett sehen können sie nur Nader und Tommy, andere aus der Crew sehen nur Name, Schwerpunkt, Skills, Ort und Portfolio. Dein Passwort verlässt dein Gerät nicht. Für Auskunft oder Löschung reicht eine kurze Nachricht an Nader oder Tommy.`;

  function miniMock() {
    return `<div class="mini" aria-hidden="true"><span class="mini-tab">Social Bites Crew</span><div class="mini-frame"><div class="mini-panel">
      <p class="mini-hello">Guten Morgen, Kai</p>
      <div class="mini-cols">
        <div class="card"><h3>Deine Inbox</h3>
          <div class="row"><span class="tile or">${ic('bell')}</span><span class="row-main"><b>Feedback zum Pizza Reel</b><small class="hot">Jetzt dran</small></span></div>
          <div class="row"><span class="tile">KK</span><span class="row-main"><b>Opening Recap</b><small>Fällig in 2 Tagen</small></span></div>
          <div class="row"><span class="tile">MM</span><span class="row-main"><b>Bowl Story Serie</b><small>Neuer Auftrag</small></span></div>
        </div>
        <div class="glass"><div class="timer on"><span class="t-play">${ic('play')}</span><span class="t-val"><b>1:24</b></span></div></div>
      </div>
    </div></div></div>`;
  }

  function authForm() {
    const reset = S.reset, inv = S.inviteInfo;
    if (reset) {
      return `<h2>Neues Passwort</h2><p>Für ${esc(reset.info.email)}</p>
      <form class="form" data-form="reset" novalidate autocomplete="on">
        <input type="email" name="username" value="${esc(reset.info.email)}" autocomplete="username" hidden>
        <label class="fld"><span>Neues Passwort</span><input class="in" type="password" name="pw" autocomplete="new-password" minlength="10" required><small>Mindestens 10 Zeichen.</small></label>
        <p class="form-err" role="alert"></p>
        <button class="btn or" type="submit">Passwort speichern</button>
      </form>`;
    }
    const reg = S.auth === 'register' || inv;
    const seg = inv ? '' : `<div class="seg" role="group" aria-label="Zugang"><button type="button" data-act="auth-mode" data-mode="login" aria-pressed="${!reg}">Einloggen</button><button type="button" data-act="auth-mode" data-mode="register" aria-pressed="${!!reg}">Anmelden</button></div>`;
    if (!reg) {
      return `${seg}<h2>Willkommen zurück</h2><p>Mit deiner E-Mail und deinem Passwort.</p>
      <form class="form" data-form="login" novalidate autocomplete="on">
        <label class="fld"><span>E-Mail</span><input class="in" type="email" name="email" autocomplete="username" inputmode="email" required></label>
        <label class="fld"><span>Passwort</span><input class="in" type="password" name="pw" autocomplete="current-password" required></label>
        <p class="form-err" role="alert"></p>
        <button class="btn or" type="submit">Einloggen</button>
      </form>
      <div class="auth-foot"><button type="button" data-act="auth-forgot">Passwort vergessen?</button><a href="?demo=1">Demo ansehen</a></div>`;
    }
    const inviteHead = inv ? `<h2>${inv.role === 'admin' ? 'Dein Verwaltungs Zugang' : 'Du bist eingeladen'}</h2><p>Leg dein Passwort fest, danach bist du direkt drin.</p>` : `<h2>Neu in der Crew</h2><p>Nader oder Tommy schalten dich danach frei.</p>`;
    return `${seg}${inviteHead}
      <form class="form" data-form="register" novalidate autocomplete="on">
        <label class="fld"><span>Name</span><input class="in" name="name" autocomplete="name" required maxlength="80"></label>
        <label class="fld"><span>E-Mail</span><input class="in" type="email" name="email" autocomplete="username" inputmode="email" required></label>
        <label class="fld"><span>Passwort</span><input class="in" type="password" name="pw" autocomplete="new-password" minlength="10" required><small>Mindestens 10 Zeichen.</small></label>
        ${inv ? '' : `<div class="f2"><label class="fld"><span>Ich bin</span><select class="in" name="kind"><option value="freelancer">Freelancer</option><option value="mitarbeiter">Mitarbeiter</option></select></label>
        <label class="fld"><span>Schwerpunkt</span><select class="in" name="title">${TITLES.map(t => `<option>${esc(t)}</option>`).join('')}</select></label></div>`}
        ${inv ? `<label class="fld"><span>Schwerpunkt</span><select class="in" name="title">${[...(inv.role === 'admin' ? ['Co Founder'] : []), ...TITLES].map(t => `<option>${esc(t)}</option>`).join('')}</select></label>` : ''}
        <label class="fld"><span>Portfolio Link <small>(optional)</small></span><input class="in" type="url" name="portfolio" inputmode="url" placeholder="https://"></label>
        <input class="hp" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
        <label class="check"><input type="checkbox" name="consent"><span>Ich habe den Datenschutzhinweis gelesen und bin einverstanden.</span></label>
        <details class="note"><summary>Datenschutzhinweis</summary><p>${esc(PRIVACY)}</p></details>
        <p class="form-err" role="alert"></p>
        <button class="btn or" type="submit">${inv ? 'Zugang anlegen' : 'Anmelden'}</button>
      </form>
      ${inv ? '' : '<div class="auth-foot"><a href="?demo=1">Demo ansehen</a></div>'}`;
  }

  function renderAuth() {
    document.documentElement.classList.remove('has-app');
    document.title = 'Social Bites Crew Dashboard';
    root.innerHTML = `<main class="auth">
      <section class="auth-left">
        <div class="auth-logo"><img src="logo_social_bites.webp" alt="Social Bites" width="900" height="806"><span>Crew Dashboard</span></div>
        <h1>Dein Schnitt. Deine Zeiten. Ein Ort.</h1>
        <p>Für Cutter, Freelancer und Mitarbeiter von Social Bites. Aufträge annehmen, Versionen abgeben, Stunden tracken, Rechnungen einreichen.</p>
        ${miniMock()}
      </section>
      <section class="auth-card" aria-label="Zugang">${authForm()}</section>
    </main>`;
  }

  /* ---------- Rahmen ---------- */
  function nav() {
    if (me().status !== 'active') return [['start', 'Start', 'home'], ['profil', 'Profil', 'user']];
    const n = [['start', 'Start', 'home'], ['auftraege', 'Aufträge', 'film'], ['zeiten', 'Zeiten', 'clock'], ['abwesenheit', 'Abwesenheit', 'cal'], ['rechnungen', 'Rechnungen', 'receipt'], ['dokumente', 'Dokumente', 'doc'], ['crew', 'Crew', 'users']];
    if (isAdmin()) n.push(['verwaltung', 'Verwaltung', 'shield']);
    return n;
  }
  function navBadge(id) {
    if (!S.data || me().status !== 'active') return 0;
    if (id === 'verwaltung') return pendingUsers().length + openRequests().length;
    if (id === 'auftraege') return isAdmin() ? S.data.jobs.filter(j => j.status === 'review').length : myJobs().filter(j => j.status === 'feedback' || j.status === 'zugewiesen').length;
    if (id === 'rechnungen' && isAdmin()) return openInvoices().length;
    return 0;
  }
  function rail() {
    const link = ([id, label, icon]) => {
      const b = navBadge(id);
      return `<a class="rl" href="#${id}" ${S.view === id ? 'aria-current="page"' : ''} aria-label="${esc(label)}${b ? `, ${b} neu` : ''}">${ic(icon)}<span class="rl-tip">${esc(label)}</span>${b ? `<span class="dot" aria-hidden="true">${b}</span>` : ''}</a>`;
    };
    const items = nav();
    const list = items.filter(i => i[0] !== 'profil');
    return `<nav class="rail" aria-label="Bereiche">
      <a class="rail-logo" href="#start" aria-label="Crew Dashboard Start" data-logo-fixed><img src="mouth.webp" alt=""></a>
      <div class="rail-grp">${list.map(link).join('')}</div>
      <div class="rail-end">
        <a class="rl" href="#profil" ${S.view === 'profil' ? 'aria-current="page"' : ''} aria-label="Profil">${avatar(me(), 'sm')}<span class="rl-tip">Profil</span></a>
        <button class="rl" type="button" data-act="logout" aria-label="Abmelden">${ic('logout')}<span class="rl-tip">Abmelden</span></button>
      </div>
    </nav>`;
  }
  function demoBar() {
    if (!DEMO) return '';
    return `<div class="demo-bar"><span>Demo mit Beispieldaten</span><a href="?demo=1" aria-current="${DEMO === '1'}">Crew</a><a href="?demo=admin" aria-current="${DEMO === 'admin'}">Verwaltung</a><a href="crew.html">Zur Anmeldung</a></div>`;
  }
  function renderShell() {
    document.documentElement.classList.add('has-app');
    document.documentElement.classList.toggle('embed', EMBED);
    document.documentElement.classList.toggle('has-demo', !!DEMO);
    root.innerHTML = `${demoBar()}<div class="shell">
      <a class="tab" href="#start" aria-label="Social Bites Crew Dashboard"><img src="logo_social_bites.webp" alt="" width="900" height="806"><span>Crew</span></a>
      <div class="frame"><div class="panel">
        <div id="railBox" style="display:contents"></div>
        <div class="main" id="main">
          <div class="topbar">
            <div class="search" role="search"><label class="vh" for="q">Suchen</label><input id="q" type="search" placeholder="Suchen" autocomplete="off"><div class="results" id="qres" hidden></div></div>
            <button class="round" type="button" data-theme-toggle></button>
          </div>
          <div id="view" tabindex="-1"></div>
        </div>
      </div></div>
    </div>`;
    renderView();
  }

  function timerHtml() {
    const r = running(), job = r && r.job_id ? jobById(r.job_id) : null;
    const opts = myJobs().filter(j => ['zugewiesen', 'in_arbeit', 'feedback'].includes(j.status)).sort(byDeadline);
    return `<div class="timer ${r ? 'on' : ''}">
      <button class="t-play" type="button" data-act="time-start" ${r ? 'disabled' : ''} aria-label="${r ? 'Timer läuft' : 'Timer starten'}">${ic('play')}</button>
      <div class="t-val"><b data-timer>0:00</b><span><i data-timer-sec>00</i><em title="${esc(job ? job.title : 'Arbeit')}">${esc(job ? job.title : 'Arbeit')}</em></span></div>
      <button class="t-stop" type="button" data-act="time-stop" ${r ? '' : 'disabled'} aria-label="Timer stoppen">${ic('stop')}</button>
    </div>${r ? '' : `<label class="vh" for="timerJob">Auftrag für den Timer</label><select class="timer-job" id="timerJob" data-change="timerJob"><option value="">Ohne Auftrag</option>${opts.map(j => `<option value="${esc(j.id)}" ${S.timerJob === j.id ? 'selected' : ''}>${esc(j.title)}</option>`).join('')}</select>`}`;
  }
  function tick() {
    if (!S.data || !S.data.time) return;
    const r = running();
    const el = document.querySelectorAll('[data-timer]');
    if (!el.length) return;
    let m = 0, s = 0;
    if (r) { const t = Math.max(0, Math.floor((Date.now() + S.skew - r.started_at) / 1000)); m = Math.floor(t / 60); s = t % 60; }
    el.forEach(e => { e.textContent = hm(m); });
    document.querySelectorAll('[data-timer-sec]').forEach(e => { e.textContent = pad(s); });
  }

  /* ---------- Start ---------- */
  function inboxItems() {
    const out = [];
    const add = (rank, tile, title, sub, cls, act, id, to) => out.push({ rank, tile, title, sub, cls, act, id, to });
    if (isAdmin()) {
      pendingUsers().forEach(u => add(0, avatar(u), `Neue Anmeldung: ${u.name}`, u.title, 'hot', 'person', u.id));
      S.data.jobs.filter(j => j.status === 'review').forEach(j => add(1, `<span class="tile vi">${ic('film')}</span>`, `${personName(j.assignee_id)} hat V${j.version} abgegeben`, j.title, '', 'job', j.id));
      openRequests().forEach(a => add(2, `<span class="tile bl">${ic('cal')}</span>`, `${personName(a.user_id)} beantragt Urlaub`, fmtRange(a.start_date, a.end_date), '', 'go', null, 'verwaltung'));
      openInvoices().forEach(i => add(3, `<span class="tile ok">${ic('receipt')}</span>`, `Rechnung von ${personName(i.user_id)}`, `${i.number}, ${euro(i.amount_cents)}`, '', 'go', null, 'rechnungen'));
      S.data.jobs.filter(j => j.status !== 'fertig' && j.deadline && diffDays(j.deadline) < 0).forEach(j => add(1, `<span class="tile">${esc(initials(j.client || j.title))}</span>`, `Überfällig: ${j.title}`, dueInfo(j.deadline).label, 'over', 'job', j.id));
    }
    myJobs().filter(j => j.status === 'feedback').forEach(j => add(0, `<span class="tile or">${ic('bell')}</span>`, `Feedback zu ${j.title}`, 'Jetzt dran', 'hot', 'job', j.id));
    myJobs().filter(j => j.status === 'zugewiesen').forEach(j => add(1, `<span class="tile">${esc(initials(j.client || j.title))}</span>`, `Neuer Auftrag: ${j.title}`, dueInfo(j.deadline).label, dueInfo(j.deadline).cls, 'job', j.id));
    myJobs().filter(j => j.status === 'in_arbeit' && j.deadline && diffDays(j.deadline) <= 2).forEach(j => add(1, `<span class="tile">${esc(initials(j.client || j.title))}</span>`, `Abgabe: ${j.title}`, dueInfo(j.deadline).label, dueInfo(j.deadline).cls, 'job', j.id));
    if (!isAdmin() && openJobs().length) add(3, `<span class="tile bl">${ic('film')}</span>`, plural(openJobs().length, 'offener Auftrag', 'offene Aufträge') + ' zum Annehmen', 'Wer zuerst kommt', '', 'go', null, 'auftraege');
    if (!isAdmin()) {
      S.data.absences.filter(a => a.type === 'urlaub' && a.status !== 'beantragt' && a.end_date >= todayStr()).forEach(a => add(4, `<span class="tile bl">${ic('cal')}</span>`, `Urlaub ${a.status === 'ok' ? 'freigegeben' : 'abgelehnt'}`, fmtRange(a.start_date, a.end_date), '', 'go', null, 'abwesenheit'));
      S.data.invoices.filter(i => ['bezahlt', 'abgelehnt'].includes(i.status) && i.updated_at > Date.now() - 14 * 864e5).forEach(i => add(4, `<span class="tile ok">${ic('receipt')}</span>`, `Rechnung ${i.number} ${i.status}`, euro(i.amount_cents), '', 'go', null, 'rechnungen'));
    }
    const m = me();
    if (!m.phone || !m.skills.length || !m.avatar) add(5, avatar(m), 'Profil vervollständigen', 'Damit wir dich richtig einplanen', '', 'go', null, 'profil');
    return out.sort((a, b) => a.rank - b.rank);
  }
  function inboxRow(i) {
    const attrs = i.act === 'go' ? `data-act="go" data-to="${esc(i.to)}"` : `data-act="${esc(i.act)}" data-id="${esc(i.id)}"`;
    return `<button class="row" type="button" ${attrs}>${i.tile}<span class="row-main"><b>${esc(i.title)}</b><small class="${esc(i.cls || '')}">${esc(i.sub || '')}</small></span></button>`;
  }
  function jobRow(j, cta) {
    const d = dueInfo(j.deadline);
    const who = isAdmin() && j.assignee_id ? personName(j.assignee_id) : '';
    const sub = [j.client, who].filter(Boolean).join(', ');
    return `<div class="row"><button class="row-hit" type="button" data-act="job" data-id="${esc(j.id)}"><span class="tile">${esc(initials(j.client || j.title))}</span><span class="row-main"><b>${esc(j.title)}</b><small>${esc(sub)}${sub ? ', ' : ''}<span class="due ${d.cls}">${esc(d.label)}</span></small></span></button>${cta || jobPill(j)}</div>`;
  }
  function viewStart() {
    const m = me();
    const now = new Date(), h = now.getHours();
    const hello = `${h < 11 ? 'Guten Morgen' : h < 18 ? 'Guten Tag' : 'Guten Abend'}, ${String(m.name).split(' ')[0]}`;
    const dateLine = now.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
    const items = inboxItems();
    const show = items.slice(0, 6);

    let jobsTitle = 'Deine Aufträge', list = [], empty = 'Gerade kein Auftrag bei dir. Sobald einer da ist, steht er hier.';
    if (isAdmin()) {
      jobsTitle = 'Laufende Aufträge';
      list = S.data.jobs.filter(j => j.status !== 'fertig').sort(byDeadline).slice(0, 6);
      empty = 'Noch keine Aufträge angelegt.';
    } else {
      list = myActive().sort(byDeadline).slice(0, 5);
      if (!list.length && openJobs().length) { jobsTitle = 'Offene Aufträge'; list = openJobs().sort(byDeadline).slice(0, 5); }
    }
    const cta = j => {
      const r = running();
      if (j.status === 'offen' && !isAdmin()) return `<button class="btn or sm" type="button" data-act="claim" data-id="${esc(j.id)}">Annehmen</button>`;
      if (!isAdmin() && j.assignee_id === m.id && ['zugewiesen', 'in_arbeit', 'feedback'].includes(j.status) && !r) return `<button class="btn or sm" type="button" data-act="time-job" data-id="${esc(j.id)}">Weiter schneiden</button>`;
      return null;
    };
    const jobsHtml = list.length ? list.map((j, i) => jobRow(j, i === 0 ? cta(j) : null)).join('') : `<p class="empty">${esc(empty)}</p>`;

    return `<div class="wrap">
      <div class="hello"><p>${esc(dateLine)}</p><h1>${esc(hello)}</h1></div>
      <div class="grid-home is-home">
        <div class="stack">
          <section class="card o-inbox"><h2>Deine Inbox</h2>
            ${show.length ? `<div class="rows">${show.map(inboxRow).join('')}</div>` : '<p class="empty">Alles erledigt. Nichts wartet auf dich.</p>'}
          </section>
          <section class="card o-jobs"><div class="card-h"><h2>${esc(jobsTitle)}</h2>${isAdmin() ? `<button class="btn sm" type="button" data-act="job-new">${ic('plus')}Neuer Auftrag</button>` : ''}</div>
            <div class="rows">${jobsHtml}</div>
            <a class="more" href="#auftraege">Alle anzeigen ${ic('next')}</a>
          </section>
        </div>
        <div class="stack">
          <section class="glass o-timer"><h2>Zeiterfassung</h2>${timerHtml()}</section>
          <section class="glass o-prof" aria-label="Dein Profil"><div class="prof">
            <div class="prof-top">${avatar(m, 'lg')}<div><h3>${esc(m.name)}</h3><p>${esc(m.title || '')}</p></div></div>
            <div class="prof-links"><a href="#zeiten">${ic('clock')}Zeiten</a><a href="#dokumente">${ic('doc')}Dokumente</a><a href="#abwesenheit">${ic('cal')}Abwesenheit</a></div>
          </div></section>
          ${homeStats()}
        </div>
      </div>
    </div>`;
  }
  function homeStats() {
    const m = me(), y = new Date().getFullYear();
    const mine = S.data.absences.filter(a => a.user_id === m.id && a.status === 'ok');
    const count = t => sum(mine.filter(a => a.type === t), a => workdays(a.start_date, a.end_date, y));
    let a, b;
    if (isAdmin()) {
      a = ['Aktive Crew', String((S.data.crew || []).filter(u => u.status === 'active').length), ''];
      b = ['Offene Aufträge', String(openJobs().length), ''];
    } else if (m.kind === 'mitarbeiter') {
      a = ['Urlaub ' + y, String(count('urlaub')), 'T.'];
      b = ['Krankheit', String(count('krank')), 'T.'];
    } else {
      a = ['Diese Woche', hours(weekMinutes(m.id)), 'Std.'];
      b = ['Dieser Monat', hours(monthMinutes(m.id)), 'Std.'];
    }
    const upcoming = S.data.absences.filter(x => x.user_id === m.id && x.end_date >= todayStr() && x.status !== 'abgelehnt').sort((p, q) => p.start_date.localeCompare(q.start_date)).slice(0, 2)
      .map(x => `<div class="bar ${x.status === 'beantragt' ? 'bc-offen' : 'bc-' + x.type}"><div><b>${esc(ABS[x.type])}</b><small>${esc(ABS_STATUS[x.status])}</small></div><time>${esc(fmtRange(x.start_date, x.end_date))}</time></div>`);
    const hol = nextHoliday();
    if (hol) upcoming.push(`<div class="bar bc-feiertag"><div><b>${esc(hol[1])}</b><small>Feiertag in Berlin</small></div><time>${esc(fmtDay(hol[0]))}</time></div>`);
    const away = isAdmin() ? S.data.team_away.filter(x => x.user_id !== m.id).slice(0, 3).map(x => `<div class="bar bc-frei"><div><b>${esc(personName(x.user_id))}</b><small>Nicht da</small></div><time>bis ${esc(fmtDay(x.until))}</time></div>`) : [];
    return `<section class="glass o-nums" aria-label="Kennzahlen"><div class="nums">
        <div><small>${esc(a[0])}</small><b>${esc(a[1])}${a[2] ? ` <span>${esc(a[2])}</span>` : ''}</b></div>
        <div><small>${esc(b[0])}</small><b>${esc(b[1])}${b[2] ? ` <span>${esc(b[2])}</span>` : ''}</b></div>
      </div><div class="bars">${[...away, ...upcoming].join('')}</div></section>`;
  }

  function viewPending() {
    const m = me();
    const done = [m.portfolio, m.phone, m.city, m.skills.length, m.software.length, m.avatar].filter(Boolean).length;
    return `<div class="wrap" style="max-width:640px">
      <div class="hello"><p>Willkommen in der Crew</p><h1>Danke, ${esc(String(m.name).split(' ')[0])}</h1></div>
      <section class="card"><h2>Deine Anmeldung ist da</h2>
        <p class="sub">Nader oder Tommy schauen sie sich an und schalten dich frei. Sobald das passiert ist, ändert sich diese Seite von selbst.</p>
        <div class="stepper">
          <div class="step done"><i>${ic('check')}</i><span>Angemeldet</span></div>
          <div class="step now"><i>2</i><span>Prüfung durch Nader oder Tommy</span></div>
          <div class="step"><i>3</i><span>Freigeschaltet: Aufträge, Zeiten, Rechnungen</span></div>
        </div>
      </section>
      <section class="card" style="margin-top:16px"><h2>Mach dein Profil fertig</h2>
        <p class="sub">${done} von 6 Angaben sind drin. Je mehr wir über dich wissen, desto schneller geht die Freigabe.</p>
        <p style="margin-top:12px"><a class="btn" href="#profil">Profil öffnen</a></p>
      </section>
    </div>`;
  }

  /* ---------- Aufträge ---------- */
  const BOARD = [['Offen', ['offen']], ['Neu', ['zugewiesen']], ['In Arbeit', ['in_arbeit', 'feedback']], ['Im Review', ['review']], ['Fertig', ['fertig']]];
  function jobCard(j) {
    const d = jobDue(j);
    const who = j.assignee_id && isAdmin() ? avatar(person(j.assignee_id) || { name: '?' }, 'sm') : '';
    return `<button class="jcard" type="button" data-act="job" data-id="${esc(j.id)}">
      <span class="jmeta">${jobPill(j)}${who}</span>
      <b>${esc(j.title)}</b>
      <small>${esc([j.client, j.format, j.length].filter(Boolean).join(', '))}</small>
      <span class="due ${d.cls}">${esc(d.label)}</span>
    </button>`;
  }
  function viewJobs() {
    let jobs = S.data.jobs.slice();
    if (isAdmin() && S.jobPerson) jobs = jobs.filter(j => j.assignee_id === S.jobPerson);
    const people = isAdmin() ? (S.data.crew || []).filter(u => u.status === 'active') : [];
    return `<div class="wrap wide">
      <div class="head"><div><h1>Aufträge</h1><p>${isAdmin() ? 'Alle Schnitt Aufträge. Anlegen, zuweisen, Abgaben prüfen und freigeben.' : 'Offene Aufträge annehmen, deine laufenden bearbeiten, Versionen abgeben.'}</p></div>
        <div class="acts">${isAdmin() ? `<label class="vh" for="jp">Person</label><select class="pick" id="jp" data-change="jobPerson"><option value="">Alle Personen</option>${people.map(u => `<option value="${esc(u.id)}" ${S.jobPerson === u.id ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}</select><button class="btn" type="button" data-act="job-new">${ic('plus')}Neuer Auftrag</button>` : ''}</div></div>
      <div class="board">${BOARD.map(([label, sts]) => {
        const list = jobs.filter(j => sts.includes(j.status)).sort(byDeadline);
        const shown = label === 'Fertig' ? list.slice().reverse().slice(0, 12) : list;
        return `<section class="bcol ${list.length ? '' : 'is-empty'}"><h2>${esc(label)} <span>${list.length}</span></h2><div class="bcol-list">${shown.map(jobCard).join('') || '<p class="bcol-empty">Nichts hier.</p>'}</div></section>`;
      }).join('')}</div>
    </div>`;
  }

  async function openJob(id) {
    const j = jobById(id);
    if (!j) return toast('Diesen Auftrag gibt es nicht mehr.', true);
    S.openJob = id;
    let evs = [];
    try { evs = (await call('GET', `/api/jobs/${encodeURIComponent(id)}/events`)).events; } catch (e) { toast(e.message, true); }
    if (S.openJob !== id) return;
    const m = me(), owner = j.assignee_id === m.id, admin = isAdmin();
    const d = jobDue(j);
    const metaItem = (k, v) => v ? `<div><small>${esc(k)}</small><b>${esc(v)}</b></div>` : '';
    const meta = [metaItem('Status', JS[j.status][0] + (j.version ? ` V${j.version}` : '')), metaItem('Deadline', j.deadline ? fmtDay(j.deadline, { weekday: 'short', day: 'numeric', month: 'short' }) : ''), metaItem('Format', j.format), metaItem('Länge', j.length), metaItem('Aufwand', j.hours_est ? `${String(j.hours_est).replace('.', ',')} Std.` : ''), metaItem('Honorar', j.pay_cents ? euro(j.pay_cents) : ''), admin ? metaItem('Bei', j.assignee_id ? personName(j.assignee_id) : 'Noch niemand') : ''].join('');
    const r = running();
    const acts = [];
    if (j.status === 'offen' && !admin) acts.push(`<button class="btn or" type="button" data-act="claim" data-id="${esc(id)}">Auftrag annehmen</button>`);
    if (owner && ['zugewiesen', 'in_arbeit', 'feedback'].includes(j.status) && !r) acts.push(`<button class="btn or" type="button" data-act="time-job" data-id="${esc(id)}">${ic('play')}Zeit starten</button>`);
    if (owner && r && r.job_id === id) acts.push(`<button class="btn" type="button" data-act="time-stop">${ic('stop')}Timer stoppen</button>`);
    if (owner && ['zugewiesen', 'in_arbeit'].includes(j.status)) acts.push(`<button class="btn ghost" type="button" data-act="release" data-id="${esc(id)}">Zurückgeben</button>`);
    if (admin) acts.push(`<button class="btn ghost" type="button" data-act="job-edit" data-id="${esc(id)}">${ic('edit')}Bearbeiten</button><button class="btn danger" type="button" data-act="job-del" data-id="${esc(id)}">Löschen</button>`);

    const links = [ext(j.raw_url, 'Rohmaterial'), ext(j.ref_url, 'Referenz'), ext(j.delivery_url, `Letzte Abgabe V${j.version}`)].filter(Boolean).join('');
    const evLabel = { kommentar: '', abgabe: 'Abgabe', feedback: 'Feedback', freigabe: 'Freigegeben', status: '' };
    const tl = evs.map(e => {
      const label = e.kind === 'abgabe' ? `Abgabe V${e.version}` : evLabel[e.kind];
      const body = e.kind === 'status' ? '' : (e.text ? `<p>${esc(e.text)}</p>` : '');
      return `<div class="tl-i"><span class="tile sm ${e.kind === 'feedback' ? 'or' : e.kind === 'freigabe' ? 'ok' : e.kind === 'abgabe' ? 'vi' : ''}" aria-hidden="true">${esc(initials(e.user_name))}</span><div><b>${esc(e.user_name)}</b>${e.kind === 'status' ? ` ${esc(e.text || '')}` : ''}${label ? ` <span class="pill ${e.kind === 'feedback' ? 'or' : e.kind === 'freigabe' ? 'ok' : 'violet'}">${esc(label)}</span>` : ''}<time>${esc(fmtMs(e.created_at))}</time>${body}${e.url ? ext(e.url, 'Video öffnen', 'lnk') : ''}</div></div>`;
    }).join('');

    const canWrite = owner || admin;
    const composer = canWrite ? `<form class="form" data-form="job-event" data-id="${esc(id)}" novalidate>
      <label class="fld"><span class="vh">Nachricht</span><textarea class="in" name="text" placeholder="${admin ? 'Kommentar oder Feedback' : 'Kommentar oder Hinweis zur Abgabe'}"></textarea></label>
      ${owner && j.status !== 'fertig' ? `<label class="fld"><span>Link zur Abgabe</span><input class="in" type="url" name="url" inputmode="url" placeholder="https:// (Drive, Dropbox, Frame.io)"></label>` : ''}
      <p class="form-err" role="alert"></p>
      <div class="m-acts">
        <button class="btn ghost" type="submit" value="kommentar">Kommentar</button>
        ${owner && j.status !== 'fertig' ? `<button class="btn or" type="submit" value="abgabe">Version V${j.version + 1} abgeben</button>` : ''}
        ${admin && j.assignee_id && j.status !== 'fertig' ? `<button class="btn ghost" type="submit" value="feedback">Als Feedback senden</button><button class="btn or" type="submit" value="freigabe">${ic('check')}Freigeben</button>` : ''}
      </div></form>` : `<p class="sub">Nimm den Auftrag an, dann kannst du kommentieren und abgeben.</p>`;

    openModal(j.title, `${esc(j.client || '')}${j.client ? ', ' : ''}<span class="due ${d.cls}">${esc(d.label)}</span>`, `
      <div class="meta">${meta}</div>
      ${j.brief ? `<p class="tl-sep">Briefing</p><p class="brief">${esc(j.brief)}</p>` : ''}
      ${links ? `<div class="links">${links}</div>` : ''}
      ${acts.length ? `<div class="acts" style="margin-bottom:18px">${acts.join('')}</div>` : ''}
      ${tl ? `<p class="tl-sep">Verlauf</p><div class="tl">${tl}</div>` : ''}
      ${composer}`, true);
  }

  function jobForm(j) {
    const people = (S.data.crew || []).filter(u => u.status === 'active');
    const formats = ['9:16', '16:9', '1:1', '4:5', 'Mehrere'];
    const v = j || { format: '9:16' };
    openModal(j ? 'Auftrag bearbeiten' : 'Neuer Auftrag', j ? null : 'Ohne Person landet er bei allen unter Offen, wer zuerst kommt, nimmt ihn.', `<form class="form" data-form="job" data-id="${esc(j ? j.id : '')}" novalidate>
      <label class="fld"><span>Titel</span><input class="in" name="title" required maxlength="140" value="${esc(v.title || '')}" placeholder="Pizza Reel Oktoberaktion"></label>
      <div class="f2"><label class="fld"><span>Kunde</span><input class="in" name="client" maxlength="100" value="${esc(v.client || '')}"></label>
      <label class="fld"><span>Deadline</span><input class="in" type="date" name="deadline" value="${esc(v.deadline || '')}"></label></div>
      <div class="f3"><label class="fld"><span>Format</span><select class="in" name="format">${[...new Set([...formats, v.format])].map(f => `<option ${f === v.format ? 'selected' : ''}>${esc(f)}</option>`).join('')}</select></label>
      <label class="fld"><span>Länge</span><input class="in" name="length" maxlength="40" value="${esc(v.length || '')}" placeholder="30 s"></label>
      <label class="fld"><span>Aufwand in Std.</span><input class="in" name="hours_est" inputmode="decimal" value="${esc(v.hours_est ? String(v.hours_est).replace('.', ',') : '')}"></label></div>
      <div class="f2"><label class="fld"><span>Honorar in € <small>(optional)</small></span><input class="in" name="pay" inputmode="decimal" value="${v.pay_cents ? esc(String(v.pay_cents / 100).replace('.', ',')) : ''}"></label>
      <label class="fld"><span>Person</span><select class="in" name="assignee_id"><option value="">Offen für alle</option>${people.map(u => `<option value="${esc(u.id)}" ${v.assignee_id === u.id ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}</select></label></div>
      <div class="f2"><label class="fld"><span>Rohmaterial Link</span><input class="in" type="url" name="raw_url" inputmode="url" value="${esc(v.raw_url || '')}" placeholder="https://"></label>
      <label class="fld"><span>Referenz Link</span><input class="in" type="url" name="ref_url" inputmode="url" value="${esc(v.ref_url || '')}" placeholder="https://"></label></div>
      <label class="fld"><span>Briefing</span><textarea class="in" name="brief" maxlength="6000" rows="5">${esc(v.brief || '')}</textarea></label>
      <p class="form-err" role="alert"></p>
      <div class="m-acts"><button class="btn ghost" type="button" data-act="modal-close">Abbrechen</button><button class="btn or" type="submit">${j ? 'Speichern' : 'Auftrag anlegen'}</button></div>
    </form>`, true);
  }

  /* ---------- Zeiten ---------- */
  function monthOptions(sel) {
    const out = [], d = new Date();
    for (let i = 0; i < 13; i++) { const k = monthKey(new Date(d.getFullYear(), d.getMonth() - i, 1)); out.push(`<option value="${k}" ${k === sel ? 'selected' : ''}>${esc(monthName(k))}</option>`); }
    return out.join('');
  }
  function weekChart(uid) {
    const s = weekStart();
    const days = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((l, i) => {
      const from = s.getTime() + i * 864e5;
      const date = new Date(s.getFullYear(), s.getMonth(), s.getDate() + i);
      return { l, min: minutesIn(S.data.time.filter(t => t.user_id === uid), date.getTime(), date.getTime() + 864e5), today: dayStr(date) === todayStr(), date, from };
    });
    const max = Math.max(60, ...days.map(d => d.min));
    return `<div class="week" role="img" aria-label="Stunden diese Woche: ${days.map(d => `${d.l} ${hours(d.min)}`).join(', ')}">${days.map(d => `<div class="wk ${d.today ? 'today' : ''} ${d.min ? '' : 'zero'}" tabindex="0"><span class="wk-tip">${esc(d.l)}: ${hours(d.min)} Std.</span><i style="height:${Math.max(2, Math.round(d.min / max * 100))}%"></i><small>${d.l}</small></div>`).join('')}</div>`;
  }
  function viewTime() {
    const m = me(), admin = isAdmin();
    S.timeMonth = S.timeMonth || monthKey();
    S.timeUser = S.timeUser || m.id;
    const uid = admin ? S.timeUser : m.id;
    const [y, mo] = S.timeMonth.split('-').map(Number);
    const from = new Date(y, mo - 1, 1).getTime(), to = new Date(y, mo, 1).getTime();
    const entries = S.data.time.filter(t => t.user_id === uid && t.started_at >= from && t.started_at < to);
    const total = sum(entries, t => t.minutes);
    const who = person(uid) || m;
    const value = who.rate_cents ? Math.round(total / 60 * who.rate_cents) : 0;
    const groups = {};
    entries.forEach(t => { (groups[dayStr(new Date(t.started_at))] = groups[dayStr(new Date(t.started_at))] || []).push(t); });
    const days = Object.keys(groups).sort().reverse();
    const list = days.map(d => {
      const items = groups[d];
      return `<tr><th class="day" colspan="3">${esc(fmtDay(d, { weekday: 'long', day: 'numeric', month: 'long' }))}, ${esc(hm(sum(items, t => t.minutes)))} Std.</th></tr>` + items.map(t => {
        const job = t.job_id ? jobById(t.job_id) : null;
        return `<tr><td>${esc(job ? job.title : 'Ohne Auftrag')}${t.note ? `<br><small class="sub">${esc(t.note)}</small>` : ''}</td><td class="num">${t.ended_at ? esc(hm(t.minutes || 0)) : '<span class="pill or">Läuft</span>'}</td><td>${t.ended_at ? `<button class="ibtn" type="button" data-act="time-del" data-id="${esc(t.id)}" aria-label="Eintrag löschen">${ic('trash')}</button>` : ''}</td></tr>`;
      }).join('');
    }).join('');

    let overview = '';
    if (admin) {
      const rows = (S.data.crew || []).filter(u => u.status === 'active').map(u => ({ u, min: monthMinutes(u.id, S.timeMonth) })).sort((a, b) => b.min - a.min);
      overview = `<section class="card" style="margin-bottom:16px"><h2>${esc(monthName(S.timeMonth))} je Person</h2><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Person</th><th>Stunden</th><th>Satz</th><th>Wert</th></tr></thead><tbody>${rows.map(({ u, min }) => `<tr><td><button class="lnk" type="button" data-act="time-user" data-id="${esc(u.id)}">${esc(u.name)}</button></td><td class="num">${hours(min)}</td><td class="num">${u.rate_cents ? euro(u.rate_cents) : ''}</td><td class="num">${u.rate_cents ? euro(Math.round(min / 60 * u.rate_cents)) : ''}</td></tr>`).join('')}</tbody></table></div></section>`;
    }
    return `<div class="wrap">
      <div class="head"><div><h1>Zeiten</h1><p>${admin && uid !== m.id ? `Stunden von ${esc(who.name)}.` : 'Timer starten oder Stunden nachtragen.'}</p></div>
        <div class="acts">${admin ? `<label class="vh" for="tu">Person</label><select class="pick" id="tu" data-change="timeUser">${(S.data.crew || []).filter(u => u.status === 'active').map(u => `<option value="${esc(u.id)}" ${u.id === uid ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}</select>` : ''}<label class="vh" for="tm">Monat</label><select class="pick" id="tm" data-change="timeMonth">${monthOptions(S.timeMonth)}</select><button class="btn" type="button" data-act="time-new">${ic('plus')}Nachtragen</button></div></div>
      ${overview}
      <div class="grid-2" style="margin-bottom:16px">
        <div class="stack"><section class="glass"><h2>Zeiterfassung</h2>${timerHtml()}</section>
          <section class="glass"><div class="nums"><div><small>${esc(monthName(S.timeMonth))}</small><b>${hours(total)} <span>Std.</span></b></div>${value ? `<div><small>Wert bei ${esc(euro(who.rate_cents))}</small><b>${esc(euro(value))}</b></div>` : ''}</div></section></div>
        <section class="card"><h2>Diese Woche</h2><p class="big">${hours(weekMinutes(uid))} <span>Std.</span></p>${weekChart(uid)}</section>
      </div>
      <section class="card"><h2>Einträge</h2>${list ? `<div class="tbl-wrap"><table class="tbl entries"><tbody>${list}</tbody></table></div>` : '<p class="empty">In diesem Monat ist noch nichts eingetragen.</p>'}</section>
    </div>`;
  }
  function timeForm() {
    const opts = myJobs().filter(j => j.status !== 'offen').sort(byDeadline);
    openModal('Zeit nachtragen', null, `<form class="form" data-form="time" novalidate>
      <div class="f2 keep"><label class="fld"><span>Datum</span><input class="in" type="date" name="date" value="${todayStr()}" max="${todayStr()}" required></label>
      <label class="fld"><span>Dauer</span><input class="in" name="duration" placeholder="1:30 oder 1,5" required></label></div>
      <label class="fld"><span>Auftrag</span><select class="in" name="job_id"><option value="">Ohne Auftrag</option>${opts.map(j => `<option value="${esc(j.id)}">${esc(j.title)}</option>`).join('')}</select></label>
      <label class="fld"><span>Notiz</span><input class="in" name="note" maxlength="300"></label>
      <p class="form-err" role="alert"></p>
      <div class="m-acts"><button class="btn ghost" type="button" data-act="modal-close">Abbrechen</button><button class="btn or" type="submit">Eintragen</button></div>
    </form>`);
  }

  /* ---------- Abwesenheit ---------- */
  function calendar() {
    const k = S.calMonth || monthKey();
    const [y, mo] = k.split('-').map(Number);
    const first = new Date(y, mo - 1, 1), lead = (first.getDay() + 6) % 7, count = new Date(y, mo, 0).getDate();
    const list = S.data.absences.filter(a => a.status !== 'abgelehnt');
    const cells = [];
    for (let i = 0; i < lead; i++) cells.push('<div class="cd out"></div>');
    for (let d = 1; d <= count; d++) {
      const s = `${y}-${pad(mo)}-${pad(d)}`, wd = new Date(y, mo - 1, d).getDay();
      const hol = holidayOn(s);
      const marks = list.filter(a => a.start_date <= s && a.end_date >= s).slice(0, 2).map(a => {
        const who = isAdmin() ? String(personName(a.user_id)).split(' ')[0] : ABS[a.type];
        return `<em class="${a.status === 'beantragt' ? 'beantragt' : a.type}" title="${esc(personName(a.user_id))}: ${esc(ABS[a.type])}">${esc(who)}</em>`;
      }).join('');
      cells.push(`<div class="cd ${wd === 0 || wd === 6 ? 'we' : ''} ${s === todayStr() ? 'today' : ''}"><b>${d}</b>${hol ? `<em class="feiertag" title="${esc(hol)}">${esc(hol)}</em>` : ''}${marks}</div>`);
    }
    return `<div class="cal-h"><h2>${esc(monthName(k))}</h2><div class="acts"><button class="ibtn" type="button" data-act="cal" data-d="-1" aria-label="Monat zurück">${ic('prev')}</button><button class="ibtn" type="button" data-act="cal" data-d="1" aria-label="Monat vor">${ic('next')}</button></div></div>
      <div class="cal">${['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(l => `<small>${l}</small>`).join('')}${cells.join('')}</div>`;
  }
  function viewAbsence() {
    const m = me(), y = new Date().getFullYear(), admin = isAdmin();
    const mine = S.data.absences.filter(a => a.user_id === m.id);
    const count = t => sum(mine.filter(a => a.type === t && a.status === 'ok'), a => workdays(a.start_date, a.end_date, y));
    const rows = mine.slice().sort((a, b) => b.start_date.localeCompare(a.start_date)).slice(0, 20).map(a => {
      const canDel = a.status === 'beantragt' || a.type !== 'urlaub' || a.start_date > todayStr();
      return `<div class="bar ${a.status === 'beantragt' ? 'bc-offen' : 'bc-' + a.type}"><div><b>${esc(ABS[a.type])}</b><small>${esc(ABS_STATUS[a.status])}, ${plural(workdays(a.start_date, a.end_date), 'Arbeitstag', 'Arbeitstage')}</small></div><time>${esc(fmtRange(a.start_date, a.end_date))}</time>${canDel ? `<button class="ibtn" type="button" data-act="abs-del" data-id="${esc(a.id)}" aria-label="Löschen">${ic('trash')}</button>` : ''}</div>`;
    }).join('');
    return `<div class="wrap">
      <div class="head"><div><h1>Abwesenheit</h1><p>${m.kind === 'mitarbeiter' ? 'Urlaub beantragen, Krankheit melden.' : 'Sag Bescheid, wann du nicht verfügbar bist. Urlaub geht zur Freigabe, der Rest gilt direkt.'}</p></div>
        <div class="acts"><button class="btn" type="button" data-act="abs-new">${ic('plus')}Eintragen</button></div></div>
      <div class="grid-home">
        <section class="card">${calendar()}</section>
        <div class="stack">
          <section class="glass"><div class="nums"><div><small>Urlaub ${y}</small><b>${count('urlaub')} <span>T.</span></b></div><div><small>Krankheit</small><b>${count('krank')} <span>T.</span></b></div></div></section>
          <section class="glass"><h2>${admin ? 'Deine Einträge' : 'Einträge'}</h2><div class="bars">${rows || '<p class="sub" style="padding:0 4px 4px">Noch nichts eingetragen.</p>'}</div></section>
        </div>
      </div>
    </div>`;
  }
  function absenceForm() {
    const kindDefault = me().kind === 'mitarbeiter' ? 'urlaub' : 'frei';
    openModal('Abwesenheit eintragen', null, `<form class="form" data-form="absence" novalidate>
      <label class="fld"><span>Art</span><select class="in" name="type">${Object.keys(ABS).map(k => `<option value="${k}" ${k === kindDefault ? 'selected' : ''}>${esc(ABS[k])}</option>`).join('')}</select></label>
      <div class="f2 keep"><label class="fld"><span>Von</span><input class="in" type="date" name="start_date" value="${todayStr()}" required></label>
      <label class="fld"><span>Bis</span><input class="in" type="date" name="end_date" value="${todayStr()}" required></label></div>
      <label class="fld"><span>Notiz <small>(sehen nur Nader und Tommy)</small></span><input class="in" name="note" maxlength="300"></label>
      <p class="form-err" role="alert"></p>
      <div class="m-acts"><button class="btn ghost" type="button" data-act="modal-close">Abbrechen</button><button class="btn or" type="submit">Eintragen</button></div>
    </form>`);
  }

  /* ---------- Rechnungen ---------- */
  const INV = { eingereicht: ['Eingereicht', 'info'], geprueft: ['Geprüft', 'violet'], bezahlt: ['Bezahlt', 'ok'], abgelehnt: ['Abgelehnt', 'bad'] };
  function viewInvoices() {
    const admin = isAdmin(), m = me(), y = String(new Date().getFullYear());
    const list = S.data.invoices;
    const scope = admin ? list : list.filter(i => i.user_id === m.id);
    const open = sum(scope.filter(i => ['eingereicht', 'geprueft'].includes(i.status)), i => i.amount_cents);
    const paid = sum(scope.filter(i => i.status === 'bezahlt' && i.period.startsWith(y)), i => i.amount_cents);
    const rows = scope.map(i => {
      const statusCell = admin
        ? `<label class="vh" for="s${esc(i.id)}">Status</label><select class="pick" id="s${esc(i.id)}" data-change="invoiceStatus" data-id="${esc(i.id)}">${Object.keys(INV).map(k => `<option value="${k}" ${k === i.status ? 'selected' : ''}>${esc(INV[k][0])}</option>`).join('')}</select>`
        : `<span class="pill ${INV[i.status][1]}">${esc(INV[i.status][0])}</span>`;
      const del = (admin || i.status === 'eingereicht') ? `<button class="ibtn" type="button" data-act="inv-del" data-id="${esc(i.id)}" aria-label="Löschen">${ic('trash')}</button>` : '';
      const link = safeHref(i.url) ? `<a class="lnk" href="${esc(safeHref(i.url))}" target="_blank" rel="noopener noreferrer">${esc(i.number)}</a>` : esc(i.number);
      return `<tr><td>${link}${i.note ? `<br><small class="sub">${esc(i.note)}</small>` : ''}</td>${admin ? `<td>${esc(personName(i.user_id))}</td>` : ''}<td>${esc(monthName(i.period))}</td><td class="num">${esc(euro(i.amount_cents))}</td><td>${statusCell}</td><td>${del}</td></tr>`;
    }).join('');
    const min = monthMinutes(m.id);
    const hint = m.rate_cents && min && !admin ? `<section class="glass" style="margin-bottom:16px"><div class="nums"><div><small>${esc(monthName(monthKey()))} getrackt</small><b>${hours(min)} <span>Std.</span></b></div><div><small>Bei ${esc(euro(m.rate_cents))} die Stunde</small><b>${esc(euro(Math.round(min / 60 * m.rate_cents)))}</b></div></div></section>` : '';
    return `<div class="wrap">
      <div class="head"><div><h1>Rechnungen</h1><p>${admin ? 'Alle eingereichten Rechnungen der Crew. Status setzen, sobald geprüft oder bezahlt.' : 'Rechnung als PDF ablegen (Drive, Dropbox) und den Link hier einreichen.'}</p></div>
        <div class="acts">${admin ? '' : `<button class="btn" type="button" data-act="inv-new">${ic('plus')}Rechnung einreichen</button>`}</div></div>
      <section class="glass" style="margin-bottom:16px"><div class="nums"><div><small>Noch offen</small><b>${esc(euro(open))}</b></div><div><small>Bezahlt ${y}</small><b>${esc(euro(paid))}</b></div></div></section>
      ${hint}
      <section class="card"><h2>Alle Rechnungen</h2>${rows ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Nummer</th>${admin ? '<th>Von</th>' : ''}<th>Monat</th><th>Betrag</th><th>Status</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>` : '<p class="empty">Noch keine Rechnungen.</p>'}</section>
    </div>`;
  }
  function invoiceForm() {
    openModal('Rechnung einreichen', 'IBAN und Steuerdaten stehen auf deiner Rechnung, hier brauchen wir sie nicht.', `<form class="form" data-form="invoice" novalidate>
      <div class="f2 keep"><label class="fld"><span>Rechnungsnummer</span><input class="in" name="number" maxlength="60" required></label>
      <label class="fld"><span>Betrag in € brutto</span><input class="in" name="amount" inputmode="decimal" required placeholder="450,00"></label></div>
      <label class="fld"><span>Leistungsmonat</span><input class="in" type="month" name="period" value="${monthKey()}" required></label>
      <label class="fld"><span>Link zur Rechnung (PDF)</span><input class="in" type="url" name="url" inputmode="url" placeholder="https://"></label>
      <label class="fld"><span>Notiz</span><input class="in" name="note" maxlength="500"></label>
      <p class="form-err" role="alert"></p>
      <div class="m-acts"><button class="btn ghost" type="button" data-act="modal-close">Abbrechen</button><button class="btn or" type="submit">Einreichen</button></div>
    </form>`);
  }

  /* ---------- Dokumente ---------- */
  function viewDocs() {
    const admin = isAdmin();
    const cats = {};
    S.data.docs.forEach(d => { (cats[d.category] = cats[d.category] || []).push(d); });
    const body = Object.keys(cats).map(c => `<h2 class="sect">${esc(c)}</h2><div class="grid-3">${cats[c].map(d => {
      const lines = (d.text || '').split('\n').filter(Boolean);
      const text = lines.length > 1 ? `<ul>${lines.map(l => `<li>${esc(l)}</li>`).join('')}</ul>` : (lines[0] ? `<p>${esc(lines[0])}</p>` : '');
      return `<article class="dcard"><h3>${esc(d.title)}</h3>${text}<div class="acts">${ext(d.url, 'Öffnen')}${admin ? `<button class="ibtn" type="button" data-act="doc-edit" data-id="${esc(d.id)}" aria-label="Bearbeiten">${ic('edit')}</button><button class="ibtn" type="button" data-act="doc-del" data-id="${esc(d.id)}" aria-label="Löschen">${ic('trash')}</button>` : ''}</div></article>`;
    }).join('')}</div>`).join('');
    return `<div class="wrap wide">
      <div class="head"><div><h1>Dokumente</h1><p>Schnitt Regeln, Abgabe Standard und alles zur Marke.</p></div>
        <div class="acts">${admin ? `<button class="btn" type="button" data-act="doc-new">${ic('plus')}Dokument</button>` : ''}</div></div>
      ${body || '<section class="card"><p class="empty">Noch keine Dokumente.</p></section>'}
    </div>`;
  }
  function docForm(d) {
    const v = d || {};
    openModal(d ? 'Dokument bearbeiten' : 'Neues Dokument', 'Link oder Text reicht. Bei Text wird jede Zeile ein Punkt.', `<form class="form" data-form="doc" data-id="${esc(d ? d.id : '')}" novalidate>
      <div class="f2"><label class="fld"><span>Titel</span><input class="in" name="title" required maxlength="120" value="${esc(v.title || '')}"></label>
      <label class="fld"><span>Bereich</span><input class="in" name="category" maxlength="40" value="${esc(v.category || 'Schnitt')}" list="docCats"></label></div>
      <datalist id="docCats"><option>Schnitt</option><option>Marke</option><option>Verträge</option><option>Vorlagen</option></datalist>
      <label class="fld"><span>Link</span><input class="in" name="url" inputmode="url" value="${esc(v.url || '')}" placeholder="https://"></label>
      <label class="fld"><span>Text</span><textarea class="in" name="text" rows="7" maxlength="6000">${esc(v.text || '')}</textarea></label>
      <input type="hidden" name="sort" value="${esc(v.sort ?? 100)}">
      <p class="form-err" role="alert"></p>
      <div class="m-acts"><button class="btn ghost" type="button" data-act="modal-close">Abbrechen</button><button class="btn or" type="submit">Speichern</button></div>
    </form>`);
  }

  /* ---------- Crew ---------- */
  function viewCrew() {
    const admin = isAdmin();
    const people = (S.data.crew || []).filter(u => u.status === 'active');
    const away = id => S.data.team_away.find(x => x.user_id === id);
    const card = u => {
      const a = away(u.id), tagName = admin ? 'button' : 'div';
      const attrs = admin ? `type="button" data-act="person" data-id="${esc(u.id)}"` : '';
      return `<${tagName} class="pcard" ${attrs}>
        <span class="pcard-top">${avatar(u, 'xl')}<span><h3>${esc(u.name)}</h3><p>${esc(u.title || '')}${u.city ? `, ${esc(u.city)}` : ''}</p></span></span>
        <span class="tags"><span class="pill ${a ? 'warn' : 'ok'}">${a ? `Nicht da bis ${esc(fmtDay(a.until))}` : 'Verfügbar'}</span><span class="tag">${u.kind === 'mitarbeiter' ? 'Mitarbeiter' : 'Freelancer'}</span>${u.role === 'admin' ? '<span class="tag">Verwaltung</span>' : ''}</span>
        ${u.skills.length ? `<span class="tags">${u.skills.slice(0, 5).map(s => `<span class="tag">${esc(s)}</span>`).join('')}</span>` : ''}
        ${!admin && safeHref(u.portfolio) ? `<a class="lnk" href="${esc(safeHref(u.portfolio))}" target="_blank" rel="noopener noreferrer">Portfolio ansehen</a>` : ''}
      </${tagName}>`;
    };
    return `<div class="wrap wide">
      <div class="head"><div><h1>Crew</h1><p>${plural(people.length, 'Person', 'Personen')} im Team.${admin ? ' Klick öffnet die Details.' : ''}</p></div></div>
      <div class="grid-3">${people.map(card).join('') || '<section class="card"><p class="empty">Noch niemand freigeschaltet.</p></section>'}</div>
    </div>`;
  }

  /* ---------- Profil ---------- */
  const SKILLS = ['Reels & TikTok', 'Food', 'Interviews', 'Events', 'Kampagnen', 'Imagefilm', 'Musikvideo', 'Untertitel', 'Color Grading', 'Sound', 'Motion Design', 'KI Video'];
  const SOFTWARE = ['DaVinci Resolve', 'Premiere Pro', 'After Effects', 'Final Cut', 'CapCut', 'Higgsfield'];
  const optList = (name, all, sel) => `<div class="opts">${[...new Set([...all, ...sel])].map(s => `<label class="opt"><input type="checkbox" name="${name}" value="${esc(s)}" ${sel.includes(s) ? 'checked' : ''}><span>${esc(s)}</span></label>`).join('')}</div>`;
  function viewProfile() {
    const m = me();
    return `<div class="wrap" style="max-width:760px">
      <div class="head"><div><h1>Profil</h1><p>${esc(m.email)}${m.status === 'pending' ? ', wartet auf Freigabe' : ''}</p></div><div class="acts"><button class="btn ghost" type="button" data-act="logout">${ic('logout')}Abmelden</button></div></div>
      <section class="card"><form class="form" data-form="profile" novalidate>
        <div class="pcard-top">${avatar(m, 'lg')}<div><label class="btn ghost sm" for="avatarFile">Foto wählen</label><input class="vh" id="avatarFile" type="file" accept="image/*" data-change="avatar">${m.avatar ? `<button class="btn ghost sm" type="button" data-act="avatar-del" style="margin-left:6px">Entfernen</button>` : ''}</div></div>
        <div class="f2"><label class="fld"><span>Name</span><input class="in" name="name" required maxlength="80" value="${esc(m.name)}"></label>
        <label class="fld"><span>Schwerpunkt</span><input class="in" name="title" required maxlength="60" value="${esc(m.title || '')}"></label></div>
        <div class="f2"><label class="fld"><span>Telefon <small>(sehen nur Nader und Tommy)</small></span><input class="in" type="tel" name="phone" autocomplete="tel" maxlength="40" value="${esc(m.phone || '')}"></label>
        <label class="fld"><span>Ort</span><input class="in" name="city" maxlength="80" value="${esc(m.city || '')}"></label></div>
        <div class="f2"><label class="fld"><span>Portfolio Link</span><input class="in" type="url" name="portfolio" inputmode="url" value="${esc(m.portfolio || '')}" placeholder="https://"></label>
        <label class="fld"><span>Stunden pro Woche</span><input class="in" name="hours_week" inputmode="numeric" value="${esc(m.hours_week ?? '')}"></label></div>
        <div class="fld"><span>Was du schneidest</span>${optList('skills', SKILLS, m.skills)}</div>
        <div class="fld"><span>Software</span>${optList('software', SOFTWARE, m.software)}</div>
        <label class="fld"><span>Über dich</span><textarea class="in" name="bio" maxlength="800">${esc(m.bio || '')}</textarea></label>
        ${m.rate_cents ? `<p class="sub">Dein Stundensatz: ${esc(euro(m.rate_cents))}. Sehen nur du, Nader und Tommy.</p>` : ''}
        <p class="form-err" role="alert"></p>
        <div class="m-acts"><button class="btn or" type="submit">Speichern</button></div>
      </form></section>
      <section class="card" style="margin-top:16px"><h2>Passwort ändern</h2><form class="form" data-form="password" novalidate autocomplete="on">
        <input type="email" name="username" value="${esc(m.email)}" autocomplete="username" hidden>
        <div class="f2"><label class="fld"><span>Aktuelles Passwort</span><input class="in" type="password" name="old" autocomplete="current-password" required></label>
        <label class="fld"><span>Neues Passwort</span><input class="in" type="password" name="pw" autocomplete="new-password" minlength="10" required></label></div>
        <p class="form-err" role="alert"></p>
        <div class="m-acts"><button class="btn ghost" type="submit">Passwort ändern</button></div>
      </form></section>
      <section class="card" style="margin-top:16px"><h2>Deine Daten</h2><p class="sub">${esc(PRIVACY)}</p></section>
    </div>`;
  }

  /* ---------- Verwaltung ---------- */
  function viewAdmin() {
    const tabs = [['anmeldungen', 'Anmeldungen', pendingUsers().length], ['personen', 'Personen', 0], ['einladungen', 'Einladungen', 0], ['urlaub', 'Urlaub', openRequests().length]];
    if (!S.adminTab) S.adminTab = pendingUsers().length ? 'anmeldungen' : openRequests().length ? 'urlaub' : 'personen';
    const tabBar = `<div class="tabs" role="group" aria-label="Verwaltung">${tabs.map(([k, l, n]) => `<button class="chip" type="button" data-act="admin-tab" data-tab="${k}" aria-pressed="${S.adminTab === k}">${esc(l)}${n ? `<span class="count">${n}</span>` : ''}</button>`).join('')}</div>`;
    let body = '';
    if (S.adminTab === 'anmeldungen') {
      const list = pendingUsers();
      body = list.length ? `<div class="grid-3">${list.map(u => `<article class="pcard"><span class="pcard-top">${avatar(u, 'xl')}<span><h3>${esc(u.name)}</h3><p>${esc(u.title || '')}, ${u.kind === 'mitarbeiter' ? 'Mitarbeiter' : 'Freelancer'}</p></span></span>
        <p>${esc(u.email)}<br>Angemeldet am ${esc(fmtMs(u.created_at))}</p>
        ${u.skills.length ? `<span class="tags">${u.skills.map(s => `<span class="tag">${esc(s)}</span>`).join('')}</span>` : ''}
        ${safeHref(u.portfolio) ? `<a class="lnk" href="${esc(safeHref(u.portfolio))}" target="_blank" rel="noopener noreferrer">Portfolio ansehen</a>` : '<p>Kein Portfolio angegeben.</p>'}
        <div class="acts"><button class="btn or sm" type="button" data-act="user-approve" data-id="${esc(u.id)}">${ic('check')}Freischalten</button><button class="btn ghost sm" type="button" data-act="user-reject" data-id="${esc(u.id)}">Ablehnen</button><button class="btn ghost sm" type="button" data-act="person" data-id="${esc(u.id)}">Details</button></div></article>`).join('')}</div>` : '<section class="card"><p class="empty">Keine offenen Anmeldungen.</p></section>';
    } else if (S.adminTab === 'personen') {
      const STAT = { pending: ['Wartet', 'warn'], active: ['Aktiv', 'ok'], rejected: ['Abgelehnt', 'bad'], disabled: ['Gesperrt', 'bad'] };
      body = `<section class="card"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Person</th><th>Schwerpunkt</th><th>Art</th><th>Satz</th><th>Status</th></tr></thead><tbody>${(S.data.crew || []).map(u => `<tr><td><button class="lnk" type="button" data-act="person" data-id="${esc(u.id)}">${esc(u.name)}</button><br><small class="sub">${esc(u.email)}</small></td><td>${esc(u.title || '')}</td><td>${u.role === 'admin' ? 'Verwaltung' : u.kind === 'mitarbeiter' ? 'Mitarbeiter' : 'Freelancer'}</td><td class="num">${u.rate_cents ? esc(euro(u.rate_cents)) : ''}</td><td><span class="pill ${STAT[u.status][1]}">${esc(STAT[u.status][0])}</span></td></tr>`).join('')}</tbody></table></div></section>`;
    } else if (S.adminTab === 'einladungen') {
      const list = (S.data.invites || []).filter(i => i.type === 'invite');
      const state = i => i.used_at ? ['Benutzt', 'ok'] : i.expires_at < Date.now() ? ['Abgelaufen', 'grey'] : ['Offen', 'info'];
      body = `<section class="card"><div class="card-h"><h2>Einladungslinks</h2><button class="btn sm" type="button" data-act="invite-new">${ic('plus')}Neue Einladung</button></div>
        <p class="sub" style="margin-bottom:12px">Wer über einen Link kommt, ist sofort freigeschaltet. Jeder Link geht einmal und 14 Tage lang. Ohne Link meldet sich jemand unter crew.html an und landet bei den Anmeldungen.</p>
        ${list.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Für</th><th>Art</th><th>Status</th><th>Bis</th><th></th></tr></thead><tbody>${list.map(i => `<tr><td>${esc(i.label || 'Ohne Namen')}</td><td>${i.role === 'admin' ? 'Verwaltung' : i.kind === 'mitarbeiter' ? 'Mitarbeiter' : 'Freelancer'}</td><td><span class="pill ${state(i)[1]}">${esc(state(i)[0])}</span></td><td>${esc(new Date(i.expires_at).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' }))}</td><td><button class="ibtn" type="button" data-act="invite-del" data-id="${esc(i.id)}" aria-label="Löschen">${ic('trash')}</button></td></tr>`).join('')}</tbody></table></div>` : '<p class="empty">Noch keine Einladungen.</p>'}</section>`;
    } else {
      const list = openRequests();
      body = `<section class="card"><h2>Offene Urlaubsanträge</h2>${list.length ? `<div class="rows">${list.map(a => `<div class="row">${avatar(person(a.user_id) || { name: '?' })}<span class="row-main"><b>${esc(personName(a.user_id))}</b><small>${esc(fmtRange(a.start_date, a.end_date))}, ${plural(workdays(a.start_date, a.end_date), 'Arbeitstag', 'Arbeitstage')}${a.note ? `, ${esc(a.note)}` : ''}</small></span><div class="acts"><button class="btn or sm" type="button" data-act="abs-ok" data-id="${esc(a.id)}">Freigeben</button><button class="btn ghost sm" type="button" data-act="abs-no" data-id="${esc(a.id)}">Ablehnen</button></div></div>`).join('')}</div>` : '<p class="empty">Keine offenen Anträge.</p>'}</section>`;
    }
    return `<div class="wrap wide"><div class="head"><div><h1>Verwaltung</h1><p>Nur für Nader und Tommy. Leute freischalten, einladen, Sätze setzen, Urlaub freigeben.</p></div></div>${tabBar}${body}</div>`;
  }
  function openPerson(id) {
    const u = person(id);
    if (!u) return;
    const isMe = u.id === me().id;
    const hoursMonth = monthMinutes(u.id);
    const jobsOpen = S.data.jobs.filter(j => j.assignee_id === u.id && j.status !== 'fertig').length;
    openModal(u.name, `${esc(u.email)}${u.phone ? `, ${esc(u.phone)}` : ''}`, `<form class="form" data-form="person" data-id="${esc(u.id)}" novalidate>
      <div class="meta"><div><small>Stunden im Monat</small><b>${hours(hoursMonth)}</b></div><div><small>Offene Aufträge</small><b>${jobsOpen}</b></div><div><small>Dabei seit</small><b>${esc(new Date(u.created_at).toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' }))}</b></div></div>
      ${u.bio ? `<p class="brief">${esc(u.bio)}</p>` : ''}
      ${safeHref(u.portfolio) ? `<p><a class="lnk" href="${esc(safeHref(u.portfolio))}" target="_blank" rel="noopener noreferrer">Portfolio ansehen</a></p>` : ''}
      ${u.software.length ? `<span class="tags">${u.software.map(s => `<span class="tag">${esc(s)}</span>`).join('')}</span>` : ''}
      <div class="f2"><label class="fld"><span>Schwerpunkt</span><input class="in" name="title" maxlength="60" value="${esc(u.title || '')}"></label>
      <label class="fld"><span>Stundensatz in €</span><input class="in" name="rate" inputmode="decimal" value="${u.rate_cents ? esc(String(u.rate_cents / 100).replace('.', ',')) : ''}"></label></div>
      <div class="f3"><label class="fld"><span>Status</span><select class="in" name="status" ${isMe ? 'disabled' : ''}>${[['pending', 'Wartet'], ['active', 'Aktiv'], ['rejected', 'Abgelehnt'], ['disabled', 'Gesperrt']].map(([k, l]) => `<option value="${k}" ${u.status === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label class="fld"><span>Art</span><select class="in" name="kind">${[['freelancer', 'Freelancer'], ['mitarbeiter', 'Mitarbeiter']].map(([k, l]) => `<option value="${k}" ${u.kind === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label class="fld"><span>Rolle</span><select class="in" name="role" ${isMe ? 'disabled' : ''}>${[['crew', 'Crew'], ['admin', 'Verwaltung']].map(([k, l]) => `<option value="${k}" ${u.role === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>
      <label class="fld"><span>Interne Notiz <small>(sieht die Person nicht)</small></span><textarea class="in" name="admin_note" maxlength="2000" rows="3">${esc(u.admin_note || '')}</textarea></label>
      <div id="resetBox"></div>
      <p class="form-err" role="alert"></p>
      <div class="m-acts">${isMe ? '' : `<button class="btn danger left" type="button" data-act="user-del" data-id="${esc(u.id)}">Löschen</button>`}<button class="btn ghost" type="button" data-act="user-reset" data-id="${esc(u.id)}">Passwort Link</button><button class="btn or" type="submit">Speichern</button></div>
    </form>`);
  }
  function inviteForm() {
    openModal('Neue Einladung', 'Der Link erscheint danach einmal. Schick ihn per WhatsApp oder Mail weiter.', `<form class="form" data-form="invite" novalidate>
      <label class="fld"><span>Für wen?</span><input class="in" name="label" maxlength="80" placeholder="Sara, Cutterin"></label>
      <div class="f2 keep"><label class="fld"><span>Art</span><select class="in" name="kind"><option value="freelancer">Freelancer</option><option value="mitarbeiter">Mitarbeiter</option></select></label>
      <label class="fld"><span>Rolle</span><select class="in" name="role"><option value="crew">Crew</option><option value="admin">Verwaltung</option></select></label></div>
      <p class="form-err" role="alert"></p>
      <div class="m-acts"><button class="btn ghost" type="button" data-act="modal-close">Abbrechen</button><button class="btn or" type="submit">Link erstellen</button></div>
    </form>`);
  }
  const pageUrl = () => location.href.split('?')[0].split('#')[0];
  const linkFor = (param, t) => `${pageUrl()}?${LOCAL ? 'api=local&' : ''}${param}=${t}`;
  function linkBox(url) {
    return `<div class="linkbox"><code>${esc(url)}</code><button class="btn sm" type="button" data-act="copy" data-text="${esc(url)}">${ic('copy')}Kopieren</button></div>`;
  }

  /* ---------- Darstellung ---------- */
  const VIEWS = { start: viewStart, auftraege: viewJobs, zeiten: viewTime, abwesenheit: viewAbsence, rechnungen: viewInvoices, dokumente: viewDocs, crew: viewCrew, profil: viewProfile, verwaltung: viewAdmin };
  const NAMES = { start: 'Start', auftraege: 'Aufträge', zeiten: 'Zeiten', abwesenheit: 'Abwesenheit', rechnungen: 'Rechnungen', dokumente: 'Dokumente', crew: 'Crew', profil: 'Profil', verwaltung: 'Verwaltung' };

  function renderView() {
    const box = $('#railBox');
    if (!box) return renderShell();
    const pending = me().status !== 'active';
    let v = (location.hash || '#start').slice(1);
    if (!VIEWS[v] || (pending && !['start', 'profil'].includes(v)) || (v === 'verwaltung' && !isAdmin())) v = 'start';
    S.view = v;
    box.innerHTML = rail();
    const main = $('#main'), top = main ? main.scrollTop : 0;
    const viewEl = $('#view');
    viewEl.innerHTML = v === 'start' && pending ? viewPending() : VIEWS[v]();
    if (main && S.lastView === v) main.scrollTop = top;
    if (main && S.lastView !== v) { main.scrollTop = 0; window.scrollTo(0, 0); }
    S.lastView = v;
    document.title = `${NAMES[v]} · Social Bites Crew`;
    tick();
  }

  /* ---------- Suche ---------- */
  function search(q) {
    const res = $('#qres');
    if (!res) return;
    const t = q.trim().toLowerCase();
    if (!t || !S.data) { res.hidden = true; return; }
    const has = (...f) => f.some(x => String(x || '').toLowerCase().includes(t));
    const out = [];
    Object.entries(NAMES).forEach(([k, l]) => { if (nav().some(n => n[0] === k) && has(l)) out.push(`<button type="button" data-act="go" data-to="${k}"><span class="tile sm bl">${ic('next')}</span><span>${esc(l)}<small>Bereich</small></span></button>`); });
    S.data.jobs.filter(j => has(j.title, j.client)).slice(0, 8).forEach(j => out.push(`<button type="button" data-act="job" data-id="${esc(j.id)}"><span class="tile sm">${esc(initials(j.client || j.title))}</span><span>${esc(j.title)}<small>${esc(j.client || '')} ${esc(JS[j.status][0])}</small></span></button>`));
    (S.data.crew || []).filter(u => has(u.name, u.title, u.skills.join(' '))).slice(0, 6).forEach(u => out.push(`<button type="button" ${isAdmin() ? `data-act="person" data-id="${esc(u.id)}"` : 'data-act="go" data-to="crew"'}>${avatar(u, 'sm')}<span>${esc(u.name)}<small>${esc(u.title || '')}</small></span></button>`));
    S.data.docs.filter(d => has(d.title, d.category, d.text)).slice(0, 5).forEach(d => out.push(`<button type="button" data-act="go" data-to="dokumente"><span class="tile sm ok">${ic('doc')}</span><span>${esc(d.title)}<small>${esc(d.category)}</small></span></button>`));
    res.innerHTML = out.join('') || '<p>Nichts gefunden.</p>';
    res.hidden = false;
  }
  const clearSearch = () => { const q = $('#q'), r = $('#qres'); if (q) q.value = ''; if (r) r.hidden = true; };

  /* ---------- Klicks ---------- */
  const ACT = {
    'modal-close': closeModal,
    'auth-mode': el => { S.auth = el.dataset.mode; $('.auth-card').innerHTML = authForm(); },
    'auth-forgot': () => { openModal('Passwort vergessen?', null, '<p class="brief">Schreib Nader oder Tommy kurz. Sie schicken dir einen Link, mit dem du ein neues Passwort setzt. Dein altes Passwort kennt niemand, auch sie nicht.</p><div class="m-acts"><button class="btn" type="button" data-act="modal-close">Verstanden</button></div>'); },
    go: el => { clearSearch(); closeModal(); if (location.hash === '#' + el.dataset.to) renderView(); else location.hash = el.dataset.to; },
    job: el => { clearSearch(); openJob(el.dataset.id); },
    logout: async () => {
      if (DEMO) { location.href = 'crew.html'; return; }
      try { await call('POST', '/api/logout'); } catch (e) { /* Token wird trotzdem verworfen */ }
      token.clear(); S.data = null; history.replaceState(null, '', location.pathname + location.search); renderAuth();
    },
    'time-start': () => run(() => call('POST', '/api/time/start', { job_id: S.timerJob || null }), 'Timer läuft.'),
    'time-stop': async () => {
      const r = await run(() => call('POST', '/api/time/stop'));
      if (r && r.minutes !== undefined) toast(`Gestoppt, ${hm(r.minutes)} Std. eingetragen.`);
      if (S.openJob) openJob(S.openJob);
    },
    'time-job': async el => {
      const id = el.dataset.id;
      S.timerJob = id;
      const ok = await run(() => call('POST', '/api/time/start', { job_id: id }), 'Timer läuft.');
      if (ok && S.openJob) openJob(S.openJob);
    },
    'time-new': timeForm,
    'time-del': el => confirmBox('Eintrag löschen?', 'Die Zeit wird aus deinen Stunden entfernt.', 'Löschen', () => run(() => call('DELETE', `/api/time/${encodeURIComponent(el.dataset.id)}`), 'Gelöscht.')),
    'time-user': el => { S.timeUser = el.dataset.id; renderView(); },
    claim: async el => { const id = el.dataset.id; const ok = await run(() => call('POST', `/api/jobs/${encodeURIComponent(id)}/claim`), 'Auftrag gehört jetzt dir.'); if (ok && S.openJob) openJob(id); },
    release: el => { const id = el.dataset.id; confirmBox('Auftrag zurückgeben?', 'Er ist danach wieder für alle offen.', 'Zurückgeben', () => run(() => call('POST', `/api/jobs/${encodeURIComponent(id)}/release`), 'Zurückgegeben.')); },
    'job-new': () => jobForm(null),
    'job-edit': el => jobForm(jobById(el.dataset.id)),
    'job-del': el => { const id = el.dataset.id; confirmBox('Auftrag löschen?', 'Der Auftrag und sein Verlauf sind danach weg. Das lässt sich nicht rückgängig machen.', 'Löschen', () => run(() => call('DELETE', `/api/jobs/${encodeURIComponent(id)}`), 'Gelöscht.')); },
    'abs-new': absenceForm,
    'abs-del': el => { const id = el.dataset.id; confirmBox('Eintrag löschen?', 'Die Abwesenheit wird entfernt.', 'Löschen', () => run(() => call('DELETE', `/api/absences/${encodeURIComponent(id)}`), 'Gelöscht.')); },
    'abs-ok': el => run(() => call('PATCH', `/api/absences/${encodeURIComponent(el.dataset.id)}`, { status: 'ok' }), 'Freigegeben.'),
    'abs-no': el => run(() => call('PATCH', `/api/absences/${encodeURIComponent(el.dataset.id)}`, { status: 'abgelehnt' }), 'Abgelehnt.'),
    cal: el => { const [y, m] = (S.calMonth || monthKey()).split('-').map(Number); S.calMonth = monthKey(new Date(y, m - 1 + Number(el.dataset.d), 1)); renderView(); },
    'inv-new': invoiceForm,
    'inv-del': el => { const id = el.dataset.id; confirmBox('Rechnung löschen?', 'Die Rechnung wird aus der Liste entfernt.', 'Löschen', () => run(() => call('DELETE', `/api/invoices/${encodeURIComponent(id)}`), 'Gelöscht.')); },
    'doc-new': () => docForm(null),
    'doc-edit': el => docForm(S.data.docs.find(d => d.id === el.dataset.id)),
    'doc-del': el => { const id = el.dataset.id; confirmBox('Dokument löschen?', 'Es verschwindet für die ganze Crew.', 'Löschen', () => run(() => call('DELETE', `/api/docs/${encodeURIComponent(id)}`), 'Gelöscht.')); },
    person: el => { clearSearch(); openPerson(el.dataset.id); },
    'user-approve': el => run(() => call('PATCH', `/api/users/${encodeURIComponent(el.dataset.id)}`, { status: 'active' }), 'Freigeschaltet.'),
    'user-reject': el => { const id = el.dataset.id; confirmBox('Anmeldung ablehnen?', 'Die Person kann sich danach nicht mehr einloggen.', 'Ablehnen', () => run(() => call('PATCH', `/api/users/${encodeURIComponent(id)}`, { status: 'rejected' }), 'Abgelehnt.')); },
    'user-del': el => { const id = el.dataset.id; confirmBox('Person endgültig löschen?', 'Konto, Zeiten, Abwesenheiten und Rechnungseinträge sind danach weg, laufende Aufträge werden wieder offen. Rechnungen vorher sichern, falls du sie für die Buchhaltung brauchst.', 'Endgültig löschen', () => run(() => call('DELETE', `/api/users/${encodeURIComponent(id)}`), 'Gelöscht.')); },
    'user-reset': async el => {
      try {
        const r = await call('POST', `/api/users/${encodeURIComponent(el.dataset.id)}/reset`);
        const box = $('#resetBox');
        if (box) box.innerHTML = `<div class="fld"><span>Passwort Link, 3 Tage gültig, einmal nutzbar</span>${linkBox(linkFor('reset', r.token))}</div>`;
      } catch (e) { toast(e.message, true); }
    },
    'admin-tab': el => { S.adminTab = el.dataset.tab; renderView(); },
    'invite-new': inviteForm,
    'invite-del': el => run(() => call('DELETE', `/api/invites/${encodeURIComponent(el.dataset.id)}`), 'Gelöscht.'),
    copy: async el => {
      try { await navigator.clipboard.writeText(el.dataset.text); toast('Link kopiert.'); } catch (e) { toast('Bitte den Link von Hand kopieren.', true); }
    },
    'avatar-del': () => run(() => call('PATCH', '/api/me', { avatar: null }), 'Foto entfernt.'),
  };

  /* ---------- Formulare ---------- */
  const FORM = {
    login: (f, d) => sending(f, async () => {
      const email = String(d.get('email') || '').trim();
      if (!email || !d.get('pw')) throw new Error('Bitte E-Mail und Passwort eintragen.');
      const r = await call('POST', '/api/login', { email, pw: await deriveKey(email, String(d.get('pw'))) });
      token.set(r.token);
      await start();
    }),
    register: (f, d) => sending(f, async () => {
      const email = String(d.get('email') || '').trim(), pw = String(d.get('pw') || '');
      if (!String(d.get('name') || '').trim()) throw new Error('Bitte deinen Namen eintragen.');
      if (!email) throw new Error('Bitte deine E-Mail eintragen.');
      if (pw.length < 10) throw new Error('Das Passwort braucht mindestens 10 Zeichen.');
      if (!d.get('consent')) throw new Error('Bitte stimme dem Datenschutzhinweis zu.');
      const r = await call('POST', '/api/register', {
        email, name: d.get('name'), kind: d.get('kind') || undefined, title: d.get('title'), portfolio: d.get('portfolio') || null,
        pw: await deriveKey(email, pw), consent: true, website: d.get('website') || '', invite: S.invite || undefined,
      });
      token.set(r.token);
      S.invite = null; S.inviteInfo = null;
      cleanUrl();
      await start();
    }),
    reset: (f, d) => sending(f, async () => {
      const pw = String(d.get('pw') || '');
      if (pw.length < 10) throw new Error('Das Passwort braucht mindestens 10 Zeichen.');
      const r = await call('POST', '/api/reset', { token: S.reset.token, pw: await deriveKey(S.reset.info.email, pw) });
      token.set(r.token);
      S.reset = null;
      cleanUrl();
      await start();
      toast('Neues Passwort gespeichert.');
    }),
    job: (f, d) => sending(f, async () => {
      const pay = parseEuro(d.get('pay'));
      if (Number.isNaN(pay)) throw new Error('Honorar: bitte eine Zahl eintragen.');
      const hrs = String(d.get('hours_est') || '').trim().replace(',', '.');
      if (hrs && !Number.isFinite(Number(hrs))) throw new Error('Aufwand: bitte eine Zahl eintragen.');
      const body = {
        title: d.get('title'), client: d.get('client'), deadline: d.get('deadline') || null, format: d.get('format'), length: d.get('length'),
        hours_est: hrs ? Number(hrs) : null, pay_cents: pay, assignee_id: d.get('assignee_id') || null, raw_url: d.get('raw_url'), ref_url: d.get('ref_url'), brief: d.get('brief'),
      };
      const id = f.dataset.id;
      if (id) await call('PATCH', `/api/jobs/${encodeURIComponent(id)}`, body); else await call('POST', '/api/jobs', body);
      closeModal(); await refresh(); toast(id ? 'Gespeichert.' : 'Auftrag angelegt.');
    }),
    'job-event': (f, d, e) => sending(f, async () => {
      const kind = (e.submitter && e.submitter.value) || 'kommentar', id = f.dataset.id;
      await call('POST', `/api/jobs/${encodeURIComponent(id)}/events`, { kind, text: d.get('text') || null, url: d.get('url') || null });
      await refresh();
      toast({ kommentar: 'Kommentar gespeichert.', abgabe: 'Version abgegeben.', feedback: 'Feedback gesendet.', freigabe: 'Freigegeben.' }[kind]);
      await openJob(id);
    }),
    time: (f, d) => sending(f, async () => {
      const minutes = parseDuration(d.get('duration'));
      if (!minutes || Number.isNaN(minutes)) throw new Error('Dauer: zum Beispiel 1:30 oder 1,5.');
      await call('POST', '/api/time', { date: d.get('date'), minutes, job_id: d.get('job_id') || null, note: d.get('note') || null });
      closeModal(); await refresh(); toast('Eingetragen.');
    }),
    absence: (f, d) => sending(f, async () => {
      await call('POST', '/api/absences', { type: d.get('type'), start_date: d.get('start_date'), end_date: d.get('end_date'), note: d.get('note') || null });
      closeModal(); await refresh(); toast(d.get('type') === 'urlaub' ? 'Beantragt.' : 'Eingetragen.');
    }),
    invoice: (f, d) => sending(f, async () => {
      const amount = parseEuro(d.get('amount'));
      if (!amount) throw new Error('Betrag: bitte eine Zahl eintragen.');
      await call('POST', '/api/invoices', { number: d.get('number'), period: d.get('period'), amount_cents: amount, url: d.get('url') || null, note: d.get('note') || null });
      closeModal(); await refresh(); toast('Rechnung eingereicht.');
    }),
    doc: (f, d) => sending(f, async () => {
      const body = { title: d.get('title'), category: d.get('category'), url: d.get('url') || null, text: d.get('text') || null, sort: Number(d.get('sort')) || 100 };
      const id = f.dataset.id;
      if (id) await call('PATCH', `/api/docs/${encodeURIComponent(id)}`, body); else await call('POST', '/api/docs', body);
      closeModal(); await refresh(); toast('Gespeichert.');
    }),
    profile: (f, d) => sending(f, async () => {
      const hw = String(d.get('hours_week') || '').trim();
      await call('PATCH', '/api/me', {
        name: d.get('name'), title: d.get('title'), phone: d.get('phone'), city: d.get('city'), portfolio: d.get('portfolio'), bio: d.get('bio'),
        hours_week: hw === '' ? null : hw, skills: d.getAll('skills'), software: d.getAll('software'),
      });
      await refresh(); toast('Profil gespeichert.');
    }),
    password: (f, d) => sending(f, async () => {
      const pw = String(d.get('pw') || ''), email = me().email;
      if (pw.length < 10) throw new Error('Das neue Passwort braucht mindestens 10 Zeichen.');
      await call('POST', '/api/me/password', { old: await deriveKey(email, String(d.get('old') || '')), pw: await deriveKey(email, pw) });
      f.reset(); toast('Passwort geändert.');
    }),
    person: (f, d) => sending(f, async () => {
      const rate = parseEuro(d.get('rate'));
      if (Number.isNaN(rate)) throw new Error('Stundensatz: bitte eine Zahl eintragen.');
      const body = { title: d.get('title'), rate_cents: rate, kind: d.get('kind'), admin_note: d.get('admin_note') };
      if (d.get('status')) body.status = d.get('status');
      if (d.get('role')) body.role = d.get('role');
      await call('PATCH', `/api/users/${encodeURIComponent(f.dataset.id)}`, body);
      closeModal(); await refresh(); toast('Gespeichert.');
    }),
    invite: (f, d) => sending(f, async () => {
      const r = await call('POST', '/api/invites', { label: d.get('label') || null, kind: d.get('kind'), role: d.get('role') });
      await refresh();
      const url = DEMO ? 'In der Demo gibt es keinen echten Link.' : linkFor('invite', r.token);
      openModal('Link ist fertig', 'Einmal nutzbar, 14 Tage gültig. Er erscheint nur jetzt.', `${linkBox(url)}<div class="m-acts" style="margin-top:14px"><button class="btn" type="button" data-act="modal-close">Fertig</button></div>`);
    }),
  };

  /* ---------- Auswahlfelder ---------- */
  const CHANGE = {
    timerJob: el => { S.timerJob = el.value; },
    jobPerson: el => { S.jobPerson = el.value; renderView(); },
    timeUser: el => { S.timeUser = el.value; renderView(); },
    timeMonth: el => { S.timeMonth = el.value; renderView(); },
    invoiceStatus: el => run(() => call('PATCH', `/api/invoices/${encodeURIComponent(el.dataset.id)}`, { status: el.value }), 'Status gespeichert.'),
    avatar: async el => {
      const file = el.files && el.files[0];
      if (!file) return;
      try {
        const data = await resizeImage(file);
        await run(() => call('PATCH', '/api/me', { avatar: data }), 'Foto gespeichert.');
      } catch (e) { toast('Dieses Bild geht leider nicht.', true); }
    },
  };
  function resizeImage(file) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onerror = rej;
      r.onload = () => {
        const img = new Image();
        img.onerror = rej;
        img.onload = () => {
          const size = 192, c = document.createElement('canvas');
          c.width = c.height = size;
          const s = Math.min(img.width, img.height);
          c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
          let url = c.toDataURL('image/webp', 0.82);
          if (!url.startsWith('data:image/webp')) url = c.toDataURL('image/jpeg', 0.82);
          res(url);
        };
        img.src = r.result;
      };
      r.readAsDataURL(file);
    });
  }

  document.addEventListener('click', e => {
    const a = e.target.closest('[data-act]');
    if (a) { const fn = ACT[a.dataset.act]; if (fn) { e.preventDefault(); fn(a, e); } return; }
    if (!e.target.closest('.search')) { const r = $('#qres'); if (r) r.hidden = true; }
  });
  document.addEventListener('submit', e => {
    const f = e.target.closest('form[data-form]');
    if (!f) return;
    e.preventDefault();
    const fn = FORM[f.dataset.form];
    if (fn) fn(f, new FormData(f), e);
  });
  document.addEventListener('change', e => {
    const el = e.target.closest('[data-change]');
    if (el && CHANGE[el.dataset.change]) CHANGE[el.dataset.change](el);
  });
  document.addEventListener('input', e => { if (e.target.id === 'q') search(e.target.value); });
  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { const q = $('#q'); if (q) { e.preventDefault(); q.focus(); } }
    if (e.key === 'Escape' && e.target.id === 'q') clearSearch();
  });
  window.addEventListener('hashchange', () => { if (S.data) { closeModal(); clearSearch(); renderView(); } });

  /* ---------- Start und Aktualisierung ---------- */
  function cleanUrl() {
    const u = new URL(location.href);
    u.searchParams.delete('invite'); u.searchParams.delete('reset');
    history.replaceState(null, '', u.pathname + u.search + u.hash);
  }
  async function start() {
    await load();
    renderShell();
  }
  async function poll() {
    if (!S.data || DEMO || document.hidden || modal.open) return;
    const a = document.activeElement;
    if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return;
    const was = S.data.me.status;
    const before = JSON.stringify(S.data, (k, v) => (k === 'now' ? 0 : v));
    try { await load(); } catch (e) { return; }
    if (JSON.stringify(S.data, (k, v) => (k === 'now' ? 0 : v)) === before) return;
    if (S.view !== 'profil' || was !== S.data.me.status) renderView();
    if (was === 'pending' && S.data.me.status === 'active') toast('Du bist freigeschaltet. Willkommen in der Crew.');
  }

  async function boot() {
    setInterval(tick, 1000);
    setInterval(() => { if (S.data && S.data.me.status === 'pending') poll(); }, 30000);
    setInterval(poll, 90000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); });

    if (DEMO) {
      window.CrewDemo.init(DEMO);
      await start();
      return;
    }
    const inv = qs.get('invite'), rst = qs.get('reset');
    try {
      if (rst) {
        const info = await call('GET', `/api/invite/${encodeURIComponent(rst)}`);
        if (info.type === 'reset') S.reset = { token: rst, info };
      } else if (inv) {
        const info = await call('GET', `/api/invite/${encodeURIComponent(inv)}`);
        if (info.type === 'invite') { S.invite = inv; S.inviteInfo = info; S.auth = 'register'; }
      }
    } catch (e) {
      cleanUrl();  // Link ungültig oder abgelaufen: Hinweis zeigen, wer eingeloggt ist, bleibt es
      toast(e.message, true);
    }
    if (S.reset || S.invite) { token.clear(); renderAuth(); return; }
    if (token.get()) {
      try { await start(); return; } catch (e) { if (token.get()) { root.innerHTML = `<div class="boot"><div style="text-align:center"><p>${esc(e.message)}</p><p style="margin-top:12px"><button class="btn" type="button" data-act="reload">Noch einmal</button></p></div></div>`; ACT.reload = () => location.reload(); return; } }
    }
    renderAuth();
  }
  boot();
})();
