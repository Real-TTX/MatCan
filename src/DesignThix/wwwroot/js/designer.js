/* DesignThix editor, part 15 (loaded last): starts everything. Loads the document, fonts, uploads, the brand kit and the data lists, then starts the modules in order:
   canvas -> toolbar, panels, page strip -> input/output (paste, drop), saving, Datei menu, keyboard. It also wires the top bar (name, undo/redo, state), the context menu, the tab bar
   of phones and the behaviour of small screens (panel as drawer or bottom sheet). The pieces and how to extend them: docs/EDITOR.md. */
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

  var app = D.createApp(config);
  D.app = app;
  var $ = D.$;
  var refs = {
    viewport: $('#dt-viewport'), stage: $('#dt-stage'), sheet: $('#dt-sheet'), page: $('#dt-page'), overlay: $('#dt-overlay'),
    name: $('#dt-name'), undo: $('#dt-undo'), redo: $('#dt-redo'), state: $('#dt-state'), stateText: $('#dt-state-text'),
    warn: $('#dt-warnbar'), loading: $('#dt-loading'),
  };
  var tablet = window.matchMedia('(max-width: 1023px)');
  var phone = window.matchMedia('(max-width: 767px)');

  // ================================================================================================ role and size

  function applyRole() {
    app.readOnly = !config.canEdit;
    rootEl.classList.toggle('is-readonly', !config.canEdit);
    refs.name.readOnly = !config.canEdit;
    app.emit('readonly');
    updateHistoryButtons();
  }

  function applySize() {
    rootEl.classList.toggle('is-phone', phone.matches);
    rootEl.classList.toggle('is-tablet', tablet.matches && !phone.matches);
  }
  tablet.addEventListener('change', applySize);
  phone.addEventListener('change', applySize);
  applySize();

  function updateHistoryButtons() {
    refs.undo.disabled = !app.canUndo();
    refs.redo.disabled = !app.canRedo();
  }
  app.on('history', updateHistoryButtons);
  app.on('doc', updateHistoryButtons);

  // ================================================================================================ name

  function initName() {
    refs.name.value = config.name;
    var committed = config.name;
    var commit = function () {
      var v = refs.name.value.trim();
      if (!config.canEdit || v === committed) { refs.name.value = committed; return; }
      if (!v) { refs.name.value = committed; D.toast('Bitte gib einen Namen ein.', 'warning'); return; }
      D.request('POST', '/api/designs/' + config.id + '/rename', { name: v }).then(function (res) {
        if (res.ok) { committed = res.data.name; refs.name.value = committed; app.name = committed; document.title = committed + ' · DesignThix'; }
        else { refs.name.value = committed; D.toast((res.data && res.data.error) || 'Der Name konnte nicht gespeichert werden.', 'danger'); }
      }, function () { refs.name.value = committed; D.toast('Keine Verbindung: Der Name wurde nicht geändert.', 'warning'); });
    };
    refs.name.addEventListener('focus', function () { if (config.canEdit) { refs.name.select(); } });
    refs.name.addEventListener('change', commit);
    refs.name.addEventListener('keydown', function (ev) {
      ev.stopPropagation();
      if (ev.key === 'Enter') { refs.name.blur(); } else if (ev.key === 'Escape') { refs.name.value = committed; refs.name.blur(); }
    });
  }

  // ================================================================================================ warnings bar

  function updateWarnBar() {
    var list = app.warnings || [];
    refs.warn.hidden = !list.length;
    D.empty(refs.warn);
    if (!list.length) { return; }
    var first = list[0].text;
    var more = list.length > 1 ? ' (+' + (list.length - 1) + ' weitere)' : '';
    var btn = D.el('button', { type: 'button', class: 'dt-warnbar__btn', title: 'Details im Bereich „Daten“' }, [D.icon('alert'), D.el('span', { text: first + more })]);
    btn.addEventListener('click', function () { D.panels.open('data'); });
    refs.warn.appendChild(btn);
  }

  // ================================================================================================ context menu, double click, AI

  function initMenus() {
    app.on('contextmenu', function (ev) {
      var items = ev.node ? D.contextItems(ev.node) : D.pageMenuItems();
      D.menu.open(items, { x: ev.x, y: ev.y });
    });
    app.on('node:dblclick', function (ev) {
      var node = ev.node;
      if (!app.editable() || node.locked) { return; }
      if (node.type === 'image' && !node.source) { D.cmd.replaceImage(); return; }
      if (node.type === 'image' && D.cmd.canCrop()) { D.cmd.crop(); }
    });
    var host = rootEl;
    if (host.getAttribute('data-ai') === 'true' && window.DtAi && config.canEdit) {
      D.aiSuggest = function () {
        var e = app.single();
        if (!e || e.type !== 'text') { return; }
        var ids = [e.id];
        window.DtAi.suggestText({
          designId: config.id, text: e.text || '', elementName: e.name || '', width: e.w, height: e.h, unit: app.unit(),
          fields: (app.doc.fields || []).map(function (f) { return { key: f.key, label: f.label, type: f.type, sample: f.sample }; }),
          onPick: function (text) { app.setProps(ids, function (el) { return D.canvas.textPatch(el, { text: String(text).slice(0, 5000) }); }, { merge: false }); },
        });
      };
    }
  }

  // ================================================================================================ phones and tablets

  function initResponsive() {
    // choosing something on the canvas is the end of looking in a drawer or sheet
    refs.viewport.addEventListener('pointerdown', function () { if (tablet.matches && D.panels.isOpen()) { D.panels.close(); } });
    app.on('doc', function (ev) { if (tablet.matches && (ev.reason === 'add' || ev.reason === 'template' || ev.reason === 'paste') && D.panels.isOpen()) { D.panels.close(); } });
    // after a click in a panel the keyboard belongs to the canvas again (Entf, Pfeile, Strg+Z)
    app.on('selection', function () {
      var a = document.activeElement;
      if (a && a !== document.body && a.closest && a.closest('.dt-panel, .dt-tabbar') && a.tagName === 'BUTTON') { refs.viewport.focus({ preventScroll: true }); }
    });
    var tabbar = $('#dt-tabbar');
    D.$$('.dt-tabbar__btn[data-panel]', tabbar).forEach(function (b) {
      b.addEventListener('click', function () { D.panels.toggle(b.getAttribute('data-panel')); });
    });
    var more = $('#dt-tabbar-more');
    more.addEventListener('click', function () {
      var items = [
        { label: 'Vorlagen', icon: 'layout-template', run: function () { D.panels.open('templates'); } },
        { label: 'Marke', icon: 'badge-check', run: function () { D.panels.open('brand'); } },
        { label: 'Daten (Zusatz)', icon: 'database', run: function () { D.panels.open('data'); } },
        { type: 'separator' },
        { label: 'Herunterladen …', icon: 'download', run: D.file.downloadDialog },
        { label: 'Drucken', icon: 'printer', run: D.file.print },
        { label: 'Größe ändern …', icon: 'scaling', run: D.file.resizeDialog, disabled: app.editable() ? false : 'Du darfst dieses Design nur ansehen.' },
        { label: 'Seite hinzufügen', icon: 'file-plus', run: D.cmd.addPage, disabled: app.editable() ? false : 'Du darfst dieses Design nur ansehen.' },
        { type: 'separator' },
        { label: 'Datei', icon: 'file-stack', submenu: D.file.menuItems() },
        { label: 'Zur Startseite', icon: 'arrow-left', run: function () { D.file.leave('/'); } },
      ];
      D.menu.open(items, { anchor: more });
    });
  }

  // ================================================================================================ start

  function pickDefaultFamily(list) {
    var preferred = ['Open Sans', 'Source Sans 3', 'Montserrat', 'Roboto Slab'];
    for (var i = 0; i < preferred.length; i++) { if (list.some(function (f) { return f.family === preferred[i]; })) { return preferred[i]; } }
    return list.length ? list[0].family : 'sans-serif';
  }

  function showFailure(text) {
    refs.loading.classList.add('is-failed');
    D.empty(refs.loading);
    refs.loading.appendChild(D.el('span', { text: text }));
    var retry = D.el('button', { type: 'button', class: 'mat-btn mat-btn--secondary mat-btn--sm', text: 'Erneut versuchen' });
    retry.addEventListener('click', function () { window.location.reload(); });
    refs.loading.appendChild(retry);
  }

  function boot() {
    D.canvas.init(app, refs);
    D.io.init(app);
    D.save.init(app, config, refs);
    D.file.init(app, { fileButton: $('#dt-file'), downloadButton: $('#dt-download'), printButton: $('#dt-print') });
    D.shortcuts.init(app, refs.viewport);
    initName();
    initMenus();
    refs.undo.addEventListener('click', function () { app.undo(); });
    refs.redo.addEventListener('click', function () { app.redo(); });
    app.on('warnings', updateWarnBar);

    var loadDesign = D.request('GET', '/api/designs/' + config.id);
    var loadFonts = D.request('GET', '/api/fonts').catch(function () { return { ok: false, data: [] }; });
    var loadAssets = D.request('GET', '/api/assets?take=500').catch(function () { return { ok: false, data: [] }; });
    var loadBrand = D.request('GET', '/api/brand').catch(function () { return { ok: false, data: null }; });
    var loadFormats = D.file.loadFormats();

    Promise.all([loadDesign, loadFonts, loadAssets, loadBrand, loadFormats]).then(function (results) {
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
      if (results[3].ok && results[3].data) { app.brand = results[3].data; }
      app.presets = results[4] || [];
      if (design.data.canEdit === false) { config.canEdit = false; app.canEdit = false; }
      var serverDoc = window.DtEngine.normalize(design.data.document);
      app.revision = design.data.revision;
      app.baseRevision = design.data.revision;
      app.name = design.data.name;
      config.name = design.data.name;
      refs.name.value = design.data.name;
      return D.save.offerDraft(serverDoc, design.data.revision).then(function (restored) {
        applyRole();
        app.setDocument(restored ? restored.doc : serverDoc);
        D.toolbar.init(app, $('#dt-ctx'));
        D.panels.init(app, { root: rootEl, rail: $('#dt-rail'), panel: $('#dt-panel'), body: $('#dt-panel-body'), title: $('#dt-panel-title'), back: $('#dt-panel-back'), close: $('#dt-panel-close') });
        D.pages.init(app, { strip: $('#dt-pages'), zoom: $('#dt-zoombar'), toggle: $('#dt-pages-toggle'), root: rootEl });
        initResponsive();
        if (restored) { app.baseRevision = restored.revision; app.markDirty(); }
        rootEl.classList.remove('is-loading');
        refs.loading.hidden = true;
        requestAnimationFrame(function () { D.canvas.fit(); });
        return D.data.init(app);
      });
    }).catch(function (err) {
      if (window.console) { console.error('designer start', err); }
      showFailure('Der Editor konnte nicht gestartet werden.');
    });
  }

  boot();
})();
