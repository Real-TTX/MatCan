using System.ComponentModel.DataAnnotations;
using DesignThix.Data.Entities;
using DesignThix.Logic;
using Microsoft.AspNetCore.Mvc;

namespace DesignThix.Pages.Share;

/// <summary>
/// "Zugriff anfordern" (docs/PLAN-PLATFORM.md section 1.9): where a signed-in person lands who opens a design, folder, data list or output job they may not see (the pages redirect here instead of
/// answering 404). The page says nothing about the item, not even whether it exists, so ids cannot be probed; it only offers to ask (ansehen or bearbeiten, with a message). A person who does have access is
/// sent on to the item.
/// </summary>
public sealed class NoAccessModel(Biz biz) : PageModelBase
{
    public sealed class InputModel
    {
        [Display(Name = "Was möchtest du tun?")]
        public string Permission { get; set; } = "view";

        [StringLength(AccessRequestLogic.MaxMessage, ErrorMessage = "Die Nachricht darf höchstens 500 Zeichen lang sein.")]
        [Display(Name = "Nachricht (optional)")]
        public string? Message { get; set; }
    }

    [BindProperty(SupportsGet = true)]
    public string Kind { get; set; } = "";

    [BindProperty(SupportsGet = true)]
    public long Id { get; set; }

    [BindProperty]
    public InputModel Input { get; set; } = new();

    public ItemKind ItemKind { get; private set; }

    /// <summary>The request the person has open (they may send another to change it).</summary>
    public SharePermission? Sent { get; private set; }

    public static ItemKind? ParseKind(string? kind) => kind?.Trim().ToLowerInvariant() switch
    {
        "folder" => Data.Entities.ItemKind.Folder,
        "design" => Data.Entities.ItemKind.Design,
        "datalist" => Data.Entities.ItemKind.DataList,
        "outputjob" => Data.Entities.ItemKind.OutputJob,
        _ => null,
    };

    /// <summary>The address of this page for an item (the pages that cannot show it send people here).</summary>
    public static string AddressOf(ItemKind kind, long id) => $"/Zugriff/{kind.ToString().ToLowerInvariant()}/{id}";

    private async Task<IActionResult?> PrepareAsync()
    {
        if (ParseKind(Kind) is not { } kind)
        {
            return NotFound();
        }

        ItemKind = kind;
        if (await Access.LevelAsync(biz, kind, Id) >= AccessLevel.View)
        {
            return Redirect(ViewModel.AppUrl(kind, Id));
        }

        Sent = await AccessRequestLogic.MineAsync(biz, kind, Id);
        Head("Zugriff anfordern", null, ("Zugriff anfordern", null));
        return null;
    }

    public async Task<IActionResult> OnGetAsync() => await PrepareAsync() ?? Page();

    public async Task<IActionResult> OnPostAsync()
    {
        if (await PrepareAsync() is { } early)
        {
            return early;
        }

        if (!ModelState.IsValid)
        {
            return Page();
        }

        try
        {
            await AccessRequestLogic.CreateAsync(biz, ItemKind, Id, string.Equals(Input.Permission, "edit", StringComparison.OrdinalIgnoreCase) ? SharePermission.Edit : SharePermission.View, Input.Message);
        }
        catch (BizException ex)
        {
            ModelState.AddModelError(string.Empty, ex.Message);
            return Page();
        }

        Sent = await AccessRequestLogic.MineAsync(biz, ItemKind, Id) ?? (string.Equals(Input.Permission, "edit", StringComparison.OrdinalIgnoreCase) ? SharePermission.Edit : SharePermission.View);
        return Page();
    }
}
