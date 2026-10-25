using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Text.Unicode;

namespace DesignThix.Core.Documents;

/// <summary>An image that travels with an exported design: its key in the source installation, name, category and the file itself.</summary>
public sealed record PackageAsset(string Key, string Name, string Category, string ContentType, byte[] Bytes);

/// <summary>A font file that travels with an exported design (only fonts that are not built in): family, weight ("400" or "100 900"), style, file format and the file.</summary>
public sealed record PackageFont(string Family, string Weight, string Style, string Format, byte[] Bytes);

/// <summary>A design as an export file (<c>.dtx.json</c>) carries it: the normalised document, the images and the fonts it uses.</summary>
public sealed record DesignPackage(string Name, string? Category, string? Description, string DocumentJson, IReadOnlyList<PackageAsset> Assets, IReadOnlyList<PackageFont> Fonts);

/// <summary>The outcome of reading an export file: the package, or why it was refused (in German, for the person who chose the file).</summary>
public sealed record PackageResult(bool Ok, string? Error, DesignPackage? Package);

/// <summary>
/// The export format of a design: <c>{ "format": "designthix-design", "version": 2, "name", "category", "description", "document", "assets": [{ key, name, category,
/// contentType, base64 }], "fonts": [{ family, weight, style, format, base64 }] }</c>. Reading is strict about the frame (format, version, sizes, keys, base64) and
/// lets <see cref="DocumentValidator"/> judge the document; what the files are (image, font, SVG) is checked by the caller with <c>FileSniffer</c> and <c>SvgSafe</c>.
/// </summary>
public static partial class DesignPackageFormat
{
    public const string FormatName = "designthix-design";
    /// <summary>2 since designs have pages (document schema 2); files of version 1 (a document of schema 1) are read and upgraded.</summary>
    public const int Version = 2;

    /// <summary>The largest file the import accepts.</summary>
    public const long MaxFileBytes = 50L * 1024 * 1024;

    public const int MaxAssets = 500;
    public const int MaxFonts = 60;
    public const int MaxAssetBytes = 10 * 1024 * 1024;
    public const int MaxFontBytes = 8 * 1024 * 1024;

    private static readonly JavaScriptEncoder Encoder = JavaScriptEncoder.Create(UnicodeRanges.All);

    [GeneratedRegex("^[a-z0-9][a-z0-9_-]{0,63}$", RegexOptions.CultureInvariant)]
    private static partial Regex KeyPattern();

    [GeneratedRegex(@"^[1-9]00( [1-9]00)?$", RegexOptions.CultureInvariant)]
    private static partial Regex WeightPattern();

    // ------------------------------------------------------------------------------------------------ writing

    /// <summary>The file: indented JSON in UTF-8 (the base64 text of the files stays on one line each).</summary>
    public static byte[] Write(DesignPackage package)
    {
        using var stream = new MemoryStream();
        using (var w = new Utf8JsonWriter(stream, new JsonWriterOptions { Encoder = Encoder, Indented = true }))
        {
            w.WriteStartObject();
            w.WriteString("format", FormatName);
            w.WriteNumber("version", Version);
            w.WriteString("name", package.Name);
            if (package.Category is not null)
            {
                w.WriteString("category", package.Category);
            }
            else
            {
                w.WriteNull("category");
            }

            if (package.Description is not null)
            {
                w.WriteString("description", package.Description);
            }
            else
            {
                w.WriteNull("description");
            }

            w.WritePropertyName("document");
            using (var document = JsonDocument.Parse(package.DocumentJson))
            {
                document.RootElement.WriteTo(w);
            }

            w.WriteStartArray("assets");
            foreach (var asset in package.Assets)
            {
                w.WriteStartObject();
                w.WriteString("key", asset.Key);
                w.WriteString("name", asset.Name);
                w.WriteString("category", asset.Category);
                w.WriteString("contentType", asset.ContentType);
                w.WriteString("base64", Convert.ToBase64String(asset.Bytes));
                w.WriteEndObject();
            }

            w.WriteEndArray();
            w.WriteStartArray("fonts");
            foreach (var font in package.Fonts)
            {
                w.WriteStartObject();
                w.WriteString("family", font.Family);
                w.WriteString("weight", font.Weight);
                w.WriteString("style", font.Style);
                w.WriteString("format", font.Format);
                w.WriteString("base64", Convert.ToBase64String(font.Bytes));
                w.WriteEndObject();
            }

            w.WriteEndArray();
            w.WriteEndObject();
        }

        return stream.ToArray();
    }

    // ------------------------------------------------------------------------------------------------ reading

    private static PackageResult Failed(string message) => new(false, message, null);

