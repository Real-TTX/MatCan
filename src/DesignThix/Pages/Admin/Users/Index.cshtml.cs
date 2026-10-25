using System.Net;
using DesignThix.Data.Entities;
using DesignThix.Logic;
using DesignThix.Services;
using DesignThix.UiKit;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Html;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DesignThix.Pages.Admin.Users;

/// <summary>
/// Everybody who can sign in: administrators and members, with the filter "Wartet auf Freigabe / Aktiv / Deaktiviert / Administratoren". An account that registered with approval can be approved or
/// declined right in the list.
/// </summary>
public sealed class IndexModel(Biz biz, IAntiforgery antiforgery) : PageModelBase
{
    public ToolbarModel Toolbar { get; private set; } = null!;

    public PagerModel Pager { get; private set; } = null!;

    public TableModel Table { get; private set; } = null!;

    public int Pending { get; private set; }

    private IHtmlContent Button(string handler, long id, string text, string tone, string icon, string token)
        => new HtmlString($"<form method=\"post\" action=\"/Admin/Users?handler={handler}\" class=\"dt-inline-form\"><input type=\"hidden\" name=\"__RequestVerificationToken\" value=\"{WebUtility.HtmlEncode(token)}\" /><input type=\"hidden\" name=\"id\" value=\"{id}\" />" +
            $"<button type=\"submit\" class=\"mat-btn mat-btn--{tone} mat-btn--sm\">{Ui.Icon(icon).ToHtml()}<span>{WebUtility.HtmlEncode(text)}</span></button></form>");

    public async Task OnGetAsync()
    {
        Head("Benutzer", "Wer sich anmelden kann und was er darf.", ("Verwaltung", null), ("Benutzer", null));

        var spec = new ListSpec<User>
        {
            Id = "users",
            Action = "/Admin/Users",
            Label = "Benutzer",
            Noun = "Benutzer",
            SearchPlaceholder = "Name oder E-Mail-Adresse ...",
            Search = (q, text) =>
            {
                var like = Like.Contains(text);
                return q.Where(u => EF.Functions.ILike(u.DisplayName, like) || EF.Functions.ILike(u.Email, like));
            },
            Filters =
            [
                new FilterSpec<User>("status", "Ansicht", [new("pending", "Wartet auf Freigabe"), new("active", "Aktiv"), new("inactive", "Deaktiviert"), new("admins", "Administratoren")], (q, v) => v switch
                {
                    "pending" => q.Where(u => u.ApprovalState == ApprovalState.Pending),
                    "active" => q.Where(u => u.IsActive && u.ApprovalState == ApprovalState.Approved),
                    "inactive" => q.Where(u => !u.IsActive || u.ApprovalState == ApprovalState.Declined),
                    _ => q.Where(u => u.Role == UserRole.Admin),
                }),
            ],
            Sorts = new Dictionary<string, (string, Func<IQueryable<User>, bool, IOrderedQueryable<User>>)>
            {
                ["name"] = ("Name", (q, d) => d ? q.OrderByDescending(u => u.DisplayName) : q.OrderBy(u => u.DisplayName)),
                ["email"] = ("E-Mail", (q, d) => d ? q.OrderByDescending(u => u.Email) : q.OrderBy(u => u.Email)),
                ["role"] = ("Rolle", (q, d) => d ? q.OrderByDescending(u => u.Role).ThenBy(u => u.DisplayName) : q.OrderBy(u => u.Role).ThenBy(u => u.DisplayName)),
                ["login"] = ("Letzte Anmeldung", (q, d) => d ? q.OrderByDescending(u => u.LastLoginDate) : q.OrderBy(u => u.LastLoginDate)),
                ["created"] = ("Registriert", (q, d) => d ? q.OrderByDescending(u => u.CreateDate) : q.OrderBy(u => u.CreateDate)),
            },
            DefaultSort = "name",
        };

        var result = await ListBuilder.RunAsync(UserLogic.Query(biz), Request, spec, HttpContext.RequestAborted);
        Toolbar = result.Toolbar;
        Pager = result.Pager;
        Pending = await UserLogic.PendingCountAsync(biz);
        var me = biz.User.UserId;
        var token = antiforgery.GetAndStoreTokens(HttpContext).RequestToken ?? "";
        Table = TableModel.Of("user-table", "Benutzer", result.Items,
        [
            (new TableColumn("Name"), u => Ui.NameWithSub(u.DisplayName, $"/Admin/Users/Edit?id={u.Id}", u.Id == me ? "das bist du" : u.Email)),
            (new TableColumn("Rolle"), u => Ui.Text(Labels.Of(u.Role))),
            (new TableColumn("Letzte Anmeldung", HideOnPhone: true), u => Ui.Text(u.LastLoginDate is null ? "noch nie" : Fmt.Moment(u.LastLoginDate))),
            (new TableColumn("Status"), u => u.ApprovalState switch
            {
                ApprovalState.Pending => new HtmlString("<div class=\"dt-status-actions\">" + Ui.Concat(Ui.Pill("Wartet auf Freigabe", "warn", "clock"), Button("Approve", u.Id, "Freigeben", "primary", "check", token), Button("Decline", u.Id, "Ablehnen", "secondary", "x", token)).ToHtml() + "</div>"),
                ApprovalState.Declined => Ui.Pill("Abgelehnt", "error"),
                _ => u.IsActive ? Ui.Pill("aktiv", "ok") : Ui.Pill("deaktiviert", "error"),
            }),
        ],
        u => [new RowAction("edit", "Bearbeiten", $"/Admin/Users/Edit?id={u.Id}")]);
        Table = Table with { EmptyIcon = "users" };
    }

    public async Task<IActionResult> OnPostApproveAsync(long id)
    {
        await Decide(id, true);
        return RedirectToPage(new { status = "pending" });
    }

    public async Task<IActionResult> OnPostDeclineAsync(long id)
    {
        await Decide(id, false);
        return RedirectToPage(new { status = "pending" });
    }

    private async Task Decide(long id, bool approve)
    {
        try
        {
            await UserLogic.SetApprovalAsync(biz, id, approve);
            Flash(approve ? "Das Konto ist freigegeben. Die Person kann sich jetzt anmelden." : "Das Konto ist abgelehnt.");
        }
        catch (BizException ex)
        {
            FlashError(ex.Message);
        }
    }
}
