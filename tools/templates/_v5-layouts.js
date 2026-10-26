'use strict';
/* The layouts of batch V5. Each takes (c = content of a family, t = theme, s = style 0..2) and returns { bg, els }.
   a5hero, a5center, a5band (A5 portrait), a5land (A5 landscape), a4split, a4program (A4), dlstack, dlvertical (DIN lang), a3type, a3motif (A3), igsplit, igcenter (Instagram). */
const L = require('./_v5-lib');
const { dsl, MM_PT, mix, on, dateOf, fitPt, headline, rowsOf, infoRows, dateBadge, qrBox, HEAD } = L;
const { text, rect, ellipse, shape, line, icon, group, deko, dekoIn, dekoWindow, typo } = dsl;

const K_PX = 96 / 72;

/** Lines of a title: the flat form or the stacked lines, whichever allows the larger type in the box (o.mode = 'flat' | 'stack' forces one). */
function titleLines(c, w, h, head, o = {}) {
  const flat = [c.titleFlat];
  const stack = c.title.length > 1 ? c.title : flat;
  if (o.mode === 'flat') return flat;
  if (o.mode === 'stack') return stack;
  const k = o.k || MM_PT;
  const pf = fitPt(flat, w / (k / MM_PT), h / (k / MM_PT), head, o), ps = fitPt(stack, w / (k / MM_PT), h / (k / MM_PT), head, o);
  return pf >= ps ? flat : stack;
}

/** A stack of lines as separate text boxes (so every line can have its own colour or an outline). Returns the elements; .bottom, .pt. */
function stackLines(name, x, y, w, h, lines, t, o = {}) {
  const head = o.head || t.h;
  const k = o.k || MM_PT;
  const pt = o.pt || fitPt(lines, w / (k / MM_PT), h / (k / MM_PT), head, o);
  const lineH = pt * head.lh * k;
  const total = lineH * lines.length;
  const y0 = o.v === 'top' ? y : o.v === 'bottom' ? y + h - total : y + (h - total) / 2;
  const out = lines.map((ln, i) => text(`${name} ${i + 1}`, x, y0 + i * lineH, w, lineH * 1.04, ln, {
    f: head.f, w: o.w || head.w, s: pt, c: (o.colors || [])[i] || o.c || t.ink, a: o.a || 'left', v: 'middle', lh: head.lh, up: head.up, ls: o.ls,
    outline: (o.outlines || [])[i], min: Math.max(8, Math.round(pt * 0.6)), fit: 'shrink',
  }));
  out.bottom = y0 + total;
  out.top = y0;
  out.pt = pt;
  return out;
}

const kicker = (name, x, y, w, str, color, t, o = {}) => text(name, x, y, w, o.h || 5.5, str, { f: t.bf, s: o.s || 8, w: 800, c: color, a: o.a || 'left', up: true, ls: o.ls || 0.18, v: 'middle', min: 6 });
const webLine = c => c.web;

// ============================================================================================================== A5 portrait: Bildkopf
function a5hero(c, t, s) {
  const W = 148, H = 210, M = 10, hh = 98;
  const els = [];
  els.push(rect('Kopf', 0, 0, W, hh, t.acc, { locked: true }));
  if (s === 1) for (let i = 0; i < 9; i++) els.push(ellipse(`Kante ${i + 1}`, (i * W) / 9 - 0.2, hh - 8.2, W / 9 + 0.4, 16.4, t.acc, { locked: true }));
  if (s === 2) for (let i = 0; i < 11; i++) els.push(shape('triangle', `Zacke ${i + 1}`, (i * W) / 11 - 0.1, hh - 0.2, W / 11 + 0.2, 8, t.acc, { flipY: true, locked: true }));
  if (s !== 1) els.push(ellipse('Kreis hinter Motiv', 27, 6, 94, 94 - (s === 2 ? 0 : 6), t.acc2, { locked: true }));
  else els.push(ellipse('Ring hinter Motiv', 26, 8, 96, 82, null, { stroke: t.acc2, sw: 5, locked: true }));
  els.push(dekoIn('Motiv', c.motif, 34, 14, 80, 74, { locked: true }));
  els.push(kicker('Anlass', M, 7, 128, c.kicker, t.onAcc, t, { s: 7.5 }));
  els.push(dateBadge('Datum Plakette', M - 1, hh - 12, 33, c, t, { fill: t.ink, ink: t.onInk, group: { rotation: -6 } }));
  const tl = titleLines(c, 90, 30, t.h);
  els.push(headline('Titel', 46, 104, 92, 30, tl, t, { c: t.ink, max: 64, v: 'middle' }));
  els.push(text('Beschreibung', M, 138, W - 2 * M, 13, c.tagline, { f: t.bf, s: 10.5, c: t.mute, v: 'top', wrap: true, lh: 1.3, min: 8 }));
  els.push(infoRows('Info', M, 156, W - 2 * M, rowsOf(c, 'one', ['when', 'where', 'price']), t, { vs: 10.5, ic: 6 }));
  els.push(rect('Fuß', 0, 197, W, 13, t.ink, { locked: true }));
  els.push(text('Fußzeile', M, 197, W - 2 * M, 13, `${c.webLabel || 'Mehr Infos'}: ${webLine(c)}`, { f: t.bf, s: 8.5, w: 700, c: t.onInk, a: 'center', min: 6 }));
  return { bg: t.bg, els };
}

