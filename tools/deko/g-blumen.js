'use strict';
// Group "Blumen & Blätter": wreaths, branches, single flowers, leaves.
const L = require('./lib');
const M = require('./motifs');
const { Curve, Path, g, path, circle, rad, lerp, clamp, place, leaf } = L;

const ALL6 = ['gold', 'rose', 'salbei', 'navy', 'schwarz', 'weiss'];
const FIVE = ['gold', 'salbei', 'navy', 'schwarz', 'weiss'];
const FOUR = ['gold', 'navy', 'schwarz', 'weiss'];
const FLORAL = ['rose', 'gold', 'navy', 'weiss'];

/** Two branches that grow from the bottom of an ellipse up both sides (gap at the top). */
function wreathSpines(cx, cy, rx, ry, gap = 24, start = 98) {
  const right = new Curve(M.arcPts(cx, cy, rx, ry, start, -90 + gap, 12));
  const left = new Curve(M.arcPts(cx, cy, rx, ry, 180 - start, 270 - gap, -12));
  return [left, right];
}
const mirrorPts = (pts, w) => pts.map(([x, y]) => [w - x, y]);

/** A flower on a short stem with a few leaves: the head at (400, 330). */
function flowerSpray(c, kind, { R = 190, tones } = {}) {
  const { p, r } = c;
  const x = 400, y = 330;
  let s = '';
  s += path(M.stem([[404, 790], [396, 640], [404, 520], [x, y + R * 0.5]], 10, 6), { fill: p.leaf });
  const specs = [[-150, 300, 0.22, [398, 700]], [-32, 270, 0.22, [402, 640]], [-118, 200, 0.2, [400, 560]], [-62, 190, 0.2, [402, 575]]];
  specs.forEach(([a, len, wr, base], i) => {
    const lf = leaf(len, len * wr, { belly: 0.42, sharp: 0.75, asym: r.jitter(0.08), tip: i % 2 ? -0.2 : 0.2, bend: (i % 2 ? 1 : -1) * 0.06 });
    s += g({ fill: p.leaf }, M.leafEl(lf, place(base[0], base[1], a, 1, a < -90), p, { flip: a >= -90 }));
  });
  s += M.flower(kind, x, y, R, p, r, { rot: r.range(0, 30), tones });
  return s;
}

