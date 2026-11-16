<div align="center">

<img src="src/DesignThix/wwwroot/logo.svg" width="96" alt="DesignThix" />

# DesignThix

**Der Offline-Canva für Etiketten, Karten, Flyer, Poster und Beiträge für soziale Medien.**

Du wählst ein Format oder eine fertige Vorlage, gestaltest im Designer wie in Canva und lädst das Ergebnis als PNG, JPG, SVG oder PDF herunter oder druckst es.
Und wenn du viele ähnliche Etiketten brauchst, füllt DesignThix ein Design aus einer Datenliste: ein Design, viele Etiketten (Zusatz *Serien*).

</div>

![Der Designer: die Vorlage Instagram-Beitrag mit dem Reiter Elemente und der Werkzeugleiste für den ausgewählten Text](docs/images/editor.png)

DesignThix ist ein Docker-Container mit einer PostgreSQL-Datenbank. Es läuft auf deinem eigenen Server oder Rechner, lädt nichts aus dem Internet nach
(Schriften, Bilder und Symbole liegen in der App) und lässt sich auf Handy und Desktop als App installieren.

## Was DesignThix kann

- **Start mit einem Klick:** Die Startseite fragt „Was möchtest du heute gestalten?“. Ein Klick auf ein Format (Preisschild, Etikett, Regaletikett, Visitenkarte, Flyer A5, Poster A3, Karte A6, Instagram-Beitrag
  und -Story, Präsentation oder eine eigene Größe in mm oder px; unter **„Mehr Formate“** weitere wie Klappkarten mit Falzlinie, Postkarte, DIN lang, Tischkarte, Urkunde, Gutschein, Lesezeichen) legt das leere Design an und öffnet den Designer. Darunter stehen die Vorlagen und die zuletzt bearbeiteten Designs; die Suche findet Designs und Vorlagen.
- **Vorlagen:** **333 fertige Entwürfe in 110 Familien**, jede in mindestens drei Varianten: Grußkarten, Hochzeit, Kindergeburtstag, Feste, Flyer und Plakate, Visitenkarten, Etiketten, Instagram, Formulare und Planer.
  Sortiert nach Anlass, mit Suche über Namen und Stichwörter, Vorschau aller Seiten und Wechsel zwischen den Varianten. „Vorlage verwenden“ macht eine Kopie; die Vorlage bleibt, wie sie ist. Siehe *Vorlagen* unten.
- **Designer:** Eine Leiste mit Reitern (Vorlagen, KI, Elemente, Text, Uploads, Fotos, Marke, Ebenen, Kommentare, Daten; KI und Fotos nur, wenn eingeschaltet) und eine Werkzeugleiste, die zur Auswahl passt. Mehrere Seiten je Design, Gruppen, Ebenen, Ausrichten und Einrasten
  mit Abstandshilfen, Kontextmenü mit der rechten Maustaste, Tastenkürzel, Rückgängig, **automatisches Speichern**. Mit Maus, Stift und Finger; auf dem Handy mit Reiterleiste unten.
- **Elemente und Symbole:** Formen und Linien, Bildrahmen (rund, Herz, Stern …), rund 1 900 Symbole (Lucide) mit deutscher Suche, Flaggen und Siegel, ein **Deko-Paket** mit über 300 eigenen Grafiken (Rahmen, Kränze, Blumen, Konfetti, Ballons, Trenner, Ecken, Muster), **QR-Codes** und Strichcodes (EAN-13, EAN-8, Code 128).
- **Text:** Überschrift, Zwischenüberschrift, Fließtext und zehn **Schriftkombinationen**; Effekte wie Schatten, Kontur, Hintergrund und Kreisbogen; Listen, Abstände, Unterstreichen, Großbuchstaben; 33 mitgelieferte Schriften (darunter Schreibschriften für Hochzeiten und verspielte für Kinder).
- **Bilder:** Zuschneiden, Spiegeln, Masken, Rand und Filter (Helligkeit, Kontrast, Sättigung, Unschärfe, Schwarzweiß); Farben mit Verlauf, Markenfarben und Pipette.
- **Uploads per Drag & Drop und Einfügen:** Bilder und Schriften aus dem Explorer auf die Fläche ziehen oder mit Strg+V einfügen (auch Screenshots und Text); ein **Medienbrowser** zeigt alles mit Vorschau.
- **Marke:** Markenfarben, Markenschriften und Logos einmal festlegen, im Designer überall bereit.
- **Herunterladen und Drucken:** PNG, JPG, SVG und PDF/Druck, einzelne Seiten oder alle (mehrere Seiten als ZIP), transparenter Hintergrund, ×1 bis ×4 oder eigene Auflösung.
- **Projekte, Ordner und Teams:** Jede Person hat einen eigenen Bereich („Meine Projekte“) mit Ordnern, Designs, Bildern, Datenlisten und Serienausgaben; **Teams** arbeiten in einem gemeinsamen Bereich mit eigener Marke und eigenen Vorlagen.
- **Teilen:** mit Personen und Teams (*Kann ansehen* / *Kann bearbeiten*), per Link für Angemeldete oder als **öffentlicher Link** ohne Konto; wer keinen Zugriff hat, kann ihn anfordern.
- **Zusammenarbeit:** Kommentare mit Pins direkt auf der Fläche, `@`-Erwähnungen, Benachrichtigungen (Glocke, auf Wunsch per Mail) und die Anzeige, wer ein Design gerade geöffnet hat.
- **KI-Design (optional):** Beschreibe, was du brauchst („ein Plakat für unser Sommerfest“), und ein Assistent entwirft das Design oder passt ein vorhandenes an, **während du zusiehst**: jeder Schritt steht im Protokoll, die Fläche verändert sich live, ein Strg+Z nimmt alles zurück. Siehe *KI-Design* unten.
- **Kataloge (optional):** Fotos von Pexels, Pixabay, Openverse und Unsplash, über 200 offene Icon-Sätze (Material Design, Tabler, Phosphor, Font Awesome Free …) und freie Schriften aus Google Fonts, direkt im Designer durchsuchen. Was du benutzt, wird **mit Urheber und Lizenz auf den Server kopiert**: Designs drucken auch ohne Internet, und die Bildnachweise stehen unter *Datei*. Siehe *Kataloge* unten.
- **Konten:** Administrator und Mitglied; Registrierung aus, offen oder mit Freigabe, Einladungen per Link oder Mail. Oberfläche auf Deutsch, hell und dunkel.
- **Installierbare App (PWA)** mit Offline-Anzeige zuletzt geöffneter Seiten; der Designer behält ungespeicherte Änderungen und speichert, sobald die Verbindung zurück ist.

### Zusatz: Serien mit Daten

Wer viele ähnliche Etiketten oder Karten braucht, nutzt zusätzlich (Menü *Serien (Zusatz)*):

- **Datenlisten und Platzhalter:** Felder wie Name, Preis, Herkunftsland in einem Design (`{{Name}}`); Datenlisten mit Tabellen-Editor, CSV-Import und -Export, Einfügen aus Excel.
- **Serienausgaben:** Druck oder PDF über den Browser (ein Etikett pro Seite oder mehrere auf einem Druckbogen, mit Schnittmarken und Startposition) und PNG-ZIP. Dazu der **Einzeldruck**
  eines Etiketts mit eingetippten Werten und der Export und Import eines Designs als Datei.
