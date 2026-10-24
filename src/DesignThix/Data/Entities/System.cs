namespace DesignThix.Data.Entities;

/// <summary>The operational log: who did what. Shown to administrators.</summary>
public class ActivityLog : AuditedEntity
{
    public DateTime OccurredDate { get; set; }

    public long? UserId { get; set; }

    public string? UserName { get; set; }

    public string Action { get; set; } = "";

    public string? EntityType { get; set; }

    public long? EntityId { get; set; }

    public string? Summary { get; set; }

    public string? IpAddress { get; set; }
}

/// <summary>
/// A setting the administrator changes in the app (AI instructions and limits, the site and the server settings).
/// Secrets in here are protected with the key ring of the app (their keys end in "Protected").
/// </summary>
public class Setting : AuditedEntity
{
    public string Key { get; set; } = "";

    public string Value { get; set; } = "";
}
