'use strict';
const L = require('./_t2a-lib');
const { text, rect, ellipse, line, icon, shape, page, ctext, divider, dk, dekoIn, tpl, gradient, shadow } = L;

const META = { family: 'osterkarte', familyName: 'Osterkarte', occasion: 'Feiertage' };

/** An Easter egg (an ellipse) with stripes and dots that stay inside its outline. kind: 'streifen' | 'punkte' | 'welle' */
function egg(n, cx, cy, w, h, base, accent, kind = 'streifen') {
  const out = [ellipse('Ei ' + n, cx - w / 2, cy - h / 2, w, h, base, { locked: true })];
  const chord = y => w * Math.sqrt(Math.max(0, 1 - Math.pow((y - cy) / (h / 2), 2)));
  if (kind === 'streifen') {
    for (const f of [-0.12, 0.08]) {
      const y = cy + f * h;
      const cw = chord(y) * 0.98;
      out.push(rect('Streifen ' + n + (f < 0 ? 'a' : 'b'), cx - cw / 2, y - h * 0.045, cw, h * 0.09, accent, { locked: true }));
    }
  } else if (kind === 'punkte') {
    [[-0.18, -0.24], [0.14, -0.2], [-0.02, -0.02], [-0.2, 0.18], [0.18, 0.2]].forEach(([dx, dy], i) => out.push(ellipse('Punkt ' + n + '-' + (i + 1), cx + dx * w - w * 0.045, cy + dy * h - w * 0.045, w * 0.09, w * 0.09, accent, { locked: true })));
  } else {
    for (const f of [-0.2, 0.05, 0.28]) {
      const y = cy + f * h;
      const cw = chord(y) * 0.9;
      out.push(line('Welle ' + n + f, cx - cw / 2, y, cx + cw / 2, y, accent, 0.9, { locked: true, dash: 'dotted' }));
    }
  }
  out.push(ellipse('Glanz ' + n, cx - w * 0.28, cy - h * 0.3, w * 0.14, h * 0.2, '#ffffff', { opacity: 0.35, locked: true }));
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------------- Bunte Eier
const bunteEier = tpl(Object.assign({}, META, {
  slug: 'osterkarte-bunte-eier',
  name: 'Osterkarte A6 hoch – Bunte Eier',
  description: 'Fröhliche Osterkarte im Format A6 hoch: fünf bunt bemalte Ostereier auf der Blumenwiese, „Frohe Ostern“ in runder Schreibschrift auf zartem Gelb. Innen Platz für deine Osterwünsche.',
  variant: 'Bunte Eier',
  tags: ['Ostern', 'Osterkarte', 'Ostereier', 'Frühling', 'Wiese', 'bunt', 'Frohe Ostern', 'Karte', 'Kinder', 'Familie'],
  formatKey: 'a6-portrait', width: 105, height: 148,
  pages: [
    page('#fff5c9', [
      ellipse('Sonne', 56, -22, 62, 62, '#ffe27a', { locked: true }),
      ctext('Frohe', 52.5, 24, 90, 18, 'Frohe', { f: 'Pacifico', s: 28, c: '#e0577b', min: 14 }),
      ctext('Ostern', 52.5, 40, 94, 28, 'Ostern!', { f: 'Pacifico', s: 46, c: '#1fa59a', min: 20 }),
      egg(1, 16, 100, 18, 24, '#f6a5b7', '#ffffff', 'streifen'),
      egg(2, 35, 94, 20, 27, '#8fd3c9', '#ffffff', 'punkte'),
      egg(3, 54, 90, 22, 30, '#ffd166', '#e0577b', 'welle'),
      egg(4, 74, 94, 20, 27, '#b6a1e6', '#ffffff', 'streifen'),
      egg(5, 91, 100, 18, 24, '#f4b183', '#ffffff', 'punkte'),
      dk('Wiese', 'deko-blumen-wiese', -2, 100, 109),
    ], 'Vorderseite'),
    page('#fffdf2', [
      dk('Wiese innen', 'deko-blumen-wiese', 0, 118, 105),
      text('Anrede', 14, 20, 77, 11, 'Liebe Familie Koch,', { f: 'Pacifico', s: 15, c: '#e0577b', min: 9 }),
      text('Text', 14, 36, 77, 54, 'wir wünschen euch ein frohes Osterfest mit bunten Eiern, einem fleißigen Osterhasen und sonnigen Frühlingstagen im Kreis eurer Lieben.', { f: 'Nunito', s: 11, w: 500, c: '#35404a', v: 'top', wrap: true, lh: 1.5, min: 8 }),
      text('Gruß', 14, 96, 77, 9, 'Eure Nachbarn', { f: 'Pacifico', s: 13, c: '#1fa59a', a: 'right', min: 8 }),
    ], 'Innenseite'),
  ],
}));

// ---------------------------------------------------------------------------------------------------------------------------- Hase
const BROWN = '#5a3e2b';
const hase = tpl(Object.assign({}, META, {
  slug: 'osterkarte-hase',
  name: 'Osterkarte A6 quer – Hase',
  description: 'Rustikale Osterkarte im Format A6 quer: ein Hase im Kreis auf Kraftpapier-Ton, „Frohe Ostern“ in schmaler handgezeichneter Schrift und kleine Blümchen. Innen eine ruhige Schreibseite.',
  variant: 'Hase',
  tags: ['Ostern', 'Osterkarte', 'Hase', 'Osterhase', 'rustikal', 'Landhaus', 'Kraftpapier', 'Frohe Ostern', 'Karte', 'Frühling'],
  formatKey: 'a6-landscape', width: 148, height: 105,
  pages: [
    page('#ecdcc0', [
      ellipse('Scheibe', 12, 12, 81, 81, '#f8efdc', { locked: true }),
      ellipse('Ring', 16, 16, 73, 73, null, { stroke: BROWN, sw: 0.5, dash: 'dashed', locked: true }),
      icon('Hase', 'rabbit', 29, 29, 47, BROWN, 1.3),
      icon('Blume 1', 'flower-2', 84, 72, 11, '#c9704f', 1.6),
      icon('Blume 2', 'flower-2', 15, 76, 9, '#7a9a62', 1.6),
      text('Frohe', 100, 22, 44, 14, 'FROHE', { f: 'Amatic SC', s: 40, w: 700, c: BROWN, ls: 0.08, lh: 1, min: 20 }),
      text('Ostern', 98, 34, 48, 28, 'OSTERN', { f: 'Amatic SC', s: 60, w: 700, c: '#c9704f', ls: 0.04, lh: 1, min: 28 }),
      line('Linie', 100, 66, 140, 66, BROWN, 0.5, { locked: true }),
      text('Wunsch', 100, 69, 44, 14, 'Hoppel-hoppel,\nbis bald!', { f: 'Caveat', s: 15, w: 600, c: BROWN, wrap: true, lh: 1.1, v: 'top', min: 8 }),
    ], 'Vorderseite'),
    page('#fbf5e8', [
      rect('Band', 0, 0, 148, 6, '#c9704f', { locked: true }),
      icon('Ei', 'egg', 126, 16, 12, '#7a9a62', 1.6),
      text('Anrede', 18, 16, 100, 12, 'Liebe Oma,', { f: 'Amatic SC', s: 30, w: 700, c: '#c9704f', min: 14 }),
      text('Text', 18, 30, 106, 44, 'der Osterhase war schon bei uns und hat dir ein ganz besonders liebes Hallo mitgebracht. Wir freuen uns auf das gemeinsame Osterfrühstück mit dir!', { f: 'Caveat', s: 19, w: 500, c: BROWN, v: 'top', wrap: true, lh: 1.25, min: 11 }),
      text('Gruß', 18, 82, 112, 10, 'Deine Enkel', { f: 'Amatic SC', s: 28, w: 700, c: BROWN, a: 'right', min: 12 }),
    ], 'Innenseite'),
  ],
}));

// ---------------------------------------------------------------------------------------------------------------------------- Frühlingsaquarell
const blueten = tpl(Object.assign({}, META, {
  slug: 'osterkarte-fruehling',
  name: 'Osterkarte DIN lang – Frühlingsblüten',
  description: 'Zarte Osterkarte im Format DIN lang hoch: Kirschblütenzweig und Aquarellfleck in Rosé, ein einzelnes Osterei und „Frohe Ostern“ in feiner Schreibschrift. Innen luftig mit Platz für Grüße.',
  variant: 'Frühlingsblüten',
  tags: ['Ostern', 'Osterkarte', 'Kirschblüten', 'Frühling', 'Aquarell', 'zart', 'rosé', 'Frohe Ostern', 'Karte', 'DIN lang', 'elegant'],
  formatKey: 'din-lang-portrait', width: 99, height: 210,
  pages: [
    page('#fffaf8', [
      dk('Aquarell', 'deko-formen-aquarell-rose', -10, 78, 120),
      dk('Zweig', 'deko-blumen-kirschblueten-rose', 2, 8, 100),
      egg(1, 49.5, 128, 26, 35, '#fbf3ef', '#d9a3a6', 'welle'),
      ctext('Frohe', 49.5, 52, 80, 20, 'Frohe', { f: 'Parisienne', s: 38, c: '#9b5a5f', min: 18 }),
      ctext('Ostern', 49.5, 66, 86, 26, 'Ostern', { f: 'Parisienne', s: 52, c: '#7a4044', min: 22 }),
      ctext('Wunsch', 49.5, 176, 80, 8, 'mit den besten Wünschen zum Frühling', { f: 'Raleway', s: 7.5, w: 600, c: '#9b5a5f', up: true, ls: 0.16, min: 5 }),
    ], 'Vorderseite'),
    page('#fffaf8', [
      dk('Zweig innen', 'deko-blumen-kirschblueten-rose', 6, 190, 88, undefined, { flipY: true }),
      line('Strich', 14, 36, 34, 36, '#d9a3a6', 0.8, { locked: true }),
      text('Anrede', 14, 42, 71, 11, 'Liebe Anna,', { f: 'Parisienne', s: 22, c: '#9b5a5f', min: 12 }),
      text('Text', 14, 58, 71, 84, 'ich wünsche dir ein frohes Osterfest und einen ersten warmen Frühlingstag, an dem du die Sonne richtig genießen kannst. Lass dich vom Osterhasen verwöhnen!', { f: 'Raleway', s: 10.5, w: 400, c: '#4a3b3d', v: 'top', wrap: true, lh: 1.65, min: 7 }),
      text('Gruß', 14, 148, 71, 9, 'Deine Lisa', { f: 'Parisienne', s: 18, c: '#9b5a5f', a: 'right', min: 10 }),
    ], 'Innenseite'),
  ],
}));

module.exports = { bunteEier, hase, blueten };
