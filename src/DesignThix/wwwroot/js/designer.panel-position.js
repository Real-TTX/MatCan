/* DesignThix editor, part 10b: the context page "Position" (opened by the toolbar button of every element): the order of the layers, aligning to the page or to each other, distributing
   (three or more), and the numbers X, Y, Breite, Höhe and Drehung. The numbers refresh while the element is moved on the canvas. */
(function () {
  'use strict';

  var D = window.DtDesigner;

  D.panels.register({
    id: 'position', title: 'Position', icon: 'move', page: true, needsSelection: true,
    build: function (host, api) {
      var app = api.app;
      var els = app.selected();
      if (!els.length) { host.appendChild(D.el('p', { class: 'dt-empty', text: 'Wähle ein Element aus, um es zu positionieren.' })); return; }
      var ids = els.map(function (e) { return e.id; });
      var ro = !app.editable();
      var allLocked = els.every(function (e) { return e.locked; });
      var off = ro || allLocked;
      var unit = D.unitLabel(app.unit());
      var digits = app.unit() === 'px' ? 1 : 2;
      var step = app.unit() === 'px' ? 1 : 0.5;
      var single = els.length === 1;
      var toPage = { value: single || els.length < 2 };
      var refreshers = [];

      if (ro) { host.appendChild(D.el('p', { class: 'dt-pnote', text: 'Du darfst dieses Design nur ansehen.' })); }
      else if (allLocked) { host.appendChild(D.el('p', { class: 'dt-pnote', text: 'Das Element ist gesperrt. Entsperre es, um es zu verschieben.' })); }

      // ---- order
      var orderBtn = function (icon, text, mode) {
        var b = D.ui.textButton(icon, text, function () { app.order(mode); }, { cls: 'dt-pos__btn', disabled: ro });
        b.setAttribute('data-order', mode);
        return b;
      };
      host.appendChild(D.ui.section('Anordnen', [
        D.el('div', { class: 'dt-pos__grid' }, [
          orderBtn('arrow-up', 'Nach vorne', 'forward'), orderBtn('bring-to-front', 'Ganz nach vorne', 'front'),
          orderBtn('arrow-down', 'Nach hinten', 'backward'), orderBtn('send-to-back', 'Ganz nach hinten', 'back'),
        ]),
      ]));

      // ---- align
      var alignBtn = function (mode, icon, label) {
        var b = D.ui.iconButton(icon, label, function () { app.align(mode, toPage.value); }, { disabled: off });
        b.setAttribute('data-align', mode);
        return b;
      };
      var alignBody = [];
      if (els.length > 1) {
        var seg = D.ui.segmented({ label: 'Ausrichten an', value: toPage.value ? 'page' : 'sel', options: [{ value: 'page', label: 'An Seite' }, { value: 'sel', label: 'An Auswahl' }], onChange: function (v) { toPage.value = v === 'page'; seg.set(v); } });
        alignBody.push(seg.el);
      }
      alignBody.push(D.el('div', { class: 'dt-iconrow', role: 'group', 'aria-label': 'Ausrichten' }, [
        alignBtn('left', 'align-start-vertical', 'Links ausrichten'), alignBtn('centre', 'align-center-vertical', 'Horizontal zentrieren'), alignBtn('right', 'align-end-vertical', 'Rechts ausrichten'),
        D.el('span', { class: 'dt-iconrow__sep' }),
        alignBtn('top', 'align-start-horizontal', 'Oben ausrichten'), alignBtn('middle', 'align-center-horizontal', 'Vertikal zentrieren'), alignBtn('bottom', 'align-end-horizontal', 'Unten ausrichten'),
      ]));
      if (els.length >= 3) {
        alignBody.push(D.el('div', { class: 'dt-iconrow', role: 'group', 'aria-label': 'Verteilen' }, [
          D.ui.textButton('align-horizontal-space-between', 'Horizontal verteilen', function () { app.distribute('x'); }, { cls: 'dt-pos__btn', disabled: off }),
          D.ui.textButton('align-vertical-space-between', 'Vertikal verteilen', function () { app.distribute('y'); }, { cls: 'dt-pos__btn', disabled: off }),
        ]));
      }
      host.appendChild(D.ui.section('Ausrichten', alignBody));

      // ---- numbers
      var keepRatio = { value: false };
      var boxOf = function () {
        var current = ids.map(function (id) { return app.element(id); }).filter(Boolean);
        if (!current.length) { return null; }
        if (current.length === 1) { var e = current[0]; return { x: e.x, y: e.y, w: e.w, h: e.h, rotation: e.rotation || 0 }; }
        var u = D.unionBox(current.map(D.aabb));
        return { x: u.x, y: u.y, w: u.w, h: u.h, rotation: 0 };
      };
      var setBox = function (patch, key) {
        var box = boxOf();
        if (!box) { return; }
        var next = { x: box.x, y: box.y, w: box.w, h: box.h };
        Object.keys(patch).forEach(function (k) { next[k] = patch[k]; });
        if (keepRatio.value && box.w > 0 && box.h > 0) {
          if (patch.w !== undefined && patch.h === undefined) { next.h = next.w * box.h / box.w; }
          else if (patch.h !== undefined && patch.w === undefined) { next.w = next.h * box.w / box.h; }
        }
        var merge = 'pos:' + key + ':' + ids.join(',');
        if (single) {
          var e = app.element(ids[0]);
          app.edit(function () { if (e.type === 'group') { D.setBox(e, next); } else { e.x = D.round(next.x, 3); e.y = D.round(next.y, 3); e.w = D.round(Math.max(0, next.w), 3); e.h = D.round(Math.max(0, next.h), 3); } }, { merge: merge, mergeMs: 1200, reason: 'props' });
        } else {
          var fx = box.w > 0 ? next.w / box.w : 1;
          var fy = box.h > 0 ? next.h / box.h : 1;
          app.edit(function () {
            ids.forEach(function (id) {
              var n = app.element(id);
              var cx = next.x + (n.x + n.w / 2 - box.x) * fx;
              var cy = next.y + (n.y + n.h / 2 - box.y) * fy;
              var w = n.w * fx;
              var h = n.h * fy;
              D.setBox(n, { x: cx - w / 2, y: cy - h / 2, w: w, h: h });
            });
          }, { merge: merge, mergeMs: 1200, reason: 'props' });
        }
      };
      var numberField = function (label, key, o) {
        var b = boxOf();
        var h = D.ui.number({ value: b ? b[key] : 0, min: o.min, step: o.step || step, digits: o.digits === undefined ? digits : o.digits, suffix: o.suffix || unit, label: label, disabled: off || (o.single && !single),
          onInput: function (v) { o.apply(v); } });
        refreshers.push(function () { var bb = boxOf(); if (bb) { h.set(bb[key]); } });
        var field = D.ui.field(label, h.el);
        field.setAttribute('data-field', key);
        return field;
      };
      var lock = D.ui.switchBox({ label: 'Proportionen beibehalten', value: false, onChange: function (v) { keepRatio.value = v; }, disabled: off });
      host.appendChild(D.ui.section(single ? 'Größe und Position' : 'Größe und Position der Auswahl', [
        D.el('div', { class: 'dt-grid2' }, [
          numberField('Breite', 'w', { min: 0, apply: function (v) { setBox({ w: v }, 'w'); } }),
          numberField('Höhe', 'h', { min: 0, apply: function (v) { setBox({ h: v }, 'h'); } }),
          numberField('X', 'x', { apply: function (v) { setBox({ x: v }, 'x'); } }),
          numberField('Y', 'y', { apply: function (v) { setBox({ y: v }, 'y'); } }),
          numberField('Drehung', 'rotation', { single: true, digits: 1, suffix: '°', step: 1, apply: function (v) { app.setProps(ids, { rotation: D.round(D.normAngle(v), 1) }, { merge: 'pos:rot:' + ids.join(','), mergeMs: 1200 }); } }),
        ]),
        lock.el,
      ]));

      api.on('doc', function (ev) {
        if (ev.structure || ev.reason === 'load') { api.rebuild(); return; }
        refreshers.forEach(function (fn) { fn(); });
      });
      api.on('selection', function () { if (app.sel.length) { api.rebuild(); } });
      api.on('readonly', function () { api.rebuild(); });
    },
  });
})();
