/* MatCan editor, part 6: the commands people trigger from several places (toolbar, context menu, keyboard, panels) live here once (D.cmd.*), and the entries of the
   context menu (D.contextItems for a node, D.pageMenuItems for the empty page, D.pageThumbItems for a thumbnail of the page strip). A command reads the selection from the app,
   checks what it needs and says why when it cannot run (toast). Shortcut texts are for display; the keys themselves are handled in designer.shortcuts.js. */
(function () {
  'use strict';

  var D = window.DtDesigner;
  var M = D.modKey;
  var cmd = D.cmd = {};

  function app() { return D.app; }

  function selectedEditable() { return app().selected().filter(function (e) { return !e.locked; }); }

  // ---------------------------------------------------------------------------------------- clipboard
  cmd.copy = function () {
    var a = app();
    var json = a.copySelection();
    if (!json) { return false; }
    if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(json).catch(function () { /* the internal copy is enough */ }); }
    return true;
  };

  cmd.cut = function () {
    if (!app().editable() || !app().sel.length) { return; }
    if (cmd.copy()) { app().deleteSelection(); }
  };

  /** Paste for the menu and the toolbar: images of the system clipboard are uploaded, text becomes a text element, our own copies come back as elements. */
  cmd.paste = function () {
    var a = app();
    if (!a.editable()) { return Promise.resolve(false); }
    var fallback = function () { return a.paste(''); };
    if (!navigator.clipboard || !navigator.clipboard.read) {
      if (navigator.clipboard && navigator.clipboard.readText) { return navigator.clipboard.readText().then(function (t) { return a.paste(t); }, fallback); }
      return Promise.resolve(fallback());
    }
    return navigator.clipboard.read().then(function (items) {
      var chain = Promise.resolve(false);
      var handled = false;
      items.forEach(function (item) {
        if (handled) { return; }
        var imageType = item.types.find(function (t) { return /^image\//.test(t); });
        if (imageType) {
          handled = true;
          chain = item.getType(imageType).then(function (blob) { return D.io.insertFiles([new File([blob], '', { type: blob.type })], null); }).then(function () { return true; });
          return;
        }
        if (item.types.indexOf('text/plain') >= 0) {
          handled = true;
          chain = item.getType('text/plain').then(function (b) { return b.text(); }).then(function (t) { return a.paste(t); });
        }
      });
      return handled ? chain : fallback();
    }, function () { return fallback(); });
  };

  cmd.duplicate = function () { app().duplicateSelection(); };
  cmd.remove = function () { app().deleteSelection(); };
  cmd.group = function () {
    var a = app();
    if (a.sel.length < 2) { D.toast('Wähle mindestens zwei Elemente aus, um sie zu gruppieren.', 'warning'); return; }
    if (!a.canGroup()) { D.toast('Diese Elemente lassen sich nicht gruppieren (gesperrt oder aus verschiedenen Gruppen).', 'warning'); return; }
    a.group();
  };
  cmd.ungroup = function () { if (app().canUngroup()) { app().ungroup(); } else { D.toast('In der Auswahl ist keine Gruppe.', 'warning'); } };
  cmd.lock = function () { app().toggleLock(); };
  cmd.hide = function () { app().toggleHidden(); };
  cmd.order = function (mode) { app().order(mode); };
  cmd.align = function (mode) { app().align(mode, true); };

  /** Image: pick another medium for the selected image/frame (a strip: the first empty slot, or slot n). */
  cmd.replaceImage = function (slot) {
    var a = app();
    var e = a.single();
    if (!e || (e.type !== 'image' && e.type !== 'imageStrip') || e.locked || !a.editable()) { return; }
    var id = e.id;
    if (!window.DtMedia) { D.toast('Der Bildbrowser ist nicht verfügbar.', 'danger'); return; }
    window.DtMedia.pick({ title: e.type === 'imageStrip' ? 'Bild für den Platz wählen' : 'Bild wählen' }, function (key, asset) {
      if (!asset) { return; }
      a.addAssets([asset]);
      a.setSource(id, { asset: asset.key }, slot);
    });
  };

  cmd.canCrop = function () { return !!D.crop && typeof D.crop.start === 'function'; };
  cmd.crop = function () {
    var e = app().single();
    if (!e || e.type !== 'image' || !e.source) { return; }
    if (cmd.canCrop()) { D.crop.start(e.id); }
  };

  /** An image of the library becomes the background of the page (the element is removed). */
  cmd.setAsBackground = function () {
    var a = app();
    var e = a.single();
    if (!e || e.type !== 'image' || !e.source || !e.source.asset || !a.editable()) { return; }
    var key = e.source.asset;
    var id = e.id;
    a.edit(function (doc) {
      var bg = doc.pages[a.pageIndex].background;
      bg.asset = key;
      bg.fit = 'cover';
      var r = a.locate(id, false);
      if (r) { r.list.splice(r.index, 1); }
    }, { structure: true, reason: 'background' });
    a.select([]);
  };

  /** Page background picture through the media browser. */
  cmd.pickBackgroundImage = function () {
    var a = app();
    if (!a.editable() || !window.DtMedia) { return; }
    window.DtMedia.pick({ title: 'Hintergrundbild wählen' }, function (key, asset) {
      if (!asset) { return; }
      a.addAssets([asset]);
      a.setBackground({ asset: asset.key, fit: a.page().background.fit || 'cover' }, { merge: false });
    });
  };
  cmd.removeBackgroundImage = function () { app().setBackground({ asset: null }, { merge: false }); };

  cmd.addPage = function () { app().addPage(app().pageIndex); };
  cmd.duplicatePage = function (i) { app().duplicatePage(i); };
  cmd.deletePage = function (i) { app().deletePage(i); };

  /** Binds an image or a slot to a field (creating an image field when `key` is null: "Neues Bildfeld"). */
  cmd.bindField = function (id, key, slot) {
    var a = app();
    var field = key;
    if (!field) {
      field = a.freeKey('Bild');
      var err = a.addField({ key: field, label: 'Bild ' + field.replace('Bild', ''), type: 'image', sample: '' });
      if (err) { D.toast(err, 'warning'); return; }
    }
    a.setSource(id, { field: field }, slot);
  };

  // ---------------------------------------------------------------------------------------- the menus

  function shortcut(keys) { return keys; }

  /** The entries of the context menu of a node (or of a selection). */
  D.contextItems = function (node) {
    var a = app();
    var ro = !a.editable();
    var sel = a.selected();
    var locked = sel.length > 0 && sel.every(function (e) { return e.locked; });
    var anyUnlocked = selectedEditable().length > 0;
    var single = a.single();
    var dis = function (reason, cond) { return ro ? D.roText() : (cond ? reason : false); };
    var items = [
      { label: 'Kopieren', icon: 'copy', shortcut: shortcut(M + '+C'), run: cmd.copy },
      { label: 'Ausschneiden', icon: 'scissors', shortcut: shortcut(M + '+X'), run: cmd.cut, disabled: dis('Gesperrte Elemente lassen sich nicht ausschneiden.', !anyUnlocked) },
      { label: 'Einfügen', icon: 'clipboard-paste', shortcut: shortcut(M + '+V'), run: cmd.paste, disabled: dis('', false) },
      { label: 'Duplizieren', icon: 'copy-plus', shortcut: shortcut(M + '+D'), run: cmd.duplicate, disabled: dis('', false) },
      { label: 'Löschen', icon: 'trash', shortcut: 'Entf', run: cmd.remove, danger: true, disabled: dis('Gesperrte Elemente lassen sich nicht löschen. Entsperre sie zuerst.', !anyUnlocked) },
      { type: 'separator' },
      { label: 'Stil kopieren', icon: 'paintbrush', shortcut: shortcut(M + '+Alt+C'), run: function () { a.copyStyle(); }, disabled: !single ? 'Wähle ein einzelnes Element aus.' : false },
      { label: 'Stil einfügen', icon: 'paint-bucket', shortcut: shortcut(M + '+Alt+V'), run: function () { a.pasteStyle(); }, disabled: dis(a.styleClip ? 'Der kopierte Stil passt nicht zur Auswahl.' : 'Kopiere zuerst den Stil eines Elements.', !a.canPasteStyle()) },
      { type: 'separator' },
      {
        label: 'Ebene', icon: 'layers', disabled: dis('', false), submenu: [
          { label: 'Nach vorne', icon: 'arrow-up', shortcut: shortcut(M + '+]'), run: function () { cmd.order('forward'); } },
          { label: 'Ganz nach vorne', icon: 'bring-to-front', shortcut: shortcut(M + '+⇧+]'), run: function () { cmd.order('front'); } },
          { label: 'Nach hinten', icon: 'arrow-down', shortcut: shortcut(M + '+['), run: function () { cmd.order('backward'); } },
          { label: 'Ganz nach hinten', icon: 'send-to-back', shortcut: shortcut(M + '+⇧+['), run: function () { cmd.order('back'); } },
        ],
      },
      {
        label: 'An Seite ausrichten', icon: 'align-center-vertical', disabled: dis('Gesperrte Elemente lassen sich nicht verschieben.', !anyUnlocked), submenu: [
          { label: 'Links', icon: 'align-start-vertical', run: function () { cmd.align('left'); } },
          { label: 'Zentriert', icon: 'align-center-vertical', run: function () { cmd.align('centre'); } },
          { label: 'Rechts', icon: 'align-end-vertical', run: function () { cmd.align('right'); } },
          { label: 'Oben', icon: 'align-start-horizontal', run: function () { cmd.align('top'); } },
          { label: 'Mitte', icon: 'align-center-horizontal', run: function () { cmd.align('middle'); } },
          { label: 'Unten', icon: 'align-end-horizontal', run: function () { cmd.align('bottom'); } },
        ],
      },
      { label: 'Gruppieren', icon: 'group', shortcut: shortcut(M + '+G'), run: cmd.group, hidden: a.canUngroup() && sel.length === 1, disabled: dis('Wähle mindestens zwei Elemente aus, die nicht gesperrt sind.', !a.canGroup()) },
      { label: 'Gruppierung aufheben', icon: 'ungroup', shortcut: shortcut(M + '+⇧+G'), run: cmd.ungroup, hidden: !a.canUngroup(), disabled: dis('', false) },
      { label: locked ? 'Entsperren' : 'Sperren', icon: locked ? 'lock-open' : 'lock', run: cmd.lock, disabled: dis('', false) },
      { label: 'Ausblenden', icon: 'eye-off', run: cmd.hide, disabled: dis('', false) },
    ];
    // comments are the one thing somebody who may only look can write
    if (D.comments && D.comments.canComment()) {
      items.push({ type: 'separator' }, { label: 'Kommentieren', icon: 'message-square-plus', shortcut: 'K', run: function () { D.comments.compose(single ? { elementId: single.id } : {}); } });
    }
    if (single && !ro) {
      var extra = [];
      if (single.type === 'image') {
        extra.push({ label: single.source ? 'Bild ersetzen …' : 'Bild wählen …', icon: 'replace', run: function () { cmd.replaceImage(); }, disabled: single.locked ? 'Entsperre das Element zuerst.' : false });
        if (cmd.canCrop() && single.source) { extra.push({ label: 'Zuschneiden', icon: 'crop', run: cmd.crop, disabled: single.locked ? 'Entsperre das Element zuerst.' : false }); }
      }
      if (single.type === 'image' || single.type === 'shape' || single.type === 'icon') {
        extra.push({ label: 'Spiegeln', icon: 'arrow-left-right', disabled: single.locked ? 'Entsperre das Element zuerst.' : false, submenu: [
          { label: 'Horizontal', icon: 'arrow-left-right', run: function () { a.flip('x'); } },
          { label: 'Vertikal', icon: 'arrow-up-down', run: function () { a.flip('y'); } },
        ] });
      }
      if (single.type === 'image') {
        extra.push({ label: 'Als Hintergrund festlegen', icon: 'image-down', run: cmd.setAsBackground, disabled: !single.source ? 'Der Rahmen hat noch kein Bild.' : (!single.source.asset ? 'Nur ein Bild aus den Uploads kann Hintergrund werden, kein Feld.' : (single.locked ? 'Entsperre das Element zuerst.' : false)) });
      }
      if (single.type === 'text' && D.aiSuggest) {
        extra.push({ label: 'Mit KI formulieren', icon: 'sparkles', cls: 'dt-aibtn', run: D.aiSuggest, disabled: single.locked ? 'Entsperre das Element zuerst.' : false });
      }
      var fieldMenu = fieldBindingMenu(single);
      if (fieldMenu) { extra.push(fieldMenu); }
      if (extra.length) { items.push({ type: 'separator' }); extra.forEach(function (x) { items.push(x); }); }
    }
    return items;
  };

  /** "Feld zuweisen" (Zusatz): bind an image / a strip slot to a field of the design, or insert a placeholder into a QR code / barcode. */
  function fieldBindingMenu(e) {
    var a = app();
    if (e.type === 'image') {
      var imageFields = a.doc.fields.filter(function (f) { return f.type === 'image'; });
      var list = imageFields.map(function (f) { return { label: f.label && f.label !== f.key ? f.key + ' – ' + f.label : f.key, icon: 'braces', checked: !!(e.source && e.source.field && D.lower(e.source.field) === D.lower(f.key)), run: function () { cmd.bindField(e.id, f.key); } }; });
      if (list.length) { list.push({ type: 'separator' }); }
      list.push({ label: 'Neues Bildfeld …', icon: 'plus', run: function () { cmd.bindField(e.id, null); } });
      return { label: 'Feld zuweisen (Zusatz)', icon: 'braces', submenu: list, disabled: e.locked ? 'Entsperre das Element zuerst.' : false };
    }
    if (e.type === 'qr' || e.type === 'barcode') {
      var textFields = a.doc.fields.filter(function (f) { return f.type !== 'image'; });
      var items = textFields.map(function (f) { return { label: f.label && f.label !== f.key ? f.key + ' – ' + f.label : f.key, icon: 'braces', run: function () { a.insertPlaceholder(f.key); } }; });
      if (!items.length) { items.push({ label: 'Noch kein Feld', disabled: 'Lege im Reiter „Daten“ ein Feld an.' }); }
      return { label: 'Feld einfügen (Zusatz)', icon: 'braces', submenu: items };
    }
    return null;
  }
  D.fieldBindingMenu = fieldBindingMenu;

  /** The menu of the empty page (right click on the page). */
  D.pageMenuItems = function (point) {
    var a = app();
    var ro = !a.editable();
    var hasBg = !!a.page().background.asset;
    var dis = function (reason, cond) { return ro ? D.roText() : (cond ? reason : false); };
    return [
      { label: 'Einfügen', icon: 'clipboard-paste', shortcut: M + '+V', run: cmd.paste, disabled: dis('', false) },
      { label: 'Alles auswählen', icon: 'mouse-pointer-2', shortcut: M + '+A', run: function () { a.selectAll(); }, disabled: a.elements().length ? false : 'Auf dieser Seite ist noch nichts.' },
      { type: 'separator' },
      { label: 'Hintergrundfarbe …', icon: 'palette', run: function () { D.toolbar.openBackgroundColour(); }, disabled: dis('', false) },
      { label: 'Hintergrundbild …', icon: 'image', run: cmd.pickBackgroundImage, disabled: dis('', false) },
      { label: 'Hintergrundbild entfernen', icon: 'x', run: cmd.removeBackgroundImage, disabled: dis('Diese Seite hat kein Hintergrundbild.', !hasBg) },
      { type: 'separator' },
      { label: 'Seite hinzufügen', icon: 'file-plus', run: cmd.addPage, disabled: dis('', false) },
      { label: 'Seite duplizieren', icon: 'copy-plus', run: function () { cmd.duplicatePage(); }, disabled: dis('', false) },
      { label: 'Seite löschen', icon: 'trash', danger: true, run: function () { cmd.deletePage(); }, disabled: dis('Das Design braucht mindestens eine Seite.', a.doc.pages.length < 2) },
    ].concat(D.comments && D.comments.canComment() ? [{ type: 'separator' }, { label: 'Kommentar hier schreiben', icon: 'message-square-plus', shortcut: 'K', run: function () { D.comments.compose(point ? { point: point } : {}); } }] : []);
  };

  /** The menu of a thumbnail in the page strip. */
  D.pageThumbItems = function (index) {
    var a = app();
    var ro = !a.editable();
    var n = a.doc.pages.length;
    var dis = function (reason, cond) { return ro ? D.roText() : (cond ? reason : false); };
    return [
      { label: 'Seite duplizieren', icon: 'copy-plus', run: function () { cmd.duplicatePage(index); }, disabled: dis('', false) },
      { label: 'Seite umbenennen …', icon: 'pencil', run: function () { D.pages.renameDialog(index); }, disabled: dis('', false) },
      { label: 'Seite hinzufügen', icon: 'file-plus', run: function () { a.addPage(index); }, disabled: dis('', false) },
      { type: 'separator' },
      { label: 'Nach links', icon: 'arrow-left', run: function () { a.movePage(index, index - 1); }, disabled: dis('Die Seite ist schon die erste.', index === 0) },
      { label: 'Nach rechts', icon: 'arrow-right', run: function () { a.movePage(index, index + 1); }, disabled: dis('Die Seite ist schon die letzte.', index === n - 1) },
      { type: 'separator' },
      { label: 'Seite löschen', icon: 'trash', danger: true, run: function () { cmd.deletePage(index); }, disabled: dis('Das Design braucht mindestens eine Seite.', n < 2) },
    ];
  };
})();
