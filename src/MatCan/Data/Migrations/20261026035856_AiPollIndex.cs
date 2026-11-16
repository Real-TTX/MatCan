using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MatCan.Data.Migrations
{
    /// <inheritdoc />
    public partial class AiPollIndex : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_AiJournalEntry_EntityType_EntityId",
                table: "AiJournalEntry",
                columns: new[] { "EntityType", "EntityId" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_AiJournalEntry_EntityType_EntityId",
                table: "AiJournalEntry");
        }
    }
}
