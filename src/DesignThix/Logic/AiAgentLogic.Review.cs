using DesignThix.Core.Documents;
using Microsoft.EntityFrameworkCore;

namespace DesignThix.Logic;

public static partial class AiAgentLogic
{
    /// <summary>How many findings the review hands back to the model at once (the most serious are first in the lint).</summary>
    private const int MaxReviewFindings = 10;

    /// <summary>
    /// What the automatic check finds in the design now and did not find in the design as the run began: the serious findings of <see cref="AiDesignLint"/> over every page, plus which sample texts of a template are
    /// still unchanged. A problem that was there before the run (a design the person made) is not held against the model. Never throws: a design that cannot be read has no findings.
    /// </summary>
    internal static async Task<List<string>> ReviewFindingsAsync(Biz biz, AiToolSession session)
    {
        try
        {
            var design = await LoadDesignAsync(biz, session.DesignId);
            var now = DocumentValidator.Validate(design.DocumentJson);
            if (!now.Ok || now.Document is null)
            {
                return [];
            }

            var before = new HashSet<string>(StringComparer.Ordinal);   // the keys of what was wrong before the run
            if (session.JournalId is { } journal)
            {
                var old = await biz.Db.AiJournalEntry.AsNoTracking().Where(j => j.Id == journal).Select(j => j.OldValue).FirstOrDefaultAsync();
                if (!string.IsNullOrEmpty(old) && DocumentValidator.Validate(old) is { Ok: true, Document: { } oldDocument })
                {
                    foreach (var finding in AiDesignLint.Check(oldDocument))
                    {
                        before.Add(finding.Key);
                    }
                }
            }

            // a sample text whose words the person wrote themselves (the same names, the same date) is what they asked for
            var request = AiSearchText.Words(session.RequestText).ToHashSet(StringComparer.Ordinal);
            var leftovers = session.TemplateTexts.Where(p => AiSearchText.Words(p.Value).Where(w => w.Length >= 2).Any(w => !request.Contains(w))).ToDictionary(p => p.Key, p => p.Value);
            return [.. AiDesignLint.Check(now.Document, null, leftovers).Where(f => f.Serious && !before.Contains(f.Key)).Select(f => f.Text).Distinct(StringComparer.Ordinal).Take(MaxReviewFindings)];
        }
        catch (Exception ex) when (ex is NotFoundException or ForbiddenException or System.Text.Json.JsonException or InvalidOperationException)
        {
            return [];
        }
    }
}
