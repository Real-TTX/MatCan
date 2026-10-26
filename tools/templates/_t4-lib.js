/* Shared building blocks of the T4 batch (forms and planners, numbers 500 to 599). Not a template module (the build only reads NN-<slug>.js).
   A STYLE (makeStyle) says how a form looks: klassisch (serif, lines under the fields), modern (sans, boxes, accent bar), minimal (mono or light sans, label above a hairline, lots of white).
   A FLOW (flow) places things from top to bottom with a cursor: header, section, rows of fields, check boxes, table, text area, signatures, footer.
   All sizes are mm; the form fields are 8 pt labels and have at least 8 mm of writing room.                                                                                        */
'use strict';
const D = require('./dsl');
const { text, rect, ellipse, line, icon, frame, tableGrid, lineMm } = D;

const hexToRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const toHex = a => '#' + a.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
/** mix(a, b, t): colour a moved t (0..1) towards b */
const mix = (a, b, t) => { const x = hexToRgb(a); const y = hexToRgb(b); return toHex(x.map((v, i) => v * (1 - t) + y[i] * t)); };

const FONTS = {
  klassisch: { head: 'Playfair Display', hw: 700, lab: 'Lora', labw: 400, val: 'Lora', margin: 15 },
  modern: { head: 'Montserrat', hw: 700, lab: 'Inter', labw: 500, val: 'Inter', margin: 14 },
  mono: { head: 'IBM Plex Mono', hw: 700, lab: 'IBM Plex Mono', labw: 400, val: 'IBM Plex Mono', margin: 17 },
  light: { head: 'Josefin Sans', hw: 300, lab: 'Nunito', labw: 400, val: 'Nunito', margin: 17 },
};

/** makeStyle(kind, accent, o): kind klassisch | modern | minimal; o.font 'mono' | 'light' (minimal only), o.head / o.lab / o.val to override a family, o.margin */
function makeStyle(kind, accent, o = {}) {
  const f = Object.assign({}, FONTS[kind === 'minimal' ? (o.font || 'mono') : kind], o.head ? { head: o.head } : {}, o.hw ? { hw: o.hw } : {}, o.lab ? { lab: o.lab } : {}, o.val ? { val: o.val } : {});
  return Object.assign({
    kind, accent, ink: '#1b1b1b', grey: '#5a5a5a', mid: '#8a8a8a', hair: '#cfcfcf', paper: '#ffffff',
    tint: mix(accent, '#ffffff', 0.9), tint2: mix(accent, '#ffffff', 0.8), deep: mix(accent, '#000000', 0.25),
    ls: 8, vs: 11, pitch: kind === 'modern' ? 17 : kind === 'klassisch' ? 15.5 : 14.5,
  }, f, o.margin ? { margin: o.margin } : {});
}

/** The writing room of a cell (mm) so a form can count on it. */
const T = (st, name, x, y, w, h, value, o = {}) => text(name, x, y, w, h, value, Object.assign({ f: st.lab, s: st.ls, c: st.grey, w: st.labw, v: 'middle', min: 6 }, o));

/** A logo place: a light tinted area with an (empty) image frame on top. */
function logoBox(st, x, y, size) {
  const r = st.kind === 'modern' ? 2 : 0;
  return [rect('Logo Fläche', x, y, size, size, st.kind === 'minimal' ? null : st.tint, { stroke: st.kind === 'minimal' ? st.hair : null, sw: 0.4, radius: r, locked: true }),
    frame('Logo', x + 1, y + 1, size - 2, size - 2, { fit: 'contain', radius: r })];
}

/** A tick box in the style. */
function tick(st, name, x, y, size = 4.2, o = {}) {
  if (st.kind === 'minimal') {
    const out = [ellipse(name, x, y, size, size, '#ffffff', { stroke: st.ink, sw: 0.5 })];
    if (o.checked) out.push(icon(name + ' Haken', 'check', x + size * 0.15, y + size * 0.15, size * 0.7, st.ink, 3));
    return out;
  }
  const out = [rect(name, x, y, size, size, '#ffffff', { stroke: st.kind === 'modern' ? st.accent : st.ink, sw: st.kind === 'modern' ? 0.8 : 0.6, radius: st.kind === 'modern' ? 1 : 0 })];
  if (o.checked) out.push(icon(name + ' Haken', 'check', x + size * 0.12, y + size * 0.12, size * 0.76, st.kind === 'modern' ? st.accent : st.ink, 3));
  return out;
}

