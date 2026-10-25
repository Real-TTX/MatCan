/* DesignThix editor, part 10d: comments (docs/PLAN-PLATFORM.md section 1.18). The rail entry "Kommentare" with a badge (open threads), the panel (filter Offen / Erledigt / Alle, "Nur diese Seite",
   threads with replies, the composer at the bottom with @mentions), and the PINS on the canvas: round markers in their own layer (#dt-pins) inside the sheet, NEVER in the document, so they are not in
   a download, a print, a thumbnail or the public view. A pin sits at its point (document units, drawn at app.scale()); a pin on an element follows the centre of the element while it exists. Anybody who
   may see the design may comment, also in the read-only editor. All text goes to the page through textContent; the pins and the panel never use markup strings or style attributes.
   Writing a comment: type and send (the pin is the current page, or the selected element: "An Element heften"), or "Kommentar setzen" (cursor crosshair, one click on the page, Esc cancels), or the key K /
   the context menu "Kommentieren" for the selection. A person who opens `?comment=<id>` (a notification) gets the panel with that thread. The list is fetched every 30 s while the tab is visible and after
   every own write. D.comments = { init, compose(options), openThread(id), openCount(), canComment(), reload(), state() }. */
(function () {
  'use strict';

  var D = window.DtDesigner;
  var POLL_MS = 30000;
  var MAX_TEXT = 2000;
  var app;
  var config;
  var layer = null;                // #dt-pins
  var hint = null;                 // the banner while a pin is being placed
  var ui = null;                   // the parts of the panel while it is shown
  var pinEls = new Map();
  var loadSeq = 0;
  var placing = false;
  var timer = 0;
  var state = {
    threads: [], open: 0, total: 0, canComment: true, loaded: false, signature: '',
    filter: 'open', thisPage: false, activeId: 0,
    composerText: '', composerPicked: {}, replyText: {}, replyPicked: {}, editing: 0, editText: '', editPicked: {},
  };
  var draft = { pageId: null, elementId: null, x: null, y: null };      // the pin of the comment being written
  var focusInfo = null;

  function request(method, url, body) {
    return D.request(method, url, body).catch(function () { return { ok: false, status: 0, data: null, offline: true }; });
  }

  function errorText(res) {
    if (res.offline) { return 'Keine Verbindung: Das hat nicht geklappt.'; }
    if (res.data && res.data.error) { return res.data.error; }
    if (res.status === 403 || res.status === 404) { return 'Das geht nicht (mehr). Die Kommentare werden neu geladen.'; }
    return 'Das hat nicht geklappt.';
  }

  function emptyDraft() { return { pageId: null, elementId: null, x: null, y: null }; }

  // ================================================================================================ small helpers

  function avatarNode(name, small) {
    if (window.DtShare && window.DtShare.avatar) { return window.DtShare.avatar(name, small ? { size: 'sm' } : {}); }
    return D.el('span', { class: 'mat-avatar' + (small ? ' mat-avatar--sm' : ''), text: String(name || '?').slice(0, 1).toUpperCase(), 'aria-hidden': 'true' });
  }

  function ago(iso) {
    var t = new Date(iso).getTime();
    if (isNaN(t)) { return ''; }
    var s = Math.max(0, (Date.now() - t) / 1000);
    if (s < 60) { return 'gerade eben'; }
    if (s < 3600) { return 'vor ' + Math.floor(s / 60) + ' Min.'; }
    if (s < 86400) { return 'vor ' + Math.floor(s / 3600) + ' Std.'; }
    if (s < 7 * 86400) { return 'vor ' + Math.floor(s / 86400) + ' Tg.'; }
    return new Date(t).toLocaleDateString('de-DE');
  }

  function fullDate(iso) {
    var d = new Date(iso);
    return isNaN(d.getTime()) ? '' : d.toLocaleString('de-DE');
  }

  function escapeRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  /** The text of a comment into a node: plain, line breaks kept by the style, the @Names of the mentioned people highlighted. */
  function renderText(node, text, mentions) {
    D.empty(node);
    var names = (mentions || []).map(function (m) { return m.name; }).filter(Boolean).sort(function (a, b) { return b.length - a.length; });
    if (!names.length) { node.textContent = text; return; }
    var re = new RegExp('@(' + names.map(escapeRe).join('|') + ')', 'gi');
    var last = 0;
    var m;
    while ((m = re.exec(text))) {
      if (m.index > last) { node.appendChild(document.createTextNode(text.slice(last, m.index))); }
      node.appendChild(D.el('span', { class: 'dt-cm-mention', text: m[0] }));
      last = m.index + m[0].length;
    }
    if (last < text.length) { node.appendChild(document.createTextNode(text.slice(last))); }
  }

  function pageIndexOf(pageId) {
    if (!pageId || !app.doc) { return -1; }
    return app.doc.pages.findIndex(function (p) { return p.id === pageId; });
  }

  function pageLabel(pageId) {
    var i = pageIndexOf(pageId);
    if (i < 0) { return 'Ohne Seite'; }
    var p = app.doc.pages[i];
    return p.name || 'Seite ' + (i + 1);
  }

  function elementLabel(id) {
    var e = id ? app.element(id) : null;
    if (!e) { return null; }
    var title = String(D.elementTitle(e));
    return title.length > 24 ? title.slice(0, 23).trim() + '…' : title;
  }

  function centreOf(id) {
    var r = app.locate(id, false);
    if (!r) { return null; }
    return D.toWorld(r.chain, { x: r.el.x + r.el.w / 2, y: r.el.y + r.el.h / 2 });
  }

  function findThread(id) {
    for (var i = 0; i < state.threads.length; i++) {
      var t = state.threads[i];
      if (t.id === id) { return t; }
      for (var j = 0; j < t.replies.length; j++) { if (t.replies[j].id === id) { return t; } }
    }
    return null;
  }

  function threadPageIndex(t) { var i = pageIndexOf(t.pageId); return i < 0 ? 1e6 : i; }

  function sortedThreads() {
    return state.threads.slice().sort(function (a, b) {
      return threadPageIndex(a) - threadPageIndex(b) || new Date(a.created) - new Date(b.created) || a.id - b.id;
    });
  }

  function visibleThreads() {
    var pageId = app.doc ? app.page().id : null;
    return sortedThreads().filter(function (t) {
      if (state.filter === 'open' && t.resolved) { return false; }
      if (state.filter === 'done' && !t.resolved) { return false; }
      if (state.thisPage && t.pageId !== pageId) { return false; }
      return true;
    });
  }

  // ================================================================================================ loading

  function load() {
    var seq = ++loadSeq;
    return request('GET', '/api/designs/' + app.id + '/comments').then(function (res) {
      if (seq !== loadSeq) { return false; }
      if (!res.ok || !res.data) { return false; }
      var data = res.data;
      var signature = JSON.stringify(data.threads, function (k, v) { return k === 'ago' ? undefined : v; }) + data.canComment;
      var changed = signature !== state.signature || !state.loaded;
      state.signature = signature;
      state.loaded = true;
      state.canComment = data.canComment;
      state.open = data.open;
      state.total = data.total;
      state.threads = data.threads;
      if (changed) {
        if (state.editing && !findThread(state.editing) && !state.threads.some(function (t) { return t.replies.some(function (r) { return r.id === state.editing; }); })) { state.editing = 0; }
        renderAll();
      } else {
        refreshTimes();
      }
      return true;
    });
  }

  function renderAll() {
    if (ui) { renderFilters(); renderList(); renderComposer(); }
    drawPins();
    if (D.panels.refreshBadges) { D.panels.refreshBadges(); }
    var root = document.getElementById('dt-ds');
    if (root) { root.setAttribute('data-comments-open', String(state.open)); root.setAttribute('data-comments-total', String(state.total)); }
  }

  function refreshTimes() {
    if (!ui) { return; }
    D.$$('[data-created]', ui.list).forEach(function (n) { n.textContent = ago(n.getAttribute('data-created')); });
  }

  // ================================================================================================ pins on the canvas

  function pinPoint(t) {
    if (t.elementId) {
      var c = centreOf(t.elementId);
      if (c) { return c; }
    }
    if (D.isNum(t.x) && D.isNum(t.y)) { return { x: t.x, y: t.y }; }
    return null;
  }

  function showsPin(t, pageId) {
    if (t.pageId !== pageId) { return false; }
    if (t.resolved && state.filter === 'open') { return false; }
    if (!t.resolved && state.filter === 'done') { return false; }
    return true;
  }

  function makePin(key) {
    var btn = D.el('button', { type: 'button', class: 'dt-pin', 'data-pin': key });
    btn.addEventListener('pointerdown', function (ev) { ev.stopPropagation(); });
    btn.addEventListener('dblclick', function (ev) { ev.stopPropagation(); });
    btn.addEventListener('contextmenu', function (ev) { ev.stopPropagation(); });
    btn.addEventListener('click', function (ev) {
      ev.stopPropagation();
      var id = Number(btn.getAttribute('data-comment-id'));
      if (id) { openThread(id); }
    });
    return btn;
  }

  function drawPinsNow() {
    if (!layer || !app.doc) { return; }
    var k = app.scale();
    var pageId = app.page().id;
    var wanted = [];
    state.threads.forEach(function (t) {
      if (!showsPin(t, pageId)) { return; }
      var p = pinPoint(t);
      if (p) { wanted.push({ key: 't' + t.id, thread: t, p: p }); }
    });
    if (draft.pageId === pageId && D.isNum(draft.x) && D.isNum(draft.y)) {
      var dp = draft.elementId ? (centreOf(draft.elementId) || { x: draft.x, y: draft.y }) : { x: draft.x, y: draft.y };
      wanted.push({ key: 'draft', draft: true, p: dp });
    }
    var keys = new Set(wanted.map(function (w) { return w.key; }));
    pinEls.forEach(function (el, key) { if (!keys.has(key)) { el.remove(); pinEls.delete(key); } });
    wanted.forEach(function (w) {
      var el = pinEls.get(w.key);
      if (!el) { el = makePin(w.key); layer.appendChild(el); pinEls.set(w.key, el); }
      el.style.setProperty('--dt-pin-x', D.round(w.p.x * k, 1) + 'px');
      el.style.setProperty('--dt-pin-y', D.round(w.p.y * k, 1) + 'px');
      if (w.draft) {
        if (!el.classList.contains('is-draft')) {
          el.classList.add('is-draft');
          el.disabled = true;
          el.setAttribute('aria-label', 'Hier wird dein Kommentar gesetzt');
          el.appendChild(D.icon('plus'));
        }
        return;
      }
      var t = w.thread;
      el.classList.toggle('is-resolved', !!t.resolved);
      el.classList.toggle('is-active', state.activeId === t.id);
      el.setAttribute('data-comment-id', String(t.id));
      var label = t.author + ': ' + (t.text.length > 80 ? t.text.slice(0, 79) + '…' : t.text);
      var sig = label + '|' + t.replies.length + '|' + (t.resolved ? 1 : 0);
      if (el.getAttribute('data-sig') !== sig) {
        el.setAttribute('data-sig', sig);
        el.setAttribute('aria-label', 'Kommentar von ' + label);
        el.title = label;
        D.empty(el);
        el.appendChild(avatarNode(t.author, true));
        if (t.replies.length) { el.appendChild(D.el('b', { class: 'dt-pin__n', text: String(t.replies.length), 'aria-hidden': 'true' })); }
        if (t.resolved) { el.appendChild(D.el('span', { class: 'dt-pin__done', 'aria-hidden': 'true' }, D.icon('check'))); }
      }
    });
    layer.setAttribute('data-count', String(wanted.filter(function (w) { return !w.draft; }).length));
  }
  var drawPins = D.rafOnce(drawPinsNow);

  // ================================================================================================ placing a pin ("Kommentar setzen")

  function onPlaceDown(ev) {
    if (ev.pointerType === 'mouse' && ev.button !== 0) { return; }
    var p = D.canvas.toDoc(ev.clientX, ev.clientY);
    if (p.x < 0 || p.y < 0 || p.x > app.doc.width || p.y > app.doc.height) { return; }
    ev.preventDefault();
    stopPlacing();
    draft = { pageId: app.page().id, elementId: null, x: D.round(p.x, 2), y: D.round(p.y, 2) };
    drawPinsNow();
    // after the event: on a tablet or a phone the editor closes a drawer or sheet when the canvas is pressed (designer.js), which would close the one opened here
    setTimeout(function () { D.panels.open('comments'); focusComposer(); revealPoint(draft.x === null ? { x: 0, y: 0 } : { x: draft.x, y: draft.y }); }, 0);
  }

  function onPlaceKey(ev) {
    if (ev.key !== 'Escape') { return; }
    ev.preventDefault();
    ev.stopPropagation();
    stopPlacing();
  }

  function startPlacing() {
    if (!state.canComment || placing) { return; }
    if (D.crop && D.crop.active && D.crop.active()) { return; }
    placing = true;
    var root = document.getElementById('dt-ds');
    root.classList.add('is-commenting');
    D.canvas.setModal({ onDown: onPlaceDown });
    if (app.sel.length) { app.select([]); }
    if (window.matchMedia('(max-width: 1023px)').matches && D.panels.isOpen()) { D.panels.close(); }
    if (!hint) {
      var cancel = D.el('button', { type: 'button', class: 'mat-btn mat-btn--ghost mat-btn--sm dt-cm-hint__cancel', text: 'Abbrechen' });
      cancel.addEventListener('click', stopPlacing);
      hint = D.el('div', { class: 'dt-cm-hint', role: 'status' }, [D.icon('map-pin'), D.el('span', { text: 'Klicke auf die Seite, um den Kommentar dort zu setzen.' }), cancel]);
      document.getElementById('dt-viewport').parentNode.appendChild(hint);
    }
    hint.hidden = false;
    document.addEventListener('keydown', onPlaceKey, true);
  }

  function stopPlacing() {
    if (!placing) { return; }
    placing = false;
    document.getElementById('dt-ds').classList.remove('is-commenting');
    D.canvas.setModal(null);
    if (hint) { hint.hidden = true; }
    document.removeEventListener('keydown', onPlaceKey, true);
    if (ui) { updateTarget(); }
  }

  // ================================================================================================ mentions (@ in a text field)

  /**
   * Lets a textarea mention people: typing @ and the start of a name opens a list (arrows, Enter or Tab take, Esc closes; the people come from the server: only those who can see the design).
   * options: picked (the object id -> name that this field keeps), onChange(). Returns { ids() } - the ids whose @Name is still in the text.
   */
  function attachMentions(ta, wrap, options) {
    var picked = options.picked;
    var list = D.el('ul', { class: 'dt-cm-mentions', role: 'listbox', 'aria-label': 'Personen erwähnen', hidden: true });
    wrap.appendChild(list);
    var items = [];
    var index = 0;
    var seq = 0;
    var timer2 = 0;
    var token = null;

    function close() {
      clearTimeout(timer2);
      seq++;
      list.hidden = true;
      D.empty(list);
      items = [];
      token = null;
    }

    function tokenAt() {
      var pos = ta.selectionStart;
      var before = ta.value.slice(0, pos);
      var m = /(^|\s)@([^\s@]*(?: [^\s@]*)?)$/.exec(before);
      return m ? { start: pos - m[2].length - 1, end: pos, query: m[2] } : null;
    }

    function mark(i) {
      index = (i + items.length) % items.length;
      D.$$('.dt-cm-mentions__item', list).forEach(function (li, n) {
        li.setAttribute('aria-selected', String(n === index));
        if (n === index) { li.scrollIntoView({ block: 'nearest' }); }
      });
    }

    function pick(c) {
      var t = tokenAt() || token;
      if (!t) { return; }
      var insert = '@' + c.name + ' ';
      ta.value = ta.value.slice(0, t.start) + insert + ta.value.slice(t.end);
      var caret = t.start + insert.length;
      ta.setSelectionRange(caret, caret);
      picked[c.id] = c.name;
      close();
      ta.focus();
      if (options.onChange) { options.onChange(); }
    }

    function show(data) {
      D.empty(list);
      items = data;
      data.forEach(function (c, i) {
        var li = D.el('li', { role: 'option', class: 'dt-cm-mentions__item', 'aria-selected': String(i === 0), 'data-id': String(c.id) }, [
          avatarNode(c.name, true), D.el('span', { class: 'dt-cm-mentions__name', text: c.name }), c.email ? D.el('span', { class: 'dt-cm-mentions__mail', text: c.email }) : null,
        ]);
        li.addEventListener('pointerdown', function (ev) { ev.preventDefault(); });
        li.addEventListener('click', function () { pick(c); });
        list.appendChild(li);
      });
      index = 0;
      list.hidden = false;
    }

    function lookup() {
      var t = tokenAt();
      if (!t) { close(); return; }
      token = t;
      clearTimeout(timer2);
      var mine = ++seq;
      timer2 = setTimeout(function () {
        request('GET', '/api/designs/' + app.id + '/comments/mentions?q=' + encodeURIComponent(t.query)).then(function (res) {
          if (mine !== seq || !token) { return; }
          if (!res.ok || !Array.isArray(res.data) || !res.data.length) { list.hidden = true; D.empty(list); items = []; return; }
          show(res.data);
        });
      }, 150);
    }

    ta.addEventListener('input', lookup);
    ta.addEventListener('blur', function () { setTimeout(close, 120); });
    ta.addEventListener('keydown', function (ev) {
      if (list.hidden || !items.length) { return; }
      if (ev.key === 'ArrowDown') { ev.preventDefault(); mark(index + 1); }
      else if (ev.key === 'ArrowUp') { ev.preventDefault(); mark(index - 1); }
      else if ((ev.key === 'Enter' || ev.key === 'Tab') && !ev.ctrlKey && !ev.metaKey && !ev.shiftKey) { ev.preventDefault(); ev.stopPropagation(); pick(items[index]); }
      else if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); close(); }
    });
    return {
      ids: function () {
        return Object.keys(picked).map(Number).filter(function (id) { return ta.value.toLowerCase().indexOf('@' + String(picked[id]).toLowerCase()) >= 0; });
      },
      close: close,
    };
  }

  /** A textarea that sends with Ctrl+Enter and grows a little. */
  function textarea(cls, label, placeholder, rows) {
    return D.el('textarea', { class: 'mat-textarea dt-cm-input ' + cls, rows: rows || 3, maxlength: MAX_TEXT, placeholder: placeholder || null, 'aria-label': label, spellcheck: 'true' });
  }

  function notePosted(res) {
    if (res.ok) { return true; }
    D.toast(errorText(res), res.status === 429 ? 'warning' : 'danger');
    if (res.status === 403 || res.status === 404) { load(); }
    return false;
  }

  function afterWrite(id) {
    return load().then(function () {
      if (id) { state.activeId = (findThread(id) || {}).id || 0; renderList(); drawPins(); scrollToActive(); }
    });
  }

  // ================================================================================================ the composer

  function updateTarget() {
    if (!ui || !ui.target) { return; }
    var host = ui.target;
    D.empty(host);
    var pageId = draft.pageId || (app.doc ? app.page().id : null);
    var text;
    var icon = 'file-text';
    if (draft.elementId && elementLabel(draft.elementId)) { text = pageLabel(pageId) + ' · an „' + elementLabel(draft.elementId) + '“ geheftet'; icon = 'link-2'; }
    else if (D.isNum(draft.x) && D.isNum(draft.y)) { text = pageLabel(pageId) + ' · Punkt gesetzt'; icon = 'map-pin'; }
    else { text = 'Auf ' + pageLabel(pageId); }
    var chip = D.el('span', { class: 'dt-cm-target__chip' + (icon !== 'file-text' ? ' is-pinned' : ''), 'data-target': icon === 'link-2' ? 'element' : (icon === 'map-pin' ? 'point' : 'page') }, [D.icon(icon), D.el('span', { text: text })]);
    host.appendChild(chip);
    if (icon !== 'file-text') {
      var clear = D.el('button', { type: 'button', class: 'mat-btn mat-btn--ghost mat-btn--icon mat-btn--sm dt-cm-target__clear', title: 'Pin entfernen: der Kommentar gilt dann für die ganze Seite', 'aria-label': 'Pin entfernen' }, D.icon('x'));
      clear.addEventListener('click', function () { draft = emptyDraft(); updateTarget(); drawPins(); });
      host.appendChild(clear);
    }
    var one = app.single();
    var attach = ui.attach;
    if (attach) {
      var can = !!one && !!app.locate(one.id, false);
      attach.disabled = !can;
      attach.title = can ? 'Den Kommentar an das gewählte Element heften: der Pin folgt dem Element' : 'Wähle zuerst ein Element aus, um den Kommentar daran zu heften';
    }
  }

  function updateSendState() {
    if (!ui || !ui.ta) { return; }
    var n = ui.ta.value.trim().length;
    ui.send.disabled = n === 0 || ui.ta.value.length > MAX_TEXT;
    ui.counter.textContent = ui.ta.value.length > MAX_TEXT - 300 ? ui.ta.value.length + ' / ' + MAX_TEXT : '';
  }

  function elementDraft(id) {
    var c = centreOf(id);
    return { pageId: app.page().id, elementId: id, x: c ? D.round(c.x, 2) : null, y: c ? D.round(c.y, 2) : null };
  }

  function sendComposer() {
    if (!ui) { return; }
    var text = ui.ta.value.trim();
    if (!text || ui.send.disabled) { return; }
    ui.send.disabled = true;
    var body = { text: text, mentions: ui.mentions.ids(), pageId: draft.pageId || app.page().id, elementId: draft.elementId, x: draft.x, y: draft.y };
    var ready = app.dirty && app.editable() && D.save ? D.save.flush().catch(function () { return null; }) : Promise.resolve();
    ready.then(function () { return request('POST', '/api/designs/' + app.id + '/comments', body); }).then(function (res) {
      if (!notePosted(res)) { updateSendState(); return; }
      state.composerText = '';
      Object.keys(state.composerPicked).forEach(function (k) { delete state.composerPicked[k]; });
      draft = emptyDraft();
      if (ui && ui.ta) { ui.ta.value = ''; ui.mentions.close(); updateTarget(); updateSendState(); }
      if (state.filter === 'done') { state.filter = 'open'; }
      return afterWrite(res.data.id);
    });
  }

  function renderComposer() {
    if (!ui) { return; }
    var host = ui.composerHost;
    if (host.firstChild && ui.composerFor === state.canComment) { updateTarget(); updateSendState(); return; }
    D.empty(host);
    ui.composerFor = state.canComment;
    if (!state.canComment) {
      host.appendChild(D.el('p', { class: 'dt-pnote', text: 'Die Vorlagen von DesignThix lassen sich nicht kommentieren. Kopiere die Vorlage, dann kannst du die Kopie kommentieren.' }));
      return;
    }
    var target = D.el('div', { class: 'dt-cm-target' });
    var fieldWrap = D.el('div', { class: 'dt-cm-field' });
    var ta = textarea('dt-cm-input--new', 'Neuer Kommentar', 'Kommentar schreiben … mit @ erwähnst du jemanden', 3);
    ta.value = state.composerText;
    fieldWrap.appendChild(ta);
    var picked = state.composerPicked;
    var mentions = attachMentions(ta, fieldWrap, { picked: picked, onChange: function () { state.composerText = ta.value; updateSendState(); } });
    var counter = D.el('span', { class: 'dt-cm-counter mat-muted', 'aria-live': 'polite' });
    var place = D.el('button', { type: 'button', class: 'mat-btn mat-btn--secondary mat-btn--sm dt-cm-place', title: 'Pin setzen: klicke auf die Seite, um den Kommentar dort zu setzen', 'aria-label': 'Pin setzen' }, [D.icon('map-pin'), D.el('span', { text: 'Pin setzen' })]);
    var attach = D.el('button', { type: 'button', class: 'mat-btn mat-btn--secondary mat-btn--sm dt-cm-attach', 'aria-label': 'An Element heften' }, [D.icon('link-2'), D.el('span', { text: 'An Element heften' })]);
    var send = D.el('button', { type: 'button', class: 'mat-btn mat-btn--primary mat-btn--sm dt-cm-send', disabled: true, 'aria-label': 'Senden' }, [D.icon('send'), D.el('span', { text: 'Senden' })]);
    place.addEventListener('click', startPlacing);
    attach.addEventListener('click', function () { var one = app.single(); if (one && app.locate(one.id, false)) { draft = elementDraft(one.id); updateTarget(); drawPins(); ta.focus(); } });
    send.addEventListener('click', sendComposer);
    ta.addEventListener('input', function () { state.composerText = ta.value; updateSendState(); });
    ta.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); sendComposer(); }
    });
    host.appendChild(target);
    host.appendChild(fieldWrap);
    host.appendChild(D.el('div', { class: 'dt-cm-actions' }, [place, attach, D.el('span', { class: 'dt-cm-actions__spacer' }), counter, send]));
    ui.target = target;
    ui.ta = ta;
    ui.send = send;
    ui.attach = attach;
    ui.counter = counter;
    ui.mentions = mentions;
    ui.picked = picked;
    updateTarget();
    updateSendState();
  }

  function focusComposer() {
    if (ui && ui.ta && !window.matchMedia('(pointer: coarse)').matches) { ui.ta.focus({ preventScroll: true }); }
  }

  // ================================================================================================ threads

  function goToPin(t) {
    var i = pageIndexOf(t.pageId);
    if (i >= 0 && i !== app.pageIndex) { app.setPage(i); }
    if (i < 0) { return; }
    if (t.elementId && app.has(t.elementId)) {
      app.select([t.elementId]);
      revealPoint(centreOf(t.elementId));
      return;
    }
    var p = pinPoint(t);
    if (p) { revealPoint(p); }
  }

  /** Brings a point of the page into the part of the canvas that can be seen (on a phone the open sheet covers the lower part). */
  function revealPoint(p) {
    var vp = document.getElementById('dt-viewport');
    var c = D.canvas.toClient(p);
    var r = vp.getBoundingClientRect();
    var bottom = r.bottom;
    var panel = document.getElementById('dt-panel');
    if (D.panels.isOpen() && window.matchMedia('(max-width: 767px)').matches && panel) { bottom = Math.min(bottom, panel.getBoundingClientRect().top); }
    var margin = 50;
    var midX = r.left + r.width / 2;
    var midY = r.top + (bottom - r.top) / 2;
    if (c.x < r.left + margin || c.x > r.right - margin) { vp.scrollLeft += c.x - midX; }
    if (c.y < r.top + margin || c.y > bottom - margin) { vp.scrollTop += c.y - midY; }
  }

  function scrollToActive() {
    if (!ui || !state.activeId) { return; }
    var card = D.$('.dt-cm-thread[data-id="' + state.activeId + '"]', ui.list);
    if (card) { card.scrollIntoView({ block: 'nearest' }); }
  }

  /** Opens the panel on a thread (by the id of the comment or of one of its replies) and shows where it is. */
  function openThread(id, options) {
    var t = findThread(id);
    if (!t) { return false; }
    var o = options || {};
    state.activeId = t.id;
    if (t.resolved && state.filter === 'open') { state.filter = 'all'; }
    if (state.thisPage && t.pageId !== (app.doc ? app.page().id : null)) { state.thisPage = false; }
    if (!o.keepPanel || !D.panels.isOpen() || D.panels.current() !== 'comments') { D.panels.open('comments'); }
    renderAll();
    if (!o.noGo) { goToPin(t); }
    drawPins();
    scrollToActive();
    return true;
  }

  function resolveOrReopen(t, resolve) {
    request('POST', '/api/comments/' + t.id + (resolve ? '/resolve' : '/reopen'), {}).then(function (res) {
      if (!notePosted(res)) { return; }
      return load().then(function () { D.toast(resolve ? 'Der Kommentar ist erledigt.' : 'Der Kommentar ist wieder offen.', 'success'); });
    });
  }

  function confirmDelete(row, isThread) {
    D.dialog.show({
      title: isThread ? 'Kommentar löschen?' : 'Antwort löschen?', icon: 'trash', size: 'sm',
      body: function (body) {
        body.appendChild(D.el('p', { text: isThread && row.replies && row.replies.length ? 'Der Kommentar und seine ' + row.replies.length + (row.replies.length === 1 ? ' Antwort werden' : ' Antworten werden') + ' gelöscht. Das lässt sich nicht rückgängig machen.' : 'Das lässt sich nicht rückgängig machen.' }));
      },
      buttons: [
        { label: 'Löschen', kind: 'danger', value: 'delete', icon: 'trash' },
        { label: 'Abbrechen', kind: 'secondary', value: 'cancel' },
      ],
    }).then(function (value) {
      if (value !== 'delete') { return; }
      request('POST', '/api/comments/' + row.id + '/delete', {}).then(function (res) {
        if (!notePosted(res)) { return; }
        delete state.replyText[row.id];
        return load();
      });
    });
  }

  function startEdit(row) {
    state.editing = row.id;
    state.editText = row.text;
    state.editPicked = {};
    (row.mentions || []).forEach(function (m) { state.editPicked[m.id] = m.name; });
    renderList();
    var ta = ui && D.$('.dt-cm-input--edit', ui.list);
    if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
  }

  function cancelEdit() { state.editing = 0; renderList(); }

  function saveEdit(row, ta, mentions, saveBtn) {
    var text = ta.value.trim();
    if (!text) { return; }
    saveBtn.disabled = true;
    request('POST', '/api/comments/' + row.id + '/edit', { text: text, mentions: mentions.ids() }).then(function (res) {
      if (!notePosted(res)) { saveBtn.disabled = false; return; }
      state.editing = 0;
      return load().then(function () { renderList(); });
    });
  }

  function menuFor(row, isThread) {
    var items = [];
    if (row.canEdit) { items.push({ label: 'Bearbeiten', icon: 'pencil', run: function () { startEdit(row); } }); }
    if (isThread && row.canResolve) { items.push({ label: row.resolved ? 'Wieder öffnen' : 'Als erledigt markieren', icon: row.resolved ? 'rotate-ccw' : 'circle-check', run: function () { resolveOrReopen(row, !row.resolved); } }); }
    if (row.canDelete) { items.push({ type: 'separator' }, { label: 'Löschen', icon: 'trash', danger: true, run: function () { confirmDelete(row, isThread); } }); }
    if (items.length && items[0].type === 'separator') { items.shift(); }
    return items;
  }

  function rowHeader(row, isThread) {
    var meta = D.el('div', { class: 'dt-cm-meta' }, [
      D.el('strong', { class: 'dt-cm-author', text: row.author }),
      D.el('span', { class: 'dt-cm-time mat-muted', 'data-created': row.created, title: fullDate(row.created), text: ago(row.created) }),
      row.edited ? D.el('span', { class: 'dt-cm-edited mat-muted', title: 'Bearbeitet ' + fullDate(row.edited), text: '· bearbeitet' }) : null,
    ]);
    var tools = D.el('div', { class: 'dt-cm-tools' });
    if (isThread && row.canResolve) {
      var done = D.el('button', { type: 'button', class: 'mat-btn mat-btn--ghost mat-btn--icon mat-btn--sm dt-cm-resolve', title: row.resolved ? 'Wieder öffnen' : 'Als erledigt markieren', 'aria-label': row.resolved ? 'Kommentar wieder öffnen' : 'Kommentar als erledigt markieren' }, D.icon(row.resolved ? 'rotate-ccw' : 'circle-check'));
      done.addEventListener('click', function (ev) { ev.stopPropagation(); resolveOrReopen(row, !row.resolved); });
      tools.appendChild(done);
    }
    // somebody who may only read a comment has no menu on it (they can still answer)
    if (menuFor(row, isThread).length) {
      var more = D.el('button', { type: 'button', class: 'mat-btn mat-btn--ghost mat-btn--icon mat-btn--sm dt-cm-more', title: 'Mehr', 'aria-label': 'Mehr zu diesem Kommentar', 'aria-haspopup': 'menu' }, D.icon('ellipsis'));
      more.addEventListener('click', function (ev) { ev.stopPropagation(); D.menu.open(menuFor(row, isThread), { anchor: more }); });
      tools.appendChild(more);
    }
    return D.el('header', { class: 'dt-cm-head' }, [avatarNode(row.author, true), meta, tools]);
  }

  function bodyOf(row) {
    if (state.editing === row.id) {
      var wrap = D.el('div', { class: 'dt-cm-field' });
      var ta = textarea('dt-cm-input--edit', 'Kommentar bearbeiten', null, 3);
      ta.value = state.editText;
      wrap.appendChild(ta);
      var saveBtn = D.el('button', { type: 'button', class: 'mat-btn mat-btn--primary mat-btn--sm dt-cm-save', text: 'Speichern' });
      var cancel = D.el('button', { type: 'button', class: 'mat-btn mat-btn--ghost mat-btn--sm dt-cm-cancel', text: 'Abbrechen' });
      var mentions = attachMentions(ta, wrap, { picked: state.editPicked, onChange: function () { state.editText = ta.value; } });
      ta.addEventListener('input', function () { state.editText = ta.value; saveBtn.disabled = !ta.value.trim(); });
      ta.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); saveEdit(row, ta, mentions, saveBtn); }
        else if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); cancelEdit(); }
      });
      saveBtn.addEventListener('click', function () { saveEdit(row, ta, mentions, saveBtn); });
      cancel.addEventListener('click', cancelEdit);
      return D.el('div', { class: 'dt-cm-edit' }, [wrap, D.el('div', { class: 'dt-cm-actions' }, [D.el('span', { class: 'dt-cm-actions__spacer' }), cancel, saveBtn])]);
    }
    var text = D.el('div', { class: 'dt-cm-text' });
    renderText(text, row.text, row.mentions);
    return text;
  }

  function replyBox(t) {
    var wrap = D.el('div', { class: 'dt-cm-field dt-cm-reply' });
    var ta = textarea('dt-cm-input--reply', 'Antworten', 'Antworten …', 1);
    ta.value = state.replyText[t.id] || '';
    wrap.appendChild(ta);
    var picked = state.replyPicked[t.id] = state.replyPicked[t.id] || {};
    var send = D.el('button', { type: 'button', class: 'mat-btn mat-btn--primary mat-btn--sm dt-cm-reply__send', hidden: !ta.value.trim() }, [D.icon('send'), D.el('span', { text: 'Antworten' })]);
    var update = function () { state.replyText[t.id] = ta.value; send.hidden = !ta.value.trim(); ta.rows = ta.value.indexOf('\n') >= 0 || ta.value.length > 40 || document.activeElement === ta ? 3 : 1; };
    var mentions = attachMentions(ta, wrap, { picked: picked, onChange: update });
    var go = function () {
      var text = ta.value.trim();
      if (!text || send.disabled) { return; }
      send.disabled = true;
      request('POST', '/api/designs/' + app.id + '/comments', { text: text, parentId: t.id, mentions: mentions.ids() }).then(function (res) {
        send.disabled = false;
        if (!notePosted(res)) { return; }
        ta.value = '';
        update();
        delete state.replyText[t.id];
        Object.keys(picked).forEach(function (k) { delete picked[k]; });
        state.activeId = t.id;
        return load();
      });
    };
    ta.addEventListener('input', update);
    ta.addEventListener('focus', update);
    ta.addEventListener('blur', function () { setTimeout(update, 0); });
    ta.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); go(); }
    });
    send.addEventListener('click', go);
    update();
    wrap.appendChild(D.el('div', { class: 'dt-cm-actions' }, [D.el('span', { class: 'dt-cm-actions__spacer' }), send]));
    return wrap;
  }

  function whereChip(t) {
    var i = pageIndexOf(t.pageId);
    var label = pageLabel(t.pageId);
    var el = t.elementId ? elementLabel(t.elementId) : null;
    var text = label + (t.elementId ? ' · ' + (el ? el : 'Element entfernt') : (D.isNum(t.x) ? ' · Punkt' : ''));
    var chip = D.el('button', { type: 'button', class: 'dt-cm-where', title: i < 0 ? 'Die Seite dieses Kommentars gibt es nicht mehr' : 'Zeigt, wo der Kommentar steht', disabled: i < 0, 'data-where': '' }, [D.icon(t.elementId ? 'link-2' : (D.isNum(t.x) ? 'map-pin' : 'file-text')), D.el('span', { text: text })]);
    chip.addEventListener('click', function (ev) { ev.stopPropagation(); state.activeId = t.id; renderList(); drawPins(); goToPin(t); });
    return chip;
  }

  function threadCard(t) {
    var card = D.el('article', { class: 'dt-cm-thread' + (t.resolved ? ' is-resolved' : '') + (state.activeId === t.id ? ' is-active' : ''), 'data-id': String(t.id), 'aria-label': 'Kommentar von ' + t.author });
    card.appendChild(rowHeader(t, true));
    card.appendChild(bodyOf(t));
    card.appendChild(whereChip(t));
    if (t.resolved) {
      card.appendChild(D.el('p', { class: 'dt-cm-resolved', text: 'Erledigt' + (t.resolvedBy ? ' von ' + t.resolvedBy : '') }));
    }
    if (t.replies.length) {
      var ul = D.el('ul', { class: 'dt-cm-replies' });
      t.replies.forEach(function (r) {
        ul.appendChild(D.el('li', { class: 'dt-cm-reply-item' + (state.activeId === r.id ? ' is-active' : ''), 'data-id': String(r.id) }, [rowHeader(r, false), bodyOf(r)]));
      });
      card.appendChild(ul);
    }
    if (state.canComment) { card.appendChild(replyBox(t)); }
    card.addEventListener('click', function (ev) {
      if (ev.target.closest('button, textarea, a, .dt-cm-mentions')) { return; }
      if (state.activeId !== t.id) { state.activeId = t.id; D.$$('.dt-cm-thread', ui.list).forEach(function (c) { c.classList.toggle('is-active', c === card); }); drawPins(); }
      goToPin(t);
    });
    return card;
  }

  // ================================================================================================ the panel

  function saveFocus() {
    var a = document.activeElement;
    focusInfo = null;
    if (!ui || !a || !ui.list.contains(a) || a.tagName !== 'TEXTAREA') { return; }
    var card = a.closest('.dt-cm-thread');
    focusInfo = { id: card ? card.getAttribute('data-id') : null, edit: a.classList.contains('dt-cm-input--edit'), start: a.selectionStart, end: a.selectionEnd };
  }

  function restoreFocus() {
    if (!focusInfo || !ui) { return; }
    var card = focusInfo.id ? D.$('.dt-cm-thread[data-id="' + focusInfo.id + '"]', ui.list) : null;
    var ta = card ? D.$(focusInfo.edit ? '.dt-cm-input--edit' : '.dt-cm-input--reply', card) : null;
    if (ta) { ta.focus({ preventScroll: true }); try { ta.setSelectionRange(focusInfo.start, focusInfo.end); } catch (e) { /* ignore */ } }
    focusInfo = null;
  }

  function renderFilters() {
    if (!ui) { return; }
    var open = state.threads.filter(function (t) { return !t.resolved; }).length;
    var done = state.threads.length - open;
    var counts = { open: open, done: done, all: state.threads.length };
    D.$$('[data-filter]', ui.filters).forEach(function (b) {
      var f = b.getAttribute('data-filter');
      b.setAttribute('aria-pressed', String(state.filter === f));
      var n = D.$('.dt-cm-count', b);
      if (n) { n.textContent = state.loaded ? String(counts[f]) : ''; }
    });
    ui.pageSwitch.checked = state.thisPage;
  }

  function renderList() {
    if (!ui) { return; }
    saveFocus();
    var list = ui.list;
    D.empty(list);
    if (!state.loaded) { list.appendChild(D.el('p', { class: 'dt-pnote', text: 'Kommentare werden geladen …' })); return; }
    var threads = visibleThreads();
    if (!threads.length) {
      var none = state.threads.length === 0;
      var text = none ? 'Noch keine Kommentare. Schreibe unten den ersten oder setze einen Pin auf die Seite.' : (state.filter === 'open' ? 'Keine offenen Kommentare.' : (state.filter === 'done' ? 'Noch nichts erledigt.' : 'Keine Kommentare auf dieser Seite.'));
      list.appendChild(D.el('div', { class: 'dt-pempty dt-cm-empty' }, [D.icon('message-square', 'dt-pempty__icon'), D.el('p', { text: text })]));
      return;
    }
    threads.forEach(function (t) { list.appendChild(threadCard(t)); });
    restoreFocus();
  }

  function build(host, api) {
    app = api.app;   // the panel that was open at the last visit is built by D.panels.init, before init() below runs
    var filters = D.el('div', { class: 'mat-seg dt-seg dt-cm-filters', role: 'group', 'aria-label': 'Kommentare filtern' });
    [['open', 'Offen'], ['done', 'Erledigt'], ['all', 'Alle']].forEach(function (f) {
      var b = D.el('button', { type: 'button', class: 'mat-seg__btn', 'data-filter': f[0], 'aria-pressed': String(state.filter === f[0]) }, [D.el('span', { text: f[1] }), D.el('span', { class: 'dt-cm-count' })]);
      b.addEventListener('click', function () { state.filter = f[0]; renderAll(); });
      filters.appendChild(b);
    });
    var pageSwitch = D.el('input', { type: 'checkbox' });
    pageSwitch.checked = state.thisPage;
    pageSwitch.addEventListener('change', function () { state.thisPage = pageSwitch.checked; renderList(); });
    var pageToggle = D.el('label', { class: 'mat-switch dt-switch dt-cm-pageonly' }, [pageSwitch, D.el('span', { class: 'mat-switch__track' }), D.el('span', { text: 'Nur diese Seite' })]);
    var list = D.el('div', { class: 'dt-cm-list', role: 'feed', 'aria-label': 'Kommentare', 'aria-busy': 'false' });
    var composerHost = D.el('div', { class: 'dt-cm-composer' });
    host.appendChild(D.el('div', { class: 'dt-cm-top' }, [filters, pageToggle]));
    host.appendChild(list);
    host.appendChild(composerHost);
    ui = { host: host, api: api, filters: filters, pageSwitch: pageSwitch, list: list, composerHost: composerHost, composerFor: null };
    api.cleanup(function () { if (ui && ui.mentions) { ui.mentions.close(); } ui = null; });
    api.on('page', function () { if (state.thisPage) { renderList(); } updateTarget(); drawPins(); });
    api.on('pages', function () { renderList(); updateTarget(); });
    api.on('selection', updateTarget);
    api.on('doc', function (ev) { if (ev && ev.structure) { refreshChips(); updateTarget(); } });
    renderFilters();
    renderList();
    renderComposer();
    if (!state.loaded) { load(); } else { refreshTimes(); }
    scrollToActive();
  }

  /** The chips "Seite 2 · Titel" follow renames, deleted elements and moved pages without a rebuild of the list. */
  var refreshChips = D.rafOnce(function () {
    if (!ui) { return; }
    D.$$('.dt-cm-thread', ui.list).forEach(function (card) {
      var t = findThread(Number(card.getAttribute('data-id')));
      var old = D.$('.dt-cm-where', card);
      if (t && old) { old.replaceWith(whereChip(t)); }
    });
  });

  // ================================================================================================ compose (key K, context menu)

  /** Opens the panel with the composer. options: elementId (pin to that element), point {x, y} (pin there); without options a single selected element is used. */
  function compose(options) {
    if (!state.canComment) { D.toast('Die Vorlagen von DesignThix lassen sich nicht kommentieren.', 'warning'); return; }
    var o = options || {};
    draft = emptyDraft();
    var one = app.single();
    if (o.elementId && app.locate(o.elementId, false)) { draft = elementDraft(o.elementId); }
    else if (o.point && D.isNum(o.point.x) && D.isNum(o.point.y)) { draft = { pageId: app.page().id, elementId: null, x: D.round(o.point.x, 2), y: D.round(o.point.y, 2) }; }
    else if (one && app.locate(one.id, false)) { draft = elementDraft(one.id); }
    D.panels.open('comments');
    updateTarget();
    drawPinsNow();
    focusComposer();
  }

  // ================================================================================================ start

  function deepLink() {
    var id = Number(new URLSearchParams(window.location.search).get('comment'));
    if (!id) { return; }
    try { window.history.replaceState(null, '', window.location.pathname + window.location.hash); } catch (e) { /* ignore */ }
    if (!openThread(id)) { D.toast('Den Kommentar gibt es nicht mehr.', 'warning'); D.panels.open('comments'); }
  }

  function init(theApp, cfg) {
    app = theApp;
    config = cfg;
    var sheet = document.getElementById('dt-sheet');
    layer = D.el('div', { class: 'dt-pins', id: 'dt-pins', role: 'group', 'aria-label': 'Kommentare auf dieser Seite' });
    sheet.appendChild(layer);
    ['doc', 'page', 'pages', 'zoom', 'rendered', 'readonly'].forEach(function (name) { app.on(name, drawPins); });
    // a pin that was only started (no text typed) is dropped when the panel is closed or another one is opened
    app.on('panel', function () {
      // a phone: while the sheet is open the page gets room above it, so a pin can be scrolled into view (css)
      document.getElementById('dt-ds').classList.toggle('is-comments-open', D.panels.current() === 'comments');
      if (D.panels.current() !== 'comments' && !placing && !state.composerText.trim() && (draft.x !== null || draft.elementId)) { draft = emptyDraft(); drawPins(); }
    });
    window.addEventListener('resize', drawPins);
    timer = setInterval(function () { if (!document.hidden) { load(); } }, POLL_MS);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) { load(); } });
    load().then(deepLink);
  }

  D.panels.register({
    id: 'comments', title: 'Kommentare', label: 'Kommentare', icon: 'message-square', order: 65,
    badge: function () { return state.open; }, badgeClass: 'dt-rail__badge--accent',
    build: build,
  });

  D.comments = {
    init: init,
    compose: compose,
    openThread: openThread,
    startPlacing: startPlacing,
    openCount: function () { return state.open; },
    canComment: function () { return state.canComment; },
    reload: load,
    state: function () { return { open: state.open, total: state.total, filter: state.filter, thisPage: state.thisPage, activeId: state.activeId, loaded: state.loaded, threads: state.threads, placing: placing, draft: draft, timer: timer, config: !!config }; },
  };
})();
