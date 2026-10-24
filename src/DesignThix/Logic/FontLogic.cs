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

    public static string Url(long id, string hash, string format) => $"/fonts/{id}-{hash[..Math.Min(12, hash.Length)]}.{format}";

    public static string CssFormat(string format) => format switch
    {
        "otf" => "opentype",
        "woff" => "woff",
        "woff2" => "woff2",
        _ => "truetype",
    };

    public static IQueryable<FontRow> Query(Biz biz)
    {
        biz.RequireSignedIn();
        return biz.Db.Font.AsNoTracking().Select(f => new FontRow { Id = f.Id, Family = f.Family, Weight = f.Weight, Style = f.Style, Format = f.Format, SizeBytes = f.SizeBytes, ContentHash = f.ContentHash, IsBuiltIn = f.IsBuiltIn, License = f.License, Source = f.Source, UpdateDate = f.UpdateDate });
    }

    public static Task<FontRow?> GetAsync(Biz biz, long id) => Query(biz).FirstOrDefaultAsync(f => f.Id == id);

    public static async Task<List<FontRow>> AllAsync(Biz biz)
        => await Query(biz).OrderBy(f => f.Family).ThenBy(f => f.Style).ThenBy(f => f.Weight).ToListAsync();

    /// <summary>The bytes of a font file; null when the font is gone.</summary>
    public static async Task<(byte[] Bytes, string Format, string Hash)?> ContentAsync(Biz biz, long id)
    {
        biz.RequireSignedIn();
        var font = await biz.Db.Font.AsNoTracking().Where(f => f.Id == id).Select(f => new { f.Bytes, f.Format, f.ContentHash }).FirstOrDefaultAsync();
        return font is null ? null : (font.Bytes, font.Format, font.ContentHash);
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

    public static async Task<FontUploadResult> UploadAsync(Biz biz, string fileName, byte[] bytes, string? license)
    {
        biz.RequireDesigner();
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
        if (await biz.Db.Font.AnyAsync(f => f.ContentHash == hash))
        {
            return new FontUploadResult(fileName, null, "Diese Schriftdatei gibt es schon.");
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
        };
        biz.Db.Font.Add(font);
        await biz.Db.SaveChangesAsync();
        await biz.Log.LogAsync("Schrift hochgeladen", nameof(Font), font.Id, $"{font.Family} {font.Weight} {font.Style}");
        return new FontUploadResult(fileName, await GetAsync(biz, font.Id), null);
    }

    private static string Clip(string? text, int max)
    {
        var t = (text ?? "").Trim();
        return t.Length > max ? t[..max] : t;
    }

    public sealed record FontInput(string Family, string Weight, string Style, string? License);

    public static async Task<FontRow> UpdateAsync(Biz biz, long id, FontInput input)
    {
        biz.RequireDesigner();
        var font = await biz.Db.Font.FirstOrDefaultAsync(f => f.Id == id) ?? throw new BizException("Die Schrift gibt es nicht mehr.");
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
        biz.RequireDesigner();
        var font = await biz.Db.Font.FirstOrDefaultAsync(f => f.Id == id) ?? throw new BizException("Die Schrift gibt es nicht mehr.");
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
