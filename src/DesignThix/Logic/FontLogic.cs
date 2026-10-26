using System.Text;
using System.Text.RegularExpressions;
using DesignThix.Core.Media;
using DesignThix.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace DesignThix.Logic;

/// <summary>A font as the lists, the style sheet and the pickers need it: everything but the bytes.</summary>
public sealed record FontRow
{
    public long Id { get; init; }

    public string Family { get; init; } = "";

    public string Weight { get; init; } = "400";

    public string Style { get; init; } = "normal";

    public string Format { get; init; } = "ttf";

    public long SizeBytes { get; init; }

    public string ContentHash { get; init; } = "";

    public bool IsBuiltIn { get; init; }

    /// <summary>The area of the font; null for the built-in fonts.</summary>
    public long? SpaceId { get; init; }

    public string License { get; init; } = "";

    public string? Source { get; init; }

    public DateTime UpdateDate { get; init; }

    /// <summary>The address of the file; id and hash make it unique and immutable.</summary>
    public string Url => FontLogic.Url(Id, ContentHash, Format);
}

/// <summary>The outcome of one uploaded font file.</summary>
public sealed record FontUploadResult(string FileName, FontRow? Font, string? Error);

/// <summary>Fonts: the bundled free fonts and the ones people upload. They are served by the app; nothing is loaded from the internet.</summary>
public static partial class FontLogic
{
    public const long MaxFontBytes = 8 * 1024 * 1024;

    /// <summary>How much of the content hash an address of a font must carry (the addresses made by <see cref="Url"/> carry 12): the hash is the capability, so a short one could be guessed.</summary>
    public const int MinHashPrefix = 12;

    public static string Url(long id, string hash, string format) => $"/fonts/{id}-{hash[..Math.Min(12, hash.Length)]}.{format}";

    public static string CssFormat(string format) => format switch
    {
        "otf" => "opentype",
        "woff" => "woff",
        "woff2" => "woff2",
        _ => "truetype",
    };

    /// <summary>The fonts the person may use: the built-in ones and those of their areas.</summary>
    public static IQueryable<FontRow> Query(Biz biz)
    {
        biz.RequireSignedIn();
        return Access.VisibleInSpaces<Font>(biz).AsNoTracking().Select(f => new FontRow { Id = f.Id, Family = f.Family, Weight = f.Weight, Style = f.Style, Format = f.Format, SizeBytes = f.SizeBytes, ContentHash = f.ContentHash, IsBuiltIn = f.IsBuiltIn, SpaceId = f.SpaceId, License = f.License, Source = f.Source, UpdateDate = f.UpdateDate });
    }

    public static Task<FontRow?> GetAsync(Biz biz, long id) => Query(biz).FirstOrDefaultAsync(f => f.Id == id);

    /// <summary>
    /// The fonts the person may use, by family: the built-in ones and those of their areas. With <paramref name="designId"/> (the person must be allowed to view the design) also those of the
    /// design's area, and where a family of that area has the same weight and style as another, the design's area wins (the editor shows the design as its authors see it).
    /// </summary>
    public static async Task<List<FontRow>> AllAsync(Biz biz, long? designId = null)
    {
        var fonts = await Query(biz).OrderBy(f => f.Family).ThenBy(f => f.Style).ThenBy(f => f.Weight).ToListAsync();
        if (designId is not { } design)
        {
            return fonts;
        }

        await Access.RequireAsync(biz, ItemKind.Design, design, AccessLevel.View);
        var spaceId = await biz.Db.Design.AsNoTracking().Where(d => d.Id == design).Select(d => d.SpaceId).FirstOrDefaultAsync();
        if (spaceId is not { } space || fonts.Any(f => f.SpaceId == space))
        {
            return spaceId is { } own ? DesignFirst(fonts, own) : fonts;
        }

        var extra = await biz.Db.Font.AsNoTracking().Where(f => f.SpaceId == space)
            .Select(f => new FontRow { Id = f.Id, Family = f.Family, Weight = f.Weight, Style = f.Style, Format = f.Format, SizeBytes = f.SizeBytes, ContentHash = f.ContentHash, IsBuiltIn = f.IsBuiltIn, SpaceId = f.SpaceId, License = f.License, Source = f.Source, UpdateDate = f.UpdateDate })
            .ToListAsync();
        return DesignFirst([.. fonts, .. extra], space);
    }

    private static List<FontRow> DesignFirst(List<FontRow> fonts, long designSpace)
    {
        var own = fonts.Where(f => f.SpaceId == designSpace).Select(f => (f.Family.ToLowerInvariant(), f.Weight, f.Style)).ToHashSet();
        return [.. fonts.Where(f => f.SpaceId == designSpace || !own.Contains((f.Family.ToLowerInvariant(), f.Weight, f.Style))).OrderBy(f => f.Family).ThenBy(f => f.Style).ThenBy(f => f.Weight)];
    }

