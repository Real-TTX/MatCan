/* MatCan editor, part 10e: German search words for the icon library. lib/icons.json carries English tags and a few German synonyms; Lucide has no cheese, cow or goat, so a person who
   types "käse" or "kuh" would find nothing. This list maps about 250 common German words to the icons that come closest (names of lib/icons.json; a check in the browser tests
   keeps every name valid). D.iconSearch folds umlauts (ä = a, ae = a) so "kaese", "käse" and "kase" are the same word; a word matches when it starts with the typed text.
   D.iconWordsDe is also what the picker offers as example searches. */
(function () {
  'use strict';

  var D = window.DtDesigner;

  D.iconWordsDe = {
    // food and drink
    'käse': ['pizza', 'cookie', 'sandwich', 'triangle'], 'milch': ['milk', 'carton', 'cup-soda'], 'kuh': ['beef', 'milk', 'tractor'], 'rind': ['beef', 'milk'], 'ziege': ['milk', 'mountain', 'paw-print'],
    'schaf': ['paw-print', 'cloud', 'wheat'], 'wolle': ['cloud', 'spool'], 'schwein': ['ham', 'piggy-bank', 'paw-print'], 'huhn': ['egg', 'drumstick', 'bird'], 'hahn': ['bird', 'egg'], 'henne': ['egg', 'bird'],
    'ei': ['egg', 'egg-fried'], 'eier': ['egg', 'egg-fried'], 'brot': ['wheat', 'sandwich', 'croissant'], 'brötchen': ['croissant', 'wheat', 'sandwich'], 'semmel': ['croissant', 'wheat'], 'getreide': ['wheat'],
    'mehl': ['wheat'], 'kuchen': ['cake', 'cake-slice', 'cupcake'], 'torte': ['cake', 'cake-slice'], 'gebäck': ['cookie', 'croissant', 'donut'], 'keks': ['cookie'], 'plätzchen': ['cookie'], 'süß': ['candy', 'lollipop', 'cookie'],
    'süßigkeit': ['candy', 'lollipop', 'candy-cane'], 'bonbon': ['candy', 'lollipop'], 'schokolade': ['candy', 'cookie'], 'honig': ['droplet', 'hexagon', 'flower'], 'marmelade': ['cherry', 'grape', 'citrus'],
    'konfitüre': ['cherry', 'grape'], 'apfel': ['apple'], 'birne': ['apple'], 'banane': ['banana'], 'kirsche': ['cherry'], 'traube': ['grape'], 'trauben': ['grape'], 'zitrone': ['citrus'], 'orange': ['citrus'],
    'obst': ['apple', 'banana', 'cherry', 'grape', 'citrus'], 'gemüse': ['carrot', 'broccoli', 'leafy-green', 'salad'], 'karotte': ['carrot'], 'möhre': ['carrot'], 'brokkoli': ['broccoli'], 'salat': ['salad', 'leafy-green'],
    'tomate': ['cherry', 'apple'], 'kartoffel': ['circle-dot-dashed', 'nut'], 'pilz': ['trees', 'umbrella'], 'nuss': ['nut'], 'nüsse': ['nut'], 'bohne': ['bean'], 'bohnen': ['bean'], 'kaffee': ['coffee', 'bean'],
    'tee': ['coffee', 'cup-soda'], 'wein': ['wine', 'grape', 'bottle-wine'], 'bier': ['beer', 'hop', 'barrel'], 'sekt': ['wine', 'martini'], 'cocktail': ['martini'], 'getränk': ['cup-soda', 'wine', 'beer', 'milk'],
    'getränke': ['cup-soda', 'wine', 'beer', 'milk'], 'saft': ['cup-soda', 'citrus'], 'wasser': ['droplet', 'droplets', 'waves-horizontal'], 'fisch': ['fish', 'fish-symbol'], 'fleisch': ['beef', 'ham', 'drumstick'],
    'wurst': ['ham', 'beef'], 'schinken': ['ham'], 'grillen': ['flame', 'drumstick'], 'backen': ['cake', 'croissant', 'chef-hat'], 'koch': ['chef-hat'], 'küche': ['chef-hat', 'utensils', 'cooking-pot'],
    'kochen': ['cooking-pot', 'chef-hat'], 'restaurant': ['utensils', 'chef-hat'], 'essen': ['utensils', 'sandwich'], 'mittagessen': ['utensils', 'soup'], 'suppe': ['soup'], 'burger': ['hamburger'],
    'imbiss': ['hamburger', 'sandwich'], 'eis': ['ice-cream-cone', 'popsicle', 'ice-cream-bowl'], 'glutenfrei': ['wheat-off'], 'laktosefrei': ['milk-off'], 'vegan': ['vegan', 'leaf'], 'vegetarisch': ['leaf', 'carrot', 'vegan'],
    'bio': ['leaf', 'sprout', 'vegan'], 'öko': ['leaf', 'recycle', 'sprout'], 'regional': ['map-pin', 'house', 'tractor'], 'hofladen': ['store', 'tractor'], 'bauernhof': ['tractor', 'wheat', 'house'],
    'landwirtschaft': ['tractor', 'wheat', 'sprout'], 'markt': ['store', 'shopping-basket'], 'frisch': ['sparkles', 'leaf', 'droplet'], 'hausgemacht': ['house', 'chef-hat', 'heart'], 'handgemacht': ['hand', 'heart'],
    'gewürz': ['leaf', 'flame'], 'kräuter': ['leaf', 'sprout', 'shrub'], 'pizza': ['pizza'], 'pasta': ['utensils', 'wheat'], 'nudeln': ['utensils', 'wheat'], 'popcorn': ['popcorn'], 'lutscher': ['lollipop'],
    // shopping and prices
    'einkaufswagen': ['shopping-cart'], 'einkaufskorb': ['shopping-basket'], 'einkaufstasche': ['shopping-bag', 'handbag'], 'tasche': ['shopping-bag', 'handbag', 'backpack'], 'warenkorb': ['shopping-cart', 'shopping-basket'],
    'laden': ['store'], 'geschäft': ['store'], 'preis': ['tag', 'euro', 'badge-euro'], 'preisschild': ['tag', 'tags'], 'euro': ['euro', 'badge-euro', 'circle-euro'], 'geld': ['banknote', 'coins', 'euro'],
    'münze': ['coins'], 'kasse': ['receipt', 'credit-card', 'calculator'], 'rechnung': ['receipt', 'receipt-euro'], 'bezahlen': ['credit-card', 'wallet'], 'rabatt': ['badge-percent', 'percent', 'ticket-percent'],
    'prozent': ['percent', 'badge-percent', 'circle-percent'], 'angebot': ['tag', 'badge-percent', 'gift'], 'aktion': ['megaphone', 'tag'], 'sale': ['tag', 'badge-percent'], 'neu': ['sparkles', 'party-popper', 'badge'],
    'gutschein': ['ticket', 'ticket-percent', 'gift'], 'geschenk': ['gift'], 'geschenke': ['gift'], 'sparen': ['piggy-bank', 'coins'], 'lieferung': ['truck', 'package'], 'liefern': ['truck', 'package'],
    'versand': ['package', 'truck'], 'paket': ['package', 'package-open'], 'lieferwagen': ['van', 'truck'],
    // signs and symbols
    'herz': ['heart', 'heart-handshake'], 'stern': ['star', 'sparkles'], 'sterne': ['star', 'sparkles'], 'pfeil': ['arrow-right', 'arrow-up', 'arrow-left', 'arrow-down'], 'haken': ['check', 'circle-check'],
    'häkchen': ['check', 'circle-check'], 'kreuz': ['x', 'cross', 'circle-x'], 'plus': ['plus'], 'minus': ['minus'], 'info': ['info', 'badge-info'], 'information': ['info', 'badge-info'],
    'warnung': ['triangle-alert', 'circle-alert'], 'achtung': ['triangle-alert', 'octagon-alert'], 'gefahr': ['triangle-alert', 'skull', 'biohazard'], 'verbot': ['ban'], 'stopp': ['octagon', 'hand'],
    'frage': ['circle-question-mark', 'badge-question-mark'], 'ausrufezeichen': ['circle-alert', 'square-exclamation-point'], 'qualität': ['award', 'medal', 'badge'], 'auszeichnung': ['award', 'medal', 'trophy'],
    'pokal': ['trophy'], 'sieger': ['trophy', 'medal'], 'krone': ['crown'], 'siegel': ['stamp', 'award', 'badge'], 'stempel': ['stamp'], 'garantie': ['shield', 'award'], 'sicher': ['shield', 'lock'],
    'sicherheit': ['shield', 'lock'], 'schloss': ['lock'], 'schlüssel': ['key'], 'daumen': ['hand'], 'hand': ['hand'], 'applaus': ['hand', 'party-popper'], 'blitz': ['zap'], 'energie': ['zap', 'battery-charging'],
    'strom': ['zap', 'plug'], 'feuer': ['flame'], 'flamme': ['flame'], 'scharf': ['flame'], 'heiß': ['flame', 'thermometer-sun'], 'kalt': ['snowflake', 'thermometer-snowflake'], 'lupe': ['search', 'zoom-in'],
    'suchen': ['search'], 'einstellungen': ['settings', 'sliders-horizontal'], 'teilen': ['share'], 'link': ['link'], 'qr': ['qr-code', 'scan-qr-code'], 'barcode': ['barcode', 'scan-barcode'], 'drucker': ['printer'],
    'öffnungszeiten': ['clock', 'calendar-days', 'door-open'], 'offen': ['door-open'], 'geöffnet': ['door-open'], 'geschlossen': ['door-closed'], 'eingang': ['log-in'], 'ausgang': ['log-out'],
    // nature, weather, places
    'sonne': ['sun', 'sunrise', 'sunset'], 'mond': ['moon'], 'wolke': ['cloud', 'cloud-sun'], 'regen': ['cloud-rain', 'umbrella', 'droplets'], 'schnee': ['snowflake', 'cloud-snow'], 'wind': ['wind'],
    'regenschirm': ['umbrella'], 'regenbogen': ['rainbow'], 'blume': ['flower', 'rose'], 'rose': ['rose'], 'baum': ['tree-deciduous', 'tree-pine'], 'bäume': ['trees', 'tree-pine'], 'blatt': ['leaf', 'leafy-green'],
    'laub': ['leaf'], 'pflanze': ['sprout', 'plant-pot', 'shrub'], 'wald': ['trees', 'tree-pine'], 'berg': ['mountain', 'mountain-snow'], 'berge': ['mountain', 'mountain-snow'], 'welle': ['waves-horizontal'],
    'meer': ['waves-horizontal', 'sailboat'], 'see': ['waves-horizontal', 'sailboat'], 'erde': ['earth', 'globe'], 'welt': ['earth', 'globe'], 'haus': ['house', 'building'], 'zuhause': ['house'],
    'gebäude': ['building', 'building-complex'], 'firma': ['building', 'factory'], 'fabrik': ['factory'], 'kirche': ['church'], 'schloss burg': ['castle'], 'burg': ['castle'], 'brücke': ['bridge'],
    'ort': ['map-pin', 'map'], 'standort': ['map-pin', 'locate'], 'adresse': ['map-pin', 'house', 'mail'], 'karte': ['map', 'credit-card'], 'navigation': ['navigation', 'compass'], 'kompass': ['compass'],
    'weg': ['route', 'signpost'], 'wegweiser': ['signpost', 'signpost-big'], 'telefon': ['phone', 'phone-call'], 'handy': ['smartphone'], 'anrufen': ['phone-call'], 'mail': ['mail', 'mails'],
    'brief': ['mail', 'mail-open'], 'post': ['mailbox', 'mail'], 'nachricht': ['message-circle', 'message-square-text', 'mail'], 'chat': ['message-circle', 'message-square-text'], 'uhr': ['clock', 'watch'],
    'zeit': ['clock', 'timer', 'hourglass'], 'stunde': ['clock', 'hourglass'], 'kalender': ['calendar', 'calendar-days'], 'datum': ['calendar', 'calendar-days'], 'termin': ['calendar', 'calendar-clock'],
    'auto': ['car', 'car-front'], 'lkw': ['truck'], 'transporter': ['van'], 'traktor': ['tractor'], 'fahrrad': ['bike'], 'roller': ['scooter'], 'motorrad': ['motorbike'], 'bus': ['bus', 'bus-front'],
    'zug': ['train-front', 'tram-front'], 'bahn': ['train-front', 'tram-front'], 'flugzeug': ['plane'], 'flug': ['plane', 'plane-takeoff'], 'schiff': ['ship', 'sailboat'], 'boot': ['sailboat', 'kayak'],
    'parken': ['circle-parking', 'square-parking'], 'parkplatz': ['circle-parking', 'square-parking'], 'tanken': ['fuel'], 'ladestation': ['ev-charger'], 'toilette': ['toilet'], 'barrierefrei': ['accessibility'],
    'rollstuhl': ['accessibility'], 'nichtraucher': ['cigarette'], 'rauchen': ['cigarette'],
    // people, animals, events
    'person': ['user', 'user-round'], 'mensch': ['user', 'person-standing'], 'kunde': ['user', 'users'], 'kunden': ['users', 'users-round'], 'team': ['users', 'users-round'], 'familie': ['users', 'baby'],
    'gruppe': ['users', 'user-group'], 'kind': ['baby'], 'baby': ['baby'], 'hund': ['dog'], 'katze': ['cat'], 'vogel': ['bird', 'bird'], 'hase': ['rabbit'], 'kaninchen': ['rabbit'], 'maus': ['rat', 'mouse'],
    'eichhörnchen': ['squirrel'], 'schildkröte': ['turtle'], 'schnecke': ['snail'], 'wurm': ['worm'], 'garnele': ['shrimp'], 'tier': ['paw-print', 'dog', 'cat'], 'tiere': ['paw-print', 'dog', 'cat'],
    'pfote': ['paw-print'], 'sport': ['dumbbell', 'trophy'], 'fußball': ['goal'], 'training': ['dumbbell'], 'laufen': ['footprints'], 'wandern': ['hiking-stick', 'mountain', 'footprints'], 'camping': ['tent', 'tent-tree'],
    'zelt': ['tent'], 'urlaub': ['parasol', 'plane'], 'reise': ['luggage', 'plane'], 'koffer': ['luggage'], 'strand': ['parasol', 'waves-horizontal'], 'sommer': ['sun', 'parasol'], 'winter': ['snowflake'],
    'herbst': ['leaf'], 'frühling': ['flower', 'sprout'], 'weihnachten': ['gift', 'tree-pine', 'snowflake'], 'ostern': ['egg', 'rabbit'], 'geburtstag': ['cake', 'party-popper', 'balloon'], 'party': ['party-popper', 'balloon'],
    'feier': ['party-popper', 'balloon'], 'fest': ['party-popper', 'ferris-wheel'], 'hoffest': ['party-popper', 'tractor', 'ferris-wheel'], 'hochzeit': ['heart', 'gem'], 'ring': ['gem'], 'diamant': ['gem', 'diamond'],
    'ballon': ['balloon'], 'konfetti': ['party-popper'], 'einladung': ['mail-open', 'party-popper', 'calendar'], 'musik': ['music', 'guitar', 'piano'], 'gitarre': ['guitar'], 'klavier': ['piano'],
    'kino': ['clapperboard', 'film', 'popcorn'], 'film': ['film', 'clapperboard'], 'theater': ['drama'], 'spiel': ['gamepad', 'dices'], 'würfel': ['dices'], 'schach': ['chess-knight', 'chess-king'],
    'kamera': ['camera'], 'foto': ['camera', 'image'], 'bild': ['image', 'images'], 'video': ['video'], 'mikrofon': ['mic'], 'lautsprecher': ['speaker', 'volume'], 'megafon': ['megaphone'], 'glocke': ['bell'],
    'buch': ['book', 'book-open'], 'lesen': ['book-open'], 'schule': ['school', 'graduation-cap'], 'lernen': ['graduation-cap', 'book-open'], 'stift': ['pencil', 'pen'], 'schere': ['scissors'],
    'werkzeug': ['wrench', 'hammer', 'toolbox'], 'hammer': ['hammer'], 'schraube': ['screw', 'wrench'], 'handwerk': ['hammer', 'wrench', 'hard-hat'], 'baustelle': ['construction', 'hard-hat', 'traffic-cone'],
    'gesundheit': ['heart-pulse', 'stethoscope'], 'arzt': ['stethoscope'], 'apotheke': ['pill', 'pill-bottle'], 'medizin': ['pill', 'syringe'], 'computer': ['laptop', 'monitor'], 'internet': ['globe', 'wifi'],
    'wlan': ['wifi'], 'cloud': ['cloud'], 'idee': ['lightbulb'], 'glühbirne': ['lightbulb'], 'licht': ['lightbulb', 'sun'], 'ziel': ['target', 'goal'], 'rakete': ['rocket'], 'magie': ['wand-sparkles', 'sparkles'],
    'glanz': ['sparkles', 'sparkle'], 'funkeln': ['sparkles', 'sparkle'], 'tipp': ['lightbulb', 'sparkles'], 'wichtig': ['circle-alert', 'star'], 'favorit': ['heart', 'star'], 'beliebt': ['heart', 'star', 'flame'],
  };

  /** Lower case, no diacritics, ß = ss: "Käse" and "kase" are the same word. */
  D.fold = function (text) {
    return String(text === null || text === undefined ? '' : text).toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/ß/g, 'ss');
  };

  /** The ways to write a typed word: folded, and with ae/oe/ue read as umlauts ("kaese" = "kase"). */
  function variants(term) {
    var t = D.fold(term);
    var u = t.replace(/ae/g, 'a').replace(/oe/g, 'o').replace(/ue/g, 'u');
    return u === t ? [t] : [t, u];
  }

  var foldedWords = null;

  function words() {
    if (!foldedWords) { foldedWords = Object.keys(D.iconWordsDe).map(function (w) { return { key: D.fold(w), icons: D.iconWordsDe[w] }; }); }
    return foldedWords;
  }

  /**
   * Searches the icon library. query: what the person typed (several words must all match: name, English tag or German synonym, or a word of the list above that starts with it).
   * Returns the icon names, best matches first (an icon that the German list names for the word, then names that start with the word, then the rest in the order of the library).
   */
  D.iconSearch = function (lib, query) {
    var names = Object.keys(lib.icons);
    var terms = D.fold(query).split(/[ \t]+/).filter(Boolean).map(variants);
    if (!terms.length) { return names; }
    var scored = [];
    names.forEach(function (name, index) {
      var icon = lib.icons[name];
      if (!icon._f) { icon._f = D.fold(name.replace(/-/g, ' ') + ' ' + icon.t.join(' ')); }
      var score = 0;
      for (var i = 0; i < terms.length; i++) {
        var s = 0;
        terms[i].forEach(function (t) {
          var at = icon._f.indexOf(t);
          if (at >= 0) { s = Math.max(s, name.indexOf(t) === 0 ? 3 : (icon._f.indexOf(' ' + t) >= 0 ? 2 : 1)); }
          if (words().some(function (w) { return w.key.indexOf(t) === 0 && w.icons.indexOf(name) >= 0; })) { s = Math.max(s, 2.5); }
        });
        if (!s) { score = 0; break; }
        score += s;
      }
      if (score) { scored.push({ name: name, score: score, index: index }); }
    });
    scored.sort(function (a, b) { return b.score - a.score || a.index - b.index; });
    return scored.map(function (x) { return x.name; });
  };
})();
