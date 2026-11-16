/* MatCan editor, part 11: the bottom bar. The page strip (thumbnails drawn by the engine, click to switch, drag to reorder, add, duplicate, delete, context menu) and the zoom
   controls (slider, percent with presets, Einpassen, snapping). Thumbnails are redrawn only for the pages whose content changed, 0.5 s after the last change. */
(function () {
  'use strict';

  var D = window.DtDesigner;
  var app;
  var strip;
  var thumbs = new Map();      // page id -> { button, signature, token }
  var drag = null;
  var redrawSoon;
  var zoomRefs = {};

  // ================================================================================================ page strip

  function pageSignature(p) { return JSON.stringify(p) + '|' + app.doc.width + 'x' + app.doc.height + app.doc.unit + '|' + app.assets.length; }

  function paintThumb(entry, index) {
    var p = app.doc.pages[index];
    var sig = pageSignature(p);
    if (entry.signature === sig) { return; }
    entry.signature = sig;
    var token = ++entry.token;
    window.DtEngine.render(app.doc, window.DtEngine.sampleValues(app.doc), { page: index, assetUrl: app.assetUrl, fonts: app.fonts, icon: D.icons.body, mode: 'output', idPrefix: 'th' + p.id }).then(function (svg) {
      if (entry.token !== token) { return; }
      svg.removeAttribute('width');
      svg.removeAttribute('height');
      svg.setAttribute('aria-hidden', 'true');
      var holder = D.$('.dt-thumb__page', entry.button);
      holder.replaceChildren(svg);
    }, function () { /* the thumbnail stays as it was */ });
  }

  function build() {
    if (!app.doc) { return; }
    var pages = app.doc.pages;
    var editable = app.editable();
    var ids = new Set(pages.map(function (p) { return p.id; }));
    thumbs.forEach(function (entry, id) { if (!ids.has(id)) { entry.item.remove(); thumbs.delete(id); } });
    var ratio = app.doc.width / app.doc.height;
    strip.style.setProperty('--dt-thumb-ar', String(D.round(ratio, 4)));
    pages.forEach(function (p, i) {
      var entry = thumbs.get(p.id);
      if (!entry) {
        var button = D.el('button', { type: 'button', class: 'dt-thumb', role: 'tab', 'data-page-id': p.id });
        button.appendChild(D.el('span', { class: 'dt-thumb__page' }));
        var label = D.el('span', { class: 'dt-thumb__label' });
        var more = D.el('button', { type: 'button', class: 'dt-thumb__more', title: 'Seite: mehr', 'aria-label': 'Seite: mehr' }, D.icon('ellipsis'));
        var item = D.el('div', { class: 'dt-thumbitem' }, [button, D.el('div', { class: 'dt-thumb__row' }, [label, more])]);
        entry = { id: p.id, button: button, item: item, more: more, label: label, signature: '', token: 0 };
        thumbs.set(p.id, entry);
        wireThumb(entry);
      }
      if (strip.children[i] !== entry.item) { strip.insertBefore(entry.item, strip.children[i] || D.$('.dt-addpage', strip)); }
      entry.index = i;
      var current = i === app.pageIndex;
      entry.button.setAttribute('aria-selected', String(current));
      entry.button.tabIndex = current ? 0 : -1;
      entry.button.title = 'Seite ' + (i + 1) + (p.name ? ': ' + p.name : '');
      entry.button.setAttribute('aria-label', 'Seite ' + (i + 1) + (p.name ? ': ' + p.name : ''));
      entry.item.classList.toggle('is-current', current);
      entry.label.textContent = p.name ? (i + 1) + ' · ' + p.name : String(i + 1);
      entry.more.hidden = !editable && false;
      paintThumb(entry, i);
    });
    var add = D.$('.dt-addpage', strip);
    add.disabled = !editable || pages.length >= D.MAX_PAGES;
    add.hidden = !editable;
    var count = D.$('#dt-pagecount');
    if (count) { count.textContent = (app.pageIndex + 1) + ' / ' + pages.length; }
  }

  function wireThumb(entry) {
    var b = entry.button;
    b.addEventListener('click', function () { if (!entry.dragged) { app.setPage(entry.index); } entry.dragged = false; });
    b.addEventListener('contextmenu', function (ev) {
      ev.preventDefault();
      D.menu.open(D.pageThumbItems(entry.index), { x: ev.clientX, y: ev.clientY });
    });
    entry.more.addEventListener('click', function () { D.menu.open(D.pageThumbItems(entry.index), { anchor: entry.more }); });
    b.addEventListener('keydown', function (ev) {
      if (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') {
        ev.preventDefault();
        var to = entry.index + (ev.key === 'ArrowRight' ? 1 : -1);
        if (ev.altKey || ev.ctrlKey) { app.movePage(entry.index, to); } else { app.setPage(to); }
        var again = thumbs.get(app.page().id);
        if (again) { again.button.focus(); }
      } else if (ev.key === 'ContextMenu' || (ev.key === 'F10' && ev.shiftKey)) {
        ev.preventDefault();
        D.menu.open(D.pageThumbItems(entry.index), { anchor: entry.more, focusFirst: true });
      }
    });
    // drag to reorder
    b.addEventListener('pointerdown', function (ev) {
      if (ev.button !== 0 || !app.editable() || app.doc.pages.length < 2) { return; }
      var startX = ev.clientX;
      var startY = ev.clientY;
      var state = { started: false };
      var marker = D.el('div', { class: 'dt-thumb-marker', 'aria-hidden': 'true' });
      try { b.setPointerCapture(ev.pointerId); } catch (e) { /* ignore */ }
      var slotAt = function (x) {
        var items = Array.from(strip.querySelectorAll('.dt-thumbitem'));
        var slot = items.length;
        for (var i = 0; i < items.length; i++) { var r = items[i].getBoundingClientRect(); if (x < r.left + r.width / 2) { slot = i; break; } }
        return slot;
      };
      var move = function (e) {
        if (!state.started && Math.hypot(e.clientX - startX, e.clientY - startY) < (e.pointerType === 'touch' ? 12 : 6)) { return; }
        if (!state.started && e.pointerType === 'touch' && Math.abs(e.clientY - startY) > Math.abs(e.clientX - startX)) { return; }
        state.started = true;
        entry.item.classList.add('is-dragging');
        var slot = slotAt(e.clientX);
        state.slot = slot;
        var items = Array.from(strip.querySelectorAll('.dt-thumbitem'));
        if (marker.parentNode) { marker.parentNode.removeChild(marker); }
        strip.insertBefore(marker, items[slot] || D.$('.dt-addpage', strip));
        e.preventDefault();
      };
      var end = function (e, cancelled) {
        b.removeEventListener('pointermove', move);
        b.removeEventListener('pointerup', up);
        b.removeEventListener('pointercancel', cancel);
        entry.item.classList.remove('is-dragging');
        if (marker.parentNode) { marker.parentNode.removeChild(marker); }
        if (!state.started) { return; }
        entry.dragged = true;
        setTimeout(function () { entry.dragged = false; }, 50);
        if (cancelled) { return; }
        var slot = state.slot;
        var from = entry.index;
        var to = slot > from ? slot - 1 : slot;
        if (to !== from) { app.movePage(from, to); }
      };
      var up = function (e) { end(e, false); };
      var cancel = function (e) { end(e, true); };
      b.addEventListener('pointermove', move);
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', cancel);
    });
  }

  // ================================================================================================ zoom controls

  function updateZoom() {
    var percent = Math.round(app.zoom * 100);
    zoomRefs.percent.textContent = percent + ' %';
    zoomRefs.range.value = String(D.clamp(percent, Number(zoomRefs.range.min), Number(zoomRefs.range.max)));
    zoomRefs.range.setAttribute('aria-valuetext', percent + ' Prozent');
  }

  function initZoom(root) {
    zoomRefs = { range: D.$('#dt-zoom', root), percent: D.$('#dt-zoom-percent', root), fit: D.$('#dt-zoom-fit', root), snap: D.$('#dt-snap', root), out: D.$('#dt-zoom-out', root), inn: D.$('#dt-zoom-in', root) };
    zoomRefs.range.addEventListener('input', function () { D.canvas.setZoom(Number(zoomRefs.range.value) / 100, false); });
    zoomRefs.out.addEventListener('click', function () { D.canvas.stepZoom(-1); });
    zoomRefs.inn.addEventListener('click', function () { D.canvas.stepZoom(1); });
    zoomRefs.fit.addEventListener('click', function () { D.canvas.fit(); });
    zoomRefs.percent.addEventListener('click', function () {
      var presets = [25, 50, 75, 100, 150, 200, 400];
      var items = presets.map(function (p) { return { label: p + ' %', checked: Math.round(app.zoom * 100) === p && !app.fitMode, run: function () { D.canvas.setZoom(p / 100, false); } }; });
      items.unshift({ label: 'Einpassen', icon: 'scan', shortcut: D.modKey + '+0', checked: app.fitMode, run: function () { D.canvas.fit(); } });
      D.menu.open(items, { anchor: zoomRefs.percent });
    });
    zoomRefs.snap.addEventListener('click', function () {
      app.snapping = !app.snapping;
      zoomRefs.snap.setAttribute('aria-pressed', String(app.snapping));
    });
    app.on('zoom', updateZoom);
    updateZoom();
  }

  function init(theApp, refs) {
    app = theApp;
    strip = refs.strip;
    var add = D.el('button', { type: 'button', class: 'dt-addpage', title: 'Seite hinzufügen', 'aria-label': 'Seite hinzufügen' }, [D.icon('plus')]);
    add.addEventListener('click', function () { app.addPage(app.doc.pages.length - 1); });
    strip.appendChild(add);
    initZoom(refs.zoom);
    redrawSoon = D.debounce(function () { if (app.doc) { build(); } }, 450);
    app.on('pages', build);
    app.on('page', build);
    app.on('readonly', build);
    app.on('assets', function () { redrawSoon(); });
    app.on('fonts', function () { thumbs.forEach(function (e) { e.signature = ''; }); redrawSoon(); });
    app.on('doc', function (ev) {
      if (ev.reason === 'load' || ev.reason === 'history' || ev.reason === 'template') { build(); return; }
      redrawSoon();
    });
    if (app.doc) { build(); }
    // the strip folds away to give the page more room
    var toggle = refs.toggle;
    if (toggle) {
      var folded = false;
      try { folded = localStorage.getItem('dt-pages-folded') === '1'; } catch (e) { /* ignore */ }
      var apply = function () {
        refs.root.classList.toggle('is-pages-folded', folded);
        toggle.setAttribute('aria-expanded', String(!folded));
        toggle.title = folded ? 'Seitenleiste zeigen' : 'Seitenleiste ausblenden';
      };
      apply();
      toggle.addEventListener('click', function () { folded = !folded; try { localStorage.setItem('dt-pages-folded', folded ? '1' : '0'); } catch (e) { /* ignore */ } apply(); });
    }
  }

  D.pages = {
    init: init,
    rebuild: build,
    renameDialog: function (index) {
      var p = app.doc.pages[index];
      return window.MatUi.prompt('Name der Seite', { title: 'Seite umbenennen', value: p.name || '', ok: 'Umbenennen' }).then(function (name) {
        if (name === null || name === undefined) { return; }
        app.renamePage(index, name.trim());
      });
    },
  };
})();
