/* DesignThix editor, part 10f: two context pages of the left panel. "Effekte" (opened from the text toolbar): presets like Canva (Keine, Schatten, Anheben, Kontur, Hohl, Hintergrund, Gebogen)
   drawn by the engine, and below them the single properties: shadow (colour, blur, offset, opacity), outline (colour, width), background box (colour, radius, padding) and the curve
   (-100..100). "Anpassen" (opened from the image toolbar): brightness, contrast, saturation, blur, black and white, sepia, a few looks and "Zurücksetzen". Every change goes through
   app.setProps, so it is one undo step (sliders merge through a key); the pages follow undo and the canvas. Schema 2 properties: shadow, outline, background, curve, filters. */
(function () {
  'use strict';

  var D = window.DtDesigner;
  var NOFX = { shadow: null, outline: null, background: null, curve: 0 };

  function unitLen(app, e, factor) { return D.round(D.ptToUnit(e.fontSize, app.unit()) * factor, 2); }

  function luminance(hex) {
    var h = /^#[0-9a-f]{6}$/i.test(hex || '') ? hex : '#000000';
    var c = [1, 3, 5].map(function (i) { var v = parseInt(h.slice(i, i + 2), 16) / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function onColour(hex) { return luminance(hex) > 0.42 ? '#111827' : '#ffffff'; }

  /** The properties of a preset for a text element (page = the colour the page has, for "Hohl"). */
  function presetPatch(app, key, e, pageColour) {
    var p = Object.assign({}, NOFX);
    if (key === 'none') { return p; }
    if (key === 'shadow') { var d = unitLen(app, e, 0.06); p.shadow = { color: '#000000', opacity: 0.45, blur: 0, x: d, y: d }; }
    else if (key === 'lift') { p.shadow = { color: '#000000', opacity: 0.32, blur: unitLen(app, e, 0.2), x: 0, y: unitLen(app, e, 0.06) }; }
    else if (key === 'outline') { p.outline = { color: luminance(e.color) > 0.5 ? '#111827' : '#ffffff', width: D.round(Math.max(0.75, e.fontSize * 0.06), 2) }; }
    else if (key === 'hollow') { p.outline = { color: e.color, width: D.round(Math.max(1, e.fontSize * 0.045), 2) }; p.color = pageColour; }
    else if (key === 'background') {
      var bg = app.brand && app.brand.colors && app.brand.colors.length ? app.brand.colors[0] : '#facc15';
      p.background = { color: bg, radius: unitLen(app, e, 0.22), padding: unitLen(app, e, 0.3) };
      p.color = onColour(bg);
    } else if (key === 'curved') { p.curve = 30; }
    return p;
  }

  function which(e, pageColour) {
    if (e.curve) { return 'curved'; }
    if (e.background) { return 'background'; }
    if (e.outline) { return e.color === pageColour ? 'hollow' : 'outline'; }
    if (e.shadow) { return e.shadow.blur > 0 ? 'lift' : 'shadow'; }
    return 'none';
  }

  var PRESETS = [['none', 'Keine'], ['shadow', 'Schatten'], ['lift', 'Anheben'], ['outline', 'Kontur'], ['hollow', 'Hohl'], ['background', 'Hintergrund'], ['curved', 'Gebogen']];

  function pageColourOf(app) { var bg = app.page().background; return bg.color || '#ffffff'; }

  // ================================================================================================ Effekte

  D.panels.register({
    id: 'effects', title: 'Effekte', icon: 'wand-sparkles', page: true, needsSelection: true, reselect: true,
    build: function (host, api) {
      var app = api.app;
      var texts = app.selected().filter(function (e) { return e.type === 'text'; });
      if (!texts.length) { host.appendChild(D.el('p', { class: 'dt-empty', text: 'Wähle einen Text aus, um Effekte zu setzen.' })); return; }
      var ids = texts.map(function (e) { return e.id; });
      var off = !app.editable() || texts.every(function (e) { return e.locked; });
      var first = function () { return app.element(ids[0]); };
      var pageColour = pageColourOf(app);

      var set = function (patchOrFn, key) {
        app.setProps(ids, typeof patchOrFn === 'function' ? function (e) { return D.canvas.textPatch(e, patchOrFn(e)); } : patchOrFn, { merge: key ? 'fx:' + key + ':' + ids.join(',') : false, mergeMs: 1200 });
      };

      var body = D.el('div', { class: 'dt-fx' });
      host.appendChild(body);

      var draw = function () {
        D.empty(body);
        var e = first();
        if (!e) { return; }
        var current = which(e, pageColour);

        // ---- presets
        var grid = D.el('div', { class: 'dt-fxpresets', role: 'group', 'aria-label': 'Voreinstellungen' });
        PRESETS.forEach(function (pr) {
          var thumb = D.el('span', { class: 'dt-fxpreset__thumb' });
          var b = D.el('button', { type: 'button', class: 'dt-fxpreset', 'data-fx': pr[0], 'aria-pressed': String(current === pr[0]), title: pr[1], 'aria-label': 'Effekt ' + pr[1], disabled: off }, [thumb, D.el('span', { class: 'dt-fxpreset__label', text: pr[1] })]);
          b.addEventListener('click', function () { set(function (el) { return presetPatch(app, pr[0], el, pageColour); }); draw(); });
          grid.appendChild(b);
          // the preview: "Aa" in the style of the preset on a plain ground, drawn by the engine
          var sample = Object.assign({ id: 'p', type: 'text', text: 'Aa', x: 0, y: 4, w: 60, h: 26, fontFamily: e.fontFamily, fontSize: 40, fontWeight: Math.max(600, e.fontWeight), color: '#111827', align: 'center', valign: 'middle', fit: 'none' });
          var fake = Object.assign({}, sample, { fontSize: 40 });
          var patch = presetPatch({ unit: function () { return 'mm'; }, brand: app.brand }, pr[0], fake, '#eef2f6');
          Object.assign(sample, patch);
          if (pr[0] === 'outline') { sample.outline.color = '#ffffff'; sample.color = '#111827'; sample.outline.width = 2; }
          if (pr[0] === 'curved') { sample.text = 'Abc'; sample.fontSize = 36; sample.curve = 25; sample.y = 3; sample.h = 30; }
          var doc = { schema: 2, unit: 'mm', width: 60, height: 34, pages: [{ background: { color: '#eef2f6' }, elements: [sample] }] };
          window.DtEngine.render(doc, null, { mode: 'output', fonts: app.fonts, idPrefix: 'fx' + pr[0] }).then(function (svg) { svg.removeAttribute('width'); svg.removeAttribute('height'); thumb.appendChild(svg); }, function () { thumb.textContent = 'Aa'; });
        });
        body.appendChild(D.ui.section('Voreinstellungen', [grid]));

        // ---- shadow
        var shadowOn = D.ui.switchBox({ label: 'Schatten', value: !!e.shadow, disabled: off, onChange: function (v) {
          set(function (el) { return { shadow: v ? { color: '#000000', opacity: 0.4, blur: unitLen(app, el, 0.12), x: unitLen(app, el, 0.05), y: unitLen(app, el, 0.05) } : null }; });
          draw();
        } });
        var shadowBox = [shadowOn.el];
        if (e.shadow) {
          var maxLen = Math.max(2, unitLen(app, e, 0.6));
          var sh = function (key, v) { set(function (el) { var s = Object.assign({}, el.shadow || {}); s[key] = v; return { shadow: s }; }, 'shadow' + key); };
          shadowBox.push(D.ui.field('Farbe', D.ui.colour({ label: 'Schattenfarbe', disabled: off, get: function () { var x = first(); return x && x.shadow ? x.shadow.color : '#000000'; }, apply: function (v, final) { if (typeof v === 'string') { set(function (el) { return { shadow: Object.assign({}, el.shadow || {}, { color: v }) }; }, final ? null : 'shadowcolour'); } } }).el));
          shadowBox.push(D.ui.field('Weichzeichnen', D.ui.slider({ min: 0, max: maxLen, step: app.unit() === 'px' ? 1 : 0.1, digits: 1, value: e.shadow.blur, suffix: D.unitLabel(app.unit()), label: 'Weichzeichnen des Schattens', disabled: off, onInput: function (v) { sh('blur', D.round(v, 2)); } }).el));
          shadowBox.push(D.el('div', { class: 'dt-grid2' }, [
            D.ui.field('Versatz X', D.ui.number({ value: e.shadow.x, min: -maxLen, max: maxLen, step: app.unit() === 'px' ? 1 : 0.1, digits: 1, suffix: D.unitLabel(app.unit()), label: 'Versatz in X', disabled: off, onInput: function (v) { sh('x', D.round(v, 2)); } }).el),
            D.ui.field('Versatz Y', D.ui.number({ value: e.shadow.y, min: -maxLen, max: maxLen, step: app.unit() === 'px' ? 1 : 0.1, digits: 1, suffix: D.unitLabel(app.unit()), label: 'Versatz in Y', disabled: off, onInput: function (v) { sh('y', D.round(v, 2)); } }).el),
          ]));
          shadowBox.push(D.ui.field('Transparenz', D.ui.slider({ min: 0, max: 100, step: 1, value: Math.round(e.shadow.opacity * 100), suffix: '%', label: 'Transparenz des Schattens', disabled: off, onInput: function (v) { sh('opacity', D.round(v / 100, 2)); } }).el));
        }
        body.appendChild(D.ui.section('Schatten', shadowBox));

        // ---- outline
        var outlineOn = D.ui.switchBox({ label: 'Kontur', value: !!e.outline, disabled: off, onChange: function (v) {
          set(function (el) { return { outline: v ? { color: luminance(el.color) > 0.5 ? '#111827' : '#ffffff', width: D.round(Math.max(0.75, el.fontSize * 0.05), 2) } : null }; });
          draw();
        } });
        var outlineBox = [outlineOn.el];
        if (e.outline) {
          outlineBox.push(D.ui.field('Farbe', D.ui.colour({ label: 'Konturfarbe', disabled: off, get: function () { var x = first(); return x && x.outline ? x.outline.color : '#000000'; }, apply: function (v, final) { if (typeof v === 'string') { set(function (el) { return { outline: Object.assign({}, el.outline || { width: 1 }, { color: v }) }; }, final ? null : 'outlinecolour'); } } }).el));
          outlineBox.push(D.ui.field('Stärke', D.ui.slider({ min: 0.25, max: Math.max(6, Math.round(e.fontSize * 0.25)), step: 0.25, digits: 2, value: e.outline.width, suffix: 'pt', label: 'Konturstärke', disabled: off, onInput: function (v) { set(function (el) { return { outline: Object.assign({}, el.outline || { color: '#000000' }, { width: D.round(v, 2) }) }; }, 'outlinewidth'); } }).el));
        }
        body.appendChild(D.ui.section('Kontur', outlineBox));

        // ---- background box
        var bgOn = D.ui.switchBox({ label: 'Hintergrund', value: !!e.background, disabled: off, onChange: function (v) {
          set(function (el) {
            var c0 = app.brand && app.brand.colors && app.brand.colors.length ? app.brand.colors[0] : '#facc15';
            return v ? { background: { color: c0, radius: unitLen(app, el, 0.2), padding: unitLen(app, el, 0.3) }, color: onColour(c0) } : { background: null };
          });
          draw();
        } });
        var bgBox = [bgOn.el];
        if (e.background) {
          var maxPad = Math.max(2, unitLen(app, e, 1.2));
          var bgSet = function (key, v) { set(function (el) { var b0 = Object.assign({}, el.background || {}); b0[key] = v; return { background: b0 }; }, 'bg' + key); };
          bgBox.push(D.ui.field('Farbe', D.ui.colour({ label: 'Hintergrundfarbe des Textes', disabled: off, get: function () { var x = first(); return x && x.background ? x.background.color : '#ffffff'; }, apply: function (v, final) { if (typeof v === 'string') { set(function (el) { return { background: Object.assign({}, el.background || { radius: 0, padding: 0 }, { color: v }) }; }, final ? null : 'bgcolour'); } } }).el));
          bgBox.push(D.ui.field('Rundung', D.ui.slider({ min: 0, max: maxPad, step: app.unit() === 'px' ? 1 : 0.1, digits: 1, value: e.background.radius, suffix: D.unitLabel(app.unit()), label: 'Rundung des Hintergrunds', disabled: off, onInput: function (v) { bgSet('radius', D.round(v, 2)); } }).el));
          bgBox.push(D.ui.field('Abstand', D.ui.slider({ min: 0, max: maxPad, step: app.unit() === 'px' ? 1 : 0.1, digits: 1, value: e.background.padding, suffix: D.unitLabel(app.unit()), label: 'Abstand des Hintergrunds', disabled: off, onInput: function (v) { bgSet('padding', D.round(v, 2)); } }).el));
        }
        body.appendChild(D.ui.section('Hintergrund', bgBox));

        // ---- curve
        var curve = D.ui.slider({ min: -100, max: 100, step: 1, value: e.curve, label: 'Krümmung', disabled: off, onInput: function (v) { set(function () { return { curve: Math.round(v) }; }, 'curve'); } });
        body.appendChild(D.ui.section('Krümmung', [curve.el, D.el('p', { class: 'dt-hint', text: 'Ein Text auf einem Bogen steht in einer Zeile. 0 ist gerade, 100 ein ganzer Kreis.' })]));
      };
      draw();
      // undo and redo change values behind the controls' back: draw again (not while somebody types)
      api.on('doc', function (ev) { if (ev && ev.reason === 'history' && !host.contains(document.activeElement)) { draw(); } });
    },
  });

  // ================================================================================================ Anpassen

  var LOOKS = [
    ['original', 'Original', { brightness: 0, contrast: 0, saturation: 0, blur: 0, grayscale: false, sepia: false }],
    ['bw', 'Schwarzweiß', { brightness: 0, contrast: 8, saturation: 0, blur: 0, grayscale: true, sepia: false }],
    ['sepia', 'Sepia', { brightness: 0, contrast: 0, saturation: 0, blur: 0, grayscale: false, sepia: true }],
    ['vivid', 'Lebhaft', { brightness: 4, contrast: 14, saturation: 40, blur: 0, grayscale: false, sepia: false }],
    ['matte', 'Matt', { brightness: 6, contrast: -16, saturation: -18, blur: 0, grayscale: false, sepia: false }],
    ['soft', 'Weich', { brightness: 6, contrast: -6, saturation: 0, blur: 1.5, grayscale: false, sepia: false }],
  ];

  function isDefaultFilters(f) { return !f || (!f.brightness && !f.contrast && !f.saturation && !f.blur && !f.grayscale && !f.sepia); }

  D.panels.register({
    id: 'adjust', title: 'Anpassen', icon: 'sliders-horizontal', page: true, needsSelection: true, reselect: true,
    build: function (host, api) {
      var app = api.app;
      var images = app.selected().filter(function (e) { return e.type === 'image'; });
      if (!images.length) { host.appendChild(D.el('p', { class: 'dt-empty', text: 'Wähle ein Bild aus, um es anzupassen.' })); return; }
      var ids = images.map(function (e) { return e.id; });
      var off = !app.editable() || images.every(function (e) { return e.locked; });
      var first = function () { return app.element(ids[0]); };
      var handles = {};

      var setFilters = function (patch, key) {
        app.setProps(ids, function (e) { return { filters: Object.assign({}, e.filters, patch) }; }, { merge: key ? 'adj:' + key + ':' + ids.join(',') : false, mergeMs: 1200 });
      };

      var reset = D.ui.textButton('rotate-ccw', 'Zurücksetzen', function () { setFilters(LOOKS[0][2]); sync(); }, { cls: 'dt-adjust__reset', disabled: off });
      var looks = D.el('div', { class: 'dt-looks', role: 'group', 'aria-label': 'Looks' });
      LOOKS.forEach(function (l) {
        var b = D.el('button', { type: 'button', class: 'dt-chipbtn', 'data-look': l[0], text: l[1], disabled: off });
        b.addEventListener('click', function () { setFilters(l[2]); sync(); });
        looks.appendChild(b);
      });

      var slider = function (key, label, min, max, step, digits, suffix) {
        var h = D.ui.slider({ min: min, max: max, step: step, digits: digits, value: first().filters[key], suffix: suffix || '', label: label, disabled: off, onInput: function (v) { var p = {}; p[key] = D.round(v, 2); setFilters(p, key); updateReset(); } });
        handles[key] = h;
        return D.ui.field(label, h.el);
      };
      var gray = D.ui.switchBox({ label: 'Schwarzweiß', value: first().filters.grayscale, disabled: off, onChange: function (v) { setFilters({ grayscale: v }); updateReset(); } });
      var sepia = D.ui.switchBox({ label: 'Sepia', value: first().filters.sepia, disabled: off, onChange: function (v) { setFilters({ sepia: v }); updateReset(); } });

      host.appendChild(D.ui.section('Looks', [looks]));
      host.appendChild(D.ui.section('Anpassen', [
        slider('brightness', 'Helligkeit', -100, 100, 1, 0), slider('contrast', 'Kontrast', -100, 100, 1, 0), slider('saturation', 'Sättigung', -100, 100, 1, 0), slider('blur', 'Unschärfe', 0, 20, 0.5, 1),
        gray.el, sepia.el,
      ]));
      host.appendChild(D.el('div', { class: 'dt-adjust__foot' }, reset));
      host.appendChild(D.el('p', { class: 'dt-pnote', text: 'Die Anpassungen gelten nur für dieses Bild: das Original bleibt in deinen Uploads unverändert.' }));

      function updateReset() { reset.disabled = off || isDefaultFilters(first().filters); }
      function sync() {
        var e = first();
        if (!e) { return; }
        Object.keys(handles).forEach(function (k) { handles[k].set(e.filters[k]); });
        gray.set(e.filters.grayscale);
        sepia.set(e.filters.sepia);
        updateReset();
      }
      updateReset();
      api.on('doc', function () { sync(); });
    },
  });

  D.effects = { presetPatch: presetPatch, which: which };
})();
