/* DesignThix editor, part 8c: the panel "Text". Three buttons add a heading, a subheading or body text (with the fonts of the brand when /Brand has them) and the Schriftkombinationen
   below are ready text groups (SALE, Frisch vom Markt, Danke! ...) drawn by the engine as previews. A combination is inserted as ONE group in the middle of the page (or where it is
   dropped), sized to about 70 % of the page width; it only uses fonts that ship with the app. The combinations are written in a reference frame of 100 mm width (font sizes in pt at that
   width) and scaled with D.scaleNodes to the page, so they look the same on a label and on a poster. */
(function () {
  'use strict';

  var D = window.DtDesigner;
  var REF_W = 100;

  /** A text of a combination: box and font in the reference frame. o: font, size (pt), weight, color, y, h (mm, else from size and lines), lines, align, italic, upper, ls (em), lh, x, w, extra. */
  function T(text, o) {
    var lines = o.lines || 1;
    var lh = o.lh || 1.15;
    var h = o.h || (o.size * 25.4 / 72 * lh * lines + 0.8);
    return Object.assign({
      type: 'text', text: text, x: o.x === undefined ? 0 : o.x, y: o.y, w: o.w === undefined ? REF_W : o.w, h: h, fontFamily: o.font, fontSize: o.size, fontWeight: o.weight || 400, italic: !!o.italic,
      color: o.color || '#111827', align: o.align || 'center', valign: o.valign || 'middle', lineHeight: lh, letterSpacing: o.ls || 0, uppercase: !!o.upper, wrap: o.wrap !== false,
    }, o.extra || {});
  }

  function R(o) {
    return Object.assign({ type: 'shape', shape: 'rect', fill: o.fill === undefined ? null : o.fill, stroke: o.stroke || null, strokeWidth: o.sw || 1, radius: o.radius || 0, x: o.x, y: o.y, w: o.w, h: o.h }, o.extra || {});
  }

  var COMBOS = [
    { id: 'sale', name: 'SALE −30 %', h: 54, items: [
      T('SALE', { font: 'Bebas Neue', size: 104, color: '#e5484d', y: 0, h: 38, ls: 0.02 }),
      T('−30 %', { font: 'Montserrat', size: 46, weight: 800, color: '#111827', y: 37, h: 17 }),
    ] },
    { id: 'markt', name: 'Frisch vom Markt', h: 44, items: [
      T('Frisch vom Markt', { font: 'Kaushan Script', size: 33, color: '#2e7d4f', y: 0, h: 22 }),
      T('OBST · GEMÜSE · BLUMEN', { font: 'Montserrat', size: 11, weight: 600, color: '#374151', ls: 0.22, y: 25, h: 7 }),
      R({ x: 38, y: 36, w: 24, h: 0.7, fill: '#2e7d4f' }),
    ] },
    { id: 'angebot', name: 'Angebot der Woche', h: 48, items: [
      T('ANGEBOT', { font: 'Oswald', size: 60, weight: 700, color: '#14532d', y: 0, h: 26, ls: 0.04 }),
      R({ x: 34, y: 28, w: 32, h: 0.9, fill: '#14532d' }),
      T('der Woche', { font: 'Playfair Display', size: 30, italic: true, weight: 500, color: '#14532d', y: 31, h: 14 }),
    ] },
    { id: 'neu', name: 'Neu eingetroffen', h: 50, items: [
      T('Neu', { font: 'Pacifico', size: 72, color: '#db2777', y: 0, h: 32 }),
      T('eingetroffen', { font: 'Montserrat', size: 25, weight: 700, color: '#111827', y: 33, h: 13 }),
    ] },
    { id: 'hausgemacht', name: 'Hausgemacht', h: 40, items: [
      R({ x: 4, y: 0, w: 92, h: 40, fill: '#fff7ed', stroke: '#a16207', sw: 1.4, radius: 8 }),
      T('HAUSGEMACHT', { font: 'Montserrat', size: 21, weight: 800, color: '#78350f', ls: 0.12, y: 6, h: 11 }),
      T('mit Liebe gemacht', { font: 'Kaushan Script', size: 27, color: '#a16207', y: 18, h: 14 }),
    ] },
    { id: 'regional', name: 'Regional & frisch', h: 46, items: [
      T('Regional', { font: 'Playfair Display', size: 54, weight: 800, color: '#1e3a8a', y: 0, h: 24 }),
      T('& frisch', { font: 'Playfair Display', size: 42, italic: true, weight: 500, color: '#2f86f6', y: 23, h: 19 }),
    ] },
    { id: 'danke', name: 'Danke!', h: 50, items: [
      T('Danke!', { font: 'Caveat', size: 110, weight: 700, color: '#e5484d', y: 0, h: 38 }),
      T('VON HERZEN', { font: 'Montserrat', size: 13, weight: 600, color: '#6b7280', ls: 0.32, y: 40, h: 7 }),
    ] },
    { id: 'einladung', name: 'Einladung', h: 62, items: [
      T('DU BIST EINGELADEN', { font: 'Montserrat', size: 11, weight: 600, color: '#6b7280', ls: 0.3, y: 0, h: 6 }),
      T('Hoffest', { font: 'Playfair Display', size: 68, weight: 700, color: '#78350f', y: 8, h: 30 }),
      R({ x: 40, y: 40, w: 20, h: 0.7, fill: '#a16207' }),
      T('Samstag · 14 Uhr', { font: 'Open Sans', size: 18, weight: 500, color: '#374151', y: 44, h: 10 }),
    ] },
    { id: 'zeiten', name: 'Öffnungszeiten', h: 48, items: [
      T('Öffnungszeiten', { font: 'Oswald', size: 38, weight: 600, color: '#111827', y: 0, h: 17, ls: 0.02 }),
      R({ x: 40, y: 19, w: 20, h: 0.7, fill: '#1fb3d6' }),
      T('Mo–Fr  8–18 Uhr\nSa  8–13 Uhr', { font: 'Montserrat', size: 16, weight: 500, color: '#374151', y: 23, lines: 2, lh: 1.5 }),
    ] },
    { id: 'tages', name: 'Tagesangebot', h: 56, items: [
      R({ x: 0, y: 0, w: 100, h: 56, fill: '#111827', radius: 7 }),
      T('Tagesangebot', { font: 'Permanent Marker', size: 32, color: '#facc15', y: 7, h: 20 }),
      T('NUR HEUTE', { font: 'Bebas Neue', size: 40, color: '#ffffff', ls: 0.14, y: 30, h: 15 }),
    ] },
  ];

  /** The nodes of a combination as one group in document units, 0/0 at the top left, width `targetWidth` (document units). */
  function comboGroup(app, combo, targetWidth) {
    var unit = app.doc.unit;
    var u = unit === 'px' ? 96 / 25.4 : 1;
    var G = targetWidth / REF_W;
    var s = G / u;
    var ref = window.DtEngine.normalize({ unit: 'mm', width: REF_W, height: combo.h, pages: [{ elements: D.clone(combo.items) }] });
    var nodes = ref.pages[0].elements;
    D.scaleNodes(nodes, G, s);
    var group = D.withDefaults({ id: 'g', type: 'group', children: nodes }, unit);
    D.fixGroups([group]);
    return group;
  }

  /** Inserts a combination: centred on the page or on `at` (document point). */
  function insertCombo(app, combo, at) {
    if (!app.editable()) { return null; }
    var doc = app.doc;
    var width = Math.min(doc.width * 0.7, doc.height * 0.7 * REF_W / combo.h);
    var g = comboGroup(app, combo, width);
    var cx = at ? at.x : doc.width / 2;
    var cy = at ? at.y : doc.height / 2;
    var nextId = D.idMaker(doc);
    var made = D.cloneNodes([g], nextId, cx - (g.x + g.w / 2), cy - (g.y + g.h / 2));
    made[0].name = combo.name;
    return app.addNodes(made, [], 'add') ? made[0].id : null;
  }
  D.textCombos = { list: COMBOS, insert: insertCombo, build: comboGroup };

  function comboPreview(app, combo) {
    var elements = D.clone(combo.items);
    var pad = 3;
    elements.forEach(function (e) { e.x += pad; e.y += pad; });
    var doc = { schema: 2, unit: 'mm', width: REF_W + 2 * pad, height: combo.h + 2 * pad, pages: [{ elements: elements }] };
    return window.DtEngine.render(doc, null, { mode: 'output', background: false, fonts: app.fonts, idPrefix: 'cb' + combo.id }).then(function (svg) { svg.removeAttribute('width'); svg.removeAttribute('height'); return svg; });
  }

  D.panels.register({
    id: 'text', title: 'Text', label: 'Text', icon: 'type', order: 30,
    build: function (host, api) {
      var app = api.app;
      var rows = [
        ['heading', 'Überschrift hinzufügen', 'heading', 28, 700],
        ['subheading', 'Zwischenüberschrift hinzufügen', 'subheading', 20, 600],
        ['body', 'Fließtext hinzufügen', 'body', 15, 400],
      ];
      var list = D.el('div', { class: 'dt-textadd' });
      rows.forEach(function (r) {
        var family = app.familyFor(r[2]);
        var b = D.el('button', { type: 'button', class: 'dt-textadd__btn ' + D.fontClass(family), 'data-add': r[0], disabled: !app.editable(), title: 'Schrift: ' + family });
        b.appendChild(D.el('span', { class: 'dt-textadd__text', text: r[1], css: { 'font-size': r[3] + 'px', 'font-weight': String(r[4]) } }));
        b.addEventListener('click', function () {
          var id = app.addElement(r[0]);
          if (id) { D.canvas.startTextEdit(id, { selectAll: true }); }
        });
        list.appendChild(b);
      });
      host.appendChild(D.el('div', { class: 'dt-pbar' }, D.el('h3', { class: 'dt-psec__title', text: 'Text hinzufügen' })));
      host.appendChild(list);
      var hasBrand = app.brand && app.brand.fonts && (app.brand.fonts.heading || app.brand.fonts.subheading || app.brand.fonts.body);
      host.appendChild(D.el('p', { class: 'dt-pnote' }, hasBrand
        ? ['Die Schriften kommen aus deiner Marke. ', D.el('a', { href: '/Brand', target: '_blank', rel: 'noopener', text: 'Marke bearbeiten' })]
        : ['Lege unter ', D.el('a', { href: '/Brand', target: '_blank', rel: 'noopener', text: 'Marke' }), ' deine Schriften fest: dann nutzen die Textvorlagen sie.']));

      var combos = D.el('div', { class: 'dt-combos', role: 'list', 'aria-label': 'Schriftkombinationen' });
      host.appendChild(D.el('section', { class: 'dt-psec dt-psec--gap' }, [D.el('h3', { class: 'dt-psec__title', text: 'Schriftkombinationen' }), combos]));
      COMBOS.forEach(function (combo) {
        var thumb = D.el('span', { class: 'dt-combo__thumb' });
        var tile = D.el('button', { type: 'button', class: 'dt-combo', role: 'listitem', 'data-combo': combo.id, title: combo.name, 'aria-label': combo.name + ' einfügen', disabled: !app.editable() }, [thumb]);
        comboPreview(app, combo).then(function (svg) { thumb.appendChild(svg); }, function () { thumb.appendChild(D.el('span', { class: 'dt-combo__fallback', text: combo.name })); });
        D.dnd.attach(tile, {
          ghost: function () { var c = thumb.cloneNode(true); c.classList.add('dt-combo__ghost'); return c; },
          onClick: function () { insertCombo(app, combo, null); },
          onDrop: function (x, y) { var t = D.canvas.dropTarget(x, y); if (t.kind === 'page' && !t.inside) { return; } insertCombo(app, combo, t.point); },
        });
        combos.appendChild(tile);
      });
      host.appendChild(D.el('p', { class: 'dt-pnote', text: 'Doppelklick auf einen Text bearbeitet ihn direkt auf der Seite. Eine Kombination kommt als Gruppe auf die Seite: doppelklicke einen Text darin, um ihn zu ändern.' }));
      api.on('readonly', function () { api.rebuild(); });
      api.on('brand', function () { api.rebuild(); });
      api.on('fonts', function () { api.rebuild(); });
    },
  });
})();
