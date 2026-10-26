'use strict';
/* Shared helpers of batch T3a (flyers, posters, notices; numbers 300 to 399). Not built on its own (the file name does not start with a number).
   A family file `_t3a-<family>.js` exports `variants` (an array of template modules); the numbered stubs `3NN-<slug>.js` pick one of them. */
const dsl = require('./dsl');
const { text, rect, ellipse, line, icon, group, shadow } = dsl;

const pt = v => v * 25.4 / 72;           // points to mm
const ADDRESS = 'Musterstraße 12, 12345 Musterstadt';
const PHONE = '0123 456 789';
const WEB = 'www.beispiel.de';

/** One info row: icon in a circle (or bare) + small label + value. Returns an array. */
function infoRow(name, iconName, x, y, w, label, value, o = {}) {
  const ic = o.ic || 7;            // icon size mm
  const c = o.c || '#111111';
  const lc = o.lc || '#666666';
  const out = [];
  if (o.disc) out.push(ellipse(name + ' Scheibe', x, y, o.discSize || ic + 3, o.discSize || ic + 3, o.disc));
  const dx = o.disc ? ((o.discSize || ic + 3) - ic) / 2 : 0;
  out.push(icon(name + ' Symbol', iconName, x + dx, y + dx, ic, o.icolor || c, o.sw || 1.8));
  const off = (o.disc ? (o.discSize || ic + 3) : ic) + (o.gap || 3);
  const ls = o.ls || 7.5;
  const vs = o.vs || 10;
  if (label) out.push(text(name + ' Beschriftung', x + off, y - 0.6, w - off, pt(ls) * 1.4, label, { f: o.lf || 'Source Sans 3', s: ls, w: 700, c: lc, up: true, ls: 0.14, v: 'top', min: 5 }));
  out.push(text(name + ' Wert', x + off, y + (label ? pt(ls) * 1.4 - 0.6 : 0), w - off, o.vh || pt(vs) * (o.lines || 1) * 1.3, value, { f: o.f || 'Source Sans 3', s: vs, w: o.vw || 600, c, v: label ? 'top' : 'middle', wrap: !!o.lines && o.lines > 1, lh: 1.25, min: 6 }));
  return out;
}

/**
 * Tear-off strip of an A4 notice: a dashed cut line, a scissors icon and `n` tabs of the same width with vertical text.
 * lines = array of texts per tab (the contact), y0 = top of the tabs, height = h. Colour options: line, c (text), bg (tab fill, optional), f font.
 */
function tearOff(n, y0, h, lines, o = {}) {
  const W = 210;
  const margin = o.margin || 0;
  const w = (W - 2 * margin) / n;
  const out = [];
  const col = o.line || '#555555';
  if (o.bg) out.push(rect('Abreißstreifen Hintergrund', 0, y0, W, h, o.bg, { locked: true }));
  out.push(line('Schnittlinie', 0, y0, W, y0, col, 0.6, { dash: 'dashed', locked: true }));
  for (let i = 1; i < n; i++) out.push(line('Trennlinie ' + i, margin + i * w, y0, margin + i * w, y0 + h, col, 0.6, { dash: 'dashed', locked: true }));
  out.push(icon('Schere', 'scissors', 6, y0 - 3.4, 6.8, col, 1.8, { rotation: 0 }));
  for (let i = 0; i < n; i++) {
    const cx = margin + i * w + w / 2;
    const cy = y0 + h / 2;
    // a text turned by -90 degrees: its box is h x w before the turn
    const inner = h - 8;
    const lh = o.lineH || 6;
    const total = lines.length * lh;
    lines.forEach((t, k) => {
      const ccx = cx - total / 2 + (k + 0.5) * lh;   // centre of the turned line
      out.push(text('Zettel ' + (i + 1) + ' Zeile ' + (k + 1), ccx - inner / 2, cy - lh / 2, inner, lh, t, { f: o.f || 'Source Sans 3', s: (o.sizes || [])[k] || o.s || 11, w: (o.weights || [])[k] || 600, c: (o.colors || [])[k] || o.c || '#111111', a: 'center', min: 6, rotation: -90 }));
    });
  }
  return out;
}

module.exports = { dsl, pt, ADDRESS, PHONE, WEB, infoRow, tearOff };
