/* DesignThix: small behaviours of the library pages (phase E), wired by data attributes. No inline styles, no inline scripts: a value that is data is set
   through the CSSOM (el.style.setProperty) or as an SVG attribute; nothing here builds markup from text (createElement, createElementNS, textContent).
   - data-dt-specimen: a line set in a font of the library (the style sheet /fonts.css makes the family known to the page)
   - data-dt-sheet-preview: the live preview of a sheet layout (SVG), fed by the fields of the form
   - data-dt-columns: the column editor of a data list (add, remove, move, renumber on submit) */
(function () {
  'use strict';

  var doc = document;
  var SVG = 'http://www.w3.org/2000/svg';
  var $ = function (sel, scope) { return (scope || doc).querySelector(sel); };
  var $$ = function (sel, scope) { return Array.prototype.slice.call((scope || doc).querySelectorAll(sel)); };

  function svg(name, attrs, parent) {
    var el = doc.createElementNS(SVG, name);
    Object.keys(attrs || {}).forEach(function (k) { el.setAttribute(k, String(attrs[k])); });
    if (parent) { parent.appendChild(el); }
    return el;
  }

  // ================================================================================================ font specimens

  /** The weight to show for a font whose weight is "400" or a range ("100 900"): 400 when the range holds it, else its nearest end. */
  function specimenWeight(text) {
    var parts = String(text || '400').match(/\d+/g) || ['400'];
    var low = Number(parts[0]);
    var high = Number(parts[parts.length - 1]);
    if (low > high) { var t = low; low = high; high = t; }
    return Math.min(Math.max(400, low), high);
  }

  /** Sets one specimen in its font. A line gets its font only when it comes near the screen (the browser then loads that one file): a list of 50 fonts does not load 50 files at once. */
  function setSpecimen(el) {
    var family = el.getAttribute('data-family') || '';
    el.style.setProperty('font-family', "'" + family.replace(/['"\\]/g, '') + "', sans-serif");
    el.style.setProperty('font-weight', String(specimenWeight(el.getAttribute('data-weight'))));
    el.style.setProperty('font-style', el.getAttribute('data-style') === 'italic' ? 'italic' : 'normal');
    el.setAttribute('data-specimen-set', '');
  }

  var specimens = $$('[data-dt-specimen]');
  if ('IntersectionObserver' in window && specimens.length > 12) {
    var specimenObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { specimenObserver.unobserve(entry.target); setSpecimen(entry.target); }
      });
    }, { rootMargin: '300px' });
    specimens.forEach(function (el) { specimenObserver.observe(el); });
  } else {
    specimens.forEach(setSpecimen);
  }

  // ================================================================================================ sheet preview

  var sheetForm = $('[data-dt-sheet-form]');
  var sheetHost = sheetForm ? $('[data-dt-sheet-preview]', sheetForm) : null;
  if (sheetForm && sheetHost) {
    var info = $('[data-dt-sheet-info]', sheetForm);
    var field = function (name) {
      var input = sheetForm.querySelector('[name="Input.' + name + '"]');
      var n = input ? parseFloat(String(input.value).replace(',', '.')) : NaN;
      return isFinite(n) ? n : 0;
    };
    var crop = sheetForm.querySelector('input[type="checkbox"][name="Input.CropMarks"]');

    var draw = function () {
      var paperW = Math.max(1, field('PaperWidth'));
      var paperH = Math.max(1, field('PaperHeight'));
      var marginTop = Math.max(0, field('MarginTop'));
      var marginLeft = Math.max(0, field('MarginLeft'));
      var cols = Math.max(1, Math.min(50, Math.round(field('Columns'))));
      var rows = Math.max(1, Math.min(50, Math.round(field('Rows'))));
      var cellW = Math.max(0.1, field('CellWidth'));
      var cellH = Math.max(0.1, field('CellHeight'));
      var gapX = Math.max(0, field('GapX'));
      var gapY = Math.max(0, field('GapY'));
      var marks = !!(crop && crop.checked);

      var pad = Math.max(paperW, paperH) * 0.02;
      sheetHost.textContent = '';
      var root = svg('svg', { viewBox: [-pad, -pad, paperW + 2 * pad, paperH + 2 * pad].join(' '), role: 'img', 'aria-label': 'Vorschau des Druckbogens', class: 'dt-sheetsvg' }, sheetHost);
      svg('rect', { x: 0, y: 0, width: paperW, height: paperH, class: 'dt-sheetsvg__paper' }, root);
      var fontSize = Math.max(2, Math.min(cellW, cellH) * 0.18);
      var strokeWidth = Math.max(paperW, paperH) / 400;
      var markLength = Math.min(cellW, cellH) * 0.12;
      var outside = false;
      for (var r = 0; r < rows; r++) {
        for (var c = 0; c < cols; c++) {
          var x = marginLeft + c * (cellW + gapX);
          var y = marginTop + r * (cellH + gapY);
          if (x + cellW > paperW + 0.01 || y + cellH > paperH + 0.01) { outside = true; }
          var cell = svg('g', {}, root);
          svg('rect', { x: x, y: y, width: cellW, height: cellH, 'stroke-width': strokeWidth, class: 'dt-sheetsvg__cell' + (x + cellW > paperW + 0.01 || y + cellH > paperH + 0.01 ? ' is-outside' : '') }, cell);
          var label = svg('text', { x: x + cellW / 2, y: y + cellH / 2, 'font-size': fontSize, 'text-anchor': 'middle', 'dominant-baseline': 'central', class: 'dt-sheetsvg__label' }, cell);
          label.textContent = String(r * cols + c + 1);
          if (marks) {
            [[x, y, 1, 1], [x + cellW, y, -1, 1], [x, y + cellH, 1, -1], [x + cellW, y + cellH, -1, -1]].forEach(function (p) {
              svg('path', { d: 'M' + (p[0] - p[2] * markLength) + ' ' + p[1] + ' H' + p[0] + ' M' + p[0] + ' ' + (p[1] - p[3] * markLength) + ' V' + p[1], 'stroke-width': strokeWidth, class: 'dt-sheetsvg__mark' }, cell);
            });
          }
        }
      }

      if (info) {
        var usedW = marginLeft + cols * cellW + (cols - 1) * gapX;
        var usedH = marginTop + rows * cellH + (rows - 1) * gapY;
        var round = function (n) { return String(Math.round(n * 10) / 10).replace('.', ','); };
        info.textContent = cols * rows + ' Etiketten pro Bogen. Belegt: ' + round(usedW) + ' × ' + round(usedH) + ' mm von ' + round(paperW) + ' × ' + round(paperH) + ' mm.'
          + (outside ? ' Achtung: Etiketten liegen außerhalb des Papiers.' : '');
      }
    };

    sheetForm.addEventListener('input', draw);
    sheetForm.addEventListener('change', draw);
    draw();
  }

  // ================================================================================================ column editor

  var columnsForm = $('[data-dt-columns]');
  if (columnsForm) {
    var rowsHost = $('[data-dt-colrows]', columnsForm);
    var template = $('template[data-dt-col-template]', columnsForm);
    var emptyNote = $('[data-dt-col-empty]', columnsForm);

    var syncRow = function (row) {
      var type = $('[data-dt-col-type]', row);
      var value = type ? type.value : 'text';
      var decimals = $('[data-dt-col-decimals]', row);
      var category = $('[data-dt-col-category]', row);
      if (decimals) { decimals.hidden = !(value === 'number' || value === 'price'); }
      if (category) { category.hidden = value !== 'image'; }
    };

    var refresh = function () {
      var rows = $$('[data-dt-colrow]', rowsHost);
      if (emptyNote) { emptyNote.hidden = rows.length > 0; }
      rows.forEach(function (row, i) {
        var up = $('[data-dt-col-up]', row);
        var down = $('[data-dt-col-down]', row);
        if (up) { up.disabled = i === 0; }
        if (down) { down.disabled = i === rows.length - 1; }
      });
    };

    // The form posts Columns[0], Columns[1] ...: the rows are numbered again in their current order (gaps from removed rows would hide the rest).
    var renumber = function () {
      $$('[data-dt-colrow]', rowsHost).forEach(function (row, i) {
        $$('[name^="Columns["]', row).forEach(function (input) {
          input.name = input.name.replace(/^Columns\[[^\]]*\]/, 'Columns[' + i + ']');
        });
      });
    };

    columnsForm.addEventListener('click', function (e) {
      var target = e.target.closest ? e.target.closest('button') : null;
      if (!target) { return; }
      if (target.hasAttribute('data-dt-col-add') && template) {
        var fragment = template.content.cloneNode(true);
        var added = fragment.querySelector('[data-dt-colrow]');
        // Unique ids for the new row: the labels point to them.
        var n = $$('[data-dt-colrow]', rowsHost).length + '-' + Date.now().toString(36);
        $$('[id]', fragment).forEach(function (el) { el.id = el.id.replace('__i__', 'n' + n); });
        $$('label[for]', fragment).forEach(function (el) { el.setAttribute('for', el.getAttribute('for').replace('__i__', 'n' + n)); });
        rowsHost.appendChild(fragment);
        syncRow(added);
        refresh();
        var key = added && added.querySelector('input');
        if (key) { key.focus(); }
        return;
      }

      var row = target.closest('[data-dt-colrow]');
      if (!row) { return; }
      if (target.hasAttribute('data-dt-col-remove')) {
        var next = row.nextElementSibling || row.previousElementSibling;
        row.remove();
        refresh();
        var focusTarget = next && next.querySelector('input');
        if (focusTarget) { focusTarget.focus(); }
      } else if (target.hasAttribute('data-dt-col-up') && row.previousElementSibling) {
        rowsHost.insertBefore(row, row.previousElementSibling);
        refresh();
        target.focus();
      } else if (target.hasAttribute('data-dt-col-down') && row.nextElementSibling) {
        rowsHost.insertBefore(row.nextElementSibling, row);
        refresh();
        target.focus();
      }
    });

    columnsForm.addEventListener('change', function (e) {
      if (e.target.matches && e.target.matches('[data-dt-col-type]')) { syncRow(e.target.closest('[data-dt-colrow]')); }
    });

    columnsForm.addEventListener('submit', renumber);
    $$('[data-dt-colrow]', rowsHost).forEach(syncRow);
    refresh();
  }
})();
