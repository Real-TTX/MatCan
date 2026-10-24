/* DesignThix designer, part 5 (loaded last): starts everything. Loads the document, fonts, media and data lists; wires the top bar (name, undo/redo, data preview, save
   state, save), the zoom bar, the keyboard, copy/paste, the drawers of small screens and the phone view; saves with a revision check (409: save as a copy or reload),
   keeps a draft in localStorage, waits for the connection, posts the thumbnail after a save. The pieces: designer.core.js (state and commands),
   designer.canvas.js (drawing and pointer work), designer.props.js (right panel), designer.panels.js (left panel). */
(function () {
  'use strict';

  var D = window.DtDesigner;
  var rootEl = document.getElementById('dt-ds');
  if (!rootEl || !D || !window.DtEngine) { return; }

  var config = {
    id: Number(rootEl.getAttribute('data-design-id')),
    canEdit: rootEl.getAttribute('data-can-edit') === 'true',
    name: rootEl.getAttribute('data-name') || '',
    presets: [],
  };
  try { config.presets = JSON.parse(rootEl.getAttribute('data-presets') || '[]'); } catch (e) { config.presets = []; }

  var app = D.createApp(config);
  D.app = app;
  var $ = D.$;
  var els = {
    viewport: $('#dt-viewport'), stage: $('#dt-stage'), sheet: $('#dt-sheet'), page: $('#dt-page'), overlay: $('#dt-overlay'),
    name: $('#dt-name'), undo: $('#dt-undo'), redo: $('#dt-redo'), save: $('#dt-save'), state: $('#dt-state'), stateText: $('#dt-state-text'),
    data: $('#dt-data'), rowCtl: $('#dt-rowctl'), rowInfo: $('#dt-row-info'), rowPrev: $('#dt-row-prev'), rowNext: $('#dt-row-next'),
    zoom: $('#dt-zoom'), zoomIn: $('#dt-zoom-in'), zoomOut: $('#dt-zoom-out'), zoomFit: $('#dt-zoom-fit'), snap: $('#dt-snap'), warn: $('#dt-warnbar'),
    left: $('#dt-left'), right: $('#dt-right'), toggleLeft: $('#dt-toggle-left'), toggleRight: $('#dt-toggle-right'), scrim: $('#dt-scrim'), loading: $('#dt-loading'),
  };
  var DRAFT_KEY = 'dt-draft-' + config.id;
  var PREVIEW_KEY = 'dt-preview-' + config.id;
  var phone = window.matchMedia('(max-width: 767px)');
  var tablet = window.matchMedia('(max-width: 1023px)');
  var leaving = false;
  var saving = false;
  var saveAgain = false;
  var savePromise = Promise.resolve(false);
  var thumbnailPending = Promise.resolve();
  var retryTimer = 0;
  var dataLists = [];

  // ================================================================================================ read-only, phone, drawers

  function applyRole() {
    var ro = !config.canEdit || phone.matches;
    app.readOnly = ro;
    rootEl.classList.toggle('is-readonly', !config.canEdit);
    rootEl.classList.toggle('is-phone', phone.matches);
    els.name.readOnly = ro;
    app.emit('readonly');
    updateHistoryButtons();
    updateStateUi();
  }

  function setDrawer(side, open) {
    rootEl.classList.toggle('is-open-left', side === 'left' && open);
    rootEl.classList.toggle('is-open-right', side === 'right' && open);
    els.toggleLeft.setAttribute('aria-expanded', String(side === 'left' && open));
    els.toggleRight.setAttribute('aria-expanded', String(side === 'right' && open));
    els.scrim.hidden = !(open && tablet.matches);
  }

  function initDrawers() {
    els.toggleLeft.addEventListener('click', function () { setDrawer('left', !rootEl.classList.contains('is-open-left')); });
    els.toggleRight.addEventListener('click', function () { setDrawer('right', !rootEl.classList.contains('is-open-right')); });
    els.scrim.addEventListener('click', function () { setDrawer('left', false); });
    tablet.addEventListener('change', function () { setDrawer('left', false); });
    // choosing something on the canvas is the end of looking in a drawer
    els.viewport.addEventListener('pointerdown', function () {
      if (tablet.matches && (rootEl.classList.contains('is-open-left') || rootEl.classList.contains('is-open-right'))) { setDrawer('left', false); }
    });
  }

  // ================================================================================================ save state and buttons

  function updateHistoryButtons() {
    els.undo.disabled = !app.canUndo();
    els.redo.disabled = !app.canRedo();
  }

  var STATE_TEXT = {
    saved: ['Gespeichert', 'check-circle'],
    dirty: ['Ungespeichert', 'alert'],
    saving: ['Speichert …', 'refresh'],
    offline: ['Offline – wird gespeichert, sobald die Verbindung da ist', 'cloud-off'],
    error: ['Speichern fehlgeschlagen', 'x-circle'],
    readonly: ['Nur ansehen', 'eye'],
  };

  function updateStateUi() {
    var state = !config.canEdit ? 'readonly' : app.saveState;
    var info = STATE_TEXT[state] || STATE_TEXT.saved;
    els.state.setAttribute('data-state', state);
    els.stateText.textContent = info[0];
    els.state.title = info[0];
    var use = els.state.querySelector('use');
    if (use) { use.setAttribute('href', (document.getElementById('dt-i-' + info[1]) ? '#dt-i-' : '#mat-i-') + info[1]); }
    if (els.save) { els.save.disabled = saving; }
  }

  app.on('state', updateStateUi);
  app.on('history', updateHistoryButtons);
  app.on('doc', updateHistoryButtons);

  // ================================================================================================ draft (localStorage)

  var writeDraft = D.debounce(function () {
    if (!app.dirty || !app.doc) { return; }
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ revision: app.baseRevision, document: app.doc, time: Date.now() })); } catch (e) { /* storage full or blocked */ }
  }, 900);

  function clearDraft() {
    writeDraft.cancel();
    try { localStorage.removeItem(DRAFT_KEY); } catch (e) { /* ignore */ }
  }

  app.on('dirty', writeDraft);

  // ================================================================================================ saving

  function showDialog(build) {
    return new Promise(function (resolve) {
      var dlg = D.el('dialog', { class: 'mat-dialog mat-dialog--sm', 'data-static': '', 'aria-labelledby': 'dt-dlg-title' });
      var done = function (value) { resolve(value); };
      build(dlg, function (value) { dlg.returnValue = value; window.MatUi.dialog.close(dlg, value); });
      document.body.appendChild(dlg);
      dlg.addEventListener('close', function () { done(dlg.returnValue || 'cancel'); setTimeout(function () { dlg.remove(); }, 0); });
      window.MatUi.dialog.open(dlg);
    });
  }

  function conflictDialog(serverRevision) {
    return showDialog(function (dlg, close) {
      var button = function (text, cls, value) { var b = D.el('button', { type: 'button', class: 'mat-btn ' + cls, text: text }); b.addEventListener('click', function () { close(value); }); return b; };
      dlg.appendChild(D.el('div', { class: 'mat-dialog__form' }, [
        D.el('div', { class: 'mat-dialog__head' }, [D.icon('alert'), D.el('h2', { class: 'mat-dialog__title', id: 'dt-dlg-title', text: 'Das Design wurde inzwischen geändert' })]),
        D.el('div', { class: 'mat-dialog__body' }, [
          D.el('p', { text: 'Jemand hat dieses Design gespeichert, während du daran gearbeitet hast' + (serverRevision ? ' (jetzt Stand ' + serverRevision + ')' : '') + '. Wenn du jetzt speicherst, würden seine Änderungen verloren gehen.' }),
          D.el('p', { class: 'mat-muted', text: 'Als Kopie speichern legt deine Fassung als neues Design an. Neu laden verwirft deine Änderungen und zeigt den aktuellen Stand.' }),
        ]),
        D.el('div', { class: 'mat-dialog__foot' }, D.el('div', { class: 'mat-btn-row mat-btn-row--plain' }, [
          button('Als Kopie speichern', 'mat-btn--primary', 'copy'), button('Neu laden', 'mat-btn--secondary', 'reload'),
          D.el('span', { class: 'mat-btn-row__spacer' }), button('Abbrechen', 'mat-btn--secondary', 'cancel'),
        ])),
      ]));
    });
  }

  function leaveTo(url) {
    leaving = true;
    // a thumbnail that is still being made gets a few seconds: it is what the lists show
    Promise.race([thumbnailPending, new Promise(function (resolve) { setTimeout(resolve, 4000); })]).then(function () { window.location.href = url; });
  }

  function handleConflict(serverRevision) {
    app.setSaveState('dirty');
    return conflictDialog(serverRevision).then(function (choice) {
      if (choice === 'copy') {
        return D.request('POST', '/api/designs/' + config.id + '/copy', { document: app.doc }).then(function (res) {
          if (res.ok && res.data && res.data.id) { clearDraft(); D.toast('Deine Fassung ist als neues Design gespeichert.', 'success'); setTimeout(function () { leaveTo('/Designs/' + res.data.id + '/Designer'); }, 400); return true; }
          D.toast((res.data && res.data.error) || 'Die Kopie konnte nicht gespeichert werden.', 'danger');
          return false;
        }, function () { D.toast('Keine Verbindung: Die Kopie konnte nicht gespeichert werden.', 'warning'); return false; });
      }
      if (choice === 'reload') { clearDraft(); leaving = true; window.location.reload(); return false; }
      return false;
    });
  }

  function save(options) {
    if (!config.canEdit || !app.doc) { return Promise.resolve(false); }
    if (D.canvas.isEditing()) { D.canvas.endTextEdit(true); }
    if (saving) { saveAgain = true; return savePromise; }
    if (!app.dirty && !(options && options.force)) { return Promise.resolve(true); }
    if (!navigator.onLine) { app.setSaveState('offline'); return Promise.resolve(false); }
    saving = true;
    app.setSaveState('saving');
    var sent = JSON.stringify(app.doc);
    var sentDoc = JSON.parse(sent);
    savePromise = D.request('POST', '/api/designs/' + config.id, { revision: app.baseRevision, document: sentDoc }).then(function (res) {
      if (res.ok) {
        app.revision = res.data.revision;
        app.baseRevision = res.data.revision;
        app.dirty = JSON.stringify(app.doc) !== sent;
        app.setSaveState(app.dirty ? 'dirty' : 'saved');
        if (!app.dirty) { clearDraft(); } else { writeDraft(); }
        if (res.data.warnings && res.data.warnings.length) { D.toast(res.data.warnings[0], 'warning'); }
        postThumbnail(sentDoc);
        return true;
      }
      if (res.status === 409) { return handleConflict(res.data && res.data.revision); }
      app.setSaveState('error');
      if (res.status === 403) { D.toast('Du darfst dieses Design nicht ändern.', 'danger'); }
      else { D.toast((res.data && res.data.error) || 'Das Design konnte nicht gespeichert werden.', 'danger'); }
      return false;
    }, function (err) {
      if (err && err.offline) { app.setSaveState('offline'); scheduleRetry(); }
      else { app.setSaveState('error'); }
      return false;
    }).then(function (ok) {
      saving = false;
      updateStateUi();
      if (saveAgain) { saveAgain = false; if (app.dirty) { return save(); } }
      return ok;
    });
    return savePromise;
  }
  app.save = save;

  function scheduleRetry() {
    clearTimeout(retryTimer);
    retryTimer = setTimeout(function () { if (app.dirty && app.saveState === 'offline') { save(); } }, 8000);
  }

  /** The preview of the design for the lists: the sample values at 480 px width, posted after each save (failures do not matter). */
  function postThumbnail(doc) {
    thumbnailPending = window.DtEngine.rasterize(doc, window.DtEngine.sampleValues(doc), { maxWidth: 480, assetUrl: app.assetUrl, fonts: app.fonts }).then(function (blob) {
      if (blob.size > 2 * 1024 * 1024) { return null; }
      return D.request('POST', '/api/designs/' + config.id + '/thumbnail', blob, { raw: true, contentType: 'image/png' });
    }).catch(function () { /* no thumbnail this time */ });
  }

  window.addEventListener('online', function () { if (app.dirty && config.canEdit) { save(); } });
  window.addEventListener('offline', function () { if (app.dirty) { app.setSaveState('offline'); } });
  window.addEventListener('beforeunload', function (ev) {
    if (leaving || !config.canEdit || !(app.dirty || saving)) { return; }
    ev.preventDefault();
    ev.returnValue = '';
  });

  // Leaving by a link of the bar: save first when there is something unsaved.
  D.$$('[data-leave]').forEach(function (a) {
    a.addEventListener('click', function (ev) {
      if (ev.defaultPrevented || ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.button !== 0 || !config.canEdit || !(app.dirty || saving)) { return; }
      ev.preventDefault();
      var href = a.getAttribute('href');
      save().then(function (ok) { if (ok) { leaveTo(href); } });
    });
  });

  // ================================================================================================ name

  function initName() {
    els.name.value = config.name;
    var committed = config.name;
    var commit = function () {
      var v = els.name.value.trim();
      if (!config.canEdit || v === committed) { els.name.value = committed; return; }
      if (!v) { els.name.value = committed; D.toast('Bitte gib einen Namen ein.', 'warning'); return; }
      D.request('POST', '/api/designs/' + config.id + '/rename', { name: v }).then(function (res) {
        if (res.ok) { committed = res.data.name; els.name.value = committed; app.name = committed; document.title = committed + ' · DesignThix'; }
        else { els.name.value = committed; D.toast((res.data && res.data.error) || 'Der Name konnte nicht gespeichert werden.', 'danger'); }
      }, function () { els.name.value = committed; D.toast('Keine Verbindung: Der Name wurde nicht geändert.', 'warning'); });
    };
    els.name.addEventListener('change', commit);
    els.name.addEventListener('keydown', function (ev) {
      ev.stopPropagation();
      if (ev.key === 'Enter') { els.name.blur(); } else if (ev.key === 'Escape') { els.name.value = committed; els.name.blur(); }
    });
  }

  // ================================================================================================ zoom bar

  function updateZoomUi() {
    var percent = Math.round(app.zoom * 100);
    var select = els.zoom;
    var dynamic = select.querySelector('option[data-dynamic]');
    if (dynamic) { dynamic.remove(); }
    var fitOption = select.querySelector('option[value="fit"]');
    fitOption.textContent = 'Einpassen (' + percent + ' %)';
    if (app.fitMode) { select.value = 'fit'; return; }
    var match = Array.prototype.find.call(select.options, function (o) { return o.value !== 'fit' && Math.abs(Number(o.value) - app.zoom) < 0.005; });
    if (match) { select.value = match.value; return; }
    var opt = D.el('option', { value: String(app.zoom), text: percent + ' %', 'data-dynamic': '' });
    select.insertBefore(opt, select.options[1]);
    select.value = String(app.zoom);
  }

  function initZoom() {
    els.zoom.addEventListener('change', function () {
      if (els.zoom.value === 'fit') { D.canvas.fit(); } else { D.canvas.setZoom(Number(els.zoom.value), false); }
      els.viewport.focus({ preventScroll: true });
    });
    els.zoomIn.addEventListener('click', function () { D.canvas.stepZoom(1); });
    els.zoomOut.addEventListener('click', function () { D.canvas.stepZoom(-1); });
    els.zoomFit.addEventListener('click', function () { D.canvas.fit(); });
    els.snap.addEventListener('click', function () {
      app.snapping = !app.snapping;
      els.snap.setAttribute('aria-pressed', String(app.snapping));
    });
    app.on('zoom', updateZoomUi);
  }

  // ================================================================================================ preview data

  function rowCount() { return app.preview.rows.length; }

  function updateRowUi() {
    var p = app.preview;
    var has = !!p.list;
    els.rowCtl.hidden = !has;
    if (!has) { return; }
    var n = rowCount();
    els.rowInfo.textContent = n ? 'Zeile ' + (p.index + 1) + ' von ' + n : 'keine Zeilen';
    els.rowPrev.disabled = n < 2;
    els.rowNext.disabled = n < 2;
  }

  function setRow(index) {
    var n = rowCount();
    if (!n) { return; }
    app.preview.index = (index + n) % n;
    try { localStorage.setItem(PREVIEW_KEY, JSON.stringify({ listId: app.preview.listId, index: app.preview.index })); } catch (e) { /* ignore */ }
    updateRowUi();
    app.emit('preview');
  }

  function choosePreview(listId, index) {
    if (!listId) {
      app.preview = { listId: null, list: null, rows: [], index: 0 };
      try { localStorage.removeItem(PREVIEW_KEY); } catch (e) { /* ignore */ }
      updateRowUi();
      app.emit('preview');
      return Promise.resolve();
    }
    return D.request('GET', '/api/datalists/' + listId + '/rows').then(function (res) {
      if (!res.ok) { D.toast('Die Datenliste konnte nicht geladen werden.', 'danger'); els.data.value = ''; return; }
      app.preview = { listId: listId, list: res.data, rows: res.data.rows || [], index: D.clamp(index || 0, 0, Math.max(0, (res.data.rows || []).length - 1)) };
      try { localStorage.setItem(PREVIEW_KEY, JSON.stringify({ listId: listId, index: app.preview.index })); } catch (e) { /* ignore */ }
      updateRowUi();
      app.emit('preview');
    }, function () { D.toast('Keine Verbindung: Die Datenliste konnte nicht geladen werden.', 'warning'); els.data.value = ''; });
  }

  function initPreview() {
    els.data.addEventListener('change', function () { choosePreview(els.data.value ? Number(els.data.value) : null, 0); });
    els.rowPrev.addEventListener('click', function () { setRow(app.preview.index - 1); });
    els.rowNext.addEventListener('click', function () { setRow(app.preview.index + 1); });
    return D.request('GET', '/api/datalists').then(function (res) {
      dataLists = res.ok && Array.isArray(res.data) ? res.data : [];
      dataLists.forEach(function (l) {
        els.data.appendChild(D.el('option', { value: String(l.id), text: l.name + ' (' + l.rowCount + ' Zeilen)' }));
      });
      var saved = null;
      try { saved = JSON.parse(localStorage.getItem(PREVIEW_KEY) || 'null'); } catch (e) { saved = null; }
      if (saved && saved.listId && dataLists.some(function (l) { return l.id === saved.listId; })) {
        els.data.value = String(saved.listId);
        return choosePreview(saved.listId, saved.index);
      }
      return undefined;
    }, function () { /* offline: sample values only */ });
  }

  // ================================================================================================ warnings bar

  function updateWarnBar() {
    var list = app.warnings || [];
    els.warn.hidden = !list.length;
    D.empty(els.warn);
    if (!list.length) { return; }
    var first = list[0].text;
    var more = list.length > 1 ? ' (+' + (list.length - 1) + ' weitere)' : '';
    var btn = D.el('button', { type: 'button', class: 'dt-warnbar__btn', title: 'Details bei „Felder“' }, [D.icon('alert'), D.el('span', { text: first + more })]);
    btn.addEventListener('click', function () { D.panels.showTab('fields'); if (tablet.matches) { setDrawer('left', true); } });
    els.warn.appendChild(btn);
  }

  // ================================================================================================ keyboard, clipboard

  function isTyping(t) {
    if (!t || !t.tagName) { return false; }
    if (t.isContentEditable) { return true; }
    return /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName);
  }

  function atCanvas(t) { return t === document.body || t === els.viewport || !t || t === document.documentElement; }

  function dialogOpen() { return !!document.querySelector('dialog[open]'); }

  document.addEventListener('keydown', function (ev) {
    var key = ev.key;
    var mod = ev.ctrlKey || ev.metaKey;
    if (mod && !ev.shiftKey && !ev.altKey && (key === 's' || key === 'S')) { ev.preventDefault(); save({ force: true }); return; }
    if (dialogOpen() || isTyping(ev.target) || !app.doc) { return; }
    var lower = key.length === 1 ? key.toLowerCase() : key;
    if (mod && lower === 'z') { ev.preventDefault(); if (ev.shiftKey) { app.redo(); } else { app.undo(); } return; }
    if (mod && lower === 'y') { ev.preventDefault(); app.redo(); return; }
    if (mod && lower === 'a') { ev.preventDefault(); app.selectAll(); return; }
    if (mod && lower === 'd') { ev.preventDefault(); app.duplicateSelection(); return; }
    if (mod && key === '0') { ev.preventDefault(); D.canvas.fit(); return; }
    if (mod && (key === '+' || key === '=')) { ev.preventDefault(); D.canvas.stepZoom(1); return; }
    if (mod && key === '-') { ev.preventDefault(); D.canvas.stepZoom(-1); return; }
    if (mod || ev.altKey) { return; }
    if (key === ' ' || key === 'Spacebar') { if (atCanvas(ev.target)) { ev.preventDefault(); D.canvas.setSpace(true); } return; }
    if (key === '+' || key === '=') { if (atCanvas(ev.target)) { D.canvas.stepZoom(1); } return; }
    if (key === '-') { if (atCanvas(ev.target)) { D.canvas.stepZoom(-1); } return; }
    if (key === 'Escape') {
      if (D.canvas.hasGesture()) { D.canvas.cancelGesture(); return; }
      if (rootEl.classList.contains('is-open-left') || rootEl.classList.contains('is-open-right')) { setDrawer('left', false); return; }
      if (app.sel.length) { app.select([]); }
      return;
    }
    if (!atCanvas(ev.target)) { return; }
    if (key === 'Delete' || key === 'Backspace') { if (app.sel.length) { ev.preventDefault(); app.deleteSelection(); } return; }
    if (key === 'Enter') { var one = app.single(); if (one && one.type === 'text') { ev.preventDefault(); D.canvas.startTextEdit(one.id, { selectAll: false }); } return; }
    if (key.indexOf('Arrow') === 0 && app.sel.length) {
      ev.preventDefault();
      var step = D.nudgeStep(app.doc) * (ev.shiftKey ? 10 : 1);
      app.nudge(key === 'ArrowLeft' ? -step : (key === 'ArrowRight' ? step : 0), key === 'ArrowUp' ? -step : (key === 'ArrowDown' ? step : 0));
    }
  });

  document.addEventListener('keyup', function (ev) { if (ev.key === ' ' || ev.key === 'Spacebar') { D.canvas.setSpace(false); } });
  window.addEventListener('blur', function () { D.canvas.setSpace(false); });

  function clipboardTarget(ev) { return !isTyping(ev.target) && !dialogOpen() && app.doc; }

  document.addEventListener('copy', function (ev) {
    if (!clipboardTarget(ev) || !app.sel.length) { return; }
    var json = app.copySelection();
    if (json && ev.clipboardData) { ev.clipboardData.setData('text/plain', json); ev.preventDefault(); }
  });
  document.addEventListener('cut', function (ev) {
    if (!clipboardTarget(ev) || !app.sel.length || !app.editable()) { return; }
    var json = app.copySelection();
    if (json && ev.clipboardData) { ev.clipboardData.setData('text/plain', json); ev.preventDefault(); }
    app.deleteSelection();
  });
  document.addEventListener('paste', function (ev) {
    if (!clipboardTarget(ev) || !app.editable()) { return; }
    var text = ev.clipboardData ? ev.clipboardData.getData('text/plain') : '';
    ev.preventDefault();
    app.paste(text);
  });

  // ================================================================================================ start

  function pickDefaultFamily(list) {
    var preferred = ['Open Sans', 'Source Sans 3', 'Montserrat', 'Roboto Slab'];
    for (var i = 0; i < preferred.length; i++) { if (list.some(function (f) { return f.family === preferred[i]; })) { return preferred[i]; } }
    return list.length ? list[0].family : 'sans-serif';
  }

  function offerDraft(serverDoc, serverRevision) {
    var draft = null;
    try { draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch (e) { draft = null; }
    if (!draft || !draft.document || !config.canEdit) { return Promise.resolve(null); }
    var normalized = window.DtEngine.normalize(draft.document);
    if (D.same(normalized, serverDoc)) { clearDraft(); return Promise.resolve(null); }
    var when = new Date(draft.time || Date.now());
    var stamp = when.toLocaleDateString('de-DE') + ', ' + when.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) + ' Uhr';
    var stale = draft.revision < serverRevision;
    var message = 'Auf diesem Gerät gibt es ungespeicherte Änderungen vom ' + stamp + '.' + (stale ? ' Das Design wurde seitdem von jemandem gespeichert: beim Speichern kannst du entscheiden, ob du eine Kopie anlegst.' : '') + ' Möchtest du sie wiederherstellen?';
    return window.MatUi.confirm(message, { ok: 'Wiederherstellen', cancel: 'Verwerfen', title: 'Ungespeicherte Änderungen' }).then(function (ok) {
      if (!ok) { clearDraft(); return null; }
      return { doc: normalized, revision: draft.revision };
    });
  }

  function showFailure(text) {
    els.loading.classList.add('is-failed');
    D.empty(els.loading);
    els.loading.appendChild(D.el('span', { text: text }));
    var retry = D.el('button', { type: 'button', class: 'mat-btn mat-btn--secondary mat-btn--sm', text: 'Erneut versuchen' });
    retry.addEventListener('click', function () { window.location.reload(); });
    els.loading.appendChild(retry);
  }

  function boot() {
    D.canvas.init(app, els);
    D.props.init(app, $('#dt-props'));
    D.panels.init(app);
    initName();
    initZoom();
    initDrawers();
    els.undo.addEventListener('click', function () { app.undo(); });
    els.redo.addEventListener('click', function () { app.redo(); });
    if (els.save) { els.save.addEventListener('click', function () { save({ force: true }); }); }
    app.on('warnings', updateWarnBar);
    phone.addEventListener('change', applyRole);

    // one shared list of asset keys for the inputs that take a key
    var keyList = D.el('datalist', { id: 'dt-asset-keys' });
    document.body.appendChild(keyList);
    app.on('assets', function () {
      D.empty(keyList);
      app.assets.slice(0, 500).forEach(function (a) { keyList.appendChild(D.el('option', { value: a.key, text: a.name })); });
    });

    var loadDesign = D.request('GET', '/api/designs/' + config.id);
    var loadFonts = D.request('GET', '/api/fonts').catch(function () { return { ok: false, data: [] }; });
    var loadAssets = D.request('GET', '/api/assets?take=500').catch(function () { return { ok: false, data: [] }; });

    Promise.all([loadDesign, loadFonts, loadAssets]).then(function (results) {
      var design = results[0];
      if (!design.ok) {
        showFailure(design.status === 404 ? 'Das Design gibt es nicht mehr.' : 'Das Design konnte nicht geladen werden.');
        return null;
      }
      var fonts = results[1].ok ? results[1].data : [];
      app.fonts = fonts.map(function (f) { return { family: f.family, weight: f.weight, style: f.style, url: f.url }; });
      app.fontIndex = D.buildFontIndex(fonts);
      app.defaultFamily = pickDefaultFamily(app.fontIndex);
      var assets = results[2].ok ? results[2].data : [];
      app.setAssets(assets, assets.length < 500);
      if (design.data.canEdit === false) { config.canEdit = false; app.canEdit = false; }
      var serverDoc = window.DtEngine.normalize(design.data.document);
      app.revision = design.data.revision;
      app.baseRevision = design.data.revision;
      app.name = design.data.name;
      config.name = design.data.name;
      els.name.value = design.data.name;
      return offerDraft(serverDoc, design.data.revision).then(function (restored) {
        applyRole();
        app.setDocument(restored ? restored.doc : serverDoc);
        if (restored) { app.baseRevision = restored.revision; app.dirty = true; app.setSaveState('dirty'); }
        rootEl.classList.remove('is-loading');
        els.loading.hidden = true;
        requestAnimationFrame(function () { D.canvas.fit(); updateZoomUi(); });
        return initPreview();
      });
    }).catch(function (err) {
      if (window.console) { console.error('designer start', err); }
      showFailure('Der Designer konnte nicht gestartet werden.');
    });
  }

  boot();
})();
