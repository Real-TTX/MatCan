using MatCan.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace MatCan.Logic;

/// <summary>How labels sit on a sheet of paper: the cell grid, the margins and the gaps (mm), checked before it is saved.</summary>
public static class SheetLogic
{
    public const int MaxCells = 200;

    /// <summary>The layouts the person may use: the built-in ones and those of their areas.</summary>
    public static IQueryable<SheetLayout> Query(Biz biz)
    {
        biz.RequireSignedIn();
        return Access.VisibleInSpaces<SheetLayout>(biz).AsNoTracking();
    }

    /// <summary>Whether the person may change or delete the layout (their own area; a built-in layout an administrator).</summary>
    public static async Task<bool> CanManageAsync(Biz biz, long id) => await Access.VisibleInSpaces<SheetLayout>(biz, AccessLevel.Manage).AnyAsync(s => s.Id == id);

    /// <summary>The layout as a tracked record when the person may manage it (their area; a built-in layout an administrator).</summary>
    private static async Task<SheetLayout> ManagedAsync(Biz biz, long id)
    {
        if (!await Query(biz).AnyAsync(s => s.Id == id))
        {
            throw new NotFoundException();
        }

        if (!await Access.VisibleInSpaces<SheetLayout>(biz, AccessLevel.Manage).AnyAsync(s => s.Id == id))
        {
            throw new ForbiddenException("Diesen Druckbogen darfst du nicht ändern.");
        }

        return await biz.Db.SheetLayout.FirstOrDefaultAsync(s => s.Id == id) ?? throw new NotFoundException();
    }

    public static async Task<SheetLayout?> GetAsync(Biz biz, long id) => await Query(biz).FirstOrDefaultAsync(s => s.Id == id);

    public static async Task<List<Choice>> ChoicesAsync(Biz biz)
        => await Query(biz).OrderBy(s => s.Name).Select(s => new Choice(s.Id, s.Name, null)).ToListAsync();

    public sealed record SheetInput(string Name, double PaperWidth, double PaperHeight, double MarginTop, double MarginLeft, int Columns, int Rows,
        double CellWidth, double CellHeight, double GapX, double GapY, bool CropMarks);

    /// <summary>The width of the labels and the gaps, in mm, that the sheet needs: columns * cell + gaps.</summary>
    public static (double Width, double Height) UsedArea(SheetInput i)
        => (i.MarginLeft + (i.Columns * i.CellWidth) + (Math.Max(0, i.Columns - 1) * i.GapX), i.MarginTop + (i.Rows * i.CellHeight) + (Math.Max(0, i.Rows - 1) * i.GapY));

    /// <summary>Null when the layout is fine, otherwise what is wrong with it (German, for the form).</summary>
    public static (string? Message, string? Field) Check(SheetInput i)
    {
        if (string.IsNullOrWhiteSpace(i.Name))
        {
            return ("Bitte gib den Namen ein.", "Input.Name");
        }

        if (i.PaperWidth is < 20 or > 2000)
        {
            return ("Die Papierbreite liegt zwischen 20 und 2000 mm.", "Input.PaperWidth");
        }

        if (i.PaperHeight is < 20 or > 2000)
        {
            return ("Die Papierhöhe liegt zwischen 20 und 2000 mm.", "Input.PaperHeight");
        }

        if (i.Columns is < 1 or > 50 || i.Rows is < 1 or > 50 || i.Columns * i.Rows > MaxCells)
        {
            return ($"Spalten und Zeilen liegen zwischen 1 und 50, zusammen höchstens {MaxCells} Etiketten.", "Input.Columns");
        }

        if (i.CellWidth <= 0 || i.CellHeight <= 0)
        {
            return ("Die Etiketten brauchen eine Breite und eine Höhe.", "Input.CellWidth");
        }

        if (i.MarginTop < 0 || i.MarginLeft < 0 || i.GapX < 0 || i.GapY < 0)
        {
            return ("Ränder und Abstände dürfen nicht negativ sein.", "Input.MarginTop");
        }

        var (width, height) = UsedArea(i);
        if (width > i.PaperWidth + 0.01)
        {
            return ($"Die Etiketten sind zusammen {Round(width)} mm breit (mit Rand): das Papier ist nur {Round(i.PaperWidth)} mm breit.", "Input.CellWidth");
        }

        return height > i.PaperHeight + 0.01
            ? ($"Die Etiketten sind zusammen {Round(height)} mm hoch (mit Rand): das Papier ist nur {Round(i.PaperHeight)} mm hoch.", "Input.CellHeight")
            : (null, null);
    }

    private static string Round(double value) => Math.Round(value, 1).ToString("0.##", Services.Fmt.Culture);

    /// <summary>Saves a layout. A new one goes into the area asked for (the person must be allowed to write there; by default their personal area); a change needs Manage.</summary>
    public static async Task<SheetLayout> SaveAsync(Biz biz, long? id, SheetInput input, long? spaceId = null)
    {
        biz.RequireSignedIn();
        long? newSpace = null;
        if (id is null)
        {
            newSpace = await Access.WritableSpaceAsync(biz, spaceId);
        }
        else
        {
            await ManagedAsync(biz, id.Value);
        }

        if (Check(input) is ({ } message, var field))
        {
            throw new BizException(message, field);
        }

        SheetLayout sheet;
        if (id is null)
        {
            sheet = new SheetLayout { SpaceId = newSpace };
            biz.Db.SheetLayout.Add(sheet);
        }
        else
        {
            sheet = await ManagedAsync(biz, id.Value);
        }

        sheet.Name = input.Name.Trim().Length > 200 ? input.Name.Trim()[..200] : input.Name.Trim();
        sheet.PaperWidth = input.PaperWidth;
        sheet.PaperHeight = input.PaperHeight;
        sheet.MarginTop = input.MarginTop;
        sheet.MarginLeft = input.MarginLeft;
        sheet.Columns = input.Columns;
        sheet.Rows = input.Rows;
        sheet.CellWidth = input.CellWidth;
        sheet.CellHeight = input.CellHeight;
        sheet.GapX = input.GapX;
        sheet.GapY = input.GapY;
        sheet.CropMarks = input.CropMarks;
        await biz.Db.SaveChangesAsync();
        await biz.Log.LogAsync(id is null ? "Druckbogen angelegt" : "Druckbogen geändert", nameof(SheetLayout), sheet.Id, sheet.Name);
        return sheet;
    }

    public static async Task DeleteAsync(Biz biz, long id)
    {
        var sheet = await ManagedAsync(biz, id);
        biz.Db.SheetLayout.Remove(sheet);
        await biz.Db.SaveChangesAsync();
        await biz.Log.LogAsync("Druckbogen gelöscht", nameof(SheetLayout), id, sheet.Name);
    }
}
