using System.Linq.Expressions;
using DesignThix.Data.Entities;
using DesignThix.Services;
using Microsoft.EntityFrameworkCore;

namespace DesignThix.Data;

public class DtDbContext(DbContextOptions<DtDbContext> options, ICurrentUser currentUser, TimeProvider clock) : DbContext(options)
{
    public DbSet<User> User => Set<User>();

    public DbSet<UserTotp> UserTotp => Set<UserTotp>();

    public DbSet<UserRecoveryCode> UserRecoveryCode => Set<UserRecoveryCode>();

    public DbSet<UserSession> UserSession => Set<UserSession>();

    public DbSet<AiProfile> AiProfile => Set<AiProfile>();

    public DbSet<AiRun> AiRun => Set<AiRun>();

    public DbSet<AiRunStep> AiRunStep => Set<AiRunStep>();

    public DbSet<AiJournalEntry> AiJournalEntry => Set<AiJournalEntry>();

    public DbSet<ActivityLog> ActivityLog => Set<ActivityLog>();

    public DbSet<Setting> Setting => Set<Setting>();

    public DbSet<Asset> Asset => Set<Asset>();

    public DbSet<Font> Font => Set<Font>();

    public DbSet<DataList> DataList => Set<DataList>();

    public DbSet<DataRow> DataRow => Set<DataRow>();

    public DbSet<Design> Design => Set<Design>();

    public DbSet<DesignRevision> DesignRevision => Set<DesignRevision>();

    public DbSet<SheetLayout> SheetLayout => Set<SheetLayout>();

    public DbSet<OutputJob> OutputJob => Set<OutputJob>();

    public DbSet<Space> Space => Set<Space>();

    public DbSet<SpaceMember> SpaceMember => Set<SpaceMember>();

    public DbSet<Folder> Folder => Set<Folder>();

    public DbSet<Share> Share => Set<Share>();

    public DbSet<ShareLink> ShareLink => Set<ShareLink>();

    public DbSet<LinkGrant> LinkGrant => Set<LinkGrant>();

    public DbSet<AccessRequest> AccessRequest => Set<AccessRequest>();

    public DbSet<Invitation> Invitation => Set<Invitation>();

    public DbSet<Star> Star => Set<Star>();

    public DbSet<ItemVisit> ItemVisit => Set<ItemVisit>();

    public DbSet<Notification> Notification => Set<Notification>();

    public DbSet<Comment> Comment => Set<Comment>();

    public DbSet<ItemAssetRef> ItemAssetRef => Set<ItemAssetRef>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        // Tables are PascalCase and named like the entity; enums are stored as text; JSON documents are jsonb.
        foreach (var entityType in b.Model.GetEntityTypes())
        {
            entityType.SetTableName(entityType.ClrType.Name);

            foreach (var property in entityType.GetProperties())
            {
                var type = Nullable.GetUnderlyingType(property.ClrType) ?? property.ClrType;
                // UpdateState is a number on purpose (0 = deleted, 1 = created, 2 = updated).
                if (type.IsEnum && type != typeof(UpdateState))
                {
                    property.SetProviderClrType(typeof(string));
                    property.SetMaxLength(40);
                }
                else if (type == typeof(decimal) && property.GetColumnType() is null)
                {
                    property.SetColumnType("numeric(18,2)");
                }
                else if (type == typeof(string) && property.Name.EndsWith("Json", StringComparison.Ordinal))
                {
                    property.SetColumnType("jsonb");
                }
            }

            if (typeof(ISoftDeletable).IsAssignableFrom(entityType.ClrType))
            {
                b.Entity(entityType.ClrType).HasQueryFilter(NotDeleted(entityType.ClrType));
            }
        }

        b.Entity<User>().Ignore(x => x.Initials);
        b.Entity<AiRun>().Ignore(x => x.TotalTokens);

