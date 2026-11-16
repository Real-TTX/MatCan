namespace MatCan.Logic;

/// <summary>The average advance of the letters of one font in em, by kind of character.</summary>
public readonly record struct ClassWidths(double Lower, double Upper, double Digit, double Space, double Punct);

/// <summary>The widths of a family, regular (400) and bold (700).</summary>
public sealed record FamilyMetrics(ClassWidths Regular, ClassWidths Bold);

/// <summary>
/// How wide a text is, estimated without a font engine: per family the average advance of lower case letters, capitals, digits, the space and punctuation (measured in the browser from the bundled fonts by
/// <c>tools/ai-font-metrics.js</c>, see <c>AiFontMetrics.Generated.cs</c>). A family that is not in the table (an uploaded font, a generic name) gets the numbers of a plain sans serif. The estimate is
/// good to about 10 %, which is all the lint needs to tell "these two texts overlap" from "they only have boxes that overlap".
/// </summary>
public static partial class AiFontMetrics
{
    private static readonly FamilyMetrics Fallback = new(new(0.52, 0.65, 0.57, 0.26, 0.4), new(0.56, 0.68, 0.57, 0.26, 0.44));

    public static FamilyMetrics For(string? family) => !string.IsNullOrWhiteSpace(family) && Table.TryGetValue(family.Trim(), out var m) ? m : Fallback;

    /// <summary>Whether the table has a row for the family (the test that every bundled family is covered).</summary>
    public static bool Knows(string family) => Table.ContainsKey(family);

    public static IEnumerable<string> Families => Table.Keys;

    /// <summary>The width of the text in em (one line, no wrapping). Weights from 600 on count as bold, in between the two rows are mixed.</summary>
    public static double WidthEm(string? family, int weight, string text, bool uppercase, double letterSpacingEm)
    {
        var m = For(family);
        var t = Math.Clamp((weight - 400) / 300.0, 0, 1);
        double Pick(double regular, double bold) => regular + ((bold - regular) * t);
        var total = 0.0;
        var count = 0;
        foreach (var c in text)
        {
            count++;
            if (c == ' ' || c == ' ')
            {
                total += Pick(m.Regular.Space, m.Bold.Space);
            }
            else if (char.IsDigit(c))
            {
                total += Pick(m.Regular.Digit, m.Bold.Digit);
            }
            else if (char.IsLetter(c))
            {
                total += uppercase || char.IsUpper(c) ? Pick(m.Regular.Upper, m.Bold.Upper) : Pick(m.Regular.Lower, m.Bold.Lower);
            }
            else
            {
                total += Pick(m.Regular.Punct, m.Bold.Punct);
            }
        }

        return total + (letterSpacingEm * Math.Max(0, count - 1));
    }
}
