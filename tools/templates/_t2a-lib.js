/* Helpers of batch T2a (cards and weddings, numbers 100 to 199). The file starts with an underscore, so tools/templates-build.js ignores it as a module.
   The kinds live in _k-<kind>.js (an object with one template per variant); the numbered files 1NN-<slug>.js only pick one of them. */
'use strict';
const d = require('./dsl');
const { text, rect, ellipse, line, icon, shape, deko, field, typo } = d;

/** A text centred on the x position cx (box width w). */
const ctext = (name, cx, y, w, h, value, o = {}) => text(name, cx - w / 2, y, w, h, value, Object.assign({ a: 'center' }, o));

/** A small rotated square. */
const diamond = (name, cx, cy, s, color, o = {}) => rect(name, cx - s / 2, cy - s / 2, s, s, color, Object.assign({ rotation: 45 }, o));

/** A thin line with a diamond (or a heart icon) in the middle: the divider of the classic styles. mid: 'diamond' | 'heart' | 'dot' | 'none' */
function divider(name, cx, cy, w, color, o = {}) {
  const gap = o.gap === undefined ? 5 : o.gap;
  const sw = o.sw || 0.3;
  const out = [
    line(name + ' links', cx - w / 2, cy, cx - gap, cy, color, sw),
    line(name + ' rechts', cx + gap, cy, cx + w / 2, cy, color, sw),
  ];
  const mid = o.mid || 'diamond';
  if (mid === 'diamond') out.push(diamond(name + ' Raute', cx, cy, o.size || 1.8, color));
  else if (mid === 'heart') out.push(icon(name + ' Herz', 'heart', cx - (o.size || 3.4) / 2, cy - (o.size || 3.4) / 2, o.size || 3.4, color, 2));
  else if (mid === 'dot') out.push(ellipse(name + ' Punkt', cx - (o.size || 1.4) / 2, cy - (o.size || 1.4) / 2, o.size || 1.4, o.size || 1.4, color));
  return out;
}

/** Four thin corner brackets (ticks) around a box; a modern frame. */
function ticks(name, x, y, w, h, len, color, sw = 0.3) {
  return [
    line(name + ' o-l h', x, y, x + len, y, color, sw), line(name + ' o-l v', x, y, x, y + len, color, sw),
    line(name + ' o-r h', x + w - len, y, x + w, y, color, sw), line(name + ' o-r v', x + w, y, x + w, y + len, color, sw),
    line(name + ' u-l h', x, y + h, x + len, y + h, color, sw), line(name + ' u-l v', x, y + h - len, x, y + h, color, sw),
    line(name + ' u-r h', x + w - len, y + h, x + w, y + h, color, sw), line(name + ' u-r v', x + w, y + h - len, x + w, y + h, color, sw),
  ];
}

/** A plain frame (a rectangle line) */
const frameLine = (name, x, y, w, h, color, sw = 0.3, o = {}) => rect(name, x, y, w, h, null, Object.assign({ stroke: color, sw, locked: true }, o));

/** The common meta of a template: defaults for category, unit. */
const tpl = o => Object.assign({ category: 'Karten', unit: 'mm' }, o);

/** Locked decoration: a deko piece that nobody moves by accident. */
const dk = (name, key, x, y, w, h, o = {}) => deko(name, key, x, y, w, h, Object.assign({ locked: true }, o));

module.exports = Object.assign({}, d, { ctext, diamond, divider, ticks, frameLine, tpl, dk });