/** A tick box with its text to the right. */
function tickItem(st, name, x, y, w, label, o = {}) {
  const size = o.size || 4.2;
  return [tick(st, name, x, y, size, o), text(name + ' Text', x + size + 2.2, y - 0.9, w - size - 2.2, size + 1.8, label, { f: st.lab, s: o.s || 9.5, c: o.c || st.ink, w: o.w || 400, v: 'middle', min: 6 })];
}

/** Rough height of a wrapped paragraph (mm) for `n` characters of pt points in width w. */
function paraHeight(str, w, pt, lh = 1.3) {
  const cw = pt * 0.3528 * 0.5;
  const lines = Math.max(1, Math.ceil((str.length * cw) / w));
  return lines * pt * 0.3528 * lh;
}

class Flow {
  constructor(st, W, H, shared) {
    this.st = st;
    this.W = W;
    this.H = H;
    this.m = st.margin;
    this.x = shared ? shared.x : st.margin;
    this.w = shared ? shared.w : W - 2 * st.margin;
    this.y = shared ? shared.y : st.margin;
    this.els = shared ? shared.els : [];
    this.limit = shared ? shared.limit : H - st.margin;
  }

  add(...list) { this.els.push(...list); return this; }

  gap(mm) { this.y += mm; this.gapped = true; return this; }

  /** a flow in a column at x with width w, starting at the current y; its bottom is returned by sub.y */
  sub(x, w, y = this.y) {
    return new Flow(this.st, this.W, this.H, { x, w, y, els: this.els, limit: this.limit });
  }

  /** the columns: widths in mm (they get `gap` between them), build(i, subFlow); the cursor ends at the lowest */
  cols(widths, gap, build) {
    let x = this.x;
    let bottom = this.y;
    widths.forEach((w, i) => {
      const s = this.sub(x, w);
      build(i, s);
      bottom = Math.max(bottom, s.y);
      x += w + gap;
    });
    this.y = bottom;
    return this;
  }

  // ---------------------------------------------------------------------------------------------------------------- header
  /**
   * header(title, o): o.subtitle, o.org (text on the right, e.g. '{{Verein}}'), o.orgLabel, o.logo (default true), o.big (title size).
   * klassisch: logo left, centred title, double rule. modern: accent bar, left title, logo right. minimal: small caps line, mono title, hairline.
   */
  header(title, o = {}) {
    if (o.compact) return this.headerCompact(title, o);
    const { st, W, m } = this;
    const x = this.x;
    const w = this.w;
    const y = this.y;
    const logo = o.logo !== false;
    if (st.kind === 'klassisch') {
      if (logo) this.add(logoBox(st, x, y, 21));
      if (o.org) this.add(text('Absender', x + w - 56, y + 1, 56, 10, o.org, { f: st.lab, s: 9.5, i: true, c: st.grey, a: 'right', v: 'top', wrap: true, lh: 1.25 }));
      this.add(text('Titel', x + 26, y + 1.5, w - 52, 11.5, title, { f: st.head, s: o.big || 25, w: st.hw, c: st.ink, a: 'center', min: 14 }));
      if (o.subtitle) this.add(text('Untertitel', x + 26, y + 13.2, w - 52, 5.2, o.subtitle, { f: st.lab, s: 10, i: true, c: st.grey, a: 'center', min: 7 }));
      this.add(line('Linie dick', x, y + 24, x + w, y + 24, st.ink, 1.6), line('Linie dünn', x, y + 25.6, x + w, y + 25.6, st.accent, 0.5));
      this.y = y + 29.5;
    } else if (st.kind === 'modern') {
      this.add(rect('Akzentbalken', x, y, 24, 1.8, st.accent, { locked: true }));
      if (logo) this.add(logoBox(st, x + w - 21, y, 21));
      this.add(text('Titel', x, y + 4, w - 28, 12, title, { f: st.head, s: o.big || 27, w: st.hw, c: st.ink, min: 14 }));
      if (o.subtitle) this.add(text('Untertitel', x, y + 16.8, w - 28, 5.2, o.subtitle, { f: st.lab, s: 10.5, w: 400, c: st.grey, min: 7 }));
      if (o.org) this.add(text('Absender', x, y + 22.6, w - 28, 4.5, o.org, { f: st.lab, s: 9, w: 600, c: st.deep, min: 7 }));
      this.add(line('Linie', x, y + 28, x + w, y + 28, st.hair, 0.6));
      this.y = y + 32.5;
    } else {
      if (o.org) this.add(text('Absender', x, y, w - 20, 4.2, o.org, { f: st.lab, s: 8, c: st.mid, v: 'top', min: 6 }));
      if (logo) this.add(logoBox(st, x + w - 15, y, 15));
      this.add(text('Titel', x, y + 5.5, w - 20, 8.5, title, { f: st.head, s: o.big || 16, w: st.hw, c: st.ink, up: true, ls: st.head === 'IBM Plex Mono' ? 0.06 : 0.12, min: 10 }));
      if (o.subtitle) this.add(text('Untertitel', x, y + 14.6, w - 20, 4.4, o.subtitle, { f: st.lab, s: 9, c: st.grey, min: 7 }));
      this.add(line('Linie', x, y + 22, x + w, y + 22, st.ink, 0.5));
      this.y = y + 27;
    }
    return this;
  }

