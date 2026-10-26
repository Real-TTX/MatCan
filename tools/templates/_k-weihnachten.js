'use strict';
const L = require('./_t2a-lib');
const { text, rect, ellipse, line, icon, shape, page, foldCard, panels, ctext, divider, dk, dekoIn, deko, tpl, gradient, shadow, ticks } = L;

/** A Christmas ball hanging on a thread: cx = centre, y = top of the thread, r = radius. */
function bauble(n, cx, y, r, color, thread = 10) {
  return [
    line('Faden ' + n, cx, y, cx, y + thread, '#c9a24b', 0.3, { locked: true }),
    rect('Kappe ' + n, cx - r * 0.22, y + thread - 0.5, r * 0.44, 3, '#c9a24b', { radius: 0.6, locked: true }),
    ellipse('Kugel ' + n, cx - r, y + thread + 2, r * 2, r * 2, color, { locked: true }),
    ellipse('Glanz ' + n, cx - r * 0.6, y + thread + 2 + r * 0.3, r * 0.45, r * 0.7, '#ffffff', { opacity: 0.28, locked: true }),
  ];
}

// ============================================================================================================================ Karte (Klappkarte)
const KM = { family: 'weihnachtskarte', familyName: 'Weihnachtskarte', occasion: 'Feiertage', formatKey: 'card-a6-portrait', fold: 'vertical', width: 210, height: 148 };
const [BL, FR] = panels(210, 148, 'vertical', 4);

const RED = '#7d1f2b';
const GOLD = '#d9b866';
const rotgold = tpl(Object.assign({}, KM, {
  slug: 'weihnachtskarte-rot-gold',
  name: 'Weihnachtskarte Klappkarte – Rot und Gold',
  description: 'Festliche Klappkarte A6 hoch in tiefem Weinrot mit goldenem Doppelrahmen, Sternenfunkeln und „Frohe Weihnachten“ in Schreibschrift; innen hell mit Goldornament und Platz für deine Grüße.',
  variant: 'Rot und Gold',
  tags: ['Weihnachten', 'Weihnachtskarte', 'Klappkarte', 'Gold', 'Rot', 'festlich', 'klassisch', 'Advent', 'Karte', 'Frohe Weihnachten'],
  pages: foldCard('vertical', [
    ctext('Hinten', BL.cx, 120, 80, 8, 'Frohes Fest', { f: 'Cinzel', s: 8, c: GOLD, ls: 0.3, min: 5 }),
    dk('Funkeln hinten', 'deko-sterne-funkeln-gold', BL.cx - 7, 64, 14),
    dekoIn('Rahmen', 'deko-rahmen-doppellinie-hoch-gold', 108, 5, 94, 138, { locked: true }),
    dk('Sterne', 'deko-sterne-himmel-gold', 112, 8, 90, 90, { opacity: 0.55 }),
    ctext('Frohe', FR.cx, 56, 80, 22, 'Frohe', { f: 'Great Vibes', s: 40, c: GOLD, min: 20 }),
    ctext('Weihnachten', FR.cx, 74, 86, 22, 'Weihnachten', { f: 'Great Vibes', s: 40, c: '#f4e3b0', min: 20 }),
    divider('Trenner', FR.cx, 104, 40, GOLD),
    ctext('Jahr', FR.cx, 110, 80, 8, 'und ein gesegnetes neues Jahr', { f: 'Cormorant Garamond', s: 12, i: true, c: '#f4e3b0', min: 7 }),
  ], [
    dk('Ornament', 'deko-ornamente-fleuron-gold', 52.5 - 7, 16, 14),
    ctext('Titel links', 52.5, 62, 80, 22, 'Ein frohes\nWeihnachtsfest', { f: 'Cormorant Garamond', s: 22, w: 600, i: true, c: RED, wrap: true, lh: 1.2, min: 11 }),
    line('Mittelstrich', 105, 20, 105, 128, '#e5d6b5', 0.25, { locked: true }),
    text('Anrede', 120, 24, 76, 10, 'Liebe Familie Weber,', { f: 'Cormorant Garamond', s: 17, w: 600, i: true, c: RED, min: 10 }),
    text('Text', 120, 38, 76, 62, 'zum Fest wünschen wir euch besinnliche Stunden, leuchtende Kerzen und ein Wiedersehen mit allen, die euch lieb sind. Kommt gut ins neue Jahr!', { f: 'Cormorant Garamond', s: 13.5, w: 500, c: '#3a2a26', v: 'top', wrap: true, lh: 1.4, min: 9 }),
    text('Gruß', 120, 108, 76, 9, 'Eure Familie Schmidt', { f: 'Cormorant Garamond', s: 16, w: 600, i: true, c: RED, a: 'right', min: 9 }),
    dk('Ecke', 'deko-ecken-schnoerkel-gold', 178, 118, 26, undefined, { flipX: true, flipY: true }),
  ], RED, '#fbf5e8'),
}));

