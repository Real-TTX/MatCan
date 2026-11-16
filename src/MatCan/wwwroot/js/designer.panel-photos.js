/* MatCan editor, part 10b: the panel "Fotos" and the Bildnachweise (plan 5, docs/PLAN-CATALOGS.md section 6).
   D.photos = { init(app, config), visible(), open() }: the rail entry "Fotos" appears when at least one catalogue with pictures is switched on besides Mitgeliefert and Uploads (those two have the panel
   Uploads and the media browser) and the person may edit. The panel searches ONE catalogue at a time (a chip per catalogue when there are several): a search field, the format filter where the
   catalogue has one, its collections (browsable) or suggestions (search-only), the provider's link, and tiles that behave like the tiles of Uploads: a click puts the picture on the page, a drag puts it
   where it is dropped (onto an image, frame or strip slot it replaces the source). A tile is IMPORTED first (POST /api/catalogs/{id}/import into the area of the design), with a spinner on it.
   D.credits = { open() }: the dialog "Bildnachweise" (Datei menu): every external source the design uses, with author, licence and links, and "Text kopieren".
   Everything the server says goes into the page through textContent; a link is only made for an address that starts with http:// or https://. */
(function () {
  'use strict';

  var D = window.DtDesigner;
  var LOCAL = { builtin: true, uploads: true };
  var SUGGESTIONS = ['Natur', 'Essen', 'Büro', 'Hintergrund', 'Textur', 'Menschen'];
  var ORIENTATIONS = [['any', 'Alle Formate'], ['landscape', 'Querformat'], ['portrait', 'Hochformat'], ['square', 'Quadrat']];
  var COLOURS = [['any', 'Alle Farben'], ['red', 'Rot'], ['orange', 'Orange'], ['yellow', 'Gelb'], ['green', 'Grün'], ['turquoise', 'Türkis'], ['blue', 'Blau'], ['violet', 'Violett'], ['pink', 'Rosa'], ['brown', 'Braun'], ['black', 'Schwarz'], ['gray', 'Grau'], ['white', 'Weiß']];

  var app = null;
  var catalogs = [];
  var state = { catalogId: '', q: '', collection: '', orientation: 'any', colour: 'any', items: [], page: 1, hasMore: false, loading: false, failed: false, error: '', message: '', token: 0, collections: {}, importing: false };

  function current() { return catalogs.find(function (c) { return c.id === state.catalogId; }) || catalogs[0] || null; }

  function safeHref(url) { return /^https?:\/\//i.test(String(url || '')) ? String(url) : ''; }

  function link(href, text, className) {
    var h = safeHref(href);
    if (!h) { return D.el('span', { class: className || null, text: text }); }
    return D.el('a', { href: h, target: '_blank', rel: 'noopener noreferrer', class: className || null, text: text });
  }

  // ================================================================================================ the panel

  D.panels.register({
    id: 'photos', title: 'Fotos', label: 'Fotos', icon: 'images', order: 45, hidden: true,
    build: function (host, api) {
      var theApp = api.app;
      var catalog = current();
      if (!catalog) {
        host.appendChild(D.el('p', { class: 'dt-empty', text: 'Es ist kein Katalog mit Fotos eingeschaltet.' }));
        return;
      }

      var canUse = theApp.editable();
      var timer = 0;
      var searchInput = D.el('input', { type: 'search', class: 'mat-input dt-psearch', placeholder: catalog.name + ' durchsuchen', 'aria-label': catalog.name + ' durchsuchen', autocomplete: 'off', value: state.q });
      var bar = D.el('div', { class: 'dt-pbar dt-pbar--stack' });
      var catRow = D.el('div', { class: 'dt-photos__cats', role: 'group', 'aria-label': 'Katalog' });
      var chips = D.el('div', { class: 'dt-photos__chips', role: 'group' });
      var orient = D.el('select', { class: 'mat-select dt-photos__orient', 'aria-label': 'Format' }, ORIENTATIONS.map(function (p) { return D.el('option', { value: p[0], text: p[1] }); }));
      var colour = D.el('select', { class: 'mat-select dt-photos__orient dt-photos__colour', 'aria-label': 'Farbe' }, COLOURS.map(function (p) { return D.el('option', { value: p[0], text: p[1] }); }));
      var providerRow = D.el('p', { class: 'dt-pnote dt-photos__provider' });
      var info = D.el('p', { class: 'dt-empty', role: 'status', 'aria-live': 'polite' });
      var grid = D.el('div', { class: 'dt-assetgrid dt-photos__grid', role: 'list' });
      var moreBtn = D.el('button', { type: 'button', class: 'mat-btn mat-btn--secondary mat-btn--sm dt-photos__more', hidden: true, text: 'Mehr laden' });

      if (catalogs.length > 1) {
        catalogs.forEach(function (c) {
          var b = D.el('button', { type: 'button', class: 'dt-photos__cat', 'data-catalog': c.id, 'aria-pressed': c.id === catalog.id ? 'true' : 'false', text: c.name });
          b.addEventListener('click', function () { choose(c.id); });
          catRow.appendChild(b);
        });
        bar.appendChild(catRow);
      }
      bar.appendChild(searchInput);
      if (catalog.caps.filters || catalog.caps.colour) {
        // the format and the colour side by side
        var filters = D.el('div', { class: 'dt-photos__filters' });
        if (catalog.caps.filters) { orient.value = state.orientation; filters.appendChild(orient); }
        if (catalog.caps.colour) { colour.value = state.colour; filters.appendChild(colour); }
        bar.appendChild(filters);
      }
      bar.appendChild(chips);
      host.appendChild(bar);
      if (catalog.provider) { providerRow.appendChild(link(catalog.provider.url, catalog.provider.text, 'dt-photos__providerlink')); host.appendChild(providerRow); }
      if (catalog.notice) { host.appendChild(D.el('p', { class: 'dt-pnote dt-photos__notice', text: catalog.notice })); }
      host.appendChild(info);
      host.appendChild(grid);
      host.appendChild(D.el('div', { class: 'dt-pbar' }, moreBtn));
      host.appendChild(D.el('p', { class: 'dt-pnote', text: 'Klicken setzt das Foto in die Seite, Ziehen setzt es an die Stelle. Was du benutzt, wird in die Bibliothek deines Bereichs übernommen; die Bildnachweise stehen unter Datei.' }));

      function choose(id) {
        state.catalogId = id;
        state.q = '';
        state.collection = '';
        state.orientation = 'any';
        state.colour = 'any';
        state.items = [];
        api.rebuild();
      }

      function drawChips() {
        D.empty(chips);
        var c = current();
        var add = function (label, value, pressed, onClick) {
          var b = D.el('button', { type: 'button', class: 'dt-photos__chip', 'data-chip': value, 'aria-pressed': pressed ? 'true' : 'false', text: label });
          b.addEventListener('click', onClick);
          chips.appendChild(b);
        };
        var cols = state.collections[c.id];
        if (c.caps.collections && cols && cols.length) {
          chips.setAttribute('aria-label', 'Sammlungen');
          add('Alle', '', !state.collection, function () { state.collection = ''; reload(); drawChips(); });
          cols.forEach(function (col) { add(col.name + (col.count != null ? ' (' + col.count + ')' : ''), col.id, state.collection === col.id, function () { state.collection = col.id; reload(); drawChips(); }); });
        } else if (!c.caps.browse) {
          chips.setAttribute('aria-label', 'Vorschläge');
          SUGGESTIONS.forEach(function (word) { add(word, word, state.q.toLowerCase() === word.toLowerCase(), function () { searchInput.value = word; state.q = word; reload(); drawChips(); }); });
        }
        chips.hidden = !chips.childNodes.length;
      }

      function statusText() {
        var c = current();
        if (state.loading && !state.items.length) { return 'Fotos werden geladen …'; }
        if (state.failed) { return state.error || 'Die Fotos konnten nicht geladen werden.'; }
        if (state.items.length) { return ''; }
        if (!c.caps.browse && !state.q && !state.collection) { return state.message || 'Gib einen Suchbegriff ein.'; }
        return state.q ? 'Nichts gefunden.' : 'Hier gibt es noch nichts.';
      }

      function draw() {
        D.empty(grid);
        var text = statusText();
        info.hidden = !text;
        info.textContent = text;
        moreBtn.hidden = !state.hasMore || state.failed;
        moreBtn.disabled = state.loading;
        var c = current();
        state.items.forEach(function (item) {
          var credit = [item.author, item.licence && item.licence.name].filter(Boolean).join(' · ');
          // a catalogue whose rules ask for links under every result (Unsplash): "Foto: Name / Unsplash", linked, under the tile (a link inside a button is no link)
          var linked = !!c.linkedCredit && !!item.author;
          var img = D.el('img', { src: item.thumb, alt: '', loading: 'lazy', decoding: 'async', draggable: 'false' });
          // shown from the provider's own address: no Referer, so the provider learns nothing of this installation
          if (/^https?:\/\//i.test(String(item.thumb || ''))) { img.referrerPolicy = 'no-referrer'; }
          var tile = D.el('button', { type: 'button', class: 'dt-asset dt-photo', title: (item.title || 'Foto') + (credit ? ' – ' + credit : ''), 'aria-label': (item.title || 'Foto') + (credit ? ' – ' + credit : ''), 'data-item': item.id, 'data-catalog': c.id, disabled: !canUse, role: linked ? null : 'listitem' }, [
            D.el('span', { class: 'dt-asset__thumb' }, img),
            D.el('span', { class: 'dt-asset__name', text: item.title || 'Foto' }),
            credit && !linked ? D.el('span', { class: 'dt-photo__credit', text: credit }) : null,
          ]);
          D.dnd.attach(tile, {
            ghost: function () { var g = D.el('img', { src: item.thumb, alt: '' }); g.referrerPolicy = 'no-referrer'; return g; },
            onClick: function () { use(item, c, tile, null, null); },
            onDrop: function (x, y) { use(item, c, tile, x, y); },
          });
          if (!linked) { grid.appendChild(tile); return; }
          var line = D.el('p', { class: 'dt-photo__attr' });
          line.appendChild(document.createTextNode('Foto: '));
          line.appendChild(link(item.authorUrl, item.author));
          line.appendChild(document.createTextNode(' / '));
          line.appendChild(c.provider ? link(c.provider.url, c.name) : document.createTextNode(c.name));
          grid.appendChild(D.el('div', { class: 'dt-photocell', role: 'listitem' }, [tile, line]));
        });
      }

      function fetchCollections() {
        var c = current();
        if (!c.caps.collections || state.collections[c.id]) { return; }
        D.request('GET', '/api/catalogs/' + encodeURIComponent(c.id) + '/collections').then(function (res) {
          state.collections[c.id] = res.ok && Array.isArray(res.data) ? res.data : [];
          if (current() === c) { drawChips(); }
        }, function () { state.collections[c.id] = []; });
      }

      function load(append) {
        var c = current();
        var token = ++state.token;
        if (!append) { state.page = 1; state.items = []; state.hasMore = false; }
        state.failed = false;
        state.error = '';
        state.message = '';
        if (!c.caps.browse && !state.q && !state.collection) { state.loading = false; draw(); return; }
        state.loading = true;
        draw();
        var url = '/api/catalogs/' + encodeURIComponent(c.id) + '/search?page=' + state.page + '&perPage=30'
          + (state.q ? '&q=' + encodeURIComponent(state.q) : '') + (state.collection ? '&collection=' + encodeURIComponent(state.collection) : '')
          + (state.orientation !== 'any' ? '&orientation=' + state.orientation : '') + (c.caps.colour && state.colour !== 'any' ? '&colour=' + state.colour : '');
        D.request('GET', url).then(function (res) {
          if (token !== state.token) { return; }
          state.loading = false;
          if (!res.ok || !res.data) {
            state.failed = true;
            state.error = (res.data && res.data.error) || 'Die Fotos konnten nicht geladen werden.';
            draw();
            return;
          }
          state.items = append ? state.items.concat(res.data.items || []) : (res.data.items || []);
          state.hasMore = !!res.data.hasMore;
          state.message = res.data.message || '';
          draw();
        }, function () { if (token !== state.token) { return; } state.loading = false; state.failed = true; state.error = 'Keine Verbindung.'; draw(); });
      }

      function reload() { load(false); }

      /** Imports the item into the library of the design's area, then puts it on the page (at a point when it was dropped). */
      function use(item, c, tile, x, y) {
        if (!theApp.editable() || state.importing) { return; }
        state.importing = true;
        tile.classList.add('is-busy');
        tile.setAttribute('aria-busy', 'true');
        D.request('POST', '/api/catalogs/' + encodeURIComponent(c.id) + '/import', { itemId: item.id, preferSpace: theApp.spaceId || null, designId: theApp.id }).then(function (res) {
          state.importing = false;
          tile.classList.remove('is-busy');
          tile.removeAttribute('aria-busy');
          if (!res.ok || !res.data || !res.data.key) {
            D.toast((res.data && res.data.error) || 'Das Foto konnte nicht übernommen werden.', 'danger');
            return;
          }
          var asset = res.data;
          theApp.addAssets([asset]);
          theApp.emit('uploaded', { assets: [asset] });
          if (x === null || x === undefined) { D.io.useAsset(asset); } else { D.canvas.dropAsset(asset, x, y); }
        }, function () {
          state.importing = false;
          tile.classList.remove('is-busy');
          tile.removeAttribute('aria-busy');
          D.toast('Keine Verbindung: Das Foto konnte nicht übernommen werden.', 'warning');
        });
      }

      searchInput.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(function () { state.q = searchInput.value.trim(); drawChips(); reload(); }, 250); });
      orient.addEventListener('change', function () { state.orientation = orient.value; reload(); });
      colour.addEventListener('change', function () { state.colour = colour.value; reload(); });
      moreBtn.addEventListener('click', function () { if (state.hasMore && !state.loading) { state.page += 1; load(true); } });
      new IntersectionObserver(function (entries) { if (entries.some(function (e) { return e.isIntersecting; }) && state.hasMore && !state.loading) { state.page += 1; load(true); } }, { root: host.closest('.dt-panel__body') || null, rootMargin: '200px' }).observe(moreBtn);
      api.cleanup(function () { clearTimeout(timer); });
      api.on('readonly', function () { api.rebuild(); });

      state.catalogId = catalog.id;
      drawChips();
      fetchCollections();
      draw();
      reload();
    },
  });

  D.photos = {
    init: function (theApp, config) {
      app = theApp;
      if (config && config.canEdit === false) { return Promise.resolve(); }
      return D.request('GET', '/api/catalogs').then(function (res) {
        catalogs = res.ok && Array.isArray(res.data) ? res.data.filter(function (c) { return c.hasPictures && !LOCAL[c.id]; }) : [];
        if (catalogs.length) { D.panels.setVisible('photos', true); }
      }, function () { /* offline: the entry stays hidden */ });
    },
    visible: function () { return catalogs.length > 0; },
    open: function () { D.panels.open('photos'); },
    state: function () { return { catalogs: catalogs.map(function (c) { return c.id; }), catalog: state.catalogId, items: state.items.length }; },
  };

  // ================================================================================================ Bildnachweise

  function creditText(items) {
    return items.map(function (c) {
      var line = c.attribution || ((c.title || c.name) + (c.author ? ' von ' + c.author : '') + ' auf ' + c.catalogName);
      var links = [c.sourceUrl, c.licence && c.licence.url].filter(function (u) { return safeHref(u); });
      return line + (links.length ? ' – ' + links.join(' ') : '');
    }).join('\n');
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return fallbackCopy(text); });
    }
    return Promise.resolve(fallbackCopy(text));
  }

  function fallbackCopy(text) {
    var area = D.el('textarea', { class: 'mat-sr-only', 'aria-hidden': 'true', tabindex: '-1' });
    area.value = text;
    document.body.appendChild(area);
    area.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    area.remove();
    return ok;
  }

  function openCredits() {
    var flush = D.save && D.save.flush ? D.save.flush() : Promise.resolve();
    return Promise.resolve(flush).catch(function () { }).then(function () { return D.request('GET', '/api/designs/' + app.id + '/credits'); }).then(function (res) {
      if (!res.ok) { D.toast('Die Bildnachweise konnten nicht geladen werden.', 'danger'); return null; }
      var items = (res.data && res.data.items) || [];
      return D.dialog.show({
        title: 'Bildnachweise', icon: 'images', size: 'lg', className: 'dt-credits',
        body: function (body) {
          if (!items.length) {
            body.appendChild(D.el('p', { class: 'mat-muted', text: 'Dieses Design benutzt keine Bilder aus externen Katalogen. Eigene Uploads und mitgelieferte Bilder brauchen keinen Nachweis.' }));
            return;
          }
          body.appendChild(D.el('p', { class: 'mat-muted', text: 'Diese Bilder kommen aus Katalogen. Wo ihre Lizenz es verlangt, gehört der Nachweis zum Design, wenn du es veröffentlichst.' }));
          var list = D.el('ul', { class: 'dt-credits__list', 'data-credits': '' });
          items.forEach(function (c) {
            var meta = [];
            if (c.author) { meta.push(c.authorUrl ? link(c.authorUrl, c.author) : D.el('span', { text: c.author })); }
            meta.push(c.catalogUrl ? link(c.catalogUrl, c.catalogName) : D.el('span', { text: c.catalogName }));
            if (c.licence && c.licence.name) { meta.push(c.licence.url ? link(c.licence.url, c.licence.name) : D.el('span', { text: c.licence.name })); }
            if (c.sourceUrl) { meta.push(link(c.sourceUrl, 'Quelle')); }
            var metaRow = D.el('span', { class: 'dt-credits__meta' });
            meta.forEach(function (node, i) { if (i) { metaRow.appendChild(document.createTextNode(' · ')); } metaRow.appendChild(node); });
            list.appendChild(D.el('li', { class: 'dt-credits__item', 'data-key': c.key }, [D.el('strong', { text: c.title || c.name }), metaRow]));
          });
          body.appendChild(list);
        },
        buttons: [
          { label: 'Text kopieren', kind: 'secondary', value: 'copy', keepOpen: true, disabled: !items.length, onClick: function () {
            copyText(creditText(items)).then(function (ok) { D.toast(ok ? 'Der Text ist kopiert.' : 'Das Kopieren hat nicht geklappt.', ok ? 'success' : 'warning'); });
            return false;
          } },
          { label: 'Schließen', kind: 'primary', value: 'ok' },
        ],
      });
    });
  }

  D.credits = { open: openCredits, text: creditText };
})();
