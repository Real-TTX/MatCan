/* DesignThix designer, part 3: the properties panel (right). Nothing selected: the page (format, size, unit, DPI, background, locale). One element or several of
   one kind: position and size, text, font, colour, alignment, image source, strip slots, shape, display condition, arranging (align, distribute, order).
   Controls are built with DOM APIs; each one registers a refresher that reads its value from the document (so undo, the canvas and the panel always agree);
   an input that has the focus is not overwritten while the person types. A read-only designer builds the same panel with everything disabled. */
(function () {
  'use strict';

  var D = window.DtDesigner;
  var app;
  var root;
  var refreshers = [];
  var ctx = null;
  var alignToPage = false;
  var DEFAULT_COLOURS = ['#000000', '#ffffff', '#1fb3d6', '#0b3d5c', '#e5484d', '#f5a524', '#2e9d5b', '#6b7280'];
  var LOCALES = [['de-DE', 'Deutsch (Deutschland): 2,99'], ['de-AT', 'Deutsch (Österreich)'], ['de-CH', 'Deutsch (Schweiz)'], ['en-GB', 'Englisch (UK): 2.99'], ['en-US', 'Englisch (USA)'],
    ['fr-FR', 'Französisch'], ['it-IT', 'Italienisch'], ['es-ES', 'Spanisch'], ['nl-NL', 'Niederländisch'], ['pl-PL', 'Polnisch']];
  var openPalette = new Set();

  // ================================================================================================ building blocks

  function section(title, kids, cls) {
    return D.el('section', { class: 'dt-sec' + (cls ? ' ' + cls : '') }, [title ? D.el('h3', { class: 'dt-sec__title', text: title }) : null, D.el('div', { class: 'dt-sec__body' }, kids)]);
  }

  function field(label, control, cls, forId) {
    if (label && control && !forId && !control.id && /^(INPUT|SELECT|TEXTAREA)$/.test(control.tagName)) { control.id = D.uid('dt-c'); }
    return D.el('div', { class: 'dt-f' + (cls ? ' ' + cls : '') }, [label ? D.el('label', { class: 'dt-f__label', for: forId || (control && control.id) || null, text: label }) : null, control]);
  }

  function iconButton(icon, label, onClick, opts) {
    var o = opts || {};
    var b = D.el('button', { type: 'button', class: 'mat-btn mat-btn--ghost mat-btn--icon mat-btn--sm dt-ib' + (o.cls ? ' ' + o.cls : ''), title: label, 'aria-label': label, disabled: o.disabled });
    b.appendChild(D.icon(icon));
    b.addEventListener('click', onClick);
    return b;
  }

  function textButton(icon, label, onClick, opts) {
    var o = opts || {};
    var b = D.el('button', { type: 'button', class: 'mat-btn ' + (o.primary ? 'mat-btn--primary' : 'mat-btn--secondary') + ' mat-btn--sm' + (o.cls ? ' ' + o.cls : ''), title: o.title || null, disabled: o.disabled });
    if (icon) { b.appendChild(D.icon(icon)); }
    b.appendChild(D.el('span', { text: label }));
    b.addEventListener('click', onClick);
    return b;
  }

  function fmtNum(v, digits) {
    if (!D.isNum(v)) { return ''; }
    var r = D.round(v, digits);
    return String(r);
  }

  /** The value of the first selected element through a getter; ctx.first() is null while nothing is selected. */
  function apply(patch, key, mergeMs) {
    app.setProps(ctx.ids, patch, { merge: 'p:' + key + ':' + ctx.ids.join(','), mergeMs: mergeMs || 1200 });
  }

  function numberField(label, o) {
    var id = D.uid('dt-num');
    var input = D.el('input', { type: 'number', class: 'mat-input mat-input--sm dt-num', id: id, step: o.step || 1, min: o.min, max: o.max, inputmode: 'decimal', disabled: ctx.disabled, autocomplete: 'off' });
    var read = function () { var e = ctx.first(); return e ? o.get(e) : null; };
    var show = function () { input.value = fmtNum(read(), o.digits === undefined ? 2 : o.digits); };
    show();
    input.addEventListener('input', function () {
      var v = parseFloat(String(input.value).replace(',', '.'));
      if (!isFinite(v)) { return; }
      if (o.min !== undefined) { v = Math.max(o.min, v); }
      if (o.max !== undefined) { v = Math.min(o.max, v); }
      o.set(v);
    });
    input.addEventListener('blur', show);
    input.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { input.blur(); } });
    refreshers.push(function () { if (document.activeElement !== input) { show(); } });
    var wrap = D.el('div', { class: 'dt-numwrap' }, [input, o.suffix ? D.el('span', { class: 'dt-numwrap__suffix', text: o.suffix }) : null]);
    return field(label, wrap, o.cls, id);
  }

  function selectField(label, options, o) {
    var id = D.uid('dt-sel');
    var select = D.el('select', { class: 'mat-select mat-select--sm', id: id, disabled: ctx.disabled });
    options.forEach(function (opt) { select.appendChild(D.el('option', { value: opt[0], text: opt[1], class: opt[2] || null })); });
    var read = function () { var e = ctx.first(); return e ? String(o.get(e)) : ''; };
    var show = function () {
      var v = read();
      if (!Array.prototype.some.call(select.options, function (opt) { return opt.value === v; }) && v !== '') { select.insertBefore(D.el('option', { value: v, text: v }), select.firstChild); }
      select.value = v;
      if (o.onShow) { o.onShow(select); }
    };
    show();
    select.addEventListener('change', function () { o.set(select.value); if (o.onShow) { o.onShow(select); } });
    refreshers.push(function () { if (document.activeElement !== select) { show(); } });
    return field(label, select, o.cls, id);
  }

  function segmented(label, options, o) {
    var group = D.el('div', { class: 'mat-seg dt-seg', role: 'group', 'aria-label': label || o.aria || null });
    var buttons = options.map(function (opt) {
      var b = D.el('button', { type: 'button', class: 'mat-seg__btn', title: opt.title || opt.label, 'aria-label': opt.title || opt.label, disabled: ctx.disabled, 'data-value': opt.value });
      if (opt.icon) { b.appendChild(D.icon(opt.icon)); } else { b.appendChild(D.el('span', { text: opt.label })); }
      b.addEventListener('click', function () { o.set(opt.value); });
      group.appendChild(b);
      return b;
    });
    var show = function () {
      var e = ctx.first();
      var v = e ? o.get(e) : null;
      buttons.forEach(function (b, i) { b.setAttribute('aria-pressed', String(options[i].value === v)); });
    };
    show();
    refreshers.push(show);
    return field(label, group, o.cls);
  }

  function switchField(label, o) {
    var input = D.el('input', { type: 'checkbox', disabled: ctx.disabled });
    var lab = D.el('label', { class: 'mat-switch dt-switch' }, [input, D.el('span', { class: 'mat-switch__track' }), D.el('span', { text: label })]);
    var show = function () { var e = ctx.first(); input.checked = !!(e && o.get(e)); };
    show();
    input.addEventListener('change', function () { o.set(input.checked); });
    refreshers.push(show);
    return D.el('div', { class: 'dt-f dt-f--switch' + (o.cls ? ' ' + o.cls : '') }, lab);
  }

  function normHex(text) {
    var t = String(text || '').trim();
    if (/^#[0-9a-fA-F]{3}$/.test(t)) { t = '#' + t[1] + t[1] + t[2] + t[2] + t[3] + t[3]; }
    return /^#[0-9a-fA-F]{6}$/.test(t) ? t.toLowerCase() : null;
  }

  /** The colours the design already uses (unique, in order), then a few basic ones. */
  function paletteColours() {
    var seen = new Set();
    var out = [];
    var add = function (c) { var h = c ? normHex(c) : null; if (h && !seen.has(h)) { seen.add(h); out.push(h); } };
    app.doc.elements.forEach(function (e) { add(e.color); add(e.fill); add(e.stroke); });
    add(app.doc.background.color);
    var used = out.slice(0, 10);
    DEFAULT_COLOURS.forEach(function (c) { if (used.indexOf(c) < 0 && used.length < 14) { used.push(c); } });
    return used;
  }

  /**
   * A colour: the native colour input (opens the system picker, keyboard and touch friendly), the hex field, a palette of the design's colours. With allowNone a
   * "keine" switch sets null (fill and stroke of shapes).
   */
  function colourField(label, o) {
    var id = D.uid('dt-col');
    var native = D.el('input', { type: 'color', class: 'dt-colour__native', id: id, 'aria-label': label + ' wählen', disabled: ctx.disabled });
    var hex = D.el('input', { type: 'text', class: 'mat-input mat-input--sm dt-colour__hex', maxlength: 7, spellcheck: 'false', autocomplete: 'off', 'aria-label': label + ' als Hex-Wert', disabled: ctx.disabled });
    var none = o.allowNone ? D.el('button', { type: 'button', class: 'dt-chipbtn', text: 'Keine', 'aria-pressed': 'false', disabled: ctx.disabled }) : null;
    var palette = D.el('div', { class: 'dt-palette', hidden: true, role: 'group', 'aria-label': 'Farben' });
    var toggle = D.el('button', { type: 'button', class: 'mat-btn mat-btn--ghost mat-btn--icon mat-btn--sm', title: 'Farbpalette', 'aria-label': 'Farbpalette', 'aria-expanded': 'false', disabled: ctx.disabled });
    toggle.appendChild(D.icon('palette'));
    var key = o.key;
    var set = function (value, merge) { o.set(value, merge); };
    var show = function () {
      var e = ctx.first();
      var v = e ? o.get(e) : null;
      var isNone = v === null || v === undefined;
      native.value = isNone ? '#ffffff' : (normHex(v) || '#000000');
      if (document.activeElement !== hex) { hex.value = isNone ? '' : (normHex(v) || ''); }
      hex.placeholder = isNone ? 'keine' : '#000000';
      if (none) { none.setAttribute('aria-pressed', String(isNone)); }
      native.classList.toggle('is-none', isNone);
    };
    var fillPalette = function () {
      D.empty(palette);
      paletteColours().forEach(function (c) {
        var b = D.el('button', { type: 'button', class: 'dt-swatch', title: c, 'aria-label': c, css: { '--dt-swatch': c }, disabled: ctx.disabled });
        b.addEventListener('click', function () { set(c, false); });
        palette.appendChild(b);
      });
    };
    native.addEventListener('input', function () { set(native.value, true); });
    hex.addEventListener('input', function () { var h = normHex(hex.value); if (h) { set(h, true); } });
    hex.addEventListener('blur', show);
    hex.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { hex.blur(); } });
    if (none) { none.addEventListener('click', function () { var e = ctx.first(); var v = e ? o.get(e) : null; set(v === null ? (o.fallback || '#000000') : null, false); }); }
    toggle.addEventListener('click', function () {
      var open = palette.hidden;
      palette.hidden = !open;
      toggle.setAttribute('aria-expanded', String(open));
      if (open) { fillPalette(); openPalette.add(key); } else { openPalette.delete(key); }
    });
    if (openPalette.has(key)) { palette.hidden = false; toggle.setAttribute('aria-expanded', 'true'); fillPalette(); }
    show();
    refreshers.push(function () { show(); if (!palette.hidden) { fillPalette(); } });
    var row = D.el('div', { class: 'dt-colour' }, [native, hex, toggle]);
    return D.el('div', { class: 'dt-f' + (o.cls ? ' ' + o.cls : '') }, [
      D.el('div', { class: 'dt-f__labelrow' }, [D.el('label', { class: 'dt-f__label', for: id, text: label }), none]),
      D.el('div', { class: 'dt-colour__wrap' }, [row, palette]),
    ]);
  }

  // ================================================================================================ sections for elements

  function arrangeSection() {
    var multi = ctx.ids.length > 1;
    var d = ctx.disabled;
    var alignBtn = function (mode, icon, label) { return iconButton(icon, label, function () { app.align(mode, alignToPage); }, { disabled: d || ctx.allLocked }); };
    var rows = [
      D.el('div', { class: 'dt-iconrow', role: 'group', 'aria-label': 'Ausrichten' }, [
        alignBtn('left', 'align-start-vertical', 'Links ausrichten'), alignBtn('centre', 'align-center-vertical', 'Horizontal zentrieren'), alignBtn('right', 'align-end-vertical', 'Rechts ausrichten'),
        D.el('span', { class: 'dt-iconrow__sep' }),
        alignBtn('top', 'align-start-horizontal', 'Oben ausrichten'), alignBtn('middle', 'align-center-horizontal', 'Vertikal zentrieren'), alignBtn('bottom', 'align-end-horizontal', 'Unten ausrichten'),
      ]),
    ];
    if (multi) {
      var seg = D.el('div', { class: 'mat-seg dt-seg', role: 'group', 'aria-label': 'Ausrichten an' });
      [[false, 'An Auswahl'], [true, 'An Seite']].forEach(function (opt) {
        var b = D.el('button', { type: 'button', class: 'mat-seg__btn', text: opt[1], 'aria-pressed': String(alignToPage === opt[0]), disabled: d });
        b.addEventListener('click', function () { alignToPage = opt[0]; D.$$('.mat-seg__btn', seg).forEach(function (x, i) { x.setAttribute('aria-pressed', String(i === (alignToPage ? 1 : 0))); }); });
        seg.appendChild(b);
      });
      rows.push(seg);
    }
    rows.push(D.el('div', { class: 'dt-iconrow', role: 'group', 'aria-label': 'Verteilen und Reihenfolge' }, [
      iconButton('align-horizontal-space-between', 'Horizontal verteilen (ab 3 Elementen)', function () { app.distribute('x'); }, { disabled: d || ctx.ids.length < 3 }),
      iconButton('align-vertical-space-between', 'Vertikal verteilen (ab 3 Elementen)', function () { app.distribute('y'); }, { disabled: d || ctx.ids.length < 3 }),
      D.el('span', { class: 'dt-iconrow__sep' }),
      iconButton('bring-to-front', 'Ganz nach vorn', function () { app.order('front'); }, { disabled: d }),
      iconButton('arrow-up', 'Eine Ebene nach vorn', function () { app.order('forward'); }, { disabled: d }),
      iconButton('arrow-down', 'Eine Ebene nach hinten', function () { app.order('backward'); }, { disabled: d }),
      iconButton('send-to-back', 'Ganz nach hinten', function () { app.order('back'); }, { disabled: d }),
    ]));
    return section('Anordnen', rows);
  }

  function actionsSection() {
    var d = ctx.disabled;
    var locked = ctx.els.every(function (e) { return e.locked; });
    var hidden = ctx.els.every(function (e) { return e.hidden; });
    var lockBtn = textButton(locked ? 'lock-open' : 'lock', locked ? 'Entsperren' : 'Sperren', function () { app.toggleLock(ctx.ids); }, { disabled: !app.editable(), title: 'Gesperrte Elemente lassen sich nur über die Ebenen auswählen' });
    return D.el('div', { class: 'dt-actions' }, [
      textButton('copy', 'Duplizieren', function () { app.duplicateSelection(); }, { disabled: d }),
      lockBtn,
      textButton(hidden ? 'eye' : 'eye-off', hidden ? 'Einblenden' : 'Ausblenden', function () { app.toggleHidden(ctx.ids); }, { disabled: !app.editable() }),
      textButton('trash', 'Löschen', function () { app.deleteSelection(); }, { disabled: !app.editable(), cls: 'dt-actions__danger' }),
    ]);
  }

  function geometrySection() {
    var u = D.unitLabel(app.unit());
    var digits = app.unit() === 'px' ? 1 : 2;
    var step = app.unit() === 'px' ? 1 : 0.5;
    var geo = function (prop, label) {
      return numberField(label, { get: function (e) { return e[prop]; }, set: function (v) { apply((function () { var p = {}; p[prop] = D.round(v, 3); return p; })(), 'geo-' + prop); }, step: step, digits: digits, suffix: u, min: prop === 'w' || prop === 'h' ? 0 : undefined });
    };
    var rows = [
      D.el('div', { class: 'dt-grid2' }, [geo('x', 'X'), geo('y', 'Y'), geo('w', 'Breite'), geo('h', 'Höhe')]),
      D.el('div', { class: 'dt-grid2' }, [
        numberField('Drehung', { get: function (e) { return e.rotation || 0; }, set: function (v) { apply({ rotation: D.round(D.normAngle(v), 1) }, 'rotation'); }, step: 1, digits: 1, suffix: '°', min: -360, max: 360 }),
        numberField('Deckkraft', { get: function (e) { return Math.round((e.opacity === undefined ? 1 : e.opacity) * 100); }, set: function (v) { apply({ opacity: D.round(v / 100, 2) }, 'opacity'); }, step: 5, digits: 0, suffix: '%', min: 0, max: 100 }),
      ]),
    ];
    return section('Position und Größe', rows);
  }

  function opacityOnly() {
    return section('Darstellung', [numberField('Deckkraft', { get: function (e) { return Math.round((e.opacity === undefined ? 1 : e.opacity) * 100); }, set: function (v) { apply({ opacity: D.round(v / 100, 2) }, 'opacity'); }, step: 5, digits: 0, suffix: '%', min: 0, max: 100 })]);
  }

  /**
   * "Mit KI formulieren": opens the dialog of js/ai.js for the selected text. The server keeps only suggestions with the same placeholders; picking one is an ordinary change
   * of the document (one undo step), nothing is saved until the design is. Not offered to a viewer, when the AI is switched off, or for a locked element.
   */
  function aiSuggestButton() {
    var host = document.getElementById('dt-ds');
    if (!host || host.getAttribute('data-ai') !== 'true' || !window.DtAi || !app.editable()) { return null; }
    var b = D.el('button', { type: 'button', class: 'mat-btn mat-btn--secondary mat-btn--sm dt-aibtn', disabled: ctx.disabled, title: 'Die KI schlägt andere Formulierungen vor. Du wählst eine aus.' }, [D.icon('sparkles'), D.el('span', { text: 'Mit KI formulieren' })]);
    b.addEventListener('click', function () {
      var e = ctx.first();
      if (!e) { return; }
      var ids = ctx.ids.slice();
      window.DtAi.suggestText({
        designId: Number(host.getAttribute('data-design-id')),
        text: e.text || '',
        elementName: e.name || '',
        width: e.w,
        height: e.h,
        unit: app.unit(),
        fields: (app.doc.fields || []).map(function (f) { return { key: f.key, label: f.label, type: f.type, sample: f.sample }; }),
        onPick: function (text) { app.setProps(ids, { text: String(text).slice(0, 5000) }, { merge: false }); },
      });
    });
    return b;
  }

  /** A text area whose changes are applied after a short pause (the engine lays the text out again) and at once when it loses the focus. */
  function textContent() {
    var id = D.uid('dt-text');
    var ta = D.el('textarea', { class: 'mat-input dt-textarea', id: id, rows: 3, spellcheck: 'false', disabled: ctx.disabled, maxlength: 5000 });
    var read = function () { var e = ctx.first(); return e ? e.text : ''; };
    ta.value = read();
    var pendingApply = D.debounce(function () { if (ctx && ctx.first()) { app.setProps(ctx.ids, { text: ta.value }, { merge: 'text:' + ctx.ids.join(','), mergeMs: 1500 }); } }, 160);
    ta.addEventListener('input', pendingApply);
    ta.addEventListener('blur', function () { pendingApply.flush(); });
    refreshers.push(function () { if (document.activeElement !== ta && ta.value !== read()) { ta.value = read(); } });
    var hint = D.el('span', { class: 'dt-hint', text: 'Platzhalter wie {{Name}} werden mit dem Wert des Feldes ersetzt. Tipp: Doppelklick auf den Text auf der Fläche bearbeitet ihn direkt.' });
    return section('Text', [field(null, ta, null, id), aiSuggestButton(), hint]);
  }

  function fontSection() {
    var d = ctx.disabled;
    var families = app.fontIndex;
    var familyOptions = families.map(function (f) { return [f.family, f.family, D.fontClass(f.family)]; });
    var infoOf = function (family) { return families.find(function (f) { return D.lower(f.family) === D.lower(family); }) || null; };
    var weightLabel = function (w) { return w + ' – ' + (D.WEIGHT_NAMES[w] || ''); };
    var fam = selectField('Schrift', familyOptions, {
      get: function (e) { return e.fontFamily; },
      set: function (v) {
        var info = infoOf(v);
        app.setProps(ctx.ids, function (e) {
          var patch = { fontFamily: v };
          if (info && info.weights.indexOf(e.fontWeight) < 0) {
            patch.fontWeight = info.weights.reduce(function (best, w) { return Math.abs(w - e.fontWeight) < Math.abs(best - e.fontWeight) ? w : best; }, info.weights[0]);
          }
          return patch;
        }, { merge: false, structure: true });
      },
      onShow: function (select) { select.className = 'mat-select mat-select--sm ' + D.fontClass(select.value); },
      cls: 'dt-f--wide',
    });

    var weightSelectHost = D.el('div', { class: 'dt-weighthost' });
    var buildWeight = function () {
      D.empty(weightSelectHost);
      var e = ctx.first();
      var info = e ? infoOf(e.fontFamily) : null;
      var weights = info ? info.weights.slice() : [100, 200, 300, 400, 500, 600, 700, 800, 900];
      if (e && weights.indexOf(e.fontWeight) < 0) { weights.push(e.fontWeight); weights.sort(function (a, b) { return a - b; }); }
      var weightField = selectField('Stärke', weights.map(function (w) { return [String(w), weightLabel(w)]; }), {
        get: function (el) { return el.fontWeight; },
        set: function (v) { apply({ fontWeight: Number(v) }, 'weight'); },
      });
      if (weights.length < 2) { weightField.querySelector('select').disabled = true; }
      weightSelectHost.appendChild(weightField);
    };
    buildWeight();
    refreshers.push(function () {
      var e = ctx.first();
      var sig = e ? e.fontFamily + '|' + e.fontWeight : '';
      if (weightSelectHost.getAttribute('data-sig') !== sig) { weightSelectHost.setAttribute('data-sig', sig); if (!weightSelectHost.contains(document.activeElement)) { buildWeight(); } }
    });

    var minRow = numberField('Kleinste Größe', { get: function (e) { return e.minFontSize; }, set: function (v) { apply({ minFontSize: D.round(v, 2) }, 'minfont'); }, step: 0.5, digits: 2, suffix: 'pt', min: 0.5, max: 1000 });
    var fitSel = selectField('Passend machen', [['none', 'Nicht verkleinern'], ['shrink', 'Verkleinern, bis es passt']], {
      get: function (e) { return e.fit; }, set: function (v) { app.setProps(ctx.ids, { fit: v }, { merge: false, structure: true }); },
    });
    var syncMin = function () { var e = ctx.first(); minRow.hidden = !(e && e.fit === 'shrink'); };
    syncMin();
    refreshers.push(syncMin);

    var rows = [
      fam,
      D.el('div', { class: 'dt-grid2 dt-grid2--weight' }, [
        weightSelectHost,
        numberField('Größe', { get: function (e) { return e.fontSize; }, set: function (v) { apply({ fontSize: D.round(v, 2) }, 'fontsize'); }, step: 0.5, digits: 2, suffix: 'pt', min: 1, max: 1000 }),
      ]),
      colourField('Farbe', { key: 'text-colour', get: function (e) { return e.color; }, set: function (v) { apply({ color: v }, 'colour'); } }),
      D.el('div', { class: 'dt-grid2 dt-grid2--seg' }, [
        segmented('Ausrichtung', [
          { value: 'left', icon: 'text-align-start', title: 'Linksbündig' }, { value: 'center', icon: 'text-align-center', title: 'Zentriert' }, { value: 'right', icon: 'text-align-end', title: 'Rechtsbündig' },
        ], { get: function (e) { return e.align; }, set: function (v) { app.setProps(ctx.ids, { align: v }, { merge: false }); } }),
        segmented('Senkrecht', [
          { value: 'top', icon: 'align-start-horizontal', title: 'Oben' }, { value: 'middle', icon: 'align-center-horizontal', title: 'Mitte' }, { value: 'bottom', icon: 'align-end-horizontal', title: 'Unten' },
        ], { get: function (e) { return e.valign; }, set: function (v) { app.setProps(ctx.ids, { valign: v }, { merge: false }); } }),
      ]),
      D.el('div', { class: 'dt-grid2' }, [
        numberField('Zeilenhöhe', { get: function (e) { return e.lineHeight; }, set: function (v) { apply({ lineHeight: D.round(v, 2) }, 'lh'); }, step: 0.05, digits: 2, min: 0.5, max: 3 }),
        numberField('Zeichenabstand', { get: function (e) { return e.letterSpacing; }, set: function (v) { apply({ letterSpacing: D.round(v, 3) }, 'ls'); }, step: 0.01, digits: 3, suffix: 'em', min: -0.5, max: 2 }),
      ]),
      D.el('div', { class: 'dt-switches' }, [
        switchField('Kursiv', { get: function (e) { return e.italic; }, set: function (v) { app.setProps(ctx.ids, { italic: v }, { merge: false }); } }),
        switchField('Großbuchstaben', { get: function (e) { return e.uppercase; }, set: function (v) { app.setProps(ctx.ids, { uppercase: v }, { merge: false }); } }),
        switchField('Zeilenumbruch', { get: function (e) { return e.wrap; }, set: function (v) { app.setProps(ctx.ids, { wrap: v }, { merge: false }); } }),
      ]),
      fitSel,
      minRow,
    ];
    if (d) { /* disabled state is applied by the controls themselves */ }
    return section('Schrift', rows);
  }

  // ---- image sources

  function fieldOptions(type) {
    return app.doc.fields.filter(function (f) { return !type || f.type === type; }).map(function (f) { return [f.key, f.label && f.label !== f.key ? f.key + ' – ' + f.label : f.key]; });
  }

  /** One source editor (an image or one slot of a strip): kind (none / media / field) and the matching input. onChange(source|null). */
  function sourceEditor(getSource, onChange, label) {
    var host = D.el('div', { class: 'dt-source' });
    var disabled = ctx.disabled;
    var build = function () {
      D.empty(host);
      var s = getSource();
      var kind = s ? (s.field !== undefined ? 'field' : 'asset') : 'none';
      var kindSelect = D.el('select', { class: 'mat-select mat-select--sm dt-source__kind', 'aria-label': (label || 'Quelle') + ': Art', disabled: disabled }, [
        D.el('option', { value: 'none', text: 'Leer' }), D.el('option', { value: 'asset', text: 'Medium' }), D.el('option', { value: 'field', text: 'Feld' }),
      ]);
      kindSelect.value = kind;
      host.appendChild(kindSelect);
      if (kind === 'asset') {
        var key = s.asset || '';
        var asset = key ? app.assetByKey(key) : null;
        var thumb = D.el('span', { class: 'dt-thumb dt-thumb--xs' });
        if (asset) { thumb.appendChild(D.el('img', { src: asset.url, alt: '' })); }
        var input = D.el('input', { type: 'text', class: 'mat-input mat-input--sm dt-source__value', list: 'dt-asset-keys', value: key, placeholder: 'Schlüssel des Mediums', 'aria-label': (label || 'Medium') + ': Schlüssel', disabled: disabled, autocomplete: 'off', spellcheck: 'false' });
        input.addEventListener('change', function () { var v = input.value.trim().toLowerCase(); onChange(v ? { asset: v } : { asset: '' }); });
        host.appendChild(D.el('div', { class: 'dt-source__row' }, [thumb, input]));
      } else if (kind === 'field') {
        var options = fieldOptions('image');
        var current = s.field || '';
        if (current && !options.some(function (o) { return D.lower(o[0]) === D.lower(current); })) { options.unshift([current, current + ' (kein Bildfeld)']); }
        var fieldSelect = D.el('select', { class: 'mat-select mat-select--sm dt-source__value', 'aria-label': (label || 'Feld') + ': Feld', disabled: disabled });
        fieldSelect.appendChild(D.el('option', { value: '', text: options.length ? 'Feld wählen ...' : 'Noch kein Bildfeld' }));
        options.forEach(function (o) { fieldSelect.appendChild(D.el('option', { value: o[0], text: o[1] })); });
        fieldSelect.value = current;
        fieldSelect.addEventListener('change', function () { onChange(fieldSelect.value ? { field: fieldSelect.value } : { field: '' }); });
        var create = D.el('button', { type: 'button', class: 'mat-btn mat-btn--secondary mat-btn--sm', text: 'Neues Bildfeld', disabled: disabled, title: 'Legt ein Feld vom Typ Bild an und bindet es hierher' });
        create.addEventListener('click', function () {
          var keyName = app.freeKey('Bild');
          var err = app.addField({ key: keyName, label: 'Bild ' + keyName.replace('Bild', ''), type: 'image', sample: '' });
          if (!err) { onChange({ field: keyName }); }
        });
        host.appendChild(D.el('div', { class: 'dt-source__row' }, [fieldSelect, create]));
      }
      kindSelect.addEventListener('change', function () {
        if (kindSelect.value === 'none') { onChange(null); }
        else if (kindSelect.value === 'asset') { onChange({ asset: '' }); }
        else { onChange({ field: '' }); }
      });
    };
    build();
    host.rebuild = build;
    return host;
  }

  /** Sources with an empty key mean "chosen kind, no value yet": they are kept in the panel but stored as null in the document. */
  function toStored(source) {
    if (!source) { return null; }
    if (source.asset) { return { asset: source.asset }; }
    if (source.field) { return { field: source.field }; }
    return null;
  }

  var pendingKind = new Map();   // element id (+ slot) -> 'asset' | 'field' while the key is still empty

  function imageSection() {
    var e0 = ctx.first();
    var id = e0.id;
    var editor = sourceEditor(function () {
      var e = ctx.first();
      var s = e ? e.source : null;
      var pending = pendingKind.get(id);
      if (!s && pending) { return pending === 'asset' ? { asset: '' } : { field: '' }; }
      return s;
    }, function (source) {
      pendingKind.delete(id);
      if (source && !source.asset && !source.field) { pendingKind.set(id, source.asset !== undefined ? 'asset' : 'field'); }
      app.setProps([id], { source: toStored(source) }, { merge: false });
      editor.rebuild();
    }, 'Bild');
    refreshers.push(function () { if (!editor.contains(document.activeElement)) { editor.rebuild(); } });
    var rows = [
      editor,
      D.el('div', { class: 'dt-hint' }, ['Tipp: Ein Bild aus dem Reiter ', D.el('strong', { text: 'Medien' }), ' auf dieses Element ziehen, ersetzt die Quelle.']),
      selectField('Einpassen', [['contain', 'Ganz zeigen'], ['cover', 'Füllen (beschneiden)'], ['fill', 'Strecken']], { get: function (e) { return e.fit; }, set: function (v) { app.setProps(ctx.ids, { fit: v }, { merge: false }); } }),
      numberField('Eckenradius', { get: function (e) { return e.radius; }, set: function (v) { apply({ radius: D.round(v, 2) }, 'radius'); }, step: app.unit() === 'px' ? 1 : 0.5, digits: 2, suffix: D.unitLabel(app.unit()), min: 0 }),
    ];
    return section('Bild', rows);
  }

  function stripSection() {
    var e0 = ctx.first();
    var id = e0.id;
    var list = D.el('div', { class: 'dt-slots' });
    var buildList = function () {
      D.empty(list);
      var e = app.element(id);
      if (!e) { return; }
      e.items.forEach(function (item, index) {
        var editor = sourceEditor(function () {
          var s = (app.element(id).items || [])[index];
          var pending = pendingKind.get(id + ':' + index);
          if (!s && pending) { return pending === 'asset' ? { asset: '' } : { field: '' }; }
          return s;
        }, function (source) {
          var slotKey = id + ':' + index;
          pendingKind.delete(slotKey);
          if (source && !source.asset && !source.field) { pendingKind.set(slotKey, source.asset !== undefined ? 'asset' : 'field'); }
          var items = app.element(id).items.slice();
          items[index] = toStored(source);
          app.setProps([id], { items: items }, { merge: false });
          buildList();
        }, 'Platz ' + (index + 1));
        var remove = iconButton('x', 'Platz ' + (index + 1) + ' entfernen', function () {
          var items = app.element(id).items.slice();
          items.splice(index, 1);
          app.setProps([id], { items: items }, { merge: false });
          buildList();
        }, { disabled: ctx.disabled });
        list.appendChild(D.el('div', { class: 'dt-slot' }, [D.el('span', { class: 'dt-slot__n', text: String(index + 1) }), editor, remove]));
      });
    };
    buildList();
    var add = textButton('plus', 'Platz hinzufügen', function () {
      var items = app.element(id).items.slice();
      if (items.length >= 12) { D.toast('Eine Bildleiste hat höchstens 12 Plätze.', 'warning'); return; }
      items.push(null);
      app.setProps([id], { items: items }, { merge: false });
      buildList();
    }, { disabled: ctx.disabled });
    var rows = [
      list, add,
      D.el('div', { class: 'dt-hint', text: 'Leere Plätze rücken auf: die übrigen Bilder wandern nach links (oder zur Mitte, zum rechten Rand).' }),
      numberField('Abstand', { get: function (e) { return e.gap; }, set: function (v) { apply({ gap: D.round(v, 2) }, 'gap'); }, step: app.unit() === 'px' ? 1 : 0.5, digits: 2, suffix: D.unitLabel(app.unit()), min: 0 }),
      segmented('Ausrichtung', [{ value: 'left', icon: 'text-align-start', title: 'Links' }, { value: 'center', icon: 'text-align-center', title: 'Mitte' }, { value: 'right', icon: 'text-align-end', title: 'Rechts' }],
        { get: function (e) { return e.align; }, set: function (v) { app.setProps(ctx.ids, { align: v }, { merge: false }); } }),
    ];
    return section('Bildleiste', rows);
  }

  function shapeSection() {
    var e0 = ctx.first();
    var isLine = e0.shape === 'line';
    var rows = [];
    if (!isLine) {
      rows.push(colourField('Füllung', { key: 'shape-fill', allowNone: true, fallback: '#1fb3d6', get: function (e) { return e.fill; }, set: function (v) { apply({ fill: v }, 'fill'); } }));
    }
    rows.push(colourField(isLine ? 'Linienfarbe' : 'Rand', { key: 'shape-stroke', allowNone: !isLine, fallback: '#000000', get: function (e) { return e.stroke; }, set: function (v) { apply({ stroke: v }, 'stroke'); } }));
    rows.push(D.el('div', { class: 'dt-grid2' }, [
      numberField('Strichstärke', { get: function (e) { return e.strokeWidth; }, set: function (v) { apply({ strokeWidth: D.round(v, 2) }, 'sw'); }, step: 0.25, digits: 2, suffix: 'pt', min: 0, max: 1000 }),
      selectField('Linienart', [['solid', 'Durchgezogen'], ['dashed', 'Gestrichelt'], ['dotted', 'Gepunktet']], { get: function (e) { return e.dash; }, set: function (v) { app.setProps(ctx.ids, { dash: v }, { merge: false }); } }),
    ]));
    if (e0.shape === 'rect') {
      rows.push(numberField('Eckenradius', { get: function (e) { return e.radius; }, set: function (v) { apply({ radius: D.round(v, 2) }, 'radius'); }, step: app.unit() === 'px' ? 1 : 0.5, digits: 2, suffix: D.unitLabel(app.unit()), min: 0 }));
    }
    return section(isLine ? 'Linie' : (e0.shape === 'ellipse' ? 'Ellipse' : 'Rechteck'), rows);
  }

  function showIfSection() {
    var options = [['', 'Immer anzeigen']].concat(app.doc.fields.map(function (f) { return [f.key, 'Nur wenn „' + (f.label || f.key) + '“ gefüllt ist']; }));
    return section('Anzeigebedingung', [
      selectField(null, options, { get: function (e) { return e.showIf || ''; }, set: function (v) { app.setProps(ctx.ids, { showIf: v || null }, { merge: false, structure: true }); }, cls: 'dt-f--wide' }),
      D.el('div', { class: 'dt-hint', text: 'So verschwindet eine Zeile samt Beschriftung, wenn ihr Wert leer ist.' }),
    ]);
  }

  // ================================================================================================ the page

  function presetOptions() {
    var out = [['custom', 'Eigene Größe']];
    app.presets.forEach(function (p) { out.push([p.key, p.name]); });
    return out;
  }

  function presetKeyOfDoc() {
    var d = app.doc;
    var p = app.presets.find(function (x) { return x.unit === d.unit && Math.abs(x.width - d.width) < 0.01 && Math.abs(x.height - d.height) < 0.01; });
    return p ? p.key : 'custom';
  }

  /** mm <-> px (96 per inch): every length of the document is converted. */
  function convertUnit(target) {
    if (target === app.doc.unit) { return; }
    var factor = target === 'mm' ? 25.4 / 96 : 96 / 25.4;
    app.edit(function (doc) {
      doc.unit = target;
      doc.width = D.round(doc.width * factor, 2);
      doc.height = D.round(doc.height * factor, 2);
      doc.elements.forEach(function (e) {
        ['x', 'y', 'w', 'h', 'radius', 'gap'].forEach(function (k) { if (D.isNum(e[k])) { e[k] = D.round(e[k] * factor, 3); } });
      });
    }, { structure: true, reason: 'unit' });
    app.fitMode = true;
    D.canvas.fit();
  }

  function pageSection() {
    var d = app.doc;
    var disabled = ctx.disabled;
    var presetSel = D.el('select', { class: 'mat-select mat-select--sm', 'aria-label': 'Format', disabled: disabled });
    var groups = new Map();
    presetSel.appendChild(D.el('option', { value: 'custom', text: 'Eigene Größe' }));
    app.presets.forEach(function (p) {
      var g = groups.get(p.group);
      if (!g) { g = D.el('optgroup', { label: p.group }); groups.set(p.group, g); presetSel.appendChild(g); }
      g.appendChild(D.el('option', { value: p.key, text: p.name }));
    });
    presetSel.value = presetKeyOfDoc();
    presetSel.addEventListener('change', function () {
      var p = app.presets.find(function (x) { return x.key === presetSel.value; });
      if (!p) { return; }
      app.edit(function (doc) { doc.unit = p.unit; doc.width = p.width; doc.height = p.height; }, { structure: true, reason: 'page' });
      D.canvas.fit();
    });
    refreshers.push(function () { if (document.activeElement !== presetSel) { presetSel.value = presetKeyOfDoc(); } });

    var size = function (prop, label) {
      return numberField(label, {
        get: function () { return app.doc[prop]; },
        set: function (v) { app.edit(function (doc) { doc[prop] = D.clamp(D.round(v, 2), 1, 100000); }, { merge: 'page-' + prop, mergeMs: 1200, structure: true, reason: 'page' }); },
        step: app.unit() === 'px' ? 1 : 1, digits: 2, suffix: D.unitLabel(app.unit()), min: 1, max: 100000,
      });
    };
    var unitSel = selectField('Einheit', [['mm', 'Millimeter (mm)'], ['px', 'Pixel (px)']], {
      get: function () { return app.doc.unit; },
      set: function (v) {
        if (!app.doc.elements.length) { convertUnit(v); return; }
        window.MatUi.confirm('Alle Maße des Designs werden von ' + app.doc.unit + ' in ' + v + ' umgerechnet (Schriftgrößen bleiben in pt).', { ok: 'Umrechnen', title: 'Einheit ändern' }).then(function (ok) { if (ok) { convertUnit(v); } else { rebuild(); } });
      },
    });
    var bgAsset = D.el('input', { type: 'text', class: 'mat-input mat-input--sm', list: 'dt-asset-keys', placeholder: 'Schlüssel eines Mediums (leer = keins)', 'aria-label': 'Hintergrundbild', disabled: disabled, autocomplete: 'off', spellcheck: 'false' });
    bgAsset.value = d.background.asset || '';
    bgAsset.addEventListener('change', function () { app.edit(function (doc) { doc.background.asset = bgAsset.value.trim().toLowerCase() || null; }, { reason: 'background' }); });
    refreshers.push(function () { if (document.activeElement !== bgAsset) { bgAsset.value = app.doc.background.asset || ''; } });

    var rows = [
      section('Format', [
        field('Größe', presetSel),
        D.el('div', { class: 'dt-grid2' }, [size('width', 'Breite'), size('height', 'Höhe')]),
        unitSel,
        numberField('Auflösung für PNG', { get: function () { return app.doc.dpi; }, set: function (v) { app.edit(function (doc) { doc.dpi = Math.round(D.clamp(v, 72, 1200)); }, { merge: 'dpi', mergeMs: 1200, reason: 'page' }); }, step: 1, digits: 0, suffix: 'dpi', min: 72, max: 1200 }),
      ]),
      section('Hintergrund', [
        colourField('Farbe', { key: 'page-colour', get: function () { return app.doc.background.color; }, set: function (v) { app.edit(function (doc) { doc.background.color = v || '#ffffff'; }, { merge: 'bgcolour', mergeMs: 1500, reason: 'background' }); } }),
        field('Bild', bgAsset),
        selectField('Bild einpassen', [['cover', 'Füllen (beschneiden)'], ['contain', 'Ganz zeigen'], ['fill', 'Strecken']], { get: function () { return app.doc.background.fit; }, set: function (v) { app.edit(function (doc) { doc.background.fit = v; }, { reason: 'background' }); } }),
      ]),
      section('Zahlen', [
        selectField('Sprache und Format', LOCALES, { get: function () { return app.doc.locale; }, set: function (v) { app.edit(function (doc) { doc.locale = v; }, { reason: 'page' }); } }),
        D.el('div', { class: 'dt-hint', text: 'Bestimmt, wie Preise und Zahlen geschrieben werden (2,99 oder 2.99).' }),
      ]),
    ];
    return rows;
  }

  // ================================================================================================ build

  function clearPanel() {
    refreshers = [];
    D.empty(root);
  }

  function header(icon, title, sub) {
    return D.el('header', { class: 'dt-props__head' }, [
      D.el('span', { class: 'dt-props__icon' }, D.icon(icon)),
      D.el('div', { class: 'dt-props__titles' }, [D.el('h2', { class: 'dt-props__title', text: title }), sub ? D.el('p', { class: 'dt-props__sub', text: sub }) : null]),
    ]);
  }

  function rebuild() {
    if (!app.doc) { return; }
    var scrollTop = root.parentNode ? root.parentNode.scrollTop : 0;
    clearPanel();
    var els = app.selected();
    var disabledByRole = !app.editable();
    if (!els.length) {
      ctx = { ids: [], els: [], first: function () { return app.doc; }, disabled: disabledByRole, allLocked: false };
      root.appendChild(header('square-dashed', 'Seite', D.round(app.doc.width, 2) + ' × ' + D.round(app.doc.height, 2) + ' ' + D.unitLabel(app.unit())));
      if (disabledByRole) { root.appendChild(D.el('p', { class: 'dt-note', text: 'Du darfst dieses Design nur ansehen.' })); }
      pageSection().forEach(function (s) { root.appendChild(s); });
      root.appendChild(D.el('p', { class: 'dt-note', text: 'Klicke ein Element auf der Fläche an, um seine Eigenschaften zu ändern.' }));
      if (root.parentNode) { root.parentNode.scrollTop = scrollTop; }
      return;
    }
    var ids = els.map(function (e) { return e.id; });
    var allLocked = els.every(function (e) { return e.locked; });
    ctx = {
      ids: ids, els: els, allLocked: allLocked,
      first: function () { return app.element(ids[0]); },
      disabled: disabledByRole || allLocked,
    };
    var types = els.map(function (e) { return e.type + (e.type === 'shape' ? ':' + e.shape : ''); }).filter(function (t, i, a) { return a.indexOf(t) === i; });
    var sameType = els.every(function (e) { return e.type === els[0].type; });
    var title = els.length === 1 ? D.typeLabel(els[0]) : els.length + ' Elemente';
    root.appendChild(header(els.length === 1 ? D.elementIcon(els[0]) : 'layers', title, els.length === 1 ? D.elementTitle(els[0]) : (types.length === 1 ? D.typeLabel(els[0]) + ' (mehrere)' : 'gemischte Auswahl')));
    if (disabledByRole) { root.appendChild(D.el('p', { class: 'dt-note', text: 'Du darfst dieses Design nur ansehen.' })); }
    else if (allLocked) { root.appendChild(D.el('p', { class: 'dt-note', text: 'Dieses Element ist gesperrt. Entsperre es, um es zu ändern.' })); }
    root.appendChild(actionsSection());
    if (els.length === 1) { root.appendChild(geometrySection()); } else { root.appendChild(opacityOnly()); }
    if (sameType && els[0].type === 'text') {
      if (els.length === 1) { root.appendChild(textContent()); }
      root.appendChild(fontSection());
    } else if (sameType && els[0].type === 'image') { if (els.length === 1) { root.appendChild(imageSection()); } }
    else if (sameType && els[0].type === 'imageStrip') { if (els.length === 1) { root.appendChild(stripSection()); } }
    else if (sameType && els[0].type === 'shape') { root.appendChild(shapeSection()); }
    root.appendChild(arrangeSection());
    root.appendChild(showIfSection());
    if (root.parentNode) { root.parentNode.scrollTop = scrollTop; }
  }

  function refresh() { refreshers.forEach(function (fn) { fn(); }); }

  function init(theApp, container) {
    app = theApp;
    root = container;
    app.on('selection', rebuild);
    app.on('readonly', rebuild);
    app.on('assets', function () { rebuild(); });
    app.on('fonts', function () { rebuild(); });
    app.on('doc', function (ev) {
      if (!app.doc) { return; }
      if (ev.structure || ev.reason === 'load' || ev.reason === 'history') { rebuild(); } else { refresh(); }
    });
  }

  D.props = { init: init, rebuild: rebuild, refresh: refresh };
})();