const GREEN = '#2f5d46';
const tanne = tpl(Object.assign({}, KM, {
  slug: 'weihnachtskarte-tannengruen',
  name: 'Weihnachtskarte Klappkarte – Tannengrün',
  description: 'Natürliche Klappkarte A6 hoch: Tannenzweige, rote Christbaumkugeln an goldenen Fäden und „Frohe Weihnachten“ in einer warmen Antiqua auf Cremeweiß. Innen ein Tannenzweig am Rand.',
  variant: 'Tannengrün',
  tags: ['Weihnachten', 'Weihnachtskarte', 'Klappkarte', 'Tanne', 'Christbaumkugeln', 'grün', 'natürlich', 'Advent', 'Karte', 'Frohe Weihnachten'],
  pages: foldCard('vertical', [
    dk('Zweig hinten', 'deko-blumen-tannenzweig-salbei', BL.cx - 28, 120, 56),
    bauble(1, 126, 4, 8, '#b4232f', 12), bauble(2, 156, 4, 10, '#2f5d46', 22), bauble(3, 186, 4, 8, '#b4232f', 8),
    dk('Zweig oben', 'deko-blumen-tannenzweig-salbei', 108, 112, 92),
    ctext('Frohe', FR.cx, 54, 90, 18, 'Frohe', { f: 'Playfair Display', s: 26, i: true, w: 400, c: GREEN, min: 12 }),
    ctext('Weihnachten', FR.cx, 66, 94, 22, 'Weihnachten', { f: 'Playfair Display', s: 31, w: 700, c: '#b4232f', min: 14 }),
    ctext('Jahr', FR.cx, 92, 80, 8, 'und alles Gute im neuen Jahr', { f: 'Lora', s: 9.5, i: true, c: GREEN, min: 6 }),
  ], [
    dk('Zweig innen', 'deko-blumen-tannenzweig-salbei', 4, 112, 86),
    ctext('Titel links', 52.5, 44, 80, 12, 'Fröhliche', { f: 'Playfair Display', s: 20, i: true, c: GREEN, min: 10 }),
    ctext('Titel links 2', 52.5, 56, 80, 14, 'Weihnachtszeit', { f: 'Playfair Display', s: 20, w: 700, c: '#b4232f', min: 10 }),
    text('Anrede', 120, 26, 76, 11, 'Liebe Oma, lieber Opa,', { f: 'Playfair Display', s: 13, i: true, c: GREEN, min: 8 }),
    text('Text', 120, 40, 76, 60, 'wir denken an euch und freuen uns auf die Plätzchen, die Lieder und das gemeinsame Essen. Habt ein wunderschönes Weihnachtsfest!', { f: 'Lora', s: 10.5, c: '#33403a', v: 'top', wrap: true, lh: 1.55, min: 7 }),
    text('Gruß', 120, 108, 76, 9, 'Eure Enkel', { f: 'Playfair Display', s: 13, i: true, c: '#b4232f', a: 'right', min: 8 }),
    bauble(4, 190, 2, 6, '#b4232f', 4),
  ], '#fbf6ea'),
}));

