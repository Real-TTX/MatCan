/* MatCan: the row grid of a data list (phase E).
   <div class="dt-grid" data-dt-grid data-url="/api/datalists/12/rows" data-assets-url="/api/assets" data-media-url="/media/"></div>
   The script loads columns and rows from data-url, lets the person edit them like a small spreadsheet (type, Enter / arrows move between rows,
   Tab between cells, paste a block from Excel, pick images from the media library) and saves the WHOLE set with ONE POST and a revision check.
   Contract (see docs/PLAN.md, phase E):
     GET  data-url  -> { id, name, revision, canEdit, columns:[{key,label,type,decimals,category}], rows:[{id,values:{key:text},copies,isActive}] }
     POST data-url  <- { revision, rows:[{id|null, values, copies, isActive}] } (header RequestVerificationToken from <meta name="dt-csrf">)
                    -> 200 { revision, rowIds:[...] } | 409 { revision, error } | 400/403 { error }
     GET  data-assets-url?q=&category=&take=60 -> [{ key, name, category, url }]
   Everything is built with DOM APIs (createElement, textContent, setAttribute): cell values never reach HTML parsing. No inline styles or scripts. */
(function () {
  'use strict';

  var doc = document;
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var CHUNK = 100;           // rows drawn at first
  var MORE = 200;            // rows added by "Weitere Zeilen anzeigen"
  var NUMBER_RE = /^[+-]?[€$£¥]?[\d.,\s'  ]*\d[\d.,\s'  ]*[€$£¥%]?$/;
  var counter = 0;
  var grids = [];

  // ================================================================================================ small DOM helpers

  function el(tag, cls, text) {
    var e = doc.createElement(tag);
    if (cls) { e.className = cls; }
    if (text !== undefined && text !== null) { e.textContent = text; }
    return e;
  }

  function icon(name, cls) {
    var svg = doc.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', cls ? 'mat-icon ' + cls : 'mat-icon');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    var use = doc.createElementNS(SVG_NS, 'use');
    use.setAttribute('href', '#mat-i-' + name);
    svg.appendChild(use);
    return svg;
  }

  function button(label, iconName, cls, action) {
    var b = el('button', 'mat-btn ' + (cls || 'mat-btn--secondary'));
    b.type = 'button';
    if (iconName) { b.appendChild(icon(iconName)); }
    if (label) { b.appendChild(el('span', null, label)); }
    if (action) { b.setAttribute('data-act', action); }
    return b;
  }

  function iconButton(label, iconName, action) {
    var b = el('button', 'mat-btn mat-btn--ghost mat-btn--icon mat-btn--sm');
    b.type = 'button';
    b.setAttribute('aria-label', label);
    b.setAttribute('data-tip', label);
    b.setAttribute('data-act', action);
    b.tabIndex = -1;
    b.appendChild(icon(iconName));
    return b;
  }

  function toast(message, tone) {
    if (window.MatUi && window.MatUi.toast) { window.MatUi.toast(message, { tone: tone || 'danger' }); }
  }

  function csrf() {
    var m = doc.querySelector('meta[name="dt-csrf"]');
    return m ? m.getAttribute('content') : '';
  }

  function json(response) { return response.text().then(function (t) { try { return t ? JSON.parse(t) : {}; } catch (e) { return {}; } }); }

  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

  function clock() { return new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }); }

  function clampCopies(value) {
    var n = parseInt(value, 10);
    if (!isFinite(n)) { return 1; }
    return Math.max(1, Math.min(999, n));
  }

  function confirmDialog(message, okText) {
    if (window.MatUi && window.MatUi.confirm) {
      return window.MatUi.confirm(message, { danger: true, ok: okText || 'Löschen', cancel: 'Abbrechen' });
    }
    return Promise.resolve(false);
  }

  // ================================================================================================ pasted blocks (Excel, Sheets)

  /** Parses tab separated text: rows by line breaks, cells by tabs; a cell that starts with a quote may hold tabs, quotes ("") and line breaks. */
  function parseTsv(text) {
    var rows = [];
    var row = [];
    var i = 0;
    var n = text.length;
    var start = true;
    var field = '';
    function endField() { row.push(field); field = ''; start = true; }
    function endRow() { endField(); rows.push(row); row = []; }
    while (i < n) {
      var c = text.charAt(i);
      if (start && c === '"') {
        var j = i + 1;
        var quoted = '';
        var closed = false;
        while (j < n) {
          var d = text.charAt(j);
          if (d === '"') {
            if (text.charAt(j + 1) === '"') { quoted += '"'; j += 2; continue; }
            closed = true;
            j++;
            break;
          }
          quoted += d;
          j++;
        }
        var after = text.charAt(j);
        if (closed && (j >= n || after === '\t' || after === '\n' || after === '\r')) {
          field = quoted;
          start = false;
          i = j;
          continue;
        }
        // Not a clean quoted cell: take the text as it is.
        field = '"';
        start = false;
        i++;
        continue;
      }
      if (c === '\t') { endField(); i++; continue; }
      if (c === '\r') { endRow(); i += text.charAt(i + 1) === '\n' ? 2 : 1; continue; }
      if (c === '\n') { endRow(); i++; continue; }
      field += c;
      start = false;
      i++;
    }
    if (field !== '' || row.length > 0) { endRow(); }
    return rows;
  }

  // ================================================================================================ the picker for image cells

  /** Image cells and the single print choose their picture in the media browser of the editor (js/dt-media.js, one code base for every place that chooses an image). */
  function openPicker(config, column, current, onPick) {
    if (!window.DtMedia || typeof window.DtMedia.pick !== 'function') {
      if (window.MatUi && window.MatUi.toast) { window.MatUi.toast('Die Medienauswahl ist nicht verfügbar. Tippe den Schlüssel ein.', { tone: 'danger' }); }
      return;
    }
    window.DtMedia.pick({ title: 'Bild wählen: ' + (column.label || 'Bild'), category: column.category || '', current: current || '', allowNone: true, noneLabel: 'Kein Bild' }, function (key) { onPick(key || ''); });
  }

  // ================================================================================================ one grid

  function init(root) {
    if (root._dtGrid) { return root._dtGrid; }
    var uid = 'dt-grid-' + (++counter);
    var cfg = {
      url: root.getAttribute('data-url') || '',
      assetsUrl: root.getAttribute('data-assets-url') || '/api/assets',
      mediaUrl: root.getAttribute('data-media-url') || '/media/',
    };

    var S = {
      name: '', revision: 0, canEdit: false, columns: [], rows: [], byCid: new Map(), view: [], assets: {},
      filter: '', shown: CHUNK, dirty: false, saving: false, savedAt: '', nextCid: 1, last: null, current: null, loading: true,
    };
    var ui = {};

    // ---------------------------------------------------------------------------------------- model

    function newRow(values, copies, isActive, id) {
      var row = { cid: S.nextCid++, id: id === undefined ? null : id, values: values || {}, copies: copies || 1, isActive: isActive !== false, selected: false, keep: false, n: 0 };
      S.byCid.set(row.cid, row);
      return row;
    }

    function cellKeys() { return S.columns.map(function (c) { return c.key; }).concat(['$copies']); }

    function rowText(row) {
      var parts = [];
      S.columns.forEach(function (c) { parts.push(row.values[c.key] || ''); });
      return parts.join('\u0001').toLowerCase();
    }

    function refilter() {
      var text = S.filter.trim().toLowerCase();
      S.rows.forEach(function (r, i) { r.n = i + 1; });
      S.view = text === '' ? S.rows.slice() : S.rows.filter(function (r) { return r.keep || rowText(r).indexOf(text) >= 0; });
    }

    function markDirty() {
      if (!S.dirty) { S.dirty = true; }
      updateBar();
    }

    function selectedRows() { return S.rows.filter(function (r) { return r.selected; }); }

    function targetRows() {
      var selected = selectedRows();
      if (selected.length > 0) { return selected; }
      var current = S.current !== null ? S.byCid.get(S.current.cid) : null;
      return current ? [current] : [];
    }

    function announce(text) {
      ui.live.textContent = '';
      setTimeout(function () { ui.live.textContent = text; }, 30);
    }

    function isNumeric(column) { return column.type === 'number' || column.type === 'price'; }

    // ---------------------------------------------------------------------------------------- skeleton

    function build() {
      root.textContent = '';
      root.classList.add('dt-grid');
      root.setAttribute('data-ready', 'false');

      ui.alerts = el('div', 'dt-grid__alerts');
      root.appendChild(ui.alerts);

      // The bar above: filter, counts, state.
      ui.bar = el('div', 'dt-grid__bar');
      var searchWrap = el('div', 'mat-input-icon dt-grid__filter');
      searchWrap.appendChild(icon('search'));
      ui.filter = el('input', 'mat-input');
      ui.filter.type = 'search';
      ui.filter.id = uid + '-filter';
      ui.filter.placeholder = 'Zeilen filtern ...';
      ui.filter.setAttribute('aria-label', 'Zeilen filtern');
      ui.filter.autocomplete = 'off';
      searchWrap.appendChild(ui.filter);
      ui.bar.appendChild(searchWrap);
      ui.bar.appendChild(el('span', 'dt-grid__spacer'));
      ui.info = el('span', 'dt-grid__info');
      ui.state = el('span', 'dt-grid__state');
      ui.bar.appendChild(ui.info);
      ui.bar.appendChild(ui.state);
      root.appendChild(ui.bar);

      // The row tools.
      ui.tools = el('div', 'dt-grid__tools');
      ui.tools.setAttribute('role', 'toolbar');
      ui.tools.setAttribute('aria-label', 'Zeilen bearbeiten');
      ui.add = button('Zeile hinzufügen', 'plus', 'mat-btn--secondary mat-btn--sm', 'add');
      ui.dup = button('Duplizieren', 'copy', 'mat-btn--ghost mat-btn--sm', 'dup');
      ui.up = button('Nach oben', 'arrow-up', 'mat-btn--ghost mat-btn--sm', 'up');
      ui.down = button('Nach unten', 'arrow-down', 'mat-btn--ghost mat-btn--sm', 'down');
      ui.on = button('Aktiv', 'eye', 'mat-btn--ghost mat-btn--sm', 'on');
      ui.off = button('Inaktiv', 'eye-off', 'mat-btn--ghost mat-btn--sm', 'off');
      ui.on.title = 'Gewählte Zeilen (ohne Auswahl alle angezeigten) aktiv setzen: sie werden ausgegeben.';
      ui.off.title = 'Gewählte Zeilen (ohne Auswahl alle angezeigten) inaktiv setzen: sie werden nicht ausgegeben.';
      [ui.add, ui.dup, ui.up, ui.down, ui.on, ui.off].forEach(function (b) { ui.tools.appendChild(b); });
      if (root.getAttribute('data-ai') === 'true') {
        ui.aiFill = button('Mit KI füllen', 'sparkles', 'mat-btn--ghost mat-btn--sm', 'ai-fill');
        ui.aiImport = button('Mit KI übernehmen', 'sparkles', 'mat-btn--ghost mat-btn--sm', 'ai-import');
        ui.aiFill.title = 'Eine Spalte der gewählten Zeilen von der KI füllen lassen (du siehst vorher eine Vorschau).';
        ui.aiImport.title = 'Aus Text oder einer Tabelle neue Zeilen von der KI machen lassen (du siehst vorher eine Vorschau).';
        ui.tools.appendChild(ui.aiFill);
        ui.tools.appendChild(ui.aiImport);
      }
      root.appendChild(ui.tools);

      // The table.
      ui.scroll = el('div', 'dt-grid__scroll');
      ui.scroll.tabIndex = -1;
      ui.table = el('table', 'dt-grid__table');
      ui.table.id = uid + '-table';
      ui.caption = el('caption', 'mat-sr-only', 'Zeilen der Datenliste');
      ui.table.appendChild(ui.caption);
      ui.thead = el('thead');
      ui.tbody = el('tbody');
      ui.table.appendChild(ui.thead);
      ui.table.appendChild(ui.tbody);
      ui.scroll.appendChild(ui.table);
      root.appendChild(ui.scroll);

      // The actions below, left: positive to negative, Delete apart.
      ui.foot = el('div', 'mat-btn-row dt-grid__foot');
      ui.save = button('Speichern', 'save', 'mat-btn--primary', 'save');
      ui.discard = button('Verwerfen', 'refresh', 'mat-btn--secondary', 'discard');
      ui.discard.title = 'Ungespeicherte Änderungen verwerfen und die Zeilen neu laden.';
      ui.del = button('Zeilen löschen', 'trash', 'mat-btn--danger', 'del');
      ui.foot.appendChild(ui.save);
      ui.foot.appendChild(ui.discard);
      ui.foot.appendChild(el('span', 'mat-btn-row__spacer'));
      ui.foot.appendChild(ui.del);
      root.appendChild(ui.foot);

      ui.note = el('p', 'mat-hint dt-grid__note');
      root.appendChild(ui.note);

      ui.live = el('div', 'mat-sr-only');
      ui.live.setAttribute('aria-live', 'polite');
      ui.live.setAttribute('role', 'status');
      root.appendChild(ui.live);

      bind();
    }

    function buildHead() {
      ui.thead.textContent = '';
      var tr = el('tr');
      if (S.canEdit) {
        var th = el('th', 'dt-grid__th dt-grid__th--select');
        th.scope = 'col';
        ui.all = el('input');
        ui.all.type = 'checkbox';
        ui.all.setAttribute('aria-label', 'Alle angezeigten Zeilen auswählen');
        th.appendChild(ui.all);
        tr.appendChild(th);
      }
      var num = el('th', 'dt-grid__th dt-grid__th--num', '#');
      num.scope = 'col';
      tr.appendChild(num);
      S.columns.forEach(function (c) {
        var th = el('th', 'dt-grid__th dt-grid__th--' + c.type);
        th.scope = 'col';
        th.title = '{{' + c.key + '}} (' + typeLabel(c) + ')';
        var label = el('span', 'dt-grid__label');
        if (c.type === 'image') { label.appendChild(icon('image')); }
        label.appendChild(el('span', null, c.label || c.key));
        th.appendChild(label);
        th.appendChild(el('small', 'dt-grid__key', '{{' + c.key + '}}'));
        tr.appendChild(th);
      });
      var copies = el('th', 'dt-grid__th dt-grid__th--copies', 'Kopien');
      copies.scope = 'col';
      var active = el('th', 'dt-grid__th dt-grid__th--active', 'Aktiv');
      active.scope = 'col';
      tr.appendChild(copies);
      tr.appendChild(active);
      if (S.canEdit) {
        var tools = el('th', 'dt-grid__th dt-grid__th--tools');
        tools.scope = 'col';
        tools.appendChild(el('span', 'mat-sr-only', 'Zeilenwerkzeuge'));
        tr.appendChild(tools);
      }
      ui.thead.appendChild(tr);
    }

    function typeLabel(c) {
      return c.type === 'price' ? 'Preis' : c.type === 'number' ? 'Zahl' : c.type === 'image' ? 'Bild' : c.type === 'multiline' ? 'Mehrzeiliger Text' : 'Text';
    }

    function columnCount() { return S.columns.length + 3 + (S.canEdit ? 2 : 0); }

    // ---------------------------------------------------------------------------------------- rows in the DOM

    function fillImage(btn, value, column, row) {
      btn.textContent = '';
      btn.classList.remove('is-empty', 'is-unknown');
      var name = value ? value : 'Medium wählen';
      btn.setAttribute('aria-label', 'Zeile ' + row.n + ', ' + (column.label || column.key) + ': ' + (value ? value + ', ändern' : 'Medium wählen'));
      if (!value) {
        btn.classList.add('is-empty');
        btn.appendChild(icon('image'));
        btn.appendChild(el('span', 'dt-grid__imgname', name));
        return;
      }
      var frame = el('span', 'dt-grid__imgframe');
      var img = doc.createElement('img');
      img.alt = '';
      img.loading = 'lazy';
      img.src = S.assets[String(value).trim().toLowerCase()] || (cfg.mediaUrl + encodeURIComponent(value));
      img.addEventListener('error', function () {
        frame.textContent = '';
        frame.appendChild(icon('alert'));
        btn.classList.add('is-unknown');
        btn.title = 'Unbekanntes Medium: ' + value;
      });
      frame.appendChild(img);
      btn.appendChild(frame);
      btn.appendChild(el('span', 'dt-grid__imgname', value));
      btn.title = value;
    }

    function makeCell(row, column) {
      var td = el('td', 'dt-grid__td dt-grid__td--' + column.type);
      td.setAttribute('data-label', column.label || column.key);
      var value = row.values[column.key] || '';
      var label = 'Zeile ' + row.n + ', ' + (column.label || column.key);
      var control;
      if (column.type === 'image') {
        control = el('button', 'dt-cell dt-grid__img');
        control.type = 'button';
        control.setAttribute('data-act', 'pick');
        if (!S.canEdit) { control.setAttribute('aria-disabled', 'true'); }
        fillImage(control, value.trim(), column, row);
      } else if (column.type === 'multiline') {
        control = el('textarea', 'mat-textarea dt-cell');
        control.rows = Math.max(1, Math.min(4, value.split('\n').length));
        control.value = value;
        control.maxLength = 2000;
        control.setAttribute('aria-label', label);
        control.readOnly = !S.canEdit;
      } else {
        control = el('input', 'mat-input dt-cell' + (isNumeric(column) ? ' dt-grid__num' : ''));
        control.type = 'text';
        control.value = value;
        control.maxLength = 2000;
        control.autocomplete = 'off';
        control.spellcheck = false;
        control.setAttribute('aria-label', label);
        control.readOnly = !S.canEdit;
        if (isNumeric(column)) {
          control.inputMode = 'decimal';
          if (value.trim() !== '' && !NUMBER_RE.test(value.trim())) { control.classList.add('dt-is-warn'); }
        }
      }
      control.setAttribute('data-cell', column.key);
      td.appendChild(control);
      return td;
    }

    function makeRow(row) {
      var tr = el('tr', 'dt-grid__row' + (row.selected ? ' is-selected' : '') + (row.isActive ? '' : ' is-inactive'));
      tr.setAttribute('data-cid', String(row.cid));
      if (S.canEdit) {
        var s = el('td', 'dt-grid__td dt-grid__td--select');
        var box = el('input');
        box.type = 'checkbox';
        box.checked = row.selected;
        box.setAttribute('data-role', 'select');
        box.setAttribute('aria-label', 'Zeile ' + row.n + ' auswählen');
        s.appendChild(box);
        tr.appendChild(s);
      }
      tr.appendChild(el('td', 'dt-grid__td dt-grid__td--num', String(row.n)));
      S.columns.forEach(function (c) { tr.appendChild(makeCell(row, c)); });

      var copies = el('td', 'dt-grid__td dt-grid__td--copies');
      copies.setAttribute('data-label', 'Kopien');
      var cInput = el('input', 'mat-input dt-cell dt-grid__copies');
      cInput.type = 'number';
      cInput.min = '1';
      cInput.max = '999';
      cInput.step = '1';
      cInput.value = String(row.copies);
      cInput.readOnly = !S.canEdit;
      cInput.setAttribute('aria-label', 'Zeile ' + row.n + ', Kopien');
      cInput.setAttribute('data-cell', '$copies');
      copies.appendChild(cInput);
      tr.appendChild(copies);

      var active = el('td', 'dt-grid__td dt-grid__td--active');
      active.setAttribute('data-label', 'Aktiv');
      var a = el('input');
      a.type = 'checkbox';
      a.checked = row.isActive;
      a.disabled = !S.canEdit;
      a.setAttribute('data-role', 'active');
      a.setAttribute('aria-label', 'Zeile ' + row.n + ' aktiv');
      active.appendChild(a);
      tr.appendChild(active);

      if (S.canEdit) {
        var t = el('td', 'dt-grid__td dt-grid__td--tools');
        var wrap = el('div', 'dt-grid__rowtools');
        wrap.appendChild(iconButton('Zeile nach oben', 'arrow-up', 'row-up'));
        wrap.appendChild(iconButton('Zeile nach unten', 'arrow-down', 'row-down'));
        wrap.appendChild(iconButton('Zeile duplizieren', 'copy', 'row-dup'));
        wrap.appendChild(iconButton('Zeile löschen', 'trash', 'row-del'));
        t.appendChild(wrap);
        tr.appendChild(t);
      }
      return tr;
    }

    function render() {
      if (ui.more) { ui.more.disconnect(); ui.more = null; }
      var frag = doc.createDocumentFragment();
      var list = S.view.slice(0, S.shown);
      list.forEach(function (row) { frag.appendChild(makeRow(row)); });

      if (S.view.length === 0) {
        var empty = el('tr', 'dt-grid__empty');
        var td = el('td');
        td.colSpan = columnCount();
        var box = el('div', 'dt-grid__emptybox');
        box.appendChild(icon('list'));
        var filtered = S.rows.length > 0;
        box.appendChild(el('strong', null, filtered ? 'Keine Zeile passt zum Filter.' : 'Noch keine Zeilen.'));
        if (!filtered && S.canEdit) { box.appendChild(el('span', null, 'Füge die erste Zeile hinzu oder importiere eine CSV-Datei.')); }
        td.appendChild(box);
        empty.appendChild(td);
        frag.appendChild(empty);
      } else if (S.view.length > list.length) {
        var more = el('tr', 'dt-grid__morerow');
        var mtd = el('td');
        mtd.colSpan = columnCount();
        var mb = button('Weitere Zeilen anzeigen (' + Fmt(S.view.length - list.length) + ')', 'chevron-down', 'mat-btn--secondary mat-btn--sm', 'more');
        mb.classList.add('dt-grid__morebtn');
        mtd.appendChild(mb);
        more.appendChild(mtd);
        frag.appendChild(more);
        if ('IntersectionObserver' in window) {
          ui.more = new IntersectionObserver(function (entries) {
            if (entries.some(function (e) { return e.isIntersecting; })) { showMore(); }
          }, { root: ui.scroll, rootMargin: '0px 0px 200px 0px' });
          ui.more.observe(more);
        }
      }
      ui.tbody.textContent = '';
      ui.tbody.appendChild(frag);
      updateBar();
    }

    function Fmt(n) { return n.toLocaleString('de-DE'); }

    function showMore() {
      var saved = ui.tbody.contains(doc.activeElement) ? S.current : null;
      S.shown += MORE;
      render();
      restoreFocus(saved);
    }

    // ---------------------------------------------------------------------------------------- the bar and the buttons

    function updateBar() {
      var total = S.rows.length;
      var shown = S.view.length;
      var selected = selectedRows().length;
      ui.info.textContent = (shown === total ? plural(total, 'Zeile', 'Zeilen') : Fmt(shown) + ' von ' + plural(total, 'Zeile', 'Zeilen')) + (selected > 0 ? ' · ' + Fmt(selected) + ' ausgewählt' : '');

      ui.state.textContent = '';
      if (S.dirty) {
        ui.state.appendChild(el('span', 'mat-pill mat-pill--warn', 'Ungespeicherte Änderungen'));
      } else if (S.savedAt) {
        ui.state.appendChild(el('span', 'mat-muted', 'Gespeichert um ' + S.savedAt));
      }

      var editable = S.canEdit;
      ui.tools.hidden = !editable;
      ui.foot.hidden = !editable;
      ui.note.textContent = editable ? '' : 'Du darfst diese Liste nur ansehen.';
      ui.note.hidden = editable;
      ui.save.disabled = !S.dirty || S.saving;
      ui.discard.disabled = !S.dirty || S.saving;
      ui.del.disabled = S.saving;
      var labelNode = ui.del.querySelector('span');
      if (labelNode) { labelNode.textContent = selected > 1 ? 'Zeilen löschen (' + selected + ')' : selected === 1 ? 'Zeile löschen' : 'Zeilen löschen'; }
      if (ui.all) {
        var visibleSelected = S.view.filter(function (r) { return r.selected; }).length;
        ui.all.checked = S.view.length > 0 && visibleSelected === S.view.length;
        ui.all.indeterminate = visibleSelected > 0 && visibleSelected < S.view.length;
      }
    }

    // ---------------------------------------------------------------------------------------- focus

    function cellOf(cid, key) {
      return ui.tbody.querySelector('tr[data-cid="' + cid + '"] [data-cell="' + key + '"]');
    }

    function focusCell(cid, key, select) {
      var index = S.view.findIndex(function (r) { return r.cid === cid; });
      if (index < 0) { return false; }
      if (index >= S.shown) { S.shown = index + MORE; render(); }
      var target = cellOf(cid, key);
      if (!target) { return false; }
      target.focus();
      if (select && target.select && target.tagName === 'INPUT') { try { target.select(); } catch (e) { /* not selectable */ } }
      return true;
    }

    function addRow(focusKey) {
      var row = newRow({}, 1, true, null);
      row.keep = true;
      S.rows.push(row);
      refilter();
      S.shown = Math.max(S.shown, S.view.length);
      render();
      markDirty();
      var key = focusKey || (S.columns[0] ? S.columns[0].key : '$copies');
      focusCell(row.cid, key, true);
      announce('Zeile ' + row.n + ' hinzugefügt.');
      return row;
    }

    function stepRow(cid, key, delta, allowAdd) {
      var index = S.view.findIndex(function (r) { return r.cid === cid; });
      if (index < 0) { return; }
      var next = index + delta;
      if (next < 0) { return; }
      if (next >= S.view.length) {
        if (delta > 0 && allowAdd && S.canEdit) { addRow(key); }
        return;
      }
      focusCell(S.view[next].cid, key, true);
    }

    // ---------------------------------------------------------------------------------------- structural changes

    function restoreFocus(saved) {
      if (saved && !focusCell(saved.cid, saved.key, false)) { /* the row is gone */ }
    }

    function moveRows(direction, targets) {
      if (!S.canEdit || targets.length === 0) { return; }
      var saved = S.current;
      var set = new Set(targets.map(function (r) { return r.cid; }));
      var rows = S.rows;
      var moved = false;
      if (direction < 0) {
        for (var i = 1; i < rows.length; i++) {
          if (set.has(rows[i].cid) && !set.has(rows[i - 1].cid)) { var t = rows[i]; rows[i] = rows[i - 1]; rows[i - 1] = t; moved = true; }
        }
      } else {
        for (var j = rows.length - 2; j >= 0; j--) {
          if (set.has(rows[j].cid) && !set.has(rows[j + 1].cid)) { var u = rows[j]; rows[j] = rows[j + 1]; rows[j + 1] = u; moved = true; }
        }
      }
      if (!moved) { return; }
      refilter();
      render();
      markDirty();
      restoreFocus(saved);
      announce(plural(targets.length, 'Zeile', 'Zeilen') + (direction < 0 ? ' nach oben' : ' nach unten') + ' verschoben.');
    }

    function duplicateRows(targets) {
      if (!S.canEdit || targets.length === 0) { return; }
      var set = new Set(targets.map(function (r) { return r.cid; }));
      var copies = [];
      var out = [];
      S.rows.forEach(function (r) {
        out.push(r);
        if (set.has(r.cid)) {
          var values = {};
          Object.keys(r.values).forEach(function (k) { values[k] = r.values[k]; });
          var copy = newRow(values, r.copies, r.isActive, null);
          copy.keep = true;
          copies.push(copy);
          out.push(copy);
        }
      });
      S.rows = out;
      refilter();
      render();
      markDirty();
      if (copies.length > 0) { focusCell(copies[0].cid, S.columns[0] ? S.columns[0].key : '$copies', true); }
      announce(plural(copies.length, 'Zeile', 'Zeilen') + ' dupliziert.');
    }

    function deleteRows(targets) {
      if (!S.canEdit) { return; }
      if (targets.length === 0) { toast('Wähle zuerst Zeilen aus (Häkchen links) oder klicke in eine Zeile.', 'warning'); return; }
      var message = targets.length === 1 ? 'Diese Zeile löschen? Die Änderung gilt erst nach dem Speichern.' : plural(targets.length, 'Zeile', 'Zeilen') + ' löschen? Die Änderung gilt erst nach dem Speichern.';
      confirmDialog(message, 'Löschen').then(function (ok) {
        if (!ok) { return; }
        var set = new Set(targets.map(function (r) { return r.cid; }));
        var firstIndex = S.view.findIndex(function (r) { return set.has(r.cid); });
        var neighbour = S.view.find(function (r, i) { return i > firstIndex && !set.has(r.cid); }) || S.view.slice(0, Math.max(0, firstIndex)).reverse().find(function (r) { return !set.has(r.cid); });
        S.rows = S.rows.filter(function (r) { if (set.has(r.cid)) { S.byCid.delete(r.cid); return false; } return true; });
        S.current = null;
        refilter();
        render();
        markDirty();
        if (neighbour) { focusCell(neighbour.cid, S.columns[0] ? S.columns[0].key : '$copies', false); }
        announce(plural(targets.length, 'Zeile', 'Zeilen') + ' gelöscht.');
      });
    }

    function setActive(value) {
      if (!S.canEdit) { return; }
      var selected = selectedRows();
      var targets = selected.length > 0 ? selected : S.view;
      if (targets.length === 0) { return; }
      targets.forEach(function (r) { r.isActive = value; });
      render();
      markDirty();
      announce(plural(targets.length, 'Zeile', 'Zeilen') + (value ? ' aktiv gesetzt.' : ' inaktiv gesetzt.'));
    }

    // ---------------------------------------------------------------------------------------- paste

    function pasteBlock(cid, key, matrix) {
      var viewIndex = S.view.findIndex(function (r) { return r.cid === cid; });
      var columnIndex = S.columns.findIndex(function (c) { return c.key === key; });
      if (viewIndex < 0 || columnIndex < 0) { return; }
      var targets = S.view.slice(viewIndex);
      var added = 0;
      matrix.forEach(function (cells, i) {
        var row = targets[i];
        if (!row) {
          row = newRow({}, 1, true, null);
          row.keep = true;
          S.rows.push(row);
          targets.push(row);
          added++;
        }
        cells.forEach(function (text, j) {
          var column = S.columns[columnIndex + j];
          if (!column) { return; }
          row.values[column.key] = column.type === 'image' ? text.trim() : text;
        });
      });
      refilter();
      S.shown = Math.max(S.shown, viewIndex + matrix.length + 1);
      render();
      markDirty();
      focusCell(cid, key, false);
      announce('Eingefügt: ' + plural(matrix.length, 'Zeile', 'Zeilen') + (added ? ', davon ' + added + ' neu' : '') + '.');
    }

    // ---------------------------------------------------------------------------------------- load and save

    function showAlert(tone, title, text, actions) {
      ui.alerts.textContent = '';
      var box = el('div', 'mat-alert mat-alert--' + tone);
      box.setAttribute('role', 'alert');
      box.appendChild(icon(tone === 'danger' ? 'x-circle' : 'alert'));
      var body = el('div', 'mat-alert__body');
      body.appendChild(el('strong', null, title));
      if (text) { body.appendChild(doc.createTextNode(' ' + text)); }
      box.appendChild(body);
      if (actions && actions.length) {
        var wrap = el('div', 'mat-alert__actions');
        actions.forEach(function (a) {
          var b = button(a.label, null, a.cls || 'mat-btn--secondary mat-btn--sm');
          b.addEventListener('click', function () { a.run(); });
          wrap.appendChild(b);
        });
        box.appendChild(wrap);
      }
      ui.alerts.appendChild(box);
    }

    function clearAlert() { ui.alerts.textContent = ''; }

    function load() {
      S.loading = true;
      clearAlert();
      ui.tbody.textContent = '';
      var loading = el('tr', 'dt-grid__empty');
      var td = el('td', 'dt-grid__loading', 'Lade Zeilen ...');
      td.colSpan = Math.max(1, columnCount());
      loading.appendChild(td);
      ui.tbody.appendChild(loading);
      root.setAttribute('aria-busy', 'true');
      var t0 = performance.now();
      return fetch(cfg.url, { credentials: 'same-origin', headers: { Accept: 'application/json' } })
        .then(function (r) { if (!r.ok) { throw new Error('HTTP ' + r.status); } return r.json(); })
        .then(function (data) {
          S.name = data.name || '';
          S.revision = data.revision || 0;
          S.canEdit = data.canEdit === true;
          S.assets = data.assets && typeof data.assets === 'object' ? data.assets : {};
          root.classList.toggle('is-readonly', !S.canEdit);
          S.columns = (data.columns || []).map(function (c) {
            return { key: String(c.key), label: c.label || String(c.key), type: ['text', 'multiline', 'number', 'price', 'image'].indexOf(c.type) >= 0 ? c.type : 'text', decimals: c.decimals === undefined ? null : c.decimals, category: c.category || null };
          });
          S.nextCid = 1;
          S.byCid = new Map();
          S.rows = (data.rows || []).map(function (r) {
            var values = {};
            S.columns.forEach(function (c) { var v = r.values ? r.values[c.key] : ''; values[c.key] = v === undefined || v === null ? '' : String(v); });
            return newRow(values, clampCopies(r.copies), r.isActive !== false, r.id);
          });
          S.dirty = false;
          S.savedAt = '';
          S.filter = '';
          ui.filter.value = '';
          S.shown = CHUNK;
          S.current = null;
          S.last = null;
          S.loading = false;
          buildHead();
          refilter();
          render();
          root.setAttribute('aria-busy', 'false');
          root.setAttribute('data-ready', 'true');
          root.setAttribute('data-load-ms', String(Math.round(performance.now() - t0)));
        })
        .catch(function (e) {
          S.loading = false;
          root.setAttribute('aria-busy', 'false');
          ui.tbody.textContent = '';
          showAlert('danger', 'Die Zeilen konnten nicht geladen werden.', navigator.onLine === false ? 'Es gibt keine Verbindung.' : (e && e.message ? '(' + e.message + ')' : ''), [{ label: 'Erneut versuchen', run: load }]);
        });
    }

    function payload(revision) {
      return {
        revision: revision,
        rows: S.rows.map(function (r) {
          var values = {};
          S.columns.forEach(function (c) { values[c.key] = r.values[c.key] || ''; });
          return { id: r.id, values: values, copies: clampCopies(r.copies), isActive: r.isActive };
        }),
      };
    }

    function save(revision) {
      if (!S.canEdit || S.saving) { return Promise.resolve(); }
      if (!S.dirty && revision === undefined) { toast('Es gibt keine Änderungen zu speichern.', 'info'); return Promise.resolve(); }
      S.saving = true;
      clearAlert();
      updateBar();
      ui.save.classList.add('is-busy');
      return fetch(cfg.url, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', RequestVerificationToken: csrf() },
        body: JSON.stringify(payload(revision === undefined ? S.revision : revision)),
      }).then(function (r) {
        return json(r).then(function (body) { return { status: r.status, ok: r.ok, body: body }; });
      }).then(function (res) {
        S.saving = false;
        ui.save.classList.remove('is-busy');
        if (res.ok) {
          S.revision = res.body.revision;
          var ids = res.body.rowIds || [];
          S.rows.forEach(function (r, i) { if (ids[i] !== undefined) { r.id = ids[i]; } });
          S.dirty = false;
          S.savedAt = clock();
          updateBar();
          toast('Die Zeilen sind gespeichert.', 'success');
          announce('Gespeichert.');
          return;
        }
        updateBar();
        if (res.status === 409) {
          var theirs = res.body.revision;
          showAlert('warning', 'Jemand anderes hat diese Liste inzwischen geändert.', 'Deine Änderungen sind noch nicht gespeichert.', [
            { label: 'Neu laden', run: function () { load(); } },
            { label: 'Meine Änderungen trotzdem speichern', run: function () { save(theirs); } },
          ]);
          return;
        }
        var message = res.body.error || (res.status === 403 ? 'Dafür fehlt dir die Berechtigung.' : 'Das Speichern ist fehlgeschlagen (HTTP ' + res.status + ').');
        showAlert('danger', 'Nicht gespeichert.', message);
        toast(message, 'danger');
      }).catch(function () {
        S.saving = false;
        ui.save.classList.remove('is-busy');
        updateBar();
        showAlert('warning', 'Keine Verbindung: nichts gespeichert.', 'Deine Änderungen bleiben auf der Seite. Speichere noch einmal, sobald die Verbindung zurück ist.');
        toast('Keine Verbindung: nichts gespeichert. Deine Änderungen bleiben auf der Seite.', 'warning');
      });
    }

    function discard() {
      if (!S.dirty) { load(); return; }
      confirmDialog('Alle ungespeicherten Änderungen verwerfen und neu laden?', 'Verwerfen').then(function (ok) { if (ok) { load(); } });
    }

    // ---------------------------------------------------------------------------------------- events

    function rowOf(target) {
      var tr = target.closest ? target.closest('tr[data-cid]') : null;
      return tr ? S.byCid.get(parseInt(tr.getAttribute('data-cid'), 10)) : null;
    }

    function columnByKey(key) { return S.columns.find(function (c) { return c.key === key; }); }

    // ---------------------------------------------------------------------------------------- the AI actions (js/ai.js)

    function aiContext() {
      var listId = parseInt(root.getAttribute('data-list-id') || '', 10);
      return {
        listId: listId,
        blocked: root.getAttribute('data-ai-blocked') || null,
        columns: S.columns.map(function (c) { return { key: c.key, label: c.label, type: c.type }; }),
        onApplied: function () { load(); },
        onUndone: function () { load(); },
      };
    }

    function aiReady() {
      if (!window.DtAi) { toast('Die KI-Funktionen sind nicht geladen. Lade die Seite neu.', 'warning'); return false; }
      if (S.dirty) { toast('Speichere zuerst deine Änderungen im Raster: Die KI arbeitet mit den gespeicherten Zeilen.', 'warning'); return false; }
      return true;
    }

    function aiFill() {
      if (!aiReady()) { return; }
      var ctx = aiContext();
      var selected = selectedRows();
      var saved = selected.filter(function (r) { return r.id !== null; });
      if (!ctx.blocked) {
        if (saved.length === 0) { toast('Wähle zuerst Zeilen aus (Häkchen links), die die KI füllen soll.', 'warning'); return; }
        if (S.columns.length === 0) { toast('Die Liste hat noch keine Spalten.', 'warning'); return; }
      }
      ctx.rowIds = saved.map(function (r) { return r.id; });
      window.DtAi.openFill(ctx);
    }

    function aiImport() {
      if (!aiReady()) { return; }
      window.DtAi.openImport(aiContext());
    }

    function bind() {
      var filterTimer = 0;
      ui.filter.addEventListener('input', function () {
        clearTimeout(filterTimer);
        filterTimer = setTimeout(function () {
          S.filter = ui.filter.value;
          S.rows.forEach(function (r) { r.keep = false; });
          S.shown = CHUNK;
          refilter();
          render();
        }, 120);
      });

      ui.tools.addEventListener('click', toolbarClick);
      ui.foot.addEventListener('click', toolbarClick);

      function toolbarClick(e) {
        var b = e.target.closest ? e.target.closest('[data-act]') : null;
        if (!b || b.disabled) { return; }
        var act = b.getAttribute('data-act');
        if (act === 'add') { addRow(); }
        else if (act === 'dup' || act === 'up' || act === 'down') {
          var targets = targetRows();
          if (targets.length === 0) { toast('Wähle zuerst Zeilen aus (Häkchen links) oder klicke in eine Zeile.', 'warning'); return; }
          if (act === 'dup') { duplicateRows(targets); } else { moveRows(act === 'up' ? -1 : 1, targets); }
        }
        else if (act === 'ai-fill') { aiFill(); }
        else if (act === 'ai-import') { aiImport(); }
        else if (act === 'on') { setActive(true); }
        else if (act === 'off') { setActive(false); }
        else if (act === 'save') { save(); }
        else if (act === 'discard') { discard(); }
        else if (act === 'del') { deleteRows(targetRows()); }
      }

      ui.thead.addEventListener('click', function (e) {
        if (e.target === ui.all) {
          var on = ui.all.checked;
          S.view.forEach(function (r) { r.selected = on; });
          render();
        }
      });

      ui.tbody.addEventListener('click', function (e) {
        var t = e.target;
        if (!t.closest) { return; }
        var row = rowOf(t);
        if (t.getAttribute && t.getAttribute('data-role') === 'select' && row) {
          row.selected = t.checked;
          var index = S.view.indexOf(row);
          if (e.shiftKey && S.last !== null && S.last !== index && S.last < S.view.length) {
            var from = Math.min(S.last, index);
            var to = Math.max(S.last, index);
            for (var i = from; i <= to; i++) { S.view[i].selected = t.checked; }
            ui.tbody.querySelectorAll('tr[data-cid]').forEach(function (tr) {
              var r = S.byCid.get(parseInt(tr.getAttribute('data-cid'), 10));
              var box = tr.querySelector('[data-role="select"]');
              if (r && box) { box.checked = r.selected; }
              if (r) { tr.classList.toggle('is-selected', r.selected); }
            });
          }
          S.last = index;
          if (t.closest('tr')) { t.closest('tr').classList.toggle('is-selected', row.selected); }
          updateBar();
          return;
        }
        var b = t.closest('[data-act]');
        if (!b) { return; }
        var act = b.getAttribute('data-act');
        if (act === 'more') { showMore(); return; }
        if (!row) { return; }
        if (act === 'row-up') { moveRows(-1, [row]); }
        else if (act === 'row-down') { moveRows(1, [row]); }
        else if (act === 'row-dup') { duplicateRows([row]); }
        else if (act === 'row-del') { deleteRows([row]); }
        else if (act === 'pick') {
          if (!S.canEdit) { return; }
          var key = b.getAttribute('data-cell');
          var column = columnByKey(key);
          if (!column) { return; }
          S.current = { cid: row.cid, key: key };
          openPicker(cfg, column, (row.values[key] || '').trim(), function (picked) {
            row.values[key] = picked;
            var cell = cellOf(row.cid, key);
            if (cell) { fillImage(cell, picked, column, row); cell.focus(); }
            markDirty();
            announce(picked ? 'Medium ' + picked + ' gewählt.' : 'Medium entfernt.');
          });
        }
      });

      ui.tbody.addEventListener('input', function (e) {
        var t = e.target;
        var key = t.getAttribute ? t.getAttribute('data-cell') : null;
        if (key === null) { return; }
        var row = rowOf(t);
        if (!row) { return; }
        if (key === '$copies') {
          var n = parseInt(t.value, 10);
          if (isFinite(n)) { row.copies = Math.max(1, Math.min(999, n)); }
        } else {
          row.values[key] = t.value;
          var column = columnByKey(key);
          if (column && isNumeric(column)) {
            var v = t.value.trim();
            t.classList.toggle('dt-is-warn', v !== '' && !NUMBER_RE.test(v));
          }
          if (t.tagName === 'TEXTAREA') { t.rows = Math.max(1, Math.min(4, t.value.split('\n').length)); }
        }
        markDirty();
      });

      ui.tbody.addEventListener('change', function (e) {
        var t = e.target;
        var row = rowOf(t);
        if (!row) { return; }
        if (t.getAttribute('data-cell') === '$copies') {
          row.copies = clampCopies(t.value);
          t.value = String(row.copies);
        } else if (t.getAttribute('data-role') === 'active') {
          row.isActive = t.checked;
          var tr = t.closest('tr');
          if (tr) { tr.classList.toggle('is-inactive', !row.isActive); }
          markDirty();
        }
      });

      ui.tbody.addEventListener('focusin', function (e) {
        var key = e.target.getAttribute ? e.target.getAttribute('data-cell') : null;
        var row = rowOf(e.target);
        if (row) { S.current = { cid: row.cid, key: key || (S.current ? S.current.key : '$copies') }; }
      });

      ui.tbody.addEventListener('paste', function (e) {
        var t = e.target;
        var key = t.getAttribute ? t.getAttribute('data-cell') : null;
        if (!S.canEdit || key === null || key === '$copies') { return; }
        var row = rowOf(t);
        if (!row || !e.clipboardData) { return; }
        var text = e.clipboardData.getData('text/plain');
        if (text.indexOf('\t') < 0 && text.search(/[\r\n]/) < 0) { return; }
        e.preventDefault();
        var matrix = parseTsv(text);
        if (matrix.length > 1 && matrix[matrix.length - 1].length === 1 && matrix[matrix.length - 1][0] === '') { matrix.pop(); }
        if (matrix.length === 0) { return; }
        pasteBlock(row.cid, key, matrix);
      });

      ui.tbody.addEventListener('keydown', function (e) {
        var t = e.target;
        var key = t.getAttribute ? t.getAttribute('data-cell') : null;
        if (key === null || e.isComposing) { return; }
        var row = rowOf(t);
        if (!row) { return; }
        var isArea = t.tagName === 'TEXTAREA';
        var mod = e.ctrlKey || e.metaKey;

        if (S.canEdit && e.altKey && !mod && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
          e.preventDefault();
          var selected = selectedRows();
          moveRows(e.key === 'ArrowUp' ? -1 : 1, selected.length > 0 ? selected : [row]);
          return;
        }
        if (S.canEdit && mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'd') {
          e.preventDefault();
          var sel = selectedRows();
          duplicateRows(sel.length > 0 ? sel : [row]);
          return;
        }
        if (S.canEdit && mod && e.shiftKey && (e.key === 'Delete' || e.key === 'Backspace')) {
          e.preventDefault();
          var del = selectedRows();
          deleteRows(del.length > 0 ? del : [row]);
          return;
        }
        if (e.key === 'Enter' && t.tagName !== 'BUTTON') {
          if (isArea && !mod) { return; }
          e.preventDefault();
          stepRow(row.cid, key, e.shiftKey ? -1 : 1, true);
          return;
        }
        if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && !mod && !e.altKey && !e.shiftKey && !isArea && t.type !== 'number') {
          e.preventDefault();
          stepRow(row.cid, key, e.key === 'ArrowUp' ? -1 : 1, false);
          return;
        }
        if (isArea && mod && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
          e.preventDefault();
          stepRow(row.cid, key, e.key === 'ArrowUp' ? -1 : 1, false);
          return;
        }
        if (S.canEdit && t.tagName === 'BUTTON' && (e.key === 'Delete' || e.key === 'Backspace')) {
          e.preventDefault();
          var column = columnByKey(key);
          if (column && (row.values[key] || '') !== '') {
            row.values[key] = '';
            fillImage(t, '', column, row);
            markDirty();
            announce('Medium entfernt.');
          }
        }
      });

      root.addEventListener('keydown', function (e) {
        if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 's' && S.canEdit) {
          e.preventDefault();
          save();
        }
      });
    }

    build();
    var api = { load: load, save: save, state: S, element: root, isDirty: function () { return S.dirty; } };
    root._dtGrid = api;
    grids.push(api);
    load();
    return api;
  }

  window.addEventListener('beforeunload', function (e) {
    if (grids.some(function (g) { return g.isDirty(); })) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  // The dialog that picks a medium is also used by the single print (outputs.js): config { assetsUrl, mediaUrl }, column { label, category }, the key now, a callback.
  window.DtDataListGrid = { init: init, parseTsv: parseTsv, pickMedia: function (config, column, current, onPick) { openPicker(config, column, current, onPick); } };

  function start() {
    Array.prototype.forEach.call(doc.querySelectorAll('[data-dt-grid]'), function (node) { init(node); });
  }
  if (doc.readyState === 'loading') { doc.addEventListener('DOMContentLoaded', start); } else { start(); }
})();
