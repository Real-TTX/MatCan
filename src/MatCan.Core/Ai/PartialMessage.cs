using System.Text;

namespace MatCan.Core.Ai;

/// <summary>
/// Reads the <c>message</c> of an answer of the design assistant while the answer is still being written: <c>{"message": "Ich lege die Seite an</c> is not valid JSON yet, but the words are already
/// there. A small state machine over the text so far: it finds the key <c>message</c> in the top-level object (a key of that name deeper down, in the arguments of an action, is not it),
/// reads the string after it up to the closing quote, and understands the escapes (<c>\n</c>, <c>\"</c>, <c>\\</c>, <c>\uXXXX</c>, also a surrogate pair); an escape that is cut off at the end
/// of the text is left out until its rest arrives. The text before the first brace (a fence, a sentence) is ignored. Never throws.
/// </summary>
public static class PartialMessage
{
    /// <summary>The message so far; null when the answer has no (top-level) <c>message</c> yet.</summary>
    public static string? Of(string? json)
    {
        if (string.IsNullOrEmpty(json))
        {
            return null;
        }

        var i = json.IndexOf('{');
        if (i < 0)
        {
            return null;
        }

        var depth = 0;
        for (; i < json.Length; i++)
        {
            var c = json[i];
            switch (c)
            {
                case '{':
                case '[':
                    depth++;
                    break;
                case '}':
                case ']':
                    depth--;
                    if (depth <= 0)
                    {
                        return null;   // the object is over without a message
                    }

                    break;
                case '"':
                    {
                        var (key, end, closed) = ReadString(json, i + 1);
                        if (!closed)
                        {
                            return null;
                        }

                        i = end;   // the closing quote
                        if (depth == 1 && key == "message")
                        {
                            var j = SkipSpace(json, i + 1);
                            if (j < json.Length && json[j] == ':')
                            {
                                j = SkipSpace(json, j + 1);
                                if (j < json.Length && json[j] == '"')
                                {
                                    return ReadString(json, j + 1).Text;
                                }
                            }
                        }

                        break;
                    }
            }
        }

        return null;
    }

    private static int SkipSpace(string text, int from)
    {
        while (from < text.Length && char.IsWhiteSpace(text[from]))
        {
            from++;
        }

        return from;
    }

    /// <summary>Reads a string whose opening quote is before <paramref name="from"/>: the decoded text, the index of the closing quote, and whether it was closed.</summary>
    private static (string Text, int End, bool Closed) ReadString(string json, int from)
    {
        var sb = new StringBuilder();
        for (var i = from; i < json.Length; i++)
        {
            var c = json[i];
            if (c == '"')
            {
                return (sb.ToString(), i, true);
            }

            if (c != '\\')
            {
                sb.Append(c);
                continue;
            }

            if (i + 1 >= json.Length)
            {
                break;   // the escape is cut off: wait for the rest
            }

            var e = json[++i];
            switch (e)
            {
                case 'n': sb.Append('\n'); break;
                case 't': sb.Append('\t'); break;
                case 'r': break;
                case 'b': sb.Append('\b'); break;
                case 'f': sb.Append('\f'); break;
                case '/': sb.Append('/'); break;
                case '\\': sb.Append('\\'); break;
                case '"': sb.Append('"'); break;
                case 'u':
                    if (i + 4 >= json.Length || !int.TryParse(json.AsSpan(i + 1, 4), System.Globalization.NumberStyles.AllowHexSpecifier, System.Globalization.CultureInfo.InvariantCulture, out var code))
                    {
                        return (sb.ToString(), json.Length, false);   // cut off (or not hex): the rest is not there yet
                    }

                    sb.Append((char)code);
                    i += 4;
                    break;
                default:
                    sb.Append(e);
                    break;
            }
        }

        return (sb.ToString(), json.Length, false);
    }
}
