using System.Text.Json;
using System.Text.RegularExpressions;
using MatCan.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace MatCan.Logic;

/// <summary>The three brand fonts: the family names (they exist in the Fonts) or null.</summary>
public sealed class BrandFonts
{
    public string? Heading { get; set; }

    public string? Subheading { get; set; }

    public string? Body { get; set; }
}

/// <summary>The brand kit as it is kept in <c>Space.BrandJson</c> (one JSON per area): colours (#rrggbb), the fonts, and the asset keys of the logos.</summary>
public sealed class BrandKit
{
    public List<string> Colors { get; set; } = [];

    public BrandFonts Fonts { get; set; } = new();

    public List<string> Logos { get; set; } = [];
}

/// <summary>The brand kit with what the pages need to show it: the logos as assets (key, name, address, size).</summary>
public sealed record BrandView(BrandKit Kit, IReadOnlyList<AssetRow> LogoAssets, long SpaceId);

/// <summary>
/// The brand kit (Marke): colours, fonts and logos that every design of an area can use. One per area (<c>Space.BrandJson</c>; the personal area when none is asked for): at most 40 colours, three
/// fonts (a family the area can use, or none) and at most 20 logos (keys of images the person may see). Every member of the area reads it; the owner of a personal area and the owners and admins of a team change it.
/// </summary>
public static partial class BrandLogic
{
    public const int MaxColors = 40;
    public const int MaxLogos = 20;

    [GeneratedRegex("^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$", RegexOptions.CultureInvariant)]
    private static partial Regex ColourPattern();

    /// <summary>A colour as #rrggbb in lower case (#rgb is spelled out); null when it is no colour.</summary>
    public static string? NormalizeColor(string? text)
    {
        var t = (text ?? "").Trim();
        if (!ColourPattern().IsMatch(t))
        {
            return null;
        }

        t = t.ToLowerInvariant();
        return t.Length == 4 ? $"#{t[1]}{t[1]}{t[2]}{t[2]}{t[3]}{t[3]}" : t;
    }