  /** a short head (about 20 mm) for pages that need the room: title, optional org on the right, a rule */
  headerCompact(title, o = {}) {
    const { st, x, w, y } = this;
    const lg = o.logo !== false;
    const right = (lg ? 16 : 0) + (o.org ? 4 : 0);
    if (lg) this.add(logoBox(st, x + w - 14, y, 14));
    if (o.org) this.add(text('Absender', x + w - (lg ? 18 : 0) - (o.orgW || 60), y + 1, o.orgW || 60, 12, o.org, { f: st.lab, s: 9, i: st.kind === 'klassisch', w: st.kind === 'modern' ? 600 : undefined, c: st.kind === 'modern' ? st.deep : st.grey, a: 'right', v: 'middle', wrap: true, min: 6 }));
    if (st.kind === 'klassisch') {
      this.add(text('Titel', x, y, (o.titleW || w - 80), 11, title, { f: st.head, s: o.big || 22, w: st.hw, c: st.ink, min: 12 }), line('Linie dick', x, y + 15.5, x + w, y + 15.5, st.ink, 1.6), line('Linie dünn', x, y + 17, x + w, y + 17, st.accent, 0.5));
      this.y = y + 21;
    } else if (st.kind === 'modern') {
      this.add(rect('Akzentbalken', x, y, 20, 1.6, st.accent, { locked: true }), text('Titel', x, y + 3, (o.titleW || w - 80), 10, title, { f: st.head, s: o.big || 22, w: st.hw, c: st.ink, min: 12 }), line('Linie', x, y + 16.5, x + w, y + 16.5, st.hair, 0.6));
      this.y = y + 20.5;
    } else {
      this.add(text('Titel', x, y + 1, (o.titleW || w - 80), 8, title, { f: st.head, s: o.big || 14, w: st.hw, c: st.ink, up: true, ls: st.head === 'IBM Plex Mono' ? 0.06 : 0.12, min: 9 }), line('Linie', x, y + 16, x + w, y + 16, st.ink, 0.5));
      this.y = y + 20;
    }
    return this;
  }

