/* DesignThix editor, part 2: the canvas. The current page is drawn by DtEngine (mode 'editor') into #dt-page; a separate overlay <svg> (#dt-overlay, screen pixels)
   carries hover and selection outlines, the 8 resize handles, the rotate handle, the marquee, the snapping guides and the distance markers. All pointer work (mouse, pen,
   touch) happens here: hit testing by element geometry (groups and their children, rotation included, topmost first), move / resize / rotate gestures (Shift = axis,
   Alt = copy), snapping (edges, centres, equal spacing), zoom and pan, inline text editing, a long press that opens the context menu.
   During a drag the document is changed live but the engine is NOT run: the overlay moves and the <g> of the node gets a transform; the engine draws again when the
   pointer is released (resize: once per frame). A node inside a group lives in the frame of that group (page coordinates before the group's rotation): the pointer
   is converted into that frame (D.toFrame) and the overlay back to the page (D.toWorld). Events emitted: 'contextmenu' {x, y, node, chain}, 'node:dblclick' {node}. */
(function () {
  'use strict';

  var D = window.DtDesigner;
  var MIN_ZOOM = 0.05;
  var MAX_ZOOM = 8;
  var DRAG_SLOP = 3;          // screen px before a press becomes a drag
  var LONG_PRESS_MS = 500;
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
  var hover = null;
  var guides = [];
  var marquee = null;
  var badge = null;
  var spaceDown = false;
  var touches = new Map();
  var pinch = null;
  var lastTap = null;
  var longPress = null;
  var lastMenuAt = 0;
  var coarse = window.matchMedia ? window.matchMedia('(pointer: coarse)') : { matches: false };
  var textEdit = null;
  var lastFitSize = '';
  var lastWarnings = '';
  var pageSignature = '';
  var engineWarnings = [];
  var modal = null;           // a mode that owns the pointer (crop mode): { onDown(ev), hideOverlay }

  // ================================================================================================ sizes, zoom, pan

  function applySize() {
    if (!app.doc) { return; }
    var k = app.scale();
    sheet.style.setProperty('width', D.round(app.doc.width * k, 2) + 'px');
    sheet.style.setProperty('height', D.round(app.doc.height * k, 2) + 'px');
  }

  function sheetRect() { return sheet.getBoundingClientRect(); }

  function toDoc(clientX, clientY) {
    var r = sheetRect();
    var k = app.scale();
    return { x: (clientX - r.left) / k, y: (clientY - r.top) / k };
  }

  function toClient(p) {
    var r = sheetRect();
    var k = app.scale();
    return { x: r.left + p.x * k, y: r.top + p.y * k };
  }

  function fitZoom() {
    var cs = window.getComputedStyle(stage);
    var padX = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
    var padY = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
    var availW = Math.max(60, viewport.clientWidth - padX);
    var availH = Math.max(60, viewport.clientHeight - padY);
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
    var steps = [0.05, 0.1, 0.15, 0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.25, 1.5, 2, 3, 4, 6, 8];
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
    engineWarnings = [];
    renderPromise = window.DtEngine.renderInto(page, app.doc, app.values, {
      page: app.pageIndex, mode: 'editor', idPrefix: 'ed' + renderCount, assetUrl: app.assetUrl, fonts: app.fonts, icon: D.icons.body,
      onWarning: function (message, elementId) { engineWarnings.push({ message: message, elementId: elementId }); },
    }).then(function (svg) {
      indexGroups(svg);
      page.classList.add('is-ready');
      computeWarnings();
      drawOverlay();
      placeTextEdit();
      rebaseGesture();
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

  /** Problems the preview shows: placeholders without a field, images that the library does not have, codes that cannot be drawn. */
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
      warnings.push({ kind: 'asset', key: key, text: 'Das Bild „' + key + '“ (' + where + ') gibt es nicht in den Uploads.' });
    };
    D.walk(app.elements(), function (e) {
      if (e.hidden) { return; }
      var sources = e.type === 'image' ? [e.source] : (e.type === 'imageStrip' ? e.items : []);
      sources.forEach(function (s) {
        if (!s) { return; }
        if (s.asset) { checkAsset(s.asset, D.elementTitle(e)); }
        else if (s.field) { checkAsset(valueOf(s.field), 'Feld ' + s.field); }
      });
    });
    var bg = app.page().background;
    if (bg.asset) { checkAsset(bg.asset, 'Hintergrund'); }
    engineWarnings.forEach(function (w) {
      if (/^Medium "/.test(w.message) || /Platzhalter/.test(w.message)) { return; }
      warnings.push({ kind: 'engine', elementId: w.elementId, text: w.message });
    });
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
      if (e.shape === 'rect' && !e.fill) {
        var outer = Math.abs(l.x) <= hw + tol && Math.abs(l.y) <= hh + tol;
        var innerBox = Math.abs(l.x) < hw - tol && Math.abs(l.y) < hh - tol;
        return outer && !innerBox;
      }
    }
    return Math.abs(l.x) <= hw + tol && Math.abs(l.y) <= hh + tol;
  }

  function hitTree(list, p, tol, o, chain) {
    for (var i = list.length - 1; i >= 0; i--) {
      var e = list[i];
      if (e.hidden || (e.locked && !o.locked) || !gMap.has(e.id)) { continue; }
      if (e.type === 'group') {
        var inner = hitTree(e.children, D.groupBackward(e, p), tol, o, chain.concat([e]));
        if (inner) { return inner; }
        continue;
      }
      if (hitElement(e, p, tol)) { return { node: e, chain: chain }; }
    }
    return null;
  }

  /** The deepest node under a point (page units): { node, chain } or null. Hidden, not drawn and (by default) locked nodes are skipped. */
  function hitDeep(p, options) {
    return hitTree(app.elements(), p, pointTolerance(), options || {}, []);
  }

  /** The group the selection lives in (a click on its other children selects the child, not the whole group), or null. */
  function enteredGroup() {
    var chain = app.sel.length ? app.selectionChain() : [];
    return chain.length ? chain[chain.length - 1] : null;
  }

  /** What a click on a hit selects: the top-level node (a whole group), the child directly in the entered group, or with deep the node itself. */
  function pick(h, deep) {
    if (!h) { return null; }
    if (deep) { return h.node; }
    var entered = enteredGroup();
    if (entered) {
      var at = h.chain.findIndex(function (g) { return g.id === entered.id; });
      if (at >= 0) { return at + 1 < h.chain.length ? h.chain[at + 1] : h.node; }
    }
    return h.chain.length ? h.chain[0] : h.node;
  }

  /** The topmost node under a point (document units) the way a click would select it. */
  function hitTest(p, options) {
    var o = options || {};
    var h = hitDeep(p, o);
    return pick(h, !!o.deep);
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

  function screen(p) { var k = app.scale(); return { x: D.round(p.x * k, 2), y: D.round(p.y * k, 2) }; }

  function polygon(points) { return points.map(function (p) { var s = screen(p); return s.x + ',' + s.y; }).join(' '); }

  function nodeChain(id) { var r = app.locate(id, false); return r ? r.chain : []; }

  function drawOverlayNow() {
    D.empty(overlay);
    if (!app.doc || (modal && modal.hideOverlay)) { return; }
    var k = app.scale();
    var editable = app.editable();
    var sel = app.selected();
    var chain = app.selectionChain();
    var gOverlay = function (cls) { return D.svg('g', { class: cls }, null); };
    var layerHints = gOverlay('dt-ov-hints');
    var layerHover = gOverlay('dt-ov-hover');
    var layerSel = gOverlay('dt-ov-sel');
    var layerGuides = gOverlay('dt-ov-guides');
    var layerTop = gOverlay('dt-ov-top');
    [layerHints, layerHover, layerSel, layerGuides, layerTop].forEach(function (g) { overlay.appendChild(g); });

    // An image strip with no source at all draws nothing in the engine: show where it is.
    D.walk(app.elements(), function (e, list, i, c) {
      if (e.type !== 'imageStrip' || e.hidden || e.items.some(Boolean)) { return; }
      layerHints.appendChild(D.svg('polygon', { class: 'dt-ov-hint', points: polygon(D.worldCorners(e, c)) }));
      var centre = screen(D.toWorld(c, { x: e.x + e.w / 2, y: e.y + e.h / 2 }));
      var t = D.svg('text', { class: 'dt-ov-hinttext', x: centre.x, y: centre.y, 'text-anchor': 'middle', 'dominant-baseline': 'central' });
      t.textContent = 'Bildleiste – Bilder hierher ziehen';
      layerHints.appendChild(t);
    });

    // hover (mouse) and marquee candidates
    var hovered = [];
    if (marquee && marquee.hits) { hovered = marquee.hits; }
    else if (hover && !app.isSelected(hover.node.id) && !gesture && !textEdit) { hovered = [hover.node.id]; }
    hovered.forEach(function (id) {
      var r = app.locate(id, false);
      if (r) { layerHover.appendChild(D.svg('polygon', { class: 'dt-ov-hover', points: polygon(D.worldCorners(r.el, r.chain)) })); }
    });

    // selection
    sel.forEach(function (e) {
      var cls = 'dt-ov-outline' + (e.locked ? ' is-locked' : '') + (sel.length > 1 ? ' is-multi' : '') + (e.type === 'group' ? ' is-group' : '');
      var wc = D.worldCorners(e, nodeChain(e.id));
      if (e.type === 'shape' && e.shape === 'line') {
        var a = screen(wc[0]);
        var b = screen(wc[2]);
        layerSel.appendChild(D.svg('line', { class: cls, x1: a.x, y1: a.y, x2: b.x, y2: b.y }));
      } else {
        layerSel.appendChild(D.svg('polygon', { class: cls, points: polygon(wc) }));
      }
    });
    // the children of a selected group, faintly
    sel.forEach(function (e) {
      if (e.type !== 'group') { return; }
      var c = nodeChain(e.id).concat([e]);
      e.children.forEach(function (child) { layerHints.appendChild(D.svg('polygon', { class: 'dt-ov-child', points: polygon(D.worldCorners(child, c)) })); });
    });

    var movableNodes = sel.filter(function (e) { return !e.locked; });
    var showHandles = editable && movableNodes.length > 0 && !textEdit && !(gesture && gesture.type === 'marquee');
    if (showHandles && sel.length === 1) {
      drawHandles(layerTop, sel[0], chain, true);
    } else if (showHandles && movableNodes.length === sel.length && sel.length > 1) {
      var union = D.unionBox(sel.map(D.aabb));
      var frame = { x: union.x, y: union.y, w: union.w, h: union.h, rotation: 0, type: 'union' };
      layerSel.appendChild(D.svg('polygon', { class: 'dt-ov-group', points: polygon(D.worldCorners(frame, chain)) }));
      drawHandles(layerTop, frame, chain, false);
    }

    // guides: alignment lines and distance markers (in the page frame; a group with a transform has none)
    guides.forEach(function (g) {
      if (g.kind === 'gap') {
        var p1 = g.axis === 'x' ? { x: g.from, y: g.at } : { x: g.at, y: g.from };
        var p2 = g.axis === 'x' ? { x: g.to, y: g.at } : { x: g.at, y: g.to };
        var s1 = screen(D.toWorld(chain, p1));
        var s2 = screen(D.toWorld(chain, p2));
        layerGuides.appendChild(D.svg('line', { class: 'dt-ov-gap', x1: s1.x, y1: s1.y, x2: s2.x, y2: s2.y }));
        [s1, s2].forEach(function (s) {
          var tick = g.axis === 'x' ? { x1: s.x, x2: s.x, y1: s.y - 4, y2: s.y + 4 } : { y1: s.y, y2: s.y, x1: s.x - 4, x2: s.x + 4 };
          tick.class = 'dt-ov-gap';
          layerGuides.appendChild(D.svg('line', tick));
        });
        var mid = { x: (s1.x + s2.x) / 2, y: (s1.y + s2.y) / 2 };
        var width = g.label.length * 6.2 + 10;
        var labelNode = D.svg('g', { class: 'dt-ov-gaplabel' });
        labelNode.appendChild(D.svg('rect', { x: D.round(mid.x - width / 2, 1), y: D.round(mid.y - 9 - (g.axis === 'x' ? 11 : 0), 1), width: D.round(width, 1), height: 17, rx: 3 }));
        var tx = D.svg('text', { x: D.round(mid.x, 1), y: D.round(mid.y - (g.axis === 'x' ? 11 : 0), 1), 'text-anchor': 'middle', 'dominant-baseline': 'central' });
        tx.textContent = g.label;
        labelNode.appendChild(tx);
        layerGuides.appendChild(labelNode);
        return;
      }
      var a1 = g.axis === 'x' ? { x: g.pos, y: g.from } : { x: g.from, y: g.pos };
      var a2 = g.axis === 'x' ? { x: g.pos, y: g.to } : { x: g.to, y: g.pos };
      var t1 = screen(D.toWorld(chain, a1));
      var t2 = screen(D.toWorld(chain, a2));
      layerGuides.appendChild(D.svg('line', { class: 'dt-ov-guide', x1: t1.x, y1: t1.y, x2: t2.x, y2: t2.y }));
    });

    if (marquee && marquee.rect) {
      var m = marquee.rect;
      layerTop.appendChild(D.svg('rect', { class: 'dt-ov-marquee', x: D.round(m.x * k, 1), y: D.round(m.y * k, 1), width: D.round(m.w * k, 1), height: D.round(m.h * k, 1) }));
    }

    if (badge) {
      var bs = screen(badge);
      var label = D.svg('g', { class: 'dt-ov-badge' });
      var text = D.svg('text', { x: bs.x, y: D.round(bs.y + 22, 1), 'text-anchor': 'middle', 'dominant-baseline': 'central' });
      text.textContent = badge.text;
      var bwidth = badge.text.length * 6.6 + 14;
      label.appendChild(D.svg('rect', { x: D.round(bs.x - bwidth / 2, 1), y: D.round(bs.y + 12, 1), width: D.round(bwidth, 1), height: 20, rx: 4 }));
      label.appendChild(text);
      layerTop.appendChild(label);
    }
  }

  function drawHandles(layer, b, chain, withRotate) {
    var geo = box(b);
    var k = app.scale();
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
    // a small element keeps its middle free: the hit area of an edge handle never reaches further than a third of the smaller side (corners keep the full 44 px)
    var reach = Math.max(9, Math.min(hit, 0.32 * Math.min(screenW, screenH)));
    names.forEach(function (name) {
      var p = screen(D.toWorld(chain, handlePoint(geo, name)));
      var s = HANDLES[name];
      var corner = s.sx !== 0 && s.sy !== 0;
      layer.appendChild(D.svg('circle', { class: 'dt-handle' + (corner ? '' : ' is-edge'), cx: p.x, cy: p.y, r: corner ? 5.5 : 4.5 }));
      layer.appendChild(D.svg('circle', { class: 'dt-handle__hit dt-cursor-' + name, 'data-handle': name, cx: p.x, cy: p.y, r: corner ? hit : D.round(reach, 1) }));
    });
    if (withRotate) {
      // the rotate handle sits below the element, like in Canva
      var bottom = isLine ? { x: geo.x + geo.w / 2, y: geo.y + geo.h / 2 } : handlePoint(geo, 's');
      var dir = D.rotateVec({ x: 0, y: 1 }, geo.rotation);
      var gap = (coarse.matches ? 40 : 30) / k;
      var anchor = screen(D.toWorld(chain, bottom));
      var handleAt = screen(D.toWorld(chain, { x: bottom.x + dir.x * gap, y: bottom.y + dir.y * gap }));
      layer.appendChild(D.svg('line', { class: 'dt-ov-stem', x1: anchor.x, y1: anchor.y, x2: handleAt.x, y2: handleAt.y }));
      layer.appendChild(D.svg('circle', { class: 'dt-handle is-rotate', cx: handleAt.x, cy: handleAt.y, r: 10 }));
      var glyph = D.icon('rotate-cw', 'dt-handle__glyph');
      glyph.setAttribute('x', D.round(handleAt.x - 6, 2));
      glyph.setAttribute('y', D.round(handleAt.y - 6, 2));
      glyph.setAttribute('width', 12);
      glyph.setAttribute('height', 12);
      layer.appendChild(glyph);
      layer.appendChild(D.svg('circle', { class: 'dt-handle__hit dt-cursor-rotate', 'data-handle': 'rot', cx: handleAt.x, cy: handleAt.y, r: hit + 4 }));
    }
  }

  // ================================================================================================ snapping

  function snapThreshold() { return (coarse.matches ? 10 : 6) / app.scale(); }

  /** Lines of the page and of the other nodes of the list that a moving box can snap to, plus their boxes (for equal spacing). */
  function snapCandidates(excludeIds, list, chain) {
    if (D.chainRotated(chain)) { return { xs: [], ys: [], boxes: [] }; }
    var doc = app.doc;
    var xs = [{ pos: 0, from: 0, to: doc.height }, { pos: doc.width / 2, from: 0, to: doc.height }, { pos: doc.width, from: 0, to: doc.height }];
    var ys = [{ pos: 0, from: 0, to: doc.width }, { pos: doc.height / 2, from: 0, to: doc.width }, { pos: doc.height, from: 0, to: doc.width }];
    var boxes = [];
    list.forEach(function (e) {
      if (excludeIds.indexOf(e.id) >= 0 || e.hidden || !gMap.has(e.id)) { return; }
      var b = D.aabb(e);
      boxes.push(b);
      [b.x, b.x + b.w / 2, b.x + b.w].forEach(function (x) { xs.push({ pos: x, from: b.y, to: b.y + b.h }); });
      [b.y, b.y + b.h / 2, b.y + b.h].forEach(function (y) { ys.push({ pos: y, from: b.x, to: b.x + b.w }); });
    });
    return { xs: xs, ys: ys, boxes: boxes };
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

  /**
   * Equal spacing along one axis: where the moving box can sit so that its gaps to its neighbours are equal (between two nodes), or equal to a gap between two
   * other nodes (next to a pair). Returns { shift, items: [{from, to, at}] } (items = the equal gaps to mark) or null.
   */
  function spacingSnap(b, boxes, axis, threshold) {
    var horiz = axis === 'x';
    var lo = horiz ? 'x' : 'y';
    var len = horiz ? 'w' : 'h';
    var clo = horiz ? 'y' : 'x';
    var clen = horiz ? 'h' : 'w';
    var peers = boxes.filter(function (o) { return o[clo] < b[clo] + b[clen] && o[clo] + o[clen] > b[clo]; }).sort(function (p, q) { return p[lo] - q[lo]; });
    if (!peers.length) { return null; }
    var centre = b[lo] + b[len] / 2;
    var left = peers.filter(function (o) { return o[lo] + o[len] / 2 < centre; });
    var right = peers.filter(function (o) { return o[lo] + o[len] / 2 >= centre; });
    var cross = function (o) { var top = Math.max(o[clo], b[clo]); var bottom = Math.min(o[clo] + o[clen], b[clo] + b[clen]); return (top + bottom) / 2; };
    var best = null;
    var consider = function (shift, items) { if (Math.abs(shift) <= threshold && (!best || Math.abs(shift) < Math.abs(best.shift))) { best = { shift: shift, items: items }; } };
    var L = left.reduce(function (m, o) { return !m || o[lo] + o[len] > m[lo] + m[len] ? o : m; }, null);
    var R = right.reduce(function (m, o) { return !m || o[lo] < m[lo] ? o : m; }, null);
    if (L && R) {
      var target = (L[lo] + L[len] + R[lo] - b[len]) / 2;
      var gap = target - (L[lo] + L[len]);
      if (gap >= 0) {
        consider(target - b[lo], [{ from: L[lo] + L[len], to: target, at: cross(L) }, { from: target + b[len], to: R[lo], at: cross(R) }]);
      }
    }
    for (var i = 0; i + 1 < peers.length; i++) {
      var P = peers[i];
      var Q = peers[i + 1];
      var g = Q[lo] - (P[lo] + P[len]);
      if (g <= 0.01) { continue; }
      // next to the pair on the right: the moving box is right of Q
      if (centre >= Q[lo] + Q[len] / 2) {
        var t1 = Q[lo] + Q[len] + g;
        consider(t1 - b[lo], [{ from: P[lo] + P[len], to: Q[lo], at: cross(P) }, { from: Q[lo] + Q[len], to: t1, at: cross(Q) }]);
      }
      // next to the pair on the left: the moving box is left of P
      if (centre <= P[lo] + P[len] / 2) {
        var t2 = P[lo] - g - b[len];
        consider(t2 - b[lo], [{ from: t2 + b[len], to: P[lo], at: cross(P) }, { from: P[lo] + P[len], to: Q[lo], at: cross(Q) }]);
      }
    }
    return best;
  }

  function snappingOn(ev) { return app.snapping && !ev.altKey; }

  function distanceLabel(v) { return String(D.round(v, app.unit() === 'px' ? 0 : 1)).replace('.', ',') + ' ' + D.unitLabel(app.unit()); }

  // ================================================================================================ gestures

  function pointerToDoc(ev) { return toDoc(ev.clientX, ev.clientY); }

  function capture(ev) { try { viewport.setPointerCapture(ev.pointerId); } catch (e) { /* the pointer is already gone */ } }

  function startPan(ev, tap) {
    gesture = { type: 'pan', pointerId: ev.pointerId, x: ev.clientX, y: ev.clientY, left: viewport.scrollLeft, top: viewport.scrollTop, moved: false, tap: !!tap };
    viewport.classList.add('is-panning');
    capture(ev);
  }

  function frameOf(ev, chain) { return D.toFrame(chain, pointerToDoc(ev)); }

  function startMove(ev, hit, extendedSelection) {
    var ids = app.sel.filter(function (id) { var e = app.element(id); return e && !e.locked; });
    if (!ids.length || !app.editable()) { return; }
    var chain = app.selectionChain();
    var first = app.locate(ids[0], false);
    var g = {
      type: 'move', pointerId: ev.pointerId, ids: ids, chain: chain, list: first.list, client0: { x: ev.clientX, y: ev.clientY }, tx: app.tx(), started: false,
      hit: hit, deferSingle: !extendedSelection && app.sel.length > 1, copy: ev.altKey, last: { x: ev.clientX, y: ev.clientY },
    };
    gesture = g;
    rebaseMove(g, ev.clientX, ev.clientY);
    capture(ev);
  }

  /** (Re)bases a move: the positions of the nodes now are the origin, the pointer position now is the start (after a render or after Alt made the copies). */
  function rebaseMove(g, clientX, clientY) {
    g.p0 = D.toFrame(g.chain, toDoc(clientX, clientY));
    g.orig = {};
    g.transforms = new Map();
    g.ids.forEach(function (id) {
      var e = app.element(id);
      if (!e) { return; }
      g.orig[id] = { x: e.x, y: e.y };
      var node = gMap.get(id);
      g.transforms.set(id, node ? node.getAttribute('transform') : null);
    });
    g.box0 = D.unionBox(g.ids.map(function (id) { return D.aabb(app.element(id)); }));
    g.cands = snapCandidates(g.ids, g.list, g.chain);
  }

  function rebaseGesture() {
    if (!gesture || gesture.type !== 'move' || !gesture.started) { return; }
    rebaseMove(gesture, gesture.last.x, gesture.last.y);
  }

  function startHandle(ev, name) {
    var sel = app.selected().filter(function (e) { return !e.locked; });
    if (!sel.length || !app.editable()) { return; }
    var chain = app.selectionChain();
    if (name === 'rot') {
      var e = sel[0];
      var c = { x: e.x + e.w / 2, y: e.y + e.h / 2 };
      var p = frameOf(ev, chain);
      gesture = {
        type: 'rotate', pointerId: ev.pointerId, id: e.id, chain: chain, centre: c, angle0: Math.atan2(p.y - c.y, p.x - c.x), rotation0: e.rotation || 0,
        tx: app.tx(), started: false, client0: { x: ev.clientX, y: ev.clientY },
      };
      capture(ev);
      return;
    }
    var single = sel.length === 1 && app.sel.length === 1;
    var items = sel.map(function (e2) { return D.clone({ id: e2.id, x: e2.x, y: e2.y, w: e2.w, h: e2.h, rotation: e2.rotation || 0 }); });
    var frame = single ? box(sel[0]) : (function () { var u = D.unionBox(sel.map(D.aabb)); u.rotation = 0; return u; })();
    var grabAt = frameOf(ev, chain);
    var handleAt = handlePoint(frame, name);
    var first = app.locate(sel[0].id, false);
    gesture = {
      type: 'resize', pointerId: ev.pointerId, handle: name, single: single, chain: chain, grab: { x: grabAt.x - handleAt.x, y: grabAt.y - handleAt.y }, items: items, frame: frame,
      isLine: single && sel[0].type === 'shape' && sel[0].shape === 'line', isText: single && sel[0].type === 'text',
      cands: snapCandidates(items.map(function (i) { return i.id; }), first.list, chain), tx: app.tx(), started: false, client0: { x: ev.clientX, y: ev.clientY },
    };
    capture(ev);
  }

  function startMarquee(ev) {
    var p = pointerToDoc(ev);
    gesture = { type: 'marquee', pointerId: ev.pointerId, p0: p, additive: ev.shiftKey || ev.ctrlKey || ev.metaKey, base: app.sel.slice(), client0: { x: ev.clientX, y: ev.clientY }, started: false };
    capture(ev);
  }

  function cancelLongPress() { if (longPress) { clearTimeout(longPress.timer); longPress = null; } }

  function startLongPress(ev) {
    cancelLongPress();
    longPress = { x: ev.clientX, y: ev.clientY, id: ev.pointerId };
    longPress.timer = setTimeout(function () {
      var lp = longPress;
      longPress = null;
      if (!lp || touches.size > 1 || pinch) { return; }
      if (gesture && gesture.started) { return; }
      if (gesture && gesture.tx && gesture.tx.started()) { return; }
      var g = gesture;
      gesture = null;
      viewport.classList.remove('is-panning');
      try { viewport.releasePointerCapture(lp.id); } catch (e) { /* released */ }
      if (g && g.type === 'move' && g.ids) { /* nothing was changed yet */ }
      openContextMenuAt(lp.x, lp.y, false, true);
    }, LONG_PRESS_MS);
  }

  function openContextMenuAt(clientX, clientY, deep, fromTouch) {
    if (fromTouch) { lastMenuAt = Date.now(); }
    var p = toDoc(clientX, clientY);
    var h = hitDeep(p, {});
    var node = pick(h, deep);
    if (node && !app.isSelected(node.id)) { app.select([node.id]); }
    else if (!node && app.sel.length) { app.select([]); }
    app.emit('contextmenu', { x: clientX, y: clientY, node: node, point: p });
  }

  function onDown(ev) {
    if (!app.doc) { return; }
    if (modal) { if (modal.onDown) { modal.onDown(ev); } return; }
    if (textEdit && ev.target === textEdit.el) { return; }
    if (textEdit) { endTextEdit(true); }
    if (ev.target.closest && ev.target.closest('.dt-warnbar, .dt-canvas-tools')) { return; }
    if (document.activeElement && document.activeElement !== viewport && document.activeElement.blur && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) { document.activeElement.blur(); }
    viewport.focus({ preventScroll: true });

    if (ev.pointerType === 'touch') {
      touches.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (touches.size === 2) { cancelLongPress(); startPinch(); return; }
      if (touches.size > 2) { return; }
    }
    if (gesture || pinch) { return; }

    if (ev.button === 1 || (ev.button === 0 && spaceDown)) { ev.preventDefault(); startPan(ev, false); return; }
    if (ev.pointerType === 'mouse' && ev.button !== 0) { return; }

    var handle = ev.target.closest ? ev.target.closest('[data-handle]') : null;
    if (handle && app.editable()) { ev.preventDefault(); startHandle(ev, handle.getAttribute('data-handle')); return; }

    var p = pointerToDoc(ev);
    var deep = ev.ctrlKey || ev.metaKey;
    var extend = ev.shiftKey;
    var h = hitDeep(p, {});
    var hit = pick(h, deep && !extend);
    if (ev.pointerType === 'touch') { startLongPress(ev); }
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
      if (Math.abs(dx) + Math.abs(dy) > DRAG_SLOP) { g.moved = true; if (Math.abs(dx) + Math.abs(dy) > 8) { cancelLongPress(); } }
      viewport.scrollLeft = g.left - dx;
      viewport.scrollTop = g.top - dy;
      return;
    }
    if (g.type === 'tap') { if (longPress && Math.hypot(ev.clientX - longPress.x, ev.clientY - longPress.y) > 8) { cancelLongPress(); } return; }
    var dist = Math.hypot(ev.clientX - g.client0.x, ev.clientY - g.client0.y);
    if (!g.started && dist < DRAG_SLOP) { return; }
    if (!g.started && dist > 8) { cancelLongPress(); }
    if (!g.started) { g.started = true; cancelLongPress(); }
    var p = frameOf(ev, g.chain || []);
    if (g.type === 'move') { g.last = { x: ev.clientX, y: ev.clientY }; doMove(g, p, ev); }
    else if (g.type === 'resize') { doResize(g, p, ev); }
    else if (g.type === 'rotate') { doRotate(g, p, ev); }
    else if (g.type === 'marquee') { doMarquee(g, pointerToDoc(ev), ev); }
  }

  /** Alt + drag: the copies appear where the originals are and are dragged, the originals stay. */
  function makeCopiesForDrag(g) {
    g.copy = false;
    var sources = g.ids.map(function (id) { return app.element(id); }).filter(Boolean);
    var copies = D.cloneNodes(sources, D.idMaker(app.doc), 0, 0);
    g.tx.apply(function () { copies.forEach(function (c) { g.list.push(c); }); }, { render: 'now', structure: true, reason: 'duplicate' });
    g.ids = copies.map(function (c) { return c.id; });
    app.sel = g.ids.slice();
    app.emit('selection');
    rebaseMove(g, g.last.x, g.last.y);
  }

  function doMove(g, p, ev) {
    if (g.copy) { makeCopiesForDrag(g); }
    var dx = p.x - g.p0.x;
    var dy = p.y - g.p0.y;
    if (ev.shiftKey) { if (Math.abs(dx) >= Math.abs(dy)) { dy = 0; } else { dx = 0; } }
    guides = [];
    if (snappingOn(ev)) {
      var t = snapThreshold();
      var b = g.box0;
      var sx = bestShift([b.x + dx, b.x + dx + b.w / 2, b.x + dx + b.w], g.cands.xs, t);
      var sy = bestShift([b.y + dy, b.y + dy + b.h / 2, b.y + dy + b.h], g.cands.ys, t);
      var lockX = ev.shiftKey && dx === 0;
      var lockY = ev.shiftKey && dy === 0;
      if (sx !== null && !lockX) { dx += sx; }
      if (sy !== null && !lockY) { dy += sy; }
      var moved = { x: b.x + dx, y: b.y + dy, w: b.w, h: b.h };
      // equal spacing where no edge or centre snapped
      var gapGuides = [];
      if (g.cands.boxes && g.cands.boxes.length) {
        if (sx === null && !lockX) {
          var spx = spacingSnap(moved, g.cands.boxes, 'x', t);
          if (spx) { dx += spx.shift; moved.x += spx.shift; spx.items.forEach(function (it) { gapGuides.push({ kind: 'gap', axis: 'x', from: it.from, to: it.to, at: it.at, label: distanceLabel(it.to - it.from) }); }); }
        }
        if (sy === null && !lockY) {
          var spy = spacingSnap(moved, g.cands.boxes, 'y', t);
          if (spy) { dy += spy.shift; moved.y += spy.shift; spy.items.forEach(function (it) { gapGuides.push({ kind: 'gap', axis: 'y', from: it.from, to: it.to, at: it.at, label: distanceLabel(it.to - it.from) }); }); }
        }
      }
      guides = guidesFor(moved, g.cands, 'x').concat(guidesFor(moved, g.cands, 'y'), gapGuides);
    }
    g.tx.apply(function () {
      g.ids.forEach(function (id) {
        var r = app.locate(id, false);
        if (!r) { return; }
        var ddx = g.orig[id].x + dx - r.el.x;
        var ddy = g.orig[id].y + dy - r.el.y;
        D.translate(r.el, ddx, ddy);
        var node = gMap.get(id);
        if (node) {
          var old = g.transforms.get(id);
          node.setAttribute('transform', 'translate(' + D.round(r.el.x - g.orig[id].x, 3) + ' ' + D.round(r.el.y - g.orig[id].y, 3) + ')' + (old ? ' ' + old : ''));
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
      if (s.sx !== 0) {
        var shiftX = bestShift([p.x], g.cands.xs, t);
        if (shiftX !== null) { p = { x: p.x + shiftX, y: p.y }; }
      }
      if (s.sy !== 0) {
        var shiftY = bestShift([p.y], g.cands.ys, t);
        if (shiftY !== null) { p = { x: p.x, y: p.y + shiftY }; }
      }
    }
    // a corner keeps the proportions with Shift, and always for a picture or a group (as Canva does); text and shapes stretch freely
    var item0 = g.single ? app.element(g.items[0].id) : null;
    var keepRatio = ev.shiftKey || (g.single && item0 && (item0.type === 'image' || item0.type === 'qr' || item0.type === 'icon') && s.sx !== 0 && s.sy !== 0 && !ev.altKey);
    var nb = resizedBox(frame, handle, p, keepRatio, min, g.isLine);
    if (g.isLine && g.single) { nb.h = Math.max(0, nb.h); nb.w = Math.max(0, nb.w); }
    if (snappingOn(ev) && !(frame.rotation % 180)) {
      guides = guidesFor(nb, g.cands, 'x').filter(function () { return s.sx !== 0; }).concat(guidesFor(nb, g.cands, 'y').filter(function () { return s.sy !== 0; }));
    }
    g.tx.apply(function () {
      if (g.single) {
        var r = app.locate(g.items[0].id, false);
        if (r) { D.setBox(r.el, nb); }
      } else {
        var fx = frame.w > 0 ? nb.w / frame.w : 1;
        var fy = frame.h > 0 ? nb.h / frame.h : 1;
        g.items.forEach(function (it) {
          var r2 = app.locate(it.id, false);
          if (!r2) { return; }
          var cx = nb.x + (it.x + it.w / 2 - frame.x) * fx;
          var cy = nb.y + (it.y + it.h / 2 - frame.y) * fy;
          var w = it.w * fx;
          var h = it.h * fy;
          D.setBox(r2.el, { x: cx - w / 2, y: cy - h / 2, w: w, h: h });
        });
      }
    }, { render: 'soon', reason: 'resize' });
    var centre = D.toWorld(g.chain, { x: nb.x + nb.w / 2, y: nb.y + nb.h / 2 });
    var bottomWorld = D.boxOfPoints(D.worldCorners({ x: nb.x, y: nb.y, w: nb.w, h: nb.h, rotation: frame.rotation || 0 }, g.chain));
    badge = { x: centre.x, y: bottomWorld.y + bottomWorld.h, text: D.round(nb.w, 1) + ' × ' + D.round(nb.h, 1) + ' ' + D.unitLabel(app.unit()) };
    drawOverlay();
  }

  function doRotate(g, p, ev) {
    var angle = Math.atan2(p.y - g.centre.y, p.x - g.centre.x);
    var rot = g.rotation0 + (angle - g.angle0) * 180 / Math.PI;
    if (ev.shiftKey) { rot = Math.round(rot / 15) * 15; }
    else {
      // a gentle pull to the right angles
      var nearest = Math.round(rot / 45) * 45;
      if (Math.abs(rot - nearest) < 2) { rot = nearest; }
    }
    rot = D.round(D.normAngle(rot), 1);
    g.tx.apply(function () {
      var r = app.locate(g.id, false);
      if (!r) { return; }
      r.el.rotation = rot;
      var node = gMap.get(g.id);
      if (node) { node.setAttribute('transform', D.svgTransform(r.el) || ''); }
    }, { render: 'none', reason: 'rotate' });
    var e2 = app.element(g.id);
    var wb = D.boxOfPoints(D.worldCorners(e2, g.chain));
    badge = { x: wb.x + wb.w / 2, y: wb.y + wb.h + 22 / app.scale(), text: rot + '°' };
    guides = [];
    drawOverlay();
  }

  function doMarquee(g, p) {
    var x1 = Math.min(g.p0.x, p.x);
    var y1 = Math.min(g.p0.y, p.y);
    var rect = { x: x1, y: y1, w: Math.abs(p.x - g.p0.x), h: Math.abs(p.y - g.p0.y) };
    var hits = app.elements().filter(function (e) {
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
    if (gesture || pinch || ev.pointerType !== 'mouse' || !app.doc || textEdit) { return; }
    // hover
    var overHandle = ev.target.closest && ev.target.closest('[data-handle]');
    var h = overHandle ? null : hitDeep(pointerToDoc(ev), {});
    var node = h ? pick(h, ev.ctrlKey || ev.metaKey) : null;
    var changed = (node ? node.id : null) !== (hover ? hover.node.id : null);
    hover = node ? { node: node } : null;
    if (changed) { drawOverlay(); }
    viewport.classList.toggle('is-over-element', !!node && app.isSelected(node.id) && app.editable());
  }

  function endGesture(ev, cancelled) {
    var g = gesture;
    gesture = null;
    cancelLongPress();
    viewport.classList.remove('is-panning');
    try { viewport.releasePointerCapture(ev.pointerId); } catch (e) { /* released */ }
    if (!g) { return; }
    guides = [];
    badge = null;
    if (g.type === 'pan') {
      if (g.tap && !g.moved && !cancelled && app.sel.length) { app.select([]); }
    } else if (g.type === 'move' || g.type === 'resize' || g.type === 'rotate') {
      if (g.started && g.tx.started()) {
        if (g.type === 'resize' && g.isText) { growTextBox(g.items[0].id, true); }
        render();
      }
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

  /** A press without a drag on a node: a second tap within 350 ms edits it (touch and pen; the mouse has dblclick). */
  function tapped(ev, hit) {
    if (ev.pointerType === 'mouse') { return; }
    if (Date.now() - lastMenuAt < 900) { return; }
    var now = Date.now();
    if (lastTap && lastTap.id === hit.id && now - lastTap.at < 350) {
      lastTap = null;
      editNode(hit, pointerToDoc(ev));
      return;
    }
    lastTap = { id: hit.id, at: now };
  }

  /** Double click / double tap: text is edited, a group lets you select the child under the pointer, an image goes to crop mode (hook for the crop UI). */
  function editNode(hit, p) {
    if (!app.editable()) { return; }
    if (hit.type === 'text') { startTextEdit(hit.id); return; }
    if (hit.type === 'group') {
      var h = hitDeep(p, {});
      if (h) { var child = pick({ node: h.node, chain: h.chain }, true); app.select([child.id]); }
      return;
    }
    if (hit.type === 'image' || hit.type === 'imageStrip') { app.emit('node:dblclick', { node: hit, point: p }); }
  }

  function onUp(ev) {
    if (ev.pointerType === 'touch') {
      touches.delete(ev.pointerId);
      cancelLongPress();
      if (pinch) { if (touches.size < 2) { pinch = null; } return; }
    }
    if (gesture && gesture.pointerId === ev.pointerId) { endGesture(ev, false); }
  }

  function onCancel(ev) {
    if (ev.pointerType === 'touch') { touches.delete(ev.pointerId); cancelLongPress(); if (pinch && touches.size < 2) { pinch = null; } }
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
    if (!app.doc || modal || !app.editable() || ev.target.closest('.dt-canvas-tools')) { return; }
    var h = hitDeep(pointerToDoc(ev), {});
    var node = h ? pick(h, false) : null;
    if (node) { editNode(node, pointerToDoc(ev)); }
  }

  function onContextMenu(ev) {
    if (!app.doc) { return; }
    ev.preventDefault();
    if (modal || (gesture && gesture.started)) { return; }
    if (Date.now() - lastMenuAt < 800) { return; }
    if (ev.target.closest && ev.target.closest('.dt-canvas-tools, .dt-textedit')) { return; }
    openContextMenuAt(ev.clientX, ev.clientY, ev.ctrlKey || ev.metaKey);
  }

  // ================================================================================================ inline text editing

  function cssFont(family) { return "'" + String(family || 'sans-serif').replace(/[\u0000-\u001f"'\\;{}<>,]/g, ' ').trim() + "', sans-serif"; }

  function textSpec(e, text, fit, size) {
    return {
      text: e.uppercase ? text.toUpperCase() : text, fontFamily: e.fontFamily, fontSize: size, fontWeight: e.fontWeight, italic: e.italic,
      letterSpacing: e.letterSpacing, lineHeight: e.lineHeight, wrap: e.wrap, fit: fit, minFontSize: e.minFontSize, width: e.w, height: e.h, unit: app.unit(),
    };
  }

  function placeTextEdit() {
    if (!textEdit) { return; }
    var r = app.locate(textEdit.id, false);
    if (!r) { endTextEdit(false); return; }
    var e = r.el;
    var k = app.scale();
    var ta = textEdit.el;
    var raw = ta.value;
    // The size that "shrink" gives the text as it is drawn (the placeholders resolved) stays while the raw text is edited; the height comes from the raw text.
    var resolved = window.DtEngine.resolveText(raw, app.doc.fields, app.values || {}, app.doc.locale, 'empty');
    var shown = window.DtEngine.layoutText(textSpec(e, resolved, e.fit, e.fontSize));
    var layout = window.DtEngine.layoutText(textSpec(e, raw, 'none', shown.fontSizePt));
    var padTop = 0;
    if (e.h > 0 && e.valign === 'middle') { padTop = Math.max(0, (e.h - layout.height) / 2); }
    else if (e.h > 0 && e.valign === 'bottom') { padTop = Math.max(0, e.h - layout.height); }
    var height = Math.max(e.h, layout.height);
    // the box on the page: unrotated around the world centre of the element, turned by the rotation of the element and of its groups
    var centre = D.toWorld(r.chain, { x: e.x + e.w / 2, y: e.y + e.h / 2 });
    var rotation = (e.rotation || 0) + r.chain.reduce(function (sum, g) { return sum + (g.rotation || 0); }, 0);
    var set = function (p, v) { ta.style.setProperty(p, v); };
    set('left', D.round((centre.x - e.w / 2) * k, 2) + 'px');
    set('top', D.round((centre.y - e.h / 2) * k, 2) + 'px');
    set('width', D.round(e.w * k, 2) + 'px');
    set('height', D.round(height * k, 2) + 'px');
    set('padding-top', D.round(padTop * k, 2) + 'px');
    set('transform', rotation ? 'rotate(' + D.round(rotation, 3) + 'deg)' : 'none');
    set('transform-origin', '50% ' + D.round((e.h > 0 ? e.h : layout.height) / height * 50, 2) + '%');
    set('font-family', cssFont(e.fontFamily));
    set('font-size', D.round(layout.fontSize * k, 3) + 'px');
    set('font-weight', String(e.fontWeight));
    set('font-style', e.italic ? 'italic' : 'normal');
    set('line-height', String(e.lineHeight));
    set('letter-spacing', e.letterSpacing ? e.letterSpacing + 'em' : 'normal');
    set('text-align', e.align);
    set('text-transform', e.uppercase ? 'uppercase' : 'none');
    set('text-decoration', (e.underline ? 'underline ' : '') + (e.strike ? 'line-through' : '') || 'none');
    set('color', e.color);
    set('caret-color', e.color);
    set('white-space', e.wrap ? 'pre-wrap' : 'pre');
  }

  /** The height the text of an element needs with some properties overridden (for a change of the font, size, spacing ... that must keep the text inside its box). */
  function neededTextHeight(e, overrides) {
    var t = Object.assign({}, e, overrides || {});
    var resolved = window.DtEngine.resolveText(t.text, app.doc.fields, app.values || app.computeValues(), app.doc.locale, 'empty');
    return D.round(window.DtEngine.layoutText(textSpec(t, resolved, 'none', t.fontSize)).height, 2);
  }

  /** Adds `h` to a patch of a text element when the new style needs a taller box (a box never shrinks by itself). */
  function textPatch(e, patch) {
    if (e.type !== 'text' || e.fit === 'shrink' || e.curve || patch.fit === 'shrink') { return patch; }
    var h = neededTextHeight(e, patch);
    if (h > e.h + 0.01) { patch.h = h; }
    return patch;
  }

  /** A text box grows to the height its text needs (never shrinks: a box the person made taller stays). */
  function growTextBox(id, quiet) {
    var r = app.locate(id, false);
    if (!r || r.el.type !== 'text' || !app.editable()) { return; }
    var e = r.el;
    if (e.fit === 'shrink' || e.curve) { return; }
    var resolved = window.DtEngine.resolveText(e.text, app.doc.fields, app.values || app.computeValues(), app.doc.locale, 'empty');
    var layout = window.DtEngine.layoutText(textSpec(e, resolved, 'none', e.fontSize));
    if (layout.height > e.h + 0.01) {
      var h = D.round(layout.height, 2);
      if (quiet) { app.tx().apply(function () { r.el.h = h; }, { render: 'now', reason: 'props' }); }
      else { app.setProps([id], { h: h }, { merge: false }); }
    }
  }

  function startTextEdit(id, options) {
    var r = app.locate(id, false);
    if (!r || r.el.type !== 'text' || r.el.locked || !app.editable()) { return; }
    var e = r.el;
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
      var mod = ev.ctrlKey || ev.metaKey;
      if (ev.key === 'Escape') { ev.stopPropagation(); ev.preventDefault(); endTextEdit(true); viewport.focus({ preventScroll: true }); return; }
      if (ev.key === 'Enter' && mod) { ev.stopPropagation(); ev.preventDefault(); endTextEdit(true); viewport.focus({ preventScroll: true }); return; }
      // bold / italic / underline of the whole text box while typing, like everywhere
      if (mod && !ev.shiftKey && !ev.altKey && /^[biu]$/i.test(ev.key)) {
        ev.preventDefault();
        ev.stopPropagation();
        app.emit('format', ev.key.toLowerCase());
        return;
      }
      if (mod && !ev.shiftKey && !ev.altKey && /^s$/i.test(ev.key)) { return; }   // Ctrl+S saves at once (the document handler)
      ev.stopPropagation();
    });
    ta.addEventListener('blur', function (ev) {
      var next = ev.relatedTarget;
      if (next && next.closest && next.closest('[data-keep-edit]')) { return; }
      setTimeout(function () { if (textEdit && textEdit.el === ta && document.activeElement !== ta) { endTextEdit(true); } }, 0);
    });
    textEdit.insert = function (token) {
      var start = ta.selectionStart === null ? ta.value.length : ta.selectionStart;
      var end = ta.selectionEnd === null ? start : ta.selectionEnd;
      ta.setRangeText(token, start, end, 'end');
      ta.focus({ preventScroll: true });
      placeTextEdit();
    };
    textEdit.commit = function () { endTextEdit(true); };
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
    if (commit && value !== edit.original && app.has(edit.id)) {
      app.setProps([edit.id], { text: value.slice(0, 5000) }, { merge: false });
      growTextBox(edit.id, false);
    }
    drawOverlay();
    app.emit('editing', false);
  }

  // ================================================================================================ images on the canvas

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
  function addAssetImage(asset, at, extra) {
    return ratioOfAsset(asset).then(function (ratio) {
      var doc = app.doc;
      var maxW = doc.width * 0.4;
      var maxH = doc.height * 0.4;
      var w = Math.min(maxW, maxH * ratio);
      var h = w / ratio;
      var cx = at ? at.x : doc.width / 2;
      var cy = at ? at.y : doc.height / 2;
      return app.addElement('image', Object.assign({ source: { asset: asset.key }, x: cx - w / 2, y: cy - h / 2, w: w, h: h, name: '' }, extra || {}));
    });
  }

  /** The slot of an image strip under a point of the page (equal slices of the strip). */
  function slotAt(strip, p, chain) {
    var n = Math.max(1, strip.items.length);
    var local = D.toLocal(strip, D.toFrame(chain || [], p));
    return D.clamp(Math.floor((local.x + strip.w / 2) / (strip.w / n)), 0, n - 1);
  }

  /** What is under a client point for a drop: an image/frame, a strip slot, or nothing (the page). */
  function dropTarget(clientX, clientY) {
    var p = toDoc(clientX, clientY);
    var h = hitDeep(p, {});
    if (h && h.node.type === 'image') { return { kind: 'image', node: h.node, point: p }; }
    if (h && h.node.type === 'imageStrip') { return { kind: 'slot', node: h.node, slot: slotAt(h.node, p, h.chain), point: p }; }
    var inside = p.x >= 0 && p.y >= 0 && p.x <= app.doc.width && p.y <= app.doc.height;
    return { kind: 'page', point: p, inside: inside };
  }

  /** Dropped (or clicked) asset: an image, frame or strip slot under the point gets the source, else a new image is added there. */
  function dropAsset(asset, clientX, clientY) {
    if (!app.editable()) { return Promise.resolve(null); }
    var t = dropTarget(clientX, clientY);
    if (t.kind === 'image') { app.setSource(t.node.id, { asset: asset.key }); app.select([t.node.id]); return Promise.resolve(t.node.id); }
    if (t.kind === 'slot') { app.setSource(t.node.id, { asset: asset.key }, t.slot); app.select([t.node.id]); return Promise.resolve(t.node.id); }
    return addAssetImage(asset, t.inside ? t.point : null);
  }

  // ================================================================================================ init

  function init(theApp, refs) {
    app = theApp;
    viewport = refs.viewport;
    stage = refs.stage;
    sheet = refs.sheet;
    page = refs.page;
    overlay = refs.overlay;

    viewport.addEventListener('pointerdown', onDown);
    viewport.addEventListener('pointermove', onMove);
    viewport.addEventListener('pointerup', onUp);
    viewport.addEventListener('pointercancel', onCancel);
    viewport.addEventListener('wheel', onWheel, { passive: false });
    // the middle button pans: no autoscroll circle of the browser
    viewport.addEventListener('mousedown', function (ev) { if (ev.button === 1) { ev.preventDefault(); } });
    viewport.addEventListener('auxclick', function (ev) { if (ev.button === 1) { ev.preventDefault(); } });
    viewport.addEventListener('dblclick', onDblClick);
    viewport.addEventListener('pointerleave', function (ev) { if (ev.pointerType === 'mouse' && hover && !gesture) { hover = null; drawOverlay(); } });
    viewport.addEventListener('contextmenu', onContextMenu);

    app.on('doc', function (ev) {
      applySize();
      // a new page size or unit (resize, undo) refits the page as long as the zoom is on "Einpassen"
      var sig = app.doc.unit + app.doc.width + 'x' + app.doc.height;
      if (sig !== pageSignature) { pageSignature = sig; if (app.fitMode && ev.reason !== 'load') { fit(); } }
      if (ev.render === 'now') { render(); }
      else if (ev.render === 'soon') { renderSoon(); }
      else { drawOverlay(); }
      if (ev.structure || ev.render === 'now') { drawOverlay(); }
      placeTextEdit();
    });
    app.on('selection', function () { hover = null; drawOverlay(); });
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
        if (app.fitMode) { setZoom(fitZoom(), null, true); } else { drawOverlay(); }
      }).observe(viewport);
    }
    document.addEventListener('visibilitychange', function () { if (!document.hidden && app.doc) { drawOverlay(); } });
  }

  /** Brings a node into view (layers panel click, warnings). */
  function reveal(id) {
    var r = app.locate(id, false);
    if (!r) { return; }
    var vr = viewport.getBoundingClientRect();
    var b = D.boxOfPoints(D.worldCorners(r.el, r.chain));
    var k = app.scale();
    var s = sheetRect();
    var left = s.left + b.x * k;
    var top = s.top + b.y * k;
    if (left < vr.left || left + b.w * k > vr.right) { viewport.scrollLeft += left + b.w * k / 2 - (vr.left + vr.width / 2); }
    if (top < vr.top || top + b.h * k > vr.bottom) { viewport.scrollTop += top + b.h * k / 2 - (vr.top + vr.height / 2); }
  }

  /** The client rectangle of a node (the toolbar and the popovers anchor to it). */
  function clientRectOf(id) {
    var r = app.locate(id, false);
    if (!r) { return null; }
    var b = D.boxOfPoints(D.worldCorners(r.el, r.chain));
    var s = sheetRect();
    var k = app.scale();
    return { left: s.left + b.x * k, top: s.top + b.y * k, width: b.w * k, height: b.h * k, right: s.left + (b.x + b.w) * k, bottom: s.top + (b.y + b.h) * k };
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
    growTextBox: growTextBox,
    textPatch: textPatch,
    neededTextHeight: neededTextHeight,
    isEditing: function () { return !!textEdit; },
    /** Resolves when no drawing is running or waiting (the browser checks wait for it). */
    whenIdle: function () { return renderPromise.then(function () { return renderBusy || renderQueued ? D.canvas.whenIdle() : undefined; }); },
    dropAsset: dropAsset,
    dropTarget: dropTarget,
    addAssetImage: addAssetImage,
    toDoc: toDoc,
    toClient: toClient,
    hitTest: hitTest,
    hitDeep: hitDeep,
    reveal: reveal,
    clientRectOf: clientRectOf,
    setSpace: function (down) { spaceDown = down; viewport.classList.toggle('is-space', down); },
    cancelGesture: function () { if (gesture) { var g = gesture; gesture = null; if (g.tx && g.tx.started()) { render(); } marquee = null; guides = []; badge = null; drawOverlay(); } },
    hasGesture: function () { return !!gesture; },
    /** A mode that owns the pointer (crop mode): m = { onDown(ev), hideOverlay } or null. While it is set the canvas draws no selection and starts no gesture. */
    setModal: function (m) { modal = m || null; if (modal) { hover = null; } drawOverlay(); },
    /** Opens the context menu event for a point (the keyboard: Shift+F10 / the menu key). */
    contextMenuAt: function (x, y) { openContextMenuAt(x, y, false); },
    pageElement: function () { return page; },
    /** The <g> the engine drew for a node, or null. */
    nodeElement: function (id) { return gMap.get(id) || null; },
  };
})();
