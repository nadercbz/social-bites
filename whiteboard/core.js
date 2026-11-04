/* Social Bites Whiteboard: Zustand, API, Speichern, Rückgängig, Live Verbindung.
   Jede Änderung ist eine kleine Operation (add, set, del, undel, board), lokal sofort sichtbar und im Hintergrund gespeichert. */
(function () {
  'use strict';
  const params = new URLSearchParams(location.search);
  const LOCAL = params.get('api') === 'local';
  const API = LOCAL ? 'http://127.0.0.1:8203' : 'https://social-bites-board.bitey-cloud.workers.dev';
  const TOKEN_KEY = LOCAL ? 'sb-wb-token-local' : 'sb-wb-token';

  const rid = () => Array.from(crypto.getRandomValues(new Uint8Array(9)), b => b.toString(16).padStart(2, '0')).join('');
  const $ = s => document.querySelector(s);

  const S = {
    me: null, peerId: rid(), board: null, crumbs: [], cards: new Map(), dead: new Map(), els: new Map(), counts: {}, trash: 0, rev: 0,
    sel: new Set(), view: { x: 0, y: 0, z: 1 }, editing: null, editField: null, editBefore: null, tool: null, drag: null,
    undo: [], redo: [], peers: new Map(), follow: null, fresh: new Map(), hand: false,
  };
  const WB = window.WB = { S, API, LOCAL, rid, $ };

  /* ---------- Helfer ---------- */
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  WB.esc = s => String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, c => ESC[c]);
  WB.safeHref = v => {
    try {
      const u = new URL(String(v || ''), 'https://x.invalid');
      if ((u.protocol === 'https:' || u.protocol === 'http:' || u.protocol === 'mailto:') && u.hostname !== 'x.invalid') return u.toString();
    } catch (_) { /* ungültig */ }
    return null;
  };
  // Bilder: eigene Dateien und https, lokal auch die Test API. Nie javascript oder data aus fremden Karten.
  WB.safeSrc = v => {
    const s = String(v || '');
    if (s.startsWith('blob:')) return s;
    try {
      const u = new URL(s);
      if (u.protocol === 'https:' || (LOCAL && u.origin === API)) return u.toString();
    } catch (_) { /* ungültig */ }
    return '';
  };
  const ALLOWED = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'DEL', 'H1', 'H2', 'H3', 'P', 'DIV', 'BR', 'UL', 'OL', 'LI', 'A', 'MARK', 'CODE', 'BLOCKQUOTE', 'SPAN']);
  const DROP = /^(SCRIPT|STYLE|IFRAME|OBJECT|EMBED|SVG|MATH|NOSCRIPT|TEMPLATE|LINK|META|TITLE|HEAD)$/;
  WB.clean = function (html) {
    const doc = new DOMParser().parseFromString(`<body>${String(html || '')}</body>`, 'text/html');
    const walk = node => {
      for (const ch of [...node.childNodes]) {
        if (ch.nodeType === 3) continue;
        if (ch.nodeType !== 1) { ch.remove(); continue; }
        if (DROP.test(ch.tagName)) { ch.remove(); continue; }
        walk(ch);
        if (!ALLOWED.has(ch.tagName)) { ch.replaceWith(...ch.childNodes); continue; }
        const href = ch.tagName === 'A' ? ch.getAttribute('href') : null;
        for (const a of [...ch.attributes]) ch.removeAttribute(a.name);
        if (ch.tagName === 'A') {
          const h = WB.safeHref(href);
          if (h) { ch.setAttribute('href', h); ch.setAttribute('target', '_blank'); ch.setAttribute('rel', 'noopener noreferrer'); } else ch.replaceWith(...ch.childNodes);
        }
      }
    };
    walk(doc.body);
    if (!doc.body.textContent.trim()) return '';
    return doc.body.innerHTML;
  };
  WB.plainOf = html => { const d = new DOMParser().parseFromString(`<body>${String(html || '')}</body>`, 'text/html'); return d.body.textContent.trim(); };
  WB.fmtSize = n => (n >= 1048576 ? `${(n / 1048576).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
  WB.fmtAgo = t => {
    const d = Date.now() - t;
    if (d < 60e3) return 'gerade eben';
    if (d < 36e5) return `vor ${Math.round(d / 60e3)} Min`;
    if (d < 864e5) return `vor ${Math.round(d / 36e5)} Std`;
    return new Date(t).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
  };
  WB.clone = v => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
  const isObj = v => v && typeof v === 'object' && !Array.isArray(v);

  // Wie json_patch auf dem Server: Objekte werden zusammengeführt, null löscht einen Schlüssel, Listen werden ersetzt.
  function mergePatch(target, patch) {
    for (const k of Object.keys(patch)) {
      const v = patch[k];
      if (v === null) delete target[k];
      else if (isObj(v)) { if (!isObj(target[k])) target[k] = {}; mergePatch(target[k], v); }
      else target[k] = v;
    }
    return target;
  }
  function invertPatch(old, patch) {
    const out = {};
    for (const k of Object.keys(patch)) {
      if (isObj(patch[k]) && isObj(old[k])) out[k] = invertPatch(old[k], patch[k]);
      else out[k] = old[k] === undefined ? null : WB.clone(old[k]);
    }
    return out;
  }
  function deepCombine(a, b) {
    const out = { ...a };
    for (const k of Object.keys(b)) out[k] = isObj(a[k]) && isObj(b[k]) ? deepCombine(a[k], b[k]) : b[k];
    return out;
  }

  /* ---------- API ---------- */
  WB.token = () => { try { return localStorage.getItem(TOKEN_KEY); } catch (_) { return null; } };
  WB.setToken = t => { try { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); } catch (_) { /* privat */ } };

  WB.api = async function (path, { method = 'GET', body, raw, headers = {} } = {}) {
    const h = { ...headers };
    const tok = WB.token();
    if (tok) h.Authorization = `Bearer ${tok}`;
    if (body !== undefined) h['Content-Type'] = 'application/json';
    let res;
    try {
      res = await fetch(API + path, { method, headers: h, body: raw !== undefined ? raw : body !== undefined ? JSON.stringify(body) : undefined });
    } catch (e) {
      const err = new Error('Keine Verbindung.');
      err.network = true;
      throw err;
    }
    let data = null;
    try { data = await res.json(); } catch (_) { /* kein JSON */ }
    if (!res.ok) {
      const err = new Error((data && data.error) || `Fehler ${res.status}`);
      err.status = res.status;
      if (res.status === 401 && WB.onAuthLost) WB.onAuthLost();
      if (res.status >= 500) err.network = true;
      throw err;
    }
    return data;
  };

  /* ---------- Speichern ---------- */
  const Q = { list: [], timer: null, sending: false, backoff: 1000 };
  const sync = st => { WB.setSync && WB.setSync(st); };
  WB.pending = () => Q.list.length > 0 || Q.sending;

  function compact(ops) {
    const out = [];
    for (const op of ops) {
      const last = out[out.length - 1];
      if (op.op === 'set' && last && last.op === 'set' && last.id === op.id) {
        const merged = { ...last.patch, ...op.patch };
        if (last.patch.data && op.patch.data) merged.data = deepCombine(last.patch.data, op.patch.data);
        last.patch = merged;
      } else out.push(WB.clone(op));
    }
    return out;
  }

  WB.send = function (ops, board) {
    const b = board || (S.board && S.board.id);
    if (!b) return;
    for (const op of ops) Q.list.push({ board: b, op });
    sync('saving');
    clearTimeout(Q.timer);
    Q.timer = setTimeout(flush, 90);
  };

  async function flush() {
    if (Q.sending || !Q.list.length) return;
    Q.sending = true;
    while (Q.list.length) {
      const board = Q.list[0].board;
      const batch = [];
      while (Q.list.length && Q.list[0].board === board && batch.length < 300) batch.push(Q.list.shift().op);
      try {
        const r = await WB.api(`/boards/${board}/ops`, { method: 'POST', body: { ops: compact(batch) }, headers: { 'X-Client': S.peerId } });
        Q.backoff = 1000;
        if (S.board && S.board.id === board) {
          S.rev = r.rev; S.board.rev = r.rev;
          // Ist nichts mehr unterwegs, gilt der Stand vom Server. So geht nichts verloren, wenn zwei gleichzeitig dieselbe Karte ändern.
          if (Q.list.length) { for (const c of r.cards || []) { const l = S.cards.get(c.id) || S.dead.get(c.id); if (l) l.rev = c.rev; } }
          else WB.applyServerCards(r.cards);
        }
      } catch (e) {
        if (e.network) {
          Q.list.unshift(...batch.map(op => ({ board, op })));
          sync('offline');
          Q.sending = false;
          setTimeout(flush, Q.backoff);
          Q.backoff = Math.min(Q.backoff * 2, 15000);
          return;
        }
        if (e.status !== 401) {
          WB.toast(e.message);
          if (S.board && S.board.id === board) WB.reconcile(true);
        }
      }
    }
    Q.sending = false;
    sync('saved');
  }
  WB.flushNow = () => { clearTimeout(Q.timer); return flush(); };

  window.addEventListener('beforeunload', e => {
    if (S.editing) WB.stopEdit();
    if (WB.pending()) { WB.flushNow(); e.preventDefault(); e.returnValue = ''; }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { if (S.editing) WB.commitEditNow && WB.commitEditNow(); WB.flushNow(); } else if (S.board) WB.reconcile();
  });

  /* ---------- Operationen lokal anwenden ---------- */
  function norm(c) {
    return { id: c.id, type: c.type, x: c.x || 0, y: c.y || 0, w: c.w || 260, h: c.h === undefined ? null : c.h, z: c.z || 0, parent: c.parent || null, pos: c.pos || 0, data: c.data || {}, rev: c.rev || 0, updatedBy: c.updatedBy || (S.me && S.me.name), createdBy: c.createdBy || (S.me && S.me.name) };
  }
  WB.norm = norm;

  function kill(id) {
    const c = S.cards.get(id);
    if (!c) return;
    S.cards.delete(id); S.dead.set(id, c); S.sel.delete(id);
    WB.dropCard(id);
  }
  function applyLocal(op) {
    switch (op.op) {
      case 'add': {
        const c = norm(WB.clone(op.card));
        S.cards.set(c.id, c); S.dead.delete(c.id);
        WB.renderCard(c);
        if (c.parent) WB.sortColumn(c.parent);
        break;
      }
      case 'set': {
        const c = S.cards.get(op.id);
        if (!c) return;
        const oldParent = c.parent;
        for (const k of Object.keys(op.patch)) {
          if (k === 'data') mergePatch(c.data, WB.clone(op.patch.data));
          else c[k] = op.patch[k];
        }
        WB.renderCard(c);
        if (oldParent !== c.parent && oldParent) WB.sortColumn(oldParent);
        if (c.parent) WB.sortColumn(c.parent);
        break;
      }
      case 'del': {
        const kids = [...S.cards.values()].filter(k => k.parent === op.id).map(k => k.id);
        const parent = S.cards.get(op.id) && S.cards.get(op.id).parent;
        kids.forEach(kill); kill(op.id);
        if (parent) WB.sortColumn(parent);
        S.trash++;
        WB.paintTrash && WB.paintTrash();
        break;
      }
      case 'undel': {
        const c = S.dead.get(op.id);
        if (!c) return;
        S.dead.delete(op.id); S.cards.set(op.id, c);
        for (const [kid, k] of [...S.dead]) if (k.parent === op.id) { S.dead.delete(kid); S.cards.set(kid, k); }
        WB.renderAll();
        S.trash = Math.max(0, S.trash - 1);
        WB.paintTrash && WB.paintTrash();
        break;
      }
      case 'board': {
        Object.assign(S.board, op.patch);
        WB.paintCrumbs && WB.paintCrumbs();
        break;
      }
      default:
    }
  }

  function invert(op) {
    switch (op.op) {
      case 'add': return { op: 'del', id: op.card.id };
      case 'del': return { op: 'undel', id: op.id };
      case 'undel': return { op: 'del', id: op.id };
      case 'set': {
        const c = S.cards.get(op.id);
        if (!c) return null;
        const patch = {};
        for (const k of Object.keys(op.patch)) {
          if (k === 'data') patch.data = invertPatch(c.data, op.patch.data);
          else patch[k] = c[k] === undefined ? null : WB.clone(c[k]);
        }
        return { op: 'set', id: op.id, patch };
      }
      case 'board': {
        const patch = {};
        for (const k of Object.keys(op.patch)) patch[k] = S.board[k] === undefined ? null : S.board[k];
        return { op: 'board', patch };
      }
      default: return null;
    }
  }

  // Eine Nutzeraktion: lokal anwenden, speichern, für Rückgängig merken.
  WB.commit = function (ops, { history = true, send = true } = {}) {
    if (!ops.length) return;
    const inverse = [];
    for (const op of ops) {
      const inv = invert(op);
      if (inv) inverse.unshift(inv);
      applyLocal(op);
    }
    if (history) { S.undo.push({ ops: WB.clone(ops), inverse }); if (S.undo.length > 200) S.undo.shift(); S.redo.length = 0; }
    if (send) WB.send(ops);
    WB.scheduleLines();
    WB.paintSelection();
    WB.paintEmpty && WB.paintEmpty();
    WB.paintDock && WB.paintDock();
  };
  // Schon gespeicherte Eingabe (Tippen) nachträglich als ein Schritt merken.
  WB.remember = function (ops, inverse) { S.undo.push({ ops, inverse }); S.redo.length = 0; WB.paintDock && WB.paintDock(); };

  WB.undo = function () {
    if (S.editing) WB.stopEdit();
    const e = S.undo.pop();
    if (!e) return;
    S.redo.push(e);
    for (const op of e.inverse) applyLocal(op);
    WB.send(e.inverse);
    WB.afterHistory();
  };
  WB.redo = function () {
    if (S.editing) WB.stopEdit();
    const e = S.redo.pop();
    if (!e) return;
    S.undo.push(e);
    const ops = e.ops.map(op => (op.op === 'add' && S.dead.has(op.card.id) ? { op: 'undel', id: op.card.id } : op));
    for (const op of ops) applyLocal(op);
    WB.send(ops);
    WB.afterHistory();
  };
  WB.afterHistory = function () {
    WB.scheduleLines(); WB.paintSelection();
    WB.paintEmpty && WB.paintEmpty(); WB.paintDock && WB.paintDock();
  };

  /* ---------- Änderungen von anderen ---------- */
  WB.applyServerCards = function (cards, opts = {}) {
    let touched = 0;
    for (const raw of cards || []) {
      const local = S.cards.get(raw.id) || S.dead.get(raw.id);
      if (local && local.rev >= raw.rev && !opts.force) continue;
      touched++;
      if (raw.deletedAt) {
        if (S.cards.has(raw.id)) { const p = local.parent; kill(raw.id); if (p) WB.sortColumn(p); }
        else if (local) Object.assign(local, norm(raw));
        continue;
      }
      if (S.cards.has(raw.id)) {
        const c = S.cards.get(raw.id);
        const keepData = S.editing === raw.id ? c.data : null;
        const dragging = S.drag && S.drag.ids && S.drag.ids.has(raw.id);
        const oldParent = c.parent;
        const { x, y } = c;
        Object.assign(c, norm(raw));
        if (keepData) c.data = keepData;
        if (dragging) { c.x = x; c.y = y; }
        WB.clearPeerDrag(c.id);
        WB.renderCard(c);
        if (oldParent && oldParent !== c.parent) WB.sortColumn(oldParent);
        if (c.parent) WB.sortColumn(c.parent);
      } else {
        const c = norm(raw);
        S.dead.delete(c.id);
        S.cards.set(c.id, c);
        WB.renderCard(c);
        if (c.parent) WB.sortColumn(c.parent);
        if (opts.pulse) WB.pulseCard(c.id);
      }
    }
    if (touched) { WB.scheduleLines(); WB.paintSelection(); WB.paintEmpty && WB.paintEmpty(); }
    return touched;
  };

  /* ---------- Board laden ---------- */
  WB.openBoard = async function (id, { focus, keepView } = {}) {
    if (S.editing) WB.stopEdit();
    await WB.flushNow();
    let data;
    try {
      data = await WB.api(`/boards/${encodeURIComponent(id)}`);
    } catch (e) {
      if (e.status === 404 && id !== 'home') { WB.toast('Dieses Board gibt es nicht mehr.'); return WB.openBoard('home'); }
      if (e.status === 401) return null;
      WB.toast(e.message);
      throw e;
    }
    closeWs();
    const same = S.board && S.board.id === data.board.id;
    S.board = data.board; S.crumbs = data.crumbs; S.counts = data.counts || {}; S.trash = data.trash || 0; S.rev = data.board.rev;
    if (!same) { S.undo.length = 0; S.redo.length = 0; S.sel.clear(); S.follow = null; }
    S.cards.clear(); S.dead.clear();
    for (const c of data.cards) S.cards.set(c.id, norm(c));
    for (const el of S.els.values()) el.remove();
    S.els.clear();
    WB.renderAll();
    WB.paintCrumbs(); WB.paintTrash(); WB.paintEmpty(); WB.paintDock();
    try {
      localStorage.setItem('sb-wb-last', data.board.id);
      history.replaceState(null, '', `${location.pathname}${location.search}#b=${encodeURIComponent(data.board.id)}`);
    } catch (_) { /* egal */ }
    document.title = `${data.board.title} · Whiteboard`;
    if (!keepView) WB.restoreView();
    if (focus) WB.focusCard(focus);
    connect(data.board.id);
    return data;
  };

  // Stand abgleichen, wenn die Verbindung weg war oder der Tab zurückkommt.
  WB.reconcile = async function (force) {
    if (!S.board || S.editing || (WB.pending() && !force)) return;
    try {
      const { rev } = await WB.api(`/boards/${S.board.id}/rev`);
      if (rev === S.rev && !force) return;
      const data = await WB.api(`/boards/${S.board.id}`);
      S.board = data.board; S.crumbs = data.crumbs; S.counts = data.counts || {}; S.trash = data.trash || 0; S.rev = data.board.rev;
      const keep = new Set(data.cards.map(c => c.id));
      for (const id of [...S.cards.keys()]) if (!keep.has(id)) { S.cards.delete(id); S.sel.delete(id); WB.dropCard(id); }
      WB.applyServerCards(data.cards, { force: true });
      WB.paintCrumbs(); WB.paintTrash();
    } catch (_) { /* nächster Versuch kommt */ }
  };

  /* ---------- Live Verbindung ---------- */
  let ws = null, wsBoard = null, pingT = null, retryT = null, retry = 800, pollT = null;
  function closeWs() {
    clearInterval(pingT); clearTimeout(retryT);
    if (ws) { ws.onclose = null; ws.onerror = null; ws.onmessage = null; try { ws.close(1000); } catch (_) { /* zu */ } }
    ws = null; wsBoard = null;
    S.peers.clear();
    WB.paintPeers && WB.paintPeers();
    WB.clearCursors && WB.clearCursors();
  }
  WB.closeWs = closeWs;
  function connect(id) {
    closeWs();
    wsBoard = id;
    let sock;
    try {
      sock = new WebSocket(`${API.replace(/^http/, 'ws')}/ws/${encodeURIComponent(id)}?peer=${S.peerId}`, ['board', WB.token()]);
    } catch (_) { return; }
    ws = sock;
    let reconnecting = retry > 800;
    sock.onopen = () => {
      retry = 800;
      clearInterval(pollT); pollT = null;
      pingT = setInterval(() => { if (sock.readyState === 1) sock.send('ping'); }, 25000);
      WB.setLive && WB.setLive(true);
      if (reconnecting) WB.reconcile();
      WB.sendSelection && WB.sendSelection();
      reconnecting = false;
    };
    sock.onmessage = e => {
      if (e.data === 'pong') return;
      let m;
      try { m = JSON.parse(e.data); } catch (_) { return; }
      WB.onLive(m);
    };
    sock.onclose = () => {
      clearInterval(pingT);
      WB.setLive && WB.setLive(false);
      S.peers.clear();
      WB.paintPeers && WB.paintPeers();
      if (wsBoard !== id) return;
      retryT = setTimeout(() => connect(id), retry);
      retry = Math.min(retry * 1.8, 20000);
      if (!pollT) pollT = setInterval(() => WB.reconcile(), 15000);
    };
  }
  const liveSend = o => { if (ws && ws.readyState === 1) { try { ws.send(JSON.stringify(o)); } catch (_) { /* Beiwerk */ } } };
  WB.liveSend = liveSend;
  WB.hasPeers = () => S.peers.size > 0;

  WB.onLive = function (m) {
    switch (m.t) {
      case 'hello':
        S.peers.clear();
        for (const p of m.peers || []) S.peers.set(p.id, p);
        WB.paintPeers();
        for (const p of m.peers || []) { WB.paintPeerSelection(p); if (p.edit) WB.paintPeerEdit(p); }
        break;
      case 'join': S.peers.set(m.peer.id, m.peer); WB.paintPeers(); break;
      case 'leave': {
        const p = S.peers.get(m.id);
        S.peers.delete(m.id);
        if (S.follow === m.id) { S.follow = null; WB.toast(`${p ? p.name : 'Die Person'} ist weg, du folgst nicht mehr.`); }
        WB.removePeerMarks(m.id);
        WB.paintPeers();
        break;
      }
      case 'c': WB.moveCursor(m); break;
      case 's': { const p = S.peers.get(m.from); if (p) { p.sel = m.sel || []; WB.paintPeerSelection(p); } break; }
      case 'e': { const p = S.peers.get(m.from); if (p) { p.edit = m.id || null; WB.paintPeerEdit(p); } break; }
      case 'm': WB.peerDrag(m); break;
      case 'v': WB.peerView(m); break;
      case 'ops': {
        if (typeof m.rev === 'number') S.rev = Math.max(S.rev, m.rev);
        if (m.board && S.board && m.board.id === S.board.id) { Object.assign(S.board, m.board); WB.paintCrumbs(); }
        const newOnes = (m.cards || []).filter(c => !c.deletedAt && !S.cards.has(c.id));
        WB.applyServerCards(m.cards, { pulse: true });
        for (const id of m.gone || []) { if (S.cards.has(id)) { S.cards.delete(id); S.sel.delete(id); WB.dropCard(id); } }
        if (m.gone && m.gone.length) { WB.scheduleLines(); WB.paintSelection(); WB.paintEmpty(); }
        for (const p of S.peers.values()) { WB.paintPeerSelection(p); if (p.edit) WB.paintPeerEdit(p); }  // Karte kann erst jetzt da sein
        if (m.bot && newOnes.length) WB.botNotice(m.by, newOnes);
        break;
      }
      default:
    }
  };
})();
