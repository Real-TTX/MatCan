namespace DesignThix.Core.Documents;

/// <summary>
/// A page size to start a design from. <see cref="Unit"/> is <c>mm</c> or <c>px</c>. <see cref="Title"/> is the short name on the tile of the start page ("Preisschild"),
/// <see cref="Icon"/> the icon of the tile: a name of the MatUi sprite ("tag") or of the app's own sprite with the prefix <c>dt:</c> ("dt:tags").
/// A folded card (plan 6) has <see cref="Fold"/> <c>vertical</c> or <c>horizontal</c>: the size is the one of the OPEN sheet (the fold line runs through the middle), the page is made twice (outside, inside)
/// and <see cref="Note"/> says the folded size ("gefaltet 105 × 148 mm"). <see cref="PageNames"/> names the pages of a preset that starts with more than one (a postcard: front, back).
/// </summary>
public sealed record FormatPreset(string Key, string Name, string Group, double Width, double Height, string Unit, string Title = "", string Icon = "layers", string Fold = "none", string Note = "", IReadOnlyList<string>? PageNames = null)
{
    /// <summary>The short name for tiles; the full name when none is set.</summary>
    public string ShortName => string.IsNullOrEmpty(Title) ? Name : Title;
}

/// <summary>The sizes offered in "Neues Design" (paper, labels and cards, screen, posters) and the tiles of the start page.</summary>
public static class FormatPresets
{
    public const string Paper = "Papier";
    public const string Labels = "Etiketten und Karten";
    public const string Screen = "Bildschirm";
    public const string Posters = "Plakate";
    public const string Cards = "Klappkarten und Postkarten";
    public const string Print = "Drucksachen";

    /// <summary>The key of the tile "Eigene Größe": it has no size, the person types one.</summary>
    public const string CustomKey = "custom";

    private static readonly string[] PostcardPages = ["Vorderseite", "Rückseite"];

    public static IReadOnlyList<FormatPreset> All { get; } =
    [
        new("a4-portrait", "A4 Hochformat", Paper, 210, 297, "mm", "A4 Hochformat", "file-text"),
        new("a4-landscape", "A4 Querformat", Paper, 297, 210, "mm", "A4 Querformat", "file-text"),
        new("a5-portrait", "A5 Hochformat", Paper, 148, 210, "mm", "Flyer A5", "file-text"),
        new("a5-landscape", "A5 Querformat", Paper, 210, 148, "mm", "A5 Querformat", "file-text"),
        new("a6-portrait", "A6 Hochformat", Paper, 105, 148, "mm", "A6 Hochformat", "file"),
        new("a6-landscape", "A6 Querformat", Paper, 148, 105, "mm", "Karte A6", "heart"),
        new("din-lang-landscape", "DIN lang Querformat", Paper, 210, 99, "mm", "DIN lang Querformat", "mail"),
        new("din-lang-portrait", "DIN lang Hochformat", Paper, 99, 210, "mm", "DIN lang Hochformat", "mail"),
        new("business-card", "Visitenkarte 85 × 55 mm", Labels, 85, 55, "mm", "Visitenkarte", "user-circle"),
        new("price-tag", "Preisschild 150 × 100 mm", Labels, 150, 100, "mm", "Preisschild", "tag"),
        new("label-150x100", "Etikett 150 × 100 mm", Labels, 150, 100, "mm", "Etikett 150 × 100", "dt:tags"),
        new("label-100x70", "Etikett 100 × 70 mm", Labels, 100, 70, "mm", "Etikett", "dt:tags"),
        new("label-70x50", "Etikett 70 × 50 mm", Labels, 70, 50, "mm", "Etikett 70 × 50", "dt:tags"),
        new("label-58x40", "Etikett 58 × 40 mm", Labels, 58, 40, "mm", "Etikett 58 × 40", "dt:tags"),
        new("name-badge", "Namensschild 90 × 55 mm", Labels, 90, 55, "mm", "Namensschild", "user-circle"),
        new("bookmark", "Lesezeichen 50 × 150 mm", Labels, 50, 150, "mm", "Lesezeichen", "dt:rectangle-horizontal"),
        new("label-round-60", "Etikett rund 60 mm", Labels, 60, 60, "mm", "Etikett rund", "circle"),
        new("shelf-strip", "Regalstreifen 100 × 30 mm", Labels, 100, 30, "mm", "Regaletikett", "dt:rectangle-horizontal"),
        new("square-100", "Quadrat 100 × 100 mm", Labels, 100, 100, "mm", "Quadrat", "dt:square"),
        new("card-a6-portrait", "Klappkarte A6 hoch", Cards, 210, 148, "mm", "Klappkarte A6 hoch", "heart", "vertical", "gefaltet 105 × 148 mm"),
        new("card-a6-landscape", "Klappkarte A6 quer", Cards, 148, 210, "mm", "Klappkarte A6 quer", "heart", "horizontal", "gefaltet 148 × 105 mm"),
        new("card-square-145", "Klappkarte quadratisch 14,5 cm", Cards, 290, 145, "mm", "Klappkarte quadratisch", "heart", "vertical", "gefaltet 145 × 145 mm"),
        new("card-dl-portrait", "Klappkarte DIN lang hoch", Cards, 198, 210, "mm", "Klappkarte DIN lang", "mail", "vertical", "gefaltet 99 × 210 mm"),
        new("table-card", "Tischkarte (gefaltet) 90 × 50 mm", Cards, 90, 100, "mm", "Tischkarte", "user-circle", "horizontal", "gefaltet 90 × 50 mm"),
        new("postcard-a6-landscape", "Postkarte A6 quer", Cards, 148, 105, "mm", "Postkarte A6 quer", "mail", PageNames: PostcardPages),
        new("postcard-a6-portrait", "Postkarte A6 hoch", Cards, 105, 148, "mm", "Postkarte A6 hoch", "mail", PageNames: PostcardPages),
        new("letterhead-a4", "Briefpapier A4", Print, 210, 297, "mm", "Briefpapier", "file-text"),
        new("certificate-a4", "Urkunde A4 quer", Print, 297, 210, "mm", "Urkunde", "star"),
        new("voucher-dl", "Gutschein DIN lang", Print, 210, 99, "mm", "Gutschein", "tag"),
        new("menu-dl", "Menükarte DIN lang", Print, 99, 210, "mm", "Menükarte", "list"),
        new("table-number", "Tischnummer A6", Print, 105, 148, "mm", "Tischnummer", "dt:square"),
        new("tearoff-a4", "Aushang A4 mit Abreißstreifen", Print, 210, 297, "mm", "Aushang mit Abreißstreifen", "file"),
        new("instagram-post", "Instagram-Post 1080 × 1080 px", Screen, 1080, 1080, "px", "Instagram-Beitrag", "image"),
        new("instagram-story", "Story 1080 × 1920 px", Screen, 1080, 1920, "px", "Instagram-Story", "smartphone"),
        new("facebook-cover", "Facebook-Titelbild 1640 × 624 px", Screen, 1640, 624, "px", "Facebook-Titelbild", "monitor"),
        new("presentation", "Präsentation 1920 × 1080 px", Screen, 1920, 1080, "px", "Präsentation", "monitor"),
        new("poster-a3-portrait", "Plakat A3 Hochformat", Posters, 297, 420, "mm", "Poster A3", "image"),
        new("poster-a2-portrait", "Plakat A2 Hochformat", Posters, 420, 594, "mm", "Poster A2", "image"),
        new("poster-a3-landscape", "Plakat A3 Querformat", Posters, 420, 297, "mm", "Plakat A3 Querformat", "image"),
    ];

