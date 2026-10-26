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
