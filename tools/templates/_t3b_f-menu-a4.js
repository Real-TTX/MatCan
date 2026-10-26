'use strict';
const { text, rect, ellipse, line, icon, frame, deko, dekoIn, page } = require('./dsl');
const { family } = require('./_t3b-lib');
const { menuBlock } = require('./_t3b-menu');

const LEFT = [
  { title: 'Vorspeisen', dishes: [['Tomatensuppe', 'mit Basilikum und Croutons', '6,50 €'], ['Ziegenkäse im Speckmantel', 'auf Feldsalat mit Honig-Senf-Dressing', '9,80 €'], ['Carpaccio vom Rind', 'Rucola, Parmesan, Pinienkerne', '12,50 €']] },
  { title: 'Salate', dishes: [['Gemischter Salat', 'mit Hausdressing', '6,90 €'], ['Salat mit Hähnchenbrust', 'Blattsalate, Gurke, Tomate, Croutons', '13,90 €']] },
  { title: 'Hauptgerichte', dishes: [['Schweinemedaillons', 'Champignonrahm, Spätzle, Gemüse', '18,50 €'], ['Gebratene Forelle', 'Petersilienkartoffeln, Zitronenbutter', '17,90 €'], ['Rinderschmorbraten', 'Rotweinjus, Rotkohl, Knödel', '19,90 €'], ['Gemüse-Lasagne', 'saisonales Gemüse, vegetarisch', '13,90 €']] },
];
const RIGHT = [
  { title: 'Desserts', dishes: [['Crème brûlée', 'Vanille und Beeren', '6,50 €'], ['Apfelstrudel', 'mit warmer Vanillesoße', '5,90 €'], ['Schokoladenkuchen', 'flüssiger Kern, Sahne', '7,20 €']] },
  { title: 'Alkoholfreie Getränke', dishes: [['Apfelschorle', 'hausgemacht, 0,4 l', '3,60 €'], ['Mineralwasser', 'still oder sprudelnd, 0,75 l', '5,20 €'], ['Hausgemachte Limonade', 'Zitrone und Minze, 0,4 l', '4,20 €']] },
  { title: 'Wein und Bier', dishes: [['Riesling trocken', 'Weingut am Hang, 0,2 l', '5,80 €'], ['Spätburgunder', 'Weingut am Hang, 0,2 l', '6,40 €'], ['Hausbier hell', 'frisch vom Fass, 0,3 l', '3,80 €']] },
];

const common = {
  no: 425, category: 'Karten', family: 'speisekarte-a4', familyName: 'Speisekarte A4', occasion: 'Gastronomie',
  tags: ['Speisekarte', 'Menükarte', 'Restaurant', 'Café', 'Gastronomie', 'A4', 'Getränkekarte', 'Preisliste', 'Karte'],
  formatKey: 'a4-portrait', width: 210, height: 297,
};

