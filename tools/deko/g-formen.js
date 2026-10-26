'use strict';
// Group "Formen": organic blobs, arches, rings, brush strokes, clouds, moon, sun, rainbow, edges, mountains, watercolour.
const L = require('./lib');
const M = require('./motifs');
const { Curve, Path, g, path, circle, rad, lerp, place, ribbon, mix } = L;

const col = (p, i) => p.colors[i % p.colors.length];
const SOFT = ['rose', 'salbei', 'navy', 'gold', 'weiss'];

/** A blob: radius noise on a circle, smoothed. */
function blob(r, cx, cy, R, amp, lobes = 5) {
  const pts = [];
  const n = 14;
  const ph = Array.from({ length: 3 }, () => r.range(0, Math.PI * 2));
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 1 + amp * (0.55 * Math.sin(a * 2 + ph[0]) + 0.3 * Math.sin(a * 3 + ph[1]) + 0.2 * Math.sin(a * lobes + ph[2]));
    pts.push([cx + Math.cos(a) * R * k, cy + Math.sin(a) * R * k * 0.92]);
  }
  return L.smooth(pts, true);
}

/** A crescent: the circle (c1, R) without the circle (c2, r). */
function crescentPath(c1, R, c2, r) {
  const dx = c2[0] - c1[0], dy = c2[1] - c1[1], d = Math.hypot(dx, dy);
  const a = (R * R - r * r + d * d) / (2 * d), h = Math.sqrt(R * R - a * a);
  const px = c1[0] + (a * dx) / d, py = c1[1] + (a * dy) / d;
  const P1 = [px + (h * dy) / d, py - (h * dx) / d], P2 = [px - (h * dy) / d, py + (h * dx) / d];
  const ang = (c, P) => Math.atan2(P[1] - c[1], P[0] - c[0]) * 180 / Math.PI;
  const norm = (x) => ((x % 360) + 360) % 360;
  // the sweep from a0 to a1 (positive = clockwise on screen) that passes the angle mid
  const sweep = (a0, a1, mid) => { const cw = norm(a1 - a0); return norm(mid - a0) <= cw ? a0 + cw : a0 - norm(a0 - a1); };
  const midOuter = ang(c2, c1) + 0, midInner = ang(c2, c1);
  const a1s = ang(c1, P1), a2s = ang(c1, P2);
  const b1s = ang(c2, P1), b2s = ang(c2, P2);
  const p = new Path();
  p.arc(c1[0], c1[1], R, R, a1s, sweep(a1s, a2s, midOuter), true);
  p.arc(c2[0], c2[1], r, r, b2s, sweep(b2s, b1s, midInner));
  return p.Z();
}

