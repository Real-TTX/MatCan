using System.Buffers.Binary;
using System.IO.Compression;
using System.Text;

namespace MatCan.Core.Media;

/// <summary>What a font file says about itself: family, weight, slant, whether it is a variable font.</summary>
public sealed record FontInfo(string? Family, string? Subfamily, int Weight, bool Italic, bool IsVariable)
{
    /// <summary>
    /// Reads the <c>name</c>, <c>OS/2</c>, <c>head</c> and <c>fvar</c> tables of a TTF, OTF or WOFF file. A WOFF2 file (Brotli, transformed tables)
    /// and anything damaged give null: the caller falls back to the file name. Never throws.
    /// </summary>
    public static FontInfo? Read(ReadOnlySpan<byte> bytes)
    {
        try
        {
            return ReadCore(bytes);
        }
        catch (Exception ex) when (ex is ArgumentException or InvalidDataException or IndexOutOfRangeException or OverflowException)
        {
            return null;
        }
    }

    private static FontInfo? ReadCore(ReadOnlySpan<byte> bytes)
    {
        if (bytes.Length < 12)
        {
            return null;
        }

        var tag = Encoding.ASCII.GetString(bytes[..4]);
        Dictionary<string, byte[]> tables;
        if (tag is "wOFF")
        {
            tables = ReadWoff(bytes);
        }
        else if (tag is "OTTO" or "true" || (bytes[0] == 0 && bytes[1] == 1 && bytes[2] == 0 && bytes[3] == 0))
        {
            tables = ReadSfnt(bytes);
        }
        else
        {
            return null;
        }

        if (tables.Count == 0)
        {
            return null;
        }

        var (family, subfamily) = tables.TryGetValue("name", out var name) ? ReadNames(name) : (null, null);
        var weight = 0;
        var italic = false;
        if (tables.TryGetValue("OS/2", out var os2) && os2.Length >= 64)
        {
            weight = BinaryPrimitives.ReadUInt16BigEndian(os2.AsSpan(4, 2));
            italic = (BinaryPrimitives.ReadUInt16BigEndian(os2.AsSpan(62, 2)) & 1) != 0;
        }

        if (!italic && tables.TryGetValue("head", out var head) && head.Length >= 46)
        {
            italic = (BinaryPrimitives.ReadUInt16BigEndian(head.AsSpan(44, 2)) & 2) != 0;
        }

        if (weight is < 100 or > 900)
        {
            weight = 0;
        }

        return new FontInfo(family, subfamily, weight, italic, tables.ContainsKey("fvar"));
    }

    private static Dictionary<string, byte[]> ReadSfnt(ReadOnlySpan<byte> bytes)
    {
        var count = BinaryPrimitives.ReadUInt16BigEndian(bytes[4..6]);
        var tables = new Dictionary<string, byte[]>();
        for (var i = 0; i < count && i < 64; i++)
        {
            var entry = 12 + i * 16;
            if (entry + 16 > bytes.Length)
            {
                break;
            }

            var tableTag = Encoding.ASCII.GetString(bytes.Slice(entry, 4));
            var offset = BinaryPrimitives.ReadUInt32BigEndian(bytes.Slice(entry + 8, 4));
            var length = BinaryPrimitives.ReadUInt32BigEndian(bytes.Slice(entry + 12, 4));
            if (tableTag is "name" or "OS/2" or "head" or "fvar" && offset <= bytes.Length && length <= bytes.Length - offset && length <= 1 << 20)
            {
                tables[tableTag] = bytes.Slice((int)offset, (int)length).ToArray();
            }
        }

        return tables;
    }

    private static Dictionary<string, byte[]> ReadWoff(ReadOnlySpan<byte> bytes)
    {
        var count = BinaryPrimitives.ReadUInt16BigEndian(bytes[12..14]);
        var tables = new Dictionary<string, byte[]>();
        for (var i = 0; i < count && i < 64; i++)
        {
            var entry = 44 + i * 20;
            if (entry + 20 > bytes.Length)
            {
                break;
            }

            var tableTag = Encoding.ASCII.GetString(bytes.Slice(entry, 4));
            var offset = BinaryPrimitives.ReadUInt32BigEndian(bytes.Slice(entry + 4, 4));
            var compressed = BinaryPrimitives.ReadUInt32BigEndian(bytes.Slice(entry + 8, 4));
            var original = BinaryPrimitives.ReadUInt32BigEndian(bytes.Slice(entry + 12, 4));
            if (tableTag is not ("name" or "OS/2" or "head" or "fvar") || offset > bytes.Length || compressed > bytes.Length - offset || original > 1 << 20)
            {
                continue;
            }

            var raw = bytes.Slice((int)offset, (int)compressed).ToArray();
            if (compressed == original)
            {
                tables[tableTag] = raw;
                continue;
            }

            using var input = new MemoryStream(raw);
            using var zlib = new ZLibStream(input, CompressionMode.Decompress);
            using var output = new MemoryStream();
            zlib.CopyTo(output);
            tables[tableTag] = output.ToArray();
        }

        return tables;
    }

    private static (string? Family, string? Subfamily) ReadNames(byte[] table)
    {
        if (table.Length < 6)
        {
            return (null, null);
        }

        var count = BinaryPrimitives.ReadUInt16BigEndian(table.AsSpan(2, 2));
        var storage = BinaryPrimitives.ReadUInt16BigEndian(table.AsSpan(4, 2));
        string? family1 = null, family16 = null, sub2 = null, sub17 = null;
        for (var i = 0; i < count; i++)
        {
            var record = 6 + i * 12;
            if (record + 12 > table.Length)
            {
                break;
            }

            var platform = BinaryPrimitives.ReadUInt16BigEndian(table.AsSpan(record, 2));
            var nameId = BinaryPrimitives.ReadUInt16BigEndian(table.AsSpan(record + 6, 2));
            if (nameId is not (1 or 2 or 16 or 17) || platform is not (0 or 1 or 3))
            {
                continue;
            }

            var length = BinaryPrimitives.ReadUInt16BigEndian(table.AsSpan(record + 8, 2));
            var offset = storage + BinaryPrimitives.ReadUInt16BigEndian(table.AsSpan(record + 10, 2));
            if (offset + length > table.Length)
            {
                continue;
            }

            var text = platform == 1 ? Encoding.Latin1.GetString(table, offset, length) : Encoding.BigEndianUnicode.GetString(table, offset, length);
            text = text.Trim();
            if (text.Length == 0)
            {
                continue;
            }

            switch (nameId)
            {
                case 1: family1 ??= text; break;
                case 2: sub2 ??= text; break;
                case 16: family16 ??= text; break;
                default: sub17 ??= text; break;
            }
        }

        return (family16 ?? family1, sub17 ?? sub2);
    }
}
