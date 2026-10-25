/* DesignThix: ONE menu control for the shell (the file browser's context menus, its "Neu" and "⋯" buttons). MatUi classes (mat-menu, mat-menu__item), submenus, shortcuts at the right,
   disabled entries with a reason as the tooltip, arrow keys, Escape, a place inside the viewport; on a touch screen the entries are 44 px high.
     window.DtMenu.open(items, { x, y } | { anchor, align }, options)   options: focusFirst, onClose
     window.DtMenu.close(), .isOpen(), .element()
   Entries: { label, icon, shortcut, run, disabled (true | a reason as text), danger, checked, swatch (a colour), submenu: [...], hidden } | { type: 'separator' } | { type: 'header', label }.
   The editor has its own copy of this code (designer.menu.js, part of the editor); nothing else may build a menu on its own. Needs dt-ui.js. */
(function () {
  'use strict';

  var U = window.DtUi;
  var el = U.el;
  var openMenus = [];       // [{ el, parentItem }] root first
  var state = null;         // { restore, anchor, onClose, handlers }

  function visible(items) {
    var out = [];
    (items || []).forEach(function (it) {
      if (!it || it.hidden) { return; }
      if (it.type === 'separator') { if (out.length && out[out.length - 1].type !== 'separator') { out.push(it); } return; }
      out.push(it);
    });
    while (out.length && out[out.length - 1].type === 'separator') { out.pop(); }
    return out;
  }

  function closeFrom(level) {
    while (openMenus.length > level) {
      var m = openMenus.pop();
      if (m.el.parentNode) { m.el.parentNode.removeChild(m.el); }
      if (m.parentItem) { m.parentItem.setAttribute('aria-expanded', 'false'); }
    }
  }

  function close(restoreFocus) {
    if (!openMenus.length) { return; }
    closeFrom(0);
    var s = state;
    state = null;
    if (!s) { return; }
    document.removeEventListener('pointerdown', s.onOutside, true);
    document.removeEventListener('keydown', s.onKey, true);
    window.removeEventListener('blur', s.onBlur);
    window.removeEventListener('resize', s.onBlur);
    window.removeEventListener('scroll', s.onScroll, true);
    if (s.anchor) { s.anchor.setAttribute('aria-expanded', 'false'); }
    if (restoreFocus && s.restore && s.restore.focus && document.contains(s.restore)) { s.restore.focus({ preventScroll: true }); }
    if (s.onClose) { s.onClose(); }
  }

  /** Puts a menu at a point, below an anchor, or to the side of a parent entry; always inside the viewport. */
  function place(menu, x, y, rect, side, align) {
    menu.style.setProperty('left', '0px');
    menu.style.setProperty('top', '0px');
    menu.style.setProperty('visibility', 'hidden');
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var w = menu.offsetWidth;
    var h = menu.offsetHeight;
    var left;
    var top;
    if (rect && side === 'side') {
      left = rect.right + 2;
      if (left + w > vw - 8) { left = Math.max(8, rect.left - w - 2); }
      top = rect.top - 8;
      if (top + h > vh - 8) { top = Math.max(8, vh - h - 8); }
    } else if (rect) {
      left = align === 'end' ? rect.right - w : rect.left;
      left = Math.min(Math.max(8, left), vw - w - 8);
      top = rect.bottom + 6;
      if (top + h > vh - 8) { top = Math.max(8, rect.top - h - 6); }
    } else {
      left = x;
      top = y;
      if (left + w > vw - 8) { left = Math.max(8, vw - w - 8); }
      if (top + h > vh - 8) { top = Math.max(8, y - h); if (top + h > vh - 8) { top = Math.max(8, vh - h - 8); } }
    }
    menu.style.setProperty('left', Math.round(left) + 'px');
    menu.style.setProperty('top', Math.round(top) + 'px');
    menu.style.removeProperty('visibility');
  }

  function buttons(menu) { return Array.prototype.slice.call(menu.querySelectorAll('.dt-menu__item:not(.is-disabled)')); }

  function focusItem(menu, index) {
    var list = buttons(menu);
    if (!list.length) { return; }
    list[(index + list.length) % list.length].focus({ preventScroll: true });
  }

  function build(items, level, parentItem) {
    var menu = el('div', { class: 'mat-menu dt-menu', role: 'menu', tabindex: '-1', 'data-level': level });
    visible(items).forEach(function (it) {
      if (it.type === 'separator') { menu.appendChild(el('div', { class: 'mat-menu__sep', role: 'separator' })); return; }
      if (it.type === 'header') { menu.appendChild(el('div', { class: 'dt-menu__header', text: it.label, role: 'presentation' })); return; }
      var disabled = !!it.disabled;
      var role = it.checked !== undefined && it.checked !== null ? 'menuitemcheckbox' : 'menuitem';
      var b = el('button', {
        type: 'button', class: 'mat-menu__item dt-menu__item' + (disabled ? ' is-disabled' : '') + (it.danger ? ' mat-menu__item--danger' : ''), role: role,
        'aria-disabled': disabled ? 'true' : null, title: typeof it.disabled === 'string' ? it.disabled : (it.title || null),
        'aria-haspopup': it.submenu ? 'menu' : null, 'aria-expanded': it.submenu ? 'false' : null, 'aria-checked': role === 'menuitemcheckbox' ? String(!!it.checked) : null,
      });
      var iconHost = el('span', { class: 'dt-menu__icon' });
      if (it.swatch) {
        var sw = el('span', { class: 'dt-menu__swatch' });
        sw.style.setProperty('--dt-swatch', it.swatch);
        iconHost.appendChild(sw);
      } else if (it.icon) { iconHost.appendChild(U.icon(it.icon)); }
      b.appendChild(iconHost);
      b.appendChild(el('span', { class: 'dt-menu__label', text: it.label }));
      if (it.shortcut) { b.appendChild(el('span', { class: 'dt-menu__kbd', text: it.shortcut })); }
      if (it.checked) { b.appendChild(U.icon('check', 'dt-menu__check')); }
      if (it.submenu) { b.appendChild(U.icon('chevron-right', 'dt-menu__chev')); }
      var openSub = function (focusFirst) {
        if (!it.submenu || disabled) { return; }
        if (openMenus[level + 1] && openMenus[level + 1].parentItem === b) { if (focusFirst) { focusItem(openMenus[level + 1].el, 0); } return; }
        closeFrom(level + 1);
        var sub = build(it.submenu, level + 1, b);
        document.body.appendChild(sub);
        openMenus.push({ el: sub, parentItem: b });
        b.setAttribute('aria-expanded', 'true');
        place(sub, 0, 0, b.getBoundingClientRect(), 'side');
        if (focusFirst) { focusItem(sub, 0); }
      };
      b.addEventListener('pointerenter', function (ev) {
        if (ev.pointerType === 'touch') { return; }
        if (it.submenu) { openSub(false); } else { closeFrom(level + 1); }
      });
      b.addEventListener('click', function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        if (disabled) { return; }
        if (it.submenu) { openSub(ev.detail === 0); return; }
        var restore = state && state.restore;
        close(false);
        // the menu is gone before the action runs: a dialog it opens does not get a removed button as its opener
        if (it.run) { it.run(); } else if (restore && restore.focus && document.contains(restore)) { restore.focus({ preventScroll: true }); }
      });
      b._open = openSub;
      menu.appendChild(b);
    });
    menu.addEventListener('keydown', function (ev) {
      var list = buttons(menu);
      var current = list.indexOf(document.activeElement);
      if (ev.key === 'ArrowDown') { ev.preventDefault(); focusItem(menu, current < 0 ? 0 : current + 1); }
      else if (ev.key === 'ArrowUp') { ev.preventDefault(); focusItem(menu, current < 0 ? list.length - 1 : current - 1); }
      else if (ev.key === 'Home') { ev.preventDefault(); focusItem(menu, 0); }
      else if (ev.key === 'End') { ev.preventDefault(); focusItem(menu, list.length - 1); }
      else if (ev.key === 'ArrowRight') {
        var cur = list[current];
        if (cur && cur._open && cur.getAttribute('aria-haspopup')) { ev.preventDefault(); cur._open(true); }
      } else if (ev.key === 'ArrowLeft' && parentItem) {
        ev.preventDefault();
        closeFrom(level);
        parentItem.focus({ preventScroll: true });
      } else if (ev.key === 'Tab') { ev.preventDefault(); }
    });
    return menu;
  }

  function open(items, options) {
    var o = options || {};
    close(false);
    var root = build(items, 0, null);
    document.body.appendChild(root);
    openMenus.push({ el: root, parentItem: null });
    place(root, o.x || 0, o.y || 0, o.anchor ? o.anchor.getBoundingClientRect() : null, null, o.align);
    var s = {
      restore: document.activeElement, anchor: o.anchor || null, onClose: o.onClose,
      onOutside: function (ev) { if (!openMenus.some(function (m) { return m.el.contains(ev.target); })) { close(false); } },
      onKey: function (ev) {
        if (ev.key === 'Escape') {
          ev.preventDefault();
          ev.stopPropagation();
          if (openMenus.length > 1) { var parent = openMenus[openMenus.length - 1].parentItem; closeFrom(openMenus.length - 1); if (parent) { parent.focus({ preventScroll: true }); } } else { close(true); }
          return;
        }
        if (!openMenus.some(function (m) { return m.el.contains(document.activeElement); }) && /^Arrow(Down|Up)$/.test(ev.key)) { ev.preventDefault(); focusItem(openMenus[0].el, ev.key === 'ArrowDown' ? 0 : -1); }
      },
      onBlur: function () { close(false); },
      onScroll: function (ev) { if (!openMenus.some(function (m) { return m.el.contains(ev.target); })) { close(false); } },
    };
    state = s;
    document.addEventListener('pointerdown', s.onOutside, true);
    document.addEventListener('keydown', s.onKey, true);
    window.addEventListener('blur', s.onBlur);
    window.addEventListener('resize', s.onBlur);
    window.addEventListener('scroll', s.onScroll, true);
    if (o.anchor) { o.anchor.setAttribute('aria-expanded', 'true'); }
    if (o.focusFirst || o.anchor) { focusItem(root, 0); } else { root.focus({ preventScroll: true }); }
    return { close: function () { close(true); }, el: root };
  }

  window.DtMenu = {
    open: open,
    close: function () { close(false); },
    isOpen: function () { return openMenus.length > 0; },
    element: function () { return openMenus.length ? openMenus[0].el : null; },
  };
})();
