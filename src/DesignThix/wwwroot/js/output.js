/* DesignThix: the run page of an output (phase H).
   <div class="dt-run" id="dt-run" data-payload-url="/api/outputs/5/payload" data-output-id="5" data-adhoc="false" data-back-href="...">
   The script loads the payload of the job and renders every label with the engine (DtEngine.render, mode 'output'):
     print / PDF  every label is placed in mm on a page (one label per page at the size of the design, or labels on sheets of paper with optional crop marks); the paper
                  size is an @page rule inserted into output.css through the CSSOM; "Drucken" calls window.print() and the browser's "Als PDF speichern" makes the PDF
     PNG          every label is rasterised at the DPI of the job (DtEngine.rasterize), the files are packed into a ZIP (DtEngine.zip) that is offered as an object URL
   A design can have several pages (document schema 2): every label (record, every copy) draws ALL pages in order with DtEngine.render(doc, values, { page: i, ... }).
   Single mode: one sheet of paper (or one PNG) per page; sheet mode: every page is one cell of the sheet. The pieces are numbered label by label: label 1 page 1, label 1
   page 2, label 2 page 1 ... (OutputPlan.UnitIndex on the server). The engine's page option and DtEngine.pageCount(doc) come with engine 2; without them page 0 is drawn.
   Contract (GET /api/outputs/{id}/payload, POST /api/outputs/adhoc, see OutputLogic):
     { id, name, designName, mode: 'single'|'sheet', format: 'print'|'png', dpi, cropMarks, scale: 'fit'|'none', startPosition, fileNamePattern, document,
       sheet: { name, paperWidth, paperHeight, marginTop, marginLeft, columns, rows, cellWidth, cellHeight, gapX, gapY } | null,
       labels: [{ rowId, copies, values }], labelCount, pages, unitCount, fonts: [{ family, weight, style, url }], assets: { key: url }, warnings: [] }
   A single print has no id: its request waits in the sessionStorage under the token of the address (?adhoc=token) and is posted to /api/outputs/adhoc.
   After the printing was offered (window.print() returned, or the browser says afterprint) or the ZIP was downloaded, POST /api/outputs/{id}/ran notes the run.
   Everything is built with DOM APIs; no inline styles or scripts: sizes and places are custom properties set through the CSSOM. The page carries
   data-state (loading, rendering, ready, error) and data-labels / data-pages (pages of paper) / data-doc-pages (pages of the design) / data-units for the browser checks. */