// ============================================================================================================== A5 portrait: klassisch zentriert
function a5center(c, t, s) {
  const W = 148, H = 210, M = 12, cx = W / 2;
  const els = [];
  if (s === 0) {
    els.push(rect('Rahmen außen', 6, 6, W - 12, H - 12, null, { stroke: t.accText, sw: 1.1, locked: true }));
    els.push(rect('Rahmen innen', 8.6, 8.6, W - 17.2, H - 17.2, null, { stroke: t.accText, sw: 0.35, locked: true }));
  } else if (s === 1) {
    els.push(rect('Band oben', 0, 0, W, 8, t.acc, { locked: true }), rect('Band unten', 0, H - 8, W, 8, t.acc, { locked: true }));
    els.push(rect('Linie oben', 0, 9.6, W, 0.5, t.accText, { locked: true }), rect('Linie unten', 0, H - 10.1, W, 0.5, t.accText, { locked: true }));
  } else {
    [[8, 8, 1, 1], [W - 8, 8, -1, 1], [8, H - 8, 1, -1], [W - 8, H - 8, -1, -1]].forEach(([x, y, dx, dy], i) => {
      els.push(line(`Ecke ${i + 1} waagerecht`, x, y, x + dx * 16, y, t.accText, 1.2, { locked: true }), line(`Ecke ${i + 1} senkrecht`, x, y, x, y + dy * 16, t.accText, 1.2, { locked: true }));
    });
  }
  els.push(kicker('Anlass', M, 17, W - 2 * M, c.kicker, t.accText, t, { a: 'center', s: 8, ls: 0.22 }));
  els.push(line('Trenner', cx - 22, 28, cx + 22, 28, t.accText, 0.5, { locked: true }), shape('diamond', 'Trenner Raute', cx - 1.6, 26.4, 3.2, 3.2, t.accText, { locked: true }));
  const tl = titleLines(c, W - 2 * M, 40, t.h, { mode: s === 1 ? 'flat' : undefined });
  els.push(headline('Titel', M, 32, W - 2 * M, 44, tl, t, { a: 'center', c: t.ink, max: 58 }));
  els.push(text('Beschreibung', M + 6, 79, W - 2 * M - 12, 14, c.tagline, { f: t.serif ? 'Lora' : t.bf, s: 10.5, i: !!t.serif, c: t.mute, a: 'center', v: 'top', wrap: true, lh: 1.35, min: 8 }));
  els.push(dekoIn('Motiv', c.motif, 34, 96, 80, 44, { locked: true }));
  els.push(text('Datum', M, 144, W - 2 * M, 11, dateOf(...c.date).full, { f: t.h.f, w: t.h.w, s: 15, c: t.accText, a: 'center', up: t.h.up, lh: 1.15, min: 10 }));
  els.push(text('Zeit', M, 155, W - 2 * M, 6, typo.time(c.time), { f: t.bf, s: 10.5, w: 700, c: t.ink, a: 'center', min: 8 }));
  els.push(text('Ort', M, 163, W - 2 * M, 12, c.place.join('\n'), { f: t.bf, s: 10, c: t.ink, a: 'center', v: 'top', wrap: true, lh: 1.3, min: 7 }));
  els.push(line('Trenner unten', cx - 30, 180, cx + 30, 180, t.line, 0.4, { locked: true }));
  els.push(text('Preis', M, 183, W - 2 * M, 6, c.price.join('  ·  '), { f: t.bf, s: 9.5, w: 700, c: t.ink, a: 'center', min: 7 }));
  els.push(text('Web', M, 190, W - 2 * M, 6, webLine(c), { f: t.bf, s: 9, c: t.mute, a: 'center', min: 7 }));
  return { bg: t.bg, els };
}

