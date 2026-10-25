#!/usr/bin/env node
/* Builds src/DesignThix/wwwroot/lib/icons.json, the icon library of the designer (about 1 900 Lucide icons, ISC licence), from the MatDesign icon library
   ../MatDesign/tools/iconlib/lucide.json:   { source, categories: { id: { title, description, icon } }, icons: { name: { body, tags, categories, aliases } } }
   Output (compact JSON):  { source: {...}, categories: { id: { title: "<German>" } }, icons: { name: { b: body, t: [tags + German synonyms], c: [categories] } } }
   Also copies the licence to wwwroot/lib/LICENSE-lucide.txt.
   Every body is checked: only the elements path, circle, rect, line, polyline, polygon, ellipse and only the attributes d, cx, cy, r, rx, ry, x, y, width, height, x1, y1, x2, y2,
   points, with values made of numbers and path commands. The engine parses a body into elements with the same allowlist (never as HTML); an icon that does not pass is dropped here.
   Run: node tools/iconlib.js [path to lucide.json]      (a script of the repository: the file it writes is committed by the owner, the script is the source) */
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const source = process.argv[2] || path.join(root, '..', 'MatDesign', 'tools', 'iconlib', 'lucide.json');
const licenceSource = path.join(path.dirname(source), 'LICENSE-lucide.txt');
const outDir = path.join(root, 'src', 'DesignThix', 'wwwroot', 'lib');

// ---------------------------------------------------------------------------------------------------- German titles of the categories

const CATEGORY_TITLES = {
  accessibility: 'Barrierefreiheit',
  account: 'Konto & Zugang',
  animals: 'Tiere',
  arrows: 'Pfeile',
  buildings: 'Gebäude',
  charts: 'Diagramme',
  communication: 'Kommunikation',
  connectivity: 'Verbindung',
  cursors: 'Zeiger',
  design: 'Design',
  development: 'Entwicklung',
  devices: 'Geräte',
  emoji: 'Emoji',
  files: 'Dateien',
  finance: 'Finanzen',
  'food-beverage': 'Essen & Trinken',
  gaming: 'Spiele',
  home: 'Haus & Wohnen',
  layout: 'Layout',
  mail: 'Post & Mail',
  math: 'Mathematik',
  medical: 'Gesundheit',
  multimedia: 'Multimedia',
  nature: 'Natur',
  navigation: 'Navigation',
  notifications: 'Benachrichtigungen',
  people: 'Menschen',
  photography: 'Fotografie',
  science: 'Wissenschaft',
  seasons: 'Jahreszeiten',
  security: 'Sicherheit',
  shapes: 'Formen',
  shopping: 'Einkaufen',
  social: 'Soziales',
  sports: 'Sport',
  sustainability: 'Nachhaltigkeit',
  text: 'Text',
  time: 'Zeit',
  tools: 'Werkzeuge',
  transportation: 'Verkehr',
  travel: 'Reisen',
  weather: 'Wetter',
};

// ---------------------------------------------------------------------------------------------------- German synonyms: icon name -> German words
// Chosen for a shop, a label, an event and a business (price tags, food, offers, cards, posters). Words with umlauts also get a spelling without them (ä -> ae, ß -> ss).

