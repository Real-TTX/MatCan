/* DesignThix editor, part 12: the Datei menu and what is behind it - Neues Design, Kopie erstellen, Größe ändern (formats of /api/formats or a custom size, optionally scaling the
   content through /api/designs/{id}/resize), Exportieren (.dtx.json), Eigenschaften, Verlauf - and the dialogs "Herunterladen" (PNG, JPG, SVG as files, several files as one ZIP made
   by DtEngine.zip; PDF/Drucken opens the print view of the run page) and "Drucken". Leaving the editor for another page saves first (D.file.leave). */
(function () {
  'use strict';

  var D = window.DtDesigner;
  var app;
  var formats = null;

  function loadFormats() {
    if (formats) { return Promise.resolve(formats); }
    return D.request('GET', '/api/formats').then(function (res) { formats = res.ok && Array.isArray(res.data) ? res.data : []; return formats; }, function () { formats = []; return formats; });
  }

  function safeName(text) {
    var n = String(text || 'Design').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-').replace(/\s+/g, ' ').replace(/[ .]+$/g, '').trim();
    return n || 'Design';
  }

  /** Saves, then goes to another page (a link of the menu): nothing of the work is lost. */
  function leave(url) {
    D.save.flush().then(function (ok) { if (ok !== false) { D.save.leaveTo(url); } });
  }

  function sizeText(w, h, unit) { return String(D.round(w, 2)).replace('.', ',') + ' × ' + String(D.round(h, 2)).replace('.', ',') + ' ' + D.unitLabel(unit); }

  // ================================================================================================ the format chooser (Neues Design, Größe ändern)

  /** Builds the chooser into `host`: a list of the formats and the fields of a custom size. Returns { value() -> {width, height, unit, key} | null, onChange }. */
  function formatChooser(host, initial, list) {
    var state = { key: initial.key || 'custom', width: initial.width, height: initial.height, unit: initial.unit };
    var listbox = D.el('div', { class: 'dt-fmtlist', role: 'radiogroup', 'aria-label': 'Format' });
    var width = D.ui.number({ value: state.width, min: 0.1, max: 100000, step: 1, digits: 2, label: 'Breite', onInput: function (v) { state.width = v; state.key = 'custom'; mark(); changed(); } });
    var height = D.ui.number({ value: state.height, min: 0.1, max: 100000, step: 1, digits: 2, label: 'Höhe', onInput: function (v) { state.height = v; state.key = 'custom'; mark(); changed(); } });
    var unit = D.ui.select({ label: 'Einheit', value: state.unit, items: [['mm', 'Millimeter (mm)'], ['px', 'Pixel (px)']], onChange: function (v) { state.unit = v; state.key = 'custom'; mark(); changed(); } });
    var handlers = [];
    var changed = function () { handlers.forEach(function (fn) { fn(); }); };
    var buttons = [];
    var mark = function () {
      buttons.forEach(function (b) { b.setAttribute('aria-checked', String(b.getAttribute('data-key') === state.key)); });
    };
    var groups = new Map();
    list.forEach(function (f) {
      if (f.custom) { return; }
      var g = f.group || 'Weitere';
      if (!groups.has(g)) { groups.set(g, []); }
      groups.get(g).push(f);
    });
    groups.forEach(function (items, name) {
      listbox.appendChild(D.el('h4', { class: 'dt-fmtlist__group', text: name }));
      var row = D.el('div', { class: 'dt-fmtlist__row' });
      items.forEach(function (f) {
        var b = D.el('button', { type: 'button', class: 'dt-format', role: 'radio', 'aria-checked': 'false', 'data-key': f.key, title: f.name });
        b.appendChild(D.icon(String(f.icon || 'square').replace(/^dt:/, ''), 'dt-format__icon'));
        b.appendChild(D.el('span', { class: 'dt-format__name', text: f.title || f.name }));
        b.appendChild(D.el('span', { class: 'dt-format__size', text: sizeText(f.width, f.height, f.unit) }));
        b.addEventListener('click', function () {
          state.key = f.key; state.width = f.width; state.height = f.height; state.unit = f.unit;
          width.set(f.width); height.set(f.height); unit.set(f.unit);
          mark(); changed();
        });
        buttons.push(b);
        row.appendChild(b);
      });
      listbox.appendChild(row);
    });
    host.appendChild(listbox);
    host.appendChild(D.el('h4', { class: 'dt-fmtlist__group', text: 'Eigene Größe' }));
    host.appendChild(D.el('div', { class: 'dt-grid3' }, [D.ui.field('Breite', width.el), D.ui.field('Höhe', height.el), D.ui.field('Einheit', unit.el)]));
    mark();
    return {
      value: function () { return state.width > 0 && state.height > 0 ? { width: state.width, height: state.height, unit: state.unit, key: state.key } : null; },
      onChange: function (fn) { handlers.push(fn); },
    };
  }

  // ================================================================================================ Größe ändern

  function resizeDialog() {
    if (!app.editable()) { return Promise.resolve(); }
    return loadFormats().then(function (list) {
      var doc = app.doc;
      var match = list.find(function (f) { return !f.custom && f.unit === doc.unit && Math.abs(f.width - doc.width) < 0.01 && Math.abs(f.height - doc.height) < 0.01; });
      var chooser = null;
      var scale = null;
      var summary = null;
      return D.dialog.show({
        title: 'Größe ändern', icon: 'scaling', size: 'lg', className: 'dt-resizedlg',
        body: function (body) {
          body.appendChild(D.el('p', { class: 'mat-muted', text: 'Jetzt: ' + sizeText(doc.width, doc.height, doc.unit) + '. Wähle ein Format oder gib eine eigene Größe ein.' }));
          chooser = formatChooser(body, { key: match ? match.key : 'custom', width: doc.width, height: doc.height, unit: doc.unit }, list);
          scale = D.ui.switchBox({ label: 'Inhalt mitskalieren', value: true, onChange: function () { } });
          summary = D.el('p', { class: 'dt-hint' });
          body.appendChild(D.el('div', { class: 'dt-resize__opts' }, [scale.el, summary]));
          var sync = function () {
            var v = chooser.value();
            summary.textContent = v ? 'Neue Größe: ' + sizeText(v.width, v.height, v.unit) + '. Mit „Inhalt mitskalieren“ wachsen oder schrumpfen Texte und Bilder mit; sonst bleiben sie, wie sie sind.' : 'Bitte gib eine Breite und eine Höhe ein.';
          };
          chooser.onChange(sync);
          sync();
        },
        buttons: [
          { label: 'Größe ändern', kind: 'primary', value: 'ok', onClick: function (api) {
            var v = chooser.value();
            if (!v) { return false; }
            api.button('ok').disabled = true;
            applyResize(v, scale.el.querySelector('input').checked).then(function () { api.close('ok'); }, function () { api.button('ok').disabled = false; });
            return false;
          } },
          { label: 'Abbrechen', kind: 'secondary', value: 'cancel' },
        ],
      });
    });
  }

  /** Saves, then asks the server to change the format (and scale the content); the answer replaces the document (one undo step). */
  function applyResize(v, scaleContent) {
    return D.save.flush({ force: true }).then(function (ok) {
      if (ok === false) { D.toast('Speichere zuerst die Änderungen (Verbindung prüfen).', 'warning'); return Promise.reject(new Error('save')); }
      return D.request('POST', '/api/designs/' + app.id + '/resize', { width: v.width, height: v.height, unit: v.unit, scale: !!scaleContent });
    }).then(function (res) {
      if (!res.ok) { D.toast((res.data && res.data.error) || 'Die Größe konnte nicht geändert werden.', 'danger'); return Promise.reject(new Error('resize')); }
      var next = window.DtEngine.normalize(res.data.document);
      app.baseRevision = res.data.revision;
      app.revision = res.data.revision;
      app.edit(function (doc) {
        doc.width = next.width; doc.height = next.height; doc.unit = next.unit; doc.pages = next.pages; doc.fields = next.fields; doc.dpi = next.dpi;
      }, { structure: true, reason: 'resize' });
      app.dirty = false;
      app.setSaveState('saved');
      app.sel = [];
      app.emit('selection');
      app.emit('pages');
      app.fitMode = true;
      D.canvas.fit();
      D.toast('Die Größe ist jetzt ' + sizeText(next.width, next.height, next.unit) + '.', 'success');
      return true;
    });
  }

  // ================================================================================================ Neues Design

  function newDesignDialog() {
    return loadFormats().then(function (list) {
      var chooser = null;
      return D.dialog.show({
        title: 'Neues Design', icon: 'file-plus', size: 'lg', className: 'dt-resizedlg',
        body: function (body) {
          body.appendChild(D.el('p', { class: 'mat-muted', text: 'Wähle ein Format. Dein jetziges Design bleibt gespeichert.' }));
          chooser = formatChooser(body, { key: 'label-150x100', width: 150, height: 100, unit: 'mm' }, list);
        },
        buttons: [
          { label: 'Design erstellen', kind: 'primary', value: 'ok', onClick: function (api) {
            var v = chooser.value();
            if (!v) { return false; }
            api.button('ok').disabled = true;
            D.save.flush().then(function () {
              return D.request('POST', '/api/designs', v.key !== 'custom' ? { preset: v.key } : { width: v.width, height: v.height, unit: v.unit });
            }).then(function (res) {
              if (res.ok && res.data && res.data.url) { D.save.leaveTo(res.data.url); return; }
              D.toast((res.data && res.data.error) || 'Das Design konnte nicht angelegt werden.', 'danger');
              api.button('ok').disabled = false;
            }, function () { D.toast('Keine Verbindung.', 'warning'); api.button('ok').disabled = false; });
            return false;
          } },
          { label: 'Abbrechen', kind: 'secondary', value: 'cancel' },
        ],
      });
    });
  }

  function makeCopy() {
    D.save.flush().then(function () {
      return D.request('POST', '/api/designs/' + app.id + '/copy', { document: app.doc });
    }).then(function (res) {
      if (res.ok && res.data && res.data.id) { D.toast('Die Kopie „' + res.data.name + '“ ist angelegt. Sie wird geöffnet.', 'success'); setTimeout(function () { D.save.leaveTo('/Designs/' + res.data.id + '/Designer'); }, 500); return; }
      D.toast((res.data && res.data.error) || 'Die Kopie konnte nicht angelegt werden.', 'danger');
    }, function () { D.toast('Keine Verbindung: Die Kopie konnte nicht angelegt werden.', 'warning'); });
  }

  // ================================================================================================ Drucken and the print view

  /** Saves the design and opens the print view (the run page of a single print) with the values of the preview. */
  function print() {
    return D.save.flush({ force: true }).then(function (ok) {
      if (ok === false) { D.toast('Zum Drucken muss das Design gespeichert sein.', 'warning'); return; }
      var body = { designId: app.id, values: app.computeValues(), copies: 1, mode: 'single', sheetLayoutId: null, cropMarks: false, scale: 'fit', startPosition: 1, format: 'print', dpi: app.doc.dpi, fileNamePattern: '{Design}-{Nr}' };
      var token = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      try { sessionStorage.setItem('dt-adhoc-' + token, JSON.stringify(body)); } catch (e) { D.toast('Der Browser erlaubt es nicht, die Werte zu merken.', 'danger'); return; }
      D.save.leaveTo('/Outputs/Run?design=' + app.id + '&adhoc=' + token);
    });
  }

  // ================================================================================================ Herunterladen

  function triggerDownload(blob, name) {
    var url = URL.createObjectURL(blob);
    var a = D.el('a', { href: url, download: name, class: 'mat-sr-only' });
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { a.remove(); URL.revokeObjectURL(url); }, 15000);
  }

  var FORMAT_INFO = {
    png: { label: 'PNG', hint: 'Verlustfrei, auch mit durchsichtigem Hintergrund. Gut für Bildschirm und Druck.', ext: 'png' },
    jpeg: { label: 'JPG', hint: 'Kleinere Dateien, ohne Transparenz. Gut für Fotos und zum Teilen.', ext: 'jpg' },
    svg: { label: 'SVG', hint: 'Vektorgrafik: scharf in jeder Größe, Schriften und Bilder sind eingebettet.', ext: 'svg' },
    print: { label: 'PDF / Drucken', hint: 'Öffnet die Druckansicht. Dort druckst du oder speicherst als PDF.', ext: '' },
  };

  function downloadDialog() {
    var doc = app.doc;
    var pages = doc.pages;
    var multi = pages.length > 1;
    var opts = { format: 'png', pages: multi ? 'all' : 'current', chosen: pages.map(function (p, i) { return i === app.pageIndex; }), sizeMode: doc.unit === 'px' ? 'scale' : 'dpi', scale: 1, dpi: doc.dpi || 300, transparent: false };
    var refs = {};
    var pixelSize = function () {
      var inch = window.DtEngine.unitToInch(doc.width, doc.unit);
      var inchH = window.DtEngine.unitToInch(doc.height, doc.unit);
      var dpi = opts.sizeMode === 'scale' ? 96 * opts.scale : opts.dpi;
      return { w: Math.round(inch * dpi), h: Math.round(inchH * dpi), dpi: dpi };
    };
    var selectedPages = function () {
      if (opts.pages === 'current') { return [app.pageIndex]; }
      if (opts.pages === 'choice') { return pages.map(function (p, i) { return i; }).filter(function (i) { return opts.chosen[i]; }); }
      return pages.map(function (p, i) { return i; });
    };
    var sync = function () {
      var info = FORMAT_INFO[opts.format];
      refs.hint.textContent = info.hint;
      var raster = opts.format === 'png' || opts.format === 'jpeg';
      var print = opts.format === 'print';
      refs.sizeBox.hidden = !raster;
      refs.pagesBox.hidden = !multi || print;
      refs.transparentBox.hidden = opts.format !== 'png';
      refs.choiceBox.hidden = opts.pages !== 'choice' || !multi || print;
      var px = pixelSize();
      refs.scaleRow.hidden = opts.sizeMode !== 'scale';
      refs.dpiRow.hidden = opts.sizeMode !== 'dpi';
      refs.pixels.textContent = 'Ergebnis: ' + px.w + ' × ' + px.h + ' px' + (px.w > 16000 || px.h > 16000 ? ' – zu groß, wähle eine kleinere Größe' : '');
      var n = selectedPages().length;
      var button = refs.button();
      button.querySelector('span').textContent = print ? 'Druckansicht öffnen' : (n > 1 ? 'Herunterladen (ZIP)' : 'Herunterladen');
      button.disabled = (!print && n === 0) || (raster && (px.w > 16000 || px.h > 16000));
      D.$$('[data-fmt]', refs.formats).forEach(function (b) { b.setAttribute('aria-checked', String(b.getAttribute('data-fmt') === opts.format)); });
      D.$$('[data-pages]', refs.pagesBox).forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-pages') === opts.pages)); });
      D.$$('[data-size]', refs.sizeBox).forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-size') === opts.sizeMode)); });
      D.$$('[data-scale]', refs.scaleRow).forEach(function (b) { b.setAttribute('aria-pressed', String(Number(b.getAttribute('data-scale')) === opts.scale)); });
    };

    return D.dialog.show({
      title: 'Herunterladen', icon: 'download', size: 'lg', className: 'dt-downloaddlg',
      body: function (body, api) {
        refs.button = function () { return api.button('go'); };
        // format
        refs.formats = D.el('div', { class: 'dt-dl__formats', role: 'radiogroup', 'aria-label': 'Dateityp' });
        ['png', 'jpeg', 'svg', 'print'].forEach(function (f) {
          var b = D.el('button', { type: 'button', class: 'dt-dl__format', role: 'radio', 'data-fmt': f, 'aria-checked': 'false' }, [D.icon(f === 'print' ? 'printer' : (f === 'svg' ? 'shapes' : 'file-image')), D.el('strong', { text: FORMAT_INFO[f].label })]);
          b.addEventListener('click', function () { opts.format = f; sync(); });
          refs.formats.appendChild(b);
        });
        refs.hint = D.el('p', { class: 'dt-hint dt-dl__hint' });
        body.appendChild(D.ui.field('Dateityp', refs.formats));
        body.appendChild(refs.hint);

        // pages
        refs.pagesBox = D.el('div', { class: 'dt-f' });
        refs.pagesBox.appendChild(D.el('span', { class: 'dt-f__label', text: 'Seiten' }));
        var seg = D.el('div', { class: 'mat-seg dt-seg', role: 'group', 'aria-label': 'Seiten' });
        [['all', 'Alle Seiten (' + pages.length + ')'], ['current', 'Diese Seite'], ['choice', 'Auswahl']].forEach(function (p) {
          var b = D.el('button', { type: 'button', class: 'mat-seg__btn', 'data-pages': p[0], 'aria-pressed': 'false', text: p[1] });
          b.addEventListener('click', function () { opts.pages = p[0]; sync(); });
          seg.appendChild(b);
        });
        refs.pagesBox.appendChild(seg);
        body.appendChild(refs.pagesBox);
        refs.choiceBox = D.el('div', { class: 'dt-dl__choice', role: 'group', 'aria-label': 'Seiten auswählen' });
        pages.forEach(function (p, i) {
          var cb = D.el('input', { type: 'checkbox', 'data-page': i });
          cb.checked = opts.chosen[i];
          cb.addEventListener('change', function () { opts.chosen[i] = cb.checked; sync(); });
          refs.choiceBox.appendChild(D.el('label', { class: 'dt-dl__page' }, [cb, D.el('span', { text: 'Seite ' + (i + 1) + (p.name ? ' · ' + p.name : '') })]));
        });
        body.appendChild(refs.choiceBox);

        // size
        refs.sizeBox = D.el('div', { class: 'dt-f' });
        refs.sizeBox.appendChild(D.el('span', { class: 'dt-f__label', text: 'Größe' }));
        var sizeSeg = D.el('div', { class: 'mat-seg dt-seg', role: 'group', 'aria-label': 'Größe festlegen durch' });
        [['scale', 'Faktor'], ['dpi', 'Auflösung (dpi)']].forEach(function (m) {
          var b = D.el('button', { type: 'button', class: 'mat-seg__btn', 'data-size': m[0], 'aria-pressed': 'false', text: m[1] });
          b.addEventListener('click', function () { opts.sizeMode = m[0]; sync(); });
          sizeSeg.appendChild(b);
        });
        refs.sizeBox.appendChild(sizeSeg);
        refs.scaleRow = D.el('div', { class: 'mat-seg dt-seg dt-dl__scale', role: 'group', 'aria-label': 'Faktor' });
        [1, 2, 3, 4].forEach(function (s) {
          var b = D.el('button', { type: 'button', class: 'mat-seg__btn', 'data-scale': s, 'aria-pressed': 'false', text: '×' + s });
          b.addEventListener('click', function () { opts.scale = s; sync(); });
          refs.scaleRow.appendChild(b);
        });
        var dpiNumber = D.ui.number({ value: opts.dpi, min: 72, max: 1200, step: 10, digits: 0, suffix: 'dpi', label: 'Auflösung in dpi', onInput: function (v) { opts.dpi = Math.round(v); sync(); } });
        refs.dpiRow = D.el('div', { class: 'dt-dl__dpi' }, dpiNumber.el);
        refs.pixels = D.el('p', { class: 'dt-hint dt-dl__pixels', role: 'status' });
        refs.sizeBox.appendChild(refs.scaleRow);
        refs.sizeBox.appendChild(refs.dpiRow);
        refs.sizeBox.appendChild(refs.pixels);
        body.appendChild(refs.sizeBox);

        refs.transparentBox = D.ui.switchBox({ label: 'Transparenter Hintergrund', value: false, onChange: function (v) { opts.transparent = v; } });
        refs.transparentBox = refs.transparentBox.el;
        body.appendChild(refs.transparentBox);
        refs.status = D.el('p', { class: 'dt-hint dt-dl__status', role: 'status', 'aria-live': 'polite', hidden: true });
        body.appendChild(refs.status);
        sync();
      },
      buttons: [
        { label: 'Herunterladen', kind: 'primary', value: 'go', icon: 'download', onClick: function (api) { run(api, opts, selectedPages(), refs); return false; } },
        { label: 'Abbrechen', kind: 'secondary', value: 'cancel' },
      ],
    });
  }

  function run(api, opts, pageList, refs) {
    var doc = app.doc;
    if (opts.format === 'print') { api.close('print'); print(); return; }
    var button = api.button('go');
    button.disabled = true;
    var values = app.computeValues();
    var common = { assetUrl: app.assetUrl, fonts: app.fonts, icon: D.icons.body };
    var info = FORMAT_INFO[opts.format];
    var base = safeName(app.name || 'Design');
    var files = [];
    var px = (function () { var dpi = opts.sizeMode === 'scale' ? 96 * opts.scale : opts.dpi; return dpi; })();
    refs.status.hidden = false;
    var step = Promise.resolve();
    pageList.forEach(function (index, n) {
      step = step.then(function () {
        refs.status.textContent = 'Seite ' + (index + 1) + ' wird erstellt … (' + (n + 1) + ' von ' + pageList.length + ')';
        var name = base + (pageList.length > 1 || doc.pages.length > 1 ? '-' + (index + 1) : '') + '.' + info.ext;
        var o = Object.assign({ page: index }, common);
        var make;
        if (opts.format === 'svg') { make = window.DtEngine.toStandaloneSvg(doc, values, o).then(function (text) { return new Blob([text], { type: 'image/svg+xml;charset=utf-8' }); }); }
        else {
          o.dpi = px;
          o.format = opts.format;
          if (opts.format === 'png' && opts.transparent) { o.background = false; }
          make = window.DtEngine.rasterize(doc, values, o);
        }
        return make.then(function (blob) { files.push({ name: name, blob: blob }); });
      });
    });
    step.then(function () {
      if (files.length === 1) { triggerDownload(files[0].blob, files[0].name); return null; }
      refs.status.textContent = 'Die ZIP-Datei wird gepackt …';
      return window.DtEngine.zip(files).then(function (zip) { triggerDownload(zip, base + '.zip'); });
    }).then(function () {
      D.toast(files.length === 1 ? 'Die Datei wird heruntergeladen.' : 'Die ZIP-Datei mit ' + files.length + ' Dateien wird heruntergeladen.', 'success');
      api.close('done');
    }, function (err) {
      var message = err && /too large/i.test(String(err.message)) ? 'Das Bild wäre zu groß. Wähle eine kleinere Größe.' : 'Die Datei konnte nicht erstellt werden.';
      refs.status.textContent = message;
      D.toast(message, 'danger');
      button.disabled = false;
    });
  }

  // ================================================================================================ the Datei menu

  function fileMenuItems() {
    var ro = !app.editable();
    var RO = 'Du darfst dieses Design nur ansehen.';
    return [
      { label: 'Neues Design …', icon: 'file-plus', run: newDesignDialog, disabled: ro ? RO : false },
      { label: 'Kopie erstellen', icon: 'copy-plus', run: makeCopy, disabled: ro ? RO : false },
      { label: 'Größe ändern …', icon: 'scaling', run: resizeDialog, disabled: ro ? RO : false },
      { type: 'separator' },
      { label: 'Herunterladen …', icon: 'download', run: downloadDialog },
      { label: 'Drucken', icon: 'printer', run: print },
      { label: 'Exportieren (.dtx.json)', icon: 'file-down', run: function () { D.save.flush().then(function () { var a = D.el('a', { href: '/Designs/Edit/' + app.id + '?handler=Export', download: '', class: 'mat-sr-only' }); document.body.appendChild(a); a.click(); setTimeout(function () { a.remove(); }, 1000); }); } },
      { type: 'separator' },
      { label: 'Eigenschaften', icon: 'sliders-horizontal', run: function () { leave('/Designs/Edit/' + app.id); } },
      { label: 'Verlauf', icon: 'file-clock', run: function () { leave('/Designs/Edit/' + app.id + '?tab=history'); } },
      { type: 'separator' },
      { label: 'Tastenkürzel', icon: 'keyboard', shortcut: '?', run: function () { D.shortcuts.dialog(); } },
    ];
  }

  function init(theApp, refs) {
    app = theApp;
    refs.fileButton.addEventListener('click', function () { D.menu.open(fileMenuItems(), { anchor: refs.fileButton }); });
    refs.downloadButton.addEventListener('click', downloadDialog);
    refs.printButton.addEventListener('click', print);
  }

  D.file = { init: init, resizeDialog: resizeDialog, downloadDialog: downloadDialog, print: print, newDesignDialog: newDesignDialog, makeCopy: makeCopy, leave: leave, menuItems: fileMenuItems, loadFormats: loadFormats };
})();