// ============================================================================================================== A5 portrait: Kontrast (dunkel)
function a5band(c, t, s) {
  const W = 148, H = 210, M = 10;
  const els = [];
  els.push(rect('Seitenband', 0, 0, 5, H, t.acc, { locked: true }));
  els.push(kicker('Anlass', M + 2, 10, 120, c.kicker, t.acc, t, { s: 8 }));
  const lines = c.title.length > 1 ? c.title : [c.titleFlat];
  const st = stackLines('Titel', M + 2, 18, W - M - 14, 84, lines, t, { colors: [t.ink, t.acc], outlines: s === 1 ? [null, { color: t.acc, width: 1.4 }] : [], max: 90, v: 'top' });
  if (s === 1) st[st.length - 1].color = t.bg;
  els.push(st);
  const yb = st.bottom + 3;
  els.push(rect('Balken', M + 2, yb, 26, 2.2, t.acc, { locked: true }));
  els.push(text('Beschreibung', M + 2, yb + 5, 124, 13, c.tagline, { f: t.bf, s: 10.5, c: t.mute, v: 'top', wrap: true, lh: 1.3, min: 8 }));
  const y2 = Math.max(yb + 22, 124);
  els.push(infoRows('Info', M + 2, y2, 66, rowsOf(c, 'two', ['when', 'where', 'price']), t, { vs: 9, ic: 5.4, gap: 3.2, icolor: t.acc }));
  els.push(ellipse('Kreis', 80, y2 - 4, 54, 54, t.acc, { locked: true }));
  els.push(dekoIn('Motiv', c.motif, 84, y2, 46, 46, { locked: true }));
  els.push(dateBadge('Datum Plakette', 94, y2 + 52, 30, c, t, { fill: t.acc2, ink: on(t.acc2) }));
  els.push(text('Fußzeile', M + 2, H - 12, 124, 6, webLine(c), { f: t.bf, s: 8.5, c: t.mute, min: 6 }));
  return { bg: t.bg, els };
}

// ============================================================================================================== A5 landscape
function a5land(c, t, s) {
  const W = 210, H = 148, M = 10;
  const els = [];
  els.push(rect('Seitenfläche', 0, 0, 78, H, t.acc, { locked: true }));
  if (s === 1) for (let i = 0; i < 8; i++) els.push(ellipse(`Kante ${i + 1}`, 70, (i * H) / 8 - 0.2, 16, H / 8 + 0.4, t.acc, { locked: true }));
  if (s === 2) for (let i = 0; i < 10; i++) els.push(shape('triangle', `Zacke ${i + 1}`, 77.8, (i * H) / 10 - 0.1, 8, H / 10 + 0.2, t.acc, { rotation: 90, locked: true }));
  els.push(ellipse('Kreis hinter Motiv', 9, 12, 60, 60, t.acc2, { locked: true }));
  els.push(dekoIn('Motiv', c.motif, 12, 15, 54, 54, { locked: true }));
  els.push(dateBadge('Datum Plakette', 22, 84, 36, c, t, { fill: t.ink, ink: t.onInk, group: { rotation: -5 } }));
  els.push(text('Fußzeile', 6, 134, 66, 7, webLine(c), { f: t.bf, s: 8, w: 700, c: t.onAcc, a: 'center', min: 6 }));
  const x0 = 94, w = W - x0 - M;
  els.push(kicker('Anlass', x0, 12, w, c.kicker, t.accText, t));
  const tl = titleLines(c, w, 34, t.h);
  els.push(headline('Titel', x0, 19, w, 34, tl, t, { max: 52 }));
  els.push(text('Beschreibung', x0, 56, w, 13, c.tagline, { f: t.bf, s: 10.5, c: t.mute, v: 'top', wrap: true, lh: 1.3, min: 8 }));
  els.push(infoRows('Info', x0, 76, w - 26, rowsOf(c, 'one', ['when', 'where', 'price']), t, { vs: 10, ic: 5.6, gap: 3 }));
  els.push(qrBox('QR-Code', W - M - 22, H - M - 22, 22, c.qr, t));
  els.push(text('QR Hinweis', W - M - 40, H - M - 6.5, 17, 5.5, 'Anmelden', { f: t.bf, s: 7.5, w: 700, c: t.mute, a: 'right', up: true, ls: 0.1, min: 6 }));
  return { bg: t.bg, els };
}

