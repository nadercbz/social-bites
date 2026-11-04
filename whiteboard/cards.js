/* Social Bites Whiteboard: die Kartentypen. Jeder Typ baut sein HTML aus Daten und sagt, wie Eingaben zurück in die Daten kommen.
   Fremde Texte laufen immer durch esc() oder clean(), Links durch safeHref(), Bilder durch safeSrc(). */
(function () {
  'use strict';
  const WB = window.WB;
  const { S, esc, clean, $ } = WB;

  const svg = (d, s = 24) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const P = {
    note: '<path d="M5 4h14v11l-5 5H5z"/><path d="M14 20v-5h5"/><path d="M8.500 9h7M8.500 12.500h4"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.700 0l3-3a4 4 0 0 0-5.700-5.700l-1 1"/><path d="M14 10a4 4 0 0 0-5.700 0l-3 3a4 4 0 0 0 5.700 5.700l1-1"/>',
    todo: '<rect x="4" y="4" width="16" height="16" rx="3.500"/><path d="m8 12.200 2.800 2.800 5.200-6"/>',
    line: '<path d="M5 19 19 5"/><path d="M11 5h8v8"/>',
    board: '<rect x="3.500" y="3.500" width="7.500" height="7.500" rx="1.800"/><rect x="13" y="3.500" width="7.500" height="7.500" rx="1.800"/><rect x="3.500" y="13" width="7.500" height="7.500" rx="1.800"/><rect x="13" y="13" width="7.500" height="7.500" rx="1.800"/>',
    column: '<rect x="4.500" y="3.500" width="15" height="17" rx="2.800"/><path d="M4.500 8.500h15M8.500 12.500h7M8.500 16h7"/>',
    comment: '<path d="M4 5.500A1.500 1.500 0 0 1 5.500 4h13A1.500 1.500 0 0 1 20 5.500v9a1.500 1.500 0 0 1-1.500 1.500H10l-4.500 4v-4A1.500 1.500 0 0 1 4 14.500z"/>',
    table: '<rect x="3.500" y="4.500" width="17" height="15" rx="2.200"/><path d="M3.500 9.700h17M3.500 14.700h17M10 4.500v15"/>',
    image: '<rect x="3.500" y="4.500" width="17" height="15" rx="2.200"/><circle cx="9" cy="10" r="1.600"/><path d="m4.500 17.500 4.500-4.500 3.200 3.200 3-3 4.500 4.500"/>',
    upload: '<path d="M12 16V5"/><path d="m7.500 9.500 4.500-4.500 4.500 4.500"/><path d="M4.500 16v3.500h15V16"/>',
    sketch: '<path d="M4 20c2.200-.8 3.300-1.100 4.700-2.500L19 7.200a2.100 2.100 0 0 0-3-3L5.700 14.500C4.300 15.900 4.700 18 4 20z"/>',
    swatch: '<path d="M12 3.500s6 6 6 10.500a6 6 0 0 1-12 0c0-4.500 6-10.500 6-10.500z"/>',
    trash: '<path d="M5 7h14M10 7V4.500h4V7M7 7l1 13h8l1-13"/>',
    search: '<circle cx="11" cy="11" r="6.500"/><path d="m16 16 4 4"/>',
    more: '<circle cx="5" cy="12" r="1.300" fill="currentColor"/><circle cx="12" cy="12" r="1.300" fill="currentColor"/><circle cx="19" cy="12" r="1.300" fill="currentColor"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>',
    fit: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    hand: '<path d="M8 12V5.500a1.500 1.500 0 0 1 3 0V11m0-1V4.500a1.500 1.500 0 0 1 3 0V11m0-4.500a1.500 1.500 0 0 1 3 0V13c0 4-2.500 7-6 7-2.500 0-4-1-5.500-3.500L4 13.500c-.8-1.400 1-2.800 2.200-1.700L8 13.500"/>',
    undo: '<path d="M8 6 4 10l4 4"/><path d="M4 10h10a5 5 0 0 1 0 10h-3"/>',
    redo: '<path d="m16 6 4 4-4 4"/><path d="M20 10H10a5 5 0 0 0 0 10h3"/>',
    copy: '<rect x="8.500" y="8.500" width="11.500" height="11.500" rx="2"/><path d="M5.500 15.500H5A1.500 1.500 0 0 1 3.500 14V5A1.500 1.500 0 0 1 5 3.500h9A1.500 1.500 0 0 1 15.500 5v.5"/>',
    open: '<path d="M8 16 19 5"/><path d="M11 5h8v8"/><path d="M5 9v10h10"/>',
    play: '<path d="M8 5.500v13l11-6.500z" fill="currentColor"/>',
    check: '<path d="m5 12.500 4.500 4.500L19 7"/>',
    call: '<path d="M6.500 4h3l1.500 4.500-2 1.500a11 11 0 0 0 5 5l1.500-2 4.500 1.500v3A2 2 0 0 1 18 19.500C10.500 19 5 13.500 4.500 6A2 2 0 0 1 6.500 4z"/>',
    idea: '<path d="M9 17.500h6M10 20.500h4"/><path d="M12 3.500a6 6 0 0 0-3.500 10.900c.6.400 1 1 1 1.600h5c0-.6.400-1.200 1-1.600A6 6 0 0 0 12 3.500z"/>',
    camera: '<path d="M4 8h3.500L9 5.500h6L16.500 8H20v11H4z"/><circle cx="12" cy="13" r="3.500"/>',
    film: '<rect x="3.500" y="5" width="17" height="14" rx="2.200"/><path d="M8 5v14M16 5v14M3.500 9.700H8M3.500 14.300H8M16 9.700h4.500M16 14.300h4.500"/>',
    chart: '<path d="M4 20V5M4 20h16"/><path d="M8.500 16v-5M13 16V8M17.500 16v-3"/>',
    megaphone: '<path d="M4 10v4l11 4.500V5.500z"/><path d="M15 9.500a3 3 0 0 1 0 5"/><path d="m7.500 15.500 1.200 4h2.800l-1-2.700"/>',
    star: '<path d="m12 4 2.400 5.200 5.600.7-4.100 3.800 1.100 5.600L12 16.500l-5 2.800 1.100-5.600L4 9.900l5.600-.7z"/>',
    heart: '<path d="M12 20s-7.500-4.500-7.500-10A4.300 4.300 0 0 1 12 7.300 4.300 4.300 0 0 1 19.500 10c0 5.500-7.500 10-7.500 10z"/>',
    food: '<path d="M4 11.500h16a8 8 0 0 1-16 0z"/><path d="M4 11.500c.5-4 4-6.500 8-6.500s7.500 2.500 8 6.500"/><path d="M4 15.500h16"/>',
    brush: '<path d="M14.500 5.500 18.500 9.500 11 17l-4-4z"/><path d="M7 13c-2 .5-2.500 2.500-3 5 2.500-.5 4.500-1 5-3"/><path d="M16 4l4 4"/>',
    folder: '<path d="M3.500 6.500A1.500 1.500 0 0 1 5 5h4.500l2 2.500H19a1.500 1.500 0 0 1 1.500 1.500v8.500A1.500 1.500 0 0 1 19 19H5a1.500 1.500 0 0 1-1.500-1.500z"/>',
    users: '<circle cx="9" cy="8.500" r="3.500"/><path d="M3 19.500c.5-3.400 3-5.500 6-5.500s5.500 2.100 6 5.500"/><path d="M16 5.300a3.500 3.500 0 0 1 0 6.400M18 14.500c1.700.8 2.700 2.600 3 5"/>',
    pin: '<path d="M12 21s-6.500-6-6.500-11a6.500 6.500 0 0 1 13 0c0 5-6.500 11-6.500 11z"/><circle cx="12" cy="10" r="2.300"/>',
    rocket: '<path d="M12 3.500c3.500 2 5 5.500 5 9l-2 3.500H9l-2-3.500c0-3.500 1.500-7 5-9z"/><circle cx="12" cy="10" r="1.700"/><path d="M9 16l-2.500 4M15 16l2.500 4M12 17v3.500"/>',
    doc: '<path d="M6 3.500h8l4.500 4.500v12.500H6z"/><path d="M14 3.500V8h4.500"/>',
    download: '<path d="M12 5v11"/><path d="m7.500 11.500 4.500 4.500 4.500-4.500"/><path d="M4.500 19.500h15"/>',
    back: '<path d="M4 12h14"/><path d="m9 7-5 5 5 5"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    alignL: '<path d="M4 4v16M8 8h11M8 16h7"/>', alignC: '<path d="M12 4v16M6 8h12M8 16h8"/>', alignR: '<path d="M20 4v16M5 8h11M9 16h7"/>',
    alignT: '<path d="M4 4h16M8 8v11M16 8v7"/>', alignM: '<path d="M4 12h16M8 6v12M16 8v8"/>', alignB: '<path d="M4 20h16M8 5v11M16 9v7"/>',
    front: '<path d="M12 15V4"/><path d="m7.500 8.500 4.500-4.500 4.500 4.500"/><path d="M5 20h14"/>',
    moveto: '<path d="M3.500 6.500A1.500 1.500 0 0 1 5 5h4.500l2 2.500H19a1.500 1.500 0 0 1 1.500 1.500v8.500A1.500 1.500 0 0 1 19 19H5a1.500 1.500 0 0 1-1.500-1.500z"/><path d="M9 13h6M12.500 10.500 15 13l-2.500 2.500"/>',
    collapse: '<path d="m7 10 5 5 5-5"/>',
    print: '<path d="M7 8V3.500h10V8"/><rect x="4" y="8" width="16" height="8" rx="1.500"/><path d="M7 13.500h10v7H7z"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 8-8M16 7l3 3"/>',
    claude: '<path d="M12 3.500v17M3.500 12h17M6 6l12 12M18 6 6 18"/>',
    user: '<circle cx="12" cy="8.500" r="4"/><path d="M4.500 20c.7-3.800 3.800-6 7.500-6s6.800 2.200 7.500 6"/>',
    logout: '<path d="M14 4.500H5v15h9"/><path d="M10 12h10M16 8l4 4-4 4"/>',
    keyboard: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10h.01M11 10h.01M15 10h.01M7 14h10"/>',
    palette: '<path d="M12 3.500a8.500 8.500 0 1 0 0 17c1.500 0 2-1 2-2 0-1.500 1-2 2-2h1.500a3 3 0 0 0 3-3c0-5.500-4-10-8.500-10z"/><circle cx="8" cy="11" r="1"/><circle cx="12" cy="8" r="1"/><circle cx="16" cy="11" r="1"/>',
    refresh: '<path d="M20 6v5h-5"/><path d="M4 18v-5h5"/><path d="M6 9a7 7 0 0 1 12-1.500L20 11M18 15a7 7 0 0 1-12 1.500L4 13"/>',
    pencil: '<path d="M4 20l1-4.500L16 4.500a2 2 0 0 1 3 3L8 18.500z"/>',
    expand: '<path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/>',
    label: '<path d="M4 7h16M12 7v12M8.500 19h7"/>',
  };
  WB.icon = (name, size) => svg(P[name] || P.note, size);
  WB.BOARD_ICONS = ['board', 'call', 'idea', 'camera', 'film', 'chart', 'megaphone', 'star', 'heart', 'food', 'brush', 'folder', 'users', 'pin', 'rocket', 'doc'];
  WB.COLORS = [['white', 'Weiß'], ['mint', 'Mint'], ['peach', 'Pfirsich'], ['orange', 'Orange'], ['yellow', 'Gelb'], ['blue', 'Blau'], ['lilac', 'Flieder'], ['rose', 'Rosé'], ['charcoal', 'Kohle'], ['none', 'Ohne']];
  WB.LINE_COLORS = [['ink', '#232321'], ['orange', '#F26A21'], ['green', '#17835A'], ['blue', '#2F6FED'], ['rose', '#C2336A'], ['grey', '#8D8F88']];

  WB.CARD_DEFAULT = { note: 260, todo: 300, link: 300, board: 176, column: 290, comment: 280, table: 440, image: 340, file: 280, swatch: 150, sketch: 360, video: 400 };

  /* ---------- Hilfen für Karteninhalte ---------- */
  const field = (name, value, ph, tag = 'div', extra = '') => `<${tag} class="fld" data-edit="${name}" data-ph="${esc(ph)}" ${extra}>${esc(value || '')}</${tag}>`;
  const assetName = d => d.name || 'Datei';

  const T = WB.T = {};

  T.note = {
    render(el, c) { el.innerHTML = `<div class="rich fld" data-edit="html" data-rich="1" data-ph="Notiz schreiben">${clean(c.data.html)}</div>`; },
    read(f) { return { html: clean(f.innerHTML) }; },
    isEmpty(c) { return !WB.plainOf(c.data.html); },
  };

  T.todo = {
    render(el, c) {
      const d = c.data, items = d.items || [];
      const done = items.filter(i => i.done).length;
      const show = d.hideDone ? items.filter(i => !i.done) : items;
      el.innerHTML = `<div class="td-head">${field('title', d.title, 'To-do Liste')}<span class="td-count" ${items.length ? '' : 'hidden'}>${done}/${items.length}</span></div>
        <div class="td-bar" ${items.length ? '' : 'hidden'}><i style="width:${items.length ? Math.round(done / items.length * 100) : 0}%"></i></div>
        <ul class="td-list">${show.map(i => `<li data-item="${esc(i.id)}" class="${i.done ? 'done' : ''}">
          <button class="td-box" type="button" data-act="todo-toggle" aria-label="${i.done ? 'Haken entfernen' : 'Abhaken'}" aria-pressed="${!!i.done}">${i.done ? svg(P.check, 14) : ''}</button>
          <div class="td-main"><div class="fld td-text" data-edit="item" data-ph="Eintrag">${esc(i.text)}</div>
          ${i.owner || i.due ? `<div class="td-meta">${i.owner ? `<span>${esc(i.owner)}</span>` : ''}${i.due ? `<span>bis ${esc(i.due)}</span>` : ''}</div>` : ''}</div>
          <button class="td-more" type="button" data-act="todo-menu" aria-label="Eintrag bearbeiten">${svg(P.more, 16)}</button>
        </li>`).join('')}</ul>
        ${d.hideDone && done ? `<div class="td-hidden">${done} erledigt ausgeblendet</div>` : ''}
        <button class="td-add" type="button" data-act="todo-add">${svg(P.plus, 15)}<span>Eintrag</span></button>`;
    },
    read(f, c) {
      if (f.dataset.edit === 'title') return { title: f.textContent };
      const id = f.closest('[data-item]').dataset.item;
      const items = WB.clone(c.data.items || []);
      const it = items.find(i => i.id === id);
      if (it) it.text = f.textContent;
      return { items };
    },
    key(e, f, c) {
      if (f.dataset.edit !== 'item') {
        if (e.key === 'Enter') { e.preventDefault(); T.todo.addAfter(c, null); }
        return true;
      }
      const li = f.closest('[data-item]');
      const id = li.dataset.item;
      const items = c.data.items || [];
      const idx = items.findIndex(i => i.id === id);
      if (e.key === 'Enter') { e.preventDefault(); if (!f.textContent.trim()) WB.stopEdit(); else T.todo.addAfter(c, id); return true; }
      if (e.key === 'Backspace' && !f.textContent) {
        e.preventDefault();
        const prev = items[idx - 1];
        WB.stopEdit();
        const before = c.data.items.filter(i => i.id !== id);
        WB.commit([{ op: 'set', id: c.id, patch: { data: { items: before } } }]);
        if (prev) T.todo.focusItem(c, prev.id, true);
        return true;
      }
      if (e.key === 'ArrowUp' && items[idx - 1]) { e.preventDefault(); WB.stopEdit(); T.todo.focusItem(c, items[idx - 1].id, true); return true; }
      if (e.key === 'ArrowDown' && items[idx + 1]) { e.preventDefault(); WB.stopEdit(); T.todo.focusItem(c, items[idx + 1].id, true); return true; }
      return false;
    },
    addAfter(c, afterId) {
      WB.ensureSent(c.id);
      WB.stopEdit();
      const items = WB.clone(c.data.items || []);
      const it = { id: WB.rid(), text: '', done: false };
      const idx = afterId ? items.findIndex(i => i.id === afterId) : items.length - 1;
      items.splice(idx + 1, 0, it);
      WB.commit([{ op: 'set', id: c.id, patch: { data: { items } } }]);
      T.todo.focusItem(c, it.id);
    },
    focusItem(c, id, end) {
      const el = S.els.get(c.id);
      const f = el && el.querySelector(`[data-item="${CSS.escape(id)}"] [data-edit="item"]`);
      if (f) WB.startEdit(c, f, end ? 'end' : null);
    },
    afterEdit(c) {
      const items = c.data.items || [];
      if (items.some(i => !i.text.trim())) {
        const clean2 = items.filter(i => i.text.trim());
        WB.commit([{ op: 'set', id: c.id, patch: { data: { items: clean2 } } }], { history: false });
      }
    },
    isEmpty(c) { return !(c.data.title || '').trim() && !(c.data.items || []).some(i => i.text.trim()); },
  };

  T.link = {
    render(el, c) {
      const d = c.data;
      if (!d.url) {
        el.innerHTML = `<div class="lk-new">${svg(P.link, 18)}<input class="lk-input" type="url" inputmode="url" enterkeyhint="done" placeholder="Link einfügen" aria-label="Link einfügen" autocomplete="off"></div>`;
        return;
      }
      const href = WB.safeHref(d.url);
      const img = WB.safeSrc(d.image);
      const playing = el._playing && d.embed && WB.safeHref(d.embed);
      el.innerHTML = `${playing ? `<div class="lk-frame"><iframe src="${esc(WB.safeHref(d.embed))}" title="${esc(d.title || 'Video')}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen referrerpolicy="no-referrer"></iframe></div>`
        : img || d.embed ? `<div class="lk-img">${img ? `<img src="${esc(img)}" alt="" loading="lazy" draggable="false" referrerpolicy="no-referrer">` : ''}${d.embed ? `<button class="lk-play" type="button" data-act="link-play" aria-label="Video abspielen">${svg(P.play, 22)}</button>` : ''}</div>` : ''}
        <div class="lk-body">
          <div class="lk-title">${esc(d.title || d.site || d.url)}${d.loading ? ' <span class="lk-wait">Vorschau lädt</span>' : ''}</div>
          ${d.desc ? `<div class="lk-desc">${esc(d.desc)}</div>` : ''}
          <a class="lk-site" href="${esc(href || '#')}" target="_blank" rel="noopener noreferrer" data-act="link-open">${svg(P.open, 13)}<span>${esc(d.site || d.url)}</span></a>
        </div>`;
    },
    isEmpty(c) { return !c.data.url; },
  };
  T.video = T.link;

  T.image = {
    render(el, c) {
      const d = c.data;
      const src = WB.safeSrc(d.src || d.url);
      const ratio = d.ratio ? `style="aspect-ratio:${1 / d.ratio}"` : '';
      el.innerHTML = `<div class="im-wrap" ${ratio}>${src ? `<img src="${esc(src)}" alt="${esc(d.caption || d.name || '')}" loading="lazy" draggable="false" referrerpolicy="no-referrer">` : '<div class="im-missing">Bild fehlt</div>'}${d.uploading ? '<div class="im-up" role="status"><i></i><span>Lädt hoch</span></div>' : ''}</div>
        ${field('caption', d.caption, 'Bildtext', 'div', `class="fld im-cap ${d.caption ? '' : 'is-empty'}"`).replace('class="fld" ', '')}`;
      const img = el.querySelector('img');
      if (img && !d.ratio) img.addEventListener('load', () => {
        if (!S.cards.has(c.id) || !img.naturalWidth) return;
        c.data.ratio = img.naturalHeight / img.naturalWidth;
        el.querySelector('.im-wrap').style.aspectRatio = String(1 / c.data.ratio);
        WB.scheduleLines();
      }, { once: true });
      if (img) img.addEventListener('load', () => WB.scheduleLines(), { once: true });
    },
    read(f) { return { caption: f.textContent }; },
  };

  const fileIcon = m => (/^image/.test(m) ? 'image' : /^video/.test(m) ? 'film' : /^audio/.test(m) ? 'megaphone' : 'doc');
  T.file = {
    render(el, c) {
      const d = c.data;
      const src = WB.safeSrc(d.src);
      const media = !d.uploading && src && /^video\//.test(d.mime || '') ? `<video src="${esc(src)}" controls preload="metadata" playsinline></video>`
        : !d.uploading && src && /^audio\//.test(d.mime || '') ? `<audio src="${esc(src)}" controls preload="metadata"></audio>` : '';
      el.innerHTML = `${media}<div class="fl-row"><span class="fl-ic">${svg(P[fileIcon(d.mime || '')], 22)}</span>
        <div class="fl-main"><div class="fl-name">${esc(assetName(d))}</div><div class="fl-size">${d.uploading ? 'Lädt hoch' : esc(d.size ? WB.fmtSize(d.size) : '')}</div></div>
        ${src && !d.uploading ? `<a class="fl-get" href="${esc(src)}" target="_blank" rel="noopener noreferrer" data-act="link-open" aria-label="Herunterladen" download="${esc(assetName(d))}">${svg(P.download, 18)}</a>` : ''}</div>`;
    },
  };

  T.board = {
    render(el, c) {
      const d = c.data;
      const n = S.counts[d.board];
      el.innerHTML = `<div class="bd-tile">${svg(P[d.icon] || P.board, 30)}</div>
        <div class="fld bd-title" data-edit="title" data-ph="Board Name">${esc(d.title || '')}</div>
        <div class="bd-count">${n === undefined ? 'Board' : n === 1 ? '1 Karte' : `${n} Karten`}</div>`;
    },
    read(f) { return { title: f.textContent.trim() || 'Ohne Titel' }; },
    afterEdit(c) {
      if (c.data.board) WB.send([{ op: 'board', id: c.data.board, patch: { title: c.data.title } }]);
    },
  };

  T.column = {
    render(el, c) {
      const d = c.data;
      let list = el.querySelector(':scope > .col-list');
      const headHtml = `<div class="fld col-title" data-edit="title" data-ph="Spalte">${esc(d.title || '')}</div><span class="col-n"></span><button class="col-fold" type="button" data-act="col-fold" aria-label="${d.collapsed ? 'Aufklappen' : 'Einklappen'}" aria-expanded="${!d.collapsed}">${svg(P.collapse, 16)}</button>`;
      let head = el.querySelector(':scope > .col-head');
      if (!head) {
        el.innerHTML = '';
        head = document.createElement('div'); head.className = 'col-head'; el.appendChild(head);
        list = document.createElement('div'); list.className = 'col-list'; el.appendChild(list);
        const add = document.createElement('button'); add.type = 'button'; add.className = 'col-add'; add.dataset.act = 'col-add'; add.innerHTML = `${svg(P.plus, 15)}<span>Notiz</span>`; el.appendChild(add);
      }
      head.innerHTML = headHtml;
      el.classList.toggle('folded', !!d.collapsed);
      WB.countColumn(c.id);
    },
    read(f) { return { title: f.textContent }; },
  };
  WB.countColumn = id => {
    const el = S.els.get(id);
    const n = el && el.querySelector(':scope > .col-head .col-n');
    if (n) { const k = el.querySelector(':scope > .col-list').children.length; n.textContent = k || ''; }
  };

  T.comment = {
    render(el, c) {
      const d = c.data;
      const th = d.thread || [];
      el.classList.toggle('resolved', !!d.resolved);
      el.innerHTML = `<ul class="cm-list">${th.map(m => `<li><div class="cm-who"><i style="background:${esc(colorFor(m.by))}"></i><b>${esc(m.by)}</b><time>${esc(WB.fmtAgo(m.at))}</time></div><div class="cm-text">${esc(m.text)}</div></li>`).join('')}</ul>
        <textarea class="cm-input" rows="1" enterkeyhint="send" placeholder="${th.length ? 'Antworten' : 'Kommentar schreiben'}" aria-label="Kommentar schreiben"></textarea>`;
    },
    isEmpty(c) { return !(c.data.thread || []).length; },
  };
  function colorFor(name) {
    const k = String(name || '').toLowerCase();
    if (k === 'nader') return '#F26A21';
    if (k === 'tommy') return '#2F6FED';
    if (k.startsWith('claude')) return '#7B4BD1';
    let h = 0;
    for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) >>> 0;
    return ['#F26A21', '#2F6FED', '#17835A', '#C2336A', '#7B4BD1', '#0E8C8C', '#B5720B', '#3F5B6B'][h % 8];
  }
  WB.colorFor = colorFor;

  T.table = {
    render(el, c) {
      const d = c.data;
      const rows = d.rows && d.rows.length ? d.rows : [['', ''], ['', '']];
      el.innerHTML = `<div class="tb-wrap"><table class="${d.header === false ? '' : 'has-head'}"><tbody>${rows.map((r, ri) => `<tr>${r.map((v, ci) => `<td><div class="fld tb-cell" data-edit="cell" data-r="${ri}" data-c="${ci}">${esc(v)}</div></td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    },
    read(f, c) {
      const rows = WB.clone(c.data.rows && c.data.rows.length ? c.data.rows : [['', ''], ['', '']]);
      const r = +f.dataset.r, col = +f.dataset.c;
      if (rows[r]) rows[r][col] = f.textContent;
      return { rows };
    },
    key(e, f, c) {
      const r = +f.dataset.r, col = +f.dataset.c;
      const rows = c.data.rows || [];
      const cols = (rows[0] || []).length;
      const go = (nr, nc) => {
        const el = S.els.get(c.id);
        WB.stopEdit();
        const t = el.querySelector(`[data-r="${nr}"][data-c="${nc}"]`);
        if (t) WB.startEdit(c, t, 'end');
      };
      if (e.key === 'Tab') {
        e.preventDefault();
        let nr = r, nc = col + (e.shiftKey ? -1 : 1);
        if (nc >= cols) { nc = 0; nr++; }
        if (nc < 0) { nc = cols - 1; nr--; }
        if (nr >= rows.length) { T.table.addRow(c); nr = rows.length; }
        if (nr >= 0) go(nr, nc);
        return true;
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (r + 1 >= rows.length) T.table.addRow(c);
        go(r + 1, col);
        return true;
      }
      return false;
    },
    // Aus Excel oder Sheets eingefügt: füllt die Tabelle ab der aktuellen Zelle.
    paste(e, f, c) {
      const text = e.clipboardData && e.clipboardData.getData('text/plain');
      if (!text || !/[\t\n]/.test(text.trim())) return false;
      e.preventDefault();
      const incoming = text.replace(/\r/g, '').replace(/\n$/, '').split('\n').map(l => l.split('\t'));
      const r0 = +f.dataset.r, c0 = +f.dataset.c;
      WB.stopEdit();
      const rows = WB.clone(c.data.rows);
      const width = Math.max(rows[0].length, c0 + Math.max(...incoming.map(l => l.length)));
      while (rows.length < r0 + incoming.length) rows.push(Array(width).fill(''));
      rows.forEach(rw => { while (rw.length < width) rw.push(''); });
      incoming.forEach((l, i) => l.forEach((v, j) => { rows[r0 + i][c0 + j] = v.slice(0, 2000); }));
      WB.commit([{ op: 'set', id: c.id, patch: { data: { rows } } }]);
      return true;
    },
    addRow(c) { const rows = WB.clone(c.data.rows); rows.push(Array((rows[0] || ['']).length).fill('')); WB.commit([{ op: 'set', id: c.id, patch: { data: { rows } } }]); },
    addCol(c) { const rows = WB.clone(c.data.rows).map(r => [...r, '']); WB.commit([{ op: 'set', id: c.id, patch: { data: { rows } } }]); },
    delRow(c) { const rows = WB.clone(c.data.rows); if (rows.length > 1) { rows.pop(); WB.commit([{ op: 'set', id: c.id, patch: { data: { rows } } }]); } },
    delCol(c) { const rows = WB.clone(c.data.rows); if (rows[0].length > 1) { WB.commit([{ op: 'set', id: c.id, patch: { data: { rows: rows.map(r => r.slice(0, -1)) } } }]); } },
  };

  const rgbOf = hex => { const n = parseInt(hex.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  T.swatch = {
    render(el, c) {
      const d = c.data;
      const hex = /^#[0-9a-fA-F]{6}$/.test(d.hex || '') ? d.hex.toUpperCase() : '#F26A21';
      el.innerHTML = `<button class="sw-color" type="button" data-act="swatch-copy" style="background:${hex}" aria-label="Farbwert ${hex} kopieren"></button>
        <div class="sw-body">${field('name', d.name, 'Name')}<div class="sw-val">${hex}<br>${rgbOf(hex).join(' ')}</div></div>`;
    },
    read(f) { return { name: f.textContent }; },
  };

  T.sketch = {
    render(el, c) {
      const d = c.data;
      const vw = d.vw || 800, vh = d.vh || 600;
      const paths = (d.paths || []).map(p => `<path d="${esc(String(p.d || '').replace(/[^MLQ0-9.,\s-]/g, ''))}" stroke="${esc(/^#[0-9a-fA-F]{3,8}$/.test(p.c) ? p.c : '#232321')}" stroke-width="${Number(p.s) || 4}"/>`).join('');
      el.innerHTML = `<svg class="sk-view" viewBox="0 0 ${vw} ${vh}" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-label="Skizze">${paths}</svg>${(d.paths || []).length ? '' : '<div class="sk-empty">Doppelklick zum Zeichnen</div>'}`;
    },
  };

  /* ---------- Karten in den Baum hängen ---------- */
  const cardsLayer = () => $('#cards');
  const colList = id => { const el = S.els.get(id); return el && el.querySelector(':scope > .col-list'); };

  WB.renderCard = function (c) {
    if (c.type === 'line') { WB.scheduleLines(); return null; }
    const R = T[c.type];
    if (!R) return null;
    let el = S.els.get(c.id);
    if (!el) {
      el = document.createElement('div');
      el.dataset.id = c.id;
      S.els.set(c.id, el);
    }
    const color = c.data.color || (c.type === 'column' ? 'tint' : 'white');
    const base = `card t-${c.type} c-${color}`;
    const keep = ['dragging', 'folded', 'resolved', 'pulse', 'eaten'].filter(k => el.classList.contains(k));
    el.className = [base, S.sel.has(c.id) ? 'sel' : '', ...keep].filter(Boolean).join(' ');
    const list = c.parent ? colList(c.parent) : null;
    if (c.parent && !list && S.cards.has(c.parent)) {
      const col = S.cards.get(c.parent);
      WB.renderCard(col);
    }
    const target = c.parent ? colList(c.parent) : null;
    if (target) {
      if (el.parentNode !== target) target.appendChild(el);
      el.style.left = el.style.top = el.style.width = el.style.zIndex = '';
    } else {
      if (el.parentNode !== cardsLayer()) cardsLayer().appendChild(el);
      if (!(S.drag && S.drag.ids && S.drag.ids.has(c.id))) { el.style.left = `${c.x}px`; el.style.top = `${c.y}px`; }
      el.style.width = `${c.w}px`;
      el.style.zIndex = String(c.z || 1);
    }
    const key = JSON.stringify(c.data) + (c.type === 'board' ? S.counts[c.data.board] : '');
    if (el._key !== key && S.editing !== c.id) { el._key = key; R.render(el, c); }
    WB.observeCard(el);
    return el;
  };

  WB.sortColumn = function (id) {
    const list = colList(id);
    if (!list) return;
    const kids = [...S.cards.values()].filter(k => k.parent === id).sort((a, b) => a.pos - b.pos);
    kids.forEach(k => { const el = S.els.get(k.id); if (el && !(S.drag && S.drag.ids && S.drag.ids.has(k.id))) list.appendChild(el); });
    WB.countColumn(id);
  };

  WB.renderAll = function () {
    const all = [...S.cards.values()];
    all.filter(c => c.type === 'column').forEach(c => WB.renderCard(c));
    all.filter(c => c.type !== 'column').forEach(c => WB.renderCard(c));
    all.filter(c => c.type === 'column').forEach(c => WB.sortColumn(c.id));
    WB.scheduleLines();
    WB.paintSelection();
  };

  WB.dropCard = function (id) {
    const el = S.els.get(id);
    if (el) { el.remove(); S.els.delete(id); }
  };
})();