- **Druckbögen:** wie die Etiketten auf dem Papier sitzen (A4 mit 2 × 4, 3 × 8 … Etiketten, eigene Bögen).
- **KI-Import (optional):** Daten aus Text übernehmen, eine Spalte füllen lassen, Texte vorschlagen lassen – immer mit Vorschau, Protokoll und Rückgängig.

## So sieht es aus

Beim ersten Start sind die Vorlagen da, dazu ein Beispiel für die Serien mit Daten: die Vorlage **Käsetheke – Preisschild**, die Datenliste **Käsetheke (Beispiel)** mit sechs Käsen und die Serienausgabe
**Käsetheke – A4 mit 4 Etiketten**. Damit kannst du alles ausprobieren; was du löschst, kommt nicht wieder (eine Vorlage, die eine spätere Version neu mitbringt, wird einmal ergänzt).

**Gestalten**

| | |
|---|---|
| ![Start](docs/images/start.png) | ![Vorlagen](docs/images/templates.png) |
| **Start:** „Was möchtest du heute gestalten?“, Formate mit einem Klick, Vorlagen und zuletzt bearbeitete Designs | **Vorlagen:** eine Kachel je Familie mit „3 Varianten“, nach Anlass sortiert, mit Suche |
| ![Kontextmenü](docs/images/context-menu.png) | ![Schriftkombinationen](docs/images/text-combinations.png) |
| **Kontextmenü** mit der rechten Maustaste: Kopieren, Stil übertragen, Ebene, Ausrichten, Gruppieren, Sperren | **Text:** Überschriften und zehn fertige Schriftkombinationen |
| ![Texteffekte](docs/images/text-effects.png) | ![Medienbrowser](docs/images/media-browser.png) |
| **Texteffekte:** Schatten, Kontur, Hintergrund, Kreisbogen – mit Vorschau | **Medienbrowser:** Uploads, Flaggen, Siegel, Logos und der Reiter *Deko* (Rahmen, Blumen, Konfetti, Muster …) mit Suche; Bilder auch per Ziehen und Strg+V |
| ![Design erstellen](docs/images/create-dialog.png) | ![Herunterladen](docs/images/download.png) |
| **Design erstellen:** ein Format wählen oder eine eigene Größe in mm oder px eingeben | **Herunterladen:** PNG, JPG, SVG oder PDF, Größe und transparenter Hintergrund |
| ![Handy](docs/images/phone-editor.png) | ![Start auf dem Handy](docs/images/phone-start.png) |
| **Auf dem Handy:** der Designer mit Reiterleiste unten und einer Werkzeugleiste zum Wischen | **Start auf dem Handy:** dieselben Formate, Vorlagen und Designs, einspaltig |

**Projekte, Teams und Teilen**

| | |
|---|---|
| ![Projekte](docs/images/projects.png) | ![Teilen](docs/images/share.png) |
| **Projekte:** der eigene Bereich mit Ordnern (mit Vorschau ihres Inhalts), Designs und Datenlisten; Raster oder Liste, Suche, Sortierung | **Teilen:** Personen und Teams hinzufügen, wer schon Zugriff hat, und der Link (nur Personen mit Zugriff, alle Angemeldeten oder öffentlich) |
| ![Team](docs/images/team-members.png) | ![Öffentliche Ansicht](docs/images/public-view.png) |
| **Team:** Mitglieder mit ihren Rollen (Inhaber, Admin, Bearbeiter, Betrachter), Einladen, Marke, Vorlagen, Einstellungen | **Öffentliche Ansicht:** ein Design ohne Anmeldung ansehen, auf Wunsch mit Herunterladen |
| ![Kommentare](docs/images/comments.png) | ![Benachrichtigungen](docs/images/notifications.png) |
| **Kommentare:** Pins auf der Fläche und an Elementen, Antworten, Erwähnungen, Erledigen | **Glocke:** Freigaben, Antworten, Erwähnungen und Zugriffsanfragen mit „Gewähren“ und „Ablehnen“ |

**KI-Design (optional)**

| | | |
|---|---|---|
| ![Mit KI entwerfen](docs/images/ai-prompt.png) | ![KI-Assistent im Designer](docs/images/ai-design.png) | ![KI-Assistent auf dem Handy](docs/images/ai-phone.png) |
| **Mit KI entwerfen:** ein Satz auf der Startseite, Format „Automatisch“ oder ein gewähltes | **Assistent im Designer:** das Protokoll jedes Schritts, das Plakat entsteht live, *Rückgängig* | **Auf dem Handy:** dasselbe Gespräch als Fenster unten |

**Kataloge (optional)**

| | |
|---|---|
| ![Icon-Sätze](docs/images/catalogs-icons.png) | ![Weitere Schriften](docs/images/catalogs-fonts.png) |
| **Icon-Sätze:** vier Käse-Icons aus vier Sätzen (Tabler, Phosphor, Material Design, Font Awesome) mit der Farbe des Elements; im Panel *Elemente* wechselst du den Satz | **Weitere Schriften:** freie Schriften aus Google Fonts, jede in ihren eigenen Buchstaben, mit eigenem Vorschautext |
| ![Fotos in der Medienauswahl](docs/images/catalogs-photos.png) | ![Verwaltung der Kataloge](docs/images/catalogs-admin.png) |
| **Fotos:** ein Reiter je Katalog mit Sammlungen, Format- und Farbfilter und dem Hinweis des Anbieters; ein Klick übernimmt das Foto | **Verwaltung > Kataloge:** einschalten, Schlüssel, Grenzen, erlaubte Lizenzen und Sätze; die Regeln des Anbieters stehen dabei |

**Serien (Zusatz)**

| | |
|---|---|
| ![Designer mit Daten](docs/images/editor-data.png) | ![Datenliste](docs/images/datalist.png) |
| **Daten im Designer:** Vorschau mit einer Zeile der Datenliste, Felder und Anzeigebedingungen | **Datenliste:** eine Zeile je Etikett, Bilder aus der Medienbibliothek |
| ![Serienausgabe](docs/images/output.png) | ![Serienausgabe einrichten](docs/images/output-job.png) |
| **Ausgabe:** das Preisschild der Käsetheke, sechs Käse auf zwei Druckbögen | **Serienausgabe:** Design, Datenliste, Auswahl, Druckbogen und Format |
| ![Uploads und Medien](docs/images/media.png) | ![KI](docs/images/ai-import.png) |
| **Uploads & Medien:** Flaggen, Siegel, Logos und Fotos mit eindeutigem Schlüssel | **KI-Vorschlag:** neue Zeilen aus einem eingefügten Text, du übernimmst, was stimmt |

## Starten

DesignThix besteht aus einem Container (die App) und einer PostgreSQL-Datenbank. Die Datenbank legt sich beim Start selbst an und migriert sich; Umgebungsvariablen
brauchst du nicht.

| Stack | Datei | Image | App | pgAdmin | Postgres |
|---|---|---|---|---|---|
| **Release** (Branch `main`) | `docker-compose.yml` | `ghcr.io/real-ttx/designthix:latest` | http://localhost:3043 | – | – |
| **Entwicklung** (Branch `dev`) | `docker-compose.dev.yml` | `ghcr.io/real-ttx/designthix:nightly` | http://localhost:3043 | http://localhost:3044 | – |
| **Lokal** (baut aus dem Ordner) | `docker-compose.local.yml` | `designthix:local` | http://localhost:3043 | http://localhost:3044 | `localhost:3045` |

