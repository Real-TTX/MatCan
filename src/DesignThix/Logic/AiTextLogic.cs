using System.Text;
using System.Text.Json;
using DesignThix.Core.Ai;
using DesignThix.Core.Data;
using DesignThix.Core.Documents;
using DesignThix.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace DesignThix.Logic;

/// <summary>
/// The text suggestion of the designer: up to five alternatives for the text of one element. The AI gets the text (with its <c>{{placeholders}}</c>), how big the box is and the
/// labels and sample values of the design's fields; the CODE keeps only suggestions that carry exactly the placeholders of the original (<see cref="TextSuggestCheck"/>). Nothing is
/// saved: the person picks one in the designer, which is an ordinary change of the document (with its undo) until the design is saved.
/// </summary>
public static class AiTextLogic
{
    public const int MaxInstructionChars = 1000;
    private const int MaxFields = 100;

    private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);

    /// <summary>A field of the design as the designer knows it right now (it may have unsaved fields): only the labels and samples are used, clipped.</summary>
    public sealed record FieldInfo(string? Key, string? Label, string? Type, string? Sample);

    public sealed record SuggestInput(string? Text, string? Instruction, string? ElementName, double? Width, double? Height, string? Unit, IReadOnlyList<FieldInfo>? Fields);

    private static string OneLine(string? text, int max)
    {
        var t = (text ?? string.Empty).Replace('\r', ' ').Replace('\n', ' ').Trim();
        return t.Length <= max ? t : t[..max] + " …";
    }

    private static async Task<AiLogic.Call> PrepareAsync(Biz biz, long designId, SuggestInput input)
    {
        biz.RequireDesigner();
        var design = await biz.Db.Design.AsNoTracking().Where(d => d.Id == designId).Select(d => new { d.Id, d.Name, d.Width, d.Height, d.Unit }).FirstOrDefaultAsync()
            ?? throw new BizException("Das Design gibt es nicht mehr.");
        var text = (input.Text ?? string.Empty).Trim();
        var instruction = (input.Instruction ?? string.Empty).Trim();
        if (text.Length > TextSuggestCheck.MaxTextLength)
        {
            throw new BizException($"Der Text ist zu lang für die KI (höchstens {TextSuggestCheck.MaxTextLength} Zeichen).");
        }

        if (text.Length == 0 && instruction.Length == 0)
        {
            throw new BizException("Der Text ist leer. Schreibe in das Feld, was die KI formulieren soll.");
        }

        if (instruction.Length > MaxInstructionChars)
        {
            throw new BizException($"Die Anweisung ist zu lang (höchstens {MaxInstructionChars} Zeichen).");
        }

        var unit = input.Unit == "px" ? "px" : "mm";
        var sb = new StringBuilder();
        sb.AppendLine($"## Design: {OneLine(design.Name, 200)} ({design.Width:0.##} × {design.Height:0.##} {design.Unit})");
        sb.AppendLine();
        sb.AppendLine("## Das Element");
        if (!string.IsNullOrWhiteSpace(input.ElementName))
        {
            sb.AppendLine($"Name: {OneLine(input.ElementName, 80)}");
        }

        if (input.Width is > 0 and < 100_000 && input.Height is > 0 and < 100_000)
        {
            sb.AppendLine($"Größe des Textfeldes: {input.Width:0.#} × {input.Height:0.#} {unit}");
        }

        var fields = (input.Fields ?? []).Where(f => ColumnDefs.IsValidKey(f.Key)).Take(MaxFields).ToList();
        if (fields.Count > 0)
        {
            sb.AppendLine().AppendLine("## Felder des Designs (im Text als {{Schlüssel}}; Schlüssel | Beschriftung | Art | Beispielwert)");
            foreach (var field in fields)
            {
                var type = field.Type is "text" or "multiline" or "number" or "price" or "image" ? field.Type : "text";
                sb.AppendLine($"{{{{{field.Key}}}}} | {OneLine(field.Label, 80)} | {type} | {OneLine(field.Sample, 80)}");
            }
        }

        var keys = Placeholders.Keys(text);
        sb.AppendLine().AppendLine("## Platzhalter im Text, die in jedem Vorschlag unverändert vorkommen müssen");
        sb.AppendLine(keys.Count == 0 ? "(keine)" : string.Join(", ", keys.Select(k => "{{" + k + "}}")));
        sb.AppendLine().AppendLine("## Der jetzige Text").AppendLine("<<<TEXT").AppendLine(text.Length == 0 ? "(leer)" : text).AppendLine("TEXT>>>");
        var request = JsonSerializer.Serialize(new { designId, text, instruction }, Web);
        return new AiLogic.Call(AiAction.TextSuggest, sb.ToString().TrimEnd(), instruction.Length == 0 ? null : instruction, nameof(Design), design.Id, biz.UserId, biz.User.IpAddress, null, request);
    }

    /// <summary>"Vollständige Anweisung anzeigen": the exact text that would go to the model, without calling it.</summary>
    public static async Task<string> PromptAsync(Biz biz, long designId, SuggestInput input)
        => AiLogic.Show(biz.Services, await PrepareAsync(biz, designId, input));

    public static async Task<AiActionResult> SuggestAsync(Biz biz, long designId, SuggestInput input, CancellationToken ct = default)
    {
        var call = await PrepareAsync(biz, designId, input);
        var outcome = await AiLogic.RunAsync(biz.Db, biz.Services, call, ct);
        var run = outcome.Run;
        if (!outcome.Ok)
        {
            return new AiActionResult(false, run.Id, run.Status, AiLogic.ReasonFor(biz, outcome), outcome.Code, AiLogic.SettingsLinkFor(biz, outcome), null, run.TotalTokens, run.TokensEstimated);
        }

        var suggestions = TextSuggestCheck.Check(outcome.Result, (input.Text ?? string.Empty).Trim());
        AiLogic.Note(run, AiStepKind.Result, $"Prüfung im Code: {suggestions.Items.Count} Vorschlag/Vorschläge angenommen, {suggestions.Warnings.Count} Hinweis(e).", biz.Clock);
        foreach (var warning in suggestions.Warnings.Take(50))
        {
            AiLogic.Warn(run, warning, biz.Clock);
        }

        run.ResultJson = JsonSerializer.Serialize(new { suggestions = suggestions.Items, warnings = suggestions.Warnings }, Web);
        await biz.Db.SaveChangesAsync();
        return new AiActionResult(true, run.Id, run.Status, null, null, null, run.ResultJson, run.TotalTokens, run.TokensEstimated);
    }
}
