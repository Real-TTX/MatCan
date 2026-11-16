using System.Buffers.Binary;
using System.IO.Compression;
using System.Text.Json;
using System.Text.RegularExpressions;
using MatCan.Core.Media;
using Xunit;

namespace MatCan.Tests.Core;

/// <summary>The fonts shipped with the app (<c>wwwroot/fonts/fonts.json</c>): every entry is a real font with the right weight, an allowed licence, a licence text and the German letters.</summary>
public sealed partial class BundledFontTests
{
    private sealed record Entry(string Family, string File, string Weight, string Style, string? License, string? Source);

    private static readonly string[] AllowedLicences = ["OFL-1.1", "Apache-2.0"];

    /// <summary>The twelve families of the first version; everything else belongs to the limit of plan 6.</summary>
    private static readonly string[] OriginalFamilies =
    [
        "Montserrat", "Bebas Neue", "Oswald", "Kaushan Script", "Caveat", "Playfair Display", "Lora", "Open Sans", "Roboto Slab", "Pacifico", "Permanent Marker", "Source Sans 3",
    ];

    private const long NewFontsLimit = 5L * 1024 * 1024;

    // ä ö ü Ä Ö Ü ß € „ " " – (U+201E, U+201C, U+201D, U+2013)
    private static readonly int[] Needed = [0xE4, 0xF6, 0xFC, 0xC4, 0xD6, 0xDC, 0xDF, 0x20AC, 0x201E, 0x201C, 0x201D, 0x2013];

    private static string FontsFolder => Path.Combine(RepoFiles.WwwRoot(), "fonts");

