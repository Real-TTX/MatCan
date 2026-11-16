using System.Text;

namespace MatCan.Core.Data;

/// <summary>
/// CSV as Excel and friends write it: a BOM, a delimiter that is a semicolon in Germany but a comma or a tab elsewhere, quotes with "" inside, line breaks
/// inside quotes. Reading never throws (a broken file gives what could be read); writing uses semicolons, CRLF and quotes only where needed.
/// Writing does NOT neutralise cells that start with <c>=</c>, <c>+</c>, <c>-</c> or <c>@</c> (CSV injection): the values of a data list are label texts, a silent
/// change of the data would be worse, and the export is meant for the application's own import and for people who know what they open.
/// </summary>
public static class Csv
{
    private static readonly char[] Candidates = [';', ',', '\t', '|'];

    public sealed record ParseResult(IReadOnlyList<IReadOnlyList<string>> Rows, char Delimiter);

    /// <summary>Reads the rows. The delimiter is detected unless given; completely empty lines are skipped, rows keep their own length.</summary>
    public static ParseResult Parse(string text, char? delimiter = null)
    {
        text ??= string.Empty;
        if (text.Length > 0 && text[0] == '﻿')
        {
            text = text[1..];
        }

        var separator = delimiter ?? DetectDelimiter(text);
        var rows = new List<IReadOnlyList<string>>();
        var row = new List<string>();
        var cell = new StringBuilder();
        var inQuotes = false;
        var quoted = false;

        void EndCell()
        {
            row.Add(cell.ToString());
            cell.Clear();
            quoted = false;
        }

        void EndRow()
        {
            EndCell();
            if (row.Any(c => c.Length > 0))
            {
                rows.Add(row);
            }

            row = [];
        }

        var i = 0;
        while (i < text.Length)
        {
            var c = text[i];
            if (inQuotes)
            {
                if (c == '"')
                {
                    if (i + 1 < text.Length && text[i + 1] == '"')
                    {
                        cell.Append('"');
                        i += 2;
                        continue;
                    }

                    inQuotes = false;
                    i++;
                    continue;
                }

                cell.Append(c);
                i++;
                continue;
            }

            if (c == '"' && cell.Length == 0 && !quoted)
            {
                inQuotes = true;
                quoted = true;
                i++;
                continue;
            }

            if (c == separator)
            {
                EndCell();
                i++;
                continue;
            }

            if (c is '\r' or '\n')
            {
                EndRow();
                i += c == '\r' && i + 1 < text.Length && text[i + 1] == '\n' ? 2 : 1;
                continue;
            }

            cell.Append(c);
            i++;
        }

        // The last line has no line break at its end; an unterminated quote simply ends with the text.
        if (cell.Length > 0 || row.Count > 0 || quoted)
        {
            EndRow();
        }

        return new ParseResult(rows, separator);
    }

    /// <summary>
    /// The delimiter that fits the first lines best: the candidate that occurs outside quotes, in the same number on most of the first ten lines, and often.
    /// Without a clear winner a semicolon.
    /// </summary>
    public static char DetectDelimiter(string text)
    {
        if (string.IsNullOrEmpty(text))
        {
            return ';';
        }

        var lines = FirstLines(text, 10);
        var best = ';';
        var bestScore = 0;
        foreach (var candidate in Candidates)
        {
            var counts = lines.Select(l => CountOutsideQuotes(l, candidate)).Where(n => n > 0).ToList();
            if (counts.Count == 0)
            {
                continue;
            }

            // The most common count is the number of columns minus one; lines that agree with it weigh more than the count itself.
            var mode = counts.GroupBy(n => n).OrderByDescending(g => g.Count()).ThenByDescending(g => g.Key).First();
            var score = (mode.Count() * 1000) + mode.Key;
            if (score > bestScore)
            {
                bestScore = score;
                best = candidate;
            }
        }

        return best;
    }

    /// <summary>The first lines of the text; a line break inside quotes does not end a line.</summary>
    private static List<string> FirstLines(string text, int max)
    {
        var lines = new List<string>();
        var line = new StringBuilder();
        var inQuotes = false;
        for (var i = 0; i < text.Length && lines.Count < max; i++)
        {
            var c = text[i];
            if (c == '"')
            {
                inQuotes = !inQuotes;
            }

            if (!inQuotes && c is '\r' or '\n')
            {
                if (c == '\r' && i + 1 < text.Length && text[i + 1] == '\n')
                {
                    i++;
                }

                if (line.Length > 0)
                {
                    lines.Add(line.ToString());
                    line.Clear();
                }

                continue;
            }

            line.Append(c);
        }

        if (line.Length > 0 && lines.Count < max)
        {
            lines.Add(line.ToString());
        }

        return lines;
    }

    private static int CountOutsideQuotes(string line, char candidate)
    {
        var inQuotes = false;
        var count = 0;
        foreach (var c in line)
        {
            if (c == '"')
            {
                inQuotes = !inQuotes;
            }
            else if (c == candidate && !inQuotes)
            {
                count++;
            }
        }

        return count;
    }

    /// <summary>The text of a CSV file: cells with the delimiter, a quote, a line break or a space at either end are quoted; lines end with CRLF; no BOM.</summary>
    public static string Write(IEnumerable<IReadOnlyList<string>> rows, char delimiter = ';')
    {
        var sb = new StringBuilder();
        foreach (var row in rows)
        {
            for (var i = 0; i < row.Count; i++)
            {
                if (i > 0)
                {
                    sb.Append(delimiter);
                }

                sb.Append(Escape(row[i] ?? string.Empty, delimiter));
            }

            sb.Append("\r\n");
        }

        return sb.ToString();
    }

    /// <summary>The bytes of a CSV file for download: UTF-8 with a BOM (Excel then reads umlauts correctly).</summary>
    public static byte[] WriteBytes(IEnumerable<IReadOnlyList<string>> rows, char delimiter = ';')
        => [.. new UTF8Encoding(true).GetPreamble(), .. new UTF8Encoding(false).GetBytes(Write(rows, delimiter))];

    private static string Escape(string cell, char delimiter)
    {
        var needsQuotes = cell.Length > 0 && (cell.Contains(delimiter) || cell.Contains('"') || cell.Contains('\r') || cell.Contains('\n') || cell[0] == ' ' || cell[^1] == ' ');
        return needsQuotes ? "\"" + cell.Replace("\"", "\"\"") + "\"" : cell;
    }
}
