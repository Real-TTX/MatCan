/* DesignThix editor, part 9: everything that brings files and elements in from outside.
   - D.dnd.attach(tile, ...)       a tile of a panel that can be clicked or dragged onto the canvas (pointer events: works with mouse, pen and touch);
   - D.io.upload...                images go to /api/assets/upload, fonts to /api/fonts/upload (several files at once, progress, German errors per file);
   - paste (Ctrl+V)                an image of the clipboard is uploaded and inserted, text becomes a text element, copied DesignThix elements come back as elements
                                   (also in another design: they are kept in localStorage 'dt-clipboard');
   - drop from the file explorer   onto the page: all files are uploaded and inserted at the drop point (cascaded); onto an image or frame: its source is replaced; onto a slot
                                   of an image strip: the slot is set; font files become fonts and are applied to the selected text.
   The overlay "Zum Hochladen loslassen" is #dt-dropzone. Events of the app: 'uploaded' {assets}. */
(function () {
  'use strict';

  var D = window.DtDesigner;
  var app;
  var IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg)$/i;
  var FONT_EXT = /\.(ttf|otf|woff2?)$/i;

  // ================================================================================================ drag of tiles

  var dragging = null;
  var suppressClick = false;

  /**
   * Makes a tile clickable and draggable onto the canvas. options: ghost() -> element shown under the pointer, onClick(), onDrop(clientX, clientY), onCancel().
   * A quick flick still ends on the tile (pointer capture at pointerdown); a touch that scrolls the list vertically does not start a drag.
   */
  var dnd = D.dnd = {
    attach: function (tile, options) {
      tile.addEventListener('click', function (ev) {
        if (suppressClick) { ev.preventDefault(); return; }
        if (options.onClick && !tile.disabled) { options.onClick(ev); }
      });
      tile.addEventListener('pointerdown', function (ev) {
        if (ev.button !== 0 || tile.disabled || !options.onDrop || !app.editable()) { return; }
        var d = { pointerId: ev.pointerId, x: ev.clientX, y: ev.clientY, started: false, ghost: null };
        dragging = d;
        try { tile.setPointerCapture(ev.pointerId); } catch (err) { /* ignore */ }
        var viewport = document.getElementById('dt-viewport');
        var move = function (e) {
          if (!dragging || e.pointerId !== d.pointerId) { return; }
          if (!d.started) {
            var dx = e.clientX - d.x;
            var dy = e.clientY - d.y;
            var threshold = e.pointerType === 'touch' ? 10 : 6;
            if (Math.hypot(dx, dy) < threshold) { return; }
            if (e.pointerType === 'touch' && Math.abs(dy) > Math.abs(dx) * 1.5) { return; }
            d.started = true;
            var inner = options.ghost ? options.ghost() : null;
            d.ghost = D.el('div', { class: 'dt-dragghost' }, inner);
            document.body.appendChild(d.ghost);
            document.documentElement.classList.add('is-dragging-tile');
          }
          d.ghost.style.setProperty('left', e.clientX + 'px');
          d.ghost.style.setProperty('top', e.clientY + 'px');
          var over = document.elementFromPoint(e.clientX, e.clientY);
          viewport.classList.toggle('is-drop-target', !!(over && over.closest && over.closest('#dt-viewport')));
          e.preventDefault();
        };
        var finish = function (e, cancelled) {
          if (!dragging || e.pointerId !== d.pointerId) { return; }
          dragging = null;
          tile.removeEventListener('pointermove', move);
          tile.removeEventListener('pointerup', up);
          tile.removeEventListener('pointercancel', cancel);
          viewport.classList.remove('is-drop-target');
          document.documentElement.classList.remove('is-dragging-tile');
          if (d.ghost && d.ghost.parentNode) { d.ghost.parentNode.removeChild(d.ghost); }
          if (!d.started) { return; }
          suppressClick = true;
          setTimeout(function () { suppressClick = false; }, 60);
          if (cancelled) { if (options.onCancel) { options.onCancel(); } return; }
          var over = document.elementFromPoint(e.clientX, e.clientY);
          if (over && over.closest && over.closest('#dt-viewport') && !over.closest('.dt-canvas-tools, .dt-warnbar')) { options.onDrop(e.clientX, e.clientY); }
        };
        var up = function (e) { finish(e, false); };
        var cancel = function (e) { finish(e, true); };
        tile.addEventListener('pointermove', move);
        tile.addEventListener('pointerup', up);
        tile.addEventListener('pointercancel', cancel);
      });
    },
  };

  // ================================================================================================ upload

  var progressEl = null;

  function showProgress(text, percent) {
    if (!progressEl) {
      progressEl = D.el('div', { class: 'dt-uptoast', role: 'status', 'aria-live': 'polite' }, [
        D.icon('cloud-upload', 'dt-uptoast__icon'),
        D.el('div', { class: 'dt-uptoast__body' }, [D.el('span', { class: 'dt-uptoast__text' }), D.el('span', { class: 'dt-uptoast__bar' }, D.el('i', { class: 'dt-uptoast__fill' }))]),
      ]);
      document.body.appendChild(progressEl);
    }
    D.$('.dt-uptoast__text', progressEl).textContent = text;
    D.$('.dt-uptoast__fill', progressEl).style.setProperty('width', Math.round(D.clamp(percent, 0, 1) * 100) + '%');
  }

  function hideProgress() { if (progressEl && progressEl.parentNode) { progressEl.parentNode.removeChild(progressEl); } progressEl = null; }

  function fileWord(n) { return n === 1 ? 'Datei' : 'Dateien'; }

  /** POSTs files as multipart with a progress callback. Resolves { status, ok, data }; rejects with { offline: true } without a connection. */
  function postFiles(url, files, fields, onProgress) {
    return new Promise(function (resolve, reject) {
      var form = new FormData();
      files.forEach(function (f) { form.append('files', f, f.name || ''); });
      Object.keys(fields || {}).forEach(function (k) { form.append(k, fields[k]); });
      var xhr = new XMLHttpRequest();
      xhr.open('POST', url);
      xhr.setRequestHeader('RequestVerificationToken', D.csrf());
      xhr.setRequestHeader('Accept', 'application/json');
      xhr.upload.addEventListener('progress', function (e) { if (e.lengthComputable && onProgress) { onProgress(e.loaded / e.total); } });
      xhr.addEventListener('load', function () {
        var data = null;
        try { data = xhr.responseText ? JSON.parse(xhr.responseText) : null; } catch (e) { data = null; }
        resolve({ status: xhr.status, ok: xhr.status >= 200 && xhr.status < 300, data: data });
      });
      xhr.addEventListener('error', function () { var err = new Error('offline'); err.offline = true; reject(err); });
      xhr.send(form);
    });
  }

  function reportErrors(errors) {
    (errors || []).slice(0, 3).forEach(function (e) { D.toast((e.fileName ? '„' + e.fileName + '“: ' : '') + (e.error || 'Die Datei konnte nicht hochgeladen werden.'), 'danger'); });
    if (errors && errors.length > 3) { D.toast('… und ' + (errors.length - 3) + ' weitere Dateien mit Fehlern.', 'danger'); }
  }

  /** Uploads image files. Resolves { uploaded: [asset], errors }. Failures are reported as toasts. */
  function uploadImages(files, category) {
    if (!files.length) { return Promise.resolve({ uploaded: [], errors: [] }); }
    showProgress(files.length + ' ' + fileWord(files.length) + ' werden hochgeladen …', 0);
    return postFiles('/api/assets/upload', files, category ? { category: category } : {}, function (p) { showProgress(files.length + ' ' + fileWord(files.length) + ' werden hochgeladen … ' + Math.round(p * 100) + ' %', p); }).then(function (res) {
      hideProgress();
      var data = res.data || {};
      if (!res.ok && !(data.uploaded && data.uploaded.length)) {
        if (res.status === 403) { D.toast('Du darfst keine Dateien hochladen.', 'danger'); }
        else { reportErrors(data.errors && data.errors.length ? data.errors : [{ fileName: '', error: data.error || 'Der Upload ist fehlgeschlagen.' }]); }
        return { uploaded: [], errors: data.errors || [] };
      }
      reportErrors(data.errors);
      app.addAssets(data.uploaded);
      app.emit('uploaded', { assets: data.uploaded });
      return { uploaded: data.uploaded, errors: data.errors || [] };
    }, function () {
      hideProgress();
      D.toast('Keine Verbindung: Die Dateien konnten nicht hochgeladen werden.', 'warning');
      return { uploaded: [], errors: [] };
    });
  }

  /** Refreshes the fonts after an upload: the list for the pickers, the faces for the engine and the style sheet for the previews. */
  function refreshFonts() {
    return D.request('GET', '/api/fonts').then(function (res) {
      if (!res.ok) { return; }
      app.fonts = res.data.map(function (f) { return { family: f.family, weight: f.weight, style: f.style, url: f.url }; });
      app.fontIndex = D.buildFontIndex(res.data);
      var link = D.el('link', { rel: 'stylesheet', href: '/fonts.css?v=' + Date.now() });
      document.head.appendChild(link);
      app.emit('fonts');
    });
  }

  /** Uploads font files and applies the first new family to the given (or the selected) text elements. */
  function uploadFonts(files, textIds) {
    showProgress(files.length + ' ' + fileWord(files.length) + ' werden hochgeladen …', 0);
    return postFiles('/api/fonts/upload', files, {}, function (p) { showProgress(files.length + ' Schriften werden hochgeladen … ' + Math.round(p * 100) + ' %', p); }).then(function (res) {
      hideProgress();
      var data = res.data || {};
      reportErrors(data.errors);
      if (!data.uploaded || !data.uploaded.length) { if (!(data.errors && data.errors.length)) { D.toast(data.error || 'Die Schrift konnte nicht hochgeladen werden.', 'danger'); } return null; }
      return refreshFonts().then(function () {
        var family = data.uploaded[0].family;
        var ids = (textIds || app.selected().filter(function (e) { return e.type === 'text'; }).map(function (e) { return e.id; })).filter(function (id) { var e = app.element(id); return e && e.type === 'text' && !e.locked; });
        if (ids.length) {
          var info = app.fontIndex.find(function (x) { return x.family === family; });
          app.setProps(ids, function (e) {
            var p = { fontFamily: family };
            if (info && info.weights.indexOf(e.fontWeight) < 0) { p.fontWeight = info.weights.reduce(function (b, w) { return Math.abs(w - e.fontWeight) < Math.abs(b - e.fontWeight) ? w : b; }, info.weights[0]); }
            return D.canvas.textPatch(e, p);
          }, { merge: false });
          D.toast('Die Schrift „' + family + '“ ist da und gilt jetzt für den Text.', 'success');
        } else {
          D.toast('Die Schrift „' + family + '“ ist da. Wähle einen Text und dann die Schrift in der Werkzeugleiste.', 'success');
        }
        return family;
      });
    }, function () { hideProgress(); D.toast('Keine Verbindung: Die Schrift konnte nicht hochgeladen werden.', 'warning'); return null; });
  }

  function classify(files) {
    var out = { images: [], fonts: [], other: [] };
    files.forEach(function (f) {
      if (/^image\//.test(f.type) || IMAGE_EXT.test(f.name || '')) { out.images.push(f); }
      else if (FONT_EXT.test(f.name || '') || /^(font\/|application\/(font|x-font))/.test(f.type)) { out.fonts.push(f); }
      else { out.other.push(f); }
    });
    return out;
  }

  function cascadeStep() { return app.doc.unit === 'px' ? 24 : 6; }

  /**
   * Files from the clipboard or the file explorer. point = the client point of a drop (null: the middle of the page). Images are uploaded and inserted (the first one replaces an image,
   * frame or strip slot under the point); fonts are uploaded and applied to the selected text. Resolves when everything is done.
   */
  function insertFiles(files, point) {
    if (!app.editable()) { D.toast('Du darfst dieses Design nur ansehen.', 'warning'); return Promise.resolve(); }
    var kinds = classify(files);
    kinds.other.slice(0, 3).forEach(function (f) { D.toast('„' + (f.name || 'Datei') + '“: Dieser Dateityp wird nicht unterstützt (Bilder und Schriften gehen).', 'warning'); });
    var chain = Promise.resolve();
    if (kinds.fonts.length) { chain = chain.then(function () { return uploadFonts(kinds.fonts, null); }); }
    if (kinds.images.length) {
      var target = point ? D.canvas.dropTarget(point.x, point.y) : { kind: 'page', point: { x: app.doc.width / 2, y: app.doc.height / 2 }, inside: true };
      chain = chain.then(function () { return uploadImages(kinds.images); }).then(function (result) {
        var assets = result.uploaded;
        if (!assets.length) { return null; }
        var step = cascadeStep();
        var base = target.point;
        var rest = assets;
        if (target.kind === 'image') {
          app.setSource(target.node.id, { asset: assets[0].key });
          app.select([target.node.id]);
          rest = assets.slice(1);
          base = { x: target.node.x + target.node.w / 2 + step, y: target.node.y + target.node.h / 2 + step };
        } else if (target.kind === 'slot') {
          var items = app.element(target.node.id).items.slice();
          assets.forEach(function (a, i) {
            var at = target.slot + i;
            if (at >= 12) { return; }
            while (items.length <= at) { items.push(null); }
            items[at] = { asset: a.key };
          });
          app.setProps([target.node.id], { items: items }, { merge: false });
          app.select([target.node.id]);
          rest = assets.slice(Math.max(0, 12 - target.slot));
        }
        var seq = Promise.resolve();
        rest.forEach(function (a, i) {
          seq = seq.then(function () { return D.canvas.addAssetImage(a, { x: base.x + i * step, y: base.y + i * step }); });
        });
        return seq;
      });
    }
    return chain;
  }

  /** Inserts one asset of the library (click in a panel): into an empty frame that is selected, else as a new image in the middle of the page. */
  function useAsset(asset) {
    if (!app.editable()) { return; }
    var e = app.single();
    if (e && e.type === 'image' && !e.source && !e.locked) { app.setSource(e.id, { asset: asset.key }); return; }
    D.canvas.addAssetImage(asset, null);
  }

  function pickFiles(accept, multiple, done) {
    var input = D.el('input', { type: 'file', accept: accept, multiple: multiple, class: 'mat-sr-only', tabindex: '-1', 'aria-hidden': 'true' });
    document.body.appendChild(input);
    input.addEventListener('change', function () { var files = Array.prototype.slice.call(input.files); input.remove(); if (files.length) { done(files); } });
    input.addEventListener('cancel', function () { input.remove(); });
    input.click();
  }

  D.io = {
    uploadImages: uploadImages,
    uploadFonts: uploadFonts,
    refreshFonts: refreshFonts,
    insertFiles: insertFiles,
    useAsset: useAsset,
    /** The file dialog for images: uploads them (insert: put them on the page as well). */
    pickImageFiles: function (insert) {
      pickFiles('image/png,image/jpeg,image/gif,image/webp,image/svg+xml,.png,.jpg,.jpeg,.gif,.webp,.svg', true, function (files) { if (insert) { insertFiles(files, null); } else { uploadImages(files); } });
    },
    pickFontFiles: function (textIds) { pickFiles('.ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2', true, function (files) { uploadFonts(files, textIds || null); }); },
    classify: classify,
  };

  // ================================================================================================ paste and drop

  function isTyping(t) {
    if (!t || !t.tagName) { return false; }
    return t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName);
  }

  function dialogOpen() { return !!document.querySelector('dialog[open]'); }

  function hasFiles(ev) {
    var types = ev.dataTransfer && ev.dataTransfer.types;
    return !!types && Array.prototype.indexOf.call(types, 'Files') >= 0;
  }

  function init(theApp) {
    app = theApp;
    var viewport = document.getElementById('dt-viewport');
    var zone = document.getElementById('dt-dropzone');
    var depth = 0;

    document.addEventListener('paste', function (ev) {
      if (!app.doc || isTyping(ev.target) || dialogOpen()) { return; }
      if (!app.editable()) { return; }
      var cd = ev.clipboardData;
      if (!cd) { return; }
      var files = Array.prototype.slice.call(cd.files || []);
      if (!files.length && cd.items) {
        Array.prototype.forEach.call(cd.items, function (item) { if (item.kind === 'file') { var f = item.getAsFile(); if (f) { files.push(f); } } });
      }
      ev.preventDefault();
      if (files.length) { insertFiles(files, null); return; }
      app.paste(cd.getData('text/plain') || '');
    });

    var setOverlay = function (on) { if (zone) { zone.hidden = !on; } viewport.classList.toggle('is-file-drop', on); };

    document.addEventListener('dragenter', function (ev) {
      if (!hasFiles(ev) || !app.editable()) { return; }
      depth++;
      if (viewport.contains(ev.target) || (zone && zone.contains(ev.target))) { setOverlay(true); }
    });
    document.addEventListener('dragover', function (ev) {
      if (!hasFiles(ev)) { return; }
      ev.preventDefault();    // else the browser opens the file
      var inCanvas = viewport.contains(ev.target);
      if (ev.dataTransfer) { ev.dataTransfer.dropEffect = app.editable() && (inCanvas || ev.target.closest('[data-dropzone]')) ? 'copy' : 'none'; }
      setOverlay(inCanvas && app.editable());
    });
    document.addEventListener('dragleave', function (ev) {
      if (!hasFiles(ev)) { return; }
      depth = Math.max(0, depth - 1);
      if (depth === 0 || !ev.relatedTarget) { setOverlay(false); }
    });
    document.addEventListener('drop', function (ev) {
      if (!hasFiles(ev)) { return; }
      ev.preventDefault();
      depth = 0;
      setOverlay(false);
      if (!app.doc || !app.editable()) { return; }
      var files = Array.prototype.slice.call(ev.dataTransfer.files || []);
      if (!files.length) { return; }
      if (viewport.contains(ev.target)) { insertFiles(files, { x: ev.clientX, y: ev.clientY }); return; }
      var zoneTarget = ev.target.closest && ev.target.closest('[data-dropzone]');
      if (zoneTarget) {
        // a drop zone of a panel (Uploads): upload only, nothing is put on the page
        var kinds = classify(files);
        if (kinds.fonts.length) { uploadFonts(kinds.fonts, null); }
        if (kinds.images.length) { uploadImages(kinds.images); }
      }
    });
  }

  D.io.init = init;
})();