```bash
# Release
docker compose up -d
# Entwicklung (nightly)
docker compose -f docker-compose.dev.yml up -d
# Lokal: baut das Image neu und startet den Stack (so wird jede Änderung getestet)
./scripts/redeploy.ps1        # oder ./scripts/redeploy.sh ; mit -Clean / --clean werden die Volumes geleert
```

**Der erste Aufruf** von http://localhost:3043 öffnet den **Einrichtungsassistenten**: Er legt das Konto der Administration an (es gibt kein Standardpasswort). Danach
kommen weitere Menschen über *Verwaltung > Benutzer* (Konto anlegen), über eine **Einladung** (Link oder Mail) oder, wenn du es einschaltest, über die **Registrierung** dazu (siehe unten).
Für mehr als das lokale Netz gehört ein Reverse-Proxy mit TLS davor; in den Mail-Einstellungen steht dann die öffentliche Adresse, mit der die Links in Mails beginnen.

Updates: `docker compose pull && docker compose up -d`. Im Volume `web-data` liegen die Schlüssel der App und die KI-Schlüssel; ohne sie sind gespeicherte Geheimnisse nicht lesbar
(sie gehören nicht in ein Backup der Datenbank, aber in ein eigenes). Die Datenbank liegt im Volume `db-data`.

### Versionen

Es gibt zwei Branches: **`main`** ist das Release, **`dev`** der Entwicklungsstand. Die GitHub-Action baut und testet (gegen PostgreSQL) und veröffentlicht ein Multi-Arch-Image
(amd64, arm64) nach `ghcr.io/real-ttx/designthix`:

| Branch | Version | Tags des Images |
|---|---|---|
| `main` | `<major>.<minor>.<build>-<datum>`, zum Beispiel `0.1.42-20261024` | `<version>`, `latest`, `release` |
| `dev` | `nightly-<build>-<datum>` | `<version>`, `nightly` |
| lokal gebaut | `local-<datum>` | `designthix:local` |

Major und Minor stehen in `Directory.Build.props`, die Build-Nummer ist die Nummer des Laufs der Action. Die Version steht links unten im Menü; ein Klick öffnet *Über DesignThix*.

## Vorlagen

Die Vorlagen sind fertige Entwürfe zum Anpassen: Du wählst eine, bekommst eine Kopie in deinem Bereich und änderst Texte, Farben und Bilder im Designer. Die Vorlage selbst bleibt unverändert (bearbeiten darf sie nur die Administration).
Alles funktioniert **ohne Internet und ohne Fotos**: Schmuck kommt aus dem eingebauten Deko-Paket und aus Symbolen, Bildflächen sind Rahmen, in die du dein Foto ziehst.

- **333 Vorlagen in 110 Familien.** Eine Familie ist eine Art von Vorlage (zum Beispiel „Hochzeit: Einladung (Klappkarte)“) in **mindestens drei Varianten**, die sich in Aufbau, Schrift und Schmuck unterscheiden (klassisch, modern, verspielt; bei Kindergeburtstagen die Motive Pirat, Einhorn, Dino, Weltall, Fußball, Feuerwehr, Unterwasser).
  Die Galerie zeigt eine Kachel je Familie mit „3 Varianten“ und drei Punkten; ein Klick auf einen Punkt zeigt die Variante, **Ansehen** öffnet alle Seiten und lässt dich mit den Pfeiltasten zwischen den Varianten wechseln.
- **Zwölf Anlässe** (Filter und Überschriften der Galerie): Geburtstag (3 Familien), Hochzeit (10), Kinder & Familie (10), Feiertage (9), Feste & Events (15), Trauer (1), Business (11), Gastronomie (4), Verein & Schule (12), Handel & Preise (14), Social Media (9), Formulare & Planer (11).
  Dazu der Filter nach Format (37 Formate) und die Suche, die Namen, Stichwörter und Beschreibungen durchsucht (Umlaute egal: „grusskarte“ findet Grußkarte).
- **Karten:** Grußkarten für Geburtstag, Danke, Glückwunsch, Gute Besserung, Weihnachten, Ostern, Neujahr, Mutter- und Vatertag, Beileid; **Hochzeit** komplett (Save the Date, Einladung als Klappkarte und flach, Antwortkarte, Programm, Menükarte, Tischkarte mit `{{Name}}`, Tischnummer, Danksagung, Willkommensschild); Taufe, Kommunion, Konfirmation, Einschulung, Babyparty, Geburtsanzeige, Jubiläum, Abschluss, Halloween, Silvester, Sommerfest, Grillfest, Weihnachtsfeier.
- **Gefaltete Karten:** Das Dokument hat eine **Falz** (senkrecht oder waagerecht). Die Seite ist das offene Blatt (zum Beispiel 210 × 148 mm für eine Klappkarte A6), die Seiten heißen „Außen (Rückseite | Vorderseite)“ und „Innen“. Der Designer zeichnet die Falzlinie und den Sicherheitsrand als Hilfslinien (an- und abschaltbar); Druck, Download und Vorschau kennen sie nicht.
- **Flyer, Plakate, Business:** Veranstaltung, Vereinsfest, Flohmarkt, Konzert, Kurse, Mittagstisch, Lieferdienst, Handwerker, Reinigung, Nachhilfe, Aushänge mit Abreißzetteln, Eröffnung, Sale, Spendenaufruf, Tag der offenen Tür, Plakate; Visitenkarten, Briefpapier, Gutschein (`{{Code}}`, `{{Betrag}}`), Urkunde, Speisekarte, Etiketten für Marmelade, Gewürz, Seife, Kerze und Honig, Namensschilder, Lesezeichen, Instagram (Beitrag und Story), Facebook-Titelbild, Präsentation.
- **Formulare und Planer** (zum Ausdrucken und Ausfüllen von Hand, sparsam mit Toner, Ränder ab 10 mm, Schrift ab 8 pt): Anmeldung, Bestellschein, Stundenzettel, Urlaubsantrag, Übergabeprotokoll, Feedbackbogen, Teilnehmerliste, Quittung, Inventarliste, Checkliste, To-do-Liste, Wochen- und Monatsplaner, Stundenplan, Essensplan, Einkaufs- und Packliste, Haushaltsbuch, Lesetagebuch, Gewohnheits-Tracker. Wo eine Serie Sinn hat, sind die Angaben **Felder** mit Beispielzeilen, damit ein Tischkartenstapel oder ein Satz Urkunden aus einer Datenliste entsteht.
- **Deko-Paket:** 335 eigene Zeichnungen (150 Motive in Farbvarianten: Rahmen, Ornamente, Trenner, Ecken, Blumen und Blätter, Herzen, Sterne, Konfetti und Ballons, Bänder und Siegel, Muster, Formen) im Reiter *Deko* der Medienauswahl; sie gehören zu DesignThix und haben keine fremde Lizenz.
- **Schriften:** 33 Familien (Schreibschriften für Hochzeit und Geburtstag, Antiqua, Serifenlose, Kinderschriften, Plakatschriften), alle unter freien Lizenzen und mit ä ö ü ß € „ “ –; sie liegen in der App.

