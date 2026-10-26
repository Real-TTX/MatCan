'use strict';
const L = require('./_t2a-lib');
const { text, rect, ellipse, line, icon, shape, page, foldCard, panels, ctext, divider, dk, dekoIn, tpl, gradient } = L;

const META = { family: 'muttertagskarte', familyName: 'Muttertagskarte', occasion: 'Feiertage' };

// ---------------------------------------------------------------------------------------------------------------------------- Blumengruß
const ROSE = '#b0585f';
const blumen = tpl(Object.assign({}, META, {
  slug: 'muttertagskarte-blumengruss',
  name: 'Muttertagskarte A6 hoch – Blumengruß',
  description: 'Romantische Muttertagskarte im Format A6 hoch: ein Strauß aus Pfingstrose, Rose und Margerite, „Alles Liebe zum Muttertag“ in Schreibschrift. Innen eine Blütenecke und Platz für deine Worte.',
  variant: 'Blumengruß',
  tags: ['Muttertag', 'Mama', 'Blumen', 'Pfingstrose', 'Rose', 'Blumenstrauß', 'rosé', 'Karte', 'Danke Mama', 'romantisch'],
  formatKey: 'a6-portrait', width: 105, height: 148,
  pages: [
    page('#fdf6f2', [
      dk('Rose', 'deko-blumen-rose-rose', 4, 56, 40),
      dk('Pfingstrose', 'deko-blumen-pfingstrose-rose', 31, 48, 46),
      dk('Margerite', 'deko-blumen-margerite-rose', 64, 66, 34),
      ctext('Alles Liebe', 52.5, 14, 90, 16, 'Alles Liebe', { f: 'Parisienne', s: 30, c: ROSE, min: 14 }),
      ctext('zum Muttertag', 52.5, 28, 90, 16, 'zum Muttertag', { f: 'Parisienne', s: 30, c: '#7a3f45', min: 14 }),
      ctext('Wunsch', 52.5, 130, 86, 7, 'in Liebe und Dankbarkeit', { f: 'Raleway', s: 7.5, w: 600, c: ROSE, up: true, ls: 0.22, min: 5 }),
    ], 'Vorderseite'),
    page('#fffdfb', [
      dk('Ecke', 'deko-ecken-blueten-rose', 0, 0, 38),
      text('Anrede', 16, 46, 74, 11, 'Liebe Mama,', { f: 'Parisienne', s: 22, c: ROSE, min: 12 }),
      text('Text', 16, 60, 74, 54, 'danke für deine Liebe, deine Geduld und dafür, dass du immer für mich da bist. Du bist die beste Mama der Welt!', { f: 'Lora', s: 10.5, c: '#4a3b3d', v: 'top', wrap: true, lh: 1.6, min: 7 }),
      text('Gruß', 16, 118, 74, 10, 'Deine Lisa', { f: 'Parisienne', s: 20, c: ROSE, a: 'right', min: 10 }),
    ], 'Innenseite'),
  ],
}));

// ---------------------------------------------------------------------------------------------------------------------------- Herz
const heart = tpl(Object.assign({}, META, {
  slug: 'muttertagskarte-herz',
  name: 'Muttertagskarte A6 quer – Herz',
  description: 'Herzliche Muttertagskarte im Format A6 quer: ein großes Herz mit „Danke, Mama“ in Handschrift, kleine Herzen als Konfetti und eine Innenseite mit Zeilen für deinen Muttertagsgruß.',
  variant: 'Herz',
  tags: ['Muttertag', 'Mama', 'Herz', 'Danke Mama', 'Handschrift', 'Kinder', 'rosa', 'Karte', 'Liebe', 'basteln'],
  formatKey: 'a6-landscape', width: 148, height: 105,
  pages: [
    page('#ffe9ee', [
      dk('Herzen', 'deko-herzen-streuung-rose', 76, 0, 72, undefined, { opacity: 0.6 }),
      dk('Herz', 'deko-herzen-voll-rose', 14, 8, 84),
      ctext('Danke', 56, 24, 76, 24, 'Danke,', { f: 'Caveat', s: 44, w: 700, c: '#ffffff', lh: 1, min: 24 }),
      ctext('Mama', 56, 40, 80, 26, 'Mama!', { f: 'Caveat', s: 50, w: 700, c: '#ffffff', lh: 1, min: 24 }),
      text('Zeile', 100, 80, 46, 14, 'Alles Liebe zum\nMuttertag', { f: 'Caveat', s: 17, w: 700, c: '#b0585f', a: 'center', wrap: true, lh: 1.1, min: 8 }),
    ], 'Vorderseite'),
    page('#fffaf7', [
      icon('Herz', 'heart', 120, 12, 14, '#e8708a', 1.8),
      text('Anrede', 16, 14, 100, 12, 'Liebe Mama,', { f: 'Caveat', s: 28, w: 700, c: '#e8708a', min: 14 }),
      text('Text', 16, 28, 112, 50, 'du bist die Beste! Danke für jedes Pflaster, jede Umarmung und jedes Abendbrot. Heute bist du dran: Frühstück ans Bett und ein Tag nur für dich.', { f: 'Caveat', s: 21, w: 500, c: '#5a3a40', v: 'top', wrap: true, lh: 1.3, min: 12 }),
      text('Gruß', 16, 82, 112, 10, 'Dein Max', { f: 'Caveat', s: 26, w: 700, c: '#e8708a', a: 'right', min: 12 }),
      line('Linie', 16, 95, 132, 95, '#f3c4cf', 0.5, { dash: 'dotted', locked: true }),
    ], 'Innenseite'),
  ],
}));

