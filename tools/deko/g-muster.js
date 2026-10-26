'use strict';
// Group "Muster": calm patterns as 1000 x 1000 fields on a transparent ground (everything that leaves the box is cut by the viewBox).
const L = require('./lib');
const M = require('./motifs');
const { Curve, Path, g, path, circle, rad, lerp, place, leaf } = L;

const col = (p, i) => p.colors[i % p.colors.length];
const FOUR = ['gold', 'navy', 'schwarz', 'weiss'];
/**
 * The visible parts of overlapping scale arcs: scales of radius R in rows (the next row lies step below and is shifted by R); a scale's arc is hidden where a scale
 * of a later row covers it. radii (fractions of R) give concentric arcs. Returns one path of open strokes.
 */
function scaleArcs({ R, step, rows, from = -1, to = 7, radii = [1] }) {
  const byRow = [];
  for (let row = 0; row < rows; row++) { byRow.push([]); for (let i = from; i < to; i++) byRow[row].push({ row, x: i * 2 * R + (row % 2 ? R : 0) + R, y: row * step }); }
  const d = new Path();
  const STEP = 2;
  for (const list of byRow) for (const sc of list) {
    for (const k of radii) {
      let runStart = null;
      const close = (aEnd) => { if (runStart !== null && runStart - aEnd > 0.1) d.arc(sc.x, sc.y, R * k, R * k, -runStart, -aEnd, true); runStart = null; };
      for (let a = 180; a >= 0; a -= STEP) {
        const x = sc.x + Math.cos(rad(a)) * R * k, y = sc.y - Math.sin(rad(a)) * R * k;
        let hidden = false;
        for (let rr = sc.row + 1; rr <= sc.row + 2 && rr < rows && !hidden; rr++) {
          for (const o of byRow[rr]) { if (Math.abs(o.x - x) < R && Math.hypot(o.x - x, o.y - y) < R - 0.5 && y < o.y + 0.001) { hidden = true; break; } }
        }
        if (hidden) close(a + STEP); else if (runStart === null) runStart = a;
      }
      close(0);
    }
  }
  return d;
}
const piece = (slug, name, palettes, tags, fn) => ({ slug, name, w: 1000, h: 1000, palettes, bleed: true, tags: ['Muster', 'Pattern', 'Hintergrund', 'Fläche', 'Textur', ...tags], draw: fn });

