using System.Buffers.Binary;
using System.Text;

namespace DesignThix.Core.Media;

/// <summary>The kinds of file the library accepts: images and fonts. Recognised by their first bytes, never by the file name.</summary>
public enum FileKind
{
    Unknown,
    Png,
    Jpeg,
    Gif,
    WebP,
    Svg,
    Ttf,
    Otf,
    Woff,
    Woff2,
}

/// <summary>What <see cref="FileSniffer"/> found: the kind, the content type, the extension (without a dot) and, for images with a size in their header, the pixels.</summary>
public sealed record SniffResult(FileKind Kind, string ContentType, string Extension, int? Width, int? Height)
{
    public bool IsImage => Kind is FileKind.Png or FileKind.Jpeg or FileKind.Gif or FileKind.WebP or FileKind.Svg;

    public bool IsFont => Kind is FileKind.Ttf or FileKind.Otf or FileKind.Woff or FileKind.Woff2;

    /// <summary>A bitmap (everything that is an image except SVG).</summary>
    public bool IsRaster => IsImage && Kind != FileKind.Svg;
}

/// <summary>Recognises uploaded files by magic bytes and reads the pixel size from the header of bitmaps. Never throws: garbage is <see cref="FileKind.Unknown"/>.</summary>
public static class FileSniffer
{
    private static readonly SniffResult Nothing = new(FileKind.Unknown, "application/octet-stream", "bin", null, null);

    private static ReadOnlySpan<byte> PngSignature => [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];

    private static ReadOnlySpan<byte> TrueTypeSignature => [0x00, 0x01, 0x00, 0x00];

    private static ReadOnlySpan<byte> Utf8Bom => [0xEF, 0xBB, 0xBF];

    public static SniffResult Sniff(ReadOnlySpan<byte> bytes)
    {
        try
        {
            return SniffCore(bytes);
        }
        catch (Exception ex) when (ex is ArgumentException or IndexOutOfRangeException)
        {
            return Nothing;
        }
    }

    private static SniffResult SniffCore(ReadOnlySpan<byte> b)
    {
        if (b.Length < 4)
        {
            return Nothing;
        }

        if (b.StartsWith(PngSignature))
        {
            return Png(b);
        }

        if (b[0] == 0xFF && b[1] == 0xD8 && b[2] == 0xFF)
        {
            return Jpeg(b);
        }

        if (b.StartsWith("GIF87a"u8) || b.StartsWith("GIF89a"u8))
        {
            return Gif(b);
        }

        if (b.Length >= 12 && b.StartsWith("RIFF"u8) && b.Slice(8, 4).SequenceEqual("WEBP"u8))
        {
            return WebP(b);
        }

        if (b.StartsWith("OTTO"u8))
        {
            return new SniffResult(FileKind.Otf, "font/otf", "otf", null, null);
        }

        if (b.StartsWith("wOFF"u8))
        {
            return new SniffResult(FileKind.Woff, "font/woff", "woff", null, null);
        }

        if (b.StartsWith("wOF2"u8))
        {
            return new SniffResult(FileKind.Woff2, "font/woff2", "woff2", null, null);
        }

        if (b.StartsWith(TrueTypeSignature) || b.StartsWith("true"u8))
        {
            return new SniffResult(FileKind.Ttf, "font/ttf", "ttf", null, null);
        }

        return LooksLikeSvg(b) ? new SniffResult(FileKind.Svg, "image/svg+xml", "svg", null, null) : Nothing;
    }

    private static SniffResult Png(ReadOnlySpan<byte> b)
    {
        // 8 bytes signature, then the IHDR chunk: length (4), "IHDR" (4), width (4), height (4).
        if (b.Length < 24 || !b.Slice(12, 4).SequenceEqual("IHDR"u8))
        {
            return Nothing;
        }

        var width = BinaryPrimitives.ReadUInt32BigEndian(b.Slice(16, 4));
        var height = BinaryPrimitives.ReadUInt32BigEndian(b.Slice(20, 4));
        return new SniffResult(FileKind.Png, "image/png", "png", Dimension(width), Dimension(height));
    }

    private static SniffResult Jpeg(ReadOnlySpan<byte> b)
    {
        // Walk the segments until a start-of-frame marker (SOF0..SOF15 except DHT 0xC4, JPG 0xC8, DAC 0xCC).
        var i = 2;
        while (i + 4 <= b.Length)
        {
            if (b[i] != 0xFF)
            {
                i++;
                continue;
            }

            var marker = b[i + 1];
            if (marker == 0xFF)
            {
                i++;
                continue;
            }

            if (marker is 0x00 or 0x01 or (>= 0xD0 and <= 0xD8))
            {
                i += 2;
                continue;
            }

            var length = BinaryPrimitives.ReadUInt16BigEndian(b.Slice(i + 2, 2));
            if (marker is >= 0xC0 and <= 0xCF && marker is not (0xC4 or 0xC8 or 0xCC))
            {
                if (i + 9 > b.Length)
                {
                    break;
                }

                var height = BinaryPrimitives.ReadUInt16BigEndian(b.Slice(i + 5, 2));
                var width = BinaryPrimitives.ReadUInt16BigEndian(b.Slice(i + 7, 2));
                return new SniffResult(FileKind.Jpeg, "image/jpeg", "jpg", Dimension(width), Dimension(height));
            }

            if (marker == 0xDA || length < 2)
            {
                break;
            }

            i += 2 + length;
        }

        // A JPEG without a readable size is still a JPEG; the size stays unknown.
        return new SniffResult(FileKind.Jpeg, "image/jpeg", "jpg", null, null);
    }