  /** section(label, n): a heading above a group of fields */
  section(label, n) {
    if (this.y > this.m + 40) this.y += 2.5;
    this.gapped = false;
    const { st, x, w, y } = this;
    if (st.kind === 'klassisch') {
      this.add(text('Abschnitt ' + label, x, y, w, 6, label, { f: st.head, s: 12, w: 700, c: st.accent, min: 9 }), line('Abschnittslinie', x, y + 6.6, x + w, y + 6.6, st.hair, 0.5));
      this.y = y + 9.5;
    } else if (st.kind === 'modern') {
      let tx = x;
      if (n) {
        this.add(ellipse('Nummer Kreis', x, y + 0.2, 5.6, 5.6, st.accent, { locked: true }), text('Nummer', x, y + 0.2, 5.6, 5.6, String(n), { f: st.head, s: 8.5, w: 700, c: '#ffffff', a: 'center', min: 6 }));
        tx = x + 8;
      }
      this.add(text('Abschnitt ' + label, tx, y, w - (tx - x), 6, label, { f: st.head, s: 11, w: 700, c: st.ink, min: 8 }));
      this.y = y + 9;
    } else {
      this.add(text('Abschnitt ' + label, x, y, w, 4.2, (n ? String(n).padStart(2, '0') + '  ' : '') + label, { f: st.lab, s: 8, w: st.lab === 'IBM Plex Mono' ? 700 : 600, c: st.accent, up: true, ls: 0.12, v: 'top', min: 6 }));
      this.y = y + 7;
    }
    return this;
  }

  /** One field: label, optional value (a placeholder or text), in the style of the form. Returns its elements; its height is st.cell. */
  field(x, y, w, label, value, o = {}) {
    const { st } = this;
    const out = [];
    if (st.kind === 'klassisch') {
      const ly = y + 9.6;
      out.push(line('Linie ' + label, x, ly, x + w, ly, st.ink, 0.5));
      if (value) out.push(text('Wert ' + label, x + 0.5, ly - 5.7, w - 1, 5.4, value, { f: st.val, s: st.vs, c: st.ink, v: 'bottom', min: 7, a: o.align || 'left' }));
      out.push(T(st, 'Beschriftung ' + label, x, ly + 0.6, w, 3.7, label, { v: 'top', i: true }));
    } else if (st.kind === 'modern') {
      out.push(rect('Feld ' + label, x, y, w, 14.5, '#ffffff', { stroke: '#8f979c', sw: 0.5, radius: 1.2 }));
      out.push(T(st, 'Beschriftung ' + label, x + 2, y + 1, w - 4, 3.7, label, { v: 'top', w: 600, c: st.deep }));
      if (value) out.push(text('Wert ' + label, x + 2, y + 5, w - 4, 8.5, value, { f: st.val, s: st.vs, c: st.ink, v: 'middle', min: 7, a: o.align || 'left' }));
    } else {
      out.push(T(st, 'Beschriftung ' + label, x, y, w, 3.7, label, { v: 'top' }));
      const ly = y + 12;
      out.push(line('Linie ' + label, x, ly, x + w, ly, st.hair === '#cfcfcf' ? '#9d9d9d' : st.hair, 0.4));
      if (value) out.push(text('Wert ' + label, x, ly - 6, w, 5.6, value, { f: st.val, s: st.vs - 1, c: st.ink, v: 'bottom', min: 7, a: o.align || 'left' }));
    }
    return out;
  }

  /**
   * rows(spec, o): rows of fields. spec = [ [ [label, share, value?], ... ], ... ]; the shares of a row are relative widths. o.gap (mm between fields, default 5), o.pitch (row distance).
   */
  rows(spec, o = {}) {
    this.gapped = false;
    const { st } = this;
    const gap = o.gap === undefined ? (st.kind === 'modern' ? 3.5 : 6) : o.gap;
    const pitch = o.pitch || st.pitch;
    spec.forEach(row => {
      const sum = row.reduce((a, c) => a + c[1], 0);
      const room = this.w - gap * (row.length - 1);
      let x = this.x;
      row.forEach(c => {
        const w = (room * c[1]) / sum;
        this.add(this.field(x, this.y, w, c[0], c[2], { align: c[3] }));
        x += w + gap;
      });
      this.y += pitch;
    });
    return this;
  }