// ============================================================================================================== A4 portrait: plakativ
function a4split(c, t, s) {
  const W = 210, H = 297, M = 14;
  const els = [];
  els.push(rect('Kopf', 0, 0, W, 150, t.acc, { locked: true }));
  if (s === 1) for (let i = 0; i < 13; i++) els.push(ellipse(`Kante ${i + 1}`, (i * W) / 13 - 0.2, 142, W / 13 + 0.4, 16, t.acc, { locked: true }));
  if (s === 2) for (let i = 0; i < 15; i++) els.push(shape('triangle', `Zacke ${i + 1}`, (i * W) / 15 - 0.1, 149.8, W / 15 + 0.2, 9, t.acc, { flipY: true, locked: true }));
  els.push(kicker('Anlass', M, 14, 130, c.kicker, t.onAcc, t, { s: 10 }));
  els.push(ellipse('Kreis hinter Motiv', 104, 32, 92, 92, t.acc2, { locked: true }));
  els.push(dekoIn('Motiv', c.motif, 108, 36, 84, 84, { locked: true }));
  const lines = c.title.length > 1 ? c.title : [c.titleFlat];
  els.push(stackLines('Titel', M, 30, 94, 96, lines, t, { colors: [t.onAcc, t.onAcc], max: 110, v: 'middle' }));
  els.push(rect('Datumsstreifen', 0, 158, W, 26, t.ink, { locked: true }));
  const dt = dateOf(...c.date);
  els.push(text('Datum', M, 158, 124, 26, dt.full, { f: t.h.f, w: t.h.w, s: 24, c: t.onInk, up: t.h.up, lh: 1.1, min: 14 }));
  els.push(text('Zeit', 138, 158, W - 138 - M, 26, typo.time(c.time), { f: t.h.f, w: t.h.w, s: 20, c: t.acc2, a: 'right', up: t.h.up, min: 12 }));
  els.push(text('Beschreibung', M, 194, W - 2 * M, 28, c.tagline, { f: t.bf, s: 16, w: 600, c: t.ink, v: 'top', wrap: true, lh: 1.3, min: 11 }));
  els.push(line('Trenner', M, 230, W - M, 230, t.line, 0.4, { locked: true }));
  els.push(infoRows('Info links', M, 238, 78, rowsOf(c, 'two', ['where']), t, { vs: 11, ic: 6.4 }));
  els.push(infoRows('Info Mitte', 98, 238, 62, rowsOf(c, 'two', ['price']), t, { vs: 11, ic: 6.4 }));
  els.push(qrBox('QR-Code', W - M - 30, 236, 30, c.qr, t));
  els.push(text('Web', M, 270, W - 2 * M - 36, 8, `${c.webLabel || 'Mehr Infos'}: ${webLine(c)}`, { f: t.bf, s: 11, w: 700, c: t.accText, min: 8 }));
  return { bg: t.bg, els };
}

// ============================================================================================================== A4 portrait: Programm
function a4program(c, t, s) {
  const W = 210, H = 297, M = 14;
  const els = [];
  els.push(rect('Seitenband', 0, 0, W, 8, t.acc, { locked: true }));
  els.push(kicker('Anlass', M, 16, 140, c.kicker, t.accText, t, { s: 10 }));
  const tl = [c.titleFlat];
  els.push(headline('Titel', M, 24, W - 2 * M, 34, tl, t, { c: t.ink, max: 70 }));
  els.push(text('Beschreibung', M, 60, W - 2 * M, 14, c.tagline, { f: t.bf, s: 13, c: t.mute, v: 'top', wrap: true, lh: 1.3, min: 9 }));
  const dt = dateOf(...c.date);
  els.push(rect('Datum Feld', M, 80, W - 2 * M, 18, t.acc, { radius: s === 1 ? 9 : s === 2 ? 0 : 2.5, locked: true }));
  els.push(text('Datum', M + 6, 80, W - 2 * M - 12, 18, `${dt.full}   ·   ${typo.time(c.time)}`, { f: t.h.f, w: t.h.w, s: 15, c: t.onAcc, up: t.h.up, a: 'center', min: 10 }));
  els.push(text('Programm Titel', M, 106, 100, 6, 'Programm', { f: t.bf, s: 9, w: 800, c: t.accText, up: true, ls: 0.2, min: 7 }));
  c.prog.slice(0, 4).forEach((p, i) => {
    const y = 114 + i * 22;
    els.push(rect(`Programm ${i + 1} Feld`, M, y, 118, 19, t.soft, { radius: 2, locked: true }));
    els.push(text(`Programm ${i + 1} Zeit`, M + 4, y, 30, 19, p[0], { f: t.h.f, w: t.h.w, s: 15, c: t.accText, up: false, min: 10 }));
    els.push(text(`Programm ${i + 1} Titel`, M + 36, y + 2.4, 78, 7, p[1], { f: t.bf, s: 11.5, w: 800, c: t.ink, v: 'middle', min: 8 }));
    els.push(text(`Programm ${i + 1} Text`, M + 36, y + 9.6, 78, 7, p[2] || '', { f: t.bf, s: 9, c: t.mute, v: 'middle', min: 7 }));
  });
  els.push(ellipse('Kreis hinter Motiv', 142, 112, 56, 56, t.acc2, { locked: true }));
  els.push(dekoIn('Motiv', c.motif, 145, 115, 50, 50, { locked: true }));
  els.push(line('Trenner', M, 214, W - M, 214, t.line, 0.4, { locked: true }));
  els.push(infoRows('Info links', M, 222, 84, rowsOf(c, 'two', ['where']), t, { vs: 11, ic: 6.4 }));
  els.push(infoRows('Info Mitte', 104, 222, 56, rowsOf(c, 'two', ['price']), t, { vs: 11, ic: 6.4 }));
  els.push(qrBox('QR-Code', W - M - 32, 222, 32, c.qr, t));
  els.push(rect('Fuß', 0, 270, W, 27, t.ink, { locked: true }));
  els.push(text('Fußzeile', M, 270, W - 2 * M, 27, `${c.webLabel || 'Mehr Infos'}: ${webLine(c)}`, { f: t.h.f, w: t.h.w, s: 14, c: t.onInk, up: t.h.up, a: 'center', min: 9 }));
  return { bg: t.bg, els };
}

