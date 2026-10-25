using System.Net;
using System.Text;
using DesignThix.Configuration;
using DesignThix.Data;
using DesignThix.Data.Entities;
using DesignThix.Logic;
using DesignThix.UiKit;
using Microsoft.EntityFrameworkCore;

namespace DesignThix.Services.Mail;

/// <summary>A finished mail: the recipient, the subject (one line, nothing that could add a header) and the two bodies.</summary>
public sealed record OutgoingMail(string To, string Subject, string Text, string Html);

/// <summary>
/// The words of every mail. <b>Everything that comes from a person (names, item names, messages) is encoded in the HTML body and flattened in the headers</b>: a name that holds a line break cannot
/// start a new header line, and a name that holds markup shows as text.
/// </summary>
public static class MailContent
{
    /// <summary>A value for a header (subject, display name): no line breaks and no control characters, trimmed, at most 150 characters.</summary>
    public static string Header(string? value)
    {
        var sb = new StringBuilder();
        foreach (var c in value ?? "")
        {
            sb.Append(char.IsControl(c) || (int)c is 0x2028 or 0x2029 ? ' ' : c);
        }

        var flat = System.Text.RegularExpressions.Regex.Replace(sb.ToString(), @"\s{2,}", " ").Trim();
        return flat.Length > 150 ? flat[..150] : flat;
    }

    /// <summary>A line of the plain-text body: line breaks of a name become spaces (a message keeps its paragraphs through <see cref="Block"/>).</summary>
    public static string Line(string? value) => Header(value);

    /// <summary>A paragraph that may hold line breaks (a message): normalised to \n, control characters removed, at most 1000 characters.</summary>
    public static string Block(string? value)
    {
        var sb = new StringBuilder();
        foreach (var c in (value ?? "").Replace("\r\n", "\n").Replace('\r', '\n'))
        {
            if (!char.IsControl(c) || c == '\n')
            {
                sb.Append(c);
            }
        }

        var text = sb.ToString().Trim();
        return text.Length > 1000 ? text[..1000] : text;
    }

    /// <summary>
    /// A mail with a headline, paragraphs and an optional button-like link (an absolute address; anything that is not http or https is left out). The HTML is simple and every value is encoded.
    /// </summary>
    public static OutgoingMail Build(string to, string subject, IEnumerable<string> paragraphs, string? link, string? linkText)
    {
        var safeLink = link is not null && (link.StartsWith("http://", StringComparison.OrdinalIgnoreCase) || link.StartsWith("https://", StringComparison.OrdinalIgnoreCase)) && link.All(c => c > ' ') ? link : null;
        var list = paragraphs.Select(Block).Where(p => p.Length > 0).ToList();
        var text = new StringBuilder();
        var html = new StringBuilder();
        html.Append("<div style=\"font-family:Segoe UI,Arial,sans-serif;font-size:15px;line-height:1.5;color:#1b2733\">");
        foreach (var p in list)
        {
            text.AppendLine(p).AppendLine();
            html.Append("<p>").Append(WebUtility.HtmlEncode(p).Replace("\n", "<br>")).Append("</p>");
        }

        if (safeLink is not null)
        {
            var label = string.IsNullOrWhiteSpace(linkText) ? "Öffnen" : Line(linkText);
            text.AppendLine($"{label}: {safeLink}").AppendLine();
            html.Append("<p><a href=\"").Append(WebUtility.HtmlEncode(safeLink)).Append("\" style=\"display:inline-block;padding:10px 18px;border-radius:8px;background:#1fb3d6;color:#10242b;text-decoration:none;font-weight:600\">")
                .Append(WebUtility.HtmlEncode(label)).Append("</a></p><p style=\"font-size:13px;color:#5b6b78\">Oder kopiere diesen Link in deinen Browser:<br>").Append(WebUtility.HtmlEncode(safeLink)).Append("</p>");
        }

        text.AppendLine("DesignThix");
        html.Append("<p style=\"font-size:13px;color:#5b6b78\">DesignThix</p></div>");
        return new OutgoingMail(to, Header(subject), text.ToString().TrimEnd(), html.ToString());
    }
}