    /// <summary>Reads an export file. Never throws: every problem is a German message in the result.</summary>
    public static PackageResult Read(ReadOnlySpan<byte> file)
    {
        if (file.Length == 0)
        {
            return Failed("Die Datei ist leer.");
        }

        if (file.Length > MaxFileBytes)
        {
            return Failed("Die Datei ist zu groß (höchstens 50 MB).");
        }

        // A byte order mark is allowed; the parser does not want it.
        if (file.StartsWith(new byte[] { 0xEF, 0xBB, 0xBF }))
        {
            file = file[3..];
        }

        JsonDocument parsed;
        try
        {
            parsed = JsonDocument.Parse(file.ToArray(), new JsonDocumentOptions { MaxDepth = 64 });
        }
        catch (JsonException)
        {
            return Failed("Das ist keine gültige Design-Datei (kein JSON).");
        }

        using (parsed)
        {
            return ReadRoot(parsed.RootElement);
        }
    }

    private static PackageResult ReadRoot(JsonElement root)
    {
        if (root.ValueKind != JsonValueKind.Object)
        {
            return Failed("Das ist keine gültige Design-Datei (ein JSON-Objekt wird erwartet).");
        }

        if (!TryString(root, "format", out var format) || format != FormatName)
        {
            return Failed("Das ist keine Design-Datei von DesignThix (das Feld „format“ fehlt oder ist falsch).");
        }

        if (!root.TryGetProperty("version", out var version) || version.ValueKind != JsonValueKind.Number || !version.TryGetInt32(out var number) || number < 1)
        {
            return Failed("Der Design-Datei fehlt die Versionsnummer.");
        }

        if (number > Version)
        {
            return Failed($"Die Datei hat die Version {number}. Diese Version von DesignThix kennt nur Version {Version}: bitte aktualisiere DesignThix.");
        }

        if (!root.TryGetProperty("document", out var documentElement) || documentElement.ValueKind != JsonValueKind.Object)
        {
            return Failed("Der Design-Datei fehlt das Dokument.");
        }

        var validated = DocumentValidator.Validate(documentElement.GetRawText());
        if (!validated.Ok || validated.Json is null)
        {
            return Failed(validated.Error ?? "Das Dokument in der Datei ist ungültig.");
        }

        var name = TryString(root, "name", out var rawName) ? Clip(rawName.Trim(), 200) : "";
        var category = TryString(root, "category", out var rawCategory) && rawCategory.Trim().Length > 0 ? Clip(rawCategory.Trim(), 80) : null;
        var description = TryString(root, "description", out var rawDescription) && rawDescription.Trim().Length > 0 ? Clip(rawDescription.Trim(), 2000) : null;

        var assets = new List<PackageAsset>();
        if (root.TryGetProperty("assets", out var assetList) && assetList.ValueKind != JsonValueKind.Null)
        {
            if (assetList.ValueKind != JsonValueKind.Array)
            {
                return Failed("Die Liste „assets“ in der Datei ist ungültig.");
            }

            if (assetList.GetArrayLength() > MaxAssets)
            {
                return Failed($"Die Datei enthält mehr als {MaxAssets} Medien.");
            }

            var seen = new HashSet<string>(StringComparer.Ordinal);
            foreach (var entry in assetList.EnumerateArray())
            {
                if (entry.ValueKind != JsonValueKind.Object || !TryString(entry, "key", out var rawKey))
                {
                    return Failed("Ein Medium in der Datei hat keinen Schlüssel.");
                }

                var key = rawKey.Trim().ToLowerInvariant();
                if (!KeyPattern().IsMatch(key))
                {
                    return Failed($"Der Schlüssel „{Clip(rawKey, 40)}“ eines Mediums in der Datei ist ungültig.");
                }

                if (!seen.Add(key))
                {
                    return Failed($"Das Medium „{key}“ steht zweimal in der Datei.");
                }

                var bytes = DecodeBase64(entry, MaxAssetBytes, out var problem);
                if (bytes is null)
                {
                    return Failed($"Das Medium „{key}“: {problem}");
                }

                var assetName = TryString(entry, "name", out var rawAssetName) && rawAssetName.Trim().Length > 0 ? Clip(rawAssetName.Trim(), 200) : key;
                var assetCategory = TryString(entry, "category", out var rawAssetCategory) && rawAssetCategory.Trim().Length > 0 ? Clip(rawAssetCategory.Trim(), 60) : "Uploads";
                var contentType = TryString(entry, "contentType", out var rawType) ? Clip(rawType.Trim(), 100) : "";
                assets.Add(new PackageAsset(key, assetName, assetCategory, contentType, bytes));
            }
        }

        var fonts = new List<PackageFont>();
        if (root.TryGetProperty("fonts", out var fontList) && fontList.ValueKind != JsonValueKind.Null)
        {
            if (fontList.ValueKind != JsonValueKind.Array)
            {
                return Failed("Die Liste „fonts“ in der Datei ist ungültig.");
            }

            if (fontList.GetArrayLength() > MaxFonts)
            {
                return Failed($"Die Datei enthält mehr als {MaxFonts} Schriften.");
            }

            foreach (var entry in fontList.EnumerateArray())
            {
                if (entry.ValueKind != JsonValueKind.Object || !TryString(entry, "family", out var rawFamily) || Placeholders.CleanFamily(rawFamily).Length == 0)
                {
                    return Failed("Eine Schrift in der Datei hat keinen Namen.");
                }

                var family = Placeholders.CleanFamily(rawFamily);
                var weight = TryString(entry, "weight", out var rawWeight) ? rawWeight.Trim() : "400";
                if (!WeightPattern().IsMatch(weight))
                {
                    return Failed($"Das Gewicht der Schrift „{family}“ ist ungültig.");
                }

                var style = TryString(entry, "style", out var rawStyle) && rawStyle.Trim() == "italic" ? "italic" : "normal";
                var bytes = DecodeBase64(entry, MaxFontBytes, out var problem);
                if (bytes is null)
                {
                    return Failed($"Die Schrift „{family}“: {problem}");
                }

                var fontFormat = TryString(entry, "format", out var rawFormat) ? Clip(rawFormat.Trim().ToLowerInvariant(), 8) : "";
                fonts.Add(new PackageFont(family, weight, style, fontFormat, bytes));
            }
        }

        return new PackageResult(true, null, new DesignPackage(name.Length == 0 ? "Importiertes Design" : name, category, description, validated.Json, assets, fonts));
    }

