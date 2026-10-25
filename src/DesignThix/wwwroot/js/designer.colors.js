/* DesignThix editor, part 5: the colour popover (D.colors.open). Document colours, brand colours (/api/brand), the default palette, a native picker with a hex field, the
   eyedropper where the browser has one, and "keine" for fills that may be empty. Extension point for later phases: D.colors.sections is a list of { id, title, order, build(host, ctx) };
   a section can be added (gradients) and the built-in ones can be replaced. ctx = { value(), set(value, final), allowNone, app }; set(value, false) is a live change while a picker drags
   (the caller merges it into one undo step), set(value, true) is a final choice. A value is a '#rrggbb' string, null (none) or - when a later section offers it - a gradient object. */
(function () {
  'use strict';

  var D = window.DtDesigner;

  var PALETTE = [
    '#000000', '#374151', '#6b7280', '#9ca3af', '#d1d5db', '#ffffff', '#7f1d1d', '#e5484d', '#f97316', '#f5a524',
    '#facc15', '#a3e635', '#2e9d5b', '#14532d', '#0d9488', '#1fb3d6', '#2f86f6', '#1e3a8a', '#6d28d9', '#a855f7',
    '#db2777', '#f472b6', '#78350f', '#a16207', '#fde68a', '#bbf7d0', '#bae6fd', '#c7d2fe', '#fbcfe8', '#fff7ed',
  ];

  function normHex(text) {
    var t = String(text || '').trim();
    if (t.charAt(0) !== '#') { t = '#' + t; }
    if (/^#[0-9a-fA-F]{3}$/.test(t)) { t = '#' + t[1] + t[1] + t[2] + t[2] + t[3] + t[3]; }
    return /^#[0-9a-fA-F]{6}$/.test(t) ? t.toLowerCase() : null;
  }

  function swatchRow(host, colours, ctx, label) {
    var row = D.el('div', { class: 'dt-palette', role: 'group', 'aria-label': label });
    colours.forEach(function (c) {
      var b = D.el('button', { type: 'button', class: 'dt-swatch', title: c, 'aria-label': c, 'data-colour': c, css: { '--dt-swatch': c } });
      b.addEventListener('click', function () { ctx.set(c, true); });
      row.appendChild(b);
    });
    host.appendChild(row);
    return row;
  }

  var sections = [
    {
      id: 'document', title: 'Dokumentfarben', order: 10,
      build: function (host, ctx) {
        var colours = D.documentColours(ctx.app.doc).slice(0, 24);
        if (!colours.length) { return false; }
        swatchRow(host, colours, ctx, 'Dokumentfarben');
        return true;
      },
    },
    {
      id: 'brand', title: 'Markenfarben', order: 20,
      build: function (host, ctx) {
        var colours = (ctx.app.brand && ctx.app.brand.colors) || [];
        if (!colours.length) {
          host.appendChild(D.el('p', { class: 'dt-hint' }, ['Noch keine Markenfarben. ', D.el('a', { href: '/Brand', target: '_blank', rel: 'noopener', text: 'Marke einrichten' })]));
          return true;
        }
        swatchRow(host, colours, ctx, 'Markenfarben');
        return true;
      },
    },
    {
      id: 'palette', title: 'Standardfarben', order: 30,
      build: function (host, ctx) { swatchRow(host, PALETTE, ctx, 'Standardfarben').classList.add('dt-palette--grid'); return true; },
    },
  ];

  function open(anchor, o) {
    var app = o.app || D.app;
    return D.popover.open(anchor, function (el, api) {
      el.classList.add('dt-colorpop');
      var current = o.value;
      var ctx = {
        app: app, allowNone: !!o.allowNone, close: api.close,
        value: function () { return o.get ? o.get() : current; },
        set: function (value, final) { current = value; if (o.onChange) { o.onChange(value, !!final); } refresh(); },
      };
      var hex = D.el('input', { type: 'text', class: 'mat-input mat-input--sm dt-colour__hex', maxlength: 7, spellcheck: 'false', autocomplete: 'off', 'aria-label': 'Farbe als Hex-Wert', placeholder: '#000000' });
      var native = D.el('input', { type: 'color', class: 'dt-colour__native', 'aria-label': 'Farbe wählen' });
      var none = o.allowNone ? D.el('button', { type: 'button', class: 'dt-chipbtn', text: o.noneLabel || 'Keine', 'aria-pressed': 'false' }) : null;
      var head = D.el('div', { class: 'dt-colorpop__head' }, [native, hex]);
      var eye = null;
      if (window.EyeDropper) {
        eye = D.el('button', { type: 'button', class: 'mat-btn mat-btn--ghost mat-btn--icon mat-btn--sm', title: 'Farbe vom Bildschirm aufnehmen', 'aria-label': 'Farbe vom Bildschirm aufnehmen' }, D.icon('pipette'));
        eye.addEventListener('click', function () {
          new window.EyeDropper().open().then(function (r) { var c = normHex(r.sRGBHex); if (c) { ctx.set(c, true); } }, function () { /* cancelled */ });
        });
        head.appendChild(eye);
      }
      if (none) { head.appendChild(none); }
      el.appendChild(head);
      var refresh = function () {
        var v = ctx.value();
        var isNone = v === null || v === undefined;
        var isHex = typeof v === 'string';
        native.value = isHex ? (normHex(v) || '#000000') : '#ffffff';
        if (document.activeElement !== hex) { hex.value = isHex ? (normHex(v) || '') : ''; }
        native.classList.toggle('is-none', !isHex);
        if (none) { none.setAttribute('aria-pressed', String(isNone)); }
        D.$$('.dt-swatch', el).forEach(function (s) { s.setAttribute('aria-pressed', String(isHex && s.getAttribute('data-colour') === normHex(v))); });
      };
      native.addEventListener('input', function () { ctx.set(native.value, false); });
      native.addEventListener('change', function () { ctx.set(native.value, true); });
      hex.addEventListener('input', function () { var c = normHex(hex.value); if (c) { ctx.set(c, false); } });
      hex.addEventListener('change', function () { var c = normHex(hex.value); if (c) { ctx.set(c, true); } });
      hex.addEventListener('keydown', function (ev) { ev.stopPropagation(); if (ev.key === 'Enter') { var c = normHex(hex.value); if (c) { ctx.set(c, true); } api.close(); } });
      if (none) { none.addEventListener('click', function () { ctx.set(null, true); }); }
      var body = D.el('div', { class: 'dt-colorpop__body' });
      el.appendChild(body);
      sections.slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); }).forEach(function (s) {
        var host = D.el('section', { class: 'dt-colorpop__sec', 'data-section': s.id });
        var made = s.build(host, ctx);
        if (made === false) { return; }
        body.appendChild(D.el('h4', { class: 'dt-colorpop__title', text: s.title }));
        body.appendChild(host);
      });
      refresh();
    }, { title: o.title || 'Farbe', width: 296, align: o.align || 'start', focus: false, onClose: o.onClose });
  }

  D.colors = { open: open, sections: sections, PALETTE: PALETTE, normHex: normHex };
})();