| | |
|---|---|
| ![Vorlagen für die Hochzeit](docs/images/templates-hochzeit.png) | ![Vorschau einer Familie](docs/images/template-preview.png) |
| **Galerie** nach Anlass gefiltert: zehn Familien für die Hochzeit, je mit drei Varianten | **Ansehen:** alle Seiten einer Klappkarte mit Falzlinie, die Varianten als Auswahl, „Vorlage verwenden“ auf der gezeigten |

**Eigene Vorlagen** machst du aus jedem Design (Eigenschaften, Schalter „Als Vorlage anbieten“), im Team von Bearbeitern aufwärts. Die eingebauten werden beim Start einmal in eine Datenbank übernommen (eine Vorlage, die du löschst, kommt nicht wieder; eine, die eine spätere Version neu mitbringt, wird einmal ergänzt).

## Projekte, Teams und Teilen

**Bereiche.** Jede Person hat `Meine Projekte`, jedes Team einen eigenen Bereich. Ein Bereich enthält Ordner (bis acht Ebenen tief), Designs, Bilder, Datenlisten und Serienausgaben; Schriften und Druckbögen gehören zum Bereich, aber nicht in Ordner.
Die Seite *Projekte* ist ein Dateibrowser: Raster oder Liste, Filter nach Art, Suche, Sortierung, Mehrfachauswahl (Klick, Umschalt, Strg), Ziehen auf Ordner und den Pfad, Kontextmenü, *Neu* (Design, Ordner, Bilder hochladen, Datenliste) und Dateien aus dem Explorer direkt in den
geöffneten Ordner ziehen. *Mit Stern* merkt dir Lieblinge, *Zuletzt verwendet* steht auf der Startseite. Gelöschtes liegt 30 Tage im **Papierkorb** (die Zahl stellt die Administration ein) und lässt sich zurückholen; ein Ordner nimmt seinen Inhalt mit hin und zurück.
Für Bilder und Schriften gibt es Speicherplatz (2 GB je Person, 10 GB je Team, einstellbar); die Anzeige steht am Bereich.

**Teams.** Wer ein Team anlegt, ist sein *Inhaber*. Die Rollen: **Inhaber** (alles, auch das Team löschen oder übergeben), **Admin** (Mitglieder, Einladungen, Marke, Vorlagen, Einstellungen), **Bearbeiter** (legt an und ändert alles im Bereich des Teams, teilt, verschiebt, löscht)
und **Betrachter** (sieht den Bereich nur an). Ein Team hat Reiter für Projekte, Mitglieder, Marke, Vorlagen und Einstellungen. Eingeladen wird per E-Mail-Adresse (ist ein Mailserver eingerichtet, geht die Mail raus, sonst zeigt DesignThix den Link zum Kopieren)
oder mit einem Einladungslink (Rolle, 1/7/30 Tage, Höchstzahl der Nutzungen). Ein Link, den ein Mailprogramm nur abruft, nimmt niemanden auf: Beitreten ist ein Knopf.

**Teilen.** Der Knopf *Teilen* (Editor, Kontextmenü, Ordnerkopf) öffnet den Dialog: Personen oder Teams suchen (ab zwei Zeichen, nach Name oder Adresse), *Kann ansehen* oder *Kann bearbeiten*, auf Wunsch mit Nachricht; darunter, wer schon Zugriff hat – auch über einen Ordner
weiter oben –, und der **Link**: *Nur Personen mit Zugriff*, *Alle Angemeldeten mit dem Link* (ansehen oder bearbeiten) oder *Öffentlich* (nur ansehen, jeder mit dem Link, ohne Konto; Designs und Ordner; *Herunterladen erlauben* und ein Ablaufdatum sind einstellbar).
Ein Link lässt sich zurücksetzen; der alte ist dann tot. Die Ansicht `/s/<Link>` zeigt das Design mit den eigenen Beispielwerten – nie die Zeilen einer Datenliste – und ist für Suchmaschinen gesperrt. Was mit dir geteilt wurde, steht unter *Freigegeben*.
Wer ein Element ohne Zugriff öffnet, sieht *Zugriff anfordern* (die Seite sagt nie, ob es das Element gibt); die Verwaltenden bekommen eine Benachrichtigung mit *Gewähren* und *Ablehnen*. Ein Design, das du nur ansehen darfst, öffnet der Editor schreibgeschützt mit *Kopie erstellen*.
Wer ein Design gerade geöffnet hat, zeigen kleine Avatare; speichern zwei gleichzeitig, fragt der zweite, ob er seine Fassung als Kopie sichern will.

**Kommentare.** Im Editor schreibst du Kommentare an die Seite oder heftest sie als Pin an ein Element (Taste `K`); mit `@Name` erwähnst du Personen, die das Design sehen dürfen. Antworten, Erledigen und Wiedereröffnen; wer ansehen darf, darf kommentieren. Die Pins gehören nie in
einen Download, einen Druck oder ein Vorschaubild.

**Konten.** Die Administration stellt unter *Verwaltung > Plattform* ein: Registrierung *aus* (nur Einladungen), *offen* oder *mit Freigabe* (das Konto wartet, bis es freigegeben ist), erlaubte E-Mail-Domains, ob Mitglieder einladen und Teams anlegen dürfen, öffentliche Links, Speicherplatz und Papierkorb.
Die Registrierung sagt nie, ob eine Adresse schon ein Konto hat, und bremst Versuche je Adresse und je Rechner. Die E-Mail-Adresse wird nicht bestätigt: für eine geschlossene Gruppe ist *Mit Freigabe* der richtige Weg. Unter *Verwaltung > E-Mail* steht der Mailserver, unter
*Verwaltung > Teams* sind alle Teams mit Mitgliedern und Speicher (ohne Inhalte; zur Hilfe kann die Administration einem Team als Admin beitreten, das steht im Protokoll). Ein Konto löschen heißt: die Inhalte gehen an eine Person oder ein Team oder in den Papierkorb.

**Benachrichtigungen.** Die Glocke zählt, was neu ist: eine Freigabe, eine Zugriffsanfrage, eine Antwort, eine Erwähnung, eine Einladung, eine Änderung im Team. Ein Klick öffnet die Sache und markiert sie als gelesen. Im Profil stellst du ein, wofür du zusätzlich eine Mail willst.
Schreibt dir jemand mehr als zehnmal in zehn Minuten dieselbe Art von Hinweis, werden die weiteren in der neuesten Zeile zusammengefasst („und 5 weitere“, sie gilt wieder als ungelesen) und lösen keine neue Mail aus.

**Sicherheit.** Was jemand mit einem Element darf (*Nichts, Ansehen, Bearbeiten, Verwalten*), entscheidet die Logik hinter jeder Seite und jedem Aufruf (`Access`): Bereich, Team, Freigabe, Link. Ein Element, das es nicht gibt oder das du nicht sehen darfst, antwortet gleich mit 404, damit niemand Nummern
durchprobiert. Bilder, Schriften und Vorschaubilder haben einen Hash in der Adresse (wer ihn kennt, darf laden – nur die Aufrufe, die den Zugriff geprüft haben, verraten ihn); ein Design darf nur Bilder benutzen, die dem Speichernden zur Verfügung stehen. Die Prüfung der Plattform (Rechte je Rolle,
Links, öffentliche Ansicht, Einladungen, Registrierung, Mails) steht in [docs/PLAN-PLATFORM.md](docs/PLAN-PLATFORM.md), Abschnitt „Security review (P6)“.