const NAVY = '#14264a';
const nordisch = tpl(Object.assign({}, KM, {
  slug: 'weihnachtskarte-nordisch',
  name: 'Weihnachtskarte Klappkarte – Nordisch',
  description: 'Moderne Klappkarte A6 hoch in Nachtblau: Schneeflocken, eine Bergsilhouette und „Frohe Weihnachten“ in schmaler Großschrift mit viel Abstand. Innen weiß und aufgeräumt.',
  variant: 'Nordisch',
  tags: ['Weihnachten', 'Weihnachtskarte', 'Klappkarte', 'modern', 'nordisch', 'Schnee', 'blau', 'minimal', 'Winter', 'Karte', 'Schneeflocken'],
  pages: foldCard('vertical', [
    dk('Flocke h', 'deko-sterne-schneeflocke-1-weiss', BL.cx - 6, 60, 12),
    ctext('Hinten', BL.cx, 76, 80, 6, 'Wärme für die kalte Zeit', { f: 'Raleway', s: 7, w: 600, c: '#a9b8d8', up: true, ls: 0.25, min: 5 }),
    rect('Front', 105, 0, 105, 148, NAVY, { locked: true }),
    dk('Flocke 1', 'deko-sterne-schneeflocke-1-weiss', 114, 12, 18),
    dk('Flocke 2', 'deko-sterne-schneeflocke-2-weiss', 176, 30, 14),
    dk('Flocke 3', 'deko-sterne-schneeflocke-3-weiss', 150, 52, 10, undefined, { opacity: 0.7 }),
    dk('Flocke 4', 'deko-sterne-schneeflocke-1-weiss', 186, 108, 9, undefined, { opacity: 0.6 }),
    dk('Berge', 'deko-formen-berge-salbei', 105, 114, 105, undefined, { opacity: 0.3 }),
    ctext('FROHE', FR.cx, 60, 90, 16, 'FROHE', { f: 'Raleway', s: 22, w: 300, c: '#ffffff', ls: 0.5, min: 10 }),
    ctext('WEIHNACHTEN', FR.cx, 76, 94, 14, 'WEIHNACHTEN', { f: 'Raleway', s: 16, w: 700, c: '#ffffff', ls: 0.3, min: 8 }),
    line('Strich', FR.cx - 8, 98, FR.cx + 8, 98, '#e9c46a', 0.6, { locked: true }),
  ], [
    line('Strich', 120, 26, 136, 26, NAVY, 0.8, { locked: true }),
    text('Anrede', 120, 30, 76, 11, 'Liebe Jana,', { f: 'Raleway', s: 15, w: 700, c: NAVY, min: 9 }),
    text('Text', 120, 46, 76, 56, 'wir wünschen dir ruhige Feiertage, leckeres Essen und Zeit für das, was dir wichtig ist. Wir sehen uns im neuen Jahr!', { f: 'Raleway', s: 10.5, w: 400, c: NAVY, v: 'top', wrap: true, lh: 1.6, min: 7 }),
    text('Gruß', 120, 108, 76, 8, 'Liebe Grüße, Ben', { f: 'Raleway', s: 10, w: 700, c: '#c18e1f', min: 6 }),
    dk('Flocke i', 'deko-sterne-schneeflocke-1-navy', 38, 48, 30),
    dk('Flocke i2', 'deko-sterne-schneeflocke-1-navy', 22, 82, 12, undefined, { opacity: 0.6 }),
    dk('Flocke i3', 'deko-sterne-schneeflocke-1-navy', 66, 90, 9, undefined, { opacity: 0.5 }),
  ], NAVY, '#ffffff'),
}));

// ============================================================================================================================ Postkarte
const PM = { family: 'weihnachtspostkarte', familyName: 'Weihnachtspostkarte', occasion: 'Feiertage', formatKey: 'postcard-a6-landscape', width: 148, height: 105 };

