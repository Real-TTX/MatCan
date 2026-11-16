/* MatCan editor, part 13: saving. There is no Save button: a change is saved 1.5 s after the last one (autosave), when the tab is hidden, and - with a request that survives
   the closing of the page (fetch keepalive) - on pagehide. Ctrl+S saves at once. The revision check of phase F stays: a save carries the revision it started from, 409 opens a dialog
   (Als Kopie speichern / Neu laden). A draft is kept in localStorage (dt-draft-<id>) 0.9 s after a change and offered after a crash; without a connection the state says so and the save
   waits for `online`. After a save the thumbnail (page 1, sample values) is rasterised and posted, 4 s after the last save. D.save = { now, flush, leaveTo, text }. */
(function () {
  'use strict';

  var D = window.DtDesigner;
  var app;
  var config;
  var DELAY = 1500;
  var KEEPALIVE_LIMIT = 60 * 1024;
  var saving = false;
  var saveAgain = false;
  var savePromise = Promise.resolve(true);
  var autosaveTimer = 0;
  var retryTimer = 0;
  var thumbTimer = 0;
  var thumbnailPending = Promise.resolve();
  var thumbnailDoc = null;     // the document whose thumbnail is still to be posted (the timer runs)
  var leaving = false;
  var conflictOpen = false;
  var keepaliveSent = false;
  var failures = 0;
  var saveAbort = null;       // aborts the request in flight when the connection goes away
  var draftKey;

  var STATE_TEXT = {
    saved: ['Alle Änderungen gespeichert', 'check-circle'],
    dirty: ['Wird gespeichert …', 'refresh'],
    saving: ['Wird gespeichert …', 'refresh'],
    offline: ['Offline – wird später gespeichert', 'cloud-off'],
    error: ['Speichern fehlgeschlagen – neuer Versuch folgt', 'x-circle'],
    readonly: ['Nur ansehen', 'eye'],
    conflict: ['Das Design wurde geändert', 'alert'],
  };

  // ================================================================================================ draft (localStorage)

  var writeDraft = D.debounce(function () {
    if (!app.dirty || !app.doc) { return; }
    try { localStorage.setItem(draftKey, JSON.stringify({ revision: app.baseRevision, document: app.doc, time: Date.now() })); } catch (e) { /* storage full or blocked */ }
  }, 900);

  function clearDraft() {
    writeDraft.cancel();
    try { localStorage.removeItem(draftKey); } catch (e) { /* ignore */ }
  }

  // ================================================================================================ dialogs

  function conflictDialog(serverRevision) {
    conflictOpen = true;
    return D.dialog.show({
      title: 'Das Design wurde inzwischen geändert', icon: 'alert', size: 'sm',
      body: function (body) {
        body.appendChild(D.el('p', { text: 'Jemand hat dieses Design gespeichert, während du daran gearbeitet hast' + (serverRevision ? ' (jetzt Stand ' + serverRevision + ')' : '') + '. Wenn du jetzt speicherst, würden seine Änderungen verloren gehen.' }));
        body.appendChild(D.el('p', { class: 'mat-muted', text: 'Als Kopie speichern legt deine Fassung als neues Design an. Neu laden verwirft deine Änderungen und zeigt den aktuellen Stand.' }));
      },
      buttons: [
        { label: 'Als Kopie speichern', kind: 'primary', value: 'copy' },
        { label: 'Neu laden', kind: 'secondary', value: 'reload' },
        { label: 'Abbrechen', kind: 'secondary', value: 'cancel', spacer: true },
      ],
    }).then(function (v) { conflictOpen = false; return v; });
  }

  function handleConflict(serverRevision) {
    app.setSaveState('conflict');
    return conflictDialog(serverRevision).then(function (choice) {
      if (choice === 'copy') {
        return D.request('POST', '/api/designs/' + config.id + '/copy', { document: app.doc }).then(function (res) {
          if (res.ok && res.data && res.data.id) { clearDraft(); D.toast('Deine Fassung ist als neues Design gespeichert.', 'success'); setTimeout(function () { leaveTo('/Designs/' + res.data.id + '/Designer'); }, 400); return true; }
          D.toast((res.data && res.data.error) || 'Die Kopie konnte nicht gespeichert werden.', 'danger');
          app.setSaveState('dirty');
          return false;
        }, function () { D.toast('Keine Verbindung: Die Kopie konnte nicht gespeichert werden.', 'warning'); return false; });
      }
      if (choice === 'reload') { clearDraft(); leaving = true; window.location.reload(); return false; }
      app.setSaveState('conflict');
      return false;
    });
  }

  function leaveTo(url) {
    leaving = true;
    clearTimeout(thumbTimer);
    if (thumbnailDoc) { postThumbnail(thumbnailDoc); }
    // a thumbnail that is still being made gets a few seconds: it is what the lists show
    Promise.race([thumbnailPending, new Promise(function (resolve) { setTimeout(resolve, 4000); })]).then(function () { window.location.href = url; });
  }

  // ================================================================================================ saving

  /**
   * Saves now (a save in flight is waited for). options.force: save although nothing changed; options.auto: an autosave (the server lets autosaves of one person share one entry of
   * the history; Ctrl+S, leaving, resizing are explicit saves = a new entry). Resolves true when the server has the document, false when not.
   */
  function save(options) {
    var o = options || {};
    if (!config.canEdit || !app.doc) { return Promise.resolve(true); }
    clearTimeout(autosaveTimer);
    if (D.canvas.isEditing()) { D.canvas.endTextEdit(true); }
    if (saving) { saveAgain = true; return savePromise; }
    if (!app.dirty && !o.force) { return Promise.resolve(true); }
    if (!navigator.onLine) { app.setSaveState('offline'); return Promise.resolve(false); }
    if (conflictOpen) { return Promise.resolve(false); }
    saving = true;
    app.setSaveState('saving');
    var sent = JSON.stringify(app.doc);
    var sentDoc = JSON.parse(sent);
    saveAbort = typeof AbortController === 'function' ? new AbortController() : null;
    var abortTimer = saveAbort ? setTimeout(function () { saveAbort.abort(); }, 30000) : 0;
    savePromise = D.request('POST', '/api/designs/' + config.id, { revision: app.baseRevision, document: sentDoc, autosave: !!o.auto }, { signal: saveAbort ? saveAbort.signal : undefined }).then(function (res) {
      clearTimeout(abortTimer);
      if (res.ok) {
        failures = 0;
        app.revision = res.data.revision;
        app.baseRevision = res.data.revision;
        app.dirty = JSON.stringify(app.doc) !== sent;
        app.setSaveState(app.dirty ? 'dirty' : 'saved');
        if (!app.dirty) { clearDraft(); } else { writeDraft(); schedule(); }
        if (res.data.warnings && res.data.warnings.length) { D.toast(res.data.warnings[0], 'warning'); }
        scheduleThumbnail(sentDoc);
        return true;
      }
      if (res.status === 409) { return resolveConflict(res.data && res.data.revision, sentDoc); }
      app.setSaveState('error');
      if (res.status === 403) { D.toast('Du darfst dieses Design nicht ändern.', 'danger'); }
      else { D.toast((res.data && res.data.error) || 'Das Design konnte nicht gespeichert werden.', 'danger'); retry(); }
      return false;
    }, function (err) {
      clearTimeout(abortTimer);
      if (err && err.offline) { app.setSaveState(navigator.onLine ? 'error' : 'offline'); retry(); }
      else { app.setSaveState('error'); retry(); }
      return false;
    }).then(function (ok) {
      saving = false;
      if (saveAgain) { saveAgain = false; if (app.dirty) { return save({ auto: o.auto }); } }
      return ok;
    });
    return savePromise;
  }

  /**
   * A 409 is not always somebody else: a save whose answer was lost (the connection went away just after it was sent) has been written, and the next one is stale. When the server holds
   * the document that was sent (or the one we have now), its revision is taken and the save goes on without a question; only a real difference opens the dialog.
   */
  function resolveConflict(serverRevision, sentDoc) {
    return D.request('GET', '/api/designs/' + config.id).then(function (res) {
      if (!res.ok) { return handleConflict(serverRevision); }
      var theirs = JSON.stringify(window.DtEngine.normalize(res.data.document));
      var same = theirs === JSON.stringify(window.DtEngine.normalize(sentDoc)) || theirs === JSON.stringify(window.DtEngine.normalize(app.doc));
      if (!same) { return handleConflict(res.data.revision); }
      app.baseRevision = res.data.revision;
      app.revision = res.data.revision;
      app.dirty = theirs !== JSON.stringify(window.DtEngine.normalize(app.doc));
      if (!app.dirty) { app.setSaveState('saved'); clearDraft(); return true; }
      app.setSaveState('dirty');
      saveAgain = true;
      return true;
    }, function () { return handleConflict(serverRevision); });
  }

  function retry() {
    clearTimeout(retryTimer);
    failures++;
    retryTimer = setTimeout(function () { if (app.dirty && !conflictOpen) { save({ auto: true }); } }, Math.min(30000, 5000 * failures));
  }

  /** A change is saved 1.5 s after the last one (not while a gesture is going on or a text is being typed). */
  function schedule() {
    if (!config.canEdit) { return; }
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(function () {
      if (D.canvas.hasGesture()) { schedule(); return; }
      if (app.dirty) { save({ auto: true }); }
    }, DELAY);
  }

  /** The request of the last moment (pagehide): it survives the page when its body is small enough. */
  function saveKeepalive() {
    if (!config.canEdit || !app.doc || !app.dirty || keepaliveSent || conflictOpen) { return; }
    if (D.canvas.isEditing()) { D.canvas.endTextEdit(true); }
    var body = JSON.stringify({ revision: app.baseRevision, document: app.doc, autosave: true });
    if (body.length > KEEPALIVE_LIMIT) { return; }
    keepaliveSent = true;
    try {
      fetch('/api/designs/' + config.id, { method: 'POST', keepalive: true, credentials: 'same-origin', headers: { 'Content-Type': 'application/json', RequestVerificationToken: D.csrf() }, body: body }).catch(function () { /* the page is gone */ });
    } catch (e) { keepaliveSent = false; }
  }

  /** The page came back from the cache after a keepalive save: take the revision of the server when it holds our document. */
  function adoptRevision() {
    return D.request('GET', '/api/designs/' + config.id).then(function (res) {
      if (!res.ok) { return; }
      var theirs = JSON.stringify(window.DtEngine.normalize(res.data.document));
      var ours = JSON.stringify(window.DtEngine.normalize(app.doc));
      if (theirs === ours) { app.baseRevision = res.data.revision; app.revision = res.data.revision; app.dirty = false; app.setSaveState('saved'); clearDraft(); }
      else if (res.data.revision !== app.baseRevision) { handleConflict(res.data.revision); }
    }, function () { /* offline */ });
  }

  /** The preview of the design for the lists: page 1 with the sample values at 480 px width, 4 s after the last save (failures do not matter). */
  function scheduleThumbnail(doc) {
    clearTimeout(thumbTimer);
    thumbnailDoc = doc;
    thumbTimer = setTimeout(function () { postThumbnail(doc); }, 4000);
  }

  function postThumbnail(doc) {
    thumbnailDoc = null;
    thumbnailPending = window.DtEngine.rasterize(doc, window.DtEngine.sampleValues(doc), { page: 0, maxWidth: 480, assetUrl: app.assetUrl, fonts: app.fonts, icon: D.icons.body }).then(function (blob) {
      if (blob.size > 2 * 1024 * 1024) { return null; }
      return D.request('POST', '/api/designs/' + config.id + '/thumbnail', blob, { raw: true, contentType: 'image/png' });
    }).catch(function () { /* no thumbnail this time */ });
    return thumbnailPending;
  }

  // ================================================================================================ the state in the bar

  function updateStateUi(refs) {
    var state = !config.canEdit ? 'readonly' : app.saveState;
    var info = STATE_TEXT[state] || STATE_TEXT.saved;
    refs.state.setAttribute('data-state', state);
    refs.stateText.textContent = info[0];
    refs.state.title = info[0];
    var use = refs.state.querySelector('use');
    if (use) { use.setAttribute('href', (document.getElementById('dt-i-' + info[1]) ? '#dt-i-' : '#mat-i-') + info[1]); }
  }

  /** The draft of the last session: offered when it differs from the server's document. Resolves with { doc, revision } or null. */
  function offerDraft(serverDoc, serverRevision) {
    var draft = null;
    try { draft = JSON.parse(localStorage.getItem(draftKey) || 'null'); } catch (e) { draft = null; }
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

  function init(theApp, theConfig, refs) {
    app = theApp;
    config = theConfig;
    draftKey = 'dt-draft-' + config.id;
    app.on('state', function () { updateStateUi(refs); });
    app.on('readonly', function () { updateStateUi(refs); });
    app.on('dirty', function () { writeDraft(); keepaliveSent = false; schedule(); });
    updateStateUi(refs);
    window.addEventListener('online', function () { failures = 0; clearTimeout(retryTimer); if (app.dirty && config.canEdit) { save({ auto: true }); } });
    window.addEventListener('offline', function () { if (saveAbort) { saveAbort.abort(); } if (app.dirty) { app.setSaveState('offline'); } });
    document.addEventListener('visibilitychange', function () { if (document.hidden && app.dirty && config.canEdit) { save({ auto: true }); } });
    window.addEventListener('pagehide', function () { if (!leaving) { saveKeepalive(); } });
    window.addEventListener('pageshow', function (ev) { if (ev.persisted && keepaliveSent) { keepaliveSent = false; adoptRevision(); } });
    window.addEventListener('beforeunload', function (ev) {
      if (leaving || !config.canEdit || !(app.dirty || saving)) { return; }
      // a small document is saved by the keepalive request of pagehide; only a large one (or a conflict) needs the question
      if (!conflictOpen && JSON.stringify(app.doc).length < KEEPALIVE_LIMIT && navigator.onLine) { return; }
      ev.preventDefault();
      ev.returnValue = '';
    });
    // Leaving by a link marked data-leave: save first when there is something unsaved.
    D.$$('[data-leave]').forEach(function (a) {
      a.addEventListener('click', function (ev) {
        if (ev.defaultPrevented || ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.button !== 0 || !config.canEdit || !(app.dirty || saving)) { return; }
        ev.preventDefault();
        var href = a.getAttribute('href');
        save().then(function (ok) { if (ok) { leaveTo(href); } });
      });
    });
  }

  D.save = {
    init: init,
    now: function (options) { return save(options); },
    /** Saves what is unsaved (waits for a save in flight) and resolves true/false. */
    flush: function (options) { return save(options || {}); },
    leaveTo: leaveTo,
    offerDraft: offerDraft,
    clearDraft: clearDraft,
    thumbnail: function () { return postThumbnail(app.doc); },
    isSaving: function () { return saving; },
  };
})();
