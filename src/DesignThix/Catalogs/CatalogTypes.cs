using DesignThix.Logic;

namespace DesignThix.Catalogs;

/// <summary>What a catalogue offers (a set of flags): the media browser and the editor use it to decide which catalogue shows in which place.</summary>
[Flags]
public enum CatalogKinds
{
    None = 0,
    Photo = 1,
    Illustration = 2,
    Vector = 4,
    Icon = 8,
    Font = 16,
}

/// <summary>What a catalogue can do. A catalogue that can <see cref="Browse"/> shows a first page without a query; one that cannot is search-only.</summary>
[Flags]
public enum CatalogCaps
{
    None = 0,
    Browse = 1,
    Search = 2,
    Collections = 4,
    Filters = 8,
    NeedsKey = 16,

    /// <summary>The pictures live at a provider on the internet: they are imported when they are used, and their licence and author travel with them.</summary>
    External = 32,
}

/// <summary>A link with the text the provider's rules ask for ("Fotos von Pexels").</summary>
public sealed record CatalogLink(string Text, string Url);

/// <summary>What a person (and the administrator) is told about a catalogue.</summary>
/// <param name="Homepage">The provider's site.</param>
/// <param name="KeyHelpUrl">Where a key is asked for (null when none is needed).</param>
/// <param name="ProviderLink">The link the provider's rules require next to its results (null for local catalogues).</param>
/// <param name="LicenceSummary">The licence in a sentence or two, German.</param>
/// <param name="Description">What is in the catalogue, German, one sentence.</param>
/// <param name="DefaultPerUserPerMinute">How many searches one person may make per minute unless the administrator sets another number.</param>
/// <param name="DefaultPerHour">The budget of the key per hour (0 = no budget).</param>
public sealed record CatalogInfo(string Homepage, string? KeyHelpUrl, CatalogLink? ProviderLink, string LicenceSummary, string Description, int DefaultPerUserPerMinute = 30, int DefaultPerHour = 0);

/// <summary>A collection (a category, an area, a folder) a browsable catalogue lists.</summary>
public sealed record CatalogCollection(string Id, string Name, int? Count = null);

/// <summary>The licence of an item. <see cref="AttributionRequired"/>: the author must be named wherever the picture is published.</summary>
public sealed record CatalogLicence(string Code, string Name, string? Url, bool AttributionRequired);

/// <summary>What a person asks of a catalogue.</summary>
public sealed record CatalogQuery
{
    public string Text { get; init; } = "";

    /// <summary>The id of one of the collections of <see cref="ICatalog.CollectionsAsync"/>; empty = the first page or everything.</summary>
    public string Collection { get; init; } = "";

    public CatalogKinds? Kind { get; init; }

    /// <summary>"any", "landscape", "portrait" or "square".</summary>
    public string Orientation { get; init; } = "any";

    /// <summary>A colour name or #rrggbb, where the provider supports it.</summary>
    public string Colour { get; init; } = "";

    /// <summary>From 1.</summary>
    public int Page { get; init; } = 1;

    /// <summary>At most <see cref="MaxPerPage"/>.</summary>
    public int PerPage { get; init; } = 30;

    public string Locale { get; init; } = "de";

    public const int MaxPerPage = 50;

    public const int MaxPage = 50;
}

/// <summary>One result. <see cref="Thumb"/> is an address of this app (a direct address for a local catalogue, a signed proxy address for an external one), never an address of the provider.</summary>
public sealed record CatalogItem
{
    public string Id { get; init; } = "";

    public CatalogKinds Kind { get; init; } = CatalogKinds.Photo;

    public string Title { get; init; } = "";

    public int? Width { get; init; }

    public int? Height { get; init; }

    public string Thumb { get; init; } = "";

    public string Author { get; init; } = "";

    public string AuthorUrl { get; init; } = "";

    public string SourceUrl { get; init; } = "";

    public CatalogLicence? Licence { get; init; }

    /// <summary>Local catalogues: the key of the image that already is in the library (no import).</summary>
    public string? AssetKey { get; init; }

    public string? FontFamily { get; init; }

    public string? IconName { get; init; }
}

/// <summary>One page of results. <see cref="Message"/> is the empty state of a search-only catalogue ("Gib einen Suchbegriff ein.").</summary>
public sealed record CatalogPage(IReadOnlyList<CatalogItem> Items, int Page, int PerPage, int? Total, bool HasMore, string? Message = null)
{
    public static CatalogPage Empty(string? message = null) => new([], 1, 0, 0, false, message);
}

/// <summary>A file of a font family to import (a weight and style of it).</summary>
public sealed record CatalogFontFile(string FileName, byte[] Bytes);

/// <summary>What <see cref="ICatalog.FetchAsync"/> brings for the import: the bytes of a picture (or the files of a font) and everything known about the item.</summary>
public sealed record CatalogFetch
{
    public CatalogItem Item { get; init; } = new();