## Serien mit Daten: Platzhalter

Ein **Feld** hat einen Schlüssel (`Name`, `Preis`, `Land`), eine Beschriftung, eine Art und einen Beispielwert. Du legst Felder im Designer an (Reiter *Daten (Zusatz)*) und
benutzt sie so:

- **In einem Text:** `{{Name}}` wird durch den Wert der Datenliste ersetzt. Der Text darf mehr enthalten („Heute: {{Name}} für {{Preis}} €“). Groß und klein ist egal, Leerzeichen
  in den Klammern auch. Ein unbekannter Schlüssel bleibt leer; der Designer warnt davor.
- **Als Bild:** Ein Bild oder ein Platz einer **Bildleiste** wird an ein Feld der Art *Bild* gebunden. In der Datenliste steht dann der **Schlüssel eines Mediums** (`flag-de`, `icon-bio`);
  die Zelle bietet die Medien mit Vorschau zur Auswahl an. Die Bildleiste stellt die Bilder in einer Reihe nebeneinander, **leere Plätze fallen weg** und die übrigen rücken auf.
- **Ausblenden, wenn leer:** Im Reiter *Daten (Zusatz)* hat das ausgewählte Element die *Anzeigebedingung* „Nur wenn <Feld> gefüllt ist“. So verschwindet eine Zeile samt Beschriftung
  („GEREIFT:“ mit ihrer gepunkteten Linie), wenn die Datenliste dafür nichts hat.
- **Schrift, die sich anpasst:** „Verkleinern, bis es passt“ macht die Schrift so groß wie möglich, ohne dass sie das Feld verlässt (bis zu einer Mindestgröße). Lange Namen bleiben so im Etikett.
- **Zahlen und Preise:** Felder der Art *Preis* zeigen den Wert mit zwei Nachkommastellen im deutschen Format (`2,99`), egal ob in der Liste `2,99` oder `2.99` steht; *Zahl* zeigt so
  viele Stellen, wie eingestellt sind. Das Eurozeichen und die Einheit („/ 100 g“) sind eigene Elemente, die du neben den Preis setzt.
- **Vorschau mit Daten:** Im Reiter *Daten (Zusatz)* wählst du eine Datenliste und blätterst mit ◀ ▶ durch ihre Zeilen. Eine Spalte der Liste füllt das Feld mit gleichem Schlüssel; „Spalten aus Design
  übernehmen“ legt die Spalten einer Liste aus den Feldern des Designs an.

## Serienausgaben

Eine **Serienausgabe** speichert, was gedruckt wird: Design, Datenliste, Auswahl der Zeilen (alle, nur aktive, ausgewählte), Kopien je Zeile, Layout und Format. *Ausführen* öffnet die Seite, die
jedes Etikett zeichnet.

- **Druck / PDF:** *Drucken / Als PDF speichern* ruft den Druckdialog des Browsers; „Als PDF speichern“ gibt ein PDF in genau der Papiergröße (Schrift eingebettet, Vektoren). Ein Etikett pro
  Seite hat die Größe des Designs; auf einem **Druckbogen** (A4 mit 2 × 4, 3 × 8 … Etiketten, eigene Bögen unter *Druckbögen*) sitzen die Etiketten Zelle für Zelle, auf Wunsch mit **Schnittmarken**.
  Ein Design, das größer als die Zelle ist, wird verkleinert (mit Hinweis). Mit der **Startposition** beginnst du auf einem halb benutzten Bogen beim ersten freien Etikett.
- **PNG-ZIP:** Jedes Etikett als PNG in der Auflösung des Designs (300 dpi voreingestellt), alle in einer ZIP-Datei; die Dateinamen kommen aus einem Muster wie `{Design}-{Nr}-{Name}`.
- **Einzeldruck:** Am Design ein Formular mit den Feldern: Werte eintippen oder Medien wählen, Etikett drucken oder als PNG laden – ohne eine Serienausgabe zu speichern. Das dürfen auch Betrachter.
- Höchstens 2000 Etiketten je Serienausgabe.

## KI-Design

Der Assistent im Designer arbeitet wie eine Grafikerin, der du über die Schulter schaust: Du schreibst, was du brauchst, und er legt Seiten und Elemente an, ändert, ordnet und übersetzt Texte, nimmt deine Marke und Vorlagen,
baut Platzhalter für Serien ein und sieht sich das Ergebnis selbst an. **Jeden Schritt siehst du, während er geschieht:** als Karte im Protokoll („Text „Sommerfest“ geändert“, „3 Elemente hinzugefügt“), die Worte der KI erscheinen beim Schreiben,
und die Fläche zeigt jede Änderung sofort (die betroffenen Elemente blitzen kurz auf). Solange er arbeitet, ist der Designer gesperrt; *Stopp* hält ihn an.

**Einschalten (Administrator):** *Verwaltung > KI > Profile*: ein Profil mit einem OpenAI-kompatiblen Anbieter (oder einem ChatGPT-Konto) anlegen, mit *Testen* prüfen und aktiv setzen; unter *Allgemein* muss *KI eingeschaltet*
stehen. Unter *Grenzen* stehen die Kosten-Grenzen: voreingestellt 3 Mio. Tokens je Person und Tag (rund 30 Aufträge), 40 Mio. je Person und Monat, 200 Mio. für alle zusammen im Monat, 200 Aufträge je Adresse und Tag und
60 Anfragen je Adresse und Minute (0 heißt: keine Grenze); dazu die Grenzen des Assistenten (Aufrufe je Auftrag, gleichzeitige Aufträge, Seitenansichten, Dateien je Nachricht) und der Schalter *Ergebnis vor dem Abschluss prüfen lassen* (siehe unten). Wird eine Grenze erreicht, steht im Fenster
*welche* (zum Beispiel „Dein Tagesbudget der KI (3.000.000 Tokens pro Tag) ist aufgebraucht“), und der Administrator bekommt dort den Knopf *Limits anpassen*. Was du schon gespeichert hast, ändert sich bei einem Update nicht.
Ohne Profil fehlt der Assistent: Mitglieder sehen dann keinen Eintrag, der Administrator eine Erklärung mit Link.

**Benutzen:**

- **Wie ein neues Design entsteht:** Die KI sucht zuerst in den über 600 Vorlagen (und zeigt sich die Treffer nebeneinander), nimmt die passendste, ersetzt jeden Beispieltext durch deine Angaben, tauscht Motive gegen passende (es gibt gezeichnete Dinosaurier, Rennwagen, Kronen, Trampoline, Schlösser, Ballons und hunderte mehr) und sieht sich das Ergebnis an. Fehlt eine Angabe (Datum, Ort), steht ein Platzhalter wie „[Datum]“ da und sie sagt dir, was du noch ergänzen musst. Ein Design, das schon Inhalt hat, sieht sie sich zuerst an, bevor sie etwas ändert.
- **Neues Design:** Auf der Startseite (und im Dialog *Design erstellen*) beschreibst du das Design unter *Mit KI entwerfen*, wählst ein Format oder lässt es bei *Automatisch* (die KI wählt eines, das passt) und klickst *Entwerfen*:
  der Designer öffnet sich und du siehst zu. Das Design bekommt einen passenden Namen.
