/* Social Bites Whiteboard: Werkzeugleiste, Kontextleiste, Dialoge, Upload, Kürzel, Anmeldung. */
(function () {
  'use strict';
  const WB = window.WB;
  const { S, $, esc } = WB;
  const icon = WB.icon;
  const canvas = $('#canvas');
  const SALT = 'SocialBites-Whiteboard-v1';

  /* ---------- Kleine Bausteine ---------- */
  let toastT = null;
  WB.toast = function (msg, action) {
    const t = $('#toast');
    t.innerHTML = `<span>${esc(msg)}</span>${action ? `<button type="button">${esc(action.label)}</button>` : ''}`;
    t.classList.add('on');
    if (action) t.querySelector('button').onclick = () => { t.classList.remove('on'); action.fn(); };
    clearTimeout(toastT);
    toastT = setTimeout(() => t.classList.remove('on'), action ? 7000 : 3200);
  };
  const copyText = async (s, msg) => {
    try { await navigator.clipboard.writeText(s); WB.toast(msg || 'Kopiert.'); } catch (_) { WB.toast('Kopieren ging nicht, bitte markieren und kopieren.'); }
  };

  const dlg = $('#dlg');
  WB.dialog = function ({ title, body, cls = '', wide = false }) {
    dlg.className = `${cls}${wide ? ' wide' : ''}`;
    dlg.innerHTML = `${title ? `<header><h2>${esc(title)}</h2><button class="tb ico" type="button" data-close aria-label="Schließen">${icon('close', 20)}</button></header>` : ''}<div class="dlg-body">${body}</div>`;
    if (!dlg.open) dlg.showModal();
    dlg.querySelectorAll('[data-close]').forEach(b => { b.onclick = () => dlg.close(); });
    return dlg;
  };
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });

  const pop = $('#pop');
  WB.closePop = () => { pop.hidden = true; pop.innerHTML = ''; };
  WB.openPop = function (anchor, html, onClick) {
    pop.innerHTML = html;
    pop.hidden = false;
    const a = anchor.getBoundingClientRect();
    const p = pop.getBoundingClientRect();
    const left = Math.max(8, Math.min(window.innerWidth - p.width - 8, a.left + a.width / 2 - p.width / 2));
    const top = a.bottom + p.height + 12 < window.innerHeight ? a.bottom + 8 : Math.max(8, a.top - p.height - 8);
    pop.style.left = `${left}px`; pop.style.top = `${top}px`;
    pop.onclick = e => { const b = e.target.closest('[data-v]'); if (b) onClick(b.dataset.v, b); };
  };
  document.addEventListener('pointerdown', e => { if (!pop.hidden && !e.target.closest('#pop') && !e.target.closest('[data-pop]')) WB.closePop(); }, true);

  /* ---------- Karte aus Werkzeug ---------- */
  const TOOLS = [
    ['note', 'Notiz', 'N'], ['link', 'Link', 'L'], ['todo', 'To-do', 'T'], ['line', 'Pfeil', 'P'], ['board', 'Board', 'B'], ['column', 'Spalte', 'C'],
    null,
    ['comment', 'Kommentar', 'M'], ['table', 'Tabelle', 'A'], ['image', 'Bild', 'I'], ['upload', 'Upload', 'U'], ['sketch', 'Skizze', 'D'], ['swatch', 'Farbe', 'K'],
  ];
  const toolsEl = $('#tools');
  toolsEl.innerHTML = TOOLS.map(t => (t ? `<button class="tool" type="button" data-tool="${t[0]}" title="${esc(t[1])} (${t[2]})">${icon(t[0], 22)}<span>${esc(t[1])}</span></button>` : '<span class="tool-sep"></span>')).join('');

  WB.setTool = function (tool) {
    S.tool = tool;
    canvas.classList.toggle('tool-line', tool === 'line');
    toolsEl.querySelectorAll('.tool').forEach(b => b.classList.toggle('on', b.dataset.tool === tool));
    if (tool === 'line') WB.toast('Von einer Karte zur nächsten ziehen.');
  };
  const filePick = $('#filePick');
  let pickAt = null;
  function openPicker(accept, at) { pickAt = at || null; filePick.accept = accept; filePick.value = ''; filePick.click(); }
  filePick.addEventListener('change', () => { if (filePick.files.length) WB.addFiles([...filePick.files], pickAt); });

  function useTool(tool, at) {
    switch (tool) {
      case 'line': WB.setTool(S.tool === 'line' ? null : 'line'); break;
      case 'image': openPicker('image/*', at); break;
      case 'upload': openPicker('', at); break;
      case 'sketch': { const c = WB.addCard('sketch', { edit: false, ...(at || {}) }); WB.sketchEditor(c, true); break; }
      default: WB.addCard(tool, at || {});
    }
  }
  // Klicken legt an, Ziehen auf die Fläche legt genau dort an.
  let toolDrag = null;
  toolsEl.addEventListener('pointerdown', e => {
    const b = e.target.closest('.tool');
    if (!b) return;
    toolDrag = { tool: b.dataset.tool, x: e.clientX, y: e.clientY, id: e.pointerId, moved: false, touch: e.pointerType !== 'mouse' };
  });
  window.addEventListener('pointermove', e => {
    if (!toolDrag || e.pointerId !== toolDrag.id) return;
    if (toolDrag.touch) return;  // auf dem Handy scrollt die Leiste
    if (!toolDrag.moved && Math.hypot(e.clientX - toolDrag.x, e.clientY - toolDrag.y) > 6) {
      toolDrag.moved = true;
      const g = document.createElement('div');
      g.id = 'toolGhost';
      g.innerHTML = icon(toolDrag.tool, 22);
      document.body.appendChild(g);
      toolDrag.g = g;
    }
    if (toolDrag.g) { toolDrag.g.style.left = `${e.clientX}px`; toolDrag.g.style.top = `${e.clientY}px`; }
  });
  window.addEventListener('pointerup', e => {
    if (!toolDrag || e.pointerId !== toolDrag.id) return;
    const d = toolDrag;
    toolDrag = null;
    if (d.g) d.g.remove();
    if (d.moved) {
      const under = document.elementFromPoint(e.clientX, e.clientY);
      skipClick = true;
      setTimeout(() => { skipClick = false; }, 0);  // endete das Ziehen außerhalb, kommt gar kein click
      if (!under || !under.closest('#canvas')) return;
      const p = WB.toWorld(e.clientX, e.clientY);
      const w = WB.CARD_DEFAULT[d.tool] || 260;
      if (d.tool === 'line') { WB.setTool('line'); return; }
      useTool(d.tool, { x: p.x - w / 2, y: p.y - 24 });
    }
  });
  window.addEventListener('pointercancel', () => { if (toolDrag && toolDrag.g) toolDrag.g.remove(); toolDrag = null; });
  // Erst im click anlegen: Auf Touch käme der Fokus sonst sofort zurück auf den Knopf und die neue Karte wäre wieder weg.
  let skipClick = false;
  toolsEl.addEventListener('click', e => {
    const b = e.target.closest('.tool');
    if (!b) return;
    if (skipClick) { skipClick = false; return; }
    useTool(b.dataset.tool);
  });

  /* ---------- Kopfzeile ---------- */
  const crumbsEl = $('#crumbs');
  WB.paintCrumbs = function () {
    if (!S.board) return;
    const parts = S.crumbs.map(c => `<a href="#b=${esc(c.id)}" data-crumb="${esc(c.id)}" class="crumb">${c.id === 'home' ? '<img src="mouth.webp" alt="" width="12" height="23" data-logo-fixed>' : ''}<span>${esc(c.title)}</span></a><i class="crumb-sep">/</i>`).join('');
    const isHome = S.board.id === 'home';
    crumbsEl.innerHTML = `${parts}<button class="crumb cur" type="button" id="crumbNow" title="${isHome ? '' : 'Umbenennen'}" ${isHome ? 'disabled' : ''}>${isHome ? '<img src="mouth.webp" alt="" width="12" height="23" data-logo-fixed>' : ''}<span>${esc(S.board.title)}</span></button>`;
    const parent = S.crumbs[S.crumbs.length - 1];
    crumbsEl.classList.toggle('has-parent', !!parent);
    document.title = `${S.board.title} · Whiteboard`;
    const now = $('#crumbNow');
    if (!isHome) now.onclick = renameBoard;
  };
  function renameBoard() {
    const span = $('#crumbNow span');
    if (!span) return;
    const before = S.board.title;
    span.contentEditable = 'plaintext-only' in document.createElement('div') ? 'true' : 'true';
    span.focus();
    const r = document.createRange(); r.selectNodeContents(span);
    const sl = window.getSelection(); sl.removeAllRanges(); sl.addRange(r);
    const done = () => {
      span.removeEventListener('blur', done);
      span.removeAttribute('contenteditable');
      const v = span.textContent.trim() || before;
      if (v !== before) WB.commit([{ op: 'board', patch: { title: v } }]);
      else WB.paintCrumbs();
    };
    span.addEventListener('blur', done);
    span.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); span.blur(); } if (e.key === 'Escape') { span.textContent = before; span.blur(); } });
  }
  crumbsEl.addEventListener('click', e => {
    const a = e.target.closest('a[data-crumb]');
    if (a) { e.preventDefault(); WB.openBoard(a.dataset.crumb); }
  });

  const syncEl = $('#sync');
  let syncT = null;
  WB.setSync = function (st) {
    clearTimeout(syncT);
    syncEl.dataset.st = st;
    syncEl.textContent = st === 'saving' ? 'Speichert' : st === 'offline' ? 'Offline, wird nachgeholt' : 'Gespeichert';
    syncEl.classList.add('on');
    if (st === 'saved') syncT = setTimeout(() => syncEl.classList.remove('on'), 1800);
  };
  WB.setLive = v => { $('#stage').classList.toggle('not-live', !v); };

  /* ---------- Wer ist da ---------- */
  const peersEl = $('#peers');
  const initials = n => String(n || '?').trim().split(/\s+/).map(s => s[0]).slice(0, 2).join('').toUpperCase();
  let botUntil = {};
  WB.paintPeers = function () {
    const seen = new Map();
    for (const p of S.peers.values()) if (!seen.has(p.name)) seen.set(p.name, p);
    const now = Date.now();
    const bots = Object.entries(botUntil).filter(([, t]) => t > now).map(([n]) => n);
    const me = S.me ? `<button class="av me" type="button" id="meAv" style="--c:${esc(S.me.color)}" title="Du: ${esc(S.me.name)}">${esc(initials(S.me.name))}</button>` : '';
    peersEl.innerHTML = bots.map(n => `<span class="av bot" style="--c:${esc(WB.colorFor(n))}" title="${esc(n)} schreibt gerade mit">${icon('claude', 15)}</span>`).join('')
      + [...seen.values()].map(p => `<button class="av${S.follow === p.id ? ' follow' : ''}" type="button" data-peer="${esc(p.id)}" style="--c:${esc(p.color)}" title="${S.follow === p.id ? `Du folgst ${esc(p.name)}. Klick beendet das.` : `${esc(p.name)} folgen`}">${esc(initials(p.name))}</button>`).join('') + me;
  };
  peersEl.addEventListener('click', e => {
    const b = e.target.closest('[data-peer]');
    if (b) {
      const id = b.dataset.peer;
      S.follow = S.follow === id ? null : id;
      WB.paintPeers();
      if (S.follow) WB.toast(`Du folgst ${S.peers.get(id).name}. Selbst schieben beendet das.`);
      return;
    }
    if (e.target.closest('#meAv')) changeName();
  });
  WB.botNotice = function (by, cards) {
    botUntil[by] = Date.now() + 12000;
    WB.paintPeers();
    setTimeout(() => WB.paintPeers(), 12100);
    WB.toast(`${by} hat ${cards.length === 1 ? 'eine Karte' : `${cards.length} Karten`} ergänzt.`, { label: 'Zeigen', fn: () => WB.focusCard(cards[0].id) });
  };

  /* ---------- Unten: Zoom, Rückgängig, Papierkorb ---------- */
  $('#btnUndo').innerHTML = icon('undo', 20); $('#btnRedo').innerHTML = icon('redo', 20); $('#btnHand').innerHTML = icon('hand', 20);
  $('#btnZoomOut').innerHTML = icon('minus', 20); $('#btnZoomIn').innerHTML = icon('plus', 20); $('#btnFit').innerHTML = icon('fit', 20);
  $('#btnSearch').innerHTML = icon('search', 20); $('#btnMenu').innerHTML = icon('more', 20); $('#btnLink').innerHTML = icon('link', 20);
  $('#btnCall').innerHTML = `${icon('call', 18)}<span>Call</span>`;
  $('#btnUndo').onclick = () => WB.undo(); $('#btnRedo').onclick = () => WB.redo();
  $('#btnZoomOut').onclick = () => WB.zoomBy(1 / 1.25); $('#btnZoomIn').onclick = () => WB.zoomBy(1.25);
  $('#btnZoom').onclick = () => { const r = canvas.getBoundingClientRect(); WB.zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1); };
  $('#btnFit').onclick = () => WB.fit();
  const setHand = v => { S.hand = v; $('#btnHand').setAttribute('aria-pressed', String(v)); canvas.classList.toggle('panning', v); };
  $('#btnHand').onclick = () => setHand(!S.hand);
  $('#btnLink').onclick = () => copyText(`${location.origin}${location.pathname}#b=${S.board.id}`, 'Link kopiert.');
  WB.paintZoom = () => { $('#btnZoom').textContent = `${Math.round(S.view.z * 100)} %`; };
  WB.paintDock = () => { $('#btnUndo').disabled = !S.undo.length; $('#btnRedo').disabled = !S.redo.length; };
  WB.paintTrash = () => { const b = $('#btnTrash'); b.innerHTML = `${icon('trash', 20)}${S.trash ? `<b>${S.trash > 99 ? '99+' : S.trash}</b>` : ''}`; };
  $('#btnTrash').onclick = () => openTrash();

  /* ---------- Leerer Zustand und Vorlagen ---------- */
  let templates = null;
  WB.paintEmpty = async function () {
    const el = $('#empty');
    const empty = S.board && ![...S.cards.values()].length;
    el.hidden = !empty;
    if (!empty) return;
    if (!templates) { try { templates = (await WB.api('/templates')).templates; } catch (_) { templates = []; } }
    const touch = matchMedia('(pointer: coarse)').matches;
    el.innerHTML = `<h2>${touch ? 'Doppelt tippen.' : 'Doppelklick.'}<br>Und los.</h2><p>Oder eine Vorlage nehmen, Dateien reinziehen, Text einfügen.</p>
      <div class="tpl">${templates.map(t => `<button type="button" data-tpl="${esc(t.id)}" title="${esc(t.desc)}"><b>${esc(t.name)}</b><span>${esc(t.desc)}</span></button>`).join('')}</div>`;
  };
  $('#empty').addEventListener('click', e => { const b = e.target.closest('[data-tpl]'); if (b) applyTemplate(b.dataset.tpl); });
  async function applyTemplate(id) {
    try {
      const r = await WB.api(`/boards/${S.board.id}/template`, { method: 'POST', body: { template: id, title: S.board.id === 'home' ? undefined : S.board.title } });
      WB.applyServerCards(r.cards);
      S.rev = r.rev;
      requestAnimationFrame(() => WB.fit());
    } catch (e) { WB.toast(e.message); }
  }

  /* ---------- Kontextleiste ---------- */
  const ctx = $('#ctx');
  const btn = (cmd, ic, label, extra = '') => `<button class="cb" type="button" data-cmd="${cmd}" title="${esc(label)}" aria-label="${esc(label)}" ${extra}>${icon(ic, 19)}</button>`;
  const txt = (cmd, label, extra = '') => `<button class="cb cb-t" type="button" data-cmd="${cmd}" ${extra}>${esc(label)}</button>`;
  const sep = '<span class="cb-sep"></span>';
  const COLORABLE = new Set(['note', 'todo', 'column', 'comment', 'link', 'table', 'board', 'file']);

  WB.paintCtx = function () {
    const cards = [...S.sel].map(id => S.cards.get(id)).filter(Boolean);
    const richEdit = S.editField && S.editField.dataset.rich;
    if (!cards.length || S.drag || richEdit) { ctx.hidden = true; return; }
    const one = cards.length === 1 ? cards[0] : null;
    let h = '';
    if (one) {
      const d = one.data;
      switch (one.type) {
        case 'board': h += txt('open-board', 'Öffnen') + btn('board-icon', 'star', 'Symbol') + btn('rename', 'pencil', 'Umbenennen'); break;
        case 'link': if (d.url) h += btn('link-go', 'open', 'Link öffnen') + btn('link-refresh', 'refresh', 'Vorschau neu holen') + btn('link-edit', 'pencil', 'Link ändern'); break;
        case 'image': h += btn('image-big', 'expand', 'Groß ansehen') + btn('image-down', 'download', 'Herunterladen') + btn('image-palette', 'palette', 'Farben aus dem Bild holen') + btn('image-caption', 'label', 'Bildtext'); break;
        case 'file': h += btn('file-down', 'download', 'Herunterladen'); break;
        case 'sketch': h += txt('sketch-edit', 'Zeichnen'); break;
        case 'table': h += txt('tb-addrow', '+ Zeile') + txt('tb-addcol', '+ Spalte') + txt('tb-delrow', '− Zeile') + txt('tb-delcol', '− Spalte') + txt('tb-head', d.header === false ? 'Kopfzeile an' : 'Kopfzeile aus'); break;
        case 'swatch': h += btn('swatch-pick', 'palette', 'Farbe wählen', 'data-pop') + btn('swatch-copy', 'copy', 'Farbwert kopieren'); break;
        case 'todo': h += txt('todo-hide', d.hideDone ? 'Erledigte zeigen' : 'Erledigte ausblenden'); break;
        case 'comment': h += txt('cm-resolve', d.resolved ? 'Wieder öffnen' : 'Erledigt'); break;
        case 'line': h += `${btn('ln-style', 'minus', 'Linienart', 'data-pop')}${btn('ln-head', 'line', 'Pfeilspitze', 'data-pop')}${btn('ln-color', 'palette', 'Linienfarbe', 'data-pop')}${btn('ln-label', 'label', 'Beschriften')}`; break;
        default:
      }
    } else {
      const cardsOnly = cards.filter(c => c.type !== 'line' && !c.parent);
      if (cardsOnly.length > 1) h += btn('al-l', 'alignL', 'Links ausrichten') + btn('al-c', 'alignC', 'Mittig ausrichten') + btn('al-r', 'alignR', 'Rechts ausrichten') + btn('al-t', 'alignT', 'Oben ausrichten') + btn('al-m', 'alignM', 'Mitte ausrichten') + btn('al-b', 'alignB', 'Unten ausrichten');
    }
    if (cards.some(c => COLORABLE.has(c.type))) {
      const cur = one && one.data.color;
      h += `${h ? sep : ''}<button class="cb cb-col" type="button" data-cmd="color" title="Farbe" aria-label="Farbe" data-pop><i class="c-${esc(cur || (one && one.type === 'column' ? 'tint' : 'white'))}"></i></button>`;
    }
    h += `${h ? sep : ''}${btn('dup', 'copy', 'Duplizieren (⌘D)')}${btn('front', 'front', 'Nach vorne')}${btn('moveto', 'moveto', 'In anderes Board')}${btn('del', 'trash', 'In den Papierkorb (Entf)')}`;
    if (cards.length > 1) h = `<span class="cb-n">${cards.length}</span>${h}`;
    ctx.innerHTML = h;
    ctx.hidden = false;
    WB.placeCtx();
  };
  WB.placeCtx = function () {
    if (ctx.hidden || !S.sel.size) return;
    if (window.innerWidth < 760) { ctx.style.left = ''; ctx.style.top = ''; return; }
    const b = WB.bounds([...S.sel]);
    if (!b) return;
    const o = canvas.getBoundingClientRect();
    const sx = o.left + S.view.x + b.x * S.view.z, sy = o.top + S.view.y + b.y * S.view.z, sw = b.w * S.view.z, sh = b.h * S.view.z;
    const cw = ctx.offsetWidth, ch = ctx.offsetHeight;
    const left = Math.max(92, Math.min(window.innerWidth - cw - 10, sx + sw / 2 - cw / 2));
    let top = sy - ch - 12;
    if (top < 62) top = sy + sh + 12;
    if (top + ch > window.innerHeight - 8) top = Math.max(62, sy + 8);
    ctx.style.left = `${Math.round(left)}px`; ctx.style.top = `${Math.round(top)}px`;
  };

  ctx.addEventListener('pointerdown', e => e.preventDefault());
  ctx.addEventListener('click', e => {
    const b = e.target.closest('[data-cmd]');
    if (b) runCmd(b.dataset.cmd, b);
  });
  const selected = () => [...S.sel].map(id => S.cards.get(id)).filter(Boolean);
  const setData = (c, data, opts) => WB.commit([{ op: 'set', id: c.id, patch: { data } }], opts);

  function runCmd(cmd, b) {
    const cards = selected();
    const one = cards[0];
    if (!one) return;
    const d = one.data;
    switch (cmd) {
      case 'del': return trashSelection();
      case 'dup': return duplicate();
      case 'front': { let z = WB.maxZ(); WB.commit(cards.filter(c => !c.parent && c.type !== 'line').map(c => ({ op: 'set', id: c.id, patch: { z: ++z } }))); return; }
      case 'moveto': return moveDialog();
      case 'color':
        return WB.openPop(b, `<div class="pop-colors">${WB.COLORS.map(([k, n]) => `<button type="button" class="dot c-${k}" data-v="${k}" title="${esc(n)}" aria-label="${esc(n)}"></button>`).join('')}</div>`, v => {
          WB.commit(cards.filter(c => COLORABLE.has(c.type)).map(c => ({ op: 'set', id: c.id, patch: { data: { color: v } } })));
          if (one.type === 'board' && one.data.board) WB.send([{ op: 'board', id: one.data.board, patch: { color: v } }]);
          WB.closePop();
        });
      case 'open-board': return d.board && WB.openBoard(d.board);
      case 'board-icon':
        return WB.openPop(b, `<div class="pop-icons">${WB.BOARD_ICONS.map(k => `<button type="button" data-v="${k}" aria-label="${k}" class="${d.icon === k ? 'on' : ''}">${icon(k, 22)}</button>`).join('')}</div>`, v => { setData(one, { icon: v }); if (d.board) WB.send([{ op: 'board', id: d.board, patch: { icon: v } }]); WB.closePop(); });
      case 'rename': { const f = S.els.get(one.id).querySelector('[data-edit="title"]'); if (f) WB.startEdit(one, f, 'end'); return; }
      case 'link-go': { const h = WB.safeHref(d.url); if (h) window.open(h, '_blank', 'noopener,noreferrer'); return; }
      case 'link-refresh': return fetchPreview(one, d.url);
      case 'link-edit': { setData(one, { url: null, title: null, desc: null, image: null, imageAsset: null, embed: null, site: null }); requestAnimationFrame(() => { const i = S.els.get(one.id).querySelector('.lk-input'); if (i) i.focus(); }); return; }
      case 'image-big': return WB.lightbox(one);
      case 'image-down': case 'file-down': { const s = WB.safeSrc(d.src || d.url); if (s) window.open(s, '_blank', 'noopener,noreferrer'); return; }
      case 'image-palette': return paletteFrom(one);
      case 'image-caption': { const el = S.els.get(one.id); const f = el.querySelector('[data-edit="caption"]'); f.classList.remove('is-empty'); WB.startEdit(one, f, 'end'); return; }
      case 'sketch-edit': return WB.sketchEditor(one);
      case 'tb-addrow': return WB.T.table.addRow(one);
      case 'tb-addcol': return WB.T.table.addCol(one);
      case 'tb-delrow': return WB.T.table.delRow(one);
      case 'tb-delcol': return WB.T.table.delCol(one);
      case 'tb-head': setData(one, { header: d.header === false }); return WB.paintCtx();
      case 'swatch-copy': return copyText(d.hex, `${d.hex} kopiert.`);
      case 'swatch-pick':
        WB.openPop(b, `<label class="pop-color">Farbe <input type="color" value="${esc(d.hex)}"></label>`, () => {});
        pop.querySelector('input').addEventListener('change', e => setData(one, { hex: e.target.value.toUpperCase() }));
        return;
      case 'todo-hide': setData(one, { hideDone: !d.hideDone }); return WB.paintCtx();
      case 'cm-resolve': setData(one, { resolved: !d.resolved }); return WB.paintCtx();
      case 'ln-style':
        return WB.openPop(b, `<div class="pop-list">${[['solid', 'Durchgezogen'], ['dashed', 'Gestrichelt'], ['dotted', 'Gepunktet']].map(([k, n]) => `<button type="button" data-v="${k}" class="${(d.style || 'solid') === k ? 'on' : ''}">${n}</button>`).join('')}</div>`, v => { setData(one, { style: v }); WB.closePop(); });
      case 'ln-head':
        return WB.openPop(b, `<div class="pop-list">${[['end', 'Spitze am Ende'], ['both', 'Beide Seiten'], ['none', 'Keine Spitze']].map(([k, n]) => `<button type="button" data-v="${k}" class="${(d.head || 'end') === k ? 'on' : ''}">${n}</button>`).join('')}</div>`, v => { setData(one, { head: v }); WB.closePop(); });
      case 'ln-color':
        return WB.openPop(b, `<div class="pop-colors">${WB.LINE_COLORS.map(([k, v]) => `<button type="button" class="dot" style="background:${v}" data-v="${k}" aria-label="${k}"></button>`).join('')}</div>`, v => { setData(one, { color: v }); WB.closePop(); });
      case 'ln-label': return WB.editLineLabel(one.id);
      case 'al-l': case 'al-c': case 'al-r': case 'al-t': case 'al-m': case 'al-b': return align(cmd, cards);
      default:
    }
  }

  function align(cmd, cards) {
    const list = cards.filter(c => c.type !== 'line' && !c.parent).map(c => ({ c, r: WB.rectOf(c.id) })).filter(x => x.r);
    if (list.length < 2) return;
    const minX = Math.min(...list.map(x => x.r.x)), maxX = Math.max(...list.map(x => x.r.x + x.r.w));
    const minY = Math.min(...list.map(x => x.r.y)), maxY = Math.max(...list.map(x => x.r.y + x.r.h));
    const ops = list.map(({ c, r }) => {
      const p = {};
      if (cmd === 'al-l') p.x = minX;
      if (cmd === 'al-c') p.x = (minX + maxX) / 2 - r.w / 2;
      if (cmd === 'al-r') p.x = maxX - r.w;
      if (cmd === 'al-t') p.y = minY;
      if (cmd === 'al-m') p.y = (minY + maxY) / 2 - r.h / 2;
      if (cmd === 'al-b') p.y = maxY - r.h;
      return { op: 'set', id: c.id, patch: p };
    });
    WB.commit(ops);
  }

  function trashSelection() {
    const cards = selected().filter(c => !(c.parent && S.sel.has(c.parent)));
    if (!cards.length) return;
    for (const c of cards) {
      const el = S.els.get(c.id);
      if (el && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
        const r = el.getBoundingClientRect();
        const ghost = el.cloneNode(true);
        ghost.classList.add('eaten');
        ghost.classList.remove('sel');
        ghost.style.cssText = `position:fixed;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;z-index:90;margin:0`;
        document.body.appendChild(ghost);
        setTimeout(() => ghost.remove(), 260);
      }
    }
    WB.commit(cards.map(c => ({ op: 'del', id: c.id })));
    S.sel.clear();
    WB.paintSelection();
    WB.toast(cards.length === 1 ? 'Liegt im Papierkorb.' : `${cards.length} Karten im Papierkorb.`, { label: 'Rückgängig', fn: () => WB.undo() });
  }

  /* ---------- Duplizieren, Kopieren, Einfügen ---------- */
  function cloneCards(cards, dx, dy) {
    const skipped = cards.filter(c => c.type === 'board').length;
    const pick = cards.filter(c => c.type !== 'board');
    const all = [...pick];
    for (const c of pick) if (c.type === 'column') for (const k of S.cards.values()) if (k.parent === c.id && !all.includes(k)) all.push(k);
    const map = new Map(all.map(c => [c.id, WB.rid()]));
    let z = WB.maxZ();
    const ops = [];
    for (const c of all) {
      const data = WB.clone(c.data);
      if (c.type === 'line') {
        const end = e => (e.card ? (map.has(e.card) ? { card: map.get(e.card) } : { card: e.card }) : { x: e.x + dx, y: e.y + dy });
        data.from = end(data.from); data.to = end(data.to);
      }
      const keepParent = c.parent && map.has(c.parent) ? map.get(c.parent) : c.parent && !cards.includes(c) ? null : c.parent;
      ops.push({ op: 'add', card: { id: map.get(c.id), type: c.type, x: Math.round(c.x + dx), y: Math.round(c.y + dy), w: c.w, h: c.h, z: ++z, parent: keepParent, pos: c.parent ? c.pos + 0.01 : 0, data } });
    }
    if (skipped) WB.toast('Boards lassen sich nicht duplizieren, nur verschieben.');
    return { ops, ids: ops.filter(o => !o.card.parent || !map.has(o.card.parent)).map(o => o.card.id) };
  }
  function duplicate() {
    const cards = selected().filter(c => !(c.parent && S.sel.has(c.parent)));
    const { ops, ids } = cloneCards(cards, 30, 30);
    if (!ops.length) return;
    WB.commit(ops);
    S.sel = new Set(ids);
    WB.paintSelection();
  }
  let clip = null;
  const inField = t => t && t.closest && t.closest('input, textarea, select, [contenteditable]');

  document.addEventListener('copy', e => {
    if (inField(document.activeElement) || !S.sel.size || dlg.open) return;
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) return;
    const cards = selected();
    const text = cards.map(c => c.type === 'note' ? WB.plainOf(c.data.html) : c.type === 'link' ? c.data.url : c.data.title || c.data.caption || '').filter(Boolean).join('\n\n') || 'Whiteboard Karten';
    clip = { cards: WB.clone(cards), text };
    e.clipboardData.setData('text/plain', text);
    e.preventDefault();
    WB.toast(cards.length === 1 ? 'Karte kopiert.' : `${cards.length} Karten kopiert.`);
  });
  document.addEventListener('cut', e => {
    if (inField(document.activeElement) || !S.sel.size || dlg.open) return;
    const cards = selected();
    const text = cards.map(c => c.type === 'note' ? WB.plainOf(c.data.html) : '').filter(Boolean).join('\n\n') || 'Whiteboard Karten';
    clip = { cards: WB.clone(cards), text };
    e.clipboardData.setData('text/plain', text);
    e.preventDefault();
    trashSelection();
  });
  const URL_RE = /^(https?:\/\/|www\.)[^\s]+$/i;
  let lastPointer = null;
  canvas.addEventListener('pointermove', e => { lastPointer = { x: e.clientX, y: e.clientY }; });
  const pointWorld = () => {
    const r = canvas.getBoundingClientRect();
    return lastPointer && lastPointer.x > r.left + 90 ? WB.toWorld(lastPointer.x, lastPointer.y) : WB.toWorld(r.left + r.width / 2, r.top + r.height * 0.42);
  };

  document.addEventListener('paste', e => {
    if (!S.board || inField(document.activeElement) || dlg.open) return;
    const cd = e.clipboardData;
    if (!cd) return;
    const files = [...(cd.files || [])];
    if (files.length) { e.preventDefault(); WB.addFiles(files, pointWorld()); return; }
    const text = (cd.getData('text/plain') || '').trim();
    if (!text) return;
    e.preventDefault();
    const at = pointWorld();
    if (clip && text === clip.text) {
      const b = { x: Math.min(...clip.cards.map(c => c.x)), y: Math.min(...clip.cards.map(c => c.y)) };
      const { ops, ids } = cloneCards(clip.cards, at.x - b.x, at.y - b.y);
      if (ops.length) { WB.commit(ops); S.sel = new Set(ids); WB.paintSelection(); }
      return;
    }
    if (URL_RE.test(text)) {
      const c = WB.addCard('link', { ...at, ready: true, edit: false, data: { url: normalUrl(text), site: siteOf(text), loading: true } });
      fetchPreview(c, normalUrl(text));
      return;
    }
    const html = text.split(/\n{2,}/).map(p => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
    WB.addCard('note', { ...at, ready: true, edit: false, data: { html } });
  });
  const normalUrl = u => (/^https?:\/\//i.test(u) ? u : `https://${u}`);
  const siteOf = u => { try { return new URL(normalUrl(u)).hostname.replace(/^www\./, ''); } catch (_) { return ''; } };

  async function fetchPreview(c, url) {
    setData(c, { loading: true }, { history: false });
    try {
      const u = await WB.api('/unfurl', { method: 'POST', body: { url } });
      if (!S.cards.has(c.id)) return;
      setData(c, { url: u.url, site: u.site, title: u.title || null, desc: u.desc || null, image: u.image || null, imageAsset: u.imageAsset || null, embed: u.embed || null, loading: null }, { history: false });
    } catch (e) {
      if (S.cards.has(c.id)) setData(c, { loading: null }, { history: false });
    }
  }

  /* ---------- Upload ---------- */
  async function shrink(file) {
    const out = { blob: file, name: file.name || 'datei', mime: file.type || 'application/octet-stream', w: null, h: null };
    if (!/^image\/(jpeg|png|webp|heic|heif|avif|bmp)$/i.test(file.type)) return out;
    let bmp = null;
    try { bmp = await createImageBitmap(file); } catch (_) { return out; }
    const MAX = 2400;
    const scale = Math.min(1, MAX / Math.max(bmp.width, bmp.height));
    const W = Math.round(bmp.width * scale), H = Math.round(bmp.height * scale);
    out.w = W; out.h = H;
    if (scale === 1 && file.size < 900 * 1024 && /^image\/(jpeg|png|webp)$/i.test(file.type)) { bmp.close(); return out; }
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    cv.getContext('2d').drawImage(bmp, 0, 0, W, H);
    bmp.close();
    const toBlob = (t, q) => new Promise(r => cv.toBlob(r, t, q));
    let blob = await toBlob('image/webp', 0.86);
    let ext = 'webp';
    if (!blob || blob.type !== 'image/webp') { blob = await toBlob('image/jpeg', 0.86); ext = 'jpg'; }
    if (blob) { out.blob = blob; out.mime = blob.type; out.name = out.name.replace(/\.[^.]+$/, '') + `.${ext}`; }
    return out;
  }
  async function upload(prep) {
    return WB.api('/assets', { method: 'POST', raw: prep.blob, headers: { 'Content-Type': prep.mime, 'X-Name': encodeURIComponent(prep.name.slice(0, 170)), ...(prep.w ? { 'X-W': String(prep.w), 'X-H': String(prep.h) } : {}) } });
  }

  WB.addFiles = async function (files, at) {
    const r = canvas.getBoundingClientRect();
    const start = at || WB.toWorld(r.left + r.width / 2 - 160, r.top + r.height * 0.3);
    const cols = Math.min(4, Math.ceil(Math.sqrt(files.length)));
    const newIds = [];
    await Promise.all(files.map(async (file, i) => {
      if (file.size > 40 * 1024 * 1024) { WB.toast(`${file.name} ist zu groß. Große Videos bitte als Link einfügen.`); return; }
      const isImage = /^image\//.test(file.type);
      const type = isImage ? 'image' : 'file';
      const w = isImage ? 340 : 280;
      const x = start.x + (i % cols) * (w + 24);
      const y = start.y + Math.floor(i / cols) * 300;
      const id = WB.rid();
      const local = URL.createObjectURL(file);
      const data = isImage ? { src: local, name: file.name, uploading: true } : { src: local, name: file.name, size: file.size, mime: file.type, uploading: true };
      const card = { id, type, x: Math.round(x), y: Math.round(y), w, z: WB.maxZ() + 1, data };
      WB.commit([{ op: 'add', card }], { send: false, history: false });
      newIds.push(id);
      try {
        const prep = isImage ? await shrink(file) : { blob: file, name: file.name, mime: file.type || 'application/octet-stream' };
        if (prep.blob.size > 20 * 1024 * 1024) throw Object.assign(new Error('Datei ist zu groß, höchstens 20 MB. Große Videos bitte als Link einfügen.'), { status: 413 });
        const up = await upload(prep);
        const c = S.cards.get(id);
        if (!c) return;
        delete c.data.uploading;
        c.data.src = up.url; c.data.asset = up.id; c.data.name = up.name;
        if (isImage && prep.w) c.data.ratio = prep.h / prep.w;
        if (!isImage) { c.data.size = up.size; c.data.mime = prep.mime; }
        const addOp = { op: 'add', card: { id, type, x: c.x, y: c.y, w: c.w, z: c.z, parent: c.parent, pos: c.pos, data: c.data } };
        WB.send([addOp]);
        WB.remember([addOp], [{ op: 'del', id }]);
        const el = S.els.get(id);
        if (el) el._key = '';
        WB.renderCard(c);
        URL.revokeObjectURL(local);
        WB.measure(c);
      } catch (e) {
        URL.revokeObjectURL(local);
        S.cards.delete(id); S.sel.delete(id); WB.dropCard(id);
        WB.afterHistory();
        WB.toast(e.message || `${file.name} ließ sich nicht hochladen.`);
      }
    }));
    if (newIds.length) { S.sel = new Set(newIds.filter(i => S.cards.has(i))); WB.paintSelection(); }
  };

  // Dateien und Links von außen auf die Fläche ziehen
  let dragDepth = 0;
  const hasFiles = e => e.dataTransfer && [...e.dataTransfer.types].some(t => t === 'Files' || t === 'text/uri-list' || t === 'text/plain');
  document.addEventListener('dragenter', e => { if (hasFiles(e)) { dragDepth++; document.body.classList.add('drop-on'); e.preventDefault(); } });
  document.addEventListener('dragover', e => { if (hasFiles(e)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } });
  document.addEventListener('dragleave', () => { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) document.body.classList.remove('drop-on'); });
  document.addEventListener('drop', async e => {
    dragDepth = 0;
    document.body.classList.remove('drop-on');
    if (!S.board || !e.dataTransfer) return;
    e.preventDefault();
    const at = WB.toWorld(e.clientX, e.clientY);
    const files = [...e.dataTransfer.files];
    if (files.length) { WB.addFiles(files, { x: at.x - 160, y: at.y - 100 }); return; }
    const html = e.dataTransfer.getData('text/html');
    const uri = (e.dataTransfer.getData('text/uri-list') || '').split('\n').find(l => l && !l.startsWith('#'));
    const text = e.dataTransfer.getData('text/plain');
    const imgInHtml = html && (new DOMParser().parseFromString(html, 'text/html').querySelector('img') || {}).src;
    if (imgInHtml && /^https?:/.test(imgInHtml)) {
      try {
        const s = await WB.api('/assets/remote', { method: 'POST', body: { url: imgInHtml } });
        WB.addCard('image', { x: at.x - 170, y: at.y - 100, edit: false, data: { src: s.url, asset: s.id, name: s.name } });
      } catch (err) { WB.toast(err.message); }
      return;
    }
    const url = uri || (URL_RE.test((text || '').trim()) ? text.trim() : null);
    if (url) {
      const c = WB.addCard('link', { x: at.x - 150, y: at.y - 40, ready: true, edit: false, data: { url: normalUrl(url), site: siteOf(url), loading: true } });
      fetchPreview(c, normalUrl(url));
    } else if (text) {
      WB.addCard('note', { x: at.x - 130, y: at.y - 30, ready: true, edit: false, data: { html: `<p>${esc(text).replace(/\n/g, '<br>')}</p>` } });
    }
  });

  /* ---------- Aktionen in Karten ---------- */
  const cardsEl = $('#cards');
  cardsEl.addEventListener('click', e => {
    const a = e.target.closest('[data-act]');
    if (!a) return;
    const el = a.closest('.card');
    const c = el && S.cards.get(el.dataset.id);
    if (!c) return;
    const act = a.dataset.act;
    switch (act) {
      case 'todo-toggle': {
        const id = a.closest('[data-item]').dataset.item;
        const items = WB.clone(c.data.items).map(i => (i.id === id ? { ...i, done: !i.done } : i));
        if (S.editing === c.id) WB.stopEdit();
        WB.commit([{ op: 'set', id: c.id, patch: { data: { items } } }]);
        break;
      }
      case 'todo-add': WB.ensureSent(c.id); WB.T.todo.addAfter(c, null); break;
      case 'todo-menu': {
        const id = a.closest('[data-item]').dataset.item;
        const it = (c.data.items || []).find(i => i.id === id);
        if (!it) return;
        a.dataset.pop = '1';
        WB.openPop(a, `<div class="pop-form"><label>Wer<input data-f="owner" value="${esc(it.owner || '')}" maxlength="60" placeholder="Name"></label><label>Bis<input data-f="due" value="${esc(it.due || '')}" maxlength="40" placeholder="07.11."></label><div class="pop-row"><button type="button" data-v="del" class="danger">Löschen</button><button type="button" data-v="save" class="primary">Fertig</button></div></div>`, v => {
          const items = WB.clone(c.data.items);
          const idx = items.findIndex(i => i.id === id);
          if (v === 'del') items.splice(idx, 1);
          else {
            const o = pop.querySelector('[data-f="owner"]').value.trim(), du = pop.querySelector('[data-f="due"]').value.trim();
            if (o) items[idx].owner = o; else delete items[idx].owner;
            if (du) items[idx].due = du; else delete items[idx].due;
          }
          WB.commit([{ op: 'set', id: c.id, patch: { data: { items } } }]);
          WB.closePop();
        });
        pop.querySelector('input').focus();
        break;
      }
      case 'col-fold': setData(c, { collapsed: !c.data.collapsed }); break;
      case 'col-add': {
        const kids = [...S.cards.values()].filter(k => k.parent === c.id);
        WB.addCard('note', { parent: c.id, x: 0, y: 0, pos: kids.reduce((m, k) => Math.max(m, k.pos), 0) + 1 });
        break;
      }
      case 'link-play': el._playing = true; el._key = ''; WB.renderCard(c); break;
      case 'swatch-copy': if (S.sel.has(c.id)) copyText(c.data.hex, `${c.data.hex} kopiert.`); else WB.selectOnly(c.id); break;
      case 'link-open': default:
    }
  });

  // Link Eingabe und Kommentarfeld
  cardsEl.addEventListener('keydown', e => {
    const t = e.target;
    const el = t.closest && t.closest('.card');
    const c = el && S.cards.get(el.dataset.id);
    if (!c) return;
    if (t.classList.contains('lk-input')) {
      e.stopPropagation();
      if (e.key === 'Enter') { e.preventDefault(); t.blur(); }
      if (e.key === 'Escape') { t.value = ''; t.blur(); }
    }
    if (t.classList.contains('cm-input')) {
      e.stopPropagation();
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const v = t.value.trim();
        if (!v) return;
        t.value = '';
        WB.ensureSent(c.id);
        const thread = [...(c.data.thread || []), { id: WB.rid(), by: S.me.name, at: Date.now(), text: v }];
        setData(c, { thread });
        requestAnimationFrame(() => { const i = S.els.get(c.id) && S.els.get(c.id).querySelector('.cm-input'); if (i) i.focus(); });
      }
      if (e.key === 'Escape') t.blur();
    }
  });
  cardsEl.addEventListener('input', e => {
    if (e.target.classList.contains('cm-input')) { e.target.style.height = 'auto'; e.target.style.height = `${e.target.scrollHeight}px`; }
  });
  cardsEl.addEventListener('focusout', e => {
    const t = e.target;
    const el = t.closest && t.closest('.card');
    const c = el && S.cards.get(el.dataset.id);
    if (!c) return;
    if (t.classList.contains('lk-input')) {
      const v = t.value.trim();
      if (v) {
        WB.ensureSent(c.id);
        setData(c, { url: normalUrl(v), site: siteOf(v), loading: true });
        fetchPreview(c, normalUrl(v));
      } else if (S.fresh.has(c.id)) WB.removeFresh(c.id);
    }
    if (t.classList.contains('cm-input') && S.fresh.has(c.id) && !(c.data.thread || []).length && !t.value.trim()) {
      setTimeout(() => { if (S.fresh.has(c.id) && !(c.data.thread || []).length && document.activeElement !== t) WB.removeFresh(c.id); }, 0);
    }
  });

  /* ---------- Textformat ---------- */
  const fmt = $('#fmt');
  const FMT = [['bold', 'B', 'Fett (⌘B)'], ['italic', 'I', 'Kursiv (⌘I)'], ['underline', 'U', 'Unterstrichen (⌘U)'], ['strikeThrough', 'S', 'Durchgestrichen'], null, ['h1', 'H1', 'Große Überschrift'], ['h2', 'H2', 'Überschrift'], ['quote', '“', 'Zitat'], null, ['ul', '•', 'Liste'], ['ol', '1.', 'Nummerierte Liste'], null, ['mark', 'M', 'Markieren'], ['link', '↗', 'Link (⌘K)'], ['clear', '×', 'Format entfernen']];
  fmt.innerHTML = FMT.map(f => (f ? `<button type="button" class="fb fb-${f[0]}" data-f="${f[0]}" title="${esc(f[2])}" aria-label="${esc(f[2])}">${esc(f[1])}</button>` : '<span class="cb-sep"></span>')).join('');
  fmt.addEventListener('pointerdown', e => e.preventDefault());
  fmt.addEventListener('click', e => { const b = e.target.closest('[data-f]'); if (b) WB.fmtCommand(b.dataset.f); });
  const bump = () => { if (S.editField) S.editField.dispatchEvent(new Event('input', { bubbles: true })); };
  WB.fmtCommand = function (f) {
    const ex = (c, v) => document.execCommand(c, false, v);
    const block = tag => { const cur = String(document.queryCommandValue('formatBlock') || '').toLowerCase(); ex('formatBlock', cur === tag ? 'p' : tag); };
    switch (f) {
      case 'h1': block('h1'); break;
      case 'h2': block('h2'); break;
      case 'quote': block('blockquote'); break;
      case 'ul': ex('insertUnorderedList'); break;
      case 'ol': ex('insertOrderedList'); break;
      case 'clear': ex('removeFormat'); ex('formatBlock', 'p'); break;
      case 'mark': {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed) break;
        const node = sel.anchorNode && (sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement);
        const m = node && node.closest('mark');
        if (m) m.replaceWith(...m.childNodes);
        else ex('insertHTML', `<mark>${esc(sel.toString())}</mark>`);
        break;
      }
      case 'link': {
        const sel = window.getSelection();
        const range = sel && sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
        WB.openPop(fmt.querySelector('.fb-link'), '<div class="pop-form"><label>Link<input data-f="url" type="url" placeholder="https://" autocomplete="off"></label><div class="pop-row"><button type="button" data-v="ok" class="primary">Setzen</button></div></div>', () => {
          const v = pop.querySelector('input').value.trim();
          WB.closePop();
          if (S.editField) S.editField.focus();
          if (range && sel) { sel.removeAllRanges(); sel.addRange(range); }
          if (v) { const h = WB.safeHref(normalUrl(v)); if (h) { if (sel.isCollapsed) ex('insertHTML', `<a href="${esc(h)}">${esc(v)}</a>`); else ex('createLink', h); bump(); } }
        });
        pop.querySelector('input').focus();
        pop.querySelector('input').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); pop.querySelector('[data-v]').click(); } });
        return;
      }
      default: ex(f);
    }
    bump();
    paintFmtState();
  };
  function paintFmtState() {
    for (const k of ['bold', 'italic', 'underline', 'strikeThrough']) {
      const b = fmt.querySelector(`.fb-${k}`);
      if (b) { let on = false; try { on = document.queryCommandState(k); } catch (_) { /* egal */ } b.classList.toggle('on', on); }
    }
    let block = '';
    try { block = String(document.queryCommandValue('formatBlock') || '').toLowerCase(); } catch (_) { /* egal */ }
    fmt.querySelector('.fb-h1').classList.toggle('on', block === 'h1');
    fmt.querySelector('.fb-h2').classList.toggle('on', block === 'h2');
    fmt.querySelector('.fb-quote').classList.toggle('on', block === 'blockquote');
  }
  document.addEventListener('selectionchange', () => { if (!fmt.hidden && S.editField) paintFmtState(); });
  WB.paintFmt = function () {
    const f = S.editField;
    const on = f && f.dataset.rich;
    fmt.hidden = !on;
    WB.paintCtx();
    if (!on) return;
    paintFmtState();
    if (window.innerWidth < 760) { fmt.style.left = ''; fmt.style.top = ''; return; }
    const r = f.getBoundingClientRect();
    const w = fmt.offsetWidth;
    fmt.style.left = `${Math.max(92, Math.min(window.innerWidth - w - 10, r.left + r.width / 2 - w / 2))}px`;
    fmt.style.top = `${Math.max(62, r.top - 56)}px`;
  };

  /* ---------- Großansicht, Farben, Skizze ---------- */
  WB.lightbox = function (c) {
    const src = WB.safeSrc(c.data.src || c.data.url);
    if (!src) return;
    WB.dialog({ cls: 'lightbox', body: `<button class="tb ico lb-x" type="button" data-close aria-label="Schließen">${icon('close', 22)}</button><img src="${esc(src)}" alt="${esc(c.data.caption || c.data.name || '')}" referrerpolicy="no-referrer">${c.data.caption ? `<p>${esc(c.data.caption)}</p>` : ''}` });
  };

  async function paletteFrom(c) {
    const src = WB.safeSrc(c.data.src || c.data.url);
    if (!src) return;
    try {
      const res = await fetch(src);
      const bmp = await createImageBitmap(await res.blob(), { resizeWidth: 80, resizeQuality: 'low' });
      const cv = document.createElement('canvas'); cv.width = bmp.width; cv.height = bmp.height;
      const g = cv.getContext('2d'); g.drawImage(bmp, 0, 0);
      const px = g.getImageData(0, 0, cv.width, cv.height).data;
      const buckets = new Map();
      for (let i = 0; i < px.length; i += 4) {
        if (px[i + 3] < 200) continue;
        const k = `${px[i] >> 4},${px[i + 1] >> 4},${px[i + 2] >> 4}`;
        const b = buckets.get(k) || { n: 0, r: 0, g: 0, b: 0 };
        b.n++; b.r += px[i]; b.g += px[i + 1]; b.b += px[i + 2];
        buckets.set(k, b);
      }
      const ranked = [...buckets.values()].map(b => ({ n: b.n, r: b.r / b.n, g: b.g / b.n, b: b.b / b.n })).sort((a, b) => b.n - a.n);
      const picks = [];
      for (const b of ranked) {
        if (picks.every(p => Math.abs(p.r - b.r) + Math.abs(p.g - b.g) + Math.abs(p.b - b.b) > 70)) picks.push(b);
        if (picks.length === 5) break;
      }
      const hex = v => Math.round(v).toString(16).padStart(2, '0');
      const r = WB.rectOf(c.id);
      const ops = picks.map((p, i) => ({ op: 'add', card: { id: WB.rid(), type: 'swatch', x: Math.round(r.x + i * 130), y: Math.round(r.y + r.h + 20), w: 120, z: WB.maxZ() + 1 + i, data: { hex: `#${hex(p.r)}${hex(p.g)}${hex(p.b)}`.toUpperCase() } } }));
      WB.commit(ops);
    } catch (_) { WB.toast('Farben ließen sich nicht lesen.'); }
  }

  WB.sketchEditor = function (c, isNew) {
    const d = c.data;
    const vw = d.vw || 800, vh = d.vh || 600;
    let paths = WB.clone(d.paths || []);
    let color = '#232321', size = 5, erase = false, cur = null;
    const COLS = ['#232321', '#F26A21', '#17835A', '#2F6FED', '#C2336A', '#FFFFFF'];
    const box = WB.dialog({
      cls: 'sketch', wide: true,
      body: `<div class="sk-bar"><div class="sk-cols">${COLS.map(k => `<button type="button" class="dot${k === color ? ' on' : ''}" data-c="${k}" style="background:${k}" aria-label="Farbe ${k}"></button>`).join('')}</div>
        <div class="sk-sizes">${[3, 5, 10, 22].map(s => `<button type="button" data-s="${s}" class="${s === size ? 'on' : ''}" aria-label="Strichstärke ${s}"><i style="width:${Math.min(20, s + 2)}px;height:${Math.min(20, s + 2)}px"></i></button>`).join('')}</div>
        <button type="button" class="cb cb-t" data-tool="erase">Radierer</button><button type="button" class="cb" data-tool="undo" aria-label="Letzten Strich weg">${icon('undo', 19)}</button><button type="button" class="cb cb-t" data-tool="clear">Leeren</button>
        <span class="sk-gap"></span><button type="button" class="btn" data-tool="cancel">Abbrechen</button><button type="button" class="btn primary" data-tool="done">Fertig</button></div>
        <div class="sk-stage"><svg id="skSvg" viewBox="0 0 ${vw} ${vh}" fill="none" stroke-linecap="round" stroke-linejoin="round"></svg></div>`,
    });
    const svgEl = box.querySelector('#skSvg');
    const safeC = v => (/^#[0-9a-fA-F]{3,8}$/.test(v) ? v : '#232321');
    const paint = () => { svgEl.innerHTML = paths.map((p, i) => `<path data-i="${i}" d="${esc(p.d)}" stroke="${safeC(p.c)}" stroke-width="${Number(p.s) || 4}"/>`).join('') + (cur ? `<path d="${esc(toPath(cur.pts))}" stroke="${safeC(cur.c)}" stroke-width="${cur.s}"/>` : ''); };
    function toPath(pts) {
      if (pts.length < 2) { const [p] = pts; return p ? `M${p[0]} ${p[1]}L${p[0] + 0.1} ${p[1]}` : ''; }
      let s = `M${pts[0][0]} ${pts[0][1]}`;
      for (let i = 1; i < pts.length - 1; i++) {
        const mx = ((pts[i][0] + pts[i + 1][0]) / 2).toFixed(1), my = ((pts[i][1] + pts[i + 1][1]) / 2).toFixed(1);
        s += `Q${pts[i][0]} ${pts[i][1]} ${mx} ${my}`;
      }
      const l = pts[pts.length - 1];
      return `${s}L${l[0]} ${l[1]}`;
    }
    const toSvg = e => { const r = svgEl.getBoundingClientRect(); return [+((e.clientX - r.left) / r.width * vw).toFixed(1), +((e.clientY - r.top) / r.height * vh).toFixed(1)]; };
    paint();
    svgEl.addEventListener('pointerdown', e => {
      e.preventDefault();
      svgEl.setPointerCapture(e.pointerId);
      if (erase) return;
      cur = { c: color, s: size, pts: [toSvg(e)] };
      paint();
    });
    svgEl.addEventListener('pointermove', e => {
      if (erase) {
        if (!e.buttons && e.pointerType === 'mouse') return;
        const under = document.elementFromPoint(e.clientX, e.clientY);
        if (under && under.dataset && under.dataset.i !== undefined) { paths.splice(+under.dataset.i, 1); paint(); }
        return;
      }
      if (!cur) return;
      const p = toSvg(e), l = cur.pts[cur.pts.length - 1];
      if (Math.hypot(p[0] - l[0], p[1] - l[1]) < 1.5) return;
      cur.pts.push(p);
      paint();
    });
    const endStroke = () => { if (cur) { paths.push({ d: toPath(cur.pts), c: cur.c, s: cur.s }); cur = null; paint(); } };
    svgEl.addEventListener('pointerup', endStroke);
    svgEl.addEventListener('pointercancel', endStroke);
    const finish = save => {
      box.close();
      if (save) {
        const size2 = JSON.stringify(paths).length;
        if (size2 > 380000) { WB.toast('Die Skizze ist zu groß. Bitte weniger Striche.'); return; }
        if (JSON.stringify(paths) !== JSON.stringify(d.paths || [])) setData(c, { paths, vw, vh });
      } else if (isNew && !(d.paths || []).length) WB.commit([{ op: 'del', id: c.id }], { history: false });
    };
    box.querySelector('.sk-bar').addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.c) { color = b.dataset.c; erase = false; box.querySelectorAll('.sk-cols .dot').forEach(x => x.classList.toggle('on', x === b)); box.querySelector('[data-tool="erase"]').classList.remove('on'); }
      if (b.dataset.s) { size = +b.dataset.s; box.querySelectorAll('.sk-sizes button').forEach(x => x.classList.toggle('on', x === b)); }
      switch (b.dataset.tool) {
        case 'erase': erase = !erase; b.classList.toggle('on', erase); break;
        case 'undo': paths.pop(); paint(); break;
        case 'clear': paths = []; paint(); break;
        case 'cancel': finish(false); break;
        case 'done': finish(true); break;
        default:
      }
    });
  };

  /* ---------- Verschieben in anderes Board ---------- */
  async function moveDialog() {
    const ids = selected().filter(c => !(c.parent && S.sel.has(c.parent))).map(c => c.id);
    let tree;
    try { tree = (await WB.api('/boards')).boards; } catch (e) { return WB.toast(e.message); }
    const banned = new Set(selected().filter(c => c.type === 'board').map(c => c.data.board));
    const walk = (id, depth) => tree.filter(b => b.parent === id && !banned.has(b.id)).flatMap(b => [`<button type="button" class="tree-row" data-to="${esc(b.id)}" style="padding-left:${14 + depth * 18}px" ${b.id === S.board.id ? 'disabled' : ''}>${icon(b.icon || 'board', 18)}<span>${esc(b.title)}</span><em>${b.cards}</em></button>`, ...walk(b.id, depth + 1)]);
    const home = tree.find(b => b.id === 'home');
    const box = WB.dialog({ title: 'In welches Board?', body: `<div class="tree"><button type="button" class="tree-row" data-to="home" ${S.board.id === 'home' ? 'disabled' : ''}><img src="mouth.webp" alt="" width="10" height="19" data-logo-fixed><span>${esc(home ? home.title : 'Home')}</span></button>${walk('home', 1).join('')}</div>` });
    box.querySelector('.tree').addEventListener('click', e => {
      const b = e.target.closest('[data-to]');
      if (!b || b.disabled) return;
      box.close();
      WB.moveCards(ids, b.dataset.to);
    });
  }

  /* ---------- Papierkorb ---------- */
  const drawer = $('#drawer');
  async function openTrash() {
    drawer.hidden = false;
    drawer.innerHTML = `<header><h2>Papierkorb</h2><button class="tb ico" type="button" data-x aria-label="Schließen">${icon('close', 20)}</button></header><div class="dr-list">Lädt.</div>`;
    drawer.querySelector('[data-x]').onclick = () => { drawer.hidden = true; };
    let list;
    try { list = (await WB.api(`/boards/${S.board.id}/trash`)).cards; } catch (e) { drawer.querySelector('.dr-list').textContent = e.message; return; }
    S.trash = list.length;
    WB.paintTrash();
    const names = { note: 'Notiz', todo: 'To-do', link: 'Link', image: 'Bild', file: 'Datei', board: 'Board', column: 'Spalte', line: 'Pfeil', comment: 'Kommentar', table: 'Tabelle', swatch: 'Farbe', sketch: 'Skizze' };
    const box = drawer.querySelector('.dr-list');
    if (!list.length) { box.textContent = 'Leer. Gelöschte Karten dieses Boards landen hier.'; return; }
    box.innerHTML = list.map(c => `<article data-id="${esc(c.id)}"><div class="dr-ic">${icon(c.type === 'swatch' ? 'swatch' : c.type, 20)}</div><div class="dr-main"><b>${esc(names[c.type] || c.type)}</b><p>${esc(c.text || 'Ohne Text')}</p><small>${esc(c.updatedBy)}, ${esc(WB.fmtAgo(c.deletedAt))}</small></div><div class="dr-acts"><button type="button" class="btn" data-a="back">Zurückholen</button><button type="button" class="btn danger" data-a="kill">Löschen</button></div></article>`).join('')
      + '<button type="button" class="btn danger dr-all" data-a="all">Papierkorb endgültig leeren</button>';
    box.onclick = async e => {
      const b = e.target.closest('[data-a]');
      if (!b) return;
      const art = b.closest('article');
      const id = art && art.dataset.id;
      if (b.dataset.a === 'back') {
        const row = list.find(x => x.id === id);
        await restore(row);
        art.remove();
        S.trash = Math.max(0, S.trash - 1); WB.paintTrash();
      }
      if (b.dataset.a === 'kill') {
        if (!confirmKill(1, list.find(x => x.id === id))) return;
        await WB.api(`/boards/${S.board.id}/purge`, { method: 'POST', body: { ids: [id] } }).catch(err => WB.toast(err.message));
        art.remove();
        S.trash = Math.max(0, S.trash - 1); WB.paintTrash();
      }
      if (b.dataset.a === 'all') {
        if (!confirmKill(list.length)) return;
        await WB.api(`/boards/${S.board.id}/purge`, { method: 'POST', body: {} }).catch(err => WB.toast(err.message));
        S.trash = 0; WB.paintTrash();
        box.textContent = 'Leer.';
      }
    };
  }
  const confirmKill = (n, row) => window.confirm(row && row.type === 'board' ? 'Dieses Board samt Inhalt endgültig löschen? Das geht nicht rückgängig.' : n === 1 ? 'Karte endgültig löschen? Das geht nicht rückgängig.' : `${n} Karten endgültig löschen? Das geht nicht rückgängig.`);
  async function restore(row) {
    await WB.api(`/boards/${S.board.id}/ops`, { method: 'POST', body: { ops: [{ op: 'undel', id: row.id }] }, headers: { 'X-Client': S.peerId } }).then(r => { WB.applyServerCards(r.cards); S.rev = r.rev; }).catch(e => WB.toast(e.message));
    WB.pulseCard(row.id);
  }

  /* ---------- Suche ---------- */
  function openSearch() {
    const box = WB.dialog({ cls: 'search', wide: true, body: `<div class="se-in">${icon('search', 20)}<input id="seQ" type="search" placeholder="Suchen in allen Boards" autocomplete="off" enterkeyhint="search"><button class="tb ico" type="button" data-close aria-label="Schließen">${icon('close', 20)}</button></div><div id="seOut"></div>` });
    const input = box.querySelector('#seQ'), out = box.querySelector('#seOut');
    input.focus();
    let t = null, seq = 0;
    const row = (type, title, sub, attrs) => `<button type="button" class="se-row" ${attrs}>${icon(type, 18)}<span><b>${esc(title)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</span></button>`;
    input.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(async () => {
        const q = input.value.trim();
        if (q.length < 2) { out.innerHTML = ''; return; }
        const my = ++seq;
        try {
          const r = await WB.api(`/search?q=${encodeURIComponent(q)}`);
          if (my !== seq) return;
          out.innerHTML = [...r.boards.map(b => row(b.icon || 'board', b.title, 'Board', `data-b="${esc(b.id)}"`)), ...r.cards.map(c => row(c.type === 'swatch' ? 'swatch' : c.type, c.text || 'Karte', c.boardTitle, `data-b="${esc(c.board)}" data-c="${esc(c.id)}"`))].join('') || '<p class="se-none">Nichts gefunden.</p>';
        } catch (e) { out.textContent = e.message; }
      }, 170);
    });
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); const f = out.querySelector('.se-row'); if (f) f.click(); } });
    out.addEventListener('click', e => {
      const b = e.target.closest('.se-row');
      if (!b) return;
      box.close();
      WB.openBoard(b.dataset.b, { focus: b.dataset.c });
    });
  }
  $('#btnSearch').onclick = openSearch;

  /* ---------- Call ---------- */
  $('#btnCall').onclick = () => {
    const box = WB.dialog({
      title: 'Neuer Call',
      body: `<p class="dlg-text">Eigenes Board mit Agenda, Mitschrift, Ideen, Entscheidungen, To-dos und offenen Fragen. Alle im Call öffnen denselben Link und sehen sich live.</p>
        <label class="field">Mit wem oder worum geht es?<input id="callT" type="text" maxlength="160" placeholder="Zum Beispiel Mmaah Kampagne"></label>
        <p class="dlg-hint">Claude schreibt mit, wenn du im Chat sagst: „Schreib unseren Call ins Board.“ Einmal verbinden unter Mehr, Claude verbinden.</p>
        <div class="dlg-acts"><button type="button" class="btn" data-close>Abbrechen</button><button type="button" class="btn primary" id="callGo">Board anlegen</button></div>`,
    });
    box.querySelectorAll('[data-close]').forEach(b => { b.onclick = () => box.close(); });
    const input = box.querySelector('#callT');
    input.focus();
    const go = async () => {
      const when = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const t = input.value.trim();
      box.close();
      try {
        const b = await WB.api('/calls', { method: 'POST', body: { title: t ? `Call ${t}` : `Call ${when}` } });
        await WB.openBoard(b.id);
        requestAnimationFrame(() => WB.fit());
        WB.toast('Call Board steht.', { label: 'Link kopieren', fn: () => copyText(`${location.origin}${location.pathname}#b=${b.id}`, 'Link kopiert.') });
      } catch (e) { WB.toast(e.message); }
    };
    box.querySelector('#callGo').onclick = go;
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
  };

  /* ---------- Menü ---------- */
  $('#btnMenu').dataset.pop = '1';
  $('#btnMenu').onclick = e => {
    const isHome = S.board.id === 'home';
    const rows = [
      isHome ? null : ['rename', 'pencil', 'Board umbenennen'],
      ['tpl', 'board', 'Vorlage einsetzen'],
      ['md', 'doc', 'Als Markdown laden'],
      ['print', 'print', 'Drucken oder PDF'],
      ['mcp', 'claude', 'Claude verbinden'],
      ['keys', 'keyboard', 'Tastenkürzel'],
      ['name', 'user', 'Name ändern'],
      ['logout', 'logout', 'Abmelden'],
    ].filter(Boolean);
    WB.api('/stats').then(st => {
      const el = $('#popStore');
      if (el) el.textContent = `Speicher für Dateien: ${WB.fmtSize(st.bytes)} von ${WB.fmtSize(st.limit)}`;
    }).catch(() => {});
    WB.openPop(e.currentTarget, `<div class="pop-menu">${rows.map(r => `<button type="button" data-v="${r[0]}">${icon(r[1], 18)}<span>${esc(r[2])}</span></button>`).join('')}<small id="popStore" class="pop-store"></small></div>`, v => {
      WB.closePop();
      if (v === 'rename') renameBoard();
      if (v === 'tpl') templateDialog();
      if (v === 'md') downloadMd();
      if (v === 'print') printBoard();
      if (v === 'mcp') mcpDialog();
      if (v === 'keys') keysDialog();
      if (v === 'name') changeName();
      if (v === 'logout') logout();
    });
  };
  async function templateDialog() {
    if (!templates) { try { templates = (await WB.api('/templates')).templates; } catch (e) { return WB.toast(e.message); } }
    const box = WB.dialog({ title: 'Vorlage einsetzen', body: `<p class="dlg-text">Die Karten kommen unter das, was schon auf dem Board liegt.</p><div class="tpl">${templates.map(t => `<button type="button" data-tpl="${esc(t.id)}"><b>${esc(t.name)}</b><span>${esc(t.desc)}</span></button>`).join('')}</div>` });
    box.querySelector('.tpl').addEventListener('click', e => { const b = e.target.closest('[data-tpl]'); if (b) { box.close(); applyTemplate(b.dataset.tpl); } });
  }
  function changeName() {
    const box = WB.dialog({ title: 'Dein Name', body: `<label class="field">So sehen dich die anderen<input id="nmI" type="text" maxlength="40" value="${esc(S.me.name)}"></label><div class="dlg-acts"><button type="button" class="btn primary" id="nmGo">Speichern</button></div>` });
    const i = box.querySelector('#nmI');
    i.focus(); i.select();
    const go = async () => {
      const v = i.value.trim();
      if (!v) return;
      try {
        const r = await WB.api('/auth/name', { method: 'POST', body: { name: v } });
        S.me = { ...S.me, ...r };
        box.close();
        WB.paintPeers();
        WB.openBoard(S.board.id, { keepView: true });
      } catch (e) { WB.toast(e.message); }
    };
    box.querySelector('#nmGo').onclick = go;
    i.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
  }
  async function logout() {
    try { await WB.api('/auth/logout', { method: 'POST' }); } catch (_) { /* trotzdem abmelden */ }
    WB.setToken(null);
    try { localStorage.setItem('sb-wb-out', '1'); } catch (_) { /* egal */ }  // sonst meldet die gespeicherte Passphrase sofort wieder an
    location.reload();
  }
  function keysDialog() {
    const rows = [['Doppelklick', 'Neue Notiz'], ['N L T P B C M A I U D K', 'Notiz, Link, To-do, Pfeil, Board, Spalte, Kommentar, Tabelle, Bild, Upload, Skizze, Farbe'], ['Leertaste halten oder H', 'Fläche schieben'], ['⌘ Mausrad oder Pinch', 'Zoomen'], ['F', 'Alles zeigen'], ['⌘Z, ⇧⌘Z', 'Rückgängig, Wiederholen'], ['⌘C, ⌘X, ⌘V, ⌘D', 'Kopieren, Ausschneiden, Einfügen, Duplizieren'], ['⌘A', 'Alles auswählen'], ['Entf', 'In den Papierkorb'], ['Pfeiltasten', 'Auswahl verschieben, mit ⇧ weiter'], ['Enter, Esc', 'Schreiben, Fertig'], ['⌘K', 'Suchen'], ['Alt beim Ziehen', 'Ohne Einrasten']];
    WB.dialog({ title: 'Tastenkürzel', body: `<dl class="keys">${rows.map(r => `<dt>${esc(r[0])}</dt><dd>${esc(r[1])}</dd>`).join('')}</dl>` });
  }

  async function mcpDialog() {
    const box = WB.dialog({ title: 'Claude verbinden', wide: true, body: '<div id="mcpBody">Lädt.</div>' });
    const body = box.querySelector('#mcpBody');
    async function render(newToken) {
      let r;
      try { r = await WB.api('/tokens'); } catch (e) { body.textContent = e.message; return; }
      const cmd = newToken ? `claude mcp add --transport http --scope user social-bites-board ${r.mcp} --header "Authorization: Bearer ${newToken}"` : '';
      body.innerHTML = `<p class="dlg-text">Mit dem MCP kann Claude Code Boards lesen, Karten anlegen und einen Call mitschreiben. Alles erscheint hier live. Sag zum Beispiel: „Leg die drei Ideen aufs Board Mmaah“ oder „Bau aus dem Transkript ein Call Board“.</p>
        ${newToken ? `<div class="mcp-new"><b>Zugang erstellt. Der Befehl wird nur jetzt angezeigt.</b><pre><code>${esc(cmd)}</code></pre><button type="button" class="btn primary" id="mcpCopy">Befehl kopieren</button></div>` : `<label class="field">Name des Zugangs<input id="mcpLabel" type="text" maxlength="60" value="${esc(`Claude (${S.me.name})`)}"></label><div class="dlg-acts"><button type="button" class="btn primary" id="mcpMake">Zugang erstellen</button></div>`}
        <h3>Zugänge</h3>${r.tokens.length ? `<ul class="mcp-list">${r.tokens.map(t => `<li><div><b>${esc(t.label)}</b><small>Von ${esc(t.created_by)}, ${t.last_used ? `zuletzt ${esc(WB.fmtAgo(t.last_used))}` : 'noch nicht benutzt'}</small></div><button type="button" class="btn danger" data-del="${esc(t.id)}">Sperren</button></li>`).join('')}</ul>` : '<p class="dlg-hint">Noch keine.</p>'}`;
      const c = body.querySelector('#mcpCopy');
      if (c) c.onclick = () => copyText(cmd, 'Befehl kopiert. Im Terminal einfügen.');
      const m = body.querySelector('#mcpMake');
      if (m) m.onclick = async () => {
        try {
          const n = await WB.api('/tokens', { method: 'POST', body: { label: body.querySelector('#mcpLabel').value.trim() } });
          render(n.token);
        } catch (e) { WB.toast(e.message); }
      };
      body.querySelectorAll('[data-del]').forEach(b => { b.onclick = async () => { if (!window.confirm('Diesen Zugang sperren? Claude kommt damit nicht mehr aufs Board.')) return; await WB.api(`/tokens/${b.dataset.del}`, { method: 'DELETE' }).catch(e => WB.toast(e.message)); render(); }; });
    }
    render();
  }

  /* ---------- Export ---------- */
  function htmlToMd(html) {
    const d = new DOMParser().parseFromString(`<body>${WB.clean(html)}</body>`, 'text/html');
    const walk = n => {
      if (n.nodeType === 3) return n.textContent;
      if (n.nodeType !== 1) return '';
      const inner = [...n.childNodes].map(walk).join('');
      switch (n.tagName) {
        case 'H1': return `\n# ${inner}\n`;
        case 'H2': return `\n## ${inner}\n`;
        case 'H3': return `\n### ${inner}\n`;
        case 'B': case 'STRONG': return `**${inner}**`;
        case 'I': case 'EM': return `*${inner}*`;
        case 'S': case 'STRIKE': case 'DEL': return `~~${inner}~~`;
        case 'MARK': return `==${inner}==`;
        case 'CODE': return `\`${inner}\``;
        case 'BR': return '\n';
        case 'LI': return `- ${inner}\n`;
        case 'BLOCKQUOTE': return `\n> ${inner}\n`;
        case 'A': return `[${inner}](${n.getAttribute('href')})`;
        case 'P': case 'DIV': case 'UL': case 'OL': return `${inner}\n`;
        default: return inner;
      }
    };
    return walk(d.body).replace(/\n{3,}/g, '\n\n').trim();
  }
  function cardMd(c, cards, depth = 0) {
    const d = c.data;
    const pad = '  '.repeat(depth);
    switch (c.type) {
      case 'note': return htmlToMd(d.html).split('\n').map(l => pad + l).join('\n');
      case 'todo': return [d.title ? `${pad}**${d.title}**` : null, ...(d.items || []).map(i => `${pad}- [${i.done ? 'x' : ' '}] ${i.text}${i.owner ? ` (${i.owner})` : ''}${i.due ? ` bis ${i.due}` : ''}`)].filter(Boolean).join('\n');
      case 'link': return `${pad}[${d.title || d.url}](${d.url})${d.desc ? `: ${d.desc}` : ''}`;
      case 'image': return `${pad}![${d.caption || d.name || 'Bild'}](${d.src || d.url || ''})`;
      case 'file': return `${pad}[${d.name || 'Datei'}](${d.src || ''})`;
      case 'board': return `${pad}**Board:** ${d.title}`;
      case 'column': return [`\n${pad}## ${d.title || 'Spalte'}`, ...cards.filter(k => k.parent === c.id).sort((a, b) => a.pos - b.pos).map(k => cardMd(k, cards, depth))].join('\n\n');
      case 'comment': return (d.thread || []).map(m => `${pad}> ${m.by}: ${m.text}`).join('\n');
      case 'table': return (d.rows || []).map((r, i) => `${pad}| ${r.join(' | ')} |${i === 0 ? `\n${pad}|${r.map(() => ' --- |').join('')}` : ''}`).join('\n');
      case 'swatch': return `${pad}Farbe ${d.hex}${d.name ? ` ${d.name}` : ''}`;
      default: return '';
    }
  }
  function downloadMd() {
    const cards = [...S.cards.values()];
    const tops = cards.filter(c => !c.parent && c.type !== 'line').sort((a, b) => Math.round(a.y / 60) - Math.round(b.y / 60) || a.x - b.x);
    const text = `# ${S.board.title}\n\n${tops.map(c => cardMd(c, cards)).filter(Boolean).join('\n\n')}\n`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' }));
    a.download = `${S.board.title.replace(/[\\/:*?"<>|]/g, '_')}.md`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  let printView = null;
  function printBoard() {
    printView = { ...S.view };
    S.sel.clear(); WB.paintSelection();
    WB.fit();
    requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
  }
  window.addEventListener('afterprint', () => { if (printView) { WB.setView(printView); printView = null; } });

  /* ---------- Kürzel ---------- */
  document.addEventListener('keydown', e => {
    if (!S.board || $('#stage').hidden || dlg.open) return;
    const t = e.target;
    if (inField(t)) return;
    const mod = e.metaKey || e.ctrlKey;
    const k = e.key.toLowerCase();
    if (e.key === ' ') { e.preventDefault(); WB.setSpace(true); return; }
    if (mod) {
      if (k === 'z') { e.preventDefault(); if (e.shiftKey) WB.redo(); else WB.undo(); return; }
      if (k === 'y') { e.preventDefault(); WB.redo(); return; }
      if (k === 'k' || k === 'f') { e.preventDefault(); openSearch(); return; }
      if (k === 'a') { e.preventDefault(); S.sel = new Set([...S.cards.values()].filter(c => !c.parent).map(c => c.id)); WB.paintSelection(); return; }
      if (k === 'd') { e.preventDefault(); duplicate(); return; }
      if (k === '=' || k === '+') { e.preventDefault(); WB.zoomBy(1.25); return; }
      if (k === '-') { e.preventDefault(); WB.zoomBy(1 / 1.25); return; }
      if (k === '0') { e.preventDefault(); $('#btnZoom').click(); return; }
      if (k === '1') { e.preventDefault(); WB.fit(); return; }
      return;
    }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); trashSelection(); return; }
    if (e.key === 'Escape') {
      if (S.drag) { WB.cancelDrag(); return; }
      if (S.tool) WB.setTool(null);
      if (!drawer.hidden) drawer.hidden = true;
      WB.closePop();
      S.sel.clear(); WB.paintSelection();
      return;
    }
    if (e.key === 'Enter' && S.sel.size === 1) {
      const c = S.cards.get([...S.sel][0]);
      if (!c) return;
      e.preventDefault();
      if (c.type === 'board') WB.openBoard(c.data.board);
      else if (c.type === 'line') WB.editLineLabel(c.id);
      else { const f = S.els.get(c.id) && S.els.get(c.id).querySelector('[data-edit]'); if (f) WB.startEdit(c, f, 'end'); }
      return;
    }
    if (e.key.startsWith('Arrow')) {
      e.preventDefault();
      const step = e.shiftKey ? 50 : 10;
      const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
      const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
      const list = selected().filter(c => !c.parent && c.type !== 'line');
      if (list.length) WB.commit(list.map(c => ({ op: 'set', id: c.id, patch: { x: c.x + dx, y: c.y + dy } })));
      else WB.setView({ x: S.view.x - dx * 4, y: S.view.y - dy * 4 });
      return;
    }
    const map = { n: 'note', l: 'link', t: 'todo', p: 'line', b: 'board', c: 'column', m: 'comment', a: 'table', i: 'image', u: 'upload', d: 'sketch', k: 'swatch' };
    if (map[k] && !e.altKey) { e.preventDefault(); useTool(map[k]); return; }
    if (k === 'f') { WB.fit(); return; }
    if (k === 'h') { setHand(!S.hand); return; }
    if (e.key === '?') keysDialog();
  });
  document.addEventListener('keyup', e => { if (e.key === ' ') WB.setSpace(false); });
  window.addEventListener('blur', () => WB.setSpace(false));

  /* ---------- Anmeldung und Start ---------- */
  async function derive(pass) {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(SALT), iterations: 600000 }, key, 256);
    return Array.from(new Uint8Array(bits), b => b.toString(16).padStart(2, '0')).join('');
  }
  const savedPass = () => { if (WB.LOCAL && !location.search.includes('pwtest')) return ''; try { return localStorage.getItem('akq-pw') || sessionStorage.getItem('akq-pw') || ''; } catch (_) { return ''; } };
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
    const r = await WB.api('/auth/login', { method: 'POST', body: { key, name } });
    WB.setToken(r.token);
    try { localStorage.removeItem('sb-wb-out'); localStorage.setItem('sb-wb-name', r.name); localStorage.setItem(WB.LOCAL ? 'akq-pw-lokal' : 'akq-pw', pass); } catch (_) { /* egal */ }
    S.me = { name: r.name, color: r.color };
  }
  function showLogin(err) {
    $('#boot').hidden = true;
    $('#stage').hidden = true;
    $('#login').hidden = false;
    const hasPass = !!savedPass();
    $('#loginPassWrap').hidden = hasPass && !err;
    const name = savedName();
    $('#loginName').value = name;
    $('#loginErr').textContent = err || '';
    $('#loginText').textContent = hasPass && !err ? 'Noch kurz sagen, wer du bist. Danach bleibt das Board auf diesem Gerät offen.' : 'Einmal anmelden, danach bleibt das Board auf diesem Gerät offen.';
    (name ? (hasPass && !err ? $('#loginGo') : $('#loginPass')) : $('#loginName')).focus();
  }
  $('#loginPick').addEventListener('click', e => { const b = e.target.closest('[data-name]'); if (b) { $('#loginName').value = b.dataset.name; $('#loginForm').requestSubmit(); } });
  $('#loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    const name = $('#loginName').value.trim();
    const typed = $('#loginPassWrap').hidden ? '' : $('#loginPass').value;
    const pass = typed || savedPass();
    const errEl = $('#loginErr');
    if (!name) { errEl.textContent = 'Bitte deinen Namen eintragen.'; $('#loginName').focus(); return; }
    if (!pass) { errEl.textContent = 'Bitte die Passphrase eintragen.'; $('#loginPassWrap').hidden = false; $('#loginPass').focus(); return; }
    errEl.textContent = '';
    const go = $('#loginGo');
    go.disabled = true; go.textContent = 'Prüft';
    try {
      await doLogin(name, pass);
      $('#loginPass').value = '';
      await start();
    } catch (err) {
      if (err.status === 403) $('#loginPassWrap').hidden = false;
      errEl.textContent = err.message;
      if (err.status === 403) $('#loginPass').focus();
    } finally { go.disabled = false; go.textContent = 'Board öffnen'; }
  });
  WB.onAuthLost = () => {
    WB.setToken(null);
    WB.closeWs && WB.closeWs();
    S.board = null;
    showLogin('Bitte neu anmelden.');
    $('#loginPassWrap').hidden = !!savedPass();
    $('#loginErr').textContent = '';
  };

  const fromHash = () => {
    const m = new URLSearchParams(location.hash.slice(1));
    return { b: m.get('b'), c: m.get('c') };
  };
  async function start() {
    $('#boot').hidden = true;
    $('#login').hidden = true;
    $('#stage').hidden = false;
    WB.paintTrash(); WB.paintDock(); WB.paintPeers();
    const h = fromHash();
    let last = null;
    try { last = localStorage.getItem('sb-wb-last'); } catch (_) { /* egal */ }
    await WB.openBoard(h.b || last || 'home', { focus: h.c });
  }
  window.addEventListener('hashchange', () => {
    const h = fromHash();
    if (h.b && (!S.board || h.b !== S.board.id)) WB.openBoard(h.b, { focus: h.c });
    else if (h.c) WB.focusCard(h.c);
  });

  async function boot() {
    if (WB.token()) {
      try {
        S.me = await WB.api('/me');
        return start();
      } catch (e) {
        if (e.network) {
          $('#boot').textContent = 'Keine Verbindung. Versucht es gleich nochmal.';
          setTimeout(boot, 3000);
          return;
        }
      }
    }
    let out = false;
    try { out = localStorage.getItem('sb-wb-out') === '1'; } catch (_) { /* egal */ }
    if (!out && savedPass() && savedName()) {
      try { await doLogin(savedName(), savedPass()); return start(); } catch (e) {
        if (e.status !== 403) { /* Fehler zeigt das Formular */ }
      }
    }
    showLogin();
  }
  boot();
})();