/** The back of a postcard: message on the left, stamp and three address lines on the right. */
function postBack(ink, accent, bg, o = {}) {
  const lines = [0, 1, 2, 3].map(i => line('Adresszeile ' + (i + 1), 88, 50 + i * 9, 138, 50 + i * 9, o.lineColor || '#b9b9b9', 0.25, { locked: true }));
  return page(bg, [
    line('Mittellinie', 80, 14, 80, 91, o.lineColor || '#b9b9b9', 0.25, { locked: true }),
    rect('Briefmarke', 118, 10, 20, 24, null, { stroke: o.lineColor || '#b9b9b9', sw: 0.3, dash: 'dashed', locked: true }),
    text('Briefmarke Hinweis', 118, 18, 20, 8, 'Marke', { f: 'Raleway', s: 6, c: o.lineColor || '#9a9a9a', a: 'center', min: 4 }),
    ...lines,
    text('Anrede', 12, 14, 62, 9, 'Liebe Marie,', { f: o.f || 'Caveat', s: o.fs || 20, w: 700, c: accent, min: 10 }),
    text('Text', 12, 25, 62, 56, 'wir wünschen dir frohe Weihnachten, schöne Tage im Kreis deiner Lieben und einen guten Rutsch ins neue Jahr!', { f: o.f || 'Caveat', s: (o.fs || 20) - 4, w: o.fw || 500, c: ink, v: 'top', wrap: true, lh: 1.3, min: 9 }),
    text('Gruß', 12, 84, 62, 9, 'Deine Familie Berger', { f: o.f || 'Caveat', s: (o.fs || 20) - 2, w: 700, c: accent, a: 'right', min: 9 }),
  ], 'Rückseite');
}

const winterwald = tpl(Object.assign({}, PM, {
  slug: 'weihnachtspostkarte-winterwald',
  name: 'Weihnachtspostkarte – Winterwald',
  description: 'Postkarte A6 quer mit Vorder- und Rückseite: tief verschneiter Tannenwald unter dem Sternenhimmel, „Frohe Weihnachten“ in Schreibschrift und eine Rückseite mit Briefmarkenfeld und Adresszeilen.',
  variant: 'Winterwald',
  tags: ['Weihnachten', 'Postkarte', 'Winterwald', 'Tannen', 'Sterne', 'Nacht', 'Frohe Weihnachten', 'Weihnachtspost', 'Karte', 'Adresse'],
  pages: [
    page(gradient(180, '#0f1e45', '#27508a'), [
      dk('Sterne', 'deko-sterne-himmel-weiss', 0, -10, 148, 148, { opacity: 0.55 }),
      dk('Mond', 'deko-formen-mond-gold', 112, 10, 18),
      icon('Tanne 1', 'tree-pine', 8, 58, 30, '#eaf2ff', 1.4),
      icon('Tanne 2', 'tree-pine', 30, 66, 22, '#cfdcf3', 1.4),
      icon('Tanne 3', 'tree-pine', 100, 60, 34, '#eaf2ff', 1.4),
      icon('Tanne 4', 'tree-pine', 126, 70, 20, '#cfdcf3', 1.4),
      rect('Schnee', -2, 90, 152, 17, '#f4f8ff', { locked: true }),
      ctext('Frohe', 66, 20, 100, 18, 'Frohe', { f: 'Parisienne', s: 34, c: '#ffffff', min: 16 }),
      ctext('Weihnachten', 74, 38, 120, 20, 'Weihnachten', { f: 'Parisienne', s: 42, c: '#f6d98b', min: 20 }),
      ctext('Wunsch', 74, 94, 120, 7, 'und ein glückliches neues Jahr', { f: 'Raleway', s: 8, w: 700, c: '#27508a', up: true, ls: 0.2, min: 5 }),
    ], 'Vorderseite'),
    postBack('#16213e', '#27508a', '#fbfcff'),
  ],
}));

