/* DesignThix editor, part 8b: the panel "Elemente" and the icon grid. One search field over everything; sections (Formen, Linien, Rahmen, Icons, Flaggen, Siegel, Codes,
   Bildleiste) each show a few tiles and "Alle anzeigen" opens the whole section in the panel (a back arrow returns). A click puts the element in the middle of the page, a drag puts it
   where it is dropped; a flag, seal or icon... dropped on a frame or an image fills it (flags and seals are media of the library).
   Icons: about 1 900 Lucide icons from /lib/icons.json. The grid draws 60 tiles at a time (an IntersectionObserver asks for the next 60 when the end comes into view), so the panel stays
   fast. The bodies are parsed with the same allowlist the engine uses (path, circle, rect, line, polyline, polygon, ellipse; geometry attributes only), never as HTML.
   D.iconSvg(name) draws one icon, D.iconGrid(options) is the grid (also used by the icon picker of the toolbar: D.iconPicker.open(anchor, options)). */
(function () {
  'use strict';

  var D = window.DtDesigner;
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var BATCH = 60;
  var POPULAR = ['star', 'heart', 'sun', 'phone', 'mail', 'map-pin', 'clock', 'calendar', 'shopping-cart', 'tag', 'percent', 'leaf', 'check', 'arrow-right', 'gift', 'coffee', 'wine', 'cake', 'house', 'info'];

  // ================================================================================================ one icon as SVG (allowlist)

  var ICON_TAGS = {
    path: ['d'], circle: ['cx', 'cy', 'r'], rect: ['x', 'y', 'width', 'height', 'rx', 'ry'], line: ['x1', 'y1', 'x2', 'y2'], polyline: ['points'], polygon: ['points'], ellipse: ['cx', 'cy', 'rx', 'ry'],
  };
  var NUMBER_OK = /^-?\d*\.?\d+(?:e[+-]?\d+)?$/i;
  var PATH_OK = /^[0-9eE+\-., \tMmLlHhVvCcSsQqTtAaZz]*$/;
  var parsed = new Map();

  function parseBody(body) {
    if (parsed.has(body)) { return parsed.get(body); }
    var out = [];
    try {
      var doc = new DOMParser().parseFromString('<svg xmlns="' + SVG_NS + '">' + body + '</svg>', 'image/svg+xml');
      Array.prototype.forEach.call(doc.documentElement.children, function (child) {
        var allowed = child.namespaceURI === SVG_NS ? ICON_TAGS[child.localName] : null;
        if (!allowed || out.length >= 64) { return; }
        var attrs = {};
        allowed.forEach(function (name) {
          var v = child.getAttribute(name);
          if (v === null) { return; }
          if ((name === 'd' || name === 'points') ? (v.length <= 8000 && PATH_OK.test(v)) : NUMBER_OK.test(v.trim())) { attrs[name] = v.trim(); }
        });
        out.push({ tag: child.localName, attrs: attrs });
      });
    } catch (e) { out = []; }
    parsed.set(body, out);
    return out;
  }

  /** An <svg> (24 x 24 grid, stroke in currentColor) with the icon, or an empty svg when the library does not have the name yet. */
  D.iconSvg = function (name, cls) {
    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('class', 'dt-iconsvg' + (cls ? ' ' + cls : ''));
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    var lib = D.icons.library();
    var icon = lib && lib.icons[name];
    if (!icon) { return svg; }
    parseBody(icon.b).forEach(function (part) {
      var node = document.createElementNS(SVG_NS, part.tag);
      Object.keys(part.attrs).forEach(function (k) { node.setAttribute(k, part.attrs[k]); });
      svg.appendChild(node);
    });
    return svg;
  };

  // ================================================================================================ the grid of icons

  /** All icons, the common ones (a heart, a star, a phone ...) first. */
  function popularFirst(lib) {
    return POPULAR.filter(function (n) { return lib.icons[n]; }).concat(Object.keys(lib.icons).filter(function (n) { return POPULAR.indexOf(n) < 0; }));
  }
  D.iconsPopularFirst = popularFirst;

  /**
   * options: host (element the grid is put into), query (string), names (an explicit list; else the search result), onPick(name), onDrop(name, clientX, clientY) (a tile can be dragged),
   * columns, current (name that is marked), disabled. Returns { setQuery(q), count(), destroy() }.
   */
  D.iconGrid = function (o) {
    var grid = D.el('div', { class: 'dt-icongrid', role: 'listbox', 'aria-label': 'Icons' });
    var status = D.el('p', { class: 'dt-empty', hidden: true });
    var sentinel = D.el('div', { class: 'dt-icongrid__more', 'aria-hidden': 'true' });
    o.host.appendChild(grid);
    o.host.appendChild(status);
    o.host.appendChild(sentinel);
    if (o.columns) { grid.style.setProperty('--dt-icon-cols', String(o.columns)); }
    var names = [];
    var shown = 0;
    var observer = null;
    var token = 0;

    var addTile = function (name) {
      var lib = D.icons.library();
      var tile = D.el('button', { type: 'button', class: 'dt-icontile', role: 'option', 'data-icon': name, title: name, 'aria-label': (o.label || 'Icon') + ' ' + name, 'aria-selected': String(o.current === name), disabled: o.disabled });
      tile.appendChild(D.iconSvg(name));
      void lib;
      if (o.onDrop) {
        D.dnd.attach(tile, { ghost: function () { var g = D.iconSvg(name, 'dt-dragicon'); return g; }, onClick: function () { o.onPick(name); }, onDrop: function (x, y) { o.onDrop(name, x, y); } });
      } else {
        tile.addEventListener('click', function () { o.onPick(name); });
      }
      grid.appendChild(tile);
    };

    var more = function () {
      var end = Math.min(names.length, shown + BATCH);
      for (; shown < end; shown++) { addTile(names[shown]); }
      sentinel.hidden = shown >= names.length;
    };

    // draws batches until the end of the grid is far enough below the visible part (a tall panel needs more than one batch)
    var fill = function () {
      var guard = 0;
      while (shown < names.length && guard++ < 40 && document.contains(sentinel) && sentinel.getBoundingClientRect().top < window.innerHeight + 240) { more(); }
    };

    var draw = function (list) {
      names = list;
      shown = 0;
      D.empty(grid);
      status.hidden = names.length > 0;
      status.textContent = 'Kein Icon gefunden. Versuche ein anderes Wort, zum Beispiel „Herz“, „Käse“ oder „Telefon“.';
      more();
      requestAnimationFrame(fill);
    };

    var search = function (q) {
      var my = ++token;
      D.icons.load().then(function (lib) {
        if (my !== token) { return; }
        if (!lib) { names = []; D.empty(grid); status.hidden = false; status.textContent = 'Die Icons konnten nicht geladen werden.'; return; }
        var list = o.names ? o.names.filter(function (n) { return lib.icons[n]; }) : (String(q || '').trim() ? D.iconSearch(lib, q) : popularFirst(lib));
        draw(list);
      });
    };

    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(function (entries) { if (entries.some(function (e) { return e.isIntersecting; }) && shown < names.length) { more(); requestAnimationFrame(fill); } }, { rootMargin: '240px' });
      observer.observe(sentinel);
    }
    search(o.query);
    return {
      setQuery: search,
      count: function () { return names.length; },
      destroy: function () { token++; if (observer) { observer.disconnect(); } },
      el: grid,
    };
  };

  // ================================================================================================ the picker of the toolbar ("Icon ersetzen")

  D.iconPicker = {
    /** A popover under `anchor` with a search field and the grid; onPick(name) is called once, then the popover closes. */
    open: function (anchor, options) {
      var o = options || {};
      return D.popover.open(anchor, function (el, api) {
        el.classList.add('dt-iconpick');
        var search = D.el('input', { type: 'search', class: 'mat-input mat-input--sm dt-iconpick__search', placeholder: 'Icon suchen: Herz, Käse, Telefon …', 'aria-label': 'Icon suchen', autocomplete: 'off', spellcheck: 'false' });
        var scroll = D.el('div', { class: 'dt-iconpick__scroll' });
        el.appendChild(D.el('div', { class: 'dt-fontpop__top' }, search));
        el.appendChild(scroll);
        var grid = D.iconGrid({ host: scroll, query: '', columns: 6, current: o.current, label: 'Icon', onPick: function (name) { api.close(true); o.onPick(name); } });
        var timer = 0;
        search.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(function () { grid.setQuery(search.value); scroll.scrollTop = 0; }, 120); });
        search.addEventListener('keydown', function (ev) { ev.stopPropagation(); if (ev.key === 'Enter') { var first = D.$('.dt-icontile', scroll); if (first) { first.click(); } } });
        el._cleanup = function () { clearTimeout(timer); grid.destroy(); };
      }, { title: 'Icon wählen', width: 340, keepEdit: false });
    },
  };

  // ================================================================================================ the panel Elemente

  var SHAPE_TILES = [
    ['rect', 'Rechteck', 'quadrat viereck'], ['rounded', 'Abgerundet', 'rechteck rund ecken'], ['ellipse', 'Kreis', 'oval ellipse rund'], ['triangle', 'Dreieck', ''], ['diamond', 'Raute', 'rhombus'],
    ['pentagon', 'Fünfeck', 'polygon'], ['hexagon', 'Sechseck', 'wabe polygon'], ['star', 'Stern', 'zacken'], ['star8', 'Stern (8)', 'stern zacken'], ['heart', 'Herz', 'liebe'], ['arrow', 'Pfeil', 'richtung'],
    ['speech', 'Sprechblase', 'dialog nachricht'],
  ];
  var LINE_TILES = [['line', 'Linie', 'strich gerade'], ['line-dashed', 'Gestrichelt', 'linie strich'], ['line-dotted', 'Gepunktet', 'linie punkte'], ['line-arrow', 'Pfeil', 'linie'], ['line-arrows', 'Doppelpfeil', 'linie']];
  var FRAME_TILES = [['frame', 'Rechteck', 'rahmen bild foto platzhalter'], ['frame-rounded', 'Abgerundet', 'rahmen bild foto'], ['frame-circle', 'Kreis', 'rahmen bild foto rund'], ['frame-heart', 'Herz', 'rahmen bild foto'],
    ['frame-star', 'Stern', 'rahmen bild foto'], ['frame-hexagon', 'Sechseck', 'rahmen bild foto'], ['frame-triangle', 'Dreieck', 'rahmen bild foto']];
  var CODE_TILES = [['qr', 'QR-Code', 'link scan'], ['ean13', 'EAN-13', 'barcode strichcode artikelnummer'], ['ean8', 'EAN-8', 'barcode strichcode'], ['code128', 'Code 128', 'barcode strichcode']];

  var assetLists = {};

  function loadAssets(category) {
    if (!assetLists[category]) {
      assetLists[category] = D.request('GET', '/api/assets?category=' + encodeURIComponent(category) + '&take=300').then(function (res) { return res.ok && Array.isArray(res.data) ? res.data : []; }, function () { return []; });
    }
    return assetLists[category];
  }

  function matches(q, text) { return !q || D.fold(text).indexOf(q) >= 0; }

  D.panels.register({
    id: 'elements', title: 'Elemente', label: 'Elemente', icon: 'shapes', order: 20,
    build: function (host, api) {
      var app = api.app;
      var state = { q: '', view: null };
      var searchInput = D.el('input', { type: 'search', class: 'mat-input dt-psearch', placeholder: 'Elemente suchen', 'aria-label': 'Elemente suchen', autocomplete: 'off' });
      var top = D.el('div', { class: 'dt-pbar' }, searchInput);
      var body = D.el('div', { class: 'dt-presults' });
      host.appendChild(top);
      host.appendChild(body);
      var grids = [];
      var token = 0;

      var cleanGrids = function () { grids.forEach(function (g) { g.destroy(); }); grids = []; };
      api.cleanup(cleanGrids);

      var addAsset = function (a) { if (!app.assetByKey(a.key)) { app.addAssets([a]); } };

      var staticSection = function (id, title, tiles, cols, limit, labels) {
        return {
          id: id, title: title, cols: cols, limit: limit,
          fetch: function (q) { return Promise.resolve(tiles.filter(function (t) { return matches(q, t[1] + ' ' + t[2] + ' ' + title); })); },
          tile: function (t) { return elementTile(app, t[0], t[1], labels !== false); },
        };
      };
      var assetSection = function (id, title, category) {
        return {
          id: id, title: title, cols: 4, limit: 8,
          fetch: function (q) { return loadAssets(category).then(function (list) { return list.filter(function (a) { return matches(q, a.name + ' ' + a.key + ' ' + (Array.isArray(a.tags) ? a.tags.join(' ') : (a.tags || ''))); }); }); },
          tile: function (a) {
            var tile = D.el('button', { type: 'button', class: 'dt-asset dt-asset--sm', title: a.name + ' (' + a.key + ')', 'data-key': a.key, disabled: !app.editable() }, [
              D.el('span', { class: 'dt-asset__thumb' }, D.el('img', { src: a.url, alt: '', loading: 'lazy', draggable: 'false' })),
              D.el('span', { class: 'dt-asset__name', text: a.name }),
            ]);
            D.dnd.attach(tile, { ghost: function () { return D.el('img', { src: a.url, alt: '' }); }, onClick: function () { addAsset(a); D.io.useAsset(a); }, onDrop: function (x, y) { addAsset(a); D.canvas.dropAsset(a, x, y); } });
            return tile;
          },
        };
      };
      var sections = [
        staticSection('shapes', 'Formen', SHAPE_TILES, 4, 8, false),
        staticSection('lines', 'Linien', LINE_TILES, 4, 4, false),
        staticSection('frames', 'Rahmen für Bilder', FRAME_TILES, 4, 4, false),
        { id: 'icons', title: 'Icons', icons: true, limit: 10 },
        assetSection('flags', 'Flaggen', 'Flaggen'),
        assetSection('seals', 'Siegel', 'Siegel'),
        staticSection('codes', 'Codes', CODE_TILES, 4, 4),
        {
          id: 'strip', title: 'Bildleiste', cols: 1, limit: 1,
          fetch: function (q) { return Promise.resolve(matches(q, 'bildleiste bilder reihe galerie logos siegel leiste') ? [['strip']] : []); },
          tile: function () {
            var tile = D.el('button', { type: 'button', class: 'dt-tile dt-tile--wide', 'data-add': 'strip', disabled: !app.editable() }, [
              D.el('span', { class: 'dt-tile__thumb dt-tile__thumb--strip' }, [0, 1, 2, 3].map(function () { return D.el('i', { class: 'dt-tile__slot' }, D.icon('image')); })),
              D.el('span', { class: 'dt-tile__label', text: 'Bildleiste: mehrere Bilder in einer Reihe' }),
            ]);
            D.dnd.attach(tile, { ghost: function () { return D.$('.dt-tile__thumb', tile).cloneNode(true); }, onClick: function () { D.addByKind('strip'); }, onDrop: function (x, y) { var d = D.canvas.dropTarget(x, y); if (d.kind === 'page' && !d.inside) { return; } D.addByKindAt('strip', d.point); } });
            return tile;
          },
        },
      ];

      var iconTiles = function (names, host2) {
        return D.iconGrid({
          host: host2, names: names, columns: 5, label: 'Icon', disabled: !app.editable(),
          onPick: function (name) { app.addElement('icon', { icon: name }); },
          onDrop: function (name, x, y) { var t = D.canvas.dropTarget(x, y); if (t.kind === 'page' && !t.inside) { return; } var id = app.addElement('icon', { icon: name }); var r = id ? app.locate(id, false) : null; if (r && t.point) { app.setProps([id], { x: D.round(t.point.x - r.el.w / 2, 2), y: D.round(t.point.y - r.el.h / 2, 2) }, { merge: false }); } },
        });
      };

      var head = function (s, count, showAll) {
        var row = D.el('div', { class: 'dt-psec__head' }, D.el('h3', { class: 'dt-psec__title', text: s.title }));
        if (showAll) {
          var all = D.el('button', { type: 'button', class: 'dt-linkbtn', 'data-show-all': s.id, 'aria-label': s.title + ': alle ' + count + ' anzeigen' }, [D.el('span', { text: 'Alle anzeigen' })]);
          all.addEventListener('click', function () { state.view = s.id; draw(); host.scrollTop = 0; });
          row.appendChild(all);
        }
        return row;
      };

      var draw = function () {
        var my = ++token;
        cleanGrids();
        D.empty(body);
        var q = D.fold(state.q).trim();
        var view = state.view ? sections.find(function (s) { return s.id === state.view; }) : null;
        if (view) {
          var back = D.el('button', { type: 'button', class: 'dt-backbtn', 'aria-label': 'Zurück zu allen Elementen' }, [D.icon('arrow-left'), D.el('span', { class: 'dt-backbtn__title', text: view.title }), D.el('span', { class: 'dt-backbtn__count', 'data-count': '' })]);
          back.addEventListener('click', function () { state.view = null; draw(); });
          body.appendChild(back);
        }
        var anyTiles = false;
        var pending = (view ? [view] : sections).map(function (s) {
          return (s.icons ? D.icons.load().then(function (lib) { return lib ? (q ? D.iconSearch(lib, state.q) : popularFirst(lib)) : []; }) : s.fetch(q)).then(function (items) { return { s: s, items: items }; });
        });
        Promise.all(pending).then(function (results) {
          if (my !== token) { return; }
          results.forEach(function (r) {
            var s = r.s;
            if (!r.items.length) { return; }
            anyTiles = true;
            var section = D.el('section', { class: 'dt-psec', 'data-section': s.id });
            var full = !!view;
            var total = r.items.length;
            if (full) { var cnt = D.$('.dt-backbtn__count', body); if (cnt) { cnt.textContent = String(total); } }
            else { section.appendChild(head(s, total, total > s.limit)); }
            var host2 = D.el('div', { class: 'dt-psec__body' });
            section.appendChild(host2);
            if (s.icons) {
              var list = full ? r.items : r.items.slice(0, s.limit);
              grids.push(iconTiles(list, host2));
            } else {
              var grid = D.el('div', { class: 'dt-tiles dt-tiles--' + (s.cols === 4 ? '4' : (s.cols === 1 ? '1' : '3')) });
              (full ? r.items : r.items.slice(0, s.limit)).forEach(function (item) { grid.appendChild(s.tile(item)); });
              host2.appendChild(grid);
            }
            body.appendChild(section);
          });
          body.setAttribute('data-query', state.q);
          if (!anyTiles) { body.appendChild(D.el('p', { class: 'dt-empty', text: 'Nichts gefunden. Probiere „Herz“, „Pfeil“, „Käse“ oder „QR“.' })); }
          else if (!view) { body.appendChild(D.el('p', { class: 'dt-pnote', text: 'Ein Klick setzt das Element in die Mitte der Seite, Ziehen setzt es dorthin, wo du es loslässt. Ein Bild auf einen Rahmen gezogen füllt ihn.' })); }
        });
      };

      var timer = 0;
      searchInput.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(function () { state.q = searchInput.value; state.view = null; draw(); }, 120); });
      api.cleanup(function () { clearTimeout(timer); });
      api.on('readonly', function () { api.rebuild(); });
      draw();
    },
  });

  /** One tile of a shape, line, frame or code: a preview drawn by the engine; a click adds the element, a drag drops it. */
  function elementTile(app, kind, label, withLabel) {
    var tile = D.el('button', { type: 'button', class: 'dt-tile', title: label, 'aria-label': label + ' hinzufügen', 'data-add': kind, disabled: !app.editable() });
    var thumb = D.el('span', { class: 'dt-tile__thumb' });
    tile.appendChild(thumb);
    if (withLabel) { tile.appendChild(D.el('span', { class: 'dt-tile__label', text: label })); }
    var spec = { element: D.tileElement(kind), mode: 'editor' };
    if (/^line/.test(kind)) { spec.h = 100; }
    if (/^(ean13|ean8|code128)$/.test(kind)) { spec.w = 100; spec.h = 60; }
    if (/^frame/.test(kind)) {
      // an empty frame draws nothing in the output: the tile shows the shape of the mask in a soft grey
      var frameShape = { frame: { shape: 'rect' }, 'frame-rounded': { shape: 'rect', radius: 18 }, 'frame-circle': { shape: 'ellipse' }, 'frame-heart': { shape: 'heart' }, 'frame-star': { shape: 'star' }, 'frame-hexagon': { shape: 'hexagon' }, 'frame-triangle': { shape: 'triangle' } }[kind];
      spec.element = Object.assign({ type: 'shape', fill: '#c9d3df', stroke: '#8d9bad', strokeWidth: 1.5, dash: 'dashed' }, frameShape);
      spec.mode = 'output';
    }
    D.tilePreview(kind, spec).then(function (svg) { thumb.appendChild(svg); }, function () { thumb.appendChild(D.icon('square')); });
    D.dnd.attach(tile, { ghost: function () { return thumb.cloneNode(true); }, onClick: function () { D.addByKind(kind); }, onDrop: function (x, y) {
      var t = D.canvas.dropTarget(x, y);
      if (t.kind === 'page' && !t.inside) { return; }
      D.addByKindAt(kind, t.point);
    } });
    return tile;
  }
})();