const SYNONYMS = {
  // love, stars, rewards
  heart: 'herz liebe lieben favorit gefällt',
  'heart-handshake': 'herz partnerschaft hilfe',
  'heart-pulse': 'herzschlag gesundheit puls herzfrequenz',
  'hand-heart': 'spende hilfe herz',
  star: 'stern favorit bewertung',
  'star-half': 'halber stern bewertung',
  trophy: 'pokal preis sieger gewinner',
  award: 'auszeichnung medaille preis siegel',
  medal: 'medaille auszeichnung',
  crown: 'krone könig premium',
  gem: 'edelstein diamant juwel',
  sparkles: 'funkeln glitzer neu magie sterne',
  sparkle: 'funkeln glitzer',
  gift: 'geschenk präsent überraschung',
  ribbon: 'schleife band geschenkband',
  'party-popper': 'party feier konfetti fest hoffest',
  balloon: 'luftballon ballon party',
  // shop and money
  'shopping-cart': 'einkaufswagen warenkorb wagen kaufen shop',
  'shopping-bag': 'einkaufstasche tüte tragetasche tasche kaufen',
  'shopping-basket': 'einkaufskorb korb',
  groceries: 'lebensmittel einkäufe einkauf einkaufstüte',
  'paper-bag': 'papiertüte tüte einkaufstüte',
  store: 'laden geschäft shop markt ladenlokal',
  tag: 'preisschild etikett label schild',
  tags: 'preisschilder etiketten labels',
  ticket: 'ticket eintrittskarte karte gutschein',
  'ticket-percent': 'gutschein rabatt coupon aktion',
  percent: 'prozent rabatt angebot sale',
  'badge-percent': 'prozent rabatt angebot sale aktion',
  'badge-euro': 'euro preis geld',
  'badge-dollar-sign': 'dollar preis geld',
  receipt: 'kassenbon quittung beleg rechnung',
  'receipt-euro': 'kassenbon quittung euro',
  euro: 'euro preis geld währung',
  'dollar-sign': 'dollar preis geld',
  banknote: 'geldschein geld bargeld',
  coins: 'münzen geld kleingeld',
  'credit-card': 'kreditkarte karte zahlung bezahlen',
  wallet: 'geldbörse portemonnaie brieftasche',
  'piggy-bank': 'sparschwein sparen geld',
  'hand-coins': 'bezahlen geld trinkgeld',
  calculator: 'taschenrechner rechnen rechner',
  scale: 'waage gewicht gerechtigkeit',
  weight: 'gewicht schwer',
  megaphone: 'megafon lautsprecher ankündigung werbung angebot',
  package: 'paket karton verpackung lieferung',
  'package-open': 'paket auspacken',
  boxes: 'kisten lager',
  box: 'kiste karton box',
  container: 'container frachtcontainer',
  forklift: 'gabelstapler lager logistik',
  truck: 'lkw lieferwagen lieferung transport lieferdienst',
  warehouse: 'lager lagerhaus halle',
  factory: 'fabrik produktion industrie',
  'concierge-bell': 'rezeption klingel hotel service',
  'hand-platter': 'servieren gastronomie tablett',
  // food and drink
  apple: 'apfel obst frucht',
  banana: 'banane obst',
  cherry: 'kirsche obst',
  grape: 'traube weintraube wein obst',
  citrus: 'zitrone zitrus orange obst',
  carrot: 'karotte möhre gemüse rübe',
  broccoli: 'brokkoli gemüse',
  salad: 'salat gemüse',
  'leafy-green': 'blattgemüse salat',
  wheat: 'weizen korn getreide brot',
  'wheat-off': 'glutenfrei weizenfrei',
  'milk-off': 'laktosefrei milchfrei',
  vegan: 'vegan pflanzlich',
  bean: 'bohne kaffeebohne',
  nut: 'nuss',
  croissant: 'croissant hörnchen gebäck bäckerei',
  cake: 'kuchen torte geburtstag gebäck',
  'cake-slice': 'kuchenstück torte tortenstück',
  cupcake: 'muffin törtchen kuchen',
  cookie: 'keks plätzchen gebäck',
  candy: 'bonbon süßigkeit süß',
  lollipop: 'lutscher süßigkeit',
  'candy-cane': 'zuckerstange weihnachten',
  dessert: 'nachtisch dessert süßspeise',
  donut: 'donut krapfen berliner',
  'ice-cream-cone': 'eis eiswaffel speiseeis',
  'ice-cream-bowl': 'eisbecher eis',
  popcorn: 'popcorn',
  pizza: 'pizza',
  sandwich: 'sandwich belegtes brot snack',
  hamburger: 'burger hamburger',
  beef: 'fleisch rind steak',
  drumstick: 'hähnchen keule fleisch hühnchen',
  ham: 'schinken wurst fleisch',
  fish: 'fisch',
  shrimp: 'garnele krabbe meeresfrüchte',
  egg: 'ei eier ostern',
  'egg-fried': 'spiegelei ei',
  milk: 'milch molkerei',
  beer: 'bier getränk krug',
  hop: 'hopfen bier',
  barrel: 'fass tonne bierfass weinfass',
  wine: 'wein glas getränk',
  'bottle-wine': 'weinflasche wein flasche',
  martini: 'cocktail getränk',
  coffee: 'kaffee tasse heißgetränk café',
  'cup-soda': 'limo getränk becher',
  'glass-water': 'wasser glas getränk',
  soup: 'suppe eintopf',
  utensils: 'besteck essen restaurant gabel messer',
  'utensils-crossed': 'besteck essen restaurant',
  'chef-hat': 'kochmütze koch küche kochen',
  'cooking-pot': 'kochtopf topf kochen küche',
  blender: 'mixer standmixer küche',
  refrigerator: 'kühlschrank kühlen frisch',
  microwave: 'mikrowelle',
  // nature, weather, seasons
  leaf: 'blatt blätter bio natur pflanze öko',
  sprout: 'spross keimling pflanze wachstum bio',
  flower: 'blume blüte frühling',
  'flower-2': 'blume blüte',
  rose: 'rose blume liebe',
  clover: 'kleeblatt glück klee',
  'tree-deciduous': 'baum laubbaum natur',
  'tree-pine': 'tanne nadelbaum weihnachtsbaum baum',
  'tree-palm': 'palme urlaub strand',
  trees: 'bäume wald',
  park: 'park bäume grünanlage',
  mountain: 'berg gebirge natur',
  'waves-horizontal': 'wellen wasser meer',
  droplet: 'tropfen wasser öl',
  droplets: 'tropfen wasser regen',
  sun: 'sonne sommer hell wetter',
  moon: 'mond nacht dunkel',
  cloud: 'wolke wetter',
  'cloud-rain': 'regen wetter',
  umbrella: 'regenschirm schirm',
  parasol: 'sonnenschirm strand sommer',
  snowflake: 'schneeflocke schnee winter kalt',
  wind: 'wind luft',
  rainbow: 'regenbogen',
  tornado: 'tornado wirbelsturm',
  sunrise: 'sonnenaufgang morgen',
  sunset: 'sonnenuntergang abend',
  thermometer: 'thermometer temperatur fieber',
  'thermometer-sun': 'heiß temperatur sommer',
  'thermometer-snowflake': 'kalt kühl temperatur',
  flame: 'flamme feuer heiß scharf angesagt',
  'flame-kindling': 'lagerfeuer feuer anzünden',
  recycle: 'recycling wiederverwertung kreislauf nachhaltig',
  'solar-panel': 'solaranlage photovoltaik energie sonnenenergie',
  shell: 'muschel strand meer',
  // animals
  bird: 'vogel',
  cat: 'katze',
  dog: 'hund',
  rabbit: 'hase kaninchen ostern',
  'paw-print': 'pfote tier haustier',
  bug: 'käfer insekt',
  'fish-symbol': 'fisch',
  bone: 'knochen hund',
  turtle: 'schildkröte',
  squirrel: 'eichhörnchen',
  // contact and communication
  mail: 'post mail brief e-mail email nachricht',
  'mail-open': 'geöffneter brief nachricht',
  mailbox: 'briefkasten post',
  phone: 'telefon anruf hörer',
  'phone-call': 'anrufen telefonieren anruf',
  smartphone: 'handy smartphone mobiltelefon',
  'map-pin': 'ort standort adresse karte markierung position',
  'map-pinned': 'markierte orte adresse',
  'map-pin-house': 'wohnort adresse zuhause',
  map: 'karte landkarte plan',
  globe: 'globus welt erde internet website',
  earth: 'erde welt planet',
  link: 'link verknüpfung kette verbinden',
  'at-sign': 'at klammeraffe e-mail ät',
  hash: 'raute hashtag nummer',
  'message-circle': 'sprechblase nachricht chat kommentar',
  'message-square': 'sprechblase nachricht chat',
  'messages-square': 'chat unterhaltung nachrichten',
  quote: 'zitat anführungszeichen',
  contact: 'kontakt adressbuch kontakte',
  'id-card': 'ausweis personalausweis ausweiskarte',
  bell: 'glocke benachrichtigung klingel',
  'bell-ring': 'klingeln glocke benachrichtigung',
  wifi: 'wlan internet funk',
  send: 'senden absenden abschicken',
  share: 'teilen weitergeben',
  'share-2': 'teilen netzwerk',
  rss: 'feed newsfeed',
  'qr-code': 'qr-code code scannen qr',
  barcode: 'strichcode barcode ean code scanner',
  'scan-barcode': 'scannen barcode strichcode',
  // time
  clock: 'uhr zeit uhrzeit öffnungszeiten',
  'alarm-clock': 'wecker alarm',
  timer: 'stoppuhr timer zeitmesser',
  hourglass: 'sanduhr warten zeit',
  watch: 'armbanduhr uhr',
  calendar: 'kalender datum termin tag',
  'calendar-days': 'kalender datum termine',
  'calendar-clock': 'termin kalender uhrzeit',
  'calendar-check': 'termin bestätigt kalender haken',
  'calendar-heart': 'hochzeit jahrestag kalender',
  // buildings, places, travel
  house: 'haus zuhause startseite heim',
  building: 'gebäude firma büro haus',
  landmark: 'bank gebäude museum denkmal',
  church: 'kirche',
  hospital: 'krankenhaus klinik',
  hotel: 'hotel übernachtung',
  castle: 'burg schloss',
  tent: 'zelt camping',
  'tent-tree': 'camping zelt wald',
  caravan: 'wohnwagen camping',
  luggage: 'koffer gepäck reise',
  backpack: 'rucksack wandern',
  signpost: 'wegweiser schild richtung',
  milestone: 'meilenstein markierung',
  car: 'auto pkw fahrzeug wagen',
  bike: 'fahrrad rad',
  bus: 'bus nahverkehr',
  'train-front': 'zug bahn zugfahrt',
  'tram-front': 'straßenbahn tram',
  motorbike: 'motorrad',
  scooter: 'roller',
  tractor: 'traktor landwirtschaft bauernhof',
  plane: 'flugzeug fliegen reise flug',
  sailboat: 'segelboot segeln boot',
  ship: 'schiff fähre',
  anchor: 'anker hafen',
  rocket: 'rakete start schnell',
  compass: 'kompass richtung entdecken',
  navigation: 'navigation pfeil richtung',
  locate: 'standort orten',
  target: 'ziel zielscheibe treffer',
  flag: 'flagge fahne markierung',
  'flag-triangle-right': 'fahne wimpel',
  'life-buoy': 'rettungsring hilfe support',
  telescope: 'teleskop fernrohr sterne',
  binoculars: 'fernglas suchen',
  construction: 'baustelle',
  'traffic-cone': 'pylone absperrung baustelle',
  'hard-hat': 'schutzhelm bauhelm baustelle',
  'brick-wall': 'mauer ziegel wand',
  // home
  bed: 'bett schlafen übernachtung',
  sofa: 'sofa couch',
  armchair: 'sessel',
  lamp: 'lampe licht',
  bath: 'badewanne bad',
  'shower-head': 'dusche',
  toilet: 'toilette wc',
  'door-open': 'tür offen geöffnet',
  'door-closed': 'tür geschlossen',
  'washing-machine': 'waschmaschine',
  // tools
  hammer: 'hammer werkzeug handwerk',
  wrench: 'schraubenschlüssel werkzeug reparatur',
  toolbox: 'werkzeugkasten werkzeug',
  'tool-case': 'werkzeugkoffer',
  shovel: 'schaufel spaten garten',
  axe: 'axt holz',
  drill: 'bohrer bohrmaschine',
  'paint-roller': 'farbroller streichen renovieren',
  'spray-can': 'spraydose sprühen',
  scissors: 'schere schneiden ausschneiden',
  'scissors-line-dashed': 'schnittlinie ausschneiden gutschein',
  ruler: 'lineal maß messen länge',
  'pocket-knife': 'taschenmesser',
  settings: 'einstellungen zahnrad optionen',
  cog: 'zahnrad einstellungen',
  // media and design
  image: 'bild foto grafik bilder',
  images: 'bilder fotos galerie',
  camera: 'kamera foto fotografie fotoapparat',
  video: 'video film kamera',
  film: 'film kino streifen',
  clapperboard: 'filmklappe film kino',
  music: 'musik note noten lied',
  headphones: 'kopfhörer musik hören',
  mic: 'mikrofon aufnahme sprechen',
  'mic-vocal': 'gesang mikrofon karaoke',
  speaker: 'lautsprecher box ton',
  'volume-2': 'lautstärke ton laut',
  guitar: 'gitarre musik instrument',
  piano: 'klavier musik',
  drum: 'trommel musik',
  radio: 'radio',
  tv: 'fernseher tv fernsehen',
  theater: 'theater bühne kultur veranstaltung',
  drama: 'theater masken bühne',
  'venetian-mask': 'maske karneval fasching',
  palette: 'farbpalette farben malen farbe',
  brush: 'pinsel malen',
  paintbrush: 'pinsel malen farbe',
  'paint-bucket': 'farbeimer füllen farbe',
  'pen-tool': 'zeichenstift vektor feder',
  pencil: 'stift bleistift bearbeiten schreiben',
  pen: 'stift füller schreiben',
  stamp: 'stempel siegel',
  signature: 'unterschrift signatur',
  sticker: 'aufkleber sticker',
  'sticky-note': 'haftnotiz notiz zettel',
  scroll: 'schriftrolle urkunde',
  'file-badge': 'zertifikat urkunde',
  badge: 'abzeichen siegel plakette',
  'badge-check': 'geprüft verifiziert qualität bestätigt siegel',
  'shield-check': 'schutz geprüft sicher garantie',
  shield: 'schild schutz sicherheit',
  lightbulb: 'glühbirne idee lampe licht',
  zap: 'blitz strom energie schnell',
  'battery-full': 'batterie akku',
  plug: 'stecker strom',
  power: 'ein aus strom einschalten',
  // devices, data, code
  monitor: 'bildschirm monitor computer',
  laptop: 'laptop notebook computer',
  tablet: 'tablet',
  computer: 'computer rechner',
  keyboard: 'tastatur',
  mouse: 'maus computer',
  cpu: 'prozessor chip',
  database: 'datenbank daten speicher',
  server: 'server rechenzentrum',
  code: 'code programmieren quelltext',
  terminal: 'terminal konsole kommandozeile',
  printer: 'drucker drucken',
  // files and office
  file: 'datei dokument',
  'file-text': 'dokument text datei seite',
  folder: 'ordner mappe',
  'folder-open': 'offener ordner',
  archive: 'archiv kiste',
  inbox: 'posteingang eingang',
  paperclip: 'büroklammer anhang anlage',
  book: 'buch lesen',
  'book-open': 'offenes buch lesen buch',
  newspaper: 'zeitung nachrichten presse',
  notebook: 'notizbuch heft notizen',
  'clipboard-list': 'liste checkliste zwischenablage',
  list: 'liste aufzählung',
  'list-checks': 'checkliste aufgaben erledigt',
  briefcase: 'aktentasche koffer business arbeit beruf',
  'graduation-cap': 'doktorhut abschluss ausbildung bildung schule',
  school: 'schule bildung',
  save: 'speichern diskette',
  download: 'herunterladen download speichern',
  upload: 'hochladen upload',
  trash: 'papierkorb löschen mülleimer abfall',
  eye: 'auge sichtbar ansehen vorschau',
  'eye-off': 'unsichtbar verborgen ausblenden',
  search: 'suche suchen lupe finden',
  'zoom-in': 'vergrößern lupe zoom',
  'zoom-out': 'verkleinern',
  funnel: 'trichter filter sortieren',
  // symbols and arrows
  check: 'haken häkchen ok erledigt bestätigt',
  'check-check': 'doppelter haken',
  'circle-check': 'haken ok bestätigt erledigt',
  'circle-x': 'kreuz abbrechen fehler',
  x: 'schließen kreuz löschen abbrechen',
  plus: 'plus hinzufügen neu addieren',
  minus: 'minus entfernen subtrahieren',
  'circle-plus': 'plus hinzufügen',
  equal: 'gleich gleichheitszeichen',
  info: 'info information hinweis',
  'badge-info': 'info hinweis',
  'circle-question-mark': 'frage fragezeichen hilfe',
  'circle-alert': 'achtung warnung hinweis ausrufezeichen',
  'triangle-alert': 'warnung achtung gefahr',
  'octagon-alert': 'stopp warnung',
  ban: 'verbot verboten',
  siren: 'sirene alarm warnung notfall',
  biohazard: 'biogefahr gefahr',
  radiation: 'strahlung radioaktiv',
  skull: 'totenkopf gefahr gift',
  ghost: 'geist halloween',
  'arrow-right': 'pfeil rechts weiter nächste',
  'arrow-left': 'pfeil links zurück',
  'arrow-up': 'pfeil hoch nach oben',
  'arrow-down': 'pfeil runter nach unten',
  'arrow-up-right': 'pfeil schräg extern',
  'chevron-right': 'weiter rechts',
  'chevron-left': 'zurück links',
  'chevron-down': 'aufklappen unten',
  'chevron-up': 'zuklappen oben',
  'refresh-cw': 'aktualisieren neu laden wiederholen',
  'rotate-cw': 'drehen rotieren',
  undo: 'rückgängig zurück',
  redo: 'wiederholen vorwärts',
  move: 'verschieben bewegen',
  maximize: 'maximieren vollbild vergrößern',
  minimize: 'minimieren',
  expand: 'ausdehnen vergrößern',
  shrink: 'schrumpfen verkleinern',
  menu: 'menü hamburger navigation',
  ellipsis: 'mehr punkte drei punkte',
  'thumbs-up': 'daumen hoch gefällt mir gut like top',
  'thumbs-down': 'daumen runter schlecht',
  'face-slightly-smiling': 'smiley lächeln gesicht glücklich',
  'face-grinning': 'grinsen smiley',
  'face-neutral': 'neutral smiley',
  'face-angry': 'wütend ärgerlich',
  lock: 'schloss sicher gesperrt abschließen',
  'lock-open': 'offen entsperrt schloss',
  key: 'schlüssel zugang',
  'fingerprint-pattern': 'fingerabdruck identität',
  // people and health
  user: 'person benutzer mensch profil nutzer',
  users: 'personen team gruppe menschen benutzer',
  'user-round': 'person benutzer',
  baby: 'baby kind säugling',
  'person-standing': 'person mensch stehen',
  accessibility: 'barrierefrei rollstuhl zugänglich',
  handshake: 'handschlag partnerschaft vereinbarung einigung vertrag',
  hand: 'hand stopp greifen',
  footprints: 'fußabdrücke schritte spuren',
  glasses: 'brille sehen lesen',
  ear: 'ohr hören',
  brain: 'gehirn denken intelligenz',
  stethoscope: 'stethoskop arzt medizin',
  pill: 'tablette pille medizin medikament',
  syringe: 'spritze impfung impfen',
  ambulance: 'krankenwagen rettung notfall',
  bandage: 'pflaster verband',
  microscope: 'mikroskop forschung labor',
  'flask-conical': 'kolben labor chemie',
  atom: 'atom physik',
  dna: 'dna genetik erbgut',
  toothbrush: 'zahnbürste zähne',
  'soap-dispenser-droplet': 'seifenspender hygiene seife',
  // sport and games
  dumbbell: 'hantel fitness sport training',
  volleyball: 'volleyball ball sport',
  'rugby-ball': 'rugby ball',
  'gamepad-2': 'spielen spiel controller',
  dices: 'würfel spiel',
  puzzle: 'puzzle teil erweiterung',
  swords: 'schwerter',
  sword: 'schwert',
  // text and shapes
  type: 'schrift text buchstabe schriftart',
  bold: 'fett',
  italic: 'kursiv',
  underline: 'unterstrichen',
  strikethrough: 'durchgestrichen',
  'heading-1': 'überschrift titel',
  'heading-2': 'zwischenüberschrift untertitel',
  'text-align-center': 'zentriert mittig textausrichtung',
  'text-align-start': 'linksbündig',
  'text-align-end': 'rechtsbündig',
  'text-align-justify': 'blocksatz',
  'case-upper': 'großbuchstaben versalien',
  'case-lower': 'kleinbuchstaben',
  languages: 'sprachen übersetzen sprache',
  pilcrow: 'absatz',
  asterisk: 'sternchen',
  ampersand: 'und-zeichen kaufmännisches und',
  square: 'quadrat viereck',
  circle: 'kreis rund',
  triangle: 'dreieck',
  hexagon: 'sechseck wabe',
  pentagon: 'fünfeck',
  octagon: 'achteck stoppschild',
  diamond: 'raute karo diamant',
  'rectangle-horizontal': 'rechteck querformat',
  'rectangle-vertical': 'rechteck hochformat',
  squircle: 'abgerundetes quadrat',
  shapes: 'formen figuren',
  // layout and charts
  'layout-grid': 'raster kacheln galerie',
  'layout-dashboard': 'dashboard übersicht kacheln',
  'layout-list': 'liste layout',
  'columns-2': 'spalten layout',
  table: 'tabelle',
  'sliders-horizontal': 'regler einstellungen',
  kanban: 'kanban tafel aufgaben',
  'chart-bar': 'balkendiagramm statistik',
  'chart-line': 'liniendiagramm kurve',
  'chart-pie': 'kreisdiagramm torte statistik',
  'trending-up': 'aufwärtstrend wachstum anstieg',
  'trending-down': 'abwärtstrend rückgang',
  activity: 'aktivität puls kurve',
  presentation: 'präsentation vortrag folien',
  projector: 'beamer projektor präsentation',
  cross: 'kreuz plus medizin apotheke',
  amphora: 'amphore vase krug antik',
  pyramid: 'pyramide',
  orbit: 'umlaufbahn',
  satellite: 'satellit',
  'waves-ladder': 'schwimmbad pool schwimmen',
};

