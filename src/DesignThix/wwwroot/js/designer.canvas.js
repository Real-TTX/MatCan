/* DesignThix designer, part 2: the canvas. The page is drawn by DtEngine (mode 'editor') into #dt-page; a separate overlay <svg> (#dt-overlay, screen pixels)
   carries selection boxes, the 8 resize handles, the rotate handle, the marquee and the snapping guides. All pointer work (mouse, pen, touch) happens here:
   hit testing by element geometry (rotation included, topmost first, locked elements never), move / resize / rotate gestures, snapping, zoom and pan,
   inline text editing, dropping media. During a drag the document is changed live but the engine is NOT run: the overlay moves and the <g> of the element
   gets a transform; the engine draws again when the pointer is released (resize: once per frame). */
(function () {
  'use strict';

  var D = window.DtDesigner;
  var MIN_ZOOM = 0.1;
  var MAX_ZOOM = 8;
  var DRAG_SLOP = 3;          // screen px before a press becomes a drag
  var HANDLES = {
    nw: { sx: -1, sy: -1 }, n: { sx: 0, sy: -1 }, ne: { sx: 1, sy: -1 },
    e: { sx: 1, sy: 0 }, se: { sx: 1, sy: 1 }, s: { sx: 0, sy: 1 },
    sw: { sx: -1, sy: 1 }, w: { sx: -1, sy: 0 },
  };
  var HANDLE_ORDER = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

  var app, viewport, stage, sheet, page, overlay;
  var gMap = new Map();
  var renderBusy = false;
  var renderQueued = false;
  var renderPromise = Promise.resolve();
  var renderCount = 0;
  var gesture = null;
  var hoverId = null;
  var guides = [];
  var marquee = null;
  var badge = null;
  var spaceDown = false;
  var touches = new Map();
  var pinch = null;
  var lastTap = null;
  var coarse = window.matchMedia ? window.matchMedia('(pointer: coarse)') : { matches: false };
  var textEdit = null;
  var lastFitSize = '';
  var lastWarnings = '';
  var pageSignature = '';
  var phone = null;

  // ================================================================================================ sizes, zoom, pan

  function applySize() {
    if (!app.doc) { return; }
    var k = app.scale();
    var w = D.round(app.doc.width * k, 2) + 'px';
    var h = D.round(app.doc.height * k, 2) + 'px';
    sheet.style.setProperty('width', w);
    sheet.style.setProperty('height', h);
  }

  function sheetRect() { return sheet.getBoundingClientRect(); }

  function toDoc(clientX, clientY) {
    var r = sheetRect();
    var k = app.scale();
    return { x: (clientX - r.left) / k, y: (clientY - r.top) / k };
  }

  function fitZoom() {
    var pad = parseFloat(window.getComputedStyle(stage).paddingLeft) || 0;
    var availW = Math.max(60, viewport.clientWidth - 2 * pad);
    var availH = Math.max(60, viewport.clientHeight - 2 * pad);
    var ppu = D.pxPerUnit(app.unit());
    var z = Math.min(availW / (app.doc.width * ppu), availH / (app.doc.height * ppu));
    return D.clamp(Math.floor(z * 1000) / 1000, MIN_ZOOM, MAX_ZOOM);
  }

  function centreScroll() {
    viewport.scrollLeft = Math.max(0, (viewport.scrollWidth - viewport.clientWidth) / 2);
    viewport.scrollTop = Math.max(0, (viewport.scrollHeight - viewport.clientHeight) / 2);
  }

  /** Sets the zoom; focus = client point that stays where it is (wheel, pinch, buttons: the centre of the view). */
  function setZoom(z, focus, fit) {
    z = D.clamp(z, MIN_ZOOM, MAX_ZOOM);
    var changed = Math.abs(z - app.zoom) > 0.0001;
    app.fitMode = !!fit;
    if (!changed) { app.emit('zoom'); return; }
    var r = sheetRect();
    var vr = viewport.getBoundingClientRect();
    var f = focus || { x: vr.left + vr.width / 2, y: vr.top + vr.height / 2 };
    var fx = r.width ? (f.x - r.left) / r.width : 0.5;
    var fy = r.height ? (f.y - r.top) / r.height : 0.5;
    app.zoom = z;
    applySize();
    if (fit) {
      centreScroll();
    } else {
      var n = sheetRect();
      viewport.scrollLeft += (n.left + fx * n.width) - f.x;
      viewport.scrollTop += (n.top + fy * n.height) - f.y;
    }
    drawOverlay();
    placeTextEdit();
    app.emit('zoom');
  }

  function fit() { if (app.doc) { setZoom(fitZoom(), null, true); } }

  function zoomBy(factor, focus) { setZoom(app.zoom * factor, focus, false); }

  function stepZoom(direction, focus) {
    var steps = [0.1, 0.15, 0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.25, 1.5, 2, 3, 4, 6, 8];
    var z = app.zoom;
    var next = direction > 0 ? steps.find(function (s) { return s > z + 0.001; }) : steps.slice().reverse().find(function (s) { return s < z - 0.001; });
    setZoom(next || (direction > 0 ? MAX_ZOOM : MIN_ZOOM), focus, false);
  }

  // ================================================================================================ rendering

  function indexGroups(svg) {
    gMap = new Map();
    D.$$('g[data-el-id]', svg).forEach(function (g) { gMap.set(g.getAttribute('data-el-id'), g); });
    if (textEdit) {
      var g = gMap.get(textEdit.id);
      if (g) { g.setAttribute('display', 'none'); }
    }
  }

  function render() {
    if (!app.doc) { return Promise.resolve(); }
    if (renderBusy) { renderQueued = true; return renderPromise; }
    renderBusy = true;
    app.values = app.computeValues();
    renderCount++;
    renderPromise = window.DtEngine.renderInto(page, app.doc, app.values, {
      mode: phone.matches ? 'output' : 'editor', idPrefix: 'ed' + renderCount, assetUrl: app.assetUrl, fonts: app.fonts,
    }).then(function (svg) {
      indexGroups(svg);
      page.classList.add('is-ready');
      computeWarnings();
      drawOverlay();
      placeTextEdit();
    }).catch(function (err) {
      if (window.console) { console.error('designer render', err); }
    }).then(function () {
      renderBusy = false;
      if (renderQueued) { renderQueued = false; return render(); }
      app.emit('rendered');
      return undefined;
    });
    return renderPromise;
  }

  var renderSoon = D.rafOnce(function () { render(); });

  /** Problems the preview shows: placeholders without a field, images that the library does not have. */
  function computeWarnings() {
    var warnings = [];
    var used = window.DtEngine.fieldsUsed(app.doc);
    used.forEach(function (u) {
      if (!u.defined) { warnings.push({ kind: 'field', key: u.key, text: 'Platzhalter {{' + u.key + '}} hat kein Feld.' }); }
    });
    var values = app.values || {};
    var valueOf = function (key) {
      var lower = D.lower(key);
      var found = Object.keys(values).find(function (k) { return D.lower(k) === lower; });
      var f = D.fieldByKey(app.doc, key);
      return found === undefined ? '' : window.DtEngine.formatValue(f, values[found], app.doc.locale).trim();
    };
    var seen = new Set();
    var checkAsset = function (key, where) {
      if (!key || !app.assetsComplete) { return; }
      var id = D.lower(key);
      if (app.assetByKey(key) || seen.has(id)) { return; }
      seen.add(id);
      warnings.push({ kind: 'asset', key: key, text: 'Das Bild „' + key + '“ (' + where + ') gibt es nicht in den Medien.' });
    };
    app.doc.elements.forEach(function (e) {
      if (e.hidden) { return; }
      var sources = e.type === 'image' ? [e.source] : (e.type === 'imageStrip' ? e.items : []);
      sources.forEach(function (s) {
        if (!s) { return; }
        if (s.asset) { checkAsset(s.asset, D.elementTitle(e)); }
        else if (s.field) { checkAsset(valueOf(s.field), 'Feld ' + s.field); }
      });
    });
    if (app.doc.background.asset) { checkAsset(app.doc.background.asset, 'Hintergrund'); }
    if (app.preview.list && app.preview.rows.length) {
      var columns = new Set((app.preview.list.columns || []).map(function (c) { return D.lower(c.key); }));
      var missingColumns = used.filter(function (u) { return !columns.has(D.lower(u.key)); }).map(function (u) { return u.key; });
      if (missingColumns.length) { warnings.push({ kind: 'column', key: missingColumns.join(', '), text: 'Die Datenliste hat keine Spalte für: ' + missingColumns.join(', ') + '.' }); }
    }
    var signature = JSON.stringify(warnings);
    if (signature === lastWarnings) { return; }
    lastWarnings = signature;
    app.warnings = warnings;
    app.emit('warnings');
  }

  // ================================================================================================ hit testing

  function pointTolerance() { return (coarse.matches ? 10 : 5) / app.scale(); }

  function segmentDistance(p, a, b) {
    var dx = b.x - a.x;
    var dy = b.y - a.y;
    var len2 = dx * dx + dy * dy;
    var t = len2 === 0 ? 0 : D.clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / len2, 0, 1);
    return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
  }

  function hitElement(e, p, tol) {
    var l = D.toLocal(e, p);
    var hw = e.w / 2;
    var hh = e.h / 2;
    if (e.type === 'shape') {
      if (e.shape === 'line') {
        var half = window.DtEngine.ptToUnit(e.strokeWidth, app.unit()) / 2;
        return segmentDistance(l, { x: -hw, y: -hh }, { x: hw, y: hh }) <= tol + half;
      }
      if (e.shape === 'ellipse') {
        var inside = function (g) { var a = hw + g; var b = hh + g; return a > 0 && b > 0 && (l.x * l.x) / (a * a) + (l.y * l.y) / (b * b) <= 1; };
        if (e.fill) { return inside(tol); }
        return inside(tol + window.DtEngine.ptToUnit(e.strokeWidth, app.unit()) / 2) && !inside(-tol);
      }
      if (!e.fill) {
        var outer = Math.abs(l.x) <= hw + tol && Math.abs(l.y) <= hh + tol;
        var inner = Math.abs(l.x) < hw - tol && Math.abs(l.y) < hh - tol;
        return outer && !inner;
      }
    }
    return Math.abs(l.x) <= hw + tol && Math.abs(l.y) <= hh + tol;
  }

  /** The topmost element under a point (document units). Hidden elements, elements the engine did not draw and (by default) locked ones are skipped. */
  function hitTest(p, options) {
    var o = options || {};
    var tol = pointTolerance();
    var list = app.doc.elements;
    for (var i = list.length - 1; i >= 0; i--) {
      var e = list[i];
      if (e.hidden || (e.locked && !o.locked) || !gMap.has(e.id)) { continue; }
      if (hitElement(e, p, tol)) { return e; }
    }
    return null;
  }

  // ================================================================================================ overlay

  var drawOverlaySoon = D.rafOnce(drawOverlayNow);
  function drawOverlay() { drawOverlaySoon(); }

  function box(e) { return { x: e.x, y: e.y, w: e.w, h: e.h, rotation: e.rotation || 0 }; }

  function handlePoint(b, name) {
    var s = HANDLES[name];
    var c = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
    var v = D.rotateVec({ x: s.sx * b.w / 2, y: s.sy * b.h / 2 }, b.rotation);
    return { x: c.x + v.x, y: c.y + v.y };
  }

  function polygonPoints(corners, k) {
    return corners.map(function (p) { return D.round(p.x * k, 2) + ',' + D.round(p.y * k, 2); }).join(' ');
  }

  function drawOverlayNow() {
    D.empty(overlay);
    if (!app.doc) { return; }
    var k = app.scale();
    var editable = app.editable() && !phone.matches;
    var sel = app.selected();
    var gOverlay = function (cls) { return D.svg('g', { class: cls }, null); };
    var layerHints = gOverlay('dt-ov-hints');
    var layerHover = gOverlay('dt-ov-hover');
    var layerSel = gOverlay('dt-ov-sel');
    var layerGuides = gOverlay('dt-ov-guides');
    var layerTop = gOverlay('dt-ov-top');
    [layerHints, layerHover, layerSel, layerGuides, layerTop].forEach(function (g) { overlay.appendChild(g); });

    // An image strip with no source at all draws nothing in the engine: show where it is.
    app.doc.elements.forEach(function (e) {
      if (e.type !== 'imageStrip' || e.hidden || e.items.some(Boolean)) { return; }
      layerHints.appendChild(D.svg('polygon', { class: 'dt-ov-hint', points: polygonPoints(D.corners(e), k) }));
      var c = { x: (e.x + e.w / 2) * k, y: (e.y + e.h / 2) * k };
      var t = D.svg('text', { class: 'dt-ov-hinttext', x: D.round(c.x, 1), y: D.round(c.y, 1), 'text-anchor': 'middle', 'dominant-baseline': 'central' });
      t.textContent = 'Bildleiste (leer)';
      layerHints.appendChild(t);
    });

    // hover (mouse) and marquee candidates
    var hovered = [];
    if (marquee && marquee.hits) { hovered = marquee.hits; }
    else if (hoverId && !app.isSelected(hoverId) && !gesture) { hovered = [hoverId]; }
    hovered.forEach(function (id) {
      var e = app.element(id);
      if (e) { layerHover.appendChild(D.svg('polygon', { class: 'dt-ov-hover', points: polygonPoints(D.corners(e), k) })); }
    });

    // selection
    sel.forEach(function (e) {
      var cls = 'dt-ov-outline' + (e.locked ? ' is-locked' : '') + (sel.length > 1 ? ' is-multi' : '');
      if (e.type === 'shape' && e.shape === 'line') {
        var lc = D.corners(e);
        layerSel.appendChild(D.svg('line', { class: cls, x1: D.round(lc[0].x * k, 2), y1: D.round(lc[0].y * k, 2), x2: D.round(lc[2].x * k, 2), y2: D.round(lc[2].y * k, 2) }));
      } else {
        layerSel.appendChild(D.svg('polygon', { class: cls, points: polygonPoints(D.corners(e), k) }));
      }
    });

    var movable = sel.filter(function (e) { return !e.locked; });
    var showHandles = editable && movable.length > 0 && !textEdit && !(gesture && gesture.type === 'marquee');
    if (showHandles && sel.length === 1) {
      drawHandles(layerTop, sel[0], k, true);
    } else if (showHandles && movable.length === sel.length && sel.length > 1) {
      var union = D.unionBox(sel.map(D.aabb));
      layerSel.appendChild(D.svg('rect', { class: 'dt-ov-group', x: D.round(union.x * k, 2), y: D.round(union.y * k, 2), width: D.round(union.w * k, 2), height: D.round(union.h * k, 2) }));
      drawHandles(layerTop, { x: union.x, y: union.y, w: union.w, h: union.h, rotation: 0, type: 'group' }, k, false);
    }

    // guides
    guides.forEach(function (g) {
      var attrs = g.axis === 'x'
        ? { x1: D.round(g.pos * k, 2), x2: D.round(g.pos * k, 2), y1: D.round(g.from * k, 2), y2: D.round(g.to * k, 2) }
        : { y1: D.round(g.pos * k, 2), y2: D.round(g.pos * k, 2), x1: D.round(g.from * k, 2), x2: D.round(g.to * k, 2) };
      attrs.class = 'dt-ov-guide';
      layerGuides.appendChild(D.svg('line', attrs));
    });

    if (marquee && marquee.rect) {
      var m = marquee.rect;
      layerTop.appendChild(D.svg('rect', { class: 'dt-ov-marquee', x: D.round(m.x * k, 1), y: D.round(m.y * k, 1), width: D.round(m.w * k, 1), height: D.round(m.h * k, 1) }));
    }

    if (badge) {
      var bx = badge.x * k;
      var by = badge.y * k + 18;
      var label = D.svg('g', { class: 'dt-ov-badge' });
      var text = D.svg('text', { x: D.round(bx, 1), y: D.round(by, 1), 'text-anchor': 'middle', 'dominant-baseline': 'central' });
      text.textContent = badge.text;
      var width = badge.text.length * 6.6 + 14;
      label.appendChild(D.svg('rect', { x: D.round(bx - width / 2, 1), y: D.round(by - 10, 1), width: D.round(width, 1), height: 20, rx: 4 }));
      label.appendChild(text);
      layerTop.appendChild(label);
    }
  }

  function drawHandles(layer, b, k, withRotate) {
    var geo = box(b);
    var screenW = geo.w * k;
    var screenH = geo.h * k;
    var isLine = b.type === 'shape' && b.shape === 'line';
    var hit = coarse.matches ? 22 : 11;
    var names = HANDLE_ORDER.filter(function (name) {
      if (isLine) { return name === 'nw' || name === 'se'; }
      var s = HANDLES[name];
      if (s.sx !== 0 && s.sy !== 0) { return true; }
      return s.sx !== 0 ? screenH >= 28 : screenW >= 28;
    });
    names.forEach(function (name) {
      var p = handlePoint(geo, name);
      var cx = D.round(p.x * k, 2);
      var cy = D.round(p.y * k, 2);
      var s = HANDLES[name];
      var corner = s.sx !== 0 && s.sy !== 0;
      layer.appendChild(D.svg('circle', { class: 'dt-handle' + (corner ? '' : ' is-edge'), cx: cx, cy: cy, r: corner ? 5 : 4 }));
      layer.appendChild(D.svg('circle', { class: 'dt-handle__hit dt-cursor-' + name, 'data-handle': name, cx: cx, cy: cy, r: hit }));
    });
    if (withRotate) {
      var top = handlePoint(geo, isLine ? 'nw' : 'n');
      var centre = { x: geo.x + geo.w / 2, y: geo.y + geo.h / 2 };
      var dir = D.rotateVec({ x: 0, y: -1 }, geo.rotation);
      var gap = coarse.matches ? 40 : 30;
      var anchor = isLine ? centre : top;
      var rx = anchor.x * k + dir.x * gap;
      var ry = anchor.y * k + dir.y * gap;
      layer.appendChild(D.svg('line', { class: 'dt-ov-stem', x1: D.round(anchor.x * k, 2), y1: D.round(anchor.y * k, 2), x2: D.round(rx, 2), y2: D.round(ry, 2) }));
      layer.appendChild(D.svg('circle', { class: 'dt-handle is-rotate', cx: D.round(rx, 2), cy: D.round(ry, 2), r: 8 }));
      var glyph = D.icon('rotate-cw', 'dt-handle__glyph');
      glyph.setAttribute('x', D.round(rx - 6, 2));
      glyph.setAttribute('y', D.round(ry - 6, 2));
      glyph.setAttribute('width', 12);
      glyph.setAttribute('height', 12);
      layer.appendChild(glyph);
      layer.appendChild(D.svg('circle', { class: 'dt-handle__hit dt-cursor-rotate', 'data-handle': 'rot', cx: D.round(rx, 2), cy: D.round(ry, 2), r: hit + 3 }));
    }
  }

  // ================================================================================================ snapping

  function snapThreshold() { return (coarse.matches ? 10 : 6) / app.scale(); }

  /** Lines of the page and of the other elements that a moving box can snap to. */
  function snapCandidates(excludeIds) {
    var doc = app.doc;
    var xs = [{ pos: 0, from: 0, to: doc.height }, { pos: doc.width / 2, from: 0, to: doc.height }, { pos: doc.width, from: 0, to: doc.height }];
    var ys = [{ pos: 0, from: 0, to: doc.width }, { pos: doc.height / 2, from: 0, to: doc.width }, { pos: doc.height, from: 0, to: doc.width }];
    doc.elements.forEach(function (e) {
      if (excludeIds.indexOf(e.id) >= 0 || e.hidden || !gMap.has(e.id)) { return; }
      var b = D.aabb(e);
      [b.x, b.x + b.w / 2, b.x + b.w].forEach(function (x) { xs.push({ pos: x, from: b.y, to: b.y + b.h }); });
      [b.y, b.y + b.h / 2, b.y + b.h].forEach(function (y) { ys.push({ pos: y, from: b.x, to: b.x + b.w }); });
    });
    return { xs: xs, ys: ys };
  }

  /** The smallest shift that puts one of `lines` onto a candidate (within the threshold), or null. */
  function bestShift(lines, cands, threshold) {
    var best = null;
    lines.forEach(function (line) {
      cands.forEach(function (c) {
        var d = c.pos - line;
        if (Math.abs(d) <= threshold && (best === null || Math.abs(d) < Math.abs(best))) { best = d; }
      });
    });
    return best;
  }

  /** Guides for the lines of a box (after the shift) that coincide with a candidate. */
  function guidesFor(b, cands, axis) {
    var out = [];
    var lines = axis === 'x' ? [b.x, b.x + b.w / 2, b.x + b.w] : [b.y, b.y + b.h / 2, b.y + b.h];
    var list = axis === 'x' ? cands.xs : cands.ys;
    var lo = axis === 'x' ? b.y : b.x;
    var hi = axis === 'x' ? b.y + b.h : b.x + b.w;
    lines.forEach(function (line) {
      list.forEach(function (c) {
        if (Math.abs(c.pos - line) < 0.01) { out.push({ axis: axis, pos: c.pos, from: Math.min(lo, c.from), to: Math.max(hi, c.to) }); }
      });
    });
    return out;
  }

  function snappingOn(ev) { return app.snapping && !ev.altKey; }

  // ================================================================================================ gestures

  function pointerToDoc(ev) { return toDoc(ev.clientX, ev.clientY); }

  function startPan(ev, tap) {
    gesture = { type: 'pan', pointerId: ev.pointerId, x: ev.clientX, y: ev.clientY, left: viewport.scrollLeft, top: viewport.scrollTop, moved: false, tap: !!tap };
    viewport.classList.add('is-panning');
    capture(ev);
  }

  function capture(ev) { try { viewport.setPointerCapture(ev.pointerId); } catch (e) { /* the pointer is already gone */ } }

  function startMove(ev, hit, extendedSelection) {
    var ids = app.sel.filter(function (id) { var e = app.element(id); return e && !e.locked; });
    if (!ids.length || !app.editable()) { return; }
    var orig = {};
    var transforms = new Map();
    ids.forEach(function (id) {
      var e = app.element(id);
      orig[id] = { x: e.x, y: e.y };
      var g = gMap.get(id);
      transforms.set(id, g ? g.getAttribute('transform') : null);
    });
    gesture = {
      type: 'move', pointerId: ev.pointerId, ids: ids, orig: orig, transforms: transforms, p0: pointerToDoc(ev), client0: { x: ev.clientX, y: ev.clientY },
      box0: D.unionBox(ids.map(function (id) { return D.aabb(app.element(id)); })), cands: snapCandidates(ids), tx: app.tx(), started: false,
      hit: hit, deferSingle: !extendedSelection && app.sel.length > 1,
    };
    capture(ev);
  }

  function startHandle(ev, name) {
    var sel = app.selected().filter(function (e) { return !e.locked; });
    if (!sel.length || !app.editable()) { return; }
    if (name === 'rot') {
      var e = sel[0];
      var c = { x: e.x + e.w / 2, y: e.y + e.h / 2 };
      var p = pointerToDoc(ev);
      gesture = {
        type: 'rotate', pointerId: ev.pointerId, id: e.id, centre: c, angle0: Math.atan2(p.y - c.y, p.x - c.x), rotation0: e.rotation || 0,
        tx: app.tx(), g: gMap.get(e.id), started: false, client0: { x: ev.clientX, y: ev.clientY },
      };
      capture(ev);
      return;
    }
    var single = sel.length === 1 && app.sel.length === 1;
    var items = sel.map(function (e2) { return D.clone({ id: e2.id, x: e2.x, y: e2.y, w: e2.w, h: e2.h, rotation: e2.rotation || 0 }); });
    var frame = single ? box(sel[0]) : (function () { var u = D.unionBox(sel.map(D.aabb)); u.rotation = 0; return u; })();
    var grabAt = pointerToDoc(ev);
    var handleAt = handlePoint(frame, name);
    gesture = {
      type: 'resize', pointerId: ev.pointerId, handle: name, single: single, grab: { x: grabAt.x - handleAt.x, y: grabAt.y - handleAt.y }, items: items, frame: frame, isLine: single && sel[0].type === 'shape' && sel[0].shape === 'line',
      cands: snapCandidates(items.map(function (i) { return i.id; })), tx: app.tx(), started: false, client0: { x: ev.clientX, y: ev.clientY },
    };
    capture(ev);
  }

  function startMarquee(ev) {
    var p = pointerToDoc(ev);
    gesture = { type: 'marquee', pointerId: ev.pointerId, p0: p, additive: ev.shiftKey || ev.ctrlKey || ev.metaKey, base: app.sel.slice(), client0: { x: ev.clientX, y: ev.clientY }, started: false };
    capture(ev);
  }

  function onDown(ev) {
    if (!app.doc) { return; }
    if (textEdit && ev.target === textEdit.el) { return; }
    if (textEdit) { endTextEdit(true); }
    if (ev.target.closest && ev.target.closest('.dt-zoombar, .dt-warnbar')) { return; }
    if (document.activeElement && document.activeElement !== viewport && document.activeElement.blur && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) { document.activeElement.blur(); }
    viewport.focus({ preventScroll: true });

    if (ev.pointerType === 'touch') {
      touches.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (touches.size === 2) { startPinch(); return; }
      if (touches.size > 2) { return; }
    }
    if (gesture || pinch) { return; }

    if (ev.button === 1 || (ev.button === 0 && spaceDown)) { ev.preventDefault(); startPan(ev, false); return; }
    if (ev.pointerType === 'mouse' && ev.button !== 0) { return; }
    if (phone.matches) { startPan(ev, true); return; }

    var handle = ev.target.closest ? ev.target.closest('[data-handle]') : null;
    if (handle && app.editable()) { ev.preventDefault(); startHandle(ev, handle.getAttribute('data-handle')); return; }

    var p = pointerToDoc(ev);
    var hit = hitTest(p);
    var extend = ev.shiftKey || ev.ctrlKey || ev.metaKey;
    if (hit) {
      if (extend) {
        var wasSelected = app.isSelected(hit.id);
        app.toggleSelect(hit.id);
        if (wasSelected) { return; }
      } else if (!app.isSelected(hit.id)) {
        app.select([hit.id]);
      }
      startMove(ev, hit, extend);
      if (!gesture) { gesture = { type: 'tap', pointerId: ev.pointerId, hit: hit }; capture(ev); }
      return;
    }
    if (ev.pointerType === 'touch') { startPan(ev, true); return; }
    startMarquee(ev);
  }

  function moveGesture(ev) {
    var g = gesture;
    if (g.type === 'pan') {
      var dx = ev.clientX - g.x;
      var dy = ev.clientY - g.y;
      if (Math.abs(dx) + Math.abs(dy) > DRAG_SLOP) { g.moved = true; }
      viewport.scrollLeft = g.left - dx;
      viewport.scrollTop = g.top - dy;
      return;
    }
    if (g.type === 'tap') { return; }
    var dist = Math.hypot(ev.clientX - g.client0.x, ev.clientY - g.client0.y);
    if (!g.started && dist < DRAG_SLOP) { return; }
    g.started = true;
    var p = pointerToDoc(ev);
    if (g.type === 'move') { doMove(g, p, ev); }
    else if (g.type === 'resize') { doResize(g, p, ev); }
    else if (g.type === 'rotate') { doRotate(g, p, ev); }
    else if (g.type === 'marquee') { doMarquee(g, p, ev); }
  }

  function doMove(g, p, ev) {
    var dx = p.x - g.p0.x;
    var dy = p.y - g.p0.y;
    if (ev.shiftKey) { if (Math.abs(dx) >= Math.abs(dy)) { dy = 0; } else { dx = 0; } }
    guides = [];
    if (snappingOn(ev)) {
      var t = snapThreshold();
      var b = g.box0;
      var sx = bestShift([b.x + dx, b.x + dx + b.w / 2, b.x + dx + b.w], g.cands.xs, t);
      var sy = bestShift([b.y + dy, b.y + dy + b.h / 2, b.y + dy + b.h], g.cands.ys, t);
      if (sx !== null && !(ev.shiftKey && dx === 0)) { dx += sx; }
      if (sy !== null && !(ev.shiftKey && dy === 0)) { dy += sy; }
      var moved = { x: b.x + dx, y: b.y + dy, w: b.w, h: b.h };
      guides = guidesFor(moved, g.cands, 'x').concat(guidesFor(moved, g.cands, 'y'));
    }
    g.tx.apply(function (doc) {
      g.ids.forEach(function (id) {
        var e = doc.elements[app.indexOf(id)];
        e.x = D.round(g.orig[id].x + dx, 3);
        e.y = D.round(g.orig[id].y + dy, 3);
        var node = gMap.get(id);
        if (node) {
          var old = g.transforms.get(id);
          node.setAttribute('transform', 'translate(' + D.round(e.x - g.orig[id].x, 3) + ' ' + D.round(e.y - g.orig[id].y, 3) + ')' + (old ? ' ' + old : ''));
        }
      });
    }, { render: 'none', reason: 'move' });
    badge = null;
    drawOverlay();
  }

  /** The new box of one element or of a group for a handle drag (the element's own rotation is respected). */
  function resizedBox(e0, handle, p, keep, min, zeroOk) {
    var s = HANDLES[handle];
    var c0 = { x: e0.x + e0.w / 2, y: e0.y + e0.h / 2 };
    var q = D.toLocal(e0, p);
    var hw = e0.w / 2;
    var hh = e0.h / 2;
    var left = -hw;
    var right = hw;
    var top = -hh;
    var bottom = hh;
    if (s.sx > 0) { right = q.x; } else if (s.sx < 0) { left = q.x; }
    if (s.sy > 0) { bottom = q.y; } else if (s.sy < 0) { top = q.y; }
    var floor = zeroOk ? 0 : min;
    if (s.sx !== 0 && right - left < floor) { if (s.sx > 0) { right = left + floor; } else { left = right - floor; } }
    if (s.sy !== 0 && bottom - top < floor) { if (s.sy > 0) { bottom = top + floor; } else { top = bottom - floor; } }
    if (keep && e0.w > 0 && e0.h > 0) {
      var ratio = e0.w / e0.h;
      var nw = right - left;
      var nh = bottom - top;
      if (s.sx !== 0 && s.sy !== 0) {
        var f = Math.max(nw / e0.w, nh / e0.h);
        nw = e0.w * f;
        nh = e0.h * f;
      } else if (s.sx !== 0) { nh = nw / ratio; } else { nw = nh * ratio; }
      if (s.sx > 0) { right = left + nw; } else if (s.sx < 0) { left = right - nw; } else { left = -nw / 2; right = nw / 2; }
      if (s.sy > 0) { bottom = top + nh; } else if (s.sy < 0) { top = bottom - nh; } else { top = -nh / 2; bottom = nh / 2; }
    }
    var w = right - left;
    var h = bottom - top;
    var m = D.rotateVec({ x: (left + right) / 2, y: (top + bottom) / 2 }, e0.rotation || 0);
    return { x: c0.x + m.x - w / 2, y: c0.y + m.y - h / 2, w: w, h: h };
  }

  function doResize(g, p, ev) {
    var k = app.scale();
    var min = 2 / k;
    var handle = g.handle;
    var s = HANDLES[handle];
    p = { x: p.x - g.grab.x, y: p.y - g.grab.y };
    guides = [];
    var frame = g.frame;
    // snap the edge that moves (unrotated frames only)
    if (snappingOn(ev) && !(frame.rotation % 180)) {
      var t = snapThreshold();
      var local = p;
      if (s.sx !== 0) {
        var shiftX = bestShift([local.x], g.cands.xs, t);
        if (shiftX !== null) { p = { x: p.x + shiftX, y: p.y }; }
      }
      if (s.sy !== 0) {
        var shiftY = bestShift([p.y], g.cands.ys, t);
        if (shiftY !== null) { p = { x: p.x, y: p.y + shiftY }; }
      }
    }
    var nb = resizedBox(frame, handle, p, ev.shiftKey, min, g.isLine);
    if (g.isLine && g.single) { nb.h = Math.max(0, nb.h); nb.w = Math.max(0, nb.w); }
    if (snappingOn(ev) && !(frame.rotation % 180)) {
      guides = guidesFor(nb, g.cands, 'x').filter(function (gd) { return s.sx !== 0; }).concat(guidesFor(nb, g.cands, 'y').filter(function () { return s.sy !== 0; }));
    }
    g.tx.apply(function (doc) {
      if (g.single) {
        var e = doc.elements[app.indexOf(g.items[0].id)];
        e.x = D.round(nb.x, 3); e.y = D.round(nb.y, 3); e.w = D.round(nb.w, 3); e.h = D.round(nb.h, 3);
      } else {
        var fx = frame.w > 0 ? nb.w / frame.w : 1;
        var fy = frame.h > 0 ? nb.h / frame.h : 1;
        g.items.forEach(function (it) {
          var e2 = doc.elements[app.indexOf(it.id)];
          var cx = nb.x + (it.x + it.w / 2 - frame.x) * fx;
          var cy = nb.y + (it.y + it.h / 2 - frame.y) * fy;
          e2.w = D.round(it.w * fx, 3);
          e2.h = D.round(it.h * fy, 3);
          e2.x = D.round(cx - e2.w / 2, 3);
          e2.y = D.round(cy - e2.h / 2, 3);
        });
      }
    }, { render: 'soon', reason: 'resize' });
    var shown = g.single ? nb : nb;
    badge = { x: shown.x + shown.w / 2, y: shown.y + shown.h, text: D.round(shown.w, 1) + ' × ' + D.round(shown.h, 1) + ' ' + D.unitLabel(app.unit()) };
    drawOverlay();
  }

  function doRotate(g, p, ev) {
    var angle = Math.atan2(p.y - g.centre.y, p.x - g.centre.x);
    var rot = g.rotation0 + (angle - g.angle0) * 180 / Math.PI;
    if (ev.shiftKey) { rot = Math.round(rot / 15) * 15; }
    rot = D.round(D.normAngle(rot), 1);
    g.tx.apply(function (doc) {
      var e = doc.elements[app.indexOf(g.id)];
      e.rotation = rot;
      var node = gMap.get(g.id);
      if (node) { node.setAttribute('transform', 'rotate(' + rot + ' ' + D.round(g.centre.x, 4) + ' ' + D.round(g.centre.y, 4) + ')'); }
    }, { render: 'none', reason: 'rotate' });
    var e2 = app.element(g.id);
    badge = { x: e2.x + e2.w / 2, y: D.aabb(e2).y + D.aabb(e2).h, text: rot + '°' };
    guides = [];
    drawOverlay();
  }

  function doMarquee(g, p) {
    var x1 = Math.min(g.p0.x, p.x);
    var y1 = Math.min(g.p0.y, p.y);
    var rect = { x: x1, y: y1, w: Math.abs(p.x - g.p0.x), h: Math.abs(p.y - g.p0.y) };
    var hits = app.doc.elements.filter(function (e) {
      if (e.hidden || e.locked || !gMap.has(e.id)) { return false; }
      var b = D.aabb(e);
      return b.x < rect.x + rect.w && b.x + b.w > rect.x && b.y < rect.y + rect.h && b.y + b.h > rect.y;
    }).map(function (e) { return e.id; });
    marquee = { rect: rect, hits: hits };
    drawOverlay();
  }

  function onMove(ev) {
    if (ev.pointerType === 'touch' && touches.has(ev.pointerId)) {
      touches.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (pinch) { movePinch(); ev.preventDefault(); return; }
    }
    if (gesture && gesture.pointerId === ev.pointerId) { ev.preventDefault(); moveGesture(ev); return; }
    if (gesture || pinch || ev.pointerType !== 'mouse' || !app.doc) { return; }
    // hover
    var p = pointerToDoc(ev);
    var over = ev.target.closest && ev.target.closest('[data-handle]') ? null : hitTest(p);
    var id = over ? over.id : null;
    if (id !== hoverId) { hoverId = id; drawOverlay(); }
    viewport.classList.toggle('is-over-element', !!over && app.isSelected(over.id) && app.editable());
  }

  function endGesture(ev, cancelled) {
    var g = gesture;
    gesture = null;
    viewport.classList.remove('is-panning');
    try { viewport.releasePointerCapture(ev.pointerId); } catch (e) { /* released */ }
    if (!g) { return; }
    guides = [];
    badge = null;
    if (g.type === 'pan') {
      if (g.tap && !g.moved && !cancelled && app.sel.length) { app.select([]); }
    } else if (g.type === 'move' || g.type === 'resize' || g.type === 'rotate') {
      if (g.started && g.tx.started()) { render(); }
      else if (g.type === 'move' && g.deferSingle && !cancelled && g.hit) { app.select([g.hit.id]); }
      if (g.type === 'move' && !g.started && !cancelled && g.hit) { tapped(ev, g.hit); }
    } else if (g.type === 'tap') {
      if (!cancelled && g.hit) { tapped(ev, g.hit); }
    } else if (g.type === 'marquee') {
      if (!cancelled) {
        if (g.started && marquee) { app.select(g.additive ? g.base.concat(marquee.hits) : marquee.hits); }
        else if (!g.additive) { app.select([]); }
      }
      marquee = null;
    }
    drawOverlay();
  }

  /** A press without a drag on an element: a second tap within 350 ms on the same text opens the editor (touch and pen; the mouse has dblclick). */
  function tapped(ev, hit) {
    if (ev.pointerType === 'mouse') { return; }
    var now = Date.now();
    if (lastTap && lastTap.id === hit.id && now - lastTap.at < 350) {
      lastTap = null;
      if (hit.type === 'text') { startTextEdit(hit.id); }
      return;
    }
    lastTap = { id: hit.id, at: now };
  }

  function onUp(ev) {
    if (ev.pointerType === 'touch') {
      touches.delete(ev.pointerId);
      if (pinch) { if (touches.size < 2) { pinch = null; } return; }
    }
    if (gesture && gesture.pointerId === ev.pointerId) { endGesture(ev, false); }
  }

  function onCancel(ev) {
    if (ev.pointerType === 'touch') { touches.delete(ev.pointerId); if (pinch && touches.size < 2) { pinch = null; } }
    if (gesture && gesture.pointerId === ev.pointerId) { endGesture(ev, true); }
  }

  // ---- pinch (two fingers: zoom and pan)
  function pinchState() {
    var pts = Array.from(touches.values());
    return { d: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1, mid: { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 } };
  }

  function startPinch() {
    if (gesture) { var g = gesture; gesture = null; if (g.tx && g.tx.started()) { render(); } marquee = null; guides = []; }
    var s = pinchState();
    pinch = { d0: s.d, zoom0: app.zoom, mid: s.mid };
    drawOverlay();
  }

  function movePinch() {
    if (touches.size < 2) { return; }
    var s = pinchState();
    var target = D.clamp(pinch.zoom0 * s.d / pinch.d0, MIN_ZOOM, MAX_ZOOM);
    var panX = s.mid.x - pinch.mid.x;
    var panY = s.mid.y - pinch.mid.y;
    setZoom(target, pinch.mid, false);
    viewport.scrollLeft -= panX;
    viewport.scrollTop -= panY;
    pinch.mid = s.mid;
  }

  function onWheel(ev) {
    if (!ev.ctrlKey && !ev.metaKey) { return; }
    ev.preventDefault();
    var factor = Math.exp(-ev.deltaY * (ev.deltaMode === 1 ? 0.05 : 0.0018));
    zoomBy(factor, { x: ev.clientX, y: ev.clientY });
  }

  function onDblClick(ev) {
    if (!app.doc || !app.editable() || phone.matches || ev.target.closest('.dt-zoombar')) { return; }
    var hit = hitTest(pointerToDoc(ev));
    if (hit && hit.type === 'text') { startTextEdit(hit.id); }
  }

  // ================================================================================================ inline text editing

  function cssFont(family) { return "'" + String(family || 'sans-serif').replace(/[\u0000-\u001f"'\\;{}<>,]/g, ' ').trim() + "', sans-serif"; }

  function placeTextEdit() {
    if (!textEdit) { return; }
    var e = app.element(textEdit.id);
    if (!e) { endTextEdit(false); return; }
    var k = app.scale();
    var ta = textEdit.el;
    var raw = ta.value;
    var spec = function (text, fit, size) {
      return {
        text: e.uppercase ? text.toUpperCase() : text, fontFamily: e.fontFamily, fontSize: size, fontWeight: e.fontWeight, italic: e.italic,
        letterSpacing: e.letterSpacing, lineHeight: e.lineHeight, wrap: e.wrap, fit: fit, minFontSize: e.minFontSize, width: e.w, height: e.h, unit: app.unit(),
      };
    };
    // The size that "shrink" gives the text as it is drawn (the placeholders resolved) stays while the raw text is edited; the height comes from the raw text.
    var resolved = window.DtEngine.resolveText(raw, app.doc.fields, app.values || {}, app.doc.locale, 'empty');
    var shown = window.DtEngine.layoutText(spec(resolved, e.fit, e.fontSize));
    var layout = window.DtEngine.layoutText(spec(raw, 'none', shown.fontSizePt));
    var padTop = 0;
    if (e.h > 0 && e.valign === 'middle') { padTop = Math.max(0, (e.h - layout.height) / 2); }
    else if (e.h > 0 && e.valign === 'bottom') { padTop = Math.max(0, e.h - layout.height); }
    var set = function (p, v) { ta.style.setProperty(p, v); };
    set('left', D.round(e.x * k, 2) + 'px');
    set('top', D.round(e.y * k, 2) + 'px');
    set('width', D.round(e.w * k, 2) + 'px');
    set('height', D.round(Math.max(e.h, layout.height) * k, 2) + 'px');
    set('padding-top', D.round(padTop * k, 2) + 'px');
    set('transform', e.rotation ? 'rotate(' + e.rotation + 'deg)' : 'none');
    set('transform-origin', '50% ' + D.round((e.h > 0 ? e.h : layout.height) / Math.max(e.h, layout.height) * 50, 2) + '%');
    set('font-family', cssFont(e.fontFamily));
    set('font-size', D.round(layout.fontSize * k, 3) + 'px');
    set('font-weight', String(e.fontWeight));
    set('font-style', e.italic ? 'italic' : 'normal');
    set('line-height', String(e.lineHeight));
    set('letter-spacing', e.letterSpacing ? e.letterSpacing + 'em' : 'normal');
    set('text-align', e.align);
    set('text-transform', e.uppercase ? 'uppercase' : 'none');
    set('color', e.color);
    set('caret-color', e.color);
    set('white-space', e.wrap ? 'pre-wrap' : 'pre');
  }

  function startTextEdit(id, options) {
    var e = app.element(id);
    if (!e || e.type !== 'text' || e.locked || !app.editable() || phone.matches) { return; }
    if (textEdit) { endTextEdit(true); }
    app.select([id]);
    var ta = D.el('textarea', { class: 'dt-textedit', spellcheck: 'false', 'aria-label': 'Text bearbeiten', rows: 1 });
    ta.value = e.text;
    sheet.appendChild(ta);
    textEdit = { id: id, el: ta, original: e.text };
    var g = gMap.get(id);
    if (g) { g.setAttribute('display', 'none'); }
    placeTextEdit();
    ta.addEventListener('input', placeTextEdit);
    ta.addEventListener('keydown', function (ev) {
      ev.stopPropagation();
      if (ev.key === 'Escape') { ev.preventDefault(); endTextEdit(false); viewport.focus({ preventScroll: true }); }
      else if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); endTextEdit(true); viewport.focus({ preventScroll: true }); }
    });
    ta.addEventListener('blur', function (ev) {
      var next = ev.relatedTarget;
      if (next && next.closest && next.closest('[data-keep-edit]')) { return; }
      setTimeout(function () { if (textEdit && textEdit.el === ta) { endTextEdit(true); } }, 0);
    });
    textEdit.insert = function (token) {
      var start = ta.selectionStart === null ? ta.value.length : ta.selectionStart;
      var end = ta.selectionEnd === null ? start : ta.selectionEnd;
      ta.setRangeText(token, start, end, 'end');
      ta.focus({ preventScroll: true });
      placeTextEdit();
    };
    app.editing = textEdit;
    ta.focus({ preventScroll: true });
    if (!options || options.selectAll !== false) { ta.select(); } else { ta.setSelectionRange(ta.value.length, ta.value.length); }
    drawOverlay();
    app.emit('editing', true);
  }

  function endTextEdit(commit) {
    if (!textEdit) { return; }
    var edit = textEdit;
    textEdit = null;
    app.editing = null;
    var value = edit.el.value;
    if (edit.el.parentNode) { edit.el.parentNode.removeChild(edit.el); }
    var g = gMap.get(edit.id);
    if (g) { g.removeAttribute('display'); }
    if (commit && value !== edit.original && app.element(edit.id)) {
      app.setProps([edit.id], { text: value.slice(0, 5000) }, { merge: false });
    }
    drawOverlay();
    app.emit('editing', false);
  }

  // ================================================================================================ dropping media

  function ratioOfAsset(asset) {
    if (asset.width > 0 && asset.height > 0) { return Promise.resolve(asset.width / asset.height); }
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () { resolve(img.naturalWidth > 0 && img.naturalHeight > 0 ? img.naturalWidth / img.naturalHeight : 1); };
      img.onerror = function () { resolve(1); };
      img.src = asset.url;
    });
  }

  /** Adds an image element for an asset: sized by its aspect ratio (at most 40 % of the page), centred on `at` (document units) or on the page. */
  function addAssetImage(asset, at) {
    return ratioOfAsset(asset).then(function (ratio) {
      var doc = app.doc;
      var maxW = doc.width * 0.4;
      var maxH = doc.height * 0.4;
      var w = Math.min(maxW, maxH * ratio);
      var h = w / ratio;
      var cx = at ? at.x : doc.width / 2;
      var cy = at ? at.y : doc.height / 2;
      return app.addElement('image', { source: { asset: asset.key }, x: cx - w / 2, y: cy - h / 2, w: w, h: h, name: '' });
    });
  }

  /** Dropped (or clicked) asset: an image or image strip under the point gets the source, else a new image is added there. */
  function dropAsset(asset, clientX, clientY) {
    if (!app.editable()) { return Promise.resolve(null); }
    var p = toDoc(clientX, clientY);
    var hit = hitTest(p);
    if (hit && hit.type === 'image') { app.setSource(hit.id, { asset: asset.key }); app.select([hit.id]); return Promise.resolve(hit.id); }
    if (hit && hit.type === 'imageStrip') {
      var n = Math.max(1, hit.items.length);
      var local = D.toLocal(hit, p);
      var slot = D.clamp(Math.floor((local.x + hit.w / 2) / (hit.w / n)), 0, n - 1);
      app.setSource(hit.id, { asset: asset.key }, slot);
      app.select([hit.id]);
      return Promise.resolve(hit.id);
    }
    var inside = p.x >= 0 && p.y >= 0 && p.x <= app.doc.width && p.y <= app.doc.height;
    return addAssetImage(asset, inside ? p : null);
  }

  // ================================================================================================ init

  function init(theApp, refs) {
    app = theApp;
    viewport = refs.viewport;
    stage = refs.stage;
    sheet = refs.sheet;
    page = refs.page;
    overlay = refs.overlay;
    phone = window.matchMedia('(max-width: 767px)');

    viewport.addEventListener('pointerdown', onDown);
    viewport.addEventListener('pointermove', onMove);
    viewport.addEventListener('pointerup', onUp);
    viewport.addEventListener('pointercancel', onCancel);
    viewport.addEventListener('wheel', onWheel, { passive: false });
    // the middle button pans: no autoscroll circle of the browser
    viewport.addEventListener('mousedown', function (ev) { if (ev.button === 1) { ev.preventDefault(); } });
    viewport.addEventListener('auxclick', function (ev) { if (ev.button === 1) { ev.preventDefault(); } });
    viewport.addEventListener('dblclick', onDblClick);
    viewport.addEventListener('pointerleave', function (ev) { if (ev.pointerType === 'mouse' && hoverId && !gesture) { hoverId = null; drawOverlay(); } });
    viewport.addEventListener('contextmenu', function (ev) { if (gesture) { ev.preventDefault(); } });

    app.on('doc', function (ev) {
      applySize();
      // a new page size or unit (preset, undo) refits the page as long as the zoom is on "Einpassen"
      var sig = app.doc.unit + app.doc.width + 'x' + app.doc.height;
      if (sig !== pageSignature) { pageSignature = sig; if (app.fitMode && ev.reason !== 'load') { fit(); } }
      if (ev.render === 'now') { render(); }
      else if (ev.render === 'soon') { renderSoon(); }
      else { drawOverlay(); }
      if (ev.structure || ev.render === 'now') { drawOverlay(); }
      placeTextEdit();
    });
    app.on('selection', function () { hoverId = null; drawOverlay(); });
    app.on('readonly', function () { drawOverlay(); });
    app.on('assets', function () { if (app.doc) { render(); } });
    app.on('preview', function () { render(); });
    app.on('fonts', function () { if (app.doc) { render(); } });

    if (window.ResizeObserver) {
      new ResizeObserver(function () {
        if (!app.doc) { return; }
        var size = viewport.clientWidth + 'x' + viewport.clientHeight;
        if (size === lastFitSize) { return; }
        lastFitSize = size;
        if (app.fitMode) { setZoom(fitZoom(), null, true); }
      }).observe(viewport);
    }
    document.addEventListener('visibilitychange', function () { if (!document.hidden && app.doc) { drawOverlay(); } });
    phone.addEventListener('change', function () { if (app.doc) { render(); drawOverlay(); fit(); } });
  }

  /** Brings an element into view (layers panel click, field warnings). */
  function reveal(id) {
    var e = app.element(id);
    if (!e) { return; }
    var r = viewport.getBoundingClientRect();
    var b = D.aabb(e);
    var k = app.scale();
    var s = sheetRect();
    var left = s.left + b.x * k;
    var top = s.top + b.y * k;
    if (left < r.left || left + b.w * k > r.right) { viewport.scrollLeft += left + b.w * k / 2 - (r.left + r.width / 2); }
    if (top < r.top || top + b.h * k > r.bottom) { viewport.scrollTop += top + b.h * k / 2 - (r.top + r.height / 2); }
  }

  D.canvas = {
    init: init,
    render: render,
    applySize: applySize,
    drawOverlay: drawOverlay,
    fit: fit,
    fitZoom: fitZoom,
    setZoom: function (z, fitMode) { setZoom(z, null, !!fitMode); },
    zoomBy: zoomBy,
    stepZoom: stepZoom,
    startTextEdit: startTextEdit,
    endTextEdit: endTextEdit,
    isEditing: function () { return !!textEdit; },
    /** Resolves when no drawing is running or waiting (the browser checks wait for it). */
    whenIdle: function () { return renderPromise.then(function () { return renderBusy || renderQueued ? D.canvas.whenIdle() : undefined; }); },
    dropAsset: dropAsset,
    addAssetImage: addAssetImage,
    toDoc: toDoc,
    hitTest: hitTest,
    reveal: reveal,
    setSpace: function (down) { spaceDown = down; viewport.classList.toggle('is-space', down); },
    cancelGesture: function () { if (gesture) { var g = gesture; gesture = null; if (g.tx && g.tx.started()) { render(); } marquee = null; guides = []; badge = null; drawOverlay(); } },
    hasGesture: function () { return !!gesture; },
  };
})();
