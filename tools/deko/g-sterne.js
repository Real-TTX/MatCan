'use strict';
// Group "Sterne": stars, sparkles, wreath, shooting star, garland, snowflakes.
const L = require('./lib');
const M = require('./motifs');
const { Curve, Path, g, path, circle, rad, lerp, place, ribbon, mix } = L;

const col = (p, i) => p.colors[i % p.colors.length];
const GLOW = ['gold', 'weiss', 'navy', 'schwarz', 'rose'];
const dark = (p) => (p.id === 'weiss' ? '#cdc7b8' : p.mono ? p.tones[0] : mix(p.colors[0], '#000000', 0.2));

/** A faceted star: every point is split into a light and a darker half. */
function facetStar(cx, cy, ro, ri, p, rot = -90, m = null) {
  let s = '';
  const pts = [];
  for (let i = 0; i < 10; i++) { const a = rad(rot + i * 36); const rr = i % 2 ? ri : ro; pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); }
  const T = (q) => (m ? q.transform(m) : q);
  s += path(T(L.poly(pts, true)), {});
  const half = new Path();
  for (let i = 0; i < 5; i++) { const t = pts[i * 2], l = pts[(i * 2 + 1) % 10]; half.M(cx, cy).L(t[0], t[1]).L(l[0], l[1]).Z(); }
  s += path(T(half), { fill: dark(p), 'fill-opacity': p.mono ? 0.55 : 0.18 });
  return s;
}

