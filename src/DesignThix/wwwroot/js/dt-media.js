/* DesignThix media browser: ONE place to choose a picture, used everywhere an image is chosen (the editor: replace image, frame, background, every slot of an image strip, Beispielbild
   of a field; the brand page: logos; later the data list grid and the single print).
     window.DtMedia.pick({ title, tab, category, current }, callback)
   opens a dialog (a full-screen sheet on phones) with the tabs Uploads / Flaggen / Siegel / Logos / Deko / Alle, a search field, thumbnails (contain, on a checkerboard), an upload button, a
   drop zone (files dropped anywhere in the dialog) and paste (Ctrl+V while it is open). A click (or Enter on the focused thumbnail) chooses; the grid is keyboard navigable (arrows,
   Home, End). callback(key, asset) runs with the asset key (lower case, as designs hold it) and the asset { key, name, category, url, width, height, contentType }; it is not called when
   the dialog is cancelled. options.tab: 'uploads' | 'flags' | 'seals' | 'logos' | 'deko' | 'all'; options.category (a library category such as 'Logos' or 'Flaggen') picks the tab.
   options.allowNone adds a button "Kein Bild" (options.noneLabel): the callback then gets ('', null), so a caller that only wants a picture checks the asset. A category that has no tab of its own
   (a column of a data list asks for "Fotos") gets one.
   The tabs after "Alle" are the catalogues of plan 5 (docs/PLAN-CATALOGS.md): every catalogue with pictures that the administrator switched on (GET /api/catalogs) except Mitgeliefert and Uploads,
   which the first six tabs already show. The tab Deko (plan 6, the Deko pack of the app) has chips for its groups (the part of the name before " · ": Rahmen, Ornamente ...). A browsable catalogue shows its collections as chips and a first page, a search-only one a field with suggestion chips and "Gib einen Suchbegriff ein."
   Results come in pages (Mehr laden + IntersectionObserver). A click on a result of a catalogue IMPORTS it (POST /api/catalogs/{id}/import: into the area of the open design, else the personal area),
   shows a spinner on the tile, and then calls the callback like for any other image, so every place that picks an image gets the catalogues for free.
   window.DtMedia.upload(files, category) uploads files (POST /api/assets/upload) and resolves { uploaded, errors }. Nothing here builds HTML from data. */
