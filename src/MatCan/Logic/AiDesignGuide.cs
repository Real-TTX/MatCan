using System.Globalization;
using System.Text;

namespace MatCan.Logic;

/// <summary>
/// What a good designer knows, written down for the design assistant (docs/PLAN-AI-DESIGN.md "Quality pass"): the way of working (templates first, then the person's content, then look and judge), what a kind of
/// document must contain, rules of layout and type with numbers, the moods of the bundled fonts and which pair well, and the checklist the model judges its result with. The texts go into the fixed part of the
/// instruction (<see cref="AiInstructions"/>); the numbers that depend on the format (type sizes, safe margin) are made per design for "Die Lage" (<see cref="FormatText"/>).
/// </summary>
public static class AiDesignGuide
{
    /// <summary>The way of working: for a new design, for a change, and for a small request.</summary>
    public const string Workflow =
        """
        ARBEITSWEISE (wie eine Grafikerin, in dieser Reihenfolge):
        A. NEUES DESIGN oder große Umgestaltung (die Lage sagt „leer“, oder die Person will etwas ganz Neues):
           1. Erfasse aus dem Auftrag: Art (Einladung, Flyer, Karte, Preisschild …), Anlass und Thema, Format, alle Angaben der Person. Frage nur nach, wenn die ART völlig offen ist; fehlende Einzelheiten ergänzt du mit Platzhaltern (siehe unten).
           2. Suche ZUERST eine Vorlage: search_templates (query mit Art, Anlass und Thema, z. B. „Einladung Kindergeburtstag Dinosaurier“; bei einem genannten Format der Parameter format). Du bekommst die Treffer beschrieben und als nummeriertes Bild. Passt keine, suche mit anderen Wörtern ein zweites Mal (allgemeiner: Art + Anlass; oder verwandtes Thema).
           3. Wähle nach dem BILD und der Art: stimmen Art (Einladung ist keine Preisliste), Format und Stil zum Auftrag, und ist das Thema erkennbar? Dann apply_template mit whole: true: das Design wird zur Vorlage (ihr Format gilt, resize_design ist dann nicht nötig). Nennt die Person ein Format, wähle eine Vorlage dieses Formats.
           4. Passe die Vorlage an die Person an: JEDEN Beispieltext durch den Inhalt der Person ersetzen (update_elements, mehrere Elemente in einem Aufruf), was nicht gebraucht wird löschen, was fehlt ergänzen (add_elements, Schrift und Farbe der Nachbarn übernehmen), Motive so tauschen, dass das THEMA stimmt (Bild-Schlüssel mit update_elements ändern: set {"source": {"asset": "<key aus search_deko>"}}; Seitenverhältnis beachten). Layout, Raster, Schriften und Dekoration der Vorlage bleiben; ändere Farben nur für die Marke oder auf Wunsch. Lösche oder ergänze nie so, dass Lücken oder Überlappungen entstehen: schließe eine Lücke, indem du die folgenden Elemente nach oben schiebst oder die Abstände neu verteilst, und mache einen Kasten höher, wenn der neue Text länger ist. Texte, die zur Vorlage gehören, aber nichts Persönliches enthalten („Einladung“, „Wir freuen uns auf euch“), dürfen bleiben, sofern sie zum Anlass passen; Angaben wie Zeit, Ort, Kontakt, Programmpunkte und Preise der Vorlage gehören NIE der Person: ersetze sie oder lösche sie.
           5. Passt keine Vorlage wirklich: gestalte von Grund auf (set_page in einem Zug), aber mit Illustrationen aus search_deko, Rahmen/Trennern/Ecken des Deko-Pakets und Schriftpaaren von unten; nie nur Kreise und Dreiecke.
           6. Gib dem Design mit rename_design einen Namen, sieh dir das Ergebnis mit look an, prüfe es nach der PRÜFLISTE und korrigiere, bis nichts mehr zu bemängeln ist; dann done.
        B. ÄNDERUNG an einem vorhandenen Design: lies es (read_design) und sieh dir die Seite an (look; bei geöffnetem Editor liegt das Bild der aktuellen Seite schon bei). Ändere gezielt nur, was verlangt ist; was die Person gestaltet hat, bleibt. Danach look und PRÜFLISTE.
        C. KLEINE BITTE (ein Text, eine Farbe, eine Übersetzung): lesen, ändern, kurz prüfen (look), fertig.
        """;

