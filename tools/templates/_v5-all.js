'use strict';
/* Assembles the 90 template modules of batch V5 from _v5-data.js (content) and _v5-layouts.js (layouts): `list` has them in number order (910 to 999). */
const L = require('./_v5-lib');
const { theme } = L;
const { page } = L.dsl;
const { LAYOUTS } = require('./_v5-layouts');
const { families } = require('./_v5-data');

const DESC = {
  H: 'A5-Flyer mit farbigem Kopf, großem Motiv, Datumsplakette, Titel, Kurztext und drei Infozeilen mit Symbolen.',
  C: 'Klassisch zentrierter A5-Flyer mit Zierrahmen, großer Überschrift, Motiv in der Mitte und Datum, Ort und Preis darunter.',
  B: 'Kontrastreicher A5-Flyer auf dunklem Grund: große Titelzeilen in zwei Farben, Motiv im Kreis, Datumsplakette und Infozeilen.',
  L: 'A5-Flyer quer: farbige Seitenfläche mit Motiv und Datumsplakette, rechts Titel, Kurztext, Infozeilen und QR-Code.',
  S: 'A4-Flyer mit farbigem Kopf: sehr große Titelzeilen, Motiv im Kreis, Datumsstreifen, Kurztext, Infos und QR-Code.',
  P: 'A4-Flyer mit Programmübersicht: Titel, Datumsfeld, vier Programmpunkte mit Uhrzeit, Motiv, Infos, QR-Code und Fußzeile.',
  D: 'Schlanker DIN-lang-Flyer: Titel im Farbkopf, Motiv im Kreis, Datum, Kurztext, Ort, Preis und QR-Code.',
  V: 'DIN-lang-Flyer mit senkrechtem Titel auf einer Farbfläche, daneben Motiv, Datumsplakette, Uhrzeit, Ort, Preis und QR-Code.',
  T: 'Typografisches A3-Plakat: riesiger Titel, Datum und Uhrzeit groß, Motiv im Kreis und Fußfläche mit Ort, Preis, Web und QR-Code.',
  M: 'A3-Plakat auf Farbfläche: Motiv in großer Scheibe, Datumsplakette, mächtiger Titel, Datumsstreifen sowie Ort und Preis.',
  I: 'Instagram-Post (1080 x 1080 px): Titel links, Motiv im Kreis rechts, Datumsplakette, farbiger Fuß mit Datum, Ort, Preis und QR-Code.',
  J: 'Instagram-Post (1080 x 1080 px) als Karte auf Farbgrund: Motiv, Titel, Datum im Feld, Ort, Preis und QR-Code.',
};

const slugOf = s => s.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const list = [];
families.forEach(f => {
  [...f.layouts].forEach((letter, i) => {
    const lay = LAYOUTS[letter];
    const t = theme(f.themes[i]);
    const c = { ...f, motif: f.motifs[i] };
    const { bg, els } = lay.fn(c, t, (list.length + i) % 3);
    const label = lay.label;
    list.push({
      slug: `flyer-${f.id}-${slugOf(label)}`,
      name: `${lay.kind} – ${f.name} ${label}`,
      category: lay.category || 'Flyer',
      description: `${DESC[letter]} Thema: ${f.name}; Texte, Datum (2027) und QR-Code ersetzen.`,
      family: `flyer-${f.id}`, familyName: `Flyer ${f.name}`, variant: label,
      occasion: f.occasion,
      tags: [...new Set(['Flyer', 'Veranstaltung', 'Einladung', ...f.tags, lay.kind.split(' ')[0] === 'Plakat' ? 'Plakat' : 'Flyer', ...(lay.unit === 'px' ? ['Instagram', 'Social Media'] : [])])].slice(0, 20),
      formatKey: lay.format, width: lay.w, height: lay.h, unit: lay.unit || 'mm',
      pages: [page(bg, els, 'Vorderseite')],
    });
  });
});

module.exports = { list };
