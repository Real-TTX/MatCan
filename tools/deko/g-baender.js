'use strict';
// Group "Bänder & Siegel": bows, banners, rosettes, badges, seals, tags, tape.
const L = require('./lib');
const M = require('./motifs');
const { Curve, Path, g, path, circle, rad, lerp, place, ribbon, mix, leaf } = L;

const col = (p, i) => p.colors[i % p.colors.length];
const RIB = ['gold', 'rose', 'navy', 'bordeaux', 'schwarz', 'weiss'];
const SEAL = ['bordeaux', 'gold', 'navy', 'schwarz', 'weiss'];
const shade = (op = 0.14, color = '#000000') => ({ fill: color, 'fill-opacity': op });
/** The darker colour of a palette for folds (a solid colour: a gradient cannot be mixed). */
const dark = (p) => (p.id === 'weiss' ? '#cdc7b8' : p.mono ? p.tones[0] : mix(p.colors[0], '#000000', 0.25));
const star = (cx, cy, ro, ri, rot = -90) => L.starPath(cx, cy, ro, ri, 5, rot);

const pieces = [
  {
    slug: 'schleife', name: 'Schleife', w: 800, h: 640, palettes: RIB, fit: 20,
    tags: ['Schleife', 'Geschenkband', 'Band', 'Masche', 'Geschenk', 'Weihnachten', 'Hochzeit', 'Geburtstag'],
    draw(c) {
      const { p } = c;
      const cx = 400, cy = 250;
      // four lobes (two up, two down) and two tails
      const lobe = (ang, len, wid, flip) => leaf(len, wid, { belly: 0.6, sharp: 0.3, round: true, tip: 0.1 }).whole.transform(place(cx, cy, ang, 1, flip));
      const tail = (d, k) => new Path().M(cx + d * 14, cy + 20).C(cx + d * (40 + k), cy + 120, cx + d * (90 + k), cy + 250, cx + d * (130 + k), cy + 360).L(cx + d * (84 + k), cy + 330).L(cx + d * (52 + k), cy + 380).C(cx + d * (36 + k), cy + 260, cx + d * 10, cy + 150, cx - d * 12, cy + 50).Z();
      let s = path(tail(-1, 10), {}) + path(tail(1, 26), {}) + path(tail(-1, 10), shade(0.14)) + path(tail(1, 26), shade(0.14));
      const lobes = [[-158, 330, 100], [-22, 330, 100], [158, 300, 92], [22, 300, 92]];
      lobes.forEach(([ang, len, wid]) => { s += path(lobe(ang, len, wid, ang > 90 || ang < -90 ? true : false), {}); });
      lobes.forEach(([ang, len, wid], i) => { s += path(lobe(ang, len * 0.7, wid * 0.55, false).transform(L.IDENT), shade(i < 2 ? 0.1 : 0.2)); });
      s += path(L.rrect(cx - 44, cy - 54, 88, 108, 34), {}) + path(L.rrect(cx - 44, cy - 54, 88, 108, 34), shade(0.12));
      s += path(new Path().M(cx - 24, cy - 24).C(cx - 10, cy - 34, cx + 10, cy - 34, cx + 24, cy - 24), { fill: 'none', stroke: '#ffffff', 'stroke-opacity': 0.45, 'stroke-width': 6, 'stroke-linecap': 'round' });
      return g({ fill: p.ink }, s);
    },
  },
  {
    slug: 'banderole', name: 'Banderole', w: 1200, h: 360, palettes: RIB, fit: 20,
    tags: ['Banderole', 'Banner', 'Band', 'Schriftband', 'Titel', 'Ehrung', 'Urkunde', 'Etikett'],
    draw(c) {
      const { p } = c;
      const D = dark(p);
      const tail = (d) => {
        const x = 600 + d * 580;
        return new Path().M(600 + d * 300, 120).L(x, 120).L(600 + d * 520, 190).L(x, 260).L(600 + d * 300, 260).Z();
      };
      let s = path(tail(-1), {}) + path(tail(1), {}) + path(tail(-1), shade(0.16)) + path(tail(1), shade(0.16));
      for (const d of [-1, 1]) s += path(L.poly([[600 + d * 300, 200], [600 + d * 360, 200], [600 + d * 300, 268]], true), { fill: D });
      const band = new Path().M(240, 60).Q(600, 10, 960, 60).L(960, 210).Q(600, 160, 240, 210).Z();
      s += path(band, {});
      s += path(new Path().M(262, 82).Q(600, 34, 938, 82).L(938, 188).Q(600, 138, 262, 188).Z(), { fill: 'none', stroke: '#ffffff', 'stroke-opacity': 0.5, 'stroke-width': 3 });
      return g({ fill: p.ink }, s);
    },
  },
  {
    slug: 'fahne', name: 'Schwalbenschwanz-Band', w: 1200, h: 240, palettes: RIB, fit: 20,
    tags: ['Band', 'Banner', 'Fahne', 'Schriftband', 'Titel', 'Label', 'gerade', 'Streifen'],
    draw(c) {
      const { p } = c;
      const body = new Path().M(60, 20).L(1140, 20).L(1070, 110).L(1140, 200).L(60, 200).L(130, 110).Z();
      return g({ fill: p.ink }, path(body, {}), path(new Path().M(100, 44).L(1100, 44).M(100, 176).L(1100, 176), { fill: 'none', stroke: '#ffffff', 'stroke-opacity': 0.5, 'stroke-width': 3 }));
    },
  },
  {
    slug: 'band-wellig', name: 'Band gewellt', w: 1300, h: 340, palettes: ['gold', 'rose', 'navy', 'bordeaux', 'weiss'], fit: 20,
    tags: ['Band', 'Banner', 'gewellt', 'Welle', 'Fahne', 'Schriftband', 'Titel', 'Geburtstag', 'Fest'],
    draw(c) {
      const { p } = c;
      const top = [], bottom = [];
      for (let i = 0; i <= 12; i++) { const t = i / 12; const x = 60 + t * 1180; const y = 120 + Math.sin(t * Math.PI * 2.5) * 46; top.push([x, y]); bottom.push([x, y + 116]); }
      // build the closed shape: top curve, a notch at the right end, bottom curve back, a notch at the left end
      const shape = new Path().M(top[0][0], top[0][1]).through(top).L(1200, (top[12][1] + bottom[12][1]) / 2).L(bottom[12][0], bottom[12][1]).through(bottom.slice().reverse()).L(100, (top[0][1] + bottom[0][1]) / 2).Z();
      return g({ fill: p.ink }, path(shape, {}), path(L.smooth(top.map(([x, y]) => [x, y + 20])).transform(L.IDENT), { fill: 'none', stroke: '#ffffff', 'stroke-opacity': 0.45, 'stroke-width': 3 }));
    },
  },
  {
    slug: 'rosette', name: 'Auszeichnung', w: 640, h: 860, palettes: ['gold', 'navy', 'bordeaux', 'rose', 'schwarz'], fit: 20,
    tags: ['Rosette', 'Auszeichnung', 'Preis', 'Siegerband', 'Urkunde', 'Pokal', 'Ehrung', 'Medaille', 'Abzeichen'],
    draw(c) {
      const { p } = c;
      const cx = 320, cy = 330;
      const tail = (a, k) => L.poly([[0, 0], [70, 0], [70, 440], [35, 400], [0, 440]], true).transform(L.compose(L.move(cx, cy), L.rotm(90 + a), L.move(0, -35)));
      // ribbons (the points of the polygon run along +x after the rotation: build them hanging down instead)
      const hang = (a) => L.poly([[-38, 0], [38, 0], [38 + a * 0.2, 470], [a * 0.2, 420], [-38 + a * 0.2, 470]], true).transform(L.compose(L.move(cx + a, cy + 40), L.rotm(0)));
      let s = path(hang(-62), {}) + path(hang(62), {}) + path(hang(-62), shade(0.15)) + path(hang(62), shade(0.1));
      const ruffle = new Path();
      for (let i = 0; i < 26; i++) { const a = (i / 26) * Math.PI * 2; ruffle.add(L.circlePath(cx + Math.cos(a) * 214, cy + Math.sin(a) * 214, 52)); }
      s += path(ruffle, {}) + path(L.circlePath(cx, cy, 214), {});
      s += path(ruffle, shade(0.08));
      s += path(L.circlePath(cx, cy, 168), { fill: 'none', stroke: '#ffffff', 'stroke-opacity': 0.55, 'stroke-width': 5 });
      s += path(L.circlePath(cx, cy, 138), shade(0.16));
      s += path(star(cx, cy + 4, 92, 38), { fill: p.id === 'weiss' ? '#cdc7b8' : '#ffffff', 'fill-opacity': 0.9 });
      return g({ fill: p.ink }, s);
    },
  },
  {
    slug: 'siegel-zacken', name: 'Siegel Zackenrand', w: 720, h: 720, palettes: SEAL, fit: 16,
    tags: ['Siegel', 'Zackenrand', 'Gütesiegel', 'Qualität', 'Urkunde', 'Stempel', 'Abzeichen', 'Badge'],
    draw(c) {
      const { p } = c;
      const cx = 360, cy = 360;
      const pts = [];
      const n = 36;
      for (let i = 0; i < n * 2; i++) { const a = (i / (n * 2)) * Math.PI * 2; const rr = i % 2 ? 322 : 346; pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); }
      let s = path(L.poly(pts, true), {});
      const acc = p.id === 'weiss' ? '#cdc7b8' : '#ffffff';
      s += path(L.circlePath(cx, cy, 286), { fill: 'none', stroke: acc, 'stroke-width': 5, 'stroke-opacity': 0.75 });
      s += path(L.circlePath(cx, cy, 262), { fill: 'none', stroke: acc, 'stroke-width': 2, 'stroke-opacity': 0.75 });
      s += path(star(cx, cy + 6, 150, 62), { fill: acc, 'fill-opacity': 0.85 });
      const dots = new Path();
      for (let i = 0; i < 36; i++) { const a = rad(i * 10); dots.add(L.circlePath(cx + Math.cos(a) * 224, cy + Math.sin(a) * 224, 4.4)); }
      s += path(dots, { fill: acc, 'fill-opacity': 0.8 });
      return g({ fill: p.ink }, s);
    },
  },
  {
    slug: 'siegel-wachs', name: 'Wachssiegel', w: 700, h: 700, palettes: ['bordeaux', 'navy', 'gold', 'schwarz'], fit: 16,
    tags: ['Wachssiegel', 'Siegel', 'Siegellack', 'Stempel', 'Hochzeit', 'Einladung', 'Brief', 'verschlossen', 'Briefsiegel'],
    draw(c) {
      const { p, r } = c;
      const cx = 350, cy = 350;
      const pts = [];
      const n = 28;
      for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; pts.push([cx + Math.cos(a) * (296 + r.jitter(26) + Math.sin(a * 3 + 1) * 14), cy + Math.sin(a) * (292 + r.jitter(26) + Math.cos(a * 2) * 12)]); }
      // two small drips
      const blob = L.smooth(pts, true);
      let s = path(blob, {});
      s += path(L.circlePath(180, 598, 34), {}) + path(L.circlePath(520, 610, 28), {}) + path(L.circlePath(560, 560, 40), {});
      s += path(blob, shade(0.1, '#ffffff'));
      s += path(L.circlePath(cx, cy, 206), shade(0.2));
      s += path(L.circlePath(cx - 3, cy - 3, 200), { fill: p.ink });
      s += path(L.circlePath(cx, cy, 200), { fill: 'none', stroke: p.id === 'gold' ? '#6e4a12' : '#000000', 'stroke-opacity': 0.25, 'stroke-width': 8 });
      s += path(L.circlePath(cx, cy, 150), { fill: 'none', stroke: p.id === 'gold' ? '#6e4a12' : '#000000', 'stroke-opacity': 0.22, 'stroke-width': 4 });
      s += path(star(cx, cy + 4, 104, 44), { fill: p.id === 'gold' ? '#6e4a12' : '#000000', 'fill-opacity': 0.25 });
      s += path(star(cx - 4, cy, 104, 44), { fill: '#ffffff', 'fill-opacity': 0.14 });
      return g({ fill: p.ink }, s);
    },
  },
  {
    slug: 'medaille', name: 'Medaille', w: 600, h: 920, palettes: ['gold', 'navy', 'bordeaux', 'schwarz'], fit: 20,
    tags: ['Medaille', 'Auszeichnung', 'Preis', 'Sieger', 'Ehrung', 'Platz', 'Urkunde', 'Abzeichen'],
    draw(c) {
      const { p } = c;
      const cx = 300, cy = 640;
      const strap = (d) => L.poly([[cx + d * 40 - 62, 0], [cx + d * 40 + 62, 0], [cx + d * 40 + 62 - d * 120, 470], [cx + d * 40 - 62 - d * 120, 470]], true);
      // the straps end behind the disc
      let s = path(L.poly([[150, 0], [270, 0], [330, 470], [210, 470]], true), { fill: dark(p) }) + path(L.poly([[330, 0], [450, 0], [390, 470], [270, 470]], true), {});
      s += path(L.circlePath(cx, cy, 250), {});
      s += path(L.circlePath(cx, cy, 250), shade(0.1, '#ffffff'));
      s += path(L.circlePath(cx, cy, 218), { fill: 'none', stroke: '#ffffff', 'stroke-opacity': 0.55, 'stroke-width': 6 });
      s += path(L.circlePath(cx, cy, 190), shade(0.18));
      s += path(star(cx, cy + 6, 118, 50), { fill: '#ffffff', 'fill-opacity': 0.9 });
      s += path(L.circlePath(cx, 370, 22), { fill: 'none', stroke: dark(p), 'stroke-width': 8 });
      return g({ fill: p.ink }, s);
    },
  },
  {
    slug: 'anhaenger', name: 'Geschenkanhänger', w: 520, h: 940, palettes: ['weiss', 'rose', 'gold', 'navy', 'schwarz'], fit: 20,
    tags: ['Anhänger', 'Geschenkanhänger', 'Etikett', 'Label', 'Tag', 'Schild', 'Preisschild', 'Weihnachten', 'Geschenk', 'Hochzeit'],
    draw(c) {
      const { p } = c;
      const tag = new Path().M(110, 250).L(250, 100).L(390, 250).L(390, 880).Q(390, 900, 370, 900).L(130, 900).Q(110, 900, 110, 880).Z().add(L.circlePath(250, 230, 30));
      let s = path(tag, { fill: p.ink, 'fill-rule': 'evenodd' });
      s += path(L.circlePath(250, 230, 46), { fill: 'none', stroke: p.id === 'weiss' ? '#cdc7b8' : '#ffffff', 'stroke-opacity': 0.7, 'stroke-width': 7 });
      s += path(new Path().M(140, 300).L(140, 862).L(360, 862).L(360, 300).L(250, 190).Z().transform(L.IDENT), { fill: 'none', stroke: p.id === 'weiss' ? '#cdc7b8' : '#ffffff', 'stroke-opacity': 0.6, 'stroke-width': 3, 'stroke-dasharray': '12 10', 'stroke-linejoin': 'round' });
      s += path(L.smooth([[250, 230], [190, 150], [150, 60], [230, 24], [310, 70], [284, 170], [250, 230]]), { fill: 'none', stroke: p.id === 'weiss' ? '#ffffff' : p.ink, 'stroke-width': 7, 'stroke-linecap': 'round', 'stroke-opacity': 0.9 });
      return s;
    },
  },
  {
    slug: 'stempel', name: 'Stempelring', w: 700, h: 700, palettes: ['schwarz', 'navy', 'bordeaux', 'weiss'], fit: 16,
    tags: ['Stempel', 'Ring', 'Siegel', 'Rund', 'Poststempel', 'Gütesiegel', 'Retro', 'Vintage', 'Abzeichen'],
    draw(c) {
      const { p } = c;
      const cx = 350, cy = 350;
      const ring = (r0, r1, a0, a1) => new Path().arc(cx, cy, r1, r1, a0, a1, true).arc(cx, cy, r0, r0, a1, a0).Z();
      let s = '';
      s += path(L.circlePath(cx, cy, 340).add(L.circlePath(cx, cy, 322)), { 'fill-rule': 'evenodd' });
      s += path(L.circlePath(cx, cy, 306).add(L.circlePath(cx, cy, 300)), { 'fill-rule': 'evenodd' });
      // an inner band with stars at the sides (the band stays free for lettering)
      s += path(L.circlePath(cx, cy, 214).add(L.circlePath(cx, cy, 208)), { 'fill-rule': 'evenodd' });
      for (const a of [180, 0]) s += path(star(0, 0, 22, 9).transform(place(cx + Math.cos(rad(a)) * 258, cy + Math.sin(a * Math.PI / 180) * 258, 0, 1)), {});
      s += path(star(cx, cy, 70, 29), {});
      return g({ fill: p.ink }, s);
    },
  },
  {
    slug: 'washi', name: 'Washi-Tape', w: 1000, h: 760, palettes: ['bunt', 'pastell', 'boho'],
    tags: ['Washi', 'Tape', 'Klebeband', 'Scrapbook', 'Bullet Journal', 'Basteln', 'Kinder', 'Streifen'],
    draw(c) {
      const { p, r } = c;
      let s = '';
      const strip = (cx, cy, rot, len, wid, i, kind) => {
        const hw = wid / 2, hl = len / 2;
        const teeth = 6;
        const pts = [[-hl, -hw]];
        for (let k = 0; k < teeth; k++) { pts.push([-hl + (k % 2 ? 0 : 9), -hw + (k + 0.5) * wid / teeth]); pts.push([-hl, -hw + (k + 1) * wid / teeth]); }
        pts.push([hl, hw]);
        for (let k = 0; k < teeth; k++) { pts.push([hl - (k % 2 ? 0 : 9), hw - (k + 0.5) * wid / teeth]); pts.push([hl, hw - (k + 1) * wid / teeth]); }
        const m = place(cx, cy, rot, 1);
        const color = col(p, i);
        let t = path(L.poly(pts, true).transform(m), { fill: color, 'fill-opacity': 0.92 });
        const deco = new Path();
        if (kind === 0) for (let x = -hl + 40; x < hl - 20; x += 44) deco.add(L.poly([[x, -hw], [x + 20, -hw], [x + 20 - 16, hw], [x - 16, hw]], true));
        else if (kind === 1) for (let x = -hl + 36; x < hl - 20; x += 40) for (const y of [-hw * 0.45, hw * 0.45]) deco.add(L.circlePath(x + (y > 0 ? 20 : 0), y, 8));
        else for (let x = -hl + 40; x < hl - 20; x += 54) deco.add(L.poly([[x, -14], [x + 22, 0], [x, 14]], true));
        t += path(deco.transform(m), { fill: '#ffffff', 'fill-opacity': 0.62 });
        return t;
      };
      s += strip(500, 190, -6, 760, 130, 0, 0);
      s += strip(470, 400, 4, 800, 130, 1, 1);
      s += strip(520, 600, -3, 740, 130, 3, 2);
      return s;
    },
  },
  {
    slug: 'eckband', name: 'Eckband', w: 520, h: 520, palettes: ['bordeaux', 'navy', 'gold', 'schwarz'],
    tags: ['Eckband', 'Band', 'Ecke', 'Schräg', 'Neu', 'Aktion', 'Angebot', 'Label', 'Corner Ribbon'],
    draw(c) {
      const { p } = c;
      const band = L.poly([[0, 330], [330, 0], [470, 0], [0, 470]], true);
      return g({ fill: p.ink }, path(band, {}), path(L.poly([[0, 330], [330, 0], [350, 0], [0, 350]], true), shade(0.14, '#ffffff')), path(L.poly([[0, 452], [452, 0], [470, 0], [0, 470]], true), shade(0.16)));
    },
  },
  {
    slug: 'starburst', name: 'Starburst', w: 720, h: 720, palettes: ['bordeaux', 'gold', 'schwarz', 'bunt'], fit: 16,
    tags: ['Starburst', 'Sticker', 'Aktion', 'Angebot', 'Neu', 'Rabatt', 'Preis', 'Zacken', 'Badge'],
    draw(c) {
      const { p } = c;
      const cx = 360, cy = 360;
      const pts = [];
      const n = 22;
      for (let i = 0; i < n * 2; i++) { const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2; const rr = i % 2 ? 268 : 350; pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); }
      const base = p.mono ? p.ink : col(p, 0);
      return g({}, path(L.poly(pts, true), { fill: base }), path(L.circlePath(cx, cy, 240), { fill: 'none', stroke: p.id === 'weiss' ? '#cdc7b8' : '#ffffff', 'stroke-opacity': 0.8, 'stroke-width': 6 }), path(L.circlePath(cx, cy, 230), shade(0.12)));
    },
  },
];

module.exports = { name: 'Bänder & Siegel', slug: 'baender', tags: ['Band', 'Siegel', 'Auszeichnung'], pieces };
