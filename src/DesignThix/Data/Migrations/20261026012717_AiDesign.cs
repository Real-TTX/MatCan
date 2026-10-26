using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace DesignThix.Data.Migrations
{
    /// <inheritdoc />
    public partial class AiDesign : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_AiRunStep_AiRunId",
                table: "AiRunStep");

            migrationBuilder.AddColumn<string>(
                name: "Note",
                table: "DesignRevision",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DataJson",
                table: "AiRunStep",
                type: "jsonb",
                nullable: false,
                defaultValue: "{}");

            migrationBuilder.AddColumn<long>(
                name: "ConversationId",
                table: "AiRun",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Number",
                table: "AiRun",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateTable(
                name: "AiAttachment",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ConversationId = table.Column<long>(type: "bigint", nullable: false),
                    RunNumber = table.Column<int>(type: "integer", nullable: false),
                    Kind = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Name = table.Column<string>(type: "character varying(260)", maxLength: 260, nullable: false),
                    AssetId = table.Column<long>(type: "bigint", nullable: true),
                    AssetKey = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    ModelImagePath = table.Column<string>(type: "text", nullable: true),
                    MediaType = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    TextContent = table.Column<string>(type: "text", nullable: true),
                    RefKind = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    RefId = table.Column<long>(type: "bigint", nullable: true),
                    Refused = table.Column<string>(type: "text", nullable: true),
                    CreateDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreateUserId = table.Column<long>(type: "bigint", nullable: true),
                    UpdateDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdateUserId = table.Column<long>(type: "bigint", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AiAttachment", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "AiConversation",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    SubjectType = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    SubjectId = table.Column<long>(type: "bigint", nullable: false),
                    UserId = table.Column<long>(type: "bigint", nullable: false),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Status = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    ScopeJson = table.Column<string>(type: "jsonb", nullable: false),
                    HistoryJson = table.Column<string>(type: "jsonb", nullable: false),
                    Runs = table.Column<int>(type: "integer", nullable: false),
                    Tokens = table.Column<int>(type: "integer", nullable: false),
                    UpdateState = table.Column<short>(type: "smallint", nullable: false),
                    CreateDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreateUserId = table.Column<long>(type: "bigint", nullable: true),
                    UpdateDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdateUserId = table.Column<long>(type: "bigint", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AiConversation", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AiRunStep_AiRunId_Number",
                table: "AiRunStep",
                columns: new[] { "AiRunId", "Number" });

            migrationBuilder.CreateIndex(
                name: "IX_AiRun_ConversationId",
                table: "AiRun",
                column: "ConversationId");

            migrationBuilder.CreateIndex(
                name: "IX_AiAttachment_ConversationId_RunNumber",
                table: "AiAttachment",
                columns: new[] { "ConversationId", "RunNumber" });

            migrationBuilder.CreateIndex(
                name: "IX_AiConversation_SubjectType_SubjectId_Status",
                table: "AiConversation",
                columns: new[] { "SubjectType", "SubjectId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_AiConversation_UserId_SubjectType_SubjectId",
                table: "AiConversation",
                columns: new[] { "UserId", "SubjectType", "SubjectId" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AiAttachment");

            migrationBuilder.DropTable(
                name: "AiConversation");

            migrationBuilder.DropIndex(
                name: "IX_AiRunStep_AiRunId_Number",
                table: "AiRunStep");

            migrationBuilder.DropIndex(
                name: "IX_AiRun_ConversationId",
                table: "AiRun");

            migrationBuilder.DropColumn(
                name: "Note",
                table: "DesignRevision");

            migrationBuilder.DropColumn(
                name: "DataJson",
                table: "AiRunStep");

            migrationBuilder.DropColumn(
                name: "ConversationId",
                table: "AiRun");

            migrationBuilder.DropColumn(
                name: "Number",
                table: "AiRun");

            migrationBuilder.CreateIndex(
                name: "IX_AiRunStep_AiRunId",
                table: "AiRunStep",
                column: "AiRunId");
        }
    }
}
