/* DesignThix media browser: ONE place to choose a picture, used everywhere an image is chosen (the editor: replace image, frame, background, every slot of an image strip, Beispielbild
   of a field; the brand page: logos; later the data list grid and the single print).
     window.DtMedia.pick({ title, tab, category, current }, callback)
   opens a dialog (a full-screen sheet on phones) with the tabs Uploads / Flaggen / Siegel / Logos / Alle, a search field, thumbnails (contain, on a checkerboard), an upload button, a
   drop zone (files dropped anywhere in the dialog) and paste (Ctrl+V while it is open). A click (or Enter on the focused thumbnail) chooses; the grid is keyboard navigable (arrows,
   Home, End). callback(key, asset) runs with the asset key (lower case, as designs hold it) and the asset { key, name, category, url, width, height, contentType }; it is not called when
   the dialog is cancelled. options.tab: 'uploads' | 'flags' | 'seals' | 'logos' | 'all'; options.category (a library category such as 'Logos' or 'Flaggen') picks the tab.
   window.DtMedia.upload(files, category) uploads files (POST /api/assets/upload) and resolves { uploaded, errors }. Nothing here builds HTML from data. */
(function () {
  'use strict';

  var TABS = [
    { id: 'uploads', label: 'Uploads', query: 'category=uploads&sort=new', empty: 'Noch keine Uploads. Lade Bilder hoch, ziehe sie hierher oder füge sie mit Strg+V ein.' },
    { id: 'flags', label: 'Flaggen', query: 'category=Flaggen', empty: 'Keine Flaggen gefunden.' },
    { id: 'seals', label: 'Siegel', query: 'category=Siegel', empty: 'Keine Siegel gefunden.' },
    { id: 'logos', label: 'Logos', query: 'category=Logos&sort=new', empty: 'Noch keine Logos. Lade ein Logo hoch und ordne es der Kategorie „Logos“ zu.' },
    { id: 'all', label: 'Alle', query: 'sort=new', empty: 'Nichts gefunden.' },
  ];
  var CATEGORY_TAB = { uploads: 'uploads', flaggen: 'flags', siegel: 'seals', logos: 'logos' };
  var IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg)$/i;
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var counter = 0;

  function el(tag, props, kids) {
    var node = document.createElement(tag);
    Object.keys(props || {}).forEach(function (k) {
      var v = props[k];
      if (v === null || v === undefined || v === false) { return; }
      if (k === 'class') { node.className = v; }
      else if (k === 'text') { node.textContent = v; }
      else if (k === 'on') { Object.keys(v).forEach(function (ev) { node.addEventListener(ev, v[ev]); }); }
      else if (k === 'disabled') { node.disabled = !!v; }
      else { node.setAttribute(k, v === true ? '' : String(v)); }
    });
    (Array.isArray(kids) ? kids : (kids ? [kids] : [])).forEach(function (kid) { if (kid) { node.appendChild(typeof kid === 'string' ? document.createTextNode(kid) : kid); } });
    return node;
  }

  function icon(name, cls) {
    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'mat-icon' + (cls ? ' ' + cls : ''));
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    var use = document.createElementNS(SVG_NS, 'use');
    use.setAttribute('href', (document.getElementById('dt-i-' + name) ? '#dt-i-' : '#mat-i-') + name);
    svg.appendChild(use);
    return svg;
  }

  function csrf() { var m = document.querySelector('meta[name="dt-csrf"]'); return m ? m.getAttribute('content') : ''; }

  function toast(message, tone) { if (window.MatUi && window.MatUi.toast) { window.MatUi.toast(message, { tone: tone || undefined }); } }

  function isImage(file) { return /^image\//.test(file.type) || IMAGE_EXT.test(file.name || ''); }

  /** Uploads image files; resolves { uploaded: [asset], errors: [{ fileName, error }] }. */
  function upload(files, category, onProgress) {
    return new Promise(function (resolve) {
      var form = new FormData();
      files.forEach(function (f) { form.append('files', f, f.name || ''); });
      if (category) { form.append('category', category); }
      var xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/assets/upload');
      xhr.setRequestHeader('RequestVerificationToken', csrf());
      xhr.setRequestHeader('Accept', 'application/json');
      xhr.upload.addEventListener('progress', function (e) { if (e.lengthComputable && onProgress) { onProgress(e.loaded / e.total); } });
      xhr.addEventListener('load', function () {
        var data = null;
        try { data = xhr.responseText ? JSON.parse(xhr.responseText) : null; } catch (e) { data = null; }
        data = data || {};
        if (xhr.status === 403) { resolve({ uploaded: [], errors: [{ fileName: '', error: 'Du darfst keine Dateien hochladen.' }] }); return; }
        var errors = data.errors && data.errors.length ? data.errors : (data.uploaded && data.uploaded.length ? [] : [{ fileName: '', error: data.error || 'Der Upload ist fehlgeschlagen.' }]);
        resolve({ uploaded: data.uploaded || [], errors: errors });
      });
      xhr.addEventListener('error', function () { resolve({ uploaded: [], errors: [{ fileName: '', error: 'Keine Verbindung: Die Dateien konnten nicht hochgeladen werden.' }] }); });
      xhr.send(form);
    });
  }

  function tabFor(options) {
    if (options.tab && TABS.some(function (t) { return t.id === options.tab; })) { return options.tab; }
    var c = String(options.category || '').toLowerCase();
    return CATEGORY_TAB[c] || 'uploads';
  }

  function pick(options, callback) {
    var o = options || {};
    var id = 'dt-media-' + (++counter);
    var state = { tab: tabFor(o), q: '', token: 0, items: [], loading: true, failed: false, uploading: false, done: false };
    var dlg = el('dialog', { class: 'mat-dialog mat-dialog--xl dt-media', 'data-static': '', 'aria-labelledby': id + '-t' });
    var close = el('button', { type: 'button', class: 'mat-btn mat-btn--ghost mat-btn--icon mat-dialog__close', 'aria-label': 'Schließen', 'data-dialog-close': '' }, icon('x'));
    var head = el('div', { class: 'mat-dialog__head' }, [icon('images'), el('h2', { class: 'mat-dialog__title', id: id + '-t', text: o.title || 'Bild wählen' }), close]);

    var tabs = el('div', { class: 'dt-media__tabs', role: 'tablist', 'aria-label': 'Bereiche der Bilder' });
    var tabButtons = TABS.map(function (t) {
      var b = el('button', { type: 'button', class: 'dt-media__tab', role: 'tab', id: id + '-tab-' + t.id, 'data-tab': t.id, 'aria-selected': 'false', text: t.label, tabindex: '-1' });
      b.addEventListener('click', function () { setTab(t.id, true); });
      b.addEventListener('keydown', function (ev) {
        var i = TABS.indexOf(t);
        var to = ev.key === 'ArrowRight' ? i + 1 : (ev.key === 'ArrowLeft' ? i - 1 : null);
        if (to === null) { return; }
        ev.preventDefault();
        var next = TABS[(to + TABS.length) % TABS.length];
        setTab(next.id, false);
        tabButtons[TABS.indexOf(next)].focus();
      });
      tabs.appendChild(b);
      return b;
    });
    var search = el('input', { type: 'search', class: 'mat-input dt-media__search', placeholder: 'Bilder suchen', 'aria-label': 'Bilder suchen', autocomplete: 'off' });
    var uploadBtn = el('button', { type: 'button', class: 'mat-btn mat-btn--secondary dt-media__upload' }, [icon('upload'), el('span', { text: 'Hochladen' })]);
    var tools = el('div', { class: 'dt-media__tools' }, [search, uploadBtn]);
    var status = el('p', { class: 'dt-media__status', role: 'status', 'aria-live': 'polite' });
    var grid = el('div', { class: 'dt-media__grid', role: 'listbox', 'aria-label': 'Bilder', 'data-media-grid': '' });
    var scroller = el('div', { class: 'dt-media__scroll' }, [grid, status]);
    var drop = el('div', { class: 'dt-media__drop', 'aria-hidden': 'true', hidden: true }, [icon('cloud-upload'), el('strong', { text: 'Zum Hochladen loslassen' })]);
    var area = el('div', { class: 'dt-media__area' }, [scroller, drop]);
    var body = el('div', { class: 'mat-dialog__body dt-media__body' }, [tabs, tools, area]);
    var cancel = el('button', { type: 'button', class: 'mat-btn mat-btn--secondary', 'data-dialog-close': '', text: 'Abbrechen' });
    var hint = el('span', { class: 'dt-media__hint', text: 'Klick wählt das Bild. Auch Ziehen und Strg+V laden hoch.' });
    var foot = el('div', { class: 'mat-dialog__foot' }, el('div', { class: 'mat-btn-row mat-btn-row--plain' }, [cancel, hint]));
    var form = el('div', { class: 'mat-dialog__form' }, [head, body, foot]);
    dlg.appendChild(form);
    document.body.appendChild(dlg);

    var finish = function (asset) {
      if (state.done) { return; }
      state.done = true;
      window.MatUi.dialog.close(dlg, asset ? 'pick' : 'cancel');
      if (asset && typeof callback === 'function') { setTimeout(function () { callback(String(asset.key).toLowerCase(), asset); }, 0); }
    };

    function draw() {
      grid.textContent = '';
      var t = TABS.find(function (x) { return x.id === state.tab; });
      status.hidden = !(state.loading || state.failed || !state.items.length);
      status.textContent = state.loading ? 'Bilder werden geladen …' : (state.failed ? 'Die Bilder konnten nicht geladen werden.' : (state.q ? 'Nichts gefunden.' : t.empty));
      if (state.uploading) { status.hidden = false; }
      state.items.forEach(function (a, i) {
        var tile = el('button', { type: 'button', class: 'dt-media__tile' + (o.current && String(o.current).toLowerCase() === a.key ? ' is-current' : ''), role: 'option', 'data-key': a.key, 'aria-selected': o.current && String(o.current).toLowerCase() === a.key ? 'true' : 'false', title: a.name + ' (' + a.key + ')', tabindex: i === 0 ? '0' : '-1' }, [
          el('span', { class: 'dt-media__thumb' }, el('img', { src: a.url, alt: '', loading: 'lazy', decoding: 'async', draggable: 'false' })),
          el('span', { class: 'dt-media__name', text: a.name }),
        ]);
        tile.addEventListener('click', function () { finish(a); });
        grid.appendChild(tile);
      });
      var current = grid.querySelector('.is-current');
      if (current) { grid.querySelectorAll('.dt-media__tile').forEach(function (x) { x.tabIndex = -1; }); current.tabIndex = 0; }
    }

    function load() {
      var t = TABS.find(function (x) { return x.id === state.tab; });
      var token = ++state.token;
      state.loading = true;
      state.failed = false;
      draw();
      var url = '/api/assets?take=300&' + t.query + (state.q ? '&q=' + encodeURIComponent(state.q) : '');
      fetch(url, { credentials: 'same-origin', headers: { Accept: 'application/json' } }).then(function (r) { if (!r.ok) { throw new Error('HTTP ' + r.status); } return r.json(); }).then(function (list) {
        if (token !== state.token) { return; }
        state.items = Array.isArray(list) ? list : [];
        state.loading = false;
        draw();
      }, function () { if (token !== state.token) { return; } state.items = []; state.loading = false; state.failed = true; draw(); });
    }

    function setTab(tabId, focusSearch) {
      state.tab = tabId;
      tabButtons.forEach(function (b) { var on = b.getAttribute('data-tab') === tabId; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; b.classList.toggle('is-active', on); });
      grid.setAttribute('aria-labelledby', id + '-tab-' + tabId);
      load();
      if (focusSearch === true) { /* keep the focus on the tab */ }
    }

    // ---- upload (button, drop, paste): one file is chosen at once, several are shown in "Uploads"
    function takeFiles(files) {
      var images = files.filter(isImage);
      if (!images.length) { toast('Das sind keine Bilder (PNG, JPG, GIF, WebP oder SVG).', 'warning'); return; }
      state.uploading = true;
      status.hidden = false;
      status.textContent = images.length + (images.length === 1 ? ' Datei wird' : ' Dateien werden') + ' hochgeladen …';
      upload(images, '', function (p) { status.textContent = images.length + (images.length === 1 ? ' Datei wird' : ' Dateien werden') + ' hochgeladen … ' + Math.round(p * 100) + ' %'; }).then(function (result) {
        state.uploading = false;
        result.errors.slice(0, 3).forEach(function (e) { toast((e.fileName ? '„' + e.fileName + '“: ' : '') + e.error, 'danger'); });
        if (!result.uploaded.length) { draw(); return; }
        if (result.uploaded.length === 1) { finish(result.uploaded[0]); return; }
        toast(result.uploaded.length + ' Bilder hochgeladen.', 'success');
        setTab('uploads');
      });
    }

    uploadBtn.addEventListener('click', function () {
      var input = el('input', { type: 'file', accept: 'image/png,image/jpeg,image/gif,image/webp,image/svg+xml,.png,.jpg,.jpeg,.gif,.webp,.svg', multiple: true, class: 'mat-sr-only', tabindex: '-1', 'aria-hidden': 'true' });
      dlg.appendChild(input);
      input.addEventListener('change', function () { var files = Array.prototype.slice.call(input.files); input.remove(); if (files.length) { takeFiles(files); } });
      input.addEventListener('cancel', function () { input.remove(); });
      input.click();
    });

    var hasFiles = function (ev) { var t = ev.dataTransfer && ev.dataTransfer.types; return !!t && Array.prototype.indexOf.call(t, 'Files') >= 0; };
    var depth = 0;
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(function (name) {
      dlg.addEventListener(name, function (ev) {
        if (!hasFiles(ev)) { return; }
        ev.preventDefault();
        ev.stopPropagation();
        if (name === 'dragenter') { depth++; drop.hidden = false; }
        else if (name === 'dragover') { if (ev.dataTransfer) { ev.dataTransfer.dropEffect = 'copy'; } drop.hidden = false; }
        else if (name === 'dragleave') { depth = Math.max(0, depth - 1); if (depth === 0) { drop.hidden = true; } }
        else { depth = 0; drop.hidden = true; takeFiles(Array.prototype.slice.call(ev.dataTransfer.files || [])); }
      });
    });

    var onPaste = function (ev) {
      var t = ev.target;
      if (t && t.tagName === 'INPUT' && t.type !== 'file' && !(ev.clipboardData && ev.clipboardData.files && ev.clipboardData.files.length)) { return; }
      var files = Array.prototype.slice.call((ev.clipboardData && ev.clipboardData.files) || []);
      if (!files.length) { return; }
      ev.preventDefault();
      ev.stopPropagation();
      takeFiles(files);
    };
    document.addEventListener('paste', onPaste, true);

    // ---- search
    var timer = 0;
    search.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(function () { state.q = search.value.trim(); load(); }, 250); });
    search.addEventListener('keydown', function (ev) {
      if (ev.key === 'ArrowDown') { var first = grid.querySelector('.dt-media__tile'); if (first) { ev.preventDefault(); first.focus(); } }
    });

    // ---- keyboard in the grid: arrows follow the visual rows
    grid.addEventListener('keydown', function (ev) {
      var tiles = Array.prototype.slice.call(grid.querySelectorAll('.dt-media__tile'));
      var i = tiles.indexOf(document.activeElement);
      if (i < 0) { return; }
      var columns = 1;
      for (var k = 1; k < tiles.length; k++) { if (tiles[k].offsetTop !== tiles[0].offsetTop) { break; } columns = k + 1; }
      var to = null;
      if (ev.key === 'ArrowRight') { to = i + 1; }
      else if (ev.key === 'ArrowLeft') { to = i - 1; }
      else if (ev.key === 'ArrowDown') { to = i + columns; }
      else if (ev.key === 'ArrowUp') { to = i - columns; if (to < 0) { search.focus(); ev.preventDefault(); return; } }
      else if (ev.key === 'Home') { to = 0; }
      else if (ev.key === 'End') { to = tiles.length - 1; }
      if (to === null) { return; }
      ev.preventDefault();
      to = Math.max(0, Math.min(tiles.length - 1, to));
      tiles[i].tabIndex = -1;
      tiles[to].tabIndex = 0;
      tiles[to].focus();
    });

    dlg.addEventListener('close', function () {
      document.removeEventListener('paste', onPaste, true);
      clearTimeout(timer);
      state.done = true;
      setTimeout(function () { dlg.remove(); }, 0);
    });
    form.addEventListener('submit', function (ev) { ev.preventDefault(); });

    window.MatUi.dialog.open(dlg);
    setTab(state.tab, false);
    return { close: function () { finish(null); } };
  }

  window.DtMedia = { pick: pick, upload: upload, tabs: TABS };
})();
