/* MatCan editor, part 3: the building blocks of floating UI. One code base for
   - D.menu.open(items, { x, y } | { anchor })  context menus and the menus of the top bar (Datei, ⋯): MatUi classes (mat-menu, mat-menu__item), submenus, shortcuts at the
     right, disabled entries with a reason as tooltip, arrow keys, Escape, positioned inside the viewport;
   - D.popover.open(anchor, build, opts)         a small panel next to a button (font list, colours, transparency ...); a bottom sheet on phones (CSS);
   - D.dialog.show(opts)                          a MatUi dialog built with DOM APIs, resolves with the value of the button that closed it.
   Entries of a menu: { label, icon, shortcut, run, disabled (true | reason text), danger, checked, submenu: [...], hidden } or { type: 'separator' } or { type: 'header', label }. */
(function () {
  'use strict';

  var D = window.DtDesigner;

  // ================================================================================================ menus

  var openMenus = [];       // [{ el, parentItem }] root first
  var menuState = null;     // { restore, anchor, onClose, handlers }

  function visibleItems(items) {
    var out = [];
    (items || []).forEach(function (it) {
      if (!it || it.hidden) { return; }
      if (it.type === 'separator') { if (out.length && out[out.length - 1].type !== 'separator') { out.push(it); } return; }
      out.push(it);
    });
    while (out.length && out[out.length - 1].type === 'separator') { out.pop(); }
    return out;
  }

  function isEnabled(it) { return !it.disabled && it.type !== 'separator' && it.type !== 'header'; }

  function closeFrom(level) {
    while (openMenus.length > level) {
      var m = openMenus.pop();
      if (m.el.parentNode) { m.el.parentNode.removeChild(m.el); }
      if (m.parentItem) { m.parentItem.setAttribute('aria-expanded', 'false'); }
    }
  }

  function closeMenu(restoreFocus) {
    if (!openMenus.length) { return; }
    closeFrom(0);
    var s = menuState;
    menuState = null;
    if (!s) { return; }
    document.removeEventListener('pointerdown', s.onOutside, true);
    document.removeEventListener('keydown', s.onKey, true);
    window.removeEventListener('blur', s.onBlur);
    window.removeEventListener('resize', s.onBlur);
    window.removeEventListener('wheel', s.onWheel, true);
    if (s.anchor) { s.anchor.setAttribute('aria-expanded', 'false'); }
    if (restoreFocus && s.restore && s.restore.focus && document.contains(s.restore)) { s.restore.focus({ preventScroll: true }); }
    if (s.onClose) { s.onClose(); }
    document.documentElement.classList.remove('is-menu-open');
  }

  function place(menu, x, y, anchorRect, side) {
    menu.style.setProperty('left', '0px');
    menu.style.setProperty('top', '0px');
    menu.style.setProperty('visibility', 'hidden');
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var w = menu.offsetWidth;
    var h = menu.offsetHeight;
    var left;
    var top;
    if (anchorRect && side === 'side') {
      left = anchorRect.right + 2;
      if (left + w > vw - 8) { left = Math.max(8, anchorRect.left - w - 2); }
      top = anchorRect.top - 8;
      if (top + h > vh - 8) { top = Math.max(8, vh - h - 8); }
    } else if (anchorRect) {
      left = Math.min(Math.max(8, anchorRect.left), vw - w - 8);
      top = anchorRect.bottom + 8;
      if (top + h > vh - 8) { top = Math.max(8, anchorRect.top - h - 8); }
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

  function itemButtons(menu) { return D.$$('.dt-menu__item:not(.is-disabled)', menu); }

  function focusItem(menu, index) {
    var list = itemButtons(menu);
    if (!list.length) { return; }
    var i = (index + list.length) % list.length;
    list[i].focus({ preventScroll: true });
  }

  function buildMenu(items, level, parentItem) {
    var menu = D.el('div', { class: 'mat-menu dt-menu', role: 'menu', tabindex: '-1', 'data-level': level });
    visibleItems(items).forEach(function (it) {
      if (it.type === 'separator') { menu.appendChild(D.el('div', { class: 'mat-menu__sep', role: 'separator' })); return; }
      if (it.type === 'header') { menu.appendChild(D.el('div', { class: 'dt-menu__header', text: it.label, role: 'presentation' })); return; }
      var disabled = !!it.disabled;
      var role = it.checked !== undefined && it.checked !== null ? 'menuitemcheckbox' : 'menuitem';
      var b = D.el('button', {
        type: 'button', class: 'mat-menu__item dt-menu__item' + (disabled ? ' is-disabled' : '') + (it.danger ? ' mat-menu__item--danger' : '') + (it.cls ? ' ' + it.cls : ''), role: role,
        'aria-disabled': disabled ? 'true' : null, title: typeof it.disabled === 'string' ? it.disabled : (it.title || null),
        'aria-haspopup': it.submenu ? 'menu' : null, 'aria-expanded': it.submenu ? 'false' : null, 'aria-checked': role === 'menuitemcheckbox' ? String(!!it.checked) : null,
      });
      var iconHost = D.el('span', { class: 'dt-menu__icon' });
      if (it.icon) { iconHost.appendChild(D.icon(it.icon)); }
      b.appendChild(iconHost);
      b.appendChild(D.el('span', { class: 'dt-menu__label', text: it.label }));
      if (it.shortcut) { b.appendChild(D.el('span', { class: 'dt-menu__kbd', text: it.shortcut })); }
      if (it.checked) { b.appendChild(D.icon('check', 'dt-menu__check')); }
      if (it.submenu) { b.appendChild(D.icon('chevron-right', 'dt-menu__chev')); }
      var sub = null;
      var openSub = function (focusFirst) {
        if (!it.submenu || disabled) { return; }
        if (openMenus[level + 1] && openMenus[level + 1].parentItem === b) { if (focusFirst) { focusItem(openMenus[level + 1].el, 0); } return; }
        closeFrom(level + 1);
        sub = buildMenu(it.submenu, level + 1, b);
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
        var restore = menuState && menuState.restore;
        closeMenu(false);
        // the menu is gone before the action runs: a dialog it opens does not get a removed button as its opener
        if (it.run) { it.run(); } else if (restore && restore.focus) { restore.focus({ preventScroll: true }); }
      });
      b._open = openSub;
      menu.appendChild(b);
    });
    menu.addEventListener('keydown', function (ev) {
      var list = itemButtons(menu);
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

  /**
   * Opens a menu at a point ({ x, y } client coordinates) or below a button ({ anchor }). options.focusFirst focuses the first entry (keyboard use); options.onClose runs when it is gone.
   * Only one menu tree is open at a time; the focus returns to where it was when the menu closes by Escape.
   */
  function openMenu(items, options) {
    var o = options || {};
    closeMenu(false);
    D.popover.close();
    var root = buildMenu(items, 0, null);
    document.body.appendChild(root);
    openMenus.push({ el: root, parentItem: null });
    var anchorRect = o.anchor ? o.anchor.getBoundingClientRect() : null;
    place(root, o.x || 0, o.y || 0, anchorRect, o.anchor ? 'below' : null);
    document.documentElement.classList.add('is-menu-open');
    var state = {
      restore: document.activeElement, anchor: o.anchor || null, onClose: o.onClose,
      onOutside: function (ev) { if (!openMenus.some(function (m) { return m.el.contains(ev.target); })) { closeMenu(false); } },
      onKey: function (ev) {
        if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); if (openMenus.length > 1) { var parent = openMenus[openMenus.length - 1].parentItem; closeFrom(openMenus.length - 1); if (parent) { parent.focus({ preventScroll: true }); } } else { closeMenu(true); } return; }
        // a key that is not for the menu while focus is outside of it: bring the focus in
        if (!openMenus.some(function (m) { return m.el.contains(document.activeElement); }) && /^Arrow(Down|Up)$/.test(ev.key)) { ev.preventDefault(); focusItem(openMenus[0].el, ev.key === 'ArrowDown' ? 0 : -1); }
      },
      onBlur: function () { closeMenu(false); },
      onWheel: function (ev) { if (!openMenus.some(function (m) { return m.el.contains(ev.target); })) { closeMenu(false); } },
    };
    menuState = state;
    document.addEventListener('pointerdown', state.onOutside, true);
    document.addEventListener('keydown', state.onKey, true);
    window.addEventListener('blur', state.onBlur);
    window.addEventListener('resize', state.onBlur);
    window.addEventListener('wheel', state.onWheel, { capture: true, passive: true });
    if (o.anchor) { o.anchor.setAttribute('aria-expanded', 'true'); }
    if (o.focusFirst || o.anchor) { focusItem(root, 0); } else { root.focus({ preventScroll: true }); }
    return { close: function () { closeMenu(true); }, el: root };
  }

  D.menu = {
    open: openMenu,
    close: function () { closeMenu(false); },
    isOpen: function () { return openMenus.length > 0; },
    /** The element of the open menu (for the browser checks). */
    element: function () { return openMenus.length ? openMenus[0].el : null; },
  };

  // ================================================================================================ popovers

  var openPopover = null;

  function closePopover(restoreFocus) {
    var p = openPopover;
    if (!p) { return; }
    openPopover = null;
    document.removeEventListener('pointerdown', p.onOutside, true);
    document.removeEventListener('keydown', p.onKey, true);
    window.removeEventListener('resize', p.onResize);
    if (p.el._cleanup) { p.el._cleanup(); }
    if (p.el.parentNode) { p.el.parentNode.removeChild(p.el); }
    if (p.anchor) { p.anchor.setAttribute('aria-expanded', 'false'); p.anchor.classList.remove('is-open'); }
    if (restoreFocus && p.anchor && p.anchor.focus && document.contains(p.anchor)) { p.anchor.focus({ preventScroll: true }); }
    if (p.onClose) { p.onClose(); }
  }

  /**
   * A panel next to `anchor`. build(el, api) fills it (api.close(), api.reposition()). options: title (aria label), width (px), align ('start' | 'center' | 'end'), onClose, keepEdit (a text
   * that is being edited keeps its focus: no focus change when the panel is clicked). A second open on the same anchor closes it (toggle). On phones CSS makes it a bottom sheet.
   */
  function popoverOpen(anchor, build, options) {
    var o = options || {};
    if (openPopover && openPopover.anchor === anchor) { closePopover(false); return null; }
    closePopover(false);
    D.menu.close();
    var el = D.el('div', { class: 'dt-popover' + (o.className ? ' ' + o.className : ''), role: 'dialog', 'aria-label': o.title || 'Optionen', 'data-keep-edit': o.keepEdit === false ? null : '' });
    if (o.width) { el.style.setProperty('--dt-pop-w', o.width + 'px'); }
    var api = {
      el: el,
      close: function (restore) { if (openPopover && openPopover.el === el) { closePopover(restore !== false); } },
      reposition: function () { position(); },
    };
    var position = function () {
      var r = anchor.getBoundingClientRect();
      el.style.setProperty('left', '0px');
      el.style.setProperty('top', '0px');
      var w = el.offsetWidth;
      var h = el.offsetHeight;
      var vw = window.innerWidth;
      var vh = window.innerHeight;
      var left = o.align === 'end' ? r.right - w : (o.align === 'center' ? r.left + r.width / 2 - w / 2 : r.left);
      left = Math.min(Math.max(8, left), vw - w - 8);
      var top = r.bottom + 8;
      if (top + h > vh - 8) { top = Math.max(8, r.top - h - 8); }
      el.style.setProperty('left', Math.round(left) + 'px');
      el.style.setProperty('top', Math.round(top) + 'px');
    };
    build(el, api);
    document.body.appendChild(el);
    position();
    anchor.setAttribute('aria-expanded', 'true');
    anchor.classList.add('is-open');
    if (o.keepEdit !== false) {
      // clicking a button of the panel must not take the focus from a text that is being edited (inputs still get it)
      el.addEventListener('mousedown', function (ev) { if (!/^(INPUT|TEXTAREA|SELECT)$/.test(ev.target.tagName) && !ev.target.closest('input, textarea, select, label')) { ev.preventDefault(); } });
    }
    openPopover = {
      el: el, anchor: anchor, onClose: o.onClose,
      onOutside: function (ev) {
        if (el.contains(ev.target) || anchor.contains(ev.target)) { return; }
        // a colour picker of the system or a menu opened from inside the panel is not "outside"
        if (ev.target.closest && ev.target.closest('.mat-menu, dialog')) { return; }
        closePopover(false);
      },
      onKey: function (ev) { if (ev.key === 'Escape' && !D.menu.isOpen()) { ev.stopPropagation(); closePopover(true); } },
      onResize: function () { position(); },
    };
    document.addEventListener('pointerdown', openPopover.onOutside, true);
    document.addEventListener('keydown', openPopover.onKey, true);
    window.addEventListener('resize', openPopover.onResize);
    var first = D.$('input:not([type=hidden]), [data-autofocus]', el);
    if (first && o.focus !== false && !window.matchMedia('(pointer: coarse)').matches) { first.focus({ preventScroll: true }); }
    return api;
  }

  D.popover = { open: popoverOpen, close: function (restore) { closePopover(!!restore); }, isOpen: function () { return !!openPopover; }, element: function () { return openPopover ? openPopover.el : null; } };

  // ================================================================================================ dialogs

  /**
   * A dialog. options: title, icon, size ('sm' | 'lg' | 'xl' | ''), className, body(bodyEl, api), buttons: [{ label, kind: 'primary'|'secondary'|'danger', value, keepOpen, onClick(api), disabled, icon }],
   * spacer: put the first button after a spacer index (destructive actions last), onOpen(api). api: { dialog, body, foot, close(value), button(value) }.
   * Resolves with the value of the button (or 'cancel' for X, Escape, the backdrop).
   */
  D.dialog = {
    show: function (options) {
      var o = options || {};
      return new Promise(function (resolve) {
        var id = D.uid('dt-dlg');
        var dlg = D.el('dialog', { class: 'mat-dialog' + (o.size ? ' mat-dialog--' + o.size : ' mat-dialog--sm') + (o.className ? ' ' + o.className : ''), 'data-static': '', 'aria-labelledby': id + '-t' });
        var close = D.el('button', { type: 'button', class: 'mat-btn mat-btn--ghost mat-btn--icon mat-dialog__close', 'aria-label': 'Schließen', 'data-dialog-close': '' }, D.icon('x'));
        var head = D.el('div', { class: 'mat-dialog__head' }, [o.icon ? D.icon(o.icon) : null, D.el('h2', { class: 'mat-dialog__title', id: id + '-t', text: o.title || '' }), close]);
        var body = D.el('div', { class: 'mat-dialog__body' });
        var foot = D.el('div', { class: 'mat-btn-row mat-btn-row--plain' });
        var form = D.el('form', { class: 'mat-dialog__form', method: 'dialog' }, [head, body, D.el('div', { class: 'mat-dialog__foot' }, foot)]);
        dlg.appendChild(form);
        var done = false;
        var api = {
          dialog: dlg, body: body, foot: foot,
          close: function (value) { if (window.MatUi && window.MatUi.dialog) { window.MatUi.dialog.close(dlg, value === undefined ? 'ok' : value); } else { dlg.close(value); } },
          button: function (value) { return D.$('[data-value="' + value + '"]', foot); },
        };
        (o.buttons || []).forEach(function (b) {
          if (b.spacer) { foot.appendChild(D.el('span', { class: 'mat-btn-row__spacer' })); }
          var cls = 'mat-btn ' + (b.kind === 'primary' ? 'mat-btn--primary' : (b.kind === 'danger' ? 'mat-btn--danger mat-btn--solid' : 'mat-btn--secondary'));
          var btn = D.el('button', { type: 'button', class: cls, 'data-value': b.value === undefined ? '' : String(b.value), disabled: b.disabled });
          if (b.icon) { btn.appendChild(D.icon(b.icon)); }
          btn.appendChild(D.el('span', { text: b.label }));
          btn.addEventListener('click', function () {
            if (b.onClick) { var r = b.onClick(api); if (r === false) { return; } }
            if (!b.keepOpen) { api.close(b.value === undefined ? 'ok' : b.value); }
          });
          foot.appendChild(btn);
        });
        document.body.appendChild(dlg);
        dlg.addEventListener('close', function () {
          if (done) { return; }
          done = true;
          var v = dlg.returnValue || 'cancel';
          if (o.onClose) { o.onClose(v); }
          resolve(v);
          setTimeout(function () { dlg.remove(); }, 0);
        });
        if (o.body) { o.body(body, api); }
        if (o.onOpen) { o.onOpen(api); }
        form.addEventListener('submit', function (ev) { ev.preventDefault(); var primary = D.$('.mat-btn--primary:not(:disabled)', foot); if (primary) { primary.click(); } });
        window.MatUi.dialog.open(dlg);
      });
    },
  };
})();