const pieces = [
  piece('punkte', 'Punkte', FOUR.concat(['rose', 'salbei']), ['Punkte', 'Tupfen', 'Polka', 'Dots', 'gepunktet', 'ruhig'], (c) => {
    const { p } = c;
    const d = [];
    for (let row = 0; row < 11; row++) for (let i = 0; i < 11; i++) d.push({ x: i * 100 + (row % 2 ? 50 : 0), y: row * 86, r: 13, fill: p.ink });
    return L.dots(d);
  }),
  piece('streifen', 'Streifen', FOUR.concat(['rose']), ['Streifen', 'gestreift', 'diagonal', 'Linien', 'ruhig'], (c) => {
    const { p } = c;
    const d = new Path();
    for (let i = -10; i < 24; i++) d.M(i * 60 - 200, -40).L(i * 60 - 200 + 1200, 1160).L(i * 60 - 200 + 1200 + 14, 1160).L(i * 60 - 200 + 14, -40).Z();
    return path(d, { fill: p.ink });
  }),
  piece('wellen', 'Wellen', FOUR.concat(['salbei']), ['Wellen', 'Wasser', 'Meer', 'wellig', 'Linien', 'maritim'], (c) => {
    const { p } = c;
    const d = new Path();
    for (let row = 0; row < 12; row++) {
      const pts = [];
      for (let i = 0; i <= 20; i++) pts.push([-20 + i * 52, 40 + row * 84 + Math.sin(i * Math.PI / 2 + (row % 2) * Math.PI) * 18]);
      d.add(L.smooth(pts));
    }
    return path(d, { fill: 'none', stroke: p.ink, 'stroke-width': 5, 'stroke-linecap': 'round' });
  }),
  piece('schuppen', 'Schuppen', FOUR.concat(['rose']), ['Schuppen', 'Fischschuppen', 'Bögen', 'Meerjungfrau', 'Japan', 'Seigaiha'], (c) => {
    const { p } = c;
    return path(scaleArcs({ R: 60, step: 33, rows: 34, to: 10 }), { fill: 'none', stroke: p.ink, 'stroke-width': 4.4, 'stroke-linecap': 'round' });
  }),
  piece('sterne', 'Sternchen', ['gold', 'navy', 'weiss', 'schwarz'], ['Sterne', 'Sternchen', 'Himmel', 'Nacht', 'Weihnachten', 'Kinder'], (c) => {
    const { p, r } = c;
    const pts = L.scatter(r, { box: [20, 20, 980, 980], count: 70, minDist: 104 });
    const d = new Path();
    pts.forEach(([x, y], i) => { if (i % 4 === 3) d.add(L.circlePath(x, y, 7)); else d.add(L.sparkle(x, y, r.range(15, 28), { squash: 0.22 })); });
    return path(d, { fill: p.ink });
  }),
  piece('bluemchen', 'Blümchen', ['rose', 'navy', 'pastell', 'bunt', 'gold'], ['Blümchen', 'Blumen', 'Blüten', 'Liberty', 'Vintage', 'Frühling', 'Stoff'], (c) => {
    const { p, r } = c;
    const centre = p.mono ? p.tones[0] : '#ffb627';
    const petals = new Path();
    for (let k = 0; k < 5; k++) petals.add(L.circlePath(Math.cos(rad(k * 72 - 90)) * 15, Math.sin(rad(k * 72 - 90)) * 15, 12.5));
    c.defs.push(`<g id="b">${path(petals, {})}${circle(0, 0, 6.5, { fill: centre })}</g>`);
    const leafP = leaf(30, 8, { belly: 0.42, sharp: 0.7 }).whole;
    c.defs.push(path(leafP, { id: 'l' }));
    let s = '';
    const pts = L.scatter(r, { box: [30, 30, 970, 970], count: 60, minDist: 118 });
    pts.forEach(([x, y], i) => {
      s += L.useAt('l', x, y, { rot: r.range(0, 360), fill: p.leaf }) + L.useAt('l', x, y, { rot: r.range(0, 360), fill: p.leaf });
      s += L.useAt('b', x, y, { rot: r.range(0, 72), s: r.range(0.9, 1.25), fill: p.mono ? p.tones[1 + (i % 2)] : col(p, i) });
    });
    return s;
  }),
  piece('herzchen', 'Herzchen', ['rose', 'gold', 'navy', 'weiss', 'bunt'], ['Herzen', 'Herzchen', 'Liebe', 'Valentinstag', 'Hochzeit', 'Kinder'], (c) => {
    const { p } = c;
    c.defs.push(path(L.heart(0, 0, 40), { id: 'h' }));
    let s = '';
    for (let row = 0; row < 10; row++) for (let i = 0; i < 9; i++) {
      const x = 62 + i * 110 + (row % 2 ? 55 : 0), y = 60 + row * 100;
      s += L.useAt('h', x, y, { fill: p.mono ? p.ink : col(p, row + i) });
    }
    return s;
  }),
  piece('karo', 'Karo', ['rose', 'navy', 'salbei', 'schwarz', 'bunt'], ['Karo', 'kariert', 'Vichy', 'Gingham', 'Picknick', 'Tischdecke'], (c) => {
    const { p } = c;
    const colr = p.mono ? p.ink : p.colors[0];
    const stripes = new Path();
    for (let i = 0; i < 6; i++) stripes.add(L.rrect(i * 200 + 50, -10, 100, 1020, 0));
    const h = new Path();
    for (let i = 0; i < 6; i++) h.add(L.rrect(-10, i * 200 + 50, 1020, 100, 0));
    return path(stripes, { fill: colr, 'fill-opacity': 0.5 }) + path(h, { fill: colr, 'fill-opacity': 0.5 });
  }),
  piece('zickzack', 'Zickzack', FOUR.concat(['bunt', 'pastell']), ['Zickzack', 'Chevron', 'Zacken', 'Retro', 'Kinder'], (c) => {
    const { p } = c;
    let s = '';
    for (let row = 0; row < 8; row++) {
      const pts = [];
      for (let i = 0; i <= 14; i++) pts.push([-20 + i * 80, row * 130 + (i % 2 ? 0 : 52)]);
      s += path(L.poly(pts, false), { fill: 'none', stroke: p.mono ? p.ink : col(p, row), 'stroke-width': 9, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' });
    }
    return s;
  }),
  piece('deco', 'Art-Déco-Fächer', FOUR, ['Art Déco', 'Fächer', 'Gatsby', 'Silvester', 'geometrisch', 'elegant'], (c) => {
    const { p } = c;
    return path(scaleArcs({ R: 110, step: 55, rows: 20, to: 6, radii: [1, 0.7, 0.4] }), { fill: 'none', stroke: p.ink, 'stroke-width': 3.4, 'stroke-linecap': 'round' });
  }),
  piece('blaetter', 'Blätter', ['salbei', 'gold', 'navy', 'rose', 'weiss'], ['Blätter', 'Laub', 'Natur', 'Botanik', 'Dschungel', 'Tapete'], (c) => {
    const { p, r } = c;
    const pts = L.scatter(r, { box: [30, 30, 970, 970], count: 60, minDist: 112 });
    let s = '';
    pts.forEach(([x, y], i) => {
      const l = r.range(70, 104);
      s += M.leafEl(leaf(l, l * 0.24, { belly: 0.42, sharp: 0.72, asym: r.jitter(0.1), tip: r.jitter(0.2), bend: r.jitter(0.08) }), place(x - l / 2, y, r.range(0, 360), 1), p, {});
    });
    return g({ fill: p.leaf }, s);
  }),
  piece('konfettipunkte', 'Konfettipunkte', ['bunt', 'pastell', 'gold'], ['Konfetti', 'Punkte', 'Party', 'Geburtstag', 'Kinder', 'Tupfen'], (c) => {
    const { p, r } = c;
    const pts = L.scatter(r, { box: [20, 20, 980, 980], count: 120, minDist: 76 });
    return L.dots(pts.map(([x, y], i) => ({ x, y, r: r.range(10, 24), fill: col(p, i) })));
  }),
  piece('wolken', 'Wolken und Sterne', ['pastell', 'bunt', 'gold'], ['Wolken', 'Sterne', 'Himmel', 'Baby', 'Kinder', 'Geburt', 'Taufe', 'Traum'], (c) => {
    const { p, r } = c;
    let s = '';
    const pts = L.scatter(r, { box: [60, 60, 940, 940], count: 36, minDist: 150 });
    pts.forEach(([x, y], i) => {
      if (i % 3 === 0) {
        const k = r.range(0.8, 1.1);
        const cloud = new Path().add(L.circlePath(-26 * k, 0, 24 * k)).add(L.circlePath(0, -14 * k, 32 * k)).add(L.circlePath(28 * k, 0, 24 * k)).add(L.rrect(-48 * k, -2 * k, 100 * k, 26 * k, 13 * k));
        s += path(cloud.transform(L.move(x, y)), { fill: col(p, 3) });
      } else if (i % 3 === 1) s += path(L.starPath(x, y, r.range(20, 30), 10, 5, r.range(-110, -70)), { fill: col(p, 1) });
      else s += circle(x, y, r.range(7, 11), { fill: col(p, i) });
    });
    return s;
  }),
  piece('regenbogen', 'Regenbogenbögen', ['boho', 'pastell', 'bunt'], ['Regenbogen', 'Bögen', 'Boho', 'Kinder', 'Baby', 'Schuppen', 'Retro'], (c) => {
    const { p } = c;
    const R = 100;
    let sym = '';
    for (let k = 0; k < 4; k++) { const rr = R - k * 22; sym += path(new Path().arc(0, 0, rr, rr, 180, 360, true).Z(), { fill: col(p, k) }); }
    c.defs.push(`<g id="s">${sym}</g>`);
    let s = '';
    for (let row = 0; row < 24; row++) for (let i = -1; i < 6; i++) s += L.useAt('s', i * 2 * R + (row % 2 ? R : 0) + R, row * R * 0.5 + 10);
    return s;
  }),
];

module.exports = { name: 'Muster', slug: 'muster', tags: ['Muster', 'Pattern', 'Hintergrund'], pieces };
