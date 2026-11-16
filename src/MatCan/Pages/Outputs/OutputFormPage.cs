using System.ComponentModel.DataAnnotations;
using System.Text.Json;
using MatCan.Controls;
using MatCan.Data.Entities;
using MatCan.Logic;
using MatCan.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Rendering;
using Microsoft.EntityFrameworkCore;

namespace MatCan.Pages.Outputs;

/// <summary>
/// The form of an output (tabs Allgemein, Auswahl, Layout, Format) for the pages Create and Edit: the posted values, the choices of the selects, and saving.
/// What the live parts need (the sheets for the preview) travels as JSON in a data attribute; the rows of the chosen list are fetched by the script.
/// </summary>
public abstract class OutputFormPage(Biz biz) : PageModelBase
{
    public sealed class InputModel
    {
        [Required(ErrorMessage = "Bitte gib den Namen ein.")]
        [Display(Name = "Name")]
        public string Name { get; set; } = "";

        [Required(ErrorMessage = "Bitte wähle ein Design aus.")]
        [Display(Name = "Design")]
        public long? DesignId { get; set; }

        [Display(Name = "Datenliste")]
        public long? DataListId { get; set; }

        public OutputRowSelection RowSelection { get; set; } = OutputRowSelection.Active;

        /// <summary>The ids of the rows chosen in the table of the tab Auswahl, "3, 7, 12".</summary>
        public string? SelectedRowIds { get; set; }

        [Display(Name = "Kopien")]
        public int Copies { get; set; } = 1;

        public OutputMode Mode { get; set; } = OutputMode.Single;

        [Display(Name = "Druckbogen")]
        public long? SheetLayoutId { get; set; }

        public bool CropMarks { get; set; }

        public OutputScale Scale { get; set; } = OutputScale.Fit;

        [Display(Name = "Startposition")]
        public int StartPosition { get; set; } = 1;

        public OutputFormat Format { get; set; } = OutputFormat.Print;

        [Display(Name = "Auflösung")]
        public int? Dpi { get; set; }

        [Display(Name = "Dateinamen")]
        public string? FileNamePattern { get; set; } = OutputLogic.DefaultFileNamePattern;
    }

    private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);

    [BindProperty]
    public InputModel Input { get; set; } = new();

    public OutputJob? Job { get; protected set; }

    public List<SelectListItem> DesignItems { get; private set; } = [];

    public List<SelectListItem> ListItems { get; private set; } = [];

    public List<SelectListItem> SheetItems { get; private set; } = [];

    public string SheetsJson { get; private set; } = "[]";

    protected Biz Biz { get; } = biz;

    /// <summary>The person may change the job (Edit on it); a new job is always theirs to make.</summary>
    public bool CanEdit { get; protected set; } = true;

    public List<SelectListItem> SelectionItems { get; } = [new("Nur aktive Zeilen", nameof(OutputRowSelection.Active)), new("Alle Zeilen", nameof(OutputRowSelection.All)), new("Ausgewählte Zeilen", nameof(OutputRowSelection.Selected))];

    public List<SelectListItem> ModeItems { get; } = [new("Ein Etikett pro Seite", nameof(OutputMode.Single)), new("Mehrere Etiketten auf einem Druckbogen", nameof(OutputMode.Sheet))];

    public List<SelectListItem> ScaleItems { get; } = [new("Verkleinern, bis es passt", nameof(OutputScale.Fit)), new("Nicht verkleinern (das Design ragt über den Rand des Etiketts)", nameof(OutputScale.None))];

    public List<SelectListItem> FormatItems { get; } = [new("Drucken oder als PDF speichern", nameof(OutputFormat.Print)), new("PNG-Bilder in einer ZIP-Datei", nameof(OutputFormat.Png))];

    /// <summary>Loads the choices of the selects and the head of the page.</summary>
    protected async Task PrepareAsync(string title, string crumb)
    {
        DesignItems = Options.From(await DesignLogic.ChoicesAsync(Biz));
        ListItems = [.. (await DataListLogic.ChoicesAsync(Biz)).Select(c => new SelectListItem(c.Name, c.Id.ToString(System.Globalization.CultureInfo.InvariantCulture)))];
        var sheets = await SheetLogic.Query(Biz).OrderBy(s => s.Name).ToListAsync();
        SheetItems = [.. sheets.Select(s => new SelectListItem(s.Name, s.Id.ToString(System.Globalization.CultureInfo.InvariantCulture)))];
        SheetsJson = JsonSerializer.Serialize(sheets.Select(s => new { id = s.Id, name = s.Name, paperWidth = s.PaperWidth, paperHeight = s.PaperHeight, marginTop = s.MarginTop, marginLeft = s.MarginLeft, columns = s.Columns, rows = s.Rows, cellWidth = s.CellWidth, cellHeight = s.CellHeight, gapX = s.GapX, gapY = s.GapY, cropMarks = s.CropMarks }), Web);
        Head(title, null, ("Serien (Zusatz)", null), ("Serienausgaben", "/Outputs"), (crumb, null));
        ViewData["ActiveHref"] = "/Outputs";
        ViewData["Width"] = "wide";
    }

    protected OutputLogic.OutputInput ToLogic()
        => new(Input.Name, Input.DesignId ?? 0, Input.DataListId, Input.RowSelection, IdList.Parse(Input.SelectedRowIds), Input.Copies, Input.Mode, Input.SheetLayoutId, Input.CropMarks, Input.Scale,
            Input.StartPosition, Input.Format, Input.Dpi, Input.FileNamePattern);

    protected void FillFrom(OutputJob job)
    {
        Input = new InputModel
        {
            Name = job.Name,
            DesignId = job.DesignId,
            DataListId = job.DataListId,
            RowSelection = job.RowSelection,
            SelectedRowIds = IdList.Join(OutputLogic.SelectedIds(job.SelectedRowIdsJson)),
            Copies = job.Copies,
            Mode = job.Mode,
            SheetLayoutId = job.SheetLayoutId,
            CropMarks = job.CropMarks,
            Scale = job.Scale,
            StartPosition = Math.Max(1, job.StartPosition),
            Format = job.Format,
            Dpi = job.Dpi,
            FileNamePattern = string.IsNullOrWhiteSpace(job.FileNamePattern) ? OutputLogic.DefaultFileNamePattern : job.FileNamePattern,
        };
    }
}
