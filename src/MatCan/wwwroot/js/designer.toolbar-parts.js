/* MatCan editor, part 6b: the bigger controls of the contextual toolbar, each one a function of the toolbar context `c` (see designer.toolbar.js) that returns a button: masks, borders,
   corners, shape kind and star settings, line ends, flip, list, the doors to the pages Effekte and Anpassen, the icon picker. They only call app.setProps (one undo step; sliders and
   typing merge into one step through a merge key). Loaded before designer.toolbar.js, which builds the toolbars of the kinds from them: D.tbp.* */
(function () {
  'use strict';

  var D = window.DtDesigner;
  var P = D.tbp = {};

  function app() { return D.app; }

  function ap(ids, patch, key, ms) {
    app().setProps(ids, patch, { merge: key === false ? false : 'tb:' + (key || 'p') + ':' + ids.join(','), mergeMs: ms || 1200 });
  }
  P.ap = ap;

  // ================================================================================================ little glyphs (SVG built with DOM APIs)

  function starPoints(n, inner) {
    var pts = [];
    for (var i = 0; i < n * 2; i++) {
      var r = i % 2 === 0 ? 10 : 10 * inner;
      var a = -Math.PI / 2 + i * Math.PI / n;
      pts.push(D.round(12 + r * Math.cos(a), 2) + ',' + D.round(12 + r * Math.sin(a), 2));
    }
    return pts.join(' ');
  }

  var GLYPHS = {
    rect: function () { return [['rect', { x: 3, y: 5, width: 18, height: 14 }]]; },
    rounded: function () { return [['rect', { x: 3, y: 5, width: 18, height: 14, rx: 5 }]]; },
    none: function () { return [['rect', { x: 3, y: 3, width: 18, height: 18 }]]; },
    circle: function () { return [['circle', { cx: 12, cy: 12, r: 9 }]]; },
    ellipse: function () { return [['circle', { cx: 12, cy: 12, r: 9 }]]; },
    triangle: function () { return [['polygon', { points: '12,3 22,21 2,21' }]]; },
    diamond: function () { return [['polygon', { points: '12,2 22,12 12,22 2,12' }]]; },
    pentagon: function () { return [['polygon', { points: '12,2 22,9.5 18.2,21 5.8,21 2,9.5' }]]; },
    hexagon: function () { return [['polygon', { points: '12,2 21,7 21,17 12,22 3,17 3,7' }]]; },
    star: function () { return [['polygon', { points: starPoints(5, 0.45) }]]; },
    heart: function () { return [['path', { d: 'M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z' }]]; },
    arrow: function () { return [['polygon', { points: '2,9 14,9 14,4 22,12 14,20 14,15 2,15' }]]; },
    speech: function () { return [['path', { d: 'M4 4h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H10l-5 4v-4H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z' }]]; },
  };

  /** A small outline of a shape or mask (24 x 24), drawn in currentColor. */
  D.glyph = function (kind) {
    var svg = D.svg('svg', { viewBox: '0 0 24 24', class: 'dt-glyph', 'aria-hidden': 'true', focusable: 'false', fill: 'currentColor', 'fill-opacity': '0.18', stroke: 'currentColor', 'stroke-width': '1.6', 'stroke-linejoin': 'round' });
    (GLYPHS[kind] || GLYPHS.rect)().forEach(function (part) { svg.appendChild(D.svg(part[0], part[1])); });
    return svg;
  };

  // ================================================================================================ masks, borders, corners (images and strips)

  var MASKS = [['none', 'Keine'], ['rounded', 'Abgerundet'], ['circle', 'Kreis'], ['heart', 'Herz'], ['star', 'Stern'], ['hexagon', 'Sechseck'], ['triangle', 'Dreieck']];
  P.MASKS = MASKS;

  P.mask = function (c) {
    return c.popoverButton({
      icon: 'frame', text: 'Maske', label: 'Maske', title: 'Form des Bildes', width: 300,
      build: function (el) {
        var read = function () { var e = c.first(); return e ? e.mask : 'none'; };
        var grid = D.el('div', { class: 'dt-masks', role: 'group', 'aria-label': 'Masken' });
        var buttons = MASKS.map(function (m) {
          var b = D.el('button', { type: 'button', class: 'dt-mask', 'data-mask': m[0], title: m[1], 'aria-label': 'Maske ' + m[1] }, [D.glyph(m[0]), D.el('span', { text: m[1] })]);
          b.addEventListener('click', function () {
            app().setProps(c.ids, function (e) {
              var p = { mask: m[0] };
              if (m[0] === 'rounded' && !(e.radius > 0)) { p.radius = D.round(Math.min(e.w, e.h) * 0.15, 2); }
              return p;
            }, { merge: false });
            sync();
          });
          grid.appendChild(b);
          return b;
        });
        var sync = function () { var v = read(); buttons.forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-mask') === v)); }); };
        sync();
        el.appendChild(D.el('div', { class: 'dt-pop' }, [D.el('h4', { class: 'dt-pop__title', text: 'Maske' }), grid, D.el('p', { class: 'dt-hint', text: 'Das Bild wird in diese Form geschnitten. Mit „Zuschneiden“ bestimmst du den Ausschnitt.' })]));
      },
    });
  };

  P.corners = function (c) {
    return c.popoverButton({
      icon: 'square-round-corner', label: 'Ecken', title: 'Eckenradius', width: 260,
      build: function (el) {
        var e0 = c.first();
        var max = Math.max(1, D.round(Math.min(e0.w, e0.h) / 2, 2));
        var slider = D.ui.slider({ min: 0, max: max, step: app().unit() === 'px' ? 1 : 0.5, digits: 1, value: e0.radius, suffix: D.unitLabel(app().unit()), label: 'Eckenradius', onInput: function (v) { ap(c.ids, { radius: D.round(v, 2), mask: v > 0 ? 'rounded' : 'none' }, 'radius'); } });
        el.appendChild(D.el('div', { class: 'dt-pop' }, [D.el('h4', { class: 'dt-pop__title', text: 'Ecken' }), slider.el]));
      },
    });
  };

  P.borderColour = function (c) {
    return c.colourButton({
      icon: 'square-dashed', label: 'Randfarbe', allowNone: true, noneLabel: 'Kein Rand',
      get: function () { var e = c.first(); return e && e.border ? e.border.color : null; },
      apply: function (v, final) {
        if (v !== null && typeof v !== 'string') { return; }
        ap(c.ids, function (e) { return v === null ? { border: null } : { border: { color: v, width: e.border ? e.border.width : 1 } }; }, final ? false : 'bordercolour', 1500);
      },
    });
  };

  P.borderWidth = function (c) {
    return c.popoverButton({
      icon: 'minus', text: 'Rand', label: 'Randstärke', width: 260,
      build: function (el) {
        var e0 = c.first();
        var slider = D.ui.slider({ min: 0, max: 24, step: 0.5, digits: 1, value: e0.border ? e0.border.width : 0, suffix: 'pt', label: 'Randstärke', onInput: function (v) {
          ap(c.ids, function (e) { return v <= 0 ? { border: null } : { border: { color: e.border ? e.border.color : '#000000', width: D.round(v, 2) } }; }, 'borderwidth');
        } });
        el.appendChild(D.el('div', { class: 'dt-pop' }, [D.el('h4', { class: 'dt-pop__title', text: 'Rand' }), slider.el, D.el('p', { class: 'dt-hint', text: '0 nimmt den Rand weg. Die Farbe stellst du daneben ein.' })]));
      },
    });
  };

  P.flip = function (c) {
    return c.button({ icon: 'arrow-left-right', text: 'Spiegeln', label: 'Spiegeln', title: 'Spiegeln', chevron: true, onClick: function (b) {
      D.menu.open([
        { label: 'Horizontal spiegeln', icon: 'arrow-left-right', run: function () { app().flip('x'); } },
        { label: 'Vertikal spiegeln', icon: 'arrow-up-down', run: function () { app().flip('y'); } },
      ], { anchor: b });
    } });
  };

  // ================================================================================================ shapes and lines

  var SHAPE_KINDS = [['rect', 'Rechteck'], ['rounded', 'Abgerundet'], ['ellipse', 'Kreis'], ['triangle', 'Dreieck'], ['diamond', 'Raute'], ['pentagon', 'Fünfeck'], ['hexagon', 'Sechseck'], ['star', 'Stern'], ['heart', 'Herz'], ['arrow', 'Pfeil'], ['speech', 'Sprechblase']];

  function kindOf(e) { return e.shape === 'rect' && e.radius > 0 ? 'rounded' : e.shape; }

  P.shapeKind = function (c) {
    return c.popoverButton({
      icon: 'shapes', text: 'Form', label: 'Form', title: 'Form ändern (Größe bleibt)', width: 300,
      build: function (el) {
        var grid = D.el('div', { class: 'dt-masks dt-masks--shapes', role: 'group', 'aria-label': 'Formen' });
        var buttons = SHAPE_KINDS.map(function (k) {
          var b = D.el('button', { type: 'button', class: 'dt-mask', 'data-shape': k[0], title: k[1], 'aria-label': 'Form ' + k[1] }, [D.glyph(k[0]), D.el('span', { text: k[1] })]);
          b.addEventListener('click', function () {
            app().setProps(c.ids, function (e) {
              if (k[0] === 'rounded') { return { shape: 'rect', radius: e.radius > 0 ? e.radius : D.round(Math.min(e.w, e.h) * 0.2, 2) }; }
              return k[0] === 'rect' ? { shape: 'rect', radius: 0 } : { shape: k[0] };
            }, { merge: false });
            sync();
            starBox.hidden = !c.ids.every(function (i) { var x = app().element(i); return x && x.shape === 'star'; });
          });
          grid.appendChild(b);
          return b;
        });
        var e0 = c.first();
        var points = D.ui.slider({ min: 5, max: 12, step: 1, value: e0.points, label: 'Zacken', onInput: function (v) { ap(c.ids, { points: Math.round(v) }, 'points'); } });
        var inner = D.ui.slider({ min: 20, max: 90, step: 1, value: Math.round(e0.innerRadius * 100), suffix: '%', label: 'Innenradius', onInput: function (v) { ap(c.ids, { innerRadius: D.round(v / 100, 2) }, 'inner'); } });
        var starBox = D.el('div', { class: 'dt-pop' }, [D.ui.field('Zacken', points.el), D.ui.field('Innenradius', inner.el)]);
        starBox.hidden = !c.els.every(function (e) { return e.shape === 'star'; });
        var sync = function () { var k = kindOf(c.first()); buttons.forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-shape') === k)); }); };
        sync();
        el.appendChild(D.el('div', { class: 'dt-pop' }, [D.el('h4', { class: 'dt-pop__title', text: 'Form' }), grid, starBox]));
      },
    });
  };

  var CAPS = [{ value: 'none', label: 'Keine' }, { value: 'arrow', label: 'Pfeil' }, { value: 'circle', label: 'Kreis' }, { value: 'square', label: 'Quadrat' }];

  P.lineEnds = function (c) {
    return c.popoverButton({
      icon: 'arrow-right', text: 'Enden', label: 'Linienenden', title: 'Anfang und Ende der Linie', width: 320,
      build: function (el) {
        var e0 = c.first();
        var start = D.ui.segmented({ label: 'Anfang der Linie', value: e0.startCap, options: CAPS, onChange: function (v) { ap(c.ids, { startCap: v }, false); start.set(v); } });
        var end = D.ui.segmented({ label: 'Ende der Linie', value: e0.endCap, options: CAPS, onChange: function (v) { ap(c.ids, { endCap: v }, false); end.set(v); } });
        el.appendChild(D.el('div', { class: 'dt-pop' }, [D.el('h4', { class: 'dt-pop__title', text: 'Linienenden' }), D.ui.field('Anfang', start.el), D.ui.field('Ende', end.el),
          D.el('p', { class: 'dt-hint', text: 'Pfeil, Kreis oder Quadrat am Anfang und am Ende der Linie.' })]));
      },
    });
  };

  // ================================================================================================ text

  P.list = function (c) {
    var names = { none: 'Keine Liste', bullet: 'Aufzählung', number: 'Nummerierung' };
    var b = c.button({ icon: 'list', label: 'Liste', title: 'Liste: Aufzählung oder Nummerierung', pressed: function () { var e = c.first(); return e && e.list !== 'none'; }, onClick: function (btn) {
      var cur = c.first().list;
      D.menu.open(['none', 'bullet', 'number'].map(function (k) {
        return { label: names[k], icon: k === 'number' ? 'list-ordered' : (k === 'bullet' ? 'list' : 'minus'), checked: cur === k, run: function () { app().setProps(c.ids, function (e) { return D.canvas.textPatch(e, { list: k }); }, { merge: false }); } };
      }), { anchor: btn });
    } });
    return b;
  };

  P.effects = function (c) {
    return c.button({ icon: 'wand-sparkles', text: 'Effekte', label: 'Effekte', cls: 'dt-tb--keeptext', title: 'Schatten, Kontur, Hintergrund, Krümmung', onClick: function () { D.panels.openPage('effects'); } });
  };

  P.adjust = function (c) {
    return c.button({ icon: 'sliders-horizontal', text: 'Anpassen', label: 'Anpassen', cls: 'dt-tb--keeptext', title: 'Helligkeit, Kontrast, Sättigung, Unschärfe', onClick: function () { D.panels.openPage('adjust'); } });
  };

  // ================================================================================================ icon

  P.iconReplace = function (c) {
    return c.button({ icon: 'replace', text: 'Icon ersetzen', label: 'Icon ersetzen', cls: 'dt-tb--keeptext', title: 'Ein anderes Icon wählen', onClick: function (b) {
      D.iconPicker.open(b, { current: c.first().icon, onPick: function (name) { ap(c.ids, { icon: name }, false); } });
    } });
  };
})();
