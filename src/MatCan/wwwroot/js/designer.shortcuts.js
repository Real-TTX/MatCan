/* MatCan editor, part 14: the keyboard and the clipboard events, and the dialog "Tastenkürzel" (key ? and Datei menu). One list (D.shortcuts.list) feeds the dialog; the handler
   below implements it. Shortcuts never fire while a text field, a menu or a dialog has the keys (Ctrl+S saves everywhere). Copy and cut go through the clipboard events (so the text
   reaches the system clipboard); paste is handled in designer.io.js. */
(function () {
  'use strict';

  var D = window.DtDesigner;
  var app;
  var M = D.modKey;

  var LIST = [
    ['Allgemein', [
      [M + '+S', 'Sofort speichern (sonst speichert der Editor von selbst)'], [M + '+Z', 'Rückgängig'], [M + '+Y  oder  ' + M + '+⇧+Z', 'Wiederholen'],
      ['Esc', 'Auswahl aufheben, Menü oder Bearbeiten beenden'], ['?', 'Diese Liste der Tastenkürzel'],
    ]],
    ['Elemente hinzufügen', [['T', 'Text'], ['R', 'Rechteck'], ['C', 'Kreis'], ['L', 'Linie']]],
    ['Auswahl', [
      [M + '+A', 'Alles auswählen'], ['⇧ + Klick', 'Zur Auswahl hinzufügen oder abwählen'], [M + ' + Klick', 'Direkt ein Element in einer Gruppe wählen'], ['Doppelklick', 'Text bearbeiten, in eine Gruppe hineinwählen, Bild zuschneiden'],
      ['Entf', 'Löschen'], ['Pfeiltasten', 'Verschieben (mit ⇧ in großen Schritten)'], ['Enter', 'Text bearbeiten'],
    ]],
    ['Bearbeiten', [
      [M + '+C', 'Kopieren'], [M + '+X', 'Ausschneiden'], [M + '+V', 'Einfügen (auch Bilder aus der Zwischenablage)'], [M + '+D', 'Duplizieren'],
      [M + '+Alt+C', 'Stil kopieren'], [M + '+Alt+V', 'Stil einfügen'], [M + '+G', 'Gruppieren'], [M + '+⇧+G', 'Gruppierung aufheben'],
      [M + '+]  /  ' + M + '+[', 'Eine Ebene nach vorne / hinten'], [M + '+⇧+]  /  ' + M + '+⇧+[', 'Ganz nach vorne / hinten'],
      ['Alt + Ziehen', 'Kopie ziehen'], ['⇧ + Ziehen', 'Nur waagerecht oder senkrecht verschieben'], ['Alt beim Ziehen', 'Einrasten ausschalten'],
    ]],
    ['Text', [[M + '+B', 'Fett'], [M + '+I', 'Kursiv'], [M + '+U', 'Unterstrichen']]],
    ['Kommentare', [['K', 'Kommentar zur Auswahl schreiben (ohne Auswahl: zur Seite)'], ['@', 'Im Kommentar jemanden erwähnen'], [M + '+Enter', 'Kommentar absenden'], ['Esc', 'Pin setzen abbrechen']]],
    ['Ansicht', [
      [M + '+0', 'Seite einpassen'], [M + '+1', '100 %'], [M + ' + Mausrad', 'Zoomen (auch Pinch auf dem Touchscreen)'], ['+  /  −', 'Vergrößern / verkleinern'],
      ['Leertaste + Ziehen', 'Ansicht verschieben (auch mittlere Maustaste, zwei Finger)'],
    ]],
  ];

  function dialog() {
    return D.dialog.show({
      title: 'Tastenkürzel', icon: 'keyboard', size: 'lg', className: 'dt-keysdlg',
      body: function (body) {
        LIST.forEach(function (group) {
          var dl = D.el('dl', { class: 'dt-keys' });
          group[1].forEach(function (row) {
            dl.appendChild(D.el('dt', null, row[0].split('  oder  ').map(function (k, i) { return [i ? D.el('span', { class: 'dt-keys__or', text: 'oder' }) : null, D.el('kbd', { text: k })]; }).reduce(function (a, b) { return a.concat(b); }, [])));
            dl.appendChild(D.el('dd', { text: row[1] }));
          });
          body.appendChild(D.el('section', { class: 'dt-keys__group' }, [D.el('h3', { class: 'dt-psec__title', text: group[0] }), dl]));
        });
      },
      buttons: [{ label: 'Schließen', kind: 'primary', value: 'ok' }],
    });
  }

  function isTyping(t) {
    if (!t || !t.tagName) { return false; }
    return t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName);
  }

  function dialogOpen() { return !!document.querySelector('dialog[open]'); }

  function init(theApp, viewport) {
    app = theApp;

    document.addEventListener('keydown', function (ev) {
      var key = ev.key;
      var mod = ev.ctrlKey || ev.metaKey;
      if (mod && !ev.shiftKey && !ev.altKey && (key === 's' || key === 'S')) { ev.preventDefault(); D.save.now({ force: true }); return; }
      if (!app.doc) { return; }
      if (dialogOpen() || D.menu.isOpen()) { return; }
      var typing = isTyping(ev.target);
      if (typing) { return; }
      var lower = key.length === 1 ? key.toLowerCase() : key;
      var atCanvas = ev.target === document.body || ev.target === viewport || ev.target === document.documentElement || !ev.target || (ev.target.closest && !ev.target.closest('.dt-panel, .dt-ctx, .dt-bottom, .dt-top, .dt-tabbar'));
      var editable = app.editable();

      if (mod && lower === 'z') { ev.preventDefault(); if (ev.shiftKey) { app.redo(); } else { app.undo(); } return; }
      if (mod && lower === 'y') { ev.preventDefault(); app.redo(); return; }
      if (mod && lower === 'a') { ev.preventDefault(); app.selectAll(); return; }
      if (mod && !ev.altKey && lower === 'd') { ev.preventDefault(); if (editable) { app.duplicateSelection(); } return; }
      if (mod && lower === 'g') { ev.preventDefault(); if (editable) { if (ev.shiftKey) { D.cmd.ungroup(); } else { D.cmd.group(); } } return; }
      if (mod && ev.altKey && (ev.code === 'KeyC' || lower === 'c')) { ev.preventDefault(); app.copyStyle(); return; }
      if (mod && ev.altKey && (ev.code === 'KeyV' || lower === 'v')) { ev.preventDefault(); if (editable) { app.pasteStyle(); } return; }
      if (mod && !ev.altKey && (key === ']' || key === '[' || key === '}' || key === '{' || ev.code === 'BracketRight' && key !== '+' && key !== '*' || ev.code === 'BracketLeft' && key !== 'ü')) {
        var forward = key === ']' || key === '}' || ev.code === 'BracketRight';
        ev.preventDefault();
        if (editable) { app.order(ev.shiftKey ? (forward ? 'front' : 'back') : (forward ? 'forward' : 'backward')); }
        return;
      }
      if (mod && !ev.shiftKey && !ev.altKey && /^[biu]$/.test(lower)) {
        var texts = app.selected().filter(function (e) { return e.type === 'text' && !e.locked; });
        if (texts.length && editable) { ev.preventDefault(); app.emit('format', lower); }
        return;
      }
      if (mod && key === '0') { ev.preventDefault(); D.canvas.fit(); return; }
      if (mod && key === '1') { ev.preventDefault(); D.canvas.setZoom(1, false); return; }
      if (mod && (key === '+' || key === '=')) { ev.preventDefault(); D.canvas.stepZoom(1); return; }
      if (mod && key === '-') { ev.preventDefault(); D.canvas.stepZoom(-1); return; }
      if (mod || ev.altKey) { return; }
      if (key === ' ' || key === 'Spacebar') { if (atCanvas) { ev.preventDefault(); D.canvas.setSpace(true); } return; }
      if (key === 'Escape') {
        if (D.canvas.hasGesture()) { D.canvas.cancelGesture(); return; }
        if (D.popover.isOpen()) { D.popover.close(true); return; }
        if (window.matchMedia('(max-width: 1023px)').matches && D.panels.isOpen()) { D.panels.close(); return; }
        if (app.sel.length) { app.select([]); }
        return;
      }
      if (!atCanvas) { return; }
      if (key === '+' || key === '=') { D.canvas.stepZoom(1); return; }
      if (key === '-') { D.canvas.stepZoom(-1); return; }
      if (key === '?') { ev.preventDefault(); dialog(); return; }
      if (lower === 'k' && D.comments) { ev.preventDefault(); D.comments.compose(); return; }
      if (key === 'ContextMenu' || (key === 'F10' && ev.shiftKey)) {
        ev.preventDefault();
        var one = app.single();
        var rect = one ? D.canvas.clientRectOf(one.id) : null;
        if (rect) { D.canvas.contextMenuAt(rect.left + rect.width / 2, rect.top + rect.height / 2); }
        else { var vr = viewport.getBoundingClientRect(); D.canvas.contextMenuAt(vr.left + vr.width / 2, vr.top + vr.height / 2); }
        return;
      }
      if (!editable) { return; }
      if (key === 'Delete' || key === 'Backspace') { if (app.sel.length) { ev.preventDefault(); app.deleteSelection(); } return; }
      if (key === 'Enter') { var single = app.single(); if (single && single.type === 'text') { ev.preventDefault(); D.canvas.startTextEdit(single.id, { selectAll: false }); } return; }
      if (key.indexOf('Arrow') === 0 && app.sel.length) {
        ev.preventDefault();
        var step = D.nudgeStep(app.doc) * (ev.shiftKey ? 10 : 1);
        app.nudge(key === 'ArrowLeft' ? -step : (key === 'ArrowRight' ? step : 0), key === 'ArrowUp' ? -step : (key === 'ArrowDown' ? step : 0));
        return;
      }
      // letters that add something
      var added = null;
      if (lower === 't') { added = app.addElement('text'); if (added) { D.canvas.startTextEdit(added, { selectAll: true }); } ev.preventDefault(); return; }
      if (lower === 'r') { app.addElement('rect'); ev.preventDefault(); return; }
      if (lower === 'c') { app.addElement('ellipse'); ev.preventDefault(); return; }
      if (lower === 'l') { app.addElement('line'); ev.preventDefault(); return; }
    });

    document.addEventListener('keyup', function (ev) { if (ev.key === ' ' || ev.key === 'Spacebar') { D.canvas.setSpace(false); } });
    window.addEventListener('blur', function () { D.canvas.setSpace(false); });

    var clipboardTarget = function (ev) { return !isTyping(ev.target) && !dialogOpen() && app.doc; };
    document.addEventListener('copy', function (ev) {
      if (!clipboardTarget(ev) || !app.sel.length) { return; }
      var json = app.copySelection();
      if (json && ev.clipboardData) { ev.clipboardData.setData('text/plain', json); ev.preventDefault(); }
    });
    document.addEventListener('cut', function (ev) {
      if (!clipboardTarget(ev) || !app.sel.length || !app.editable()) { return; }
      var json = app.copySelection();
      if (json && ev.clipboardData) { ev.clipboardData.setData('text/plain', json); ev.preventDefault(); }
      app.deleteSelection();
    });
  }

  D.shortcuts = { init: init, dialog: dialog, list: LIST };
})();
