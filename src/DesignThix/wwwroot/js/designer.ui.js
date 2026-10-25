/* DesignThix editor, part 4: small form building blocks used by the toolbar, the panels and the dialogs (D.ui.*). Each builder returns a handle { el, set(value), ... }:
   the caller keeps the handle and calls set() from its refresh function, so undo, the canvas and the controls always agree. An input that has the focus is never overwritten. */
(function () {
  'use strict';

  var D = window.DtDesigner;
  var ui = D.ui = {};

  /** A labelled control: <div class="dt-f"><label>…</label>control</div>. */
  ui.field = function (label, control, cls, forId) {
    if (label && control && !forId && !control.id && /^(INPUT|SELECT|TEXTAREA)$/.test(control.tagName)) { control.id = D.uid('dt-c'); }
    return D.el('div', { class: 'dt-f' + (cls ? ' ' + cls : '') }, [label ? D.el('label', { class: 'dt-f__label', for: forId || (control && control.id) || null, text: label }) : null, control]);
  };

  /** An icon button. options: cls, disabled, pressed (initial), keepEdit. */
  ui.iconButton = function (icon, label, onClick, options) {
    var o = options || {};
    var b = D.el('button', { type: 'button', class: 'mat-btn mat-btn--ghost mat-btn--icon mat-btn--sm dt-ib' + (o.cls ? ' ' + o.cls : ''), title: label, 'aria-label': label, disabled: o.disabled });
    b.appendChild(D.icon(icon));
    b.addEventListener('click', onClick);
    return b;
  };

  ui.textButton = function (icon, label, onClick, options) {
    var o = options || {};
    var b = D.el('button', { type: 'button', class: 'mat-btn ' + (o.primary ? 'mat-btn--primary' : 'mat-btn--secondary') + ' mat-btn--sm' + (o.cls ? ' ' + o.cls : ''), title: o.title || null, disabled: o.disabled });
    if (icon) { b.appendChild(D.icon(icon)); }
    b.appendChild(D.el('span', { text: label }));
    b.addEventListener('click', onClick);
    return b;
  };

  /**
   * A number input. options: value, min, max, step, digits, suffix, disabled, label (aria), onInput(v) per valid keystroke, onCommit(v) on Enter/blur.
   * Handle: el (wrapper), input, set(v).
   */
  ui.number = function (o) {
    var id = D.uid('dt-num');
    var input = D.el('input', { type: 'text', class: 'mat-input mat-input--sm dt-num', id: id, inputmode: 'decimal', disabled: o.disabled, autocomplete: 'off', 'aria-label': o.label || null, spellcheck: 'false' });
    var digits = o.digits === undefined ? 2 : o.digits;
    var show = function (v) { input.value = D.isNum(v) ? String(D.round(v, digits)).replace('.', ',') : ''; };
    var parse = function () {
      var v = parseFloat(String(input.value).replace(',', '.'));
      if (!isFinite(v)) { return null; }
      if (o.min !== undefined) { v = Math.max(o.min, v); }
      if (o.max !== undefined) { v = Math.min(o.max, v); }
      return v;
    };
    show(o.value);
    input.addEventListener('input', function () { var v = parse(); if (v !== null && o.onInput) { o.onInput(v); } });
    input.addEventListener('keydown', function (ev) {
      ev.stopPropagation();
      if (ev.key === 'Enter') { input.blur(); }
      else if (ev.key === 'ArrowUp' || ev.key === 'ArrowDown') {
        ev.preventDefault();
        var v = parse();
        if (v === null) { return; }
        var step = (o.step || 1) * (ev.shiftKey ? 10 : 1) * (ev.key === 'ArrowUp' ? 1 : -1);
        v = D.round(v + step, 6);
        if (o.min !== undefined) { v = Math.max(o.min, v); }
        if (o.max !== undefined) { v = Math.min(o.max, v); }
        show(v);
        if (o.onInput) { o.onInput(v); }
      }
    });
    input.addEventListener('blur', function () { var v = parse(); if (v !== null && o.onCommit) { o.onCommit(v); } if (v === null && o.value !== undefined) { show(o.get ? o.get() : o.value); } });
    var wrap = D.el('div', { class: 'dt-numwrap' }, [input, o.suffix ? D.el('span', { class: 'dt-numwrap__suffix', text: o.suffix }) : null]);
    return { el: wrap, input: input, set: function (v) { if (document.activeElement !== input) { show(v); } } };
  };

  /** A select. options: items [[value, label, cssClass?]], value, onChange(value), label (aria), disabled. */
  ui.select = function (o) {
    var id = D.uid('dt-sel');
    var select = D.el('select', { class: 'mat-select mat-select--sm', id: id, disabled: o.disabled, 'aria-label': o.label || null });
    o.items.forEach(function (it) { select.appendChild(D.el('option', { value: it[0], text: it[1], class: it[2] || null })); });
    var set = function (v) {
      var s = String(v === null || v === undefined ? '' : v);
      if (!Array.prototype.some.call(select.options, function (opt) { return opt.value === s; }) && s !== '') { select.insertBefore(D.el('option', { value: s, text: s }), select.firstChild); }
      select.value = s;
    };
    set(o.value);
    select.addEventListener('change', function () { o.onChange(select.value); });
    return { el: select, select: select, set: function (v) { if (document.activeElement !== select) { set(v); } } };
  };

  /** A group of toggle buttons (one active): options [{ value, label?, icon?, title }], value, onChange(value). */
  ui.segmented = function (o) {
    var group = D.el('div', { class: 'mat-seg dt-seg', role: 'group', 'aria-label': o.label || null });
    var buttons = o.options.map(function (opt) {
      var b = D.el('button', { type: 'button', class: 'mat-seg__btn', title: opt.title || opt.label, 'aria-label': opt.title || opt.label, disabled: o.disabled, 'data-value': opt.value });
      if (opt.icon) { b.appendChild(D.icon(opt.icon)); } else { b.appendChild(D.el('span', { text: opt.label })); }
      b.addEventListener('click', function () { o.onChange(opt.value); });
      group.appendChild(b);
      return b;
    });
    var set = function (v) { buttons.forEach(function (b, i) { b.setAttribute('aria-pressed', String(o.options[i].value === v)); }); };
    set(o.value);
    return { el: group, set: set };
  };

  /** A switch with a text. options: label, value, onChange(bool), disabled. */
  ui.switchBox = function (o) {
    var input = D.el('input', { type: 'checkbox', disabled: o.disabled });
    var lab = D.el('label', { class: 'mat-switch dt-switch' }, [input, D.el('span', { class: 'mat-switch__track' }), D.el('span', { text: o.label })]);
    input.checked = !!o.value;
    input.addEventListener('change', function () { o.onChange(input.checked); });
    return { el: lab, set: function (v) { input.checked = !!v; } };
  };

  /** A range slider with a number: options min, max, step, value, suffix, onInput(v), label. */
  ui.slider = function (o) {
    var range = D.el('input', { type: 'range', class: 'dt-range', min: o.min, max: o.max, step: o.step || 1, 'aria-label': o.label || null, disabled: o.disabled });
    range.value = String(o.value);
    var number = ui.number({ value: o.value, min: o.min, max: o.max, step: o.step || 1, digits: o.digits === undefined ? 0 : o.digits, suffix: o.suffix, label: o.label, disabled: o.disabled,
      onInput: function (v) { range.value = String(v); o.onInput(v); }, onCommit: function (v) { range.value = String(v); o.onInput(v); } });
    range.addEventListener('input', function () { var v = Number(range.value); number.set(v); number.input.value = String(D.round(v, o.digits === undefined ? 0 : o.digits)).replace('.', ','); o.onInput(v); });
    var el = D.el('div', { class: 'dt-slider' }, [range, D.el('div', { class: 'dt-slider__num' }, number.el)]);
    return { el: el, set: function (v) { if (document.activeElement !== range) { range.value = String(v); } number.set(v); } };
  };

  /** A section of a panel: a title and a body. */
  ui.section = function (title, kids, cls) {
    return D.el('section', { class: 'dt-sec' + (cls ? ' ' + cls : '') }, [title ? D.el('h3', { class: 'dt-sec__title', text: title }) : null, D.el('div', { class: 'dt-sec__body' }, kids)]);
  };

  /** Shows `text` as a one-line error/hint element that can be hidden. */
  ui.message = function (cls) { return D.el('p', { class: cls || 'dt-field__error', role: 'alert', hidden: true }); };

  /** Runs fn when Enter is pressed in an input. */
  ui.onEnter = function (input, fn) { input.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); fn(); } }); };
})();
