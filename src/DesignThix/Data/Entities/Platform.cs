namespace DesignThix.Data.Entities;

// The platform (docs/PLAN-PLATFORM.md section 2): areas ("spaces"), folders, sharing, invitations and the small things around them.

public enum SpaceKind
{
    Personal,
    Team,
}

/// <summary>The role of a person in a team (a personal space has exactly one Owner).</summary>
public enum SpaceRole
{
    Owner,
    Admin,
    Editor,
    Viewer,
}

/// <summary>What something that is shared, starred or visited is. Shares are for Folder, Design, DataList and OutputJob; an Asset is only found in a folder.</summary>
public enum ItemKind
{
    Folder,
    Design,
    DataList,
    OutputJob,
    Asset,
}

public enum SharePermission
{
    View,
    Edit,
}

public enum LinkAudience
{
    SignedIn,
    Public,
}

public enum AccessRequestState
{
    Open,
    Granted,
    Declined,
}

public enum ApprovalState
{
    Approved,
    Pending,
    Declined,
}

/// <summary>An area that holds designs, uploads, data lists and output jobs: the personal area of one person ("Meine Projekte") or a team's.</summary>
public class Space : AuditedEntity, ISoftDeletable
{
    public SpaceKind Kind { get; set; } = SpaceKind.Team;

    public string Name { get; set; } = "";

    /// <summary>Teams only: the address part of the team's pages; unique among the teams that are not deleted.</summary>
    public string? Slug { get; set; }

    public string? Description { get; set; }

    /// <summary>#rrggbb.</summary>
    public string Color { get; set; } = "#1fb3d6";

    /// <summary>The brand kit of the area (<c>BrandKit</c>: colours, fonts, logos).</summary>
    public string BrandJson { get; set; } = "{}";

    /// <summary>The storage limit in bytes; null = the default of the platform settings.</summary>
    public long? StorageQuotaBytes { get; set; }

    public DateTime? DeletedDate { get; set; }

    public UpdateState UpdateState { get; set; } = UpdateState.Created;
}

public class SpaceMember : AuditedEntity
{
    public long SpaceId { get; set; }

    public Space? Space { get; set; }

    public long UserId { get; set; }

    public User? User { get; set; }

    public SpaceRole Role { get; set; } = SpaceRole.Editor;
}

/// <summary>A folder of an area (up to 8 levels deep); designs, uploads, data lists and output jobs sit in it.</summary>
public class Folder : AuditedEntity, ISoftDeletable
{
    public long SpaceId { get; set; }

    public long? ParentId { get; set; }

    public string Name { get; set; } = "";

    public string? Color { get; set; }

    /// <summary>The ids of the ancestors and of the folder itself: <c>/1/7/12/</c>. A folder and everything below it share the prefix.</summary>
    public string Path { get; set; } = "/";

    public DateTime? TrashedDate { get; set; }

    /// <summary>The folder whose trashing took this one with it (restoring that folder brings it back).</summary>
    public long? TrashedWithFolderId { get; set; }

    public UpdateState UpdateState { get; set; } = UpdateState.Created;
}

/// <summary>A share of a folder, design, data list or output job with one person (<see cref="UserId"/>) or one team (<see cref="SpaceId"/>).</summary>
public class Share : AuditedEntity
{
    public ItemKind ItemKind { get; set; }

    public long ItemId { get; set; }

    public long? UserId { get; set; }

    public User? User { get; set; }

    public long? SpaceId { get; set; }

    public Space? Space { get; set; }

    public SharePermission Permission { get; set; } = SharePermission.View;
}

/// <summary>The link of an item. <see cref="Token"/> is the secret in the address; a reset revokes the link and makes a new one.</summary>
public class ShareLink : AuditedEntity
{
    public ItemKind ItemKind { get; set; }

    public long ItemId { get; set; }

    public Guid Token { get; set; } = Guid.NewGuid();

    public LinkAudience Audience { get; set; } = LinkAudience.SignedIn;

    /// <summary>A public link only ever views.</summary>
    public SharePermission Permission { get; set; } = SharePermission.View;

    public bool AllowDownload { get; set; }

    public DateTime? ExpiresDate { get; set; }

    public DateTime? RevokedDate { get; set; }
}

/// <summary>A signed-in person who opened a SignedIn link: the access lasts as long as the link is live.</summary>
public class LinkGrant : AuditedEntity
{
    public long ShareLinkId { get; set; }

    public ShareLink? ShareLink { get; set; }

    public long UserId { get; set; }

    public User? User { get; set; }

    public DateTime LastUsedDate { get; set; }
}

public class AccessRequest : AuditedEntity
{
    public ItemKind ItemKind { get; set; }

    public long ItemId { get; set; }

    public long UserId { get; set; }

    public User? User { get; set; }

    public SharePermission Permission { get; set; } = SharePermission.View;

    public string? Message { get; set; }

    public AccessRequestState State { get; set; } = AccessRequestState.Open;

    public long? DecidedUserId { get; set; }

    public DateTime? DecidedDate { get; set; }
}

public class Invitation : AuditedEntity
{
    public Guid Token { get; set; } = Guid.NewGuid();

    /// <summary>The team; null = an invitation to the platform by an administrator.</summary>
    public long? SpaceId { get; set; }

    public Space? Space { get; set; }

    public string? Email { get; set; }

    public SpaceRole Role { get; set; } = SpaceRole.Editor;

    public DateTime ExpiresDate { get; set; }

    public int MaxUses { get; set; } = 1;

    public int Uses { get; set; }

    public DateTime? RevokedDate { get; set; }
}

public class Star : AuditedEntity
{
    public long UserId { get; set; }

    public User? User { get; set; }

    public ItemKind ItemKind { get; set; }

    public long ItemId { get; set; }
}

public class ItemVisit : AuditedEntity
{
    public long UserId { get; set; }

    public User? User { get; set; }

    public ItemKind ItemKind { get; set; }

    public long ItemId { get; set; }

    public DateTime LastOpenedDate { get; set; }
}

public class Notification : AuditedEntity
{
    public long UserId { get; set; }

    public User? User { get; set; }

    public string Kind { get; set; } = "";

    /// <summary>Ids and names for the text, never free HTML.</summary>
    public string DataJson { get; set; } = "{}";

    public string? Url { get; set; }

    public DateTime? ReadDate { get; set; }
}

public class Comment : AuditedEntity, ISoftDeletable
{
    public long DesignId { get; set; }

    public string? PageId { get; set; }

    public string? ElementId { get; set; }

    public double? X { get; set; }

    public double? Y { get; set; }

    public long? ParentId { get; set; }

    public string Text { get; set; } = "";

    /// <summary>The ids of the people the text mentions with <c>@Name</c> (a JSON array of numbers; only people who could see the design when the comment was written).</summary>
    public string MentionsJson { get; set; } = "[]";

    /// <summary>When the author last changed the text (null = never): the UpdateDate also moves with a resolve, which is no edit.</summary>
    public DateTime? EditedDate { get; set; }

    public DateTime? ResolvedDate { get; set; }

    public long? ResolvedUserId { get; set; }

    public UpdateState UpdateState { get; set; } = UpdateState.Created;
}

/// <summary>The asset keys a design or data list uses: kept up to date on every save, so a person who may view the item may also load its images.</summary>
public class ItemAssetRef : AuditedEntity
{
    public ItemKind ItemKind { get; set; }

    public long ItemId { get; set; }

    public string AssetKey { get; set; } = "";
}
