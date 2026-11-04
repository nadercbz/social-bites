/* Demo des Crew Dashboards: crew.html?demo=1 (Crew Sicht) und crew.html?demo=admin (Verwaltung).
   Alles Beispieldaten, läuft nur im Browser, nichts geht an den Server. Figuren aus dem Büro, Kunden erfunden. */
(function () {
  'use strict';
  const pad = n => String(n).padStart(2, '0');
  const day = n => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const ago = (days, hour = 10) => { const d = new Date(); d.setDate(d.getDate() - days); d.setHours(hour, 0, 0, 0); return d.getTime(); };
  let seq = 100;
  const id = p => p + (++seq);

  const person = (o) => Object.assign({ role: 'crew', status: 'active', kind: 'freelancer', phone: null, city: 'Berlin', portfolio: null, bio: null, skills: [], software: [], hours_week: null, rate_cents: null, admin_note: null, created_at: ago(40), last_seen: ago(1) }, o);
  const people = [
    person({ id: 'kai', email: 'kai@beispiel.example', name: 'Kai Brandt', title: 'Reel Cutter', avatar: 'buero/ag_kai.webp', skills: ['Reels & TikTok', 'Food', 'Untertitel'], software: ['DaVinci Resolve', 'CapCut'], rate_cents: 4500, hours_week: 25, bio: 'Schneidet schnell und auf den Beat.' }),
    person({ id: 'jamal', email: 'jamal@beispiel.example', name: 'Jamal Osei', title: 'Event Cutter', avatar: 'buero/ag_jamal.webp', skills: ['Events', 'Musikvideo'], software: ['Premiere Pro'], rate_cents: 4000 }),
    person({ id: 'valentina', email: 'valentina@beispiel.example', name: 'Valentina Rossi', title: 'Kampagnen Cutter', kind: 'mitarbeiter', avatar: 'buero/ag_valentina.webp', skills: ['Kampagnen', 'Imagefilm', 'Color Grading'], software: ['DaVinci Resolve', 'After Effects'], city: 'Hamburg', rate_cents: 5500 }),
    person({ id: 'chef', email: 'team@beispiel.example', name: 'Nader', title: 'Co Founder', role: 'admin', kind: 'mitarbeiter', avatar: null }),
    person({ id: 'neu1', email: 'lina@beispiel.example', name: 'Lina Weiss', title: 'Cutter', status: 'pending', portfolio: 'https://example.org/lina', created_at: ago(0, 9), skills: ['Reels & TikTok'], software: ['CapCut'] }),
    person({ id: 'neu2', email: 'tarek@beispiel.example', name: 'Tarek Aziz', title: 'Motion Design', status: 'pending', portfolio: 'https://example.org/tarek', created_at: ago(1, 18) }),
  ];

  const job = o => Object.assign({ format: '9:16', length: '30 s', brief: null, raw_url: 'https://example.org/rohmaterial', ref_url: null, priority: 0, hours_est: 4, pay_cents: null, version: 0, delivery_url: null, created_at: ago(3), updated_at: ago(1) }, o);
  const jobs = [
    job({ id: 'j1', title: 'Pizza Reel Oktoberaktion', client: 'Teig & Tomate', deadline: day(0), status: 'feedback', assignee_id: 'kai', version: 1, delivery_url: 'https://example.org/v1', pay_cents: 18000, brief: 'Hook in den ersten 2 Sekunden: Käse zieht sich beim Anheben. Danach nur Action, kurze Schnitte im Beat. Untertitel in Weiß. Endkarte mit Adresse.' }),
    job({ id: 'j2', title: 'Opening Recap Sonnenallee', client: 'Kiez Kebab', deadline: day(2), status: 'in_arbeit', assignee_id: 'kai', length: '45 s', hours_est: 6, pay_cents: 24000, brief: 'Schlange vor dem Laden, Grill, Reaktionen der Gäste. Musik unter stummen Szenen, runter wenn Leute reden.' }),
    job({ id: 'j3', title: 'Bowl Story Serie, 3 Teile', client: 'Mochi Mama', deadline: day(5), status: 'zugewiesen', assignee_id: 'kai', length: '3 x 15 s', pay_cents: 30000, brief: 'Drei kurze Clips aus dem Dreh vom Dienstag. Jeweils ein Produkt.' }),
    job({ id: 'j4', title: 'Interview Inhaberin, Cutdown', client: 'Salon Mira', deadline: day(4), status: 'offen', assignee_id: null, format: '16:9', length: '90 s', hours_est: 5, pay_cents: 22000, brief: 'Feste Rahmung, keine Zooms. Sätze ausreden lassen.' }),
    job({ id: 'j5', title: 'Burger Montage, Hochkant', client: 'Teig & Tomate', deadline: day(7), status: 'offen', assignee_id: null, hours_est: 3, pay_cents: 12000 }),
    job({ id: 'j6', title: 'Event Aftermovie Herbst', client: 'Kiez Kebab', deadline: day(1), status: 'review', assignee_id: 'jamal', format: '16:9', length: '60 s', version: 2, delivery_url: 'https://example.org/v2', pay_cents: 40000 }),
    job({ id: 'j7', title: 'Imagefilm Cutdowns', client: 'Salon Mira', deadline: day(9), status: 'in_arbeit', assignee_id: 'valentina', format: 'Mehrere', length: '15 und 30 s' }),
    job({ id: 'j8', title: 'Weihnachtsteaser', client: 'Mochi Mama', deadline: day(-6), status: 'fertig', assignee_id: 'kai', version: 2, delivery_url: 'https://example.org/v2', pay_cents: 15000 }),
  ];
  const events = {
    j1: [
      { kind: 'abgabe', text: 'Erste Version, Musik ist noch Platzhalter.', url: 'https://example.org/v1', version: 1, user_id: 'kai', created_at: ago(1, 16) },
      { kind: 'feedback', text: 'Sehr gut. Hook bitte eine Sekunde kürzer, und am Ende den Satz ausreden lassen.', version: 1, user_id: 'chef', created_at: ago(0, 9) },
    ],
  };

  const te = (uid, daysAgo, minutes, jobId, note) => { const s = ago(daysAgo, 9); return { id: id('t'), user_id: uid, job_id: jobId, started_at: s, ended_at: s + minutes * 6e4, minutes, note: note || null, created_at: s }; };
  const time = [te('kai', 0, 95, 'j2', 'Rohschnitt'), te('kai', 1, 230, 'j1', 'Schnitt und Untertitel'), te('kai', 2, 180, 'j2'), te('kai', 3, 260, 'j1'), te('kai', 6, 150, 'j8', 'Finale Version'), te('kai', 9, 300, 'j8'), te('jamal', 1, 280, 'j6'), te('jamal', 2, 340, 'j6'), te('valentina', 0, 200, 'j7'), te('valentina', 1, 420, 'j7')];

  const abs = (uid, type, s, e, status) => ({ id: id('a'), user_id: uid, type, start_date: day(s), end_date: day(e), note: null, status, created_at: ago(4) });
  const absences = [abs('kai', 'urlaub', 18, 22, 'ok'), abs('kai', 'krank', -20, -19, 'ok'), abs('kai', 'frei', 9, 9, 'ok'), abs('valentina', 'urlaub', 11, 15, 'beantragt'), abs('jamal', 'frei', 0, 1, 'ok')];

  const inv = (uid, number, period, cents, status) => ({ id: id('i'), user_id: uid, number, period, amount_cents: cents, url: 'https://example.org/rechnung.pdf', note: null, status, created_at: ago(5), updated_at: ago(2) });
  const nowD = new Date();
  const per = m => { const d = new Date(nowD.getFullYear(), nowD.getMonth() - m, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
  const invoices = [inv('kai', 'KB-2026-014', per(1), 96000, 'bezahlt'), inv('kai', 'KB-2026-015', per(0), 42000, 'eingereicht'), inv('jamal', 'JO-77', per(1), 64000, 'geprueft')];

  const docs = [
    { id: 'seed-leitfaden', title: 'So schneiden wir', category: 'Schnitt', url: null, sort: 1, text: 'Sätze immer zu Ende sprechen lassen. Kein Schnitt im letzten Wort.\nRegie Rufe wie "Action" und Zwischenrufe ohne Bezug zum Inhalt raus, auch wenn sie leise sind.\nBei Food Montagen nur Momente, in denen etwas passiert: Schnitt durchs Brot, Flammen, Wenden, Streuen. Kein Warten, kurze Schnitte im Beat.\nEchte Reaktionen und Necken drin lassen. Musik runter, wenn Feedback kommt, damit man die Leute klar hört.\nInterviews und Talking Heads: feste Rahmung, keine Zooms und keine Punch ins, außer der Auftrag verlangt es.\nAds mit Text: mindestens 15 Sekunden. Hook 3 s, Szenen 4 bis 4,5 s, Endkarte 3 bis 3,5 s. Untertitel mindestens 7 s sichtbar.' },
    { id: 'seed-abgabe', title: 'Abgabe Standard', category: 'Schnitt', url: null, sort: 2, text: 'Format und Länge stehen im Auftrag. Standard ist hochkant 9:16 mit 1080 x 1920.\nDateiname: Kunde_Titel_V1. Jede neue Version bekommt die nächste Nummer.\nAbgabe als Link (Drive, Dropbox, Frame.io) direkt im Auftrag eintragen, nicht per WhatsApp.\nRohmaterial bleibt beim Kunden Projekt. Nichts öffentlich teilen, bevor der Auftrag freigegeben ist.' },
    { id: 'seed-brandbook', title: 'Brand Book', category: 'Marke', url: 'brandbook.html', sort: 3, text: 'Farben, Schriften, Logos und Haltung von Social Bites.' },
  ];
  const invites = [{ id: 'inv1', type: 'invite', role: 'crew', kind: 'freelancer', label: 'Sara, Cutterin', created_at: ago(2), expires_at: ago(-12), used_at: null }];

  const fail = (msg) => { throw new Error(msg); };
  let me = 'kai', isAdmin = false;
  const get = uid => people.find(p => p.id === uid);
  const nowMs = () => Date.now();

  function bootstrap() {
    const u = get(me);
    const today = day(0);
    const away = absences.filter(a => a.status === 'ok' && a.start_date <= today && a.end_date >= today).map(a => ({ user_id: a.user_id, until: a.end_date }));
    if (isAdmin) return { me: u, now: nowMs(), jobs: jobs.slice(), time: time.slice(), absences: absences.slice(), team_away: away, invoices: invoices.slice(), docs: docs.slice(), crew: people.slice(), invites: invites.slice() };
    return {
      me: u, now: nowMs(),
      jobs: jobs.filter(j => j.assignee_id === me || (j.status === 'offen' && !j.assignee_id)),
      time: time.filter(t => t.user_id === me),
      absences: absences.filter(a => a.user_id === me),
      team_away: away,
      invoices: invoices.filter(i => i.user_id === me),
      docs: docs.slice(),
      crew: people.filter(p => p.status === 'active').map(({ email, phone, rate_cents, admin_note, ...r }) => r),
    };
  }
  const addEvent = (jid, kind, text, url, version) => { (events[jid] = events[jid] || []).push({ kind, text: text || null, url: url || null, version: version ?? null, user_id: me, created_at: nowMs() }); };
  const findJob = jid => jobs.find(j => j.id === jid) || fail('Diesen Auftrag gibt es nicht.');

  function call(method, path, body) {
    body = body || {};
    const m = path.match(/^\/api\/([a-z]+)(?:\/([\w-]+))?(?:\/([a-z]+))?$/);
    const [, res, rid, sub] = m || [];
    const key = `${method} ${res}${sub ? '/' + sub : (rid ? '/:id' : '')}`;
    switch (key) {
      case 'GET bootstrap': return bootstrap();
      case 'POST logout': return { ok: true };
      case 'PATCH me': Object.assign(get(me), body); return { ok: true };
      case 'POST me/:id': return { ok: true };
      case 'POST jobs': { const j = job(Object.assign({ id: id('j'), status: body.assignee_id ? 'zugewiesen' : 'offen', assignee_id: body.assignee_id || null, created_at: nowMs(), updated_at: nowMs(), raw_url: null }, body)); jobs.unshift(j); return { id: j.id }; }
      case 'PATCH jobs/:id': { const j = findJob(rid); Object.assign(j, body, { updated_at: nowMs() }); if ('assignee_id' in body) { if (!body.assignee_id) { j.assignee_id = null; j.status = 'offen'; } else if (j.status === 'offen') j.status = 'zugewiesen'; } return { ok: true }; }
      case 'DELETE jobs/:id': jobs.splice(jobs.findIndex(j => j.id === rid), 1); return { ok: true };
      case 'POST jobs/claim': { const j = findJob(rid); j.assignee_id = me; j.status = 'zugewiesen'; addEvent(rid, 'status', 'hat den Auftrag angenommen'); return { ok: true }; }
      case 'POST jobs/release': { const j = findJob(rid); j.assignee_id = null; j.status = 'offen'; addEvent(rid, 'status', 'hat den Auftrag zurückgegeben'); return { ok: true }; }
      case 'POST jobs/start': { const j = findJob(rid); if (j.status === 'zugewiesen') { j.status = 'in_arbeit'; addEvent(rid, 'status', 'hat angefangen'); } return { ok: true }; }
      case 'GET jobs/events': return { events: (events[rid] || []).map(e => Object.assign({ user_name: (get(e.user_id) || {}).name || 'Ehemalige Person' }, e)) };
      case 'POST jobs/events': {
        const j = findJob(rid);
        if (body.kind === 'kommentar') { if (!body.text) fail('Bitte einen Text eintragen.'); addEvent(rid, 'kommentar', body.text); }
        else if (body.kind === 'abgabe') { if (!/^https?:\/\//.test(body.url || '')) fail('Bitte den Link zur Abgabe eintragen, mit https://.'); j.version += 1; j.delivery_url = body.url; j.status = 'review'; addEvent(rid, 'abgabe', body.text, body.url, j.version); }
        else if (body.kind === 'feedback') { if (!body.text) fail('Bitte das Feedback eintragen.'); j.status = 'feedback'; addEvent(rid, 'feedback', body.text, null, j.version); }
        else if (body.kind === 'freigabe') { j.status = 'fertig'; addEvent(rid, 'freigabe', body.text, null, j.version); }
        j.updated_at = nowMs();
        return { ok: true };
      }
      case 'POST time': { const s = new Date(body.date + 'T09:00:00').getTime(); time.unshift({ id: id('t'), user_id: me, job_id: body.job_id || null, started_at: s, ended_at: s + body.minutes * 6e4, minutes: body.minutes, note: body.note || null, created_at: nowMs() }); return { ok: true }; }
      case 'DELETE time/:id': time.splice(time.findIndex(t => t.id === rid), 1); return { ok: true };
      case 'POST absences': if (body.end_date < body.start_date) fail('Bis liegt vor Von.'); absences.push({ id: id('a'), user_id: me, type: body.type, start_date: body.start_date, end_date: body.end_date, note: body.note || null, status: body.type === 'urlaub' ? 'beantragt' : 'ok', created_at: nowMs() }); return { ok: true };
      case 'PATCH absences/:id': absences.find(a => a.id === rid).status = body.status; return { ok: true };
      case 'DELETE absences/:id': absences.splice(absences.findIndex(a => a.id === rid), 1); return { ok: true };
      case 'POST invoices': invoices.unshift({ id: id('i'), user_id: me, number: body.number, period: body.period, amount_cents: body.amount_cents, url: body.url || null, note: body.note || null, status: 'eingereicht', created_at: nowMs(), updated_at: nowMs() }); return { ok: true };
      case 'PATCH invoices/:id': invoices.find(i => i.id === rid).status = body.status; return { ok: true };
      case 'DELETE invoices/:id': invoices.splice(invoices.findIndex(i => i.id === rid), 1); return { ok: true };
      case 'POST docs': docs.push(Object.assign({ id: id('d'), sort: 100 }, body)); return { ok: true };
      case 'PATCH docs/:id': Object.assign(docs.find(d => d.id === rid), body); return { ok: true };
      case 'DELETE docs/:id': docs.splice(docs.findIndex(d => d.id === rid), 1); return { ok: true };
      case 'PATCH users/:id': Object.assign(get(rid), body); return { ok: true };
      case 'DELETE users/:id': people.splice(people.findIndex(p => p.id === rid), 1); return { ok: true };
      case 'POST users/reset': return { token: 'demo' };
      case 'POST invites': { const i = { id: id('v'), type: 'invite', role: body.role, kind: body.kind, label: body.label, created_at: nowMs(), expires_at: nowMs() + 14 * 864e5, used_at: null }; invites.unshift(i); return { id: i.id, token: 'demo' }; }
      case 'DELETE invites/:id': invites.splice(invites.findIndex(i => i.id === rid), 1); return { ok: true };
    }
    if (path === '/api/time/start') {
      if (time.some(t => t.user_id === me && !t.ended_at)) fail('Dein Timer läuft schon.');
      if (body.job_id) { const j = findJob(body.job_id); if (j.status === 'zugewiesen') j.status = 'in_arbeit'; }
      time.unshift({ id: id('t'), user_id: me, job_id: body.job_id || null, started_at: nowMs(), ended_at: null, minutes: null, note: null, created_at: nowMs() });
      return { ok: true };
    }
    if (path === '/api/time/stop') {
      const r = time.find(t => t.user_id === me && !t.ended_at) || fail('Es läuft gerade kein Timer.');
      r.minutes = Math.max(1, Math.round((nowMs() - r.started_at) / 6e4)); r.ended_at = r.started_at + r.minutes * 6e4;
      return { minutes: r.minutes };
    }
    return fail('Das geht in der Demo nicht.');
  }

  window.CrewDemo = {
    init(mode) { isAdmin = mode === 'admin'; me = isAdmin ? 'chef' : 'kai'; },
    call(method, path, body) { return new Promise((res, rej) => { try { res(JSON.parse(JSON.stringify(call(method, path, body)))); } catch (e) { rej(e); } }); },
  };
})();