// ============================================================================================================== DIN lang: gestapelt
function dlstack(c, t, s) {
  const W = 99, H = 210, M = 8, cx = W / 2;
  const els = [];
  els.push(rect('Kopf', 0, 0, W, 70, t.acc, { locked: true }));
  if (s === 1) for (let i = 0; i < 6; i++) els.push(ellipse(`Kante ${i + 1}`, (i * W) / 6 - 0.2, 62, W / 6 + 0.4, 16, t.acc, { locked: true }));
  if (s === 2) for (let i = 0; i < 8; i++) els.push(shape('triangle', `Zacke ${i + 1}`, (i * W) / 8 - 0.1, 69.8, W / 8 + 0.2, 7, t.acc, { flipY: true, locked: true }));
  els.push(kicker('Anlass', M, 8, W - 2 * M, c.kicker, t.onAcc, t, { s: 7, a: 'center' }));
  const tl = titleLines(c, W - 2 * M, 44, t.h);
  els.push(headline('Titel', M, 15, W - 2 * M, 44, tl, t, { c: t.onAcc, a: 'center', max: 60 }));
  els.push(ellipse('Kreis hinter Motiv', cx - 24, 58, 48, 48, t.acc2, { locked: true }));
  els.push(dekoIn('Motiv', c.motif, cx - 20, 62, 40, 40, { locked: true }));
  const dt = dateOf(...c.date);
  els.push(text('Datum', M, 110, W - 2 * M, 10, dt.full, { f: t.h.f, w: t.h.w, s: 14, c: t.accText, up: t.h.up, a: 'center', min: 9 }));
  els.push(text('Zeit', M, 120, W - 2 * M, 6, typo.time(c.time), { f: t.bf, s: 10.5, w: 700, c: t.ink, a: 'center', min: 8 }));
  els.push(text('Beschreibung', M, 129, W - 2 * M, 17, c.tagline, { f: t.bf, s: 9.5, c: t.mute, a: 'center', v: 'top', wrap: true, lh: 1.3, min: 7 }));
  els.push(infoRows('Info', M, 150, W - 2 * M, rowsOf(c, 'one', ['where', 'price']), t, { vs: 9, ic: 5, gap: 3 }));
  els.push(qrBox('QR-Code', M, 177, 24, c.qr, t));
  els.push(text('QR Text', M + 28, 178, W - 2 * M - 28, 22, `${c.webLabel || 'Mehr Infos'}\n${webLine(c)}`, { f: t.bf, s: 9, w: 700, c: t.ink, v: 'middle', wrap: true, lh: 1.35, min: 7 }));
  return { bg: t.bg, els };
}

