// Makes the WOFF2 files of the bundled fonts that may be modified (no Reserved Font Name) from the TTFs of the Google Fonts repository:
// ONE file per face with Latin + Latin Extended (no unicode-range: the app registers one file per family, weight and style), variable axes kept.
//
//   npm i subset-font          (in a temp folder OUTSIDE the repository)
//   NODE_PATH=<that folder>/node_modules node tools/fonts-subset.js <folder with the downloaded upstream TTFs> <out folder>
//
// <folder with the upstream TTFs> holds one sub folder per Google directory name (ofl/<dir>/<file>.ttf), see FACES below. Families whose
// licence reserves the font name (Dancing Script, Raleway, IBM Plex Mono ...) are NOT processed here: the OFL treats a changed format as a
// modification, so those ship as the unmodified TTF (wwwroot/fonts/README.md).
'use strict';
const fs = require('fs');
const path = require('path');
const subsetFont = require('subset-font');

// [output file, upstream directory, upstream file, axes to pin]
const FACES = [
  ['GreatVibes-Regular.woff2', 'greatvibes', 'GreatVibes-Regular.ttf'],
  ['Allura-Regular.woff2', 'allura', 'Allura-Regular.ttf'],
  ['CormorantGaramond-Variable.woff2', 'cormorantgaramond', 'CormorantGaramond[wght].ttf'],
  ['CormorantGaramond-Italic-Variable.woff2', 'cormorantgaramond', 'CormorantGaramond-Italic[wght].ttf'],
  ['Cinzel-Variable.woff2', 'cinzel', 'Cinzel[wght].ttf'],
  ['Fredoka-Variable.woff2', 'fredoka', 'Fredoka[wdth,wght].ttf', { wdth: 100 }],
  ['Baloo2-Variable.woff2', 'baloo2', 'Baloo2[wght].ttf'],
  ['PatrickHand-Regular.woff2', 'patrickhand', 'PatrickHand-Regular.ttf'],
  ['Anton-Regular.woff2', 'anton', 'Anton-Regular.ttf'],
  ['AmaticSC-Regular.woff2', 'amaticsc', 'AmaticSC-Regular.ttf'],
  ['AmaticSC-Bold.woff2', 'amaticsc', 'AmaticSC-Bold.ttf'],
  ['Inter-Variable.woff2', 'inter', 'Inter[opsz,wght].ttf', { opsz: 14 }],
  ['Inter-Italic-Variable.woff2', 'inter', 'Inter-Italic[opsz,wght].ttf', { opsz: 14 }],
  ['Nunito-Variable.woff2', 'nunito', 'Nunito[wght].ttf'],
  ['Nunito-Italic-Variable.woff2', 'nunito', 'Nunito-Italic[wght].ttf'],
  ['Poppins-Regular.woff2', 'poppins', 'Poppins-Regular.ttf'],
  ['Poppins-Medium.woff2', 'poppins', 'Poppins-Medium.ttf'],
  ['Poppins-SemiBold.woff2', 'poppins', 'Poppins-SemiBold.ttf'],
  ['Poppins-Bold.woff2', 'poppins', 'Poppins-Bold.ttf'],
  ['Poppins-Italic.woff2', 'poppins', 'Poppins-Italic.ttf'],
  ['Poppins-BoldItalic.woff2', 'poppins', 'Poppins-BoldItalic.ttf'],
];

const RANGES = [
  [0x20, 0x7e], [0xa0, 0x24f], [0x2b0, 0x2ff], [0x300, 0x36f], [0x1e00, 0x1eff],
  [0x2000, 0x206f], [0x2070, 0x209f], [0x20a0, 0x20cf], [0x2113, 0x2113], [0x2116, 0x2116], [0x2122, 0x2122],
  [0x2212, 0x2212], [0x2215, 0x2215], [0x2260, 0x2260], [0x2264, 0x2265], [0xfb00, 0xfb06], [0xfeff, 0xfeff], [0xfffd, 0xfffd],
];
let text = '';
for (const [a, b] of RANGES) for (let c = a; c <= b; c++) text += String.fromCodePoint(c);

(async () => {
  const [src, out] = process.argv.slice(2);
  if (!src || !out) { console.error('usage: fonts-subset.js <upstream folder> <out folder>'); process.exit(2); }
  fs.mkdirSync(out, { recursive: true });
  let total = 0;
  for (const [file, dir, upstream, pin] of FACES) {
    const input = fs.readFileSync(path.join(src, dir, upstream));
    const woff2 = await subsetFont(input, text, {
      targetFormat: 'woff2',
      variationAxes: pin,
      // the name table: copyright (0), family (1), style (2), ids, version, PostScript name, trademark, manufacturer, designer,
      // description, URLs, licence (13) and licence URL (14), typographic names (16, 17)
      preserveNameIds: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 17],
    });
    fs.writeFileSync(path.join(out, file), woff2);
    total += woff2.length;
    console.log(`${file.padEnd(42)} ${String(input.length).padStart(8)} -> ${String(woff2.length).padStart(7)}`);
  }
  console.log(`total ${total} bytes`);
})().catch(e => { console.error(e); process.exit(1); });