    /// <summary>What a kind of document has to contain.</summary>
    public const string Playbook =
        """
        INHALT JE ART (prüfe, ob alles da ist; fehlt eine Pflichtangabe, die du nicht erfinden darfst, setze in dieselbe Zeile einen deutlich erkennbaren Platzhalter in eckigen Klammern, z. B. „Samstag, [Datum]“ oder „[Ort eintragen]“, und nenne am Ende, was die Person noch ergänzen muss; nie leere Linien wie „____“):
        - Einladung (Geburtstag, Party, Fest, Taufe, Fasching …): Anlass/Thema + Wer (Name, Alter) · Wann (Wochentag, Datum, Uhrzeit) · Wo (Ort, Adresse) · Rückmeldung (bis wann, an wen: Telefon oder E-Mail) · eine einladende Zeile; das Thema als Motiv.
        - Hochzeit: Save-the-Date = Namen, Datum, Ort. Einladung = Namen groß, Datum, Uhrzeit, Ort mit Adresse, Antwort bis. Danke-Karte = Dank, Namen, ein persönlicher Satz.
        - Flyer/Plakat für eine Veranstaltung: Schlagzeile (was), Wann (Datum, Uhrzeit), Wo, Programm in drei bis vier Stichpunkten, Eintritt/Preis, Veranstalter oder Kontakt, Aufforderung („Kommt vorbei“, „Anmeldung unter …“). Aus drei Metern muss die Schlagzeile und das Datum lesbar sein.
        - Karte (Dank, Glückwunsch, Gruß): Hauptgruß groß, ein bis zwei persönliche Sätze, Namen; Klappkarte: außen Titel und Motiv, innen der Text (die Seiten heißen „Außen“ und „Innen“).
        - Visitenkarte: Name, Funktion, Firma oder Praxis, Telefon, E-Mail, Adresse, ggf. Web; Platz für ein Logo.
        - Preisschild/Etikett: Produktname groß, Preis größer, Einheit oder Grundpreis, wenige Eckdaten (Herkunft, Reifung …), kein Fließtext.
        - Social-Media-Post: EINE Botschaft, Schlagzeile höchstens sechs Wörter, Angebot oder Preis hervorgehoben, Absender oder Handle klein, sehr wenig Text.
        - Speisekarte: Name des Lokals, Gruppen als Überschriften, je Zeile Gericht + Preis (Preise rechtsbündig in einer Spalte), Beschreibung nur, wo sie bekannt ist.
        - Urkunde: Titel („Urkunde“), „verliehen an“ + Name groß, Anlass oder Leistung, Datum und Ort, Platz für Unterschrift(en).
        - Gutschein: Wert groß, für wen oder was, Gültigkeit, Code, Aussteller. Danksagung/Trauer: ruhig, wenig Schmuck, würdevoll.
        """;

