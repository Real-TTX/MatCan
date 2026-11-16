/* MatCan editor, part 10c: the panel "Ebenen": the stack of the current page as a tree (groups with their children), top = in front. Click selects (a child of a group selects the
   child), drag at the grip reorders - also into a group, out of a group, onto another group - and the buttons lock, hide and rename (double click on the name). Arrow up/down on the grip
   moves the layer one step. */
(function () {
  'use strict';

  var D = window.DtDesigner;
  var collapsed = new Set();      // ids of groups that are folded in the tree

  D.panels.register({
    id: 'layers', title: 'Ebenen', label: 'Ebenen', icon: 'layers', order: 60,
    build: function (host, api) {
      var app = api.app;
      var editing = null;
      var head = D.el('div', { class: 'dt-pbar dt-pbar--row' }, [D.el('h3', { class: 'dt-psec__title', id: 'dt-layers-title' }), D.el('span', { class: 'dt-pane__count mat-muted', id: 'dt-layers-count' })]);
      var list = D.el('ul', { class: 'dt-layers', role: 'tree', 'aria-labelledby': 'dt-layers-title' });
      host.appendChild(head);
      host.appendChild(list);
      host.appendChild(D.el('p', { class: 'dt-pnote', text: 'Oben liegt vorn. Ziehe am Griff, um die Reihenfolge zu ändern – auch in eine Gruppe hinein oder aus ihr heraus. Doppelklick auf den Namen benennt um.' }));

      var rows = [];

      var draw = function () {
        if (editing) { return; }
        D.empty(list);
        rows = [];
        var page = app.page();
        D.$('#dt-layers-title', host).textContent = page.name || 'Seite ' + (app.pageIndex + 1);
        D.$('#dt-layers-count', host).textContent = String(D.countNodes(page.elements));
        if (!page.elements.length) { list.appendChild(D.el('li', { class: 'dt-empty', role: 'presentation', text: 'Auf dieser Seite ist noch nichts. Füge links Elemente, Text oder Bilder hinzu.' })); return; }
        var walk = function (items, depth, parentId, parentHidden) {
          for (var i = items.length - 1; i >= 0; i--) {
            addRow(items[i], i, items, depth, parentId, parentHidden);
          }
        };
        var addRow = function (e, index, siblings, depth, parentId, parentHidden) {
          var editable = app.editable();
          var isGroup = e.type === 'group';
          var open = isGroup && !collapsed.has(e.id);
          var title = D.elementTitle(e);
          var grip = D.el('button', { type: 'button', class: 'dt-layer__grip', title: 'Ziehen, um die Reihenfolge zu ändern (oder Pfeil auf/ab)', 'aria-label': 'Reihenfolge von ' + title + ' ändern', disabled: !editable }, D.icon('grip-vertical'));
          var chev = isGroup ? D.el('button', { type: 'button', class: 'dt-layer__chev', title: open ? 'Gruppe einklappen' : 'Gruppe aufklappen', 'aria-label': (open ? 'Einklappen: ' : 'Aufklappen: ') + title, 'aria-expanded': String(open) }, D.icon(open ? 'chevron-down' : 'chevron-right')) : D.el('span', { class: 'dt-layer__chev dt-layer__chev--none' });
          var name = D.el('button', { type: 'button', class: 'dt-layer__name', text: title, title: title });
          var eye = D.el('button', { type: 'button', class: 'dt-layer__toggle' + (e.hidden ? ' is-on' : ''), title: e.hidden ? 'Einblenden' : 'Ausblenden', 'aria-label': (e.hidden ? 'Einblenden: ' : 'Ausblenden: ') + title, 'aria-pressed': String(e.hidden), disabled: !editable }, D.icon(e.hidden ? 'eye-off' : 'eye'));
          var lock = D.el('button', { type: 'button', class: 'dt-layer__toggle' + (e.locked ? ' is-on' : ''), title: e.locked ? 'Entsperren' : 'Sperren', 'aria-label': (e.locked ? 'Entsperren: ' : 'Sperren: ') + title, 'aria-pressed': String(e.locked), disabled: !editable }, D.icon(e.locked ? 'lock' : 'lock-open'));
          var li = D.el('li', {
            class: 'dt-layer' + (app.isSelected(e.id) ? ' is-selected' : '') + (e.hidden || parentHidden ? ' is-hidden' : '') + (e.locked ? ' is-locked' : '') + (isGroup ? ' is-group' : ''),
            'data-id': e.id, role: 'treeitem', 'aria-level': depth + 1, 'aria-selected': String(app.isSelected(e.id)), 'aria-expanded': isGroup ? String(open) : null, css: { '--dt-depth': depth },
          }, [grip, chev, D.el('span', { class: 'dt-layer__icon' }, D.icon(D.elementIcon(e))), name, eye, lock]);
          li.addEventListener('click', function (ev) {
            if (ev.target.closest('.dt-layer__toggle, .dt-layer__grip, .dt-layer__chev, input')) { return; }
            if (ev.shiftKey || ev.ctrlKey || ev.metaKey) { app.toggleSelect(e.id); } else { app.select([e.id]); }
            D.canvas.reveal(e.id);
          });
          name.addEventListener('dblclick', function () { if (editable) { rename(li, e); } });
          chev.addEventListener('click', function () { if (collapsed.has(e.id)) { collapsed.delete(e.id); } else { collapsed.add(e.id); } draw(); });
          eye.addEventListener('click', function () { app.toggleHidden([e.id]); });
          lock.addEventListener('click', function () { app.toggleLock([e.id]); });
          grip.addEventListener('keydown', function (ev) {
            if (ev.key !== 'ArrowUp' && ev.key !== 'ArrowDown') { return; }
            ev.preventDefault();
            app.select([e.id]);
            app.order(ev.key === 'ArrowUp' ? 'forward' : 'backward');
            var again = D.$('.dt-layer[data-id="' + e.id + '"] .dt-layer__grip', list);
            if (again) { again.focus(); }
          });
          grip.addEventListener('pointerdown', function (ev) { startDrag(ev, e, li); });
          list.appendChild(li);
          rows.push({ id: e.id, el: li, node: e, parentId: parentId, index: index, siblings: siblings, depth: depth });
          if (isGroup && open) { walk(e.children, depth + 1, e.id, e.hidden || parentHidden); }
        };
        walk(page.elements, 0, null, false);
      };

      var rename = function (li, e) {
        var nameBtn = D.$('.dt-layer__name', li);
        var input = D.el('input', { type: 'text', class: 'mat-input mat-input--sm dt-layer__input', value: e.name || D.elementTitle(e), maxlength: 80, 'aria-label': 'Name der Ebene' });
        editing = { id: e.id };
        li.replaceChild(input, nameBtn);
        input.focus();
        input.select();
        var done = false;
        var finish = function (commit) {
          if (done) { return; }
          done = true;
          editing = null;
          if (commit && input.value.trim() !== (e.name || D.elementTitle(e))) { app.rename(e.id, input.value.trim()); } else { draw(); }
        };
        input.addEventListener('keydown', function (ev) {
          ev.stopPropagation();
          if (ev.key === 'Enter') { ev.preventDefault(); finish(true); } else if (ev.key === 'Escape') { ev.preventDefault(); finish(false); }
        });
        input.addEventListener('blur', function () { finish(true); });
      };

      // ---- drag and drop of a layer: before / after a row, or into a group (middle of the group row)
      var startDrag = function (ev, node, li) {
        if (ev.button !== 0 || !app.editable()) { return; }
        ev.preventDefault();
        var grip = ev.currentTarget;
        var state = { moved: false, target: null };
        var line = D.el('li', { class: 'dt-layers__line', 'aria-hidden': 'true' });
        try { grip.setPointerCapture(ev.pointerId); } catch (e) { /* ignore */ }
        var isOwn = function (row) {
          // a row inside the dragged group (or the node itself) is no target
          if (row.id === node.id) { return true; }
          if (node.type !== 'group') { return false; }
          return D.walk(node.children, function (n) { return n.id !== row.id; }) === false;
        };
        var targetFor = function (y) {
          for (var i = 0; i < rows.length; i++) {
            var row = rows[i];
            var r = row.el.getBoundingClientRect();
            if (y < r.top || y > r.bottom) { continue; }
            if (isOwn(row)) { return null; }
            var rel = (y - r.top) / r.height;
            if (row.node.type === 'group' && rel > 0.3 && rel < 0.7) { return { row: row, kind: 'into' }; }
            return { row: row, kind: rel < 0.5 ? 'above' : 'below' };
          }
          return null;
        };
        var move = function (e) {
          if (!state.moved && Math.abs(e.clientY - ev.clientY) < 4) { return; }
          state.moved = true;
          li.classList.add('is-dragging');
          D.$$('.is-drop-into', list).forEach(function (x) { x.classList.remove('is-drop-into'); });
          if (line.parentNode) { line.parentNode.removeChild(line); }
          state.target = targetFor(e.clientY);
          var t = state.target;
          if (!t) { return; }
          if (t.kind === 'into') { t.row.el.classList.add('is-drop-into'); return; }
          line.style.setProperty('--dt-depth', t.row.depth);
          if (t.kind === 'above') { list.insertBefore(line, t.row.el); } else { list.insertBefore(line, t.row.el.nextSibling); }
        };
        var end = function (e, cancelled) {
          grip.removeEventListener('pointermove', move);
          grip.removeEventListener('pointerup', up);
          grip.removeEventListener('pointercancel', cancel);
          li.classList.remove('is-dragging');
          D.$$('.is-drop-into', list).forEach(function (x) { x.classList.remove('is-drop-into'); });
          if (line.parentNode) { line.parentNode.removeChild(line); }
          if (!state.moved || cancelled || !state.target) { return; }
          var t = state.target;
          if (t.kind === 'into') { app.moveNode(node.id, t.row.id, t.row.node.children.length); return; }
          // the list is shown top first: "above" a row = a higher index in its list
          app.moveNode(node.id, t.row.parentId, t.kind === 'above' ? t.row.index + 1 : t.row.index);
        };
        var up = function (e) { end(e, false); };
        var cancel = function (e) { end(e, true); };
        grip.addEventListener('pointermove', move);
        grip.addEventListener('pointerup', up);
        grip.addEventListener('pointercancel', cancel);
      };

      draw();
      api.on('doc', function (ev) { if (ev.structure || ev.reason === 'load' || ev.reason === 'history') { draw(); } });
      api.on('page', draw);
      api.on('selection', function () {
        D.$$('.dt-layer', list).forEach(function (li) {
          var on = app.isSelected(li.getAttribute('data-id'));
          li.classList.toggle('is-selected', on);
          li.setAttribute('aria-selected', String(on));
        });
        // a child that gets selected opens its groups
        var open = false;
        app.sel.forEach(function (id) { var r = app.locate(id, false); if (r) { r.chain.forEach(function (g) { if (collapsed.has(g.id)) { collapsed.delete(g.id); open = true; } }); } });
        if (open) { draw(); }
      });
      api.on('readonly', draw);
    },
  });
})();
