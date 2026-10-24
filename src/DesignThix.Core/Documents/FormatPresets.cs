namespace DesignThix.Core.Documents;

/// <summary>A page size to start a design from. <see cref="Unit"/> is <c>mm</c> or <c>px</c>.</summary>
public sealed record FormatPreset(string Key, string Name, string Group, double Width, double Height, string Unit);

/// <summary>The sizes offered in "Neues Design" (paper, labels and cards, screen, posters).</summary>
public static class FormatPresets
{
    public const string Paper = "Papier";
    public const string Labels = "Etiketten und Karten";
    public const string Screen = "Bildschirm";
    public const string Posters = "Plakate";

    public static IReadOnlyList<FormatPreset> All { get; } =
    [
        new("a4-portrait", "A4 Hochformat", Paper, 210, 297, "mm"),
        new("a4-landscape", "A4 Querformat", Paper, 297, 210, "mm"),
        new("a5-portrait", "A5 Hochformat", Paper, 148, 210, "mm"),
        new("a5-landscape", "A5 Querformat", Paper, 210, 148, "mm"),
        new("a6-portrait", "A6 Hochformat", Paper, 105, 148, "mm"),
        new("a6-landscape", "A6 Querformat", Paper, 148, 105, "mm"),
        new("din-lang-landscape", "DIN lang Querformat", Paper, 210, 99, "mm"),
        new("din-lang-portrait", "DIN lang Hochformat", Paper, 99, 210, "mm"),
        new("business-card", "Visitenkarte 85 × 55 mm", Labels, 85, 55, "mm"),
        new("label-150x100", "Etikett 150 × 100 mm", Labels, 150, 100, "mm"),
        new("label-100x70", "Etikett 100 × 70 mm", Labels, 100, 70, "mm"),
        new("label-70x50", "Etikett 70 × 50 mm", Labels, 70, 50, "mm"),
        new("label-58x40", "Etikett 58 × 40 mm", Labels, 58, 40, "mm"),
        new("shelf-strip", "Regalstreifen 100 × 30 mm", Labels, 100, 30, "mm"),
        new("square-100", "Quadrat 100 × 100 mm", Labels, 100, 100, "mm"),
        new("instagram-post", "Instagram-Post 1080 × 1080 px", Screen, 1080, 1080, "px"),
        new("instagram-story", "Story 1080 × 1920 px", Screen, 1080, 1920, "px"),
        new("poster-a3-portrait", "Plakat A3 Hochformat", Posters, 297, 420, "mm"),
        new("poster-a3-landscape", "Plakat A3 Querformat", Posters, 420, 297, "mm"),
    ];

    public static string[] Units => ["mm", "px"];

    public static FormatPreset? Find(string? key)
        => string.IsNullOrEmpty(key) ? null : All.FirstOrDefault(p => string.Equals(p.Key, key, StringComparison.OrdinalIgnoreCase));
}