  /** lines(label, n, o): a free text area of n writing lines (8.5 mm apart) with a small heading */
  area(label, n = 4, o = {}) {
    this.gapped = false;
    const { st, x, w } = this;
    const pitch = o.pitch || 8.6;
    let y = this.y;
    if (st.kind === 'modern') {
      const h = n * pitch + 6;
      this.add(rect('Feld ' + label, x, y, w, h, '#ffffff', { stroke: '#8f979c', sw: 0.5, radius: 1.2 }), T(st, 'Beschriftung ' + label, x + 2, y + 1, w - 4, 3.7, label, { v: 'top', w: 600, c: st.deep }));
      if (!o.plain) this.add(D.ruled('Schreiblinie', x + 2, y + 6 + pitch, w - 4, n - 1, pitch, { color: '#d9d9d9', sw: 0.3 }));
      this.y = y + h + 3;
      return this;
    }
    this.add(T(st, 'Beschriftung ' + label, x, y, w, 3.7, label, { v: 'top', i: st.kind === 'klassisch', c: st.kind === 'klassisch' ? st.grey : st.mid }));
    y += 4.4;
    this.add(D.ruled('Schreiblinie', x, y + pitch, w, n, pitch, { color: st.kind === 'minimal' ? '#808080' : '#9c9c9c', sw: st.kind === 'minimal' ? 0.6 : 0.35, dash: st.kind === 'minimal' ? 'dotted' : undefined }));
    this.y = y + n * pitch + 3;
    return this;
  }

  /** note(str, o): a small printed paragraph (hint, data protection) */
  note(str, o = {}) {
    this.gapped = false;
    const { st, x, w } = this;
    const pt = o.s || 8;
    const h = o.h || paraHeight(str, w, pt, 1.35) + 0.6;
    this.add(text(o.name || 'Hinweis', x, this.y, w, h, str, { f: st.lab, s: pt, c: o.c || st.grey, v: 'top', wrap: true, lh: 1.35, i: o.i, w: o.w, min: 6 }));
    this.y += h + (o.after === undefined ? 2.5 : o.after);
    return this;
  }

  /** checks(items, o): tick boxes with texts in `cols` columns; o.label (a small heading before), o.s (pt) */
  checks(items, o = {}) {
    this.gapped = false;
    const { st, x, w } = this;
    const cols = o.cols || 1;
    const pitch = o.pitch || 7;
    const cw = w / cols;
    const rowsN = Math.ceil(items.length / cols);
    if (o.label) {
      this.add(T(st, 'Beschriftung ' + o.label, x, this.y, w, 4, o.label, { v: 'top', w: st.kind === 'modern' ? 600 : st.labw, c: st.kind === 'modern' ? st.deep : st.grey, i: st.kind === 'klassisch' }));
      this.y += 5.2;
    }
    items.forEach((it, i) => {
      const c = o.byRow ? i % cols : Math.floor(i / rowsN);
      const r = o.byRow ? Math.floor(i / cols) : i % rowsN;
      this.add(tickItem(st, 'Auswahl ' + it, x + c * cw, this.y + r * pitch, cw - 3, it, { s: o.s }));
    });
    this.y += rowsN * pitch + (o.after === undefined ? 1 : o.after);
    return this;
  }

  /** table(o): tableGrid in the style; o as of tableGrid (cols, rows, header, fixedRow, cells, align, h) */
  table(o) {
    this.gapped = false;
    const { st } = this;
    const h = o.h || 60;
    const common = { f: st.lab, s: o.s || 8.5 };
    let style;
    if (st.kind === 'klassisch') style = { headerFill: null, line: '#444444', sw: 0.5, outer: 1.1, headerColor: st.ink };
    else if (st.kind === 'modern') style = { headerFill: st.accent, headerColor: '#ffffff', line: '#c8cdd0', sw: 0.4, outer: 0.4, zebra: '#f4f6f7' };
    else style = { headerFill: null, headerColor: st.ink, line: '#b5b5b5', sw: 0.4, outer: 0.4, verticals: false };
    const t = tableGrid('Tabelle', this.x, this.y, this.w, h, Object.assign({}, common, style, o));
    if (st.kind === 'minimal' && o.header) t.push(line('Kopflinie fest', this.x, this.y + (o.headerHeight || 8), this.x + this.w, this.y + (o.headerHeight || 8), st.ink, 0.6));
    this.add(t);
    this.y = t.bottom + 3;
    return t;
  }