(function () {
  'use strict';

  var doc = document;
  var root = doc.getElementById('dt-run');
  if (!root) { return; }

  var SVG_NS = 'http://www.w3.org/2000/svg';
  var MM_PER_PX = 25.4 / 96;
  var MAX_THUMBS = 12;

  var $ = function (id) { return doc.getElementById(id); };
  var ui = {
    title: $('dt-run-title'), meta: $('dt-run-meta'), meter: $('dt-run-meter'), status: $('dt-run-status'), print: $('dt-run-print'), download: $('dt-run-download'),
    warnings: $('dt-run-warnings'), warningsTitle: $('dt-run-warnings-title'), warningsList: $('dt-run-warnings-list'), error: $('dt-run-error'), errorText: $('dt-run-error-text'),
    pages: $('dt-pages'), stage: $('dt-run-stage'), thumbs: $('dt-run-thumbs'),
  };
  var warnings = [];
  var recorded = false;
  var paperMm = { w: 210, h: 297 };
  var pageRule = null;

  // ================================================================================================ small helpers

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

  /** A length in mm for a CSS value: at most 4 decimals. */
  function mm(n) { return (Math.round(n * 10000) / 10000) + 'mm'; }

  function german(n, digits) {
    return Number(n).toLocaleString('de-DE', { maximumFractionDigits: digits === undefined ? 1 : digits });
  }

  function plural(n, one, many) { return german(n, 0) + ' ' + (n === 1 ? one : many); }

  function setState(state) { root.setAttribute('data-state', state); }

  function setStatus(text) { ui.status.textContent = text; }

  function setProgress(done, total) {
    var pct = total > 0 ? Math.max(0, Math.min(100, Math.round(done / total * 100))) : 0;
    ui.meter.style.setProperty('--mat-meter', pct + '%');
  }

  function showError(message) {
    setState('error');
    ui.error.hidden = false;
    ui.errorText.textContent = message;
    setStatus('Die Serienausgabe konnte nicht erstellt werden.');
    ui.meter.style.setProperty('--mat-meter', '0%');
  }

  function addWarnings(list) {
    (list || []).forEach(function (w) { if (w && warnings.indexOf(w) < 0) { warnings.push(w); } });
    ui.warningsList.textContent = '';
    warnings.forEach(function (w) { ui.warningsList.appendChild(el('li', null, w)); });
    ui.warnings.hidden = warnings.length === 0;
    ui.warningsTitle.textContent = warnings.length === 1 ? 'Ein Hinweis' : warnings.length + ' Hinweise';
    root.setAttribute('data-warnings', String(warnings.length));
  }

  // Yielding: the page stays responsive while hundreds of labels are drawn. A message channel is not slowed down in a background tab; every so often the page
  // may also paint (the progress bar).
  var channel = typeof MessageChannel === 'function' ? new MessageChannel() : null;
  var channelWaiting = [];
  if (channel) { channel.port1.onmessage = function () { var next = channelWaiting.shift(); if (next) { next(); } }; }
  var lastYield = performance.now();
  var lastPaint = lastYield;

  function yieldNow() {
    return new Promise(function (resolve) {
      if (channel) { channelWaiting.push(resolve); channel.port2.postMessage(0); } else { setTimeout(resolve, 0); }
    });
  }

  function maybeYield() {
    var now = performance.now();
    if (now - lastYield < 30) { return Promise.resolve(); }
    lastYield = now;
    if (now - lastPaint > 150 && doc.visibilityState === 'visible') {
      lastPaint = now;
      return new Promise(function (resolve) { requestAnimationFrame(function () { resolve(); }); setTimeout(resolve, 120); }).then(function () { lastYield = performance.now(); });
    }
    return yieldNow().then(function () { lastYield = performance.now(); });
  }

  // ================================================================================================ the payload

  function csrf() {
    var meta = doc.querySelector('meta[name="dt-csrf"]');
    return meta ? meta.getAttribute('content') : '';
  }

  function readAnswer(response) {
    return response.json().catch(function () { return {}; }).then(function (body) {
      if (!response.ok) { throw new Error(body && body.error ? body.error : 'Die Serienausgabe konnte nicht geladen werden (Fehler ' + response.status + ').'); }
      return body;
    });
  }

  function loadPayload() {
    var url = root.getAttribute('data-payload-url');
    var failed = function (e) {
      if (e instanceof TypeError) { throw new Error('Die Serienausgabe konnte nicht geladen werden: keine Verbindung. Eine Serienausgabe, die schon einmal geladen war, lässt sich ohne Verbindung noch einmal öffnen.'); }
      throw e;
    };
    if (root.getAttribute('data-adhoc') === 'true') {
      var token = new URLSearchParams(location.search).get('adhoc') || '';
      var body = null;
      try { body = sessionStorage.getItem('dt-adhoc-' + token); } catch (e) { body = null; }
      if (!body) { return Promise.reject(new Error('Die Eingaben für den Einzeldruck sind nicht mehr da. Öffne den Einzeldruck noch einmal und gib die Werte neu ein.')); }
      return fetch(url, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', RequestVerificationToken: csrf() }, body: body }).then(readAnswer, failed);
    }
    return fetch(url, { credentials: 'same-origin', headers: { Accept: 'application/json' } }).then(readAnswer, failed);
  }

  function recordRun(payload) {
    if (recorded || !payload || !payload.id) { return; }
    recorded = true;
    fetch('/api/outputs/' + payload.id + '/ran', { method: 'POST', credentials: 'same-origin', headers: { RequestVerificationToken: csrf() } })
      .catch(function () { recorded = false; /* offline: the next print notes it */ });
  }

  // ================================================================================================ geometry

  /** The labels in order, copies expanded: [{ entry, copy, values, index }]. */
  function expand(payload) {
    var list = [];
    (payload.labels || []).forEach(function (entry) {
      for (var copy = 1; copy <= entry.copies; copy++) { list.push({ entry: entry, copy: copy, values: entry.values || {}, index: list.length }); }
    });
    return list;
  }

  function designSizeMm(document_) {
    var unit = document_.unit === 'px' ? MM_PER_PX : 1;
    return { w: document_.width * unit, h: document_.height * unit };
  }

  /** How many pages the design has: the engine knows (DtEngine.pageCount), else the pages of the document, else one. */
  function pageCountOf(document_) {
    var engine = window.DtEngine;
    var n = engine && typeof engine.pageCount === 'function' ? Number(engine.pageCount(document_)) : (document_ && Array.isArray(document_.pages) ? document_.pages.length : 1);
    return Math.max(1, Math.min(50, isFinite(n) ? Math.floor(n) : 1));
  }

  /** The options of one page of a label: the engine draws page <index> (an engine without pages draws its only page). */
  function pageOptions(options, index) { return Object.assign({}, options, { page: index }); }

  /** Where each label goes. The design in mm; a sheet: the cell of the label, the label centred in it (shrunk to fit when the scale says so). */
  function makeLayout(payload, design, count) {
    var sheet = payload.mode === 'sheet' && payload.sheet ? payload.sheet : null;
    if (!sheet) {
      return {
        sheet: false, pages: count, paper: { w: design.w, h: design.h }, skip: 0, perPage: 1,
        place: function (i) { return { page: i, x: 0, y: 0, w: design.w, h: design.h }; },
        cells: function (page) { return [{ x: 0, y: 0, w: design.w, h: design.h }]; },
      };
    }
    var perPage = Math.max(1, sheet.columns * sheet.rows);
    var skip = Math.max(1, Math.min(perPage, payload.startPosition || 1)) - 1;
    var scale = payload.scale === 'none' ? 1 : Math.min(1, sheet.cellWidth / design.w, sheet.cellHeight / design.h);
    var w = design.w * scale;
    var h = design.h * scale;
    var cell = function (cellNo) {
      var inPage = cellNo % perPage;
      var col = inPage % sheet.columns;
      var row = Math.floor(inPage / sheet.columns);
      return { page: Math.floor(cellNo / perPage), x: sheet.marginLeft + col * (sheet.cellWidth + sheet.gapX), y: sheet.marginTop + row * (sheet.cellHeight + sheet.gapY) };
    };
    return {
      sheet: true, pages: Math.ceil((count + skip) / perPage), paper: { w: sheet.paperWidth, h: sheet.paperHeight }, skip: skip, perPage: perPage, scale: scale,
      place: function (i) {
        var c = cell(i + skip);
        return { page: c.page, x: c.x + (sheet.cellWidth - w) / 2, y: c.y + (sheet.cellHeight - h) / 2, w: w, h: h };
      },
      // the cells of a page that carry a label (for the crop marks)
      cells: function (page) {
        var found = [];
        for (var i = 0; i < count; i++) {
          var c = cell(i + skip);
          if (c.page === page) { found.push({ x: c.x, y: c.y, w: sheet.cellWidth, h: sheet.cellHeight }); }
        }
        return found;
      },
    };
  }

  // ================================================================================================ the paper size (@page through the CSSOM)

  function outputSheet() {
    for (var i = 0; i < doc.styleSheets.length; i++) {
      var s = doc.styleSheets[i];
      if (s.href && /\/css\/output\.css/.test(s.href)) { return s; }
    }
    return null;
  }

  function setPageRule(w, h) {
    var text = '@page { size: ' + mm(w) + ' ' + mm(h) + '; margin: 0; }';
    var sheet = outputSheet();
    try {
      if (sheet) {
        if (pageRule !== null && sheet.cssRules[pageRule] && /^@page/.test(sheet.cssRules[pageRule].cssText)) { sheet.deleteRule(pageRule); }
        pageRule = sheet.insertRule(text, sheet.cssRules.length);
        return;
      }
    } catch (e) { /* fall through to a constructed style sheet */ }
    if (typeof CSSStyleSheet === 'function' && 'adoptedStyleSheets' in doc) {
      var own = new CSSStyleSheet();
      own.insertRule(text);
      doc.adoptedStyleSheets = doc.adoptedStyleSheets.concat([own]);
    }
  }

  /** On the screen the pages are shown as large as fits the window (CSS zoom); printing resets it. */
  function fitZoom() {
    var avail = ui.stage.clientWidth - 24;
    var wanted = paperMm.w / MM_PER_PX;
    var zoom = avail > 0 && wanted > avail ? avail / wanted : 1;
    ui.pages.style.setProperty('zoom', String(Math.max(0.2, Math.round(zoom * 1000) / 1000)));
  }

  // ================================================================================================ print / PDF

  function cropPath(cells) {
    var gap = 0.8;
    var len = 3;
    var d = [];
    cells.forEach(function (c) {
      var x2 = c.x + c.w;
      var y2 = c.y + c.h;
      // two short lines at each corner, outside of the label, pointing away from it
      [[c.x, c.y, -1, -1], [x2, c.y, 1, -1], [c.x, y2, -1, 1], [x2, y2, 1, 1]].forEach(function (p) {
        d.push('M' + (p[0] + p[2] * gap) + ' ' + p[1] + ' H' + (p[0] + p[2] * (gap + len)));
        d.push('M' + p[0] + ' ' + (p[1] + p[3] * gap) + ' V' + (p[1] + p[3] * (gap + len)));
      });
    });
    return d.join(' ');
  }

  function buildPages(layout, crop) {
    ui.pages.textContent = '';
    ui.pages.style.setProperty('--dt-pw', mm(layout.paper.w));
    ui.pages.style.setProperty('--dt-ph', mm(layout.paper.h));
    var pages = [];
    for (var p = 0; p < layout.pages; p++) {
      var sheet = el('div', 'dt-osheet');
      sheet.appendChild(el('div', 'dt-osheet__no', (layout.sheet ? 'Bogen ' : 'Seite ') + (p + 1) + ' von ' + layout.pages));
      var page = el('div', 'dt-opage');
      page.setAttribute('data-page', String(p + 1));
      if (crop && layout.sheet) {
        // under the labels: where a label covers a mark, the label wins
        var marks = svgEl('svg', { class: 'dt-ocrop', viewBox: '0 0 ' + layout.paper.w + ' ' + layout.paper.h, preserveAspectRatio: 'none', 'aria-hidden': 'true', focusable: 'false' }, page);
        svgEl('path', { d: cropPath(layout.cells(p)) }, marks);
      }
      sheet.appendChild(page);
      ui.pages.appendChild(sheet);
      pages.push(page);
    }
    return pages;
  }

  /** A copy of a drawn label with its own ids (clip paths): two elements with the same id in one document would point at each other. */
  function cloneLabel(svg, tag) {
    var copy = svg.cloneNode(true);
    var ids = {};
    var any = false;
    Array.prototype.forEach.call(copy.querySelectorAll('[id]'), function (n) { ids[n.id] = n.id + '-c' + tag; n.id = ids[n.id]; any = true; });
    if (any) {
      Array.prototype.forEach.call(copy.querySelectorAll('*'), function (n) {
        ['clip-path', 'mask', 'fill', 'stroke', 'filter'].forEach(function (a) {
          var v = n.getAttribute(a);
          if (v && v.indexOf('url(#') >= 0) { n.setAttribute(a, v.replace(/url\(#([^)]+)\)/g, function (m, id) { return ids[id] ? 'url(#' + ids[id] + ')' : m; })); }
        });
        var h = n.getAttribute('href');
        if (h && h.charAt(0) === '#' && ids[h.slice(1)]) { n.setAttribute('href', '#' + ids[h.slice(1)]); }
      });
    }
    return copy;
  }

  function place(pages, spot, svg) {
    var box = el('div', 'dt-olabel');
    box.style.setProperty('--dt-x', mm(spot.x));
    box.style.setProperty('--dt-y', mm(spot.y));
    box.style.setProperty('--dt-w', mm(spot.w));
    box.style.setProperty('--dt-h', mm(spot.h));
    box.appendChild(svg);
    pages[spot.page].appendChild(box);
  }

  /** Renders the distinct entries (rows) with all their pages, places every copy of every page. Three entries at a time, then a breath for the browser. */
  function renderPrint(payload, engineDoc, options, labels, layout, pages, pageCount) {
    var entries = [];
    var seen = new Map();
    labels.forEach(function (label) {
      if (!seen.has(label.entry)) { seen.set(label.entry, { entry: label.entry, labels: [] }); entries.push(seen.get(label.entry)); }
      seen.get(label.entry).labels.push(label);
    });
    var done = 0;
    var CONCURRENT = 3;
    var next = 0;
    var flushed = 0;
    var failed = 0;

    // The pictures are drawn a few at a time and finish in any order; they are put on the pages in the order of the labels (the order of the document is the order
    // of reading, of the tab key and of the text in a PDF). Piece number = label * pages of the design + page of the design.
    function flush() {
      while (flushed < entries.length && entries[flushed].finished) {
        var ready = entries[flushed++];
        ready.labels.forEach(function (label, k) {
          (ready.svgs || []).forEach(function (svg, p) {
            if (svg) { place(pages, layout.place(label.index * pageCount + p), k === 0 ? svg : cloneLabel(svg, label.index + '-' + p)); }
          });
        });
      }
    }

    function one(item) {
      item.svgs = [];
      var chain = Promise.resolve();
      for (var p = 0; p < pageCount; p++) {
        (function (pageIndex) {
          chain = chain.then(function () {
            return window.DtEngine.render(engineDoc, item.entry.values, pageOptions(options, pageIndex)).then(function (svg) { item.svgs[pageIndex] = svg; });
          });
        })(p);
      }
      return chain.catch(function (e) {
        failed++;
        if (failed === 1) { addWarnings(['Ein Etikett konnte nicht gezeichnet werden: ' + (e && e.message ? e.message : 'unbekannter Fehler') + '.']); }
      }).then(function () {
        item.finished = true;
        flush();
        done += item.labels.length;
        setProgress(done, labels.length);
        setStatus('Etikett ' + german(Math.min(done, labels.length), 0) + ' von ' + german(labels.length, 0) + ' wird gezeichnet ...');
      });
    }

    function worker() {
      if (next >= entries.length) { return Promise.resolve(); }
      var item = entries[next++];
      return one(item).then(maybeYield).then(worker);
    }

    var workers = [];
    for (var i = 0; i < Math.min(CONCURRENT, entries.length); i++) { workers.push(worker()); }
    return Promise.all(workers);
  }

  function sheetWarnings(payload, design, layout) {
    if (!layout.sheet) { return; }
    var sheet = payload.sheet;
    if (design.w <= sheet.cellWidth + 0.01 && design.h <= sheet.cellHeight + 0.01) { return; }
    var size = german(design.w, 1) + ' × ' + german(design.h, 1) + ' mm';
    var cell = german(sheet.cellWidth, 1) + ' × ' + german(sheet.cellHeight, 1) + ' mm';
    if (payload.scale === 'none') {
      addWarnings(['Das Design (' + size + ') ist größer als das Etikett auf dem Druckbogen (' + cell + ') und ragt über den Rand hinaus.']);
    } else {
      addWarnings(['Das Design (' + size + ') ist größer als das Etikett auf dem Druckbogen (' + cell + '): es wird auf ' + german(layout.scale * 100, 0) + ' % verkleinert.']);
    }
  }

  function runPrint(payload, engineDoc, options, labels) {
    var design = designSizeMm(engineDoc);
    var pageCount = pageCountOf(engineDoc);
    var units = labels.length * pageCount;
    var layout = makeLayout(payload, design, units);
    paperMm = layout.paper;
    setPageRule(layout.paper.w, layout.paper.h);
    sheetWarnings(payload, design, layout);
    var pages = buildPages(layout, payload.cropMarks && layout.sheet);
    fitZoom();
    root.setAttribute('data-pages', String(layout.pages));
    root.setAttribute('data-doc-pages', String(pageCount));
    root.setAttribute('data-units', String(units));
    ui.meta.textContent = payload.designName + ' · ' + plural(labels.length, 'Etikett', 'Etiketten') + (pageCount > 1 ? ' mit je ' + plural(pageCount, 'Seite', 'Seiten') : '')
      + (layout.sheet ? ' auf ' + plural(layout.pages, 'Bogen', 'Bögen') : ' auf ' + plural(layout.pages, 'Seite', 'Seiten'))
      + ' · ' + german(layout.paper.w, 1) + ' × ' + german(layout.paper.h, 1) + ' mm';
    return renderPrint(payload, engineDoc, options, labels, layout, pages, pageCount).then(function () {
      ui.print.hidden = false;
      ui.print.disabled = labels.length === 0;
      ui.print.addEventListener('click', function () {
        try { window.print(); } finally { recordRun(payload); }
      });
      window.addEventListener('afterprint', function () { recordRun(payload); });
      setStatus(labels.length === 0 ? 'Es gibt nichts zu drucken.' : plural(labels.length, 'Etikett', 'Etiketten') + ' bereit: ' + (layout.sheet ? plural(layout.pages, 'Bogen', 'Bögen') : plural(layout.pages, 'Seite', 'Seiten')) + '.');
    });
  }

  // ================================================================================================ PNG / ZIP

  function safeName(text) {
    // eslint-disable-next-line no-control-regex
    return String(text).replace(/[\\\/:*?"<>|\u0000-\u001f]/g, '-').replace(/\s+/g, ' ').replace(/^[\s.]+|[\s.\-_]+$/g, '').slice(0, 120);
  }

  /** The name of the file of a label from the pattern: {Design}, {Nr} (running number), {Kopie}, {Seite} (page of the design) and the keys of the fields. Characters a file system
   *  dislikes become dashes. A design of several pages (pageCount > 1) gets "-<page>" at the end when the pattern has no {Seite}. */
  function fileNameFor(pattern, payload, engineDoc, label, total, page, pageCount) {
    var width = String(total).length;
    var fields = {};
    (engineDoc.fields || []).forEach(function (f) { fields[f.key.toLowerCase()] = f; });
    var values = {};
    Object.keys(label.values || {}).forEach(function (k) { values[k.toLowerCase()] = label.values[k]; });
    var text = String(pattern || '{Design}-{Nr}').replace(/\{\s*([A-Za-z][A-Za-z0-9_]*)\s*\}/g, function (all, key) {
      var k = key.toLowerCase();
      if (k === 'design') { return payload.designName; }
      if (k === 'nr') { return String(label.index + 1).padStart(width, '0'); }
      if (k === 'kopie') { return String(label.copy); }
      if (k === 'seite') { return String((page || 0) + 1); }
      return k in values ? window.DtEngine.formatValue(fields[k] || null, values[k], engineDoc.locale) : '';
    });
    var many = pageCount > 1;
    if (many && !/\{\s*seite\s*\}/i.test(String(pattern || '{Design}-{Nr}'))) { text += '-' + String((page || 0) + 1).padStart(String(pageCount).length, '0'); }
    var name = safeName(text);
    return (name === '' ? 'Etikett-' + (label.index + 1) + (many ? '-' + ((page || 0) + 1) : '') : name) + '.png';
  }

  function runPng(payload, engineDoc, options, labels) {
    var files = [];
    var thumbs = [];
    var done = 0;
    var failed = 0;
    var bytes = 0;
    var pageCount = pageCountOf(engineDoc);
    var units = labels.length * pageCount;
    var rasterOptions = Object.assign({}, options, { dpi: payload.dpi });
    var perEntry = new Map();
    root.setAttribute('data-doc-pages', String(pageCount));
    root.setAttribute('data-units', String(units));
    ui.meta.textContent = payload.designName + ' · ' + plural(units, 'PNG-Bild', 'PNG-Bilder') + (pageCount > 1 ? ' (' + plural(labels.length, 'Etikett', 'Etiketten') + ' mit je ' + plural(pageCount, 'Seite', 'Seiten') + ')' : '') + ' · ' + german(payload.dpi, 0) + ' dpi';

    // the pieces in order: label 1 page 1, label 1 page 2, label 2 page 1 ...
    function step(i) {
      if (i >= units) { return Promise.resolve(); }
      var label = labels[Math.floor(i / pageCount)];
      var page = i % pageCount;
      var cache = perEntry.get(label.entry);
      if (!cache) { cache = []; perEntry.set(label.entry, cache); }
      var cached = cache[page];
      var blobPromise = cached || window.DtEngine.rasterize(engineDoc, label.values, pageOptions(rasterOptions, page));
      cache[page] = blobPromise;
      return blobPromise.then(function (blob) {
        var name = fileNameFor(payload.fileNamePattern, payload, engineDoc, label, labels.length, page, pageCount);
        files.push({ name: name, blob: blob });
        bytes += blob.size;
        if (!cached && thumbs.length < MAX_THUMBS) { thumbs.push({ name: name, blob: blob }); }
      }).catch(function (e) {
        failed++;
        if (failed <= 3) { addWarnings(['Das Etikett ' + (label.index + 1) + (pageCount > 1 ? ' (Seite ' + (page + 1) + ')' : '') + ' konnte nicht als Bild erstellt werden: ' + (e && e.message ? e.message : 'unbekannter Fehler') + '.']); }
      }).then(function () {
        done++;
        setProgress(done, units);
        setStatus('Bild ' + german(done, 0) + ' von ' + german(units, 0) + ' wird erstellt ...');
        return maybeYield();
      }).then(function () { return step(i + 1); });
    }

    return step(0).then(function () {
      setStatus('Die ZIP-Datei wird gepackt ...');
      return window.DtEngine.zip(files);
    }).then(function (zip) {
      var url = URL.createObjectURL(zip);
      ui.download.href = url;
      ui.download.download = (safeName(payload.name) || 'Etiketten') + '.zip';
      ui.download.hidden = false;
      ui.download.addEventListener('click', function () { recordRun(payload); });
      root.setAttribute('data-zip-size', String(zip.size));
      if (thumbs.length > 0) {
        ui.thumbs.hidden = false;
        thumbs.forEach(function (t) {
          var figure = el('figure');
          var img = doc.createElement('img');
          img.alt = '';
          img.src = URL.createObjectURL(t.blob);
          figure.appendChild(img);
          figure.appendChild(el('figcaption', null, t.name));
          ui.thumbs.appendChild(figure);
        });
      }
      var size = bytes >= 1048576 ? german(bytes / 1048576, 1) + ' MB' : german(Math.max(1, bytes / 1024), 0) + ' KB';
      setStatus(plural(files.length, 'Bild', 'Bilder') + ' in der ZIP-Datei (' + size + ').');
    });
  }

  // ================================================================================================ start

  function start() {
    if (!window.DtEngine) { showError('Die Zeichenmaschine (dt-engine.js) wurde nicht geladen.'); return; }
    loadPayload().then(function (payload) {
      ui.title.textContent = payload.name;
      addWarnings(payload.warnings);
      var engineDoc = window.DtEngine.normalize(payload.document);
      var labels = expand(payload);
      root.setAttribute('data-labels', String(labels.length));
      root.setAttribute('data-format', payload.format);
      root.setAttribute('data-mode', payload.mode);
      doc.title = payload.name + ' · DesignThix';
      setState('rendering');
      var assets = payload.assets || {};
      var options = {
        mode: 'output',
        assetUrl: function (key) { return assets[String(key).trim().toLowerCase()] || null; },
        fonts: (payload.fonts || []).map(function (f) { return { family: f.family, weight: f.weight, style: f.style, url: f.url }; }),
        icon: window.DtEngine.iconSource({ extra: payload.icons || {} }),
      };
      var run = payload.format === 'png' ? runPng : runPrint;
      return run(payload, engineDoc, options, labels).then(function () { setProgress(1, 1); setState('ready'); });
    }).catch(function (e) {
      showError(e && e.message ? e.message : 'Unbekannter Fehler.');
    });
  }

  var resizeTimer = 0;
  window.addEventListener('resize', function () { clearTimeout(resizeTimer); resizeTimer = setTimeout(fitZoom, 100); });
  window.DtOutput = { fileNameFor: fileNameFor, safeName: safeName };
  start();
})();
