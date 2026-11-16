namespace MatCan.Core.Output;

/// <summary>A row of a data list as the plan of an output needs it: which row, how many labels of it, whether it is switched on.</summary>
public sealed record PlanRow(long Id, int Copies, bool IsActive);

/// <summary>
/// The arithmetic of an output: which rows are printed, how many labels that makes (copies of the row times copies of the job) and where on the sheets they go.
/// <c>wwwroot/js/output.js</c> does the same sums in the browser for the live count and the placement; the tests keep both honest.
/// </summary>
public static class OutputPlan
{
    /// <summary>The most labels one output makes: a sheet of PNG files lives in the memory of the browser.</summary>
    public const int MaxLabels = 2000;

    public const int MaxCopies = 999;

    /// <summary>
    /// The most pages one output draws (labels times the pages of the design): a design of several pages makes every label once per page, and all of it lives in the memory
    /// of the browser.
    /// </summary>
    public const int MaxUnits = 4000;

    public const string SelectAll = "All";
    public const string SelectActive = "Active";
    public const string SelectSelected = "Selected";

    /// <summary>The rows that are printed, in the order of the list. <paramref name="selection"/> is All, Active or Selected (the ids in <paramref name="selected"/>).</summary>
    public static IReadOnlyList<PlanRow> Select(IEnumerable<PlanRow> rows, string selection, IReadOnlySet<long>? selected)
        => selection switch
        {
            SelectSelected => [.. rows.Where(r => selected is not null && selected.Contains(r.Id))],
            SelectActive => [.. rows.Where(r => r.IsActive)],
            _ => [.. rows],
        };

    /// <summary>The number of labels: every chosen row gives its copies, the whole is multiplied by the copies of the job. Never overflows.</summary>
    public static long LabelCount(IEnumerable<PlanRow> rows, string selection, IReadOnlySet<long>? selected, int jobCopies)
    {
        var copies = Math.Clamp(jobCopies, 1, MaxCopies);
        long total = 0;
        foreach (var row in Select(rows, selection, selected))
        {
            total += Math.Clamp(row.Copies, 1, MaxCopies) * (long)copies;
        }

        return total;
    }

    /// <summary>
    /// The pieces an output draws: every label gives all pages of the design, in order (label 1 page 1, label 1 page 2, label 2 page 1 ...). In the single mode each piece is a page of
    /// paper, in the sheet mode each piece fills one cell of a sheet.
    /// </summary>
    public static long Units(long labels, int pages) => labels * Math.Clamp(pages, 1, DocumentPageLimit);

    /// <summary>The zero-based number of the piece of label <paramref name="labelIndex"/>, page <paramref name="pageIndex"/> (both zero-based) of a design with <paramref name="pages"/> pages.</summary>
    public static int UnitIndex(int labelIndex, int pageIndex, int pages) => (labelIndex * Math.Clamp(pages, 1, DocumentPageLimit)) + pageIndex;

    private const int DocumentPageLimit = 50;

    /// <summary>How many sheets the labels need when the first <paramref name="startPosition"/> - 1 cells of the first sheet stay empty. 0 labels need no sheet.</summary>
    public static int Sheets(long labels, int startPosition, int cellsPerSheet)
    {
        if (labels <= 0 || cellsPerSheet <= 0)
        {
            return 0;
        }

        var skipped = Math.Clamp(startPosition, 1, cellsPerSheet) - 1;
        return (int)Math.Min(int.MaxValue, (labels + skipped + cellsPerSheet - 1) / cellsPerSheet);
    }

    /// <summary>The cell of the label with the zero-based number <paramref name="labelIndex"/>: sheet, column and row (all zero-based), row by row from the top left.</summary>
    public static (int Sheet, int Column, int Row) CellOf(int labelIndex, int startPosition, int columns, int rows)
    {
        var perSheet = Math.Max(1, columns) * Math.Max(1, rows);
        var cell = labelIndex + Math.Clamp(startPosition, 1, perSheet) - 1;
        var inSheet = cell % perSheet;
        return (cell / perSheet, inSheet % Math.Max(1, columns), inSheet / Math.Max(1, columns));
    }

    /// <summary>The factor a design of <paramref name="designWidth"/> × <paramref name="designHeight"/> is shrunk by to fit a cell (never above 1, never enlarged).</summary>
    public static double FitScale(double designWidth, double designHeight, double cellWidth, double cellHeight)
        => designWidth <= 0 || designHeight <= 0 ? 1 : Math.Min(1, Math.Min(cellWidth / designWidth, cellHeight / designHeight));
}