// ============================================================================================================== DIN lang: senkrechter Titel
function dlvertical(c, t, s) {
  const W = 99, H = 210, M = 8;
  const els = [];
  els.push(rect('Seitenfläche', 0, 0, 42, H, t.acc, { locked: true }));
  if (s === 1) els.push(rect('Linie', 42, 0, 1.6, H, t.acc2, { locked: true }));
  if (s === 2) for (let i = 0; i < 14; i++) els.push(shape('triangle', `Zacke ${i + 1}`, 41.8, (i * H) / 14 - 0.1, 7, H / 14 + 0.2, t.acc, { rotation: 90, locked: true }));
  const len = 188, thick = 31;
  const tl = [c.titleFlat];
  const pt = fitPt(tl, len, thick, t.h, { max: 70 });
  els.push(text('Titel', 21 - len / 2, 105 - thick / 2, len, thick, tl[0], { f: t.h.f, w: t.h.w, s: pt, c: t.onAcc, a: 'center', up: t.h.up, lh: t.h.lh, rotation: -90, min: Math.round(pt * 0.6) }));
  const x0 = 49, w = W - x0 - M;
  els.push(text('Anlass', x0, 10, w, 12, c.kicker, { f: t.bf, s: 7, w: 800, c: t.accText, up: true, ls: 0.12, v: 'top', wrap: true, lh: 1.3, min: 6 }));
  els.push(ellipse('Kreis hinter Motiv', x0, 26, w, w, t.acc2, { locked: true }));
  els.push(dekoIn('Motiv', c.motif, x0 + 3, 29, w - 6, w - 6, { locked: true }));
  els.push(dateBadge('Datum Plakette', x0 + (w - 30) / 2, 26 + w + 4, 30, c, t, { fill: t.ink, ink: t.onInk }));
  const yr = 26 + w + 40;
  els.push(text('Zeit', x0, yr, w, 6, typo.time(c.time), { f: t.bf, s: 10, w: 800, c: t.ink, a: 'center', min: 7 }));
  els.push(text('Ort', x0, yr + 8, w, 17, c.placeShort || c.place[0], { f: t.bf, s: 9, c: t.ink, a: 'center', v: 'top', wrap: true, lh: 1.3, min: 7 }));
  els.push(text('Preis', x0, yr + 24, w, 11, c.price[0], { f: t.bf, s: 9, w: 800, c: t.accText, a: 'center', v: 'top', wrap: true, lh: 1.3, min: 7 }));
  els.push(qrBox('QR-Code', x0 + (w - 22) / 2, H - M - 22, 22, c.qr, t));
  return { bg: t.bg, els };
}

// ============================================================================================================== A3 Plakat: Typo
function a3type(c, t, s) {
  const W = 297, H = 420, M = 16;
  const els = [];
  els.push(kicker('Anlass', M, 16, 200, c.kicker, t.accText, t, { s: 15, h: 9 }));
  const lines = c.title.length > 1 ? c.title : [c.titleFlat];
  const st = stackLines('Titel', M, 30, W - 2 * M, 190, lines, t, { colors: [t.ink, t.accText], outlines: s === 1 ? [null, { color: t.acc, width: 2.4 }] : [], max: 200, v: 'top' });
  if (s === 1) st[st.length - 1].color = t.bg;
  els.push(st);
  const yb = st.bottom + 6;
  els.push(rect('Balken', M, yb, 60, 4, t.acc, { locked: true }));
  const dt = dateOf(...c.date);
  els.push(text('Wochentag', M, yb + 10, 130, 12, dt.wd, { f: t.bf, s: 22, w: 800, c: t.accText, up: true, ls: 0.2, min: 14 }));
  els.push(text('Datum', M, yb + 22, 140, 26, dt.long, { f: t.h.f, w: t.h.w, s: 50, c: t.ink, up: t.h.up, lh: 1.1, min: 30 }));
  els.push(text('Zeit', M, yb + 49, 140, 13, typo.time(c.time), { f: t.bf, s: 26, w: 700, c: t.ink, min: 16 }));
  els.push(text('Beschreibung', M, yb + 66, 130, 34, c.tagline, { f: t.bf, s: 17, c: t.mute, v: 'top', wrap: true, lh: 1.3, min: 12 }));
  els.push(ellipse('Kreis hinter Motiv', 160, 222, 121, 121, t.acc2, { locked: true }));
  els.push(dekoIn('Motiv', c.motif, 164, 226, 113, 113, { locked: true }));
  els.push(rect('Fußfläche', 0, 352, W, 68, t.ink, { locked: true }));
  els.push(text('Ort', M, 358, 180, 24, c.place.join('\n'), { f: t.bf, s: 20, w: 700, c: t.onInk, v: 'middle', wrap: true, lh: 1.25, min: 14 }));
  els.push(text('Preis', M, 384, 180, 12, c.price.join('  ·  '), { f: t.bf, s: 16, w: 600, c: t.acc2, min: 11 }));
  els.push(text('Web', M, 397, 180, 10, webLine(c), { f: t.bf, s: 15, w: 700, c: t.onInk, min: 11 }));
  els.push(qrBox('QR-Code', W - M - 46, 358, 46, c.qr, t));
  return { bg: t.bg, els };
}

