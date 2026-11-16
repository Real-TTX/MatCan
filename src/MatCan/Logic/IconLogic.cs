using System.Text.Json;
using System.Text.RegularExpressions;
using MatCan.Core.Media;
using MatCan.Data;
using Microsoft.EntityFrameworkCore;

namespace MatCan.Logic;

/// <summary>An icon of a catalogue as the editor, the run page and the public view draw it: the checked body and the grid it is drawn on.</summary>
public sealed record IconView(string Body, int Width, int Height);

/// <summary>
/// The icons of catalogues (docs/PLAN-CATALOGS.md section 5): a design names one as <c>prefix:name</c>, its body was stored when somebody imported it, and everything that draws a design (the editor, the
/// thumbnails, the run page, the public view) gets the bodies from here. Icons are platform-wide: the body is tiny, public, and licensed for everybody, so there is nothing to hide per person; what
/// matters is that only bodies that passed the allowlist are ever stored or served (and they are checked again when they are read).
/// </summary>
public static partial class IconLogic
{
    /// <summary>How many icons one request may ask for.</summary>
    public const int MaxNames = 100;

    [GeneratedRegex("^[a-z0-9]+(?:-[a-z0-9]+)*:[a-z0-9]+(?:-[a-z0-9]+)*$")]
    private static partial Regex NamePattern();

    /// <summary>Whether this is the name of an icon of a catalogue (<c>prefix:name</c>, lower case, at most 40 + 64 characters).</summary>
    public static bool IsCatalogName(string? name) => name is { Length: > 2 and <= 105 } && NamePattern().IsMatch(name) && name.IndexOf(':') <= 40 && name.Length - name.IndexOf(':') - 1 <= 64;

    /// <summary>The bodies of the named icons the library has; names that are no catalogue names or are not stored are left out. Each body is checked again.</summary>
    public static async Task<Dictionary<string, IconView>> ResolveAsync(DtDbContext db, IEnumerable<string?> names)
    {
        var wanted = names.Where(IsCatalogName).Select(n => n!).Distinct(StringComparer.Ordinal).Take(MaxNames).ToList();
        var result = new Dictionary<string, IconView>(StringComparer.Ordinal);
        if (wanted.Count == 0)
        {
            return result;
        }

        var rows = await db.IconBody.AsNoTracking().Where(i => wanted.Contains(i.Prefix + ":" + i.Name)).Select(i => new { i.Prefix, i.Name, i.Body, i.Width, i.Height }).ToListAsync();
        foreach (var row in rows)
        {
            var parsed = IconBodies.Parse(row.Body, row.Width, row.Height, out _);
            if (parsed is not null)
            {
                result[row.Prefix + ":" + row.Name] = new IconView(parsed.Markup, parsed.Width, parsed.Height);
            }
        }

        return result;
    }

    /// <summary>The names of the catalogue icons a document uses (any page, any group level).</summary>
    public static List<string> NamesIn(string documentJson)
    {
        var names = new HashSet<string>(StringComparer.Ordinal);
        try
        {
            using var doc = JsonDocument.Parse(documentJson);
            if (doc.RootElement.ValueKind == JsonValueKind.Object && doc.RootElement.TryGetProperty("pages", out var pages) && pages.ValueKind == JsonValueKind.Array)
            {
                foreach (var page in pages.EnumerateArray())
                {
                    if (page.ValueKind == JsonValueKind.Object && page.TryGetProperty("elements", out var elements))
                    {
                        Collect(elements, names, 0);
                    }
                }
            }
        }
        catch (JsonException)
        {
        }

        return [.. names];
    }

    private static void Collect(JsonElement list, HashSet<string> names, int depth)
    {
        if (list.ValueKind != JsonValueKind.Array || depth > 6)
        {
            return;
        }

        foreach (var e in list.EnumerateArray())
        {
            if (e.ValueKind != JsonValueKind.Object)
            {
                continue;
            }

            if (e.TryGetProperty("type", out var type) && type.ValueKind == JsonValueKind.String)
            {
                if (type.GetString() == "icon" && e.TryGetProperty("icon", out var icon) && icon.ValueKind == JsonValueKind.String && IsCatalogName(icon.GetString()))
                {
                    names.Add(icon.GetString()!);
                }
                else if (type.GetString() == "group" && e.TryGetProperty("children", out var children))
                {
                    Collect(children, names, depth + 1);
                }
            }
        }
    }

    /// <summary>The bodies of the catalogue icons a document uses (for the payload of a run and of a public link).</summary>
    public static async Task<Dictionary<string, IconView>> ForDocumentAsync(DtDbContext db, string documentJson)
        => await ResolveAsync(db, NamesIn(documentJson));
}
