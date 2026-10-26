using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DesignThix.Data.Migrations
{
    /// <inheritdoc />
    public partial class TemplateMeta : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "TemplateFamily",
                table: "Design",
                type: "character varying(80)",
                maxLength: 80,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TemplateFamilyName",
                table: "Design",
                type: "character varying(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TemplateFormat",
                table: "Design",
                type: "character varying(60)",
                maxLength: 60,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TemplateKey",
                table: "Design",
                type: "character varying(80)",
                maxLength: 80,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TemplateOccasion",
                table: "Design",
                type: "character varying(60)",
                maxLength: 60,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "TemplateOrder",
                table: "Design",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "TemplateTags",
                table: "Design",
                type: "character varying(600)",
                maxLength: 600,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TemplateVariant",
                table: "Design",
                type: "character varying(60)",
                maxLength: 60,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Design_TemplateKey",
                table: "Design",
                column: "TemplateKey");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Design_TemplateKey",
                table: "Design");

            migrationBuilder.DropColumn(
                name: "TemplateFamily",
                table: "Design");

            migrationBuilder.DropColumn(
                name: "TemplateFamilyName",
                table: "Design");

            migrationBuilder.DropColumn(
                name: "TemplateFormat",
                table: "Design");

            migrationBuilder.DropColumn(
                name: "TemplateKey",
                table: "Design");

            migrationBuilder.DropColumn(
                name: "TemplateOccasion",
                table: "Design");

            migrationBuilder.DropColumn(
                name: "TemplateOrder",
                table: "Design");

            migrationBuilder.DropColumn(
                name: "TemplateTags",
                table: "Design");

            migrationBuilder.DropColumn(
                name: "TemplateVariant",
                table: "Design");
        }
    }
}