    private static byte[]? DecodeBase64(JsonElement entry, int maxBytes, out string problem)
    {
        problem = "";
        if (!TryString(entry, "base64", out var text) || text.Length == 0)
        {
            problem = "Es fehlt die Datei (base64).";
            return null;
        }

        // 4 characters make 3 bytes: refuse before decoding what could never fit.
        if (text.Length > maxBytes / 3 * 4 + 8)
        {
            problem = $"Die Datei ist größer als {maxBytes / 1024 / 1024} MB.";
            return null;
        }

        try
        {
            var bytes = Convert.FromBase64String(text);
            if (bytes.Length > maxBytes)
            {
                problem = $"Die Datei ist größer als {maxBytes / 1024 / 1024} MB.";
                return null;
            }

            return bytes;
        }
        catch (FormatException)
        {
            problem = "Der Inhalt (base64) ist beschädigt.";
            return null;
        }
    }

    private static bool TryString(JsonElement parent, string name, out string value)
    {
        if (parent.TryGetProperty(name, out var element) && element.ValueKind == JsonValueKind.String)
        {
            value = element.GetString() ?? "";
            return true;
        }

        value = "";
        return false;
    }

    private static string Clip(string text, int max) => text.Length > max ? text[..max] : text;

    // ------------------------------------------------------------------------------------------------ keys

    /// <summary>
    /// The document with the asset keys replaced as <paramref name="map"/> says (old key, case-insensitive, to new key): the backgrounds of all pages, image sources, the slots of
    /// image strips (also inside groups) and the sample values of image fields. Field keys and texts stay as they are. Run the result through <see cref="DocumentValidator.Normalize"/>.
    /// </summary>
    public static DesignDocument RewriteAssetKeys(DesignDocument document, IReadOnlyDictionary<string, string> map)
    {
        if (map.Count == 0)
        {
            return document;
        }

        var lookup = new Dictionary<string, string>(map, StringComparer.OrdinalIgnoreCase);
        string? Key(string? key) => key is not null && lookup.TryGetValue(key.Trim(), out var replacement) ? replacement : key;
        SourceDef? Source(SourceDef? source) => source?.Asset is { } asset ? source with { Asset = Key(asset) } : source;

        DesignElement Element(DesignElement element) => element switch
        {
            ImageElement image => image with { Source = Source(image.Source) },
            ImageStripElement strip => strip with { Items = [.. strip.Items.Select(Source)] },
            GroupElement group => group with { Children = [.. group.Children.Select(Element)] },
            _ => element,
        };

        var pages = document.Pages.Select(page => page with { Background = page.Background with { Asset = Key(page.Background.Asset) }, Elements = [.. page.Elements.Select(Element)] }).ToList();
        var fields = document.Fields.Select(field => field.Type == "image" ? field with { Sample = Key(field.Sample) ?? "" } : field).ToList();
        return document with { Pages = pages, Fields = fields };
    }

    /// <summary>The name of the file an export is saved as: the name of the design made safe, with the ending <c>.dtx.json</c>.</summary>
    public static string FileName(string designName)
    {
        var sb = new StringBuilder();
        foreach (var c in designName.Trim())
        {
            sb.Append(char.IsLetterOrDigit(c) || c is '-' or '_' or '.' or ' ' ? c : '-');
        }

        var name = Regex.Replace(sb.ToString().Trim(' ', '.', '-'), @"[ ]+", " ");
        if (name.Length > 80)
        {
            name = name[..80].Trim();
        }

        return (name.Length == 0 ? "design" : name) + ".dtx.json";
    }
}
