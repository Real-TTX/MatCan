/* MatCan editor, part 5b: the "Verlauf" tab of the colour picker (page background, fill of a shape). A linear gradient with two to five stops: a bar with draggable stops (click on the
   bar adds one, Entf removes the selected one, arrows move it), the angle (CSS: 0 = to top, 90 = to right), the colour and position of the selected stop, and ready presets. The picker
   calls build(host, ctx) of every entry of D.colors.tabs; ctx.set(gradient, final) changes the fill (live while dragging, final on release: the caller makes one undo step of it). */
(function () {
  'use strict';

  var D = window.DtDesigner;
  var MAX_STOPS = 5;

  var PRESETS = [
    ['Sonnenuntergang', 90, [[0, '#ff7e5f'], [1, '#feb47b']]],
    ['Ozean', 180, [[0, '#1fb3d6'], [1, '#1e3a8a']]],
    ['Wald', 160, [[0, '#2e9d5b'], [1, '#14532d']]],
    ['Himbeere', 135, [[0, '#f472b6'], [1, '#db2777']]],
    ['Nacht', 180, [[0, '#1e3a8a'], [1, '#111827']]],
    ['Minze', 90, [[0, '#bbf7d0'], [1, '#bae6fd']]],
    ['Gold', 135, [[0, '#fde68a'], [0.5, '#f5a524'], [1, '#a16207']]],
    ['Regenbogen', 90, [[0, '#e5484d'], [0.25, '#facc15'], [0.5, '#2e9d5b'], [0.75, '#2f86f6'], [1, '#a855f7']]],
    ['Pfirsich', 160, [[0, '#fff7ed'], [1, '#f97316']]],
    ['Schiefer', 180, [[0, '#9ca3af'], [1, '#374151']]],
  ];

  function css(angle, stops) {
    return 'linear-gradient(' + angle + 'deg, ' + stops.map(function (s) { return s.color + ' ' + D.round(s.offset * 100, 1) + '%'; }).join(', ') + ')';
  }

  function hexToRgb(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
  function rgbToHex(c) { return '#' + c.map(function (v) { var n = Math.max(0, Math.min(255, Math.round(v))); return (n < 16 ? '0' : '') + n.toString(16); }).join(''); }

  /** The colour of the gradient at an offset (for a stop that is added by a click on the bar). */
  function colourAt(stops, offset) {
    var sorted = stops.slice().sort(function (a, b) { return a.offset - b.offset; });
    if (offset <= sorted[0].offset) { return sorted[0].color; }
    for (var i = 1; i < sorted.length; i++) {
      if (offset <= sorted[i].offset) {
        var a = sorted[i - 1];
        var b = sorted[i];
        var t = (offset - a.offset) / Math.max(0.0001, b.offset - a.offset);
        var ca = hexToRgb(a.color);
        var cb = hexToRgb(b.color);
        return rgbToHex([ca[0] + (cb[0] - ca[0]) * t, ca[1] + (cb[1] - ca[1]) * t, ca[2] + (cb[2] - ca[2]) * t]);
      }
    }
    return sorted[sorted.length - 1].color;
  }

  /** A gradient made from a plain colour: the colour to a darker version of it. */
  function fromColour(hex) {
    var c = /^#[0-9a-f]{6}$/i.test(hex || '') ? hex.toLowerCase() : '#1fb3d6';
    var rgb = hexToRgb(c);
    var dark = rgbToHex(rgb.map(function (v) { return v * 0.55; }));
    var light = rgbToHex(rgb.map(function (v) { return v + (255 - v) * 0.45; }));
    return { type: 'linear', angle: 135, stops: [{ offset: 0, color: light }, { offset: 1, color: dark }] };
  }

  function build(host, ctx) {
    var value = ctx.value();
    var g = value && typeof value === 'object' && value.stops ? D.clone(value) : fromColour(typeof value === 'string' ? value : null);
    var selected = 0;
    host.classList.add('dt-grad');

    var bar = D.el('div', { class: 'dt-grad__bar', role: 'group', 'aria-label': 'Verlauf: Farbstopps' });
    var track = D.el('div', { class: 'dt-grad__track', 'aria-hidden': 'true' });
    var handles = D.el('div', { class: 'dt-grad__handles' });
    bar.appendChild(track);
    bar.appendChild(handles);
    var preview = D.el('div', { class: 'dt-grad__preview', 'aria-hidden': 'true', title: 'So sieht der Verlauf aus' });

    var angle = D.ui.slider({ min: 0, max: 360, step: 1, value: g.angle, suffix: '°', label: 'Winkel', onInput: function (v) { g.angle = Math.round(v); paint(); emit(false); } });
    var native = D.el('input', { type: 'color', class: 'dt-colour__native', 'aria-label': 'Farbe des Stopps' });
    var hex = D.el('input', { type: 'text', class: 'mat-input mat-input--sm dt-colour__hex', maxlength: 7, spellcheck: 'false', autocomplete: 'off', 'aria-label': 'Farbe des Stopps als Hex-Wert', placeholder: '#000000' });
    var position = D.ui.number({ value: 0, min: 0, max: 100, step: 1, digits: 0, suffix: '%', label: 'Position des Stopps', onInput: function (v) { g.stops[selected].offset = D.round(v / 100, 3); paint(); emit(false); } });
    var remove = D.ui.textButton('trash', 'Stopp löschen', function () { removeStop(selected); }, { cls: 'dt-grad__remove' });
    var stopRow = D.el('div', { class: 'dt-grad__stop' }, [native, hex, position.el, remove]);

    var presets = D.el('div', { class: 'dt-grad__presets', role: 'group', 'aria-label': 'Vorgaben' });
    PRESETS.forEach(function (p) {
      var b = D.el('button', { type: 'button', class: 'dt-grad__preset', title: p[0], 'aria-label': 'Verlauf ' + p[0], 'data-preset': p[0] });
      b.style.setProperty('background-image', css(p[1], p[2].map(function (s) { return { offset: s[0], color: s[1] }; })));
      b.addEventListener('click', function () {
        g = { type: 'linear', angle: p[1], stops: p[2].map(function (s) { return { offset: s[0], color: s[1] }; }) };
        selected = 0;
        angle.set(g.angle);
        draw();
        emit(true);
      });
      presets.appendChild(b);
    });

    function emit(final) {
      var out = D.clone(g);
      out.stops.sort(function (a, b) { return a.offset - b.offset; });
      ctx.set(out, final);
    }

    function paint() {
      track.style.setProperty('background-image', css(90, g.stops));
      preview.style.setProperty('background-image', css(g.angle, g.stops));
      var s = g.stops[selected];
      if (!s) { return; }
      native.value = s.color;
      if (document.activeElement !== hex) { hex.value = s.color; }
      position.set(s.offset * 100);
      Array.prototype.forEach.call(handles.children, function (h, i) {
        h.style.setProperty('left', D.round(g.stops[i].offset * 100, 2) + '%');
        h.style.setProperty('--dt-swatch', g.stops[i].color);
        h.setAttribute('aria-pressed', String(i === selected));
        h.classList.toggle('is-selected', i === selected);
      });
      remove.disabled = g.stops.length <= 2;
    }

    function removeStop(i) {
      if (g.stops.length <= 2) { return; }
      g.stops.splice(i, 1);
      selected = Math.max(0, Math.min(selected, g.stops.length - 1));
      draw();
      emit(true);
    }

    function draw() {
      D.empty(handles);
      g.stops.forEach(function (s, i) {
        var h = D.el('button', { type: 'button', class: 'dt-grad__handle', 'aria-label': 'Farbstopp ' + (i + 1) + ' von ' + g.stops.length, 'data-stop': i });
        h.addEventListener('pointerdown', function (ev) {
          if (ev.button !== 0) { return; }
          ev.preventDefault();
          ev.stopPropagation();
          selected = i;
          h.setPointerCapture(ev.pointerId);
          var rect = track.getBoundingClientRect();
          var moved = false;
          var move = function (e) {
            moved = true;
            g.stops[i].offset = D.round(D.clamp((e.clientX - rect.left) / rect.width, 0, 1), 3);
            paint();
            emit(false);
          };
          var up = function () {
            h.removeEventListener('pointermove', move);
            h.removeEventListener('pointerup', up);
            h.removeEventListener('pointercancel', up);
            if (moved) { emit(true); }
          };
          h.addEventListener('pointermove', move);
          h.addEventListener('pointerup', up);
          h.addEventListener('pointercancel', up);
          paint();
        });
        h.addEventListener('keydown', function (ev) {
          if (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') {
            ev.preventDefault();
            ev.stopPropagation();
            g.stops[i].offset = D.round(D.clamp(g.stops[i].offset + (ev.key === 'ArrowRight' ? 1 : -1) * (ev.shiftKey ? 0.1 : 0.01), 0, 1), 3);
            selected = i;
            paint();
            emit(false);
          } else if (ev.key === 'Delete' || ev.key === 'Backspace') {
            ev.preventDefault();
            ev.stopPropagation();
            removeStop(i);
          }
        });
        h.addEventListener('click', function () { selected = i; paint(); });
        handles.appendChild(h);
      });
      paint();
    }

    // a click on the bar (not on a stop) adds a stop there, with the colour the gradient has at that place
    bar.addEventListener('pointerdown', function (ev) {
      if (ev.target.closest('.dt-grad__handle') || ev.button !== 0) { return; }
      if (g.stops.length >= MAX_STOPS) { D.toast('Ein Verlauf hat höchstens ' + MAX_STOPS + ' Farben.', 'warning'); return; }
      var rect = track.getBoundingClientRect();
      var offset = D.round(D.clamp((ev.clientX - rect.left) / rect.width, 0, 1), 3);
      g.stops.push({ offset: offset, color: colourAt(g.stops, offset) });
      selected = g.stops.length - 1;
      draw();
      emit(true);
    });

    native.addEventListener('input', function () { g.stops[selected].color = native.value; paint(); emit(false); });
    native.addEventListener('change', function () { g.stops[selected].color = native.value; paint(); emit(true); });
    var commitHex = function (final) {
      var c = D.colors.normHex(hex.value);
      if (!c) { return; }
      g.stops[selected].color = c;
      paint();
      emit(final);
    };
    hex.addEventListener('input', function () { commitHex(false); });
    hex.addEventListener('change', function () { commitHex(true); });
    hex.addEventListener('keydown', function (ev) { ev.stopPropagation(); if (ev.key === 'Enter') { commitHex(true); } });
    position.input.addEventListener('change', function () { emit(true); });
    position.input.addEventListener('blur', function () { emit(true); });
    angle.el.addEventListener('change', function () { emit(true); });
    angle.el.addEventListener('pointerup', function () { emit(true); });

    host.appendChild(D.el('div', { class: 'dt-grad__top' }, [D.el('div', { class: 'dt-grad__barwrap' }, bar), preview]));
    host.appendChild(stopRow);
    host.appendChild(D.ui.field('Winkel', angle.el));
    host.appendChild(D.el('p', { class: 'dt-hint', text: 'Klicke auf den Balken, um eine Farbe hinzuzufügen. Ziehe die Punkte, um sie zu verschieben.' }));
    host.appendChild(D.el('h4', { class: 'dt-colorpop__title', text: 'Vorgaben' }));
    host.appendChild(presets);
    draw();
    // the picker shows the gradient only when the person chooses one: opening the tab does not change the fill
  }

  D.colors.tabs.push({ id: 'gradient', title: 'Verlauf', build: build });
  D.gradient = { css: css, fromColour: fromColour, PRESETS: PRESETS };
})();
