'use strict';
// Group "Trenner": dividers, wide and thin (1200 x 120): the part to be drawn in the middle of a page between two blocks of text.
const L = require('./lib');
const M = require('./motifs');
const { curlArm } = require('./flourish');
const { Curve, Path, g, path, circle, rad, lerp, place, leaf, ribbon } = L;

const W = 1200, H = 120, CY = 60;
const THREE = ['gold', 'schwarz', 'weiss'];
const FOUR = ['gold', 'navy', 'schwarz', 'weiss'];
const diamond = (x, y, r, k = 0.7) => L.poly([[x, y - r], [x + r * k, y], [x, y + r], [x - r * k, y]], true);
/** A straight line that is thin at x0 and has the width w at x1. */
const taper = (x0, x1, y, w, w0 = 0.6) => path(ribbon([[x0, y], [(x0 + x1) / 2, y], [x1, y]], (t) => lerp(w0, w, Math.pow(t, 1.4)), { count: 8, ends: 'flat' }), {});
const mirror = (c, svg, id) => { c.defs.push(`<g id="${id}">${svg}</g>`); return `<use href="#${id}" /><use href="#${id}" transform="matrix(-1 0 0 1 ${W} 0)" />`; };
const piece = (slug, name, palettes, tags, fn, extra = {}) => ({ slug, name, w: W, h: H, palettes, tags: ['Trenner', 'Linie', 'Divider', 'Abschnitt', ...tags], draw: fn, ...extra });