// ---------------------------------------------------------------------------------------------------- validation of an icon body

const ALLOWED = {
  path: ['d'],
  circle: ['cx', 'cy', 'r'],
  rect: ['x', 'y', 'width', 'height', 'rx', 'ry'],
  line: ['x1', 'y1', 'x2', 'y2'],
  polyline: ['points'],
  polygon: ['points'],
  ellipse: ['cx', 'cy', 'rx', 'ry'],
};
const TAG = /<([A-Za-z][A-Za-z0-9]*)((?:\s+[A-Za-z][A-Za-z0-9:-]*\s*=\s*(?:'[^']*'|"[^"]*"))*)\s*\/?>/g;
const ATTR = /([A-Za-z][A-Za-z0-9:-]*)\s*=\s*(?:'([^']*)'|"([^"]*)")/g;
const NUMBER = /^-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?$/i;
const PATH_DATA = /^[0-9eE+\-., \tMmLlHhVvCcSsQqTtAaZz]*$/;
const POINTS = /^[0-9eE+\-., \t]*$/;

/** The reason a body is refused, or null when it only uses the allowed elements and attributes with plain values. */
function problem(body) {
  if (typeof body !== 'string' || body.trim() === '') { return 'empty body'; }
  const rest = body.replace(TAG, '').replace(/\s+/g, '');
  if (rest !== '') { return 'text or unknown markup outside of tags: ' + rest.slice(0, 40); }
  let seen = 0;
  TAG.lastIndex = 0;
  for (const m of body.matchAll(TAG)) {
    seen++;
    const name = m[1];
    if (!Object.prototype.hasOwnProperty.call(ALLOWED, name)) { return 'element ' + name; }
    const attrs = m[2];
    for (const a of attrs.matchAll(ATTR)) {
      const attr = a[1];
      const value = a[2] !== undefined ? a[2] : a[3];
      if (!ALLOWED[name].includes(attr)) { return 'attribute ' + name + '.' + attr; }
      if (attr === 'd') { if (!PATH_DATA.test(value)) { return 'path data'; } }
      else if (attr === 'points') { if (!POINTS.test(value)) { return 'points'; } }
      else if (!NUMBER.test(value)) { return 'value of ' + attr + ': ' + value.slice(0, 20); }
    }
  }
  return seen === 0 ? 'no element' : null;
}

// ---------------------------------------------------------------------------------------------------- build

function asciiVariant(word) {
  return word.replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
}

function germanTerms(text) {
  const terms = [];
  // "daumen hoch" and "kleeblatt" are words; a pair of words in one phrase is kept as words (every word is searchable)
  for (const word of text.split(/\s+/).filter(Boolean)) {
    terms.push(word);
    const plain = asciiVariant(word);
    if (plain !== word) { terms.push(plain); }
  }
  return terms;
}

const lucide = JSON.parse(fs.readFileSync(source, 'utf8'));
const categoryIds = Object.keys(lucide.categories);
const missingTitles = categoryIds.filter((id) => !CATEGORY_TITLES[id]);
const extraTitles = Object.keys(CATEGORY_TITLES).filter((id) => !lucide.categories[id]);
if (missingTitles.length || extraTitles.length) {
  console.error('German titles do not match the categories. Missing: ' + missingTitles.join(', ') + '. Not in the library: ' + extraTitles.join(', '));
  process.exit(1);
}

const categories = {};
for (const id of categoryIds) { categories[id] = { title: CATEGORY_TITLES[id] }; }

/* Lucide marks its dots (tag, palette, images ...) as <circle r='.5' fill='currentColor'/>. The stroke of 2 units already covers a circle of radius 1 or less, so the
   fill is taken away (the allowlist has no fill) instead of dropping those icons. Any other fill stays and makes the icon fail the check. */
let dotsNormalised = 0;
function withoutDotFill(body) {
  return body.replace(/<circle\b([^>]*?)\s+fill=(['"])currentColor\2([^>]*?)>/g, (all, before, quote, after) => {
    const r = /\br=(?:'([^']*)'|"([^"]*)")/.exec(before + after);
    const radius = r ? Number(r[1] !== undefined ? r[1] : r[2]) : NaN;
    if (!(radius <= 1)) { return all; }
    dotsNormalised++;
    return '<circle' + before + after + '>';
  });
}

const icons = {};
const dropped = [];
const changedBy = new Set();
for (const name of Object.keys(lucide.icons)) {
  const icon = lucide.icons[name];
  const before = dotsNormalised;
  const body = withoutDotFill(icon.body);
  if (dotsNormalised > before) { changedBy.add(name); }
  const why = problem(body);
  if (why) { dropped.push(name + ' (' + why + ')'); continue; }
  const tags = [];
  const add = (t) => { const v = String(t).trim().toLowerCase(); if (v && !tags.includes(v)) { tags.push(v); } };
  (icon.tags || []).forEach(add);
  (icon.aliases || []).forEach(add);
  if (SYNONYMS[name]) { germanTerms(SYNONYMS[name]).forEach(add); }
  icons[name] = { b: body.trim(), t: tags, c: (icon.categories || []).filter((c) => categories[c]) };
}

const missingSynonyms = Object.keys(SYNONYMS).filter((n) => !icons[n]);
if (missingSynonyms.length) {
  console.error('German synonyms for icons that are not in the library (or were dropped): ' + missingSynonyms.join(', '));
  process.exit(1);
}

const result = { source: lucide.source, categories, icons };
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'icons.json'), JSON.stringify(result) + '\n', 'utf8');
if (fs.existsSync(licenceSource)) { fs.copyFileSync(licenceSource, path.join(outDir, 'LICENSE-lucide.txt')); }
else { console.error('Licence file not found: ' + licenceSource); process.exitCode = 1; }

const size = fs.statSync(path.join(outDir, 'icons.json')).size;
console.log('icons: ' + Object.keys(icons).length + ' of ' + Object.keys(lucide.icons).length + ', categories: ' + categoryIds.length + ', German synonyms for ' + Object.keys(SYNONYMS).length + ' icons, ' + Math.round(size / 1024) + ' KB');
if (changedBy.size) { console.log('fill of dots removed in ' + changedBy.size + ' icons'); }
if (dropped.length) { console.log('dropped ' + dropped.length + ': ' + dropped.join('; ')); }
