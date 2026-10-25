/* DesignThix editor, part 10d: the panel "Daten (Zusatz)" - the add-on of the editor that fills a design from data. Preview with a data list (the selector that used to be in the top
   bar) and a row stepper, the fields of the design (key, label, type, sample; insert {{Feld}} into the text; pictures as samples through the media browser), the display condition of the
   selected element, and the link "Serienausgabe erstellen". D.data holds the state of the preview: app.preview = { listId, list, rows, index }, kept per design in localStorage dt-preview-<id>. */
(function () {
  'use strict';

  var D = window.DtDesigner;
  var app;
  var lists = [];
  var listsLoaded = false;
  var fieldsState = { open: null, adding: false };

  function previewKey() { return 'dt-preview-' + app.id; }

  function savePreview() {
    try { localStorage.setItem(previewKey(), JSON.stringify({ listId: app.preview.listId, index: app.preview.index })); } catch (e) { /* ignore */ }
  }

  var data = D.data = {
    init: function (theApp) {
      app = theApp;
      return D.request('GET', '/api/datalists').then(function (res) {
        lists = res.ok && Array.isArray(res.data) ? res.data : [];
        listsLoaded = true;
        app.emit('datalists');
        var saved = null;
        try { saved = JSON.parse(localStorage.getItem(previewKey()) || 'null'); } catch (e) { saved = null; }
        if (saved && saved.listId && lists.some(function (l) { return l.id === saved.listId; })) { return data.choose(saved.listId, saved.index); }
        return undefined;
      }, function () { listsLoaded = true; /* offline: sample values only */ });
    },
    lists: function () { return lists; },
    rowCount: function () { return app.preview.rows.length; },
    setRow: function (index) {
      var n = app.preview.rows.length;
      if (!n) { return; }
      app.preview.index = (index + n) % n;
      savePreview();
      app.emit('preview');
    },
    /** Shows the rows of a data list in the preview (null: the sample values of the fields). */
    choose: function (listId, index) {
      if (!listId) {
        app.preview = { listId: null, list: null, rows: [], index: 0 };
        try { localStorage.removeItem(previewKey()); } catch (e) { /* ignore */ }
        app.emit('preview');
        return Promise.resolve();
      }
      return D.request('GET', '/api/datalists/' + listId + '/rows').then(function (res) {
        if (!res.ok) { D.toast('Die Datenliste konnte nicht geladen werden.', 'danger'); return; }
        app.preview = { listId: listId, list: res.data, rows: res.data.rows || [], index: D.clamp(index || 0, 0, Math.max(0, (res.data.rows || []).length - 1)) };
        savePreview();
        app.emit('preview');
      }, function () { D.toast('Keine Verbindung: Die Datenliste konnte nicht geladen werden.', 'warning'); });
    },
  };

  // ================================================================================================ fields

  function typeLabel(type) { var t = D.FIELD_TYPES.find(function (x) { return x[0] === type; }); return t ? t[1] : type; }

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

  /** The sample of a field: a text input, or for a picture field the thumbnail and the media browser. */
  function sampleControl(f) {
    var disabled = !app.editable();
    if (f.type === 'image') {
      var asset = f.sample ? app.assetByKey(f.sample) : null;
      var thumb = D.el('span', { class: 'dt-thumb dt-thumb--sm' });
      if (asset) { thumb.appendChild(D.el('img', { src: asset.url, alt: '' })); } else { thumb.appendChild(D.icon('image')); }
      var pick = D.el('button', { type: 'button', class: 'mat-btn mat-btn--secondary mat-btn--sm', disabled: disabled }, [D.icon('replace'), D.el('span', { text: f.sample ? 'Beispielbild ändern' : 'Beispielbild wählen' })]);
      pick.addEventListener('click', function () {
        window.DtMedia.pick({ title: 'Beispielbild für „' + f.key + '“', category: f.category || '' }, function (key, a) { if (a) { app.addAssets([a]); app.updateField(f.key, { sample: a.key }, null, true); } });
      });
      var clear = D.el('button', { type: 'button', class: 'mat-btn mat-btn--ghost mat-btn--icon mat-btn--sm', title: 'Beispielbild entfernen', 'aria-label': 'Beispielbild entfernen', disabled: disabled || !f.sample }, D.icon('x'));
      clear.addEventListener('click', function () { app.updateField(f.key, { sample: '' }, null, true); });
      return D.el('div', { class: 'dt-field__sampleimg' }, [thumb, D.el('span', { class: 'dt-field__samplekey mat-mono', text: f.sample || 'kein Beispielbild' }), pick, clear]);
    }
    var multi = f.type === 'multiline';
    var input = multi
      ? D.el('textarea', { class: 'mat-input mat-input--sm dt-field__sample', rows: 2, maxlength: 2000 })
      : D.el('input', { type: 'text', class: 'mat-input mat-input--sm dt-field__sample', maxlength: 2000, autocomplete: 'off', spellcheck: 'false' });
    input.value = f.sample;
    input.disabled = disabled;
    input.setAttribute('aria-label', 'Beispielwert für ' + f.key);
    input.placeholder = 'Beispielwert';
    input.addEventListener('input', function () { app.updateField(f.key, { sample: input.value }, 'sample:' + f.key, false); });
    input.addEventListener('keydown', function (ev) { ev.stopPropagation(); });
    return input;
  }

  function fieldForm(f, rebuild) {
    var disabled = !app.editable();
    var key = D.el('input', { type: 'text', class: 'mat-input mat-input--sm', value: f.key, maxlength: 40, autocomplete: 'off', spellcheck: 'false', disabled: disabled, 'aria-label': 'Schlüssel' });
    var message = D.ui.message();
    var label = D.el('input', { type: 'text', class: 'mat-input mat-input--sm', value: f.label, maxlength: 80, autocomplete: 'off', disabled: disabled, 'aria-label': 'Bezeichnung' });
    var type = D.el('select', { class: 'mat-select mat-select--sm', disabled: disabled, 'aria-label': 'Art' }, D.FIELD_TYPES.map(function (t) { return D.el('option', { value: t[0], text: t[1] }); }));
    type.value = f.type;
    var decimals = D.el('input', { type: 'number', class: 'mat-input mat-input--sm', min: 0, max: 4, step: 1, value: f.decimals === null ? '' : String(f.decimals), disabled: disabled, 'aria-label': 'Nachkommastellen' });
    var category = D.el('select', { class: 'mat-select mat-select--sm', disabled: disabled, 'aria-label': 'Kategorie' }, [D.el('option', { value: '', text: 'Alle Kategorien' })].concat(D.CATEGORIES.map(function (c) { return D.el('option', { value: c, text: c }); })));
    category.value = f.category || '';
    var decRow = D.ui.field('Nachkommastellen', decimals);
    decRow.hidden = !(f.type === 'price' || f.type === 'number');
    var catRow = D.ui.field('Vorgeschlagene Kategorie im Bildbrowser', category);
    catRow.hidden = f.type !== 'image';
    key.addEventListener('keydown', function (ev) { ev.stopPropagation(); });
    key.addEventListener('change', function () {
      var msg = fieldKeyMessage(key.value.trim(), f.key);
      message.hidden = !msg;
      message.textContent = msg;
      if (msg) { return; }
      var previous = fieldsState.open;
      fieldsState.open = key.value.trim();
      var err = app.updateField(f.key, { key: key.value.trim() });
      if (err) { fieldsState.open = previous; message.textContent = err; message.hidden = false; }
    });
    label.addEventListener('keydown', function (ev) { ev.stopPropagation(); });
    label.addEventListener('input', function () { app.updateField(f.key, { label: label.value.slice(0, 80) || f.key }, 'label:' + f.key, false); });
    type.addEventListener('change', function () { app.updateField(f.key, { type: type.value }); });
    decimals.addEventListener('input', function () { var v = decimals.value === '' ? null : D.clamp(Math.round(Number(decimals.value)), 0, 4); app.updateField(f.key, { decimals: v }, 'decimals:' + f.key, false); });
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
    done.addEventListener('click', function () { fieldsState.open = null; rebuild(); });
    return D.el('div', { class: 'dt-fieldform' }, [
      D.ui.field('Schlüssel (so steht er im Platzhalter)', key), message,
      D.ui.field('Bezeichnung', label), D.ui.field('Art', type), decRow, catRow,
      D.el('div', { class: 'dt-fieldform__buttons' }, [done, D.el('span', { class: 'dt-fieldform__space' }), remove]),
    ]);
  }

  function newFieldForm(rebuild) {
    var key = D.el('input', { type: 'text', class: 'mat-input mat-input--sm', value: app.freeKey('Feld'), maxlength: 40, autocomplete: 'off', spellcheck: 'false', 'aria-label': 'Schlüssel' });
    var label = D.el('input', { type: 'text', class: 'mat-input mat-input--sm', maxlength: 80, autocomplete: 'off', placeholder: 'wie der Schlüssel', 'aria-label': 'Bezeichnung' });
    var type = D.el('select', { class: 'mat-select mat-select--sm', 'aria-label': 'Art' }, D.FIELD_TYPES.map(function (t) { return D.el('option', { value: t[0], text: t[1] }); }));
    var sample = D.el('input', { type: 'text', class: 'mat-input mat-input--sm', maxlength: 2000, autocomplete: 'off', placeholder: 'Beispielwert', 'aria-label': 'Beispielwert' });
    var message = D.ui.message();
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
      rebuild();
    };
    add.addEventListener('click', submit);
    cancel.addEventListener('click', function () { fieldsState.adding = false; rebuild(); });
    [key, label, sample].forEach(function (i) { i.addEventListener('keydown', function (ev) { ev.stopPropagation(); if (ev.key === 'Enter') { ev.preventDefault(); submit(); } }); });
    return D.el('form', { class: 'dt-fieldform dt-fieldform--new', novalidate: true, 'aria-label': 'Neues Feld' }, [
      D.ui.field('Schlüssel', key), message, D.ui.field('Bezeichnung', label), D.ui.field('Art', type), D.ui.field('Beispielwert', sample),
      D.el('div', { class: 'dt-fieldform__buttons' }, [add, cancel]),
    ]);
  }

  function createFieldFor(entry) {
    var isImage = entry.uses.some(function (u) { return u.kind === 'image' || u.kind === 'strip'; });
    var err = app.addField({ key: entry.key, label: entry.key, type: isImage ? 'image' : 'text', sample: isImage ? '' : 'Beispieltext' });
    if (err) { D.toast(err, 'warning'); }
  }

  // ================================================================================================ the panel

  D.panels.register({
    id: 'data', title: 'Daten (Zusatz)', label: 'Daten (Zusatz)', icon: 'database', order: 70,
    badge: function () { var a = app || D.app; return a && a.doc ? window.DtEngine.fieldsUsed(a.doc).filter(function (u) { return !u.defined; }).length : 0; },
    build: function (host, api) {
      app = api.app;
      var disabled = !app.editable();
      host.appendChild(D.el('div', { class: 'dt-pbar dt-pbar--stack' }, [
        D.el('p', { class: 'dt-pintro', text: 'Zusatz: Mit Feldern und einer Datenliste füllst du dasselbe Design für viele Etiketten, Schilder oder Karten.' }),
      ]));

      // ---- preview with a data list
      var select = D.el('select', { class: 'mat-select', 'aria-label': 'Daten für die Vorschau' }, [D.el('option', { value: '', text: 'Beispielwerte' })]);
      lists.forEach(function (l) { select.appendChild(D.el('option', { value: String(l.id), text: l.name + ' (' + l.rowCount + ' Zeilen)' })); });
      select.value = app.preview.listId ? String(app.preview.listId) : '';
      select.addEventListener('change', function () { data.choose(select.value ? Number(select.value) : null, 0); });
      var info = D.el('span', { class: 'dt-rowinfo', 'aria-live': 'polite' });
      var prev = D.ui.iconButton('chevron-left', 'Vorherige Zeile', function () { data.setRow(app.preview.index - 1); });
      var next = D.ui.iconButton('chevron-right', 'Nächste Zeile', function () { data.setRow(app.preview.index + 1); });
      var stepper = D.el('div', { class: 'dt-rowctl' }, [prev, info, next]);
      var syncRows = function () {
        var p = app.preview;
        stepper.hidden = !p.list;
        info.textContent = p.rows.length ? 'Zeile ' + (p.index + 1) + ' von ' + p.rows.length : 'keine Zeilen';
        prev.disabled = p.rows.length < 2;
        next.disabled = p.rows.length < 2;
        if (document.activeElement !== select) { select.value = p.listId ? String(p.listId) : ''; }
      };
      syncRows();
      api.on('preview', syncRows);
      host.appendChild(D.ui.section('Vorschau mit Daten', [
        D.ui.field(null, select), stepper,
        D.el('p', { class: 'dt-hint', text: lists.length || !listsLoaded ? 'Wähle eine Datenliste und blättere durch ihre Zeilen: die Seite zeigt dann die Werte der Zeile.' : 'Du hast noch keine Datenliste. Lege eine unter „Datenlisten“ im Menü an.' }),
      ]));

      // ---- the link into the batch output
      host.appendChild(D.el('div', { class: 'dt-pbar' }, D.el('a', { class: 'mat-btn mat-btn--secondary dt-data__output', href: '/Outputs/Create?designId=' + app.id, 'data-leave': '' }, [D.icon('printer'), D.el('span', { text: 'Serienausgabe erstellen' })])));

      // ---- the selected element: display condition
      var sel = app.single();
      if (sel && !sel.locked && app.editable() && app.doc.fields.length) {
        var options = [['', 'Immer anzeigen']].concat(app.doc.fields.map(function (f) { return [f.key, 'Nur wenn „' + (f.label || f.key) + '“ gefüllt ist']; }));
        var cond = D.ui.select({ label: 'Anzeigebedingung', value: sel.showIf || '', items: options, onChange: function (v) { app.setProps([sel.id], { showIf: v || null }, { merge: false }); } });
        host.appendChild(D.ui.section('Auswahl: ' + D.elementTitle(sel), [D.ui.field('Anzeigebedingung', cond.el), D.el('p', { class: 'dt-hint', text: 'So verschwindet eine Zeile samt Beschriftung, wenn ihr Wert leer ist.' })]));
      }

      // ---- fields
      var fieldsHost = D.el('div', { class: 'dt-fields-host' });
      host.appendChild(fieldsHost);
      var drawFields = function () {
        D.empty(fieldsHost);
        var focusLabel = document.activeElement && fieldsHost.contains(document.activeElement) ? document.activeElement.getAttribute('aria-label') : null;
        var head = D.el('div', { class: 'dt-pbar dt-pbar--row' }, [D.el('h3', { class: 'dt-psec__title', text: 'Felder' })]);
        var addBtn = D.el('button', { type: 'button', class: 'mat-btn mat-btn--secondary mat-btn--sm', disabled: disabled }, [D.icon('plus'), D.el('span', { text: 'Neues Feld' })]);
        addBtn.addEventListener('click', function () { fieldsState.adding = true; fieldsState.open = null; drawFields(); var k = D.$('.dt-fieldform--new input', fieldsHost); if (k) { k.focus(); k.select(); } });
        head.appendChild(addBtn);
        fieldsHost.appendChild(head);
        fieldsHost.appendChild(D.el('p', { class: 'dt-pnote', text: 'Felder sind die Stellen, die eine Datenliste füllt. Setze {{Schlüssel}} in einen Text, in einen QR-Code oder binde ein Bild an ein Feld.' }));
        var used = window.DtEngine.fieldsUsed(app.doc);
        var missing = used.filter(function (u) { return !u.defined; });
        if (missing.length) {
          var box = D.el('div', { class: 'mat-alert mat-alert--warning dt-fieldwarn', role: 'status' }, [D.icon('alert'), D.el('div', { class: 'mat-alert__body' }, [D.el('strong', { text: 'Platzhalter ohne Feld' })])]);
          var ul0 = D.el('ul', { class: 'dt-plain' });
          missing.forEach(function (m) {
            var btn = D.el('button', { type: 'button', class: 'mat-btn mat-btn--secondary mat-btn--sm', disabled: disabled, text: 'Feld anlegen' });
            btn.addEventListener('click', function () { createFieldFor(m); });
            ul0.appendChild(D.el('li', null, [D.el('code', { class: 'mat-mono', text: '{{' + m.key + '}}' }), btn]));
          });
          box.querySelector('.mat-alert__body').appendChild(ul0);
          fieldsHost.appendChild(box);
        }
        var assetWarnings = (app.warnings || []).filter(function (w) { return w.kind === 'asset'; });
        if (assetWarnings.length) {
          var abox = D.el('div', { class: 'mat-alert mat-alert--warning dt-fieldwarn', role: 'status' }, [D.icon('alert'), D.el('div', { class: 'mat-alert__body' }, [D.el('strong', { text: 'Unbekannte Bilder' })])]);
          var alist = D.el('ul', { class: 'dt-plain dt-plain--text' });
          assetWarnings.slice(0, 12).forEach(function (w) { alist.appendChild(D.el('li', { text: w.text })); });
          abox.querySelector('.mat-alert__body').appendChild(alist);
          fieldsHost.appendChild(abox);
        }
        if (fieldsState.adding) { fieldsHost.appendChild(newFieldForm(drawFields)); }
        if (!app.doc.fields.length && !fieldsState.adding) {
          fieldsHost.appendChild(D.el('p', { class: 'dt-empty', text: 'Dieses Design hat noch keine Felder. Lege eines an oder füge einen Platzhalter-Text ein.' }));
          var ph = D.el('button', { type: 'button', class: 'mat-btn mat-btn--secondary mat-btn--sm', disabled: disabled }, [D.icon('braces'), D.el('span', { text: 'Platzhalter-Text einfügen' })]);
          ph.addEventListener('click', function () { app.addElement('placeholder'); });
          fieldsHost.appendChild(D.el('div', { class: 'dt-pbar' }, ph));
        }
        var usedByKey = new Map(used.map(function (u) { return [D.lower(u.key), u]; }));
        var ul = D.el('ul', { class: 'dt-fields', role: 'list' });
        app.doc.fields.forEach(function (f) {
          var open = fieldsState.open && D.lower(fieldsState.open) === D.lower(f.key);
          var useCount = (usedByKey.get(D.lower(f.key)) || { uses: [] }).uses.length;
          var edit = D.el('button', { type: 'button', class: 'mat-btn mat-btn--ghost mat-btn--icon mat-btn--sm', title: 'Feld bearbeiten', 'aria-label': 'Feld ' + f.key + ' bearbeiten', 'aria-expanded': String(!!open) }, D.icon('sliders-horizontal'));
          edit.addEventListener('click', function () { fieldsState.open = open ? null : f.key; fieldsState.adding = false; drawFields(); });
          var li = D.el('li', { class: 'dt-field' + (open ? ' is-open' : ''), 'data-key': f.key }, [
            D.el('div', { class: 'dt-field__head' }, [
              D.el('span', { class: 'dt-field__key mat-mono', text: f.key }),
              D.el('span', { class: 'mat-pill dt-field__type', text: typeLabel(f.type) }),
              D.el('span', { class: 'dt-field__uses', text: useCount ? useCount + '×' : 'unbenutzt', title: useCount ? 'Wird an ' + useCount + ' Stelle(n) benutzt' : 'Dieses Feld wird noch nirgends benutzt' }),
              edit,
            ]),
            f.label && f.label !== f.key ? D.el('div', { class: 'dt-field__label', text: f.label }) : null,
            sampleControl(f),
            f.type === 'image' ? null : D.el('div', { class: 'dt-field__actions' }, insertButton(f.key)),
          ]);
          if (open) { li.appendChild(fieldForm(f, drawFields)); }
          ul.appendChild(li);
        });
        fieldsHost.appendChild(ul);
        if (focusLabel) { var back = D.$('[aria-label="' + focusLabel.replace(/"/g, '') + '"]', fieldsHost); if (back && back.focus) { back.focus(); } }
      };
      drawFields();
      api.on('doc', function (ev) { if (ev.structure || ev.reason === 'load' || ev.reason === 'history') { if (!fieldsHost.contains(document.activeElement) || ev.reason === 'field') { drawFields(); } } });
      api.on('page', drawFields);
      api.on('warnings', function () { if (!fieldsHost.contains(document.activeElement)) { drawFields(); } });
      api.on('assets', drawFields);
      api.on('selection', function () { api.rebuild(); });
      api.on('datalists', function () { api.rebuild(); });
      api.on('readonly', function () { api.rebuild(); });
    },
  });
})();