/// <summary>
/// Turns a <see cref="MailJob"/> into a mail, from the database, when the sender takes it: <c>null</c> (the job is dropped) without usable mail settings, for a person who switched that group off in
/// their profile, for a notification or invitation that is gone. A singleton (it opens its own scope); the tests call it directly.
/// </summary>
public sealed class MailComposer(IServiceScopeFactory scopes, SettingStore settings, ConfigStore config)
{
    public async Task<OutgoingMail?> ComposeAsync(MailJob job, CancellationToken ct = default)
    {
        if (!settings.Get<MailSettings>(SettingStore.Mail).IsUsable)
        {
            return null;
        }

        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DtDbContext>();
        return job switch
        {
            MailJob.Invitation i => await InvitationAsync(db, i.InvitationId, ct),
            MailJob.Notification n => await NotificationAsync(db, n.NotificationId, ct),
            _ => null,
        };
    }

    private string Absolute(string path) => Services.PublicUrl.Base(config) + path;

    private async Task<OutgoingMail?> InvitationAsync(DtDbContext db, long id, CancellationToken ct)
    {
        var invitation = await db.Invitation.AsNoTracking().FirstOrDefaultAsync(i => i.Id == id, ct);
        if (invitation is null || string.IsNullOrWhiteSpace(invitation.Email) || invitation.RevokedDate is not null)
        {
            return null;
        }

        var inviter = invitation.CreateUserId is { } by ? await db.User.AsNoTracking().Where(u => u.Id == by).Select(u => u.DisplayName).FirstOrDefaultAsync(ct) : null;
        var team = invitation.SpaceId is { } space ? await db.Space.AsNoTracking().Where(s => s.Id == space).Select(s => s.Name).FirstOrDefaultAsync(ct) : null;
        if (invitation.SpaceId is not null && team is null)
        {
            return null;
        }

        // an address that belongs to an account whose owner switched invitation mails off gets none (the inviter still has the link)
        var account = await db.User.AsNoTracking().Where(u => u.Email == invitation.Email.ToLower()).Select(u => u.NotifyMailJson).FirstOrDefaultAsync(ct);
        if (account is not null && !NotifyMailSettings.Parse(account).Invitations)
        {
            return null;
        }

        var who = string.IsNullOrWhiteSpace(inviter) ? "Jemand" : inviter;
        var link = Absolute($"/Einladung/{invitation.Token:D}");
        var until = Fmt.Date(invitation.ExpiresDate);
        if (team is not null)
        {
            return MailContent.Build(invitation.Email, $"{who} lädt dich ins Team {team} auf DesignThix ein",
                [$"{MailContent.Line(who)} hat dich eingeladen, dem Team „{MailContent.Line(team)}“ als {Labels.Of(invitation.Role)} beizutreten.", $"Der Link gilt bis {until}."], link, "Einladung annehmen");
        }

        return MailContent.Build(invitation.Email, $"{who} lädt dich zu DesignThix ein",
            [$"{MailContent.Line(who)} hat dich zu DesignThix eingeladen: Entwirf Etiketten, Karten, Flyer und Beiträge und arbeite mit anderen zusammen.", $"Der Link gilt bis {until}."], link, "Einladung annehmen");
    }

    private async Task<OutgoingMail?> NotificationAsync(DtDbContext db, long id, CancellationToken ct)
    {
        var row = await db.Notification.AsNoTracking().FirstOrDefaultAsync(n => n.Id == id, ct);
        if (row is null || NotifyMailSettings.GroupOf(row.Kind) is null)
        {
            return null;
        }

        var user = await db.User.AsNoTracking().FirstOrDefaultAsync(u => u.Id == row.UserId && u.IsActive && u.ApprovalState == ApprovalState.Approved, ct);
        if (user is null || !NotifyMailSettings.Parse(user.NotifyMailJson).Wants(row.Kind))
        {
            return null;
        }

        var (text, message, _) = NotificationLogic.Describe(row.Kind, row.DataJson);
        var paragraphs = new List<string> { MailContent.Line(text) };
        if (!string.IsNullOrEmpty(message))
        {
            paragraphs.Add("„" + MailContent.Block(message) + "“");
        }

        var link = row.Url is { Length: > 0 } url && url.StartsWith('/') && !url.StartsWith("//") ? Absolute(url) : null;
        var subject = row.Kind switch
        {
            NotificationKinds.AccessRequest => "Zugriffsanfrage auf DesignThix",
            NotificationKinds.AccessGranted => "Du hast Zugriff bekommen",
            NotificationKinds.Mention => "Du wurdest erwähnt",
            NotificationKinds.CommentReply => "Antwort auf deinen Kommentar",
            NotificationKinds.InviteAccepted => "Deine Einladung wurde angenommen",
            NotificationKinds.TeamAdded => "Du bist einem Team beigetreten",
            _ => text,
        };
        return MailContent.Build(user.Email, row.Kind == NotificationKinds.Share ? text : subject, paragraphs, link, "In DesignThix öffnen");
    }
}
