'use strict';
// Group "Herzen": solid and outline hearts, wreath, scatter, garland, arrow, frame.
const L = require('./lib');
const M = require('./motifs');
const { Curve, Path, g, path, circle, rad, lerp, place, leaf, ribbon, heartPts, heart } = L;

const col = (p, i) => p.colors[i % p.colors.length];
const LOVE = ['rose', 'gold', 'bordeaux', 'schwarz', 'weiss'];

const pieces = [
  {
    slug: 'voll', name: 'Herz', w: 800, h: 740, palettes: LOVE, fit: 16,
    tags: ['Herz', 'Liebe', 'Valentinstag', 'Hochzeit', 'Muttertag', 'Romantik', 'einfach'],
    draw(c) {
      const { p } = c;
      return path(heart(400, 370, 700), { fill: p.ink }) + path(L.ellipsePath(250, 240, 50, 105, 38), { fill: '#ffffff', 'fill-opacity': p.id === 'weiss' ? 0 : 0.22 });
    },
  },
  {
    slug: 'linie', name: 'Herz Linie', w: 800, h: 740, palettes: LOVE, fit: 16,
    tags: ['Herz', 'Liebe', 'Valentinstag', 'Hochzeit', 'Kontur', 'Linie', 'schlicht', 'modern'],
    draw(c) {
      const { p } = c;
      return path(heart(400, 370, 690), { fill: 'none', stroke: p.ink, 'stroke-width': 11, 'stroke-linejoin': 'round' });
    },
  },
  {
    slug: 'doppelt', name: 'Zwei Herzen', w: 1000, h: 860, palettes: LOVE, fit: 16,
    tags: ['Herzen', 'zwei Herzen', 'Paar', 'Liebe', 'Hochzeit', 'Verlobung', 'Valentinstag', 'verschlungen'],
    draw(c) {
      const { p } = c;
      const a = heart(0, 0, 560).transform(L.compose(L.move(400, 430), L.rotm(-14)));
      const b = heart(0, 0, 560).transform(L.compose(L.move(600, 400), L.rotm(14)));
      const st = { fill: 'none', stroke: p.ink, 'stroke-width': 10, 'stroke-linejoin': 'round' };
      return path(a, st) + path(b, { ...st, 'stroke-opacity': 1 }) + path(L.heart(0, 0, 170).transform(L.compose(L.move(500, 420), L.rotm(0))), { fill: p.ink, 'fill-opacity': 0.18 });
    },
  },
  {
    slug: 'kranz', name: 'Herzkranz', w: 1000, h: 940, palettes: ['gold', 'rose', 'salbei', 'navy', 'weiss'], fit: 20,
    tags: ['Herz', 'Kranz', 'Lorbeer', 'Blätter', 'Hochzeit', 'Liebe', 'Rahmen', 'Valentinstag'],
    draw(c) {
      const { p, r } = c;
      const right = heartPts(500, 470, 640, Math.PI - 0.22, 0.3, 22);
      const left = right.map(([x, y]) => [1000 - x, y]);
      const mk = (pts) => M.laurelBranch(new Curve(pts), p, r, { n: 13, len0: 88, len1: 54, stemW: 7, t0: 0.04 });
      return g({ fill: p.leaf }, mk(right), mk(left));
    },
  },
  {
    slug: 'streuung', name: 'Herzchen Streuung', w: 1000, h: 1000, bleed: true, palettes: ['rose', 'bunt', 'pastell', 'gold'],
    tags: ['Herzen', 'Herzchen', 'Streuung', 'Liebe', 'Valentinstag', 'Hochzeit', 'Kinder', 'Hintergrund'],
    draw(c) {
      const { p, r } = c;
      const pts = L.scatter(r, { box: [50, 50, 950, 950], count: 60, minDist: 118 });
      c.defs.push(path(heart(0, 0, 100), { id: 'h' }));
      return pts.map(([x, y], i) => L.useAt('h', x, y, { rot: r.range(-28, 28), s: r.range(0.56, 1), fill: p.mono ? p.tones[i % 3] : col(p, i) })).join('');
    },
  },
  {
    slug: 'girlande', name: 'Herzgirlande', w: 1400, h: 380, palettes: ['rose', 'bunt', 'pastell', 'gold'], fit: 20,
    tags: ['Herzen', 'Girlande', 'Hochzeit', 'Valentinstag', 'Liebe', 'Muttertag', 'Wimpelkette'],
    draw(c) {
      const { p } = c;
      const curve = new Curve(Array.from({ length: 13 }, (_, i) => { const t = i / 12; return [30 + t * 1340, 40 + 110 * Math.sin(Math.PI * t)]; }));
      let s = path(ribbon(curve, () => 4, { count: 40 }), { fill: p.mono ? p.tones[0] : '#6d6d78' });
      const n = 9;
      for (let i = 0; i < n; i++) {
        const q = curve.at((i + 0.5) / n);
        const rot = q.angle * 0.7;
        const hx = q.p[0], hy = q.p[1] + 36;
        s += path(L.smooth([[hx, q.p[1]], [hx, hy - 10]]), { fill: 'none', stroke: p.mono ? p.tones[0] : '#6d6d78', 'stroke-width': 3 });
        s += path(heart(0, 0, 110).transform(place(hx, hy + 52, rot, 1)), { fill: p.mono ? p.tones[i % 3] : col(p, i) });
      }
      return s;
    },
  },
  {
    slug: 'pfeil', name: 'Herz mit Pfeil', w: 1000, h: 900, palettes: ['rose', 'gold', 'bordeaux', 'schwarz'], fit: 20,
    tags: ['Herz', 'Pfeil', 'Amor', 'Liebe', 'Valentinstag', 'Verlobung', 'Cupido'],
    draw(c) {
      const { p } = c;
      let s = path(heart(500, 470, 640), { fill: p.ink }) + path(L.ellipsePath(350, 340, 44, 90, 38), { fill: '#ffffff', 'fill-opacity': p.id === 'weiss' ? 0 : 0.22 });
      const shaft = p.mono ? p.tones[0] : '#6d6d78';
      const dark = p.id === 'schwarz' ? '#4b4b4b' : shaft;
      // the arrow goes behind the heart: a tail with feathers at the upper left, the head at the lower right
      s += path(ribbon([[130, 130], [300, 300]], () => 12, { count: 4, ends: 'flat' }), { fill: dark });
      s += path(ribbon([[690, 620], [860, 780]], () => 12, { count: 4, ends: 'flat' }), { fill: dark });
      s += path(L.poly([[905, 825], [830.7, 790.3], [870.3, 750.7]], true), { fill: dark });
      for (const k of [0, 1, 2]) {
        const bx = 130 + k * 36, by = 130 + k * 36;
        s += path(L.poly([[bx, by], [bx - 60, by - 14], [bx - 28, by + 28]], true), { fill: dark });
      }
      return s;
    },
  },
  {
    slug: 'skizze', name: 'Herz gezeichnet', w: 800, h: 740, palettes: ['schwarz', 'gold', 'rose', 'weiss'], fit: 20,
    tags: ['Herz', 'handgezeichnet', 'skizziert', 'Kritzel', 'Liebe', 'Doodle', 'Valentinstag'],
    draw(c) {
      const { p, r } = c;
      const pass = (rot, sc, amp) => {
        const pts = heartPts(0, 0, 640 * sc, 0.05, Math.PI * 2 - 0.02, 40).map(([x, y], i) => [x + Math.sin(i * 0.6 + rot) * amp + r.jitter(2), y + Math.cos(i * 0.5) * amp + r.jitter(2)]);
        return L.smooth(pts).transform(L.compose(L.move(400, 370), L.rotm(rot)));
      };
      const st = { fill: 'none', stroke: p.ink, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
      return path(pass(-2, 1, 5), { ...st, 'stroke-width': 8 }) + path(pass(3, 0.98, 6), { ...st, 'stroke-width': 4.6, 'stroke-opacity': 0.8 });
    },
  },
  {
    slug: 'rahmen', name: 'Herzrahmen', w: 1000, h: 940, palettes: ['gold', 'rose', 'navy', 'weiss'], fit: 20,
    tags: ['Herz', 'Rahmen', 'Herzrahmen', 'Liebe', 'Hochzeit', 'Foto', 'Valentinstag', 'Muttertag'],
    draw(c) {
      const { p } = c;
      const beads = new Path();
      const ring = new Curve(heartPts(500, 470, 760, 0, Math.PI * 2, 64));
      for (let i = 0; i < 56; i++) { const q = ring.at(i / 56).p; beads.add(L.circlePath(q[0], q[1], 6)); }
      return path(heart(500, 470, 700), { fill: 'none', stroke: p.ink, 'stroke-width': 9, 'stroke-linejoin': 'round' })
        + path(heart(500, 470, 640), { fill: 'none', stroke: p.ink, 'stroke-width': 2.6 }) + path(beads, { fill: p.ink });
    },
  },
  {
    slug: 'ballon', name: 'Herzballon', w: 560, h: 1000, palettes: ['rose', 'bunt', 'pastell', 'gold'], fit: 20,
    tags: ['Herz', 'Ballon', 'Herzballon', 'Liebe', 'Valentinstag', 'Hochzeit', 'Party', 'Luftballon'],
    draw(c) {
      const { p } = c;
      const color = p.mono ? p.ink : col(p, 0);
      const str = p.mono ? p.tones[0] : '#6d6d78';
      let s = path(L.smooth([[280, 520], [250, 640], [315, 780], [270, 950]]), { fill: 'none', stroke: str, 'stroke-width': 3.2, 'stroke-linecap': 'round' });
      s += path(heart(280, 260, 480), { fill: color });
      s += path(L.ellipsePath(170, 170, 26, 62, 36), { fill: '#ffffff', 'fill-opacity': 0.45 });
      s += path(L.poly([[262, 530], [298, 530], [280, 506]], true), { fill: color });
      return s;
    },
  },
];

module.exports = { name: 'Herzen', slug: 'herzen', tags: ['Herz', 'Liebe', 'Romantik'], pieces };
