'use strict';
// Motive of batch V5 (flyers for events II): running shoe, medal, trophy, football, tools, microphone, books, easel, theatre masks and curtain, lantern,
// Christmas market hut, market stall, Easter basket, Ferris wheel, wine glass and grapes, beer mug, pretzel, gingerbread heart, disco ball, question bubbles,
// blood drop, first aid case, church, school bag, building blocks, laptop, dancing couple, dumbbell, chef hat, hanger with shirt, notes, gear, paint palette.
// Flat, few colours, fixed colours (one variant each, so the key is deko-motive-<slug>). Every piece is drawn inside its viewBox with a margin.
const L = require('./lib');
const { Path, path, circle, g } = L;

const INK = '#23304a', RED = '#e5484d', ORANGE = '#f5871f', YELLOW = '#ffc83d', GREEN = '#2fa66a', TEAL = '#1fb3d6', BLUE = '#3a6fd8', PURPLE = '#7c5cd6', PINK = '#f06fa6';
const BROWN = '#8a5a3c', CREAM = '#fff4dc', WHITE = '#ffffff', GREY = '#8b95a5', LIGHT = '#dfe5ee', GOLD = '#f2b632', GOLD2 = '#d9951a';

const poly = (pts, fill, extra) => path(L.poly(pts), { fill, ...extra });
const rr = (x, y, w, h, r, fill, extra) => path(L.rrect(x, y, w, h, r), { fill, ...extra });
const ell = (cx, cy, rx, ry, fill, rot, extra) => path(L.ellipsePath(cx, cy, rx, ry, rot || 0), { fill, ...extra });
const ink = (d, color, w, extra) => path(d, { fill: 'none', stroke: color, 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', ...extra });
const shade = (p, o = 0.12, color = '#000000') => path(p, { fill: color, 'fill-opacity': o });
const rot = (deg, cx, cy, ...kids) => g({ transform: `rotate(${deg} ${cx} ${cy})` }, ...kids);
const at = (x, y, s, ...kids) => g({ transform: `translate(${x} ${y})${s && s !== 1 ? ` scale(${s})` : ''}` }, ...kids);
const mixc = L.mix;

const pieces = [
  // ------------------------------------------------------------------------------------------------ sport
  {
    slug: 'laufschuh', name: 'Laufschuh', w: 760, h: 520, palettes: ['bunt'], tags: ['Laufschuh', 'Sportschuh', 'Sneaker', 'Laufen', 'Lauf', 'Sport', 'Schuh', 'Marathon'],
    draw() {
      const body = new Path().M(70, 392).C(60, 300, 66, 214, 98, 168).C(120, 136, 160, 126, 200, 138).C(238, 150, 262, 188, 300, 208)
        .C(350, 232, 410, 246, 462, 276).C(528, 312, 604, 322, 650, 352).C(676, 372, 676, 392, 654, 396).L(70, 396).Z();
      const sole = new Path().M(44, 392).L(668, 392).C(700, 392, 698, 456, 652, 458).L(92, 458).C(56, 458, 44, 432, 44, 392).Z();
      let s = '';
      s += ink(new Path().M(26, 214).L(86, 214), '#b8c6e3', 14);
      s += ink(new Path().M(14, 262).L(60, 262), '#b8c6e3', 14);
      s += ink(new Path().M(22, 310).L(52, 310), '#b8c6e3', 14);
      s += path(body, { fill: BLUE });
      s += path(new Path().M(70, 396).C(66, 330, 120, 300, 200, 300).C(330, 300, 400, 330, 470, 396).Z(), { fill: '#2c56b0' });
      s += path(new Path().M(98, 168).C(120, 136, 160, 126, 200, 138).C(226, 146, 244, 166, 262, 184).L(230, 232).C(196, 200, 150, 190, 104, 214).Z(), { fill: '#1f3f86' });
      s += path(new Path().M(462, 276).C(528, 312, 604, 322, 650, 352).C(676, 372, 676, 392, 654, 396).L(520, 396).C(530, 350, 500, 306, 462, 276).Z(), { fill: '#5b8cf0' });
      s += path(new Path().M(120, 330).C(190, 300, 300, 320, 380, 396).L(300, 396).C(260, 350, 190, 336, 120, 346).Z(), { fill: ORANGE });
      // laces
      for (let i = 0; i < 4; i++) {
        const x = 262 + i * 52, y = 214 + i * 24;
        s += ink(new Path().M(x - 14, y + 24).L(x + 22, y - 14), WHITE, 13);
      }
      s += path(sole, { fill: WHITE });
      s += path(new Path().M(48, 420).L(676, 420).C(688, 440, 674, 458, 652, 458).L(92, 458).C(66, 458, 50, 446, 48, 420).Z(), { fill: '#c4cee0' });
      s += ink(new Path().M(120, 408).L(250, 408), '#c4cee0', 8);
      return s;
    },
  },
  {
    slug: 'medaille', name: 'Medaille mit Band', w: 520, h: 740, palettes: ['bunt'], tags: ['Medaille', 'Sieger', 'Auszeichnung', 'Gold', 'Lauf', 'Turnier', 'Sport', 'Preis', 'Platz'],
    draw() {
      let s = '';
      s += poly([[120, 24], [236, 24], [300, 330], [190, 330]], BLUE);
      s += poly([[400, 24], [284, 24], [220, 330], [330, 330]], RED);
      s += poly([[236, 24], [284, 24], [260, 190]], '#1f3f86');
      s += shade(L.poly([[190, 330], [300, 330], [262, 200]]), 0.15);
      s += circle(260, 480, 190, { fill: GOLD2 });
      s += circle(260, 480, 168, { fill: GOLD });
      s += circle(260, 480, 130, { fill: '#ffd866' });
      s += circle(260, 480, 130, { fill: 'none', stroke: GOLD2, 'stroke-width': 8 });
      s += path(L.starPath(260, 484, 84, 36, 5), { fill: GOLD2 });
      s += path(new Path().M(146, 380).C(190, 330, 260, 320, 330, 340).C(250, 350, 190, 380, 160, 440).Z(), { fill: '#fff', 'fill-opacity': 0.28 });
      return s;
    },
  },
  {
    slug: 'siegerpokal', name: 'Pokal', w: 600, h: 720, palettes: ['bunt'], tags: ['Pokal', 'Cup', 'Turnier', 'Sieger', 'Gewinn', 'Sport', 'Meister', 'Preis'],
    draw() {
      let s = '';
      s += ink(new Path().M(130, 150).C(30, 150, 30, 330, 190, 346), GOLD2, 34);
      s += ink(new Path().M(470, 150).C(570, 150, 570, 330, 410, 346), GOLD2, 34);
      s += path(new Path().M(110, 70).L(490, 70).C(490, 270, 440, 380, 300, 396).C(160, 380, 110, 270, 110, 70).Z(), { fill: GOLD });
      s += path(new Path().M(300, 70).L(490, 70).C(490, 270, 440, 380, 300, 396).Z(), { fill: GOLD2, 'fill-opacity': 0.55 });
      s += ell(300, 70, 190, 24, '#ffd866');
      s += ell(300, 70, 160, 14, GOLD2);
      s += path(new Path().M(150, 130).C(150, 240, 176, 316, 220, 350).C(190, 300, 176, 220, 190, 130).Z(), { fill: '#fff', 'fill-opacity': 0.35 });
      s += path(L.starPath(300, 220, 52, 22, 5), { fill: '#fff6d0' });
      s += rr(268, 392, 64, 120, 10, GOLD2);
      s += rr(236, 500, 128, 38, 12, GOLD);
      s += rr(170, 530, 260, 70, 12, INK);
      s += rr(170, 530, 260, 20, 10, '#3a4a6c');
      s += rr(210, 560, 180, 22, 6, GOLD, { 'fill-opacity': 0.9 });
      return s;
    },
  },
  {
    slug: 'fussball', name: 'Fußball', w: 560, h: 560, palettes: ['bunt'], tags: ['Fußball', 'Ball', 'Turnier', 'Sport', 'Kicker', 'Spiel', 'Fussball'],
    draw() {
      let s = '';
      const cx = 280, cy = 280, R = 244;
      s += circle(cx, cy, R, { fill: WHITE, stroke: INK, 'stroke-width': 14 });
      const pent = (x, y, r, a) => L.starPath(x, y, r, r * 0.809, 5, a);
      s += path(pent(cx, cy, 78, -90), { fill: INK });
      for (let i = 0; i < 5; i++) {
        const a = L.rad(-90 + i * 72);
        const x1 = cx + Math.cos(a) * 78 * 0.97, y1 = cy + Math.sin(a) * 78 * 0.97;
        const x2 = cx + Math.cos(a) * 150, y2 = cy + Math.sin(a) * 150;
        s += ink(new Path().M(x1, y1).L(x2, y2), INK, 12);
        const b = L.rad(-54 + i * 72);
        const px = cx + Math.cos(b) * 176, py = cy + Math.sin(b) * 176;
        s += path(pent(px, py, 54, -54 + i * 72 + 180 - 36 + 36), { fill: INK });
        const xo = cx + Math.cos(a) * 150, yo = cy + Math.sin(a) * 150;
        const ang = [-90 + 36, -90 - 36].map((d) => L.rad(d + i * 72));
        void xo; void yo; void ang;
      }
      s += circle(cx, cy, R - 14, { fill: 'none', stroke: WHITE, 'stroke-width': 28 });
      s += circle(cx, cy, R, { fill: 'none', stroke: INK, 'stroke-width': 14 });
      return s;
    },
  },
  {
    slug: 'hantel', name: 'Hantel', w: 620, h: 380, palettes: ['bunt'], tags: ['Hantel', 'Fitness', 'Training', 'Gewicht', 'Kraft', 'Sport', 'Studio'],
    draw() {
      const body = [
        rr(250, 235, 260, 50, 24, '#b9c2d3'),
        rr(250, 235, 260, 16, 8, '#d9deea'),
        rr(176, 150, 48, 220, 14, INK), rr(140, 190, 40, 140, 12, '#3a4a6c'), rr(104, 220, 40, 80, 10, INK),
        rr(536, 150, 48, 220, 14, INK), rr(580, 190, 40, 140, 12, '#3a4a6c'), rr(616, 220, 40, 80, 10, INK),
        rr(224, 222, 30, 76, 6, ORANGE), rr(506, 222, 30, 76, 6, ORANGE),
        rr(184, 160, 10, 200, 5, '#fff', { 'fill-opacity': 0.18 }), rr(544, 160, 10, 200, 5, '#fff', { 'fill-opacity': 0.18 }),
      ];
      return at(-70, -100, 1, rot(-18, 380, 260, ...body));
    },
  },
  // ------------------------------------------------------------------------------------------------ workshop, repair, kitchen
  {
    slug: 'werkzeug', name: 'Schraubenschlüssel und Schraubendreher', w: 640, h: 640, palettes: ['bunt'], tags: ['Werkzeug', 'Schraubenschlüssel', 'Schraubendreher', 'Reparatur', 'Repair', 'Handwerk', 'Werkstatt'],
    draw() {
      const slot = new Path().arc(0, 0, 84, 84, -70, 250, true).L(-30, -24).L(30, -24).Z();
      const wrench = g({ transform: 'translate(320 320) rotate(45)' },
        path(L.rrect(-24, -20, 48, 330, 22), { fill: '#a9b4c8' }),
        path(L.rrect(-24, -20, 18, 330, 9), { fill: '#d5dcea' }),
        circle(0, 276, 11, { fill: INK }),
        at(0, -190, 1, path(slot, { fill: '#a9b4c8' }), path(new Path().arc(0, 0, 84, 84, 10, 70, true).L(0, 0).Z(), { fill: '#fff', 'fill-opacity': 0.18 })),
        rr(-26, -118, 52, 110, 4, '#a9b4c8'));
      return wrench + g({ transform: 'translate(320 320) rotate(-45)' },
        path(L.poly([[-8, -250], [8, -250], [10, -80], [-10, -80]]), { fill: '#a9b4c8' }),
        path(L.rrect(-17, -90, 34, 160, 6), { fill: '#c4cee0' }),
        path(L.rrect(-26, 40, 52, 220, 20), { fill: RED }),
        path(L.rrect(-26, 40, 16, 220, 8), { fill: '#fff', 'fill-opacity': 0.25 }),
        path(L.poly([[-6, -250], [6, -250], [3, -286], [-3, -286]]), { fill: '#a9b4c8' }));
    },
  },
  {
    slug: 'zahnrad', name: 'Zahnräder', w: 640, h: 560, palettes: ['bunt'], tags: ['Zahnrad', 'Zahnräder', 'Technik', 'Repair', 'Reparatur', 'Werkstatt', 'Mechanik'],
    draw() {
      const gear = (cx, cy, R, teeth, color, dark, hole) => {
        const pts = [];
        const n = teeth * 4;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2;
          const phase = i % 4;
          const r = phase === 0 || phase === 1 ? R : R * 0.82;
          pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
        }
        const body = L.poly(pts);
        return path(body, { fill: color }) + circle(cx, cy, R * 0.66, { fill: dark }) + circle(cx, cy, hole, { fill: WHITE, 'fill-opacity': 0 });
      };
      let s = '';
      s += gear(220, 300, 190, 12, TEAL, '#168ba8', 0) + circle(220, 300, 70, { fill: CREAM }) + circle(220, 300, 36, { fill: '#168ba8' });
      s += gear(470, 170, 110, 8, ORANGE, '#c76712', 0) + circle(470, 170, 44, { fill: CREAM }) + circle(470, 170, 20, { fill: '#c76712' });
      s += gear(448, 430, 82, 8, YELLOW, '#d9a400', 0) + circle(448, 430, 32, { fill: CREAM }) + circle(448, 430, 14, { fill: '#d9a400' });
      return s;
    },
  },
  {
    slug: 'kochmuetze', name: 'Kochmütze', w: 600, h: 640, palettes: ['bunt'], tags: ['Kochmütze', 'Koch', 'Kochen', 'Küche', 'Kochkurs', 'Chefkoch', 'Restaurant'],
    draw() {
      let s = '';
      const puff = new Path();
      [[170, 220, 118], [300, 150, 138], [430, 220, 118], [250, 250, 100], [350, 250, 100]].forEach(([x, y, r]) => puff.add(L.circlePath(x, y, r)));
      s += path(puff, { fill: WHITE, stroke: '#cfd8e6', 'stroke-width': 10, 'stroke-linejoin': 'round' });
      s += path(new Path().M(120, 250).L(480, 250).L(450, 460).L(150, 460).Z(), { fill: WHITE });
      s += path(puff, { fill: LIGHT, 'fill-opacity': 0.0 });
      s += path(new Path().M(412, 150).C(470, 160, 520, 230, 470, 300).C(500, 220, 470, 170, 412, 150).Z(), { fill: LIGHT });
      s += path(new Path().M(480, 262).L(450, 460).L(400, 460).L(430, 262).Z(), { fill: LIGHT, 'fill-opacity': 0.75 });
      s += ink(new Path().M(210, 290).L(222, 430), LIGHT, 8);
      s += ink(new Path().M(300, 290).L(300, 430), LIGHT, 8);
      s += rr(140, 440, 320, 110, 24, WHITE, { stroke: '#cfd8e6', 'stroke-width': 8 });
      s += rr(140, 500, 320, 50, 24, LIGHT);
      s += rr(140, 440, 320, 18, 9, '#fff');
      s += ink(new Path().M(160, 456).L(440, 456), LIGHT, 4);
      return s;
    },
  },
  {
    slug: 'malpalette', name: 'Malpalette mit Pinsel', w: 700, h: 600, palettes: ['bunt'], tags: ['Malpalette', 'Pinsel', 'Farbe', 'Malen', 'Kunst', 'Workshop', 'Kreativ', 'Basteln'],
    draw() {
      let s = '';
      const pal = new Path().M(110, 300).C(100, 150, 240, 70, 390, 80).C(540, 90, 640, 190, 600, 320).C(570, 410, 470, 380, 440, 440)
        .C(410, 520, 300, 530, 210, 480).C(140, 440, 116, 380, 110, 300).Z();
      s += path(pal, { fill: '#e2b27c' });
      s += path(new Path().M(120, 300).C(110, 160, 240, 82, 388, 92).C(300, 130, 220, 200, 210, 330).C(208, 400, 240, 450, 280, 486).C(160, 440, 124, 380, 120, 300).Z(), { fill: '#fff', 'fill-opacity': 0.18 });
      s += circle(400, 400, 48, { fill: '#f6efe2' });
      [[220, 220, RED], [300, 160, ORANGE], [390, 140, YELLOW], [480, 160, GREEN], [545, 235, BLUE], [280, 290, PURPLE]].forEach(([x, y, c]) => {
        s += circle(x, y, 34, { fill: c });
        s += circle(x - 9, y - 10, 9, { fill: '#fff', 'fill-opacity': 0.4 });
      });
      s += rot(-38, 560, 330,
        path(L.rrect(530, 80, 30, 300, 15), { fill: BROWN }),
        path(L.rrect(530, 80, 10, 300, 5), { fill: '#fff', 'fill-opacity': 0.2 }),
        path(L.rrect(526, 370, 38, 52, 4), { fill: '#c4cee0' }),
        path(new Path().M(528, 420).L(562, 420).C(570, 470, 548, 520, 545, 540).C(542, 520, 520, 470, 528, 420).Z(), { fill: PINK }));
      return s;
    },
  },
  // ------------------------------------------------------------------------------------------------ culture
  {
    slug: 'mikrofon', name: 'Mikrofon', w: 400, h: 720, palettes: ['bunt'], tags: ['Mikrofon', 'Karaoke', 'Singen', 'Vortrag', 'Bühne', 'Konzert', 'Sprechen', 'Musik'],
    draw() {
      let s = '';
      const body = [];
      body.push(circle(200, 190, 130, { fill: '#4a5873' }));
      body.push(circle(200, 190, 130, { fill: '#6b7a98', 'fill-opacity': 0.0 }));
      for (let i = -3; i <= 3; i++) body.push(ink(new Path().M(200 + i * 36, 190 - Math.sqrt(Math.max(0, 126 * 126 - (i * 36) ** 2))).L(200 + i * 36, 190 + Math.sqrt(Math.max(0, 126 * 126 - (i * 36) ** 2))), '#8d9bb8', 5));
      for (let j = -3; j <= 3; j++) {
        const hw = Math.sqrt(Math.max(0, 126 * 126 - (j * 36) ** 2));
        body.push(ink(new Path().M(200 - hw, 190 + j * 36).L(200 + hw, 190 + j * 36), '#8d9bb8', 5));
      }
      body.push(path(new Path().M(100, 120).C(120, 70, 170, 52, 220, 62).C(170, 80, 140, 110, 128, 160).Z(), { fill: '#fff', 'fill-opacity': 0.3 }));
      body.push(rr(112, 304, 176, 34, 10, ORANGE));
      body.push(path(new Path().M(120, 330).L(280, 330).L(246, 650).C(244, 676, 156, 676, 154, 650).Z(), { fill: '#2b3753' }));
      body.push(path(new Path().M(120, 330).L(160, 330).L(190, 668).C(172, 670, 160, 660, 154, 650).Z(), { fill: '#fff', 'fill-opacity': 0.1 }));
      body.push(rr(170, 500, 60, 18, 9, GREEN));
      s += rot(14, 200, 400, ...body);
      return s;
    },
  },
  {
    slug: 'buecherstapel-lesung', name: 'Bücherstapel', w: 640, h: 600, palettes: ['bunt'], tags: ['Bücher', 'Bücherstapel', 'Lesung', 'Buch', 'Lesen', 'Bibliothek', 'Literatur', 'Bücherei'],
    draw() {
      const book = (x, y, w, h, color, dark, band) => rr(x, y, w, h, 12, color) + path(L.rrect(x + w - 30, y + 10, 26, h - 20, 4), { fill: CREAM })
        + ink(new Path().M(x + w - 30, y + h / 2 - 8).L(x + w - 4, y + h / 2 - 8), '#e5d4b0', 4) + ink(new Path().M(x + w - 30, y + h / 2 + 8).L(x + w - 4, y + h / 2 + 8), '#e5d4b0', 4)
        + rr(x + 40, y, 22, h, 0, dark) + rr(x + 78, y + 6, 12, h - 12, 3, band, { 'fill-opacity': 0.9 }) + shade(L.rrect(x, y + h - 22, w, 22, 10), 0.14);
      let s = '';
      s += book(90, 470, 460, 90, RED, '#b03438', YELLOW);
      s += book(130, 370, 400, 90, BLUE, '#274a96', WHITE);
      s += rot(-6, 330, 300, book(100, 270, 420, 90, GREEN, '#1f7e50', CREAM));
      s += rr(180, 170, 250, 90, 12, YELLOW);
      s += rr(180, 170, 250, 90, 12, '#000', { 'fill-opacity': 0.0 });
      s += path(L.rrect(396, 180, 26, 70, 4), { fill: CREAM });
      s += rr(220, 170, 22, 90, 0, '#d9a400');
      s += rr(256, 176, 12, 78, 3, WHITE, { 'fill-opacity': 0.8 });
      s += poly([[350, 170], [350, 80], [376, 104], [402, 80], [402, 170]], RED);
      return s;
    },
  },
  {
    slug: 'staffelei', name: 'Staffelei mit Bild', w: 640, h: 800, palettes: ['bunt'], tags: ['Staffelei', 'Bild', 'Gemälde', 'Ausstellung', 'Vernissage', 'Kunst', 'Malerei', 'Galerie'],
    draw() {
      let s = '';
      s += ink(new Path().M(320, 60).L(150, 760), '#b2784a', 26);
      s += ink(new Path().M(320, 60).L(490, 760), '#b2784a', 26);
      s += ink(new Path().M(320, 60).L(320, 560), '#8a5a3c', 22);
      s += rr(110, 560, 420, 34, 8, '#8a5a3c');
      s += rr(120, 100, 400, 450, 6, '#7a4a2b');
      s += rr(144, 124, 352, 402, 2, CREAM);
      s += rr(144, 124, 352, 190, 0, '#9ad3ef');
      s += circle(404, 200, 40, { fill: YELLOW });
      s += path(new Path().M(144, 400).C(200, 290, 280, 270, 340, 330).C(400, 270, 450, 300, 496, 360).L(496, 526).L(144, 526).Z(), { fill: GREEN });
      s += path(new Path().M(144, 470).C(220, 400, 320, 420, 380, 460).C(430, 430, 470, 440, 496, 460).L(496, 526).L(144, 526).Z(), { fill: '#238a56' });
      s += circle(220, 200, 22, { fill: WHITE }) + circle(250, 196, 28, { fill: WHITE }) + circle(280, 204, 20, { fill: WHITE });
      s += poly([[300, 440], [330, 410], [360, 440]], RED) + rr(306, 440, 48, 40, 0, CREAM) + rr(322, 454, 16, 26, 0, BROWN);
      return s;
    },
  },
  {
    slug: 'theatermasken', name: 'Theatermasken', w: 760, h: 640, palettes: ['bunt'], tags: ['Theater', 'Masken', 'Theatermasken', 'Bühne', 'Schauspiel', 'Komödie', 'Tragödie', 'Drama'],
    draw() {
      const maskPath = new Path().M(0, -150).C(100, -150, 150, -100, 150, -10).C(150, 90, 90, 170, 0, 190).C(-90, 170, -150, 90, -150, -10).C(-150, -100, -100, -150, 0, -150).Z();
      const happy = g({ transform: 'translate(260 300) rotate(-14)' },
        path(maskPath, { fill: GOLD }),
        path(new Path().M(0, -150).C(100, -150, 150, -100, 150, -10).C(150, 90, 90, 170, 0, 190).C(60, 120, 90, 40, 80, -40).C(70, -100, 40, -140, 0, -150).Z(), { fill: GOLD2, 'fill-opacity': 0.45 }),
        path(new Path().M(-100, -30).C(-80, -70, -30, -70, -10, -30).C(-40, -50, -70, -50, -100, -30).Z(), { fill: INK }),
        path(new Path().M(100, -30).C(80, -70, 30, -70, 10, -30).C(40, -50, 70, -50, 100, -30).Z(), { fill: INK }),
        path(new Path().M(-84, 40).C(-40, 150, 40, 150, 84, 40).C(40, 80, -40, 80, -84, 40).Z(), { fill: INK }),
        ell(-92, 36, 26, 14, RED, 0, { 'fill-opacity': 0.5 }), ell(92, 36, 26, 14, RED, 0, { 'fill-opacity': 0.5 }));
      const sad = g({ transform: 'translate(490 360) rotate(12)' },
        path(maskPath, { fill: '#9b85e8' }),
        path(new Path().M(0, -150).C(100, -150, 150, -100, 150, -10).C(150, 90, 90, 170, 0, 190).C(60, 120, 90, 40, 80, -40).C(70, -100, 40, -140, 0, -150).Z(), { fill: '#6d4fd0', 'fill-opacity': 0.45 }),
        path(new Path().M(-100, -40).C(-80, -4, -30, -4, -10, -50).C(-40, -26, -70, -26, -100, -40).Z(), { fill: INK }),
        path(new Path().M(100, -40).C(80, -4, 30, -4, 10, -50).C(40, -26, 70, -26, 100, -40).Z(), { fill: INK }),
        path(new Path().M(-70, 110).C(-40, 40, 40, 40, 70, 110).C(40, 76, -40, 76, -70, 110).Z(), { fill: INK }));
      return happy + sad;
    },
  },
  {
    slug: 'buehnenvorhang', name: 'Bühnenvorhang', w: 1200, h: 800, palettes: ['bunt'], tags: ['Vorhang', 'Bühnenvorhang', 'Theater', 'Bühne', 'Kino', 'Vorstellung', 'Rahmen', 'Premiere'],
    draw() {
      let s = '';
      const drape = (side) => {
        const x0 = side < 0 ? 0 : 1200, dir = -side;
        const w = 230;
        const edge = (x) => (side < 0 ? x : 1200 - x);
        let t = '';
        t += path(new Path().M(edge(0), 70).L(edge(w), 70).C(edge(w + 20), 300, edge(w * 0.7), 560, edge(w * 0.9), 740).L(edge(0), 740).Z(), { fill: '#b3202d' });
        for (let i = 0; i < 4; i++) {
          const a = i * 52 + 30;
          t += path(new Path().M(edge(a), 70).L(edge(a + 24), 70).C(edge(a + 40), 300, edge(a + 24), 560, edge(a + 36), 740).L(edge(a + 4), 740).C(edge(a - 8), 560, edge(a - 6), 300, edge(a), 70).Z(), { fill: '#7e1520', 'fill-opacity': 0.55 });
        }
        void x0; void dir;
        return t;
      };
      s += drape(-1) + drape(1);
      s += rr(0, 740, 1200, 60, 0, '#5a3a24');
      s += rr(0, 740, 1200, 16, 0, '#7a5232');
      const val = new Path().M(0, 0).L(1200, 0).L(1200, 90);
      for (let i = 0; i < 8; i++) { const x = 1200 - i * 150; val.C(x - 20, 140, x - 130, 140, x - 150, 90); }
      val.Z();
      s += path(val, { fill: '#8f1824' });
      s += path(new Path().M(0, 0).L(1200, 0).L(1200, 40).L(0, 40).Z(), { fill: '#b3202d' });
      for (let i = 0; i < 8; i++) s += circle(75 + i * 150, 100, 7, { fill: GOLD });
      return s;
    },
  },
  {
    slug: 'noten', name: 'Noten', w: 620, h: 700, palettes: ['bunt'], tags: ['Noten', 'Musik', 'Note', 'Konzert', 'Benefizkonzert', 'Chor', 'Klang', 'Notenschlüssel'],
    draw() {
      let s = '';
      const head = (x, y) => ell(x, y, 62, 44, INK, -22);
      s += rr(176, 170, 20, 400, 0, INK) + rr(466, 126, 20, 400, 0, INK);
      s += poly([[176, 150], [486, 106], [486, 186], [176, 230]], INK);
      s += poly([[176, 252], [486, 208], [486, 240], [176, 284]], INK);
      s += head(132, 574) + head(422, 532);
      s += path(L.sparkle(560, 90, 36, { squash: 0.12 }), { fill: TEAL }) + path(L.sparkle(70, 300, 26, { squash: 0.12 }), { fill: ORANGE });
      return s;
    },
  },
  {
    slug: 'quizblasen', name: 'Quiz-Sprechblasen', w: 700, h: 600, palettes: ['bunt'], tags: ['Quiz', 'Frage', 'Fragezeichen', 'Sprechblase', 'Ratespiel', 'Wissen', 'Pubquiz', 'Rätsel'],
    draw() {
      let s = '';
      s += path(new Path().M(110, 90).L(430, 90).C(480, 90, 500, 110, 500, 160).L(500, 280).C(500, 330, 480, 350, 430, 350).L(260, 350).L(150, 440).L(160, 350).L(110, 350).C(60, 350, 40, 330, 40, 280).L(40, 160).C(40, 110, 60, 90, 110, 90).Z(), { fill: TEAL });
      s += path(new Path().M(300, 250).L(590, 250).C(640, 250, 660, 270, 660, 320).L(660, 430).C(660, 480, 640, 500, 590, 500).L(560, 500).L(570, 580).L(470, 500).L(300, 500).C(250, 500, 230, 480, 230, 430).L(230, 320).C(230, 270, 250, 250, 300, 250).Z(), { fill: ORANGE });
      s += ink(new Path().arc(270, 150, 46, 46, 190, 430, true).L(270, 206), WHITE, 26);
      s += circle(270, 240, 14, { fill: WHITE });
      s += poly([[440, 325], [480, 325], [472, 420], [448, 420]], WHITE);
      s += circle(460, 452, 17, { fill: WHITE });
      return s;
    },
  },
  // ------------------------------------------------------------------------------------------------ festivals
  {
    slug: 'laterne', name: 'Laterne', w: 460, h: 760, palettes: ['bunt'], tags: ['Laterne', 'Laternenumzug', 'Martinsumzug', 'Lampion', 'St. Martin', 'Licht', 'Herbst', 'Kinder'],
    draw() {
      let s = '';
      s += ink(new Path().M(230, 100).L(230, 20), '#8a5a3c', 14);
      s += ink(new Path().M(100, 30).C(150, 0, 310, 0, 360, 30), '#8a5a3c', 12);
      s += ink(new Path().M(230, 100).L(150, 160), GREY, 6);
      s += ink(new Path().M(230, 100).L(310, 160), GREY, 6);
      s += rr(120, 140, 220, 30, 12, '#5b3a24');
      const lantern = new Path().M(120, 170).C(60, 300, 60, 480, 120, 600).L(340, 600).C(400, 480, 400, 300, 340, 170).Z();
      s += path(lantern, { fill: ORANGE });
      s += path(new Path().M(230, 170).L(230, 600).C(150, 600, 120, 600, 120, 600).C(60, 480, 60, 300, 120, 170).Z(), { fill: '#f9a64a', 'fill-opacity': 0.0 });
      s += path(new Path().M(230, 170).C(190, 300, 190, 480, 230, 600).C(270, 480, 270, 300, 230, 170).Z(), { fill: '#ffd97a' });
      s += path(new Path().M(120, 170).C(60, 300, 60, 480, 120, 600).L(150, 600).C(110, 480, 112, 300, 150, 170).Z(), { fill: '#c76712' });
      s += path(new Path().M(340, 170).C(400, 300, 400, 480, 340, 600).L(310, 600).C(350, 480, 348, 300, 310, 170).Z(), { fill: '#c76712' });
      s += path(L.starPath(230, 330, 40, 17, 5), { fill: '#fff6d0' }) + path(L.starPath(180, 470, 22, 9, 5), { fill: '#fff6d0' }) + path(L.starPath(282, 470, 22, 9, 5), { fill: '#fff6d0' });
      s += rr(110, 594, 240, 28, 10, '#5b3a24');
      for (let i = 0; i < 5; i++) s += ink(new Path().M(140 + i * 45, 622).L(140 + i * 45, 690 + (i % 2) * 24), YELLOW, 8);
      return s;
    },
  },
  {
    slug: 'weihnachtsbude', name: 'Weihnachtsmarkt-Bude', w: 760, h: 680, palettes: ['bunt'], tags: ['Weihnachtsmarkt', 'Bude', 'Hütte', 'Weihnachten', 'Markt', 'Winter', 'Advent', 'Schnee'],
    draw() {
      let s = '';
      s += rr(120, 270, 520, 360, 6, '#8a5a3c');
      for (let i = 1; i < 6; i++) s += ink(new Path().M(120 + i * 86.6, 280).L(120 + i * 86.6, 620), '#6e4528', 5);
      s += rr(180, 330, 400, 190, 8, '#ffd97a');
      s += rr(180, 330, 400, 190, 8, '#ff9d2e', { 'fill-opacity': 0.25 });
      s += rr(160, 520, 440, 40, 6, '#5b3a24');
      s += rr(180, 540, 400, 90, 0, '#6e4528');
      // goods on counter
      [[230, '#d9362f'], [300, GREEN], [370, '#d9362f'], [440, GREEN], [510, '#d9362f']].forEach(([x, c]) => { s += circle(x, 488, 26, { fill: c }); s += rr(x - 4, 452, 8, 14, 3, '#fff'); });
      s += ink(new Path().M(210, 360).L(550, 360), '#8a5a3c', 6);
      [[240, RED], [330, TEAL], [420, YELLOW], [510, PINK]].forEach(([x, c]) => { s += ink(new Path().M(x, 360).L(x, 392), '#8a5a3c', 4); s += path(L.starPath(x, 414, 22, 10, 5), { fill: c }); });
      s += poly([[80, 280], [380, 120], [680, 280]], '#b3202d');
      s += poly([[380, 120], [680, 280], [600, 280], [380, 160]], '#7e1520', { 'fill-opacity': 0.5 });
      s += ink(new Path().M(92, 282).L(380, 134).L(668, 282), WHITE, 40);
      [[150, 300], [214, 310], [290, 300], [470, 300], [546, 310], [610, 300]].forEach(([x, y]) => { s += circle(x, y, 18, { fill: WHITE }); });
      s += path(L.starPath(380, 100, 30, 13, 5), { fill: YELLOW });
      return s;
    },
  },
  {
    slug: 'marktstand', name: 'Marktstand', w: 760, h: 640, palettes: ['bunt'], tags: ['Marktstand', 'Markt', 'Messe', 'Stand', 'Wochenmarkt', 'Flohmarkt', 'Händler', 'Verkauf'],
    draw() {
      let s = '';
      s += rr(110, 190, 16, 440, 4, '#8a5a3c') + rr(634, 190, 16, 440, 4, '#8a5a3c');
      const aw = 8, W = 640, x0 = 60;
      for (let i = 0; i < aw; i++) {
        const x = x0 + (W / aw) * i;
        s += path(new Path().M(x, 80).L(x + W / aw, 80).L(x + W / aw, 200).C(x + W / aw, 250, x, 250, x, 200).Z(), { fill: i % 2 ? WHITE : TEAL });
      }
      s += path(new Path().M(x0, 80).L(x0 + W, 80).L(x0 + W + 20, 20).L(x0 - 20, 20).Z(), { fill: i2(TEAL) });
      s += rr(120, 420, 520, 40, 6, '#b2784a');
      s += rr(140, 460, 480, 170, 0, '#8a5a3c');
      const crate = (x, c, items) => rr(x, 340, 130, 80, 8, c) + items;
      s += crate(150, '#d9a05a', circle(190, 330, 26, { fill: RED }) + circle(240, 326, 26, { fill: RED }) + circle(215, 306, 26, { fill: '#e5484d' }));
      s += crate(310, '#d9a05a', circle(350, 330, 26, { fill: YELLOW }) + circle(400, 326, 26, { fill: ORANGE }) + circle(375, 306, 26, { fill: YELLOW }));
      s += crate(470, '#d9a05a', circle(510, 330, 26, { fill: GREEN }) + circle(560, 326, 26, { fill: '#7cc152' }) + circle(535, 306, 26, { fill: GREEN }));
      return s;
      function i2(c) { return mixc(c, '#000000', 0.2); }
    },
  },
  {
    slug: 'osterkorb', name: 'Osterkorb', w: 680, h: 620, palettes: ['bunt'], tags: ['Osterkorb', 'Ostern', 'Eier', 'Osterbasar', 'Korb', 'Osterei', 'Frühling', 'Hase'],
    draw() {
      let s = '';
      s += ink(new Path().M(120, 330).C(120, 40, 560, 40, 560, 330), '#a96f3a', 30);
      s += ink(new Path().M(120, 330).C(120, 40, 560, 40, 560, 330), '#c58b52', 12, { 'stroke-dasharray': '0 0' });
      // grass
      s += path(new Path().M(120, 340).C(150, 270, 170, 250, 190, 214).C(200, 260, 210, 290, 220, 340).C(240, 270, 270, 230, 300, 200).C(300, 260, 300, 300, 310, 340).C(340, 270, 380, 240, 410, 212).C(400, 270, 400, 300, 410, 340).C(440, 280, 470, 260, 500, 236).C(490, 280, 480, 310, 500, 340).C(520, 300, 540, 290, 560, 276).L(560, 360).L(120, 360).Z(), { fill: GREEN });
      const egg = (cx, cy, r, c, dec, rotation) => rot(rotation, cx, cy, path(new Path().M(cx, cy - r * 1.25).C(cx + r * 0.95, cy - r * 1.05, cx + r, cy + r * 0.95, cx, cy + r).C(cx - r, cy + r * 0.95, cx - r * 0.95, cy - r * 1.05, cx, cy - r * 1.25).Z(), { fill: c }) + dec);
      s += egg(250, 270, 62, PINK, ink(new Path().M(196, 262).C(230, 280, 270, 244, 304, 266), WHITE, 12) + ink(new Path().M(200, 292).C(230, 310, 270, 276, 302, 292), YELLOW, 9), -10);
      s += egg(350, 244, 66, TEAL, circle(330, 230, 9, { fill: WHITE }) + circle(372, 250, 9, { fill: WHITE }) + circle(344, 276, 9, { fill: WHITE }) + circle(376, 214, 7, { fill: YELLOW }), 6);
      s += egg(448, 276, 60, YELLOW, ink(new Path().M(396, 270).L(412, 250).L(430, 280).L(448, 250).L(466, 280).L(484, 250).L(500, 270), ORANGE, 9), 14);
      s += path(new Path().M(100, 350).L(580, 350).L(540, 590).C(536, 606, 524, 612, 508, 612).L(172, 612).C(156, 612, 144, 606, 140, 590).Z(), { fill: '#b9814a' });
      for (let i = 0; i < 5; i++) s += ink(new Path().M(110 + i * 22 + (i * 6), 376 + i * 4).L(150 + i * 94, 598), '#8a5a3c', 0.1, { stroke: 'none' });
      for (let y = 0; y < 4; y++) {
        const yy = 380 + y * 54;
        s += ink(new Path().M(110 + y * 6, yy).L(570 - y * 6, yy), '#8f5d2e', 7);
        for (let x = 0; x < 9; x++) s += ink(new Path().M(150 + x * 48 - (y % 2) * 24, yy - 2).L(150 + x * 48 - (y % 2) * 24 + 14, yy + 40), '#d7a470', 7);
      }
      s += rr(90, 336, 500, 30, 14, '#8a5a3c');
      s += rr(90, 336, 500, 10, 5, '#a96f3a');
      return s;
    },
  },
  {
    slug: 'riesenrad', name: 'Riesenrad', w: 760, h: 820, palettes: ['bunt'], tags: ['Riesenrad', 'Kirmes', 'Jahrmarkt', 'Volksfest', 'Stadtfest', 'Rummel', 'Fahrgeschäft', 'Vergnügungspark'],
    draw() {
      let s = '';
      const cx = 380, cy = 330, R = 270;
      s += ink(new Path().M(cx, cy).L(150, 790), INK, 24);
      s += ink(new Path().M(cx, cy).L(610, 790), INK, 24);
      s += ink(new Path().M(250, 560).L(510, 560), INK, 14);
      s += rr(90, 780, 580, 26, 10, '#3a4a6c');
      s += circle(cx, cy, R, { fill: 'none', stroke: INK, 'stroke-width': 16 });
      s += circle(cx, cy, R * 0.62, { fill: 'none', stroke: INK, 'stroke-width': 8 });
      for (let i = 0; i < 12; i++) s += ink(new Path().M(cx, cy).L(cx + Math.cos(L.rad(i * 30)) * R, cy + Math.sin(L.rad(i * 30)) * R), INK, 8);
      const cols = [RED, YELLOW, TEAL, ORANGE, PINK, GREEN];
      for (let i = 0; i < 12; i++) {
        const a = L.rad(i * 30 + 15), x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R;
        s += ink(new Path().M(x, y).L(x, y + 16), INK, 5);
        s += path(new Path().M(x - 30, y + 16).L(x + 30, y + 16).L(x + 26, y + 58).C(x + 26, y + 66, x - 26, y + 66, x - 26, y + 58).Z(), { fill: cols[i % 6] });
        s += path(new Path().M(x - 34, y + 20).C(x - 30, y - 4, x + 30, y - 4, x + 34, y + 20).Z(), { fill: mixc(cols[i % 6], '#000000', 0.22) });
        s += rr(x - 17, y + 28, 34, 16, 4, WHITE, { 'fill-opacity': 0.6 });
      }
      s += circle(cx, cy, 36, { fill: YELLOW }) + circle(cx, cy, 16, { fill: INK });
      for (let i = 0; i < 12; i++) { const a = L.rad(i * 30); s += circle(cx + Math.cos(a) * R, cy + Math.sin(a) * R, 8, { fill: YELLOW }); }
      return s;
    },
  },
  {
    slug: 'weinglas', name: 'Weinglas', w: 420, h: 720, palettes: ['bunt'], tags: ['Weinglas', 'Wein', 'Weinfest', 'Weinprobe', 'Rotwein', 'Glas', 'Winzer', 'Verkostung'],
    draw() {
      let s = '';
      const bowl = new Path().M(80, 40).L(340, 40).C(350, 200, 330, 330, 210, 380).C(90, 330, 70, 200, 80, 40).Z();
      s += path(bowl, { fill: '#dfe9f5', 'fill-opacity': 0.55 });
      s += path(new Path().M(86, 200).L(334, 200).C(328, 300, 290, 356, 210, 378).C(130, 356, 92, 300, 86, 200).Z(), { fill: '#a31f3a' });
      s += path(new Path().M(86, 200).C(150, 226, 270, 174, 334, 200).C(334, 214, 334, 220, 334, 226).C(270, 200, 150, 252, 86, 226).Z(), { fill: '#c0344f' });
      s += path(bowl, { fill: 'none', stroke: '#8fa3be', 'stroke-width': 10, 'stroke-linejoin': 'round' });
      s += path(new Path().M(112, 70).C(112, 200, 130, 280, 170, 330).C(140, 260, 134, 170, 140, 70).Z(), { fill: WHITE, 'fill-opacity': 0.6 });
      s += rr(194, 376, 32, 250, 6, '#c9d6e8');
      s += rr(194, 376, 10, 250, 5, WHITE, { 'fill-opacity': 0.7 });
      s += path(new Path().M(60, 680).C(60, 640, 120, 626, 210, 626).C(300, 626, 360, 640, 360, 680).C(360, 700, 300, 706, 210, 706).C(120, 706, 60, 700, 60, 680).Z(), { fill: '#c9d6e8' });
      s += ell(210, 650, 150, 24, '#e8eff8');
      return s;
    },
  },
  {
    slug: 'weintrauben', name: 'Weintrauben', w: 560, h: 700, palettes: ['bunt'], tags: ['Weintrauben', 'Trauben', 'Weinfest', 'Wein', 'Winzer', 'Weinlese', 'Weinblatt', 'Herbst'],
    draw() {
      let s = '';
      s += ink(new Path().M(290, 70).C(300, 40, 330, 30, 360, 20), '#6e4528', 18);
      s += path(new Path().M(290, 120).C(180, 60, 100, 100, 70, 180).C(120, 170, 130, 200, 110, 240).C(150, 230, 170, 250, 160, 290).C(200, 260, 240, 250, 290, 140).Z(), { fill: '#3f9b52' });
      s += path(new Path().M(290, 120).C(380, 40, 480, 60, 510, 150).C(470, 150, 460, 180, 480, 214).C(440, 206, 420, 226, 430, 260).C(390, 240, 340, 230, 290, 140).Z(), { fill: '#2f8244' });
      s += ink(new Path().M(290, 130).C(220, 160, 160, 230, 130, 260), '#2a6e3b', 6);
      s += ink(new Path().M(290, 130).C(370, 140, 420, 190, 450, 232), '#256235', 6);
      const rowsN = [[3, 0], [4, 1], [5, 2], [4, 3], [3, 4], [2, 5], [1, 6]];
      const cols = ['#6a2f93', '#7c3aa8', '#58257f'];
      rowsN.forEach(([n, r], ri) => {
        for (let k = 0; k < n; k++) {
          const x = 290 + (k - (n - 1) / 2) * 76, y = 170 + ri * 66;
          s += circle(x, y, 40, { fill: cols[(k + ri) % 3] });
          s += circle(x - 12, y - 14, 10, { fill: WHITE, 'fill-opacity': 0.38 });
        }
        void r;
      });
      return s;
    },
  },
  {
    slug: 'brezel', name: 'Brezel', w: 640, h: 560, palettes: ['bunt'], tags: ['Brezel', 'Brezn', 'Oktoberfest', 'Wiesn', 'Bäckerei', 'Gebäck', 'Bayern', 'Volksfest'],
    draw() {
      const dark = '#9a5224', mid = '#c4742f', light = '#e39a52';
      const loop = (p, w, c) => ink(p, c, w);
      const arcs = new Path().M(130, 380).C(60, 290, 90, 150, 200, 110).C(260, 90, 300, 110, 320, 150).C(340, 110, 380, 90, 440, 110).C(550, 150, 580, 290, 510, 380);
      const a1 = new Path().M(150, 440).C(250, 370, 390, 300, 490, 270);
      const a2 = new Path().M(490, 440).C(390, 370, 250, 300, 150, 270);
      let s = '';
      s += loop(arcs, 70, dark) + loop(a1, 70, dark) + loop(a2, 70, dark);
      s += loop(arcs, 54, mid);
      s += loop(a1, 70, dark);
      s += loop(a1, 54, mid);
      s += loop(a2, 70 + 0, dark) ;
      s += loop(a2, 54, mid);
      s += loop(arcs, 18, light, { 'stroke-opacity': 0.8, transform: 'translate(0 -8)' });
      s += loop(a2, 16, light, { 'stroke-opacity': 0.8, transform: 'translate(0 -8)' });
      [[200, 96], [270, 96], [400, 94], [470, 108], [120, 210], [520, 210], [320, 330], [250, 330], [390, 370], [260, 380], [380, 320]].forEach(([x, y], i) => { s += circle(x, y, 7 + (i % 2) * 2, { fill: WHITE }); });
      return s;
    },
  },
  {
    slug: 'lebkuchenherz', name: 'Lebkuchenherz', w: 640, h: 640, palettes: ['bunt'], tags: ['Lebkuchenherz', 'Lebkuchen', 'Herz', 'Kirmes', 'Jahrmarkt', 'Wiesn', 'Weihnachtsmarkt', 'Volksfest'],
    draw() {
      let s = '';
      s += ink(new Path().M(210, 150).C(230, 60, 300, 26, 320, 26).C(340, 26, 410, 60, 430, 150), WHITE, 14);
      s += ink(new Path().M(210, 150).C(230, 60, 300, 26, 320, 26).C(340, 26, 410, 60, 430, 150), RED, 6);
      const h = L.heart(320, 370, 520);
      s += path(h, { fill: '#7a4421' });
      s += path(L.heart(320, 370, 470), { fill: '#9a5a30' });
      s += path(L.heart(320, 374, 394), { fill: 'none', stroke: WHITE, 'stroke-width': 12, 'stroke-linecap': 'round', 'stroke-dasharray': '0 26' });
      s += path(L.heart(320, 374, 330), { fill: 'none', stroke: WHITE, 'stroke-width': 10, 'stroke-linejoin': 'round' });
      s += path(new Path().M(240, 380).C(240, 330, 320, 330, 320, 380).C(320, 330, 400, 330, 400, 380).C(400, 440, 320, 470, 320, 500).C(320, 470, 240, 440, 240, 380).Z(), { fill: RED });
      s += path(new Path().M(210, 250).C(250, 220, 280, 222, 300, 232).C(260, 236, 232, 250, 210, 276).Z(), { fill: WHITE, 'fill-opacity': 0.25 });
      return at(38, 22, 0.88, s);
    },
  },
  // ------------------------------------------------------------------------------------------------ care, church, school
  {
    slug: 'blutstropfen', name: 'Blutstropfen mit Herz', w: 520, h: 720, palettes: ['bunt'], tags: ['Blutstropfen', 'Blutspende', 'Blut', 'Spenden', 'Herz', 'Leben retten', 'Tropfen', 'Gesundheit'],
    draw() {
      let s = '';
      const drop = new Path().M(260, 30).C(300, 130, 470, 290, 470, 460).C(470, 600, 380, 690, 260, 690).C(140, 690, 50, 600, 50, 460).C(50, 290, 220, 130, 260, 30).Z();
      s += path(drop, { fill: '#d62839' });
      s += path(new Path().M(260, 30).C(300, 130, 470, 290, 470, 460).C(470, 600, 380, 690, 260, 690).C(330, 600, 380, 520, 360, 400).C(340, 300, 290, 200, 260, 30).Z(), { fill: '#a81c2c', 'fill-opacity': 0.5 });
      s += path(new Path().M(120, 430).C(120, 360, 160, 310, 200, 270).C(184, 330, 170, 400, 190, 470).C(200, 530, 232, 560, 260, 580).C(180, 570, 120, 520, 120, 430).Z(), { fill: WHITE, 'fill-opacity': 0.3 });
      s += path(L.heart(262, 468, 210), { fill: WHITE });
      return s;
    },
  },
  {
    slug: 'erste-hilfe-koffer', name: 'Erste-Hilfe-Koffer', w: 700, h: 560, palettes: ['bunt'], tags: ['Erste Hilfe', 'Verbandskasten', 'Notfall', 'Kreuz', 'Koffer', 'Kurs', 'Sanitäter', 'Hilfe'],
    draw() {
      let s = '';
      s += path(new Path().M(240, 120).C(240, 60, 460, 60, 460, 120).L(460, 160).L(412, 160).L(412, 120).C(412, 106, 288, 106, 288, 120).L(288, 160).L(240, 160).Z(), { fill: '#1e7d50' });
      s += rr(60, 140, 580, 380, 36, '#2fa66a');
      s += rr(60, 140, 580, 120, 36, '#3ab87a');
      s += rr(60, 230, 580, 30, 0, '#27935c');
      s += rr(60, 470, 580, 50, 30, '#000', { 'fill-opacity': 0.12 });
      s += path(L.poly([[310, 280], [390, 280], [390, 330], [440, 330], [440, 410], [390, 410], [390, 460], [310, 460], [310, 410], [260, 410], [260, 330], [310, 330]]), { fill: WHITE });
      s += rr(84, 300, 40, 140, 10, '#1e7d50', { 'fill-opacity': 0.55 }) + rr(576, 300, 40, 140, 10, '#1e7d50', { 'fill-opacity': 0.55 });
      return s;
    },
  },
  {
    slug: 'kirche', name: 'Kirche', w: 640, h: 840, palettes: ['bunt'], tags: ['Kirche', 'Gottesdienst', 'Gemeinde', 'Kapelle', 'Glaube', 'Kirchturm', 'Gemeindefest', 'Pfarrei'],
    draw() {
      let s = '';
      s += rr(30, 760, 580, 24, 6, '#6f7f5a');
      s += rr(60, 480, 520, 290, 0, CREAM);
      s += poly([[40, 480], [320, 380], [600, 480]], '#5a6a86');
      s += poly([[320, 380], [600, 480], [560, 480], [320, 410]], '#44506b');
      s += rr(230, 250, 180, 520, 0, '#f4e6c4');
      s += poly([[214, 260], [320, 40], [426, 260]], '#44506b');
      s += poly([[320, 40], [426, 260], [380, 260], [320, 90]], '#35405a');
      s += rr(311, -24, 18, 76, 0, GOLD) + rr(292, 4, 56, 16, 0, GOLD);
      s += circle(320, 340, 38, { fill: WHITE, stroke: '#8a5a3c', 'stroke-width': 8 });
      s += ink(new Path().M(320, 316).L(320, 340).L(336, 350), INK, 6);
      s += path(new Path().M(270, 540).L(270, 450).C(270, 400, 370, 400, 370, 450).L(370, 540).Z(), { fill: BLUE });
      s += ink(new Path().M(320, 410).L(320, 540), WHITE, 6) + ink(new Path().M(270, 480).L(370, 480), WHITE, 6);
      s += path(new Path().M(270, 770).L(270, 640).C(270, 580, 370, 580, 370, 640).L(370, 770).Z(), { fill: '#8a5a3c' });
      s += circle(352, 700, 6, { fill: GOLD });
      [[100, 560], [480, 560]].forEach(([x, y]) => { s += path(new Path().M(x, y + 110).L(x, y + 30).C(x, y - 30, x + 60, y - 30, x + 60, y + 30).L(x + 60, y + 110).Z(), { fill: '#f0b64b' }); s += ink(new Path().M(x + 30, y - 14).L(x + 30, y + 110), WHITE, 5); });
      return at(0, 40, 1, s);
    },
  },
  {
    slug: 'schulranzen', name: 'Schulranzen', w: 600, h: 700, palettes: ['bunt'], tags: ['Schulranzen', 'Ranzen', 'Schule', 'Schulfest', 'Einschulung', 'Rucksack', 'Schulanfang', 'Schüler'],
    draw() {
      let s = '';
      s += ink(new Path().M(180, 90).C(180, 20, 420, 20, 420, 90), '#c76712', 22);
      s += rr(90, 70, 420, 580, 70, TEAL);
      s += rr(90, 70, 420, 150, 70, '#168ba8');
      s += rr(90, 160, 420, 60, 0, '#168ba8');
      s += path(new Path().M(90, 230).L(510, 230).L(510, 380).C(510, 440, 460, 470, 300, 470).C(140, 470, 90, 440, 90, 380).Z(), { fill: '#e8f6fb', 'fill-opacity': 0.0 });
      s += rr(130, 250, 340, 300, 50, '#1fb3d6');
      s += rr(130, 250, 340, 300, 50, '#fff', { 'fill-opacity': 0.12 });
      s += rr(130, 250, 340, 56, 28, ORANGE);
      s += rr(130, 520, 340, 30, 15, '#168ba8', { 'fill-opacity': 0.0 });
      s += rr(270, 280, 60, 90, 14, YELLOW) + circle(300, 318, 8, { fill: INK }) + rr(296, 324, 8, 20, 4, INK);
      s += rr(150, 410, 300, 20, 10, '#fff', { 'fill-opacity': 0.5 }) + rr(150, 448, 300, 20, 10, '#fff', { 'fill-opacity': 0.5 });
      s += rr(30, 330, 90, 230, 36, '#168ba8') + rr(480, 330, 90, 230, 36, '#168ba8');
      s += rr(46, 350, 58, 18, 9, ORANGE) + rr(496, 350, 58, 18, 9, ORANGE);
      s += rr(90, 600, 420, 56, 28, '#000', { 'fill-opacity': 0.12 });
      s += star(300, 190, 26);
      function star(x, y, r) { return path(L.starPath(x, y, r, r * 0.45, 5), { fill: YELLOW }); }
      return s;
    },
  },
  {
    slug: 'bauklotzturm', name: 'Bauklötze', w: 560, h: 700, palettes: ['bunt'], tags: ['Bauklötze', 'Klötze', 'Kita', 'Kindergarten', 'Spielzeug', 'Turm', 'Kinder', 'Holzspielzeug', 'Kinderfest'],
    draw() {
      let s = '';
      const cube = (x, y, w, h, c) => rr(x, y, w, h, 10, c) + rr(x, y, w, h * 0.16, 8, '#fff', { 'fill-opacity': 0.28 }) + rr(x, y + h * 0.84, w, h * 0.16, 8, '#000', { 'fill-opacity': 0.14 });
      s += cube(40, 520, 220, 150, RED) + cube(300, 520, 220, 150, BLUE);
      s += circle(150, 595, 42, { fill: '#fff', 'fill-opacity': 0.9 }) + path(L.starPath(410, 595, 48, 22, 5), { fill: YELLOW });
      s += cube(90, 380, 380, 130, YELLOW);
      s += path(L.poly([[210, 430], [280, 400], [350, 430], [350, 480], [210, 480]]), { fill: '#fff', 'fill-opacity': 0.0 });
      s += rr(120, 400, 40, 90, 8, '#fff', { 'fill-opacity': 0.4 }) + rr(400, 400, 40, 90, 8, '#fff', { 'fill-opacity': 0.4 });
      s += cube(190, 250, 180, 120, GREEN);
      s += path(L.poly([[180, 240], [280, 90], [380, 240]]), { fill: ORANGE });
      s += path(L.poly([[280, 90], [380, 240], [330, 240]]), { fill: '#c76712', 'fill-opacity': 0.6 });
      s += circle(280, 190, 24, { fill: CREAM });
      s += rot(14, 435, 350, rr(400, 322, 72, 58, 8, PURPLE) + rr(400, 322, 72, 12, 6, '#fff', { 'fill-opacity': 0.3 }));
      return s;
    },
  },
  {
    slug: 'laptop-videocall', name: 'Laptop mit Videokonferenz', w: 760, h: 560, palettes: ['bunt'], tags: ['Laptop', 'Online', 'Webinar', 'Videokonferenz', 'Seminar', 'Computer', 'Homeoffice', 'Videocall'],
    draw() {
      let s = '';
      s += rr(120, 40, 520, 340, 24, '#2b3753');
      s += rr(144, 64, 472, 292, 10, '#eaf3fb');
      const tile = (x, y, c, skin) => rr(x, y, 210, 126, 10, c) + circle(x + 105, y + 50, 26, { fill: skin }) + path(new Path().M(x + 55, y + 126).C(x + 55, y + 80, x + 155, y + 80, x + 155, y + 126).Z(), { fill: '#fff', 'fill-opacity': 0.8 });
      s += tile(160, 80, TEAL, '#f2c29b') + tile(390, 80, ORANGE, '#c68b62');
      s += tile(160, 224, PURPLE, '#e8b08a') + tile(390, 224, GREEN, '#a56e48');
      s += rr(300, 340, 160, 12, 6, '#fff', { 'fill-opacity': 0.0 });
      s += circle(380, 52, 4, { fill: '#6b7a98' });
      s += path(new Path().M(60, 400).L(700, 400).L(660, 480).C(656, 490, 650, 494, 640, 494).L(120, 494).C(110, 494, 104, 490, 100, 480).Z(), { fill: '#b9c2d3' });
      s += path(new Path().M(60, 400).L(700, 400).L(692, 420).L(68, 420).Z(), { fill: '#d9deea' });
      s += rr(320, 400, 120, 20, 10, '#9aa6bd');
      s += path(L.poly([[330, 360], [350, 330], [370, 360]]), { fill: '#fff', 'fill-opacity': 0.0 });
      return s;
    },
  },
  // ------------------------------------------------------------------------------------------------ dance, clothes
  {
    slug: 'tanzpaar', name: 'Tanzpaar', w: 640, h: 780, palettes: ['bunt'], tags: ['Tanzpaar', 'Tanzkurs', 'Tanzen', 'Paartanz', 'Walzer', 'Tanzschule', 'Ball', 'Standard'],
    draw() {
      let s = '';
      // man (left): suit, leaning slightly
      s += path(new Path().M(215, 180).C(160, 190, 140, 260, 150, 380).L(160, 560).L(206, 560).L(228, 410).L(250, 560).L(296, 560).L(298, 380).C(300, 270, 280, 190, 230, 180).Z(), { fill: INK });
      s += ink(new Path().M(180, 580).L(166, 726), INK, 36);
      s += ink(new Path().M(280, 580).L(300, 726), INK, 36);
      s += rr(124, 712, 74, 26, 12, '#111a2e') + rr(280, 712, 74, 26, 12, '#111a2e');
      s += circle(228, 128, 46, { fill: '#f2c29b' });
      s += path(new Path().M(180, 128).C(176, 70, 270, 66, 276, 124).C(256, 100, 210, 98, 180, 128).Z(), { fill: '#4a2f1d' });
      s += poly([[216, 184], [240, 184], [236, 240], [220, 240]], WHITE);
      s += poly([[226, 196], [238, 200], [230, 250]], RED);
      // woman (right): dress
      s += path(new Path().M(430, 210).C(380, 220, 370, 290, 390, 360).C(330, 470, 280, 600, 270, 676).C(340, 720, 480, 720, 560, 690).C(560, 600, 520, 460, 470, 360).C(490, 290, 480, 220, 430, 210).Z(), { fill: '#d62839' });
      s += path(new Path().M(390, 360).C(330, 470, 280, 600, 270, 676).C(300, 700, 340, 710, 380, 714).C(370, 600, 400, 460, 430, 380).Z(), { fill: '#a81c2c', 'fill-opacity': 0.45 });
      s += path(new Path().M(270, 676).C(340, 724, 480, 724, 560, 690).C(480, 704, 340, 704, 270, 676).Z(), { fill: '#fff', 'fill-opacity': 0.35 });
      s += circle(436, 160, 44, { fill: '#f2c29b' });
      s += path(new Path().M(392, 160).C(384, 90, 480, 90, 484, 160).C(480, 200, 490, 226, 470, 240).C(482, 180, 440, 120, 392, 160).Z(), { fill: '#7a3b1d' });
      s += circle(486, 200, 26, { fill: '#7a3b1d' });
      // arms: joined hands up, other arm on back
      s += ink(new Path().M(290, 230).C(350, 220, 420, 180, 500, 250), '#2e3d60', 28);
      s += ink(new Path().M(300, 238).C(330, 270, 380, 290, 400, 250), '#d62839', 0.1, { stroke: 'none' });
      s += ink(new Path().M(404, 262).C(380, 300, 330, 330, 290, 316), '#d62839', 24);
      s += circle(500, 252, 15, { fill: '#f2c29b' });
      return s;
    },
  },
  {
    slug: 'kleiderbuegel', name: 'Kleiderbügel mit Shirt', w: 700, h: 640, palettes: ['bunt'], tags: ['Kleiderbügel', 'Kleidung', 'Kleidertausch', 'Mode', 'Shirt', 'Second Hand', 'Tauschbörse', 'Garderobe'],
    draw() {
      let s = '';
      s += ink(new Path().M(350, 160).L(350, 128).C(350, 80, 420, 66, 420, 40).C(420, 20, 400, 14, 384, 18), '#8b95a5', 14);
      s += path(new Path().M(350, 150).L(660, 290).C(680, 304, 670, 330, 650, 330).L(50, 330).C(30, 330, 20, 304, 40, 290).Z(), { fill: '#d9a05a' });
      s += path(new Path().M(350, 176).L(620, 296).L(80, 296).Z(), { fill: 'none', stroke: '#fff', 'stroke-width': 0.1 });
      s += path(new Path().M(350, 150).L(660, 290).C(680, 304, 670, 330, 650, 330).L(350, 330).Z(), { fill: '#b2784a', 'fill-opacity': 0.5 });
      s += path(new Path().M(230, 340).L(120, 380).L(40, 500).L(130, 540).L(180, 470).L(180, 620).L(520, 620).L(520, 470).L(570, 540).L(660, 500).L(580, 380).L(470, 340).C(450, 380, 410, 396, 350, 396).C(290, 396, 250, 380, 230, 340).Z(), { fill: TEAL });
      s += path(new Path().M(230, 340).C(250, 380, 290, 396, 350, 396).C(410, 396, 450, 380, 470, 340).C(450, 358, 410, 366, 350, 366).C(290, 366, 250, 358, 230, 340).Z(), { fill: '#168ba8' });
      s += path(new Path().M(180, 470).L(180, 620).L(330, 620).L(330, 410).C(260, 400, 210, 440, 180, 470).Z(), { fill: '#fff', 'fill-opacity': 0.12 });
      s += path(L.heart(350, 500, 100), { fill: WHITE });
      return s;
    },
  },
];

module.exports = { pieces };