const snowflake = (cx, cy, R, kind, p) => {
  const d = new Path();
  for (let a = 0; a < 6; a++) {
    const m = L.compose(L.move(cx, cy), L.rotm(a * 60));
    const arm = new Path().M(0, 0).L(R, 0);
    const branches = kind === 0 ? [[0.36, 0.3], [0.62, 0.22]] : kind === 1 ? [[0.3, 0.26], [0.5, 0.34], [0.72, 0.2]] : [[0.5, 0.36]];
    for (const [t, len] of branches) {
      arm.M(R * t, 0).L(R * (t + len * 0.7), -R * len * 0.7);
      arm.M(R * t, 0).L(R * (t + len * 0.7), R * len * 0.7);
    }
    d.add(arm.transform(m));
  }
  let s = path(d, { fill: 'none', stroke: p.ink, 'stroke-width': R * 0.045, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
  if (kind === 2) s += path(L.poly(Array.from({ length: 6 }, (_, i) => [cx + Math.cos(rad(i * 60 + 30)) * R * 0.22, cy + Math.sin(rad(i * 60 + 30)) * R * 0.22]), true), { fill: 'none', stroke: p.ink, 'stroke-width': R * 0.04, 'stroke-linejoin': 'round' });
  const tips = new Path();
  for (let a = 0; a < 6; a++) { const q = L.ap(L.compose(L.move(cx, cy), L.rotm(a * 60)), [R, 0]); tips.add(L.circlePath(q[0], q[1], R * 0.05)); }
  return s + path(tips, { fill: p.ink }) + circle(cx, cy, R * 0.06, { fill: p.ink });
};

const pieces = [
  {
    slug: 'stern', name: 'Stern', w: 800, h: 780, palettes: GLOW, fit: 16,
    tags: ['Stern', 'Sterne', 'Weihnachten', 'Auszeichnung', 'Bewertung', 'Silvester', 'einfach', 'facettiert'],
    draw(c) { return g({ fill: c.p.ink }, facetStar(400, 400, 380, 160, c.p)); },
  },
  {
    slug: 'funkeln', name: 'Funkelsterne', w: 800, h: 800, palettes: GLOW, fit: 16,
    tags: ['Funkeln', 'Glitzer', 'Sparkle', 'Glanz', 'Silvester', 'Weihnachten', 'Magie', 'Sterne'],
    draw(c) {
      const { p } = c;
      let s = path(L.sparkle(330, 440, 300, { squash: 0.1 }), {}) + path(L.sparkle(640, 190, 130, { squash: 0.1 }), {}) + path(L.sparkle(660, 600, 84, { squash: 0.22 }), {});
      s += circle(120, 160, 18, {}) + circle(560, 740, 12, {}) + circle(760, 380, 10, {}) + circle(150, 720, 9, {});
      return g({ fill: p.ink }, s);
    },
  },
  {
    slug: 'himmel', name: 'Sternenhimmel', w: 1000, h: 1000, palettes: ['gold', 'weiss', 'navy'],
    tags: ['Sternenhimmel', 'Sterne', 'Nacht', 'Himmel', 'Weihnachten', 'Silvester', 'Hintergrund', 'Streuung'],
    draw(c) {
      const { p, r } = c;
      const pts = L.scatter(r, { box: [40, 40, 960, 960], count: 90, minDist: 92 });
      const d1 = new Path(), d2 = new Path(), d3 = new Path();
      pts.forEach(([x, y], i) => {
        const k = i % 6;
        if (k === 0) d1.add(L.sparkle(x, y, r.range(34, 52), { squash: 0.2 }));
        else if (k === 1 || k === 2) d2.add(L.starPath(x, y, r.range(14, 24), 7, 5, r.range(-110, -70)));
        else d3.add(L.circlePath(x, y, r.range(4, 9)));
      });
      return g({ fill: p.ink }, path(d1, {}), path(d2, {}), path(d3, {}));
    },
  },
  {
    slug: 'kranz', name: 'Sternenkranz', w: 1000, h: 1000, palettes: GLOW, fit: 16,
    tags: ['Sternenkranz', 'Kranz', 'Sterne', 'Weihnachten', 'Advent', 'Rahmen', 'rund', 'Kreis'],
    draw(c) {
      const { p, r } = c;
      const d = new Path(), dots = new Path();
      const n = 36;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const big = i % 3 === 0;
        const rr = 400;
        const x = 500 + Math.cos(a) * rr, y = 500 + Math.sin(a) * rr;
        if (big) d.add(L.starPath(x, y, 44, 18, 5, deg(a) - 90 + 90));
        else if (i % 3 === 1) d.add(L.starPath(x, y, 24, 10, 5, -90 + r.range(-10, 10)));
        else dots.add(L.circlePath(x, y, 8));
      }
      return g({ fill: p.ink }, path(d, {}), path(dots, {}), path(L.circlePath(500, 500, 400), { fill: 'none', stroke: p.ink, 'stroke-width': 2.4, 'stroke-opacity': 0.7 }));
      function deg(a) { return a * 180 / Math.PI; }
    },
  },
  {
    slug: 'strahlen', name: 'Strahlenstern', w: 800, h: 800, palettes: ['gold', 'weiss', 'navy', 'schwarz'], fit: 16,
    tags: ['Strahlenstern', 'Strahlen', 'Stern', 'Glanz', 'Weihnachten', 'Retro', 'Burst', 'Funken'],
    draw(c) {
      const { p } = c;
      const d = new Path();
      for (let i = 0; i < 16; i++) {
        const long = i % 2 === 0;
        const a = (i / 16) * Math.PI * 2 - Math.PI / 2;
        const r1 = long ? 390 : 250, wid = rad(long ? 5 : 4);
        d.M(400 + Math.cos(a - wid) * 40, 400 + Math.sin(a - wid) * 40).L(400 + Math.cos(a) * r1, 400 + Math.sin(a) * r1).L(400 + Math.cos(a + wid) * 40, 400 + Math.sin(a + wid) * 40).Z();
      }
      return g({ fill: p.ink }, path(d, {}), path(L.circlePath(400, 400, 66), {}));
    },
  },
  {
    slug: 'sternschnuppe', name: 'Sternschnuppe', w: 1000, h: 560, palettes: ['gold', 'weiss', 'navy'], fit: 16,
    tags: ['Sternschnuppe', 'Wunsch', 'Komet', 'Stern', 'Nacht', 'Weihnachten', 'Kinder', 'Traum'],
    draw(c) {
      const { p } = c;
      let s = '';
      const tail = (off, w, len) => {
        const curve = new Curve([[820 - off * 0.2, 150 + off], [560, 230 + off * 0.9], [260, 340 + off * 0.7], [len, 410 + off * 0.5]]);
        return path(ribbon(curve, (t) => lerp(w, 0, Math.pow(t, 0.8)), { count: 28 }), { fill: p.ink, 'fill-opacity': off === 0 ? 1 : 0.55 });
      };
      s += tail(0, 30, 80) + tail(34, 14, 220) + tail(-30, 12, 300);
      s += path(L.sparkle(300, 150, 36, { squash: 0.1 }), {}) + path(L.sparkle(150, 300, 20, { squash: 0.1 }), {}) + path(L.sparkle(600, 480, 24, { squash: 0.1 }), {});
      s += circle(420, 90, 7, {}) + circle(120, 440, 8, {}) + circle(700, 40, 6, {});
      return g({ fill: p.ink }, s, facetStar(0, 0, 100, 42, p, -90, L.place(830, 150, -20, 1)));
    },
  },
  {
    slug: 'girlande', name: 'Sterngirlande', w: 1400, h: 400, palettes: ['gold', 'weiss', 'bunt', 'pastell'], fit: 20,
    tags: ['Sterne', 'Girlande', 'Sterngirlande', 'Weihnachten', 'Advent', 'Party', 'Kinder', 'hängend'],
    draw(c) {
      const { p, r } = c;
      const stringCol = p.mono ? p.tones[0] : '#6d6d78';
      const curve = new Curve(Array.from({ length: 13 }, (_, i) => { const t = i / 12; return [30 + t * 1340, 40 + 110 * Math.sin(Math.PI * t)]; }));
      let s = path(ribbon(curve, () => 3.4, { count: 40 }), { fill: stringCol });
      const n = 9;
      for (let i = 0; i < n; i++) {
        const q = curve.at((i + 0.5) / n);
        const sz = i % 2 ? 54 : 70;
        s += path(L.smooth([[q.p[0], q.p[1]], [q.p[0], q.p[1] + 34]]), { fill: 'none', stroke: stringCol, 'stroke-width': 2.8 });
        s += path(L.starPath(q.p[0], q.p[1] + 34 + sz, sz, sz * 0.45, 5, -90 + r.range(-8, 8)), { fill: p.mono ? p.ink : col(p, i) });
      }
      return s;
    },
  },
  {
    slug: 'schneeflocke-1', name: 'Schneeflocke fein', w: 700, h: 700, palettes: ['weiss', 'navy', 'gold'], fit: 16,
    tags: ['Schneeflocke', 'Winter', 'Weihnachten', 'Schnee', 'Eis', 'Advent', 'Kristall'],
    draw(c) { return snowflake(350, 350, 330, 0, c.p); },
  },
  {
    slug: 'schneeflocke-2', name: 'Schneeflocke verzweigt', w: 700, h: 700, palettes: ['weiss', 'navy', 'gold'], fit: 16,
    tags: ['Schneeflocke', 'Winter', 'Weihnachten', 'Schnee', 'Eis', 'Advent', 'Kristall'],
    draw(c) { return snowflake(350, 350, 330, 1, c.p); },
  },
  {
    slug: 'schneeflocke-3', name: 'Schneeflocke Kristall', w: 700, h: 700, palettes: ['weiss', 'navy', 'gold'], fit: 16,
    tags: ['Schneeflocke', 'Winter', 'Weihnachten', 'Schnee', 'Eis', 'Advent', 'Kristall'],
    draw(c) { return snowflake(350, 350, 330, 2, c.p); },
  },
  {
    slug: 'linie', name: 'Stern Linie', w: 760, h: 740, palettes: ['gold', 'schwarz', 'weiss', 'navy'], fit: 16,
    tags: ['Stern', 'Linie', 'Kontur', 'schlicht', 'Weihnachten', 'modern', 'Sterne'],
    draw(c) {
      const { p } = c;
      const st = { fill: 'none', stroke: p.ink, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' };
      return path(L.starPath(380, 390, 350, 150, 5, -90), { ...st, 'stroke-width': 12 }) + path(L.starPath(380, 390, 270, 116, 5, -90), { ...st, 'stroke-width': 4 });
    },
  },
];

module.exports = { name: 'Sterne', slug: 'sterne', tags: ['Stern', 'Sterne', 'Funkeln'], pieces };
