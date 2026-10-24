using System.Text;
using DesignThix.Configuration;
using DesignThix.Data.Entities;

namespace DesignThix.Logic;

/// <summary>
/// The instructions to the model, in layers from the outside in: the operator's (with an addition per action), the base instruction of the
/// site (editable, empty = built-in), a fixed part nobody edits (answer format, rules), and the situation (the design, the data list, what was entered).
/// What goes to the model is exactly <see cref="SystemText"/> plus the situation, and "Vollständige Anweisung anzeigen" shows exactly that.
/// </summary>
public static class AiInstructions
{
    public const string DefaultBase =
        "Du bist der Assistent von DesignThix, einer Anwendung zum Gestalten von Etiketten, Karten, Schildern und Plakaten, die über Platzhalter aus " +
        "Datenlisten befüllt werden. Du hilfst knapp, sachlich und auf Deutsch (du-Form, wenn du mit der Person sprichst). Du erfindest nichts: keine Fakten, " +
        "Preise, Zutaten, Herkunftsangaben oder Zahlen, die nicht in den Angaben stehen. Wenn etwas fehlt, lässt du es leer oder fragst gezielt nach.";

    /// <summary>
    /// The fixed part per action: the answer format (one JSON object) and the rules. Not editable on purpose. The actions of DesignThix (data import,
    /// data fill, text suggestions) add their cases here.
    /// </summary>
    public static string Fixed(AiAction action) => action switch
    {
        _ =>
            """
            AUFGABE: Bestätige, dass du erreichbar bist.
            ANTWORTFORMAT: Genau ein JSON-Objekt: {"ok": true, "message": "ein kurzer Satz auf Deutsch"}
            """,
    };

    /// <summary>The field the JSON answer of an action must have.</summary>
    public static string RequiredField(AiAction action) => action switch
    {
        _ => "ok",
    };

    /// <summary>The system message: operator, action addition of the operator, the base instruction of the site, the fixed part.</summary>
    public static string SystemText(OperatorAiConfig op, AiSettings settings, SiteSettings site, AiAction action, string? stepInstruction)
    {
        var sb = new StringBuilder();
        if (!string.IsNullOrWhiteSpace(op.OperatorInstruction))
        {
            sb.AppendLine("## Vorgabe des Betreibers").AppendLine(op.OperatorInstruction.Trim()).AppendLine();
        }

        if (op.ActionInstructions.TryGetValue(action.ToString(), out var extra) && !string.IsNullOrWhiteSpace(extra))
        {
            sb.AppendLine("## Ergänzung des Betreibers für diese Aktion").AppendLine(extra.Trim()).AppendLine();
        }

        sb.AppendLine("## Grundanweisung").AppendLine(string.IsNullOrWhiteSpace(settings.BaseInstruction) ? DefaultBase : settings.BaseInstruction.Trim());
        if (!string.IsNullOrWhiteSpace(site.Company) || !string.IsNullOrWhiteSpace(site.ServiceName))
        {
            sb.AppendLine($"Du sprichst für: {string.Join(", ", new[] { site.Company, site.ServiceName }.Where(s => !string.IsNullOrWhiteSpace(s)))}.");
        }

        sb.AppendLine();
        if (!string.IsNullOrWhiteSpace(stepInstruction))
        {
            sb.AppendLine("## Anweisung für diesen Schritt").AppendLine(stepInstruction.Trim()).AppendLine();
        }

        sb.AppendLine("## Format und Regeln (fest)").AppendLine(Fixed(action).Trim());
        return sb.ToString().Trim();
    }

    public static string Nudge(AiAction action)
        => $"Du hast noch nicht im verlangten Format geantwortet. Antworte jetzt ausschließlich mit dem JSON-Objekt (mit dem Feld \"{RequiredField(action)}\"), ohne Ankündigung und ohne Text davor oder danach.";
}