  /** sign(labels, o): signature lines side by side (default two: Ort, Datum / Unterschrift) */
  sign(labels = ['Ort, Datum', 'Unterschrift'], o = {}) {
    const { st } = this;
    const gap = 10;
    const n = labels.length;
    const w = (this.w - gap * (n - 1)) / n;
    const y = this.y + (o.drop === undefined ? 11 : o.drop);
    labels.forEach((l, i) => {
      const x = this.x + i * (w + gap);
      this.add(line('Unterschriftslinie ' + (i + 1), x, y, x + w, y, st.ink, 0.5), T(st, 'Beschriftung ' + l, x, y + 0.7, w, 3.7, l, { v: 'top', i: st.kind === 'klassisch' }));
    });
    this.y = y + 6;
    return this;
  }

  /** totals(labels, o): summary lines on the right (label, then a line or a tinted box to write in); the last one is the strong one. o.w (width), o.pitch */
  totals(labels, o = {}) {
    const { st } = this;
    const w = o.w || 84;
    const pitch = o.pitch || 8.6;
    const x = o.x === undefined ? this.x + this.w - w : o.x;
    const lw = w * 0.5;
    labels.forEach((l, i) => {
      const y = this.y + i * pitch;
      const last = i === labels.length - 1 && o.strong !== false;
      this.add(text('Summe ' + l, x, y, lw, 6.4, l, { f: st.lab, s: 9, w: last ? 700 : 400, c: st.ink, a: 'right', min: 6 }));
      if (st.kind === 'modern') this.add(rect('Summenfeld ' + l, x + lw + 2, y, w - lw - 2, 6.6, last ? st.tint2 : '#ffffff', { stroke: last ? st.accent : '#8f979c', sw: last ? 0.8 : 0.5, radius: 1 }));
      else this.add(line('Summenlinie ' + l, x + lw + 2, y + 6.4, x + w, y + 6.4, st.ink, last ? 1.1 : 0.5));
    });
    this.y += labels.length * pitch + 1;
    return this;
  }

  /** footer(left, right): a hairline and two small texts at the bottom of the page */
  footer(left, right) {
    const { st, W, H, m } = this;
    const y = H - m - 5;
    const ink = st.kind === 'modern' ? st.hair : '#9a9a9a';
    this.add(line('Fußlinie', m, y, W - m, y, ink, 0.5, { locked: true }));
    if (left) this.add(T(st, 'Fußzeile', m, y + 1.2, W - 2 * m - 40, 3.7, left, { v: 'top', c: st.mid }));
    if (right) this.add(T(st, 'Fußzeile rechts', W - m - 40, y + 1.2, 40, 3.7, right, { v: 'top', a: 'right', c: st.mid }));
    this.limit = Math.min(this.limit, y - 3);
    return this;
  }

  /** the elements; throws when the cursor ran below the page */
  done(name) {
    if (this.y - 3 > this.limit + 0.5) throw new Error(`${name || 'form'}: content ends at ${this.y.toFixed(1)} mm, the limit is ${this.limit.toFixed(1)} mm`);
    return this.els;
  }
}

const flow = (st, W, H, o) => new Flow(st, W, H, o);

/**
 * family(base, variants): base = the metadata every variant shares (nameBase, category, family, familyName, occasion, tags, formatKey, width, height, fields, sampleRows),
 * variants = [{ variant, slug, description, tags (extra), pages() }]. template(i) is what a numbered module exports.
 */
function family(base, variants) {
  return {
    variants,
    template(i) {
      const v = variants[i];
      const t = Object.assign({}, base, v);
      delete t.nameBase;
      t.name = base.nameBase + ' – ' + v.variant;
      t.tags = [...new Set([...(base.tags || []), ...(v.tags || [])])];
      t.pages = v.pages();
      return t;
    },
  };
}

module.exports = { family, makeStyle, flow, Flow, mix, tick, tickItem, logoBox, paraHeight, T, FONTS };
