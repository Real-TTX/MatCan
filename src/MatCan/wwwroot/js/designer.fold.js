/* MatCan editor: folded cards (plan 6, docs/PLAN-TEMPLATES.md section 2). The document has an optional `fold` ('vertical' | 'horizontal', written only when set): the fold line runs through the
   middle of every page (a vertical fold: a line at half the width, the left half is the back of the card and the right half the front on the outside page). The editor draws NON-PRINTING guides:
   a dashed fold line and a dashed safe margin inside every half (4 mm for a card, 10 mm for a larger sheet). The guides are a layer of their own (#dt-fold) inside the sheet, next to the
   comment pins: they are never part of the document, so no download, print, thumbnail, public view or output ever shows them. Positions are percentages of the sheet, so zooming needs no redraw.
   The toolbar of the page gets "Falz": none / vertical / horizontal (one undo step; switching a one-page design to a fold adds the page "Innen" and names both pages) and the switch "Hilfslinien".
   D.cardFold = { init(app), guidesVisible(), setGuides(bool), setFold(value), panels() }. Needs designer.core, .toolbar, .ui. */
(function () {
  'use strict';

  var D = window.DtDesigner;
  var app = null;
  var layer = null;
  var KEY = 'dt-fold-guides';
  var visible = true;

  try { visible = window.localStorage.getItem(KEY) !== 'off'; } catch (e) { /* the default stays */ }

  /** The safe margin in document units: 4 mm for a card, 10 mm for a sheet of paper (an A4 page), a fixed share for screen sizes. */
  function safeMargin(doc, panelW, panelH) {
    if (doc.unit === 'px') { return Math.round(Math.min(panelW, panelH) * 0.04); }
    return Math.max(panelW, panelH) <= 160 ? 4 : 10;
  }

  /** The halves of the sheet: [] without a fold, else two boxes in document units { x, y, w, h }. */
  function panels(doc) {
    doc = doc || app.doc;
    if (doc.fold === 'vertical') { return [{ x: 0, y: 0, w: doc.width / 2, h: doc.height }, { x: doc.width / 2, y: 0, w: doc.width / 2, h: doc.height }]; }
    if (doc.fold === 'horizontal') { return [{ x: 0, y: 0, w: doc.width, h: doc.height / 2 }, { x: 0, y: doc.height / 2, w: doc.width, h: doc.height / 2 }]; }
    return [];
  }

  function pct(value, total) { return String(Math.round((value / total) * 100000) / 1000); }

  function draw() {
    if (!layer || !app.doc) { return; }
    D.empty(layer);
    var doc = app.doc;
    var halves = panels(doc);
    var show = halves.length > 0 && visible;
    layer.hidden = !show;
    layer.setAttribute('data-fold', doc.fold || 'none');
    if (!show) { return; }
    var line = D.el('span', { class: 'dt-fold__line dt-fold__line--' + doc.fold, 'data-fold-line': doc.fold });
    layer.appendChild(line);
    layer.appendChild(D.el('span', { class: 'dt-fold__tag dt-fold__tag--' + doc.fold, text: 'Falz' }));
    halves.forEach(function (h, i) {
      var m = safeMargin(doc, h.w, h.h);
      var box = D.el('span', { class: 'dt-fold__safe', 'data-fold-safe': String(i) });
      box.style.setProperty('--dt-fx', pct(h.x + m, doc.width) + '%');
      box.style.setProperty('--dt-fy', pct(h.y + m, doc.height) + '%');
      box.style.setProperty('--dt-fw', pct(h.w - 2 * m, doc.width) + '%');
      box.style.setProperty('--dt-fh', pct(h.h - 2 * m, doc.height) + '%');
      layer.appendChild(box);
    });
  }

  function setGuides(on) {
    visible = !!on;
    try { window.localStorage.setItem(KEY, visible ? 'on' : 'off'); } catch (e) { /* ignore */ }
    draw();
  }

  /** Sets the fold ('none' | 'vertical' | 'horizontal') as ONE undo step. A one-page design that gets a fold gains the page "Innen"; empty page names get the standard names of a folded card. */
  function setFold(value) {
    if (!app.editable() || ['none', 'vertical', 'horizontal'].indexOf(value) < 0 || (app.doc.fold || 'none') === value) { return false; }
    var names = value === 'vertical' ? ['Außen (Rückseite | Vorderseite)', 'Innen'] : (value === 'horizontal' ? ['Außen (Rückseite oben | Vorderseite unten)', 'Innen'] : []);
    var makeId = D.pageIdMaker(app.doc);
    app.edit(function (doc) {
      if (value === 'none') { delete doc.fold; } else { doc.fold = value; }
      if (names.length) {
        if (doc.pages.length === 1) { doc.pages.push({ id: makeId(), name: '', background: D.clone(doc.pages[0].background), elements: [] }); }
        doc.pages.slice(0, 2).forEach(function (p, i) { if (!p.name) { p.name = names[i]; } });
      }
    }, { structure: true, reason: 'fold' });
    app.emit('pages');
    draw();
    return true;
  }

  function init(theApp) {
    app = theApp;
    var sheet = document.getElementById('dt-sheet');
    var overlay = document.getElementById('dt-overlay');
    if (!sheet) { return; }
    layer = D.el('div', { class: 'dt-fold', id: 'dt-fold', 'aria-hidden': 'true', hidden: true });
    sheet.insertBefore(layer, overlay);
    ['doc', 'page', 'pages', 'history'].forEach(function (name) { app.on(name, draw); });
    draw();
  }

  D.toolbar.extend('page', function (c, controls) {
    if (c.ro) { return controls; }
    app = app || c.app;   // the toolbar is built before init() runs
    var button = c.popoverButton({ icon: 'layout-template', text: 'Falz', label: 'Falz (Klappkarte)', title: 'Klappkarte: Falzlinie und Rand als Hilfslinien einblenden', width: 300, always: true, build: function (el) {
      var seg = D.ui.segmented({ label: 'Falz', value: app.doc.fold || 'none', options: [{ value: 'none', label: 'Keiner' }, { value: 'vertical', label: 'Senkrecht' }, { value: 'horizontal', label: 'Waagerecht' }], onChange: function (v) { setFold(v); seg.set(v); } });
      var guides = D.ui.switchBox({ label: 'Hilfslinien zeigen', value: visible, onChange: setGuides });
      el.appendChild(D.el('div', { class: 'dt-pop' }, [
        D.el('h4', { class: 'dt-pop__title', text: 'Falz' }),
        seg.el,
        D.el('p', { class: 'dt-pop__hint', text: 'Die Seite ist der aufgeklappte Bogen: Die Falz liegt in der Mitte. Falzlinie und Rand erscheinen nur im Editor, nie im Druck oder Download.' }),
        guides.el,
      ]));
    } });
    var sync = function () { button.classList.toggle('is-active', !!app.doc.fold && app.doc.fold !== 'none'); };
    sync();
    c.refresh(sync);
    var at = controls.indexOf('sep');
    controls.splice(at < 0 ? controls.length : at + 1, 0, button);
    return controls;
  });

  D.cardFold = { init: init, guidesVisible: function () { return visible; }, setGuides: setGuides, setFold: setFold, panels: function () { return panels(); }, safeMargin: safeMargin };
})();
