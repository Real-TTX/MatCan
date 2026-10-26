using DesignThix.Configuration;

namespace DesignThix.Services;

/// <summary>
/// Absolute addresses for links (robots.txt, llms.txt, the mails): the public address of the configuration, else the address of the request, else - for background work such as mails, which has no
/// request - the address the last <b>administrator</b> reached the app by. Never the address of an anonymous request: its <c>Host</c> header is whatever the caller wrote, and a mail with a link to
/// that address would hand an invitation token to a stranger (host header poisoning). The mail settings carry an address of their own (<c>MailSettings.PublicBase</c>) that wins over the remembered one.
/// </summary>
public sealed class PublicUrl(ConfigStore config, IHttpContextAccessor accessor)
{
    private static volatile string? _lastAdminSeen;

    /// <summary>Called for every request of a signed-in administrator: remembers how the app is reached (the address of the administrator's own browser is trusted, a visitor's is not).</summary>
    public static void RememberAdmin(HttpContext http) => _lastAdminSeen = FromRequest(http);

    private static string FromRequest(HttpContext http) => $"{http.Request.Scheme}://{http.Request.Host}{http.Request.PathBase}";

    /// <summary>The address of this request, for the page of the person who made it.</summary>
    public static string Base(ConfigStore config, HttpContext? http = null)
    {
        var configured = config.Current.Server.PublicUrl;
        if (!string.IsNullOrWhiteSpace(configured))
        {
            return configured.TrimEnd('/');
        }

        return http is not null ? FromRequest(http) : _lastAdminSeen ?? "http://localhost:3043";
    }

    /// <summary>The address for links in mails (no request): the configuration, then the address chosen in the mail settings, then the one an administrator was last seen at.</summary>
    public static string ForMail(ConfigStore config, string? chosenInSettings)
    {
        var configured = config.Current.Server.PublicUrl;
        if (!string.IsNullOrWhiteSpace(configured))
        {
            return configured.TrimEnd('/');
        }

        return Normalize(chosenInSettings) ?? _lastAdminSeen ?? "http://localhost:3043";
    }

    /// <summary>An address as the settings may hold it: http or https, a host, no credentials, query or fragment; a path (the app below a prefix) is kept without the closing slash. Null when it is none.</summary>
    public static string? Normalize(string? text)
    {
        if (string.IsNullOrWhiteSpace(text) || !Uri.TryCreate(text.Trim(), UriKind.Absolute, out var uri)
            || (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps) || uri.UserInfo.Length > 0 || uri.Query.Length > 0 || uri.Fragment.Length > 0 || uri.Host.Length == 0)
        {
            return null;
        }

        return uri.GetLeftPart(UriPartial.Path).TrimEnd('/');
    }

    public string Absolute(string path) => Base(config, accessor.HttpContext) + (path.StartsWith('/') ? path : "/" + path);
}