- **Vorhandenes Design anpassen:** Im Designer der Reiter *KI*. Beispiele: „Mach daraus ein Plakat“, „Übersetze alle Texte ins Englische“, „Nutze unsere Markenfarben und Schriften“, „Erzeuge drei Varianten auf neuen Seiten“, „Ersetze die Texte durch Platzhalter für eine Serie“.
  *Strg+Enter* sendet.
- **Anhängen:** Bilder (JPG, PNG, WebP, GIF, SVG), PDF, Word (.docx), Excel (.xlsx) und Textdateien (bis zu sechs je Nachricht); Bilder landen in der Bibliothek (Kategorie „KI-Anhang“), damit die KI sie platzieren kann, und sie sieht sie auch.
  Der Text von Dokumenten dient der KI als Material, nie als Anweisung.
- **Referenz:** ein anderes Design oder eine Datenliste, die du sehen darfst, als Vorlage oder Quelle (Datenlisten mit personenbezogenen Daten nur, wenn der Administrator es erlaubt hat).
- **Nur hier ändern:** Mit *Diese Seite* oder einer Auswahl und dem Haken *Nur hier ändern* darf die KI nur dort schreiben; gesperrte Elemente fasst sie nie an.
- **Rückgängig:** Ein ganzer Auftrag ist **ein** Schritt: Strg+Z im Designer nimmt ihn zurück, oder *Rückgängig* im Protokoll (auch nach dem Neuladen und für den neuesten Auftrag zuerst). Hast du das Design seitdem geändert, fragt es vorher.
- **Weitermachen** setzt einen angehaltenen Auftrag fort; *Neu* beginnt ein neues Gespräch, *Verlauf* listet frühere; *Anweisung an die KI anzeigen* zeigt genau, was an die KI geht.

**Die Prüfung vor dem Abschluss:** Sagt die KI „fertig“, nachdem sie das Design geändert hat, schickt die Anwendung sie höchstens zweimal zurück, wenn sie sich das Ergebnis noch nicht angesehen hat oder wenn die Prüfung etwas Echtes findet: Text, der über anderem Text oder einem Bild liegt, ein Text, der aus seinem Kasten läuft, zu nah am Rand oder über dem Falz einer Klappkarte, zu klein für das Format, schlecht lesbar, eine große leere Fläche, Beispieltexte einer Vorlage („Musterstadt“), die nicht ersetzt wurden. Das kostet ein paar Aufrufe mehr (ein Auftrag braucht rund 100.000 Tokens) und macht die Ergebnisse deutlich besser; abschalten kann es der Administrator unter *Grenzen*.

**Was die KI sieht und kann:** Sie sieht das Design, an dem sie arbeitet (Format, Seiten, Elemente, Felder), die Marke des Bereichs, die Vorlagen und Schriften, die du auch siehst, und das, was du anhängst oder als Referenz wählst.
Sie kann **nur dieses Design** ändern (und Bilder in deine Bibliothek zeichnen): nichts teilen, verschieben, löschen oder versenden, und kein anderes Design anfassen. Jede Änderung geht durch dieselben Prüfungen und Rechte wie deine eigene;
wer nur ansehen darf, sieht den Assistenten nicht. Fotos kann sie nicht erzeugen (nur Formen, Symbole, Farbflächen, gezeichnete Grafik und Bildrahmen für deine Fotos). Jeder Auftrag mit allen Schritten steht unter *Verwaltung > KI > Läufe*.

## Kataloge

Bilder, Symbole und Schriften kommen nicht nur aus deiner Bibliothek: **Kataloge** sind Quellen, die der Administrator unter *Verwaltung > Kataloge* einschaltet. Alles, was jemand benutzt, wird **auf den Server kopiert** und behält Quelle, Urheber und Lizenz. So bleiben Designs ohne Internet druckbar,
die öffentliche Ansicht und die Serienausgaben fragen nie bei einem Anbieter nach, und nichts bricht, wenn ein Anbieter verschwindet. **Der Browser spricht mit keinem Anbieter, mit einer Ausnahme (Unsplash, siehe unten):** Suche, Vorschaubilder und Downloads laufen über den Server, die Schlüssel stehen nur dort.

| Katalog | Inhalt | Schlüssel |
|---|---|---|
| **Mitgeliefert**, **Uploads**, **Ordner auf dem Server** | Flaggen und Siegel; eigene Bilder (Meine Uploads, Teams, Freigegeben); Bilder aus einem Ordner im Datenvolume (`catalogs/`), den der Administrator benennt | nein |
| **Pexels** | Fotos, mit „Kuratiert“ und den Sammlungen von Pexels | ja (Pexels vergibt im Moment keine neuen Schlüssel) |
| **Pixabay** | Fotos, Illustrationen, Vektoren, mit Kategorien | ja |
| **Openverse** | Fotos aus vielen Quellen, nur CC0, gemeinfrei, CC BY und CC BY-SA | nein (optional Zugangsdaten für höhere Grenzen) |
| **Unsplash** | Fotos, mit „Alle“ (die Redaktion von Unsplash) und den Themen von Unsplash; Format- und Farbfilter | ja („Access Key“; neue Anwendungen: 50 Anfragen pro Stunde, mehr nur nach Freigabe durch Unsplash) |
| **Icons (Iconify)** | über 200 offene Icon-Sätze, ausgewählt vom Administrator: Material Design, Tabler, Phosphor, Font Awesome Free, Bootstrap, Carbon … | nein |
| **Google Fonts** | freie Schriften (SIL OFL, Apache, Ubuntu-Lizenz), über Fontsource | nein |

**Einschalten (Administrator):** *Verwaltung > Kataloge*, den Katalog öffnen, einschalten, bei Pexels, Pixabay und Unsplash den Schlüssel eintragen (er wird verschlüsselt im Datenvolume gespeichert und nie wieder angezeigt), mit *Testen* prüfen. Jede Seite nennt die Regeln des Anbieters und wie sein Schlüssel zu bekommen ist. Die Adresse eines Anbieters
stellt nur der Betreiber ein (`DESIGNTHIX__Catalogs__<id>__BaseUrl`, zum Beispiel für einen eigenen Iconify-Server), nie eine Seite. Ohne Schlüssel erscheint ein Katalog, der einen braucht, nirgends.