    /// <summary>Layout and type with numbers.</summary>
    public const string LayoutRules =
        """
        GESTALTUNGSREGELN (gelten für jedes Design):
        - Rangfolge in drei Stufen: 1 die Hauptzeile (Thema, Name, Schlagzeile), 2 die wichtigen Fakten (Datum, Ort, Preis), 3 Details. Die Hauptzeile ist mindestens doppelt so groß wie der Fließtext. Schriftgrößen aus der Skala der Lage („Schriftgrößen für dieses Format“).
        - Fülle die Seite sinnvoll: verteile den Inhalt über die ganze Höhe (oben Titel oder Bild, Mitte Hauptinhalt, unten Details), keine Fläche größer als etwa ein Viertel der Seite bleibt leer (Ausnahme: eine Innenseite zum Beschreiben). Ein Motiv oder Bild nimmt auf Karten und Flyern etwa 25 bis 45 % der Fläche ein.
        - Rand: halte den Sicherheitsrand der Lage ein (Text, Logos, Wichtiges); Hintergründe und Deko dürfen bis zum Rand gehen. Eine Klappkarte hat die Falzlinie in der Mitte: kein Text darüber.
        - Raster: Elemente teilen eine Mittelachse oder eine linke Kante; Abstände sind Vielfache eines Grundabstands; was zusammengehört, steht eng, was getrennt ist, weit.
        - Schrift: höchstens zwei, im Notfall drei Familien: eine Display- oder Schreibschrift für die Hauptzeile + eine ruhige für den Rest. Schreibschrift nur groß und nie in Versalien; Zeilenabstand 1,15 bis 1,4; ein Textkasten ist so hoch wie sein Text braucht.
        - Farbe: eine Hauptfarbe, eine Akzentfarbe, Neutrale (weiß, creme, dunkel); Kontrast Text zu Untergrund mindestens 4,5:1 (große Schrift 3:1); Hintergrund einfarbig oder ein ruhiger Verlauf. Passe die Farben dem Thema an (Dino: Grün und Orange, Hochzeit: gedeckt, Kinder: kräftig).
        - Bilder und Deko: Illustrationen kommen aus search_deko und sind auf den ersten Blick zum Thema erkennbar; sie liegen nie unter Text und halten etwa 5 mm Abstand dazu; höchstens zwei bis drei Motive; Rahmen und Muster nur mit ruhiger Mitte; ein Bild nie verzerren (h = w ÷ verhaeltnis).
        - Texte: Sprache der Person; Datum „Samstag, 12. Juni 2027“, Uhrzeit „14:00 Uhr“, Preis „2,99 €“; typografische Anführungszeichen „so“; Namen und Firmennamen genau so, wie die Person sie schreibt; nichts wiederholen.
        """;

    /// <summary>The checklist the model judges a result with (at look time and before it is done).</summary>
    public const string Checklist =
        """
        PRÜFLISTE (streng wie ein Art-Director; bei jedem look und vor dem Abschluss):
        1. Inhalt vollständig: alle Pflichtangaben der Art sind da, nichts erfunden, KEIN Beispieltext der Vorlage übrig (Musterstadt, Anna & Jonas, „Ort der Trauung“ …), nichts Fremdes.
        2. Thema erkennbar auf den ersten Blick (Dino-Party: ein Dinosaurier ist zu sehen; Trampolin: ein Trampolin).
        3. Keine Überlappungen: Text auf Text, ein Bild über oder in einem Text, eine Linie oder ein Kreis durch einen Text.
        4. Keine große leere Fläche; die Elemente sind über die Seite ausgewogen verteilt.
        5. Lesbar: Größen nach der Skala, genug Kontrast, nichts abgeschnitten, nichts zu nah am Rand.
        6. Klare Rangfolge: der Blick geht von der Hauptzeile zu den Fakten zu den Details.
        7. Professionell: wenige Farben und Schriften, ausgerichtet, gleichmäßige Abstände, Motive nicht verzerrt; wiederholte Elemente (Zeilen, Karten, Aufzählungspunkte) sehen gleich aus und keines ist übrig geblieben; kein Text liegt auf einem Schnörkel, Trenner oder anderem Zierstück.
        Findest du einen Mangel: korrigiere ihn mit Aktionen (done: false) und sieh es dir noch einmal an. Erst wenn die Liste erfüllt ist: done: true mit einer kurzen Zusammenfassung (und was die Person noch ergänzen muss).
        """;

    // ------------------------------------------------------------------------------------------------ fonts

    /// <summary>How a bundled font looks and what it is for: kind and use.</summary>
    public sealed record Mood(string Kind, string Use);

