/* DesignThix designer, part 4: the left panel. Tabs Elemente (add), Medien (search the library, click or drag onto the page), Felder (the fields of the
   design: define, sample values, insert {{Key}}, warnings) and Ebenen (the stack: order by drag, lock, hide, rename). The panel of the properties is in
   designer.props.js. Everything is built with DOM APIs; names, keys and values only ever reach the page through textContent or attributes. */
(function () {
  'use strict';

  var D = window.DtDesigner;
  var app;
  var panes = {};
  var tabs = [];
  var mediaState = { q: '', category: '', loaded: false, timer: 0, token: 0, items: [] };
  var fieldsState = { open: null, adding: false };
  var layerEdit = null;
  var dragAsset = null;
  var suppressClick = false;

  // ================================================================================================ tabs

  function showTab(name) {
    tabs.forEach(function (t) {
      var on = t.getAttribute('data-tab') === name;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
    });
    Object.keys(panes).forEach(function (key) {
      var on = key === name;
      panes[key].hidden = !on;
      panes[key].classList.toggle('is-active', on);
    });
    if (name === 'media' && !mediaState.loaded) { loadMedia(); }
    if (name === 'layers') { buildLayers(); }
    if (name === 'fields') { buildFields(); }
  }

  function currentTab() {
    var active = tabs.find(function (t) { return t.classList.contains('is-active'); });
    return active ? active.getAttribute('data-tab') : 'elements';
  }

  // ================================================================================================ elements

  function addFromTool(kind) {
    if (!app.editable()) { return; }
    var id = app.addElement(kind);
    if (!id) { return; }
    if (kind === 'text' || kind === 'heading') { D.canvas.startTextEdit(id, { selectAll: true }); }
    else if (kind === 'image') { showTab('media'); D.toast('Wähle ein Medium aus der Liste, oder lege rechts ein Feld für das Bild fest.'); }
    else if (kind === 'strip') { D.toast('Ziehe Medien auf die Bildleiste, oder lege rechts die Plätze fest.'); }
    else if (kind === 'placeholder') { showTab('fields'); }
  }

  function initElements() {
    D.$$('[data-add]').forEach(function (b) {
      b.addEventListener('click', function () { addFromTool(b.getAttribute('data-add')); });
    });
    var refreshTools = function () { D.$$('[data-add]').forEach(function (b) { b.disabled = !app.editable(); }); };
    refreshTools();
    app.on('readonly', refreshTools);
  }

  // ================================================================================================ media

  function loadMedia() {
    mediaState.loaded = true;
    var token = ++mediaState.token;
    var url = '/api/assets?take=200' + (mediaState.q ? '&q=' + encodeURIComponent(mediaState.q) : '') + (mediaState.category ? '&category=' + encodeURIComponent(mediaState.category) : '');
    panes.media.classList.add('is-loading');
    D.request('GET', url).then(function (res) {
      if (token !== mediaState.token) { return; }
      panes.media.classList.remove('is-loading');
      mediaState.items = res.ok && Array.isArray(res.data) ? res.data : [];
      mediaState.failed = !res.ok;
      drawMediaGrid();
    }, function () {
      if (token !== mediaState.token) { return; }
      panes.media.classList.remove('is-loading');
      mediaState.failed = true;
      mediaState.items = [];
      drawMediaGrid();
    });
  }

  function useAsset(asset) {
    if (!app.editable()) { return; }
    var e = app.single();
    if (e && e.type === 'image' && !e.source && !e.locked) { app.setSource(e.id, { asset: asset.key }); return; }
    D.canvas.addAssetImage(asset, null);
  }

  function startAssetDrag(ev, asset, tile) {
    if (ev.button !== 0 || !app.editable()) { return; }
    dragAsset = { asset: asset, pointerId: ev.pointerId, x: ev.clientX, y: ev.clientY, started: false, ghost: null, tile: tile };
    // all following events of this pointer go to the tile, however fast the pointer leaves it
    try { tile.setPointerCapture(ev.pointerId); } catch (err) { /* ignore */ }
    var move = function (e) {
      if (!dragAsset || e.pointerId !== dragAsset.pointerId) { return; }
      var d = dragAsset;
      if (!d.started) {
        var dx = e.clientX - d.x;
        var dy = e.clientY - d.y;
        // a touch scrolls the list vertically; a sideways or clear move starts the drag
        var threshold = e.pointerType === 'touch' ? 10 : 6;
        if (Math.hypot(dx, dy) < threshold) { return; }
        if (e.pointerType === 'touch' && Math.abs(dy) > Math.abs(dx) * 1.5) { return; }
        d.started = true;
        d.ghost = D.el('div', { class: 'dt-dragghost' }, D.el('img', { src: asset.url, alt: '' }));
        document.body.appendChild(d.ghost);
        document.documentElement.classList.add('is-dragging-asset');
      }
      d.ghost.style.setProperty('left', e.clientX + 'px');
      d.ghost.style.setProperty('top', e.clientY + 'px');
      var over = document.elementFromPoint(e.clientX, e.clientY);
      document.getElementById('dt-viewport').classList.toggle('is-drop-target', !!(over && over.closest && over.closest('#dt-viewport')));
      e.preventDefault();
    };
    var finish = function (e, cancelled) {
      if (!dragAsset || e.pointerId !== dragAsset.pointerId) { return; }
      var d = dragAsset;
      dragAsset = null;
      tile.removeEventListener('pointermove', move);
      tile.removeEventListener('pointerup', up);
      tile.removeEventListener('pointercancel', cancel);
      document.getElementById('dt-viewport').classList.remove('is-drop-target');
      document.documentElement.classList.remove('is-dragging-asset');
      if (d.ghost && d.ghost.parentNode) { d.ghost.parentNode.removeChild(d.ghost); }
      if (!d.started) { return; }
      suppressClick = true;
      setTimeout(function () { suppressClick = false; }, 50);
      if (cancelled) { return; }
      var over = document.elementFromPoint(e.clientX, e.clientY);
      if (over && over.closest && over.closest('#dt-viewport') && !over.closest('.dt-zoombar')) { D.canvas.dropAsset(asset, e.clientX, e.clientY); }
    };
    var up = function (e) { finish(e, false); };
    var cancel = function (e) { finish(e, true); };
    tile.addEventListener('pointermove', move);
    tile.addEventListener('pointerup', up);
    tile.addEventListener('pointercancel', cancel);
  }

  function drawMediaGrid() {
    var grid = D.$('.dt-media__grid', panes.media);
    D.empty(grid);
    var info = D.$('.dt-media__info', panes.media);
    if (mediaState.failed) { info.textContent = 'Die Medien konnten nicht geladen werden.'; info.hidden = false; return; }
    info.hidden = mediaState.items.length > 0;
    info.textContent = mediaState.q || mediaState.category ? 'Nichts gefunden. Lade neue Medien unter „Medien“ im Menü hoch.' : 'Es gibt noch keine Medien. Lade sie unter „Medien“ im Menü hoch.';
    mediaState.items.forEach(function (a) {
      var tile = D.el('button', { type: 'button', class: 'dt-asset', title: a.name + ' (' + a.key + ')', 'data-key': a.key, disabled: !app.editable() }, [
        D.el('span', { class: 'dt-asset__thumb' }, D.el('img', { src: a.url, alt: '', loading: 'lazy', decoding: 'async', draggable: 'false' })),
        D.el('span', { class: 'dt-asset__name', text: a.name }),
      ]);
      tile.addEventListener('click', function () { if (!suppressClick) { useAsset(a); } });
      tile.addEventListener('pointerdown', function (ev) { startAssetDrag(ev, a, tile); });
      grid.appendChild(tile);
    });
  }

  function buildMedia() {
    var search = D.el('input', { type: 'search', class: 'mat-input mat-input--sm', placeholder: 'Medien suchen', 'aria-label': 'Medien suchen', autocomplete: 'off' });
    var category = D.el('select', { class: 'mat-select mat-select--sm', 'aria-label': 'Kategorie' }, [D.el('option', { value: '', text: 'Alle Kategorien' })].concat(D.CATEGORIES.map(function (c) { return D.el('option', { value: c, text: c }); })));
    search.addEventListener('input', function () {
      clearTimeout(mediaState.timer);
      mediaState.timer = setTimeout(function () { mediaState.q = search.value.trim(); loadMedia(); }, 250);
    });
    category.addEventListener('change', function () { mediaState.category = category.value; loadMedia(); });
    panes.media.appendChild(D.el('div', { class: 'dt-media__tools' }, [search, category]));
    panes.media.appendChild(D.el('p', { class: 'dt-media__info mat-muted', hidden: true }));
    panes.media.appendChild(D.el('div', { class: 'dt-media__grid', role: 'list' }));
    panes.media.appendChild(D.el('p', { class: 'dt-pane__hint', text: 'Klicken setzt das Bild in die Seite, Ziehen auf die Fläche setzt es an die Stelle. Auf ein Bild oder eine Bildleiste gezogen, ersetzt es deren Quelle.' }));
  }

  // ================================================================================================ fields

  function typeLabel(type) {
    var t = D.FIELD_TYPES.find(function (x) { return x[0] === type; });
    return t ? t[1] : type;
  }

  function fieldKeyMessage(key, ownKey) {
    if (!D.KEY_PATTERN.test(key)) { return 'Der Schlüssel beginnt mit einem Buchstaben und hat nur Buchstaben, Ziffern und _ (höchstens 40 Zeichen).'; }
    var clash = D.fieldByKey(app.doc, key);
    if (clash && (!ownKey || D.lower(clash.key) !== D.lower(ownKey))) { return 'Ein Feld mit diesem Schlüssel gibt es schon.'; }
    return '';
  }

  function insertButton(key) {
    var b = D.el('button', { type: 'button', class: 'mat-btn mat-btn--secondary mat-btn--sm dt-field__insert', 'data-keep-edit': '', title: '{{' + key + '}} in den ausgewählten Text einfügen', disabled: !app.editable() });
    b.appendChild(D.icon('text-cursor-input'));
    b.appendChild(D.el('span', { text: 'In Text einfügen' }));
    var keep = function (ev) { ev.preventDefault(); };
    b.addEventListener('pointerdown', keep);
    b.addEventListener('mousedown', keep);
    b.addEventListener('click', function () { app.insertPlaceholder(key); });
    return b;
  }

  function sampleInput(f) {
    var multi = f.type === 'multiline';
    var input = multi
      ? D.el('textarea', { class: 'mat-input mat-input--sm dt-field__sample', rows: 2, maxlength: 2000 })
      : D.el('input', { type: 'text', class: 'mat-input mat-input--sm dt-field__sample', maxlength: 2000, autocomplete: 'off', spellcheck: 'false', list: f.type === 'image' ? 'dt-asset-keys' : null });
    input.value = f.sample;
    input.disabled = !app.editable();
    input.setAttribute('aria-label', 'Beispielwert für ' + f.key);
    input.placeholder = f.type === 'image' ? 'Schlüssel eines Mediums' : 'Beispielwert';
    input.addEventListener('input', function () {
      app.updateField(f.key, { sample: input.value }, 'sample:' + f.key, false);
    });
    return input;
  }

  function fieldForm(f) {
    var disabled = !app.editable();
    var key = D.el('input', { type: 'text', class: 'mat-input mat-input--sm', value: f.key, maxlength: 40, autocomplete: 'off', spellcheck: 'false', disabled: disabled, 'aria-label': 'Schlüssel' });
    var message = D.el('p', { class: 'dt-field__error', role: 'alert', hidden: true });
    var label = D.el('input', { type: 'text', class: 'mat-input mat-input--sm', value: f.label, maxlength: 80, autocomplete: 'off', disabled: disabled, 'aria-label': 'Bezeichnung' });
    var type = D.el('select', { class: 'mat-select mat-select--sm', disabled: disabled, 'aria-label': 'Art' }, D.FIELD_TYPES.map(function (t) { return D.el('option', { value: t[0], text: t[1] }); }));
    type.value = f.type;
    var decimals = D.el('input', { type: 'number', class: 'mat-input mat-input--sm', min: 0, max: 4, step: 1, value: f.decimals === null ? '' : String(f.decimals), disabled: disabled, 'aria-label': 'Nachkommastellen' });
    var category = D.el('select', { class: 'mat-select mat-select--sm', disabled: disabled, 'aria-label': 'Kategorie' }, [D.el('option', { value: '', text: 'Alle Kategorien' })].concat(D.CATEGORIES.map(function (c) { return D.el('option', { value: c, text: c }); })));
    category.value = f.category || '';
    var decRow = D.el('div', { class: 'dt-f', hidden: !(f.type === 'price' || f.type === 'number') }, [D.el('label', { class: 'dt-f__label', text: 'Nachkommastellen' }), decimals]);
    var catRow = D.el('div', { class: 'dt-f', hidden: f.type !== 'image' }, [D.el('label', { class: 'dt-f__label', text: 'Vorgeschlagene Kategorie' }), category]);
    key.addEventListener('change', function () {
      var msg = fieldKeyMessage(key.value.trim(), f.key);
      message.hidden = !msg;
      message.textContent = msg;
      if (msg) { return; }
      var previous = fieldsState.open;
      fieldsState.open = key.value.trim();      // the form stays open under the new key when the pane is drawn again
      var err = app.updateField(f.key, { key: key.value.trim() });
      if (err) { fieldsState.open = previous; message.textContent = err; message.hidden = false; }
    });
    label.addEventListener('input', function () { app.updateField(f.key, { label: label.value.slice(0, 80) || f.key }, 'label:' + f.key, false); });
    type.addEventListener('change', function () { app.updateField(f.key, { type: type.value }); });
    decimals.addEventListener('input', function () {
      var v = decimals.value === '' ? null : D.clamp(Math.round(Number(decimals.value)), 0, 4);
      app.updateField(f.key, { decimals: v }, 'decimals:' + f.key, false);
    });
    category.addEventListener('change', function () { app.updateField(f.key, { category: category.value || null }, null, false); });
    var remove = D.el('button', { type: 'button', class: 'mat-btn mat-btn--secondary mat-btn--sm dt-actions__danger', disabled: disabled }, [D.icon('trash'), D.el('span', { text: 'Feld löschen' })]);
    remove.addEventListener('click', function () {
      var used = window.DtEngine.fieldsUsed(app.doc).find(function (u) { return D.lower(u.key) === D.lower(f.key); });
      var uses = used ? used.uses.length : 0;
      var run = function () { fieldsState.open = null; app.deleteField(f.key); };
      if (!uses) { run(); return; }
      window.MatUi.confirm('Das Feld „' + f.key + '“ wird an ' + uses + ' Stelle' + (uses === 1 ? '' : 'n') + ' verwendet. Die Platzhalter bleiben stehen, bis du sie änderst.', { ok: 'Löschen', danger: true, title: 'Feld löschen' }).then(function (ok) { if (ok) { run(); } });
    });
    var done = D.el('button', { type: 'button', class: 'mat-btn mat-btn--secondary mat-btn--sm', text: 'Schließen' });
    done.addEventListener('click', function () { fieldsState.open = null; buildFields(); });
    return D.el('div', { class: 'dt-fieldform' }, [
      D.el('div', { class: 'dt-f' }, [D.el('label', { class: 'dt-f__label', text: 'Schlüssel (so steht er im Platzhalter)' }), key, message]),
      D.el('div', { class: 'dt-f' }, [D.el('label', { class: 'dt-f__label', text: 'Bezeichnung' }), label]),
      D.el('div', { class: 'dt-f' }, [D.el('label', { class: 'dt-f__label', text: 'Art' }), type]),
      decRow, catRow,
      D.el('div', { class: 'dt-fieldform__buttons' }, [done, D.el('span', { class: 'dt-fieldform__space' }), remove]),
    ]);
  }

  function newFieldForm() {
    var key = D.el('input', { type: 'text', class: 'mat-input mat-input--sm', value: app.freeKey('Feld'), maxlength: 40, autocomplete: 'off', spellcheck: 'false', 'aria-label': 'Schlüssel' });
    var label = D.el('input', { type: 'text', class: 'mat-input mat-input--sm', maxlength: 80, autocomplete: 'off', placeholder: 'wie der Schlüssel', 'aria-label': 'Bezeichnung' });
    var type = D.el('select', { class: 'mat-select mat-select--sm', 'aria-label': 'Art' }, D.FIELD_TYPES.map(function (t) { return D.el('option', { value: t[0], text: t[1] }); }));
    var sample = D.el('input', { type: 'text', class: 'mat-input mat-input--sm', maxlength: 2000, autocomplete: 'off', placeholder: 'Beispielwert', 'aria-label': 'Beispielwert' });
    var message = D.el('p', { class: 'dt-field__error', role: 'alert', hidden: true });
    var add = D.el('button', { type: 'button', class: 'mat-btn mat-btn--primary mat-btn--sm', text: 'Feld anlegen' });
    var cancel = D.el('button', { type: 'button', class: 'mat-btn mat-btn--secondary mat-btn--sm', text: 'Abbrechen' });
    var submit = function () {
      var k = key.value.trim();
      var msg = fieldKeyMessage(k, null);
      if (msg) { message.textContent = msg; message.hidden = false; key.focus(); return; }
      var err = app.addField({ key: k, label: label.value.trim() || k, type: type.value, sample: sample.value });
      if (err) { message.textContent = err; message.hidden = false; return; }
      fieldsState.adding = false;
      fieldsState.open = null;
      buildFields();
    };
    add.addEventListener('click', submit);
    cancel.addEventListener('click', function () { fieldsState.adding = false; buildFields(); });
    [key, label, sample].forEach(function (i) { i.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); submit(); } }); });
    return D.el('form', { class: 'dt-fieldform dt-fieldform--new', novalidate: true, 'aria-label': 'Neues Feld' }, [
      D.el('div', { class: 'dt-f' }, [D.el('label', { class: 'dt-f__label', text: 'Schlüssel' }), key, message]),
      D.el('div', { class: 'dt-f' }, [D.el('label', { class: 'dt-f__label', text: 'Bezeichnung' }), label]),
      D.el('div', { class: 'dt-f' }, [D.el('label', { class: 'dt-f__label', text: 'Art' }), type]),
      D.el('div', { class: 'dt-f' }, [D.el('label', { class: 'dt-f__label', text: 'Beispielwert' }), sample]),
      D.el('div', { class: 'dt-fieldform__buttons' }, [add, cancel]),
    ]);
  }

  /** The field a placeholder or a binding needs, with the type that its use implies (image for pictures, else text). */
  function createFieldFor(entry) {
    var isImage = entry.uses.some(function (u) { return u.kind === 'image' || u.kind === 'strip'; });
    var err = app.addField({ key: entry.key, label: entry.key, type: isImage ? 'image' : 'text', sample: isImage ? '' : 'Beispieltext' });
    if (err) { D.toast(err, 'warning'); }
  }

  function buildFields() {
    var pane = panes.fields;
    if (!app.doc) { return; }
    var focusKey = document.activeElement && pane.contains(document.activeElement) ? document.activeElement.getAttribute('aria-label') : null;
    D.empty(pane);
    var disabled = !app.editable();
    var head = D.el('div', { class: 'dt-pane__head' }, [D.el('h2', { class: 'dt-pane__title', text: 'Felder' })]);
    var addBtn = D.el('button', { type: 'button', class: 'mat-btn mat-btn--secondary mat-btn--sm', disabled: disabled }, [D.icon('plus'), D.el('span', { text: 'Neues Feld' })]);
    addBtn.addEventListener('click', function () { fieldsState.adding = true; fieldsState.open = null; buildFields(); var k = D.$('.dt-fieldform--new input', pane); if (k) { k.focus(); k.select(); } });
    head.appendChild(addBtn);
    pane.appendChild(head);
    pane.appendChild(D.el('p', { class: 'dt-pane__hint', text: 'Felder sind die Stellen, die eine Datenliste füllt. Setze {{Schlüssel}} in einen Text oder binde ein Bild an ein Feld.' }));

    var used = window.DtEngine.fieldsUsed(app.doc);
    var missing = used.filter(function (u) { return !u.defined; });
    if (missing.length) {
      var box = D.el('div', { class: 'mat-alert mat-alert--warning dt-fieldwarn', role: 'status' }, [D.icon('alert'), D.el('div', { class: 'mat-alert__body' }, [D.el('strong', { text: 'Platzhalter ohne Feld' })])]);
      var list = D.el('ul', { class: 'dt-plain' });
      missing.forEach(function (m) {
        var btn = D.el('button', { type: 'button', class: 'mat-btn mat-btn--secondary mat-btn--sm', disabled: disabled, text: 'Feld anlegen' });
        btn.addEventListener('click', function () { createFieldFor(m); });
        list.appendChild(D.el('li', null, [D.el('code', { class: 'mat-mono', text: '{{' + m.key + '}}' }), btn]));
      });
      box.querySelector('.mat-alert__body').appendChild(list);
      pane.appendChild(box);
    }
    var assetWarnings = (app.warnings || []).filter(function (w) { return w.kind === 'asset'; });
    if (assetWarnings.length) {
      var abox = D.el('div', { class: 'mat-alert mat-alert--warning dt-fieldwarn', role: 'status' }, [D.icon('alert'), D.el('div', { class: 'mat-alert__body' }, [D.el('strong', { text: 'Unbekannte Medien' })])]);
      var alist = D.el('ul', { class: 'dt-plain dt-plain--text' });
      assetWarnings.slice(0, 12).forEach(function (w) { alist.appendChild(D.el('li', { text: w.text })); });
      abox.querySelector('.mat-alert__body').appendChild(alist);
      pane.appendChild(abox);
    }

    if (fieldsState.adding) { pane.appendChild(newFieldForm()); }

    if (!app.doc.fields.length && !fieldsState.adding) {
      pane.appendChild(D.el('p', { class: 'dt-empty', text: 'Dieses Design hat noch keine Felder. Lege eines an oder füge links einen „Platzhalter-Text“ ein.' }));
    }

    var usedByKey = new Map(used.map(function (u) { return [D.lower(u.key), u]; }));
    var ul = D.el('ul', { class: 'dt-fields', role: 'list' });
    app.doc.fields.forEach(function (f) {
      var open = fieldsState.open && D.lower(fieldsState.open) === D.lower(f.key);
      var useCount = (usedByKey.get(D.lower(f.key)) || { uses: [] }).uses.length;
      var edit = D.el('button', { type: 'button', class: 'mat-btn mat-btn--ghost mat-btn--icon mat-btn--sm', title: 'Feld bearbeiten', 'aria-label': 'Feld ' + f.key + ' bearbeiten', 'aria-expanded': String(!!open) }, D.icon('sliders-horizontal'));
      edit.addEventListener('click', function () { fieldsState.open = open ? null : f.key; fieldsState.adding = false; buildFields(); });
      var li = D.el('li', { class: 'dt-field' + (open ? ' is-open' : '') }, [
        D.el('div', { class: 'dt-field__head' }, [
          D.el('span', { class: 'dt-field__key mat-mono', text: f.key }),
          D.el('span', { class: 'mat-pill dt-field__type', text: typeLabel(f.type) }),
          D.el('span', { class: 'dt-field__uses', text: useCount ? useCount + '×' : 'unbenutzt', title: useCount ? 'Wird an ' + useCount + ' Stelle(n) benutzt' : 'Dieses Feld wird noch nirgends benutzt' }),
          edit,
        ]),
        f.label && f.label !== f.key ? D.el('div', { class: 'dt-field__label', text: f.label }) : null,
        sampleInput(f),
        f.type === 'image' ? null : D.el('div', { class: 'dt-field__actions' }, insertButton(f.key)),
      ]);
      if (open) { li.appendChild(fieldForm(f)); }
      ul.appendChild(li);
    });
    pane.appendChild(ul);

    var badge = D.$('#dt-fields-badge');
    if (badge) { badge.hidden = !missing.length; badge.textContent = String(missing.length); badge.setAttribute('aria-label', missing.length + ' Platzhalter ohne Feld'); }
    if (focusKey) { var back = D.$('[aria-label="' + focusKey.replace(/"/g, '') + '"]', pane); if (back && back.focus) { back.focus(); } }
  }

  function updateFieldBadge() {
    var missing = window.DtEngine.fieldsUsed(app.doc).filter(function (u) { return !u.defined; }).length;
    var badge = D.$('#dt-fields-badge');
    if (!badge) { return; }
    badge.hidden = !missing;
    badge.textContent = String(missing);
  }

  // ================================================================================================ layers

  function buildLayers() {
    var pane = panes.layers;
    if (!app.doc || layerEdit) { return; }
    D.empty(pane);
    pane.appendChild(D.el('div', { class: 'dt-pane__head' }, [D.el('h2', { class: 'dt-pane__title', text: 'Ebenen' }), D.el('span', { class: 'dt-pane__count mat-muted', text: String(app.doc.elements.length) })]));
    if (!app.doc.elements.length) {
      pane.appendChild(D.el('p', { class: 'dt-empty', text: 'Noch keine Elemente. Füge links im Reiter „Elemente“ etwas hinzu.' }));
      return;
    }
    pane.appendChild(D.el('p', { class: 'dt-pane__hint', text: 'Oben liegt vorn. Ziehe am Griff, um die Reihenfolge zu ändern. Ein Doppelklick auf den Namen benennt um.' }));
    var ul = D.el('ul', { class: 'dt-layers', role: 'list' });
    var elements = app.doc.elements.slice().reverse();
    var editable = app.editable();
    elements.forEach(function (e) {
      var grip = D.el('button', { type: 'button', class: 'dt-layer__grip', title: 'Ziehen, um die Reihenfolge zu ändern (oder Pfeil auf/ab)', 'aria-label': 'Reihenfolge von ' + D.elementTitle(e) + ' ändern', disabled: !editable }, D.icon('grip-vertical'));
      var name = D.el('button', { type: 'button', class: 'dt-layer__name', text: D.elementTitle(e), title: D.elementTitle(e) });
      var eye = D.el('button', { type: 'button', class: 'dt-layer__toggle' + (e.hidden ? ' is-on' : ''), title: e.hidden ? 'Einblenden' : 'Ausblenden', 'aria-label': (e.hidden ? 'Einblenden: ' : 'Ausblenden: ') + D.elementTitle(e), 'aria-pressed': String(e.hidden), disabled: !editable }, D.icon(e.hidden ? 'eye-off' : 'eye'));
      var lock = D.el('button', { type: 'button', class: 'dt-layer__toggle' + (e.locked ? ' is-on' : ''), title: e.locked ? 'Entsperren' : 'Sperren', 'aria-label': (e.locked ? 'Entsperren: ' : 'Sperren: ') + D.elementTitle(e), 'aria-pressed': String(e.locked), disabled: !editable }, D.icon(e.locked ? 'lock' : 'lock-open'));
      var li = D.el('li', { class: 'dt-layer' + (app.isSelected(e.id) ? ' is-selected' : '') + (e.hidden ? ' is-hidden' : '') + (e.locked ? ' is-locked' : ''), 'data-id': e.id }, [
        grip, D.el('span', { class: 'dt-layer__icon' }, D.icon(D.elementIcon(e))), name, eye, lock,
      ]);
      li.addEventListener('click', function (ev) {
        if (ev.target.closest('.dt-layer__toggle, .dt-layer__grip, input')) { return; }
        if (ev.shiftKey || ev.ctrlKey || ev.metaKey) { app.toggleSelect(e.id); } else { app.select([e.id]); }
        D.canvas.reveal(e.id);
      });
      name.addEventListener('dblclick', function () { if (editable) { renameLayer(li, e); } });
      eye.addEventListener('click', function () { app.toggleHidden([e.id]); });
      lock.addEventListener('click', function () { app.toggleLock([e.id]); });
      grip.addEventListener('keydown', function (ev) {
        if (ev.key !== 'ArrowUp' && ev.key !== 'ArrowDown') { return; }
        ev.preventDefault();
        app.select([e.id]);
        app.order(ev.key === 'ArrowUp' ? 'forward' : 'backward');
        var again = D.$('.dt-layer[data-id="' + e.id + '"] .dt-layer__grip', pane);
        if (again) { again.focus(); }
      });
      grip.addEventListener('pointerdown', function (ev) { startLayerDrag(ev, e, li, ul); });
      ul.appendChild(li);
    });
    pane.appendChild(ul);
  }

  function renameLayer(li, e) {
    var nameBtn = D.$('.dt-layer__name', li);
    var input = D.el('input', { type: 'text', class: 'mat-input mat-input--sm dt-layer__input', value: e.name || D.elementTitle(e), maxlength: 80, 'aria-label': 'Name der Ebene' });
    layerEdit = { id: e.id };
    li.replaceChild(input, nameBtn);
    input.focus();
    input.select();
    var done = false;
    var finish = function (commit) {
      if (done) { return; }
      done = true;
      layerEdit = null;
      if (commit && input.value.trim() !== (e.name || D.elementTitle(e))) { app.rename(e.id, input.value.trim()); } else { buildLayers(); }
    };
    input.addEventListener('keydown', function (ev) {
      ev.stopPropagation();
      if (ev.key === 'Enter') { ev.preventDefault(); finish(true); } else if (ev.key === 'Escape') { ev.preventDefault(); finish(false); }
    });
    input.addEventListener('blur', function () { finish(true); });
  }

  function startLayerDrag(ev, element, li, ul) {
    if (ev.button !== 0 || !app.editable()) { return; }
    ev.preventDefault();
    var grip = ev.currentTarget;
    var rows = D.$$('.dt-layer', ul);
    var from = rows.indexOf(li);
    var state = { moved: false, to: from };
    var line = D.el('li', { class: 'dt-layers__line', 'aria-hidden': 'true' });
    try { grip.setPointerCapture(ev.pointerId); } catch (e) { /* ignore */ }
    var targetFor = function (y) {
      // the slot between rows (0..n) nearest to the pointer
      var best = 0;
      for (var i = 0; i < rows.length; i++) {
        var r = rows[i].getBoundingClientRect();
        if (y > r.top + r.height / 2) { best = i + 1; }
      }
      return best;
    };
    var move = function (e) {
      if (!state.moved && Math.abs(e.clientY - ev.clientY) < 4) { return; }
      state.moved = true;
      li.classList.add('is-dragging');
      state.to = targetFor(e.clientY);
      if (line.parentNode) { line.parentNode.removeChild(line); }
      if (state.to >= rows.length) { ul.appendChild(line); } else { ul.insertBefore(line, rows[state.to]); }
    };
    var end = function (e, cancelled) {
      grip.removeEventListener('pointermove', move);
      grip.removeEventListener('pointerup', up);
      grip.removeEventListener('pointercancel', cancel);
      li.classList.remove('is-dragging');
      if (line.parentNode) { line.parentNode.removeChild(line); }
      if (!state.moved || cancelled) { return; }
      var slot = state.to > from ? state.to - 1 : state.to;     // position in the list without the dragged row
      if (slot === from) { return; }
      var count = rows.length;
      app.moveToIndex(element.id, count - 1 - slot);
    };
    var up = function (e) { end(e, false); };
    var cancel = function (e) { end(e, true); };
    grip.addEventListener('pointermove', move);
    grip.addEventListener('pointerup', up);
    grip.addEventListener('pointercancel', cancel);
  }

  // ================================================================================================ init

  function init(theApp) {
    app = theApp;
    tabs = D.$$('.dt-tabs__tab');
    ['elements', 'media', 'fields', 'layers'].forEach(function (name) { panes[name] = document.getElementById('dt-pane-' + name); });
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { showTab(t.getAttribute('data-tab')); });
      t.addEventListener('keydown', function (ev) {
        var next = ev.key === 'ArrowRight' ? i + 1 : (ev.key === 'ArrowLeft' ? i - 1 : null);
        if (next === null) { return; }
        ev.preventDefault();
        var target = tabs[(next + tabs.length) % tabs.length];
        showTab(target.getAttribute('data-tab'));
        target.focus();
      });
    });
    initElements();
    buildMedia();
    app.on('doc', function (ev) {
      var tab = currentTab();
      if (ev.structure || ev.reason === 'load' || ev.reason === 'history') {
        if (tab === 'layers') { buildLayers(); }
        if (tab === 'fields' && !ev.noFields) { buildFields(); }
        updateFieldBadge();
      } else { updateFieldBadge(); }
    });
    app.on('selection', function () {
      if (currentTab() === 'layers') {
        D.$$('.dt-layer', panes.layers).forEach(function (li) { li.classList.toggle('is-selected', app.isSelected(li.getAttribute('data-id'))); });
      }
    });
    app.on('warnings', function () { if (currentTab() === 'fields' && !panes.fields.contains(document.activeElement)) { buildFields(); } else { updateFieldBadge(); } });
    app.on('readonly', function () { drawMediaGrid(); if (currentTab() === 'layers') { buildLayers(); } if (currentTab() === 'fields') { buildFields(); } });
    app.on('assets', function () { drawMediaGrid(); });
  }

  D.panels = { init: init, showTab: showTab, currentTab: currentTab, buildFields: buildFields, buildLayers: buildLayers };
})();
