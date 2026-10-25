/* DesignThix: the file browser (docs/PLAN-PLATFORM.md section 1.2 to 1.4). ONE control for Projekte, the team areas, Freigegeben, Mit Stern, Papierkorb and the rows of the start page; the mode
   comes from the data attributes of <section data-browser> (see Pages/Shared/_Browser.cshtml and UiKit/BrowserView.cs). Several browsers on one page work (ids come from the id of the section).
   Items come from GET /api/items (scope, area, folder, kinds, search, sort, paging) and are drawn with DOM APIs; names only through textContent. What is built here:
   - a toolbar: "Neu" (Design, Ordner, Bilder hochladen, Datenliste), the filter by kind, the search, the sort, grid or list (remembered in localStorage, the list on a phone);
   - tiles of folders (colour, up to four pictures), designs (the saved picture or the engine, see designs.js), images (contain on a checkerboard), data lists and series outputs;
   - selection: the checkbox of a tile, Shift and Ctrl clicks, Strg+A, a bar "N ausgewählt" with Verschieben, Teilen, Mit Stern, In den Papierkorb; Escape and Entf work;
   - the menu of an item (right click, long press on a touch screen, the "⋯" button) through DtMenu; inline rename (F2); "Verschieben nach …" through DtMove;
   - dragging items onto a folder or onto a step of the path (pointer events on the document: the pointer is followed even when it leaves the tile); files dropped from the explorer are uploaded into the open folder;
   - the trash: Wiederherstellen, Endgültig löschen, Papierkorb leeren.
   Needs dt-ui.js and dt-menu.js (and movepicker.js for "Verschieben nach …"; designs.js for the thumbnails; share.js, when it is there, for "Teilen …"). */
