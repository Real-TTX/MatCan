'use strict';
/* Shared helpers of batch V5 (flyers and posters for events II, numbers 910 to 999). Not built on its own (the file name does not start with a number).
   Colours and dates, the type scale (head fonts with width factors, so a headline is made as large as its box allows), the info rows, the date badge. */
const dsl = require('./dsl');
const { text, rect, ellipse, shape, line, icon, group, deko, dekoIn, dekoWindow, qr, typo } = dsl;

const MM_PT = 25.4 / 72;

// ---------------------------------------------------------------------------------------------------------------- colours
const rgb = h => { const v = parseInt(h.slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };
const mix = (a, b, t) => '#' + rgb(a).map((v, i) => Math.round(v + (rgb(b)[i] - v) * t).toString(16).padStart(2, '0')).join('');
const lum = c => { const [r, g, b] = rgb(c); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
const on = (c, dark = '#14171f', light = '#ffffff') => (lum(c) > 0.6 ? dark : light);

// ---------------------------------------------------------------------------------------------------------------- dates (2027)
const MON = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const WD = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
/** dateOf(5, 9): the day in 2027 with its real weekday. */
function dateOf(m, d) {
  const w = WD[new Date(Date.UTC(2027, m - 1, d)).getUTCDay()];
  return { m, d, wd: w, mon: MON[m - 1], long: typo.date(d, MON[m - 1], 2027), full: `${w}, ${typo.date(d, MON[m - 1], 2027)}`, abbr: MON[m - 1].slice(0, 3).toUpperCase(), wdShort: w.slice(0, 2) };
}

// ---------------------------------------------------------------------------------------------------------------- fonts
/** Head fonts: wf = average width of a character in em (mixed case), lh = line height, up = capitals. */
const HEAD = {
  anton: { f: 'Anton', w: 400, wf: 0.46, lh: 1.14, up: true },
  bebas: { f: 'Bebas Neue', w: 400, wf: 0.42, lh: 1.06, up: true },
  oswald: { f: 'Oswald', w: 700, wf: 0.5, lh: 1.12, up: true },
  montserrat: { f: 'Montserrat', w: 800, wf: 0.66, lh: 1.1, up: true },
  poppins: { f: 'Poppins', w: 700, wf: 0.64, lh: 1.2, up: false },
  raleway: { f: 'Raleway', w: 800, wf: 0.62, lh: 1.12, up: false },
  abril: { f: 'Abril Fatface', w: 400, wf: 0.58, lh: 1.14, up: false },
  playfair: { f: 'Playfair Display', w: 800, wf: 0.6, lh: 1.14, up: false },
  cinzel: { f: 'Cinzel', w: 700, wf: 0.76, lh: 1.18, up: true },
  fredoka: { f: 'Fredoka', w: 700, wf: 0.58, lh: 1.14, up: false },
  baloo: { f: 'Baloo 2', w: 800, wf: 0.58, lh: 1.25, up: false },
  righteous: { f: 'Righteous', w: 400, wf: 0.62, lh: 1.14, up: true },
  slab: { f: 'Roboto Slab', w: 800, wf: 0.64, lh: 1.14, up: false },
  amatic: { f: 'Amatic SC', w: 700, wf: 0.4, lh: 1.05, up: true },
  marker: { f: 'Permanent Marker', w: 400, wf: 0.64, lh: 1.2, up: false },
  dancing: { f: 'Dancing Script', w: 700, wf: 0.5, lh: 1.25, up: false },
  kaushan: { f: 'Kaushan Script', w: 400, wf: 0.52, lh: 1.3, up: false },
  lora: { f: 'Lora', w: 700, wf: 0.58, lh: 1.15, up: false },
};
const BODY = { sans: 'Source Sans 3', inter: 'Inter', nunito: 'Nunito', raleway: 'Raleway', lora: 'Lora', serif: 'Lora', open: 'Open Sans', josefin: 'Josefin Sans', patrick: 'Patrick Hand' };

/**
 * fitPt(lines, w, h, head, { max, min }): the largest size in pt at which the lines (an array of strings) fit a box of w x h mm in the head font.
 * The estimate is a little pessimistic on purpose (0.96); the engine shrinks to fit when it is off.
 */
function fitPt(lines, w, h, head, o = {}) {
  const len = Math.max(...lines.map(l => [...l].length));
  const k = MM_PT * head.wf * (head.up ? 1.14 : 1) * (1 + (o.ls || 0));
  const byW = (w * 0.96) / (len * k);
  const byH = h / (lines.length * head.lh * MM_PT);
  return Math.max(o.min || 8, Math.min(o.max || 200, Math.floor(Math.min(byW, byH) * 2) / 2));
}

/** A headline box: as large as it gets (up to o.max pt) in the box, lines joined with a line break. Returns the element; `.pt` has the size. */
function headline(name, x, y, w, h, lines, t, o = {}) {
  const head = o.head || t.h;
  const arr = Array.isArray(lines) ? lines : [lines];
  const kk = (o.k || MM_PT) / MM_PT;
  const pt = o.pt || fitPt(arr, w / kk, h / kk, head, o);
  const e = text(name, x, y, w, h, arr.join('\n'), {
    f: head.f, w: o.w || head.w, s: pt, c: o.c || t.ink, a: o.a || 'left', v: o.v || 'middle', lh: o.lh || head.lh, up: head.up, wrap: true, fit: 'shrink', min: Math.max(8, Math.round(pt * 0.6)),
    ls: o.ls, outline: o.outline, i: o.i,
  });
  e.pt = pt;
  return e;
}

// ---------------------------------------------------------------------------------------------------------------- themes
/**
 * theme({ bg, ink, acc, acc2, head, body, dark }): the colours of a variant. bg = page, ink = text, acc = main colour (header blocks), acc2 = second colour (circles, accents).
 * on* = readable text colours on acc, acc2 and ink; mute = quiet text; soft = a faint tint of ink on bg.
 */
function theme(o) {
  const bg = o.bg, ink = o.ink || on(bg, '#16202e', '#ffffff');
  const t = {
    bg, ink, acc: o.acc, acc2: o.acc2 || o.acc, h: HEAD[o.head || 'poppins'], bf: BODY[o.body || 'sans'], serif: !!o.serif,
    onAcc: on(o.acc), onAcc2: on(o.acc2 || o.acc), onInk: on(ink), onBg: on(bg),
    mute: mix(ink, bg, 0.38), soft: mix(bg, ink, 0.07), line: mix(bg, ink, 0.22), dark: lum(bg) < 0.4,
  };
  t.accText = lum(bg) < 0.4 ? o.acc : mix(o.acc, '#000000', lum(o.acc) > 0.55 ? 0.35 : 0);   // the accent as a text colour on bg
  return t;
}

// ---------------------------------------------------------------------------------------------------------------- content to rows
/** The rows of information of a family: when / where / price / web. mode 'one' = one line each, 'two' = up to two lines each. */
function rowsOf(c, mode, which = ['when', 'where', 'price', 'web']) {
  const dt = dateOf(...c.date);
  const when = mode === 'one' ? [`${dt.full}  ·  ${typo.time(c.time)}`] : [dt.full, typo.time(c.time)];
  const all = {
    when: { icon: 'calendar', label: 'Wann', lines: when },
    where: { icon: 'map-pin', label: 'Wo', lines: mode === 'one' ? [c.place.join(', ')] : c.place },
    price: { icon: c.priceIcon || 'ticket', label: c.priceLabel || 'Eintritt', lines: mode === 'one' ? [c.price.join(' · ')] : c.price },
    web: { icon: 'globe', label: c.webLabel || 'Mehr Infos', lines: [c.web] },
  };
  return which.map(k => all[k]);
}

/** info rows: icon + small label + value lines. Returns an array; `.bottom` is the y below the last row. */
function infoRows(name, x, y, w, rows, t, o = {}) {
  const vs = o.vs || 10, ls = o.ls || 7, ic = o.ic || 6, gap = o.gap === undefined ? 3.4 : o.gap;
  const lhV = vs * MM_PT * 1.3, hL = ls * MM_PT * 1.45;
  const out = [];
  let yy = y;
  rows.forEach((r, i) => {
    const n = r.lines.length;
    const h = hL + n * lhV;
    const off = ic + (o.gapX || 3);
    if (o.disc) out.push(ellipse(`${name} ${i + 1} Scheibe`, x - 1.4, yy - 0.6, ic + 2.8, ic + 2.8, o.disc));
    out.push(icon(`${name} ${i + 1} Symbol`, r.icon, x, yy + 0.2, ic, o.icolor || t.accText, o.isw || 1.9));
    out.push(text(`${name} ${i + 1} Beschriftung`, x + off, yy - 0.3, w - off, hL, r.label, { f: t.bf, s: ls, w: 700, c: o.lc || t.mute, up: true, ls: 0.14, v: 'top', min: 6 }));
    out.push(text(`${name} ${i + 1} Wert`, x + off, yy + hL - 0.5, w - off, n * lhV, r.lines.join('\n'), { f: t.bf, s: vs, w: o.vw || 600, c: o.c || t.ink, v: 'top', wrap: true, fit: 'shrink', lh: 1.25, min: Math.max(6, vs * 0.7) }));
    yy += h + gap;
  });
  out.bottom = yy - gap;
  out.height = out.bottom - y;
  return out;
}

/** A date badge: circle with the day number and the month. */
function dateBadge(name, x, y, d, c, t, o = {}) {
  const dt = dateOf(...c.date);
  const fill = o.fill || t.acc2;
  const ink = o.ink || on(fill);
  const head = t.h;
  const k = o.k || MM_PT;
  const dayPt = o.dayPt || Math.floor(d * 0.44 / k / 1.1);
  return group(name, [
    ellipse(`${name} Kreis`, x, y, d, d, fill),
    text(`${name} Tag`, x + d * 0.1, y + d * 0.16, d * 0.8, d * 0.46, String(dt.d), { f: head.f, w: head.w, s: dayPt, c: ink, a: 'center', lh: 1.05, min: 10 }),
    text(`${name} Monat`, x + d * 0.1, y + d * 0.6, d * 0.8, d * 0.2, dt.abbr, { f: t.bf, w: 800, s: Math.max(o.k ? 15 : 7.5, d * 0.2 / k / 1.5), c: ink, a: 'center', ls: 0.14, min: 6 }),
  ], o.group || {});
}

/** The QR code with a quiet white box. */
const qrBox = (name, x, y, s, value, t) => qr(name, x, y, s, value, { c: '#111111', bg: '#ffffff', quiet: true });

module.exports = { dsl, MM_PT, rgb, mix, lum, on, dateOf, HEAD, BODY, fitPt, headline, theme, rowsOf, infoRows, dateBadge, qrBox, MON, WD };
