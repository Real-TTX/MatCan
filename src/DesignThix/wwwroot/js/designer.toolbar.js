/* DesignThix editor, part 7: the contextual toolbar above the canvas (#dt-ctx). It shows the controls of what is selected: text, image or frame, shape, line, icon, QR code and
   barcode, image strip, several nodes or a group, and - with nothing selected - the page (background, size). There is no permanent properties panel any more.
   Framework: D.toolbar.register(kind, build) where build(ctx) returns the list of controls (elements or the string 'sep'); a control is made with the helpers of ctx (ctx.button,
   ctx.popoverButton, ctx.colourButton ...) which register a refresh function: while the selection stays the same only the refreshers run (the toolbar never rebuilds under a
   finger that is typing). The toolbar is rebuilt when its signature (selection, types, locked, sources ...) changes. Kinds: page, text, image, strip, shape, line, icon, qr, barcode,
   group, multi. Later phases add controls to a kind with D.toolbar.extend(kind, fn(ctx, controls)). */
(function () {
  'use strict';

  var D = window.DtDesigner;
  var app;
  var host;
  var inner;
  var ctx = null;
  var signature = '';
  var builders = {};
  var extensions = {};
  var override = null;      // a function (ctx) -> controls that replaces the toolbar (crop mode)
  var SIZES = [6, 8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48, 56, 64, 72, 96, 120, 144, 200];

  // ================================================================================================ the context of one build

  function kindOf(els) {
    if (!els.length) { return 'page'; }
    var types = els.map(function (e) { return e.type === 'shape' ? (e.shape === 'line' ? 'line' : 'shape') : e.type; });
    var same = types.every(function (t) { return t === types[0]; });
    if (els.length === 1) {
      var t = types[0];
      return t === 'imageStrip' ? 'strip' : t;
    }
    if (same && (types[0] === 'text' || types[0] === 'shape' || types[0] === 'line' || types[0] === 'icon')) { return types[0]; }
    if (same && types[0] === 'image') { return 'image'; }
    return 'multi';
  }

  function makeContext(els) {
    var ids = els.map(function (e) { return e.id; });
    var kind = kindOf(els);
    var ro = !app.editable();
    var allLocked = els.length > 0 && els.every(function (e) { return e.locked; });
    var c = {
      app: app, ids: ids, els: els, kind: kind, ro: ro, locked: allLocked, disabled: ro || allLocked, refreshers: [],
      first: function () { return ids.length ? app.element(ids[0]) : null; },
      refresh: function (fn) { c.refreshers.push(fn); return fn; },
    };

    /** A toolbar button: options { icon, label, text, title, onClick(button, event), pressed() , disabled, cls, always (works when locked) }. */
    c.button = function (o) {
      var b = D.el('button', { type: 'button', class: 'dt-tb' + (o.text ? ' dt-tb--text' : '') + (o.cls ? ' ' + o.cls : ''), title: o.title || o.label, 'aria-label': o.label || o.text, disabled: o.disabled || (c.disabled && !o.always) });
      if (o.icon) { b.appendChild(D.icon(o.icon)); }
      if (o.text) { b.appendChild(D.el('span', { class: 'dt-tb__text', text: o.text })); }
      if (o.chevron) { b.appendChild(D.icon('chevron-down', 'dt-tb__chev')); }
      b.addEventListener('click', function (ev) { o.onClick(b, ev); });
      if (o.pressed) { var sync = function () { b.setAttribute('aria-pressed', String(!!o.pressed())); }; sync(); c.refresh(sync); }
      return b;
    };

    /** A button that opens a popover: build(el, api) fills it. */
    c.popoverButton = function (o) {
      var b = c.button(Object.assign({}, o, { chevron: o.chevron === undefined ? false : o.chevron, onClick: function (btn) {
        D.popover.open(btn, o.build, { title: o.label, width: o.width, align: o.align });
      } }));
      b.setAttribute('aria-haspopup', 'dialog');
      b.setAttribute('aria-expanded', 'false');
      return b;
    };

    /** A colour button: the swatch shows the value; get(el) and set(el...) are by the caller. options: label, get(), apply(value, final), allowNone, glyph ('A' for text), icon. */
    c.colourButton = function (o) {
      var b = D.el('button', { type: 'button', class: 'dt-tb dt-tb--colour' + (o.text ? ' dt-tb--text' : '') + (o.cls ? ' ' + o.cls : ''), title: o.label, 'aria-label': o.label, 'aria-haspopup': 'dialog', 'aria-expanded': 'false', disabled: c.disabled });
      var chip = D.el('span', { class: 'dt-tb__swatch' });
      var iconWrap = D.el('span', { class: 'dt-tb__ic' });
      if (o.icon) { iconWrap.appendChild(D.icon(o.icon)); }
      if (o.glyph) { iconWrap.appendChild(D.el('span', { class: 'dt-tb__glyph', text: o.glyph })); }
      iconWrap.appendChild(chip);
      b.appendChild(iconWrap);
      if (o.text) { b.appendChild(D.el('span', { class: 'dt-tb__text', text: o.text })); }
      var sync = function () {
        var v = o.get();
        var none = v === null || v === undefined;
        chip.classList.toggle('is-none', none);
        if (typeof v === 'string') { chip.style.setProperty('--dt-swatch', v); chip.style.removeProperty('background-image'); }
        else if (v && typeof v === 'object' && v.stops) { chip.style.setProperty('--dt-swatch', 'transparent'); chip.style.setProperty('background-image', 'linear-gradient(' + v.angle + 'deg, ' + v.stops.map(function (s) { return s.color + ' ' + Math.round(s.offset * 100) + '%'; }).join(', ') + ')'); }
        else { chip.style.setProperty('--dt-swatch', 'transparent'); chip.style.removeProperty('background-image'); }
      };
      sync();
      c.refresh(sync);
      b.addEventListener('click', function () {
        D.colors.open(b, { title: o.label, get: o.get, allowNone: o.allowNone, noneLabel: o.noneLabel, allowGradient: o.allowGradient, onChange: function (v, final) { o.apply(v, final); } });
      });
      return b;
    };

    return c;
  }

  // ================================================================================================ shared patches and controls

  function applyProps(ids, patch, mergeKey, mergeMs) {
    app.setProps(ids, patch, { merge: mergeKey === false ? false : 'tb:' + (mergeKey || 'p') + ':' + ids.join(','), mergeMs: mergeMs || 1200 });
  }

  /** A patch for text elements that also makes the box taller when the new text style needs it (one undo step). */
  function textPatch(patchFn) {
    return function (e) { var p = patchFn(e); return D.canvas.textPatch(e, p); };
  }

  function weightsOf(family) { var f = app.fontIndex.find(function (x) { return x.family === family; }); return f ? f.weights : [400, 700]; }

  function nearest(list, target) { return list.reduce(function (best, w) { return Math.abs(w - target) < Math.abs(best - target) ? w : best; }, list[0]); }

  function toggleBold(ids) {
    var els = ids.map(app.element).filter(Boolean);
    var on = els.every(function (e) { return e.fontWeight >= 600; });
    app.setProps(ids, textPatch(function (e) {
      var ws = weightsOf(e.fontFamily);
      var target = on ? (ws.indexOf(400) >= 0 ? 400 : nearest(ws, 400)) : (ws.filter(function (w) { return w >= 600; }).length ? ws.filter(function (w) { return w >= 600; }).reduce(function (b, w) { return Math.abs(w - 700) < Math.abs(b - 700) ? w : b; }) : 700);
      return { fontWeight: target };
    }), { merge: false });
  }

  function opacityPopover(ctx0) {
    return ctx0.popoverButton({
      icon: 'blend', label: 'Transparenz', width: 260,
      build: function (el) {
        var read = function () { var e = ctx0.first(); return e ? Math.round((e.opacity === undefined ? 1 : e.opacity) * 100) : 100; };
        var slider = D.ui.slider({ min: 0, max: 100, step: 1, value: read(), suffix: '%', label: 'Transparenz', onInput: function (v) { applyProps(ctx0.ids, { opacity: D.round(v / 100, 2) }, 'opacity'); } });
        el.appendChild(D.el('div', { class: 'dt-pop' }, [D.el('h4', { class: 'dt-pop__title', text: 'Transparenz' }), D.el('p', { class: 'dt-hint', text: '100 % ist voll sichtbar, 0 % unsichtbar.' }), slider.el]));
        var sync = function () { slider.set(read()); };
        app.on('doc', sync);
        el._cleanup = function () { app.off('doc', sync); };
      },
    });
  }

  function positionButton(ctx0) {
    return ctx0.button({ icon: 'move', text: 'Position', label: 'Position', title: 'Position, Ausrichtung und Ebenen', cls: 'dt-tb--keeptext', always: false, onClick: function () { D.panels.openPage('position'); } });
  }

  function moreButton(ctx0) {
    return ctx0.button({ icon: 'ellipsis', label: 'Mehr', title: 'Mehr', always: true, onClick: function (b) { D.menu.open(D.contextItems(ctx0.first()), { anchor: b }); } });
  }

  /** The end of every toolbar of an element: Transparenz, Position | Sperren, Duplizieren, Löschen, Mehr. */
  function tail(ctx0, parts) {
    var out = [];
    if (parts && parts.indexOf('opacity') < 0) { /* skipped */ } else { out.push(opacityPopover(ctx0)); }
    out.push(positionButton(ctx0));
    out.push('sep');
    var locked = ctx0.locked;
    out.push(ctx0.button({ icon: locked ? 'lock' : 'lock-open', label: locked ? 'Entsperren' : 'Sperren', always: true, disabled: ctx0.ro, pressed: function () { return ctx0.els.every(function (e) { return e.locked; }); }, onClick: function () { app.toggleLock(ctx0.ids); } }));
    out.push(ctx0.button({ icon: 'copy-plus', label: 'Duplizieren', title: 'Duplizieren (' + D.modKey + '+D)', onClick: function () { D.cmd.duplicate(); } }));
    out.push(ctx0.button({ icon: 'trash', label: 'Löschen', title: 'Löschen (Entf)', onClick: function () { D.cmd.remove(); } }));
    out.push(moreButton(ctx0));
    return out;
  }

  // ================================================================================================ text

  function fontPopover(ctx0, btn) {
    D.popover.open(btn, function (el, api) {
      el.classList.add('dt-fontpop');
      var search = D.el('input', { type: 'search', class: 'mat-input mat-input--sm', placeholder: 'Schrift suchen', 'aria-label': 'Schrift suchen', autocomplete: 'off', spellcheck: 'false' });
      var list = D.el('ul', { class: 'dt-fontlist', role: 'listbox', 'aria-label': 'Schriften' });
      var weightsRow = D.el('div', { class: 'dt-fontpop__weights', role: 'group', 'aria-label': 'Schriftstärke' });
      var current = function () { var e = ctx0.first(); return e ? e.fontFamily : ''; };
      var lazyFonts = 'IntersectionObserver' in window ? new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.isIntersecting) { lazyFonts.unobserve(en.target); en.target.classList.add(en.target.getAttribute('data-ff')); } });
      }, { rootMargin: '100px' }) : null;
      var applyFamily = function (family) {
        var info = app.fontIndex.find(function (x) { return x.family === family; });
        app.setProps(ctx0.ids, textPatch(function (e) {
          var p = { fontFamily: family };
          if (info && info.weights.indexOf(e.fontWeight) < 0) { p.fontWeight = nearest(info.weights, e.fontWeight); }
          return p;
        }), { merge: false });
        draw();
      };
      var draw = function () {
        var q = D.lower(search.value).trim();
        D.empty(list);
        var brandRoles = [['heading', 'Überschrift'], ['subheading', 'Zwischenüberschrift'], ['body', 'Fließtext']];
        var brandFonts = app.brand && app.brand.fonts ? brandRoles.filter(function (r) { return app.brand.fonts[r[0]] && app.fontIndex.some(function (f) { return f.family === app.brand.fonts[r[0]]; }); }) : [];
        var add = function (family, note) {
          var li = D.el('li', { role: 'presentation' });
          var b = D.el('button', { type: 'button', class: 'dt-fontlist__item', role: 'option', 'aria-selected': String(family === current()), 'data-family': family });
          // the line is set in its own font only when it comes into view: a list of 50 families does not load 50 font files at once
          var nameEl = D.el('span', { class: 'dt-fontlist__name', 'data-ff': D.fontClass(family), text: family });
          if (lazyFonts) { lazyFonts.observe(nameEl); } else { nameEl.classList.add(nameEl.getAttribute('data-ff')); }
          b.appendChild(nameEl);
          if (note) { b.appendChild(D.el('span', { class: 'dt-fontlist__note', text: note })); }
          b.addEventListener('click', function () { applyFamily(family); });
          li.appendChild(b);
          list.appendChild(li);
        };
        if (!q && brandFonts.length) {
          list.appendChild(D.el('li', { class: 'dt-fontlist__head', role: 'presentation', text: 'Marke' }));
          brandFonts.forEach(function (r) { add(app.brand.fonts[r[0]], r[1]); });
          list.appendChild(D.el('li', { class: 'dt-fontlist__head', role: 'presentation', text: 'Alle Schriften' }));
        }
        var shown = app.fontIndex.filter(function (f) { return !q || D.lower(f.family).indexOf(q) >= 0; });
        shown.forEach(function (f) { add(f.family); });
        if (!shown.length) { list.appendChild(D.el('li', { class: 'dt-fontlist__head', text: 'Keine Schrift gefunden.' })); }
        D.empty(weightsRow);
        var info = app.fontIndex.find(function (x) { return x.family === current(); });
        if (info && info.weights.length > 1) {
          var e0 = ctx0.first();
          info.weights.forEach(function (w) {
            var wb = D.el('button', { type: 'button', class: 'dt-chipbtn', text: D.WEIGHT_NAMES[w] || String(w), 'aria-pressed': String(e0 && e0.fontWeight === w) });
            wb.addEventListener('click', function () { app.setProps(ctx0.ids, textPatch(function () { return { fontWeight: w }; }), { merge: false }); draw(); });
            weightsRow.appendChild(wb);
          });
        }
      };
      search.addEventListener('input', draw);
      search.addEventListener('keydown', function (ev) {
        ev.stopPropagation();
        if (ev.key === 'ArrowDown') { ev.preventDefault(); var f = D.$('.dt-fontlist__item', list); if (f) { f.focus(); } }
        if (ev.key === 'Enter') { var first = D.$('.dt-fontlist__item', list); if (first) { first.click(); } }
      });
      list.addEventListener('keydown', function (ev) {
        if (ev.key !== 'ArrowDown' && ev.key !== 'ArrowUp') { return; }
        ev.preventDefault();
        var items = D.$$('.dt-fontlist__item', list);
        var i = items.indexOf(document.activeElement);
        var next = items[D.clamp(i + (ev.key === 'ArrowDown' ? 1 : -1), 0, items.length - 1)];
        if (next) { next.focus(); }
      });
      var upload = app.canEdit ? D.ui.textButton('upload', 'Schrift hochladen', function () { api.close(false); D.io.pickFontFiles(ctx0.ids); }, { cls: 'dt-fontpop__upload' }) : null;
      el.appendChild(D.el('div', { class: 'dt-fontpop__top' }, search));
      el.appendChild(list);
      el.appendChild(weightsRow);
      var foot = D.el('div', { class: 'dt-fontpop__foot' });
      if (upload) { foot.appendChild(upload); }
      el.appendChild(foot);
      // "Weitere Schriften": only when the administrator switched the catalogue of fonts on
      if (app.canEdit && window.DtFontsMore) {
        window.DtFontsMore.available().then(function (yes) {
          if (!yes || !document.contains(foot)) { return; }
          foot.appendChild(D.ui.textButton('plus', 'Weitere Schriften …', function () { api.close(false); D.io.moreFonts(ctx0.ids); }, { cls: 'dt-fontpop__more', title: 'Freie Schriften aus Google Fonts hinzufügen' }));
        });
      }
      draw();
      var active = D.$('.dt-fontlist__item[aria-selected="true"]', list);
      if (active && active.scrollIntoView) { active.scrollIntoView({ block: 'center' }); }
    }, { title: 'Schrift', width: 300, keepEdit: false });
  }

  function textSpacingPopover(ctx0) {
    return ctx0.popoverButton({
      icon: 'text-wrap', text: 'Abstand', label: 'Abstand und Textfeld', title: 'Zeilenhöhe, Zeichenabstand, Textfeld', width: 300,
      build: function (el) {
        var e0 = ctx0.first();
        var one = function (key, label, o) {
          var h = D.ui.number({ value: e0[key], min: o.min, max: o.max, step: o.step, digits: o.digits, suffix: o.suffix, label: label,
            onInput: function (v) { app.setProps(ctx0.ids, textPatch(function () { var p = {}; p[key] = D.round(v, o.digits); return p; }), { merge: 'tb:' + key + ':' + ctx0.ids.join(','), mergeMs: 1200 }); } });
          return D.ui.field(label, h.el);
        };
        var valign = D.ui.segmented({ label: 'Senkrechte Ausrichtung', value: e0.valign, options: [{ value: 'top', icon: 'align-start-horizontal', title: 'Oben' }, { value: 'middle', icon: 'align-center-horizontal', title: 'Mitte' }, { value: 'bottom', icon: 'align-end-horizontal', title: 'Unten' }], onChange: function (v) { applyProps(ctx0.ids, { valign: v }, false); valign.set(v); } });
        var wrap = D.ui.switchBox({ label: 'Zeilenumbruch', value: e0.wrap, onChange: function (v) { app.setProps(ctx0.ids, textPatch(function () { return { wrap: v }; }), { merge: false }); } });
        var fitSel = D.ui.select({ label: 'Passend machen', value: e0.fit, items: [['none', 'Nicht verkleinern'], ['shrink', 'Verkleinern, bis es passt']], onChange: function (v) { applyProps(ctx0.ids, { fit: v }, false); minField.hidden = v !== 'shrink'; } });
        var minInput = D.ui.number({ value: e0.minFontSize, min: 0.5, max: 1000, step: 0.5, digits: 2, suffix: 'pt', label: 'Kleinste Größe', onInput: function (v) { applyProps(ctx0.ids, { minFontSize: D.round(v, 2) }, 'minfont'); } });
        var minField = D.ui.field('Kleinste Größe', minInput.el);
        minField.hidden = e0.fit !== 'shrink';
        el.appendChild(D.el('div', { class: 'dt-pop' }, [
          D.el('h4', { class: 'dt-pop__title', text: 'Abstand und Textfeld' }),
          D.el('div', { class: 'dt-grid2' }, [one('lineHeight', 'Zeilenhöhe', { min: 0.5, max: 3, step: 0.05, digits: 2 }), one('letterSpacing', 'Zeichenabstand', { min: -0.5, max: 2, step: 0.01, digits: 3, suffix: 'em' })]),
          D.ui.field('Senkrecht im Textfeld', valign.el), wrap.el,
          D.ui.field('Passend machen', fitSel.el), minField,
          D.el('p', { class: 'dt-hint', text: '„Verkleinern, bis es passt“ ist für Felder aus Datenlisten gedacht: ein langer Name wird kleiner statt abgeschnitten.' }),
        ]));
      },
    });
  }

  builders.text = function (c) {
    var out = [];
    var famLabel = D.el('span', { class: 'dt-tb__fontname' });
    var famBtn = c.button({ label: 'Schrift', title: 'Schrift wählen', cls: 'dt-tb--font', chevron: true, onClick: function (b) { fontPopover(c, b); } });
    famBtn.insertBefore(famLabel, famBtn.firstChild);
    famBtn.setAttribute('aria-haspopup', 'dialog');
    var syncFam = function () { var e = c.first(); if (!e) { return; } famLabel.textContent = e.fontFamily; famLabel.className = 'dt-tb__fontname ' + D.fontClass(e.fontFamily); };
    syncFam();
    c.refresh(syncFam);
    out.push(famBtn);

    var size = D.ui.number({ value: c.first().fontSize, min: 1, max: 1000, step: 1, digits: 1, label: 'Schriftgröße',
      onInput: function (v) { app.setProps(c.ids, textPatch(function () { return { fontSize: D.round(v, 2) }; }), { merge: 'tb:size:' + c.ids.join(','), mergeMs: 1000 }); } });
    size.input.setAttribute('list', 'dt-sizes');
    size.input.disabled = c.disabled;
    var step = function (dir) {
      var e = c.first();
      var next = dir > 0 ? SIZES.find(function (s) { return s > e.fontSize + 0.01; }) : SIZES.slice().reverse().find(function (s) { return s < e.fontSize - 0.01; });
      next = next || Math.max(1, e.fontSize + dir);
      app.setProps(c.ids, textPatch(function () { return { fontSize: next }; }), { merge: false });
    };
    var minus = D.ui.iconButton('minus', 'Schrift verkleinern', function () { step(-1); }, { cls: 'dt-tb dt-tb--sq', disabled: c.disabled });
    var plus = D.ui.iconButton('plus', 'Schrift vergrößern', function () { step(1); }, { cls: 'dt-tb dt-tb--sq', disabled: c.disabled });
    var sizeGroup = D.el('div', { class: 'dt-tb__size', role: 'group', 'aria-label': 'Schriftgröße' }, [minus, size.el, plus]);
    c.refresh(function () { var e = c.first(); if (e) { size.set(e.fontSize); } });
    out.push(sizeGroup);

    out.push(c.colourButton({ label: 'Textfarbe', glyph: 'A', get: function () { var e = c.first(); return e ? e.color : '#000000'; }, apply: function (v, final) { if (typeof v === 'string') { applyProps(c.ids, { color: v }, final ? false : 'colour', 1500); } } }));
    out.push('sep');
    out.push(c.button({ icon: 'bold', label: 'Fett', title: 'Fett (' + D.modKey + '+B)', pressed: function () { var e = c.first(); return e && e.fontWeight >= 600; }, onClick: function () { toggleBold(c.ids); } }));
    out.push(c.button({ icon: 'italic', label: 'Kursiv', title: 'Kursiv (' + D.modKey + '+I)', pressed: function () { var e = c.first(); return e && e.italic; }, onClick: function () { app.setProps(c.ids, textPatch(function (e) { return { italic: !c.first().italic }; }), { merge: false }); } }));
    out.push(c.button({ icon: 'underline', label: 'Unterstrichen', title: 'Unterstrichen (' + D.modKey + '+U)', pressed: function () { var e = c.first(); return e && e.underline; }, onClick: function () { var on = !c.first().underline; applyProps(c.ids, { underline: on }, false); } }));
    out.push(c.button({ icon: 'strikethrough', label: 'Durchgestrichen', title: 'Durchgestrichen', pressed: function () { var e = c.first(); return e && e.strike; }, onClick: function () { var on = !c.first().strike; applyProps(c.ids, { strike: on }, false); } }));
    out.push('sep');
    var alignIcons = { left: 'text-align-start', center: 'text-align-center', right: 'text-align-end' };
    var alignNames = { left: 'Linksbündig', center: 'Zentriert', right: 'Rechtsbündig' };
    var alignBtn = c.button({ icon: 'text-align-start', label: 'Ausrichtung', title: 'Ausrichtung ändern', onClick: function () {
      var order = ['left', 'center', 'right'];
      var next = order[(order.indexOf(c.first().align) + 1) % 3];
      applyProps(c.ids, { align: next }, false);
    } });
    c.refresh(function () {
      var e = c.first();
      if (!e) { return; }
      var use = alignBtn.querySelector('use');
      if (use) { use.setAttribute('href', '#dt-i-' + alignIcons[e.align]); }
      alignBtn.title = alignNames[e.align] + ' (klicken zum Wechseln)';
    });
    out.push(alignBtn);
    out.push(c.button({ icon: 'case-upper', label: 'Großbuchstaben', title: 'Großbuchstaben (aA)', pressed: function () { var e = c.first(); return e && e.uppercase; }, onClick: function () { var on = !c.first().uppercase; app.setProps(c.ids, textPatch(function () { return { uppercase: on }; }), { merge: false }); } }));
    out.push(D.tbp.list(c));
    out.push(textSpacingPopover(c));
    out.push('sep');
    out.push(D.tbp.effects(c));
    out.push('sep');
    return out.concat(tail(c));
  };

  // ================================================================================================ images

  function fitPopover(c) {
    return c.popoverButton({
      icon: 'expand', text: 'Einpassen', label: 'Einpassen', title: 'Wie das Bild in den Rahmen passt', width: 280,
      build: function (el) {
        var e0 = c.first();
        var fit = D.ui.segmented({ label: 'Einpassen', value: e0.fit, options: [{ value: 'contain', label: 'Ganz zeigen' }, { value: 'cover', label: 'Füllen' }, { value: 'fill', label: 'Strecken' }], onChange: function (v) { applyProps(c.ids, { fit: v }, false); fit.set(v); } });
        el.appendChild(D.el('div', { class: 'dt-pop' }, [D.el('h4', { class: 'dt-pop__title', text: 'Einpassen' }), D.ui.field('Das Bild im Rahmen', fit.el)]));
      },
    });
  }

  builders.image = function (c) {
    var out = [];
    var e0 = c.first();
    var multi = c.els.length > 1;
    if (!multi) {
      out.push(c.button({ icon: 'replace', text: e0.source ? 'Ersetzen' : 'Bild wählen', label: e0.source ? 'Bild ersetzen' : 'Bild wählen', title: e0.source ? 'Bild ersetzen' : 'Ein Bild aus den Uploads wählen', cls: e0.source ? '' : 'dt-tb--accent', onClick: function () { D.cmd.replaceImage(); } }));
      if (D.cmd.canCrop() && e0.source) { out.push(c.button({ icon: 'crop', text: 'Zuschneiden', label: 'Zuschneiden', title: 'Zuschneiden (Doppelklick)', cls: 'dt-tb--keeptext', onClick: function () { D.cmd.crop(); } })); }
      out.push('sep');
    }
    out.push(D.tbp.flip(c));
    if (c.els.every(function (e) { return !!e.source; })) { out.push(D.tbp.adjust(c)); }
    out.push(D.tbp.mask(c));
    out.push(fitPopover(c));
    out.push('sep');
    out.push(D.tbp.borderColour(c));
    out.push(D.tbp.borderWidth(c));
    out.push(D.tbp.corners(c));
    if (!multi && e0.source && e0.source.asset) {
      out.push(c.button({ icon: 'image-down', text: 'Als Hintergrund', label: 'Als Hintergrund festlegen', title: 'Das Bild wird der Hintergrund der Seite', onClick: function () { D.cmd.setAsBackground(); } }));
    }
    out.push('sep');
    return out.concat(tail(c));
  };

  // ================================================================================================ image strip

  function moveSlot(id, from, to) {
    var list = app.element(id).items.slice();
    if (to < 0 || to >= list.length) { return; }
    var it = list.splice(from, 1)[0];
    list.splice(to, 0, it);
    app.setProps([id], { items: list }, { merge: false });
  }

  function slotMenu(c, e, index) {
    var items = [{ label: 'Bild wählen …', icon: 'replace', run: function () { D.cmd.replaceImage(index); } }];
    var imageFields = app.doc.fields.filter(function (f) { return f.type === 'image'; });
    var bind = imageFields.map(function (f) { return { label: f.label && f.label !== f.key ? f.key + ' – ' + f.label : f.key, icon: 'braces', checked: !!(e.items[index] && e.items[index].field && D.lower(e.items[index].field) === D.lower(f.key)), run: function () { D.cmd.bindField(e.id, f.key, index); } }; });
    if (bind.length) { bind.push({ type: 'separator' }); }
    bind.push({ label: 'Neues Bildfeld …', icon: 'plus', run: function () { D.cmd.bindField(e.id, null, index); } });
    items.push({ label: 'An Feld binden (Zusatz)', icon: 'braces', submenu: bind });
    items.push({ type: 'separator' });
    items.push({ label: 'Nach links', icon: 'arrow-left', disabled: index < 1 ? 'Der Platz ist schon der erste.' : false, run: function () { moveSlot(e.id, index, index - 1); } });
    items.push({ label: 'Nach rechts', icon: 'arrow-right', disabled: index >= e.items.length - 1 ? 'Der Platz ist schon der letzte.' : false, run: function () { moveSlot(e.id, index, index + 1); } });
    items.push({ type: 'separator' });
    items.push({ label: 'Platz leeren', icon: 'x', disabled: e.items[index] ? false : 'Der Platz ist schon leer.', run: function () { var list = app.element(e.id).items.slice(); list[index] = null; app.setProps([e.id], { items: list }, { merge: false }); } });
    items.push({ label: 'Platz entfernen', icon: 'trash', danger: true, disabled: e.items.length < 2 ? 'Eine Bildleiste braucht mindestens einen Platz.' : false, run: function () { var list = app.element(e.id).items.slice(); list.splice(index, 1); app.setProps([e.id], { items: list }, { merge: false }); } });
    return items;
  }

  builders.strip = function (c) {
    var e0 = c.first();
    var out = [];
    var chips = D.el('div', { class: 'dt-slotchips', role: 'group', 'aria-label': 'Plätze der Bildleiste' });
    e0.items.forEach(function (item, index) {
      var thumb = D.el('button', { type: 'button', class: 'dt-slotchip' + (item ? '' : ' is-empty'), title: 'Platz ' + (index + 1) + ': ' + (item ? (item.asset ? item.asset : '{{' + item.field + '}}') : 'leer') + ' – Bild wählen', 'aria-label': 'Platz ' + (index + 1) + ' wählen', disabled: c.disabled, 'data-slot': index });
      if (item && item.asset) {
        var asset = app.assetByKey(item.asset);
        thumb.appendChild(D.el('img', { src: asset ? asset.url : '/media/' + encodeURIComponent(item.asset), alt: '', draggable: 'false' }));
      } else if (item && item.field) {
        thumb.appendChild(D.icon('braces'));
        thumb.classList.add('is-field');
      } else { thumb.appendChild(D.icon('plus')); }
      thumb.addEventListener('click', function () { D.cmd.replaceImage(index); });
      var more = D.el('button', { type: 'button', class: 'dt-slotchip__more', title: 'Platz ' + (index + 1) + ': mehr', 'aria-label': 'Platz ' + (index + 1) + ': mehr', disabled: c.ro }, D.icon('ellipsis'));
      more.addEventListener('click', function () { D.menu.open(slotMenu(c, app.element(e0.id), index), { anchor: more }); });
      chips.appendChild(D.el('span', { class: 'dt-slot' }, [thumb, more]));
    });
    out.push(chips);
    out.push(c.button({ icon: 'plus', label: 'Platz hinzufügen', title: 'Platz hinzufügen', disabled: e0.items.length >= 12, onClick: function () { var list = app.element(e0.id).items.slice(); list.push(null); app.setProps([e0.id], { items: list }, { merge: false }); } }));
    out.push('sep');
    out.push(c.popoverButton({
      icon: 'move-horizontal', text: 'Abstand', label: 'Abstand und Ausrichtung', width: 280,
      build: function (el) {
        var gap = D.ui.number({ value: c.first().gap, min: 0, step: app.unit() === 'px' ? 1 : 0.5, digits: 2, suffix: D.unitLabel(app.unit()), label: 'Abstand', onInput: function (v) { applyProps(c.ids, { gap: D.round(v, 2) }, 'gap'); } });
        var align = D.ui.segmented({ label: 'Ausrichtung', value: c.first().align, options: [{ value: 'left', icon: 'text-align-start', title: 'Links' }, { value: 'center', icon: 'text-align-center', title: 'Mitte' }, { value: 'right', icon: 'text-align-end', title: 'Rechts' }], onChange: function (v) { applyProps(c.ids, { align: v }, false); align.set(v); } });
        el.appendChild(D.el('div', { class: 'dt-pop' }, [D.el('h4', { class: 'dt-pop__title', text: 'Abstand und Ausrichtung' }), D.ui.field('Abstand', gap.el), D.ui.field('Ausrichtung', align.el), D.el('p', { class: 'dt-hint', text: 'Leere Plätze rücken auf: die übrigen Bilder wandern nach links (oder zur Mitte, zum rechten Rand).' })]));
      },
    }));
    out.push(D.tbp.mask(c));
    out.push(D.tbp.borderColour(c));
    out.push(D.tbp.borderWidth(c));
    out.push('sep');
    return out.concat(tail(c));
  };

  // ================================================================================================ shapes, lines, icons

  function strokePopover(c, isLine) {
    return c.popoverButton({
      icon: 'minus', text: isLine ? 'Linie' : 'Rand', label: isLine ? 'Linienstärke und -art' : 'Randstärke und -art', width: 280,
      build: function (el) {
        var e0 = c.first();
        var width = D.ui.number({ value: e0.strokeWidth, min: 0, max: 1000, step: 0.25, digits: 2, suffix: 'pt', label: 'Stärke', onInput: function (v) { applyProps(c.ids, { strokeWidth: D.round(v, 2) }, 'sw'); } });
        var dash = D.ui.segmented({ label: 'Linienart', value: e0.dash, options: [{ value: 'solid', label: 'Durchgezogen' }, { value: 'dashed', label: 'Gestrichelt' }, { value: 'dotted', label: 'Gepunktet' }], onChange: function (v) { applyProps(c.ids, { dash: v }, false); dash.set(v); } });
        el.appendChild(D.el('div', { class: 'dt-pop' }, [D.el('h4', { class: 'dt-pop__title', text: isLine ? 'Linie' : 'Rand' }), D.ui.field('Stärke', width.el), D.ui.field('Art', dash.el)]));
      },
    });
  }

  builders.shape = function (c) {
    var out = [];
    out.push(c.colourButton({ icon: 'paint-bucket', text: 'Füllung', label: 'Füllung', cls: 'dt-tb--keeptext', allowNone: true, allowGradient: true, noneLabel: 'Keine Füllung', get: function () { var e = c.first(); return e ? e.fill : null; }, apply: function (v, final) { applyProps(c.ids, { fill: v }, final ? false : 'fill', 1500); } }));
    out.push(c.colourButton({ icon: 'square-dashed', label: 'Randfarbe', allowNone: true, noneLabel: 'Kein Rand', get: function () { var e = c.first(); return e ? e.stroke : null; }, apply: function (v, final) { if (v === null || typeof v === 'string') { applyProps(c.ids, v === null ? { stroke: null } : { stroke: v, strokeWidth: Math.max(c.first().strokeWidth, 0.5) }, final ? false : 'stroke', 1500); } } }));
    out.push(strokePopover(c, false));
    if (c.els.every(function (e) { return e.shape === 'rect'; })) {
      out.push(c.popoverButton({
        icon: 'square-round-corner', label: 'Ecken', title: 'Eckenradius', width: 260,
        build: function (el) {
          var max = D.round(Math.min(c.first().w, c.first().h) / 2, 2);
          var slider = D.ui.slider({ min: 0, max: Math.max(max, 1), step: 0.5, digits: 1, value: c.first().radius, suffix: D.unitLabel(app.unit()), label: 'Eckenradius', onInput: function (v) { applyProps(c.ids, { radius: D.round(v, 2) }, 'radius'); } });
          el.appendChild(D.el('div', { class: 'dt-pop' }, [D.el('h4', { class: 'dt-pop__title', text: 'Ecken' }), slider.el]));
        },
      }));
    }
    out.push(D.tbp.shapeKind(c));
    out.push(c.button({ icon: 'arrow-left-right', label: 'Spiegeln', title: 'Horizontal spiegeln', onClick: function () { app.flip('x'); } }));
    out.push('sep');
    return out.concat(tail(c));
  };

  builders.line = function (c) {
    var out = [];
    out.push(c.colourButton({ icon: 'paintbrush', label: 'Linienfarbe', get: function () { var e = c.first(); return e ? e.stroke : '#000000'; }, apply: function (v, final) { if (typeof v === 'string') { applyProps(c.ids, { stroke: v }, final ? false : 'stroke', 1500); } } }));
    out.push(strokePopover(c, true));
    out.push(D.tbp.lineEnds(c));
    out.push('sep');
    return out.concat(tail(c, ['opacity']));
  };

  builders.icon = function (c) {
    var out = [];
    out.push(c.colourButton({ icon: 'paintbrush', label: 'Iconfarbe', get: function () { var e = c.first(); return e ? e.color : '#000000'; }, apply: function (v, final) { if (typeof v === 'string') { applyProps(c.ids, { color: v }, final ? false : 'colour', 1500); } } }));
    out.push(c.popoverButton({
      icon: 'minus', text: 'Strichstärke', label: 'Strichstärke', width: 260,
      build: function (el) {
        var slider = D.ui.slider({ min: 0.5, max: 4, step: 0.25, digits: 2, value: c.first().strokeWidth, label: 'Strichstärke', onInput: function (v) { applyProps(c.ids, { strokeWidth: D.round(v, 2) }, 'sw'); } });
        el.appendChild(D.el('div', { class: 'dt-pop' }, [D.el('h4', { class: 'dt-pop__title', text: 'Strichstärke' }), slider.el]));
      },
    }));
    if (c.els.length === 1) { out.push(D.tbp.iconReplace(c)); }
    out.push('sep');
    return out.concat(tail(c));
  };

  // ================================================================================================ codes

  function codeStatus(e) {
    var resolved = window.DtEngine.resolveText(e.value, app.doc.fields, app.values || {}, app.doc.locale, 'empty');
    if (e.type === 'qr') {
      if (!resolved.trim()) { return 'Der QR-Code braucht einen Inhalt.'; }
      var q = window.DtEngine.qrEncode(resolved, e.ecc);
      return q.ok ? '' : q.reason;
    }
    var b = window.DtEngine.barcodeInfo(e.format, resolved);
    return b.ok ? '' : b.reason;
  }

  function codeControls(c) {
    var e0 = c.first();
    var out = [];
    var input = D.el('input', { type: 'text', class: 'mat-input mat-input--sm dt-tb__input', 'aria-label': e0.type === 'qr' ? 'Inhalt des QR-Codes' : 'Wert des Barcodes', placeholder: e0.type === 'qr' ? 'Link oder Text' : 'Zahl oder Text', maxlength: e0.type === 'qr' ? 1000 : 80, disabled: c.disabled, autocomplete: 'off', spellcheck: 'false' });
    input.value = e0.value;
    input.addEventListener('input', function () { applyProps(c.ids, { value: input.value }, 'codevalue'); });
    input.addEventListener('keydown', function (ev) { ev.stopPropagation(); if (ev.key === 'Enter') { input.blur(); } });
    c.refresh(function () { var e = c.first(); if (e && document.activeElement !== input && input.value !== e.value) { input.value = e.value; } });
    out.push(input);
    var status = D.el('span', { class: 'dt-tb__status', role: 'status' });
    var sync = function () { var e = c.first(); var msg = e ? codeStatus(e) : ''; status.textContent = msg; status.hidden = !msg; input.classList.toggle('is-invalid', !!msg); input.title = msg || ''; };
    sync();
    c.refresh(sync);
    out.push(status);
    var fieldItems = D.fieldBindingMenu(e0);
    if (fieldItems) { out.push(c.button({ icon: 'braces', label: 'Feld einfügen', title: 'Platzhalter eines Feldes einfügen (Zusatz)', onClick: function (b) { D.menu.open(fieldItems.submenu, { anchor: b }); } })); }
    out.push('sep');
    if (e0.type === 'barcode') {
      var formats = [['ean13', 'EAN-13'], ['ean8', 'EAN-8'], ['code128', 'Code 128']];
      var fb = c.button({ icon: 'barcode', text: 'EAN-13', label: 'Format', chevron: true, onClick: function (b) {
        D.menu.open(formats.map(function (f) { return { label: f[1], checked: c.first().format === f[0], run: function () { applyProps(c.ids, { format: f[0] }, false); } }; }), { anchor: b });
      } });
      c.refresh(function () { var e = c.first(); if (e) { fb.querySelector('.dt-tb__text').textContent = formats.find(function (f) { return f[0] === e.format; })[1]; } });
      fb.querySelector('.dt-tb__text').textContent = formats.find(function (f) { return f[0] === e0.format; })[1];
      out.push(fb);
      out.push(c.button({ icon: 'type', label: 'Zahlen unter dem Code', title: 'Zahlen unter dem Code zeigen', pressed: function () { var e = c.first(); return e && e.showText; }, onClick: function () { applyProps(c.ids, { showText: !c.first().showText }, false); } }));
    } else {
      var eccs = [['L', 'Niedrig (L)'], ['M', 'Mittel (M)'], ['Q', 'Hoch (Q)'], ['H', 'Sehr hoch (H)']];
      out.push(c.button({ icon: 'shapes', text: 'Fehlerkorrektur', label: 'Fehlerkorrektur', chevron: true, onClick: function (b) {
        D.menu.open(eccs.map(function (f) { return { label: f[1], checked: c.first().ecc === f[0], run: function () { applyProps(c.ids, { ecc: f[0] }, false); } }; }), { anchor: b });
      } }));
      out.push(c.button({ icon: 'square-dashed', text: 'Rand', label: 'Freier Rand um den Code', title: 'Ruhezone: ein freier Rand um den Code (macht ihn besser lesbar)', pressed: function () { var e = c.first(); return e && e.quiet; }, onClick: function () { applyProps(c.ids, { quiet: !c.first().quiet }, false); } }));
    }
    out.push(c.colourButton({ icon: 'paintbrush', label: 'Farbe', get: function () { var e = c.first(); return e ? e.color : '#000000'; }, apply: function (v, final) { if (typeof v === 'string') { applyProps(c.ids, { color: v }, final ? false : 'colour', 1500); } } }));
    out.push(c.colourButton({ icon: 'paint-bucket', label: 'Hintergrund des Codes', allowNone: true, noneLabel: 'Transparent', get: function () { var e = c.first(); return e ? e.background : '#ffffff'; }, apply: function (v, final) { if (v === null || typeof v === 'string') { applyProps(c.ids, { background: v }, final ? false : 'codebg', 1500); } } }));
    out.push('sep');
    return out;
  }

  builders.qr = function (c) { return codeControls(c).concat(tail(c)); };
  builders.barcode = function (c) { return codeControls(c).concat(tail(c)); };

  // ================================================================================================ several, groups

  builders.group = function (c) { return builders.multi(c); };

  /** Gruppieren / aufheben, Ausrichten, Verteilen: for several nodes of any kind (the head of the toolbar of two texts or two shapes, the whole toolbar of mixed nodes). */
  function multiControls(c, compact) {
    var out = [];
    var canGroup = app.canGroup();
    var hasGroup = app.canUngroup();
    if (hasGroup && c.els.length === 1) {
      out.push(c.button({ icon: 'ungroup', text: 'Gruppierung aufheben', label: 'Gruppierung aufheben', title: 'Gruppierung aufheben (' + D.modKey + '+⇧+G)', onClick: function () { D.cmd.ungroup(); } }));
    } else {
      out.push(c.button({ icon: 'group', text: compact ? null : 'Gruppieren', label: 'Gruppieren', title: 'Gruppieren (' + D.modKey + '+G)', disabled: !canGroup, onClick: function () { D.cmd.group(); } }));
      if (hasGroup) { out.push(c.button({ icon: 'ungroup', label: 'Gruppierung aufheben', title: 'Gruppierung aufheben (' + D.modKey + '+⇧+G)', onClick: function () { D.cmd.ungroup(); } })); }
    }
    out.push('sep');
    out.push(c.button({ icon: 'align-center-vertical', text: compact ? null : 'Ausrichten', label: 'Ausrichten', chevron: true, onClick: function (b) {
      var alignAt = function (mode) { return function () { app.align(mode, c.els.length === 1); }; };
      var items = [
        { label: c.els.length > 1 ? 'Links (aneinander)' : 'Links', icon: 'align-start-vertical', run: alignAt('left') },
        { label: 'Zentriert', icon: 'align-center-vertical', run: alignAt('centre') },
        { label: 'Rechts', icon: 'align-end-vertical', run: alignAt('right') },
        { label: 'Oben', icon: 'align-start-horizontal', run: alignAt('top') },
        { label: 'Mitte', icon: 'align-center-horizontal', run: alignAt('middle') },
        { label: 'Unten', icon: 'align-end-horizontal', run: alignAt('bottom') },
      ];
      if (c.els.length > 1) {
        items.push({ type: 'separator' });
        items.push({ label: 'Horizontal verteilen', icon: 'align-horizontal-space-between', disabled: c.els.length < 3 ? 'Verteilen geht ab drei Elementen.' : false, run: function () { app.distribute('x'); } });
        items.push({ label: 'Vertikal verteilen', icon: 'align-vertical-space-between', disabled: c.els.length < 3 ? 'Verteilen geht ab drei Elementen.' : false, run: function () { app.distribute('y'); } });
      }
      D.menu.open(items, { anchor: b });
    } }));
    if (c.els.length > 1) {
      out.push(c.button({ icon: 'align-horizontal-space-between', text: compact ? null : 'Verteilen', label: 'Verteilen', chevron: true, disabled: c.els.length < 3, title: c.els.length < 3 ? 'Verteilen geht ab drei Elementen.' : 'Gleiche Abstände', onClick: function (b) {
        D.menu.open([
          { label: 'Horizontal verteilen', icon: 'align-horizontal-space-between', run: function () { app.distribute('x'); } },
          { label: 'Vertikal verteilen', icon: 'align-vertical-space-between', run: function () { app.distribute('y'); } },
        ], { anchor: b });
      } }));
    }
    return out;
  }

  builders.multi = function (c) { return multiControls(c, false).concat(['sep'], tail(c)); };

  // ================================================================================================ the page

  var pageBgButton = null;

  builders.page = function (c) {
    var out = [];
    if (c.ro) { out.push(D.el('span', { class: 'dt-tb__note', text: D.roText() })); return out; }
    pageBgButton = c.colourButton({ icon: 'palette', text: 'Hintergrund', label: 'Hintergrundfarbe', allowGradient: true, get: function () { var bg = app.page().background; return bg.gradient || bg.color; }, apply: function (v, final) {
      if (typeof v === 'string') { app.setBackground({ color: v, gradient: null }, { merge: final ? false : 'bgcolor' }); }
      else if (v && typeof v === 'object') { app.setBackground({ gradient: v }, { merge: final ? false : 'bggradient' }); }
    } });
    out.push(pageBgButton);
    out.push(c.button({ icon: 'image', text: 'Bild', label: 'Hintergrundbild', title: 'Hintergrundbild wählen', onClick: function () { D.cmd.pickBackgroundImage(); } }));
    var remove = c.button({ icon: 'x', label: 'Hintergrundbild entfernen', onClick: function () { D.cmd.removeBackgroundImage(); } });
    var fitSel = c.popoverButton({ icon: 'expand', label: 'Einpassen', title: 'Hintergrundbild einpassen', width: 260, build: function (el) {
      var fit = D.ui.segmented({ label: 'Bild einpassen', value: app.page().background.fit, options: [{ value: 'cover', label: 'Füllen' }, { value: 'contain', label: 'Ganz zeigen' }, { value: 'fill', label: 'Strecken' }], onChange: function (v) { app.setBackground({ fit: v }, { merge: false }); fit.set(v); } });
      el.appendChild(D.el('div', { class: 'dt-pop' }, [D.el('h4', { class: 'dt-pop__title', text: 'Hintergrundbild einpassen' }), fit.el]));
    } });
    var syncBg = function () { var has = !!app.page().background.asset; remove.hidden = !has; fitSel.hidden = !has; };
    syncBg();
    c.refresh(syncBg);
    out.push(remove);
    out.push(fitSel);
    out.push('sep');
    out.push(c.button({ icon: 'scaling', text: 'Größe ändern', label: 'Größe ändern', title: 'Format der Seite ändern', always: true, onClick: function () { D.file.resizeDialog(); } }));
    return out;
  };

  // ================================================================================================ build / refresh

  function sigOf(els) {
    return JSON.stringify([app.editable(), app.pageIndex, els.map(function (e) {
      return [e.id, e.type, e.shape || '', e.locked, e.type === 'image' ? !!e.source : '', e.type === 'imageStrip' ? e.items.map(function (i) { return i ? (i.asset || '{' + i.field) : ''; }).join(',') : '', e.format || '', e.type === 'group' ? e.children.length : ''];
    }), app.doc.fields.length, !!app.page().background.asset, app.canGroup(), app.canUngroup(), D.cmd.canCrop()]);
  }

  function build(keepPopover) {
    var els = app.selected();
    signature = sigOf(els);
    if (keepPopover !== true) { D.popover.close(); }
    ctx = makeContext(els);
    D.empty(inner);
    var controls;
    if (override) { controls = override(ctx); }
    else {
      controls = (builders[ctx.kind] || builders.multi)(ctx);
      (extensions[ctx.kind] || []).forEach(function (fn) { controls = fn(ctx, controls) || controls; });
      // several nodes of one kind (two texts, three shapes) keep the controls of the kind and get Gruppieren, Ausrichten, Verteilen in front
      if (ctx.els.length > 1 && ctx.kind !== 'multi' && ctx.kind !== 'group') { controls = multiControls(ctx, true).concat(['sep'], controls); }
    }
    var group = D.el('div', { class: 'dt-ctx__group' });
    controls.forEach(function (c) {
      if (c === 'sep') { if (group.lastChild && !group.lastChild.classList.contains('dt-ctx__sep')) { group.appendChild(D.el('span', { class: 'dt-ctx__sep', role: 'separator' })); } return; }
      if (c) { group.appendChild(c); }
    });
    while (group.lastChild && group.lastChild.classList && group.lastChild.classList.contains('dt-ctx__sep')) { group.removeChild(group.lastChild); }
    inner.appendChild(group);
    host.setAttribute('data-kind', ctx.kind);
    ctx.refreshers.forEach(function (fn) { fn(); });
    fitCompact();
  }

  /** Words next to the icons only while all controls fit into the width of the toolbar. */
  function fitCompact() {
    host.classList.remove('is-compact', 'is-tight');
    if (inner.scrollWidth > inner.clientWidth + 1) { host.classList.add('is-compact'); }
    if (inner.scrollWidth > inner.clientWidth + 1) { host.classList.add('is-tight'); }
  }

  function refresh() {
    if (!ctx) { return; }
    ctx.refreshers.forEach(function (fn) { fn(); });
  }

  function update(ev) {
    if (!app.doc) { return; }
    if (override) { return; }
    var els = app.selected();
    // the same nodes of the same kind with another look (a shape became a star): the toolbar is drawn again, a popover that is open stays
    if (sigOf(els) !== signature) { build(!!ctx && els.length === ctx.ids.length && els.every(function (e, i) { return e.id === ctx.ids[i]; }) && kindOf(els) === ctx.kind); return; }
    refresh();
  }

  function init(theApp, container) {
    app = theApp;
    host = container;
    inner = D.el('div', { class: 'dt-ctx__inner', role: 'toolbar', 'aria-label': 'Werkzeuge für die Auswahl' });
    host.appendChild(inner);
    // the toolbar does not take the focus from a text that is being edited
    host.setAttribute('data-keep-edit', '');
    host.addEventListener('mousedown', function (ev) { if (!/^(INPUT|TEXTAREA|SELECT)$/.test(ev.target.tagName) && !ev.target.closest('input, select, textarea')) { ev.preventDefault(); } });
    var sizes = D.el('datalist', { id: 'dt-sizes' });
    SIZES.forEach(function (s) { sizes.appendChild(D.el('option', { value: String(s) })); });
    document.body.appendChild(sizes);
    if (window.ResizeObserver) { var last = 0; new ResizeObserver(function () { var w = host.clientWidth; if (w !== last) { last = w; fitCompact(); } }).observe(host); }
    app.on('panel', fitCompact);
    app.on('selection', function () { if (!override) { build(); } });
    app.on('page', function () { if (!override) { build(); } });
    app.on('readonly', build);
    app.on('doc', update);
    app.on('fonts', build);
    app.on('assets', function () { if (ctx && ctx.kind === 'strip') { build(); } });
    app.on('preview', refresh);
    app.on('rendered', function () { if (ctx && (ctx.kind === 'qr' || ctx.kind === 'barcode')) { refresh(); } });
    // bold / italic / underline typed while a text is edited
    app.on('format', function (which) {
      var e = app.single();
      if (!e || e.type !== 'text') { return; }
      if (which === 'b') { toggleBold([e.id]); }
      else if (which === 'i') { app.setProps([e.id], textPatch(function () { return { italic: !e.italic }; }), { merge: false }); }
      else if (which === 'u') { app.setProps([e.id], { underline: !e.underline }, { merge: false }); }
    });
    if (app.doc) { build(); }
  }

  D.toolbar = {
    init: init,
    rebuild: build,
    refresh: refresh,
    /** Registers the builder of a kind: build(ctx) returns an array of controls ('sep' = separator). */
    register: function (kind, fn) { builders[kind] = fn; },
    /** Adds or changes controls of a kind: fn(ctx, controls) returns the new list (or nothing when it changed the array). */
    extend: function (kind, fn) { (extensions[kind] = extensions[kind] || []).push(fn); },
    /** Replaces the toolbar by fn(ctx) -> controls (crop mode) until it is called with null. */
    setOverride: function (fn) { override = fn || null; if (app && app.doc) { build(); } },
    openBackgroundColour: function () { if (pageBgButton && document.contains(pageBgButton)) { pageBgButton.click(); } else { app.select([]); setTimeout(function () { if (pageBgButton) { pageBgButton.click(); } }, 30); } },
    kindOf: kindOf,
    helpers: { applyProps: applyProps, textPatch: textPatch, toggleBold: toggleBold, opacityPopover: opacityPopover, tail: tail },
  };
})();