// ------------------------------------------------------------------ Elegant: Rahmen, zwei Spalten, Antiqua
const GOLD = '#a8832f';
const INK = '#2b2a33';
const elegant = {
  slug: 'speisekarte-a4-elegant', name: 'Speisekarte A4 – Elegant', variant: 'Elegant',
  description: 'Elegante Speisekarte im Format A4 mit goldenem Doppellinienrahmen: Titel in römischen Versalien, zwei Spalten mit Vorspeisen, Salaten, Hauptgerichten, Desserts und Getränken in feiner Antiqua. Gerichte und Preise überschreibst du direkt.',
  tags: ['Elegant', 'Gold', 'Antiqua', 'Fine Dining', 'Zwei Spalten', 'Gourmet'],
  pages: (() => {
    const st = {
      gap: 4.4, after: 4, nameH: 5.6, descH: 4.4, rule: '#e6dcc3', priceW: 18,
      name: { f: 'Cormorant Garamond', s: 13.5, w: 700, c: INK }, desc: { f: 'Cormorant Garamond', s: 10.5, i: true, w: 500, c: '#6c6a73' }, price: { f: 'Cormorant Garamond', s: 13, w: 700, c: GOLD },
      head: (x, y, w, t) => ({ h: 10, els: [text(t, x, y, w, 6, t, { f: 'Cinzel', s: 10.5, w: 600, c: GOLD, ls: 0.2, min: 7 }), line(t + ' Linie', x, y + 7.2, x + w, y + 7.2, GOLD, 0.3)] }),
    };
    const l = menuBlock({ x: 24, y: 76, w: 80, sections: LEFT, st });
    const r = menuBlock({ x: 112, y: 76, w: 74, sections: RIGHT, st: Object.assign({}, st, { priceW: 16 }) });
    return [page('#fbf6ea', [
      dekoIn('Rahmen', 'deko-rahmen-doppellinie-hoch-gold', 6, 6, 198, 285, { locked: true }),
      text('Titel', 20, 22, 170, 18, 'Speisekarte', { f: 'Cinzel', s: 38, w: 600, c: INK, a: 'center', ls: 0.14, min: 20 }),
      deko('Schnörkel', 'deko-ornamente-schnoerkel-breit-gold', 75, 42, 60, undefined, { locked: true }),
      text('Untertitel', 20, 64, 170, 5, 'Restaurant Wiesengrund', { f: 'Raleway', s: 9, w: 600, c: GOLD, a: 'center', up: true, ls: 0.28, min: 6 }),
      ...l.els, ...r.els,
      text('Fuß', 24, 268, 162, 8, 'Alle Preise inklusive Mehrwertsteuer. Bitte fragen Sie uns nach Allergenen und Zusatzstoffen.', { f: 'Cormorant Garamond', s: 9.5, i: true, c: '#6c6a73', a: 'center', min: 7 }),
    ])];
  })(),
};

// ------------------------------------------------------------------ Bistro: Farbkopf mit Bildrahmen, kräftige Marken
const TERRA = '#c4552d';
const bistro = {
  slug: 'speisekarte-a4-bistro', name: 'Speisekarte A4 – Bistro', variant: 'Bistro',
  description: 'Lebendige Bistro-Speisekarte im Format A4: terrakottafarbener Kopf mit Titel und Bildrahmen für ein Foto oder Logo, zwei Spalten mit klaren Abschnitten, Preisen rechts und feinen Linien. Gerichte und Preise überschreibst du direkt.',
  tags: ['Bistro', 'Modern', 'Terrakotta', 'Foto', 'Imbiss', 'Pizzeria', 'Poppins'],
  pages: (() => {
    const st = {
      gap: 4.6, after: 4, nameH: 5.6, descH: 4.4, rule: '#eadfd8', priceW: 18,
      name: { f: 'Poppins', s: 11, w: 600, c: '#2a1d18' }, desc: { f: 'Poppins', s: 8.5, w: 400, c: '#7a6a63' }, price: { f: 'Poppins', s: 11, w: 700, c: TERRA },
      head: (x, y, w, t) => ({ h: 10, els: [rect(t + ' Marke', x, y + 0.6, 12, 1.4, TERRA), text(t, x, y + 2.4, w, 6, t, { f: 'Poppins', s: 11, w: 800, c: '#2a1d18', up: true, ls: 0.06, min: 7 })] }),
    };
    const l = menuBlock({ x: 16, y: 82, w: 82, sections: LEFT, st });
    const r = menuBlock({ x: 112, y: 82, w: 82, sections: RIGHT, st });
    return [page('#fffaf6', [
      rect('Kopf', 0, 0, 210, 66, TERRA, { locked: true }),
      ellipse('Kreis', 130, -40, 130, 130, '#ffffff', { opacity: 0.1, locked: true }),
      text('Titel', 16, 16, 110, 20, 'Speisekarte', { f: 'Poppins', s: 40, w: 800, c: '#ffffff', min: 20 }),
      text('Untertitel', 16, 40, 110, 6, 'Bistro Wiesengrund', { f: 'Poppins', s: 12, w: 500, c: '#ffe2d6', min: 8 }),
      rect('Foto Hintergrund', 136, 12, 58, 46, '#e08a6a', { radius: 4 }),
      icon('Foto Symbol', 'utensils', 157, 26, 16, '#f6c1ac', 1.4),
      frame('Foto', 136, 12, 58, 46, { mask: 'rounded', radius: 4 }),
      ...l.els, ...r.els,
      rect('Fußband', 0, 278, 210, 19, '#2a1d18', { locked: true }),
      text('Fuß', 16, 281, 178, 13, 'Alle Preise inklusive Mehrwertsteuer · Allergene und Zusatzstoffe auf Anfrage · Mo–Sa 11–22 Uhr', { f: 'Poppins', s: 7.5, w: 400, c: '#e9d6cd', a: 'center', wrap: true, lh: 1.4, min: 6 }),
    ])];
  })(),
};

