'use strict';
// Group "Konfetti & Ballons": confetti, streamers, balloons, party hat, bunting, gift, cake.
const L = require('./lib');
const M = require('./motifs');
const { Curve, Path, g, path, circle, rad, lerp, place, ribbon, mix } = L;

const PARTY = ['bunt', 'pastell', 'gold'];

/** Colour number i of the palette (the gradient of gold is only used for big areas). */
const col = (p, i) => p.colors[i % p.colors.length];
const stringColour = (p) => (p.id === 'pastell' ? '#a9a9b3' : p.id === 'weiss' ? '#ffffff' : p.mono ? p.tones[0] : '#6d6d78');

/** A balloon: egg shape centred at (cx, cy), width w, height 1.18 w, with knot and highlight. Returns SVG; the knot is at (cx, cy + h/2). */
function balloon(cx, cy, w, color, { rot = 0, shade = true } = {}) {
  const h = w * 1.18;
  const q = (x, y) => [x * w / 2, y * h / 2];
  const pts = [];
  for (let i = 0; i < 16; i++) { const t = (i / 16) * Math.PI * 2; pts.push(q(Math.sin(t) * (1 + 0.11 * Math.cos(t)) * 0.98, -Math.cos(t) * 0.995)); }
  const m = place(cx, cy, rot, 1);
  let s = path(L.smooth(pts, true).transform(m), { fill: color });
  if (shade) {
    const sh = [q(0.96, 0.02), q(0.7, 0.6), q(0, 0.99), q(0.1, 0.84), q(0.52, 0.5), q(0.8, 0.04)];
    s += path(L.smooth(sh, true).transform(m), { fill: '#000000', 'fill-opacity': 0.1 });
  }
  s += path(L.ellipsePath(...[-0.4 * w / 2, -0.42 * h / 2], w * 0.075, w * 0.15, -32).transform(m), { fill: '#ffffff', 'fill-opacity': 0.5 });
  s += path(L.poly([[-w * 0.06, h / 2 + w * 0.085], [w * 0.06, h / 2 + w * 0.085], [0, h / 2 - w * 0.012]], true).transform(m), { fill: color });
  return s;
}
const knot = (cx, cy, w, rot = 0) => L.ap(place(cx, cy, rot, 1), [0, w * 1.18 / 2 + w * 0.085]);

/** Strings from the knots to one point, slightly curved. */
function strings(knots, end, p, wid = 2.6) {
  const d = new Path();
  for (const k of knots) {
    const midx = (k[0] + end[0]) / 2 + (k[0] < end[0] ? -12 : 12), midy = (k[1] + end[1]) / 2;
    d.add(L.smooth([k, [midx, midy], end]));
  }
  return path(d, { fill: 'none', stroke: stringColour(p), 'stroke-width': wid, 'stroke-linecap': 'round' });
}

function bunch(c, spec, endPt, w, h) {
  const { p } = c;
  let s = '';
  const knots = spec.map(([x, y, sz, rot]) => knot(x, y, sz, rot));
  s += strings(knots, endPt, p);
  spec.forEach(([x, y, sz, rot], i) => { s += balloon(x, y, sz, col(p, i), { rot }); });
  return s;
}

