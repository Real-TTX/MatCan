using System.Text.RegularExpressions;

namespace MatCan.Catalogs;

/// <summary>
/// The one exception to <c>img-src 'self' data: blob:</c> (docs/PLAN-CATALOGS.md "Unsplash status"): Unsplash's API guidelines demand that its pictures are shown from the addresses the API returns
/// (<c>images.unsplash.com</c>), so the browser has to load them itself. The exception is as narrow as it can be:
/// <list type="bullet">
/// <item>only the hosts a catalogue names as <see cref="ICatalog.HotlinkHosts"/> (and the host of the operator's address for a test installation), never a wildcard;</item>
/// <item>only while such a catalogue is switched on AND usable (it has its key): with it off the policy is byte for byte the old one (<see cref="CatalogServices.HotlinkOrigins"/>);</item>
/// <item>only for the HTML pages of a signed-in person that show the media browser or the editor (<see cref="NeedsHotlinks"/>): never the public view <c>/s/</c>, never the sign-in, an invitation or an
/// API answer, and never a response that another part of the app gave a policy of its own (<c>/media</c>).</item>
/// </list>
/// The decision is made when the response starts (the person is known by then), by changing the policy the global middleware set.
/// </summary>
public static partial class CatalogCsp
{
    private const string ImgSources = "img-src 'self' data: blob:";

    /// <summary>The pages that load <c>dt-media.js</c> or the editor: the designer, the single print, the brand kit (own and of a team) and the edit page of a data list.</summary>
    [GeneratedRegex(@"^/(Designs/[0-9]+/(Designer|Print)|Brand|Teams/[^/]+/Marke|DataLists/Edit(/[0-9]+)?)/?$", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex PagePattern();

    public static bool NeedsHotlinks(PathString path) => path.HasValue && PagePattern().IsMatch(path.Value!);

    /// <summary>The policy with the origins added to <c>img-src</c>; the unchanged policy for an empty list.</summary>
    public static string WithOrigins(string policy, IReadOnlyList<string> origins)
        => origins.Count == 0 ? policy : policy.Replace(ImgSources, ImgSources + " " + string.Join(' ', origins), StringComparison.Ordinal);

    /// <summary>Remembers the policy the middleware set and, when the response starts, widens it for the pages and people described above.</summary>
    public static void WhenStarting(HttpContext context, string policy)
    {
        context.Response.OnStarting(static state =>
        {
            var (http, original) = ((HttpContext, string))state;
            var response = http.Response;
            if (response.Headers.ContentSecurityPolicy.ToString() != original
                || http.User.Identity?.IsAuthenticated != true
                || response.ContentType?.StartsWith("text/html", StringComparison.OrdinalIgnoreCase) != true
                || !NeedsHotlinks(http.Request.Path))
            {
                return Task.CompletedTask;
            }

            var origins = http.RequestServices.GetRequiredService<CatalogServices>().HotlinkOrigins();
            if (origins.Count > 0)
            {
                response.Headers.ContentSecurityPolicy = WithOrigins(original, origins);
            }

            return Task.CompletedTask;
        }, (context, policy));
    }
}
