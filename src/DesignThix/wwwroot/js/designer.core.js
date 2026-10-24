/* DesignThix designer, part 1: helpers, the state of the editor (document, selection, undo stack, preview values) and every command that changes the document.
   The other parts (designer.canvas.js, designer.props.js, designer.panels.js, designer.js) only draw and call what is here. Plain JavaScript, no dependencies.

   Rules that hold for the whole designer: DOM is built with createElement/createElementNS + textContent (never innerHTML with data); a value that is data goes to the
   page through the CSSOM (style.setProperty, insertRule) or an SVG attribute, never through a style attribute in markup (CSP style-src 'self'). The document is the
   normalised document of DtEngine (docs/PLAN.md section 2); the engine draws it, nothing else does.

   Document changes: app.edit(mutator, opts) (one undo step; opts.merge = key to coalesce typing/nudging, opts.render = 'now' | 'soon' | 'none'),
   app.tx() for a gesture (the first change pushes one undo step; further changes only draw). Events: 'doc' {reason, render, structure}, 'selection', 'history',
   'preview', 'state', 'fonts', 'assets', 'zoom', 'readonly'. */
(function (global) {
  'use strict';

  var D = global.DtDesigner = { version: 1 };
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var KEY_PATTERN = /^[A-Za-z][A-Za-z0-9_]{0,39}$/;
  var TOKEN_PATTERN = /\{\{\s*([A-Za-z][A-Za-z0-9_]*)\s*\}\}/g;
  var MAX_HISTORY = 100;
  D.SVG_NS = SVG_NS;
  D.KEY_PATTERN = KEY_PATTERN;
  D.CATEGORIES = ['Flaggen', 'Siegel', 'Icons', 'Logos', 'Fotos', 'Hintergründe', 'Sonstiges'];
  D.FIELD_TYPES = [['text', 'Text'], ['multiline', 'Mehrzeiliger Text'], ['number', 'Zahl'], ['price', 'Preis'], ['image', 'Bild']];

  // ================================================================================================ small helpers

  D.clamp = function (n, min, max) { return Math.min(max, Math.max(min, n)); };
  D.round = function (n, digits) { var f = Math.pow(10, digits === undefined ? 2 : digits); return Math.round(n * f) / f; };
  D.isNum = function (n) { return typeof n === 'number' && isFinite(n); };
  D.clone = function (o) { return JSON.parse(JSON.stringify(o)); };
  D.same = function (a, b) { return JSON.stringify(a) === JSON.stringify(b); };
  D.lower = function (s) { return String(s === null || s === undefined ? '' : s).toLowerCase(); };

  D.debounce = function (fn, ms) {
    var t = 0;
    var pending = null;
    var wrapped = function () {
      pending = arguments;
      clearTimeout(t);
      t = setTimeout(function () { t = 0; var a = pending; pending = null; fn.apply(null, a); }, ms);
    };
    wrapped.flush = function () { if (t) { clearTimeout(t); t = 0; var a = pending; pending = null; fn.apply(null, a); } };
    wrapped.cancel = function () { clearTimeout(t); t = 0; pending = null; };
    return wrapped;
  };

  D.rafOnce = function (fn) {
    var pending = false;
    return function () {
      if (pending) { return; }
      pending = true;
      requestAnimationFrame(function () { pending = false; fn(); });
    };
  };

  function setProps(node, props) {
    if (!props) { return node; }
    Object.keys(props).forEach(function (k) {
      var v = props[k];
      if (v === null || v === undefined || v === false) { return; }
      if (k === 'class') { node.setAttribute('class', v); }
      else if (k === 'text') { node.textContent = v; }
      else if (k === 'on') { Object.keys(v).forEach(function (ev) { node.addEventListener(ev, v[ev]); }); }
      else if (k === 'css') { Object.keys(v).forEach(function (p) { node.style.setProperty(p, v[p]); }); }
      else if (k === 'value') { node.value = v; }
      else if (k === 'checked') { node.checked = !!v; }
      else if (k === 'disabled') { node.disabled = !!v; }
      else { node.setAttribute(k, v === true ? '' : String(v)); }
    });
    return node;
  }

  function append(node, kids) {
    if (kids === null || kids === undefined) { return node; }
    (Array.isArray(kids) ? kids : [kids]).forEach(function (k) {
      if (k === null || k === undefined || k === false) { return; }
      node.appendChild(typeof k === 'string' || typeof k === 'number' ? document.createTextNode(String(k)) : k);
    });
    return node;
  }

  /** el('div', { class, text, on: {click}, css: {'--x': 1}, any attribute }, [children]). */
  D.el = function (tag, props, kids) { return append(setProps(document.createElement(tag), props), kids); };
  D.svg = function (tag, props, kids) { return append(setProps(document.createElementNS(SVG_NS, tag), props), kids); };
  D.empty = function (node) { while (node.firstChild) { node.removeChild(node.firstChild); } return node; };
  D.$ = function (sel, scope) { return (scope || document).querySelector(sel); };
  D.$$ = function (sel, scope) { return Array.prototype.slice.call((scope || document).querySelectorAll(sel)); };

  /** An icon from the page sprite: the toolkit's (mat-i-*) when it has the name, else the designer's own (dt-i-*). */
  D.icon = function (name, cls) {
    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'mat-icon' + (cls ? ' ' + cls : ''));
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    var use = document.createElementNS(SVG_NS, 'use');
    use.setAttribute('href', (document.getElementById('dt-i-' + name) ? '#dt-i-' : '#mat-i-') + name);
    svg.appendChild(use);
    return svg;
  };

  D.toast = function (message, tone) {
    if (global.MatUi && global.MatUi.toast) { global.MatUi.toast(message, { tone: tone || undefined }); }
  };

  var seq = 0;
  D.uid = function (prefix) { seq++; return (prefix || 'dt') + '-' + seq; };

  /** Unit of the document: a length in document units to CSS px (at 100 % zoom). */
  D.pxPerUnit = function (unit) { return unit === 'px' ? 1 : 96 / 25.4; };
  D.unitLabel = function (unit) { return unit === 'px' ? 'px' : 'mm'; };
  D.nudgeStep = function (doc) { return doc.unit === 'px' ? 1 : 0.5; };
  D.ptToUnit = function (pt, unit) { return global.DtEngine.ptToUnit(pt, unit); };

  function normAngle(deg) {
    var a = deg % 360;
    if (a > 180) { a -= 360; }
    if (a <= -180) { a += 360; }
    return a;
  }
  D.normAngle = normAngle;

  // ================================================================================================ geometry

  /** The four corners of an element, rotated around its centre: [top-left, top-right, bottom-right, bottom-left]. */
  D.corners = function (e) {
    var cx = e.x + e.w / 2;
    var cy = e.y + e.h / 2;
    var r = (e.rotation || 0) * Math.PI / 180;
    var cos = Math.cos(r);
    var sin = Math.sin(r);
    return [[-e.w / 2, -e.h / 2], [e.w / 2, -e.h / 2], [e.w / 2, e.h / 2], [-e.w / 2, e.h / 2]].map(function (p) {
      return { x: cx + p[0] * cos - p[1] * sin, y: cy + p[0] * sin + p[1] * cos };
    });
  };

  /** The axis-aligned box around the (rotated) element. */
  D.aabb = function (e) {
    if (!e.rotation) { return { x: e.x, y: e.y, w: e.w, h: e.h }; }
    var c = D.corners(e);
    var minX = Math.min(c[0].x, c[1].x, c[2].x, c[3].x);
    var maxX = Math.max(c[0].x, c[1].x, c[2].x, c[3].x);
    var minY = Math.min(c[0].y, c[1].y, c[2].y, c[3].y);
    var maxY = Math.max(c[0].y, c[1].y, c[2].y, c[3].y);
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  };

  D.unionBox = function (boxes) {
    if (!boxes.length) { return null; }
    var x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    boxes.forEach(function (b) { x1 = Math.min(x1, b.x); y1 = Math.min(y1, b.y); x2 = Math.max(x2, b.x + b.w); y2 = Math.max(y2, b.y + b.h); });
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
  };

  /** A point in the local frame of an element (centre = origin, rotation undone). */
  D.toLocal = function (e, p) {
    var cx = e.x + e.w / 2;
    var cy = e.y + e.h / 2;
    var r = -(e.rotation || 0) * Math.PI / 180;
    var dx = p.x - cx;
    var dy = p.y - cy;
    return { x: dx * Math.cos(r) - dy * Math.sin(r), y: dx * Math.sin(r) + dy * Math.cos(r) };
  };

  D.rotateVec = function (v, deg) {
    var r = deg * Math.PI / 180;
    return { x: v.x * Math.cos(r) - v.y * Math.sin(r), y: v.x * Math.sin(r) + v.y * Math.cos(r) };
  };

  // ================================================================================================ API

  D.csrf = function () {
    var m = document.querySelector('meta[name="dt-csrf"]');
    return m ? m.getAttribute('content') : '';
  };

  /** Resolves { status, ok, data } for any answer of the server; rejects with { offline: true } when there is no connection. */
  D.request = function (method, url, body, options) {
    var o = options || {};
    var headers = { Accept: 'application/json' };
    if (method !== 'GET') { headers.RequestVerificationToken = D.csrf(); }
    var init = { method: method, credentials: 'same-origin', headers: headers };
    if (body !== undefined && body !== null) {
      if (o.raw) { init.body = body; headers['Content-Type'] = o.contentType || 'application/octet-stream'; }
      else { init.body = JSON.stringify(body); headers['Content-Type'] = 'application/json'; }
    }
    return fetch(url, init).then(function (r) {
      return r.text().then(function (text) {
        var data = null;
        try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
        return { status: r.status, ok: r.ok, data: data };
      });
    }, function () { var err = new Error('offline'); err.offline = true; throw err; });
  };

  // ================================================================================================ fonts

  var fontSheet = null;
  var fontClasses = new Map();

  function sheetForFonts() {
    if (fontSheet) { return fontSheet; }
    try {
      if (typeof CSSStyleSheet === 'function' && 'adoptedStyleSheets' in document) {
        fontSheet = new CSSStyleSheet();
        document.adoptedStyleSheets = document.adoptedStyleSheets.concat([fontSheet]);
        return fontSheet;
      }
    } catch (e) { /* fall through */ }
    var style = document.createElement('style');
    document.head.appendChild(style);
    fontSheet = style.sheet;
    return fontSheet;
  }

  /** A CSS class that sets the font family (one rule per family, inserted through the CSSOM, no inline style). */
  D.fontClass = function (family) {
    var key = String(family || '');
    if (fontClasses.has(key)) { return fontClasses.get(key); }
    var name = 'dt-ff-' + fontClasses.size;
    var safe = key.replace(/[\u0000-\u001f"'\\;{}<>]/g, ' ').trim();
    try { sheetForFonts().insertRule('.' + name + ' { font-family: "' + safe + '", sans-serif; }', sheetForFonts().cssRules.length); } catch (e) { /* ignore */ }
    fontClasses.set(key, name);
    return name;
  };

  /** What the library offers per family: the weights (steps of 100 for variable fonts), whether an italic face exists. */
  D.buildFontIndex = function (list) {
    var families = new Map();
    (list || []).forEach(function (f) {
      var name = f.family;
      var entry = families.get(name);
      if (!entry) { entry = { family: name, weights: new Set(), italic: false, builtIn: !!f.isBuiltIn }; families.set(name, entry); }
      var numbers = String(f.weight || '400').match(/\d+/g) || ['400'];
      var min = Number(numbers[0]);
      var max = Number(numbers[1] || numbers[0]);
      for (var w = Math.ceil(min / 100) * 100; w <= max; w += 100) { entry.weights.add(w); }
      if (min === max && min % 100 !== 0) { entry.weights.add(min); }
      if (/italic|oblique/i.test(f.style || '')) { entry.italic = true; }
    });
    var out = Array.from(families.values()).map(function (e) {
      e.weights = Array.from(e.weights).sort(function (a, b) { return a - b; });
      if (!e.weights.length) { e.weights = [400]; }
      return e;
    });
    out.sort(function (a, b) { return a.family.localeCompare(b.family, 'de'); });
    return out;
  };

  D.WEIGHT_NAMES = { 100: 'Thin', 200: 'Extra Light', 300: 'Light', 400: 'Regular', 500: 'Medium', 600: 'Semi Bold', 700: 'Bold', 800: 'Extra Bold', 900: 'Black' };

  // ================================================================================================ the document

  /** Text of a placeholder token list of one string. */
  D.tokensOf = function (text) {
    var keys = [];
    String(text || '').replace(TOKEN_PATTERN, function (all, key) { keys.push(key); return all; });
    return keys;
  };

  D.fieldByKey = function (doc, key) {
    var lower = D.lower(key);
    for (var i = 0; i < doc.fields.length; i++) { if (D.lower(doc.fields[i].key) === lower) { return doc.fields[i]; } }
    return null;
  };

  function nextElementId(doc) {
    var max = 0;
    var used = new Set();
    doc.elements.forEach(function (e) {
      used.add(e.id);
      var m = /^e(\d+)$/.exec(e.id);
      if (m) { max = Math.max(max, Number(m[1])); }
    });
    var n = max + 1;
    while (used.has('e' + n)) { n++; }
    return 'e' + n;
  }
  D.nextElementId = nextElementId;

  D.typeLabel = function (e) {
    if (e.type === 'text') { return 'Text'; }
    if (e.type === 'image') { return 'Bild'; }
    if (e.type === 'imageStrip') { return 'Bildleiste'; }
    return e.shape === 'ellipse' ? 'Ellipse' : (e.shape === 'line' ? 'Linie' : 'Rechteck');
  };

  /** The name shown in the layers panel: the own name, else something that tells the element apart. */
  D.elementTitle = function (e) {
    if (e.name) { return e.name; }
    if (e.type === 'text') {
      var line = String(e.text || '').split(/\r?\n/)[0].trim();
      return line ? (line.length > 28 ? line.slice(0, 27) + '…' : line) : 'Text';
    }
    if (e.type === 'image' && e.source) { return 'Bild: ' + (e.source.field ? '{{' + e.source.field + '}}' : e.source.asset); }
    return D.typeLabel(e);
  };

  D.elementIcon = function (e) {
    if (e.type === 'text') { return 'type'; }
    if (e.type === 'image') { return 'image'; }
    if (e.type === 'imageStrip') { return 'gallery-horizontal-end'; }
    return e.shape === 'ellipse' ? 'circle' : (e.shape === 'line' ? 'minus' : 'square');
  };

  // ================================================================================================ the app (state + commands)

  D.createApp = function (config) {
    var listeners = {};
    var app = {
      id: config.id,
      canEdit: !!config.canEdit,
      readOnly: !config.canEdit,
      revision: 0,
      baseRevision: 0,
      name: config.name || '',
      doc: null,
      sel: [],
      zoom: 1,
      fitMode: true,
      snapping: true,
      presets: config.presets || [],
      fonts: [],
      fontIndex: [],
      defaultFamily: 'sans-serif',
      assets: [],
      assetMap: new Map(),
      assetsComplete: false,
      values: {},
      preview: { listId: null, list: null, rows: [], index: 0 },
      dirty: false,
      saveState: 'saved',
      undoStack: [],
      redoStack: [],
      lastMerge: null,
      clip: null,
      pasteCount: 0,
      editing: null,
      warnings: [],
    };

    // ---------------------------------------------------------------------------------------- events
    app.on = function (name, fn) { (listeners[name] = listeners[name] || []).push(fn); return fn; };
    app.emit = function (name, a, b) {
      (listeners[name] || []).slice().forEach(function (fn) {
        try { fn(a, b); } catch (e) { if (global.console) { console.error('designer listener "' + name + '"', e); } }
      });
    };

    // ---------------------------------------------------------------------------------------- reading
    app.element = function (id) {
      for (var i = 0; i < app.doc.elements.length; i++) { if (app.doc.elements[i].id === id) { return app.doc.elements[i]; } }
      return null;
    };
    app.indexOf = function (id) {
      for (var i = 0; i < app.doc.elements.length; i++) { if (app.doc.elements[i].id === id) { return i; } }
      return -1;
    };
    app.selected = function () { return app.sel.map(app.element).filter(Boolean); };
    app.isSelected = function (id) { return app.sel.indexOf(id) >= 0; };
    app.single = function () { return app.sel.length === 1 ? app.element(app.sel[0]) : null; };
    app.editable = function () { return app.canEdit && !app.readOnly; };
    app.unit = function () { return app.doc ? app.doc.unit : 'mm'; };
    /** CSS px per document unit at the current zoom. */
    app.scale = function () { return D.pxPerUnit(app.unit()) * app.zoom; };

    // ---------------------------------------------------------------------------------------- dirty, state
    app.markDirty = function () {
      app.dirty = true;
      if (app.saveState !== 'offline') { app.setSaveState('dirty'); }
      app.emit('dirty');
    };
    app.setSaveState = function (state) {
      if (app.saveState === state) { return; }
      app.saveState = state;
      app.emit('state', state);
    };

    // ---------------------------------------------------------------------------------------- history
    function snapshot() { return { json: JSON.stringify(app.doc), sel: app.sel.slice() }; }

    function pushHistory(mergeKey, mergeMs) {
      var now = Date.now();
      if (mergeKey && app.lastMerge && app.lastMerge.key === mergeKey && now - app.lastMerge.at < (mergeMs || 1000)) {
        app.lastMerge.at = now;
        return;
      }
      app.undoStack.push(snapshot());
      if (app.undoStack.length > MAX_HISTORY) { app.undoStack.shift(); }
      app.redoStack = [];
      app.lastMerge = mergeKey ? { key: mergeKey, at: now } : null;
      app.emit('history');
    }

    function restore(s) {
      app.doc = JSON.parse(s.json);
      app.lastMerge = null;
      app.sel = s.sel.filter(function (id) { return app.indexOf(id) >= 0; });
      app.markDirty();
      app.emit('doc', { reason: 'history', render: 'now', structure: true });
      app.emit('selection');
      app.emit('history');
    }

    app.undo = function () {
      if (!app.editable() || !app.undoStack.length) { return; }
      app.redoStack.push(snapshot());
      restore(app.undoStack.pop());
    };
    app.redo = function () {
      if (!app.editable() || !app.redoStack.length) { return; }
      app.undoStack.push(snapshot());
      restore(app.redoStack.pop());
    };
    app.canUndo = function () { return app.editable() && app.undoStack.length > 0; };
    app.canRedo = function () { return app.editable() && app.redoStack.length > 0; };

    /**
     * One change of the document = one undo step. The mutator gets the document and changes it in place.
     * opts: merge (key: changes with the same key within mergeMs are one step), render ('now' | 'soon' | 'none'), structure (elements or fields added/removed/moved), reason.
     */
    app.edit = function (mutator, opts) {
      if (!app.editable()) { return false; }
      var o = opts || {};
      pushHistory(o.merge, o.mergeMs);
      mutator(app.doc);
      app.markDirty();
      app.emit('doc', { reason: o.reason || 'edit', render: o.render || 'now', structure: !!o.structure });
      return true;
    };

    /** A gesture (drag, resize, rotate): the first change pushes ONE undo step, the following ones only draw. */
    app.tx = function () {
      var started = false;
      return {
        apply: function (mutator, opts) {
          if (!app.editable()) { return false; }
          var o = opts || {};
          if (!started) { pushHistory(); started = true; }
          mutator(app.doc);
          app.markDirty();
          app.emit('doc', { reason: o.reason || 'gesture', render: o.render || 'soon', structure: !!o.structure });
          return true;
        },
        started: function () { return started; },
      };
    };

    app.setDocument = function (doc) {
      app.doc = doc;
      app.sel = [];
      app.undoStack = [];
      app.redoStack = [];
      app.lastMerge = null;
      app.emit('doc', { reason: 'load', render: 'now', structure: true });
      app.emit('selection');
      app.emit('history');
    };

    // ---------------------------------------------------------------------------------------- selection
    app.select = function (ids, opts) {
      var next = (ids || []).filter(function (id, i, a) { return a.indexOf(id) === i && app.indexOf(id) >= 0; });
      if (D.same(next, app.sel)) { return; }
      app.sel = next;
      app.emit('selection', opts || {});
    };
    app.toggleSelect = function (id) {
      app.select(app.isSelected(id) ? app.sel.filter(function (s) { return s !== id; }) : app.sel.concat([id]));
    };
    app.selectAll = function () {
      app.select(app.doc.elements.filter(function (e) { return !e.locked && !e.hidden; }).map(function (e) { return e.id; }));
    };

    // ---------------------------------------------------------------------------------------- element defaults
    function pageSizePt() { return app.doc.unit === 'px' ? app.doc.width * 0.75 : app.doc.width * 72 / 25.4; }
    D.pageWidthPt = pageSizePt;

    /** A good starting font size in points: about 1/9 of the page width for a label, a bit more for a headline. */
    function baseFontPt() { return D.clamp(Math.round(pageSizePt() / 20), 8, 120); }

    app.newElement = function (kind, extra) {
      var doc = app.doc;
      var w = doc.width;
      var h = doc.height;
      var id = nextElementId(doc);
      var common = { id: id, name: '', x: 0, y: 0, w: 0, h: 0, rotation: 0, opacity: 1, locked: false, hidden: false, showIf: null };
      var e;
      var pt = baseFontPt();
      var strokePt = 1;
      if (kind === 'text' || kind === 'heading' || kind === 'placeholder') {
        var size = kind === 'heading' ? Math.round(pt * 1.8) : pt;
        var tw = w * (kind === 'heading' ? 0.7 : 0.5);
        var th = D.ptToUnit(size, doc.unit) * 1.2 * 1.2;
        e = Object.assign(common, {
          type: 'text', x: (w - tw) / 2, y: (h - th) / 2, w: tw, h: th,
          text: kind === 'heading' ? 'Überschrift' : 'Text',
          fontFamily: app.defaultFamily, fontSize: size, fontWeight: kind === 'heading' ? 700 : 400, italic: false, color: '#000000',
          align: 'left', valign: 'top', lineHeight: 1.2, letterSpacing: 0, uppercase: false, wrap: true, fit: 'none', minFontSize: 4,
        });
      } else if (kind === 'rect' || kind === 'ellipse') {
        var sw = w * 0.3;
        var sh = Math.min(h * 0.25, sw);
        e = Object.assign(common, {
          type: 'shape', shape: kind, x: (w - sw) / 2, y: (h - sh) / 2, w: sw, h: sh,
          fill: '#1fb3d6', stroke: null, strokeWidth: strokePt, dash: 'solid', radius: 0,
        });
      } else if (kind === 'line') {
        var lw = w * 0.4;
        e = Object.assign(common, {
          type: 'shape', shape: 'line', x: (w - lw) / 2, y: h / 2, w: lw, h: 0,
          fill: null, stroke: '#000000', strokeWidth: 1.5, dash: 'solid', radius: 0,
        });
      } else if (kind === 'image') {
        var side = Math.min(w, h) * 0.3;
        e = Object.assign(common, { type: 'image', x: (w - side) / 2, y: (h - side) / 2, w: side, h: side, source: null, fit: 'contain', radius: 0 });
      } else if (kind === 'strip') {
        var stw = w * 0.6;
        var sth = Math.min(h * 0.18, stw / 4);
        e = Object.assign(common, {
          type: 'imageStrip', x: (w - stw) / 2, y: (h - sth) / 2, w: stw, h: sth,
          items: [null, null, null, null], gap: D.round(sth * 0.15, 2), align: 'left',
        });
      } else {
        return null;
      }
      Object.keys(extra || {}).forEach(function (k) { e[k] = extra[k]; });
      ['x', 'y', 'w', 'h'].forEach(function (k) { e[k] = D.round(e[k], 2); });
      return e;
    };

    /** Adds an element on top, selects it. Returns its id (null when the document is full). */
    app.addElement = function (kind, extra, opts) {
      if (!app.editable()) { return null; }
      if (app.doc.elements.length >= 500) { D.toast('Ein Design kann höchstens 500 Elemente haben.', 'warning'); return null; }
      var e = app.newElement(kind, extra);
      if (!e) { return null; }
      var o = opts || {};
      app.edit(function (doc) {
        if (kind === 'placeholder' && !o.noField) {
          var key = app.freeKey('Feld');
          doc.fields.push({ key: key, label: 'Feld ' + key.replace(/^Feld/, ''), type: 'text', sample: 'Beispieltext', decimals: null, category: null, required: false });
          e.text = '{{' + key + '}}';
        }
        doc.elements.push(e);
      }, { structure: true, reason: 'add' });
      app.select([e.id]);
      return e.id;
    };

    app.freeKey = function (base) {
      var n = 1;
      while (D.fieldByKey(app.doc, base + n)) { n++; }
      return base + n;
    };

    // ---------------------------------------------------------------------------------------- generic property change
    /** Sets properties on the elements with the given ids (a patch object, or a function (element) -> patch). Typing in a panel passes merge so it is one step. */
    app.setProps = function (ids, patch, opts) {
      var o = opts || {};
      var list = ids.filter(function (id) { return app.indexOf(id) >= 0; });
      if (!list.length) { return false; }
      return app.edit(function (doc) {
        list.forEach(function (id) {
          var e = doc.elements[app.indexOf(id)];
          var p = typeof patch === 'function' ? patch(e) : patch;
          Object.keys(p).forEach(function (k) { e[k] = p[k]; });
        });
      }, { merge: o.merge === false ? undefined : (o.merge || 'props:' + list.join(',') + ':' + Object.keys(typeof patch === 'function' ? {} : patch).join(',')), mergeMs: o.mergeMs, render: o.render || 'now', structure: !!o.structure, reason: 'props' });
    };

    // ---------------------------------------------------------------------------------------- delete, duplicate, copy, paste
    app.deleteIds = function (ids) {
      var list = ids.filter(function (id) { return app.indexOf(id) >= 0; });
      if (!list.length) { return; }
      app.edit(function (doc) { doc.elements = doc.elements.filter(function (e) { return list.indexOf(e.id) < 0; }); }, { structure: true, reason: 'delete' });
      app.select(app.sel.filter(function (id) { return list.indexOf(id) < 0; }));
    };
    app.deleteSelection = function () {
      if (!app.editable() || !app.sel.length) { return; }
      app.deleteIds(app.sel.slice());
    };

    function fieldsUsedBy(elements) {
      var keys = new Set();
      elements.forEach(function (e) {
        if (e.showIf) { keys.add(D.lower(e.showIf)); }
        if (e.type === 'text') { D.tokensOf(e.text).forEach(function (k) { keys.add(D.lower(k)); }); }
        if (e.type === 'image' && e.source && e.source.field) { keys.add(D.lower(e.source.field)); }
        if (e.type === 'imageStrip') { e.items.forEach(function (it) { if (it && it.field) { keys.add(D.lower(it.field)); } }); }
      });
      return app.doc.fields.filter(function (f) { return keys.has(D.lower(f.key)); });
    }

    /** Copies of the elements with new ids, moved by an offset; used by duplicate and paste. */
    function cloneElements(sources, dx, dy) {
      var doc = app.doc;
      var used = new Set(doc.elements.map(function (e) { return e.id; }));
      var n = 0;
      doc.elements.forEach(function (e) { var m = /^e(\d+)$/.exec(e.id); if (m) { n = Math.max(n, Number(m[1])); } });
      return sources.map(function (src) {
        var c = D.clone(src);
        do { n++; } while (used.has('e' + n));
        c.id = 'e' + n;
        used.add(c.id);
        c.x = D.round(c.x + dx, 2);
        c.y = D.round(c.y + dy, 2);
        c.locked = false;
        return c;
      });
    }

    app.duplicateSelection = function () {
      if (!app.editable() || !app.sel.length) { return; }
      var sources = app.selected().filter(function (e) { return !e.hidden; });
      if (!sources.length) { return; }
      var step = app.doc.unit === 'px' ? 12 : 3;
      var copies = cloneElements(sources, step, step);
      app.edit(function (doc) { copies.forEach(function (c) { doc.elements.push(c); }); }, { structure: true, reason: 'duplicate' });
      app.select(copies.map(function (c) { return c.id; }));
    };

    /** The text for the system clipboard (marked, so a paste knows it) and the internal copy. */
    app.copySelection = function () {
      var els = app.selected();
      if (!els.length) { return null; }
      app.clip = { elements: D.clone(els), fields: D.clone(fieldsUsedBy(els)), unit: app.doc.unit };
      app.pasteCount = 0;
      return JSON.stringify({ designThix: 1, elements: app.clip.elements, fields: app.clip.fields, unit: app.clip.unit });
    };

    /** Pastes the internal clipboard or a clipboard text of this app; plain text becomes a text element. Returns true when something was pasted. */
    app.paste = function (text) {
      if (!app.editable()) { return false; }
      var data = null;
      if (text) {
        try { var parsed = JSON.parse(text); if (parsed && parsed.designThix === 1 && Array.isArray(parsed.elements)) { data = parsed; } } catch (e) { data = null; }
      }
      if (!data && !text && app.clip) { data = app.clip; }
      if (!data && text && app.clip && !/\S/.test(text)) { data = app.clip; }
      if (!data) {
        if (text && /\S/.test(text)) {
          var id = app.addElement('text', { text: text.slice(0, 5000) });
          return !!id;
        }
        return false;
      }
      if (data.unit && data.unit !== app.doc.unit) { D.toast('Die Einheit (mm/px) des kopierten Elements ist eine andere. Größen können abweichen.', 'warning'); }
      app.pasteCount++;
      var step = (app.doc.unit === 'px' ? 12 : 3) * app.pasteCount;
      var copies = cloneElements(data.elements, step, step);
      app.edit(function (doc) {
        (data.fields || []).forEach(function (f) { if (!D.fieldByKey(doc, f.key)) { doc.fields.push(D.clone(f)); } });
        copies.forEach(function (c) { doc.elements.push(c); });
      }, { structure: true, reason: 'paste' });
      app.select(copies.map(function (c) { return c.id; }));
      return true;
    };

    // ---------------------------------------------------------------------------------------- move
    app.nudge = function (dx, dy) {
      var els = app.selected().filter(function (e) { return !e.locked; });
      if (!els.length) { return; }
      var ids = els.map(function (e) { return e.id; });
      app.edit(function (doc) {
        ids.forEach(function (id) { var e = doc.elements[app.indexOf(id)]; e.x = D.round(e.x + dx, 3); e.y = D.round(e.y + dy, 3); });
      }, { merge: 'nudge:' + ids.join(','), mergeMs: 700, reason: 'nudge' });
    };

    // ---------------------------------------------------------------------------------------- order
    app.order = function (mode) {
      if (!app.sel.length) { return; }
      var ids = app.sel.slice();
      app.edit(function (doc) {
        var list = doc.elements;
        var chosen = list.filter(function (e) { return ids.indexOf(e.id) >= 0; });
        if (mode === 'front') {
          doc.elements = list.filter(function (e) { return ids.indexOf(e.id) < 0; }).concat(chosen);
        } else if (mode === 'back') {
          doc.elements = chosen.concat(list.filter(function (e) { return ids.indexOf(e.id) < 0; }));
        } else if (mode === 'forward') {
          for (var i = list.length - 2; i >= 0; i--) {
            if (ids.indexOf(list[i].id) >= 0 && ids.indexOf(list[i + 1].id) < 0) { var t = list[i]; list[i] = list[i + 1]; list[i + 1] = t; }
          }
        } else if (mode === 'backward') {
          for (var j = 1; j < list.length; j++) {
            if (ids.indexOf(list[j].id) >= 0 && ids.indexOf(list[j - 1].id) < 0) { var u = list[j]; list[j] = list[j - 1]; list[j - 1] = u; }
          }
        }
      }, { structure: true, reason: 'order' });
    };

    /** Moves one element to a position of the list (layers panel drag); index counts from the bottom of the stack. */
    app.moveToIndex = function (id, index) {
      var from = app.indexOf(id);
      if (from < 0) { return; }
      var to = D.clamp(index, 0, app.doc.elements.length - 1);
      if (from === to) { return; }
      app.edit(function (doc) {
        var item = doc.elements.splice(from, 1)[0];
        doc.elements.splice(to, 0, item);
      }, { structure: true, reason: 'order' });
    };

    // ---------------------------------------------------------------------------------------- align, distribute
    function movableBoxes(ids) {
      return ids.map(app.element).filter(function (e) { return e && !e.locked; }).map(function (e) { return { e: e, box: D.aabb(e) }; });
    }

    /** mode: left | centre | right | top | middle | bottom; toPage: align to the page (a single element always does). */
    app.align = function (mode, toPage) {
      var items = movableBoxes(app.sel);
      if (!items.length) { return; }
      var frame = (toPage || items.length === 1) ? { x: 0, y: 0, w: app.doc.width, h: app.doc.height } : D.unionBox(items.map(function (i) { return i.box; }));
      app.edit(function (doc) {
        items.forEach(function (it) {
          var e = doc.elements[app.indexOf(it.e.id)];
          var b = it.box;
          if (mode === 'left') { e.x = D.round(e.x + (frame.x - b.x), 3); }
          else if (mode === 'centre') { e.x = D.round(e.x + (frame.x + frame.w / 2 - (b.x + b.w / 2)), 3); }
          else if (mode === 'right') { e.x = D.round(e.x + (frame.x + frame.w - (b.x + b.w)), 3); }
          else if (mode === 'top') { e.y = D.round(e.y + (frame.y - b.y), 3); }
          else if (mode === 'middle') { e.y = D.round(e.y + (frame.y + frame.h / 2 - (b.y + b.h / 2)), 3); }
          else if (mode === 'bottom') { e.y = D.round(e.y + (frame.y + frame.h - (b.y + b.h)), 3); }
        });
      }, { reason: 'align' });
    };

    /** axis: 'x' (equal gaps from left to right) or 'y'; needs three or more elements. */
    app.distribute = function (axis) {
      var items = movableBoxes(app.sel);
      if (items.length < 3) { return; }
      var horizontal = axis === 'x';
      items.sort(function (a, b) { return horizontal ? a.box.x - b.box.x : a.box.y - b.box.y; });
      var first = items[0].box;
      var last = items[items.length - 1].box;
      var start = horizontal ? first.x : first.y;
      var end = horizontal ? last.x + last.w : last.y + last.h;
      var sizes = items.reduce(function (sum, it) { return sum + (horizontal ? it.box.w : it.box.h); }, 0);
      var gap = (end - start - sizes) / (items.length - 1);
      app.edit(function (doc) {
        var pos = start;
        items.forEach(function (it) {
          var e = doc.elements[app.indexOf(it.e.id)];
          var current = horizontal ? it.box.x : it.box.y;
          var delta = pos - current;
          if (horizontal) { e.x = D.round(e.x + delta, 3); } else { e.y = D.round(e.y + delta, 3); }
          pos += (horizontal ? it.box.w : it.box.h) + gap;
        });
      }, { reason: 'distribute' });
    };

    // ---------------------------------------------------------------------------------------- lock, hide, rename
    app.toggleLock = function (ids) {
      var list = ids || app.sel;
      if (!list.length) { return; }
      var lock = list.some(function (id) { var e = app.element(id); return e && !e.locked; });
      app.setProps(list, { locked: lock }, { merge: false, structure: true });
      if (lock) { app.select(app.sel.filter(function (id) { return list.indexOf(id) < 0; }).concat(list.length === 1 ? list : [])); }
    };
    app.toggleHidden = function (ids) {
      var list = ids || app.sel;
      if (!list.length) { return; }
      var hide = list.some(function (id) { var e = app.element(id); return e && !e.hidden; });
      app.setProps(list, { hidden: hide }, { merge: false, structure: true });
    };
    app.rename = function (id, name) {
      app.setProps([id], { name: String(name || '').slice(0, 80) }, { merge: false, structure: true });
    };

    // ---------------------------------------------------------------------------------------- fields
    app.addField = function (field) {
      var f = field || {};
      if (!KEY_PATTERN.test(f.key || '')) { return 'Der Schlüssel beginnt mit einem Buchstaben und hat nur Buchstaben, Ziffern und _ (höchstens 40 Zeichen).'; }
      if (D.fieldByKey(app.doc, f.key)) { return 'Ein Feld mit diesem Schlüssel gibt es schon.'; }
      if (app.doc.fields.length >= 100) { return 'Ein Design kann höchstens 100 Felder haben.'; }
      app.edit(function (doc) {
        doc.fields.push({
          key: f.key, label: (f.label || f.key).slice(0, 80), type: f.type || 'text', sample: String(f.sample || '').slice(0, 2000),
          decimals: (f.type === 'price' || f.type === 'number') ? (D.isNum(f.decimals) ? f.decimals : (f.type === 'price' ? 2 : null)) : null,
          category: f.type === 'image' && f.category ? f.category : null, required: !!f.required,
        });
      }, { structure: true, reason: 'field' });
      return null;
    };

    /** Changes a field; a new key renames the placeholders and bindings that used the old one. Returns an error text or null. */
    app.updateField = function (oldKey, patch, mergeKey, structural) {
      var current = D.fieldByKey(app.doc, oldKey);
      if (!current) { return 'Das Feld gibt es nicht mehr.'; }
      var newKey = patch.key !== undefined ? patch.key : current.key;
      if (!KEY_PATTERN.test(newKey)) { return 'Der Schlüssel beginnt mit einem Buchstaben und hat nur Buchstaben, Ziffern und _ (höchstens 40 Zeichen).'; }
      var clash = D.fieldByKey(app.doc, newKey);
      if (clash && clash !== current) { return 'Ein Feld mit diesem Schlüssel gibt es schon.'; }
      var renamed = D.lower(newKey) !== D.lower(oldKey) || newKey !== oldKey;
      app.edit(function (doc) {
        var f = D.fieldByKey(doc, oldKey);
        Object.keys(patch).forEach(function (k) { f[k] = patch[k]; });
        if (f.type !== 'price' && f.type !== 'number') { f.decimals = null; }
        if (f.type === 'price' && !D.isNum(f.decimals)) { f.decimals = 2; }
        if (f.type !== 'image') { f.category = null; }
        if (!renamed) { return; }
        var same = function (k) { return D.lower(k) === D.lower(oldKey); };
        doc.elements.forEach(function (e) {
          if (e.showIf && same(e.showIf)) { e.showIf = newKey; }
          if (e.type === 'text') { e.text = e.text.replace(TOKEN_PATTERN, function (all, k) { return same(k) ? '{{' + newKey + '}}' : all; }); }
          if (e.type === 'image' && e.source && e.source.field && same(e.source.field)) { e.source = { field: newKey }; }
          if (e.type === 'imageStrip') { e.items = e.items.map(function (it) { return it && it.field && same(it.field) ? { field: newKey } : it; }); }
        });
      }, { merge: mergeKey, structure: structural !== false, reason: 'field' });
      return null;
    };

    app.deleteField = function (key) {
      app.edit(function (doc) { doc.fields = doc.fields.filter(function (f) { return D.lower(f.key) !== D.lower(key); }); }, { structure: true, reason: 'field' });
    };

    /** Text of the placeholder for a field. */
    app.tokenFor = function (key) { return '{{' + key + '}}'; };

    /** Appends {{Key}} to the selected text element (a text that is being edited is handled by the canvas: it inserts at the caret). */
    app.insertPlaceholder = function (key) {
      var token = app.tokenFor(key);
      if (app.editing && app.editing.insert) { app.editing.insert(token); return true; }
      var e = app.single();
      if (!e || e.type !== 'text' || e.locked) { D.toast('Wähle zuerst ein Textelement aus.', 'warning'); return false; }
      var text = e.text;
      var glue = text === '' || /\s$/.test(text) ? '' : ' ';
      app.setProps([e.id], { text: (text + glue + token).slice(0, 5000) }, { merge: false });
      return true;
    };

    /** Binds an image element or a slot of an image strip to an asset or a field (source = {asset}|{field}|null). */
    app.setSource = function (id, source, slot) {
      var e = app.element(id);
      if (!e) { return; }
      if (e.type === 'image') { app.setProps([id], { source: source }, { merge: false }); }
      else if (e.type === 'imageStrip') {
        var items = e.items.slice();
        var i = slot === undefined || slot === null ? items.findIndex(function (it) { return !it; }) : slot;
        if (i < 0) { if (items.length >= 12) { return; } items.push(source); } else { while (items.length <= i) { items.push(null); } items[i] = source; }
        app.setProps([id], { items: items }, { merge: false });
      }
    };

    // ---------------------------------------------------------------------------------------- values of the preview
    /** Values by field key for the engine: the samples, over them the row of the data list that is shown. */
    app.computeValues = function () {
      var values = global.DtEngine.sampleValues(app.doc);
      var p = app.preview;
      if (p.list && p.rows.length) {
        var row = p.rows[D.clamp(p.index, 0, p.rows.length - 1)];
        var byLower = {};
        Object.keys(row.values || {}).forEach(function (k) { byLower[D.lower(k)] = row.values[k]; });
        // a field that is a column of the list takes the cell, and an empty (or missing) cell is empty; a field without a column keeps its sample
        var columns = new Set(((p.list.columns) || []).map(function (col) { return D.lower(col.key); }));
        Object.keys(values).forEach(function (k) {
          var lower = D.lower(k);
          if (Object.prototype.hasOwnProperty.call(byLower, lower)) { values[k] = byLower[lower]; }
          else if (columns.has(lower)) { values[k] = ''; }
        });
        Object.keys(byLower).forEach(function (k) {
          if (!D.fieldByKey(app.doc, k) && KEY_PATTERN.test(k)) { values[k] = byLower[k]; }
        });
      }
      return values;
    };

    // ---------------------------------------------------------------------------------------- assets
    app.assetByKey = function (key) { return app.assetMap.get(D.lower(key)) || null; };

    /** asset key -> url for the engine: null for a key the library does not have (the editor warns), else the hashed address. */
    app.assetUrl = function (key) {
      var a = app.assetByKey(key);
      if (a) { return a.url; }
      return app.assetsComplete ? null : '/media/' + encodeURIComponent(String(key).toLowerCase());
    };

    app.setAssets = function (list, complete) {
      app.assets = list;
      app.assetMap = new Map();
      list.forEach(function (a) { app.assetMap.set(D.lower(a.key), a); });
      app.assetsComplete = complete;
      app.emit('assets');
    };

    return app;
  };

  D.TOKEN_PATTERN = TOKEN_PATTERN;
})(window);