const pieces = [
  {
    slug: 'lorbeerkranz', name: 'Lorbeerkranz', w: 1000, h: 1000, palettes: ALL6, fit: 20,
    tags: ['Lorbeer', 'Kranz', 'Hochzeit', 'Urkunde', 'Sieger', 'Rahmen', 'rund', 'Auszeichnung'],
    draw(c) {
      const [a, b] = wreathSpines(500, 500, 330, 330, 22, 100);
      return g({ fill: c.p.leaf }, M.laurelBranch(a, c.p, c.r, { n: 12, len0: 94, len1: 56 }), M.laurelBranch(b, c.p, c.r, { n: 12, len0: 94, len1: 56 }));
    },
  },
  {
    slug: 'lorbeerzweig', name: 'Lorbeerzweig', w: 1200, h: 500, palettes: ALL6, fit: 20,
    tags: ['Lorbeer', 'Zweig', 'Ast', 'Urkunde', 'Hochzeit', 'schmal'],
    draw(c) {
      const curve = new Curve([[90, 430], [330, 420], [610, 350], [890, 215], [1110, 80]]);
      return g({ fill: c.p.leaf }, M.laurelBranch(curve, c.p, c.r, { n: 13, len0: 96, len1: 56 }));
    },
  },
  {
    slug: 'lorbeerbogen', name: 'Lorbeerbogen', w: 1000, h: 600, palettes: FOUR, fit: 20,
    tags: ['Lorbeer', 'Bogen', 'Urkunde', 'Auszeichnung', 'Sieger', 'Unterlage'],
    draw(c) {
      const pts = [[500, 566], [650, 554], [800, 486], [895, 360], [930, 190]];
      const a = new Curve(pts), b = new Curve(mirrorPts(pts, 1000));
      return g({ fill: c.p.leaf }, M.laurelBranch(a, c.p, c.r, { n: 11, len0: 88, len1: 54, t0: 0.12 }), M.laurelBranch(b, c.p, c.r, { n: 11, len0: 88, len1: 54, t0: 0.12 }));
    },
  },
  {
    slug: 'eukalyptuszweig', name: 'Eukalyptuszweig', w: 640, h: 1200, palettes: ALL6, fit: 20,
    tags: ['Eukalyptus', 'Zweig', 'Hochzeit', 'Boho', 'Natur', 'Grün'],
    draw(c) {
      const curve = new Curve([[300, 1150], [250, 900], [360, 650], [290, 380], [340, 70]]);
      return g({ fill: c.p.leaf }, M.eucalyptusStem(curve, c.p, c.r, { n: 17, len0: 118, len1: 54 }));
    },
  },
  {
    slug: 'eukalyptuskranz', name: 'Eukalyptuskranz', w: 1000, h: 1000, palettes: FOUR.concat(['salbei']), fit: 20,
    tags: ['Eukalyptus', 'Kranz', 'Hochzeit', 'Boho', 'rund', 'Natur'],
    draw(c) {
      const [a, b] = wreathSpines(500, 500, 335, 335, 26, 100);
      return g({ fill: c.p.leaf }, M.eucalyptusStem(a, c.p, c.r, { n: 15, len0: 100, len1: 56 }), M.eucalyptusStem(b, c.p, c.r, { n: 15, len0: 100, len1: 56 }));
    },
  },
  {
    slug: 'olivenzweig', name: 'Olivenzweig', w: 1200, h: 520, palettes: FIVE, fit: 20,
    tags: ['Olive', 'Olivenzweig', 'Zweig', 'Frieden', 'Hochzeit', 'Mediterran', 'Restaurant'],
    draw(c) {
      const curve = new Curve([[90, 420], [350, 430], [640, 340], [900, 220], [1110, 150]]);
      return g({ fill: c.p.leaf }, M.oliveBranch(curve, c.p, c.r, { n: 16, len0: 120, len1: 70, olives: 6 }));
    },
  },
  {
    slug: 'olivenkranz', name: 'Olivenkranz', w: 1000, h: 1000, palettes: ['gold', 'salbei', 'navy', 'weiss'], fit: 20,
    tags: ['Olive', 'Kranz', 'Mediterran', 'Hochzeit', 'rund', 'Frieden'],
    draw(c) {
      const [a, b] = wreathSpines(500, 500, 330, 330, 24, 100);
      return g({ fill: c.p.leaf }, M.oliveBranch(a, c.p, c.r, { n: 16, len0: 108, len1: 66, olives: 4 }), M.oliveBranch(b, c.p, c.r, { n: 16, len0: 108, len1: 66, olives: 4 }));
    },
  },
  {
    slug: 'farnwedel', name: 'Farnwedel', w: 700, h: 1200, palettes: ['salbei', 'gold', 'schwarz', 'weiss'], fit: 20,
    tags: ['Farn', 'Wedel', 'Wald', 'Natur', 'Boho', 'Pflanze'],
    draw(c) {
      const curve = new Curve([[330, 1160], [300, 900], [380, 640], [350, 360], [430, 90]]);
      return g({ fill: c.p.leaf }, M.fernFrond(curve, c.p, c.r, { n: 22, maxLen: 130, wid: 0.14, stemW: 7 }));
    },
  },
  {
    slug: 'palmwedel', name: 'Palmwedel', w: 1200, h: 800, palettes: ['salbei', 'gold', 'schwarz', 'weiss'], fit: 20,
    tags: ['Palme', 'Palmwedel', 'Tropisch', 'Sommer', 'Urlaub', 'Boho'],
    draw(c) {
      const curve = new Curve([[90, 700], [330, 380], [640, 250], [950, 290], [1140, 470]]);
      return g({ fill: c.p.leaf }, M.fernFrond(curve, c.p, c.r, { n: 24, maxLen: 190, wid: 0.07, stemW: 9 }));
    },
  },
  {
    slug: 'tannenzweig', name: 'Tannenzweig', w: 1200, h: 520, palettes: ['salbei', 'gold', 'navy', 'weiss'], fit: 20,
    tags: ['Tanne', 'Tannenzweig', 'Weihnachten', 'Advent', 'Winter', 'Nadeln'],
    draw(c) {
      const curve = new Curve([[60, 430], [380, 400], [700, 320], [980, 210], [1140, 140]]);
      return g({ fill: c.p.leaf }, M.firBranch(curve, c.p, c.r, { twigs: 9, sideLen0: 270, sideLen1: 100, needle0: 74, needle1: 44, wid: 0.12, per: 24 }));
    },
  },
  {
    slug: 'margerite', name: 'Margerite', w: 800, h: 800, palettes: FLORAL, fit: 24,
    tags: ['Margerite', 'Gänseblümchen', 'Blume', 'Sommer', 'Wiese', 'Frühling', 'Geburtstag'],
    draw(c) { return flowerSpray(c, 'daisy', { R: 210 }); },
  },
  {
    slug: 'pfingstrose', name: 'Pfingstrose', w: 800, h: 800, palettes: FLORAL, fit: 24,
    tags: ['Pfingstrose', 'Pfingstrosen', 'Pfingstrosenblüte', 'Blume', 'Hochzeit', 'Muttertag', 'Geburtstag', 'Blüte'],
    draw(c) { return flowerSpray(c, 'peony', { R: 220 }); },
  },
  {
    slug: 'anemone', name: 'Anemone', w: 800, h: 800, palettes: FLORAL, fit: 24,
    tags: ['Anemone', 'Mohn', 'Blume', 'Frühling', 'Sommer', 'Blüte'],
    draw(c) { return flowerSpray(c, 'anemone', { R: 200 }); },
  },
  {
    slug: 'rose', name: 'Rose', w: 800, h: 800, palettes: FLORAL, fit: 24,
    tags: ['Rose', 'Rosenblüte', 'Blume', 'Liebe', 'Valentinstag', 'Hochzeit', 'Muttertag', 'Blüte'],
    draw(c) { return flowerSpray(c, 'rose', { R: 220 }); },
  },
  {
    slug: 'kirschblueten', name: 'Kirschblütenzweig', w: 1200, h: 700, palettes: ['rose', 'weiss', 'gold', 'navy'], fit: 24,
    tags: ['Kirschblüte', 'Kirschblüten', 'Blüten', 'Zweig', 'Frühling', 'Ostern', 'Japan', 'Hochzeit'],
    draw(c) {
      const { p, r } = c;
      const main = new Curve([[60, 600], [300, 560], [560, 460], [820, 320], [1120, 200]]);
      let s = path(M.stem(main, 20, 4), { fill: p.tones[0] });
      const twigs = [[0.22, -1, 170], [0.4, 1, 190], [0.55, -1, 210], [0.72, 1, 160], [0.88, -1, 120]];
      const blossoms = [];
      for (const [t, side, len] of twigs) {
        const { p: pt, angle } = main.at(t);
        const a = rad(angle + side * 42);
        const mid = [pt[0] + Math.cos(a) * len * 0.5, pt[1] + Math.sin(a) * len * 0.5 - 14];
        const end = [pt[0] + Math.cos(a - side * 0.35) * len, pt[1] + Math.sin(a - side * 0.35) * len - 20];
        s += path(M.stem([pt, mid, end], 10, 3), { fill: p.tones[0] });
        blossoms.push([end[0], end[1], 62 + r.jitter(8)]);
        blossoms.push([mid[0] + r.jitter(8), mid[1] + (side * 30), 54 + r.jitter(6)]);
      }
      for (const t of [0.3, 0.62, 0.95]) {
        const { p: pt } = main.at(t);
        blossoms.push([pt[0] + r.jitter(12), pt[1] - 10, 56 + r.jitter(6)]);
      }
      blossoms.push([1130, 190, 66]);
      // buds
      for (let i = 0; i < 7; i++) {
        const q = blossoms[r.int(0, blossoms.length - 1)];
        const a = r.range(0, Math.PI * 2);
        const bx = q[0] + Math.cos(a) * 84, by = q[1] + Math.sin(a) * 84;
        s += path(M.stem([[q[0] + Math.cos(a) * 30, q[1] + Math.sin(a) * 30], [bx, by]], 3, 2), { fill: p.tones[0] });
        s += circle(bx, by, 15 + r.jitter(2), { fill: p.tones[1] });
      }
      blossoms.forEach(([x, y, R], i) => { s += M.flower('blossom', x, y, R, p, r, { rot: r.range(0, 72), i }); });
      return s;
    },
  },
  {
    slug: 'weizenaehren', name: 'Weizenähren', w: 900, h: 1200, palettes: ['gold', 'schwarz', 'weiss', 'salbei'], fit: 24,
    tags: ['Weizen', 'Ähre', 'Ähren', 'Getreide', 'Ernte', 'Erntedank', 'Herbst', 'Bäckerei', 'Brot', 'rustikal'],
    draw(c) {
      const { p, r } = c;
      let s = '';
      const stalks = [[-17, 0.96], [0, 1], [17, 0.92]];
      const ear = (x0, y0, ang, len) => {
        const grains = new Path();
        const awns = new Path();
        const cnt = 9;
        const axis = (t) => [x0 + Math.cos(rad(ang)) * len * t, y0 + Math.sin(rad(ang)) * len * t];
        for (let i = 0; i < cnt; i++) {
          const t = lerp(0.02, 0.9, i / (cnt - 1));
          const [px, py] = axis(t);
          const gl = lerp(58, 40, t);
          for (const side of [-1, 1]) {
            const a = ang + side * (22 + r.jitter(3));
            grains.add(leaf(gl, gl * 0.27, { belly: 0.45, sharp: 0.6, asym: side * 0.05 }).whole.transform(place(px, py, a, 1)));
            const tipx = px + Math.cos(rad(a)) * gl, tipy = py + Math.sin(rad(a)) * gl;
            const aw = lerp(95, 60, t);
            awns.M(tipx, tipy).L(tipx + Math.cos(rad(ang + side * 9)) * aw, tipy + Math.sin(rad(ang + side * 9)) * aw);
          }
        }
        const [tx, ty] = axis(0.9);
        grains.add(leaf(44, 12, { belly: 0.45, sharp: 0.6 }).whole.transform(place(tx, ty, ang, 1)));
        return path(awns, { fill: 'none', stroke: p.leaf, 'stroke-width': 2.4, 'stroke-linecap': 'round' }) + path(grains, {});
      };
      for (const [dA, sc] of stalks) {
        const a = -90 + dA;
        const base = [450, 1160];
        const len = 700 * sc;
        const dir = [Math.cos(rad(a)), Math.sin(rad(a))];
        const end = [base[0] + dir[0] * len, base[1] + dir[1] * len];
        const mid = [base[0] + dir[0] * len * 0.5 + dA * -0.7, base[1] + dir[1] * len * 0.5];
        s += path(M.stem([base, mid, end], 9, 6), {});
        s += ear(end[0], end[1], a + dA * 0.15, 330 * sc);
      }
      // a long leaf blade on each side
      for (const side of [-1, 1]) {
        s += g({ fill: p.leaf }, M.leafEl(leaf(520, 26, { belly: 0.3, sharp: 0.9, bend: side * 0.18 }), place(450, 1160, -90 + side * 22, 1, side < 0), p, { flip: side > 0 }));
      }
      return g({ fill: p.leaf }, s);
    },
  },
  {
    slug: 'lavendel', name: 'Lavendel', w: 800, h: 1200, palettes: ['navy', 'rose', 'schwarz', 'weiss', 'gold'], fit: 24,
    tags: ['Lavendel', 'Blüte', 'Provence', 'Sommer', 'Wiese', 'Kräuter', 'Hochzeit'],
    draw(c) {
      const { p, r } = c;
      let s = '';
      const stems = [[-13, 1010], [1, 1110], [13, 950]];
      const buds = new Path();
      for (const [dA, len] of stems) {
        const a = rad(-90 + dA);
        const base = [400 - dA * 3, 1170];
        const end = [base[0] + Math.cos(a) * len, base[1] + Math.sin(a) * len];
        const curve = new Curve([base, [base[0] + (end[0] - base[0]) * 0.5 + dA * 2.2, base[1] + (end[1] - base[1]) * 0.5], end]);
        s += path(M.stem(curve, 7, 3), { fill: p.tones[0] });
        const cnt = 12;
        for (let i = 0; i < cnt; i++) {
          const t = lerp(0.52, 0.985, i / (cnt - 1));
          const { p: pt, angle } = curve.at(t);
          const bl = lerp(64, 36, (t - 0.52) / 0.48);
          for (const side of [-1, 1]) buds.add(leaf(bl, bl * 0.26, { belly: 0.55, sharp: 0.25 }).whole.transform(place(pt[0], pt[1], angle + side * (34 + r.jitter(5)), 1)));
          buds.add(leaf(bl * 0.9, bl * 0.23, { belly: 0.55, sharp: 0.25 }).whole.transform(place(pt[0], pt[1], angle + r.jitter(8), 1)));
        }
        const tip = curve.at(1);
        buds.add(leaf(40, 10, { belly: 0.55, sharp: 0.25 }).whole.transform(place(tip.p[0], tip.p[1], tip.angle, 1)));
      }
      s += path(buds, { fill: p.ink });
      s += path(L.rrect(352, 1000, 96, 34, 12), { fill: p.ink }) + path(L.rrect(352, 1000, 96, 34, 12), { fill: '#000000', 'fill-opacity': 0.14 });
      return s;
    },
  },
  {
    slug: 'schleierkraut', name: 'Schleierkraut', w: 1200, h: 900, palettes: ['weiss', 'gold', 'rose', 'navy'], fit: 24,
    tags: ['Schleierkraut', 'Gypsophila', 'Blüten', 'zart', 'Hochzeit', 'Boho', 'Trockenblumen'],
    draw(c) {
      const { p, r } = c;
      const stems = new Path();
      const dots = [];
      const grow = (x, y, ang, len, depth) => {
        const ex = x + Math.cos(rad(ang)) * len, ey = y + Math.sin(rad(ang)) * len;
        const bend = r.jitter(12);
        const mx = x + Math.cos(rad(ang + bend)) * len * 0.5, my = y + Math.sin(rad(ang + bend)) * len * 0.5;
        stems.add(L.smooth([[x, y], [mx, my], [ex, ey]]));
        if (depth >= 3 || len < 50) {
          const n = r.int(3, 5);
          for (let i = 0; i < n; i++) {
            const a = r.range(0, Math.PI * 2), d = r.range(0, 14);
            dots.push({ x: ex + Math.cos(a) * d, y: ey + Math.sin(a) * d, r: r.range(5, 8.5), fill: p.ink });
          }
          return;
        }
        const k = depth === 0 ? 3 : 2;
        for (let i = 0; i < k; i++) {
          const f = lerp(0.45, 1, k === 1 ? 1 : i / (k - 1));
          const px = x + (ex - x) * f, py = y + (ey - y) * f;
          grow(px, py, ang + (i % 2 ? 1 : -1) * r.range(22, 40) + r.jitter(8), len * r.range(0.55, 0.7), depth + 1);
        }
        grow(ex, ey, ang + r.jitter(18), len * 0.5, depth + 1);
      };
      grow(150, 800, -38, 330, 0);
      grow(220, 810, -62, 300, 0);
      grow(120, 780, -18, 290, 0);
      grow(260, 830, -80, 240, 0);
      return path(stems, { fill: 'none', stroke: p.mono ? p.tones[0] : p.ink, 'stroke-width': 2.8, 'stroke-linecap': 'round' }) + L.dots(dots);
    },
  },
  {
    slug: 'herbstlaub', name: 'Herbstlaub', w: 1000, h: 800, palettes: ['herbst', 'gold', 'weiss'], fit: 24,
    tags: ['Herbst', 'Laub', 'Blätter', 'Eiche', 'Birke', 'Erntedank', 'Oktober', 'Eicheln'],
    draw(c) {
      const { p, r } = c;
      let s = '';
      // [x, y, rotation, length, width factor, round?]
      const spec = [[500, 740, -168, 400, 0.4, true], [500, 740, -12, 400, 0.4, true], [500, 740, -142, 500, 0.34, false], [500, 740, -38, 500, 0.34, false], [500, 740, -116, 560, 0.3, false], [500, 740, -64, 560, 0.3, false], [500, 740, -90, 600, 0.28, false]];
      spec.forEach(([x, y, rot, len, wf, round], i) => {
        const base = p.mono ? p.tones[(i % 2) + 1] : p.colors[i % p.colors.length];
        const rib = p.mono ? p.tones[0] : L.mix(base, '#000000', 0.32);
        const lf = leaf(len, len * wf * 0.5, { belly: round ? 0.5 : 0.42, sharp: round ? 0.35 : 0.8, round, asym: r.jitter(0.08), tip: r.jitter(0.1), bend: r.jitter(0.04) });
        const m = place(x, y, rot, 1);
        s += path(lf.whole.transform(m), { fill: base });
        const veins = new Path().add(lf.mid);
        for (let k = 1; k <= 5; k++) {
          const t = 0.14 + k * 0.14;
          for (const sg of [-1, 1]) veins.M(len * t, 0).L(len * (t + 0.12), sg * len * wf * 0.5 * (0.78 - t * 0.5));
        }
        s += path(veins.transform(m), { fill: 'none', stroke: rib, 'stroke-width': Math.max(2, len * 0.008), 'stroke-linecap': 'round', 'stroke-opacity': 0.8 });
        s += path(M.stem(new Curve([L.ap(m, [0, 0]), L.ap(m, [-30, 0]), L.ap(m, [-60, r.jitter(6)])]), 8, 4), { fill: rib });
      });
      return s;
    },
  },
  {
    slug: 'wiese', name: 'Blumenwiese', w: 1400, h: 640, palettes: ['bunt', 'pastell', 'rose'], fit: 24,
    tags: ['Wiese', 'Blumenwiese', 'Gras', 'Blumen', 'Frühling', 'Sommer', 'Rand', 'Kinder', 'Geburtstag'],
    draw(c) {
      const { p, r } = c;
      let s = '';
      const grass = new Path();
      for (let i = 0; i < 46; i++) {
        const x = lerp(20, 1380, i / 45) + r.jitter(12);
        const h = r.range(110, 250) * (0.7 + 0.3 * Math.sin(i * 0.37) ** 2);
        const lean = r.jitter(60);
        grass.add(M.stem([[x - 9, 620], [x + lean * 0.4, 620 - h * 0.55], [x + lean, 620 - h]], 20, 0, { count: 6 }));
      }
      s += path(grass, { fill: p.leaf });
      const heads = [];
      const n = 9;
      for (let i = 0; i < n; i++) {
        const x = lerp(90, 1310, i / (n - 1)) + r.jitter(24);
        const top = 620 - r.range(260, 480) * (0.7 + 0.3 * Math.sin(i * 1.7) ** 2);
        const lean = r.jitter(46);
        s += path(M.stem([[x, 630], [x + lean * 0.4, (630 + top) / 2], [x + lean, top]], 8, 5), { fill: p.leaf });
        const kind = ['daisy', 'anemone', 'blossom', 'daisy', 'anemone'][i % 5];
        heads.push([kind, x + lean, top, r.range(78, 110), i]);
        if (i % 2 === 0) s += g({ fill: p.leaf }, M.leafEl(leaf(130, 28, { belly: 0.4, sharp: 0.8, bend: 0.08 }), place(x + lean * 0.3, (630 + top) / 2 + 60, -62 + (i % 4) * 10, 1), p));
      }
      for (const [kind, x, y, R, i] of heads) s += M.flower(kind, x, y, R, p, r, { rot: r.range(0, 40), i });
      return s;
    },
  },
  {
    slug: 'blumenkranz', name: 'Blumenkranz', w: 1000, h: 1000, palettes: ['pastell', 'bunt', 'rose', 'navy'], fit: 24,
    tags: ['Blumenkranz', 'Kranz', 'Blumen', 'Hochzeit', 'Geburtstag', 'Taufe', 'Frühling', 'rund', 'Rahmen'],
    draw(c) {
      const { p, r } = c;
      let s = '';
      const R0 = 320;
      const [a, b] = wreathSpines(500, 500, R0, R0, 8, 100);
      const leafBranch = (curve) => M.laurelBranch(curve, p, r, { n: 14, len0: 82, len1: 66, spread0: 62, spread1: 50, stemW: 6 });
      s += g({ fill: p.leaf }, leafBranch(a), leafBranch(b));
      // berries on stalks
      const spec = [
        [128, 'peony', 98], [160, 'daisy', 66], [192, 'blossom', 52], [304, 'rose', 92], [334, 'anemone', 72], [356, 'daisy', 56],
        [236, 'blossom', 42], [262, 'daisy', 40], [30, 'blossom', 44], [70, 'anemone', 42], [100, 'blossom', 40],
      ];
      const berries = new Path();
      for (let i = 0; i < 22; i++) {
        const ang = r.range(0, 360), rr = R0 + r.jitter(54);
        berries.add(L.circlePath(500 + Math.cos(rad(ang)) * rr, 500 + Math.sin(rad(ang)) * rr, r.range(7, 11)));
      }
      s += path(berries, { fill: p.mono ? p.tones[0] : p.colors[1] });
      spec.sort((u, v) => v[2] - u[2]);
      spec.forEach(([ang, kind, R], i) => {
        const rr = R0 + r.jitter(8);
        s += M.flower(kind, 500 + Math.cos(rad(ang)) * rr, 500 + Math.sin(rad(ang)) * rr, R, p, r, { rot: r.range(0, 60), i: i + 2 });
      });
      return s;
    },
  },
];

module.exports = { name: 'Blumen & Blätter', slug: 'blumen', tags: ['Blume', 'Blatt', 'Natur', 'Pflanze'], pieces };
