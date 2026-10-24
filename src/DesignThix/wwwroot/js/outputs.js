/* DesignThix: the forms of outputs (phase H).
   - data-dt-output-form   the form of an output (Outputs/Create, Outputs/Edit): the table of rows to choose from, the count of labels, the preview of the sheet with the
                           start position, the warning when the design is larger than a cell, the DPI taken from the design
   - data-dt-print-form    the single print (Designs/Print): a preview with the typed values, the picker for image fields, the sheet preview; "Drucken" and "PNG" keep the
                           request in the sessionStorage and open the run page (Outputs/Run?design=..&adhoc=token)
   Everything is built with DOM APIs (createElement, createElementNS, textContent); no inline styles or scripts, nothing from the data reaches HTML parsing. */
(function () {
  'use strict';

  var doc = document;
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var MM_PER_PX = 25.4 / 96;
  var MAX_LABELS = 2000;
  var CHUNK = 200;

  var $ = function (sel, scope) { return (scope || doc).querySelector(sel); };
  var $$ = function (sel, scope) { return Array.prototype.slice.call((scope || doc).querySelectorAll(sel)); };

  function el(tag, cls, text) {
    var e = doc.createElement(tag);
    if (cls) { e.className = cls; }
    if (text !== undefined && text !== null) { e.textContent = text; }
    return e;
  }

  function svgEl(name, attrs, parent) {
    var e = doc.createElementNS(SVG_NS, name);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, String(attrs[k])); });
    if (parent) { parent.appendChild(e); }
    return e;
  }

  function german(n, digits) { return Number(n).toLocaleString('de-DE', { maximumFractionDigits: digits === undefined ? 1 : digits }); }

  function plural(n, one, many) { return german(n, 0) + ' ' + (n === 1 ? one : many); }

  function int(value, fallback) {
    var n = parseInt(String(value).trim(), 10);
    return isFinite(n) ? n : fallback;
  }

  function clamp(n, low, high) { return Math.max(low, Math.min(high, n)); }

  function later(fn) {
    var timer = 0;
    return function () { clearTimeout(timer); timer = setTimeout(fn, 60); };
  }

  function toast(message, tone) { if (window.MatUi && window.MatUi.toast) { window.MatUi.toast(message, { tone: tone || 'danger' }); } }

  function fetchJson(url) {
    return fetch(url, { credentials: 'same-origin', headers: { Accept: 'application/json' } }).then(function (r) {
      if (!r.ok) { throw new Error('HTTP ' + r.status); }
      return r.json();
    });
  }

  /** The size of a design page in mm. */
  function designMm(document_) {
    var unit = document_ && document_.unit === 'px' ? MM_PER_PX : 1;
    return { w: (document_ ? document_.width : 0) * unit, h: (document_ ? document_.height : 0) * unit };
  }

  // ================================================================================================ the preview of a sheet

  /**
   * Draws the first sheet: the paper, the cells (those before the start position stay empty), the number of each label, the crop marks. `layout` is a sheet as
   * the server sends it (paperWidth ...), `count` the number of labels, `start` the number of the first cell (1-based).
   */
  function drawSheet(host, info, layout, count, start, crop) {
    host.textContent = '';
    if (!layout) {
      host.appendChild(el('p', 'mat-muted', 'Wähle einen Druckbogen, dann siehst du hier, wie die Etiketten darauf sitzen.'));
      if (info) { info.textContent = ''; }
      return;
    }
    var per = layout.columns * layout.rows;
    var skip = clamp(start, 1, per) - 1;
    var pad = Math.max(layout.paperWidth, layout.paperHeight) * 0.02;
    var root = svgEl('svg', { viewBox: [-pad, -pad, layout.paperWidth + 2 * pad, layout.paperHeight + 2 * pad].join(' '), role: 'img', 'aria-label': 'Vorschau des Druckbogens', class: 'dt-sheetsvg' }, host);
    svgEl('rect', { x: 0, y: 0, width: layout.paperWidth, height: layout.paperHeight, class: 'dt-sheetsvg__paper' }, root);
    var fontSize = Math.max(2, Math.min(layout.cellWidth, layout.cellHeight) * 0.18);
    var strokeWidth = Math.max(layout.paperWidth, layout.paperHeight) / 400;
    var gap = Math.min(layout.cellWidth, layout.cellHeight) * 0.03;
    var length = Math.min(layout.cellWidth, layout.cellHeight) * 0.1;
    for (var cell = 0; cell < per; cell++) {
      var col = cell % layout.columns;
      var row = Math.floor(cell / layout.columns);
      var x = layout.marginLeft + col * (layout.cellWidth + layout.gapX);
      var y = layout.marginTop + row * (layout.cellHeight + layout.gapY);
      var number = cell - skip + 1;
      var state = cell < skip ? 'is-skipped' : number <= count ? '' : 'is-free';
      var g = svgEl('g', {}, root);
      svgEl('rect', { x: x, y: y, width: layout.cellWidth, height: layout.cellHeight, 'stroke-width': strokeWidth, class: 'dt-sheetsvg__cell' + (state ? ' ' + state : '') }, g);
      var label = svgEl('text', { x: x + layout.cellWidth / 2, y: y + layout.cellHeight / 2, 'font-size': fontSize, 'text-anchor': 'middle', 'dominant-baseline': 'central', class: 'dt-sheetsvg__label' + (state ? ' is-muted' : '') }, g);
      label.textContent = cell < skip ? '–' : number <= count ? String(number) : '';
      if (crop && !state) {
        var d = [];
        [[x, y, -1, -1], [x + layout.cellWidth, y, 1, -1], [x, y + layout.cellHeight, -1, 1], [x + layout.cellWidth, y + layout.cellHeight, 1, 1]].forEach(function (p) {
          d.push('M' + (p[0] + p[2] * gap) + ' ' + p[1] + ' H' + (p[0] + p[2] * (gap + length)));
          d.push('M' + p[0] + ' ' + (p[1] + p[3] * gap) + ' V' + (p[1] + p[3] * (gap + length)));
        });
        svgEl('path', { d: d.join(' '), 'stroke-width': strokeWidth, class: 'dt-sheetsvg__mark' }, g);
      }
    }
    if (info) {
      var sheets = count > 0 ? Math.ceil((count + skip) / per) : 0;
      info.textContent = plural(per, 'Etikett', 'Etiketten') + ' pro Bogen. ' + (count > 0 ? plural(count, 'Etikett', 'Etiketten') + ' brauchen ' + plural(sheets, 'Bogen', 'Bögen') + (skip > 0 ? ', der erste ab Etikett Nr. ' + (skip + 1) : '') + '.' : '');
    }
  }

  function scaleText(design, layout, scale) {
    if (!design || !layout || design.w <= 0) { return ''; }
    if (design.w <= layout.cellWidth + 0.01 && design.h <= layout.cellHeight + 0.01) { return ''; }
    var size = german(design.w, 1) + ' × ' + german(design.h, 1) + ' mm';
    var cell = german(layout.cellWidth, 1) + ' × ' + german(layout.cellHeight, 1) + ' mm';
    if (scale === 'None') {
      return 'Das Design (' + size + ') ist größer als ein Etikett des Druckbogens (' + cell + '). Es wird nicht verkleinert und ragt über den Rand hinaus.';
    }
    var factor = Math.min(1, layout.cellWidth / design.w, layout.cellHeight / design.h);
    return 'Das Design (' + size + ') ist größer als ein Etikett des Druckbogens (' + cell + '). Es wird auf ' + german(factor * 100, 0) + ' % verkleinert.';
  }

  // ================================================================================================ the form of an output

  function initOutputForm(form) {
    var sheets = [];
    try { sheets = JSON.parse(form.getAttribute('data-sheets') || '[]'); } catch (e) { sheets = []; }
    var designUrl = form.getAttribute('data-design-url') || '/api/designs/';
    var rowsUrl = form.getAttribute('data-rows-url') || '/api/datalists/';
    var input = function (name) { return $('[name="Input.' + name + '"]', form); };
    var q = {
      design: input('DesignId'), list: input('DataListId'), copies: input('Copies'), sheet: input('SheetLayoutId'), start: input('StartPosition'), dpi: input('Dpi'),
      crop: $('input[type="checkbox"][name="Input.CropMarks"]', form), selected: $('[data-dt-selected]', form),
    };
    var radio = function (name) { var r = $('input[type="radio"][name="Input.' + name + '"]:checked', form); return r ? r.value : ''; };
    var host = $('[data-dt-rowpick]', form);
    var countBox = $('[data-dt-count]', form);
    var countText = $('[data-dt-count-text]', form);
    var scaleBox = $('[data-dt-scalewarn]', form);
    var scaleText_ = $('[data-dt-scalewarn-text]', form);
    var previewHost = $('[data-dt-sheet-preview]', form);
    var previewInfo = $('[data-dt-sheet-info]', form);

    var S = { list: null, design: null, selected: new Set(), shown: CHUNK, filter: '', follow: true, autoDpi: null };
    ((q.selected && q.selected.value) || '').split(/[\s,;]+/).forEach(function (id) { var n = int(id, 0); if (n > 0) { S.selected.add(n); } });

    var sheetById = function (id) { return sheets.filter(function (s) { return String(s.id) === String(id); })[0] || null; };

    function writeSelected() {
      if (q.selected) { q.selected.value = Array.from(S.selected).join(', '); }
    }

    // ---------------------------------------------------------------------------------------- the count

    function figures() {
      var jobCopies = clamp(int(q.copies ? q.copies.value : 1, 1), 1, 999);
      if (!S.list) { return { labels: jobCopies, rows: null }; }
      var selection = radio('RowSelection');
      var labels = 0;
      var rows = 0;
      S.list.rows.forEach(function (r) {
        if (selection === 'Active' && !r.isActive) { return; }
        if (selection === 'Selected' && !S.selected.has(r.id)) { return; }
        rows++;
        labels += clamp(r.copies, 1, 999) * jobCopies;
      });
      return { labels: labels, rows: rows };
    }

    function inSheetMode() { return radio('Format') === 'Print' && radio('Mode') === 'Sheet'; }

    function update() {
      var f = figures();
      if (countText) {
        var text = S.list
          ? 'Das ergibt ' + plural(f.labels, 'Etikett', 'Etiketten') + ' aus ' + plural(f.rows, 'Zeile', 'Zeilen') + '.'
          : 'Das ergibt ' + plural(f.labels, 'Etikett', 'Etiketten') + ' mit den Beispielwerten des Designs.';
        var layout = sheetById(q.sheet ? q.sheet.value : '');
        if (inSheetMode() && layout && f.labels > 0) {
          var per = layout.columns * layout.rows;
          var skip = clamp(int(q.start ? q.start.value : 1, 1), 1, per) - 1;
          text += ' Auf dem Druckbogen sind das ' + plural(Math.ceil((f.labels + skip) / per), 'Bogen', 'Bögen') + '.';
        }
        if (f.labels === 0 && S.list) { text += ' Wähle auf dem Reiter „Auswahl“ mindestens eine Zeile.'; }
        if (f.labels > MAX_LABELS) { text += ' Das ist zu viel: eine Ausgabe macht höchstens ' + german(MAX_LABELS, 0) + ' Etiketten.'; }
        countText.textContent = text;
        if (countBox) { countBox.classList.toggle('mat-alert--warning', f.labels > MAX_LABELS || (S.list && f.labels === 0)); countBox.classList.toggle('mat-alert--info', !(f.labels > MAX_LABELS || (S.list && f.labels === 0))); }
      }
      var layoutNow = sheetById(q.sheet ? q.sheet.value : '');
      if (previewHost) {
        drawSheet(previewHost, previewInfo, layoutNow, f.labels, int(q.start ? q.start.value : 1, 1), !!(q.crop && q.crop.checked));
      }
      if (scaleBox) {
        var warning = inSheetMode() ? scaleText(S.design, layoutNow, radio('Scale')) : '';
        scaleBox.hidden = warning === '';
        if (scaleText_) { scaleText_.textContent = warning; }
      }
      updatePickInfo();
    }

    // ---------------------------------------------------------------------------------------- the table of rows

    var pick = null;

    function columnsShown() {
      var columns = (S.list && S.list.columns) || [];
      var text = columns.filter(function (c) { return c.type !== 'image'; });
      return (text.length ? text : columns).slice(0, 4);
    }

    function updatePickInfo() {
      if (!pick) { return; }
      pick.info.textContent = S.list ? S.selected.size + ' von ' + plural(S.list.rows.length, 'Zeile', 'Zeilen') + ' gewählt' : '';
    }

    function renderRows() {
      if (!pick) { return; }
      var columns = columnsShown();
      var text = S.filter.trim().toLowerCase();
      var rows = S.list.rows.filter(function (r) {
        if (text === '') { return true; }
        return columns.some(function (c) { return String((r.values || {})[c.key] || '').toLowerCase().indexOf(text) >= 0; }) || String(r.id) === text;
      });
      pick.body.textContent = '';
      rows.slice(0, S.shown).forEach(function (r) {
        var tr = el('tr', (r.isActive ? '' : 'is-off ') + (S.selected.has(r.id) ? 'is-picked' : ''));
        tr.setAttribute('data-id', String(r.id));
        var td = el('td', 'is-check');
        var box = doc.createElement('input');
        box.type = 'checkbox';
        box.checked = S.selected.has(r.id);
        box.setAttribute('aria-label', 'Zeile ' + (S.list.rows.indexOf(r) + 1) + ' wählen');
        box.setAttribute('data-id', String(r.id));
        td.appendChild(box);
        tr.appendChild(td);
        tr.appendChild(el('td', 'is-num', String(S.list.rows.indexOf(r) + 1)));
        columns.forEach(function (c) { tr.appendChild(el('td', null, (r.values || {})[c.key] || '')); });
        tr.appendChild(el('td', 'is-num', String(r.copies)));
        tr.appendChild(el('td', null, r.isActive ? 'ja' : 'nein'));
        pick.body.appendChild(tr);
      });
      pick.more.hidden = rows.length <= S.shown;
      pick.empty.hidden = rows.length > 0;
      pick.visible = rows;
      updatePickInfo();
    }

    function buildPick() {
      if (!host) { return; }
      host.textContent = '';
      host.setAttribute('aria-busy', 'false');
      pick = null;
      if (!S.list) { return; }
      var columns = columnsShown();
      var bar = el('div', 'dt-rowpick__bar');
      var filterWrap = el('div', 'mat-input-icon dt-rowpick__filter');
      var search = el('input', 'mat-input');
      search.type = 'search';
      search.placeholder = 'Zeilen suchen ...';
      search.setAttribute('aria-label', 'Zeilen suchen');
      search.autocomplete = 'off';
      filterWrap.appendChild(search);
      var all = el('button', 'mat-btn mat-btn--secondary mat-btn--sm', 'Alle sichtbaren wählen');
      all.type = 'button';
      var none = el('button', 'mat-btn mat-btn--ghost mat-btn--sm', 'Auswahl aufheben');
      none.type = 'button';
      var info = el('span', 'dt-rowpick__info');
      info.setAttribute('aria-live', 'polite');
      bar.appendChild(filterWrap);
      bar.appendChild(all);
      bar.appendChild(none);
      bar.appendChild(info);
      var scroll = el('div', 'dt-rowpick__scroll');
      scroll.tabIndex = 0;
      scroll.setAttribute('aria-label', 'Zeilen der Datenliste');
      var table = el('table', 'dt-rowpick__table');
      var head = el('thead');
      var hr = el('tr');
      var th = el('th', 'is-check');
      th.scope = 'col';
      th.appendChild(el('span', 'mat-sr-only', 'Wählen'));
      hr.appendChild(th);
      [['Nr.', 'is-num']].concat(columns.map(function (c) { return [c.label || c.key, '']; })).concat([['Kopien', 'is-num'], ['Aktiv', '']]).forEach(function (h) {
        var cell = el('th', h[1], h[0]);
        cell.scope = 'col';
        hr.appendChild(cell);
      });
      head.appendChild(hr);
      var body = el('tbody');
      table.appendChild(head);
      table.appendChild(body);
      scroll.appendChild(table);
      var empty = el('p', 'mat-muted', 'Keine Zeile gefunden.');
      empty.hidden = true;
      var more = el('button', 'mat-btn mat-btn--secondary dt-rowpick__more', 'Weitere Zeilen anzeigen');
      more.type = 'button';
      more.hidden = true;
      host.appendChild(bar);
      host.appendChild(scroll);
      host.appendChild(empty);
      host.appendChild(more);
      pick = { body: body, info: info, more: more, empty: empty, visible: [] };

      search.addEventListener('input', function () { S.filter = search.value; S.shown = CHUNK; renderRows(); });
      more.addEventListener('click', function () { S.shown += CHUNK; renderRows(); });
      all.addEventListener('click', function () { pick.visible.forEach(function (r) { S.selected.add(r.id); }); writeSelected(); renderRows(); update(); });
      none.addEventListener('click', function () { S.selected.clear(); writeSelected(); renderRows(); update(); });
      body.addEventListener('change', function (e) {
        var t = e.target;
        if (!t || t.type !== 'checkbox') { return; }
        var id = int(t.getAttribute('data-id'), 0);
        if (t.checked) { S.selected.add(id); } else { S.selected.delete(id); }
        var tr = t.closest('tr');
        if (tr) { tr.classList.toggle('is-picked', t.checked); }
        writeSelected();
        update();
      });
      renderRows();
    }

    // ---------------------------------------------------------------------------------------- loading

    var listRequest = 0;
    function loadList(keepSelection) {
      var id = q.list ? q.list.value : '';
      var request = ++listRequest;
      if (!id) { S.list = null; if (!keepSelection) { S.selected.clear(); writeSelected(); } buildPick(); update(); return; }
      if (host) { host.setAttribute('aria-busy', 'true'); }
      fetchJson(rowsUrl + encodeURIComponent(id) + '/rows').then(function (data) {
        if (request !== listRequest) { return; }
        S.list = { id: data.id, columns: data.columns || [], rows: data.rows || [] };
        if (keepSelection) {
          var known = new Set(S.list.rows.map(function (r) { return r.id; }));
          S.selected = new Set(Array.from(S.selected).filter(function (n) { return known.has(n); }));
        } else { S.selected.clear(); }
        writeSelected();
        S.shown = CHUNK;
        buildPick();
        update();
      }).catch(function () {
        if (request !== listRequest) { return; }
        S.list = null;
        if (host) { host.textContent = ''; host.appendChild(el('p', 'mat-muted', 'Die Zeilen der Datenliste konnten nicht geladen werden.')); host.setAttribute('aria-busy', 'false'); }
        update();
      });
    }

    var designRequest = 0;
    function loadDesign() {
      var id = q.design ? q.design.value : '';
      var request = ++designRequest;
      if (!id) { S.design = null; update(); return; }
      fetchJson(designUrl + encodeURIComponent(id)).then(function (data) {
        if (request !== designRequest || !data.document) { return; }
        S.design = designMm(data.document);
        var dpi = clamp(int(data.document.dpi, 300), 72, 600);
        // The resolution follows the design as long as the person has not typed one of his own (a saved value that differs from the design is his own).
        if (q.dpi) {
          if (S.autoDpi === null) { S.follow = q.dpi.value === '' || q.dpi.value === String(dpi); }
          if (S.follow) { q.dpi.value = String(dpi); }
        }
        S.autoDpi = dpi;
        update();
      }).catch(function () { S.design = null; update(); });
    }

    if (q.dpi) { q.dpi.addEventListener('input', function () { S.follow = q.dpi.value === String(S.autoDpi); }); }

    var refresh = update;
    form.addEventListener('input', refresh);
    form.addEventListener('change', function (e) {
      var t = e.target;
      if (t === q.list) { loadList(false); return; }
      if (t === q.design) { loadDesign(); return; }
      refresh();
    });
    loadList(true);
    loadDesign();
    update();
    window.DtOutputForm = { state: S, update: update };
  }

  // ================================================================================================ the single print

  function initPrintForm(form) {
    var engine = window.DtEngine;
    var designId = int(form.getAttribute('data-design-id'), 0);
    var sheets = [];
    try { sheets = JSON.parse(form.getAttribute('data-sheets') || '[]'); } catch (e) { sheets = []; }
    var assetsUrl = form.getAttribute('data-assets-url') || '/api/assets';
    var mediaUrl = form.getAttribute('data-media-url') || '/media/';
    var previewHost = $('[data-dt-print-preview]', form);
    var previewWarn = $('[data-dt-print-warn]', form);
    var sheetHost = $('[data-dt-sheet-preview]', form);
    var sheetInfo = $('[data-dt-sheet-info]', form);
    var scaleBox = $('[data-dt-scalewarn]', form);
    var scaleText_ = $('[data-dt-scalewarn-text]', form);
    var named = function (name) { return $('[name="' + name + '"]', form); };
    var radio = function (name) { var r = $('input[type="radio"][name="' + name + '"]:checked', form); return r ? r.value : ''; };
    var S = { doc: null, fonts: [], design: null };

    function values() {
      var v = {};
      $$('[data-dt-field]', form).forEach(function (field) { v[field.getAttribute('data-dt-field')] = field.value; });
      return v;
    }

    var sheetById = function (id) { return sheets.filter(function (s) { return String(s.id) === String(id); })[0] || null; };

    // ---------------------------------------------------------------------------------------- preview of the label

    var rendering = false;
    var again = false;
    function drawPreview() {
      if (!S.doc || !engine || !previewHost) { return; }
      if (rendering) { again = true; return; }
      rendering = true;
      engine.renderInto(previewHost, S.doc, values(), {
        mode: 'output',
        assetUrl: function (key) { return mediaUrl + encodeURIComponent(String(key).trim().toLowerCase()); },
        fonts: S.fonts,
        idPrefix: 'dtprint',
      }).catch(function () { /* the preview is a convenience */ }).then(function () {
        rendering = false;
        if (again) { again = false; drawPreview(); }
      });
    }

    // ---------------------------------------------------------------------------------------- image fields

    var missing = {};
    function showMissing() {
      var keys = Object.keys(missing).filter(function (k) { return missing[k]; });
      if (previewWarn) { previewWarn.textContent = keys.length ? 'Dieses Medium gibt es nicht: ' + keys.join(', ') + '.' : ''; }
    }

    function syncImageField(box) {
      var input = $('input', box);
      var img = $('[data-dt-imagefield-img]', box);
      var key = input.value.trim().toLowerCase();
      var name = input.getAttribute('data-dt-field');
      if (!key) { img.hidden = true; img.removeAttribute('src'); missing[name] = false; showMissing(); return; }
      img.onload = function () { img.hidden = false; missing[name] = false; showMissing(); };
      img.onerror = function () { img.hidden = true; missing[name] = key; showMissing(); };
      img.src = mediaUrl + encodeURIComponent(key);
    }

    $$('[data-dt-imagefield]', form).forEach(function (box) {
      var input = $('input', box);
      var pickBtn = $('[data-dt-pick]', box);
      var clearBtn = $('[data-dt-clear]', box);
      syncImageField(box);
      input.addEventListener('change', function () { syncImageField(box); drawPreview(); });
      if (clearBtn) { clearBtn.addEventListener('click', function () { input.value = ''; syncImageField(box); drawPreview(); input.focus(); }); }
      if (pickBtn) {
        pickBtn.addEventListener('click', function () {
          var grid = window.DtDataListGrid;
          if (!grid || !grid.pickMedia) { toast('Die Medienauswahl ist nicht verfügbar. Tippe den Schlüssel ein.'); return; }
          grid.pickMedia({ assetsUrl: assetsUrl, mediaUrl: mediaUrl }, { label: box.getAttribute('data-label') || 'Bild', category: box.getAttribute('data-category') || '' }, input.value.trim(), function (picked) {
            input.value = picked || '';
            syncImageField(box);
            drawPreview();
          });
        });
      }
    });

    // ---------------------------------------------------------------------------------------- sheet and warnings

    function updateSheet() {
      var layout = sheetById(named('sheet') ? named('sheet').value : '');
      var sheetMode = radio('mode') === 'sheet';
      var crop = $('input[type="checkbox"][name="crop"]', form);
      if (sheetHost) { drawSheet(sheetHost, sheetInfo, layout, clamp(int(named('copies').value, 1), 1, 999), int(named('start').value, 1), !!(crop && crop.checked)); }
      if (scaleBox) {
        var text = sheetMode ? scaleText(S.design, layout, radio('scale') === 'none' ? 'None' : 'Fit') : '';
        scaleBox.hidden = text === '';
        if (scaleText_) { scaleText_.textContent = text; }
      }
    }

    // ---------------------------------------------------------------------------------------- start

    function request(format) {
      var sheetMode = format === 'print' && radio('mode') === 'sheet';
      var layout = sheetById(named('sheet') ? named('sheet').value : '');
      if (sheetMode && !layout) { toast('Wähle einen Druckbogen aus.', 'warning'); var s = named('sheet'); if (s) { s.focus(); } return null; }
      var copies = clamp(int(named('copies').value, 1), 1, 999);
      return {
        designId: designId,
        values: values(),
        copies: copies,
        mode: sheetMode ? 'sheet' : 'single',
        sheetLayoutId: sheetMode ? layout.id : null,
        cropMarks: !!($('input[type="checkbox"][name="crop"]', form) || {}).checked,
        scale: radio('scale') === 'none' ? 'none' : 'fit',
        startPosition: clamp(int(named('start').value, 1), 1, layout ? layout.columns * layout.rows : 1),
        format: format,
        dpi: clamp(int(named('dpi').value, 300), 72, 600),
        fileNamePattern: '{Design}-{Nr}',
      };
    }

    $$('[data-dt-run]', form).forEach(function (button) {
      button.addEventListener('click', function () {
        var body = request(button.getAttribute('data-dt-run'));
        if (!body) { return; }
        var token = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
        try { sessionStorage.setItem('dt-adhoc-' + token, JSON.stringify(body)); } catch (e) { toast('Der Browser erlaubt es nicht, die Eingaben zu merken.'); return; }
        location.assign('/Outputs/Run?design=' + designId + '&adhoc=' + token);
      });
    });

    var refresh = later(function () { drawPreview(); updateSheet(); });
    form.addEventListener('input', refresh);
    form.addEventListener('change', refresh);
    form.addEventListener('submit', function (e) { e.preventDefault(); });

    var fontsUrl = '/api/fonts';
    Promise.all([fetchJson(form.getAttribute('data-design-url')), fetchJson(fontsUrl).catch(function () { return []; })]).then(function (parts) {
      S.doc = parts[0].document;
      S.design = designMm(S.doc);
      S.fonts = (parts[1] || []).map(function (f) { return { family: f.family, weight: f.weight, style: f.style, url: f.url }; });
      if (previewHost) { previewHost.textContent = ''; }
      drawPreview();
      updateSheet();
    }).catch(function () {
      if (previewHost) { previewHost.textContent = 'Die Vorschau konnte nicht geladen werden.'; }
    });
    updateSheet();
    window.DtPrintForm = { values: values };
  }

  var outputForm = $('[data-dt-output-form]');
  if (outputForm) { initOutputForm(outputForm); }
  var printForm = $('[data-dt-print-form]');
  if (printForm) { initPrintForm(printForm); }
})();
