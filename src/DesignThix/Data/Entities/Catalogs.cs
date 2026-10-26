namespace DesignThix.Data.Entities;

/// <summary>
/// The answer of a provider of a catalogue (docs/PLAN-CATALOGS.md section 3), kept for a day: a search of the same words is not asked twice (Pixabay requires it, the others profit).
/// The key is a hash of the request without the secret key; the table holds nothing but what the provider said publicly.
/// </summary>
public class CatalogCacheEntry : AuditedEntity
{
    public string Catalog { get; set; } = "";

    /// <summary>SHA-256 (hex) of the address that was asked.</summary>
    public string KeyHash { get; set; } = "";

    public string ResponseJson { get; set; } = "{}";

    public DateTime ExpiresDate { get; set; }
}

/// <summary>
/// An icon of a catalogue (docs/PLAN-CATALOGS.md sections 3 and 5): a design names it as <c>prefix:name</c>, the body is kept here so the design draws offline and survives the provider. Icons are
/// platform-wide (one copy, tiny, licensed for everybody). The body is the checked, canonical markup of <c>IconBodies</c> (flat shapes, never the provider's text); it is checked again when it is read.
/// </summary>
public class IconBody : AuditedEntity
{
    /// <summary>The set: <c>mdi</c>, <c>tabler</c>, <c>fa7-solid</c> ...</summary>
    public string Prefix { get; set; } = "";

    public string Name { get; set; } = "";

    /// <summary>The canonical markup of the shapes (path, circle ... with fill and stroke written out).</summary>
    public string Body { get; set; } = "";

    /// <summary>The grid the icon is drawn on (24 or 512 or 576 ...).</summary>
    public int Width { get; set; } = 24;

    public int Height { get; set; } = 24;

    /// <summary>The licence code of the set (MIT, CC-BY-4.0 ...).</summary>
    public string LicenceCode { get; set; } = "";

    /// <summary><c>{ catalog, itemId, title, author, authorUrl, sourceUrl, licence: { code, name, url, attributionRequired }, attribution, importedDate }</c> like an asset's source.</summary>
    public string SourceJson { get; set; } = "{}";
}
