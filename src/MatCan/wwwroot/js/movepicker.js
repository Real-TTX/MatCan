/* MatCan: the dialog "Verschieben nach …". ONE place to choose where something goes: a tree of the areas the person may write in (Meine Projekte, the teams where they are Bearbeiter
   or more) and their folders, with "Neuer Ordner" inside the dialog.
     window.DtMove.pick({ title, ok, kinds, exclude: [folderIds], current: { spaceId, folderId } }, function (spaceId, folderId) { ... })
   callback(spaceId, folderId) runs with folderId = null for the top of an area; it is not called when the dialog is cancelled. `exclude` lists folders that are being moved: they and what lies
   below them cannot be chosen (a folder cannot go into itself). `kinds` (the kinds that are moved) only changes the wording. Data: GET /api/folders/tree, POST /api/folders.
   Keyboard: arrows move, Left/Right fold, Enter chooses. Names only through textContent. Needs dt-ui.js. */
(function () {
  'use strict';

  var U = window.DtUi;
  var el = U.el;
  var counter = 0;

  function pick(options, callback) {
    var o = options || {};
    var id = 'dt-move-' + (++counter);
    var excluded = (o.exclude || []).map(Number);
    var state = { tree: [], selected: null, expanded: {}, done: false, loading: true, failed: false };

    var dlg = el('dialog', { class: 'mat-dialog mat-dialog--sm dt-move', 'data-static': '', 'aria-labelledby': id + '-t' });
    var close = el('button', { type: 'button', class: 'mat-btn mat-btn--ghost mat-btn--icon mat-dialog__close', 'aria-label': 'Schließen', 'data-dialog-close': '' }, U.icon('x'));
    var head = el('div', { class: 'mat-dialog__head' }, [U.icon('dt:folder-input'), el('h2', { class: 'mat-dialog__title', id: id + '-t', text: o.title || 'Verschieben nach …' }), close]);
    var treeEl = el('div', { class: 'dt-move__tree', role: 'tree', 'aria-label': 'Bereiche und Ordner' });
    var status = el('p', { class: 'dt-move__status', role: 'status' });
    var newFolder = el('button', { type: 'button', class: 'mat-btn mat-btn--secondary mat-btn--sm' }, [U.icon('dt:folder-plus'), el('span', { text: 'Neuer Ordner' })]);
    var lead = el('div', { class: 'dt-move__lead' }, [el('span', { class: 'mat-muted', text: 'Wähle einen Bereich oder einen Ordner.' }), newFolder]);
    var body = el('div', { class: 'mat-dialog__body' }, [lead, treeEl, status]);
    var cancel = el('button', { type: 'button', class: 'mat-btn mat-btn--secondary', 'data-dialog-close': '', text: 'Abbrechen' });
    var okBtn = el('button', { type: 'button', class: 'mat-btn mat-btn--primary', disabled: true }, [el('span', { text: o.ok || 'Hierher verschieben' })]);
    var foot = el('div', { class: 'mat-dialog__foot' }, el('div', { class: 'mat-btn-row mat-btn-row--plain' }, [el('span', { class: 'mat-btn-row__spacer' }), cancel, okBtn]));
    dlg.appendChild(el('div', { class: 'mat-dialog__form' }, [head, body, foot]));
    document.body.appendChild(dlg);

    function isExcluded(folder) { return excluded.some(function (x) { return folder.path.indexOf('/' + x + '/') >= 0; }); }

    function key(node) { return node.folderId ? 'f' + node.folderId : 's' + node.spaceId; }

    /** The rows that are visible with the folds as they are: [{ spaceId, folderId, name, depth, color, hasKids, disabled, kind }]. */
    function rows() {
      var out = [];
      state.tree.forEach(function (space) {
        var kids = {};
        space.folders.forEach(function (f) { (kids[f.parentId || 0] = kids[f.parentId || 0] || []).push(f); });
        out.push({ spaceId: space.spaceId, folderId: null, name: space.name, depth: 0, color: space.color, hasKids: !!(kids[0] && kids[0].length), kind: space.kind });
        if (!state.expanded['s' + space.spaceId]) { return; }
        (function walk(parent, depth) {
          (kids[parent] || []).forEach(function (f) {
            var blocked = isExcluded(f);
            out.push({ spaceId: space.spaceId, folderId: f.id, name: f.name, depth: depth, color: f.color, hasKids: !!(kids[f.id] && kids[f.id].length), disabled: blocked, kind: 'folder' });
            if (state.expanded['f' + f.id] && !blocked) { walk(f.id, depth + 1); }
          });
        })(0, 1);
      });
      return out;
    }

    function draw(focusKey) {
      treeEl.textContent = '';
      status.hidden = !(state.loading || state.failed);
      status.textContent = state.loading ? 'Bereiche werden geladen …' : (state.failed ? 'Die Bereiche konnten nicht geladen werden.' : '');
      var list = rows();
      list.forEach(function (r) {
        var k = key(r);
        var selected = state.selected && key(state.selected) === k;
        var open = !!state.expanded[k];
        var row = el('div', {
          class: 'dt-move__row' + (selected ? ' is-selected' : '') + (r.disabled ? ' is-disabled' : '') + (r.folderId ? '' : ' is-space'), role: 'treeitem', 'data-key': k, 'data-depth': r.depth,
          'aria-level': r.depth + 1, 'aria-selected': selected ? 'true' : 'false', 'aria-expanded': r.hasKids && !r.disabled ? String(open) : null, 'aria-disabled': r.disabled ? 'true' : null,
          tabindex: selected || (!state.selected && list[0] === r) ? '0' : '-1', title: r.disabled ? 'Das verschobene Element selbst oder etwas darin' : null,
        });
        row.style.setProperty('--dt-depth', String(r.depth));
        var fold = el('button', { type: 'button', class: 'dt-move__fold' + (r.hasKids && !r.disabled ? '' : ' is-empty'), tabindex: '-1', 'aria-label': open ? 'Zuklappen' : 'Aufklappen' }, r.hasKids && !r.disabled ? U.icon(open ? 'chevron-down' : 'chevron-right') : null);
        fold.addEventListener('click', function (ev) { ev.stopPropagation(); toggle(r); });
        row.appendChild(fold);
        var iconWrap = el('span', { class: 'dt-move__icon' }, U.icon(r.kind === 'personal' ? 'home' : (r.kind === 'team' ? 'users' : (open ? 'folder-open' : 'folder'))));
        if (r.color) { iconWrap.style.setProperty('--dt-folder', r.color); iconWrap.classList.add('has-color'); }
        row.appendChild(iconWrap);
        row.appendChild(el('span', { class: 'dt-move__name', text: r.name }));
        row.addEventListener('click', function () { if (!r.disabled) { select(r); } });
        row.addEventListener('dblclick', function () { if (!r.disabled && r.hasKids) { toggle(r); } });
        treeEl.appendChild(row);
      });
      okBtn.disabled = !state.selected;
      newFolder.disabled = !state.selected;
      if (focusKey) {
        var target = treeEl.querySelector('[data-key="' + focusKey + '"]');
        if (target) { target.focus({ preventScroll: false }); }
      }
    }

    function select(r) { state.selected = { spaceId: r.spaceId, folderId: r.folderId }; draw(key(r)); }

    function toggle(r) {
      var k = key(r);
      state.expanded[k] = !state.expanded[k];
      draw(k);
    }

    function expandTo(spaceId, folderId) {
      state.expanded['s' + spaceId] = true;
      var space = state.tree.filter(function (s) { return s.spaceId === spaceId; })[0];
      if (!space || !folderId) { return; }
      var folder = space.folders.filter(function (f) { return f.id === folderId; })[0];
      if (!folder) { return; }
      folder.path.split('/').filter(Boolean).forEach(function (x) { if (Number(x) !== folderId) { state.expanded['f' + x] = true; } });
    }

    function load(select) {
      state.loading = true;
      draw();
      return U.get('/api/folders/tree').then(function (result) {
        state.loading = false;
        if (!result.ok || !Array.isArray(result.data)) { state.failed = true; draw(); return; }
        state.tree = result.data;
        state.tree.forEach(function (s) { state.expanded['s' + s.spaceId] = state.expanded['s' + s.spaceId] !== false; });
        var wanted = select || o.current;
        var valid = wanted && state.tree.some(function (s) { return s.spaceId === wanted.spaceId; }) && (!wanted.folderId || state.tree.some(function (s) { return s.folders.some(function (f) { return f.id === wanted.folderId && !isExcluded(f); }); }));
        if (valid) { state.selected = { spaceId: wanted.spaceId, folderId: wanted.folderId || null }; expandTo(wanted.spaceId, wanted.folderId || null); }
        else if (!state.selected && state.tree.length) { state.selected = { spaceId: state.tree[0].spaceId, folderId: null }; }
        draw(state.selected ? key(state.selected) : null);
      });
    }

    treeEl.addEventListener('keydown', function (ev) {
      var list = rows();
      var at = list.findIndex(function (r) { return key(r) === (document.activeElement && document.activeElement.getAttribute('data-key')); });
      if (at < 0) { return; }
      var r = list[at];
      var go = function (i) { var t = list[Math.max(0, Math.min(list.length - 1, i))]; if (t) { ev.preventDefault(); var node = treeEl.querySelector('[data-key="' + key(t) + '"]'); if (node) { treeEl.querySelectorAll('[tabindex="0"]').forEach(function (n) { n.tabIndex = -1; }); node.tabIndex = 0; node.focus(); } } };
      if (ev.key === 'ArrowDown') { go(at + 1); }
      else if (ev.key === 'ArrowUp') { go(at - 1); }
      else if (ev.key === 'Home') { go(0); }
      else if (ev.key === 'End') { go(list.length - 1); }
      else if (ev.key === 'ArrowRight') { if (r.hasKids && !state.expanded[key(r)]) { ev.preventDefault(); toggle(r); } else { go(at + 1); } }
      else if (ev.key === 'ArrowLeft') {
        if (r.hasKids && state.expanded[key(r)]) { ev.preventDefault(); toggle(r); }
        else { var parentIndex = -1; for (var i = at - 1; i >= 0; i--) { if (list[i].depth < r.depth) { parentIndex = i; break; } } if (parentIndex >= 0) { go(parentIndex); } }
      } else if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); if (!r.disabled) { if (ev.key === 'Enter' && state.selected && key(state.selected) === key(r)) { okBtn.click(); } else { select(r); } } }
    });

    newFolder.addEventListener('click', function () {
      if (!state.selected) { return; }
      var ask = window.MatUi && window.MatUi.prompt ? window.MatUi.prompt('Name des Ordners', { title: 'Neuer Ordner', value: '', ok: 'Anlegen' }) : Promise.resolve(window.prompt('Name des Ordners', ''));
      ask.then(function (value) {
        var name = value === null || value === undefined ? '' : String(value).trim();
        if (!name) { return; }
        var target = state.selected;
        U.post('/api/folders', { spaceId: target.spaceId, parentId: target.folderId, name: name }).then(function (result) {
          if (!result.ok) { U.toast(U.problem(result), 'danger'); return; }
          load({ spaceId: target.spaceId, folderId: result.data.id });
        });
      });
    });

    okBtn.addEventListener('click', function () {
      if (state.done || !state.selected) { return; }
      state.done = true;
      var chosen = state.selected;
      window.MatUi.dialog.close(dlg, 'ok');
      if (typeof callback === 'function') { setTimeout(function () { callback(chosen.spaceId, chosen.folderId); }, 0); }
    });

    dlg.addEventListener('close', function () { state.done = true; setTimeout(function () { dlg.remove(); }, 0); });
    window.MatUi.dialog.open(dlg);
    load(null);
    return { close: function () { if (!state.done) { state.done = true; window.MatUi.dialog.close(dlg, 'cancel'); } } };
  }

  window.DtMove = { pick: pick };
})();
