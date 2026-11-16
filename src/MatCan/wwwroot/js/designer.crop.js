/* MatCan editor, part 6c: crop mode (Zuschneiden). D.crop.start(id) opens it for an image of the library (double click on an image, the toolbar, the context menu). The whole picture is
   shown dimmed with the visible window bright; drag the picture inside the window, drag the handles of the window to show more or less of it, the slider in the toolbar zooms.
   Enter or "Fertig" (and a click beside the picture) apply, Escape or "Abbrechen" throw the changes away. Nothing is written to the document before that, and then in ONE undo step:
   the box of the element becomes the window and `crop { x, y, w, h }` (fractions 0..1 of the natural picture) the visible part.
   Geometry (all in the content frame of the element: origin = top left of its box, no rotation, no flip; the layer is drawn with the transforms of the element and of its groups):
     I = the whole natural picture, W = the window. Start: the crop region is placed into the box with `fit` exactly like the engine does, W = box intersected with that region.
   API: D.crop = { start(id), active(), finish(apply), state() }; the toolbar is replaced while the mode is on (D.toolbar.setOverride). */
(function () {
  'use strict';

  var D = window.DtDesigner;
  var app;
  var session = null;
  var HANDLES = { nw: [0, 0], n: [0.5, 0], ne: [1, 0], e: [1, 0.5], se: [1, 1], s: [0.5, 1], sw: [0, 1], w: [0, 0.5] };
  var CURSORS = { nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize' };
  var MAX_ZOOM = 6;

  function natural(e) {
    var a = app.assetByKey(e.source.asset);
    if (a && a.width > 0 && a.height > 0) { return Promise.resolve({ w: a.width, h: a.height }); }
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () { resolve({ w: img.naturalWidth || 100, h: img.naturalHeight || 100 }); };
      img.onerror = function () { resolve(null); };
      img.src = app.assetUrl(e.source.asset) || '';
    });
  }

  /** The picture rectangle I and the window W as the engine shows the element now. */
  function initial(e, nat) {
    var c = e.crop || { x: 0, y: 0, w: 1, h: 1 };
    var rw = c.w * nat.w;
    var rh = c.h * nat.h;
    var sx;
    var sy;
    if (e.fit === 'fill') { sx = e.w / rw; sy = e.h / rh; }
    else { var s = e.fit === 'cover' ? Math.max(e.w / rw, e.h / rh) : Math.min(e.w / rw, e.h / rh); sx = s; sy = s; }
    var RW = rw * sx;
    var RH = rh * sy;
    var rx0 = (e.w - RW) / 2;
    var ry0 = (e.h - RH) / 2;
    var I = { x: rx0 - c.x * nat.w * sx, y: ry0 - c.y * nat.h * sy, w: nat.w * sx, h: nat.h * sy };
    var wx = Math.max(0, rx0);
    var wy = Math.max(0, ry0);
    var W = { x: wx, y: wy, w: Math.min(e.w, rx0 + RW) - wx, h: Math.min(e.h, ry0 + RH) - wy };
    return { I: I, W: W };
  }

  /** The smallest width of I that still covers W (the aspect of I stays). */
  function minWidth(I, W) { return Math.max(W.w, W.h * I.w / I.h); }

  function clampImage(s) {
    var I = s.I;
    var W = s.W;
    var min = minWidth(I, W);
    if (I.w < min) { var f = min / I.w; var cx = W.x + W.w / 2; var cy = W.y + W.h / 2; I.x = cx - (cx - I.x) * f; I.y = cy - (cy - I.y) * f; I.w *= f; I.h *= f; }
    if (I.w > min * MAX_ZOOM) { var g = min * MAX_ZOOM / I.w; var cx2 = W.x + W.w / 2; var cy2 = W.y + W.h / 2; I.x = cx2 - (cx2 - I.x) * g; I.y = cy2 - (cy2 - I.y) * g; I.w *= g; I.h *= g; }
    I.x = Math.min(W.x, Math.max(W.x + W.w - I.w, I.x));
    I.y = Math.min(W.y, Math.max(W.y + W.h - I.h, I.y));
  }

  function zoomPercent(s) { return Math.round(s.I.w / minWidth(s.I, s.W) * 100); }

  // ================================================================================================ the layer

  function chainTransform(chain, e) {
    var parts = ['scale(' + D.round(app.scale(), 5) + ')'];
    chain.forEach(function (g) { var t = D.svgTransform(g); if (t) { parts.push(t); } });
    var own = D.svgTransform(e);
    if (own) { parts.push(own); }
    return parts.join(' ');
  }

  /** A client point in the content frame of the element (box coordinates, flip undone). */
  function toContent(ev, e, chain) {
    var p = D.canvas.toDoc(ev.clientX, ev.clientY);
    var local = D.toLocal(e, D.toFrame(chain, p));
    return { x: (e.flipX ? -local.x : local.x) + e.w / 2, y: (e.flipY ? -local.y : local.y) + e.h / 2 };
  }

  function attrs(node, o) { Object.keys(o).forEach(function (k) { node.setAttribute(k, String(o[k])); }); }

  /** The layer is built once per zoom level; a drag only moves the numbers (the picture is not loaded again). */
  function build(s, e, chain, k) {
    var px = function (n) { return D.round(n / k, 4); };
    D.empty(s.layer);
    var ups = [];
    var root = D.svg('g', { class: 'dt-crop__root' });
    var box = D.svg('g', { class: 'dt-crop__box' });
    root.appendChild(box);
    s.layer.appendChild(root);
    var place = function (tag, cls, fixed, fn) {
      var node = D.svg(tag, Object.assign({ class: cls }, fixed || {}));
      box.appendChild(node);
      if (fn) { ups.push(function () { attrs(node, fn()); }); }
      return node;
    };
    var r4 = function (n) { return D.round(n, 4); };
    var clipId = 'dt-crop-clip-' + s.n;
    var clipRect = D.svg('rect');
    box.appendChild(D.svg('defs', null, D.svg('clipPath', { id: clipId }, clipRect)));
    ups.push(function () { attrs(clipRect, { x: r4(s.W.x), y: r4(s.W.y), width: r4(s.W.w), height: r4(s.W.h) }); });
    var iBox = function () { return { x: r4(s.I.x), y: r4(s.I.y), width: r4(s.I.w), height: r4(s.I.h) }; };
    place('image', 'dt-crop__dim', { href: s.url, preserveAspectRatio: 'none' }, iBox);
    place('rect', 'dt-crop__scrim', null, iBox);
    place('image', 'dt-crop__bright', { href: s.url, preserveAspectRatio: 'none', 'clip-path': 'url(#' + clipId + ')' }, iBox);
    place('rect', 'dt-crop__imageedge', { 'stroke-width': px(1), 'stroke-dasharray': px(4) + ' ' + px(4) }, iBox);
    [1 / 3, 2 / 3].forEach(function (f) {
      place('line', 'dt-crop__third', { 'stroke-width': px(1) }, function () { return { x1: r4(s.W.x + s.W.w * f), y1: r4(s.W.y), x2: r4(s.W.x + s.W.w * f), y2: r4(s.W.y + s.W.h) }; });
      place('line', 'dt-crop__third', { 'stroke-width': px(1) }, function () { return { x1: r4(s.W.x), y1: r4(s.W.y + s.W.h * f), x2: r4(s.W.x + s.W.w), y2: r4(s.W.y + s.W.h * f) }; });
    });
    place('rect', 'dt-crop__window', { 'stroke-width': px(2) }, function () { return { x: r4(s.W.x), y: r4(s.W.y), width: r4(s.W.w), height: r4(s.W.h) }; });
    var coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    var vis = coarse ? 14 : 10;
    var hit = coarse ? 44 : 22;
    Object.keys(HANDLES).forEach(function (name) {
      var edge = name.length === 1;
      var vw = edge ? (name === 'n' || name === 's' ? vis * 2 : vis * 0.7) : vis;
      var vh = edge ? (name === 'e' || name === 'w' ? vis * 2 : vis * 0.7) : vis;
      var g = D.svg('g', { 'data-crop-handle': name });
      var hitRect = D.svg('rect', { class: 'dt-crop__hit', width: px(hit), height: px(hit) });
      var visRect = D.svg('rect', { class: 'dt-crop__handle', width: px(vw), height: px(vh), rx: px(2), 'stroke-width': px(1) });
      g.appendChild(hitRect);
      g.appendChild(visRect);
      g.style.setProperty('cursor', CURSORS[name]);
      box.appendChild(g);
      ups.push(function () {
        var hx = s.W.x + s.W.w * HANDLES[name][0];
        var hy = s.W.y + s.W.h * HANDLES[name][1];
        attrs(hitRect, { x: r4(hx - px(hit) / 2), y: r4(hy - px(hit) / 2) });
        attrs(visRect, { x: r4(hx - px(vw) / 2), y: r4(hy - px(vh) / 2) });
      });
    });
    s.dom = { k: k, root: root, box: box, ups: ups };
  }

  function draw() {
    var s = session;
    var e = app.element(s.id);
    var r = app.locate(s.id, false);
    if (!e || !r) { return; }
    var k = app.scale();
    if (!s.dom || s.dom.k !== k) { build(s, e, r.chain, k); }
    s.dom.root.setAttribute('transform', chainTransform(r.chain, e));
    s.dom.box.setAttribute('transform', 'translate(' + D.round(e.x, 4) + ' ' + D.round(e.y, 4) + ')');
    s.dom.ups.forEach(function (fn) { fn(); });
    s.layer.setAttribute('data-zoom', String(zoomPercent(s)));
    if (s.onChange) { s.onChange(); }
  }

  // ================================================================================================ gestures

  function onLayerDown(ev) {
    var s = session;
    if (!s || ev.button > 0) { return; }
    ev.preventDefault();
    ev.stopPropagation();
    var e = app.element(s.id);
    var r = app.locate(s.id, false);
    if (!e || !r) { return; }
    var handleEl = ev.target.closest ? ev.target.closest('[data-crop-handle]') : null;
    var start = toContent(ev, e, r.chain);
    var from = { I: D.clone(s.I), W: D.clone(s.W) };
    var mode = null;
    if (handleEl) { mode = handleEl.getAttribute('data-crop-handle'); }
    else if (start.x >= s.I.x && start.x <= s.I.x + s.I.w && start.y >= s.I.y && start.y <= s.I.y + s.I.h) { mode = 'move'; }
    if (!mode) { finish(true); return; }
    try { s.layer.setPointerCapture(ev.pointerId); } catch (err) { /* gone */ }
    s.layer.classList.add('is-dragging');
    var minSize = 14 / app.scale();
    var move = function (m) {
      var p = toContent(m, e, r.chain);
      var dx = p.x - start.x;
      var dy = p.y - start.y;
      if (mode === 'move') {
        s.I.x = from.I.x + dx;
        s.I.y = from.I.y + dy;
        clampImage(s);
      } else {
        var W0 = from.W;
        var x1 = W0.x;
        var y1 = W0.y;
        var x2 = W0.x + W0.w;
        var y2 = W0.y + W0.h;
        if (mode.indexOf('w') >= 0) { x1 = Math.min(x2 - minSize, Math.max(s.I.x, W0.x + dx)); }
        if (mode.indexOf('e') >= 0) { x2 = Math.max(x1 + minSize, Math.min(s.I.x + s.I.w, x2 + dx)); }
        if (mode.indexOf('n') >= 0) { y1 = Math.min(y2 - minSize, Math.max(s.I.y, W0.y + dy)); }
        if (mode.indexOf('s') >= 0) { y2 = Math.max(y1 + minSize, Math.min(s.I.y + s.I.h, y2 + dy)); }
        s.W = { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
      }
      draw();
    };
    var up = function () {
      s.layer.removeEventListener('pointermove', move);
      s.layer.removeEventListener('pointerup', up);
      s.layer.removeEventListener('pointercancel', up);
      s.layer.classList.remove('is-dragging');
    };
    s.layer.addEventListener('pointermove', move);
    s.layer.addEventListener('pointerup', up);
    s.layer.addEventListener('pointercancel', up);
  }

  function onKey(ev) {
    if (!session) { return; }
    var t = ev.target;
    if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); finish(false); return; }
    if (ev.key === 'Enter' && !(t && t.tagName === 'INPUT') && !(t && t.tagName === 'BUTTON')) { ev.preventDefault(); ev.stopPropagation(); finish(true); return; }
    if (/^Arrow/.test(ev.key) && !(t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) {
      ev.preventDefault();
      ev.stopPropagation();
      var step = (ev.shiftKey ? 10 : 1) / app.scale();
      session.I.x += ev.key === 'ArrowLeft' ? -step : (ev.key === 'ArrowRight' ? step : 0);
      session.I.y += ev.key === 'ArrowUp' ? -step : (ev.key === 'ArrowDown' ? step : 0);
      clampImage(session);
      draw();
    }
  }

  // ================================================================================================ toolbar while cropping

  function toolbar(c) {
    var s = session;
    var out = [];
    out.push(D.el('span', { class: 'dt-tb__title' }, [D.icon('crop'), D.el('span', { text: 'Zuschneiden' })]));
    out.push('sep');
    var slider = D.ui.slider({ min: 100, max: MAX_ZOOM * 100, step: 1, value: zoomPercent(s), suffix: '%', label: 'Bild vergrößern', onInput: function (v) { zoomTo(v / 100); } });
    var zoomBox = D.el('div', { class: 'dt-tb__zoom', role: 'group', 'aria-label': 'Bildausschnitt vergrößern' }, [D.icon('zoom-out'), slider.el, D.icon('zoom-in')]);
    s.onChange = function () { slider.set(zoomPercent(s)); };
    out.push(zoomBox);
    out.push('sep');
    out.push(c.button({ icon: 'rotate-ccw', text: 'Zurücksetzen', label: 'Zurücksetzen', title: 'Auf den Ausschnitt von vorher zurück', always: true, onClick: function () { s.I = D.clone(s.start.I); s.W = D.clone(s.start.W); draw(); } }));
    out.push(c.button({ text: 'Abbrechen', label: 'Abbrechen', title: 'Esc', always: true, cls: 'dt-tb--keeptext', onClick: function () { finish(false); } }));
    out.push(c.button({ text: 'Fertig', label: 'Fertig', title: 'Enter', always: true, cls: 'dt-tb--accent dt-tb--sticky', onClick: function () { finish(true); } }));
    return out;
  }

  function zoomTo(factor) {
    var s = session;
    if (!s) { return; }
    var min = minWidth(s.I, s.W);
    var f = (min * factor) / s.I.w;
    var cx = s.W.x + s.W.w / 2;
    var cy = s.W.y + s.W.h / 2;
    s.I.x = cx - (cx - s.I.x) * f;
    s.I.y = cy - (cy - s.I.y) * f;
    s.I.w *= f;
    s.I.h *= f;
    clampImage(s);
    draw();
  }

  // ================================================================================================ start and finish

  function start(id) {
    if (session) { return Promise.resolve(false); }
    var e = app.element(id);
    if (!app.editable() || !e || e.type !== 'image' || e.locked) { return Promise.resolve(false); }
    if (!e.source || !e.source.asset) {
      D.toast(e.source && e.source.field ? 'Ein Bild aus einem Feld lässt sich nicht zuschneiden: Jedes Bild der Datenliste ist anders groß.' : 'Wähle zuerst ein Bild für den Rahmen.', 'warning');
      return Promise.resolve(false);
    }
    if (app.editing && app.editing.commit) { app.editing.commit(); }
    return natural(e).then(function (nat) {
      if (!nat) { D.toast('Das Bild konnte nicht geladen werden.', 'danger'); return false; }
      var e2 = app.element(id);
      if (!e2 || session) { return false; }
      var geo = initial(e2, nat);
      var layer = D.svg('svg', { class: 'dt-cropui', 'aria-label': 'Zuschneiden', role: 'application' });
      document.getElementById('dt-sheet').appendChild(layer);
      session = { id: id, nat: nat, n: Date.now(), url: app.assetUrl(e2.source.asset) || '', layer: layer, I: geo.I, W: geo.W, start: { I: D.clone(geo.I), W: D.clone(geo.W) }, onChange: null };
      layer.addEventListener('pointerdown', onLayerDown);
      layer.addEventListener('contextmenu', function (ev) { ev.preventDefault(); });
      document.addEventListener('keydown', onKey, true);
      D.canvas.setModal({
        hideOverlay: true,
        onDown: function (ev) {
          if (ev.target.closest && (ev.target.closest('.dt-cropui') || ev.target.closest('.dt-canvas-tools, .dt-warnbar'))) { return; }
          finish(true);
        },
      });
      hideNode();
      D.toolbar.setOverride(toolbar);
      document.documentElement.classList.add('is-cropping');
      app.emit('crop', true);
      draw();
      layer.setAttribute('tabindex', '-1');
      layer.focus({ preventScroll: true });
      return true;
    });
  }

  function hideNode() {
    if (!session) { return; }
    var g = D.canvas.nodeElement(session.id);
    if (g) { g.setAttribute('display', 'none'); }
  }

  /** Writes the result (one undo step) when apply is true and something changed. */
  function finish(apply) {
    var s = session;
    if (!s) { return; }
    session = null;
    document.removeEventListener('keydown', onKey, true);
    if (s.layer.parentNode) { s.layer.parentNode.removeChild(s.layer); }
    D.canvas.setModal(null);
    document.documentElement.classList.remove('is-cropping');
    var e = app.element(s.id);
    var changed = JSON.stringify([s.I, s.W]) !== JSON.stringify([s.start.I, s.start.W]);
    if (apply && changed && e && app.editable()) {
      var W = s.W;
      var I = s.I;
      var sx0 = e.flipX ? e.w - W.x - W.w : W.x;
      var sy0 = e.flipY ? e.h - W.y - W.h : W.y;
      var v = D.rotateVec({ x: sx0 + W.w / 2 - e.w / 2, y: sy0 + W.h / 2 - e.h / 2 }, e.rotation || 0);
      var cx = e.x + e.w / 2 + v.x;
      var cy = e.y + e.h / 2 + v.y;
      var round5 = function (n) { return D.round(Math.min(1, Math.max(0, n)), 5); };
      var crop = { x: round5((W.x - I.x) / I.w), y: round5((W.y - I.y) / I.h), w: round5(W.w / I.w), h: round5(W.h / I.h) };
      crop.w = Math.min(crop.w, D.round(1 - crop.x, 5));
      crop.h = Math.min(crop.h, D.round(1 - crop.y, 5));
      app.edit(function () {
        var r = app.locate(s.id, false);
        if (!r) { return; }
        r.el.w = D.round(W.w, 4);
        r.el.h = D.round(W.h, 4);
        r.el.x = D.round(cx - W.w / 2, 4);
        r.el.y = D.round(cy - W.h / 2, 4);
        r.el.crop = crop;
      }, { reason: 'props' });
    }
    D.toolbar.setOverride(null);
    var g = D.canvas.nodeElement(s.id);
    if (g) { g.removeAttribute('display'); }
    D.canvas.render();
    app.emit('crop', false);
  }

  function init(theApp) {
    app = theApp;
    app.on('selection', function () { if (session && app.sel.indexOf(session.id) < 0) { finish(true); } });
    app.on('page', function () { if (session) { finish(true); } });
    app.on('readonly', function () { if (session) { finish(false); } });
    app.on('doc', function (ev) { if (session && ev && ev.reason === 'history') { finish(false); } });
    app.on('rendered', function () { hideNode(); });
    window.addEventListener('resize', function () { if (session) { draw(); } });
    app.on('zoom', function () { if (session) { draw(); } });
  }

  D.crop = {
    init: init,
    start: function (id) { return start(id); },
    active: function () { return !!session; },
    finish: finish,
    state: function () { return session ? { id: session.id, I: D.clone(session.I), W: D.clone(session.W), zoom: zoomPercent(session) } : null; },
    zoomTo: zoomTo,
  };
})();