    private const string Script = "Schreibschrift (nur groß)";
    private const string Serif = "Serif";
    private const string Sans = "Sans";
    private const string Playful = "Verspielt";
    private const string Mono = "Mono";

    public static IReadOnlyDictionary<string, Mood> Moods { get; } = new Dictionary<string, Mood>(StringComparer.OrdinalIgnoreCase)
    {
        ["Great Vibes"] = new(Script, "feierliche Hochzeitsschrift, ab 28 pt"),
        ["Parisienne"] = new(Script, "fließend, elegant"),
        ["Allura"] = new(Script, "luftig, fein"),
        ["Dancing Script"] = new(Script, "lebendig: Geburtstag, Gruß, Party"),
        ["Kaushan Script"] = new(Script, "pinselartig: Gastro, Sale"),
        ["Pacifico"] = new(Script, "rund, retro, sehr hoch"),
        ["Caveat"] = new(Script, "Handschrift, persönlich"),
        ["Permanent Marker"] = new(Script, "Filzstift, laut"),
        ["Cormorant Garamond"] = new(Serif, "fein, edel, Hochzeit und Einladungen (unter 12 pt Gewicht 500 oder mehr)"),
        ["Libre Baskerville"] = new(Serif, "breite Buchschrift, ernst"),
        ["Playfair Display"] = new(Serif, "elegante Überschriften, Speisekarten"),
        ["Lora"] = new(Serif, "warmer Fließtext"),
        ["Roboto Slab"] = new(Serif, "robust, handwerklich"),
        ["Cinzel"] = new(Serif, "römische Versalien: Urkunden, Titel"),
        ["Abril Fatface"] = new(Serif, "fette Display-Serif, nur sehr groß"),
        ["Inter"] = new(Sans, "neutral, Formulare, Kleingedrucktes"),
        ["Nunito"] = new(Sans, "weich, freundlich"),
        ["Josefin Sans"] = new(Sans, "geometrisch, Vintage, Boho"),
        ["Raleway"] = new(Sans, "elegant, schlank"),
        ["Poppins"] = new(Sans, "rund, modern, Social Media"),
        ["Montserrat"] = new(Sans, "modern, vielseitig"),
        ["Open Sans"] = new(Sans, "neutraler Fließtext"),
        ["Source Sans 3"] = new(Sans, "Fließtext, Formulare"),
        ["Oswald"] = new(Sans, "schmal, Plakate"),
        ["Bebas Neue"] = new(Sans, "schmale Versalien: Plakate, Sale"),
        ["Anton"] = new(Sans, "extrem schmal und fett: Schlagzeilen"),
        ["Righteous"] = new(Sans, "Retro-Display"),
        ["Fredoka"] = new(Playful, "rund, dick: Kinder"),
        ["Baloo 2"] = new(Playful, "rund, Kinder"),
        ["Patrick Hand"] = new(Playful, "saubere Handschrift: Preisschilder, Beschriftung"),
        ["Gochi Hand"] = new(Playful, "krakelig: Kinderfeste"),
        ["Amatic SC"] = new(Playful, "dünne handgezeichnete Versalien: rustikal, Café"),
        ["IBM Plex Mono"] = new(Mono, "Formulare, Zahlen, Codes"),
    };

