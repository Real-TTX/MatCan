/* DesignThix editor, part 1: helpers, geometry, the state of the editor (document with pages and groups, selection, undo stack, preview values) and every command
   that changes the document. The other parts (designer.canvas.js, .menu.js, .toolbar.js, .panels.js, ...) only draw and call what is here. Plain JavaScript, no dependencies.
   Architecture, events and how to extend: docs/EDITOR.md.

   Rules for the whole editor: DOM is built with createElement/createElementNS + textContent (never innerHTML with data); a value that is data goes to the page through the
   CSSOM (style.setProperty, insertRule) or an SVG attribute, never through a style attribute in markup (CSP style-src 'self'). The document is the normalised document of
   DtEngine (docs/PLAN-CANVA.md section 2: pages, groups); the engine draws it, nothing else does.

   Document changes: app.edit(mutator, opts) (one undo step; opts.merge = key to coalesce typing/nudging, opts.render = 'now' | 'soon' | 'none', opts.structure),
   app.tx() for a gesture (the first change pushes one undo step). Events: 'doc' {reason, render, structure}, 'selection', 'history', 'page' (current page changed),
   'pages' (pages added/removed/moved), 'preview', 'state', 'fonts', 'assets', 'brand', 'zoom', 'readonly', 'editing', 'warnings', 'rendered', 'dirty'. */