(function () {
  'use strict';

  var TABS = [
    { id: 'uploads', label: 'Uploads', query: 'category=uploads&sort=new', empty: 'Noch keine Uploads. Lade Bilder hoch, ziehe sie hierher oder füge sie mit Strg+V ein.' },
    { id: 'flags', label: 'Flaggen', query: 'category=Flaggen', empty: 'Keine Flaggen gefunden.' },
    { id: 'seals', label: 'Siegel', query: 'category=Siegel', empty: 'Keine Siegel gefunden.' },
    { id: 'logos', label: 'Logos', query: 'category=Logos&sort=new', empty: 'Noch keine Logos. Lade ein Logo hoch und ordne es der Kategorie „Logos“ zu.' },
    { id: 'deko', label: 'Deko', query: 'category=Deko', groups: true, take: 500, empty: 'Keine Dekoration gefunden.' },
    { id: 'all', label: 'Alle', query: 'sort=new', empty: 'Nichts gefunden.' },
  ];
  var CATEGORY_TAB = { uploads: 'uploads', flaggen: 'flags', siegel: 'seals', logos: 'logos', deko: 'deko' };
  var IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg)$/i;
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var counter = 0;
  var LOCAL_CATALOGS = { builtin: true, uploads: true };
  var SUGGESTIONS = ['Natur', 'Essen', 'Büro', 'Hintergrund', 'Textur', 'Menschen'];
  var ORIENTATIONS = [['any', 'Alle Formate'], ['landscape', 'Querformat'], ['portrait', 'Hochformat'], ['square', 'Quadrat']];
  var COLOURS = [['any', 'Alle Farben'], ['red', 'Rot'], ['orange', 'Orange'], ['yellow', 'Gelb'], ['green', 'Grün'], ['turquoise', 'Türkis'], ['blue', 'Blau'], ['violet', 'Violett'], ['pink', 'Rosa'], ['brown', 'Braun'], ['black', 'Schwarz'], ['gray', 'Grau'], ['white', 'Weiß']];
  var catalogPromise = null;
  var catalogAt = 0;

  /** The catalogues the person may use (cached for a minute: the administrator may switch one on while the page is open). */
  function loadCatalogs() {
    if (!catalogPromise || Date.now() - catalogAt > 60000) {
      catalogAt = Date.now();
      catalogPromise = fetch('/api/catalogs', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
        .then(function (r) { if (!r.ok) { throw new Error('HTTP ' + r.status); } return r.json(); })
        .then(function (list) { return Array.isArray(list) ? list : []; })
        .catch(function () { catalogPromise = null; return []; });
    }
    return catalogPromise;
  }

  /** The catalogues that get a tab of their own: the ones with pictures that are not the two the first six tabs show. */
  function extraTabs(list) {
    return list.filter(function (c) { return c.hasPictures && !LOCAL_CATALOGS[c.id]; }).map(function (c) {
      return { id: 'cat-' + c.id, label: c.name, kind: 'catalog', catalog: c, empty: 'Hier gibt es noch nichts.' };
    });
  }

  function jsonOrNull(r) { return r.json().catch(function () { return null; }); }

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
      // the editor says which area the open design lives in: a new image goes there when the person may write in it (else into their own area)
      if (window.DtMedia && window.DtMedia.preferSpace) { form.append('preferSpace', String(window.DtMedia.preferSpace)); }
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

  /** The tabs of one dialog: the standard ones, plus one for a category the standard tabs do not know (a column of a data list that wants "Fotos"). */
  function tabsFor(options) {
    var c = String(options.category || '').trim();
    if (!c || CATEGORY_TAB[c.toLowerCase()]) { return TABS; }
    return TABS.concat([{ id: 'category', label: c, query: 'category=' + encodeURIComponent(c) + '&sort=new', empty: 'In der Kategorie „' + c + '“ gibt es noch nichts.' }]);
  }

  function tabFor(options, list) {
    if (options.tab && list.some(function (t) { return t.id === options.tab; })) { return options.tab; }
    var c = String(options.category || '').trim().toLowerCase();
    if (c && !CATEGORY_TAB[c] && list.some(function (t) { return t.id === 'category'; })) { return 'category'; }
    return CATEGORY_TAB[c] || 'uploads';
  }

  function pick(options, callback) {
    var o = options || {};
    var id = 'dt-media-' + (++counter);
    var TABLIST = tabsFor(o).slice();
    var state = { tab: tabFor(o, TABLIST), q: '', token: 0, items: [], loading: true, failed: false, uploading: false, done: false, page: 1, hasMore: false, collection: '', group: '', orientation: 'any', colour: 'any', error: '', message: '', importing: false };
    var dlg = el('dialog', { class: 'mat-dialog mat-dialog--xl dt-media', 'data-static': '', 'aria-labelledby': id + '-t' });
    var close = el('button', { type: 'button', class: 'mat-btn mat-btn--ghost mat-btn--icon mat-dialog__close', 'aria-label': 'Schließen', 'data-dialog-close': '' }, icon('x'));
    var head = el('div', { class: 'mat-dialog__head' }, [icon('images'), el('h2', { class: 'mat-dialog__title', id: id + '-t', text: o.title || 'Bild wählen' }), close]);

    var tabs = el('div', { class: 'dt-media__tabs', role: 'tablist', 'aria-label': 'Bereiche der Bilder' });
    var tabButtons = [];
    var addTabButton = function (t) {
      var b = el('button', { type: 'button', class: 'dt-media__tab', role: 'tab', id: id + '-tab-' + t.id, 'data-tab': t.id, 'aria-selected': 'false', text: t.label, tabindex: '-1' });
      b.addEventListener('click', function () { setTab(t.id, true); });
      b.addEventListener('keydown', function (ev) {
        var i = TABLIST.indexOf(t);
        var to = ev.key === 'ArrowRight' ? i + 1 : (ev.key === 'ArrowLeft' ? i - 1 : null);
        if (to === null) { return; }
        ev.preventDefault();
        var next = TABLIST[(to + TABLIST.length) % TABLIST.length];
        setTab(next.id, false);
        tabButtons[TABLIST.indexOf(next)].focus();
      });
      tabs.appendChild(b);
      tabButtons.push(b);
      return b;
    };
    TABLIST.forEach(addTabButton);
    var search = el('input', { type: 'search', class: 'mat-input dt-media__search', placeholder: 'Bilder suchen', 'aria-label': 'Bilder suchen', autocomplete: 'off' });
    var uploadBtn = el('button', { type: 'button', class: 'mat-btn mat-btn--secondary dt-media__upload' }, [icon('upload'), el('span', { text: 'Hochladen' })]);
    var tools = el('div', { class: 'dt-media__tools' }, [search, uploadBtn]);
    // the bar of a catalogue: the provider's link, the format filter, the collections or the suggestions (hidden on the first six tabs; the tab Deko uses the chips for its groups)
    var provider = el('a', { class: 'dt-media__provider', target: '_blank', rel: 'noopener noreferrer', hidden: true });
    // the format filter is only in the page while a catalogue that has one is shown (the library tabs have no dropdown)
    var orient = el('select', { class: 'mat-select dt-media__orient', 'aria-label': 'Format' }, ORIENTATIONS.map(function (p) { return el('option', { value: p[0], text: p[1] }); }));
    var colour = el('select', { class: 'mat-select dt-media__colour', 'aria-label': 'Farbe' }, COLOURS.map(function (p) { return el('option', { value: p[0], text: p[1] }); }));
    var chips = el('div', { class: 'dt-media__chips', role: 'group', 'aria-label': 'Sammlungen' });
    // what the provider's rules ask us to say next to its results (who the pictures are from, what the licence means)
    var notice = el('p', { class: 'dt-media__notice', hidden: true });
    var catbar = el('div', { class: 'dt-media__catbar', hidden: true }, [chips, provider, notice]);
    var status = el('p', { class: 'dt-media__status', role: 'status', 'aria-live': 'polite' });
    var grid = el('div', { class: 'dt-media__grid', role: 'listbox', 'aria-label': 'Bilder', 'data-media-grid': '' });
    var more = el('button', { type: 'button', class: 'mat-btn mat-btn--secondary dt-media__more', hidden: true, text: 'Mehr laden' });
    var scroller = el('div', { class: 'dt-media__scroll' }, [grid, status, more]);
    var drop = el('div', { class: 'dt-media__drop', 'aria-hidden': 'true', hidden: true }, [icon('cloud-upload'), el('strong', { text: 'Zum Hochladen loslassen' })]);
    var area = el('div', { class: 'dt-media__area' }, [scroller, drop]);
    var body = el('div', { class: 'mat-dialog__body dt-media__body' }, [tabs, tools, catbar, area]);
    var cancel = el('button', { type: 'button', class: 'mat-btn mat-btn--secondary', 'data-dialog-close': '', text: 'Abbrechen' });
    var hint = el('span', { class: 'dt-media__hint', text: 'Klick wählt das Bild. Auch Ziehen und Strg+V laden hoch.' });
    var none = o.allowNone ? el('button', { type: 'button', class: 'mat-btn mat-btn--ghost dt-media__none' }, [icon('x'), el('span', { text: o.noneLabel || 'Kein Bild' })]) : null;
    var foot = el('div', { class: 'mat-dialog__foot' }, el('div', { class: 'mat-btn-row mat-btn-row--plain' }, [cancel, none, hint]));
    var form = el('div', { class: 'mat-dialog__form' }, [head, body, foot]);
    dlg.appendChild(form);
    document.body.appendChild(dlg);

    var finish = function (asset) {
      if (state.done) { return; }
      state.done = true;
      window.MatUi.dialog.close(dlg, asset ? 'pick' : 'cancel');
      if (asset && typeof callback === 'function') { setTimeout(function () { callback(String(asset.key).toLowerCase(), asset); }, 0); }
    };

    if (none) {
      none.addEventListener('click', function () {
        if (state.done) { return; }
        state.done = true;
        window.MatUi.dialog.close(dlg, 'none');
        if (typeof callback === 'function') { setTimeout(function () { callback('', null); }, 0); }
      });
    }

    function currentTab() { return TABLIST.find(function (x) { return x.id === state.tab; }); }

    function creditOf(item) {
      var parts = [];
      if (item.author) { parts.push(item.author); }
      if (item.licence && item.licence.name) { parts.push(item.licence.name); }
      return parts.join(' · ');
    }

    /** The tile of one result of a catalogue; a click imports it. */
    function catalogTile(item, catalog, first) {
      var credit = creditOf(item);
      var label = (item.title || 'Bild') + (credit ? ' – ' + credit : '');
      var kids = [
        el('span', { class: 'dt-media__thumb' }, el('img', { src: item.thumb, alt: '', loading: 'lazy', decoding: 'async', draggable: 'false' })),
        el('span', { class: 'dt-media__name', text: item.title || 'Bild' }),
      ];
      if (credit) { kids.push(el('span', { class: 'dt-media__credit', text: credit })); }
      if (catalog.external) { kids.push(el('span', { class: 'dt-media__badge', text: catalog.name })); }
      var tile = el('button', { type: 'button', class: 'dt-media__tile dt-media__tile--item', role: 'option', 'data-item': item.id, 'data-catalog': catalog.id, 'data-key': item.assetKey || null, title: label, 'aria-label': label, 'aria-selected': 'false', tabindex: first ? '0' : '-1' }, kids);
      tile.addEventListener('click', function () { importItem(item, catalog, tile); });
      return tile;
    }

    function statusText(t) {
      if (state.loading && !state.items.length) { return 'Bilder werden geladen …'; }
      if (state.failed) { return state.error || 'Die Bilder konnten nicht geladen werden.'; }
      if (state.items.length) { return ''; }
      if (t.kind === 'catalog') {
        var c = t.catalog;
        if (!c.caps.browse && !state.q && !state.collection) { return state.message || 'Gib einen Suchbegriff ein.'; }
        return state.q ? 'Nichts gefunden.' : t.empty;
      }
      return state.q ? 'Nichts gefunden.' : t.empty;
    }

    /** The group of a Deko piece: the part of its name before " · " ("Rahmen · Goldene Ranke" is in "Rahmen"). */
    function groupOf(a) { var i = String(a.name || '').indexOf(' \u00b7 '); return i > 0 ? a.name.slice(0, i) : ''; }

    /** The items of the tab: all, or (tab Deko with a chosen group) the ones of that group. */
    function shownItems(t) { return t.groups && state.group ? state.items.filter(function (a) { return groupOf(a) === state.group; }) : state.items; }

    /** The chips of the groups of the tab Deko: "Alle" and one per group with its number of pieces. */
    function drawGroups() {
      var t = currentTab();
      if (!t || !t.groups) { return; }
      chips.textContent = '';
      chips.setAttribute('aria-label', 'Gruppen');
      var counts = {};
      var order = [];
      state.items.forEach(function (a) { var g = groupOf(a); if (g) { if (!counts[g]) { counts[g] = 0; order.push(g); } counts[g]++; } });
      if (state.group && !counts[state.group]) { state.group = ''; }
      var addChip = function (label, value) {
        var b = el('button', { type: 'button', class: 'dt-media__chip', 'aria-pressed': state.group === value ? 'true' : 'false', 'data-chip': value, text: label });
        b.addEventListener('click', function () { state.group = value; drawGroups(); draw(); });
        chips.appendChild(b);
      };
      addChip('Alle (' + state.items.length + ')', '');
      order.forEach(function (g) { addChip(g + ' (' + counts[g] + ')', g); });
      catbar.hidden = order.length < 2;
    }

    function draw() {
      grid.textContent = '';
      var t = currentTab();
      var text = statusText(t);
      status.hidden = !text;
      status.textContent = text;
      if (state.uploading) { status.hidden = false; }
      more.hidden = !(t.kind === 'catalog' && state.hasMore && !state.failed);
      more.disabled = state.loading;
      if (t.kind === 'catalog') {
        state.items.forEach(function (item, i) { grid.appendChild(catalogTile(item, t.catalog, i === 0)); });
        return;
      }
      shownItems(t).forEach(function (a, i) {
        var tile = el('button', { type: 'button', class: 'dt-media__tile' + (o.current && String(o.current).toLowerCase() === a.key ? ' is-current' : ''), role: 'option', 'data-key': a.key, 'aria-selected': o.current && String(o.current).toLowerCase() === a.key ? 'true' : 'false', title: a.name + ' (' + a.key + ')', tabindex: i === 0 ? '0' : '-1' }, [
          el('span', { class: 'dt-media__thumb' }, el('img', { src: a.url, alt: '', loading: 'lazy', decoding: 'async', draggable: 'false' })),
          el('span', { class: 'dt-media__name', text: t.groups && state.group && groupOf(a) === state.group ? a.name.slice(state.group.length + 3) : a.name }),
        ]);
        tile.addEventListener('click', function () { finish(a); });
        grid.appendChild(tile);
      });
      var current = grid.querySelector('.is-current');
      if (current) { grid.querySelectorAll('.dt-media__tile').forEach(function (x) { x.tabIndex = -1; }); current.tabIndex = 0; }
    }

    function load() {
      var t = currentTab();
      if (t.kind === 'catalog') { loadCatalog(t, false); return; }
      var token = ++state.token;
      state.loading = true;
      state.failed = false;
      state.hasMore = false;
      draw();
      var url = '/api/assets?take=' + (t.take || 300) + '&' + t.query + (state.q ? '&q=' + encodeURIComponent(state.q) : '');
      fetch(url, { credentials: 'same-origin', headers: { Accept: 'application/json' } }).then(function (r) { if (!r.ok) { throw new Error('HTTP ' + r.status); } return r.json(); }).then(function (list) {
        if (token !== state.token) { return; }
        state.items = Array.isArray(list) ? list : [];
        state.loading = false;
        drawGroups();
        draw();
      }, function () { if (token !== state.token) { return; } state.items = []; state.loading = false; state.failed = true; draw(); });
    }

    // ---- catalogues (plan 5): the bar, the pages of results, the import
    function drawBar(t) {
      var isCatalog = t.kind === 'catalog';
      catbar.hidden = !isCatalog;
      if (!isCatalog) { provider.hidden = true; notice.hidden = true; if (t.groups) { drawGroups(); } else { chips.textContent = ''; } }
      if (!isCatalog) { orient.remove(); colour.remove(); }
      search.placeholder = isCatalog ? t.catalog.name + ' durchsuchen' : 'Bilder suchen';
      search.setAttribute('aria-label', search.placeholder);
      if (!isCatalog) { return; }
      var c = t.catalog;
      provider.hidden = !c.provider;
      if (c.provider) { provider.href = c.provider.url; provider.textContent = c.provider.text; }
      notice.hidden = !c.notice;
      notice.textContent = c.notice || '';
      if (c.caps.filters) { catbar.insertBefore(orient, provider); orient.value = state.orientation; } else { orient.remove(); }
      if (c.caps.colour) { catbar.insertBefore(colour, provider); colour.value = state.colour; } else { colour.remove(); }
      chips.textContent = '';
      var addChip = function (label, value, pressed, onClick) {
        var b = el('button', { type: 'button', class: 'dt-media__chip', 'aria-pressed': pressed ? 'true' : 'false', 'data-chip': value, text: label });
        b.addEventListener('click', onClick);
        chips.appendChild(b);
      };
      if (c.caps.collections && t.collections && t.collections.length) {
        chips.setAttribute('aria-label', 'Sammlungen');
        addChip('Alle', '', !state.collection, function () { state.collection = ''; setTabState(); });
        t.collections.forEach(function (col) { addChip(col.name + (col.count != null ? ' (' + col.count + ')' : ''), col.id, state.collection === col.id, function () { state.collection = col.id; setTabState(); }); });
      } else if (!c.caps.browse) {
        chips.setAttribute('aria-label', 'Vorschläge');
        SUGGESTIONS.forEach(function (word) { addChip(word, word, state.q.toLowerCase() === word.toLowerCase(), function () { search.value = word; state.q = word; setTabState(); }); });
      }
    }

    function setTabState() { drawBar(currentTab()); load(); }

    function loadCollections(t) {
      if (!t.catalog.caps.collections || t.collections || t.collectionsLoading) { return; }
      t.collectionsLoading = true;
      fetch('/api/catalogs/' + encodeURIComponent(t.catalog.id) + '/collections', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
        .then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; })
        .then(function (list) { t.collections = Array.isArray(list) ? list : []; t.collectionsLoading = false; if (currentTab() === t) { drawBar(t); } });
    }

    function loadCatalog(t, append) {
      var c = t.catalog;
      var token = ++state.token;
      if (!append) { state.page = 1; state.items = []; state.hasMore = false; }
      state.failed = false;
      state.error = '';
      state.message = '';
      if (!c.caps.browse && !state.q && !state.collection) {
        // a search-only catalogue lists nothing until there are words: no request
        state.loading = false;
        draw();
        return;
      }
      state.loading = true;
      draw();
      var url = '/api/catalogs/' + encodeURIComponent(c.id) + '/search?page=' + state.page + '&perPage=30'
        + (state.q ? '&q=' + encodeURIComponent(state.q) : '') + (state.collection ? '&collection=' + encodeURIComponent(state.collection) : '')
        + (state.orientation !== 'any' ? '&orientation=' + state.orientation : '') + (c.caps.colour && state.colour !== 'any' ? '&colour=' + state.colour : '');
      fetch(url, { credentials: 'same-origin', headers: { Accept: 'application/json' } }).then(function (r) {
        return jsonOrNull(r).then(function (data) { return { ok: r.ok, status: r.status, data: data }; });
      }).then(function (res) {
        if (token !== state.token) { return; }
        state.loading = false;
        if (!res.ok || !res.data) {
          state.failed = true;
          state.error = (res.data && res.data.error) || (res.status === 404 ? 'Dieser Katalog ist nicht mehr da.' : 'Die Bilder konnten nicht geladen werden.');
          draw();
          return;
        }
        var items = (res.data.items || []);
        state.items = append ? state.items.concat(items) : items;
        state.hasMore = !!res.data.hasMore;
        state.message = res.data.message || '';
        draw();
      }, function () { if (token !== state.token) { return; } state.loading = false; state.failed = true; state.error = 'Keine Verbindung zum Server.'; draw(); });
    }

    function nextPage() {
      var t = currentTab();
      if (t.kind !== 'catalog' || !state.hasMore || state.loading) { return; }
      state.page += 1;
      loadCatalog(t, true);
    }

    function importItem(item, catalog, tile) {
      if (state.importing || state.done) { return; }
      state.importing = true;
      tile.classList.add('is-busy');
      tile.setAttribute('aria-busy', 'true');
      status.hidden = false;
      status.textContent = 'Das Bild wird übernommen …';
      var body = { itemId: item.id, preferSpace: window.DtMedia && window.DtMedia.preferSpace ? Number(window.DtMedia.preferSpace) : null };
      fetch('/api/catalogs/' + encodeURIComponent(catalog.id) + '/import', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', RequestVerificationToken: csrf() },
        body: JSON.stringify(body),
      }).then(function (r) { return jsonOrNull(r).then(function (data) { return { ok: r.ok, data: data }; }); }).then(function (res) {
        state.importing = false;
        tile.classList.remove('is-busy');
        tile.removeAttribute('aria-busy');
        if (!res.ok || !res.data || !res.data.key) {
          status.textContent = '';
          status.hidden = !statusText(currentTab());
          toast((res.data && res.data.error) || 'Das Bild konnte nicht übernommen werden.', 'danger');
          return;
        }
        finish(res.data);
      }, function () {
        state.importing = false;
        tile.classList.remove('is-busy');
        tile.removeAttribute('aria-busy');
        toast('Keine Verbindung: Das Bild konnte nicht übernommen werden.', 'warning');
      });
    }

    function setTab(tabId, focusSearch) {
      state.tab = tabId;
      state.collection = '';
      tabButtons.forEach(function (b) { var on = b.getAttribute('data-tab') === tabId; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; b.classList.toggle('is-active', on); });
      grid.setAttribute('aria-labelledby', id + '-tab-' + tabId);
      var t = currentTab();
      drawBar(t);
      if (t.kind === 'catalog') { loadCollections(t); }
      load();
      if (focusSearch === true) { /* keep the focus on the tab */ }
    }

    // the catalogues arrive a moment after the dialog opens: their tabs are added at the end (the first six tabs never move)
    loadCatalogs().then(function (list) {
      if (state.done) { return; }
      extraTabs(list).forEach(function (t) {
        if (TABLIST.some(function (x) { return x.id === t.id; })) { return; }
        TABLIST.push(t);
        addTabButton(t);
        if (o.tab === t.id) { setTab(t.id, false); }
      });
    });

    new IntersectionObserver(function (entries) { if (entries.some(function (e) { return e.isIntersecting; })) { nextPage(); } }, { root: scroller, rootMargin: '200px' }).observe(more);
    more.addEventListener('click', nextPage);
    orient.addEventListener('change', function () { state.orientation = orient.value; load(); });
    colour.addEventListener('change', function () { state.colour = colour.value; load(); });

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
    search.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(function () { state.q = search.value.trim(); var t = currentTab(); if (t.kind === 'catalog') { drawBar(t); } load(); }, 250); });
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

  window.DtMedia = { pick: pick, upload: upload, tabs: TABS, catalogs: loadCatalogs, preferSpace: null };
})();