**Unsplash (Datenschutz und Regeln):** Unsplash verlangt, dass seine Fotos von seinen eigenen Adressen angezeigt werden. **Wenn Unsplash eingeschaltet ist, lädt dein Browser die Vorschaubilder direkt von Unsplash (`images.unsplash.com`). Unsplash sieht dabei deine IP-Adresse** und welche Fotos du dir ansiehst; nenne das in deiner Datenschutzerklärung. DesignThix erlaubt diese eine Adresse nur, solange der Katalog eingeschaltet ist und einen Schlüssel hat,
und nur auf den Seiten für angemeldete Personen, die die Bildauswahl oder den Designer zeigen (Content-Security-Policy); die öffentliche Ansicht, der Druck und alle anderen Seiten laden nie etwas von Unsplash, und ist Unsplash aus, ist die Richtlinie so streng wie bei allen anderen. Wählt jemand ein Foto, **meldet der Server den Download bei Unsplash** (mit dem Schlüssel, der nie in den Browser kommt) und kopiert das Foto in die Bibliothek.
Unter jedem Treffer steht „Foto: Name / Unsplash“ mit Links auf die Fotografin oder den Fotografen und auf Unsplash (`utm_source=DesignThix&utm_medium=referral`), und die Bildnachweise nennen beide. Lege die Anwendung bei Unsplash unter dem Namen „DesignThix“ an (der Name darf nicht „Unsplash“ enthalten); die Seite des Katalogs unter *Verwaltung > Kataloge* nennt alle Regeln, auch dass die Schnittstelle nicht für Datensammeln oder KI-Training gedacht ist.
Für mehr als 50 Anfragen pro Stunde muss Unsplash die Anwendung freigeben (Antrag mit Bildschirmfotos); trage das Limit dann bei „Anfragen pro Stunde“ ein.

**Benutzen:**

- **Fotos:** In jeder Bildauswahl (*Bild wählen*, *Ersetzen*, Hintergrund, Logos …) hat jeder eingeschaltete Katalog mit Bildern einen Reiter; im Designer gibt es dafür den Reiter **Fotos**. Ein Klick (oder Ziehen auf die Fläche, auf ein Bild oder einen Rahmen) übernimmt das Foto in die Bibliothek deines Bereichs.
  Ein Foto, das schon übernommen wurde, wird nicht doppelt gespeichert.
- **Icons:** Im Panel *Elemente* wählst du bei *Icons* den **Icon-Satz** (zuerst „Lucide“, dann die Sätze des Administrators); die Suche gilt für den gewählten Satz, *Alle anzeigen* blättert durch ihn. Dasselbe Auswahlfeld hat *Icon ersetzen*. Ein Klick übernimmt das Icon; es hat die Farbe und die
  Strichstärke des Elements wie jedes andere Symbol.
- **Schriften:** *Weitere Schriften …* im Panel *Text* und in der Schriftauswahl der Werkzeugleiste (auch unter *Schriften*): suchen, nach Art filtern, einen eigenen Text ausprobieren, *Hinzufügen*. Die Schrift kommt mit normal, fett und (wenn es sie gibt) kursiv in deinen Bereich und steht sofort in der Schriftauswahl.
- **Bildnachweise:** *Datei > Bildnachweise …* listet jede Quelle des Designs mit Urheber, Lizenz und Link und kopiert den Text; die öffentliche Ansicht hat dasselbe als Link im Fuß. Bei Icons erscheint nur ein Satz, dessen Lizenz die Nennung verlangt (CC BY, zum Beispiel Font Awesome Free), **einmal je Satz**.
- **KI-Design:** Der Assistent kann in den eingeschalteten Katalogen suchen und **ein** gewähltes Foto, Icon oder eine Schrift übernehmen (höchstens zwölf Suchen und acht Übernahmen je Auftrag), danach damit gestalten; die Nachweise stehen wie immer unter *Datei*. Unsplash nutzt der Assistent nie (Unsplash verlangt, dass ein Mensch die Fotos auswählt); ein Unsplash-Foto, das du selbst gewählt hast, liegt in der Bibliothek und darf er von dort verwenden.

**Lizenzen:** Designs dürfen gedruckt, verändert und kommerziell genutzt werden, deshalb bietet DesignThix **nie** Bilder, Icons oder Schriften mit **NC** (nicht kommerziell) oder **ND** (keine Bearbeitung) an, und nichts ohne erkennbare Lizenz. Bei Icons nur einfarbige Sätze unter MIT, Apache 2.0, ISC, CC0, CC BY 4.0 und OFL;
Sätze unter CC BY-SA, GPL oder MPL erscheinen nur, wenn der Administrator sie ausdrücklich erlaubt. Der Administrator kann die Lizenzen und die Sätze enger fassen. Die Lizenz eines Anbieters ist dessen Aussage: wer Gewissheit braucht, betreibt einen eigenen Iconify-Server mit geprüften Sätzen.

**Grenzen:** Jede Person darf je Minute nur eine begrenzte Zahl von Suchen machen (einstellbar), der Schlüssel eines Anbieters hat ein Stundenbudget, Antworten werden einen Tag zwischengespeichert (Pixabay verlangt das; bei Unsplash eine Stunde), und sagt ein Anbieter „zu viele Anfragen“, wird er in Ruhe gelassen, bis seine Wartezeit um ist; du liest dann in Worten, wie lange.
Übernommene Bilder und Schriften zählen zum Speicherplatz deines Bereichs; ein übernommenes Icon (ein paar Hundert Byte) gehört der ganzen Installation. Der Export einer Design-Datei (`.dtx.json`) trägt Bilder und Schriften mit, **nicht** die Icons der Kataloge: auf einer anderen Installation muss dasselbe Icon dort einmal übernommen werden.

## KI-Aktionen

Die KI ist ein Angebot, kein Zwang: Ohne Profil fehlen nur die KI-Knöpfe. Unter *Verwaltung > KI* legt der Administrator ein Profil an (jeder **OpenAI-kompatible Anbieter** mit
API-Schlüssel, zum Beispiel Mistral, OpenAI, DeepSeek, OpenRouter oder ein eigener Server, oder ein **ChatGPT-Konto** per Gerätecode) und stellt Grundanweisung, Ergänzungen je Aktion und Grenzen ein.

| Aktion | Wo | Was geschieht |
|---|---|---|
| **Daten übernehmen** | Datenliste, Reiter *Import/Export* (und Knopf im Zeilen-Raster) | Du fügst Text oder eine Tabelle ein (Lieferantenliste, E-Mail, Speisekarte). Die KI schlägt neue Zeilen vor; Bild-Spalten nehmen nur vorhandene Medien. Du siehst eine Vorschau mit Hinweisen und übernimmst, was stimmt. |
| **Spalte füllen** | Datenliste, Reiter *Zeilen*: Zeilen wählen, *Mit KI füllen* | Du wählst eine Spalte und schreibst, was geschehen soll („Schreibe die Region passend zum Ort“). Die KI sieht nur die gewählten Zeilen und die Spalten, die du ankreuzt. Vorschau alt → neu, dann übernehmen. |
| **Text vorschlagen** | Designer, ein Text ist ausgewählt: Kontextmenü (rechte Maustaste) *Mit KI formulieren* | Bis zu fünf Alternativen; Platzhalter wie `{{Name}}` bleiben erhalten (sonst verwirft der Code den Vorschlag). Ein Klick übernimmt, Strg+Z nimmt zurück. |

Was sich verlassen lässt: Der **Code** prüft jede Antwort der KI (nur bekannte Spalten, Zahlen wie im Raster, Bilder nur aus der erlaubten Liste, keine Skripte, höchstens 500 Zeilen) und entscheidet,
welche Daten die KI überhaupt sieht. *Vollständige Anweisung anzeigen* zeigt vor dem Senden genau den Text, der an die KI geht. Jeder Lauf mit allen Schritten steht unter *Verwaltung > KI > Läufe*; was ein
Lauf geändert hat, lässt sich rückgängig machen (der neueste zuerst). Gestalter sehen und machen ihre eigenen Läufe an der Datenliste rückgängig, Administratoren alle.