        b.Entity<User>(e =>
        {
            e.HasIndex(x => x.Email).IsUnique().HasFilter("\"UpdateState\" <> 0");
            e.HasOne(x => x.Totp).WithOne(x => x.User).HasForeignKey<UserTotp>(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        });
        b.Entity<UserTotp>().HasIndex(x => x.UserId).IsUnique();
        b.Entity<UserRecoveryCode>().HasOne(x => x.UserTotp).WithMany(x => x.RecoveryCodes).HasForeignKey(x => x.UserTotpId).OnDelete(DeleteBehavior.Cascade);
        b.Entity<UserSession>(e =>
        {
            e.HasIndex(x => x.Token).IsUnique();
            e.HasIndex(x => x.UserId);
            e.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<AiRun>(e =>
        {
            e.HasIndex(x => x.StartDate);
            e.HasIndex(x => new { x.UserId, x.StartDate });
            e.HasIndex(x => new { x.AddressHash, x.StartDate });
        });
        b.Entity<AiRunStep>().HasOne(x => x.AiRun).WithMany(x => x.Steps).HasForeignKey(x => x.AiRunId).OnDelete(DeleteBehavior.Cascade);
        b.Entity<AiJournalEntry>(e =>
        {
            e.HasIndex(x => x.AiRunId);
            e.HasOne(x => x.AiRun).WithMany().HasForeignKey(x => x.AiRunId).OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<ActivityLog>().HasIndex(x => x.OccurredDate);
        b.Entity<Setting>().HasIndex(x => x.Key).IsUnique();

        // The library: the key of an image is unique among the images that are not deleted (the key is kept lower case by the logic).
        b.Entity<Asset>(e =>
        {
            e.HasIndex(x => x.Key).IsUnique().HasFilter("\"UpdateState\" <> 0");
            e.HasIndex(x => x.Category);
            e.Property(x => x.Key).HasMaxLength(80);
            e.Property(x => x.Name).HasMaxLength(200);
            e.Property(x => x.Category).HasMaxLength(60);
            e.Property(x => x.ContentHash).HasMaxLength(64);
        });
        b.Entity<Font>(e =>
        {
            e.HasIndex(x => x.Family);
            e.Property(x => x.Family).HasMaxLength(100);
            e.Property(x => x.ContentHash).HasMaxLength(64);
        });
        b.Entity<DataList>(e =>
        {
            e.Property(x => x.Revision).IsConcurrencyToken();
            e.Property(x => x.Name).HasMaxLength(200);
        });
        b.Entity<DataRow>(e =>
        {
            e.HasIndex(x => new { x.DataListId, x.Position });
            e.HasOne(x => x.DataList).WithMany(x => x.Rows).HasForeignKey(x => x.DataListId).OnDelete(DeleteBehavior.Cascade);
        });
        b.Entity<Design>(e =>
        {
            e.Property(x => x.Revision).IsConcurrencyToken();
            e.HasIndex(x => x.UpdateDate);
            e.HasIndex(x => x.IsTemplate);
            e.Property(x => x.Name).HasMaxLength(200);
            e.Property(x => x.Category).HasMaxLength(80);
            e.Property(x => x.Unit).HasMaxLength(8);
            e.Property(x => x.ThumbnailHash).HasMaxLength(64);
        });
        b.Entity<DesignRevision>(e =>
        {
            e.HasIndex(x => new { x.DesignId, x.Revision }).IsUnique();
            e.HasOne(x => x.Design).WithMany(x => x.Revisions).HasForeignKey(x => x.DesignId).OnDelete(DeleteBehavior.Cascade);
        });
        b.Entity<SheetLayout>().Property(x => x.Name).HasMaxLength(200);
        b.Entity<OutputJob>(e =>
        {
            e.Property(x => x.Name).HasMaxLength(200);
            e.Property(x => x.FileNamePattern).HasMaxLength(200);
            e.HasOne(x => x.Design).WithMany().HasForeignKey(x => x.DesignId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.DataList).WithMany().HasForeignKey(x => x.DataListId).OnDelete(DeleteBehavior.SetNull);
            e.HasOne(x => x.SheetLayout).WithMany().HasForeignKey(x => x.SheetLayoutId).OnDelete(DeleteBehavior.SetNull);
        });

        ConfigurePlatform(b);
    }

    /// <summary>The platform (docs/PLAN-PLATFORM.md section 2): areas, folders, sharing and what hangs on them. Foreign keys without navigation properties keep the rows honest.</summary>
    private static void ConfigurePlatform(ModelBuilder b)
    {
        b.Entity<User>(e =>
        {
            e.HasIndex(x => x.PersonalSpaceId);
            e.HasOne<Space>().WithMany().HasForeignKey(x => x.PersonalSpaceId).OnDelete(DeleteBehavior.SetNull);
        });

        b.Entity<Space>(e =>
        {
            e.HasIndex(x => x.Slug).IsUnique().HasFilter("\"Slug\" IS NOT NULL AND \"UpdateState\" <> 0");
            e.Property(x => x.Name).HasMaxLength(120);
            e.Property(x => x.Slug).HasMaxLength(80);
            e.Property(x => x.Color).HasMaxLength(9);
        });

        b.Entity<SpaceMember>(e =>
        {
            e.HasIndex(x => new { x.SpaceId, x.UserId }).IsUnique();
            e.HasIndex(x => x.UserId);
            e.HasOne(x => x.Space).WithMany().HasForeignKey(x => x.SpaceId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<Folder>(e =>
        {
            e.Property(x => x.Name).HasMaxLength(120);
            e.Property(x => x.Color).HasMaxLength(9);
            e.Property(x => x.Path).HasMaxLength(200);
            e.HasIndex(x => x.ParentId);
            e.HasIndex(x => new { x.SpaceId, x.ParentId, x.TrashedDate });
            e.HasIndex(x => x.Path).HasMethod("btree").HasOperators("text_pattern_ops");
            e.HasOne<Space>().WithMany().HasForeignKey(x => x.SpaceId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne<Folder>().WithMany().HasForeignKey(x => x.ParentId).OnDelete(DeleteBehavior.Restrict);
        });

        // What lives in an area: the same placement columns on designs, data lists, output jobs and uploads.
        b.Entity<Design>(Place);
        b.Entity<DataList>(Place);
        b.Entity<OutputJob>(Place);
        b.Entity<Asset>(Place);
        b.Entity<Font>(e =>
        {
            e.HasIndex(x => x.SpaceId);
            e.HasOne<Space>().WithMany().HasForeignKey(x => x.SpaceId).OnDelete(DeleteBehavior.Restrict);
        });
        b.Entity<SheetLayout>(e =>
        {
            e.HasIndex(x => x.SpaceId);
            e.HasOne<Space>().WithMany().HasForeignKey(x => x.SpaceId).OnDelete(DeleteBehavior.Restrict);
        });

        b.Entity<Share>(e =>
        {
            e.ToTable(t => t.HasCheckConstraint("CK_Share_Principal", "(\"UserId\" IS NULL) <> (\"SpaceId\" IS NULL)"));
            e.HasIndex(x => new { x.ItemKind, x.ItemId });
            e.HasIndex(x => x.UserId);
            e.HasIndex(x => x.SpaceId);
            e.HasIndex(x => new { x.ItemKind, x.ItemId, x.UserId }).IsUnique().HasFilter("\"UserId\" IS NOT NULL");
            e.HasIndex(x => new { x.ItemKind, x.ItemId, x.SpaceId }).IsUnique().HasFilter("\"SpaceId\" IS NOT NULL");
            e.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Space).WithMany().HasForeignKey(x => x.SpaceId).OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<ShareLink>(e =>
        {
            e.HasIndex(x => x.Token).IsUnique();
            e.HasIndex(x => new { x.ItemKind, x.ItemId });
            e.HasIndex(x => new { x.ItemKind, x.ItemId }).IsUnique().HasDatabaseName("IX_ShareLink_ItemKind_ItemId_Live").HasFilter("\"RevokedDate\" IS NULL");
        });

        b.Entity<LinkGrant>(e =>
        {
            e.HasIndex(x => new { x.ShareLinkId, x.UserId }).IsUnique();
            e.HasIndex(x => x.UserId);
            e.HasOne(x => x.ShareLink).WithMany().HasForeignKey(x => x.ShareLinkId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<AccessRequest>(e =>
        {
            e.Property(x => x.Message).HasMaxLength(500);
            e.HasIndex(x => new { x.ItemKind, x.ItemId });
            e.HasIndex(x => x.UserId);
            e.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<Invitation>(e =>
        {
            e.HasIndex(x => x.Token).IsUnique();
            e.HasIndex(x => x.SpaceId);
            e.Property(x => x.Email).HasMaxLength(254);
            e.HasOne(x => x.Space).WithMany().HasForeignKey(x => x.SpaceId).OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<Star>(e =>
        {
            e.HasIndex(x => new { x.UserId, x.ItemKind, x.ItemId }).IsUnique();
            e.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<ItemVisit>(e =>
        {
            e.HasIndex(x => new { x.UserId, x.ItemKind, x.ItemId }).IsUnique();
            e.HasIndex(x => new { x.UserId, x.LastOpenedDate });
            e.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<Notification>(e =>
        {
            e.Property(x => x.Kind).HasMaxLength(60);
            e.Property(x => x.Url).HasMaxLength(500);
            e.HasIndex(x => new { x.UserId, x.ReadDate });
            e.HasIndex(x => new { x.UserId, x.CreateDate });
            e.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<Comment>(e =>
        {
            e.Property(x => x.Text).HasMaxLength(2000);
            e.HasIndex(x => x.DesignId);
            e.HasIndex(x => x.ParentId);
        });

        b.Entity<ItemAssetRef>(e =>
        {
            e.Property(x => x.AssetKey).HasMaxLength(80);
            e.HasIndex(x => x.AssetKey);
            e.HasIndex(x => new { x.ItemKind, x.ItemId });
            e.HasIndex(x => new { x.ItemKind, x.ItemId, x.AssetKey }).IsUnique();
        });
    }

    private static void Place<T>(Microsoft.EntityFrameworkCore.Metadata.Builders.EntityTypeBuilder<T> e) where T : class
    {
        e.HasIndex("SpaceId", "FolderId", "TrashedDate");
        e.HasIndex("FolderId");
        e.HasOne<Space>().WithMany().HasForeignKey("SpaceId").OnDelete(DeleteBehavior.Restrict);
        e.HasOne<Folder>().WithMany().HasForeignKey("FolderId").OnDelete(DeleteBehavior.Restrict);
    }

    private static LambdaExpression NotDeleted(Type clrType)
    {
        var parameter = Expression.Parameter(clrType, "e");
        var state = Expression.Property(parameter, nameof(ISoftDeletable.UpdateState));
        var body = Expression.NotEqual(state, Expression.Constant(UpdateState.Deleted));
        return Expression.Lambda(body, parameter);
    }

    public override int SaveChanges(bool acceptAllChangesOnSuccess)
    {
        Stamp();
        return base.SaveChanges(acceptAllChangesOnSuccess);
    }

    public override Task<int> SaveChangesAsync(bool acceptAllChangesOnSuccess, CancellationToken cancellationToken = default)
    {
        Stamp();
        return base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
    }

    /// <summary>Fills the audit columns and turns a delete of a soft-deletable record into a state change.</summary>
    private void Stamp()
    {
        var now = clock.GetUtcNow().UtcDateTime;
        var userId = currentUser.UserId;

        foreach (var entry in ChangeTracker.Entries<AuditedEntity>().ToList())
        {
            if (entry.State == EntityState.Deleted && entry.Entity is ISoftDeletable soft)
            {
                entry.State = EntityState.Modified;
                soft.UpdateState = UpdateState.Deleted;
            }

            switch (entry.State)
            {
                case EntityState.Added:
                    if (entry.Entity.CreateDate == default)
                    {
                        entry.Entity.CreateDate = now;
                    }

                    entry.Entity.CreateUserId ??= userId;
                    entry.Entity.UpdateDate = entry.Entity.CreateDate;
                    entry.Entity.UpdateUserId = entry.Entity.CreateUserId;
                    if (entry.Entity is ISoftDeletable added && added.UpdateState == UpdateState.Deleted)
                    {
                        added.UpdateState = UpdateState.Created;
                    }

                    break;

                case EntityState.Modified:
                    entry.Entity.UpdateDate = now;
                    entry.Entity.UpdateUserId = userId;
                    entry.Property(nameof(AuditedEntity.CreateDate)).IsModified = false;
                    entry.Property(nameof(AuditedEntity.CreateUserId)).IsModified = false;
                    if (entry.Entity is ISoftDeletable modified && modified.UpdateState == UpdateState.Created)
                    {
                        modified.UpdateState = UpdateState.Updated;
                    }

                    break;
            }
        }
    }
}