// ============================================================================================================== A3 Plakat: Motiv
function a3motif(c, t, s) {
  const W = 297, H = 420, M = 16;
  const els = [];
  const bg = t.acc;
  els.push(ellipse('Scheibe', 24, 22, 249, 249, t.bg, { locked: true }));
  if (s === 1) els.push(ellipse('Ring', 16, 14, 265, 265, null, { stroke: t.acc2, sw: 4, locked: true }));
  if (s === 2) for (let i = 0; i < 12; i++) els.push(ellipse(`Punkt ${i + 1}`, 148.5 + Math.cos((i * Math.PI) / 6) * 140 - 4, 146.5 + Math.sin((i * Math.PI) / 6) * 140 - 4, 8, 8, t.acc2, { locked: true }));
  els.push(dekoIn('Motiv', c.motif, 48, 46, 201, 201, { locked: true }));
  els.push(dateBadge('Datum Plakette', 206, 214, 66, c, t, { fill: t.ink, ink: t.onInk, group: { rotation: -8 } }));
  const onA = t.onAcc;
  els.push(kicker('Anlass', M, 282, W - 2 * M, c.kicker, onA, t, { a: 'center', s: 14, h: 8 }));
  const tl = titleLines(c, W - 2 * M, 54, t.h);
  els.push(headline('Titel', M, 292, W - 2 * M, 56, tl, t, { c: onA, a: 'center', max: 110 }));
  const dt = dateOf(...c.date);
  els.push(rect('Datumsstreifen', 0, 354, W, 22, t.ink, { locked: true }));
  els.push(text('Datum', M, 354, W - 2 * M, 22, `${dt.full}  ·  ${typo.time(c.time)}`, { f: t.h.f, w: t.h.w, s: 25, c: t.onInk, a: 'center', up: t.h.up, min: 14 }));
  els.push(text('Ort', M, 380, W - 2 * M, 14, c.place.join(' · '), { f: t.bf, s: 19, w: 700, c: onA, a: 'center', min: 12 }));
  els.push(text('Web', M, 395, W - 2 * M, 12, `${c.price.join(' · ')}   |   ${webLine(c)}`, { f: t.bf, s: 15, w: 600, c: onA, a: 'center', min: 11 }));
  return { bg, els };
}

// ============================================================================================================== Instagram: geteilt
function igsplit(c, t, s) {
  const W = 1080, H = 1080, M = 64;
  const els = [];
  els.push(ellipse('Kreis', 540, 70, 480, 480, t.acc, { locked: true }));
  if (s === 1) els.push(ellipse('Ring', 520, 50, 520, 520, null, { stroke: t.acc2, sw: 7, locked: true }));
  if (s === 2) for (let i = 0; i < 7; i++) els.push(shape('star', `Stern ${i + 1}`, [560, 960, 930, 520, 1000, 640, 790][i] - 18, [90, 150, 470, 330, 250, 520, 36][i] - 18, 36, 36, t.acc2, { locked: true }));
  els.push(dekoIn('Motiv', c.motif, 570, 100, 420, 420, { locked: true }));
  els.push(text('Anlass', M, 68, 440, 58, c.kicker, { f: t.bf, s: 16, w: 800, c: t.accText, up: true, ls: 0.16, v: 'top', wrap: true, lh: 1.3, min: 15 }));
  const lines = c.title.length > 1 ? c.title : [c.titleFlat];
  els.push(stackLines('Titel', M, 130, 470, 350, lines, t, { k: K_PX, colors: [t.ink, t.accText], max: 140, v: 'top' }));
  els.push(dateBadge('Datum Plakette', 820, 430, 190, c, t, { fill: t.ink, ink: t.onInk, k: K_PX, group: { rotation: -8 } }));
  els.push(rect('Fußfläche', 0, 690, W, 390, t.acc, { locked: true }));
  const dt = dateOf(...c.date);
  els.push(text('Datum', M, 726, 760, 70, dt.full, { f: t.h.f, w: t.h.w, s: 40, c: t.onAcc, up: t.h.up, lh: 1.1, min: 24 }));
  els.push(text('Zeit und Ort', M, 800, 760, 126, `${typo.time(c.time)}\n${c.place.join(', ')}`, { f: t.bf, s: 22, w: 700, c: t.onAcc, v: 'top', wrap: true, lh: 1.35, min: 16 }));
  els.push(text('Preis', M, 934, 700, 40, c.price.join(' · '), { f: t.bf, s: 20, w: 800, c: t.onAcc, min: 15 }));
  els.push(text('Web', M, 978, 700, 40, webLine(c), { f: t.bf, s: 20, c: t.onAcc, min: 15 }));
  els.push(qrBox('QR-Code', 836, 760, 180, c.qr, t));
  return { bg: t.bg, els };
}

