/* DesignThix editor, part 8d: the panel "Vorlagen". The templates of /api/templates as tiles (a stored thumbnail, else the template drawn by the engine when the tile comes into view,
   three at a time), a search field and category chips. A click opens a dialog: "Aktuelle Seite ersetzen" (the first page of the template replaces the page you are on) or "Als neue Seite
   hinzufügen" (all pages of the template come after the current page). Both are one undo step; the fields of the template are added to the design. A template of another size or unit is
   scaled to fit and centred on the page (the dialog says so). D.templates = { list(), apply(template, mode) } is what the browser checks use. */
(function () {
  'use strict';

  var D = window.DtDesigner;
  var app = null;
  var templates = { list: null, loading: null, failed: false };
  var documents = new Map();

  function loadList() {
    if (templates.list) { return Promise.resolve(templates.list); }
    if (!templates.loading) {
      templates.loading = D.request('GET', '/api/templates').then(function (res) {
        templates.list = res.ok && Array.isArray(res.data) ? res.data : [];
        templates.failed = !res.ok;
        return templates.list;
      }, function () { templates.failed = true; templates.list = []; return templates.list; });
    }
    return templates.loading;
  }

  /** The normalised document of a template (cached). */
  function loadDocument(t) {
    if (!documents.has(t.id)) {
      documents.set(t.id, D.request('GET', '/api/designs/' + t.id).then(function (res) {
        if (!res.ok) { documents.delete(t.id); throw new Error('HTTP ' + res.status); }
        return window.DtEngine.normalize(res.data.document);
      }, function (err) { documents.delete(t.id); throw err; }));
    }
    return documents.get(t.id);
  }

  /** Unit factor and fit scale for putting a page of another size onto the current page. */
  function templateScale(src, dst) {
    var u = src.unit === dst.unit ? 1 : (dst.unit === 'px' ? 96 / 25.4 : 25.4 / 96);
    var s = Math.min(dst.width / (src.width * u), dst.height / (src.height * u));
    if (Math.abs(s - 1) < 0.001) { s = 1; }
    return { u: u, s: s, G: u * s, dx: (dst.width - src.width * u * s) / 2, dy: (dst.height - src.height * u * s) / 2 };
  }

  /** Applies the template: mode 'replace' = its first page replaces the current page, 'add' = all its pages come after the current page. */
  function applyTemplate(t, mode) {
    return loadDocument(t).then(function (src) {
      var pages = mode === 'replace' ? [src.pages[0]] : src.pages;
      if (mode === 'add' && app.doc.pages.length + pages.length > D.MAX_PAGES) { D.toast('Es passen höchstens ' + D.MAX_PAGES + ' Seiten in ein Design.', 'warning'); return false; }
      var sc = templateScale(src, app.doc);
      var makePageId = D.pageIdMaker(app.doc);
      var made = [];
      var nextId = D.idMaker(app.doc);
      pages.forEach(function (p) {
        var copy = D.clone(p);
        copy.id = makePageId();
        copy.elements = D.cloneNodes(copy.elements, nextId, 0, 0);
        if (sc.G !== 1 || sc.s !== 1) { D.scaleNodes(copy.elements, sc.G, sc.s); }
        if (sc.dx || sc.dy) { copy.elements.forEach(function (n) { D.translate(n, sc.dx, sc.dy); }); }
        made.push(copy);
      });
      var at = app.pageIndex;
      app.edit(function (doc) {
        src.fields.forEach(function (f) { if (!D.fieldByKey(doc, f.key)) { doc.fields.push(D.clone(f)); } });
        if (mode === 'replace') {
          var keep = doc.pages[at];
          made[0].id = keep.id;
          made[0].name = keep.name;
          doc.pages[at] = made[0];
        } else {
          doc.pages.splice.apply(doc.pages, [at + 1, 0].concat(made));
          app.pageIndex = at + 1;
        }
        app.sel = [];
      }, { structure: true, reason: 'template' });
      app.emit('pages');
      app.emit('page');
      app.emit('selection');
      D.toast(mode === 'replace' ? 'Die Vorlage ersetzt diese Seite.' : (made.length > 1 ? 'Die Vorlage ist als ' + made.length + ' neue Seiten da.' : 'Die Vorlage ist als neue Seite da.'), 'success');
      return true;
    }, function () { D.toast('Die Vorlage konnte nicht geladen werden (Verbindung prüfen).', 'warning'); return false; });
  }

  // ---------------------------------------------------------------------------------------- previews

  var running = 0;
  var waiting = [];
  var LIMIT = 3;

  function pump() {
    while (running < LIMIT && waiting.length) {
      var job = waiting.shift();
      running++;
      job().then(function () { running--; pump(); }, function () { running--; pump(); });
    }
  }

  /** Draws the template into `box` with the engine (the box follows the aspect ratio of the page through --dt-ar). */
  function drawPreview(box, t) {
    return loadDocument(t).then(function (doc) {
      box.style.setProperty('--dt-ar', doc.width + ' / ' + doc.height);
      return window.DtEngine.renderInto(box, doc, window.DtEngine.sampleValues(doc), {
        mode: 'output', assetUrl: app.assetUrl, fonts: app.fonts, icon: D.icons.body, idPrefix: 'tp' + t.id + '-' + Math.floor(Math.random() * 1e6) + '-',
      });
    }).then(function () { box.classList.add('is-ready'); }, function () { box.classList.add('is-failed'); box.appendChild(D.icon('layers')); });
  }

  function queuePreview(box, t) { waiting.push(function () { return drawPreview(box, t); }); pump(); }

  // ---------------------------------------------------------------------------------------- the dialog

  function templateDialog(t) {
    return loadDocument(t).then(function (src) { return src; }, function () { return null; }).then(function (src) {
      if (!src) { D.toast('Die Vorlage konnte nicht geladen werden (Verbindung prüfen).', 'warning'); return false; }
      var hasContent = app.elements().length > 0;
      var sc = templateScale(src, app.doc);
      var sizeNote = sc.G === 1 && sc.dx === 0 && sc.dy === 0 ? null : 'Die Vorlage ist ' + t.size + ', deine Seite ' + D.round(app.doc.width, 1) + ' × ' + D.round(app.doc.height, 1) + ' ' + D.unitLabel(app.doc.unit) + ': sie wird passend skaliert und mittig platziert.';
      var pageNote = src.pages.length > 1 ? 'Die Vorlage hat ' + src.pages.length + ' Seiten. „Als neue Seite hinzufügen“ fügt alle ein, „Aktuelle Seite ersetzen“ nimmt nur die erste.' : null;
      return D.dialog.show({
        title: 'Vorlage „' + t.name + '“', icon: 'layout-template', size: 'lg', className: 'dt-tpldlg',
        body: function (body) {
          var box = D.el('div', { class: 'dt-tpldlg__preview' });
          body.appendChild(box);
          drawPreview(box, t);
          var text = D.el('div', { class: 'dt-tpldlg__text' });
          text.appendChild(D.el('p', { text: 'Wie möchtest du die Vorlage verwenden?' }));
          if (sizeNote) { text.appendChild(D.el('p', { class: 'mat-muted', text: sizeNote })); }
          if (pageNote) { text.appendChild(D.el('p', { class: 'mat-muted', text: pageNote })); }
          if (hasContent) { text.appendChild(D.el('p', { class: 'mat-muted', text: '„Aktuelle Seite ersetzen“ löscht den Inhalt dieser Seite (mit Rückgängig holst du ihn zurück).' })); }
          body.appendChild(text);
          body.classList.add('dt-tpldlg__body');
        },
        buttons: [
          { label: 'Als neue Seite hinzufügen', kind: 'primary', value: 'add' },
          { label: 'Aktuelle Seite ersetzen', kind: 'secondary', value: 'replace' },
          { label: 'Abbrechen', kind: 'secondary', value: 'cancel', spacer: true },
        ],
      }).then(function (v) { if (v === 'add' || v === 'replace') { return applyTemplate(t, v); } return false; });
    });
  }

  // ---------------------------------------------------------------------------------------- the panel

  D.panels.register({
    id: 'templates', title: 'Vorlagen', label: 'Vorlagen', icon: 'layout-template', order: 10,
    build: function (host, api) {
      app = api.app;
      var state = { q: '', category: '' };
      var search = D.el('input', { type: 'search', class: 'mat-input dt-psearch', placeholder: 'Vorlagen suchen', 'aria-label': 'Vorlagen suchen', autocomplete: 'off' });
      var chips = D.el('div', { class: 'dt-tplchips', role: 'group', 'aria-label': 'Kategorie' });
      host.appendChild(D.el('div', { class: 'dt-pbar' }, [search, chips]));
      var grid = D.el('div', { class: 'dt-tpl' });
      host.appendChild(grid);
      var observer = null;
      var token = 0;

      var drawChips = function (list) {
        D.empty(chips);
        var cats = [];
        list.forEach(function (t) { if (t.category && cats.indexOf(t.category) < 0) { cats.push(t.category); } });
        chips.hidden = cats.length < 2;
        ['Alle'].concat(cats).forEach(function (c) {
          var value = c === 'Alle' ? '' : c;
          var b = D.el('button', { type: 'button', class: 'dt-chipbtn', 'data-category': value, text: c, 'aria-pressed': String(state.category === value) });
          b.addEventListener('click', function () { state.category = value; drawChips(list); draw(); });
          chips.appendChild(b);
        });
      };

      var draw = function () {
        token++;
        if (observer) { observer.disconnect(); observer = null; }
        waiting = [];
        D.empty(grid);
        var list = templates.list;
        if (!list) { grid.appendChild(D.el('p', { class: 'dt-empty', text: 'Vorlagen werden geladen …' })); return; }
        var q = D.fold(state.q).trim();
        var items = list.filter(function (t) { return (!state.category || t.category === state.category) && (!q || D.fold(t.name + ' ' + (t.category || '') + ' ' + (t.description || '')).indexOf(q) >= 0); });
        if (!items.length) { grid.appendChild(D.el('p', { class: 'dt-empty', text: templates.failed ? 'Die Vorlagen konnten nicht geladen werden.' : (q || state.category ? 'Nichts gefunden.' : 'Es gibt noch keine Vorlagen. Markiere ein Design in den Eigenschaften als Vorlage.') })); return; }
        if ('IntersectionObserver' in window) {
          observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) { if (entry.isIntersecting) { observer.unobserve(entry.target); var t = entry.target._template; if (t) { queuePreview(entry.target, t); } } });
          }, { rootMargin: '160px' });
        }
        items.forEach(function (t) {
          var box = D.el('span', { class: 'dt-tpl__thumb', 'data-dt-preview': String(t.id) });
          box._template = t;
          if (t.thumbnailUrl) { box.appendChild(D.el('img', { src: t.thumbnailUrl, alt: '', loading: 'lazy', draggable: 'false' })); box.classList.add('is-ready'); }
          else if (observer) { observer.observe(box); } else { queuePreview(box, t); }
          var b = D.el('button', { type: 'button', class: 'dt-tpl__item', title: t.name + ' (' + t.size + ')', 'data-template': t.id, disabled: !app.editable() }, [
            box, D.el('span', { class: 'dt-tpl__name', text: t.name }), D.el('span', { class: 'dt-tpl__meta', text: t.size + (t.category ? ' · ' + t.category : '') }),
          ]);
          b.addEventListener('click', function () { templateDialog(t); });
          grid.appendChild(b);
        });
      };

      var timer = 0;
      search.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(function () { state.q = search.value; draw(); }, 150); });
      api.cleanup(function () { clearTimeout(timer); if (observer) { observer.disconnect(); } waiting = []; });
      api.on('readonly', function () { api.rebuild(); });
      draw();
      loadList().then(function (list) { if (D.panels.current() === 'templates') { drawChips(list); draw(); } });
    },
  });

  D.templates = {
    list: function () { return loadList(); },
    apply: function (t, mode) { app = app || D.app; return applyTemplate(t, mode); },
    dialog: function (t) { app = app || D.app; return templateDialog(t); },
  };
})();
