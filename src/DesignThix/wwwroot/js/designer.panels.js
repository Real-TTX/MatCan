/* DesignThix editor, part 8: the left side. A vertical rail of icons (Vorlagen, Elemente, Text, Uploads, Marke, Ebenen, Daten) opens a wide panel (about 340 px, collapsible);
   context pages (Position, later Effekte, Anpassen, Farbe) open in the same panel with a back arrow. Framework: D.panels.register(def) with
     { id, title, label, icon, order, build(host, api), page: true for a context page, badge() (a number; D.panels.refreshBadges() redraws it), badgeClass }
   build fills `host` each time the panel is shown; api = { app, host, on(event, fn) (removed when the panel is hidden), rebuild(), setTitle(text) }.
   This file also holds the simple panels Elemente, Text, Vorlagen and Marke; Uploads, Ebenen, Daten and Position are in their own files (designer.panel-*.js).
   Phones: the same panel is a bottom sheet (CSS) opened from the tab bar; 768-1023 px: an overlay drawer next to the rail. */
(function () {
  'use strict';

  var D = window.DtDesigner;
  var app;
  var refs = {};
  var defs = {};
  var order = [];
  var state = { open: false, id: null, stack: [] };   // stack: the rail panel below a context page
  var cleanups = [];
  var STORE = 'dt-panel';

  function def(id) { return defs[id]; }

  function save() {
    try { localStorage.setItem(STORE, JSON.stringify({ open: state.open, id: state.stack.length ? state.stack[0] : state.id })); } catch (e) { /* ignore */ }
  }

  function clearBody() {
    cleanups.forEach(function (fn) { try { fn(); } catch (e) { /* ignore */ } });
    cleanups = [];
    D.empty(refs.body);
  }

  function makeApi(d) {
    var api = {
      app: app, host: refs.body, def: d,
      on: function (name, fn) { app.on(name, fn); cleanups.push(function () { app.off(name, fn); }); return fn; },
      rebuild: function () { if (state.id === d.id && state.open) { show(d.id, true); } },
      setTitle: function (t) { refs.title.textContent = t; },
      cleanup: function (fn) { cleanups.push(fn); },
    };
    return api;
  }

  function show(id, keepScroll) {
    var d = def(id);
    if (!d) { return; }
    var scroll = keepScroll ? refs.body.scrollTop : 0;
    clearBody();
    state.id = id;
    refs.title.textContent = d.title;
    refs.panel.setAttribute('data-panel', id);
    refs.panel.classList.toggle('is-page', !!d.page);
    refs.back.hidden = !d.page;
    D.$$('.dt-rail__btn', refs.rail).forEach(function (b) {
      var on = b.getAttribute('data-panel') === (d.page ? state.stack[0] : id);
      b.setAttribute('aria-pressed', String(on && state.open));
      b.classList.toggle('is-active', on && state.open);
    });
    d.build(refs.body, makeApi(d));
    refs.body.scrollTop = scroll;
  }

  function setOpen(open) {
    state.open = open;
    refs.root.classList.toggle('is-panel-open', open);
    refs.panel.hidden = !open;
    D.$$('.dt-rail__btn', refs.rail).forEach(function (b) {
      var d = def(b.getAttribute('data-panel'));
      var on = open && state.id && (b.getAttribute('data-panel') === (def(state.id).page ? state.stack[0] : state.id));
      b.setAttribute('aria-pressed', String(!!on));
      b.classList.toggle('is-active', !!on);
      void d;
    });
    D.$$('.dt-tabbar__btn', refs.root).forEach(function (b) {
      var id = b.getAttribute('data-panel');
      b.setAttribute('aria-pressed', String(!!(open && id && state.id === id)));
    });
    app.emit('panel');
  }

  function open(id) {
    var d = def(id);
    if (!d) { return; }
    state.stack = [];
    show(id);
    setOpen(true);
    save();
  }

  function close() {
    if (!state.open) { return; }
    clearBody();
    setOpen(false);
    save();
  }

  function toggle(id) {
    if (state.open && state.id === id && !def(id).page) { close(); } else { open(id); }
  }

  /** Opens a context page (Position ...) in the panel; the back arrow returns to the panel that was open. */
  function openPage(id) {
    var d = def(id);
    if (!d) { return; }
    if (!state.stack.length) { state.stack = [state.id && !def(state.id).page ? state.id : 'elements']; }
    show(id);
    setOpen(true);
  }

  function back() {
    var to = state.stack.length ? state.stack[0] : 'elements';
    state.stack = [];
    show(to);
    setOpen(true);
    save();
  }

  function init(theApp, theRefs) {
    app = theApp;
    refs = theRefs;
    order.slice().sort(function (a, b) { return (def(a).order || 0) - (def(b).order || 0); }).forEach(function (id) {
      var d = def(id);
      if (d.page) { return; }
      var btn = D.el('button', { type: 'button', class: 'dt-rail__btn', 'data-panel': id, 'aria-pressed': 'false', title: d.title, 'aria-label': d.title });
      btn.appendChild(D.icon(d.icon));
      btn.appendChild(D.el('span', { class: 'dt-rail__label', text: d.label || d.title }));
      if (d.badge) { var badge = D.el('b', { class: 'dt-rail__badge' + (d.badgeClass ? ' ' + d.badgeClass : ''), hidden: true }); btn.appendChild(badge); d._badge = badge; }
      btn.addEventListener('click', function () { toggle(id); });
      refs.rail.appendChild(btn);
    });
    refs.back.addEventListener('click', back);
    refs.close.addEventListener('click', close);
    refs.panel.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && !D.menu.isOpen() && !D.popover.isOpen() && !/^(INPUT|TEXTAREA|SELECT)$/.test(ev.target.tagName)) { close(); } });
    var updateBadges = function () { order.forEach(function (id) { var d = def(id); if (d._badge) { var n = d.badge(); d._badge.hidden = !n; d._badge.textContent = String(n || ''); } }); };
    app.on('doc', updateBadges);
    app.on('page', updateBadges);
    app.on('warnings', updateBadges);
    D.panels.refreshBadges = updateBadges;
    updateBadges();
    // a context page that depends on the selection goes back when nothing is selected
    app.on('selection', function () {
      if (state.open && state.id && def(state.id).page && def(state.id).needsSelection && !app.sel.length) { back(); }
      else if (state.open && state.id && def(state.id).page && def(state.id).reselect) { show(state.id, true); }
    });
    var wide = window.matchMedia('(min-width: 1024px)').matches;
    var saved = null;
    try { saved = JSON.parse(localStorage.getItem(STORE) || 'null'); } catch (e) { saved = null; }
    var startId = saved && def(saved.id) && !def(saved.id).page ? saved.id : 'elements';
    state.id = startId;
    show(startId);
    setOpen(wide && (!saved || saved.open !== false));
    if (!state.open) { clearBody(); }
  }

  /** Registers a panel or a context page. */
  function register(d) {
    defs[d.id] = d;
    if (order.indexOf(d.id) < 0) { order.push(d.id); }
  }

  D.panels = {
    init: init, register: register, open: open, close: close, toggle: toggle, openPage: openPage, back: back,
    current: function () { return state.open ? state.id : null; },
    isOpen: function () { return state.open; },
    refresh: function () { if (state.open && state.id) { show(state.id, true); } },
  };

  // ================================================================================================ shared: small engine previews for tiles

  /** A little SVG drawn by the engine for a tile (shapes, codes). spec = { w, h, element }; resolves with an <svg> that has no fixed size. */
  D.tilePreview = function (key, spec) {
    var make = function () {
      var doc = { schema: 2, unit: 'mm', width: spec.w || 100, height: spec.h || 100, pages: [{ elements: [Object.assign({ id: 'e1', x: 0, y: 0, w: spec.w || 100, h: spec.h || 100 }, spec.element)] }] };
      return window.DtEngine.render(doc, null, { mode: spec.mode || 'output', background: false, idPrefix: 'tp' + key.replace(/[^A-Za-z0-9]/g, '') }).then(function (svg) { svg.removeAttribute('width'); svg.removeAttribute('height'); return svg; });
    };
    return make();
  };

  // ================================================================================================ shared: adding elements by kind (tiles of the panels Elemente and Text)

  function previewElement(kind) {
    var base = { type: 'shape', fill: '#1fb3d6', stroke: null, strokeWidth: 1 };
    var shapes = { rect: { shape: 'rect' }, rounded: { shape: 'rect', radius: 18 }, ellipse: { shape: 'ellipse' }, triangle: { shape: 'triangle' }, diamond: { shape: 'diamond' }, pentagon: { shape: 'pentagon' },
      hexagon: { shape: 'hexagon' }, star: { shape: 'star' }, star8: { shape: 'star', points: 8, innerRadius: 0.6 }, heart: { shape: 'heart', fill: '#e5484d' }, arrow: { shape: 'arrow' }, speech: { shape: 'speech' } };
    if (shapes[kind]) { return Object.assign({}, base, shapes[kind]); }
    var line = { type: 'shape', shape: 'line', fill: null, stroke: '#1f2937', strokeWidth: 12, x: 6, y: 50, w: 88, h: 0 };
    if (kind === 'line') { return line; }
    if (kind === 'line-dashed') { return Object.assign({}, line, { dash: 'dashed' }); }
    if (kind === 'line-dotted') { return Object.assign({}, line, { dash: 'dotted' }); }
    if (kind === 'line-arrow') { return Object.assign({}, line, { endCap: 'arrow' }); }
    if (kind === 'line-arrows') { return Object.assign({}, line, { startCap: 'arrow', endCap: 'arrow' }); }
    if (kind === 'qr') { return { type: 'qr', value: 'https://designthix.example', quiet: false }; }
    if (kind === 'ean13') { return { type: 'barcode', format: 'ean13', value: '4006381333931', showText: true }; }
    if (kind === 'ean8') { return { type: 'barcode', format: 'ean8', value: '96385074', showText: true }; }
    if (kind === 'code128') { return { type: 'barcode', format: 'code128', value: 'DesignThix', showText: true }; }
    return { type: 'shape', shape: 'rect', fill: '#1fb3d6' };
  }
  D.tileElement = previewElement;

  function addByKind(kind) {
    if (!app.editable()) { return null; }
    var extra = null;
    if (kind === 'line-dashed') { kind = 'line'; extra = { dash: 'dashed' }; }
    else if (kind === 'line-dotted') { kind = 'line'; extra = { dash: 'dotted' }; }
    else if (kind === 'line-arrow') { kind = 'line'; extra = { endCap: 'arrow' }; }
    else if (kind === 'line-arrows') { kind = 'line'; extra = { startCap: 'arrow', endCap: 'arrow' }; }
    return app.addElement(kind, extra);
  }
  D.addByKind = addByKind;

  /** Places a new element of a kind with its centre at a document point (drop from a tile). */
  function addByKindAt(kind, p) {
    var id = addByKind(kind);
    var r = id ? app.locate(id, false) : null;
    if (!r || !p) { return id; }
    app.setProps([id], { x: D.round(p.x - r.el.w / 2, 2), y: D.round(p.y - r.el.h / 2, 2) }, { merge: false });
    return id;
  }
  D.addByKindAt = addByKindAt;

  function tileGrid(cls) { return D.el('div', { class: 'dt-tiles ' + (cls || '') }); }
  function section(title, tiles) { return D.el('section', { class: 'dt-psec' }, [D.el('h3', { class: 'dt-psec__title', text: title }), tiles]); }

  // ================================================================================================ Marke

  /** Applies a brand (or any) colour to the selection: text colour, shape fill, line colour, icon/QR colour; with nothing selected the page background. */
  D.applyColour = function (value) {
    var els = app.selected().filter(function (e) { return !e.locked; });
    if (!app.editable()) { return; }
    if (!els.length) { app.setBackground({ color: value, gradient: null }, { merge: false }); return; }
    app.setProps(els.map(function (e) { return e.id; }), function (e) {
      if (e.type === 'text' || e.type === 'icon' || e.type === 'qr' || e.type === 'barcode') { return { color: value }; }
      if (e.type === 'shape') { return e.shape === 'line' ? { stroke: value } : { fill: value }; }
      return {};
    }, { merge: false });
  };

  register({
    id: 'brand', title: 'Marke', label: 'Marke', icon: 'badge-check', order: 50,
    build: function (host, api) {
      var b = app.brand || { colors: [], fonts: {}, logos: [], logoAssets: [] };
      var empty = !b.colors.length && !(b.fonts && (b.fonts.heading || b.fonts.subheading || b.fonts.body)) && !(b.logoAssets && b.logoAssets.length);
      if (empty) {
        host.appendChild(D.el('div', { class: 'dt-pempty' }, [
          D.icon('badge-check', 'dt-pempty__icon'),
          D.el('h3', { text: 'Deine Marke' }),
          D.el('p', { text: 'Lege Farben, Schriften und Logos fest. Sie stehen dann hier und in der Farbauswahl bereit.' }),
          D.el('a', { class: 'mat-btn mat-btn--primary', href: D.brandHref || '/Brand', target: '_blank', rel: 'noopener' }, [D.icon('palette'), D.el('span', { text: 'Marke einrichten' })]),
        ]));
        return;
      }
      if (b.colors.length) {
        var row = D.el('div', { class: 'dt-palette dt-palette--grid' });
        b.colors.forEach(function (c) {
          var sw = D.el('button', { type: 'button', class: 'dt-swatch', title: c + ' anwenden', 'aria-label': 'Markenfarbe ' + c + ' anwenden', 'data-colour': c, css: { '--dt-swatch': c }, disabled: !app.editable() });
          sw.addEventListener('click', function () { D.applyColour(c); });
          row.appendChild(sw);
        });
        host.appendChild(section('Farben', row));
        host.appendChild(D.el('p', { class: 'dt-pnote', text: 'Ein Klick färbt die Auswahl: Text, Füllung, Linie oder – ohne Auswahl – den Hintergrund.' }));
      }
      var roles = [['heading', 'Überschrift', 700, 22], ['subheading', 'Zwischenüberschrift', 600, 17], ['body', 'Fließtext', 400, 14]];
      var fonts = roles.filter(function (r) { return b.fonts && b.fonts[r[0]]; });
      if (fonts.length) {
        var list = D.el('div', { class: 'dt-textadd' });
        fonts.forEach(function (r) {
          var family = b.fonts[r[0]];
          var btn = D.el('button', { type: 'button', class: 'dt-textadd__btn ' + D.fontClass(family), disabled: !app.editable(), title: family });
          btn.appendChild(D.el('span', { class: 'dt-textadd__text', text: r[1], css: { 'font-size': r[3] + 'px', 'font-weight': String(r[2]) } }));
          btn.appendChild(D.el('span', { class: 'dt-textadd__font', text: family }));
          btn.addEventListener('click', function () {
            var texts = app.selected().filter(function (e) { return e.type === 'text' && !e.locked; });
            if (texts.length) { app.setProps(texts.map(function (e) { return e.id; }), function (e) { return D.canvas.textPatch(e, { fontFamily: family }); }, { merge: false }); return; }
            var id = app.addElement(r[0] === 'heading' ? 'heading' : (r[0] === 'subheading' ? 'subheading' : 'body'));
            if (id) { D.canvas.startTextEdit(id, { selectAll: true }); }
          });
          list.appendChild(btn);
        });
        host.appendChild(section('Schriften', list));
      }
      if (b.logoAssets && b.logoAssets.length) {
        var grid = D.el('div', { class: 'dt-assetgrid' });
        b.logoAssets.forEach(function (a) {
          var tile = D.el('button', { type: 'button', class: 'dt-asset', title: a.name, 'data-key': a.key, disabled: !app.editable() }, [
            D.el('span', { class: 'dt-asset__thumb' }, D.el('img', { src: a.url, alt: '', loading: 'lazy', draggable: 'false' })),
            D.el('span', { class: 'dt-asset__name', text: a.name }),
          ]);
          D.dnd.attach(tile, { ghost: function () { return D.$('img', tile).cloneNode(true); }, onClick: function () { D.io.useAsset(a); }, onDrop: function (x, y) { D.canvas.dropAsset(a, x, y); } });
          grid.appendChild(tile);
        });
        host.appendChild(section('Logos', grid));
      }
      host.appendChild(D.el('p', { class: 'dt-pnote' }, [D.el('a', { href: D.brandHref || '/Brand', target: '_blank', rel: 'noopener', text: 'Marke bearbeiten' })]));
      api.on('brand', function () { api.rebuild(); });
      api.on('readonly', function () { api.rebuild(); });
    },
  });

  D.panelHelpers = { section: section, tileGrid: tileGrid };
})();