**Datenschutz:** Datenlisten, die als „enthält personenbezogene Daten“ markiert sind, lehnt die KI ab, solange der Administrator nicht „Personenbezogene Daten an die KI senden“ eingeschaltet hat.
Empfohlen ist ein Anbieter in der EU (zum Beispiel Mistral). Bei Anbietern in den USA oder in China werden Daten in ein Drittland übermittelt; das gehört in die Datenschutzerklärung (für China gibt es
keinen Angemessenheitsbeschluss). Die API-Schlüssel liegen verschlüsselt im Volume `web-data`, nie in der Datenbank, nie in einem Backup und nie im Browser. Besucher und Adressen werden nur als täglich
wechselnder Hash gezählt.

## Offline und als App

DesignThix ist eine **installierbare App** (PWA): im Browser *Installieren* bzw. auf dem iPhone *Zum Home-Bildschirm*. Die Statusleiste hat die Farbe der App (hell und dunkel), Notch und
Home-Anzeige werden berücksichtigt, Eingabefelder sind auf dem Handy so groß, dass iOS nicht hineinzoomt; Zoomen mit zwei Fingern bleibt erlaubt.

Ohne Verbindung zeigt DesignThix die Seiten, die du schon geöffnet hattest, als **Kopie** mit Hinweis („Du siehst den Stand vom …“). Schriften, Medien und Vorschaubilder bleiben im Zwischenspeicher, damit
Designs auch offline gezeichnet werden und eine schon einmal ausgeführte Serienausgabe wieder gedruckt werden kann. Geändert wird nur mit Verbindung; der **Designer** behält deine ungespeicherten
Änderungen als Entwurf im Browser und speichert, sobald die Verbindung zurück ist (hat in der Zwischenzeit jemand anderes gespeichert, fragt er, ob du deine Fassung als Kopie sichern willst). Kommt die
Verbindung zurück, lädt die Seite sich selbst neu, damit nichts Altes stehen bleibt. Beim Abmelden werden die gemerkten Seiten gelöscht.

## Schriften, Symbole und Lizenzen

- **Schriften** (33 Familien, nichts wird aus dem Internet geladen): Montserrat, Bebas Neue, Oswald, Kaushan Script, Caveat, Playfair Display, Lora, Open Sans, Pacifico, Source Sans 3, Great Vibes, Parisienne, Allura, Dancing Script,
  Cormorant Garamond, Libre Baskerville, Cinzel, Fredoka, Baloo 2, Patrick Hand, Gochi Hand, Abril Fatface, Anton, Righteous, Amatic SC, Inter, Nunito, Josefin Sans, Raleway, Poppins und IBM Plex Mono unter der
  **SIL Open Font License 1.1**; Roboto Slab und Permanent Marker unter der **Apache License 2.0**. Die Lizenztexte liegen in `src/DesignThix/wwwroot/fonts/LICENSES`.
- **Symbole der Oberfläche:** [Lucide](https://lucide.dev) (ISC-Lizenz), über MatUi. Dieselben Lucide-Symbole (rund 1 900) gibt es im Designer; weitere Sätze kommen nur über den Katalog *Icons (Iconify)* und behalten ihre Lizenz (siehe *Kataloge*).
- **Flaggen und Siegel** sind eigene Zeichnungen (keine geschützten Zeichen; die echten Bio- oder g.t.S.-Siegel lädst du selbst unter *Medien* hoch).
- Das Aussehen kommt von **MatUi** aus MatDesign. DesignThix selbst: Matthias Schmoldt.

## Entwickeln

Voraussetzungen: .NET 10 SDK, Docker, Node.js (für die Browser-Prüfungen).

```bash
dotnet build DesignThix.slnx                  # 0 Fehler, 0 Warnungen
dotnet test DesignThix.slnx                   # Unit-Tests; die Integrationstests brauchen PostgreSQL:
DESIGNTHIX_TEST_DB="Host=localhost;Port=3045;Username=designthix;Password=designthix" dotnet test DesignThix.slnx
dotnet tool restore                           # einmal (dotnet-ef)
dotnet ef migrations add <Name> -p src/DesignThix -s src/DesignThix -o Data/Migrations
./scripts/redeploy.ps1                        # Image bauen und den lokalen Stack starten (-Clean: leere Datenbank)
```

- **Browser-Prüfungen** (`tests/e2e`, Playwright mit dem installierten Edge): `cd tests/e2e && npm install && node run-all.js http://localhost:3043` startet Engine, PWA, Demo, Start, Projekte, Vorlagen, Designer, Canva-Editor, Editor-Inhalte,
  Serienausgabe, Teilen, Kommentare, Teams und KI nacheinander (rund zehn Minuten). Jede einzeln und was sie prüft: [tests/e2e/README.md](tests/e2e/README.md). Sie legen ihre Konten selbst an, wenn die Datenbank leer ist.
- **Vorlagen** sind Quelltext: `tools/templates/<NNN>-<slug>.js` (Hilfen in `tools/templates/dsl.js`), `node tools/templates-build.js` schreibt daraus die Dateien in `src/DesignThix/Demo/templates`, `node tools/templates-sheet.js` zeichnet Übersichtsbögen zum Ansehen und `node tools/templates-lint.js` misst jede Seite in Originalgröße (Schrift ab 7 pt, Sicherheitsrand, Überlappungen). Die Anleitung steht in [docs/PLAN-TEMPLATES.md](docs/PLAN-TEMPLATES.md) und [CLAUDE.md](CLAUDE.md).
- **Screenshots** dieser Seite: `node tests/e2e/screens.js` gegen eine frische, leere Datenbank (`./scripts/redeploy.ps1 -Clean`, oder die App mit `dotnet run` gegen eine neue Datenbank, siehe [CLAUDE.md](CLAUDE.md)), Ergebnis in `docs/images`; die KI-Bilder entstehen mit einem Schein-Anbieter (`fake-ai.js`), nie mit einem echten, und `--ai-only` macht nur diese drei.
- **MatUi** (Oberflächen-Bibliothek) wird nie in `src/DesignThix/wwwroot/ui` geändert, sondern aus MatDesign geholt: `./scripts/sync-matui.ps1`, geprüft mit `./scripts/check-matui.ps1`.
- Aufbau, Regeln und Stolpersteine für die Arbeit am Code: [CLAUDE.md](CLAUDE.md). Die Baupläne: [docs/PLAN-PLATFORM.md](docs/PLAN-PLATFORM.md) (Plan 3: Plattform, Teams, Teilen), [docs/PLAN-CANVA.md](docs/PLAN-CANVA.md) (Plan 2: Canva-Stil, Dokumentformat 2), [docs/PLAN.md](docs/PLAN.md) (Plan 1: Produkt, Architektur); der Editor: [docs/EDITOR.md](docs/EDITOR.md).

**Technik:** ASP.NET Core 10 (Razor Pages), Entity Framework Core 10, PostgreSQL 17, MatUi aus MatDesign, GitHub Actions (Build, Tests gegen PostgreSQL, Multi-Arch-Image nach GHCR).

## Lizenz und Autor

Matthias Schmoldt. Die mitgelieferten Schriften stehen unter ihren eigenen Lizenzen (siehe oben), die Symbole unter der ISC-Lizenz von Lucide.
