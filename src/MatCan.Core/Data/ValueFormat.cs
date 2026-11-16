using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using MatCan.Core.Documents;

namespace MatCan.Core.Data;

/// <summary>
/// Number and price values of data lists, typed and shown. These rules are SHARED with the browser engine (<c>DtEngine.formatValue</c> and its <c>parseNumber</c>
/// in <c>wwwroot/js/dt-engine.js</c>); both sides must give the same text, so a change here is a change there. The engine is the reference.
/// <list type="bullet">
/// <item>Formatting by field type: <c>price</c> = number with <c>decimals</c> (default 2) in the locale ("2,99"); <c>number</c> = <c>decimals</c> if set,
/// otherwise the value as typed (trimmed); <c>text</c>/<c>multiline</c> are returned as they are; <c>image</c> is trimmed; null gives "".
/// A number field whose text is empty gives ""; a text that is not a number stays as typed.</item>
/// <item>Decimals are clamped to 0..4. Rounding is half away from zero of the SHORTEST decimal text of the double (ICU does the same: 1.005 gives "1,01", 2.675 gives "2,68");
/// a negative value that rounds to zero keeps its sign ("-0,00") like Intl.NumberFormat.</item>
/// <item>Parsing (<see cref="ParseNumber"/>): spaces (also no-break and narrow no-break), apostrophes and the symbols <c>€ $ £ ¥ %</c> are removed; what is left must match
/// <c>^[+-]?[0-9.,]*[0-9][0-9.,]*$</c>. One kind of separator that occurs once is the decimal separator ("2,99", "2.99"); one that occurs several times groups thousands
/// ("1.234.567"); with both kinds the LAST one is the decimal separator ("1.234,56", "1,234.56"). Digits only are digits ("1234" is 1234).</item>
/// <item>The locale is a BCP 47 tag (default and fallback de-DE). Grouping and decimal separators are those of the .NET culture data (ICU), which are the same as
/// those of Intl in the browser (de: 1.234,50; en-US: 1,234.50; fr-FR: 1 234,50 with U+202F). The apostrophe of de-CH differs between CLDR versions (U+2019 in .NET, U+0027 in some browsers), so de-CH is not covered. A tag that .NET does not know falls back to de-DE.</item>
/// </list>
/// </summary>
public static partial class ValueFormat
{
    private const string DefaultLocale = "de-DE";

    [GeneratedRegex(@"[\s  ﻿']", RegexOptions.CultureInvariant)]
    private static partial Regex Spaces();

    [GeneratedRegex(@"[€$£¥%]", RegexOptions.CultureInvariant)]
    private static partial Regex Symbols();

    [GeneratedRegex(@"^[+-]?[0-9.,]*[0-9][0-9.,]*$", RegexOptions.CultureInvariant)]
    private static partial Regex NumberShape();

    public static bool IsEmpty(string? raw) => string.IsNullOrWhiteSpace(raw);

    /// <summary>Parses a typed number ("2.99", "2,99", "1.234,56", "1,234.50", "2,99 €", "-3"); null when the text is not a number.</summary>
    public static double? ParseNumber(string? text)
    {
        if (text is null)
        {
            return null;
        }

        var t = Symbols().Replace(Spaces().Replace(text, string.Empty), string.Empty);
        if (!NumberShape().IsMatch(t))
        {
            return null;
        }

        var sign = 1;
        if (t[0] == '-')
        {
            sign = -1;
        }

        if (t[0] is '-' or '+')
        {
            t = t[1..];
        }

        var lastComma = t.LastIndexOf(',');
        var lastDot = t.LastIndexOf('.');
        var decimalIndex = -1;
        if (lastComma >= 0 && lastDot >= 0)
        {
            decimalIndex = Math.Max(lastComma, lastDot);
        }
        else if (lastComma >= 0 || lastDot >= 0)
        {
            var separator = lastComma >= 0 ? ',' : '.';
            var occurrences = t.Count(c => c == separator);
            if (occurrences == 1)
            {
                decimalIndex = t.LastIndexOf(separator);
            }
        }

        var integer = StripSeparators(decimalIndex >= 0 ? t[..decimalIndex] : t);
        var fraction = decimalIndex >= 0 ? StripSeparators(t[(decimalIndex + 1)..]) : string.Empty;
        var digits = (integer.Length == 0 ? "0" : integer) + (fraction.Length > 0 ? "." + fraction : string.Empty);
        if (!double.TryParse(digits, NumberStyles.Float, CultureInfo.InvariantCulture, out var n) || !double.IsFinite(n))
        {
            return null;
        }

        return sign * n;
    }

    private static string StripSeparators(string text) => text.Replace(".", string.Empty).Replace(",", string.Empty);

    public static string Format(FieldDef field, string? raw, string locale) => Format(field.Type, field.Decimals, raw, locale);

