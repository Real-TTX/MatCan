'use strict';
// Group "Rahmen": frames at their own aspect ratios (the centre stays transparent). Sizes: hoch 1000 x 1414 (A series), quer 1414 x 1000, quadrat 1000 x 1000, lang 1000 x 2121.
const L = require('./lib');
const M = require('./motifs');
const C = require('./corners');
const { DIAG } = require('./flourish');
const { Path, g, path, circle, rad, lerp, place, leaf } = L;

const SIZES = { hoch: [1000, 1414], quer: [1414, 1000], quadrat: [1000, 1000], lang: [1000, 2121] };
const FOUR = ['gold', 'navy', 'schwarz', 'weiss'];

/** Rectangle with concave quarter-circle corners. */
function notchRect(x0, y0, x1, y1, cut) {
  return new Path().M(x0 + cut, y0).L(x1 - cut, y0).arc(x1, y0, cut, cut, 180, 90).L(x1, y1 - cut).arc(x1, y1, cut, cut, 270, 180)
    .L(x0 + cut, y1).arc(x0, y1, cut, cut, 0, -90).L(x0, y0 + cut).arc(x0, y0, cut, cut, 90, 0).Z();
}
const rect = (x0, y0, x1, y1) => new Path().M(x0, y0).L(x1, y0).L(x1, y1).L(x0, y1).Z();
const stroke = (p, w, extra = {}) => ({ fill: 'none', stroke: p.ink, 'stroke-width': w, 'stroke-linejoin': 'miter', ...extra });
/** The four corners of a frame from a 400 x 400 top left corner drawing. */
function fourCorners(c, w, h, svg) {
  c.defs.push(`<g id="k">${svg}</g>`);
  return `<use href="#k" />` + [`matrix(-1 0 0 1 ${w} 0)`, `matrix(1 0 0 -1 0 ${h})`, `matrix(-1 0 0 -1 ${w} ${h})`].map((t) => `<use href="#k" transform="${t}" />`).join('');
}
/** Points along a rectangle's perimeter at a given spacing (a bead every `step`). */
function perimeter(x0, y0, x1, y1, step) {
  const pts = [];
  const sides = [[x0, y0, x1, y0], [x1, y0, x1, y1], [x1, y1, x0, y1], [x0, y1, x0, y0]];
  for (const [ax, ay, bx, by] of sides) {
    const len = Math.hypot(bx - ax, by - ay);
    const n = Math.max(1, Math.round(len / step));
    for (let i = 0; i < n; i++) pts.push([lerp(ax, bx, i / n), lerp(ay, by, i / n)]);
  }
  return pts;
}

/** A rectangle whose edges carry semicircular notches (a perforated stamp edge). */
function perforated(x0, y0, x1, y1, step, r) {
  const p = new Path().M(x0, y0);
  const side = (ax, ay, bx, by, a0, a1) => {
    const len = Math.hypot(bx - ax, by - ay);
    const n = Math.max(1, Math.round(len / step));
    const ux = (bx - ax) / len, uy = (by - ay) / len;
    for (let i = 0; i < n; i++) {
      const t = ((i + 0.5) / n) * len;
      const cx = ax + ux * t, cy = ay + uy * t;
      p.L(cx - ux * r, cy - uy * r).arc(cx, cy, r, r, a0, a1);
    }
    p.L(bx, by);
  };
  side(x0, y0, x1, y0, 180, 0); side(x1, y0, x1, y1, 270, 90); side(x1, y1, x0, y1, 0, -180); side(x0, y1, x0, y0, 90, -90);
  return p.Z();
}

/** One frame piece per listed size: kind = function (c, w, h) returning SVG. */
function frame(slug, name, sizes, palettes, tags, fn, extra = {}) {
  return sizes.map((sz) => {
    const [w, h] = SIZES[sz];
    const label = { hoch: 'hoch', quer: 'quer', quadrat: 'quadrat', lang: 'lang' }[sz];
    return {
      slug: sizes.length > 1 ? `${slug}-${sz}` : slug, name: sizes.length > 1 ? `${name} ${label}` : name, w, h, palettes,
      tags: ['Rahmen', 'Umrandung', ...tags, ...(sz === 'hoch' ? ['Hochformat', 'A5', 'A6'] : sz === 'quer' ? ['Querformat'] : sz === 'quadrat' ? ['quadratisch'] : ['DIN lang', 'Menü', 'Lesezeichen'])],
      draw: (c) => fn(c, w, h),
      ...extra,
    };
  });
}