    public string FileName { get; init; } = "";

    public byte[]? Bytes { get; init; }

    public IReadOnlyList<CatalogFontFile> FontFiles { get; init; } = [];

    /// <summary>The credit line as the provider's rules want it ("Foto von Anna auf Pexels"); empty = the standard line is made from author, catalogue and licence.</summary>
    public string Attribution { get; init; } = "";
}

/// <summary>What a catalogue gets to do its work with: who asks, its settings and key, and the guarded ways to reach the internet.</summary>
public sealed class CatalogContext
{
    public required Biz Biz { get; init; }

    public required CatalogSetting Settings { get; init; }

    /// <summary>The key the administrator saved for the catalogue (null = none).</summary>
    public string? Key { get; init; }

    /// <summary>The address of the provider's API: the operator's (configuration, environment) or the catalogue's own.</summary>
    public string BaseUrl { get; init; } = "";

    public required CatalogServices Services { get; init; }

    public required ICatalog Catalog { get; init; }

    /// <summary>
    /// The address of a thumbnail of this app for a picture at the provider (a signed token, valid for a day). A picture on a host the catalogue may not reach has no thumbnail (empty): the item
    /// is not offered then.
    /// </summary>
    public string Thumb(string? providerUrl)
    {
        if (!Uri.TryCreate(providerUrl, UriKind.Absolute, out var uri))
        {
            return "";
        }

        try
        {
            CatalogHttp.Check(uri, AllowedHosts, Services.AllowsHttp(Catalog), Catalog.Name);
        }
        catch (CatalogException)
        {
            return "";
        }

        return Services.Proxy.AddressFor(Catalog.Id, url: uri.AbsoluteUri);
    }

    /// <summary>The address of a thumbnail of a picture the catalogue itself can read (a file of the server folder).</summary>
    public string ThumbOfItem(string itemId) => Services.Proxy.AddressFor(Catalog.Id, itemId: itemId);

    /// <summary>The provider's answer to <paramref name="url"/> as text: from the cache while it is fresh, else asked (the budget of the key counts) and cached for <paramref name="ttl"/>.</summary>
    public Task<string> GetTextAsync(Uri url, IReadOnlyDictionary<string, string>? headers, TimeSpan ttl, CancellationToken ct)
        => Services.GetTextAsync(this, url, headers, ttl, ct);

    /// <summary>The bytes of a file at the provider (the download of the import): not cached, at most <paramref name="maxBytes"/>.</summary>
    public Task<CatalogHttpResult> DownloadAsync(Uri url, IReadOnlyDictionary<string, string>? headers, long maxBytes, CancellationToken ct)
        => Services.DownloadAsync(this, url, headers, maxBytes, ct);

    /// <summary>The hosts the catalogue may talk to: its own list and the host of the operator's address.</summary>
    public IReadOnlyCollection<string> AllowedHosts => Services.AllowedHosts(Catalog);
}

/// <summary>
/// A source of media (docs/PLAN-CATALOGS.md section 2). One class, one line in <see cref="CatalogRegistry"/>, its own tests: nothing else of the app knows a catalogue by name (the pages, the
/// proxy, the import and the credits are generic).
/// </summary>
public interface ICatalog
{
    /// <summary>"builtin", "uploads", "folder", "pexels" ...: lower case letters, digits and dashes.</summary>
    string Id { get; }

    /// <summary>The German name on the tab.</summary>
    string Name { get; }

    CatalogKinds Kinds { get; }

    CatalogCaps Caps { get; }

    CatalogInfo Info { get; }

    /// <summary>A catalogue is switched on by the administrator unless it is local and needs nothing (Mitgeliefert, Uploads).</summary>
    bool EnabledByDefault { get; }

    /// <summary>The address of the provider's API (null for a local catalogue).</summary>
    string? DefaultBaseUrl { get; }

    /// <summary>The hosts requests (and redirects) may go to: the API and the hosts of the pictures. Never taken from a request of a person.</summary>
    IReadOnlyList<string> AllowedHosts { get; }

    /// <summary>False hides the catalogue completely (the example catalogues exist only when the operator names an address for them).</summary>
    bool IsAvailable(Configuration.ConfigStore config);

    Task<IReadOnlyList<CatalogCollection>> CollectionsAsync(CatalogContext ctx, CancellationToken ct);

    /// <summary>A page of results: a search, or with an empty text and <see cref="CatalogCaps.Browse"/> the first page of the collection.</summary>
    Task<CatalogPage> SearchAsync(CatalogContext ctx, CatalogQuery query, CancellationToken ct);

    /// <summary>The bytes (or font files) and the metadata of one item, for the import. The id is one this catalogue made; it is never trusted as an address.</summary>
    Task<CatalogFetch> FetchAsync(CatalogContext ctx, string itemId, CancellationToken ct);
}