    /// <summary>The keys of the tiles of the start page, in order (docs/PLAN-CANVA.md section 1.1); the last tile is "Eigene Größe" (<see cref="CustomKey"/>).</summary>
    public static IReadOnlyList<string> TileKeys { get; } =
        ["price-tag", "label-100x70", "shelf-strip", "business-card", "a5-portrait", "poster-a3-portrait", "a6-landscape", "instagram-post", "instagram-story", "presentation"];

    /// <summary>The presets of the tiles, in the order of <see cref="TileKeys"/>.</summary>
    public static IReadOnlyList<FormatPreset> Tiles { get; } = [.. TileKeys.Select(key => All.First(p => p.Key == key))];

    /// <summary>The order of the groups in the list "Mehr Formate": cards first, then print products, paper, labels, screen, posters.</summary>
    public static int GroupOrder(string group)
    {
        var order = new[] { Cards, Print, Paper, Labels, Screen, Posters };
        var i = Array.IndexOf(order, group);
        return i < 0 ? order.Length : i;
    }

    public static string[] Units => ["mm", "px"];

    /// <summary>The names of the two pages of a folded card: the outside (back and front side by side or above each other, as the sheet is printed) and the inside.</summary>
    public static IReadOnlyList<string> FoldPageNames(string fold)
        => fold switch
        {
            "vertical" => ["Außen (Rückseite | Vorderseite)", "Innen"],
            "horizontal" => ["Außen (Rückseite oben | Vorderseite unten)", "Innen"],
            _ => [],
        };

    /// <summary>
    /// The empty document a preset starts with: its size, and for a folded card the fold and the two named pages, for a postcard the named pages (front, back).
    /// </summary>
    public static DesignDocument NewDocument(FormatPreset preset)
    {
        var document = DocumentValidator.Create(preset.Width, preset.Height, preset.Unit);
        var names = preset.PageNames ?? (preset.Fold == "none" ? [] : FoldPageNames(preset.Fold));
        var pages = names.Count == 0 ? document.Pages : [.. names.Select((name, i) => DocumentValidator.EmptyPage("p" + (i + 1)) with { Name = name })];
        return document with { Pages = pages, Fold = preset.Fold };
    }

    public static FormatPreset? Find(string? key)
        => string.IsNullOrEmpty(key) ? null : All.FirstOrDefault(p => string.Equals(p.Key, key, StringComparison.OrdinalIgnoreCase));

    public static bool IsTile(string key) => TileKeys.Contains(key, StringComparer.OrdinalIgnoreCase);
}
