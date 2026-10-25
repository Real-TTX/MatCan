namespace DesignThix.Core.Documents;

/// <summary>
/// A page size to start a design from. <see cref="Unit"/> is <c>mm</c> or <c>px</c>. <see cref="Title"/> is the short name on the tile of the start page ("Preisschild"),
/// <see cref="Icon"/> the icon of the tile: a name of the MatUi sprite ("tag") or of the app's own sprite with the prefix <c>dt:</c> ("dt:tags").
/// </summary>
public sealed record FormatPreset(string Key, string Name, string Group, double Width, double Height, string Unit, string Title = "", string Icon = "layers")
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

    /// <summary>The key of the tile "Eigene Größe": it has no size, the person types one.</summary>
    public const string CustomKey = "custom";

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
        new("shelf-strip", "Regalstreifen 100 × 30 mm", Labels, 100, 30, "mm", "Regaletikett", "dt:rectangle-horizontal"),
        new("square-100", "Quadrat 100 × 100 mm", Labels, 100, 100, "mm", "Quadrat", "dt:square"),
        new("instagram-post", "Instagram-Post 1080 × 1080 px", Screen, 1080, 1080, "px", "Instagram-Beitrag", "image"),
        new("instagram-story", "Story 1080 × 1920 px", Screen, 1080, 1920, "px", "Instagram-Story", "smartphone"),
        new("presentation", "Präsentation 1920 × 1080 px", Screen, 1920, 1080, "px", "Präsentation", "monitor"),
        new("poster-a3-portrait", "Plakat A3 Hochformat", Posters, 297, 420, "mm", "Poster A3", "image"),
        new("poster-a3-landscape", "Plakat A3 Querformat", Posters, 420, 297, "mm", "Plakat A3 Querformat", "image"),
    ];

    /// <summary>The keys of the tiles of the start page, in order (docs/PLAN-CANVA.md section 1.1); the last tile is "Eigene Größe" (<see cref="CustomKey"/>).</summary>
    public static IReadOnlyList<string> TileKeys { get; } =
        ["price-tag", "label-100x70", "shelf-strip", "business-card", "a5-portrait", "poster-a3-portrait", "a6-landscape", "instagram-post", "instagram-story", "presentation"];

    /// <summary>The presets of the tiles, in the order of <see cref="TileKeys"/>.</summary>
    public static IReadOnlyList<FormatPreset> Tiles { get; } = [.. TileKeys.Select(key => All.First(p => p.Key == key))];

    public static string[] Units => ["mm", "px"];

    public static FormatPreset? Find(string? key)
        => string.IsNullOrEmpty(key) ? null : All.FirstOrDefault(p => string.Equals(p.Key, key, StringComparison.OrdinalIgnoreCase));

    public static bool IsTile(string key) => TileKeys.Contains(key, StringComparer.OrdinalIgnoreCase);
}