const pieces = [
  piece('punkte', 'Punkte', THREE.concat(['rose']), ['Punkte', 'schlicht', 'modern', 'Perlen'], (c) => {
    const { p } = c;
    const d = [];
    for (let i = -12; i <= 12; i++) d.push({ x: 600 + i * 36, y: CY, r: 3 + 11 * Math.pow(1 - Math.abs(i) / 12.5, 1.8), fill: p.ink });
    return L.dots(d);
  }),
  piece('welle', 'Welle', FOUR, ['Welle', 'Wellen', 'wellig', 'Meer', 'sanft'], (c) => {
    const { p } = c;
    const pts = [];
    for (let i = 0; i <= 24; i++) pts.push([60 + i * 45, CY + Math.sin(i * Math.PI / 2) * 22 * Math.sin(Math.PI * (0.15 + 0.7 * i / 24))]);
    return path(L.smooth(pts), { fill: 'none', stroke: p.ink, 'stroke-width': 5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
  }),
  piece('doppelwelle', 'Doppelwelle', THREE.concat(['salbei']), ['Welle', 'Wellen', 'doppelt', 'Wasser', 'sanft'], (c) => {
    const { p } = c;
    const mk = (ph) => { const pts = []; for (let i = 0; i <= 34; i++) pts.push([40 + i * 33.3, CY + Math.sin(i * Math.PI / 3 + ph) * 15]); return L.smooth(pts); };
    return path(mk(0), { fill: 'none', stroke: p.ink, 'stroke-width': 3.6, 'stroke-linecap': 'round' }) + path(mk(Math.PI / 2), { fill: 'none', stroke: p.ink, 'stroke-width': 3.6, 'stroke-linecap': 'round', 'stroke-opacity': 0.55 });
  }),
  piece('raute', 'Raute', FOUR, ['Raute', 'Diamant', 'klassisch', 'elegant', 'Urkunde', 'Hochzeit'], (c) => {
    const { p } = c;
    let s = taper(40, 540, CY, 4.5) + `<g transform="matrix(-1 0 0 1 ${W} 0)">${taper(40, 540, CY, 4.5)}</g>`;
    s += path(diamond(600, CY, 30), {});
    s += path(diamond(600, CY, 42), { fill: 'none', stroke: p.ink, 'stroke-width': 2.4 });
    for (const x of [548, 652]) s += path(diamond(x, CY, 10), {});
    for (const x of [520, 680]) s += circle(x, CY, 4.6, {});
    return g({ fill: p.ink }, s);
  }),
  piece('schnoerkel', 'Schnörkel', FOUR.concat(['rose']), ['Schnörkel', 'Ornament', 'Hochzeit', 'Einladung', 'elegant'], (c) => {
    const { p } = c;
    const a = curlArm([500, CY + 1], -6, { len: 40, bow: -4, R: 26, r: 5, turns: 1.45, side: -1, w0: 4, wmax: 9, w1: 2, bulb: 4.5, widest: 0.5 });
    const b = curlArm([500, CY - 1], 6, { len: 40, bow: 4, R: 26, r: 5, turns: 1.45, side: 1, w0: 4, wmax: 9, w1: 2, bulb: 4.5, widest: 0.5 });
    let s = mirror(c, taper(60, 484, CY, 4.4) + a.svg + b.svg, 'h');
    s += path(diamond(600, CY, 16), {}) + circle(572, CY, 4.5, {}) + circle(628, CY, 4.5, {});
    return g({ fill: p.ink }, s);
  }),
  piece('blattreihe', 'Blattreihe', ['gold', 'salbei', 'navy', 'schwarz', 'weiss'], ['Blätter', 'Zweig', 'Natur', 'Boho', 'Hochzeit', 'Ranke'], (c) => {
    const { p, r } = c;
    const curve = new Curve([[40, CY + 6], [300, CY - 4], [600, CY + 6], [900, CY - 4], [1160, CY + 6]]);
    let s = path(ribbon(curve, (t) => lerp(3.2, 2, Math.sin(Math.PI * t)), { count: 28 }), {});
    const body = M.leavesAlong(curve, {
      n: 29, t0: 0.03, t1: 0.97, mode: 'alt', p, r, spread: () => 52, len: (t) => 24 + 46 * Math.sin(Math.PI * t) ** 0.8, wid: (t) => (24 + 46 * Math.sin(Math.PI * t) ** 0.8) * 0.24,
      shape: (rr, t, sd) => leaf(24 + 46 * Math.sin(Math.PI * t) ** 0.8, (24 + 46 * Math.sin(Math.PI * t) ** 0.8) * 0.24, { belly: 0.42, sharp: 0.72, asym: rr.jitter(0.08), tip: rr.jitter(0.15), bend: sd * 0.05 }),
    });
    return g({ fill: p.leaf }, s, body.svg);
  }),
  piece('herz', 'Herz', ['gold', 'rose', 'navy', 'schwarz', 'weiss'], ['Herz', 'Liebe', 'Hochzeit', 'Valentinstag', 'Einladung', 'romantisch'], (c) => {
    const { p } = c;
    let s = taper(60, 540, CY, 4) + `<g transform="matrix(-1 0 0 1 ${W} 0)">${taper(60, 540, CY, 4)}</g>`;
    s += path(L.heart(600, CY - 2, 54), {});
    for (const x of [532, 668]) s += circle(x, CY, 4.5, {});
    return g({ fill: p.ink }, s);
  }),
  piece('sterne', 'Sterne', ['gold', 'navy', 'schwarz', 'weiss'], ['Sterne', 'Stern', 'Weihnachten', 'Nacht', 'Silvester', 'Kinder'], (c) => {
    const { p } = c;
    let s = taper(60, 480, CY, 4) + `<g transform="matrix(-1 0 0 1 ${W} 0)">${taper(60, 480, CY, 4)}</g>`;
    s += path(L.starPath(600, CY, 34, 14, 5, -90), {});
    for (const [x, rr] of [[520, 20], [680, 20]]) s += path(L.starPath(x, CY, rr, 8.4, 5, -90), {});
    return g({ fill: p.ink }, s);
  }),
  piece('girlande', 'Girlande', ['gold', 'rose', 'navy', 'schwarz', 'weiss'], ['Girlande', 'Bogen', 'Schwung', 'Festival', 'Party', 'Hochzeit'], (c) => {
    const { p } = c;
    const sw = new Path();
    const n = 12, step = (W - 80) / n;
    for (let i = 0; i < n; i++) sw.M(40 + i * step, 38).C(40 + i * step + step * 0.2, 38 + 52, 40 + (i + 1) * step - step * 0.2, 38 + 52, 40 + (i + 1) * step, 38);
    const dots = new Path();
    for (let i = 0; i <= n; i++) dots.add(L.circlePath(40 + i * step, 38, 7.5));
    const tassel = new Path();
    for (let i = 0; i < n; i++) tassel.add(L.circlePath(40 + (i + 0.5) * step, 38 + 40, 4.4));
    return g({}, path(sw, { fill: 'none', stroke: p.ink, 'stroke-width': 3.4, 'stroke-linecap': 'round' }), path(dots, { fill: p.ink }), path(tassel, { fill: p.ink }));
  }),
  piece('bluetenranke', 'Blütenranke', ['rose', 'gold', 'navy', 'pastell', 'weiss'], ['Blüten', 'Ranke', 'Blumen', 'Hochzeit', 'Frühling', 'Taufe', 'Geburtstag'], (c) => {
    const { p, r } = c;
    const pts = [];
    for (let i = 0; i <= 20; i++) pts.push([40 + i * 56, CY + Math.sin(i * 0.9) * 14]);
    const curve = new Curve(pts);
    let s = path(ribbon(curve, (t) => lerp(3.6, 2, Math.sin(Math.PI * t)), { count: 30 }), { fill: p.leaf });
    const body = M.leavesAlong(curve, {
      n: 20, t0: 0.04, t1: 0.96, mode: 'alt', p, r, spread: () => 60, len: (t) => 30 + 16 * Math.sin(Math.PI * t), wid: () => 7,
      shape: (rr, t, sd) => leaf(30 + 16 * Math.sin(Math.PI * t), 7.5, { belly: 0.42, sharp: 0.72, tip: rr.jitter(0.15), bend: sd * 0.05 }),
    });
    s += g({ fill: p.leaf }, body.svg);
    const kinds = ['blossom', 'daisy', 'blossom', 'anemone', 'blossom'];
    [[0.1], [0.24], [0.38], [0.5], [0.62], [0.76], [0.9]].forEach(([t], i) => {
      const q = curve.at(t).p;
      const big = Math.abs(t - 0.5) < 0.14;
      s += M.flower(big ? 'anemone' : kinds[i % kinds.length], q[0], q[1] + (i % 2 ? -4 : 4), big ? 30 : 20, p, r, { rot: r.range(0, 60), i });
    });
    return s;
  }),
  piece('deco', 'Art Déco', FOUR, ['Art Déco', 'Gatsby', 'geometrisch', 'Silvester', 'elegant'], (c) => {
    const { p } = c;
    let s = '';
    const h = new Path().M(60, CY - 9).L(512, CY - 9).M(60, CY + 9).L(512, CY + 9);
    const h2 = new Path().M(120, CY).L(470, CY);
    const dm = new Path();
    for (const x of [64]) dm.add(diamond(x, CY, 9));
    const half2 = path(h, { fill: 'none', stroke: p.ink, 'stroke-width': 2.6 }) + path(h2, { fill: 'none', stroke: p.ink, 'stroke-width': 6 }) + path(dm, { fill: p.ink });
    s += mirror(c, half2, 'h');
    s += path(diamond(600, CY, 34, 0.9), { fill: p.ink });
    s += path(diamond(600, CY, 52, 0.9), { fill: 'none', stroke: p.ink, 'stroke-width': 3 });
    for (const x of [544, 656]) s += path(diamond(x, CY, 12), { fill: p.ink });
    return s;
  }),
  piece('perlen', 'Perlenschnur', ['gold', 'rose', 'navy', 'weiss'], ['Perlen', 'Perlenkette', 'Schnur', 'elegant', 'Hochzeit', 'Linie'], (c) => {
    const { p } = c;
    const d = [];
    const n = 31;
    for (let i = 0; i < n; i++) { const x = 60 + i * (1080 / (n - 1)); const m = Math.abs(i - (n - 1) / 2) / ((n - 1) / 2); d.push({ x, y: CY, r: 11 - 5 * m * m, fill: p.ink }); }
    return path(new Path().M(40, CY).L(1160, CY), { fill: 'none', stroke: p.ink, 'stroke-width': 2, 'stroke-opacity': 0.6 }) + L.dots(d);
  }),
  piece('zickzack', 'Zickzack', ['bunt', 'pastell', 'gold', 'weiss'], ['Zickzack', 'Kinder', 'Party', 'Geburtstag', 'Zacken', 'fröhlich'], (c) => {
    const { p } = c;
    let s = '';
    const n = 30, step = 1100 / n;
    for (let i = 0; i < n; i++) {
      const x0 = 50 + i * step;
      const col = p.mono ? p.ink : p.colors[i % p.colors.length];
      s += path(new Path().M(x0, CY + 20).L(x0 + step / 2, CY - 20).L(x0 + step, CY + 20), { fill: 'none', stroke: col, 'stroke-width': 9, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    }
    return s;
  }),
  piece('konfetti', 'Konfettiband', ['bunt', 'pastell', 'gold'], ['Konfetti', 'Party', 'Geburtstag', 'Silvester', 'Kinder', 'fröhlich'], (c) => {
    const { p, r } = c;
    let s = '';
    const pts = L.scatter(r, { box: [36, 22, 1164, 98], count: 62, minDist: 30 });
    pts.forEach(([x, y], i) => {
      const col = p.colors[i % p.colors.length];
      const size = r.range(10, 19);
      const rot = r.range(0, 180);
      const kind = i % 4;
      if (kind === 0) s += circle(x, y, size * 0.45, { fill: col });
      else if (kind === 1) s += path(L.rrect(-size * 0.7, -size * 0.26, size * 1.4, size * 0.52, 2).transform(place(x, y, rot, 1)), { fill: col });
      else if (kind === 2) s += path(L.poly([[0, -size * 0.7], [size * 0.6, size * 0.5], [-size * 0.6, size * 0.5]], true).transform(place(x, y, rot, 1)), { fill: col });
      else s += path(L.smooth([[-size, 0], [-size * 0.5, -size * 0.4], [0, 0], [size * 0.5, size * 0.4], [size, 0]]).transform(place(x, y, rot, 1)), { fill: 'none', stroke: col, 'stroke-width': 3.4, 'stroke-linecap': 'round' });
    });
    return s;
  }),
];

module.exports = { name: 'Trenner', slug: 'trenner', tags: ['Trenner', 'Linie', 'Divider'], pieces };