const pieces = [
  ...[1, 2, 3].map((n) => ({
    slug: `blob-${n}`, name: `Blob ${n}`, w: 800, h: 760, palettes: n === 1 ? SOFT : ['rose', 'salbei', 'navy', 'gold'], fit: 12,
    tags: ['Blob', 'organisch', 'Form', 'Fleck', 'Hintergrund', 'modern', 'weich'],
    draw(c) {
      const { r, p } = c;
      if (n === 1) return path(blob(r, 400, 380, 340, 0.22, 5), { fill: p.ink });
      if (n === 2) return path(blob(r, 400, 380, 330, 0.3, 7).transform(L.compose(L.move(400, 380), L.scl(1.25, 0.78), L.move(-400, -380))), { fill: p.ink });
      return path(blob(r, 400, 380, 330, 0.12, 3), { fill: p.ink });
    },
  })),
  {
    slug: 'bogen', name: 'Bogen', w: 760, h: 980, palettes: SOFT, fit: 12,
    tags: ['Bogen', 'Arch', 'Fenster', 'Tür', 'Boho', 'Hintergrund', 'modern', 'Form'],
    draw(c) { return path(new Path().M(30, 960).L(30, 380).arc(380, 380, 350, 350, 180, 360).L(730, 960).Z(), { fill: c.p.ink }); },
  },
  {
    slug: 'bogen-doppelt', name: 'Bogen doppelt', w: 760, h: 980, palettes: ['rose', 'salbei', 'navy', 'gold'], fit: 12,
    tags: ['Bogen', 'Arch', 'doppelt', 'Fenster', 'Boho', 'Hintergrund', 'modern', 'Form'],
    draw(c) {
      const { p } = c;
      const arch = (inset, top) => new Path().M(inset, 960).L(inset, 380).arc(380, 380, 350 - (inset - 30), 350 - (inset - 30), 180, 360).L(760 - inset, 960).Z();
      return path(arch(30), { fill: p.ink }) + path(arch(100), { fill: p.accent }) + path(arch(170), { fill: p.ink, 'fill-opacity': 0.35 });
    },
  },
  {
    slug: 'pinselring', name: 'Pinselring', w: 800, h: 800, palettes: ['gold', 'schwarz', 'rose', 'navy', 'weiss'], fit: 12,
    tags: ['Ring', 'Kreis', 'Pinsel', 'Pinselstrich', 'handgemalt', 'Aquarell', 'Rahmen', 'rund', 'Form'],
    draw(c) {
      const { p, r } = c;
      const pts = [];
      const n = 40;
      for (let i = 0; i <= n; i++) { const a = rad(-60 + (i / n) * 345); pts.push([400 + Math.cos(a) * (310 + Math.sin(i * 0.5) * 8), 400 + Math.sin(a) * (310 + Math.sin(i * 0.5) * 8)]); }
      const curve = new Curve(pts);
      const main = ribbon(curve, (t) => 26 + 20 * Math.sin(Math.PI * Math.min(1, t * 1.15)) + 6 * Math.sin(t * 40) , { count: 70 });
      const thin = ribbon(new Curve(pts.map(([x, y]) => [400 + (x - 400) * 0.9, 400 + (y - 400) * 0.9])), (t) => 5 * Math.sin(Math.PI * t) ** 0.6, { count: 40 });
      return path(main, { fill: p.ink }) + path(thin, { fill: p.ink, 'fill-opacity': 0.6 });
    },
  },
  ...[1, 2].map((n) => ({
    slug: `pinsel-${n}`, name: `Pinselstrich ${n}`, w: 1200, h: 420, palettes: n === 1 ? ['gold', 'rose', 'salbei', 'navy', 'schwarz', 'weiss'] : ['rose', 'navy', 'gold', 'weiss'], fit: 12,
    tags: ['Pinsel', 'Pinselstrich', 'Strich', 'Farbstrich', 'handgemalt', 'Hintergrund', 'Banner', 'Titel', 'Form'],
    draw(c) {
      const { p, r } = c;
      const H = n === 1 ? 150 : 128;
      const x0 = 70, x1 = 900;
      const steps = 12;
      const top = [], bottom = [];
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = lerp(x0, x1, t);
        const yc = 210 + Math.sin(t * Math.PI * (n === 1 ? 1.1 : 1.7)) * (n === 1 ? 14 : 22) - t * (n === 1 ? 16 : 0);
        top.push([x, yc - H / 2 + r.jitter(5) + (i === 0 ? 8 : 0)]); bottom.push([x, yc + H / 2 + r.jitter(5) - (i === 0 ? 8 : 0)]);
      }
      // blunt, slightly ragged left end
      const shape = new Path().M(x0 - 6, top[0][1] + 14).L(x0 + 4, top[0][1] - 2).through(top).L(bottom[steps][0], bottom[steps][1]).through(bottom.slice().reverse()).L(x0 - 10, bottom[0][1] - 20).Z();
      let s = path(shape, { fill: p.ink });
      // dry bristles at the right end: strips of different length
      const rows = 9, gap = 3.2;
      const sh = (H - gap * (rows - 1)) / rows;
      for (let k = 0; k < rows; k++) {
        const y = top[steps][1] + k * (sh + gap) + r.jitter(1.5);
        const len = r.range(30, 250) * (k % 3 === 0 ? 0.55 : 1);
        s += path(L.rrect(x1 - 20, y + (bottom[steps][1] - top[steps][1] - H) / 2, len, sh, sh / 2), { fill: p.ink });
      }
      return s;
    },
  })),
  ...[1, 2].map((n) => ({
    slug: `wolke-${n}`, name: n === 1 ? 'Wolke' : 'Wolken', w: n === 1 ? 700 : 1100, h: n === 1 ? 420 : 520, palettes: n === 1 ? ['weiss', 'pastell', 'navy', 'rose'] : ['weiss', 'pastell', 'navy'], fit: 12,
    tags: ['Wolke', 'Wolken', 'Himmel', 'Wetter', 'Kinder', 'Baby', 'Traum', 'Form'],
    draw(c) {
      const { p } = c;
      const cloud = (x, y, k) => {
        const d = new Path().add(L.circlePath(x - 150 * k, y + 10 * k, 90 * k)).add(L.circlePath(x - 30 * k, y - 50 * k, 130 * k)).add(L.circlePath(x + 120 * k, y - 10 * k, 100 * k)).add(L.rrect(x - 240 * k, y + 10 * k, 480 * k, 96 * k, 48 * k));
        return d;
      };
      const color = p.mono ? p.ink : col(p, 3);
      if (n === 1) return path(cloud(350, 230, 1), { fill: color });
      return path(cloud(380, 230, 1.05), { fill: color }) + path(cloud(800, 380, 0.62), { fill: color, 'fill-opacity': 0.8 }) + path(cloud(170, 400, 0.45), { fill: color, 'fill-opacity': 0.65 });
    },
  })),
  {
    slug: 'mond', name: 'Mond und Sterne', w: 700, h: 700, palettes: ['gold', 'weiss', 'navy', 'schwarz'], fit: 12,
    tags: ['Mond', 'Halbmond', 'Nacht', 'Sterne', 'Schlaf', 'Baby', 'Traum', 'Weihnachten', 'Form'],
    draw(c) {
      const { p } = c;
      // the inner arc is drawn back: build the crescent by two arcs between the same horns
      const crescent = crescentPath([330, 370], 290, [440, 330], 250);
      return g({ fill: p.ink }, path(crescent, {}), path(L.sparkle(560, 200, 56, { squash: 0.1 }), {}), path(L.sparkle(470, 420, 34, { squash: 0.1 }), {}), circle(600, 360, 10, {}), circle(520, 90, 8, {}));
    },
  },
  {
    slug: 'sonne', name: 'Sonne', w: 760, h: 760, palettes: ['gold', 'bunt', 'pastell'], fit: 12,
    tags: ['Sonne', 'Sonnenschein', 'Sommer', 'Urlaub', 'Kinder', 'Wetter', 'Strahlen', 'Form'],
    draw(c) {
      const { p } = c;
      const cx = 380, cy = 380;
      const body = p.mono ? p.ink : '#ffb627';
      const rays = new Path();
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        const long = i % 2 === 0;
        rays.add(L.rrect(-16, -(long ? 56 : 40), 32, long ? 112 : 80, 16).transform(L.compose(L.move(cx + Math.cos(a) * 296, cy + Math.sin(a) * 296), L.rotm(deg(a) + 90))));
      }
      function deg(a) { return a * 180 / Math.PI; }
      return path(rays, { fill: p.mono ? p.ink : '#ffb627' }) + path(L.circlePath(cx, cy, 200), { fill: body }) + path(L.circlePath(cx, cy, 200), { fill: '#ffffff', 'fill-opacity': 0.0 });
    },
  },
  {
    slug: 'regenbogen', name: 'Regenbogen', w: 1000, h: 540, palettes: ['bunt', 'pastell', 'boho'], fit: 12,
    tags: ['Regenbogen', 'Bogen', 'Kinder', 'Baby', 'Himmel', 'Boho', 'Pride', 'Form'],
    draw(c) {
      const { p } = c;
      let s = '';
      const n = p.id === 'boho' ? 5 : 6;
      for (let k = 0; k < n; k++) {
        const rr = 470 - k * 62;
        s += path(new Path().arc(500, 500, rr, rr, 180, 360, true).L(500 + rr - 62 + 1, 500).arc(500, 500, rr - 62 + 1, rr - 62 + 1, 360, 180).Z(), { fill: col(p, k) });
      }
      return s;
    },
  },
  {
    slug: 'wellenrand', name: 'Wellenrand', w: 1414, h: 320, palettes: ['salbei', 'rose', 'navy', 'gold', 'weiss'],
    tags: ['Wellenrand', 'Welle', 'Rand', 'Kante', 'Abschluss', 'Hintergrund', 'Wiese', 'Meer', 'Form', 'unten'],
    draw(c) {
      const { p } = c;
      const pts = [];
      for (let i = 0; i <= 14; i++) pts.push([i * 101, 90 + Math.sin(i * 0.9) * 46 + Math.cos(i * 0.4) * 24]);
      const shape = L.smooth(pts).L(1414, 320).L(0, 320).Z();
      return path(shape, { fill: p.ink }) + path(L.smooth(pts.map(([x, y]) => [x, y + 46])).L(1414, 320).L(0, 320).Z(), { fill: p.ink === 'url(#g)' ? '#6e4a12' : '#000000', 'fill-opacity': 0.14 });
    },
  },
  {
    slug: 'bogenrand', name: 'Bogenrand', w: 1414, h: 240, palettes: ['rose', 'navy', 'gold', 'pastell', 'weiss'],
    tags: ['Bogenrand', 'Bögen', 'Girlande', 'Rand', 'Kante', 'Abschluss', 'Zirkus', 'Kinder', 'Form', 'unten'],
    draw(c) {
      const { p } = c;
      const d = new Path().M(0, 240).L(0, 110);
      const n = 12, w = 1414 / n;
      for (let i = 0; i < n; i++) d.arc(w * i + w / 2, 110, w / 2, w / 2 * 0.9, 180, 360, false);
      d.L(1414, 240).Z();
      const parts = [];
      return path(d, { fill: p.mono ? p.ink : col(p, 0) });
    },
  },
  {
    slug: 'zackenrand', name: 'Zackenrand', w: 1414, h: 220, palettes: ['rose', 'navy', 'gold', 'bunt'],
    tags: ['Zackenrand', 'Zacken', 'Rand', 'Kante', 'Abschluss', 'Zick-Zack', 'Kinder', 'Form', 'unten'],
    draw(c) {
      const { p } = c;
      const pts = [[0, 220]];
      const n = 22;
      for (let i = 0; i <= n; i++) pts.push([(i * 1414) / n, i % 2 ? 100 : 40]);
      pts.push([1414, 220]);
      return path(L.poly(pts, true), { fill: p.mono ? p.ink : col(p, 1) });
    },
  },
  {
    slug: 'berge', name: 'Berge', w: 1200, h: 520, palettes: ['navy', 'salbei', 'schwarz', 'rose', 'weiss'], fit: 12,
    tags: ['Berge', 'Gebirge', 'Berg', 'Landschaft', 'Outdoor', 'Wandern', 'Abenteuer', 'Camping', 'Form'],
    draw(c) {
      const { p } = c;
      const back = L.poly([[0, 520], [0, 330], [180, 170], [300, 300], [470, 60], [660, 320], [760, 230], [960, 420], [1100, 250], [1200, 330], [1200, 520]], true);
      const front = L.poly([[0, 520], [0, 420], [200, 300], [380, 440], [560, 260], [760, 450], [940, 340], [1200, 470], [1200, 520]], true);
      return path(back, { fill: p.ink, 'fill-opacity': 0.55 }) + path(front, { fill: p.ink });
    },
  },
  {
    slug: 'aquarell', name: 'Aquarellfleck', w: 900, h: 760, palettes: ['rose', 'salbei', 'navy', 'gold', 'pastell'], fit: 12,
    tags: ['Aquarell', 'Farbfleck', 'Wash', 'Hintergrund', 'zart', 'Hochzeit', 'Boho', 'weich', 'Form'],
    draw(c) {
      const { p, r } = c;
      let s = '';
      const base = p.mono ? p.accent === p.ink ? p.ink : p.ink : null;
      const tones = p.mono ? [p.ink, p.tones[1], p.tones[2]] : [p.colors[0], p.colors[3], p.colors[1]];
      [[430, 380, 330, 0.34], [300, 330, 250, 0.3], [560, 420, 240, 0.3], [430, 420, 160, 0.28]].forEach(([x, y, R, op], i) => {
        s += path(blob(r, x, y, R, 0.26, 5), { fill: tones[i % tones.length], 'fill-opacity': op });
      });
      return s;
    },
  },
];

module.exports = { name: 'Formen', slug: 'formen', tags: ['Form', 'Hintergrund', 'Deko'], pieces };