    private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);

    /// <summary>The area a kit belongs to: the one asked for (the person must be a member) or their personal area.</summary>
    private static async Task<long> SpaceAsync(Biz biz, long? spaceId, SpaceRole min)
    {
        biz.RequireSignedIn();
        var space = spaceId ?? await biz.PersonalSpaceIdAsync();
        await Access.RequireSpaceRole(biz, space, min);
        return space;
    }

    /// <summary>The brand kit of an area as saved, cleaned: what is no longer valid (a deleted font, a deleted logo) is left out.</summary>
    public static async Task<BrandView> GetAsync(Biz biz, long? spaceId = null)
    {
        var space = await SpaceAsync(biz, spaceId, SpaceRole.Viewer);
        var json = await biz.Db.Space.AsNoTracking().Where(s => s.Id == space).Select(s => s.BrandJson).FirstOrDefaultAsync() ?? "{}";
        BrandKit saved;
        try
        {
            saved = JsonSerializer.Deserialize<BrandKit>(json, Web) ?? new BrandKit();
        }
        catch (JsonException)
        {
            saved = new BrandKit();
        }

        var families = await FamiliesAsync(biz, space);
        string? Font(string? family) => FindFamily(families, family);

        var kit = new BrandKit
        {
            Colors = [.. (saved.Colors ?? []).Select(NormalizeColor).OfType<string>().Distinct(StringComparer.Ordinal).Take(MaxColors)],
            Fonts = new BrandFonts { Heading = Font(saved.Fonts?.Heading), Subheading = Font(saved.Fonts?.Subheading), Body = Font(saved.Fonts?.Body) },
        };

        var wanted = (saved.Logos ?? []).Select(AssetLogic.NormalizeKey).OfType<string>().Distinct(StringComparer.Ordinal).Take(MaxLogos).ToList();
        var logos = wanted.Count == 0 ? [] : await AssetLogic.Query(biz).Where(a => wanted.Contains(a.Key)).ToListAsync();
        kit.Logos = [.. wanted.Where(k => logos.Any(a => a.Key == k))];
        return new BrandView(kit, [.. kit.Logos.Select(k => logos.First(a => a.Key == k))], space);
    }

    /// <summary>
    /// Saves the brand kit. Refused with a message (nothing is saved) when a colour is not #rgb or #rrggbb, there are more than 40 colours or 20 logos, a font family does not
    /// exist or a logo key is not an asset. Designers and administrators.
    /// </summary>
    public static async Task<BrandView> SaveAsync(Biz biz, BrandKit input, long? spaceId = null)
    {
        var space = await SpaceAsync(biz, spaceId, SpaceRole.Admin);
        var colors = new List<string>();
        foreach (var raw in input.Colors ?? [])
        {
            var color = NormalizeColor(raw) ?? throw new BizException($"„{Clip(raw, 20)}“ ist keine Farbe. Erlaubt sind Hex-Werte wie #1fb3d6.", "Colors");
            if (!colors.Contains(color))
            {
                colors.Add(color);
            }
        }

        if (colors.Count > MaxColors)
        {
            throw new BizException($"Die Marke hat höchstens {MaxColors} Farben.", "Colors");
        }

        var families = await FamiliesAsync(biz, space);
        string? Font(string? family, string label)
        {
            var name = (family ?? "").Trim();
            if (name.Length == 0)
            {
                return null;
            }

            return FindFamily(families, name) ?? throw new BizException($"Die Schrift „{Clip(name, 60)}“ für {label} gibt es nicht.", "Fonts");
        }

        var fonts = new BrandFonts
        {
            Heading = Font(input.Fonts?.Heading, "die Überschrift"),
            Subheading = Font(input.Fonts?.Subheading, "die Zwischenüberschrift"),
            Body = Font(input.Fonts?.Body, "den Fließtext"),
        };

        var logos = new List<string>();
        foreach (var raw in input.Logos ?? [])
        {
            var key = AssetLogic.NormalizeKey(raw) ?? throw new BizException($"„{Clip(raw, 40)}“ ist kein gültiger Medien-Schlüssel.", "Logos");
            if (!logos.Contains(key))
            {
                logos.Add(key);
            }
        }

        if (logos.Count > MaxLogos)
        {
            throw new BizException($"Die Marke hat höchstens {MaxLogos} Logos.", "Logos");
        }

        if (logos.Count > 0)
        {
            var existing = await Access.Visible<Asset>(biz).AsNoTracking().Where(a => logos.Contains(a.Key)).Select(a => a.Key).ToListAsync();
            var missing = logos.Where(k => !existing.Contains(k)).ToList();
            if (missing.Count > 0)
            {
                throw new BizException($"Das Medium „{missing[0]}“ gibt es nicht.", "Logos");
            }
        }

        var kit = new BrandKit { Colors = colors, Fonts = fonts, Logos = logos };
        var row = await biz.Db.Space.FirstAsync(s => s.Id == space);
        row.BrandJson = JsonSerializer.Serialize(kit, Web);
        await biz.Db.SaveChangesAsync();
        await biz.Log.LogAsync("Marke geändert", nameof(Space), space, $"{colors.Count} Farben, {logos.Count} Logos");
        return await GetAsync(biz, space);
    }

    /// <summary>The font families the person may use, each once, by name; with <paramref name="spaceId"/> only the built-in ones and those of that area.</summary>
    public static async Task<List<string>> FamiliesAsync(Biz biz, long? spaceId = null)
    {
        biz.RequireSignedIn();
        var fonts = Access.VisibleInSpaces<Font>(biz).AsNoTracking();
        if (spaceId is { } space)
        {
            fonts = fonts.Where(f => f.SpaceId == null || f.SpaceId == space);
        }

        return await fonts.Select(f => f.Family).Distinct().OrderBy(f => f).ToListAsync();
    }

    private static string? FindFamily(IEnumerable<string> families, string? family)
    {
        var name = (family ?? "").Trim();
        return name.Length == 0 ? null : families.FirstOrDefault(f => string.Equals(f, name, StringComparison.OrdinalIgnoreCase));
    }

    private static string Clip(string? text, int max)
    {
        var t = (text ?? "").Trim();
        return t.Length > max ? t[..max] : t;
    }
}
