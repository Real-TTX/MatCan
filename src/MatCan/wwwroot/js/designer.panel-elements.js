/* MatCan editor, part 8b: the panel "Elemente" and the icon grid. One search field over everything; sections (Formen, Linien, Rahmen, Icons, Flaggen, Siegel, Codes,
   Bildleiste) each show a few tiles and "Alle anzeigen" opens the whole section in the panel (a back arrow returns). A click puts the element in the middle of the page, a drag puts it
   where it is dropped; a flag, seal or icon... dropped on a frame or an image fills it (flags and seals are media of the library).
   Icons: about 1 900 Lucide icons from /lib/icons.json. The grid draws 60 tiles at a time (an IntersectionObserver asks for the next 60 when the end comes into view), so the panel stays
   fast. The bodies are parsed with the same allowlist the engine uses (path, circle, rect, line, polyline, polygon, ellipse; geometry attributes only), never as HTML.
   Icon sets (plan 5, C3): next to the Lucide icons the section Icons has a switch "Icon-Satz" with the sets of the Iconify catalogue the administrator allows (Material Design, Tabler, Phosphor, Font Awesome ...).
   A set is browsed and searched through /api/catalogs/iconify/search (a page of 48 at a time, the bodies come with the answer); a click or a drop IMPORTS the icon first (its body is stored on the
   server, so the design draws offline), then the element is made with the name "prefix:name".
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
  var PAINT_ATTRS = ['fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'fill-rule', 'opacity', 'fill-opacity', 'stroke-opacity'];
  var NUMBER_OK = /^-?\d*\.?\d+(?:e[+-]?\d+)?$/i;
  var PATH_OK = /^[0-9eE+\-., \tMmLlHhVvCcSsQqTtAaZz]*$/;

  /** The presentation attributes of a catalogue icon: the same values the engine accepts (a paint is currentColor or none). */
  function paintOk(name, v) {
    if (name === 'fill' || name === 'stroke') { return v === 'currentColor' || v === 'none'; }
    if (name === 'stroke-linecap') { return v === 'butt' || v === 'round' || v === 'square'; }
    if (name === 'stroke-linejoin') { return v === 'miter' || v === 'round' || v === 'bevel'; }
    if (name === 'fill-rule') { return v === 'nonzero' || v === 'evenodd'; }
    if (!NUMBER_OK.test(v.trim())) { return false; }
    var n = Number(v);
    if (name === 'stroke-width') { return n >= 0 && n <= 64; }
    if (name === 'stroke-miterlimit') { return n >= 1 && n <= 100; }
    return n >= 0 && n <= 1;
  }
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
          if ((name === 'd' || name === 'points') ? (v.length <= 20000 && PATH_OK.test(v)) : NUMBER_OK.test(v.trim())) { attrs[name] = v.trim(); }
        });
        PAINT_ATTRS.forEach(function (name) {
          var v = child.getAttribute(name);
          if (v !== null && paintOk(name, v)) { attrs[name] = v.trim(); }
        });
        out.push({ tag: child.localName, attrs: attrs });
      });
    } catch (e) { out = []; }
    parsed.set(body, out);
    return out;
  }

  /** An <svg> (24 x 24 grid, stroke in currentColor) with the icon, or an empty svg when the library does not have the name yet. An icon of a catalogue ("mdi:home") is drawn from its body on its own grid. */
  D.iconSvg = function (name, cls) {
    if (typeof name === 'string' && name.indexOf(':') > 0) { return D.iconSvgOf(D.icons.view(name), cls); }
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

  /** An <svg> with the body of an icon of a catalogue ({ body, width, height }); the shapes say themselves what is filled and what is stroked (currentColor). Empty for null. */
  D.iconSvgOf = function (view, cls) {
    var svg = document.createElementNS(SVG_NS, 'svg');
    var w = view && view.width >= 1 && view.width <= 2048 ? view.width : 24;
    var h = view && view.height >= 1 && view.height <= 2048 ? view.height : 24;
    svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    svg.setAttribute('class', 'dt-iconsvg' + (cls ? ' ' + cls : ''));
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    if (!view || typeof view.body !== 'string') { return svg; }
    parseBody(view.body).forEach(function (part) {
      var node = document.createElementNS(SVG_NS, part.tag);
      Object.keys(part.attrs).forEach(function (k) { node.setAttribute(k, part.attrs[k]); });
      svg.appendChild(node);
    });
    return svg;
  };

  // ================================================================================================ icon sets of the catalogue (Iconify)

  var SET_KEY = 'dt-icon-set';
  var setsPromise = null;
  D.iconSets = {
    /** The sets the person can use: [{ catalog, prefix, name, count }] (empty without a usable icon catalogue). */
    load: function () {
      if (!setsPromise) {
        setsPromise = D.request('GET', '/api/catalogs').then(function (res) {
          var cat = res.ok && Array.isArray(res.data) ? res.data.filter(function (c) { return (c.kinds || []).indexOf('icon') >= 0; })[0] : null;
          if (!cat) { return []; }
          return D.request('GET', '/api/catalogs/' + encodeURIComponent(cat.id) + '/collections').then(function (r2) {
            return (r2.ok && Array.isArray(r2.data) ? r2.data : []).map(function (c) { return { catalog: cat.id, prefix: c.id, name: c.name, count: c.count }; });
          });
        }, function () { return []; });
      }
      return setsPromise;
    },
    /** The chosen set value: "" (Lucide) or "catalog:prefix". */
    get: function () { try { return window.localStorage.getItem(SET_KEY) || ''; } catch (e) { return ''; } },
    set: function (value) { try { if (value) { window.localStorage.setItem(SET_KEY, value); } else { window.localStorage.removeItem(SET_KEY); } } catch (e) { /* private mode */ } },
    /** The chosen set when it still exists, else null. */
    current: function (sets) { var v = D.iconSets.get(); return v ? (sets.filter(function (x) { return x.catalog + ':' + x.prefix === v; })[0] || null) : null; },
    /** A select "Icon-Satz" (Lucide first); onChange(set or null). */
    select: function (sets, onChange) {
      var sel = D.el('select', { class: 'mat-select mat-select--sm dt-iconsets', 'aria-label': 'Icon-Satz', 'data-icon-set': '' }, [D.el('option', { value: '', text: 'Lucide (eingebaut)' })].concat(sets.map(function (x) { return D.el('option', { value: x.catalog + ':' + x.prefix, text: x.name }); })));
      var cur = D.iconSets.current(sets);
      sel.value = cur ? cur.catalog + ':' + cur.prefix : '';
      sel.addEventListener('change', function () { D.iconSets.set(sel.value); onChange(D.iconSets.current(sets)); });
      return sel;
    },
  };

  /** Takes the icon into the library of the server (its body is stored there) and tells the editor the body: resolves with the name for a design, or null after a message. */
  D.iconSets.use = function (item, set, tile) {
    if (item.icon) { D.icons.remember(item.id, item.icon); }
    if (tile) { tile.classList.add('is-busy'); tile.setAttribute('aria-busy', 'true'); }
    var done = function () { if (tile) { tile.classList.remove('is-busy'); tile.removeAttribute('aria-busy'); } };
    var app = D.app;
    return D.request('POST', '/api/catalogs/' + encodeURIComponent(set.catalog) + '/import', { itemId: item.id, preferSpace: app && app.spaceId || null, designId: app && app.id || null }).then(function (res) {
      done();
      if (!res.ok || !res.data || res.data.kind !== 'icon') { D.toast((res.data && res.data.error) || 'Das Icon konnte nicht übernommen werden.', 'danger'); return null; }
      D.icons.remember(res.data.name, res.data);
      return res.data.name;
    }, function () { done(); D.toast('Keine Verbindung: Das Icon konnte nicht übernommen werden.', 'warning'); return null; });
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

  /**
   * The grid of one set of the catalogue: options host, set ({ catalog, prefix }), query, columns, limit (show only the first n, no paging), disabled, onPick(name), onDrop(name, x, y), current.
   * A page of 48 comes from /api/catalogs/{id}/search (browsing the set alphabetically, or searching inside it); more are asked for when the end comes into view. A tile only draws the body that came
   * with the answer; it is imported when it is used. Returns { setQuery(q), count(), destroy() } like D.iconGrid.
   */
  D.iconSetGrid = function (o) {
    var grid = D.el('div', { class: 'dt-icongrid dt-icongrid--set', role: 'listbox', 'aria-label': 'Icons', 'data-icon-set-grid': o.set.prefix });
    var status = D.el('p', { class: 'dt-empty', hidden: true, role: 'status' });
    var sentinel = D.el('div', { class: 'dt-icongrid__more', 'aria-hidden': 'true' });
    o.host.appendChild(grid);
    o.host.appendChild(status);
    o.host.appendChild(sentinel);
    if (o.columns) { grid.style.setProperty('--dt-icon-cols', String(o.columns)); }
    var page = 0;
    var hasMore = false;
    var loading = false;
    var token = 0;
    var query = o.query || '';
    var observer = null;
    var importing = false;

    var addTile = function (item) {
      if (!item.icon) { return; }
      var tile = D.el('button', { type: 'button', class: 'dt-icontile', role: 'option', 'data-icon': item.id, title: item.title + ' (' + o.set.prefix + ')', 'aria-label': (o.label || 'Icon') + ' ' + item.title, 'aria-selected': String(o.current === item.id), disabled: o.disabled });
      tile.appendChild(D.iconSvgOf(item.icon));
      var take = function (then) {
        if (importing) { return; }
        importing = true;
        D.iconSets.use(item, o.set, tile).then(function (name) { importing = false; if (name) { then(name); } });
      };
      if (o.onDrop) {
        D.dnd.attach(tile, { ghost: function () { return D.iconSvgOf(item.icon, 'dt-dragicon'); }, onClick: function () { take(o.onPick); }, onDrop: function (x, y) { take(function (name) { o.onDrop(name, x, y); }); } });
      } else {
        tile.addEventListener('click', function () { take(o.onPick); });
      }
      grid.appendChild(tile);
    };

    var load = function (reset) {
      if (reset) { token++; page = 0; hasMore = false; D.empty(grid); status.hidden = true; }
      var my = token;
      loading = true;
      page += 1;
      var url = '/api/catalogs/' + encodeURIComponent(o.set.catalog) + '/search?collection=' + encodeURIComponent(o.set.prefix) + '&q=' + encodeURIComponent(query) + '&page=' + page + '&perPage=48';
      return D.request('GET', url).then(function (res) {
        if (my !== token) { return; }
        loading = false;
        if (!res.ok || !res.data) {
          status.hidden = false;
          status.textContent = (res.data && res.data.error) || 'Die Icons konnten nicht geladen werden.';
          hasMore = false;
          return;
        }
        (res.data.items || []).forEach(function (item) { if (!o.limit || grid.children.length < o.limit) { addTile(item); } });
        hasMore = !!res.data.hasMore && !o.limit;
        sentinel.hidden = !hasMore;
        // a tall panel shows the end of the grid at once: the observer only tells when the end comes INTO view, so ask again while it is near
        requestAnimationFrame(function () { if (hasMore && !loading && my === token && document.contains(sentinel) && sentinel.getBoundingClientRect().top < window.innerHeight + 240) { load(false); } });
        if (!grid.children.length) {
          status.hidden = false;
          status.textContent = query ? 'Kein Icon gefunden. Dieser Satz kennt nur englische Wörter; versuche zum Beispiel „home“, „cheese“ oder „phone“.' : 'Dieser Satz hat keine Icons, die MatCan zeichnen kann.';
        }
      }, function () { if (my === token) { loading = false; status.hidden = false; status.textContent = 'Keine Verbindung.'; } });
    };

    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(function (entries) { if (entries.some(function (e) { return e.isIntersecting; }) && hasMore && !loading) { load(false); } }, { rootMargin: '240px' });
      observer.observe(sentinel);
    }
    load(true);
    return {
      setQuery: function (q) { query = String(q || '').trim(); load(true); },
      count: function () { return grid.children.length; },
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
        var grid = null;
        var holder = D.el('div', { class: 'dt-iconpick__grid' });
        var timer = 0;
        var pick = function (name) { api.close(true); o.onPick(name); };
        var build = function (sets) {
          if (grid) { grid.destroy(); }
          D.empty(holder);
          var set = D.iconSets.current(sets);
          grid = set
            ? D.iconSetGrid({ host: holder, set: set, query: search.value, columns: 6, current: o.current, label: 'Icon', onPick: pick })
            : D.iconGrid({ host: holder, query: search.value, columns: 6, current: o.current, label: 'Icon', onPick: pick });
        };
        scroll.appendChild(holder);
        D.iconSets.load().then(function (sets) {
          if (sets.length) { el.insertBefore(D.iconSets.select(sets, function () { build(sets); }), scroll); }
          build(sets);
        });
        search.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(function () { if (grid) { grid.setQuery(search.value); } scroll.scrollTop = 0; }, 120); });
        search.addEventListener('keydown', function (ev) { ev.stopPropagation(); if (ev.key === 'Enter') { var first = D.$('.dt-icontile', scroll); if (first) { first.click(); } } });
        el._cleanup = function () { clearTimeout(timer); if (grid) { grid.destroy(); } };
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

      // the icons of a set of the catalogue: searched and paged by the server, imported when they are used
      var iconSetTiles = function (set, limit, host2) {
        var place = function (name, x, y) {
          var t = D.canvas.dropTarget(x, y);
          if (t.kind === 'page' && !t.inside) { return; }
          var id = app.addElement('icon', { icon: name });
          var r = id ? app.locate(id, false) : null;
          if (r && t.point) { app.setProps([id], { x: D.round(t.point.x - r.el.w / 2, 2), y: D.round(t.point.y - r.el.h / 2, 2) }, { merge: false }); }
        };
        return D.iconSetGrid({
          host: host2, set: set, query: state.q, columns: 5, limit: limit, label: 'Icon', disabled: !app.editable(),
          onPick: function (name) { app.addElement('icon', { icon: name }); },
          onDrop: place,
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
        D.iconSets.load().then(function (sets) {
        if (my !== token) { return; }
        var set = D.iconSets.current(sets);
        var pending = (view ? [view] : sections).map(function (s) {
          // a set of the catalogue is searched and paged by the server: the section only needs to know that it is there
          return (s.icons ? (set ? Promise.resolve([{ set: set }]) : D.icons.load().then(function (lib) { return lib ? (q ? D.iconSearch(lib, state.q) : popularFirst(lib)) : []; })) : s.fetch(q)).then(function (items) { return { s: s, items: items }; });
        });
        return Promise.all(pending).then(function (results) {
          if (my !== token) { return; }
          results.forEach(function (r) {
            var s = r.s;
            if (!r.items.length) { return; }
            anyTiles = true;
            var section = D.el('section', { class: 'dt-psec', 'data-section': s.id });
            var full = !!view;
            var total = set && s.icons ? (set.count || s.limit + 1) : r.items.length;
            if (full) { var cnt = D.$('.dt-backbtn__count', body); if (cnt) { cnt.textContent = String(total); } }
            else { section.appendChild(head(s, total, total > s.limit)); }
            var host2 = D.el('div', { class: 'dt-psec__body' });
            section.appendChild(host2);
            if (s.icons) {
              if (sets.length) { host2.appendChild(D.iconSets.select(sets, function () { draw(); })); }
              if (set) {
                grids.push(iconSetTiles(set, full ? 0 : s.limit, host2));
              } else {
                var list = full ? r.items : r.items.slice(0, s.limit);
                grids.push(iconTiles(list, host2));
              }
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