    private static SniffResult Gif(ReadOnlySpan<byte> b)
    {
        if (b.Length < 10)
        {
            return Nothing;
        }

        return new SniffResult(FileKind.Gif, "image/gif", "gif", Dimension(BinaryPrimitives.ReadUInt16LittleEndian(b.Slice(6, 2))), Dimension(BinaryPrimitives.ReadUInt16LittleEndian(b.Slice(8, 2))));
    }

    private static SniffResult WebP(ReadOnlySpan<byte> b)
    {
        int? width = null;
        int? height = null;
        if (b.Length >= 30 && b.Slice(12, 4).SequenceEqual("VP8 "u8))
        {
            // Lossy: frame tag (3), start code 9D 01 2A, then 14-bit width and height.
            if (b[23] == 0x9D && b[24] == 0x01 && b[25] == 0x2A)
            {
                width = Dimension(BinaryPrimitives.ReadUInt16LittleEndian(b.Slice(26, 2)) & 0x3FFF);
                height = Dimension(BinaryPrimitives.ReadUInt16LittleEndian(b.Slice(28, 2)) & 0x3FFF);
            }
        }
        else if (b.Length >= 25 && b.Slice(12, 4).SequenceEqual("VP8L"u8) && b[20] == 0x2F)
        {
            // Lossless: signature 0x2F, then 14 + 14 bits (each minus one).
            var bits = BinaryPrimitives.ReadUInt32LittleEndian(b.Slice(21, 4));
            width = Dimension((int)(bits & 0x3FFF) + 1);
            height = Dimension((int)((bits >> 14) & 0x3FFF) + 1);
        }
        else if (b.Length >= 30 && b.Slice(12, 4).SequenceEqual("VP8X"u8))
        {
            // Extended: 24-bit canvas width and height, each minus one.
            width = Dimension((b[24] | (b[25] << 8) | (b[26] << 16)) + 1);
            height = Dimension((b[27] | (b[28] << 8) | (b[29] << 16)) + 1);
        }

        return new SniffResult(FileKind.WebP, "image/webp", "webp", width, height);
    }

    private static int? Dimension(long value) => value is > 0 and <= 1_000_000 ? (int)value : null;

    /// <summary>Text that starts (after a BOM, spaces, an XML declaration, comments and a DOCTYPE) with an svg element within the first 4 KB. UTF-16 is not accepted.</summary>
    private static bool LooksLikeSvg(ReadOnlySpan<byte> b)
    {
        var head = b[..Math.Min(b.Length, 4096)];
        if (head.StartsWith(Utf8Bom))
        {
            head = head[3..];
        }

        // Any NUL byte means UTF-16 or binary data.
        if (head.IndexOf((byte)0) >= 0)
        {
            return false;
        }

        var text = Encoding.UTF8.GetString(head);
        var i = 0;
        while (i < text.Length)
        {
            while (i < text.Length && char.IsWhiteSpace(text[i]))
            {
                i++;
            }

            if (i >= text.Length || text[i] != '<')
            {
                return false;
            }

            if (string.CompareOrdinal(text, i, "<svg", 0, 4) == 0 && (i + 4 >= text.Length || char.IsWhiteSpace(text[i + 4]) || text[i + 4] is '>' or '/'))
            {
                return true;
            }

            var end = text.AsSpan(i).StartsWith("<?", StringComparison.Ordinal) ? SkipTo(text, i, "?>")
                : text.AsSpan(i).StartsWith("<!--", StringComparison.Ordinal) ? SkipTo(text, i, "-->")
                : text.AsSpan(i).StartsWith("<!DOCTYPE", StringComparison.OrdinalIgnoreCase) ? SkipDoctype(text, i)
                : -1;
            if (end < 0)
            {
                return false;
            }

            i = end;
        }

        return false;
    }

    private static int SkipTo(string text, int from, string terminator)
    {
        var at = text.IndexOf(terminator, from, StringComparison.Ordinal);
        return at < 0 ? -1 : at + terminator.Length;
    }

    private static int SkipDoctype(string text, int from)
    {
        // A DOCTYPE may carry an internal subset in brackets.
        var depth = 0;
        for (var i = from; i < text.Length; i++)
        {
            if (text[i] == '[')
            {
                depth++;
            }
            else if (text[i] == ']')
            {
                depth--;
            }
            else if (text[i] == '>' && depth <= 0)
            {
                return i + 1;
            }
        }

        return -1;
    }
}
