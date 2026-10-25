namespace DesignThix.Data.Entities;

/// <summary>An uploaded or built-in image (PNG, JPEG, WebP, GIF, SVG) with a unique <see cref="Key"/> that designs and data list cells refer to.</summary>
public class Asset : AuditedEntity, ISoftDeletable
{
    /// <summary>Where the image lives: null for the built-in images (flags, seals), else the area of the person or team that uploaded it.</summary>
    public long? SpaceId { get; set; }

    public long? FolderId { get; set; }

    public DateTime? TrashedDate { get; set; }

    public long? TrashedWithFolderId { get; set; }

    /// <summary>Lower case letters, digits, dash and underscore. Unique among the records that are not deleted. Designs and data lists refer to it.</summary>
    public string Key { get; set; } = "";

    public string Name { get; set; } = "";

    /// <summary>Flaggen, Siegel, Icons, Logos, Fotos, Hintergründe or Sonstiges.</summary>
    public string Category { get; set; } = "Sonstiges";

    /// <summary>Search words, separated by commas.</summary>
    public string Tags { get; set; } = "";

    public string ContentType { get; set; } = "";

    /// <summary>Without the dot: png, jpg, gif, webp, svg.</summary>
    public string Extension { get; set; } = "";

    public int? Width { get; set; }

    public int? Height { get; set; }

    public byte[] Bytes { get; set; } = [];

    /// <summary>SHA-256 of <see cref="Bytes"/> in lower-case hex: the ETag and the version of the address.</summary>
    public string ContentHash { get; set; } = "";

    public long SizeBytes { get; set; }

    public bool IsBuiltIn { get; set; }

    /// <summary>The key the built-in image was seeded with: a built-in that was renamed or deleted is not seeded again.</summary>
    public string? BuiltInKey { get; set; }

    public UpdateState UpdateState { get; set; } = UpdateState.Created;
}

/// <summary>A font file, served by the app itself (nothing is loaded from the internet).</summary>
public class Font : AuditedEntity, ISoftDeletable
{
    /// <summary>The area the font belongs to; null for the built-in fonts.</summary>
    public long? SpaceId { get; set; }

    public string Family { get; set; } = "";

    /// <summary>"400" or a range for a variable font: "100 900".</summary>
    public string Weight { get; set; } = "400";

    /// <summary>"normal" or "italic".</summary>
    public string Style { get; set; } = "normal";

    /// <summary>Without the dot: ttf, otf, woff, woff2.</summary>
    public string Format { get; set; } = "ttf";

    public byte[] Bytes { get; set; } = [];

    public string ContentHash { get; set; } = "";

    public long SizeBytes { get; set; }

    public bool IsBuiltIn { get; set; }

    /// <summary>The file name the built-in font was seeded with (fonts.json): a deleted built-in is not seeded again.</summary>
    public string? BuiltInKey { get; set; }

    /// <summary>OFL-1.1, Apache-2.0 ... or free text for an uploaded font.</summary>
    public string License { get; set; } = "";

    public string? Source { get; set; }

    public UpdateState UpdateState { get; set; } = UpdateState.Created;
}

/// <summary>A table of values (one row per label), filled into designs through placeholders.</summary>
public class DataList : AuditedEntity, ISoftDeletable
{
    public long? SpaceId { get; set; }

    public long? FolderId { get; set; }

    public DateTime? TrashedDate { get; set; }

    public long? TrashedWithFolderId { get; set; }

    public string Name { get; set; } = "";

    public string? Description { get; set; }

    /// <summary>The columns: <c>[{ "key", "label", "type", "decimals", "category" }]</c> (see <c>ColumnDefs</c>).</summary>
    public string ColumnsJson { get; set; } = "[]";

    /// <summary>The list holds personal data: the AI refuses it unless the administrator allows it.</summary>
    public bool ContainsPersonalData { get; set; }

    /// <summary>Counts every change of the columns or the rows; the grid saves only against the revision it loaded.</summary>
    public int Revision { get; set; } = 1;

    public UpdateState UpdateState { get; set; } = UpdateState.Created;

    public List<DataRow> Rows { get; set; } = [];
}

/// <summary>One row of a data list. Rows are replaced as a set by the grid, so they are really deleted (no soft delete).</summary>
public class DataRow : AuditedEntity
{
    public long DataListId { get; set; }

    public DataList? DataList { get; set; }

    public int Position { get; set; }

    /// <summary>The values by column key: <c>{ "Name": "Gouda", "Preis": "2,99" }</c> (strings only).</summary>
    public string ValuesJson { get; set; } = "{}";

    /// <summary>How many labels of this row are printed (1..999).</summary>
    public int Copies { get; set; } = 1;

    public bool IsActive { get; set; } = true;
}

