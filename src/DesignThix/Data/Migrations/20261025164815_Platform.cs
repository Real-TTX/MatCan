using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace DesignThix.Data.Migrations
{
    /// <inheritdoc />
    public partial class Platform : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ApprovalState",
                table: "User",
                type: "character varying(40)",
                maxLength: 40,
                nullable: false,
                defaultValue: "Approved");

            migrationBuilder.AddColumn<string>(
                name: "NotifyMailJson",
                table: "User",
                type: "jsonb",
                nullable: false,
                defaultValue: "{}");

            migrationBuilder.AddColumn<long>(
                name: "PersonalSpaceId",
                table: "User",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "SpaceId",
                table: "SheetLayout",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "FolderId",
                table: "OutputJob",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "SpaceId",
                table: "OutputJob",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "TrashedDate",
                table: "OutputJob",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "TrashedWithFolderId",
                table: "OutputJob",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "SpaceId",
                table: "Font",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "FolderId",
                table: "Design",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "SpaceId",
                table: "Design",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "TrashedDate",
                table: "Design",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "TrashedWithFolderId",
                table: "Design",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "FolderId",
                table: "DataList",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "SpaceId",
                table: "DataList",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "TrashedDate",
                table: "DataList",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "TrashedWithFolderId",
                table: "DataList",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "FolderId",
                table: "Asset",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "SpaceId",
                table: "Asset",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "TrashedDate",
                table: "Asset",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "TrashedWithFolderId",
                table: "Asset",
                type: "bigint",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "AccessRequest",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ItemKind = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    ItemId = table.Column<long>(type: "bigint", nullable: false),
                    UserId = table.Column<long>(type: "bigint", nullable: false),
                    Permission = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Message = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    State = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    DecidedUserId = table.Column<long>(type: "bigint", nullable: true),
                    DecidedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreateDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreateUserId = table.Column<long>(type: "bigint", nullable: true),
                    UpdateDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdateUserId = table.Column<long>(type: "bigint", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AccessRequest", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AccessRequest_User_UserId",
                        column: x => x.UserId,
                        principalTable: "User",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Comment",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    DesignId = table.Column<long>(type: "bigint", nullable: false),
                    PageId = table.Column<string>(type: "text", nullable: true),
                    ElementId = table.Column<string>(type: "text", nullable: true),
                    X = table.Column<double>(type: "double precision", nullable: true),
                    Y = table.Column<double>(type: "double precision", nullable: true),
                    ParentId = table.Column<long>(type: "bigint", nullable: true),
                    Text = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    ResolvedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ResolvedUserId = table.Column<long>(type: "bigint", nullable: true),
                    UpdateState = table.Column<short>(type: "smallint", nullable: false),
                    CreateDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreateUserId = table.Column<long>(type: "bigint", nullable: true),
                    UpdateDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdateUserId = table.Column<long>(type: "bigint", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Comment", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ItemAssetRef",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ItemKind = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    ItemId = table.Column<long>(type: "bigint", nullable: false),
                    AssetKey = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    CreateDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreateUserId = table.Column<long>(type: "bigint", nullable: true),
                    UpdateDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdateUserId = table.Column<long>(type: "bigint", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ItemAssetRef", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ItemVisit",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<long>(type: "bigint", nullable: false),
                    ItemKind = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    ItemId = table.Column<long>(type: "bigint", nullable: false),
                    LastOpenedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreateDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreateUserId = table.Column<long>(type: "bigint", nullable: true),
                    UpdateDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdateUserId = table.Column<long>(type: "bigint", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ItemVisit", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ItemVisit_User_UserId",
                        column: x => x.UserId,
                        principalTable: "User",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Notification",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<long>(type: "bigint", nullable: false),
                    Kind = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    DataJson = table.Column<string>(type: "jsonb", nullable: false),
                    Url = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    ReadDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreateDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreateUserId = table.Column<long>(type: "bigint", nullable: true),
                    UpdateDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdateUserId = table.Column<long>(type: "bigint", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Notification", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Notification_User_UserId",
                        column: x => x.UserId,
                        principalTable: "User",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ShareLink",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ItemKind = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    ItemId = table.Column<long>(type: "bigint", nullable: false),
                    Token = table.Column<Guid>(type: "uuid", nullable: false),
                    Audience = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Permission = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    AllowDownload = table.Column<bool>(type: "boolean", nullable: false),
                    ExpiresDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    RevokedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreateDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreateUserId = table.Column<long>(type: "bigint", nullable: true),
                    UpdateDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdateUserId = table.Column<long>(type: "bigint", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ShareLink", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Space",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Kind = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Slug = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    Description = table.Column<string>(type: "text", nullable: true),
                    Color = table.Column<string>(type: "character varying(9)", maxLength: 9, nullable: false),
                    BrandJson = table.Column<string>(type: "jsonb", nullable: false),
                    StorageQuotaBytes = table.Column<long>(type: "bigint", nullable: true),
                    DeletedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdateState = table.Column<short>(type: "smallint", nullable: false),
                    CreateDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreateUserId = table.Column<long>(type: "bigint", nullable: true),
                    UpdateDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdateUserId = table.Column<long>(type: "bigint", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Space", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Star",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<long>(type: "bigint", nullable: false),
                    ItemKind = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    ItemId = table.Column<long>(type: "bigint", nullable: false),
                    CreateDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreateUserId = table.Column<long>(type: "bigint", nullable: true),
                    UpdateDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdateUserId = table.Column<long>(type: "bigint", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Star", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Star_User_UserId",
                        column: x => x.UserId,
                        principalTable: "User",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "LinkGrant",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ShareLinkId = table.Column<long>(type: "bigint", nullable: false),
                    UserId = table.Column<long>(type: "bigint", nullable: false),
                    LastUsedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreateDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreateUserId = table.Column<long>(type: "bigint", nullable: true),
                    UpdateDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdateUserId = table.Column<long>(type: "bigint", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LinkGrant", x => x.Id);
                    table.ForeignKey(
                        name: "FK_LinkGrant_ShareLink_ShareLinkId",
                        column: x => x.ShareLinkId,
                        principalTable: "ShareLink",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_LinkGrant_User_UserId",
                        column: x => x.UserId,
                        principalTable: "User",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Folder",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    SpaceId = table.Column<long>(type: "bigint", nullable: false),
                    ParentId = table.Column<long>(type: "bigint", nullable: true),
                    Name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Color = table.Column<string>(type: "character varying(9)", maxLength: 9, nullable: true),
                    Path = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    TrashedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    TrashedWithFolderId = table.Column<long>(type: "bigint", nullable: true),
                    UpdateState = table.Column<short>(type: "smallint", nullable: false),
                    CreateDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreateUserId = table.Column<long>(type: "bigint", nullable: true),
                    UpdateDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdateUserId = table.Column<long>(type: "bigint", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Folder", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Folder_Folder_ParentId",
                        column: x => x.ParentId,
                        principalTable: "Folder",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Folder_Space_SpaceId",
                        column: x => x.SpaceId,
                        principalTable: "Space",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Invitation",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Token = table.Column<Guid>(type: "uuid", nullable: false),
                    SpaceId = table.Column<long>(type: "bigint", nullable: true),
                    Email = table.Column<string>(type: "character varying(254)", maxLength: 254, nullable: true),
                    Role = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    ExpiresDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    MaxUses = table.Column<int>(type: "integer", nullable: false),
                    Uses = table.Column<int>(type: "integer", nullable: false),
                    RevokedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreateDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreateUserId = table.Column<long>(type: "bigint", nullable: true),
                    UpdateDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdateUserId = table.Column<long>(type: "bigint", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Invitation", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Invitation_Space_SpaceId",
                        column: x => x.SpaceId,
                        principalTable: "Space",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Share",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ItemKind = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    ItemId = table.Column<long>(type: "bigint", nullable: false),
                    UserId = table.Column<long>(type: "bigint", nullable: true),
                    SpaceId = table.Column<long>(type: "bigint", nullable: true),
                    Permission = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    CreateDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreateUserId = table.Column<long>(type: "bigint", nullable: true),
                    UpdateDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdateUserId = table.Column<long>(type: "bigint", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Share", x => x.Id);
                    table.CheckConstraint("CK_Share_Principal", "(\"UserId\" IS NULL) <> (\"SpaceId\" IS NULL)");
                    table.ForeignKey(
                        name: "FK_Share_Space_SpaceId",
                        column: x => x.SpaceId,
                        principalTable: "Space",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Share_User_UserId",
                        column: x => x.UserId,
                        principalTable: "User",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SpaceMember",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    SpaceId = table.Column<long>(type: "bigint", nullable: false),
                    UserId = table.Column<long>(type: "bigint", nullable: false),
                    Role = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    CreateDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreateUserId = table.Column<long>(type: "bigint", nullable: true),
                    UpdateDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdateUserId = table.Column<long>(type: "bigint", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SpaceMember", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SpaceMember_Space_SpaceId",
                        column: x => x.SpaceId,
                        principalTable: "Space",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_SpaceMember_User_UserId",
                        column: x => x.UserId,
                        principalTable: "User",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_User_PersonalSpaceId",
                table: "User",
                column: "PersonalSpaceId");

            migrationBuilder.CreateIndex(
                name: "IX_SheetLayout_SpaceId",
                table: "SheetLayout",
                column: "SpaceId");

            migrationBuilder.CreateIndex(
                name: "IX_OutputJob_FolderId",
                table: "OutputJob",
                column: "FolderId");

            migrationBuilder.CreateIndex(
                name: "IX_OutputJob_SpaceId_FolderId_TrashedDate",
                table: "OutputJob",
                columns: new[] { "SpaceId", "FolderId", "TrashedDate" });

            migrationBuilder.CreateIndex(
                name: "IX_Font_SpaceId",
                table: "Font",
                column: "SpaceId");

            migrationBuilder.CreateIndex(
                name: "IX_Design_FolderId",
                table: "Design",
                column: "FolderId");

            migrationBuilder.CreateIndex(
                name: "IX_Design_SpaceId_FolderId_TrashedDate",
                table: "Design",
                columns: new[] { "SpaceId", "FolderId", "TrashedDate" });

            migrationBuilder.CreateIndex(
                name: "IX_DataList_FolderId",
                table: "DataList",
                column: "FolderId");

            migrationBuilder.CreateIndex(
                name: "IX_DataList_SpaceId_FolderId_TrashedDate",
                table: "DataList",
                columns: new[] { "SpaceId", "FolderId", "TrashedDate" });

            migrationBuilder.CreateIndex(
                name: "IX_Asset_FolderId",
                table: "Asset",
                column: "FolderId");

            migrationBuilder.CreateIndex(
                name: "IX_Asset_SpaceId_FolderId_TrashedDate",
                table: "Asset",
                columns: new[] { "SpaceId", "FolderId", "TrashedDate" });

            migrationBuilder.CreateIndex(
                name: "IX_AccessRequest_ItemKind_ItemId",
                table: "AccessRequest",
                columns: new[] { "ItemKind", "ItemId" });

            migrationBuilder.CreateIndex(
                name: "IX_AccessRequest_UserId",
                table: "AccessRequest",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_Comment_DesignId",
                table: "Comment",
                column: "DesignId");

            migrationBuilder.CreateIndex(
                name: "IX_Comment_ParentId",
                table: "Comment",
                column: "ParentId");

            migrationBuilder.CreateIndex(
                name: "IX_Folder_ParentId",
                table: "Folder",
                column: "ParentId");

            migrationBuilder.CreateIndex(
                name: "IX_Folder_Path",
                table: "Folder",
                column: "Path")
                .Annotation("Npgsql:IndexMethod", "btree")
                .Annotation("Npgsql:IndexOperators", new[] { "text_pattern_ops" });

            migrationBuilder.CreateIndex(
                name: "IX_Folder_SpaceId_ParentId_TrashedDate",
                table: "Folder",
                columns: new[] { "SpaceId", "ParentId", "TrashedDate" });

            migrationBuilder.CreateIndex(
                name: "IX_Invitation_SpaceId",
                table: "Invitation",
                column: "SpaceId");

            migrationBuilder.CreateIndex(
                name: "IX_Invitation_Token",
                table: "Invitation",
                column: "Token",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ItemAssetRef_AssetKey",
                table: "ItemAssetRef",
                column: "AssetKey");

            migrationBuilder.CreateIndex(
                name: "IX_ItemAssetRef_ItemKind_ItemId",
                table: "ItemAssetRef",
                columns: new[] { "ItemKind", "ItemId" });

            migrationBuilder.CreateIndex(
                name: "IX_ItemAssetRef_ItemKind_ItemId_AssetKey",
                table: "ItemAssetRef",
                columns: new[] { "ItemKind", "ItemId", "AssetKey" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ItemVisit_UserId_ItemKind_ItemId",
                table: "ItemVisit",
                columns: new[] { "UserId", "ItemKind", "ItemId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ItemVisit_UserId_LastOpenedDate",
                table: "ItemVisit",
                columns: new[] { "UserId", "LastOpenedDate" });

            migrationBuilder.CreateIndex(
                name: "IX_LinkGrant_ShareLinkId_UserId",
                table: "LinkGrant",
                columns: new[] { "ShareLinkId", "UserId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_LinkGrant_UserId",
                table: "LinkGrant",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_Notification_UserId_CreateDate",
                table: "Notification",
                columns: new[] { "UserId", "CreateDate" });

            migrationBuilder.CreateIndex(
                name: "IX_Notification_UserId_ReadDate",
                table: "Notification",
                columns: new[] { "UserId", "ReadDate" });

            migrationBuilder.CreateIndex(
                name: "IX_Share_ItemKind_ItemId",
                table: "Share",
                columns: new[] { "ItemKind", "ItemId" });

            migrationBuilder.CreateIndex(
                name: "IX_Share_ItemKind_ItemId_SpaceId",
                table: "Share",
                columns: new[] { "ItemKind", "ItemId", "SpaceId" },
                unique: true,
                filter: "\"SpaceId\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Share_ItemKind_ItemId_UserId",
                table: "Share",
                columns: new[] { "ItemKind", "ItemId", "UserId" },
                unique: true,
                filter: "\"UserId\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Share_SpaceId",
                table: "Share",
                column: "SpaceId");

            migrationBuilder.CreateIndex(
                name: "IX_Share_UserId",
                table: "Share",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_ShareLink_ItemKind_ItemId_Live",
                table: "ShareLink",
                columns: new[] { "ItemKind", "ItemId" },
                unique: true,
                filter: "\"RevokedDate\" IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_ShareLink_Token",
                table: "ShareLink",
                column: "Token",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Space_Slug",
                table: "Space",
                column: "Slug",
                unique: true,
                filter: "\"Slug\" IS NOT NULL AND \"UpdateState\" <> 0");

            migrationBuilder.CreateIndex(
                name: "IX_SpaceMember_SpaceId_UserId",
                table: "SpaceMember",
                columns: new[] { "SpaceId", "UserId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SpaceMember_UserId",
                table: "SpaceMember",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_Star_UserId_ItemKind_ItemId",
                table: "Star",
                columns: new[] { "UserId", "ItemKind", "ItemId" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_Asset_Folder_FolderId",
                table: "Asset",
                column: "FolderId",
                principalTable: "Folder",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Asset_Space_SpaceId",
                table: "Asset",
                column: "SpaceId",
                principalTable: "Space",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_DataList_Folder_FolderId",
                table: "DataList",
                column: "FolderId",
                principalTable: "Folder",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_DataList_Space_SpaceId",
                table: "DataList",
                column: "SpaceId",
                principalTable: "Space",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Design_Folder_FolderId",
                table: "Design",
                column: "FolderId",
                principalTable: "Folder",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Design_Space_SpaceId",
                table: "Design",
                column: "SpaceId",
                principalTable: "Space",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Font_Space_SpaceId",
                table: "Font",
                column: "SpaceId",
                principalTable: "Space",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_OutputJob_Folder_FolderId",
                table: "OutputJob",
                column: "FolderId",
                principalTable: "Folder",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_OutputJob_Space_SpaceId",
                table: "OutputJob",
                column: "SpaceId",
                principalTable: "Space",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_SheetLayout_Space_SpaceId",
                table: "SheetLayout",
                column: "SpaceId",
                principalTable: "Space",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_User_Space_PersonalSpaceId",
                table: "User",
                column: "PersonalSpaceId",
                principalTable: "Space",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Asset_Folder_FolderId",
                table: "Asset");

            migrationBuilder.DropForeignKey(
                name: "FK_Asset_Space_SpaceId",
                table: "Asset");

            migrationBuilder.DropForeignKey(
                name: "FK_DataList_Folder_FolderId",
                table: "DataList");

            migrationBuilder.DropForeignKey(
                name: "FK_DataList_Space_SpaceId",
                table: "DataList");

            migrationBuilder.DropForeignKey(
                name: "FK_Design_Folder_FolderId",
                table: "Design");

            migrationBuilder.DropForeignKey(
                name: "FK_Design_Space_SpaceId",
                table: "Design");

            migrationBuilder.DropForeignKey(
                name: "FK_Font_Space_SpaceId",
                table: "Font");

            migrationBuilder.DropForeignKey(
                name: "FK_OutputJob_Folder_FolderId",
                table: "OutputJob");

            migrationBuilder.DropForeignKey(
                name: "FK_OutputJob_Space_SpaceId",
                table: "OutputJob");

            migrationBuilder.DropForeignKey(
                name: "FK_SheetLayout_Space_SpaceId",
                table: "SheetLayout");

            migrationBuilder.DropForeignKey(
                name: "FK_User_Space_PersonalSpaceId",
                table: "User");

            migrationBuilder.DropTable(
                name: "AccessRequest");

            migrationBuilder.DropTable(
                name: "Comment");

            migrationBuilder.DropTable(
                name: "Folder");

            migrationBuilder.DropTable(
                name: "Invitation");

            migrationBuilder.DropTable(
                name: "ItemAssetRef");

            migrationBuilder.DropTable(
                name: "ItemVisit");

            migrationBuilder.DropTable(
                name: "LinkGrant");

            migrationBuilder.DropTable(
                name: "Notification");

            migrationBuilder.DropTable(
                name: "Share");

            migrationBuilder.DropTable(
                name: "SpaceMember");

            migrationBuilder.DropTable(
                name: "Star");

            migrationBuilder.DropTable(
                name: "ShareLink");

            migrationBuilder.DropTable(
                name: "Space");

            migrationBuilder.DropIndex(
                name: "IX_User_PersonalSpaceId",
                table: "User");

            migrationBuilder.DropIndex(
                name: "IX_SheetLayout_SpaceId",
                table: "SheetLayout");

            migrationBuilder.DropIndex(
                name: "IX_OutputJob_FolderId",
                table: "OutputJob");

            migrationBuilder.DropIndex(
                name: "IX_OutputJob_SpaceId_FolderId_TrashedDate",
                table: "OutputJob");

            migrationBuilder.DropIndex(
                name: "IX_Font_SpaceId",
                table: "Font");

            migrationBuilder.DropIndex(
                name: "IX_Design_FolderId",
                table: "Design");

            migrationBuilder.DropIndex(
                name: "IX_Design_SpaceId_FolderId_TrashedDate",
                table: "Design");

            migrationBuilder.DropIndex(
                name: "IX_DataList_FolderId",
                table: "DataList");

            migrationBuilder.DropIndex(
                name: "IX_DataList_SpaceId_FolderId_TrashedDate",
                table: "DataList");

            migrationBuilder.DropIndex(
                name: "IX_Asset_FolderId",
                table: "Asset");

            migrationBuilder.DropIndex(
                name: "IX_Asset_SpaceId_FolderId_TrashedDate",
                table: "Asset");

            migrationBuilder.DropColumn(
                name: "ApprovalState",
                table: "User");

            migrationBuilder.DropColumn(
                name: "NotifyMailJson",
                table: "User");

            migrationBuilder.DropColumn(
                name: "PersonalSpaceId",
                table: "User");

            migrationBuilder.DropColumn(
                name: "SpaceId",
                table: "SheetLayout");

            migrationBuilder.DropColumn(
                name: "FolderId",
                table: "OutputJob");

            migrationBuilder.DropColumn(
                name: "SpaceId",
                table: "OutputJob");

            migrationBuilder.DropColumn(
                name: "TrashedDate",
                table: "OutputJob");

            migrationBuilder.DropColumn(
                name: "TrashedWithFolderId",
                table: "OutputJob");

            migrationBuilder.DropColumn(
                name: "SpaceId",
                table: "Font");

            migrationBuilder.DropColumn(
                name: "FolderId",
                table: "Design");

            migrationBuilder.DropColumn(
                name: "SpaceId",
                table: "Design");

            migrationBuilder.DropColumn(
                name: "TrashedDate",
                table: "Design");

            migrationBuilder.DropColumn(
                name: "TrashedWithFolderId",
                table: "Design");

            migrationBuilder.DropColumn(
                name: "FolderId",
                table: "DataList");

            migrationBuilder.DropColumn(
                name: "SpaceId",
                table: "DataList");

            migrationBuilder.DropColumn(
                name: "TrashedDate",
                table: "DataList");

            migrationBuilder.DropColumn(
                name: "TrashedWithFolderId",
                table: "DataList");

            migrationBuilder.DropColumn(
                name: "FolderId",
                table: "Asset");

            migrationBuilder.DropColumn(
                name: "SpaceId",
                table: "Asset");

            migrationBuilder.DropColumn(
                name: "TrashedDate",
                table: "Asset");

            migrationBuilder.DropColumn(
                name: "TrashedWithFolderId",
                table: "Asset");
        }
    }
}
