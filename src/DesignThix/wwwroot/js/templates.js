/* DesignThix: the gallery of templates (/Templates, plan 6, docs/PLAN-TEMPLATES.md section 2). The page is a shell; this script loads the families from GET /api/templates/gallery
   ({ total, templates, occasions, formats, families: [{ key, name, occasion, variants: [...] }] }) and builds one tile per family: the thumbnail of the shown variant (drawn by designs.js when it
   comes into view, three at a time), the family's name, small dots for the variants (a hover, focus or click shows that variant), "Ansehen" (the preview dialog with all pages: template-preview.js),
   "Vorlage verwenden" (a copy opens in the designer: create.js) and, where allowed, "Bearbeiten". The occasions are chips, the format a select, the search a field (250 ms debounce); the address
   keeps the state (?occasion=&format=&q=); more tiles come with an IntersectionObserver and a button. Names only through textContent. Needs dt-ui.js, dt-engine.js, designs.js, template-preview.js. */
(function () {
  'use strict';

  var root = document.querySelector('[data-gallery]');
  var U = window.DtUi;
  if (!root || !U) { return; }
  var el = U.el;

  var searchInput = root.querySelector('[data-gallery-search]');
  var formatSelect = root.querySelector('[data-gallery-format]');
  var chips = root.querySelector('[data-gallery-occasions]');
  var info = root.querySelector('[data-gallery-info]');
  var body = root.querySelector('[data-gallery-body]');
  var more = root.querySelector('[data-gallery-more]');
  var moreButton = root.querySelector('[data-gallery-load]');
  var empty = root.querySelector('[data-templates-empty]');
  var resetButton = root.querySelector('[data-gallery-reset]');
  var endpoint = root.getAttribute('data-endpoint');
  var PAGE = 24;

  var state = {
    q: root.getAttribute('data-start-q') || '',
    occasion: root.getAttribute('data-start-occasion') || '',
    format: root.getAttribute('data-start-format') || '',
    skip: 0, total: 0, loading: false, seq: 0, section: null, sectionName: null, occasions: [], families: [],
  };
  var observer = null;

  function filterParams() {
    var p = new URLSearchParams();
    if (state.q) { p.set('q', state.q); }
    if (state.occasion) { p.set('occasion', state.occasion); }
    if (state.format) { p.set('format', state.format); }
    return p;
  }

  function syncAddress() {
    var qs = filterParams().toString();
    try { history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '')); } catch (e) { /* the address stays as it is */ }
  }

  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

  // ---------------------------------------------------------------------------------------- filters

  function drawChips(occasions) {
    chips.textContent = '';
    var sum = occasions.reduce(function (n, o) { return n + o.count; }, 0);
    var items = [{ key: '', name: 'Alle', count: sum }].concat(occasions);
    items.forEach(function (o) {
      var b = el('button', { type: 'button', class: 'dt-chip' + (state.occasion === o.key ? ' is-active' : ''), 'data-occasion': o.key, 'aria-pressed': String(state.occasion === o.key) },
        [el('span', { text: o.name }), el('span', { class: 'dt-chip__count', text: String(o.count) })]);
      b.addEventListener('click', function () { state.occasion = o.key; reload(); });
      chips.appendChild(b);
    });
  }

  function drawFormats(formats) {
    var keep = state.format;
    formatSelect.textContent = '';
    formatSelect.appendChild(el('option', { value: '', text: 'Alle Formate' }));
    var groups = {};
    formats.forEach(function (f) {
      var g = f.group || 'Weitere';
      if (!groups[g]) { groups[g] = el('optgroup', { label: g }); formatSelect.appendChild(groups[g]); }
      groups[g].appendChild(el('option', { value: f.key, text: f.name + ' (' + f.count + ')' }));
    });
    if (keep && !formats.some(function (f) { return f.key === keep; })) { formatSelect.appendChild(el('option', { value: keep, text: keep })); }
    formatSelect.value = keep;
  }

  // ---------------------------------------------------------------------------------------- tiles

  function thumb(v) {
    if (v.thumbnailUrl) { return el('span', { class: 'dt-designthumb' }, el('img', { src: v.thumbnailUrl, alt: '', loading: 'lazy', decoding: 'async' })); }
    var box = el('span', { class: 'dt-designthumb', 'data-dt-preview': String(v.id), 'data-dt-preview-url': '/api/designs/' + v.id, 'aria-hidden': 'true' });
    if (window.DtPreviews) { window.DtPreviews.add(box); }
    return box;
  }

  function tile(family) {
    var variants = family.variants;
    var shown = 0;
    var boxes = {};
    var media = el('a', { class: 'mat-tile__media dt-tpl__media dt-tg__media', href: '/Designs/Create?template=' + variants[0].id, 'data-preview-template': String(variants[0].id), 'aria-label': 'Vorlage „' + label + '“ ansehen' });
    var badge = variants.length > 1 ? el('span', { class: 'dt-tg__badge', text: variants.length + ' Varianten' }) : null;
    var label = variants.length > 1 ? family.name : variants[0].name;
    var title = el('span', { class: 'dt-tile__title', text: label, title: label });
    var meta = el('span', { class: 'mat-tile__meta' });
    var dots = variants.length > 1 ? el('span', { class: 'dt-tg__dots', role: 'group', 'aria-label': 'Varianten von ' + family.name }) : null;
    var viewBtn = el('button', { type: 'button', class: 'mat-btn mat-btn--secondary mat-btn--sm', 'data-tile-preview': '' }, [U.icon('eye'), el('span', { text: 'Ansehen' })]);
    var useBtn = el('a', { class: 'mat-btn mat-btn--primary mat-btn--sm', href: '#', 'data-use-template': '' }, [U.icon('plus'), el('span', { text: 'Vorlage verwenden' })]);
    var editBtn = el('a', { class: 'mat-btn mat-btn--ghost mat-btn--sm', href: '#', 'data-tile-edit': '', hidden: true }, [U.icon('edit'), el('span', { text: 'Bearbeiten' })]);
    var article = el('article', { class: 'mat-tile dt-designtile dt-tpl dt-tg', 'data-family': family.key, 'data-variants': String(variants.length) }, [
      media, el('div', { class: 'mat-tile__body' }, [title, meta, dots]), el('div', { class: 'dt-tpl__actions' }, [viewBtn, useBtn, editBtn]),
    ]);
    if (badge) { media.appendChild(badge); }

    function show(i) {
      shown = i;
      var v = variants[i];
      if (!boxes[v.id]) { boxes[v.id] = thumb(v); boxes[v.id].classList.add('dt-tg__thumb'); media.insertBefore(boxes[v.id], badge); }
      Object.keys(boxes).forEach(function (k) { boxes[k].hidden = Number(k) !== v.id; });
      article.setAttribute('data-template', String(v.id));
      media.setAttribute('data-preview-template', String(v.id));
      media.setAttribute('href', '/Designs/Create?template=' + v.id);
      useBtn.setAttribute('data-use-template', String(v.id));
      useBtn.setAttribute('href', '/Designs/Create?template=' + v.id);
      useBtn.setAttribute('aria-label', 'Vorlage „' + v.name + '“ verwenden');
      editBtn.hidden = !v.canEdit;
      editBtn.setAttribute('href', '/Designs/' + v.id + '/Designer');
      editBtn.setAttribute('aria-label', 'Vorlage „' + v.name + '“ bearbeiten');
      meta.textContent = (v.variant && variants.length > 1 ? v.variant + ' · ' : '') + (v.formatName || v.size);
      if (dots) {
        Array.prototype.forEach.call(dots.children, function (d, k) { d.classList.toggle('is-active', k === i); d.setAttribute('aria-pressed', String(k === i)); });
      }
    }

    if (dots) {
      variants.forEach(function (v, i) {
        var label = v.variant || ('Variante ' + (i + 1));
        var d = el('button', { type: 'button', class: 'dt-tg__dot', 'data-variant-id': String(v.id), 'aria-label': label, title: label, 'aria-pressed': 'false' });
        d.addEventListener('click', function () { show(i); });
        d.addEventListener('mouseenter', function () { show(i); });
        d.addEventListener('focus', function () { show(i); });
        dots.appendChild(d);
      });
    }
    viewBtn.addEventListener('click', function () { if (window.DtTemplatePreview) { window.DtTemplatePreview.open(family, variants[shown].id); } });
    show(0);
    return article;
  }

  function sectionFor(family) {
    var name = state.occasion ? '' : (family.occasion || 'Weitere');
    if (state.section && state.sectionName === name) { return state.section; }
    var grid = el('div', { class: 'dt-tplgrid dt-tg__grid' });
    var section = el('section', { class: 'dt-category', 'data-category': name }, grid);
    if (name) {
      var facet = state.occasions.filter(function (o) { return o.name === name; })[0];
      var heading = el('h2', { class: 'dt-category__title', text: name }, facet ? el('span', { class: 'dt-category__count', text: String(facet.count) }) : null);
      section.insertBefore(heading, grid);
    }
    body.appendChild(section);
    state.section = grid;
    state.sectionName = name;
    return grid;
  }

  // ---------------------------------------------------------------------------------------- loading

  function load(reset) {
    if (state.loading) { return Promise.resolve(); }
    state.loading = true;
    var seq = state.seq;
    var skip = reset ? 0 : state.skip;
    var params = filterParams();
    if (skip) { params.set('skip', String(skip)); }
    params.set('take', String(PAGE));
    return U.get(endpoint + '?' + params.toString()).then(function (result) {
      state.loading = false;
      if (seq !== state.seq) { return; }
      if (!result.ok || !result.data) {
        info.textContent = 'Die Vorlagen konnten nicht geladen werden. Prüfe die Verbindung und lade die Seite neu.';
        return;
      }
      var data = result.data;
      if (reset) {
        state.occasions = data.occasions;
        drawChips(data.occasions);
        drawFormats(data.formats);
        body.textContent = '';
        state.section = null;
        state.sectionName = null;
        state.families = [];
      }
      data.families.forEach(function (f) { sectionFor(f).appendChild(tile(f)); state.families.push(f); });
      state.skip = skip + data.families.length;
      state.total = data.total;
      var filtered = state.q || state.occasion || state.format;
      info.textContent = data.total === 0 ? '' : (filtered ? plural(data.total, 'Vorlage', 'Vorlagen') + ' gefunden' : plural(data.total, 'Vorlage', 'Vorlagen') + ' in ' + plural(data.templates, 'Variante', 'Varianten'));
      empty.hidden = data.total !== 0;
      more.hidden = state.skip >= state.total;
      root.setAttribute('data-state', 'ready');
      root.setAttribute('data-count', String(state.skip));
      if (!more.hidden && observer) { observer.unobserve(more); observer.observe(more); }
    });
  }

  function reload() {
    state.seq++;
    state.loading = false;
    root.setAttribute('data-state', 'loading');
    syncAddress();
    return load(true);
  }

  if ('IntersectionObserver' in window) {
    observer = new IntersectionObserver(function (entries) {
      if (entries.some(function (e) { return e.isIntersecting; }) && !more.hidden) { load(false); }
    }, { rootMargin: '400px' });
    observer.observe(more);
  }
  moreButton.addEventListener('click', function () { load(false); });

  var timer = 0;
  searchInput.addEventListener('input', function () {
    clearTimeout(timer);
    timer = setTimeout(function () { state.q = searchInput.value.trim(); reload(); }, 250);
  });
  searchInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') { clearTimeout(timer); state.q = searchInput.value.trim(); reload(); } });
  formatSelect.addEventListener('change', function () { state.format = formatSelect.value; reload(); });
  resetButton.addEventListener('click', function () { state.q = ''; state.occasion = ''; state.format = ''; searchInput.value = ''; reload(); });

  window.DtGallery = { state: state, reload: reload };
  reload();
})();