(function (global) {
  'use strict';

  var D = global.DtDesigner = { version: 2 };
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var KEY_PATTERN = /^[A-Za-z][A-Za-z0-9_]{0,39}$/;
  var TOKEN_PATTERN = /\{\{\s*([A-Za-z][A-Za-z0-9_]*)\s*\}\}/g;
  var MAX_HISTORY = 100;
  var MAX_PAGES = 50;
  var MAX_PAGE_ELEMENTS = 500;
  D.SVG_NS = SVG_NS;
  D.KEY_PATTERN = KEY_PATTERN;
  D.TOKEN_PATTERN = TOKEN_PATTERN;
  D.CATEGORIES = ['Uploads', 'Flaggen', 'Siegel', 'Icons', 'Logos', 'Fotos', 'Hintergründe', 'Sonstiges'];
  D.FIELD_TYPES = [['text', 'Text'], ['multiline', 'Mehrzeiliger Text'], ['number', 'Zahl'], ['price', 'Preis'], ['image', 'Bild']];
  D.MAX_PAGES = MAX_PAGES;

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
    wrapped.pending = function () { return !!t; };
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

  /** An icon from the page sprite: the designer's own (dt-i-*) when it has the name, else the toolkit's (mat-i-*). */
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

  D.pxPerUnit = function (unit) { return unit === 'px' ? 1 : 96 / 25.4; };
  D.unitLabel = function (unit) { return unit === 'px' ? 'px' : 'mm'; };
  D.nudgeStep = function (doc) { return doc.unit === 'px' ? 1 : 0.5; };
  D.ptToUnit = function (pt, unit) { return global.DtEngine.ptToUnit(pt, unit); };
  D.isMac = /Mac|iPhone|iPad/.test(navigator.platform || '');
  D.modKey = D.isMac ? '⌘' : 'Strg';

  function normAngle(deg) {
    var a = deg % 360;
    if (a > 180) { a -= 360; }
    if (a <= -180) { a += 360; }
    return a;
  }
  D.normAngle = normAngle;

  /** A file size for people: 12 KB, 3,4 MB. */
  D.fileSize = function (bytes) {
    if (bytes < 1024) { return bytes + ' B'; }
    if (bytes < 1024 * 1024) { return D.round(bytes / 1024, 0) + ' KB'; }
    return D.round(bytes / 1024 / 1024, 1).toString().replace('.', ',') + ' MB';
  };

  // ================================================================================================ geometry

  /** The four corners of a box with rotation (around its centre): [top-left, top-right, bottom-right, bottom-left]. */
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

  D.boxOfPoints = function (pts) {
    var x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    pts.forEach(function (p) { x1 = Math.min(x1, p.x); y1 = Math.min(y1, p.y); x2 = Math.max(x2, p.x); y2 = Math.max(y2, p.y); });
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
  };

  /** The axis-aligned box around the (rotated) element, in the frame of its parent. */
  D.aabb = function (e) {
    if (!e.rotation) { return { x: e.x, y: e.y, w: e.w, h: e.h }; }
    return D.boxOfPoints(D.corners(e));
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

  // A group transforms its children like the engine does: flip (mirror around the centre of the box), then rotation around the centre.
  function groupForward(g, p) {
    var cx = g.x + g.w / 2;
    var cy = g.y + g.h / 2;
    var dx = (g.flipX ? -1 : 1) * (p.x - cx);
    var dy = (g.flipY ? -1 : 1) * (p.y - cy);
    var v = D.rotateVec({ x: dx, y: dy }, g.rotation || 0);
    return { x: cx + v.x, y: cy + v.y };
  }
  function groupBackward(g, p) {
    var cx = g.x + g.w / 2;
    var cy = g.y + g.h / 2;
    var v = D.rotateVec({ x: p.x - cx, y: p.y - cy }, -(g.rotation || 0));
    return { x: cx + (g.flipX ? -1 : 1) * v.x, y: cy + (g.flipY ? -1 : 1) * v.y };
  }

  D.groupForward = groupForward;
  D.groupBackward = groupBackward;

  /** Point of a node frame (the page coordinates of the children of the groups of `chain`, outermost first) to the page. */
  D.toWorld = function (chain, p) {
    var q = p;
    for (var i = chain.length - 1; i >= 0; i--) { q = groupForward(chain[i], q); }
    return q;
  };
  /** Page point to the frame of the node inside `chain`. */
  D.toFrame = function (chain, p) {
    var q = p;
    for (var i = 0; i < chain.length; i++) { q = groupBackward(chain[i], q); }
    return q;
  };
  D.chainRotated = function (chain) { return chain.some(function (g) { return !!(g.rotation || g.flipX || g.flipY); }); };

  /** Corners of a node (in its frame) on the page. */
  D.worldCorners = function (node, chain) {
    return D.corners(node).map(function (p) { return D.toWorld(chain, p); });
  };

  /** The transform attribute of an element the engine would write: rotation around the centre after the flip. */
  D.svgTransform = function (e) {
    var cx = e.x + e.w / 2;
    var cy = e.y + e.h / 2;
    var parts = [];
    if (e.rotation) { parts.push('rotate(' + D.round(e.rotation, 4) + ' ' + D.round(cx, 4) + ' ' + D.round(cy, 4) + ')'); }
    if (e.flipX || e.flipY) { parts.push('translate(' + D.round(cx, 4) + ' ' + D.round(cy, 4) + ') scale(' + (e.flipX ? -1 : 1) + ' ' + (e.flipY ? -1 : 1) + ') translate(' + D.round(-cx, 4) + ' ' + D.round(-cy, 4) + ')'); }
    return parts.length ? parts.join(' ') : null;
  };

  // ================================================================================================ API

  D.csrf = function () {
    var m = document.querySelector('meta[name="dt-csrf"]');
    return m ? m.getAttribute('content') : '';
  };

  /**
   * Resolves { status, ok, data } for any answer of the server; rejects with { offline: true } when there is no connection.
   * options: raw (body is a Blob/string), contentType, keepalive (the request survives the closing of the page; the body must stay below 64 KB), formData (a FormData body), signal (AbortSignal).
   */
  D.request = function (method, url, body, options) {
    var o = options || {};
    var headers = { Accept: 'application/json' };
    if (method !== 'GET') { headers.RequestVerificationToken = D.csrf(); }
    var init = { method: method, credentials: 'same-origin', headers: headers };
    if (o.keepalive) { init.keepalive = true; }
    if (o.signal) { init.signal = o.signal; }
    if (body !== undefined && body !== null) {
      if (o.formData) { init.body = body; }
      else if (o.raw) { init.body = body; headers['Content-Type'] = o.contentType || 'application/octet-stream'; }
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

  // ================================================================================================ icon library (wwwroot/lib/icons.json)

  var iconLib = { promise: null, data: null };
  D.icons = {
    /** Loads the library once (the service worker caches it). Resolves with { categories, icons } or null when it is not available. */
    load: function () {
      if (!iconLib.promise) {
        iconLib.promise = fetch('/lib/icons.json', { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (data) { iconLib.data = data; return data; }, function () { return null; });
      }
      return iconLib.promise;
    },
    /** For the engine's opts.icon: the body of a Lucide icon (a Promise while the library loads). */
    body: function (name) {
      if (iconLib.data) { var i = iconLib.data.icons[name]; return i ? i.b : null; }
      return D.icons.load().then(function (data) { var i = data && data.icons[name]; return i ? i.b : null; });
    },
    ready: function () { return !!iconLib.data; },
    /** The library when it is loaded (else null): { categories, icons: { name: { b, t, c } } }. */
    library: function () { return iconLib.data; },
  };

  // ================================================================================================ the document (pages, groups)

  /** Calls fn(node, list, index, chain) for every node (groups first, then their children), bottom first. chain = the groups around the node, outermost first. */
  D.walk = function (list, fn, chain) {
    var c = chain || [];
    for (var i = 0; i < list.length; i++) {
      var node = list[i];
      if (fn(node, list, i, c) === false) { return false; }
      if (node.type === 'group' && D.walk(node.children, fn, c.concat([node])) === false) { return false; }
    }
    return true;
  };

  D.walkDoc = function (doc, fn) {
    doc.pages.forEach(function (p, pi) { D.walk(p.elements, function (node, list, i, chain) { return fn(node, list, i, chain, pi); }); });
  };

  /** Sets the box of every group to the union of its children (bottom up) and removes groups without children. */
  D.fixGroups = function (list) {
    for (var i = list.length - 1; i >= 0; i--) {
      var g = list[i];
      if (g.type !== 'group') { continue; }
      D.fixGroups(g.children);
      if (!g.children.length) { list.splice(i, 1); continue; }
      var box = D.unionBox(g.children.map(D.aabb));
      g.x = D.round(box.x, 4); g.y = D.round(box.y, 4); g.w = D.round(box.w, 4); g.h = D.round(box.h, 4);
    }
  };
  D.fixGroupsDoc = function (doc) { doc.pages.forEach(function (p) { D.fixGroups(p.elements); }); };

  /** Depth of nested groups below a node (a node that is no group: 0). */
  D.groupDepth = function (node) {
    if (node.type !== 'group') { return 0; }
    return 1 + node.children.reduce(function (m, c) { return Math.max(m, D.groupDepth(c)); }, 0);
  };

  D.countNodes = function (list) { var n = 0; D.walk(list, function () { n++; }); return n; };

  /** Moves a node by (dx, dy) in its frame: a group moves its children (page coordinates) too. */
  D.translate = function (node, dx, dy) {
    node.x = D.round(node.x + dx, 4);
    node.y = D.round(node.y + dy, 4);
    if (node.type === 'group') { node.children.forEach(function (c) { D.translate(c, dx, dy); }); }
  };

  /** Sets the box of a node (a group scales its children). nb = { x, y, w, h }. */
  D.setBox = function (node, nb) {
    if (node.type === 'group') {
      var from = { x: node.x, y: node.y, w: node.w, h: node.h };
      scaleDescendants(node, from, nb);
    }
    node.x = D.round(nb.x, 4); node.y = D.round(nb.y, 4); node.w = D.round(nb.w, 4); node.h = D.round(nb.h, 4);
  };

  function scaleDescendants(g, from, to) {
    var fx = from.w > 0 ? to.w / from.w : 1;
    var fy = from.h > 0 ? to.h / from.h : 1;
    g.children.forEach(function (c) {
      var cx = to.x + (c.x + c.w / 2 - from.x) * fx;
      var cy = to.y + (c.y + c.h / 2 - from.y) * fy;
      var old = { x: c.x, y: c.y, w: c.w, h: c.h };
      var next = { x: 0, y: 0, w: c.w * fx, h: c.h * fy };
      next.x = cx - next.w / 2;
      next.y = cy - next.h / 2;
      if (c.type === 'group') { scaleDescendants(c, old, next); }
      c.x = D.round(next.x, 4); c.y = D.round(next.y, 4); c.w = D.round(next.w, 4); c.h = D.round(next.h, 4);
    });
  }

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

  /** All element ids of the document (every page, every group level). */
  function allIds(doc) {
    var used = new Set();
    D.walkDoc(doc, function (n) { used.add(n.id); });
    return used;
  }

  /** A generator of ids ('e12') that are not used anywhere in the document. */
  D.idMaker = function (doc, extraUsed) {
    var used = allIds(doc);
    (extraUsed || []).forEach(function (id) { used.add(id); });
    var n = 0;
    used.forEach(function (id) { var m = /^e(\d+)$/.exec(id); if (m) { n = Math.max(n, Number(m[1])); } });
    return function () {
      do { n++; } while (used.has('e' + n));
      used.add('e' + n);
      return 'e' + n;
    };
  };

  D.pageIdMaker = function (doc) {
    var used = new Set(doc.pages.map(function (p) { return p.id; }));
    var n = 0;
    used.forEach(function (id) { var m = /^p(\d+)$/.exec(id); if (m) { n = Math.max(n, Number(m[1])); } });
    return function () { do { n++; } while (used.has('p' + n)); used.add('p' + n); return 'p' + n; };
  };

  /** A deep copy with new ids for every node (nextId from D.idMaker), moved by (dx, dy). */
  D.cloneNodes = function (sources, nextId, dx, dy) {
    var clone = function (src) {
      var c = D.clone(src);
      var rename = function (node) {
        node.id = nextId();
        node.locked = false;
        if (node.type === 'group') { node.children.forEach(rename); }
      };
      rename(c);
      if (dx || dy) { D.translate(c, dx, dy); }
      return c;
    };
    return sources.map(clone);
  };

  D.typeLabel = function (e) {
    if (e.type === 'text') { return 'Text'; }
    if (e.type === 'image') { return e.source ? 'Bild' : 'Rahmen'; }
    if (e.type === 'imageStrip') { return 'Bildleiste'; }
    if (e.type === 'icon') { return 'Icon'; }
    if (e.type === 'qr') { return 'QR-Code'; }
    if (e.type === 'barcode') { return 'Barcode'; }
    if (e.type === 'group') { return 'Gruppe'; }
    var shapes = { rect: 'Rechteck', ellipse: 'Kreis', line: 'Linie', triangle: 'Dreieck', diamond: 'Raute', pentagon: 'Fünfeck', hexagon: 'Sechseck', star: 'Stern', heart: 'Herz', arrow: 'Pfeil', speech: 'Sprechblase' };
    return shapes[e.shape] || 'Form';
  };

  /** The name shown in the layers panel: the own name, else something that tells the element apart. */
  D.elementTitle = function (e) {
    if (e.name) { return e.name; }
    if (e.type === 'text') {
      var line = String(e.text || '').split(/\r?\n/)[0].trim();
      return line ? (line.length > 28 ? line.slice(0, 27) + '…' : line) : 'Text';
    }
    if (e.type === 'image' && e.source) { return 'Bild: ' + (e.source.field ? '{{' + e.source.field + '}}' : e.source.asset); }
    if (e.type === 'icon') { return 'Icon: ' + e.icon; }
    if (e.type === 'qr') { return 'QR-Code'; }
    if (e.type === 'barcode') { return 'Barcode ' + (e.value || ''); }
    return D.typeLabel(e);
  };

  D.elementIcon = function (e) {
    var map = { text: 'type', image: 'image', imageStrip: 'gallery-horizontal-end', icon: 'sticker', qr: 'qr-code', barcode: 'barcode', group: 'group' };
    if (map[e.type]) { return map[e.type]; }
    var shapes = { rect: 'square', ellipse: 'circle', line: 'minus', triangle: 'triangle', diamond: 'diamond', pentagon: 'pentagon', hexagon: 'hexagon', star: 'star', heart: 'heart', arrow: 'arrow-right', speech: 'message-square' };
    return shapes[e.shape] || 'square';
  };

  /** Applies the engine's defaults to a partial element (so a new element has every property the engine knows). */
  D.withDefaults = function (partial, unit) {
    var doc = global.DtEngine.normalize({ unit: unit || 'mm', pages: [{ elements: [partial] }] });
    return doc.pages[0].elements[0];
  };

  /** Colours the document uses (hex, in order of first use). */
  D.documentColours = function (doc) {
    var seen = new Set();
    var out = [];
    var add = function (c) { if (typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c) && !seen.has(c.toLowerCase())) { seen.add(c.toLowerCase()); out.push(c.toLowerCase()); } };
    doc.pages.forEach(function (p) { add(p.background.color); });
    D.walkDoc(doc, function (e) {
      add(e.color); add(e.stroke); add(typeof e.fill === 'string' ? e.fill : null);
      if (e.fill && typeof e.fill === 'object') { e.fill.stops.forEach(function (s) { add(s.color); }); }
      if (e.outline) { add(e.outline.color); }
      if (e.background && typeof e.background === 'object') { add(e.background.color); }
      if (e.border) { add(e.border.color); }
    });
    return out;
  };

  /** Scales every length of nodes by G (geometry, in document units) and s (point sizes: font size, stroke widths). Used when a template of another size is applied. */
  D.scaleNodes = function (list, G, s) {
    D.walk(list, function (n) {
      ['x', 'y', 'w', 'h', 'radius', 'gap'].forEach(function (k) { if (D.isNum(n[k])) { n[k] = D.round(n[k] * G, 4); } });
      if (n.type === 'text') {
        n.fontSize = D.round(n.fontSize * s, 3); n.minFontSize = D.round(Math.min(n.fontSize, n.minFontSize * s), 3);
        if (n.outline) { n.outline.width = D.round(n.outline.width * s, 3); }
        if (n.background && typeof n.background === 'object') { n.background.radius = D.round(n.background.radius * G, 4); n.background.padding = D.round(n.background.padding * G, 4); }
      }
      if (n.type === 'shape') { n.strokeWidth = D.round(n.strokeWidth * s, 3); }
      if (n.border) { n.border.width = D.round(n.border.width * s, 3); }
      if (n.shadow) { n.shadow.blur = D.round(n.shadow.blur * G, 3); n.shadow.x = D.round(n.shadow.x * G, 3); n.shadow.y = D.round(n.shadow.y * G, 3); }
    });
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
      pageIndex: 0,
      sel: [],
      zoom: 1,
      fitMode: true,
      snapping: true,
      presets: config.presets || [],
      fonts: [],
      fontIndex: [],
      defaultFamily: 'sans-serif',
      brand: { colors: [], fonts: { heading: null, subheading: null, body: null }, logos: [], logoAssets: [] },
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
      styleClip: null,
      pasteCount: 0,
      editing: null,
      warnings: [],
    };

    // ---------------------------------------------------------------------------------------- events
    app.on = function (name, fn) { (listeners[name] = listeners[name] || []).push(fn); return fn; };
    app.off = function (name, fn) { listeners[name] = (listeners[name] || []).filter(function (f) { return f !== fn; }); };
    app.emit = function (name, a, b) {
      (listeners[name] || []).slice().forEach(function (fn) {
        try { fn(a, b); } catch (e) { if (global.console) { console.error('designer listener "' + name + '"', e); } }
      });
    };

    // ---------------------------------------------------------------------------------------- reading
    app.page = function () { return app.doc.pages[app.pageIndex]; };
    app.elements = function () { return app.doc.pages[app.pageIndex].elements; };

    function locateIn(list, id, chain) {
      for (var i = 0; i < list.length; i++) {
        var n = list[i];
        if (n.id === id) { return { el: n, list: list, index: i, chain: chain }; }
        if (n.type === 'group') {
          var inner = locateIn(n.children, id, chain.concat([n]));
          if (inner) { return inner; }
        }
      }
      return null;
    }

    /** { el, list, index, chain, pageIndex } of a node (current page first; anyPage: the other pages too), or null. */
    app.locate = function (id, anyPage) {
      var r = locateIn(app.elements(), id, []);
      if (r) { r.pageIndex = app.pageIndex; return r; }
      if (!anyPage) { return null; }
      for (var p = 0; p < app.doc.pages.length; p++) {
        if (p === app.pageIndex) { continue; }
        r = locateIn(app.doc.pages[p].elements, id, []);
        if (r) { r.pageIndex = p; return r; }
      }
      return null;
    };
    /** A node of any page (groups and children included). */
    app.element = function (id) { var r = app.locate(id, true); return r ? r.el : null; };
    app.has = function (id) { return !!app.locate(id, false); };
    app.selected = function () { return app.sel.map(function (id) { return app.locate(id, false); }).filter(Boolean).map(function (r) { return r.el; }); };
    app.isSelected = function (id) { return app.sel.indexOf(id) >= 0; };
    app.single = function () { return app.sel.length === 1 ? app.element(app.sel[0]) : null; };
    app.editable = function () { return app.canEdit && !app.readOnly; };
    app.unit = function () { return app.doc ? app.doc.unit : 'mm'; };
    /** CSS px per document unit at the current zoom. */
    app.scale = function () { return D.pxPerUnit(app.unit()) * app.zoom; };
    /** The frame of the selection: the chain of groups the selected nodes sit in (they share one), or [] */
    app.selectionChain = function () {
      var r = app.sel.length ? app.locate(app.sel[0], false) : null;
      return r ? r.chain : [];
    };

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
    function snapshot() { return { json: JSON.stringify(app.doc), sel: app.sel.slice(), page: app.pageIndex }; }

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
      var pageCountBefore = app.doc.pages.length;
      app.doc = global.DtEngine.normalize(JSON.parse(s.json));
      app.lastMerge = null;
      app.pageIndex = D.clamp(s.page, 0, app.doc.pages.length - 1);
      app.sel = s.sel.filter(function (id) { return app.has(id); });
      app.markDirty();
      app.emit('doc', { reason: 'history', render: 'now', structure: true });
      if (pageCountBefore !== app.doc.pages.length) { app.emit('pages'); }
      app.emit('page');
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
     * opts: merge (key: changes with the same key within mergeMs are one step), render ('now' | 'soon' | 'none'), structure (elements, pages or fields added/removed/moved), reason.
     */
    app.edit = function (mutator, opts) {
      if (!app.editable()) { return false; }
      var o = opts || {};
      pushHistory(o.merge, o.mergeMs);
      mutator(app.doc);
      D.fixGroupsDoc(app.doc);
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
          D.fixGroupsDoc(app.doc);
          app.markDirty();
          app.emit('doc', { reason: o.reason || 'gesture', render: o.render || 'soon', structure: !!o.structure });
          return true;
        },
        started: function () { return started; },
      };
    };

    app.setDocument = function (doc, options) {
      var o = options || {};
      app.doc = global.DtEngine.normalize(doc);
      app.pageIndex = D.clamp(o.page || 0, 0, app.doc.pages.length - 1);
      app.sel = [];
      app.undoStack = [];
      app.redoStack = [];
      app.lastMerge = null;
      app.emit('doc', { reason: o.reason || 'load', render: 'now', structure: true });
      app.emit('pages');
      app.emit('page');
      app.emit('selection');
      app.emit('history');
    };

    // ---------------------------------------------------------------------------------------- selection
    app.select = function (ids, opts) {
      var next = (ids || []).filter(function (id, i, a) { return a.indexOf(id) === i && app.has(id); });
      // one selection lives in one list: the siblings of the first node
      if (next.length > 1) {
        var first = app.locate(next[0], false);
        next = next.filter(function (id) { var r = app.locate(id, false); return r && r.list === first.list; });
      }
      if (D.same(next, app.sel)) { return; }
      app.sel = next;
      app.emit('selection', opts || {});
    };
    app.toggleSelect = function (id) {
      if (app.isSelected(id)) { app.select(app.sel.filter(function (s) { return s !== id; })); return; }
      var first = app.sel.length ? app.locate(app.sel[0], false) : null;
      var mine = app.locate(id, false);
      if (first && mine && first.list !== mine.list) { app.select([id]); return; }
      app.select(app.sel.concat([id]));
    };
    app.selectAll = function () {
      var list = app.elements();
      var r = app.sel.length ? app.locate(app.sel[0], false) : null;
      if (r && r.chain.length) { list = r.list; }   // inside a group: all its children
      app.select(list.filter(function (e) { return !e.locked && !e.hidden; }).map(function (e) { return e.id; }));
    };

    // ---------------------------------------------------------------------------------------- pages
    app.setPage = function (index) {
      var i = D.clamp(index, 0, app.doc.pages.length - 1);
      if (i === app.pageIndex) { return; }
      if (app.editing && app.editing.commit) { app.editing.commit(); }
      app.pageIndex = i;
      app.sel = [];
      app.emit('page');
      app.emit('selection');
      app.emit('doc', { reason: 'page', render: 'now', structure: true });
    };

    app.addPage = function (afterIndex) {
      if (!app.editable()) { return false; }
      if (app.doc.pages.length >= MAX_PAGES) { D.toast('Ein Design kann höchstens ' + MAX_PAGES + ' Seiten haben.', 'warning'); return false; }
      var at = D.isNum(afterIndex) ? afterIndex + 1 : app.doc.pages.length;
      var current = app.page();
      var makeId = D.pageIdMaker(app.doc);
      app.edit(function (doc) {
        doc.pages.splice(at, 0, { id: makeId(), name: '', background: D.clone(current.background), elements: [] });
        app.pageIndex = at;
        app.sel = [];
      }, { structure: true, reason: 'pages' });
      app.emit('pages');
      app.emit('page');
      app.emit('selection');
      return true;
    };

    app.duplicatePage = function (index) {
      if (!app.editable()) { return false; }
      if (app.doc.pages.length >= MAX_PAGES) { D.toast('Ein Design kann höchstens ' + MAX_PAGES + ' Seiten haben.', 'warning'); return false; }
      var i = D.isNum(index) ? index : app.pageIndex;
      var source = app.doc.pages[i];
      if (!source) { return false; }
      var makeId = D.pageIdMaker(app.doc);
      var nextId = D.idMaker(app.doc);
      var copy = D.clone(source);
      copy.id = makeId();
      copy.elements = D.cloneNodes(source.elements, nextId, 0, 0);
      app.edit(function (doc) { doc.pages.splice(i + 1, 0, copy); app.pageIndex = i + 1; app.sel = []; }, { structure: true, reason: 'pages' });
      app.emit('pages');
      app.emit('page');
      app.emit('selection');
      return true;
    };

    app.deletePage = function (index) {
      if (!app.editable()) { return false; }
      var i = D.isNum(index) ? index : app.pageIndex;
      if (app.doc.pages.length < 2) { D.toast('Das Design braucht mindestens eine Seite.', 'warning'); return false; }
      app.edit(function (doc) {
        doc.pages.splice(i, 1);
        app.pageIndex = D.clamp(i > app.pageIndex ? app.pageIndex : (i === app.pageIndex ? Math.min(i, doc.pages.length - 1) : app.pageIndex - 1), 0, doc.pages.length - 1);
        app.sel = [];
      }, { structure: true, reason: 'pages' });
      app.emit('pages');
      app.emit('page');
      app.emit('selection');
      return true;
    };

    app.movePage = function (from, to) {
      if (!app.editable()) { return false; }
      var n = app.doc.pages.length;
      var target = D.clamp(to, 0, n - 1);
      if (from === target || from < 0 || from >= n) { return false; }
      var currentId = app.page().id;
      app.edit(function (doc) {
        var p = doc.pages.splice(from, 1)[0];
        doc.pages.splice(target, 0, p);
        app.pageIndex = doc.pages.findIndex(function (x) { return x.id === currentId; });
      }, { structure: true, reason: 'pages' });
      app.emit('pages');
      app.emit('page');
      return true;
    };

    app.renamePage = function (index, name) {
      app.edit(function (doc) { doc.pages[index].name = String(name || '').slice(0, 80); }, { structure: true, reason: 'pages', render: 'none' });
      app.emit('pages');
    };

    app.setBackground = function (patch, opts) {
      var o = opts || {};
      app.edit(function (doc) { Object.assign(doc.pages[app.pageIndex].background, patch); }, { merge: o.merge === false ? undefined : (o.merge || 'bg'), mergeMs: o.mergeMs || 1200, reason: 'background' });
    };

    // ---------------------------------------------------------------------------------------- element defaults
    function pageSizePt() { return app.doc.unit === 'px' ? app.doc.width * 0.75 : app.doc.width * 72 / 25.4; }
    D.pageWidthPt = pageSizePt;

    /** A good starting font size in points for body text: about 1/28 of the page width (150 mm: 15 pt). */
    function baseFontPt() { return D.clamp(Math.round(pageSizePt() / 28), 8, 120); }
    app.baseFontPt = baseFontPt;

    var SHAPE_KINDS = ['rect', 'rounded', 'ellipse', 'triangle', 'diamond', 'pentagon', 'hexagon', 'star', 'star8', 'heart', 'arrow', 'speech'];

    /** The family a new text gets: the brand font of that role when the library has it, else the default of the library. */
    app.familyFor = function (role) {
      var f = app.brand && app.brand.fonts ? app.brand.fonts[role] : null;
      if (f && app.fontIndex.some(function (x) { return x.family === f; })) { return f; }
      return app.defaultFamily;
    };

    /** A new element with every property the engine knows, centred on the page. kind: text | heading | subheading | body | placeholder | <shape kind> | line | frame[-circle|...] | image | strip | qr | ean13 | ean8 | code128 | icon. */
    app.newElement = function (kind, extra) {
      var doc = app.doc;
      var w = doc.width;
      var h = doc.height;
      var id = D.idMaker(doc)();
      var pt = baseFontPt();
      var e;
      var common = { id: id, x: 0, y: 0, w: 0, h: 0 };
      if (kind === 'text' || kind === 'heading' || kind === 'subheading' || kind === 'body' || kind === 'placeholder') {
        var role = kind === 'heading' ? 'heading' : (kind === 'subheading' ? 'subheading' : 'body');
        var size = kind === 'heading' ? Math.round(pt * 2.4) : (kind === 'subheading' ? Math.round(pt * 1.5) : (kind === 'text' || kind === 'placeholder' ? Math.round(pt * 1.2) : pt));
        var tw = w * (kind === 'heading' ? 0.8 : (kind === 'subheading' ? 0.7 : 0.55));
        var th = D.ptToUnit(size, doc.unit) * 1.2 * 1.25;
        var label = { text: 'Text', heading: 'Überschrift hinzufügen', subheading: 'Zwischenüberschrift hinzufügen', body: 'Fließtext hinzufügen', placeholder: 'Text' }[kind];
        e = Object.assign(common, {
          type: 'text', x: (w - tw) / 2, y: (h - th) / 2, w: tw, h: th, text: label,
          fontFamily: app.familyFor(role), fontSize: size, fontWeight: kind === 'heading' ? 700 : (kind === 'subheading' ? 600 : 400), color: '#000000',
          align: kind === 'body' ? 'left' : 'center',
        });
        if (kind === 'text') { e.align = 'left'; e.text = 'Text'; }
      } else if (SHAPE_KINDS.indexOf(kind) >= 0) {
        var sw = Math.min(w, h) * 0.3;
        var sh = kind === 'rect' || kind === 'rounded' ? Math.min(h * 0.25, sw * 1.2) : sw;
        var shape = kind === 'rounded' ? 'rect' : (kind === 'star8' ? 'star' : kind);
        e = Object.assign(common, { type: 'shape', shape: shape, x: (w - sw) / 2, y: (h - sh) / 2, w: sw, h: sh, fill: '#1fb3d6', stroke: null, strokeWidth: 1 });
        if (kind === 'rounded') { e.radius = D.round(Math.min(sw, sh) * 0.2, 2); }
        if (kind === 'star8') { e.points = 8; e.innerRadius = 0.6; }
        if (kind === 'heart') { e.fill = '#e5484d'; }
      } else if (kind === 'line') {
        var lw = w * 0.4;
        e = Object.assign(common, { type: 'shape', shape: 'line', x: (w - lw) / 2, y: h / 2, w: lw, h: 0, fill: null, stroke: '#000000', strokeWidth: Math.max(1, D.round(pt / 8, 1)) });
      } else if (kind.indexOf('frame') === 0) {
        var mask = { frame: 'none', 'frame-rounded': 'rounded', 'frame-circle': 'circle', 'frame-heart': 'heart', 'frame-star': 'star', 'frame-hexagon': 'hexagon', 'frame-triangle': 'triangle' }[kind] || 'none';
        var side = Math.min(w, h) * 0.4;
        e = Object.assign(common, { type: 'image', x: (w - side) / 2, y: (h - side) / 2, w: mask === 'none' || mask === 'rounded' ? side * 1.2 : side, h: side, source: null, fit: 'cover', mask: mask });
        if (mask === 'rounded') { e.radius = D.round(side * 0.12, 2); }
        e.x = (w - e.w) / 2;
      } else if (kind === 'image') {
        var is = Math.min(w, h) * 0.3;
        e = Object.assign(common, { type: 'image', x: (w - is) / 2, y: (h - is) / 2, w: is, h: is, source: null, fit: 'contain' });
      } else if (kind === 'strip') {
        var stw = w * 0.6;
        var sth = Math.min(h * 0.18, stw / 4);
        e = Object.assign(common, { type: 'imageStrip', x: (w - stw) / 2, y: (h - sth) / 2, w: stw, h: sth, items: [null, null, null, null], gap: D.round(sth * 0.15, 2), align: 'left' });
      } else if (kind === 'qr') {
        var qs = Math.min(w, h) * 0.35;
        e = Object.assign(common, { type: 'qr', x: (w - qs) / 2, y: (h - qs) / 2, w: qs, h: qs, value: 'https://' });
      } else if (kind === 'ean13' || kind === 'ean8' || kind === 'code128') {
        var bw = Math.min(w * 0.6, h * 1.4);
        var bh = bw * 0.55;
        e = Object.assign(common, { type: 'barcode', x: (w - bw) / 2, y: (h - bh) / 2, w: bw, h: bh, format: kind, value: kind === 'ean13' ? '4006381333931' : (kind === 'ean8' ? '96385074' : 'DesignThix') });
      } else if (kind === 'icon') {
        var ic = Math.min(w, h) * 0.2;
        e = Object.assign(common, { type: 'icon', x: (w - ic) / 2, y: (h - ic) / 2, w: ic, h: ic, icon: 'star', color: '#000000', strokeWidth: 2 });
      } else {
        return null;
      }
      Object.keys(extra || {}).forEach(function (k) { e[k] = extra[k]; });
      ['x', 'y', 'w', 'h'].forEach(function (k) { e[k] = D.round(e[k], 2); });
      return D.withDefaults(e, doc.unit);
    };

    /** Adds an element on top of the current page, selects it. Returns its id (null when the page is full). */
    app.addElement = function (kind, extra, opts) {
      if (!app.editable()) { return null; }
      if (D.countNodes(app.elements()) >= MAX_PAGE_ELEMENTS) { D.toast('Eine Seite kann höchstens ' + MAX_PAGE_ELEMENTS + ' Elemente haben.', 'warning'); return null; }
      var e = app.newElement(kind, extra);
      if (!e) { return null; }
      var o = opts || {};
      app.edit(function (doc) {
        if (kind === 'placeholder' && !o.noField) {
          var key = app.freeKey('Feld');
          doc.fields.push({ key: key, label: 'Feld ' + key.replace(/^Feld/, ''), type: 'text', sample: 'Beispieltext', decimals: null, category: null, required: false });
          e.text = '{{' + key + '}}';
        }
        doc.pages[app.pageIndex].elements.push(e);
      }, { structure: true, reason: 'add' });
      app.select([e.id]);
      return e.id;
    };

    /** Adds ready elements (a template, pasted elements): new ids are the caller's business. Selects them. */
    app.addNodes = function (nodes, fields, reason) {
      if (!app.editable() || !nodes.length) { return false; }
      if (D.countNodes(app.elements()) + nodes.reduce(function (n, x) { return n + D.countNodes([x]); }, 0) > MAX_PAGE_ELEMENTS) { D.toast('Eine Seite kann höchstens ' + MAX_PAGE_ELEMENTS + ' Elemente haben.', 'warning'); return false; }
      app.edit(function (doc) {
        (fields || []).forEach(function (f) { if (!D.fieldByKey(doc, f.key)) { doc.fields.push(D.clone(f)); } });
        nodes.forEach(function (n) { doc.pages[app.pageIndex].elements.push(n); });
      }, { structure: true, reason: reason || 'add' });
      app.select(nodes.map(function (n) { return n.id; }));
      return true;
    };

    app.freeKey = function (base) {
      var n = 1;
      while (D.fieldByKey(app.doc, base + n)) { n++; }
      return base + n;
    };

    // ---------------------------------------------------------------------------------------- generic property change
    /** Sets properties on the nodes with the given ids (a patch object, or a function (node) -> patch). Typing in a field passes merge so it is one step. */
    app.setProps = function (ids, patch, opts) {
      var o = opts || {};
      var list = ids.filter(function (id) { return app.has(id); });
      if (!list.length) { return false; }
      return app.edit(function () {
        list.forEach(function (id) {
          var e = app.locate(id, false).el;
          var p = typeof patch === 'function' ? patch(e) : patch;
          Object.keys(p).forEach(function (k) { e[k] = p[k]; });
        });
      }, { merge: o.merge === false ? undefined : (o.merge || 'props:' + list.join(',') + ':' + (typeof patch === 'function' ? 'fn' : Object.keys(patch).join(','))), mergeMs: o.mergeMs, render: o.render || 'now', structure: !!o.structure, reason: 'props' });
    };

    /** Sets a box (x, y, w, h partly) of one node; a group moves/scales its children. */
    app.setNodeBox = function (id, patch, opts) {
      var r = app.locate(id, false);
      if (!r) { return false; }
      var o = opts || {};
      return app.edit(function () {
        var e = r.el;
        var nb = { x: e.x, y: e.y, w: e.w, h: e.h };
        Object.keys(patch).forEach(function (k) { nb[k] = patch[k]; });
        if (e.type === 'group') { D.setBox(e, nb); } else { e.x = nb.x; e.y = nb.y; e.w = nb.w; e.h = nb.h; }
      }, { merge: o.merge === false ? undefined : 'box:' + id + ':' + Object.keys(patch).join(','), mergeMs: o.mergeMs || 1200, reason: 'props' });
    };

    // ---------------------------------------------------------------------------------------- delete, duplicate, copy, paste
    app.deleteIds = function (ids) {
      var list = ids.filter(function (id) { return app.has(id); });
      if (!list.length) { return; }
      app.edit(function () {
        list.forEach(function (id) { var r = app.locate(id, false); if (r) { r.list.splice(r.index, 1); } });
      }, { structure: true, reason: 'delete' });
      app.select(app.sel.filter(function (id) { return app.has(id); }));
    };
    app.deleteSelection = function () {
      if (!app.editable() || !app.sel.length) { return; }
      var ids = app.sel.filter(function (id) { var r = app.locate(id, false); return r && !r.el.locked; });
      if (!ids.length) { return; }
      app.deleteIds(ids);
    };

    function fieldsUsedBy(nodes) {
      var keys = new Set();
      D.walk(nodes, function (e) {
        if (e.showIf) { keys.add(D.lower(e.showIf)); }
        if (e.type === 'text') { D.tokensOf(e.text).forEach(function (k) { keys.add(D.lower(k)); }); }
        if (e.type === 'qr' || e.type === 'barcode') { D.tokensOf(e.value).forEach(function (k) { keys.add(D.lower(k)); }); }
        if (e.type === 'image' && e.source && e.source.field) { keys.add(D.lower(e.source.field)); }
        if (e.type === 'imageStrip') { e.items.forEach(function (it) { if (it && it.field) { keys.add(D.lower(it.field)); } }); }
      });
      return app.doc.fields.filter(function (f) { return keys.has(D.lower(f.key)); });
    }

    app.duplicateSelection = function () {
      if (!app.editable() || !app.sel.length) { return; }
      var sources = app.selected().filter(function (e) { return !e.hidden; });
      if (!sources.length) { return; }
      var step = app.doc.unit === 'px' ? 20 : 5;
      var copies = D.cloneNodes(sources, D.idMaker(app.doc), step, step);
      var firstLoc = app.locate(sources[0].id, false);
      var list = firstLoc.list;
      app.edit(function () { copies.forEach(function (c) { list.push(c); }); }, { structure: true, reason: 'duplicate' });
      app.select(copies.map(function (c) { return c.id; }));
    };

    /** The text for the system clipboard (marked, so a paste knows it) and the internal copy (also kept in localStorage dt-clipboard for other designs). */
    app.copySelection = function () {
      var els = app.selected();
      if (!els.length) { return null; }
      var payload = { designThix: 2, elements: D.clone(els), fields: D.clone(fieldsUsedBy(els)), unit: app.doc.unit, designId: app.id, pageId: app.page().id, width: app.doc.width, height: app.doc.height };
      app.clip = payload;
      app.pasteCount = 0;
      var json = JSON.stringify(payload);
      try { localStorage.setItem('dt-clipboard', json); } catch (e) { /* storage full or blocked */ }
      return json;
    };

    /** The payload of a clipboard text of this app (or null). */
    app.parseClip = function (text) {
      if (!text) { return null; }
      try {
        var parsed = JSON.parse(text);
        if (parsed && (parsed.designThix === 2 || parsed.designThix === 1) && Array.isArray(parsed.elements)) { return parsed; }
      } catch (e) { /* plain text */ }
      return null;
    };

    app.storedClip = function () {
      if (app.clip) { return app.clip; }
      try { return app.parseClip(localStorage.getItem('dt-clipboard')); } catch (e) { return null; }
    };

    /** Pastes copied elements (same page: shifted by 5 mm each time, else in place); plain text becomes a text element. Returns true when something was pasted. */
    app.paste = function (text) {
      if (!app.editable()) { return false; }
      var data = app.parseClip(text);
      if (!data && !text) { data = app.storedClip(); }
      if (!data) {
        if (text && /\S/.test(text)) { return !!app.addElement('text', { text: text.slice(0, 5000), w: app.doc.width * 0.6, h: app.doc.height * 0.2 }); }
        return false;
      }
      var sameSpot = data.designId === app.id && data.pageId === app.page().id;
      if (sameSpot) { app.pasteCount++; } else { app.pasteCount = 0; }
      var unit = app.doc.unit;
      var step = (unit === 'px' ? 20 : 5) * (sameSpot ? app.pasteCount : 0);
      var nodes = data.elements;
      if (data.unit && data.unit !== unit) {
        var u = unit === 'px' ? 96 / 25.4 : 25.4 / 96;
        nodes = D.clone(nodes);
        D.scaleNodes(nodes, u, 1);
      }
      var copies = D.cloneNodes(nodes, D.idMaker(app.doc), step, step);
      return app.addNodes(copies, data.fields || [], 'paste');
    };

    // style copy / paste
    var STYLE_KEYS = {
      text: ['fontFamily', 'fontWeight', 'italic', 'color', 'align', 'valign', 'lineHeight', 'letterSpacing', 'uppercase', 'underline', 'strike', 'outline', 'background', 'shadow', 'opacity'],
      shape: ['fill', 'stroke', 'strokeWidth', 'dash', 'radius', 'shadow', 'opacity'],
      image: ['border', 'mask', 'filters', 'radius', 'fit', 'shadow', 'opacity'],
      icon: ['color', 'strokeWidth', 'shadow', 'opacity'],
      qr: ['color', 'background', 'opacity'],
      barcode: ['color', 'background', 'opacity'],
      imageStrip: ['mask', 'border', 'gap', 'opacity'],
      group: ['opacity', 'shadow'],
    };
    app.copyStyle = function () {
      var e = app.single();
      if (!e) { return false; }
      var keys = STYLE_KEYS[e.type] || [];
      var style = {};
      keys.forEach(function (k) { style[k] = D.clone(e[k] === undefined ? null : e[k]); });
      app.styleClip = { type: e.type, style: style };
      D.toast('Stil kopiert.');
      return true;
    };
    app.canPasteStyle = function () {
      if (!app.styleClip || !app.sel.length) { return false; }
      return app.selected().some(function (e) { return e.type === app.styleClip.type; });
    };
    app.pasteStyle = function () {
      if (!app.canPasteStyle()) { return; }
      var clip = app.styleClip;
      var ids = app.selected().filter(function (e) { return e.type === clip.type && !e.locked; }).map(function (e) { return e.id; });
      app.setProps(ids, function () { return D.clone(clip.style); }, { merge: false });
    };

    // ---------------------------------------------------------------------------------------- move
    app.nudge = function (dx, dy) {
      var els = app.selected().filter(function (e) { return !e.locked; });
      if (!els.length) { return; }
      var ids = els.map(function (e) { return e.id; });
      app.edit(function () {
        ids.forEach(function (id) { var r = app.locate(id, false); if (r) { D.translate(r.el, dx, dy); } });
      }, { merge: 'nudge:' + ids.join(','), mergeMs: 700, reason: 'nudge' });
    };

    // ---------------------------------------------------------------------------------------- order
    /** mode: front | back | forward | backward (within the list the selection sits in). */
    app.order = function (mode) {
      if (!app.sel.length) { return; }
      var ids = app.sel.slice();
      var first = app.locate(ids[0], false);
      if (!first) { return; }
      app.edit(function () {
        var list = first.list;
        var chosen = list.filter(function (e) { return ids.indexOf(e.id) >= 0; });
        var rest = list.filter(function (e) { return ids.indexOf(e.id) < 0; });
        if (mode === 'front') {
          list.splice.apply(list, [0, list.length].concat(rest, chosen));
        } else if (mode === 'back') {
          list.splice.apply(list, [0, list.length].concat(chosen, rest));
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

    /**
     * Moves one node to a place of a list: parentId = a group id or null (the page), index counts from the bottom of that list. Used by the layers panel (also into and out of groups).
     * A node cannot go into itself or into one of its own descendants.
     */
    app.moveNode = function (id, parentId, index) {
      var from = app.locate(id, false);
      if (!from) { return false; }
      var targetList;
      var targetChain = [];
      if (parentId) {
        var g = app.locate(parentId, false);
        if (!g || g.el.type !== 'group' || g.el === from.el) { return false; }
        if (D.walk(from.el.type === 'group' ? from.el.children : [], function (n) { return n.id !== parentId; }) === false) { return false; }
        if (D.groupDepth(from.el) + g.chain.length + 1 > 3) { D.toast('Gruppen lassen sich nur bis zu drei Ebenen tief schachteln.', 'warning'); return false; }
        targetList = g.el.children;
        targetChain = g.chain.concat([g.el]);
      } else { targetList = app.elements(); }
      var oldFrameChain = from.chain;
      // the node keeps its place on the page: its coordinates are converted from the old frame to the new one when a group with a transform is crossed
      var nodeWorld = from.el;
      var convert = (D.chainRotated(oldFrameChain) || D.chainRotated(targetChain)) && from.el.type !== 'group';
      var centre = { x: nodeWorld.x + nodeWorld.w / 2, y: nodeWorld.y + nodeWorld.h / 2 };
      return app.edit(function () {
        var item = from.list.splice(from.index, 1)[0];
        if (convert) {
          var world = D.toWorld(oldFrameChain, centre);
          var local = D.toFrame(targetChain, world);
          item.x = D.round(local.x - item.w / 2, 4);
          item.y = D.round(local.y - item.h / 2, 4);
        }
        var at = D.clamp(index, 0, targetList.length);
        // removing from the same list shifts the index
        if (targetList === from.list && from.index < at) { at = Math.max(0, at - 1); }
        targetList.splice(at, 0, item);
      }, { structure: true, reason: 'order' });
    };

    /** Compat: move within the list of the node (index counts from the bottom). */
    app.moveToIndex = function (id, index) {
      var r = app.locate(id, false);
      if (!r) { return; }
      var parent = r.chain.length ? r.chain[r.chain.length - 1].id : null;
      app.moveNode(id, parent, index > r.index ? index + 1 : index);
    };

    // ---------------------------------------------------------------------------------------- group, ungroup
    app.canGroup = function () {
      if (app.sel.length < 2) { return false; }
      var items = app.sel.map(function (id) { return app.locate(id, false); });
      if (items.some(function (r) { return !r || r.el.locked; })) { return false; }
      return items.every(function (r) { return r.list === items[0].list; });
    };
    app.group = function () {
      if (!app.editable() || !app.canGroup()) { return false; }
      var first = app.locate(app.sel[0], false);
      var list = first.list;
      var nodes = list.filter(function (e) { return app.sel.indexOf(e.id) >= 0; });
      var depth = nodes.reduce(function (m, n) { return Math.max(m, D.groupDepth(n)); }, 0) + first.chain.length + 1;
      if (depth > 3) { D.toast('Gruppen lassen sich nur bis zu drei Ebenen tief schachteln.', 'warning'); return false; }
      var id = D.idMaker(app.doc)();
      var group = D.withDefaults({ id: id, type: 'group', children: [] }, app.doc.unit);
      app.edit(function () {
        var topIndex = list.indexOf(nodes[nodes.length - 1]);
        group.children = nodes;
        nodes.forEach(function (n) { list.splice(list.indexOf(n), 1); });
        list.splice(Math.min(topIndex - nodes.length + 1, list.length), 0, group);
      }, { structure: true, reason: 'group' });
      app.select([id]);
      return true;
    };
    app.canUngroup = function () { return app.selected().some(function (e) { return e.type === 'group'; }); };
    app.ungroup = function () {
      if (!app.editable() || !app.canUngroup()) { return false; }
      var groups = app.selected().filter(function (e) { return e.type === 'group'; });
      var freed = [];
      app.edit(function () {
        groups.forEach(function (g) {
          var r = app.locate(g.id, false);
          if (!r) { return; }
          var kids = g.children.map(function (c) { return bake(g, c); });
          r.list.splice.apply(r.list, [r.index, 1].concat(kids));
          kids.forEach(function (k) { freed.push(k.id); });
        });
      }, { structure: true, reason: 'ungroup' });
      app.select(freed);
      return true;
    };

    /** A child leaves its group: the group's rotation, flip and opacity are baked into the child so that it stays where it was. */
    function bake(g, c) {
      var rot = g.rotation || 0;
      if (!rot && !g.flipX && !g.flipY && g.opacity === 1) { return c; }
      var centre = { x: c.x + c.w / 2, y: c.y + c.h / 2 };
      var moved = groupForwardBake(g, centre);
      var shift = { x: moved.x - centre.x, y: moved.y - centre.y };
      if (c.type === 'group') {
        D.translate(c, shift.x, shift.y);
        c.rotation = D.round(normAngle((c.rotation || 0) * (g.flipX !== g.flipY ? -1 : 1) + rot), 3);
      } else {
        c.x = D.round(c.x + shift.x, 4);
        c.y = D.round(c.y + shift.y, 4);
        c.rotation = D.round(normAngle((c.rotation || 0) * (g.flipX !== g.flipY ? -1 : 1) + rot), 3);
        if (g.flipX) { c.flipX = !c.flipX; }
        if (g.flipY) { c.flipY = !c.flipY; }
      }
      c.opacity = D.round(c.opacity * g.opacity, 3);
      return c;
    }
    function groupForwardBake(g, p) { return groupForward(g, p); }

    // ---------------------------------------------------------------------------------------- align, distribute
    function movable(ids) {
      return ids.map(function (id) { return app.locate(id, false); }).filter(function (r) { return r && !r.el.locked; });
    }

    /** mode: left | centre | right | top | middle | bottom; toPage: align to the page (a single node always does). */
    app.align = function (mode, toPage) {
      var items = movable(app.sel);
      if (!items.length) { return; }
      var boxes = items.map(function (r) { return D.aabb(r.el); });
      var frame = (toPage || items.length === 1) ? { x: 0, y: 0, w: app.doc.width, h: app.doc.height } : D.unionBox(boxes);
      app.edit(function () {
        items.forEach(function (r, i) {
          var b = boxes[i];
          var dx = 0;
          var dy = 0;
          if (mode === 'left') { dx = frame.x - b.x; }
          else if (mode === 'centre') { dx = frame.x + frame.w / 2 - (b.x + b.w / 2); }
          else if (mode === 'right') { dx = frame.x + frame.w - (b.x + b.w); }
          else if (mode === 'top') { dy = frame.y - b.y; }
          else if (mode === 'middle') { dy = frame.y + frame.h / 2 - (b.y + b.h / 2); }
          else if (mode === 'bottom') { dy = frame.y + frame.h - (b.y + b.h); }
          D.translate(r.el, dx, dy);
        });
      }, { reason: 'align' });
    };

    /** axis: 'x' (equal gaps from left to right) or 'y'; needs three or more nodes. */
    app.distribute = function (axis) {
      var items = movable(app.sel).map(function (r) { return { r: r, box: D.aabb(r.el) }; });
      if (items.length < 3) { return; }
      var horizontal = axis === 'x';
      items.sort(function (a, b) { return horizontal ? a.box.x - b.box.x : a.box.y - b.box.y; });
      var first = items[0].box;
      var last = items[items.length - 1].box;
      var start = horizontal ? first.x : first.y;
      var end = horizontal ? last.x + last.w : last.y + last.h;
      var sizes = items.reduce(function (sum, it) { return sum + (horizontal ? it.box.w : it.box.h); }, 0);
      var gap = (end - start - sizes) / (items.length - 1);
      app.edit(function () {
        var pos = start;
        items.forEach(function (it) {
          var current = horizontal ? it.box.x : it.box.y;
          var delta = pos - current;
          D.translate(it.r.el, horizontal ? delta : 0, horizontal ? 0 : delta);
          pos += (horizontal ? it.box.w : it.box.h) + gap;
        });
      }, { reason: 'distribute' });
    };

    // ---------------------------------------------------------------------------------------- lock, hide, rename, flip
    app.toggleLock = function (ids) {
      var list = ids || app.sel;
      if (!list.length) { return; }
      var lock = list.some(function (id) { var e = app.element(id); return e && !e.locked; });
      app.setProps(list, { locked: lock }, { merge: false, structure: true });
      if (lock) { app.select(app.sel.filter(function (id) { return list.indexOf(id) < 0; })); }
    };
    app.toggleHidden = function (ids) {
      var list = ids || app.sel;
      if (!list.length) { return; }
      var hide = list.some(function (id) { var e = app.element(id); return e && !e.hidden; });
      app.setProps(list, { hidden: hide }, { merge: false, structure: true });
      if (hide) { app.select(app.sel.filter(function (id) { return list.indexOf(id) < 0; })); }
    };
    app.rename = function (id, name) {
      app.setProps([id], { name: String(name || '').slice(0, 80) }, { merge: false, structure: true });
    };
    app.flip = function (axis) {
      var ids = app.sel.filter(function (id) { var e = app.element(id); return e && !e.locked; });
      if (!ids.length) { return; }
      app.setProps(ids, function (e) { return axis === 'x' ? { flipX: !e.flipX } : { flipY: !e.flipY }; }, { merge: false });
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
      var renamed = newKey !== oldKey;
      app.edit(function (doc) {
        var f = D.fieldByKey(doc, oldKey);
        Object.keys(patch).forEach(function (k) { f[k] = patch[k]; });
        if (f.type !== 'price' && f.type !== 'number') { f.decimals = null; }
        if (f.type === 'price' && !D.isNum(f.decimals)) { f.decimals = 2; }
        if (f.type !== 'image') { f.category = null; }
        if (!renamed) { return; }
        var same = function (k) { return D.lower(k) === D.lower(oldKey); };
        var swap = function (all, k) { return same(k) ? '{{' + newKey + '}}' : all; };
        D.walkDoc(doc, function (e) {
          if (e.showIf && same(e.showIf)) { e.showIf = newKey; }
          if (e.type === 'text') { e.text = e.text.replace(TOKEN_PATTERN, swap); }
          if (e.type === 'qr' || e.type === 'barcode') { e.value = e.value.replace(TOKEN_PATTERN, swap); }
          if (e.type === 'image' && e.source && e.source.field && same(e.source.field)) { e.source = { field: newKey }; }
          if (e.type === 'imageStrip') { e.items = e.items.map(function (it) { return it && it.field && same(it.field) ? { field: newKey } : it; }); }
        });
      }, { merge: mergeKey, structure: structural !== false, reason: 'field' });
      return null;
    };

    app.deleteField = function (key) {
      app.edit(function (doc) { doc.fields = doc.fields.filter(function (f) { return D.lower(f.key) !== D.lower(key); }); }, { structure: true, reason: 'field' });
    };

    app.tokenFor = function (key) { return '{{' + key + '}}'; };

    /** Appends {{Key}} to the selected text element (a text that is being edited is handled by the canvas: it inserts at the caret). */
    app.insertPlaceholder = function (key) {
      var token = app.tokenFor(key);
      if (app.editing && app.editing.insert) { app.editing.insert(token); return true; }
      var e = app.single();
      if (e && (e.type === 'qr' || e.type === 'barcode') && !e.locked) {
        app.setProps([e.id], { value: ((e.value || '') + token).slice(0, e.type === 'qr' ? 1000 : 80) }, { merge: false });
        return true;
      }
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

    /** The asset keys a document names: image sources, strip items, page backgrounds and the samples of image fields. */
    app.assetKeysOf = function (doc) {
      var keys = window.DtEngine.assetKeysUsed(doc);
      (doc.fields || []).forEach(function (f) { if (f.type === 'image' && f.sample) { keys.push(f.sample); } });
      return keys;
    };

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

    /**
     * Asks the server for the addresses (with their hashes) of images that an item uses and that the person may not find in their own library (a design that was shared with them, the cells of
     * a data list): context is "design:12" or "datalist:3". What comes back is only put into the lookup of the engine, not into the lists of the media browser. Resolves when it is done.
     */
    app.resolveAssets = function (context, keys) {
      var wanted = [];
      (keys || []).forEach(function (k) {
        var lower = D.lower(k);
        if (lower && !app.assetMap.has(lower) && wanted.indexOf(lower) < 0) { wanted.push(lower); }
      });
      if (!wanted.length) { return Promise.resolve(false); }
      return D.request('GET', '/api/assets/resolve?context=' + encodeURIComponent(context) + '&keys=' + encodeURIComponent(wanted.join(','))).then(function (res) {
        if (!res.ok || !res.data) { return false; }
        var learned = false;
        Object.keys(res.data).forEach(function (k) {
          var a = res.data[k];
          if (a && a.key && a.url) { app.assetMap.set(D.lower(a.key), a); learned = true; }
        });
        if (learned) { app.emit('assets'); }
        return learned;
      }, function () { return false; });
    };

    /** Adds or updates assets the editor just learned about (an upload): the engine can draw them at once. */
    app.addAssets = function (list) {
      list.forEach(function (a) {
        app.assetMap.set(D.lower(a.key), a);
        var at = app.assets.findIndex(function (x) { return D.lower(x.key) === D.lower(a.key); });
        if (at >= 0) { app.assets[at] = a; } else { app.assets.unshift(a); }
      });
      app.emit('assets');
    };

    return app;
  };
})(window);
