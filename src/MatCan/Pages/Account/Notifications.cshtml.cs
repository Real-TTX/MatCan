using MatCan.Logic;
using MatCan.Services;
using MatCan.UiKit;
using Microsoft.AspNetCore.Mvc;

namespace MatCan.Pages.Account;

/// <summary>
/// "Benachrichtigungen": the whole list of the person (the bell shows the newest few). A click on one marks it read and opens what it is about; "Alle als gelesen markieren"; an access request can be
/// granted or declined right here. Works without script (links and forms); <c>js/notify.js</c> only adds the live bell.
/// </summary>
public sealed class NotificationsModel(Biz biz) : PageModelBase
{
    public const int PageSize = 25;

    public NotificationPage Notifications { get; private set; } = new([], 0, 0);

    public PagerModel Pager { get; private set; } = null!;

    public DateTime Now => biz.Now;

    [BindProperty(SupportsGet = true, Name = "p")]
    public int PageNumber { get; set; } = 1;

    public async Task OnGetAsync()
    {
        Head("Benachrichtigungen", "Was dich betrifft: Freigaben, Anfragen, Einladungen und Änderungen in deinen Teams.", ("Benachrichtigungen", null));
        ViewData["ActiveHref"] = "/Account/Notifications";
        var page = Math.Max(1, PageNumber);
        Notifications = await NotificationLogic.ListAsync(biz, (page - 1) * PageSize, PageSize);
        Pager = new PagerModel { Page = page, PageSize = PageSize, Total = Notifications.Total, Url = p => p <= 1 ? "/Account/Notifications" : $"/Account/Notifications?p={p}" };
    }

    /// <summary>A click on a notification: marked as read, then what it is about opens (only an address of this app).</summary>
    public async Task<IActionResult> OnGetOpenAsync(long id)
    {
        var url = await NotificationLogic.OpenAsync(biz, id);
        return !string.IsNullOrEmpty(url) && Url.IsLocalUrl(url) ? LocalRedirect(url) : RedirectToPage();
    }

    public async Task<IActionResult> OnPostReadAllAsync()
    {
        await NotificationLogic.ReadAllAsync(biz);
        return RedirectToPage();
    }

    public async Task<IActionResult> OnPostDecideAsync(long requestId, bool grant)
    {
        try
        {
            await AccessRequestLogic.DecideAsync(biz, requestId, grant);
            Flash(grant ? "Der Zugriff ist gewährt." : "Die Anfrage ist abgelehnt.");
        }
        catch (BizException ex)
        {
            FlashError(ex.Message);
        }

        return RedirectToPage();
    }
}