// ---------------------------------------------------------------------------------------------------------------------------- Pinselstrich (Klappkarte)
const KM = { formatKey: 'card-a6-portrait', fold: 'vertical', width: 210, height: 148 };
const [BL, FR] = panels(210, 148, 'vertical', 4);
const pinsel = tpl(Object.assign({}, META, KM, {
  slug: 'muttertagskarte-pinselstrich',
  name: 'Muttertagskarte Klappkarte – Pinselstrich',
  description: 'Moderne Klappkarte A6 hoch zum Muttertag: lachsfarbener Pinselstrich, Kirschblütenzweig und „Danke Mama“ in kräftiger Schrift mit Handschrift-Akzent. Innen zwei ruhige Seiten für deinen Text.',
  variant: 'Pinselstrich',
  tags: ['Muttertag', 'Mama', 'modern', 'Pinselstrich', 'Kirschblüten', 'Klappkarte', 'lachs', 'Karte', 'Danke Mama', 'Handlettering'],
  pages: foldCard('vertical', [
    dk('Blüten hinten', 'deko-blumen-kirschblueten-rose', BL.cx - 30, 100, 60),
    dk('Pinsel', 'deko-formen-pinsel-1-rose', 108, 46, 94),
    dk('Zweig', 'deko-blumen-kirschblueten-rose', 112, 8, 88),
    text('Danke', 115, 46.5, 70, 16, 'DANKE', { f: 'Poppins', s: 36, w: 700, c: '#ffffff', ls: 0.1, lh: 1, min: 20 }),
    ctext('Mama', FR.cx, 72, 80, 22, 'Mama', { f: 'Dancing Script', s: 44, w: 700, c: '#7a3f45', min: 20 }),
    ctext('Muttertag', FR.cx, 104, 80, 7, 'zum Muttertag', { f: 'Poppins', s: 8, w: 500, c: '#7a3f45', up: true, ls: 0.3, min: 5 }),
  ], [
    dk('Pinsel innen', 'deko-formen-pinsel-2-rose', 6, 18, 90),
    ctext('Titel', 52.5, 60, 80, 20, 'Für die beste\nMama der Welt', { f: 'Dancing Script', s: 24, w: 700, c: '#7a3f45', wrap: true, lh: 1.15, min: 12 }),
    text('Anrede', 120, 26, 76, 12, 'Liebe Mama,', { f: 'Dancing Script', s: 24, w: 700, c: '#b0585f', min: 12 }),
    text('Text', 120, 42, 76, 62, 'du schenkst mir jeden Tag Mut, Wärme und ein offenes Ohr. Heute möchte ich dir einfach sagen: Danke, dass es dich gibt. Ich hab dich lieb!', { f: 'Poppins', s: 10.5, w: 400, c: '#4a3b3d', v: 'top', wrap: true, lh: 1.55, min: 8 }),
    text('Gruß', 120, 110, 76, 10, 'Deine Lisa', { f: 'Dancing Script', s: 20, w: 700, c: '#b0585f', a: 'right', min: 10 }),
  ], '#fff4ee', '#ffffff'),
}));

module.exports = { blumen, heart, pinsel };
