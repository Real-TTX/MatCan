using System.Text;

namespace MatCan.Services;

/// <summary>Reads the bytes of a text file that a person uploads: UTF-8 (with or without BOM), else the Windows code page 1252 that Excel writes on a German PC.</summary>
public static class TextDecoder
{
    private static readonly UTF8Encoding StrictUtf8 = new(false, true);

    public static string Decode(byte[] bytes)
    {
        var offset = bytes.Length >= 3 && bytes[0] == 0xEF && bytes[1] == 0xBB && bytes[2] == 0xBF ? 3 : 0;
        try
        {
            return StrictUtf8.GetString(bytes, offset, bytes.Length - offset);
        }
        catch (DecoderFallbackException)
        {
            Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);
            return Encoding.GetEncoding(1252).GetString(bytes, offset, bytes.Length - offset);
        }
    }
}