    /// <summary>Formats a raw value as a field of <paramref name="type"/> (text, multiline, number, price, image); the rules are in the description of the class.</summary>
    public static string Format(string type, int? decimals, string? raw, string locale = DefaultLocale)
    {
        if (raw is null)
        {
            return string.Empty;
        }

        if (type is "price" or "number")
        {
            var trimmed = raw.Trim();
            if (trimmed.Length == 0)
            {
                return string.Empty;
            }

            var places = decimals is { } d ? Math.Clamp(d, 0, 4) : (int?)null;
            if (type == "price" && places is null)
            {
                places = 2;
            }

            if (places is null)
            {
                return trimmed;
            }

            return ParseNumber(trimmed) is { } n ? FormatNumber(n, places.Value, locale) : trimmed;
        }

        return type == "image" ? raw.Trim() : raw;
    }

    private static string FormatNumber(double value, int places, string locale)
    {
        var culture = Culture(locale);
        var info = culture.NumberFormat;
        var negative = value < 0 || (value == 0 && double.IsNegative(value));
        var plain = RoundedPlain(Math.Abs(value), places);

        var dot = plain.IndexOf('.');
        var integer = dot < 0 ? plain : plain[..dot];
        var fraction = dot < 0 ? string.Empty : plain[(dot + 1)..];

        var sb = new StringBuilder();
        if (negative)
        {
            sb.Append(info.NegativeSign);
        }

        sb.Append(Group(integer, info));
        if (places > 0)
        {
            sb.Append(info.NumberDecimalSeparator).Append(fraction);
        }

        return sb.ToString();
    }

    /// <summary>The magnitude rounded half up on its SHORTEST decimal text ("1.005" at 2 places is "1.01"), as plain digits with a dot ("1234.50").</summary>
    private static string RoundedPlain(double magnitude, int places)
    {
        // "R" is the shortest text that reads back as the same double, as ICU and V8 use it: 1.005 stays 1.005 although the double is slightly less.
        var text = magnitude.ToString("R", CultureInfo.InvariantCulture);
        var exponent = 0;
        var e = text.IndexOfAny(['E', 'e']);
        if (e >= 0)
        {
            exponent = int.Parse(text[(e + 1)..], CultureInfo.InvariantCulture);
            text = text[..e];
        }

        var dot = text.IndexOf('.');
        var digits = dot < 0 ? text : text.Remove(dot, 1);
        var pointAt = (dot < 0 ? text.Length : dot) + exponent;

        // Normalise to integer digits and fraction digits.
        string integerPart;
        string fractionPart;
        if (pointAt <= 0)
        {
            integerPart = "0";
            fractionPart = new string('0', -pointAt) + digits;
        }
        else if (pointAt >= digits.Length)
        {
            integerPart = digits + new string('0', pointAt - digits.Length);
            fractionPart = string.Empty;
        }
        else
        {
            integerPart = digits[..pointAt];
            fractionPart = digits[pointAt..];
        }

        integerPart = integerPart.TrimStart('0');
        if (integerPart.Length == 0)
        {
            integerPart = "0";
        }

        var roundUp = fractionPart.Length > places && fractionPart[places] >= '5';
        fractionPart = fractionPart.Length >= places ? fractionPart[..places] : fractionPart.PadRight(places, '0');

        var combined = (integerPart + fractionPart).ToCharArray();
        if (roundUp)
        {
            var i = combined.Length - 1;
            while (i >= 0)
            {
                if (combined[i] == '9')
                {
                    combined[i] = '0';
                    i--;
                    continue;
                }

                combined[i]++;
                break;
            }

            if (i < 0)
            {
                combined = ['1', .. combined];
            }
        }

        var all = new string(combined);
        var integerLength = all.Length - places;
        return places == 0 ? all : all[..integerLength] + "." + all[integerLength..];
    }

    private static string Group(string integer, NumberFormatInfo info)
    {
        var sizes = info.NumberGroupSizes;
        if (sizes.Length == 0 || sizes[0] == 0 || integer.Length <= sizes[0])
        {
            return integer;
        }

        var parts = new List<string>();
        var rest = integer;
        var index = 0;
        while (rest.Length > 0)
        {
            var size = sizes[Math.Min(index, sizes.Length - 1)];
            if (size == 0 || rest.Length <= size)
            {
                parts.Add(rest);
                break;
            }

            parts.Add(rest[^size..]);
            rest = rest[..^size];
            index++;
        }

        parts.Reverse();
        return string.Join(info.NumberGroupSeparator, parts);
    }

    private static CultureInfo Culture(string? locale)
    {
        var name = string.IsNullOrWhiteSpace(locale) ? DefaultLocale : locale.Trim();
        try
        {
            var culture = CultureInfo.GetCultureInfo(name);
            // ICU makes up a "custom" culture for a well-formed tag it does not know; its numbers are not those of any language.
            return culture.LCID == 4096 || culture.Equals(CultureInfo.InvariantCulture) ? CultureInfo.GetCultureInfo(DefaultLocale) : culture;
        }
        catch (CultureNotFoundException)
        {
            return CultureInfo.GetCultureInfo(DefaultLocale);
        }
    }
}
