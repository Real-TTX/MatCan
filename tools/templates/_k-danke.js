'use strict';
const L = require('./_t2a-lib');
const { text, rect, ellipse, line, icon, shape, page, foldCard, panels, ctext, divider, dk, dekoIn, deko, dekoCorners, tpl, field } = L;

const META = { family: 'danke-karte', familyName: 'Dankeskarte', occasion: 'Feste & Events' };

// ---------------------------------------------------------------------------------------------------------------------------- Handschrift
const INK = '#4a3b32';
const handschrift = tpl(Object.assign({}, META, {
  slug: 'danke-handschrift',
  name: 'Dankeskarte A6 quer – Handschrift',
  description: 'Persönliche Dankeskarte im Format A6 quer: riesiges handgeschriebenes „Danke“ auf Kraftpapier-Ton mit kleinen Herzen, innen liniert und mit Platz für ein paar eigene Zeilen.',
  variant: 'Handschrift',
  tags: ['Danke', 'Dankeskarte', 'Dankeschön', 'Handschrift', 'Herzen', 'Kraftpapier', 'Karte', 'persönlich', 'Dank'],
  formatKey: 'a6-landscape', width: 148, height: 105,
  pages: [
    page('#f1e4cf', [
      dk('Herzen', 'deko-herzen-streuung-rose', 84, 2, 62, undefined, { opacity: 0.75 }),
      ctext('Danke', 74, 10, 128, 58, 'Danke', { f: 'Caveat', s: 118, w: 700, c: '#c8473f', lh: 1, min: 50, rotation: -4 }),
      ctext('Zeile', 74, 70, 120, 11, 'von ganzem Herzen', { f: 'Caveat', s: 26, w: 600, c: INK, min: 12 }),
      line('Linie', 52, 86, 96, 86, '#c8473f', 0.5, { locked: true }),
    ], 'Vorderseite'),
    page('#fffaf1', [
      rect('Rand', 0, 0, 5, 105, '#c8473f', { locked: true }),
      text('Anrede', 18, 14, 112, 12, 'Liebe Anna,', { f: 'Caveat', s: 28, w: 700, c: '#c8473f', min: 14 }),
      text('Text', 18, 28, 112, 46, 'vielen Dank für deine Hilfe, deine Zeit und dein offenes Ohr. Ohne dich wäre vieles schwerer gewesen. Ich bin froh, dich an meiner Seite zu haben.', { f: 'Caveat', s: 21, w: 500, c: INK, v: 'top', wrap: true, lh: 1.3, min: 12 }),
      text('Gruß', 18, 80, 112, 10, 'Deine Lisa', { f: 'Caveat', s: 26, w: 700, c: INK, a: 'right', min: 12 }),
      icon('Herz', 'heart', 18, 82, 7, '#c8473f', 2),
    ], 'Innenseite'),
  ],
}));

// ---------------------------------------------------------------------------------------------------------------------------- Blumen
const blumen = tpl(Object.assign({}, META, {
  slug: 'danke-blumen',
  name: 'Dankeskarte A6 hoch – Blumen',
  description: 'Zarte Dankeskarte im Format A6 hoch mit Pfingstrosen und Blütenecke: „Vielen Dank“ in Kursivschrift, innen eine Blütenranke und Platz für deine Zeilen an Gäste, Helfer oder Gastgeber.',
  variant: 'Blumen',
  tags: ['Danke', 'Dankeskarte', 'Blumen', 'Blüten', 'Pfingstrose', 'rosé', 'romantisch', 'Karte', 'Dankeschön', 'zart'],
  formatKey: 'a6-portrait', width: 105, height: 148,
  pages: [
    page('#fdf8f5', [
      dk('Pfingstrose', 'deko-blumen-pfingstrose-rose', 28, 80, 48),
      dk('Margerite', 'deko-blumen-margerite-rose', 5, 103, 26),
      dk('Anemone', 'deko-blumen-anemone-rose', 74, 108, 26),
      ctext('Vielen', 52.5, 18, 86, 26, 'Vielen', { f: 'Playfair Display', s: 36, i: true, w: 400, c: '#9b5a5f', lh: 1.1, min: 18 }),
      ctext('Dank', 52.5, 38, 86, 28, 'Dank', { f: 'Playfair Display', s: 46, w: 700, c: '#9b5a5f', up: true, ls: 0.08, lh: 1.1, min: 20 }),
      divider('Trenner', 52.5, 72, 28, '#d9a3a6', { mid: 'heart', size: 3 }),
    ], 'Vorderseite'),
    page('#fffdfb', [
      dk('Ecke', 'deko-ecken-blueten-rose', 0, 0, 40),
      dk('Ecke unten', 'deko-ecken-blueten-rose', 65, 108, 40, undefined, { flipX: true, flipY: true }),
      text('Anrede', 16, 46, 74, 11, 'Liebe Anna,', { f: 'Playfair Display', s: 15, i: true, c: '#9b5a5f', min: 9 }),
      text('Text', 16, 59, 74, 46, 'von Herzen danke ich dir für dein wunderbares Geschenk und die schönen Stunden mit dir. Du hast mir eine große Freude gemacht.', { f: 'Lora', s: 10.5, c: '#4a3b3d', v: 'top', wrap: true, lh: 1.55, min: 7 }),
      text('Gruß', 16, 108, 74, 9, 'Herzlich, Lisa', { f: 'Playfair Display', s: 13, i: true, c: '#9b5a5f', a: 'right', min: 8 }),
    ], 'Innenseite'),
  ],
}));

