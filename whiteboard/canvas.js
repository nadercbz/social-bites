/* Social Bites Whiteboard: Fläche, Zoom, Auswahl, Ziehen, Spalten, Pfeile, Eingabe und was die anderen gerade tun.
   Maus, Trackpad und Touch laufen über dieselben Pointer Ereignisse. */
(function () {
  'use strict';
  const WB = window.WB;
  const { S, $ } = WB;
  const canvas = $('#canvas'), world = $('#world'), cardsEl = $('#cards'), over = $('#over'), linesEl = $('#lines'), marquee = $('#marquee');

  const GRID = 10, MIN_Z = 0.1, MAX_Z = 3;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const isTouchEv = e => e.pointerType === 'touch' || e.pointerType === 'pen';

  /* ---------- Ansicht ---------- */
  let viewSave = null, viewSend = 0, viewTrail = null;
  function applyView() {
    const { x, y, z } = S.view;
    world.style.transform = `translate(${x}px,${y}px) scale(${z})`;
    world.style.setProperty('--iz', String(1 / z));
    let step = 24 * z;
    while (step < 14) step *= 2;
    canvas.style.backgroundSize = `${step}px ${step}px`;
    canvas.style.backgroundPosition = `${x}px ${y}px`;
    WB.paintZoom && WB.paintZoom();
    WB.paintHandles();
    WB.placeCtx && WB.placeCtx();
    clearTimeout(viewSave);
    viewSave = setTimeout(() => {
      try { if (S.board) localStorage.setItem(`sb-wb-view-${S.board.id}`, JSON.stringify(S.view)); } catch (_) { /* egal */ }
    }, 400);
    if (WB.hasPeers()) {
      const now = Date.now();
      const send = () => { const r = canvas.getBoundingClientRect(); WB.liveSend({ t: 'v', cx: (r.width / 2 - S.view.x) / S.view.z, cy: (r.height / 2 - S.view.y) / S.view.z, z: S.view.z }); viewSend = Date.now(); };
      clearTimeout(viewTrail);
      if (now - viewSend > 160) send(); else viewTrail = setTimeout(send, 170);
    }
  }
  WB.applyView = applyView;
  WB.setView = v => { Object.assign(S.view, v); applyView(); };
  WB.toWorld = (cx, cy) => { const r = canvas.getBoundingClientRect(); return { x: (cx - r.left - S.view.x) / S.view.z, y: (cy - r.top - S.view.y) / S.view.z }; };
  WB.zoomAt = function (cx, cy, z) {
    const r = canvas.getBoundingClientRect();
    const nz = clamp(z, MIN_Z, MAX_Z);
    const wx = (cx - r.left - S.view.x) / S.view.z, wy = (cy - r.top - S.view.y) / S.view.z;
    WB.setView({ z: nz, x: cx - r.left - wx * nz, y: cy - r.top - wy * nz });
  };
  WB.zoomBy = f => { const r = canvas.getBoundingClientRect(); WB.zoomAt(r.left + r.width / 2, r.top + r.height / 2, S.view.z * f); };
  const stopFollow = () => { if (S.follow) { S.follow = null; WB.paintPeers(); } };

  const rectOf = id => {
    const el = S.els.get(id);
    if (!el) return null;
    const b = el.getBoundingClientRect(), o = canvas.getBoundingClientRect();
    return { x: (b.left - o.left - S.view.x) / S.view.z, y: (b.top - o.top - S.view.y) / S.view.z, w: b.width / S.view.z, h: b.height / S.view.z };
  };
  WB.rectOf = rectOf;

  function bounds(ids) {
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    for (const id of ids) {
      const c = S.cards.get(id);
      if (!c) continue;
      if (c.type === 'line') {
        const g = lineGeom(c);
        if (g) { x1 = Math.min(x1, g.a.x, g.b.x); y1 = Math.min(y1, g.a.y, g.b.y); x2 = Math.max(x2, g.a.x, g.b.x); y2 = Math.max(y2, g.a.y, g.b.y); }
        continue;
      }
      if (c.parent && ids.includes(c.parent)) continue;
      const r = rectOf(id);
      if (r) { x1 = Math.min(x1, r.x); y1 = Math.min(y1, r.y); x2 = Math.max(x2, r.x + r.w); y2 = Math.max(y2, r.y + r.h); }
    }
    return x1 === Infinity ? null : { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
  }
  WB.bounds = bounds;

  function insets() {
    const small = window.innerWidth < 760;
    return { l: small ? 16 : 100, t: small ? 64 : 76, r: small ? 16 : 28, b: small ? 104 : 70 };
  }
  WB.fit = function () {
    const ids = [...S.cards.keys()];
    const b = bounds(ids);
    const r = canvas.getBoundingClientRect();
    const i = insets();
    if (!b) return WB.setView({ x: i.l + 40, y: i.t + 40, z: 1 });
    const z = clamp(Math.min((r.width - i.l - i.r) / Math.max(b.w, 1), (r.height - i.t - i.b) / Math.max(b.h, 1), 1), MIN_Z, 1);
    WB.setView({ z, x: i.l + (r.width - i.l - i.r - b.w * z) / 2 - b.x * z, y: i.t + Math.max(0, (r.height - i.t - i.b - b.h * z) / 2) - b.y * z });
  };
  WB.restoreView = function () {
    let v = null;
    try { v = JSON.parse(localStorage.getItem(`sb-wb-view-${S.board.id}`)); } catch (_) { /* egal */ }
    if (v && Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z)) { WB.setView({ x: v.x, y: v.y, z: clamp(v.z, MIN_Z, MAX_Z) }); return; }
    requestAnimationFrame(() => WB.fit());
    WB.fit();
  };
  WB.focusCard = function (id) {
    const c = S.cards.get(id);
    if (!c) return;
    const r = rectOf(id);
    if (!r) return;
    const o = canvas.getBoundingClientRect();
    const z = Math.max(S.view.z, 0.8);
    WB.setView({ z, x: o.width / 2 - (r.x + r.w / 2) * z, y: o.height / 2 - (r.y + r.h / 2) * z });
    S.sel.clear(); S.sel.add(id);
    WB.paintSelection();
    WB.pulseCard(id);
  };
  WB.pulseCard = function (id) {
    const el = S.els.get(id);
    if (!el) return;
    el.classList.remove('pulse');
    void el.offsetWidth;
    el.classList.add('pulse');
    setTimeout(() => el.classList.remove('pulse'), 1500);
  };

  /* ---------- Neue Karten ---------- */
  const maxZ = () => { let m = 0; for (const c of S.cards.values()) m = Math.max(m, c.z || 0); return m; };
  WB.maxZ = maxZ;
  let cascade = 0;
  function nextSpot(w) {
    const r = canvas.getBoundingClientRect();
    const p = WB.toWorld(r.left + r.width / 2, r.top + r.height * 0.42);
    const off = (cascade++ % 8) * 26;
    return { x: Math.round((p.x - w / 2 + off) / GRID) * GRID, y: Math.round((p.y - 70 + off) / GRID) * GRID };
  }
  const LAZY = new Set(['note', 'todo', 'link', 'comment']);

  WB.addCard = function (type, opt = {}) {
    if (S.editing) WB.stopEdit();
    const id = opt.id || WB.rid();
    const w = opt.w || WB.CARD_DEFAULT[type] || 260;
    const spot = opt.x === undefined ? nextSpot(w) : { x: Math.round(opt.x / GRID) * GRID, y: Math.round(opt.y / GRID) * GRID };
    const data = { ...(opt.data || {}) };
    if (type === 'todo' && !data.items) data.items = [];
    if (type === 'table' && !data.rows) { data.rows = [['', '', ''], ['', '', ''], ['', '', '']]; data.header = true; }
    if (type === 'swatch' && !data.hex) data.hex = '#F26A21';
    if (type === 'comment' && !data.thread) data.thread = [];
    if (type === 'board') { data.board = data.board || id; data.title = data.title || 'Neues Board'; data.icon = data.icon || 'board'; }
    if (type === 'column' && data.title === undefined) data.title = '';
    if (type === 'sketch') { data.vw = data.vw || 800; data.vh = data.vh || 600; data.paths = data.paths || []; }
    const card = { id, type, x: spot.x, y: spot.y, w, z: maxZ() + 1, parent: opt.parent || null, pos: opt.pos || 0, data };
    const lazy = LAZY.has(type) && !opt.ready;
    if (lazy) S.fresh.set(id, { sent: false });
    WB.commit([{ op: 'add', card }], { send: !lazy });
    if (type === 'board') { S.counts[data.board] = 0; WB.renderCard(S.cards.get(id)); }
    if (opt.select !== false) { S.sel.clear(); S.sel.add(id); WB.paintSelection(); }
    const c = S.cards.get(id);
    if (opt.edit !== false) {
      // Direkt im Ereignis fokussieren, sonst öffnet iOS die Tastatur nicht.
      const el = S.els.get(id);
      if (el) {
        const f = type === 'todo' ? el.querySelector('[data-edit="title"]') : el.querySelector('[data-edit]');
        const inp = el.querySelector('.lk-input, .cm-input');
        if (inp) inp.focus({ preventScroll: true });
        else if (f && type !== 'image' && type !== 'swatch' && type !== 'board') WB.startEdit(c, f);
      }
      requestAnimationFrame(() => WB.placeCtx && WB.placeCtx());
    }
    return c;
  };
  WB.ensureSent = function (id) {
    const f = S.fresh.get(id);
    if (!f) return;
    S.fresh.delete(id);
    const c = S.cards.get(id);
    if (c && !f.sent) WB.send([{ op: 'add', card: { id: c.id, type: c.type, x: c.x, y: c.y, w: c.w, z: c.z, parent: c.parent, pos: c.pos, data: c.data } }]);
  };
  // Neue, leer gebliebene Karte: nie gespeichert, spurlos weg.
  WB.removeFresh = function (id) {
    S.fresh.delete(id);
    const c = S.cards.get(id);
    if (!c) return;
    const p = c.parent;
    S.cards.delete(id); S.sel.delete(id);
    WB.dropCard(id);
    if (p) WB.sortColumn(p);
    const last = S.undo[S.undo.length - 1];
    if (last && last.ops.length === 1 && last.ops[0].op === 'add' && last.ops[0].card.id === id) S.undo.pop();
    WB.afterHistory();
  };

  /* ---------- Eingabe in Felder ---------- */
  const PLAIN = (() => { const d = document.createElement('div'); try { d.contentEditable = 'plaintext-only'; return d.contentEditable === 'plaintext-only'; } catch (_) { return false; } })();
  let liveT = null;

  function placeCaret(f, where) {
    const sel = window.getSelection();
    if (!sel) return;
    let range = null;
    if (where && typeof where === 'object') {
      if (document.caretPositionFromPoint) {
        const p = document.caretPositionFromPoint(where.x, where.y);
        if (p && f.contains(p.offsetNode)) { range = document.createRange(); range.setStart(p.offsetNode, p.offset); range.collapse(true); }
      } else if (document.caretRangeFromPoint) {
        const r = document.caretRangeFromPoint(where.x, where.y);
        if (r && f.contains(r.startContainer)) range = r;
      }
    }
    if (!range) { range = document.createRange(); range.selectNodeContents(f); range.collapse(false); }
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function onFieldInput() {
    const c = S.cards.get(S.editing), f = S.editField;
    if (!c || !f) return;
    const patch = WB.T[c.type].read(f, c);
    Object.assign(c.data, patch);
    const fr = S.fresh.get(c.id);
    if (fr && !fr.sent) {
      fr.sent = true;
      WB.send([{ op: 'add', card: { id: c.id, type: c.type, x: c.x, y: c.y, w: c.w, z: c.z, parent: c.parent, pos: c.pos, data: c.data } }]);
    }
    clearTimeout(liveT);
    liveT = setTimeout(() => { if (S.cards.has(c.id)) WB.send([{ op: 'set', id: c.id, patch: { data: patch } }]); }, 320);
    WB.scheduleLines(); WB.paintHandles(); WB.placeCtx && WB.placeCtx();
  }
  function onFieldKey(e) {
    const c = S.cards.get(S.editing), f = S.editField;
    if (!c || !f) return;
    e.stopPropagation();  // sonst greift das globale Kürzel, sobald das Feld neu gezeichnet ist
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); WB.stopEdit(); canvas.focus({ preventScroll: true }); return; }
    const R = WB.T[c.type];
    if (R.key && R.key(e, f, c)) return;
    if (f.dataset.edit === 'title' || f.dataset.edit === 'caption' || f.dataset.edit === 'name') {
      if (e.key === 'Enter') { e.preventDefault(); WB.stopEdit(); }
    }
    if ((e.metaKey || e.ctrlKey) && f.dataset.rich) {
      const k = e.key.toLowerCase();
      if (k === 'b' || k === 'i' || k === 'u') { e.preventDefault(); document.execCommand({ b: 'bold', i: 'italic', u: 'underline' }[k]); onFieldInput(); }
      if (k === 'k') { e.preventDefault(); WB.fmtCommand && WB.fmtCommand('link'); }
    }
  }
  function onFieldPaste(e) {
    const c = S.cards.get(S.editing), f = S.editField;
    if (!c || !f) return;
    e.stopPropagation();
    const R = WB.T[c.type];
    if (R.paste && R.paste(e, f, c)) return;
    const cd = e.clipboardData;
    if (!cd) return;
    e.preventDefault();
    if (f.dataset.rich) {
      const html = cd.getData('text/html');
      if (html) document.execCommand('insertHTML', false, WB.clean(html));
      else document.execCommand('insertText', false, cd.getData('text/plain'));
    } else document.execCommand('insertText', false, cd.getData('text/plain').replace(/\s*\n\s*/g, ' '));
  }
  function onFieldBlur() {
    setTimeout(() => {
      if (S.editField && document.activeElement !== S.editField && !(document.activeElement && document.activeElement.closest && document.activeElement.closest('#fmt, #dlg, #pop'))) WB.stopEdit();
    }, 0);
  }

  WB.startEdit = function (c, f, where) {
    if (S.editing) WB.stopEdit();
    if (!f || !S.cards.has(c.id)) return;
    S.editing = c.id; S.editField = f; S.editBefore = WB.clone(c.data);
    f.contentEditable = f.dataset.rich ? 'true' : (PLAIN ? 'plaintext-only' : 'true');
    f.classList.add('editing');
    const el = S.els.get(c.id);
    if (el) el.classList.add('is-editing');
    f.addEventListener('input', onFieldInput);
    f.addEventListener('keydown', onFieldKey);
    f.addEventListener('paste', onFieldPaste);
    f.addEventListener('blur', onFieldBlur);
    f.focus({ preventScroll: true });
    placeCaret(f, where);
    if (!S.sel.has(c.id) || S.sel.size > 1) { S.sel.clear(); S.sel.add(c.id); }
    WB.paintSelection();
    WB.liveSend({ t: 'e', id: c.id });
    WB.paintFmt && WB.paintFmt();
  };

  // Für den Fall, dass der Tab weggeht: gespeichert wird, ohne dass die Eingabe endet.
  WB.commitEditNow = function () {
    const c = S.cards.get(S.editing);
    if (!c || !S.editField) return;
    clearTimeout(liveT);
    const R = WB.T[c.type];
    if (R.read) WB.send([{ op: 'set', id: c.id, patch: { data: R.read(S.editField, c) } }]);
  };

  WB.stopEdit = function () {
    const id = S.editing, f = S.editField;
    if (!id) return;
    const c = S.cards.get(id);
    S.editing = null; S.editField = null;
    clearTimeout(liveT);
    if (f) {
      f.removeEventListener('input', onFieldInput);
      f.removeEventListener('keydown', onFieldKey);
      f.removeEventListener('paste', onFieldPaste);
      f.removeEventListener('blur', onFieldBlur);
      f.removeAttribute('contenteditable');
      f.classList.remove('editing');
      const sel = window.getSelection();
      if (sel && f.contains(sel.anchorNode)) sel.removeAllRanges();
    }
    const el = S.els.get(id);
    if (el) el.classList.remove('is-editing');
    WB.liveSend({ t: 'e', id: null });
    WB.paintFmt && WB.paintFmt();
    if (!c) return;
    const R = WB.T[c.type];
    const before = S.editBefore || {};
    const patch = f && R.read ? R.read(f, c) : {};
    Object.assign(c.data, patch);
    const fr = S.fresh.get(id);
    if (fr && !fr.sent && R.isEmpty && R.isEmpty(c)) { WB.removeFresh(id); return; }
    if (fr && fr.sent && R.isEmpty && R.isEmpty(c)) {
      S.fresh.delete(id);
      const last = S.undo[S.undo.length - 1];
      if (last && last.ops[0] && last.ops[0].op === 'add' && last.ops[0].card.id === id) S.undo.pop();
      WB.commit([{ op: 'del', id }], { history: false });
      return;
    }
    if (fr) WB.ensureSent(id);
    const changed = Object.keys(patch).filter(k => JSON.stringify(patch[k]) !== JSON.stringify(before[k]));
    if (changed.length) {
      const after = {}, inv = {};
      for (const k of changed) { after[k] = patch[k]; inv[k] = before[k] === undefined ? null : before[k]; }
      WB.send([{ op: 'set', id, patch: { data: after } }]);
      if (!fr) WB.remember([{ op: 'set', id, patch: { data: after } }], [{ op: 'set', id, patch: { data: inv } }]);
    }
    WB.renderCard(c);
    if (R.afterEdit && changed.length) R.afterEdit(c);
    measure(c);
    WB.scheduleLines(); WB.paintSelection();
  };

  // Gemessene Höhe mitspeichern, damit Claude neue Karten nicht darüber legt.
  function measure(c) {
    if (c.parent) return;
    requestAnimationFrame(() => {
      const r = rectOf(c.id);
      if (r && S.cards.has(c.id) && Math.abs((c.h || 0) - r.h) > 16) { c.h = Math.round(r.h); WB.send([{ op: 'set', id: c.id, patch: { h: c.h } }]); }
    });
  }
  WB.measure = measure;

  /* ---------- Auswahl ---------- */
  let selSend = null;
  WB.sendSelection = () => { clearTimeout(selSend); selSend = setTimeout(() => WB.liveSend({ t: 's', sel: [...S.sel].slice(0, 40) }), 60); };
  WB.paintSelection = function () {
    for (const [id, el] of S.els) el.classList.toggle('sel', S.sel.has(id));
    WB.sendSelection();
    WB.scheduleLines();
    WB.paintHandles();
    WB.paintCtx && WB.paintCtx();
  };
  WB.selectOnly = id => { S.sel.clear(); if (id) S.sel.add(id); WB.paintSelection(); };

  /* ---------- Griffe ---------- */
  const mkHandle = cls => { const d = document.createElement('div'); d.className = `hd ${cls}`; d.hidden = true; over.appendChild(d); return d; };
  const H = { rz: mkHandle('hd-rz'), conn: mkHandle('hd-conn'), from: mkHandle('hd-end'), to: mkHandle('hd-end'), mid: mkHandle('hd-mid') };
  H.rz.dataset.h = 'rz'; H.conn.dataset.h = 'conn'; H.from.dataset.h = 'from'; H.to.dataset.h = 'to'; H.mid.dataset.h = 'mid';
  H.rz.title = 'Größe ziehen'; H.conn.title = 'Pfeil ziehen';
  const labelsEl = document.createElement('div'); labelsEl.id = 'labels'; over.appendChild(labelsEl);
  const gx = document.createElement('div'); gx.className = 'guide gx'; gx.hidden = true; over.appendChild(gx);
  const gy = document.createElement('div'); gy.className = 'guide gy'; gy.hidden = true; over.appendChild(gy);
  const place = (el, x, y) => { el.hidden = false; el.style.left = `${x}px`; el.style.top = `${y}px`; };

  WB.paintHandles = function () {
    Object.values(H).forEach(h => { h.hidden = true; });
    if (S.drag || S.sel.size !== 1) return;
    const id = [...S.sel][0];
    const c = S.cards.get(id);
    if (!c) return;
    if (c.type === 'line') {
      const g = lineGeom(c);
      if (!g) return;
      place(H.from, g.a.x, g.a.y); place(H.to, g.b.x, g.b.y); place(H.mid, g.m.x, g.m.y);
      return;
    }
    if (S.editing === id && c.type === 'note') { /* beim Schreiben bleibt die Größe trotzdem erreichbar */ }
    const r = rectOf(id);
    if (!r) return;
    if (!c.parent) { place(H.rz, r.x + r.w, r.y + r.h); place(H.conn, r.x + r.w + 16 / S.view.z, r.y + r.h / 2); }
    else place(H.conn, r.x + r.w + 16 / S.view.z, r.y + r.h / 2);
  };

  /* ---------- Pfeile ---------- */
  let linesRaf = 0;
  WB.scheduleLines = function () { if (!linesRaf) linesRaf = requestAnimationFrame(() => { linesRaf = 0; renderLines(); WB.paintHandles(); }); };
  const ro = 'ResizeObserver' in window ? new ResizeObserver(() => { WB.scheduleLines(); WB.placeCtx && WB.placeCtx(); }) : null;
  const observed = new WeakSet();
  WB.observeCard = el => { if (ro && !observed.has(el)) { ro.observe(el); observed.add(el); } };

  const centerOf = end => {
    if (!end) return null;
    if (end.card) { const r = rectOf(end.card); return r ? { x: r.x + r.w / 2, y: r.y + r.h / 2, r } : null; }
    if (Number.isFinite(end.x) && Number.isFinite(end.y)) return { x: end.x, y: end.y };
    return null;
  };
  function edgePoint(c, toward) {
    if (!c.r) return { x: c.x, y: c.y };
    const dx = toward.x - c.x, dy = toward.y - c.y;
    if (!dx && !dy) return { x: c.x, y: c.y };
    const pad = 7;
    const hw = c.r.w / 2 + pad, hh = c.r.h / 2 + pad;
    const t = Math.min(dx ? hw / Math.abs(dx) : Infinity, dy ? hh / Math.abs(dy) : Infinity);
    return { x: c.x + dx * t, y: c.y + dy * t };
  }
  function lineGeom(c) {
    const d = c.data;
    const fc = centerOf(d.from), tc = centerOf(d.to);
    if (!fc || !tc) return null;
    const bend = d.bend || 0;
    const mid0 = { x: (fc.x + tc.x) / 2, y: (fc.y + tc.y) / 2 };
    const len = Math.hypot(tc.x - fc.x, tc.y - fc.y) || 1;
    const nx = -(tc.y - fc.y) / len, ny = (tc.x - fc.x) / len;
    const ctrl = { x: mid0.x + nx * bend * 2, y: mid0.y + ny * bend * 2 };
    const a = edgePoint(fc, ctrl), b = edgePoint(tc, ctrl);
    const m = { x: 0.25 * a.x + 0.5 * ctrl.x + 0.25 * b.x, y: 0.25 * a.y + 0.5 * ctrl.y + 0.25 * b.y };
    return { a, b, ctrl, m, nx, ny, mid0 };
  }
  WB.lineGeom = lineGeom;
  const lineColor = k => { const f = WB.LINE_COLORS.find(x => x[0] === k); return f ? (k === 'ink' ? 'var(--ink)' : f[1]) : 'var(--ink)'; };
  function arrow(tip, from, size) {
    const ang = Math.atan2(tip.y - from.y, tip.x - from.x);
    const s = size;
    const p1 = { x: tip.x - Math.cos(ang - 0.45) * s, y: tip.y - Math.sin(ang - 0.45) * s };
    const p2 = { x: tip.x - Math.cos(ang + 0.45) * s, y: tip.y - Math.sin(ang + 0.45) * s };
    return `M${p1.x.toFixed(1)} ${p1.y.toFixed(1)}L${tip.x.toFixed(1)} ${tip.y.toFixed(1)}L${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  function renderLines() {
    let out = '';
    const seen = new Set();
    const draft = S.lineDraft ? [{ id: '_draft', type: 'line', data: S.lineDraft }] : [];
    for (const c of [...S.cards.values(), ...draft]) {
      if (c.type !== 'line') continue;
      const g = lineGeom(c);
      if (!g) continue;
      const d = c.data;
      const color = lineColor(d.color);
      const dash = d.style === 'dashed' ? '9 7' : d.style === 'dotted' ? '1.500 7' : '';
      const path = `M${g.a.x.toFixed(1)} ${g.a.y.toFixed(1)}Q${g.ctrl.x.toFixed(1)} ${g.ctrl.y.toFixed(1)} ${g.b.x.toFixed(1)} ${g.b.y.toFixed(1)}`;
      const sel = S.sel.has(c.id);
      const head = d.head === undefined ? 'end' : d.head;
      out += `<g class="ln${sel ? ' sel' : ''}"><path class="ln-hit" data-line="${c.id}" d="${path}"/><path class="ln-vis" d="${path}" stroke="${color}"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;
      if (head === 'end' || head === 'both') out += `<path class="ln-vis" d="${arrow(g.b, g.ctrl, 13)}" stroke="${color}"/>`;
      if (head === 'both') out += `<path class="ln-vis" d="${arrow(g.a, g.ctrl, 13)}" stroke="${color}"/>`;
      out += '</g>';
      if (d.label || S.editLabel === c.id) {
        seen.add(c.id);
        let lb = labelsEl.querySelector(`[data-label="${CSS.escape(c.id)}"]`);
        if (!lb) { lb = document.createElement('div'); lb.className = 'll'; lb.dataset.label = c.id; labelsEl.appendChild(lb); }
        if (S.editLabel !== c.id && lb.textContent !== d.label) lb.textContent = d.label;
        lb.style.left = `${g.m.x}px`; lb.style.top = `${g.m.y}px`;
        lb.classList.toggle('sel', sel);
      }
    }
    linesEl.innerHTML = out;
    for (const lb of [...labelsEl.children]) if (!seen.has(lb.dataset.label)) lb.remove();
  }

  WB.editLineLabel = function (id) {
    const c = S.cards.get(id);
    if (!c) return;
    S.editLabel = id;
    renderLines();
    const lb = labelsEl.querySelector(`[data-label="${CSS.escape(id)}"]`);
    if (!lb) return;
    lb.contentEditable = PLAIN ? 'plaintext-only' : 'true';
    lb.focus();
    placeCaret(lb, null);
    const done = () => {
      lb.removeEventListener('blur', done);
      lb.removeAttribute('contenteditable');
      const v = lb.textContent.trim();
      S.editLabel = null;
      if (v !== (c.data.label || '')) WB.commit([{ op: 'set', id, patch: { data: { label: v } } }]);
      renderLines();
    };
    lb.addEventListener('blur', done);
    lb.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); lb.blur(); } });
  };

  const endFromPoint = (cx, cy, except) => {
    const under = document.elementFromPoint(cx, cy);
    const card = under && under.closest && under.closest('.card');
    if (card && card.dataset.id !== except && S.cards.has(card.dataset.id)) return { card: card.dataset.id, x: null, y: null };
    const p = WB.toWorld(cx, cy);
    return { card: null, x: Math.round(p.x), y: Math.round(p.y) };
  };

  /* ---------- Zeiger ---------- */
  const pts = new Map();
  let press = null, pan = null, pinch = null, marq = null, rz = null, lineAct = null, longT = null, clickT = null, lastTap = { t: 0, x: 0, y: 0 }, cursorT = 0;
  let spaceDown = false, gestureEnd = 0;
  WB.setSpace = v => { spaceDown = v; canvas.classList.toggle('panning', v || S.hand); };

  function cancelGesture() {
    clearTimeout(longT);
    if (S.drag) cancelDrag();
    press = null; marq = null; rz = null; lineAct = null;
    marquee.hidden = true;
  }

  canvas.addEventListener('pointerdown', e => {
    clearTimeout(clickT);  // neuer Druck: das verzögerte Schreiben aus dem letzten Klick fällt aus
    if (e.target.closest('#empty') && e.target.closest('button, a, input')) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2 && [...pts.values()].length === 2) {
      cancelGesture();
      pan = null;
      const [a, b] = [...pts.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: S.view.z, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
      stopFollow();
      return;
    }
    if (pts.size > 2) return;
    WB.closePop && WB.closePop();

    // Mittlere Taste, Leertaste oder Hand schieben die Fläche
    if (e.button === 1 || spaceDown || S.hand) { e.preventDefault(); pan = { x: e.clientX, y: e.clientY, vx: S.view.x, vy: S.view.y }; stopFollow(); canvas.setPointerCapture(e.pointerId); canvas.classList.add('grabbing'); return; }
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    // Griffe
    const hd = e.target.closest && e.target.closest('.hd');
    if (hd) {
      e.preventDefault();
      const id = [...S.sel][0];
      const c = S.cards.get(id);
      if (!c) return;
      canvas.setPointerCapture(e.pointerId);
      const kind = hd.dataset.h;
      if (kind === 'rz') { const r = rectOf(id); rz = { id, c, x0: e.clientX, w0: r.w }; return; }
      if (kind === 'conn') { if (S.editing) WB.stopEdit(); S.lineDraft = { from: { card: id }, to: { x: WB.toWorld(e.clientX, e.clientY).x, y: WB.toWorld(e.clientX, e.clientY).y }, head: 'end', style: 'solid' }; lineAct = { kind: 'new', except: id }; WB.scheduleLines(); return; }
      lineAct = { kind, id, c, before: WB.clone(c.data) };
      return;
    }

    // Eingabefelder und Bedienelemente in Karten
    if (e.target.closest('[contenteditable]') || e.target.closest('input, textarea, select, video, audio, iframe')) return;
    if (e.target.closest('.ll')) { const lb = e.target.closest('.ll'); WB.selectOnly(lb.dataset.label); return; }
    if (e.target.closest('[data-act]')) return;

    if (S.editing) WB.stopEdit();

    // Pfeil Werkzeug
    if (S.tool === 'line') {
      e.preventDefault();
      canvas.setPointerCapture(e.pointerId);
      const from = endFromPoint(e.clientX, e.clientY);
      const p = WB.toWorld(e.clientX, e.clientY);
      S.lineDraft = { from, to: { x: p.x, y: p.y }, head: 'end', style: 'solid' };
      lineAct = { kind: 'new', except: from.card, tool: true, sx: e.clientX, sy: e.clientY };
      WB.scheduleLines();
      return;
    }

    const lineHit = e.target.closest('[data-line]');
    const cardEl = e.target.closest('.card');
    const id = lineHit ? lineHit.dataset.line : cardEl ? cardEl.dataset.id : null;

    if (id && S.cards.has(id)) {
      const wasSel = S.sel.has(id);
      const add = e.shiftKey || e.metaKey || e.ctrlKey;
      const touch = isTouchEv(e);
      if (!touch) {
        if (add) { if (wasSel) S.sel.delete(id); else S.sel.add(id); WB.paintSelection(); }
        else if (!wasSel) WB.selectOnly(id);
      }
      if (touch) e.preventDefault();  // keine nachgeschobenen Mausereignisse, die den Fokus wegnehmen
      press = { id, wasSel, add, touch, x: e.clientX, y: e.clientY, target: e.target, pointerId: e.pointerId, vx: S.view.x, vy: S.view.y, panning: false };
      if (touch && !wasSel) longT = setTimeout(() => { if (press && !press.panning) { WB.selectOnly(id); press.wasSel = true; press.long = true; startDrag(e); } }, 380);
      if (!touch) canvas.setPointerCapture(e.pointerId);
      return;
    }

    // Leere Fläche
    if (isTouchEv(e)) {
      e.preventDefault();
      pan = { x: e.clientX, y: e.clientY, vx: S.view.x, vy: S.view.y, tap: true, sx: e.clientX, sy: e.clientY };
      return;
    }
    canvas.setPointerCapture(e.pointerId);
    canvas.focus({ preventScroll: true });
    marq = { x0: e.clientX, y0: e.clientY, base: e.shiftKey ? new Set(S.sel) : new Set() };
    if (!e.shiftKey) { S.sel.clear(); WB.paintSelection(); }
  });

  window.addEventListener('pointermove', e => {
    if (pts.has(e.pointerId)) pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (e.pointerType === 'mouse' && WB.hasPeers() && Date.now() - cursorT > 50 && e.target.closest && e.target.closest('#canvas')) {
      cursorT = Date.now();
      const p = WB.toWorld(e.clientX, e.clientY);
      WB.liveSend({ t: 'c', x: Math.round(p.x), y: Math.round(p.y) });
    }
    if (pinch && pts.size === 2) {
      const [a, b] = [...pts.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
      const r = canvas.getBoundingClientRect();
      const wx = (pinch.cx - r.left - S.view.x) / S.view.z, wy = (pinch.cy - r.top - S.view.y) / S.view.z;
      const z = clamp(pinch.z * (d / pinch.d), MIN_Z, MAX_Z);
      WB.setView({ z, x: cx - r.left - wx * z, y: cy - r.top - wy * z });
      pinch.cx = cx; pinch.cy = cy;
      return;
    }
    if (pan) {
      const dx = e.clientX - pan.x, dy = e.clientY - pan.y;
      if (pan.tap && Math.hypot(e.clientX - pan.sx, e.clientY - pan.sy) > 8) pan.tap = false;
      if (!pan.tap) { stopFollow(); WB.setView({ x: pan.vx + dx, y: pan.vy + dy }); }
      return;
    }
    if (rz) {
      const c = rz.c;
      const w = clamp(rz.w0 + (e.clientX - rz.x0) / S.view.z, c.type === 'swatch' ? 90 : 120, 2400);
      const el = S.els.get(rz.id);
      if (el) el.style.width = `${Math.round(w / GRID) * GRID}px`;
      WB.paintHandles(); WB.scheduleLines(); WB.placeCtx && WB.placeCtx();
      return;
    }
    if (lineAct) {
      const p = WB.toWorld(e.clientX, e.clientY);
      if (lineAct.kind === 'new') { S.lineDraft.to = endFromPoint(e.clientX, e.clientY, lineAct.except); if (!S.lineDraft.to.card) { S.lineDraft.to = { x: p.x, y: p.y }; } hover(e); }
      else if (lineAct.kind === 'mid') {
        const g = lineGeom(lineAct.c);
        if (g) lineAct.c.data.bend = Math.round((p.x - g.mid0.x) * g.nx + (p.y - g.mid0.y) * g.ny);
      } else {
        const other = lineAct.kind === 'from' ? lineAct.c.data.to : lineAct.c.data.from;
        const end = endFromPoint(e.clientX, e.clientY, other && other.card);
        lineAct.c.data[lineAct.kind] = end.card ? { card: end.card } : { x: p.x, y: p.y };
        hover(e);
      }
      WB.scheduleLines();
      return;
    }
    if (marq) {
      const x = Math.min(e.clientX, marq.x0), y = Math.min(e.clientY, marq.y0), w = Math.abs(e.clientX - marq.x0), h = Math.abs(e.clientY - marq.y0);
      if (w + h < 4) return;
      marquee.hidden = false;
      const o = canvas.getBoundingClientRect();
      marquee.style.cssText = `left:${x - o.left}px;top:${y - o.top}px;width:${w}px;height:${h}px`;
      const a = WB.toWorld(x, y), b = WB.toWorld(x + w, y + h);
      const next = new Set(marq.base);
      for (const c of S.cards.values()) {
        if (c.parent) continue;
        if (c.type === 'line') {
          const g = lineGeom(c);
          if (g && g.a.x >= a.x && g.a.x <= b.x && g.a.y >= a.y && g.a.y <= b.y && g.b.x >= a.x && g.b.x <= b.x && g.b.y >= a.y && g.b.y <= b.y) next.add(c.id);
          continue;
        }
        const r = rectOf(c.id);
        if (r && r.x < b.x && r.x + r.w > a.x && r.y < b.y && r.y + r.h > a.y) next.add(c.id);
      }
      if (next.size !== S.sel.size || [...next].some(i => !S.sel.has(i))) { S.sel = next; WB.paintSelection(); }
      return;
    }
    if (S.drag) { moveDrag(e); return; }
    if (press) {
      const dist = Math.hypot(e.clientX - press.x, e.clientY - press.y);
      if (dist < (press.touch ? 8 : 4)) return;
      clearTimeout(longT);
      if (press.touch && !press.wasSel) {
        press.panning = true;
        WB.setView({ x: press.vx + e.clientX - press.x, y: press.vy + e.clientY - press.y });
        stopFollow();
        return;
      }
      if (press.add) return;
      startDrag(e);
      if (S.drag) moveDrag(e);
    }
  });

  let hoverEl = null;
  function hover(e) {
    const under = document.elementFromPoint(e.clientX, e.clientY);
    const card = under && under.closest && under.closest('.card');
    if (hoverEl && hoverEl !== card) hoverEl.classList.remove('drop-into');
    if (card) card.classList.add('drop-into');
    hoverEl = card || null;
  }
  const clearHover = () => { if (hoverEl) hoverEl.classList.remove('drop-into'); hoverEl = null; };

  function finishPointer(e) {
    const wasPts = pts.size;
    pts.delete(e.pointerId);
    if (pinch) { if (pts.size < 2) pinch = null; return; }
    if (wasPts > 1) return;
    clearTimeout(longT);
    if (pan) {
      const tap = pan.tap;
      pan = null;
      canvas.classList.remove('grabbing');
      if (tap) {
        const now = Date.now();
        if (now - lastTap.t < 320 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 24) { lastTap.t = 0; onDouble(e, null); }
        else { lastTap = { t: now, x: e.clientX, y: e.clientY }; if (S.sel.size) { S.sel.clear(); WB.paintSelection(); } }
      }
      return;
    }
    if (rz) {
      const { id, c } = rz;
      rz = null;
      gestureEnd = Date.now();
      const el = S.els.get(id);
      const w = parseFloat(el.style.width);
      if (w && w !== c.w) { WB.commit([{ op: 'set', id, patch: { w } }]); measure(c); }
      return;
    }
    if (lineAct) {
      const act = lineAct;
      lineAct = null;
      gestureEnd = Date.now();
      clearHover();
      if (act.kind === 'new') finishNewLine(e, act);
      else if (act.kind === 'mid') {
        const v = act.c.data.bend || 0;
        act.c.data = act.before;
        WB.commit([{ op: 'set', id: act.id, patch: { data: { bend: v } } }]);
      } else {
        const now = act.c.data[act.kind];
        act.c.data = act.before;
        const old = act.before[act.kind] || {};
        const patchEnd = now.card ? { card: now.card, x: null, y: null } : { card: null, x: Math.round(now.x), y: Math.round(now.y) };
        if (JSON.stringify(old) !== JSON.stringify(now)) WB.commit([{ op: 'set', id: act.id, patch: { data: { [act.kind]: patchEnd } } }]);
        else WB.scheduleLines();
      }
      return;
    }
    if (marq) { if (!marquee.hidden) gestureEnd = Date.now(); marq = null; marquee.hidden = true; WB.paintCtx && WB.paintCtx(); return; }
    if (S.drag) { gestureEnd = Date.now(); endDrag(e); press = null; return; }
    if (press) {
      const p = press;
      press = null;
      if (p.panning) return;
      if (p.touch) {
        const now = Date.now();
        if (now - lastTap.t < 320 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 24) { lastTap.t = 0; onDouble(e, p.target); return; }
        lastTap = { t: now, x: e.clientX, y: e.clientY };
        if (!p.wasSel) { WB.selectOnly(p.id); return; }
      }
      if (!p.wasSel || p.add) return;
      if (S.sel.size > 1) { WB.selectOnly(p.id); return; }
      // Klick auf schon gewählte Karte: schreiben. Kurz warten, ob es ein Doppelklick wird.
      const target = p.target, pt = { x: e.clientX, y: e.clientY };
      clearTimeout(clickT);
      if (p.touch) editAt(p.id, target, pt);
      else clickT = setTimeout(() => editAt(p.id, target, pt), 210);
    }
  }
  window.addEventListener('pointerup', finishPointer);
  window.addEventListener('pointercancel', e => { pts.delete(e.pointerId); pan = null; pinch = null; canvas.classList.remove('grabbing'); cancelGesture(); });

  function editAt(id, target, pt) {
    const c = S.cards.get(id), el = S.els.get(id);
    if (!c || !el || S.editing === id) return;
    if (c.type === 'line') return WB.editLineLabel(id);
    if (c.type === 'board' && !(target && target.closest('[data-edit]'))) return;
    const inCard = target && target.closest && target.closest('.card');
    const f = (target && target.closest && inCard === el && target.closest('[data-edit]')) || (c.type === 'column' || c.type === 'table' ? null : el.querySelector('[data-edit]'));
    if (f) WB.startEdit(c, f, pt);
  }

  function onDouble(e, target) {
    clearTimeout(clickT);
    const t = target || e.target;
    if (t.closest && t.closest('[data-line]')) { WB.editLineLabel(t.closest('[data-line]').dataset.line); return; }
    const el = t.closest && t.closest('.card');
    if (!el) {
      if (t.closest && t.closest('#tools, #top, #dock, #ctx, #fmt, #empty')) return;
      const p = WB.toWorld(e.clientX, e.clientY);
      WB.addCard('note', { x: p.x - 20, y: p.y - 24 });
      return;
    }
    const c = S.cards.get(el.dataset.id);
    if (!c) return;
    if (c.type === 'board') { if (c.data.board) WB.openBoard(c.data.board); return; }
    if (c.type === 'image') { WB.lightbox(c); return; }
    if (c.type === 'sketch') { WB.sketchEditor(c); return; }
    if (t.closest('[contenteditable]')) return;
    editAt(c.id, t, { x: e.clientX, y: e.clientY });
  }
  // Beim Ziehen hat die Fläche den Zeiger gefangen, darum zählt, was wirklich unter dem Zeiger liegt.
  canvas.addEventListener('dblclick', e => {
    if (Date.now() - gestureEnd < 350) return;  // Safari meldet Klick plus Ziehen sonst als Doppelklick
    const t = document.elementFromPoint(e.clientX, e.clientY) || e.target;
    if (t.closest('[data-act], input, textarea, video, audio, iframe, .hd')) return;
    onDouble(e, t);
  });

  function finishNewLine(e, act) {
    const draft = S.lineDraft;
    S.lineDraft = null;
    const tool = act.tool;
    if (tool) WB.setTool(null);
    const far = act.sx === undefined || Math.hypot(e.clientX - act.sx, e.clientY - act.sy) > 14;
    let to = endFromPoint(e.clientX, e.clientY, act.except);
    const from = { ...draft.from };
    if (!far && tool) {
      const p = from.card ? rectOf(from.card) : from;
      to = { card: null, x: Math.round((from.card ? p.x + p.w : p.x) + 180), y: Math.round(from.card ? p.y + p.h / 2 : p.y) };
    } else if (!far) { WB.scheduleLines(); return; }
    if (from.card === to.card && from.card) { WB.scheduleLines(); return; }
    const clean = o => (o.card ? { card: o.card } : { x: Math.round(o.x), y: Math.round(o.y) });
    const id = WB.rid();
    WB.commit([{ op: 'add', card: { id, type: 'line', x: 0, y: 0, w: 0, z: 0, data: { from: clean(from), to: clean(to), head: 'end', style: 'solid' } } }]);
    WB.selectOnly(id);
  }

  /* ---------- Karten ziehen ---------- */
  function startDrag(e) {
    if (!press) return;
    const ids = [...S.sel].filter(id => {
      const c = S.cards.get(id);
      return c && !(c.parent && S.sel.has(c.parent));
    });
    if (!ids.length) return;
    const items = [];
    for (const id of ids) {
      const c = S.cards.get(id);
      if (c.type === 'line') { items.push({ id, c, line: true, from: WB.clone(c.data.from), to: WB.clone(c.data.to) }); continue; }
      const el = S.els.get(id);
      const r = rectOf(id);
      if (!el || !r) continue;
      if (c.parent) {
        el.style.width = `${r.w}px`;
        cardsEl.appendChild(el);
      }
      el.style.left = `${r.x}px`; el.style.top = `${r.y}px`;
      el.classList.add('dragging');
      items.push({ id, c, el, x0: r.x, y0: r.y, w: r.w, h: r.h, parent: c.parent });
    }
    const movingCards = items.filter(i => !i.line);
    const others = [];
    for (const c of S.cards.values()) {
      if (c.parent || c.type === 'line' || S.sel.has(c.id)) continue;
      const r = rectOf(c.id);
      if (r) others.push(r);
    }
    const bx = movingCards.length ? Math.min(...movingCards.map(i => i.x0)) : 0;
    const by = movingCards.length ? Math.min(...movingCards.map(i => i.y0)) : 0;
    const bw = movingCards.length ? Math.max(...movingCards.map(i => i.x0 + i.w)) - bx : 0;
    const bh = movingCards.length ? Math.max(...movingCards.map(i => i.y0 + i.h)) - by : 0;
    const p0 = WB.toWorld(press.x, press.y);
    S.drag = { ids: new Set(ids), items, p0, box: { x: bx, y: by, w: bw, h: bh }, others, col: null, idx: 0, intoBoard: null, moved: false, sent: 0, onlyCards: items.every(i => !i.line && i.c.type !== 'column') };
    WB.paintHandles();
    WB.paintCtx && WB.paintCtx();
    document.body.classList.add('is-dragging');
    canvas.setPointerCapture(press.pointerId);
  }

  function snap(d, dx, dy, alt) {
    gx.hidden = true; gy.hidden = true;
    if (alt || !d.items.some(i => !i.line)) return { dx, dy };
    const T = 7 / S.view.z;
    const b = d.box;
    let bestX = T, sx = null, gxAt = 0, bestY = T, sy = null, gyAt = 0;
    const xs = [b.x + dx, b.x + dx + b.w / 2, b.x + dx + b.w], ys = [b.y + dy, b.y + dy + b.h / 2, b.y + dy + b.h];
    for (const o of d.others) {
      for (const v of [o.x, o.x + o.w / 2, o.x + o.w]) for (const m of xs) { const k = Math.abs(v - m); if (k < bestX) { bestX = k; sx = v - m; gxAt = v; } }
      for (const v of [o.y, o.y + o.h / 2, o.y + o.h]) for (const m of ys) { const k = Math.abs(v - m); if (k < bestY) { bestY = k; sy = v - m; gyAt = v; } }
    }
    let ndx, ndy;
    if (sx !== null) { ndx = dx + sx; place(gx, gxAt, 0); } else ndx = Math.round((b.x + dx) / GRID) * GRID - b.x;
    if (sy !== null) { ndy = dy + sy; place(gy, 0, gyAt); } else ndy = Math.round((b.y + dy) / GRID) * GRID - b.y;
    return { dx: ndx, dy: ndy };
  }

  function moveDrag(e) {
    const d = S.drag;
    if (!d) return;
    d.moved = true;
    const p = WB.toWorld(e.clientX, e.clientY);
    const s = snap(d, p.x - d.p0.x, p.y - d.p0.y, e.altKey);
    d.dx = s.dx; d.dy = s.dy;
    for (const it of d.items) {
      if (it.line) {
        const data = it.c.data;
        if (!it.from.card) data.from = { x: it.from.x + s.dx, y: it.from.y + s.dy };
        if (!it.to.card) data.to = { x: it.to.x + s.dx, y: it.to.y + s.dy };
      } else { it.el.style.left = `${it.x0 + s.dx}px`; it.el.style.top = `${it.y0 + s.dy}px`; }
    }
    WB.scheduleLines();
    if (WB.hasPeers() && Date.now() - d.sent > 45) { d.sent = Date.now(); WB.liveSend({ t: 'm', ids: d.items.filter(i => !i.line).map(i => i.id).slice(0, 60), dx: Math.round(s.dx), dy: Math.round(s.dy) }); }

    // Ziel: Spalte, Unterboard oder Brotkrume
    const under = document.elementFromPoint(e.clientX, e.clientY);
    const crumb = under && under.closest && under.closest('[data-crumb]');
    const cardEl = under && under.closest && under.closest('.card');
    const colEl = cardEl && (cardEl.classList.contains('t-column') ? cardEl : cardEl.closest('.t-column'));
    const noLines = d.items.every(i => !i.line);
    clearMarks(d);
    if (crumb && noLines) { crumb.classList.add('drop-into'); d.intoBoard = crumb.dataset.crumb; d.crumbEl = crumb; return; }
    if (cardEl && cardEl.classList.contains('t-board') && noLines && !d.ids.has(cardEl.dataset.id)) {
      const b = S.cards.get(cardEl.dataset.id);
      if (b && b.data.board) { cardEl.classList.add('drop-into'); d.intoBoard = b.data.board; d.boardEl = cardEl; return; }
    }
    if (colEl && d.onlyCards && !colEl.classList.contains('folded') && !d.items.some(i => i.c.type === 'board')) {
      const list = colEl.querySelector(':scope > .col-list');
      colEl.classList.add('drop-into');
      const kids = [...list.children].filter(k => k.classList.contains('card'));
      let idx = kids.length;
      for (let i = 0; i < kids.length; i++) { const r = kids[i].getBoundingClientRect(); if (e.clientY < r.top + r.height / 2) { idx = i; break; } }
      d.col = colEl.dataset.id; d.idx = idx; d.colEl = colEl;
      if (!d.marker) { d.marker = document.createElement('div'); d.marker.className = 'col-marker'; }
      list.insertBefore(d.marker, kids[idx] || null);
    }
  }
  function clearMarks(d) {
    if (d.crumbEl) d.crumbEl.classList.remove('drop-into');
    if (d.boardEl) d.boardEl.classList.remove('drop-into');
    if (d.colEl) d.colEl.classList.remove('drop-into');
    if (d.marker && d.marker.parentNode) d.marker.remove();
    d.intoBoard = null; d.col = null; d.crumbEl = null; d.boardEl = null; d.colEl = null;
  }
  function restoreLineItems(d) { for (const it of d.items) if (it.line) { it.c.data.from = it.from; it.c.data.to = it.to; } }

  function endDrag() {
    const d = S.drag;
    const { dx = 0, dy = 0, col, idx, intoBoard, moved } = d;
    clearMarks(d);
    gx.hidden = true; gy.hidden = true;
    document.body.classList.remove('is-dragging');
    S.drag = null;
    for (const it of d.items) if (it.el) it.el.classList.remove('dragging');
    restoreLineItems(d);
    if (WB.hasPeers()) WB.liveSend({ t: 'm', ids: [], end: true });
    if (!moved) { d.items.forEach(it => { if (!it.line) WB.renderCard(it.c); if (it.c.parent) WB.sortColumn(it.c.parent); }); WB.paintSelection(); return; }
    if (intoBoard) { d.items.forEach(it => { if (!it.line) WB.renderCard(it.c); }); WB.moveCards(d.items.map(i => i.id), intoBoard); return; }
    const ops = [];
    if (col) {
      const siblings = [...S.cards.values()].filter(k => k.parent === col && !d.ids.has(k.id)).sort((a, b) => a.pos - b.pos);
      const before = siblings[idx - 1], after = siblings[idx];
      const lo = before ? before.pos : (after ? after.pos - d.items.length - 1 : 0);
      const hi = after ? after.pos : lo + d.items.length + 1;
      const order = d.items.slice().sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
      order.forEach((it, i) => ops.push({ op: 'set', id: it.id, patch: { parent: col, pos: lo + (hi - lo) * (i + 1) / (order.length + 1) } }));
    } else {
      let z = maxZ();
      for (const it of d.items) {
        if (it.line) {
          const data = {};
          if (!it.from.card) data.from = { x: Math.round(it.from.x + dx), y: Math.round(it.from.y + dy) };
          if (!it.to.card) data.to = { x: Math.round(it.to.x + dx), y: Math.round(it.to.y + dy) };
          if (Object.keys(data).length) ops.push({ op: 'set', id: it.id, patch: { data } });
          continue;
        }
        const patch = { x: Math.round(it.x0 + dx), y: Math.round(it.y0 + dy), z: ++z };
        if (it.parent) { patch.parent = null; patch.w = Math.round(it.w); }
        ops.push({ op: 'set', id: it.id, patch });
      }
    }
    WB.commit(ops);
    d.items.forEach(it => { if (it.el) WB.renderCard(it.c); });
  }
  function cancelDrag() {
    const d = S.drag;
    if (!d) return;
    clearMarks(d);
    gx.hidden = true; gy.hidden = true;
    document.body.classList.remove('is-dragging');
    S.drag = null;
    restoreLineItems(d);
    d.items.forEach(it => { if (it.el) { it.el.classList.remove('dragging'); WB.renderCard(it.c); if (it.c.parent) WB.sortColumn(it.c.parent); } });
    WB.paintSelection();
  }
  WB.cancelDrag = cancelDrag;

  // In ein anderes Board: dort neu anordnen, hier verschwinden. Geht nicht über Rückgängig.
  WB.moveCards = function (ids, to) {
    const list = ids.map(id => S.cards.get(id)).filter(Boolean);
    if (!list.length || !S.board || to === S.board.id) return;
    const rects = list.map(c => ({ c, r: c.type === 'line' ? null : rectOf(c.id) }));
    const minX = Math.min(...rects.filter(x => x.r).map(x => x.r.x), Infinity);
    const minY = Math.min(...rects.filter(x => x.r).map(x => x.r.y), Infinity);
    const items = rects.filter(x => x.r).map(x => ({ id: x.c.id, x: Math.round(80 + x.r.x - minX), y: Math.round(80 + x.r.y - minY) }));
    if (!items.length) return;
    for (const it of items) {
      const kids = [...S.cards.values()].filter(k => k.parent === it.id);
      kids.forEach(k => { S.cards.delete(k.id); WB.dropCard(k.id); });
      const p = S.cards.get(it.id) && S.cards.get(it.id).parent;
      S.cards.delete(it.id); S.sel.delete(it.id); WB.dropCard(it.id);
      if (p) WB.sortColumn(p);
    }
    S.undo.length = 0; S.redo.length = 0;
    if (S.counts[to] !== undefined) {
      S.counts[to] += items.length;
      for (const c of S.cards.values()) if (c.type === 'board' && c.data.board === to) { const el = S.els.get(c.id); if (el) el._key = ''; WB.renderCard(c); }
    }
    WB.send([{ op: 'move', to, items }]);
    WB.afterHistory();
    const name = (S.crumbs.find(x => x.id === to) || {}).title || ([...S.cards.values()].find(c => c.type === 'board' && c.data.board === to) || { data: {} }).data.title || 'das Board';
    WB.toast(`${items.length === 1 ? 'Karte' : `${items.length} Karten`} liegt jetzt in ${name}.`, { label: 'Öffnen', fn: () => WB.openBoard(to) });
  };

  /* ---------- Trackpad und Mausrad ---------- */
  canvas.addEventListener('wheel', e => {
    if (e.target.closest && e.target.closest('.td-list, .tb-wrap, .cm-list') && S.editing) return;
    e.preventDefault();
    stopFollow();
    if (e.ctrlKey || e.metaKey) {
      const f = Math.exp(-e.deltaY * (e.ctrlKey && !e.metaKey ? 0.012 : 0.004));
      WB.zoomAt(e.clientX, e.clientY, S.view.z * f);
    } else {
      WB.setView({ x: S.view.x - (e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX), y: S.view.y - (e.shiftKey && !e.deltaX ? 0 : e.deltaY) });
    }
  }, { passive: false });
  // Safari Pinch
  let gestureZ = 1;
  canvas.addEventListener('gesturestart', e => { e.preventDefault(); gestureZ = S.view.z; });
  canvas.addEventListener('gesturechange', e => { e.preventDefault(); WB.zoomAt(e.clientX, e.clientY, gestureZ * e.scale); });
  canvas.addEventListener('gestureend', e => e.preventDefault());

  /* ---------- Die anderen ---------- */
  const cursors = new Map();
  function peerOf(id) { return S.peers.get(id); }
  WB.moveCursor = function (m) {
    const p = peerOf(m.from);
    if (!p) return;
    let cur = cursors.get(m.from);
    if (!cur) {
      cur = document.createElement('div');
      cur.className = 'pcur';
      cur.innerHTML = `<svg viewBox="0 0 20 22" width="20" height="22" aria-hidden="true"><path d="M3 2l14 8-6.500 2L7 19z" fill="${WB.esc(p.color)}" stroke="#fff" stroke-width="1.500" stroke-linejoin="round"/></svg><span style="background:${WB.esc(p.color)}">${WB.esc(p.name)}</span>`;
      over.appendChild(cur);
      cursors.set(m.from, cur);
    }
    cur.hidden = false;
    cur.style.left = `${m.x}px`; cur.style.top = `${m.y}px`;
    clearTimeout(cur._t);
    cur._t = setTimeout(() => { cur.hidden = true; }, 12000);
  };
  WB.clearCursors = () => { for (const c of cursors.values()) c.remove(); cursors.clear(); };

  WB.paintPeerSelection = function (p) {
    document.querySelectorAll(`[data-peer-id="${CSS.escape(p.id)}"]`).forEach(el => { delete el.dataset.peerId; delete el.dataset.peer; el.style.removeProperty('--peer'); });
    for (const id of p.sel || []) {
      const el = S.els.get(id);
      if (el) { el.dataset.peerId = p.id; el.dataset.peer = p.name; el.style.setProperty('--peer', p.color); }
    }
  };
  WB.paintPeerEdit = function (p) {
    document.querySelectorAll(`[data-peer-edit="${CSS.escape(p.id)}"]`).forEach(el => { delete el.dataset.peerEdit; delete el.dataset.peerTyping; });
    const el = p.edit && S.els.get(p.edit);
    if (el) { el.dataset.peerEdit = p.id; el.dataset.peerTyping = `${p.name} schreibt`; el.style.setProperty('--peer', p.color); }
  };
  WB.removePeerMarks = function (id) {
    WB.paintPeerSelection({ id, sel: [] });
    WB.paintPeerEdit({ id, edit: null });
    const c = cursors.get(id);
    if (c) { c.remove(); cursors.delete(id); }
    clearPeerDragOf(id);
  };

  const peerMoved = new Map();
  function clearPeerDragOf(from) { const s = peerMoved.get(from); if (s) { s.forEach(id => { const el = S.els.get(id); if (el) el.style.transform = ''; }); peerMoved.delete(from); WB.scheduleLines(); } }
  WB.clearPeerDrag = id => { const el = S.els.get(id); if (el) el.style.transform = ''; };
  WB.peerDrag = function (m) {
    if (m.end) { setTimeout(() => clearPeerDragOf(m.from), 700); return; }
    let s = peerMoved.get(m.from);
    if (!s) { s = new Set(); peerMoved.set(m.from, s); }
    for (const id of m.ids || []) {
      const el = S.els.get(id);
      if (el) { el.style.transform = `translate(${m.dx}px,${m.dy}px)`; s.add(id); }
    }
    WB.scheduleLines();
  };
  WB.peerView = function (m) {
    if (S.follow !== m.from) return;
    const r = canvas.getBoundingClientRect();
    WB.setView({ z: m.z, x: r.width / 2 - m.cx * m.z, y: r.height / 2 - m.cy * m.z });
  };

  window.addEventListener('resize', () => { WB.paintHandles(); WB.placeCtx && WB.placeCtx(); });
})();