// ============================================================================================================== Instagram: Karte
function igcenter(c, t, s) {
  const W = 1080, H = 1080;
  const els = [];
  els.push(rect('Karte', 54, 54, 972, 972, t.bg, { radius: s === 2 ? 0 : 40, locked: true }));
  if (s === 1) els.push(rect('Karte Linie', 82, 82, 916, 916, null, { stroke: t.acc, sw: 3, radius: 24, locked: true }));
  els.push(text('Anlass', 120, 108, 840, 36, c.kicker, { f: t.bf, s: 17, w: 800, c: t.accText, a: 'center', up: true, ls: 0.18, min: 15 }));
  els.push(ellipse('Kreis hinter Motiv', 400, 156, 280, 280, t.acc, { locked: true }));
  els.push(dekoIn('Motiv', c.motif, 416, 172, 248, 248, { locked: true }));
  const tl = titleLines(c, 840, 190, t.h, { k: K_PX });
  els.push(headline('Titel', 120, 448, 840, 190, tl, t, { a: 'center', max: 150, k: K_PX }));
  const dt = dateOf(...c.date);
  els.push(rect('Datum Feld', 190, 660, 700, 84, t.acc, { radius: 42, locked: true }));
  els.push(text('Datum', 210, 660, 660, 84, `${dt.wdShort}, ${typo.date(dt.d, dt.mon, 2027)}`, { f: t.h.f, w: t.h.w, s: 30, c: t.onAcc, a: 'center', up: t.h.up, min: 20 }));
  els.push(text('Zeit und Ort', 120, 768, 600, 120, `${typo.time(c.time)}\n${c.place.join(', ')}`, { f: t.bf, s: 22, w: 700, c: t.ink, v: 'top', wrap: true, lh: 1.35, min: 16 }));
  els.push(text('Preis', 120, 890, 600, 44, c.price.join(' · '), { f: t.bf, s: 20, w: 800, c: t.accText, min: 15 }));
  els.push(text('Web', 120, 936, 600, 44, webLine(c), { f: t.bf, s: 19, c: t.mute, min: 15 }));
  els.push(qrBox('QR-Code', 784, 780, 190, c.qr, t));
  return { bg: t.acc, els };
}

const LAYOUTS = {
  H: { fn: a5hero, format: 'a5-portrait', w: 148, h: 210, label: 'Bildkopf', kind: 'Flyer A5' },
  C: { fn: a5center, format: 'a5-portrait', w: 148, h: 210, label: 'Klassisch', kind: 'Flyer A5' },
  B: { fn: a5band, format: 'a5-portrait', w: 148, h: 210, label: 'Kontrast', kind: 'Flyer A5' },
  L: { fn: a5land, format: 'a5-landscape', w: 210, h: 148, label: 'Quer', kind: 'Flyer A5 quer' },
  S: { fn: a4split, format: 'a4-portrait', w: 210, h: 297, label: 'Plakativ', kind: 'Flyer A4' },
  P: { fn: a4program, format: 'a4-portrait', w: 210, h: 297, label: 'Programm', kind: 'Flyer A4' },
  D: { fn: dlstack, format: 'din-lang-portrait', w: 99, h: 210, label: 'Schmal', kind: 'Flyer DIN lang' },
  V: { fn: dlvertical, format: 'din-lang-portrait', w: 99, h: 210, label: 'Vertikal', kind: 'Flyer DIN lang' },
  T: { fn: a3type, format: 'poster-a3-portrait', w: 297, h: 420, label: 'Typo-Plakat', kind: 'Plakat A3', category: 'Poster' },
  M: { fn: a3motif, format: 'poster-a3-portrait', w: 297, h: 420, label: 'Motiv-Plakat', kind: 'Plakat A3', category: 'Poster' },
  I: { fn: igsplit, format: 'instagram-post', w: 1080, h: 1080, unit: 'px', label: 'Instagram', kind: 'Instagram-Post', category: 'Social Media' },
  J: { fn: igcenter, format: 'instagram-post', w: 1080, h: 1080, unit: 'px', label: 'Instagram Karte', kind: 'Instagram-Post', category: 'Social Media' },
};

module.exports = { LAYOUTS, stackLines, titleLines };
