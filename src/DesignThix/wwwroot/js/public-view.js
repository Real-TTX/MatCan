/* DesignThix: the public viewer behind a public link, /s/{token} (docs/PLAN-PLATFORM.md section 1.8). Nobody has to sign in. The page (Pages/Share/View) is only a frame; this script loads
   GET /api/s/{token} (and /api/s/{token}/d/{id} for a design inside a shared folder) and draws with the render engine (DtEngine, the same code as the editor) from the document of the design with ITS OWN
   sample values: the server never sends rows of a data list. Everything is built with DOM APIs (no innerHTML); names only through textContent.
   - A design: the pages one below the other (drawn when they come near the window), page navigation (buttons, keys, "Seite 2 von 5"), zoom and fit (buttons, + - 0, Ctrl+wheel), a strip of thumbnails
     for several pages; with "Herunterladen erlauben" also PNG of a page, PNG of all pages (ZIP) and PDF (the print view of this page: every page in mm, @page through the CSSOM).
   - A folder: a gallery of its designs and subfolders; a design opens in the viewer, a breadcrumb inside the shared folder leads back (?f=<folder>, ?d=<design>; the browser's back button works).
   A dead link answers 404 and shows the friendly page of "Dieser Link ist nicht mehr gültig". */
(function () {
  'use strict';

  var root = document.getElementById('dt-pv');
  var engine = window.DtEngine;
  if (!root || !engine) { return; }

  var doc = document;
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var token = root.getAttribute('data-token');
  var apiBase = '/api/s/' + encodeURIComponent(token);
  var refs = {
    crumbs: doc.getElementById('dt-pv-crumbs'),
    tools: doc.getElementById('dt-pv-tools'),
    thumbs: doc.getElementById('dt-pv-thumbs'),
    stage: doc.getElementById('dt-pv-stage'),
    print: doc.getElementById('dt-pv-print'),
  };
  var MM_PER_PX = 25.4 / 96;
  var viewSeq = 0;
  var iconsPromise = null;
  var cleanup = [];       // what the current view has to take away again (observers, listeners)

  // ================================================================================================ helpers

  function el(tag, attrs, kids) {
    var node = doc.createElement(tag);
    Object.keys(attrs || {}).forEach(function (name) {
      var v = attrs[name];
      if (v === false || v === null || v === undefined) { return; }
      if (name === 'text') { node.textContent = v; } else if (name === 'class') { node.className = v; } else { node.setAttribute(name, v === true ? '' : String(v)); }
    });
    (kids || []).forEach(function (k) { if (k) { node.appendChild(typeof k === 'string' ? doc.createTextNode(k) : k); } });
    return node;
  }

  function icon(name, cls) {
    var svg = doc.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'mat-icon' + (cls ? ' ' + cls : ''));
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    var use = doc.createElementNS(SVG_NS, 'use');
    use.setAttribute('href', (doc.getElementById('dt-i-' + name) ? '#dt-i-' : '#mat-i-') + name);
    svg.appendChild(use);
    return svg;
  }

  function empty(node) { while (node.firstChild) { node.removeChild(node.firstChild); } }

  function toast(message, tone) {
    if (window.MatUi && window.MatUi.toast) { window.MatUi.toast(message, { tone: tone || undefined }); }
  }

  function getJson(url) {
    return fetch(url, { credentials: 'same-origin', headers: { Accept: 'application/json' } }).then(function (r) {
      return r.json().catch(function () { return null; }).then(function (data) { return { ok: r.ok, status: r.status, data: data }; });
    }, function () { return { ok: false, status: 0, data: null }; });
  }

  function loadIcons() {
    if (!iconsPromise) {
      iconsPromise = fetch('/lib/icons.json', { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : { icons: {} }; }).then(function (j) { return j.icons || {}; }).catch(function () { return {}; });
    }
    return iconsPromise;
  }

  function safeName(text) {
    var n = String(text || 'Design').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-').replace(/\s+/g, ' ').replace(/[ .]+$/g, '').trim();
    return n || 'Design';
  }

  function engineOptions(payload) {
    var assets = payload.assets || {};
    return {
      mode: 'output',
      assetUrl: function (key) { return assets[String(key).trim().toLowerCase()] || null; },
      fonts: (payload.fonts || []).map(function (f) { return { family: f.family, weight: f.weight, style: f.style, url: f.url }; }),
      icon: function (name) { return loadIcons().then(function (icons) { return icons[name] ? icons[name].b : null; }); },
    };
  }

  function runCleanup() {
    cleanup.splice(0).forEach(function (fn) { try { fn(); } catch (e) { /* ignore */ } });
  }

  function setState(value) { root.setAttribute('data-state', value); }

  /** One drawing at a time (fonts and images load in the engine; three pages at once only slow down the first one). */
  var queue = [];
  var running = false;
  function enqueue(job, first) {
    if (first) { queue.unshift(job); } else { queue.push(job); }
    pump();
  }
  function pump() {
    if (running || !queue.length) { return; }
    running = true;
    var job = queue.shift();
    Promise.resolve().then(job).catch(function () { /* the box keeps its placeholder */ }).then(function () { running = false; pump(); });
  }

  // ================================================================================================ a dead link, an error

  function showDead(message) {
    runCleanup();
    queue = [];
    setState('error');
    empty(refs.crumbs);
    empty(refs.tools);
    refs.thumbs.hidden = true;
    empty(refs.stage);
    refs.stage.appendChild(el('div', { class: 'dt-pv-dead__card dt-pv-dead__inline', role: 'alert' }, [
      icon('lock', 'dt-pv-dead__icon'),
      el('h2', { text: 'Dieser Link ist nicht mehr gültig' }),
      el('p', { class: 'mat-muted', text: message || 'Der Link wurde zurückgesetzt, ist abgelaufen oder wurde abgeschaltet, oder das Design gibt es nicht mehr. Frag die Person, die ihn dir geschickt hat, nach einem neuen Link.' }),
    ]));
  }

  function showFailure(res) {
    if (res.status === 404) { showDead(); return; }
    runCleanup();
    setState('error');
    empty(refs.stage);
    refs.stage.appendChild(el('div', { class: 'dt-pv-dead__card dt-pv-dead__inline', role: 'alert' }, [
      icon('alert', 'dt-pv-dead__icon'),
      el('h2', { text: res.status === 429 ? 'Zu viele Anfragen' : 'Das hat nicht geklappt' }),
      el('p', { class: 'mat-muted', text: res.status === 429 ? 'Bitte warte eine Minute und lade die Seite dann neu.' : 'Prüfe deine Verbindung und lade die Seite neu.' }),
    ]));
  }

  // ================================================================================================ routing (?f=<folder> ?d=<design>)

  function readRoute() {
    var q = new URLSearchParams(window.location.search);
    var d = Number(q.get('d'));
    var f = Number(q.get('f'));
    return { design: d > 0 ? d : null, folder: f > 0 ? f : null };
  }

  function addressOf(route) {
    var q = [];
    if (route.design) { q.push('d=' + route.design); } else if (route.folder) { q.push('f=' + route.folder); }
    return window.location.pathname + (q.length ? '?' + q.join('&') : '');
  }

  function go(route) {
    window.history.pushState({}, '', addressOf(route));
    render();
  }

  // ================================================================================================ the gallery of a folder

  function crumbBar(items, current) {
    empty(refs.crumbs);
    var list = el('ol', { class: 'dt-pv__crumblist' });
    items.forEach(function (c, i) {
      var last = i === items.length - 1 && !current;
      if (last) {
        list.appendChild(el('li', { 'aria-current': 'page' }, [el('h1', { class: 'dt-pv__title', text: c.name })]));
      } else {
        var a = el('a', { class: 'dt-pv__crumb', href: addressOf({ folder: i === 0 ? null : c.id }), text: c.name });
        a.addEventListener('click', function (ev) {
          if (ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.button) { return; }
          ev.preventDefault();
          go({ folder: i === 0 ? null : c.id });
        });
        list.appendChild(el('li', null, [a]));
      }
    });
    if (current) { list.appendChild(el('li', { 'aria-current': 'page' }, [el('h1', { class: 'dt-pv__title', text: current })])); }
    refs.crumbs.appendChild(list);
  }

  function lazyTile(box, id, seq) {
    var done = false;
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting || done) { return; }
        done = true;
        observer.disconnect();
        enqueue(function () {
          if (seq !== viewSeq) { return null; }
          return getJson(apiBase + '/d/' + id).then(function (res) {
            if (!res.ok || seq !== viewSeq) { return null; }
            var d = engine.normalize(res.data.document);
            box.style.setProperty('--dt-ar', d.width + ' / ' + d.height);
            var holder = el('div', { class: 'dt-pv-tile__draw' });
            box.appendChild(holder);
            return engine.renderInto(holder, d, null, Object.assign(engineOptions(res.data), { page: 0, idPrefix: 'g' + id + '-' })).then(function () { box.classList.add('is-drawn'); });
          });
        });
      });
    }, { root: refs.stage, rootMargin: '300px' });
    observer.observe(box);
    cleanup.push(function () { observer.disconnect(); });
  }

  function showGallery(payload, seq) {
    runCleanup();
    setState('ready');
    document.title = payload.folderName + ' · DesignThix';
    crumbBar(payload.breadcrumb);
    empty(refs.tools);
    refs.thumbs.hidden = true;
    empty(refs.stage);
    refs.stage.classList.remove('is-pages');
    refs.stage.classList.add('is-gallery');
    if (!payload.items.length) {
      refs.stage.appendChild(el('div', { class: 'dt-pv-emptyfolder' }, [icon('folder-open'), el('p', { text: 'In diesem Ordner liegt nichts, was du ansehen kannst.' })]));
      return;
    }
    var grid = el('ul', { class: 'dt-pv-grid' });
    payload.items.forEach(function (item) {
      var isFolder = item.kind === 'folder';
      var route = isFolder ? { folder: item.id } : { design: item.id };
      var thumb = el('span', { class: 'dt-pv-tile__thumb' });
      if (isFolder) {
        thumb.classList.add('is-folder');
        thumb.appendChild(icon('folder', 'dt-pv-tile__foldericon'));
      } else if (item.thumbUrl) {
        thumb.appendChild(el('img', { src: item.thumbUrl, alt: '', loading: 'lazy', decoding: 'async' }));
      } else {
        lazyTile(thumb, item.id, seq);
      }
      var a = el('a', { class: 'dt-pv-tile', href: addressOf(route) }, [
        thumb,
        el('span', { class: 'dt-pv-tile__name', text: item.name }),
        isFolder ? el('span', { class: 'dt-pv-tile__sub', text: item.count === 1 ? '1 Design' : item.count + ' Designs' }) : null,
      ]);
      a.addEventListener('click', function (ev) {
        if (ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.button) { return; }
        ev.preventDefault();
        go(route);
      });
      grid.appendChild(el('li', null, [a]));
    });
    refs.stage.appendChild(grid);
  }

  // ================================================================================================ the viewer of a design

  function showDesign(payload, seq, backCrumbs) {
    runCleanup();
    queue = [];
    var d = engine.normalize(payload.document);
    var pages = d.pages.length;
    var options = engineOptions(payload);
    var ratio = d.width / d.height;
    var view = { zoom: 1, page: 0, boxes: [], thumbBtns: [], base: 400 };
    var allowDownload = !!payload.allowDownload;
    document.title = payload.name + ' · DesignThix';
    setState('ready');
    showCreditsLink(payload.credits);
    root.setAttribute('data-pages', String(pages));
    root.setAttribute('data-download', allowDownload ? 'true' : 'false');

    // ---- the bar: path and tools
    if (backCrumbs) { crumbBar(backCrumbs, payload.name); } else { crumbBar([{ id: 0, name: payload.name }]); }
    empty(refs.tools);
    var prev = el('button', { type: 'button', class: 'mat-btn mat-btn--ghost mat-btn--icon mat-btn--sm', 'aria-label': 'Vorherige Seite', title: 'Vorherige Seite' }, [icon('chevron-up')]);
    var next = el('button', { type: 'button', class: 'mat-btn mat-btn--ghost mat-btn--icon mat-btn--sm', 'aria-label': 'Nächste Seite', title: 'Nächste Seite' }, [icon('chevron-down')]);
    var pageLabel = el('span', { class: 'dt-pv__pagelabel', 'aria-live': 'polite' });
    var pageLong = el('span', { class: 'dt-pv__pl-long' });
    var pageShort = el('span', { class: 'dt-pv__pl-short', 'aria-hidden': 'true' });
    pageLabel.appendChild(pageLong);
    pageLabel.appendChild(pageShort);
    var zoomOut = el('button', { type: 'button', class: 'mat-btn mat-btn--ghost mat-btn--icon mat-btn--sm', 'aria-label': 'Verkleinern', title: 'Verkleinern (−)' }, [icon('zoom-out')]);
    var zoomIn = el('button', { type: 'button', class: 'mat-btn mat-btn--ghost mat-btn--icon mat-btn--sm', 'aria-label': 'Vergrößern', title: 'Vergrößern (+)' }, [icon('zoom-in')]);
    var zoomText = el('button', { type: 'button', class: 'dt-pv__zoomtext', title: 'Einpassen (0)', 'aria-label': 'Einpassen' });
    if (pages > 1) { refs.tools.appendChild(el('span', { class: 'dt-pv__group', role: 'group', 'aria-label': 'Seiten' }, [prev, pageLabel, next])); }
    refs.tools.appendChild(el('span', { class: 'dt-pv__group dt-pv__zoom', role: 'group', 'aria-label': 'Zoom' }, [zoomOut, zoomText, zoomIn]));
    var downloadButton = null;
    if (allowDownload) {
      downloadButton = el('button', { type: 'button', class: 'mat-btn mat-btn--primary mat-btn--sm dt-pv__download' }, [icon('download'), el('span', { text: 'Herunterladen' })]);
      refs.tools.appendChild(downloadButton);
    }

    // ---- the pages
    empty(refs.stage);
    refs.stage.classList.remove('is-gallery');
    refs.stage.classList.add('is-pages');
    var holder = el('div', { class: 'dt-pv__pages' });
    holder.style.setProperty('--dt-ar', d.width + ' / ' + d.height);
    refs.stage.appendChild(holder);
    refs.stage.scrollTop = 0;
    refs.stage.scrollLeft = 0;
    var renderedBoxes = {};

    function drawInto(box, index, prefix, first) {
      if (renderedBoxes[prefix + index]) { return; }
      renderedBoxes[prefix + index] = true;
      enqueue(function () {
        if (seq !== viewSeq) { return null; }
        return engine.renderInto(box.draw, d, null, Object.assign({}, options, { page: index, idPrefix: prefix + index + '-' })).then(function () { box.node.classList.add('is-drawn'); });
      }, first);
    }

    var pageObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) { return; }
        var index = Number(entry.target.getAttribute('data-page'));
        drawInto(view.boxes[index], index, 'v', false);
        pageObserver.unobserve(entry.target);
      });
    }, { root: refs.stage, rootMargin: '900px 0px' });
    cleanup.push(function () { pageObserver.disconnect(); });

    for (var i = 0; i < pages; i++) {
      var draw = el('div', { class: 'dt-pv__draw' });
      var node = el('section', { class: 'dt-pv__page', 'data-page': String(i), 'aria-label': 'Seite ' + (i + 1) + ' von ' + pages }, [draw]);
      holder.appendChild(node);
      view.boxes.push({ node: node, draw: draw });
      pageObserver.observe(node);
    }
    drawInto(view.boxes[0], 0, 'v', true);

    // ---- thumbnails for several pages
    if (pages > 1) {
      refs.thumbs.hidden = false;
      empty(refs.thumbs);
      var thumbObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) { return; }
          var index = Number(entry.target.getAttribute('data-page'));
          drawInto(view.thumbBoxes[index], index, 't', false);
          thumbObserver.unobserve(entry.target);
        });
      }, { root: refs.thumbs, rootMargin: '200px' });
      cleanup.push(function () { thumbObserver.disconnect(); });
      view.thumbBoxes = [];
      for (var t = 0; t < pages; t++) {
        (function (index) {
          var tdraw = el('span', { class: 'dt-pv-thumb__draw' });
          var tbox = el('span', { class: 'dt-pv-thumb__box', 'data-page': String(index) }, [tdraw]);
          tbox.style.setProperty('--dt-ar', d.width + ' / ' + d.height);
          var button = el('button', { type: 'button', class: 'dt-pv-thumb', 'aria-label': 'Seite ' + (index + 1), 'aria-current': index === 0 ? 'true' : null }, [tbox, el('span', { class: 'dt-pv-thumb__no', text: String(index + 1) })]);
          button.addEventListener('click', function () { goTo(index, true); });
          refs.thumbs.appendChild(button);
          view.thumbBtns.push(button);
          view.thumbBoxes.push({ node: tbox, draw: tdraw });
          thumbObserver.observe(tbox);
        })(t);
      }
    } else {
      refs.thumbs.hidden = true;
    }

    // ---- sizes, zoom, current page
    function layout() {
      var styles = window.getComputedStyle(refs.stage);
      var padX = parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight);
      var padY = parseFloat(styles.paddingTop) + parseFloat(styles.paddingBottom);
      var availW = Math.max(120, refs.stage.clientWidth - padX);
      var availH = Math.max(120, refs.stage.clientHeight - padY);
      view.base = Math.max(120, Math.min(availW, availH * ratio));
      holder.style.setProperty('--dt-pv-w', Math.round(view.base * view.zoom) + 'px');
      zoomText.textContent = Math.round(view.zoom * 100) + ' %';
      zoomOut.disabled = view.zoom <= 0.26;
      zoomIn.disabled = view.zoom >= 3.99;
    }

    function setZoom(value, anchorPage) {
      var before = view.page;
      view.zoom = Math.max(0.25, Math.min(4, Math.round(value * 100) / 100));
      layout();
      if (anchorPage !== false) { goTo(before, false); }
    }

    function stepZoom(direction) {
      var steps = [0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.25, 1.5, 2, 3, 4];
      var idx = 0;
      for (var s = 0; s < steps.length; s++) { if (steps[s] <= view.zoom + 0.001) { idx = s; } }
      var target = steps[Math.max(0, Math.min(steps.length - 1, idx + direction))];
      setZoom(target);
    }

    function updatePage() {
      var rect = refs.stage.getBoundingClientRect();
      var middle = rect.top + rect.height / 2;
      var best = 0;
      var bestDistance = Infinity;
      view.boxes.forEach(function (b, index) {
        var r = b.node.getBoundingClientRect();
        var distance = Math.abs((r.top + r.bottom) / 2 - middle);
        if (r.top <= middle && r.bottom >= middle) { distance = -1; }
        if (distance < bestDistance) { bestDistance = distance; best = index; }
      });
      setCurrent(best);
    }

    function setCurrent(index) {
      view.page = index;
      pageLong.textContent = 'Seite ' + (index + 1) + ' von ' + pages;
      pageShort.textContent = (index + 1) + ' / ' + pages;
      prev.disabled = index <= 0;
      next.disabled = index >= pages - 1;
      view.thumbBtns.forEach(function (b, i) {
        if (i === index) { b.setAttribute('aria-current', 'true'); } else { b.removeAttribute('aria-current'); }
      });
      var active = view.thumbBtns[index];
      if (active) { active.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
      root.setAttribute('data-page', String(index + 1));
    }

    function goTo(index, smooth) {
      index = Math.max(0, Math.min(pages - 1, index));
      var node = view.boxes[index].node;
      node.scrollIntoView({ block: 'center', inline: 'center', behavior: smooth && !window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'auto' });
      setCurrent(index);
    }

    var scrollTick = 0;
    function onScroll() {
      if (scrollTick) { return; }
      scrollTick = requestAnimationFrame(function () { scrollTick = 0; updatePage(); });
    }
    refs.stage.addEventListener('scroll', onScroll, { passive: true });
    cleanup.push(function () { refs.stage.removeEventListener('scroll', onScroll); });

    var resizeTimer = 0;
    function onResize() { clearTimeout(resizeTimer); resizeTimer = setTimeout(function () { layout(); updatePage(); }, 80); }
    window.addEventListener('resize', onResize);
    cleanup.push(function () { window.removeEventListener('resize', onResize); clearTimeout(resizeTimer); });

    function onWheel(ev) {
      if (!ev.ctrlKey) { return; }
      ev.preventDefault();
      stepZoom(ev.deltaY < 0 ? 1 : -1);
    }
    refs.stage.addEventListener('wheel', onWheel, { passive: false });
    cleanup.push(function () { refs.stage.removeEventListener('wheel', onWheel); });

    function onKey(ev) {
      if (ev.target && /^(INPUT|SELECT|TEXTAREA)$/.test(ev.target.tagName)) { return; }
      if (doc.querySelector('dialog[open]')) { return; }
      var handled = true;
      if (ev.key === '+' || ev.key === '=') { stepZoom(1); }
      else if (ev.key === '-') { stepZoom(-1); }
      else if (ev.key === '0') { setZoom(1); }
      else if (ev.key === 'PageDown' || (ev.key === 'ArrowRight' && view.zoom <= 1)) { goTo(view.page + 1, true); }
      else if (ev.key === 'PageUp' || (ev.key === 'ArrowLeft' && view.zoom <= 1)) { goTo(view.page - 1, true); }
      else if (ev.key === 'Home') { goTo(0, true); }
      else if (ev.key === 'End') { goTo(pages - 1, true); }
      else { handled = false; }
      if (handled) { ev.preventDefault(); }
    }
    doc.addEventListener('keydown', onKey);
    cleanup.push(function () { doc.removeEventListener('keydown', onKey); });

    prev.addEventListener('click', function () { goTo(view.page - 1, true); });
    next.addEventListener('click', function () { goTo(view.page + 1, true); });
    zoomOut.addEventListener('click', function () { stepZoom(-1); });
    zoomIn.addEventListener('click', function () { stepZoom(1); });
    zoomText.addEventListener('click', function () { setZoom(1); });

    layout();
    setCurrent(0);

    // ---- download (only when the link allows it)
    if (downloadButton) {
      downloadButton.addEventListener('click', function () { downloadDialog(payload, d, options, view); });
    }
  }

  // ================================================================================================ download: PNG, ZIP, PDF

  function triggerDownload(blob, name) {
    var url = URL.createObjectURL(blob);
    var a = el('a', { href: url, download: name, class: 'mat-sr-only' });
    doc.body.appendChild(a);
    a.click();
    setTimeout(function () { a.remove(); URL.revokeObjectURL(url); }, 15000);
  }

  function pngOptions(d, options, index) {
    var dpi = d.unit === 'px' ? 192 : Math.min(300, d.dpi || 300);
    return Object.assign({}, options, { page: index, dpi: dpi, format: 'png', maxWidth: 6000 });
  }

  function downloadDialog(payload, d, options, view) {
    var pages = d.pages.length;
    var base = safeName(payload.name);
    var dlg = el('dialog', { class: 'mat-dialog mat-dialog--sm dt-pv-dl', 'data-static': '', 'aria-labelledby': 'dt-pv-dl-title' });
    var status = el('p', { class: 'mat-muted dt-pv-dl__status', role: 'status', 'aria-live': 'polite', hidden: true });
    var buttons = [];
    function option(iconName, title, hint, run) {
      var b = el('button', { type: 'button', class: 'dt-pv-opt' }, [icon(iconName), el('span', { class: 'dt-pv-opt__text' }, [el('strong', { text: title }), el('span', { text: hint })])]);
      b.addEventListener('click', function () {
        buttons.forEach(function (x) { x.disabled = true; });
        status.hidden = false;
        Promise.resolve(run()).then(function (closeNow) {
          if (closeNow !== false) { closeDialog(); }
        }, function (err) {
          status.textContent = err && /too large/i.test(String(err.message)) ? 'Das Bild wäre zu groß.' : 'Die Datei konnte nicht erstellt werden.';
          buttons.forEach(function (x) { x.disabled = false; });
        });
      });
      buttons.push(b);
      return b;
    }
    function closeDialog() { if (window.MatUi && window.MatUi.dialog) { window.MatUi.dialog.close(dlg); } else { dlg.close(); } }

    var list = el('div', { class: 'dt-pv-dl__list' });
    list.appendChild(option('file-image', pages > 1 ? 'PNG – diese Seite' : 'PNG', pages > 1 ? 'Seite ' + (view.page + 1) + ' als Bild.' : 'Als Bild, in guter Auflösung.', function () {
      status.textContent = 'Das Bild wird erstellt …';
      return engine.rasterize(d, null, pngOptions(d, options, view.page)).then(function (blob) { triggerDownload(blob, base + (pages > 1 ? '-' + (view.page + 1) : '') + '.png'); toast('Das Bild wird heruntergeladen.', 'success'); });
    }));
    if (pages > 1) {
      list.appendChild(option('file-stack', 'PNG – alle Seiten', 'Alle ' + pages + ' Seiten als Bilder in einer ZIP-Datei.', function () {
        var files = [];
        var chain = Promise.resolve();
        for (var i = 0; i < pages; i++) {
          (function (index) {
            chain = chain.then(function () {
              status.textContent = 'Seite ' + (index + 1) + ' von ' + pages + ' wird erstellt …';
              return engine.rasterize(d, null, pngOptions(d, options, index)).then(function (blob) { files.push({ name: base + '-' + (index + 1) + '.png', blob: blob }); });
            });
          })(i);
        }
        return chain.then(function () { status.textContent = 'Die ZIP-Datei wird gepackt …'; return engine.zip(files); }).then(function (zip) { triggerDownload(zip, base + '.zip'); toast('Die ZIP-Datei wird heruntergeladen.', 'success'); });
      }));
    }
    list.appendChild(option('printer', 'PDF / Drucken', 'Öffnet den Druckdialog mit allen Seiten. Dort kannst du auch als PDF speichern.', function () {
      status.textContent = 'Die Druckansicht wird vorbereitet …';
      return printAll(d, options).then(function () { return true; });
    }));

    var head = el('div', { class: 'mat-dialog__head' }, [icon('download'), el('h2', { class: 'mat-dialog__title', id: 'dt-pv-dl-title', text: 'Herunterladen' }),
      el('button', { type: 'button', class: 'mat-btn mat-btn--ghost mat-btn--icon mat-dialog__close', 'aria-label': 'Schließen', 'data-dialog-close': '' }, [icon('x')])]);
    var form = el('form', { class: 'mat-dialog__form', method: 'dialog' }, [head, el('div', { class: 'mat-dialog__body' }, [list, status])]);
    form.addEventListener('submit', function (ev) { ev.preventDefault(); });
    dlg.appendChild(form);
    dlg.addEventListener('close', function () { setTimeout(function () { dlg.remove(); }, 0); });
    doc.body.appendChild(dlg);
    window.MatUi.dialog.open(dlg);
  }

  /** The print view: every page of the design in mm on a page of its own, the paper size as an @page rule inserted through the CSSOM (a <style> element would be blocked by the CSP). */
  function printSheet() {
    for (var i = 0; i < doc.styleSheets.length; i++) {
      var s = doc.styleSheets[i];
      if (s.href && /\/css\/public-view\.css/.test(s.href)) { return s; }
    }
    return null;
  }

  function printAll(d, options) {
    var unit = d.unit === 'px' ? MM_PER_PX : 1;
    var w = d.width * unit;
    var h = d.height * unit;
    var rule = '@page { size: ' + (Math.round(w * 100) / 100) + 'mm ' + (Math.round(h * 100) / 100) + 'mm; margin: 0; }';
    var sheet = printSheet();
    var ruleIndex = -1;
    try {
      if (sheet) { ruleIndex = sheet.insertRule(rule, sheet.cssRules.length); }
    } catch (e) { ruleIndex = -1; }
    empty(refs.print);
    refs.print.style.setProperty('--dt-pw', w + 'mm');
    refs.print.style.setProperty('--dt-ph', h + 'mm');
    var chain = Promise.resolve();
    d.pages.forEach(function (page, index) {
      var sheetEl = el('div', { class: 'dt-pv-printpage' });
      refs.print.appendChild(sheetEl);
      chain = chain.then(function () { return engine.renderInto(sheetEl, d, null, Object.assign({}, options, { page: index, idPrefix: 'p' + index + '-' })); });
    });
    return chain.then(function () {
      return new Promise(function (resolve) {
        var finish = function () {
          window.removeEventListener('afterprint', finish);
          doc.documentElement.classList.remove('is-printing');
          empty(refs.print);
          if (sheet && ruleIndex >= 0 && sheet.cssRules[ruleIndex] && /^@page/.test(sheet.cssRules[ruleIndex].cssText)) { try { sheet.deleteRule(ruleIndex); } catch (e) { /* ignore */ } }
          resolve();
        };
        window.addEventListener('afterprint', finish);
        doc.documentElement.classList.add('is-printing');
        root.setAttribute('data-print-pages', String(d.pages.length));
        requestAnimationFrame(function () { setTimeout(function () { window.print(); if (!('onafterprint' in window)) { finish(); } }, 50); });
      });
    });
  }

  // ================================================================================================ Bildnachweise

  function httpLink(url, text) {
    return /^https?:\/\//i.test(String(url || '')) ? el('a', { href: url, target: '_blank', rel: 'noopener noreferrer', text: text }) : null;
  }

  function creditLine(c) {
    return c.attribution || ((c.title || 'Bild') + (c.author ? ' von ' + c.author : '') + ' auf ' + c.catalogName);
  }

  function copyCredits(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return false; });
    }
    return Promise.resolve(false);
  }

  /** The dialog "Bildnachweise": the pictures of the design that came from a catalogue, with author, licence and links (the attribution of CC BY material has to travel with the design). */
  function creditsDialog(credits) {
    var dlg = el('dialog', { class: 'mat-dialog mat-dialog--sm dt-pv-cr', 'data-static': '', 'aria-labelledby': 'dt-pv-cr-title' });
    var list = el('ul', { class: 'dt-pv-cr__list', 'data-credits': '' });
    credits.forEach(function (c) {
      var meta = el('span', { class: 'dt-pv-cr__meta' });
      var parts = [];
      if (c.author) { parts.push(httpLink(c.authorUrl, c.author) || el('span', { text: c.author })); }
      parts.push(el('span', { text: c.catalogName }));
      if (c.licence && c.licence.name) { parts.push(httpLink(c.licence.url, c.licence.name) || el('span', { text: c.licence.name })); }
      var source = httpLink(c.sourceUrl, 'Quelle');
      if (source) { parts.push(source); }
      parts.forEach(function (node, i) { if (i) { meta.appendChild(doc.createTextNode(' · ')); } meta.appendChild(node); });
      list.appendChild(el('li', { class: 'dt-pv-cr__item' }, [el('strong', { text: c.title || 'Bild' }), meta]));
    });
    var copy = el('button', { type: 'button', class: 'mat-btn mat-btn--secondary' }, [icon('copy'), el('span', { text: 'Text kopieren' })]);
    copy.addEventListener('click', function () {
      copyCredits(credits.map(creditLine).join(String.fromCharCode(10))).then(function (ok) { toast(ok ? 'Der Text ist kopiert.' : 'Das Kopieren hat nicht geklappt.', ok ? 'success' : 'warning'); });
    });
    var close = el('button', { type: 'button', class: 'mat-btn mat-btn--primary', 'data-dialog-close': '', text: 'Schließen' });
    var head = el('div', { class: 'mat-dialog__head' }, [icon('images'), el('h2', { class: 'mat-dialog__title', id: 'dt-pv-cr-title', text: 'Bildnachweise' }),
      el('button', { type: 'button', class: 'mat-btn mat-btn--ghost mat-btn--icon mat-dialog__close', 'aria-label': 'Schließen', 'data-dialog-close': '' }, [icon('x')])]);
    var body = el('div', { class: 'mat-dialog__body' }, [el('p', { class: 'mat-muted', text: 'Diese Bilder des Designs stammen aus Bildkatalogen im Internet.' }), list]);
    var foot = el('div', { class: 'mat-dialog__foot' }, [el('div', { class: 'mat-btn-row mat-btn-row--plain' }, [copy, close])]);
    var form = el('form', { class: 'mat-dialog__form', method: 'dialog' }, [head, body, foot]);
    form.addEventListener('submit', function (ev) { ev.preventDefault(); });
    dlg.appendChild(form);
    dlg.addEventListener('close', function () { setTimeout(function () { dlg.remove(); }, 0); });
    doc.body.appendChild(dlg);
    window.MatUi.dialog.open(dlg);
  }

  /** A link "Bildnachweise" in the footer while a design with pictures from catalogues is shown; the next view takes it away again (runCleanup). */
  function showCreditsLink(credits) {
    var foot = root.querySelector('.dt-pv__foot');
    if (!foot || !credits || !credits.length) { return; }
    var button = el('button', { type: 'button', class: 'dt-pv__credits' }, [icon('images'), el('span', { text: 'Bildnachweise' })]);
    button.addEventListener('click', function () { creditsDialog(credits); });
    foot.appendChild(el('span', { class: 'dt-pv__foot-sep', 'aria-hidden': 'true', text: ' · ' }));
    foot.appendChild(button);
    root.setAttribute('data-credits', String(credits.length));
    cleanup.push(function () {
      button.remove();
      var sep = foot.querySelector('.dt-pv__foot-sep');
      if (sep) { sep.remove(); }
      root.removeAttribute('data-credits');
    });
  }

  // ================================================================================================ start

  function render() {
    var seq = ++viewSeq;
    var route = readRoute();
    var isFolder = root.getAttribute('data-kind') === 'folder';
    setState('loading');
    if (!isFolder) {
      getJson(apiBase).then(function (res) {
        if (seq !== viewSeq) { return; }
        if (!res.ok) { showFailure(res); return; }
        showDesign(res.data, seq, null);
      });
      return;
    }
    if (route.design) {
      getJson(apiBase + '/d/' + route.design).then(function (res) {
        if (seq !== viewSeq) { return null; }
        if (!res.ok) { showFailure(res); return null; }
        var design = res.data;
        // the way back: the folder the design sits in (inside the shared one), when it is known
        var crumbsUrl = apiBase + (design.folderId ? '?folder=' + design.folderId : '');
        return getJson(crumbsUrl).then(function (c) {
          if (seq !== viewSeq) { return; }
          showDesign(design, seq, c.ok && c.data.breadcrumb ? c.data.breadcrumb : null);
        });
      });
      return;
    }
    getJson(apiBase + (route.folder ? '?folder=' + route.folder : '')).then(function (res) {
      if (seq !== viewSeq) { return; }
      if (!res.ok) { showFailure(res); return; }
      showGallery(res.data, seq);
    });
  }

  window.addEventListener('popstate', render);
  render();
})();