// ---------------------------------------------------------------------------------------------------------------------------- Modern
const modern = tpl(Object.assign({}, META, {
  slug: 'danke-modern',
  name: 'Dankeskarte Klappkarte quadratisch – Modern',
  description: 'Klare Dankeskarte als quadratische Klappkarte: vorne ein riesiges „DANKE“ in Salbeigrün und Weiß, hinten eine kurze Zeile, innen ein ruhiges Layout für deinen Text.',
  variant: 'Modern',
  tags: ['Danke', 'Dankeskarte', 'modern', 'Typografie', 'quadratisch', 'Klappkarte', 'grün', 'minimal', 'Karte', 'Dankeschön'],
  formatKey: 'card-square-145', fold: 'vertical', width: 290, height: 145,
  pages: foldCard('vertical', [
    ctext('Hinten', 72.5, 66, 90, 14, 'Schön, dass es dich gibt.', { f: 'Raleway', s: 14, w: 500, c: '#2f4a3b', min: 7 }),
    rect('Front', 145, 0, 145, 145, '#9bb8a1', { locked: true }),
    ellipse('Kreis', 192, 18, 100, 100, '#e7efe5', { locked: true, opacity: 0.55 }),
    text('DAN', 154, 24, 130, 52, 'DAN', { f: 'Anton', s: 100, c: '#ffffff', lh: 1, min: 40 }),
    text('KE', 154, 70, 130, 52, 'KE', { f: 'Anton', s: 100, c: '#2f4a3b', lh: 1, min: 40 }),
    text('Zeile', 156, 126, 100, 8, 'von Herzen', { f: 'Raleway', s: 10, w: 700, c: '#2f4a3b', up: true, ls: 0.3, min: 6 }),
  ], [
    line('Strich', 24, 28, 44, 28, '#9bb8a1', 1.2, { locked: true }),
    text('Anrede', 24, 32, 100, 12, 'Liebe Anna,', { f: 'Raleway', s: 20, w: 700, c: '#2f4a3b', min: 11 }),
    text('Text', 24, 50, 100, 62, 'danke für alles, was du getan hast. Es hat mir viel bedeutet und ich bin dir sehr dankbar. Lass uns bald einmal in Ruhe darauf anstoßen.', { f: 'Raleway', s: 12.5, w: 400, c: '#2f4a3b', v: 'top', wrap: true, lh: 1.55, min: 8 }),
    text('Gruß', 24, 118, 100, 9, 'Deine Lisa', { f: 'Raleway', s: 12, w: 700, c: '#2f4a3b', min: 8 }),
    dk('Zweig', 'deko-blumen-eukalyptuszweig-salbei', 200, 8, 28),
    dk('Zweig 2', 'deko-blumen-eukalyptuszweig-salbei', 238, 30, 22, undefined, { flipX: true }),
  ], '#f4f7f1'),
}));

module.exports = { handschrift, blumen, modern };