const pieces = [
  ...frame('doppellinie', 'Doppellinie', ['hoch', 'quer', 'quadrat', 'lang'], FOUR, ['Linie', 'schlicht', 'klassisch', 'Urkunde', 'Einladung', 'Hochzeit', 'elegant'], (c, w, h) => {
    const p = c.p;
    return g({}, path(notchRect(36, 36, w - 36, h - 36, 34), stroke(p, 6)), path(rect(70, 70, w - 70, h - 70), stroke(p, 2.4)),
      [[36, 36], [w - 36, 36], [36, h - 36], [w - 36, h - 36]].map(([x, y]) => path(L.poly([[x, y - 12], [x + 12, y], [x, y + 12], [x - 12, y]], true), { fill: p.ink })).join(''));
  }),
  ...frame('schnoerkel', 'Schnörkelrahmen', ['hoch', 'quer'], ['gold', 'navy', 'schwarz', 'weiss'], ['Schnörkel', 'Ornament', 'barock', 'Hochzeit', 'Urkunde', 'festlich'], (c, w, h) => {
    const p = c.p;
    const lines = path(new Path().M(330, 40).L(w - 330, 40).M(330, h - 40).L(w - 330, h - 40).M(40, 330).L(40, h - 330).M(w - 40, 330).L(w - 40, h - 330), stroke(p, 3, { 'stroke-linecap': 'round' }));
    return lines + fourCorners(c, w, h, C.scrollCorner(p, c.r));
  }),
  ...frame('ranke', 'Rankenrahmen', ['hoch', 'quer'], ['gold', 'salbei', 'navy', 'weiss'], ['Ranke', 'Blätter', 'Natur', 'Hochzeit', 'Boho'], (c, w, h) => {
    const p = c.p;
    const lines = path(new Path().M(380, 56).L(w - 380, 56).M(380, h - 56).L(w - 380, h - 56).M(56, 380).L(56, h - 380).M(w - 56, 380).L(w - 56, h - 380), stroke(p, 3, { 'stroke-linecap': 'round', stroke: p.leaf }));
    return lines + fourCorners(c, w, h, C.vineCorner(p, c.r));
  }),
  ...frame('blueten', 'Blütenrahmen', ['hoch', 'quer'], ['rose', 'pastell', 'gold', 'navy'], ['Blüten', 'Blumen', 'Hochzeit', 'Geburtstag', 'Frühling', 'Taufe'], (c, w, h) => {
    const p = c.p;
    const col = p.mono ? p.tones[1] : p.colors[2];
    const lines = path(new Path().M(330, 44).L(w - 330, 44).M(330, h - 44).L(w - 330, h - 44).M(44, 330).L(44, h - 330).M(w - 44, 330).L(w - 44, h - 330), stroke(p, 3, { 'stroke-linecap': 'round', stroke: col }));
    return lines + fourCorners(c, w, h, C.floralCorner(p, c.r));
  }),
  ...frame('deco', 'Art-Déco-Rahmen', ['hoch', 'quer'], FOUR, ['Art Déco', 'Gatsby', 'Silvester', 'geometrisch', 'elegant', 'Gold'], (c, w, h) => {
    const p = c.p;
    const lines = path(rect(10, 10, w - 10, h - 10), stroke(p, 4)) + path(rect(26, 26, w - 26, h - 26), stroke(p, 2));
    return lines + fourCorners(c, w, h, C.decoCorner(p));
  }),
  ...frame('klammern', 'Eckklammern', ['hoch'], FOUR, ['Klammer', 'Ecken', 'schlicht', 'modern', 'Urkunde'], (c, w, h) => fourCorners(c, w, h, C.bracketCorner(c.p))),
  ...frame('bogen', 'Bogenfenster', ['hoch'], ['gold', 'rose', 'salbei', 'navy', 'schwarz', 'weiss'], ['Bogen', 'Arch', 'Fenster', 'Boho', 'Hochzeit', 'Einladung', 'modern'], (c, w, h) => {
    const p = c.p;
    const arch = (inset, bottom) => {
      const r = (w - 2 * inset) / 2;
      return new Path().M(inset, h - bottom).L(inset, inset + r).arc(w / 2, inset + r, r, r, 180, 360).L(w - inset, h - bottom).Z();
    };
    let s = path(arch(70, 70), stroke(p, 8));
    s += path(arch(110, 110), stroke(p, 2.4));
    // beads between the two lines along the curve
    const beads = new Path();
    const rr = (w - 180) / 2, cy = 90 + rr;
    for (let a = 184; a <= 356; a += 8) beads.add(L.circlePath(w / 2 + Math.cos(rad(a)) * rr, cy + Math.sin(rad(a)) * rr, 4.6));
    s += path(beads, { fill: p.ink });
    return s;
  }),
  ...frame('zierrand', 'Bogenrand', ['hoch', 'quer'], ['gold', 'rose', 'navy', 'weiss'], ['Bogenkante', 'Girlande', 'Spitze', 'Wellen', 'Kinder', 'verspielt', 'Rahmen'], (c, w, h) => {
    const p = c.p;
    const edge = (x0, y0, x1, y1, outward) => {
      const len = Math.hypot(x1 - x0, y1 - y0);
      const n = Math.round(len / 52);
      const dx = (x1 - x0) / n, dy = (y1 - y0) / n;
      const q = new Path();
      for (let i = 0; i < n; i++) {
        const ax = x0 + dx * i, ay = y0 + dy * i, bx = ax + dx, by = ay + dy;
        const mx = (ax + bx) / 2, my = (ay + by) / 2;
        const nx = outward[0], ny = outward[1];
        const hgt = 20;
        q.M(ax, ay).C(ax + nx * hgt * 1.3, ay + ny * hgt * 1.3, bx + nx * hgt * 1.3, by + ny * hgt * 1.3, bx, by);
      }
      return q;
    };
    const m = 60, s = new Path();
    s.add(edge(m + 20, m, w - m - 20, m, [0, -1])).add(edge(m + 20, h - m, w - m - 20, h - m, [0, 1]));
    s.add(edge(m, m + 20, m, h - m - 20, [-1, 0])).add(edge(w - m, m + 20, w - m, h - m - 20, [1, 0]));
    let out = path(s, stroke(p, 5, { 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
    out += path(rect(m + 28, m + 28, w - m - 28, h - m - 28), stroke(p, 2));
    for (const [x, y] of [[m + 6, m + 6], [w - m - 6, m + 6], [m + 6, h - m - 6], [w - m - 6, h - m - 6]]) out += circle(x, y, 10, { fill: p.ink });
    return out;
  }),
  ...frame('punkte', 'Punktrahmen', ['hoch', 'quer'], ['bunt', 'pastell', 'gold', 'weiss'], ['Punkte', 'Perlen', 'Kinder', 'Geburtstag', 'verspielt', 'Party'], (c, w, h) => {
    const p = c.p;
    const items = perimeter(70, 70, w - 70, h - 70, 46).map(([x, y], i) => ({ x, y, r: i % 2 ? 10 : 15, fill: p.mono ? p.ink : p.colors[i % p.colors.length] }));
    return L.dots(items);
  }),
  ...frame('konfetti', 'Konfettirahmen', ['hoch', 'quer'], ['bunt', 'pastell', 'gold'], ['Konfetti', 'Party', 'Geburtstag', 'Silvester', 'Kinder'], (c, w, h) => {
    const { p, r } = c;
    let out = '';
    const band = 120;
    const inBand = (x, y) => x < band || y < band || x > w - band || y > h - band;
    const pts = L.scatter(r, { box: [24, 24, w - 24, h - 24], count: 170, minDist: 44, accept: inBand });
    pts.forEach(([x, y], i) => {
      const col = p.colors[i % p.colors.length];
      const size = r.range(14, 26);
      const rot = r.range(0, 180);
      const kind = i % 5;
      if (kind === 0) out += circle(x, y, size * 0.5, { fill: col });
      else if (kind === 1) out += path(L.rrect(-size * 0.7, -size * 0.28, size * 1.4, size * 0.56, 2).transform(place(x, y, rot, 1)), { fill: col });
      else if (kind === 2) out += path(L.poly([[0, -size * 0.7], [size * 0.62, size * 0.5], [-size * 0.62, size * 0.5]], true).transform(place(x, y, rot, 1)), { fill: col });
      else if (kind === 3) out += path(L.smooth([[-size, 0], [-size * 0.5, -size * 0.42], [0, 0], [size * 0.5, size * 0.42], [size, 0]]).transform(place(x, y, rot, 1)), { fill: 'none', stroke: col, 'stroke-width': 3.6, 'stroke-linecap': 'round' });
      else out += path(L.starPath(0, 0, size * 0.7, size * 0.3, 5, -90).transform(place(x, y, rot, 1)), { fill: col });
    });
    return out;
  }),
  ...frame('perlenring', 'Perlenring', ['quadrat'], ['gold', 'rose', 'navy', 'schwarz', 'weiss'], ['Ring', 'Kreis', 'rund', 'Perlen', 'Medaillon', 'Hochzeit'], (c, w, h) => {
    const p = c.p;
    const beads = [];
    const R = 440;
    const cnt = 96;
    for (let i = 0; i < cnt; i++) { const a = (i / cnt) * Math.PI * 2; beads.push({ x: 500 + Math.cos(a) * R, y: 500 + Math.sin(a) * R, r: i % 2 ? 6 : 9, fill: p.ink }); }
    return L.dots(beads) + path(L.circlePath(500, 500, 398), stroke(p, 7)) + path(L.circlePath(500, 500, 372), stroke(p, 2.2));
  }),
  ...frame('oval', 'Ovalrahmen', ['hoch'], FOUR, ['Oval', 'Medaillon', 'Cameo', 'Hochzeit', 'Urkunde', 'Schnörkel'], (c, w, h) => {
    const p = c.p;
    const cx = w / 2, cy = h / 2;
    let s = path(L.ellipsePath(cx, cy, 430, 600), stroke(p, 7)) + path(L.ellipsePath(cx, cy, 400, 570), stroke(p, 2.4));
    // flourishes at the top and the bottom
    const { curlArm } = require('./flourish');
    for (const [y, flip] of [[cy - 600, 1], [cy + 600, -1]]) {
      for (const sx of [-1, 1]) {
        const a = curlArm([cx + sx * 20, y], sx > 0 ? 0 : 180, { len: 130, bow: -flip * 8, R: 34, r: 6, turns: 1.4, side: flip * sx > 0 ? -1 : 1, w0: 3, wmax: 9, w1: 2, bulb: 5.5, widest: 0.4 });
        s += a.svg;
      }
      s += path(L.poly([[cx, y - 16], [cx + 16, y], [cx, y + 16], [cx - 16, y]], true), { fill: p.ink });
    }
    return g({ fill: p.ink }, s);
  }),
  ...frame('briefmarke', 'Briefmarkenrand', ['hoch', 'quer'], ['schwarz', 'navy', 'gold', 'weiss'], ['Briefmarke', 'Perforation', 'Rand', 'Post', 'retro', 'Karte'], (c, w, h) => {
    const p = c.p;
    const bandOuter = 40, bandInner = 86;
    const outer = perforated(bandOuter, bandOuter, w - bandOuter, h - bandOuter, 46, 14);
    const inner = rect(bandInner, bandInner, w - bandInner, h - bandInner);
    return path(new Path().add(outer).add(inner), { fill: p.ink, 'fill-rule': 'evenodd' });
  }),
];

module.exports = { name: 'Rahmen', slug: 'rahmen', tags: ['Rahmen', 'Umrandung', 'Deko'], pieces };