const pieces = [
  {
    slug: 'streuung', name: 'Konfetti Streuung', w: 1000, h: 1000, palettes: PARTY.concat(['weiss']),
    tags: ['Konfetti', 'Streuung', 'Party', 'Geburtstag', 'Silvester', 'Hintergrund', 'Feier', 'Kinder'],
    draw(c) {
      const { p, r } = c;
      const pts = L.scatter(r, { box: [30, 30, 970, 970], count: 120, minDist: 66 });
      return pts.map(([x, y], i) => M.confettiBit(r.int(0, 5), x, y, r.range(26, 46), r.range(0, 180), col(p, i))).join('');
    },
  },
  {
    slug: 'regen', name: 'Konfettiregen', w: 1400, h: 480, palettes: PARTY,
    tags: ['Konfetti', 'Regen', 'Party', 'Geburtstag', 'Silvester', 'Rand', 'Feier', 'oben'],
    draw(c) {
      const { p, r } = c;
      const pts = L.scatter(r, { box: [24, 20, 1376, 460], count: 190, minDist: 50, accept: (x, y) => r.next() < Math.pow(1 - y / 480, 1.5) + 0.04 });
      return pts.map(([x, y], i) => M.confettiBit(r.int(0, 5), x, y, r.range(22, 38) * (1 - y / 900), r.range(0, 180), col(p, i))).join('');
    },
  },
  {
    slug: 'luftschlangen', name: 'Luftschlangen', w: 1000, h: 800, palettes: ['bunt', 'pastell', 'gold'], fit: 24,
    tags: ['Luftschlangen', 'Serpentinen', 'Party', 'Geburtstag', 'Karneval', 'Silvester', 'Feier'],
    draw(c) {
      const { p, r } = c;
      let s = '';
      const streamers = [[120, 0.0, 6.2, 600], [330, 0.4, 5.2, 700], [520, 0.9, 6.8, 560], [720, 0.2, 5.6, 690], [900, 0.7, 6.0, 610]];
      streamers.forEach(([x0, ph, turns, len], i) => {
        const pts = [];
        const steps = 90;
        for (let k = 0; k <= steps; k++) {
          const t = k / steps;
          const th = ph + t * turns * Math.PI * 2;
          const rr = 34 * Math.min(1, t * 3) * (0.7 + 0.3 * Math.sin(t * 5 + i));
          pts.push([x0 + Math.sin(th) * rr * 1.0 + Math.sin(t * 3 + i) * 26, 10 + t * len + Math.cos(th) * rr * 0.55]);
        }
        const curve = new Curve(pts);
        // the paper turns: width follows the twist
        s += path(ribbon(curve, (t) => 6 + 24 * Math.abs(Math.cos(ph + t * turns * Math.PI * 2 + 0.6)), { count: 70, ends: 'flat' }), { fill: col(p, i) });
      });
      return s;
    },
  },
  {
    slug: 'ballons-drei', name: 'Ballons Dreierbund', w: 700, h: 1100, palettes: PARTY, fit: 24,
    tags: ['Ballon', 'Ballons', 'Luftballon', 'Luftballons', 'Party', 'Geburtstag', 'Kinder', 'Feier', 'Bund'],
    draw(c) {
      const spec = [[210, 230, 300, -10], [470, 210, 290, 8], [340, 440, 280, -2]];
      return bunch(c, spec, [350, 1040]);
    },
  },
  {
    slug: 'ballons-fuenf', name: 'Ballontraube', w: 1000, h: 1300, palettes: PARTY, fit: 24,
    tags: ['Ballon', 'Ballons', 'Luftballon', 'Traube', 'Party', 'Geburtstag', 'Kinder', 'Feier', 'groß'],
    draw(c) {
      const spec = [[250, 280, 300, -8], [560, 220, 290, 6], [820, 330, 280, 12], [400, 560, 290, -4], [700, 580, 280, 6]];
      return bunch(c, spec, [530, 1250]);
    },
  },
  {
    slug: 'ballon', name: 'Ballon', w: 420, h: 900, palettes: ['bunt', 'pastell', 'gold'], fit: 24,
    tags: ['Ballon', 'Luftballon', 'Party', 'Geburtstag', 'Kinder', 'Feier', 'einzeln'],
    draw(c) {
      const { p } = c;
      const k = knot(210, 230, 380, -4);
      const stringP = L.smooth([k, [k[0] - 40, k[1] + 150], [k[0] + 30, k[1] + 300], [k[0] - 10, k[1] + 460]]);
      return path(stringP, { fill: 'none', stroke: stringColour(p), 'stroke-width': 3, 'stroke-linecap': 'round' }) + balloon(210, 230, 380, col(p, 0), { rot: -4 });
    },
  },
  {
    slug: 'ballonbogen', name: 'Ballonbogen', w: 1400, h: 700, palettes: PARTY, fit: 24,
    tags: ['Ballonbogen', 'Ballongirlande', 'Girlande', 'Ballons', 'Party', 'Geburtstag', 'Hochzeit', 'Bogen', 'Organic'],
    draw(c) {
      const { p, r } = c;
      const items = [];
      const n = 22;
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        const a = rad(lerp(184, 356, t));
        const big = i % 3 === 0;
        const off = (i % 2 ? 1 : -1) * 44;
        const R = 560 + off;
        items.push({ x: 700 + Math.cos(a) * R * 1.05, y: 680 + Math.sin(a) * R * 0.92, w: big ? 250 : i % 3 === 1 ? 180 : 140, rot: r.range(-14, 14), k: i });
      }
      items.sort((u, v) => v.w - u.w);
      return items.map((it) => balloon(it.x, it.y, it.w, col(p, it.k), { rot: it.rot })).join('');
    },
  },
  {
    slug: 'partyhut', name: 'Partyhut', w: 600, h: 820, palettes: ['bunt', 'pastell', 'gold'], fit: 24,
    tags: ['Partyhut', 'Hut', 'Party', 'Geburtstag', 'Kinder', 'Feier', 'Kegel'],
    draw(c) {
      const { p, r } = c;
      let s = '';
      const ax = 300, ay = 110, bx0 = 90, bx1 = 510, by = 700, ry = 56;
      const segs = 7;
      for (let i = 0; i < segs; i++) {
        const t0 = i / segs, t1 = (i + 1) / segs;
        const a0 = lerp(180, 360, t0) + 0, a1 = lerp(180, 360, t1);
        // base arc points: front half of the ellipse (from left to right through the bottom)
        const pt = (a) => [300 + 210 * Math.cos(rad(a)), by + ry * Math.sin(rad(a))];
        const q0 = pt(lerp(0, 180, t0)), q1 = pt(lerp(0, 180, t1));
        const d = new Path().M(ax, ay).L(q1[0], q1[1]).arc(300, by, 210, ry, lerp(0, 180, t1), lerp(0, 180, t0)).Z();
        s += path(d, { fill: col(p, i * 2 + 1) });
      }
      // the brim
      s += path(L.ellipsePath(300, by, 210, ry), { fill: 'none', stroke: p.mono ? p.tones[0] : '#ffffff', 'stroke-width': 12, 'stroke-opacity': 0.9 });
      // pompom
      const pom = new Path();
      for (let i = 0; i < 16; i++) { const a = rad(i * 22.5); pom.add(L.circlePath(300 + Math.cos(a) * 30, 84 + Math.sin(a) * 30, 16)); }
      s += path(pom, { fill: col(p, 4) });
      s += circle(300, 84, 24, { fill: col(p, 4) });
      return s;
    },
  },
  {
    slug: 'wimpelkette', name: 'Wimpelkette', w: 1400, h: 380, palettes: ['bunt', 'pastell', 'gold', 'weiss'], fit: 24,
    tags: ['Wimpelkette', 'Wimpel', 'Girlande', 'Fähnchen', 'Party', 'Geburtstag', 'Kinder', 'Fest', 'Sommerfest'],
    draw(c) {
      const { p } = c;
      let s = '';
      const sag = (t) => 40 + 150 * Math.sin(Math.PI * t);
      const curve = new Curve(Array.from({ length: 13 }, (_, i) => { const t = i / 12; return [30 + t * 1340, sag(t)]; }));
      s += path(ribbon(curve, () => 4, { count: 40 }), { fill: stringColour(p) });
      const n = 9;
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;
        const q = curve.at(t);
        const d = new Path().M(-66, -2).L(66, -2).L(0, 170).Z();
        s += path(d.transform(place(q.p[0], q.p[1], q.angle, 1)), { fill: col(p, i) });
        s += circle(q.p[0], q.p[1], 6, { fill: stringColour(p) });
      }
      s += circle(30, 40, 9, { fill: stringColour(p) }) + circle(1370, 40, 9, { fill: stringColour(p) });
      return s;
    },
  },
  {
    slug: 'geschenk', name: 'Geschenk', w: 700, h: 700, palettes: ['bunt', 'pastell', 'gold'], fit: 24,
    tags: ['Geschenk', 'Päckchen', 'Schleife', 'Geburtstag', 'Weihnachten', 'Party', 'Kinder', 'Überraschung'],
    draw(c) {
      const { p } = c;
      const body = col(p, 3), lid = mix(body.startsWith('#') ? body : '#d9b56a', '#000000', 0.12), rib = col(p, 0);
      let s = '';
      s += path(L.rrect(110, 300, 480, 340, 10), { fill: body });
      s += path(L.rrect(110, 300, 480, 340, 10).transform(L.IDENT), { fill: '#000000', 'fill-opacity': 0.04 });
      s += path(L.rrect(80, 230, 540, 100, 12), { fill: body.startsWith('#') ? mix(body, '#ffffff', 0.18) : body });
      s += path(L.rrect(80, 230, 540, 100, 12), { fill: '#000000', 'fill-opacity': 0.06 });
      s += path(L.rrect(310, 230, 80, 410, 3), { fill: rib });
      s += path(L.rrect(310, 230, 80, 100, 3), { fill: '#000000', 'fill-opacity': 0.08 });
      // bow: two loops, knot, tails
      const loop = (dir) => new Path().M(350, 226).C(350 + dir * 30, 110, 350 + dir * 190, 56, 350 + dir * 214, 136).C(350 + dir * 232, 206, 350 + dir * 110, 240, 350, 226).Z();
      s += path(loop(-1), { fill: rib }) + path(loop(1), { fill: rib });
      s += path(new Path().M(350, 224).C(350 - 40, 170, 350 - 120, 150, 350 - 150, 160).C(350 - 100, 190, 350 - 60, 214, 350, 224).Z(), { fill: '#000000', 'fill-opacity': 0.1 });
      s += path(new Path().M(350, 224).C(350 + 40, 170, 350 + 120, 150, 350 + 150, 160).C(350 + 100, 190, 350 + 60, 214, 350, 224).Z(), { fill: '#000000', 'fill-opacity': 0.1 });
      s += path(L.rrect(322, 196, 56, 50, 14), { fill: rib }) + path(L.rrect(322, 196, 56, 50, 14), { fill: '#000000', 'fill-opacity': 0.1 });
      return s;
    },
  },
  {
    slug: 'torte', name: 'Geburtstagstorte', w: 700, h: 820, palettes: ['bunt', 'pastell'], fit: 24,
    tags: ['Torte', 'Kuchen', 'Geburtstag', 'Kerzen', 'Party', 'Kinder', 'Feier', 'Konditorei'],
    draw(c) {
      const { p, r } = c;
      let s = '';
      const cake = col(p, 1), icing = col(p, 5), icing2 = col(p, 0);
      s += path(L.rrect(40, 700, 620, 40, 20), { fill: col(p, 3) });
      s += path(L.rrect(90, 470, 520, 240, 22), { fill: cake });
      s += path(L.rrect(160, 280, 380, 200, 20), { fill: mix(cake, '#ffffff', 0.25) });
      // icing drips
      const drip = (x0, x1, y, depth, n) => {
        const d = new Path().M(x0, y - 36).L(x1, y - 36).L(x1, y);
        const w = (x1 - x0) / n;
        for (let i = n - 1; i >= 0; i--) {
          const xl = x0 + i * w, dd = depth * (i % 2 ? 0.55 : 1) * (0.8 + 0.2 * r.next());
          d.C(xl + w * 0.9, y + dd * 0.2, xl + w * 0.75, y + dd, xl + w * 0.5, y + dd).C(xl + w * 0.25, y + dd, xl + w * 0.1, y + dd * 0.2, xl, y);
        }
        return d.Z();
      };
      s += path(drip(90, 610, 500, 62, 8), { fill: icing });
      s += path(drip(160, 540, 310, 50, 6), { fill: icing2 });
      // sprinkles
      for (let i = 0; i < 18; i++) {
        const x = r.range(120, 580), y = r.range(540, 660);
        s += path(L.rrect(-9, -3, 18, 6, 3).transform(place(x, y, r.range(0, 180), 1)), { fill: col(p, i + 2) });
      }
      // candles
      [[250, 0], [350, 3], [450, 4]].forEach(([x, k], i) => {
        s += path(L.rrect(x - 12, 190, 24, 100, 4), { fill: col(p, i + 2) });
        s += path(L.rrect(x - 12, 190, 24, 100, 4), { fill: '#ffffff', 'fill-opacity': 0.35 });
        s += path(new Path().M(x, 140).C(x + 22, 168, x + 16, 186, x, 188).C(x - 16, 186, x - 22, 168, x, 140).Z(), { fill: p.mono ? p.tones[1] : '#ffb627' });
      });
      return s;
    },
  },
];

module.exports = { name: 'Konfetti & Ballons', slug: 'konfetti', tags: ['Party', 'Feier', 'Geburtstag', 'Konfetti', 'Ballon'], pieces };