const flocken = tpl(Object.assign({}, PM, {
  slug: 'weihnachtspostkarte-schneeflocken',
  name: 'Weihnachtspostkarte – Schneeflocken',
  description: 'Postkarte A6 quer mit Vorder- und Rückseite: Petrolblau mit großen Schneekristallen, schmale Großbuchstaben „Frohe Weihnachten“ und eine aufgeräumte Rückseite mit Briefmarkenfeld.',
  variant: 'Schneeflocken',
  tags: ['Weihnachten', 'Postkarte', 'Schneeflocken', 'Winter', 'modern', 'Petrol', 'Frohe Weihnachten', 'Weihnachtspost', 'Karte', 'Kristalle'],
  pages: [
    page('#1d4a5a', [
      dk('Flocke groß', 'deko-sterne-schneeflocke-1-weiss', 78, -8, 80, undefined, { opacity: 0.22 }),
      dk('Flocke 2', 'deko-sterne-schneeflocke-3-weiss', 94, 38, 34),
      dk('Flocke 3', 'deko-sterne-schneeflocke-2-weiss', 122, 14, 17),
      dk('Flocke 4', 'deko-sterne-schneeflocke-1-weiss', 118, 76, 14),
      dk('Flocke 5', 'deko-sterne-schneeflocke-2-weiss', 72, 82, 10, undefined, { opacity: 0.7 }),
      text('FROHE', 14, 22, 80, 14, 'FROHE', { f: 'Josefin Sans', s: 18, w: 300, c: '#ffffff', ls: 0.4, min: 9 }),
      text('WEIHNACHTEN', 14, 36, 88, 18, 'WEIH-\nNACHTEN', { f: 'Josefin Sans', s: 26, w: 700, c: '#ffffff', ls: 0.08, wrap: true, lh: 1.1, v: 'top', min: 12 }),
      line('Strich', 14, 74, 34, 74, '#f6d98b', 0.8, { locked: true }),
      text('Wunsch', 14, 78, 80, 8, 'und ein gutes neues Jahr', { f: 'Josefin Sans', s: 9, w: 400, c: '#cfe3ea', min: 6 }),
    ], 'Vorderseite'),
    postBack('#1d4a5a', '#1d4a5a', '#ffffff', { f: 'Josefin Sans', fs: 14, fw: 400 }),
  ],
}));

const retro = tpl(Object.assign({}, PM, {
  slug: 'weihnachtspostkarte-retro-rot',
  name: 'Weihnachtspostkarte – Retro Rot',
  description: 'Postkarte A6 quer mit Vorder- und Rückseite: roter Grund, cremefarbenes Banner, „Frohes Fest“ in dicker Pinselschrift, Geschenk und Glocke im Siebziger-Stil und eine Schreibseite mit Briefmarkenfeld.',
  variant: 'Retro Rot',
  tags: ['Weihnachten', 'Postkarte', 'Retro', 'Vintage', 'Rot', 'Frohes Fest', 'Geschenk', 'Weihnachtspost', 'Karte', 'Glocke'],
  pages: [
    page('#c8362c', [
      dk('Muster', 'deko-muster-punkte-weiss', 0, -26, 148, 148, { opacity: 0.1 }),
      dk('Banderole', 'deko-baender-banderole-bordeaux', 6, 14, 136),
      ctext('Frohes', 74, 17, 100, 18, 'Frohe', { f: 'Pacifico', s: 26, c: '#fbeed2', min: 12 }),
      icon('Glocke', 'bell-ring', 14, 52, 26, '#f6d98b', 1.6, { rotation: -10 }),
      icon('Geschenk', 'gift', 108, 54, 26, '#f6d98b', 1.6, { rotation: 8 }),
      ctext('Weihnachten', 74, 44, 70, 22, 'Weihnachten', { f: 'Pacifico', s: 30, c: '#ffffff', min: 14, shadow: shadow('#7d1f1a', 0.5, 0, 0.8, 1) }),
      ctext('Wunsch', 74, 78, 110, 8, 'Wir wünschen euch eine schöne Zeit', { f: 'Montserrat', s: 8, w: 700, c: '#fbeed2', up: true, ls: 0.18, min: 5 }),
    ], 'Vorderseite'),
    postBack('#4a1815', '#c8362c', '#fbeed2', { f: 'Caveat', lineColor: '#d9b9a0' }),
  ],
}));

module.exports = { rotgold, tanne, nordisch, winterwald, flocken, retro };