    private static List<Entry> Load()
    {
        var json = File.ReadAllText(Path.Combine(FontsFolder, "fonts.json"));
        return JsonSerializer.Deserialize<List<Entry>>(json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true })!;
    }

    public static IEnumerable<object[]> Fonts() => Load().Select(e => new object[] { e.File });

    [GeneratedRegex(@"^\d{3}( \d{3})?$")]
    private static partial Regex WeightPattern();

    [Fact]
    public void The_list_is_complete_and_consistent()
    {
        var all = Load();
        Assert.True(all.Count >= 50, "fonts.json lists " + all.Count + " faces");
        Assert.Equal(all.Count, all.Select(e => e.File).Distinct(StringComparer.OrdinalIgnoreCase).Count());
        Assert.Equal(all.Count, all.Select(e => (e.Family.ToLowerInvariant(), e.Weight, e.Style)).Distinct().Count());
        var listed = all.Select(e => e.File).ToHashSet(StringComparer.OrdinalIgnoreCase);
        foreach (var file in Directory.EnumerateFiles(FontsFolder).Select(Path.GetFileName).Where(n => Regex.IsMatch(n!, @"\.(ttf|otf|woff2?)$", RegexOptions.IgnoreCase)))
        {
            Assert.True(listed.Contains(file!), file + " is a font file that fonts.json does not list");
        }

        foreach (var e in all)
        {
            Assert.True(WeightPattern().IsMatch(e.Weight), $"{e.Family}: weight '{e.Weight}'");
            Assert.True(e.Style is "normal" or "italic", $"{e.Family}: style '{e.Style}'");
            Assert.Contains(e.License ?? "", AllowedLicences);
            Assert.True(Uri.TryCreate(e.Source, UriKind.Absolute, out var source) && source.Scheme == Uri.UriSchemeHttps, $"{e.Family}: source '{e.Source}'");
            Assert.Matches("^[A-Za-z0-9._-]+$", e.File);
            var licence = Path.Combine(FontsFolder, "LICENSES", e.Family.Replace(' ', '-') + ".txt");
            Assert.True(File.Exists(licence), "licence text of " + e.Family);
            Assert.True(new FileInfo(licence).Length > 500, "licence text of " + e.Family);
            if (e.Weight.Contains(' '))
            {
                var parts = e.Weight.Split(' ').Select(int.Parse).ToArray();
                Assert.True(parts[0] < parts[1] && parts[1] <= 900, $"{e.Family}: range {e.Weight}");
            }
        }
    }

    [Theory]
    [MemberData(nameof(Fonts))]
    public void A_font_file_is_a_font_with_the_german_letters_and_the_declared_weight(string file)
    {
        var entry = Load().Single(e => e.File == file);
        var bytes = File.ReadAllBytes(Path.Combine(FontsFolder, file));
        var sniffed = FileSniffer.Sniff(bytes);
        Assert.True(sniffed.IsFont, file + " is not accepted as a font");
        Assert.Equal(Path.GetExtension(file).TrimStart('.'), sniffed.Extension);

        var font = SfntReader.Read(bytes);
        var cmap = SfntReader.Cmap(font.Tables["cmap"]);
        var missing = Needed.Where(c => !cmap.Contains(c)).Select(c => "U+" + c.ToString("X4")).ToList();
        Assert.True(missing.Count == 0, $"{file} lacks {string.Join(", ", missing)}");

        // the weight of fonts.json against the font: the wght axis of a variable font, usWeightClass of a static one
        var axis = font.Tables.TryGetValue("fvar", out var fvar) ? SfntReader.WeightAxis(fvar) : null;
        if (entry.Weight.Contains(' '))
        {
            Assert.NotNull(axis);
            var parts = entry.Weight.Split(' ').Select(int.Parse).ToArray();
            Assert.Equal(parts[0], (int)axis!.Value.Min);
            Assert.Equal(parts[1], Math.Min(900, (int)axis.Value.Max));
        }
        else
        {
            Assert.Null(axis);
            Assert.Equal(int.Parse(entry.Weight), BinaryPrimitives.ReadUInt16BigEndian(font.Tables["OS/2"].AsSpan(4)));
        }

        // the copyright of the name table is still in the file
        Assert.True(font.Tables.ContainsKey("name"));
    }

    [Fact]
    public void The_added_fonts_stay_under_the_size_limit()
    {
        var total = Load().Where(e => !OriginalFamilies.Contains(e.Family)).Sum(e => new FileInfo(Path.Combine(FontsFolder, e.File)).Length);
        Assert.True(total > 0);
        Assert.True(total < NewFontsLimit, $"the new fonts are {total / 1024.0 / 1024.0:F2} MB (limit {NewFontsLimit / 1024 / 1024} MB)");
    }

    [Fact]
    public void The_reader_finds_the_letters_in_a_woff2_and_in_a_ttf()
    {
        // one subset (WOFF2) and one unmodified file (TTF): the same Latin letters, and no Greek in a Latin font
        foreach (var file in new[] { "Inter-Variable.woff2", "Parisienne-Regular.ttf" })
        {
            var cmap = SfntReader.Cmap(SfntReader.Read(File.ReadAllBytes(Path.Combine(FontsFolder, file))).Tables["cmap"]);
            Assert.Contains(0x41, cmap);
            Assert.Contains(0xDF, cmap);
            Assert.DoesNotContain(0x0416, cmap);
        }
    }

    /// <summary>A small reader of the table directory and the cmap of TTF, OTF and WOFF2 files (test only; <c>FontInfo</c> reads names).</summary>
    private static class SfntReader
    {
        public sealed record Sfnt(Dictionary<string, byte[]> Tables);

        private static readonly string[] Woff2Tags =
        [
            "cmap", "head", "hhea", "hmtx", "maxp", "name", "OS/2", "post", "cvt ", "fpgm", "glyf", "loca", "prep", "CFF ", "VORG", "EBDT", "EBLC", "gasp", "hdmx", "kern", "LTSH", "PCLT", "VDMX", "vhea", "vmtx",
            "BASE", "GDEF", "GPOS", "GSUB", "EBSC", "JSTF", "MATH", "CBDT", "CBLC", "COLR", "CPAL", "SVG ", "sbix", "acnt", "avar", "bdat", "bloc", "bsln", "cvar", "fdsc", "feat", "fmtx", "fvar", "gvar", "hsty", "just",
            "lcar", "mort", "morx", "opbd", "prop", "trak", "Zapf", "Silf", "Glat", "Gloc", "Feat", "Sill",
        ];

        public static Sfnt Read(byte[] b)
        {
            var tables = new Dictionary<string, byte[]>();
            var magic = System.Text.Encoding.Latin1.GetString(b, 0, 4);
            if (magic == "wOF2")
            {
                var n = BinaryPrimitives.ReadUInt16BigEndian(b.AsSpan(12));
                var compressed = (int)BinaryPrimitives.ReadUInt32BigEndian(b.AsSpan(20));
                var p = 48;
                var entries = new List<(string Tag, int Length, bool Transformed)>();
                for (var i = 0; i < n; i++)
                {
                    var flags = b[p++];
                    var tagIndex = flags & 63;
                    var version = flags >> 6;
                    string tag;
                    if (tagIndex == 63)
                    {
                        tag = System.Text.Encoding.Latin1.GetString(b, p, 4);
                        p += 4;
                    }
                    else
                    {
                        tag = Woff2Tags[tagIndex];
                    }

                    var original = Base128(b, ref p);
                    var transformed = tag is "glyf" or "loca" ? version == 0 : version != 0;
                    entries.Add((tag, transformed ? Base128(b, ref p) : original, transformed));
                }

                using var input = new MemoryStream(b, p, compressed);
                using var brotli = new BrotliStream(input, CompressionMode.Decompress);
                using var output = new MemoryStream();
                brotli.CopyTo(output);
                var data = output.ToArray();
                var offset = 0;
                foreach (var e in entries)
                {
                    if (!e.Transformed)
                    {
                        tables[e.Tag] = data.AsSpan(offset, e.Length).ToArray();
                    }

                    offset += e.Length;
                }

                return new Sfnt(tables);
            }

            var count = BinaryPrimitives.ReadUInt16BigEndian(b.AsSpan(4));
            for (var i = 0; i < count; i++)
            {
                var r = 12 + (i * 16);
                var offset = (int)BinaryPrimitives.ReadUInt32BigEndian(b.AsSpan(r + 8));
                var length = (int)BinaryPrimitives.ReadUInt32BigEndian(b.AsSpan(r + 12));
                tables[System.Text.Encoding.Latin1.GetString(b, r, 4)] = b.AsSpan(offset, length).ToArray();
            }

            return new Sfnt(tables);
        }

        private static int Base128(byte[] b, ref int p)
        {
            long v = 0;
            for (var i = 0; i < 5; i++)
            {
                var x = b[p++];
                v = (v << 7) | (uint)(x & 127);
                if ((x & 128) == 0)
                {
                    return (int)v;
                }
            }

            throw new InvalidDataException("UIntBase128");
        }

        /// <summary>The code points of the best Unicode subtable (format 12, else format 4).</summary>
        public static HashSet<int> Cmap(byte[] t)
        {
            var count = BinaryPrimitives.ReadUInt16BigEndian(t.AsSpan(2));
            (int Rank, int Offset, int Format) best = (0, 0, 0);
            for (var i = 0; i < count; i++)
            {
                var platform = BinaryPrimitives.ReadUInt16BigEndian(t.AsSpan(4 + (i * 8)));
                var encoding = BinaryPrimitives.ReadUInt16BigEndian(t.AsSpan(6 + (i * 8)));
                var offset = (int)BinaryPrimitives.ReadUInt32BigEndian(t.AsSpan(8 + (i * 8)));
                var format = BinaryPrimitives.ReadUInt16BigEndian(t.AsSpan(offset));
                var rank = (platform, encoding, format) switch
                {
                    (3, 10, 12) => 4,
                    (0, _, 12) => 3,
                    (3, 1, 4) => 2,
                    (0, _, 4) => 1,
                    _ => 0,
                };
                if (rank > best.Rank)
                {
                    best = (rank, offset, format);
                }
            }

            Assert.True(best.Rank > 0, "no Unicode cmap subtable");
            var set = new HashSet<int>();
            var o = best.Offset;
            if (best.Format == 12)
            {
                var groups = (int)BinaryPrimitives.ReadUInt32BigEndian(t.AsSpan(o + 12));
                for (var g = 0; g < groups; g++)
                {
                    var start = (int)BinaryPrimitives.ReadUInt32BigEndian(t.AsSpan(o + 16 + (g * 12)));
                    var end = (int)BinaryPrimitives.ReadUInt32BigEndian(t.AsSpan(o + 20 + (g * 12)));
                    var glyph = BinaryPrimitives.ReadUInt32BigEndian(t.AsSpan(o + 24 + (g * 12)));
                    for (var c = start; c <= end; c++)
                    {
                        if (glyph + (uint)(c - start) != 0)
                        {
                            set.Add(c);
                        }
                    }
                }

                return set;
            }

            var segX2 = BinaryPrimitives.ReadUInt16BigEndian(t.AsSpan(o + 6));
            var segments = segX2 / 2;
            var endP = o + 14;
            var startP = endP + segX2 + 2;
            var deltaP = startP + segX2;
            var rangeP = deltaP + segX2;
            for (var s = 0; s < segments; s++)
            {
                var end = BinaryPrimitives.ReadUInt16BigEndian(t.AsSpan(endP + (s * 2)));
                var start = BinaryPrimitives.ReadUInt16BigEndian(t.AsSpan(startP + (s * 2)));
                var delta = BinaryPrimitives.ReadInt16BigEndian(t.AsSpan(deltaP + (s * 2)));
                var rangeOffset = BinaryPrimitives.ReadUInt16BigEndian(t.AsSpan(rangeP + (s * 2)));
                for (var c = start; c <= end && start != 0xFFFF; c++)
                {
                    int glyph;
                    if (rangeOffset == 0)
                    {
                        glyph = (c + delta) & 0xFFFF;
                    }
                    else
                    {
                        var at = rangeP + (s * 2) + rangeOffset + ((c - start) * 2);
                        if (at + 2 > t.Length)
                        {
                            continue;
                        }

                        glyph = BinaryPrimitives.ReadUInt16BigEndian(t.AsSpan(at));
                        if (glyph != 0)
                        {
                            glyph = (glyph + delta) & 0xFFFF;
                        }
                    }

                    if (glyph != 0)
                    {
                        set.Add(c);
                    }
                }
            }

            return set;
        }

        /// <summary>The weight axis of an <c>fvar</c> table, or null.</summary>
        public static (double Min, double Max)? WeightAxis(byte[] t)
        {
            var axesAt = BinaryPrimitives.ReadUInt16BigEndian(t.AsSpan(4));
            var count = BinaryPrimitives.ReadUInt16BigEndian(t.AsSpan(8));
            var size = BinaryPrimitives.ReadUInt16BigEndian(t.AsSpan(10));
            for (var i = 0; i < count; i++)
            {
                var r = axesAt + (i * size);
                if (System.Text.Encoding.Latin1.GetString(t, r, 4) == "wght")
                {
                    return (BinaryPrimitives.ReadInt32BigEndian(t.AsSpan(r + 4)) / 65536.0, BinaryPrimitives.ReadInt32BigEndian(t.AsSpan(r + 12)) / 65536.0);
                }
            }

            return null;
        }
    }
}
