/* Helpers of batch V4 (Einladungen für Erwachsene und Mottopartys, numbers 830 to 909). The underscore keeps this file out of templates-build.js.
   The families live in _v4-<group>.js (each exports { templates }); _v4-stubs.js writes the one-line numbered modules 8NN-<slug>.js. */
'use strict';
const D = require('./dsl');
const { text, rect, ellipse, icon, line, shape } = D;

const NB = ' ';
const DAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
/** when(12, 6) = "Samstag, 12. Juni 2027" (the weekday is the real one of 2027, the space after the day and before the year does not break). */
function when(day, month, short = false) {
  const wd = DAYS[new Date(Date.UTC(2027, month - 1, day)).getUTCDay()];
  return (short ? wd.slice(0, 2) + '.' : wd + ',') + ' ' + day + '.' + NB + MONTHS[month - 1] + NB + '2027';
}
const uhr = (t) => t + NB + 'Uhr';

/** Marks every element that is not a text as locked (decoration). */
const decor = (list) => D.flat(list).map((e) => (e.type === 'text' ? e : Object.assign({}, e, { locked: true })));
/** A centred (by default) text. */
const T = (name, x, y, w, h, value, f, s, c, o = {}) => text(name, x, y, w, h, value, Object.assign({ f, s, c, a: 'center' }, o));
/** A paragraph that wraps (top aligned). */
const P = (name, x, y, w, h, value, f, s, c, o = {}) => text(name, x, y, w, h, value, Object.assign({ f, s, c, a: 'center', wrap: true, v: 'top', lh: 1.3 }, o));

/** One detail line: a round chip with an icon and the text to its right. */
function info(name, x, y, w, iconName, label, o = {}) {
  const d = o.d || 8;
  const out = [];
  if (o.chip !== null) out.push(ellipse(name + ' Chip', x, y, d, d, o.chip || '#ffffff', { locked: true }));
  out.push(icon(name + ' Symbol', iconName, x + d * 0.22, y + d * 0.22, d * 0.56, o.ic || '#111111', o.sw || 2, { locked: true }));
  out.push(text(name, x + d + 2.5, y - 0.5, w - d - 2.5, d + 1, label, { f: o.f || 'Nunito', s: o.s || 9.5, w: o.w || 600, c: o.c || '#111111', v: 'middle', a: o.a || 'left', wrap: true, fit: 'shrink', lh: 1.15, min: o.min || 6.5 }));
  return out;
}
/** The usual three lines (Datum, Ort, Zusage) one under the other: rows = [[icon, label], ...], step = distance in the document unit. */
function infoRows(x, y, w, step, rows, o = {}) {
  const names = ['Datum', 'Ort', 'Zusage', 'Hinweis', 'Mehr'];
  return rows.map((r, i) => info(names[i] || 'Zeile ' + (i + 1), x, y + i * step, w, r[0], r[1], o));
}

/** Small confetti-like pieces (rects, circles, stars) in a box, deterministic. */
function sprinkle(name, seed, box, o = {}) {
  return require('./_t2b-lib').scatter(name, seed, box, o);
}

const tags = (...more) => {
  const seen = new Set();
  return more.flat().filter((t) => { const k = t.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
};

module.exports = { D, NB, when, uhr, decor, T, P, info, infoRows, sprinkle, tags };
