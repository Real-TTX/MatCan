'use strict';
// Group "Motive", batch V3 (greeting cards): house with key, car with L sign, graduation cap, suitcase, paper plane, apple, books, coffee cup, palm with hammock,
// champagne flutes, baby body, rocking chair, plant pot, envelope, sun with sunglasses, wedding rings, candle, beer mug, plaster heart, compass, driving licence,
// diploma, trophy, heart with arrow, clover, flag with heart, moving box, alarm clock, briefcase.
// Flat, few colours: every piece takes its colours from the palette (mono palettes use their three tones), details are neutral.
const L = require('./lib');
const { Path, path, circle, g, mix, place, rrect, poly, smooth, circlePath, ellipsePath, heart, sparkle } = L;

const DUO = ['bunt', 'pastell'];

/** Colour i of the palette; a mono palette gives mid, light, dark, mid, light, dark. */
const col = (p, i) => (p.mono ? [p.tones[1], p.tones[2], p.tones[0]][((i % 3) + 3) % 3] : p.colors[((i % p.colors.length) + p.colors.length) % p.colors.length]);
const shade = (o = 0.12) => ({ fill: '#000000', 'fill-opacity': o });
const light = (o = 0.3) => ({ fill: '#ffffff', 'fill-opacity': o });
const warm = (p) => (p.mono ? p.tones[2] : p.id === 'pastell' ? '#f6cf72' : '#ffb627');
const dark = (p) => (p.mono ? p.tones[0] : '#2f3142');
const skin = (p) => (p.mono ? p.tones[2] : '#f3c9a6');
const leafGreen = (p) => (p.mono ? p.tones[0] : p.id === 'pastell' ? '#8ec3a3' : '#35a874');
const stroke = (c, w, extra = {}) => ({ fill: 'none', stroke: c, 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', ...extra });

const pieces = [
  // ------------------------------------------------------------------------------------------------------------------ house with key
  {
    slug: 'haus-schluessel', name: 'Haus mit Schlüssel', w: 600, h: 600, palettes: [...DUO, 'boho'], fit: 24,
    tags: ['Haus', 'Schlüssel', 'Neues Zuhause', 'Umzug', 'Hauskauf', 'Eigenheim', 'Einzug', 'Immobilie'],
    draw(c) {
      const { p } = c;
      let s = '';
      s += path(rrect(372, 130, 46, 100, 4), { fill: col(p, 2) });
      s += path(rrect(125, 285, 350, 240, 6), { fill: col(p, 1) });
      s += path(rrect(125, 285, 350, 240, 6), shade(0.03));
      s += path(poly([[92, 300], [300, 112], [508, 300]]), { fill: col(p, 0), stroke: col(p, 0), 'stroke-width': 18, 'stroke-linejoin': 'round' });
      s += path(new Path().M(120, 300).L(300, 140).L(480, 300).Z(), light(0.12));
      s += circle(300, 232, 30, { fill: '#ffffff', 'fill-opacity': 0.92 });
      s += path(heart(300, 232, 34), { fill: col(p, 0) });
      s += path(new Path().M(265, 525).L(265, 420).C(265, 380, 335, 380, 335, 420).L(335, 525).Z(), { fill: col(p, 2) });
      s += circle(321, 470, 6, { fill: '#ffffff' });
      for (const x of [158, 392]) {
        s += path(rrect(x, 335, 70, 70, 7), { fill: '#ffffff', 'fill-opacity': 0.9 });
        s += path(new Path().M(x + 35, 335).L(x + 35, 405).M(x, 370).L(x + 70, 370), stroke(col(p, 2), 5, { 'stroke-linecap': 'butt' }));
      }
      // the key leans on the right wall
      const k = warm(p), kd = p.mono ? p.tones[0] : '#c98a1a';
      const kx = 508, ky = 410, ang = 18;
      s += path(new Path().add(rrect(-9, 30, 18, 124, 4)).add(rrect(9, 104, 28, 13, 3)).add(rrect(9, 130, 20, 13, 3)).transform(place(kx, ky, ang, 1)), { fill: k });
      s += circle(kx, ky, 38, { fill: 'none', stroke: k, 'stroke-width': 17 });
      s += path(rrect(-9, 30, 18, 124, 4).transform(place(kx, ky, ang, 1)), { fill: kd, 'fill-opacity': 0.25 });
      return s;
    },
  },
  // ------------------------------------------------------------------------------------------------------------------ car with L sign
  {
    slug: 'auto-l-schild', name: 'Auto mit L-Schild', w: 640, h: 440, palettes: DUO, fit: 24,
    tags: ['Auto', 'Führerschein', 'Fahrschule', 'Fahrprüfung', 'Fahranfänger', 'L-Schild', 'Wagen'],
    draw(c) {
      const { p } = c;
      let s = '';
      const body = col(p, 0);
      s += path(new Path().M(150, 150).L(190, 82).Q(200, 66, 222, 66).L(372, 66).Q(396, 66, 410, 86).L(458, 150).Z().transform(L.move(0, 100)), { fill: body });
      s += path(rrect(50, 240, 540, 118, 36), { fill: body });
      s += path(rrect(50, 240, 540, 118, 36), shade(0.0));
      s += path(rrect(50, 318, 540, 40, 20), shade(0.1));
      // windows
      s += path(new Path().M(176, 244).L(204, 192).Q(210, 182, 224, 182).L(292, 182).L(292, 244).Z(), { fill: '#d6edf7' });
      s += path(new Path().M(312, 244).L(312, 182).L(372, 182).Q(388, 182, 398, 196).L(430, 244).Z(), { fill: '#d6edf7' });
      s += path(new Path().M(176, 244).L(204, 192).L(222, 192).L(196, 244).Z(), light(0.0));
      // lights and handle
      s += path(rrect(560, 272, 34, 24, 10), { fill: warm(p) });
      s += path(rrect(46, 272, 24, 24, 10), { fill: p.mono ? p.tones[0] : '#ff6b6b' });
      s += path(rrect(300, 268, 44, 10, 5), shade(0.25));
      // wheels
      for (const x of [162, 462]) {
        s += circle(x, 362, 48, { fill: '#2b2d3a' });
        s += circle(x, 362, 24, { fill: '#cfd3dc' });
        s += circle(x, 362, 8, { fill: '#2b2d3a' });
      }
      // roof sign
      s += path(rrect(262, 100, 112, 66, 8), { fill: '#ffffff' });
      s += path(rrect(262, 100, 112, 66, 8), stroke(col(p, 3), 5));
      s += path(poly([[298, 114], [316, 114], [316, 146], [350, 146], [350, 160], [298, 160]]), { fill: col(p, 3) });
      s += path(rrect(300, 166, 36, 16, 3), { fill: dark(p) });
      return s;
    },
  },
  // ------------------------------------------------------------------------------------------------------------------ graduation cap
  {
    slug: 'doktorhut', name: 'Doktorhut', w: 600, h: 520, palettes: [...DUO, 'navy'], fit: 24,
    tags: ['Doktorhut', 'Abschluss', 'Prüfung', 'Bestanden', 'Studium', 'Abitur', 'Uni', 'Absolvent', 'Graduation'],
    draw(c) {
      const { p } = c;
      const cap = p.mono ? p.tones[0] : p.id === 'pastell' ? '#9aa7d8' : '#2f3a6b';
      let s = '';
      s += path(new Path().M(150, 250).L(150, 340).Q(300, 430, 450, 340).L(450, 250).L(300, 310).Z(), { fill: cap });
      s += path(new Path().M(150, 250).L(150, 340).Q(300, 430, 450, 340).L(450, 250).L(300, 310).Z(), shade(0.18));
      s += path(poly([[300, 118], [560, 214], [300, 316], [40, 214]]), { fill: cap });
      s += path(poly([[300, 118], [560, 214], [300, 316], [40, 214]]), light(0.1));
      s += path(poly([[300, 118], [560, 214], [300, 214]]), light(0.08));
      // cord and tassel
      const gold = warm(p);
      s += path(new Path().M(300, 214).C(380, 214, 480, 226, 505, 262).L(505, 360), stroke(gold, 9));
      s += circle(300, 214, 14, { fill: gold });
      s += path(rrect(488, 350, 34, 22, 6), { fill: gold });
      s += path(new Path().M(490, 368).L(486, 436).M(500, 372).L(500, 442).M(510, 372).L(514, 436).M(520, 368).L(524, 430), stroke(gold, 7));
      return s;
    },
  },
  // ------------------------------------------------------------------------------------------------------------------ suitcase
  {
    slug: 'koffer', name: 'Koffer', w: 600, h: 560, palettes: [...DUO, 'boho'], fit: 24,
    tags: ['Koffer', 'Reise', 'Urlaub', 'Gute Reise', 'Verreisen', 'Gepäck', 'Auswandern', 'Abschied'],
    draw(c) {
      const { p } = c;
      let s = '';
      s += path(new Path().M(215, 170).L(215, 120).Q(215, 98, 238, 98).L(362, 98).Q(385, 98, 385, 120).L(385, 170), stroke(col(p, 2), 20, { 'stroke-linecap': 'butt' }));
      s += path(rrect(90, 160, 420, 330, 34), { fill: col(p, 0) });
      s += path(rrect(165, 160, 34, 330, 0), shade(0.12));
      s += path(rrect(401, 160, 34, 330, 0), shade(0.12));
      s += path(rrect(90, 160, 420, 60, 30), light(0.16));
      s += path(rrect(262, 268, 76, 46, 10), { fill: warm(p) });
      s += circle(300, 291, 7, { fill: dark(p) });
      s += path(rrect(130, 490, 36, 30, 8), { fill: dark(p) });
      s += path(rrect(434, 490, 36, 30, 8), { fill: dark(p) });
      // stickers
      s += circle(142, 390, 26, { fill: col(p, 1) });
      s += path(L.starPath(142, 390, 17, 7, 5), { fill: '#ffffff' });
      s += path(rrect(432, 340, 58, 44, 8), { fill: col(p, 3) });
      s += path(heart(461, 362, 26), { fill: '#ffffff' });
      return s;
    },
  },
  // ------------------------------------------------------------------------------------------------------------------ paper plane
  {
    slug: 'papierflieger', name: 'Papierflieger', w: 620, h: 520, palettes: DUO, fit: 24,
    tags: ['Papierflieger', 'Flugzeug', 'Reise', 'Gute Reise', 'Abschied', 'Aufbruch', 'Neustart', 'Flug', 'Nachricht'],
    draw(c) {
      const { p } = c;
      let s = '';
      s += path(new Path().M(40, 440).C(120, 470, 190, 420, 170, 370).C(150, 320, 90, 340, 130, 400).C(170, 450, 260, 440, 300, 400), stroke(col(p, 3), 7, { 'stroke-dasharray': '4 18' }));
      s += path(poly([[570, 100], [60, 270], [260, 310]]), { fill: '#ffffff' });
      s += path(poly([[570, 100], [60, 270], [260, 310]]), { fill: col(p, 1), 'fill-opacity': 0.55 });
      s += path(poly([[570, 100], [260, 310], [330, 440]]), { fill: col(p, 0) });
      s += path(poly([[260, 310], [330, 440], [300, 330]]), shade(0.3));
      s += path(poly([[570, 100], [260, 310], [300, 330]]), shade(0.16));
      return s;
    },
  },
  // ------------------------------------------------------------------------------------------------------------------ apple
  {
    slug: 'apfel', name: 'Apfel', w: 520, h: 560, palettes: DUO, fit: 24,
    tags: ['Apfel', 'Lehrer', 'Lehrerin', 'Schule', 'Danke Lehrer', 'Erzieherin', 'Obst', 'Lehrkraft'],
    draw(c) {
      const { p } = c;
      const red = p.mono ? p.tones[1] : p.id === 'pastell' ? '#f08a96' : '#e8434f';
      let s = '';
      const body = smooth([[260, 150], [330, 128], [410, 150], [455, 225], [452, 320], [408, 410], [340, 460], [290, 455], [260, 445], [230, 455], [180, 460], [112, 410], [68, 320], [65, 225], [110, 150], [190, 128]], true);
      s += path(new Path().M(258, 140).C(256, 100, 244, 74, 222, 46), stroke(p.mono ? p.tones[0] : '#7a5232', 20));
      s += path(body, { fill: red });
      s += path(new Path().M(260, 150).C(330, 112, 410, 150, 440, 230).C(458, 330, 408, 420, 330, 456).C(400, 400, 430, 300, 404, 230).C(386, 180, 330, 150, 260, 150).Z(), shade(0.12));
      s += path(ellipsePath(140, 240, 20, 52, 18), light(0.4));
      const lf = L.leaf(190, 54, { belly: 0.45, sharp: 0.7, bend: -0.15 });
      s += path(lf.whole.transform(place(270, 120, -28, 1)), { fill: leafGreen(p) });
      s += path(lf.upper.transform(place(270, 120, -28, 1)), shade(0.14));
      return s;
    },
  },
  // ------------------------------------------------------------------------------------------------------------------ books
  {
    slug: 'buecherstapel', name: 'Bücherstapel', w: 560, h: 500, palettes: [...DUO, 'boho'], fit: 24,
    tags: ['Bücher', 'Buch', 'Lesen', 'Lehrer', 'Schule', 'Lernen', 'Bildung', 'Prüfung', 'Studium', 'Bibliothek'],
    draw(c) {
      const { p } = c;
      let s = '';
      const book = (x, y, w, h, color, tilt = 0) => {
        const m = L.compose(L.move(x + w / 2, y + h / 2), L.rotm(tilt), L.move(-(x + w / 2), -(y + h / 2)));
        let b = path(rrect(x, y, w, h, 12).transform(m), { fill: color });
        b += path(rrect(x + w - 26, y + 12, 14, h - 24, 5).transform(m), light(0.55));
        b += path(rrect(x + 26, y + 10, 10, h - 20, 4).transform(m), light(0.3));
        b += path(rrect(x + 70, y + h / 2 - 5, 130, 10, 5).transform(m), light(0.35));
        return b;
      };
      s += book(70, 360, 420, 100, col(p, 3));
      s += book(100, 250, 360, 100, col(p, 0));
      s += book(130, 140, 320, 100, col(p, 2), -4);
      s += path(rrect(90, 462, 380, 14, 7), shade(0.12));
      return s;
    },
  },
  // ------------------------------------------------------------------------------------------------------------------ coffee cup
  {
    slug: 'kaffeetasse', name: 'Kaffeetasse', w: 620, h: 560, palettes: [...DUO, 'boho'], fit: 24,
    tags: ['Kaffee', 'Tasse', 'Pause', 'Kollege', 'Kollegin', 'Büro', 'Freundschaft', 'Treffen', 'Cappuccino', 'Tee'],
    draw(c) {
      const { p } = c;
      const coffee = p.mono ? p.tones[0] : '#6b4430';
      let s = '';
      for (const [x, dy] of [[210, 0], [290, 22], [370, 0]]) s += path(new Path().M(x, 190 + dy).C(x - 30, 150 + dy, x + 30, 110 + dy, x, 70 + dy), stroke(p.mono ? p.tones[1] : '#c6cad4', 12));
      s += circle(468, 340, 56, { fill: 'none', stroke: col(p, 0), 'stroke-width': 26 });
      s += path(ellipsePath(300, 478, 230, 40), { fill: col(p, 1) });
      s += path(ellipsePath(300, 478, 230, 40), shade(0.08));
      s += path(new Path().M(110, 250).L(490, 250).L(490, 340).C(490, 440, 410, 490, 300, 490).C(190, 490, 110, 440, 110, 340).Z(), { fill: col(p, 0) });
      s += path(new Path().M(110, 360).C(120, 440, 190, 490, 300, 490).C(410, 490, 480, 440, 490, 360).Z(), shade(0.1));
      s += path(ellipsePath(300, 252, 190, 34), { fill: col(p, 0) });
      s += path(ellipsePath(300, 252, 168, 26), { fill: coffee });
      s += path(heart(300, 252, 52), { fill: '#f4e4d2' });
      s += path(rrect(140, 300, 24, 130, 12), light(0.3));
      return s;
    },
  },
  // ------------------------------------------------------------------------------------------------------------------ palm with hammock
  {
    slug: 'palme-haengematte', name: 'Palme mit Hängematte', w: 700, h: 560, palettes: DUO, fit: 24,
    tags: ['Palme', 'Hängematte', 'Ruhestand', 'Rente', 'Urlaub', 'Entspannung', 'Strand', 'Insel', 'Freizeit'],
    draw(c) {
      const { p } = c;
      const sand = p.mono ? p.tones[2] : p.id === 'pastell' ? '#f8e3b4' : '#f2c76e';
      const green = leafGreen(p);
      const trunk = p.mono ? p.tones[0] : '#9a6a3d';
      let s = '';
      s += path(new Path().M(60, 500).C(160, 440, 540, 440, 640, 500).Z(), { fill: sand });
      s += path(new Path().M(60, 500).C(160, 470, 540, 470, 640, 500).Z(), shade(0.06));
      // post on the right
      s += path(rrect(560, 270, 18, 200, 5), { fill: trunk });
      // trunk
      s += path(L.ribbon(new L.Curve([[250, 470], [262, 380], [250, 280], [276, 190]]), (t) => 26 - 10 * t), { fill: trunk });
      // fronds
      const lf = L.leaf(250, 52, { belly: 0.45, sharp: 0.7, bend: 0.3 });
      [-168, -142, -112, -78, -48, -20, 8].forEach((a, i) => {
        const m = place(276, 190, a, i % 2 ? 1 : 0.9);
        s += path(lf.whole.transform(m), { fill: i % 2 ? green : mix(green.startsWith('#') ? green : '#6f8f75', '#000000', 0.12) });
      });
      s += circle(262, 206, 11, { fill: dark(p) });
      s += circle(286, 210, 11, { fill: dark(p) });
      // hammock
      s += path(new Path().M(262, 340).C(330, 450, 470, 450, 560, 332).L(560, 352).C(470, 440, 330, 440, 262, 360).Z(), { fill: col(p, 0) });
      s += path(new Path().M(262, 340).C(330, 450, 470, 450, 560, 332), stroke(col(p, 2), 7));
      for (let i = 1; i < 6; i++) {
        const t = i / 6, x = 262 + 298 * t;
        s += path(new Path().M(x, 352 + Math.sin(t * Math.PI) * 74).L(x, 372 + Math.sin(t * Math.PI) * 66), stroke(col(p, 2), 4));
      }
      // sun
      s += circle(560, 120, 58, { fill: warm(p) });
      s += path(sparkle(120, 130, 28), { fill: '#ffffff', 'fill-opacity': 0.8 });
      return s;
    },
  },
  // ------------------------------------------------------------------------------------------------------------------ champagne flutes
  {
    slug: 'sektglaeser', name: 'Sektgläser', w: 620, h: 600, palettes: DUO, fit: 24,
    tags: ['Sekt', 'Champagner', 'Prost', 'Anstoßen', 'Gläser', 'Feier', 'Hochzeitstag', 'Jubiläum', 'Silvester', 'Party'],
    draw(c) {
      const { p } = c;
      const fizz = p.mono ? p.tones[2] : '#f6d77a';
      let s = '';
      const flute = (cx, cy, deg) => {
        const m = place(cx, cy, deg, 1);
        const glass = new Path().M(-40, -190).L(40, -190).C(44, -60, 24, -10, 8, 8).L(8, 150).L(8, 196).C(60, 204, 60, 226, 60, 232).L(-60, 232).C(-60, 226, -60, 204, -8, 196).L(-8, 150).L(-8, 8).C(-24, -10, -44, -60, -40, -190).Z().transform(m);
        const wine = new Path().M(-40.5, -120).L(40.5, -120).C(40, -50, 24, -10, 8, 8).L(-8, 8).C(-24, -10, -40, -50, -40.5, -120).Z().transform(m);
        let o = path(glass, { fill: '#ffffff', 'fill-opacity': 0.55 });
        o += path(wine, { fill: fizz });
        o += path(glass, stroke(p.mono ? p.tones[0] : '#9ab0c4', 7));
        [[-10, -80], [14, -60], [-6, -30], [10, -100], [-18, -108]].forEach(([x, y], i) => { const q = L.ap(m, [x, y]); o += circle(q[0], q[1], 6 - (i % 2) * 2, { fill: '#ffffff', 'fill-opacity': 0.8 }); });
        o += path(new Path().M(-26, -170).C(-28, -120, -22, -80, -14, -50).transform(m), stroke('#ffffff', 7, { 'stroke-opacity': 0.8 }));
        return o;
      };
      s += flute(170, 330, -16);
      s += flute(450, 330, 16);
      s += path(sparkle(310, 70, 60), { fill: warm(p) });
      s += path(sparkle(230, 36, 22), { fill: col(p, 0) });
      s += path(sparkle(396, 40, 26), { fill: col(p, 3) });
      return s;
    },
  },
  // ------------------------------------------------------------------------------------------------------------------ baby body
  {
    slug: 'babybody', name: 'Babybody', w: 600, h: 560, palettes: DUO, fit: 24,
    tags: ['Baby', 'Body', 'Strampler', 'Geburt', 'Neugeborenes', 'Babyparty', 'Junge', 'Mädchen', 'Nachwuchs'],
    draw(c) {
      const { p } = c;
      const b = p.mono ? p.tones[1] : col(p, 3);
      let s = '';
      const body = smooth([[222, 96], [160, 120], [92, 190], [60, 250], [118, 284], [168, 244], [180, 270], [180, 420], [208, 480], [240, 504], [360, 504], [392, 480], [420, 420], [420, 270], [432, 244], [482, 284], [540, 250], [508, 190], [440, 120], [378, 96]], true);
      s += path(body, { fill: b });
      s += path(poly([[180, 270], [180, 420], [208, 480], [240, 504], [300, 504], [300, 270]]), shade(0.06));
      s += path(new Path().M(222, 96).C(250, 150, 350, 150, 378, 96).C(350, 112, 250, 112, 222, 96).Z(), shade(0.16));
      s += path(new Path().M(222, 96).C(250, 150, 350, 150, 378, 96), stroke('#ffffff', 8, { 'stroke-opacity': 0.55 }));
      s += path(new Path().M(114, 284).L(168, 244).M(486, 284).L(432, 244), stroke('#ffffff', 6, { 'stroke-opacity': 0.4 }));
      s += path(heart(300, 300, 78), { fill: col(p, 0) });
      for (const x of [262, 300, 338]) s += circle(x, 470, 10, { fill: '#ffffff', 'fill-opacity': 0.9 });
      s += path(new Path().M(214, 500).C(260, 520, 340, 520, 386, 500), stroke('#ffffff', 6, { 'stroke-opacity': 0.45 }));
      return s;
    },
  },
  // ------------------------------------------------------------------------------------------------------------------ rocking chair
  {
    slug: 'schaukelstuhl', name: 'Schaukelstuhl', w: 600, h: 600, palettes: DUO, fit: 24,
    tags: ['Schaukelstuhl', 'Ruhestand', 'Rente', 'Entspannung', 'Gemütlich', 'Großeltern', 'Oma', 'Opa', 'Ruhe'],
    draw(c) {
      const { p } = c;
      const wood = p.mono ? p.tones[0] : p.id === 'pastell' ? '#d9a877' : '#b9814f';
      let s = '';
      s += path(new Path().M(170, 90).C(200, 180, 215, 280, 230, 380), stroke(wood, 18));
      s += path(new Path().M(250, 80).C(278, 170, 293, 270, 308, 370), stroke(wood, 18));
      s += path(new Path().M(160, 110).L(262, 100).M(172, 168).L(272, 158).M(184, 226).L(284, 216), stroke(wood, 20));
      s += path(rrect(150, 60, 130, 40, 20), { fill: wood });
      s += path(new Path().M(215, 380).L(470, 380), stroke(wood, 22));
      s += path(new Path().M(470, 380).L(470, 300), stroke(wood, 18));
      s += path(rrect(448, 288, 70, 26, 13), { fill: wood });
      s += path(new Path().M(250, 395).L(220, 490).M(440, 395).L(460, 490), stroke(wood, 16));
      s += path(new Path().M(90, 490).C(200, 560, 420, 560, 530, 480), stroke(wood, 20));
      // cushion + blanket
      s += path(rrect(205, 340, 270, 50, 22), { fill: col(p, 0) });
      s += path(rrect(205, 340, 270, 24, 12), light(0.2));
      s += path(rrect(208, 130, 62, 190, 28).transform(place(0, 0, 0, 1)), light(0));
      s += path(new Path().M(300, 320).C(360, 330, 440, 340, 480, 330).L(470, 380).L(290, 380).Z(), { fill: col(p, 2) });
      return s;
    },
  },
  // ------------------------------------------------------------------------------------------------------------------ plant pot
  {
    slug: 'blumentopf', name: 'Blumentopf', w: 520, h: 640, palettes: DUO, fit: 24,
    tags: ['Blumentopf', 'Pflanze', 'Blume', 'Garten', 'Frühling', 'Wachsen', 'Dankeschön', 'Geschenk', 'Einzug'],
    draw(c) {
      const { p } = c;
      const green = leafGreen(p);
      let s = '';
      s += path(new Path().M(260, 420).C(262, 330, 258, 250, 260, 190), stroke(green, 12));
      const lf = L.leaf(150, 44, { belly: 0.45, sharp: 0.7 });
      s += path(lf.whole.transform(place(260, 400, -150, 1)), { fill: green });
      s += path(lf.whole.transform(place(260, 340, -30, 1)), { fill: green });
      s += path(lf.lower.transform(place(260, 400, -150, 1)), shade(0.14));
      s += path(lf.upper.transform(place(260, 340, -30, 1)), shade(0.14));
      // flower
      for (let i = 0; i < 8; i++) s += path(ellipsePath(0, -58, 24, 46).transform(place(260, 140, i * 45, 1)), { fill: col(p, i % 2 ? 0 : 5) });
      s += circle(260, 140, 32, { fill: warm(p) });
      s += circle(250, 130, 9, { fill: '#ffffff', 'fill-opacity': 0.4 });
      // pot
      s += path(new Path().M(140, 420).L(380, 420).L(350, 600).Q(348, 614, 334, 614).L(186, 614).Q(172, 614, 170, 600).Z(), { fill: col(p, 2) });
      s += path(new Path().M(300, 420).L(380, 420).L(350, 600).Q(348, 614, 334, 614).L(290, 614).Z(), shade(0.1));
      s += path(rrect(122, 396, 276, 52, 14), { fill: col(p, 2) });
      s += path(rrect(122, 396, 276, 52, 14), light(0.12));
      s += path(rrect(122, 428, 276, 20, 10), shade(0.1));
      return s;
    },
  },
  // ------------------------------------------------------------------------------------------------------------------ envelope
  {
    slug: 'briefumschlag', name: 'Briefumschlag mit Herz', w: 620, h: 480, palettes: [...DUO, 'boho'], fit: 24,
    tags: ['Brief', 'Umschlag', 'Post', 'Liebesbrief', 'Nachricht', 'Denk an dich', 'Gruß', 'Valentinstag', 'Karte'],
    draw(c) {
      const { p } = c;
      let s = '';
      s += path(rrect(60, 80, 500, 340, 20), { fill: col(p, 1) });
      s += path(new Path().M(60, 400).L(250, 250).M(560, 400).L(370, 250), stroke('#000000', 4, { 'stroke-opacity': 0.12 }));
      s += path(new Path().M(60, 100).Q(60, 80, 80, 80).L(540, 80).Q(560, 80, 560, 100).L(560, 120).L(310, 290).L(60, 120).Z(), { fill: col(p, 1) });
      s += path(new Path().M(60, 100).Q(60, 80, 80, 80).L(540, 80).Q(560, 80, 560, 100).L(560, 120).L(310, 290).L(60, 120).Z(), shade(0.1));
      s += path(new Path().M(70, 96).L(310, 268).L(550, 96), stroke('#ffffff', 5, { 'stroke-opacity': 0.45 }));
      s += circle(310, 276, 46, { fill: col(p, 0) });
      s += path(heart(310, 276, 48), { fill: '#ffffff' });
      return s;
    },
  },
  // ------------------------------------------------------------------------------------------------------------------ sun with sunglasses
  {
    slug: 'sonne-brille', name: 'Sonne mit Sonnenbrille', w: 560, h: 560, palettes: DUO, fit: 24,
    tags: ['Sonne', 'Sonnenbrille', 'Sommer', 'Urlaub', 'Gute Laune', 'Ruhestand', 'Fröhlich', 'Strand', 'Cool'],
    draw(c) {
      const { p } = c;
      const sun = warm(p), ray = p.mono ? p.tones[1] : p.id === 'pastell' ? '#f9b98e' : '#ff8c42';
      let s = '';
      for (let i = 0; i < 12; i++) s += path(new Path().add(rrect(-17, -246, 34, 70, 17)).transform(place(280, 280, i * 30, 1)), { fill: i % 2 ? sun : ray });
      s += circle(280, 280, 150, { fill: sun });
      s += circle(280, 280, 150, { fill: '#ffffff', 'fill-opacity': 0.1 });
      const gl = dark(p);
      s += path(rrect(148, 236, 112, 82, 30), { fill: gl });
      s += path(rrect(300, 236, 112, 82, 30), { fill: gl });
      s += path(new Path().M(258, 258).Q(280, 244, 302, 258), stroke(gl, 12));
      s += path(new Path().M(148, 252).L(118, 240).M(412, 252).L(442, 240), stroke(gl, 10));
      s += path(new Path().M(200, 360).C(240, 410, 320, 410, 360, 360), stroke(dark(p), 12));
      s += circle(176, 352, 20, { fill: ray, 'fill-opacity': 0.45 });
      s += circle(384, 352, 20, { fill: ray, 'fill-opacity': 0.45 });
      return s;
    },
  },
  // ------------------------------------------------------------------------------------------------------------------ wedding rings
  {
    slug: 'eheringe', name: 'Eheringe', w: 640, h: 560, palettes: ['gold', 'rose'], fit: 24,
    tags: ['Ringe', 'Eheringe', 'Hochzeitstag', 'Hochzeit', 'Jubiläum', 'Liebe', 'Verlobung', 'Trauring', 'Ehe'],
    draw(c) {
      const { p } = c;
      const ring = p.tones[1], ringD = p.tones[0], ringL = p.tones[2];
      let s = '';
      const r = 120, sw = 28;
      const c1 = [250, 330], c2 = [390, 330];
      s += circle(c2[0], c2[1], r, { fill: 'none', stroke: ring, 'stroke-width': sw });
      s += circle(c1[0], c1[1], r, { fill: 'none', stroke: ringD, 'stroke-width': sw });
      // redraw the part of ring 2 over ring 1 at the lower crossing
      s += path(new Path().arc(c2[0], c2[1], r, r, 100, 150, true), { fill: 'none', stroke: ring, 'stroke-width': sw });
      s += circle(c1[0], c1[1], r + 14, { fill: 'none', stroke: '#ffffff', 'stroke-width': 3, 'stroke-opacity': 0.0 });
      s += circle(c2[0], c2[1], r - 6, { fill: 'none', stroke: ringL, 'stroke-width': 4, 'stroke-opacity': 0.7 });
      s += circle(c1[0], c1[1], r - 6, { fill: 'none', stroke: ringL, 'stroke-width': 4, 'stroke-opacity': 0.5 });
      // gem on the second ring
      s += path(poly([[390, 150], [424, 172], [412, 210], [368, 210], [356, 172]]), { fill: '#e9f6fd' });
      s += path(poly([[390, 150], [424, 172], [390, 184], [356, 172]]), { fill: '#ffffff' });
      s += path(poly([[390, 184], [424, 172], [412, 210], [390, 210]]), { fill: '#b9dcef' });
      s += path(sparkle(450, 130, 34), { fill: ringL });
      s += path(sparkle(300, 90, 20), { fill: ringL });
      return s;
    },
  },
  // ------------------------------------------------------------------------------------------------------------------ candle
  {
    slug: 'kerze', name: 'Kerze', w: 360, h: 640, palettes: ['gold', 'navy', 'rose'], fit: 24,
    tags: ['Kerze', 'Trauer', 'Gedenken', 'Erinnerung', 'Licht', 'Danksagung', 'Ruhe', 'Trost', 'Andacht'],
    draw(c) {
      const { p } = c;
      let s = '';
      s += circle(180, 130, 92, { fill: '#ffd778', 'fill-opacity': 0.22 });
      s += circle(180, 130, 62, { fill: '#ffd778', 'fill-opacity': 0.22 });
      s += path(new Path().M(180, 40).C(220, 90, 232, 130, 180, 176).C(128, 130, 140, 90, 180, 40).Z(), { fill: '#f6b73c' });
      s += path(new Path().M(180, 100).C(202, 128, 206, 150, 180, 172).C(154, 150, 158, 128, 180, 100).Z(), { fill: '#fff1b8' });
      s += path(new Path().M(180, 176).L(180, 212), stroke(p.tones[0], 7));
      s += path(rrect(100, 210, 160, 340, 14), { fill: p.tones[2] });
      s += path(rrect(180, 210, 80, 340, 14), shade(0.1));
      s += path(new Path().M(100, 224).Q(100, 210, 114, 210).L(246, 210).Q(260, 210, 260, 224).L(260, 240).Q(240, 262, 224, 240).Q(210, 220, 196, 244).Q(176, 276, 156, 244).Q(140, 222, 120, 246).Q(106, 256, 100, 240).Z(), light(0.35));
      s += path(rrect(100, 310, 18, 200, 9), light(0.28));
      s += path(rrect(50, 548, 260, 36, 18), { fill: p.tones[1] });
      s += path(rrect(50, 548, 260, 36, 18), shade(0.1));
      return s;
    },
  },
  // ------------------------------------------------------------------------------------------------------------------ beer mug
  {
    slug: 'bierkrug', name: 'Bierkrug', w: 560, h: 560, palettes: ['bunt', 'boho'], fit: 24,
    tags: ['Bier', 'Krug', 'Prost', 'Männer', 'Geburtstag', 'Kneipe', 'Feierabend', 'Oktoberfest', 'Stammtisch'],
    draw(c) {
      const { p } = c;
      let s = '';
      s += path(new Path().M(396, 200).C(540, 200, 540, 450, 396, 450), stroke('#dfe6ee', 28));
            s += path(rrect(100, 140, 310, 380, 34), { fill: '#f2b134' });
      s += path(rrect(100, 140, 310, 380, 34), shade(0.0));
      s += path(rrect(100, 330, 310, 190, 34), { fill: '#e29a1c', 'fill-opacity': 0.55 });
      s += path(rrect(100, 140, 310, 380, 34), { fill: 'none', stroke: '#dfe6ee', 'stroke-width': 14 });
      s += path(rrect(140, 190, 22, 280, 11), light(0.45));
      s += path(rrect(210, 200, 22, 250, 11), light(0.25));
      for (const [x, y] of [[300, 400], [340, 330], [270, 290], [360, 440], [310, 230]]) s += circle(x, y, 8, { fill: '#ffffff', 'fill-opacity': 0.5 });
      // foam
      s += circle(150, 130, 52, { fill: '#ffffff' });
      s += circle(222, 100, 62, { fill: '#ffffff' });
      s += circle(300, 92, 58, { fill: '#ffffff' });
      s += circle(366, 124, 52, { fill: '#ffffff' });
      s += path(rrect(100, 120, 310, 56, 20), { fill: '#ffffff' });
      s += path(new Path().M(104, 170).C(180, 190, 330, 190, 406, 170).L(406, 186).C(330, 206, 180, 206, 104, 186).Z(), { fill: '#eef1f6' });
      return s;
    },
  },
  // ------------------------------------------------------------------------------------------------------------------ plaster heart
  {
    slug: 'pflaster-herz', name: 'Herz mit Pflaster', w: 560, h: 540, palettes: DUO, fit: 24,
    tags: ['Pflaster', 'Herz', 'Pflege', 'Danke Pflege', 'Gesundheit', 'Gute Besserung', 'Helfer', 'Krankenpflege', 'Ärzte', 'Fürsorge'],
    draw(c) {
      const { p } = c;
      let s = '';
      s += path(heart(280, 260, 440), { fill: col(p, 0) });
      s += path(heart(280, 260, 440).transform(place(0, 0, 0, 1)), light(0.0));
      s += path(ellipsePath(170, 150, 44, 22, -35), light(0.4));
      const pc = skin(p);
      const pl = L.compose(L.move(280, 290), L.rotm(-38), L.move(-280, -290));
      s += path(rrect(110, 252, 340, 76, 38).transform(pl), { fill: pc });
      s += path(rrect(110, 252, 340, 76, 38).transform(pl), shade(0.05));
      s += path(rrect(228, 262, 104, 56, 8).transform(pl), { fill: '#ffffff', 'fill-opacity': 0.75 });
      for (const x of [150, 178, 206, 354, 382, 410]) for (const y of [276, 302]) s += circle(...L.ap(pl, [x, y]), 4, { fill: '#000000', 'fill-opacity': 0.14 });
      return s;
    },
  },
  // ------------------------------------------------------------------------------------------------------------------ compass
  {
    slug: 'kompass', name: 'Kompass', w: 560, h: 560, palettes: [...DUO, 'boho'], fit: 24,
    tags: ['Kompass', 'Reise', 'Abenteuer', 'Richtung', 'Neuanfang', 'Gute Reise', 'Auswandern', 'Wanderung', 'Weg'],
    draw(c) {
      const { p } = c;
      let s = '';
      s += circle(280, 280, 230, { fill: col(p, 1) });
      s += circle(280, 280, 230, shade(0.1));
      s += circle(280, 280, 192, { fill: '#fffdf6' });
      for (let i = 0; i < 24; i++) {
        const major = i % 6 === 0;
        s += path(new Path().add(rrect(-3, -188, 6, major ? 34 : 18, 3)).transform(place(280, 280, i * 15, 1)), { fill: major ? col(p, 0) : '#b8bcc8' });
      }
      s += path(poly([[280, 120], [320, 280], [280, 292], [240, 280]]), { fill: col(p, 0) });
      s += path(poly([[280, 440], [320, 280], [280, 292], [240, 280]]), { fill: dark(p) });
      s += path(poly([[280, 120], [320, 280], [280, 292]]), light(0.18));
      s += circle(280, 280, 16, { fill: '#ffffff', stroke: dark(p), 'stroke-width': 6 });
      s += path(rrect(262, 24, 36, 40, 10), { fill: col(p, 1) });
      return s;
    },
  },
  // ------------------------------------------------------------------------------------------------------------------ driving licence
  {
    slug: 'fuehrerschein', name: 'Führerschein', w: 620, h: 440, palettes: DUO, fit: 24,
    tags: ['Führerschein', 'Karte', 'Fahrerlaubnis', 'Fahrprüfung', 'Bestanden', 'Auto', 'Ausweis', 'Fahranfänger'],
    draw(c) {
      const { p } = c;
      let s = '';
      s += path(rrect(50, 60, 520, 330, 30), { fill: '#fbfbf7' });
      s += path(rrect(50, 60, 520, 330, 30), shade(0.04));
      s += path(new Path().M(50, 90).Q(50, 60, 80, 60).L(540, 60).Q(570, 60, 570, 90).L(570, 140).L(50, 140).Z(), { fill: col(p, 3) });
      s += circle(100, 100, 18, { fill: '#ffffff', 'fill-opacity': 0.9 });
      s += path(rrect(134, 90, 150, 12, 6), light(0.85));
      s += path(rrect(86, 170, 150, 190, 12), { fill: col(p, 1) });
      s += circle(161, 238, 34, { fill: skin(p) });
      s += path(new Path().M(100, 360).Q(110, 290, 161, 290).Q(212, 290, 222, 360).Z(), { fill: col(p, 0) });
      for (const [y, w] of [[176, 190], [212, 150], [248, 170], [284, 110]]) s += path(rrect(270, y, w, 16, 8), { fill: '#d6d9e2' });
      s += path(rrect(270, 332, 90, 28, 8), { fill: col(p, 2) });
      s += path(rrect(486, 326, 56, 38, 8), { fill: warm(p) });
      s += path(new Path().M(486, 345).L(542, 345).M(514, 326).L(514, 364), stroke('#000000', 3, { 'stroke-opacity': 0.25 }));
      return s;
    },
  },
  // ------------------------------------------------------------------------------------------------------------------ diploma
  {
    slug: 'urkunde-rolle', name: 'Urkundenrolle', w: 640, h: 440, palettes: [...DUO, 'navy'], fit: 24,
    tags: ['Urkunde', 'Zeugnis', 'Diplom', 'Abschluss', 'Prüfung', 'Bestanden', 'Rolle', 'Zertifikat', 'Abitur'],
    draw(c) {
      const { p } = c;
      const paper = '#fff6e2', paperD = '#ead9b5';
      let s = '';
      s += path(new Path().M(110, 140).L(530, 140).L(530, 320).L(110, 320).Z(), { fill: paper });
      s += path(new Path().M(110, 280).L(530, 280).L(530, 320).L(110, 320).Z(), shade(0.04));
      for (const [y, w] of [[188, 260], [220, 300], [252, 220]]) s += path(rrect(160, y, w, 10, 5), { fill: '#d9cfb6' });
      s += path(ellipsePath(110, 230, 44, 92), { fill: paperD });
      s += path(ellipsePath(110, 230, 44, 92), stroke('#cdbb92', 4));
      s += path(new Path().arc(110, 230, 26, 56, -90, 90, true), stroke('#cdbb92', 4));
      s += path(ellipsePath(530, 230, 44, 92), { fill: '#fff9ec' });
      s += path(ellipsePath(530, 230, 44, 92), stroke('#d8c9a2', 4));
      s += path(new Path().arc(530, 230, 24, 52, 90, 270, true), stroke('#d8c9a2', 4));
      // ribbon
      s += path(rrect(300, 130, 36, 200, 0), { fill: col(p, 0) });
      s += path(new Path().M(318, 230).C(260, 170, 230, 220, 258, 252).C(280, 266, 310, 246, 318, 230).Z(), { fill: col(p, 0) });
      s += path(new Path().M(318, 230).C(376, 170, 406, 220, 378, 252).C(356, 266, 326, 246, 318, 230).Z(), { fill: col(p, 0) });
      s += path(new Path().M(318, 230).C(260, 170, 230, 220, 258, 252).C(280, 266, 310, 246, 318, 230).Z(), shade(0.1));
      s += path(rrect(300, 130, 36, 200, 0), shade(0.08));
      s += circle(318, 234, 20, { fill: col(p, 0) });
      s += circle(318, 234, 20, shade(0.12));
      return s;
    },
  },
  // ------------------------------------------------------------------------------------------------------------------ trophy
  {
    slug: 'siegerpokal', name: 'Siegerpokal', w: 520, h: 620, palettes: ['gold', 'navy'], fit: 24,
    tags: ['Pokal', 'Sieg', 'Gewinner', 'Erfolg', 'Bestanden', 'Meister', 'Champion', 'Auszeichnung', 'Glückwunsch'],
    draw(c) {
      const { p } = c;
      const m = p.tones[1], d = p.tones[0], l = p.tones[2];
      let s = '';
      s += path(new Path().M(150, 120).C(60, 120, 50, 250, 150, 280).M(370, 120).C(460, 120, 470, 250, 370, 280), stroke(m, 24, { 'stroke-linecap': 'butt' }));
      s += path(new Path().M(110, 80).L(410, 80).C(410, 240, 370, 330, 300, 350).L(220, 350).C(150, 330, 110, 240, 110, 80).Z(), { fill: m });
      s += path(new Path().M(260, 80).L(410, 80).C(410, 240, 370, 330, 300, 350).L(260, 350).Z(), { fill: d, 'fill-opacity': 0.35 });
      s += path(rrect(110, 62, 300, 36, 18), { fill: l });
      s += path(new Path().M(150, 130).C(150, 210, 170, 270, 200, 300), stroke('#ffffff', 14, { 'stroke-opacity': 0.4 }));
      s += path(L.starPath(260, 190, 46, 20, 5), { fill: l });
      s += path(rrect(236, 350, 48, 86, 6), { fill: d });
      s += path(rrect(180, 430, 160, 40, 10), { fill: m });
      s += path(rrect(140, 466, 240, 56, 14), { fill: d });
      s += path(rrect(140, 466, 240, 20, 10), light(0.15));
      return s;
    },
  },
  // ------------------------------------------------------------------------------------------------------------------ heart with arrow
  {
    slug: 'herz-pfeil', name: 'Herz mit Pfeil', w: 600, h: 560, palettes: DUO, fit: 24,
    tags: ['Herz', 'Pfeil', 'Amor', 'Valentinstag', 'Liebe', 'Verliebt', 'Hochzeitstag', 'Romantik'],
    draw(c) {
      const { p } = c;
      const arrow = p.mono ? p.tones[0] : '#5c4a43';
      let s = '';
      s += path(new Path().M(490, 70).L(120, 480), stroke(arrow, 13));
      s += path(heart(300, 290, 420), { fill: col(p, 0) });
      s += path(ellipsePath(188, 190, 46, 22, -35), light(0.4));
      s += path(new Path().M(300, 480).C(470, 390, 520, 260, 440, 190).C(420, 300, 380, 400, 300, 480).Z(), shade(0.1));
      s += path(poly([[56, 0], [-14, -34], [-14, 34]]).transform(place(112, 489, 132.3, 1)), { fill: arrow });
      for (const off of [0, 34]) {
        const m = place(490 - off * 0.673, 70 + off * 0.74, 132.3, 1);
        s += path(poly([[0, 0], [-34, -30], [8, -30], [44, 0]]).transform(m), { fill: col(p, 3) });
        s += path(poly([[0, 0], [-34, 30], [8, 30], [44, 0]]).transform(m), { fill: col(p, 3) });
        s += path(poly([[0, 0], [-34, 30], [8, 30], [44, 0]]).transform(m), shade(0.1));
      }
      return s;
    },
  },
  // ------------------------------------------------------------------------------------------------------------------ clover
  {
    slug: 'kleeblatt', name: 'Kleeblatt', w: 560, h: 620, palettes: DUO, fit: 24,
    tags: ['Kleeblatt', 'Glück', 'Glücksbringer', 'Viel Glück', 'Prüfung', 'Neuanfang', 'Gute Reise', 'Neujahr'],
    draw(c) {
      const { p } = c;
      const gr = leafGreen(p);
      let s = '';
      s += path(new Path().M(280, 300).C(290, 400, 270, 480, 300, 580), stroke(gr, 14));
      for (let i = 0; i < 4; i++) {
        const m = place(280, 290, i * 90 + 45, 1);
        s += path(heart(0, -100, 150).transform(m), { fill: gr });
        s += path(new Path().M(0, -30).L(0, -165).transform(m), stroke('#ffffff', 5, { 'stroke-opacity': 0.4 }));
        s += path(heart(0, -100, 150).transform(m), shade(i % 2 ? 0.06 : 0));
      }
      s += circle(280, 290, 12, { fill: '#ffffff', 'fill-opacity': 0.3 });
      return s;
    },
  },
  // ------------------------------------------------------------------------------------------------------------------ flag with heart
  {
    slug: 'fahne-herz', name: 'Fahne mit Herz', w: 520, h: 640, palettes: DUO, fit: 24,
    tags: ['Fahne', 'Friedensfahne', 'Entschuldigung', 'Versöhnung', 'Frieden', 'Verzeihen', 'Neuanfang', 'Herz'],
    draw(c) {
      const { p } = c;
      let s = '';
      s += path(rrect(98, 50, 16, 560, 8), { fill: p.mono ? p.tones[0] : '#8a6a4c' });
      s += circle(106, 50, 18, { fill: warm(p) });
      s += path(new Path().M(114, 90).C(200, 60, 270, 130, 350, 100).C(410, 80, 440, 100, 460, 110).L(460, 320).C(440, 310, 410, 300, 350, 320).C(270, 350, 200, 280, 114, 320).Z(), { fill: p.mono ? p.tones[2] : '#e3effa' });
      s += path(new Path().M(114, 90).C(200, 60, 270, 130, 350, 100).C(410, 80, 440, 100, 460, 110).L(460, 320).C(440, 310, 410, 300, 350, 320).C(270, 350, 200, 280, 114, 320).Z(), shade(0.05));
      s += path(heart(288, 210, 100).transform(L.IDENT), { fill: col(p, 0) });
      s += path(rrect(70, 596, 72, 22, 11), shade(0.12));
      return s;
    },
  },
  // ------------------------------------------------------------------------------------------------------------------ moving box
  {
    slug: 'umzugskarton', name: 'Umzugskarton', w: 600, h: 520, palettes: [...DUO, 'boho'], fit: 24,
    tags: ['Karton', 'Umzug', 'Umzugskarton', 'Einzug', 'Neues Zuhause', 'Kiste', 'Verpackt', 'Abschied', 'Kollege'],
    draw(c) {
      const { p } = c;
      const cb = p.mono ? p.tones[1] : p.id === 'pastell' ? '#e6c79c' : p.id === 'boho' ? '#d9a86c' : '#d8a066';
      let s = '';
      s += path(new Path().M(70, 160).L(300, 110).L(530, 160).L(300, 210).Z(), { fill: mix(cb, '#ffffff', 0.22) });
      s += path(rrect(80, 190, 440, 270, 8), { fill: cb });
      s += path(rrect(80, 190, 440, 60, 6), shade(0.08));
      s += path(rrect(250, 190, 100, 270, 0), { fill: warm(p), 'fill-opacity': 0.0 });
      s += path(rrect(262, 120, 76, 150, 4), { fill: mix(cb, '#ffffff', 0.1) });
      s += path(rrect(262, 190, 76, 78, 0), { fill: '#ffffff', 'fill-opacity': 0.55 });
      s += path(rrect(262, 120, 76, 70, 4), { fill: '#ffffff', 'fill-opacity': 0.55 });
      s += path(rrect(250, 300, 100, 30, 15), shade(0.22));
      s += path(rrect(140, 380, 30, 14, 5), shade(0.12));
      s += path(heart(130, 330, 44), { fill: col(p, 0) });
      return s;
    },
  },
  // ------------------------------------------------------------------------------------------------------------------ alarm clock
  {
    slug: 'wecker', name: 'Wecker', w: 560, h: 580, palettes: DUO, fit: 24,
    tags: ['Wecker', 'Uhr', 'Zeit', 'Ruhestand', 'Rente', 'Aufstehen', 'Feierabend', 'Büro', 'Abschied', 'Kollege'],
    draw(c) {
      const { p } = c;
      let s = '';
      s += path(new Path().M(130, 130).C(60, 110, 70, 30, 130, 36).C(190, 42, 200, 100, 190, 130).Z().transform(L.IDENT), { fill: col(p, 2) });
      s += path(new Path().M(430, 130).C(500, 110, 490, 30, 430, 36).C(370, 42, 360, 100, 370, 130).Z(), { fill: col(p, 2) });
      s += path(new Path().M(130, 480).L(100, 550).M(430, 480).L(460, 550), stroke(dark(p), 22));
      s += circle(280, 310, 210, { fill: col(p, 0) });
      s += circle(280, 310, 210, light(0.1));
      s += circle(280, 310, 168, { fill: '#fffdf6' });
      for (let i = 0; i < 12; i++) s += path(new Path().add(rrect(-4, -150, 8, i % 3 === 0 ? 32 : 16, 4)).transform(place(280, 310, i * 30, 1)), { fill: i % 3 === 0 ? dark(p) : '#aeb3c0' });
      s += path(new Path().M(280, 310).L(280, 205), stroke(dark(p), 14));
      s += path(new Path().M(280, 310).L(350, 350), stroke(col(p, 0), 11));
      s += circle(280, 310, 14, { fill: dark(p) });
      s += path(rrect(262, 62, 36, 28, 8), { fill: col(p, 2) });
      return s;
    },
  },
  // ------------------------------------------------------------------------------------------------------------------ briefcase
  {
    slug: 'aktentasche', name: 'Aktentasche', w: 600, h: 500, palettes: DUO, fit: 24,
    tags: ['Aktentasche', 'Job', 'Beruf', 'Karriere', 'Neuer Job', 'Business', 'Arbeit', 'Büro', 'Koffer'],
    draw(c) {
      const { p } = c;
      const b = p.mono ? p.tones[0] : p.id === 'pastell' ? '#a9a2d6' : '#5c4a82';
      let s = '';
      s += path(new Path().M(220, 150).L(220, 110).Q(220, 88, 242, 88).L(358, 88).Q(380, 88, 380, 110).L(380, 150), stroke(b, 20, { 'stroke-linecap': 'butt' }));
      s += path(rrect(70, 140, 460, 320, 34), { fill: b });
      s += path(rrect(70, 140, 460, 130, 34), light(0.1));
      s += path(rrect(70, 240, 460, 40, 0), shade(0.14));
      s += path(rrect(262, 224, 76, 74, 12), { fill: warm(p) });
      s += circle(300, 261, 9, { fill: dark(p) });
      s += path(rrect(100, 270, 28, 150, 10), light(0.12));
      s += path(rrect(420, 410, 70, 14, 7), shade(0.2));
      return s;
    },
  },
];

module.exports = { pieces };
