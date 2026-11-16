/* MatCan: the dialog "Vorlage ansehen" (plan 6, docs/PLAN-TEMPLATES.md section 2). It shows ALL pages of a template drawn by the engine, lets the person switch between the
   variants of the family (Klassisch, Modern, Verspielt ...) and uses the chosen variant: "Vorlage verwenden" (data-use-template, handled by create.js) copies it and opens the copy in the designer.
     window.DtTemplatePreview.open(family, startId)   family = { key, name, occasion, category, variants: [{ id, name, variant, size, formatName, formatNote, fold, description, tags, canEdit }] }
     window.DtTemplatePreview.openById(id)             asks GET /api/templates/{id}/family first (the start page and the search only know one template)
   Every element with data-preview-template="<template id>" opens it on a click (a plain click: the link to the page "Design erstellen" stays the fallback without script).
   The pages are drawn through designs.js (data-dt-preview + data-dt-preview-page), so fonts, media and icons are resolved the way the thumbnails do it. A dashed line shows where a folded
   card folds: it is a rule of this dialog (CSS), nothing of the design. Names only through textContent. Needs dt-ui.js, dt-engine.js, designs.js and create.js. */
(function () {
  'use strict';

  var U = window.DtUi;
  if (!U) { return; }
  var el = U.el;
  var counter = 0;

  function plural(n) { return n === 1 ? 'Seite' : 'Seiten'; }

  function open(family, startId) {
    if (!family || !family.variants || !family.variants.length) { return null; }
    var id = 'dt-tpv-' + (++counter);
    var variants = family.variants;
    var state = { index: Math.max(0, variants.findIndex(function (v) { return v.id === Number(startId); })), seq: 0 };

    var dlg = el('dialog', { class: 'mat-dialog mat-dialog--xl dt-tpv', 'data-static': '', 'aria-labelledby': id + '-t' });
    var close = el('button', { type: 'button', class: 'mat-btn mat-btn--ghost mat-btn--icon mat-dialog__close', 'aria-label': 'Schließen', 'data-dialog-close': '' }, U.icon('x'));
    var title = el('h2', { class: 'mat-dialog__title', id: id + '-t', text: variants.length > 1 ? family.name : variants[0].name });
    var head = el('div', { class: 'mat-dialog__head' }, [U.icon('dt:layout-template'), title, close]);

    var pagesEl = el('div', { class: 'dt-tpv__pages', tabindex: '0', 'aria-label': 'Seiten der Vorlage', role: 'region' });
    var side = el('div', { class: 'dt-tpv__side' });
    var body = el('div', { class: 'mat-dialog__body dt-tpv__body' }, [pagesEl, side]);

    var use = el('button', { type: 'button', class: 'mat-btn mat-btn--primary', 'data-tpv-use': '' }, [U.icon('plus'), el('span', { text: 'Vorlage verwenden' })]);
    var edit = el('a', { class: 'mat-btn mat-btn--secondary', 'data-tpv-edit': '', href: '#' }, [U.icon('edit'), el('span', { text: 'Bearbeiten' })]);
    var cancel = el('button', { type: 'button', class: 'mat-btn mat-btn--secondary', 'data-dialog-close': '', text: 'Schließen' });
    var foot = el('div', { class: 'mat-dialog__foot' }, el('div', { class: 'mat-btn-row mat-btn-row--plain' }, [use, edit, el('span', { class: 'mat-btn-row__spacer' }), cancel]));
    dlg.appendChild(el('div', { class: 'mat-dialog__form' }, [head, body, foot]));
    document.body.appendChild(dlg);

    var switcher = null;

    function current() { return variants[state.index]; }

    function drawPages(variant) {
      var token = ++state.seq;
      pagesEl.textContent = '';
      pagesEl.scrollTop = 0;
      var loading = el('p', { class: 'dt-tpv__status', role: 'status', text: 'Die Vorlage wird geladen …' });
      pagesEl.appendChild(loading);
      var url = '/api/designs/' + variant.id;
      if (!window.DtPreviews || !window.DtPreviews.document) { loading.textContent = 'Die Vorschau ist nicht verfügbar.'; return; }
      window.DtPreviews.document(url).then(function (data) {
        if (token !== state.seq) { return; }
        var doc = window.DtEngine ? window.DtEngine.normalize(data.document) : data.document;
        pagesEl.textContent = '';
        doc.pages.forEach(function (page, i) {
          var box = el('span', { class: 'dt-designthumb', 'data-dt-preview': String(variant.id), 'data-dt-preview-url': url, 'data-dt-preview-page': String(i), 'aria-hidden': 'true' });
          var sheet = el('div', { class: 'dt-tpv__sheet', 'data-fold': doc.fold || 'none' }, box);
          sheet.style.setProperty('--dt-arn', String(doc.width / doc.height));
          var caption = el('figcaption', { class: 'dt-tpv__caption', text: page.name || (doc.pages.length > 1 ? 'Seite ' + (i + 1) : 'Seite') });
          pagesEl.appendChild(el('figure', { class: 'dt-tpv__page', 'data-page': String(i) }, [sheet, caption]));
          window.DtPreviews.add(box);
        });
        pagesEl.setAttribute('data-pages', String(doc.pages.length));
        var count = side.querySelector('[data-tpv-pages]');
        if (count) { count.textContent = doc.pages.length + ' ' + plural(doc.pages.length); }
      }, function () {
        if (token !== state.seq) { return; }
        loading.textContent = 'Die Vorlage konnte nicht geladen werden. Prüfe die Verbindung.';
      });
    }

    function row(label, value) {
      return el('div', { class: 'dt-tpv__row' }, [el('dt', { text: label }), el('dd', { text: value })]);
    }

    function drawSide() {
      var v = current();
      side.textContent = '';
      if (variants.length > 1) { side.appendChild(el('h3', { class: 'dt-tpv__name', text: v.name })); }
      if (variants.length > 1) {
        var group = el('div', { class: 'dt-tpv__variants', role: 'radiogroup', 'aria-label': 'Variante' });
        variants.forEach(function (x, i) {
          var b = el('button', { type: 'button', class: 'dt-tpv__variant' + (i === state.index ? ' is-active' : ''), role: 'radio', 'aria-checked': String(i === state.index), tabindex: i === state.index ? '0' : '-1', 'data-variant-id': x.id, text: x.variant || ('Variante ' + (i + 1)) });
          b.addEventListener('click', function () { choose(i, true); });
          group.appendChild(b);
        });
        group.addEventListener('keydown', function (ev) {
          var step = ev.key === 'ArrowRight' || ev.key === 'ArrowDown' ? 1 : (ev.key === 'ArrowLeft' || ev.key === 'ArrowUp' ? -1 : 0);
          if (!step) { return; }
          ev.preventDefault();
          choose((state.index + step + variants.length) % variants.length, true);
        });
        switcher = group;
        side.appendChild(group);
      } else { switcher = null; }
      if (v.description) { side.appendChild(el('p', { class: 'dt-tpv__text', text: v.description })); }
      var list = el('dl', { class: 'dt-tpv__facts' });
      var pages = el('div', { class: 'dt-tpv__row' }, [el('dt', { text: 'Umfang' }), el('dd', { 'data-tpv-pages': '', text: '…' })]);
      list.appendChild(row('Größe', v.size));
      if (v.formatName) { list.appendChild(row('Format', v.formatName)); }
      if (v.formatNote) { list.appendChild(row('Hinweis', v.formatNote)); }
      list.appendChild(pages);
      if (v.occasion) { list.appendChild(row('Anlass', v.occasion)); }
      side.appendChild(list);
      if (v.tags && v.tags.length) {
        side.appendChild(el('ul', { class: 'dt-tpv__tags', 'aria-label': 'Stichworte' }, v.tags.slice(0, 8).map(function (t) { return el('li', { text: t }); })));
      }
      if (v.fold && v.fold !== 'none') {
        side.appendChild(el('p', { class: 'mat-hint', text: 'Die gestrichelte Linie zeigt die Falz. Sie erscheint nur im Editor, nie im Druck oder Download.' }));
      }
    }

    function choose(i, focus) {
      state.index = i;
      var v = current();
      drawSide();
      drawPages(v);
      use.setAttribute('aria-label', 'Vorlage „' + v.name + '“ verwenden');
      use.setAttribute('data-use-template', String(v.id));
      edit.hidden = !v.canEdit;
      edit.setAttribute('href', '/Designs/' + v.id + '/Designer');
      edit.setAttribute('aria-label', 'Vorlage „' + v.name + '“ bearbeiten');
      dlg.setAttribute('data-template', String(v.id));
      if (focus && switcher) { var active = switcher.querySelector('.is-active'); if (active) { active.focus(); } }
    }

    // "Vorlage verwenden" carries data-use-template: create.js (document level) copies the template and opens the copy
    dlg.addEventListener('close', function () { state.seq++; setTimeout(function () { dlg.remove(); }, 0); });
    choose(state.index, false);
    window.MatUi.dialog.open(dlg);
    return { close: function () { window.MatUi.dialog.close(dlg, 'cancel'); }, dialog: dlg };
  }

  function openById(id) {
    return U.get('/api/templates/' + encodeURIComponent(id) + '/family').then(function (result) {
      if (!result.ok || !result.data) { U.toast(U.problem(result), 'danger'); return null; }
      return open(result.data, id);
    });
  }

  document.addEventListener('click', function (event) {
    if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) { return; }
    var target = event.target;
    if (!(target instanceof Element)) { return; }
    var trigger = target.closest('[data-preview-template]');
    if (!trigger || trigger.hasAttribute('data-preview-local')) { return; }
    event.preventDefault();
    openById(trigger.getAttribute('data-preview-template'));
  });

  window.DtTemplatePreview = { open: open, openById: openById };
})();
