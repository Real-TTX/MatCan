using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace DesignThix.Data.Migrations
{
    /// <inheritdoc />
    public partial class Catalogs : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "SourceJson",
                table: "Font",
                type: "jsonb",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SourceJson",
                table: "Asset",
                type: "jsonb",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "CatalogCacheEntry",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Catalog = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    KeyHash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    ResponseJson = table.Column<string>(type: "jsonb", nullable: false),
                    ExpiresDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreateDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreateUserId = table.Column<long>(type: "bigint", nullable: true),
                    UpdateDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdateUserId = table.Column<long>(type: "bigint", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CatalogCacheEntry", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CatalogCacheEntry_Catalog_KeyHash",
                table: "CatalogCacheEntry",
                columns: new[] { "Catalog", "KeyHash" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CatalogCacheEntry_ExpiresDate",
                table: "CatalogCacheEntry",
                column: "ExpiresDate");

            // An item of a catalogue is in the library of an area once (docs/PLAN-CATALOGS.md section 3). The index is on the JSON, so EF does not know it. A trashed image still holds its
            // place (importing the item again brings it back); a purged one (UpdateState 0) does not; a COPY of an imported image (ItemLogic copies keep the source for the credits and say "copy") is not the import and is left out.
            migrationBuilder.Sql("CREATE UNIQUE INDEX \"IX_Asset_Source\" ON \"Asset\" (\"SpaceId\", ((\"SourceJson\"->>'catalog')), ((\"SourceJson\"->>'itemId'))) WHERE \"SourceJson\" IS NOT NULL AND (\"SourceJson\"->>'copy') IS NULL AND \"UpdateState\" <> 0;");
            migrationBuilder.Sql("CREATE INDEX \"IX_Font_Source\" ON \"Font\" (\"SpaceId\", ((\"SourceJson\"->>'catalog')), ((\"SourceJson\"->>'itemId'))) WHERE \"SourceJson\" IS NOT NULL;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP INDEX IF EXISTS \"IX_Asset_Source\";");
            migrationBuilder.Sql("DROP INDEX IF EXISTS \"IX_Font_Source\";");

            migrationBuilder.DropTable(
                name: "CatalogCacheEntry");

            migrationBuilder.DropColumn(
                name: "SourceJson",
                table: "Font");

            migrationBuilder.DropColumn(
                name: "SourceJson",
                table: "Asset");
        }
    }
}