    /// <summary>
    /// The bytes of a font file; null when the font is gone or the hash does not fit. The address with its hash is a capability (it serves signed in or not, it is only handed to people who may
    /// use the font); without a matching hash nothing is served.
    /// </summary>
    public static async Task<(byte[] Bytes, string Format, string Hash)?> ContentAsync(Biz biz, long id, string? hashPrefix)
    {
        var font = await biz.Db.Font.AsNoTracking().Where(f => f.Id == id).Select(f => new { f.Bytes, f.Format, f.ContentHash }).FirstOrDefaultAsync();
        if (font is null || string.IsNullOrEmpty(hashPrefix) || hashPrefix.Length < MinHashPrefix || !font.ContentHash.StartsWith(hashPrefix, StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        return (font.Bytes, font.Format, font.ContentHash);
    }

    // ------------------------------------------------------------------------------------------------ the style sheet

    /// <summary>The CSS name of a family made safe for a quoted string: no quotes, backslashes, braces, line breaks.</summary>
    public static string CssName(string family) => CssUnsafeRegex().Replace(family, " ").Trim();

    /// <summary>The <c>@font-face</c> rule of every font: <c>font-display: block</c> (a label must not flash in another font), a weight range for variable fonts.</summary>
    public static string FontFaceCss(IEnumerable<FontRow> fonts)
    {
        var sb = new StringBuilder("/* DesignThix: the fonts of the library (generated). */\n");
        foreach (var f in fonts)
        {
            sb.Append("@font-face{font-family:'").Append(CssName(f.Family)).Append("';src:url('").Append(f.Url).Append("') format('").Append(CssFormat(f.Format))
              .Append("');font-weight:").Append(f.Weight).Append(";font-style:").Append(f.Style).Append(";font-display:block}\n");
        }

        return sb.ToString();
    }

    // ------------------------------------------------------------------------------------------------ upload and change

    private static readonly string[] FontFormats = ["ttf", "otf", "woff", "woff2"];

    /// <summary>Family, weight and style as far as the file name tells: "Roboto-BoldItalic.ttf" is Roboto, 700, italic.</summary>
    public static (string Family, string Weight, string Style) GuessFromFileName(string fileName)
    {
        var name = Path.GetFileNameWithoutExtension(fileName).Replace('_', '-');
        var style = Regex.IsMatch(name, "italic|oblique", RegexOptions.IgnoreCase) ? "italic" : "normal";
        var weight = "400";
        var variable = Regex.IsMatch(name, @"variable|\[wght\]", RegexOptions.IgnoreCase);
        foreach (var (word, w) in new (string, string)[] { ("thin", "100"), ("extralight", "200"), ("ultralight", "200"), ("light", "300"), ("medium", "500"), ("semibold", "600"), ("demibold", "600"), ("extrabold", "800"), ("black", "900"), ("heavy", "900"), ("bold", "700") })
        {
            if (name.Contains(word, StringComparison.OrdinalIgnoreCase))
            {
                weight = w;
                break;
            }
        }

        if (variable)
        {
            weight = "100 900";
        }

        var family = Regex.Replace(name, @"\[.*?\]|variable|italic|oblique|regular|thin|extralight|ultralight|light|medium|semibold|demibold|extrabold|black|heavy|bold|-+$", "", RegexOptions.IgnoreCase);
        family = Regex.Replace(family, "([a-z])([A-Z])", "$1 $2").Replace('-', ' ').Trim();
        return (family.Length == 0 ? "Schrift" : family, weight, style);
    }

    public static bool IsValidWeight(string? weight) => weight is not null && WeightRegex().IsMatch(weight);

    /// <summary>Uploads a font into the area asked for (the person must be allowed to write there; by default their personal area); the storage of the area must have room.</summary>
    public static async Task<FontUploadResult> UploadAsync(Biz biz, string fileName, byte[] bytes, string? license, long? spaceId = null)
    {
        biz.RequireSignedIn();
        var space = await Access.WritableSpaceAsync(biz, spaceId);
        if (bytes.LongLength > MaxFontBytes)
        {
            return new FontUploadResult(fileName, null, $"Die Schrift ist zu groß (höchstens {Services.Fmt.FileSize(MaxFontBytes)}).");
        }

        var sniffed = FileSniffer.Sniff(bytes);
        if (!sniffed.IsFont)
        {
            return new FontUploadResult(fileName, null, "Das ist keine Schriftdatei. Erlaubt sind TTF, OTF, WOFF und WOFF2.");
        }

        var info = FontInfo.Read(bytes);
        var guess = GuessFromFileName(fileName);
        var family = CssName(info?.Family ?? guess.Family);
        var weight = info is { Weight: > 0 } ? (info.IsVariable ? "100 900" : info.Weight.ToString()) : guess.Weight;
        var style = info is not null ? (info.Italic ? "italic" : "normal") : guess.Style;
        var hash = AssetLogic.Sha256Hex(bytes);
        if (await biz.Db.Font.AnyAsync(f => f.ContentHash == hash && (f.SpaceId == space || f.SpaceId == null)))
        {
            return new FontUploadResult(fileName, null, "Diese Schriftdatei gibt es schon.");
        }

        try
        {
            await StorageLogic.RequireRoomAsync(biz, space, bytes.LongLength);
        }
        catch (BizException ex)
        {
            return new FontUploadResult(fileName, null, ex.Message);
        }

        var font = new Font
        {
            Family = family.Length > 100 ? family[..100] : family,
            Weight = IsValidWeight(weight) ? weight : "400",
            Style = style,
            Format = sniffed.Extension,
            Bytes = bytes,
            ContentHash = hash,
            SizeBytes = bytes.LongLength,
            License = Clip(license, 100),
            SpaceId = space,
        };
        biz.Db.Font.Add(font);
        await biz.Db.SaveChangesAsync();
        await biz.Log.LogAsync("Schrift hochgeladen", nameof(Font), font.Id, $"{font.Family} {font.Weight} {font.Style}");
        return new FontUploadResult(fileName, await GetAsync(biz, font.Id), null);
    }

    /// <summary>Whether the person may change or delete the font (their own area; a built-in font an administrator).</summary>
    public static async Task<bool> CanManageAsync(Biz biz, long id) => await Access.VisibleInSpaces<Font>(biz, AccessLevel.Manage).AnyAsync(f => f.Id == id);

    /// <summary>The font, tracked, when the person may manage it (their own area; for a built-in font an administrator): 404 when it is not visible, 403 when it is only usable.</summary>
    private static async Task<Font> ManagedAsync(Biz biz, long id)
    {
        if (!await Query(biz).AnyAsync(f => f.Id == id))
        {
            throw new NotFoundException();
        }

        if (!await Access.VisibleInSpaces<Font>(biz, AccessLevel.Manage).AnyAsync(f => f.Id == id))
        {
            throw new ForbiddenException("Diese Schrift darfst du nicht ändern.");
        }

        return await biz.Db.Font.FirstOrDefaultAsync(f => f.Id == id) ?? throw new NotFoundException();
    }

    private static string Clip(string? text, int max)
    {
        var t = (text ?? "").Trim();
        return t.Length > max ? t[..max] : t;
    }

    public sealed record FontInput(string Family, string Weight, string Style, string? License);

    public static async Task<FontRow> UpdateAsync(Biz biz, long id, FontInput input)
    {
        var font = await ManagedAsync(biz, id);
        var family = CssName(input.Family ?? "");
        if (family.Length == 0)
        {
            throw new BizException("Bitte gib den Namen der Schriftfamilie ein.", "Input.Family");
        }

        var weight = (input.Weight ?? "").Trim();
        if (!IsValidWeight(weight))
        {
            throw new BizException("Das Gewicht ist eine Zahl wie 400 oder 700, bei einer variablen Schrift ein Bereich wie 100 900.", "Input.Weight");
        }

        if (input.Style is not ("normal" or "italic"))
        {
            throw new BizException("Der Stil ist normal oder kursiv.", "Input.Style");
        }

        font.Family = family.Length > 100 ? family[..100] : family;
        font.Weight = weight;
        font.Style = input.Style;
        font.License = Clip(input.License, 100);
        await biz.Db.SaveChangesAsync();
        await biz.Log.LogAsync("Schrift geändert", nameof(Font), font.Id, $"{font.Family} {font.Weight} {font.Style}");
        return (await GetAsync(biz, id))!;
    }

    public static async Task DeleteAsync(Biz biz, long id)
    {
        var font = await ManagedAsync(biz, id);
        font.Bytes = [];
        font.SizeBytes = 0;
        biz.Db.Font.Remove(font);
        await biz.Db.SaveChangesAsync();
        await biz.Log.LogAsync("Schrift gelöscht", nameof(Font), font.Id, $"{font.Family} {font.Weight} {font.Style}");
    }

    [GeneratedRegex("[\"'\\\\{};<>\\u0000-\\u001f]+")]
    private static partial Regex CssUnsafeRegex();

    [GeneratedRegex(@"^[1-9]00( [1-9]00)?$")]
    private static partial Regex WeightRegex();
}