// ------------------------------------------------------------------ Landhaus: Kraftpapier, Olivenzweige, Schreibschrift
const KR = '#efe4cc';
const OLIVE = '#5e6b3a';
const landhaus = {
  slug: 'speisekarte-a4-landhaus', name: 'Speisekarte A4 – Landhaus', variant: 'Landhaus',
  description: 'Gemütliche Speisekarte im Format A4 für Landgasthof und Café: Kraftpapier-Ton, Olivenzweige, Titel in Schreibschrift und zwei Spalten in warmer Serife. Gerichte und Preise überschreibst du direkt.',
  tags: ['Landhaus', 'Rustikal', 'Kraftpapier', 'Olivenzweig', 'Gasthof', 'Café', 'Schreibschrift'],
  pages: (() => {
    const st = {
      gap: 4.4, after: 4, nameH: 5.6, descH: 4.4, rule: '#d9c9a6', priceW: 18,
      name: { f: 'Lora', s: 11.5, w: 700, c: '#3a2f1c' }, desc: { f: 'Lora', s: 9, i: true, c: '#7a6a4a' }, price: { f: 'Lora', s: 11.5, w: 700, c: OLIVE },
      head: (x, y, w, t) => ({ h: 11, els: [text(t, x, y, w, 8, t, { f: 'Dancing Script', s: 20, w: 700, c: OLIVE, min: 12 }), line(t + ' Linie', x, y + 8.6, x + w, y + 8.6, OLIVE, 0.3, { dash: 'dotted' })] }),
    };
    const l = menuBlock({ x: 18, y: 84, w: 78, sections: LEFT, st });
    const r = menuBlock({ x: 114, y: 84, w: 78, sections: RIGHT, st });
    return [page(KR, [
      deko('Olivenzweig links', 'deko-blumen-olivenzweig-salbei', -6, 8, 80, undefined, { rotation: 12, locked: true }),
      deko('Olivenzweig rechts', 'deko-blumen-olivenzweig-salbei', 136, 8, 80, undefined, { flipX: true, rotation: -12, locked: true }),
      text('Titel', 20, 24, 170, 26, 'Unsere Speisekarte', { f: 'Dancing Script', s: 46, w: 700, c: '#3a2f1c', a: 'center', min: 24 }),
      text('Untertitel', 20, 54, 170, 6, 'Gasthof zum Wiesengrund · seit 1998', { f: 'Lora', s: 10, i: true, c: '#7a6a4a', a: 'center', min: 7 }),
      deko('Trenner', 'deko-trenner-blattreihe-salbei', 60, 65, 90, undefined, { locked: true }),
      ...l.els, ...r.els,
      text('Fuß', 24, 272, 162, 8, 'Alle Preise inklusive Mehrwertsteuer. Fragt uns gern nach Allergenen.', { f: 'Lora', s: 8.5, i: true, c: '#7a6a4a', a: 'center', min: 6 }),
    ])];
  })(),
};

module.exports = family(common, [elegant, bistro, landhaus]);