/// <summary>A design: a page of a fixed size with elements. The document is JSON (docs/PLAN.md section 2) validated by <c>DocumentValidator</c>.</summary>
public class Design : AuditedEntity, ISoftDeletable
{
    /// <summary>The area of the design; null for the system templates (built-in templates, the demo), which everybody may view.</summary>
    public long? SpaceId { get; set; }

    public long? FolderId { get; set; }

    public DateTime? TrashedDate { get; set; }

    public long? TrashedWithFolderId { get; set; }

    public string Name { get; set; } = "";

    public string? Category { get; set; }

    public string? Description { get; set; }

    /// <summary>A template is offered in "Neues Design".</summary>
    public bool IsTemplate { get; set; }

    public string DocumentJson { get; set; } = "{}";

    /// <summary>Counts every save of the document; a save is only accepted against the revision it started from.</summary>
    public int Revision { get; set; } = 1;

    /// <summary>The size of the page, copied from the document for the lists.</summary>
    public double Width { get; set; }

    public double Height { get; set; }

    public string Unit { get; set; } = "mm";

    public byte[]? ThumbnailPng { get; set; }

    public string? ThumbnailHash { get; set; }

    public UpdateState UpdateState { get; set; } = UpdateState.Created;

    public List<DesignRevision> Revisions { get; set; } = [];
}

/// <summary>An earlier state of a design (the newest 30 are kept); it can be restored.</summary>
public class DesignRevision : AuditedEntity
{
    public long DesignId { get; set; }

    public Design? Design { get; set; }

    public int Revision { get; set; }

    public string DocumentJson { get; set; } = "{}";
}

/// <summary>How labels sit on a sheet of paper (all lengths in mm).</summary>
public class SheetLayout : AuditedEntity, ISoftDeletable
{
    /// <summary>The area the layout belongs to; null for the built-in layouts.</summary>
    public long? SpaceId { get; set; }

    public string Name { get; set; } = "";

    public double PaperWidth { get; set; } = 210;

    public double PaperHeight { get; set; } = 297;

    public double MarginTop { get; set; }

    public double MarginLeft { get; set; }

    public int Columns { get; set; } = 1;

    public int Rows { get; set; } = 1;

    public double CellWidth { get; set; }

    public double CellHeight { get; set; }

    public double GapX { get; set; }

    public double GapY { get; set; }

    public bool CropMarks { get; set; }

    public bool IsBuiltIn { get; set; }

    /// <summary>The key the built-in layout was seeded with.</summary>
    public string? BuiltInKey { get; set; }

    public UpdateState UpdateState { get; set; } = UpdateState.Created;
}

public enum OutputRowSelection
{
    All,
    Active,
    Selected,
}

public enum OutputMode
{
    Single,
    Sheet,
}

public enum OutputFormat
{
    Print,
    Png,
}

/// <summary>What happens to a design that is larger than the cell of the sheet: shrunk to fit it, or printed in its own size (and it sticks out).</summary>
public enum OutputScale
{
    Fit,
    None,
}

/// <summary>A saved batch run: design + data list (+ rows, copies) + layout + format. "Ausführen" renders it (phase H).</summary>
public class OutputJob : AuditedEntity, ISoftDeletable
{
    public long? SpaceId { get; set; }

    public long? FolderId { get; set; }

    public DateTime? TrashedDate { get; set; }

    public long? TrashedWithFolderId { get; set; }

    public string Name { get; set; } = "";

    public long DesignId { get; set; }

    public Design? Design { get; set; }

    public long? DataListId { get; set; }

    public DataList? DataList { get; set; }

    public OutputRowSelection RowSelection { get; set; } = OutputRowSelection.Active;

    public string SelectedRowIdsJson { get; set; } = "[]";

    public int Copies { get; set; } = 1;

    public OutputMode Mode { get; set; } = OutputMode.Single;

    public long? SheetLayoutId { get; set; }

    public SheetLayout? SheetLayout { get; set; }

    public OutputFormat Format { get; set; } = OutputFormat.Print;

    public int Dpi { get; set; } = 300;

    public bool CropMarks { get; set; }

    /// <summary>Sheet mode: a design larger than the cell is shrunk to fit it, or printed as it is.</summary>
    public OutputScale Scale { get; set; } = OutputScale.Fit;

    /// <summary>Sheet mode: the number of the first cell that gets a label (1-based); the cells before it stay empty, for a half-used sheet of stickers.</summary>
    public int StartPosition { get; set; } = 1;

    /// <summary>The names of the files of a PNG export: <c>{Design}-{Nr}-{Name}</c> with <c>{Design}</c>, <c>{Nr}</c>, <c>{Kopie}</c> and the keys of the fields.</summary>
    public string FileNamePattern { get; set; } = "{Design}-{Nr}";

    public DateTime? LastRunDate { get; set; }

    public long? LastRunUserId { get; set; }

    public UpdateState UpdateState { get; set; } = UpdateState.Created;
}