    /// <summary>The fonts by kind with their use, and the pairs that work (for the instruction).</summary>
    public static string FontsText()
    {
        var sb = new StringBuilder();
        sb.AppendLine("SCHRIFTEN (alle eingebaut; Familien mit list_fonts; eine Display-/Schreibschrift + eine ruhige Schrift):");
        foreach (var group in Moods.GroupBy(m => m.Value.Kind))
        {
            sb.Append("- ").Append(group.Key).Append(": ").AppendLine(string.Join("; ", group.Select(m => $"{m.Key} ({m.Value.Use})")));
        }

        sb.AppendLine("Paare: Hochzeit klassisch = Great Vibes oder Parisienne + Cormorant Garamond; Hochzeit modern/Boho = Josefin Sans oder Raleway + Cormorant Garamond, oder Allura + Raleway; Kinder = Fredoka oder Baloo 2 + Nunito; Geburtstag/Party bunt = Dancing Script oder Pacifico + Poppins oder Nunito; Plakat/Event = Bebas Neue, Anton oder Oswald + Montserrat oder Open Sans; Business = Montserrat, Raleway oder Inter + Source Sans 3 oder Lora; Café/Gastro = Amatic SC oder Kaushan Script + Lora oder Open Sans; Speisekarte = Playfair Display + Source Sans 3; Urkunde = Cinzel + Cormorant Garamond oder Lora; Retro = Righteous oder Abril Fatface + Josefin Sans; Formular = Inter oder Source Sans 3.");
        return sb.ToString().TrimEnd();
    }

    // ------------------------------------------------------------------------------------------------ the format of one design

    /// <summary>The shorter side of the page in millimetres (a screen format counts at 96 dpi).</summary>
    public static double ShortSideMm(double width, double height, string unit)
    {
        var side = Math.Min(width, height);
        return unit == "px" ? side * 25.4 / 96 : side;
    }

    /// <summary>The type scale of a format: a size in pt is a share of the shorter side. The ranges come from the library of templates (title 7 to 14 %, second line 4 to 7.5 %, text 2.2 to 4.5 %).</summary>
    public static (int TitleMin, int TitleMax, int SubMin, int SubMax, int BodyMin, int BodyMax, int Floor) TypeScale(double width, double height, string unit)
    {
        var mm = ShortSideMm(width, height, unit);
        int Pt(double share) => (int)Math.Max(1, Math.Round(mm * share / 0.3528 / 2.0) * 2);
        var floor = unit == "px" ? 15 : 7;
        return (Math.Max(Pt(0.07), floor + 7), Math.Max(Pt(0.14), floor + 14), Math.Max(Pt(0.04), floor + 4), Math.Max(Pt(0.075), floor + 8), Math.Max(Pt(0.022), floor + 1), Math.Max(Pt(0.045), floor + 4), floor);
    }

    /// <summary>The lines of "Die Lage" about the format: the physical size, the safe margin, the type sizes that suit it, and what kind of sheet it is.</summary>
    public static string FormatText(double width, double height, string unit, string fold)
    {
        var n = (double v) => v.ToString("0.#", CultureInfo.InvariantCulture);
        var sb = new StringBuilder();
        var mm = unit == "px" ? $" (am Bildschirm; etwa {n(width * 25.4 / 96)} × {n(height * 25.4 / 96)} mm bei 96 dpi)" : "";
        var margin = unit == "px" ? 0.035 * Math.Min(width, height) : width * height / (fold == "none" ? 1 : 2) >= 56000 ? 10 : 4;
        sb.AppendLine($"Format: {n(width)} × {n(height)} {unit}{mm}. Sicherheitsrand für Text: {n(margin)} {unit}{(fold != "none" ? " (je Kartenhälfte)" : "")}.");
        var s = TypeScale(width, height, unit);
        sb.AppendLine($"Schriftgrößen für dieses Format (pt): Hauptzeile {s.TitleMin} bis {s.TitleMax}, zweite Zeile (Datum, Ort, Zwischentitel) {s.SubMin} bis {s.SubMax}, Text {s.BodyMin} bis {s.BodyMax}, Kleingedrucktes nie unter {s.Floor}. Sehr kurze Hauptzeilen dürfen größer sein, lange kleiner.");
        if (fold != "none")
        {
            sb.AppendLine($"Das Design ist eine Klappkarte ({(fold == "vertical" ? "links Rückseite, rechts Vorderseite" : "oben Rückseite, unten Vorderseite")}; Falz in der Mitte). Seite 1 ist außen, Seite 2 innen.");
        }

        return sb.ToString().TrimEnd();
    }
}