(function () {
  'use strict';

  var U = window.DtUi;
  var el = U.el;
  var DRAG_FROM = 6;          // px the pointer has to move before a drag starts
  var HOLD_MS = 480;          // a long press on a touch screen opens the menu
  var VIEW_KEY = 'dt-browser-view';

  var KINDS = {
    folder: { label: 'Ordner', icon: 'folder' },
    design: { label: 'Design', icon: 'layers' },
    datalist: { label: 'Datenliste', icon: 'table' },
    outputjob: { label: 'Serienausgabe', icon: 'dt:printer' },
    asset: { label: 'Bild', icon: 'image' },
  };
  var CHIPS = [
    { id: '', label: 'Alle' }, { id: 'design', label: 'Designs' }, { id: 'folder', label: 'Ordner' },
    { id: 'asset', label: 'Bilder' }, { id: 'datalist', label: 'Datenlisten' }, { id: 'outputjob', label: 'Serienausgaben' },
  ];
  var SORTS = [
    { id: 'updated', label: 'Zuletzt geändert', desc: true }, { id: 'name', label: 'Name', desc: false }, { id: 'created', label: 'Erstellt', desc: true },
  ];
  var FOLDER_COLORS = [
    ['Standard', ''], ['Türkis', '#1fb3d6'], ['Blau', '#3b82f6'], ['Grün', '#22a06b'], ['Gelb', '#d9a406'], ['Orange', '#e8710a'], ['Rot', '#d64545'], ['Violett', '#8b5cf6'], ['Grau', '#6b7280'],
  ];

  function utc(value) {
    if (!value) { return null; }
    var text = String(value);
    return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(text) ? text : text + 'Z');
  }

  /** "gerade eben", "vor 5 Min.", "vor 3 Std.", "vor 2 Tagen", else the date. */
  function ago(value) {
    var d = utc(value);
    if (!d || isNaN(d.getTime())) { return ''; }
    var s = Math.max(0, (Date.now() - d.getTime()) / 1000);
    if (s < 60) { return 'gerade eben'; }
    if (s < 3600) { return 'vor ' + Math.floor(s / 60) + ' Min.'; }
    if (s < 86400) { return 'vor ' + Math.floor(s / 3600) + ' Std.'; }
    if (s < 86400 * 7) { var days = Math.floor(s / 86400); return days === 1 ? 'gestern' : 'vor ' + days + ' Tagen'; }
    return d.toLocaleDateString('de-DE');
  }

  function keyOf(item) { return item.kind + ':' + item.id; }

  function ask(message, options) {
    if (window.MatUi && window.MatUi.confirm) { return window.MatUi.confirm(message, options); }
    return Promise.resolve(window.confirm(message));
  }

  function prompt(message, options) {
    if (window.MatUi && window.MatUi.prompt) { return window.MatUi.prompt(message, options); }
    return Promise.resolve(window.prompt(message, options && options.value || ''));
  }

  function Browser(root) {
    var self = this;
    var data = root.dataset;
    var id = root.id || 'dt-browser';
    var cfg = {
      mode: data.mode || 'space', scope: data.scope || 'space',
      spaceId: data.spaceId ? Number(data.spaceId) : null, folderId: data.folderId ? Number(data.folderId) : null, folderName: data.folderName || '',
      baseUrl: data.baseUrl || '/Projekte', canCreate: data.canCreate === 'true', toolbar: data.toolbar !== 'false', compact: data.compact === 'true',
      take: Number(data.take) || 60, kinds: data.kinds || '', templates: data.templates !== 'false',
      emptyIcon: data.emptyIcon || 'folder-open', emptyTitle: data.emptyTitle || 'Hier ist noch nichts', emptyText: data.emptyText || '',
    };
    var spaces = [];
    try { spaces = JSON.parse(data.spaces || '[]'); } catch (e) { spaces = []; }
    var trash = cfg.mode === 'trash';
    var st = {
      items: [], total: 0, loading: false, failed: false, token: 0, kind: '', sort: 'updated', q: data.q || '', view: 'grid',
      selected: new Set(), anchor: null, tiles: new Map(), renaming: null, suppressUntil: 0, uploading: false,
    };
    self.state = st;

    // the remembered view; a phone starts with the list
    try { st.view = window.localStorage.getItem(VIEW_KEY) || ''; } catch (e) { st.view = ''; }
    if (st.view !== 'grid' && st.view !== 'list') { st.view = window.matchMedia('(max-width: 719px)').matches ? 'list' : 'grid'; }
    if (cfg.compact) { st.view = 'grid'; }

    // ------------------------------------------------------------------------------------------ places

    function spaceBase(spaceId) {
      var s = spaces.filter(function (x) { return x.id === spaceId; })[0];
      return s ? s.base : null;
    }

    function hrefOf(item) {
      if (trash) { return null; }
      switch (item.kind) {
        case 'folder': return (spaceBase(item.spaceId) || '/Freigegeben') + '/Ordner/' + item.id;
        case 'design': return '/Designs/' + item.id + '/Designer';
        case 'datalist': return '/DataLists/Edit/' + item.id;
        case 'outputjob': return '/Outputs/Edit/' + item.id;
        default: return '/Assets/Edit/' + item.id;
      }
    }

    function here() {
      return cfg.spaceId || cfg.folderId ? { spaceId: cfg.spaceId, folderId: cfg.folderId } : null;
    }

    // ------------------------------------------------------------------------------------------ the frame

    var dom = {};
    dom.grid = el('div', { class: 'dt-bgrid', role: 'list', 'aria-label': 'Elemente' });
    dom.status = el('p', { class: 'dt-bstatus', role: 'status', 'aria-live': 'polite' });
    dom.empty = el('div', { class: 'dt-bempty', hidden: true });
    dom.more = el('div', { class: 'dt-bmore', hidden: true });
    dom.moreButton = el('button', { type: 'button', class: 'mat-btn mat-btn--secondary', text: 'Mehr laden' });
    dom.more.appendChild(dom.moreButton);
    dom.drop = el('div', { class: 'dt-bdrop', 'aria-hidden': 'true', hidden: true }, [U.icon('dt:cloud-upload'), el('strong', { text: 'Zum Hochladen loslassen' }), el('span', { text: cfg.folderName ? 'in „' + cfg.folderName + '“' : 'in diesen Bereich' })]);
    dom.listHead = el('div', { class: 'dt-blisthead', 'aria-hidden': 'true' }, [
      el('span', { class: 'dt-blisthead__check' }), el('span', { class: 'dt-blisthead__media' }),
      el('span', { class: 'dt-blisthead__name', text: 'Name' }), el('span', { class: 'dt-blisthead__owner', text: trash ? 'Gelöscht von' : 'Besitzer' }), el('span', { class: 'dt-blisthead__when', text: trash ? 'Gelöscht' : 'Geändert' }),
    ]);

    function buildToolbar() {
      var bar = el('div', { class: 'dt-btool' });
      if (cfg.canCreate && !trash) {
        dom.neu = el('button', { type: 'button', class: 'mat-btn mat-btn--primary dt-btool__new', 'aria-haspopup': 'menu', 'aria-expanded': 'false', 'data-browser-new': '' }, [U.icon('plus'), el('span', { text: 'Neu' })]);
        dom.neu.addEventListener('click', function () { openNewMenu(dom.neu); });
        bar.appendChild(dom.neu);
      }

      var chips = el('div', { class: 'dt-btool__chips', role: 'group', 'aria-label': 'Nach Art filtern' });
      CHIPS.forEach(function (c) {
        if (cfg.mode === 'shared' && cfg.scope === 'shared' && c.id === 'asset') { return; }
        var b = el('button', { type: 'button', class: 'dt-chip' + (c.id === st.kind ? ' is-active' : ''), 'data-kind-filter': c.id, 'aria-pressed': String(c.id === st.kind), text: c.label });
        b.addEventListener('click', function () {
          st.kind = c.id;
          Array.prototype.forEach.call(chips.children, function (x) { var on = x.getAttribute('data-kind-filter') === c.id; x.classList.toggle('is-active', on); x.setAttribute('aria-pressed', String(on)); });
          reload();
        });
        chips.appendChild(b);
      });
      bar.appendChild(chips);

      var right = el('div', { class: 'dt-btool__right' });
      var searchBox = el('div', { class: 'mat-input-icon dt-btool__search' });
      searchBox.appendChild(U.icon('search'));
      dom.search = el('input', { class: 'mat-input', type: 'search', placeholder: cfg.folderId || cfg.spaceId ? 'In diesem Bereich suchen' : 'Suchen', 'aria-label': 'Suchen', autocomplete: 'off', enterkeyhint: 'search', maxlength: '100', value: st.q || null });
      var timer = 0;
      dom.search.addEventListener('input', function () {
        window.clearTimeout(timer);
        timer = window.setTimeout(function () { st.q = dom.search.value.trim(); reload(); }, 250);
      });
      searchBox.appendChild(dom.search);
      right.appendChild(searchBox);

      dom.sort = el('select', { class: 'mat-select mat-select--sm dt-btool__sort', 'aria-label': 'Sortieren nach' });
      SORTS.forEach(function (s) { dom.sort.appendChild(el('option', { value: s.id, text: s.label })); });
      dom.sort.addEventListener('change', function () { st.sort = dom.sort.value; reload(); });
      right.appendChild(dom.sort);

      var seg = el('div', { class: 'mat-seg dt-btool__view', role: 'group', 'aria-label': 'Ansicht' });
      [['grid', 'Kacheln', 'grid'], ['list', 'Liste', 'list']].forEach(function (v) {
        var b = el('button', { type: 'button', class: 'mat-seg__btn', 'data-view': v[0], 'aria-pressed': String(st.view === v[0]), 'aria-label': v[1], title: v[1] }, U.icon(v[2]));
        b.addEventListener('click', function () { setView(v[0], true); });
        seg.appendChild(b);
      });
      right.appendChild(seg);
      bar.appendChild(right);
      dom.viewButtons = seg;
      return bar;
    }

    function buildSelectionBar() {
      var bar = el('div', { class: 'dt-bsel', role: 'toolbar', 'aria-label': 'Auswahl', hidden: true });
      dom.selCount = el('span', { class: 'dt-bsel__count', 'aria-live': 'polite' });
      dom.selButtons = el('div', { class: 'dt-bsel__buttons' });
      var clear = el('button', { type: 'button', class: 'mat-btn mat-btn--ghost mat-btn--icon dt-bsel__clear', 'aria-label': 'Auswahl aufheben', title: 'Auswahl aufheben (Esc)' }, U.icon('x'));
      clear.addEventListener('click', function () { clearSelection(); });
      bar.appendChild(clear);
      bar.appendChild(dom.selCount);
      bar.appendChild(dom.selButtons);
      return bar;
    }

    // the bar of the selection takes the place of the toolbar (a zero-height sticky frame over it), so choosing something moves nothing
    if (!cfg.compact) {
      dom.selBar = buildSelectionBar();
      root.appendChild(el('div', { class: 'dt-bselwrap' }, dom.selBar));
    }

    if (cfg.toolbar) { dom.toolbar = buildToolbar(); root.appendChild(dom.toolbar); }
    if (!cfg.compact) { root.appendChild(dom.listHead); }
    root.appendChild(dom.grid);
    root.appendChild(dom.status);
    root.appendChild(dom.empty);
    root.appendChild(dom.more);
    root.appendChild(dom.drop);
    root.classList.add('is-' + st.view);
    root.setAttribute('data-view', st.view);

    function setView(view, remember) {
      st.view = view;
      root.classList.toggle('is-grid', view === 'grid');
      root.classList.toggle('is-list', view === 'list');
      root.setAttribute('data-view', view);
      if (remember) { try { window.localStorage.setItem(VIEW_KEY, view); } catch (e) { /* storage is off: the choice is for this page only */ } }
      if (dom.viewButtons) { Array.prototype.forEach.call(dom.viewButtons.children, function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-view') === view)); }); }
    }
    setView(st.view);

    // ------------------------------------------------------------------------------------------ loading

    function params(skip) {
      var p = new URLSearchParams();
      p.set('scope', cfg.scope);
      if (cfg.spaceId) { p.set('space', cfg.spaceId); }
      if (cfg.folderId) { p.set('folder', cfg.folderId); }
      var kinds = st.kind || cfg.kinds;
      if (kinds) { p.set('kinds', kinds); }
      if (st.q) { p.set('q', st.q); if (cfg.scope === 'space') { p.set('recursive', 'true'); } }
      var sort = SORTS.filter(function (s) { return s.id === st.sort; })[0] || SORTS[0];
      p.set('sort', sort.id);
      p.set('desc', String(sort.desc));
      if (!cfg.templates) { p.set('templates', 'false'); }
      p.set('skip', skip);
      p.set('take', cfg.take);
      return p.toString();
    }

    function load(append) {
      var token = ++st.token;
      st.loading = true;
      st.failed = false;
      drawStatus();
      var skip = append ? st.items.length : 0;
      return U.get('/api/items?' + params(skip)).then(function (result) {
        if (token !== st.token) { return; }
        st.loading = false;
        if (!result.ok || !result.data) { st.failed = true; if (!append) { st.items = []; st.total = 0; } render(); return; }
        var fresh = result.data.items || [];
        st.total = result.data.total || 0;
        st.items = append ? st.items.concat(fresh) : fresh;
        // a selection only holds what is still there
        var keys = new Set(st.items.map(keyOf));
        st.selected.forEach(function (k) { if (!keys.has(k)) { st.selected.delete(k); } });
        render();
      });
    }

    function reload() { return load(false); }
    self.reload = reload;

    // ------------------------------------------------------------------------------------------ drawing

    function drawStatus() {
      dom.status.hidden = !(st.loading || st.failed);
      dom.status.textContent = st.loading ? (st.items.length ? 'Mehr wird geladen …' : 'Wird geladen …') : (st.failed ? 'Die Elemente konnten nicht geladen werden.' : '');
      if (st.uploading) { dom.status.hidden = false; }
      root.setAttribute('data-state', st.loading ? 'loading' : (st.failed ? 'error' : 'ready'));
    }

    function render() {
      drawStatus();
      var keep = new Set(st.items.map(keyOf));
      st.tiles.forEach(function (tile, key) { if (!keep.has(key)) { st.tiles.delete(key); } });
      dom.grid.textContent = '';
      st.items.forEach(function (item) { dom.grid.appendChild(tileFor(item)); });
      root.setAttribute('data-count', String(st.items.length));
      root.setAttribute('data-total', String(st.total));
      dom.more.hidden = st.items.length >= st.total || st.loading;
      drawEmpty();
      drawSelection();
      var emptyButton = document.querySelector('[data-browser-empty-trash]');
      if (emptyButton && trash) { emptyButton.hidden = st.total === 0; }
    }

    function drawEmpty() {
      var none = !st.items.length && !st.loading && !st.failed;
      dom.empty.hidden = !none;
      dom.grid.hidden = !st.items.length;
      dom.listHead.hidden = !st.items.length;
      if (!none) { return; }
      dom.empty.textContent = '';
      var searching = !!st.q || !!st.kind;
      var wrap = el('div', { class: 'mat-empty' });
      wrap.appendChild(el('span', { class: 'mat-empty__icon' }, U.icon(searching ? 'search-x' : cfg.emptyIcon)));
      wrap.appendChild(el('div', { class: 'mat-empty__title', text: searching ? 'Nichts gefunden' : cfg.emptyTitle }));
      wrap.appendChild(el('p', { text: searching ? 'Passt zu deiner Suche oder dem Filter nichts? Setze beides zurück.' : cfg.emptyText }));
      var actions = el('div', { class: 'dt-bempty__actions' });
      if (searching) {
        var reset = el('button', { type: 'button', class: 'mat-btn mat-btn--secondary' }, [U.icon('x'), el('span', { text: 'Suche und Filter zurücksetzen' })]);
        reset.addEventListener('click', function () {
          st.q = ''; st.kind = '';
          if (dom.search) { dom.search.value = ''; }
          if (dom.toolbar) { Array.prototype.forEach.call(dom.toolbar.querySelectorAll('[data-kind-filter]'), function (x) { var on = x.getAttribute('data-kind-filter') === ''; x.classList.toggle('is-active', on); x.setAttribute('aria-pressed', String(on)); }); }
          reload();
        });
        actions.appendChild(reset);
      } else if (cfg.canCreate && cfg.mode !== 'recent') {
        var design = el('button', { type: 'button', class: 'mat-btn mat-btn--primary' }, [U.icon('plus'), el('span', { text: 'Design erstellen' })]);
        design.addEventListener('click', createDesign);
        var folder = el('button', { type: 'button', class: 'mat-btn mat-btn--secondary' }, [U.icon('dt:folder-plus'), el('span', { text: 'Ordner anlegen' })]);
        folder.addEventListener('click', createFolder);
        actions.appendChild(design);
        actions.appendChild(folder);
      } else if (cfg.mode === 'recent') {
        var browse = el('a', { class: 'mat-btn mat-btn--secondary', href: '/Projekte' }, [U.icon('folder'), el('span', { text: 'Zu deinen Projekten' })]);
        actions.appendChild(browse);
      }

      if (actions.children.length) { wrap.appendChild(actions); }
      dom.empty.appendChild(wrap);
    }

    // ------------------------------------------------------------------------------------------ tiles

    function folderMedia(item) {
      var box = el('span', { class: 'dt-bfolder' + (item.previews && item.previews.length ? ' has-previews' : '') });
      if (item.color) { box.style.setProperty('--dt-folder', item.color); }
      if (item.previews && item.previews.length) {
        var grid = el('span', { class: 'dt-bfolder__grid' });
        item.previews.slice(0, 4).forEach(function (src) { grid.appendChild(el('span', { class: 'dt-bfolder__pic' }, el('img', { src: src, alt: '', loading: 'lazy', decoding: 'async', draggable: 'false' }))); });
        box.appendChild(grid);
      }
      box.appendChild(U.icon(item.previews && item.previews.length ? 'folder' : 'folder', 'dt-bfolder__icon'));
      return box;
    }

    function media(item) {
      if (item.kind === 'folder') { return folderMedia(item); }
      if (item.kind === 'design') {
        if (item.thumbUrl) { return el('span', { class: 'dt-bpic' }, el('img', { src: item.thumbUrl, alt: '', loading: 'lazy', decoding: 'async', draggable: 'false' })); }
        // a design in the trash cannot be opened, so the engine has nothing to draw: a calm icon
        if (trash) { return el('span', { class: 'dt-bfact dt-bfact--design' }, U.icon('layers')); }
        var box = el('span', { class: 'dt-designthumb', 'data-dt-preview': 'b' + item.id, 'data-dt-preview-url': '/api/designs/' + item.id, 'aria-hidden': 'true' });
        window.setTimeout(function () { if (window.DtPreviews) { window.DtPreviews.add(box); } }, 0);
        return el('span', { class: 'dt-bpic dt-bpic--design' }, box);
      }
      if (item.kind === 'asset' && item.thumbUrl) { return el('span', { class: 'dt-bpic dt-bpic--asset' }, el('img', { src: item.thumbUrl, alt: '', loading: 'lazy', decoding: 'async', draggable: 'false' })); }
      var k = KINDS[item.kind] || KINDS.design;
      return el('span', { class: 'dt-bfact dt-bfact--' + item.kind }, U.icon(k.icon));
    }

    function metaOf(item) {
      var parts = [];
      var k = KINDS[item.kind];
      if (item.kind === 'folder') { parts.push('Ordner'); }
      else if (item.kind === 'design') { parts.push(item.isTemplate ? 'Vorlage' : (item.detail || 'Design')); }
      else { parts.push(item.detail || (k && k.label) || ''); }
      return parts.filter(Boolean).join(' · ');
    }

    function tileFor(item) {
      var key = keyOf(item);
      var cached = st.tiles.get(key);
      if (cached) { updateTileState(cached, item); return cached; }
      var tile = buildTile(item);
      st.tiles.set(key, tile);
      return tile;
    }

    function buildTile(item) {
      var href = hrefOf(item);
      var tile = el('div', { class: 'dt-bitem dt-bitem--' + item.kind, role: 'listitem', 'data-kind': item.kind, 'data-id': item.id, 'data-key': keyOf(item), 'data-name': item.name });
      tile._item = item;
      var check = el('input', { type: 'checkbox', class: 'dt-bitem__check', 'aria-label': '„' + item.name + '“ auswählen' });
      check.addEventListener('change', function () { toggle(item, check.checked); });
      if (!cfg.compact) { tile.appendChild(check); }
      var mediaLink = href ? el('a', { class: 'dt-bitem__media', href: href, tabindex: '-1', 'aria-hidden': 'true' }, media(item)) : el('span', { class: 'dt-bitem__media' }, media(item));
      tile.appendChild(mediaLink);
      var body = el('div', { class: 'dt-bitem__body' });
      var name = href ? el('a', { class: 'dt-bitem__name', href: href, title: item.name, text: item.name }) : el('span', { class: 'dt-bitem__name', title: item.name, text: item.name });
      var titleLine = el('div', { class: 'dt-bitem__title' }, name);
      titleLine.appendChild(el('span', { class: 'dt-bitem__star', title: 'Mit Stern markiert', hidden: !item.starred }, U.icon('star')));
      body.appendChild(titleLine);
      var meta = el('span', { class: 'dt-bitem__meta' });
      meta.appendChild(el('span', { class: 'dt-bitem__kind', text: metaOf(item) }));
      if (item.spaceName && (cfg.mode !== 'space' || cfg.scope !== 'space')) { meta.appendChild(el('span', { class: 'dt-bitem__area', text: item.spaceName })); }
      body.appendChild(meta);
      tile.appendChild(body);
      tile.appendChild(el('span', { class: 'dt-bitem__cell dt-bitem__cell--owner', text: item.owner || '' }));
      tile.appendChild(el('span', { class: 'dt-bitem__cell dt-bitem__cell--when', text: ago(trash ? item.trashed : item.updated) }));
      var more = el('button', { type: 'button', class: 'mat-btn mat-btn--ghost mat-btn--icon mat-btn--sm dt-bitem__more', 'aria-haspopup': 'menu', 'aria-expanded': 'false', 'aria-label': 'Aktionen für „' + item.name + '“', title: 'Aktionen' }, U.icon('more-horizontal'));
      tile.appendChild(more);
      updateTileState(tile, item);
      return tile;
    }

    function updateTileState(tile, item) {
      tile._item = item;
      var on = st.selected.has(keyOf(item));
      tile.classList.toggle('is-selected', on);
      var check = tile.querySelector('.dt-bitem__check');
      if (check) { check.checked = on; }
      var star = tile.querySelector('.dt-bitem__star');
      if (star) { star.hidden = !item.starred; }
    }

    function rebuildTile(item) {
      var key = keyOf(item);
      var old = st.tiles.get(key);
      st.tiles.delete(key);
      var fresh = tileFor(item);
      if (old && old.parentNode) { old.parentNode.replaceChild(fresh, old); }
      return fresh;
    }

    function itemOf(node) {
      var tile = node && node.closest ? node.closest('.dt-bitem') : null;
      return tile ? tile._item || null : null;
    }

    function itemByKey(key) { return st.items.filter(function (i) { return keyOf(i) === key; })[0] || null; }

    function selectedItems() { return st.items.filter(function (i) { return st.selected.has(keyOf(i)); }); }

    // ------------------------------------------------------------------------------------------ selection

    function drawSelection() {
      st.tiles.forEach(function (tile) { if (tile._item) { updateTileState(tile, tile._item); } });
      var chosen = selectedItems();
      root.classList.toggle('has-selection', chosen.length > 0);
      if (!dom.selBar) { return; }
      dom.selBar.hidden = chosen.length === 0;
      if (!chosen.length) { return; }
      dom.selCount.textContent = chosen.length + ' ausgewählt';
      dom.selButtons.textContent = '';
      var allManage = chosen.every(function (i) { return i.canManage; });
      var single = chosen.length === 1 ? chosen[0] : null;
      var add = function (label, icon, run, danger) {
        var b = el('button', { type: 'button', class: 'mat-btn mat-btn--ghost dt-bsel__btn' + (danger ? ' is-danger' : ''), 'data-sel-action': label, 'aria-label': label, title: label }, [U.icon(icon), el('span', { text: label })]);
        b.addEventListener('click', run);
        dom.selButtons.appendChild(b);
      };
      if (trash) {
        add('Wiederherstellen', 'restore', function () { restoreItems(chosen); });
        add('Endgültig löschen', 'trash', function () { purgeItems(chosen); }, true);
      } else {
        if (allManage) { add('Verschieben', 'dt:folder-input', function () { moveItems(chosen); }); }
        if (single && single.canEdit && single.kind !== 'asset') { add('Teilen', 'dt:share-2', function () { shareItem(single); }); }
        var allStarred = chosen.every(function (i) { return i.starred; });
        add(allStarred ? 'Stern entfernen' : 'Mit Stern', allStarred ? 'dt:star-off' : 'star', function () { starItems(chosen, !allStarred); });
        if (allManage) { add('In den Papierkorb', 'trash', function () { trashItems(chosen); }, true); }
      }

      add('Alle auswählen', 'dt:check-check', function () { selectAll(); });
    }

    function toggle(item, on, quiet) {
      var key = keyOf(item);
      var next = on === undefined ? !st.selected.has(key) : on;
      if (next) { st.selected.add(key); } else { st.selected.delete(key); }
      st.anchor = keyOf(item);
      if (!quiet) { drawSelection(); }
    }

    function rangeTo(item) {
      var from = st.items.findIndex(function (i) { return keyOf(i) === st.anchor; });
      var to = st.items.findIndex(function (i) { return keyOf(i) === keyOf(item); });
      if (from < 0) { toggle(item, true); return; }
      var lo = Math.min(from, to);
      var hi = Math.max(from, to);
      for (var i = lo; i <= hi; i++) { st.selected.add(keyOf(st.items[i])); }
      drawSelection();
    }

    function selectAll() {
      st.items.forEach(function (i) { st.selected.add(keyOf(i)); });
      drawSelection();
    }

    function clearSelection() { st.selected.clear(); st.anchor = null; drawSelection(); }

    // ------------------------------------------------------------------------------------------ actions

    function problem(result) { U.toast(U.problem(result), 'danger'); }

    function kindsOf(items) { return Array.from(new Set(items.map(function (i) { return i.kind; }))); }

    function refs(items) { return items.map(function (i) { return { kind: i.kind, id: i.id }; }); }

    function after(items, message) {
      if (message) { U.toast(message, 'success'); }
      clearSelection();
      refreshStorage();
      return reload();
    }

    function openItem(item) {
      var href = hrefOf(item);
      if (href) { window.location.assign(href); }
    }

    function shareItem(item) {
      if (window.DtShare && window.DtShare.open) { window.DtShare.open({ kind: item.kind, id: item.id, name: item.name }); }
      else { U.toast('Teilen kommt gleich.', 'info'); }
    }

    function moveItems(items) {
      var folders = items.filter(function (i) { return i.kind === 'folder'; }).map(function (i) { return i.id; });
      var first = items[0];
      if (!window.DtMove) { U.toast('Der Dialog „Verschieben nach …“ ist nicht geladen.', 'danger'); return; }
      window.DtMove.pick({ title: items.length === 1 ? '„' + first.name + '“ verschieben nach …' : items.length + ' Elemente verschieben nach …', kinds: kindsOf(items), exclude: folders, current: { spaceId: first.spaceId, folderId: first.folderId } }, function (spaceId, folderId) {
        moveTo(items, spaceId, folderId);
      });
    }

    function moveTo(items, spaceId, folderId) {
      return U.post('/api/items/move', { items: refs(items), spaceId: spaceId, folderId: folderId }).then(function (result) {
        if (!result.ok) { problem(result); return; }
        return after(items, items.length === 1 ? '„' + items[0].name + '“ wurde verschoben.' : items.length + ' Elemente wurden verschoben.');
      });
    }

    function duplicateItems(items) {
      return U.post('/api/items/duplicate', { items: refs(items) }).then(function (result) {
        if (!result.ok) { problem(result); return; }
        return after(items, items.length === 1 ? 'Kopie von „' + items[0].name + '“ erstellt.' : items.length + ' Kopien erstellt.');
      });
    }

    function starItems(items, on) {
      return Promise.all(items.map(function (i) { return U.post('/api/items/star', { kind: i.kind, id: i.id, on: on }); })).then(function (results) {
        var bad = results.filter(function (r) { return !r.ok; })[0];
        if (bad) { problem(bad); }
        if (cfg.scope === 'starred' && !on) { return after(items, null); }
        items.forEach(function (i) { i.starred = on; });
        drawSelection();
        U.toast(on ? (items.length === 1 ? '„' + items[0].name + '“ hat jetzt einen Stern.' : items.length + ' Elemente mit Stern markiert.') : 'Stern entfernt.', 'success');
      });
    }

    function trashItems(items) {
      return U.post('/api/items/trash', { items: refs(items) }).then(function (result) {
        if (!result.ok) { problem(result); return; }
        return after(items, items.length === 1 ? '„' + items[0].name + '“ liegt jetzt im Papierkorb.' : items.length + ' Elemente liegen jetzt im Papierkorb.');
      });
    }

    function restoreItems(items) {
      return U.post('/api/items/restore', { items: refs(items) }).then(function (result) {
        if (!result.ok) { problem(result); return; }
        return after(items, items.length === 1 ? '„' + items[0].name + '“ ist wieder da.' : items.length + ' Elemente sind wieder da.');
      });
    }

    function purgeItems(items) {
      var what = items.length === 1 ? '„' + items[0].name + '“' : items.length + ' Elemente';
      return ask(what + ' endgültig löschen? Das lässt sich nicht rückgängig machen.' + (items.some(function (i) { return i.kind === 'folder'; }) ? ' Der Inhalt der Ordner wird mit gelöscht.' : ''), { danger: true, ok: 'Endgültig löschen', cancel: 'Abbrechen', title: 'Endgültig löschen' }).then(function (ok) {
        if (!ok) { return; }
        return U.post('/api/items/purge', { items: refs(items) }).then(function (result) {
          if (!result.ok) { problem(result); return; }
          return after(items, what + ' wurde endgültig gelöscht.');
        });
      });
    }

    function emptyTrash() {
      return ask('Alles im Papierkorb endgültig löschen? Das lässt sich nicht rückgängig machen.', { danger: true, ok: 'Papierkorb leeren', cancel: 'Abbrechen', title: 'Papierkorb leeren' }).then(function (ok) {
        if (!ok) { return; }
        return U.post('/api/items/empty-trash', {}).then(function (result) {
          if (!result.ok) { problem(result); return; }
          return after([], 'Der Papierkorb ist leer.');
        });
      });
    }

    function recolor(item, color) {
      return U.post('/api/folders/' + item.id, { name: item.name, color: color }).then(function (result) {
        if (!result.ok) { problem(result); return; }
        item.color = color || null;
        rebuildTile(item);
      });
    }

    function download(item) {
      if (!item.thumbUrl) { return; }
      var a = el('a', { href: item.thumbUrl, download: (item.key || item.name) });
      document.body.appendChild(a);
      a.click();
      a.remove();
    }

    function startRename(item) {
      var tile = st.tiles.get(keyOf(item));
      if (!tile || st.renaming) { return; }
      var nameEl = tile.querySelector('.dt-bitem__name');
      var input = el('input', { class: 'mat-input mat-input--sm dt-bitem__rename', type: 'text', value: item.name, maxlength: '200', 'aria-label': 'Neuer Name' });
      st.renaming = input;
      nameEl.hidden = true;
      nameEl.parentNode.insertBefore(input, nameEl);
      input.focus();
      input.select();
      var done = false;
      function finish(commit) {
        if (done) { return; }
        done = true;
        st.renaming = null;
        var value = input.value.trim();
        input.remove();
        nameEl.hidden = false;
        if (!commit || !value || value === item.name) { return; }
        U.post('/api/items/rename', { kind: item.kind, id: item.id, name: value }).then(function (result) {
          if (!result.ok) { problem(result); return; }
          item.name = result.data && result.data.name ? result.data.name : value;
          rebuildTile(item);
          U.toast('Umbenannt: ' + item.name, 'success');
        });
      }
      input.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter') { ev.preventDefault(); finish(true); }
        else if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); finish(false); }
      });
      input.addEventListener('blur', function () { finish(true); });
    }

    function canRename(item) { return item.kind === 'folder' ? item.canManage : item.canEdit; }

    function itemMenu(item) {
      if (trash) {
        return [
          { label: 'Wiederherstellen', icon: 'restore', run: function () { restoreItems([item]); } },
          { type: 'separator' },
          { label: 'Endgültig löschen', icon: 'trash', danger: true, run: function () { purgeItems([item]); } },
        ];
      }

      return [
        { label: 'Öffnen', icon: 'external', run: function () { openItem(item); } },
        { label: 'Teilen …', icon: 'dt:share-2', hidden: !item.canEdit || item.kind === 'asset', run: function () { shareItem(item); } },
        { label: 'Umbenennen', icon: 'edit', shortcut: 'F2', hidden: !canRename(item), run: function () { startRename(item); } },
        { label: 'Verschieben nach …', icon: 'dt:folder-input', hidden: !item.canManage, run: function () { moveItems([item]); } },
        { label: 'Kopie erstellen', icon: 'copy', run: function () { duplicateItems([item]); } },
        { label: 'Farbe', icon: 'palette', hidden: item.kind !== 'folder' || !item.canManage, submenu: FOLDER_COLORS.map(function (c) { return { label: c[0], swatch: c[1] || '#9ca3af', checked: (item.color || '') === c[1], run: function () { recolor(item, c[1]); } }; }) },
        { label: item.starred ? 'Stern entfernen' : 'Mit Stern markieren', icon: item.starred ? 'dt:star-off' : 'star', run: function () { starItems([item], !item.starred); } },
        { label: 'Herunterladen', icon: 'download', hidden: item.kind !== 'asset', run: function () { download(item); } },
        { type: 'separator' },
        { label: 'In den Papierkorb', icon: 'trash', danger: true, shortcut: 'Entf', hidden: !item.canManage, run: function () { trashItems([item]); } },
      ];
    }

    function batchMenu(items) {
      var allManage = items.every(function (i) { return i.canManage; });
      var allStarred = items.every(function (i) { return i.starred; });
      if (trash) {
        return [
          { type: 'header', label: items.length + ' Elemente' },
          { label: 'Wiederherstellen', icon: 'restore', run: function () { restoreItems(items); } },
          { label: 'Endgültig löschen', icon: 'trash', danger: true, run: function () { purgeItems(items); } },
        ];
      }

      return [
        { type: 'header', label: items.length + ' Elemente' },
        { label: 'Verschieben nach …', icon: 'dt:folder-input', hidden: !allManage, run: function () { moveItems(items); } },
        { label: 'Kopie erstellen', icon: 'copy', run: function () { duplicateItems(items); } },
        { label: allStarred ? 'Stern entfernen' : 'Mit Stern markieren', icon: allStarred ? 'dt:star-off' : 'star', run: function () { starItems(items, !allStarred); } },
        { type: 'separator' },
        { label: 'In den Papierkorb', icon: 'trash', danger: true, hidden: !allManage, run: function () { trashItems(items); } },
      ];
    }

    function openMenuFor(item, at) {
      var chosen = selectedItems();
      var batch = chosen.length > 1 && st.selected.has(keyOf(item));
      var entries = batch ? batchMenu(chosen) : itemMenu(item);
      var options = at.anchor ? { anchor: at.anchor, align: 'end' } : { x: at.x, y: at.y };
      options.focusFirst = !!at.keyboard;
      window.DtMenu.open(entries, options);
    }

    // ------------------------------------------------------------------------------------------ new

    function createDesign() {
      if (window.DtCreate && window.DtCreate.open) { window.DtCreate.open(here() || { spaceId: cfg.spaceId, folderId: cfg.folderId }); }
      else { window.location.assign('/Designs/Create'); }
    }

    function createFolder() {
      prompt('Name des Ordners', { title: 'Neuer Ordner', value: '', ok: 'Anlegen' }).then(function (value) {
        var name = value === null || value === undefined ? '' : String(value).trim();
        if (!name) { return; }
        U.post('/api/folders', { spaceId: cfg.spaceId, parentId: cfg.folderId, name: name }).then(function (result) {
          if (!result.ok) { problem(result); return; }
          U.toast('Ordner „' + name + '“ angelegt.', 'success');
          reload();
        });
      });
    }

    function createList() {
      prompt('Name der Datenliste', { title: 'Neue Datenliste', value: '', ok: 'Anlegen' }).then(function (value) {
        var name = value === null || value === undefined ? '' : String(value).trim();
        if (!name) { return; }
        U.post('/api/items/new-datalist', { name: name, spaceId: cfg.spaceId, folderId: cfg.folderId }).then(function (result) {
          if (!result.ok) { problem(result); return; }
          window.location.assign(result.data.url);
        });
      });
    }

    function pickFiles() {
      var input = el('input', { type: 'file', accept: 'image/png,image/jpeg,image/gif,image/webp,image/svg+xml,.png,.jpg,.jpeg,.gif,.webp,.svg', multiple: true, class: 'mat-sr-only', tabindex: '-1', 'aria-hidden': 'true', 'data-browser-file': '' });
      root.appendChild(input);
      input.addEventListener('change', function () { var files = Array.prototype.slice.call(input.files); input.remove(); if (files.length) { uploadFiles(files, here()); } });
      input.addEventListener('cancel', function () { input.remove(); });
      input.click();
    }

    function openNewMenu(anchor) {
      window.DtMenu.open([
        { label: 'Design', icon: 'layers', run: createDesign },
        { label: 'Ordner', icon: 'dt:folder-plus', run: createFolder },
        { label: 'Bilder hochladen', icon: 'upload', run: pickFiles },
        { label: 'Datenliste', icon: 'table', run: createList },
      ], { anchor: anchor });
    }

    function uploadFiles(files, target) {
      var images = files.filter(function (f) { return /^image\//.test(f.type) || /\.(png|jpe?g|gif|webp|svg)$/i.test(f.name || ''); });
      if (!images.length) { U.toast('Das sind keine Bilder (PNG, JPG, GIF, WebP oder SVG).', 'warning'); return Promise.resolve(); }
      if (images.length < files.length) { U.toast((files.length - images.length) + ' Datei(en) übersprungen: Es sind keine Bilder.', 'warning'); }
      st.uploading = true;
      var label = U.plural(images.length, 'Bild wird', 'Bilder werden') + ' hochgeladen …';
      drawStatus();
      dom.status.textContent = label;
      return U.upload(images, target || { spaceId: cfg.spaceId, folderId: cfg.folderId }, function (p) { dom.status.textContent = label + ' ' + Math.round(p * 100) + ' %'; }).then(function (result) {
        st.uploading = false;
        result.errors.slice(0, 3).forEach(function (e) { U.toast((e.fileName ? '„' + e.fileName + '“: ' : '') + e.error, 'danger'); });
        if (result.uploaded.length) { U.toast(U.plural(result.uploaded.length, 'Bild', 'Bilder') + ' hochgeladen.', 'success'); }
        refreshStorage();
        return reload();
      });
    }
    self.uploadFiles = uploadFiles;

    // ------------------------------------------------------------------------------------------ storage

    function refreshStorage() {
      var box = document.querySelector('[data-storage]');
      if (!box || !cfg.spaceId) { return; }
      U.get('/api/spaces').then(function (result) {
        if (!result.ok || !Array.isArray(result.data)) { return; }
        var space = result.data.filter(function (s) { return s.id === cfg.spaceId; })[0];
        if (!space) { return; }
        var fmt = function (bytes) {
          if (bytes >= 1073741824) { return (bytes / 1073741824).toLocaleString('de-DE', { maximumFractionDigits: 1 }) + ' GB'; }
          if (bytes >= 1048576) { return (bytes / 1048576).toLocaleString('de-DE', { maximumFractionDigits: 1 }) + ' MB'; }
          if (bytes >= 1024) { return Math.round(bytes / 1024).toLocaleString('de-DE') + ' KB'; }
          return bytes + ' B';
        };
        var text = box.querySelector('.dt-storage__text');
        if (text) { text.textContent = ''; text.appendChild(el('strong', { text: fmt(space.usedBytes) })); text.appendChild(document.createTextNode(' von ' + fmt(space.quotaBytes))); }
        var fill = box.querySelector('.mat-meter__fill');
        if (fill) { fill.style.setProperty('--mat-meter', Math.min(100, Math.round(space.usedBytes / Math.max(1, space.quotaBytes) * 100)) + '%'); }
      });
    }

    // ------------------------------------------------------------------------------------------ clicks and keys

    root.addEventListener('click', function (ev) {
      if (Date.now() < st.suppressUntil) { ev.preventDefault(); ev.stopPropagation(); return; }
      var target = ev.target;
      if (!(target instanceof Element)) { return; }
      var more = target.closest('.dt-bitem__more');
      if (more) {
        ev.preventDefault();
        var item = itemOf(more);
        if (item) { openMenuFor(item, { anchor: more }); }
        return;
      }

      if (target.closest('.dt-bitem__check, .dt-bitem__rename')) { return; }
      var tile = target.closest('.dt-bitem');
      if (!tile || !tile._item) { return; }
      var one = tile._item;
      if (cfg.compact) { return; }
      var plain = !ev.shiftKey && !ev.ctrlKey && !ev.metaKey;
      if (ev.shiftKey) { ev.preventDefault(); rangeTo(one); return; }
      if (ev.ctrlKey || ev.metaKey) { ev.preventDefault(); toggle(one); return; }
      if (plain && (st.selected.size > 0 || trash)) {
        // with a selection (and in the trash, where nothing opens) a click chooses
        ev.preventDefault();
        toggle(one);
      }
    }, true);

    root.addEventListener('contextmenu', function (ev) {
      var tile = ev.target instanceof Element ? ev.target.closest('.dt-bitem') : null;
      if (!tile || !tile._item) { return; }
      if (ev.target.closest('.dt-bitem__rename')) { return; }
      ev.preventDefault();
      var item = tile._item;
      openMenuFor(item, { x: ev.clientX, y: ev.clientY });
    });

    document.addEventListener('keydown', function (ev) {
      if (!document.contains(root)) { return; }
      var t = ev.target;
      var typing = t instanceof Element && t.closest('input:not([type=checkbox]), textarea, select, [contenteditable=""], [contenteditable="true"]');
      if (typing || (window.DtMenu && window.DtMenu.isOpen()) || document.querySelector('dialog[open]')) { return; }
      var inside = root.contains(t) || t === document.body;
      if (!inside) { return; }
      var chosen = selectedItems();
      if (ev.key === 'Escape' && chosen.length) { clearSelection(); }
      else if ((ev.key === 'a' || ev.key === 'A') && (ev.ctrlKey || ev.metaKey) && !cfg.compact) { ev.preventDefault(); selectAll(); }
      else if (ev.key === 'Delete' && chosen.length && !trash && chosen.every(function (i) { return i.canManage; })) { ev.preventDefault(); trashItems(chosen); }
      else if (ev.key === 'Delete' && chosen.length && trash) { ev.preventDefault(); purgeItems(chosen); }
      else if (ev.key === 'F2' && chosen.length === 1 && canRename(chosen[0]) && !trash) { ev.preventDefault(); startRename(chosen[0]); }
      else if (ev.key === 'ContextMenu' || (ev.key === 'F10' && ev.shiftKey)) {
        var focused = t instanceof Element ? t.closest('.dt-bitem') : null;
        if (focused && focused._item) { ev.preventDefault(); var b = focused.querySelector('.dt-bitem__more'); openMenuFor(focused._item, { anchor: b, keyboard: true }); }
      }
    });

    // ------------------------------------------------------------------------------------------ paging

    dom.moreButton.addEventListener('click', function () { load(true); });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) { if (entry.isIntersecting && !st.loading && st.items.length < st.total && st.items.length > 0) { load(true); } });
      }, { rootMargin: '300px' }).observe(dom.more);
    }

    // ------------------------------------------------------------------------------------------ dragging items

    var drag = null;
    var hold = null;

    function scrollerOf(node) {
      for (var p = node.parentElement; p; p = p.parentElement) {
        var o = window.getComputedStyle(p).overflowY;
        if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight) { return p; }
      }
      return document.scrollingElement;
    }

    function dropTargetAt(x, y) {
      var node = document.elementFromPoint(x, y);
      if (!node) { return null; }
      var crumb = node.closest('[data-drop-space]');
      if (crumb) { return { node: crumb, spaceId: Number(crumb.getAttribute('data-drop-space')), folderId: crumb.getAttribute('data-drop-folder') ? Number(crumb.getAttribute('data-drop-folder')) : null }; }
      var tile = node.closest('.dt-bitem--folder');
      if (tile && tile._item && drag && drag.keys.indexOf(keyOf(tile._item)) < 0 && tile._item.canEdit) { return { node: tile, spaceId: tile._item.spaceId, folderId: tile._item.id }; }
      return null;
    }

    function setDropTarget(target) {
      if (drag.target && (!target || drag.target.node !== target.node)) { drag.target.node.classList.remove('is-drop'); }
      drag.target = target;
      if (target) { target.node.classList.add('is-drop'); }
    }

    function moveGhost(x, y) { drag.ghost.style.setProperty('transform', 'translate(' + Math.round(x + 14) + 'px, ' + Math.round(y + 14) + 'px)'); }

    function startDrag(ev) {
      var chosen = st.selected.has(keyOf(drag.item)) ? selectedItems() : [drag.item];
      if (!chosen.every(function (i) { return i.canManage; })) { endDrag(false); return; }
      drag.active = true;
      drag.items = chosen;
      drag.keys = chosen.map(keyOf);
      drag.scroller = scrollerOf(root);
      drag.ghost = el('div', { class: 'dt-bghost', 'aria-hidden': 'true' }, [U.icon((KINDS[drag.item.kind] || KINDS.design).icon), el('span', { class: 'dt-bghost__name', text: chosen.length === 1 ? drag.item.name : chosen.length + ' Elemente' })]);
      document.body.appendChild(drag.ghost);
      document.documentElement.classList.add('is-dt-dragging');
      chosen.forEach(function (i) { var t = st.tiles.get(keyOf(i)); if (t) { t.classList.add('is-dragged'); } });
      try { drag.tile.setPointerCapture(drag.pointerId); } catch (e) { /* the pointer is followed on the document anyway */ }
      moveGhost(ev.clientX, ev.clientY);
    }

    function onDragMove(ev) {
      if (!drag || ev.pointerId !== drag.pointerId) { return; }
      if (!drag.active) {
        if (Math.abs(ev.clientX - drag.x) < DRAG_FROM && Math.abs(ev.clientY - drag.y) < DRAG_FROM) { return; }
        startDrag(ev);
        if (!drag || !drag.active) { return; }
      }

      ev.preventDefault();
      moveGhost(ev.clientX, ev.clientY);
      setDropTarget(dropTargetAt(ev.clientX, ev.clientY));
      if (drag.scroller) {
        var edge = ev.clientY < 90 ? -16 : (ev.clientY > window.innerHeight - 90 ? 16 : 0);
        if (edge) { drag.scroller.scrollBy(0, edge); }
      }
    }

    function endDrag(drop) {
      if (!drag) { return; }
      var d = drag;
      drag = null;
      document.removeEventListener('pointermove', onDragMove, true);
      document.removeEventListener('pointerup', onDragUp, true);
      document.removeEventListener('pointercancel', onDragCancel, true);
      if (d.active) {
        st.suppressUntil = Date.now() + 350;
        if (d.ghost) { d.ghost.remove(); }
        document.documentElement.classList.remove('is-dt-dragging');
        d.items.forEach(function (i) { var t = st.tiles.get(keyOf(i)); if (t) { t.classList.remove('is-dragged'); } });
        if (d.target) { d.target.node.classList.remove('is-drop'); }
        try { d.tile.releasePointerCapture(d.pointerId); } catch (e) { /* already released */ }
        if (drop && d.target) { moveTo(d.items, d.target.spaceId, d.target.folderId); }
      }
    }

    function onDragUp(ev) { if (drag && ev.pointerId === drag.pointerId) { endDrag(true); } }

    function onDragCancel(ev) { if (drag && ev.pointerId === drag.pointerId) { endDrag(false); } }

    function cancelHold() { if (hold) { window.clearTimeout(hold.timer); document.removeEventListener('pointermove', hold.move, true); document.removeEventListener('pointerup', cancelHold, true); document.removeEventListener('pointercancel', cancelHold, true); hold = null; } }

    root.addEventListener('pointerdown', function (ev) {
      if (ev.button !== 0 || !(ev.target instanceof Element)) { return; }
      var tile = ev.target.closest('.dt-bitem');
      if (!tile || !tile._item || ev.target.closest('.dt-bitem__check, .dt-bitem__more, .dt-bitem__rename')) { return; }
      var item = tile._item;
      if (ev.pointerType === 'touch') {
        // a long press opens the menu of the item (a drag with a finger would be a scroll)
        cancelHold();
        var startX = ev.clientX;
        var startY = ev.clientY;
        hold = {
          move: function (e) { if (Math.abs(e.clientX - startX) > 10 || Math.abs(e.clientY - startY) > 10) { cancelHold(); } },
          timer: window.setTimeout(function () {
            cancelHold();
            st.suppressUntil = Date.now() + 700;
            openMenuFor(item, { x: startX, y: startY });
          }, HOLD_MS),
        };
        document.addEventListener('pointermove', hold.move, true);
        document.addEventListener('pointerup', cancelHold, true);
        document.addEventListener('pointercancel', cancelHold, true);
        return;
      }

      if (trash || cfg.compact || cfg.mode === 'recent' || cfg.mode === 'search') { return; }
      if (!item.canManage) { return; }
      drag = { pointerId: ev.pointerId, x: ev.clientX, y: ev.clientY, item: item, tile: tile, active: false, target: null };
      document.addEventListener('pointermove', onDragMove, true);
      document.addEventListener('pointerup', onDragUp, true);
      document.addEventListener('pointercancel', onDragCancel, true);
    });

    // text must not be selected and images must not start the browser's own drag
    root.addEventListener('dragstart', function (ev) { if (ev.target instanceof Element && ev.target.closest('.dt-bitem')) { ev.preventDefault(); } });

    // ------------------------------------------------------------------------------------------ files from the explorer

    if (cfg.canCreate && !trash && !cfg.compact) {
      var depth = 0;
      var hasFiles = function (ev) { var t = ev.dataTransfer && ev.dataTransfer.types; return !!t && Array.prototype.indexOf.call(t, 'Files') >= 0; };
      var folderUnder = function (ev) {
        var node = ev.target instanceof Element ? ev.target.closest('.dt-bitem--folder') : null;
        return node && node._item && node._item.canEdit ? node : null;
      };
      var mark = function (ev) {
        var folder = folderUnder(ev);
        dom.grid.querySelectorAll('.dt-bitem--folder.is-drop').forEach(function (n) { if (n !== folder) { n.classList.remove('is-drop'); } });
        if (folder) { folder.classList.add('is-drop'); }
        dom.drop.classList.toggle('is-over-folder', !!folder);
      };
      document.addEventListener('dragenter', function (ev) { if (!hasFiles(ev)) { return; } ev.preventDefault(); depth++; dom.drop.hidden = false; root.classList.add('is-dropping'); });
      document.addEventListener('dragover', function (ev) { if (!hasFiles(ev)) { return; } ev.preventDefault(); if (ev.dataTransfer) { ev.dataTransfer.dropEffect = 'copy'; } mark(ev); });
      document.addEventListener('dragleave', function (ev) { if (!hasFiles(ev)) { return; } depth = Math.max(0, depth - 1); if (depth === 0) { dom.drop.hidden = true; root.classList.remove('is-dropping'); mark({ target: document.body }); } });
      document.addEventListener('drop', function (ev) {
        if (!hasFiles(ev)) { return; }
        ev.preventDefault();
        depth = 0;
        var folder = folderUnder(ev);
        dom.drop.hidden = true;
        root.classList.remove('is-dropping');
        mark({ target: document.body });
        var files = Array.prototype.slice.call(ev.dataTransfer.files || []);
        if (!files.length) { return; }
        uploadFiles(files, folder ? { spaceId: folder._item.spaceId, folderId: folder._item.id } : here());
      });
    }

    // ------------------------------------------------------------------------------------------ header buttons of the page

    var shareFolder = document.querySelector('[data-browser-share-folder]');
    if (shareFolder && cfg.mode !== 'recent' && cfg.mode !== 'search') {
      shareFolder.addEventListener('click', function () { shareItem({ kind: 'folder', id: Number(shareFolder.getAttribute('data-share-id')), name: shareFolder.getAttribute('data-share-name') || '' }); });
    }

    var emptyButton = document.querySelector('[data-browser-empty-trash]');
    if (emptyButton && trash) { emptyButton.addEventListener('click', emptyTrash); }

    self.refreshSoon = function () { return reload(); };
    reload();
  }

  var browsers = [];
  Array.prototype.forEach.call(document.querySelectorAll('[data-browser]'), function (root) { browsers.push(new Browser(root)); });
  window.DtBrowser = { all: browsers, ago: ago };
})();
